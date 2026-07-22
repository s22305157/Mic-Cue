export type SpeechStatus = 'stopped' | 'playing'

export class Speaker {
  private current: SpeechSynthesisUtterance | null = null
  public onStatusChange: (status: SpeechStatus, message: string) => void = () => undefined

  get voices(): SpeechSynthesisVoice[] {
    return speechSynthesis.getVoices()
  }

  speak(text: string, voiceURI: string, rate: number, pitch: number): void {
    this.stop(false)
    if (!text.trim()) {
      this.onStatusChange('stopped', '沒有可播放的文字。')
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
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
        this.onStatusChange('stopped', '語音播放發生問題。')
      }
    }
    this.current = utterance
    speechSynthesis.speak(utterance)
    this.onStatusChange('playing', `正在播放：${text}`)
  }

  stop(announce = true): void {
    speechSynthesis.cancel()
    this.current = null
    if (announce) this.onStatusChange('stopped', '已停止播放。')
  }
}
