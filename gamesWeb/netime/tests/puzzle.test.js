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
  // 已解锁后再次提交也应成功（信号页可反复打开）
  const again = P.submitPassword('网络之声');
  assert(again.ok, '已解锁后再次提交口令也应视为成功');
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

/* ---------- 存档健壮性：损坏 / 不可用的 localStorage ---------- */

function withStore(store, fn) {
  const prev = global.localStorage;
  global.localStorage = store;
  try { fn(); } finally { global.localStorage = prev; }
}

function fakeStore(raw) {
  return {
    getItem: function () { return raw; },
    setItem: function () {},
    removeItem: function () {}
  };
}

test('存档：字段类型损坏时被清洗，游戏仍可玩', function () {
  ['{"clues":null}', '{"clues":{"a":1}}', '{"eraUnlocked":null}', '{"keysFound":"网"}',
   '{"achievements":"key1"}', '{"notes":null}', '{"hintsUsed":null}', '{"visitedPages":null}'
  ].forEach(function (raw) {
    withStore(fakeStore(raw), function () {
      const st = P.init();
      assert(Array.isArray(st.clues), 'clues 应被清洗成数组: ' + raw);
      assert(Array.isArray(st.achievements), 'achievements 应被清洗成数组: ' + raw);
      assert(Array.isArray(st.notes), 'notes 应被清洗成数组: ' + raw);
      assert(st.eraUnlocked && st.eraUnlocked['1995'] === true, '第一段年代应始终解锁: ' + raw);
      P.addClue({ id: 'x', era: '1995', clue: { id: 'cx', title: 'T', text: 'X' } });
      P.addNote('仍然能写笔记');
      P.useHint('1995');
      assert(P.submitKey('1995', '网').ok, '密钥校验仍应可用: ' + raw);
    });
  });
});

test('存档：非法 JSON / 非对象内容回退默认进度', function () {
  ['{not json', '[1,2,3]', 'null', '"text"', '123'].forEach(function (raw) {
    withStore(fakeStore(raw), function () {
      const st = P.init();
      assertEq(st.version, 1);
      assertEq(JSON.stringify(st.achievements), '[]');
      assert(!P.isEraUnlocked('2000'));
      assertEq(st.clues.length, 0);
    });
  });
});

test('存档：localStorage 抛错（隐私模式/配额）时不影响游戏', function () {
  withStore({
    getItem: function () { throw new Error('SecurityError'); },
    setItem: function () { throw new Error('QuotaExceededError'); },
    removeItem: function () { throw new Error('SecurityError'); }
  }, function () {
    P.init();
    P.save();
    P.addNote('内存里也能记');
    assertEq(P.state.notes.length, 1);
    P.reset();
    assertEq(P.state.notes.length, 0);
  });
});

test('存档：localStorage 完全不存在时降级为内存态', function () {
  const prev = global.localStorage;
  delete global.localStorage;
  try {
    P.init();
    P.addNote('内存态');
    assertEq(P.state.notes.length, 1);
    P.save();
  } finally { global.localStorage = prev; }
});

test('存档：未知字段被丢弃，合法字段保留', function () {
  withStore(fakeStore(JSON.stringify({
    version: 1, eraUnlocked: { '1995': true, '2000': true }, achievements: ['source'], 注入字段: 'x'
  })), function () {
    const st = P.init();
    assertEq(st.注入字段, undefined);
    assert(P.isEraUnlocked('2000'), '合法解锁状态应保留');
    assert(P.hasAchievement('source'), '合法成就应保留');
  });
});

test('密钥：未解锁的年代不能提交密钥', function () {
  P.reset();
  const res = P.submitKey('2005', '之');
  assert(!res.ok, '未解锁年代应拒绝');
  assert(!P.isEraUnlocked('2010'), '不应解锁后续年代');
  assert(!P.hasAchievement('key3'), '不应发放成就');
});
