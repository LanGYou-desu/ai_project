# DevSaga · 程序员模拟器

> 一个既能玩又能学的程序员职场养成游戏：**11 种开发环境、79 个任务、33 道课后测验、51 篇知识手册、多结局剧情、11 套专属工作台 UI**。
> 零第三方依赖，纯 Python 3.10+ 标准库实现。

你在「Glitchworks 公司」当程序员：凌晨的服务器告警、被搞崩的 git 历史、
满是脏数据的数据库、连环崩的容器、周五 17:00 的发布流水线、上线即翻车的前端……
每个场景都是一次真实的排障之旅，通关后系统会给你讲透背后的知识点。

---

## ✨ 亮点

| 特色 | 说明 |
| --- | --- |
| 🎮 **11 大开发环境** | 终端 / Git / 调试 / SQL / 运维 / 算法 / 网络 / Docker / CI/CD / 前端 / 安全 |
| 🖥️ **11 套专属工作台** | 网页版按场景渲染实时状态面板：容器控制台、安全运营中心、发布控制台…… |
| 🧠 **边玩边学** | 51 篇知识手册（12 类）+ 11 场景课后测验（33 题）+ 知识掌握进度 |
| 🎭 **多结局剧情** | 技术力 / 沟通力 / 冒险精神三条属性线，抉择改变命运 |
| ⚙️ **三档难度** | 简单（提示多、XP×1.5）/ 标准 / 地狱（步数上限 60、能量消耗翻倍） |
| 👾 **人机都能玩** | 人类玩网页版/终端版；机器用 `--bot` / `--grade` / `--serve` / RL 接口玩 |
| 🎓 **算法竞技场** | 15 道题（哈希/双指针/DP/递归/二分/滑动窗口）+ 沙箱判题 |
| 🏆 **养成系统** | 职级路线（实习 → 传奇）、绩效 XP、16 个成就、工单最佳成绩 |
| ☕ **职场彩蛋** | 咖啡能量、7 种办公室小剧场、剧情抉择、音效与彩带动效 |

## 📦 快速开始

**⚡ 一键入口（Windows 推荐）：** 双击项目根目录的 `启动DevSaga.bat`，选择：

```
[1] Play in browser  （网页版，推荐 —— 浏览器里玩，不用终端）
[2] Play in terminal （经典终端版）
[3] 机器人演示（10 个场景全通关）
[4] 算法判题（提交你的解答文件）
[5] 创建桌面快捷方式（以后双击桌面图标就能玩）
[0] 退出
```

**🌐 网页版**：浏览器打开 `http://127.0.0.1:8766`——**Glitchworks 工位工作台**，
每个场景都有自己的专属工作台 UI，且交互高度拟真：

- **真实终端**：行内输入 + 闪烁光标 + ↑↓ 命令历史 + Ctrl+L 清屏，
  提示符实时反映环境（`dev@glitchworks:/opt/app$` 跟随 cd 变化、
  `(main) dev@glitch:~/repo$` 跟随分支变化、`mysql>`、`root@server:~#`…）
- **真实编辑器（算法竞技场）**：行号 + Python 语法高亮 + Tab 缩进 +
  Ctrl+Enter 判题，用例结果面板逐条显示期望/实际输出
- **场景专属工作台面板**：

| 场景 | 工作台 | 场景 | 工作台 |
| --- | --- | --- | --- |
| 终端老兵 | 🖥️ 终端工作台 | 容器风暴 | 🐳 容器控制台 |
| Git 时空冒险 | 🔀 Git 工作台 | 发布流水线 | 🚀 发布控制台 |
| 调试侦探 | 🐞 调试工作台 | 前端魔法屋 | 🎨 前端调试台 |
| 数据库救援 | 🗄️ 数据库工作台 | 安全防线 | 🛡️ 安全运营中心 |
| 系统急救 | 📊 监控工作台 | 网络侦探 | 🌐 网络诊断台 |
| 算法竞技场 | ⚙️ 判题工作台 | | |

另有工单系统（DEV-001 编号/优先级/报修人）、职业路线、知识库（51 篇）、
成就墙、音效与彩带动效。手动启动：

```bash
python main.py --web [端口]   # 默认 8766，自动打开浏览器
```

命令行方式：

```bash
cd devsaga
python main.py            # 进入主菜单（终端版）
python main.py --bot      # 看机器人 10 场景全通关
python main.py --demo     # 同上（流式输出版）
```

主菜单里选「1」即可开始游戏。存档保存在 `~/.devsaga/save.json`。

## 🎮 游戏方式（人类）

```
主菜单 → 1 选择场景
```

每个场景里你面对一个模拟环境（虚拟文件系统 / git 仓库 / 数据库 / 服务器……），
用真实的命令完成任务：

```text
dev@glitchworks:~$ find / -name config.ini
dev@glitchworks:~$ cat /opt/app/config.ini
dev@glitchworks:~$ grep -c " 500 " /opt/app/logs/access.log
5
```

- `help` 查看环境命令手册　`hint` 提示　`learn` 当前任务知识点
- `skip` 跳过任务　`coffee` 喝咖啡回能量　`exit` 保存退出
- 场景通关后回主菜单可能触发「命运的岔路口」抉择（影响属性与结局）
- 主菜单：课后测验（满分有成就）、命运结算、难度切换

## 🎭 玩法系统

- **属性**：技术力（tech）/ 沟通力（comm）/ 冒险精神（risk）——
  小剧场回应和剧情抉择都会积累属性
- **结局**：通关数 + 属性决定 5 种结局（技术掌舵人 / 创业合伙人 / 独立开发者 /
  稳定打工人 / 实习生）
- **难度**：`简单`（失败 1 次给提示、每 2 步耗 1 能量、XP×1.5）、`标准`、
  `地狱`（失败 5 次才提示、步数上限 60、每步耗 2 能量、XP×1.2）
- **成就**：15 个——学霸（测验满分）、容器忍者、流水线大师、前端巫师、地狱难度……

## 🤖 机器也能玩

### 1. 内置机器人（演示机器通关）

```bash
python main.py --bot                  # 通关全部 10 个场景
python main.py --bot terminal_master  # 只通关指定场景
```

### 2. 判题模式（给你的 AI 提交作业）

```bash
python main.py --grade algo_arena 我的解答.py      # 判 12 道算法题
python main.py --grade terminal_master 脚本.txt    # 按脚本逐行执行命令
```

### 3. TCP 机器接口（外部程序 / AI 远程接入）

```bash
python main.py --serve 8765            # 启动服务
python examples/ai_client.py           # 示例客户端（JSON 协议）
```

协议：每行一个 JSON —— `{"type":"reset","scenario":"terminal_master"}`、
`{"type":"step","text":"ls"}`、`{"type":"observe"}`。

### 4. 强化学习接口（Gym 风格）

```python
from game.env import DevSagaEnv
env = DevSagaEnv("terminal_master")
obs = env.reset()
out, reward, done, info = env.step("ls")   # 动作 = 命令字符串
```

开箱即用的 Q-learning 演示：

```bash
python examples/rl_demo.py 300
```

它会从"乱敲命令"开始，通过试错把平均奖励从负值学到 +46，
最终 7 步通关《终端老兵》——演示中还埋了一个经典的 RL 知识点：
「链式动作」需要正确的状态表示（子目标标记），注释里有详细讲解。

## 🗺️ 场景一览

| ID | 场景 | 环境 | 难度 | 任务 | 学什么 |
| --- | --- | --- | --- | --- | --- |
| `terminal_master` | 终端老兵 | Linux shell | ★ | 6 | find / grep / tail / 重定向 / chmod / 管道 |
| `git_quest` | Git 时空冒险 | git | ★★ | 7 | log / show / revert / reflog / cherry-pick / stash / merge |
| `debug_detective` | 调试侦探 | 代码推理 | ★★ | 8 | 7 类经典 Bug + 交互式单步调试器 |
| `sql_rescue` | 数据库救援 | SQL | ★★ | 6 | SELECT / WHERE / JOIN / GROUP BY / UPDATE |
| `sysadmin_er` | 系统急救 | 服务器监控 | ★★ | 6 | top / kill / df / du / systemctl / netstat |
| `algo_arena` | 算法竞技场 | 判题沙箱 | ★★★ | 12 | 哈希/双指针/DP/递归/二分/滑动窗口 |
| `network_sleuth` | 网络侦探 | 网络诊断 | ★★ | 6 | ping / DNS / curl / iptables / tcpdump |
| `container_storm` | 容器风暴 | Docker | ★★ | 6 | ps / logs / inspect / update --memory / network |
| `pipeline_deploy` | 发布流水线 | CI/CD | ★★ | 6 | build / test / lint 门禁、蓝绿发布、rollback |
| `frontend_magic` | 前端魔法屋 | 浏览器调试 | ★★ | 6 | DOM / JS 错误 / 事件绑定 / 盒模型 / 性能 |
| `security_fortress` | 安全防线 | 安全审计 | ★★ | 7 | 日志溯源 / SQLi / XSS / 弱口令 / 防火墙 |

## 📁 项目结构

```
devsaga/
├── main.py                 # CLI 入口（菜单 / --web / --bot / --grade / --serve / --learn）
├── web/                    # 网页版前端（index.html / app.js / style.css）
├── game/
│   ├── engine.py           # 游戏引擎：档案/存档/成就/事件/剧情抉择/结局/难度/场景循环
│   ├── terminal.py         # ANSI 终端 UI（面板/表格/进度条）
│   ├── parser.py           # 命令分词与归一化
│   ├── sandbox.py          # 算法判题沙箱（AST 静态检查 + 子进程隔离 + 超时）
│   ├── lessons.py          # 知识手册（44 篇）+ 课后测验（10 场景 × 3 题）
│   ├── webui.py            # 网页版后端（本地 HTTP + JSON API + 命令面板）
│   ├── bot.py              # 机器人模式（用参考脚本驱动同一引擎）
│   ├── serve.py            # TCP JSON 机器接口
│   ├── env.py              # Gym 风格 RL 接口
│   └── scenarios/          # 10 个场景（每个是独立开发环境模拟器）
├── examples/
│   ├── ai_client.py        # 外部 AI 接入示例
│   └── rl_demo.py          # Q-learning 从零学打游戏
└── tests/                  # 54 个单元测试（python -m unittest discover -s tests）
```

## 🧪 测试

```bash
python -m unittest discover -s tests -v
```

覆盖：沙箱安全与判题、SQL 引擎、虚拟文件系统、全部 11 个场景参考脚本通关、
新场景状态机（Docker/流水线/前端/安全）、15 道算法题判题、课后测验、难度系统、
命运结算、11 套工作台面板、网页版 API 全流程（含编辑器判题）。机器人 + 58 个测试全绿。

## 🔬 技术要点

- **场景框架**：`Scenario` / `Task` 基类 + `handle(cmd)` 命令分发，新增场景只需继承并注册
- **IO 抽象**：`HumanIO` / `ScriptIO` 让同一套引擎同时服务人类、机器人、测试、TCP
- **判题沙箱**：AST 静态检查（禁危险 import/内置）+ `python -I` 隔离 + 2s 超时 + 输出截断
- **迷你 SQL 引擎**：支持 WHERE / 多表 JOIN / GROUP BY 聚合 / DISTINCT / 排序 / 增删改
- **迷你 git**：提交图 / 分支 / stash / reflog / revert / cherry-pick / merge
- **难度系统**：提示阈值 / 步数上限 / 能量消耗 / XP 倍率全配置化
- **多结局系统**：属性驱动 + 通关数，纯数据驱动，加结局只需改 `ENDINGS`
- **Windows 兼容**：自动启用 ANSI、UTF-8 处理，全平台可跑

## 📖 更多

- 设计文档见 [docs/DESIGN.md](docs/DESIGN.md)
- 想加场景？照着 `game/scenarios/` 里任一文件写一个类，在
  `game/scenarios/__init__.py` 的 `ALL_SCENARIOS` 里注册即可
