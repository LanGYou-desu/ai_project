const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { resolveInWorkspace } = require('../workspace-security.js');

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
