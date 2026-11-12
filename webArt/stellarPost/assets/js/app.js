/* =========================================================
   星海邮局 · 交互脚本
   1) 全屏星场（Canvas，视差 + 鼠标引力 + 流星）
   2) 星图（每句话一颗星，悬停/点击阅读）
   3) 投递表单（fetch → 本地 Node 服务 → 新星诞生）
   无任何第三方依赖
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* =======================================================
     1. 星场
     ======================================================= */
  var canvas = document.getElementById('sky');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var vw = window.innerWidth || 1200;
  var vh = window.innerHeight || 800;
  var stars = [];
  var shooting = null;
  var nextShot = 6;
  var pointerX = -9999;
  var pointerY = -9999;
  var targetX = -9999;
  var targetY = -9999;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function buildStars() {
    var target = Math.round(Math.min(260, Math.max(80, (vw * vh) / 9500)));
    stars = [];
    for (var i = 0; i < target; i++) {
      stars.push({
        x: rand(0, vw),
        y: rand(0, vh),
        z: rand(0.25, 1),
        r: rand(0.4, 1.4),
        p: rand(0, Math.PI * 2),
        s: rand(0.5, 1.6)
      });
    }
  }

  function resizeSky() {
    if (!ctx) return;
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
  }

  function drawSky(time) {
    ctx.clearRect(0, 0, vw, vh);

    pointerX += (targetX - pointerX) * 0.08;
    pointerY += (targetY - pointerY) * 0.08;

    var offX = (pointerX - vw / 2) * 0.02;
    var offY = (pointerY - vh / 2) * 0.02;
    var drift = (window.pageYOffset || 0) * 0.05;
    var i, st, sx, sy, dx, dy, d2, d, f, tw, alpha, size;

    for (i = 0; i < stars.length; i++) {
      st = stars[i];
      sx = st.x + offX * st.z * 2;
      sy = st.y - drift * st.z + offY * st.z * 2;

      if (sy < -30) sy += vh + 60;
      if (sy > vh + 30) sy -= vh + 60;

      dx = sx - pointerX;
      dy = sy - pointerY;
      d2 = dx * dx + dy * dy;

      if (d2 < 22500 && d2 > 1) {
        d = Math.sqrt(d2);
        f = (1 - d / 150) * 22;
        sx += (dx / d) * f;
        sy += (dy / d) * f;
      }

      tw = 0.45 + 0.55 * Math.sin(time * st.s + st.p);
      alpha = (0.2 + 0.65 * tw) * (0.45 + 0.55 * st.z);
      size = st.r * (0.8 + 0.6 * st.z);

      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + Math.round(190 + 40 * tw) + ',228,255,' + alpha.toFixed(3) + ')';
      ctx.arc(sx, sy, size, 0, 6.2832);
      ctx.fill();

      if (st.z > 0.86 && tw > 0.8) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(140,190,255,' + (0.06 * tw).toFixed(3) + ')';
        ctx.arc(sx, sy, size * 5, 0, 6.2832);
        ctx.fill();
      }
    }

    /* 光标附近的星座连线 */
    if (pointerX > 0) {
      ctx.lineWidth = 1;
      for (i = 0; i < stars.length; i++) {
        st = stars[i];
        sx = st.x + offX * st.z * 2;
        sy = st.y - drift * st.z + offY * st.z * 2;
        dx = sx - pointerX;
        dy = sy - pointerY;
        d2 = dx * dx + dy * dy;
        if (d2 < 36100) {
          ctx.strokeStyle = 'rgba(110,200,255,' + ((1 - Math.sqrt(d2) / 190) * 0.22).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(pointerX, pointerY);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      }
    }

    /* 流星 */
    if (!reduceMotion) {
      if (!shooting && time > nextShot) {
        shooting = {
          x: rand(vw * 0.1, vw * 0.9),
          y: rand(-40, vh * 0.25),
          vx: rand(3.5, 6.5),
          vy: rand(1.2, 2.6),
          life: 1
        };
        nextShot = time + rand(7, 14);
      }
      if (shooting) {
        shooting.x += shooting.vx;
        shooting.y += shooting.vy;
        shooting.life -= 0.006;

        var tailX = shooting.x - shooting.vx * 14;
        var tailY = shooting.y - shooting.vy * 14;
        var g = ctx.createLinearGradient(shooting.x, shooting.y, tailX, tailY);
        g.addColorStop(0, 'rgba(255,255,255,' + Math.max(0, shooting.life).toFixed(2) + ')');
        g.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shooting.x, shooting.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        if (shooting.life <= 0 || shooting.x > vw + 120 || shooting.y > vh + 120) shooting = null;
      }
    }
  }

  function loop(t) {
    window.requestAnimationFrame(loop);
    if (document.hidden) return;
    drawSky(t / 1000);
  }

  if (ctx) {
    resizeSky();
    if (reduceMotion) {
      drawSky(1);
    } else {
      window.requestAnimationFrame(loop);
      window.addEventListener('pointermove', function (e) {
        targetX = e.clientX;
        targetY = e.clientY;
      }, { passive: true });
    }
    window.addEventListener('resize', function () {
      resizeSky();
      if (reduceMotion) drawSky(1);
    });
  }

  /* =======================================================
     2. 星图
     ======================================================= */
  var field = document.getElementById('skyfield');
  var countEls = document.querySelectorAll('[data-count]');
  var emptyEl = document.querySelector('.empty-state');
  var toastEl = document.getElementById('toast');

  /* 与服务端完全一致的 djb2 散列，保证刷新前后位置不跳 */
  function hash31(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = (h * 33 + str.charCodeAt(i)) % 2147483647;
    }
    return h;
  }

  function placeFor(id) {
    return {
      x: 5 + (hash31(id + '|x') % 900) / 10,
      y: 10 + (hash31(id + '|y') % 760) / 10
    };
  }

  function fmtDate(ts) {
    var d = new Date((ts || 0) * 1000);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }

  function setCount(n) {
    for (var i = 0; i < countEls.length; i++) countEls[i].textContent = n;
    if (emptyEl) emptyEl.hidden = n > 0;
  }

  function buildWishNode(wish) {
    var pos = placeFor(wish.id);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wish';
    btn.style.setProperty('--x', pos.x.toFixed(2) + '%');
    btn.style.setProperty('--y', pos.y.toFixed(2) + '%');
    btn.style.setProperty('--delay', (Math.random() * 3).toFixed(2) + 's');
    btn.setAttribute('aria-label', '星信：' + wish.t);

    var dot = document.createElement('span');
    dot.className = 'wish-dot';

    var card = document.createElement('span');
    card.className = 'wish-card';
    card.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.className = 'wish-text';
    text.textContent = wish.t;

    var meta = document.createElement('span');
    meta.className = 'wish-meta';
    meta.textContent = fmtDate(wish.ts);

    card.appendChild(text);
    card.appendChild(meta);
    btn.appendChild(dot);
    btn.appendChild(card);
    return btn;
  }

  /* 卡片靠近屏幕边缘时，把它推回可视区域 */
  function clampCard(btn) {
    var card = btn.querySelector('.wish-card');
    if (!card) return;
    card.style.transform = '';
    var rect = card.getBoundingClientRect();
    var pad = 12;
    var dx = 0;
    if (rect.left < pad) {
      dx = pad - rect.left;
    } else if (rect.right > window.innerWidth - pad) {
      dx = (window.innerWidth - pad) - rect.right;
    }
    if (dx) {
      card.style.transform = 'translate(calc(-50% + ' + Math.round(dx) + 'px), -10px) scale(1)';
    }
  }

  if (field) {
    field.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.wish') : null;
      if (!btn) return;
      var wasOpen = btn.classList.contains('is-open');
      var open = field.querySelectorAll('.wish.is-open');
      for (var i = 0; i < open.length; i++) open[i].classList.remove('is-open');
      if (!wasOpen) {
        btn.classList.add('is-open');
        clampCard(btn);
      }
    });

    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.wish')) return;
      var open = field.querySelectorAll('.wish.is-open');
      for (var i = 0; i < open.length; i++) open[i].classList.remove('is-open');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = field.querySelectorAll('.wish.is-open');
      for (var i = 0; i < open.length; i++) open[i].classList.remove('is-open');
    });
  }

  /* =======================================================
     3. 提示条
     ======================================================= */
  var toastTimer = null;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2600);
  }

  /* =======================================================
     4. 投递表单
     ======================================================= */
  var form = document.querySelector('.wish-form');
  var input = document.getElementById('wish-text');
  var leftEl = document.querySelector('[data-left]');
  var sendBtn = form ? form.querySelector('.send') : null;

  function charCount(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) i++;
      n++;
    }
    return n;
  }

  function updateLeft() {
    if (!input || !leftEl) return;
    leftEl.textContent = Math.max(0, 80 - charCount(input.value || ''));
  }

  if (input) {
    input.addEventListener('input', updateLeft);
    updateLeft();
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var text = (input && input.value ? input.value : '').replace(/\s+/g, ' ').trim();

      if (!text) {
        form.classList.add('shake');
        window.setTimeout(function () { form.classList.remove('shake'); }, 500);
        toast('先写一句话再投递吧');
        return;
      }
      if (charCount(text) > 80) {
        toast('最多 80 个字，压缩一下心情');
        return;
      }

      form.classList.add('is-loading');
      if (sendBtn) sendBtn.disabled = true;

      fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ text: text })
      }).then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok && data && data.ok, data: data };
        });
      }).then(function (r) {
        if (!r.ok) throw new Error((r.data && r.data.error) || '投递失败，稍后再试');

        if (field) field.insertBefore(buildWishNode(r.data.wish), field.firstChild);
        setCount(r.data.count);

        if (input) { input.value = ''; updateLeft(); input.blur(); }
        toast('星信已升空 ✦');
      }).catch(function (err) {
        toast(err && err.message ? err.message : '网络出了点问题');
      }).then(function () {
        form.classList.remove('is-loading');
        if (sendBtn) sendBtn.disabled = false;
      });
    });
  }

  /* 表单无 JS 提交后回跳（服务端 302 带回 sent/err 参数） */
  if (window.location.search.indexOf('sent=1') > -1) {
    toast('星信已升空 ✦');
  }
  if (window.location.search.indexOf('err=1') > -1) {
    toast('没投出去：检查一下字数，或者稍等几秒再试');
  }

  /* =======================================================
     5. 滚动进度 / 入场 / 光斑
     ======================================================= */
  var bar = document.querySelector('.progress i');

  function onScroll() {
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? (window.pageYOffset || 0) / max : 0;
      bar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)).toFixed(4) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            entries[i].target.classList.add('is-in');
            io.unobserve(entries[i].target);
          }
        }
      }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
      for (var k = 0; k < revealEls.length; k++) io.observe(revealEls[k]);
    } else {
      for (var j = 0; j < revealEls.length; j++) revealEls[j].classList.add('is-in');
    }
  }

  var spot = document.querySelector('.spotlight');
  if (spot && !reduceMotion && window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
    var sx = window.innerWidth / 2;
    var sy = window.innerHeight / 2;
    var tx = sx;
    var ty = sy;

    window.addEventListener('pointermove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
    }, { passive: true });

    (function follow() {
      window.requestAnimationFrame(follow);
      sx += (tx - sx) * 0.12;
      sy += (ty - sy) * 0.12;
      spot.style.transform = 'translate3d(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px,0)';
    })();
  }

  /* 初始计数（服务端已渲染，这里只做兜底同步） */
  if (field) setCount(field.querySelectorAll('.wish').length);
})();