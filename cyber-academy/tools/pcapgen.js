#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实 PCAP 生成器
 * 生成可在 Wireshark 中打开的真实 .pcap 文件,
 * 内容: 一次携带明文口令的 HTTP 登录 (真实 TCP 三次握手 + HTTP POST)
 * 用法: node tools/pcapgen.js [输出文件] [密码]
 * 示例: node tools/pcapgen.js practice/login.pcap hunter2
 * ========================================================= */
const fs = require('fs');
const path = require('path');

function checksum16(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    sum += (buf[i] << 8) + (i + 1 < buf.length ? buf[i + 1] : 0);
  }
  while (sum >> 16) sum = (sum & 0xffff) + (sum >>> 16);
  return (~sum) & 0xffff;
}

/* 构造一个以太网帧: 内含 IPv4 + TCP, payload 为 HTTP 数据 */
function buildTcpPacket(srcMac, dstMac, srcIp, dstIp, sport, dport, seq, ack, flags, payload, ipId) {
  const eth = Buffer.alloc(14);
  Buffer.from(dstMac.split(':').map((x) => parseInt(x, 16))).copy(eth, 0);
  Buffer.from(srcMac.split(':').map((x) => parseInt(x, 16))).copy(eth, 6);
  eth.writeUInt16BE(0x0800, 12); // IPv4

  const ip = Buffer.alloc(20);
  ip.writeUInt8(0x45, 0); // version 4, IHL 5
  ip.writeUInt16BE(20 + 20 + payload.length, 2); // total length
  ip.writeUInt16BE(ipId, 4);
  ip.writeUInt8(64, 8); // TTL
  ip.writeUInt8(6, 9); // TCP
  const sip = srcIp.split('.').map((x) => parseInt(x, 10));
  const dip = dstIp.split('.').map((x) => parseInt(x, 10));
  ip.set(sip, 12);
  ip.set(dip, 16);
  ip.writeUInt16BE(checksum16(ip), 10);

  const tcp = Buffer.alloc(20);
  tcp.writeUInt16BE(sport, 0);
  tcp.writeUInt16BE(dport, 2);
  tcp.writeUInt32BE(seq, 4);
  tcp.writeUInt32BE(ack, 8);
  tcp.writeUInt8(0x50, 12); // data offset 5
  tcp.writeUInt16BE(flags, 13);
  tcp.writeUInt16BE(65535, 14); // window
  // TCP checksum (含伪头部)
  const pseudo = Buffer.alloc(12);
  pseudo.set(sip, 0);
  pseudo.set(dip, 4);
  pseudo.writeUInt8(0, 8);
  pseudo.writeUInt8(6, 9);
  pseudo.writeUInt16BE(20 + payload.length, 10);
  const tcpCheck = checksum16(Buffer.concat([pseudo, tcp, payload]));
  tcp.writeUInt16BE(tcpCheck, 16);

  return Buffer.concat([eth, ip, tcp, payload]);
}

function buildPcap(packets) {
  const globalHeader = Buffer.alloc(24);
  globalHeader.writeUInt32LE(0xa1b2c3d4, 0); // magic (微秒)
  globalHeader.writeUInt16LE(2, 4);
  globalHeader.writeUInt16LE(4, 6);
  globalHeader.writeUInt32LE(0, 8);
  globalHeader.writeUInt32LE(0, 12);
  globalHeader.writeUInt32LE(65535, 16);
  globalHeader.writeUInt32LE(1, 20); // Ethernet
  const parts = [globalHeader];
  let t = 1700000000;
  packets.forEach((pkt) => {
    const rec = Buffer.alloc(16);
    rec.writeUInt32LE(t, 0);
    rec.writeUInt32LE(0, 4);
    rec.writeUInt32LE(pkt.length, 8);
    rec.writeUInt32LE(pkt.length, 12);
    parts.push(rec, pkt);
    t += 1;
  });
  return Buffer.concat(parts);
}

function main() {
  const args = process.argv.slice(2);
  const outFile = args[0] || path.join(__dirname, '..', 'practice', 'login.pcap');
  const password = args[1] || 'hunter2';
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const clientMac = 'aa:bb:cc:11:22:33';
  const serverMac = 'aa:bb:cc:44:55:66';
  const httpPayload = Buffer.from(
    'POST /api/login HTTP/1.1\r\n' +
    'Host: vuln-bank.local\r\n' +
    'Content-Type: application/x-www-form-urlencoded\r\n' +
    'Content-Length: ' + Buffer.byteLength('user=admin&password=' + password) + '\r\n' +
    'User-Agent: Mozilla/5.0 (Windows NT 10.0)\r\n\r\n' +
    'user=admin&password=' + password, 'latin1');

  const packets = [
    buildTcpPacket(clientMac, serverMac, '192.168.1.100', '10.0.2.7', 51234, 80, 1000, 0, 0x02, Buffer.alloc(0), 1), // SYN
    buildTcpPacket(serverMac, clientMac, '10.0.2.7', '192.168.1.100', 80, 51234, 2000, 1001, 0x12, Buffer.alloc(0), 2), // SYN-ACK
    buildTcpPacket(clientMac, serverMac, '192.168.1.100', '10.0.2.7', 51234, 80, 1001, 2001, 0x10, Buffer.alloc(0), 3), // ACK
    buildTcpPacket(clientMac, serverMac, '192.168.1.100', '10.0.2.7', 51234, 80, 1001, 2001, 0x18, httpPayload, 4), // PSH+ACK (HTTP POST)
    buildTcpPacket(serverMac, clientMac, '10.0.2.7', '192.168.1.100', 80, 51234, 2001, 1001 + httpPayload.length, 0x10, Buffer.alloc(0), 5), // ACK
  ];
  const data = buildPcap(packets);
  fs.writeFileSync(outFile, data);
  console.log(`✔ 已生成真实抓包文件: ${outFile} (${data.length} 字节, 5 个数据包)`);
  console.log(`  密码 "${password}" 以明文藏在 HTTP POST 中 — 用 Wireshark 打开分析:`);
  console.log('    Wireshark → File → Open → ' + outFile);
  console.log('    或命令行: tshark -r ' + outFile + ' -Y http');
}

main();
