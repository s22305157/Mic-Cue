import type { AppState, Settings } from './types'

const KEY = 'mic-cue-pwa-state-v1'

export const defaultSettings: Settings = {
  voiceURI: '',
  rate: 1,
  pitch: 1,
  fontScale: 1,
  stageLockOnEntry: true,
  rescuePhrases: ['請給我一秒鐘。', '我想換個方式表達。', '謝謝大家耐心等我。']
}

export function makeId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function freshState(): AppState {
  const now = new Date().toISOString()
  const id = makeId()
  return {
    version: 1,
    selectedScriptId: id,
    settings: { ...defaultSettings },
    scripts: [{ id, title: '我的第一份腳本', updatedAt: now, lines: [{ id: makeId(), text: '歡迎使用 Mic Cue。' }] }]
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (parsed.version !== 1 || !Array.isArray(parsed.scripts)) return freshState()
    return {
      version: 1,
      scripts: parsed.scripts.map((script) => ({ ...script, lines: Array.isArray(script.lines) ? script.lines : [] })),
      selectedScriptId: parsed.selectedScriptId ?? parsed.scripts[0]?.id ?? null,
      settings: { ...defaultSettings, ...parsed.settings }
    }
  } catch {
    return freshState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function validateImportedState(value: unknown): AppState | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<AppState>
  if (!Array.isArray(candidate.scripts) || !candidate.settings) return null
  return {
    version: 1,
    scripts: candidate.scripts.filter((item): item is AppState['scripts'][number] =>
      !!item && typeof item.id === 'string' && typeof item.title === 'string' && Array.isArray(item.lines)
    ).map((script) => ({
      ...script,
      lines: script.lines.filter((line): line is { id: string; text: string } => !!line && typeof line.id === 'string' && typeof line.text === 'string'),
      updatedAt: typeof script.updatedAt === 'string' ? script.updatedAt : new Date().toISOString()
    })),
    selectedScriptId: typeof candidate.selectedScriptId === 'string' ? candidate.selectedScriptId : null,
    settings: { ...defaultSettings, ...candidate.settings }
  }
}
