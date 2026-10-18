// 右侧边栏 Markdown 预览：点击 .md 文件自动渲染，编辑器输入实时联动
const MD_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd']);

function isMarkdownFile(rel) {
  if (typeof rel !== 'string') return false;
  const ext = rel.split('.').pop().toLowerCase();
  return MD_EXTS.has(ext);
}

let previewRel = null;      // 当前预览的文件 rel
let previewTimer = null;

// 渲染当前预览（从打开中的 tab 取实时内容）
function renderPreview() {
  const el = $('preview-content');
  const tab = openTabs.find((t) => t.rel === previewRel);
  if (!tab) {
    el.innerHTML = '<p class="md-preview-empty">未打开 Markdown 文件<br>点击资源管理器中的 .md 文件即可预览</p>';
    return;
  }
  el.innerHTML = renderMarkdown(tab.model.getValue());
}

// 点击文件打开：设置预览源、展开右侧栏并切到预览面板
function openPreviewFor(rel) {
  previewRel = rel;
  $('sidebar-right').hidden = false;
  $('split-right').hidden = false;
  showSideTab('preview');
  renderPreview();
}

// 切换编辑器 tab：md 文件跟随更新（仅当预览面板可见时）
function previewOnTabSwitch(tab) {
  if (!isMarkdownFile(tab.rel)) return;
  previewRel = tab.rel;
  if (!$('panel-preview').hidden) renderPreview();
}

// 编辑内容变化：防抖实时刷新（仅当预览面板可见时）
function previewOnEdit() {
  if (!currentTab || !isMarkdownFile(currentTab.rel)) return;
  if ($('panel-preview').hidden) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 150);
}

// 关闭 tab：若关闭的是预览源，清空预览
function previewOnClose(rel) {
  if (rel === previewRel) {
    previewRel = null;
    if (!$('panel-preview').hidden) renderPreview();
  }
}

// —— 右侧边栏面板切换（AI 助手 / 预览）——
function showSideTab(name) {
  document.querySelectorAll('.side-tab').forEach((b) => b.classList.toggle('active', b.dataset.side === name));
  $('panel-assistant').hidden = name !== 'assistant';
  $('panel-preview').hidden = name !== 'preview';
  if (name === 'preview') renderPreview();
  syncActivity(); // 定义于 output.js：按面板可见性统一同步活动栏高亮
}

// 由 output.js switchPanel('assistant' | 'preview') 调用：侧栏已显示时切 tab
function sidePanelTab(name) {
  showSideTab(name);
}

// 活动栏预览按钮：开/关侧栏并切到预览
$('act-preview').addEventListener('click', () => switchPanel('preview'));

// side-tab 点击：只切内容，不关侧栏
document.querySelectorAll('.side-tab').forEach((b) => {
  b.addEventListener('click', () => showSideTab(b.dataset.side));
});

// 手动刷新按钮
$('btn-refresh-preview').addEventListener('click', () => {
  if (previewRel) renderPreview();
});
