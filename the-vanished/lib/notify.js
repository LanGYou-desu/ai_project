'use strict';
// 调用真实 Windows 通知（Toast / 消息框）
// 安全说明：参数以 base64 传入 PowerShell，通知正文永远不会进入命令行解析
//（spawn 参数数组 + base64 双保险），因此引号 / 换行 / ; & ` $ 等字符既不会被改写，
// 也不可能被当成 PowerShell 语句执行。
const { spawn } = require('child_process');
const path = require('path');

const PS1 = path.join(__dirname, '..', 'notify.ps1');
const THROTTLE_MS = 1500;          // 节流：短时间内只发一条，避免刷屏
const MAX_INFLIGHT = 3;            // 同时最多 3 个 PowerShell 进程
const DEFAULT_TIMEOUT_MS = 30000;  // 超时后杀掉卡住的进程（消息框回退会阻塞）

let enabled = process.env.VANISHED_NO_NOTIFY !== '1';
let lastAt = 0;
let inflight = 0;
let warnedUnsupported = false;
let warnedFailure = false;

function isSupported() { return process.platform === 'win32'; }
function isEnabled() { return enabled; }
function setEnabled(v) { enabled = !!v; }
function resetThrottle() { lastAt = 0; }
function inflightCount() { return inflight; }

function encode(s) {
  return Buffer.from(s === null || s === undefined ? '' : String(s), 'utf8').toString('base64');
}

// 通知内容只以 base64 形式出现在 argv 中
function buildArgs(title, text) {
  return [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', PS1,
    '-TitleB64', encode(title),
    '-TextB64', encode(text)
  ];
}

function notifyTimeoutMs() {
  const n = Number(process.env.VANISHED_NOTIFY_TIMEOUT_MS);
  return isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function notify(title, text) {
  if (!enabled) return false;
  if (!isSupported()) {
    if (!warnedUnsupported) {
      warnedUnsupported = true;
      console.warn('[notify] 当前平台（' + process.platform + '）不支持 Windows Toast，系统通知已禁用；界面内仍会显示通知记录。');
    }
    return false;
  }
  const now = Date.now();
  if (now - lastAt < THROTTLE_MS) return false;
  if (inflight >= MAX_INFLIGHT) return false;
  lastAt = now;
  inflight++;
  let child;
  try {
    child = spawn('powershell', buildArgs(title, text), {
      stdio: 'ignore',
      windowsHide: true   // 不弹出 PowerShell 控制台窗口
    });
  } catch (e) {
    inflight--;
    return false;
  }
  let settled = false;
  let timer = null;
  const finish = function () {
    if (settled) return;
    settled = true;
    inflight--;
    if (timer) clearTimeout(timer);
  };
  timer = setTimeout(function () {
    try { child.kill(); } catch (e) { /* 忽略 */ }
    finish();
  }, notifyTimeoutMs());
  if (timer.unref) timer.unref();
  child.on('error', function (e) {
    finish();
    if (!warnedFailure) {
      warnedFailure = true;
      console.warn('[notify] 无法启动 PowerShell：' + e.message + '（后续通知失败不再重复提示）');
    }
  });
  child.on('exit', finish);
  // 不阻塞 Node 退出：服务器关闭后通知进程自行结束
  if (child.unref) child.unref();
  return true;
}

module.exports = { notify, setEnabled, isEnabled, isSupported, buildArgs, encode, resetThrottle, inflightCount, THROTTLE_MS };
