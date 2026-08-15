# AI Project 合集

> 一个包含多个**相互独立实战项目**的代码仓库（monorepo 风格）。目前收录两个项目：桌面端「AI 编译器」与网页端「赛博安全学院」。

| GitHub | https://github.com/LanGYou-desu/ai_project |
| ------ | ------------------------------------------ |

## 📁 项目总览

| 项目 | 类型 | 一句话介绍 | 技术栈 |
| ---- | ---- | ---------- | ------ |
| [ai_compiler](./ai_compiler/) | Electron 桌面应用 | 把编辑器代码发给 AI「模拟运行」，AI 输出流式显示在内置终端里的 AI 编译器 | Electron + Express + Monaco Editor + electron-builder |
| [cyber-academy](./cyber-academy/) | Web 应用 + 本地靶场 | 面向零基础到进阶的网络安全训练营：课程 → 示例 → 关卡 → 挑战 → 真实本地靶场 → 命令行工具链 | 原生 HTML/CSS/JS + Node.js（零第三方依赖） |

## 🌳 目录结构

```
ai_project/
├── ai_compiler/            # AI 编译器（Electron 桌面应用）
│   ├── main.js             # Electron 主进程
│   ├── server.js           # 后端服务（Express + AI 代理）
│   ├── public/             # 前端界面（Monaco 编辑器、资源管理器、终端…）
│   ├── test/               # 后端单元测试
│   ├── release/            # 打包产物（仅 *.exe 安装包入库）
│   └── 启动.bat            # 双击一键启动
└── cyber-academy/          # 赛博安全学院（网络安全训练营）
    ├── server.js           # 游戏 + 靶场服务（原生 Node http，零依赖）
    ├── index.html          # 纯前端入口（双击可直接玩网页版）
    ├── js/                 # 课程 / 关卡 / 挑战 / 靶场 / 工具前端逻辑
    ├── lab/                # 本地靶场引擎（SQL 注入 / 命令注入 / 越权 / 路径穿越）
    ├── tools/              # 真实命令行安全工具（扫描器 / 爆破器 / 抓包分析…）
    ├── practice/           # 练习素材（运行 make-practice.js 自动生成）
    ├── test/               # 冒烟 / 单元 / 玩法回归测试
    └── start.ps1           # 一键启动（生成素材 → 起游戏+靶场 → 开浏览器）
```

## 🚀 快速开始

### ai_compiler（AI 编译器）

```bash
cd ai_compiler
npm install          # 首次安装依赖（含 Electron）
npm start            # 或直接双击 启动.bat
```

首次打开后到「设置」页填写 OpenAI 兼容接口（如 DeepSeek）的地址 / 密钥 / 模型，即可让 AI 模拟运行编辑器中的代码，还支持 AI 提问、生成代码、代码解释、错误自动修复、Markdown 预览等功能。

### cyber-academy（赛博安全学院）

```powershell
cd cyber-academy
.\start.ps1          # 自动：生成练习素材 → 启动游戏+靶场 → 打开浏览器
```

或手动启动：`node server.js`（游戏 http://localhost:8080，靶场 http://127.0.0.1:8090）；只想玩网页版可直接双击 `index.html`（纯前端零依赖）。

## 📝 仓库约定

- **两个项目相互独立**：各自维护代码、文档与依赖，不互相引用。
- **release 目录只跟踪 `*.exe` 安装包**：`latest.yml`、`*.blockmap` 等 electron-builder 自动生成的构建产物一律忽略，防止每次打包产生无关改动。
- **敏感与依赖文件不入库**：`node_modules/`、`.env` / `config.json`（含 API 密钥）、`.superpowers/`、AI 助手说明文件（`AGENTS.md` / `CLAUDE.md`）等均已加入 `.gitignore`。
- **练习素材可再生成**：cyber-academy 的 `practice/`、`lab/downloads/` 等由 `node make-practice.js` 生成，不入库。

## 📚 更多

- [ai_compiler 详细文档](./ai_compiler/README.md)
- [cyber-academy 详细文档](./cyber-academy/README.md)
