"""2.0 扩充功能测试：新场景、新算法题、课后测验、难度系统、命运结算。"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import engine as E
from game import sandbox
from game.lessons import QUIZZES, run_quiz
from game.scenarios.algo_arena import PROBLEMS, reference_code
from game.scenarios.container_storm import ContainerStorm
from game.scenarios.frontend_magic import FrontendMagic
from game.scenarios.pipeline_deploy import PipelineDeploy


class DashboardTests(unittest.TestCase):
    def test_all_scenarios_dashboard_ok(self):
        from game.scenarios import ALL_SCENARIOS
        for cls in ALL_SCENARIOS:
            with self.subTest(scenario=cls.id):
                sc = cls()
                d = sc.dashboard()
                self.assertIn("theme", d)
                self.assertIsInstance(d["panels"], list)
                for p in d["panels"]:
                    self.assertIn("kind", p)
                    self.assertIn("title", p)

    def test_dashboard_reflects_state(self):
        sc = ContainerStorm()
        d1 = sc.dashboard()
        rows = d1["panels"][0]["rows"]
        app1 = next(r for r in rows if r[0] == "app-1")
        self.assertEqual(app1[-1], "exited")
        sc.handle("docker update --memory 2g app-1", None)
        sc.handle("docker start app-1", None)
        d2 = sc.dashboard()
        rows2 = d2["panels"][0]["rows"]
        app1b = next(r for r in rows2 if r[0] == "app-1")
        self.assertEqual(app1b[-1], "running")
        self.assertIn("2048", app1b[3])


class NewScenarioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="devsaga_exp_")
        E.SAVE_DIR = self.tmp
        E.SAVE_FILE = os.path.join(self.tmp, "save.json")
        E.maybe_event = lambda profile, session: None

    def _play(self, sid):
        from game.scenarios import new_scenario
        sc = new_scenario(sid)
        profile = E.default_profile("T")
        io = E.ScriptIO(sc.solve())
        return sc, E.run_scenario(profile, sc, io, show_intro=False)

    def test_container_storm_solvable(self):
        sc, r = self._play("container_storm")
        self.assertTrue(r["finished"], f"任务 {r['tasks_done']}/{len(sc.tasks)}")
        self.assertEqual(len(sc.tasks), 6)

    def test_pipeline_solvable(self):
        sc, r = self._play("pipeline_deploy")
        self.assertTrue(r["finished"], f"任务 {r['tasks_done']}/{len(sc.tasks)}")
        self.assertEqual(len(sc.tasks), 6)

    def test_frontend_solvable(self):
        sc, r = self._play("frontend_magic")
        self.assertTrue(r["finished"], f"任务 {r['tasks_done']}/{len(sc.tasks)}")
        self.assertEqual(len(sc.tasks), 6)

    def test_docker_commands(self):
        sc = ContainerStorm()
        sc.handle("docker update --memory 2g app-1", None)
        self.assertEqual(sc.containers["app-1"].mem_limit, 2048)
        sc.handle("docker start app-1", None)
        self.assertEqual(sc.containers["app-1"].status, "running")
        sc.handle("docker network connect app-net cache-1", None)
        self.assertIn("app-net", sc.containers["cache-1"].network)
        out = sc.handle("docker exec web-1 curl localhost/health", None)
        self.assertTrue(sc.state["all_ok"])
        self.assertIn("200", out)

    def test_pipeline_state_machine(self):
        sc = PipelineDeploy()
        sc.handle("fix app.py", None)
        sc.handle("pipeline run", None)
        self.assertTrue(sc.build_passed)
        self.assertFalse(sc.test_passed)
        sc.handle("fix test_app.py", None)
        sc.handle("pipeline run", None)
        self.assertTrue(sc.test_passed and sc.lint_passed)
        sc.handle("deploy --blue v2.3", None)
        self.assertEqual(sc.blue_health, "down")
        sc.handle("rollback", None)
        self.assertTrue(sc.rolled_back)
        self.assertEqual(sc.blue_health, "ok")

    def test_frontend_fixes(self):
        sc = FrontendMagic()
        for n in (1, 2, 3, 4):
            sc.handle(f"fix {n}", None)
        out = sc.handle("view /", None)
        self.assertTrue(sc.render_ok)
        self.assertIn("完整渲染", out)


class NewAlgoTests(unittest.TestCase):
    def test_all_new_problems_pass_reference(self):
        new_ids = {"climb_stairs", "is_anagram", "binary_search", "hanoi",
                   "coin_change", "sliding_max"}
        for p in PROBLEMS:
            if p["id"] not in new_ids:
                continue
            with self.subTest(problem=p["id"]):
                passed, total, _ = sandbox.grade_function(
                    reference_code(p["id"]), p["func"].split("(")[0].split()[1], p["tests"])
                self.assertEqual((passed, total), (total, total))

    def test_problem_count(self):
        self.assertEqual(len(PROBLEMS), 15)


class QuizTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="devsaga_quiz_")
        E.SAVE_DIR = self.tmp
        E.SAVE_FILE = os.path.join(self.tmp, "save.json")

    def test_all_scenarios_have_quizzes(self):
        from game.scenarios import ALL_SCENARIOS
        for cls in ALL_SCENARIOS:
            self.assertIn(cls.id, QUIZZES, f"{cls.id} 缺测验")

    def test_quiz_full_score(self):
        profile = E.default_profile("Q")
        sid = "terminal_master"
        answers = [q[2] for q in QUIZZES[sid]]
        io = E.ScriptIO(answers)
        score = run_quiz(profile, io, sid)
        self.assertEqual(score, 3)
        self.assertIn("quiz_master", profile["achievements"])
        self.assertEqual(profile["quiz"].get(sid), 3)

    def test_quiz_wrong_answer(self):
        profile = E.default_profile("Q")
        io = E.ScriptIO(["A", "A", "A"])  # 故意答错
        score = run_quiz(profile, io, "terminal_master")
        self.assertLess(score, 3)


class DifficultyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="devsaga_diff_")
        E.SAVE_DIR = self.tmp
        E.SAVE_FILE = os.path.join(self.tmp, "save.json")
        E.maybe_event = lambda profile, session: None

    def test_hard_drain(self):
        from game.scenarios import new_scenario
        profile = E.default_profile("H")
        profile["settings"]["difficulty"] = "hard"
        sc = new_scenario("terminal_master")
        io = E.ScriptIO(["ls", "ls", "ls", "exit"])
        E.run_scenario(profile, sc, io, show_intro=False)
        self.assertLess(profile["coffee"], 96)  # 每步 -2

    def test_easy_xp_multiplier(self):
        profile = E.default_profile("E")
        profile["settings"]["difficulty"] = "easy"
        session = E.Session(profile, None, E.ScriptIO())
        session.task_idx = 1
        from game.scenarios.base import Task
        t = Task("x", "t", "b", xp=40)
        E._complete_task(session, t)
        self.assertEqual(session.xp_gained, 60)  # 40 * 1.5

    def test_normal_xp(self):
        profile = E.default_profile("N")
        session = E.Session(profile, None, E.ScriptIO())
        session.task_idx = 1
        from game.scenarios.base import Task
        t = Task("x", "t", "b", xp=40)
        E._complete_task(session, t)
        self.assertEqual(session.xp_gained, 40)

    def test_hard_step_cap(self):
        from game.scenarios import new_scenario
        profile = E.default_profile("H2")
        profile["settings"]["difficulty"] = "hard"
        sc = new_scenario("terminal_master")
        # 60 步上限：只喂无效命令，应在 60 步左右强制结算
        io = E.ScriptIO(["ls"] * 100 + ["exit"])
        r = E.run_scenario(profile, sc, io, show_intro=False)
        self.assertFalse(r["finished"])
        self.assertLessEqual(r["tasks_done"], 6)


class EndingTests(unittest.TestCase):
    def test_tech_ending(self):
        p = E.default_profile("T")
        p["stats"]["tech"] = 6
        p["finished"] = [str(i) for i in range(10)]
        title, _, kind = E.compute_ending(p)
        self.assertEqual(kind, "tech")

    def test_comm_ending(self):
        p = E.default_profile("C")
        p["stats"]["comm"] = 5
        title, _, kind = E.compute_ending(p)
        self.assertEqual(kind, "comm")

    def test_risk_ending(self):
        p = E.default_profile("R")
        p["stats"]["risk"] = 6
        title, _, kind = E.compute_ending(p)
        self.assertEqual(kind, "risk")

    def test_newbie_ending(self):
        p = E.default_profile("N")
        title, _, kind = E.compute_ending(p)
        self.assertEqual(kind, "stable")


if __name__ == "__main__":
    unittest.main()
