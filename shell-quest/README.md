# ARCHIVE-7 · 档案馆-7 —— 真实文件历险（REAL SHELL QUEST）

> 一个**真实发生在你磁盘上**的命令行解谜冒险：游戏会生成一个真实沙盒目录
> （`world/`），里面是真实的 txt / log / hex / tar 文件。你在内置终端里输入
> **真实命令**（`ls` / `cat` / `grep` / `base64 -d` / `find` / `untar` …）
> 逐层破解，找回自我封存的 ECHO 核心。你甚至可以退出游戏，用资源管理器
> 直接翻看这个世界。

- 类型：命令行考古冒险（单机解谜）
- 技术栈：Node.js（零第三方依赖）+ 原生 HTML/CSS/JS
- 可玩时长：40–60 分钟（3 幕 · 13 个口令 · 60+ 谜题节点），可重开
- 世界生成完全确定性：同一种子 → 同一个世界，可复现、可测试

## 剧情

"大静默"之后，你是最后一批数据考古学家。代号 ECHO 的科研档案库在灾难
前夕自我封存，把钥匙拆成碎片散落在层层文件里。三幕层层深入：

| 幕 | 区域 | 主题 | 谜题要点 |
| -- | ---- | ---- | -------- |
| 1 | 门房大厅 | 找到入口 | 藏头诗、登记表推理、base64、日志检索 |
| 2 | 数据迷宫 | 深入地下 | rot13、十六进制、tar 解压、凯撒移位、grep -n 定位 |
| 3 | 核心室 | 唤醒核心 | 多文件拼接、base64、XOR 解密 |

## 快速开始

```bat
start.bat          # 一键启动（自动生成世界并打开浏览器）
```

或手动：

```bash
node server.js     # 启动于 http://127.0.0.1:8767
node server.js --fresh   # 重新生成世界并重置进度
node lib/worldgen.js     # 只重新生成世界（可指定目录与种子）
node test/run.js         # 运行全部测试
```

首次启动会在 `world/` 生成真实沙盒文件（约 60 个），进度保存在 `state.json`。

## 命令手册（游戏内输入 help 也可查看）

```
pwd  cd  ls  tree  cat  head  tail  find  grep  wc  sort
strings  xxd  unhex  base64  rot13  caesar  xor  stat  file
echo  untar  flag <答案>  hint  history  clear
```

- `flag <答案>`：提交谜题答案（口令），推进剧情。
- `hint`：获取当前幕的提示。
- 管道可用：`cat 档案区/记录13.txt | base64 -d`。

## 安全性设计

- 命令**白名单** + **只读**：没有任何写入/删除/执行系统命令的能力。
- 路径强制限定在沙盒根目录内：拒绝 `..`、绝对路径、盘符与 UNC。
- 禁止 shell 元字符（`;` `&` `<` `>` 等），管道逐级校验，无 shell 解释。
- 输出与读取均有上限，防止滥用。

## 测试

`node test/run.js` 运行约 40+ 项断言：

- 世界生成确定性（两次生成内容一致）
- 沙盒安全（`cd ..`、`cat C:/Windows/...`、`rm`、`;`、`&&`、反引号等全部拒绝）
- 命令正确性（cat/grep/find/base64/rot13/caesar/xor/untar/管道…）
- **全流程通关**（用脚本按谜题设计解法，13 个口令全部解开，游戏完成）

## 目录结构

```
shell-quest/
├── server.js            # 服务器：静态页面 + /api/exec 真实命令执行
├── lib/
│   ├── worlddata.js     # 剧情内容与谜题数据
│   ├── worldgen.js      # 确定性世界生成器（含 tar 打包）
│   ├── commands.js      # 安全命令引擎（真实读取沙盒文件）
│   ├── state.js         # 进度 / 口令 / 提示 / 幕次
│   ├── crypto-utils.js  # base64 / rot13 / caesar / xor / hex
│   └── rng.js           # 种子随机数
├── public/              # 终端界面（index.html / style.css / app.js）
├── test/run.js          # 测试
├── world/               # 生成的真实沙盒世界（不入库）
├── 世界清单.json         # 世界文件清单（不入库）
└── start.bat
```
