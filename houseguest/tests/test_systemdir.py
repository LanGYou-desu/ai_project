# -*- coding: utf-8 -*-
import os
import tempfile
import unittest

from game.systemdir import SystemDir


class TestSystemDir(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.sd = SystemDir(os.path.join(self.root, 'vfsystem'))

    def tearDown(self):
        self.tmp.cleanup()

    def test_build_creates_structure(self):
        self.sd.build('测试员')
        # 注意：full() 的参数是相对 vfsystem 根目录（= 模拟的 C 盘根）的路径
        for rel in ['Windows/boot.ini', 'Windows/System32/ghost.sys',
                    'Program Files/Calculator/note.txt', 'Users/测试员/Documents/入住协议.txt',
                    'Logs/boot.log', '$Recycle.Bin/已删除的便签1.txt',
                    'System Volume Information/readme.txt', 'ProgramData/entry.txt',
                    'Recovery', 'Temp', 'Users/guest_1/Documents', 'Users/测试员/Secret']:
            self.assertTrue(os.path.exists(self.sd.full(rel)), '缺少: ' + rel)
        # 边界说明文件在 vfsystem 根目录（README.txt）
        self.assertTrue(os.path.exists(os.path.join(self.sd.root, 'README.txt')))

    def test_manifest_written(self):
        self.sd.build('测试员')
        self.assertTrue(os.path.exists(self.sd.manifest_path))

    def test_write_file_and_mtime(self):
        self.sd.build('测试员')
        p = self.sd.write_file('Logs/newlog.txt', '你好', year=2001)
        self.assertTrue(os.path.exists(p))
        import datetime
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(p))
        self.assertEqual(mtime.year, 2001)

    def test_inject_creates_dirs(self):
        self.sd.build('测试员')
        self.sd.inject([{'path': 'Recovery/key.key', 'content': 'key', 'hidden': True, 'note': 'x'}])
        self.assertTrue(os.path.exists(self.sd.full('Recovery/key.key')))

    def test_write_over_existing_hidden_file(self):
        """Windows：覆盖已存在的隐藏文件必须不报错（二次启动会重写彩蛋文件）"""
        self.sd.build('测试员')
        p = self.sd.write_file('Windows/System32/egg9.txt', '第一次', hidden=True)
        p2 = self.sd.write_file('Windows/System32/egg9.txt', '第二次', hidden=True)
        self.assertEqual(p, p2)
        with open(p, 'r', encoding='utf-8') as f:
            self.assertEqual(f.read(), '第二次')

    def test_hidden_attribute(self):
        self.sd.build('测试员')
        self.sd.write_file('Logs/hidden.txt', 'hi', hidden=True)
        # Windows 下应设置隐藏属性；其他平台跳过
        if os.name == 'nt':
            from game.systemdir import is_hidden
            self.assertTrue(is_hidden(self.sd.full('Logs/hidden.txt')))


if __name__ == '__main__':
    unittest.main()
