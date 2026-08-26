export type SpeechStatus = 'stopped' | 'playing'

/** Online Taiwanese Mandarin male voice. Keeps the old URI so saved selections migrate automatically. */
export const PREFERRED_CHINESE_MALE_VOICE = 'mic-cue://voice/chinese-male'
export const PREFERRED_LOCAL_CHINESE_MALE_VOICE = 'mic-cue://voice/local-chinese-male'

const ONLINE_TTS_ENDPOINT = 'https://tts.kina.ink/tts'
const ONLINE_TTS_VOICE = 'zh-TW-YunJheNeural'

// Web Speech does not expose voice gender. These are the public male voice names
// used by the major OS/browser vendors, so matching must be name based.
const CHINESE_MALE_VOICE_NAMES = [
  'zhiwei', 'zhi wei', 'kangkang', 'kang kang', 'danny',
  'yunjhe', 'yun jhe', 'yunxi', 'yun xi', 'yunjian', 'yun jian',
  'yunyang', 'yun yang', 'yunfeng', 'yun feng', 'yunhao', 'yun hao',
  'yunjie', 'yun jie', 'yunxia', 'yun xia', 'yunxiao', 'yun xiao',
  'yunye', 'yun ye', 'yunze', 'yun ze', 'wanlung', 'wan lung',
  'yunsong', 'yun song', 'yunqi', 'yun qi', 'yundeng', 'yun deng',
  'yunbiao', 'yun biao', 'yunxiang', 'yun xiang', '雲哲', '云哲',
  '雲希', '云希', '雲健', '云健', '雲揚', '云扬', '雲龍', '云龙',
  '志偉', '志伟', '康康'
]

function normalizedVoiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI}`.toLocaleLowerCase()
}

export class Speaker {
  private activeUtterances: Set<SpeechSynthesisUtterance> = new Set()
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private keepAliveTimer: number | null = null
  private speakTimeoutId: number | null = null
  private currentAudio: HTMLAudioElement | null = null
  private onlineAudioCache = new Map<string, string>()
  private onlineAudioRequests = new Map<string, Promise<string>>()
  private lastText = ''
  public onStatusChange: (status: SpeechStatus, message: string) => void = () => undefined
  public onEnd: () => void = () => undefined

  get voices(): SpeechSynthesisVoice[] {
    return typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : []
  }

  get preferredChineseMaleVoice(): SpeechSynthesisVoice | null {
    const candidates = this.voices.filter((voice) => voice.lang.toLocaleLowerCase().startsWith('zh'))
    const matches = candidates.filter((voice) => {
      const label = normalizedVoiceLabel(voice)
      return CHINESE_MALE_VOICE_NAMES.some((name) => label.includes(name))
    })

    // Prefer Taiwanese Mandarin, then Cantonese, then other Mandarin variants.
    const localePriority = ['zh-tw', 'zh-hk', 'zh-cn']
    return matches.sort((a, b) => {
      const aRank = localePriority.indexOf(a.lang.toLocaleLowerCase())
      const bRank = localePriority.indexOf(b.lang.toLocaleLowerCase())
      return (aRank < 0 ? localePriority.length : aRank) - (bRank < 0 ? localePriority.length : bRank)
    })[0] ?? null
  }

  async preloadOnlineMale(text: string, rate: number, pitch: number): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return
    const key = this.onlineAudioKey(trimmed, rate, pitch)
    if (this.onlineAudioCache.has(key)) return
    await this.fetchOnlineMaleAudio(trimmed, rate, pitch)
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
    if (voiceURI === PREFERRED_CHINESE_MALE_VOICE) {
      this.speakOnlineMale(trimmed, rate, pitch, onEndCallback)
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
      if (voiceURI === PREFERRED_LOCAL_CHINESE_MALE_VOICE) {
        const maleVoice = this.preferredChineseMaleVoice
        if (!maleVoice) {
          this.onStatusChange('stopped', '目前裝置未提供中文男聲。請先在手機安裝中文男聲，再重新開啟網頁。')
          return
        }
        utterance.voice = maleVoice
        utterance.lang = maleVoice.lang
      } else if (voiceURI) {
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
        const voiceMessage = voiceURI === PREFERRED_LOCAL_CHINESE_MALE_VOICE && utterance.voice
          ? `（男聲：${utterance.voice.name}）`
          : ''
        this.onStatusChange('playing', `正在播放${voiceMessage}：${trimmed}`)
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
    if (this.currentAudio) {
      const audio = this.currentAudio
      this.currentAudio = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
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

  private speakOnlineMale(text: string, rate: number, pitch: number, onEndCallback?: () => void): void {
    const key = this.onlineAudioKey(text, rate, pitch)
    const cachedAudioUrl = this.onlineAudioCache.get(key)
    const audio = new Audio(cachedAudioUrl ?? this.onlineMaleUrl(text, rate, pitch))
    this.currentAudio = audio
    audio.preload = 'auto'
    audio.onplaying = () => {
      if (this.currentAudio === audio) {
        this.onStatusChange('playing', `正在播放（線上男聲：雲哲${cachedAudioUrl ? '，已預載' : ''}）：${text}`)
      }
    }
    audio.onended = () => {
      if (this.currentAudio !== audio) return
      this.currentAudio = null
      this.onStatusChange('stopped', '播放完成。')
      onEndCallback?.()
      this.onEnd()
    }
    audio.onerror = () => {
      if (this.currentAudio !== audio) return
      this.currentAudio = null
      this.recover('線上男聲暫時無法播放，請檢查網路或改用裝置語音。')
    }

    this.onStatusChange('playing', cachedAudioUrl ? '正在播放已預載的台灣 AI 男聲「雲哲」…' : '正在連線取得台灣 AI 男聲「雲哲」…')
    void audio.play().catch(() => {
      if (this.currentAudio !== audio) return
      this.currentAudio = null
      this.recover('瀏覽器阻擋了線上男聲播放，請再點一次播放。')
    })
  }

  private onlineAudioKey(text: string, rate: number, pitch: number): string {
    return `${rate.toFixed(2)}|${pitch.toFixed(2)}|${text}`
  }

  private onlineMaleUrl(text: string, rate: number, pitch: number): string {
    const ratePercent = Math.round(Math.min(50, Math.max(-50, (rate - 1) * 100)))
    const pitchHz = Math.round(Math.min(50, Math.max(-50, (pitch - 1) * 50)))
    const signed = (value: number, suffix: string) => `${value >= 0 ? '+' : ''}${value}${suffix}`
    const params = new URLSearchParams({
      text,
      voice: ONLINE_TTS_VOICE,
      rate: signed(ratePercent, '%'),
      volume: '+0%',
      pitch: signed(pitchHz, 'Hz'),
      format: 'mp3'
    })
    return `${ONLINE_TTS_ENDPOINT}?${params}`
  }

  private fetchOnlineMaleAudio(text: string, rate: number, pitch: number): Promise<string> {
    const key = this.onlineAudioKey(text, rate, pitch)
    const existing = this.onlineAudioRequests.get(key)
    if (existing) return existing

    const request = fetch(this.onlineMaleUrl(text, rate, pitch))
      .then((response) => {
        if (!response.ok) throw new Error(`TTS preload failed: ${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        if (!blob.type.startsWith('audio/')) throw new Error('TTS preload returned a non-audio response')
        const audioUrl = URL.createObjectURL(blob)
        this.onlineAudioCache.set(key, audioUrl)
        while (this.onlineAudioCache.size > 8) {
          const oldest = this.onlineAudioCache.entries().next().value as [string, string] | undefined
          if (!oldest) break
          this.onlineAudioCache.delete(oldest[0])
          URL.revokeObjectURL(oldest[1])
        }
        return audioUrl
      })
      .finally(() => this.onlineAudioRequests.delete(key))

    this.onlineAudioRequests.set(key, request)
    return request
  }
}

