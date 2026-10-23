from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from shitmover.state import StateStore, UidStateStore


class StateStoreTest(unittest.TestCase):
    def test_marks_by_bvid_and_aid(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "state.json"
            store = StateStore(path)
            store.mark(
                "BVold",
                {"aid": 123456, "title": "旧视频", "status": "done"},
            )

            reloaded = StateStore(path)
            self.assertTrue(reloaded.is_processed("BVold"))
            self.assertTrue(reloaded.is_processed_video("BVold", 123456))
            self.assertTrue(reloaded.is_processed_video("BVnew", 123456))
            self.assertEqual(reloaded.find_processed("BVnew", 123456), "BVold")
            self.assertFalse(reloaded.is_processed_video("BVnew", 999999))

    def test_partial_record_is_still_treated_as_processed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "state.json"
            store = StateStore(path)
            store.mark(
                "BVpartial",
                {"aid": 888, "status": "partial", "first_rpid": "1"},
            )

            reloaded = StateStore(path)
            self.assertTrue(reloaded.is_processed_video("BVpartial", 888))


class UidStateStoreTest(unittest.TestCase):
    def test_records_are_per_uid_and_persisted(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "uid_state.json"
            store = StateStore(path)
            first = UidStateStore(store, [111])

            first.mark("BVuid", {"aid": 123, "status": "done"})

            self.assertTrue(first.is_processed_video("BVuid", 123))
            self.assertFalse(UidStateStore(store, [222]).is_processed_video("BVuid"))
            partial = UidStateStore(store, [111, 222])
            self.assertFalse(partial.is_processed_video("BVuid"))
            self.assertEqual(partial.remaining_uids("BVuid", 123), {222})
            self.assertEqual(first.get("BVuid")["status"], "done")

            UidStateStore(store, [222]).mark(
                "BVuid", {"aid": 123, "status": "done"}
            )
            reloaded = UidStateStore(StateStore(path), [111, 222])
            self.assertTrue(reloaded.is_processed_video("BVnew", 123))
            self.assertFalse(UidStateStore(StateStore(path), [333]).is_processed_video("BVuid"))

    def test_legacy_scope_record_is_still_recognized(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            store = StateStore(Path(temp) / "uid_state.json")
            store.mark(
                "111:BVlegacy",
                {"bvid": "BVlegacy", "scope": "111,222", "aid": 9},
            )

            self.assertTrue(UidStateStore(store, [111]).is_processed_video("BVlegacy"))
            self.assertTrue(UidStateStore(store, [222]).is_processed_video("BVlegacy"))
            self.assertFalse(UidStateStore(store, [333]).is_processed_video("BVlegacy"))

    def test_main_and_uid_state_are_separate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            main = StateStore(Path(temp) / "state.json")
            main.mark("BVmain", {"aid": 1, "status": "done"})
            uid_state = UidStateStore(
                StateStore(Path(temp) / "uid_state.json"), [111]
            )
            uid_state.mark("BVuid", {"aid": 2, "status": "done"})

            self.assertTrue(main.is_processed_video("BVmain"))
            self.assertFalse(main.is_processed_video("BVuid"))
            self.assertTrue(uid_state.is_processed_video("BVuid", 2))
            self.assertFalse(uid_state.is_processed_video("BVmain"))


if __name__ == "__main__":
    unittest.main()
