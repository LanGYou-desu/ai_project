(function () {
'use strict';
/* LanGYou Archive — dashboard */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const fmtBytes = (n) => {
  const value = Number(n || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return (value / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + units[i];
};
const artMap = {
  code: { mark: '{ }', cls: 'art-code' },
  terminal: { mark: '$_', cls: 'art-terminal' },
  ghost: { mark: '◐', cls: 'art-ghost' },
  signal: { mark: '~', cls: 'art-signal' },
  grid: { mark: '///', cls: 'art-grid' },
  manuscript: { mark: 'Aa', cls: 'art-manuscript' },
};

const state = {
  csrf: '', user: null, role: 'user', works: [], myWorks: [], posts: [], categories: [], stats: null,
  tab: 'all', query: '', editing: null,
};
const isAdmin = () => state.role === 'admin';

async function api(path, options = {}) {
  const headers = { accept: 'application/json', ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (options.method && options.method !== 'GET') headers['x-csrf-token'] = state.csrf;
  const res = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  if (res.status === 401) { location.replace('/login?t=' + Date.now()); throw new Error('登录状态已失效'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function toast(message, ok = true) {
  const el = $('#studioToast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-ok', ok);
  el.classList.add('is-show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('is-show'), 2600);
}
function setMsg(id, text, ok = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('is-ok', Boolean(ok));
}

function artHTML(work) {
  const catMark = { webgames: '▶', three: '◇', desktop: '▣', apps: '⌘', tools: '⌁', art: '✳' };
  const art = artMap[work.art] || { mark: catMark[work.category] || '✦', cls: 'art-plate' };
  return '<div class="card-art ' + art.cls + '"><div class="art-lines"></div><span class="art-no">' + pad(work.order || 0) + '</span><span class="art-mark">' + esc(art.mark) + '</span><span class="art-label">' + esc(work.categoryName || '') + '</span></div>';
}
function coverHTML(work) {
  if (work.cover) return '<img src="' + esc(work.cover) + '" alt="" loading="lazy" />';
  return artHTML(work);
}

function renderStats() {
  const el = $('#studioStats');
  if (!el) return;
  const stats = state.stats || {};
  if (isAdmin()) {
    el.innerHTML =
      '<div><strong>' + (stats.works ?? state.works.length) + '</strong><span>作品总数</span></div>' +
      '<div><strong>' + (stats.users ?? 0) + '</strong><span>注册用户</span></div>' +
      '<div><strong>' + (stats.posts ?? state.posts.length) + '</strong><span>手记总数</span></div>' +
      '<div><strong>' + (stats.uploadBytesLabel || fmtBytes(stats.uploadBytes)) + '</strong><span>作品包体积</span></div>';
  } else {
    el.innerHTML =
      '<div><strong>' + state.posts.length + '</strong><span>我的手记</span></div>' +
      '<div><strong>' + state.myWorks.length + '</strong><span>我的投稿</span></div>' +
      '<div><strong>' + (stats.works ?? '—') + '</strong><span>可玩作品</span></div>' +
      '<div><strong>' + (stats.publicPosts ?? '—') + '</strong><span>公开手记</span></div>';
  }
  const bootNote = document.getElementById('studioBootNote');
  if (bootNote) bootNote.remove();
  const dateEl = $('#studioDate');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = 'CST ' + new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(now).replaceAll('/', '.');
  }
}

function fillCategories() {
  const options = state.categories.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.cn) + ' / ' + esc(c.name) + '</option>').join('');
  const a = $('#categorySelect'); if (a) a.innerHTML = options;
  const b = $('#editCategory'); if (b) b.innerHTML = options;
  const c = $('#subCategory'); if (c) c.innerHTML = options;
}

function renderList() {
  const list = $('#archiveList');
  if (!list) return;
  const q = state.query.toLowerCase();
  const items = state.works.filter((w) => {
    if (state.tab === 'upload' && w.builtin) return false;
    if (state.tab === 'builtin' && !w.builtin) return false;
    if (!q) return true;
    return [w.title, w.subtitle, w.categoryName, w.categoryCn, ...(w.tags || [])].join(' ').toLowerCase().includes(q);
  });
  const empty = $('#archiveEmpty'); if (empty) empty.hidden = items.length > 0;
  list.innerHTML = items.map((w) => {
    const meta = w.builtin ? 'BUILT-IN · NO. ' + pad(w.order || 0) : 'UPLOADED · ' + String(w.createdAt || '').slice(0, 10);
    const status = w.builtin ? '内置' : w.status === 'pending' ? '待审核' : w.status === 'rejected' ? '已拒绝' : w.visible === false ? '隐藏' : '公开';
    const actions = w.builtin
      ? '<a href="/#work/' + encodeURIComponent(w.id) + '" target="_blank" rel="noopener">查看</a>'
      : '<button type="button" data-action="featured" class="' + (w.featured ? 'is-on' : '') + '">' + (w.featured ? '精选 ✓' : '精选') + '</button>' +
        '<button type="button" data-action="visible" class="' + (w.visible === false ? '' : 'is-on') + '">' + status + '</button>' +
        '<button type="button" data-action="edit">编辑</button>' +
        '<button type="button" data-action="delete" class="danger">删除</button>';
    return '<article class="work-row" data-id="' + esc(w.id) + '">' +
      '<div class="row-cover">' + coverHTML(w) + '</div>' +
      '<div class="row-main"><div class="row-meta"><span class="row-badge ' + (w.builtin ? '' : 'new') + '">' + esc(meta) + '</span><span>' + esc(w.categoryName || '') + '</span><span>' + esc(w.kind || '') + '</span></div><h3>' + esc(w.title) + '</h3><p>' + esc(w.subtitle || w.tagline || '') + '</p></div>' +
      '<div class="row-actions">' + actions + '</div>' +
    '</article>';
  }).join('');
}

async function loadAdmin() {
  const [worksData, statsData, postsData] = await Promise.all([
    api('/api/admin/works'),
    api('/api/admin/stats'),
    api('/api/admin/posts'),
  ]);
  state.works = worksData.works || [];
  state.categories = worksData.categories || [];
  state.stats = statsData;
  state.posts = postsData.posts || [];
  fillCategories();
  renderStats();
  renderList();
  renderPosts();
  renderReview();
}

async function loadUser() {
  const [meta, mine, publicPosts, myWorks] = await Promise.all([
    api('/api/meta'),
    api('/api/my/posts'),
    api('/api/posts'),
    api('/api/my/works'),
  ]);
  state.categories = meta.categories || [];
  state.posts = mine.posts || [];
  state.myWorks = myWorks.works || [];
  state.stats = {
    works: meta.meta?.stats?.works ?? 33,
    categories: (meta.categories || []).length || 6,
    publicPosts: (publicPosts.posts || []).length,
  };
  fillCategories();
  renderStats();
  renderPosts();
  renderMyWorks();
}

function setupDropzone(dropId, inputId, maxMB, onFile) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  if (!drop || !input) return;
  const handle = (file) => {
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) { toast('文件太大：最大 ' + maxMB + ' MB', false); input.value = ''; return; }
    onFile(file);
  };
  input.addEventListener('change', () => handle(input.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
  drop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    handle(file);
  });
}

function resetPreviews() {
  const c = $('#coverPreview'); if (c) c.innerHTML = '<span class="dropzone-icon">▧</span>';
  const p = $('#packagePreview'); if (p) p.innerHTML = '<span class="dropzone-icon">ZIP</span>';
}

function setupUpload() {
  setupDropzone('coverDrop', 'coverInput', 12, (file) => {
    const url = URL.createObjectURL(file);
    const preview = $('#coverPreview');
    preview.innerHTML = '<img src="' + url + '" alt="封面预览" />';
    preview.dataset.url = url;
  });
  setupDropzone('packageDrop', 'packageInput', 600, (file) => {
    $('#packagePreview').innerHTML = '<span class="dropzone-icon">' + esc(file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name) + '<br />' + fmtBytes(file.size) + '</span>';
  });
  const form = $('#uploadForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (title.length < 2) return setMsg('formMsg', '请填写作品标题（至少 2 个字符）。');
    if (!fd.get('cover')?.size && !fd.get('package')?.size && !String(fd.get('description') || '').trim() && !String(fd.get('tagline') || '').trim()) {
      return setMsg('formMsg', '请至少上传封面、作品包，或填写介绍。');
    }
    const btn = $('#publishBtn');
    btn.disabled = true;
    const progress = $('#uploadProgress');
    const bar = $('#uploadBar');
    const pct = $('#uploadPercent');
    progress.hidden = false;
    bar.style.width = '0%';
    pct.textContent = '0%';
    setMsg('formMsg', '');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/works');
    xhr.withCredentials = true;
    xhr.setRequestHeader('x-csrf-token', state.csrf);
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const p = Math.round((ev.loaded / ev.total) * 100);
      bar.style.width = p + '%';
      pct.textContent = p + '%';
    };
    xhr.onload = async () => {
      btn.disabled = false;
      progress.hidden = true;
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        form.reset(); resetPreviews(); setMsg('formMsg', '作品已发布。', true); toast('作品已发布');
        await loadAdmin();
      } else {
        setMsg('formMsg', data.error || '上传失败（' + xhr.status + '）');
        toast(data.error || '上传失败', false);
      }
    };
    xhr.onerror = () => {
      btn.disabled = false; progress.hidden = true;
      setMsg('formMsg', '网络错误，上传中断。'); toast('网络错误', false);
    };
    xhr.send(fd);
  });
}

function renderPosts() {
  const list = $('#postList');
  if (!list) return;
  if (!state.posts.length) {
    list.innerHTML = '<div class="journal-admin-empty">还没有手记。写一条，发布后会出现在首页 JOURNAL 区块。</div>';
    return;
  }
  list.innerHTML = state.posts.map((p) => {
    const date = String(p.createdAt || '').slice(0, 10);
    const status = [p.pinned ? 'PINNED' : '', p.visible === false ? 'HIDDEN' : 'PUBLIC'].filter(Boolean).join(' · ');
    const tags = (p.tags || []).map((t) => '#' + t).join(' ');
    const adminActions = isAdmin()
      ? '<button type="button" data-post-action="pin" class="' + (p.pinned ? 'is-on' : '') + '">' + (p.pinned ? '已置顶' : '置顶') + '</button>' +
        '<button type="button" data-post-action="visible" class="' + (p.visible === false ? '' : 'is-on') + '">' + (p.visible === false ? '隐藏' : '公开') + '</button>'
      : '';
    return '<article class="journal-admin-item" data-post-id="' + esc(p.id) + '">' +
      '<div class="ja-meta"><span>' + esc(date) + ' · ' + esc(tags || 'NO TAGS') + (isAdmin() ? ' · ' + esc(p.authorName || '') : '') + '</span><span>' + esc(status) + '</span></div>' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<p>' + esc(String(p.body || '').replace(/\s+/g, ' ').slice(0, 180)) + '</p>' +
      '<div class="ja-actions">' + adminActions +
        '<button type="button" data-post-action="edit">编辑</button>' +
        '<button type="button" data-post-action="delete" class="danger">删除</button>' +
      '</div>' +
    '</article>';
  }).join('');
}

function resetPostForm() {
  const form = $('#postForm');
  if (!form) return;
  form.reset();
  delete form.dataset.editing;
  const visible = form.elements.visible; if (visible) visible.checked = true;
  const submitLabel = form.querySelector('.studio-submit span');
  if (submitLabel) submitLabel.textContent = '发布手记';
  setMsg('postMsg', '');
}

async function reloadPosts() {
  const data = await api(isAdmin() ? '/api/admin/posts' : '/api/my/posts');
  state.posts = data.posts || [];
  renderPosts();
  renderStats();
}

function setupPosts() {
  const form = $('#postForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: String(fd.get('title') || '').trim(),
      body: String(fd.get('body') || '').trim(),
      tags: String(fd.get('tags') || '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
    };
    if (isAdmin()) {
      payload.pinned = fd.get('pinned') === 'on';
      payload.visible = fd.get('visible') === 'on';
    }
    if (payload.title.length < 2) return setMsg('postMsg', '标题至少 2 个字符。');
    if (!payload.body) return setMsg('postMsg', '正文不能为空。');
    const editing = form.dataset.editing;
    try {
      if (editing) {
        await api('/api/posts/' + encodeURIComponent(editing), { method: 'PATCH', body: JSON.stringify(payload) });
        toast('手记已保存');
      } else {
        await api('/api/posts', { method: 'POST', body: JSON.stringify(payload) });
        toast('手记已发布');
      }
      resetPostForm();
      await reloadPosts();
    } catch (err) {
      setMsg('postMsg', err.message || '发布失败');
    }
  });
  const list = $('#postList');
  if (!list) return;
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-post-action]');
    if (!btn) return;
    const item = btn.closest('.journal-admin-item');
    const post = state.posts.find((p) => p.id === item.dataset.postId);
    if (!post) return;
    const action = btn.dataset.postAction;
    try {
      if (action === 'edit') {
        form.elements.title.value = post.title || '';
        form.elements.body.value = post.body || '';
        form.elements.tags.value = (post.tags || []).join(', ');
        if (form.elements.pinned) form.elements.pinned.checked = Boolean(post.pinned);
        if (form.elements.visible) form.elements.visible.checked = post.visible !== false;
        form.dataset.editing = post.id;
        const submitLabel = form.querySelector('.studio-submit span');
        if (submitLabel) submitLabel.textContent = '保存修改';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.elements.title.focus({ preventScroll: true });
        return;
      }
      if (action === 'delete') {
        if (!confirm('确定删除手记《' + post.title + '》？')) return;
        await api('/api/posts/' + encodeURIComponent(post.id), { method: 'DELETE' });
        toast('手记已删除');
      } else if (action === 'pin' && isAdmin()) {
        await api('/api/posts/' + encodeURIComponent(post.id), { method: 'PATCH', body: JSON.stringify({ pinned: !post.pinned }) });
        toast('已更新置顶');
      } else if (action === 'visible' && isAdmin()) {
        await api('/api/posts/' + encodeURIComponent(post.id), { method: 'PATCH', body: JSON.stringify({ visible: post.visible === false }) });
        toast('已更新公开状态');
      }
      await reloadPosts();
    } catch (err) {
      toast(err.message || '操作失败', false);
    }
  });
}

function setupArchive() {
  const tabs = $('#archiveTabs');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    $$('#archiveTabs button').forEach((b) => b.classList.toggle('is-active', b === btn));
    renderList();
  });
  let t;
  $('#archiveSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = e.target.value.trim(); renderList(); }, 100);
  });
  $('#archiveList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('.work-row');
    const work = state.works.find((w) => w.id === row.dataset.id);
    if (!work) return;
    const action = btn.dataset.action;
    try {
      if (action === 'delete') {
        if (!confirm('确定删除《' + work.title + '》？封面、作品包与在线演示都会一起删除，无法撤销。')) return;
        await api('/api/admin/works/' + encodeURIComponent(work.id), { method: 'DELETE' });
        toast('已删除'); await loadAdmin();
      } else if (action === 'featured') {
        await api('/api/admin/works/' + encodeURIComponent(work.id), { method: 'PATCH', body: JSON.stringify({ featured: !work.featured }) });
        toast('已更新精选状态'); await loadAdmin();
      } else if (action === 'visible') {
        await api('/api/admin/works/' + encodeURIComponent(work.id), { method: 'PATCH', body: JSON.stringify({ visible: work.visible === false }) });
        toast('已更新公开状态'); await loadAdmin();
      } else if (action === 'edit') {
        openEdit(work);
      }
    } catch (err) { toast(err.message || '操作失败', false); }
  });
}

function openEdit(work) {
  state.editing = work.id;
  const form = $('#editForm');
  form.elements.title.value = work.title || '';
  form.elements.subtitle.value = work.subtitle || '';
  form.elements.category.value = work.category || 'art';
  form.elements.accent.value = /^#[0-9a-f]{6}$/i.test(work.accent || '') ? work.accent : '#ff4a1c';
  form.elements.tagline.value = work.tagline || '';
  form.elements.description.value = work.description || '';
  form.elements.tags.value = (work.tags || []).join(', ');
  form.elements.tech.value = (work.tech || []).join(', ');
  form.elements.featured.checked = Boolean(work.featured);
  form.elements.visible.checked = work.visible !== false;
  setMsg('editMsg', '');
  $('#editModal').classList.add('is-open');
  $('#editModal').setAttribute('aria-hidden', 'false');
  form.elements.title.focus({ preventScroll: true });
}
function closeEdit() {
  $('#editModal').classList.remove('is-open');
  $('#editModal').setAttribute('aria-hidden', 'true');
  state.editing = null;
}
function setupEdit() {
  $$('[data-edit-close]').forEach((el) => el.addEventListener('click', closeEdit));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEdit(); });
  const form = $('#editForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.editing) return;
    const split = (v) => String(v || '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    const payload = {
      title: form.elements.title.value.trim(),
      subtitle: form.elements.subtitle.value.trim(),
      category: form.elements.category.value,
      accent: form.elements.accent.value,
      tagline: form.elements.tagline.value.trim(),
      description: form.elements.description.value.trim(),
      tags: split(form.elements.tags.value),
      tech: split(form.elements.tech.value),
      featured: form.elements.featured.checked,
      visible: form.elements.visible.checked,
    };
    try {
      await api('/api/admin/works/' + encodeURIComponent(state.editing), { method: 'PATCH', body: JSON.stringify(payload) });
      closeEdit(); toast('已保存'); await loadAdmin();
    } catch (err) { setMsg('editMsg', err.message || '保存失败'); }
  });
}

function statusLabel(status) {
  if (status === 'pending') return '审核中';
  if (status === 'rejected') return '未通过';
  return '已公开';
}
function statusBadge(status) {
  return '<span class="status-badge ' + esc(status || 'approved') + '">' + statusLabel(status) + '</span>';
}

function renderMyWorks() {
  const list = $('#myWorksList');
  if (!list) return;
  if (!state.myWorks.length) {
    list.innerHTML = '<div class="myworks-empty">还没有投稿。上传一个作品，管理员审核通过后就会出现在首页。</div>';
    return;
  }
  list.innerHTML = state.myWorks.map((w) => {
    const status = w.status || 'approved';
    const cover = w.cover ? '<img src="' + esc(w.cover) + '" alt="" loading="lazy" />' : '<span class="dropzone-icon">▧</span>';
    const actions = status === 'approved'
      ? '<a href="/#work/' + encodeURIComponent(w.id) + '" target="_blank" rel="noopener">查看</a>'
      : '<button type="button" data-work-action="delete" data-work-id="' + esc(w.id) + '" class="danger">删除</button>';
    const note = status === 'rejected' && w.reviewNote ? '<div class="mywork-note">审核意见：' + esc(w.reviewNote) + '</div>' : '';
    return '<article class="mywork-card">' +
      '<div class="mywork-cover">' + cover + '</div>' +
      '<div class="mywork-main"><div class="mywork-meta"><span>' + esc(String(w.createdAt || '').slice(0, 10)) + '</span><span>' + esc(w.categoryName || '') + '</span>' + statusBadge(status) + '</div>' +
      '<h3>' + esc(w.title) + '</h3>' +
      '<p>' + esc(w.tagline || w.subtitle || '') + '</p>' + note + '</div>' +
      '<div class="mywork-actions">' + actions + '</div>' +
    '</article>';
  }).join('');
}

function setupMyWorks() {
  const list = $('#myWorksList');
  if (!list) return;
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-work-action="delete"]');
    if (!btn) return;
    if (!confirm('确定删除这个投稿？文件也会一并删除。')) return;
    try {
      await api('/api/my/works/' + encodeURIComponent(btn.dataset.workId), { method: 'DELETE' });
      toast('投稿已删除');
      await loadUser();
    } catch (err) { toast(err.message || '删除失败', false); }
  });
}

function renderReview() {
  const list = $('#reviewList');
  if (!list) return;
  const pending = state.works.filter((w) => w.status === 'pending');
  const count = $('#reviewCount');
  if (count) count.textContent = pending.length + ' 件待处理';
  if (!pending.length) {
    list.innerHTML = '<div class="review-empty">没有待审核的投稿。新投稿会出现在这里。</div>';
    return;
  }
  list.innerHTML = pending.map((w) => {
    const cover = w.cover ? '<img src="' + esc(w.cover) + '" alt="" loading="lazy" />' : '<span class="dropzone-icon">▧</span>';
    return '<article class="review-card" data-work-id="' + esc(w.id) + '">' +
      '<div class="review-cover">' + cover + '</div>' +
      '<div class="review-main"><div class="review-meta"><span>' + esc(w.authorName || '') + '</span><span>' + esc(String(w.submittedAt || w.createdAt || '').slice(0, 10)) + '</span><span>' + esc(w.categoryName || '') + '</span></div>' +
      '<h3>' + esc(w.title) + '</h3>' +
      '<p>' + esc(w.tagline || w.subtitle || '') + '</p></div>' +
      '<div class="review-actions">' +
        '<button type="button" data-review="approve" class="is-on">通过并公开</button>' +
        '<button type="button" data-review="reject" class="danger">拒绝</button>' +
      '</div>' +
    '</article>';
  }).join('');
}

function setupReview() {
  const list = $('#reviewList');
  if (!list) return;
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-review]');
    if (!btn) return;
    const card = btn.closest('.review-card');
    const id = card?.dataset.workId;
    if (!id) return;
    const action = btn.dataset.review;
    try {
      if (action === 'approve') {
        if (!confirm('通过后作品会立即出现在首页，并开放下载/在线游玩。确定通过？')) return;
        await api('/api/admin/works/' + encodeURIComponent(id) + '/approve', { method: 'POST', body: JSON.stringify({}) });
        toast('已通过并公开');
      } else {
        const note = prompt('拒绝原因（可留空，会显示给投稿者）：') || '';
        await api('/api/admin/works/' + encodeURIComponent(id) + '/reject', { method: 'POST', body: JSON.stringify({ note }) });
        toast('已拒绝');
      }
      await loadAdmin();
    } catch (err) { toast(err.message || '操作失败', false); }
  });
}

function resetSubPreviews() {
  const c = $('#subCoverPreview'); if (c) c.innerHTML = '<span class="dropzone-icon">▧</span>';
  const p = $('#subPackagePreview'); if (p) p.innerHTML = '<span class="dropzone-icon">ZIP</span>';
}

function setupSubmission() {
  setupDropzone('subCoverDrop', 'subCoverInput', 12, (file) => {
    const url = URL.createObjectURL(file);
    $('#subCoverPreview').innerHTML = '<img src="' + url + '" alt="封面预览" />';
  });
  setupDropzone('subPackageDrop', 'subPackageInput', 600, (file) => {
    $('#subPackagePreview').innerHTML = '<span class="dropzone-icon">' + esc(file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name) + '<br />' + fmtBytes(file.size) + '</span>';
  });
  const form = $('#submissionForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (title.length < 2) return setMsg('subMsg', '请填写作品标题（至少 2 个字符）。');
    if (!fd.get('cover')?.size && !fd.get('package')?.size && !String(fd.get('description') || '').trim() && !String(fd.get('tagline') || '').trim()) {
      return setMsg('subMsg', '请至少上传封面、作品包，或填写介绍。');
    }
    const btn = $('#subSubmit');
    btn.disabled = true;
    setMsg('subMsg', '正在上传…');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'x-csrf-token': state.csrf },
        credentials: 'same-origin',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '提交失败');
      form.reset();
      resetSubPreviews();
      setMsg('subMsg', '已提交审核，管理员通过后会公开。', true);
      toast('已提交审核');
      await loadUser();
    } catch (err) {
      setMsg('subMsg', err.message || '提交失败');
      toast(err.message || '提交失败', false);
    } finally {
      btn.disabled = false;
    }
  });
}

function setupPassword() {
  const form = $('#passwordForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = form.elements.currentPassword.value;
    const newPassword = form.elements.newPassword.value;
    if (newPassword.length < 8) return setMsg('passwordMsg', '新密码至少需要 8 位。');
    try {
      const data = await api('/api/account/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      state.csrf = data.csrf;
      form.reset();
      setMsg('passwordMsg', '密码已更新，其他设备上的会话已失效。', true);
      toast('密码已更新');
    } catch (err) { setMsg('passwordMsg', err.message || '密码更新失败'); }
  });
}

let booted = false;
async function boot() {
  if (booted || window.__dashboardBooting) return;
  booted = true;
  window.__dashboardBooting = true;
  let session = null;
  for (let attempt = 0; attempt < 4 && !session; attempt++) {
    try {
      const res = await fetch('/api/session', { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) session = data;
      }
    } catch (err) { console.warn('[dashboard] session fetch failed', err && err.message); }
    if (!session) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!session) { location.replace('/login?t=' + Date.now()); return; }
  state.csrf = session.csrf;
  state.user = session.user;
  state.role = session.user?.role === 'admin' ? 'admin' : 'user';
  document.body.classList.add('role-' + state.role);

  $$('[data-admin-only]').forEach((el) => { el.hidden = !isAdmin(); });
  $$('[data-user-only]').forEach((el) => { el.hidden = isAdmin(); });
  const greetingName = $('#greetingName'); if (greetingName) greetingName.textContent = state.user.username;
  const accountName = $('#accountName'); if (accountName) accountName.textContent = state.user.username;
  const accountRole = $('#accountRole'); if (accountRole) accountRole.textContent = isAdmin() ? 'ADMIN / 管理员' : 'MEMBER / 注册用户';
  const avatar = $('#accountAvatar'); if (avatar) avatar.textContent = String(state.user.username || 'U').slice(0, 1).toUpperCase();
  const hint = $('#journalHint'); if (hint) hint.textContent = isAdmin() ? '公开手记 · 所有人可读 · 管理员可置顶/隐藏' : '公开手记 · 所有人可读 · 你可以写和编辑自己的';

  setupPosts();
  setupPassword();
  const logout = $('#logoutBtn');
  if (logout) logout.addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    location.replace('/');
  });

  if (isAdmin()) {
    setupUpload();
    setupArchive();
    setupEdit();
    setupReview();
  } else {
    setupSubmission();
    setupMyWorks();
  }
  try {
    if (isAdmin()) await loadAdmin();
    else await loadUser();
  } catch (err) {
    console.error('dashboard load failed', err);
    toast(err.message || '加载失败', false);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
addEventListener('load', () => { if (!booted) boot(); });
})();