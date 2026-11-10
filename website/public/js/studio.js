/* LanGYou Studio */
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

const state = { csrf: '', works: [], categories: [], stats: null, tab: 'all', query: '', editing: null };

async function api(path, options = {}) {
  const headers = { accept: 'application/json', ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (options.method && options.method !== 'GET') headers['x-csrf-token'] = state.csrf;
  const res = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  if (res.status === 401) { location.replace('/login'); throw new Error('未登录'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function toast(message, ok = true) {
  const el = $('#studioToast');
  el.textContent = message;
  el.classList.toggle('is-ok', ok);
  el.classList.add('is-show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('is-show'), 2600);
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
  const stats = state.stats || {};
  const visible = state.works.filter((w) => !w.builtin ? w.visible !== false : true).length;
  $('#studioStats').innerHTML =
    '<div><strong>' + (stats.works ?? state.works.length) + '</strong><span>作品总数</span></div>' +
    '<div><strong>' + (stats.uploads ?? 0) + '</strong><span>上传作品</span></div>' +
    '<div><strong>' + (stats.uploadBytesLabel || '0 B') + '</strong><span>占用空间</span></div>' +
    '<div><strong>' + visible + '</strong><span>公开中</span></div>';
  const dateEl = $('#studioDate');
  const now = new Date();
  dateEl.textContent = 'CST ' + new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(now).replaceAll('/', '.');
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false }).format(now));
  const greet = hour < 5 ? '凌晨好' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 19 ? '下午好' : '晚上好';
  $('#greeting').innerHTML = greet + '，<em>LanGYou</em>。';
}

function fillCategories() {
  const options = state.categories.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.cn) + ' / ' + esc(c.name) + '</option>').join('');
  $('#categorySelect').innerHTML = options;
  $('#editCategory').innerHTML = options;
}

function renderList() {
  const list = $('#archiveList');
  const q = state.query.toLowerCase();
  const items = state.works.filter((w) => {
    if (state.tab === 'upload' && w.builtin) return false;
    if (state.tab === 'builtin' && !w.builtin) return false;
    if (!q) return true;
    return [w.title, w.subtitle, w.categoryName, w.categoryCn, ...(w.tags || [])].join(' ').toLowerCase().includes(q);
  });
  $('#archiveEmpty').hidden = items.length > 0;
  list.innerHTML = items.map((w) => {
    const meta = w.builtin ? 'BUILT-IN · NO. ' + pad(w.order || 0) : 'UPLOADED · ' + String(w.createdAt || '').slice(0, 10);
    const status = w.builtin ? '内置' : w.visible === false ? '隐藏' : '公开';
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

async function loadAll() {
  const [worksData, statsData] = await Promise.all([
    api('/api/admin/works'),
    api('/api/admin/stats'),
  ]);
  state.works = worksData.works || [];
  state.categories = worksData.categories || [];
  state.stats = statsData;
  fillCategories();
  renderStats();
  renderList();
}

function setupDropzone(dropId, inputId, maxMB, onFile) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
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
  $('#coverPreview').innerHTML = '<span class="dropzone-icon">▧</span>';
  $('#packagePreview').innerHTML = '<span class="dropzone-icon">ZIP</span>';
}

function setupUpload() {
  setupDropzone('coverDrop', 'coverInput', 12, (file) => {
    const url = URL.createObjectURL(file);
    $('#coverPreview').innerHTML = '<img src="' + url + '" alt="封面预览" />';
    $('#coverPreview').dataset.url = url;
  });
  setupDropzone('packageDrop', 'packageInput', 600, (file) => {
    $('#packagePreview').innerHTML = '<span class="dropzone-icon">' + esc(file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name) + '<br />' + fmtBytes(file.size) + '</span>';
  });

  const form = $('#uploadForm');
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
        form.reset();
        resetPreviews();
        setMsg('formMsg', '作品已发布。', true);
        toast('作品已发布');
        await loadAll();
      } else {
        setMsg('formMsg', data.error || '上传失败（' + xhr.status + '）');
        toast(data.error || '上传失败', false);
      }
    };
    xhr.onerror = () => {
      btn.disabled = false;
      progress.hidden = true;
      setMsg('formMsg', '网络错误，上传中断。');
      toast('网络错误', false);
    };
    xhr.send(fd);
  });
}

function setMsg(id, text, ok = false) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.toggle('is-ok', Boolean(ok));
}

function setupArchive() {
  $('#archiveTabs').addEventListener('click', (e) => {
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
        toast('已删除');
        await loadAll();
      } else if (action === 'featured') {
        await api('/api/admin/works/' + encodeURIComponent(work.id), { method: 'PATCH', body: JSON.stringify({ featured: !work.featured }) });
        toast('已更新精选状态');
        await loadAll();
      } else if (action === 'visible') {
        await api('/api/admin/works/' + encodeURIComponent(work.id), { method: 'PATCH', body: JSON.stringify({ visible: work.visible === false }) });
        toast('已更新公开状态');
        await loadAll();
      } else if (action === 'edit') {
        openEdit(work);
      }
    } catch (err) {
      toast(err.message || '操作失败', false);
    }
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
  $('#editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.editing) return;
    const form = e.currentTarget;
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
      closeEdit();
      toast('已保存');
      await loadAll();
    } catch (err) {
      setMsg('editMsg', err.message || '保存失败');
    }
  });
}

function setupPassword() {
  $('#passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const currentPassword = form.elements.currentPassword.value;
    const newPassword = form.elements.newPassword.value;
    if (newPassword.length < 10) return setMsg('passwordMsg', '新密码至少需要 10 位。');
    try {
      const data = await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      state.csrf = data.csrf;
      form.reset();
      setMsg('passwordMsg', '密码已更新，其他设备上的会话已失效。', true);
      toast('密码已更新');
    } catch (err) {
      setMsg('passwordMsg', err.message || '密码更新失败');
    }
  });
}

async function boot() {
  try {
    const session = await fetch('/api/session', { headers: { accept: 'application/json' }, credentials: 'same-origin' }).then((r) => r.json());
    if (!session.authenticated) { location.replace('/login'); return; }
    state.csrf = session.csrf;
  } catch {
    location.replace('/login');
    return;
  }
  setupUpload();
  setupArchive();
  setupEdit();
  setupPassword();
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    location.replace('/');
  });
  try {
    await loadAll();
  } catch (err) {
    toast(err.message || '加载失败', false);
  }
}

document.addEventListener('DOMContentLoaded', boot);
