"""场景 3：调试侦探 —— 阅读可疑代码，揪出藏起来的 Bug。

答题型场景：每个任务给一段有 Bug 的代码和四个选项，输入 A/B/C/D。
最后一个任务支持用 step/vars/run 单步调试找 Bug。
"""

from .. import terminal as T
from .base import CommandError, Scenario, Task


class DebugDetective(Scenario):
    id = "debug_detective"
    name = "调试侦探"
    tagline = "代码不会说谎，但 Bug 很会藏。\n你收到一批「上了保险」的代码——每一段都藏着经典的坑。\n找到它们，你就是全公司最亮的捉虫大师。"
    env = "debug-detective（代码推理）"
    difficulty = 2
    xp_bonus = 120

    def setup(self):
        self.state["trace"] = {"line": 0, "vars": {}, "max": 6}
        self.tasks = [
            Task("d1", "越界之殇",
                 self._q(
                     "def get_last(arr):\n    return arr[len(arr)]",
                     "调用 get_last([1, 2, 3]) 会发生什么？",
                     ["返回 3", "返回 None", "抛出 IndexError", "死循环"]),
                 check=self._ans("C"), hints=("数组索引从 0 开始，最后一个元素是 len(arr)-1",),
                 lesson="bug_offbyone", answer="C"),
            Task("d2", "共享的魔盒",
                 self._q(
                     "def add(x, bag=[]):\n    bag.append(x)\n    return bag\n\n"
                     "add(1)\nadd(2)\nprint(add(3))",
                     "这段代码最终输出什么？",
                     ["[1, 2, 3]", "[3]", "[1, 3]", "报错"]),
                 check=self._ans("A"), hints=("默认参数 [] 只创建一次，所有调用共享同一个列表",),
                 lesson="bug_mutable", answer="A"),
            Task("d3", "消失的 0.3",
                 self._q(
                     "print(0.1 + 0.2 == 0.3)",
                     "输出是什么？",
                     ["True", "False", "报错", "None"]),
                 check=self._ans("B"), hints=("二进制表示不了 0.1，浮点有误差",),
                 lesson="bug_float", answer="B"),
            Task("d4", "作用域的暗影",
                 self._q(
                     "count = 0\n\ndef inc():\n    count += 1\n\ninc()",
                     "运行这段代码会怎样？",
                     ["正常，count 变成 1", "UnboundLocalError", "NameError", "TypeError"]),
                 check=self._ans("B"), hints=("函数内给 count 赋值，Python 会把它当成局部变量",),
                 lesson="bug_scope", answer="B"),
            Task("d5", "同一个列表",
                 self._q(
                     "a = [1, 2, 3]\nb = a\nb.append(4)\nprint(a)",
                     "print(a) 输出什么？",
                     ["[1, 2, 3]", "[1, 2, 3, 4]", "报错", "[4, 1, 2, 3]"]),
                 check=self._ans("B"), hints=("b = a 只是复制了引用，两者是同一个对象",),
                 lesson="bug_copy", answer="B"),
            Task("d6", "永不停止的循环",
                 self._q(
                     "i = 0\nwhile i < 10:\n    print(i)",
                     "这个程序会怎样？",
                     ["打印 0 到 9", "打印 0 到 10", "死循环", "报错"]),
                 check=self._ans("C"), hints=("循环里没有任何语句改变 i 的值",),
                 lesson="bug_infinite", answer="C"),
            Task("d7", "字符串里的刺客",
                 self._q(
                     "name = input(\"用户名：\")\nsql = f\"SELECT * FROM users WHERE name='{name}'\"",
                     "输入什么能让它绕过登录（返回所有用户）？",
                     ["admin", "' OR '1'='1", "12345", "无法绕过"]),
                 check=self._ans("B"), hints=("把输入拼进 SQL，引号会被利用成 SQL 语法",),
                 lesson="bug_sqli", answer="B"),
            Task("d8", "单步追凶",
                 "这次用调试器抓 Bug！这段函数想找最大值，但会崩溃：\n\n"
                 "  1  def find_max(nums):\n"
                 "  2      m = nums[0]\n"
                 "  3      for i in range(len(nums)):\n"
                 "  4          if nums[i] > m:\n"
                 "  5              m = nums[i + 1]   ← 这里不对劲\n"
                 "  6      return m\n\n"
                 "调试命令：step 单步 ｜ vars 查看变量 ｜ run 直接运行到报错 ｜ reset 重来\n"
                 "找到出错的那一行，输入行号作答。",
                 check=lambda s, c: c.strip() == "5",
                 hints=("用 step 走几步，nums[4] 越界时会抛 IndexError",),
                 lesson="bug_offbyone", answer="5"),
        ]

    def _q(self, code, question, options):
        lines = [code, "", "❓ " + question]
        for i, opt in enumerate(options):
            lines.append(f"   {chr(65 + i)}) {opt}")
        lines.append("（输入选项字母作答）")
        return "\n".join(lines)

    def _ans(self, letter):
        return lambda s, c: c.strip().upper() == letter

    def handle(self, cmd, session):
        low = cmd.strip().lower()
        tr = self.state["trace"]
        if low in ("step", "vars", "run", "reset"):
            if tr["line"] == 0:
                tr["line"] = 1
                tr["vars"] = {"nums": "[5, 3, 9, 1, 7]", "m": None, "i": None}
                return "已进入调试：停在第 1 行，函数开始。"
            if low == "reset":
                tr["line"] = 0
                tr["vars"] = {}
                return "调试已重置。"
            if low == "vars":
                return "变量：" + "  ".join(f"{k}={v}" for k, v in tr["vars"].items())
            if low == "run":
                tr["line"] = 5
                return ("运行到第 5 行时崩溃：IndexError: list index out of range\n"
                        "（i=3 时访问 nums[4]，但列表只有 4 个元素）")
            if low == "step":
                tr["line"] += 1
                v = tr["vars"]
                if tr["line"] == 3:
                    v["i"] = 0
                elif tr["line"] == 4:
                    v["m"] = 5
                    v["i"] = 1
                elif tr["line"] == 5:
                    v["i"] = 2
                    v["m"] = 9
                if tr["line"] >= 5:
                    return ("停在第 5 行：m = nums[3 + 1] → IndexError！\n"
                            "（当 i=3 时 nums[i+1]=nums[4] 越界了，bug 就在第 5 行）")
                return f"停在第 {tr['line']} 行。"
            return "（debug 命令）"
        raise CommandError("这里只需要你作答或使用调试命令 step/vars/run/reset")

    def help_text(self, session):
        return T.box([
            "这是一个推理场景：读代码，输入选项字母 A/B/C/D 作答。",
            "最后一个任务支持调试命令：step ｜ vars ｜ run ｜ reset",
            "输入 hint 看提示；输入 skip 跳过当前任务。",
        ], title="调试侦探说明", color="cyan")

    def solve(self):
        return ["C", "A", "B", "B", "B", "C", "B", "step", "step", "step", "step", "vars", "5"]

    def dashboard(self):
        tr = self.state.get("trace", {})
        vars_txt = "  ".join(f"{k}={v}" for k, v in tr.get("vars", {}).items()) or "—"
        return {"theme": {"icon": "🐞", "title": "调试工作台", "accent": "#d29922"},
                "panels": [
                    {"kind": "kv", "title": "调试器", "items": [
                        ["当前行", tr.get("line", 0)],
                        ["变量", vars_txt]]},
                    {"kind": "log", "title": "操作提示", "lines": [
                        "读代码 → 输入选项 A / B / C / D 作答",
                        "第 8 题支持单步：step / vars / run",
                        "输入 hint 看提示，skip 跳过",
                    ]},
                ]}
