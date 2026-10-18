# -*- coding: utf-8 -*-
"""
test_console_ui.py — 纯文本界面（无 tkinter 时的退化方案）
"""
import io
import time
import unittest

from game.console_ui import ConsoleUI


class TestConsoleUI(unittest.TestCase):
    def setUp(self):
        self.out = io.StringIO()
        self.choices = []
        self.replies = []
        self.ui = ConsoleUI(
            on_input=lambda t: self.replies.append(t) or ('回声：' + t),
            on_choose=lambda oid: self.choices.append(oid),
            on_hint=lambda: '提示内容',
            on_open_path=lambda: self.replies.append('open'),
            on_close=lambda: self.replies.append('close'),
            on_console=lambda t: None,
            stream=self.out,
        )

    def tearDown(self):
        self.ui.close()

    def test_mission_and_hud_are_printed(self):
        self.ui.set_mission('入住手续', ['第一步', '第二步'])
        self.ui.set_hud('第 1/12 章')
        text = self.out.getvalue()
        self.assertIn('入住手续', text)
        self.assertIn('• 第一步', text)
        self.assertIn('第 1/12 章', text)

    def test_bubble_and_open_target(self):
        self.ui.show_bubble('你好呀')
        self.ui.set_open_target('📂 Windows')
        text = self.out.getvalue()
        self.assertIn('咕噜> 你好呀', text)
        self.assertIn('Windows', text)

    def test_choice_by_number(self):
        self.ui.show_choice('零点之前', '选一个', [
            {'id': 'A', 'label': '带它走', 'desc': 'a'},
            {'id': 'B', 'label': '让它留下', 'desc': 'b'},
            {'id': 'C', 'label': '删除它', 'desc': 'c'},
        ])
        self.assertTrue(self.ui._handle_line('2'))
        self.assertEqual(self.choices, ['B'])
        self.assertIsNone(self.ui._pending)

    def test_invalid_choice_keeps_pending(self):
        self.ui.show_choice('标题', '正文', [{'id': 'A', 'label': 'x', 'desc': ''}])
        self.assertTrue(self.ui._handle_line('9'))
        self.assertIsNotNone(self.ui._pending)
        self.assertTrue(self.ui._handle_line('abc'))
        self.assertIsNotNone(self.ui._pending)
        self.assertTrue(self.ui._handle_line('1'))
        self.assertEqual(self.choices, ['A'])

    def test_ending_actions_by_number(self):
        fired = []
        self.ui.show_ending('结局 A', '正文', [
            {'label': '继续', 'action': lambda: fired.append('go')},
            {'label': '退出', 'action': lambda: fired.append('quit')},
        ])
        self.assertTrue(self.ui._handle_line('1'))
        self.assertEqual(fired, ['go'])

    def test_quit_line(self):
        self.assertFalse(self.ui._handle_line('quit'))
        self.assertFalse(self.ui._handle_line('Q'))

    def test_help_and_hint_and_open(self):
        self.assertTrue(self.ui._handle_line('help'))
        self.assertTrue(self.ui._handle_line('提示'))
        self.assertTrue(self.ui._handle_line('打开'))
        text = self.out.getvalue()
        self.assertIn('可用输入', text)
        self.assertIn('提示内容', text)
        self.assertIn('open', self.replies)

    def test_plain_text_goes_to_on_input(self):
        self.ui._handle_line('解码 rot13 Uryyb')
        self.assertEqual(self.replies, ['解码 rot13 Uryyb'])
        self.assertIn('回声', self.out.getvalue())

    def test_later_runs_callback(self):
        flag = []
        self.ui.later(10, lambda: flag.append(1))
        deadline = time.time() + 2
        while not flag and time.time() < deadline:
            time.sleep(0.02)
        self.assertEqual(flag, [1])

    def test_post_runs_inline(self):
        flag = []
        self.ui.post(lambda: flag.append(2))
        self.assertEqual(flag, [2])

    def test_close_cancels_timers_and_blocks_later(self):
        flag = []
        self.ui.close()
        self.ui.later(10, lambda: flag.append(3))
        self.ui.post(lambda: flag.append(4))
        time.sleep(0.1)
        self.assertEqual(flag, [])

    def test_mini_game_is_gracefully_skipped(self):
        called = []
        self.ui.show_mini_memory(on_done=lambda ok: called.append(ok))
        self.assertIn('图形界面', self.out.getvalue())
        self.assertEqual(called, [])


if __name__ == '__main__':
    unittest.main()
