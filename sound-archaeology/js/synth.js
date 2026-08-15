'use strict';
// ============================================================
// 声音考古学 · 合成工具库
// 纯函数音频 DSP：噪声 / 正弦 / 混音 / 重采样 / 倒放 /
// 简易滤波 / 回声 / 位图字体频谱图 / 摩斯信号
// 不依赖任何浏览器 API，可在 Node 中单测。
// ============================================================

const Synth = (() => {
  const TAU = Math.PI * 2;

  // Morse 表引用：浏览器下为全局（morse.js 先加载），Node 下用 require
  const MORSE = (typeof Morse !== 'undefined')
    ? Morse
    : (typeof require !== 'undefined' ? require('./morse.js') : null);

  // ---------- 基础 ----------

  // 确定性白噪声（LCG，可复现），输出严格落在 [-1, 1)
  function noise(len, seed) {
    const b = new Float32Array(len);
    let s = seed === undefined ? 123456789 : seed;
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
      b[i] = (s / 0x7fffffff) * 2 - 1; // s ∈ [0, 2^31-1] → [-1, 1]
    }
    return b;
  }

  function silence(len) {
    return new Float32Array(len);
  }

  // 正弦波（带起止包络，防爆音）
  function sine(freq, len, sr, attackS, releaseS) {
    const a = attackS === undefined ? 0.005 : attackS;
    const r = releaseS === undefined ? 0.02 : releaseS;
    const b = new Float32Array(len);
    const atk = Math.max(1, Math.floor(a * sr));
    const rel = Math.max(1, Math.floor(r * sr));
    const w = TAU * freq / sr;
    for (let i = 0; i < len; i++) {
      let e = 1;
      if (i < atk) e = i / atk;
      const back = len - i;
      if (back < rel) e = Math.min(e, back / rel);
      b[i] = Math.sin(w * i) * e;
    }
    return b;
  }

  // 叠加: dst[offset..] += src * gain（就地修改 dst）
  function mix(dst, src, offset, gain) {
    const g = gain === undefined ? 1 : gain;
    const n = Math.min(src.length, dst.length - offset);
    for (let i = 0; i < n; i++) dst[offset + i] += src[i] * g;
    return dst;
  }

  // 线性重采样
  function resample(src, fromSr, toSr) {
    if (fromSr === toSr) return src.slice();
    const ratio = fromSr / toSr;
    const out = new Float32Array(Math.max(1, Math.floor(src.length / ratio)));
    const last = src.length - 1;
    for (let i = 0; i < out.length; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = i0 < last ? i0 + 1 : last;
      const f = pos - i0;
      out[i] = src[i0] * (1 - f) + src[i1] * f;
    }
    return out;
  }

  function reverse(buf) {
    const out = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[buf.length - 1 - i];
    return out;
  }

  // 一阶低通（IIR）
  function lowpass(buf, cutoff, sr) {
    const rc = 1 / (TAU * cutoff);
    const dt = 1 / sr;
    const alpha = dt / (rc + dt);
    const out = new Float32Array(buf.length);
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      y += alpha * (buf[i] - y);
      out[i] = y;
    }
    return out;
  }

  // 一阶高通（IIR）
  function highpass(buf, cutoff, sr) {
    const rc = 1 / (TAU * cutoff);
    const dt = 1 / sr;
    const alpha = rc / (rc + dt);
    const out = new Float32Array(buf.length);
    let y = 0;
    let prev = 0;
    for (let i = 0; i < buf.length; i++) {
      y = alpha * (y + buf[i] - prev);
      prev = buf[i];
      out[i] = y;
    }
    return out;
  }

  // ---- RBJ biquad（12dB/oct，与浏览器音频引擎同款）----

  function _biquad(buf, sr, coeff) {
    const out = new Float32Array(buf.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i];
      const y = (coeff.b0 * x + coeff.b1 * x1 + coeff.b2 * x2 -
        coeff.a1 * y1 - coeff.a2 * y2) / coeff.a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = y;
    }
    return out;
  }

  function _rbj(type, fc, sr, q) {
    const Q = q === undefined ? 0.7071 : q;
    const w0 = TAU * fc / sr;
    const alpha = Math.sin(w0) / (2 * Q);
    const c = Math.cos(w0);
    if (type === 'lowpass') {
      return { a0: 1 + alpha, a1: -2 * c, a2: 1 - alpha,
        b0: (1 - c) / 2, b1: 1 - c, b2: (1 - c) / 2 };
    }
    // highpass
    return { a0: 1 + alpha, a1: -2 * c, a2: 1 - alpha,
      b0: (1 + c) / 2, b1: -(1 + c), b2: (1 + c) / 2 };
  }

  function biquadLowpass(buf, fc, sr, q) {
    return _biquad(buf, sr, _rbj('lowpass', fc, sr, q));
  }

  function biquadHighpass(buf, fc, sr, q) {
    return _biquad(buf, sr, _rbj('highpass', fc, sr, q));
  }

  // 淡入淡出
  function fade(buf, sr, inS, outS) {
    const nIn = Math.min(buf.length, Math.floor((inS === undefined ? 0.02 : inS) * sr));
    const nOut = Math.min(buf.length, Math.floor((outS === undefined ? 0.05 : outS) * sr));
    const out = buf.slice();
    for (let i = 0; i < nIn; i++) out[i] *= i / nIn;
    for (let i = 0; i < nOut; i++) out[out.length - 1 - i] *= i / nOut;
    return out;
  }

  // 归一化到峰值
  function normalize(buf, peak) {
    const p = peak === undefined ? 0.85 : peak;
    let m = 0;
    for (let i = 0; i < buf.length; i++) {
      const a = Math.abs(buf[i]);
      if (a > m) m = a;
    }
    if (m < 1e-9) return buf.slice();
    const g = p / m;
    const out = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i] * g;
    return out;
  }

  // 简易回声/延迟叠加
  function echo(buf, sr, delayS, decay, repeats) {
    const delay = Math.max(1, Math.floor(delayS * sr));
    const rep = repeats === undefined ? 4 : repeats;
    const out = buf.slice();
    let g = decay === undefined ? 0.5 : decay;
    for (let r = 1; r <= rep; r++) {
      const off = r * delay;
      if (off >= out.length) break;
      for (let i = 0; i < out.length - off; i++) out[off + i] += buf[i] * g;
      g *= decay === undefined ? 0.5 : decay;
    }
    return out;
  }

  // 慢速幅度调制（LFO），用于雨声起伏 / 海浪
  function amplitudeMod(buf, sr, lfoHz, depth) {
    const d = depth === undefined ? 0.5 : depth;
    const out = new Float32Array(buf.length);
    const w = TAU * lfoHz / sr;
    for (let i = 0; i < buf.length; i++) {
      out[i] = buf[i] * (1 - d + d * (0.5 + 0.5 * Math.sin(w * i)));
    }
    return out;
  }

  // ---------- 5x7 位图字体 → 频谱图 ----------

  const FONT5X7 = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    'D': ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
    '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
    '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  };

  // 文本 → 列掩码序列（每列 7 bit，bit r = 第 r 行点亮）
  function fontToColumns(text) {
    const cols = [];
    const t = String(text).toUpperCase();
    for (const ch of t) {
      const glyph = FONT5X7[ch] || FONT5X7['?'];
      for (let c = 0; c < 5; c++) {
        let mask = 0;
        for (let r = 0; r < 7; r++) {
          if (glyph[r].charAt(c) === '1') mask |= (1 << r);
        }
        cols.push(mask);
      }
      cols.push(0); // 字符间距列
    }
    return cols;
  }

  // 把文字"画"进频谱：每列=一串不同频率的短音
  // opts: { colDur, fBase, fStep, gain }
  function fontToneImage(text, sr, opts) {
    const o = opts || {};
    const colDur = o.colDur === undefined ? 0.045 : o.colDur;
    const fBase = o.fBase === undefined ? 700 : o.fBase;
    const fStep = o.fStep === undefined ? 150 : o.fStep;
    const gain = o.gain === undefined ? 0.5 : o.gain;
    const cols = fontToColumns(text);
    const total = Math.ceil(cols.length * colDur * sr) + Math.ceil(0.05 * sr);
    const out = new Float32Array(total);
    for (let ci = 0; ci < cols.length; ci++) {
      const mask = cols[ci];
      const start = Math.floor(ci * colDur * sr);
      const len = Math.floor(colDur * sr);
      for (let r = 0; r < 7; r++) {
        if (mask & (1 << r)) {
          const tone = sine(fBase + r * fStep, len, sr, 0.003, 0.012);
          mix(out, tone, start, gain);
        }
      }
    }
    return out;
  }

  // ---------- 摩斯信号 ----------

  // 文本 → 点划令牌序列 [{type:'dot'|'dash'|'gap', units}]
  // 令牌间间隔 1 单位，字母间 3，词间 7（标准）
  function morseTokens(text) {
    const tokens = [];
    const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
    words.forEach((w, wi) => {
      for (let ci = 0; ci < w.length; ci++) {
        const code = MORSE.TABLE[w[ci]];
        if (!code) continue;
        for (let si = 0; si < code.length; si++) {
          tokens.push({ type: code[si] === '.' ? 'dot' : 'dash' });
          if (si < code.length - 1) tokens.push({ type: 'gap', units: 1 });
        }
        if (ci < w.length - 1) tokens.push({ type: 'gap', units: 3 });
      }
      if (wi < words.length - 1) tokens.push({ type: 'gap', units: 7 });
    });
    return tokens;
  }

  // 摩斯电码 → 音频
  // opts: { freq, dot(秒), gain }
  function morseSignal(text, sr, opts) {
    const o = opts || {};
    const freq = o.freq === undefined ? 1200 : o.freq;
    const dot = o.dot === undefined ? 0.09 : o.dot;
    const gain = o.gain === undefined ? 0.8 : o.gain;
    const tokens = morseTokens(text);
    let totalS = 0.05;
    for (const t of tokens) {
      totalS += (t.type === 'dot' ? 1 : t.type === 'dash' ? 3 : t.units) * dot;
    }
    totalS += dot;
    const out = new Float32Array(Math.ceil(totalS * sr));
    let pos = Math.floor(0.05 * sr);
    for (const t of tokens) {
      if (t.type === 'gap') {
        pos += Math.floor(t.units * dot * sr);
        continue;
      }
      const len = Math.floor((t.type === 'dot' ? 1 : 3) * dot * sr);
      const tone = sine(freq, len, sr, 0.003, 0.012);
      mix(out, tone, pos, gain);
      pos += len;
    }
    return out;
  }

  return {
    TAU,
    noise,
    silence,
    sine,
    mix,
    resample,
    reverse,
    lowpass,
    highpass,
    biquadLowpass,
    biquadHighpass,
    fade,
    normalize,
    echo,
    amplitudeMod,
    FONT5X7,
    fontToColumns,
    fontToneImage,
    morseTokens,
    morseSignal,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Synth;
}
