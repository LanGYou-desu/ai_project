'use strict';
const P = global.NetPuzzle;
const Story = global.Story;

test('初始状态：只有 1995 解锁', function () {
  P.reset();
  assert(P.isEraUnlocked('1995'), '1995 应默认解锁');
  assert(!P.isEraUnlocked('2000'), '2000 不应解锁');
  assert(!P.isEraUnlocked('2025'), '2025 不应解锁');
});

test('错误密钥被拒绝', function () {
  P.reset();
  const res = P.submitKey('1995', '错');
  assert(!res.ok, '错误密钥应失败');
  assert(!P.isEraUnlocked('2000'));
});

test('正确密钥链：网→络→之→声 依次解锁', function () {
  P.reset();
  const order = [['1995', '网'], ['2000', '络'], ['2005', '之'], ['2010', '声']];
  order.forEach(function (pair, i) {
    const res = P.submitKey(pair[0], pair[1]);
    assert(res.ok, pair[0] + ' 密钥应通过');
    const next = order[i + 1];
    if (next) {
      assert(P.isEraUnlocked(next[0]), next[0] + ' 应已解锁');
    }
  });
  assert(P.isEraUnlocked('2025'), '2025 应已解锁');
  assert(P.hasAchievement('key1') && P.hasAchievement('key2') && P.hasAchievement('key3') && P.hasAchievement('key4'), '四个密钥成就应达成');
  assert(P.hasAchievement('era5'), '穿越五年成就应达成');
});

test('重复提交已找到的密钥被拒绝', function () {
  P.reset();
  P.submitKey('1995', '网');
  const res = P.submitKey('1995', '网');
  assert(!res.ok, '重复提交应失败');
});

test('口令：网络之声', function () {
  P.reset();
  // 解锁 2025
  ['1995', '2000', '2005', '2010'].forEach(function (era) {
    P.submitKey(era, Story.KEYS[era].char);
  });
  const bad = P.submitPassword('错误口令');
  assert(!bad.ok, '错误口令应失败');
  const good = P.submitPassword('网络之声');
  assert(good.ok, '正确口令应通过');
  assert(P.state.passwordUnlocked, 'passwordUnlocked 应为 true');
  assert(P.hasAchievement('final'), '最终成就应达成');
});

test('四枚密钥拼成口令', function () {
  const phrase = ['1995', '2000', '2005', '2010'].map(function (era) {
    return Story.KEYS[era].char;
  }).join('');
  assertEq(phrase, Story.PASSWORD, '密钥拼接应等于口令');
});

test('提示链：逐条给出，用尽返回 null', function () {
  P.reset();
  const n = Story.HINTS['1995'].length;
  for (let i = 0; i < n; i++) {
    const h = P.useHint('1995');
    assert(h, '第 ' + (i + 1) + ' 条提示应存在');
  }
  assertEq(P.useHint('1995'), null, '提示应已用尽');
});

test('线索档案：去重', function () {
  P.reset();
  const page = { id: 'x', era: '1995', clue: { id: 't1', title: 'T', text: 'X' } };
  const c1 = P.addClue(page);
  assert(c1, '首次应添加');
  const c2 = P.addClue(page);
  assertEq(c2, null, '重复应忽略');
  assertEq(P.state.clues.length, 1);
});

test('存档：保存后可恢复', function () {
  P.reset();
  P.submitKey('1995', '网');
  P.submitKey('2000', '络');
  P.award('source');
  const saved = JSON.stringify(P.state);

  // 模拟重新加载（新实例）
  P.state = P.init();
  assertEq(JSON.stringify(P.state), saved, '存档应完整恢复');
  assert(P.isEraUnlocked('2005'), '2005 应保持解锁');
  assert(P.hasAchievement('source'));
});

test('重置：清空一切', function () {
  P.reset();
  P.submitKey('1995', '网');
  P.reset();
  assert(!P.isEraUnlocked('2000'));
  assertEq(P.state.achievements.length, 0);
  assertEq(P.state.clues.length, 0);
});

test('笔记：添加与删除', function () {
  P.reset();
  const n = P.addNote('SIGMA-7 有点可疑');
  assert(n, '笔记应添加');
  assertEq(P.state.notes.length, 1);
  P.removeNote(0);
  assertEq(P.state.notes.length, 0);
});
