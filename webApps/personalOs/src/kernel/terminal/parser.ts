// 命令行解析：支持引号、转义与 > / >> 重定向
export interface ParsedCmd {
  argv: string[]
  redirect?: { mode: '>' | '>>'; target: string }
}

export function parseCommandLine(line: string): ParsedCmd | null {
  const argv: string[] = []
  let cur = ''
  let tokenStarted = false
  let quote: '"' | "'" | null = null
  let redirectMode: '>' | '>>' | null = null

  const flush = () => {
    if (tokenStarted || cur !== '') argv.push(cur)
    cur = ''
    tokenStarted = false
  }

  const chars = [...line]
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      tokenStarted = true
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      continue
    }
    if (ch === '\\' && i + 1 < chars.length) {
      cur += chars[++i]
      tokenStarted = true
      continue
    }
    if (ch === ' ' || ch === '\t') {
      flush()
      continue
    }
    if (ch === '>') {
      flush()
      if (chars[i + 1] === '>') {
        redirectMode = '>>'
        i++
      } else {
        redirectMode = '>'
      }
      continue
    }
    cur += ch
    tokenStarted = true
  }
  flush()

  if (argv.length === 0) return null

  if (redirectMode) {
    const target = argv.pop()
    if (!target || argv.length === 0) return null
    return { argv, redirect: { mode: redirectMode, target } }
  }
  return { argv }
}
