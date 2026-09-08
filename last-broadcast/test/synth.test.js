/* LASTBROADCAST · 合成器（js/synth.js）测试：音频上下文生命周期 / 节点回收 / 无音频环境兜底 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { makeFakeAudio, sleep } = require('./_audio.js');

const SYNTH = path.resolve(__dirname, '../js/synth.js');

// 每个用例都用全新的模块实例（模块内持有 ctx / 定时器状态）
function freshSynth(opts) {
  opts = opts || {};
  const fake = makeFakeAudio();
  const prev = global.window;
  global.window = {};
  if (!opts.noAudio) global.window.AudioContext = fake.FakeAudioContext;
  delete require.cache[SYNTH];
  const synth = require(SYNTH);
  return { synth, fake, restore: () => { global.window = prev; } };
}

test('无 AudioContext 的环境（旧浏览器/被禁用）不抛错，全部接口安全降级', () => {
  const { synth, restore } = freshSynth({ noAudio: true });
  try {
    assert.doesNotThrow(() => {
      synth.ensure();
      synth.setVolume(0.5);
      synth.setNoise(0.2);
      synth.setAmbient({ gain: 0.1, filterFreq: 600, lfoRate: 0.2 });
      synth.startMusic('starlet');
      synth.ring();
      synth.stopMusic();
      synth.ambientOff();
      synth.cleanup();
    });
    assert.strictEqual(synth.vuLevel(), 0);
    assert.strictEqual(synth.waveform(), null);
  } finally { restore(); }
});

test('cleanup 挂起后再次 ensure 会恢复上下文（重播/切回标签页不再永久静音）', () => {
  const { synth, fake, restore } = freshSynth();
  try {
    synth.ensure();
    assert.strictEqual(fake.log.ctx.state, 'running');
    synth.cleanup();
    assert.strictEqual(fake.log.ctx.state, 'suspended');
    synth.ensure();
    assert.strictEqual(fake.log.ctx.state, 'running', 'ensure() 必须 resume 已存在的上下文');
    // 反复 cleanup/ensure 不重复创建上下文
    synth.cleanup(); synth.ensure(); synth.cleanup(); synth.ensure();
    assert.strictEqual(fake.log.ctx.state, 'running');
    assert.strictEqual(fake.log.created.filter(n => n.kind === 'destination').length, 1);
  } finally { restore(); }
});

test('上下文建立之前设置的音量/底噪会被记住并生效', () => {
  const { synth, fake, restore } = freshSynth();
  try {
    synth.setVolume(0.35);      // 还没 ensure
    synth.setNoise(0.2);
    synth.ensure();
    const gains = fake.log.created.filter(n => n.kind === 'gain');
    // ensure() 里的创建顺序：master -> noiseGain -> humGain -> musicGain
    assert.strictEqual(gains[0].gain.value, 0.35, 'master 音量应使用存档里的值');
    assert.strictEqual(gains[1].gain.value, 0.2, '底噪应使用 setNoise 的值');
    synth.setVolume(0.8);
    assert.strictEqual(gains[0].gain.value, 0.8);
  } finally { restore(); }
});

test('每个音符用完后断开节点（避免整夜累积上千个 Web Audio 节点）', async () => {
  const { synth, fake, restore } = freshSynth();
  try {
    synth.ensure();
    synth.startMusic('steelheart');   // 有鼓点，覆盖 playTone / playKick / playHat
    for (let i = 0; i < 25; i++) { fake.advance(0.05); await sleep(8); }
    synth.stopMusic();

    const sounding = fake.log.created
      .filter(n => (n.kind === 'oscillator' || n.kind === 'bufferSource') && n._stopped);
    assert.ok(sounding.length > 5, '应调度出若干音符，实际 ' + sounding.length);
    sounding.forEach(n => {
      assert.strictEqual(typeof n.onended, 'function', n.kind + ' 应设置 onended 以回收节点');
    });
    // 触发所有 onended：每个发声节点都必须断开
    sounding.forEach(n => n.onended());
    const leaked = sounding.filter(n => !n.disconnected);
    assert.strictEqual(leaked.length, 0, '仍有 ' + leaked.length + ' 个节点没断开');
    // 底噪/环境音的常驻节点不属于"每音符回收"范围
  } finally { restore(); }
});

test('鼓点噪声 buffer 只生成一次（不再每拍分配新 AudioBuffer）', async () => {
  const { synth, fake, restore } = freshSynth();
  try {
    synth.ensure();
    const before = fake.log.buffers.length;
    synth.startMusic('steelheart');
    for (let i = 0; i < 30; i++) { fake.advance(0.05); await sleep(8); }
    synth.stopMusic();
    const hatBuffers = fake.log.buffers.slice(before).filter(b => b.length === Math.floor(48000 * 0.05));
    assert.strictEqual(hatBuffers.length, 1, '鼓点 buffer 应被缓存复用，实际创建 ' + hatBuffers.length + ' 次');
  } finally { restore(); }
});

test('同一首歌重复播放不重复展开曲谱（曲谱 memo）', () => {
  const scoresPath = require.resolve('../js/shared/scores.js');
  const scores = require(scoresPath);
  const orig = scores.melodyTrack;
  let calls = 0;
  scores.melodyTrack = function (m) { calls++; return orig(m); };
  const { synth, restore } = freshSynth();
  try {
    synth.ensure();
    synth.startMusic('starlet');
    synth.startMusic('nightstar');
    synth.startMusic('starlet');
    synth.startMusic('nightstar');
    synth.stopMusic();
    assert.strictEqual(calls, 2, '两首歌各展开一次，实际 ' + calls);
  } finally {
    scores.melodyTrack = orig;
    restore();
  }
});

test('startMusic 播放未知曲目 / 停止后调度器不再发声', async () => {
  const { synth, fake, restore } = freshSynth();
  try {
    synth.ensure();
    assert.doesNotThrow(() => synth.startMusic('not-a-song'));
    synth.startMusic('starlet');
    await sleep(60);
    synth.stopMusic();
    const n = fake.log.created.length;
    await sleep(80);
    assert.strictEqual(fake.log.created.length, n, 'stopMusic 后不应再创建节点');
    synth.cleanup();
  } finally { restore(); }
});
