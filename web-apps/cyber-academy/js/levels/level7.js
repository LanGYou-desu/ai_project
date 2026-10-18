'use strict';
/* 关卡 7 — 应急响应 (蓝队) */
(function () {
  const BACKDOOR = [];
  for (let i = 0; i < 64; i++) BACKDOOR.push((i * 31 + 3) % 256);
  BACKDOOR.push(...strToBytes('REVERSE_SHELL_MARKER\n'));
  BACKDOOR.push(...strToBytes('http://203.0.113.66:4444/connect\n'));
  BACKDOOR.push(...strToBytes('chmod +x /tmp/x\n'));

  const quarantine = async (toks) => {
    const file = toks[1] || '';
    if (file !== '.system-update') {
      T.print(`"${file}" 不是可疑文件。先确认哪个文件有问题 (用 ls / file / strings 排查)。`, 'error');
      return;
    }
    T.print('正在隔离 .system-update ...', 'info');
    await sleep(600);
    T.print('✔ 已隔离! 文件移动至隔离区，并记录 SHA-256 哈希。', 'success');
    T.print('下一步: 查杀同源变种、封禁攻击者 IP、修补漏洞、写事件报告。', 'dim');
    Sound.ok();
    completeObjective('quarantine');
  };
  quarantine.usage = 'quarantine <文件> — 隔离确认的可疑文件';

  Game.levels.push({
    id: 7,
    name: '应急响应',
    flag: 'flag{incident_contained}',
    winAch: 'blue_team',
    prompt: 'soc@incident:~$',
    brief: '你的服务器疑似被入侵! 作为蓝队分析师:\n找出攻击者的入侵路径、定位后门，并完成隔离。\n(注意: 名单里可能藏着隐藏文件)',
    answers: {},
    commands: { quarantine },
    fs: {
      'README.txt': '事件背景: 一台公网服务器 10.0.0.7 出现异常外连，疑似被入侵。\n\n分析手段:\n  ls / cat / file / strings / tail / hexdump\n  quarantine <文件>  隔离确认的可疑文件\n\n线索都在日志里: access.log (SSH 认证), web.log (Web 访问)。\n',
      'access.log': [
        'Jan 12 08:01:02 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54123 ssh2',
        'Jan 12 08:01:05 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54124 ssh2',
        'Jan 12 08:01:09 server sshd[1011]: Failed password for root from 203.0.113.66 port 54125 ssh2',
        'Jan 12 08:01:12 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54126 ssh2',
        'Jan 12 08:01:15 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54127 ssh2',
        'Jan 12 08:01:18 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54128 ssh2',
        'Jan 12 08:01:21 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54129 ssh2',
        'Jan 12 08:01:24 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54130 ssh2',
        'Jan 12 08:01:27 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54131 ssh2',
        'Jan 12 08:01:30 server sshd[1011]: Accepted password for admin from 203.0.113.66 port 54132 ssh2',
        'Jan 12 08:01:31 server sshd[1011]: pam_unix(sshd:session): session opened for user admin by (uid=0)',
        'Jan 12 08:15:40 server sshd[1011]: Received disconnect from 203.0.113.66',
      ].join('\n') + '\n',
      'web.log': [
        '203.0.113.66 - - [12/Jan/2025:08:02:11 +0800] "GET /index.php?id=1 UNION SELECT username,password FROM users -- " 200 512 "Mozilla/5.0 (compatible; sqlmap/1.7)"',
        '203.0.113.66 - - [12/Jan/2025:08:02:15 +0800] "GET /index.php?id=1\' AND sleep(5)-- " 500 89 "Mozilla/5.0 (compatible; sqlmap/1.7)"',
        '203.0.113.66 - - [12/Jan/2025:08:03:02 +0800] "GET /admin/upload.php HTTP/1.1" 200 431 "-"',
        '203.0.113.66 - - [12/Jan/2025:08:03:20 +0800] "POST /admin/upload.php HTTP/1.1" 200 214 "-"',
        '10.0.0.7 - - [12/Jan/2025:08:10:00 +0800] "GET /shell.php HTTP/1.1" 200 512 "-"',
      ].join('\n') + '\n',
      '.system-update': { bytes: BACKDOOR },
    },
    onCatFile(name) {
      if (name === 'access.log') completeObjective('log');
      if (name === 'web.log') completeObjective('method');
    },
    onStrings(runs) {
      const s = runs.join(' ');
      if (s.includes('203.0.113.66') && runs.some((r) => r.includes('Failed password'))) completeObjective('log');
      if (s.includes('sqlmap') || s.includes('UNION')) completeObjective('method');
      if (s.includes('REVERSE_SHELL_MARKER')) completeObjective('backdoor');
    },
    hints: [
      '两条日志 + 一个可疑文件: access.log 是 SSH 认证日志，web.log 是 Web 访问日志。',
      '日志里找"反复失败后成功"的 IP 和 Web 攻击特征 (sqlmap/UNION)；用 ls 看有没有隐藏文件，file/strings 确认它是什么。',
      '依次执行: cat access.log → cat web.log → ls → file .system-update → strings .system-update → quarantine .system-update → 提交 flag。',
    ],
    scenarios: [
      {
        id: 's1', title: '同源排查', xpBonus: 100, flag: 'flag{full_hunt}',
        brief: '攻击者的手法可能不只用在了一台机器上。\n排查另一台服务器 srv2 的日志: 同一 IP 是否也入侵了它? 留下了什么持久化痕迹?',
        fs: {
          'srv2.log': [
            'Jan 12 08:20:01 srv2 sshd[2211]: Failed password for admin from 203.0.113.66 port 55123 ssh2',
            'Jan 12 08:20:04 srv2 sshd[2211]: Failed password for admin from 203.0.113.66 port 55124 ssh2',
            'Jan 12 08:20:30 srv2 sshd[2211]: Accepted password for admin from 203.0.113.66 port 55132 ssh2',
            'Jan 12 08:22:11 srv2 CRON[2233]: (root) CMD (bash /tmp/backdoor.sh >/dev/null 2>&1)',
            'Jan 12 08:30:00 srv2 sshd[2211]: Received disconnect from 203.0.113.66',
          ].join('\n') + '\n',
        },
        onStrings(runs) {
          const s = runs.join(' ');
          if (s.includes('203.0.113.66') && s.includes('Failed password')) completeObjective('s1_log');
          if (s.includes('backdoor.sh')) completeObjective('s1_ioc');
        },
        objectives: [
          { id: 's1_log', desc: '确认同一 IP 也入侵了 srv2', xp: 60 },
          { id: 's1_ioc', desc: '找到攻击者留下的持久化痕迹 (计划任务)', xp: 70 },
          { id: 'flag', desc: '提交扩展场景 flag', xp: 100 },
        ],
        hints: [
          'srv2.log 在文件系统里。',
          '找同一攻击 IP 和计划任务 (CRON) 条目。',
          '执行: strings srv2.log → 提交 flag{full_hunt}。',
        ],
      },
    ],
    learn: [
      { t: '蓝队与红队', b: '红队模拟攻击者打进来，蓝队负责发现、响应、恢复。蓝队核心能力: 日志分析、威胁检测、应急响应、取证。' },
      { t: '暴力破解的日志特征', b: '同一 IP 短时间内大量 Failed password，紧接着一次 Accepted —— 这就是爆破成功的"实锤"。发现后应立即封禁 IP 并排查账户后门。' },
      { t: '入侵指标 (IoC)', b: 'IoC 是"已经失陷"的证据: 恶意 IP、文件哈希、URL、注册表项。分析时把发现记录成 IoC 清单，用于全网排查。' },
      { t: '后门与持久化', b: '攻击者得手后会留下后门保持访问: 隐藏文件、计划任务、新账户、SSH 密钥。找后门要看: 近期新增的可疑文件、计划任务、登录记录。' },
      { t: '应急响应流程', b: '检测 (发现异常) → 分析 (定位原因) → 遏制 (隔离/断网) → 根除 (删后门/打补丁) → 恢复 (还原服务) → 复盘 (写报告, 改进防御)。' },
    ],
    objectives: [
      { id: 'log', desc: '分析认证日志，找出暴力破解的攻击者', xp: 60 },
      { id: 'method', desc: '从 Web 日志确认攻击者利用的手法', xp: 60 },
      { id: 'backdoor', desc: '定位攻击者留下的后门文件', xp: 70 },
      { id: 'quarantine', desc: '隔离后门文件，遏制事态', xp: 80 },
      { id: 'flag', desc: '提交本关 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【事件响应】',
        '红色警报: 你的服务器 10.0.0.7 出现异常外连!',
        '你被分配到蓝队应急小组。冷静，按流程来:',
        '检测 → 分析 → 遏制 → 根除 → 恢复 → 复盘。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 9 (蓝队与应急响应)，示例教学: demo logs。', 'dim');
      t.print('提示: 先读 README.txt 了解事件背景。', 'dim');
    },
  });
})();
