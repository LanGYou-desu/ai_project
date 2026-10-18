// SSE 解析核心（纯函数，无 DOM 依赖）
// 单独成文件：浏览器用 <script> 加载，Node 测试可直接 require
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SseCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // 从一段 data 文本中提取 { content, error }
  function parsePayload(data) {
    if (data === '[DONE]') return { content: '', error: '' };
    let json;
    try { json = JSON.parse(data); } catch { return { content: '', error: '' }; }
    if (json && json.error) {
      const e = json.error;
      const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
      return { content: '', error: msg };
    }
    const choice = json && json.choices && json.choices[0];
    if (!choice) return { content: '', error: '' };
    if (typeof choice.delta?.content === 'string') return { content: choice.delta.content, error: '' };
    if (typeof choice.message?.content === 'string') return { content: choice.message.content, error: '' };
    if (typeof choice.text === 'string') return { content: choice.text, error: '' };
    return { content: '', error: '' };
  }

  // 消费缓冲区中所有完整的 SSE 事件（以空行分隔）
  function consume(state) {
    let idx;
    while ((idx = state.rest.indexOf('\n\n')) !== -1) {
      const event = state.rest.slice(0, idx);
      state.rest = state.rest.slice(idx + 2);
      const dataLines = [];
      let eventName = '';
      for (const line of event.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      const data = dataLines.join('\n').trim();
      if (data === '[DONE]') { state.done = true; continue; }
      if (!data) continue;
      const parsed = parsePayload(data);
      if (parsed.error) {
        state.errored = true;
        state.content += `\n[错误] ${parsed.error}\n`;
        continue;
      }
      if (parsed.content) state.content += parsed.content;
      else if (eventName === 'error') {
        state.errored = true;
        state.content += `\n[错误] ${data.slice(0, 500)}\n`;
      }
    }
  }

  // 解析 SSE 缓冲：返回 { content, buffer, errored, done }
  // - CRLF 归一化，多个 data: 行按 SSE 规范用 \n 拼接
  // - 识别 event: error 与 data 中的 {"error": ...}
  // - flush=true（流结束）时兜底处理：最后一个没有结尾空行的事件，
  //   以及「上游忽略 stream:true 返回普通 JSON」的情况
  function parseSse(buffer, options) {
    const flush = Boolean(options && options.flush);
    const state = {
      rest: String(buffer == null ? '' : buffer).replace(/\r\n/g, '\n'),
      content: '',
      errored: false,
      done: false,
    };
    consume(state);
    if (flush && state.rest.trim()) {
      const leftover = state.rest.trim();
      if (/^(data:|event:|id:|retry:|:)/m.test(leftover)) {
        // 最后一个事件缺少结尾空行：补上再解析一次
        state.rest = `${state.rest.trimEnd()}\n\n`;
        consume(state);
      } else {
        // 不是 SSE 分帧：上游返回了普通 JSON
        const parsed = parsePayload(leftover);
        if (parsed.error) {
          state.errored = true;
          state.content += `\n[错误] ${parsed.error}\n`;
        } else if (parsed.content) {
          state.content += parsed.content;
        } else if (!state.content) {
          state.errored = true;
          state.content += '\n[错误] 上游响应无法解析\n';
        }
      }
      state.rest = '';
    }
    return { content: state.content, buffer: state.rest, errored: state.errored, done: state.done };
  }

  return { parseSse, parsePayload };
});
