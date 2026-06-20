/**
 * 装修管家 · UI 音效系统
 * 使用 Web Audio API 合成轻量音效，无需外部音频文件
 * iOS Safari 完全支持
 */

let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // 恢复被浏览器暂停的 AudioContext（iOS 要求用户交互后才能播放）
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/** 播放一个简单的音调 */
function playTone(freq, duration = 0.08, type = 'sine', volume = 0.12) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (e) {
    // AudioContext 可能未初始化，静默失败
  }
}

/** 播放和弦（多个频率同时） */
function playChord(freqs, duration = 0.15, volume = 0.08) {
  freqs.forEach((f, i) => {
    setTimeout(() => playTone(f, duration, 'sine', volume), i * 15)
  })
}

// ═══════════════ 语义音效 ═══════════════

/** 点击/轻触 */
export function playClick() {
  playTone(1200, 0.05, 'sine', 0.08)
}

/** 按钮按下 */
export function playTap() {
  playChord([800, 1000], 0.06, 0.06)
}

/** 操作成功 */
export function playSuccess() {
  playChord([523, 659, 784], 0.18, 0.1)
}

/** 操作失败/错误 */
export function playError() {
  playChord([200, 180], 0.25, 0.08)
}

/** 开关切换 */
export function playToggle() {
  playChord([600, 900], 0.08, 0.07)
}

/** 删除/回退 */
export function playDelete() {
  playTone(150, 0.12, 'triangle', 0.1)
}

/** 保存/确认 */
export function playSave() {
  playChord([440, 554, 660], 0.2, 0.08)
}

/** 下拉选择 */
export function playSelect() {
  playTone(900, 0.04, 'sine', 0.06)
}

/** 轻量触觉模拟 — 短暂的身体反馈（纯视觉） */
export function playHaptic(el) {
  if (!el) return
  el.style.transition = 'transform 0.08s ease'
  el.style.transform = 'scale(0.97)'
  setTimeout(() => {
    el.style.transform = 'scale(1.0)'
  }, 80)
}
