# AI Project 合集

> 一个包含多个**相互独立实战项目**的代码仓库（monorepo 风格）。目前收录十九个项目：桌面端「AI 编译器」、网页端「赛博安全学院」、Python 游戏「DevSaga」、四款纯前端解谜/模拟游戏「NETIME 时光机」「声音考古学」「LINGUA 语言演化博物馆」「LASTBROADCAST 最后的广播」、生态模拟器「ECO-ARK 生态方舟」、听觉共情游戏「UNLIT 无光之城」（戴上耳机，在几乎全黑的世界里用白杖回声与盲文完成一天的生活）、神经网络教学沙盒「SYNAPSE 神经织造」（亲手连线织一个神经网络，看它学会 XOR、螺旋与手写数字）、3D 车展「3D CAR 跑车展厅」（Three.js 的 Ferrari 458 交互式展厅）、汉字书写战斗史诗「INK-SAGA 墨战·天书纪」（鼠标写对目标字，每一个字都是刀）、GTA 风格开放世界「OUTLAW CITY 亡命都市 3D」、3D 箱庭小镇「HAKONIWA TOWN」（程序化高低错落岛屿小镇，昼夜循环与动态元素）、文学装置「HISTORY READER 历史朗读者」（把今天的浏览器历史写成一篇关于你的短篇小说），以及四个**真机原生**游戏：「REAL SHELL QUEST 真实文件历险」（在真实磁盘上执行真实命令的解谜冒险）、「THE VANISHED 桌面悬疑事件」（用真实 Windows 通知上演的实时悬疑剧）、「DESKTOP SIEGE 桌面保卫战」（敌人由你电脑上的真实文件名生成的射击游戏）、「HOUSE GUEST 桌灵·房客」（住在你真实电脑里的幽灵，用真实资源管理器在虚拟 C 盘里解谜）。

| GitHub | https://github.com/LanGYou-desu/ai_project |
| ------ | ------------------------------------------ |

## 📁 项目总览

| 项目 | 类型 | 一句话介绍 | 技术栈 |
| ---- | ---- | ---------- | ------ |
| [ai_compiler](./ai_compiler/) | Electron 桌面应用 | 把编辑器代码发给 AI「模拟运行」，AI 输出流式显示在内置终端里的 AI 编译器 | Electron + Express + Monaco Editor + electron-builder |
| [cyber-academy](./cyber-academy/) | Web 应用 + 本地靶场 | 面向零基础到进阶的网络安全训练营：课程 → 示例 → 关卡 → 挑战 → 真实本地靶场 → 命令行工具链 | 原生 HTML/CSS/JS + Node.js（零第三方依赖） |
| [devsaga](./devsaga/) | Python 养成游戏 | 程序员职场模拟器：11 种开发环境、79 个任务、33 道课后测验、51 篇知识手册、多结局剧情、11 套专属工作台 UI，边玩边学真实排障 | Python 3.10+ 标准库（零第三方依赖） |
| [netime](./netime/) | Web 解谜游戏 | 「网络时光机」：复古浏览器里沿着 1995→2025 五个年代收集时间密钥，用 ROT13 / 摩斯 / 藏头 / Base64 破解一桩跨越三十年的旧互联网失踪案 | 原生 HTML/CSS/JS（纯前端零依赖，57 项测试） |
| [sound-archaeology](./sound-archaeology/) | Web 解谜游戏 | 音频取证解谜：用变速 / 倒放 / 滤波 / 频谱图破译 6 段录音，揭开废弃广播塔沉睡四十年的秘密 | 原生 HTML/CSS/JS + Web Audio API（零依赖，素材内嵌） |
| [lingua](./lingua/) | Web 语言演化模拟 | 造一门语言，看它在一千年里经历音变、语法演化、方言分裂、借词与文字诞生；106 词 / 24 条音变 / 7 分支 / 同源词对照 / 音系档案 / 现实语言学注释 / 种子可复现可分享可导出 | 原生 HTML/CSS/JS（纯前端零依赖，32 项测试） |
| [lastbroadcast](./lastbroadcast/) | Web 叙事模拟 | 末日前的最后 24 小时，你是一座城市唯一还在播音的电台值班员：选歌、播报、接来电（含点歌联动）、回应神秘信号，15 位听众的命运与 9 种结局由你决定 | 原生 HTML/CSS/JS + Web Audio（零依赖，26 项测试） |
| [eco-ark](./eco-ark/) | Web 生态模拟器 | 微观生态重建：从苔藓到狼群亲手重建完整食物网，应对干旱/冰期/陨石/入侵物种，让生态系统稳定繁衍 500 年；6 章剧情 + 沙盒 + 21 物种 + 生态学知识卡 + 成就 + 可复现种子存档（约 1 小时通关） | 原生 HTML/CSS/JS + Canvas + Web Audio（零依赖，38 项测试） |
| [shell-quest](./shell-quest/) | 真实命令行冒险 | 生成一个**真实沙盒目录**（60+ 个真实 txt/log/hex/tar 文件），用真实命令（ls/cat/grep/base64/untar…）逐层破解，找回自我封存的 ECHO 核心；3 幕剧情 + 13 口令 + 管道/编码/归档谜题，40–60 分钟 | Node.js（零依赖）+ 原生 HTML/CSS/JS（55 项测试） |
| [the-vanished](./the-vanished/) | 实时桌面悬疑剧 | 同事深夜失踪，约 40 分钟内线索通过**真实 Windows 通知**、**真实磁盘证据文件**与模拟聊天陆续送达；3 个检查点 + 注意力计分 + 5 种结局 | Node.js（零依赖）+ PowerShell（真实系统通知）（16 项测试） |
| [desktop-siege](./desktop-siege/) | Canvas 防御射击 | 敌人由**你电脑上的真实文件名与系统进程**生成（每台机器独一无二）：exe 冲锋、pdf 重甲、zip 分裂、Boss 以你磁盘最大文件命名；20 波 + 4 Boss + 无尽模式 + 6 种道具，30–60 分钟 | Node.js（零依赖）+ 原生 Canvas/Web Audio（24 项测试） |
| [houseguest](./houseguest/) | Python 桌面游戏 | 一只幽灵住进你的电脑：透明桌面悬浮层 + 真实虚拟 C 盘（`vfsystem\`），用真实资源管理器 / cmd 操作真实文件解谜；12 章四幕 + 3+1 结局 + 陪伴模式 | Python 3.10+（tkinter + Windows SAPI，零第三方依赖，38 项测试） |
| [unlit](./unlit/) | Web 共情体验游戏 | 「无光之城」：戴上耳机走进视障者的世界——白杖回声定位、听信号灯过马路、摸盲文读信、摸钱币结账、听水声做饭；6 章剧情 + 10 张助盲知识卡 | 原生 HTML/CSS/JS + Web Audio（零依赖，59 项测试） |
| [synapse](./synapse/) | Web 教学沙盒 | 「神经织造」：亲手连线织一个神经网络——调权重/偏置/激活，实时看损失下降与决策边界成形；XOR/双月/螺旋/手写数字/井字棋 5 数据集 + 训练场挑战 + 13 张知识卡 | 原生 HTML/CSS/JS + Canvas + Web Audio（零依赖，91 项测试） |
| [3d-car](./3d-car/) | Web 3D 车展 | 基于 Three.js 的 Ferrari 458 交互式 3D 车展：51 部件 PBR 材质、8 种涂装、夜景与行驶模式、摄影棚光照；完全离线可用 | Three.js r160（本地化）+ GLTF/DRACO（零运行时依赖） |
| [3d-hakoniwa-town](./3d-hakoniwa-town/) | Web 3D 箱庭沙盘 | 「箱庭小镇」：程序化高低错落岛屿小镇，城堡/港湾/缆车/列车/摩天轮，完整昼夜循环与丰富动态元素；完全离线可玩 | Three.js r160（本地化，零运行时依赖） |
| [history-reader](./history-reader/) | Node.js 文学装置 | 「历史朗读者」：把今天的浏览器历史（Chrome/Edge）写成一篇关于你的短篇小说——时段章节、行为节奏、文学式总结；支持 JSON 上传，数据不出本机 | 原生 Node http + sql.js（SQLite 纯 JS 解析） |
| [ink-saga](./ink-saga/) | 汉字书写战斗 | 用笔写字来战斗：鼠标亲手写出敌人头顶的目标字即触发字诀，271 字词库 + 15 章剧情 + 6 结局 + 4 大模式 + 49 成就，识别/水墨/音效全程序化 | 原生 HTML/CSS/JS + Canvas + Web Audio + Node.js（零第三方依赖，36 项测试） |
| [outlaw-city](./outlaw-city/) | 3D 开放世界 | GTA 风格纯前端第三人称开放世界：驾驶/枪战/警察追捕/任务系统/昼夜循环与实时阴影，双击即玩 | 原生 HTML/CSS/JS + three.min.js（零依赖） |

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
├── netime/                 # NETIME 网络时光机（旧互联网考古）
│   ├── index.html          # 入口（双击即玩）
│   ├── js/                 # 剧情 / 站点内容 / 浏览器引擎 / 谜题状态机 / 工具箱 / 主控制器
│   ├── css/                # 时光机控制台主题 + 五个年代复古网页主题
│   ├── tests/              # 57 项测试：工具 / 引擎 / 谜题 / 剧情通关 / 前端启动冒烟
│   └── start.bat           # 启动脚本（打开 index.html / 运行测试）
└── sound-archaeology/      # LAB-7 声音考古学 · 幽灵频率（音频取证解谜）
    ├── index.html          # 主页面（双击即玩）
    ├── js/                 # 音频合成 / 播放引擎 / 频谱图 / 案件 / 摩斯
    ├── css/style.css       # 暗色实验室主题（CRT 磷光绿）
    ├── tools/              # 语音素材生成（Windows SAPI）与文案
    ├── tests/              # 单元测试（node tests/run.js，50 项）
    └── start.bat           # 一键打开游戏
├── lingua/                 # LINGUA · 语言演化博物馆（造一门语言演化一千年）
    ├── index.html          # 入口（双击即玩）
    ├── js/shared/          # 引擎：种子 RNG / 106 词汇 / 24 条音变 / 14 种语法事件 / 演化引擎
    ├── js/                 # 语系树 / 文字字形 / 同源词 / 主逻辑
    ├── css/style.css       # 纸墨展厅主题
    ├── test/               # 单元测试（node test/run.js，32 项）
    └── start.bat           # 一键打开
├── lastbroadcast/          # LASTBROADCAST · 最后的广播（末日电台叙事模拟）
    ├── index.html          # 入口（双击即玩）
    ├── js/shared/          # 剧情数据 / 仿真引擎（12 回合、点歌联动、9 结局）
    ├── js/                 # Web Audio 合成 / 主逻辑
    ├── css/style.css       # 深夜电台主题
    ├── test/               # 单元测试（node test/run.js，26 项）
    └── start.bat           # 一键打开
├── eco-ark/                # ECO-ARK · 生态方舟（微观生态重建模拟器）
    ├── index.html          # 入口（双击即玩）
    ├── js/shared/          # 引擎：RNG / 21 物种 / 地形 / 生态仿真 / 章节 / 知识卡
    ├── js/                 # 培养皿渲染 / 种群曲线 / Web Audio / 主逻辑
    ├── css/style.css       # 深绿实验室主题
    ├── test/               # 单元测试（node test/run.js，38 项）
    └── start.bat           # 一键打开
├── shell-quest/            # ARCHIVE-7 · 真实文件历险（真实命令行解谜冒险）
    ├── server.js           # 服务器：/api/exec 在真实沙盒目录上执行命令
    ├── lib/                # 世界生成器 / 安全命令引擎 / 剧情 / 状态
    ├── public/             # 终端界面（任务面板 + 命令终端）
    ├── test/run.js         # 55 项测试（含沙盒安全与全流程通关）
    ├── world/              # 生成的真实沙盒世界（不入库）
    └── start.bat           # 一键启动
├── the-vanished/           # THE VANISHED · 桌面悬疑事件（实时悬疑剧）
    ├── server.js           # 时间线引擎 + 真实证据生成 + API
    ├── notify.ps1          # 真实 Windows Toast 通知脚本
    ├── lib/                # 剧情 / 时间线引擎 / 通知桥
    ├── public/             # 调查台（聊天 / 证据 / 案件板）
    ├── test/run.js         # 16 项测试
    ├── evidence/           # 运行时生成的真实证据文件（不入库）
    └── start.bat           # 一键启动
└── desktop-siege/          # DESKTOP SIEGE · 桌面保卫战（真实数据敌人射击游戏）
    ├── server.js           # 真实磁盘/进程扫描 + 波次 API
    ├── lib/                # 扫描器 / 波次生成 / 纯逻辑引擎（UMD 双模式）
    ├── public/             # Canvas 游戏界面
    ├── test/run.js         # 24 项测试
    └── start.bat           # 一键启动
└── houseguest/             # HOUSE GUEST · 桌灵·房客（桌面幽灵叙事解谜）
    ├── main.py             # 入口（单实例 + 章节状态机 + 观测台）
    ├── game/               # 幽灵对话 / 透明悬浮层 / 密码箱 / 虚拟系统构建器 / 操作检测
    ├── tools/smoke.py      # GUI 冒烟测试
    ├── tests/              # 38 项单元测试（python -m unittest，含无头全流程通关）
    ├── vfsystem/           # 【运行时生成】虚拟系统目录（仿真实 Windows，不入库）
    ├── save/               # 【运行时生成】存档（不入库）
    └── start.bat           # 一键启动
├── unlit/                  # UNLIT · 无光之城（听觉共情体验游戏）
    ├── index.html          # 入口（双击即玩，戴上耳机）
    ├── js/                 # shared 纯逻辑（盲文/声学/回声/引擎）+ 音频合成 + 渲染 UI
    ├── css/                # 墨黑 + 暖金主题
    ├── test/run.js         # 59 项测试（含 ch0→ch5 全流程通关）
    └── start.bat           # 一键打开
├── synapse/                 # SYNAPSE · 神经织造（神经网络教学沙盒）
    ├── index.html          # 入口（双击即玩）
    ├── js/shared/          # 纯逻辑引擎：RNG / 激活 / 损失 / 网络 / 训练器 / 数据集 / 井字棋教师 / 编辑器
    ├── js/                 # Canvas 渲染 + Web Audio 音效 + 主控制器
    ├── css/                # 暗色神经实验室主题
    ├── test/               # 91 项单元测试 + 前端冒烟测试
    └── start.bat           # 一键打开
├── 3d-car/                  # 3D 跑车展厅（Three.js Ferrari 458 交互式车展）
    ├── index.html          # 入口（离线双击或联网 CDN）
    ├── server.js           # 本地静态服务（零依赖）
    ├── ferrari.glb         # DRACO 压缩车辆模型（51 部件）
    ├── vendor/             # three.js + GLTF/DRACO/OrbitControls 本地化
    └── start.bat           # 一键启动（http://127.0.0.1:8080）
├── 3d-hakoniwa-town/        # 3D 箱庭小镇（程序化岛屿 / 昼夜循环 / 动态沙盘）
│     ├── index.html          # 入口（双击 run.bat 或本地服务打开）
│     ├── js/                 # 地形 / 城镇 / 载具 / 昼夜动态 / 主循环
│     ├── vendor/             # Three.js r160 本地化
│     └── run.bat             # 一键启动（python -m http.server）
├── history-reader/          # HISTORY READER · 历史朗读者（浏览器历史文学装置）
│     ├── server.js           # 服务器：读取历史数据库 + 叙事 API
│     ├── lib/                # 历史读取（sql.js）/ 叙事生成器
│     ├── public/             # 阅读界面
│     └── start.bat           # 一键启动（http://localhost:8769）
├── ink-saga/                # INK-SAGA · 墨战·天书纪（汉字书写战斗）
    ├── server.js           # Node 后端（静态 + 存档 + 导出 + 排行榜）
    ├── public/             # 前端：识别引擎 / 字诀 / 敌人 / 装备 / 剧情
    ├── save/               # 【运行时生成】存档 / 报告 / 字帖（不入库）
    ├── test/run.js         # 36 项单元测试
    └── start.bat           # 一键启动（http://127.0.0.1:7337）
└── outlaw-city/            # OUTLAW CITY · 亡命都市 3D（开放世界）
    ├── index.html          # 入口（双击即玩）
    ├── lib/three.min.js    # three.js r128 引擎（本地化）
    ├── js/                 # 渲染 / 实体 / 战斗 / AI / 警察 / 任务 / HUD
    └── css/style.css       # 界面样式
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

纯前端零依赖，双击 `index.html` 即玩；`node tests/run.js` 可跑 57 项测试（含 headless 全通关）。

### sound-archaeology（LAB-7 声音考古学）

```bash
cd sound-archaeology
.\start.bat                # 或直接双击 index.html（Chrome / Edge）
node tests/run.js          # 50 项单元测试
node tests/verify-audio.js # 音频内容验证（倒放相关性 / 频带功率）
```

纯前端零依赖，所有素材（含语音 WAV）base64 内嵌，无需联网。⚠️ 请佩戴耳机游玩。

### lingua（LINGUA · 语言演化博物馆）

```bash
cd lingua
node test/run.js          # 32 项单元测试
```

双击 `index.html` 即玩：生成一门语言 → 拖动时间轴看 1000 年演化（三次分裂 / 两波借词）→ 点词追踪词源 / 对照同源词 → 导出档案 / 分享种子复现同一门语言。纯前端零依赖。

### lastbroadcast（LASTBROADCAST · 最后的广播）

```bash
cd lastbroadcast
node test/run.js          # 26 项单元测试
```

双击 `index.html` 即玩：末日电台值班 24 小时，选歌 / 播报 / 接来电（含点歌联动）/ 回应信号，9 种结局 + 结局图鉴。纯前端零依赖，音乐为 Web Audio 程序化合成，建议佩戴耳机。

### eco-ark（ECO-ARK · 生态方舟）

```bash
cd eco-ark
.\start.bat               # 或直接双击 index.html（Chrome / Edge）
node test/run.js          # 38 项单元测试（含确定性 / 生态平衡 / 剧情目标回归）
```

微观生态重建模拟器（约 1 小时通关）：在 84×54 的培养皿星球上涂抹物种、重建食物网，应对干旱 / 冰期 / 陨石 / 入侵藤蔓。6 章剧情 + 沙盒模式 + 21 种物种 + 13 条生态学知识卡 + 12 项成就 + 种子存档重放。纯前端零依赖，引擎全确定性（同种子同操作 → 相同演化）。

### shell-quest（ARCHIVE-7 · 真实文件历险）

```bash
cd shell-quest
.\start.bat               # 一键启动（自动生成真实沙盒世界并打开浏览器）
node test/run.js          # 55 项测试（世界确定性 / 沙盒安全 / 全流程通关）
```

首次启动在 `world/` 生成约 60 个真实文件（txt / log / hex / tar），游戏内终端**真实执行**受限命令（白名单 + 只读 + 路径锁定）逐层解谜：藏头诗、登记表推理、base64、rot13、凯撒、XOR、tar 归档、grep 定位……3 幕 13 个口令，40–60 分钟。你甚至可以退出游戏用资源管理器直接翻看这个世界。

### the-vanished（THE VANISHED · 桌面悬疑事件）

```bash
cd the-vanished
.\start.bat               # 一键启动（真实时间线自动开始）
node test/run.js          # 16 项测试（时间线 / 计分 / 结局 / 服务器）
```

同事林薇深夜失踪。约 40 分钟里，线索通过**真实的 Windows Toast 通知**、**真实写入 `evidence/` 目录的证据文件**与模拟聊天陆续送达；3 个检查点 + 注意力计分 → 5 种结局。可在界面右上角切换 4x/8x/16x 倍速。

### desktop-siege（DESKTOP SIEGE · 桌面保卫战）

```bash
cd desktop-siege
.\start.bat               # 一键启动（自动扫描你的磁盘并打开浏览器）
node test/run.js          # 24 项测试（扫描 / 波次确定性 / 引擎逻辑 / 服务器）
```

启动时扫描你的桌面 / 文档 / 下载 / 图片与系统进程，把**真实文件名**变成敌人：exe 冲锋、pdf 重甲、zip 分裂、jpg 治疗，Boss 以你磁盘上最大的文件命名。WASD 移动 + 鼠标射击，20 波 + 4 Boss + 无尽模式，一局 30–60 分钟。每台电脑的战场独一无二。

### houseguest（HOUSE GUEST · 桌灵·房客）

```bash
cd houseguest
python main.py                                     # 正常启动（首次自动生成 vfsystem\ 虚拟系统）
python -m unittest discover -s tests -t .          # 38 项单元测试（或双击 run_tests.bat）
```

启动后透明幽灵「咕噜」飘在桌面右下角（可拖拽、会说话、会整蛊）：它布置任务，你用**真实的资源管理器 / cmd** 在 `vfsystem\`（仿真实 Windows 的虚拟 C 盘）里找文件、解密码（摩斯/Base64/ROT13/藏头诗）、移动/新建/删除真实文件，后台每 1.5 秒检测你的真实操作。12 章四幕主线 + 3 种结局 + 1 个隐藏结局（集齐 12 颗彩蛋），通关后还有陪伴模式。纯 Python 零第三方依赖，不联网。

### unlit（UNLIT · 无光之城）

```bash
cd unlit
.\start.bat                # 打开 index.html（务必佩戴耳机）
node test\run.js           # 59 项单元测试（含脚本化全流程通关）
```

**戴上耳机，屏幕几乎全黑。** 你是一个三个月前失去视力的人，今天是你重学日常的第一天：用白杖回声"看"路（Space）、听信号音独自过两条马路、摸盲文数字呼梯、摸钱币结账、听水开的声音做饭……6 章剧情约 40–60 分钟，通关解锁 10 张助盲知识卡。纯前端零依赖，所有声音由 Web Audio 实时合成；按 Tab 可在"沉浸/辅助"模式间切换，按 N 有语音导航。

### synapse（SYNAPSE · 神经织造）

```bash
cd synapse
.\start.bat                # 或直接双击 index.html（Chrome / Edge）
node test/run.js           # 91 项单元测试（引擎 / 梯度校验 / 收敛 / 确定性）
node test/smoke-ui.js      # 前端冒烟测试
```

手搓神经网络的活体教学沙盒：画布拖拽连线搭网络，调权重/偏置/激活，实时看损失曲线与决策边界成形；5 个数据集（XOR/双月/螺旋/手写数字/井字棋）从入门打到对战，训练场五张挑战卡等你通关。

### 3d-car（3D 跑车展厅）

```bash
cd 3d-car
.\start.bat          # 一键启动（http://127.0.0.1:8080，需本机 Node.js）
# 或直接双击 index.html（联网时自动从 CDN 加载 three.js 与模型）
```

基于 Three.js 的 Ferrari 458 交互式 3D 车展：51 个部件逐一精细定做 PBR 材质（清漆车漆/透射玻璃/碳纤维/皮革），8 种车身涂装 + 3 种轮毂配色，夜景大灯、行驶跑圈、4 个快捷视角，摄影棚级环境反射（PMREM）。模型、引擎、解码器全部打包在项目内，离线可用。

### 3d-hakoniwa-town（3D 箱庭小镇）

```bash
cd 3d-hakoniwa-town
.\run.bat               # 或 python -m http.server 8080，打开 http://localhost:8080
```

程序化高低错落岛屿小镇：中央台地 + 神社丘陵 + 城堡山 + 海角灯塔，湖泊河流入海；昼夜循环（入夜亮灯、灯塔光束、摩天轮彩灯、萤火虫、水灯、烟花）、小车队与空中飞艇、数百株实例化花草与全程序化纹理。Three.js r160 本地化，支持 `file://` 直接打开。

### history-reader（HISTORY READER · 历史朗读者）

```bash
cd history-reader
npm install             # 首次安装（仅 sql.js）
.\start.bat             # 或 node server.js，打开 http://localhost:8769
```

把你的浏览器历史变成一首关于今天的小说：自动检测 Chrome / Edge 的 SQLite 历史数据库，按行为节奏（专注/寻找/漂移/切换）分章生成文学叙事；历史不可用时支持上传 JSON。所有数据只在本地处理，不上传任何服务器。

### ink-saga（INK-SAGA · 墨战·天书纪）

```bash
cd ink-saga
.\start.bat          # 一键启动（http://127.0.0.1:7337）
node test\run.js     # 36 项单元测试
```

全世界第一款「用笔写字来战斗」的汉字书写战斗史诗：天启七年纸镇的字都醒了，你握起秃狼毫笔——**你写的每一个字都是刀**。鼠标亲手写出敌人头顶的目标字即触发字诀（火焚/冰缓/雷链/盾御…）。271 字词库 + 114 双字词 + 78 成语 + 20 诗词 + 15 章剧情 + 6 结局 + 4 大模式 + 文房四宝装备 + 49 成就；识别引擎与水墨美术、音效全部程序化生成，零素材零依赖。

### outlaw-city（OUTLAW CITY · 亡命都市 3D）

```bash
cd outlaw-city
# 直接双击 index.html 即可游玩（需浏览器支持 WebGL），或 npx serve .
```

GTA 风格的纯前端第三人称 3D 开放世界：立体楼房、湖泊水面、街灯与远景雾效，昼夜循环 + 动态光照 + 实时阴影；驾驶、枪战、警察追捕与通缉星级、任务系统、HUD 与小地图。零依赖，双击即玩。

## 📝 仓库约定

- **十九个项目相互独立**：各自维护代码、文档与依赖，不互相引用。
- **release 目录只跟踪 `*.exe` 安装包**：`latest.yml`、`*.blockmap` 等 electron-builder 自动生成的构建产物一律忽略，防止每次打包产生无关改动。
- **敏感与依赖文件不入库**：`node_modules/`、`.env` / `config.json`（含 API 密钥）、`.superpowers/`、AI 助手说明文件（`AGENTS.md` / `CLAUDE.md`）等均已加入 `.gitignore`。
- **练习素材可再生成**：cyber-academy 的 `practice/`、`lab/downloads/` 等由 `node make-practice.js` 生成，不入库；sound-archaeology 的语音素材可由 `tools/generate-voice.ps1` 重新生成。

## 📚 更多

- [ai_compiler 详细文档](./ai_compiler/README.md)
- [cyber-academy 详细文档](./cyber-academy/README.md)
- [devsaga 详细文档](./devsaga/README.md)
- [netime 详细文档](./netime/README.md)
- [sound-archaeology 详细文档](./sound-archaeology/README.md)
- [lingua 详细文档](./lingua/README.md)
- [lastbroadcast 详细文档](./lastbroadcast/README.md)
- [eco-ark 详细文档](./eco-ark/README.md)
- [houseguest 详细文档](./houseguest/README.md)
- [unlit 详细文档](./unlit/README.md)
- [synapse 详细文档](./synapse/README.md)
- [3d-car 详细文档](./3d-car/README.md)
- [3d-hakoniwa-town 详细文档](./3d-hakoniwa-town/README.md)
- [history-reader 详细文档](./history-reader/README.md)
- [ink-saga 详细文档](./ink-saga/README.md)
- [outlaw-city 详细文档](./outlaw-city/README.md)
- [devsaga 设计文档](./devsaga/docs/DESIGN.md)
