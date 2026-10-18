const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, loadConfig, saveConfig, sanitizeHistory, LIMITS } = require('../server.js');
const { parseSse } = require('../public/sse.js');

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

function post(url, body, options = {}) {
  return fetch(`${url}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
}

// —— 上游忽略 stream:true 返回普通 JSON ——

test('上游返回普通 JSON（忽略 stream:true）时转换为 SSE 供前端显示', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'HELLO-NONSTREAM' } }] }));
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');
    const text = await res.text();
    assert.match(text, /^data: /, '应以 SSE data: 行输出');
    assert.match(text, /HELLO-NONSTREAM/);
    assert.match(text, /\[DONE\]/);
  } finally { app.server.close(); mock.server.close(); }
});

test('上游返回 JSON 错误体时转换为 SSE 错误事件', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'model overloaded' } }));
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const text = await (await post(app.url, { language: 'python', code: 'print(1)' })).text();
    assert.match(text, /"error"/);
    assert.match(text, /model overloaded/);
  } finally { app.server.close(); mock.server.close(); }
});

test('上游返回 200 但内容不是 JSON 时也给出可读错误', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>gateway error</html>');
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const text = await (await post(app.url, { language: 'python', code: 'print(1)' })).text();
    assert.match(text, /gateway error/);
  } finally { app.server.close(); mock.server.close(); }
});

// —— 网络失败重试与超时 ——

test('连接失败自动重试一次：第一次断开、第二次成功', async () => {
  let attempts = 0;
  const mock = await startMockUpstream((req, res) => {
    attempts += 1;
    req.resume();
    if (attempts === 1) { req.socket.destroy(); return; }
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"retried-ok"}}]}\n\n');
      res.end('data: [DONE]\n\n');
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' }, { upstreamTimeoutMs: 5000 });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /retried-ok/);
    assert.strictEqual(attempts, 2);
  } finally { app.server.close(); mock.server.close(); }
});

test('连接始终失败：重试后返回 502（共 2 次尝试）', async () => {
  let attempts = 0;
  const mock = await startMockUpstream((req) => {
    attempts += 1;
    req.socket.destroy();
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' }, { upstreamTimeoutMs: 5000 });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 502);
    assert.match((await res.json()).error, /无法连接上游/);
    assert.strictEqual(attempts, 2);
  } finally { app.server.close(); mock.server.close(); }
});

test('上游不返回响应头时超时返回 504（可配置超时时间）', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume(); // 永不响应
    res.on('close', () => {});
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' }, { upstreamTimeoutMs: 300 });
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 504);
    assert.match((await res.json()).error, /超时/);
  } finally { app.server.close(); mock.server.close(); }
});

test('流式响应中途卡住：空闲超时后发出 SSE 错误事件', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
      // 之后不再写任何数据，也不结束
    });
  });
  const app = await startApp(
    { baseUrl: mock.url, apiKey: 'k', model: 'm' },
    { upstreamTimeoutMs: 5000, upstreamIdleMs: 300 }
  );
  try {
    const res = await post(app.url, { language: 'python', code: 'print(1)' });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /partial/);
    assert.match(text, /event: error/);
    assert.match(text, /超时/);
  } finally { app.server.close(); mock.server.close(); }
});

// —— 配置读取 ——

test('loadConfig 校验端口：非整数回退 3000，字符串数字可接受', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  const cfgPath = path.join(dir, 'config.json');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const oldPort = process.env.PORT;
  delete process.env.PORT;
  t.after(() => { if (oldPort !== undefined) process.env.PORT = oldPort; });

  saveConfig({ port: 'abc' }, cfgPath);
  assert.strictEqual(loadConfig(cfgPath).port, 3000);
  saveConfig({ port: 70000 }, cfgPath);
  assert.strictEqual(loadConfig(cfgPath).port, 3000);
  saveConfig({ port: '4321' }, cfgPath);
  assert.strictEqual(loadConfig(cfgPath).port, 4321);
});

test('loadConfig 规范化 config.json 中的 baseUrl，非法值忽略', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  const cfgPath = path.join(dir, 'config.json');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  saveConfig({ baseUrl: 'https://api.deepseek.com/v1/', apiKey: 'k', model: 'm' }, cfgPath);
  assert.strictEqual(loadConfig(cfgPath).baseUrl, 'https://api.deepseek.com/v1');
  saveConfig({ baseUrl: 'not-a-url', apiKey: 'k', model: 'm' }, cfgPath);
  assert.strictEqual(loadConfig(cfgPath).baseUrl, '');
});

test('saveConfig 原子写入：不残留临时文件，且覆盖写入不损坏旧内容', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicfg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cfgPath = path.join(dir, 'config.json');
  saveConfig({ baseUrl: 'https://a/v1', apiKey: 'k', model: 'm', port: 3000 }, cfgPath);
  saveConfig({ baseUrl: 'https://b/v1', apiKey: 'k', model: 'm', port: 3000 }, cfgPath);
  const files = fs.readdirSync(dir);
  assert.deepStrictEqual(files, ['config.json']);
  assert.strictEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')).baseUrl, 'https://b/v1');
});

test('sanitizeHistory 限制单条与总长度、过滤非法项', () => {
  const long = 'x'.repeat(LIMITS.MAX_CODE_CHARS);
  const out = sanitizeHistory([
    { role: 'system', content: 'drop' },
    { role: 'user', content: 'ok' },
    { role: 'assistant', content: long },
    { role: 'user', content: 42 },
    null,
  ]);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].content, 'ok');
  assert.strictEqual(out[1].content.length, 100000); // MAX_HISTORY_ITEM_CHARS
});

test('sanitizeHistory 去掉控制字符', () => {
  const out = sanitizeHistory([{ role: 'user', content: 'a\u0000b\u001fc' }]);
  assert.strictEqual(out[0].content, 'abc');
});

// —— 端到端：后端 SSE → 前端解析器 ——

test('端到端：/api/run 的 SSE 流经前端 parseSse 能还原完整输出', async () => {
  const mock = await startMockUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"Hello, "}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"World!"}}]}\n\n');
      res.end('data: [DONE]\n\n');
    });
  });
  const app = await startApp({ baseUrl: mock.url, apiKey: 'k', model: 'm' });
  try {
    const res = await post(app.url, { language: 'python', code: 'print("Hello, World!")' });
    assert.strictEqual(res.status, 200);
    // 按 7 字节切块喂给解析器，模拟真实网络分片
    const bytes = new Uint8Array(await res.arrayBuffer());
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    for (let i = 0; i < bytes.length; i += 7) {
      buffer += decoder.decode(bytes.slice(i, i + 7), { stream: true });
      const r = parseSse(buffer);
      buffer = r.buffer;
      content += r.content;
    }
    const tail = parseSse(buffer, { flush: true });
    content += tail.content;
    assert.strictEqual(content, 'Hello, World!');
    assert.strictEqual(tail.errored, false);
  } finally { app.server.close(); mock.server.close(); }
});

test('静态资源包含新增的前端核心脚本', async () => {
  const { server, url } = await startApp({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' });
  try {
    for (const file of ['/index.html', '/sse.js', '/markdown-core.js', '/output.js', '/style.css']) {
      const res = await fetch(url + file);
      assert.strictEqual(res.status, 200, `${file} 应可访问`);
      assert.match(res.headers.get('content-type'), /javascript|html|css/);
    }
    const index = await (await fetch(`${url}/index.html`)).text();
    assert.match(index, /\/sse\.js/);
    assert.match(index, /\/markdown-core\.js/);
  } finally { server.close(); }
});
