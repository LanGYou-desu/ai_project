'use strict';
/* =========================================================
 * 静态服务器安全测试: 越权/路径穿越防护
 * 用法: node test/server-test.js
 * ========================================================= */
const http = require('http');
const path = require('path');
const { createStaticHandler } = require('../server.js');

(async function () {
  const ROOT = path.join(__dirname, '..');
  const server = http.createServer(createStaticHandler(ROOT));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const R = [];
  const check = (n, c) => R.push([n, !!c]);

  const get = async (p) => {
    const r = await fetch('http://127.0.0.1:' + port + p);
    return { status: r.status, text: await r.text() };
  };
  // 用原始请求路径 (fetch 会自动规范化 .., 无法测穿越)
  const rawGet = (p) => new Promise((res) => {
    const req = http.request({ host: '127.0.0.1', port, path: p }, (r) => { r.resume(); r.on('end', () => res(r.statusCode)); });
    req.on('error', () => res(0));
    req.end();
  });

  try {
    const ok = await get('/');
    check('GET / → 200 且含标题', ok.status === 200 && ok.text.includes('赛博安全学院'));
    const js = await get('/js/core.js');
    check('GET 静态 JS → 200', js.status === 200);
    const css = await get('/css/style.css');
    check('GET 静态 CSS → 200', css.status === 200);
    const miss = await get('/no-such-file.js');
    check('不存在 → 404', miss.status === 404);
    check('路径穿越 ../ → 403', (await rawGet('/../server.js')) === 403);
    check('编码穿越 %2f → 403', (await rawGet('/..%2fserver.js')) === 403);
    check('点穿越 %2e%2e → 403', (await rawGet('/%2e%2e/server.js')) === 403);
    check('深层穿越 → 403', (await rawGet('/lab/../../server.js')) === 403);
  } catch (e) {
    R.push(['测试执行异常: ' + e.message, false]);
    console.error(e);
  } finally {
    server.close();
  }

  let pass = 0;
  R.forEach(([n, c]) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n); if (c) pass++; });
  console.log('\n' + pass + '/' + R.length + ' 项通过 (静态服务器安全)');
  if (pass !== R.length) process.exit(1);
})();
