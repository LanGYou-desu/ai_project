'use strict';
/* 关卡 1 — 网络侦察 */
(function () {
  const scan = async (toks) => {
    if (toks[1] === '-sV') {
      const ip = toks[2] || '';
      if (ip !== '10.0.1.13') {
        T.print(`对 ${ip} 的服务探测无结果: 目标无响应或防火墙过滤。`, 'dim');
        return;
      }
      T.print(`正在对 ${ip} 进行全端口服务探测...`, 'info');
      await sleep(900);
      T.print('端口状态:', 'info');
      T.print('  22/tcp     open    ssh       OpenSSH 6.6.1p1', 'cmd');
      T.print('  80/tcp     open    http      Apache 2.4.7', 'cmd');
      T.print('  1337/tcp   open    unknown   ← 可疑端口!', 'cmd');
      T.print('使用 banner <IP> <端口> 获取服务指纹。', 'dim');
      completeObjective('scanv');
      return;
    }
    const net = toks[1] || '';
    if (net !== '10.0.1.0/24') { T.print('用法: scan 10.0.1.0/24 或 scan -sV <IP>', 'error'); return; }
    T.print('正在对 10.0.1.0/24 进行快速扫描...', 'info');
    await sleep(800);
    T.print('发现 3 台活跃主机:', 'info');
    T.print('  10.0.1.5     (WEB 服务器)', 'cmd');
    T.print('  10.0.1.13    (未知主机 — 响应模式异常)', 'cmd');
    T.print('  10.0.1.21    (打印机)', 'dim');
    T.print('可疑目标: 10.0.1.13 似乎刻意隐藏了什么。', 'hint');
    T.print('试试对单台主机做服务探测: scan -sV 10.0.1.13', 'dim');
    completeObjective('scan');
  };
  scan.usage = 'scan <网段> — 快速扫描; scan -sV <IP> — 服务探测';

  const banner = async (toks) => {
    const ip = toks[1] || '';
    const port = toks[2] || '';
    if (ip === '10.0.1.13' && port === '1337') {
      if (typeof Lab !== 'undefined' && Lab.available) {
        T.print('靶场模式: 通过靶场连接真实后门服务 (真实 TCP) ...', 'info');
        const j = await Lab.api('/api/banner', { method: 'POST', body: '{}' });
        await sleep(400);
        T.print('banner: "' + (j.banner || '(无响应)') + '"', 'cmd');
        if (!j.banner) { T.print('靶场后门无响应。', 'error'); return; }
      } else {
        T.print('正在获取 10.0.1.13:1337 服务指纹...', 'info');
        await sleep(600);
        T.print('banner: "TelnetBackdoor v0.9 — (c) by rootkit_1337"', 'cmd');
      }
      T.print('⚠ 这是一台被植入后门的老旧服务器!', 'error');
      T.print('后门账户 root:toor 可能仍然有效 — 这是你本次侦察的突破口。', 'hint');
      T.print('本次任务 flag: flag{recon_agent}', 'success');
      Sound.ok();
      completeObjective('banner');
    } else {
      T.print(`无法从 ${ip}:${port} 获取 banner。`, 'error');
      Sound.err();
    }
  };
  banner.usage = 'banner <IP> <端口> — 获取服务指纹';

  Game.levels.push({
    id: 1,
    name: '网络侦察',
    flag: 'flag{recon_agent}',
    winAch: 'recon_pro',
    prompt: 'agent@recon:~$',
    brief: '敌方内网 10.0.1.0/24 中藏着一台被植入后门的服务器。\n你的任务: 完成网络扫描，定位可疑主机，并提取后门服务指纹。',
    answers: {},
    fs: {
      'note.txt': '内网情报:\n\n网络: 10.0.1.0/24\n已知主机: 10.0.1.5 (WEB), 10.0.1.21 (打印机)\n\n传闻: 有人在这台内网里藏了一台"隐身"服务器，跑着一个奇怪的端口。\n',
    },
    commands: { scan, banner },
    hints: [
      '侦察分三步: 全网络扫描 → 单主机服务探测 → 抓 banner。',
      '先扫描整个网段找可疑主机，再对可疑主机做服务探测，最后抓服务指纹。',
      '依次执行: scan 10.0.1.0/24 → scan -sV 10.0.1.13 → banner 10.0.1.13 1337 → 提交找到的 flag。',
    ],
    scenarios: [
      {
        id: 's1', title: '档案服务器深挖', xpBonus: 100, flag: 'flag{deep_recon}',
        brief: '情报: 内网还有一台"档案服务器" 10.0.1.99，跑着不寻常的服务。\n用同样的侦察手段把它挖出来: 扫描它、抓它的 banner，确认它是什么。',
        fs: { 'note2.txt': '传闻 10.0.1.99 是档案服务器, 但它的端口和服务都"不太对劲"。\n试试对 10.0.1.99 单独探测, 并抓取它的 banner。\n' },
        commands: {
          scan: async (toks) => {
            const net = toks[1] || '';
            if (net !== '10.0.1.99') { T.print('用法: scan 10.0.1.99 (对档案服务器单独扫描)', 'error'); return; }
            T.print('正在对 10.0.1.99 进行全端口服务探测...', 'info');
            await sleep(800);
            T.print('端口状态:', 'info');
            T.print('  5432/tcp   open   unknown   ← 非标准端口!', 'cmd');
            T.print('  4444/tcp   open   unknown', 'cmd');
            T.print('使用 banner 10.0.1.99 5432 查看服务指纹。', 'dim');
            completeObjective('s1_scan');
          },
          banner: async (toks) => {
            const ip = toks[1] || ''; const port = toks[2] || '';
            if (ip === '10.0.1.99' && port === '5432') {
              T.print('正在获取 10.0.1.99:5432 服务指纹...', 'info');
              await sleep(500);
              T.print('banner: "ArchiveDB 3.1 — 档案数据库 (内置后门端口 4444)"', 'cmd');
              T.print('⚠ 这台"档案服务器"果然有猫腻!', 'error');
              T.print('本次扩展场景 flag: flag{deep_recon}', 'success');
              Sound.ok();
              completeObjective('s1_banner');
            } else {
              T.print(`无法从 ${ip}:${port} 获取 banner。`, 'error');
            }
          },
        },
        objectives: [
          { id: 's1_scan', desc: '扫描档案服务器，发现异常服务', xp: 60 },
          { id: 's1_banner', desc: '抓取档案数据库的服务指纹', xp: 60 },
          { id: 'flag', desc: '提交扩展场景 flag', xp: 100 },
        ],
        hints: [
          '情报说档案服务器是 10.0.1.99。',
          '对它单独扫描 (scan 10.0.1.99)，再用 banner 命令抓 5432 端口的指纹。',
          '执行: scan 10.0.1.99 → banner 10.0.1.99 5432 → 提交 flag{deep_recon}。',
        ],
      },
    ],
    learn: [
      { t: '端口扫描原理', b: '每台主机上有 65535 个端口，服务在端口上"监听"。扫描器向端口发探测包，根据回应判断端口开/关，从而推断运行的服务。' },
      { t: '常见端口与服务', b: '22/ssh 远程登录, 80/http Web, 443/https, 3306/mysql, 3389/rdp。出现"陌生端口"往往是后门或非标准服务。' },
      { t: 'Banner 抓取', b: '连接服务时，许多服务会主动自我介绍 (banner)，例如 "OpenSSH 6.6.1p1"。banner 能暴露软件版本，进而搜索已知漏洞。' },
      { t: '隐蔽主机', b: '攻击者常把后门端口开在不常见端口上，并用防火墙隐藏主机，试图逃避扫描。但细心的人总能发现异常。' },
    ],
    objectives: [
      { id: 'scan', desc: '完成对整个内网的快速侦察', xp: 50 },
      { id: 'scanv', desc: '对可疑主机做深入探测，找出异常服务', xp: 60 },
      { id: 'banner', desc: '获取后门服务的指纹，确认入侵突破口', xp: 60 },
      { id: 'flag', desc: '提交本关 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【任务简报 — 网络侦察】',
        '情报部获得线索: 敌人网络中存在一台被植入后门的服务器。',
        '你的任务: 在不惊动对方的情况下，摸清这台机器。',
        '记住: 侦察是所有攻击的开始，也是最安全的一步。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 1 (网络与侦察)。', 'dim');
      t.print('提示: 先 cat note.txt 看看已知情报。', 'dim');
    },
  });
})();
