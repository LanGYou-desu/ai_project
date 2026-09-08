# -*- coding: utf-8 -*-
import unittest

from game import ciphers, story


class TestStory(unittest.TestCase):
    def test_chapter_count_and_ids(self):
        self.assertEqual([c['id'] for c in story.CHAPTERS], list(range(1, 13)))

    def test_every_chapter_has_required_fields(self):
        for ch in story.CHAPTERS:
            self.assertTrue(ch['title'])
            self.assertTrue(ch['act'] in story.ACTS)
            self.assertTrue(ch['intro'])
            self.assertTrue(ch['mission']['title'])
            self.assertTrue(ch['mission']['steps'])
            self.assertGreaterEqual(len(ch['stages']), 1)
            self.assertTrue('inject' in ch)
            self.assertTrue('open_path' in ch)

    def test_answers_are_solvable(self):
        # 每章 answer 目标至少有一个答案，且回答校验逻辑能找到
        for ch in story.CHAPTERS:
            for stage in ch['stages']:
                if stage['type'] == 'answer':
                    self.assertGreaterEqual(len(stage['answers']), 1, ch['title'])

    def test_choice_chapter_12(self):
        ch = story.get_chapter(12)
        self.assertEqual(ch['stages'][0]['type'], 'choice')
        self.assertEqual(len(ch['stages'][0]['options']), 3)

    def test_endings_have_file_ops(self):
        for oid, e in story.ENDINGS.items():
            self.assertTrue(e['title'])
            self.assertTrue(e['text'])
            self.assertTrue(e['file_op']['op'])
            self.assertTrue(e['file_op']['name'])

    def test_hidden_ending_exists(self):
        self.assertTrue(story.HIDDEN_ENDING['title'])

    def test_egg_count_and_uniqueness(self):
        eggs = []
        for ch in story.CHAPTERS:
            for spec in ch.get('inject', []):
                if '咕噜彩蛋' in spec.get('note', ''):
                    eggs.append(spec['path'])
        self.assertEqual(len(eggs), 12)
        self.assertEqual(len(set(eggs)), 12)

    def test_build_inject_replaces_player(self):
        ch = story.get_chapter(2)
        files = story.build_inject(ch, '阿明')
        self.assertTrue(any('Users/阿明/Documents/薯片.txt' == f['path'] for f in files))

    def test_encrypted_files_decode(self):
        ch6 = story.get_chapter(6)
        files6 = story.build_inject(ch6, 'x')
        v = next(f for f in files6 if f['path'].endswith('virus.zip.txt'))
        self.assertEqual(ciphers.b64decode(ciphers.b64decode(v['content'])), '咕噜不是病毒')

        ch11 = story.get_chapter(11)
        files11 = story.build_inject(ch11, 'x')
        t = next(f for f in files11 if f['path'].endswith('truth.txt'))
        plain = ciphers.rot13(ciphers.rot13(t['content']))
        self.assertIn('第 0 位房客', plain)
        self.assertIn('ghost.sys', plain)

    def test_creepy_lines_format(self):
        for line in story.CREEPY_LINES:
            formatted = line.format(launches=5, minutes=60)
            self.assertNotIn('{', formatted)


if __name__ == '__main__':
    unittest.main()
