"""DevSaga · 程序员模拟器 — 入口。

用法：
  python main.py                 # 交互菜单
  python main.py --new           # 直接新建档案
  python main.py --play <id>     # 直接进入场景
  python main.py --list          # 列出场景
  python main.py --bot [id]      # 机器人通关（机器也能玩）
  python main.py --grade <id> <文件>   # 用外部文件判题/跑脚本
  python main.py --serve [端口]  # 启动 TCP 机器接口
  python main.py --learn [主题]  # 知识手册
  python main.py --demo          # 快速演示：机器人全通关
"""

import argparse
import os
import sys

from game import __version__, terminal as T
from game import engine as E
from game.scenarios import ALL_SCENARIOS, new_scenario


def banner():
    T.enable_ansi()
    print(T.paint(r"""
   _____            __   _____
  / ___/ __  __    / /  / ___/  ____ ___  ___  ____
  \__ \/ / / / __ / /   \__ \  / __ `__ \/ _ \/ __/
 ___/ / /_/ / /_/ / /   ___/ / / / / / / /  __/ /
/____/\__,_/\__,_/_/   /____/ /_/ /_/ /_/\___/_/
""", "cyan", "bold"))
    print(T.paint(f"  {__version__} ｜ 一个能玩又能学的程序员模拟器", "dim"))
    print(T.paint("  11 种开发环境 ｜ 人机都能玩 ｜ 边玩边学", "dim"))


def get_profile(io=None):
    p = E.load_profile()
    if p is None:
        print(T.paint("（没有找到存档，先创建你的程序员档案）", "yellow"))
        p = create_profile(io)
    return p


def create_profile(io=None):
    if io is None:
        from game.engine import HumanIO
        io = HumanIO()
    name = io.input(T.paint("你的花名（直接回车用默认名）> ", "cyan")).strip()
    p = E.default_profile(name or "新员工")
    E.save_profile(p)
    return p


def play_scenario(profile, sid, io=None):
    if io is None:
        from game.engine import HumanIO
        io = HumanIO(profile["settings"].get("story", False))
    scenario = new_scenario(sid)
    return E.run_scenario(profile, scenario, io)


def menu(profile):
    from game.engine import HumanIO
    io = HumanIO()
    while True:
        # 命运抉择（未做的剧情抉择在回到主菜单时触发）
        if profile["finished"] or profile["choices_done"]:
            E.maybe_plot(profile, io)
            E.save_profile(profile)
        rank_name, _ = E.rank_for(profile["xp"])
        diff = E.diff_cfg(profile)["label"]
        print()
        print(T.box([
            T.paint(f"👤 {profile['name']}  [{rank_name}]", "bold") +
            T.paint(f"   XP {profile['xp']}", "green") +
            T.paint(f"   ⭐声望 {profile['reputation']}", "yellow"),
            T.paint(f"  技术 {profile['stats']['tech']}  沟通 {profile['stats']['comm']}  冒险 {profile['stats']['risk']}", "dim"),
            "",
            T.paint(" 1) 🎮 选择场景开始游戏", "cyan"),
            T.paint(" 2) 📚 学习模式（知识手册）", "cyan"),
            T.paint(" 3) 📝 课后测验", "cyan"),
            T.paint(" 4) 🎬 命运结算（我的结局）", "cyan"),
            T.paint(f" 5) ⚙️ 难度设置（当前：{diff}）", "cyan"),
            T.paint(" 6) 🏆 我的成就", "cyan"),
            T.paint(" 7) 📊 我的成绩单", "cyan"),
            T.paint(" 8) 🆕 新建档案", "cyan"),
            T.paint(" 9) 🤖 机器人演示（机器也能玩）", "cyan"),
            T.paint(" 0) 退出", "dim"),
        ], title="主菜单", color="green"))
        ans = io.input(T.paint("选择 > ", "bold", "cyan")).strip()
        if ans == "1":
            choose_scenario(profile, io)
        elif ans == "2":
            from game.lessons import browse_topics
            browse_topics(io)
        elif ans == "3":
            quiz_menu(profile, io)
        elif ans == "4":
            E.show_ending(profile, io)
            E.save_profile(profile)
        elif ans == "5":
            cycle_difficulty(profile)
            E.save_profile(profile)
        elif ans == "6":
            show_achievements(profile)
        elif ans == "7":
            show_scores(profile)
        elif ans == "8":
            profile = create_profile()
        elif ans == "9":
            run_demo()
        elif ans in ("0", "exit", "quit"):
            E.save_profile(profile)
            print(T.paint("下班了。记得按时提交代码。", "dim"))
            return
        else:
            print(T.paint("（没有这个选项）", "red"))


def quiz_menu(profile, io):
    from game.lessons import QUIZZES, run_quiz
    rows, ids = [], []
    for cls in ALL_SCENARIOS:
        if cls.id in QUIZZES:
            best = profile.get("quiz", {}).get(cls.id, 0)
            rows.append([f"{len(rows) + 1}", cls.name, f"{best}/3"])
            ids.append(cls.id)
    print()
    print(T.table(["#", "场景", "最佳成绩"], rows))
    print(T.paint("选择要测验的场景编号，0 返回。满分可解锁「学霸」成就！", "dim"))
    ans = io.input(T.paint("选择 > ", "bold", "cyan")).strip()
    if ans.isdigit() and 1 <= int(ans) <= len(rows):
        # 用单独的 ids 列表映射，避免以后有场景缺测验时编号错位。
        sid = ids[int(ans) - 1]
        run_quiz(profile, io, sid)
        E.save_profile(profile)
        io.pause()


def cycle_difficulty(profile):
    order = ["easy", "normal", "hard"]
    cur = profile["settings"].get("difficulty", "normal")
    idx = order.index(cur) if cur in order else 1
    nxt = order[(idx + 1) % len(order)]
    profile["settings"]["difficulty"] = nxt
    cfg = E.DIFFICULTIES[nxt]
    print(T.paint(f"\n⚙️ 难度已切换为【{cfg['label']}】：", "bold", "yellow"))
    print(T.paint(f"   提示：失败 {cfg['hint_after']} 次后自动给", "dim"))
    print(T.paint(f"   步数上限：{cfg['step_cap']}    能量消耗：每 {cfg['drain_every']} 步 -{cfg['drain']}", "dim"))
    print(T.paint(f"   经验倍率：x{cfg['xp_mult']}", "dim"))


def choose_scenario(profile, io=None):
    if io is None:
        from game.engine import HumanIO
        io = HumanIO()
    while True:
        rows = []
        for i, cls in enumerate(ALL_SCENARIOS, 1):
            best = profile["best"].get(cls.id)
            mark = "✅" if cls.id in profile["finished"] else "⬜"
            score = f" 最佳 {best['score']} 分" if best else ""
            rows.append([f"{i}", mark, cls.id, cls.name, "★" * cls.difficulty, score])
        print()
        print(T.table(["#", "状态", "ID", "场景", "难度", "成绩"], rows))
        print(T.paint("输入编号进入场景，0 返回主菜单。", "dim"))
        ans = io.input(T.paint("选择 > ", "bold", "cyan")).strip()
        if ans in ("0", "", "exit", "quit", "back"):
            return
        if ans.isdigit() and 1 <= int(ans) <= len(ALL_SCENARIOS):
            sid = ALL_SCENARIOS[int(ans) - 1].id
            play_scenario(profile, sid)


def show_achievements(profile):
    lines = []
    for aid, (name, desc) in E.ACHIEVEMENTS.items():
        got = "✅" if aid in profile["achievements"] else "⬜"
        lines.append(T.paint(f"  {got} {name}", "cyan") + T.paint(f"  — {desc}", "dim"))
    print(T.box(lines or ["（还没有成就）"], title="🏆 成就", color="yellow"))
    input(T.paint("按回车返回...", "dim"))


def show_scores(profile):
    rows = []
    for cls in ALL_SCENARIOS:
        best = profile["best"].get(cls.id)
        if best:
            rows.append([cls.name, best["score"], best["tasks"], best["date"][:10]])
        else:
            rows.append([cls.name, "-", "-", "未通关"])
    print()
    print(T.table(["场景", "最佳得分", "任务数", "日期"], rows))
    input(T.paint("按回车返回...", "dim"))


def run_demo():
    from game.bot import run_bot, report
    print(T.paint("\n🤖 机器人 BOT-9000 开始挑战全部场景...", "cyan"))
    results = run_bot(verbose=False)
    print(report(results))
    input(T.paint("按回车返回...", "dim"))


def grade_mode(sid, path):
    """外部文件判题 / 脚本模式。"""
    from game.scenarios import SCENARIO_MAP
    if sid not in SCENARIO_MAP:
        print(T.paint(f"未知场景：{sid}。用 --list 查看。", "red"))
        sys.exit(1)
    if sid == "algo_arena" and path.lower().endswith(".py"):
        grade_algo_file(path)
        return
    # 脚本模式：文件里每行一条命令，跑对应场景
    if not os.path.exists(path):
        print(T.paint(f"找不到文件：{path}", "red"))
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        script = [ln.strip() for ln in f if ln.strip() and not ln.strip().startswith("#")]
    profile = E.default_profile("SCRIPT-BOT")
    scenario = new_scenario(sid)
    io = E.ScriptIO(script, verbose=True)
    r = E.run_scenario(profile, scenario, io, show_intro=True)
    print(T.paint(f"\n结果：任务 {r['tasks_done']}/{len(scenario.tasks)}，得分 {r['score']}，XP {r['xp']}", "green", "bold"))


def grade_algo_file(path):
    """对提交文件里实际定义的题目函数判题（不需要把 15 道题都写在一个文件里）。"""
    import ast

    from game import sandbox
    from game.scenarios.algo_arena import PROBLEMS

    print(T.paint(f"\n🔍 判题模式：{path}", "cyan"))
    try:
        with open(path, "r", encoding="utf-8") as f:
            code = f.read()
    except OSError as exc:
        print(T.paint(f"无法读取文件：{exc}", "red"))
        sys.exit(1)
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        print(T.paint(f"❌ 语法错误：第 {exc.lineno} 行 {exc.msg}", "red"))
        return
    defined = {n.name for n in tree.body
               if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
    matched = [p for p in PROBLEMS
               if p["func"].split("(")[0].split()[1] in defined]
    if not matched:
        print(T.paint("❌ 没有找到任何题目对应的函数（函数名必须和题目一致）。", "red"))
        return
    all_ok = True
    for p in matched:
        func_name = p["func"].split("(")[0].split()[1]
        passed, total, _ = sandbox.grade_function(code, func_name, p["tests"])
        st = "✅" if passed == total else "❌"
        print(f"  {st} 《{p['title']}》({p['id']}): {passed}/{total}")
        all_ok = all_ok and passed == total
    skipped = len(PROBLEMS) - len(matched)
    if skipped:
        print(T.paint(f"  （未提交 {skipped} 道题，已跳过）", "dim"))
    print(T.paint("全部通过！🎉" if all_ok else "还有题目没过，继续加油。", "green" if all_ok else "yellow"))


def main():
    ap = argparse.ArgumentParser(prog="devsaga", description="DevSaga 程序员模拟器")
    ap.add_argument("--new", action="store_true", help="新建档案")
    ap.add_argument("--play", metavar="ID", help="直接进入场景")
    ap.add_argument("--list", action="store_true", help="列出场景")
    ap.add_argument("--bot", nargs="?", const="all", metavar="ID", help="机器人通关")
    ap.add_argument("--grade", nargs=2, metavar=("ID", "FILE"), help="用文件判题/跑脚本")
    ap.add_argument("--serve", nargs="?", const="8765", metavar="PORT", help="启动 TCP 机器接口")
    ap.add_argument("--learn", nargs="?", const="", metavar="TOPIC", help="知识手册")
    ap.add_argument("--web", nargs="?", const="8766", metavar="PORT", help="启动网页版（浏览器游玩）")
    ap.add_argument("--demo", action="store_true", help="机器人全场景演示")
    args = ap.parse_args()

    banner()

    if args.list:
        from game.scenarios import list_scenarios
        for sid, name, tag, diff in list_scenarios():
            print(f"  {sid:<18} {name}  难度{'★' * diff}  ｜ {tag}")
        return

    if args.learn is not None:
        from game.lessons import TOPICS, show_lesson, browse_topics
        from game.engine import HumanIO
        if args.learn and args.learn in TOPICS:
            show_lesson(HumanIO(), args.learn)
        else:
            browse_topics(HumanIO())
        return

    if args.bot:
        from game.bot import run_bot, report
        from game.scenarios import SCENARIO_MAP
        sid = None if args.bot == "all" else args.bot
        if sid is not None and sid not in SCENARIO_MAP:
            print(T.paint(f"未知场景：{sid}。用 --list 查看。", "red"))
            sys.exit(1)
        print(T.paint("\n🤖 机器人 BOT-9000 开始挑战...", "cyan"))
        results = run_bot(sid)
        print(report(results))
        return

    if args.grade:
        grade_mode(args.grade[0], args.grade[1])
        return

    if args.serve:
        from game.serve import serve
        try:
            port = int(args.serve)
        except ValueError:
            print(T.paint(f"端口号不合法：{args.serve}", "red"))
            sys.exit(1)
        serve(port)
        return

    if args.web:
        from game.webui import run
        try:
            port = int(args.web)
        except ValueError:
            print(T.paint(f"端口号不合法：{args.web}", "red"))
            sys.exit(1)
        run(port=port)
        return

    if args.demo:
        from game.bot import run_bot, report
        results = run_bot()
        print(report(results))
        return

    if args.new:
        profile = create_profile()
        menu(profile)
        return

    if args.play:
        profile = get_profile()
        if args.play not in [s.id for s in ALL_SCENARIOS]:
            print(T.paint(f"未知场景：{args.play}。用 --list 查看。", "red"))
            sys.exit(1)
        play_scenario(profile, args.play)
        return

    profile = get_profile()
    menu(profile)


if __name__ == "__main__":
    main()
