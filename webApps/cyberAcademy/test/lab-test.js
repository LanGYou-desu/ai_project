'use strict';
/* =========================================================
 * 本地靶场集成测试: 真实 SQL 注入 / XSS / TCP 握手 / 文件
 * 用法: node test/lab-test.js
 * ========================================================= */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createLab } = require('../lab/lab.js');
const md5h = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

(async function () {
  const downloadDir = path.join(os.tmpdir(), 'cyber-lab-dl-' + Date.now());
  const lab = createLab({ httpPort: 0, tcpPort: 0, sshPort: 0, downloadDir });
  await lab.ready;

  const base = 'http://127.0.0.1:' + lab.httpPort;
  const results = [];
  const check = (n, c) => { results.push([n, !!c]); };
  const post = (p, obj) => fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof obj === 'string' ? obj : JSON.stringify(obj),
  }).then((r) => r.json());

  try {
    // 状态
    const st = await fetch(base + '/lab/status').then((r) => r.json());
    check('status.lab=true', st.lab === true);
    check('status 报告 SQL 引擎', typeof st.engine === 'string' && st.engine.length > 0);

    // 真实 SQL 注入 (admin'--)
    const ok = await post('/api/login', { username: "admin'--", password: 'x' });
    check('SQLi(admin\'--) 成功', ok.ok === true && ok.rows && ok.rows.length === 1);
    check('SQLi 注入标记', ok.injected === true);
    check('SQL 回显包含载荷', typeof ok.sql === 'string' && ok.sql.includes("admin'--"));

    // OR 1=1 (注意: 真实 SQL 中 AND 优先级高于 OR，必须用 -- 注释掉密码判断)
    const or1 = await post('/api/login', { username: "' OR '1'='1' -- ", password: 'x' });
    check('SQLi(OR 1=1 + 注释) 成功', or1.ok === true && or1.rows && or1.rows.length === 3);

    // 正常登录 (admin/password)
    const good = await post('/api/login', { username: 'admin', password: 'password' });
    check('正常凭据登录成功', good.ok === true);

    // 错误凭据
    const bad = await post('/api/login', { username: 'admin', password: 'wrong' });
    check('错误密码失败', bad.ok === false);

    // 畸形 SQL 不崩溃
    const weird = await post('/api/login', { username: "'", password: "'" });
    check('畸形输入不崩溃 (返回 JSON)', weird && typeof weird.ok === 'boolean');

    // XSS 反射
    const payload = '<script>alert(1)</script>';
    const sx = await fetch(base + '/api/search?q=' + encodeURIComponent(payload)).then((r) => r.json());
    check('XSS 原样反射', sx.echoed === payload);
    check('XSS 标记 unsafe', sx.safe === false);
    const sx2 = await fetch(base + '/api/search?q=' + encodeURIComponent('hello')).then((r) => r.json());
    check('普通搜索安全', sx2.safe === true);

    // 用户表 (真实哈希)
    const us = await fetch(base + '/api/users').then((r) => r.json());
    check('用户表含 admin', Array.isArray(us.rows) && us.rows.some((r) => r.username === 'admin' && r.password_hash === '5f4dcc3b5aa765d61d8327deb882cf99'));
    check('用户表含 bob', Array.isArray(us.rows) && us.rows.some((r) => r.username === 'bob'));
    check('用户表含 alice', Array.isArray(us.rows) && us.rows.some((r) => r.username === 'alice' && r.password_hash === md5h('letmein')));

    // 命令注入 (真实执行)
    const sep = process.platform === 'win32' ? ' & ' : '; ';
    const pwnTag = 'LAB_PWN_' + Date.now();
    const ping = await fetch(base + '/api/ping?host=' + encodeURIComponent('127.0.0.1' + sep + 'echo ' + pwnTag)).then((r) => r.json());
    check('ping 返回命令', typeof ping.command === 'string' && ping.command.includes('127.0.0.1'));
    check('命令注入真实执行', (ping.output || '').includes(pwnTag));

    // IDOR 越权 (无鉴权读他人隐私)
    const p1 = await fetch(base + '/api/profile?id=1').then((r) => r.json());
    check('IDOR: id=1 读 admin 隐私', p1.ok === true && p1.username === 'admin' && typeof p1.secret === 'string' && p1.secret.length > 0);
    const p2 = await fetch(base + '/api/profile?id=3').then((r) => r.json());
    check('IDOR: id=3 读 alice 隐私', p2.ok === true && p2.username === 'alice' && p2.secret === 'alice_payroll_2024');
    const p0 = await fetch(base + '/api/profile?id=99').then((r) => r.json());
    check('IDOR: 不存在用户返回 404', p0.ok === false);

    // 路径穿越 (任意文件读取)
    const rd = await fetch(base + '/api/read?file=' + encodeURIComponent('secret.txt')).then((r) => r.json());
    check('读取 secret.txt 成功', rd.ok === true && String(rd.content).trim() === 'lab_secret_value_8f3a2c');
    const trav = await fetch(base + '/api/read?file=' + encodeURIComponent('../../server.js')).then((r) => r.json());
    check('路径穿越读到目录外文件', trav.ok === true && /赛博安全学院|http/.test(String(trav.content)));
    const rdMiss = await fetch(base + '/api/read?file=' + encodeURIComponent('no_such_file.txt')).then((r) => r.json());
    check('不存在的文件报错', rdMiss.ok === false);
    check('secret.txt 已落盘', fs.existsSync(path.join(__dirname, '..', 'lab', 'lab-files', 'secret.txt')));

    // 状态包含命令分隔符
    const st2 = await fetch(base + '/lab/status').then((r) => r.json());
    check('status 提供命令分隔符', typeof st2.sep === 'string' && st2.sep.length > 0);

    // ============ MiniSQL 降级引擎 (强制 miniSql) ============
    const labMini = createLab({ httpPort: 0, tcpPort: 0, sshPort: 0, downloadDir: path.join(os.tmpdir(), 'ct-mini-' + Date.now()), miniSql: true });
    await labMini.ready;
    const baseM = 'http://127.0.0.1:' + labMini.httpPort;
    const postM = (p, obj) => fetch(baseM + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof obj === 'string' ? obj : JSON.stringify(obj),
    }).then((r) => r.json());
    const stM = await fetch(baseM + '/lab/status').then((r) => r.json());
    check('MiniSQL 降级引擎生效', typeof stM.engine === 'string' && stM.engine.includes('MiniSQL'));
    const okM = await postM('/api/login', { username: "admin'--", password: 'x' });
    check('MiniSQL: admin\'-- 注入成功', okM.ok === true && okM.rows.length === 1);
    const goodM = await postM('/api/login', { username: 'admin', password: 'password' });
    check('MiniSQL: 正常凭据成功', goodM.ok === true);
    const badM = await postM('/api/login', { username: 'admin', password: 'wrong' });
    check('MiniSQL: 错误密码失败', badM.ok === false);
    const orM = await postM('/api/login', { username: "' OR '1'='1' -- ", password: 'x' });
    check('MiniSQL: OR 载荷按降级语义处理(无行)', orM.ok === false);
    const sxM = await fetch(baseM + '/api/search?q=' + encodeURIComponent('<script>x</script>')).then((r) => r.json());
    check('MiniSQL: XSS 检测仍工作', sxM.safe === false);
    const usM = await fetch(baseM + '/api/users').then((r) => r.json());
    check('MiniSQL: 用户表可读', Array.isArray(usM.rows) && usM.rows.length >= 2);
    labMini.close();

    // banner (真实 TCP)
    const bn = await post('/api/banner', '{}');
    check('banner 真实 TCP', typeof bn.banner === 'string' && bn.banner.includes('TelnetBackdoor'));

    // 真实后门口令 (直接 TCP)
    const direct = await new Promise((resolve) => {
      const net = require('net');
      const s = net.connect(lab.tcpPort, '127.0.0.1');
      let data = '';
      s.on('data', (d) => { data += d.toString(); if (data.includes('PASSWORD:')) s.write('toor\n'); if (data.includes('WELCOME') || data.includes('DENIED')) { s.destroy(); resolve(data); } });
      s.on('error', () => resolve(''));
    });
    check('TCP 后门 root/toor 真实可用', direct.includes('WELCOME ROOT'));

    // SSH 握手 (真实 TCP)
    const ssh = await post('/api/ssh', { user: 'admin', pass: 'password' });
    check('SSH 认证成功', ssh.ok === true);
    const sshBad = await post('/api/ssh', { user: 'admin', pass: 'nope' });
    check('SSH 错误凭据拒绝', sshBad.ok === false);

    // 扫描 (真实端口探测)
    const sc = await post('/api/scan', '{}');
    check('scan 报告真实端口', Array.isArray(sc.ports) && sc.ports.some((p) => p.service === 'backdoor' && p.open === true));

    // 文件: crackme.bin
    const cb = new Uint8Array(await (await fetch(base + '/api/files/crackme.bin')).arrayBuffer());
    check('crackme ELF 魔数', cb[0] === 0x7f && cb[1] === 0x45 && cb[2] === 0x4c && cb[3] === 0x46);
    check('crackme 0x18 = 0x75 (jne)', cb[0x18] === 0x75);
    check('crackme 含 ACCESS GRANTED', Buffer.from(cb).toString('latin1').includes('ACCESS GRANTED'));

    // 文件: usb.dd
    const ddStr = Buffer.from(await (await fetch(base + '/api/files/usb.dd')).arrayBuffer()).toString('utf8');
    check('usb.dd 含删除痕迹', ddStr.includes('secret.png'));
    const blob = ddStr.match(/hidden_flag_data=([A-Za-z0-9+/=]+)/);
    check('usb.dd 隐藏 base64 可解码为 flag', !!blob && Buffer.from(blob[1], 'base64').toString('utf8') === 'flag{usb_evidence_recovered}');

    // 落盘文件
    check('downloads 已生成 crackme.bin', fs.existsSync(path.join(downloadDir, 'crackme.bin')));
    check('downloads 已生成 usb.dd', fs.existsSync(path.join(downloadDir, 'usb.dd')));

    // flag
    const fl = await fetch(base + '/api/flag').then((r) => r.json());
    check('flag 内容正确', fl.flag === 'flag{total_penetration}');

    // CORS
    const cors = await fetch(base + '/lab/status');
    check('CORS 允许跨域', cors.headers.get('access-control-allow-origin') === '*');
  } catch (e) {
    results.push(['测试执行异常: ' + e.message, false]);
    console.error(e);
  } finally {
    lab.close();
  }

  let pass = 0;
  results.forEach(([n, c]) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n); if (c) pass++; });
  console.log('\n' + pass + '/' + results.length + ' 项通过 (SQL 引擎: ' + lab.engine + ')');
  if (pass !== results.length) process.exit(1);
})();
