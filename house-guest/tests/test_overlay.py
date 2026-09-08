# -*- coding: utf-8 -*-
"""
test_overlay.py — 悬浮层

这里只测不需要"看"的部分：窗口几何计算、粒子生命周期（曾经每批粒子都会在
画布上留下永不消失的椭圆）、关闭后定时器不再回调。
tkinter 不可用时自动跳过 GUI 部分。
"""
import tkinter as tk
import unittest

from game import overlay as overlay_mod
from game.overlay import Overlay, SOLID_H, SOLID_W, window_geometry


def _tk_available() -> bool:
    try:
        r = tk.Tk()
        r.destroy()
        return True
    except Exception:
        return False


TK_OK = _tk_available()


class TestWindowGeometry(unittest.TestCase):
    def test_transparent_covers_screen(self):
        w, h, geo, bg, (gx, gy) = window_geometry(1920, 1080, True)
        self.assertEqual((w, h), (1920, 1080))
        self.assertEqual(geo, '1920x1080+0+0')
        self.assertEqual(bg, overlay_mod.MAGENTA)
        self.assertLess(gx, 1920)
        self.assertLess(gy, 1080)

    def test_solid_fallback_is_small_panel_inside_screen(self):
        w, h, geo, bg, (gx, gy) = window_geometry(1920, 1080, False)
        self.assertEqual((w, h), (SOLID_W, SOLID_H))
        self.assertEqual(bg, overlay_mod.PANEL_BG)
        self.assertTrue(geo.startswith('%dx%d' % (SOLID_W, SOLID_H)))
        self.assertIn('+', geo)
        # 面板必须完整落在屏幕内
        x = int(geo.split('+')[1])
        y = int(geo.split('+')[2])
        self.assertGreaterEqual(x, 0)
        self.assertGreaterEqual(y, 0)
        self.assertLessEqual(x + SOLID_W, 1920)
        self.assertLessEqual(y + SOLID_H, 1080)
        # 幽灵也在面板内
        self.assertTrue(0 <= gx <= SOLID_W and 0 <= gy <= SOLID_H)

    def test_solid_fallback_on_tiny_screen(self):
        w, h, geo, bg, _ = window_geometry(200, 150, False)
        self.assertEqual((w, h), (SOLID_W, SOLID_H))
        x = int(geo.split('+')[1])
        y = int(geo.split('+')[2])
        self.assertEqual((x, y), (0, 0))


@unittest.skipUnless(TK_OK, 'tkinter 不可用')
class TestOverlayLifecycle(unittest.TestCase):
    def setUp(self):
        self.overlay = Overlay(
            on_input=lambda t: '',
            on_choose=lambda oid: None,
            on_hint=lambda: '',
            on_open_path=lambda: None,
            on_close=lambda: None,
            on_console=lambda t: None,
        )

    def tearDown(self):
        self.overlay.close()

    def _step(self, n: int = 1) -> None:
        """手动推进主循环，并把排好的定时器取消掉（测试里不跑 mainloop）。"""
        for _ in range(n):
            self.overlay._loop()
            if self.overlay._loop_job:
                try:
                    self.overlay.root.after_cancel(self.overlay._loop_job)
                except Exception:
                    pass
                self.overlay._loop_job = None

    def test_particles_are_drawn_then_removed(self):
        self.overlay.spawn_particles(6)
        self._step(3)
        self.assertEqual(len(self.overlay.canvas.find_withtag('fx')), 6)
        # 粒子寿命最长 70 帧；跑够之后画布上不该再有残留
        self._step(90)
        self.assertEqual(self.overlay._particles, [])
        self.assertEqual(self.overlay.canvas.find_withtag('fx'), ())

    def test_repeated_bursts_do_not_accumulate(self):
        for _ in range(3):
            self.overlay.spawn_particles(4)
            self._step(90)
        self.assertEqual(self.overlay.canvas.find_withtag('fx'), ())

    def test_hud_and_mission_text(self):
        self.overlay.set_hud('第 3/12 章')
        self.overlay.set_mission('任务标题', ['步骤一', '步骤二'])
        self.assertEqual(self.overlay.hud_label['text'], '第 3/12 章')
        self.assertEqual(self.overlay.mission_title['text'], '任务标题')
        self.assertIn('步骤一', self.overlay.mission_text['text'])

    def test_close_is_idempotent_and_stops_timers(self):
        called = []
        self.overlay.later(10, lambda: called.append(1))
        self.overlay.close()
        self.overlay.close()
        self.assertIsNone(self.overlay._after(10, lambda: called.append(2)))
        self.assertTrue(self.overlay._closing)

    def test_loop_stops_after_close(self):
        self.overlay.close()
        self.overlay._loop()  # 不应抛异常，也不应再排定时器
        self.assertIsNone(self.overlay._loop_job)

    def test_glitch_after_close_is_noop(self):
        self.overlay.close()
        self.overlay.glitch(50)  # 不应抛异常

    def test_solid_fallback_when_transparency_unsupported(self):
        original = tk.Tk.attributes

        def fake_attributes(self, name, *args):
            if name == '-transparentcolor':
                raise tk.TclError('not supported')
            return original(self, name, *args)

        tk.Tk.attributes = fake_attributes
        try:
            ov = Overlay(
                on_input=lambda t: '', on_choose=lambda oid: None, on_hint=lambda: '',
                on_open_path=lambda: None, on_close=lambda: None, on_console=lambda t: None,
            )
        finally:
            tk.Tk.attributes = original
        try:
            self.assertFalse(ov.transparent)
            self.assertEqual((ov.W, ov.H), (SOLID_W, SOLID_H))
        finally:
            ov.close()


if __name__ == '__main__':
    unittest.main()
