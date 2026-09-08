# 赛博安全学院 — 从原理到实战 · 网络安全训练营

> 🕹️ 一款面向**零基础小白 → 有一定经验的安全专家**的完整训练体系：
> **课本式课程(13门×5章=65章) → 示例教学(13个demo) → 10关实战(其中7关各含1个扩展场景) → 20个挑战 → 真实本地靶场(5类漏洞) → 真实CLI工具链(8个) → 小型教材(docs 15章+4附录)**
> 不局限于网页：真实端口扫描器、真实抓包分析、真实命令行工具、真实练习素材一应俱全。

---

## 🚀 快速开始

**一键启动（推荐）**：
```powershell
.\start.ps1     # 或双击 start.bat
# 自动: 生成练习素材 → 启动游戏+靶场 → 打开浏览器
```

**手动启动**：
```bash
node server.js
# 游戏: http://localhost:8080   靶场: http://127.0.0.1:8090
node server.js --no-lab          # 只启动静态站 (游戏退回模拟模式)
PORT=9000 node server.js         # 改端口 (HOST 同理, 默认只绑 127.0.0.1)
node lab/lab.js                  # 只启动靶场
```

**只玩网页版**：直接双击 `index.html`（纯前端零依赖，无靶场）。
> 注意：`file://` 页面的 Origin 为 `null`，靶场会拒绝其调用**命令注入/文件读取**等危险端点（安全边界）。
> 想用 `lab exec` / `lab read`，请用 `http://localhost:8080` 打开游戏。

---

## 🎓 从 0 到专家的学习路线

```
① 学原理     course 1~13   13 门课 × 5 章 = 65 章课本 (每章: 原理→示例→输出→练习)
② 看示例     demo <主题>    13 个教学录像 (先看怎么做, 再自己动手)
③ 打关卡     L0~L9         10 关, 其中 L1~L7 各有 1 个扩展任务场景 (scenario)
④ 做挑战     challenge     20 个独立挑战 (密码/逆向/取证/日志/流量/钓鱼/OSINT/AI注入...)
⑤ 上靶场     lab / browser 真实本地靶场: 真实 SQLite 注入/命令注入 RCE/越权/路径穿越
⑥ 用真工具   tools/*.js    在真实终端跑真实扫描器/爆破器/抓包分析 (配合 practice/ 素材)
⑦ 查教材     docs          15 章手册 + 4 附录 + 40 条术语表 (docs term <词>)
```

---

## 📚 十关战役（L1~L7 各带 1 个扩展场景）

| 关卡 | 主题 | 主线任务 | 扩展场景 (scenario) |
| --- | --- | --- | --- |
| L0 | 新兵训练营 | 终端/扫描/连接 | — |
| L1 | 网络侦察 | 扫描+banner 找后门 | 档案服务器深挖 |
| L2 | 密码破译 | Base64→ROT13→维吉尼亚 | XOR 密文 |
| L3 | Web 渗透 | SQLi+XSS (真实靶场可鼠标操作) | 配置泄露 |
| L4 | 逆向工程 | 汇编/patch 绕过 | 第二道锁 (strings 挖明文) |
| L5 | 数字取证 | 魔数/strings/隐写 | GPS 情报 (EXIF) |
| L6 | 终极渗透 | 侦察→SQLi→爆破→SSH→收flag | root 权限 (shadow 爆破) |
| L7 | 应急响应 🛡️ | 日志分析→定位后门→隔离 | 同源排查 (威胁狩猎) |
| L8 | 恶意文件分析 🦠 | PE 样本静态分析→解码载荷 | — |
| L9 | AI 安全 🤖 | 提示注入让 AI 泄露机密 | — |

- 主线目标**只讲目标不剧透解法**（自动测试保证）
- `hint` 3 级渐进提示（思路→方向→答案，高等级扣 XP）；**主线与扩展场景的提示进度互相独立**
- 右上角**常驻任务面板**实时显示当前场景目标（`panel on|off`）

---

## 🧩 二十个挑战

弱口令攻坚 / 凯撒连环 / XOR之秘 / 十六进制猎手 / 魔数侦探 / 日志追凶 / 漏洞猎人 / 彩虹之下(SHA256) / 命令注入实战⚡ / 任意文件读取⚡ / 编码多米诺 / 哈希三连 / 端口侦探 / 代码审计二 / **流量分析(pcap 面板)** / 日志分析二 / **钓鱼甄别(邮箱 GUI)** / **AI 提示注入** / **OSINT 情报拼图** / **WiFi 握手包爆破**

> ⚡ = 需本地靶场；`board` 看本机最佳用时与错误数排行榜

---

## 🧰 真实工具链（非 Web，在你的真实终端里跑）

```bash
node tools/scanlab.js 127.0.0.1 --ports 1-1000    # 真实 TCP 端口扫描
node tools/bannerlab.js 127.0.0.1 1337            # 真实 banner 抓取
node tools/hashlab.js sha256 password             # 真实哈希计算 (md5/sha1/sha256/sha512)
node tools/cracklab.js <哈希>                     # 真实字典爆破 (rockyou-mini)
node tools/hexlab.js practice/crackme.bin         # 真实 hexdump
node tools/stringslab.js practice/usb.dd          # 真实 strings
node tools/httplab.js login <url> "admin'--" x    # 真实 HTTP 注入客户端
node tools/pcapgen.js practice/login.pcap hunter2 # 生成真实 pcap (Wireshark 可开)
node make-practice.js                             # 生成全部练习素材
```

**真实练习素材** (`practice/`)：`crackme.bin`(ELF)、`usb.dd`(磁盘镜像)、`login.pcap`(**Wireshark 打开找明文密码**)、`phishing.eml` + `normal.eml`(钓鱼/正常邮件对比)、`auth.log`/`web.log`(日志)；弱密码字典生成到 `tools/rockyou-mini.txt`。

**真实浏览器模式**：靶场在线时输入 `browser`，游戏内打开真实浏览器窗口——用鼠标点登录框、手工输 SQL 注入。

---

## 🔐 靶场的安全边界（漏洞是"故意"的，但不允许外溢）

靶场 5 类漏洞（SQL 注入 / XSS 反射 / 命令注入 RCE / IDOR 越权 / 路径穿越）**全部保留真实可打**，但被限制在本地沙箱内：

| 边界 | 说明 |
| --- | --- |
| 只绑 127.0.0.1 | 静态站 + 靶场全部服务均不监听局域网 |
| 静态站白名单 | 只对外提供 `index.html` / `css/` / `js/`；靶场机密、源码、测试、练习素材一律 404 |
| 路径穿越沙箱 | `/api/read` 仍可 `../../server.js` 逃出 `lab-files`，但**读不到项目目录之外**的系统文件 |
| 命令注入限额 | 真实执行，但 3 秒超时 + 64KB 输出上限 + 4 并发上限；超时**杀掉整棵进程树**（不留孤儿进程） |
| 跨站防护 | 危险端点（ping/read/ssh/banner/scan）只接受本机 Origin；`curl`/工具/靶场自身页面不受影响 |
| 请求体上限 | 超过 64KB 返回 413；畸形请求目标返回 400，不会拖垮进程（游戏与靶场同进程） |
| TCP 上限 | 后门/SSH 服务单行缓冲 8KB + 30 秒空闲超时，防内存膨胀与连接悬挂 |

> 修复建议（教学内容）：参数化查询、输出转义、禁止拼接 shell、路径规范化 + 白名单目录、服务端鉴权。

---

## ⌨️ 命令速查（全部）

| 分类 | 命令 |
| --- | --- |
| 流程 | `start` `resume` `next` `save` `reset` `clear` |
| 状态 | `help` `mission` `status` `levels` `map` `hint` `learn` |
| 学习 | `course <n> <章>` `quiz <n>` `demo <主题>` `docs <章>` `docs term <词>` `docs search <词>` `guide` |
| 挑战 | `challenge <n>` `submit <flag或答案>` `ai <内容>` `board`（排行榜）`mistakes`（错题本） |
| 任务 | `scenario <编号\|main>`（扩展场景） |
| 靶场 | `lab` `lab get <文件>` `lab exec <命令>` `lab read <路径>` `lab open` `browser` `browser close` |
| 界面 | `theme <名称>` `panel on\|off` `sound on\|off` `export`（学习报告） |
| 文件 | `ls` `cat <文件>` `file <文件>` `strings <文件>` `tail <文件>` `hexdump <文件>` |
| 密码 | `b64 -d\|-e` `rot13` `caesar -s <位移>` `vig -e\|-d -k <密钥>` `xor -k <密钥>` `md5` `sha256` `crack <哈希>` |
| 工具 | `tools`（列表）`tools <命令>`（手册） |
| 其它 | `credits` |

> Tab 可补全命令/文件名；`help <关键词>` 可检索。每关还有专属命令（如 `scan`/`login`/`quarantine`/`ask`），输入 `help` 查看当前关卡可用命令。

## 🎨 界面与辅助

- `theme`：6 套 UI（绿光/琥珀/海蓝/白底/紫罗兰/矩阵雨）
- `panel`：右上角任务面板开关（实时显示当前场景目标）
- `docs`：**15 章**安全手册 + 4 附录（命令/端口/魔数/术语速查）+ `docs term <词>` 术语查询
- `tools <命令>`：14 个工具的实操手册（用法+示例+预期输出）
- **25 个成就**、XP/等级体系、自动存档（存档含关卡/场景/提示进度，可 `resume` 续玩）
- 防刷分：测验每题仅首次得分；`hint` 高等级提示扣 XP 且用满不再重复扣

---

## 🧪 测试（8 套，共 371 项断言）

```bash
# 逐个跑 (全部必须全绿)
node test/smoke.js               # 82 项: 密码学/课程/挑战/场景/教材/主题/示例与实现一致性
node test/playthrough.js         # 146 项: 10 关 + 扩展场景 + 20 挑战 + 全部命令 + 存档
node test/lab-test.js            # 46 项: 真实靶场 5 类漏洞 + MiniSQL 降级引擎
node test/lab-game-test.js       # 25 项: 游戏×靶场端到端
node test/lab-security-test.js   # 24 项: 靶场安全边界 (沙箱/跨站/超时/并发/孤儿进程)
node test/audit.js               # 16 项: 文档与教学完整性审计
node test/server-test.js         # 14 项: 静态服务器安全 (穿越/白名单)
node test/tools-test.js          # 18 项: 真实 CLI 工具链 + 参数错误处理

# 一次跑完 (bash)
for f in audit lab-game-test lab-security-test lab-test playthrough server-test smoke tools-test; do node test/$f.js || exit 1; done
```

> 测试全部零依赖、无需网络（仅连接本机临时端口）。

---

## 📁 项目结构

```
cyber-academy/
├── index.html / server.js / start.ps1 / start.bat / server-run.ps1
├── css/style.css              # 6 套主题 + 面板 + GUI
├── js/
│   ├── crypto.js  core.js  tools.js  main.js
│   ├── course.js              # 13 门课 × 5 章 + 测验
│   ├── challenges.js          # 20 个挑战 + GUI (pcap/邮箱)
│   ├── demo.js                # 13 个示例教学
│   ├── docs.js                # 知识手册 + 术语表
│   ├── lab.js                 # 靶场客户端 + 真实浏览器
│   └── levels/level0~9.js     # 10 关 (含扩展场景)
├── lab/lab.js                 # 真实靶场 (SQLite/HTTP/TCP/5类漏洞 + 安全边界)
├── tools/                     # 真实 CLI 工具链 (8 个) + rockyou-mini.txt
├── practice/                  # 真实练习素材 (pcap/eml/日志/二进制)
├── make-practice.js           # 素材生成器
├── docs/评审与优化报告.md      # 历史评审记录
└── test/                      # 8 套自动化测试 (371 断言)
```

---

## ⚠️ 免责声明

所有靶机/目标均为本地虚构，仅供学习。真实世界请只对**你有权测试的系统**使用这些技术。
靶场仅绑定 127.0.0.1，切勿暴露公网。

> 🎓 技术本身没有善恶，选择的人才有。—— 学院院长
