# -*- coding: utf-8 -*-
"""
tools/smoke.py — 界面冒烟测试
真实启动：构建虚拟系统 → 启动观测器 → 实例化界面 → 注入第 1 章 → 2 秒后自动关闭。
全程使用临时目录，不会碰玩家的 vfsystem/ 与 save/。
通过则打印 SMOKE OK。

用法：
    python tools/smoke.py            # 图形界面冒烟（会闪一下窗口）
    python tools/smoke.py --console  # 纯文本界面冒烟（无需 tkinter）
    python tools/smoke.py --keep     # 保留临时目录，便于事后翻看
"""
import os
import shutil
import sys
import tempfile
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

from main import Game, make_ui  # noqa: E402


def main() -> None:
    console_mode = '--console' in sys.argv
    keep = '--keep' in sys.argv
    tmp = tempfile.mkdtemp(prefix='houseguest_smoke_')
    try:
        g = Game('冒烟测试员', tts_enabled=False, prefer_gui=not console_mode,
                 vfsystem_dir=os.path.join(tmp, 'vfsystem'),
                 save_path=os.path.join(tmp, 'save', 'game.json'))
        g.build_system()
        g.state.write_access_logs(g.sd)
        g.start_tracker()
        g.overlay = make_ui(g, prefer_gui=not console_mode)
        g._last_ambient = time.time()
        g.overlay.later(1000, g._tick)
        g.start_chapter(g.state.chapter, delay=200)
        if g.ui_kind == 'gui':
            g.overlay.later(2200, g.quit)
            g.overlay.run()
        else:
            # 纯文本模式不进入交互循环，只驱动几帧
            g.overlay.set_hud('冒烟')
            g.overlay.show_bubble('冒烟测试')
            g.on_input('你好')
            time.sleep(0.3)
            g.quit()
    except Exception as e:
        print('SMOKE FAIL:', e)
        if not keep:
            shutil.rmtree(tmp, ignore_errors=True)
        sys.exit(1)
    if not keep:
        shutil.rmtree(tmp, ignore_errors=True)
    print('SMOKE OK')


if __name__ == '__main__':
    main()
