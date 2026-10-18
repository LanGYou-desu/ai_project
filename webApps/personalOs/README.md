# personalOs · 我的个人操作系统

把个人网站做成一台"可以开机、可以折腾的电脑"：桌面、窗口、文件夹、终端、音乐播放器，
外加一块放在项目目录里、可以从浏览器真实读写的 256 KiB 虚拟磁盘。

打开它，你看到的不是一张名片，而是一台小小的电脑。

## 快速开始

Windows 用户：双击 `start.bat`（纯 ASCII 文本、无 BOM，任何控制台代码页下都不会乱码）。首次会自动 `npm install`，然后打开浏览器（http://localhost:5180）。

手动方式：

```bash
npm install
npm run dev            # 开发模式（自动打开 http://localhost:5180）
npm test               # 运行全部测试（114 个）
npm run check          # 类型检查（svelte-check，0 错误 0 警告）
npm run build          # 构建 + 生成种子磁盘镜像
npm start              # 生产模式：静态产物 + 磁盘 API（http://localhost:5180）
```

要求 Node 20 以上。没有其余系统依赖。

## 里面有什么

- 桌面 + 菜单栏 + Dock + 启动器（Ctrl/Cmd+K）；快捷键对齐 Windows 习惯（见下表）
- 窗口：拖拽、八向缩放、贴边吸附（左/右半屏、顶部最大化）、双击标题栏最大化；旋转屏幕/改窗口尺寸后窗口自动拉回屏内
- 九个应用：关于我、项目、联系、文件、终端、音乐、系统设置、任务管理器、记事本
- 真终端：`ls` `cat` `cd` `df` `fsck` `neofetch` `dmesg` 等 30 个命令，支持 `>` `>>` 重定向与 Tab 补全
- 程序化 chiptune 音乐播放器（WebAudio 合成，频谱可视化）
- 虚拟磁盘：FAT-lite 文件系统，镜像就是磁盘上的 `disk/disk.img`
- 外观：玻璃拟态，暗/亮双主题 + 四种壁纸（多层光斑、斜向光带、细颗粒噪点与暗角）；图标全部为自绘 SVG 且带景深高光与外投影；Dock 悬停"邻居联动"放大、非活动窗口交通灯变灰、窗口带位移动画入场；界面无 emoji
- 移动端与触屏：刘海屏安全区、小屏收窄的 Dock/桌面图标、加大的触控热区与缩放把手，触屏单击图标即打开
- PWA：带 manifest 与离线外壳（Service Worker 只在生产构建注册），手机可"添加到主屏幕"后全屏运行
- 健壮性：应用崩溃被隔离在窗口内（可一键重试），未捕获异常写进内核日志并弹出提示；锁屏后窗口与磁盘状态原样保留
- 文件管理器：Ctrl+C/X/V 剪贴板（复制自动避让重名、跨窗口共享），支持按名称/大小/时间排序
- 终端：命令历史跨会话持久化到磁盘，回滚缓冲有上限保护

## 快捷键（对齐 Windows 习惯）

浏览器与操作系统会截走一部分按键（Alt+F4、Win 组合、Ctrl+W 等），这里映射了可拦截的子集：

| 按键 | 作用 | Windows 对应 |
| --- | --- | --- |
| Alt+Tab / Alt+Shift+Tab | 切换窗口 / 反向切换 | 一致 |
| Alt+W / Alt+M | 关闭 / 最小化当前窗口 | Alt+F4 与 Win+向下为系统占用，改用此键位 |
| Ctrl+Alt+左 / 右 | 贴左半屏 / 贴右半屏 | Win+左 / 右 |
| Ctrl+Alt+上 / 下 | 最大化 / 还原（未最大化则最小化） | Win+上 / 下 |
| Ctrl+Alt+D | 显示桌面 / 再按恢复全部窗口 | Win+D |
| Ctrl+Alt+L | 锁定屏幕（解锁后窗口原样保留） | Win+L |
| F1 | 打开「关于我」 | F1 帮助 |
| Ctrl/Cmd+K | 启动器（搜索应用与磁盘文件） | Win 键为系统占用，改用此键位 |
| Esc | 关闭菜单 / 取消选择 | 一致 |

应用内快捷键（同样对齐 Windows）：

| 按键 | 应用 | 作用 |
| --- | --- | --- |
| F2 / Delete / Enter / Backspace / F5 | 文件 | 重命名 / 删除 / 打开 / 上一级 / 刷新 |
| Ctrl+C / Ctrl+X / Ctrl+V | 文件 | 复制 / 剪切 / 粘贴（跨窗口共享剪贴板） |
| Ctrl+S / Ctrl+Shift+S | 记事本 | 保存 / 另存为 |
| Ctrl+L | 终端 | 清屏 |
| Ctrl+C | 终端 | 有选中文本则复制，否则发送中断（同 Windows Terminal） |
| 空格 | 音乐 | 播放 / 暂停 |
| 右键点击 | 桌面 / Dock 图标 / 文件行 / 窗口标题栏 | 桌面菜单 / 应用菜单 / 文件菜单 / 窗口系统菜单 |

应用内快捷键只在该窗口聚焦时生效，且不会抢输入框与按钮的键盘操作。

## 虚拟磁盘

系统里的一切（配置、会话、你的文件）都住在虚拟磁盘上：

- 容量 256 KiB（512 块 × 512 字节），格式为项目自带的 FAT-lite（见 [DISK.md](./DISK.md)）
- 在终端里写文件，关掉浏览器再打开，文件还在
- 删除 `disk/disk.img` 后刷新页面，系统会自动格式化并重新"装机"
- 终端运行 `fsck` 检查磁盘，`fsck -y` 自动修复；设置应用里还能备份、回滚、导出、导入镜像

磁盘有四种工作模式，按环境自动选择：

| 模式 | 触发条件 | 能力 |
| --- | --- | --- |
| http | 有伙伴服务器（`npm run dev` 或 `npm start`） | 读写 `disk/disk.img`，带乐观锁与自动备份 |
| static | 纯静态托管（如 GitHub Pages） | 只读基础盘 + 浏览器本地暂存 |
| local | 服务器不可用但浏览器可用 | 读写 localStorage 镜像 |
| memory | 无持久化环境（如单元测试） | 内存盘 |

## 项目结构

```
src/
  boot/          开机自检
  kernel/        内核：wm（窗口管理）、router、disk（块设备/超级块/FAT/fsck）、vfs、proc、syscall、eventbus、log、clock
  drivers/       disk-http（伙伴服务器/本地/静态/内存四种持久化）、audio、input
  services/      installer（装机）、session（会话）、search、theme
  shell/         桌面壳：BootScreen、LoginScreen、菜单栏、Dock、启动器、窗口框、右键菜单、Toast
  apps/          九个应用 + 应用注册表
  ui/            自绘 SVG 图标（线描字 + 应用瓷砖）
  data/          profile.ts（关于我/项目/联系占位内容）与曲库
server/          disk-server.mjs：零依赖"硬盘控制器"（同时被 dev 与生产复用）
scripts/         disk-sync.ts：构建前生成种子镜像
tools/           disk-dump.ts：离线查看镜像（超级块、目录树、块图、fsck）
tests/           114 个测试，覆盖文件系统、fsck 抢救、装机金样、窗口管理、终端、服务器接口、PWA 外壳等
```

改内容只需要动 `src/data/profile.ts`：关于我、项目列表、联系方式、桌面图标都会跟着变。

## 测试与质量

```bash
npm test
npm run check
```

- 文件系统：读写/跨块/错误码/空间回收/根目录扩容/块归属/递归复制（重名与自嵌套防护、失败清理）
- fsck：FAT 截断、孤儿块、交叉链、自环、校验和损坏、随机位翻转模糊测试（修复后必然一致且幂等）
- 装机：同一时间戳逐字节一致的金样镜像
- 内核：脏位生命周期、崩溃重启自动修复、能力门控（ro/rw/sys）
- 终端：解析器、30 个命令的真文件系统行为、补全
- 服务器：真实 HTTP 走读写/乐观锁 409/备份回滚/参数校验
- 窗口管理：拖拽/缩放夹取、吸附、恢复矩形、视口重排（reflow）、Alt+Tab 环形切换、显示桌面
- PWA：manifest 字段与图标、离线外壳策略（跳过非 GET 与 /api/*）
- 规范：源码零 emoji（图标必须自绘）；svelte-check 类型 0 错误；组件编译冒烟

## 部署

- 带 Node 的服务器：`npm run build && npm start`（静态产物 + 可写磁盘 + 自动备份）
- 纯静态托管：把 `dist/` 整个传上去即可。系统会以只读基础盘启动，改动暂存在浏览器里，可以随时导出镜像
- 支持 PWA：部署后手机浏览器可"添加到主屏幕"，以独立窗口全屏启动；Service Worker 提供离线外壳（网络优先，`/api/*` 永不缓存）

磁盘镜像与备份都不会被提交到 git（见 `.gitignore`），它属于运行时数据。
