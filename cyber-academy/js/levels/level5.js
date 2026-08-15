'use strict';
/* 关卡 5 — 数字取证 */
(function () {
  // 构造 U 盘镜像: 文件头 + 随机数据 + 内嵌 JPEG + 删除痕迹 + 隐藏数据
  const dd = [];
  dd.push(...strToBytes('DOS DISK IMAGE — v1.0 (从嫌疑人 U 盘复制)\n'));
  for (let i = 0; i < 260; i++) dd.push((i * 37 + 11) % 256);
  dd.push(0xff, 0xd8, 0xff, 0xe0); // JPEG SOI
  for (let i = 0; i < 120; i++) dd.push((i * 53 + 7) % 256);
  dd.push(0xff, 0xd9); // JPEG EOI
  dd.push(...strToBytes('\n[已删除文件 secret.png] 数据块残留\n'));
  dd.push(...strToBytes('wifi_password=BlueWhale42\n'));
  dd.push(...strToBytes('hidden_flag_data=' + b64e('flag{usb_evidence_recovered}') + '\n'));
  for (let i = 0; i < 96; i++) dd.push(0);

  Game.levels.push({
    id: 5,
    name: '数字取证',
    flag: 'flag{usb_evidence_recovered}',
    winAch: 'forensic_master',
    prompt: 'forensic@lab:~$',
    brief: '嫌疑人 U 盘的镜像 usb.dd 已被扣押。\n你的任务: 从中恢复"被删除"文件的痕迹和隐藏数据。',
    answers: {},
    fs: {
      'readme.txt': '任务: 分析 usb.dd (U 盘镜像)。\n\n分析手段:\n  ls        列出文件\n  file      识别文件类型\n  strings   提取可读字符串\n  tail      查看文件末尾\n  hexdump   查看十六进制\n\n文件可能被"删除"了，但痕迹往往还在。\n',
      'usb.dd': { bytes: dd },
    },
    onFileDetect() { completeObjective('detect'); },
    onCatFile(name) { if (name === 'readme.txt') completeObjective('readme'); },
    onStrings(runs) {
      if (runs.some((r) => r.includes('secret.png'))) completeObjective('deleted');
      if (runs.some((r) => r.includes('hidden_flag_data'))) completeObjective('hidden');
    },
    onTail(slice) {
      if (bytesToStr(slice).includes('hidden_flag_data')) completeObjective('hidden');
    },
    hints: [
      '取证三板斧: file 识别类型、strings 捞字符串、tail 看尾部。',
      '先识别镜像类型和内嵌文件，再用 strings 找"已删除文件"和隐藏数据，最后把那段 base64 解码。',
      '依次执行: file usb.dd → strings usb.dd → 对 hidden_flag_data 后面的内容执行 b64 -d → 提交 flag。',
    ],
    scenarios: [
      {
        id: 's1', title: 'GPS 情报', xpBonus: 100, flag: 'flag{geo_intel}',
        brief: '嫌疑人的手机镜像 phone.dd 也拿到了。取证人员怀疑照片的元数据 (EXIF/GPS) 泄露了位置。\n在镜像里找 GPS 坐标，向总部报告。',
        fs: { 'phone.dd': { bytes: (function () {
          const b = [];
          for (let i = 0; i < 200; i++) b.push((i * 43 + 17) % 256);
          b.push(...strToBytes('\n[照片] IMG_2049.jpg\nEXIF GPSLatitude: 31.2304, GPSLongitude: 121.4737\n拍摄时间: 2025-01-11 14:32\n'));
          return b;
        })() } },
        answers: { '31.2304,121.4737': 's1_gps' },
        onStrings(runs) {
          if (runs.join(' ').includes('GPS')) completeObjective('s1_strings');
        },
        objectives: [
          { id: 's1_strings', desc: '从手机镜像中提取字符串，发现 GPS 痕迹', xp: 60 },
          { id: 's1_gps', desc: '把坐标提交给总部 (格式: 纬度,经度)', xp: 70 },
          { id: 'flag', desc: '提交扩展场景 flag', xp: 100 },
        ],
        hints: [
          'phone.dd 在文件系统里。',
          'strings phone.dd 找 GPS/EXIF 相关字段。',
          '执行: strings phone.dd → 提交 31.2304,121.4737 → 提交 flag{geo_intel}。',
        ],
      },
    ],
    learn: [
      { t: '文件签名 (魔数)', b: '每种文件开头都有固定的"魔数": JPEG 是 FF D8 FF，PNG 是 89 50 4E 47，ELF 是 7F 45 4C 46。file 命令就是靠它识别类型，取证时也能用它"雕刻"出被删除的文件。' },
      { t: '删除 ≠ 消失', b: '删除文件往往只是标记空间可复用，数据仍在磁盘上。strings 可以直接从镜像中抠出可读字符串 — 密码、聊天记录都可能这样泄露。' },
      { t: '隐写术 (Steganography)', b: '把秘密藏进看似正常的载体 (图片、音频) 里。base64 明文放在文件尾部、藏在图片 EOF 之后，都是常见手法。' },
      { t: '取证原则', b: '真实取证必须对原始介质做只读镜像 (如 usb.dd)，所有分析在副本上进行，保证证据完整性 (哈希校验)。' },
    ],
    objectives: [
      { id: 'readme', desc: '阅读取证任务说明', xp: 40 },
      { id: 'detect', desc: '识别镜像类型，发现其中内嵌的文件', xp: 50 },
      { id: 'deleted', desc: '找到"已删除文件"的痕迹', xp: 50 },
      { id: 'hidden', desc: '挖掘镜像中的隐藏数据', xp: 60 },
      { id: 'flag', desc: '解码并提交 flag', xp: 100 },
    ],
    async intro(t) {
      t.setPrompt(this.prompt);
      await t.typeLines([
        '【任务简报 — 数字取证】',
        '嫌疑人 U 盘的镜像已经扣押，就在当前目录。',
        '你的任务: 像真正的取证专家一样，把证据挖出来。',
        '记住: 数据一旦写入磁盘，就很难真正消失。',
      ], 'normal', 12);
      t.newline();
      t.print('原理讲解: course 5 (数字取证)；靶场: lab get usb.dd 拉真实镜像。', 'dim');
      t.print('提示: 先 cat readme.txt 看看分析手段。', 'dim');
    },
  });
})();
