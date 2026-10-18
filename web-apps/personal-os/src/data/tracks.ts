// 内置 chiptune 曲目：乐谱即数据（三通道：方波主旋律 / 三角波贝斯 / 噪声鼓机）
import type { Track } from '../kernel/sequencer.ts'

export const BUILTIN_TRACKS: Track[] = [
  {
    id: 'startup',
    name: '开机序曲',
    bpm: 132,
    builtin: true,
    note: '为按下电源键的那一秒写的',
    channels: [
      {
        wave: 'square',
        gain: 0.13,
        notes: 'C5 . E5 . G5 . C6 . B5 . G5 . E5 . D5 . C5 . E5 . G5 . C6 - G5 - E5 - C5 - . . . .',
      },
      {
        wave: 'triangle',
        gain: 0.2,
        notes: 'C3 - - - G2 - - - A2 - - - F2 - - - C3 - - - G2 - - - F2 - - - G2 - - -',
      },
      {
        wave: 'noise',
        gain: 0.1,
        notes: 'x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x .',
      },
    ],
  },
  {
    id: 'glassrain',
    name: '玻璃雨',
    bpm: 76,
    builtin: true,
    note: '适合在文件整理到一半时发呆',
    channels: [
      {
        wave: 'triangle',
        gain: 0.16,
        notes: 'A4 - C5 - D5 - E5 - D5 - C5 - A4 - G4 - A4 - C5 - E5 - D5 - C5 - A4 - - -',
      },
      {
        wave: 'triangle',
        gain: 0.08,
        notes: 'A3 - - - - - - - F3 - - - - - - - C4 - - - - - - - G3 - - - - - - -',
      },
      {
        wave: 'noise',
        gain: 0.06,
        notes: 'x . . . . . x . . . . . . . x . . . . . x . . . . . . . x . . .',
      },
    ],
  },
  {
    id: 'desk8bit',
    name: '8-bit 桌面',
    bpm: 150,
    builtin: true,
    note: '多开窗口时的默认背景乐',
    channels: [
      {
        wave: 'square',
        gain: 0.12,
        notes: 'G4 A4 B4 D5 . B4 D5 E5 . D5 B4 A4 . G4 A4 B4 . G4 A4 B4 D5 E5 . D5 . B4 . A4 . G4 . . .',
      },
      {
        wave: 'triangle',
        gain: 0.18,
        notes: 'G2 - - - G2 - - - E2 - - - E2 - - - C2 - - - C2 - - - D2 - - - D2 - - -',
      },
      {
        wave: 'noise',
        gain: 0.09,
        notes: 'x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x .',
      },
    ],
  },
]
