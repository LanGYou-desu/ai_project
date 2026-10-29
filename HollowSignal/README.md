# 空洞信号

《空洞信号》是一部约 30–50 分钟的第一人称心理恐怖短篇。故事发生在俄勒冈州奥里森湖水面之下，废弃的哈尔西恩研究站里。玩家扮演声学研究员艾瑞斯·维尔，沿着四章线性关卡下潜，收集十二份档案，听完妹妹蕾恩留下的最后一段磁带，并在两个不可逆的结局之间做出选择。

游戏内所有剧情、界面、目标、交互提示、档案、字幕、结局与暂停菜单均为简体中文。

## 项目路径

```text
D:\CodeWorks\ai_project\HollowSignal
```

## 启动

需要 Node.js 20 或更高版本，以及支持 WebGL2 和指针锁定的桌面版 Chromium / Edge。

```powershell
cd D:\CodeWorks\ai_project\HollowSignal
npm install
npm start
```

`npm start` 会启动本地静态服务器并自动打开浏览器。也可以手动访问：

```text
http://127.0.0.1:4173/
```

如需指定端口：

```powershell
$env:PORT = 8080
npm start
```

如需启动服务器但不自动打开浏览器：

```powershell
$env:NO_OPEN = '1'
npm start
```

关闭服务器请按 `Ctrl+C`。

## 操作

| 输入 | 动作 |
| --- | --- |
| `W` `A` `S` `D` | 行走 |
| 鼠标 | 环顾 |
| `Shift` | 冲刺；脚步声更响 |
| `C` | 蹲伏；移动更安静 |
| `E` | 交互 / 进入或离开藏身处 |
| `F` | 开关手电筒 |
| `J` | 打开案件记录 |
| `Esc` | 暂停 / 关闭当前档案或界面 |

## 内容

### 四章

1. **低水位**：检修隧道、维修办公室与安保门。找到蕾恩的检修卡，刷开电梯。
2. **聆听层**：泵层、观察室与主断路器。找回三枚陶瓷保险丝，恢复辅助电源，取得蕾恩的工牌。
3. **薄墙**：船员层、安保办公室、变电站与追逐段。输入工牌密码 `0317`，在储物柜中躲避聆听者，恢复电梯电源。
4. **空洞**：记忆走廊、共振展厅与最终磁带。听完七段录音，选择切断电源或回答信号。

### 记录与结局

- 12 份可收集档案，分布在四章的场景与交互物中。
- 档案可在案件记录中回看；收集状态跨章节保存。
- 两个结局：`静水`（切断电源）与`空洞`（回答信号）。
- 最终选择不可撤销，但通关后可以重新开始本章。

## 技术特性

- Three.js 已放入 `vendor/`，运行时不需要网络请求。
- WebGL2 渲染，程序化材质、纹理、建筑与道具。
- 静态合批、烘焙光照、遮挡/斜向剔除、LOD、对象池与流式 WAV 环境声。
- Low / Medium / High 三档画质；动态分辨率以 60 FPS 为目标，不应低于 30 FPS。
- 中文字体随项目打包：`Noto Sans SC` 用于界面，`Noto Serif SC` 用于标题与档案。
- 存档与设置保存在浏览器 `localStorage`；存档为单槽位。
- 字幕、胶片颗粒、视野、减少动态效果与音量可调。

## 测试

```powershell
npm test
```

当前自动化冒烟测试共 93 项，覆盖启动、菜单、画质档位、序章、四章流程、存档/继续、密码键盘重试、躲藏、死亡重生、追逐、最终磁带、两个结局与页面错误检查。最近一次结果为 **93/93 通过**。

测试使用 `tools/smoke-test.mjs`，在端口 `4186` 启动临时服务器，并在测试页面中替换指针锁定 API，因此不会夺取桌面鼠标。

### 界面截图

先启动 `npm start`，再运行：

```powershell
node tools/capture-ui-shots.mjs
```

截图写入 `qa-output/ui-shots/`，覆盖 1280×720 与 1600×900 的菜单、设置、操作、制作名单、序章、HUD、暂停、章节卡、档案、案件记录、键盘、最终选择与两个结局。该目录已被 `.gitignore` 忽略。

### 性能诊断

```powershell
node tools/diag-perf.mjs
```

脚本在三个画质档位下依次检查四章场景，输出帧时间、绘制调用与三角形数量。无头浏览器不会受垂直同步限制，应以帧时间、p95、绘制调用与三角形数量作为证据，而不是直接比较无头 FPS。

## 主要目录

```text
HollowSignal/
├─ index.html                 # 静态界面骨架与中文文案
├─ styles.css                 # 界面、中文排版与响应式布局
├─ server.mjs                 # 无依赖本地静态服务器
├─ src/
│  ├─ main.js                 # 启动与字体预加载
│  ├─ game/Game.js            # 游戏状态、章节流程、交互与存档
│  ├─ story/content.js       # 章节、档案、对白、磁带与结局
│  ├─ ui/UI.js                # HUD、菜单、档案、键盘与结局界面
│  ├─ engine/                 # 渲染、输入、音频、材质、纹理与设置
│  └─ world/                  # 四章关卡、道具、细节与聆听者
├─ assets/
│  ├─ fonts/                  # 拉丁字体与中文子集
│  ├─ audio/                  # 流式环境声与音效
│  └─ textures/               # 运行时可用的纹理资产
├─ tools/
│  ├─ smoke-test.mjs          # 自动化冒烟测试
│  ├─ capture-ui-shots.mjs    # 非指针锁定截图
│  ├─ diag-perf.mjs           # 性能采样
│  └─ build-cjk-fonts.mjs     # 中文字体子集生成（开发用）
└─ docs/                      # 故事、设计、性能与测试文档
```

## 中文子集

运行时只加载：

```text
assets/fonts/NotoSansSC-Game.woff2
assets/fonts/NotoSerifSC-Game.woff2
```

两个字库覆盖当前游戏内全部可见汉字、标点、数字与符号。若新增剧情或界面文字，需要重新生成子集。原始 Noto 字体不随仓库提交；将 `NotoSansSC[wght].ttf` 与 `NotoSerifSC[wght].ttf` 放入 `assets/fonts/.src/` 后运行：

```powershell
node tools/build-cjk-fonts.mjs
pyftsubset assets/fonts/.src/NotoSansSC.ttf --text-file=assets/fonts/.src/chars.txt --flavor=woff2 --output-file=assets/fonts/NotoSansSC-Game.woff2 --layout-features=kern,liga,clig,calt,locl --no-hinting
pyftsubset assets/fonts/.src/NotoSerifSC.ttf --text-file=assets/fonts/.src/chars.txt --flavor=woff2 --output-file=assets/fonts/NotoSerifSC-Game.woff2 --layout-features=kern,liga,clig,calt,locl --no-hinting
```

## 已知限制

- 仅支持桌面键盘与鼠标；暂不支持游戏手柄、触屏或移动端。
- 需要浏览器允许指针锁定；部分浏览器在切换窗口后需要重新点击画面。
- 存档是浏览器本地单槽位；清理站点数据会删除进度。
- 自动化测试默认使用 Windows 版 Edge 的安装路径；其他 Chromium 浏览器需要修改测试脚本中的可执行文件路径。
- 无头浏览器 FPS 不代表真实显示器上的垂直同步表现；应以帧时间与绘制调用为主要依据。
- 中文字体为按当前文本生成的子集；新增文本后若未重新生成，可能出现系统字体回退。
- 游戏包含心理压迫、感官失真、暗示性死亡与哀伤描写。建议佩戴耳机，并在合适的环境中游玩。
