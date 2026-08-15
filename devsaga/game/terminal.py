"""DevSaga 终端 UI 工具：ANSI 颜色、面板、表格、进度条。零第三方依赖。"""

import os
import sys
import time

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


def enable_ansi():
    """Windows 下启用 ANSI 转义序列（cmd / PowerShell 默认可能关闭）。"""
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


def width():
    try:
        return os.get_terminal_size().columns
    except Exception:
        return 80


def hr(ch="─", color="dim", w=None):
    return paint(ch * (w or width()), color)


def _wrap(text, n):
    text = str(text)
    if len(text) <= n:
        return [text]
    parts = []
    while len(text) > n:
        cut = text.rfind(" ", 0, n)
        if cut <= 0:
            cut = n
        parts.append(text[:cut])
        text = text[cut:].lstrip()
    parts.append(text)
    return parts


def box(lines, title=None, color="cyan", w=None):
    """把多行文本放进带边框的盒子，返回整块字符串。"""
    if isinstance(lines, str):
        lines = lines.split("\n")
    w = w or width()
    inner = max(1, w - 4)
    out = []
    if title:
        t = paint(" " + title + " ", color, "bold")
        pad = max(1, w - len(t) - 3)
        out.append("┌─" + t + "─" * pad + "┐")
    else:
        out.append("┌" + "─" * (w - 2) + "┐")
    for ln in lines:
        for part in _wrap(ln, inner):
            out.append("│ " + part.ljust(inner) + " │")
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
    widths = [len(str(h)) for h in headers]
    for r in rows:
        for i in range(min(ncols, len(r))):
            widths[i] = max(widths[i], len(r[i]))
    # 若总宽超出屏幕，压缩
    total = sum(widths) + 3 * ncols + 1
    if total > max_w:
        scale = (max_w - 3 * ncols - 1) / max(1, sum(widths))
        widths = [max(8, int(wd * scale)) for wd in widths]

    def fmt_row(cells, pad="│"):
        cells = list(cells) + [""] * (ncols - len(cells))
        parts = []
        for i, cell in enumerate(cells):
            parts.append(" " + str(cell)[: widths[i]].ljust(widths[i]) + " ")
        return pad + pad.join(parts) + "│"

    top = "┌" + "┬".join("─" * (wd + 2) for wd in widths) + "┐"
    mid = "├" + "┼".join("─" * (wd + 2) for wd in widths) + "┤"
    bot = "└" + "┴".join("─" * (wd + 2) for wd in widths) + "┘"
    lines = [top, fmt_row(headers), mid]
    for r in rows:
        lines.append(fmt_row(r))
    lines.append(bot)
    return "\n".join(lines)


def typewriter(text, delay=0.006):
    """打字机效果输出（仅用于人类交互模式）。"""
    for ch in str(text):
        sys.stdout.write(ch)
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write("\n")
    sys.stdout.flush()


def flush():
    sys.stdout.flush()
