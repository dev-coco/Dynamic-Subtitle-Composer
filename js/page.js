// 字幕数据
let subtitleData = []

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
}

// 监听设置更改
fontSizeInput.addEventListener('input', () => updatePreviewText())
fontColorInput.addEventListener('input', () => updatePreviewText())
fontFamilySelect.addEventListener('change', () => updatePreviewText())
document.getElementById('highlightBg').addEventListener('input', () => updatePreviewText())
document.getElementById('bgScale').addEventListener('input', () => updatePreviewText())

// 读取视频文件
videoInput.onchange = e => {
  const file = e.target.files[0]
  if (!file) return
  videoPreview.src = URL.createObjectURL(file)
  videoContainer.style.display = 'block'
  previewPlaceholder.style.display = 'none'
  videoPreview.onloadedmetadata = () => updatePreviewText()
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

// 缩放手柄按下鼠标：
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
  console.log(subtitleData)
  notify('转换字幕完成')

  const audioData = await toBase64(audioBlob)

  // UI 状态切换
  exportBtn.disabled = true
  progressContainer.style.display = 'block'
  progressFill.style.width = '0%'
  progressPct.textContent = '0%'
  document.getElementById('statusHint').textContent = '正在渲染，可以切换标签页 ☕'

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
      pingPong: document.getElementById('pingPongToggle').checked
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

getVoicePackList()

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
