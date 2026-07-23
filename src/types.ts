export interface VoicePreset {
  id: string
  name: string
  voiceURI: string
  rate: number
  pitch: number
}

export interface ScriptSettings {
  voiceURI?: string
  rate?: number
  pitch?: number
  fontScale?: number
  stageLockOnEntry?: boolean
  autoAdvance?: boolean
}

export interface CueLine {
  id: string
  text: string
  isMarker?: boolean
  markerLabel?: string
}

export interface ScriptRevision {
  id: string
  timestamp: string
  title: string
  lines: CueLine[]
  reason?: string
}

export interface ScriptSettings {
  voiceURI?: string
  rate?: number
  pitch?: number
  fontScale?: number
  stageLockOnEntry?: boolean
  autoAdvance?: boolean
  rescuePhrases?: string[]
}

export interface Script {
  id: string
  title: string
  lines: CueLine[]
  updatedAt: string
  history?: ScriptRevision[]
  settings?: ScriptSettings
  rescuePhrases?: string[]
}

export interface Settings {
  voiceURI: string
  rate: number
  pitch: number
  fontScale: number
  stageLockOnEntry: boolean
  autoAdvance: boolean
  rescuePhrases: string[]
  voicePresets?: VoicePreset[]
}

export interface AppState {
  version: 1
  exportedAt?: string
  scripts: Script[]
  selectedScriptId: string | null
  settings: Settings
}

export interface BackupDiffSummary {
  newScripts: { title: string; lineCount: number }[]
  modifiedScripts: { title: string; localCount: number; backupCount: number }[]
  identicalScripts: { title: string }[]
  totalLinesLocal: number
  totalLinesBackup: number
}

