import type { AppState, CueLine, Script, Settings } from './types'

const KEY = 'mic-cue-pwa-state-v1'
const CURRENT_VERSION = 1
const MIN_RATE = 0.5
const MAX_RATE = 2
const MIN_PITCH = 0.5
const MAX_PITCH = 2
const MIN_FONT_SCALE = 0.8
const MAX_FONT_SCALE = 1.6

export const defaultSettings: Settings = {
  voiceURI: '',
  rate: 1,
  pitch: 1,
  fontScale: 1,
  stageLockOnEntry: false,
  autoAdvance: false,
  rescuePhrases: ['請給我一秒鐘。', '我想換個方式表達。', '謝謝大家耐心等我。']
}

export function makeId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function freshState(): AppState {
  const now = new Date().toISOString()
  const id = makeId()
  return {
    version: CURRENT_VERSION,
    selectedScriptId: id,
    settings: { ...defaultSettings },
    scripts: [{ id, title: '我的第一份腳本', updatedAt: now, lines: [{ id: makeId(), text: '歡迎使用 Mic Cue。' }] }]
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function sanitizeText(value: unknown): string | null {
  return isString(value) ? value.trim() : null
}

function sanitizeLine(value: unknown): CueLine | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CueLine>
  const id = sanitizeText(candidate.id)
  const text = sanitizeText(candidate.text)
  if (!id || text === null) return null
  return { id, text }
}

function sanitizeScript(value: unknown): Script | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Script>
  const id = sanitizeText(candidate.id)
  const title = sanitizeText(candidate.title)
  const updatedAt = sanitizeText(candidate.updatedAt)
  if (!id || !title || !updatedAt || !Array.isArray(candidate.lines)) return null
  const lines = candidate.lines.map(sanitizeLine).filter((line): line is CueLine => !!line)
  if (!lines.length) return null
  return { id, title, updatedAt, lines }
}

function sanitizeSettings(value: unknown): Settings | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Settings>
  const rescuePhrases = Array.isArray(candidate.rescuePhrases)
    ? candidate.rescuePhrases.map((phrase) => sanitizeText(phrase)).filter((phrase): phrase is string => phrase !== null)
    : []
  return {
    voiceURI: sanitizeText(candidate.voiceURI) ?? '',
    rate: clampNumber(candidate.rate, MIN_RATE, MAX_RATE, defaultSettings.rate),
    pitch: clampNumber(candidate.pitch, MIN_PITCH, MAX_PITCH, defaultSettings.pitch),
    fontScale: clampNumber(candidate.fontScale, MIN_FONT_SCALE, MAX_FONT_SCALE, defaultSettings.fontScale),
    stageLockOnEntry: isBoolean(candidate.stageLockOnEntry) ? candidate.stageLockOnEntry : defaultSettings.stageLockOnEntry,
    autoAdvance: isBoolean(candidate.autoAdvance) ? candidate.autoAdvance : defaultSettings.autoAdvance,
    rescuePhrases: rescuePhrases.length ? rescuePhrases : [...defaultSettings.rescuePhrases]
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (parsed.version !== CURRENT_VERSION || !Array.isArray(parsed.scripts)) return freshState()
    const scripts = parsed.scripts.map(sanitizeScript).filter((script): script is Script => !!script)
    if (!scripts.length) return freshState()
    const settings = sanitizeSettings(parsed.settings)
    if (!settings) return freshState()
    const selectedScriptId = sanitizeText(parsed.selectedScriptId)
    return {
      version: CURRENT_VERSION,
      scripts,
      selectedScriptId: selectedScriptId && scripts.some((script) => script.id === selectedScriptId) ? selectedScriptId : scripts[0].id,
      settings
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
  if (candidate.version !== CURRENT_VERSION || !Array.isArray(candidate.scripts) || !candidate.settings) return null
  const scripts = candidate.scripts.map(sanitizeScript).filter((script): script is Script => !!script)
  const settings = sanitizeSettings(candidate.settings)
  if (!scripts.length || !settings) return null
  const selectedScriptId = sanitizeText(candidate.selectedScriptId)
  return {
    version: CURRENT_VERSION,
    scripts,
    selectedScriptId: selectedScriptId && scripts.some((script) => script.id === selectedScriptId) ? selectedScriptId : scripts[0].id,
    settings
  }
}
