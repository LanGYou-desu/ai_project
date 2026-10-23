from __future__ import annotations

import unittest

from shitmover.cli import _parse_bvid, _parse_uids
from shitmover.config import ConfigError


class ParseInputTest(unittest.TestCase):
    def test_parse_bvid_from_bvid_and_url(self) -> None:
        self.assertEqual(_parse_bvid("BV1xx411c7mD"), "BV1xx411c7mD")
        self.assertEqual(
            _parse_bvid("https://www.bilibili.com/video/BV1xx411c7mD/?p=1"),
            "BV1xx411c7mD",
        )
        self.assertEqual(_parse_bvid("bv1xx411c7mD"), "BV1xx411c7mD")

    def test_parse_bvid_rejects_unknown_input(self) -> None:
        with self.assertRaises(ConfigError):
            _parse_bvid("https://www.bilibili.com/video/av123")

    def test_parse_uids_supports_repeat_and_commas(self) -> None:
        self.assertEqual(
            _parse_uids(["123,456", "789", "123"]),
            [123, 456, 789],
        )

    def test_parse_uids_rejects_invalid_value(self) -> None:
        with self.assertRaises(ConfigError):
            _parse_uids(["abc"])


if __name__ == "__main__":
    unittest.main()
