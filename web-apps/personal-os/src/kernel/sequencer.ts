// 程序化 chiptune 音序器：乐谱数据 -> WebAudio 事件表（纯函数，可单测）
// 记号：C4 / A#3 / Bb2 = 音名；'-' 延长上一个音；'.' 停顿；噪声通道用 'x' 表示鼓点
export type Wave = 'square' | 'triangle' | 'noise'

export interface Channel {
  wave: Wave
  gain?: number
  notes: string
}

export interface Track {
  id: string
  name: string
  bpm: number
  channels: Channel[]
  builtin?: boolean
  note?: string
}

export interface NoteEvent {
  time: number
  dur: number
  /** 噪声通道为 null */
  freq: number | null
  wave: Wave
  gain: number
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/

export function noteToFreq(token: string): number | null {
  const m = NOTE_RE.exec(token)
  if (!m) return null
  let semi = SEMITONES[m[1]]
  if (m[2] === '#') semi += 1
  if (m[2] === 'b') semi -= 1
  const octave = Number(m[3])
  const midi = (octave + 1) * 12 + semi
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function compileTrack(track: Track): { events: NoteEvent[]; duration: number } {
  const events: NoteEvent[] = []
  const step = 60 / track.bpm / 2 // 八分音符
  let t = 0
  let maxT = 0

  for (const ch of track.channels) {
    t = 0
    const gain = ch.gain ?? 0.16
    const tokens = ch.notes.trim().split(/\s+/).filter(Boolean)
    let current: NoteEvent | null = null
    const flush = () => {
      if (current) {
        events.push(current)
        maxT = Math.max(maxT, current.time + current.dur)
        current = null
      }
    }
    for (const tok of tokens) {
      if (tok === '-') {
        if (current) current.dur += step
        t += step
        continue
      }
      flush()
      if (tok === '.') {
        t += step
        continue
      }
      if (ch.wave === 'noise') {
        current = { time: t, dur: step, freq: null, wave: 'noise', gain: gain * 1.15 }
      } else {
        const freq = noteToFreq(tok)
        if (freq === null) {
          t += step
          continue
        }
        current = { time: t, dur: step, freq, wave: ch.wave, gain }
      }
      t += step
    }
    flush()
  }

  events.sort((a, b) => a.time - b.time || (a.freq ?? -1) - (b.freq ?? -1))
  return { events, duration: maxT }
}
