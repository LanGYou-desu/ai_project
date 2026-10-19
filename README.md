# AI Project 合集

> 一个包含多个**相互独立实战项目**的代码仓库（monorepo 风格）。目前收录 **26 个项目**，按 6 个类别归档在顶层子目录里：
>
> | 类别 | 内容 | 项目数 |
> | ---- | ---- | ---- |
> | [`gamesWeb/`](./gamesWeb/) | 🎮 纯前端网页游戏与互动体验（解谜 / 叙事 / 模拟 / 教学） | 10 |
> | [`gamesDesktop/`](./gamesDesktop/) | 🖥 与真实系统交互的桌面 / 终端游戏（真实文件、通知、进程） | 5 |
> | [`scenes3d/`](./scenes3d/) | 🏞 3D 场景与模型作品（Three.js 场景 · Blender 建模） | 6 |
> | [`webApps/`](./webApps/) | 🌐 网页应用（安全训练营、文学装置、个人操作系统） | 3 |
> | [`devTools/`](./devTools/) | 🧰 开发工具 | 1 |
> | [`webArt/`](./webArt/) | 🎨 美术小作 | 1 |
>
> 其中 **22 个项目自带自动化测试**，合计 **4179 项断言**，一条 `npm test` 即可全量回归（其余 4 个为静态页面或 3D 模型作品，无测试）。

| GitHub | https://github.com/LanGYou-desu/ai_project |
| ------ | ------------------------------------------ |

## 📁 项目总览

### 🎮 gamesWeb · 纯前端网页游戏与互动体验

| 项目 | 类型 | 一句话介绍 | 技术栈 | 测试 |
| ---- | ---- | ---------- | ------ | ---- |
| [netime](./gamesWeb/netime/) | Web 解谜游戏 | 「网络时光机」：复古浏览器里沿着 1995→2025 五个年代收集时间密钥，用 ROT13 / 摩斯 / 藏头 / Base64 破解一桩跨越三十年的旧互联网失踪案 | 原生 HTML/CSS/JS | 86 |
| [soundArchaeology](./gamesWeb/soundArchaeology/) | Web 解谜游戏 | 音频取证解谜：用变速 / 倒放 / 滤波 / 频谱图破译 6 段录音，揭开废弃广播塔沉睡四十年的秘密 | 原生 HTML/CSS/JS + Web Audio API（零依赖，素材内嵌） | 103 |
| [lingua](./gamesWeb/lingua/) | Web 语言演化模拟 | 造一门语言，看它在一千年里经历音变、语法演化、方言分裂、借词与文字诞生；106 词 / 24 条音变 / 7 分支 / 同源词对照 / 音系档案 / 现实语言学注释 / 种子可复现可分享可导出 | 原生 HTML/CSS/JS | 57 |
| [lastBroadcast](./gamesWeb/lastBroadcast/) | Web 叙事模拟 | 末日前的最后 24 小时，你是一座城市唯一还在播音的电台值班员：选歌、播报、接来电（含点歌联动）、回应神秘信号，15 位听众的命运与 9 种结局由你决定 | 原生 HTML/CSS/JS + Web Audio | 62 |
| [ecoArk](./gamesWeb/ecoArk/) | Web 生态模拟器 | 微观生态重建：从苔藓到狼群亲手重建完整食物网，应对干旱/冰期/陨石/入侵物种，让生态系统长期自主演化；6 章剧情 + 沙盒 + 21 物种 + 生态学知识卡 + 成就 + 可复现种子存档（约 1 小时通关） | 原生 HTML/CSS/JS + Canvas + Web Audio | 59 |
| [unlit](./gamesWeb/unlit/) | Web 共情体验游戏 | 「无光之城」：戴上耳机走进视障者的世界——白杖回声定位、听信号灯过马路、摸盲文读信、摸钱币结账、听水声做饭；6 章剧情 + 10 张助盲知识卡 | 原生 HTML/CSS/JS + Web Audio | 80 |
| [synapse](./gamesWeb/synapse/) | Web 教学沙盒 | 「神经织造」：亲手连线织一个神经网络——调权重/偏置/激活，实时看损失下降与决策边界成形；XOR/双月/螺旋/手写数字/井字棋 5 数据集 + 训练场挑战 + 13 张知识卡 | 原生 HTML/CSS/JS + Canvas + Web Audio | 141 |
| [inkSaga](./gamesWeb/inkSaga/) | 汉字书写战斗 | 用笔写字来战斗：鼠标亲手写出敌人头顶的目标字即触发字诀，271 字词库 + 15 章剧情 + 6 结局 + 4 大模式 + 49 成就，识别/水墨/音效全程序化 | 原生 HTML/CSS/JS + Canvas + Web Audio + Node.js | 60 |
| [loom](./gamesWeb/loom/) | 可编程织机 | 「织机编程」：写一份织造程序（穿综/提综/踏综，或逐纬写提升计划＝打孔卡片），织出真实织物；自动识别组织（平纹/斜纹/缎纹/人字/方平/条纹）、浮长直方图与织物克重，还能在布面上手绘提花反写成程序 | 原生 HTML/CSS/JS + Canvas + Web Audio | 123 |
| [outlawCity](./gamesWeb/outlawCity/) | Web 3D 开放世界 | GTA 风格纯前端第三人称开放世界：驾驶/枪战/警察追捕/任务系统/昼夜循环与实时阴影，双击即玩 | 原生 HTML/CSS/JS + three.min.js（零依赖） | 253 |

### 🖥 gamesDesktop · 与真实系统交互的桌面 / 终端游戏

| 项目 | 类型 | 一句话介绍 | 技术栈 | 测试 |
| ---- | ---- | ---------- | ------ | ---- |
| [devsaga](./gamesDesktop/devsaga/) | Python 养成游戏 | 程序员职场模拟器：11 种开发环境、79 个任务、33 道课后测验、51 篇知识手册、多结局剧情、11 套专属工作台 UI，边玩边学真实排障 | Python 3.10+ 标准库（零第三方依赖） | 85 |
| [shellQuest](./gamesDesktop/shellQuest/) | 真实命令行冒险 | 生成一个**真实沙盒目录**（60+ 个真实 txt/log/hex/tar 文件），用真实命令（ls/cat/grep/base64/untar…）逐层破解，找回自我封存的 ECHO 核心；3 幕剧情 + 13 口令 + 管道/编码/归档谜题，40–60 分钟 | Node.js（零依赖）+ 原生 HTML/CSS/JS | 148 |
| [theVanished](./gamesDesktop/theVanished/) | 实时桌面悬疑剧 | 同事深夜失踪，约 40 分钟内线索通过**真实 Windows 通知**、**真实磁盘证据文件**与模拟聊天陆续送达；3 个检查点 + 注意力计分 + 5 种结局 | Node.js（零依赖）+ PowerShell（真实系统通知） | 42 |
| [desktopSiege](./gamesDesktop/desktopSiege/) | Canvas 防御射击 | 敌人由**你电脑上的真实文件名与系统进程**生成（每台机器独一无二）：exe 冲锋、pdf 重甲、zip 分裂、Boss 以你磁盘最大文件命名；20 波 + 4 Boss + 无尽模式 + 6 种道具，30–60 分钟 | Node.js（零依赖）+ 原生 Canvas/Web Audio | 52 |
| [houseGuest](./gamesDesktop/houseGuest/) | Python 桌面游戏 | 一只幽灵住进你的电脑：透明桌面悬浮层 + 真实虚拟 C 盘（`vfsystem\`），用真实资源管理器 / cmd 操作真实文件解谜；12 章四幕 + 3+1 结局 + 陪伴模式 | Python 3.10+ | 125 |

### 🏞 scenes3d · 3D 场景与模型作品

| 项目 | 类型 | 一句话介绍 | 技术栈 | 测试 |
| ---- | ---- | ---------- | ------ | ---- |
| [carShowroom](./scenes3d/carShowroom/) | Web 3D 车展 | 基于 Three.js 的 Ferrari 458 交互式 3D 车展：51 部件 PBR 材质、8 种涂装、夜景与行驶模式、摄影棚光照；完全离线可用 | Three.js r160（本地化）+ GLTF/DRACO（零运行时依赖） | 150 |
| [hakoniwaTown](./scenes3d/hakoniwaTown/) | Web 3D 箱庭沙盘 | 「箱庭小镇」：程序化高低错落岛屿小镇，城堡/港湾/缆车/列车/摩天轮，完整昼夜循环与丰富动态元素；完全离线可玩 | Three.js r158（本地化，零运行时依赖） | 170 |
| [hakureiShrine](./scenes3d/hakureiShrine/) | Web 3D 微缩场景 | 「博麗神社」：无 UI 三渲二微缩庭院——本殿/鸟居/手水舍/绘马架与 Q 版像素灵梦扫地巡院，拖拽旋转缩放欣赏；单文件版离线即开 | Three.js 0.186 + Vite（单文件版零依赖） | — |
| [tokyoCelCity](./scenes3d/tokyoCelCity/) | Web 3D 程序化城市 | 「天空都市 東京」：单文件实时生成的三渲二都市——2,400m × 2,400m 数千栋建筑、运河与远山，白昼/黄昏/夜 + 巡航模式 | Three.js r159（内联单文件，零依赖） | — |
| [naiwaModel](./scenes3d/naiwaModel/) | Blender 3D 建模 | 「奶蛙」：依据官方三视图程序化重建的 3D 形象，含 GLB / 120mm 水密 STL / 三视图与转台 GIF 全套交付物与重建脚本 | Blender 4.5 + Python | — |
| [rainMart](./scenes3d/rainMart/) | Web 3D 街角模型 | 「雨夜便利店」：三渲二雨夜日式便利店街角微缩模型——店铺内外 / 街景道具 / 11 栋真实开窗楼群全几何建模，GPU 雨丝、檐口滴水、涟漪与霓虹湿地倒影，红绿灯周期循环；纯 canvas 无 UI、离线可跑 | Three.js r158（本地化）+ 原生 JS（零依赖） | 1766 |

### 🌐 webApps · 网页应用

| 项目 | 类型 | 一句话介绍 | 技术栈 | 测试 |
| ---- | ---- | ---------- | ------ | ---- |
| [cyberAcademy](./webApps/cyberAcademy/) | Web 应用 + 本地靶场 | 面向零基础到进阶的网络安全训练营：课程 → 示例 → 关卡 → 挑战 → 真实本地靶场 → 命令行工具链 | 原生 HTML/CSS/JS + Node.js（零第三方依赖） | 371 |
| [historyReader](./webApps/historyReader/) | Node.js 文学装置 | 「历史朗读者」：把今天的浏览器历史（Chrome/Edge）写成一篇关于你的短篇小说——时段章节、行为节奏、文学式总结；支持 JSON 上传，数据不出本机 | 原生 Node http + sql.js（SQLite 纯 JS 解析） | 47 |
| [personalOs](./webApps/personalOs/) | Web 应用（Svelte） | 把个人网站做成一台能开机的小电脑：桌面 / 窗口 / 终端 / 音乐播放器 + 九个应用，外加一块可从浏览器真实读写的 256 KiB 虚拟磁盘；支持 PWA 与移动端 | Svelte 5 + Vite + TypeScript（Vitest 测试） | 114 |

### 🧰 devTools · 开发工具

| 项目 | 类型 | 一句话介绍 | 技术栈 | 测试 |
| ---- | ---- | ---------- | ------ | ---- |
| [aiCompiler](./devTools/aiCompiler/) | Electron 桌面应用 | 把编辑器代码发给 AI「模拟运行」，AI 输出流式显示在内置终端里的 AI 编译器 | Electron + Express + Monaco Editor + electron-builder | 85 |

### 🎨 webArt · 美术小作

| 项目 | 类型 | 一句话介绍 | 技术栈 | 测试 |
| ---- | ---- | ---------- | ------ | ---- |
| [bikeArt](./webArt/bikeArt/) | SVG 动画美术 | 「骑车」：三张单文件 SVG 动画小画（海边的鹈鹕 / 骑车的鹈鹕 / 艾玛骑车），零脚本、零依赖、双击即看 | 原生 SVG + SMIL | — |

## 🧪 全仓库测试

22 个项目自带自动化测试（其中 21 个是零依赖脚本，personalOs 用 Vitest）；根目录提供一个统一入口，把它们一次跑完并汇总：

```bash
npm test                                # 跑全部 22 个带测试的项目
npm run test:fast                       # 跳过最慢的两个（ecoArk / devsaga）
node scripts/test-all.js loom netime    # 只跑指定项目（写短名或完整路径均可）
node scripts/test-all.js gamesWeb/loom # 同上，用分类路径
```

输出形如：

```
  ✓ gamesWeb/netime               node tests/run.js             1.9s  · 86 项
  ✓ gamesDesktop/desktopSiege    node test/run.js              2.7s  · 52 项
  ✓ scenes3d/rainMart            node test/run.js              0.3s  · 1766 项
  ✓ webApps/personalOs           npm test                      3.5s
  ...
  ─────────────────────────────────────────────────────────────
  项目 22/22 通过 · 测试套件 32/32 通过 · 用时 89.3s
```

`scripts/test-all.js` 只是一张"登记表 + 调度器"：按各项目**自己的**测试命令调用它们，不改变任何项目结构、不引入任何依赖。项目之间依然完全独立 —— 单独进任意目录跑它自己的测试同样可以。

## 🌳 目录结构

```
ai_project/
├── README.md                 # 本文件（26 个项目总览）
├── package.json              # 根级脚本：npm test 一次跑完所有带测试的项目
├── scripts/test-all.js       # 仓库级测试调度器（按各项目自己的命令调用）
├── .gitattributes            # 换行符与二进制策略（.bat/.ps1 检出为 CRLF）
├── .gitignore                # 依赖 / 构建产物 / 密钥 / 运行时数据
│
├── gamesWeb/                # 🎮 纯前端网页游戏与互动体验（双击 index.html 即玩）
│   ├── netime/               # NETIME · 网络时光机（旧互联网考古解谜）
│   ├── soundArchaeology/    # LAB-7 · 声音考古学（音频取证解谜）
│   ├── lingua/               # LINGUA · 语言演化博物馆
│   ├── lastBroadcast/       # LASTBROADCAST · 最后的广播（末日电台叙事）
│   ├── ecoArk/              # ECO-ARK · 生态方舟（微观生态重建）
│   ├── unlit/                # UNLIT · 无光之城（听觉共情体验，戴耳机）
│   ├── synapse/              # SYNAPSE · 神经织造（神经网络教学沙盒）
│   ├── inkSaga/             # INK-SAGA · 墨战·天书纪（汉字书写战斗）
│   ├── loom/                 # LOOM · 织机编程（写代码织布）
│   └── outlawCity/          # OUTLAW CITY · 亡命都市 3D（GTA 风格开放世界）
│
├── gamesDesktop/            # 🖥 与真实系统交互的桌面 / 终端游戏
│   ├── devsaga/              # DEVSAGA · 程序员模拟器（Python 养成游戏）
│   ├── shellQuest/          # ARCHIVE-7 · 真实文件历险（真实命令行解谜）
│   ├── theVanished/         # THE VANISHED · 桌面悬疑事件（真实通知）
│   ├── desktopSiege/        # DESKTOP SIEGE · 桌面保卫战（真实文件名敌人）
│   └── houseGuest/          # HOUSE GUEST · 桌灵·房客（Python 桌面幽灵）
│
├── scenes3d/                # 🏞 3D 场景与模型作品
│   ├── carShowroom/         # 3D CAR · 跑车展厅（Ferrari 458 交互式车展）
│   ├── hakoniwaTown/        # HAKONIWA TOWN · 箱庭小镇（程序化岛屿 / 昼夜循环）
│   ├── hakureiShrine/       # 博麗神社 · 幻想郷の小さな社（三渲二微缩庭院）
│   ├── tokyoCelCity/        # 天空都市 東京 · Celestial Metropolis（程序化城市）
│   ├── naiwaModel/          # 奶蛙 NAIWA · 3D 建模（Blender 程序化重建）
│   └── rainMart/            # RAIN MART · 雨夜便利店（三渲二雨夜街角微缩模型）
│
├── webApps/                 # 🌐 网页应用
│   ├── cyberAcademy/        # CYBER ACADEMY · 赛博安全学院（训练营 + 本地靶场）
│   ├── historyReader/       # HISTORY READER · 历史朗读者（浏览器历史文学装置）
│   └── personalOs/          # personalOs · 我的个人操作系统（含虚拟磁盘）
│
├── devTools/                # 🧰 开发工具
│   └── aiCompiler/          # AI COMPILER · AI 编译器（Electron 桌面应用）
│
└── webArt/                  # 🎨 美术小作
    └── bikeArt/             # BIKE ART · 骑车（SVG 动画小画）
```

## 🚀 快速开始

### 🎮 gamesWeb

#### netime（NETIME · 网络时光机）
```bash
cd gamesWeb/netime
.\start.bat                # 打开游戏（需要 Chrome / Edge）
node tests/run.js          # 运行单元测试（需要 Node.js）
```

纯前端零依赖，双击 `index.html` 即玩；`node tests/run.js` 可跑 86 项测试（含 headless 全通关）。

#### soundArchaeology（LAB-7 · 声音考古学）
```bash
cd gamesWeb/soundArchaeology
.\start.bat                # 或直接双击 index.html（Chrome / Edge）
node tests/run.js          # 103 项单元测试
node tests/verify-audio.js # 音频内容验证（倒放相关性 / 频带功率）
```

纯前端零依赖，所有素材（含语音 WAV）base64 内嵌，无需联网。⚠️ 请佩戴耳机游玩。

#### lingua（LINGUA · 语言演化博物馆）
```bash
cd gamesWeb/lingua
node test/run.js          # 57 项单元测试
```

双击 `index.html` 即玩：生成一门语言 → 拖动时间轴看 1000 年演化（三次分裂 / 两波借词）→ 点词追踪词源 / 对照同源词 → 导出档案 / 分享种子复现同一门语言。纯前端零依赖。

#### lastBroadcast（LASTBROADCAST · 最后的广播）
```bash
cd gamesWeb/lastBroadcast
node test/run.js          # 62 项单元测试
```

双击 `index.html` 即玩：末日电台值班 24 小时，选歌 / 播报 / 接来电（含点歌联动）/ 回应信号，9 种结局 + 结局图鉴。纯前端零依赖，音乐为 Web Audio 程序化合成，建议佩戴耳机。

#### ecoArk（ECO-ARK · 生态方舟）
```bash
cd gamesWeb/ecoArk
.\start.bat               # 或直接双击 index.html（Chrome / Edge）
node test/run.js          # 59 项单元测试（含确定性 / 生态平衡 / 剧情目标回归）
```

微观生态重建模拟器（约 1 小时通关）：在 84×54 的培养皿星球上涂抹物种、重建食物网，应对干旱 / 冰期 / 陨石 / 入侵藤蔓。6 章剧情 + 沙盒模式 + 21 种物种 + 13 条生态学知识卡 + 12 项成就 + 种子存档重放。纯前端零依赖，引擎全确定性（同种子同操作 → 相同演化）。

#### unlit（UNLIT · 无光之城）
```bash
cd gamesWeb/unlit
.\start.bat                # 打开 index.html（务必佩戴耳机）
node test\run.js           # 80 项单元测试（含脚本化全流程通关）
```

**戴上耳机，屏幕几乎全黑。** 你是一个三个月前失去视力的人，今天是你重学日常的第一天：用白杖回声"看"路（Space）、听信号音独自过两条马路、摸盲文数字呼梯、摸钱币结账、听水开的声音做饭……6 章剧情约 40–60 分钟，通关解锁 10 张助盲知识卡。纯前端零依赖，所有声音由 Web Audio 实时合成；按 Tab 可在"沉浸/辅助"模式间切换，按 N 有语音导航。

#### synapse（SYNAPSE · 神经织造）
```bash
cd gamesWeb/synapse
.\start.bat                # 或直接双击 index.html（Chrome / Edge）
node test/run.js           # 141 项单元测试（引擎 / 梯度校验 / 收敛 / 确定性）
node test/smoke-ui.js      # 前端冒烟测试
```

手搓神经网络的活体教学沙盒：画布拖拽连线搭网络，调权重/偏置/激活，实时看损失曲线与决策边界成形；5 个数据集（XOR/双月/螺旋/手写数字/井字棋）从入门打到对战，训练场五张挑战卡等你通关。

#### inkSaga（INK-SAGA · 墨战·天书纪）
```bash
cd gamesWeb/inkSaga
.\start.bat          # 一键启动（http://127.0.0.1:7337）
node test\run.js     # 60 项单元测试
```

全世界第一款「用笔写字来战斗」的汉字书写战斗史诗：天启七年纸镇的字都醒了，你握起秃狼毫笔——**你写的每一个字都是刀**。鼠标亲手写出敌人头顶的目标字即触发字诀（火焚/冰缓/雷链/盾御…）。271 字词库 + 114 双字词 + 78 成语 + 20 诗词 + 15 章剧情 + 6 结局 + 4 大模式 + 文房四宝装备 + 49 成就；识别引擎与水墨美术、音效全部程序化生成，零素材零依赖。

#### loom（LOOM · 织机编程）
```bash
cd gamesWeb/loom
.\start.bat          # 一键打开工作室（或直接双击 index.html）
node test\run.js     # 123 项单元测试（引擎 / DSL / 纹样库 / 渲染像素验证）
node test\smoke-ui.js # 界面冒烟测试
node tools\render-png.js all preview   # 12 个纹样导出 PNG
```

写一份**织造程序**，让 1804 年的打孔卡片织机把它变成布：`threading` 决定每根经线穿在哪片综框，`tieup` 决定每根踏杆抬起哪些综框，`treadling` 决定每一纬踩哪根踏杆；也可以跳过这三样，直接写 `liftplan` —— 那就是打孔卡片本身。程序跑起来就是一块写实织物（纱线有粗细明暗、经浮点带投影），同时给出打孔卡片链、织机俯视动画（开口→投梭→打纬）和织工看的四象限织造图。

引擎会从织物矩阵**反推组织**：先求最小循环，再判定规则组织（平纹 / 斜纹 / 缎纹，给出枚数与飞数）、方块棋盘家族（方平 / 横条 / 纵条 / 格纹）与镜像斜纹（人字纹），最后和内置纹样库精确比对；同时给出浮长直方图、经纬面比例、结构风险提醒，以及由纱线直径推导出的克重与织物覆盖率。勾上「手绘提花」还能直接在布面上涂改，松手时程序被自动改写 —— 画布就是代码。

#### outlawCity（OUTLAW CITY · 亡命都市 3D）
```bash
cd gamesWeb/outlawCity
# 直接双击 index.html 即可游玩（需浏览器支持 WebGL），或 npx serve .
node test/run.js        # 253 项断言（数学 / 任务状态机 / 输入映射 / 渲染循环冒烟）
```

GTA 风格的纯前端第三人称 3D 开放世界：立体楼房、湖泊水面、街灯与远景雾效，昼夜循环 + 动态光照 + 实时阴影；驾驶、枪战、警察追捕与通缉星级、任务系统、HUD 与小地图。零依赖，双击即玩。

### 🖥 gamesDesktop

#### devsaga（DEVSAGA · 程序员模拟器）
```bash
cd gamesDesktop/devsaga
python main.py --web       # 网页版（浏览器打开 http://127.0.0.1:8766）
python main.py             # 终端版（主菜单）
python main.py --bot       # 机器人 10 场景全通关演示
python -m unittest discover -s tests -p "test_*.py"   # 85 项单元测试
```

Windows 下可直接双击 `启动DevSaga.bat`，选择网页版 / 终端版 / 机器人演示 / 算法判题。需要 Python 3.10+，零第三方依赖。

#### shellQuest（ARCHIVE-7 · 真实文件历险）
```bash
cd gamesDesktop/shellQuest
.\start.bat               # 一键启动（自动生成真实沙盒世界并打开浏览器）
node test/run.js          # 148 项测试（世界确定性 / 沙盒安全 / 全流程通关）
```

首次启动在 `world/` 生成约 60 个真实文件（txt / log / hex / tar），游戏内终端**真实执行**受限命令（白名单 + 只读 + 路径锁定）逐层解谜：藏头诗、登记表推理、base64、rot13、凯撒、XOR、tar 归档、grep 定位……3 幕 13 个口令，40–60 分钟。你甚至可以退出游戏用资源管理器直接翻看这个世界。

#### theVanished（THE VANISHED · 桌面悬疑事件）
```bash
cd gamesDesktop/theVanished
.\start.bat               # 一键启动（真实时间线自动开始）
node test/run.js          # 42 项测试（时间线 / 计分 / 结局 / 服务器）
```

同事林薇深夜失踪。约 40 分钟里，线索通过**真实的 Windows Toast 通知**、**真实写入 `evidence/` 目录的证据文件**与模拟聊天陆续送达；3 个检查点 + 注意力计分 → 5 种结局。可在界面右上角切换 4x/8x/16x 倍速。

#### desktopSiege（DESKTOP SIEGE · 桌面保卫战）
```bash
cd gamesDesktop/desktopSiege
.\start.bat               # 一键启动（自动扫描你的磁盘并打开浏览器）
node test/run.js          # 52 项测试（扫描 / 波次确定性 / 引擎逻辑 / 服务器）
```

启动时扫描你的桌面 / 文档 / 下载 / 图片与系统进程，把**真实文件名**变成敌人：exe 冲锋、pdf 重甲、zip 分裂、jpg 治疗，Boss 以你磁盘上最大的文件命名。WASD 移动 + 鼠标射击，20 波 + 4 Boss + 无尽模式，一局 30–60 分钟。每台电脑的战场独一无二。

#### houseGuest（HOUSE GUEST · 桌灵·房客）
```bash
cd gamesDesktop/houseGuest
python main.py                                     # 正常启动（首次自动生成 vfsystem\ 虚拟系统）
python -m unittest discover -s tests -t .          # 125 项单元测试（或双击 run_tests.bat）
```

启动后透明幽灵「咕噜」飘在桌面右下角（可拖拽、会说话、会整蛊）：它布置任务，你用**真实的资源管理器 / cmd** 在 `vfsystem\`（仿真实 Windows 的虚拟 C 盘）里找文件、解密码（摩斯/Base64/ROT13/藏头诗）、移动/新建/删除真实文件，后台每 1.5 秒检测你的真实操作。12 章四幕主线 + 3 种结局 + 1 个隐藏结局（集齐 12 颗彩蛋），通关后还有陪伴模式。纯 Python 零第三方依赖，不联网。

### 🏞 scenes3d

#### carShowroom（3D CAR · 跑车展厅）
```bash
cd scenes3d/carShowroom
.\start.bat          # 一键启动（http://127.0.0.1:8080，需本机 Node.js）
node test/run.js     # 150 项断言（服务器安全 / 真起 HTTP / 渲染逻辑 / 解析真实 GLB）
```

基于 Three.js 的 Ferrari 458 交互式 3D 车展：51 个部件逐一精细定做 PBR 材质（清漆车漆/透射玻璃/碳纤维/皮革），8 种车身涂装 + 3 种轮毂配色，夜景大灯、行驶跑圈、4 个快捷视角，摄影棚级环境反射（PMREM）。模型、引擎、解码器全部打包在项目内，离线可用。

#### hakoniwaTown（HAKONIWA TOWN · 箱庭小镇）
```bash
cd scenes3d/hakoniwaTown
.\run.bat               # 或 python -m http.server 8080，打开 http://localhost:8080
node test/run.js        # 170 项断言（程序化生成确定性 / 几何不变量 / 渲染循环）
```

程序化高低错落岛屿小镇：中央台地 + 神社丘陵 + 城堡山 + 海角灯塔，湖泊河流入海；昼夜循环（入夜亮灯、灯塔光束、摩天轮彩灯、萤火虫、水灯、烟花）、小车队与空中飞艇、数百株实例化花草与全程序化纹理。Three.js r158 本地化，支持 `file://` 直接打开。

#### hakureiShrine（博麗神社 · 幻想郷の小さな社）
```bash
# 方式一：直接双击 scenes3d/hakureiShrine/hakureiShrine.html（单文件离线版）
# 方式二：源码开发版
cd scenes3d/hakureiShrine
.\run.bat            # 或 pnpm install && pnpm dev
pnpm build           # 生产构建（Vite）
```

无 UI 的三渲二微缩场景：完整的正方形博麗神社庭院——本殿/鸟居/手水舍/绘马架/石灯笼与 Q 版像素灵梦（扫地、起跳、推落叶），像一件可以拖拽、旋转、缩放欣赏的收藏级立体模型。Three.js 0.186 + Vite，所有贴图由 Canvas 程序化生成，无外部图片依赖；单文件版约 663 KB，离线可用。

#### tokyoCelCity（天空都市 東京 · Celestial Metropolis）
```powershell
# 直接双击 scenes3d/tokyoCelCity/index.html 即玩，或双击 start.bat
```

单文件、零依赖的三渲二程序化东京市：2,400 m × 2,400 m 的都市在几秒内实时生成（道路 → 街区 → 运河/公园 → 路灯/电线 → 郊区/山峦，带进度条），数千栋建筑与远山；白昼 / 黄昏 / 夜三段时刻一键切换，四个预设机位（全景/街区/地标/天际线）与自动巡航；支持 WASD+QE 飞行、双击聚焦、H 隐藏界面。Three.js r159 完整内联在一个 HTML 里，无需联网。

#### naiwaModel（奶蛙 NAIWA · 3D 建模）
```powershell
# 交付物（已入库）：exports/naiwa.glb（GLB）、exports/naiwa_print.stl（120mm 打印件）、renders/（成品图）
# 重建（需要 Blender 4.5+，建议开启 Cycles OptiX）
cd scenes3d/naiwaModel
blender -b --factory-startup --python scripts/build_naiwa.py     # 重建模型 + 导出 GLB
blender -b model/naiwa.blend --python scripts/render_final.py -- --views hero,face,sheet
python scripts/postprocess.py                                    # 合成三视图 / 转台 GIF
blender -b --factory-startup --python scripts/make_print.py      # 120 mm 水密 STL
```

依据官方三视图程序化重建的「奶蛙」3D 形象：Catmull-Rom 梨形躯干 + 体素重网格 + 顶点色奶白肚皮，全流程 Python 脚本化生成，含 GLB / 水密 STL / 主视觉 / 三视图 / 360° 转台全套交付物。

#### rainMart（RAIN MART · 雨夜便利店）
```bash
cd scenes3d/rainMart
.\run.bat               # 一键启动（http://127.0.0.1:8137；Node / Python 均可，离线可跑）
node test/run.js        # 1766 项断言（无头 stub 构建真实场景：装配 / 铺装 / 雨系统 / 动态时序 / 相机交互）
```

三渲二雨夜便利店街角微缩模型：便利店（闪烁招牌 / 感应门 / 冷柜与关东煮蒸汽）、街景道具（贩卖机 / 电线杆 / 红绿灯 / 自行车）与 11 栋真实开窗背景楼群（72 扇窗）；GPU 雨丝、檐口滴水、涟漪、玻璃雨痕与水洼霓虹倒影。纯 canvas 全屏渲染、无任何 UI，闲置 9 秒缓慢自动环绕；Three.js r158 本地化，`file://` 离线可跑。

### 🌐 webApps

#### cyberAcademy（CYBER ACADEMY · 赛博安全学院）
```powershell
cd webApps/cyberAcademy
.\start.ps1          # 自动：生成练习素材 → 启动游戏+靶场 → 打开浏览器
node test/audit.js   # 371 项断言，分散在 8 个测试文件（见项目 README）
```

或手动启动：`node server.js`（游戏 http://localhost:8080，靶场 http://127.0.0.1:8090）；只想玩网页版可直接双击 `index.html`（纯前端零依赖）。

#### historyReader（HISTORY READER · 历史朗读者）
```bash
cd webApps/historyReader
npm install             # 首次安装（仅 sql.js）
.\start.bat             # 或 node server.js，打开 http://localhost:8769
npm test                # 47 项单元测试（安全边界 / 叙事 / 上传归一化）
```

把你的浏览器历史变成一首关于今天的小说：自动检测 Chrome / Edge 的 SQLite 历史数据库，按行为节奏（专注/寻找/漂移/切换）分章生成文学叙事；历史不可用时支持上传 JSON。所有数据只在本地处理，不上传任何服务器。

#### personalOs（我的个人操作系统）
```bash
cd webApps/personalOs
npm install             # 首次安装依赖
.\start.bat             # 或 npm run dev（开发模式，http://localhost:5180）
npm test                # 114 项测试（Vitest：内核 / 磁盘 / 终端 / 窗口管理 / PWA）
npm run build           # 构建 + 生成种子磁盘镜像
npm start               # 生产模式：静态产物 + 磁盘 API
```

把个人网站做成一"台可以开机、可以折腾的电脑"：桌面 + 菜单栏 + Dock + 启动器（Ctrl/Cmd+K）、可拖拽八向缩放的窗口、九个应用（关于我 / 项目 / 联系 / 文件 / 终端 / 音乐 / 系统设置 / 任务管理器 / 记事本）、真终端（30+ 命令、重定向、Tab 补全）与 chiptune 音乐播放器；外加一块 256 KiB 的虚拟磁盘（FAT-lite 文件系统，镜像就是 `disk/disk.img`，可从浏览器真实读写）。玻璃拟态外观、明暗双主题、PWA 离线外壳、移动端适配。需要 Node 20+。

### 🧰 devTools

#### aiCompiler（AI COMPILER · AI 编译器）
```bash
cd devTools/aiCompiler
npm install          # 首次安装依赖（含 Electron）
npm start            # 或直接双击 启动.bat
npm test             # 85 项单元测试（node --test）
```

首次打开后到「设置」页填写 OpenAI 兼容接口（如 DeepSeek）的地址 / 密钥 / 模型，即可让 AI 模拟运行编辑器中的代码，还支持 AI 提问、生成代码、代码解释、错误自动修复、Markdown 预览等功能。

### 🎨 webArt

#### bikeArt（BIKE ART · 骑车）
```bash
# 直接双击 webArt/bikeArt/index.html（作品索引页）
# 或双击其中任意作品文件：bike0931/pelican-bike.html 等
```

三张单文件 SVG 动画小画：海边的鹈鹕 · 骑单车 / 骑车的鹈鹕 / 艾玛骑车。纯 SVG + SMIL，零脚本、零依赖、离线可用。

## 📝 仓库约定

- **二十六个项目相互独立**：各自维护代码、文档与依赖，不互相引用；根目录的 `scripts/test-all.js` 只是调度器，不改动任何项目结构。
- **六类归档**：所有项目按体验形态归入 `gamesWeb/`（纯前端游戏）、`gamesDesktop/`（真实系统交互游戏）、`scenes3d/`（3D 场景与模型）、`webApps/`（网页应用）、`devTools/`（开发工具）、`webArt/`（美术小作）六个分类目录；新增项目也要先归档。
- **目录名统一**：一律小驼峰 camelCase（首个单词小写，后续单词首字母大写，不使用分隔符）、不以数字开头；品牌单字名保留（`netime` / `devsaga` / `lingua` / `synapse` / `unlit` / `loom`），其余用一眼能读懂描述名（`carShowroom` / `hakoniwaTown` / `naiwaModel` / `tokyoCelCity`）。展示名统一为「BRAND · 中文名」。
- **换行符统一**：`.gitattributes` 保证仓库内按 LF 存储，`.bat` / `.cmd` / `.ps1` 在 Windows 检出时自动转 CRLF（批处理对 LF 有已知隐患）；`*.blend` / `*.stl` / `*.glb` 等二进制不做任何转换。
- **release 目录只跟踪 `*.exe` 安装包**：`latest.yml`、`*.blockmap` 等 electron-builder 自动生成的构建产物一律忽略，防止每次打包产生无关改动。
- **敏感与依赖文件不入库**：`node_modules/`、`.env` / `config.json`（含 API 密钥）、`.superpowers/`、AI 助手说明文件（`AGENTS.md` / `CLAUDE.md`）等均已加入 `.gitignore`；运行期数据（如 houseGuest 的 `vfsystem/`、shellQuest 的 `world/`、personalOs 的虚拟磁盘镜像）由各项目自己的 `.gitignore` 单独忽略。
- **练习素材可再生成**：cyberAcademy 的 `practice/`、`lab/downloads/` 等由 `node make-practice.js` 生成，不入库；soundArchaeology 的语音素材可由 `tools/generate-voice.ps1` 重新生成。

## 📚 更多

- [aiCompiler 详细文档](./devTools/aiCompiler/README.md)
- [cyberAcademy 详细文档](./webApps/cyberAcademy/README.md)
- [devsaga 详细文档](./gamesDesktop/devsaga/README.md)
- [netime 详细文档](./gamesWeb/netime/README.md)
- [soundArchaeology 详细文档](./gamesWeb/soundArchaeology/README.md)
- [lingua 详细文档](./gamesWeb/lingua/README.md)
- [lastBroadcast 详细文档](./gamesWeb/lastBroadcast/README.md)
- [ecoArk 详细文档](./gamesWeb/ecoArk/README.md)
- [unlit 详细文档](./gamesWeb/unlit/README.md)
- [synapse 详细文档](./gamesWeb/synapse/README.md)
- [inkSaga 详细文档](./gamesWeb/inkSaga/README.md)
- [loom 详细文档](./gamesWeb/loom/README.md)
- [outlawCity 详细文档](./gamesWeb/outlawCity/README.md)
- [shellQuest 详细文档](./gamesDesktop/shellQuest/README.md)
- [theVanished 详细文档](./gamesDesktop/theVanished/README.md)
- [desktopSiege 详细文档](./gamesDesktop/desktopSiege/README.md)
- [houseGuest 详细文档](./gamesDesktop/houseGuest/README.md)
- [carShowroom 详细文档](./scenes3d/carShowroom/README.md)
- [hakoniwaTown 详细文档](./scenes3d/hakoniwaTown/README.md)
- [hakureiShrine 详细文档](./scenes3d/hakureiShrine/README.md)
- [tokyoCelCity 详细文档](./scenes3d/tokyoCelCity/README.md)
- [naiwaModel 详细文档](./scenes3d/naiwaModel/README.md)
- [historyReader 详细文档](./webApps/historyReader/README.md)
- [personalOs 详细文档](./webApps/personalOs/README.md)
- [bikeArt 详细文档](./webArt/bikeArt/README.md)
- [devsaga 设计文档](./gamesDesktop/devsaga/docs/DESIGN.md)
