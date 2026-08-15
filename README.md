# AI Project 合集

> 一个包含多个**相互独立实战项目**的代码仓库（monorepo 风格）。目前收录五个项目：桌面端「AI 编译器」、网页端「赛博安全学院」、Python 游戏「DevSaga」以及两款纯前端解谜游戏「NETIME 时光机」与「声音考古学」。

| GitHub | https://github.com/LanGYou-desu/ai_project |
| ------ | ------------------------------------------ |

## 📁 项目总览

| 项目 | 类型 | 一句话介绍 | 技术栈 |
| ---- | ---- | ---------- | ------ |
| [ai_compiler](./ai_compiler/) | Electron 桌面应用 | 把编辑器代码发给 AI「模拟运行」，AI 输出流式显示在内置终端里的 AI 编译器 | Electron + Express + Monaco Editor + electron-builder |
| [cyber-academy](./cyber-academy/) | Web 应用 + 本地靶场 | 面向零基础到进阶的网络安全训练营：课程 → 示例 → 关卡 → 挑战 → 真实本地靶场 → 命令行工具链 | 原生 HTML/CSS/JS + Node.js（零第三方依赖） |
| [devsaga](./devsaga/) | Python 养成游戏 | 程序员职场模拟器：11 种开发环境、79 个任务、33 道课后测验、51 篇知识手册、多结局剧情、11 套专属工作台 UI，边玩边学真实排障 | Python 3.10+ 标准库（零第三方依赖） |
| [netime](./netime/) | Web 解谜游戏 | 「网络时光机」：沿着 1995→2025 五个年代收集时间密钥，破解一桩跨越三十年的旧互联网失踪案（进行中） | 原生 HTML/CSS/JS（纯前端零依赖） |
| [sound-archaeology](./sound-archaeology/) | Web 解谜游戏 | 音频取证解谜：用变速 / 倒放 / 滤波 / 频谱图破译 6 段录音，揭开废弃广播塔沉睡四十年的秘密 | 原生 HTML/CSS/JS + Web Audio API（零依赖，素材内嵌） |

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
├── cyber-academy/          # 赛博安全学院（网络安全训练营）
│   ├── server.js           # 游戏 + 靶场服务（原生 Node http，零依赖）
│   ├── index.html          # 纯前端入口（双击可直接玩网页版）
│   ├── js/                 # 课程 / 关卡 / 挑战 / 靶场 / 工具前端逻辑
│   ├── lab/                # 本地靶场引擎（SQL 注入 / 命令注入 / 越权 / 路径穿越）
│   ├── tools/              # 真实命令行安全工具（扫描器 / 爆破器 / 抓包分析…）
│   ├── practice/           # 练习素材（运行 make-practice.js 自动生成）
│   ├── test/               # 冒烟 / 单元 / 玩法回归测试
│   └── start.ps1           # 一键启动（生成素材 → 起游戏+靶场 → 开浏览器）
├── devsaga/                # DevSaga · 程序员模拟器（Python 游戏）
│   ├── main.py             # 入口（--web / --bot / --grade / --serve 等模式）
│   ├── game/               # 引擎：终端模拟、沙箱、任务、剧情、工作台 WebUI
│   │   └── scenarios/      # 12 个开发场景（终端 / Git / 调试 / SQL / 容器 / 安全…）
│   ├── web/                # 网页版工作台 UI（实时状态面板）
│   ├── examples/           # AI 客户端示例与 RL 训练接口示例
│   ├── tests/              # 核心 / 场景 / WebUI / SQL 虚拟文件系统测试
│   ├── docs/DESIGN.md      # 设计文档
│   └── 启动DevSaga.bat     # 双击一键启动（网页版 / 终端版 / 机器人演示）
├── netime/                 # NETIME 网络时光机（旧互联网考古，进行中）
│   ├── js/story.js         # 剧情数据：年代 / 时间密钥 / 提示链 / 成就
│   ├── js/tools.js         # 工具箱：ROT13 / Base64 / 摩斯电码解码
│   └── start.bat           # 启动脚本（打开 index.html / 运行测试）
└── sound-archaeology/      # LAB-7 声音考古学 · 幽灵频率（音频取证解谜）
    ├── index.html          # 主页面（双击即玩）
    ├── js/                 # 音频合成 / 播放引擎 / 频谱图 / 案件 / 摩斯
    ├── css/style.css       # 暗色实验室主题（CRT 磷光绿）
    ├── tools/              # 语音素材生成（Windows SAPI）与文案
    ├── tests/              # 单元测试（node tests/run.js，50 项）
    └── start.bat           # 一键打开游戏
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

### devsaga（DevSaga · 程序员模拟器）

```bash
cd devsaga
python main.py --web       # 网页版（浏览器打开 http://127.0.0.1:8766）
python main.py             # 终端版（主菜单）
python main.py --bot       # 机器人 10 场景全通关演示
```

Windows 下可直接双击 `启动DevSaga.bat`，选择网页版 / 终端版 / 机器人演示 / 算法判题。需要 Python 3.10+，零第三方依赖。

### netime（NETIME 网络时光机）

```bash
cd netime
.\start.bat                # 打开游戏（需要 Chrome / Edge）
node tests/run.js          # 运行单元测试（需要 Node.js）
```

纯前端零依赖。⚠️ 项目进行中：目前包含完整剧情数据与解码工具箱，主线页面仍在开发。

### sound-archaeology（LAB-7 声音考古学）

```bash
cd sound-archaeology
.\start.bat                # 或直接双击 index.html（Chrome / Edge）
node tests/run.js          # 50 项单元测试
node tests/verify-audio.js # 音频内容验证（倒放相关性 / 频带功率）
```

纯前端零依赖，所有素材（含语音 WAV）base64 内嵌，无需联网。⚠️ 请佩戴耳机游玩。

## 📝 仓库约定

- **五个项目相互独立**：各自维护代码、文档与依赖，不互相引用。
- **release 目录只跟踪 `*.exe` 安装包**：`latest.yml`、`*.blockmap` 等 electron-builder 自动生成的构建产物一律忽略，防止每次打包产生无关改动。
- **敏感与依赖文件不入库**：`node_modules/`、`.env` / `config.json`（含 API 密钥）、`.superpowers/`、AI 助手说明文件（`AGENTS.md` / `CLAUDE.md`）等均已加入 `.gitignore`。
- **练习素材可再生成**：cyber-academy 的 `practice/`、`lab/downloads/` 等由 `node make-practice.js` 生成，不入库；sound-archaeology 的语音素材可由 `tools/generate-voice.ps1` 重新生成。

## 📚 更多

- [ai_compiler 详细文档](./ai_compiler/README.md)
- [cyber-academy 详细文档](./cyber-academy/README.md)
- [devsaga 详细文档](./devsaga/README.md)
- [sound-archaeology 详细文档](./sound-archaeology/README.md)
- [devsaga 设计文档](./devsaga/docs/DESIGN.md)
