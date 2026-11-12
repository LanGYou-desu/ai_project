# 星海邮局 · STELLAR POST

> 把想说的话，寄给夜空。

写下 80 字以内的一句话，它会变成星图里的一颗星。鼠标靠近时星星会让开，点开别人的星，能读到他们没说完的心事。

纯手写：Canvas 星场、悬停星座线、零第三方依赖、零构建步骤。**不需要 XAMPP / Apache / PHP / 数据库**，一个 Node 进程就能跑。

## 运行

双击 `start.bat`（或 `start.ps1`），浏览器会自动打开。

也可以手动启动：

```bash
node server.js                 # 默认 http://127.0.0.1:5177/
node server.js --port 8080     # 换端口
node server.js --no-open       # 只启动，不自动开浏览器
PORT=8080 node server.js       # 环境变量方式
```

需要 Node.js 18+。服务只监听 `127.0.0.1`，局域网和公网都访问不到。

## 玩法

| 操作 | 效果 |
| --- | --- |
| 在「投递」里写一句话 | 提交后立刻变成星图里的一颗新星 |
| 鼠标靠近星星 | 星星被轻轻推开，光标与附近星点连成星座线 |
| 悬停 / Tab 聚焦 / 点击星星 | 浮出那颗星里的话与投递日期 |
| 滚动页面 | 星空随滚动漂移，顶部进度条提示阅读位置 |
| 等待几秒 | 会有一颗流星划过 |

同一网络每 12 秒可以投递一次；内容公开可见，别写隐私信息。

## 项目结构

```
stellarPost/
├── index.html            # 页面骨架（星图由服务端注入）
├── assets/
│   ├── css/style.css     # 全部样式：星场、卡片、响应式、动效降级
│   ├── js/app.js         # 星场渲染、星图交互、投递表单
│   └── favicon.svg
├── data/
│   └── wishes.json       # 星信数据（唯一的持久化文件）
├── server.js             # 零依赖 Node 服务：静态站 + 星信接口
├── start.bat             # 一键启动（cmd，纯 ASCII）
├── start.ps1             # 一键启动（PowerShell）
└── README.md
```

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/wishes` | 返回最近 120 条：`{ ok, count, wishes }` |
| POST | `/api/wishes` | 投递一条：JSON `{ "text": "..." }` 或普通表单字段 `text` |

JSON 请求成功返回 201 `{ ok, wish, count }`；普通表单提交成功会 302 回首页（关掉 JS 也能用）。校验失败 400，频率限制 429。

## 技术说明

- **星场**：Canvas 逐帧绘制，三层景深视差 + 鼠标引力 + 光标星座连线 + 随机流星；`prefers-reduced-motion` 下退化为静态星空。
- **星图**：服务端把每条星信渲染成按钮，无 JS 也能悬停阅读；星星坐标由内容 ID 做 djb2 散列（模 2147483647）得出，Node 与浏览器用同一套算法，刷新前后位置完全一致。
- **落盘**：`data/wishes.json` 用「临时文件 + 原子重命名」写入，最多保留 400 条；`data/`、`server.js` 等不在静态白名单里，直接访问返回 404。
- **限流**：按来源 IP 在内存里记 12 秒节流，重启后清空。
- **零依赖**：只用 Node 内置的 `http` / `fs` / `path` / `crypto` / `child_process`。

## 数据

- 清空星图：把 `data/wishes.json` 的内容改成 `[]`。
- 调整单条字数上限：改 `server.js` 里的 `MAX_TEXT`，同步改 `index.html` 的 `maxlength`。
- 调整投递间隔：改 `server.js` 里的 `RATE_MS`。

## 来历

最初是 XAMPP（Apache + PHP 5.6）下写在 `D:\xampp\www` 的练手站，本目录是它的独立化版本：

- 后端由 PHP 换成零依赖 Node 服务，不再需要 Apache / PHP / XAMPP；
- 保留服务端渲染星图（无 JS 也能读），保留原有视觉与交互；
- 数据文件原样迁移，之前投递的星信都还在。
