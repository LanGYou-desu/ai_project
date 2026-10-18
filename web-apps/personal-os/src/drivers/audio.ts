// 音频驱动：程序化 chiptune 播放器（WebAudio 直接合成，零音频文件）
// 也支持把外部音频文件（public/music 下的 mp3）接进同一个分析器做频谱。
import type { AudioDriver, AudioTrackInfo } from '../kernel/kernel.ts'
import { compileTrack, type NoteEvent } from '../kernel/sequencer.ts'
import { BUILTIN_TRACKS } from '../data/tracks.ts'

export interface QueueItem {
  id: string
  name: string
}

export class WebAudioDriver implements AudioDriver {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private volume = 0.7

  private files: { id: string; name: string; url: string }[] = []
  private queue: QueueItem[] = []
  private queueIndex = -1

  private builtin: {
    id: string
    events: NoteEvent[]
    duration: number
    startAt: number
    cursor: number
    loopBase: number
    playing: boolean
    pauseAt?: number
  } | null = null
  private scheduler: ReturnType<typeof setInterval> | null = null

  private el: HTMLAudioElement | null = null
  private elSource: MediaElementAudioSourceNode | null = null
  private currentId: string | null = null

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 256
      this.master.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buf
    }
    return this.noiseBuffer
  }

  setQueue(items: QueueItem[]): void {
    this.queue = items
  }

  listBuiltin(): AudioTrackInfo[] {
    return BUILTIN_TRACKS.map((t) => ({ id: t.id, name: t.name, builtin: true }))
  }

  async loadFile(url: string, name: string): Promise<string> {
    const id = 'file:' + url
    if (!this.files.some((f) => f.id === id)) this.files.push({ id, name, url })
    return id
  }

  fileId(url: string): string {
    return 'file:' + url
  }

  private stopBuiltin(): void {
    if (this.builtin) {
      this.builtin.playing = false
      this.builtin = null
    }
  }

  private disposeEl(): void {
    if (this.el) {
      try {
        this.el.pause()
      } catch {
        /* 忽略 */
      }
      if (this.elSource && this.ctx) {
        try {
          this.elSource.disconnect()
        } catch {
          /* 忽略 */
        }
      }
      this.el = null
      this.elSource = null
    }
  }

  async playTrack(id: string): Promise<void> {
    this.currentId = id
    const qi = this.queue.findIndex((q) => q.id === id)
    if (qi >= 0) this.queueIndex = qi

    if (id.startsWith('file:')) {
      this.stopBuiltin()
      const ctx = this.ensure()
      await ctx.resume()
      const file = this.files.find((f) => f.id === id)
      if (!file) return
      this.disposeEl()
      const el = new Audio(file.url)
      el.volume = 1
      this.elSource = ctx.createMediaElementSource(el)
      this.elSource.connect(this.master!)
      this.el = el
      try {
        await el.play()
      } catch {
        /* 自动播放限制 */
      }
      return
    }

    const track = BUILTIN_TRACKS.find((t) => t.id === id)
    if (!track) return
    this.disposeEl()
    const ctx = this.ensure()
    await ctx.resume()
    const { events, duration } = compileTrack(track)
    this.builtin = {
      id,
      events,
      duration: duration + 0.3,
      startAt: ctx.currentTime + 0.06,
      cursor: 0,
      loopBase: 0,
      playing: true,
    }
    if (!this.scheduler) this.scheduler = setInterval(() => this.scheduleAhead(), 120)
    this.scheduleAhead()
  }

  /** 提前 0.35 秒调度音符；跑到尾巴就无缝循环 */
  private scheduleAhead(): void {
    const b = this.builtin
    const ctx = this.ctx
    if (!b || !ctx || !b.playing) return
    const playT = ctx.currentTime - b.startAt
    if (playT < -0.1) return
    while (b.cursor < b.events.length) {
      const ev = b.events[b.cursor]
      const at = b.loopBase + ev.time
      if (at > playT + 0.35) break
      this.scheduleEvent(ev, b.startAt + at)
      b.cursor++
    }
    if (b.cursor >= b.events.length && playT > b.loopBase + b.duration - 0.35) {
      b.loopBase += b.duration
      b.cursor = 0
    }
  }

  private scheduleEvent(ev: NoteEvent, at: number): void {
    const ctx = this.ensure()
    if (!this.master) return
    const g = ctx.createGain()
    const amp = ev.gain
    const end = at + Math.max(0.07, ev.dur * 0.92)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(amp, at + 0.012)
    g.gain.setValueAtTime(amp, Math.max(at + 0.013, end - 0.04))
    g.gain.linearRampToValueAtTime(0, end)
    if (ev.wave === 'noise') {
      const src = ctx.createBufferSource()
      src.buffer = this.getNoiseBuffer(ctx)
      src.connect(g)
      src.start(at)
      src.stop(end + 0.02)
    } else if (ev.freq !== null) {
      const osc = ctx.createOscillator()
      osc.type = ev.wave
      osc.frequency.value = ev.freq
      osc.connect(g)
      osc.start(at)
      osc.stop(end + 0.02)
    }
    g.connect(this.master)
  }

  /** 登录时的开机小铃（用户手势后调用，不受自动播放限制） */
  async chime(): Promise<void> {
    const ctx = this.ensure()
    await ctx.resume()
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      this.scheduleEvent({ time: 0, dur: 0.22, freq: f, wave: 'triangle', gain: 0.12 }, ctx.currentTime + 0.04 + i * 0.14)
    })
  }

  async toggle(): Promise<void> {
    if (this.el) {
      if (this.el.paused) await this.el.play().catch(() => undefined)
      else this.el.pause()
      return
    }
    const b = this.builtin
    const ctx = this.ctx
    if (!b || !ctx) return
    if (b.playing) {
      b.playing = false
      b.pauseAt = ctx.currentTime
      await ctx.suspend()
    } else {
      await ctx.resume()
      if (b.pauseAt) {
        b.startAt += ctx.currentTime - b.pauseAt
        b.pauseAt = undefined
      }
      b.playing = true
      this.scheduleAhead()
    }
  }

  async next(): Promise<void> {
    if (this.queue.length === 0) return
    this.queueIndex = (this.queueIndex + 1) % this.queue.length
    await this.playTrack(this.queue[this.queueIndex].id)
  }

  async prev(): Promise<void> {
    if (this.queue.length === 0) return
    this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length
    await this.playTrack(this.queue[this.queueIndex].id)
  }

  stop(): void {
    this.stopBuiltin()
    this.disposeEl()
    this.currentId = null
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
    if (this.master) this.master.gain.value = this.volume
  }

  getVolume(): number {
    return this.volume
  }

  state(): { trackId: string | null; playing: boolean; position: number; duration: number } {
    const b = this.builtin
    if (b && this.ctx) {
      const elapsed = this.ctx.currentTime - b.startAt
      const pos = b.duration > 0 ? ((elapsed % b.duration) + b.duration) % b.duration : 0
      return { trackId: b.id, playing: b.playing, position: pos, duration: b.duration }
    }
    if (this.el) {
      return {
        trackId: this.currentId,
        playing: !this.el.paused,
        position: this.el.currentTime ?? 0,
        duration: Number.isFinite(this.el.duration) ? this.el.duration : 0,
      }
    }
    return { trackId: this.currentId, playing: false, position: 0, duration: 0 }
  }

  spectrum(): Uint8Array | null {
    if (!this.analyser) return null
    const bins = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(bins)
    return bins
  }
}
