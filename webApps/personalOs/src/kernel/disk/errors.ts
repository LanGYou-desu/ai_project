// 磁盘错误码：统一内核侧的 errno 风格错误
export type DiskErrorCode =
  | 'ENOENT' // 文件或目录不存在
  | 'EEXIST' // 已存在
  | 'ENOTDIR' // 不是目录
  | 'EISDIR' // 是目录
  | 'ENOTEMPTY' // 目录非空
  | 'ENOSPC' // 磁盘空间不足
  | 'EINVAL' // 参数不合法
  | 'EPERM' // 权限不足
  | 'ECORRUPT' // 文件系统损坏

export class DiskError extends Error {
  constructor(
    public code: DiskErrorCode,
    msg: string,
  ) {
    super(msg)
    this.name = 'DiskError'
  }
}

export function errnoText(code: DiskErrorCode): string {
  switch (code) {
    case 'ENOENT':
      return '文件或目录不存在'
    case 'EEXIST':
      return '同名文件已存在'
    case 'ENOTDIR':
      return '不是目录'
    case 'EISDIR':
      return '是一个目录'
    case 'ENOTEMPTY':
      return '目录非空'
    case 'ENOSPC':
      return '磁盘空间不足'
    case 'EINVAL':
      return '参数不合法'
    case 'EPERM':
      return '权限不足（试试 sudo）'
    case 'ECORRUPT':
      return '文件系统损坏'
  }
}
