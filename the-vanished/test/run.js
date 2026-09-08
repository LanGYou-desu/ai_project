'use strict';
// THE VANISHED 测试：时间线 / 计分 / 结局 / 服务器
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { VanishedEngine, EVENTS, ENDINGS, SCORE, THRESHOLDS, MAX_TICK_MS } = require('../lib/engine');
const notifyLib = require('../lib/notify');

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

// 用给定的原始存档内容创建引擎（破坏性存档测试）
function engineWithRaw(raw) {
  const st = path.join(tmp, 'raw-' + (++n) + '.json');
  fs.writeFileSync(st, typeof raw === 'string' ? raw : JSON.stringify(raw), 'utf8');
  return new VanishedEngine({ stateFile: st, hooks: {} });
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
test('每个结局都有标题与正文', () => {
  for (const key of Object.keys(ENDINGS)) {
    assert.ok(ENDINGS[key].title, key + ' 缺少 title');
    assert.ok(ENDINGS[key].text && ENDINGS[key].text.length > 20, key + ' 缺少 text');
  }
});
test('每个检查点的正确答案都在选项里', () => {
  for (const cp of EVENTS.filter(e => e.kind === 'checkpoint')) {
    assert.ok(cp.options.some(o => o.id === cp.correct), cp.cid + ' 的 correct 不在 options 中');
  }
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
test('休眠/时钟前跳不会一次播完整局（单次 tick 有上限）', () => {
  const { engine } = freshEngine();
  const base = engine.state.lastTickMs;
  engine.tick(base + 3600 * 1000);   // 模拟挂起 1 小时 / 系统时钟前跳
  const st = engine.getState();
  assert.ok(st.elapsed <= MAX_TICK_MS / 1000 + 1, '单次 tick 最多补记 ' + (MAX_TICK_MS / 1000) + ' 秒，实际 ' + st.elapsed);
  assert.strictEqual(st.ended, false, '不应因为一次时钟跳变就结算');
  assert.ok(st.delivered.length < EVENTS.length, '不应一次性投递全部事件');
});
test('时钟回拨不会让时间线倒退', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(100);
  const before = engine.getState().elapsed;
  engine.tick(engine.state.lastTickMs - 60000);
  assert.strictEqual(engine.getState().elapsed, before);
});
test('损坏的存档被修正而不是抛异常', () => {
  const broken = [
    { version: 1, delivered: null, answers: null, evidenceViewed: 'x', speed: 'fast', accumulatedMs: null },
    '{"version":1,',
    { version: 1, speed: 1e9, delivered: ['不存在的 id'], answers: { gate: 'zzz' } },
    { version: 99, delivered: ['sys-0'] }
  ];
  for (const raw of broken) {
    const engine = engineWithRaw(raw);
    engine.tick();
    const st = engine.getState();
    assert.ok(Number.isFinite(st.elapsed), 'elapsed 应为有限数字');
    assert.ok(Array.isArray(st.delivered));
    assert.ok(st.speed <= 100, '非法倍速应被夹紧，实际 ' + st.speed);
    assert.ok(!st.delivered.some(e => e.id === '不存在的 id'));
  }
});
test('存档中非法的检查点答案被丢弃', () => {
  const engine = engineWithRaw({ version: 1, speed: 1, delivered: ['check-1'], answers: { gate: 'zzz' } });
  assert.strictEqual(engine.state.answers.gate, undefined);
  const r = engine.answerCheckpoint('gate', 'b');
  assert.strictEqual(r.ok, true, '非法存档答案不应永久占用检查点');
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
test('检查点未出现时不能作答（防止开局直接跳到大结局）', () => {
  const { engine } = freshEngine();
  const r = engine.answerCheckpoint('action', 'a');
  assert.strictEqual(r.ok, false, '未到时间的检查点不应可答');
  assert.strictEqual(engine.calcScore(), 0);
  engine.advanceSeconds(3000);
  assert.strictEqual(engine.getState().ending, 'worst', '开局抢先作答不应改变结局');
});
test('无效选项不会消耗检查点', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(1100);
  const bad = engine.answerCheckpoint('gate', 'zzz');
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(engine.state.answers.gate, undefined);
  const good = engine.answerCheckpoint('gate', 'b');
  assert.strictEqual(good.ok, true, '无效选项之后仍应能正常作答');
});
test('结算后分数冻结（注意力 = 最终分）', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(3000);
  const st1 = engine.getState();
  assert.strictEqual(st1.ended, true);
  assert.strictEqual(st1.finalScore, 0);
  engine.answerCheckpoint('gate', 'b');
  engine.viewEvidence('门禁记录.txt');
  assert.strictEqual(engine.getState().attention, st1.finalScore, '结算后界面分数不应再漂移');
});
test('检查点事件在状态中暴露作答结果，且作答前不下发正确答案', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(1100);
  let cp = engine.getState().delivered.find(e => e.cid === 'gate');
  assert.strictEqual(cp.answered, false);
  assert.strictEqual(cp.correctOption, null, '作答前不应泄漏正确答案');
  assert.strictEqual(cp.answeredCorrectly, null);
  const r = engine.answerCheckpoint('gate', 'a');
  assert.strictEqual(r.correctOption, 'b', '作答后返回正确选项供前端标色');
  cp = engine.getState().delivered.find(e => e.cid === 'gate');
  assert.strictEqual(cp.answered, true);
  assert.strictEqual(cp.answeredCorrectly, false);
  assert.strictEqual(cp.correctOption, 'b');
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
  assert.strictEqual(st.attention, st.finalScore);
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
test('getState 下发结局标题与正文（前端不再重复维护一份）', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(3000);
  const st = engine.getState();
  assert.strictEqual(st.ending, 'worst');
  assert.strictEqual(st.endingTitle, ENDINGS.worst.title);
  assert.strictEqual(st.endingText, ENDINGS.worst.text);
});
test('计分与阈值常量与 README 一致（满分 ' + SCORE.max + '）', () => {
  assert.strictEqual(SCORE.evidence, 7);
  assert.strictEqual(SCORE.checkpoint, 2);
  assert.strictEqual(SCORE.actionBonus, 3);
  assert.strictEqual(SCORE.max, 16);
  assert.deepStrictEqual(THRESHOLDS, { perfect: 11, good: 8, okay: 4 });
});
test('restart 清空进度、答案与倍速', () => {
  const { engine } = freshEngine();
  engine.advanceSeconds(1600);
  engine.setSpeed(8);
  engine.viewEvidence('门禁记录.txt');
  engine.answerCheckpoint('gate', 'b');
  const st = engine.restart();
  assert.strictEqual(st.delivered.length, 0);
  assert.strictEqual(st.evidenceViewed.length, 0);
  assert.strictEqual(st.speed, 1);
  assert.strictEqual(st.ended, false);
  assert.deepStrictEqual(engine.state.answers, {});
});

console.log('· 通知');
test('通知参数只以 base64 传递，原始文本不进命令行', () => {
  const evil = 'a"; Start-Process calc; $x=`; New-Item C:\\pwned';
  const args = notifyLib.buildArgs(evil, evil + '\n换行');
  assert.ok(Array.isArray(args), '必须是参数数组而不是拼接的字符串');
  assert.ok(args.indexOf('-File') >= 0);
  assert.ok(args.indexOf(evil) < 0, '原始文本不应出现在 argv 中');
  assert.ok(args.indexOf('calc') < 0);
  const i = args.indexOf('-TitleB64');
  assert.ok(i > 0);
  assert.strictEqual(Buffer.from(args[i + 1], 'base64').toString('utf8'), evil);
  const j = args.indexOf('-TextB64');
  assert.strictEqual(Buffer.from(args[j + 1], 'base64').toString('utf8'), evil + '\n换行');
});
test('非 Windows 平台安全降级（不 spawn、不抛异常）', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  try {
    notifyLib.setEnabled(true);
    notifyLib.resetThrottle();
    assert.strictEqual(notifyLib.isSupported(), false);
    assert.strictEqual(notifyLib.notify('t', 'x'), false);
    assert.strictEqual(notifyLib.inflightCount(), 0);
  } finally {
    Object.defineProperty(process, 'platform', platform);
  }
});
test('通知正文含引号/换行/中文时原样保留', () => {
  const text = '他说：“门禁 23:49 刷出。”\n第二行 & <标签>';
  const args = notifyLib.buildArgs('标题"引号"', text);
  assert.strictEqual(Buffer.from(args[args.indexOf('-TitleB64') + 1], 'base64').toString('utf8'), '标题"引号"');
  assert.strictEqual(Buffer.from(args[args.indexOf('-TextB64') + 1], 'base64').toString('utf8'), text);
});

// ---------------------------------------------------------------------------
console.log('· 服务器');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function rawRequest(port, text, timeoutMs) {
  return new Promise(resolve => {
    const s = net.connect(port, '127.0.0.1', () => s.write(text));
    let buf = '';
    let done = false;
    const finish = v => { if (done) return; done = true; try { s.destroy(); } catch (e) { /* 忽略 */ } resolve(v); };
    s.on('data', d => { buf += d; });
    s.on('close', () => finish(buf));
    s.on('error', e => finish('SOCKERR:' + e.message));
    setTimeout(() => finish('TIMEOUT:' + buf), timeoutMs || 3000);
  });
}

async function postJson(port, p, obj) {
  const r = await fetch('http://127.0.0.1:' + port + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  });
  let body = null;
  try { body = await r.json(); } catch (e) { body = null; }
  return { status: r.status, body: body };
}

async function startServer() {
  const port = 8890 + Math.floor(Math.random() * 50);
  const dataDir = path.join(tmp, 'server-data');
  fs.mkdirSync(dataDir, { recursive: true });
  const child = spawn(process.execPath, ['server.js', '--no-browser'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, {
      PORT: String(port),
      VANISHED_SPEED: '60',
      VANISHED_DATA_DIR: dataDir,   // 测试不污染项目里的 evidence/ 与 state.json
      VANISHED_NO_NOTIFY: '1',
      NO_BROWSER: '1'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  let exited = false;
  child.on('exit', () => { exited = true; });
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (exited) break;
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/api/state');
      if (r.ok) return { ok: true, child, port, dataDir, log: () => log };
    } catch (e) { /* 还没起来 */ }
    await sleep(200);
  }
  try { child.kill(); } catch (e) { /* 忽略 */ }
  return { ok: false, child, port, dataDir, log: () => log };
}

(async () => {
  const srv = await startServer();

  test('服务器 /api/state 可用', () => {
    assert.ok(srv.ok, '服务器未能启动：' + srv.log());
  });

  if (!srv.ok) {
    console.log('  （服务器未启动，跳过 HTTP 用例）');
  } else {
    const port = srv.port;
    const state = await (await fetch('http://127.0.0.1:' + port + '/api/state')).json();
    test('/api/state 返回完整状态结构', () => {
      assert.ok(typeof state.elapsed === 'number' && Array.isArray(state.delivered));
      assert.ok(typeof state.totalSeconds === 'number' && state.totalSeconds > 0);
      assert.ok(typeof state.attention === 'number');
    });

    // 畸形请求行曾触发 ERR_INVALID_URL 未处理拒绝 → 整个进程退出
    const malformed = await rawRequest(port, 'GET http://x:99999999/ HTTP/1.1\r\nHost: x\r\n\r\n');
    await sleep(400);
    const alive = await fetch('http://127.0.0.1:' + port + '/api/state')
      .then(r => r.status).catch(e => 'ERR:' + e.code);
    test('畸形请求行不会让服务器崩溃', () => {
      assert.strictEqual(alive, 200, '收到 ' + String(malformed).slice(0, 40) + ' 后服务器已不可用');
    });

    // 超大请求体曾导致请求挂死（既无响应也无 413）
    const big = 'x'.repeat(5 * 1024 * 1024);
    const bigRes = await rawRequest(port,
      'POST /api/answer HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ' +
      big.length + '\r\n\r\n' + big, 5000);
    const alive2 = await fetch('http://127.0.0.1:' + port + '/api/state')
      .then(r => r.status).catch(e => 'ERR:' + e.code);
    test('超大请求体返回 413 且服务器存活', () => {
      assert.ok(String(bigRes).indexOf('413') >= 0, '实际响应：' + String(bigRes).slice(0, 60));
      assert.strictEqual(alive2, 200);
    });

    const trav1 = await rawRequest(port, 'GET /..%2f..%2fserver.js HTTP/1.1\r\nHost: x\r\n\r\n');
    const trav2 = await rawRequest(port, 'GET /%2e%2e/%2e%2e/server.js HTTP/1.1\r\nHost: x\r\n\r\n');
    test('静态服务路径穿越被拒绝', () => {
      assert.ok(String(trav1).indexOf('403') >= 0 || String(trav1).indexOf('404') >= 0, '实际：' + String(trav1).slice(0, 40));
      assert.ok(String(trav2).indexOf('403') >= 0 || String(trav2).indexOf('404') >= 0, '实际：' + String(trav2).slice(0, 40));
      assert.ok(String(trav1).indexOf('THE VANISHED · 服务器') < 0, '不能返回 server.js 内容');
    });

    const viewTrav = await postJson(port, '/api/view', { file: '..\\state.json' });
    const viewTrav2 = await postJson(port, '/api/view', { file: '../state.json' });
    test('/api/view 路径穿越不泄漏文件内容', () => {
      assert.strictEqual(viewTrav.body.content, null);
      assert.strictEqual(viewTrav2.body.content, null);
    });

    const noCt = await fetch('http://127.0.0.1:' + port + '/api/restart?fresh=1', { method: 'POST' });
    test('改动状态的 POST 必须带 application/json（挡跨站表单）', () => {
      assert.strictEqual(noCt.status, 415);
    });

    const answer = await postJson(port, '/api/answer', { cid: 'action', option: 'a' });
    test('/api/answer 拒绝还没出现的检查点', () => {
      assert.strictEqual(answer.status, 400);
      assert.strictEqual(answer.body.ok, false);
    });

    const speed = await postJson(port, '/api/speed', { speed: 5000 });
    test('/api/speed 把倍速夹紧到 100', () => {
      assert.strictEqual(speed.status, 200);
      assert.strictEqual(speed.body.speed, 100);
    });
    await postJson(port, '/api/speed', { speed: 60 });

    // 证据文件应真实落在 VANISHED_DATA_DIR 内
    const evFile = path.join(srv.dataDir, 'evidence', '门禁记录.txt');
    const evDeadline = Date.now() + 15000;
    while (Date.now() < evDeadline && !fs.existsSync(evFile)) await sleep(250);
    test('证据文件真实写入 VANISHED_DATA_DIR 内的 evidence/', () => {
      assert.ok(fs.existsSync(evFile), '未找到 ' + evFile);
      assert.ok(fs.existsSync(path.join(srv.dataDir, 'state.json')), '存档应写在数据目录内');
      assert.ok(fs.readFileSync(evFile, 'utf8').indexOf('23:49:05') >= 0, '证据内容应完整');
      assert.ok(!fs.existsSync(evFile + '.tmp'), '不应残留临时文件');
    });

    const evView = await postJson(port, '/api/view', { file: '门禁记录.txt' });
    test('/api/view 能读到已生成的证据内容', () => {
      assert.strictEqual(evView.status, 200);
      assert.ok(evView.body.content && evView.body.content.indexOf('LW-0217') >= 0);
    });

    try { srv.child.kill(); } catch (e) { /* 忽略 */ }
  }

  console.log('');
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  process.exit(failed > 0 ? 1 : 0);
})();
