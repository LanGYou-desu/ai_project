from __future__ import annotations

import unittest

from shitmover.message import FriendRef, build_comment_chunks


def friends(count: int) -> list[FriendRef]:
    return [FriendRef(mid=1000 + i, name=f"好友{i}") for i in range(1, count + 1)]


class CommentChunkTest(unittest.TestCase):
    def test_exactly_ten_is_one_chunk(self) -> None:
        chunks = build_comment_chunks(friends(10), "正文")
        self.assertEqual(len(chunks), 1)
        self.assertFalse(chunks[0].is_reply)
        self.assertEqual(len(chunks[0].at_map), 10)
        self.assertIn("@好友10", chunks[0].message)
        self.assertIn("正文", chunks[0].message)

    def test_twenty_five_creates_three_chunks(self) -> None:
        chunks = build_comment_chunks(
            friends(25), "正文", per_comment=10, reply_suffix="（继续 @）"
        )
        self.assertEqual(len(chunks), 3)
        self.assertEqual([len(chunk.at_map) for chunk in chunks], [10, 10, 5])
        self.assertEqual([chunk.is_reply for chunk in chunks], [False, True, True])
        self.assertIn("正文", chunks[0].message)
        self.assertNotIn("正文", chunks[1].message)
        self.assertIn("（继续 @）", chunks[1].message)
        self.assertIn("@好友11", chunks[1].message)
        self.assertIn("@好友25", chunks[2].message)
        self.assertNotIn("@好友1 ", chunks[1].message)

    def test_only_mentions_without_extra_text(self) -> None:
        chunks = build_comment_chunks(friends(25), "")
        self.assertEqual(len(chunks), 3)
        self.assertEqual(
            chunks[0].message,
            " ".join(f"@好友{i}" for i in range(1, 11)),
        )
        self.assertEqual(
            chunks[1].message,
            " ".join(f"@好友{i}" for i in range(11, 21)),
        )
        self.assertEqual(
            chunks[2].message,
            " ".join(f"@好友{i}" for i in range(21, 26)),
        )
        for chunk in chunks:
            self.assertNotIn("\n", chunk.message)
            self.assertNotIn("搬史", chunk.message)

    def test_duplicate_nickname_rejected(self) -> None:
        duplicated = [
            FriendRef(mid=1, name="同名"),
            FriendRef(mid=2, name="同名"),
        ]
        with self.assertRaises(ValueError):
            build_comment_chunks(duplicated, "正文")

    def test_limit_per_comment(self) -> None:
        with self.assertRaises(ValueError):
            build_comment_chunks(friends(11), "正文", per_comment=11)

    def test_length_limit(self) -> None:
        with self.assertRaises(ValueError):
            build_comment_chunks(friends(1), "很长的正文" * 100, max_length=50)


if __name__ == "__main__":
    unittest.main()
