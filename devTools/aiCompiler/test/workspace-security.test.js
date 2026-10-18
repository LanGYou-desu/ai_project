const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveInWorkspace, resolveInWorkspaceReal } = require('../workspace-security.js');

test('resolveInWorkspace 根内相对路径通过', () => {
  const root = path.resolve(path.sep, 'ws-test');
  const r = resolveInWorkspace(root, 'src/main.py');
  assert.strictEqual(r, path.join(root, 'src', 'main.py'));
});

test('resolveInWorkspace 拒绝目录穿越', () => {
  const root = path.resolve(path.sep, 'ws-test');
  assert.strictEqual(resolveInWorkspace(root, '../etc/passwd'), null);
  assert.strictEqual(resolveInWorkspace(root, 'a/../../etc/passwd'), null);
  assert.strictEqual(resolveInWorkspace(root, '..\\evil'), null);
});

test('resolveInWorkspace 拒绝根外的绝对路径', () => {
  const root = path.resolve(path.sep, 'ws-test');
  assert.strictEqual(resolveInWorkspace(root, path.join(path.sep, 'etc', 'passwd')), null);
});

test('resolveInWorkspace 空 rel 返回根', () => {
  const root = path.resolve(path.sep, 'ws-test');
  assert.strictEqual(resolveInWorkspace(root, ''), root);
});

test('resolveInWorkspace 非字符串参数返回 null', () => {
  const root = path.resolve(path.sep, 'ws-test');
  assert.strictEqual(resolveInWorkspace(root, 123), null);
  assert.strictEqual(resolveInWorkspace(null, 'a'), null);
});

// —— realpath 校验：符号链接 / 目录联接（junction）逃逸 ——

test('resolveInWorkspaceReal 允许工作区内的真实路径与尚不存在的文件', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-real-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ws = path.join(dir, 'ws');
  fs.mkdirSync(path.join(ws, 'src'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'src', 'main.py'), 'print(1)');

  assert.strictEqual(resolveInWorkspaceReal(ws, 'src/main.py'), path.join(ws, 'src', 'main.py'));
  // 目标还不存在：以已存在的父目录做 realpath 判断
  assert.strictEqual(resolveInWorkspaceReal(ws, 'src/new-file.py'), path.join(ws, 'src', 'new-file.py'));
  assert.strictEqual(resolveInWorkspaceReal(ws, ''), ws);
  // 词法越界依然被拒
  assert.strictEqual(resolveInWorkspaceReal(ws, '../outside.txt'), null);
});

test('resolveInWorkspaceReal 拒绝指向工作区外的目录联接', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-link-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outside = path.join(dir, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'SECRET');
  const ws = path.join(dir, 'ws');
  fs.mkdirSync(ws);
  try {
    // Windows 上创建目录联接不需要管理员权限；符号链接需要开发者模式
    fs.symlinkSync(outside, path.join(ws, 'link'), 'junction');
  } catch (err) {
    t.skip(`当前环境无法创建符号链接/联接：${err.code || err.message}`);
    return;
  }
  assert.strictEqual(resolveInWorkspaceReal(ws, 'link'), null);
  assert.strictEqual(resolveInWorkspaceReal(ws, 'link/secret.txt'), null);
});

test('resolveInWorkspaceReal 根目录不存在时返回 null', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-missing-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.strictEqual(resolveInWorkspaceReal(path.join(dir, 'nope'), 'a.txt'), null);
});
