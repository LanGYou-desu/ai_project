"""DevSaga 测试套件。运行：python -m unittest discover -s tests -v"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import engine as E
from game import sandbox


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="devsaga_test_")
        E.SAVE_DIR = self.tmp
        E.SAVE_FILE = os.path.join(self.tmp, "save.json")

    def test_ranks(self):
        self.assertEqual(E.rank_for(0)[0], "实习程序员")
        self.assertEqual(E.rank_for(200)[0], "初级工程师")
        self.assertEqual(E.rank_for(500)[0], "中级工程师")
        self.assertEqual(E.rank_for(1000)[0], "高级工程师")
        self.assertEqual(E.rank_for(6000)[0], "传奇程序员")

    def test_profile_roundtrip(self):
        p = E.default_profile("测试员")
        p["xp"] = 320
        p["achievements"] = ["first_task"]
        E.save_profile(p)
        loaded = E.load_profile()
        self.assertEqual(loaded["name"], "测试员")
        self.assertEqual(loaded["xp"], 320)
        self.assertIn("first_task", loaded["achievements"])

    def test_add_xp_rankup(self):
        p = E.default_profile("升级狂")
        E.add_xp(p, 200)
        self.assertEqual(E.rank_for(p["xp"])[0], "初级工程师")

    def test_stepper_terminal_master(self):
        from game.scenarios.terminal_master import TerminalMaster
        profile = E.default_profile("STE")
        st = E.Stepper(profile, "terminal_master")
        obs = st.reset()
        self.assertEqual(obs["task_index"], 0)
        r = st.step("cat /opt/app/config.ini")
        self.assertTrue(r["task_done"])


class SandboxTests(unittest.TestCase):
    def test_validate_blocks_import(self):
        ok, msg = sandbox.validate_code("import os\nprint(1)")
        self.assertFalse(ok)
        self.assertIn("os", msg)

    def test_validate_blocks_open(self):
        ok, msg = sandbox.validate_code("open('x')")
        self.assertFalse(ok)

    def test_run_code_ok(self):
        ok, out, err = sandbox.run_code("print(1 + 1)")
        self.assertTrue(ok)
        self.assertIn("2", out)

    def test_run_code_error(self):
        ok, out, err = sandbox.run_code("print(undefined_name)")
        self.assertFalse(ok)
        self.assertIn("NameError", err)

    def test_run_code_timeout(self):
        ok, out, err = sandbox.run_code("while True:\n    pass", timeout=0.4)
        self.assertFalse(ok)
        self.assertIn("超时", err)

    def test_grade_function_pass(self):
        code = ("def two_sum(nums, target):\n"
                "    seen = {}\n"
                "    for i, x in enumerate(nums):\n"
                "        if target - x in seen:\n"
                "            return [seen[target - x], i]\n"
                "        seen[x] = i\n"
                "    return []\n")
        passed, total, results = sandbox.grade_function(
            code, "two_sum", [(([2, 7, 11, 15], 9), [0, 1]), (([3, 2, 4], 6), [1, 2])])
        self.assertEqual((passed, total), (2, 2))

    def test_grade_function_fail(self):
        code = "def two_sum(nums, target):\n    return [0, 0]\n"
        passed, total, _ = sandbox.grade_function(
            code, "two_sum", [(([2, 7, 11, 15], 9), [0, 1])])
        self.assertEqual(passed, 0)

    def test_grade_missing_function(self):
        passed, total, results = sandbox.grade_function("x = 1", "two_sum", [((1,), 2)])
        self.assertEqual(passed, 0)
        self.assertIn("没有找到函数", results[0][4])


if __name__ == "__main__":
    unittest.main()
