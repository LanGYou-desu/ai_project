'use strict';
// 谜题编解码工具：base64 / rot13 / caesar / xor / hex —— 世界生成器与命令引擎共用

function b64e(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function b64d(s) { return Buffer.from(String(s), 'base64').toString('utf8'); }

function rot13Char(c) {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
  if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
  return c;
}
function rot13(s) { return String(s).split('').map(rot13Char).join(''); }

function caesar(s, shift) {
  const sh = ((shift % 26) + 26) % 26;
  return String(s).split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + sh) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + sh) % 26) + 97);
    return c;
  }).join('');
}

function xorBytes(buf, key) {
  const k = Buffer.from(String(key), 'utf8');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ k[i % k.length];
  return out;
}

function hexToBuf(hexText) {
  const clean = String(hexText).replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) return null;
  return Buffer.from(clean, 'hex');
}

function bufToHexDump(buf, maxLen) {
  const len = Math.min(buf.length, maxLen || 512);
  const lines = [];
  for (let off = 0; off < len; off += 16) {
    const chunk = buf.subarray(off, off + 16);
    const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
    lines.push(off.toString(16).padStart(8, '0') + '  ' + hex.padEnd(47, ' ') + '  ' + ascii);
  }
  return lines.join('\n');
}

module.exports = { b64e, b64d, rot13, caesar, xorBytes, hexToBuf, bufToHexDump };
