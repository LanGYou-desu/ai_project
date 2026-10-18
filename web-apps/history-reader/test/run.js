// The History Reader · 历史朗读者 — 单元测试（零依赖，node test/run.js）
'use strict';

const assert = require('assert');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const app = require(path.join(ROOT, 'server.js'));
const reader = require(path.join(ROOT, 'lib', 'reader.js'));
const narrator = require(path.join(ROOT, 'lib', 'narrator.js'));

// ── 最小断言与运行器 ──

function ok(cond, msg) { assert.ok(cond, msg); }
function eq(actual, expected, msg) { assert.strictEqual(actual, expected, msg); }
function deepEq(actual, expected, msg) { assert.deepStrictEqual(actual, expected, msg); }

let passed = 0;
let failed = 0;
const failures = [];

async function runSuite(title, list) {
  if (!list.length) return;
  console.log('');
  console.log(title);
  for (const [name, fn] of list) {
    try {
      await fn();
      passed++;
      console.log('  ✓ ' + name);
    } catch (e) {
      failed++;
      failures.push(name + ' → ' + e.message);
      console.log('  ✗ ' + name + ' → ' + e.message);
    }
  }
}

const unitTests = [];
const httpTests = [];
function test(name, fn) { unitTests.push([name, fn]); }
function httpTest(name, fn) { httpTests.push([name, fn]); }

// ── 工具 ──

const BS = String.fromCharCode(92); // 反斜杠，避免转义噪音
function localTime(y, mo, d, h, mi) { return new Date(y, mo - 1, d, h, mi || 0, 0, 0).getTime(); }
function visit(url, ms, title) { return { url: url, title: title || '(无标题)', visitTime: ms }; }
function noNaN(value, label) {
  const text = JSON.stringify(value);
  ok(!/NaN|undefined|null 年/.test(text), (label || '') + ' 出现 NaN/undefined：' + text.slice(0, 200));
}

let serverCtx = null;
function startTestServer() {
  return new Promise(function(resolve, reject) {
    const server = app.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', function() {
      resolve({ server: server, port: server.address().port });
    });
  });
}

function request(method, urlPath, body, headers) {
  return new Promise(function(resolve) {
    const opts = {
      host: '127.0.0.1',
      port: serverCtx.port,
      method: method,
      path: urlPath,
      headers: headers || {},
    };
    if (body !== undefined && body !== null) {
      opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      if (!opts.headers['Content-Length']) {
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      }
    }
    const req = http.request(opts, function(res) {
      let data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = null; }
        resolve({ status: res.statusCode, body: data, json: json, headers: res.headers });
      });
    });
    req.on('error', function(e) { resolve({ status: 0, body: '', error: e.code || e.message }); });
    req.setTimeout(15000, function() { req.destroy(); resolve({ status: 0, body: '', error: 'timeout' }); });
    if (body !== undefined && body !== null) req.write(body);
    req.end();
  });
}

// 直接发原始字节，用于畸形请求行
function rawRequest(text) {
  return new Promise(function(resolve) {
    const socket = net.connect(serverCtx.port, '127.0.0.1', function() {
      socket.write(text);
    });
    let data = '';
    socket.on('data', function(c) { data += c; });
    socket.on('close', function() { resolve(data); });
    socket.on('error', function() { resolve(data); });
    setTimeout(function() { socket.destroy(); resolve(data); }, 5000);
  });
}

// ══════════════════════════════════════════════════════════
// 1) 静态资源路径穿越
// ══════════════════════════════════════════════════════════

test('resolveStaticPath：正常文件解析到 public 目录内', function() {
  const r = app.resolveStaticPath('/index.html');
  ok(r.filePath, '应返回 filePath');
  ok(r.filePath.startsWith(app.PUBLIC_DIR), r.filePath);
  ok(r.filePath.endsWith('index.html'));
});

test('resolveStaticPath：/../server.js 越界被拒', function() {
  const r = app.resolveStaticPath('/../server.js');
  eq(r.error, 403);
  ok(!r.filePath);
});

test('resolveStaticPath：%2e%2e%2f 编码绕过被拒', function() {
  eq(app.resolveStaticPath('/%2e%2e%2fserver.js').error, 403);
  eq(app.resolveStaticPath('/%2e%2e/%2e%2e/package.json').error, 403);
  eq(app.resolveStaticPath('/..%5cserver.js').error, 403);
});

test('resolveStaticPath：目录本身与非法编码', function() {
  eq(app.resolveStaticPath('/').error, 404);
  eq(app.resolveStaticPath('/%zz').error, 400);
  eq(app.resolveStaticPath('/a' + String.fromCharCode(0) + 'b').error, 400);
});

// ══════════════════════════════════════════════════════════
// 2) 叙事生成：边界与模式分支
// ══════════════════════════════════════════════════════════

test('叙事：空数据返回空章节，不产生 NaN', function() {
  const n = narrator.generateNarrative([], null);
  eq(n.chapters.length, 0);
  ok(n.summary.length > 0 && n.ending.length > 0);
  noNaN(n, '空数据');
});

test('叙事：timeRange 为 NaN 时日期回退为「今天」', function() {
  const n = narrator.generateNarrative([], { startMs: NaN, endMs: NaN });
  eq(n.date, '今天');
  noNaN(n, 'NaN 时间范围');
});

test('叙事：单条记录生成一个章节', function() {
  const n = narrator.generateNarrative([visit('https://a.com/p', localTime(2026, 9, 8, 10))], null);
  eq(n.chapters.length, 1);
  eq(n.chapters[0].visits, 1);
  eq(n.chapters[0].pattern, 'steady');
  noNaN(n, '单条记录');
});

test('叙事：脏时间戳被过滤，不影响其余记录', function() {
  const n = narrator.generateNarrative([
    { url: 'https://a.com', title: 'x', visitTime: NaN },
    { url: 'https://a.com', title: 'y', visitTime: undefined },
    visit('https://a.com', localTime(2026, 9, 8, 10)),
  ], null);
  eq(n.chapters.length, 1);
  eq(n.chapters[0].visits, 1);
  noNaN(n, '脏时间戳');
});

test('叙事：输入无序时按时间升序排列', function() {
  const early = localTime(2026, 9, 8, 9);
  const late = localTime(2026, 9, 8, 11);
  const n = narrator.generateNarrative([visit('https://b.com', late), visit('https://a.com', early)], null);
  eq(n.chapters.length, 2);
  eq(n.chapters[0].time, '09:00 — 09:00');
  eq(n.chapters[1].time, '11:00 — 11:00');
});

test('叙事：30 分钟内合并为同一时段，超过则切分', function() {
  const base = localTime(2026, 9, 8, 10);
  const within = narrator.generateNarrative([
    visit('https://a.com', base),
    visit('https://a.com', base + 25 * 60000),
  ], null);
  eq(within.chapters.length, 1, '25 分钟间隔应合并');

  const beyond = narrator.generateNarrative([
    visit('https://a.com', base),
    visit('https://a.com', base + 31 * 60000),
  ], null);
  eq(beyond.chapters.length, 2, '31 分钟间隔应切分');
});

test('叙事：六种模式都能被触发（含 absorbed）', function() {
  const base = localTime(2026, 9, 8, 10);
  const min = 60000;

  const absorbed = narrator.generateNarrative([
    visit('https://a.com', base),
    visit('https://a.com', base + 30 * min),
    visit('https://a.com', base + 60 * min),
  ], null);
  eq(absorbed.chapters[0].pattern, 'absorbed', '3 条记录跨 60 分钟应判定为沉浸');

  const racing = [];
  for (let i = 0; i < 8; i++) racing.push(visit('https://a.com', base + i * 30000));
  eq(narrator.generateNarrative(racing, null).chapters[0].pattern, 'racing');

  const searching = [];
  for (let i = 0; i < 6; i++) searching.push(visit('https://a.com/s?q=' + i, base + i * 6 * min));
  eq(narrator.generateNarrative(searching, null).chapters[0].pattern, 'searching');

  const scattered = [];
  for (let i = 0; i < 12; i++) scattered.push(visit('https://d' + (i % 4) + '.com', base + i * 2 * min));
  eq(narrator.generateNarrative(scattered, null).chapters[0].pattern, 'scattered');

  const oscillating = [];
  for (let i = 0; i < 6; i++) oscillating.push(visit('https://a.com', base + i * 2 * min));
  oscillating[1].url = 'https://b.com';
  oscillating[3].url = 'https://b.com';
  oscillating[5].url = 'https://b.com';
  eq(narrator.generateNarrative(oscillating, null).chapters[0].pattern, 'oscillating');

  const steady = narrator.generateNarrative([
    visit('https://a.com', base),
    visit('https://a.com', base + 5 * min),
  ], null);
  eq(steady.chapters[0].pattern, 'steady');
});

test('叙事：无主机名 / 非法 URL 的域名回退为「未知」', function() {
  const base = localTime(2026, 9, 8, 10);
  const n = narrator.generateNarrative([visit('about:blank', base)], null);
  eq(n.chapters[0].topDomain, '未知');
  ok(n.chapters[0].narrative.indexOf('在  待得最久') === -1, '不应出现空域名文案');
});

test('叙事：www. 前缀被去掉', function() {
  const base = localTime(2026, 9, 8, 10);
  const n = narrator.generateNarrative([visit('https://www.example.com/a', base)], null);
  eq(n.chapters[0].topDomain, 'example.com');
});

test('叙事：数据被 LIMIT 截断时明确说明', function() {
  const base = localTime(2026, 9, 8, 10);
  const range = { startMs: base - 86400000, endMs: base, truncated: true };
  const n = narrator.generateNarrative([visit('https://a.com', base)], range);
  ok(n.summary.indexOf('只统计了最近') !== -1, '摘要应说明截断：' + n.summary);
  ok(n.overview.indexOf('只统计了最近') !== -1, '概览应说明截断');
  noNaN(n, '截断');
});

// ══════════════════════════════════════════════════════════
// 3) 浏览器路径与时间解析
// ══════════════════════════════════════════════════════════

test('getBrowserName：Windows 与 POSIX 路径都能识别', function() {
  const winEdge = ['C:', 'Users', 'x', 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'History'].join(BS);
  const winChrome = ['C:', 'Users', 'x', 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'History'].join(BS);
  eq(reader.getBrowserName(winEdge), 'Microsoft Edge');
  eq(reader.getBrowserName(winChrome), 'Google Chrome');
  eq(reader.getBrowserName('/home/x/.config/microsoft-edge/Default/History'), 'Microsoft Edge');
  eq(reader.getBrowserName('/home/x/.config/google-chrome/Default/History'), 'Google Chrome');
  eq(reader.getBrowserName('/Users/x/Library/Application Support/Chromium/Default/History'), 'Chromium');
  eq(reader.getBrowserName('/home/x/.config/brave-browser/Default/History'), '浏览器');
});

test('getBrowserDataRoots：Windows / macOS / Linux 各有对应目录', function() {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  function withPlatform(platform, fn) {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    try { return fn(); } finally {
      if (original) Object.defineProperty(process, 'platform', original);
      else delete process.platform;
    }
  }

  const win = withPlatform('win32', function() { return reader.getBrowserDataRoots(); });
  eq(win.length, 2);
  ok(win[0].root.indexOf('Chrome') !== -1, win[0].root);
  ok(win[1].root.indexOf('Edge') !== -1, win[1].root);

  const mac = withPlatform('darwin', function() { return reader.getBrowserDataRoots(); });
  eq(mac.length, 3);
  ok(mac[0].root.indexOf(path.join('Library', 'Application Support', 'Google', 'Chrome')) !== -1, mac[0].root);

  const linux = withPlatform('linux', function() { return reader.getBrowserDataRoots(); });
  eq(linux.length, 3);
  ok(linux[0].root.indexOf(path.join('.config', 'google-chrome')) !== -1, linux[0].root);
  ok(linux[1].root.indexOf(path.join('.config', 'microsoft-edge')) !== -1, linux[1].root);
});

test('getBrowserHistoryPaths：路径都以 History 结尾且包含 Default', function() {
  const paths = reader.getBrowserHistoryPaths();
  ok(paths.length > 0);
  for (const p of paths) ok(path.basename(p) === 'History', p);
  ok(paths.some(function(p) { return p.indexOf('Default') !== -1; }));
});

test('parseLocalDate：合法日期与非法输入', function() {
  const ms = reader.parseLocalDate('2026-09-08');
  const d = new Date(ms);
  eq(d.getFullYear(), 2026);
  eq(d.getMonth(), 8);
  eq(d.getDate(), 8);
  eq(d.getHours(), 0);

  assert.throws(function() { reader.parseLocalDate('foo'); }, /日期格式无效/);
  assert.throws(function() { reader.parseLocalDate('2026-02-30'); }, /日期不存在/);
  assert.throws(function() { reader.parseLocalDate('2026-13-01'); }, /日期不存在/);
  assert.throws(function() { reader.parseLocalDate('2026-1-1'); }, /日期格式无效/);
});

test('endOfDayMs：取次日零点（结束日全天包含在内）', function() {
  const end = new Date(reader.endOfDayMs('2026-09-08'));
  eq(end.getFullYear(), 2026);
  eq(end.getMonth(), 8);
  eq(end.getDate(), 9);
  eq(end.getHours(), 0);
  ok(reader.endOfDayMs('2026-09-08') - reader.parseLocalDate('2026-09-08') === 86400000);
});

// ══════════════════════════════════════════════════════════
// 4) 上传数据归一化
// ══════════════════════════════════════════════════════════

test('parseUpload：裸数组与 {visits:[]} 都支持', function() {
  const arr = reader.parseUpload(JSON.stringify([visit('https://a.com', 1700000000000)]));
  eq(arr.visits.length, 1);
  eq(arr.visits[0].url, 'https://a.com');

  const obj = reader.parseUpload({ visits: [visit('https://b.com', 1700000000000)] });
  eq(obj.visits.length, 1);
  eq(obj.visits[0].url, 'https://b.com');
});

test('parseUpload：非法 JSON / 非数组 / 空对象都报错', function() {
  assert.throws(function() { reader.parseUpload('{oops'); }, SyntaxError);
  assert.throws(function() { reader.parseUpload({ visits: 5 }); }, /需要一个访问记录数组/);
  assert.throws(function() { reader.parseUpload({}); }, /需要一个访问记录数组/);
  assert.throws(function() { reader.parseUpload('null'); }, /JSON 内容为空/);
});

test('parseUpload：null / 非对象条目被跳过而不是抛 TypeError', function() {
  const r = reader.parseUpload([null, 5, 'x', visit('https://a.com', 1700000000000)]);
  eq(r.visits.length, 1);
  eq(r.skipped, 3);
});

test('parseUpload：时间戳支持数字字符串与日期字符串，缺失的丢弃', function() {
  const r = reader.parseUpload([
    { url: 'https://a.com', visitTime: '1700000000000' },
    { url: 'https://b.com', visitTime: '2026-01-02T03:04:05Z' },
    { url: 'https://c.com' },
  ]);
  eq(r.visits.length, 2);
  eq(r.skipped, 1);
  eq(typeof r.visits[0].visitTime, 'number');
  ok(Number.isFinite(r.visits[0].visitTime) && Number.isFinite(r.visits[1].visitTime));
  ok(r.visits[0].visitTime <= r.visits[1].visitTime, '应升序排列');
});

test('parseUpload：全部没有时间戳时给出明确错误', function() {
  assert.throws(function() { reader.parseUpload([{ url: 'https://a.com' }]); }, /没有可用的时间戳/);
});

test('parseUpload：空数组合法，超量数组被拒', function() {
  eq(reader.parseUpload([]).visits.length, 0);
  const huge = [];
  for (let i = 0; i <= reader.MAX_UPLOAD_VISITS; i++) huge.push({ url: 'https://a.com', visitTime: i + 1 });
  assert.throws(function() { reader.parseUpload(huge); }, /记录条数超过上限/);
});

test('parseUpload：timeRange 只在数值合法时保留', function() {
  const good = reader.parseUpload({ visits: [visit('https://a.com', 1)], timeRange: { startMs: 1, endMs: 2 } });
  deepEq(good.timeRange, { startMs: 1, endMs: 2 });
  const bad = reader.parseUpload({ visits: [visit('https://a.com', 1)], timeRange: { startMs: 'x', endMs: null } });
  eq(bad.timeRange, null);
});

test('parseUpload：缺省 url/title 有兜底值', function() {
  const r = reader.parseUpload([{ visitTime: 1700000000000 }]);
  eq(r.visits[0].url, 'about:blank');
  eq(r.visits[0].title, '(无标题)');
});

// ══════════════════════════════════════════════════════════
// 5) readHistory：参数校验与真实历史库
// ══════════════════════════════════════════════════════════

test('readHistory：非法日期在触碰数据库之前就报错', async function() {
  await assert.rejects(function() { return reader.readHistory({ startDate: 'foo', endDate: 'bar' }); }, /日期格式无效/);
  await assert.rejects(function() { return reader.readHistory({ startDate: '2026-09-08', endDate: '2026-09-01' }); }, /结束日期不能早于开始日期/);
  await assert.rejects(function() { return reader.readHistory({ startDate: '2026-02-30', endDate: '2026-03-01' }); }, /日期不存在/);
});

test('readHistory：真实历史库可用或给出 NO_HISTORY_FILE', async function() {
  if (!reader.findHistoryFile()) {
    let err = null;
    try { await reader.readHistory({ days: 1 }); } catch (e) { err = e; }
    ok(err, '没有历史库时应抛错');
    eq(err.code, 'NO_HISTORY_FILE');
    return;
  }

  const r = await reader.readHistory({ days: 3, limit: 50 });
  ok(Array.isArray(r.visits), 'visits 应为数组');
  ok(r.visits.length <= 50, 'limit 生效');
  ok(Number.isFinite(r.timeRange.startMs) && Number.isFinite(r.timeRange.endMs), '时间范围有效');
  eq(typeof r.source, 'string');
  ok(r.source.length > 0);
  for (const v of r.visits) {
    ok(Number.isFinite(v.visitTime), 'visitTime 必须是有限数：' + v.visitTime);
    ok(typeof v.url === 'string' && v.url.length > 0);
  }
  for (let i = 1; i < r.visits.length; i++) {
    ok(r.visits[i - 1].visitTime <= r.visits[i].visitTime, '返回结果应升序');
  }
});

// ══════════════════════════════════════════════════════════
// 6) 查询参数校验（纯函数）
// ══════════════════════════════════════════════════════════

test('parseHistoryQuery：days / start+end / limit 正常解析', function() {
  deepEq(app.parseHistoryQuery(new URLSearchParams('days=14')), { days: 14 });
  deepEq(app.parseHistoryQuery(new URLSearchParams('start=2026-09-01&end=2026-09-08')), {
    startDate: '2026-09-01', endDate: '2026-09-08',
  });
  deepEq(app.parseHistoryQuery(new URLSearchParams('days=1&limit=100')), { days: 1, limit: 100 });
  deepEq(app.parseHistoryQuery(new URLSearchParams('')), {});
});

test('parseHistoryQuery：非法参数一律 400', function() {
  const cases = ['days=abc', 'days=0', 'days=-3', 'days=999999', 'limit=abc', 'limit=0',
    'start=foo&end=bar', 'start=2026-09-01', 'start=2026-09-08&end=2026-09-01'];
  for (const q of cases) {
    let err = null;
    try { app.parseHistoryQuery(new URLSearchParams(q)); } catch (e) { err = e; }
    ok(err, '应拒绝：' + q);
    eq(err.status, 400, q);
  }
});

test('hostAllowed：只允许本机 Host', function() {
  ok(app.hostAllowed({ headers: { host: '127.0.0.1:8769' } }));
  ok(app.hostAllowed({ headers: { host: 'localhost:8769' } }));
  ok(app.hostAllowed({ headers: { host: '[::1]:8769' } }));
  ok(!app.hostAllowed({ headers: { host: 'evil.example.com' } }));
  ok(!app.hostAllowed({ headers: {} }));
});

// ══════════════════════════════════════════════════════════
// 7) HTTP 行为
// ══════════════════════════════════════════════════════════

httpTest('GET / 返回首页，静态资源可访问', async function() {
  const home = await request('GET', '/');
  eq(home.status, 200);
  ok(home.body.indexOf('历史朗读者') !== -1);
  ok(/text\/html/.test(home.headers['content-type']));

  const css = await request('GET', '/css/style.css');
  eq(css.status, 200);
  ok(/text\/css/.test(css.headers['content-type']));

  const js = await request('GET', '/js/app.js');
  eq(js.status, 200);
  ok(/javascript/.test(js.headers['content-type']));
});

httpTest('GET 不存在的文件返回 404', async function() {
  const r = await request('GET', '/nope.txt');
  eq(r.status, 404);
});

httpTest('HTTP 层拒绝路径穿越，不泄漏仓库文件', async function() {
  // 编码过的斜杠会让穿越片段原样到达处理器 → 由 resolveStaticPath 拒绝
  const encodedSlash = await request('GET', '/%2e%2e%2fpackage.json');
  eq(encodedSlash.status, 403, '编码穿越应 403：' + encodedSlash.status);

  // 其余写法：URL 解析器先归一化掉点段，最终落到 404 —— 关键是不能 200、不能泄漏
  const plain = await request('GET', '/../package.json');
  ok(plain.status === 403 || plain.status === 404, '明文穿越应被拒：' + plain.status);
  ok(plain.body.indexOf('"name": "history-reader"') === -1, '不应泄漏 package.json');

  const deep = await request('GET', '/%2e%2e/%2e%2e/package.json');
  ok(deep.status === 403 || deep.status === 404, '编码穿越应被拒：' + deep.status);
  ok(deep.body.indexOf('"name": "history-reader"') === -1, '不应泄漏 package.json');

  const serverJs = await request('GET', '/%2e%2e%2fserver.js');
  ok(serverJs.status === 403 || serverJs.status === 404, '不应拿到 server.js：' + serverJs.status);
  ok(serverJs.body.indexOf('startServer') === -1, '不应泄漏 server.js');
});

httpTest('非法百分号编码返回 400', async function() {
  const r = await request('GET', '/%zz');
  eq(r.status, 400);
});

httpTest('非本机 Host 一律 403（防 DNS rebinding）', async function() {
  const r = await request('GET', '/api/history?days=1', null, { Host: 'evil.example.com' });
  eq(r.status, 403);
  ok(r.json && r.json.error);
});

httpTest('POST /api/upload 正常数组返回叙事', async function() {
  const payload = JSON.stringify([
    visit('https://a.com/1', localTime(2026, 9, 8, 10)),
    visit('https://a.com/2', localTime(2026, 9, 8, 10, 5)),
  ]);
  const r = await request('POST', '/api/upload', payload);
  eq(r.status, 200);
  ok(r.json && Array.isArray(r.json.chapters) && r.json.chapters.length === 1, '应生成 1 个章节');
  ok(r.json.summary.length > 0 && r.json.ending.length > 0);
  ok(typeof r.json.overview === 'string' && r.json.overview.length > 0, '应返回 overview（前端会渲染）');
  eq(r.json.source, '上传的 JSON');
  noNaN(r.json, '上传');
});

httpTest('POST /api/upload 支持 {visits:[...]} 包装', async function() {
  const payload = JSON.stringify({ visits: [visit('https://b.com', localTime(2026, 9, 8, 10))] });
  const r = await request('POST', '/api/upload', payload);
  eq(r.status, 200);
  eq(r.json.chapters.length, 1);
});

httpTest('POST /api/upload 非法 JSON 返回 400 与可读错误', async function() {
  const r = await request('POST', '/api/upload', '{oops');
  eq(r.status, 400);
  ok(r.json && /JSON 解析失败/.test(r.json.error), JSON.stringify(r.json));
});

httpTest('POST /api/upload 空体 / 非数组 / null 条目都是 400 而不是 500', async function() {
  const empty = await request('POST', '/api/upload', '');
  eq(empty.status, 400);

  const notArray = await request('POST', '/api/upload', '{"visits":5}');
  eq(notArray.status, 400);
  ok(/数组/.test(notArray.json.error));

  const nullItem = await request('POST', '/api/upload', '[null]');
  eq(nullItem.status, 400, 'null 条目不应触发 TypeError/500');
  ok(nullItem.json && typeof nullItem.json.error === 'string');
  ok(!/Cannot read properties/.test(nullItem.json.error), '不应泄漏内部 TypeError');
});

httpTest('POST /api/upload 超过 1 MB 返回 413 且不挂起连接', async function() {
  const big = JSON.stringify([{ url: 'https://a.com', title: 'x'.repeat(2 * 1024 * 1024), visitTime: 1700000000000 }]);
  const r = await request('POST', '/api/upload', big);
  eq(r.status, 413, '超限请求体应返回 413：' + JSON.stringify(r));
  ok(r.json && /过大/.test(r.json.error));
});

httpTest('GET /api/upload 方法不匹配返回 404', async function() {
  const r = await request('GET', '/api/upload');
  eq(r.status, 404);
});

httpTest('GET /api/history 非法参数返回 400', async function() {
  const bad = ['days=abc', 'days=0', 'days=-3', 'days=999999', 'limit=abc',
    'start=foo&end=bar', 'start=2026-09-01', 'start=2026-09-08&end=2026-09-01'];
  for (const q of bad) {
    const r = await request('GET', '/api/history?' + q);
    eq(r.status, 400, q + ' → ' + r.status);
    ok(r.json && typeof r.json.error === 'string', q);
  }
});

httpTest('GET /api/history 正常返回叙事或 404', async function() {
  const r = await request('GET', '/api/history?days=1&limit=20');
  ok(r.status === 200 || r.status === 404, '状态应为 200/404：' + r.status);
  if (r.status === 200) {
    ok(Array.isArray(r.json.chapters));
    ok(typeof r.json.summary === 'string');
    ok(typeof r.json.source === 'string' && r.json.source.length > 0, '应带数据来源');
    noNaN(r.json, '历史');
  } else {
    ok(/找不到浏览器历史记录文件/.test(r.json.error), r.json.error);
  }
});

httpTest('畸形请求行返回 400，服务器不退出', async function() {
  const raw = await rawRequest(
    'GET http://[::1 HTTP/1.1' + '\r\n' +
    'Host: 127.0.0.1:' + serverCtx.port + '\r\n' +
    'Connection: close\r\n\r\n'
  );
  ok(/HTTP\/1\.1 400/.test(raw), '应回 400：' + raw.slice(0, 120));

  // 关键回归：以前这个请求会让进程直接崩溃
  const after = await request('GET', '/');
  eq(after.status, 200, '服务器必须在畸形请求之后继续工作');
});

httpTest('超长/非法头部由 clientError 兜底，不崩溃', async function() {
  await rawRequest('GET / HTTP/1.1\r\nHost: 127.0.0.1:' + serverCtx.port + '\r\nBad Header Without Colon\r\n\r\n');
  const after = await request('GET', '/');
  eq(after.status, 200);
});

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

(async function main() {
  console.log('The History Reader · 历史朗读者 单元测试');
  console.log('======================================');

  await runSuite('单元测试', unitTests);

  try {
    serverCtx = await startTestServer();
    await runSuite('HTTP 接口', httpTests);
  } finally {
    if (serverCtx) serverCtx.server.close();
  }

  console.log('');
  console.log('======================================');
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  if (failed > 0) {
    console.log('');
    console.log('失败详情：');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(failed > 0 ? 1 : 0);
})();
