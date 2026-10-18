'use strict';
/* 关卡 3 — Web 渗透 (SQL 注入 + XSS)
 * 靶场在线时: web/login/search/dump 走真实 HTTP + 真实 SQLite */
(function () {
  const cfg = {
    app: 'VulnBank 网上银行',
    host: 'http://vuln-bank.local',
    users: { admin: { hash: '0192023a7bbd73250516f069df18b500' } },
  };
  const labOn = () => typeof Lab !== 'undefined' && Lab.available;

  const web = async (toks) => {
    if (labOn()) {
      T.print('靶场模式: 真实 Web 应用已就绪 → ' + Lab.base + '/', 'info');
      T.print('(用鼠标操作? 输入 browser 打开真实浏览器窗口; 也可以直接浏览器访问上面的地址)', 'dim');
    }
    Game.browsing = new FakeWeb(cfg);
    Game.browserLine = T.printNode(Game.browsing.node());
    T.print('浏览器已打开: ' + cfg.host, 'dim');
  };
  web.usage = 'web — 打开目标网站';

  const login = async (toks) => {
    const w = Game.browsing;
    if (!w) { T.print('请先输入 web 打开目标网站。', 'error'); return; }
    const user = toks[1] || '';
    const pass = toks.slice(2).join(' ');
    if (w.loggedIn) { T.print('已经登录了。', 'info'); return; }

    if (labOn()) {
      try {
        const j = await Lab.api('/api/login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
        T.print('SQL 执行 (真实 ' + (j.engine || 'SQLite') + '): ' + j.sql, 'dim');
        if (j.ok && j.rows && j.rows.length) {
          T.print(`✔ 查询返回 ${j.rows.length} 行 — 登录成功! (真实靶场)`, 'success');
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
      T.print('✔ 查询返回 1 行结果 — 你绕过了登录!', 'success');
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
  login.usage = 'login <用户> <密码> — 尝试登录 (试试 SQL 注入)';

  const search = async (toks) => {
    const w = Game.browsing;
    if (!w) { T.print('请先输入 web 打开目标网站。', 'error'); return; }
    if (!w.loggedIn) { T.print('请先登录。', 'error'); return; }
    const q = toks.slice(1).join(' ');
    if (!q) { T.print('用法: search <关键词>', 'info'); return; }
    w.searchTerm = q;

    if (labOn()) {
      try {
        const j = await Lab.api('/api/search?q=' + encodeURIComponent(q));
        T.print(`服务器真实反射: "${j.echoed}"`, 'dim');
        if (!j.safe && /<script|<img[^>]*onerror/i.test(q)) {
          w.xssFired = true; w.page = 'xss';
          T.print('✔ 你的输入被真实原样反射 — 若为浏览器页面，脚本将被执行 (XSS 确认)!', 'success');
          T.print(`📡 窃取到会话 Cookie: session=${w.cookie}`, 'success');
          T.print('本关 flag: flag{sqli_xss_chain}', 'hint');
          Sound.good();
          completeObjective('xss');
          w.update();
        } else {
          w.page = 'results';
          T.print('搜索完成 (真实靶场)。', 'info');
          w.update();
        }
        return;
      } catch (e) {
        T.print('靶场请求失败，回退到模拟模式: ' + e.message, 'dim');
      }
    }

    if (/<script|<img[^>]*onerror/i.test(q)) {
      w.xssFired = true; w.page = 'xss';
      T.print('✔ 你注入的脚本在"受害者浏览器"中执行了!', 'success');
      T.print(`📡 窃取到会话 Cookie: session=${w.cookie}`, 'success');
      T.print('本关 flag: flag{sqli_xss_chain}', 'hint');
      Sound.good();
      completeObjective('xss');
      w.update();
    } else {
      w.page = 'results';
      T.print(`搜索 "${q}" 完成，结果显示在浏览器中。`, 'info');
      w.update();
    }
  };
  search.usage = 'search <关键词> — 站内搜索 (试试注入脚本)';

  const dump = async (toks) => {
    const w = Game.browsing;
    if (!w || !w.loggedIn) { T.print('需要先登录后台 (提示: 用 SQL 注入)。', 'error'); return; }
    if (labOn()) {
      try {
        const j = await Lab.api('/api/users');
        T.print('─ 真实数据库用户表 (靶场 ' + (j.engine || 'SQLite') + ') ─', 'header');
        T.print('  id   username  password_hash', 'cmd');
        (j.rows || []).forEach((r) => T.print(`  ${r.id}    ${r.username}     ${r.password_hash}`, 'cmd'));
        T.print('数据库中的密码以哈希存储 — 但弱密码仍可被字典爆破。', 'dim');
        return;
      } catch (e) {
        T.print('靶场请求失败，回退到模拟模式: ' + e.message, 'dim');
      }
    }
    T.print('─ 用户数据表 (后台导出) ─', 'header');
    T.print('  id   username  password_hash                           email', 'cmd');
    T.print(`  1    admin     ${w.cfg.users.admin.hash}    admin@vuln-bank.local`, 'cmd');
    T.print('数据库中的密码以哈希存储 — 但弱密码仍可被字典爆破。', 'dim');
  };
  dump.usage = 'dump — (登录后) 导出用户数据';

  const logout = (toks) => {
    const w = Game.browsing;
    if (!w) { T.print('没有打开的浏览器。', 'info'); return; }
    w.loggedIn = false; w.user = null; w.page = 'home'; w.searchTerm = '';
    T.print('已退出登录。', 'info');
    w.update();
  };
  logout.usage = 'logout — 退出登录';

  Game.levels.push({
    id: 3,
    name: 'Web 渗透',
    flag: 'flag{sqli_xss_chain}',
    winAch: 'web_pwner',
    prompt: 'attacker@vulnbank:~$',
    brief: 'VulnBank 银行的登录系统存在多处漏洞。\n目标: 先用 SQL 注入绕过登录，再用 XSS 窃取管理员会话。\n(靶场在线时，这里是真实数据库、真实 HTTP 攻击)',
    answers: {},
    fs: {
      'README.txt': '目标: http://vuln-bank.local (VulnBank 网上银行)\n\n命令:\n  web               打开目标网站\n  login <用户> <密码>  尝试登录\n  search <关键词>     站内搜索\n  dump               (登录后) 导出用户数据\n  logout            退出登录\n\n提示: 管理员账户是 admin。试着在用户名里做点手脚。\n',
    },
    commands: { web, login, search, dump, logout },
    hints: [
      'Web 应用的弱点在登录框和搜索框: 输入的内容会被拼进 SQL 或回显到页面。',
      '登录时在用户名里用引号闭合 SQL、再用注释符吞掉密码判断；搜索时输入脚本标签触发 XSS。',
      '依次执行: web → login "admin\'--" 任意密码 → search <script>alert(1)</script> → 提交找到的 flag。',
    ],
    scenarios: [
      {
        id: 's1', title: '配置泄露', xpBonus: 100, flag: 'flag{config_leak}',
        brief: '情报: 有人在服务器上发现了一份残留的配置文件 config.php，里面可能存着管理员的硬编码凭据。\n找到它、读出凭据，向总部汇报。',
        fs: {
          'config.php': '<?php\n// 数据库与管理员配置\n$db_host = "10.0.2.7";\n$db_user = "root";\n$admin_user = "admin";\n$admin_pass = "VulnBank#2025";  // TODO: 迁移到环境变量!\n$debug = true;\n?>\n',
        },
        answers: { 'vulnbank#2025': 's1_pass' },
        onCatFile(name) { if (name === 'config.php') completeObjective('s1_read'); },
        objectives: [
          { id: 's1_read', desc: '找到并阅读配置文件', xp: 40 },
          { id: 's1_pass', desc: '把硬编码的管理员密码提交给总部', xp: 70 },
          { id: 'flag', desc: '提交扩展场景 flag', xp: 100 },
        ],
        hints: [
          '配置文件应该在文件系统里 (ls / cat)。',
          '找 $admin_pass 那一行。',
          '执行: ls → cat config.php → 提交密码 VulnBank#2025 → 提交 flag{config_leak}。',
        ],
      },
    ],
    learn: [
      { t: 'SQL 注入 (SQLi)', b: '如果程序把用户输入直接拼进 SQL 查询，攻击者就能构造特殊输入改变查询逻辑。例如: SELECT * FROM users WHERE username=\'admin\'--\' AND password=\'x\'，其中 -- 是 SQL 注释，把密码校验"注释"掉了。修复: 参数化查询。' },
      { t: 'XSS 跨站脚本', b: '如果程序把用户输入原样渲染到页面 (echo/innerHTML)，攻击者可注入 <script> 在他人浏览器里执行代码，窃取 Cookie、会话等。修复: 输出转义 + CSP。' },
      { t: 'OWASP Top 10', b: 'OWASP 每年发布 Web 应用十大安全风险，SQL 注入与 XSS 常年霸榜。知己知彼: owasp.org' },
      { t: '哈希存储的局限', b: '网站存储密码时用哈希而不是明文，这是正确的做法。但弱密码 (如 admin123) 仍能被离线字典爆破 — 所以真实世界要求高强度密码 + 加盐。' },
    ],
    objectives: [
      { id: 'sqli', desc: '绕过登录验证，进入管理员后台', xp: 70 },
      { id: 'xss', desc: '在站内搜索中执行脚本，窃取管理员会话', xp: 80 },
      { id: 'flag', desc: '提交本关 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【任务简报 — Web 渗透】',
        '情报显示，VulnBank 银行的管理系统存在多处漏洞。',
        '你的任务: 进入后台，并证明其会话可以被劫持。',
        '先输入 web 打开目标网站看看。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 3 (Web 安全)，直接开干也行。', 'dim');
      t.print('提示: 先 cat README.txt 了解攻击面。', 'dim');
    },
  });
})();
