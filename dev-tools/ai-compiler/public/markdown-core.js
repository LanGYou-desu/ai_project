// 轻量 Markdown 渲染核心（无依赖，纯函数）
// 单独成文件：浏览器用 <script> 加载，Node 测试可直接 require
// 支持：fenced 代码块、标题、无序/有序列表、引用、分隔线、粗体、斜体、行内代码、http(s) 链接
// 所有文本先 HTML 转义再套用标记，避免 AI 输出注入 HTML
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.MarkdownCore = api;
    // 兼容既有调用点（output.js / assistant.js / preview.js 直接用裸函数名）
    root.escapeHtml = api.escapeHtml;
    root.inlineMd = api.inlineMd;
    root.renderMarkdown = api.renderMarkdown;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 行内标记：先整体 HTML 转义（防注入），再套用 行内代码 → 链接 → 粗体 → 斜体
  // 行内代码用占位符保护，避免代码里的 ** / * 被当成强调标记
  function inlineMd(text) {
    const codes = [];
    let s = escapeHtml(text).replace(/`([^`]+)`/g, (m, c) => {
      const id = '\u0001IC' + codes.length + '\u0001';
      codes.push(c);
      return id;
    });
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => `<a href="${u}" data-ext="1">${t}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\u0001IC(\d+)\u0001/g, (m, i) => '<code>' + codes[Number(i)] + '</code>');
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

  return { escapeHtml, inlineMd, renderMarkdown };
});
