export type SpeechStatus = 'stopped' | 'playing'

export class Speaker {
  private activeUtterances: Set<SpeechSynthesisUtterance> = new Set()
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private keepAliveTimer: number | null = null
  private speakTimeoutId: number | null = null
  private lastText = ''
  public onStatusChange: (status: SpeechStatus, message: string) => void = () => undefined
  public onEnd: () => void = () => undefined

  get voices(): SpeechSynthesisVoice[] {
    return typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : []
  }

  speak(text: string, voiceURI: string, rate: number, pitch: number, onEndCallback?: () => void): void {
    this.stop(false)
    const trimmed = text.trim()
    this.lastText = trimmed
    if (!trimmed) {
      this.onStatusChange('stopped', '沒有可播放的文字。')
      onEndCallback?.()
      this.onEnd()
      return
    }
    if (typeof speechSynthesis === 'undefined') {
      this.onStatusChange('stopped', '此瀏覽器不支援語音朗讀。')
      return
    }

    // Delay slightly after cancel() to avoid Web Speech API deadlock/silence bug in Chromium
    this.speakTimeoutId = window.setTimeout(() => {
      this.speakTimeoutId = null
      this.clearKeepAlive()

      const utterance = new SpeechSynthesisUtterance(trimmed)
      utterance.rate = rate
      utterance.pitch = pitch
      if (voiceURI) {
        utterance.voice = this.voices.find((voice) => voice.voiceURI === voiceURI) ?? null
      }

      // Store in Set to prevent V8 Garbage Collection of active utterance
      this.activeUtterances.add(utterance)
      this.currentUtterance = utterance

      let hasHandledEnd = false
      const cleanup = (): boolean => {
        if (hasHandledEnd) return false
        hasHandledEnd = true
        this.clearKeepAlive()
        this.activeUtterances.delete(utterance)
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null
        }
        return true
      }

      utterance.onend = () => {
        if (cleanup()) {
          this.onStatusChange('stopped', '播放完成。')
          onEndCallback?.()
          this.onEnd()
        }
      }

      utterance.onerror = (event) => {
        if (cleanup()) {
          // Ignore canceled or interrupted errors triggered by stop() or changing lines
          if (event.error !== 'canceled' && event.error !== 'interrupted') {
            this.recover('語音播放發生問題。')
          }
        }
      }

      try {
        if (speechSynthesis.paused) {
          speechSynthesis.resume()
        }
        speechSynthesis.speak(utterance)
        this.startKeepAlive()
        this.onStatusChange('playing', `正在播放：${trimmed}`)
      } catch {
        if (cleanup()) {
          this.recover('語音播放啟動失敗。')
        }
      }
    }, 40)
  }

  stop(announce = true): void {
    if (this.speakTimeoutId !== null) {
      window.clearTimeout(this.speakTimeoutId)
      this.speakTimeoutId = null
    }
    this.clearKeepAlive()
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel()
      if (speechSynthesis.paused) {
        speechSynthesis.resume()
      }
    }
    this.activeUtterances.clear()
    this.currentUtterance = null
    if (announce) this.onStatusChange('stopped', '已停止播放。')
  }

  private startKeepAlive(): void {
    this.clearKeepAlive()
    // Chromium bug fix: resume speech synth periodically if speaking to prevent Chrome 15s freeze
    this.keepAliveTimer = window.setInterval(() => {
      if (typeof speechSynthesis === 'undefined' || !this.currentUtterance) {
        this.clearKeepAlive()
        return
      }
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause()
        speechSynthesis.resume()
      }
    }, 8000)
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer !== null) {
      window.clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  private recover(message: string): void {
    this.onStatusChange('stopped', `${message} 已回到待命狀態。`)
  }
}

