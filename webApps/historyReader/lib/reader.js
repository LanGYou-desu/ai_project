'use strict';

// ── 浏览器历史读取器 ──
// 支持 Chrome / Edge / Chromium（Chromium 内核，History 数据库结构相同）。
// 使用 sql.js（纯 JavaScript SQLite，无需原生编译）。

const fs = require('fs');
const path = require('path');
const os = require('os');

// 读取窗口与返回条数的边界（服务器会先校验查询参数，这里是最后一道防线）
const DEFAULT_DAYS = 7;
const MAX_DAYS = 3650;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;
const MAX_UPLOAD_VISITS = 20000;

// Chromium 时间戳：微秒 since 1601-01-01 与 Unix 秒之间的偏移
const CHROMIUM_EPOCH_OFFSET_SEC = 11644473600;

// 异步加载 sql.js
// 并发请求共享同一个初始化 Promise：避免同时发起两个请求时重复加载 WASM。
let sqlPromise = null;
function ensureSQL() {
  if (!sqlPromise) {
    sqlPromise = Promise.resolve()
      .then(function() { return require('sql.js')(); })
      .catch(function(err) {
        sqlPromise = null; // 失败后允许下次重试
        throw err;
      });
  }
  return sqlPromise;
}

// ── 公共 API ──

function getLocalAppData() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
}

// 各平台浏览器用户数据目录（Chrome / Edge / Chromium）
function getBrowserDataRoots() {
  const home = os.homedir();
  const roots = [];

  if (process.platform === 'win32') {
    const local = getLocalAppData();
    roots.push({ browser: 'Google Chrome', root: path.join(local, 'Google', 'Chrome', 'User Data') });
    roots.push({ browser: 'Microsoft Edge', root: path.join(local, 'Microsoft', 'Edge', 'User Data') });
  } else if (process.platform === 'darwin') {
    const appSupport = path.join(home, 'Library', 'Application Support');
    roots.push({ browser: 'Google Chrome', root: path.join(appSupport, 'Google', 'Chrome') });
    roots.push({ browser: 'Microsoft Edge', root: path.join(appSupport, 'Microsoft Edge') });
    roots.push({ browser: 'Chromium', root: path.join(appSupport, 'Chromium') });
  } else {
    const config = path.join(home, '.config');
    roots.push({ browser: 'Google Chrome', root: path.join(config, 'google-chrome') });
    roots.push({ browser: 'Microsoft Edge', root: path.join(config, 'microsoft-edge') });
    roots.push({ browser: 'Chromium', root: path.join(config, 'chromium') });
  }

  return roots;
}

// 列出某个用户数据目录下的 profile（Default + Profile 1/2/…，按编号排序）
function listProfiles(root) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (e) {
    return ['Default']; // 目录不存在时给出默认值，交给 existsSync 过滤
  }
  const profiles = entries
    .filter(function(e) { return e.isDirectory() && /^Profile \d+$/.test(e.name); })
    .map(function(e) { return e.name; })
    .sort(function(a, b) { return Number(a.slice(8)) - Number(b.slice(8)); });
  return ['Default'].concat(profiles);
}

// 返回所有候选浏览器历史路径，按优先级排列（Chrome 优先，其次 Edge / Chromium）
function getBrowserHistoryPaths() {
  const paths = [];
  for (const entry of getBrowserDataRoots()) {
    for (const profile of listProfiles(entry.root)) {
      paths.push(path.join(entry.root, profile, 'History'));
    }
  }
  return paths;
}

function findHistoryFile() {
  const paths = getBrowserHistoryPaths();
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// 路径 → 浏览器名。统一分隔符后再匹配，Windows 反斜杠与 POSIX 斜杠都能识别。
function getBrowserName(historyPath) {
  const p = String(historyPath).replace(/\\/g, '/').toLowerCase();
  if (p.includes('edge')) return 'Microsoft Edge';
  if (p.includes('chrome')) return 'Google Chrome';
  if (p.includes('chromium')) return 'Chromium';
  return '浏览器';
}

// 严格解析 "YYYY-MM-DD"（本地时区），非法输入直接报错而不是产生 NaN
function parseLocalDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr == null ? '' : dateStr).trim());
  if (!m) {
    throw new Error('日期格式无效：' + dateStr + '（需要 YYYY-MM-DD）');
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1; // JS 月份 0-11
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  // 回读校验，挡掉 2026-13-01 / 2026-02-30 这类不存在的日期
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) {
    throw new Error('日期不存在：' + dateStr);
  }
  return dt.getTime();
}

// 结束日当天 23:59:59.999 → 用「次日零点」表示，跨夏令时也正确（直接 +24h 会差一小时）
function endOfDayMs(dateStr) {
  const dt = new Date(parseLocalDate(dateStr));
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1).getTime();
}

function clampInt(value, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

async function readHistory(options) {
  options = options || {};

  const limit = clampInt(options.limit, 1, MAX_LIMIT, DEFAULT_LIMIT);

  // 先校验时间范围（纯计算，不碰磁盘）：非法参数不必等到加载 WASM 之后才报错
  const now = Date.now();
  let startMs, endMs;

  if (options.startDate && options.endDate) {
    startMs = parseLocalDate(options.startDate);
    endMs = endOfDayMs(options.endDate);
    if (endMs <= startMs) {
      throw new Error('结束日期不能早于开始日期：' + options.startDate + ' ~ ' + options.endDate);
    }
  } else {
    const days = clampInt(options.days, 1, MAX_DAYS, DEFAULT_DAYS);
    startMs = now - days * 24 * 60 * 60 * 1000;
    endMs = now;
  }

  const Mod = await ensureSQL();
  const historyPath = findHistoryFile();

  if (!historyPath) {
    const err = new Error(
      '找不到浏览器历史记录文件。\n' +
      '请确保：\n' +
      '  1. 已安装 Google Chrome、Microsoft Edge 或 Chromium\n' +
      '  2. 使用的是默认用户配置（Default / Profile 1…）\n' +
      '  3. 或者使用页面上的上传功能导入 JSON 文件'
    );
    err.code = 'NO_HISTORY_FILE'; // 服务器据此返回 404 而不是 500
    throw err;
  }

  const browserName = getBrowserName(historyPath);

  // 转换为 Chromium 时间戳（微秒 since 1601-01-01）
  const startChromium = Math.floor(startMs / 1000 + CHROMIUM_EPOCH_OFFSET_SEC) * 1000000;
  const endChromium = Math.floor(endMs / 1000 + CHROMIUM_EPOCH_OFFSET_SEC) * 1000000;

  // 复制到临时目录（浏览器可能正在占用该文件）
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-'));
  const tmpHistory = path.join(tmpDir, 'History');
  let db = null;

  try {
    fs.copyFileSync(historyPath, tmpHistory);

    // 复制 WAL / SHM / 回滚日志（Chromium 系浏览器使用 WAL 模式）
    for (const suffix of ['-wal', '-shm', '-journal']) {
      const src = historyPath + suffix;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, tmpHistory + suffix);
      }
    }

    // 读取文件 → sql.js。用 Buffer 上的视图而不是 new Uint8Array(buffer)：
    // 后者会再复制一整份数据库，几十 MB 的历史库白占一份内存。
    const fileBuffer = fs.readFileSync(tmpHistory);
    const bytes = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
    db = new Mod.Database(bytes);

    const sql = [
      'SELECT',
      '  u.url,',
      '  u.title,',
      '  v.visit_time,',
      '  (v.visit_time / 1000000 - ' + CHROMIUM_EPOCH_OFFSET_SEC + ') AS unix_time',
      'FROM visits v',
      'JOIN urls u ON v.url = u.id',
      'WHERE v.visit_time > ? AND v.visit_time <= ?',
      'ORDER BY v.visit_time DESC',
      'LIMIT ?'
    ].join('\n');

    const result = db.exec(sql, [startChromium, endChromium, limit]);

    if (!result.length) {
      return {
        visits: [],
        timeRange: { startMs: startMs, endMs: endMs, truncated: false },
        source: browserName,
      };
    }

    const columns = result[0].columns;
    const values = result[0].values;

    const visits = values.map(function(row) {
      const obj = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = row[i];
      }
      return {
        url: obj.url,
        title: obj.title || '(无标题)',
        visitTime: Math.floor(obj.unix_time * 1000),
      };
    }).reverse(); // 最老在前

    return {
      visits: visits,
      // truncated：命中了 LIMIT，说明这个时间段还有更多记录没被读取
      timeRange: { startMs: startMs, endMs: endMs, truncated: values.length >= limit },
      source: browserName,
    };
  } finally {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

// 把上传的数据归一化为 { visits, timeRange, skipped }
// 支持：裸数组、{ visits: [...] }、{ visits: [...], timeRange: { startMs, endMs } }
function parseUpload(input, timeRangeOverride) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;

  if (data === null || data === undefined) {
    throw new Error('JSON 内容为空');
  }

  const raw = Array.isArray(data) ? data : data.visits;
  if (!Array.isArray(raw)) {
    throw new Error('JSON 格式错误：需要一个访问记录数组');
  }
  if (raw.length > MAX_UPLOAD_VISITS) {
    throw new Error('记录条数超过上限（最多 ' + MAX_UPLOAD_VISITS + ' 条）');
  }

  const visits = [];
  let skipped = 0;

  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skipped++;
      continue;
    }
    const rawTime = item.visitTime !== undefined ? item.visitTime
      : item.time !== undefined ? item.time
      : item.timestamp;
    const visitTime = toTimestamp(rawTime);
    if (visitTime === null) {
      skipped++; // 没有可用的时间戳：丢掉，而不是编造一个「现在」
      continue;
    }
    visits.push({
      url: typeof item.url === 'string' && item.url ? item.url : 'about:blank',
      title: typeof item.title === 'string' && item.title ? item.title : '(无标题)',
      visitTime: visitTime,
    });
  }

  if (raw.length > 0 && visits.length === 0) {
    throw new Error('JSON 中没有可用的时间戳（visitTime 需要毫秒时间戳）');
  }

  visits.sort(function(a, b) { return a.visitTime - b.visitTime; });

  let timeRange = null;
  const candidate = timeRangeOverride || (Array.isArray(data) ? null : data.timeRange);
  if (candidate && Number.isFinite(Number(candidate.startMs)) && Number.isFinite(Number(candidate.endMs))) {
    timeRange = { startMs: Number(candidate.startMs), endMs: Number(candidate.endMs) };
  }

  return { visits: visits, timeRange: timeRange, skipped: skipped };
}

// 时间戳归一化：毫秒数、数字字符串、可被 Date 解析的字符串都接受
function toTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

module.exports = {
  readHistory,
  parseUpload,
  parseLocalDate,
  endOfDayMs,
  getBrowserHistoryPaths,
  getBrowserDataRoots,
  findHistoryFile,
  getBrowserName,
  DEFAULT_DAYS,
  DEFAULT_LIMIT,
  MAX_DAYS,
  MAX_LIMIT,
  MAX_UPLOAD_VISITS,
};
