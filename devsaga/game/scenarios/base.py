"""场景基类：Task（任务）与 Scenario（场景）的通用框架。"""


class CommandError(Exception):
    """场景环境无法理解玩家命令时抛出。"""


class Task:
    """一个可完成的任务。

    check(session, cmd) 返回 True 表示任务完成。
    cmd 是玩家输入的原样命令（对答题型任务，cmd 就是答案）。
    """

    def __init__(self, tid, title, brief, check=None, reward=120, xp=40,
                 hints=(), lesson=None, answer=None):
        self.tid = tid
        self.title = title
        self.brief = brief
        self.check = check or (lambda s, c: False)
        self.reward = reward
        self.xp = xp
        self.hints = tuple(hints)
        self.lesson = lesson
        self.answer = answer  # 标准答案（展示用）


class Scenario:
    """一个可玩的开发环境场景。每个实例有独立状态，可重复游玩。"""

    id = ""
    name = ""
    tagline = ""
    env = ""            # 例如 "linux-shell"
    difficulty = 1      # 1..5
    xp_bonus = 80

    def __init__(self):
        self.state = {}
        self.setup()

    # ---- 子类实现 ----
    def setup(self):
        """初始化场景内部状态（虚拟文件系统 / git 仓库 / 服务器等）。"""

    def intro(self):
        """场景开场剧情文本。"""

    def help_text(self, session):
        """环境命令帮助。"""

    def env_desc(self):
        return "（当前环境说明）"

    def handle(self, cmd, session):
        """处理玩家命令，返回要显示的文本。未知命令抛 CommandError。"""
        raise CommandError("这个环境里没有这个命令，输入 help 看看能做什么。")

    def solve(self):
        """参考通关脚本：按顺序输入这些命令即可通关（机器人模式用）。"""
        return []

    # ---- 通用 ----
    @property
    def tasks(self):
        return getattr(self, "_tasks", [])

    @tasks.setter
    def tasks(self, value):
        self._tasks = value

    def dashboard(self):
        """返回结构化工作台数据，供网页版按场景渲染专属 UI。

        格式：{"theme": {"icon", "title", "accent"}, "panels": [
            {"kind": "meter"|"status"|"table"|"kv"|"log", "title", ...}
        ]}
        """
        return {"theme": {"icon": "🛠", "title": "工作台", "accent": "#58a6ff"},
                "panels": []}

    def finish_hint(self, text):
        return "💡 " + text
