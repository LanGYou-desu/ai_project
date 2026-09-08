# AI 编译器

一个桌面「AI 编译器」：把编辑器内容通过 API 发送给 AI（OpenAI 兼容接口），AI 扮演解释器模拟运行，输出流式显示在编辑器内置终端中。

- 技术栈：Electron（主进程 `main.js`）+ Express 后端（`server.js`）+ 原生前端（`public/`，Monaco 编辑器从 CDN 加载）
- 版本：1.2.0（`package.json`）
- 测试：85 个用例，`npm test`（`node --test`，全部通过）

## 特性

- VSCode 布局桌面应用（Electron + Monaco）：活动栏 / 侧栏 / 底部面板 / 状态栏，图标全部使用 codicon（无 emoji）
- 支持 Python / JavaScript / TypeScript / C / C++ / Java / Go 语法高亮与示例模板
- 真实文件系统工作区（仅桌面版）：资源管理器侧栏浏览 / 新建 / 刷新 / 删除文件夹与文件，双击打开
- **资源管理器右键菜单**：新建文件 / 新建文件夹 / 重命名 / 递归删除文件夹 / 展开折叠（桌面版）
- 可拖拽调宽的双侧栏与可调高度的底部面板，宽度/高度记忆（localStorage）
- 多文件编辑器 tab：打开文件自动新建 tab，Ctrl+S / 保存按钮保存，未保存文件以「•」标记；关闭窗口时提醒未保存
- 点「运行」→ AI 模拟运行 → 结果流式输出到终端；程序需要输入时可在终端内交互输入（AI 输出 `[需要输入]` 后等待终端输入）
- **终端工具栏**：自动滚动开关 / 复制输出 / 清空面板
- **AI 输出 Markdown 渲染**：聊天、解释、修复面板渲染标题 / 列表 / 引用 / 代码块（带「复制」按钮）/ 外链点击打开
- **Markdown 文件预览**：点击资源管理器中的 `.md` 文件，右侧边栏自动渲染预览（编辑器输入实时刷新，Monaco 同时启用 markdown 语法高亮）；活动栏「预览」图标或侧栏顶部 tab 可手动切换
- 合并 AI 助手：右侧面板「提问代码 / 生成代码」一键切换，生成结果可「应用到编辑器」（见下文「AI 功能」）
- 代码解释 / 错误自动修复（见下文「AI 功能」）
- 内置设置页：界面内配置接口地址 / 密钥 / 模型 / 温度 / 最大输出长度 / 编辑器字号 / 端口（端口下次启动生效）
- 快捷键：Ctrl+Enter 运行 / Ctrl+S 保存（未命名缓冲按 Ctrl+S 可另存为文件）/ Ctrl+W 关闭当前 tab / Ctrl+` 终端 / Ctrl+B 资源管理器 / Esc 关闭设置或右键菜单
- 编辑器 tab 右键菜单：保存 / 关闭 / 关闭其他 / 关闭全部
- 双击「启动.bat」一键启动

> 文件系统相关功能（工作区 / 资源管理器 / 多文件 tab / 保存 / 右键菜单）仅在桌面版可用（双击 `启动.bat` 或 `npm start`）；浏览器模式（`npm run server`）下资源管理器面板会显示「文件系统仅桌面版可用」提示，其余功能照常。

> Monaco 编辑器（含 codicon 图标字体）从 `cdn.jsdelivr.net` 加载，首次打开需要能访问外网；离线环境下编辑器与图标不可用（其余功能不受影响）。

## AI 功能

- **AI 助手**：点击活动栏「助手」图标打开右侧 AI 助手面板，内置两种模式，一键切换：
  - **提问代码**：基于当前代码向 AI 提问（自动携带语言与代码上下文），支持多轮对话历史（前端保留最近 24 条，后端同样截断到 24 条）。
  - **生成代码**：用自然语言描述需求，AI 生成代码显示在面板下方，点「应用到编辑器」覆盖写入当前编辑器。
- **代码解释**：编辑器标题栏「解释」按钮，AI 逐段讲解代码（结果在底部面板「解释」tab）。
- **错误自动修复**：运行报错后切到「修复」tab，点「让 AI 修复」，AI 给出修复代码，点「应用修复」写入编辑器。

## 快速开始

```bash
npm install            # 首次：装依赖（含 Electron）
双击 启动.bat          # 或 npm start
```

首次打开后，点击活动栏「设置」图标填写接口地址 / API 密钥 / 模型，点「测试连接」验证，再点「保存」。之后点「运行」即可让 AI 模拟运行编辑器里的代码。

## 配置

优先读项目内 `config.json`（设置页写入，含密钥，已被 `.gitignore` 忽略），缺失字段回退 `.env`。

| 字段 | 说明 | 示例 |
| ---- | ---- | ---- |
| baseUrl | OpenAI 兼容接口地址，必须以 `http://` 或 `https://` 开头 | `https://api.deepseek.com/v1` |
| apiKey | 你的密钥（`GET /api/config` 不回显，仅返回 `hasApiKey`） | `sk-...` |
| model | 模型名 | `deepseek-chat` |
| port | 端口（下次启动生效，默认 3000；非法值回退 3000） | `3000` |
| temperature | 采样温度 0-2（留空 = 模型默认；设置页清空可清除已保存值） | `1.0` |
| maxTokens | 单次最大输出 token 数（留空 = 模型默认；同上可清除） | `4096` |
| fontSize | 编辑器字号 9-32（留空回退默认 14） | `16` |

`.env` 回退变量（`config.json` 未提供的字段从这里取）：`BASE_URL` / `API_KEY` / `MODEL` / `PORT` / `TEMPERATURE` / `MAX_TOKENS` / `EDITOR_FONT_SIZE`，参考 `.env.example`。`.env` 只在开发模式（`npm start` / `npm run server`）读取，且固定读取项目目录下的 `.env`（与启动时的工作目录无关）；打包版不读取 `.env`。

地址会做规范化：自动去掉末尾斜杠、去掉重复的 `/chat/completions` 后缀（因此 `https://api.deepseek.com/v1/` 与 `https://api.deepseek.com/v1` 等价），保留 query 参数（兼容 Azure 的 `api-version`）。

## 安全与滥用防护

后端只监听 `127.0.0.1`，且做了以下约束（详见 `server.js`）：

- **密钥不回显**：`GET /api/config` 只返回 `hasApiKey`，永远不返回密钥本身。
- **密钥不外泄**：`POST /api/test-config` 在请求未带密钥时，只有当地址与已保存的 `baseUrl` 一致才会复用已保存的密钥；测试任意新地址必须显式填写密钥，避免本机页面把密钥转发到第三方地址。
- **SSRF 限制**：接口地址只允许 `http`/`https`（拒绝 `file://` 等），拒绝带用户名密码的 URL；链路本地地址（`169.254.0.0/16`、`fe80::/10`，云元数据）直接拒绝；本机与内网地址仍允许（Ollama / 局域网网关是合法用法）。
- **来源校验**：`/api/*` 校验 `Origin` 与 `Host`，只接受 `127.0.0.1` / `localhost` / `::1`，防止跨站页面或 DNS rebinding 盗用你的 API 额度。
- **输入上限**：请求体 4MB；代码 ≤ 200000 字符；提问 / 需求 / 报错文本 ≤ 32000 字符；历史消息单条 ≤ 100000 字符、总计 ≤ 400000 字符、最多 24 条。超限返回 413。
- **并发上限**：同时进行的上游请求最多 4 个，超出返回 429。
- **超时与重试**：连接 / 首字节超时 30s（超时返回 504），流式空闲超时 60s（返回 SSE 错误事件）；连接阶段失败（未收到响应头）自动重试 1 次。
- **错误不泄露内部信息**：非法 JSON 请求体、请求体过大、未知 `/api` 路径、未捕获异常都返回 JSON，不带 HTML 错误页或堆栈。
- **安全响应头**：`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`Content-Security-Policy: object-src 'none'; base-uri 'self'; frame-ancestors 'none'`（未设置 `default-src`，以免阻断 Monaco CDN）。
- **工作区边界**：桌面版所有文件操作都先做词法路径校验，再做 realpath 校验——工作区内的符号链接 / 目录联接（junction）指向工作区外时会被拒绝；单文件读取上限 5MB。
- **配置落盘**：`config.json` 采用「临时文件 + rename」原子写入，权限 `0600`（非 Windows），避免写入中断产生半截配置。

> `config.json` 明文保存密钥，已被 `.gitignore` 忽略；不要用 `git add -f` 提交它，也不要把它复制到仓库其他位置。若怀疑泄露，请立刻到服务商后台轮换密钥。

## 发布 / 打包

给没有 Node 环境的用户分发：用 electron-builder 打包成 Windows 安装程序（内嵌运行时，无需安装 Node）。

```bash
npm run release  # 产出 release/AI编译器 Setup 1.2.0.exe
```

安装包特性：
- NSIS 向导式安装，可自定义安装目录
- 安装后开始菜单/桌面快捷方式启动
- 配置文件写入 `%APPDATA%\ai-compiler\config.json`（可写，权限受限）
- 未签名安装包首次运行有 SmartScreen 提示：点「更多信息 → 仍要运行」

> 仓库里当前跟踪的安装包是 `release/AI编译器 Setup 1.0.0.exe`（历史产物）；`package.json` 版本为 1.2.0，重新执行 `npm run release` 会产出 1.2.0 的安装包。`.gitignore` 只放行 `release/*.exe`。

构建环境要求：`npm run release` 需在 Windows 主机上执行，且需开启「开发者模式」、以管理员身份运行、或已预置 electron-builder 缓存——否则 winCodeSign 会因缺少符号链接权限（`SeCreateSymbolicLinkPrivilege`）而构建失败。

## 开发 / 调试

```bash
npm run server   # 只起后端，浏览器访问 http://127.0.0.1:3000（注意：文件系统功能仅桌面版）
npm test         # 后端 + 前端核心单元测试（mock 上游，无需真实密钥）
```

`npm test` = `node --test`，当前 85 个用例全部通过：

| 测试文件 | 用例数 | 覆盖内容 |
| ---- | ---- | ---- |
| `test/api.test.js` | 28 | 配置读写、语言白名单、history 组装与截断、上游错误转发、流式透传、各 AI 端点 |
| `test/security.test.js` | 17 | baseUrl 规范化、密钥不外泄、SSRF / 元数据地址拦截、Origin/Host 校验、请求体与字段上限、并发上限、安全响应头 |
| `test/upstream.test.js` | 14 | 非流式 JSON 转 SSE、连接失败重试、连接 / 空闲超时、端口校验、原子写配置、history 清洗、端到端 SSE 解析 |
| `test/frontend-core.test.js` | 18 | `public/sse.js` 的 SSE 解析（分片 / CRLF / 错误事件 / 兜底）与 `public/markdown-core.js` 的渲染转义（注入防护） |
| `test/workspace-security.test.js` | 8 | 工作区路径词法校验 + realpath 校验（拒绝符号链接 / 目录联接逃逸） |

## 项目结构

```
main.js                  Electron 主进程：窗口、IPC 文件操作（工作区边界校验）、后端启动
preload.js               contextBridge 暴露 window.fs / window.shell / window.appEvents
server.js                Express 后端：配置读写、AI 代理（SSE 转发）、输入与并发限制
workspace-security.js    工作区路径解析（词法 + realpath 双重校验）
public/index.html        VSCode 风格界面骨架
public/sse.js            SSE 解析核心（纯函数，Node 可直接 require 测试）
public/markdown-core.js  Markdown 渲染核心（纯函数，先转义再套标记）
public/markdown.js       代码块复制与外链打开的 DOM 行为
public/output.js         底部面板、流式请求、面板/侧栏布局与拖拽
public/editor.js         Monaco 编辑器、多 tab、运行 / 解释 / 修复流程
public/explorer.js       资源管理器树与右键菜单
public/preview.js        Markdown 预览面板
public/assistant.js      AI 助手（提问 / 生成）
public/settings.js       设置面板
test/                    node --test 用例（见上表）
```

## 已知限制

- 编辑器依赖 CDN（Monaco + codicon），离线不可用。
- 「修复」面板的请求没有独立的停止按钮（运行与解释共用「停止」）。
- 上游请求按 SSE 单向转发，断线不会自动续传；中断后需要重新点「运行」。
- 打包版不读取 `.env`，配置只来自 `%APPDATA%\ai-compiler\config.json`。
- 安装包未签名，首次运行会出现 SmartScreen 提示。
