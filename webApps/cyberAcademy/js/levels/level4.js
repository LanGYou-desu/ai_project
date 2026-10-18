'use strict';
/* 关卡 4 — 逆向工程 */
(function () {
  // 构造一个假的 ELF 二进制
  const bin = [];
  bin.push(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00); // ELF magic
  for (let i = 0; i < 24; i++) bin.push(0);
  bin.push(...strToBytes('Enter password:\0ACCESS GRANTED\0ACCESS DENIED\0p4ssw0rd_is_weak\0'));
  while (bin.length <= 0x40) bin.push(0);
  bin[0x18] = 0x75; // 原始字节: jne 操作码

  const DISASM = [
    '0x0000  push   ebp',
    '0x0001  mov    ebp, esp',
    '0x0005  sub    esp, 0x10',
    '0x0008  mov    dword [ebp-0x8], 0x0',
    '0x000f  mov    eax, [ebp+0x8]      ; 用户输入 (字符串指针)',
    '0x0012  movzx  ecx, byte [eax]     ; 取输入第 1 个字符',
    '0x0015  cmp    ecx, 0x31           ; 与 \'1\' (0x31) 比较',
    '0x0018  jne    0x0040              ; 不相等 → 跳转到拒绝分支',
    '0x001a  movzx  ecx, byte [eax+1]   ; 取第 2 个字符',
    '0x001d  cmp    ecx, 0x33           ; 与 \'3\' (0x33) 比较',
    '0x0020  jne    0x0040',
    '0x0022  movzx  ecx, byte [eax+2]   ; 取第 3 个字符',
    '0x0025  cmp    ecx, 0x33           ; 与 \'3\' (0x33) 比较',
    '0x0028  jne    0x0040',
    '0x002a  movzx  ecx, byte [eax+3]   ; 取第 4 个字符',
    '0x002d  cmp    ecx, 0x37           ; 与 \'7\' (0x37) 比较',
    '0x0030  jne    0x0040',
    '0x0032  mov    eax, 1              ; 通过分支: 返回 1',
    '0x0037  jmp    0x0041',
    '0x0040  mov    eax, 0              ; 拒绝分支: 返回 0',
    '0x0041  leave',
    '0x0042  ret',
  ];

  const disasm = (toks) => {
    const fname = toks[1] || '';
    if (fname !== 'crackme.bin') { T.print('用法: disasm crackme.bin', 'error'); return; }
    T.print('── crackme.bin 反汇编 (x86, 关键部分) ──', 'header');
    DISASM.forEach((l) => T.print('  ' + l, 'cmd'));
    T.print('思考: 程序在比较什么? 不相等时跳到哪里?', 'hint');
    completeObjective('disasm');
  };
  disasm.usage = 'disasm crackme.bin — 查看反汇编';

  const analyze = (toks) => {
    T.print('分析结果:', 'info');
    T.print('  程序逐个取出输入的前 4 个字符，与 0x31,\'1\' 0x33,\'3\' 0x33,\'3\' 0x37,\'7\' 比较。', 'cmd');
    T.print('  全部相等则返回 1 (ACCESS GRANTED)，否则跳到 0x0040 返回 0。', 'cmd');
    T.print('  因此正确密码是: 1337', 'hint');
    T.print('  另外 0x0018 处的 jne 是"关键跳转"。把它改成 jmp (0xEB) 可以让任何输入都通过。', 'dim');
    completeObjective('analyze');
  };
  analyze.usage = 'analyze — 分析程序逻辑';

  const patch = (toks) => {
    const fname = toks[1] || '';
    const off = toks[2] || '';
    const val = toks[3] || '';
    if (fname !== 'crackme.bin') { T.print('用法: patch crackme.bin <16进制偏移> <16进制字节>', 'error'); return; }
    const o = parseInt(off, 16);
    const v = parseInt(val, 16);
    if (isNaN(o) || isNaN(v) || o < 0 || o >= bin.length || v < 0 || v > 0xff) {
      T.print('参数无效。偏移和字节应为 16 进制数。', 'error');
      return;
    }
    bin[o] = v;
    T.print(`已写入: crackme.bin[0x${pad(o, 4)}] = 0x${hex(v)}`, 'info');
    T.print('提示: 0x75 是 jne (不相等跳转)，改成 0xEB (jmp 无条件跳转) 可跳过密码校验。', 'dim');
  };
  patch.usage = 'patch <文件> <偏移(16进制)> <字节(16进制)> — 修改程序';

  const run = async (toks) => {
    const fname = toks[1] || '';
    if (fname !== 'crackme.bin') { T.print('用法: run crackme.bin', 'error'); return; }
    T.print('运行 crackme.bin ...', 'info');
    await sleep(500);
    T.print('Enter password: ', 'cmd');
    const pass = await askLine('password: ');
    const patched = bin[0x18] === 0xeb;
    if (pass === '1337' || patched) {
      T.print('✔ ACCESS GRANTED!', 'success');
      Sound.good();
      if (patched) T.print('(检测到程序已被 patch — 校验被绕过，逆向修改成功!)', 'dim');
      else T.print('(你直接猜对了正确密码 — 但逆向修改才是黑客的浪漫)', 'dim');
      T.print('本关 flag: flag{patcher_king}', 'hint');
      completeObjective('run');
    } else {
      T.print('✘ ACCESS DENIED', 'error');
      Sound.err();
      T.print('要么读懂密码，要么想办法绕过校验。', 'dim');
    }
  };
  run.usage = 'run crackme.bin — 运行程序';

  Game.levels.push({
    id: 4,
    name: '逆向工程',
    flag: 'flag{patcher_king}',
    winAch: 'patcher_king',
    prompt: 'rev@lab:~$',
    brief: '你拿到了一个密码验证程序 crackme.bin。\n要么通过分析汇编找到正确密码，要么直接修改程序逻辑让它无条件放行。',
    answers: {},
    onCatFile(name) { if (name === 'readme.txt') completeObjective('readme'); },
    fs: {
      'readme.txt': 'crackme.bin 是一个密码验证程序。\n\n分析手段:\n  disasm crackme.bin    查看反汇编\n  strings crackme.bin   提取字符串\n  analyze               分析程序逻辑\n  patch <文件> <偏移> <字节>  修改程序 (16 进制)\n  run crackme.bin       运行程序\n\n提示: 你既可以"读懂"它，也可以"修改"它。\n',
      'crackme.bin': { bytes: bin },
    },
    commands: { disasm, analyze, patch, run },
    hints: [
      '先读 readme.txt 看有哪些分析命令，再对 crackme.bin 下手。',
      '反汇编看校验逻辑 (程序在比较什么字符)，strings 找线索；要么猜对密码，要么把关键跳转改成无条件跳转。',
      '依次执行: disasm crackme.bin → analyze (或直接 patch crackme.bin 18 eb) → run crackme.bin 输入任意密码 → 提交找到的 flag。',
    ],
    scenarios: [
      {
        id: 's1', title: '第二道锁', xpBonus: 100, flag: 'flag{second_lock}',
        brief: '另一台设备上发现了 crackme2.bin —— 它把正确密码直接写在了二进制里。\n用 strings 把它挖出来，然后 run 验证。',
        fs: {
          'crackme2.bin': { bytes: (function () {
            const b = [];
            for (let i = 0; i < 48; i++) b.push((i * 17 + 9) % 256);
            b.push(...strToBytes('password_is_matrix\0ACCESS GRANTED\0ACCESS DENIED\0'));
            return b;
          })() },
          'readme2.txt': 'crackme2.bin 的校验逻辑比第一个还简单: 它把正确密码"明文"存在了文件里。\nstrings 一下你就知道了。\n',
        },
        commands: {
          run: async (toks) => {
            const fname = toks[1] || '';
            if (fname !== 'crackme2.bin') { T.print('用法: run crackme2.bin', 'error'); return; }
            T.print('运行 crackme2.bin ...', 'info');
            await sleep(400);
            T.print('Enter password: ', 'cmd');
            const pass = await askLine('password: ');
            if (pass === 'matrix') {
              T.print('✔ ACCESS GRANTED!', 'success');
              Sound.good();
              T.print('本次扩展场景 flag: flag{second_lock}', 'hint');
              completeObjective('s1_run');
            } else {
              T.print('✘ ACCESS DENIED', 'error');
              Sound.err();
              T.print('提示: 密码就藏在二进制里 (strings crackme2.bin)。', 'dim');
            }
          },
        },
        onStrings(runs) {
          if (runs.join(' ').includes('password_is_matrix')) completeObjective('s1_strings');
        },
        objectives: [
          { id: 's1_strings', desc: '用 strings 从二进制里挖出明文密码', xp: 60 },
          { id: 's1_run', desc: '运行 crackme2.bin 并通过验证', xp: 70 },
          { id: 'flag', desc: '提交扩展场景 flag', xp: 100 },
        ],
        hints: [
          '密码以明文形式存在 crackme2.bin 里。',
          'strings crackme2.bin 提取字符串。',
          '执行: strings crackme2.bin → run crackme2.bin 输入 matrix → 提交 flag{second_lock}。',
        ],
      },
    ],
    learn: [
      { t: '汇编与寄存器', b: '汇编是 CPU 能直接执行的指令。常见寄存器: eax/ebx/ecx/edx 存放数据，esp/ebp 管理栈。mov 传送数据，cmp 比较，jne/jmp 跳转。' },
      { t: '关键跳转 (关键比较)', b: '绝大多数校验程序都是"比较后跳转": 对了就通过，错了就拒绝。找到那个 jne (not equal jump)，就找到了程序的命门。' },
      { t: 'Patch 与二进制修改', b: 'patch 就是直接改写二进制字节。把 jne (0x75) 改成 jmp (0xEB)，条件跳转变成无条件跳转，校验形同虚设。这是绕过破解的经典手法。' },
      { t: 'strings 与魔数', b: 'strings 能提取二进制里的可读字符串，往往能直接看到密码提示。文件头魔数 (如 ELF 的 7F 45 4C 46) 用来识别文件类型。' },
    ],
    objectives: [
      { id: 'readme', desc: '阅读任务说明，了解可用的分析工具', xp: 40 },
      { id: 'disasm', desc: '反汇编验证程序，观察它的校验逻辑', xp: 50 },
      { id: 'analyze', desc: '总结程序的校验方式，找到绕过思路', xp: 50 },
      { id: 'run', desc: '成功通过程序的验证', xp: 70 },
      { id: 'flag', desc: '提交本关 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【任务简报 — 逆向工程】',
        '我们拿到了一个敌方使用的验证程序 crackme.bin。',
        '你的任务: 搞清楚它怎么工作，然后让它"开门"。',
        '逆向工程不是魔法，是耐心加逻辑。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 4 (逆向工程)；靶场: lab get crackme.bin 拉真实二进制。', 'dim');
      t.print('提示: 先 cat readme.txt 看看有哪些分析工具。', 'dim');
    },
  });
})();
