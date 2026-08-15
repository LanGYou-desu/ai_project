# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

「AI 编译器」：桌面应用（Electron），把编辑器内容通过 OpenAI 兼容 API 发给 AI 模拟运行，输出流式显示在编辑器内置终端。Electron 主进程（`main.js`）内嵌 Express 后端，桌面窗口加载的即是前端页面。VSCode 布局 + 真实文件系统工作区（资源管理器 / 多文件 tab）+ 合并 AI 助手（提问/生成）。开发期设计文档与实现计划不随仓库分发。

## 常用命令

- `npm start` — 启动 Electron 桌面应用（内嵌后端，端口见启动日志）
- `npm run server` — 只起后端，浏览器访问 http://127.0.0.1:3000（调试前端用；文件系统功能仅桌面版可用）
- `npm test` — 运行后端单元测试（Node 内置 `node --test`，mock 上游，无需真实密钥）
- `npm run release` — 打包发布：electron-builder 产出 `release/AI编译器 Setup x.x.x.exe`（Windows 安装程序）
- 双击 `启动.bat` — 一键启动：自动装依赖 + `npm start`
- 首次使用：`cp .env.example .env`，填入 `BASE_URL` / `API_KEY` / `MODEL`（或直接在设置页填写）

## 架构

- `main.js` — Electron 主进程：`startServer()` 用 `loadConfig(configPath)` + `createApp(config, { configPath })` 启动内嵌后端，其中 `configPath` 按 `app.isPackaged` 分流（打包版 `app.getPath('userData')/config.json`，开发版项目目录 `config.json`）；端口被占用时自动 +1 顺延（`EADDRINUSE`，最多 5 次），再开 `BrowserWindow`（`contextIsolation: true`、`nodeIntegration: false`、预加载 `preload.js`）加载 `http://127.0.0.1:<port>`；绑定 127.0.0.1，仅本机访问。`registerFsHandlers()` 注册 10 个 `fs:*` IPC handler（open-folder / get-workspace / list-dir / read-file / write-file / create-file / delete-file / rename / create-dir / delete-dir），另注册 `shell:open-external`（仅 http/https 协议，用 `shell.openExternal` 开 markdown 外链）；每个都用 `isTrustedSender()`（仅 127.0.0.1 / localhost 来源）校验发送者 + `resolveInWorkspace()` 路径防护；工作区根路径持久化到 userData/`workspace.json`，下次启动恢复。`before-input-event` 拦截 Ctrl/Cmd+W（`app:ctrl-w` 转发渲染层：有 tab 关 tab，无 tab 关窗），避免默认菜单直接关窗。
- `preload.js` — 通过 `contextBridge` 暴露 `window.fs`（Electron 文件系统 IPC 契约）：`openFolder()`、`getWorkspace()`、`listDir(rel)`、`readFile(rel)`、`writeFile(rel, content)`、`createFile(rel)`、`deleteFile(rel)`、`rename(rel, newName)`、`createDir(rel)`、`deleteDir(rel)`；另暴露 `window.shell.openExternal(url)` 与 `window.appEvents.onCtrlW(cb)`。全部返回 `{ ok, ... }` 或 `{ ok: false, error }`。浏览器模式没有 `window.fs` / `window.shell` / `window.appEvents`，前端使用前需判空。
- `workspace-security.js` — 路径防护：导出 `resolveInWorkspace(root, rel)`，把相对路径 `rel` 解析到工作区根 `root` 内，越界返回 `null`。所有 `fs:*` handler 与单元测试都依赖它。
- `server.js` — Express 后端：静态托管 `public/` + AI 流式端点 `POST /api/run` / `/api/explain` / `/api/generate` / `/api/fix` / `/api/chat` + `GET/PUT /api/config`（读写 config.json）+ `POST /api/test-config`（测试连接）。5 个 AI 端点共享 `streamCompletions(config, messages, req, res)` 代理上游 `/chat/completions`（stream:true）SSE 透传。导出 `createApp(config, opts)`、`buildSystemPrompt(language)`、`loadConfig(configPath?)`、`saveConfig(config, configPath?)`、`streamCompletions`；`require.main === module` 时才监听端口。
- `public/index.html` / `public/style.css` / `public/markdown.js` / `public/output.js` / `public/explorer.js` / `public/editor.js` / `public/preview.js` / `public/assistant.js` / `public/settings.js` — 前端：Monaco（CDN 引入，无需构建）、VSCode 布局（活动栏 / 侧栏 / 底部面板 / 状态栏，图标一律 codicon）、语言切换、SSE 流式终端渲染、设置面板（读 `/api/config`、写 `/api/config`、测 `/api/test-config`）。
- `public/markdown.js` — 零依赖轻量 Markdown 渲染：`renderMarkdown(text)`（标题/列表/引用/代码块/粗斜体/行内代码/http(s) 链接，所有文本先 HTML 转义防注入）+ `copyText`（代码块复制）+ 全局事件（复制按钮、外链经 `window.shell.openExternal` 或 `window.open`）。
- `public/preview.js` — 右侧边栏 Markdown 预览：`isMarkdownFile(rel)` 识别 .md/.markdown/.mdown/.mkd；点击 md 文件 `openPreviewFor` 自动切到预览 tab；编辑器输入 `previewOnEdit` 防抖实时刷新（内容取自打开中的 tab model，无需保存）；`showSideTab` 管理右侧栏「AI 助手 / 预览」两个 side-tab 与活动栏高亮。
- `public/output.js` — 共享前端逻辑：`parseSse`（SSE 缓冲解析）/ `streamRequest`（流式请求）/ `appendOutput` `clearOutput` `setOutputTab`（底部面板终端/解释/修复 tab）/ `switchPanel` `toggleTerminal`（活动栏侧栏）/ `setSidebarWidth` `initSplitter`（分隔条拖拽调宽，宽度持久化 localStorage）/ `setStatusModel` `setStatusLang` `setStatusCursor`（状态栏）/ `setLastError` `getLastError`（错误上下文，供修复）。
- `public/explorer.js` — 左侧资源管理器：`renderTree`/`renderDir` 递归渲染目录树、文件夹展开/折叠、点文件 `window.fs.readFile` 后 `openFileInEditor` 打开；新建 / 刷新 / 删除走 `fs:*`；`window.fs` 不存在时显示「文件系统仅桌面版可用（启动.bat / npm start）」提示。
- `public/editor.js` — 编辑器与 tab 系统：`openTabs`（{ rel, model, language, dirty }）+ `currentTab`，`openFileInEditor` / `switchTab` / `closeTab` / `closeOtherTabs` / `closeAllTabs` / `currentTabLanguage()`；dirty 以「•」标记且就地更新（不重建 tab 栏），tab 右键菜单（保存/关闭/关闭其他/关闭全部）；Ctrl+S 保存 `saveTab`（`window.fs.writeFile`），未命名缓冲 Ctrl+S 走 `saveUntitledAs` 另存为文件；`runCode` 循环支持交互式 stdin（`waitForTerminalInput`，`[需要输入]` 触发，输出按 rAF 批处理去标记），`history` 回传 `/api/run`，结束显示耗时；`explainCode`、`btn-fix` 修复流程；`applyFontSize` 应用设置页字号；Ctrl/Cmd+W 关 tab（桌面版经 `appEvents.onCtrlW`）。语言预设 `LANGUAGES` 与后端白名单一致。
- `public/assistant.js` — 合并 AI 助手面板：`assistantMode` 在「提问代码」（ask，走 `/api/chat`，带代码上下文 + `askHistory` 多轮历史）与「生成代码」（gen，走 `/api/generate`）间切换；流式回答 markdown 渲染按 rAF 节流，`asstAbort` + 「停止生成」按钮可中止；`stripCodeFences` 提取 markdown 代码块，`applyCode()` 经 `setCode` 应用到编辑器。
- `test/api.test.js` — Node `node:test` 测试，用真实 HTTP mock 上游验证代理行为。
- `test/workspace-security.test.js` — `resolveInWorkspace` 路径越界防护单元测试。

## 关键约定

- 语言：CommonJS；无前端构建工具；错误提示统一显示在终端面板，不弹窗。
- 界面零 emoji，图标一律用 codicon（VSCode 风格布局，见 `index.html` 中 `codicon codicon-*`）。
- 语言 id：python / javascript / typescript / c / cpp / java / go，各配示例模板（见 `editor.js` 中 `LANGUAGES`）。
- **文件系统功能仅桌面版（Electron `window.fs`，由 `preload.js` 暴露）；浏览器模式（`npm run server`）无 `window.fs`，资源管理器显示「文件系统仅桌面版可用」提示，其余功能照常。**
- 所有 `fs:*` IPC 都要过 `isTrustedSender()`（仅 127.0.0.1 / localhost 来源）与 `resolveInWorkspace()`（越界返回 null，绝不落到工作区外）。
- 配置优先级：`config.json`（设置页写入，含密钥）→ 缺失字段回退 `.env`；新增配置项时同步更新 `.env.example` 与 README 表格。
- `config.json` 含密钥（apiKey），**绝不提交 git**（已在 `.gitignore`）。
- 打包版（`app.isPackaged`）配置写入 `%APPDATA%\ai-compiler\config.json`（`app.getPath('userData')`，目录名取自 package.json 的 `name`），开发版写入项目目录。
- `npm run release` 需在 Windows 主机构建，且需开启「开发者模式」、以管理员身份运行、或已预置 electron-builder 缓存——否则 winCodeSign 因缺少符号链接权限（`SeCreateSymbolicLinkPrivilege`）而失败；产出安装包未签名，首次运行有 SmartScreen 提示。
- 端口改动下次启动生效；端口被占用时 main.js 会自动顺延（`EADDRINUSE` 最多 +5）。
- 后端绑定 `127.0.0.1`，仅本机可访问。
- 流式链路：前端 fetch → `/api/run|explain|generate|fix|chat` → 后端 `streamCompletions` → 上游 `/chat/completions`（stream:true）→ 上游 SSE 逐块透传 → 前端 `parseSse` / `streamRequest` 解析 `data:` 行取 `choices[0].delta.content` 追加到终端/面板。
- 交互式 stdin：`/api/run` 返回「[需要输入]」时，前端 `waitForTerminalInput` 暂停等待用户输入，随后带 `history` 继续同一次模拟运行。
