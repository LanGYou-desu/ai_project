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


if __name__ == '__main__':
    unittest.main()
