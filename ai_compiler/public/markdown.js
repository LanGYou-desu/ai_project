// 轻量 Markdown 渲染（无依赖）：面向 AI 输出的子集
// 支持：fenced 代码块、标题、无序/有序列表、引用、分隔线、粗体、斜体、行内代码、http(s) 链接
// 所有文本先 HTML 转义再套用标记，避免注入
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 行内标记：先整体 HTML 转义（防注入），再套用 行内代码 → 链接 → 粗体 → 斜体
function inlineMd(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => `<a href="${u}" data-ext="1">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s;
}

// 渲染完整 markdown 文本为 HTML 字符串
function renderMarkdown(text) {
  const source = String(text || '').replace(/\r\n/g, '\n');
  const codeBlocks = [];
  // 1) 先提取行首开始的 fenced 代码块，内容原样保留（渲染时转义）
  const withoutCode = source.replace(/^```([a-zA-Z0-9_+-]*)[ \t]*\n?([\s\S]*?)```/gm, (m, lang, code) => {
    const id = '\u0000CB' + codeBlocks.length + '\u0000';
    codeBlocks.push({ lang: lang || '', code: code.replace(/\n$/, '') });
    return id;
  });
  // 2) 逐行解析块级结构
  const lines = withoutCode.split('\n');
  const html = [];
  let listType = null; // 'ul' | 'ol' | null
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };
  for (const raw of lines) {
    const line = raw;
    const cbMatch = line.match(/^\u0000CB(\d+)\u0000$/);
    if (cbMatch) {
      closeList();
      const b = codeBlocks[Number(cbMatch[1])];
      html.push(
        '<div class="md-codeblock">' +
        '<div class="md-codeblock-head"><span class="md-codeblock-lang">' + escapeHtml(b.lang || 'code') +
        '</span><button type="button" class="md-copy">复制</button></div>' +
        '<pre><code>' + escapeHtml(b.code) + '</code></pre>' +
        '</div>'
      );
      continue;
    }
    if (/^\s*$/.test(line)) { closeList(); continue; }
    if (/^#{1,4}\s+/.test(line)) {
      closeList();
      const level = line.match(/^(#{1,4})\s+/)[1].length;
      html.push(`<h${level}>` + inlineMd(line.replace(/^#{1,4}\s+/, '')) + `</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
      html.push('<li>' + inlineMd(line.replace(/^[-*]\s+/, '')) + '</li>');
      continue;
    }
    if (/^\d+[.、]\s+/.test(line)) {
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
      html.push('<li>' + inlineMd(line.replace(/^\d+[.、]\s+/, '')) + '</li>');
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      html.push('<blockquote>' + inlineMd(line.replace(/^>\s?/, '')) + '</blockquote>');
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      closeList();
      html.push('<hr>');
      continue;
    }
    closeList();
    html.push('<p>' + inlineMd(line) + '</p>');
  }
  closeList();
  return html.join('\n');
}

// 复制文本到剪贴板（secure context 用 Clipboard API，否则降级 execCommand）
async function copyText(text, btn) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = old; }, 1200);
    }
  } catch { /* 复制失败静默 */ }
}

// 全局事件：代码块复制按钮 + 外链打开（桌面版经主进程 shell，浏览器模式 window.open）
document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.md-copy');
  if (copyBtn) {
    const codeEl = copyBtn.closest('.md-codeblock')?.querySelector('pre code');
    if (codeEl) copyText(codeEl.textContent, copyBtn);
    return;
  }
  const link = e.target.closest('a[data-ext]');
  if (link) {
    e.preventDefault();
    if (window.shell && window.shell.openExternal) window.shell.openExternal(link.href);
    else window.open(link.href, '_blank', 'noopener');
  }
});
