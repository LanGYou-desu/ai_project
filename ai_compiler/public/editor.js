// 语言预设（id 必须与后端白名单一致）
const LANGUAGES = [
  { id: 'python', label: 'Python', template: 'print("Hello, World!")\n' },
  { id: 'javascript', label: 'JavaScript', template: 'console.log("Hello, World!");\n' },
  { id: 'typescript', label: 'TypeScript', template: 'const message: string = "Hello, World!";\nconsole.log(message);\n' },
  { id: 'c', label: 'C', template: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n' },
  { id: 'cpp', label: 'C++', template: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n' },
  { id: 'java', label: 'Java', template: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n' },
  { id: 'go', label: 'Go', template: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n' },
];

let editor = null;
let currentLang = 'python';
let running = false;
let activeAbort = null; // 当前正在进行的流式请求（运行/解释共用），供停止按钮中止

// 打开的文件 tab
const openTabs = [];   // { rel, model, language, dirty }
let currentTab = null; // 无文件时为 null（untitled 缓冲）
let untitledModel = null;

function getCode() { return currentTab ? currentTab.model.getValue() : editor.getValue(); }
function setCode(text) { const model = currentTab ? currentTab.model : editor.getModel(); model.setValue(text); markDirty(); }

function extLanguage(name) {
  const m = { py: 'python', js: 'javascript', ts: 'typescript', c: 'c', cpp: 'cpp', h: 'cpp', hpp: 'cpp', java: 'java', go: 'go', md: 'markdown', markdown: 'markdown', mdown: 'markdown', mkd: 'markdown' };
  const ext = name.split('.').pop().toLowerCase();
  return m[ext] || 'plaintext';
}

function isSupportedLang(lang) { return LANGUAGES.some((l) => l.id === lang); }

function tabLabel(t) { return t.rel.split('/').pop() + (t.dirty ? ' •' : ''); }

function renderTabs() {
  const bar = $('editor-tabs');
  bar.textContent = '';
  for (const t of openTabs) {
    const tab = document.createElement('div');
    tab.className = 'editor-tab' + (t === currentTab ? ' active' : '') + (t.dirty ? ' dirty' : '');
    tab.textContent = tabLabel(t);
    tab.addEventListener('click', () => switchTab(t));
    // tab 右键菜单：保存 / 关闭 / 关闭其他 / 关闭全部
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (t !== currentTab) switchTab(t);
      showContextMenu(e.clientX, e.clientY, tabMenu(t));
    });
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(t); });
    tab.appendChild(close);
    t._el = tab; // 供 markDirty 就地更新，避免每次输入重建整个 tab 栏
    bar.appendChild(tab);
  }
  // 无文件 tab 时禁用保存按钮（untitled 缓冲不可保存）
  $('btn-save').disabled = !currentTab;
}

function openFileInEditor(rel, content) {
  let tab = openTabs.find((t) => t.rel === rel);
  if (!tab) {
    const lang = extLanguage(rel);
    const model = monaco.editor.createModel(content || '', lang, monaco.Uri.file(rel));
    tab = { rel, model, language: lang, dirty: false };
    openTabs.push(tab);
  }
  switchTab(tab);
  renderTabs();
  // Markdown 文件自动在右侧边栏渲染预览
  if (isMarkdownFile(rel)) openPreviewFor(rel);
}

function switchTab(tab) {
  currentTab = tab;
  editor.setModel(tab.model);
  currentLang = tab.language;
  const found = LANGUAGES.find((l) => l.id === tab.language);
  setStatusLang(found ? found.label : (tab.language === 'plaintext' ? '纯文本' : tab.language));
  $('status-lang').title = tab.rel; // 状态栏语言处悬浮显示完整路径
  renderTabs();
  // 同步语言下拉（不在预设内的文件类型显示为空，运行时会给出提示）
  const sel = $('lang-select');
  sel.value = found ? tab.language : '';
  sel.disabled = true;
  previewOnTabSwitch(tab);
}

function closeTab(tab, force) {
  if (!force && tab.dirty && !confirm('文件未保存，确定关闭？')) return;
  const i = openTabs.indexOf(tab);
  openTabs.splice(i, 1);
  if (currentTab === tab) {
    const next = openTabs[i] || openTabs[i - 1];
    if (next) switchTab(next);
    else { currentTab = null; editor.setModel(untitledModel); currentLang = 'python'; setStatusLang('Python'); $('status-lang').title = ''; $('lang-select').disabled = false; $('lang-select').value = 'python'; }
  }
  tab.model.dispose();
  renderTabs();
  previewOnClose(tab.rel);
}

function closeEditorTab(rel) {
  const tab = openTabs.find((t) => t.rel === rel);
  if (tab) closeTab(tab);
}

function currentTabLanguage() { return currentTab ? currentTab.language : currentLang; }
function markDirty() {
  if (!currentTab) return;
  currentTab.dirty = true;
  // 就地更新脏标记与标签，避免每次输入都重建整个 tab 栏（长文件/多 tab 时卡顿）
  const el = currentTab._el;
  if (el && !el.classList.contains('dirty')) {
    el.classList.add('dirty');
    el.firstChild.textContent = tabLabel(currentTab);
  }
}

// 保存指定 tab 到磁盘
async function saveTab(tab) {
  if (!window.fs) {
    appendOutput('terminal', '[提示] 文件系统仅桌面版可用（启动.bat / npm start）\n', 'err');
    setOutputTab('terminal');
    return;
  }
  const r = await window.fs.writeFile(tab.rel, tab.model.getValue());
  if (r.ok) {
    tab.dirty = false;
    if (tab._el) {
      tab._el.classList.remove('dirty');
      tab._el.firstChild.textContent = tab.rel.split('/').pop();
    }
    appendOutput('terminal', `[已保存] ${tab.rel}\n`, 'ok');
  } else {
    appendOutput('terminal', `[保存失败] ${r.error}\n`, 'err');
    setOutputTab('terminal');
  }
}

// 未命名缓冲：另存为工作区文件（Ctrl+S 无 tab 时触发）
async function saveUntitledAs() {
  if (!window.fs) {
    appendOutput('terminal', '[提示] 文件系统仅桌面版可用（启动.bat / npm start）\n', 'err');
    setOutputTab('terminal');
    return;
  }
  const extMap = { python: 'py', javascript: 'js', typescript: 'ts', c: 'c', cpp: 'cpp', java: 'java', go: 'go' };
  const name = prompt('保存为（相对工作区路径）：', `untitled.${extMap[currentLang] || 'txt'}`);
  if (!name || !name.trim()) return;
  const rel = name.trim().replace(/\\/g, '/');
  if (typeof isValidNewPath === 'function' && !isValidNewPath(rel)) {
    appendOutput('terminal', `[保存失败] 非法的文件名：${name}\n`, 'err');
    setOutputTab('terminal');
    return;
  }
  const r = await window.fs.writeFile(rel, editor.getValue());
  if (!r.ok) {
    appendOutput('terminal', `[保存失败] ${r.error}\n`, 'err');
    setOutputTab('terminal');
    return;
  }
  // 把未命名缓冲转为文件 tab
  const lang = extLanguage(rel);
  const model = monaco.editor.createModel(editor.getValue(), lang, monaco.Uri.file(rel));
  const tab = { rel, model, language: lang, dirty: false };
  openTabs.push(tab);
  switchTab(tab);
  renderTabs();
  appendOutput('terminal', `[已保存] ${rel}\n`, 'ok');
  if (typeof renderTree === 'function') renderTree(); // 刷新资源管理器
}

async function saveCurrent() {
  if (!currentTab) { await saveUntitledAs(); return; }
  await saveTab(currentTab);
}

// —— tab 右键菜单 ——
function tabMenu(t) {
  return [
    { label: '保存', icon: 'codicon-save', action: () => saveTab(t) },
    { sep: true },
    { label: '关闭', icon: 'codicon-close', action: () => closeTab(t) },
    { label: '关闭其他', icon: 'codicon-close-all', action: () => closeOtherTabs(t) },
    { label: '关闭全部', icon: 'codicon-close-all', action: () => closeAllTabs() },
  ];
}

function closeOtherTabs(keep) {
  const others = openTabs.filter((t) => t !== keep);
  if (!others.length) return;
  if (others.some((t) => t.dirty) && !confirm('有其他未保存的文件，确定关闭？')) return;
  const closedRels = others.map((t) => t.rel);
  for (const t of others) {
    const i = openTabs.indexOf(t);
    openTabs.splice(i, 1);
    t.model.dispose();
  }
  if (!openTabs.includes(currentTab)) switchTab(keep);
  renderTabs();
  for (const rel of closedRels) previewOnClose(rel);
}

function closeAllTabs() {
  if (!openTabs.length) return;
  if (openTabs.some((t) => t.dirty) && !confirm('有未保存的文件，确定全部关闭？')) return;
  const closedRels = openTabs.map((t) => t.rel);
  for (const t of openTabs) t.model.dispose();
  openTabs.length = 0;
  currentTab = null;
  editor.setModel(untitledModel);
  currentLang = 'python';
  setStatusLang('Python');
  $('status-lang').title = '';
  const sel = $('lang-select');
  sel.disabled = false;
  sel.value = 'python';
  renderTabs();
  for (const rel of closedRels) previewOnClose(rel);
}

// 快捷键：Ctrl+S 保存 / Ctrl+Enter 运行 / Ctrl+` 终端 / Ctrl+B 侧栏 / Ctrl+W 关闭 tab
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveCurrent(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.isComposing) {
    if (!$('settings-panel').classList.contains('open')) { e.preventDefault(); runCode(); }
  }
  if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) { e.preventDefault(); toggleTerminal(); }
  if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); switchPanel('explorer'); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && !e.shiftKey && !e.isComposing) {
    if (currentTab) { e.preventDefault(); closeTab(currentTab); }
    // 无 tab 时：桌面版由主进程 IPC 处理（关窗），浏览器模式交还浏览器默认行为
  }
});

// 桌面版：主进程拦截 Ctrl+W 后转发（有 tab 关 tab，无 tab 关窗）
if (window.appEvents && window.appEvents.onCtrlW) {
  window.appEvents.onCtrlW(() => {
    if (currentTab) closeTab(currentTab);
    else if (window.fs) window.close();
  });
}

// 关闭窗口/页面时若有未保存文件则提醒
window.addEventListener('beforeunload', (e) => {
  if (openTabs.some((t) => t.dirty)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

function setRunningUI(isRunning) {
  running = isRunning;
  $('btn-run').disabled = isRunning;
  $('btn-stop').disabled = !isRunning;
  // 运行中：运行按钮图标切换为旋转 loading，给出忙碌反馈
  const icon = $('btn-run').querySelector('.codicon');
  icon.className = 'codicon ' + (isRunning ? 'codicon-loading codicon-animated' : 'codicon-play');
}

function switchLanguage(lang) {
  currentLang = lang.id;
  if (editor.getModel().getValue() === '') {
    editor.setValue(lang.template);
  }
  monaco.editor.setModelLanguage(editor.getModel(), lang.id);
  setStatusLang(lang.label);
}

// 等待用户在终端输入一行；返回输入值，被停止时返回 null
function waitForTerminalInput() {
  return new Promise((resolve) => {
    const row = $('terminal-input-row');
    const input = $('terminal-input');
    row.hidden = false;
    input.value = '';
    input.focus();
    const done = (value) => {
      row.hidden = true;
      input.removeEventListener('keydown', onEnter);
      $('btn-stop').removeEventListener('click', onStop);
      resolve(value);
    };
    const onEnter = (e) => {
      // 中文输入法组词阶段按 Enter 是确认候选词，不应提交输入
      if (e.key === 'Enter' && !e.isComposing) done(input.value);
    };
    const onStop = () => done(null);
    input.addEventListener('keydown', onEnter);
    $('btn-stop').addEventListener('click', onStop);
  });
}

async function runCode() {
  if (running) return;
  const code = getCode();
  if (!code.trim()) {
    appendOutput('terminal', '[提示] 编辑器为空，请先输入代码\n', 'err');
    setOutputTab('terminal');
    return;
  }
  const lang = currentTabLanguage();
  if (!isSupportedLang(lang)) {
    appendOutput('terminal', `[提示] 不支持的文件类型 ${lang}\n`, 'err');
    setOutputTab('terminal');
    return;
  }
  setOutputTab('terminal');
  clearOutput('terminal');
  const langLabel = LANGUAGES.find((l) => l.id === currentTabLanguage())?.label || currentTabLanguage();
  appendOutput('terminal', `[运行] ${langLabel}\n`);
  setRunningUI(true);
  const runHistory = [];
  const t0 = Date.now();
  let active = true;
  while (active) {
    const ac = new AbortController();
    activeAbort = ac;
    let raw = '';          // 已接收的原文（按帧批处理，避免逐 chunk 全量 replace 的 O(n²)）
    let shown = 0;         // 已展示的“去标记”字符数，用于处理 [需要输入] 被分块截断
    let frameScheduled = false;
    const flushFrame = () => {
      frameScheduled = false;
      const clean = raw.replace(/\[需要输入\]/g, '');
      if (clean.length > shown) {
        appendOutput('terminal', clean.slice(shown));
        shown = clean.length;
      }
    };
    let transportError = '';
    const sawError = await streamRequest('/api/run', {
      language: currentTabLanguage(),
      code,
      history: runHistory.length ? runHistory : undefined,
    }, {
      onDelta: (d) => {
        raw += d;
        if (!frameScheduled) {
          frameScheduled = true;
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flushFrame);
          else setTimeout(flushFrame, 16);
        }
      },
      onError: (e) => { transportError = e.message; appendOutput('terminal', `[错误] ${e.message}\n`, 'err'); },
      signal: ac.signal,
    });
    flushFrame(); // 收尾：确保缓冲的尾部立即渲染
    if (ac.signal.aborted) {
      appendOutput('terminal', '\n[已停止]\n', 'err');
      setLastError('用户手动停止');
      active = false;
      break;
    }
    if (transportError) {
      setLastError(transportError);
      active = false;
      break;
    }
    if (raw.includes('[需要输入]')) {
      const input = await waitForTerminalInput();
      if (input === null) {
        appendOutput('terminal', '\n[已停止]\n', 'err');
        setLastError('用户手动停止');
        active = false;
        break;
      }
      appendOutput('terminal', `$ ${input}\n`);
      runHistory.push({ role: 'assistant', content: raw });
      runHistory.push({ role: 'user', content: input });
      // 继续下一轮
    } else {
      setLastError(raw.trim() || (sawError ? '请求中断' : ''));
      const secs = ((Date.now() - t0) / 1000).toFixed(2);
      appendOutput('terminal', sawError ? '\n[请求中断]\n' : `\n[程序已退出 (${secs}s)]\n`, sawError ? 'err' : 'ok');
      active = false;
    }
  }
  activeAbort = null;
  $('terminal-input-row').hidden = true;
  setRunningUI(false);
}

function stopCode() {
  if (activeAbort) activeAbort.abort();
}

// 编辑器字号（设置页保存后调用；editor 就绪前调用会被忽略，就绪时由配置加载再应用一次）
function applyFontSize(size) {
  const n = Number(size);
  if (editor && Number.isFinite(n) && n >= 9 && n <= 32) editor.updateOptions({ fontSize: n });
}

async function explainCode() {
  // 运行/解释共用 activeAbort，运行中不允许解释，避免覆盖停止目标导致状态错乱
  if (running) {
    appendOutput('explain', '[提示] 程序正在运行，请先停止\n', 'err');
    setOutputTab('explain');
    return;
  }
  const code = getCode();
  if (!code.trim()) { appendOutput('explain', '[提示] 编辑器为空\n', 'err'); setOutputTab('explain'); return; }
  if (!isSupportedLang(currentTabLanguage())) {
    appendOutput('explain', `[提示] 不支持的文件类型 ${currentTabLanguage()}\n`, 'err');
    setOutputTab('explain');
    return;
  }
  setOutputTab('explain');
  clearOutput('explain');
  setRunningUI(true);
  const ac = new AbortController();
  activeAbort = ac;
  let acc = '';
  const renderExplain = createThrottledRenderer((v) => setStreamMarkdown('explain', v));
  const sawError = await streamRequest('/api/explain', { language: currentTabLanguage(), code }, {
    onDelta: (d) => { acc += d; renderExplain(acc); },
    onError: (e) => appendOutput('explain', `[错误] ${e.message}\n`, 'err'),
    signal: ac.signal,
  });
  renderExplain(acc); // 收尾：确保最后一帧完整渲染
  activeAbort = null;
  if (ac.signal.aborted) {
    appendOutput('explain', '\n[已停止]\n', 'err');
  } else {
    appendOutput('explain', sawError ? '\n[请求中断]\n' : '\n[完成]\n', sawError ? 'err' : 'ok');
  }
  setRunningUI(false);
}

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
require(['vs/editor/editor.main'], function () {
  untitledModel = monaco.editor.createModel(LANGUAGES[0].template, 'python');
  editor = monaco.editor.create($('editor'), {
    model: untitledModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
  });
  const sel = $('lang-select');
  for (const lang of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang.id;
    opt.textContent = lang.label;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    const lang = LANGUAGES.find((l) => l.id === sel.value);
    if (lang) switchLanguage(lang);
  });
  editor.onDidChangeCursorPosition((e) => {
    setStatusCursor(`Ln ${e.position.lineNumber}, Col ${e.position.column}`);
  });
  editor.onDidChangeModelContent(() => { markDirty(); previewOnEdit(); });
  $('btn-run').addEventListener('click', runCode);
  $('btn-stop').addEventListener('click', stopCode);
  $('btn-explain').addEventListener('click', explainCode);
  $('btn-save').addEventListener('click', saveCurrent);
  setStatusLang('Python');
  // 读取配置显示模型名并应用编辑器字号
  fetch('/api/config').then((r) => r.json()).then((c) => {
    setStatusModel(c.model ? `模型：${c.model}` : (c.hasApiKey ? '模型：未设置' : '模型：未配置'));
    applyFontSize(c.fontSize || 14);
  }).catch(() => setStatusModel('模型：未配置'));
  $('btn-fix').addEventListener('click', async () => {
    if ($('btn-fix').disabled) return;
    $('btn-apply-fix').hidden = true;
    $('btn-apply-fix').dataset.fixed = '';
    const error = getLastError();
    const code = getCode();
    if (!error || !code.trim()) {
      appendOutput('fix', '[提示] 没有可修复的错误，请先运行代码\n', 'err');
      setOutputTab('fix');
      return;
    }
    if (!isSupportedLang(currentTabLanguage())) {
      appendOutput('fix', `[提示] 不支持的文件类型 ${currentTabLanguage()}\n`, 'err');
      setOutputTab('fix');
      return;
    }
    $('btn-fix').disabled = true;
    setOutputTab('fix');
    clearOutput('fix');
    appendOutput('fix', `[修复中] 针对错误：${error}\n`);
    let fixAcc = '';
    const renderFix = createThrottledRenderer((v) => setStreamMarkdown('fix', v));
    const sawError = await streamRequest('/api/fix', { language: currentTabLanguage(), code, error }, {
      onDelta: (d) => { fixAcc += d; renderFix(fixAcc); },
      onError: (e) => appendOutput('fix', `[错误] ${e.message}\n`, 'err'),
    });
    renderFix(fixAcc); // 收尾：确保最后一帧完整渲染
    const m = fixAcc.match(/```[a-zA-Z]*\n?([\s\S]*?)```/);
    $('btn-apply-fix').hidden = !m;
    $('btn-apply-fix').dataset.fixed = m ? m[1] : '';
    appendOutput('fix', sawError ? '\n[请求中断]\n' : '\n[完成]\n', sawError ? 'err' : 'ok');
    $('btn-fix').disabled = false;
  });
  $('btn-apply-fix').addEventListener('click', () => {
    const fixed = $('btn-apply-fix').dataset.fixed;
    if (fixed) { setCode(fixed); appendOutput('fix', '\n[已应用修复]\n', 'ok'); }
  });
});
