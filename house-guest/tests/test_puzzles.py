# -*- coding: utf-8 -*-
"""
test_puzzles.py — 谜题一致性
这里的测试只做一件事：**玩家按剧情里写的办法做，能不能真的拿到游戏要求的答案**。
（第 7 章曾经因为"三封信首字"只能得到 3 个字、而第 8 章要求 5 个字，导致卡关。）
"""
import os
import re
import tempfile
import unittest

from game import ciphers, story
from game.state import State
from game.systemdir import SystemDir
from game.tracker import Tracker

SIGNATURE = '——'  # 署名行，取字时要跳过


def _paragraph_initials(content: str) -> str:
    """取正文每一段的第一个字（跳过署名行）。"""
    out = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith(SIGNATURE):
            continue
        m = re.search(r'[\u4e00-\u9fffA-Za-z0-9]', line)
        if m:
            out.append(m.group(0))
    return ''.join(out)


class TestPuzzleConsistency(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.sd = SystemDir(os.path.join(self.tmp.name, 'vfsystem'))
        self.sd.build('测试员')

    def tearDown(self):
        self.tmp.cleanup()

    # ---------------- 第 7 章 → 第 8 章 ----------------
    def test_chapter7_letters_derive_chapter8_code(self):
        ch7 = story.get_chapter(7)
        letters = [f for f in story.build_inject(ch7, '测试员') if f['path'].endswith('信.txt')]
        self.assertEqual(len(letters), 3)
        derived = ''.join(_paragraph_initials(f['content']) for f in letters)
        required = story.get_chapter(8)['stages'][0]['contains']
        self.assertEqual(derived, required,
                         '第 7 章信里取出的暗号（%s）必须等于第 8 章要求的通行证（%s）' % (derived, required))
        # 玩家按剧情拼出的暗号，必须能通过第 7 章的答案校验
        answers = story.get_chapter(7)['stages'][0]['answers']
        self.assertTrue(any(''.join(a.split()) == derived for a in answers),
                        '第 7 章答案列表里没有推导出的暗号: %s' % derived)

    # ---------------- 第 5 章 ----------------
    def test_chapter5_shards_sorted_by_size(self):
        ch5 = story.get_chapter(5)
        shards = [f for f in story.build_inject(ch5, '测试员') if '碎片' in f['path']]
        self.assertEqual(len(shards), 4)
        # 按"文件大小"（真实写入后的字节数）从小到大排序
        sized = []
        for spec in shards:
            p = self.sd.write_file(spec['path'], spec['content'])
            sized.append((os.path.getsize(p), spec['content']))
        sized.sort(key=lambda t: t[0])
        phrase = ''.join(_paragraph_initials(c)[0] for _, c in sized)
        self.assertEqual(phrase, '别进深处')
        self.assertTrue(any(''.join(a.split()) == phrase for a in ch5['stages'][0]['answers']))

    # ---------------- 第 3 章 ----------------
    def test_chapter3_clues_form_code(self):
        ch3 = story.get_chapter(3)
        files = story.build_inject(ch3, '测试员')
        order = ['Calculator', 'ChatRoom', 'MusicBox']
        cn = {'一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
              '六': '6', '七': '7', '八': '8', '九': '9'}
        digits = ''
        for name in order:
            spec = next(f for f in files if name in f['path'])
            m = re.search(r'\d|[一二三四五六七八九]', spec['content'])
            self.assertIsNotNone(m, '线索里没有数字: %s' % spec['path'])
            digits += cn.get(m.group(0), m.group(0))
        self.assertEqual(digits, ch3['stages'][0]['contains'])

    # ---------------- 第 4 章 ----------------
    def test_chapter4_morse_lyrics(self):
        files = story.build_inject(story.get_chapter(4), '测试员')
        lyrics = next(f for f in files if f['path'].endswith('lyrics.txt'))['content']
        self.assertEqual(ciphers.morse_decode(lyrics), 'HELLO GU')
        answers = [''.join(a.split()).casefold() for a in story.get_chapter(4)['stages'][0]['answers']]
        self.assertIn('hellogu', answers)

    # ---------------- 所有章节目标都在 vfsystem 内 ----------------
    def test_all_stage_paths_are_confined(self):
        """story 里的每个路径都必须落在 vfsystem 内（SystemDir 越界会抛 ValueError）。"""
        for ch in story.CHAPTERS:
            for spec in story.build_inject(ch, '测试员'):
                self.sd.full(spec['path'])  # 越界即抛异常
            for stage in ch['stages']:
                for key in ('path', 'from', 'to', 'from_dir', 'to_dir'):
                    if stage.get(key):
                        self.sd.full(str(stage[key]))
                for name in stage.get('names', []):
                    self.sd.full('$Recycle.Bin/%s' % name)
        for e in story.ENDINGS.values():
            op = e['file_op']
            for key in ('name', 'from_dir', 'to_dir'):
                if op.get(key):
                    self.sd.full(str(op[key]).replace('{p}', '测试员'))

    # ---------------- 彩蛋 ----------------
    def test_eggs_are_reachable_and_unique(self):
        paths = []
        for ch in story.CHAPTERS:
            for spec in story.build_inject(ch, '测试员'):
                if '咕噜彩蛋' in spec.get('note', ''):
                    paths.append(spec['path'])
                    self.sd.full(spec['path'])
        self.assertEqual(len(paths), 12)
        self.assertEqual(len(set(paths)), 12)
        self.assertEqual([int(re.search(r'egg(\d+)', p).group(1)) for p in paths], list(range(1, 13)))


class TestChapter7To8EndToEnd(unittest.TestCase):
    """走一遍真实流程：读三封信 → 得到暗号 → 写进夜的通行证 → 章节目标判定通过。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.sd = SystemDir(os.path.join(self.tmp.name, 'vfsystem'))
        self.sd.build('测试员')
        self.state = State.load(os.path.join(self.tmp.name, 'game.json'))
        self.tracker = Tracker(self.sd, self.state, on_stage_done=lambda: None, on_egg=lambda n: None)

    def tearDown(self):
        self.tmp.cleanup()

    def test_derive_then_open_the_night(self):
        self.sd.inject(story.build_inject(story.get_chapter(7), '测试员'))
        letters = ['Users/guest_1/Documents/信.txt', 'Users/guest_2/Documents/信.txt',
                   'Users/guest_3/Documents/信.txt']
        derived = ''
        for rel in letters:
            with open(self.sd.full(rel), 'r', encoding='utf-8') as f:
                derived += _paragraph_initials(f.read())
        self.assertEqual(derived, '深夜勿入夜')

        # 第 8 章：把暗号写进 System Volume Information\passport.txt
        stage = story.get_chapter(8)['stages'][0]
        self.assertFalse(self.tracker.check_file_objective(stage))
        self.sd.write_file('System Volume Information/passport.txt', derived)
        self.assertTrue(self.tracker.check_file_objective(stage))


if __name__ == '__main__':
    unittest.main()
