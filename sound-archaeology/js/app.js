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
  let currentCaseId = null;
  let hintCount = 0;

  const PROG_KEY = 'af_progress_v1';
  const NOTES_KEY = 'af_notes';

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROG_KEY)) || { solved: [] }; }
    catch (e) { return { solved: [] }; }
  }
  function saveProgress(p) { localStorage.setItem(PROG_KEY, JSON.stringify(p)); }
  const progress = loadProgress();

  // ---------- 工具函数 ----------

  function decodeB64(b64) {
    const bin = atob(b64);
    const ab = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(ab);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return ctx.decodeAudioData(ab);
  }

  function buildCaseClip(c) {
    const data = buildCaseAudio(c, voices);
    const buf = ctx.createBuffer(1, data.length, c.sr);
    buf.copyToChannel(data, 0);
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

  $('boot-btn').addEventListener('click', async () => {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    lab = new AudioLab(ctx);
    lab.onEnded = () => { $('btn-play').textContent = '▶'; updateTimeLabel(); };

    views = new LabViews($('wave'), $('spec'), lab.master, ctx);
    views.setFracFn(() => lab.getFrac());
    views.onTick = () => updateTimeLabel();

    // 解码内嵌语音素材
    voices = {};
    for (const k of Object.keys(VOICE_ASSETS)) {
      const buf = await decodeB64(VOICE_ASSETS[k]);
      voices[k] = buf.getChannelData(0);
    }

    $('boot').classList.add('hidden');
    $('app').classList.remove('hidden');
    views.wave._resize();
    views.spec._resize();
    views.start();
    wireInstruments();
    renderCaseList();
    openCase(lastActiveId());

    // 自检：真实播放并采样抓取的音频流，验证音频确实在流动
    if (SELFTEST) {
      window.__lab = lab; // 调试钩子
      window.__views = views; // 调试钩子
      selftestReport('ctx=' + ctx.state + ' sr=' + ctx.sampleRate +
        ' voices=' + Object.keys(voices).length + ' clip=' + lab.duration.toFixed(2) + 's');
      setTimeout(() => {
        try {
          lab.play();
          setTimeout(() => {
            selftestReport('RESULT ctx=' + ctx.state + ' sr=' + ctx.sampleRate +
              ' voices=' + Object.keys(voices).length + ' clip=' + lab.duration.toFixed(2) + 's' +
              ' playing=' + lab.playing + ' streamRMS=' + views.tapRms().toFixed(3) +
              ' filter=' + lab.filter.type + ' vol=' + lab.master.gain.value.toFixed(2));
          }, 1200);
        } catch (err) {
          selftestReport('PLAY-FAIL: ' + (err && err.message || err));
        }
      }, 400);
    }
  } catch (err) {
    const msg = '启动失败: ' + (err && err.message ? err.message : err);
    if (SELFTEST) selftestReport('BOOT-FAIL: ' + msg);
    else alert(msg);
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
    el.innerHTML = '<h3>案件列表</h3>';
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
    $('note-box').value = localStorage.getItem(NOTES_KEY) || '';
    let noteTimer = null;
    $('note-box').addEventListener('input', () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => localStorage.setItem(NOTES_KEY, $('note-box').value), 400);
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
