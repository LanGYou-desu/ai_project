"""机器人模式：让机器也能玩 DevSaga。

玩法：用每个场景的参考通关脚本（Scenario.solve()）驱动同一个引擎，
头也不回地通关——并输出成绩单。算法竞技场需要先把参考解答写入工作区文件。
"""

import os

from . import engine as E
from . import terminal as T
from .scenarios import ALL_SCENARIOS, new_scenario


def run_bot(scenario_id=None, verbose=True):
    """机器人通关一个或全部场景，返回结果列表。"""
    profile = E.load_profile() or E.default_profile("BOT-9000")
    profile["settings"]["color"] = False
    ids = [scenario_id] if scenario_id else [s.id for s in ALL_SCENARIOS]
    results = []
    for sid in ids:
        scenario = new_scenario(sid)
        _prepare_algo(scenario)
        io = E.ScriptIO(scenario.solve(), verbose=verbose)
        r = E.run_scenario(profile, scenario, io, show_intro=False)
        r["tasks_total"] = len(scenario.tasks)
        r["tasks_done"] = min(r["tasks_done"], r["tasks_total"])
        results.append(r)
        if verbose:
            T.flush()
    return results


def _prepare_algo(scenario):
    """算法竞技场：机器人先把参考解答写进工作区，才能 submit。"""
    if scenario.id != "algo_arena":
        return
    from .scenarios.algo_arena import PROBLEMS, reference_code

    ws = E.workspace_dir()
    for p in PROBLEMS:
        code = reference_code(p["id"])
        with open(os.path.join(ws, p["id"] + ".py"), "w", encoding="utf-8") as f:
            f.write(code)


def report(results, io=None):
    out = []
    out.append(T.table(
        ["场景", "任务", "得分", "XP", "提示", "状态"],
        [[r["scenario"],
          f"{r['tasks_done']}/{r['tasks_total']}",
          r["score"], r["xp"],
          "是" if r["hint_used"] else "否",
          "✅ 通关" if r["finished"] else "❌ 未完成"]
         for r in results]))
    total_xp = sum(r["xp"] for r in results)
    total_score = sum(r["score"] for r in results)
    out.append(f"机器人总成绩：得分 {total_score}，经验 {total_xp}")
    return "\n".join(out)
