const express = require('express');
const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, 'config.json');

// —— 输入 / 上游限制（防止本地代理被当成任意请求转发器滥用）——
const MAX_CODE_CHARS = 200000;             // 单次发送给上游的代码长度上限
const MAX_TEXT_CHARS = 32000;              // 提问 / 需求描述 / 报错文本上限
const MAX_HISTORY_ITEM_CHARS = 100000;     // 单条历史消息上限
const MAX_HISTORY_TOTAL_CHARS = 400000;    // 历史消息总长度上限
const MAX_HISTORY = 24;                    // 单次请求携带的最大历史消息条数
const MAX_CONCURRENT_UPSTREAMS = 4;        // 同时进行的上游请求上限
const DEFAULT_UPSTREAM_TIMEOUT_MS = 30000; // 连接 / 首字节超时
const DEFAULT_UPSTREAM_IDLE_MS = 60000;    // 流式空闲超时
const MAX_UPSTREAM_ERROR_CHARS = 500;      // 转发给前端的上游错误文本上限
const MAX_UPSTREAM_BODY_BYTES = 2 * 1024 * 1024; // 非流式上游响应读取上限

function loadConfig(configPath = CONFIG_PATH) {
  const envConfig = {
    baseUrl: normalizeBaseUrl(process.env.BASE_URL) || '',
    apiKey: typeof process.env.API_KEY === 'string' ? process.env.API_KEY.trim() : '',
    model: typeof process.env.MODEL === 'string' ? process.env.MODEL.trim() : '',
    port: toPort(process.env.PORT) ?? 3000,
    temperature: toOptionalNumber(process.env.TEMPERATURE, 0, 2),
    maxTokens: toOptionalNumber(process.env.MAX_TOKENS, 1, 1000000),
    fontSize: toOptionalNumber(process.env.EDITOR_FONT_SIZE, 9, 32),
  };
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!fileConfig || typeof fileConfig !== 'object' || Array.isArray(fileConfig)) fileConfig = {};
    } catch (err) {
      console.error('[ai-compiler] config.json 解析失败，使用默认配置：', err.message);
      fileConfig = {};
    }
  }
  const fileBaseUrl = normalizeBaseUrl(fileConfig.baseUrl);
  if (fileConfig.baseUrl && !fileBaseUrl) {
    console.error('[ai-compiler] config.json 中的 baseUrl 非法（需以 http:// 或 https:// 开头），已忽略');
  }
  return {
    baseUrl: fileBaseUrl || envConfig.baseUrl,
    apiKey: (typeof fileConfig.apiKey === 'string' && fileConfig.apiKey.trim()) || envConfig.apiKey,
    model: (typeof fileConfig.model === 'string' && fileConfig.model.trim()) || envConfig.model,
    // 端口必须是合法整数：否则 listen() 会把非数字字符串当成命名管道路径
    port: toPort(fileConfig.port) ?? envConfig.port,
    temperature: toOptionalNumber(fileConfig.temperature, 0, 2) ?? envConfig.temperature,
    maxTokens: toOptionalNumber(fileConfig.maxTokens, 1, 1000000) ?? envConfig.maxTokens,
    fontSize: toOptionalNumber(fileConfig.fontSize, 9, 32) ?? envConfig.fontSize ?? 14,
  };
}

// 把环境变量/输入解析为可选数值：空或非法返回 undefined（不传上游）
function toOptionalNumber(raw, min, max) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function toPort(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return undefined;
  return n;
}

// 规范化 OpenAI 兼容接口地址：
// - 只接受 http/https，拒绝带用户名密码的 URL（避免凭据混入日志/上游）
// - 去掉末尾斜杠与重复的 /chat/completions 后缀（避免拼出 //chat/completions）
// - 保留 query（Azure 等网关的 api-version 依赖它）
// 非法返回 null
function normalizeBaseUrl(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || !/^https?:\/\//i.test(s)) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (!u.hostname) return null;
  let pathname = u.pathname.replace(/\/+$/, '');
  pathname = pathname.replace(/\/chat\/completions$/i, '').replace(/\/+$/, '');
  return `${u.origin}${pathname}${u.search}`;
}

// 由规范化后的 baseUrl 拼出 /chat/completions 地址（query 保持在末尾）
function completionsUrl(baseUrl) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return null;
  try {
    const u = new URL(base);
    u.pathname = `${u.pathname.replace(/\/+$/, '')}/chat/completions`;
    return u.toString();
  } catch { return null; }
}

// 链路本地地址（云元数据服务等）不可能是合法的 AI 接口，直接拒绝
function isBlockedUpstreamHost(baseUrl) {
  let host;
  try { host = new URL(baseUrl).hostname.toLowerCase(); } catch { return true; }
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.startsWith('169.254.')) return true;      // IPv4 link-local / 云元数据
  if (host.startsWith('fe80:')) return true;         // IPv6 link-local
  return false;
}

// 原子写入：先写临时文件再 rename，避免写入中断把 config.json 截断成半截 JSON
function saveConfig(config, configPath = CONFIG_PATH) {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(configPath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  try {
    fs.renameSync(tmp, configPath);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* 清理失败忽略 */ }
    throw err;
  }
}

const SUPPORTED_LANGUAGES = new Set([
  'python', 'javascript', 'typescript', 'c', 'cpp', 'java', 'go',
]);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function tooLarge(res, message) {
  return res.status(413).json({ error: message });
}

// 校验并归一化一段用户文本；返回 null 表示非法（调用方给出具体提示）
function cleanText(value, maxChars) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, maxChars);
}

// 去掉控制字符（NUL 等会破坏 JSON/日志，也不该进 prompt）
function stripControlChars(text) {
  return String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

// 过滤非法历史消息、限制单条/总长度，并截断到最近 MAX_HISTORY 条
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const valid = [];
  let total = 0;
  for (const h of history) {
    if (!h || (h.role !== 'user' && h.role !== 'assistant') || typeof h.content !== 'string') continue;
    const content = stripControlChars(h.content).slice(0, MAX_HISTORY_ITEM_CHARS);
    if (!content) continue;
    if (total + content.length > MAX_HISTORY_TOTAL_CHARS) break;
    total += content.length;
    valid.push({ role: h.role, content });
  }
  return valid.slice(-MAX_HISTORY);
}

// 尽量从上游错误响应中提取可读信息（OpenAI 兼容格式的 error.message）
async function extractUpstreamError(res) {
  const text = await res.text().catch(() => '');
  let detail = '';
  try {
    const json = JSON.parse(text);
    const msg = json?.error?.message || json?.error || json?.message;
    if (typeof msg === 'string' && msg) detail = msg;
    else if (msg && typeof msg === 'object') detail = JSON.stringify(msg);
  } catch { /* 非 JSON 响应，退回原文 */ }
  if (!detail) detail = text;
  detail = stripControlChars(detail).replace(/\s+/g, ' ').trim().slice(0, MAX_UPSTREAM_ERROR_CHARS);
  const retryAfter = res.headers && res.headers.get ? res.headers.get('retry-after') : null;
  const suffix = retryAfter ? `（建议 ${retryAfter}s 后重试）` : '';
  return `${res.status}：${detail}${suffix}`;
}

function buildSystemPrompt(language) {
  return (
    `You are a ${language} code interpreter. Simulate running the following code ` +
    `and output ONLY the program's output (stdout) or error information. ` +
    `Do not add extra explanation. Do not use markdown code blocks. ` +
    `When the program needs to read from standard input (stdin), output a single line ` +
    `"[需要输入]" and then stop, waiting for user input. ` +
    `Subsequent user messages are the program's stdin; treat them as stdin and continue simulating.`
  );
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    if (signal) signal.addEventListener('abort', finish, { once: true });
  });
}

// 连接失败（未收到响应头）时重试一次；已 abort 时立即抛出
async function fetchUpstream(url, init, { signal, retries = 1, retryDelayMs = 300 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal && signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    try {
      return await fetch(url, { ...init, signal });
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError' || err.name === 'TimeoutError') throw err;
      if (attempt < retries) await sleep(retryDelayMs * (attempt + 1), signal);
    }
  }
  throw lastErr;
}

// 带上限读取响应体（非流式上游可能返回超大 JSON）
async function readBodyLimited(response, maxBytes) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* 忽略 */ }
      break;
    }
  }
  out += decoder.decode();
  return out;
}

// 上游忽略 stream:true 返回普通 JSON 时，转换成 SSE，否则前端解析不到任何内容
function sseFromJsonBody(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'data: [DONE]\n\n';
  try {
    const json = JSON.parse(text);
    const choice = json && json.choices && json.choices[0];
    const content = choice && (choice.message?.content ?? choice.delta?.content ?? choice.text);
    if (typeof content === 'string' && content) {
      return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`;
    }
    const err = (json && (json.error?.message || json.error || json.message)) || '';
    if (err) {
      const msg = typeof err === 'string' ? err : JSON.stringify(err);
      return `data: ${JSON.stringify({ error: stripControlChars(msg).slice(0, MAX_UPSTREAM_ERROR_CHARS) })}\n\n`;
    }
  } catch { /* 非 JSON：按错误文本处理 */ }
  return `data: ${JSON.stringify({ error: stripControlChars(text).slice(0, MAX_UPSTREAM_ERROR_CHARS) })}\n\n`;
}

async function streamCompletions(config, messages, req, res, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const idleMs = opts.idleMs ?? DEFAULT_UPSTREAM_IDLE_MS;
  if (!config.apiKey || !config.baseUrl || !config.model) {
    return res.status(500).json({
      error: '后端未配置 BASE_URL / API_KEY / MODEL，请在设置页或 .env 中配置后重启',
    });
  }
  const url = completionsUrl(config.baseUrl);
  if (!url) {
    return res.status(500).json({ error: '接口地址无效：请填写以 http:// 或 https:// 开头的地址' });
  }
  const controller = new AbortController();
  let clientGone = false;
  let timedOut = false;
  const onClientClose = () => {
    if (!res.writableEnded) {
      clientGone = true;
      controller.abort();
    }
  };
  res.on('close', onClientClose);
  res.on('error', () => { /* 客户端断开时的写错误不应冒泡成未捕获异常 */ });

  let timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const resetTimer = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  };
  const cleanup = () => {
    clearTimeout(timer);
    res.removeListener('close', onClientClose);
  };
  const write = (chunk) => {
    if (!res.writableEnded && !res.destroyed) res.write(chunk);
  };

  let upstream;
  try {
    const body = { model: config.model, messages, stream: true };
    if (config.temperature !== undefined) body.temperature = config.temperature;
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens;
    upstream = await fetchUpstream(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    }, { signal: controller.signal, retries: opts.retries ?? 1 });
  } catch (err) {
    cleanup();
    if (clientGone) return;
    if (timedOut) {
      console.error('[ai-compiler] 上游 AI 服务响应超时');
      return res.status(504).json({ error: '上游 AI 服务响应超时，请检查网络或接口地址' });
    }
    if (err.name === 'AbortError') return;
    console.error('[ai-compiler] 无法连接上游 AI 服务：', err.message);
    return res.status(502).json({ error: '无法连接上游 AI 服务，请检查配置与网络' });
  }

  if (!upstream.ok) {
    const detail = await extractUpstreamError(upstream);
    cleanup();
    if (clientGone) return;
    console.error(`[ai-compiler] 上游返回 ${upstream.status}：`, detail);
    const status = upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502;
    return res.status(status).json({ error: `上游 AI 服务返回 ${detail}` });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/event-stream')) {
      // 上游返回普通 JSON（忽略 stream:true）→ 转成 SSE 再发给前端
      resetTimer(idleMs);
      const raw = await readBodyLimited(upstream, MAX_UPSTREAM_BODY_BYTES);
      write(sseFromJsonBody(raw));
      res.end();
      return;
    }
    if (!upstream.body) {
      write(`data: ${JSON.stringify({ error: '上游未返回响应体' })}\n\n`);
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      resetTimer(idleMs);
      const { done, value } = await reader.read();
      if (done) break;
      write(decoder.decode(value, { stream: true }));
    }
    write(decoder.decode());
    res.end();
  } catch (err) {
    if (clientGone) {
      if (!res.writableEnded) res.end();
      return;
    }
    const msg = timedOut ? '上游响应超时' : 'stream interrupted';
    if (timedOut) console.error('[ai-compiler] 流式响应超时：', err.message);
    write(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  } finally {
    cleanup();
  }
}

// 本机来源校验：阻止跨站页面 / DNS rebinding 直接调用本地代理（会消耗用户的 API 额度）
function isLocalHostname(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

function createApp(config, opts = {}) {
  const configPath = opts.configPath || CONFIG_PATH;
  const upstreamOpts = {
    timeoutMs: opts.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS,
    idleMs: opts.upstreamIdleMs ?? DEFAULT_UPSTREAM_IDLE_MS,
    retries: opts.upstreamRetries ?? 1,
  };
  const maxConcurrent = opts.maxConcurrent ?? MAX_CONCURRENT_UPSTREAMS;
  const app = express();
  app.disable('x-powered-by');

  // 安全响应头（不设置 default-src，避免影响 Monaco CDN 加载）
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    next();
  });

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      let originHost = null;
      try { originHost = new URL(origin).hostname; } catch { /* 非法 Origin 视为跨站 */ }
      if (!isLocalHostname(originHost)) return res.status(403).json({ error: '拒绝来自非本机页面的请求' });
    }
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (host && !isLocalHostname(host)) return res.status(403).json({ error: '拒绝非法 Host' });
    next();
  });

  app.use(express.json({ limit: '4mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // 同时进行的上游请求上限：防止本地代理被并发刷爆（消耗用户额度）
  let activeStreams = 0;
  const limited = (fn) => async (req, res, next) => {
    if (activeStreams >= maxConcurrent) {
      return res.status(429).json({ error: `同时进行的请求过多（上限 ${maxConcurrent}），请稍后重试` });
    }
    activeStreams += 1;
    try {
      await fn(req, res, next);
    } finally {
      activeStreams -= 1;
    }
  };

  app.get('/api/config', (req, res) => {
    res.json({
      baseUrl: config.baseUrl,
      model: config.model,
      port: config.port,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      fontSize: config.fontSize ?? 14,
      hasApiKey: Boolean(config.apiKey),
    });
  });

  app.put('/api/config', wrap((req, res) => {
    const { baseUrl, apiKey, model, port, temperature, maxTokens, fontSize } = req.body || {};
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
      return res.status(400).json({ error: '接口地址必须以 http:// 或 https:// 开头（且不能包含用户名密码）' });
    }
    const newModel = cleanText(model, 200);
    if (!newModel) {
      return res.status(400).json({ error: '模型不能为空' });
    }
    const portNum = toPort(port);
    if (portNum === undefined) {
      return res.status(400).json({ error: '端口必须是 1-65535 的整数' });
    }
    const newApiKey = (typeof apiKey === 'string' && apiKey.trim()) || config.apiKey;
    if (!newApiKey) {
      return res.status(400).json({ error: 'API 密钥不能为空（首次配置必须填写）' });
    }
    const tempNum = toOptionalNumber(temperature, 0, 2);
    if (temperature !== undefined && temperature !== null && temperature !== '' && tempNum === undefined) {
      return res.status(400).json({ error: '温度必须是 0-2 之间的数字（留空为默认）' });
    }
    const tokensNum = toOptionalNumber(maxTokens, 1, 1000000);
    if (maxTokens !== undefined && maxTokens !== null && maxTokens !== '' && tokensNum === undefined) {
      return res.status(400).json({ error: '最大输出长度必须是正整数（留空为默认）' });
    }
    const fontNum = toOptionalNumber(fontSize, 9, 32);
    if (fontSize !== undefined && fontSize !== null && fontSize !== '' && fontNum === undefined) {
      return res.status(400).json({ error: '编辑器字号必须是 9-32 的数字' });
    }
    const newConfig = {
      baseUrl: normalizedBaseUrl,
      apiKey: newApiKey,
      model: newModel,
      port: portNum,
      fontSize: fontNum ?? 14,
    };
    // 显式留空 = 清除该项（回退模型默认）；字段缺省 = 保留原值
    if (temperature !== undefined) { if (tempNum !== undefined) newConfig.temperature = tempNum; }
    else if (config.temperature !== undefined) newConfig.temperature = config.temperature;
    if (maxTokens !== undefined) { if (tokensNum !== undefined) newConfig.maxTokens = tokensNum; }
    else if (config.maxTokens !== undefined) newConfig.maxTokens = config.maxTokens;
    try {
      saveConfig(newConfig, configPath);
    } catch (err) {
      return res.status(500).json({ error: `无法写入 config.json：${err.message}` });
    }
    config.baseUrl = newConfig.baseUrl;
    config.apiKey = newConfig.apiKey;
    config.model = newConfig.model;
    config.port = newConfig.port;
    config.temperature = newConfig.temperature;
    config.maxTokens = newConfig.maxTokens;
    config.fontSize = newConfig.fontSize;
    res.json({ ok: true, message: '已保存' });
  }));

  app.post('/api/test-config', wrap(async (req, res) => {
    const { baseUrl, apiKey, model } = req.body || {};
    const target = normalizeBaseUrl(baseUrl);
    if (!target) {
      return res.status(400).json({ error: '接口地址必须以 http:// 或 https:// 开头' });
    }
    if (isBlockedUpstreamHost(target)) {
      return res.status(400).json({ error: '该地址不是可用的 AI 接口地址' });
    }
    const testModel = cleanText(model, 200);
    if (!testModel) {
      return res.status(400).json({ error: '缺少 model' });
    }
    // 输入框留空时回退到已保存的密钥——但仅当地址与已保存地址一致；
    // 否则任何本机页面都能让服务端把密钥发给任意地址（密钥外泄）
    const typedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    const savedKeyUsable = Boolean(config.apiKey) && normalizeBaseUrl(config.baseUrl) === target;
    const key = typedKey || (savedKeyUsable ? config.apiKey : '');
    if (!key) {
      return res.status(400).json({ error: '缺少 API 密钥（测试新地址时必须填写密钥）' });
    }
    const url = completionsUrl(target);
    if (!url) return res.status(400).json({ error: '接口地址无效' });
    try {
      const upstream = await fetchUpstream(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: 'ping' }] }),
      }, { signal: AbortSignal.timeout(opts.testTimeoutMs ?? 15000), retries: 0 });
      if (!upstream.ok) {
        const detail = await extractUpstreamError(upstream);
        return res.json({ ok: false, error: `连接失败：上游返回 ${detail}` });
      }
      return res.json({ ok: true, message: '连接成功' });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return res.json({ ok: false, error: '连接超时：请检查接口地址与网络' });
      }
      return res.json({ ok: false, error: `连接失败：${err.message}` });
    }
  }));

  app.post('/api/run', limited(wrap(async (req, res) => {
    const { language, code, history } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof code !== 'string' || !code.trim()) return badRequest(res, '缺少 code');
    if (code.length > MAX_CODE_CHARS) return tooLarge(res, `代码过长（上限 ${MAX_CODE_CHARS} 字符）`);
    const messages = [
      { role: 'system', content: buildSystemPrompt(language) },
      { role: 'user', content: code.slice(0, MAX_CODE_CHARS) },
    ];
    for (const h of sanitizeHistory(history)) messages.push(h);
    await streamCompletions(config, messages, req, res, upstreamOpts);
  })));

  app.post('/api/explain', limited(wrap(async (req, res) => {
    const { language, code } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof code !== 'string' || !code.trim()) return badRequest(res, '缺少 code');
    if (code.length > MAX_CODE_CHARS) return tooLarge(res, `代码过长（上限 ${MAX_CODE_CHARS} 字符）`);
    await streamCompletions(config, [
      { role: 'system', content: `你是 ${language} 专家。请用中文逐段解释以下代码的功能、逻辑与关键点。不要使用 markdown 代码块。` },
      { role: 'user', content: code },
    ], req, res, upstreamOpts);
  })));

  app.post('/api/generate', limited(wrap(async (req, res) => {
    const { language, prompt } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    const need = cleanText(prompt, MAX_TEXT_CHARS);
    if (!need) return badRequest(res, '缺少需求描述');
    await streamCompletions(config, [
      { role: 'system', content: `你是 ${language} 开发者。请根据用户需求生成 ${language} 代码，只输出代码本身，不要额外解释，不要使用 markdown 代码块。` },
      { role: 'user', content: need },
    ], req, res, upstreamOpts);
  })));

  app.post('/api/fix', limited(wrap(async (req, res) => {
    const { language, code, error } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof code !== 'string' || !code.trim()) return badRequest(res, '缺少 code');
    if (code.length > MAX_CODE_CHARS) return tooLarge(res, `代码过长（上限 ${MAX_CODE_CHARS} 字符）`);
    const errText = cleanText(typeof error === 'string' ? stripControlChars(error) : error, MAX_TEXT_CHARS);
    if (!errText) return badRequest(res, '缺少错误信息');
    await streamCompletions(config, [
      { role: 'system', content: `你是 ${language} 开发者。以下是用户代码运行时的报错：\n${errText}\n请先简短说明问题原因，然后把修复后的完整代码放在一个 markdown 代码块中（\`\`\`...\`\`\`），除代码块外不要输出其他内容。` },
      { role: 'user', content: code },
    ], req, res, upstreamOpts);
  })));

  app.post('/api/chat', limited(wrap(async (req, res) => {
    const { language, code, history, message } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    const msg = cleanText(message, MAX_TEXT_CHARS);
    if (!msg) return badRequest(res, '缺少消息内容');
    const context = cleanText(typeof code === 'string' ? code : '', MAX_CODE_CHARS) || '（空）';
    const messages = [
      { role: 'system', content: `你是 ${language} 助手。用户当前的代码如下（供参考）：\n${context}\n请结合代码上下文用中文回答。` },
    ];
    for (const h of sanitizeHistory(history)) messages.push(h);
    messages.push({ role: 'user', content: msg });
    await streamCompletions(config, messages, req, res, upstreamOpts);
  })));

  // /api 下的未知路径返回 JSON，而不是 express 默认的 HTML 错误页
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

  // 统一错误处理：JSON 解析失败 / 请求体过大 / 未捕获异常都返回 JSON，且不泄露堆栈
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.too.large') return res.status(413).json({ error: '请求体过大（上限 4MB）' });
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: '请求体不是合法 JSON' });
    }
    console.error('[ai-compiler] 未处理的错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误' });
  });

  return app;
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  const config = loadConfig();
  const app = createApp(config);
  const port = config.port || 3000;
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`AI 编译器已启动：http://localhost:${port}`);
  });
  server.on('error', (err) => {
    console.error(`[ai-compiler] 端口 ${port} 启动失败：`, err.message);
    process.exit(1);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  createApp,
  buildSystemPrompt,
  loadConfig,
  saveConfig,
  streamCompletions,
  normalizeBaseUrl,
  completionsUrl,
  isBlockedUpstreamHost,
  sanitizeHistory,
  LIMITS: {
    MAX_CODE_CHARS,
    MAX_TEXT_CHARS,
    MAX_HISTORY,
    MAX_CONCURRENT_UPSTREAMS,
  },
};
