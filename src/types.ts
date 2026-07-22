export interface CueLine {
  id: string
  text: string
}

export interface Script {
  id: string
  title: string
  lines: CueLine[]
  updatedAt: string
}

export interface Settings {
  voiceURI: string
  rate: number
  pitch: number
  fontScale: number
  stageLockOnEntry: boolean
  autoAdvance: boolean
  rescuePhrases: string[]
}

export interface AppState {
  version: 1
  scripts: Script[]
  selectedScriptId: string | null
  settings: Settings
}
