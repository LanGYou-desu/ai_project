#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 生成真实练习素材 (非 Web 部分)
 * 生成到 practice/ 目录:
 *   crackme.bin     真实 ELF 二进制 (逆向练习)
 *   usb.dd          真实磁盘镜像 (取证练习)
 *   login.pcap      真实抓包文件 (Wireshark 分析, 内含明文密码)
 *   phishing.eml    真实钓鱼邮件样例 (邮件分析)
 *   auth.log        真实认证日志 (日志分析)
 *   web.log         真实 Web 日志 (攻击溯源)
 * 同时生成 tools/rockyou-mini.txt 弱密码字典 (与游戏内置一致)
 * 用法: node make-practice.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PRACTICE = path.join(ROOT, 'practice');

/* 从游戏密码学库中提取内置弱密码字典 */
function loadWordlist() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'crypto.js'), 'utf8');
  const m = src.match(/const WORDLIST = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('无法从 js/crypto.js 提取字典');
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

function main() {
  fs.mkdirSync(PRACTICE, { recursive: true });

  // 1. 弱密码字典 (真实 txt 文件, 可用 --dict 传给 cracklab)
  const words = loadWordlist();
  const dictPath = path.join(ROOT, 'tools', 'rockyou-mini.txt');
  fs.writeFileSync(dictPath, words.join('\n') + '\n');
  console.log(`✔ 字典: ${dictPath} (${words.length} 条)`);

  // 2. 真实二进制与镜像 (与游戏/靶场内容一致)
  try {
    const { buildCrackmeBytes, buildUsbImage } = require('./lab/lab.js');
    fs.writeFileSync(path.join(PRACTICE, 'crackme.bin'), buildCrackmeBytes());
    fs.writeFileSync(path.join(PRACTICE, 'usb.dd'), buildUsbImage());
    console.log('✔ 素材: practice/crackme.bin, practice/usb.dd');
  } catch (e) {
    console.log('⚠ 生成二进制/镜像失败: ' + e.message);
  }

  // 3. 真实 pcap (Wireshark 可打开)
  try {
    require('./tools/pcapgen.js');
    fs.copyFileSync(path.join(PRACTICE, 'login.pcap'), path.join(PRACTICE, 'login.pcap'));
  } catch (e) {
    // pcapgen 直接执行时会生成到 practice/login.pcap
    const { execSync } = require('child_process');
    execSync('node ' + path.join(ROOT, 'tools', 'pcapgen.js') + ' ' + path.join(PRACTICE, 'login.pcap'));
  }
  console.log('✔ 素材: practice/login.pcap (Wireshark 分析)');

  // 4. 真实钓鱼邮件样例 (.eml 格式, 可用邮件客户端/文本编辑器打开)
  const phish = [
    'From: "VulnBank 安全中心" <security@vuln-bank-secure.xyz>\r\n' +
    'To: victim@example.com\r\n' +
    'Subject: 紧急: 您的账户存在异常登录, 请立即验证\r\n' +
    'Date: Mon, 12 Jan 2025 09:30:00 +0800\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n\r\n' +
    '<html><body><p>尊敬的用户:</p>' +
    '<p>检测到您的账户在 <b>203.0.113.66</b> 出现异常登录, 您的账户将被冻结。</p>' +
    '<p>请立即点击 <a href="http://vuln-bank-secure.xyz/login">此处</a> 验证身份, 否则 24 小时内账户将被删除。</p>' +
    '<p>安全中心</p></body></html>\r\n',
    'From: "VulnBank" <noreply@vuln-bank.com>\r\n' +
    'To: victim@example.com\r\n' +
    'Subject: 您的月结单已生成\r\n' +
    'Date: Mon, 12 Jan 2025 08:00:00 +0800\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/plain; charset=utf-8\r\n\r\n' +
    '尊敬的客户:\r\n\r\n您 2025 年 1 月的账单已生成, 请登录官网 www.vuln-bank.com 查看详情。\r\n\r\nVulnBank 客服中心\r\n',
  ];
  fs.writeFileSync(path.join(PRACTICE, 'phishing.eml'), phish[0]);
  fs.writeFileSync(path.join(PRACTICE, 'normal.eml'), phish[1]);
  console.log('✔ 素材: practice/phishing.eml, practice/normal.eml (对比分析)');

  // 5. 真实日志文件
  const authLog = [
    'Jan 12 08:01:02 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54123 ssh2',
    'Jan 12 08:01:05 server sshd[1011]: Failed password for admin from 203.0.113.66 port 54124 ssh2',
    'Jan 12 08:01:09 server sshd[1011]: Failed password for root from 203.0.113.66 port 54125 ssh2',
    'Jan 12 08:01:30 server sshd[1011]: Accepted password for admin from 203.0.113.66 port 54132 ssh2',
    'Jan 12 08:15:40 server sshd[1011]: Received disconnect from 203.0.113.66',
  ].join('\n') + '\n';
  const webLog = [
    '203.0.113.66 - - [12/Jan/2025:08:02:11 +0800] "GET /index.php?id=1 UNION SELECT username,password FROM users -- " 200 512 "Mozilla/5.0 (compatible; sqlmap/1.7)"',
    '203.0.113.66 - - [12/Jan/2025:08:03:20 +0800] "POST /admin/upload.php HTTP/1.1" 200 214 "-"',
    '10.0.0.7 - - [12/Jan/2025:08:10:00 +0800] "GET /shell.php HTTP/1.1" 200 512 "-"',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(PRACTICE, 'auth.log'), authLog);
  fs.writeFileSync(path.join(PRACTICE, 'web.log'), webLog);
  console.log('✔ 素材: practice/auth.log, practice/web.log');

  console.log('\n══════════════════════════════════════');
  console.log('✔ 真实练习素材已生成到 practice/ 目录');
  console.log('  Wireshark 打开 login.pcap 找明文密码');
  console.log('  strings/xxd/file 分析 crackme.bin 和 usb.dd');
  console.log('  对比 phishing.eml 与 normal.eml 找钓鱼特征');
  console.log('  cracklab.js 用 rockyou-mini.txt 爆破哈希');
  console.log('══════════════════════════════════════');
}

main();
