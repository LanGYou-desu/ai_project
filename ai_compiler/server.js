const express = require('express');
const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig(configPath = CONFIG_PATH) {
  const envConfig = {
    baseUrl: process.env.BASE_URL || '',
    apiKey: process.env.API_KEY || '',
    model: process.env.MODEL || '',
    port: Number(process.env.PORT) || 3000,
    temperature: toOptionalNumber(process.env.TEMPERATURE, 0, 2),
    maxTokens: toOptionalNumber(process.env.MAX_TOKENS, 1, 1000000),
    fontSize: toOptionalNumber(process.env.EDITOR_FONT_SIZE, 9, 32),
  };
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.error('[ai-compiler] config.json 解析失败，使用默认配置：', err.message);
    }
  }
  return {
    baseUrl: fileConfig.baseUrl ?? envConfig.baseUrl,
    apiKey: fileConfig.apiKey ?? envConfig.apiKey,
    model: fileConfig.model ?? envConfig.model,
    port: fileConfig.port ?? envConfig.port,
    temperature: fileConfig.temperature ?? envConfig.temperature,
    maxTokens: fileConfig.maxTokens ?? envConfig.maxTokens,
    fontSize: fileConfig.fontSize ?? envConfig.fontSize ?? 14,
  };
}

// 把环境变量/输入解析为可选数值：空或非法返回 undefined（不传上游）
function toOptionalNumber(raw, min, max) {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function saveConfig(config, configPath = CONFIG_PATH) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

const SUPPORTED_LANGUAGES = new Set([
  'python', 'javascript', 'typescript', 'c', 'cpp', 'java', 'go',
]);

const MAX_HISTORY = 24; // 单次请求携带的最大历史消息条数，防止上下文无限膨胀

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// 过滤非法历史消息并截断到最近 MAX_HISTORY 条
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const valid = history.filter(
    (h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string'
  );
  return valid.slice(-MAX_HISTORY);
}

// 尽量从上游错误响应中提取可读信息（OpenAI 兼容格式的 error.message）
async function extractUpstreamError(res) {
  const text = await res.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    const msg = json?.error?.message || json?.error || json?.message;
    if (typeof msg === 'string' && msg) return `${res.status}：${msg}`;
    if (msg && typeof msg === 'object') return `${res.status}：${JSON.stringify(msg)}`;
  } catch { /* 非 JSON 响应，退回原文 */ }
  return `${res.status}：${text.slice(0, 500)}`;
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

async function streamCompletions(config, messages, req, res) {
  if (!config.apiKey || !config.baseUrl || !config.model) {
    return res.status(500).json({
      error: '后端未配置 BASE_URL / API_KEY / MODEL，请在设置页或 .env 中配置后重启',
    });
  }
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  let upstream;
  try {
    const body = { model: config.model, messages, stream: true };
    if (config.temperature !== undefined) body.temperature = config.temperature;
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens;
    upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('[ai-compiler] 无法连接上游 AI 服务：', err.message);
    return res.status(502).json({ error: '无法连接上游 AI 服务，请检查配置与网络' });
  }
  if (!upstream.ok) {
    const detail = await extractUpstreamError(upstream);
    console.error(`[ai-compiler] 上游返回 ${upstream.status}：`, detail);
    return res.status(upstream.status).json({ error: `上游 AI 服务返回 ${detail}` });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  try {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch {
    if (!res.writableEnded) {
      res.write('event: error\ndata: {"error":"stream interrupted"}\n\n');
      res.end();
    }
  }
}

function createApp(config, opts = {}) {
  const configPath = opts.configPath || CONFIG_PATH;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

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

  app.put('/api/config', (req, res) => {
    const { baseUrl, apiKey, model, port, temperature, maxTokens, fontSize } = req.body || {};
    if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl.trim())) {
      return res.status(400).json({ error: '接口地址必须以 http:// 或 https:// 开头' });
    }
    if (typeof model !== 'string' || !model.trim()) {
      return res.status(400).json({ error: '模型不能为空' });
    }
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ error: '端口必须是 1-65535 的整数' });
    }
    const newApiKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : config.apiKey;
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
      baseUrl: baseUrl.trim(),
      apiKey: newApiKey,
      model: model.trim(),
      port: portNum,
      fontSize: fontNum ?? 14,
    };
    if (tempNum !== undefined) newConfig.temperature = tempNum;
    if (tokensNum !== undefined) newConfig.maxTokens = tokensNum;
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
  });

  app.post('/api/test-config', async (req, res) => {
    const { baseUrl, apiKey, model } = req.body || {};
    if (!baseUrl || !model) {
      return res.status(400).json({ error: '缺少 baseUrl / model' });
    }
    // 输入框留空时回退到已保存的密钥（前端不回显密钥，避免用户重输）
    const key = (typeof apiKey === 'string' && apiKey.trim()) || config.apiKey;
    if (!key) return res.status(400).json({ error: '缺少 API 密钥' });
    try {
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }] }),
        signal: AbortSignal.timeout(15000),
      });
      if (!upstream.ok) {
        const detail = await extractUpstreamError(upstream);
        return res.json({ ok: false, error: `连接失败：上游返回 ${detail}` });
      }
      return res.json({ ok: true, message: '连接成功' });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        return res.json({ ok: false, error: '连接超时：请检查接口地址与网络' });
      }
      return res.json({ ok: false, error: `连接失败：${err.message}` });
    }
  });

  app.post('/api/run', async (req, res) => {
    const { language, code, history } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof code !== 'string' || !code.trim()) return badRequest(res, '缺少 code');
    const messages = [
      { role: 'system', content: buildSystemPrompt(language) },
      { role: 'user', content: code },
    ];
    for (const h of sanitizeHistory(history)) messages.push(h);
    await streamCompletions(config, messages, req, res);
  });

  app.post('/api/explain', async (req, res) => {
    const { language, code } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof code !== 'string' || !code.trim()) return badRequest(res, '缺少 code');
    await streamCompletions(config, [
      { role: 'system', content: `你是 ${language} 专家。请用中文逐段解释以下代码的功能、逻辑与关键点。不要使用 markdown 代码块。` },
      { role: 'user', content: code },
    ], req, res);
  });

  app.post('/api/generate', async (req, res) => {
    const { language, prompt } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof prompt !== 'string' || !prompt.trim()) return badRequest(res, '缺少需求描述');
    await streamCompletions(config, [
      { role: 'system', content: `你是 ${language} 开发者。请根据用户需求生成 ${language} 代码，只输出代码本身，不要额外解释，不要使用 markdown 代码块。` },
      { role: 'user', content: prompt },
    ], req, res);
  });

  app.post('/api/fix', async (req, res) => {
    const { language, code, error } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof code !== 'string' || !code.trim()) return badRequest(res, '缺少 code');
    if (typeof error !== 'string' || !error.trim()) return badRequest(res, '缺少错误信息');
    await streamCompletions(config, [
      { role: 'system', content: `你是 ${language} 开发者。以下是用户代码运行时的报错：\n${error}\n请先简短说明问题原因，然后把修复后的完整代码放在一个 markdown 代码块中（\`\`\`...\`\`\`），除代码块外不要输出其他内容。` },
      { role: 'user', content: code },
    ], req, res);
  });

  app.post('/api/chat', async (req, res) => {
    const { language, code, history, message } = req.body || {};
    if (!SUPPORTED_LANGUAGES.has(language)) return badRequest(res, '不支持的语言：' + language);
    if (typeof message !== 'string' || !message.trim()) return badRequest(res, '缺少消息内容');
    const messages = [
      { role: 'system', content: `你是 ${language} 助手。用户当前的代码如下（供参考）：\n${code || '（空）'}\n请结合代码上下文用中文回答。` },
    ];
    for (const h of sanitizeHistory(history)) messages.push(h);
    messages.push({ role: 'user', content: message });
    await streamCompletions(config, messages, req, res);
  });

  return app;
}

if (require.main === module) {
  require('dotenv').config();
  const config = loadConfig();
  const app = createApp(config);
  const port = config.port || Number(process.env.PORT) || 3000;
  app.listen(port, '127.0.0.1', () => {
    console.log(`AI 编译器已启动：http://localhost:${port}`);
  });
}

module.exports = { createApp, buildSystemPrompt, loadConfig, saveConfig, streamCompletions };
