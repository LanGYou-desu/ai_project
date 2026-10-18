'use strict';
// 一次性音频内容验证（不属于正式测试套件，仅开发期使用）
const path = require('path');
const Morse = require(path.join(__dirname, '..', 'js', 'morse.js'));
const Synth = require(path.join(__dirname, '..', 'js', 'synth.js'));
global.Synth = Synth;
const Cases = require(path.join(__dirname, '..', 'js', 'cases.js'));
const voices = require(path.join(__dirname, '..', 'js', 'voices.js')).VOICE_ASSETS;

// 解码 WAV(base64) → Float32Array
function wavToF32(b64) {
  const bin = Buffer.from(b64, 'base64');
  // 找到 data 块
  let pos = 12, dataStart = -1, dataLen = 0;
  while (pos + 8 <= bin.length) {
    const id = bin.toString('ascii', pos, pos + 4);
    const sz = bin.readInt32LE(pos + 4);
    if (id === 'data') { dataStart = pos + 8; dataLen = sz; break; }
    pos += 8 + sz + (sz % 2);
  }
  const out = new Float32Array(dataLen / 2);
  for (let i = 0; i < out.length; i++) out[i] = bin.readInt16LE(dataStart + i * 2) / 32768;
  return out;
}

// 特定频率功率（Goertzel）
function powerAt(buf, sr, freq, t0, t1) {
  const i0 = Math.floor(t0 * sr), i1 = Math.min(buf.length, Math.floor(t1 * sr));
  let re = 0, im = 0;
  const w = 2 * Math.PI * freq / sr;
  for (let i = i0; i < i1; i++) {
    re += buf[i] * Math.cos(w * i);
    im += buf[i] * Math.sin(w * i);
  }
  const n = i1 - i0;
  return (re * re + im * im) / (n * n);
}

// 指定偏移处的互相关（偏移 = 倒放后语音样本 0 的位置，理论可精确计算）
function corrAt(buf, voice, off) {
  let s = 0, sa = 0, sb = 0, n = 0;
  for (let i = 0; i < voice.length; i += 16) {
    const j = off + i;
    if (j < 0 || j >= buf.length) continue;
    s += buf[j] * voice[i]; sa += buf[j] * buf[j]; sb += voice[i] * voice[i]; n++;
  }
  return n > 100 ? s / Math.sqrt(sa * sb + 1e-9) : -2;
}
function rmsFrames(buf, sr, frameS) {
  const fs = Math.floor(frameS * sr);
  const frames = [];
  for (let i = 0; i + fs <= buf.length; i += fs) {
    let s = 0;
    for (let j = i; j < i + fs; j++) s += buf[j] * buf[j];
    frames.push(Math.sqrt(s / fs));
  }
  return frames;
}
function frameCorr(buf, sr, voice, frameS, lagFrames) {
  const A = rmsFrames(buf, sr, frameS);
  const B = rmsFrames(voice, sr, frameS);
  const lag = lagFrames === undefined ? 120 : lagFrames;
  let best = -1, bestLag = 0;
  for (let L = -lag; L <= lag; L++) {
    let s = 0, sa = 0, sb = 0, n = 0;
    for (let i = 0; i < B.length; i++) {
      const j = i + L;
      if (j < 0 || j >= A.length) continue;
      s += A[j] * B[i]; sa += A[j] * A[j]; sb += B[i] * B[i]; n++;
    }
    if (n < 10) continue;
    const c = s / Math.sqrt(sa * sb + 1e-9);
    if (c > best) { best = c; bestLag = L; }
  }
  return { corr: best, lagS: bestLag * frameS };
}

console.log('=== case2: 倒放后应能听到正向人声 ===');
{
  const voice = wavToF32(voices.case2); // 22050Hz 源
  const mix = Cases.buildCaseAudio(Cases.CASES.case2, {
    case1: wavToF32(voices.case1), case2: voice, case6: wavToF32(voices.case6),
  });
  const rev = Synth.reverse(mix);
  // 语音在混音中从 2.5s 开始；倒放后语音样本 0 位于:
  const placeAt = Math.floor(2.5 * 22050);
  const off = mix.length - 1 - (placeAt + voice.length - 1);
  const atExact = corrAt(rev, voice, off);
  const atWrong = corrAt(rev, voice, Math.floor(2.0 * 22050));
  console.log('  精确偏移相关: ' + atExact.toFixed(3) + ' | 错位偏移: ' + atWrong.toFixed(3) + ' (精确应 > 0.5)');
}

console.log('=== case3: 频谱文字频率带存在 ===');
{
  const mix = Cases.buildCaseAudio(Cases.CASES.case3, {});
  let bandPower = 0, outside = 0;
  for (let f = 700; f <= 1600; f += 150) bandPower += powerAt(mix, 22050, f, 1.0, 2.4);
  outside = powerAt(mix, 22050, 300, 1.0, 2.4) + powerAt(mix, 22050, 5000, 1.0, 2.4);
  console.log('  图像频带功率: ' + bandPower.toExponential(2) + ' vs 背景: ' + outside.toExponential(2));
}

console.log('=== case5: 17.5kHz 超声信号存在 ===');
{
  const mix = Cases.buildCaseAudio(Cases.CASES.case5, {});
  const p175 = powerAt(mix, 44100, 17500, 1.6, 2.6);
  const pLow = powerAt(mix, 44100, 3000, 1.6, 2.6);
  console.log('  17.5k 功率: ' + p175.toExponential(2) + ' vs 3k 背景: ' + pLow.toExponential(2));
}

console.log('=== case6: 三层线索齐备 ===');
{
  const voice = wavToF32(voices.case6); // 22050Hz 源
  const mix = Cases.buildCaseAudio(Cases.CASES.case6, {
    case1: wavToF32(voices.case1), case2: wavToF32(voices.case2), case6: voice,
  });
  const rev = Synth.reverse(mix);
  const placeAt = Math.floor(2.5 * 22050);
  const off = mix.length - 1 - (placeAt + voice.length - 1);
  const atExact = corrAt(rev, voice, off);
  const atWrong = corrAt(rev, voice, Math.floor(2.0 * 22050));
  console.log('  精确偏移相关: ' + atExact.toFixed(3) + ' | 错位偏移: ' + atWrong.toFixed(3) + ' (精确应 > 0.5)');
  const pEcho = powerAt(mix, 22050, 800, 0.6, 2.0) + powerAt(mix, 22050, 1250, 0.6, 2.0);
  const pBg = powerAt(mix, 22050, 300, 0.6, 2.0);
  console.log('  ECHO 频带功率: ' + pEcho.toExponential(2) + ' vs 背景: ' + pBg.toExponential(2));
  const p73 = powerAt(mix, 22050, 1500, 13.2, 14.6);
  console.log('  摩斯 73 频带功率: ' + p73.toExponential(2));
}
