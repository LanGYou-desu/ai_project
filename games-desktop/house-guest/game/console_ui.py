# -*- coding: utf-8 -*-
"""
console_ui.py — 纯文本界面（无 tkinter / 非 Windows / 远程终端时的退化方案）

和 Overlay 提供同一套接口，所以 main.Game 不用区分自己在跟哪个界面说话：
    show_bubble / set_hud / set_mission / set_open_target / glitch /
    spawn_particles / later / post / show_choice / show_ending /
    show_mini_memory / close / run

用法：
    python main.py --no-gui          # 强制纯文本模式
    （或者系统里没有 tkinter / 没有图形显示时自动退化到本模式）
"""
from __future__ import annotations
import sys
import threading
from typing import Callable, Dict, List, Optional

HELP = ('可用输入：提示 / 打开 / 解码 <算法> <内容>（rot13、base64、摩斯、hex、auto）/ '
        '玩（记忆游戏）/ 反应（反应测试）/ quit 退出')


class ConsoleUI:
    def __init__(self, on_input: Callable[[str], str],
                 on_choose: Callable[[str], None],
                 on_hint: Callable[[], str],
                 on_open_path: Callable[[], None],
                 on_close: Callable[[], None],
                 on_console: Callable[[str], None],
                 stream=None):
        self.on_input = on_input
        self.on_choose = on_choose
        self.on_hint = on_hint
        self.on_open_path = on_open_path
        self.on_close = on_close
        self.on_console = on_console
        self.stream = stream or sys.stdout
        self._lock = threading.Lock()
        self._timers: List[threading.Timer] = []
        self._closed = False
        # 等待玩家在终端里用数字做出的选择：('actions', [{'label','action'}]) 或 ('choice', options)
        self._pending: Optional[tuple] = None

    # ---------------- 输出 ----------------
    def _write(self, text: str) -> None:
        with self._lock:
            try:
                print(text, file=self.stream, flush=True)
            except Exception:
                pass

    # ---------------- 与 Overlay 对齐的接口 ----------------
    def show_bubble(self, text: str, tts: bool = True) -> None:
        self._write('咕噜> ' + str(text))

    def set_hud(self, text: str) -> None:
        self._write('—— ' + str(text) + ' ——')

    def set_mission(self, title: str, steps: List[str]) -> None:
        self._write('【任务】' + str(title))
        for s in steps:
            self._write('   • ' + str(s))

    def set_open_target(self, label: str) -> None:
        self._write('【位置】' + str(label).replace('📂', '').strip())

    def glitch(self, duration_ms: int = 700) -> None:
        self._write('（屏幕闪了一下……）')

    def spawn_particles(self, n: int = 18, color=None) -> None:
        pass

    def later(self, ms: int, fn) -> None:
        """线程安全的延时执行（替代 tkinter 的 after）"""
        if self._closed:
            return

        def run():
            if self._closed:
                return
            try:
                fn()
            except Exception:
                pass

        t = threading.Timer(max(0, ms) / 1000.0, run)
        t.daemon = True
        self._timers.append(t)
        t.start()

    def post(self, fn) -> None:
        """从目录观测线程投递任务：文本模式下直接执行（输出有锁）"""
        if self._closed:
            return
        try:
            fn()
        except Exception:
            pass

    # ---------------- 模态 ----------------
    def show_choice(self, title: str, text: str, options: List[Dict]) -> None:
        self._write('')
        self._write('=== ' + str(title) + ' ===')
        if text:
            self._write(str(text))
        for i, opt in enumerate(options, 1):
            self._write('  %d) %s — %s' % (i, opt.get('label', ''), opt.get('desc', '')))
        self._pending = ('choice', list(options))
        self._write('（输入序号选择）')

    def show_ending(self, title: str, text: str, actions: List[Dict]) -> None:
        self._write('')
        self._write('══════ ' + str(title) + ' ══════')
        if text:
            self._write(str(text))
        if actions:
            for i, act in enumerate(actions, 1):
                self._write('  %d) %s' % (i, act.get('label', '')))
            self._pending = ('actions', list(actions))
            self._write('（输入序号选择）')

    def show_mini_memory(self, start_level: int = 3, max_level: int = 5, on_done=None) -> None:
        self._write('（记忆游戏需要图形界面，纯文本模式下跳过。想玩的话输入「反应」。）')

    def show_mini_reaction(self, rounds: int = 5, on_done=None) -> None:
        self._write('（反应测试也需要图形界面，纯文本模式下跳过。）')

    # ---------------- 输入 ----------------
    def _handle_pending(self, line: str) -> bool:
        kind, items = self._pending
        self._pending = None
        try:
            idx = int(line.strip())
        except ValueError:
            self._write('（请输入 1 - %d 的数字）' % len(items))
            self._pending = (kind, items)
            return True
        if not (1 <= idx <= len(items)):
            self._write('（请输入 1 - %d 的数字）' % len(items))
            self._pending = (kind, items)
            return True
        item = items[idx - 1]
        if kind == 'choice':
            self.on_choose(item['id'])
        else:
            action = item.get('action')
            if action:
                action()
        return True

    def _handle_line(self, line: str) -> bool:
        """处理一行输入；返回 False 表示要退出。"""
        line = line.strip()
        if not line:
            return True
        if self._pending is not None:
            return self._handle_pending(line)
        low = line.lower()
        if low in ('quit', 'exit', 'q'):
            return False
        if line in ('提示', 'hint', '?'):
            h = self.on_hint()
            if h:
                self._write('咕噜> ' + str(h))
            return True
        if line in ('打开', 'open'):
            self.on_open_path()
            return True
        if low in ('help', '帮助'):
            self._write(HELP)
            return True
        reply = self.on_input(line)
        if reply:
            self._write('咕噜> ' + str(reply))
        return True

    def run(self) -> None:
        self._write('（纯文本模式：直接打字跟咕噜说话。输入 help 看命令，输入 quit 退出。）')
        while not self._closed:
            try:
                line = input('> ')
            except (EOFError, KeyboardInterrupt):
                break
            if not self._handle_line(line):
                break
        if not self._closed:
            self.on_close()

    def close(self) -> None:
        self._closed = True
        for t in self._timers:
            try:
                t.cancel()
            except Exception:
                pass
        self._timers = []
