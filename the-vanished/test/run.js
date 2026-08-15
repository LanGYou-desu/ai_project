'use strict';
// THE VANISHED 测试：时间线 / 计分 / 结局 / 服务器
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { VanishedEngine, EVENTS, ENDINGS } = require('../lib/engine');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '  ——  ' + e.message);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-test-'));
let n = 0;

function freshEngine(extraHooks) {
  const st = path.join(tmp, 'tv-' + (++n) + '.json');
  const writtenEvidence = [];
  const toasts = [];
  const engine = new VanishedEngine({
    stateFile: st,
    hooks: Object.assign({
      writeEvidence: function (ev) { writtenEvidence.push(ev.file); },
      toast: function (ev) { toasts.push(ev); },
      onEnding: function () {}
    }, extraHooks || {})
  });
  return { engine, st, writtenEvidence, toasts };
}

console.log('· 剧情数据');
test('EVENTS 有序且完整（25 个事件）', () => {
  assert.strictEqual(EVENTS.length, 25);
  const times = EVENTS.map(e => e.at);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1], '事件时间应递增');
});
test('5 种结局定义完整', () => {
  assert.deepStrictEqual(Object.keys(ENDINGS).sort(), ['bad', 'good', 'okay', 'perfect', 'worst']);
});
test('证据文件共 7 份，检查点 3 个', () => {
  assert.strictEqual(EVENTS.filter(e => e.kind === 'evidence').length, 7);
  assert.strictEqual(EVENTS.filter(e => e.kind === 'checkpoint').length, 3);
});

console.log('· 时间线引擎');
test('advance 触发事件投递', () => {
  const { engine, writtenEvidence, toasts } = freshEngine();
  engine.advanceSeconds(10);
  let st = engine.getState();
  assert.ok(st.delivered.some(e => e.id === 'sys-0'));
  engine.advanceSeconds(120);
  st = engine.getState();
  assert.ok(st.delivered.some(e => e.id === 'chat-1'));
  assert.ok(st.delivered.some(e => e.id === 'toast-1'));
  engine.advanceSeconds(40);
  st = engine.getState();
  assert.ok(st.delivered.some(e => e.id === 'ev-1'));
  assert.ok(writtenEvidence.indexOf('门禁记录.txt') >= 0, '应生成真实证据文件');
  assert.ok(toasts.some(t => t.title === 'HALCYON SEC-ALERT'));
});
test('事件不重复投递', () => {
  const { engine, toasts } = freshEngine();
  engine.advanceSeconds(100);
  const c1 = toasts.length;
  engine.advanceSeconds(10);
  assert.strictEqual(toasts.length, c1);
});
test('倍速设置', () => {
  const { engine } = freshEngine();
  engine.setSpeed(8);
  assert.strictEqual(engine.state.speed, 8);
  engine.setSpeed(1000);
  assert.strictEqual(engine.state.speed, 100);
});
test('进度持久化', () => {
  const { engine, st } = freshEngine();
  engine.advanceSeconds(300);
  const id = engine.getState().delivered.length;
  const e2 = new VanishedEngine({ stateFile: st, hooks: {} });
  assert.strictEqual(e2.getState().delivered.length, id);
});

console.log('· 计分与检查点');
test('查看证据 +1 分（上限 7）', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(1600);
  const files = EVENTS.filter(e => e.kind === 'evidence').map(e => e.file);
  for (const f of files) engine.viewEvidence(f);
  engine.viewEvidence(files[0]);
  assert.strictEqual(engine.calcScore(), 7);
});
test('查看未生成的证据被拒绝', () => {
  const { engine } = freshEngine();
  const r = engine.viewEvidence('门禁记录.txt');
  assert.strictEqual(r.ok, false, '证据未到时间，不应计分');
});
test('检查点答对 +2，答错 0', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(2000);
  let r = engine.answerCheckpoint('gate', 'b');
  assert.ok(r.correct, 'gate 正确答案是 b');
  r = engine.answerCheckpoint('suspect', 'c');
  assert.ok(!r.correct, 'suspect 正确答案是 a');
  assert.strictEqual(engine.calcScore(), 2);
});
test('检查点不能重复作答', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(2000);
  engine.answerCheckpoint('gate', 'b');
  const r = engine.answerCheckpoint('gate', 'a');
  assert.strictEqual(r.ok, false);
});

console.log('· 结局');
test('完美通关：全部证据 + 全部答对 + 正确行动 → perfect', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(1800);
  for (const ev of EVENTS) {
    if (ev.kind === 'evidence') engine.viewEvidence(ev.file);
  }
  engine.answerCheckpoint('gate', 'b');
  engine.answerCheckpoint('suspect', 'a');
  engine.answerCheckpoint('action', 'a');
  engine.advanceSeconds(200);
  const st = engine.getState();
  assert.strictEqual(st.ended, true);
  assert.strictEqual(st.ending, 'perfect');
  assert.ok(st.finalScore >= 11);
});
test('什么都不做 → worst', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(3000);
  const st = engine.getState();
  assert.strictEqual(st.ended, true);
  assert.strictEqual(st.ending, 'worst');
});
test('只做对最终行动 → 至少 okay 以上', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(1800);
  engine.answerCheckpoint('action', 'a');
  engine.advanceSeconds(200);
  const st = engine.getState();
  assert.ok(['okay', 'good', 'perfect'].indexOf(st.ending) >= 0, '实际：' + st.ending);
});
test('最终行动错误 → 不可能 perfect，证据充分最多 okay', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(1800);
  for (const ev of EVENTS) if (ev.kind === 'evidence') engine.viewEvidence(ev.file);
  engine.answerCheckpoint('gate', 'b');
  engine.answerCheckpoint('suspect', 'a');
  engine.answerCheckpoint('action', 'b');
  engine.advanceSeconds(200);
  const st = engine.getState();
  assert.notStrictEqual(st.ending, 'perfect');
  assert.notStrictEqual(st.ending, 'good');
});

console.log('· 服务器冒烟');
function serverSmoke() {
  return new Promise((resolve) => {
    const port = 8890 + Math.floor(Math.random() * 50);
    const child = spawn(process.execPath, ['server.js', '--no-browser'], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, { PORT: String(port), VANISHED_SPEED: '60' }),
      stdio: 'ignore'
    });
    const deadline = Date.now() + 12000;
    const tryFetch = async () => {
      if (Date.now() > deadline) { child.kill(); resolve(false); return; }
      try {
        const r = await fetch('http://127.0.0.1:' + port + '/api/state');
        const d = await r.json();
        child.kill();
        resolve(d && typeof d.elapsed === 'number' && Array.isArray(d.delivered));
      } catch (e) {
        setTimeout(tryFetch, 300);
      }
    };
    tryFetch();
  });
}
(async () => {
  const okServer = await serverSmoke();
  test('服务器 /api/state 可用', () => {
    assert.ok(okServer, '服务器未能启动或 /api/state 异常');
  });

  console.log('');
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  process.exit(failed > 0 ? 1 : 0);
})();
