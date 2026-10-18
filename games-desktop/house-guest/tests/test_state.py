# -*- coding: utf-8 -*-
import json
import os
import tempfile
import threading
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


class TestStateDurability(unittest.TestCase):
    """存档写入的健壮性：原子替换、线程安全、目录缺失、损坏文件。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def test_save_without_directory(self):
        """save_path 只有文件名时（没有目录）也必须能保存。"""
        cwd = os.getcwd()
        os.chdir(self.tmp.name)
        try:
            st = State('game.json')
            st.chapter = 3
            st.save()
            self.assertTrue(os.path.exists(os.path.join(self.tmp.name, 'game.json')))
            self.assertEqual(State.load('game.json').chapter, 3)
        finally:
            os.chdir(cwd)

    def test_save_is_atomic_and_creates_parent_dir(self):
        path = os.path.join(self.tmp.name, 'deep', 'nested', 'game.json')
        st = State.load(path)
        st.save()
        self.assertTrue(os.path.exists(path))
        self.assertFalse(os.path.exists(path + '.tmp'))
        with open(path, 'r', encoding='utf-8') as f:
            json.load(f)  # 必须是完整合法的 JSON

    def test_concurrent_saves_keep_file_valid(self):
        """观测线程与主线程同时存档时，文件不能被写坏。"""
        path = os.path.join(self.tmp.name, 'game.json')
        st = State.load(path)
        errors = []

        def worker(n):
            try:
                for i in range(30):
                    st.chapter = n
                    st.flags['stage_%d' % n] = i
                    st.save()
            except Exception as e:  # pragma: no cover
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(n,)) for n in range(1, 5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(errors, [])
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self.assertIn('chapter', data)
        self.assertEqual(State.load(path).flags.keys() >= {'stage_1'}, True)

    def test_loaded_flag_marks_fresh_start(self):
        path = os.path.join(self.tmp.name, 'game.json')
        self.assertFalse(State.load(path).loaded)
        st = State.load(path)
        st.save()
        self.assertTrue(State.load(path).loaded)

    def test_corrupt_save_falls_back_to_defaults(self):
        path = os.path.join(self.tmp.name, 'game.json')
        with open(path, 'w', encoding='utf-8') as f:
            f.write('{ not json')
        st = State.load(path)
        self.assertEqual(st.chapter, 1)
        self.assertFalse(st.loaded)

    def test_on_close_adds_at_least_one_minute(self):
        st = State.load(os.path.join(self.tmp.name, 'game.json'))
        st.on_launch()
        st.on_close()
        self.assertGreaterEqual(st.metrics['total_minutes'], 1)


if __name__ == '__main__':
    unittest.main()
