export type SpeechStatus = 'stopped' | 'playing'

export class Speaker {
  private current: SpeechSynthesisUtterance | null = null
  private lastText = ''
  public onStatusChange: (status: SpeechStatus, message: string) => void = () => undefined

  get voices(): SpeechSynthesisVoice[] {
    return speechSynthesis.getVoices()
  }

  speak(text: string, voiceURI: string, rate: number, pitch: number): void {
    this.stop(false)
    const trimmed = text.trim()
    this.lastText = trimmed
    if (!trimmed) {
      this.onStatusChange('stopped', '沒有可播放的文字。')
      return
    }
    if (typeof speechSynthesis === 'undefined') {
      this.onStatusChange('stopped', '此瀏覽器不支援語音朗讀。')
      return
    }
    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.voice = this.voices.find((voice) => voice.voiceURI === voiceURI) ?? null
    utterance.onend = () => {
      if (this.current === utterance) {
        this.current = null
        this.onStatusChange('stopped', '播放完成。')
      }
    }
    utterance.onerror = () => {
      if (this.current === utterance) {
        this.current = null
        this.recover('語音播放發生問題。')
      }
    }
    this.current = utterance
    try {
      speechSynthesis.speak(utterance)
      this.onStatusChange('playing', `正在播放：${trimmed}`)
    } catch {
      this.current = null
      this.recover('語音播放啟動失敗。')
    }
  }

  stop(announce = true): void {
    speechSynthesis.cancel()
    this.current = null
    if (announce) this.onStatusChange('stopped', '已停止播放。')
  }

  private recover(message: string): void {
    this.onStatusChange('stopped', `${message} 已回到待命狀態。`)
    if (this.lastText) {
      window.setTimeout(() => {
        if (!this.current) {
          this.onStatusChange('stopped', '可重新嘗試播放上一段內容。')
        }
      }, 0)
    }
  }
}
