"""游戏引擎：玩家档案、进度存档、成就、随机事件、场景运行循环。

IO 抽象让同一条代码路径既服务于人类终端，也服务于机器人/测试/外部 AI。
"""

import json
import os
import random
import sys
from datetime import datetime

from . import terminal as T

VERSION = "1.0.0"
APP_NAME = "DevSaga 程序员模拟器"

SAVE_DIR = os.path.join(os.path.expanduser("~"), ".devsaga")
SAVE_FILE = os.path.join(SAVE_DIR, "save.json")
WORKSPACE_DIR = os.path.join(SAVE_DIR, "workspace")

RANKS = [
    ("实习程序员", 0),
    ("初级工程师", 200),
    ("中级工程师", 500),
    ("高级工程师", 1000),
    ("资深工程师", 1800),
    ("架构师", 2800),
    ("CTO", 4000),
    ("传奇程序员", 6000),
]

ACHIEVEMENTS = {
    "first_task": ("初出茅庐", "完成第一个任务"),
    "no_hint": ("无师自通", "不使用提示就完成一个场景"),
    "coffee_x3": ("咖啡因战神", "一场游戏里喝了 3 杯咖啡"),
    "all_scenarios": ("全能战士", "通关全部 10 个场景"),
    "bug_hunter": ("捉虫大师", "调试侦探零失误通关"),
    "algo_perfect": ("算法大神", "算法竞技场全部题目一次通过"),
    "rank_senior": ("崭露头角", "晋升为高级工程师"),
    "cto": ("登顶", "成为 CTO"),
    "docker_ninja": ("容器忍者", "通关《容器风暴》"),
    "pipeline_guru": ("流水线大师", "通关《发布流水线》"),
    "frontend_wizard": ("前端巫师", "通关《前端魔法屋》"),
    "security_guard": ("安全卫士", "通关《安全防线》"),
    "quiz_master": ("学霸", "任意课后测验满分"),
    "ending_seen": ("命运之门", "查看过自己的结局"),
    "hard_mode": ("地狱难度", "在地狱难度下通关一个场景"),
}

# 场景通关解锁的专属成就
SCENARIO_ACHIEVEMENTS = {
    "container_storm": "docker_ninja",
    "pipeline_deploy": "pipeline_guru",
    "frontend_magic": "frontend_wizard",
    "security_fortress": "security_guard",
}

DIFFICULTIES = {
    "easy":   {"label": "简单", "hint_after": 1, "step_cap": 300, "drain_every": 2, "drain": 1, "xp_mult": 1.5},
    "normal": {"label": "标准", "hint_after": 3, "step_cap": 200, "drain_every": 1, "drain": 1, "xp_mult": 1.0},
    "hard":   {"label": "地狱", "hint_after": 5, "step_cap": 60,  "drain_every": 1, "drain": 2, "xp_mult": 1.2},
}


def diff_cfg(profile):
    return DIFFICULTIES.get(profile["settings"].get("difficulty", "normal"), DIFFICULTIES["normal"])

PROMPT_STYLE = "bold", "cyan"
HUD_COLOR = "blue"


# --------------------------------------------------------------------------
# 玩家档案
# --------------------------------------------------------------------------

def default_profile(name="新员工"):
    return {
        "name": name,
        "xp": 0,
        "reputation": 0,
        "coffee": 100,          # 能量 0..100
        "coffee_drinks": 0,
        "created": datetime.now().isoformat(timespec="seconds"),
        "best": {},             # scenario_id -> {score, tasks, date}
        "finished": [],         # scenario_id 列表
        "achievements": [],
        "stats": {"tech": 0, "comm": 0, "risk": 0},   # 技术力/沟通力/冒险精神
        "quiz": {},             # scenario_id -> 测验最高分
        "choices_done": [],     # 已做过的剧情抉择
        "endings_seen": [],
        "settings": {"color": True, "story": False, "difficulty": "normal"},
    }


def save_dir():
    os.makedirs(SAVE_DIR, exist_ok=True)
    return SAVE_DIR


def workspace_dir():
    os.makedirs(WORKSPACE_DIR, exist_ok=True)
    return WORKSPACE_DIR


def save_profile(profile):
    save_dir()
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False, indent=2)


def load_profile():
    if os.path.exists(SAVE_FILE):
        try:
            with open(SAVE_FILE, "r", encoding="utf-8") as f:
                p = json.load(f)
            d = default_profile()
            d.update({k: v for k, v in p.items() if k in d})
            return d
        except (json.JSONDecodeError, OSError):
            return None
    return None


def rank_for(xp):
    cur = RANKS[0]
    for name, need in RANKS:
        if xp >= need:
            cur = (name, need)
    return cur


def next_rank(xp):
    for name, need in RANKS:
        if xp < need:
            return name, need
    return None


def add_xp(profile, amount, io=None):
    before = rank_for(profile["xp"])
    profile["xp"] += amount
    after = rank_for(profile["xp"])
    if io and after[0] != before[0]:
        io.print(T.paint(f"\n🎉 晋升！你现在是【{after[0]}】了！", "yellow", "bold"))
        if after[0] == "高级工程师":
            unlock_achievement(profile, "rank_senior", io)
        if after[0] == "CTO":
            unlock_achievement(profile, "cto", io)


def unlock_achievement(profile, aid, io=None):
    if aid in profile["achievements"] or aid not in ACHIEVEMENTS:
        return False
    profile["achievements"].append(aid)
    if io:
        name, desc = ACHIEVEMENTS[aid]
        io.print(T.box([T.paint(f"🏆 解锁成就：{name}", "yellow", "bold"), T.paint("   " + desc, "dim")], title="成就", color="yellow"))
    return True


# --------------------------------------------------------------------------
# IO 抽象：人类 / 脚本 / 测试共用
# --------------------------------------------------------------------------

class IO:
    interactive = True

    def print(self, text="", end="\n", style=None):
        raise NotImplementedError

    def input(self, prompt=""):
        raise NotImplementedError

    def pause(self):
        pass


class HumanIO(IO):
    interactive = True

    def __init__(self, story=False):
        self.story = story

    def print(self, text="", end="\n", style=None):
        sys.stdout.write(str(text) + end)
        sys.stdout.flush()

    def input(self, prompt=""):
        try:
            return input(prompt)
        except (EOFError, KeyboardInterrupt):
            return "exit"

    def pause(self):
        try:
            input(T.paint("  按回车继续...", "dim"))
        except (EOFError, KeyboardInterrupt):
            pass


class ScriptIO(IO):
    """脚本输入：依次消费 script 里的输入；用尽后返回默认值（1）。"""

    interactive = False

    def __init__(self, script=(), verbose=False):
        self.script = list(script)
        self.default = "1"
        self.verbose = verbose
        self.out = []

    def print(self, text="", end="\n", style=None):
        self.out.append(str(text))
        if self.verbose:
            sys.stdout.write(str(text) + end)
            sys.stdout.flush()

    def input(self, prompt=""):
        if self.script:
            return self.script.pop(0)
        return self.default


# --------------------------------------------------------------------------
# 场景会话
# --------------------------------------------------------------------------

class Session:
    def __init__(self, profile, scenario, io):
        self.profile = profile
        self.scenario = scenario
        self.io = io
        self.task_idx = 0
        self.attempts = 0
        self.hint_used = False
        self.commands_run = []
        self.score = 0
        self.xp_gained = 0
        self.steps = 0
        self.coffee_used = 0
        self.finished = False

    @property
    def tasks(self):
        return self.scenario.tasks

    def current_task(self):
        if self.task_idx < len(self.tasks):
            return self.tasks[self.task_idx]
        return None

    def all_done(self):
        return self.task_idx >= len(self.tasks)


def _hud(profile, session):
    rank_name, _ = rank_for(profile["xp"])
    p = profile
    energy = max(0, p["coffee"])
    ec = "green" if energy > 40 else ("yellow" if energy > 15 else "red")
    t = session.current_task()
    task_info = f"任务 {session.task_idx}/{len(session.tasks)}"
    if t:
        task_info += f" ｜ {t.title}"
    else:
        task_info += " ｜ 通关结算中..."
    line1 = (T.paint("👤 ", "dim") + T.paint(p["name"], "bold") +
             T.paint(f"  [{rank_name}]", "cyan") +
             T.paint(f"  XP {p['xp']}", "green") +
             T.paint(f"  ⭐声望 {p['reputation']}", "yellow"))
    line2 = (T.paint("☕ ", "dim") + T.bar(energy / 100.0, color=ec) +
             T.paint(f" {energy}/100", "dim") +
             T.paint("   📋 ", "dim") + T.paint(task_info, "white"))
    w = T.width()
    inner = max(10, w - 4)
    frame = "┌" + "─" * (w - 2) + "┐"
    return "\n".join([
        frame,
        "│ " + line1.ljust(inner) + " │",
        "│ " + line2.ljust(inner) + " │",
        "└" + "─" * (w - 2) + "┘",
    ])


def _prompt(profile):
    rank_name, _ = rank_for(profile["xp"])
    host = "glitchworks"
    return T.paint(f"{profile['name']}@{host}", "green", "bold") + T.paint(":~$ ", "cyan", "bold")


# --------------------------------------------------------------------------
# 随机事件：办公室小剧场（选项影响属性：tech 技术 / comm 沟通 / risk 冒险）
# --------------------------------------------------------------------------

STANDUPS = [
    ("老王（老板）", "昨天下班前那个接口怎么又 500 了？！", [
        ("已经回滚了，正在写复盘报告", "comm", 1),
        ("那是历史遗留问题，不是我写的", "risk", 1),
        ("我通宵修好了，看看我多努力", "comm", 1),
    ]),
    ("小美（PM）", "这个需求明天就要上线，功能做完了吗？", [
        ("做完了，还加了 3 个新功能", "comm", 1),
        ("还差一点，今晚搞定", "risk", 1),
        ("需求又变了？！", "risk", 1),
    ]),
    ("阿强（资深工程师）", "代码 Review 过了吗？别又写出魔法数字。", [
        ("过了过了，全是常量", "tech", 1),
        ("我现在就改", "comm", 1),
        ("魔法数字多酷啊", "risk", 1),
    ]),
    ("阿花（QA）", "这个 Bug 你写单测了吗？我可不想背锅。", [
        ("写了，12 个用例全绿", "tech", 1),
        ("代码能跑就行，测什么测", "risk", 1),
        ("求 QA 大佬手下留情", "comm", 1),
    ]),
    ("小美（PM）", "客户临时加需求：明天要个新报表，做吗？", [
        ("做！加个班的事", "risk", 1),
        ("做，但工期要顺延", "comm", 1),
        ("跟客户说做不了", "comm", 0),
    ]),
    ("老王（老板）", "听说隔壁公司被黑客端了，咱们这边安全吗？", [
        ("早就做过安全审计，报告在这", "tech", 1),
        ("应该……没事吧？", "risk", 1),
        ("我今晚再全面扫一遍", "comm", 1),
    ]),
    ("阿花（QA）", "安全扫描工具报了 3 个高危漏洞，你处理下？", [
        ("马上看详情，今天修完", "tech", 1),
        ("工具经常误报，先放着", "risk", 1),
        ("收到，修完同步给你", "comm", 1),
    ]),
]


def maybe_event(profile, session):
    """低概率触发办公室小剧场，回应影响属性，答对给一点 XP。"""
    if session.steps % 5 != 0 or random.random() > 0.3:
        return
    io = session.io
    who, line, options = random.choice(STANDUPS)
    io.print(T.box([T.paint(f"{who}：", "yellow", "bold") + line, "",
                    T.paint("（办公室小剧场 · 选一个回应）", "dim")],
                   title="💬 突发事件", color="magenta"))
    for i, (opt, _, _) in enumerate(options, 1):
        io.print(T.paint(f"  {i}) {opt}", "cyan"))
    ans = io.input("你的回应 > ").strip()
    if ans in ("1", "2", "3"):
        opt, stat, val = options[int(ans) - 1]
        profile["stats"][stat] += val
        gained = 5
        add_xp(profile, gained, io)
        session.xp_gained += gained
        stat_name = {"tech": "技术力", "comm": "沟通力", "risk": "冒险精神"}[stat]
        io.print(T.paint(f"（{stat_name} +{val}，声望 +2，XP +{gained}）", "dim"))
        profile["reputation"] += 2
    else:
        io.print(T.paint("（你沉默了，空气突然安静）", "dim"))


# --------------------------------------------------------------------------
# 剧情抉择与命运结算（多结局系统）
# --------------------------------------------------------------------------

PLOT_CHOICES = [
    ("plot_1", "公司资金紧张，老板问你能不能周末加班赶一个紧急项目：", [
        ("接！为公司拼了", "comm", 1),
        ("可以，但要调休和加班费", "risk", 1),
        ("拒绝，说身体不舒服", "comm", 0),
    ]),
    ("plot_2", "线上出了事故，大家都在甩锅，你作为当事人：", [
        ("主动认领并给出修复方案", "comm", 1),
        ("先查清楚证据再说话", "tech", 1),
        ("默默修好不吭声", "risk", 0),
    ]),
    ("plot_3", "新技术栈（Rust）最近很火，要不要投入时间学？", [
        ("学！技术才是硬通货", "tech", 1),
        ("先观望，等生态成熟", "risk", 0),
        ("没时间，够用就行", "comm", 0),
    ]),
]


def maybe_plot(profile, io):
    """主菜单里触发一个未做过的剧情抉择，影响属性。"""
    for cid, prompt, options in PLOT_CHOICES:
        if cid in profile["choices_done"]:
            continue
        io.print(T.box([T.paint("🧭 命运的岔路口", "magenta", "bold"), "",
                        T.paint(prompt, "bold"),
                        T.paint("（你的选择会改变结局走向）", "dim")],
                       title="抉择", color="magenta"))
        for i, (opt, _, _) in enumerate(options, 1):
            io.print(T.paint(f"  {i}) {opt}", "cyan"))
        ans = io.input("你的选择 > ").strip()
        profile["choices_done"].append(cid)
        if ans in ("1", "2", "3"):
            _, stat, val = options[int(ans) - 1]
            profile["stats"][stat] += val
            stat_name = {"tech": "技术力", "comm": "沟通力", "risk": "冒险精神"}[stat]
            io.print(T.paint(f"（{stat_name} +{val}，命运已悄然改变…）", "dim"))
        else:
            io.print(T.paint("（你选择了沉默，命运没有改变）", "dim"))
        return True
    return False


def compute_ending(profile):
    """根据属性和通关数结算结局。"""
    stats = profile["stats"]
    finished = len(profile["finished"])
    if finished >= 10 and stats["tech"] >= 5:
        return ("👑 技术掌舵人",
                "你把 10 个开发环境都踩平了，技术力无人能敌。董事会一致通过：你就是下一任 CTO。",
                "tech")
    if stats["comm"] >= 5:
        return ("🤝 创业合伙人",
                "你太会来事了，连最难搞的客户都被你哄得服服帖帖。老板拉你一起创业，你成了联合创始人。",
                "comm")
    if stats["risk"] >= 5:
        return ("🚀 独立开发者",
                "你不甘于朝九晚五，辞职做了独立开发者。第一款产品就火了，GitHub 万星。",
                "risk")
    if finished >= 3:
        return ("🏢 稳定打工人",
                "不温不火，但胜在稳定。你的代码从没出过大事故，年终奖多拿了一个月。",
                "stable")
    return ("🌱 实习生",
            "故事才刚刚开始。多通关几个场景、多做一些抉择，你的命运会改变。",
            "stable")


ENDINGS = {
    "👑 技术掌舵人": "tech",
    "🤝 创业合伙人": "comm",
    "🚀 独立开发者": "risk",
    "🏢 稳定打工人": "stable",
    "🌱 实习生": "stable",
}


def show_ending(profile, io):
    title, desc, kind = compute_ending(profile)
    stats = profile["stats"]
    io.print(T.box([
        T.paint(f"🎬 {title}", "bold", "yellow"),
        "",
        T.paint(desc, "white"),
        "",
        T.paint(f"  技术力 {stats['tech']}   沟通力 {stats['comm']}   冒险精神 {stats['risk']}", "dim"),
        T.paint(f"  通关 {len(profile['finished'])}/10 个场景", "dim"),
        "",
        T.paint("（结局由你的属性与通关数决定：技术/沟通/冒险三条路线）", "dim"),
    ], title="命运结算", color="yellow"))
    if "ending_seen" not in profile["endings_seen"]:
        profile["endings_seen"].append(title)
        unlock_achievement(profile, "ending_seen", io)
    io.pause()


# --------------------------------------------------------------------------
# 场景运行主循环
# --------------------------------------------------------------------------

def apply_command(profile, session, cmd):
    """执行一条命令，返回 (resp_text, task_completed, error_text)。

    供 run_scenario 和 Stepper（TCP / RL 接口）共用。
    """
    pending_err = None
    resp = None
    try:
        resp = session.scenario.handle(cmd, session)
    except Exception as exc:  # noqa: BLE001
        from .scenarios.base import CommandError
        if isinstance(exc, CommandError):
            pending_err = exc
        else:
            return None, False, f"环境内部错误：{exc}"
    session.commands_run.append(cmd)
    session.steps += 1
    cfg = diff_cfg(profile)
    if session.steps % cfg["drain_every"] == 0:
        profile["coffee"] = max(0, profile["coffee"] - cfg["drain"])
    t = session.current_task()
    if t and t.check(session, cmd):
        return resp, True, None
    if pending_err is not None:
        session.attempts += 1
        return resp, False, str(pending_err)
    session.attempts += 1
    return resp, False, None


def run_scenario(profile, scenario, io, show_intro=True):
    """运行一个场景。返回结果 dict：{scenario, tasks_done, score, xp, hint_used, skipped}"""
    T.enable_ansi()
    T.ENABLE_COLOR = profile["settings"].get("color", True)
    session = Session(profile, scenario, io)
    profile["coffee"] = min(100, profile["coffee"] + 40)  # 新场景开工，回回血

    if show_intro:
        head = scenario.intro() or scenario.tagline
        io.print(T.box(head, title=f"📂 场景 {scenario.id}：{scenario.name}", color="cyan"))
        io.print(T.paint(f"环境：{scenario.env}  难度：{'★' * scenario.difficulty}", "dim"))
        io.print()

    cfg = diff_cfg(profile)
    while not session.all_done():
        if session.steps > cfg["step_cap"]:
            io.print(T.paint(f"⚠ 步数超过上限（{cfg['step_cap']}），强制结算。", "red"))
            break
        io.print(_hud(profile, session))
        t = session.current_task()
        if t is None:
            break
        io.print(T.paint(f"📌 {t.title}", "bold"))
        io.print(T.paint("   " + t.brief, "white"))

        if session.attempts >= cfg["hint_after"] and not session.hint_used and t.hints:
            io.print(T.paint("（你卡住了，看看提示吧：输入 hint）", "yellow"))

        cmd = io.input(_prompt(profile)).strip()
        if not cmd:
            continue
        low = cmd.lower()
        if low in ("exit", "quit", "menu", "back"):
            io.print(T.paint("（你暂时离开了场景，进度已保存）", "dim"))
            save_profile(profile)
            return {"scenario": scenario.id, "tasks_done": session.task_idx,
                    "score": session.score, "xp": session.xp_gained,
                    "hint_used": session.hint_used, "finished": session.all_done()}
        if low in ("help", "?"):
            io.print(scenario.help_text(session))
            io.print(T.paint("  游戏命令：hint 提示 ｜ learn 知识点 ｜ skip 跳过当前任务 ｜ exit 离开", "dim"))
            continue
        if low == "hint":
            if t and t.hints:
                session.hint_used = True
                io.print(T.paint("💡 提示：", "yellow", "bold") + T.paint(t.hints[0], "yellow"))
            else:
                io.print(T.paint("（这道题没有提示）", "dim"))
            continue
        if low == "learn":
            if t and t.lesson:
                from .lessons import show_lesson
                show_lesson(io, t.lesson)
            else:
                io.print(T.paint("（当前任务没有关联知识点）", "dim"))
            continue
        if low == "skip":
            io.print(T.paint("⏭ 你放弃了当前任务（无奖励）", "yellow"))
            _complete_task(session, t, skipped=True)
            continue
        if low == "coffee":
            _drink_coffee(profile, session)
            continue
        if low == "env":
            io.print(T.paint(scenario.env_desc(), "dim"))
            continue

        resp, done, err = apply_command(profile, session, cmd)
        if resp:
            io.print(resp)
        if err:
            io.print(T.paint("⚠ " + err, "red"))
        if done:
            t = session.current_task()
            _complete_task(session, t)
        else:
            t = session.current_task()
            if t and session.attempts >= cfg["hint_after"] and t.hints and not session.hint_used:
                io.print(T.paint("💡 提示：", "yellow", "bold") + T.paint(t.hints[0], "yellow"))

        if io.interactive:
            maybe_event(profile, session)

    # 场景通关
    finished_all = session.all_done()
    result = {"scenario": scenario.id, "tasks_done": session.task_idx,
              "score": session.score, "xp": session.xp_gained,
              "hint_used": session.hint_used, "finished": finished_all}

    if finished_all:
        bonus = scenario.xp_bonus
        add_xp(profile, bonus, io)
        session.xp_gained += bonus
        session.score += bonus
        profile["reputation"] += 10
        if scenario.id not in profile["finished"]:
            profile["finished"].append(scenario.id)
        best = profile["best"].get(scenario.id)
        if best is None or session.score > best.get("score", 0):
            profile["best"][scenario.id] = {
                "score": session.score,
                "tasks": session.task_idx,
                "date": datetime.now().isoformat(timespec="seconds"),
            }
        io.print(T.box(
            [T.paint(f"🎉 场景《{scenario.name}》通关！", "green", "bold"),
             T.paint(f"  得分 {session.score}  经验 +{bonus}  声望 +10", "cyan"),
             T.paint(f"  用时 {session.steps} 步  提示使用 {'是' if session.hint_used else '否'}", "dim")],
            title="通关", color="green"))
        if scenario.id == "debug_detective" and not session.hint_used and session.attempts <= 2:
            unlock_achievement(profile, "bug_hunter", io)
        if not session.hint_used:
            unlock_achievement(profile, "no_hint", io)
        aid = SCENARIO_ACHIEVEMENTS.get(scenario.id)
        if aid:
            unlock_achievement(profile, aid, io)
        if diff_cfg(profile)["label"] == "地狱":
            unlock_achievement(profile, "hard_mode", io)
        _check_all_finished(profile, io)

    save_profile(profile)
    io.pause()
    return result


def _complete_task(session, task, skipped=False):
    session.task_idx += 1
    session.attempts = 0
    session.hint_used = False
    if not skipped:
        cfg = diff_cfg(session.profile)
        xp = int(task.xp * cfg["xp_mult"])
        session.score += task.reward
        add_xp(session.profile, xp, session.io)
        session.xp_gained += xp
        session.io.print(T.paint(f"✅ 任务完成！+{task.reward} 分  +{xp} XP", "green", "bold"))
        unlock_achievement(session.profile, "first_task", session.io) if session.task_idx == 1 else None
    else:
        session.io.print(T.paint("（已跳过，进入下一任务）", "dim"))
    if task.lesson and not skipped:
        from .lessons import show_lesson
        show_lesson(session.io, task.lesson, brief=True)


def _drink_coffee(profile, session):
    if session.coffee_used >= 3:
        session.io.print(T.paint("（咖啡因摄入已达上限，再喝要进 ICU 了）", "red"))
        return
    profile["coffee"] = min(100, profile["coffee"] + 40)
    profile["coffee_drinks"] += 1
    session.coffee_used += 1
    session.io.print(T.paint("☕ 吨吨吨！能量 +40，你感觉自己又行了！", "yellow"))
    if session.coffee_used >= 3:
        unlock_achievement(profile, "coffee_x3", session.io)


def _check_all_finished(profile, io):
    from .scenarios import ALL_SCENARIOS
    if len(profile["finished"]) >= len(ALL_SCENARIOS):
        unlock_achievement(profile, "all_scenarios", io)


# --------------------------------------------------------------------------
# 逐步执行器：给 TCP 服务 / RL 接口 / 外部 AI 用
# --------------------------------------------------------------------------

class Stepper:
    """reset 后逐条喂命令；不打印，只返回结构化结果。"""

    def __init__(self, profile, scenario_id):
        from .scenarios import new_scenario
        self.profile = profile
        self.scenario_id = scenario_id
        self.io = ScriptIO()
        self.scenario = new_scenario(scenario_id)
        self.session = Session(profile, self.scenario, self.io)

    def reset(self):
        from .scenarios import new_scenario
        self.scenario = new_scenario(self.scenario_id)
        self.io = ScriptIO()
        self.session = Session(self.profile, self.scenario, self.io)
        return self.observe()

    def step(self, cmd):
        self.io.out.clear()
        resp, done, err = apply_command(self.profile, self.session, cmd)
        text = (resp or "")
        if err:
            text += ("\n" if text else "") + "⚠ " + err
        task_done = done
        if done:
            t = self.session.current_task()
            _complete_task(self.session, t)
        return {
            "text": text,
            "messages": "\n".join(self.io.out),   # 任务完成/知识点等附加输出
            "task_done": task_done,
            "all_done": self.session.all_done(),
            "score": self.session.score,
            "xp": self.session.xp_gained,
            "state": self.observe(),
        }

    def observe(self):
        t = self.session.current_task()
        return {
            "scenario": self.scenario_id,
            "task_index": self.session.task_idx,
            "task_count": len(self.session.tasks),
            "task_title": t.title if t else None,
            "all_done": self.session.all_done(),
            "score": self.session.score,
            "xp": self.session.xp_gained,
            "energy": self.profile["coffee"],
            "profile_name": self.profile["name"],
        }
