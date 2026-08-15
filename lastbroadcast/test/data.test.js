const { test } = require('node:test');
const assert = require('node:assert');
const data = require('../js/shared/data.js');

test('数据完整性：角色/歌曲/来电 ID 唯一且互相关联', () => {
  const ids = data.CHARACTERS.map(c => c.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  const songIds = data.SONGS.map(s => s.id);
  assert.strictEqual(new Set(songIds).size, songIds.length);
  data.CALLS.forEach(c => {
    assert.ok(ids.includes(c.caller), '来电者必须存在: ' + c.caller);
    assert.ok(c.turn >= 0 && c.turn < data.TURNS.length);
    if (c.request) assert.ok(songIds.includes(c.request), '点播歌曲必须存在: ' + c.request);
    assert.ok(c.missed, '每个来电都应有错过提示');
  });
});
test('31 首歌（含隐藏曲）/ 15 位听众 / 6 结局 / 12×3 插曲变体 / 支线 / 考据', () => {
  assert.strictEqual(data.SONGS.length, 31);
  assert.ok(data.SONGS.some(s => s.id === 'memorial' && s.hidden));
  assert.strictEqual(data.CHARACTERS.length, 15);
  assert.strictEqual(Object.keys(data.ENDINGS).length, 6);
  assert.strictEqual(data.TURN_INTERLUDES.length, 12);
  data.TURN_INTERLUDES.forEach(row => assert.ok(Array.isArray(row) && row.length === 3, '每回合 3 个变体'));
  assert.ok(data.ARCS.length >= 12);
  assert.ok(data.WORLD_NOTES && data.WORLD_NOTES.frequencyX);
});
test('限定歌曲带 unlockTurn 且引用有效', () => {
  data.SONGS.filter(s => s.unlockTurn != null).forEach(s => {
    assert.ok(s.unlockTurn >= 0 && s.unlockTurn < 12);
  });
  assert.ok(data.SONGS.some(s => s.id === 'march' && s.unlockTurn === 5));
  assert.ok(data.SONGS.some(s => s.id === 'finalwaltz' && s.unlockTurn === 11));
});
test('每首歌都有标签与情绪效果', () => {
  data.SONGS.forEach(s => {
    assert.ok(s.tags.length > 0);
    assert.strictEqual(typeof s.hope, 'number');
    assert.strictEqual(typeof s.mood, 'number');
  });
});
test('双来电回合存在（T3/T6/T9/T10）', () => {
  const turns = {};
  data.CALLS.forEach(c => { turns[c.turn] = (turns[c.turn] || 0) + 1; });
  [3, 6, 9, 10].forEach(t => assert.ok(turns[t] >= 2, '回合 ' + t + ' 应有至少两个来电'));
});
