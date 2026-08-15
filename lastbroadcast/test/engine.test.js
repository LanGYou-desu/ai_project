const { test } = require('node:test');
const assert = require('node:assert');
const engine = require('../js/shared/engine.js');
const data = require('../js/shared/data.js');

function play(actions, seed) {
  const g = engine.createGame(seed);
  for (const a of actions) {
    const r = engine.applyAction(g, a);
    assert.ok(!r.error, '动作失败: ' + JSON.stringify(a) + ' -> ' + r.error);
    if (r.done) break;
  }
  return g;
}
const S = (songId) => ({ type: 'song', songId });
const N = (tone) => ({ type: 'news', tone });
const C = (caller) => ({ type: 'call', caller });
const SIG = (which, choice) => ({ type: 'signal', which, choice });
const SIL = { type: 'silence' };
const F = (choice) => ({ type: 'final', choice });

test('初始状态正确（含精力/种子变体）', () => {
  const g = engine.createGame('seedA');
  assert.strictEqual(g.turn, 0);
  assert.strictEqual(g.hope, 50);
  assert.strictEqual(g.djStamina, 70);
  assert.strictEqual(Object.keys(g.chars).length, 15);
  assert.ok(g.variants && Object.keys(g.variants).length === 12);
});
test('同一种子变体确定，不同种子变体不同', () => {
  const a = engine.createGame('x'), b = engine.createGame('x'), c = engine.createGame('y');
  assert.deepStrictEqual(a.variants, b.variants);
  assert.notDeepStrictEqual(a.variants, c.variants);
});

test('回合推进：12 回合后结束', () => {
  const g = engine.createGame();
  for (let i = 0; i < 11; i++) engine.applyAction(g, S('nightstar'));
  assert.strictEqual(g.turn, 11);
  const r = engine.applyAction(g, F('hope'));
  assert.strictEqual(g.done, true);
  assert.ok(engine.ending(g));
});

test('点歌联动 + 点播达成计数', () => {
  const g = engine.createGame();
  engine.applyAction(g, S('nightstar'));
  engine.applyAction(g, N('neutral'));
  engine.applyAction(g, C('xiaoyu'));
  assert.strictEqual(g.pendingRequest.songId, 'starlet');
  engine.applyAction(g, S('starlet'));
  assert.strictEqual(g.flags.requestsFulfilled, 1);
  assert.ok(g.log.some(l => l.text.includes('等到了那首歌')));
});

test('听众支线：摇篮曲触发小雨支线', () => {
  const g = engine.createGame();
  engine.applyAction(g, S('starlet')); // lullaby → xiaoyu arc
  assert.ok(g.log.some(l => l.text.includes('小雨') && l.text.includes('最好的朋友')));
});

test('未接来电会留下错过提示', () => {
  const g = engine.createGame();
  for (let i = 0; i < 3; i++) engine.applyAction(g, N('neutral'));
  engine.applyAction(g, C('daye'));
  assert.ok(g.log.some(l => l.text.includes('阿婆没有再打来')));
});

test('精力惩罚与归零睡眠（D2）', () => {
  const g = engine.createGame();
  g.djStamina = 20;
  const before = g.hope;
  engine.applyAction(g, S('starlet')); // 效果 ×0.6
  assert.strictEqual(g.hope - before, Math.round(5 * 0.6));
  assert.ok(g.log.some(l => l.text.includes('有些走神')));
  g.djStamina = 0;
  const h2 = g.hope;
  engine.applyAction(g, N('neutral')); // +round(3*0.7) 又因睡着 -3
  assert.ok(g.hope < h2, '归零后应受到睡眠惩罚');
  assert.strictEqual(g.hope, h2 + 2 - 3);
  assert.ok(g.log.some(l => l.text.includes('你睡着了')));
});

test('收藏加成（D6）：flags.favs 中的歌 +1 希望', () => {
  const g = engine.createGame();
  g.flags.favs = ['starlet'];
  const before = g.hope;
  engine.applyAction(g, S('starlet'));
  assert.strictEqual(g.hope - before, 5 + 1);
  assert.ok(g.log.some(l => l.text.includes('收藏的歌')));
});

test('六种结局全部可达', () => {
  const dawn = play([S('starlet'), N('neutral'), C('xiaoyu'), N('neutral'), N('neutral'),
    SIG('military', 'ignore'), C('lily'), S('whitenoise'), N('neutral'), C('professor'), C('laozhou'), F('hope')]);
  assert.strictEqual(engine.computeEnding(dawn).id, 'dawn');

  const beacon = play([S('starlet'), N('soothe'), C('xiaoyu'), N('soothe'), N('soothe'),
    SIG('military', 'ignore'), C('lily'), S('whitenoise'), N('soothe'), C('professor'), C('laozhou'), F('hope')]);
  assert.strictEqual(engine.computeEnding(beacon).id, 'beacon');

  const signal = play([N('soothe'), S('nightstar'), N('soothe'), S('loveletter'), N('soothe'),
    SIG('military', 'ignore'), C('lily'), S('sunrise'), N('soothe'), C('professor'), SIG('x', 'decode'), F('truth')]);
  assert.strictEqual(signal.flags.signalDecoded, true);
  assert.strictEqual(engine.computeEnding(signal).id, 'signal');

  const afterglow = play([N('soothe'), S('starlet'), N('soothe'), S('whitenoise'), N('soothe'),
    SIG('military', 'ignore'), C('lily'), S('sunrise'), N('soothe'), C('professor'), SIG('x', 'decode'), F('truth')]);
  assert.strictEqual(engine.computeEnding(afterglow).id, 'afterglow');

  const fire = play([S('steelheart'), S('oldtape'), N('neutral'), S('steelheart'), N('neutral'),
    SIG('military', 'relay'), C('lily'), S('oldtape'), S('sunrise'), C('professor'), C('veteran'), F('companion')]);
  assert.strictEqual(engine.computeEnding(fire).id, 'fire');

  const dust = play(Array(11).fill(SIL).concat([F('silence')]));
  assert.strictEqual(engine.computeEnding(dust).id, 'dust');
});

test('新增三结局可达：纪念日/夜莺/灯塔', () => {
  // 纪念日（隐藏）：基础 6 结局已收集（模拟）
  const g0 = engine.createGame();
  g0.flags.memorialUnlocked = true;
  for (let i = 0; i < 11; i++) engine.applyAction(g0, S('nightstar'));
  g0.hope = 55;
  engine.applyAction(g0, F('hope'));
  assert.strictEqual(engine.computeEnding(g0).id, 'memorial');

  // 夜莺：摇篮曲 + 陪伴 + 接小雨(T2)与双胞胎(T1)
  const g1 = play([S('starlet'), C('twins'), C('xiaoyu'), N('neutral'), N('neutral'),
    SIG('military', 'ignore'), C('lily'), S('whitenoise'), N('neutral'), C('professor'), C('laozhou'), F('companion')]);
  assert.ok(g1.flags.answered.xiaoyu && g1.flags.answered.twins, '应接到小雨与双胞胎');
  assert.strictEqual(engine.computeEnding(g1).id, 'nightingale');

  // 灯塔：希望 + 解码 + 无摇篮曲 + 沉默过一次（避免命中「不灭的电波」）
  const g2 = play([N('neutral'), S('nightstar'), N('neutral'), S('loveletter'), SIL,
    SIG('military', 'ignore'), C('lily'), S('sunrise'), N('neutral'), C('professor'), SIG('x', 'decode'), F('hope')]);
  assert.strictEqual(g2.flags.lullaby, false);
  assert.ok(g2.flags.silenceCount > 0);
  assert.strictEqual(engine.computeEnding(g2).id, 'lighthouse');
});

test('结局路线图（D1）：9 条路线、条件可达可查', () => {
  const g = engine.createGame();
  const roadmap = engine.endingConditions(g);
  assert.strictEqual(Object.keys(roadmap).length, 9);
  Object.keys(roadmap).forEach(k => {
    assert.ok(roadmap[k].length >= 1);
    roadmap[k].forEach(c => assert.strictEqual(typeof c.met, 'boolean'));
  });
});

test('T5 未处理军队信号时自动接管', () => {
  const g = engine.createGame();
  for (let i = 0; i <= 5; i++) engine.applyAction(g, S('nightstar'));
  assert.strictEqual(g.flags.militaryHandled, true);
  assert.ok(g.log.some(l => l.type === 'signal' && l.text.includes('军队')));
});

test('未接温教授电话时 FREQUENCY X 不可解码', () => {
  const g = play([N('soothe'), S('nightstar'), N('soothe'), S('whitenoise'), N('soothe'),
    SIG('military', 'ignore'), C('lily'), S('loveletter'), S('oldtape'), S('sunrise'), SIG('x', 'decode'), F('truth')]);
  assert.strictEqual(g.flags.signalDecoded, false);
  assert.notStrictEqual(engine.computeEnding(g).id, 'signal');
});

test('完全相同剧本产生完全相同结果（确定性，含变体）', () => {
  const script = [S('starlet'), N('neutral'), C('xiaoyu'), N('neutral'), N('neutral'),
    SIG('military', 'ignore'), C('lily'), S('whitenoise'), N('neutral'), C('professor'), C('laozhou'), F('hope')];
  assert.deepStrictEqual(play(script, 'z'), play(script, 'z'));
});

test('终局留言与回合插曲', () => {
  const g = engine.createGame('q');
  for (let i = 0; i < 11; i++) engine.applyAction(g, S('nightstar'));
  engine.applyAction(g, { type: 'final', choice: 'hope', words: '天会亮的。' });
  assert.strictEqual(g.finalWords, '天会亮的。');
  assert.ok(g.log.some(l => l.type === 'final' && l.text.includes('天会亮的')));
  assert.ok(g.log.some(l => l.type === 'interlude'));
});

test('charFate 覆盖全部听众（E3）', () => {
  const fresh = engine.createGame();
  const happy = engine.createGame();
  Object.keys(happy.chars).forEach(k => { happy.chars[k].hope = 90; });
  const sad = engine.createGame();
  Object.keys(sad.chars).forEach(k => { sad.chars[k].hope = 5; });
  data.CHARACTERS.forEach(c => {
    const f1 = data.charFate(fresh, c), f2 = data.charFate(happy, c), f3 = data.charFate(sad, c);
    assert.ok(f1 && f1.length > 0, c.id + ' 应有命运文案');
    assert.ok(f2 && f2.length > 0);
    assert.ok(f3 && f3.length > 0);
  });
  // 至少部分角色因状态不同而命运不同
  let diff = 0;
  data.CHARACTERS.forEach(c => {
    if (data.charFate(happy, c) !== data.charFate(sad, c)) diff++;
  });
  assert.ok(diff >= 3, '至少 3 位听众命运随状态变化，实际 ' + diff);
});
