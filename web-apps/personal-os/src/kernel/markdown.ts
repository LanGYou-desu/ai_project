// 轻量 Markdown 渲染器（自写，先转义再解析，链接白名单）
// 支持：# 标题、段落、**粗体**、*斜体*、`代码`、[链接](url)、- 列表、1. 列表、> 引用、--- 分割线、``` 代码块

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const URL_OK = /^(https?:\/\/|mailto:|#|\/)/i

function inline(s: string): string {
  // 代码片段先抽出来，避免里面的星号/链接被继续解析
  const codes: string[] = []
  let out = s.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`)
    return `\u0000${codes.length - 1}\u0000`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em>$2</em>')
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    if (!URL_OK.test(url)) return text
    const ext = /^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${escapeHtml(url)}"${ext}>${text}</a>`
  })
  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)] ?? '')
  return out
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const html: string[] = []
  let i = 0

  const isBlank = (l: string) => l.trim() === ''

  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (line.trimStart().startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳过结束的 ```
      html.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    if (isBlank(line)) {
      i++
      continue
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      html.push(`<h${level}>${inline(escapeHtml(h[2].trim()))}</h${level}>`)
      i++
      continue
    }

    // 分割线
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      html.push('<hr/>')
      i++
      continue
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      html.push(`<blockquote>${inline(escapeHtml(buf.join(' ')))}</blockquote>`)
      continue
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      html.push('<ul>' + buf.map((b) => `<li>${inline(escapeHtml(b))}</li>`).join('') + '</ul>')
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      html.push('<ol>' + buf.map((b) => `<li>${inline(escapeHtml(b))}</li>`).join('') + '</ol>')
      continue
    }

    // 段落（连续非空行合并）
    const buf: string[] = [line]
    i++
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('```') &&
      !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    html.push(`<p>${inline(escapeHtml(buf.join(' ')))}</p>`)
  }

  return html.join('\n')
}
