'use strict';

// ── 浏览器历史读取器 ──
// 支持 Chrome 和 Edge（均为 Chromium 内核，数据库结构相同）。
// 使用 sql.js（纯 JavaScript SQLite，无需原生编译）。

const fs = require('fs');
const path = require('path');
const os = require('os');

// 异步加载 sql.js
let SQL = null;
function ensureSQL() {
  if (SQL) return Promise.resolve(SQL);
  return new Promise(function(resolve, reject) {
    const sqlJs = require('sql.js');
    sqlJs().then(function(mod) {
      SQL = mod;
      resolve(SQL);
    }).catch(reject);
  });
}

// ── 公共 API ──

function getLocalAppData() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
}

// 返回所有可用的浏览器历史路径，按优先级排列
function getBrowserHistoryPaths() {
  const local = getLocalAppData();
  return [
    // Chrome
    path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'History'),
    // Edge
    path.join(local, 'Microsoft', 'Edge', 'User Data', 'Default', 'History'),
    // Edge (旧版 profile 路径)
    path.join(local, 'Microsoft', 'Edge', 'User Data', 'Profile 1', 'History'),
  ];
}

function findHistoryFile() {
  const paths = getBrowserHistoryPaths();
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getBrowserName(historyPath) {
  if (historyPath.includes('Microsoft\\Edge')) return 'Microsoft Edge';
  if (historyPath.includes('Google\\Chrome')) return 'Google Chrome';
  return '浏览器';
}

async function readHistory(options = {}) {
  const Mod = await ensureSQL();
  const historyPath = findHistoryFile();

  if (!historyPath) {
    throw new Error(
      '找不到浏览器历史记录文件。\n' +
      '请确保：\n' +
      '  1. 已安装 Google Chrome 或 Microsoft Edge\n' +
      '  2. 使用的是默认用户配置（Default / Profile 1）\n' +
      '  3. 或者使用页面上的上传功能导入 JSON 文件'
    );
  }

  const browserName = getBrowserName(historyPath);
  const limit = options.limit || 500;

  // 计算时间范围
  const now = Date.now();
  let startMs, endMs;

  if (options.startDate && options.endDate) {
    // 自定义日期范围 — 按本地时间解析，避免 UTC 偏移
    startMs = parseLocalDate(options.startDate);
    endMs = parseLocalDate(options.endDate) + 24 * 60 * 60 * 1000; // 包含结束日全天
  } else {
    // 最近 N 天（默认 7 天）
    const days = options.days || 7;
    startMs = now - days * 24 * 60 * 60 * 1000;
    endMs = now;
  }

  // 转换为 Chromium 时间戳（微秒 since 1601-01-01）
  const startChromium = Math.floor(startMs / 1000 + 11644473600) * 1000000;
  const endChromium = Math.floor(endMs / 1000 + 11644473600) * 1000000;

  // 复制到临时目录（浏览器可能正在占用该文件）
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-'));
  const tmpHistory = path.join(tmpDir, 'History');

  try {
    fs.copyFileSync(historyPath, tmpHistory);

    // 复制 WAL / SHM 文件（Chromium 系浏览器使用 WAL 模式）
    for (const suffix of ['-wal', '-shm']) {
      const src = historyPath + suffix;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(tmpDir, 'History' + suffix));
      }
    }

    // 读取文件为 ArrayBuffer，用 sql.js 打开
    const fileBuffer = fs.readFileSync(tmpHistory);
    const db = new Mod.Database(new Uint8Array(fileBuffer));

    const sql = [
      'SELECT',
      '  u.url,',
      '  u.title,',
      '  v.visit_time,',
      '  (v.visit_time / 1000000 - 11644473600) AS unix_time',
      'FROM visits v',
      'JOIN urls u ON v.url = u.id',
      'WHERE v.visit_time > ? AND v.visit_time <= ?',
      'ORDER BY v.visit_time DESC',
      'LIMIT ?'
    ].join('\n');

    const result = db.exec(sql, [startChromium, endChromium, limit]);
    db.close();

    if (!result.length) {
      return { visits: [], timeRange: { startMs, endMs } };
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

    return { visits, timeRange: { startMs, endMs } };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

// 按本地时间解析日期字符串 "YYYY-MM-DD"，避免 new Date(str) 的 UTC 偏移
function parseLocalDate(dateStr) {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // JS 月份 0-11
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d).getTime();
}

function parseUpload(body, timeRange) {
  const data = JSON.parse(body);
  const visits = data.visits || data;
  if (!Array.isArray(visits)) {
    throw new Error('JSON 格式错误：需要数组');
  }
  return {
    visits: visits.map(function(v) {
      return {
        url: v.url || 'about:blank',
        title: v.title || '(无标题)',
        visitTime: v.visitTime || v.time || v.timestamp || Date.now(),
      };
    }),
    timeRange: timeRange || null,
  };
}

module.exports = { readHistory, getBrowserHistoryPaths, findHistoryFile, getBrowserName, parseUpload };