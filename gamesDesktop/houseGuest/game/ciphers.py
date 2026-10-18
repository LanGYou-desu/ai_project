# -*- coding: utf-8 -*-
"""
ciphers.py — 密码工具箱（纯函数，可单测）
ROT13 / 凯撒 / Base64 / 摩斯 / 十六进制 / 藏头 / 异或 / 频率统计
"""
from __future__ import annotations
import base64
import re
from typing import Dict, List, Optional

MORSE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.',
    ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
    '_': '..--.-', '@': '.--.-.', ' ': '/',
}
MORSE_REV = {v: k for k, v in MORSE.items()}


def rot13(s: str) -> str:
    return caesar(s, 13)


def caesar(s: str, shift: int) -> str:
    out = []
    for ch in s:
        if 'A' <= ch <= 'Z':
            out.append(chr(65 + (ord(ch) - 65 + shift) % 26))
        elif 'a' <= ch <= 'z':
            out.append(chr(97 + (ord(ch) - 97 + shift) % 26))
        else:
            out.append(ch)
    return ''.join(out)


def b64encode(s: str) -> str:
    return base64.b64encode(s.encode('utf-8')).decode('ascii')


def b64decode(s: str) -> str:
    return base64.b64decode(s.strip()).decode('utf-8', errors='replace')


def hex_encode(s: str) -> str:
    return ''.join(f'{ord(c):02x}' for c in s)


def hex_decode(h: str) -> str:
    h = re.sub(r'\s+', '', h)
    if len(h) % 2 != 0:
        return ''
    return ''.join(chr(int(h[i:i + 2], 16)) for i in range(0, len(h), 2))


def morse_encode(s: str) -> str:
    parts = []
    for ch in s.upper():
        parts.append(MORSE.get(ch, ''))
    text = ' '.join(parts)
    # 词间分隔（连续多空格 → /）
    return re.sub(r' {3,}', ' / ', text).strip()


def morse_decode(s: str) -> str:
    words = re.split(r'\s*/\s*|\s{2,}', s.strip())
    out = []
    for word in words:
        chars = []
        for tok in word.split():
            if tok in MORSE_REV:
                chars.append(MORSE_REV[tok])
        out.append(''.join(chars))
    return ' '.join(out)


def acrostic(lines: List[str]) -> str:
    """藏头：每行第一个中英文字符连读"""
    result = []
    for line in lines:
        m = re.search(r'[A-Za-z0-9\u4e00-\u9fff]', line)
        result.append(m.group(0) if m else '')
    return ''.join(result)


def xor_with(s: str, key: int) -> str:
    return ''.join(chr(ord(c) ^ key) for c in s)


def freq(s: str) -> Dict[str, int]:
    m: Dict[str, int] = {}
    for ch in s.lower():
        if 'a' <= ch <= 'z':
            m[ch] = m.get(ch, 0) + 1
    return m


def most_frequent(s: str) -> Optional[str]:
    f = freq(s)
    if not f:
        return None
    return max(f, key=f.get)


def decode_guess(text: str) -> List[str]:
    """自动尝试常见解码，返回可能结果列表（供玩家偷懒 & 测试）"""
    results = []
    try:
        results.append(('ROT13', rot13(text)))
    except Exception:
        pass
    try:
        results.append(('凯撒(1)', caesar(text, 1)))
    except Exception:
        pass
    try:
        results.append(('Base64', b64decode(text)))
    except Exception:
        pass
    try:
        results.append(('十六进制', hex_decode(text)))
    except Exception:
        pass
    try:
        results.append(('摩斯', morse_decode(text)))
    except Exception:
        pass
    return results
