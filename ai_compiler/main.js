const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { createApp, loadConfig } = require('./server');
const { resolveInWorkspace } = require('./workspace-security');
require('dotenv').config();

let server = null;
let win = null;
let workspaceRoot = null;
const stateFile = () => path.join(app.getPath('userData'), 'workspace.json');
function loadWorkspaceState() {
  try {
    const d = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (d.root && fs.existsSync(d.root) && fs.statSync(d.root).isDirectory()) workspaceRoot = d.root;
  } catch { /* 无状态，忽略 */ }
}
function saveWorkspaceState() {
  try { fs.writeFileSync(stateFile(), JSON.stringify({ root: workspaceRoot }, null, 2)); } catch { /* 忽略 */ }
}
function isTrustedSender(event) {
  if (!win || event.sender !== win.webContents || !event.senderFrame) return false;
  try {
    const url = new URL(event.senderFrame.url);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch { return false; }
}
function registerFsHandlers() {
  ipcMain.handle('fs:open-folder', async (event) => {
    if (!isTrustedSender(event)) return { ok: false, error: '非法调用' };
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    workspaceRoot = r.filePaths[0];
    saveWorkspaceState();
    return { ok: true, root: workspaceRoot };
  });
  ipcMain.handle('fs:get-workspace', (event) => {
    if (!isTrustedSender(event)) return { ok: false, error: '非法调用' };
    return { ok: true, root: workspaceRoot };
  });
  ipcMain.handle('fs:list-dir', (e, rel) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    const p = resolveInWorkspace(workspaceRoot, rel || '');
    if (!p) return { ok: false, error: '非法路径' };
    try {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      return { ok: true, entries: entries.map((d) => ({ name: d.name, isDir: d.isDirectory() })) };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('fs:read-file', (e, rel) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    const p = resolveInWorkspace(workspaceRoot, rel || '');
    if (!p) return { ok: false, error: '非法路径' };
    try { return { ok: true, content: fs.readFileSync(p, 'utf8') }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('fs:write-file', (e, rel, content) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    const p = resolveInWorkspace(workspaceRoot, rel || '');
    if (!p) return { ok: false, error: '非法路径' };
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content, 'utf8');
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('fs:create-file', (e, rel) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    const p = resolveInWorkspace(workspaceRoot, rel || '');
    if (!p) return { ok: false, error: '非法路径' };
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, '', 'utf8');
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('fs:delete-file', (e, rel) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    const p = resolveInWorkspace(workspaceRoot, rel || '');
    if (!p) return { ok: false, error: '非法路径' };
    try { fs.unlinkSync(p); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('fs:rename', (e, rel, newName) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    if (typeof newName !== 'string' || !newName.trim() || newName.includes('/') || newName.includes('\\') || newName === '.' || newName === '..') {
      return { ok: false, error: '非法名称' };
    }
    const from = resolveInWorkspace(workspaceRoot, rel || '');
    const to = resolveInWorkspace(workspaceRoot, path.join(path.dirname(rel || ''), newName.trim()));
    if (!from || !to) return { ok: false, error: '非法路径' };
    try { fs.renameSync(from, to); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('fs:create-dir', (e, rel) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    const p = resolveInWorkspace(workspaceRoot, rel || '');
    if (!p) return { ok: false, error: '非法路径' };
    try { fs.mkdirSync(p, { recursive: true }); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('fs:delete-dir', (e, rel) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    if (!workspaceRoot) return { ok: false, error: '尚未打开工作区' };
    const p = resolveInWorkspace(workspaceRoot, rel || '');
    if (!p || p === workspaceRoot) return { ok: false, error: '非法路径' };
    try { fs.rmSync(p, { recursive: true, force: true }); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('shell:open-external', (e, url) => {
    if (!isTrustedSender(e)) return { ok: false, error: '非法调用' };
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: '仅支持 http/https 链接' };
      shell.openExternal(u.toString());
      return { ok: true };
    } catch { return { ok: false, error: '非法链接' }; }
  });
}

function startServer() {
  const configPath = app.isPackaged
    ? path.join(app.getPath('userData'), 'config.json')
    : path.join(__dirname, 'config.json');
  const config = loadConfig(configPath);
  const appInstance = createApp(config, { configPath });
  return new Promise((resolve, reject) => {
    const tryListen = (port, attempts) => {
      const srv = appInstance.listen(port, '127.0.0.1', () => {
        console.log(`AI 编译器后端已启动：http://127.0.0.1:${port}`);
        resolve({ srv, port });
      });
      srv.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempts > 0) {
          tryListen(port + 1, attempts - 1);
        } else {
          reject(err);
        }
      });
    };
    tryListen(config.port || 3000, 5);
  });
}

app.whenReady().then(async () => {
  try {
    loadWorkspaceState();
    registerFsHandlers();
    const { srv, port } = await startServer();
    server = srv;
    win = new BrowserWindow({
      width: 1280,
      height: 820,
      title: 'AI 编译器',
      backgroundColor: '#1e1e1e',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e, url) => {
      try {
        const host = new URL(url).hostname;
        if (host !== '127.0.0.1' && host !== 'localhost') e.preventDefault();
      } catch { e.preventDefault(); }
    });
    // Ctrl+W：阻止默认菜单的「关闭窗口」，交给渲染层（有打开的 tab 时关闭 tab，无 tab 时再关窗）
    win.webContents.on('before-input-event', (event, input) => {
      if (
        input.type === 'keyDown' &&
        (input.control || input.meta) && !input.alt && !input.shift &&
        (input.key === 'w' || input.key === 'W')
      ) {
        event.preventDefault();
        win.webContents.send('app:ctrl-w');
      }
    });
    win.loadURL(`http://127.0.0.1:${port}`);
    win.on('closed', () => { win = null; });
  } catch (err) {
    console.error('AI 编译器启动失败：', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
