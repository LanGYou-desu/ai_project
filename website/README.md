# LanGYou Archive · 个人创作档案馆

> 一个人，三十三个可以进入的世界。

这是 `langyousaikyo.top` 的网站源代码：一个展示、游玩与下载 LanGYou 全部作品的个人档案馆，同时带一个只对站主开放的工作室（登录、上传作品、编辑档案）。

## 它是什么

- **公开档案馆**：33 个作品，按网页游戏 / 桌面游戏 / 3D 世界 / 网页应用 / 工具 / 生成艺术分类。每件作品有封面、介绍、标签、在线演示与下载。
- **在线游玩**：纯前端作品直接托管在 `play` 子域；上传的 ZIP 若包含 `index.html` 也会自动发布。
- **站主登录**：唯一账号 `LanGYou`，密码使用 scrypt 哈希，Cookie 为 HttpOnly + SameSite=Lax，登录有速率限制。
- **工作室**：上传 ZIP / 封面、填写元数据、设为精选、隐藏/公开、编辑、删除、修改密码。
- **安全边界**：上传的 HTML 运行在独立子域，不接触主站 Cookie；ZIP 解压有路径穿越、文件数与体积限制。

## 技术栈

- Node.js 22+ / Express 4
- 原生 HTML / CSS / JavaScript，无前端框架
- JSON 文件存储（`storage/works.json`），适合单站主、低并发
- Nginx 反向代理 + 静态子域
- 字体：Instrument Serif、Space Grotesk、JetBrains Mono（SIL OFL）

## 本地运行

```bash
cd website
npm install
cp .env.example .env
# 编辑 .env：设置 ADMIN_PASSWORD 与 SESSION_SECRET
# 本地 HTTP 调试时把 COOKIE_SECURE 改成 false
npm start
```

打开 <http://127.0.0.1:3000>。首次启动会用 `ADMIN_PASSWORD` 创建 `LanGYou` 账号，之后可在工作室里改密码。

```bash
npm run dev          # node --watch
npm run set-password # 忘记密码时直接重置（会写入 storage/auth.json）
```

## 目录

```
website/
├── server.js              # Express 入口
├── lib/
│   ├── auth.js            # scrypt 密码、HMAC 会话、CSRF
│   ├── store.js           # works.json 原子读写
│   ├── works.js           # 内置作品 + 上传作品的合并与装饰
│   └── uploads.js         # multer + ZIP 安全解压
├── data/projects.json     # 33 个内置作品清单
├── public/
│   ├── index.html         # 首页
│   ├── login.html         # 站主登录
│   ├── studio.html        # 工作室
│   ├── css/ js/ assets/   # 前端与字体
│   └── covers/            # 作品封面（构建产物，随仓库提交）
├── scripts/set-password.js
└── storage/               # 运行期数据（gitignore）
```

## 上传作品包

ZIP 根目录放 `index.html`：

```
my-work.zip
├── index.html
├── style.css
└── game.js
```

上传后会自动解压到 `PLAY_DIR/u/<id>/`，并发布到 `PLAY_BASE/u/<id>/`。如果 ZIP 里只有一个顶层文件夹，服务端会自动把它提上来。没有 `index.html` 的 ZIP 会作为「仅下载」作品。

## 生产部署（概要）

1. 安装 Node.js 22、Nginx、Certbot。
2. 把 `website/` 放到 `/opt/langyou/app`，运行 `npm install --omit=dev`。
3. 准备 `/opt/langyou/app/.env`（权限 600），设置 `DATA_DIR=/opt/langyou/data`、`PLAY_DIR=/opt/langyou/play`、`PACKAGE_DIR=/opt/langyou/downloads`、`PLAY_BASE=https://play.langyousaikyo.top`。
4. systemd 运行 `node server.js`，只监听 `127.0.0.1:3000`。
5. Nginx：
   - `langyousaikyo.top` → `127.0.0.1:3000`，`/downloads/` alias 到 `/opt/langyou/downloads/`。
   - `play.langyousaikyo.top` → root `/opt/langyou/play`。
   - `client_max_body_size 600m`。
6. 证书可用 Let's Encrypt DNS-01（Cloudflare 插件）或 Cloudflare Origin CA。

## 隐私

网站不展示真实姓名、邮箱、电话、住址等个人信息。登录账号只使用公开称呼 `LanGYou`。上传前请自行检查作品包中是否含有个人路径、密钥或隐私数据；`storage/` 与 `.env` 已被 gitignore。
