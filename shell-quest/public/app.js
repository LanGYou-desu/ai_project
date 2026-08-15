'use strict';
// 档案馆-7 前端：终端 + 任务面板
(function () {
  const termOut = document.getElementById('termOut');
  const termInput = document.getElementById('termInput');
  const promptEl = document.getElementById('prompt');
  const taskList = document.getElementById('taskList');
  const storyLog = document.getElementById('storyLog');
  const actBadge = document.getElementById('actBadge');
  const doneBadge = document.getElementById('doneBadge');
  const flagCount = document.getElementById('flagCount');
  const hintBtn = document.getElementById('hintBtn');
  const resetBtn = document.getElementById('resetBtn');
  const doneOverlay = document.getElementById('doneOverlay');
  const doneStats = document.getElementById('doneStats');
  const doneClose = document.getElementById('doneClose');

  let state = null;
  let history = [];
  let histIdx = -1;

  const ACT_NAMES = { 1: '第 1 幕 · 门房大厅', 2: '第 2 幕 · 数据迷宫', 3: '第 3 幕 · 核心室', 4: '已完成' };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function addLine(text, cls) {
    const div = document.createElement('div');
    div.className = 'line' + (cls ? ' ' + cls : '');
    div.textContent = text;
    termOut.appendChild(div);
    termOut.scrollTop = termOut.scrollHeight;
    return div;
  }

  function addPrompt(cwd) {
    const div = document.createElement('div');
    div.className = 'line prompt-line';
    div.textContent = 'guest@archive-7:' + cwd + '>';
    termOut.appendChild(div);
  }

  function renderState() {
    if (!state) return;
    actBadge.textContent = ACT_NAMES[state.act] || '第 ' + state.act + ' 幕';
    doneBadge.classList.toggle('hidden', !state.done);
    flagCount.textContent = state.solved.length + ' / ' + state.stats.totalFlags;
    hintBtn.textContent = '获取提示（已用 ' + state.hintsUsed + ' 次）';
    // 任务
    taskList.innerHTML = '';
    const acts = [1, 2, 3];
    for (const a of acts) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:11px;color:#d8a657;margin:8px 0 4px;';
      h.textContent = ACT_NAMES[a];
      taskList.appendChild(h);
      for (const t of (state.tasks[a] || [])) {
        const d = document.createElement('div');
        d.className = 'task' + (t.solved ? ' solved' : '');
        d.textContent = t.text;
        taskList.appendChild(d);
      }
    }
    // 故事
    storyLog.innerHTML = '';
    for (const s of state.story) {
      const d = document.createElement('div');
      d.className = 'story-item';
      d.textContent = s;
      storyLog.appendChild(d);
    }
    storyLog.scrollTop = storyLog.scrollHeight;
    if (state.done) {
      doneOverlay.classList.remove('hidden');
      const mins = state.stats.finishAt ? Math.max(1, Math.round((state.stats.finishAt - state.stats.startedAt) / 60000)) : '?';
      doneStats.textContent = '耗时约 ' + mins + ' 分钟 · 执行 ' + state.stats.commandsRun + ' 条命令 · 收集 ' + state.solved.length + ' 个口令';
    }
  }

  async function fetchState() {
    const r = await fetch('/api/state');
    state = await r.json();
    renderState();
  }

  async function runCommand(line) {
    addPrompt(state ? '' : '');
    const r = await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line: line })
    });
    const data = await r.json();
    state = data.state;
    const out = String(data.output || '');
    if (out) {
      const lines = out.replace(/\n$/, '').split('\n');
      let isErr = data.code !== 0;
      let isFlag = /^✓ 口令正确/.test(out.trim());
      for (const l of lines) {
        addLine(l, isErr ? 'err' : (isFlag ? 'flag' : ''));
      }
    }
    promptEl.textContent = 'guest@archive-7:' + data.cwd + '>';
    renderState();
  }

  termInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const line = termInput.value.trim();
      if (!line) return;
      history.push(line);
      histIdx = -1;
      termInput.value = '';
      if (line === 'clear') {
        termOut.innerHTML = '';
        return;
      }
      runCommand(line);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) {
        histIdx = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
        termInput.value = history[histIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx >= 0) {
        histIdx++;
        termInput.value = histIdx < history.length ? history[histIdx] : '';
        if (histIdx >= history.length) histIdx = -1;
      }
    }
  });

  termOut.addEventListener('click', function () { termInput.focus(); });

  hintBtn.addEventListener('click', function () {
    termInput.value = 'hint';
    runCommand('hint');
    termInput.value = '';
  });

  resetBtn.addEventListener('click', function () {
    if (confirm('确定重置进度？世界文件会保留。')) {
      fetch('/api/reset', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
        state = d.state;
        termOut.innerHTML = '';
        renderState();
        addLine('—— 进度已重置 ——', 'ok');
      });
    }
  });

  doneClose.addEventListener('click', function () {
    doneOverlay.classList.add('hidden');
  });

  // 启动
  addLine('档案馆-7 终端已连接。输入 help 查看可用命令。', 'ok');
  addLine('提示：先看看 欢迎.txt 和 诗.txt。', '');
  fetchState();
  termInput.focus();
})();
