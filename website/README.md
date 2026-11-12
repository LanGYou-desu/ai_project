# LanGYou Archive · 公开作品与手记分享站

> 可玩的世界，公开的手记。

这是 `langyousaikyo.top` 的网站源代码：一个公开的作品展示、在线游玩、下载与写作空间。访客可以直接浏览；注册用户可以用邮箱验证码注册、登录、找回密码，发布自己的手记，也可以投稿作品；管理员负责审核投稿、作品、用户与内容维护。

## 它是什么

- **公开作品档案**：34 个作品，按网页游戏 / 桌面游戏 / 3D 世界 / 网页应用 / 工具 / 生成艺术分类。每件作品有封面、介绍、标签、在线演示与下载。
- **在线游玩**：纯前端作品直接托管在 `play` 子域；上传的 ZIP 若包含 `index.html` 也会自动发布。
- **邮箱账号**：注册需要邮箱验证码；忘记密码也通过邮箱验证码重置。密码使用 scrypt 哈希。
- **三种角色**：
  - **访客（未登录）**：浏览、在线游玩、下载、阅读手记。
  - **注册用户**：发布、编辑、删除自己的手记；投稿作品（等待管理员审核）；修改自己的密码。
  - **管理员**：上传/编辑/删除作品，审核通过或拒绝用户投稿，管理所有手记（置顶、隐藏、删除），查看注册用户与站点统计。
- **手记（Journal）**：首页 JOURNAL 区块展示所有公开手记，详情弹层显示作者；登录用户可在创作中心写自己的手记。
- **安全边界**：上传的 HTML 运行在独立子域，不接触主站 Cookie；ZIP 解压有路径穿越、文件数与体积限制；所有写操作校验 CSRF 与角色权限。

## 技术栈

- Node.js 22+ / Express 4
- 原生 HTML / CSS / JavaScript，无前端框架
- JSON 文件存储（`users.json`、`posts.json`、`codes.json`、`works.json`），适合个人/小团队站点
- Nodemailer + SMTP（QQ 邮箱等）发送注册与重置验证码
- Nginx 反向代理 + 静态子域
- 字体：Instrument Serif、Space Grotesk、JetBrains Mono（SIL OFL）

## 本地运行

```bash
cd website
npm install
cp .env.example .env
# 编辑 .env：
#   ADMIN_USERNAME=LanGYou
#   ADMIN_EMAIL=你的管理员邮箱
#   ADMIN_PASSWORD=至少 10 位
#   MAIL_MODE=console        # 本地开发：验证码打印在终端
#   COOKIE_SECURE=false      # 本地 HTTP 调试
npm start
```

打开 <http://127.0.0.1:3000>。首次启动会创建管理员账号；登录页可以注册普通用户。本地 `MAIL_MODE=console` 时，验证码会输出到运行 `npm start` 的终端。

```bash
npm run dev          # node --watch
```

## 邮箱配置（生产）

注册和找回密码依赖 SMTP。以 QQ 邮箱为例：

1. 登录 QQ 邮箱网页版 → 设置 → 账户。
2. 开启「POP3/IMAP/SMTP 服务」。
3. 生成 **SMTP 授权码**（不是 QQ 登录密码）。
4. 写入服务器 `.env`（权限 600）：

```ini
MAIL_MODE=smtp
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ邮箱
SMTP_PASS=QQ邮箱SMTP授权码
MAIL_FROM=你的QQ邮箱
```

修改后重启 `langyou.service`。`MAIL_MODE=console` 只用于本地开发，生产环境不要使用。

## 目录

```
website/
├── server.js              # Express 入口、账号/手记/作品 API
├── lib/
│   ├── auth.js            # HMAC 会话、CSRF
│   ├── password.js        # scrypt 密码哈希
│   ├── users.js           # users.json、管理员迁移、角色
│   ├── codes.js           # 邮箱验证码（哈希存储、限流、过期）
│   ├── mailer.js          # Nodemailer / 控制台开发模式
│   ├── store.js           # works.json 原子读写
│   ├── posts.js           # posts.json 手记存储
│   ├── works.js           # 内置作品 + 上传作品的合并与装饰
│   └── uploads.js         # multer + ZIP 安全解压
├── data/projects.json     # 34 个内置作品清单
├── public/
│   ├── index.html         # 首页（作品 + 手记）
│   ├── login.html         # 登录 / 注册 / 找回密码
│   ├── studio.html        # 创作中心 / 管理后台
│   ├── css/ js/ assets/   # 前端与字体
│   └── covers/            # 作品封面（构建产物，随仓库提交）
└── storage/               # 运行期数据（gitignore）
```

## 作品投稿与审核

登录用户在创作中心可以上传封面与 ZIP 作品包，提交后状态为「审核中」，不会出现在公开首页。管理员在「待审核投稿」中可以通过并公开，或填写原因拒绝。通过后作品才进入公开索引，并开放在线游玩与下载；投稿者可以在「我的投稿」查看状态或删除未通过的投稿。

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
3. 准备 `/opt/langyou/app/.env`（权限 600）：
   - `DATA_DIR=/opt/langyou/data`
   - `PLAY_DIR=/opt/langyou/play`
   - `PACKAGE_DIR=/opt/langyou/downloads`
   - `PLAY_BASE=https://play.langyousaikyo.top`
   - `ADMIN_USERNAME`、`ADMIN_EMAIL`、`ADMIN_PASSWORD`
   - `MAIL_MODE=smtp` 与 `SMTP_*`
4. systemd 运行 `node server.js`，只监听 `127.0.0.1:3000`。
5. Nginx：
   - `langyousaikyo.top` → `127.0.0.1:3000`，`/downloads/` alias 到 `/opt/langyou/downloads/`。
   - `play.langyousaikyo.top` → root `/opt/langyou/play`。
   - `client_max_body_size 600m`。
6. 证书可用 Let's Encrypt DNS-01（Cloudflare 插件）或 Cloudflare Origin CA。

首次启动会把旧的 `auth.json` 迁移成 `users.json` 中的管理员账号，并把旧手记归属到管理员。

## 部署注意（中国大陆 ECS）

如果源站部署在中国大陆的云服务器上，未完成 ICP 备案的域名会被运营商在网络层拦截：80 端口返回 `Non-compliance ICP Filing`，443 端口 TLS 连接被重置。此时即使 Nginx / 证书都正确，Cloudflare 也会返回 525。

可选方案：

1. **Cloudflare Tunnel（推荐）**：由服务器主动向外建立隧道，不依赖入站 80/443，也不需要备案。在 Cloudflare Zero Trust 创建 Tunnel，把 token 交给服务器上的 `cloudflared`，再把域名 CNAME 到 `<tunnel-id>.cfargotunnel.com`。
2. **境外服务器 / 已备案域名**：直接把同一套 Nginx + Node 部署到没有该限制的环境。
3. **完成 ICP 备案**：备案通过后可按本文档直接使用 80/443。

## 隐私

网站不公开展示真实姓名、电话、住址等个人信息。管理员邮箱只用于发送验证码与找回密码邮件，不会出现在公开页面；用户邮箱也只用于账号验证，不展示给其他访客。上传前请自行检查作品包中是否含有个人路径、密钥或隐私数据；`storage/` 与 `.env` 已被 gitignore。