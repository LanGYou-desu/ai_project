'use strict';
// THE VANISHED 前端：聊天 / 通知 / 证据 / 案件板 / 检查点 / 结局
(function () {
  const chatBox = document.getElementById('chatBox');
  const noticeBox = document.getElementById('noticeBox');
  const fileList = document.getElementById('fileList');
  const fileViewer = document.getElementById('fileViewer');
  const board = document.getElementById('board');
  const progressList = document.getElementById('progressList');
  const clock = document.getElementById('clock');
  const attentionEl = document.getElementById('attention');
  const speedSel = document.getElementById('speedSel');
  const restartBtn = document.getElementById('restartBtn');
  const cpModal = document.getElementById('checkpointModal');
  const cpQuestion = document.getElementById('cpQuestion');
  const cpOptions = document.getElementById('cpOptions');
  const cpExplain = document.getElementById('cpExplain');
  const cpClose = document.getElementById('cpClose');
  const endModal = document.getElementById('endingModal');
  const endTitle = document.getElementById('endTitle');
  const endScore = document.getElementById('endScore');
  const endText = document.getElementById('endText');
  const endClose = document.getElementById('endClose');

  const SENDERS = {
    linwei: '林薇',
    laozhou: '老周',
    zhaoshifu: '赵师傅'
  };
  const SUSPECTS = [
    { name: '老周（运维主管）', desc: '23:50-23:52 反常地快速进出 3 号机房；让你"别管"；替你提交了请假审批。' },
    { name: '赵师傅（门卫）', desc: '负责夜班巡逻，21:00 巡查正常。听到 3 号机房的敲墙声。' },
    { name: '陈姐（保洁）', desc: '22:00 保洁经过 3 号机房，无异常记录。' },
    { name: '林薇', desc: '失踪者。23:47 进入 3 号机房后失踪，留下加密消息与定时求救邮件。' }
  ];
  const PROGRESS = [
    { key: 'sys-0', text: '00:00 接班，发现林薇不在工位' },
    { key: 'chat-1', text: '收到林薇延迟送达的消息' },
    { key: 'ev-1', text: '查看门禁记录' },
    { key: 'ev-2', text: '查看摄像头日志' },
    { key: 'ev-3', text: '查看值班表' },
    { key: 'ev-4', text: '查看请假审批' },
    { key: 'ev-5', text: '查看配电间访问日志' },
    { key: 'chat-5', text: '解码林薇的 base64 消息' },
    { key: 'ev-6', text: '查看定时邮件（关键）' },
    { key: 'ev-7', text: '查看系统广播' },
    { key: 'ending-1', text: '做出最终选择' }
  ];

  let state = null;
  let lastChatCount = 0;
  let lastNoticeCount = 0;
  let lastFileCount = 0;
  let pendingCid = null;
  let awaitingClose = false;   // 正在展示检查点解析，别被下一次轮询关掉
  let endingShown = false;     // 结局弹窗只自动弹一次

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtClock(sec) {
    const s = Number(sec) > 0 ? Number(sec) : 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return pad2(h) + ':' + pad2(m);
  }

  function renderChat() {
    const msgs = state.delivered.filter(e => e.kind === 'chat' || e.kind === 'system');
    if (msgs.length === lastChatCount) return;
    lastChatCount = msgs.length;
    chatBox.innerHTML = '';
    for (const e of msgs) {
      const div = document.createElement('div');
      if (e.kind === 'system') {
        div.className = 'msg system';
        div.textContent = e.text;
      } else {
        div.className = 'msg ' + (SENDERS[e.from] ? e.from : 'system');
        const head = document.createElement('span');
        head.className = 'mhead';
        head.textContent = (SENDERS[e.from] || e.from) + ' · ' + e.time;
        div.appendChild(head);
        div.appendChild(document.createTextNode(e.text));
      }
      chatBox.appendChild(div);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function renderNotices() {
    const notices = state.delivered.filter(e => e.kind === 'toast');
    if (notices.length === lastNoticeCount) return;
    lastNoticeCount = notices.length;
    noticeBox.innerHTML = '';
    for (const e of notices) {
      const div = document.createElement('div');
      div.className = 'notice';
      const t = document.createElement('span');
      t.className = 'ntitle';
      t.textContent = '通知：' + e.title + '  ';
      div.appendChild(t);
      div.appendChild(document.createTextNode(e.text));
      noticeBox.appendChild(div);
    }
    noticeBox.scrollTop = noticeBox.scrollHeight;
  }

  async function openFile(file) {
    const r = await fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: file })
    });
    const d = await r.json();
    fileViewer.innerHTML = '';
    const pre = document.createElement('pre');
    pre.textContent = d.content || (d.message || '（文件读取失败）');
    fileViewer.appendChild(pre);
    refresh();
  }

  function renderFiles() {
    const files = state.delivered.filter(e => e.kind === 'evidence');
    if (files.length !== lastFileCount) {
      lastFileCount = files.length;
      fileList.innerHTML = '';
      for (const e of files) {
        const div = document.createElement('div');
        div.className = 'fitem' + (state.evidenceViewed.indexOf(e.file) >= 0 ? ' viewed' : '');
        div.textContent = '📄 ' + e.name;
        div.addEventListener('click', function () { openFile(e.file); });
        fileList.appendChild(div);
      }
    } else {
      // 更新已读状态
      const items = fileList.querySelectorAll('.fitem');
      files.forEach(function (e, i) {
        if (items[i]) items[i].classList.toggle('viewed', state.evidenceViewed.indexOf(e.file) >= 0);
      });
    }
  }

  function renderBoard() {
    board.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'font-size:11px;color:var(--dim);margin-bottom:8px;';
    head.textContent = '关系人';
    board.appendChild(head);
    // 老周只有在值班表（ev-3）出现之后才被标红，否则等于提前剧透检查点 2
    const hintReady = state.delivered.some(function (e) { return e.id === 'ev-3'; });
    for (const s of SUSPECTS) {
      const div = document.createElement('div');
      div.className = 'suspect' + (hintReady && s.name.indexOf('老周') >= 0 ? ' hot' : '');
      const n = document.createElement('div');
      n.className = 'sname';
      n.textContent = s.name;
      const d = document.createElement('div');
      d.className = 'sdesc';
      d.textContent = s.desc;
      div.appendChild(n);
      div.appendChild(d);
      board.appendChild(div);
    }
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:var(--dim);margin-top:10px;line-height:1.6;';
    hint.textContent = '提示：真正的 Windows 通知会直接弹到你的屏幕上——错过通知就可能错过线索。证据文件真实存在于 evidence/ 目录，可以随时用资源管理器打开。';
    board.appendChild(hint);
  }

  function renderProgress() {
    const deliveredIds = state.delivered.map(e => e.id);
    progressList.innerHTML = '';
    for (const p of PROGRESS) {
      const div = document.createElement('div');
      div.className = 'pitem' + (deliveredIds.indexOf(p.key) >= 0 ? ' done' : '');
      div.textContent = p.text;
      progressList.appendChild(div);
    }
  }

  function renderCheckpoint() {
    if (awaitingClose) return;   // 玩家还没点“继续”，保持解析可见
    if (!state.checkpoint) {
      cpModal.classList.add('hidden');
      pendingCid = null;
      return;
    }
    if (pendingCid === state.checkpoint) return;
    pendingCid = state.checkpoint;
    const cp = state.delivered.find(e => e.kind === 'checkpoint' && e.cid === state.checkpoint);
    if (!cp) return;
    cpQuestion.textContent = cp.question;
    cpOptions.innerHTML = '';
    cpExplain.classList.add('hidden');
    cpClose.classList.add('hidden');
    for (const opt of cp.options) {
      const b = document.createElement('button');
      b.className = 'cpOption';
      b.textContent = opt.label;
      b.dataset.oid = opt.id;
      b.addEventListener('click', async function () {
        const r = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cid: cp.cid, option: opt.id })
        });
        const d = await r.json();
        // 标色：正确选项由服务器在作答后返回（correctOption），作答前不下发
        const btns = cpOptions.querySelectorAll('.cpOption');
        btns.forEach(function (btn) {
          const id = btn.dataset.oid;
          if (id === d.correctOption) btn.classList.add('correct');
          else if (id === opt.id) btn.classList.add('wrong');
          btn.disabled = true;
        });
        if (d.ok === false) {
          cpExplain.textContent = d.message || '作答失败。';
        } else {
          cpExplain.textContent = (d.correct ? '✓ 正确。' : '✗ 错误。') + d.explain;
        }
        cpExplain.classList.remove('hidden');
        cpClose.classList.remove('hidden');
        awaitingClose = true;   // 阻止下一次轮询把弹窗和解析一起关掉
        refresh();
      });
      cpOptions.appendChild(b);
    }
    cpModal.classList.remove('hidden');
  }

  function correctCount() {
    let n = 0;
    for (const e of state.delivered) {
      if (e.kind === 'checkpoint' && e.answeredCorrectly === true) n++;
    }
    return n;
  }

  function renderEnding() {
    if (!state.ended) {
      endModal.classList.add('hidden');
      endingShown = false;
      return;
    }
    if (endingShown) return;   // 玩家关掉之后不再自动弹出
    endingShown = true;
    endTitle.textContent = '结局：' + (state.endingTitle || state.ending || '');
    endScore.textContent = '注意力 ' + state.finalScore + ' 分 · 查看了 ' +
      state.evidenceViewed.length + ' 份证据 · 答对 ' + correctCount() + ' 个检查点';
    // 结局正文由服务器从 lib/story.js 的 ENDINGS 下发，前端不再重复维护一份
    endText.textContent = state.endingText || '';
    endModal.classList.remove('hidden');
  }

  async function refresh() {
    const r = await fetch('/api/state');
    state = await r.json();
    clock.textContent = '已过 ' + fmtClock(state.elapsed);
    attentionEl.textContent = '注意力 ' + state.attention;
    renderChat();
    renderNotices();
    renderFiles();
    renderBoard();
    renderProgress();
    renderCheckpoint();
    renderEnding();
  }

  speedSel.addEventListener('change', async function () {
    await fetch('/api/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed: Number(speedSel.value) })
    });
    refresh();
  });

  restartBtn.addEventListener('click', function () {
    if (confirm('确定重新开始？所有进度和证据文件将被重置。')) {
      fetch('/api/restart?fresh=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }).then(function (r) { return r.json(); }).then(function () {
        location.reload();
      });
    }
  });

  cpClose.addEventListener('click', function () {
    awaitingClose = false;
    cpModal.classList.add('hidden');
    pendingCid = null;
    refresh();
  });

  endClose.addEventListener('click', function () {
    endModal.classList.add('hidden');
  });

  refresh();
  setInterval(refresh, 1500);
})();
