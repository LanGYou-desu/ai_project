const { test } = require('node:test');
const assert = require('node:assert');
const savefile = require('../js/shared/savefile.js');
const chapters = require('../js/shared/chapters.js');

function goodSave(over) {
  return Object.assign({
    v: savefile.VERSION, mode: 'campaign', chapter: 3, seed: 'campaign-abc',
    eventChance: 0.014, actions: [], stars: {}, chState: null,
    scripted: [], vinePeak: 0, month: 120
  }, over || {});
}

test('合法存档通过校验（剧情 / 沙盒 / 旧版本）', () => {
  assert.strictEqual(savefile.validate(goodSave()), true);
  assert.strictEqual(savefile.validate(goodSave({ mode: 'sandbox', chapter: 0 })), true);
  assert.strictEqual(savefile.validate(goodSave({ v: 1 })), true, 'v1 旧存档应可读');
});

test('损坏 / 未来版本 / 字段缺失的存档被拒绝', () => {
  assert.strictEqual(savefile.validate(null), false);
  assert.strictEqual(savefile.validate('not-an-object'), false);
  assert.strictEqual(savefile.validate([]), false);
  assert.strictEqual(savefile.validate(goodSave({ v: savefile.VERSION + 1 })), false, '未来版本');
  assert.strictEqual(savefile.validate(goodSave({ v: 0 })), false);
  assert.strictEqual(savefile.validate(goodSave({ v: '2' })), false);
  assert.strictEqual(savefile.validate(goodSave({ mode: 'menu' })), false);
  assert.strictEqual(savefile.validate(goodSave({ chapter: 9 })), false, '不存在的章节');
  assert.strictEqual(savefile.validate(goodSave({ seed: '' })), false);
  assert.strictEqual(savefile.validate(goodSave({ actions: {} })), false);
  assert.strictEqual(savefile.validate(goodSave({ month: NaN })), false);
  assert.strictEqual(savefile.validate(goodSave({ month: -1 })), false);
  assert.strictEqual(savefile.validate(goodSave({ eventChance: 'x' })), false);
});

test('章节状态序列化 / 反序列化保持字段', () => {
  const st = chapters.createState(4);
  st.placedSet.grass = true;
  st.consecutive.o1 = 3;
  st.iceStarted = true;
  st.iceObservations = 2;
  st.iceYearsOk = 2;
  st.coldAlive = true;
  const data = savefile.serializeState(st);
  assert.strictEqual(JSON.stringify(data), JSON.stringify(JSON.parse(JSON.stringify(data))), '必须是纯 JSON 数据');
  const back = savefile.deserializeState(data);
  assert.strictEqual(back.no, 4);
  assert.deepStrictEqual(back.placedSet, { grass: true });
  assert.strictEqual(back.consecutive.o1, 3);
  assert.strictEqual(back.iceObservations, 2);
  assert.strictEqual(back.coldAlive, true);
});

test('反序列化旧存档：缺失的新字段用默认值补齐（不产生 NaN/undefined）', () => {
  // v1 存档里的章节状态没有冰期年检字段
  const legacy = { no: 4, placedSet: {}, consecutive: {}, iceStarted: true, coldAlive: true };
  const st = savefile.deserializeState(legacy);
  assert.strictEqual(st.iceObservations, 0);
  assert.strictEqual(st.iceYearsOk, 0);
  assert.strictEqual(st.iceStarted, true, '已有字段应保留');
  assert.strictEqual(st.prevBiomass, null);
  // 用补齐后的状态跑一次 update 不应出现 NaN 进度
  const sim = require('../js/shared/sim.js').createSim({ seed: 'legacy', w: 40, h: 30, eventChance: 0 });
  sim.place('grass', 100);
  const r = chapters.update(4, sim, st);
  Object.keys(r.objectives).forEach(k => {
    assert.ok(Number.isFinite(r.objectives[k].prog), k + ' 进度应为有限数');
    assert.ok(r.objectives[k].prog >= 0 && r.objectives[k].prog <= 1);
  });
});

test('序列化空状态返回 null', () => {
  assert.strictEqual(savefile.serializeState(null), null);
  assert.strictEqual(savefile.deserializeState(null), null);
  assert.strictEqual(savefile.deserializeState('x'), null);
});
