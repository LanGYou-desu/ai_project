"""命令解析工具：分词、归一化。零依赖。"""

import re
import shlex


def tokenize(cmd):
    """把命令行字符串切成 token（支持引号和重定向符号）。"""
    if not cmd or not cmd.strip():
        return []
    try:
        return shlex.split(cmd)
    except ValueError:
        return cmd.split()


def normalize(cmd):
    """归一化：去首尾空白、压缩多余空格、转小写。"""
    return re.sub(r"\s+", " ", cmd.strip()).lower()


def first_token(cmd):
    tok = tokenize(cmd)
    return tok[0].lower() if tok else ""


def is_int(s):
    try:
        int(s)
        return True
    except (ValueError, TypeError):
        return False


def match_any(cmd, patterns):
    """cmd 归一化后是否匹配 patterns 中的任意正则（不区分大小写）。"""
    c = normalize(cmd)
    for p in patterns:
        if re.search(p, c, re.IGNORECASE):
            return True
    return False
