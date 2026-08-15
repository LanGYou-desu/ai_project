#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实 HTTP 客户端 (Web 渗透)
 * 用法:
 *   node tools/httplab.js get <url>
 *   node tools/httplab.js post <url> <json>
 *   node tools/httplab.js login <url> <user> <pass>   # 展示真实执行的 SQL
 * 示例 (对本地靶场):
 *   node tools/httplab.js get http://127.0.0.1:8090/api/users
 *   node tools/httplab.js login http://127.0.0.1:8090/api/login "admin'--" x
 * ========================================================= */

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { /* 非 JSON */ }
  return { status: res.status, text, parsed };
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = (args[0] || '').toLowerCase();
  if (!['get', 'post', 'login'].includes(cmd) || !args[1]) {
    console.log('用法:');
    console.log('  node tools/httplab.js get <url>');
    console.log('  node tools/httplab.js post <url> <json>');
    console.log('  node tools/httplab.js login <url> <user> <pass>');
    console.log('示例:');
    console.log('  node tools/httplab.js get http://127.0.0.1:8090/api/users');
    console.log('  node tools/httplab.js login http://127.0.0.1:8090/api/login "admin\'--" x');
    process.exit(1);
  }
  try {
    if (cmd === 'get') {
      const { status, text, parsed } = await req('GET', args[1]);
      console.log(`HTTP ${status}`);
      console.log(parsed ? JSON.stringify(parsed, null, 2) : text);
    } else if (cmd === 'post') {
      let body = {};
      try { body = JSON.parse(args[2] || '{}'); } catch (e) { body = { data: args[2] }; }
      const { status, text, parsed } = await req('POST', args[1], body);
      console.log(`HTTP ${status}`);
      console.log(parsed ? JSON.stringify(parsed, null, 2) : text);
    } else if (cmd === 'login') {
      const url = args[1];
      const user = args[2] || '';
      const pass = args[3] || '';
      console.log(`POST ${url}`);
      console.log(`请求体: {"username":"${user}","password":"${pass}"}`);
      const { status, parsed } = await req('POST', url, { username: user, password: pass });
      console.log(`HTTP ${status}`);
      if (parsed && parsed.sql) console.log('真实执行的 SQL: ' + parsed.sql);
      if (parsed) {
        console.log(parsed.ok ? `✔ 登录成功! 返回 ${(parsed.rows || []).length} 行` : '✘ 认证失败');
        if (parsed.rows && parsed.rows.length) console.log(JSON.stringify(parsed.rows, null, 2));
      }
    }
  } catch (e) {
    console.log('✘ 请求失败: ' + e.message);
    process.exit(1);
  }
}

main();
