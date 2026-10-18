'use strict';
/* 仓库级测试总入口：把 21 个带自动化测试的项目一次跑完，给出统一汇总。
 *
 *   node scripts/test-all.js                     # 跑全部
 *   node scripts/test-all.js loom unlit          # 只跑指定项目（写短名或完整路径均可）
 *   node scripts/test-all.js gamesWeb/loom      # 同上，用分类路径
 *   node scripts/test-all.js --fast              # 跳过耗时最长的项目
 *
 * 零依赖：只用 Node 内置模块。每个项目仍然是"各自独立"的，
 * 这里只负责按登记表调用它们自己的测试命令，不改变任何项目结构。
 * 其余 4 个项目（bikeArt / hakureiShrine / tokyoCelCity / naiwaModel）
 * 是纯静态页面或 3D 模型作品，没有自动化测试，就不登记了。
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

/* 每个项目登记它自己的测试方式；cmd 用 shell 执行，便于复用各项目的既有命令。
 * id 即项目在仓库中的相对路径（分类目录/项目名）。 */
const PROJECTS = [
  { id: 'gamesWeb/netime',          name: 'NETIME 时光机',    suites: [{ cmd: 'node tests/run.js', timeout: 120000 }] },
  { id: 'gamesWeb/soundArchaeology', name: '声音考古学',     suites: [{ cmd: 'node tests/run.js', timeout: 120000 }] },
  { id: 'gamesWeb/lingua',          name: 'LINGUA 语言博物馆', suites: [{ cmd: 'node test/run.js', timeout: 120000 }] },
  { id: 'gamesWeb/lastBroadcast',  name: 'LASTBROADCAST',    suites: [{ cmd: 'node test/run.js', timeout: 120000 }] },
  { id: 'gamesWeb/ecoArk',         name: 'ECO-ARK 生态方舟', suites: [{ cmd: 'node test/run.js', timeout: 300000 }] },
  { id: 'gamesWeb/unlit',           name: '无光之城',         suites: [
      { cmd: 'node test/run.js',           timeout: 120000 },
      { cmd: 'node test/smoke-browser.js', timeout: 180000 }
    ] },
  { id: 'gamesWeb/synapse',         name: '神经织造',         suites: [
      { cmd: 'node test/run.js',      timeout: 180000 },
      { cmd: 'node test/smoke-ui.js', timeout: 120000 }
    ] },
  { id: 'gamesWeb/inkSaga',        name: '墨战·天书纪',      suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'gamesWeb/loom',            name: 'LOOM 织机编程',    suites: [
      { cmd: 'node test/run.js',      timeout: 180000 },
      { cmd: 'node test/smoke-ui.js', timeout: 120000 }
    ] },
  { id: 'gamesWeb/outlawCity',     name: '亡命都市 3D',      suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'gamesDesktop/devsaga',     name: 'DevSaga',          suites: [{ cmd: 'python -m unittest discover -s tests -p "test_*.py"', timeout: 300000 }] },
  { id: 'gamesDesktop/shellQuest', name: '真实文件历险',     suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'gamesDesktop/theVanished', name: '桌面悬疑事件',    suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'gamesDesktop/desktopSiege', name: '桌面保卫战',     suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'gamesDesktop/houseGuest', name: '桌灵·房客',        suites: [{ cmd: 'python -m unittest discover -s tests -p "test_*.py"', timeout: 300000 }] },
  { id: 'scenes3d/carShowroom',    name: '3D 跑车展厅',      suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'scenes3d/hakoniwaTown',   name: '箱庭小镇',         suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'webApps/cyberAcademy',    name: '赛博安全学院',     suites: [
      { cmd: 'node test/audit.js',        timeout: 120000 },
      { cmd: 'node test/lab-test.js',     timeout: 120000 },
      { cmd: 'node test/lab-game-test.js',timeout: 120000 },
      { cmd: 'node test/playthrough.js',  timeout: 180000 },
      { cmd: 'node test/lab-security-test.js', timeout: 180000 },
      { cmd: 'node test/server-test.js',  timeout: 120000 },
      { cmd: 'node test/smoke.js',        timeout: 180000 },
      { cmd: 'node test/tools-test.js',   timeout: 180000 }
    ] },
  { id: 'webApps/historyReader',   name: '历史朗读者',       suites: [{ cmd: 'node test/run.js', timeout: 180000 }] },
  { id: 'webApps/personalOs',      name: 'personalOs 个人操作系统', suites: [{ cmd: 'npm test', timeout: 300000 }] },
  { id: 'devTools/aiCompiler',     name: 'AI 编译器',        suites: [{ cmd: 'npm test', timeout: 180000 }] }
];

/* --fast：跳过已知最慢的两个项目 */
const SLOW = new Set(['gamesWeb/ecoArk', 'gamesDesktop/devsaga']);

function pick(argv) {
  const fast = argv.includes('--fast');
  const ids = argv.filter(function (a) { return a[0] !== '-'; });
  let list = PROJECTS.filter(function (p) {
    if (!ids.length) return true;
    return ids.some(function (a) {
      return a === p.id || p.id.slice(p.id.indexOf('/') + 1) === a;
    });
  });
  if (fast) list = list.filter(function (p) { return !SLOW.has(p.id); });
  return { list: list, fast: fast };
}

function run(cwd, cmd, timeout) {
  const started = Date.now();
  const r = spawnSync(cmd, { cwd: cwd, shell: true, encoding: 'utf8', timeout: timeout, maxBuffer: 32 * 1024 * 1024 });
  const ms = Date.now() - started;
  const out = (r.stdout || '') + (r.stderr || '');
  const code = r.status == null ? -1 : r.status;
  return { code: code, ms: ms, out: out, timedOut: r.error && r.error.code === 'ETIMEDOUT' };
}

/* 从输出里抠出"通过 N 项 / 失败 M 项"这类计数，给汇总加信息 */
function extractCount(out) {
  let m;
  if ((m = /(\d+)\s*(?:项|个)?\s*通过[，,、\s]*(\d+)\s*(?:项|个)?\s*失败/.exec(out))) return { passed: +m[1], failed: +m[2] };
  if ((m = /结果[：:]\s*(\d+)\s*通过[，,]\s*(\d+)\s*失败/.exec(out))) return { passed: +m[1], failed: +m[2] };
  if ((m = /通过\s*[:：]\s*(\d+)[^\d]+失败\s*[:：]\s*(\d+)/.exec(out))) return { passed: +m[1], failed: +m[2] };
  if ((m = /(\d+)\s*passed[^\d]+(\d+)\s*failed/i.exec(out))) return { passed: +m[1], failed: +m[2] };
  if ((m = /Ran\s+(\d+)\s+tests?/i.exec(out))) return { ran: +m[1] };
  if ((m = /(\d+)\/(\d+)\s*(?:项)?通过/.exec(out))) return { passed: +m[1], total: +m[2] };
  return null;
}

/* 把计数渲染成简短后缀，例如 "  · 141 项" */
function fmtCount(c) {
  if (!c) return '';
  if (c.passed != null) return '  · ' + c.passed + ' 项';
  if (c.ran != null) return '  · ' + c.ran + ' 项';
  return '';
}

function main() {
  const { list, fast } = pick(process.argv.slice(2));
  if (!list.length) {
    console.log('没有匹配的项目。可用：' + PROJECTS.map(function (p) { return p.id; }).join(', '));
    process.exit(1);
  }

  console.log('');
  console.log('  AI Project 合集 · 全仓库测试');
  console.log('  ' + list.length + ' 个项目' + (fast ? '（--fast 已跳过最慢的项目）' : '') + ' · 根目录 ' + ROOT);
  console.log('');

  const results = [];
  const t0 = Date.now();

  for (const proj of list) {
    const dir = path.join(ROOT, proj.id);
    if (!fs.existsSync(dir)) {
      results.push({ proj: proj, ok: false, reason: '目录不存在', suites: [] });
      console.log('  ✗ ' + pad(proj.id) + ' 目录不存在');
      continue;
    }
    const suiteResults = [];
    let allOk = true;
    for (const s of proj.suites) {
      const r = run(dir, s.cmd, s.timeout || 180000);
      const ok = r.code === 0;
      if (!ok) allOk = false;
      const count = extractCount(r.out);
      suiteResults.push({ cmd: s.cmd, ok: ok, ms: r.ms, count: count, out: r.out, timedOut: r.timedOut });
      console.log('  ' + (ok ? '✓' : '✗') + ' ' + pad(proj.id) + ' ' + pad(s.cmd, 42) + ' ' + (r.ms / 1000).toFixed(1) + 's' +
        (r.timedOut ? '  [超时]' : '') + fmtCount(count));
      if (!ok) {
        const tail = r.out.trim().split('\n').slice(-12).join('\n        ');
        console.log('        ' + tail);
      }
    }
    results.push({ proj: proj, ok: allOk, suites: suiteResults });
  }

  const totalMs = Date.now() - t0;
  const failed = results.filter(function (r) { return !r.ok; });
  const suiteTotal = results.reduce(function (a, r) { return a + r.suites.length; }, 0);
  const suiteOk = results.reduce(function (a, r) { return a + r.suites.filter(function (s) { return s.ok; }).length; }, 0);

  console.log('');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  项目 ' + (results.length - failed.length) + '/' + results.length + ' 通过 · 测试套件 ' + suiteOk + '/' + suiteTotal + ' 通过 · 用时 ' + (totalMs / 1000).toFixed(1) + 's');
  if (failed.length) {
    console.log('  失败项目：' + failed.map(function (r) { return r.proj.id; }).join(', '));
  }
  console.log('');

  process.exit(failed.length ? 1 : 0);
}

function pad(s, n) {
  s = String(s);
  n = n || 20;
  while (s.length < n) s += ' ';
  return s;
}

main();
