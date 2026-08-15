// 资源管理器
const expandedDirs = new Set(); // 记住展开的目录，刷新后保留
let selectedPath = '';
let treeBusy = false; // 防止渲染重入（快速连续点击）

// 树中隐藏的常见噪音目录/文件（node_modules/.git 等会淹没源码文件）
const IGNORED_TREE_NAMES = new Set(['node_modules', '.git', '.svn', '.hg', '.DS_Store', 'Thumbs.db']);

async function explorerList(dir) {
  if (!window.fs) return [];
  const r = await window.fs.listDir(dir);
  return r.ok ? r.entries : [];
}
function relJoin(dir, name) { return dir ? dir + '/' + name : name; }

function findTreeItem(rel) {
  const items = document.querySelectorAll('#explorer-tree .tree-item');
  for (const it of items) if (it.dataset.path === rel) return it;
  return null;
}

function highlightPath(rel) {
  document.querySelectorAll('.tree-item.active').forEach((n) => n.classList.remove('active'));
  selectedPath = rel;
  const item = findTreeItem(rel);
  if (item) item.classList.add('active');
  $('btn-delete').disabled = !rel;
}

// —— 右键菜单（轻量实现，无依赖）——
let ctxMenu = null;
function closeContextMenu() {
  if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('scroll', onDocScroll, true);
}
function onDocClick(e) {
  if (ctxMenu && !ctxMenu.contains(e.target)) closeContextMenu();
}
function onDocScroll() { closeContextMenu(); }
function showContextMenu(x, y, items) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  for (const it of items) {
    if (it.sep) {
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'ctx-item' + (it.danger ? ' danger' : '');
    const icon = document.createElement('span');
    icon.className = 'codicon ' + it.icon;
    const label = document.createElement('span');
    label.textContent = it.label;
    btn.appendChild(icon);
    btn.appendChild(label);
    btn.addEventListener('click', () => { closeContextMenu(); it.action(); });
    menu.appendChild(btn);
  }
  document.body.appendChild(menu);
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  menu.style.left = Math.max(4, Math.min(x, window.innerWidth - mw - 8)) + 'px';
  menu.style.top = Math.max(4, Math.min(y, window.innerHeight - mh - 8)) + 'px';
  ctxMenu = menu;
  setTimeout(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('scroll', onDocScroll, true);
  }, 0);
}

async function renderTree() {
  if (treeBusy) return;
  treeBusy = true;
  try {
    closeContextMenu();
    const tree = $('explorer-tree');
    const prevScroll = tree.scrollTop;
    tree.textContent = '';
    if (!window.fs) {
      $('explorer-hint').hidden = false;
      $('explorer-hint').textContent = '文件系统仅桌面版可用（启动.bat / npm start）';
      $('explorer-tree').hidden = true;
      return;
    }
    const root = (await window.fs.getWorkspace()).root;
    if (!root) {
      $('explorer-hint').hidden = false;
      $('explorer-hint').textContent = '未打开文件夹';
      $('explorer-tree').hidden = true;
      $('btn-new-file').disabled = true;
      $('btn-refresh').disabled = true;
      $('btn-delete').disabled = true;
      return;
    }
    $('explorer-hint').hidden = true;
    $('explorer-tree').hidden = false;
    $('btn-new-file').disabled = false;
    $('btn-refresh').disabled = false;
    $('btn-delete').disabled = !selectedPath;
    await renderDir(tree, '', 0);
    // 恢复选中高亮与滚动位置
    if (selectedPath) {
      const sel = findTreeItem(selectedPath);
      if (sel) sel.classList.add('active');
    }
    tree.scrollTop = prevScroll;
  } finally {
    treeBusy = false;
  }
}

async function renderDir(container, dir, depth) {
  const entries = (await explorerList(dir))
    .filter((en) => !IGNORED_TREE_NAMES.has(en.name))
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  for (const en of entries) {
    const rel = relJoin(dir, en.name);
    const item = document.createElement('div');
    item.className = 'tree-item' + (en.isDir ? ' dir' : '');
    item.dataset.path = rel;
    const indent = document.createElement('span');
    indent.className = 'tree-indent';
    indent.style.width = (depth * 16) + 'px';
    const icon = document.createElement('span');
    icon.className = 'codicon ' + (en.isDir ? 'codicon-folder' : 'codicon-file');
    const label = document.createElement('span');
    label.textContent = en.name;
    item.appendChild(indent); item.appendChild(icon); item.appendChild(label);
    if (en.isDir) {
      item.addEventListener('click', () => toggleDir(rel));
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        highlightPath(rel);
        showContextMenu(e.clientX, e.clientY, folderMenu(rel));
      });
      container.appendChild(item);
      if (expandedDirs.has(rel)) {
        icon.className = 'codicon codicon-folder-opened';
        const sub = document.createElement('div');
        container.appendChild(sub);
        await renderDir(sub, rel, depth + 1);
      }
    } else {
      item.addEventListener('click', () => openFile(rel, item));
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        highlightPath(rel);
        showContextMenu(e.clientX, e.clientY, fileMenu(rel));
      });
      container.appendChild(item);
    }
  }
}

async function toggleDir(rel) {
  if (expandedDirs.has(rel)) expandedDirs.delete(rel);
  else expandedDirs.add(rel);
  await renderTree();
  const item = findTreeItem(rel);
  if (item) item.scrollIntoView({ block: 'nearest' });
}

async function openFile(rel, item) {
  highlightPath(rel);
  const r = await window.fs.readFile(rel);
  if (r.ok) {
    openFileInEditor(rel, r.content);
  } else {
    appendOutput('terminal', `[打开失败] ${r.error}\n`, 'err');
    setOutputTab('terminal');
  }
}

// —— 文件操作 ——
function isValidNewPath(rel) {
  return /^[^/]+(\/[^/]+)*$/.test(rel) && !rel.split('/').some((s) => s === '..' || s === '.');
}

async function createFileAt(rel) {
  const r = await window.fs.createFile(rel);
  if (r.ok) {
    renderTree();
    const rr = await window.fs.readFile(rel);
    if (rr.ok) openFileInEditor(rel, rr.content);
  } else {
    appendOutput('terminal', `[创建失败] ${r.error}\n`, 'err');
    setOutputTab('terminal');
  }
}

async function newFileIn(dir) {
  const name = prompt('新文件名：');
  if (!name || !name.trim()) return;
  const rel = relJoin(dir, name.trim().replace(/\\/g, '/'));
  if (!isValidNewPath(rel)) {
    appendOutput('terminal', `[创建失败] 非法的文件名：${name}\n`, 'err');
    setOutputTab('terminal');
    return;
  }
  await createFileAt(rel);
}

async function newFolderIn(dir) {
  const name = prompt('新文件夹名：');
  if (!name || !name.trim()) return;
  const rel = relJoin(dir, name.trim().replace(/\\/g, '/'));
  if (!isValidNewPath(rel)) {
    appendOutput('terminal', `[创建失败] 非法的文件夹名：${name}\n`, 'err');
    setOutputTab('terminal');
    return;
  }
  const r = await window.fs.createDir(rel);
  if (r.ok) renderTree();
  else { appendOutput('terminal', `[创建失败] ${r.error}\n`, 'err'); setOutputTab('terminal'); }
}

async function renameItem(rel) {
  const name = rel.split('/').pop();
  const newName = prompt('重命名为：', name);
  if (!newName || !newName.trim() || newName.trim() === name) return;
  const nn = newName.trim();
  if (nn.includes('/') || nn.includes('\\') || nn === '.' || nn === '..') {
    appendOutput('terminal', '[重命名失败] 名称不能包含路径分隔符\n', 'err');
    setOutputTab('terminal');
    return;
  }
  const r = await window.fs.rename(rel, nn);
  if (!r.ok) {
    appendOutput('terminal', `[重命名失败] ${r.error}\n`, 'err');
    setOutputTab('terminal');
    return;
  }
  const newRel = relJoin(rel.split('/').slice(0, -1).join('/'), nn);
  // 同步打开中的 tab 路径
  const tab = openTabs.find((t) => t.rel === rel);
  if (tab) { tab.rel = newRel; renderTabs(); }
  if (selectedPath === rel) selectedPath = newRel;
  if (typeof previewRel === 'string' && previewRel === rel) previewRel = newRel;
  renderTree();
}

function closeTabsUnder(prefix) {
  for (let i = openTabs.length - 1; i >= 0; i--) {
    const rel = openTabs[i].rel;
    if (rel === prefix || rel.startsWith(prefix + '/')) closeTab(openTabs[i], true);
  }
}

async function deleteItem(rel, isDir) {
  const tip = isDir ? `将递归删除文件夹 ${rel} 及其全部内容，确定？` : `确定删除 ${rel} ？`;
  if (!confirm(tip)) return;
  const r = isDir ? await window.fs.deleteDir(rel) : await window.fs.deleteFile(rel);
  if (r.ok) {
    closeTabsUnder(rel);
    if (selectedPath === rel || selectedPath.startsWith(rel + '/')) { selectedPath = ''; $('btn-delete').disabled = true; }
    renderTree();
  } else {
    appendOutput('terminal', `[删除失败] ${r.error}\n`, 'err');
    setOutputTab('terminal');
  }
}

function folderMenu(rel) {
  const expanded = expandedDirs.has(rel);
  return [
    { label: expanded ? '折叠' : '展开', icon: expanded ? 'codicon-chevron-down' : 'codicon-chevron-right', action: () => toggleDir(rel) },
    { label: '新建文件', icon: 'codicon-new-file', action: () => newFileIn(rel) },
    { label: '新建文件夹', icon: 'codicon-new-folder', action: () => newFolderIn(rel) },
    { sep: true },
    { label: '重命名', icon: 'codicon-edit', action: () => renameItem(rel) },
    { label: '删除', icon: 'codicon-trash', danger: true, action: () => deleteItem(rel, true) },
  ];
}

function fileMenu(rel) {
  return [
    { label: '打开', icon: 'codicon-go-to-file', action: () => { const it = findTreeItem(rel); openFile(rel, it || null); } },
    { sep: true },
    { label: '重命名', icon: 'codicon-edit', action: () => renameItem(rel) },
    { label: '删除', icon: 'codicon-trash', danger: true, action: () => deleteItem(rel, false) },
  ];
}

// —— 顶部工具栏 ——
async function openFolder() {
  const r = await window.fs.openFolder();
  if (r.ok) renderTree();
}

async function newFile() {
  await newFileIn('');
}

async function refreshTree() { renderTree(); }

async function deleteSelected() {
  if (!selectedPath) return;
  const item = findTreeItem(selectedPath);
  const isDir = item ? item.classList.contains('dir') : false;
  await deleteItem(selectedPath, isDir);
}

// 空白区域右键：新建文件 / 新建文件夹 / 刷新
$('explorer-tree').addEventListener('contextmenu', (e) => {
  if (!window.fs || e.target.closest('.tree-item')) return;
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, [
    { label: '新建文件', icon: 'codicon-new-file', action: () => newFile() },
    { label: '新建文件夹', icon: 'codicon-new-folder', action: () => newFolderIn('') },
    { sep: true },
    { label: '刷新', icon: 'codicon-refresh', action: renderTree },
  ]);
});

// Esc 关闭右键菜单
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeContextMenu();
});

$('btn-open-folder').addEventListener('click', openFolder);
$('btn-new-file').addEventListener('click', newFile);
$('btn-refresh').addEventListener('click', refreshTree);
$('btn-delete').addEventListener('click', deleteSelected);
renderTree();
