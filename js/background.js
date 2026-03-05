// 点击插件图标打开独立页面
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('/html/page.html')
  })
})

let offscreenCreated = false

async function ensureOffscreen () {
  if (offscreenCreated) return
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('/html/offscreen.html'),
      reasons: ['BLOBS'],
      justification: 'Canvas rendering and MediaRecorder video encoding'
    })
    offscreenCreated = true
    console.log('offscreen 创建成功')
  } catch (error) {
    console.error('offscreen 创建失败:', error)
  }
}

chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
  const action = message.action
  if (action === 'token') {
    // 储存 token
    sendResponse(chrome.storage.local.set({ token: message.token }))
  } else if (action === 'mark') {
    // 显示徽标
    sendResponse(chrome.action.setBadgeText({ text: message.text }))
  }
  return true
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'start-export') {
    console.log(msg.payload)
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: 'do-export', payload: msg.payload })
    })
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'export-progress') {
    chrome.runtime.sendMessage({ type: 'progress-update', progress: msg.progress })
  }

  if (msg.type === 'export-done') {
    chrome.downloads.download({
      url: msg.blobUrl,
      filename: `video_${Date.now()}.webm`,
      saveAs: false
    })
    offscreenCreated = false
    chrome.offscreen.closeDocument?.()
    chrome.runtime.sendMessage({ type: 'export-finished' })
  }
})
