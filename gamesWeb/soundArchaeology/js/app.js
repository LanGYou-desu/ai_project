'use strict';
// ============================================================
// 声音考古学 · 主控制器
// 案件流 / 仪器接线 / 提示与答案 / 笔记本 / 摩斯辅助器 / 信号发生器
// ============================================================

(() => {
  const $ = (id) => document.getElementById(id);

  let ctx = null;
  let lab = null;
  let views = null;
  let voices = null;         // { case1: Float32Array, ... }
  let voiceSr = 22050;       // 上面这些素材的真实采样率（解码后才知道）
  let currentCaseId = null;
  let hintCount = 0;
  const clipCache = new Map(); // caseId → AudioBuffer（合成一次即可反复切回）

  const PROG_KEY = 'af_progress_v1';
  const NOTES_KEY = 'af_notes';
  const VOICE_SR = 22050;    // 内嵌语音素材的原生采样率
  const TUTORIAL_KEY = 'af_tutorial_v1';

  let bootStarted = false;
  let bootVisible = true;
  let bootRaf = 0;
  let bootInterval = 0;
  let bootTypeTimer = 0;
  let stampTimer = 0;
  let fitRaf = 0;
  let lastFitKey = '';
  let scopeObserver = null;

  const prefersReducedMotion = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ==================== 启动画面动画 ==================== */

  function initBootVisuals() {
    const cv = $('boot-canvas');
    const bars = $('boot-bars');
    if (bars && !bars.childElementCount) {
      for (let i = 0; i < 48; i++) {
        const s = document.createElement('span');
        s.style.setProperty('--d', (0.55 + Math.random() * 1.1).toFixed(2) + 's');
        s.style.setProperty('--delay', (Math.random() * 1.2).toFixed(2) + 's');
        bars.appendChild(s);
      }
    }

    const reduce = prefersReducedMotion();
    const g = cv && cv.getContext ? cv.getContext('2d') : null;
    let W = 0, H = 0, dpr = 1;

    function resize() {
      if (!cv || !g) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.max(2, Math.floor(W * dpr));
      cv.height = Math.max(2, Math.floor(H * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    }

    function waveLine(yBase, amp, freq, phase, speed, t, alpha, width) {
      g.beginPath();
      const step = W < 600 ? 3 : 2;
      for (let x = 0; x <= W + step; x += step) {
        const k = x / Math.max(W, 1);
        const env = Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
        const v =
          Math.sin(k * freq + t * speed + phase) * 0.62 +
          Math.sin(k * freq * 2.37 - t * speed * 0.73 + phase) * 0.26 +
          Math.sin(k * freq * 0.31 + t * speed * 1.61) * 0.12;
        const y = yBase + v * amp * env;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(61,255,138,' + alpha + ')';
      g.lineWidth = width;
      g.shadowColor = 'rgba(61,255,138,.55)';
      g.shadowBlur = 12;
      g.stroke();
      g.shadowBlur = 0;
    }

    function draw(t) {
      if (!g || !W || !H) return;
      g.clearRect(0, 0, W, H);

      // 细网格
      const grid = W < 600 ? 38 : 62;
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(61,255,138,.045)';
      g.beginPath();
      for (let x = 0; x < W; x += grid) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (let y = 0; y < H; y += grid) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();

      // 主示波与副示波
      waveLine(H * 0.73, H < 620 ? 26 : 54, 9, 0, 1.15, t, 0.34, 1.6);
      waveLine(H * 0.73, H < 620 ? 13 : 23, 19, 1.9, 2.4, t, 0.15, 1);
      waveLine(H * 0.29, H < 620 ? 9 : 17, 13, 3.1, 0.7, t, 0.1, 1);

      // 扫描线
      const sx = (t * (W < 600 ? 34 : 62)) % (W + 120) - 60;
      const grad = g.createLinearGradient(sx - 26, 0, sx + 26, 0);
      grad.addColorStop(0, 'rgba(61,255,138,0)');
      grad.addColorStop(0.5, 'rgba(61,255,138,.12)');
      grad.addColorStop(1, 'rgba(61,255,138,0)');
      g.fillStyle = grad;
      g.fillRect(sx - 26, 0, 52, H);

      // 偶发信号点
      const blob = Math.pow(Math.max(0, Math.sin(t * 0.9)), 8);
      if (blob > 0.3) {
        const bx = W * (0.2 + 0.6 * ((t * 0.07) % 1));
        g.beginPath();
        g.arc(bx, H * 0.73, 2 + blob * 3, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,209,102,' + (0.25 + blob * 0.45) + ')';
        g.fill();
      }
    }

    function frame(ts) {
      if (!bootVisible) return;
      draw(ts / 1000);
      bootRaf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!reduce) {
      bootRaf = requestAnimationFrame(frame);
    } else {
      draw(0);
    }

    // 读数抖动 + 计时
    let elapsed = 0;
    function tick() {
      if (!bootVisible) return;
      elapsed++;
      const freq = 87.56 + Math.random() * 0.09;
      const gain = -12.4 + (Math.random() - 0.5) * 0.7;
      const noise = -94 - Math.random() * 2;
      if ($('boot-freq')) $('boot-freq').textContent = freq.toFixed(2);
      if ($('boot-gain')) $('boot-gain').textContent = '−' + Math.abs(gain).toFixed(1) + ' dB';
      if ($('boot-noise')) $('boot-noise').textContent = Math.round(noise) + ' dBFS';
      if ($('boot-timer')) {
        const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const mm = String(Math.floor(elapsed / 60) % 60).padStart(2, '0');
        const ss = String(elapsed % 60).padStart(2, '0');
        $('boot-timer').textContent = hh + ':' + mm + ':' + ss;
      }
    }
    bootInterval = setInterval(tick, 1000);

    // 打字机
    const msgs = [
      'LINK ESTABLISHED // 87.60 MHz',
      'DEMODULATING 6 EVIDENCE REELS ...',
      'SPECTRAL RESIDUE DETECTED // AWAITING OPERATOR'
    ];
    let mi = 0, ci = 0;
    function typeStep() {
      if (!bootVisible) return;
      const el = $('boot-type');
      if (!el) return;
      const msg = msgs[mi];
      if (ci < msg.length) {
        el.textContent = msg.slice(0, ++ci);
        bootTypeTimer = setTimeout(typeStep, 34);
      } else {
        bootTypeTimer = setTimeout(() => {
          mi = (mi + 1) % msgs.length;
          ci = 0;
          el.textContent = '';
          typeStep();
        }, 1800);
      }
    }
    if (reduce) {
      const el = $('boot-type');
      if (el) el.textContent = msgs[0];
    } else {
      typeStep();
    }
  }

  function stopBootVisuals() {
    bootVisible = false;
    if (bootRaf) { cancelAnimationFrame(bootRaf); bootRaf = 0; }
    if (bootInterval) { clearInterval(bootInterval); bootInterval = 0; }
    if (bootTypeTimer) { clearTimeout(bootTypeTimer); bootTypeTimer = 0; }
  }

  /* ==================== 移动端抽屉 / 新手引导 ==================== */

  function isMobileWidth() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
  }

  function setDrawer(which) {
    const left = $('case-list');
    const right = $('evidence');
    const backdrop = $('drawer-backdrop');
    const openLeft = which === 'left';
    const openRight = which === 'right';
    if (left) left.classList.toggle('drawer-open', openLeft);
    if (right) right.classList.toggle('drawer-open', openRight);
    document.body.classList.toggle('drawer-open', openLeft || openRight);
    if (backdrop) backdrop.classList.toggle('hidden', !(openLeft || openRight));
    const bl = $('btn-open-cases'), br = $('btn-open-dossier');
    if (bl && bl.setAttribute) bl.setAttribute('aria-expanded', openLeft ? 'true' : 'false');
    if (br && br.setAttribute) br.setAttribute('aria-expanded', openRight ? 'true' : 'false');
  }

  function closeDrawers() { setDrawer(null); }

  function bindDrawers() {
    const bl = $('btn-open-cases');
    const br = $('btn-open-dossier');
    if (bl) bl.addEventListener('click', () => {
      setDrawer(bl.getAttribute && bl.getAttribute('aria-expanded') === 'true' ? null : 'left');
    });
    if (br) br.addEventListener('click', () => {
      setDrawer(br.getAttribute && br.getAttribute('aria-expanded') === 'true' ? null : 'right');
    });
    const backdrop = $('drawer-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeDrawers);

    document.querySelectorAll('[data-drawer-close]').forEach((b) => {
      b.addEventListener('click', closeDrawers);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) {
        closeDrawers();
      }
    });
    window.addEventListener('resize', () => {
      if (!isMobileWidth()) closeDrawers();
    });
  }

  const TUT_STEPS = [
    {
      title: '先听，再拆',
      text: '按 <b>空格</b> 或点播放键，先原速听一遍。再用<b>倒放、变速、滤波</b>寻找藏在噪音里的异常。',
      target: 'btn-play'
    },
    {
      title: '让声音现形',
      text: '波形上点击任意位置可<b>跳转</b>；频谱图会画出频率随时间的变化，摩斯与隐形文字都藏在这里。',
      target: 'wave'
    },
    {
      title: '把发现变成结论',
      text: '物证、案情与提示都在<b>卷宗</b>里。把结论输入提交框；卡住时点「提示」——每题最多三条。',
      target: null
    }
  ];

  let tutIndex = 0;
  let tutTarget = null;

  function clearTutTarget() {
    if (tutTarget && tutTarget.classList) tutTarget.classList.remove('tut-target');
    document.querySelectorAll('.tut-target').forEach((el) => el.classList.remove('tut-target'));
    tutTarget = null;
  }

  function renderTutorial() {
    clearTutTarget();
    const step = TUT_STEPS[tutIndex];
    const isLast = tutIndex === TUT_STEPS.length - 1;
    const targetId = step.target || (isMobileWidth() ? 'btn-open-dossier' : 'ans-input');
    tutTarget = $(targetId);
    if (tutTarget) {
      tutTarget.classList.add('tut-target');
      if (isMobileWidth()) {
        try { tutTarget.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
      }
    }
    $('tut-title').textContent = step.title;
    $('tut-text').innerHTML = step.text;
    $('tut-step').textContent = String(tutIndex + 1).padStart(2, '0') + ' / ' + String(TUT_STEPS.length).padStart(2, '0');
    $('tut-prev').disabled = tutIndex === 0;
    $('tut-next').textContent = isLast ? '完成 ✓' : '下一步 ▸';
    const dots = $('tut-dots');
    dots.innerHTML = '';
    TUT_STEPS.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'tut-dot' + (i === tutIndex ? ' on' : '');
      dots.appendChild(d);
    });
  }

  function closeTutorial() {
    clearTutTarget();
    $('tutorial').classList.add('hidden');
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) { /* ignore */ }
  }

  function showTutorial(force) {
    let seen = false;
    try { seen = localStorage.getItem(TUTORIAL_KEY) === '1'; } catch (e) { /* ignore */ }
    if (seen && !force) return;
    tutIndex = 0;
    renderTutorial();
    $('tutorial').classList.remove('hidden');
  }

  function bindTutorial() {
    $('tut-prev').addEventListener('click', () => {
      if (tutIndex > 0) { tutIndex--; renderTutorial(); }
    });
    $('tut-next').addEventListener('click', () => {
      if (tutIndex < TUT_STEPS.length - 1) { tutIndex++; renderTutorial(); }
      else closeTutorial();
    });
    $('tut-skip').addEventListener('click', closeTutorial);
    const help = $('help-btn');
    if (help) help.addEventListener('click', () => showTutorial(true));
  }

  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(PROG_KEY));
      if (p && Array.isArray(p.solved)) return p; // 数据损坏/旧版本 → 退回默认
    } catch (e) { /* 隐私模式下 localStorage 可能抛异常 */ }
    return { solved: [] };
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (e) { /* 忽略 */ }
  }
  function loadNote() {
    try { return localStorage.getItem(NOTES_KEY) || ''; } catch (e) { return ''; }
  }
  function saveNote(v) {
    try { localStorage.setItem(NOTES_KEY, v); } catch (e) { /* 忽略 */ }
  }
  const progress = loadProgress();

  // ---------- 工具函数 ----------

  function b64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const ab = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(ab);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return ab;
  }

  // 解码内嵌语音素材。
  // 关键：decodeAudioData() 会把数据重采样到目标上下文的采样率，所以
  //   1) 优先用一个 22050Hz 的 OfflineAudioContext 解码，素材保持原生采样率；
  //   2) 退回主上下文解码时，把 buf.sampleRate 一起返回，交给 cases.js 换算。
  // 否则在 48kHz 设备上，语音会被当成 22050Hz 播放 → 拉长/降调 2.18 倍。
  async function decodeVoice(b64, targetSr) {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OfflineCtx) {
      try {
        const off = new OfflineCtx(1, 1, targetSr);
        const buf = await off.decodeAudioData(b64ToArrayBuffer(b64));
        return { data: buf.getChannelData(0), sr: buf.sampleRate };
      } catch (e) { /* 退回主上下文 */ }
    }
    const buf = await ctx.decodeAudioData(b64ToArrayBuffer(b64));
    return { data: buf.getChannelData(0), sr: buf.sampleRate };
  }

  function buildCaseClip(c) {
    const cached = clipCache.get(c.id);
    if (cached) return cached;
    const data = buildCaseAudio(c, voices, voiceSr);
    const buf = ctx.createBuffer(1, data.length, c.sr);
    buf.copyToChannel(data, 0);
    clipCache.set(c.id, buf);
    return buf;
  }

  function fmtHz(v) {
    return v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'kHz' : v + 'Hz';
  }
  const FREQ_MIN = 50, FREQ_MAX = 20000;
  function freqToSlider(f) {
    return Math.round(1000 * Math.log(f / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN));
  }
  function sliderToFreq(v) {
    return Math.round(FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, v / 1000));
  }

  function setStatus(s) { $('st-info').textContent = s; }

  // ---------- 自检模式（?selftest=1，供无头浏览器验证音频管线） ----------

  const SELFTEST = /[?&]selftest=1/.test(location.search);

  function selftestReport(msg) {
    let el = document.getElementById('selftest');
    if (!el) {
      el = document.createElement('div');
      el.id = 'selftest';
      el.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99999;background:#000;color:#0f0;font:12px monospace;padding:4px;white-space:pre-wrap;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }

  if (SELFTEST) {
    window.addEventListener('error', (e) => {
      selftestReport('JS-ERROR: ' + e.message + ' @' + (e.filename || '') + ':' + e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      selftestReport('PROMISE-REJECT: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
    });
    window.addEventListener('load', () => {
      setTimeout(() => {
        try { $('boot-btn').click(); } catch (err) { selftestReport('BOOT-CLICK-ERROR: ' + err); }
      }, 200);
    });
  }

  // ---------- 启动 ----------

  initBootVisuals();

  $('boot-btn').addEventListener('click', async () => {
    if (bootStarted) return;
    bootStarted = true;
    const bootEl = $('boot');
    bootEl.classList.add('is-entering');
    $('boot-btn').disabled = true;
    $('boot-skip').disabled = true;
    $('boot-status').textContent = 'SYSTEM LINK // 正在建立音频链路…';
    try {
      const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxCtor) {
        throw new Error('此浏览器不支持 Web Audio API，请改用 Chrome / Edge。');
      }
      ctx = new AudioCtxCtor();
      // 自动播放策略：上下文可能以 suspended 状态启动（无用户手势/被策略挂起）
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try { await ctx.resume(); } catch (e) { /* 首次点击播放时浏览器会再给一次机会 */ }
      }
      lab = new AudioLab(ctx);
      lab.onEnded = () => { $('btn-play').textContent = '▶'; updateTimeLabel(); };

      views = new LabViews($('wave'), $('spec'), lab.master, ctx);
      views.setFracFn(() => lab.getFrac());
      views.onTick = () => updateTimeLabel();

      // 解码内嵌语音素材（保持 22050Hz 原生采样率，见 decodeVoice 注释）
      voices = {};
      for (const k of Object.keys(VOICE_ASSETS)) {
        const v = await decodeVoice(VOICE_ASSETS[k], VOICE_SR);
        voices[k] = v.data;
        voiceSr = v.sr;
      }

      stopBootVisuals();
      $('boot').classList.add('hidden');
      $('app').classList.remove('hidden');
      $('app').classList.add('app-enter');
      views.wave._resize();
      views.spec._resize();
      views.start();
      wireInstruments();
      bindDrawers();
      bindTutorial();
      renderCaseList();
      openCase(lastActiveId());
      setTimeout(() => showTutorial(false), 650);

      // 自检：真实播放并采样抓取的音频流，验证音频确实在流动
      if (SELFTEST) {
        window.__lab = lab; // 调试钩子
        window.__views = views; // 调试钩子
        selftestReport('ctx=' + ctx.state + ' sr=' + ctx.sampleRate +
          ' voices=' + Object.keys(voices).length + ' voiceSr=' + voiceSr +
          ' scope=' + views.scopeAvailable + ' clip=' + lab.duration.toFixed(2) + 's');
        setTimeout(() => {
          try {
            lab.play();
            setTimeout(() => {
              selftestReport('RESULT ctx=' + ctx.state + ' sr=' + ctx.sampleRate +
                ' voices=' + Object.keys(voices).length + ' voiceSr=' + voiceSr +
                ' scope=' + views.scopeAvailable +
                ' clip=' + lab.duration.toFixed(2) + 's' +
                ' playing=' + lab.playing + ' streamRMS=' + views.tapRms().toFixed(3) +
                ' filter=' + lab.filter.type + ' vol=' + lab.master.gain.value.toFixed(2));
            }, 1200);
          } catch (err) {
            selftestReport('PLAY-FAIL: ' + (err && err.message || err));
          }
        }, 400);
      }
    } catch (err) {
      bootStarted = false;
      bootEl.classList.remove('is-entering');
      $('boot-btn').disabled = false;
      $('boot-skip').disabled = false;
      $('boot-status').textContent = 'SYSTEM READY // 等待接入';
      const msg = '启动失败: ' + (err && err.message ? err.message : err);
      if (SELFTEST) selftestReport('BOOT-FAIL: ' + msg);
      else alert(msg);
    }
  });

  $('boot-skip').addEventListener('click', () => {
    if (!bootStarted) $('boot-btn').click();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && bootVisible) {
      e.preventDefault();
      if (!bootStarted) $('boot-btn').click();
    }
  });

  window.addEventListener('resize', () => {
    if (!views) return;
    views.wave._resize();
    views.spec._resize();
  });

  // ---------- 案件流 ----------

  function lastActiveId() {
    if (progress.last && CASES[progress.last]) return progress.last;
    for (const id of CASE_ORDER) if (!progress.solved.includes(id)) return id;
    return 'case1';
  }

  function nextCaseId() {
    for (const id of CASE_ORDER) if (!progress.solved.includes(id)) return id;
    return null;
  }

  function renderCaseList() {
    const el = $('case-list');
    el.innerHTML =
      '<div class="case-head"><h3>案件列表</h3>' +
      '<button class="drawer-close" type="button" data-drawer-close aria-label="关闭卷宗">✕</button></div>';
    const closeBtn = el.querySelector('[data-drawer-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawers);
    let unlocked = true;
    for (const id of CASE_ORDER) {
      const c = CASES[id];
      const solved = progress.solved.includes(id);
      const row = document.createElement('div');
      row.className = 'case-item' +
        (solved ? ' solved' : '') +
        (id === currentCaseId ? ' active' : '');
      row.innerHTML =
        '<span class="case-ico">' + (solved ? '✅' : unlocked ? '🔓' : '🔒') + '</span>' +
        '<span class="case-code">' + c.code + '</span>' +
        '<span class="case-name">' + c.title + '</span>';
      row.title = c.tag;
      if (unlocked || solved) {
        row.addEventListener('click', () => openCase(id));
      } else {
        row.classList.add('locked');
      }
      el.appendChild(row);
      if (!solved) unlocked = false;
    }
  }

  function openCase(id) {
    if (!CASES[id]) return;
    closeDrawers();
    currentCaseId = id;
    progress.last = id;
    saveProgress(progress);
    hintCount = 0;

    const c = CASES[id];
    $('case-title').textContent = c.code + ' · ' + c.title;
    $('case-tag').textContent = c.tag;
    $('hdr-case').textContent = c.code;
    $('st-case').textContent = c.code + ' ' + c.title;

    // 卷宗
    $('ev-back').innerHTML = '<h4>案情</h4>' + c.backstory.map((p) => '<p>' + p + '</p>').join('');
    $('ev-evidence').innerHTML = '<h4>物证</h4>' +
      c.evidence.map((e) => '<p class="ev-item"><b>' + e.label + '</b> · ' + e.text + '</p>').join('');
    $('hint-text').classList.add('hidden');
    $('hint-text').innerHTML = '';
    $('hint-btn').disabled = false;
    $('hint-btn').textContent = '提示 (0/3)';
    $('ans-input').value = '';
    $('ans-msg').textContent = '';
    $('ans-msg').className = '';

    const solved = progress.solved.includes(id);
    $('archive').classList.toggle('hidden', !solved);
    $('epilogue').classList.add('hidden');
    $('next-btn').classList.add('hidden');
    if (solved) {
      $('archive-text').textContent = c.note;
      if (id === 'case6' && c.epilogue) {
        $('epilogue').classList.remove('hidden');
        $('epilogue').innerHTML = '<h4>🕊 结案档案</h4>' +
          c.epilogue.map((p) => '<p>' + p + '</p>').join('');
      } else {
        $('next-btn').classList.remove('hidden');
      }
    }

    // 合成并载入音频
    setStatus('正在合成音频素材…');
    setTimeout(() => {
      // 清空示波器画布，避免上一个案件的频谱残留干扰
      views.wave._resize();
      views.spec._resize();
      lab.setClip(buildCaseClip(c));
      resetInstruments();
      updateTimeLabel();
      setStatus('就绪 — 请佩戴耳机，开始破译');
      renderCaseList();
    }, 30);
  }

  // ---------- 仪器 ----------

  function resetInstruments() {
    $('sel-filter').value = 'allpass';
    $('rng-freq').value = freqToSlider(20000);
    $('rng-q').value = 7;
    $('rng-gain').value = 0;
    $('rng-boost').value = 0;
    $('rng-gate').value = 8;
    $('rng-vol').value = 0;
    $('chk-gate').checked = false;
    $('sel-speed').value = '1';
    $('sel-spec-range').value = 'full';
    if (views) views.spec.setFMax(null);

    lab.setFilterType('allpass');
    lab.setFilterFreq(20000);
    lab.setFilterQ(0.7);
    lab.setFilterGainDb(0);
    lab.setBoostDb(0);
    lab.setGate(0.08, false);
    lab.setMasterDb(0);
    lab.setSpeed(1);
    lab.setReversed(false);
    lab.setLoop(false);
    lab.stop();

    $('btn-reverse').classList.remove('on');
    $('btn-loop').classList.remove('on');
    $('btn-play').textContent = '▶';
    $('gen-badge').classList.add('hidden');
    updateEqLabels();
  }

  function updateEqLabels() {
    $('freq-val').textContent = fmtHz(sliderToFreq(+$('rng-freq').value));
    $('q-val').textContent = (+$('rng-q').value / 10).toFixed(1);
    $('gain-val').textContent = $('rng-gain').value + 'dB';
    $('boost-val').textContent = $('rng-boost').value + 'dB';
    $('gate-val').textContent = (+$('rng-gate').value / 100).toFixed(2);
    $('vol-val').textContent = $('rng-vol').value + 'dB';
    $('gen-freq-val').textContent = fmtHz(sliderToFreq(+$('gen-freq').value));
  }

  function updateTimeLabel() {
    if (!lab || !lab.buffer) return;
    const d = lab.duration;
    $('time-label').textContent = (lab.getFrac() * d).toFixed(1) + 's / ' + d.toFixed(1) + 's';
  }

  function wireInstruments() {
    // 传输
    $('btn-play').addEventListener('click', () => {
      if (!lab.buffer) return;
      lab.togglePlay();
      $('btn-play').textContent = lab.playing ? '⏸' : '▶';
    });
    $('btn-stop').addEventListener('click', () => {
      lab.stop();
      $('btn-play').textContent = '▶';
      updateTimeLabel();
    });
    $('btn-reverse').addEventListener('click', () => {
      const v = !lab.reversed;
      lab.setReversed(v);
      $('btn-reverse').classList.toggle('on', v);
    });
    $('btn-loop').addEventListener('click', () => {
      const v = !lab.loop;
      lab.setLoop(v);
      $('btn-loop').classList.toggle('on', v);
    });
    $('sel-speed').addEventListener('change', (e) => lab.setSpeed(parseFloat(e.target.value)));

    // 波形点击跳转
    $('wave').addEventListener('click', (e) => {
      if (!lab.buffer) return;
      const rect = $('wave').getBoundingClientRect();
      lab.seekFrac((e.clientX - rect.left) / rect.width);
      updateTimeLabel();
    });

    // 滤波
    $('sel-filter').addEventListener('change', (e) => lab.setFilterType(e.target.value));
    $('rng-freq').addEventListener('input', (e) => {
      const v = sliderToFreq(+e.target.value);
      lab.setFilterFreq(v);
      $('freq-val').textContent = fmtHz(v);
    });
    $('rng-q').addEventListener('input', (e) => {
      const v = +e.target.value / 10;
      lab.setFilterQ(v);
      $('q-val').textContent = v.toFixed(1);
    });
    $('rng-gain').addEventListener('input', (e) => {
      lab.setFilterGainDb(+e.target.value);
      $('gain-val').textContent = e.target.value + 'dB';
    });
    $('rng-boost').addEventListener('input', (e) => {
      lab.setBoostDb(+e.target.value);
      $('boost-val').textContent = e.target.value + 'dB';
    });
    $('chk-gate').addEventListener('change', (e) => {
      lab.setGate(+$('rng-gate').value / 100, e.target.checked);
    });
    $('rng-gate').addEventListener('input', (e) => {
      lab.setGate(+e.target.value / 100, $('chk-gate').checked);
      $('gate-val').textContent = (+e.target.value / 100).toFixed(2);
    });
    $('rng-vol').addEventListener('input', (e) => {
      lab.setMasterDb(+e.target.value);
      $('vol-val').textContent = e.target.value + 'dB';
    });
    $('btn-reset-instr').addEventListener('click', resetInstruments);

    // 频谱显示范围
    $('sel-spec-range').addEventListener('change', (e) => {
      const v = e.target.value;
      views.spec.setFMax(v === 'full' ? null : parseInt(v, 10));
    });

    // 提示
    $('hint-btn').addEventListener('click', () => {
      const c = CASES[currentCaseId];
      if (!c || hintCount >= c.hints.length) return;
      const el = $('hint-text');
      el.classList.remove('hidden');
      el.innerHTML = '<p class="hint-line"><b>提示 ' + (hintCount + 1) + ':</b> ' +
        c.hints[hintCount] + '</p>' + el.innerHTML;
      hintCount++;
      $('hint-btn').textContent = '提示 (' + hintCount + '/' + c.hints.length + ')';
      if (hintCount >= c.hints.length) $('hint-btn').disabled = true;
    });

    // 答案
    const submitAnswer = () => {
      const c = CASES[currentCaseId];
      const val = normalizeAnswer($('ans-input').value);
      const msg = $('ans-msg');
      if (!val) { msg.textContent = '请输入你的结论。'; msg.className = 'bad'; return; }
      const ok = c.accepts.some((a) => normalizeAnswer(a) === val);
      msg.className = ok ? 'ok' : 'bad';
      msg.textContent = ok ? '✔ 正确！信号破译成功。' : '✘ 电码不符……再听听看？';
      if (ok) {
        if (!progress.solved.includes(c.id)) progress.solved.push(c.id);
        saveProgress(progress);
        $('archive').classList.remove('hidden');
        $('archive-text').textContent = c.note;
        if (c.id === 'case6' && c.epilogue) {
          $('epilogue').classList.remove('hidden');
          $('epilogue').innerHTML = '<h4>🕊 结案档案</h4>' +
            c.epilogue.map((p) => '<p>' + p + '</p>').join('');
        } else {
          $('next-btn').classList.remove('hidden');
        }
        renderCaseList();
        setStatus('案件已破译 ✔');
      }
    };
    $('ans-btn').addEventListener('click', submitAnswer);
    $('ans-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });

    $('next-btn').addEventListener('click', () => {
      const n = nextCaseId();
      if (n) openCase(n);
    });

    // 调查笔记
    $('note-box').value = loadNote();
    let noteTimer = null;
    $('note-box').addEventListener('input', () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => saveNote($('note-box').value), 400);
    });

    // 摩斯辅助器
    let morSeq = '';
    const morRender = () => {
      $('mor-seq').textContent = morSeq || '（用下方按钮转写听到的点划）';
      $('mor-dec').textContent = morSeq ? '→ ' + Morse.decode(morSeq) : '…';
    };
    $('btn-dot').addEventListener('click', () => { morSeq += '.'; morRender(); });
    $('btn-dash').addEventListener('click', () => { morSeq += '-'; morRender(); });
    $('btn-cgap').addEventListener('click', () => { morSeq += ' '; morRender(); });
    $('btn-wgap').addEventListener('click', () => { morSeq += ' / '; morRender(); });
    $('btn-bsp').addEventListener('click', () => { morSeq = morSeq.slice(0, -1).trimEnd(); morRender(); });
    $('btn-mclear').addEventListener('click', () => { morSeq = ''; morRender(); });
    morRender();

    $('mor-ref-toggle').addEventListener('click', () => {
      const el = $('mor-ref');
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        el.innerHTML =
          Morse.REF_LETTERS.map((row) =>
            '<div>' + row.map(([ch, code]) =>
              '<span class="mor-cell"><b>' + ch + '</b> ' + code + '</span>').join('') + '</div>'
          ).join('') +
          '<div>' + Morse.REF_DIGITS.map(([d, code]) =>
            '<span class="mor-cell"><b>' + d + '</b> ' + code + '</span>').join('') + '</div>';
        $('mor-ref-toggle').textContent = '收起';
      } else {
        el.classList.add('hidden');
        $('mor-ref-toggle').textContent = '速查表';
      }
    });

    // 信号发生器
    $('gen-freq').value = freqToSlider(1200);
    updateEqLabels();
    $('gen-freq').addEventListener('input', (e) => {
      $('gen-freq-val').textContent = fmtHz(sliderToFreq(+e.target.value));
    });
    $('btn-gen').addEventListener('click', () => {
      if (!ctx) return;
      const type = $('gen-type').value;
      const freq = sliderToFreq(+$('gen-freq').value);
      const text = $('gen-text').value || (type === 'morse' ? 'SOS' : 'ECHO');
      const sr = 22050;
      let data;
      if (type === 'sine') data = Synth.sine(freq, Math.floor(3 * sr), sr, 0.02, 0.3);
      else if (type === 'noise') data = Synth.noise(Math.floor(3 * sr), 7);
      else if (type === 'morse') data = Synth.morseSignal(text, sr, { freq, dot: 0.09, gain: 0.7 });
      else data = Synth.fontToneImage(text, sr, { colDur: 0.045, fBase: 700, fStep: 150, gain: 0.5 });
      const buf = ctx.createBuffer(1, data.length, sr);
      buf.copyToChannel(Synth.normalize(data, 0.8), 0);
      lab.setClip(buf);
      resetInstruments();
      $('gen-badge').classList.remove('hidden');
      updateTimeLabel();
      setStatus('发生器信号已载入 — 练习仪器的好材料');
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') return;
      const t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || t === 'BUTTON') return;
      e.preventDefault();
      $('btn-play').click();
    });

    // 重置进度
    $('reset-btn').addEventListener('click', () => {
      if (!confirm('确定重置所有破案进度？')) return;
      progress.solved = [];
      progress.last = 'case1';
      saveProgress(progress);
      openCase('case1');
    });
  }
})();
