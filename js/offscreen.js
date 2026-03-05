const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const videoSource = document.getElementById('videoSource')
const audioSource = document.getElementById('audioSource')
const fontPreloader = document.getElementById('fontPreloader')

// 字体配置
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

// 字体缓存
const fontDataUriCache = {}

// ── 字体加载 ──────────────────────────────────────────────
async function loadFont (fontFamily) {
  const fontName = fontFamily.replace(/'/g, '').trim()

  if (!REMOTE_FONTS_CONFIG[fontName]) {
    return
  }

  try {
    // 下载字体
    if (!fontDataUriCache[fontName]) {
      const cssResp = await fetch(REMOTE_FONTS_CONFIG[fontName], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        }
      })
      const cssText = await cssResp.text()

      // 解析 @font-face
      const faceBlocks = [...cssText.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(m => m[1])
      let fontUrl = null
      for (const block of faceBlocks) {
        const isBold = /font-weight\s*:\s*(bold|700)/i.test(block)
        const urlMatch = block.match(/url\(([^)]+)\)\s+format\(['"]?woff2['"]?\)/)
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

      // 防止大字体导致调用栈溢出
      const uint8 = new Uint8Array(fontBuffer)
      let binary = ''
      for (let i = 0; i < uint8.length; i += 8192) {
        binary += String.fromCharCode(...uint8.subarray(i, i + 8192))
      }
      fontDataUriCache[fontName] = `data:font/woff2;base64,${btoa(binary)}`
      console.log(' woff2 下载完成:', fontName, (fontBuffer.byteLength / 1024).toFixed(1), 'KB')
    }

    // 2. 注册不同 weight
    await registerFontFaces(fontName)

    // 渲染字体
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

// 注册 FontFace
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

// 缓存字体重新添加进新的 context
async function reAddFonts () {
  for (const fontName of Object.keys(fontDataUriCache)) {
    await registerFontFaces(fontName)
  }
  await document.fonts.ready
}

// 自动换行
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

// 字幕绘制
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

  // overlay 定义的大致区域
  const rectX = (overlaySettings.left / 100) * canvas.width
  const rectY = (overlaySettings.top / 100) * canvas.height
  const rectW = (overlaySettings.width / 100) * canvas.width
  const rectH = (overlaySettings.height / 100) * canvas.height

  // 先基于 overlay 宽度做换行
  const lines = getWrappedLines(ctx, sentence.words, rectW)
  const totalContentH = lines.length * lh

  const spaceW = ctx.measureText(' ').width
  let maxLineWidth = 0
  lines.forEach(line => {
    const lineWidth = line.reduce((acc, w) => acc + ctx.measureText(w.text).width, 0) + (line.length - 1) * spaceW
    if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
  })

  // 黑底背景
  const padX = fs * 0.4 // 左右 padding
  const padY = fs * 0.4 // 上下 padding

  const bgW = maxLineWidth + padX * 2
  const bgH = totalContentH + padY * 2

  // 黑底居中放在 overlay 区域里
  const bgX = rectX + (rectW - bgW) / 2
  const bgY = rectY + (rectH - bgH) / 2

  // 整体字幕黑色半透明背景
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.beginPath()
  ctx.roundRect(bgX, bgY, bgW, bgH, 10)
  ctx.fill()
  ctx.restore()

  // 从黑底内部开始排版文字
  let startY = bgY + padY + lh / 2

  lines.forEach(line => {
    const lineWidth = line.reduce((acc, w) => acc + ctx.measureText(w.text).width, 0) + (line.length - 1) * spaceW
    let currentX = bgX + (bgW - lineWidth) / 2

    line.forEach(word => {
      const wW = ctx.measureText(word.text).width

      // 按单词时间高亮
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

      // 文字绘制
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

// 导出视频
async function startExport (payload) {
  const { pingPong } = payload

  // 下载并注册字体
  await loadFont(payload.fontFamily)

  // 加载媒体文件
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

  // 音频路由
  const audioCtx = new AudioContext()
  const audioSrc = audioCtx.createMediaElementSource(audioSource)
  const audioDest = audioCtx.createMediaStreamDestination()
  audioSrc.connect(audioDest)
  audioSrc.connect(audioCtx.destination)

  // 录制流
  const canvasStream = canvas.captureStream(0)
  const canvasTrack = canvasStream.getVideoTracks()[0]
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioDest.stream.getAudioTracks()])

  const chunks = []
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 10_000_000
  })

  recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.onstop = () => {
    audioCtx.close()
    const blob = new Blob(chunks, { type: 'video/webm' })
    const blobUrl = URL.createObjectURL(blob)
    console.log('完成，大小:', (blob.size / 1024 / 1024).toFixed(2), 'MB')
    chrome.runtime.sendMessage({ type: 'export-done', blobUrl })
  }

  // 字体预热
  const fontName = payload.fontFamily.replace(/'/g, '').trim()
  const warmupFs = (payload.fontSize * canvas.width) / 900
  ctx.font = `bold ${warmupFs}px "${fontName}"`
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fillText('字体预热 Font Warmup 0123', 0, warmupFs)
  await new Promise(r => setTimeout(r, 200))

  // 开始播放和录制
  videoSource.currentTime = 0
  audioSource.currentTime = 0

  // console.log('等待 5 秒...')
  // await new Promise(r => setTimeout(r, 5000))
  console.log('开始录制')

  await audioSource.play()
  recorder.start()

  const FPS = 30
  const frameDuration = 1000 / FPS
  const startWallTime = performance.now()

  let debugFrameDone = false

  const tick = async () => {
    const elapsed = (performance.now() - startWallTime) / 1000

    if (elapsed >= audioDuration) {
      console.log('渲染结束')
      recorder.stop()
      return
    }

    let videoT = elapsed % videoDuration
    if (pingPong) {
      const cycle = Math.floor(elapsed / videoDuration)
      videoT = cycle % 2 === 1 ? videoDuration - (elapsed % videoDuration) : elapsed % videoDuration
    }

    await seekTo(videoT)
    ctx.drawImage(videoSource, 0, 0, canvas.width, canvas.height)
    drawSubtitle(elapsed, payload)

    if (!debugFrameDone && elapsed > 0.5) {
      debugFrameDone = true
      // const dataUrl = canvas.toDataURL('image/png')
      // console.log('第一帧截图', dataUrl)
    }

    canvasTrack.requestFrame()

    chrome.runtime.sendMessage({
      type: 'export-progress',
      progress: elapsed / audioDuration
    })

    const nextFrameAt = startWallTime + (Math.floor(elapsed * FPS) + 1) * frameDuration
    const delay = Math.max(0, nextFrameAt - performance.now())
    setTimeout(tick, delay)
  }

  setTimeout(tick, 0)
}

// 消息监听
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'do-export') {
    console.log('do-export', Object.keys(msg.payload))
    startExport(msg.payload)
  }
})
