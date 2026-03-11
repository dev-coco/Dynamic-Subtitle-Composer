// 字幕数据
let subtitleData = []

// 存储每个视频的字幕区域位置和大小
const perVideoOverlaySettings = {}

// 存储每个视频独立的样式参数
const perVideoStyleSettings = {}

// 当前正在预览/编辑的视频索引
let currentEditingVideoIndex = 0

// 存储字幕区域的相对位置和大小
let overlaySettings = {
  left: 10,
  top: 35,
  width: 80,
  height: 30
}

// 标记是否正在拖拽
let dragging = false
// 标记是否正在拖拽
let resizing = false
// 记录鼠标事件坐标
let startX, startY, initLeft, initTop, initWidth, initHeight

// 存储多个视频文件
let videoFiles = []

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
const watermarkPositionSelect = document.getElementById('watermarkPosition')
const progressBatchLabel = document.getElementById('progressBatchLabel')

// 读取当前所有配置
function readStyleFromUI () {
  return {
    fontSize: fontSizeInput.value,
    fontColor: fontColorInput.value,
    fontFamily: fontFamilySelect.value,
    highlightBg: document.getElementById('highlightBg').value,
    bgScale: document.getElementById('bgScale').value,
    lineHeightMult: document.getElementById('lineHeightMult').value,
    pingPong: document.getElementById('pingPongToggle').checked,
    watermarkText: watermarkInput.value,
    watermarkPosition: watermarkPositionSelect.value
  }
}

/**
 * @description 将配置应用到当前视频
 * @param {Object} style - 样式配置对象
 * @param {number} [style.fontSize] - 字体大小
 * @param {string} [style.fontColor] - 字体颜色
 * @param {string} [style.fontFamily] - 字体类型
 * @param {string} [style.highlightBg] - 高亮背景颜色
 * @param {number} [style.bgScale] - 背景缩放比例
 * @param {number} [style.lineHeightMult] - 行高倍数
 * @param {boolean} [style.pingPong] - 是否启用往返滚动效果
 * @param {string} [style.watermarkText] - 水印文本内容
 * @param {string} [style.watermarkPosition] - 水印显示位置
 */
function applyStyleToUI (style) {
  if (!style) return
  if (style.fontSize !== undefined) fontSizeInput.value = style.fontSize
  if (style.fontColor !== undefined) fontColorInput.value = style.fontColor
  if (style.fontFamily !== undefined) fontFamilySelect.value = style.fontFamily
  if (style.highlightBg !== undefined) document.getElementById('highlightBg').value = style.highlightBg
  if (style.bgScale !== undefined) document.getElementById('bgScale').value = style.bgScale
  if (style.lineHeightMult !== undefined) document.getElementById('lineHeightMult').value = style.lineHeightMult
  if (style.pingPong !== undefined) document.getElementById('pingPongToggle').checked = style.pingPong
  if (style.watermarkText !== undefined) watermarkInput.value = style.watermarkText
  if (style.watermarkPosition !== undefined) watermarkPositionSelect.value = style.watermarkPosition
}

// 默认样式配置
function getDefaultStyle () {
  return {
    fontSize: '60',
    fontColor: '#ffffff',
    fontFamily: 'Arial',
    highlightBg: '#f03737',
    bgScale: '1.2',
    lineHeightMult: '1.5',
    pingPong: true,
    watermarkText: 'Attribution to Elevenlabs.io',
    watermarkPosition: 'bottom-right'
  }
}

// 保存当前视频的配置
function syncStyleToCurrentVideo () {
  perVideoStyleSettings[currentEditingVideoIndex] = readStyleFromUI()
}

/**
 * @description 获取对应视频的配置
 * @param {number} index - 视频在列表中的索引
 * @returns {Object} 当前视频对应的样式对象
 */
function getStyleForVideo (index) {
  return perVideoStyleSettings[index] || { ...getDefaultStyle() }
}

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

/**
 * @description 分析区域颜色并返回合适的水印颜色
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 绘图上下文
 * @param {number} x - 分析区域左上角的 X 坐标
 * @param {number} y - 分析区域左上角的 Y 坐标
 * @param {number} width - 分析区域宽度
 * @param {number} height - 分析区域高度
 * @returns {string} 根据背景颜色计算得到的适合显示水印的 RGB 颜色字符串
 */
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
    const [r, g, b] = hslToRgb(h, 0.8, 0.1)
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
  } else {
    // 如果背景偏暗，使用亮色水印
    // 保持色相，降低饱和度，大幅提高亮度
    const [r, g, b] = hslToRgb(h, 0.2, 0.9)
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
  }
}

/**
 * @description 将 RGB 转换为 HSL
 * @param {number} r - 红色通道值，范围 0 到 255
 * @param {number} g - 绿色通道值，范围 0 到 255
 * @param {number} b - 蓝色通道值，范围 0 到 255
 * @returns {number[]} 返回 HSL 数组，包含色相 h、饱和度 s、亮度 l，范围均为 0 到 1
 */
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

/**
 * @description 将 HSL 转换为 RGB
 * @param {number} h - 色相值，范围 0 到 1
 * @param {number} s - 饱和度值，范围 0 到 1
 * @param {number} l - 亮度值，范围 0 到 1
 * @returns {number[]} 返回 RGB 数组，包含 r、g、b 三个通道值，范围 0 到 255
 */
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
  // 获取水印文本
  const wmText = watermarkInput ? watermarkInput.value.trim() : ''

  // 没有水印文本时，默认返回白色
  if (!wmText || videoPreview.readyState < 2) return '#ffffff'

  const tmpCanvas = document.createElement('canvas')

  // 获取视频尺寸
  const vw = videoPreview.videoWidth || videoContainer.offsetWidth
  const vh = videoPreview.videoHeight || videoContainer.offsetHeight

  tmpCanvas.width = vw
  tmpCanvas.height = vh

  const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true })

  // 预览视频
  tmpCtx.drawImage(videoPreview, 0, 0, vw, vh)

  // 水印字体大小
  const wmFs = Math.max(30, vw * 0.022)
  // 水印内边距
  const padding = 15
  // 水印字体
  tmpCtx.font = `bold ${wmFs}px sans-serif`
  // 水印宽度 + 外边距
  const wmWidth = tmpCtx.measureText(wmText).width + 20
  // 水印字体高度
  const wmHeight = wmFs + 10

  // 水印默认放右下角
  const wmPos = watermarkPositionSelect ? watermarkPositionSelect.value : 'bottom-right'

  let sampleX, sampleY
  if (wmPos === 'bottom-right') {
    // 右下角
    sampleX = vw - padding - wmWidth
    sampleY = vh - padding - wmHeight
  } else if (wmPos === 'bottom-left') {
    // 左下角
    sampleX = padding
    sampleY = vh - padding - wmHeight
  } else if (wmPos === 'top-right') {
    // 右上角
    sampleX = vw - padding - wmWidth
    sampleY = padding
  } else {
    // 左上角
    sampleX = padding
    sampleY = padding
  }

  // 分析区域颜色，自适应颜色
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
  previewText.style.background = 'rgba(0, 0, 0, 0.5)'
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

  // 更新水印预览（智能选色）
  let wmEl = document.getElementById('watermarkPreview')
  if (!wmEl) {
    wmEl = document.createElement('div')
    wmEl.id = 'watermarkPreview'
    wmEl.style.position = 'absolute'
    wmEl.style.pointerEvents = 'none'
    wmEl.style.fontWeight = 'bold'
    wmEl.style.zIndex = '999'
    wmEl.style.transition = 'color 0.3s'
    videoContainer.appendChild(wmEl)
  }

  // 根据水印位置设置四角定位
  const wmPos = watermarkPositionSelect ? watermarkPositionSelect.value : 'bottom-right'
  wmEl.style.top = ''
  wmEl.style.bottom = ''
  wmEl.style.left = ''
  wmEl.style.right = ''
  if (wmPos === 'bottom-right') {
    wmEl.style.bottom = '14px'
    wmEl.style.right = '15px'
  } else if (wmPos === 'bottom-left') {
    wmEl.style.bottom = '14px'
    wmEl.style.left = '15px'
  } else if (wmPos === 'top-right') {
    wmEl.style.top = '14px'
    wmEl.style.right = '15px'
  } else if (wmPos === 'top-left') {
    wmEl.style.top = '14px'
    wmEl.style.left = '15px'
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

// 任一样式控件变化时，保存到当前视频并刷新预览
function onStyleChange () {
  syncStyleToCurrentVideo()
  updatePreviewText()
  saveSettings()
}

// 监听设置更改
fontSizeInput.addEventListener('input', onStyleChange)
fontColorInput.addEventListener('input', onStyleChange)
fontFamilySelect.addEventListener('change', onStyleChange)
document.getElementById('highlightBg').addEventListener('input', onStyleChange)
document.getElementById('bgScale').addEventListener('input', onStyleChange)
document.getElementById('lineHeightMult').addEventListener('input', onStyleChange)
document.getElementById('pingPongToggle').addEventListener('change', onStyleChange)
watermarkInput.addEventListener('input', onStyleChange)
watermarkPositionSelect.addEventListener('change', onStyleChange)

function syncOverlayToCurrentVideo () {
  perVideoOverlaySettings[currentEditingVideoIndex] = { ...overlaySettings }
}

function getOverlayForVideo (idx) {
  return perVideoOverlaySettings[idx] || { left: 10, top: 35, width: 80, height: 30 }
}

function switchPreviewVideo (idx) {
  if (!videoFiles[idx]) return

  // 保存当前视频的 overlay 和样式配置
  syncOverlayToCurrentVideo()
  syncStyleToCurrentVideo()

  currentEditingVideoIndex = idx

  // 加载对应视频
  videoPreview.src = URL.createObjectURL(videoFiles[idx])
  videoPreview.muted = true
  videoContainer.style.display = 'block'
  previewPlaceholder.style.display = 'none'

  // 恢复该视频的 overlay 配置
  const savedOverlay = getOverlayForVideo(idx)
  overlaySettings = { ...savedOverlay }
  textOverlay.style.left = overlaySettings.left + '%'
  textOverlay.style.top = overlaySettings.top + '%'
  textOverlay.style.width = overlaySettings.width + '%'
  textOverlay.style.height = overlaySettings.height + '%'

  // 恢复该视频的样式配置
  applyStyleToUI(getStyleForVideo(idx))

  // 高亮当前选中的视频标签
  document.querySelectorAll('.video-tab').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx)
  })

  videoPreview.onloadedmetadata = () => updatePreviewText()
  videoPreview.onloadeddata = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const wmEl = document.getElementById('watermarkPreview')
        if (wmEl && wmEl.textContent) wmEl.style.color = sampleWatermarkColor()
      })
    })
  }
}

function renderVideoTabs () {
  const tabContainer = document.getElementById('videoTabContainer')
  if (!tabContainer) return

  tabContainer.innerHTML = ''

  if (videoFiles.length <= 1) {
    tabContainer.style.display = 'none'
    return
  }

  tabContainer.style.display = 'flex'

  videoFiles.forEach((file, idx) => {
    const btn = document.createElement('button')
    btn.className = 'video-tab' + (idx === currentEditingVideoIndex ? ' active' : '')
    btn.textContent = `视频 ${idx + 1}: ${file.name.length > 12 ? file.name.slice(0, 12) + '…' : file.name}`
    btn.title = `点击切换预览并设置字幕位置\n${file.name}`
    btn.addEventListener('click', () => switchPreviewVideo(idx))
    tabContainer.appendChild(btn)
  })
}

// 读取视频文件
videoInput.onchange = e => {
  const files = Array.from(e.target.files)
  if (!files.length) return

  videoFiles = files

  // 为每个视频初始化默认配置（overlay + 样式）
  files.forEach((_, idx) => {
    if (!perVideoOverlaySettings[idx]) {
      perVideoOverlaySettings[idx] = { left: 10, top: 35, width: 80, height: 30 }
    }
    if (!perVideoStyleSettings[idx]) {
      // 新视频继承当前面板的设置，方便批量使用同一套样式
      perVideoStyleSettings[idx] = readStyleFromUI()
    }
  })

  // 默认预览第一个
  currentEditingVideoIndex = 0
  overlaySettings = { ...getOverlayForVideo(0) }
  textOverlay.style.left = overlaySettings.left + '%'
  textOverlay.style.top = overlaySettings.top + '%'
  textOverlay.style.width = overlaySettings.width + '%'
  textOverlay.style.height = overlaySettings.height + '%'

  applyStyleToUI(getStyleForVideo(0))

  videoPreview.src = URL.createObjectURL(files[0])
  videoPreview.muted = true
  videoContainer.style.display = 'block'
  previewPlaceholder.style.display = 'none'
  videoPreview.onloadedmetadata = () => updatePreviewText()
  videoPreview.onloadeddata = () => {
    // 延迟一帧，确保视频画面真正渲染到页面后再采样
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const wmEl = document.getElementById('watermarkPreview')
        if (wmEl && wmEl.textContent) wmEl.style.color = sampleWatermarkColor()
      })
    })
  }

  renderVideoTabs()
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
    syncOverlayToCurrentVideo()
  } else if (resizing) {
    // 计算宽高并转换为百分比
    overlaySettings.width = Math.max(10, ((initWidth + e.clientX - startX) / cont.width) * 100)
    overlaySettings.height = Math.max(5, ((initHeight + e.clientY - startY) / cont.height) * 100)
    textOverlay.style.width = overlaySettings.width + '%'
    textOverlay.style.height = overlaySettings.height + '%'
    syncOverlayToCurrentVideo()
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

function setProgress (pct) {
  pct = Math.min(100, Math.max(0, Math.round(pct)))
  progressFill.style.width = pct + '%'
  progressPct.textContent = pct + '%'
}

// 导出视频
exportBtn.addEventListener('click', async () => {
  if (!videoFiles.length) return notify('请先选择视频')
  if (!subtitle || !subtitle.value.trim()) return notify('请输入字幕内容')
  if (!voicePack.value) return notify('未登录 Elevenlabs')

  const opalToken = await getOpalToken()
  if (!opalToken) return notify('未登陆 opal')

  // 保存当前视频的 overlay 和样式
  syncOverlayToCurrentVideo()
  syncStyleToCurrentVideo()

  const textLines = subtitle.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
  if (!textLines.length) return notify('请输入字幕内容')

  const totalTasks = textLines.length
  const videoCount = videoFiles.length

  // UI 状态切换
  exportBtn.disabled = true
  progressContainer.style.display = 'block'
  setProgress(0)
  if (progressBatchLabel) progressBatchLabel.textContent = `0/${totalTasks}`

  // 滚动到进度条位置
  progressContainer.scrollIntoView({ behavior: 'smooth', block: 'center' })

  notify(`开始批量渲染，共 ${totalTasks} 个视频`)

  const tasks = []
  for (let i = 0; i < textLines.length; i++) {
    const videoIdx = i % videoCount
    const videoFile = videoFiles[videoIdx]
    const textContent = textLines[i]
    const overlay = getOverlayForVideo(videoIdx)
    // 每个任务使用对应视频的独立样式配置
    const style = getStyleForVideo(videoIdx)

    tasks.push({ videoFile, textContent, overlay, style, videoIdx, taskIndex: i })
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (progressBatchLabel) progressBatchLabel.textContent = `${i + 1}/${totalTasks}`

    notify(`处理第 ${i + 1}/${totalTasks} 个：${task.textContent.slice(0, 20)}...`)

    // ── 阶段一：获取音频（0% → 10%）───────────────────────────
    setProgress(0)
    const videoData = await toBase64(task.videoFile)

    notify('正在获取音频')
    const audioBlob = await textToSpeech(task.textContent, voicePack.value)
    notify('获取音频完成')
    setProgress(10)

    // ── 阶段二：获取字幕（10% → 20%）──────────────────────────
    notify('正在转换字幕')
    subtitleData = await audioToSubtitle(audioBlob, opalToken)
    notify('转换字幕完成')
    setProgress(20)

    const audioData = await toBase64(audioBlob)

    notify(`开始渲染第 ${i + 1}/${totalTasks} 个视频`)

    // ── 阶段三：渲染（20% → 100%）─────────────────────────────
    await new Promise(resolve => {
      window._batchTaskResolve = resolve

      // 发送到后台渲染
      chrome.runtime.sendMessage({
        type: 'start-export',
        payload: {
          videoData,
          audioData,
          subtitleData,
          overlaySettings: task.overlay,
          // 使用该视频独立的样式配置
          fontSize: parseInt(task.style.fontSize),
          highlightBg: task.style.highlightBg,
          fontColor: task.style.fontColor,
          fontFamily: task.style.fontFamily,
          bgScale: parseFloat(task.style.bgScale),
          lineHeightMult: parseFloat(task.style.lineHeightMult),
          pingPong: task.style.pingPong,
          watermarkText: task.style.watermarkText,
          watermarkPosition: task.style.watermarkPosition,
          batchIndex: i,
          batchTotal: totalTasks
        }
      })
    })
  }

  exportBtn.disabled = false
  setProgress(100)
  if (progressBatchLabel) progressBatchLabel.textContent = `${totalTasks}/${totalTasks}`
  document.getElementById('statusHint').textContent = `全部 ${totalTasks} 个视频导出完成！`
  setTimeout(() => {
    progressContainer.style.display = 'none'
    document.getElementById('statusHint').textContent = '导出完成后将自动弹出保存对话框'
  }, 4000)
})

// 监听进度回传
chrome.runtime.onMessage.addListener(msg => {
  // 更新进度条
  if (msg.type === 'progress-update') {
    const renderPct = 20 + Math.round(msg.progress * 80)
    setProgress(renderPct)
  }

  // 渲染完成处理
  if (msg.type === 'export-finished') {
    notify('视频渲染完成')
    setProgress(100)
    if (typeof window._batchTaskResolve === 'function') {
      const resolve = window._batchTaskResolve
      window._batchTaskResolve = null
      resolve()
    }
  }
})

// 初始化预览
updatePreviewText()

// 获取 opal 访问令牌
async function getOpalToken () {
  const token = await fetch('https://opal.google/connection/refresh/')
    .then(response => response.json())
    .then(json => json.access_token)
  return token
}

/**
 * @description 音频转文字
 * @param {Blob} blob - 音频数据
 * @param {string} token - opal 访问令牌
 * @returns {Promise<Object[]>} 返回字幕数组
 */
async function audioToSubtitle (blob, token) {
  const audioBase64 = await toBase64(blob).then(result => result.split(',')[1])

  const param = {
    contents: [
      {
        parts: [{ text: '\n ' }, { inlineData: { data: audioBase64, mimeType: blob.type } }],
        role: 'user'
      }
    ],
    safetySettings: [
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ],
    systemInstruction: {
      parts: [
        {
          text: '请你分析音频，然后JSON 格式的文件。每一行（句子）包含它自己的开始和结束时间，以及一个 words 数组，句子不能太长，最多不能超过60字符，标记每个单词的具体出现时刻。\nAnalyze the attached image carefully and return **ONLY valid JSON**\n```json\n[\n  {\n    "start": 0.5,\n    "end": 3.2,\n    "text": "Napakapalad mo talaga",\n    "words": [\n      { "text": "Napakapalad", "start": 0.5, "end": 1.2 },\n      { "text": "mo", "start": 1.3, "end": 1.8 },\n      { "text": "talaga", "start": 1.9, "end": 3.2 }\n    ]\n  },\n  {\n    "start": 3.5,\n    "end": 6.0,\n    "text": "Maraming tao ang nagskip",\n    "words": [\n      { "text": "Maraming", "start": 3.5, "end": 4.1 },\n      { "text": "tao", "start": 4.2, "end": 4.5 },\n      { "text": "ang", "start": 4.6, "end": 4.8 },\n      { "text": "nagskip", "start": 4.9, "end": 6.0 }\n    ]\n  }\n]\n```'
        }
      ],
      role: 'user'
    }
  }

  const json = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
    headers: { authorization: 'Bearer ' + token },
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
  const param = { text, model_id: 'eleven_flash_v2_5' }
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
  chrome.storage.local.set(readStyleFromUI())
  // updatePreviewText()
}

// 加载配置
function loadSettings () {
  chrome.storage.local.get(null, config => {
    const defaults = getDefaultStyle()
    const merged = { ...defaults, ...config }
    applyStyleToUI(merged)
    // 读取完后刷新预览
    updatePreviewText()
  })
}

// 初始化
getVoicePackList()
loadSettings()
