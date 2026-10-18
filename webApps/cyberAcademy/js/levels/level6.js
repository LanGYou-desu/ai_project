'use strict';
/* 关卡 6 — 终极渗透 (综合考核)
 * 靶场在线时: scan 做真实端口探测、SQLi 打真实数据库、
 *             ssh 走真实 TCP 握手、flag 从靶机真实获取 */
(function () {
  const cfg = {
    app: 'VulnBank 运维后台',
    host: 'http://10.0.2.7',
    users: { admin: { hash: '5f4dcc3b5aa765d61d8327deb882cf99' } },
  };
  const labOn = () => typeof Lab !== 'undefined' && Lab.available;
  const labFlag = 'flag{total_penetration}';

  const scan = async (toks) => {
    const net = toks[1] || '';
    if (net !== '10.0.2.0/24') { T.print('用法: scan 10.0.2.0/24', 'error'); return; }
    T.print('正在对 10.0.2.0/24 进行全端口扫描...', 'info');
    await sleep(900);
    if (labOn()) {
      try {
        const j = await Lab.api('/api/scan', { method: 'POST', body: '{}' });
        T.print('靶场模式: 对真实监听端口进行连通性探测', 'dim');
        T.print('发现 3 台活跃主机:', 'info');
        T.print('  10.0.2.1     (网关路由器)', 'dim');
        T.print('  10.0.2.7     (服务器 — 开放端口如下)', 'cmd');
        (j.ports || []).forEach((p) => {
          T.print(`      ${String(p.port).padEnd(6)} ${p.open ? 'open' : 'closed'}  ${p.service}`, p.open ? 'cmd' : 'dim');
        });
        T.print('  10.0.2.10    (打印机)', 'dim');
        T.print('目标: 10.0.2.7 运行着 Web 服务，可能是 VulnBank 运维后台。', 'hint');
        completeObjective('scan');
        return;
      } catch (e) {
        T.print('靶场探测失败，使用模拟拓扑: ' + e.message, 'dim');
      }
    }
    T.print('发现 3 台活跃主机:', 'info');
    T.print('  10.0.2.1     (网关路由器)', 'dim');
    T.print('  10.0.2.7     (服务器 — 开放端口: 80, 22)', 'cmd');
    T.print('  10.0.2.10    (打印机)', 'dim');
    T.print('目标: 10.0.2.7 运行着 Web 服务，可能是 VulnBank 运维后台。', 'hint');
    completeObjective('scan');
  };
  scan.usage = 'scan <网段> — 侦察目标网络';

  const web = async (toks) => {
    if (labOn()) {
      T.print('靶场模式: 真实 Web 应用已就绪 → ' + Lab.base + '/', 'info');
      T.print('(用鼠标操作? 输入 browser 打开真实浏览器窗口，手动完成整条攻击链)', 'dim');
    }
    Game.browsing = new FakeWeb(cfg);
    Game.browserLine = T.printNode(Game.browsing.node());
    T.print('浏览器已打开: ' + cfg.host, 'dim');
  };
  web.usage = 'web — 打开目标后台';

  const login = async (toks) => {
    const w = Game.browsing;
    if (!w) { T.print('请先输入 web 打开目标后台。', 'error'); return; }
    const user = toks[1] || '';
    const pass = toks.slice(2).join(' ');
    if (w.loggedIn) { T.print('已经登录了。', 'info'); return; }

    if (labOn()) {
      try {
        const j = await Lab.api('/api/login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
        T.print('SQL 执行 (真实 ' + (j.engine || 'SQLite') + '): ' + j.sql, 'dim');
        if (j.ok && j.rows && j.rows.length) {
          T.print(`✔ 查询返回 ${j.rows.length} 行 — 你进入了运维后台! (真实靶场)`, 'success');
          Sound.ok();
          Game.labRows = j.rows;
          if (j.injected) {
            completeObjective('sqli');
            unlockAchievement('real_pwn');
          }
          w.loggedIn = true; w.user = j.rows[0].username; w.page = 'panel';
          w.update();
        } else {
          T.print('✘ 认证失败: 用户名或密码错误 (真实靶场)', 'error');
          Sound.err();
        }
        return;
      } catch (e) {
        T.print('靶场请求失败，回退到模拟模式: ' + e.message, 'dim');
      }
    }

    const sqli = /^admin['"]\s*(--|#|\/\*)/i.test(user) ||
                 /admin['"]\s*$/i.test(user) ||
                 /'\s*or\s*'1'\s*=\s*'1/i.test(user);
    if (sqli) {
      T.print(`SQL 执行: SELECT * FROM users WHERE username='${user}' AND password='...'`, 'dim');
      T.print('✔ 查询返回 1 行 — 你进入了运维后台!', 'success');
      Sound.ok();
      w.loggedIn = true; w.user = 'admin'; w.page = 'panel';
      completeObjective('sqli');
      w.update();
    } else {
      T.print(`SQL 执行: SELECT * FROM users WHERE username='${user}' AND password='${pass}'`, 'dim');
      T.print('✘ 认证失败: 用户名或密码错误', 'error');
      Sound.err();
    }
  };
  login.usage = 'login <用户> <密码> — 登录后台 (试试 SQL 注入)';

  const dump = async (toks) => {
    const w = Game.browsing;
    if (!w || !w.loggedIn) { T.print('需要先登录后台 (提示: 用 SQL 注入)。', 'error'); return; }
    if (labOn()) {
      try {
        const j = await Lab.api('/api/users');
        T.print('─ 真实数据库用户表 (靶场 ' + (j.engine || 'SQLite') + ') ─', 'header');
        T.print('  id   username  password_hash', 'cmd');
        (j.rows || []).forEach((r) => T.print(`  ${r.id}    ${r.username}     ${r.password_hash}`, 'cmd'));
        T.print('拿到了密码哈希。试试用 crack 命令爆破它 (字典在工具包里)。', 'dim');
        completeObjective('dump');
        return;
      } catch (e) {
        T.print('靶场请求失败，回退到模拟模式: ' + e.message, 'dim');
      }
    }
    T.print('─ 用户数据表 (后台导出) ─', 'header');
    T.print('  id   username  password_hash', 'cmd');
    T.print(`  1    admin     ${w.cfg.users.admin.hash}`, 'cmd');
    T.print('拿到了密码哈希。试试用 crack 命令爆破它 (字典在工具包里)。', 'dim');
    completeObjective('dump');
  };
  dump.usage = 'dump — (登录后) 导出用户数据';

  const ssh = async (toks) => {
    const user = toks[1] || '';
    const pass = toks.slice(2).join(' ');
    if (labOn()) {
      try {
        T.print('靶场模式: 正在进行真实 TCP 握手 (SSH 模拟服务 :2222) ...', 'info');
        await sleep(500);
        const j = await Lab.api('/api/ssh', { method: 'POST', body: JSON.stringify({ user, pass }) });
        if (j.ok) {
          T.print(`✔ 认证成功 (服务器回复: ${j.reply}) — 已登录 root@10.0.2.7`, 'success');
        } else {
          T.print(`✘ 认证失败 (服务器回复: ${j.reply})`, 'error');
          Sound.err();
          T.print('提示: 密码需要从 dump 出的哈希里破解。', 'dim');
          return;
        }
      } catch (e) {
        T.print('靶场 SSH 请求失败，回退到模拟: ' + e.message, 'dim');
        if (user !== 'admin' || pass !== 'password') {
          T.print('✘ ssh: Permission denied', 'error');
          Sound.err();
          T.print('提示: 密码需要从 dump 出的哈希里破解。', 'dim');
          return;
        }
      }
    } else if (user !== 'admin' || pass !== 'password') {
      T.print('✘ ssh: Permission denied (publickey,password)', 'error');
      Sound.err();
      T.print('提示: 密码需要从 dump 出的哈希里破解。', 'dim');
      return;
    }
    // 登录成功
    Sound.good();
    Game.remote = true;
    const fsRemote = {
      'flag.txt': labFlag + '\n',
      'note.txt': '干得漂亮，特工。把 flag.txt 里的内容提交给总部，任务就完成了。\n',
    };
    Game.active.fsRemote = fsRemote;
    completeObjective('ssh');
    T.print('现在可以在服务器上操作了 — 输入 ls 看看有什么。', 'dim');
  };
  ssh.usage = 'ssh <用户> <密码> — SSH 登录目标服务器';

  Game.levels.push({
    id: 6,
    name: '终极渗透',
    flag: 'flag{total_penetration}',
    winAch: 'total_pwn',
    prompt: 'hacker@darknet:~$',
    brief: '最终考核: 从零开始渗透一台目标服务器。\n侦察 → 打点 → 提权 → 收 flag，把前面学的都用上。\n(靶场在线时，这是对真实本地靶机的完整攻击链)',
    crackHash: '5f4dcc3b5aa765d61d8327deb882cf99',
    answers: {},
    fs: {
      'README.txt': '最终任务: 渗透 10.0.2.7。\n\n流程参考:\n  1. scan 10.0.2.0/24      侦察网络\n  2. web + login           打开后台，SQL 注入进后台\n  3. dump                  导出用户表，得到密码哈希\n  4. crack <哈希>           字典爆破密码\n  5. ssh admin <密码>       登录服务器\n  6. cat flag.txt          读取最终 flag\n',
    },
    onCrackOk(h) {
      if (h === '5f4dcc3b5aa765d61d8327deb882cf99') completeObjective('crack');
    },
    onCatFile(name) {
      if (name === 'flag.txt') completeObjective('readflag');
    },
    commands: { scan, web, login, dump, ssh },
    hints: [
      '把前五关的技能串成攻击链: 侦察 → Web 打点 → 哈希爆破 → 远程登录 → 收 flag。',
      '扫描找目标 → 打开后台 → 用 SQL 注入进入后台 → 导出数据拿哈希 → 爆破密码 → 用凭据登录 → 读取 flag 文件。',
      '完整流程: scan 10.0.2.0/24 → web → login "admin\'--" → dump → crack <哈希> → ssh admin password → cat flag.txt → 提交 flag{total_penetration}。',
    ],
    scenarios: [
      {
        id: 's1', title: 'root 权限', xpBonus: 100, flag: 'flag{root_access}',
        brief: '你在目标服务器上拿到了 /etc/shadow 的副本。\n爆破 root 的哈希，拿下最高权限 (字典里有这个弱密码)。',
        fs: {
          'shadow.txt': [
            '# /etc/shadow 摘录 (真实格式: 用户名:$id$salt$hash:... )',
            '# 本靶场教学版用 SHA-256 简化哈希 (第二个 $ 之后的部分)',
            'root:$6$L4bS3cr3t$ce5ca673d13b36118d54a7cf13aeb0ca012383bf771e713421b4d1fd841f539a:18300:0:99999:7:::',
            'daemon:*:18300:0:99999:7:::',
          ].join('\n') + '\n',
        },
        onCrackOk(h) {
          if (h === 'ce5ca673d13b36118d54a7cf13aeb0ca012383bf771e713421b4d1fd841f539a') completeObjective('s1_crack');
        },
        onCatFile(name) { if (name === 'shadow.txt') completeObjective('s1_shadow'); },
        objectives: [
          { id: 's1_shadow', desc: '查看 shadow 文件，找到 root 哈希', xp: 50 },
          { id: 's1_crack', desc: '爆破 root 密码哈希', xp: 70 },
          { id: 'flag', desc: '提交扩展场景 flag', xp: 100 },
        ],
        hints: [
          'shadow.txt 在文件系统里，root 哈希是 64 位 SHA-256 (第二个 $ 之后的部分)。',
          'crack 支持 64 位哈希，字典里有答案。把 shadow 行里的哈希部分提取出来。',
          '执行: cat shadow.txt → 提取 ce5ca673... 哈希 → crack <该哈希> → 提交 flag{root_access}。',
        ],
      },
    ],
    learn: [
      { t: '攻击链 (Kill Chain)', b: '真实渗透是一条链: 侦察 → 漏洞利用 → 权限提升 → 横向移动 → 数据窃取。任何一环被防御方发现，链条就断了。' },
      { t: '为什么弱密码会要命', b: 'MD5(admin123) 和 MD5(password) 等弱密码的哈希早已被彩虹表和字典收录，秒破。这就是为什么真实系统强制复杂密码 + 加盐 + 多因素认证。' },
      { t: '纵深防御', b: '只修一个漏洞是不够的。SQL 注入、弱口令、未打补丁的服务... 攻击者只需要一个入口。纵深防御: 网络隔离、WAF、强认证、监控告警层层设防。' },
      { t: '渗透测试的道德边界', b: '本课程展示的所有技术，只应在获得授权后用于你的系统、或合法渗透测试项目。非法入侵他人系统是犯罪 — 能力越大，责任越大。' },
    ],
    objectives: [
      { id: 'scan', desc: '对目标网络进行侦察', xp: 40 },
      { id: 'sqli', desc: '突破 Web 应用认证，进入后台', xp: 60 },
      { id: 'dump', desc: '从后台导出数据，拿到密码哈希', xp: 50 },
      { id: 'crack', desc: '从哈希中恢复出管理员密码', xp: 70 },
      { id: 'ssh', desc: '用得到的凭据登录目标服务器', xp: 70 },
      { id: 'readflag', desc: '在服务器上找到并读取 flag 文件', xp: 60 },
      { id: 'flag', desc: '提交最终 flag', xp: 150 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【终极考核】',
        '学院所有的课程已经结束。现在，是证明你的时候。',
        '目标: 一台真实布置在暗网边缘的服务器 — 10.0.2.7。',
        '没有人会给你提示。你学到的每一条命令，都是你的武器。',
        '',
        '祝你好运，特工。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 1-5 查漏补缺；靶场模式: lab 查看真实训练场。', 'dim');
      t.print('提示: 先 cat README.txt 回顾完整攻击链。', 'dim');
    },
  });
})();
