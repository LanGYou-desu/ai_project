const fs = require('fs');
const path = require('path');

// 把相对路径 rel 解析到工作区根 root 内；越界返回 null
// 注意：这是纯字符串（词法）判断，不解析符号链接——真实文件操作请用 resolveInWorkspaceReal
function resolveInWorkspace(root, rel) {
  if (typeof root !== 'string' || typeof rel !== 'string') return null;
  const rootAbs = path.resolve(root);
  const relAbs = path.resolve(rootAbs, rel);
  if (relAbs !== rootAbs && !relAbs.startsWith(rootAbs + path.sep)) return null;
  return relAbs;
}

// target 是否位于 root 内（Windows 下路径大小写不敏感）
function isInsideRoot(rootAbs, targetAbs) {
  if (typeof rootAbs !== 'string' || typeof targetAbs !== 'string') return false;
  let a = path.resolve(rootAbs);
  let b = path.resolve(targetAbs);
  if (process.platform === 'win32') { a = a.toLowerCase(); b = b.toLowerCase(); }
  return b === a || b.startsWith(a + path.sep);
}

// 对目标路径做 realpath：目标可能还不存在，因此取「最长的已存在前缀」解析后拼回剩余部分
function realpathDeep(target) {
  let cur = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native ? fs.realpathSync.native(cur) : fs.realpathSync(cur);
      return rest.length ? path.join(real, ...rest.reverse()) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return null;
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

// 词法校验 + realpath 校验：拒绝通过符号链接 / 目录联接（junction）逃出工作区
// 越界或无法解析返回 null；合法时返回词法路径（保持用户可见的相对路径语义）
function resolveInWorkspaceReal(root, rel) {
  const lexical = resolveInWorkspace(root, rel);
  if (!lexical) return null;
  // 根目录必须真实存在，否则无从判断边界
  let realRoot;
  try {
    realRoot = fs.realpathSync.native ? fs.realpathSync.native(root) : fs.realpathSync(root);
  } catch { return null; }
  const realTarget = realpathDeep(lexical);
  if (!realTarget) return null;
  if (!isInsideRoot(realRoot, realTarget)) return null;
  return lexical;
}

module.exports = { resolveInWorkspace, resolveInWorkspaceReal, isInsideRoot, realpathDeep };
