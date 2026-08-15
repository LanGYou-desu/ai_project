'use strict';
/* =========================================================
 * 赛博安全学院 — 工具箱命令
 * ========================================================= */

const TOOL_USAGES = [
  'b64 -d|-e <数据或文件>         Base64 解码 / 编码',
  'rot13 <数据或文件>             ROT13 移位 (凯撒 13)',
  'caesar -s <位移> <数据>       凯撒密码 (负位移为解密)',
  'vig -e|-d -k <密钥> <数据>     维吉尼亚密码 (密钥须含字母)',
  'xor -k <密钥> <数据>           异或加密/解密 (同一操作)',
  'md5 <数据或文件>               计算 MD5 哈希',
  'sha256 <数据或文件>            计算 SHA-256 哈希',
  'crack <32或64位哈希>          字典爆破 MD5 / SHA-256',
];

/* ---------- 工具实操手册 (tools <命令> 查看) ---------- */
const TOOL_MANUAL = {
  'ls': {
    usage: 'ls',
    detail: '列出当前目录的所有文件，显示大小和类型 (text=文本, binary=二进制)。',
    example: '> ls\n>     123  ·  README.txt   (text)',
    out: '看到 README.txt、welcome.txt 等文件。用 cat 查看它们。',
  },
  'cat': {
    usage: 'cat <文件>',
    detail: '查看文本文件内容。如果文件是二进制，会提示并用 . 替换不可打印字符。',
    example: '> cat README.txt\n> 欢迎来到赛博安全学院!',
    out: '文件内容逐行显示。二进制文件建议改用 file / strings / hexdump。',
  },
  'file': {
    usage: 'file <文件>',
    detail: '识别文件类型 — 靠的是文件头"魔数" (如 ELF=7F 45 4C 46, JPEG=FF D8 FF)。还会扫描镜像内嵌的签名。',
    example: '> file usb.dd\n> usb.dd: 数据文件 (663 字节)\n>   镜像内签名扫描:\n>     └─ JPEG 图像 @ 0x114',
    out: '告诉你文件的真实类型。取证/逆向的第一步。',
  },
  'strings': {
    usage: 'strings <文件>',
    detail: '提取二进制中所有连续可读的字符串。密码、邮箱、URL 常常直接裸露。',
    example: '> strings usb.dd\n> wifi_password=BlueWhale42\n> hidden_flag_data=ZmxhZ3...',
    out: '可读字符串列表 — 先扫一遍往往就有收获。',
  },
  'tail': {
    usage: 'tail <文件> [字节数]',
    detail: '查看文件末尾的 N 字节 (默认 128)。文件尾部常被追加隐藏数据。',
    example: '> tail usb.dd 80',
    out: '最后 80 字节的可读内容。',
  },
  'hexdump': {
    usage: 'hexdump <文件> [起始偏移(16进制)]',
    detail: '以十六进制 + ASCII 双栏显示原始字节。最底层的分析手段。',
    example: '> hexdump usb.dd 0x100\n> 00000100  FF D8 FF E0 ...  |....|',
    out: '左边是字节的十六进制，右边 |...| 是 ASCII 解读。',
  },
  'b64': {
    usage: 'b64 -d|-e <数据或文件>',
    detail: 'Base64 解码 (-d) 或编码 (-e)。特征: 结果常以 = 结尾。参数可以是文件。',
    example: '> b64 -d aGVsbG8=\n> hello',
    out: '解码出原始文本。看到 = 结尾的字符串，先试它。',
  },
  'rot13': {
    usage: 'rot13 <数据或文件>',
    detail: '字母平移 13 位。因为 26 个字母，加密两次 = 还原。凯撒密码的特例。',
    example: '> rot13 syny\n> flag',
    out: '平移后的文本。ROT13 两次还原: rot13 (rot13 x) = x。',
  },
  'caesar': {
    usage: 'caesar -s <位移> <数据>',
    detail: '凯撒密码: 每个字母按位移平移。负数=解密。',
    example: '> caesar -s 3 HELLO\n> KHOOR\n> caesar -s -3 KHOOR\n> HELLO',
    out: '按指定位移平移后的文本。暴力试 26 种位移总能出英文。',
  },
  'vig': {
    usage: 'vig -e|-d -k <密钥> <数据>',
    detail: '维吉尼亚密码: 密钥循环决定每个字母的位移。-e 加密, -d 解密。密钥必须含字母。',
    example: '> vig -d -k sun <密文>',
    out: '解密后的明文。密钥是弱口令时可直接猜测。',
  },
  'xor': {
    usage: 'xor -k <密钥> <数据>',
    detail: '异或运算。同一个操作既是加密也是解密 (xor xor = 原文)。',
    example: '> xor -k k abc\n> (密文)\n> xor -k k <密文>\n> abc',
    out: '异或后的文本。单字节密钥只有 256 种，可暴力尝试。',
  },
  'md5': {
    usage: 'md5 <数据或文件>',
    detail: '计算 MD5 哈希 (32 位十六进制)。单向不可逆，但弱密码可被字典爆破。',
    example: '> md5 password\n> 5f4dcc3b5aa765d61d8327deb882cf99',
    out: '32 位十六进制哈希。配合 crack 命令使用。',
  },
  'sha256': {
    usage: 'sha256 <数据或文件>',
    detail: '计算 SHA-256 哈希 (64 位十六进制)。比 MD5 更安全，但弱密码照样可破。',
    example: '> sha256 abc\n> ba7816bf8f01cfea...',
    out: '64 位十六进制哈希。crack 命令也支持 64 位。',
  },
  'crack': {
    usage: 'crack <32或64位哈希>',
    detail: '字典爆破哈希: 自动识别 MD5 (32位) / SHA-256 (64位)，用内置弱密码字典逐个尝试。',
    example: '> crack 5f4dcc3b5aa765d61d8327deb882cf99\n> 破解成功: ... → password',
    out: '如果密码在字典里，直接给出明文。加盐/复杂密码无法爆破。',
  },
};

GLOBAL_COMMANDS['tools'] = (toks) => {
  const name = (toks[1] || '').toLowerCase();
  if (name) {
    const m = TOOL_MANUAL[name];
    if (!m) { T.print(`没有找到命令 ${name} 的手册。输入 tools 查看全部。`, 'error'); return; }
    T.print(`═══ tools 手册: ${name} ═══`, 'header');
    T.print('用法: ' + m.usage, 'cmd');
    T.print('说明: ' + m.detail, 'normal');
    T.print('示例:', 'info');
    m.example.split('\n').forEach((l) => T.print('  ' + l, 'cmd'));
    T.print('输出: ' + m.out, 'dim');
    return;
  }
  T.print('═══ 工具箱 ═══', 'header');
  TOOL_USAGES.forEach((u) => T.print('  ' + u, 'cmd'));
  T.print('输入 tools <命令> 查看详细手册 (用法/示例/输出)。', 'dim');
  T.print('工具参数可以是文字，也可以是当前目录中的文件名。', 'dim');
};

/* 若参数是虚拟文件系统中的文件，返回其文本内容 */
function toolArg(s) {
  const fs = mergedFs();
  if (s && s in fs) return bytesToStr(toBytes(fs[s]));
  return s;
}

function toolHook(tool, out) {
  callHook('onTool', tool, out);
}

GLOBAL_COMMANDS['b64'] = (toks) => {
  const mode = toks[1];
  const data = toolArg(toks.slice(2).join(' '));
  if (!data) { T.print('用法: b64 -d|-e <数据或文件>', 'info'); return; }
  if (mode === '-d') {
    const r = b64d(data);
    if (r === null) { T.print('Base64 解码失败。', 'error'); return; }
    T.print(r, 'cmd');
    toolHook('b64', r);
  } else if (mode === '-e') {
    const r = b64e(data);
    T.print(r, 'cmd');
    toolHook('b64', r);
  } else {
    T.print('用法: b64 -d|-e <数据或文件>', 'info');
  }
};

GLOBAL_COMMANDS['rot13'] = (toks) => {
  const data = toolArg(toks.slice(1).join(' '));
  if (!data) { T.print('用法: rot13 <数据或文件>', 'info'); return; }
  const r = caesar(data, 13);
  T.print(r, 'cmd');
  toolHook('rot13', r);
};

GLOBAL_COMMANDS['caesar'] = (toks) => {
  let shift = 0; const rest = [];
  for (let i = 1; i < toks.length; i++) {
    if (toks[i] === '-s') shift = parseInt(toks[++i], 10) || 0;
    else rest.push(toks[i]);
  }
  if (!rest.length) { T.print('用法: caesar -s <位移> <数据>', 'info'); return; }
  const r = caesar(toolArg(rest.join(' ')), shift);
  T.print(r, 'cmd');
  toolHook('caesar', r);
};

GLOBAL_COMMANDS['vig'] = (toks) => {
  let mode = '-e'; let key = ''; const rest = [];
  for (let i = 1; i < toks.length; i++) {
    if (toks[i] === '-e' || toks[i] === '-d') mode = toks[i];
    else if (toks[i] === '-k') key = toks[++i] || '';
    else rest.push(toks[i]);
  }
  if (!key || !rest.length) { T.print('用法: vig -e|-d -k <密钥> <数据>', 'info'); return; }
  const r = vigenere(toolArg(rest.join(' ')), key, mode === '-d');
  if (r === null) { T.print('密钥必须包含字母。', 'error'); return; }
  T.print(r, 'cmd');
  toolHook('vig', r);
};

GLOBAL_COMMANDS['xor'] = (toks) => {
  let key = ''; const rest = [];
  for (let i = 1; i < toks.length; i++) {
    if (toks[i] === '-k') key = toks[++i] || '';
    else rest.push(toks[i]);
  }
  if (!key || !rest.length) { T.print('用法: xor -k <密钥> <数据>', 'info'); return; }
  const r = xorStr(toolArg(rest.join(' ')), key);
  if (r === null) { T.print('需要密钥。', 'error'); return; }
  T.print(r, 'cmd');
  toolHook('xor', r);
};

GLOBAL_COMMANDS['md5'] = (toks) => {
  const data = toolArg(toks.slice(1).join(' '));
  if (!data) { T.print('用法: md5 <数据或文件>', 'info'); return; }
  T.print(md5(data), 'cmd');
};

GLOBAL_COMMANDS['sha256'] = async (toks) => {
  const data = toolArg(toks.slice(1).join(' '));
  if (!data) { T.print('用法: sha256 <数据或文件>', 'info'); return; }
  try {
    T.print(await sha256Hex(data), 'cmd');
  } catch (e) {
    T.print('SHA-256 计算失败 (需要安全上下文 https 或 file://)。', 'error');
  }
};

GLOBAL_COMMANDS['crack'] = async (toks) => {
  const h = (toks[1] || '').toLowerCase();
  const isMd5 = /^[0-9a-f]{32}$/.test(h);
  const isSha = /^[0-9a-f]{64}$/.test(h);
  if (!isMd5 && !isSha) { T.print('用法: crack <32位md5或64位sha256哈希>', 'info'); return; }
  T.print(`正在字典爆破 (${isMd5 ? 'MD5' : 'SHA-256'}, 内置 rockyou 精简版)...`, 'info');
  await sleep(450);
  let found = null;
  for (const wd of WORDLIST) {
    const d = isMd5 ? md5(wd) : await sha256Hex(wd);
    if (d === h) { found = wd; break; }
  }
  if (found) {
    T.print(`✔ 破解成功: ${h} → ${found}`, 'success');
    Sound.good();
    award(80, '密码破解');
    unlockAchievement('password_lover');
    callHook('onCrackOk', h, found);
  } else {
    T.print('✘ 字典中未命中。强密码或加盐哈希无法用简单字典爆破。', 'error');
    Sound.err();
  }
};
