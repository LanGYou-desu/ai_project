"""针对本轮修复的回归测试：沙箱、SQL、VFS、存档、结算、CLI 判题。"""

import contextlib
import io
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import engine as E
from game import sandbox
from game import webui
from game.lessons import topic_category
from game.parser import tokenize
from game.scenarios import new_scenario
from game.scenarios.base import CommandError, Task
from game.scenarios.security_fortress import SecurityFortress
from game.scenarios.sql_rescue import SqlEngine, SqlRescue, Table
from game.scenarios.terminal_master import TerminalMaster


class SandboxHardeningTests(unittest.TestCase):
    def test_blocks_dunder_import_and_indirection(self):
        for code in ("__import__('os')",
                     "f = __import__\nf('os')",
                     "getattr(1, 'x')",
                     "vars()['__builtins__']"):
            ok, msg = sandbox.validate_code(code)
            self.assertFalse(ok, f"{code} 应被拒绝：{msg}")

    def test_input_only_allowed_in_stdin_mode(self):
        self.assertFalse(sandbox.validate_code("a = input()")[0])
        self.assertTrue(sandbox.validate_code("a = input()", allow_input=True)[0])
        passed, total, _ = sandbox.grade_stdin("a = input()\nprint(a)", [("hi", "hi")])
        self.assertEqual((passed, total), (1, 1))

    def test_grade_function_cannot_be_spoofed(self):
        code = "def f(x):\n    print('DEV_R:999')\n    return 1\n"
        passed, total, results = sandbox.grade_function(code, "f", [((1,), 2)])
        self.assertEqual(passed, 0)
        self.assertEqual(total, 1)

    def test_stderr_is_truncated(self):
        ok, out, err = sandbox.run_code("raise Exception('x' * 100000)")
        self.assertFalse(ok)
        self.assertLessEqual(len(err), sandbox.MAX_OUTPUT)


class SqlCorrectnessTests(unittest.TestCase):
    def setUp(self):
        self.sc = SqlRescue()
        self.db = self.sc.db

    def test_update_keeps_non_matching_rows(self):
        before = {u["id"]: u["email"] for u in self.db.tables["users"].rows}
        self.db.execute("UPDATE users SET email='new@glitch.com' WHERE id=7")
        rows = self.db.tables["users"].rows
        self.assertEqual(len(rows), len(before))
        self.assertEqual(next(u for u in rows if u["id"] == 1)["email"], before[1])
        self.assertEqual(next(u for u in rows if u["id"] == 7)["email"], "new@glitch.com")

    def test_delete_keeps_other_rows(self):
        n = len(self.db.tables["orders"].rows)
        self.db.execute("DELETE FROM orders WHERE status='cancelled'")
        rows = self.db.tables["orders"].rows
        self.assertEqual(len(rows), n - 2)
        self.assertTrue(all(r["status"] != "cancelled" for r in rows))

    def test_and_inside_quotes_is_not_split(self):
        db = SqlEngine([Table("t", ["name", "id"], [
            {"name": "a and b", "id": 1}, {"name": "c", "id": 2}])])
        _, rows = db.execute("SELECT * FROM t WHERE name='a and b'")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], "a and b")

    def test_insert_rejects_unknown_column(self):
        with self.assertRaises(CommandError):
            self.db.execute("INSERT INTO users (nope) VALUES ('x')")


class VfsCorrectnessTests(unittest.TestCase):
    def setUp(self):
        self.sc = TerminalMaster()

    def test_ls_long_with_path(self):
        out = self.sc.handle("ls -l /opt/app", None)
        self.assertIn("config.ini", out)
        self.assertIn("deploy.sh", out)

    def test_rm_recursive_removes_children(self):
        self.sc.handle("mkdir /home/dev/tmp", None)
        self.sc.handle("touch /home/dev/tmp/a.txt", None)
        self.sc.handle("rm -r /home/dev/tmp", None)
        self.assertFalse(self.sc.fs.exists("/home/dev/tmp"))
        self.assertFalse(self.sc.fs.exists("/home/dev/tmp/a.txt"))

    def test_mv_directory_moves_children(self):
        self.sc.handle("mkdir /home/dev/a", None)
        self.sc.handle("touch /home/dev/a/f.txt", None)
        self.sc.handle("mv /home/dev/a /home/dev/b", None)
        self.assertTrue(self.sc.fs.exists("/home/dev/b/f.txt"))
        self.assertFalse(self.sc.fs.exists("/home/dev/a/f.txt"))

    def test_rm_root_is_refused(self):
        with self.assertRaises(CommandError):
            self.sc.handle("rm -rf /", None)
        self.assertTrue(self.sc.fs.exists("/"))

    def test_chmod_plus_x_sets_execute_bits(self):
        self.sc.handle("chmod +x /opt/app/deploy.sh", None)
        self.assertEqual(self.sc.fs.get("/opt/app/deploy.sh").mode, "755")


class ParserAndScenarioTests(unittest.TestCase):
    def test_tokenize_unmatched_quote(self):
        self.assertEqual(tokenize("log search ' OR"), ["log", "search", "' OR"])

    def test_security_log_search_unmatched_quote_does_not_crash(self):
        out = SecurityFortress().handle("log search ' OR", None)
        self.assertIn("OR", out)

    def test_security_topics_have_own_category(self):
        self.assertEqual(topic_category("sec_sqli"), "安全")


class EnginePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="devsaga_fix_")
        E.SAVE_DIR = self.tmp
        E.SAVE_FILE = os.path.join(self.tmp, "save.json")

    def test_roundtrip_keeps_web_fields(self):
        p = E.default_profile("存档员")
        p["learned_topics"] = ["grep"]
        p["web_stats"] = {"commands": 3}
        p["settings"]["difficulty"] = "hard"
        E.save_profile(p)
        q = E.load_profile()
        self.assertEqual(q["learned_topics"], ["grep"])
        self.assertEqual(q["web_stats"], {"commands": 3})
        self.assertEqual(q["settings"]["difficulty"], "hard")

    def test_corrupt_save_returns_none(self):
        with open(E.SAVE_FILE, "w", encoding="utf-8") as f:
            f.write("[1, 2, 3]")
        self.assertIsNone(E.load_profile())
        with open(E.SAVE_FILE, "w", encoding="utf-8") as f:
            f.write("{ not json")
        self.assertIsNone(E.load_profile())

    def test_finalize_scenario_is_idempotent(self):
        p = E.default_profile("结算")
        sc = new_scenario("terminal_master")
        sess = E.Session(p, sc, E.ScriptIO())
        sess.task_idx = len(sc.tasks)
        E.finalize_scenario(p, sc, sess, E.ScriptIO())
        E.finalize_scenario(p, sc, sess, E.ScriptIO())
        self.assertEqual(p["xp"], sc.xp_bonus)
        self.assertEqual(p["finished"].count("terminal_master"), 1)
        self.assertEqual(p["reputation"], 10)

    def test_run_result_includes_completion_bonus(self):
        p = E.default_profile("结算结果")
        sc = new_scenario("terminal_master")
        r = E.run_scenario(p, sc, E.ScriptIO(sc.solve()), show_intro=False)
        self.assertTrue(r["finished"])
        self.assertEqual(r["score"], 720 + sc.xp_bonus)
        self.assertEqual(r["xp"], 6 * 40 + sc.xp_bonus)

    def test_show_ending_records_title_once(self):
        p = E.default_profile("结局")
        io_ = E.ScriptIO()
        E.show_ending(p, io_)
        first = list(p["endings_seen"])
        E.show_ending(p, io_)
        self.assertEqual(len(first), 1)
        self.assertEqual(p["endings_seen"], first)
        self.assertIn("ending_seen", p["achievements"])


class GradeModeTests(unittest.TestCase):
    def test_grade_algo_file_only_grades_submitted_function(self):
        import main
        from game.scenarios.algo_arena import reference_code
        fd, path = tempfile.mkstemp(suffix=".py")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(reference_code("two_sum"))
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                main.grade_algo_file(path)
            out = buf.getvalue()
            self.assertIn("two_sum", out)
            self.assertIn("全部通过", out)
            self.assertNotIn("is_palindrome", out)
        finally:
            os.unlink(path)


class WebEventConsistencyTests(unittest.TestCase):
    def test_event_options_match_applied_stats(self):
        from unittest import mock
        p = E.default_profile("事件")
        st = E.Stepper(p, "terminal_master")
        st.reset()
        st.session.steps = 5
        first, second = E.STANDUPS[0], E.STANDUPS[1]
        with mock.patch("game.webui.random.random", return_value=0.0), \
             mock.patch("game.webui.random.choice", side_effect=[first, second]):
            ev = webui._maybe_event(st)
            self.assertIsNotNone(ev)
            before = dict(p["stats"])
            webui._apply_event(st, 1)
        _, stat, val = first[2][1]
        self.assertEqual(p["stats"][stat], before[stat] + val)
        self.assertEqual(ev["options"], [o[0] for o in first[2]])


if __name__ == "__main__":
    unittest.main()
