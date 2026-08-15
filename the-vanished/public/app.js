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
  let currentFile = null;

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtClock(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
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
    currentFile = file;
    const r = await fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: file })
    });
    const d = await r.json();
    fileViewer.innerHTML = '';
    const pre = document.createElement('pre');
    pre.textContent = d.content || '（文件读取失败）';
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
    for (const s of SUSPECTS) {
      const div = document.createElement('div');
      div.className = 'suspect' + (s.name.indexOf('老周') >= 0 ? ' hot' : '');
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
      b.addEventListener('click', async function () {
        const r = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cid: cp.cid, option: opt.id })
        });
        const d = await r.json();
        // 标色
        const btns = cpOptions.querySelectorAll('.cpOption');
        btns.forEach(function (btn) {
          const id = btn.dataset.oid;
          if (id === cp.correct) btn.classList.add('correct');
          else if (id === opt.id) btn.classList.add('wrong');
          btn.disabled = true;
        });
        cpExplain.textContent = (d.correct ? '✓ 正确。' : '✗ 错误。') + d.explain;
        cpExplain.classList.remove('hidden');
        cpClose.classList.remove('hidden');
        refresh();
      });
      b.dataset.oid = opt.id;
      cpOptions.appendChild(b);
    }
    cpModal.classList.remove('hidden');
  }

  function renderEnding() {
    if (state.ended) {
      const r = fetch('/api/state').then(function (x) { return x.json(); }).then(function (d) {
        state = d;
        const ending = d.ending;
        const map = {
          perfect: '真相大白',
          good: '营救成功，真凶在逃',
          okay: '迟到的救援',
          bad: '一夜之差',
          worst: '沉默的夜班'
        };
        endTitle.textContent = '结局：' + (map[ending] || ending);
        endScore.textContent = '注意力 ' + d.finalScore + ' 分 · 查看了 ' + d.evidenceViewed.length + ' 份证据 · 答对 ' + answeredCount(d) + ' 个检查点';
        endText.textContent = endingText(ending);
        endModal.classList.remove('hidden');
      });
    } else {
      endModal.classList.add('hidden');
    }
  }

  function answeredCount(d) {
    let n = 0;
    for (const e of d.delivered) {
      if (e.kind === 'checkpoint' && e.answered) n++;
    }
    return n;
  }

  function endingText(ending) {
    const texts = {
      perfect: '00:40，你带着打印好的证据叫上门卫赵师傅，撬开配电间的锁。林薇蜷缩在角落里，还活着。警方从老周的电脑里找到了 ECHO 数据外传的完整记录。一周后，老周被捕。林薇出院那天给你发来一条消息："谢谢你，侦探。"你升任安全组长。',
      good: '你在配电间找到了林薇。但因为你没能第一时间固定证据，老周连夜删除了所有记录并从后门离开。林薇安全了，真相却被埋掉了一半。',
      okay: '你根据线索找到配电间，但门被反锁。等你联系安保砸开门时，已经 01:20。林薇自己想办法敲墙引起了赵师傅注意，勉强撑到了救援。老周利用这一夜销毁了大部分证据。',
      bad: '你犹豫得太久。第二天清晨，保洁陈姐在 3 号机房配电间发现了昏迷的林薇。她被送进医院，但老周利用这一整夜销毁了全部证据。你总是想起那晚的敲门声。',
      worst: '接下来的三天，你照常值班。直到第四天，才有人在 3 号机房配电间发现了林薇的工牌和一部没电的手机。她在里面被困了 52 个小时。你始终不知道那天晚上到底发生了什么。'
    };
    return texts[ending] || '';
  }

  async function refresh() {
    const r = await fetch('/api/state');
    state = await r.json();
    clock.textContent = fmtClock(state.elapsed);
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
  });

  restartBtn.addEventListener('click', function () {
    if (confirm('确定重新开始？所有进度和证据文件将被重置。')) {
      fetch('/api/restart?fresh=1', { method: 'POST' }).then(function (r) { return r.json(); }).then(function () {
        location.reload();
      });
    }
  });

  cpClose.addEventListener('click', function () {
    cpModal.classList.add('hidden');
    refresh();
  });

  endClose.addEventListener('click', function () {
    endModal.classList.add('hidden');
  });

  refresh();
  setInterval(refresh, 1500);
})();
