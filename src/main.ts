import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { calculateBackupDiff, createScriptSnapshot, loadState, makeId, recordScriptHistory, saveState, validateImportedState } from './storage'
import { Speaker, type SpeechStatus } from './speech'
import type { AppState, BackupDiffSummary, CueLine, Script, ScriptRevision } from './types'

registerSW({ immediate: true })

let state = loadState()
let currentLineIndex = 0
let mode: 'rehearsal' | 'stage' = 'rehearsal'
let isLocked = state.settings.stageLockOnEntry
let playbackStatus: SpeechStatus = 'stopped'
let isContinuousPlaying = false

let isStageJumpModalOpen = false
let isImportPreviewModalOpen = false
let pendingImportState: AppState | null = null
let pendingImportDiff: BackupDiffSummary | null = null
let isScriptHistoryModalOpen = false

const speaker = new Speaker()
const app = document.querySelector<HTMLDivElement>('#app')!
const live = document.querySelector<HTMLDivElement>('#live-status')!

speaker.onStatusChange = (status, message) => {
  playbackStatus = status
  announce(message)
  render()
}

speaker.onEnd = () => {
  if (isContinuousPlaying || state.settings.autoAdvance) {
    const script = selectedScript()
    if (script && currentLineIndex < script.lines.length - 1) {
      currentLineIndex++
      render()
      scrollToActiveLine()
      const line = selectedLine()
      if (line) {
        window.setTimeout(() => {
          if (playbackStatus === 'stopped' || isContinuousPlaying || state.settings.autoAdvance) {
            speaker.speak(line.text, state.settings.voiceURI, state.settings.rate, state.settings.pitch)
          }
        }, 250)
      }
    } else {
      isContinuousPlaying = false
      announce('全劇朗讀完成。')
      render()
    }
  }
}

function announce(message: string): void {
  live.textContent = ''
  window.setTimeout(() => { live.textContent = message }, 20)
}

function selectedScript(): Script | undefined {
  return state.scripts.find((script) => script.id === state.selectedScriptId)
}

function getSortedScripts(): Script[] {
  return [...state.scripts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function touchScript(id: string | null): void {
  if (!id) return
  const script = state.scripts.find((s) => s.id === id)
  if (script) {
    script.updatedAt = new Date().toISOString()
    persist()
  }
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

function scrollToActiveLine(): void {
  window.requestAnimationFrame(() => {
    const activeCard = app.querySelector<HTMLElement>('.line-card.active')
    activeCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function render(): void {
  const sorted = getSortedScripts()
  const script = selectedScript()
  if (!script && sorted.length) state.selectedScriptId = sorted[0].id
  const active = selectedScript()
  const current = selectedLine()
  const next = nextLine()
  app.className = `app ${mode === 'stage' ? 'stage-mode' : ''}`
  app.innerHTML = mode === 'stage' ? stageTemplate(active, current, next) : rehearsalTemplate(active, current)
  wireEvents()
}

function rehearsalTemplate(script: Script | undefined, current: CueLine | undefined): string {
  const sortedScripts = getSortedScripts()
  const scriptItems = sortedScripts.map((item, idx) => `
    <li><button class="script-item ${item.id === state.selectedScriptId ? 'selected' : ''}" data-action="select-script" data-id="${item.id}" aria-current="${item.id === state.selectedScriptId}">
      <div class="script-item-main">
        <span class="script-item-title">${escapeHtml(item.title)}</span>
        ${idx === 0 ? '<span class="pinned-badge">📌 最近使用</span>' : ''}
      </div>
      <small>${item.lines.length} 句</small>
    </button></li>`).join('')
  
  const lines = script?.lines.map((line, index) => `
    <li class="line-card ${index === currentLineIndex ? 'active' : ''}" data-line-index="${index}">
      <button class="line-select" data-action="select-line" data-index="${index}" title="選取並跳轉至第 ${index + 1} 句" aria-label="選取第 ${index + 1} 句">${index + 1}</button>
      <button class="line-play-btn" data-action="play-line" data-index="${index}" title="從第 ${index + 1} 句開始播放" aria-label="播放第 ${index + 1} 句">${icon('play')}</button>
      <textarea data-line-id="${line.id}" aria-label="第 ${index + 1} 句台詞">${escapeHtml(line.text)}</textarea>
      <div class="line-actions">
        <button data-action="move-line" data-index="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="上移台詞">${icon('up')}</button>
        <button data-action="move-line" data-index="${index}" data-direction="1" ${index === (script.lines.length - 1) ? 'disabled' : ''} aria-label="下移台詞">${icon('down')}</button>
        <button data-action="delete-line" data-index="${index}" aria-label="刪除台詞">${icon('delete')}</button>
      </div>
    </li>`).join('') ?? ''

  return `
    <header class="topbar"><div><h1>Mic Cue</h1><p>文字轉語音提示卡</p></div><div class="top-actions"><button data-action="export">匯出 JSON 備份</button><label class="button-like">匯入 JSON 備份<input id="import-file" type="file" accept="application/json" hidden></label><button class="primary" data-action="enter-stage">進入舞台模式</button></div></header>
    <main id="main-content" class="layout">
      <aside class="sidebar" aria-label="腳本列表"><div class="sidebar-head"><h2>腳本</h2><button data-action="new-script" aria-label="建立腳本">＋</button></div><ul>${scriptItems}</ul></aside>
      <section class="editor" aria-label="腳本編輯器">
        ${script ? `
          <div class="script-title-row"><label>腳本名稱<input id="script-title" value="${escapeHtml(script.title)}"></label><button class="danger" data-action="delete-script">刪除腳本</button></div>
          <div class="editor-heading">
            <h2>台詞 <small style="font-size:0.85rem; color:#655d72; font-weight:normal;">(共 ${script.lines.length} 句)</small></h2>
            <div class="editor-heading-right">
              <button data-action="open-script-history" title="檢視此腳本的版本歷史快照與回復上一版" aria-label="腳本版本歷史">📜 版本歷史 (${script.history?.length ?? 0})</button>
              ${script.lines.length > 0 ? `
                <select class="quick-jump-select" id="quick-jump-select" aria-label="快速跳轉至指定台詞">
                  <option value="">🎯 快速跳至台詞...</option>
                  ${script.lines.map((line, idx) => `<option value="${idx}" ${idx === currentLineIndex ? 'selected' : ''}>第 ${idx + 1} 句: ${escapeHtml(line.text.slice(0, 18))}${line.text.length > 18 ? '...' : ''}</option>`).join('')}
                </select>
              ` : ''}
              <button data-action="add-line">新增台詞</button>
            </div>
          </div>
          ${script.lines.length > 0 ? `
            <div class="quick-jump-bar">
              <span>快速跳轉：</span>
              <button data-action="jump-first" ${currentLineIndex === 0 ? 'disabled' : ''}>⏮ 第一句</button>
              <button data-action="previous" ${currentLineIndex === 0 ? 'disabled' : ''}>◀ 上一句</button>
              <button data-action="next" ${currentLineIndex >= script.lines.length - 1 ? 'disabled' : ''}>下一句 ▶</button>
              <button data-action="jump-last" ${currentLineIndex >= script.lines.length - 1 ? 'disabled' : ''}>⏭ 最後一句</button>
            </div>
          ` : ''}
          <ul class="line-list">${lines || '<li class="empty">尚無台詞，請新增一行。</li>'}</ul>
        ` : '<div class="empty">請在左側選擇或新增腳本</div>'}
      </section>
      <aside class="controls" aria-label="控制區與設定">
        <section><h2>排練模式</h2>
          <p class="now-playing">${playbackStatus === 'playing' ? (isContinuousPlaying ? '⚡ 連續播放中' : '正在播放') : '準備就緒'}：${escapeHtml(current?.text || '未選取台詞')}</p>
          <div class="control-grid">
            <button class="primary" data-action="play">${icon('play')} 播放單句</button>
            <button class="primary" style="background:#00897b;" data-action="play-continuous">${icon('play')} 全劇連播</button>
            <button data-action="stop">${icon('stop')} 停止</button>
            <button data-action="replay">${icon('replay')} 重播</button>
            <button data-action="previous">${icon('previous')} 上一句</button>
            <button data-action="next">下一句 ${icon('next')}</button>
          </div>
        </section>
        <section><h2>語音設定</h2><label>語音<select id="voice-select"><option value="">系統預設</option>${speaker.voices.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}" ${voice.voiceURI === state.settings.voiceURI ? 'selected' : ''}>${escapeHtml(voice.name)} (${voice.lang})</option>`).join('')}</select></label>
          <label>語速 <output>${state.settings.rate.toFixed(1)}×</output><input id="rate" type="range" min="0.5" max="2" step="0.1" value="${state.settings.rate}"></label>
          <label>音調 <output>${state.settings.pitch.toFixed(1)}</output><input id="pitch" type="range" min="0.5" max="2" step="0.1" value="${state.settings.pitch}"></label>
          <label>文字大小 <output>${state.settings.fontScale.toFixed(1)}×</output><input id="font-scale" type="range" min="0.8" max="2.0" step="0.1" value="${state.settings.fontScale}"></label>
          <label class="checkbox"><input id="auto-advance" type="checkbox" ${state.settings.autoAdvance ? 'checked' : ''}> 啟用連續朗讀模式 (單句播放完自動接續下一句)</label>
          <label class="checkbox"><input id="lock-on-entry" type="checkbox" ${state.settings.stageLockOnEntry ? 'checked' : ''}> 進入舞台模式時啟用 Stage Lock</label>
        </section>
        <section><h2>常用救援句</h2><ul class="rescue-list">${state.settings.rescuePhrases.map((phrase, index) => `<li><button data-action="speak-rescue" data-index="${index}">${escapeHtml(phrase)}</button><button data-action="delete-rescue" data-index="${index}" aria-label="刪除救援句">×</button></li>`).join('')}</ul><button data-action="add-rescue">新增救援句</button></section>
        <p class="shortcut-help">快捷鍵：空白鍵播放／重播，Home / End 跳至首尾句，← 上一句，→ 下一句，S 停止，L 鎖定舞台。</p>
      </aside>

      ${isImportPreviewModalOpen ? importPreviewModalTemplate() : ''}
      ${isScriptHistoryModalOpen ? scriptHistoryModalTemplate(script) : ''}
    </main>`
}

function importPreviewModalTemplate(): string {
  if (!pendingImportState || !pendingImportDiff) return ''
  const diff = pendingImportDiff
  const exportDate = pendingImportState.exportedAt
    ? new Date(pendingImportState.exportedAt).toLocaleString()
    : '未知時間'

  return `
    <div class="modal-overlay" data-action="cancel-import" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
      <div class="modal-card" onclick="event.stopPropagation()">
        <header class="modal-header">
          <h3 id="import-preview-title">📦 備份還原預覽與差異比較</h3>
          <button class="modal-close" data-action="cancel-import" aria-label="關閉預覽">✕ 關閉</button>
        </header>

        <div class="backup-meta-box">
          <div><strong>備份結構版本：</strong> v${pendingImportState.version}</div>
          <div><strong>備份匯出時間：</strong> ${exportDate}</div>
          <div><strong>備份檔案內容：</strong> 共 ${pendingImportState.scripts.length} 份腳本 (${diff.totalLinesBackup} 句台詞)</div>
          <div><strong>目前本機內容：</strong> 共 ${state.scripts.length} 份腳本 (${diff.totalLinesLocal} 句台詞)</div>
        </div>

        <div class="diff-container">
          ${diff.newScripts.length > 0 ? `
            <div class="diff-group">
              <div class="diff-title" style="color: #2e7d32;">🟢 新增腳本 (${diff.newScripts.length} 份 - 本機不存在)</div>
              <ul class="diff-list">
                ${diff.newScripts.map((s) => `<li><span>${escapeHtml(s.title)}</span><small>${s.lineCount} 句</small></li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${diff.modifiedScripts.length > 0 ? `
            <div class="diff-group">
              <div class="diff-title" style="color: #b45309;">🟡 變更/不同腳本 (${diff.modifiedScripts.length} 份)</div>
              <ul class="diff-list">
                ${diff.modifiedScripts.map((s) => `<li><span>${escapeHtml(s.title)}</span><small>本機 ${s.localCount} 句 ➔ 備份 ${s.backupCount} 句</small></li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${diff.identicalScripts.length > 0 ? `
            <div class="diff-group">
              <div class="diff-title" style="color: #655d72;">⚪ 未變更腳本 (${diff.identicalScripts.length} 份 - 內容相同)</div>
              <ul class="diff-list">
                ${diff.identicalScripts.map((s) => `<li><span>${escapeHtml(s.title)}</span><small>內容一致</small></li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="modal-actions">
          <button class="primary" data-action="confirm-overwrite-import">🔄 覆蓋還原 (取代本機全檔)</button>
          ${diff.newScripts.length > 0 ? `<button style="background: #00897b; color: white;" data-action="confirm-merge-import">➕ 僅合併新增腳本 (${diff.newScripts.length} 份)</button>` : ''}
          <button data-action="cancel-import">✕ 取消還原</button>
        </div>
      </div>
    </div>
  `
}

function scriptHistoryModalTemplate(script: Script | undefined): string {
  if (!script) return ''
  const history = script.history ?? []

  return `
    <div class="modal-overlay" data-action="close-script-history" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div class="modal-card" onclick="event.stopPropagation()">
        <header class="modal-header">
          <h3 id="history-title">📜 「${escapeHtml(script.title)}」版本歷史快照</h3>
          <button class="modal-close" data-action="close-script-history" aria-label="關閉歷史紀錄">✕ 關閉</button>
        </header>

        ${history.length > 0 ? `
          <div class="history-list">
            ${history.map((rev, idx) => `
              <div class="history-item">
                <div class="history-item-header">
                  <span>快照 #${history.length - idx} · ${escapeHtml(rev.title)}</span>
                  <small>${new Date(rev.timestamp).toLocaleString()}</small>
                </div>
                <div class="history-item-reason">備註：${escapeHtml(rev.reason || '內容更新')} (共 ${rev.lines.length} 句)</div>
                <div class="history-item-snippet">
                  首句預覽：${escapeHtml(rev.lines[0]?.text || '無內容')}
                </div>
                <button class="history-restore-btn" data-action="restore-history-revision" data-index="${idx}">↩ 回復至此版本</button>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty">尚無此腳本的歷史快照紀錄。當您編輯台詞或名稱時系統會自動保存快照。</div>
        `}

        <div class="modal-actions">
          <button data-action="close-script-history">✕ 關閉</button>
        </div>
      </div>
    </div>
  `
}

function stageTemplate(script: Script | undefined, current: CueLine | undefined, next: CueLine | undefined): string {
  const total = script?.lines.length ?? 0
  return `<main id="main-content" class="stage-shell" style="--cue-scale:${state.settings.fontScale}">
    <header class="stage-header">
      <button data-action="exit-stage">離開舞台模式</button>
      <p>${escapeHtml(script?.title ?? 'Mic Cue')}</p>
      <button data-action="toggle-lock" class="lock-button">${isLocked ? `${icon('lock')} 已鎖定` : `${icon('unlock')} 已解鎖`}</button>
    </header>

    ${script && total > 0 ? `
      <div class="stage-jump-toolbar" role="region" aria-label="舞台快速跳轉工具列">
        <button data-action="jump-first" ${isLocked || currentLineIndex === 0 ? 'disabled' : ''} aria-label="跳至全劇第一句">⏮ 首句</button>
        <button data-action="jump-back-5" ${isLocked || currentLineIndex === 0 ? 'disabled' : ''} aria-label="倒退5句">◀ -5 句</button>
        <button class="stage-jump-trigger" data-action="open-stage-jump" ${isLocked ? 'disabled' : ''} aria-label="開啟句子跳轉盤，目前第 ${currentLineIndex + 1} 句，共 ${total} 句">🎯 跳轉句子 (${currentLineIndex + 1} / ${total})</button>
        <button data-action="jump-forward-5" ${isLocked || currentLineIndex >= total - 1 ? 'disabled' : ''} aria-label="前進5句">+5 句 ▶</button>
        <button data-action="jump-last" ${isLocked || currentLineIndex >= total - 1 ? 'disabled' : ''} aria-label="跳至全劇最後一句">⏭ 尾句</button>
      </div>
    ` : ''}

    <section class="cue-current" aria-label="目前台詞 (大字提示卡)">
      <span>目前句子 ${currentLineIndex + 1} / ${total}</span>
      <p>${escapeHtml(current?.text || '沒有可播放的台詞')}</p>
    </section>
    <section class="cue-next" aria-label="下一句台詞預覽"><span>下一句</span><p>${escapeHtml(next?.text || '已是最後一句')}</p></section>
    <div class="stage-status" role="status" aria-live="polite">${playbackStatus === 'playing' ? '正在播放目前句子' : '已停止播放'}</div>
    <section class="stage-controls" aria-label="舞台控制選項">
      <button data-action="previous" ${isLocked ? 'disabled' : ''} aria-label="上一句">${icon('previous')}<span>上一句</span></button>
      <button data-action="replay" ${isLocked ? 'disabled' : ''} aria-label="重播當前句">${icon('replay')}<span>重播</span></button>
      <button class="stage-play" data-action="play" ${isLocked ? 'disabled' : ''} aria-label="播放當前句">${icon('play')}<span>播放</span></button>
      <button data-action="stop" aria-label="停止播放">${icon('stop')}<span>停止</span></button>
      <button data-action="next" ${isLocked ? 'disabled' : ''} aria-label="下一句">${icon('next')}<span>下一句</span></button>
    </section>
    ${isLocked ? '<p class="lock-note" role="note">舞台控制已鎖定。按右上角「已鎖定」進行解鎖；停止鍵與救援句隨時可用。</p>' : ''}

    ${state.settings.rescuePhrases.length > 0 ? `
      <section class="stage-rescue" aria-label="舞台常用救援句">
        <div class="stage-rescue-header">
          <span>🆘 常用救援句</span>
        </div>
        <div class="stage-rescue-list">
          ${state.settings.rescuePhrases.map((phrase, idx) => `
            <button class="stage-rescue-btn" data-action="speak-rescue" data-index="${idx}" aria-label="緊急播放救援句：${escapeHtml(phrase)}">
              <span class="rescue-icon" aria-hidden="true">🆘</span>
              <span class="rescue-text">${escapeHtml(phrase)}</span>
            </button>
          `).join('')}
        </div>
      </section>
    ` : ''}

    ${isStageJumpModalOpen ? stageJumpModalTemplate(script) : ''}
  </main>`
}

function stageJumpModalTemplate(script: Script | undefined): string {
  if (!script) return ''
  const gridItems = script.lines.map((line, idx) => `
    <button class="stage-jump-grid-item ${idx === currentLineIndex ? 'active' : ''}" data-action="stage-jump-to" data-index="${idx}" aria-label="跳至第 ${idx + 1} 句：${escapeHtml(line.text)}">
      <span class="jump-item-num" aria-hidden="true">第 ${idx + 1} 句</span>
      <span class="jump-item-text">${escapeHtml(line.text)}</span>
    </button>
  `).join('')

  return `
    <div class="stage-jump-modal-overlay" data-action="close-stage-jump" role="dialog" aria-modal="true" aria-labelledby="stage-jump-title">
      <div class="stage-jump-modal-content" onclick="event.stopPropagation()">
        <header class="stage-jump-modal-header">
          <h3 id="stage-jump-title">🎯 舞台台詞快速跳轉盤 (共 ${script.lines.length} 句)</h3>
          <button class="stage-jump-modal-close" data-action="close-stage-jump" aria-label="關閉句子跳轉盤 (Esc)">✕ 關閉 (Esc)</button>
        </header>
        <div class="stage-jump-search-row">
          <label for="stage-jump-filter" class="sr-only">搜尋台詞關鍵字</label>
          <input type="text" id="stage-jump-filter" placeholder="🔍 輸入關鍵字過濾台詞..." autocomplete="off">
        </div>
        <div class="stage-jump-grid" id="stage-jump-grid">
          ${gridItems}
        </div>
      </div>
    </div>
  `
}

function wireEvents(): void {
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element)))
  app.querySelectorAll<HTMLTextAreaElement>('textarea[data-line-id]').forEach((textarea) => textarea.addEventListener('change', () => {
    const script = selectedScript(); const line = script?.lines.find((item) => item.id === textarea.dataset.lineId)
    if (!script || !line) return
    if (line.text !== textarea.value) {
      recordScriptHistory(script, '修改台詞文字')
      line.text = textarea.value
      script.updatedAt = new Date().toISOString()
      persist()
    }
  }))
  const title = app.querySelector<HTMLInputElement>('#script-title')
  title?.addEventListener('change', () => {
    const script = selectedScript()
    if (script && script.title !== title.value.trim()) {
      recordScriptHistory(script, '變更腳本名稱')
      script.title = title.value.trim() || '未命名腳本'
      script.updatedAt = new Date().toISOString()
      persist()
      render()
    }
  })
  
  const quickJumpSelect = app.querySelector<HTMLSelectElement>('#quick-jump-select')
  quickJumpSelect?.addEventListener('change', () => {
    if (quickJumpSelect.value !== '') {
      currentLineIndex = Number(quickJumpSelect.value)
      render()
      scrollToActiveLine()
    }
  })

  if (isStageJumpModalOpen) {
    const modalContent = app.querySelector<HTMLElement>('.stage-jump-modal-content')
    const filterInput = app.querySelector<HTMLInputElement>('#stage-jump-filter')
    filterInput?.focus()
    
    filterInput?.addEventListener('input', () => {
      const query = filterInput.value.trim().toLowerCase()
      app.querySelectorAll<HTMLElement>('.stage-jump-grid-item').forEach((item) => {
        const text = item.textContent?.toLowerCase() ?? ''
        item.style.display = text.includes(query) ? '' : 'none'
      })
    })

    modalContent?.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusables = modalContent.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    })

    const activeItem = app.querySelector<HTMLElement>('.stage-jump-grid-item.active')
    activeItem?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  bindSetting('voice-select', (value) => { state.settings.voiceURI = value })
  bindSetting('rate', (value) => { state.settings.rate = Number(value) })
  bindSetting('pitch', (value) => { state.settings.pitch = Number(value) })
  bindSetting('font-scale', (value) => { state.settings.fontScale = Number(value) })
  
  const autoAdvance = app.querySelector<HTMLInputElement>('#auto-advance')
  autoAdvance?.addEventListener('change', () => { state.settings.autoAdvance = autoAdvance.checked; persist(); render() })

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
  if (action === 'select-script') { const id = element.dataset.id ?? null; touchScript(id); state.selectedScriptId = id; currentLineIndex = 0; render(); return }
  if (action === 'delete-script' && script && confirm(`刪除「${script.title}」？`)) { state.scripts = state.scripts.filter((item) => item.id !== script.id); state.selectedScriptId = getSortedScripts()[0]?.id ?? null; currentLineIndex = 0; persist(); render(); return }
  if (action === 'add-line' && script) { recordScriptHistory(script, '新增台詞'); script.lines.push({ id: makeId(), text: '' }); touchScript(script.id); currentLineIndex = script.lines.length - 1; render(); scrollToActiveLine(); return }
  if (action === 'select-line') { currentLineIndex = index; render(); scrollToActiveLine(); return }
  if (action === 'play-line') { currentLineIndex = index; render(); scrollToActiveLine(); const line = selectedLine(); if (line) speaker.speak(line.text, state.settings.voiceURI, state.settings.rate, state.settings.pitch); return }
  if (action === 'jump-first') { currentLineIndex = 0; render(); scrollToActiveLine(); announce('跳至第一句'); return }
  if (action === 'jump-last' && script) { currentLineIndex = Math.max(0, script.lines.length - 1); render(); scrollToActiveLine(); announce('跳至最後一句'); return }
  if (action === 'jump-back-5') { currentLineIndex = Math.max(0, currentLineIndex - 5); render(); scrollToActiveLine(); announce(`後退至第 ${currentLineIndex + 1} 句`); return }
  if (action === 'jump-forward-5' && script) { currentLineIndex = Math.min(Math.max(0, script.lines.length - 1), currentLineIndex + 5); render(); scrollToActiveLine(); announce(`前進至第 ${currentLineIndex + 1} 句`); return }
  if (action === 'open-stage-jump') { isStageJumpModalOpen = true; render(); return }
  if (action === 'close-stage-jump') { isStageJumpModalOpen = false; render(); return }
  if (action === 'stage-jump-to') { currentLineIndex = index; isStageJumpModalOpen = false; render(); announce(`已跳轉至第 ${index + 1} 句`); return }
  if (action === 'delete-line' && script) { recordScriptHistory(script, '刪除台詞'); script.lines.splice(index, 1); currentLineIndex = Math.max(0, Math.min(currentLineIndex, script.lines.length - 1)); touchScript(script.id); render(); return }
  if (action === 'move-line' && script) { recordScriptHistory(script, '調整台詞順序'); const target = index + Number(element.dataset.direction); if (target >= 0 && target < script.lines.length) [script.lines[index], script.lines[target]] = [script.lines[target], script.lines[index]]; currentLineIndex = target; touchScript(script.id); render(); scrollToActiveLine(); return }
  if (action === 'play' || action === 'replay') { isContinuousPlaying = false; const line = selectedLine(); if (line) speaker.speak(line.text, state.settings.voiceURI, state.settings.rate, state.settings.pitch); return }
  if (action === 'play-continuous') { isContinuousPlaying = true; render(); const line = selectedLine(); if (line) speaker.speak(line.text, state.settings.voiceURI, state.settings.rate, state.settings.pitch); return }
  if (action === 'stop') { isContinuousPlaying = false; speaker.stop(); render(); return }
  if (action === 'previous') { currentLineIndex = Math.max(0, currentLineIndex - 1); render(); scrollToActiveLine(); announce(`上一句，第 ${currentLineIndex + 1} 句`); return }
  if (action === 'next') { currentLineIndex = Math.min(Math.max(0, (script?.lines.length ?? 1) - 1), currentLineIndex + 1); render(); scrollToActiveLine(); announce(`下一句，第 ${currentLineIndex + 1} 句`); return }
  if (action === 'enter-stage') { mode = 'stage'; isLocked = state.settings.stageLockOnEntry; isContinuousPlaying = false; isStageJumpModalOpen = false; speaker.stop(false); render(); announce('進入舞台模式'); return }
  if (action === 'exit-stage') { mode = 'rehearsal'; isStageJumpModalOpen = false; speaker.stop(false); render(); announce('離開舞台模式，回到排練編輯器'); return }
  if (action === 'toggle-lock') { isLocked = !isLocked; announce(isLocked ? '舞台控制已鎖定。' : '舞台控制已解鎖。'); render(); return }
  if (action === 'speak-rescue') { speaker.speak(state.settings.rescuePhrases[index], state.settings.voiceURI, state.settings.rate, state.settings.pitch); return }
  if (action === 'add-rescue') { const phrase = prompt('新增救援句'); if (phrase?.trim()) { state.settings.rescuePhrases.push(phrase.trim()); persist(); render() }; return }
  if (action === 'delete-rescue') { state.settings.rescuePhrases.splice(index, 1); persist(); render(); return }
  if (action === 'export') exportJson()
  
  if (action === 'open-script-history') { isScriptHistoryModalOpen = true; render(); return }
  if (action === 'close-script-history') { isScriptHistoryModalOpen = false; render(); return }
  if (action === 'restore-history-revision' && script && script.history?.[index]) {
    const rev = script.history[index]
    recordScriptHistory(script, `回復至歷史快照 #${script.history.length - index}`)
    script.title = rev.title
    script.lines = rev.lines.map((l) => ({ ...l }))
    script.updatedAt = new Date().toISOString()
    isScriptHistoryModalOpen = false
    currentLineIndex = 0
    persist()
    render()
    announce(`已成功將腳本回復至「${rev.title}」快照！`)
    return
  }

  if (action === 'cancel-import') { pendingImportState = null; pendingImportDiff = null; isImportPreviewModalOpen = false; render(); return }
  if (action === 'confirm-overwrite-import' && pendingImportState) {
    state = pendingImportState
    pendingImportState = null
    pendingImportDiff = null
    isImportPreviewModalOpen = false
    currentLineIndex = 0
    persist()
    render()
    announce('備份已成功全檔覆蓋還原！')
    return
  }
  if (action === 'confirm-merge-import' && pendingImportState && pendingImportDiff) {
    const newScriptsFromBackup = pendingImportState.scripts.filter((bs) => 
      !state.scripts.some((ls) => ls.id === bs.id || ls.title === bs.title)
    )
    state.scripts.unshift(...newScriptsFromBackup)
    pendingImportState = null
    pendingImportDiff = null
    isImportPreviewModalOpen = false
    persist()
    render()
    announce(`已成功合併匯入 ${newScriptsFromBackup.length} 份新腳本！`)
    return
  }
}

function exportJson(): void {
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `mic-cue-backup-v1-${dateStr}.json`
  const exportPayload: AppState = {
    version: 1,
    exportedAt: new Date().toISOString(),
    selectedScriptId: state.selectedScriptId,
    scripts: state.scripts,
    settings: state.settings
  }
  const jsonStr = JSON.stringify(exportPayload, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  announce('JSON 安全備份 (含版本資訊) 已成功匯出。')
}

async function importJson(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const rawText = await file.text()
    const imported = validateImportedState(rawText)
    if (!imported) throw new Error('Invalid file format or corrupted structure')
    
    pendingImportState = imported
    pendingImportDiff = calculateBackupDiff(state, imported)
    isImportPreviewModalOpen = true
    render()
    announce('已成功載入備份預覽與差異分析。')
  } catch {
    announce('無法匯入：檔案格式不正確、檔案過大或內容損毀。')
  } finally {
    input.value = ''
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (isStageJumpModalOpen) { isStageJumpModalOpen = false; render(); return }
    if (isImportPreviewModalOpen) { pendingImportState = null; pendingImportDiff = null; isImportPreviewModalOpen = false; render(); return }
    if (isScriptHistoryModalOpen) { isScriptHistoryModalOpen = false; render(); return }
  }
  if ((event.target as HTMLElement).matches('input, textarea, select')) return
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); const line = selectedLine(); if (line && !isLocked) speaker.speak(line.text, state.settings.voiceURI, state.settings.rate, state.settings.pitch) }
  if (event.key === 'Home' && !isLocked) { currentLineIndex = 0; render(); scrollToActiveLine() }
  if (event.key === 'End' && !isLocked) { const count = selectedScript()?.lines.length ?? 0; currentLineIndex = Math.max(0, count - 1); render(); scrollToActiveLine() }
  if (event.key === 'PageUp' && !isLocked) { currentLineIndex = Math.max(0, currentLineIndex - 5); render(); scrollToActiveLine() }
  if (event.key === 'PageDown' && !isLocked) { const count = selectedScript()?.lines.length ?? 0; currentLineIndex = Math.min(Math.max(0, count - 1), currentLineIndex + 5); render(); scrollToActiveLine() }
  if (event.key === 'ArrowLeft' && !isLocked) { currentLineIndex = Math.max(0, currentLineIndex - 1); render(); scrollToActiveLine() }
  if (event.key === 'ArrowRight' && !isLocked) { const count = selectedScript()?.lines.length ?? 0; currentLineIndex = Math.min(Math.max(0, count - 1), currentLineIndex + 1); render(); scrollToActiveLine() }
  if (event.key.toLowerCase() === 'j' && mode === 'stage' && !isLocked) { isStageJumpModalOpen = !isStageJumpModalOpen; render() }
  if (event.key.toLowerCase() === 's') { isContinuousPlaying = false; speaker.stop(); render() }
  if (event.key.toLowerCase() === 'l' && mode === 'stage') { isLocked = !isLocked; render() }
})

speechSynthesis.addEventListener('voiceschanged', render)
render()


