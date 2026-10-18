// 发行版内容：这里是你唯一需要改的文件。首次装机时会被写进虚拟磁盘；
// 之后也可以直接在系统里（记事本 / 终端 edit）修改磁盘上的对应文件。
export interface ProfileProject {
  file: string
  title: string
  summary: string
  tags: string[]
  link?: string
  body: string
}

export interface ProfileLink {
  label: string
  url: string
}

export const profile = {
  owner: '主人',
  hostname: 'personal-os',
  version: '0.1.0',

  about: `# 关于我

> 这是一段占位介绍：把 src/data/profile.ts 里的内容换成你自己的故事，或者直接在终端里编辑磁盘上的文件。

你好，我是「主人」。这个网站本身就是一台电脑：有桌面、有窗口、有文件系统、有终端，还有一块 256 KiB 的真实虚拟磁盘。

## 我在做什么

在这里写你正在做的事：正在学的技术、正在做的产品、正在读的书。占位段落只是为了让你看到排版效果——标题、引用、列表、**加粗**、\`行内代码\` 都支持。

## 几个标签

- 白天写代码，晚上写点别的东西
- 相信小工具能改变日常
- 认为个人网站应该有灵魂，而不是一页模板

## 这个网站本身

它叫 personal-os：开机要自检，关机要 \`sync\`；磁盘是一个叫 disk.img 的镜像文件，桌面上的图标、关于页、项目清单，全都是磁盘上的文件。你可以按 \`Ctrl+W\` 关掉这个窗口，然后在终端里输入 \`ls /用户/主人\` 亲眼看看。`,

  projects: [
    {
      file: '这个网站.md',
      title: 'personal-os · 我的个人操作系统',
      summary: '把个人网站做成一台可以开机、可以折腾的电脑。',
      tags: ['Svelte 5', 'TypeScript', '文件系统'],
      link: 'https://example.com/personal-os',
      body: `## 为什么

普通的个人主页就像一张名片，看一眼就关掉。我想做一个"可以玩"的个人网站：访客打开它，像打开一台电脑。

## 里面有什么

- 一块 256 KiB 的虚拟磁盘（FAT-lite 文件系统，\`fsck\` 可跑）
- 窗口管理器：拖拽、贴边、Alt+Tab
- 真终端：\`ls\`、\`cat\`、\`df\`、\`fsck\`、\`neofetch\`
- 程序化 chiptune 音乐播放器

## 技术细节

磁盘镜像是磁盘上一个真实的二进制文件：\`disk/disk.img\`。浏览器通过一个小小的伙伴服务器读写它；如果没有伙伴服务器（例如部署在静态托管），系统会自动降级为"只读基础盘 + 本地暂存"。`,
    },
    {
      file: '星野观测站.md',
      title: '星野观测站',
      summary: '一个安静的观星小工具：今晚能看到什么，一屏说清楚。',
      tags: ['天文', 'Canvas', '占位项目'],
      link: 'https://example.com/observatory',
      body: `## 想法

输入城市和时间，算出真实星历，画一张穹顶星图。不追求专业天文台的精度，追求"今晚出门看什么"的好用。

## 占位说明

这是示例项目：把 src/data/profile.ts 里的 projects 数组换成你自己的作品即可。`,
    },
    {
      file: '慢食笔记.md',
      title: '慢食笔记',
      summary: '把家常菜谱做成有版本管理的食谱库。',
      tags: ['食谱', '数据可视化', '占位项目'],
      body: `## 起源

家里的菜谱散落在便签、微信收藏和记忆里。这个项目把它们收拢成一份可以迭代的文档：每次做菜的微调都记一笔，像给味道打补丁。

## 占位说明

这是示例项目，用于展示卡片与详情排版。`,
    },
    {
      file: '键盘声纹.md',
      title: '键盘声纹',
      summary: '用打字节奏当密码：一段只有你知道的敲击旋律。',
      tags: ['WebAudio', '实验', '占位项目'],
      body: `## 玩法

不用记密码，只要按自己的习惯节奏敲一串键。系统用节奏特征（间隔、力度近似）做模糊匹配，形似"声纹"。

## 占位说明

这是示例项目，用于展示标签与链接的呈现。`,
    },
    {
      file: '地铁线路生成器.md',
      title: '地铁线路生成器',
      summary: '给一座虚构城市设计地铁图，自动排版成官方图谱的样子。',
      tags: ['生成艺术', 'SVG', '占位项目'],
      body: `## 想法

城市是程序生成的，线路也得跟着长出来。转角固定 45 度、站名自动编号，一键导出可以打印的线路图。

## 占位说明

这是示例项目。`,
    },
  ] as ProfileProject[],

  contact: {
    name: '主人',
    tagline: '占位一句话：写下你最想被记住的一面。',
    email: 'hello@example.com',
    location: '地球 · 某处',
    availability: '咖啡时间与深夜都很适合聊天',
    links: [
      { label: 'GitHub', url: 'https://github.com/example' },
      { label: '博客', url: 'https://example.com' },
    ] as ProfileLink[],
    note: '以上都是占位信息，请修改 src/data/profile.ts 换成你的联系方式。',
  },

  desktop: [
    { app: 'about', title: '关于我' },
    { app: 'projects', title: '项目' },
    { app: 'contact', title: '联系' },
    { app: 'files', title: '文件' },
    { app: 'music', title: '音乐' },
  ],

  playlist: {
    entries: [
      { kind: 'builtin', id: 'startup', name: '开机序曲' },
      { kind: 'builtin', id: 'glassrain', name: '玻璃雨' },
      { kind: 'builtin', id: 'desk8bit', name: '8-bit 桌面' },
    ],
  },
}
