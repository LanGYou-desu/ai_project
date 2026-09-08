# -*- coding: utf-8 -*-
"""
test_ghost.py — 咕噜的对话/提示逻辑
重点：提示计数必须按章节分别推进（整局只创建一个 GhostBrain 实例）。
"""
import os
import tempfile
import unittest

from game import story
from game.ghost import GhostBrain
from game.state import State


class TestGhostHints(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = State.load(os.path.join(self.tmp.name, 'game.json'))
        self.ghost = GhostBrain(self.state)

    def tearDown(self):
        self.tmp.cleanup()

    def test_hints_advance_within_chapter(self):
        total = len(story.get_chapter(1)['hints'])
        for i in range(total):
            self.assertTrue(self.ghost.hint(1).startswith('提示 %d/%d' % (i + 1, total)))

    def test_hints_stay_on_last(self):
        total = len(story.get_chapter(1)['hints'])
        for _ in range(total + 3):
            last = self.ghost.hint(1)
        self.assertTrue(last.startswith('提示 %d/%d' % (total, total)))

    def test_hint_counter_does_not_leak_between_chapters(self):
        """第 1 章用掉全部提示后，第 2 章的提示必须从第 1 条开始。"""
        for _ in range(len(story.get_chapter(1)['hints']) + 2):
            self.ghost.hint(1)
        self.state.chapter = 2
        first = self.ghost.hint(2)
        self.assertTrue(first.startswith('提示 1/%d' % len(story.get_chapter(2)['hints'])),
                        '第 2 章的第一条提示被上一章的计数带跑了: %s' % first)

    def test_hint_without_hints(self):
        self.assertIn('没有提示', self.ghost.hint(12))

    def test_hint_via_respond(self):
        reply = self.ghost.respond('提示')
        self.assertTrue(reply.startswith('提示 1/'))


class TestGhostDecode(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = State.load(os.path.join(self.tmp.name, 'game.json'))
        self.ghost = GhostBrain(self.state)

    def tearDown(self):
        self.tmp.cleanup()

    def test_rot13_and_base64(self):
        self.assertEqual(self.ghost.try_decode('解码 rot13 Uryyb'), 'Hello')
        self.assertEqual(self.ghost.try_decode('解码 base64 5ZKV5Zmc5LiN5piv55eF5q+S'), '咕噜不是病毒')

    def test_morse_and_hex(self):
        self.assertEqual(self.ghost.try_decode('解码 摩斯 .... ..'), 'HI')
        self.assertEqual(self.ghost.try_decode('解码 hex 6869'), 'hi')

    def test_caesar_with_shift(self):
        self.assertEqual(self.ghost.try_decode('解码 caesar:3 abc'), 'def')

    def test_auto_decode_lists_rot13(self):
        out = self.ghost.try_decode('解码 auto Uryyb')
        self.assertIn('ROT13', out)
        self.assertIn('Hello', out)

    def test_auto_decode_nothing_found(self):
        self.assertIn('什么都没解出来', self.ghost.try_decode('解码 auto ？？？'))

    def test_unknown_algorithm_lists_auto(self):
        out = self.ghost.try_decode('解码 天书 abc')
        self.assertIn('auto', out)

    def test_decode_without_payload(self):
        self.assertIn('你要我解什么', self.ghost.try_decode('解码 rot13'))

    def test_non_decode_text_returns_none(self):
        self.assertIsNone(self.ghost.try_decode('你好'))


class TestGhostRespond(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = State.load(os.path.join(self.tmp.name, 'game.json'))
        self.state.player_name = '阿明'
        self.state.on_launch()
        self.ghost = GhostBrain(self.state)

    def tearDown(self):
        self.tmp.cleanup()

    def test_empty_input(self):
        self.assertTrue(self.ghost.respond(''))

    def test_greeting_uses_player_name(self):
        self.assertIn('阿明', self.ghost.respond('你好'))

    def test_real_facts_are_reachable(self):
        """存档里的真实本机指标必须真的能通过对话说出来（原先 real_facts 是死代码）。"""
        reply = self.ghost.respond('你知道什么？')
        self.assertIn('启动', reply)
        self.assertIn('分钟', reply)

    def test_poke(self):
        self.assertTrue(self.ghost.respond('(戳了戳咕噜)'))

    def test_egg_progress(self):
        self.state.add_egg(1)
        self.assertIn('1 / 12', self.ghost.respond('彩蛋'))

    def test_ambient_never_empty(self):
        for ch in range(1, 14):
            self.state.chapter = ch
            self.assertTrue(self.ghost.ambient())


if __name__ == '__main__':
    unittest.main()
