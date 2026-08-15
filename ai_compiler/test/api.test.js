const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createApp, buildSystemPrompt, loadConfig, saveConfig } = require('../server.js');

// 起一个 mock 上游，模拟 OpenAI 兼容 /chat/completions
function startMockUpstream(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function startApp(config, opts) {
  const app = createApp(config, opts);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function post(url, body) {
  return fetch(`${url}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('buildSystemPrompt 包含语言名且指示只输出运行结果', () => {
  const p = buildSystemPrompt('Python');
  assert.match(p, /Python/);
  assert.match(p, /simulate running/i);
});

test('缺少 code 返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: 'x', apiKey: 'k', model: 'm' });
  try {
    const res = await post(url, { language: 'python' });
    assert.strictEqual(res.status, 400);
  } finally { server.close(); }
});

test('未配置 API key 返回 500 中文提示', async () => {
  const { server, url } = await startApp({ baseUrl: '', apiKey: '', model: '' });
  try {
    const res = await post(url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /\.env/);
  } finally { server.close(); }
});

test('上游非 200 时转发状态码与错误', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'invalid api key' } }));
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'bad', model: 'm' });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.match(body.error, /401/);
  } finally { app.server.close(); mock.server.close(); }
});

test('正常流式：返回 text/event-stream 并透传上游 SSE 分块', { timeout: 5000 }, async () => {
  const seen = [];
  const mock = await startMockUpstream((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      assert.strictEqual(parsed.stream, true);
      assert.match(parsed.messages[0].content, /Python/i);
      seen.push(req.headers.authorization);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'secret', model: 'm' });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');
    const text = await res.text();
    assert.match(text, /Hel/);
    assert.match(text, /Lo/i);
    assert.match(text, /DONE/);
    assert.strictEqual(seen[0], 'Bearer secret');
  } finally { app.server.close(); mock.server.close(); }
});

test('不支持的语言返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: 'x', apiKey: 'k', model: 'm' });
  try {
    const res = await post(url, { language: 'brainfuck', code: 'x' });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /不支持的语言/);
  } finally { server.close(); }
});

test('loadConfig 优先 config.json，回退环境变量', (t) => {
  const dir = require('node:fs').mkdtempSync(require('node:os').tmpdir() + '/aicfg-');
  const cfgPath = require('node:path').join(dir, 'config.json');
  t.after(() => require('node:fs').rmSync(dir, { recursive: true, force: true }));

  process.env.BASE_URL = 'https://env.example.com/v1';
  process.env.API_KEY = 'env-key';
  process.env.MODEL = 'env-model';
  process.env.PORT = '4321';
  t.after(() => {
    delete process.env.BASE_URL; delete process.env.API_KEY;
    delete process.env.MODEL; delete process.env.PORT;
  });

  // 无 config.json → 用 env
  let cfg = loadConfig(cfgPath);
  assert.strictEqual(cfg.baseUrl, 'https://env.example.com/v1');
  assert.strictEqual(cfg.apiKey, 'env-key');
  assert.strictEqual(cfg.port, 4321);

  // 有 config.json → 覆盖 env
  saveConfig({ baseUrl: 'https://file.example.com/v1', apiKey: 'file-key', model: 'file-model', port: 9999 }, cfgPath);
  cfg = loadConfig(cfgPath);
  assert.strictEqual(cfg.baseUrl, 'https://file.example.com/v1');
  assert.strictEqual(cfg.apiKey, 'file-key');
  assert.strictEqual(cfg.port, 9999);
});

test('GET /api/config 不回显 apiKey', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'secret', model: 'm', port: 3000 });
  try {
    const res = await fetch(`${url}/api/config`);
    const body = await res.json();
    assert.strictEqual(body.baseUrl, 'https://x/v1');
    assert.strictEqual(body.hasApiKey, true);
    assert.ok(!('apiKey' in body));
  } finally { server.close(); }
});

test('PUT /api/config 校验失败返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: '', apiKey: '', model: '', port: 3000 });
  try {
    let res = await fetch(`${url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'not-a-url', apiKey: 'k', model: 'm', port: 3000 }) });
    assert.strictEqual(res.status, 400);
    let body = await res.json();
    assert.match(body.error, /http/);
    res = await fetch(`${url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 70000 }) });
    assert.strictEqual(res.status, 400);
    body = await res.json();
    assert.match(body.error, /端口/);
  } finally { server.close(); }
});

test('PUT /api/config 合法保存：写 config.json 并更新内存（/api/run 用新 baseUrl）', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  const cfgPath = path.join(dir, 'config.json');
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  const app = await startApp({ baseUrl: 'https://old/v1', apiKey: 'old', model: 'm', port: 3000 }, { configPath: cfgPath });
  try {
    // 保存新配置，指向 mock
    const res = await fetch(`${app.url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: mock.url, apiKey: 'newkey', model: 'newmodel', port: 3000 }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    // 落盘
    const saved = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.strictEqual(saved.baseUrl, mock.url);
    assert.strictEqual(saved.apiKey, 'newkey');
    // 内存立即生效：/api/run 请求应打到 mock（否则请求 https://old 会失败/挂起）
    const run = await fetch(`${app.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'print(1)' }) });
    assert.strictEqual(run.status, 200);
    const text = await run.text();
    assert.match(text, /ok/);
  } finally { app.server.close(); mock.server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('POST /api/test-config 成功与失败', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      if (req.headers.authorization === 'Bearer bad') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'invalid key' } }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }));
      }
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm', port: 3000 });
  try {
    const ok = await fetch(`${app.url}/api/test-config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: mock.url, apiKey: 'good', model: 'm' }) });
    let body = await ok.json();
    assert.strictEqual(body.ok, true);
    const bad = await fetch(`${app.url}/api/test-config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: mock.url, apiKey: 'bad', model: 'm' }) });
    body = await bad.json();
    assert.strictEqual(body.ok, false);
    assert.match(body.error, /401/);
  } finally { app.server.close(); mock.server.close(); }
});

// ---- Task 1: AI 端点（explain / generate / fix / chat）----

async function startCaptureMock() {
  let captured = null;
  const mock = await startMockUpstream((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      captured = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  return { mock, getCaptured: () => captured };
}

test('POST /api/explain 流式透传且 system prompt 含解释指令', async () => {
  const { mock, getCaptured } = await startCaptureMock();
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'print(1)' }) });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /hi/);
    const c = getCaptured();
    assert.strictEqual(c.stream, true);
    assert.match(c.messages[0].content, /python/);
    assert.match(c.messages[0].content, /解释/);
    assert.strictEqual(c.messages[1].content, 'print(1)');
  } finally { app.server.close(); mock.server.close(); }
});

test('POST /api/explain 校验：缺少 code / 不支持语言返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: 'x', apiKey: 'k', model: 'm' });
  try {
    let res = await fetch(`${url}/api/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python' }) });
    assert.strictEqual(res.status, 400);
    res = await fetch(`${url}/api/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'brainfuck', code: 'x' }) });
    assert.strictEqual(res.status, 400);
  } finally { server.close(); }
});

test('POST /api/generate 流式且 system prompt 要求只输出代码', async () => {
  const { mock, getCaptured } = await startCaptureMock();
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', prompt: '排序算法' }) });
    assert.strictEqual(res.status, 200);
    await res.text();
    const c = getCaptured();
    assert.match(c.messages[0].content, /只输出代码/);
    assert.strictEqual(c.messages[1].content, '排序算法');
  } finally { app.server.close(); mock.server.close(); }
});

test('POST /api/generate 缺少 prompt 返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: 'x', apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${url}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python' }) });
    assert.strictEqual(res.status, 400);
  } finally { server.close(); }
});

test('POST /api/fix 流式且 system prompt 含错误文本', async () => {
  const { mock, getCaptured } = await startCaptureMock();
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/fix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'x=1/0', error: 'ZeroDivisionError' }) });
    assert.strictEqual(res.status, 200);
    await res.text();
    const c = getCaptured();
    assert.match(c.messages[0].content, /ZeroDivisionError/);
  } finally { app.server.close(); mock.server.close(); }
});

test('POST /api/fix 缺少 error 返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: 'x', apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${url}/api/fix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'x' }) });
    assert.strictEqual(res.status, 400);
  } finally { server.close(); }
});

test('POST /api/chat 注入 history 与用户消息', async () => {
  const { mock, getCaptured } = await startCaptureMock();
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'print(1)', history: [{ role: 'user', content: '你好' }, { role: 'assistant', content: '你好！' }], message: '谢谢' }) });
    assert.strictEqual(res.status, 200);
    await res.text();
    const c = getCaptured();
    const roles = c.messages.map((m) => m.role);
    assert.strictEqual(roles[roles.length - 3], 'user');
    assert.strictEqual(roles[roles.length - 2], 'assistant');
    assert.strictEqual(c.messages[c.messages.length - 1].content, '谢谢');
  } finally { app.server.close(); mock.server.close(); }
});

test('POST /api/chat 缺少 message 返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: 'x', apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'x' }) });
    assert.strictEqual(res.status, 400);
  } finally { server.close(); }
});

test('POST /api/run 带 history 时消息组装正确且 system prompt 含 stdin 协议', async () => {
  const { mock, getCaptured } = await startCaptureMock();
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: 'n = int(input())',
        history: [{ role: 'assistant', content: '[需要输入]' }, { role: 'user', content: '42' }],
      }),
    });
    assert.strictEqual(res.status, 200);
    await res.text();
    const c = getCaptured();
    assert.match(c.messages[0].content, /需要输入/);
    assert.strictEqual(c.messages[1].content, 'n = int(input())');
    assert.strictEqual(c.messages[2].role, 'assistant');
    assert.strictEqual(c.messages[3].role, 'user');
    assert.strictEqual(c.messages[3].content, '42');
  } finally { app.server.close(); mock.server.close(); }
});

test('POST /api/run 非法 history 项被忽略', async () => {
  const { mock, getCaptured } = await startCaptureMock();
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: 'print(1)',
        history: [{ role: 'system', content: 'hack' }, { role: 'user', content: 'ok' }, { content: 'x' }],
      }),
    });
    assert.strictEqual(res.status, 200);
    await res.text();
    const c = getCaptured();
    const roles = c.messages.map((m) => m.role);
    assert.deepStrictEqual(roles, ['system', 'user', 'user']);
    assert.strictEqual(c.messages[2].content, 'ok');
  } finally { app.server.close(); mock.server.close(); }
});

test('POST /api/run history 超长时截断到最近 24 条', async () => {
  const { mock, getCaptured } = await startCaptureMock();
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const history = [];
    for (let i = 0; i < 40; i++) history.push({ role: 'user', content: `msg-${i}` });
    const res = await fetch(`${app.url}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', code: 'print(1)', history }),
    });
    assert.strictEqual(res.status, 200);
    await res.text();
    const c = getCaptured();
    // system + 用户代码 + 截断后的 24 条
    assert.strictEqual(c.messages.length, 2 + 24);
    assert.strictEqual(c.messages[2].content, 'msg-16'); // 40-24=16，保留最近的 24 条
    assert.strictEqual(c.messages[c.messages.length - 1].content, 'msg-39');
  } finally { app.server.close(); mock.server.close(); }
});

test('上游错误为 JSON 时提取 error.message 可读信息', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Rate limit exceeded, retry in 3s', type: 'rate_limit' } }));
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 429);
    const body = await res.json();
    assert.match(body.error, /Rate limit exceeded/);
    assert.match(body.error, /429/);
  } finally { app.server.close(); mock.server.close(); }
});

test('saveConfig 自动创建父目录（打包版 userData 场景）', (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const nested = path.join(dir, 'deep', 'nested', 'config.json');
  saveConfig({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000 }, nested);
  const saved = JSON.parse(fs.readFileSync(nested, 'utf8'));
  assert.strictEqual(saved.model, 'm');
});

test('PUT /api/config 保存 temperature/maxTokens 并透传到 /api/run 上游请求', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  const cfgPath = path.join(dir, 'config.json');
  let captured = null;
  const mock = await startMockUpstream((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      captured = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm', port: 3000 }, { configPath: cfgPath });
  try {
    const res = await fetch(`${app.url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: mock.url, apiKey: 'k', model: 'm', port: 3000, temperature: 1.2, maxTokens: 2048 }) });
    assert.strictEqual(res.status, 200);
    // GET 回显
    const got = await (await fetch(`${app.url}/api/config`)).json();
    assert.strictEqual(got.temperature, 1.2);
    assert.strictEqual(got.maxTokens, 2048);
    // 落盘
    const saved = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.strictEqual(saved.temperature, 1.2);
    assert.strictEqual(saved.maxTokens, 2048);
    // 透传上游
    await fetch(`${app.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'print(1)' }) });
    assert.strictEqual(captured.temperature, 1.2);
    assert.strictEqual(captured.max_tokens, 2048);
    assert.strictEqual(captured.stream, true);
  } finally { app.server.close(); mock.server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('PUT /api/config 校验非法 temperature / maxTokens 返回 400', async () => {
  const { server, url } = await startApp({ baseUrl: '', apiKey: '', model: '', port: 3000 });
  try {
    let res = await fetch(`${url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000, temperature: 3 }) });
    assert.strictEqual(res.status, 400);
    let body = await res.json();
    assert.match(body.error, /温度/);
    res = await fetch(`${url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000, maxTokens: 0 }) });
    assert.strictEqual(res.status, 400);
    body = await res.json();
    assert.match(body.error, /最大输出/);
  } finally { server.close(); }
});

test('fontSize：默认 14，保存 9-32 生效，越界返回 400，GET 回显', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  const cfgPath = path.join(dir, 'config.json');
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000 }, { configPath: cfgPath });
  try {
    // 未配置时默认 14
    let got = await (await fetch(`${url}/api/config`)).json();
    assert.strictEqual(got.fontSize, 14);
    // 越界 / 非法返回 400
    let res = await fetch(`${url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000, fontSize: 40 }) });
    assert.strictEqual(res.status, 400);
    let body = await res.json();
    assert.match(body.error, /字号/);
    // 合法保存：回显 + 落盘
    res = await fetch(`${url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000, fontSize: 18 }) });
    assert.strictEqual(res.status, 200);
    got = await (await fetch(`${url}/api/config`)).json();
    assert.strictEqual(got.fontSize, 18);
    const saved = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.strictEqual(saved.fontSize, 18);
    // 留空回退默认 14
    res = await fetch(`${url}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000, fontSize: '' }) });
    assert.strictEqual(res.status, 200);
    got = await (await fetch(`${url}/api/config`)).json();
    assert.strictEqual(got.fontSize, 14);
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadConfig 从环境变量读取 TEMPERATURE / MAX_TOKENS', (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  const cfgPath = path.join(dir, 'config.json');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const oldT = process.env.TEMPERATURE;
  const oldM = process.env.MAX_TOKENS;
  process.env.TEMPERATURE = '0.7';
  process.env.MAX_TOKENS = '512';
  t.after(() => {
    if (oldT === undefined) delete process.env.TEMPERATURE; else process.env.TEMPERATURE = oldT;
    if (oldM === undefined) delete process.env.MAX_TOKENS; else process.env.MAX_TOKENS = oldM;
  });
  const cfg = loadConfig(cfgPath);
  assert.strictEqual(cfg.temperature, 0.7);
  assert.strictEqual(cfg.maxTokens, 512);
  // config.json 覆盖 env
  saveConfig({ temperature: 1.5, maxTokens: 4096 }, cfgPath);
  const cfg2 = loadConfig(cfgPath);
  assert.strictEqual(cfg2.temperature, 1.5);
  assert.strictEqual(cfg2.maxTokens, 4096);
});
