# -*- coding: utf-8 -*-
import unittest

from game import ciphers


class TestCiphers(unittest.TestCase):
    def test_rot13(self):
        self.assertEqual(ciphers.rot13('Hello'), 'Uryyb')
        self.assertEqual(ciphers.rot13(ciphers.rot13('Hello 世界')), 'Hello 世界')

    def test_caesar(self):
        self.assertEqual(ciphers.caesar('abc', 3), 'def')
        self.assertEqual(ciphers.caesar('xyz', 3), 'abc')
        self.assertEqual(ciphers.caesar('ABC 123', 1), 'BCD 123')

    def test_b64_roundtrip(self):
        s = '咕噜不是病毒'
        self.assertEqual(ciphers.b64decode(ciphers.b64encode(s)), s)
        self.assertEqual(ciphers.b64decode('5ZKV5Zmc5LiN5piv55eF5q+S'), '咕噜不是病毒')

    def test_hex(self):
        s = 'hello'
        self.assertEqual(ciphers.hex_decode(ciphers.hex_encode(s)), s)

    def test_morse(self):
        self.assertEqual(ciphers.morse_encode('HELLO GU'), '.... . .-.. .-.. --- / --. ..-')
        self.assertEqual(ciphers.morse_decode('.... . .-.. .-.. --- / --. ..-'), 'HELLO GU')

    def test_acrostic(self):
        lines = ['深夜加班', '夜里见鬼', '勿要慌张', '入梦就好']
        self.assertEqual(ciphers.acrostic(lines), '深夜勿入')

    def test_xor_and_freq(self):
        enc = ciphers.xor_with('test', 42)
        self.assertEqual(ciphers.xor_with(enc, 42), 'test')
        self.assertEqual(ciphers.most_frequent('aaabbbccc'), 'a')


if __name__ == '__main__':
    unittest.main()
