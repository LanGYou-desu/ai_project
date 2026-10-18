'use strict';
/* =========================================================
 * 真实 CLI 工具链测试: 真实扫描/抓banner/哈希/爆破/hexdump/strings/HTTP注入/pcap
 * 用法: node test/tools-test.js
 * 注意: 用异步 spawn (execFileSync 会阻塞本进程事件循环,
 *        导致同进程的靶场服务无法响应子进程的 TCP 请求)
 * ========================================================= */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createLab } = require('../lab/lab.js');

const ROOT = path.join(__dirname, '..');
const NODE = process.execPath;
const run = (script, args) => new Promise((resolve, reject) => {
  const p = spawn(NODE, [path.join(ROOT, script), ...(args || [])], { cwd: ROOT });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
});
/* 期望失败的命令 (参数/文件错误应友好报错并 exit 1, 不能抛 stack trace) */
const runFail = (script, args) => new Promise((resolve) => {
  const p = spawn(NODE, [path.join(ROOT, script), ...(args || [])], { cwd: ROOT });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => resolve({ code, out }));
});

(async function () {
  const lab = createLab({ httpPort: 0, tcpPort: 0, sshPort: 0, downloadDir: path.join(os.tmpdir(), 'ct-' + Date.now()) });
  await lab.ready;
  const R = [];
  const check = (n, c) => R.push([n, !!c]);
  try {
    // 1. 生成真实练习素材
    await run('make-practice.js');
    const practice = path.join(ROOT, 'practice');
    check('practice 素材生成 (pcap/日志/邮件/二进制)', fs.existsSync(path.join(practice, 'login.pcap')) && fs.existsSync(path.join(practice, 'auth.log')) && fs.existsSync(path.join(practice, 'phishing.eml')) && fs.existsSync(path.join(practice, 'crackme.bin')));
    check('弱密码字典生成', fs.existsSync(path.join(ROOT, 'tools', 'rockyou-mini.txt')));

    // 2. 真实 pcap (Wireshark 格式)
    const pcap = fs.readFileSync(path.join(practice, 'login.pcap'));
    check('pcap 全局头魔数正确', pcap.length > 40 && pcap.readUInt32LE(0) === 0xa1b2c3d4);
    check('pcap 含明文密码', pcap.includes(Buffer.from('password=hunter2')));

    // 3. 真实 TCP 端口扫描
    const scanOut = await run('tools/scanlab.js', ['127.0.0.1', '--ports', [lab.tcpPort, lab.sshPort, 1].join(',')]);
    check('scanlab 发现真实开放端口', scanOut.includes(String(lab.tcpPort)) && scanOut.includes('open'));

    // 4. 真实 banner 抓取
    const bn = await run('tools/bannerlab.js', ['127.0.0.1', String(lab.tcpPort)]);
    check('bannerlab 抓到真实 banner', bn.includes('TelnetBackdoor'));

    // 5. 哈希计算
    const h = await run('tools/hashlab.js', ['md5', 'password']);
    check('hashlab MD5 向量正确', h.includes('5f4dcc3b5aa765d61d8327deb882cf99'));
    const h256 = await run('tools/hashlab.js', ['sha256', 'abc']);
    check('hashlab SHA-256 向量正确', h256.includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));

    // 6. 真实字典爆破
    const cr = await run('tools/cracklab.js', ['5f4dcc3b5aa765d61d8327deb882cf99']);
    check('cracklab 爆破出 password', cr.includes('→ password'));

    // 7. hexlab / stringslab
    const hx = await run('tools/hexlab.js', [path.join(practice, 'crackme.bin')]);
    check('hexlab 显示 ELF 魔数', hx.includes('7F 45 4C 46'));
    const st = await run('tools/stringslab.js', [path.join(practice, 'usb.dd')]);
    check('stringslab 提取隐藏数据', st.includes('hidden_flag_data'));

    // 8. 真实 HTTP SQL 注入
    const login = await run('tools/httplab.js', ['login', 'http://127.0.0.1:' + lab.httpPort + '/api/login', "admin'--", 'x']);
    check('httplab 真实 SQLi 成功', login.includes('登录成功') && login.includes('admin'));

    // 9. practice 素材与靶场一致
    const cbPractice = fs.readFileSync(path.join(practice, 'crackme.bin'));
    const cbLab = Buffer.from(await (await fetch('http://127.0.0.1:' + lab.httpPort + '/api/files/crackme.bin')).arrayBuffer());
    check('practice crackme 与靶场一致', cbPractice.equals(cbLab));

    // 10. 参数/文件错误要友好报错 (exit 1, 不抛 stack trace)
    const hxMiss = await runFail('tools/hexlab.js', ['no_such.bin']);
    check('hexlab 缺文件友好报错', hxMiss.code === 1 && hxMiss.out.includes('✘ 文件不存在') && hxMiss.out.indexOf('at Object.') === -1);
    const stMiss = await runFail('tools/stringslab.js', ['no_such.bin']);
    check('stringslab 缺文件友好报错', stMiss.code === 1 && stMiss.out.includes('✘ 文件不存在') && stMiss.out.indexOf('at Object.') === -1);
    const hArg = await runFail('tools/hashlab.js', ['md5', '--file']);
    check('hashlab --file 缺路径友好报错', hArg.code === 1 && hArg.out.includes('✘'));
    const hMiss = await runFail('tools/hashlab.js', ['md5', '--file', 'no_such.bin']);
    check('hashlab --file 文件不存在友好报错', hMiss.code === 1 && hMiss.out.includes('✘ 文件不存在'));

    // 11. make-practice 可重复执行 (pcap 生成直接复用 pcapgen 导出, 不再自我拷贝)
    await run('make-practice.js');
    const pcap2 = fs.readFileSync(path.join(practice, 'login.pcap'));
    check('make-practice 可重复执行且 pcap 有效', pcap2.readUInt32LE(0) === 0xa1b2c3d4 && pcap2.includes(Buffer.from('password=hunter2')));
  } catch (e) {
    R.push(['测试执行异常: ' + e.message, false]);
    console.error(e);
  } finally {
    lab.close();
  }
  let pass = 0;
  R.forEach(([n, c]) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n); if (c) pass++; });
  console.log('\n' + pass + '/' + R.length + ' 项通过 (真实 CLI 工具链)');
  if (pass !== R.length) process.exit(1);
})();
