const test = require('node:test');
const assert = require('node:assert');

// 前端纯函数核心：浏览器用 <script> 加载，Node 直接 require（UMD）
const { parseSse } = require('../public/sse.js');
const { renderMarkdown, inlineMd, escapeHtml } = require('../public/markdown-core.js');

// —— SSE 解析 ——

test('parseSse 解析完整事件与 [DONE]', () => {
  const r = parseSse('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n');
  assert.strictEqual(r.content, 'Hello');
  assert.strictEqual(r.buffer, '');
  assert.strictEqual(r.errored, false);
  assert.strictEqual(r.done, true);
});

test('parseSse 保留未闭合的分块（跨 chunk 截断）', () => {
  const first = parseSse('data: {"choices":[{"delta":{"content":"He');
  assert.strictEqual(first.content, '');
  assert.match(first.buffer, /^data: /);
  const second = parseSse(`${first.buffer}l"}}]}\n\n`);
  assert.strictEqual(second.content, 'Hel');
  assert.strictEqual(second.buffer, '');
});

test('parseSse 兼容 CRLF 与多行 data', () => {
  // 多行 data 按 SSE 规范用 \n 拼接后再解析（JSON 允许 token 间的换行）
  const r = parseSse('data: {"choices":[{"delta":\r\ndata: {"content":"x"}}]}\r\n\r\n');
  assert.strictEqual(r.content, 'x');
  assert.strictEqual(r.errored, false);
  const r2 = parseSse('data: {"choices":[{"delta":{"content":"a"}}]}\r\n\r\n');
  assert.strictEqual(r2.content, 'a');
});

test('parseSse 识别 data 中的 error 对象', () => {
  const r = parseSse('data: {"error":"upstream boom"}\n\n');
  assert.strictEqual(r.errored, true);
  assert.match(r.content, /\[错误\] upstream boom/);
});

test('parseSse 识别 event: error 且 data 非 JSON', () => {
  const r = parseSse('event: error\ndata: stream interrupted\n\n');
  assert.strictEqual(r.errored, true);
  assert.match(r.content, /stream interrupted/);
});

test('parseSse flush：上游返回普通 JSON（忽略 stream:true）也能取到内容', () => {
  const body = JSON.stringify({ choices: [{ message: { content: 'NON-STREAM' } }] });
  const r = parseSse(body, { flush: true });
  assert.strictEqual(r.content, 'NON-STREAM');
  assert.strictEqual(r.errored, false);
});

test('parseSse 未 flush 时不解析普通 JSON（避免把半截 JSON 当结果）', () => {
  const r = parseSse('{"choices":[{"message":{"content":"NON-STREAM"}}]}');
  assert.strictEqual(r.content, '');
  assert.match(r.buffer, /choices/);
});

test('parseSse flush：最后一个事件缺少结尾空行也能解析', () => {
  const r = parseSse('data: {"choices":[{"delta":{"content":"tail"}}]}', { flush: true });
  assert.strictEqual(r.content, 'tail');
});

test('parseSse flush：完全无法解析的尾部给出错误提示', () => {
  const r = parseSse('<html>oops</html>', { flush: true });
  assert.strictEqual(r.errored, true);
  assert.match(r.content, /无法解析/);
});

test('parseSse 接受 null / undefined 输入', () => {
  assert.deepStrictEqual(parseSse(null).content, '');
  assert.deepStrictEqual(parseSse(undefined).buffer, '');
});

// —— Markdown 渲染（AI 输出注入防护）——

test('renderMarkdown 转义 HTML 标签与脚本', () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>');
  assert.ok(!html.includes('<img'), html);
  assert.ok(!html.includes('<script'), html);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
});

test('renderMarkdown 代码块内容转义且带复制按钮', () => {
  const html = renderMarkdown('```python\nprint("<b>x</b>")\n```');
  assert.match(html, /md-codeblock/);
  assert.match(html, /md-copy/);
  assert.match(html, /&lt;b&gt;/);
  assert.ok(!html.includes('<b>x</b>'));
});

test('renderMarkdown 只把 http(s) 链接变成可点击外链', () => {
  const html = renderMarkdown('[ok](https://example.com/a?b=1) [bad](javascript:alert(1))');
  assert.match(html, /<a href="https:\/\/example\.com\/a\?b=1" data-ext="1">ok<\/a>/);
  assert.strictEqual((html.match(/<a /g) || []).length, 1, '只有 http(s) 链接变成 <a>');
  assert.match(html, /\[bad\]\(javascript:alert\(1\)\)/, '非 http(s) 链接保持纯文本');
});

test('renderMarkdown 链接中的引号被转义，无法闭合属性', () => {
  const html = renderMarkdown('[x](https://e.com/"onmouseover="alert(1))');
  assert.ok(!/\sonmouseover\s*=/.test(html), html);
  assert.match(html, /href="https:\/\/e\.com\/&quot;onmouseover=&quot;alert\(1"/);
});

test('renderMarkdown 行内代码内的 * 不会被当成强调', () => {
  const html = inlineMd('`a**b**c` 与 **粗体**');
  assert.match(html, /<code>a\*\*b\*\*c<\/code>/);
  assert.match(html, /<strong>粗体<\/strong>/);
});

test('renderMarkdown 支持标题 / 列表 / 引用 / 分隔线', () => {
  const html = renderMarkdown('# 标题\n\n- 一\n- 二\n\n1. 甲\n\n> 引用\n\n---');
  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<ul>\s*<li>一<\/li>\s*<li>二<\/li>\s*<\/ul>/);
  assert.match(html, /<ol>\s*<li>甲<\/li>\s*<\/ol>/);
  assert.match(html, /<blockquote>引用<\/blockquote>/);
  assert.match(html, /<hr>/);
});

test('escapeHtml 覆盖五个关键字符', () => {
  assert.strictEqual(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('renderMarkdown 处理 null / 非字符串输入', () => {
  assert.strictEqual(renderMarkdown(null), '');
  assert.strictEqual(renderMarkdown(undefined), '');
  assert.match(renderMarkdown(123), /<p>123<\/p>/);
});
