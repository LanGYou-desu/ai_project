# -*- coding: utf-8 -*-
"""
test_security.py — 虚拟文件系统的边界
- vfsystem 之外的读写必须被拒绝（'..'、绝对路径、盘符、UNC）
- 玩家名必须被清洗后才能参与路径
- attrib 调用不允许走 shell（防止玩家名里的引号/& 注入命令）
"""
import os
import tempfile
import unittest
from unittest import mock

from game import systemdir
from game.systemdir import SystemDir, sanitize_name


class TestPathConfinement(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = os.path.join(self.tmp.name, 'vfsystem')
        self.sd = SystemDir(self.root)
        self.sd.build('测试员')

    def tearDown(self):
        self.tmp.cleanup()

    def _outside(self, name='escaped.txt'):
        return os.path.join(self.tmp.name, name)

    def test_parent_escape_rejected(self):
        for bad in ['../escaped.txt', '../../escaped.txt',
                    'Windows/../../escaped.txt', '..\\..\\escaped.txt']:
            with self.assertRaises(ValueError, msg=bad):
                self.sd.write_file(bad, 'PWNED')
        self.assertFalse(os.path.exists(self._outside()))

    def test_absolute_and_drive_paths_rejected(self):
        for bad in ['/etc/passwd', 'C:/Windows/Temp/x.txt', 'C:\\Windows\\x.txt', '//host/share/x']:
            with self.assertRaises(ValueError, msg=bad):
                self.sd.full(bad)
            with self.assertRaises(ValueError, msg=bad):
                self.sd.write_file(bad, 'x')

    def test_inject_rejects_escape(self):
        with self.assertRaises(ValueError):
            self.sd.inject([{'path': '../evil.txt', 'content': 'x'}])
        self.assertFalse(os.path.exists(self._outside('evil.txt')))

    def test_exists_and_full_reject_escape(self):
        with self.assertRaises(ValueError):
            self.sd.exists('../..')
        with self.assertRaises(ValueError):
            self.sd.full('../..')

    def test_legal_paths_still_work(self):
        p = self.sd.write_file('Users/测试员/Documents/新文件.txt', '内容')
        self.assertTrue(os.path.exists(p))
        self.assertEqual(self.sd.rel(p), os.path.join('Users', '测试员', 'Documents', '新文件.txt'))
        self.assertTrue(self.sd.exists('Users/测试员/Documents/新文件.txt'))
        # 冗余但合法的写法（'./'、反斜杠）应被规范化而不是拒绝
        self.assertTrue(self.sd.exists('./Users\\测试员\\Documents\\新文件.txt'))

    def test_root_level_file(self):
        p = self.sd.write_file('根目录文件.txt', 'hi')
        self.assertTrue(os.path.exists(p))


class TestSanitizeName(unittest.TestCase):
    def test_illegal_characters_removed(self):
        self.assertEqual(sanitize_name('a/b\\c:d*e?f"g<h>i|j'), 'abcdefghij')

    def test_shell_metacharacters_removed(self):
        self.assertEqual(sanitize_name('x" & calc & "'), 'x & calc &')
        self.assertNotIn('"', sanitize_name('x" & calc & "'))

    def test_control_chars_and_dots_stripped(self):
        self.assertEqual(sanitize_name('  ..阿明..  '), '阿明')
        self.assertEqual(sanitize_name('a\x00b\nc'), 'abc')

    def test_empty_and_reserved_fall_back(self):
        self.assertEqual(sanitize_name(''), '主人')
        self.assertEqual(sanitize_name('   '), '主人')
        self.assertEqual(sanitize_name('..'), '主人')
        self.assertEqual(sanitize_name('CON'), '主人')
        self.assertEqual(sanitize_name('lpt9'), '主人')

    def test_length_capped(self):
        self.assertEqual(len(sanitize_name('阿' * 100)), 24)

    def test_build_uses_sanitized_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            sd = SystemDir(os.path.join(tmp, 'vfsystem'))
            sd.build('../evil')
            # 名字被清洗后只会在 Users/evil 下创建目录，不会逃出 vfsystem
            self.assertTrue(os.path.isdir(sd.full('Users/evil')))
            self.assertFalse(os.path.exists(os.path.join(tmp, 'evil')))


class TestNoShellInjection(unittest.TestCase):
    def test_hide_and_show_use_argv_not_shell(self):
        with mock.patch.object(systemdir.subprocess, 'run') as run:
            systemdir.hide('C:\\vfsystem\\Users\\x" & calc & "\\Documents')
            args, kwargs = run.call_args
            self.assertIsInstance(args[0], list)
            self.assertEqual(args[0][0], 'attrib')
            self.assertEqual(args[0][1], '+h')
            self.assertNotIn('shell', kwargs)
            self.assertNotEqual(kwargs.get('shell'), True)

    def test_show_uses_argv(self):
        with mock.patch.object(systemdir.subprocess, 'run') as run:
            systemdir.show('C:\\vfsystem\\a b\\c.txt')
            args = run.call_args[0]
            self.assertIsInstance(args[0], list)
            self.assertEqual(args[0], ['attrib', '-h', 'C:\\vfsystem\\a b\\c.txt'])


if __name__ == '__main__':
    unittest.main()
