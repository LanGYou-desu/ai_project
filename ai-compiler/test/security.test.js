const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createApp,
  normalizeBaseUrl,
  completionsUrl,
  isBlockedUpstreamHost,
  LIMITS,
} = require('../server.js');

function startMockUpstream(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
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

function post(url, body, headers) {
  return fetch(`${url}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function waitFor(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return predicate();
}

// —— baseUrl 规范化 ——

test('normalizeBaseUrl 去掉末尾斜杠与重复的 /chat/completions', () => {
  assert.strictEqual(normalizeBaseUrl('https://api.deepseek.com/v1/'), 'https://api.deepseek.com/v1');
  assert.strictEqual(normalizeBaseUrl('  https://api.deepseek.com/v1  '), 'https://api.deepseek.com/v1');
  assert.strictEqual(normalizeBaseUrl('https://api.deepseek.com/'), 'https://api.deepseek.com');
  assert.strictEqual(normalizeBaseUrl('https://x/v1/chat/completions'), 'https://x/v1');
  assert.strictEqual(normalizeBaseUrl('https://x/v1/chat/completions/'), 'https://x/v1');
});

test('normalizeBaseUrl 拒绝非法地址（非 http/https、带凭据）', () => {
  assert.strictEqual(normalizeBaseUrl(''), null);
  assert.strictEqual(normalizeBaseUrl('not-a-url'), null);
  assert.strictEqual(normalizeBaseUrl('file:///etc/passwd'), null);
  assert.strictEqual(normalizeBaseUrl('ftp://x/y'), null);
  assert.strictEqual(normalizeBaseUrl('http://user:pass@x/v1'), null);
  assert.strictEqual(normalizeBaseUrl(123), null);
});

test('completionsUrl 保留 query（Azure 等网关依赖 api-version）', () => {
  assert.strictEqual(completionsUrl('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/v1/chat/completions');
  assert.strictEqual(
    completionsUrl('https://x/openai/deployments/y?api-version=2024-02-01'),
    'https://x/openai/deployments/y/chat/completions?api-version=2024-02-01'
  );
  assert.strictEqual(completionsUrl('bogus'), null);
});

test('isBlockedUpstreamHost 拦截链路本地/元数据地址', () => {
  assert.strictEqual(isBlockedUpstreamHost('http://169.254.169.254/latest/meta-data'), true);
  assert.strictEqual(isBlockedUpstreamHost('http://[fe80::1]/v1'), true);
  assert.strictEqual(isBlockedUpstreamHost('http://127.0.0.1:11434/v1'), false); // Ollama 本地允许
  assert.strictEqual(isBlockedUpstreamHost('https://api.deepseek.com'), false);
});

test('baseUrl 带末尾斜杠时上游收到的路径不会出现双斜杠', async () => {
  let seenPath = null;
  const mock = await startMockUpstream((req, res) => {
    seenPath = req.url;
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: [DONE]\n\n');
    });
  });
  const app = await startApp({ baseUrl: `${mock.url}/v1/`, apiKey: 'k', model: 'm' });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 200);
    await res.text();
    assert.strictEqual(seenPath, '/v1/chat/completions');
  } finally { app.server.close(); mock.server.close(); }
});

// —— 密钥外泄 / SSRF ——

test('/api/test-config 不会把已保存的密钥发到另一个地址（密钥外泄）', async () => {
  let attackerHits = 0;
  let attackerAuth = null;
  const attacker = await startMockUpstream((req, res) => {
    attackerHits += 1;
    attackerAuth = req.headers.authorization;
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"choices":[]}');
    });
  });
  const app = await startApp({ baseUrl: 'https://api.deepseek.com', apiKey: 'sk-real-secret', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/test-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: attacker.url, model: 'm' }), // 故意不带 apiKey
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /API 密钥/);
    assert.strictEqual(attackerHits, 0, '未填密钥时不应向上游发任何请求');
    assert.strictEqual(attackerAuth, null);
  } finally { app.server.close(); attacker.server.close(); }
});

test('/api/test-config 地址与已保存一致（仅末尾斜杠不同）时才复用已保存密钥', async () => {
  let auth = null;
  const mock = await startMockUpstream((req, res) => {
    auth = req.headers.authorization;
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"choices":[]}');
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'sk-saved', model: 'm' });
  try {
    const res = await fetch(`${app.url}/api/test-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: `${mock.url}/`, model: 'm' }),
    });
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(auth, 'Bearer sk-saved');
  } finally { app.server.close(); mock.server.close(); }
});

test('/api/test-config 拒绝云元数据地址与非 http 地址', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
  try {
    let res = await fetch(`${url}/api/test-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'http://169.254.169.254/latest/meta-data', apiKey: 'k', model: 'm' }),
    });
    assert.strictEqual(res.status, 400);
    res = await fetch(`${url}/api/test-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'file:///etc/passwd', apiKey: 'k', model: 'm' }),
    });
    assert.strictEqual(res.status, 400);
  } finally { server.close(); }
});

test('API 请求校验 Origin / Host，拒绝非本机页面调用', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
  const port = server.address().port;
  try {
    let res = await fetch(`${url}/api/config`, { headers: { Origin: 'http://evil.example' } });
    assert.strictEqual(res.status, 403);
    res = await fetch(`${url}/api/config`, { headers: { Origin: 'http://127.0.0.1:3000' } });
    assert.strictEqual(res.status, 200);
    // fetch 会忽略手工设置的 Host，用底层 http 请求验证 DNS rebinding 防护
    const status = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/config', headers: { Host: 'evil.example' } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(status, 403);
  } finally { server.close(); }
});

test('安全响应头存在（nosniff / CSP / Referrer-Policy）', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${url}/`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('referrer-policy'), 'no-referrer');
    assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.strictEqual(res.headers.get('x-powered-by'), null);
  } finally { server.close(); }
});

// —— 请求体 / 输入上限 ——

test('非法 JSON 请求体返回 JSON 错误（不是 HTML 堆栈页）', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
  try {
    const res = await post(url, '{bad json');
    assert.strictEqual(res.status, 400);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.match(body.error, /JSON/);
    assert.ok(!JSON.stringify(body).includes('at '), '不应包含堆栈');
  } finally { server.close(); }
});

test('请求体超过 4MB 返回 413 JSON', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
  try {
    const res = await post(url, JSON.stringify({ language: 'python', code: 'x'.repeat(5 * 1024 * 1024) }));
    assert.strictEqual(res.status, 413);
    assert.match(res.headers.get('content-type'), /application\/json/);
  } finally { server.close(); }
});

test('未知 /api 路径返回 JSON 404', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
  try {
    const res = await fetch(`${url}/api/not-exist`);
    assert.strictEqual(res.status, 404);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.match(body.error, /接口不存在/);
  } finally { server.close(); }
});

test('代码超过上限返回 413 且不打到上游', async () => {
  let hits = 0;
  const mock = await startMockUpstream((req, res) => {
    hits += 1;
    req.resume();
    req.on('end', () => { res.writeHead(200); res.end(); });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await post(app.url, { language: 'python', code: 'x'.repeat(LIMITS.MAX_CODE_CHARS + 1) });
    assert.strictEqual(res.status, 413);
    const body = await res.json();
    assert.match(body.error, /代码过长/);
    assert.strictEqual(hits, 0);
  } finally { app.server.close(); mock.server.close(); }
});

test('并发上限：超出后返回 429', async () => {
  const held = [];
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => held.push(res)); // 故意不响应，保持连接
  });
  const app = await startApp(
    { baseUrl: mock.url, apiKey: 'k', model: 'm' },
    { maxConcurrent: 2, upstreamTimeoutMs: 500 }
  );
  const inflight = [];
  try {
    inflight.push(post(app.url, { language: 'python', code: 'print(1)' }).catch(() => null));
    inflight.push(post(app.url, { language: 'python', code: 'print(2)' }).catch(() => null));
    assert.ok(await waitFor(() => held.length === 2), '前两个请求应到达上游');
    const res = await post(app.url, { language: 'python', code: 'print(3)' });
    assert.strictEqual(res.status, 429);
    assert.match((await res.json()).error, /请求过多/);
  } finally {
    for (const r of held) { if (r.socket) r.socket.destroy(); else r.destroy(); }
    await Promise.all(inflight);
    app.server.close(); mock.server.close();
  }
});

// —— 配置写入 ——

test('PUT /api/config 规范化 baseUrl（去末尾斜杠）并拒绝带凭据的地址', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cfgPath = path.join(dir, 'config.json');
  const { server, url } = await startApp({ baseUrl: '', apiKey: '', model: '', port: 3000 }, { configPath: cfgPath });
  try {
    let res = await fetch(`${url}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1/', apiKey: 'k', model: 'm', port: 3000 }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')).baseUrl, 'https://api.deepseek.com/v1');
    res = await fetch(`${url}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'https://user:pw@x/v1', apiKey: 'k', model: 'm', port: 3000 }),
    });
    assert.strictEqual(res.status, 400);
  } finally { server.close(); }
});

test('PUT /api/config 显式留空可清除 temperature / maxTokens', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cfgPath = path.join(dir, 'config.json');
  const { server, url } = await startApp(
    { baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000, temperature: 1.2, maxTokens: 2048 },
    { configPath: cfgPath }
  );
  try {
    // 字段缺省 → 保留原值
    let res = await fetch(`${url}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000 }),
    });
    assert.strictEqual(res.status, 200);
    let got = await (await fetch(`${url}/api/config`)).json();
    assert.strictEqual(got.temperature, 1.2);
    assert.strictEqual(got.maxTokens, 2048);
    // 显式空串 → 清除（回退模型默认）
    res = await fetch(`${url}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', port: 3000, temperature: '', maxTokens: '' }),
    });
    assert.strictEqual(res.status, 200);
    got = await (await fetch(`${url}/api/config`)).json();
    assert.strictEqual(got.temperature, undefined);
    assert.strictEqual(got.maxTokens, undefined);
    const saved = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.ok(!('temperature' in saved) && !('maxTokens' in saved));
  } finally { server.close(); }
});
