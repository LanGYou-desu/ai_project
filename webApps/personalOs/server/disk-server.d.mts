// disk-server.mjs 的手写类型声明（供 vite.config / 测试 / svelte-check 使用）
import type { IncomingMessage, ServerResponse } from 'node:http'

/** 镜像尺寸（字节）：512 字节 × 512 块 = 256 KiB */
export const IMAGE_SIZE: number
/** 镜像 magic（ASCII，写在字节 0 起） */
export const MAGIC: string

/** 创建「磁盘控制器」HTTP 处理器；dir 为镜像所在目录（相对项目根） */
export function createDiskHandler(options?: { dir?: string }): (req: IncomingMessage, res: ServerResponse) => void
