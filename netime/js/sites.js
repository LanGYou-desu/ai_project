/* ============================================================
 * NETIME · 站点内容
 * 五个年代（1995/2000/2005/2010/2025）的虚构旧网页。
 * 每个页面：{ id, era, url, title, html, keywords, snippet, clue?, hidden? }
 * 线索（clue）在首次访问时自动写入「案件档案」。
 * ============================================================ */
(function (global) {
  'use strict';

  function cnt(n) { return '<span class="cnt">您是第 <b>' + String(n) + '</b> 位访客</span>'; }

  var SITES = {};

  function add(p) { SITES[p.id] = p; return p; }

  /* ============================ 1995 · BBS 黎明 ============================ */

  add({
    id: 'e1995_portal', era: '1995',
    url: 'http://www.chinanet-news.com/',
    title: '东方资讯台 · 中国网络新闻',
    keywords: ['东方资讯台', 'chinanet', '新闻', '网络之声', 'radio', '1995'],
    snippet: '1995 年的新闻门户。头条：跨年夜神秘电波刷屏 BBS。',
    html: `<table class="retro" width="100%">
      <tr><td class="banner"><b>东 方 资 讯 台</b><br><font size="2">中 国 网 络 新 闻 · 1995</font></td></tr>
      <tr><td class="subbar"><font size="2">1995年12月31日 星期日 &nbsp;·&nbsp; 农历乙亥年冬月初十 &nbsp;·&nbsp; 天气：晴</font></td></tr>
    </table>
    <hr size="1">
    <b>· 今日要闻 ·</b>
    <ul class="news">
      <li>◆ 邮电部宣布：全国互联网用户突破 10 万，年底冲关成功</li>
      <li>◆ 跨年夜神秘电波刷屏各大 BBS，电台爱好者彻夜守听</li>
      <li>◆ 中文输入法大战白热化：五笔与拼音谁主沉浮</li>
      <li>◆ 气象台提醒：明晨有雾，出门注意交通安全</li>
    </ul>
    <hr size="1">
    <b>· 本站导航 ·</b><br>
    <a href="http://bbs.yemaomao.cn/">[夜猫子BBS]</a>
    <a href="http://www.chinanet-news.com/search">[狐搜]</a>
    <a href="http://home.chinanet.com/~guyan/show.html">[网络之声·专题]</a>
    <hr size="1">
    <center><font size="2" color="#808080">` + cnt(8761) + ` · 建议使用 Netscape Navigator 3.0 800×600 浏览 · 版权所有 1995 东方资讯台</font></center>`
  });

  add({
    id: 'e1995_search', era: '1995',
    url: 'http://www.chinanet-news.com/search',
    title: '狐搜 · 全网搜索',
    keywords: ['搜索', '狐搜', 'search'],
    snippet: '1995 年的搜索引擎。',
    html: `<center><h2 class="title95">狐 搜</h2>
    <p><font size="2">中国网络信息检索第一站 · 收录网页 <b>8,214</b> 个</font></p></center>
    <hr size="1">
    <div id="search-results" class="results"></div>
    <center><font size="2" color="#808080">请在浏览器地址栏输入 狐搜网址?q=关键词 进行检索（如 .../search?q=网络之声）</font></center>`
  });

  add({
    id: 'e1995_bbs', era: '1995',
    url: 'http://bbs.yemaomao.cn/',
    title: '夜猫子BBS · 今夜无眠',
    keywords: ['BBS', '夜猫子', '论坛', 'radio_guy', '网络之声', '顾言'],
    snippet: '1995 年最热闹的 BBS。跨年夜，这里有人发了告别帖。',
    html: `<table class="retro" width="100%">
      <tr><td class="banner2"><b>夜猫子 BBS</b><font size="2"> · 今夜无眠，聊到天亮</font></td></tr>
    </table>
    <hr size="1">
    <b>· 版块列表 ·</b><br>
    [技术天地] [情感小屋] [电台发烧友] [电脑医院] [跳蚤市场] [站务讨论]
    <hr size="1">
    <b>· 热门话题（共 128 帖） ·</b>
    <table class="retro" width="100%" cellpadding="3">
      <tr><th width="70%">主题</th><th>作者</th><th>回复</th></tr>
      <tr><td><a href="http://bbs.yemaomao.cn/thread/1024">【告别】网络之声今晚十二点永久停播</a></td><td>radio_guy</td><td>43</td></tr>
      <tr><td>跨年夜大家打算怎么过？</td><td>小猫</td><td>112</td></tr>
      <tr><td>求一个好用的拨号软件！</td><td>程序员小王</td><td>9</td></tr>
      <tr><td>【版主公告】新年联机对战大赛报名</td><td>站长</td><td>56</td></tr>
    </table>
    <hr size="1">
    <center><font size="2" color="#808080">` + cnt(45210) + ` · 本 BBS 建于 1995-02-14 · 站长：yemaomao</font></center>`
  });

  add({
    id: 'e1995_bbs_thread', era: '1995',
    url: 'http://bbs.yemaomao.cn/thread/1024',
    title: '【告别】网络之声今晚十二点永久停播 - 夜猫子BBS',
    keywords: ['告别', '网络之声', 'radio_guy', '顾言', '停播', 'SIGMA'],
    snippet: 'radio_guy 的告别帖：他把最后的留言写在了主页留言板上，用一种古老的语言。',
    clue: {
      id: 'c1995', title: '1995 · 告别帖',
      text: 'radio_guy 在告别帖里说：他把最后的留言写在主页的留言板上，用"一种很古老的语言"。帖子下有个叫 SIGMA-7 的人回复："十年后见。"'
    },
    html: `<table class="retro" width="100%">
      <tr><td class="banner2"><b>夜猫子 BBS</b> → 电台发烧友</td></tr>
    </table>
    <hr size="1">
    <b>【告别】网络之声今晚十二点永久停播</b><br>
    <font size="2">作者：<b>radio_guy</b>　时间：1995-12-31 23:11　来自：218.85.*.*</font>
    <hr size="1">
    <p>各位，十二点一到，网络之声就要停播了。</p>
    <p>谢谢三年来每一个守在收音机旁、守在 BBS 前的你。我不是辞职，也不是失联——我只是觉得，有些声音该换一种方式存在了。</p>
    <p>我把最后的留言写在了主页的留言板上，<b>用一种很古老的语言</b>。懂的人自然会懂。</p>
    <p>以后也许还会回来，也许不会。再见，互联网。</p>
    <hr size="1">
    <b>回复（43 条，最新回复置顶）</b>
    <table class="retro" width="100%" cellpadding="3">
      <tr><td>44F　<b>收音机迷</b>：不要啊！！我每期都听，从 1993 年听到现在！！</td></tr>
      <tr><td>43F　<b>小猫</b>：顾老师保重 T_T 今晚 24:00 准时守听最后一期。</td></tr>
      <tr><td>42F　<b>SIGMA-7</b>：十年后见。</td></tr>
      <tr><td>41F　<b>夜猫子站长</b>：帖子置顶一年，等顾老师回来。</td></tr>
      <tr><td>40F　<b>无名氏</b>：一路顺风。</td></tr>
    </table>
    <hr size="1">
    <a href="http://home.chinanet.com/~guyan/">[访问 radio_guy 的主页]</a>
    <a href="http://bbs.yemaomao.cn/">[返回夜猫子BBS]</a>`
  });

  add({
    id: 'e1995_home', era: '1995',
    url: 'http://home.chinanet.com/~guyan/',
    title: '欢迎来到顾言的主页！',
    keywords: ['顾言', '主页', 'guyan', 'homepage', 'radio_guy', '留言板'],
    snippet: '顾言的个人主页，建于 1995 年 3 月，仍在建设之中……',
    html: `<center><h2 class="title95">☆ 顾 言 的 主 页 ☆</h2></center>
    <center><font size="2" color="#FF0000">Welcome to Gu Yan's Homepage !</font></center>
    <marquee behavior="alternate" width="90%">欢迎光临！本页建于 1995 年 3 月，正在建设之中，请多提宝贵意见……</marquee>
    <hr size="1">
    <p>你好，我是顾言。白天写 C 语言的程序员，晚上做电台主持人。这里放一些我的小玩意，和一些没说完的话。</p>
    <hr size="1">
    <b>· 本页栏目 ·</b><br>
    <a href="http://home.chinanet.com/~guyan/guestbook.html">[留言板]</a><br>
    <a href="http://home.chinanet.com/~guyan/show.html">[网络之声·节目单]</a><br>
    <a href="http://bbs.yemaomao.cn/">[夜猫子BBS]</a>
    <hr size="1">
    <center><font size="2" color="#808080">` + cnt(2137) + ` · 站长信箱：guyan@chinanet.com</font></center>`
  });

  add({
    id: 'e1995_show', era: '1995',
    url: 'http://home.chinanet.com/~guyan/show.html',
    title: '网络之声 · 节目单',
    keywords: ['网络之声', '节目单', '广播', '顾言', 'radio'],
    snippet: '网络之声的节目单。最后一期：1995-12-31 24:00「告别互联网」。',
    html: `<center><h3 class="title95">★ 网 络 之 声 ★</h3></center>
    <center><marquee width="80%">网络之声 —— 每周日晚 23:00 与您空中相会</marquee></center>
    <table class="retro" width="100%" cellpadding="4" border="1">
      <tr><th>播出日期</th><th>栏目</th><th>时长</th></tr>
      <tr><td>1995-12-31 24:00</td><td><b>最后的节目 · 告别互联网</b></td><td>60 分钟</td></tr>
      <tr><td>1995-12-24 23:00</td><td>平安夜点歌专场</td><td>60 分钟</td></tr>
      <tr><td>1995-12-17 23:00</td><td>网络轶事：从 386 到奔腾</td><td>60 分钟</td></tr>
    </table>
    <p><font size="2">主持人：顾言（radio_guy）　点歌热线：010-63xxxxxx　来信：guyan@chinanet.com</font></p>
    <a href="http://home.chinanet.com/~guyan/">[← 返回顾言的主页]</a>`
  });

  add({
    id: 'e1995_guestbook', era: '1995',
    url: 'http://home.chinanet.com/~guyan/guestbook.html',
    title: '留言板 · 顾言的主页',
    keywords: ['留言板', 'guestbook', 'radio_guy', '顾言', '留言'],
    snippet: '顾言主页的留言板。最后一条留言，写于 1996 年 1 月 1 日凌晨。',
    clue: {
      id: 'c1995b', title: '1995 · 留言板上的怪话',
      text: '留言板最后一条是 radio_guy 于 1996-01-01 00:03 写的，一串不像英文的英文。他说过这是"一种很古老的语言"。线索里反复出现"网络之声"四个字——解出来的答案和其中某个字发音相同。'
    },
    html: `<h3 class="title95">· 留 言 板 ·</h3>
    <p><font size="2">欢迎留言。请文明用语，谢谢合作。（留言按时间倒序排列）</font></p>
    <hr size="1">
    <table class="retro" width="100%" cellpadding="4">
      <tr><td><b>radio_guy</b>　<font size="2">1996-01-01 00:03</font><br>
        Gur svefg xrl vf: JNAT. V jvyy or jnvgvat va gur cynpr jurer gur fvtany yvirf.</td></tr>
      <tr><td><b>小凡</b>　<font size="2">1995-12-31 23:58</font><br>
        顾老师，最后一期我会准时听的！以后还会回来吗？</td></tr>
      <tr><td><b>张三</b>　<font size="2">1995-12-15 20:11</font><br>
        主页不错！那个 MIDI 播放器是怎么写的？</td></tr>
      <tr><td><b>radio_guy</b>　<font size="2">1995-10-02 09:00</font><br>
        回复张三：用汇编写的，386 上跑得飞快。改天写篇教程。</td></tr>
      <tr><td><b>过客</b>　<font size="2">1995-09-01 18:22</font><br>
        路过。祝站长万事如意。</td></tr>
    </table>
    <hr size="1">
    <a href="http://home.chinanet.com/~guyan/">[← 返回顾言的主页]</a>`
  });

  /* ============================ 2000 · 门户时代 ============================ */

  add({
    id: 'e2000_portal', era: '2000',
    url: 'http://www.new-line.com.cn/',
    title: '新干线 · 通向互联网的每一站',
    keywords: ['新干线', '门户', 'new-line', '新闻', '搜索', '论坛'],
    snippet: '2000 年的门户网站：新闻、科技、论坛、搜索，一应俱全。',
    html: `<table class="retro" width="100%" cellpadding="0" cellspacing="0">
      <tr><td class="banner3"><b>新 干 线</b><font size="2">　通向互联网的每一站 · 2000</font></td></tr>
      <tr><td class="nav2000">
        <a href="http://www.new-line.com.cn/">首页</a> |
        <a href="http://www.new-line.com.cn/search">搜索</a> |
        <a href="http://bbs.chengshi.com.cn/">论坛</a> |
        <a href="http://home.new-line.com/~guyan/">个人主页</a>
      </td></tr>
    </table>
    <hr size="1">
    <b>· 今日头条 ·</b>
    <ul class="news">
      <li>◆ 千禧年已至，互联网泡沫热度不减：新干线门户日访问量破百万</li>
      <li>◆ 宽带上网开始普及，"56K 拨号"或将走进历史</li>
      <li>◆ 网恋研究报告出炉：三分之一的网友相信网恋能成真</li>
    </ul>
    <hr size="1">
    <b>· 科技频道推荐 ·</b><br>
    <a href="http://home.new-line.com/~guyan/">顾言的电子实验室</a> —— 一个还坚持更新个人主页的老程序员<br>
    <hr size="1">
    <center><font size="2" color="#808080">` + cnt(1002451) + ` · 最佳浏览 IE 5.0 1024×768</font></center>`
  });

  add({
    id: 'e2000_search', era: '2000',
    url: 'http://www.new-line.com.cn/search',
    title: '新干线搜索',
    keywords: ['搜索', 'search', '新干线'],
    snippet: '新干线门户的搜索服务。',
    html: `<center><h2 class="title2000">新干线搜索</h2>
    <p><font size="2">收录网页 <b>18,204,771</b> 个，本日新增 12,034 个</font></p></center>
    <hr size="1">
    <div id="search-results" class="results"></div>`
  });

  add({
    id: 'e2000_lab', era: '2000',
    url: 'http://home.new-line.com/~guyan/',
    title: '顾言的电子实验室',
    keywords: ['顾言', '实验室', '电子', 'guyan', '主页', '源代码', '摩斯'],
    snippet: '顾言的电子实验室：拨号时代的地下实验室，页脚说"欢迎查看源代码"。',
    clue: {
      id: 'c2000', title: '2000 · 实验室的页脚',
      text: '实验室主页的页脚写着："欢迎查看源代码，那里有我想对你说的话。"'
    },
    html: `<marquee behavior="alternate" width="100%">★★ 欢迎光临 顾言的电子实验室 ★★</marquee>
    <center><h2 class="title2000">顾言的电子实验室</h2></center>
    <center><font size="2" color="#0000FF">—— 拨号时代的地下实验室 ——</font></center>
    <hr size="1">
    <p>这里是顾言放代码的地方。C/C++、汇编，还有一点点 386 时代的情怀。</p>
    <p>2000 年了，个人主页越来越少了，但我还是留着这一亩三分地。</p>
    <hr size="1">
    <b>· 栏目导航 ·</b><br>
    <a href="http://home.new-line.com/~guyan/works.html">◆ 实验室作品</a><br>
    <a href="http://home.new-line.com/~guyan/guestbook.html">◆ 访客留言板</a><br>
    <a href="http://www.new-line.com.cn/">◇ 返回新干线门户</a>
    <hr size="1">
    <font size="2" color="#808080">页脚：欢迎查看源代码，那里有我想对你说的话。</font><br>
    <center><font size="2" color="#808080">` + cnt(48231) + ` · 最佳浏览 IE 5.0 1024×768</font></center>
    <!-- YOU SHOULD GO TO RADIO:
         -.-- --- ..- / ... .... --- ..- .-.. -.. / --. --- / - --- / .-. .- -.. .. --- -->`
  });

  add({
    id: 'e2000_lab_works', era: '2000',
    url: 'http://home.new-line.com/~guyan/works.html',
    title: '实验室作品 - 顾言的电子实验室',
    keywords: ['作品', 'works', '软件', '顾言'],
    snippet: '顾言实验室的作品列表：拨号加速器、MIDI 播放器……',
    html: `<h3 class="title2000">· 实验室作品 ·</h3>
    <table class="retro" width="100%" cellpadding="4" border="1">
      <tr><th>作品</th><th>说明</th><th>版本</th></tr>
      <tr><td>拨号加速器 v0.9</td><td>优化 PPP 握手参数，上网快 0.5 秒</td><td>1999</td></tr>
      <tr><td>MIDI 电子琴播放器</td><td>386 上演奏《致爱丽丝》不卡顿</td><td>1998</td></tr>
      <tr><td>BBS 离线阅读器</td><td>省话费神器，下完线慢慢看</td><td>1997</td></tr>
    </table>
    <p><font size="2">以上作品均已停止维护。做软件很开心，但我更想念做电台的日子。</font></p>
    <a href="http://home.new-line.com/~guyan/">[← 返回实验室]</a>`
  });

  add({
    id: 'e2000_lab_guestbook', era: '2000',
    url: 'http://home.new-line.com/~guyan/guestbook.html',
    title: '访客留言板 - 顾言的电子实验室',
    keywords: ['留言板', 'guestbook', '顾言'],
    snippet: '实验室的留言板。SIGMA-7 留过言："十年了。你还在听吗？"',
    html: `<h3 class="title2000">· 访客留言板 ·</h3>
    <table class="retro" width="100%" cellpadding="4">
      <tr><td><b>SIGMA-7</b>　<font size="2">2000-12-31 23:59</font><br>
        十年了。你还在听吗？</td></tr>
      <tr><td><b>老网民</b>　<font size="2">2000-06-15 10:22</font><br>
        顾老师，从夜猫子 BBS 追过来的，主页还在真好。</td></tr>
      <tr><td><b>佚名</b>　<font size="2">2000-03-01 08:00</font><br>
        网络之声……还会回来吗？</td></tr>
    </table>
    <a href="http://home.new-line.com/~guyan/">[← 返回实验室]</a>`
  });

  add({
    id: 'e2000_lab_radio', era: '2000',
    url: 'http://home.new-line.com/~guyan/radio.html',
    title: '电台直播 · NETVOICE',
    keywords: [],
    hidden: true,
    clue: {
      id: 'c2000b', title: '2000 · 隐藏的电台直播页',
      text: '你按摩斯电码的指令找到了 radio.html——一个没有链接的隐藏页。页面写着：第二枚密钥：络。'
    },
    html: `<pre class="ascii">
      |||||   |||||   |||||
      |||||   |||||   |||||
       |||     |||     |||
       |||     |||     |||
        |       |       |
      =====================
    </pre>
    <center><h3 class="title2000">♪ 电台直播：NETVOICE ♪</h3></center>
    <center><font size="2">频道：NETVOICE　·　设备：486DX2-66　·　已静默广播：<b>5 年</b></font></center>
    <hr size="1">
    <p>如果你能找到这里，说明你读懂了源代码里的那句摩斯电码。</p>
    <p style="font-size:16px;color:#0000FF"><b>第二枚密钥：络。</b></p>
    <p><font size="2">— 留言板（最新） —<br>
    <b>SIGMA-7</b>：十年了。你还在听吗？<br>
    我还在听。</font></p>
    <a href="http://home.new-line.com/~guyan/">[← 返回实验室]</a>`
  });

  add({
    id: 'e2000_forum', era: '2000',
    url: 'http://bbs.chengshi.com.cn/',
    title: '都市论坛 · 人海茫茫，网海茫茫',
    keywords: ['论坛', '都市', 'bbs', '网络之声', '顾言'],
    snippet: '都市论坛。2000 年就有人发帖问："有人记得网络之声吗？"',
    html: `<table class="retro" width="100%">
      <tr><td class="banner3"><b>都市论坛</b><font size="2">　人海茫茫，网海茫茫</font></td></tr>
    </table>
    <hr size="1">
    <b>· 热帖 ·</b>
    <table class="retro" width="100%" cellpadding="3">
      <tr><td>有人记得 1995 年的网络之声吗？</td><td>12</td></tr>
      <tr><td>【求助】拨号一直掉线怎么办</td><td>38</td></tr>
      <tr><td>程序员 30 岁之后都去干什么了？</td><td>204</td></tr>
    </table>
    <hr size="1">
    <center><font size="2" color="#808080">都市论坛建于 1998-06-01 · 十年老坛，历久弥新</font></center>`
  });

  /* ============================ 2005 · 博客元年 ============================ */

  add({
    id: 'e2005_bloghome', era: '2005',
    url: 'http://blog.huanqiu.cn/',
    title: '环球博客 · 记录这个时代',
    keywords: ['博客', 'blog', '环球', '顾言', '网络之声'],
    snippet: '2005 年的博客平台。推荐阅读里有顾言的博客。',
    html: `<div class="bloghead2005">环球博客 <span>记录这个时代</span></div>
    <hr size="1">
    <b>· 推荐阅读 ·</b>
    <table class="retro" width="100%" cellpadding="4">
      <tr><td><a href="http://blog.huanqiu.cn/guyan/2005/12/31.html">顾言：《再见，互联网》</a><br>
        <font size="2">十年之后，他更新了最后一篇博客。</font></td></tr>
      <tr><td><a href="http://blog.huanqiu.cn/momo/2005/12/20.html">陌陌：《我在 1995 年听过一档节目》</a><br>
        <font size="2">回忆那档消失的电台节目。</font></td></tr>
    </table>
    <hr size="1">
    <b>· 站点 ·</b><br>
    <a href="http://search.huanqiu.cn/">[好搜]</a>
    <a href="http://bbs.xiaoyuan.cn/">[校园论坛]</a>`
  });

  add({
    id: 'e2005_search', era: '2005',
    url: 'http://search.huanqiu.cn/',
    title: '好搜 · 搜出全世界',
    keywords: ['搜索', 'search', '好搜'],
    snippet: '2005 年的搜索引擎：好搜。',
    html: `<center><h2 class="title2005">好搜</h2>
    <p><font size="2">搜出全世界 · 收录网页 <b>1,204,318,004</b> 个</font></p></center>
    <hr size="1">
    <div id="search-results" class="results"></div>`
  });

  add({
    id: 'e2005_blog', era: '2005',
    url: 'http://blog.huanqiu.cn/guyan/2005/12/31.html',
    title: '再见，互联网 - 顾言的博客',
    keywords: ['顾言', '再见', '互联网', '博客', '网络之声', '留言', '回复'],
    snippet: '顾言消失十年后的最后一篇博客，写于 2005-12-31 23:59。',
    clue: {
      id: 'c2005', title: '2005 · 最后一篇博客',
      text: '《再见，互联网》是顾言消失前最后一篇博客。文章有六个段落，总觉得每段开头藏着什么规律。下面还有 5 条回复。'
    },
    html: `<div class="blogpost2005">
      <h2 class="title2005">再见，互联网</h2>
      <div class="blogmeta">发表于 2005-12-31 23:59 · 作者：顾言 · 分类：告别</div>
      <hr size="1">
      <p>钥匙这个东西，最怕的就是被遗忘。可我偏偏把最重要的一把，留在了最容易被遗忘的地方。</p>
      <p>匙子能打开锁，而文字能打开记忆。十年足够让一个人忘记另一个人的声音，却删不掉服务器上的一个字节。</p>
      <p>在互联网上，一切都不会真正消失，只会被埋得更深。埋得深，不等于不存在。</p>
      <p>第一台服务器，第一行代码，第一个网友。1995 年的冬天，我在 486 上敲下了网络之声的第一句开场白。</p>
      <p>三年前我搬了一次家，把旧硬盘丢在了角落。可我知道，有些东西不需要硬盘也能活着。</p>
      <p>条条大路通罗马，而我选择把钥匙放在留言里。晚安，网络。再见，互联网。</p>
      <hr size="1">
      <b>评论（5 条）</b>
      <table class="retro" width="100%" cellpadding="4">
        <tr><td><b>1F 老张</b>：沙发！顾老师十年没更新了吧！</td></tr>
        <tr><td><b>2F 网络游侠</b>：拜读。千禧年前后的回忆杀。</td></tr>
        <tr><td><b>3F silent</b>：我大概明白你的意思。……第三条……第三枚钥匙是：之。晚安，网络。</td></tr>
        <tr><td><b>4F 佚名</b>：路过。</td></tr>
        <tr><td><b>5F 电台迷</b>：永远的 1995！永远的网络之声！</td></tr>
      </table>
      <a href="http://blog.huanqiu.cn/">[← 返回环球博客]</a>
    </div>`
  });

  add({
    id: 'e2005_linkpost', era: '2005',
    url: 'http://blog.huanqiu.cn/momo/2005/12/20.html',
    title: '我在 1995 年听过一档节目 - 陌陌的博客',
    keywords: ['1995', '网络之声', '电台', '陌陌', '回忆'],
    snippet: '陌陌回忆 1995 年那档消失的电台节目，链接到顾言的博客。',
    html: `<div class="blogpost2005">
      <h2 class="title2005">我在 1995 年听过一档节目</h2>
      <div class="blogmeta">发表于 2005-12-20 14:32 · 作者：陌陌 · 分类：回忆</div>
      <hr size="1">
      <p>1995 年我还在读高中。那时候的互联网，是拨号声、电流声和等待。</p>
      <p>有天晚上我调到一档叫《网络之声》的节目，主持人讲 BBS 上的段子，讲 C 语言，讲他刚买的一台 486。</p>
      <p>后来那档节目在 1995 年的最后一天消失了。前几天我居然在环球博客看到了他的新文章——<a href="http://blog.huanqiu.cn/guyan/2005/12/31.html">《再见，互联网》</a>。</p>
      <p>原来有些人，消失十年，也只是换了个频道。</p>
      <a href="http://blog.huanqiu.cn/">[← 返回环球博客]</a>
    </div>`
  });

  add({
    id: 'e2005_campus', era: '2005',
    url: 'http://bbs.xiaoyuan.cn/',
    title: '校园论坛 · 水木年华',
    keywords: ['校园', '论坛', '顾言', 'radio_guy', '网络之声'],
    snippet: '校园论坛。有人发帖问：有人认识 1995 年的 radio_guy 吗？',
    html: `<div class="bloghead2005">校园论坛 <span>青春不散场</span></div>
    <hr size="1">
    <table class="retro" width="100%" cellpadding="3">
      <tr><td>【求助】有人认识 1995 年的 radio_guy 吗？听说他是个传奇电台主持人</td><td>23</td></tr>
      <tr><td>毕业十年，BBS 密码还记得吗？</td><td>87</td></tr>
      <tr><td>【原创】我写了一首关于拨号上网的歌</td><td>41</td></tr>
    </table>
    <hr size="1">
    <a href="http://blog.huanqiu.cn/">[博客平台]</a>`
  });

  /* ============================ 2010 · 社交网络 ============================ */

  add({
    id: 'e2010_weibo', era: '2010',
    url: 'http://weiyu.cn/',
    title: '微语 · 围观改变世界',
    keywords: ['微语', '微博', '社交', 'weiyu', '寻人', '顾言'],
    snippet: '2010 年的社交网络：微语。跨年夜，有人发起了新一轮寻人。',
    html: `<div class="snshead">微语 <span>围观改变世界 · 2010</span></div>
    <div class="snsnav"><a href="http://weiyu.cn/">首页</a> | <a href="http://search.weiyu.cn/">微搜</a> | <a href="http://bbs.chengshi.com.cn/t/9137">热门话题</a></div>
    <hr size="1">
    <div class="feed">
      <div class="post"><b>跨年夜神秘电波再现？</b> 凌晨零点，全国多地网友称在 FM 频段听到一段似曾相识的旋律。<a href="http://weiyu.cn/n/1234">查看全文</a><br><span class="meta">转发 4521 · 评论 1003 · 1 小时前</span></div>
      <div class="post"><b>十年寻人：1995 年消失的网络之声主持人</b> 有网友整理了全部线索，号召大家一起找。<a href="http://bbs.chengshi.com.cn/t/9137">参与讨论</a><br><span class="meta">转发 8891 · 评论 2317 · 3 小时前</span></div>
      <div class="post"><b>为什么 2000 年的个人主页比现在的网站更真诚？</b><br><span class="meta">转发 331 · 评论 87 · 5 小时前</span></div>
    </div>`
  });

  add({
    id: 'e2010_search', era: '2010',
    url: 'http://search.weiyu.cn/',
    title: '微搜',
    keywords: ['搜索', 'search', '微搜'],
    snippet: '微语平台的搜索：微搜。',
    html: `<center><h2 class="title2010">微搜</h2>
    <p><font size="2">微语 · 实时搜索 · 1,204,318,004+ 条内容</font></p></center>
    <hr size="1">
    <div id="search-results" class="results"></div>`
  });

  add({
    id: 'e2010_forum', era: '2010',
    url: 'http://bbs.chengshi.com.cn/t/9137',
    title: '十年寻人：1995 年消失的网络之声主持人 - 都市论坛',
    keywords: ['寻人', '顾言', 'radio_guy', '网络之声', '签名', '论坛'],
    snippet: '都市论坛的十年寻人帖。3F 提到顾言换了个 ID 潜伏，签名档是一串 Base64。',
    clue: {
      id: 'c2010', title: '2010 · 寻人帖里的签名档',
      text: '寻人帖 3F 说：有人 2000 年后见过顾言换 ID 潜伏在论坛，签名档是 b2JsaXZpb25fa2VlcGVy，没人知道是什么意思。'
    },
    html: `<div class="bloghead2005">都市论坛 → 怀旧版</div>
    <hr size="1">
    <b>【十年寻人】1995 年消失的网络之声主持人，你在哪里？</b><br>
    <font size="2">楼主：顾言的同学老周　时间：2010-12-31 23:00</font>
    <hr size="1">
    <p>我是顾言大学时代的室友。1995 年 12 月 31 日之后，他再没有出现过。网络之声也停了。十年了，有认识他的朋友吗？</p>
    <hr size="1">
    <b>回复（17 条）</b>
    <table class="retro" width="100%" cellpadding="4">
      <tr><td><b>1F 老网民</b>：我只记得他的 ID 是 radio_guy，主页现在还挂在一个免费空间上。</td></tr>
      <tr><td><b>2F 考古学家</b>：他的主页 2000 年后就没更新了，但留言板还能留言。</td></tr>
      <tr><td><b>3F 数据挖掘机</b>：有人说他换了个 ID 潜伏在论坛里。我挖到他 2001 年注册的号，签名档是一串字符：<b>b2JsaXZpb25fa2VlcGVy</b>，没人知道什么意思。</td></tr>
      <tr><td><b>4F SIGMA-7</b>：十年又十年。他还在听，只是没人懂。</td></tr>
      <tr><td><b>5F 小凡</b>：1995 年最后一期我录了磁带，现在还留着……</td></tr>
    </table>
    <a href="http://weiyu.cn/">[返回微语]</a>`
  });

  add({
    id: 'e2010_keeper', era: '2010',
    url: 'http://weiyu.cn/u/oblivion_keeper',
    title: 'oblivion_keeper 的主页 - 微语',
    keywords: ['oblivion_keeper', 'oblivion', 'keeper', '顾言', '私密日志'],
    snippet: '一个 2001 年注册、只有 1 个粉丝的神秘账号，主页有一篇私密日志。',
    clue: {
      id: 'c2010b', title: '2010 · oblivion_keeper',
      text: '你找到了 oblivion_keeper——他的私密日志写着：第四枚密钥：声。'
    },
    html: `<div class="snshead">oblivion_keeper 的主页</div>
    <div class="profile">
      <b>oblivion_keeper</b> <span class="meta">· 微语认证：无 · 注册于 2001-03-09</span><br>
      关注 <b>0</b> · 粉丝 <b>1</b> · 微博 <b>1</b><br>
      简介：一个只收听不发言的人。
    </div>
    <hr size="1">
    <div class="feed">
      <div class="post"><b>私密日志（仅自己可见）</b><br>
      2010-12-31 23:59 —— 第四枚密钥：声。又十年了，信号还在。如果你在看，那么接下来，去 2025 年的档案馆吧。</div>
    </div>
    <a href="http://weiyu.cn/">[返回微语]</a>`
  });

  add({
    id: 'e2010_news', era: '2010',
    url: 'http://weiyu.cn/n/1234',
    title: '跨年夜神秘电波再现 - 微语头条',
    keywords: ['电波', '跨年', '神秘', '信号', '网络之声'],
    snippet: '跨年夜，多地网友称在 FM 频段听到似曾相识的旋律。',
    html: `<div class="snshead">微语头条</div>
    <hr size="1">
    <h3 class="title2010">跨年夜神秘电波再现</h3>
    <p>今日凌晨零点，北京、上海、广州等地多名网友表示，在 FM 频段偶然捕捉到一段节奏缓慢的旋律，疑似多年前消失的电台节目《网络之声》的开场曲。</p>
    <p>目前尚无电台承认当晚播出了该节目。相关讨论请见<a href="http://bbs.chengshi.com.cn/t/9137">都市论坛寻人帖</a>。</p>
    <a href="http://weiyu.cn/">[返回微语]</a>`
  });

  /* ============================ 2025 · 最后的电台 ============================ */

  add({
    id: 'e2025_archive', era: '2025',
    url: 'http://archive.netvoice.cn/',
    title: '网络之声档案馆',
    keywords: ['档案馆', 'archive', '网络之声', 'netvoice', '信号'],
    snippet: '网络之声档案馆：一台 486 撑起的老站，已经在线 30 年。',
    html: `<div class="archhead">NETVOICE ARCHIVE · 网络之声档案馆</div>
    <div class="archstat">在线 <b>10,958</b> 天 · 设备 486DX2-66 · 机房温度 24.3℃</div>
    <hr>
    <p>本站收录了 1995 年至今与《网络之声》有关的一切资料。<br>
    站长留言：有些网站从未真正下线，只是不再被访问。</p>
    <hr>
    <table class="archnav">
      <tr><td><a href="http://archive.netvoice.cn/about">[ 关于顾言 ]</a></td><td><a href="http://archive.netvoice.cn/guide">[ 收听指南 ]</a></td></tr>
      <tr><td><a href="http://archive.netvoice.cn/signal">[ 信号（已锁定）]</a></td><td><a href="http://radio-ghost.net/">[ 最后的电台 ]</a></td></tr>
    </table>
    <hr>
    <center><font size="2">时间机器接口已就绪 · NETIME v2.0 欢迎您</font></center>`
  });

  add({
    id: 'e2025_about', era: '2025',
    url: 'http://archive.netvoice.cn/about',
    title: '关于顾言 - 网络之声档案馆',
    keywords: ['顾言', '关于', '生平', '网络之声', '失踪'],
    snippet: '顾言的生平档案：程序员、电台主持人，1995 年 12 月 31 日失踪。',
    html: `<div class="archhead">关于顾言</div>
    <hr>
    <p><b>顾言</b>（1969—？），程序员、电台主持人。1993 年在个人电脑上创办网络电台《网络之声》，1995 年 12 月 31 日播出最后一期后失踪。</p>
    <p>互联网考古学家整理了他的全部痕迹，发现一个规律：他在每个年代都会留下一点东西——1995 年的留言板、2000 年的源代码、2005 年的博客、2010 年的签名档。</p>
    <p>据说，他把四把钥匙和一把锁，留在了互联网的角落里。</p>
    <a href="http://archive.netvoice.cn/">[← 返回档案馆]</a>`
  });

  add({
    id: 'e2025_guide', era: '2025',
    url: 'http://archive.netvoice.cn/guide',
    title: '收听指南 - 网络之声档案馆',
    keywords: ['收听', '指南', '频率', '网络之声', '486'],
    snippet: '怎么收听网络之声？指南说：先打开那把锁。',
    html: `<div class="archhead">收听指南</div>
    <hr>
    <table class="archnav">
      <tr><td>频道</td><td>NETVOICE</td></tr>
      <tr><td>设备</td><td>486DX2-66，运行 Linux 0.99</td></tr>
      <tr><td>状态</td><td>已广播 30 年，静默 30 年</td></tr>
      <tr><td>如何收听</td><td><a href="http://archive.netvoice.cn/signal">信号页</a>有一把锁，锁上写着四个字的口令。口令对了，信号就来了。</td></tr>
    </table>
    <a href="http://archive.netvoice.cn/">[← 返回档案馆]</a>`
  });

  add({
    id: 'e2025_signal', era: '2025',
    url: 'http://archive.netvoice.cn/signal',
    title: '信号（已锁定） - 网络之声档案馆',
    keywords: ['信号', '锁定', '口令', '网络之声'],
    snippet: '锁定的信号页。口令：四个字。',
    html: `<div class="archhead">SIGNAL · 信号</div>
    <hr>
    <p>该页面锁定于 <b>1995-12-31 24:00</b>。</p>
    <p>锁上刻着一行小字：<b>「四个字，从 1995 到 2010，一路念下来。」</b></p>
    <form data-netime="unlock" class="lockform">
      <input type="text" id="pw-input" maxlength="8" placeholder="输入口令" autocomplete="off">
      <button type="submit">解 锁</button>
    </form>
    <div id="lock-msg" class="lockmsg"></div>
    <a href="http://archive.netvoice.cn/">[← 返回档案馆]</a>`
  });

  add({
    id: 'e2025_final', era: '2025',
    url: 'http://archive.netvoice.cn/signal/unlocked',
    title: '信号 · 网络之声永存',
    keywords: [],
    hidden: true,
    html: `<div class="archhead unlock">SIGNAL RECEIVED · 信号已接收</div>
    <hr>
    <p>锁开了。</p>
    <p>屏幕上只剩下一行字，和一个正在跳动的信号灯：</p>
    <blockquote class="epilogue">
      「如果你能看到这里，说明你真的读懂了。<br>
      1995 年 12 月 31 日，我没有离开网络——我只是把网络之声搬进了一台 486 服务器，<br>
      在没有人听的地方，继续广播了三十年。<br>
      频道：NETVOICE，频率：30 年。<br>
      欢迎收听。这里是网络之声，我是顾言。<br>
      今晚的节目，是为你准备的。」
    </blockquote>
    <p>信号灯旁边，是一个几乎空白的页面，只有一行小字：</p>
    <p class="epifinal"><b>网络之声 · 永存 —— 1995 — ∞</b></p>
    <hr>
    <form data-netime="reply" class="lockform">
      <textarea id="reply-text" rows="3" placeholder="想对顾言说点什么？（会寄往 1995 年）"></textarea>
      <button type="submit">寄 出</button>
    </form>
    <p class="archstat"><a href="http://archive.netvoice.cn/">[← 返回档案馆]</a> · <a href="http://radio-ghost.net/">[访问最后的电台]</a></p>
    <!-- --. --- --- -.. -... -.-- .  = GOODBYE -->`
  });

  add({
    id: 'e2025_ghost', era: '2025',
    url: 'http://radio-ghost.net/',
    title: '最后的电台 · radio-ghost.net',
    keywords: ['最后的电台', 'radio-ghost', '幽灵电台', '网络之声'],
    snippet: '一个 2005 年风格、却还在更新的幽灵站点。最后更新：2025-01-01。',
    html: `<marquee behavior="alternate" width="100%">本页最后更新于 2025 年 —— 愿你依然相信，互联网是有记忆的</marquee>
    <center><h2 class="title2005">最 后 的 电 台</h2></center>
    <center><font size="2" color="#808080">radio-ghost.net · 一个 2005 年风格的老站，至今仍在更新</font></center>
    <hr size="1">
    <p>你好，我是这个站的站长。这个站 2005 年上线，中间断断续续，但从未关闭。</p>
    <p>我在整理硬盘时翻到了很多旧东西：BBS 存档、节目单、还有一盘录了 1995 年最后一期节目的磁带。</p>
    <p>如果你也对那段历史感兴趣，欢迎来 <a href="http://archive.netvoice.cn/">网络之声档案馆</a> 坐坐。</p>
    <hr size="1">
    <center><font size="2" color="#808080">` + cnt(313) + ` · 本页不设追踪，不设广告，不设意义</font></center>`
  });

  /* ============================ 工具函数 ============================ */

  function getSite(id) { return SITES[id] || null; }

  function listEraPages(era) {
    return Object.keys(SITES).filter(function (k) { return SITES[k].era === era; }).map(function (k) { return SITES[k]; });
  }

  var NetSites = { SITES: SITES, getSite: getSite, listEraPages: listEraPages };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetSites;
  } else {
    global.NetSites = NetSites;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
