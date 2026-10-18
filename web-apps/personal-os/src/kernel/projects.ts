// 项目文件解析：/用户/主人/项目/*.md 的轻量结构
// 约定：# 标题 / > 一句话简介 / 标签: a, b / 链接: url / 其余为正文
export interface Project {
  file: string
  title: string
  summary: string
  tags: string[]
  link?: string
  body: string
}

export function parseProject(file: string, src: string): Project {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  let title = file.replace(/\.md$/i, '')
  let summary = ''
  let link: string | undefined
  let tags: string[] = []
  const bodyLines: string[] = []

  for (const line of lines) {
    const t = line.trim()
    const h = t.match(/^#\s+(.*)$/)
    if (h && title === file.replace(/\.md$/i, '')) {
      title = h[1].trim()
      continue
    }
    const q = t.match(/^>\s*(.*)$/)
    if (q && !summary) {
      summary = q[1].trim()
      continue
    }
    const tagLine = t.match(/^标签[:：]\s*(.*)$/)
    if (tagLine) {
      tags = tagLine[1]
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean)
      continue
    }
    const linkLine = t.match(/^链接[:：]\s*(.*)$/)
    if (linkLine) {
      link = linkLine[1].trim()
      continue
    }
    bodyLines.push(line)
  }

  return {
    file,
    title,
    summary,
    tags,
    link,
    body: bodyLines.join('\n').trim(),
  }
}
