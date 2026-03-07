// 字幕数据
let subtitleData = [
  {
    start: 0.1,
    end: 1.8,
    text: 'Cristo murió por mí.',
    words: [
      {
        text: 'Cristo',
        start: 0.1,
        end: 0.6
      },
      {
        text: 'murió',
        start: 0.6,
        end: 1.1
      },
      {
        text: 'por',
        start: 1.1,
        end: 1.3
      },
      {
        text: 'mí.',
        start: 1.3,
        end: 1.8
      }
    ]
  },
  {
    start: 1.8,
    end: 3.3,
    text: 'Ahora yo vivo para él.',
    words: [
      {
        text: 'Ahora',
        start: 1.8,
        end: 2.2
      },
      {
        text: 'yo',
        start: 2.2,
        end: 2.4
      },
      {
        text: 'vivo',
        start: 2.4,
        end: 2.7
      },
      {
        text: 'para',
        start: 2.7,
        end: 3
      },
      {
        text: 'él.',
        start: 3,
        end: 3.3
      }
    ]
  },
  {
    start: 3.3,
    end: 4.6,
    text: 'Si amas a Jesús,',
    words: [
      {
        text: 'Si',
        start: 3.3,
        end: 3.5
      },
      {
        text: 'amas',
        start: 3.5,
        end: 3.8
      },
      {
        text: 'a',
        start: 3.8,
        end: 4
      },
      {
        text: 'Jesús,',
        start: 4,
        end: 4.6
      }
    ]
  },
  {
    start: 4.6,
    end: 5.9,
    text: 'qué triste.',
    words: [
      {
        text: 'qué',
        start: 4.6,
        end: 5
      },
      {
        text: 'triste.',
        start: 5,
        end: 5.9
      }
    ]
  },
  {
    start: 6,
    end: 8.6,
    text: 'Nadie respondió a esta pregunta.',
    words: [
      {
        text: 'Nadie',
        start: 6,
        end: 6.6
      },
      {
        text: 'respondió',
        start: 6.6,
        end: 7.2
      },
      {
        text: 'a',
        start: 7.2,
        end: 7.4
      },
      {
        text: 'esta',
        start: 7.4,
        end: 7.8
      },
      {
        text: 'pregunta.',
        start: 7.8,
        end: 8.6
      }
    ]
  },
  {
    start: 8.6,
    end: 9.8,
    text: '¿Amas a Dios?',
    words: [
      {
        text: '¿Amas',
        start: 8.6,
        end: 9
      },
      {
        text: 'a',
        start: 9,
        end: 9.2
      },
      {
        text: 'Dios?',
        start: 9.2,
        end: 9.8
      }
    ]
  }
]

// 存储字幕区域的相对位置和大小
let overlaySettings = {
  left: 10,
  top: 60,
  width: 80,
  height: 30
}
// 标记是否正在拖拽
let dragging = false
// 标记是否正在缩放大小
let resizing = false
// 记录鼠标事件坐标
let startX, startY, initLeft, initTop, initWidth, initHeight

const videoInput = document.getElementById('videoInput')
const subtitle = document.getElementById('subtitle')
const voicePack = document.getElementById('voicePack')
const videoPreview = document.getElementById('videoPreview')
const videoContainer = document.getElementById('videoContainer')
const previewPlaceholder = document.getElementById('previewPlaceholder')
const textOverlay = document.getElementById('textOverlay')
const previewText = document.getElementById('previewText')
const exportBtn = document.getElementById('exportBtn')
const progressContainer = document.getElementById('progressContainer')
const progressFill = document.getElementById('progressFill')
const progressPct = document.getElementById('progressPct')
const fontSizeInput = document.getElementById('fontSize')
const fontColorInput = document.getElementById('fontColor')
const fontFamilySelect = document.getElementById('fontFamily')
const watermarkInput = document.getElementById('watermarkText')

/**
 * @description 左下角提示
 * @param {string} text - 文本内容
 */
function notify (text) {
  Toastify({
    text,
    duration: 2000,
    close: true,
    gravity: 'bottom',
    position: 'left',
    style: {
      background: 'linear-gradient(to right, #00b09b, #96c93d)',
      fontSize: '18px'
    }
  }).showToast()
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

// 用临时 canvas 截取当前视频帧，分析水印区域背景色
function sampleWatermarkColor () {
  const wmText = watermarkInput ? watermarkInput.value.trim() : ''
  if (!wmText || videoPreview.readyState < 2) return '#ffffff'

  const tmpCanvas = document.createElement('canvas')
  const vw = videoPreview.videoWidth || videoContainer.offsetWidth
  const vh = videoPreview.videoHeight || videoContainer.offsetHeight
  tmpCanvas.width = vw
  tmpCanvas.height = vh
  const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true })
  tmpCtx.drawImage(videoPreview, 0, 0, vw, vh)

  const wmFs = Math.max(30, vw * 0.022)
  const padding = 15
  tmpCtx.font = `bold ${wmFs}px sans-serif`
  const wmWidth = tmpCtx.measureText(wmText).width + 20
  const wmHeight = wmFs + 10
  const sampleX = vw - padding - wmWidth
  const sampleY = vh - padding - wmHeight

  return analyzeAreaColor(tmpCtx, sampleX, sampleY, wmWidth, wmHeight)
}

// 更新预览字幕样式
async function updatePreviewText () {
  const containerW = videoContainer.offsetWidth || 640
  const fs = Math.max(10, (parseInt(fontSizeInput.value) * containerW) / 900)
  const color = fontColorInput.value
  const bgColor = document.getElementById('highlightBg').value
  const bgScale = parseFloat(document.getElementById('bgScale').value) || 1.1
  const fontValue = fontFamilySelect.value
  const fontFamily = fontValue + ', sans-serif'
  const fontName = fontValue.replace(/'/g, '').trim()

  // 算背景高亮的垂直内边距
  const bgPaddingV = (fs * bgScale - fs) / 2

  try {
    // 异步加载字体，防止预览时字体没渲染出来
    await document.fonts.load(`bold ${Math.round(fs)}px "${fontName}"`)
  } catch {}

  // 设置预览容器样式
  previewText.style.fontFamily = fontFamily
  previewText.style.fontWeight = 'bold'
  previewText.style.fontSize = fs + 'px'
  previewText.style.color = color
  previewText.style.textShadow = '0 1px 4px rgba(0,0,0,0.6)'
  previewText.style.lineHeight = '1'
  previewText.style.display = 'flex'
  previewText.style.alignItems = 'center'
  previewText.style.flexWrap = 'wrap'
  previewText.style.justifyContent = 'center'
  previewText.style.gap = '2px'

  previewText.style.background = 'rgba(0, 0, 0, 0.5)' // 半透明黑
  previewText.style.borderRadius = '8px'
  previewText.style.padding = '8px 12px'

  // 模拟一段包含高亮词的文本
  const words = [
    { text: 'Adjust the ', highlight: false },
    { text: 'text', highlight: true },
    { text: 'area', highlight: true },
    { text: 'here', highlight: false }
  ]

  previewText.innerHTML = ''
  words.forEach(w => {
    const span = document.createElement('span')
    span.textContent = w.text
    span.style.display = 'inline-block'
    span.style.color = color
    span.style.fontFamily = fontFamily
    span.style.fontWeight = 'bold'
    span.style.fontSize = fs + 'px'
    span.style.textShadow = '0 1px 4px rgba(0,0,0,0.6)'
    span.style.lineHeight = '1'
    span.style.padding = `${bgPaddingV}px 6px`

    // 如果是高亮词，应用背景色和圆角
    if (w.highlight) {
      span.style.background = bgColor
      span.style.borderRadius = '5px'
    }

    previewText.appendChild(span)
  })

  // 更新水印预览
  // 更新水印预览（智能选色）
  let wmEl = document.getElementById('watermarkPreview')
  if (!wmEl) {
    wmEl = document.createElement('div')
    wmEl.id = 'watermarkPreview'
    wmEl.style.position = 'absolute'
    wmEl.style.bottom = '14px'
    wmEl.style.right = '15px'
    wmEl.style.pointerEvents = 'none'
    wmEl.style.fontWeight = 'bold'
    wmEl.style.zIndex = '999'
    wmEl.style.transition = 'color 0.3s'
    videoContainer.appendChild(wmEl)
  }
  const wmText = watermarkInput ? watermarkInput.value.trim() : ''
  wmEl.textContent = wmText
  const wmFs = Math.max(14, videoContainer.offsetWidth * 0.022)
  wmEl.style.fontSize = wmFs + 'px'
  wmEl.style.textShadow = '1px 1px 3px rgba(0,0,0,0.5)'
  wmEl.style.opacity = '0.65'
  // 采样当前帧颜色
  wmEl.style.color = sampleWatermarkColor()
}

// 监听设置更改
fontSizeInput.addEventListener('input', () => saveSettings())
fontColorInput.addEventListener('input', () => saveSettings())
fontFamilySelect.addEventListener('change', () => saveSettings())
document.getElementById('highlightBg').addEventListener('input', () => saveSettings())
document.getElementById('bgScale').addEventListener('input', () => saveSettings())
watermarkInput.addEventListener('input', () => saveSettings())

// 读取视频文件
videoInput.onchange = e => {
  const file = e.target.files[0]
  if (!file) return
  videoPreview.src = URL.createObjectURL(file)
  videoPreview.muted = true
  videoContainer.style.display = 'block'
  previewPlaceholder.style.display = 'none'
  videoPreview.onloadedmetadata = () => updatePreviewText()
  videoPreview.onloadeddata = () => {
    // 延迟一帧，确保视频画面真正渲染到页面后再采样
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const wmEl = document.getElementById('watermarkPreview')
        if (wmEl && wmEl.textContent) {
          wmEl.style.color = sampleWatermarkColor()
        }
      })
    })
  }
}

// 字幕层拖拽事件
textOverlay.addEventListener('mousedown', e => {
  if (e.target.id === 'resizeHandle') return
  dragging = true
  startX = e.clientX
  startY = e.clientY
  const rect = textOverlay.getBoundingClientRect()
  const cont = videoContainer.getBoundingClientRect()
  initLeft = rect.left - cont.left
  initTop = rect.top - cont.top
})

// 缩放手柄按下鼠标
document.getElementById('resizeHandle').addEventListener('mousedown', e => {
  resizing = true
  startX = e.clientX
  startY = e.clientY
  initWidth = textOverlay.offsetWidth
  initHeight = textOverlay.offsetHeight
  e.stopPropagation()
  e.preventDefault()
})

// 全局监听鼠标移动
document.addEventListener('mousemove', e => {
  const cont = videoContainer.getBoundingClientRect()
  if (dragging) {
    // 计算位移并转换为百分比
    overlaySettings.left = Math.max(0, ((initLeft + e.clientX - startX) / cont.width) * 100)
    overlaySettings.top = Math.max(0, ((initTop + e.clientY - startY) / cont.height) * 100)
    textOverlay.style.left = overlaySettings.left + '%'
    textOverlay.style.top = overlaySettings.top + '%'
  } else if (resizing) {
    // 计算宽高并转换为百分比
    overlaySettings.width = Math.max(10, ((initWidth + e.clientX - startX) / cont.width) * 100)
    overlaySettings.height = Math.max(5, ((initHeight + e.clientY - startY) / cont.height) * 100)
    textOverlay.style.width = overlaySettings.width + '%'
    textOverlay.style.height = overlaySettings.height + '%'
  }
})

// 释放鼠标时停止所有交互
document.addEventListener('mouseup', () => {
  dragging = resizing = false
})

// 文件转换 base64
const toBase64 = file =>
  new Promise(resolve => {
    const r = new FileReader()
    r.onload = ev => resolve(ev.target.result)
    r.readAsDataURL(file)
  })

// 导出视频
exportBtn.addEventListener('click', async () => {
  if (!videoInput.files[0]) return notify('请先选择视频')
  if (!subtitle) return notify('请输入字幕内容')
  if (!voicePack.value) return notify('未登录 Elevenlabs')
  const opalToken = await getOpalToken()
  if (!opalToken) return notify('未登陆 opal')

  const videoData = await toBase64(videoInput.files[0])

  notify('正在获取音频')
  const audioBlob = await textToSpeech(subtitle.value, voicePack.value)
  notify('获取音频完成')

  notify('正在转换字幕')
  subtitleData = await audioToSubtitle(audioBlob, opalToken)
  notify('转换字幕完成')

  const audioData = await toBase64(audioBlob)

  // UI 状态切换
  exportBtn.disabled = true
  progressContainer.style.display = 'block'
  progressFill.style.width = '0%'
  progressPct.textContent = '0%'
  // 滚动到进度条位置
  progressContainer.scrollIntoView({ behavior: 'smooth', block: 'center' })

  notify('开始渲染视频')
  // 发送到后台渲染
  chrome.runtime.sendMessage({
    type: 'start-export',
    payload: {
      videoData,
      audioData,
      subtitleData,
      overlaySettings,
      fontSize: parseInt(fontSizeInput.value),
      highlightBg: document.getElementById('highlightBg').value,
      fontColor: fontColorInput.value,
      fontFamily: fontFamilySelect.value,
      bgScale: parseFloat(document.getElementById('bgScale').value),
      lineHeightMult: parseFloat(document.getElementById('lineHeightMult').value),
      pingPong: document.getElementById('pingPongToggle').checked,
      watermarkText: watermarkInput ? watermarkInput.value.trim() : ''
    }
  })
})

// 监听进度回传
chrome.runtime.onMessage.addListener(msg => {
  // 更新进度条
  if (msg.type === 'progress-update') {
    const pct = Math.round(msg.progress * 100) + '%'
    progressFill.style.width = pct
    progressPct.textContent = pct
  }

  // 渲染完成处理
  if (msg.type === 'export-finished') {
    notify('视频渲染完成')
    exportBtn.disabled = false
    progressPct.textContent = '100%'
    progressFill.style.width = '100%'
    document.getElementById('statusHint').textContent = '✅ 导出完成！'
    setTimeout(() => {
      progressContainer.style.display = 'none'
      document.getElementById('statusHint').textContent = '导出完成后将自动弹出保存对话框'
    }, 3000)
  }
})

// 初始化预览
updatePreviewText()

async function getOpalToken () {
  const token = await fetch('https://opal.google/connection/refresh/')
    .then(response => response.json())
    .then(json => json.access_token)
  return token
}

async function audioToSubtitle (blob, token) {
  const audioBase64 = await toBase64(blob).then(result => result.split(',')[1])

  const param = {
    contents: [
      {
        parts: [
          {
            text: '\n '
          },
          {
            inlineData: {
              data: audioBase64,
              mimeType: blob.type
            }
          }
        ],
        role: 'user'
      }
    ],
    safetySettings: [
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE'
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE'
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: '请你分析音频，然后JSON 格式的文件。每一行（句子）包含它自己的开始和结束时间，以及一个 words 数组，标记每个单词的具体出现时刻。\nAnalyze the attached image carefully and return **ONLY valid JSON**\n```json\n[\n  {\n    "start": 0.5,\n    "end": 3.2,\n    "text": "Napakapalad mo talaga",\n    "words": [\n      { "text": "Napakapalad", "start": 0.5, "end": 1.2 },\n      { "text": "mo", "start": 1.3, "end": 1.8 },\n      { "text": "talaga", "start": 1.9, "end": 3.2 }\n    ]\n  },\n  {\n    "start": 3.5,\n    "end": 6.0,\n    "text": "Maraming tao ang nagskip",\n    "words": [\n      { "text": "Maraming", "start": 3.5, "end": 4.1 },\n      { "text": "tao", "start": 4.2, "end": 4.5 },\n      { "text": "ang", "start": 4.6, "end": 4.8 },\n      { "text": "nagskip", "start": 4.9, "end": 6.0 }\n    ]\n  }\n]\n```'
        }
      ],
      role: 'user'
    }
  }
  const json = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
    headers: {
      authorization: 'Bearer ' + token
    },
    body: JSON.stringify(param),
    method: 'POST',
    credentials: 'include'
  }).then(response => response.json())
  const formatJson = JSON.parse(json.candidates[0].content.parts[0].text.replace(/^```json|```$/g, ''))
  return formatJson
}

// 获取 elevenlabs 账号访问令牌
async function getToken () {
  return await new Promise(resolve => {
    chrome.storage.local.get(null, data => resolve(data))
  }).then(result => result.token)
}

// 获取语音包列表
async function getVoicePackList () {
  const json = await fetch('https://api.us.elevenlabs.io/v2/voices?page_size=100&sort=name&sort_direction=asc', {
    headers: {
      accept: '*/*',
      authorization: 'Bearer ' + (await getToken()),
      'content-type': 'application/json'
    },
    method: 'GET',
    credentials: 'include'
  }).then(response => response.json())
  if (json?.detail?.status === 'invalid_authorization_header') {
    return notify('未登录 Elevenlabs')
  }
  // 写入下拉菜单
  json.voices.map(x => voicePack.add(new Option(x.name, x.voice_id)))
}

/**
 * @description 文本转语音
 * @param {string} text - 文本内容
 * @param {string} voiceId - 语音包 ID
 * @returns {Promise<Blob>} 返回生成的音频 Blob
 */
async function textToSpeech (text, voiceId) {
  const param = {
    text,
    model_id: 'eleven_flash_v2_5'
  }
  const blob = await fetch(`https://api.us.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
    headers: {
      accept: '*/*',
      authorization: 'Bearer ' + (await getToken()),
      'content-type': 'application/json'
    },
    body: JSON.stringify(param),
    method: 'POST',
    credentials: 'include'
  }).then(response => response.blob())
  return blob
}

// 保存配置
function saveSettings () {
  chrome.storage.local.set({
    fontSize: fontSizeInput.value,
    fontColor: fontColorInput.value,
    fontFamily: fontFamilySelect.value,
    highlightBg: document.getElementById('highlightBg').value,
    bgScale: document.getElementById('bgScale').value,
    lineHeightMult: document.getElementById('lineHeightMult').value,
    pingPong: document.getElementById('pingPongToggle').checked,
    watermarkText: watermarkInput.value
  })
  updatePreviewText()
}

// 加载配置
function loadSettings () {
  chrome.storage.local.get(null, config => {
    if (config.fontSize) fontSizeInput.value = config.fontSize
    if (config.fontColor) fontColorInput.value = config.fontColor
    if (config.fontFamily) fontFamilySelect.value = config.fontFamily
    if (config.highlightBg) document.getElementById('highlightBg').value = config.highlightBg
    if (config.bgScale) document.getElementById('bgScale').value = config.bgScale
    if (config.lineHeightMult) document.getElementById('lineHeightMult').value = config.lineHeightMult
    if (config.pingPong !== undefined) document.getElementById('pingPongToggle').checked = config.pingPong
    if (config.watermarkText) watermarkInput.value = config.watermarkText
    // 读取完后刷新预览
    updatePreviewText()
  })
}

// 初始化
getVoicePackList()
loadSettings()
