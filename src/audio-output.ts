/** Apply playback gain only to same-origin/blob media, never remote streams. */
export class AudioOutput {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private source: MediaElementAudioSourceNode | null = null
  private value = 2

  constructor() {
    try {
      const saved = Number(localStorage.getItem('mic-cue-playback-gain'))
      if (Number.isFinite(saved) && saved >= 1 && saved <= 3) this.value = saved
    } catch { /* Playback remains available when storage is disabled. */ }
  }

  get boost(): number { return this.value }

  set boost(value: number) {
    if (!Number.isFinite(value)) return
    this.value = Math.min(3, Math.max(1, value))
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.value, this.context.currentTime, 0.02)
    if (this.compressor) this.compressor.ratio.value = this.value === 1 ? 1 : 12
    try { localStorage.setItem('mic-cue-playback-gain', String(this.value)) } catch { /* Optional preference. */ }
  }

  // Called synchronously from the play gesture, before fetching/reading audio.
  async unlock(): Promise<void> {
    try {
      if (!this.context) {
        this.context = new AudioContext()
        this.gain = this.context.createGain()
        this.gain.gain.value = this.value
        this.compressor = this.context.createDynamicsCompressor()
        this.compressor.threshold.value = -6
        this.compressor.knee.value = 6
        this.compressor.ratio.value = this.value === 1 ? 1 : 12
        this.compressor.attack.value = 0.003
        this.compressor.release.value = 0.15
        this.gain.connect(this.compressor)
        this.compressor.connect(this.context.destination)
      }
      if (this.context.state !== 'running') await this.context.resume()
    } catch { /* Unsupported or blocked: use the ordinary media output. */ }
  }

  attach(audio: HTMLAudioElement): boolean {
    if (!this.context || !this.gain || this.context.state !== 'running') return false
    try {
      this.disconnect()
      this.source = this.context.createMediaElementSource(audio)
      this.source.connect(this.gain)
      return this.value > 1
    } catch {
      // If rerouting already happened, retain a direct path instead of silence.
      this.source?.connect(this.context.destination)
      return false
    }
  }

  disconnect(): void {
    this.source?.disconnect()
    this.source = null
  }
}
