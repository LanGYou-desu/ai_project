'use strict';
/* LOOM · 织机俯视动画：开口 → 投梭 → 打纬 → 下一纬 */
(function (root) {
  'use strict';
  var F = (typeof require !== 'undefined') ? require('./fabric.js') : root.Loom.fabric;
  var Y = (typeof require !== 'undefined') ? require('./shared/yarn.js') : root.Loom.yarn;

  var PHASE = { SHED: 0.34, FLY: 0.40, BEAT: 0.26 };

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var state = {
      matrix: null, warpColor: '#c8623c', weftColor: '#2f4f63',
      pick: 0, t: 0, playing: false, speed: 1, woven: 0,
      onPick: opts.onPick || null, onSound: opts.onSound || null,
      shuttleDir: 1, lastPhase: -1
    };

    function setMatrix(m, warp, weft) {
      state.matrix = m; state.warpColor = warp || state.warpColor; state.weftColor = weft || state.weftColor;
      state.pick = 0; state.t = 0; state.woven = 0; state.shuttleDir = 1; state.lastPhase = -1;
    }

    function tick(dt) {
      if (!state.matrix || !state.playing) return;
      var H = state.matrix.length;
      state.t += dt * state.speed * 1.6;
      if (state.t >= 1) {
        state.t -= 1;
        state.woven = Math.min(H, state.woven + 1);
        state.pick = (state.pick + 1) % Math.max(1, H);
        state.shuttleDir = -state.shuttleDir;
        state.lastPhase = -1;
        if (state.woven >= H && state.pick === 0) { state.playing = false; }
        if (state.onPick) state.onPick(state.pick, state.woven);
      }
      /* 阶段音效 */
      var ph = state.t < PHASE.SHED ? 0 : (state.t < PHASE.SHED + PHASE.FLY ? 1 : 2);
      if (ph !== state.lastPhase) {
        state.lastPhase = ph;
        if (state.onSound) state.onSound(ph === 0 ? 'shed' : (ph === 1 ? 'fly' : 'beat'));
      }
    }

    /* w / h 传 CSS 像素尺寸（画布可能被 devicePixelRatio 放大过） */
    function draw(w, h) {
      var dpr = (root.devicePixelRatio || 1);
      var W = w || canvas.width / dpr, H = h || canvas.height / dpr;
      ctx.clearRect(0, 0, W, H);
      /* 背景：织坊 */
      var bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#171310');
      bg.addColorStop(1, '#0e0b09');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      if (!state.matrix || !state.matrix.length) {
        ctx.fillStyle = 'rgba(232,220,196,0.35)';
        ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
        ctx.fillText('还没有可织的布', 16, H / 2);
        return;
      }

      var m = state.matrix, mw = m[0].length, mh = m.length;
      var pad = 26;
      var fieldW = W - pad * 2;
      var topBeamY = 16;
      var shedY = H * 0.44;
      var reedY = H * 0.66;
      var fellY = H * 0.74;

      /* 经轴 */
      ctx.fillStyle = '#2a211a';
      ctx.fillRect(pad - 10, topBeamY - 10, fieldW + 20, 10);
      ctx.fillStyle = 'rgba(200,162,74,0.35)';
      ctx.fillRect(pad - 10, topBeamY - 10, fieldW + 20, 2);

      /* 每根经线：顶部 -> 综眼 -> 织口 */
      var n = Math.min(mw, Math.max(8, Math.floor(fieldW / 4)));
      var shedGap = Math.min(26, fieldW / n * 1.6);
      var t = state.t;
      var openAmt = t < PHASE.SHED ? t / PHASE.SHED : 1;
      var curRow = m[Math.min(state.pick, mh - 1)];
      for (var i = 0; i < n; i++) {
        var e = Math.floor(i * mw / n);
        var x = pad + (i + 0.5) * (fieldW / n);
        var up = curRow[e] ? 1 : -1;
        var lift = up * shedGap * openAmt * 0.5;
        ctx.strokeStyle = state.warpColor;
        ctx.globalAlpha = 0.55 + 0.35 * (i % 2);
        ctx.lineWidth = Math.max(1, fieldW / n * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, topBeamY);
        ctx.quadraticCurveTo(x + lift * 0.5, shedY * 0.6, x + lift, shedY);
        ctx.lineTo(x, fellY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* 梭子 */
      var fly = (t - PHASE.SHED) / PHASE.FLY;
      if (fly >= 0 && fly <= 1) {
        var sx = state.shuttleDir > 0 ? pad + fly * fieldW : pad + (1 - fly) * fieldW;
        drawShuttle(ctx, sx, shedY, state.weftColor, state.shuttleDir);
      } else {
        var sx2 = state.shuttleDir > 0 ? pad : pad + fieldW;
        drawShuttle(ctx, sx2, shedY, state.weftColor, state.shuttleDir);
      }

      /* 筘（打纬） */
      var beat = t > PHASE.SHED + PHASE.FLY ? (t - PHASE.SHED - PHASE.FLY) / PHASE.BEAT : 0;
      var reedOffset = beat < 0.5 ? beat * 2 * 14 : (1 - beat) * 2 * 14;
      var ry = reedY + reedOffset;
      ctx.strokeStyle = '#4a3a28';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(pad - 6, ry); ctx.lineTo(pad + fieldW + 6, ry); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,162,74,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var k = 0; k <= 60; k++) {
        var kx = pad - 6 + k * (fieldW + 12) / 60;
        ctx.moveTo(kx, ry - 7); ctx.lineTo(kx, ry + 7);
      }
      ctx.stroke();

      /* 已织出的布 */
      var woven = Math.max(0, state.woven);
      if (woven > 0) {
        var clothH = H - fellY - 14;
        var rows = Math.min(woven, Math.max(1, Math.floor(clothH / Math.max(2, (fieldW / mw)))));
        var cs = Math.min(fieldW / mw, clothH / rows);
        var start = woven - rows;
        var sub = [];
        for (var r = 0; r < rows; r++) sub.push(m[start + r]);
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad, fellY, fieldW, clothH);
        ctx.clip();
        F.draw(ctx, {
          matrix: sub, warpColor: state.warpColor, weftColor: state.weftColor,
          cellSize: cs, ox: pad + (fieldW - mw * cs) / 2, oy: fellY,
          mode: 'real', crisp: cs < 4
        });
        ctx.restore();
        /* 织口高光 */
        ctx.strokeStyle = 'rgba(255,220,150,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(pad, fellY); ctx.lineTo(pad + fieldW, fellY); ctx.stroke();
      }

      /* 读数 */
      ctx.fillStyle = 'rgba(232,220,196,0.72)';
      ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillText('第 ' + (state.pick + 1) + ' / ' + mh + ' 纬   已织 ' + state.woven + ' 纬', pad, 12);
      var phName = t < PHASE.SHED ? '开口' : (t < PHASE.SHED + PHASE.FLY ? '投梭' : '打纬');
      ctx.fillStyle = 'rgba(200,162,74,0.9)';
      /* 放在读数右边，避开右上角的播放控制条 */
      ctx.fillText('· ' + phName, pad + 168, 12);
    }

    function drawShuttle(ctx, x, y, color, dir) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(dir > 0 ? 0 : Math.PI);
      ctx.fillStyle = '#6b4a2c';
      ctx.beginPath();
      ctx.moveTo(-16, -5); ctx.lineTo(10, -5); ctx.quadraticCurveTo(19, 0, 10, 5); ctx.lineTo(-16, 5);
      ctx.quadraticCurveTo(-22, 0, -16, -5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,160,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    return {
      setMatrix: setMatrix, tick: tick, draw: draw,
      play: function () { state.playing = true; },
      pause: function () { state.playing = false; },
      reset: function () { state.pick = 0; state.t = 0; state.woven = 0; state.lastPhase = -1; },
      setSpeed: function (s) { state.speed = s; },
      isPlaying: function () { return state.playing; },
      getPick: function () { return state.pick; },
      getWoven: function () { return state.woven; },
      state: state
    };
  }

  var api = { create: create, PHASE: PHASE };
  root.Loom = root.Loom || {};
  root.Loom.loomview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
