const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d', { willReadFrequently: true })
const videoSource = document.getElementById('videoSource')
const audioSource = document.getElementById('audioSource')
const fontPreloader = document.getElementById('fontPreloader')

const REMOTE_FONTS_CONFIG = {
  Roboto: 'https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap',
  Kavivanar: 'https://fonts.googleapis.com/css2?family=Kavivanar&display=swap',
  'Playwrite NZ': 'https://fonts.googleapis.com/css2?family=Playwrite+NZ:wght@100..400&display=swap',
  'Shantell Sans': 'https://fonts.googleapis.com/css2?family=Shantell+Sans:wght@700&display=swap',
  'Playpen Sans Thai': 'https://fonts.googleapis.com/css2?family=Playpen+Sans+Thai:wght@700&display=swap',
  'Patrick Hand': 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap',
  'Comic Neue': 'https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&display=swap',
  Kalam: 'https://fonts.googleapis.com/css2?family=Kalam:wght@700&display=swap',
  Caveat: 'https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap',
  Stylish: 'https://fonts.googleapis.com/css2?family=Stylish&display=swap',
  Merienda: 'https://fonts.googleapis.com/css2?family=Merienda:wght@700&display=swap',
  Itim: 'https://fonts.googleapis.com/css2?family=Itim&display=swap',
  'Rubik Doodle Shadow': 'https://fonts.googleapis.com/css2?family=Rubik+Doodle+Shadow&display=swap'
}

const fontDataUriCache = {}

async function loadFont (fontFamily) {
  const fontName = fontFamily.replace(/'/g, '').trim()
  if (!REMOTE_FONTS_CONFIG[fontName]) return

  try {
    if (!fontDataUriCache[fontName]) {
      const cssResp = await fetch(REMOTE_FONTS_CONFIG[fontName], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        }
      })
      const cssText = await cssResp.text()

      const faceBlocks = [...cssText.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(m => m[1])
      let fontUrl = null
      for (const block of faceBlocks) {
        const isBold = /font-weight\s*:\s*(bold|700)/i.test(block)
        const urlMatch = block.match(/url\(([^)]+)\)\s+format\(['"']?woff2['"']?\)/)
        if (urlMatch) {
          const url = urlMatch[1].replace(/['"]/g, '')
          if (!fontUrl) fontUrl = url
          if (isBold) {
            fontUrl = url
            break
          }
        }
      }

      if (!fontUrl) {
        console.warn('未找到 woff2 CSS', cssText.slice(0, 300))
        return
      }

      const fontResp = await fetch(fontUrl)
      const fontBuffer = await fontResp.arrayBuffer()

      const uint8 = new Uint8Array(fontBuffer)
      let binary = ''
      for (let i = 0; i < uint8.length; i += 8192) {
        binary += String.fromCharCode(...uint8.subarray(i, i + 8192))
      }

      fontDataUriCache[fontName] = `data:font/woff2;base64,${btoa(binary)}`
      console.log('woff2 下载完成:', fontName, (fontBuffer.byteLength / 1024).toFixed(1), 'KB')
    }

    await registerFontFaces(fontName)

    fontPreloader.style.fontFamily = `"${fontName}", sans-serif`
    fontPreloader.style.fontWeight = 'bold'
    fontPreloader.textContent = '字体激活 Font Warmup 0123'
    await new Promise(r => setTimeout(r, 300))

    console.log(
      '加载字体成功:',
      fontName,
      [...document.fonts].filter(f => f.family.replace(/'/g, '').trim() === fontName).map(f => `w${f.weight}(${f.status})`)
    )
  } catch (error) {
    console.warn('失败', fontName, error)
  }
}

async function registerFontFaces (fontName) {
  const dataUri = fontDataUriCache[fontName]
  if (!dataUri) return
  for (const weight of ['400', '700']) {
    const already = [...document.fonts].some(f => f.family.replace(/'/g, '').trim() === fontName && f.status === 'loaded')
    if (already) continue
    const face = new FontFace(fontName, `url(${dataUri})`, { weight })
    const loaded = await face.load()
    document.fonts.add(loaded)
  }
  await document.fonts.ready
}

async function reAddFonts () {
  for (const fontName of Object.keys(fontDataUriCache)) {
    await registerFontFaces(fontName)
  }
  await document.fonts.ready
}

function getWrappedLines (ctx, words, maxWidth) {
  const lines = []
  let currentLine = [],
    currentWidth = 0
  const spaceWidth = ctx.measureText(' ').width

  words.forEach(word => {
    const ww = ctx.measureText(word.text).width
    if (currentWidth + ww > maxWidth && currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = [word]
      currentWidth = ww + spaceWidth
    } else {
      currentLine.push(word)
      currentWidth += ww + spaceWidth
    }
  })
  if (currentLine.length > 0) lines.push(currentLine)
  return lines
}

// 分析区域颜色并返回合适的水印颜色
function analyzeAreaColor (ctx, x, y, width, height) {
  // 确保分析区域在画布范围内
  x = Math.max(0, x)
  y = Math.max(0, y)
  width = Math.min(ctx.canvas.width - x, width)
  height = Math.min(ctx.canvas.height - y, height)

  // 如果区域太小，返回默认颜色
  if (width <= 0 || height <= 0) {
    return '#ffffff'
  }

  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data
  let totalR = 0
  let totalG = 0
  let totalB = 0

  // 计算区域平均颜色
  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i]
    totalG += data[i + 1]
    totalB += data[i + 2]
  }

  const pixels = data.length / 4
  const avgR = totalR / pixels
  const avgG = totalG / pixels
  const avgB = totalB / pixels

  // 计算亮度 (使用相对亮度公式)
  const brightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114) / 255

  // 计算背景色的HSL值
  const [h, s, l] = rgbToHsl(avgR, avgG, avgB)

  // 根据背景颜色决定水印颜色并增加对比度
  if (brightness > 0.5) {
    // 如果背景偏亮，使用深色水印
    // 保持色相，增加饱和度，大幅降低亮度
    const darkL = Math.max(0, 0.1) // 固定为很暗的值
    const [r, g, b] = hslToRgb(h, 0.8, darkL)
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
  } else {
    // 如果背景偏暗，使用亮色水印
    // 保持色相，降低饱和度，大幅提高亮度
    const lightL = Math.min(1, 0.9) // 固定为很亮的值
    const [r, g, b] = hslToRgb(h, 0.2, lightL)
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
  }
}

// RGB转HSL
function rgbToHsl (r, g, b) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h
  let s
  const l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return [h, s, l]
}

// HSL转RGB
function hslToRgb (h, s, l) {
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return [r * 255, g * 255, b * 255]
}

function drawSubtitle (t, payload) {
  const { subtitleData, overlaySettings, fontSize, highlightBg, fontColor = '#ffffff', fontFamily = 'Arial', bgScale, lineHeightMult } = payload

  const sentence = subtitleData.find(s => t >= s.start && t < s.end)
  if (!sentence) return

  const fs = (fontSize * canvas.width) / 900
  const lh = fs * lineHeightMult
  const fontName = fontFamily.replace(/'/g, '').trim()

  ctx.font = `bold ${fs}px "${fontName}"`
  if (ctx.font.includes('sans-serif') || ctx.font === '10px sans-serif') {
    ctx.font = `bold ${fs}px ${fontName}`
  }
  ctx.textBaseline = 'middle'

  const rectX = (overlaySettings.left / 100) * canvas.width
  const rectY = (overlaySettings.top / 100) * canvas.height
  const rectW = (overlaySettings.width / 100) * canvas.width
  const rectH = (overlaySettings.height / 100) * canvas.height

  const lines = getWrappedLines(ctx, sentence.words, rectW)
  const totalContentH = lines.length * lh

  const spaceW = ctx.measureText(' ').width
  let maxLineWidth = 0
  lines.forEach(line => {
    const lineWidth = line.reduce((acc, w) => acc + ctx.measureText(w.text).width, 0) + (line.length - 1) * spaceW
    if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
  })

  const padX = fs * 0.4
  const padY = fs * 0.4
  const bgW = maxLineWidth + padX * 2
  const bgH = totalContentH + padY * 2
  const bgX = rectX + (rectW - bgW) / 2
  const bgY = rectY + (rectH - bgH) / 2

  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.beginPath()
  ctx.roundRect(bgX, bgY, bgW, bgH, 10)
  ctx.fill()
  ctx.restore()

  let startY = bgY + padY + lh / 2

  lines.forEach(line => {
    const lineWidth = line.reduce((acc, w) => acc + ctx.measureText(w.text).width, 0) + (line.length - 1) * spaceW
    let currentX = bgX + (bgW - lineWidth) / 2

    line.forEach(word => {
      const wW = ctx.measureText(word.text).width

      if (t >= word.start && t < word.end) {
        ctx.save()
        ctx.fillStyle = highlightBg
        const bgHWord = fs * bgScale
        const bgYWord = startY - bgHWord / 2
        ctx.beginPath()
        ctx.roundRect(currentX - 6, bgYWord, wW + 12, bgHWord, 8)
        ctx.fill()
        ctx.restore()
      }

      ctx.font = `bold ${fs}px "${fontName}"`
      ctx.fillStyle = fontColor
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 4
      ctx.fillText(word.text, currentX, startY)
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      currentX += wW + spaceW
    })

    startY += lh
  })
}

async function seekTo (targetTime) {
  if (Math.abs(videoSource.currentTime - targetTime) < 0.033) return
  return new Promise(resolve => {
    videoSource.onseeked = resolve
    videoSource.currentTime = targetTime
  })
}

async function dataURLToArrayBuffer (dataURL) {
  const res = await fetch(dataURL)
  return res.arrayBuffer()
}

async function startExport (payload) {
  const { pingPong } = payload

  await loadFont(payload.fontFamily)

  videoSource.src = payload.videoData
  audioSource.src = payload.audioData

  await Promise.all([
    new Promise(r => {
      videoSource.onloadedmetadata = r
    }),
    new Promise(r => {
      audioSource.onloadedmetadata = r
    })
  ])

  canvas.width = videoSource.videoWidth
  canvas.height = videoSource.videoHeight
  await reAddFonts()

  const audioDuration = audioSource.duration
  const videoDuration = videoSource.duration
  const FPS = 30
  const sampleRate = 44100
  const totalFrames = Math.ceil(audioDuration * FPS)

  // ── 第一步：用 OfflineAudioContext 把音频完整预渲染为 PCM buffer ──
  console.log('预渲染音频...')
  const rawAudioBuffer = await dataURLToArrayBuffer(payload.audioData)
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(audioDuration * sampleRate), sampleRate)
  const decodedAudio = await offlineCtx.decodeAudioData(rawAudioBuffer)
  const offlineSrc = offlineCtx.createBufferSource()
  offlineSrc.buffer = decodedAudio
  offlineSrc.connect(offlineCtx.destination)
  offlineSrc.start()
  const renderedAudioBuffer = await offlineCtx.startRendering()
  console.log('音频预渲染完成:', renderedAudioBuffer.duration.toFixed(2), 's')

  // 提取左右声道 PCM Float32 数据
  const leftChannel = renderedAudioBuffer.getChannelData(0)
  const rightChannel = renderedAudioBuffer.numberOfChannels > 1 ? renderedAudioBuffer.getChannelData(1) : leftChannel

  // ── 第二步：初始化 webm-muxer ──────────────────────────────────
  // WebmMuxer 由 offscreen.html 中的 script 标签提供
  const muxer = new WebMMuxer.Muxer({
    target: new WebMMuxer.ArrayBufferTarget(),
    video: {
      codec: 'V_VP9',
      width: canvas.width,
      height: canvas.height,
      frameRate: FPS
    },
    audio: {
      codec: 'A_OPUS',
      sampleRate,
      numberOfChannels: 2
    },
    firstTimestampBehavior: 'offset'
  })

  // ── 第三步：初始化 VideoEncoder ────────────────────────────────
  let videoEncoderFinished = false
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta)
    },
    error: e => console.error('VideoEncoder 错误:', e)
  })

  videoEncoder.configure({
    codec: 'vp09.00.10.08',
    width: canvas.width,
    height: canvas.height,
    bitrate: 10_000_000,
    framerate: FPS
  })

  // ── 第四步：初始化 AudioEncoder ────────────────────────────────
  const AUDIO_CHUNK_FRAMES = 960 // Opus 标准帧大小（20ms @ 48kHz），44100 时约 882，取 960 兼容
  let audioEncoderFinished = false
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => {
      muxer.addAudioChunk(chunk, meta)
    },
    error: e => console.error('AudioEncoder 错误:', e)
  })

  audioEncoder.configure({
    codec: 'opus',
    sampleRate,
    numberOfChannels: 2,
    bitrate: 128_000
  })

  // ── 第五步：提前把全部音频 chunk 送入 AudioEncoder ─────────────
  // 音频和视频分开送，完全不依赖时钟，各自按采样位置打时间戳
  console.log('编码音频...')
  const totalAudioSamples = leftChannel.length
  for (let offset = 0; offset < totalAudioSamples; offset += AUDIO_CHUNK_FRAMES) {
    const frameCount = Math.min(AUDIO_CHUNK_FRAMES, totalAudioSamples - offset)
    const timestampUs = Math.round((offset / sampleRate) * 1_000_000)

    // f32-planar 格式：左声道数据全部在前，右声道数据全部在后
    const planar = new Float32Array(frameCount * 2)
    planar.set(leftChannel.subarray(offset, offset + frameCount), 0)
    planar.set(rightChannel.subarray(offset, offset + frameCount), frameCount)

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frameCount,
      numberOfChannels: 2,
      timestamp: timestampUs,
      data: planar
    })

    audioEncoder.encode(audioData)
    audioData.close()

    if (offset % (AUDIO_CHUNK_FRAMES * 100) === 0) {
      await new Promise(r => setTimeout(r, 0))
    }
  }

  await audioEncoder.flush()
  console.log('音频编码完成')

  // ── 第六步：逐帧渲染视频，seek → 画帧 → VideoEncoder.encode ───
  console.log('开始渲染视频帧...')
  videoSource.currentTime = 0
  await seekTo(0)

  let debugFrameDone = false

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const elapsed = frameIndex / FPS
    const timestampUs = Math.round(elapsed * 1_000_000) // 微秒
    const durationUs = Math.round(1_000_000 / FPS)

    // 计算视频时间（完整保留 pingPong 逻辑）
    let videoT = elapsed % videoDuration
    if (pingPong) {
      const cycle = Math.floor(elapsed / videoDuration)
      videoT = cycle % 2 === 1 ? videoDuration - (elapsed % videoDuration) : elapsed % videoDuration
    }

    await seekTo(videoT)
    ctx.drawImage(videoSource, 0, 0, canvas.width, canvas.height)
    drawSubtitle(elapsed, payload)

    // 绘制水印到右下角（智能选色）
    if (payload.watermarkText) {
      const wmFs = Math.max(30, canvas.width * 0.022)
      const padding = 15
      ctx.save()
      ctx.font = `bold ${wmFs}px sans-serif`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'

      // 计算水印文字区域的位置，用于采样背景色
      const wmWidth = ctx.measureText(payload.watermarkText).width + 20
      const wmHeight = wmFs + 10
      const sampleX = canvas.width - padding - wmWidth
      const sampleY = canvas.height - padding - wmHeight

      // 智能分析水印区域背景色，选择对比色
      const smartColor = analyzeAreaColor(ctx, sampleX, sampleY, wmWidth, wmHeight)

      // 先绘制半透明背景描边增强可读性
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = 6
      ctx.globalAlpha = 0.65
      ctx.fillStyle = smartColor
      ctx.fillText(payload.watermarkText, canvas.width - padding, canvas.height - padding)
      ctx.restore()
    }

    if (!debugFrameDone && elapsed > 0.5) {
      debugFrameDone = true
      // const dataUrl = canvas.toDataURL('image/png')
      // console.log('第一帧截图', dataUrl)
    }

    // 每隔 30 帧插入一个关键帧，保证 seek 精度
    const keyFrame = frameIndex % 30 === 0

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration: durationUs
    })

    videoEncoder.encode(videoFrame, { keyFrame })
    videoFrame.close()

    chrome.runtime.sendMessage({
      type: 'export-progress',
      progress: elapsed / audioDuration
    })

    // 每帧让出主线程，防止阻塞
    await new Promise(r => setTimeout(r, 0))
  }

  await videoEncoder.flush()
  console.log('视频帧编码完成')

  // ── 第七步：封装并导出 ──────────────────────────────────────────
  muxer.finalize()

  const { buffer } = muxer.target
  const blob = new Blob([buffer], { type: 'video/webm' })
  const blobUrl = URL.createObjectURL(blob)

  console.log('完成，大小:', (blob.size / 1024 / 1024).toFixed(2), 'MB')
  chrome.runtime.sendMessage({ type: 'export-done', blobUrl })
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'do-export') {
    console.log('do-export', Object.keys(msg.payload))
    startExport(msg.payload)
  }
})
