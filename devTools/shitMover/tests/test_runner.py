from __future__ import annotations

import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from shitmover.api import CommentStats, SearchVideo
from shitmover.message import FriendRef
from shitmover.runner import (
    VideoCandidate,
    comment_url,
    post_candidate,
    run_post,
    scan_candidates,
    send_manual,
)
from shitmover.state import StateStore, UidStateStore


class FakeState:
    def __init__(self, processed: set[str] | None = None):
        self.processed = processed or set()

    def is_processed(self, bvid: str) -> bool:
        return bvid in self.processed

    def find_processed(self, bvid: str, aid: int | None = None) -> str | None:
        return bvid if bvid in self.processed else None

    def is_processed_video(self, bvid: str, aid: int | None = None) -> bool:
        return self.find_processed(bvid, aid) is not None

    def get(self, bvid: str) -> dict | None:
        return {"status": "done"} if bvid in self.processed else None


class FakeApi:
    def __init__(self) -> None:
        self.called_aids: list[int] = []

    def comment_stats(
        self,
        aid: int,
        pages: int,
        sort: str,
        include_replies: bool,
    ) -> CommentStats:
        self.called_aids.append(aid)
        return CommentStats(total_comments=100, sampled=10, at_comments=5)


class PostingApi:
    def __init__(self) -> None:
        self.opened: list[str] = []
        self.posts: list[dict] = []
        self._next_rpid = 1

    def open_video(self, url: str) -> None:
        self.opened.append(url)

    def post_comment(
        self,
        aid: int,
        message: str,
        root: str | None = None,
        parent: str | None = None,
        at_map: dict[str, int] | None = None,
    ) -> dict:
        rpid = str(self._next_rpid)
        self._next_rpid += 1
        self.posts.append(
            {
                "aid": aid,
                "message": message,
                "root": root,
                "parent": parent,
                "at_map": at_map,
            }
        )
        return {"rpid": rpid, "rpid_str": rpid}


class RecordingState:
    def __init__(self) -> None:
        self.records: dict[str, dict] = {}

    def mark(self, bvid: str, record: dict) -> None:
        self.records[bvid] = record


def make_config(max_posts: int = 2) -> SimpleNamespace:
    return SimpleNamespace(
        keywords=["测试"],
        search_pages=0,
        min_at_ratio=0.3,
        sample_pages=3,
        comment_sort="hot",
        include_replies=False,
        max_posts_per_run=max_posts,
        request_delay_seconds=0,
    )


def make_video(number: int) -> SearchVideo:
    return SearchVideo(
        bvid=f"BV{number}",
        aid=number,
        title=f"视频{number}",
        author="UP",
        play=0,
        total_comments=100,
        url=f"https://www.bilibili.com/video/BV{number}/",
    )


def make_posting_config(state_file: Path | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        comment_template="",
        reply_suffix="",
        mentions_per_comment=10,
        max_comment_length=1000,
        post_delay_seconds=0,
        require_confirm=False,
        max_posts_per_run=1,
        state_file=state_file or Path("state.json"),
    )


def make_friends(count: int) -> list[FriendRef]:
    return [FriendRef(mid=1000 + i, name=f"好友{i}") for i in range(1, count + 1)]


class ScanCandidatesTest(unittest.TestCase):
    def test_stops_after_target(self) -> None:
        yielded: list[int] = []

        def fake_iter(api, cfg):
            for number in range(1, 6):
                yielded.append(number)
                yield make_video(number)

        api = FakeApi()
        with patch("shitmover.runner.iter_search_videos", side_effect=fake_iter):
            candidates = scan_candidates(api, make_config(2), FakeState())

        self.assertEqual([item.video.aid for item in candidates], [1, 2])
        self.assertEqual(api.called_aids, [1, 2])
        self.assertEqual(yielded, [1, 2])

    def test_processed_video_does_not_count_toward_target(self) -> None:
        def fake_iter(api, cfg):
            for number in range(1, 5):
                yield make_video(number)

        api = FakeApi()
        with patch("shitmover.runner.iter_search_videos", side_effect=fake_iter):
            candidates = scan_candidates(api, make_config(2), FakeState({"BV1"}))

        self.assertEqual([item.video.aid for item in candidates], [2, 3])
        self.assertEqual(api.called_aids, [2, 3])

    def test_comment_url(self) -> None:
        self.assertEqual(
            comment_url("BV1xx411c7mD", 123456),
            "https://www.bilibili.com/video/BV1xx411c7mD/#reply123456",
        )


class PostingTest(unittest.TestCase):
    def test_send_manual_posts_only_mentions_and_does_not_write_state(self) -> None:
        api = PostingApi()
        video = make_video(1)
        friends = make_friends(12)

        code = send_manual(
            api,
            make_posting_config(),
            video,
            friends,
            assume_yes=True,
        )

        self.assertEqual(code, 0)
        self.assertEqual(api.opened, [video.url])
        self.assertEqual(len(api.posts), 2)
        self.assertIsNone(api.posts[0]["root"])
        self.assertEqual(api.posts[1]["root"], "1")
        self.assertEqual(api.posts[1]["parent"], "1")
        for post in api.posts:
            self.assertTrue(post["message"].startswith("@"))
            self.assertNotIn("搬史", post["message"])
            self.assertNotIn("\n", post["message"])

    def test_send_manual_dry_run_does_not_post(self) -> None:
        api = PostingApi()
        with redirect_stdout(io.StringIO()):
            code = send_manual(
                api,
                make_posting_config(),
                make_video(1),
                make_friends(2),
                dry_run=True,
            )
        self.assertEqual(code, 0)
        self.assertEqual(api.opened, [])
        self.assertEqual(api.posts, [])

    def test_post_candidate_still_marks_state(self) -> None:
        api = PostingApi()
        state = RecordingState()
        video = make_video(1)
        candidate = VideoCandidate(
            video=video,
            stats=CommentStats(
                total_comments=100,
                sampled=10,
                at_comments=5,
            ),
        )

        result = post_candidate(
            api,
            make_posting_config(),
            candidate,
            make_friends(12),
            state,
        )

        self.assertEqual(len(api.posts), 2)
        self.assertEqual(result["rpid"], "1")
        self.assertEqual(state.records[video.bvid]["status"], "done")
        self.assertEqual(state.records[video.bvid]["first_rpid"], "1")
        self.assertEqual(len(state.records[video.bvid]["chunks"]), 2)

    def test_run_post_uid_mode_uses_per_uid_state_not_main_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            state_path = Path(temp) / "state.json"
            main_state = StateStore(state_path)
            api = object()
            video = make_video(1)
            candidate = VideoCandidate(
                video=video,
                stats=CommentStats(
                    total_comments=100,
                    sampled=10,
                    at_comments=5,
                ),
            )

            def record_post(
                api_arg: object,
                cfg_arg: object,
                candidate_arg: VideoCandidate,
                friends_arg: list[FriendRef],
                state_arg: UidStateStore,
            ) -> None:
                self.assertIsInstance(state_arg, UidStateStore)
                state_arg.mark(
                    candidate_arg.video.bvid,
                    {"aid": candidate_arg.video.aid, "status": "done"},
                )

            with (
                patch("shitmover.runner.resolve_uids", return_value=make_friends(1)),
                patch(
                    "shitmover.runner.scan_candidates",
                    return_value=[candidate],
                ) as scan_mock,
                patch("shitmover.runner.post_candidate", side_effect=record_post),
            ):
                code = run_post(
                    api,
                    make_posting_config(state_path),
                    main_state,
                    assume_yes=True,
                    uids=[1001],
                )

            self.assertEqual(code, 0)
            self.assertIsInstance(scan_mock.call_args.args[2], UidStateStore)
            self.assertEqual(main_state.records(), {})
            uid_state = UidStateStore(
                StateStore(state_path.with_name("uid_state.json")),
                [1001],
            )
            self.assertTrue(uid_state.is_processed_video(video.bvid, video.aid))

    def test_run_post_uid_mode_filters_users_who_already_received_video(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            state_path = Path(temp) / "state.json"
            video = make_video(1)
            candidate = VideoCandidate(
                video=video,
                stats=CommentStats(
                    total_comments=100,
                    sampled=10,
                    at_comments=5,
                ),
            )
            seed = UidStateStore(
                StateStore(state_path.with_name("uid_state.json")),
                [1001],
            )
            seed.mark(video.bvid, {"aid": video.aid, "status": "done"})
            captured: dict[str, object] = {}

            def record_post(
                api_arg: object,
                cfg_arg: object,
                candidate_arg: VideoCandidate,
                friends_arg: list[FriendRef],
                state_arg: UidStateStore,
            ) -> None:
                captured["friends"] = friends_arg
                captured["state"] = state_arg
                state_arg.mark(
                    candidate_arg.video.bvid,
                    {"aid": candidate_arg.video.aid, "status": "done"},
                )

            with (
                patch("shitmover.runner.resolve_uids", return_value=make_friends(2)),
                patch("shitmover.runner.scan_candidates", return_value=[candidate]),
                patch("shitmover.runner.post_candidate", side_effect=record_post),
            ):
                code = run_post(
                    object(),
                    make_posting_config(state_path),
                    StateStore(state_path),
                    assume_yes=True,
                    uids=[1001, 1002],
                )

            self.assertEqual(code, 0)
            self.assertEqual(
                [friend.mid for friend in captured["friends"]], [1002]
            )
            self.assertIsInstance(captured["state"], UidStateStore)
            reloaded = UidStateStore(
                StateStore(state_path.with_name("uid_state.json")),
                [1001, 1002],
            )
            self.assertTrue(reloaded.is_processed_video(video.bvid, video.aid))


if __name__ == "__main__":
    unittest.main()
