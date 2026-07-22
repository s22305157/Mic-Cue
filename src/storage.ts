import type { AppState, BackupDiffSummary, CueLine, Script, ScriptRevision, Settings } from './types'

const KEY = 'mic-cue-pwa-state-v1'
const CURRENT_VERSION = 1
const MIN_RATE = 0.5
const MAX_RATE = 2
const MIN_PITCH = 0.5
const MAX_PITCH = 2
const MIN_FONT_SCALE = 0.8
const MAX_FONT_SCALE = 2.0
export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024 // 5MB limit for security

export const defaultSettings: Settings = {
  voiceURI: '',
  rate: 1,
  pitch: 1,
  fontScale: 1,
  stageLockOnEntry: false,
  autoAdvance: false,
  rescuePhrases: ['請給我一秒鐘。', '我想換個方式表達。', '謝謝大家耐心等我。'],
  favoriteVoices: []
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
  if (!isString(value)) return null
  // Strip control characters & dangerous script tag patterns for security
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
  return cleaned
}

function sanitizeLine(value: unknown): CueLine | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CueLine>
  const id = sanitizeText(candidate.id) ?? makeId()
  const text = sanitizeText(candidate.text)
  if (text === null) return null
  return { id, text }
}

function sanitizeRevision(value: unknown): ScriptRevision | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ScriptRevision>
  const id = sanitizeText(candidate.id) ?? makeId()
  const timestamp = sanitizeText(candidate.timestamp) || new Date().toISOString()
  const title = sanitizeText(candidate.title) || '未命名歷史版本'
  const reason = sanitizeText(candidate.reason) || '編輯快照'
  if (!Array.isArray(candidate.lines)) return null
  const lines = candidate.lines
    .slice(0, 1000)
    .map(sanitizeLine)
    .filter((line: CueLine | null): line is CueLine => !!line)
  if (!lines.length) return null
  return { id, timestamp, title, lines, reason }
}

function sanitizeScript(value: unknown): Script | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Script>
  const id = sanitizeText(candidate.id) ?? makeId()
  const title = sanitizeText(candidate.title) || '未命名腳本'
  const updatedAt = sanitizeText(candidate.updatedAt) || new Date().toISOString()
  if (!Array.isArray(candidate.lines)) return null
  const lines = candidate.lines
    .slice(0, 1000) // Cap max lines per script for DoS protection
    .map(sanitizeLine)
    .filter((line: CueLine | null): line is CueLine => !!line)
  if (!lines.length) return null

  const history = Array.isArray(candidate.history)
    ? candidate.history
        .slice(0, 10)
        .map(sanitizeRevision)
        .filter((rev: ScriptRevision | null): rev is ScriptRevision => !!rev)
    : []

  const voiceURI = isString(candidate.voiceURI) ? candidate.voiceURI : undefined
  const rate = typeof candidate.rate === 'number' ? clampNumber(candidate.rate, MIN_RATE, MAX_RATE, 1) : undefined
  const pitch = typeof candidate.pitch === 'number' ? clampNumber(candidate.pitch, MIN_PITCH, MAX_PITCH, 1) : undefined
  const fontScale = typeof candidate.fontScale === 'number' ? clampNumber(candidate.fontScale, MIN_FONT_SCALE, MAX_FONT_SCALE, 1) : undefined
  const stageLockOnEntry = isBoolean(candidate.stageLockOnEntry) ? candidate.stageLockOnEntry : undefined
  const autoAdvance = isBoolean(candidate.autoAdvance) ? candidate.autoAdvance : undefined

  return { id, title, updatedAt, lines, history, voiceURI, rate, pitch, fontScale, stageLockOnEntry, autoAdvance }
}

function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...defaultSettings }
  const candidate = value as Partial<Settings>
  const rescuePhrases = Array.isArray(candidate.rescuePhrases)
    ? candidate.rescuePhrases
        .slice(0, 100) // Cap max rescue phrases for security
        .map((phrase) => sanitizeText(phrase))
        .filter((phrase): phrase is string => phrase !== null && phrase.length > 0)
    : []
  const favoriteVoices = Array.isArray(candidate.favoriteVoices)
    ? candidate.favoriteVoices.map((v) => sanitizeText(v)).filter((v): v is string => v !== null)
    : []
  return {
    voiceURI: sanitizeText(candidate.voiceURI) ?? '',
    rate: clampNumber(candidate.rate, MIN_RATE, MAX_RATE, defaultSettings.rate),
    pitch: clampNumber(candidate.pitch, MIN_PITCH, MAX_PITCH, defaultSettings.pitch),
    fontScale: clampNumber(candidate.fontScale, MIN_FONT_SCALE, MAX_FONT_SCALE, defaultSettings.fontScale),
    stageLockOnEntry: isBoolean(candidate.stageLockOnEntry) ? candidate.stageLockOnEntry : defaultSettings.stageLockOnEntry,
    autoAdvance: isBoolean(candidate.autoAdvance) ? candidate.autoAdvance : defaultSettings.autoAdvance,
    rescuePhrases: rescuePhrases.length ? rescuePhrases : [...defaultSettings.rescuePhrases],
    favoriteVoices
  }
}

export function createScriptSnapshot(script: Script, reason = '內容快照'): ScriptRevision {
  return {
    id: makeId(),
    timestamp: new Date().toISOString(),
    title: script.title,
    lines: script.lines.map((l) => ({ ...l })),
    reason
  }
}

export function recordScriptHistory(script: Script, reason = '內容更新'): void {
  if (!script.history) script.history = []
  const last = script.history[0]
  const currentContent = JSON.stringify({ title: script.title, lines: script.lines })
  const lastContent = last ? JSON.stringify({ title: last.title, lines: last.lines }) : ''
  if (currentContent !== lastContent) {
    script.history.unshift(createScriptSnapshot(script, reason))
    if (script.history.length > 10) {
      script.history = script.history.slice(0, 10)
    }
  }
}

export function calculateBackupDiff(localState: AppState, backupState: AppState): BackupDiffSummary {
  const newScripts: { title: string; lineCount: number }[] = []
  const modifiedScripts: { title: string; localCount: number; backupCount: number }[] = []
  const identicalScripts: { title: string }[] = []

  let totalLinesLocal = 0
  localState.scripts.forEach((s) => totalLinesLocal += s.lines.length)

  let totalLinesBackup = 0
  backupState.scripts.forEach((s) => {
    totalLinesBackup += s.lines.length
    const localScript = localState.scripts.find((ls) => ls.id === s.id || ls.title === s.title)
    if (!localScript) {
      newScripts.push({ title: s.title, lineCount: s.lines.length })
    } else {
      const localText = JSON.stringify(localScript.lines.map((l) => l.text))
      const backupText = JSON.stringify(s.lines.map((l) => l.text))
      if (localText === backupText && localScript.title === s.title) {
        identicalScripts.push({ title: s.title })
      } else {
        modifiedScripts.push({ title: s.title, localCount: localScript.lines.length, backupCount: s.lines.length })
      }
    }
  })

  return {
    newScripts,
    modifiedScripts,
    identicalScripts,
    totalLinesLocal,
    totalLinesBackup
  }
}

/**
 * Migration helper: backward & forward version compatibility
 */
function migrateState(parsed: Partial<AppState>): AppState | null {
  if (!parsed || typeof parsed !== 'object') return null
  if (!Array.isArray(parsed.scripts)) return null
  
  const scripts = parsed.scripts
    .slice(0, 100) // Cap total scripts for DoS safety
    .map(sanitizeScript)
    .filter((script): script is Script => !!script)
  if (!scripts.length) return null

  const settings = sanitizeSettings(parsed.settings)
  const selectedScriptId = sanitizeText(parsed.selectedScriptId)
  
  return {
    version: CURRENT_VERSION,
    scripts,
    selectedScriptId: selectedScriptId && scripts.some((s) => s.id === selectedScriptId) ? selectedScriptId : scripts[0].id,
    settings
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    const migrated = migrateState(parsed)
    return migrated ?? freshState()
  } catch {
    return freshState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function validateImportedState(rawText: string): AppState | null {
  if (!rawText || rawText.length > MAX_IMPORT_SIZE_BYTES) {
    return null // Security: Reject oversized JSON files (>5MB)
  }
  try {
    const parsed = JSON.parse(rawText) as Partial<AppState>
    return migrateState(parsed)
  } catch {
    return null
  }
}
