'use strict';
// ============================================================
// 声音考古学 · 单元测试（Node 直接运行: node tests/run.js）
// ============================================================

const path = require('path');
const Morse = require(path.join(__dirname, '..', 'js', 'morse.js'));
const Synth = require(path.join(__dirname, '..', 'js', 'synth.js'));

// cases.js 在浏览器里引用全局 Synth；Node 下注入全局
global.Synth = Synth;
const Cases = require(path.join(__dirname, '..', 'js', 'cases.js'));

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ FAIL: ' + name); }
}

// ---------- 摩斯 ----------
console.log('[morse]');
t('encode MIDNIGHT', Morse.encode('MIDNIGHT') === '-- .. -.. -. .. --. .... -');
t('encode word separator', Morse.encode('SOS 73') === '... --- ... / --... ...--');
t('decode round-trip', Morse.decode(Morse.encode('HELLO WORLD')) === 'HELLO WORLD');
t('decode with slashes', Morse.decode('... --- ... / --... ...--') === 'SOS 73');
t('REF_LETTERS has 26 entries', Morse.REF_LETTERS.flat().length === 26);
t('REF_DIGITS has 10 entries', Morse.REF_DIGITS.length === 10);

// ---------- 答案归一化 ----------
console.log('[normalizeAnswer]');
const na = Cases.normalizeAnswer;
t('B-7 → b7', na('B-7') === 'b7');
t('蓝鲸 stays', na(' 蓝鲸 ') === '蓝鲸');
t('ECHO → echo', na(' ECHO!') === 'echo');
t('MIDNIGHT lower', na('MidNight') === 'midnight');
t('accepts check', ['b7', 'b七'].some((a) => na(a) === na('B-7')));
t('accepts 回声号', ['回声号', 'echo'].some((a) => na(a) === na('回声号')));

// ---------- Synth ----------
console.log('[synth]');
t('noise length', Synth.noise(1000).length === 1000);
t('noise deterministic', Synth.noise(100, 7)[10] === Synth.noise(100, 7)[10]);
t('sine has content', Synth.sine(440, 44100, 44100).some((v) => Math.abs(v) > 0.5));
t('resample 8000→22050 ratio', Math.abs(Synth.resample(new Float32Array(8000), 8000, 22050).length - 22050) <= 1);
t('reverse is reversed', Synth.reverse(new Float32Array([1, 2, 3]))[0] === 3);
t('mix adds', (() => { const d = new Float32Array(10); Synth.mix(d, new Float32Array([1, 1]), 3, 2); return d[3] === 2 && d[4] === 2; })());
t('normalize peak', (() => { const b = Synth.normalize(new Float32Array([0.5, 1.0])); return Math.abs(b[1] - 0.85) < 1e-6; })());
t('font B-7 columns = 18', Synth.fontToColumns('B-7').length === 18);
t('font ECHO has lit rows', Synth.fontToColumns('ECHO').some((m) => m > 0));
t('fontToneImage non-silent', Synth.fontToneImage('B-7', 22050).some((v) => Math.abs(v) > 0.01));
t('morseSignal non-silent', Synth.morseSignal('SOS', 22050).some((v) => Math.abs(v) > 0.1));
t('morseSignal length scales with dot', Synth.morseSignal('SOS', 22050, { dot: 0.2 }).length > Synth.morseSignal('SOS', 22050, { dot: 0.05 }).length);

// ---------- 案件音频 ----------
console.log('[cases]');
const dummyVoices = {
  case1: Synth.noise(Math.floor(22050 * 9), 1),
  case2: Synth.noise(Math.floor(22050 * 7), 2),
  case6: Synth.noise(Math.floor(22050 * 6), 3),
};
for (const id of Cases.CASE_ORDER) {
  const c = Cases.CASES[id];
  const buf = Cases.buildCaseAudio(c, dummyVoices);
  const expectLen = Math.floor(c.duration * c.sr);
  t(id + ' 长度正确 (' + c.duration + 's @' + c.sr + ')',
    Math.abs(buf.length - expectLen) <= c.sr * 0.2);
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  t(id + ' 非静音 (peak=' + peak.toFixed(2) + ')', peak > 0.5);
  t(id + ' 归一化峰值≈0.85', Math.abs(peak - 0.85) < 0.05);
  // 答案必须能在 accepts 里命中
  t(id + ' 有答案', c.accepts.length > 0);
}
// case2 关键：倒放后应能听到正向人声（检查反转后与原始人声的相似度不可行，但确认人声被混入）
const c2 = Cases.buildCaseAudio(Cases.CASES.case2, dummyVoices);
const revC2 = Synth.reverse(c2);
t('case2 倒放后有内容', revC2.some((v) => Math.abs(v) > 0.5));
// case3: 频谱文字能量应集中在 700~1600Hz 频段（粗略：能量 > 低频底噪）
const c3 = Cases.buildCaseAudio(Cases.CASES.case3, dummyVoices);
t('case3 有频谱文字能量', c3.some((v) => Math.abs(v) > 0.3));

// ============================================================
// 以下为回归测试：本次修复/优化的行为
// ============================================================

const LabViews = require(path.join(__dirname, '..', 'js', 'spectrogram.js')).LabViews;
const AudioLab = require(path.join(__dirname, '..', 'js', 'audio-lab.js')).AudioLab;

// ---------- 测试替身 ----------

// 最小 Web Audio 替身（AudioLab 只用这些节点）
function mockAudioContext(sampleRate) {
  let t = 0;
  return {
    sampleRate,
    destination: {},
    get currentTime() { return t; },
    advance(sec) { t += sec; },
    createWaveShaper() { return { oversample: '', curve: null, connect() {} }; },
    createBiquadFilter() {
      return {
        type: 'allpass',
        frequency: { value: 0, setTargetAtTime(v) { this.value = v; } },
        Q: { value: 0, setTargetAtTime(v) { this.value = v; } },
        gain: { value: 0, setTargetAtTime(v) { this.value = v; } },
        connect() {},
      };
    },
    createGain() {
      return { gain: { value: 1, setTargetAtTime(v) { this.value = v; } }, connect() {} };
    },
    createBuffer(ch, len, sr) {
      const data = new Float32Array(len);
      return {
        numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr,
        getChannelData: () => data, copyToChannel(src) { data.set(src.subarray(0, len)); },
      };
    },
    createBufferSource() {
      return {
        buffer: null, loop: false, playbackRate: { value: 1 },
        connect() {}, start() {}, stop() {}, onended: null,
      };
    },
    createScriptProcessor() { return { onaudioprocess: null, connect() {} }; },
  };
}

// 最小 canvas 2D 替身（只实现视图真正调用的部分）
function mockCanvas(w, h) {
  const g = {
    createImageData: (W, H) => ({ width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }),
    putImageData() {}, setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, fillText() {},
    strokeStyle: '', fillStyle: '', lineWidth: 1, font: '',
  };
  return { width: 0, height: 0, clientWidth: w, clientHeight: h, getContext: () => g };
}

// base64 WAV → Float32Array（与 tests/verify-audio.js 同款解码）
function wavToF32(b64) {
  const bin = Buffer.from(b64, 'base64');
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

function corr(a, b, i0, i1) {
  let s = 0, sa = 0, sb = 0;
  for (let i = i0; i < i1; i++) { s += a[i] * b[i]; sa += a[i] * a[i]; sb += b[i] * b[i]; }
  return s / Math.sqrt(sa * sb + 1e-12);
}

// 环形缓冲替身（与 LabViews 内部结构一致）
function mockRing(len, total) {
  return { buf: new Float32Array(len), pos: 0, length: len, total: total || 0 };
}

// 点亮像素的行号（非背景色）
function litRows(view, x) {
  const W = view.w, H = view.h, d = view.img.data, rows = [];
  for (let y = 0; y < H; y++) {
    const i = (y * W + x) * 4;
    if (!(d[i] === 4 && d[i + 1] === 18 && d[i + 2] === 10)) rows.push(y);
  }
  return rows;
}

// 连续非静音段（按 2ms 分块取峰值，避免正弦过零点把一段音切成多段）
function toneSpans(buf, thr, blockS) {
  const B = Math.max(1, Math.floor((blockS || 0.002) * 22050));
  const spans = [];
  let start = -1;
  for (let i = 0; i < buf.length; i += B) {
    let peak = 0;
    for (let j = i; j < Math.min(buf.length, i + B); j++) {
      const a = Math.abs(buf[j]);
      if (a > peak) peak = a;
    }
    const on = peak > thr;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { spans.push([start, i - start]); start = -1; }
  }
  if (start >= 0) spans.push([start, buf.length - start]);
  return spans;
}

// ---------- 摩斯时序 ----------
console.log('[morse 时序]');
{
  const tk = Synth.morseTokens('SOS');
  const count = (type, units) => tk.filter((x) => x.type === type && (units === undefined || x.units === units)).length;
  t('SOS = 6 点 + 3 划', count('dot') === 6 && count('dash') === 3);
  t('符号间隔 1 单位', count('gap', 1) === 6);
  t('字母间隔 3 单位', count('gap', 3) === 2);
  const tk2 = Synth.morseTokens('SOS SOS');
  t('词间隔 7 单位', tk2.filter((x) => x.type === 'gap' && x.units === 7).length === 1);
  const sig = Synth.morseSignal('ET', 22050, { dot: 0.05, freq: 1000 });
  const spans = toneSpans(sig, 0.02);
  const onsetGap = spans.length === 2 ? spans[1][0] - spans[0][0] : 0;
  t('摩斯音频：点划起音间隔 = 4 单位 (0.2s)', Math.abs(onsetGap / 22050 - 0.2) < 0.005);
  t('摩斯音频：划明显长于点（≈3 倍）', spans.length === 2 && spans[1][1] > spans[0][1] * 2.5);
}

// ---------- 合成器回归 ----------
console.log('[synth 回归]');
t('sine 首样本为 0（无起始爆音）', Synth.sine(440, 1000, 22050)[0] === 0);
t('sine 末样本为 0（无收尾爆音）', Math.abs(Synth.sine(440, 1000, 22050)[999]) < 1e-9);
{
  const r1 = Synth.rng(7), r2 = Synth.rng(7), r3 = Synth.rng(8);
  const a = [r1(), r1(), r1()], b = [r2(), r2(), r2()];
  t('rng 同 seed 完全一致', a.every((v, i) => v === b[i]));
  t('rng 不同 seed 不同', a[0] !== r3());
  t('rng 落在 [0,1)', a.every((v) => v >= 0 && v < 1));
}
t('resample 空输入返回空数组', Synth.resample(new Float32Array(0), 22050, 8000).length === 0);
t('FONT5X7 每个字形都是 7 行 × 5 列且只含 0/1',
  Object.keys(Synth.FONT5X7).every((k) => {
    const g = Synth.FONT5X7[k];
    return g.length === 7 && g.every((row) => row.length === 5 && /^[01]{5}$/.test(row));
  }));
t('fontToColumns 掩码与字形一致（E 第 2 列 → 第 0/3/6 行点亮）',
  Synth.fontToColumns('E')[1] === ((1 << 0) | (1 << 3) | (1 << 6)));
{
  // 频谱文字的"笔画"频率：E 第 2 列应只有 700/1150/1600Hz 有能量
  const img = Synth.fontToneImage('E', 22050, { colDur: 0.045, fBase: 700, fStep: 150 });
  const sr = 22050;
  const i0 = Math.floor(0.05 * sr), i1 = Math.floor(0.088 * sr);
  const powerAt = (f) => {
    let re = 0, im = 0;
    for (let i = i0; i < i1; i++) {
      const w = 2 * Math.PI * f / sr;
      re += img[i] * Math.cos(w * i);
      im += img[i] * Math.sin(w * i);
    }
    const n = i1 - i0;
    return (re * re + im * im) / (n * n);
  };
  const lit = [700, 1150, 1600].map(powerAt);
  const dark = [850, 1000, 1300, 1450].map(powerAt);
  t('频谱文字：点亮的行有能量、未点亮的行几乎无能量',
    Math.min.apply(null, lit) > 100 * Math.max.apply(null, dark));
}

// ---------- 语音采样率（decodeAudioData 会重采样到设备采样率） ----------
console.log('[语音采样率]');
{
  const raw = wavToF32(require(path.join(__dirname, '..', 'js', 'voices.js')).VOICE_ASSETS.case2);
  const up = Synth.resample(raw, 22050, 48000); // 模拟 48kHz 设备解码结果
  const back = Cases.prepareVoice(up, 48000);
  t('prepareVoice(48kHz→22050) 时长一致',
    Math.abs(back.length - raw.length) <= raw.length * 0.01);
  t('prepareVoice(48kHz→22050) 波形相关 > 0.99',
    corr(back, raw, 0, Math.min(back.length, raw.length)) > 0.99);
  t('prepareVoice 对 22050 源零拷贝', Cases.prepareVoice(raw, 22050) === raw);
  const c = Cases.CASES.case1;
  const at22 = Cases.buildCaseAudio(c, { case1: raw }, 22050);
  const at48 = Cases.buildCaseAudio(c, { case1: up }, 48000);
  const i0 = Math.floor(2.5 * c.sr), i1 = Math.floor(6.5 * c.sr);
  t('case1 语音段与采样率无关（相关 > 0.9）', corr(at22, at48, i0, i1) > 0.9);
  t('case1 采样率无关且长度一致', at22.length === at48.length);
}
{
  const dv = {
    case1: Synth.noise(22050, 1), case2: Synth.noise(22050, 2), case6: Synth.noise(22050, 3),
  };
  const a = Cases.buildCaseAudio(Cases.CASES.case2, dv);
  const b = Cases.buildCaseAudio(Cases.CASES.case2, dv);
  t('case2 两次合成完全一致（确定性，无 Math.random）', a.every((v, i) => v === b[i]));
}

// ---------- 播放引擎 ----------
console.log('[播放引擎]');
{
  const mc = mockAudioContext(48000);
  const lab = new AudioLab(mc);
  lab.setClip(mc.createBuffer(1, 18 * 48000, 48000));
  t('duration 取素材时长', lab.duration === 18);
  lab.play();
  mc.advance(4.5);
  t('1x 播放 4.5s → 进度 0.250', Math.abs(lab.getFrac() - 0.25) < 1e-9);
  lab.setSpeed(0.5);
  t('变速瞬间进度不跳变', Math.abs(lab.getFrac() - 0.25) < 1e-9);
  mc.advance(4.5);
  t('变速后按新速度推进 → 0.375', Math.abs(lab.getFrac() - 0.375) < 1e-9);
  lab.setSpeed(2);
  mc.advance(1.5);
  t('再次变速 → 0.542', Math.abs(lab.getFrac() - 1 / 3 + 1.5 * 2 / 18 - 1 / 3) < 1e-9 || Math.abs(lab.getFrac() - 0.5417) < 1e-3);
  lab.pause();
  const frozen = lab.getFrac();
  mc.advance(5);
  t('暂停后进度冻结', lab.getFrac() === frozen);
  lab.seekFrac(0.8);
  t('seekFrac 设置进度', Math.abs(lab.frac - 0.8) < 1e-9);
  lab.play();
  t('seekFrac 后从该位置继续', Math.abs(lab.getFrac() - 0.8) < 1e-9);
  lab.src.onended();
  t('播放结束释放 source 且 playing=false', lab.src === null && lab.playing === false);
  lab.setLoop(true);
  t('结束后再开循环不会打到死节点', lab.src === null && lab.loop === true);
}
{
  const mc = mockAudioContext(22050);
  const lab = new AudioLab(mc);
  const buf = mc.createBuffer(1, 22050, 22050);
  lab.setClip(buf);
  lab.setReversed(true);
  const r1 = lab._activeBuffer();
  t('倒放缓冲被缓存', lab._activeBuffer() === r1);
  const mc2 = mockAudioContext(22050);
  const lab2 = new AudioLab(mc2);
  const b2 = mc2.createBuffer(1, 4, 22050);
  b2.getChannelData(0).set([1, 2, 3, 4]);
  lab2.setClip(b2);
  lab2.setReversed(true);
  const rev = lab2._activeBuffer().getChannelData(0);
  t('倒放缓冲逐样本反向', rev[0] === 4 && rev[1] === 3 && rev[2] === 2 && rev[3] === 1);
  lab2.setClip(b2);
  t('setClip 后倒放缓存失效', lab2._activeBuffer() !== rev);
  lab2.setGate(0.2, true);
  // 每次都重新取当前曲线（setGate 会替换整个 curve 数组）
  const at = (x) => {
    const c = lab2.gate.curve;
    return c[Math.round((x + 1) / 2 * (c.length - 1))];
  };
  t('去噪门：低于阈值压到 3%', Math.abs(at(0.1) - 0.003) < 1e-3);
  t('去噪门：高于阈值原样通过', Math.abs(at(0.5) - 0.5) < 1e-3);
  lab2.setGate(0.2, false);
  t('去噪门关闭后为直通', Math.abs(at(0.1) - 0.1) < 1e-3);
  lab2.setMasterDb(-6);
  t('音量 -6dB ≈ 0.501', Math.abs(lab2.master.gain.value - Math.pow(10, -6 / 20)) < 1e-9);
  lab2.setBoostDb(20);
  t('放大 +20dB ≈ 10x', Math.abs(lab2.boost.gain.value - 10) < 1e-9);
}

// ---------- 频谱 / 波形视图 ----------
console.log('[频谱 / 波形视图]');
{
  const sr = 22050, BINS = LabViews.BINS;
  t('freqToBin 用 Nyquist 映射：3000Hz → bin 139', LabViews.freqToBin(3000, sr, BINS) === 139);
  t('freqToBin 满量程 → 末 bin', LabViews.freqToBin(sr / 2, sr, BINS) === BINS - 1);
  t('freqToBin/binToFreq 往返误差 ≤ 1 个 bin',
    [100, 700, 1500, 3000, 8000].every((f) =>
      Math.abs(LabViews.binToFreq(LabViews.freqToBin(f, sr, BINS), sr, BINS) - f) <= sr / LabViews.FFT_N));
  t('44.1kHz 下 17.5kHz 也能定位到正确 bin',
    Math.abs(LabViews.binToFreq(LabViews.freqToBin(17500, 44100, BINS), 44100, BINS) - 17500) <= 44100 / LabViews.FFT_N);

  // FFT 频率精度：峰值 bin 与理论 bin 相差不超过 1
  const specFull = new LabViews.SpectroView(mockCanvas(200, 120), { sampleRate: sr }, { pxPerSec: 90 });
  const ring = mockRing(4096, 4096);
  for (let i = 0; i < 4096; i++) ring.buf[i] = 0.01 * Math.sin(2 * Math.PI * 2000 * i / sr);
  const col = specFull._column(ring, 4096);
  let peak = 0;
  for (let k = 0; k < BINS; k++) if (col[k] > col[peak]) peak = k;
  t('FFT 峰值 bin 正确（2000Hz → bin 93±1）', Math.abs(peak - 2000 * LabViews.FFT_N / sr) <= 1);

  // 0–3kHz 放大视图：3000Hz 音必须画在视图顶部（修复前会被画到中部）
  const specZoom = new LabViews.SpectroView(mockCanvas(200, 200), { sampleRate: sr },
    { pxPerSec: 90, fMax: 3000 });
  const ringZ = mockRing(4096, 4096);
  for (let i = 0; i < 4096; i++) ringZ.buf[i] = 0.01 * Math.sin(2 * Math.PI * 3000 * i / sr);
  specZoom.pushColumn(ringZ, 4096);
  const litZ = litRows(specZoom, 0);
  t('0–3kHz 视图：3000Hz 音画在顶部而非中部', litZ.length > 0 && litZ[0] <= 6);

  // 波形纵向跨度（修复前采样值未换算字节域 → 底部一条线）
  const wave = new LabViews.WaveView(mockCanvas(200, 100), { sampleRate: sr }, { pxPerSec: 90 });
  const ringW = mockRing(4096, 4096);
  for (let i = 0; i < 4096; i++) ringW.buf[i] = 0.9 * Math.sin(2 * Math.PI * 440 * i / sr);
  wave.pushColumn(ringW, 4096);
  const litW = litRows(wave, 0);
  t('波形纵向跨度 > 60% 画布高', litW.length > 0 && (litW[litW.length - 1] - litW[0]) > 60);

  // 增量重绘必须与全量重绘逐像素一致
  const specInc = new LabViews.SpectroView(mockCanvas(160, 100), { sampleRate: sr }, { pxPerSec: 90 });
  const ringI = mockRing(4096, 4096);
  for (let n = 0; n < 260; n++) {
    for (let i = 0; i < 4096; i++) ringI.buf[i] = 0.02 * Math.sin(2 * Math.PI * (400 + n * 20) * i / sr);
    ringI.total += 245;
    ringI.pos = (ringI.pos + 245) % ringI.length;
    specInc.pushColumn(ringI, ringI.total);
  }
  const incremental = Buffer.from(specInc.img.data.buffer.slice(0));
  specInc._paint();
  t('频谱增量重绘 == 全量重绘', incremental.equals(Buffer.from(specInc.img.data.buffer.slice(0))));

  const waveInc = new LabViews.WaveView(mockCanvas(160, 100), { sampleRate: sr }, { pxPerSec: 90 });
  const ringJ = mockRing(4096, 4096);
  for (let n = 0; n < 260; n++) {
    for (let i = 0; i < 4096; i++) ringJ.buf[i] = 0.5 * Math.sin(2 * Math.PI * 300 * i / sr);
    ringJ.total += 245;
    ringJ.pos = (ringJ.pos + 245) % ringJ.length;
    waveInc.pushColumn(ringJ, ringJ.total);
  }
  const waveIncBefore = Buffer.from(waveInc.img.data.buffer.slice(0));
  waveInc._paint();
  t('波形增量重绘 == 全量重绘', waveIncBefore.equals(Buffer.from(waveInc.img.data.buffer.slice(0))));
}

// ---------- 列率由采样时钟驱动 ----------
console.log('[采样时钟]');
{
  const sr = 22050;
  const mc = mockAudioContext(sr);
  const views = new LabViews(mockCanvas(400, 100), mockCanvas(400, 100), { connect() {} }, mc);
  t('ScriptProcessor 可用时示波器就绪', views.scopeAvailable === true);
  // 先喂满一帧让采样游标初始化，再精确推进 1 秒音频（60 帧 × 368/367 = 22050）
  views.ring.total = 4096;
  views.ring.pos = 4096 % views.ring.length;
  views._tick();
  const before = views.spec.hist.length;
  for (let f = 0; f < 60; f++) {
    const n = f % 2 === 0 ? 368 : 367;
    views.ring.total += n;
    views.ring.pos = (views.ring.pos + n) % views.ring.length;
    views._tick();
  }
  const cols = views.spec.hist.length - before;
  t('1 秒音频产出 90 列（= pxPerSec，与帧率解耦）实测 ' + cols, cols === 90);
  const paused = views.spec.hist.length;
  for (let i = 0; i < 30; i++) views._tick();
  t('无新音频时不产列（暂停时画面不滚动）', views.spec.hist.length === paused);

  // ScriptProcessorNode 缺失 → 降级但不影响音频播放
  const mc2 = mockAudioContext(sr);
  mc2.createScriptProcessor = undefined;
  const views2 = new LabViews(mockCanvas(100, 100), mockCanvas(100, 100), { connect() {} }, mc2);
  t('ScriptProcessorNode 缺失时优雅降级', views2.scopeAvailable === false);
  views2._tick();
  t('降级模式下 _tick 不报错', views2.spec.hist.length === 0);
}

console.log('');
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
