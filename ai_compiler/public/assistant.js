// 合并 AI 助手：提问代码 / 生成代码
let assistantMode = 'ask';
let askHistory = [];   // 多轮对话历史（发送时由后端截断兜底）
let generatedCode = '';
let asstAbort = null;  // 当前助手流式请求，供停止按钮中止
const MAX_ASK_HISTORY = 24; // 前端保留的历史上限，防止上下文膨胀

function setAssistantMode(mode) {
  assistantMode = mode;
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  $('assistant-codearea').hidden = mode !== 'gen';
}

function addThread(role, text, cls, md) {
  const box = $('assistant-thread');
  const div = document.createElement('div');
  // md 渲染的消息加 md-rendered 类：容器默认 pre-wrap 会导致 HTML 块间的换行变成多余空行
  div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'ai') + (cls ? ' ' + cls : '') + (md ? ' md-rendered' : '');
  if (md) div.innerHTML = renderMarkdown(text);
  else div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function clearChat() {
  askHistory = [];
  generatedCode = '';
  $('assistant-thread').textContent = '';
  $('assistant-code').textContent = '';
  $('assistant-code').className = 'gen-output';
  $('btn-apply-code').hidden = true;
  $('assistant-input').value = '';
  $('assistant-input').focus();
}

async function sendAssistant() {
  const input = $('assistant-input');
  const msg = input.value.trim();
  if (!msg || window.__asstBusy) return;
  input.value = '';
  const setBusy = (busy) => {
    window.__asstBusy = busy;
    $('btn-assistant-send').disabled = busy;
    $('btn-assistant-stop').hidden = !busy;
    input.disabled = busy;
  };
  const ac = new AbortController();
  asstAbort = ac;
  if (assistantMode === 'ask') {
    addThread('user', msg);
    setBusy(true);
    const replyEl = addThread('ai', '', '', true);
    let acc = '';
    const renderReply = createThrottledRenderer((v) => { replyEl.innerHTML = renderMarkdown(v); });
    const sawError = await streamRequest('/api/chat', {
      language: currentTabLanguage(), code: getCode(), history: askHistory, message: msg,
    }, {
      onDelta: (d) => { acc += d; renderReply(acc); },
      onError: (e) => { replyEl.textContent = ''; addThread('ai', `[错误] ${e.message}`, 'err'); },
      signal: ac.signal,
    });
    renderReply(acc); // 收尾：确保最后一帧完整渲染
    if (ac.signal.aborted) {
      addThread('ai', '[已停止]', 'err');
    } else {
      if (sawError) addThread('ai', '[请求中断]', 'err');
      if (acc) {
        askHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: acc });
        if (askHistory.length > MAX_ASK_HISTORY) askHistory = askHistory.slice(-MAX_ASK_HISTORY);
      }
    }
    setBusy(false);
  } else {
    const out = $('assistant-code');
    out.textContent = ''; out.className = 'gen-output';
    $('btn-apply-code').hidden = true;
    addThread('user', '[生成] ' + msg);
    setBusy(true);
    let acc = '';
    const sawError = await streamRequest('/api/generate', { language: currentTabLanguage(), prompt: msg }, {
      onDelta: (d) => { acc += d; out.textContent = acc; },
      onError: (e) => { out.className = 'gen-output err'; out.textContent = `[错误] ${e.message}`; },
      signal: ac.signal,
    });
    if (ac.signal.aborted) {
      out.className = 'gen-output err';
      if (acc) out.textContent = acc + '\n[已停止]';
    } else {
      if (sawError) out.className = 'gen-output err';
      generatedCode = stripCodeFences(acc.trim());
      $('btn-apply-code').hidden = !generatedCode;
    }
    setBusy(false);
  }
  asstAbort = null;
}

function stripCodeFences(text) {
  const m = text.match(/```[a-zA-Z]*\n?([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

function applyCode() {
  if (!generatedCode) return;
  if (!confirm('把生成的代码应用到当前编辑器（覆盖当前内容）？')) return;
  setCode(generatedCode);
  addThread('ai', '[已应用到编辑器]', '');
}

$('btn-assistant-send').addEventListener('click', sendAssistant);
$('btn-assistant-stop').addEventListener('click', () => { if (asstAbort) asstAbort.abort(); });
$('assistant-input').addEventListener('keydown', (e) => {
  // 中文输入法组词阶段按 Enter 不应发送
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendAssistant(); }
});
document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => setAssistantMode(b.dataset.mode)));
$('btn-apply-code').addEventListener('click', applyCode);
$('btn-clear-chat').addEventListener('click', clearChat);
