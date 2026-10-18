'use strict';
/* 关卡 8 — 恶意文件分析 */
(function () {
  const SAMPLE = [];
  SAMPLE.push(0x4d, 0x5a); // PE 魔数 (伪装 Windows 可执行文件)
  for (let i = 0; i < 96; i++) SAMPLE.push((i * 29 + 7) % 256);
  SAMPLE.push(...strToBytes('http://malware-c2.example/beacon\n'));
  SAMPLE.push(...strToBytes('CreateRemoteThread\n'));
  SAMPLE.push(...strToBytes('WriteProcessMemory\n'));
  SAMPLE.push(...strToBytes('VirtualAllocEx\n'));
  SAMPLE.push(...strToBytes('hidden_payload=' + b64e('flag{malware_analyst}') + '\n'));

  Game.levels.push({
    id: 8,
    name: '恶意文件分析',
    flag: 'flag{malware_analyst}',
    winAch: 'malware_hunter',
    prompt: 'analyst@malwarelab:~$',
    brief: '邮箱附件中发现可疑文件 sample.bin。\n静态分析它: 识别类型 → 提取特征 → 解码隐藏载荷。',
    answers: {},
    fs: {
      'README.txt': '安全团队拦截到一个可疑附件 sample.bin。\n\n静态分析三步: file 识别类型 → strings 提取特征 → 解码可疑数据。\n分析时不要运行它! (动态分析需要沙箱)\n',
      'sample.bin': { bytes: SAMPLE },
    },
    onFileDetect() { completeObjective('file'); },
    onStrings(runs) {
      const s = runs.join(' ');
      if (s.includes('CreateRemoteThread')) completeObjective('strs');
      if (s.includes('hidden_payload')) completeObjective('payload');
    },
    hints: [
      '恶意软件分析三板斧: file 识别 → strings 捞特征 → 解码可疑数据。',
      '先 file sample.bin 看类型，再 strings sample.bin 找 API 调用和 URL，最后找 hidden_payload 并 b64 -d。',
      '依次执行: file sample.bin → strings sample.bin → 对 hidden_payload 内容 b64 -d → 提交 flag。',
    ],
    learn: [
      { t: '恶意软件类型', b: '病毒(感染文件)/蠕虫(自我复制传播)/木马(伪装正常)/勒索软件(加密勒索)/挖矿木马/间谍软件。附件里来的多半是木马或下载器。' },
      { t: '静态 vs 动态分析', b: '静态分析: 不运行程序, 用 file/strings/hexdump/反汇编看"长相"。动态分析: 在沙箱里运行, 观察它的行为 (网络连接/文件操作/进程)。永远不要在真机上运行未知样本!。' },
      { t: '进程注入 API', b: 'CreateRemoteThread + WriteProcessMemory + VirtualAllocEx 是经典"进程注入"组合: 在别的进程里分配内存、写入恶意代码、创建远程线程执行 —— 用来躲避杀软和隐藏行为。' },
      { t: 'C2 与载荷隐藏', b: '恶意软件通过 C2 (命令控制) 服务器收指令。载荷常用 Base64/异或加密隐藏, 特征: = 结尾、字母数字混合、长度 4 的倍数。' },
      { t: '静态分析的价值', b: '静态分析不需要执行就能拿到: 文件类型、硬编码的 URL/密钥、可疑 API 列表。这是恶意软件分析的"第一步"，也往往能直接出结论。' },
    ],
    objectives: [
      { id: 'file', desc: '识别样本的文件类型', xp: 50 },
      { id: 'strs', desc: '提取样本特征: C2 地址与可疑 API', xp: 70 },
      { id: 'payload', desc: '找到并解码隐藏的载荷', xp: 70 },
      { id: 'flag', desc: '提交本关 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【恶意文件分析】',
        '一封"简历"邮件里夹着一个附件 sample.bin，',
        '安全团队已经把它拦截下来 —— 现在轮到你分析了。',
        '记住: 静态分析，不要运行它。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 10 (恶意软件分析)，示例教学: demo malware。', 'dim');
      t.print('提示: 先读 README.txt 了解分析流程。', 'dim');
    },
  });
})();
