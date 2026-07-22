import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { loadState, makeId, saveState, validateImportedState } from './storage'
import { Speaker, type SpeechStatus } from './speech'
import type { AppState, CueLine, Script } from './types'

registerSW({ immediate: true })

let state = loadState()
let currentLineIndex = 0
let mode: 'rehearsal' | 'stage' = 'rehearsal'
let isLocked = state.settings.stageLockOnEntry
let playbackStatus: SpeechStatus = 'stopped'
const speaker = new Speaker()
const app = document.querySelector<HTMLDivElement>('#app')!
const live = document.querySelector<HTMLDivElement>('#live-status')!

speaker.onStatusChange = (status, message) => {
  playbackStatus = status
  announce(message)
  render()
}

function announce(message: string): void {
  live.textContent = ''
  window.setTimeout(() => { live.textContent = message }, 20)
}

function selectedScript(): Script | undefined {
  return state.scripts.find((script) => script.id === state.selectedScriptId)
}

function selectedLine(): CueLine | undefined {
  return selectedScript()?.lines[currentLineIndex]
}

function nextLine(): CueLine | undefined {
  return selectedScript()?.lines[currentLineIndex + 1]
}

function persist(): void {
  saveState(state)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!))
}

function icon(name: string): string {
  const icons: Record<string, string> = {
    play: '▶', stop: '■', replay: '↻', previous: '◀', next: '▶', up: '↑', down: '↓', delete: '×', lock: '🔒', unlock: '🔓'
  }
  return icons[name] ?? ''
}

function render(): void {
  const script = selectedScript()
  if (!script && state.scripts.length) state.selectedScriptId = state.scripts[0].id
  const active = selectedScript()
  const current = selectedLine()
  const next = nextLine()
  app.className = `app ${mode === 'stage' ? 'stage-mode' : ''}`
  app.innerHTML = mode === 'stage' ? stageTemplate(active, current, next) : rehearsalTemplate(active, current)
  wireEvents()
}

function rehearsalTemplate(script: Script | undefined, current: CueLine | undefined): string {
  const scriptItems = state.scripts.map((item) => `
    <li><button class="script-item ${item.id === state.selectedScriptId ? 'selected' : ''}" data-action="select-script" data-id="${item.id}" aria-current="${item.id === state.selectedScriptId}">
      <span>${escapeHtml(item.title)}</span><small>${item.lines.length} 句</small>
    </button></li>`).join('')
  const lines = script?.lines.map((line, index) => `
    <li class="line-card ${index === currentLineIndex ? 'active' : ''}">
      <button class="line-select" data-action="select-line" data-index="${index}" aria-label="選取第 ${index + 1} 句">${index + 1}</button>
      <textarea data-line-id="${line.id}" aria-label="第 ${index + 1} 句台詞">${escapeHtml(line.text)}</textarea>
      <div class="line-actions">
        <button data-action="move-line" data-index="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="上移台詞">${icon('up')}</button>
        <button data-action="move-line" data-index="${index}" data-direction="1" ${index === (script.lines.length - 1) ? 'disabled' : ''} aria-label="下移台詞">${icon('down')}</button>
        <button data-action="delete-line" data-index="${index}" aria-label="刪除台詞">${icon('delete')}</button>
      </div>
    </li>`).join('') ?? ''
  return `
    <header class="topbar"><div><h1>Mic Cue</h1><p>文字轉語音提示卡</p></div><div class="top-actions"><button data-action="export">匯出 JSON</button><label class="button-like">匯入 JSON<input id="import-file" type="file" accept="application/json" hidden></label><button class="primary" data-action="enter-stage">進入舞台模式</button></div></header>
    <main id="main-content" class="layout">
      <aside class="sidebar" aria-label="腳本列表"><div class="sidebar-head"><h2>腳本</h2><button data-action="new-script" aria-label="建立腳本">＋</button></div><ul>${scriptItems}</ul></aside>
      <section class="editor" aria-label="腳本編輯器">
        ${script ? `<div class="script-title-row"><label>腳本名稱<input id="script-title" value="${escapeHtml(script.title)}"></label><button class="danger" data-action="delete-script">刪除腳本</button></div>
        <div class="editor-heading"><h2>台詞</h2><button data-action="add-line">新增台詞</button></div><ol class="line-list">${lines || '<li class="empty">尚無台詞，請新增一行。</li>'}</ol>` : '<p class="empty">建立一份腳本開始使用。</p>'}
      </section>
      <aside class="controls" aria-label="播放及設定">
        <section><h2>排練模式</h2><p class="now-playing">${playbackStatus === 'playing' ? '正在播放' : '準備就緒'}：${escapeHtml(current?.text || '未選取台詞')}</p>
          <div class="control-grid"><button class="primary" data-action="play">${icon('play')} 播放</button><button data-action="stop">${icon('stop')} 停止</button><button data-action="replay">${icon('replay')} 重播</button><button data-action="previous">${icon('previous')} 上一句</button><button data-action="next">下一句 ${icon('next')}</button></div>
        </section>
        <section><h2>語音設定</h2><label>語音<select id="voice-select"><option value="">系統預設</option>${speaker.voices.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}" ${voice.voiceURI === state.settings.voiceURI ? 'selected' : ''}>${escapeHtml(voice.name)} (${voice.lang})</option>`).join('')}</select></label>
          <label>語速 <output>${state.settings.rate.toFixed(1)}×</output><input id="rate" type="range" min="0.5" max="2" step="0.1" value="${state.settings.rate}"></label>
          <label>音調 <output>${state.settings.pitch.toFixed(1)}</output><input id="pitch" type="range" min="0.5" max="2" step="0.1" value="${state.settings.pitch}"></label>
          <label>文字大小 <output>${state.settings.fontScale.toFixed(1)}×</output><input id="font-scale" type="range" min="0.8" max="1.6" step="0.1" value="${state.settings.fontScale}"></label>
          <label class="checkbox"><input id="lock-on-entry" type="checkbox" ${state.settings.stageLockOnEntry ? 'checked' : ''}> 進入舞台模式時啟用 Stage Lock</label>
        </section>
        <section><h2>常用救援句</h2><ul class="rescue-list">${state.settings.rescuePhrases.map((phrase, index) => `<li><button data-action="speak-rescue" data-index="${index}">${escapeHtml(phrase)}</button><button data-action="delete-rescue" data-index="${index}" aria-label="刪除救援句">×</button></li>`).join('')}</ul><button data-action="add-rescue">新增救援句</button></section>
        <p class="shortcut-help">快捷鍵：空白鍵播放／重播，← 上一句，→ 下一句，S 停止，L 鎖定舞台。</p>
      </aside>
    </main>`
}

function stageTemplate(script: Script | undefined, current: CueLine | undefined, next: CueLine | undefined): string {
  return `<main id="main-content" class="stage-shell" style="--cue-scale:${state.settings.fontScale}">
    <header class="stage-header"><button data-action="exit-stage">離開舞台模式</button><p>${escapeHtml(script?.title ?? 'Mic Cue')}</p><button data-action="toggle-lock" class="lock-button">${isLocked ? `${icon('lock')} 已鎖定` : `${icon('unlock')} 已解鎖`}</button></header>
    <section class="cue-current" aria-label="目前句子"><span>目前句子 ${currentLineIndex + 1} / ${script?.lines.length ?? 0}</span><p>${escapeHtml(current?.text || '沒有可播放的台詞')}</p></section>
    <section class="cue-next" aria-label="下一句"><span>下一句</span><p>${escapeHtml(next?.text || '已是最後一句')}</p></section>
    <div class="stage-status" role="status" aria-live="polite">${playbackStatus === 'playing' ? '正在播放目前句子' : '已停止播放'}</div>
    <section class="stage-controls" aria-label="舞台控制"><button data-action="previous" ${isLocked ? 'disabled' : ''}>${icon('previous')}<span>上一句</span></button><button data-action="replay" ${isLocked ? 'disabled' : ''}>${icon('replay')}<span>重播</span></button><button class="stage-play" data-action="play" ${isLocked ? 'disabled' : ''}>${icon('play')}<span>播放</span></button><button data-action="stop">${icon('stop')}<span>停止</span></button><button data-action="next" ${isLocked ? 'disabled' : ''}>${icon('next')}<span>下一句</span></button></section>
    ${isLocked ? '<p class="lock-note">舞台控制已鎖定。按右上角「已鎖定」進行明確解鎖；停止鍵仍可使用。</p>' : ''}
  </main>`
}

function wireEvents(): void {
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element)))
  app.querySelectorAll<HTMLTextAreaElement>('textarea[data-line-id]').forEach((textarea) => textarea.addEventListener('input', () => {
    const script = selectedScript(); const line = script?.lines.find((item) => item.id === textarea.dataset.lineId)
    if (!script || !line) return
    line.text = textarea.value; script.updatedAt = new Date().toISOString(); persist()
  }))
  const title = app.querySelector<HTMLInputElement>('#script-title')
  title?.addEventListener('change', () => { const script = selectedScript(); if (script) { script.title = title.value.trim() || '未命名腳本'; script.updatedAt = new Date().toISOString(); persist(); render() } })
  bindSetting('voice-select', (value) => { state.settings.voiceURI = value })
  bindSetting('rate', (value) => { state.settings.rate = Number(value) })
  bindSetting('pitch', (value) => { state.settings.pitch = Number(value) })
  bindSetting('font-scale', (value) => { state.settings.fontScale = Number(value) })
  const lockOnEntry = app.querySelector<HTMLInputElement>('#lock-on-entry')
  lockOnEntry?.addEventListener('change', () => { state.settings.stageLockOnEntry = lockOnEntry.checked; persist() })
  app.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', importJson)
}

function bindSetting(id: string, update: (value: string) => void): void {
  const input = app.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)
  input?.addEventListener('input', () => { update(input.value); persist(); render() })
}

function handleAction(element: HTMLElement): void {
  const action = element.dataset.action
  const script = selectedScript()
  const index = Number(element.dataset.index)
  if (action === 'new-script') { const id = makeId(); state.scripts.unshift({ id, title: '未命名腳本', lines: [], updatedAt: new Date().toISOString() }); state.selectedScriptId = id; currentLineIndex = 0; persist(); render(); return }
  if (action === 'select-script') { state.selectedScriptId = element.dataset.id ?? null; currentLineIndex = 0; persist(); render(); return }
  if (action === 'delete-script' && script && confirm(`刪除「${script.title}」？`)) { state.scripts = state.scripts.filter((item) => item.id !== script.id); state.selectedScriptId = state.scripts[0]?.id ?? null; currentLineIndex = 0; persist(); render(); return }
  if (action === 'add-line' && script) { script.lines.push({ id: makeId(), text: '' }); currentLineIndex = script.lines.length - 1; persist(); render(); return }
  if (action === 'select-line') { currentLineIndex = index; render(); return }
  if (action === 'delete-line' && script) { script.lines.splice(index, 1); currentLineIndex = Math.max(0, Math.min(currentLineIndex, script.lines.length - 1)); persist(); render(); return }
  if (action === 'move-line' && script) { const target = index + Number(element.dataset.direction); if (target >= 0 && target < script.lines.length) [script.lines[index], script.lines[target]] = [script.lines[target], script.lines[index]]; currentLineIndex = target; persist(); render(); return }
  if (action === 'play' || action === 'replay') { const line = selectedLine(); if (line) speaker.speak(line.text, state.settings.voiceURI, state.settings.rate, state.settings.pitch); return }
  if (action === 'stop') { speaker.stop(); return }
  if (action === 'previous') { currentLineIndex = Math.max(0, currentLineIndex - 1); render(); return }
  if (action === 'next') { currentLineIndex = Math.min(Math.max(0, (script?.lines.length ?? 1) - 1), currentLineIndex + 1); render(); return }
  if (action === 'enter-stage') { mode = 'stage'; isLocked = state.settings.stageLockOnEntry; speaker.stop(false); render(); return }
  if (action === 'exit-stage') { mode = 'rehearsal'; speaker.stop(false); render(); return }
  if (action === 'toggle-lock') { isLocked = !isLocked; announce(isLocked ? '舞台控制已鎖定。' : '舞台控制已解鎖。'); render(); return }
  if (action === 'speak-rescue') { speaker.speak(state.settings.rescuePhrases[index], state.settings.voiceURI, state.settings.rate, state.settings.pitch); return }
  if (action === 'add-rescue') { const phrase = prompt('新增救援句'); if (phrase?.trim()) { state.settings.rescuePhrases.push(phrase.trim()); persist(); render() }; return }
  if (action === 'delete-rescue') { state.settings.rescuePhrases.splice(index, 1); persist(); render(); return }
  if (action === 'export') exportJson()
}

function exportJson(): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: `mic-cue-${new Date().toISOString().slice(0, 10)}.json` })
  link.click(); URL.revokeObjectURL(url); announce('JSON 備份已匯出。')
}

async function importJson(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const imported = validateImportedState(JSON.parse(await file.text()))
    if (!imported) throw new Error('Invalid file')
    if (!confirm('匯入會取代這台裝置上的所有 Mic Cue 資料。要繼續嗎？')) return
    state = imported; currentLineIndex = 0; persist(); announce('JSON 備份已匯入。'); render()
  } catch { announce('無法匯入：檔案格式不正確。') }
}

document.addEventListener('keydown', (event) => {
  if ((event.target as HTMLElement).matches('input, textarea, select')) return
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); const line = selectedLine(); if (line && !isLocked) speaker.speak(line.text, state.settings.voiceURI, state.settings.rate, state.settings.pitch) }
  if (event.key === 'ArrowLeft' && !isLocked) { currentLineIndex = Math.max(0, currentLineIndex - 1); render() }
  if (event.key === 'ArrowRight' && !isLocked) { const count = selectedScript()?.lines.length ?? 0; currentLineIndex = Math.min(Math.max(0, count - 1), currentLineIndex + 1); render() }
  if (event.key.toLowerCase() === 's') speaker.stop()
  if (event.key.toLowerCase() === 'l' && mode === 'stage') { isLocked = !isLocked; render() }
})

speechSynthesis.addEventListener('voiceschanged', render)
render()
