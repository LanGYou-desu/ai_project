// 确定性随机数：头像渐变、壁纸点缀、fuzz 测试都用它（同种子必然同结果）
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededRng(key: string): () => number {
  return mulberry32(fnv1a(key))
}

/** 由字符串派生一对稳定的渐变颜色（用于头像/封面） */
export function seededColors(key: string): [string, string] {
  const rng = seededRng(key)
  const h1 = Math.floor(rng() * 360)
  const h2 = (h1 + 40 + Math.floor(rng() * 80)) % 360
  const c = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`
  return [c(h1, 78, 62), c(h2, 72, 46)]
}
