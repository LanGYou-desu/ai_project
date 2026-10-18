const { test } = require('node:test');
const assert = require('node:assert');
const timeflow = require('../js/shared/timeflow.js');

// 用固定 dt 驱动若干帧，返回累计推进的模拟月数
function run(clock, dtMs, frames) {
  let months = 0;
  for (let i = 0; i < frames; i++) months += timeflow.advance(clock, dtMs);
  return months;
}

test('1× 速度：60 帧 × 16ms ≈ 1 年（12 月）', () => {
  const clock = timeflow.createClock(1);
  const months = run(clock, 16, 60);
  assert.ok(months >= 11 && months <= 13, '实测 ' + months + ' 月');
});

test('速度档位真实生效：同样帧数下 1×:2×:4×:8×:16× 约为 1:2:4:8:16', () => {
  const base = run(timeflow.createClock(1), 16, 120);
  [2, 4, 8, 16].forEach(mul => {
    const got = run(timeflow.createClock(mul), 16, 120);
    assert.ok(Math.abs(got - base * mul) <= mul, mul + '× 实测 ' + got + ' 月，期望约 ' + base * mul);
  });
});

test('小数余量不会丢失（旧实现每帧至少跑 1 步）', () => {
  // 1× + 50ms/帧 → 每帧 0.6 月：5 秒（100 帧）应推进约 60 月，而不是 100 月
  const clock = timeflow.createClock(1);
  const months = run(clock, 50, 100);
  assert.ok(months >= 59 && months <= 60, '实测 ' + months + ' 月（旧实现会推进 100 月）');
  assert.ok(clock.acc >= 0 && clock.acc < 1, '余数应保留在累加器中');
});

test('单帧步数上限：掉帧/切后台不会一次性补算', () => {
  const clock = timeflow.createClock(16);
  const steps = timeflow.advance(clock, 60000); // 60 秒的积压
  assert.strictEqual(steps, timeflow.MAX_STEPS_PER_FRAME);
  assert.strictEqual(clock.acc, 0, '积压应被丢弃');
});

test('非法 dt 不推进，setSpeed 只接受正数', () => {
  const clock = timeflow.createClock(4);
  assert.strictEqual(timeflow.advance(clock, 0), 0);
  assert.strictEqual(timeflow.advance(clock, -100), 0);
  assert.strictEqual(timeflow.advance(clock, NaN), 0);
  timeflow.setSpeed(clock, 8);
  assert.strictEqual(clock.speed, 8);
  timeflow.setSpeed(clock, 0);
  assert.strictEqual(clock.speed, 8, '非法速度应被忽略');
});

test('createClock 兜底非法速度', () => {
  assert.strictEqual(timeflow.createClock(0).speed, 1);
  assert.strictEqual(timeflow.createClock(-3).speed, 1);
  assert.strictEqual(timeflow.createClock(undefined).speed, 1);
});
