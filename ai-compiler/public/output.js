// 底部面板与流式请求公共逻辑
const $ = (id) => document.getElementById(id);

function setOutputTab(tab) {
  document.querySelectorAll('.panel-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  ['terminal', 'explain', 'fix'].forEach((t) => {
    $(`output-${t}`).hidden = t !== tab;
  });
  $('fix-actions').hidden = tab !== 'fix';
  if (tab !== 'terminal') $('terminal-input-row').hidden = true;
}

function appendOutput(tab, text, cls) {
  const el = $(`output-${tab}`);
  // 相邻的普通文本 span 合并，减少 DOM 节点（长输出性能）
  if (!cls) {
    const last = el.lastElementChild;
    if (last && last.tagName === 'SPAN' && !last.className) {
      last.textContent += text;
      scrollOutput(el);
      return;
    }
  }
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text;
  el.appendChild(span);
  scrollOutput(el);
}

// 输出自动滚动（可被工具栏开关关闭）
let autoScroll = true;
function scrollOutput(el) {
  if (autoScroll) el.scrollTop = el.scrollHeight;
}
function currentOutputTab() {
  const t = document.querySelector('.panel-tab.active');
  return t ? t.dataset.tab : 'terminal';
}

function clearOutput(tab) {
  $(`output-${tab}`).textContent = '';
}

// —— Markdown 流式渲染（解释 / 修复面板）——
// 系统行（[错误]、[完成] 等）继续走 appendOutput，AI 正文渲染进独立的 .md-stream 容器
function setStreamMarkdown(tab, acc) {
  const out = $(`output-${tab}`);
  let el = out.querySelector('.md-stream');
  if (!el) {
    el = document.createElement('div');
    el.className = 'md-stream';
    out.appendChild(el);
  }
  el.innerHTML = renderMarkdown(acc);
  scrollOutput(out);
}

// rAF 节流的流式渲染器：每帧最多重渲染一次，避免长输出逐 chunk 全量 innerHTML 的 O(n²) 卡顿
function createThrottledRenderer(render) {
  let scheduled = false;
  let latest = null;
  const run = () => {
    scheduled = false;
    if (latest !== null) {
      const v = latest;
      latest = null;
      render(v);
    }
  };
  return (value) => {
    latest = value;
    if (!scheduled) {
      scheduled = true;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else setTimeout(run, 16);
    }
  };
}

// 解析 SSE 缓冲（CRLF 归一化，错误事件提取）
function parseSse(buffer) {
  buffer = buffer.replace(/\r\n/g, '\n');
  let content = '';
  let errored = false;
  let idx;
  while ((idx = buffer.indexOf('\n\n')) !== -1) {
    const event = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    let dataLines = [];
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue;
      // 多个 data: 行属于同一事件，按 SSE 规范用 \n 拼接
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    const data = dataLines.join('\n').trim();
    if (!data || data === '[DONE]') continue;
    try {
      const json = JSON.parse(data);
      if (json.error) {
        errored = true;
        const msg = typeof json.error === 'string' ? json.error : (json.error.message || JSON.stringify(json.error));
        content += `\n[错误] ${msg}\n`;
        continue;
      }
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    } catch { /* 忽略无法解析的分块 */ }
  }
  return { content, buffer, errored };
}

// 通用流式请求：POST + SSE 解析 + 回调
async function streamRequest(url, body, { onDelta, onError, signal }) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return true; // 用户停止：静默返回
    if (onError) onError(new Error(`请求失败：${err.message}`));
    return true;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (onError) onError(new Error(err.error || `HTTP ${res.status}`));
    return true;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawError = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const r = parseSse(buffer);
      buffer = r.buffer;
      if (r.errored) sawError = true;
      if (r.content) onDelta(r.content);
    }
    buffer += decoder.decode();
    const tail = parseSse(buffer);
    if (tail.content) onDelta(tail.content);
    if (tail.errored) sawError = true;
  } catch (err) {
    if (err.name !== 'AbortError' && onError) onError(err);
    return true;
  }
  return sawError;
}

// 活动栏与侧栏
// 统一根据面板可见性同步活动栏高亮（单一事实来源，避免各面板各管各的导致高亮丢失）
function syncActivity() {
  $('act-explorer').classList.toggle('active', !$('explorer').hidden);
  const rightOpen = !$('sidebar-right').hidden;
  const curTab = document.querySelector('.side-tab.active')?.dataset.side || 'assistant';
  $('act-assistant').classList.toggle('active', rightOpen && curTab === 'assistant');
  $('act-preview').classList.toggle('active', rightOpen && curTab === 'preview');
  $('act-terminal').classList.toggle('active', !$('bottom-panel').hidden);
}
function switchPanel(name) {
  if (name === 'explorer') {
    const show = $('explorer').hidden;
    $('explorer').hidden = !show;
    $('split-left').hidden = !show;
  } else if (name === 'assistant' || name === 'preview') {
    const sb = $('sidebar-right');
    const curTab = document.querySelector('.side-tab.active')?.dataset.side || 'assistant';
    if (sb.hidden || curTab !== name) {
      sb.hidden = false;
      $('split-right').hidden = false;
      sidePanelTab(name); // 定义于 preview.js：切 tab 并同步活动栏高亮
    } else {
      sb.hidden = true;
      $('split-right').hidden = true;
    }
  } else if (name === 'none') {
    $('sidebar-right').hidden = true;
    $('split-right').hidden = true;
  }
  syncActivity();
}
function toggleTerminal() {
  $('bottom-panel').hidden = !$('bottom-panel').hidden;
  $('resize-bottom').hidden = $('bottom-panel').hidden;
  syncActivity();
}

// 底部面板高度拖拽（持久化到 localStorage）
function initBottomResize() {
  const saved = Number(localStorage.getItem('--bottom-panel-h'));
  if (saved >= 80) document.documentElement.style.setProperty('--bottom-panel-h', saved + 'px');
  const el = $('resize-bottom');
  let dragging = false;
  el.addEventListener('mousedown', (e) => {
    dragging = true; e.preventDefault();
    const start = e.clientY;
    const h0 = $('bottom-panel').getBoundingClientRect().height;
    const onMove = (ev) => {
      if (!dragging) return;
      const max = Math.round(window.innerHeight * 0.7);
      const h = Math.max(80, Math.min(max, h0 + start - ev.clientY));
      document.documentElement.style.setProperty('--bottom-panel-h', h + 'px');
    };
    const onUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      localStorage.setItem('--bottom-panel-h', String($('bottom-panel').getBoundingClientRect().height));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// 面板工具栏：自动滚动 / 复制 / 清空
$('btn-autoscroll').addEventListener('click', () => {
  autoScroll = !autoScroll;
  const btn = $('btn-autoscroll');
  btn.querySelector('.codicon').className = 'codicon ' + (autoScroll ? 'codicon-lock' : 'codicon-unlock');
  btn.title = '自动滚动：' + (autoScroll ? '开' : '关');
});
$('btn-copy-output').addEventListener('click', () => {
  copyText($(`output-${currentOutputTab()}`).textContent);
});
$('btn-clear-output').addEventListener('click', () => {
  clearOutput(currentOutputTab());
  if (currentOutputTab() !== 'terminal') $('terminal-input-row').hidden = true;
});

// 侧栏宽度管理（拖拽调宽，宽度持久化到 localStorage）
function setSidebarWidth(key, v) {
  document.documentElement.style.setProperty(key, v + 'px');
  localStorage.setItem(key, String(v));
}
function initSplitter(id, key, min, max, side) {
  const el = $(id);
  let dragging = false;
  el.addEventListener('mousedown', (e) => {
    dragging = true; e.preventDefault();
    const start = e.clientX; const w0 = $(side).getBoundingClientRect().width;
    const onMove = (ev) => {
      if (!dragging) return;
      const delta = side === 'explorer' ? ev.clientX - start : start - ev.clientX;
      const w = Math.max(min, Math.min(max, w0 + delta));
      setSidebarWidth(key, w);
    };
    const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// 状态栏
function setStatusModel(text) { $('status-model').textContent = text; }
function setStatusLang(text) { $('status-lang').textContent = text; }
function setStatusCursor(text) { $('status-cursor').textContent = text; }

// 最近错误（供修复）
let lastError = '';
function setLastError(text) { lastError = text; }
function getLastError() { return lastError; }

// 活动栏事件
$('act-explorer').addEventListener('click', () => switchPanel('explorer'));
$('act-assistant').addEventListener('click', () => switchPanel('assistant'));
$('act-terminal').addEventListener('click', toggleTerminal);
document.querySelectorAll('.panel-tab').forEach((t) => {
  t.addEventListener('click', () => setOutputTab(t.dataset.tab));
});

// 初始状态：底部面板默认可见，同步活动栏
syncActivity();

// 初始化：恢复侧栏宽度并绑定分隔条拖拽
const leftW = Number(localStorage.getItem('--sidebar-left-w')) || 260;
const rightW = Number(localStorage.getItem('--sidebar-right-w')) || 320;
document.documentElement.style.setProperty('--sidebar-left-w', leftW + 'px');
document.documentElement.style.setProperty('--sidebar-right-w', rightW + 'px');
initSplitter('split-left', '--sidebar-left-w', 160, 480, 'explorer');
initSplitter('split-right', '--sidebar-right-w', 240, 520, 'sidebar-right');
initBottomResize();
