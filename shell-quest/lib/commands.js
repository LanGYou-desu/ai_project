'use strict';
// ============================================================
// 档案馆-7 · 真实命令引擎
// 在真实沙盒目录上执行一组受限的读取类命令。
// 安全性：命令白名单、只读、路径强制限定在沙盒根目录内、
//         禁止 shell 元字符、管道逐级校验。
// ============================================================
const fs = require('fs');
const path = require('path');
const cryptoUtils = require('./crypto-utils');

const COMMANDS = new Set([
  'help','pwd','cd','ls','tree','cat','type','head','tail','find',
  'grep','wc','sort','strings','xxd','hex','unhex','base64','rot13',
  'caesar','xor','stat','file','echo','untar','flag','hint','history'
]);

const FORBIDDEN = /[;&<>\x60$(){}=%:\\]/;
const MAX_STAGES = 8;
const MAX_OUTPUT = 1024 * 1024;
const MAX_FIND = 2000;

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
  const root = path.resolve(opts.root);
  const checkFlag = opts.checkFlag || function () { return { ok: false, message: 'flag 系统未初始化' }; };
  const getHint = opts.getHint || function () { return '（无提示）'; };
  const state = { cwd: root, history: [] };

  function relCwd() {
    const r = path.relative(root, state.cwd);
    return r === '' ? '/' : '/' + r.replace(/\\/g, '/');
  }

  function resolveArg(arg, base) {
    if (typeof arg !== 'string' || arg.length === 0) return null;
    const baseDir = base || state.cwd;
    const abs = path.isAbsolute(arg) ? arg : path.resolve(baseDir, arg);
    const rel = path.relative(root, abs);
    if (rel === '') return abs;
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return abs;
  }

  function isDir(abs) { try { return fs.statSync(abs).isDirectory(); } catch (e) { return false; } }
  function exists(abs) { try { fs.statSync(abs); return true; } catch (e) { return false; } }
  function readFile(abs) { try { return fs.readFileSync(abs); } catch (e) { return null; } }

  function isBinary(buf) {
    const sample = buf.subarray(0, Math.min(buf.length, 2048));
    let bad = 0;
    for (const b of sample) {
      if (b === 0 || (b < 9) || (b > 13 && b < 32 && b !== 27)) bad++;
    }
    return sample.length > 0 && bad / sample.length > 0.1;
  }

  function readableText(buf, abs) {
    if (isBinary(buf)) {
      const st = fs.statSync(abs);
      return '（二进制文件 ' + st.size + ' 字节，试试 strings / xxd / xor）\n';
    }
    return buf.toString('utf8');
  }

  function listDir(abs) {
    try {
      return fs.readdirSync(abs).sort((a, b) => {
        const da = fs.statSync(path.join(abs, a)).isDirectory();
        const db = fs.statSync(path.join(abs, b)).isDirectory();
        if (da !== db) return da ? -1 : 1;
        return a.localeCompare(b, 'zh');
      });
    } catch (e) { return null; }
  }

  function h_help() {
    return { code: 0, output: [
      '档案馆-7 · 命令手册',
      '  pwd                   显示当前目录',
      '  cd <目录>              切换目录',
      '  ls [目录] [-l]         列出文件（-l 显示大小）',
      '  tree [目录]            递归显示目录树',
      '  cat <文件...>          查看文件内容（可多文件；无参数时读管道）',
      '  head <文件> [行数]      查看开头 N 行',
      '  tail <文件> [行数]      查看结尾 N 行',
      '  find <目录> [名字模式]   递归查找（支持 * 通配）',
      '  grep <模式> [文件|目录]  搜索文本（目录=递归；-i 忽略大小写）',
      '  wc [文件]              统计行/词/字符',
      '  sort [文件] [-n]       排序行（-n 按数字）',
      '  strings <文件>         提取可打印字符串',
      '  xxd <文件>             十六进制转储',
      '  unhex <文件>           十六进制文本还原为原文',
      '  base64 [-e|-d] [文件]   编码/解码（无文件时读管道）',
      '  rot13 [文件]           旧式便签解码',
      '  caesar <文件> <移位>     凯撒移位',
      '  xor <文件> <密钥>        XOR 解密',
      '  stat <文件>             文件信息',
      '  file <文件>             猜测文件类型',
      '  echo <文本...>          输出文本',
      '  untar <压缩包> <目录>     解压 tar 包',
      '  flag <答案>             提交谜题答案',
      '  hint                   获取当前幕提示',
      '  history                查看命令历史',
      '  clear                  清屏（客户端）'
    ].join('\n') + '\n' };
  }

  function h_pwd() { return { code: 0, output: relCwd() + '\n' }; }

  function h_cd(args) {
    const target = args.length ? resolveArg(args[0]) : root;
    if (target === null) return { code: 1, output: 'cd：路径不允许（只能访问沙盒内）\n' };
    if (!isDir(target)) return { code: 1, output: 'cd：目录不存在：' + args[0] + '\n' };
    state.cwd = target;
    return { code: 0, output: '' };
  }

  function h_ls(args) {
    let showSize = false;
    const rest = args.filter(a => { if (a === '-l') { showSize = true; return false; } return true; });
    const dir = rest.length ? resolveArg(rest[0]) : state.cwd;
    if (dir === null) return { code: 1, output: 'ls：路径不允许\n' };
    if (!isDir(dir)) return { code: 1, output: 'ls：不是目录：' + rest[0] + '\n' };
    const names = listDir(dir);
    if (names === null) return { code: 1, output: 'ls：无法读取目录\n' };
    const lines = [];
    for (const n of names) {
      const abs = path.join(dir, n);
      const d = isDir(abs);
      if (showSize) {
        try { const st = fs.statSync(abs); lines.push((d ? 'd' : '-') + '  ' + String(st.size).padStart(10) + '  ' + n + (d ? '/' : '')); }
        catch (e) { lines.push('?  ' + n + (d ? '/' : '')); }
      } else {
        lines.push(n + (d ? '/' : ''));
      }
    }
    return { code: 0, output: lines.join('\n') + (lines.length ? '\n' : '（空目录）\n') };
  }

  function h_tree(args) {
    const dir = args.length ? resolveArg(args[0]) : state.cwd;
    if (dir === null) return { code: 1, output: 'tree：路径不允许\n' };
    if (!isDir(dir)) return { code: 1, output: 'tree：不是目录\n' };
    const lines = [];
    let count = 0;
    (function walk(abs, prefix, depth) {
      if (count > 800 || depth > 8) return;
      const names = listDir(abs) || [];
      names.forEach((n, i) => {
        if (count > 800) return;
        const child = path.join(abs, n);
        const last = i === names.length - 1;
        lines.push(prefix + (last ? '└─ ' : '├─ ') + n + (isDir(child) ? '/' : ''));
        count++;
        if (isDir(child)) walk(child, prefix + (last ? '   ' : '│  '), depth + 1);
      });
    })(dir, '', 0);
    return { code: 0, output: lines.join('\n') + '\n' };
  }

  function h_cat(args, stdinBuf) {
    if (args.length === 0) {
      if (!stdinBuf) return { code: 1, output: 'cat：缺少文件参数（可配合管道使用）\n' };
      return { code: 0, output: stdinBuf.toString('utf8') };
    }
    const chunks = [];
    for (const a of args) {
      const abs = resolveArg(a);
      if (abs === null) return { code: 1, output: 'cat：路径不允许：' + a + '\n' };
      if (isDir(abs)) return { code: 1, output: 'cat：' + a + ' 是目录\n' };
      if (!exists(abs)) return { code: 1, output: 'cat：文件不存在：' + a + '\n' };
      const buf = readFile(abs);
      if (buf === null) return { code: 1, output: 'cat：无法读取：' + a + '\n' };
      chunks.push(readableText(buf, abs));
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
      if (abs === null || !exists(abs)) return { code: 1, output: 'head：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'head：缺少文件参数\n' };
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
      if (abs === null || !exists(abs)) return { code: 1, output: 'tail：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'tail：缺少文件参数\n' };
    }
    const lines = text.split('\n');
    return { code: 0, output: lines.slice(Math.max(0, lines.length - n)).join('\n') + '\n' };
  }

  function globToRegExp(pattern) {
    let re = '';
    for (const ch of pattern) {
      if (ch === '*') re += '.*';
      else if (ch === '?') re += '.';
      else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + re + '$');
  }

  function h_find(args) {
    const dir = args.length ? resolveArg(args[0]) : state.cwd;
    if (dir === null) return { code: 1, output: 'find：路径不允许\n' };
    if (!isDir(dir)) return { code: 1, output: 'find：不是目录\n' };
    let pattern = null;
    if (args.length > 1) {
      let p = args[1];
      if (p === '-name') p = args[2] || '*';
      pattern = globToRegExp(p);
    }
    const results = [];
    let count = 0;
    (function walk(abs, rel) {
      if (count > MAX_FIND) return;
      const names = listDir(abs) || [];
      for (const n of names) {
        if (count > MAX_FIND) return;
        const child = path.join(abs, n);
        const childRel = rel ? rel + '/' + n : n;
        if (!pattern || pattern.test(n)) { results.push(childRel + (isDir(child) ? '/' : '')); count++; }
        if (isDir(child)) walk(child, childRel);
      }
    })(dir, '');
    return { code: 0, output: (results.length ? results.join('\n') + '\n' : '（没有匹配项）\n') };
  }

  function h_grep(args, stdinBuf) {
    let flags = '';
    while (args.length && args[0].indexOf('-') === 0) { flags += args.shift().slice(1); }
    if (args.length === 0) return { code: 1, output: 'grep：缺少模式\n' };
    const pattern = args.shift();
    let target = args.length ? args[0] : null;
    let re;
    try {
      re = new RegExp(pattern, flags.indexOf('i') >= 0 ? 'i' : '');
    } catch (e) {
      re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags.indexOf('i') >= 0 ? 'i' : '');
    }
    const results = [];
    function scanFile(abs, label) {
      const buf = readFile(abs);
      if (buf === null || isBinary(buf)) return;
      const text = buf.toString('utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        if (re.test(lines[i])) {
          results.push((label ? label + ':' : '') + (i + 1) + ':' + lines[i]);
        }
      }
    }
    if (target === null && stdinBuf) {
      const lines = stdinBuf.toString('utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        if (re.test(lines[i])) results.push((i + 1) + ':' + lines[i]);
      }
    } else {
      const abs = target === null ? state.cwd : resolveArg(target);
      if (abs === null) return { code: 1, output: 'grep：路径不允许\n' };
      if (isDir(abs)) {
        const rel = path.relative(state.cwd, abs);
        const baseLabel = rel === '' ? '' : rel.replace(/\\/g, '/');
        (function walk(d, label) {
          const names = listDir(d) || [];
          for (const n of names) {
            const child = path.join(d, n);
            const childLabel = label ? label + '/' + n : n;
            if (isDir(child)) walk(child, childLabel);
            else scanFile(child, childLabel);
          }
        })(abs, baseLabel);
      } else if (exists(abs)) {
        scanFile(abs, '');
      } else {
        return { code: 1, output: 'grep：文件不存在：' + target + '\n' };
      }
    }
    return { code: 0, output: (results.length ? results.join('\n') + '\n' : '（没有匹配）\n') };
  }

  function h_wc(args, stdinBuf) {
    let text;
    if (args.length) {
      const abs = resolveArg(args[0]);
      if (abs === null || !exists(abs)) return { code: 1, output: 'wc：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'wc：缺少文件参数\n' };
    }
    const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
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
      if (abs === null || !exists(abs)) return { code: 1, output: 'sort：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'sort：缺少文件参数\n' };
    }
    const lines = text.split('\n').filter(l => l.length > 0);
    lines.sort(numeric
      ? (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
      : (a, b) => a.localeCompare(b, 'zh'));
    return { code: 0, output: lines.join('\n') + '\n' };
  }

  function h_strings(args) {
    if (!args.length) return { code: 1, output: 'strings：缺少文件参数\n' };
    const abs = resolveArg(args[0]);
    if (abs === null || !exists(abs)) return { code: 1, output: 'strings：文件不存在\n' };
    const buf = readFile(abs);
    const out = [];
    let cur = '';
    function push() { if (cur.length >= 4) out.push(cur); cur = ''; }
    for (const b of buf) {
      if (b >= 32 && b <= 126) cur += String.fromCharCode(b);
      else push();
    }
    push();
    return { code: 0, output: (out.length ? out.join('\n') + '\n' : '（没有可打印字符串）\n') };
  }

  function h_xxd(args) {
    if (!args.length) return { code: 1, output: 'xxd：缺少文件参数\n' };
    const abs = resolveArg(args[0]);
    if (abs === null || !exists(abs)) return { code: 1, output: 'xxd：文件不存在\n' };
    const buf = readFile(abs);
    const dump = cryptoUtils.bufToHexDump(buf, 1024);
    return { code: 0, output: dump + (buf.length > 1024 ? '\n…（其余 ' + (buf.length - 1024) + ' 字节已省略）\n' : '\n') };
  }

  function h_unhex(args, stdinBuf) {
    let text;
    if (args.length) {
      const abs = resolveArg(args[0]);
      if (abs === null || !exists(abs)) return { code: 1, output: 'unhex：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'unhex：缺少文件参数\n' };
    }
    const buf = cryptoUtils.hexToBuf(text);
    if (buf === null) return { code: 1, output: 'unhex：无效的十六进制文本\n' };
    return { code: 0, output: buf.toString('utf8') + '\n' };
  }

  function h_base64(args, stdinBuf) {
    let mode = 'e';
    const rest = args.filter(a => { if (a === '-e' || a === '-d') { mode = a.slice(1); return false; } return true; });
    let text;
    if (rest.length) {
      const abs = resolveArg(rest[0]);
      if (abs === null || !exists(abs)) return { code: 1, output: 'base64：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'base64：缺少文件参数\n' };
    }
    try {
      const out = mode === 'd'
        ? Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8')
        : Buffer.from(text, 'utf8').toString('base64');
      return { code: 0, output: out + '\n' };
    } catch (e) {
      return { code: 1, output: 'base64：解码失败\n' };
    }
  }

  function h_rot13(args, stdinBuf) {
    let text;
    if (args.length) {
      const abs = resolveArg(args[0]);
      if (abs === null || !exists(abs)) return { code: 1, output: 'rot13：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'rot13：缺少文件参数\n' };
    }
    return { code: 0, output: cryptoUtils.rot13(text) + '\n' };
  }

  function h_caesar(args, stdinBuf) {
    let shift = null;
    let file = null;
    if (args.length && /^-?\d+$/.test(args[args.length - 1])) shift = parseInt(args.pop(), 10);
    if (args.length) file = args[0];
    if (shift === null) return { code: 1, output: 'caesar：缺少移位量\n' };
    let text;
    if (file) {
      const abs = resolveArg(file);
      if (abs === null || !exists(abs)) return { code: 1, output: 'caesar：文件不存在\n' };
      text = readFile(abs).toString('utf8');
    } else if (stdinBuf) {
      text = stdinBuf.toString('utf8');
    } else {
      return { code: 1, output: 'caesar：缺少文件参数\n' };
    }
    return { code: 0, output: cryptoUtils.caesar(text, shift) + '\n' };
  }

  function h_xor(args) {
    if (args.length < 2) return { code: 1, output: 'xor：用法 xor <文件> <密钥>\n' };
    const abs = resolveArg(args[0]);
    if (abs === null || !exists(abs)) return { code: 1, output: 'xor：文件不存在\n' };
    const buf = readFile(abs);
    const out = cryptoUtils.xorBytes(buf, args[1]);
    return { code: 0, output: out.toString('utf8') + '\n' };
  }

  function h_stat(args) {
    if (!args.length) return { code: 1, output: 'stat：缺少文件参数\n' };
    const abs = resolveArg(args[0]);
    if (abs === null || !exists(abs)) return { code: 1, output: 'stat：文件不存在\n' };
    const st = fs.statSync(abs);
    const type = st.isDirectory() ? '目录' : '文件';
    return { code: 0, output: '类型：' + type + '\n大小：' + st.size + ' 字节\n修改时间：' + st.mtime.toISOString() + '\n' };
  }

  function h_file(args) {
    if (!args.length) return { code: 1, output: 'file：缺少文件参数\n' };
    const abs = resolveArg(args[0]);
    if (abs === null || !exists(abs)) return { code: 1, output: 'file：文件不存在\n' };
    const buf = readFile(abs);
    const name = path.basename(abs);
    let kind = '文本文件';
    if (buf && isBinary(buf)) kind = name.endsWith('.tar') ? 'tar 压缩包' : '二进制文件';
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
      if (!name) break;
      const sizeStr = readCString(header, 124, 12).trim();
      const size = parseInt(sizeStr, 8) || 0;
      const type = String.fromCharCode(header[156] || 48);
      entries.push({ name: name, type: type, content: Buffer.from(buf.subarray(off + 512, off + 512 + size)) });
      off += 512 + Math.ceil(size / 512) * 512;
    }
    return entries;
  }

  function h_untar(args) {
    if (args.length < 2) return { code: 1, output: 'untar：用法 untar <压缩包> <目标目录>\n' };
    const arcAbs = resolveArg(args[0]);
    const destAbs = resolveArg(args[1]);
    if (arcAbs === null || destAbs === null) return { code: 1, output: 'untar：路径不允许\n' };
    if (!exists(arcAbs)) return { code: 1, output: 'untar：压缩包不存在\n' };
    const buf = readFile(arcAbs);
    let entries;
    try { entries = parseTar(buf); }
    catch (e) { return { code: 1, output: 'untar：不是有效的 tar 包\n' }; }
    fs.mkdirSync(destAbs, { recursive: true });
    const made = [];
    for (const en of entries) {
      const target = path.join(destAbs, en.name);
      const rel = path.relative(root, target);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return { code: 1, output: 'untar：压缩包内含非法路径，已中止\n' };
      if (en.type === '5') { fs.mkdirSync(target, { recursive: true }); continue; }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, en.content);
      made.push(en.name);
    }
    return { code: 0, output: '已解压 ' + made.length + ' 个文件：\n' + made.join('\n') + '\n' };
  }

  function h_flag(args) {
    if (!args.length) return { code: 1, output: 'flag：用法 flag <答案>\n' };
    const res = checkFlag(args.join(' '));
    return { code: res.ok ? 0 : 1, output: res.message + '\n' };
  }

  function h_hint() { return { code: 0, output: getHint() + '\n' }; }

  function h_history() { return { code: 0, output: state.history.join('\n') + '\n' }; }

  const handlers = {
    help: h_help, pwd: h_pwd, cd: h_cd, ls: h_ls, tree: h_tree,
    cat: h_cat, type: h_cat, head: h_head, tail: h_tail, find: h_find,
    grep: h_grep, wc: h_wc, sort: h_sort, strings: h_strings,
    xxd: h_xxd, hex: h_xxd, unhex: h_unhex, base64: h_base64,
    rot13: h_rot13, caesar: h_caesar, xor: h_xor,
    stat: h_stat, file: h_file, echo: h_echo, untar: h_untar,
    flag: h_flag, hint: h_hint, history: h_history
  };

  function exec(line) {
    const raw = String(line || '').trim();
    state.history.push(raw);
    if (raw === '') return { output: '', code: 0, cwd: relCwd() };
    if (FORBIDDEN.test(raw)) {
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

module.exports = { createSession: createSession, tokenize: tokenize };
