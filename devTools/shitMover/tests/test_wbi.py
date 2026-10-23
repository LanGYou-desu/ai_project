from __future__ import annotations

import hashlib
import unittest
from urllib.parse import urlencode

from shitmover.wbi import MIXIN_KEY_ENC_TAB, mixin_key, sign


class WbiTest(unittest.TestCase):
    def test_mixin_key_length_and_reorder(self) -> None:
        img = "0123456789abcdef0123456789abcdef"
        sub = "fedcba9876543210fedcba9876543210"
        result = mixin_key(img, sub)
        self.assertEqual(len(result), 32)
        expected = "".join(f"{img}{sub}"[i] for i in MIXIN_KEY_ENC_TAB)[:32]
        self.assertEqual(result, expected)

    def test_sign_adds_wts_and_w_rid(self) -> None:
        img = "0123456789abcdef0123456789abcdef"
        sub = "fedcba9876543210fedcba9876543210"
        params = {"z": "中文", "a": 1, "skip": None}
        signed = sign(params, img, sub, wts=1700000000)
        self.assertEqual(signed["wts"], 1700000000)
        self.assertNotIn("skip", signed)
        self.assertEqual(len(signed["w_rid"]), 32)
        self.assertEqual(list(signed.keys())[-1], "w_rid")

        unsigned = {k: v for k, v in signed.items() if k != "w_rid"}
        query = urlencode(dict(sorted(unsigned.items())))
        expected = hashlib.md5(
            f"{query}{mixin_key(img, sub)}".encode("utf-8")
        ).hexdigest()
        self.assertEqual(signed["w_rid"], expected)

    def test_mixin_key_rejects_short_keys(self) -> None:
        with self.assertRaises(Exception):
            mixin_key("short", "keys")


if __name__ == "__main__":
    unittest.main()
