# The History Reader · 历史朗读者

把你的浏览器历史变成一首关于今天的小说。

## 是什么

不是分析工具，不是监控软件。这是一个把你的浏览数据转化为文学叙事的装置。

它读取你指定时间段的浏览器历史，找到其中的节奏——寻找、停留、切换、漂移——然后把这些模式写成一段关于你的短篇小说。

## 支持的浏览器

- Google Chrome
- Microsoft Edge
- Chromium（含同结构的衍生浏览器）

三者都是 Chromium 内核，`History` 数据库结构相同。会自动读取 `Default` 与 `Profile 1/2/…` 等所有 profile，按 Chrome → Edge → Chromium 的顺序取第一个存在的库。

各平台查找路径：

| 平台 | 路径 |
| --- | --- |
| Windows | `%LOCALAPPDATA%\Google\Chrome\User Data\<Profile>\History`、`%LOCALAPPDATA%\Microsoft\Edge\User Data\<Profile>\History` |
| macOS | `~/Library/Application Support/Google/Chrome/<Profile>/History`、`~/Library/Application Support/Microsoft Edge/<Profile>/History`、`~/Library/Application Support/Chromium/<Profile>/History` |
| Linux | `~/.config/google-chrome/<Profile>/History`、`~/.config/microsoft-edge/<Profile>/History`、`~/.config/chromium/<Profile>/History` |

Windows 上已实测；macOS / Linux 的路径按各平台约定实现，未在真机验证。

## 怎么运行

需要 Node.js ≥ 16。

1. 确保已安装 Chrome / Edge / Chromium
2. 双击 `start.bat`
3. 浏览器会自动打开 `http://127.0.0.1:8769`
4. 选时间段，看一段关于你的小说

## 手动运行

```bash
npm install        # 只有一个依赖：sql.js（纯 JS SQLite）
npm start          # 等价于 node server.js
```

然后访问 `http://127.0.0.1:8769`。

环境变量：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PORT` | `8769` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址（默认仅本机） |
| `HR_NO_OPEN` / `DSH_NO_OPEN` | — | 设为 `1` 时不自动打开浏览器（测试 / 服务器环境用） |
| `HR_ALLOW_REMOTE` | — | 设为 `1` 才允许非本机 `Host` 访问，配合 `HOST=0.0.0.0` 使用 |

## 时间段选择

页面上可以选预设区间（1 / 3 / 7 / 14 / 30 天，默认 7 天），也可以选自定义起止日期（含结束日全天，按本地时区计算）。

## 上传 JSON

如果浏览器历史不可用，可以先导出为 JSON 格式：

```json
[
  {"url": "https://example.com", "title": "标题", "visitTime": 1690000000000}
]
```

然后在页面上点击"上传 JSON 文件"。也接受 `{"visits": [...], "timeRange": {"startMs": 0, "endMs": 0}}` 这种包装形式。

限制与行为：

- 请求体上限 **1 MB**，记录条数上限 **20000 条**（超限返回 413 / 400）
- `visitTime` 可以是毫秒数、数字字符串，或能被 `Date` 解析的字符串
- 缺少可用时间戳的记录会被**丢弃**（不会编造"现在"作为时间）；如果一条都不剩，返回 400 并说明原因
- 缺失的 `url` / `title` 分别回退为 `about:blank` / `(无标题)`

## 原理

- 自动检测 Chrome / Edge / Chromium 的 SQLite 历史数据库（`visits` + `urls` 表）
- 浏览器可能正在占用该文件，所以先把 `History` 连同 `-wal` / `-shm` / `-journal` 复制到临时目录，再用 sql.js 打开，结束后删除临时目录
- 用 `path.relative` 校验静态资源路径，防止目录穿越
- 将访问记录按时间分组为"时段"（间隔 > 30 分钟视为不同时段）
- 分析每个时段的行为模式，按下表顺序判定，先命中者生效
- 根据模式生成文学叙事（每个模式有多种文案变体）

| 模式 | 含义 | 判定条件 |
| --- | --- | --- |
| `racing` | 匆忙 | 密度 ≥ 1.5 次/分钟且访问 ≥ 8 次 |
| `absorbed` | 沉浸 | 访问 ≤ 3 次但持续 ≥ 60 分钟 |
| `searching` | 寻找 | 主域名占比 ≥ 50% 且该域名 ≥ 5 次 |
| `scattered` | 漂移 | 域名 ≥ 3 个且访问 ≥ 10 次 |
| `oscillating` | 犹豫 | 恰好 2 个域名且访问 ≥ 4 次 |
| `steady` | 平稳 | 以上都不满足 |

## HTTP 接口

### `GET /api/history`

| 参数 | 说明 |
| --- | --- |
| `days` | 最近 N 天，`1`~`3650`，默认 `7` |
| `start` / `end` | 自定义区间 `YYYY-MM-DD`，必须同时提供，结束日含全天 |
| `limit` | 最多读取的访问条数，`1`~`5000`，默认 `500` |

参数非法一律返回 400 并带可读的 `error`。找不到历史库时返回 404。

### `POST /api/upload`

请求体为上文的上传 JSON，成功返回 200。

响应结构（两个接口一致）：

```json
{
  "date": "2026 年 9 月 1 日 — 2026 年 9 月 8 日",
  "summary": "……",
  "overview": "……",
  "chapters": [
    {
      "time": "10:00 — 10:35",
      "duration": "35 分钟",
      "pattern": "searching",
      "topDomain": "example.com",
      "visits": 12,
      "domains": 3,
      "narrative": "……"
    }
  ],
  "ending": "……",
  "source": "Microsoft Edge"
}
```

- `source` 是数据来源（浏览器名或"上传的 JSON"）
- 上传接口额外返回 `skipped`（被丢弃的记录数）
- 命中 `limit` 时摘要与概览会注明"只统计了最近 N 条"，避免把截断当成全部

## 测试

零依赖，使用 Node 内置 `assert`，自带断言与计数：

```bash
npm test           # 等价于 node test/run.js
```

当前 **47 个用例**全部通过，覆盖：

- 静态资源路径穿越（明文 `..`、`%2e%2e%2f`、`..%5c`、非法编码、目录本身）
- HTTP 层：静态资源、404、413、400、Host 校验、畸形请求行后服务器仍存活
- 叙事生成：空数据、单条、脏时间戳、排序、时段切分、六种模式、域名回退、截断提示
- 浏览器路径识别（Windows / macOS / Linux）与日期解析（含 `2026-02-30` 这类不存在的日期）
- 上传数据归一化：数组 / 包装对象、非法 JSON、非数组、`null` 条目、时间戳归一化、超量拒绝
- `readHistory`：参数校验、真实历史库（升序 / limit / 来源）或明确的 `NO_HISTORY_FILE`

## 目录结构

```
history-reader/
├── server.js            本地 HTTP 服务器（静态资源 + 两个 API + 参数校验）
├── lib/reader.js        历史库定位、复制、sql.js 查询、上传数据归一化
├── lib/narrator.js      时段切分、模式识别、叙事生成
├── public/              前端（index.html / css/style.css / js/app.js）
├── test/run.js          零依赖测试
└── start.bat            Windows 一键启动
```

## 隐私

- 默认只监听 `127.0.0.1`，并校验 `Host` 头（防 DNS rebinding），局域网设备无法读取
- 所有数据仅在本机内存中处理，不会上传到任何服务器
- 读取历史库时使用临时副本，处理完立即删除
- 确实需要跨设备访问时再显式设置 `HOST=0.0.0.0` 与 `HR_ALLOW_REMOTE=1`，并自行承担风险
