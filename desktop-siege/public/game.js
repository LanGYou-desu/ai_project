'use strict';
// DESKTOP SIEGE · 画布渲染 + 输入 + 主循环
(function () {
  const canvas = document.getElementById('cv');
  const ctx = canvas.getContext('2d');
  const hpBar = document.getElementById('hpBar');
  const shieldBar = document.getElementById('shieldBar');
  const waveNumEl = document.getElementById('waveNum');
  const waveTag = document.getElementById('waveTag');
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const killsEl = document.getElementById('kills');
  const bossBar = document.getElementById('bossBar');
  const bossName = document.getElementById('bossName');
  const bossHp = document.getElementById('bossHp');
  const titleScreen = document.getElementById('titleScreen');
  const scanInfo = document.getElementById('scanInfo');
  const startBtn = document.getElementById('startBtn');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const goStats = document.getElementById('goStats');
  const retryBtn = document.getElementById('retryBtn');
  const waveBanner = document.getElementById('waveBanner');
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerSub = document.getElementById('bannerSub');
  const toastMsg = document.getElementById('toastMsg');

  const ARENA = { w: 1600, h: 1000 };
  let scale = 1;
  let offsetX = 0, offsetY = 0;
  let engine = null;
  let wavesData = [];
  let scanData = null;
  let scanSummary = null;
  let started = false;
  let bannerTimer = 0;
  let particles = [];
  let lastTime = 0;
  let rafId = 0;

  const keys = {};
  const mouse = { x: 0, y: 0, down: false };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(window.innerWidth / ARENA.w, window.innerHeight / ARENA.h);
    offsetX = (window.innerWidth - ARENA.w * scale) / 2;
    offsetY = (window.innerHeight - ARENA.h * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function toWorld(cx, cy) {
    return { x: (cx - offsetX) / scale, y: (cy - offsetY) / scale };
  }

  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mousedown', function (e) { if (e.button === 0) mouse.down = true; });
  window.addEventListener('mouseup', function (e) { if (e.button === 0) mouse.down = false; });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function buildInput() {
    const aim = toWorld(mouse.x, mouse.y);
    return {
      left: !!(keys['KeyA'] || keys['ArrowLeft']),
      right: !!(keys['KeyD'] || keys['ArrowRight']),
      up: !!(keys['KeyW'] || keys['ArrowUp']),
      down: !!(keys['KeyS'] || keys['ArrowDown']),
      firing: mouse.down,
      aimX: aim.x,
      aimY: aim.y
    };
  }

  let actx = null;
  function ensureAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function beep(freq, dur, type, vol, slideTo) {
    if (!actx) return;
    const t0 = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }
  function sfxShoot() { beep(880, 0.05, 'square', 0.03, 440); }
  function sfxHit() { beep(220, 0.04, 'sawtooth', 0.04, 120); }
  function sfxExplode() { beep(120, 0.18, 'sawtooth', 0.07, 40); }
  function sfxPower() { beep(660, 0.08, 'triangle', 0.06); setTimeout(function () { beep(990, 0.1, 'triangle', 0.06); }, 70); }
  function sfxBossDown() { beep(300, 0.4, 'sawtooth', 0.08, 60); }
  function sfxWave() { beep(523, 0.12, 'triangle', 0.07); setTimeout(function () { beep(784, 0.16, 'triangle', 0.07); }, 110); }
  function sfxOver() { beep(400, 0.5, 'sawtooth', 0.07, 80); }

  function showToast(text) {
    toastMsg.textContent = text;
    toastMsg.classList.remove('hidden');
    setTimeout(function () { toastMsg.classList.add('hidden'); }, 1600);
  }

  const POWER_LABEL = {
    rapid: '极速射击',
    spread: '散射',
    shield: '护盾充能',
    heal: '修复',
    freeze: '时间冻结',
    pierce: '穿透弹'
  };
  // ---------- 颜色与绘制 ----------
  const CLS_COLORS = {
    fodder: '#7f9bb3',
    rusher: '#e0554f',
    tank: '#e0b45c',
    splitter: '#b07fd0',
    swarm: '#5ad0d0',
    healer: '#7fce7f',
    shard: '#b8c4d0',
    boss: '#ff6b60'
  };
  const CLS_GLYPH = {
    fodder: 'T', rusher: 'EXE', tank: 'PDF', splitter: 'ZIP',
    swarm: 'SYS', healer: 'IMG', shard: 's', boss: 'BOSS'
  };

  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 220;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: color,
        r: 1.5 + Math.random() * 2.5
      });
    }
  }

  function drawBackground() {
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    // 桌面网格
    ctx.strokeStyle = 'rgba(80,110,140,0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= ARENA.w; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); ctx.stroke();
    }
    for (let y = 0; y <= ARENA.h; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); ctx.stroke();
    }
    // 边界
    ctx.strokeStyle = 'rgba(74,163,223,0.25)';
    ctx.strokeRect(0, 0, ARENA.w, ARENA.h);
    // 中央图标（你的"桌面"）
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#4aa3df';
    ctx.font = '120px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▣', ARENA.w / 2, ARENA.h / 2);
    ctx.restore();
    ctx.restore();
  }

  function drawPlayer() {
    const p = engine.player;
    if (!p.alive) return;
    ctx.save();
    ctx.translate(offsetX + p.x * scale, offsetY + p.y * scale);
    const r = p.radius * scale;
    // 护盾光圈
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(74,163,223,' + (0.3 + p.shield / 100) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) ctx.globalAlpha = 0.4;
    // 文件夹
    ctx.fillStyle = '#e0b45c';
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.5);
    ctx.lineTo(-r * 0.5, -r * 0.9);
    ctx.lineTo(r * 0.3, -r * 0.9);
    ctx.lineTo(r * 0.5, -r * 0.5);
    ctx.lineTo(r, -r * 0.5);
    ctx.lineTo(r, r * 0.7);
    ctx.lineTo(-r, r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c99a44';
    ctx.fillRect(-r * 0.85, -r * 0.35, r * 1.7, r * 0.6);
    // 名字
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold ' + Math.max(9, r * 0.6) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('你', 0, r * 0.55);
    ctx.restore();
  }

  function drawEnemies() {
    for (const e of engine.enemies) {
      ctx.save();
      ctx.translate(offsetX + e.x * scale, offsetY + e.y * scale);
      const r = e.radius * scale;
      const col = CLS_COLORS[e.cls] || '#7f9bb3';
      // 血条
      const bw = Math.max(22, r * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-bw / 2, -r - 10, bw, 4);
      ctx.fillStyle = e.hp > e.maxHp * 0.5 ? '#7fce7f' : (e.hp > e.maxHp * 0.25 ? '#e0b45c' : '#e0554f');
      ctx.fillRect(-bw / 2, -r - 10, bw * Math.max(0, e.hp / e.maxHp), 4);
      // 主体
      if (e.hitFlash > 0) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = col;
      }
      ctx.globalAlpha = e.cls === 'boss' ? 1 : 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 图标文字
      ctx.fillStyle = e.hitFlash > 0 ? '#000' : 'rgba(0,0,0,0.55)';
      ctx.font = 'bold ' + Math.max(7, r * 0.55) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CLS_GLYPH[e.cls] || '?', 0, 1);
      // 名字
      ctx.fillStyle = '#c8d4e2';
      ctx.font = Math.max(8, r * 0.4) + 'px monospace';
      ctx.fillText(shortName(e.name), 0, r + 12);
      ctx.restore();
    }
  }

  function shortName(n) {
    const s = String(n);
    return s.length > 14 ? s.slice(0, 13) + '…' : s;
  }

  function drawBullets() {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    for (const b of engine.bullets) {
      ctx.fillStyle = '#9be0ff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pr of engine.bossProjectiles) {
      ctx.fillStyle = '#ff6b60';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pu of engine.powerups) {
      const col = pu.kind === 'heal' ? '#7fce7f' : pu.kind === 'shield' ? '#4aa3df' : '#e0b45c';
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.rotate(Math.sin(engine.time * 4 + pu.x) * 0.3);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  function updateHud() {
    const st = engine.getState();
    hpBar.style.width = Math.max(0, st.player.hp / st.player.maxHp * 100) + '%';
    shieldBar.style.width = Math.max(0, st.player.shield / st.player.maxShield * 100) + '%';
    waveNumEl.textContent = st.wave;
    waveTag.textContent = st.endless ? '· 无尽' : '· ' + (st.wavesCleared < 20 ? (20 - st.wavesCleared) + ' 波剩余' : '');
    scoreEl.textContent = st.score;
    comboEl.textContent = 'x' + st.combo;
    killsEl.textContent = st.kills;
    if (st.boss) {
      bossBar.classList.remove('hidden');
      bossName.textContent = '☠ ' + st.boss.name + ' ☠';
      bossHp.style.width = Math.max(0, st.boss.hp / st.boss.maxHp * 100) + '%';
    } else {
      bossBar.classList.add('hidden');
    }
  }

  // ---------- 引擎事件 → 表现 ----------
  function wireEvents() {
    engine.onEvent = function (ev) {
      if (ev.type === 'shoot') { if (ev.vol) sfxShoot(); }
      else if (ev.type === 'kill') {
        sfxHit();
        const e = engine.enemies.find(function () { return false; });
        spawnBurst(ev.x || 0, ev.y || 0, CLS_COLORS[ev.cls] || '#fff', 6);
      }
      else if (ev.type === 'bossDefeated') { sfxBossDown(); showToast('BOSS 已击破！'); }
      else if (ev.type === 'waveStart') {
        sfxWave();
        bannerTitle.textContent = '第 ' + ev.num + ' 波' + (ev.boss ? ' · BOSS' : '');
        bannerSub.textContent = ev.boss ? ('BOSS：' + (ev.bossName || '???') + ' —— 你的桌面上最大的家伙') : (themeName(ev.theme) + ' 来袭');
        waveBanner.classList.remove('hidden');
        bannerTimer = ev.boss ? 3.2 : 2.0;
      }
      else if (ev.type === 'waveClear') {
        showToast('第 ' + ev.num + ' 波清除 · +' + ev.bonus + ' 分');
      }
      else if (ev.type === 'playerHit') {
        spawnBurst(engine.player.x, engine.player.y, '#e0554f', 8);
      }
      else if (ev.type === 'powerup') {
        sfxPower();
        showToast(POWER_LABEL[ev.kind] + '！');
      }
      else if (ev.type === 'gameOver') {
        sfxOver();
        goStats.textContent = '得分 ' + ev.score + ' · 坚持到第 ' + ev.waves + ' 波 · 击杀 ' + ev.kills + ' 个文件病毒';
        gameOverScreen.classList.remove('hidden');
      }
    };
    // kill 事件需要坐标 → 覆写：记录最近击杀位置
    const origDamage = engine.damageEnemy.bind(engine);
    engine.damageEnemy = function (e, dmg) {
      origDamage(e, dmg);
      if (e.hp <= 0) {
        spawnBurst(e.x, e.y, CLS_COLORS[e.cls] || '#fff', 10);
        if (e.cls === 'boss') sfxBossDown(); else sfxExplode();
      }
    };
  }

  function themeName(t) {
    const map = {
      downloads: '下载目录病毒',
      documents: '文档军团',
      pictures: '图片病毒',
      processes: '系统进程叛变',
      mixed: '混合入侵',
      system: '系统核心威胁'
    };
    return map[t] || t;
  }

  // ---------- 主循环 ----------
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (!engine) return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
    lastTime = now;
    if (started && !engine.gameOver) {
      engine.tick(dt, buildInput());
      updateParticles(dt);
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) waveBanner.classList.add('hidden');
      }
      updateHud();
    }
    drawBackground();
    drawParticles();
    drawBullets();
    drawEnemies();
    drawPlayer();
  }

  // ---------- 启动流程 ----------
  async function loadGame() {
    try {
      const r = await fetch('/api/waves');
      const data = await r.json();
      wavesData = data.waves;
      scanData = data.scanData;
      scanSummary = data.scan;
      const top = scanSummary.topDirs.slice(0, 3).map(function (d) { return d.dir + ' (' + d.count + ')'; }).join('、');
      const largest = scanSummary.largest ? scanSummary.largest.name + '（' + fmtSize(scanSummary.largest.size) + '）' : '（没有）';
      const bossPreview = wavesData.filter(function (w) { return w.boss; }).map(function (w) { return w.bossName; }).join(' / ');
      scanInfo.innerHTML = '';
      const lines = [
        '本机已扫描到 <b>' + scanSummary.total + '</b> 个真实文件与 <b>' + scanSummary.processes + '</b> 个系统进程',
        '入侵主力来自：' + top,
        '你的桌面上最大的家伙：<b>' + largest + '</b> —— 它将是 20 波里的最终 BOSS',
        'BOSS 预览：' + bossPreview
      ];
      for (const l of lines) {
        const div = document.createElement('div');
        div.innerHTML = l;
        scanInfo.appendChild(div);
      }
    } catch (e) {
      scanInfo.textContent = '扫描失败：' + e.message;
    }
  }

  function fmtSize(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }

  function startGame() {
    ensureAudio();
    engine = new DS_ENGINE.GameEngine({
      seed: 20810719,
      waves: wavesData,
      endlessWaveGen: function (round) {
        return DS_WAVES.generateEndlessWave(scanData, round, { seed: 20810719 });
      }
    });
    wireEvents();
    started = true;
    titleScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    particles = [];
    lastTime = 0;
    updateHud();
  }

  startBtn.addEventListener('click', startGame);
  retryBtn.addEventListener('click', function () {
    startGame();
  });

  loadGame();
  resize();
  requestAnimationFrame(function (t) { lastTime = t; loop(t); });
})();
