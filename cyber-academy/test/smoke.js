'use strict';
/* =========================================================
 * 冒烟测试: 校验密码学实现 + 全部关卡数据完整性
 * 用法: node test/smoke.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');

// ---- 浏览器环境桩 (仅用于安全加载脚本) ----
global.window = { addEventListener() {} };
global.document = {
  addEventListener() {},
  getElementById() { return null; },
  createElement() { return { style: {}, className: '', textContent: '', appendChild() {}, addEventListener() {} }; },
};

const files = [
  'js/crypto.js',
  'js/core.js',
  'js/tools.js',
  'js/course.js',
  'js/challenges.js',
  'js/demo.js',
  'js/docs.js',
  'js/lab.js',
  'js/levels/level0.js',
  'js/levels/level1.js',
  'js/levels/level2.js',
  'js/levels/level3.js',
  'js/levels/level4.js',
  'js/levels/level5.js',
  'js/levels/level6.js',
  'js/levels/level7.js',
  'js/levels/level8.js',
  'js/levels/level9.js',
  'js/main.js',
];

let code = '';
for (const f of files) {
  const p = path.join(__dirname, '..', f);
  code += '\n/* ===== ' + f + ' ===== */\n' + fs.readFileSync(p, 'utf8') + '\n';
}

code += `
;(function runTests() {
  'use strict';
  var R = [];
  function check(n, c) { R.push([n, !!c]); }
  var finish = function () {
    var pass = 0;
    R.forEach(function (r) { console.log((r[1] ? '  PASS  ' : '  FAIL  ') + r[0]); if (r[1]) pass++; });
    console.log('\\n' + pass + '/' + R.length + ' 项通过');
    if (pass !== R.length) process.exit(1);
  };

  // ---- 密码学 ----
  check('md5("") 向量', md5('') === 'd41d8cd98f00b204e9800998ecf8427e');
  check('md5("password") 向量', md5('password') === '5f4dcc3b5aa765d61d8327deb882cf99');
  check('md5("admin123") 向量', md5('admin123') === '0192023a7bbd73250516f069df18b500');
  check('md5("123456") 向量', md5('123456') === 'e10adc3949ba59abbe56e057f20f883e');
  check('base64 往返(含中文)', b64d(b64e('hello 世界 flag{x}')) === 'hello 世界 flag{x}');
  check('凯撒往返', caesar(caesar('AttackAtDawn', 7), -7) === 'AttackAtDawn');
  check('ROT13 两次还原', caesar(caesar('flag{secret}', 13), 13) === 'flag{secret}');
  check('维吉尼亚往返', vigenere(vigenere('admin_password=sunshine123', 'sun', false), 'sun', true) === 'admin_password=sunshine123');
  check('XOR 往返', xorStr(xorStr('top secret', 'k3y'), 'k3y') === 'top secret');
  check('字典含 password/admin123', WORDLIST.indexOf('password') !== -1 && WORDLIST.indexOf('admin123') !== -1);

  // ---- 关卡数据 ----
  check('共 10 关', Game.levels.length === 10);
  check('关卡按 id 排序', Game.levels.every(function (l, i) { return l.id === i; }));
  check('每关都有 flag', Game.levels.every(function (l) { return /^flag\\{[^}]+\\}$/.test(l.flag); }));
  check('每关都有目标', Game.levels.every(function (l) { return l.objectives.length >= 3; }));
  check('每关都有 intro', Game.levels.every(function (l) { return typeof l.intro === 'function'; }));
  check('每关都有 brief/3级hints/learn', Game.levels.every(function (l) {
    return l.brief && Array.isArray(l.hints) && l.hints.length === 3 && l.hints.every(function (h) { return typeof h === 'string' && h.length > 0; }) && l.learn && l.learn.length;
  }));
  var leaky = ['(submit ', '(cat ', '(scan ', '(login ', '(file ', '(strings', '(b64 ', '(vig ', '(crack ', '(ssh ', '(banner', '(disasm', '(patch ', '(run ', '(tail ', '(hexdump', '(search ', '(dump ', '(web)'];
  check('目标描述不剧透解法', Game.levels.every(function (l) {
    return l.objectives.every(function (o) {
      return leaky.every(function (f) { return o.desc.indexOf(f) === -1; });
    });
  }));
  // ---- 多任务场景系统 ----
  check('扩展场景存在', Game.levels.some(function (l) { return l.scenarios && l.scenarios.length >= 1; }));
  check('扩展场景结构合法', Game.levels.filter(function (l) { return l.scenarios; }).every(function (l) {
    return l.scenarios.every(function (s) {
      return s.id && s.title && s.brief && s.flag && s.objectives && s.objectives.length >= 2 && Array.isArray(s.hints) && s.hints.length === 3;
    });
  }));
  check('scenario 命令已注册', typeof GLOBAL_COMMANDS['scenario'] === 'function');
  check('FakeWeb 已定义', typeof FakeWeb === 'function');

  // ---- 课程系统 ----
  check('课程 13 门', COURSES.length === 13);
  check('每门课程有 5 章课本式内容', COURSES.every(function (c) { return c.chapters && c.chapters.length === 5 && c.chapters.every(function (ch) { return ch.t && Array.isArray(ch.lines) && ch.lines.length >= 10; }); }));
  check('每门课程有测验且答案合法', COURSES.every(function (c) {
    return c.quiz && c.quiz.length === 3 && c.quiz.every(function (q) {
      return q.options.length === 4 && q.answer >= 0 && q.answer < 4 && q.explain;
    });
  }));
  check('course/quiz 命令已注册', typeof GLOBAL_COMMANDS['course'] === 'function' && typeof GLOBAL_COMMANDS['quiz'] === 'function');

  // ---- 挑战系统 ----
  check('挑战 20 个', CHALLENGES.length === 20);
  check('挑战 id 连续且含标题/答案/讲解', CHALLENGES.every(function (c, i) {
    return c.id === i + 1 && c.title && c.answer && c.hint && c.explain && c.desc;
  }));
  check('挑战 9/10 需要靶场', CHALLENGES[8].needsLab === true && CHALLENGES[9].needsLab === true);
  check('挑战 19 OSINT / 20 WiFi', CHALLENGES[18].answer === 'admin-panel.vuln-bank.com' && CHALLENGES[19].answer === 'password123');
  check('challenge 命令已注册', typeof GLOBAL_COMMANDS['challenge'] === 'function');
  check('挑战15/17 提供 GUI', typeof CHALLENGES[14].gui === 'function' && typeof CHALLENGES[16].gui === 'function');
  check('ai 命令已注册', typeof GLOBAL_COMMANDS['ai'] === 'function');

  // ---- 评审新增功能 ----
  check('新命令已注册 (map/mistakes/board/export/guide)', ['map', 'mistakes', 'board', 'export', 'guide'].every(function (c) { return typeof GLOBAL_COMMANDS[c] === 'function'; }));
  check('测验答案分布打散 (非全A)', COURSES.every(function (c) { return c.quiz.some(function (q) { return q.answer !== 0; }); }));
  check('测验答案覆盖多个位置', COURSES.every(function (c) { return new Set(c.quiz.map(function (q) { return q.answer; })).size >= 2; }));
  check('help 检索索引完整', typeof HELP_INDEX === 'object' && HELP_INDEX.length >= 40);
  check('挑战 1 答案正确', md5('sunshine') !== md5('monkey') && CHALLENGES[0].answer === 'sunshine_monkey');
  check('挑战 2 编码链可还原', caesar(rot13(b64d(b64e(rot13(caesar('the_cake_is_a_lie', 7))))), -7) === 'the_cake_is_a_lie');
  check('挑战 3 XOR 可还原', xorStr(xorStr('never_reuse_keys', 'k'), 'k') === 'never_reuse_keys');

  // ---- 命令解析 / 等级边界 ----
  check('tokenize 引号参数', JSON.stringify(tokenize('cat "my file.txt"')) === JSON.stringify(['cat', 'my file.txt']));
  check('tokenize 转义引号', JSON.stringify(tokenize('echo "a\\\\"b"')) === JSON.stringify(['echo', 'a"b']));
  check('tokenize 未闭合引号容错', JSON.stringify(tokenize('"unclosed')) === JSON.stringify(['unclosed']));
  check('tokenize 多空格', JSON.stringify(tokenize('scan   10.0.0.0/24  ')) === JSON.stringify(['scan', '10.0.0.0/24']));
  check('rankOf 边界', rankOf(0) === '见习特工' && rankOf(99) === '见习特工' && rankOf(100) === '初级渗透员' && rankOf(1400) === '赛博传奇');

  // ---- 工具手册 ----
  check('工具手册覆盖主要命令', Object.keys(TOOL_MANUAL).length >= 13);
  check('手册条目含用法/示例', Object.keys(TOOL_MANUAL).every(function (k) {
    const m = TOOL_MANUAL[k];
    return m.usage && m.detail && m.example && m.out;
  }));

  // ---- 示例教学 ----
  check('示例教学 13+ 主题', DEMOS.length >= 13);
  check('每关有对应 demo 映射', Object.keys(DEMO_FOR_LEVEL).length >= 10);
  check('demo 命令已注册', typeof GLOBAL_COMMANDS['demo'] === 'function');

  // ---- 知识手册 ----
  check('教材 15 章 + 4 附录', DOCBOOK.length === 15 && DOC_APPENDIX.length === 4);
  check('教材每章有内容', DOCBOOK.every(function (c) { return c.title && c.lines && c.lines.length >= 15; }));
  check('术语表 40 条', GLOSSARY.length >= 40);
  check('docs 命令已注册', typeof GLOBAL_COMMANDS['docs'] === 'function');
  check('docs term 可查', GLOSSARY.some(function (g) { return g.term === '提示注入' && g.def.length > 0; }));

  // ---- UI 主题 ----
  check('6 套主题', Object.keys(THEMES).length === 6);
  check('theme 命令已注册', typeof GLOBAL_COMMANDS['theme'] === 'function');
  check('panel 命令已注册', typeof GLOBAL_COMMANDS['panel'] === 'function');

  // ---- L2 密码破译链 ----
  var l2 = Game.levels.find(function (l) { return l.id === 2; });
  var step1 = b64d(l2.fs['intercept.b64']);
  check('L2 b64 解码得到 ROT13 文本', step1 === caesar('flag{crypto_broken}', 13));
  check('L2 ROT13 还原 flag', caesar(step1, 13) === 'flag{crypto_broken}');
  check('L2 维吉尼亚解密邮件', vigenere(l2.fs['email.enc'], 'sun', true) === 'admin_password=sunshine123');
  check('L2 答案可提交', l2.answers['sunshine123'] === 'answer');

  // ---- L4 逆向二进制 ----
  var l4 = Game.levels.find(function (l) { return l.id === 4; });
  var bin4 = toBytes(l4.fs['crackme.bin']);
  check('L4 ELF 魔数', bin4[0] === 0x7f && bin4[1] === 0x45 && bin4[2] === 0x4c && bin4[3] === 0x46);
  check('L4 0x18 处为 jne(0x75)', bin4[0x18] === 0x75);
  check('L4 含字符串', bytesToStr(bin4).indexOf('ACCESS GRANTED') !== -1);

  // ---- L5 取证镜像 ----
  var l5 = Game.levels.find(function (l) { return l.id === 5; });
  var dd = toBytes(l5.fs['usb.dd']);
  var ddStr = bytesToStr(dd);
  check('L5 有已删除文件痕迹', ddStr.indexOf('secret.png') !== -1);
  check('L5 有 wifi 密码', ddStr.indexOf('BlueWhale42') !== -1);
  var blob = ddStr.match(/hidden_flag_data=([A-Za-z0-9+/=]+)/);
  check('L5 有 base64 隐藏数据', !!blob);
  check('L5 base64 解码为 flag', !!blob && b64d(blob[1]) === 'flag{usb_evidence_recovered}');

  // ---- L6 终极渗透 ----
  var l6 = Game.levels.find(function (l) { return l.id === 6; });
  check('L6 哈希 = md5("password")', l6.crackHash === '5f4dcc3b5aa765d61d8327deb882cf99');
  check('L6 哈希可被字典命中', WORDLIST.indexOf('password') !== -1);

  // ---- 异步 SHA-256 向量 ----
  sha256Hex('abc').then(function (h) {
    check('sha256("abc") 向量', h === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    finish();
  });
})();
`;

eval(code);
