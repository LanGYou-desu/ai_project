'use strict';
/* 关卡 0 — 新兵训练营 */
(function () {
  const scan = async (toks) => {
    const net = toks[1] || '';
    if (net !== '10.0.0.0/24') { T.print('用法: scan 10.0.0.0/24', 'error'); return; }
    T.print('正在扫描 10.0.0.0/24 ...', 'info');
    await sleep(700);
    T.print('发现 2 台活跃主机:', 'info');
    T.print('  10.0.0.1    (网关路由器)', 'dim');
    T.print('  10.0.0.5    (训练服务器, 开放端口: 22, 8080)', 'cmd');
    completeObjective('scan');
  };
  scan.usage = 'scan <网段> — 扫描网络主机';

  const connect = async (toks) => {
    const ip = toks[1] || '';
    if (ip !== '10.0.0.5') {
      T.print(`无法连接到 ${ip}: 目标无响应`, 'error');
      Sound.err();
      return;
    }
    T.print('正在连接 10.0.0.5:8080 ...', 'info');
    await sleep(600);
    T.print('✔ 连接成功! 服务器欢迎语: 干得漂亮，新兵。', 'success');
    Sound.ok();
    T.print('服务器便签里夹着一张纸条: flag{training_done}', 'hint');
    completeObjective('connect');
  };
  connect.usage = 'connect <IP> — 连接目标服务器';

  Game.levels.push({
    id: 0,
    name: '新兵训练营',
    flag: 'flag{training_done}',
    winAch: 'graduate',
    prompt: 'recruit@training:~$',
    brief: '熟悉终端基本操作，学会查看文件、扫描网络并连接目标服务器。',
    answers: {},
    onCatFile(name) { if (name === 'README.txt') completeObjective('readme'); },
    fs: {
      'README.txt': '欢迎来到赛博安全学院!\n\n你的第一项训练:\n  ls        列出当前目录的文件\n  cat <文件> 查看文件内容\n  scan      扫描网络主机\n  connect    连接目标服务器\n\n任务: 扫描 10.0.0.0/24 网段，找到训练服务器并连接它。\n',
      'welcome.txt': '致新兵:\n\n终端就是你的武器。学会用它，你将能进入任何系统。\n记住学院守则: 只对授权目标使用这些技术。\n\n—— 院长\n',
    },
    commands: { scan, connect },
    hints: [
      '新兵手册 (README.txt) 里介绍了每个命令的用法，先读它。',
      '用 ls 看目录、用 cat 读文件；扫描要带上网段参数；connect 后面接服务器 IP。',
      '依次执行: ls → cat README.txt → scan 10.0.0.0/24 → connect 10.0.0.5 → 提交找到的 flag。',
    ],
    learn: [
      { t: '终端是什么?', b: '终端 (Terminal) 是与计算机交互的命令行界面。你敲入命令，系统执行并返回结果。黑客电影里的绿色界面就是它。' },
      { t: '什么是 flag?', b: 'flag 是 CTF 夺旗赛中的通关凭证，形如 flag{...}。找到 flag 后用 submit 命令提交，即可证明你完成了任务。' },
      { t: 'IP 地址与扫描', b: 'IP 地址是网络上每台主机的门牌号，形如 10.0.0.5。扫描 (scan) 就是挨家挨户敲门，看看哪些门开着、跑着什么服务。' },
    ],
    objectives: [
      { id: 'readme', desc: '在终端里找到并阅读新兵手册', xp: 40 },
      { id: 'scan', desc: '扫描本机网段，找出训练服务器', xp: 50 },
      { id: 'connect', desc: '连接训练服务器，找到服务器上的 flag', xp: 60 },
      { id: 'flag', desc: '提交本关 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【新兵训练营】',
        '欢迎来到赛博安全学院，特工 #0713。',
        '你是一名刚入职的白帽渗透测试员。',
        '今天的目标: 学会使用终端，找到训练服务器并完成连接。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 1 (网络与侦察)。', 'dim');
      t.print('提示: 先 cat README.txt 看看说明。', 'dim');
    },
  });
})();
