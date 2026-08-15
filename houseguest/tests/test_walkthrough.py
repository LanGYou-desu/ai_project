# -*- coding: utf-8 -*-
"""
test_walkthrough.py — 无头全流程通关测试
用真实文件操作模拟玩家把 12 章全部打通，验证：
- 每章的 answer 目标可回答、file 目标可完成
- 章节注入的文件路径真实存在
- 三种结局的真实文件操作可达
"""
import os
import shutil
import tempfile
import unittest

from game import story
from game.state import State
from game.systemdir import SystemDir
from game.tracker import Tracker


def _norm(s: str) -> str:
    return ''.join(str(s).split()).casefold()


def _check_answer(stage, text: str) -> bool:
    t = _norm(text)
    for a in stage.get('answers', []):
        na = _norm(a)
        if t == na:
            return True
        if len(na) >= 2 and na in t:
            return True
    return False


class TestWalkthrough(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.sd = SystemDir(os.path.join(self.tmp.name, 'vfsystem'))
        self.sd.build('测试员')
        self.state = State.load(os.path.join(self.tmp.name, 'game.json'))
        self.tracker = Tracker(self.sd, self.state, on_stage_done=lambda: None, on_egg=lambda n: None)

    def tearDown(self):
        self.tmp.cleanup()

    def _do_file_stage(self, stage):
        op = stage['op']
        if op == 'create_file':
            self.sd.write_file(stage['path'], stage['contains'])
        elif op == 'collect':
            for name in stage['names']:
                self.sd.write_file('%s/%s' % (stage['to_dir'], name), 'x')
        elif op == 'move_file':
            src = self.sd.full('%s/%s' % (stage['from_dir'], stage['name']))
            dst = self.sd.full('%s/%s' % (stage['to_dir'], stage['name']))
            os.rename(src, dst)
        elif op == 'delete':
            os.remove(self.sd.full('%s/%s' % (stage['from_dir'], stage['name'])))
        elif op == 'copy_or_move':
            shutil.copy2(self.sd.full('%s/%s' % (stage['from_dir'], stage['name'])),
                         self.sd.full('%s/%s' % (stage['to_dir'], stage['name'])))

    def solve_chapter(self, n: int) -> None:
        ch = story.get_chapter(n)
        self.assertIsNotNone(ch, '缺章节 %d' % n)
        files = story.build_inject(ch, '测试员')
        self.sd.inject(files)
        idx = 0
        for stage in ch['stages']:
            if stage['type'] == 'answer':
                self.assertTrue(_check_answer(stage, stage['answers'][0]),
                                '第 %d 章 answer 不可答: %s' % (n, stage['question']))
            elif stage['type'] == 'file':
                self.assertFalse(self.tracker.check_file_objective(stage),
                                 '第 %d 章 file 目标初始应未完成: %s' % (n, stage.get('op')))
                self._do_file_stage(stage)
                self.assertTrue(self.tracker.check_file_objective(stage),
                                '第 %d 章 file 目标无法完成: %s' % (n, stage.get('op')))
            elif stage['type'] == 'choice':
                self.assertEqual(len(stage['options']), 3)
            idx += 1
        self.assertEqual(idx, len(ch['stages']))
        # 模拟完成本章
        if n < 12:
            self.state.complete_chapter(n)

    def test_inject_files_exist(self):
        for n in range(1, 13):
            ch = story.get_chapter(n)
            files = story.build_inject(ch, '测试员')
            self.sd.inject(files)
            for spec in files:
                p = self.sd.full(spec['path'])
                self.assertTrue(os.path.exists(p), '第 %d 章注入文件缺失: %s' % (n, spec['path']))

    def test_full_campaign(self):
        for n in range(1, 12):
            self.solve_chapter(n)
            self.assertEqual(self.state.chapter, n + 1, '章节推进失败 at %d' % n)
        # 第 12 章：选择结局 A
        ch12 = story.get_chapter(12)
        self.solve_chapter(12)
        self.state.flags['ending_choice'] = 'A'
        op = dict(story.ENDINGS['A']['file_op'])
        op['to_dir'] = op['to_dir'].replace('{p}', '测试员')
        self.assertFalse(self.tracker.check_ending_action(op))
        self._do_file_stage(op)
        self.assertTrue(self.tracker.check_ending_action(op), '结局 A 文件操作不可达')
        self.state.endings.append('A')

    def test_all_endings_reachable(self):
        # 先注入第 12 章文件（创建「出口」目录）
        self.sd.inject(story.build_inject(story.get_chapter(12), '测试员'))
        self.state.flags['ending_choice'] = 'X'
        for oid in ['A', 'B', 'C']:
            op = dict(story.ENDINGS[oid]['file_op'])
            op['to_dir'] = str(op.get('to_dir', '')).replace('{p}', '测试员')
            op['from_dir'] = str(op.get('from_dir', '')).replace('{p}', '测试员')
            # 确保源文件存在（A/B 的 ghost.sys 由基础系统提供；C 的删除目标也来自基础系统）
            src = self.sd.full('%s/%s' % (op['from_dir'], op['name']))
            if not os.path.exists(src):
                self.sd.write_file('%s/%s' % (op['from_dir'], op['name']), 'x')
            self.assertFalse(self.tracker.check_ending_action(op))
            self._do_file_stage(op)
            self.assertTrue(self.tracker.check_ending_action(op), '结局 %s 不可达' % oid)


if __name__ == '__main__':
    unittest.main()
