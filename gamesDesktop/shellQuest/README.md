# ARCHIVE-7 · 档案馆-7 —— 真实文件历险（REAL SHELL QUEST）

> 一个**真实发生在你磁盘上**的命令行解谜冒险：游戏会生成一个真实沙盒目录
> （`world/`），里面是真实的 txt / log / hex / tar 文件。你在内置终端里输入
> **真实命令**（`ls` / `cat` / `grep` / `base64 -d` / `find` / `untar` …）
> 逐层破解，找回自我封存的 ECHO 核心。你甚至可以退出游戏，用资源管理器
> 直接翻看这个世界。

- 类型：命令行考古冒险（单机解谜）
- 技术栈：Node.js（零第三方依赖）+ 原生 HTML/CSS/JS
- 可玩时长：40–60 分钟（3 幕 · 13 个口令），可重开
- 世界生成完全确定性：同一种子 → 同一份文件树、文件内容与 `世界清单.json`，可复现、可测试
- 默认只监听 `127.0.0.1`，不向局域网暴露命令执行接口

## 剧情

"大静默"之后，你是最后一批数据考古学家。代号 ECHO 的科研档案库在灾难
前夕自我封存，把钥匙拆成碎片散落在层层文件里。三幕层层深入：

| 幕 | 区域 | 主题 | 谜题要点 |
| -- | ---- | ---- | -------- |
| 1 | 门房大厅 | 找到入口 | 藏头诗、登记表推理、base64、修复日志 grep、温室日志 grep、种子文件 |
| 2 | 数据迷宫 | 深入地下 | rot13、十六进制（unhex）、tar 解压 + 凯撒移位、grep -n 定位、base64 碎片拼接 |
| 3 | 核心室 | 唤醒核心 | 四枚碎片按序拼接 + base64、XOR 解密 |

## 快速开始

```bat
start.bat          # 一键启动（自动生成世界并打开浏览器）
```

或手动：

```bash
node server.js             # 启动于 http://127.0.0.1:8767
node server.js --fresh     # 重新生成世界并重置进度
node lib/worldgen.js       # 只重新生成世界（可指定目录与种子）
node lib/worldgen.js . 1   # 会因目标危险而拒绝，不会误删源码
node test/run.js           # 运行全部 148 项测试
```

首次启动会在 `world/` 生成 **57 个真实磁盘文件**；其中 `迷宫/包裹.tar`
内含 3 个条目，因此清单里的内容单元总数为 **60**。进度保存在 `state.json`。

### 环境变量

| 变量 | 默认值 | 说明 |
| ---- | ------ | ---- |
| `PORT` | `8767` | 监听端口；设为 `0` 时由系统分配（测试用） |
| `HOST` | `127.0.0.1` | 监听地址；改成 `0.0.0.0` 会暴露到局域网，请谨慎 |
| `NO_BROWSER` | 未设置 | 设为 `1` 时不自动打开浏览器 |
| `WORLD_DIR` | `./world` | 沙盒世界目录（测试/多实例用） |
| `STATE_FILE` | `./state.json` | 存档文件（测试/多实例用） |
| `PUBLIC_DIR` | `./public` | 静态文件目录 |

## 世界生成与清单

- `lib/worldgen.js` 先写同目录下的临时 staging 目录，全部成功后再原子替换目标，
  避免半成品世界；启动时若发现清单版本、种子或文件缺失，会自动重建。
- `世界清单.json` 记录 `version` / `seed` / `diskFileCount` / `fileCount` / `files`，
  不再写入时间戳，保证同种子重复生成完全一致。
- 生成器拒绝把**项目根目录、项目上级目录、文件系统根目录、符号链接/目录联接**
  作为世界目录，防止 `node lib/worldgen.js .` 之类的误操作毁掉源码。

## 命令手册（游戏内输入 `help` 也可查看）

```
pwd  cd  ls  tree  cat  head  tail  find  grep  wc  sort
strings  xxd  unhex  base64  rot13  caesar  xor  stat  file
echo  untar  flag <答案>  hint  history  clear
```

- 别名：`type` = `cat`，`hex` = `xxd`，`clear` 由前端处理。
- `flag <答案>`：提交谜题答案（口令），推进剧情。
- `hint`：获取当前幕的提示；提示用完后不再增加计数。
- 管道可用：`cat 档案区/记录13.txt | base64 -d`，最多 8 级。
- `grep` 按**字面文本**搜索（不把模式当正则，避免 ReDoS）；`-i` 忽略大小写，
  `-n` 显示行号。`find <目录> [-name] <模式>` 支持 `*` 通配。
- `head` / `tail` 可跟行数；`ls -l` 显示大小；`sort -n` 按数字排序。
- `history` 最多保留 200 条；`clear` 只清屏，不改变进度。

## `untar`：唯一的写入路径

游戏内其他命令都是只读的；`untar <压缩包> <目标目录>` 是唯一会写磁盘的命令，
并且被严格限制：

- 目标目录与每个条目路径都必须落在沙盒内（词法 + realpath 双重边界）；
- 拒绝 tar 内的绝对路径、盘符、反斜杠、`..`、NUL 和 Windows 设备名（`NUL`/`CON`/`COM1`…）；
- 校验 tar 头校验和，只接受普通文件与目录条目，拒绝符号链接/设备条目；
- 最多 500 个条目、解压内容最多 32MB；
- 用 `wx`（O_EXCL）独占写入，**拒绝覆盖已有文件**；如果目标已存在且内容完全相同，
  则跳过并继续（因此重复解压同一 tar 是安全的）；
- 目标目录、父目录、条目目标在写入前后都会重新做 realpath 检查，
  拒绝通过符号链接/目录联接把文件写到沙盒外。

## 安全性设计

- **命令白名单**，无 shell 解释；禁用 `;` `&` `<` `>` 反引号 `$` `(` `)` `{` `}` `=`
  `%` `:` 反斜杠与 NUL，管道逐级校验，最多 8 级。
- **路径双重边界**：`lib/paths.js` 先做词法包含检查（挡 `..`、绝对路径、跨盘符），
  再对“最深的已存在祖先”做 `realpath` 检查（挡符号链接 / Windows 目录联接逃逸）。
- **递归遍历不跟随符号链接**：`tree` / `find` / `grep` 对每个目录子项重新做
  realpath 边界检查；`ls` 把链接标为 `@`。
- **Windows 保留设备名**（`CON`/`NUL`/`COM1`/`LPT1` 等）直接拒绝，避免打开设备挂起。
- **资源上限**：单条命令执行 5 秒、输出 1MB、文本读取 4MB、tar 包读取 16MB、
  `xxd` 只读前 1024 字节、`find`/`tree`/目录列表/匹配数分别 2000/800/5000/5000、
  历史 200 条。
- **HTTP 侧**：默认绑定 `127.0.0.1`；API 校验 Host（防 DNS rebinding）与
  Origin/Host 同源（防 CSRF）；POST 必须带 `Content-Type: application/json`；
  请求体上限 1MB，超限返回 413；命令行上限 10000 字符；设置 request/headers/
  keep-alive 超时；静态文件限定在 `public/` 内并做 realpath 检查，响应带
  `Cache-Control: no-store` 与 `X-Content-Type-Options: nosniff`。
- **已知残余风险**：硬链接无法通过 realpath 识别（能创建硬链接的本地攻击者
  本来就能直接读该文件）；世界目录本身是真实目录，拥有本机文件系统权限的人
  可以直接查看/修改它。游戏假设本机是可信环境。

## HTTP API

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `POST` | `/api/exec` | `{"line":"cat 欢迎.txt"}`，返回 `{output, code, cwd, state}` |
| `GET` | `/api/state` | 当前进度、幕次、任务、故事、统计 |
| `POST` | `/api/reset` | 重置进度；`?world=1` 同时重新生成世界 |
| `GET` | `/api/manifest` | `{version, seed, fileCount, diskFileCount}` |

## 测试

`node test/run.js` 运行 **148 项断言**（全部通过），覆盖：

- 世界生成确定性、清单确定性、清单字段与真实文件一致、staging 清理、
  世界目录安全（拒绝项目根/上级/根目录/链接目录）、陈旧世界检测；
- 沙盒安全：`..`、绝对路径、盘符、UNC、ADS、反引号、`$()`、重定向、管道注入、
  Windows 设备名、NUL/换行注入等攻击全部拒绝；
- 符号链接 / 目录联接边界：读取、递归遍历、`untar` 写入全部无法逃出沙盒；
- `untar` 安全：覆盖、`../` 穿越、绝对路径、盘符、反斜杠、无效 tar、
  目标为文件、重复解压相同内容；
- 命令正确性：cat/grep/find/base64/rot13/caesar/xor/unhex/untar/管道/别名/上限；
- 口令、幕次、提示、存档原子写入、损坏存档回退、`normalizeData` 过滤；
- **全流程通关**：按谜题设计解法，13 个口令全部解开，游戏完成；
- 服务器安全：静态路径穿越、非 JSON、跨站 Origin、非法 Host、
  1MB body 返回 413、`--fresh` 重置进度。

## 目录结构

```
shellQuest/
├── server.js            # 服务器：静态页面 + /api/exec 真实命令执行
├── lib/
│   ├── worlddata.js     # 剧情内容与谜题数据
│   ├── worldgen.js      # 确定性世界生成器（原子替换 + tar 打包）
│   ├── commands.js      # 安全命令引擎（真实读取沙盒文件）
│   ├── paths.js         # 词法 + realpath 双重路径边界守卫
│   ├── state.js         # 进度 / 口令 / 提示 / 幕次
│   ├── crypto-utils.js  # base64 / rot13 / caesar / xor / hex
│   └── rng.js           # 种子随机数
├── public/              # 终端界面（index.html / style.css / app.js）
├── test/run.js          # 148 项测试
├── world/               # 生成的真实沙盒世界（不入库）
├── 世界清单.json         # 世界文件清单（不入库）
└── start.bat
```
