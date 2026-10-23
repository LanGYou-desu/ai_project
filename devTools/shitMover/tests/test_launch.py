from __future__ import annotations

import io
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import launch


class LaunchInputTest(unittest.TestCase):
    def test_mode_accepts_retry_and_uid(self) -> None:
        with patch("builtins.input", side_effect=["x", "2"]):
            with redirect_stdout(io.StringIO()):
                self.assertEqual(launch.ask_mode(), "uid")

    def test_mode_defaults_to_all_friends(self) -> None:
        with patch("builtins.input", side_effect=[""]):
            with redirect_stdout(io.StringIO()):
                self.assertEqual(launch.ask_mode(), "all")

    def test_uids_reject_invalid_values_then_accept(self) -> None:
        with patch("builtins.input", side_effect=["abc", "0", "123, 456"]):
            with redirect_stdout(io.StringIO()):
                self.assertEqual(launch.ask_uids(), "123, 456")

    def test_continue_defaults_to_exit(self) -> None:
        with patch("builtins.input", side_effect=[""]):
            with redirect_stdout(io.StringIO()):
                self.assertFalse(launch.ask_continue())

    def test_count_retries_after_invalid_input(self) -> None:
        with patch("builtins.input", side_effect=["abc", "0", "2"]):
            with redirect_stdout(io.StringIO()):
                self.assertEqual(launch.ask_count(1), 2)


class LaunchCommandTest(unittest.TestCase):
    def test_run_once_passes_uid(self) -> None:
        with patch("launch.subprocess.call", return_value=0) as call:
            with redirect_stdout(io.StringIO()):
                self.assertEqual(launch.run_once(2, "123,456"), 0)

        command = call.call_args.args[0]
        self.assertEqual(
            command,
            [
                sys.executable,
                str(launch.ROOT / "shit_mover.py"),
                "run",
                "--posts",
                "2",
                "--yes",
                "--uid",
                "123,456",
            ],
        )
        self.assertEqual(call.call_args.kwargs["cwd"], str(launch.ROOT))

    def test_run_once_without_uid_keeps_original_command(self) -> None:
        with patch("launch.subprocess.call", return_value=0) as call:
            with redirect_stdout(io.StringIO()):
                launch.run_once(1)

        command = call.call_args.args[0]
        self.assertNotIn("--uid", command)


if __name__ == "__main__":
    unittest.main()
