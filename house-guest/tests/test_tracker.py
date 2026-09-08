# -*- coding: utf-8 -*-
import os
import shutil
import tempfile
import unittest

from game import tracker as tracker_mod
from game.state import State
from game.systemdir import SystemDir


class TestTracker(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = os.path.join(self.tmp.name, 'vfsystem')
        self.sd = SystemDir(self.root)
        self.sd.build('测试员')
        self.save = os.path.join(self.tmp.name, 'game.json')
        self.state = State.load(self.save)
        self.events = []
        self.eggs = []
        self.tracker = tracker_mod.Tracker(
            self.sd, self.state,
            on_stage_done=lambda: self.events.append('stage'),
            on_egg=lambda n: self.eggs.append(n),
            on_event=lambda k, p: self.events.append((k, p)),
        )

    def tearDown(self):
        self.tmp.cleanup()

    def _snap(self):
        return tracker_mod.snapshot(self.sd)

    def test_create_file_objective(self):
        stage = {'type': 'file', 'op': 'create_file', 'path': 'Windows/System32/通行证.txt', 'contains': '396'}
        self.assertFalse(self.tracker.check_file_objective(stage))
        self.sd.write_file('Windows/System32/通行证.txt', '密码是 396 ！')
        self.assertTrue(self.tracker.check_file_objective(stage))

    def test_collect_objective(self):
        stage = {'type': 'file', 'op': 'collect', 'names': ['薯片.txt', '可乐.txt'], 'to_dir': '$Recycle.Bin'}
        self.assertFalse(self.tracker.check_file_objective(stage))
        self.sd.write_file('$Recycle.Bin/薯片.txt', 'x')
        self.assertFalse(self.tracker.check_file_objective(stage))
        self.sd.write_file('$Recycle.Bin/可乐.txt', 'x')
        self.assertTrue(self.tracker.check_file_objective(stage))

    def test_move_file_objective(self):
        stage = {'type': 'file', 'op': 'move_file', 'name': 'key.key', 'from_dir': 'Recovery', 'to_dir': 'ProgramData'}
        self.sd.write_file('Recovery/key.key', 'key')
        self.assertFalse(self.tracker.check_file_objective(stage))
        os.rename(self.sd.full('Recovery/key.key'), self.sd.full('ProgramData/key.key'))
        self.assertTrue(self.tracker.check_file_objective(stage))

    def test_delete_objective(self):
        stage = {'type': 'file', 'op': 'delete', 'name': 'ghost.sys', 'from_dir': 'Windows/System32'}
        self.assertFalse(self.tracker.check_file_objective(stage))
        os.remove(self.sd.full('Windows/System32/ghost.sys'))
        self.assertTrue(self.tracker.check_file_objective(stage))

    def test_copy_or_move_objective(self):
        stage = {'type': 'file', 'op': 'copy_or_move', 'name': 'ghost.sys', 'from_dir': 'Windows/System32', 'to_dir': 'Users/测试员/Desktop'}
        self.assertFalse(self.tracker.check_file_objective(stage))
        shutil.copy2(self.sd.full('Windows/System32/ghost.sys'), self.sd.full('Users/测试员/Desktop/ghost.sys'))
        self.assertTrue(self.tracker.check_file_objective(stage))

    def test_egg_detection(self):
        self.sd.write_file('$Recycle.Bin/egg2.txt', '蛋')
        self.tracker._check_eggs(self._snap())
        self.assertEqual(self.eggs, [2])

    def test_snapshot_diff_detects_create(self):
        self.sd.write_file('Logs/newfile.txt', 'hi')
        new = tracker_mod.snapshot(self.sd)
        created = [p for p in set(new) - set(self.tracker._snap)]
        self.assertTrue(any('newfile' in p for p in created))


class TestTrackerRobustness(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.sd = SystemDir(os.path.join(self.tmp.name, 'vfsystem'))
        self.sd.build('测试员')
        self.state = State.load(os.path.join(self.tmp.name, 'game.json'))
        self.eggs = []
        self.tracker = tracker_mod.Tracker(
            self.sd, self.state, on_stage_done=lambda: None, on_egg=lambda n: self.eggs.append(n))

    def tearDown(self):
        self.tracker.stop()
        self.tmp.cleanup()

    def test_contains_list_without_contains_does_not_raise(self):
        """stage 只有 contains_list 时，不能因为 eager 取 stage['contains'] 而判负。"""
        stage = {'type': 'file', 'op': 'create_file', 'path': 'Logs/a.txt',
                 'contains_list': ['甲', '乙']}
        self.assertFalse(self.tracker.check_file_objective(stage))
        self.sd.write_file('Logs/a.txt', '甲乙')
        self.assertTrue(self.tracker.check_file_objective(stage))
        self.sd.write_file('Logs/a.txt', '甲')
        self.assertFalse(self.tracker.check_file_objective(stage))

    def test_create_file_stage_without_keywords(self):
        stage = {'type': 'file', 'op': 'create_file', 'path': 'Logs/b.txt'}
        self.assertFalse(self.tracker.check_file_objective(stage))
        self.sd.write_file('Logs/b.txt', '随便')
        self.assertTrue(self.tracker.check_file_objective(stage))

    def test_escaping_objective_path_is_rejected(self):
        """story 数据被污染时也不能读写 vfsystem 之外的东西。"""
        stage = {'type': 'file', 'op': 'create_file', 'path': '../../evil.txt'}
        self.assertFalse(self.tracker.check_file_objective(stage))
        stage2 = {'type': 'file', 'op': 'delete', 'name': 'x.txt', 'from_dir': '../..'}
        self.assertFalse(self.tracker.check_file_objective(stage2))
        stage3 = {'type': 'file', 'op': 'collect', 'names': ['../x.txt'], 'to_dir': '$Recycle.Bin'}
        self.assertFalse(self.tracker.check_file_objective(stage3))

    def test_egg_regex_requires_exact_filename(self):
        self.sd.write_file('$Recycle.Bin/egg7.txt.bak', 'x')
        self.tracker._check_eggs(tracker_mod.snapshot(self.sd))
        self.assertEqual(self.eggs, [])
        self.sd.write_file('$Recycle.Bin/egg7.txt', 'x')
        self.tracker._check_eggs(tracker_mod.snapshot(self.sd))
        self.assertEqual(self.eggs, [7])

    def test_egg_in_subfolder_counts(self):
        self.sd.write_file('$Recycle.Bin/sub/egg3.txt', 'x')
        self.tracker._check_eggs(tracker_mod.snapshot(self.sd))
        self.assertEqual(self.eggs, [3])

    def test_egg_outside_recycle_bin_is_ignored(self):
        self.sd.write_file('Logs/egg1.txt', 'x')
        self.tracker._check_eggs(tracker_mod.snapshot(self.sd))
        self.assertEqual(self.eggs, [])

    def test_tracker_can_restart_after_stop(self):
        """reset_game 会重建观测器；同一个实例重启后也必须真的跑起来。"""
        self.tracker.start()
        self.tracker.stop()
        self.assertIsNone(self.tracker._thread)
        self.tracker.start()
        self.assertIsNotNone(self.tracker._thread)
        self.assertTrue(self.tracker._thread.is_alive())
        self.tracker.stop()

    def test_stage_done_advances_flag_and_saves(self):
        self.state.chapter = 3
        self.sd.write_file('Windows/System32/passport.txt', '396')
        self.tracker._tick()
        self.assertEqual(self.state.flags.get('stage_3'), 1)


if __name__ == '__main__':
    unittest.main()
