# -*- coding: utf-8 -*-
import os
import tempfile
import unittest

from game.state import State


class TestState(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.tmp.name, 'game.json')

    def tearDown(self):
        self.tmp.cleanup()

    def test_save_load_roundtrip(self):
        st = State.load(self.path)
        st.player_name = '小明'
        st.chapter = 5
        st.inventory = ['钥匙']
        st.treasures_found = [1, 2, 3]
        st.eggs = [1, 4]
        st.save()
        st2 = State.load(self.path)
        self.assertEqual(st2.player_name, '小明')
        self.assertEqual(st2.chapter, 5)
        self.assertEqual(st2.inventory, ['钥匙'])
        self.assertEqual(st2.treasures_found, [1, 2, 3])
        self.assertEqual(st2.eggs, [1, 4])

    def test_on_launch_counts(self):
        st = State.load(self.path)
        st.on_launch()
        self.assertEqual(st.metrics['launches'], 1)
        self.assertTrue(st.metrics['first_visit'])
        st.on_launch()
        self.assertEqual(st.metrics['launches'], 2)

    def test_complete_chapter_advances(self):
        st = State.load(self.path)
        st.chapter = 1
        st.complete_chapter(1)
        self.assertEqual(st.chapter, 2)
        self.assertIn(1, st.treasures_found)
        # 第 12 章完成不推进到 13（由结局流程处理）
        st.chapter = 12
        st.complete_chapter(12)
        self.assertEqual(st.chapter, 12)

    def test_real_facts_nonempty(self):
        st = State.load(self.path)
        st.on_launch()
        facts = st.real_facts()
        self.assertTrue(any('启动' in f for f in facts))
        self.assertTrue(any('分钟' in f for f in facts))

    def test_give_key_and_egg(self):
        st = State.load(self.path)
        st.give_key('k1')
        st.give_key('k1')
        self.assertEqual(st.inventory, ['k1'])
        st.add_egg(3)
        self.assertTrue(st.egg_found(3))
        self.assertEqual(len(st.eggs), 1)


if __name__ == '__main__':
    unittest.main()
