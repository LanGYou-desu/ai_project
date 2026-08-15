"""网页版后端 API 测试：起一个本地服务器，用 urllib 走全流程。"""

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import engine as E


class WebTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="devsaga_web_")
        E.SAVE_DIR = cls.tmp
        E.SAVE_FILE = os.path.join(cls.tmp, "save.json")
        from game import webui
        cls.webui = webui
        webui.STATE.profile = None
        webui.STATE.stepper = None
        cls.server = webui.create_server(0)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def req(self, method, path, body=None):
        url = f"http://127.0.0.1:{self.port}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        r = urllib.request.Request(url, data=data, method=method,
                                   headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(r, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def raw(self, path):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=15) as resp:
            return resp.read().decode("utf-8")

    def test_index_and_static(self):
        self.assertIn("DevSaga", self.raw("/"))
        self.assertIn("body", self.raw("/static/style.css"))
        self.assertIn("app.js", self.raw("/"))

    def test_profile_and_scenarios(self):
        self.req("POST", "/api/profile", {"name": "网页测试员"})
        state = self.req("GET", "/api/state")["state"]
        self.assertEqual(state["name"], "网页测试员")
        self.assertIn("difficulty", state)
        sc = self.req("GET", "/api/scenarios")["scenarios"]
        self.assertEqual(len(sc), 11)
        ids = {s["id"] for s in sc}
        self.assertIn("container_storm", ids)
        self.assertIn("security_fortress", ids)

    def test_play_flow(self):
        self.req("POST", "/api/profile", {"name": "玩家"})
        start = self.req("POST", "/api/start", {"scenario": "terminal_master"})
        self.assertEqual(start["name"], "终端老兵")
        self.assertTrue(start["intro"])
        self.assertTrue(start["palette"])
        self.assertEqual(start["task"]["total"], 6)
        # 场景专属工作台面板
        self.assertIn("dashboard", start)
        self.assertTrue(start["dashboard"]["panels"])
        self.assertEqual(start["dashboard"]["theme"]["title"], "终端工作台")

        out = self.req("POST", "/api/cmd", {"text": "cat /opt/app/config.ini"})
        self.assertTrue(out["task_done"])
        self.assertIn("[server]", out["text"])
        self.assertIn("任务完成", out["messages"])
        # 命令后工作台刷新
        self.assertIn("dashboard", out)

        hint = self.req("POST", "/api/hint", {})
        self.assertTrue(hint["hint"])

        # 用参考脚本通关
        from game.scenarios.terminal_master import TerminalMaster
        for cmd in TerminalMaster().solve():
            out = self.req("POST", "/api/cmd", {"text": cmd})
            if out["all_done"]:
                break
        self.assertTrue(out["all_done"])
        self.assertGreaterEqual(out["score"], 700)

    def test_quiz(self):
        self.req("POST", "/api/profile", {"name": "学霸"})
        q = self.req("GET", "/api/quiz/terminal_master")["quiz"]
        self.assertEqual(len(q), 3)
        from game.lessons import QUIZZES
        answers = [item[2] for item in QUIZZES["terminal_master"]]
        r = self.req("POST", "/api/quiz", {"sid": "terminal_master", "answers": answers})
        self.assertEqual(r["score"], 3)
        self.assertTrue(r["full"])
        self.assertIn("quiz_master", self.req("GET", "/api/state")["state"]["achievements"])

    def test_ending_difficulty(self):
        self.req("POST", "/api/profile", {"name": "命运"})
        end = self.req("GET", "/api/ending")
        self.assertIn("title", end)
        d1 = self.req("GET", "/api/state")["state"]["difficulty"]
        self.req("POST", "/api/difficulty", {})
        d2 = self.req("GET", "/api/state")["state"]["difficulty"]
        self.assertNotEqual(d1, d2)

    def test_other_actions(self):
        self.req("POST", "/api/profile", {"name": "行动"})
        self.req("POST", "/api/start", {"scenario": "debug_detective"})
        out = self.req("POST", "/api/cmd", {"text": "C"})
        self.assertTrue(out["task_done"])
        learn = self.req("POST", "/api/learn", {})
        self.assertTrue(learn["title"])
        help_t = self.req("POST", "/api/help", {})
        self.assertIn("推理场景", help_t["help"])
        self.req("POST", "/api/coffee", {})
        self.req("POST", "/api/skip", {})
        self.req("POST", "/api/exit_scenario", {})

    def test_terminal_prompt(self):
        self.req("POST", "/api/profile", {"name": "终端"})
        start = self.req("POST", "/api/start", {"scenario": "terminal_master"})
        self.assertIn("dev@glitchworks", start["prompt"])
        out = self.req("POST", "/api/cmd", {"text": "cd /opt/app"})
        self.assertIn("/opt/app", out["prompt"])
        # Git 场景提示符显示分支
        g = self.req("POST", "/api/start", {"scenario": "git_quest"})
        self.assertIn("main", g["prompt"])
        self.assertIn("dev@glitch", g["prompt"])

    def test_algo_editor_flow(self):
        self.req("POST", "/api/profile", {"name": "码农"})
        start = self.req("POST", "/api/start", {"scenario": "algo_arena"})
        self.assertEqual(start["prompt"], "judge> ")
        self.assertEqual(len(start["problems"]), 15)
        from game.scenarios.algo_arena import reference_code
        r = self.req("POST", "/api/code/run", {"sid": "two_sum", "code": reference_code("two_sum")})
        self.assertEqual(r["passed"], r["total"])
        self.assertTrue(r["task_done"])
        self.assertTrue(r["passed"] > 0)
        r2 = self.req("POST", "/api/code/run", {"sid": "is_palindrome",
                                                "code": "def is_palindrome(s):\n    return False\n"})
        self.assertLess(r2["passed"], r2["total"])
        self.assertFalse(r2["task_done"])
        # 全部通过后 all_done
        for pid in ("is_palindrome", "fizzbuzz", "brackets", "max_subarray",
                    "merge_sorted", "climb_stairs", "is_anagram", "binary_search",
                    "hanoi", "coin_change", "sliding_max", "reverse_string",
                    "contains_duplicate", "sqrt_int"):
            rr = self.req("POST", "/api/code/run", {"sid": pid, "code": reference_code(pid)})
            if rr["all_done"]:
                break
        self.assertTrue(rr["all_done"])


if __name__ == "__main__":
    unittest.main()
