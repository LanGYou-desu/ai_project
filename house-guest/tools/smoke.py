# -*- coding: utf-8 -*-
"""
tools/smoke.py — GUI 冒烟测试
真实启动：构建虚拟系统 → 启动观测器 → 实例化透明悬浮层 → 注入第 1 章 → 2 秒后自动关闭。
通过则打印 SMOKE OK。结束后请删除 vfsystem 与 save 以恢复全新首启体验。
"""
import os
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

from main import Game  # noqa: E402
from game.overlay import Overlay  # noqa: E402


def main() -> None:
    g = Game('', tts_enabled=False)
    g.build_system()
    g.state.write_access_logs(g.sd)
    g.start_tracker()

    g.overlay = Overlay(
        on_input=g.on_input,
        on_choose=g.on_choose,
        on_mini_pass=lambda kind: None,
        on_hint=g.on_hint,
        on_open_path=g.on_open_path,
        on_close=g.quit,
        on_console=g._console,
    )
    g._last_ambient = time.time()
    g.overlay.later(1000, g._tick)
    g.start_chapter(g.state.chapter, delay=200)
    g.overlay.later(2200, g.quit)
    try:
        g.overlay.run()
    except Exception as e:
        print('SMOKE FAIL:', e)
        sys.exit(1)
    print('SMOKE OK')


if __name__ == '__main__':
    main()
