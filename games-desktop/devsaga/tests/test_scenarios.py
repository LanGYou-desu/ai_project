"""场景通关测试：每个场景用参考脚本（solve）都能通关。"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import engine as E
from game.scenarios import ALL_SCENARIOS, new_scenario


def _fresh_profile(tmp):
    return E.default_profile("TEST")


def _run_to_end(sid, tmp):
    scenario = new_scenario(sid)
    if sid == "algo_arena":
        from game.scenarios.algo_arena import PROBLEMS, reference_code
        ws = E.workspace_dir()
        for p in PROBLEMS:
            with open(os.path.join(ws, p["id"] + ".py"), "w", encoding="utf-8") as f:
                f.write(reference_code(p["id"]))
    profile = _fresh_profile(tmp)
    io = E.ScriptIO(scenario.solve(), verbose=False)
    return scenario, E.run_scenario(profile, scenario, io, show_intro=False)


class ScenarioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="devsaga_scen_")
        E.SAVE_DIR = cls.tmp
        E.SAVE_FILE = os.path.join(cls.tmp, "save.json")
        E.maybe_event = lambda profile, session: None  # 测试中关闭随机事件

    def test_all_scenarios_solvable(self):
        for cls in ALL_SCENARIOS:
            with self.subTest(scenario=cls.id):
                scenario, result = _run_to_end(cls.id, self.tmp)
                self.assertTrue(
                    result["finished"],
                    f"{cls.id} 未能通关（任务 {result['tasks_done']}/{len(scenario.tasks)}）")
                self.assertEqual(result["tasks_done"], len(scenario.tasks))
                self.assertGreater(result["score"], 0)

    def test_unknown_command_error(self):
        scenario = new_scenario("terminal_master")
        profile = _fresh_profile(self.tmp)
        io = E.ScriptIO(["sudo rm -rf /", "exit"])
        E.run_scenario(profile, scenario, io, show_intro=False)
        # 未知命令不应导致崩溃；玩家可正常退出
        self.assertEqual(profile["xp"], 0)


if __name__ == "__main__":
    unittest.main()
