const { test } = require('node:test');
const assert = require('node:assert');
const scores = require('../js/shared/scores.js');
const data = require('../js/shared/data.js');

test('31 首歌全部有合法曲谱（旋律 16 拍 / 和弦可解析 / 速度合理）', () => {
  assert.strictEqual(Object.keys(scores.SCORES).length, data.SONGS.length);
  data.SONGS.forEach(s => {
    assert.ok(scores.SCORES[s.id], '缺谱：' + s.id);
    assert.ok(scores.validScore(scores.SCORES[s.id]), '谱子非法：' + s.id);
  });
});
test('音符与和弦工具正确', () => {
  assert.ok(Math.abs(scores.noteFreq('A4') - 440) < 0.01);
  assert.ok(Math.abs(scores.noteFreq('C4') - 261.63) < 1);
  const c = scores.chordNotes('Cmaj7', 3);
  assert.strictEqual(c.length, 4);
  const d = scores.chordNotes('Dm', 3);
  assert.strictEqual(d.length, 3);
  assert.ok(d[1] > d[0] && d[2] > d[1]);
});
test('旋律展开为 64 个 16 分音符', () => {
  data.SONGS.forEach(s => {
    const t = scores.melodyTrack(scores.SCORES[s.id].melody, scores.SCORES[s.id].bpm);
    assert.strictEqual(t.totalSteps, 64, s.id + ' 旋律应共 16 拍');
    assert.ok(Object.keys(t.map).length >= 4, s.id + ' 至少 4 个音符');
  });
});
test('UMD：浏览器式全局可加载 scores', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const sandbox = { console: { warn: () => {} }, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  vm.createContext(sandbox);
  vm.runInContext('self = globalThis; window = globalThis;', sandbox);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/shared/scores.js'), 'utf8'), sandbox, { filename: 'scores.js' });
  assert.ok(sandbox.LB && sandbox.LB.scores);
  assert.ok(sandbox.LB.scores.SCORES['starlet']);
});
