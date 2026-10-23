from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from shitmover.config import ConfigError, load_config


class ConfigTest(unittest.TestCase):
    def write_config(self, data: dict) -> Path:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / "config.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def test_bare_uids_and_relative_paths(self) -> None:
        path = self.write_config(
            {
                "keywords": "抽象",
                "friends": [123, "456", {"mid": 789, "name": "好友"}],
                "min_at_ratio": 0.1,
            }
        )
        cfg = load_config(path)
        self.assertEqual(cfg.keywords, ["抽象"])
        self.assertEqual([friend.mid for friend in cfg.friends], [123, 456, 789])
        self.assertEqual(cfg.friends[2].name, "好友")
        self.assertEqual(cfg.profile_dir, path.parent.resolve() / "browser_profile")

    def test_defaults_are_two_posts_and_mentions_only(self) -> None:
        path = self.write_config({"keywords": ["x"]})
        cfg = load_config(path)
        self.assertEqual(cfg.max_posts_per_run, 2)
        self.assertEqual(cfg.search_pages, 0)
        self.assertEqual(cfg.comment_template, "")
        self.assertEqual(cfg.reply_suffix, "")

    def test_rejects_bad_ratio(self) -> None:
        path = self.write_config({"keywords": ["x"], "min_at_ratio": 5})
        with self.assertRaises(ConfigError):
            load_config(path)

    def test_rejects_more_than_ten_mentions(self) -> None:
        path = self.write_config(
            {"keywords": ["x"], "mentions_per_comment": 11}
        )
        with self.assertRaises(ConfigError):
            load_config(path)

    def test_empty_friends_ok_for_scan_but_not_post(self) -> None:
        path = self.write_config({"keywords": ["x"], "friends": []})
        cfg = load_config(path)
        self.assertEqual(cfg.friends, [])
        with self.assertRaises(ConfigError):
            cfg.validate_for_posting()

    def test_duplicate_friend_mid_rejected_for_post(self) -> None:
        path = self.write_config({"keywords": ["x"], "friends": [1, 1]})
        cfg = load_config(path)
        with self.assertRaises(ConfigError):
            cfg.validate_for_posting()


if __name__ == "__main__":
    unittest.main()
