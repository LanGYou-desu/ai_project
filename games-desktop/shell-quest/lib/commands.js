'use strict';
// ============================================================
// 档案馆-7 · 真实命令引擎
// 在真实沙盒目录上执行一组受限的读取类命令。
// 安全性：
//   - 命令白名单、无 shell 解释、禁用 shell 元字符；
//   - 路径同时做词法边界 + realpath 边界检查（挡符号链接/junction 逃逸）；
//   - 递归遍历不跟随符号链接；
//   - 读取 / 输出 / 遍历 / 执行时间均有硬上限；
//   - 唯一的写入命令 untar 只允许写入沙盒内，且拒绝覆盖已有文件。
// ============================================================
const fs = require('fs');
const path = require('path');
const cryptoUtils = require('./crypto-utils');
const { makeRootGuard, hasDeviceComponent } = require('./paths');

const COMMANDS = new Set([
  'help','pwd','cd','ls','tree','cat','type','head','tail','find',
  'grep','wc','sort','strings','xxd','hex','unhex','base64','rot13',
  'caesar','xor','stat','file','echo','untar','flag','hint','history','clear'
]);

const FORBIDDEN_CHARS = ';&<>`$(){}=%:';
const BACKSLASH = String.fromCharCode(92);
const NUL = String.fromCharCode(0);

const MAX_STAGES = 8;
const MAX_OUTPUT = 1024 * 1024;
const MAX_FIND = 2000;
const MAX_TREE = 800;
const MAX_LIST = 5000;
const MAX_MATCHES = 5000;
const MAX_HISTORY = 200;
const MAX_TEXT_READ = 4 * 1024 * 1024;
const MAX_ARCHIVE_READ = 16 * 1024 * 1024;
const MAX_UNTAR_ENTRIES = 500;
const MAX_UNTAR_TOTAL = 32 * 1024 * 1024;
const MAX_EXEC_MS = 5000;

function hasForbidden(s) {
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (FORBIDDEN_CHARS.indexOf(ch) >= 0 || ch === BACKSLASH || ch === NUL) return true;
  }
  return false;
}

function tokenize(line) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|([^\s"'|]+)|(\|)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else if (m[2] !== undefined) tokens.push(m[2]);
    else if (m[3] !== undefined) tokens.push(m[3]);
    else tokens.push('|');
  }
  return { tokens };
}

function createSession(opts) {
  if (!opts || typeof opts.root !== 'string' || opts.root.length === 0) {
    throw new Error('createSession：缺少 root');
  }
  const root = path.resolve(opts.root);
  const guard = makeRootGuard(root);
  const checkFlag = opts.checkFlag || function () { return { ok: false, message: 'flag 系统未初始化' }; };
  const getHint = opts.getHint || function () { return '（无提示）'; };
  const state = { cwd: root, history: [] };
  let deadline = 0;

  function timeUp() { return deadline !== 0 && Date.now() > deadline; }
  function fail(msg) { return { code: 1, output: msg + '\n' }; }

  function relCwd() {
    const r = path.relative(root, state.cwd);
    return r === '' ? '/' : '/' + r.split(BACKSLASH).join('/');
  }

  function resolveArg(arg, base) { return guard.resolve(arg, base || state.cwd); }

  function statSafe(abs) { try { return fs.statSync(abs); } catch (e) { return null; } }
  function lstatSafe(abs) { try { return fs.lstatSync(abs); } catch (e) { return null; } }
  function isDir(abs) { const st = statSafe(abs); return !!st && st.isDirectory(); }

  function readBuffer(abs, maxBytes) {
    const limit = maxBytes || MAX_TEXT_READ;
    let fd = null;
    try {
      fd = fs.openSync(abs, 'r');
      const st = fs.fstatSync(fd);
      if (st.isDirectory()) return { error: '是目录' };
      if (!st.isFile()) return { error: '不是普通文件' };
      if (st.size > limit) return { error: '文件过大（' + st.size + ' 字节，上限 ' + limit + '）' };
      const len = Math.min(st.size, limit);
      const buf = Buffer.alloc(len);
      let off = 0;
      while (off < len) {
        const n = fs.readSync(fd, buf, off, len - off, off);
        if (n <= 0) break;
        off += n;
      }
      return { buf: off === len ? buf : buf.subarray(0, off), size: st.size };
    } catch (e) {
      return { error: '无法读取（' + (e.code || e.message) + '）' };
    } finally {
      if (fd !== null) { try { fs.closeSync(fd); } catch (e) { /* 忽略 */ } }
    }
  }

  // 只读文件开头 maxBytes 字节：xxd / file 不需要把整个文件读进内存。
  function readPrefix(abs, maxBytes) {
    let fd = null;
    try {
      fd = fs.openSync(abs, 'r');
      const st = fs.fstatSync(fd);
      if (st.isDirectory()) return { error: '是目录' };
      if (!st.isFile()) return { error: '不是普通文件' };
      const len = Math.min(st.size, maxBytes);
      const buf = Buffer.alloc(len);
      let off = 0;
      while (off < len) {
        const n = fs.readSync(fd, buf, off, len - off, off);
        if (n <= 0) break;
        off += n;
      }
      return { buf: off === len ? buf : buf.subarray(0, off), size: st.size, truncated: st.size > len };
    } catch (e) {
      return { error: '无法读取（' + (e.code || e.message) + '）' };
    } finally {
      if (fd !== null) { try { fs.closeSync(fd); } catch (e) { /* 忽略 */ } }
    }
  }

  function readText(abs, maxBytes) {
    const r = readBuffer(abs, maxBytes);
    if (r.error) return r;
    return { text: r.buf.toString('utf8'), buf: r.buf, size: r.size };
  }

  function isBinary(buf) {
    const sample = buf.subarray(0, Math.min(buf.length, 2048));
    let bad = 0;
    for (const b of sample) {
      if (b === 0 || (b < 9) || (b > 13 && b < 32 && b !== 27)) bad++;
    }
    return sample.length > 0 && bad / sample.length > 0.1;
  }

  function readableText(buf, size) {
    if (isBinary(buf)) return '（二进制文件 ' + size + ' 字节，试试 strings / xxd / xor）\n';
    return buf.toString('utf8');
  }

  function listDir(abs) {
    try {
      // 先一次性取 stat，再排序；避免比较函数里反复 stat（大目录下是 O(n log n) 次系统调用）。
      const names = fs.readdirSync(abs);
      const info = new Map();
      for (const name of names) {
        const st = lstatSafe(path.join(abs, name));
        info.set(name, { isDir: !!st && st.isDirectory() && !st.isSymbolicLink() });
      }
      names.sort(function (a, b) {
        const da = info.get(a).isDir;
        const db = info.get(b).isDir;
        if (da !== db) return da ? -1 : 1;
        return a.localeCompare(b, 'zh');
      });
      return names;
    } catch (e) { return null; }
  }


  function h_help() {
    return { code: 0, output: [
      '档案馆-7 · 命令手册',
      '  pwd                     显示当前目录',
      '  cd <目录>                切换目录',
      '  ls [目录] [-l]           列出文件（-l 显示大小）',
      '  tree [目录]              递归显示目录树（不跟随符号链接）',
      '  cat <文件...>            查看文件内容（可多文件；无参数时读管道）',
      '  head <文件> [行数]        查看开头 N 行',
      '  tail <文件> [行数]        查看结尾 N 行',
      '  find <目录> [-name] <模式> 递归查找（支持 * 通配）',
      '  grep <模式> [文件|目录]    按字面文本搜索（-i 忽略大小写，-n 显示行号）',
      '  wc [文件]                统计行/词/字节',
      '  sort [文件] [-n]         排序行（-n 按数字）',
      '  strings <文件>           提取可打印字符串',
      '  xxd <文件>               十六进制转储（最多 1024 字节）',
      '  unhex <文件>             十六进制文本还原为原文',
      '  base64 [-e|-d] [文件]     编码/解码（无文件时读管道）',
      '  rot13 [文件]             旧式便签解码',
      '  caesar <文件> <移位>      凯撒移位',
      '  xor <文件> <密钥>         XOR 解密',
      '  stat <文件>              文件信息',
      '  file <文件>              猜测文件类型',
      '  echo <文本...>           输出文本',
      '  untar <压缩包> <目录>      解压 tar 包（仅写入沙盒内，不覆盖已有文件）',
      '  flag <答案>              提交谜题答案',
      '  hint                    获取当前幕提示',
      '  history                 查看命令历史（最多 200 条）',
      '  clear                   清屏（客户端处理）'
    ].join('\n') + '\n' };
  }

  function h_pwd() { return { code: 0, output: relCwd() + '\n' }; }

  function h_cd(args) {
    const target = args.length ? resolveArg(args[0]) : root;
    if (target === null) return fail('cd：路径不允许（只能访问沙盒内）');
    if (!isDir(target)) return fail('cd：目录不存在：' + args[0]);
    state.cwd = target;
    return { code: 0, output: '' };
  }

  function h_ls(args) {
    let showSize = false;
    const rest = args.filter(a => { if (a === '-l') { showSize = true; return false; } return true; });
    const dir = rest.length ? resolveArg(rest[0]) : state.cwd;
    if (dir === null) return fail('ls：路径不允许');
    const st = statSafe(dir);
    if (!st || !st.isDirectory()) return fail('ls：不是目录：' + (rest[0] || ''));
    const names = listDir(dir);
    if (names === null) return fail('ls：无法读取目录');
    const shown = names.slice(0, MAX_LIST);
    const lines = [];
    for (const n of shown) {
      const abs = path.join(dir, n);
      const lst = lstatSafe(abs);
      const isLink = !!lst && lst.isSymbolicLink();
      const d = !!lst && lst.isDirectory() && !isLink;
      const suffix = isLink ? '@' : (d ? '/' : '');
      if (showSize) {
        lines.push((d ? 'd' : '-') + '  ' + String(lst ? lst.size : 0).padStart(10) + '  ' + n + suffix);
      } else {
        lines.push(n + suffix);
      }
    }
    if (names.length > MAX_LIST) lines.push('…（还有 ' + (names.length - MAX_LIST) + ' 项未显示）');
    return { code: 0, output: lines.length ? lines.join('\n') + '\n' : '（空目录）\n' };
  }

  function h_tree(args) {
    const dir = args.length ? resolveArg(args[0]) : state.cwd;
    if (dir === null) return fail('tree：路径不允许');
    const st = statSafe(dir);
    if (!st || !st.isDirectory()) return fail('tree：不是目录');
    const lines = [];
    let count = 0;
    let timedOut = false;
    (function walk(abs, prefix, depth) {
      if (timedOut || count > MAX_TREE || depth > 8) return;
      if (timeUp()) { timedOut = true; return; }
      const names = listDir(abs) || [];
      for (let i = 0; i < names.length; i++) {
        if (timedOut || count > MAX_TREE) return;
        const n = names[i];
        const child = path.join(abs, n);
        const cst = lstatSafe(child);
        if (!cst) continue;
        const last = i === names.length - 1;
        const isLink = cst.isSymbolicLink();
        const isDirChild = cst.isDirectory() && !isLink;
        const safeDir = isDirChild && guard.contains(child);
        lines.push(prefix + (last ? '└─ ' : '├─ ') + n + ((isLink || (isDirChild && !safeDir)) ? '@' : (isDirChild ? '/' : '')));
        count++;
        if (safeDir) walk(child, prefix + (last ? '   ' : '│  '), depth + 1);
      }
    })(dir, '', 0);
    if (timedOut) lines.push('…（目录过大，已截断）');
    return { code: 0, output: lines.join('\n') + (lines.length ? '\n' : '') };
  }

  function h_cat(args, stdinBuf) {
    if (args.length === 0) {
      if (!stdinBuf) return fail('cat：缺少文件参数（可配合管道使用）');
      return { code: 0, output: stdinBuf.toString('utf8') };
    }
    const chunks = [];
    for (const a of args) {
      const abs = resolveArg(a);
      if (abs === null) return fail('cat：路径不允许：' + a);
      const st = statSafe(abs);
      if (!st) return fail('cat：文件不存在：' + a);
      if (st.isDirectory()) return fail('cat：' + a + ' 是目录');
      const rb = readBuffer(abs, MAX_TEXT_READ);
      if (rb.error) return fail('cat：无法读取：' + a + '（' + rb.error + '）');
      chunks.push(readableText(rb.buf, rb.size));
    }
    return { code: 0, output: chunks.join('') };
  }

  function h_head(args, stdinBuf) {
    let n = 10;
    let file = null;
    if (args.length && /^\d+$/.test(args[args.length - 1])) {
      if (args.length >= 2) file = args[0];
      n = parseInt(args.pop(), 10);
    } else if (args.length) {
      file = args[0];
    }
    let text;
    if (file) {
      const abs = resolveArg(file);
      if (abs === null) return fail('head：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('head：无法读取：' + file + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('head：缺少文件参数');
    }
    const lines = text.split('\n').slice(0, n);
    return { code: 0, output: lines.join('\n') + '\n' };
  }

  function h_tail(args, stdinBuf) {
    let n = 10;
    let file = null;
    if (args.length && /^\d+$/.test(args[args.length - 1])) {
      if (args.length >= 2) file = args[0];
      n = parseInt(args.pop(), 10);
    } else if (args.length) {
      file = args[0];
    }
    let text;
    if (file) {
      const abs = resolveArg(file);
      if (abs === null) return fail('tail：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('tail：无法读取：' + file + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('tail：缺少文件参数');
    }
    const lines = text.split('\n');
    return { code: 0, output: lines.slice(Math.max(0, lines.length - n)).join('\n') + '\n' };
  }

  function globToRegExp(pattern) {
    let re = '';
    for (const ch of pattern) {
      if (ch === '*') re += '.*';
      else if (ch === '?') re += '.';
      else if ('^$.|+[](){}'.indexOf(ch) >= 0) re += BACKSLASH + ch;
      else re += ch;
    }
    return new RegExp('^' + re + '$');
  }

  function h_find(args) {
    const dir = args.length ? resolveArg(args[0]) : state.cwd;
    if (dir === null) return fail('find：路径不允许');
    const st = statSafe(dir);
    if (!st || !st.isDirectory()) return fail('find：不是目录');
    let pattern = null;
    if (args.length > 1) {
      let p = args[1];
      if (p === '-name') p = args[2] || '*';
      pattern = globToRegExp(p);
    }
    const results = [];
    let visited = 0;
    let timedOut = false;
    (function walk(abs, rel) {
      if (timedOut) return;
      if (timeUp()) { timedOut = true; return; }
      const names = listDir(abs) || [];
      for (const n of names) {
        if (timedOut) return;
        if (visited >= MAX_FIND) { timedOut = true; return; }
        visited++;
        const child = path.join(abs, n);
        const cst = lstatSafe(child);
        if (!cst) continue;
        const childRel = rel ? rel + '/' + n : n;
        const isLink = cst.isSymbolicLink();
        const isDirChild = cst.isDirectory() && !isLink;
        const safeDir = isDirChild && guard.contains(child);
        if (!pattern || pattern.test(n)) results.push(childRel + (safeDir ? '/' : ''));
        if (safeDir) walk(child, childRel);
      }
    })(dir, '');
    if (timedOut) return fail('find：执行超时或目录过大（上限 ' + MAX_FIND + ' 项）');
    return { code: 0, output: results.length ? results.join('\n') + '\n' : '（没有匹配项）\n' };
  }

  function h_grep(args, stdinBuf) {
    let flags = '';
    while (args.length && args[0].indexOf('-') === 0) { flags += args.shift().slice(1); }
    if (args.length === 0) return fail('grep：缺少模式');
    const pattern = args.shift();
    const target = args.length ? args[0] : null;
    const ignoreCase = flags.indexOf('i') >= 0;
    const showLine = flags.indexOf('n') >= 0;
    const needle = ignoreCase ? pattern.toLowerCase() : pattern;
    const results = [];
    let visited = 0;
    let timedOut = false;
    let scanError = null;

    function scanText(text, label) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= MAX_MATCHES) return;
        const hay = ignoreCase ? lines[i].toLowerCase() : lines[i];
        if (hay.indexOf(needle) >= 0) {
          results.push((label ? label + ':' : '') + (showLine ? (i + 1) + ':' : '') + lines[i]);
        }
      }
    }

    function scanFile(abs, label) {
      visited++;
      if (visited > MAX_FIND) { timedOut = true; return; }
      if (timeUp()) { timedOut = true; return; }
      const rb = readBuffer(abs, MAX_TEXT_READ);
      if (rb.error) {
        if (rb.error.indexOf('文件过大') === 0) scanError = scanError || ('跳过过大文件：' + (label || path.basename(abs)));
        return;
      }
      if (isBinary(rb.buf)) return;
      scanText(rb.buf.toString('utf8'), label);
    }

    if (target === null && stdinBuf) {
      scanText(stdinBuf.toString('utf8'), '');
    } else {
      const abs = target === null ? state.cwd : resolveArg(target);
      if (abs === null) return fail('grep：路径不允许');
      const st = statSafe(abs);
      if (!st) return fail('grep：文件不存在：' + target);
      if (st.isDirectory()) {
        const rel = path.relative(state.cwd, abs);
        const baseLabel = rel === '' ? '' : rel.split(BACKSLASH).join('/');
        (function walk(d, label) {
          if (timedOut) return;
          if (timeUp()) { timedOut = true; return; }
          const names = listDir(d) || [];
          for (const n of names) {
            if (timedOut) return;
            const child = path.join(d, n);
            const childLabel = label ? label + '/' + n : n;
            const cst = lstatSafe(child);
            if (!cst) continue;
            if (cst.isSymbolicLink()) continue;
            if (cst.isDirectory()) {
              if (guard.contains(child)) walk(child, childLabel);
            } else scanFile(child, childLabel);
          }
        })(abs, baseLabel);
      } else if (st.isFile()) {
        scanFile(abs, '');
        if (scanError) return fail('grep：' + scanError);
      } else {
        return fail('grep：不是普通文件：' + target);
      }
    }
    if (timedOut && results.length === 0) return fail('grep：执行超时或目录过大');
    let out = results.length ? results.join('\n') + '\n' : '（没有匹配）\n';
    if (scanError) out += '（' + scanError + '）\n';
    return { code: 0, output: out };
  }

  function h_wc(args, stdinBuf) {
    let text;
    if (args.length) {
      const abs = resolveArg(args[0]);
      if (abs === null) return fail('wc：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('wc：无法读取：' + args[0] + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('wc：缺少文件参数');
    }
    const lines = text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    const words = text.split(/\s+/).filter(Boolean).length;
    const bytes = Buffer.byteLength(text, 'utf8');
    return { code: 0, output: lines + ' 行  ' + words + ' 词  ' + bytes + ' 字节\n' };
  }

  function h_sort(args, stdinBuf) {
    let numeric = false;
    const rest = args.filter(a => { if (a === '-n') { numeric = true; return false; } return true; });
    let text;
    if (rest.length) {
      const abs = resolveArg(rest[0]);
      if (abs === null) return fail('sort：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('sort：无法读取：' + rest[0] + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('sort：缺少文件参数');
    }
    const lines = text.split('\n').filter(l => l.length > 0);
    lines.sort(numeric
      ? (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
      : (a, b) => a.localeCompare(b, 'zh'));
    return { code: 0, output: lines.join('\n') + '\n' };
  }

  function h_strings(args) {
    if (!args.length) return fail('strings：缺少文件参数');
    const abs = resolveArg(args[0]);
    if (abs === null) return fail('strings：路径不允许');
    const rb = readBuffer(abs, MAX_TEXT_READ);
    if (rb.error) return fail('strings：无法读取（' + rb.error + '）');
    const out = [];
    let cur = '';
    function push() { if (cur.length >= 4) out.push(cur); cur = ''; }
    for (const b of rb.buf) {
      if (b >= 32 && b <= 126) cur += String.fromCharCode(b);
      else push();
      if (out.length >= MAX_MATCHES) break;
    }
    push();
    return { code: 0, output: (out.length ? out.join('\n') + '\n' : '（没有可打印字符串）\n') };
  }

  function h_xxd(args) {
    if (!args.length) return fail('xxd：缺少文件参数');
    const abs = resolveArg(args[0]);
    if (abs === null) return fail('xxd：路径不允许');
    const rb = readPrefix(abs, 1024);
    if (rb.error) return fail('xxd：无法读取（' + rb.error + '）');
    const dump = cryptoUtils.bufToHexDump(rb.buf, 1024);
    return { code: 0, output: dump + (rb.truncated ? '\n…（其余 ' + (rb.size - rb.buf.length) + ' 字节已省略）\n' : '\n') };
  }


  function h_unhex(args, stdinBuf) {
    let text;
    if (args.length) {
      const abs = resolveArg(args[0]);
      if (abs === null) return fail('unhex：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('unhex：无法读取：' + args[0] + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('unhex：缺少文件参数');
    }
    const buf = cryptoUtils.hexToBuf(text);
    if (buf === null) return fail('unhex：无效的十六进制文本');
    return { code: 0, output: buf.toString('utf8') + '\n' };
  }

  function h_base64(args, stdinBuf) {
    let mode = 'e';
    const rest = args.filter(a => { if (a === '-e' || a === '-d') { mode = a.slice(1); return false; } return true; });
    let text;
    if (rest.length) {
      const abs = resolveArg(rest[0]);
      if (abs === null) return fail('base64：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('base64：无法读取：' + rest[0] + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('base64：缺少文件参数');
    }
    if (mode === 'd') {
      const clean = text.replace(/\s+/g, '');
      if (clean.length === 0 || clean.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
        return fail('base64：不是有效的 base64 文本');
      }
      return { code: 0, output: cryptoUtils.b64d(clean) + '\n' };
    }
    return { code: 0, output: cryptoUtils.b64e(text) + '\n' };
  }

  function h_rot13(args, stdinBuf) {
    let text;
    if (args.length) {
      const abs = resolveArg(args[0]);
      if (abs === null) return fail('rot13：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('rot13：无法读取：' + args[0] + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('rot13：缺少文件参数');
    }
    return { code: 0, output: cryptoUtils.rot13(text) + '\n' };
  }

  function h_caesar(args, stdinBuf) {
    let shift = null;
    let file = null;
    if (args.length && /^-?\d+$/.test(args[args.length - 1])) shift = parseInt(args.pop(), 10);
    if (args.length) file = args[0];
    if (shift === null) return fail('caesar：缺少移位量');
    let text;
    if (file) {
      const abs = resolveArg(file);
      if (abs === null) return fail('caesar：路径不允许');
      const rt = readText(abs, MAX_TEXT_READ);
      if (rt.error) return fail('caesar：无法读取：' + file + '（' + rt.error + '）');
      text = rt.text;
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return fail('caesar：缺少文件参数');
    }
    return { code: 0, output: cryptoUtils.caesar(text, shift) + '\n' };
  }

  function h_xor(args) {
    if (args.length < 2) return fail('xor：用法 xor <文件> <密钥>');
    const key = args[1];
    if (!key) return fail('xor：密钥不能为空');
    const abs = resolveArg(args[0]);
    if (abs === null) return fail('xor：路径不允许');
    const rb = readBuffer(abs, MAX_TEXT_READ);
    if (rb.error) return fail('xor：无法读取（' + rb.error + '）');
    const out = cryptoUtils.xorBytes(rb.buf, key);
    return { code: 0, output: out.toString('utf8') + '\n' };
  }

  function h_stat(args) {
    if (!args.length) return fail('stat：缺少文件参数');
    const abs = resolveArg(args[0]);
    if (abs === null) return fail('stat：路径不允许');
    const st = statSafe(abs);
    if (!st) return fail('stat：文件不存在');
    const lst = lstatSafe(abs);
    const type = lst && lst.isSymbolicLink() ? '符号链接' : (st.isDirectory() ? '目录' : '文件');
    return { code: 0, output: '类型：' + type + '\n大小：' + st.size + ' 字节\n修改时间：' + st.mtime.toISOString() + '\n' };
  }

  function h_file(args) {
    if (!args.length) return fail('file：缺少文件参数');
    const abs = resolveArg(args[0]);
    if (abs === null) return fail('file：路径不允许');
    const st = statSafe(abs);
    if (!st) return fail('file：文件不存在');
    const name = path.basename(abs);
    if (st.isDirectory()) return { code: 0, output: name + '：目录\n' };
    const rb = readPrefix(abs, 2048);
    if (rb.error) return fail('file：无法读取（' + rb.error + '）');
    let kind = '文本文件';
    if (isBinary(rb.buf)) kind = name.endsWith('.tar') ? 'tar 压缩包' : '二进制文件';
    else if (name.endsWith('.tar')) kind = 'tar 压缩包';
    else if (name.endsWith('.hex')) kind = '十六进制文本';
    else if (name.endsWith('.log')) kind = '日志文本';
    return { code: 0, output: name + '：' + kind + '\n' };
  }

  function h_echo(args) { return { code: 0, output: args.join(' ') + '\n' }; }

  function readCString(buf, start, len) {
    const bytes = [];
    for (let i = 0; i < len; i++) {
      const b = buf[start + i];
      if (b === 0) break;
      bytes.push(b);
    }
    return Buffer.from(bytes).toString('utf8');
  }

  function parseTar(buf) {
    const entries = [];
    let off = 0;
    while (off + 512 <= buf.length) {
      const header = buf.subarray(off, off + 512);
      if (header.every(b => b === 0)) break;
      const name = readCString(header, 0, 100);
      if (!name) throw new Error('空文件名');
      const sizeStr = readCString(header, 124, 12).trim();
      if (!/^[0-7]*$/.test(sizeStr)) throw new Error('非法大小字段');
      const size = parseInt(sizeStr || '0', 8);
      if (!Number.isFinite(size) || size < 0) throw new Error('非法大小');
      const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
      if (type !== '0' && type !== '5') throw new Error('不支持的条目类型：' + type);
      if (off + 512 + size > buf.length) throw new Error('压缩包被截断');
      const stored = parseInt(readCString(header, 148, 8).trim(), 8);
      let sum = 0;
      for (let i = 0; i < 512; i++) sum += (i >= 148 && i < 156) ? 32 : header[i];
      if (!Number.isFinite(stored) || stored !== sum) throw new Error('校验和错误');
      entries.push({ name: name, type: type, content: Buffer.from(buf.subarray(off + 512, off + 512 + size)) });
      if (entries.length > MAX_UNTAR_ENTRIES) throw new Error('条目过多');
      off += 512 + Math.ceil(size / 512) * 512;
    }
    return entries;
  }

  function safeTarName(name) {
    if (typeof name !== 'string' || name.length === 0 || name.length > 200) return null;
    for (let i = 0; i < name.length; i++) {
      const c = name.charCodeAt(i);
      if (c < 32 || c === 127) return null;
    }
    const norm = name.split(BACKSLASH).join('/');
    if (hasDeviceComponent(norm)) return null;
    if (norm.charAt(0) === '/') return null;
    if (/^[A-Za-z]:/.test(norm)) return null;
    const parts = norm.split('/').filter(p => p !== '' && p !== '.');
    if (parts.length === 0) return null;
    for (const p of parts) {
      if (p === '..' || p.indexOf(':') >= 0) return null;
    }
    return parts.join('/');
  }

  function h_untar(args) {
    if (args.length < 2) return fail('untar：用法 untar <压缩包> <目标目录>');
    const arcAbs = resolveArg(args[0]);
    const destAbs = resolveArg(args[1]);
    if (arcAbs === null || destAbs === null) return fail('untar：路径不允许（只能写入沙盒内）');
    const arcSt = statSafe(arcAbs);
    if (!arcSt || !arcSt.isFile()) return fail('untar：压缩包不存在或不是普通文件');
    const rb = readBuffer(arcAbs, MAX_ARCHIVE_READ);
    if (rb.error) return fail('untar：无法读取压缩包（' + rb.error + '）');
    let entries;
    try { entries = parseTar(rb.buf); }
    catch (e) { return fail('untar：不是有效的 tar 包（' + e.message + '）'); }
    if (entries.length === 0) return fail('untar：压缩包为空');

    const planned = [];
    let total = 0;
    for (const en of entries) {
      const rel = safeTarName(en.name);
      if (rel === null) return fail('untar：压缩包内含非法路径：' + en.name);
      const target = path.join(destAbs, rel);
      if (!guard.contains(target)) return fail('untar：目标路径越界：' + en.name);
      const lst = lstatSafe(target);
      if (lst && lst.isSymbolicLink()) return fail('untar：拒绝覆盖符号链接：' + rel);
      if (en.type === '5') {
        if (lst && !lst.isDirectory()) return fail('untar：目标已存在同名文件：' + rel);
      } else {
        if (lst && lst.isDirectory()) return fail('untar：目标已存在同名目录：' + rel);
        total += en.content.length;
        if (total > MAX_UNTAR_TOTAL) return fail('untar：解压内容过大（上限 ' + MAX_UNTAR_TOTAL + ' 字节）');
      }
      planned.push({ rel: rel, target: target, type: en.type, content: en.content });
    }

    try { fs.mkdirSync(destAbs, { recursive: true }); }
    catch (e) { return fail('untar：无法创建目标目录（' + e.message + '）'); }

    const made = [];
    const skipped = [];
    for (const p of planned) {
      if (timeUp()) return fail('untar：执行超时');
      if (p.type === '5') {
        try { fs.mkdirSync(p.target, { recursive: true }); }
        catch (e) { return fail('untar：创建目录失败（' + e.message + '）'); }
        continue;
      }
      const parent = path.dirname(p.target);
      if (!guard.contains(parent)) return fail('untar：目标路径越界：' + p.rel);
      try { fs.mkdirSync(parent, { recursive: true }); }
      catch (e) { return fail('untar：创建目录失败（' + e.message + '）'); }
      if (!guard.contains(p.target)) return fail('untar：目标路径越界：' + p.rel);
      try {
        fs.writeFileSync(p.target, p.content, { flag: 'wx' });
        made.push(p.rel);
      } catch (e) {
        if (e.code !== 'EEXIST') return fail('untar：写入失败（' + e.message + '）');
        const lst = lstatSafe(p.target);
        if (lst && lst.isSymbolicLink()) return fail('untar：拒绝覆盖符号链接：' + p.rel);
        if (lst && lst.isFile()) {
          const old = readBuffer(p.target, MAX_UNTAR_TOTAL);
          if (!old.error && old.buf.equals(p.content)) { skipped.push(p.rel); continue; }
        }
        return fail('untar：拒绝覆盖已存在文件：' + p.rel);
      }
    }
    const names = made.concat(skipped);
    return { code: 0, output: '已解压 ' + made.length + ' 个文件' + (skipped.length ? '（跳过 ' + skipped.length + ' 个已存在且内容相同的文件）' : '') + '：\n' + (names.length ? names.join('\n') + '\n' : '（无）\n') };
  }

  function h_flag(args) {
    if (!args.length) return fail('flag：用法 flag <答案>');
    const res = checkFlag(args.join(' '));
    return { code: res.ok ? 0 : 1, output: res.message + '\n' };
  }

  function h_hint() { return { code: 0, output: getHint() + '\n' }; }

  function h_history() {
    return { code: 0, output: state.history.length ? state.history.join('\n') + '\n' : '（暂无历史）\n' };
  }

  function h_clear() { return { code: 0, output: '' }; }

  const handlers = {
    help: h_help, pwd: h_pwd, cd: h_cd, ls: h_ls, tree: h_tree,
    cat: h_cat, type: h_cat, head: h_head, tail: h_tail, find: h_find,
    grep: h_grep, wc: h_wc, sort: h_sort, strings: h_strings,
    xxd: h_xxd, hex: h_xxd, unhex: h_unhex, base64: h_base64,
    rot13: h_rot13, caesar: h_caesar, xor: h_xor,
    stat: h_stat, file: h_file, echo: h_echo, untar: h_untar,
    flag: h_flag, hint: h_hint, history: h_history, clear: h_clear
  };

  function exec(line) {
    const raw = String(line || '').trim();
    if (raw !== '') {
      state.history.push(raw);
      if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY);
    }
    deadline = Date.now() + MAX_EXEC_MS;
    if (raw === '') return { output: '', code: 0, cwd: relCwd() };
    if (hasForbidden(raw)) {
      return { output: '命令被拒绝：包含不允许的字符（; & < > 等）。\n', code: 1, cwd: relCwd() };
    }
    const { tokens } = tokenize(raw);
    if (tokens.length === 0) return { output: '', code: 0, cwd: relCwd() };
    const stages = [[]];
    for (const t of tokens) {
      if (t === '|') stages.push([]);
      else stages[stages.length - 1].push(t);
    }
    if (stages.length > MAX_STAGES) {
      return { output: '管道级数过多（最多 ' + MAX_STAGES + ' 级）\n', code: 1, cwd: relCwd() };
    }
    let stdinBuf = null;
    let lastOut = '';
    let totalOut = 0;
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      if (stage.length === 0) return { output: '空的管道级\n', code: 1, cwd: relCwd() };
      const cmd = stage[0].toLowerCase();
      if (!COMMANDS.has(cmd)) {
        return { output: '未知命令：' + stage[0] + '（输入 help 查看可用命令）\n', code: 1, cwd: relCwd() };
      }
      let res;
      try { res = handlers[cmd](stage.slice(1), stdinBuf); }
      catch (e) { return { output: '命令执行出错：' + e.message + '\n', code: 1, cwd: relCwd() }; }
      const buf = Buffer.isBuffer(res.output) ? res.output : Buffer.from(String(res.output), 'utf8');
      totalOut += buf.length;
      if (totalOut > MAX_OUTPUT) return { output: '输出过大，已截断\n', code: 1, cwd: relCwd() };
      if (res.code !== 0) {
        return { output: lastOut + (lastOut ? '\n' : '') + res.output, code: res.code, cwd: relCwd() };
      }
      stdinBuf = buf;
      lastOut = buf.toString('utf8');
    }
    return { output: lastOut, code: 0, cwd: relCwd() };
  }

  return { exec: exec, relCwd: relCwd, get cwd() { return state.cwd; } };
}

module.exports = { createSession: createSession, tokenize: tokenize, hasForbidden: hasForbidden };
