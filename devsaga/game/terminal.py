"""DevSaga 终端 UI 工具：ANSI 颜色、面板、表格、进度条。零第三方依赖。"""

import os
import re
import sys

ENABLE_COLOR = True

_STYLE = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "italic": "\033[3m",
    "underline": "\033[4m",
    "reverse": "\033[7m",
    "black": "\033[30m",
    "red": "\033[31m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "blue": "\033[34m",
    "magenta": "\033[35m",
    "cyan": "\033[36m",
    "white": "\033[37m",
    "bg_black": "\033[40m",
    "bg_red": "\033[41m",
    "bg_green": "\033[42m",
    "bg_yellow": "\033[43m",
    "bg_blue": "\033[44m",
    "bg_magenta": "\033[45m",
    "bg_cyan": "\033[46m",
    "bg_white": "\033[47m",
}

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def enable_ansi():
    """启用 ANSI 转义序列，并把标准输出切到 UTF-8（Windows 默认 GBK 会因 emoji 崩溃）。"""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if os.name == "nt":
        try:
            import ctypes

            k = ctypes.windll.kernel32
            k.SetConsoleMode(k.GetStdHandle(-11), 7)
        except Exception:
            pass


def paint(text, *styles):
    if not ENABLE_COLOR or not styles:
        return text
    head = "".join(_STYLE.get(s, "") for s in styles)
    if not head:
        return text
    return head + str(text) + _STYLE["reset"]


def _visible_len(text):
    """去掉 ANSI 转义码后的可见长度。"""
    return len(_ANSI_RE.sub("", str(text)))


def visible_len(text):
    """公开的可见长度（供引擎等模块排版时使用）。"""
    return _visible_len(text)


def _reset_guard(text):
    """截断/换行后如果还带着颜色，补一个 reset，避免颜色污染后续输出。"""
    if _ANSI_RE.search(text) and not text.endswith(_STYLE["reset"]):
        return text + _STYLE["reset"]
    return text


def _truncate_visible(text, n):
    """按可见字符数截断，保留 ANSI 转义码。"""
    text = str(text)
    if _visible_len(text) <= n:
        return text
    out, count, pos = [], 0, 0
    for m in _ANSI_RE.finditer(text):
        for ch in text[pos:m.start()]:
            if count >= n:
                return _reset_guard("".join(out))
            out.append(ch)
            count += 1
        out.append(m.group(0))
        pos = m.end()
    for ch in text[pos:]:
        if count >= n:
            break
        out.append(ch)
        count += 1
    return _reset_guard("".join(out))


def width():
    try:
        return max(20, os.get_terminal_size().columns)
    except Exception:
        return 80


def _wrap(text, n):
    """按可见宽度折行，保留 ANSI 颜色；超长无空格时硬折。"""
    text = str(text)
    if _visible_len(text) <= n:
        return [text]
    tokens, pos = [], 0
    for m in _ANSI_RE.finditer(text):
        for ch in text[pos:m.start()]:
            tokens.append((ch, False))
        tokens.append((m.group(0), True))
        pos = m.end()
    for ch in text[pos:]:
        tokens.append((ch, False))

    parts, cur, cur_len, last_space = [], [], 0, None

    def flush(keep_from=None):
        nonlocal cur, cur_len, last_space
        if keep_from is None:
            parts.append(_reset_guard("".join(cur)))
            cur, cur_len, last_space = [], 0, None
        else:
            head = "".join(cur[:keep_from])
            tail = cur[keep_from + 1:]
            parts.append(_reset_guard(head))
            cur = tail
            cur_len = sum(1 for t in tail if not _ANSI_RE.fullmatch(t))
            last_space = None

    for tok, is_ansi in tokens:
        if is_ansi:
            cur.append(tok)
            continue
        if tok == "\n":
            flush()
            continue
        cur.append(tok)
        cur_len += 1
        if tok == " ":
            last_space = len(cur) - 1
        if cur_len > n:
            if last_space is not None and last_space > 0:
                flush(last_space)
            else:
                flush()
    if cur:
        parts.append(_reset_guard("".join(cur)))
    return parts or [""]


def box(lines, title=None, color="cyan", w=None):
    """把多行文本放进带边框的盒子，返回整块字符串。"""
    if isinstance(lines, str):
        lines = lines.split("\n")
    w = max(20, w or width())
    inner = max(1, w - 4)
    out = []
    if title:
        t = paint(" " + title + " ", color, "bold")
        pad = max(1, w - _visible_len(t) - 3)
        out.append("┌─" + t + "─" * pad + "┐")
    else:
        out.append("┌" + "─" * (w - 2) + "┐")
    for ln in lines:
        for part in _wrap(ln, inner):
            pad = max(0, inner - _visible_len(part))
            out.append("│ " + part + " " * pad + " │")
    out.append("└" + "─" * (w - 2) + "┘")
    return "\n".join(out)


def bar(ratio, w=18, filled="█", empty="░", color="green"):
    ratio = max(0.0, min(1.0, ratio))
    n = int(round(ratio * w))
    return paint(filled * n, color) + paint(empty * (w - n), "dim")


def table(headers, rows, color="cyan", max_w=None):
    """画一张简单的表，返回字符串。rows 为 list[list] 或 list[tuple]。"""
    rows = [[str(c) for c in r] for r in rows]
    max_w = max_w or width()
    ncols = len(headers)
    widths = [_visible_len(h) for h in headers]
    for r in rows:
        for i in range(min(ncols, len(r))):
            widths[i] = max(widths[i], _visible_len(r[i]))
    # 若总宽超出屏幕，压缩
    total = sum(widths) + 3 * ncols + 1
    if total > max_w:
        scale = (max_w - 3 * ncols - 1) / max(1, sum(widths))
        widths = [max(8, int(wd * scale)) for wd in widths]

    def fmt_row(cells, pad="│"):
        cells = list(cells) + [""] * (ncols - len(cells))
        parts = []
        for i, cell in enumerate(cells):
            cell = _truncate_visible(cell, widths[i])
            parts.append(" " + cell + " " * max(0, widths[i] - _visible_len(cell)) + " ")
        return pad + pad.join(parts) + "│"

    top = "┌" + "┬".join("─" * (wd + 2) for wd in widths) + "┐"
    mid = "├" + "┼".join("─" * (wd + 2) for wd in widths) + "┤"
    bot = "└" + "┴".join("─" * (wd + 2) for wd in widths) + "┘"
    lines = [top, fmt_row(headers), mid]
    for r in rows:
        lines.append(fmt_row(r))
    lines.append(bot)
    return "\n".join(lines)


def flush():
    sys.stdout.flush()
