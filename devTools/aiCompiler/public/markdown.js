// Markdown 面板的 DOM 行为：复制代码块、外链打开
// 渲染逻辑（escapeHtml / inlineMd / renderMarkdown）在 markdown-core.js（纯函数，可单测）

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
    // 只放行 http/https：主进程也会再校验一次，这里是浏览器模式的兜底
    if (!/^https?:\/\//i.test(link.href)) return;
    if (window.shell && window.shell.openExternal) window.shell.openExternal(link.href);
    else window.open(link.href, '_blank', 'noopener');
  }
});
