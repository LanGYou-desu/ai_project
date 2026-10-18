// 文件剪贴板：模块级单例，在所有文件窗口之间共享（模拟系统级剪贴板）
export interface FileClip {
  mode: 'copy' | 'cut'
  path: string
}

let clip: FileClip | null = null

export function getFileClip(): FileClip | null {
  return clip
}

export function setFileClip(v: FileClip | null): void {
  clip = v
}
