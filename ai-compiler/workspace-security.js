const path = require('path');

// 把相对路径 rel 解析到工作区根 root 内；越界返回 null
function resolveInWorkspace(root, rel) {
  if (typeof root !== 'string' || typeof rel !== 'string') return null;
  const rootAbs = path.resolve(root);
  const relAbs = path.resolve(rootAbs, rel);
  if (relAbs !== rootAbs && !relAbs.startsWith(rootAbs + path.sep)) return null;
  return relAbs;
}

module.exports = { resolveInWorkspace };
