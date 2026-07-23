import type { AppState, BackupDiffSummary, CueLine, Script, ScriptRevision, ScriptSettings, Settings, VoicePreset } from './types'

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
  voicePresets: [
    { id: 'vp-std', name: '標準簡報 (1.0x)', voiceURI: '', rate: 1.0, pitch: 1.0 },
    { id: 'vp-fast', name: '快速導讀 (1.4x)', voiceURI: '', rate: 1.4, pitch: 1.0 }
  ]
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
  const isMarker = isBoolean(candidate.isMarker) ? candidate.isMarker : undefined
  const markerLabel = sanitizeText(candidate.markerLabel) ?? undefined
  return { id, text, isMarker, markerLabel }
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

function sanitizeVoicePreset(value: unknown): VoicePreset | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<VoicePreset>
  const id = sanitizeText(candidate.id) ?? makeId()
  const name = sanitizeText(candidate.name) || '未命名預設'
  const voiceURI = sanitizeText(candidate.voiceURI) ?? ''
  const rate = clampNumber(candidate.rate, MIN_RATE, MAX_RATE, 1.0)
  const pitch = clampNumber(candidate.pitch, MIN_PITCH, MAX_PITCH, 1.0)
  return { id, name, voiceURI, rate, pitch }
}

function sanitizeScriptSettings(value: unknown): ScriptSettings | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<ScriptSettings>
  const res: ScriptSettings = {}
  if (isString(candidate.voiceURI)) res.voiceURI = candidate.voiceURI
  if (typeof candidate.rate === 'number' && Number.isFinite(candidate.rate)) res.rate = clampNumber(candidate.rate, MIN_RATE, MAX_RATE, 1.0)
  if (typeof candidate.pitch === 'number' && Number.isFinite(candidate.pitch)) res.pitch = clampNumber(candidate.pitch, MIN_PITCH, MAX_PITCH, 1.0)
  if (typeof candidate.fontScale === 'number' && Number.isFinite(candidate.fontScale)) res.fontScale = clampNumber(candidate.fontScale, MIN_FONT_SCALE, MAX_FONT_SCALE, 1.0)
  if (isBoolean(candidate.stageLockOnEntry)) res.stageLockOnEntry = candidate.stageLockOnEntry
  if (isBoolean(candidate.autoAdvance)) res.autoAdvance = candidate.autoAdvance
  if (Array.isArray(candidate.rescuePhrases)) {
    const rp = candidate.rescuePhrases.map((p) => sanitizeText(p)).filter((p): p is string => p !== null && p.length > 0)
    if (rp.length > 0) res.rescuePhrases = rp
  }
  return Object.keys(res).length > 0 ? res : undefined
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
    .filter((line): line is CueLine => !!line)
  if (!lines.length) return null

  const history = Array.isArray(candidate.history)
    ? candidate.history
        .slice(0, 10)
        .map(sanitizeRevision)
        .filter((rev): rev is ScriptRevision => !!rev)
    : []

  const settings = sanitizeScriptSettings(candidate.settings)
  const rescuePhrases = Array.isArray(candidate.rescuePhrases)
    ? candidate.rescuePhrases.map((p) => sanitizeText(p)).filter((p): p is string => p !== null && p.length > 0)
    : undefined

  return { id, title, updatedAt, lines, history, settings, rescuePhrases: rescuePhrases?.length ? rescuePhrases : undefined }
}

export function getEffectiveScriptSettings(script: Script | undefined, globalSettings: Settings): Settings {
  const customPhrases = script?.rescuePhrases || script?.settings?.rescuePhrases
  const rescuePhrases = customPhrases && customPhrases.length > 0 ? customPhrases : globalSettings.rescuePhrases

  if (!script || !script.settings) {
    return { ...globalSettings, rescuePhrases }
  }
  return {
    ...globalSettings,
    voiceURI: script.settings.voiceURI ?? globalSettings.voiceURI,
    rate: script.settings.rate ?? globalSettings.rate,
    pitch: script.settings.pitch ?? globalSettings.pitch,
    fontScale: script.settings.fontScale ?? globalSettings.fontScale,
    stageLockOnEntry: script.settings.stageLockOnEntry ?? globalSettings.stageLockOnEntry,
    autoAdvance: script.settings.autoAdvance ?? globalSettings.autoAdvance,
    rescuePhrases
  }
}

export function getScriptMarkers(script: Script | undefined): { index: number; line: CueLine }[] {
  if (!script) return []
  const res: { index: number; line: CueLine }[] = []
  script.lines.forEach((line, index) => {
    if (line.isMarker) res.push({ index, line })
  })
  return res
}

export function setScriptSetting<K extends keyof ScriptSettings>(
  script: Script | undefined,
  globalSettings: Settings,
  key: K,
  value: ScriptSettings[K]
): void {
  if (script) {
    if (!script.settings) script.settings = {}
    script.settings[key] = value
    script.updatedAt = new Date().toISOString()
  } else {
    (globalSettings as any)[key] = value
  }
}

export function resetScriptSettings(script: Script | undefined): void {
  if (script) {
    delete script.settings
    script.updatedAt = new Date().toISOString()
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

function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...defaultSettings }
  const candidate = value as Partial<Settings>
  const rescuePhrases = Array.isArray(candidate.rescuePhrases)
    ? candidate.rescuePhrases
        .slice(0, 100) // Cap max rescue phrases for security
        .map((phrase) => sanitizeText(phrase))
        .filter((phrase): phrase is string => phrase !== null && phrase.length > 0)
    : []
  const voicePresets = Array.isArray(candidate.voicePresets)
    ? candidate.voicePresets
        .slice(0, 50)
        .map(sanitizeVoicePreset)
        .filter((vp): vp is VoicePreset => !!vp)
    : [...(defaultSettings.voicePresets || [])]

  return {
    voiceURI: sanitizeText(candidate.voiceURI) ?? '',
    rate: clampNumber(candidate.rate, MIN_RATE, MAX_RATE, defaultSettings.rate),
    pitch: clampNumber(candidate.pitch, MIN_PITCH, MAX_PITCH, defaultSettings.pitch),
    fontScale: clampNumber(candidate.fontScale, MIN_FONT_SCALE, MAX_FONT_SCALE, defaultSettings.fontScale),
    stageLockOnEntry: isBoolean(candidate.stageLockOnEntry) ? candidate.stageLockOnEntry : defaultSettings.stageLockOnEntry,
    autoAdvance: isBoolean(candidate.autoAdvance) ? candidate.autoAdvance : defaultSettings.autoAdvance,
    rescuePhrases: rescuePhrases.length ? rescuePhrases : [...defaultSettings.rescuePhrases],
    voicePresets: voicePresets.length ? voicePresets : [...(defaultSettings.voicePresets || [])]
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

