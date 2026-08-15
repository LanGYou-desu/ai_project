'use strict';
// ============================================================
// 声音考古学 · 案件档案
// 每个案件包含：剧情 / 物证 / 提示 / 答案 / 考古笔记
// 以及 build() —— 在浏览器端程序化合成该案的音频证据
// ============================================================

const CASES = {
  case1: {
    id: 'case1',
    code: 'CASE-01',
    title: '雨夜留言',
    tag: '低通滤波 · 初试仪器',
    sr: 8000,
    duration: 18,
    question: '录音里提到的接头暗号是什么？',
    accepts: ['蓝鲸'],
    answerLabel: '蓝鲸',
    backstory: [
      '凌晨 2:17，暴雨。市民在海滨长椅下发现一部手机，屏幕还亮着，停在通话录音界面。',
      '报案人说：「里面好像有人在说话，但雨声太大了，听不清。」',
      '你把录音导入实验室。雨声几乎淹没了一切——但你相信，声音里没有真正的秘密。',
    ],
    evidence: [
      { label: '物证 A-01', text: '手机通话录音 · 8kHz 电话音质 · 约 18 秒' },
      { label: '物证 A-02', text: '现场照片：海滨长椅，湿透的黑色手机' },
    ],
    hints: [
      '雨声是高频嘶声，人声集中在中低频段。',
      '试试「低通」滤波器，把频率上限压到 1000~1500Hz，雨声会明显退场。',
      '听完后还可以用「放大」把音量拉起来——答案是两个字的暗号。',
    ],
    note: '雨声在频谱上铺满整个频段，而人声的能量集中在中低频。用低通滤波器切掉高频，雨声立刻退场，人声浮出水面。这是音频取证的第一课：滤掉你不关心的频段。',
  },

  case2: {
    id: 'case2',
    code: 'CASE-02',
    title: '倒放的摇篮曲',
    tag: '倒放 · 方向感',
    sr: 22050,
    duration: 18,
    question: '录音里提到的藏匿地点是？',
    accepts: ['老钟楼地下二层', '地下二层', '老钟楼', '钟楼'],
    answerLabel: '老钟楼地下二层',
    backstory: [
      '旧码头七号仓库。巡夜人在角落里找到一台老式收音机，循环播放着一首摇篮曲。',
      '「听着挺温馨的，」巡夜人挠头，「但总觉得哪里不对。」',
      '你戴上耳机听了一会儿，发现旋律的方向感是反的。就像……有人把磁带装反了。',
    ],
    evidence: [
      { label: '物证 B-01', text: '老式收音机录音 · 22kHz 采样 · 约 18 秒' },
      { label: '物证 B-02', text: '仓库台账：七号仓，封存物品清单（残缺）' },
    ],
    hints: [
      '摇篮曲的旋律听起来「倒退」——它可能真的是倒放的。',
      '试试「倒放」开关。倒过来之后，旋律恢复正常，而混在里面的一段低语会正向播放。',
      '低语提到的地点，和仓库的封存清单有关。',
    ],
    note: '整段录音是倒放的：摇篮曲倒放后旋律复原，而藏在里面的「低语」原本是倒着录的，倒放之后反而正向——那才是真正的内容。记住：声音的方向，是可以被伪造的。',
  },

  case3: {
    id: 'case3',
    code: 'CASE-03',
    title: '幽灵频谱',
    tag: '频谱图 · 用眼睛听',
    sr: 22050,
    duration: 14,
    question: '磁带频谱里藏着什么图案？',
    accepts: ['b7', 'b七'],
    answerLabel: 'B-7',
    backstory: [
      '老钟楼的地下二层，只有一口废弃的钟，和一个铁皮箱。',
      '箱子里是一盘磁带，标签写着「B-7」。磁带播放时只有单调的嗡嗡声，像某种仪式。',
      '但你的频谱仪告诉你：它不只是一盘噪音。有人把东西「画」进了声音里。',
    ],
    evidence: [
      { label: '物证 C-01', text: '铁皮箱内磁带 · 22kHz 采样 · 约 14 秒' },
      { label: '物证 C-02', text: '磁带标签手写体：「B-7」' },
    ],
    hints: [
      '把声音的「频率—时间」展开成二维图，就是频谱图。盯着它看。',
      '频谱图里有一段规律出现的明亮图案——那是有人用不同频率的短音「画」出来的字。',
      '图案反复出现了好几组，每组都是一个编号。',
    ],
    note: '声音的频率随时间变化，展开成二维图就是频谱图。有人把文字画进了频谱：每一笔都是一串不同频率的短音，肉眼直接可读。记住——眼睛，也是音频取证的工具。',
  },

  case4: {
    id: 'case4',
    code: 'CASE-04',
    title: '深夜摩斯',
    tag: '摩斯电码 · 市电干扰',
    sr: 22050,
    duration: 20,
    question: '音乐盒发出的电码在说什么？',
    accepts: ['midnight'],
    answerLabel: 'MIDNIGHT',
    backstory: [
      '地铁 B-7 出口的储物柜里，躺着一个老音乐盒。',
      '音乐盒没有旋律，只有规律的「嗒——嗒嗒——」声，背景是沉闷的电流轰鸣。',
      '这声音太有规律了。规律到不像巧合，像一种语言。',
    ],
    evidence: [
      { label: '物证 D-01', text: '音乐盒录音 · 22kHz 采样 · 约 20 秒' },
      { label: '物证 D-02', text: '储物柜编号：B-7（与磁带标签一致）' },
    ],
    hints: [
      '背景的轰鸣是 50Hz 市电干扰——用「高通」滤波器把它滤掉。',
      '短音是「点」，长音是「划」。用摩斯辅助器把听到的点划转写下来。',
      '音乐盒里的电码在说一个时间相关的英文单词。',
    ],
    note: '摩斯电码：短音=点，长音=划，点划间隔 1 单位，字母间 3 单位。背景的 50Hz 轰鸣是市电干扰，高通滤波即可剥离。把所有线索拼起来：暗号「蓝鲸」指向码头，码头指向钟楼，钟楼指向 B-7——而 B-7 的答案，是 MIDNIGHT。',
  },

  case5: {
    id: 'case5',
    code: 'CASE-05',
    title: '无声的尖叫',
    tag: '超声频段 · 换个速度',
    sr: 44100,
    duration: 14,
    question: '这段听不见的信号在说什么？',
    accepts: ['sos', '求救', '求救信号'],
    answerLabel: 'SOS',
    backstory: [
      '午夜零时，废弃广播塔的机房突然自行通电，向全城发射了一段「安静」的信号。',
      '没有人能听见它。但机器记录到了：信号确实存在，只是超出了人耳的边界。',
      '频谱图上，有什么东西在尖叫。',
    ],
    evidence: [
      { label: '物证 E-01', text: '机房监控录音 · 44.1kHz 采样 · 约 14 秒' },
      { label: '物证 E-02', text: '电力记录：发射塔午夜 0:00 自动通电 14 秒' },
    ],
    hints: [
      '人耳上限约 20kHz——这段信号在 17kHz 附近，频谱图里能看到它。',
      '把播放速度调到 0.25 倍：17kHz 会降到 4.3kHz，变成人耳能听到的声音。',
      '慢下来之后，它是某种国际通用的求救信号。',
    ],
    note: '人耳上限约 20kHz，这段信号在 17.5kHz——「听不见」不代表「不存在」。频谱图让超声变得可见；或者把速度降到 0.25 倍，17.5kHz 就落到 4.3kHz 的可听范围。人类的耳朵，只是需要换个速度。',
  },

  case6: {
    id: 'case6',
    code: 'CASE-06',
    title: '幽灵频率 · 终局',
    tag: '组合技 · 最后一夜',
    sr: 22050,
    duration: 22,
    question: '沉没的科考船叫什么名字？',
    accepts: ['回声号', 'echo'],
    answerLabel: '回声号 (ECHO)',
    backstory: [
      '所有线索指向同一件事：四十年前的今夜，科考船「回声号」在旧码头外的海域沉没，全员失踪。',
      '此后每一年的今夜，那座广播塔都会自动苏醒，向城市发送一段没人听得懂的信号。',
      '这是最后一段录音。你戴上耳机，打开全部仪器——今晚，你要听懂它。',
    ],
    evidence: [
      { label: '物证 F-01', text: '最后一夜完整录音 · 22kHz 采样 · 约 22 秒' },
      { label: '物证 F-02', text: '海事档案：回声号，科考船，40 年前今夜沉没' },
    ],
    hints: [
      '你学过的每一种手段，都在今晚的录音里。',
      '倒放能听到人声；频谱图里有图案；背景电码是业余无线电的告别语。',
      '人声自报家门——船的名字，就在第一句话里。',
    ],
    note: '你倒放了最后一段录音。海声之外，一个平静的声音说：「我是回声号。谢谢你们，还记得我们。」频谱图里浮出四个字母：ECHO。摩斯电码轻声告别——73，业余无线电里「最好的祝愿」。',
    epilogue: [
      '「幽灵频率」结案。',
      '它不是入侵，不是阴谋。是一艘沉船的信标，在每年同一夜醒来，对这座城市说：我还在这里。',
      '你合上卷宗，在结案栏写下四个字：善意的回声。',
      '归档。结案。',
    ],
  },
};

const CASE_ORDER = ['case1', 'case2', 'case3', 'case4', 'case5', 'case6'];

// 答案归一化：小写、去掉所有非字母数字/汉字字符
function normalizeAnswer(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

// 合成案件音频（浏览器/Node 通用）
function buildCaseAudio(c) {
  const voices = arguments[1] || {};
  const sr = c.sr;
  switch (c.id) {
    case 'case1': return buildCase1(voices, sr);
    case 'case2': return buildCase2(voices, sr);
    case 'case3': return buildCase3(voices, sr);
    case 'case4': return buildCase4(voices, sr);
    case 'case5': return buildCase5(voices, sr);
    case 'case6': return buildCase6(voices, sr);
  }
  return new Float32Array(0);
}

// ---------- CASE-01 雨夜留言 ----------
function buildCase1(voices, sr) {
  const dur = CASES.case1.duration;
  const len = dur * sr;
  const out = new Float32Array(len);

  // 雨声（高频嘶声为主 —— 低通滤波的练习对象，带起伏）
  let rain = Synth.biquadHighpass(Synth.noise(len, 11), 1800, sr);
  rain = Synth.amplitudeMod(rain, sr, 0.13, 0.45);
  Synth.mix(out, rain, 0, 0.7);
  // 雷云低吼
  let rumble = Synth.biquadLowpass(Synth.noise(len, 22), 150, sr);
  rumble = Synth.amplitudeMod(rumble, sr, 0.05, 0.6);
  Synth.mix(out, rumble, 0, 0.15);
  // 雨滴打在听筒上的噼啪
  let drops = Synth.biquadHighpass(Synth.noise(len, 31), 2400, sr);
  drops = Synth.amplitudeMod(drops, sr, 0.09, 0.9);
  Synth.mix(out, drops, 0, 0.2);

  // 语音（被雨声淹没的关键线索），两遍
  // 语音源 22050Hz → 低通防混叠 → 降采样到 8kHz 电话音质
  // 增益校准: 语音 RMS 0.064 → 2.5x；滤波前 SNR ≈ -4dB（能听见但糊），
  // 引擎低通@1k 后雨声泄漏仅 14% → SNR ≈ +7dB（清楚）
  let voice = Synth.biquadLowpass(voices.case1, 3400, 22050);
  voice = Synth.resample(voice, 22050, sr);
  Synth.mix(out, voice, Math.floor(2.5 * sr), 2.5);
  Synth.mix(out, voice, Math.floor(9.3 * sr), 2.5);

  // 偶发闷雷
  for (const t of [6.5, 13.2]) {
    const boom = Synth.sine(52, Math.floor(1.4 * sr), sr, 0.12, 1.0);
    Synth.mix(out, boom, Math.floor(t * sr), 0.25);
  }

  return Synth.normalize(out, 0.85);
}

// ---------- CASE-02 倒放的摇篮曲 ----------
function buildCase2(voices, sr) {
  const dur = CASES.case2.duration;
  const len = dur * sr;
  const out = new Float32Array(len);

  // 摇篮曲旋律（软正弦 + 回声），播两遍
  const notes = [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33];
  let melody = new Float32Array(16 * sr);
  for (let i = 0; i < 16; i++) {
    const f = notes[i % notes.length];
    const tone = Synth.sine(f, sr, sr, 0.08, 0.3);
    Synth.mix(melody, tone, i * sr, 0.5);
  }
  melody = Synth.echo(melody, sr, 0.42, 0.42, 5);
  Synth.mix(out, melody, 0, 0.4);

  // 关键：倒放的人声（正向听是乱码，倒放听才是内容）
  // 语音源已是 22050Hz；增益校准: 语音 RMS 0.067 → 3.2x = 0.21 vs 旋律+底噪 ≈ 0.085
  const voiceRev = Synth.reverse(Synth.resample(voices.case2, 22050, sr));
  Synth.mix(out, voiceRev, Math.floor(2.5 * sr), 3.2);

  // 黑胶底噪 + 噼啪
  Synth.mix(out, Synth.biquadLowpass(Synth.noise(len, 33), 5000, sr), 0, 0.08);
  for (let i = 0; i < len; i += 700) {
    if (Math.random() < 0.35) {
      const click = Synth.sine(2500 + Math.random() * 4500, 400, sr, 0.0005, 0.0015);
      Synth.mix(out, click, i, 0.12);
    }
  }

  return Synth.normalize(out, 0.85);
}

// ---------- CASE-03 幽灵频谱 ----------
function buildCase3(voices, sr) {
  const dur = CASES.case3.duration;
  const len = dur * sr;
  const out = new Float32Array(len);

  // 房间底噪 + 50Hz 哼声（刻意压暗：让频谱图里的文字图案清晰可见）
  Synth.mix(out, Synth.biquadLowpass(Synth.noise(len, 44), 500, sr), 0, 0.015);
  Synth.mix(out, Synth.sine(50, len, sr, 0.5, 0.5), 0, 0.03);

  // 频谱文字 B-7：三组，每组重复 3 次
  const img = Synth.fontToneImage('B-7', sr, { colDur: 0.045, fBase: 700, fStep: 150, gain: 0.5 });
  for (const t0 of [0.8, 5.8, 10.8]) {
    for (let r = 0; r < 3; r++) {
      Synth.mix(out, img, Math.floor((t0 + r * 0.95) * sr), 1);
    }
  }

  return Synth.normalize(out, 0.85);
}

// ---------- CASE-04 深夜摩斯 ----------
function buildCase4(voices, sr) {
  const dur = CASES.case4.duration;
  const len = dur * sr;
  const out = new Float32Array(len);

  // 50Hz 市电轰鸣 + 低频嗡声（高通滤波的练习对象）
  Synth.mix(out, Synth.sine(50, len, sr, 0.5, 0.5), 0, 0.2);
  Synth.mix(out, Synth.biquadLowpass(Synth.noise(len, 55), 150, sr), 0, 0.5);
  // 微弱电台嘶声
  Synth.mix(out, Synth.noise(len, 66), 0, 0.05);

  // 摩斯 MIDNIGHT，两遍
  const msg = Synth.morseSignal('MIDNIGHT', sr, { freq: 1200, dot: 0.09, gain: 0.8 });
  Synth.mix(out, msg, Math.floor(1.5 * sr), 1);
  Synth.mix(out, msg, Math.floor(10.5 * sr), 1);

  return Synth.normalize(out, 0.85);
}

// ---------- CASE-05 无声的尖叫 ----------
function buildCase5(voices, sr) {
  const dur = CASES.case5.duration;
  const len = dur * sr;
  const out = new Float32Array(len);

  // 录音室空气声（压暗：让 17.5kHz 信号在频谱图中凸显）
  Synth.mix(out, Synth.noise(len, 77), 0, 0.02);
  Synth.mix(out, Synth.biquadLowpass(Synth.noise(len, 88), 400, sr), 0, 0.03);

  // 17.5kHz SOS（人耳听不见，频谱图可见；0.25 倍速后可闻）
  const msg = Synth.morseSignal('SOS', sr, { freq: 17500, dot: 0.12, gain: 0.65 });
  Synth.mix(out, msg, Math.floor(1.5 * sr), 1);
  Synth.mix(out, msg, Math.floor(7.0 * sr), 1);

  return Synth.normalize(out, 0.85);
}

// ---------- CASE-06 幽灵频率·终局 ----------
function buildCase6(voices, sr) {
  const dur = CASES.case6.duration;
  const len = dur * sr;
  const out = new Float32Array(len);

  // 海声（缓慢起伏）
  let sea = Synth.biquadLowpass(Synth.noise(len, 99), 900, sr);
  sea = Synth.amplitudeMod(sea, sr, 0.05, 0.55);
  Synth.mix(out, sea, 0, 0.45);
  let swell = Synth.biquadLowpass(Synth.noise(len, 100), 300, sr);
  swell = Synth.amplitudeMod(swell, sr, 0.11, 0.7);
  Synth.mix(out, swell, 0, 0.32);

  // 倒放的信标留言
  // 语音源已是 22050Hz；增益校准: 语音 RMS 0.05 → 4.2x = 0.21 vs 海声 ≈ 0.08
  const voiceRev = Synth.reverse(Synth.resample(voices.case6, 22050, sr));
  Synth.mix(out, voiceRev, Math.floor(2.5 * sr), 4.2);

  // 频谱文字 ECHO（两组）
  const img = Synth.fontToneImage('ECHO', sr, { colDur: 0.045, fBase: 800, fStep: 150, gain: 0.42 });
  for (const t0 of [0.5, 8.0]) {
    for (let r = 0; r < 3; r++) {
      Synth.mix(out, img, Math.floor((t0 + r * 1.0) * sr), 1);
    }
  }

  // 摩斯 73（业余无线电「最好的祝愿」）
  const msg = Synth.morseSignal('73', sr, { freq: 1500, dot: 0.1, gain: 0.45 });
  Synth.mix(out, msg, Math.floor(13.0 * sr), 1);

  return Synth.normalize(out, 0.85);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CASES, CASE_ORDER, normalizeAnswer, buildCaseAudio };
}
