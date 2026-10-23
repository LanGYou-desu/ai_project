# 自动搬史程序（B 站）

自动检索 B 站视频，统计评论区里 **@ 好友** 的比例，筛选出超过阈值的视频，然后自动在评论区 @ 好友，也可以只 @ 你在终端指定的 UID。

评论内容**只有 @**，不附带标题、链接或其他文字。单条评论最多 @ 10 人；好友或指定 UID 超过 10 个时，程序会把前 10 人放在首条评论里，再**回复自己这条评论**，继续 @ 后面的人。

程序会持续翻页搜索，直到找满 `max_posts_per_run` 个符合条件的视频，或搜索结果耗尽为止，不需要再设置“扫描多少个视频”。

> 仅用于个人、少量、经过好友同意的分享。批量 @、刷评论可能违反 B 站社区规则，存在账号被限制的风险。请先用 `scan` 和 `--dry-run` 确认效果，并保留默认的发布间隔。

## 功能

- 按关键词打开 B 站搜索页，并调用搜索接口自动翻页、去重。
- 抽样读取评论，统计「包含 @ 的评论数 / 抽样评论数」。
- 支持热门评论或最新评论、是否把楼中楼计入抽样。
- 比例严格大于 `min_at_ratio` 才入选。
- 持续搜索，直到找满指定数量或结果耗尽。
- 按 UID 自动解析好友或指定用户的当前昵称。
- 只发 @，不带任何多余文字。
- 发布后控制台输出每条评论的跳转链接（`#reply{rpid}`）。
- 单条评论最多 @ 10 人，自动分块；第 2 条起回复自己的首条评论。
- 自动搬运会记录已发布视频和 rpid，默认不重复发布。
- 指定用户模式：`run --uid ...` 使用同一套搜索和筛选，但只 @ 指定 UID；按 UID 独立去重，不写入主已发送记录。
- 额外支持用 `send` 手动指定单个视频和 UID 发送。
- 一键启动：双击 `一键搬史.bat`，可选择全部好友或指定 UID。
- 一键运行结束后可选择继续搬史或结束程序；继续会使用相同设置再执行一次。
- `scan` 只看结果不发评论；`run --dry-run` 展示完整发布计划。

## 环境

- Python 3.10+
- Playwright（Chromium）

```powershell
cd D:\CodeWorks\ai_project\devTools\shitMover
python -m pip install -r requirements.txt
python -m playwright install chromium
```

如果本机已经装过 Playwright 的 Chromium，第二步可以跳过。

## 快速开始

1. 编辑 `config.json`，填写好友 UID 和本次最高搬史次数：

```json
{
  "keywords": ["抽象", "搞笑"],
  "min_at_ratio": 0.3,
  "max_posts_per_run": 2,
  "friends": [123456789, 987654321]
}
```

`friends` 可以直接写 UID，程序会通过 B 站接口解析当前昵称；也可以写成 `{"mid": ..., "name": "..."}`。`name` 只作为接口解析失败时的兜底。

2. 登录一次：

```powershell
python shit_mover.py login
```

会弹出浏览器，扫码或账号登录，程序检测到登录成功后自动保存到 `browser_profile/`。

3. 建议先扫描确认比例：

```powershell
python shit_mover.py scan
```

4. 预览发布计划（不发布）：

```powershell
python shit_mover.py run --dry-run
```

5. 正式运行，二选一：

- **一键启动**：直接双击 `一键搬史.bat`，先选择全部好友或指定 UID，再输入本次最高搬史次数（直接回车使用 `config.json` 中的值）。
- **命令行**：

```powershell
# 正常模式：@ config.json 里的全部好友
python shit_mover.py run

# 指定用户模式：只 @ 指定 UID，不写入主已发送记录
python shit_mover.py run --uid "123456,789012"
```

`run` 默认会在发布前要求输入 `y` 确认；一键启动脚本会跳过这一步，以输入的最高次数作为确认。发布时控制台会逐条显示评论跳转链接。

## 命令

```text
python shit_mover.py login                      登录并保存 Cookie
python shit_mover.py scan                       只检索、统计、打印结果
python shit_mover.py run                        检索并 @ 全部好友
python shit_mover.py run --uid UID              检索并只 @ 指定 UID，不写入主记录
python shit_mover.py send <视频> --uid UID      手动发送单个视频
python shit_mover.py status                     查看主已发送记录
```

常用参数：

| 参数 | 说明 |
| --- | --- |
| `--config PATH` | 指定配置文件，默认 `config.json` |
| `--keyword 抽象,搞笑` | 覆盖配置里的关键词，可多次指定 |
| `--posts N` | 临时覆盖本次最高搬史次数 |
| `--dry-run` | 只展示计划，不发表评论 |
| `--yes` | 跳过发布前确认 |
| `--force` | 仅用于手动重试：忽略对应模式的已处理记录；正常搬运不要加 |
| `--headless` / `--headful` | 临时切换有头/无头浏览器 |
| `--guest` | `scan` 专用：不要求登录直接扫描（统计不准确，仅用于调试） |
| `--uid UID` | `run`/`send` 指定 UID，可重复或用逗号分隔；`run --uid` 使用独立的去重记录 |

`scan` 默认也会检查登录状态，因为未登录时 B 站通常只返回 3 条顶层评论，@ 比例会失真。

示例：

```powershell
python shit_mover.py scan --keyword 抽象,搞笑
python shit_mover.py run --posts 1 --dry-run
python shit_mover.py run --posts 1 --yes
python shit_mover.py run --uid "123456,789012" --posts 2 --dry-run
python shit_mover.py send BV1xx411c7mD --uid 123456 --dry-run
```

### 指定用户模式（`run --uid`，不计入主已发送记录）

原脚本的 `run` 支持用 `--uid` 只 @ 指定用户，搜索、阈值和数量限制与正常模式完全一样：

```powershell
# 只 @ 一个 UID
python shit_mover.py run --uid 123456

# 多个 UID；逗号分隔或重复 --uid 都可以
python shit_mover.py run --uid "123456,789012" --posts 2
python shit_mover.py run --uid 123456 --uid 789012

# 先预览
python shit_mover.py run --uid 123456 --dry-run
```

- 使用命令行指定的 UID，不读取 `config.json` 的 `friends`。
- 仍然自动搜索视频；评论仍然只有 @，超过 10 人会自动分块。
- **不参与主 `data/state.json` 的去重，也不写入主记录**，`status` 不会显示这些视频；因此之后正常模式仍可再次选中同一个视频发给全部好友，指定用户模式也不会被主记录挡住。
- 指定用户模式使用独立文件 `data/uid_state.json`，按每个 UID 分别记录已收到的视频，避免同一个 UID 重复收到同一个视频。多个目标 UID 时，会自动过滤掉已经收过该视频的人，只 @ 还没收到的人；只有全部都收过才跳过整个视频。正常模式不读取这个文件，删除它可以重置指定用户模式的去重记录。
- `--force` 会绕过去重，只在确认需要重试时使用。

### 额外：手动发送单个视频（`send`）

`send` 用于跳过搜索，直接指定一个视频和若干 UID 发纯 @ 评论：

```powershell
# 发送给一个 UID
python shit_mover.py send BV1xx411c7mD --uid 123456

# 发送给多个 UID；逗号分隔或重复 --uid 都可以
python shit_mover.py send "https://www.bilibili.com/video/BV1xx411c7mD/" --uid "123456,789012"
python shit_mover.py send BV1xx411c7mD --uid 123456 --uid 789012

# 先预览，不发布
python shit_mover.py send BV1xx411c7mD --uid 123456 --dry-run

# 跳过确认
python shit_mover.py send BV1xx411c7mD --uid 123456 --yes
```

- 第一参数支持 BVID 或包含 BVID 的完整视频链接。
- `--uid` 必填；程序会实时解析对应昵称。昵称重复时会报错，避免 @ 错人。
- 和自动搬运一样，评论只有 @；超过 10 人会自动分块，后续评论回复首条评论。
- `send` **不读取、不写入** `data/state.json`，也不占用 `max_posts_per_run`。因此它不会被算作“已发送”，同一个视频之后仍可能被自动搬运再次选中。
- 如果视频之前已经自动搬运过，`send` 仍会按本次明确指定的 UID 发送；请确认这是你想要的操作。
- 如果你要的是“自动搜索时只 @ 某个用户”，请用上面的 `run --uid`，而不是 `send`。

## 配置说明

```json
{
  "keywords": ["抽象"],
  "search_pages": 0,
  "min_at_ratio": 0.3,
  "sample_pages": 3,
  "comment_sort": "hot",
  "include_replies": false,
  "friends": [123456789],
  "comment_template": "",
  "reply_suffix": "",
  "mentions_per_comment": 10,
  "max_comment_length": 1000,
  "max_posts_per_run": 2,
  "post_delay_seconds": 10,
  "request_delay_seconds": 0.8,
  "require_confirm": true,
  "headless": false,
  "profile_dir": "browser_profile",
  "state_file": "data/state.json",
  "log_file": "data/run.log",
  "login_timeout_seconds": 300
}
```

| 字段 | 说明 |
| --- | --- |
| `keywords` | 搜索关键词数组 |
| `search_pages` | 每个关键词最多翻多少页；`0` 表示自动翻页直到找满或结果耗尽（硬上限 50 页） |
| `min_at_ratio` | @ 比例阈值，`0.3` 表示 30%，严格大于才入选 |
| `sample_pages` | 每个视频抽样多少页评论，每页 20 条 |
| `comment_sort` | `hot`（热门）或 `new`（最新） |
| `include_replies` | 是否把楼中楼回复也计入比例 |
| `friends` | 好友 UID 数组；可写整数或 `{"mid": ..., "name": "..."}` |
| `comment_template` | 默认留空；留空时首条评论只有 @，不要填写多余文字 |
| `reply_suffix` | 默认留空；留空时后续回复也只有 @ |
| `mentions_per_comment` | 每条评论 @ 人数，1~10，默认 10 |
| `max_comment_length` | 单条评论最大字符数，最大 1000 |
| `max_posts_per_run` | **本次最高搬史次数**：找满多少个符合条件的视频就停止搜索并发布 |
| `post_delay_seconds` | 两条评论/两个视频之间的基础间隔，会做 ±15% 随机化 |
| `request_delay_seconds` | 搜索、读取评论之间的间隔 |
| `require_confirm` | 手动运行 `run` 时是否要求输入 `y` 确认；一键脚本会传 `--yes` |
| `headless` | 是否无头运行；登录命令始终有头 |
| `profile_dir` | 浏览器登录状态目录，相对于配置文件 |
| `state_file` | 已处理记录，相对于配置文件 |
| `log_file` | 运行日志，相对于配置文件 |
| `login_timeout_seconds` | 等待手动登录的最长秒数 |

### “找满数量为止”怎么工作

`max_posts_per_run` 同时是搜索目标和发布上限。程序会：

1. 打开第一个关键词的搜索页，读第 1 页结果。
2. 逐个视频抽样评论，符合阈值就加入待发布列表。
3. 待发布列表达到 `max_posts_per_run` 时立即停止搜索。
4. 如果当前页不够，自动翻下一页；一个关键词搜完就换下一个关键词。
5. 所有关键词都搜完仍不够，就发布已找到的视频。

正常模式会跳过 `data/state.json` 里的视频；指定用户模式会过滤掉 `data/uid_state.json` 中已经收过该视频的目标 UID，只 @ 剩余用户；全部目标都收过才跳过。跳过项不会占用本次数量。

### 防重复搬运

- 正常模式每次搜索先查 `data/state.json`；已经搬运过的视频不会进入候选，也不会出现在发布计划里。
- 指定用户模式只查 `data/uid_state.json` 中目标 UID 的记录，不查主记录；它只写独立记录，不写主记录。因此主记录里的视频也可以单独发给新的指定 UID，但同一个 UID 不会在指定用户模式中重复收到。
- 同时按 BVID 和 AID 匹配；`done` 和 `partial` 都视为已搬运，避免中断后重发首条评论。
- 一键启动里的“继续搬史”使用相同设置，也走同一套去重，不会重复评论同一个视频。
- `--force` 会绕过去重，只应在确认需要重试时手动使用；一键启动不会传这个参数。

### @ 比例怎么算

默认对每个视频读取 `sample_pages` 页热门评论（每页 20 条），逐条检查：

- 评论的 `content.members` 非空（B 站记录的正式 @），或
- 评论文本中包含 `@`。

满足任意一条就算「带 @ 的评论」。比例 = 带 @ 评论数 / 实际抽样评论数。`include_replies=true` 时，楼中楼也会被计入分子和分母。

注意：这是抽样估算，不是全量统计。

### 超过 10 个好友或指定 UID 时

假设有 25 个目标，`mentions_per_comment` 为 10：

1. 首条评论：`@好友1 ... @好友10`。
2. 回复首条评论：`@好友11 ... @好友20`。
3. 继续回复首条评论：`@好友21 ... @好友25`。

评论正文只有 @，没有标题、链接或说明文字。

### 昵称重复

B 站接口用「昵称 -> UID」的映射建立 @ 关系。如果两个好友或指定 UID 当前昵称完全相同，映射会冲突，程序会直接报错并列出昵称。请确认账号，或暂时移除其中一个。昵称在程序启动时会实时解析，避免配置里的旧昵称失效。

## 一键启动

双击项目根目录的 `一键搬史.bat`：

1. 选择搬史模式：
   - `[1] 全部好友`：读取 `config.json` 的 `friends`，正常写入主已发送记录。
   - `[2] 指定 UID`：输入一个或多个 UID，只 @ 这些用户；不写入主记录。
   - `[3] 退出程序`。
2. 输入本次最高搬史次数；直接回车则使用 `config.json` 里的 `max_posts_per_run`。
3. 如果选了指定 UID，再输入 UID（多个用逗号分隔）。
4. 脚本会自动执行 `run --yes`；指定 UID 模式会追加 `--uid`。
5. 如果尚未登录，程序会打开登录页并等待扫码。
6. 成功运行结束后，控制台会给出：
   - `[1] 继续搬史`：使用相同的模式和次数再执行一次。
   - `[2] 结束程序`：退出并回到命令行。
7. 如果触发风控（退出码 4）或其他错误，程序会直接结束，不再询问是否继续，避免连续请求。
8. 运行结束后窗口会暂停，方便查看日志。

> 输入的数字只对本次启动生效；想固定默认次数，修改 `config.json` 的 `max_posts_per_run`。指定 UID 模式使用 `data/uid_state.json` 按 UID 分别去重；要更换指定用户，结束程序后重新启动即可。

## 数据与日志

- `data/state.json`：正常模式的主已发送记录，包含视频、状态、rpid、每条评论内容和跳转链接。**不要删除**，它是主去重记录。指定用户模式和 `send` 都不会写入这里。
- `data/uid_state.json`：指定用户模式的独立去重记录，按 UID 分别保存；不影响正常模式，也不在 `status` 中显示。删除它可以重置指定用户模式的去重。
- `data/run.log`：完整运行日志，包含每条评论的跳转链接。
- `browser_profile/`：浏览器登录状态，等同于账号 Cookie，**不要分享或提交到仓库**。

状态为 `partial` 表示首条评论已发出，但后续回复中断。默认会跳过 `partial`，避免重复发首条评论（主记录和指定用户记录都适用）。需要重发时使用 `--force`，并先手动检查原评论。

## 常见问题

**提示未登录 / `-101`**

```powershell
python shit_mover.py login
```

Cookie 会过期，重新登录即可。

**触发风控 `-352` / `12015` / `412`**

`HTTP 412` 通常是 B 站按请求量/IP 触发的限流（日志中返回的是 HTML 错误页），不是视频本身或配置错误。出现后程序会立即停止并提示，不再继续逐个视频重试。

处理建议：

- 停止运行，等待 10-30 分钟（严重时可能更久）再试；不要连续重跑。
- 把本次目标降到 2-5 个视频，`sample_pages` 调到 1-2，`request_delay_seconds` 调到 2-3 秒。
- 不要同时运行其他 B 站爬虫/脚本，也不要在短时间内反复切换网络。
- 可以先在浏览器中手动打开 B 站、完成验证或发一条评论后再运行。
- 日志里的“目标 100”会在短时间内产生数百次评论页请求，很容易触发 412；不建议一次跑这么多。

**评论区关闭 / `12002`**

该视频无法评论，程序会跳过并继续搜索。

**只统计到 3 条评论**

说明当前浏览器没有登录。`scan` 默认会要求登录；如果用了 `--guest`，请去掉该参数并先运行 `login`。

**搜索了很久还没找满**

说明当前关键词和阈值下符合条件的视频不够。可以降低 `min_at_ratio`、增加 `keywords`，或减少 `max_posts_per_run`。

**浏览器启动失败，提示目录被占用**

关闭之前由本程序打开、仍残留的 Chrome 窗口，或删除/改名 `browser_profile/` 后重新登录。

## 实现说明

- 登录、搜索、评论读取、发表评论都在 Playwright 的持久化浏览器上下文里完成；API 请求通过页面内 `fetch` 发出，自动携带登录 Cookie 和浏览器指纹。
- 搜索和发表评论使用 WBI 签名（`shitmover/wbi.py`）。
- @ 关系通过评论接口的 `at_name_to_mid` 参数提交，格式为 `{"昵称": UID}`；正文中只包含对应的 `@昵称`。
- 不依赖 B 站前端 Shadow DOM 选择器，前端改版时受影响较小。

## 目录结构

```text
shitMover/
├─ 一键搬史.bat            # 双击启动
├─ launch.py               # 一键启动：选择模式、输入次数/UID，并询问是否继续
├─ shit_mover.py           # 入口
├─ config.json             # 实际配置
├─ config.example.json     # 配置模板
├─ shitmover/
│  ├─ api.py               # 浏览器内 API 调用
│  ├─ cli.py               # 命令行、登录、浏览器会话
│  ├─ config.py            # 配置加载与校验
│  ├─ message.py           # 评论分块与 @ 映射
│  ├─ runner.py            # 搜索、筛选、发布流程
│  ├─ state.py             # 去重状态
│  └─ wbi.py               # WBI 签名
└─ tests/                  # 单元测试
```
