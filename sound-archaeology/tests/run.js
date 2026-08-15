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

console.log('');
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
