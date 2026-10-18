'use strict';
/* 关卡 2 — 密码破译 */
(function () {
  Game.levels.push({
    id: 2,
    name: '密码破译',
    flag: 'flag{crypto_broken}',
    winAch: 'codebreaker',
    prompt: 'agent@crypto:~$',
    brief: '情报部门截获了两份加密通信。\n使用内置工具箱破译它们: 找出 flag 和敌方管理员的密码。',
    answers: { 'sunshine123': 'answer' },
    fs: {
      'note.txt': '截获的情报:\n\n  1. intercept.b64 — 敌方指挥部的第一条通信\n  2. email.enc     — 敌方管理员的加密邮件\n\n提示: 编码 ≠ 加密。先用 tools 看看工具箱里有什么。\n',
      'intercept.b64': b64e(rot13('flag{crypto_broken}')),
      'email.enc': vigenere('admin_password=sunshine123', 'sun', false),
    },
    onTool(tool, out) {
      if (tool === 'b64') completeObjective('b64');
      if (tool === 'rot13' && out.includes('flag{')) completeObjective('rot');
      if (tool === 'vig' && out.includes('admin_password')) completeObjective('email');
    },
    onCatFile(name) { if (name === 'note.txt') completeObjective('note'); },
    hints: [
      '先用 tools 看看工具箱里有什么，再读 note.txt 了解两份截获文件。',
      '第一份是 Base64 编码，解完再看是不是字母移位；第二份用维吉尼亚密码，密钥 sun。',
      '依次执行: b64 -d intercept.b64 → rot13 <上一步结果> → vig -d -k sun email.enc → 提交解出的密码和 flag。',
    ],
    scenarios: [
      {
        id: 's1', title: 'XOR 密文', xpBonus: 100, flag: 'flag{xor_broken}',
        brief: '截获第三份文件 xor.enc —— 这次是 XOR 加密，密钥是一个小写字母。\nXOR 加密和解密是同一个操作，用 xor -k <字母> 逐个试 (a-z)。',
        fs: { 'xor.enc': xorStr('flag{xor_broken}', 'q') },
        onTool(tool, out) {
          if (tool === 'xor' && out.includes('flag{')) completeObjective('s1_xor');
        },
        onCatFile(name) { if (name === 'xor.enc') completeObjective('s1_read'); },
        objectives: [
          { id: 's1_read', desc: '查看截获的 XOR 密文文件', xp: 40 },
          { id: 's1_xor', desc: '用 xor 命令暴力尝试密钥，解出 flag', xp: 70 },
          { id: 'flag', desc: '提交扩展场景 flag', xp: 100 },
        ],
        hints: [
          'xor.enc 在文件系统里 (ls / cat)。',
          'xor -k <字母> <密文> 逐个试 a-z，出现可读英文就是对了。',
          '执行: ls → cat xor.enc → xor -k q <密文> → 提交 flag{xor_broken}。',
        ],
      },
    ],
    learn: [
      { t: '编码 ≠ 加密', b: 'Base64、十六进制只是"编码"，可逆且无需密钥，任何懂行的人都能还原。加密则需要密钥。把编码当加密是新手最常见的错误。' },
      { t: 'Base64', b: '把二进制/文本用 64 个字符表示，常用于传输。特征是结尾可能有 = 或 ==。解码: b64 -d。' },
      { t: '凯撒密码与 ROT13', b: '凯撒密码: 每个字母按固定位数平移。ROT13 就是平移 13 位，因为 26 个字母，加密两次即还原。' },
      { t: '维吉尼亚密码', b: '古典多表密码: 每个字母用不同的凯撒位移，位移由密钥循环决定。破解需要知道密钥长度或使用频率分析。' },
      { t: '哈希与弱密码', b: 'MD5/SHA 是单向哈希，不可逆。但弱密码 (如 sunshine123) 会被"字典攻击"轻松破解 — 这就是下一关你会用到的技巧。' },
    ],
    objectives: [
      { id: 'note', desc: '阅读截获的情报说明', xp: 40 },
      { id: 'b64', desc: '解开第一层编码，读懂截获的通信', xp: 50 },
      { id: 'rot', desc: '继续破解，直到看到 flag 出现', xp: 60 },
      { id: 'email', desc: '破译敌方管理员的加密邮件', xp: 60 },
      { id: 'answer', desc: '把破译出的管理员密码提交给总部', xp: 60 },
      { id: 'flag', desc: '提交本关 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【任务简报 — 密码破译】',
        '情报部门截获了敌方两条加密通信。',
        '密码学是安全的基石，也是攻击者的第一道门。',
        '打开工具箱看看你有哪些武器: tools',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 2 (密码学基础)。', 'dim');
      t.print('提示: 先 cat note.txt 了解两份文件是什么。', 'dim');
    },
  });
})();
