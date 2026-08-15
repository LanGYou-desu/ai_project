'use strict';
// 调用真实 Windows 通知（Toast / 消息框）
const { spawn } = require('child_process');
const path = require('path');

const PS1 = path.join(__dirname, '..', 'notify.ps1');
let enabled = true;
let lastAt = 0;

function setEnabled(v) { enabled = !!v; }

function notify(title, text) {
  if (!enabled) return false;
  // 节流：同一秒内只发一条，避免刷屏
  const now = Date.now();
  if (now - lastAt < 1500) return false;
  lastAt = now;
  try {
    const child = spawn('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', PS1, '-Title', String(title), '-Text', String(text)
    ], { detached: false, stdio: 'ignore' });
    child.on('error', () => {});
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { notify, setEnabled };
