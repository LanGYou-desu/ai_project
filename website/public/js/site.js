/* LanGYou Archive — homepage */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  works: [],
  posts: [],
  categories: [],
  meta: null,
  filter: 'all',
  query: '',
  active: null,
  lastFocus: null,
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const cnNum = (n) => {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  if (n < 100) return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
  return String(n);
};
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

function safeUrl(url) {
  const value = String(url || '');
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('https://play.langyousaikyo.top/')) return value;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(value)) return value;
  return '';
}

function artMeta(work) {
  const map = {
    code: { mark: '{ }', cls: 'art-code' },
    terminal: { mark: '$_', cls: 'art-terminal' },
    ghost: { mark: '◐', cls: 'art-ghost' },
    signal: { mark: '~', cls: 'art-signal' },
    grid: { mark: '///', cls: 'art-grid' },
    manuscript: { mark: 'Aa', cls: 'art-manuscript' },
  };
  const catMark = { webgames: '▶', three: '◇', desktop: '▣', apps: '⌘', tools: '⌁', art: '✳' };
  return map[work.art] || { mark: catMark[work.category] || '✦', cls: 'art-plate' };
}

function mediaHTML(work, opts = {}) {
  const loading = opts.eager ? 'eager' : 'lazy';
  if (work.cover) {
    return '<img src="' + esc(work.cover) + '" alt="' + esc(work.title + ' 封面') + '" loading="' + loading + '" decoding="async" data-fallback="' + esc(work.id) + '" />';
  }
  const art = artMeta(work);
  return '<div class="card-art ' + art.cls + '">' +
    '<div class="art-lines"></div>' +
    '<span class="art-no">' + pad(work.order || 0) + '</span>' +
    '<span class="art-mark">' + esc(art.mark) + '</span>' +
    '<span class="art-label">' + esc(work.categoryName || 'ARCHIVE') + '</span>' +
    '</div>';
}

function cardHTML(work, index) {
  const order = work.order || index + 1;
  const tags = (work.tags || []).slice(0, 3).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');
  return '<article class="work-card reveal" data-id="' + esc(work.id) + '" tabindex="0" role="button" aria-label="查看作品：' + esc(work.title) + '">' +
    '<div class="card-media">' +
      mediaHTML(work) +
      '<div class="card-topline"><span class="card-no">' + (work.builtin ? 'NO. ' + pad(order) : 'NEW') + '</span><span class="card-cat">' + esc(work.categoryName) + '</span></div>' +
    '</div>' +
    '<div class="card-info"><div><h3 class="card-title">' + esc(work.title) + '</h3><div class="card-sub">' + esc(work.subtitle || '') + '</div></div><span class="card-arrow" aria-hidden="true">↗</span></div>' +
    '<p class="card-desc">' + esc(work.tagline || work.description || '') + '</p>' +
    '<div class="card-tags">' + tags + '</div>' +
  '</article>';
}

function renderFeatured() {
  const grid = $('#featuredGrid');
  const featured = state.works.filter((w) => w.featured).slice(0, 3);
  if (featured.length < 3) {
    for (const w of state.works) {
      if (featured.length >= 3) break;
      if (!featured.some((x) => x.id === w.id)) featured.push(w);
    }
  }
  grid.innerHTML = featured.map((w, i) => {
    const order = w.order || i + 1;
    return '<article class="feature-card" data-id="' + esc(w.id) + '" tabindex="0" role="button" aria-label="查看作品：' + esc(w.title) + '">' +
      mediaHTML(w, { eager: i === 0 }) +
      '<div class="feature-overlay">' +
        '<div class="feature-top"><span class="feature-no">NO. ' + pad(order) + ' / ' + (w.builtin ? 'ARCHIVE' : 'NEW') + '</span><span class="feature-cat">' + esc(w.categoryName) + '</span></div>' +
        '<div class="feature-info"><div><h3 class="feature-title">' + esc(w.title) + '</h3><div class="feature-sub">' + esc(w.subtitle || '') + '</div></div><span class="feature-arrow" aria-hidden="true">↗</span></div>' +
      '</div>' +
    '</article>';
  }).join('');
  hydrateImages(grid);
}

function counts() {
  const map = { all: state.works.length };
  for (const c of state.categories) map[c.id] = 0;
  for (const w of state.works) map[w.category] = (map[w.category] || 0) + 1;
  return map;
}

function renderFilters() {
  const box = $('#filters');
  const map = counts();
  const all = '<button class="filter-chip' + (state.filter === 'all' ? ' is-active' : '') + '" data-filter="all" type="button">ALL <small>' + map.all + '</small></button>';
  const rest = state.categories.map((c) => {
    const n = map[c.id] || 0;
    if (!n) return '';
    return '<button class="filter-chip' + (state.filter === c.id ? ' is-active' : '') + '" data-filter="' + c.id + '" type="button">' + esc(c.name) + ' <small>' + n + '</small></button>';
  }).join('');
  box.innerHTML = all + rest;
}

function match(work) {
  if (state.filter !== 'all' && work.category !== state.filter) return false;
  if (!state.query) return true;
  const hay = [work.title, work.subtitle, work.tagline, work.description, work.categoryName, work.categoryCn, ...(work.tags || []), ...(work.tech || [])].join(' ').toLowerCase();
  return hay.includes(state.query.toLowerCase());
}

function renderGrid() {
  const grid = $('#grid');
  const list = state.works.filter(match);
  $('#worksCount').textContent = String(state.works.length);
  grid.innerHTML = list.map((w, i) => cardHTML(w, i)).join('');
  $('#empty').hidden = list.length > 0;
  grid.style.display = list.length ? '' : 'none';
  hydrateImages(grid);
  const io = revealObserver();
  $$('.work-card', grid).forEach((el, i) => {
    el.style.transitionDelay = Math.min(i % 6, 5) * 45 + 'ms';
    io.observe(el);
  });
}

let observer;
function revealObserver() {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
  }
  return observer;
}

function hydrateImages(root) {
  $$('img[data-fallback]', root).forEach((img) => {
    img.addEventListener('error', () => {
      const work = state.works.find((w) => w.id === img.dataset.fallback);
      if (!work) return;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = mediaHTML({ ...work, cover: null });
      img.replaceWith(wrapper.firstElementChild);
    }, { once: true });
  });
}

function setFilter(id) {
  state.filter = id;
  renderFilters();
  renderGrid();
}
function setQuery(q) {
  state.query = q.trim();
  renderGrid();
}

function journalDate(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)).replace(/\//g, '.');
  } catch { return String(value || '').slice(0, 10); }
}

function renderJournal() {
  const grid = $('#journalGrid');
  if (!grid) return;
  const posts = state.posts.slice(0, 6);
  if (!posts.length) {
    grid.innerHTML = '<div class="journal-empty">还没有公开手记。站主登录工作室后可以发布第一条。</div>';
    return;
  }
  grid.innerHTML = posts.map((p, i) => {
    const tags = (p.tags || []).slice(0, 3).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');
    return '<article class="journal-card" data-post-id="' + esc(p.id) + '" tabindex="0" role="button" aria-label="阅读手记：' + esc(p.title) + '">' +
      '<div class="journal-date"><span>' + journalDate(p.createdAt) + '</span><span>' + (p.pinned ? 'PINNED' : 'NO. ' + pad(i + 1)) + '</span></div>' +
      '<h3 class="journal-title">' + esc(p.title) + '</h3>' +
      '<p class="journal-excerpt">' + esc(String(p.body || '').replace(/\s+/g, ' ').slice(0, 160)) + '</p>' +
      '<div class="journal-tags">' + tags + '</div>' +
      '<span class="journal-read">READ ↗</span>' +
    '</article>';
  }).join('');
}

function openPost(id, push = true) {
  const post = state.posts.find((p) => p.id === id);
  if (!post) return;
  state.lastFocus = document.activeElement;
  $('#postDate').textContent = journalDate(post.createdAt) + ' / ' + (post.pinned ? 'PINNED' : 'JOURNAL');
  $('#postTitle').textContent = post.title;
  $('#postTags').innerHTML = (post.tags || []).map((t) => '<span class="tag dark">' + esc(t) + '</span>').join('');
  $('#postBody').textContent = post.body || '';
  $('#postModal').classList.add('is-open');
  $('#postModal').setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  $('#postClose').focus({ preventScroll: true });
  if (push) history.pushState({ post: id }, '', '#journal/' + encodeURIComponent(id));
}

function closePost(removeHash = true) {
  const modal = $('#postModal');
  if (!modal.classList.contains('is-open')) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (removeHash && location.hash.startsWith('#journal/')) history.replaceState({}, '', location.pathname + location.search);
  if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus({ preventScroll: true });
}

function applySession(session) {
  const link = document.querySelector('.nav-studio');
  if (!link) return;
  if (session?.authenticated && session.user?.role === 'owner') {
    link.innerHTML = '工作室 <span>STUDIO ↗</span>';
    link.setAttribute('href', '/studio?t=' + Date.now());
  } else if (session?.authenticated && session.user?.role === 'guest') {
    link.innerHTML = '游客 <span>GUEST</span>';
    link.setAttribute('href', '/login?v=20261110-3');
  } else {
    link.innerHTML = '登录 <span>LOGIN ↗</span>';
    link.setAttribute('href', '/login?v=20261110-3');
  }
}

function openModal(id, push = true) {
  const work = state.works.find((w) => w.id === id);
  if (!work) return;
  state.active = work;
  state.lastFocus = document.activeElement;

  $('#modalEyebrow').textContent = (work.builtin ? 'ARCHIVE NO. ' + pad(work.order || 0) : 'NEW UPLOAD') + ' / ' + (work.categoryName || '') + ' / ' + (work.year || '2026');
  $('#modalTitle').textContent = work.title;
  $('#modalSub').textContent = work.subtitle || '';
  $('#modalDesc').textContent = work.description || work.tagline || '';
  const media = $('#modalMedia');
  media.innerHTML = mediaHTML(work, { eager: true });
  hydrateImages(media);

  const meta = [];
  meta.push(['YEAR', work.year || '2026']);
  meta.push(['CATEGORY', work.categoryCn || work.categoryName || '—']);
  meta.push(['TESTS', work.tests ? fmt(work.tests) : '—']);
  if (work.duration) meta.push(['DURATION', work.duration]);
  if (work.kind) meta.push(['FORMAT', work.kind === 'web' ? 'BROWSER' : work.kind === 'image' ? 'IMAGE' : 'DOWNLOAD']);
  $('#modalMeta').innerHTML = meta.slice(0, 3).map(([k, v]) => '<div><span>' + esc(k) + '</span><strong>' + esc(v) + '</strong></div>').join('');

  const tags = [...(work.tags || []), ...(work.tech || [])];
  $('#modalTags').innerHTML = tags.map((t) => '<span class="tag dark">' + esc(t) + '</span>').join('');

  const actions = [];
  if (safeUrl(work.demoUrl)) {
    actions.push('<a class="btn-primary" href="' + esc(safeUrl(work.demoUrl)) + '" target="_blank" rel="noopener">在线游玩 <span>↗</span></a>');
  }
  const downloads = Array.isArray(work.downloads) ? work.downloads.filter((d) => safeUrl(d.url)) : [];
  for (const d of downloads) {
    const cls = actions.length ? 'btn-secondary' : 'btn-primary';
    const label = d.label || '下载作品';
    const size = d.size ? ' · ' + d.size : '';
    actions.push('<a class="' + cls + '" href="' + esc(safeUrl(d.url)) + '" download>' + esc(label) + size + ' <span>↓</span></a>');
  }
  if (!actions.length) actions.push('<span class="btn-secondary">档案条目 · 暂无下载 <span>∅</span></span>');
  $('#modalActions').innerHTML = actions.join('');
  $('#modalKind').textContent = work.builtin ? 'FROM THE PERSONAL ARCHIVE' : 'UPLOADED TO THE STUDIO';
  $('#copyLink').dataset.id = work.id;

  const modal = $('#modal');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  $('#modalClose').focus({ preventScroll: true });
  if (push) history.pushState({ work: id }, '', '#work/' + encodeURIComponent(id));
}

function closeModal(removeHash = true) {
  const modal = $('#modal');
  if (!modal.classList.contains('is-open')) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (removeHash && location.hash.startsWith('#work/')) history.replaceState({}, '', location.pathname + location.search);
  state.active = null;
  if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus({ preventScroll: true });
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('is-show'), 2200);
}

function randomWork() {
  const pool = state.works.filter(match);
  const list = pool.length ? pool : state.works;
  if (!list.length) return;
  const pick = list[Math.floor(Math.random() * list.length)];
  openModal(pick.id);
}

function initClock() {
  const el = $('#clock');
  const tick = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
      el.textContent = 'CST ' + parts;
    } catch { el.textContent = 'CST --:--:--'; }
  };
  tick();
  setInterval(tick, 1000);
}

function initHeader() {
  const head = $('#masthead');
  const onScroll = () => head.classList.toggle('is-solid', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = $('#menuToggle');
  const menu = $('#mobileMenu');
  const close = () => { menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', menu).forEach((a) => a.addEventListener('click', close));
}

function initCursor() {
  if (!matchMedia('(pointer: fine)').matches) return;
  const cursor = $('#cursor');
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  let visible = false;
  const render = () => {
    x += (tx - x) * 0.18;
    y += (ty - y) * 0.18;
    cursor.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
    requestAnimationFrame(render);
  };
  render();
  addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!visible) { cursor.classList.add('is-visible'); visible = true; }
  }, { passive: true });
  document.addEventListener('mouseleave', () => { cursor.classList.remove('is-visible'); visible = false; });
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.work-card, .feature-card, .studio-card, a, button');
    cursor.classList.toggle('is-hover', Boolean(target));
  });
}

function initMagnet() {
  if (!matchMedia('(pointer: fine)').matches) return;
  $$('.magnet').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = 'translate(' + dx * 7 + 'px,' + dy * 7 + 'px) rotate(' + (-4 + dx * 2) + 'deg)';
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

function initOrbit() {
  const canvas = $('#orbit');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  const N = 86;
  const points = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = i * 2.399963229728653;
    points.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r, red: i % 17 === 0 });
  }
  const pairs = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = points[i].x - points[j].x, dy = points[i].y - points[j].y, dz = points[i].z - points[j].z;
      if (dx * dx + dy * dy + dz * dz < 0.16) pairs.push([i, j]);
    }
  }
  let mx = 0, my = 0, rx = 0.2, ry = 0;
  addEventListener('mousemove', (e) => { mx = (e.clientX / innerWidth - 0.5); my = (e.clientY / innerHeight - 0.5); }, { passive: true });
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  let start = performance.now();
  const draw = (now) => {
    const t = (now - start) / 1000;
    rx += (0.15 + my * 0.35 - rx) * 0.02;
    ry += (t * 0.06 + mx * 0.5 - ry) * 0.02;
    ctx.clearRect(0, 0, w, h);
    const cx = w * (w > 900 ? 0.73 : 0.55);
    const cy = h * 0.45;
    const scale = Math.min(w, h) * (w > 900 ? 0.33 : 0.28);
    const cosX = Math.cos(rx), sinX = Math.sin(rx), cosY = Math.cos(ry), sinY = Math.sin(ry);
    const projected = points.map((p) => {
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y1 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const persp = 1 / (1.45 - z2 * 0.34);
      return { x: cx + x1 * scale * persp, y: cy + y1 * scale * persp, z: z2, persp };
    });
    ctx.lineWidth = 0.7;
    for (const [i, j] of pairs) {
      const a = projected[i], b = projected[j];
      const alpha = 0.035 + Math.max(0, (a.z + b.z) / 2 + 1) * 0.035;
      ctx.strokeStyle = 'rgba(241,236,226,' + alpha.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      const r = (points[i].red ? 1.9 : 1.05) * p.persp;
      ctx.fillStyle = points[i].red ? 'rgba(255,74,28,0.9)' : 'rgba(241,236,226,' + (0.22 + p.persp * 0.25).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(241,236,226,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, scale * 1.02, scale * 0.28, -0.22, 0, Math.PI * 2); ctx.stroke();
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start = performance.now(); });
}

async function boot() {
  initClock();
  initHeader();
  initCursor();
  initMagnet();
  initOrbit();

  try {
    const res = await fetch('/api/works', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.works = Array.isArray(data.works) ? data.works : [];
    state.categories = Array.isArray(data.categories) ? data.categories : [];
    state.meta = data.meta || {};
  } catch (err) {
    console.warn('works load failed', err);
    state.works = [];
    state.categories = [];
  }

  try {
    const res = await fetch('/api/posts', { headers: { accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      state.posts = Array.isArray(data.posts) ? data.posts : [];
    }
  } catch {}

  try {
    const res = await fetch('/api/session', { headers: { accept: 'application/json' } });
    if (res.ok) applySession(await res.json());
  } catch {}

  if (state.works.length) {
    const n = state.works.length;
    $('#heroCount').textContent = cnNum(n);
    $('#worksCount').textContent = String(n);
    const firstStat = $('#aboutStats .stat strong');
    if (firstStat) firstStat.textContent = pad(n);
    const assertionEl = $$('#aboutStats .stat strong')[2];
    if (assertionEl) assertionEl.textContent = fmt(state.works.reduce((s, w) => s + (Number(w.tests) || 0), 0));
  }

  renderFeatured();
  renderFilters();
  renderGrid();
  renderJournal();

  $('#filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (btn) setFilter(btn.dataset.filter);
  });
  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setQuery(e.target.value), 120);
  });
  $('#clearFilters').addEventListener('click', () => {
    $('#search').value = '';
    setQuery('');
    setFilter('all');
  });
  $('#surpriseBtn').addEventListener('click', randomWork);
  $('#surpriseHero').addEventListener('click', randomWork);

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.work-card[data-id], .feature-card[data-id]');
    if (card && !e.target.closest('a')) openModal(card.dataset.id);
    const postCard = e.target.closest('.journal-card[data-post-id]');
    if (postCard) openPost(postCard.dataset.postId);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault(); $('#search').focus();
    }
    if (e.key === 'Escape') { closeModal(); closePost(); }
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches('.work-card, .feature-card')) {
      e.preventDefault(); openModal(document.activeElement.dataset.id);
    }
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches('.journal-card[data-post-id]')) {
      e.preventDefault(); openPost(document.activeElement.dataset.postId);
    }
    if (e.key === 'Tab' && $('#modal').classList.contains('is-open')) {
      const focusable = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', $('#modal')).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  $('#modalClose').addEventListener('click', () => closeModal());
  $$('[data-close]').forEach((el) => el.addEventListener('click', () => closeModal()));
  $('#postClose').addEventListener('click', () => closePost());
  $$('[data-post-close]').forEach((el) => el.addEventListener('click', () => closePost()));
  $('#copyLink').addEventListener('click', async () => {
    const id = $('#copyLink').dataset.id;
    const url = location.origin + '/#work/' + encodeURIComponent(id);
    try { await navigator.clipboard.writeText(url); toast('作品链接已复制'); }
    catch { toast('复制失败，请手动复制地址栏'); }
  });

  addEventListener('popstate', () => {
    if (location.hash.startsWith('#work/')) {
      const id = decodeURIComponent(location.hash.slice(6));
      if (state.works.some((w) => w.id === id)) openModal(id, false);
    } else if (location.hash.startsWith('#journal/')) {
      const id = decodeURIComponent(location.hash.slice(9));
      if (state.posts.some((p) => p.id === id)) openPost(id, false);
    } else { closeModal(false); closePost(false); }
  });

  if (location.hash.startsWith('#work/')) {
    const id = decodeURIComponent(location.hash.slice(6));
    if (state.works.some((w) => w.id === id)) setTimeout(() => openModal(id, false), 350);
  } else if (location.hash.startsWith('#journal/')) {
    const id = decodeURIComponent(location.hash.slice(9));
    if (state.posts.some((p) => p.id === id)) setTimeout(() => openPost(id, false), 350);
  }

  $$('.reveal').forEach((el) => revealObserver().observe(el));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();