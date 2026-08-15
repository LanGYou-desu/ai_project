"""场景 10：前端魔法屋 —— 新首页上线即翻车：白屏、按钮失灵、样式错乱、卡顿。

支持：view / inspect / js errors / js fix / event / css fix / perf / perf fix / fix <n> / screenshot。
"""

import shlex

from .. import terminal as T
from .base import CommandError, Scenario, Task


class FrontendMagic(Scenario):
    id = "frontend_magic"
    name = "前端魔法屋"
    tagline = "设计师交付的页面美如画，一上线全崩：白屏、按钮没反应、布局乱飞、卡成 PPT。\n打开浏览器调试工具，一个个修回来。"
    env = "browser（模拟网页调试）"
    difficulty = 2
    xp_bonus = 130

    def setup(self):
        self.ran = set()
        self.fixed = set()
        self.render_ok = False
        self.issue_text = {
            1: ("JS 错误", "Uncaught ReferenceError: render is not defined\n（入口脚本第 3 行调用了不存在的 render 函数，页面直接白屏）"),
            2: ("事件绑定", "按钮 #buy-btn 绑定了错误的处理函数 buyNow()\n点击后 console 报错：TypeError: price is undefined"),
            3: ("盒模型", ".card { width: 100%; padding: 20px; border: 2px; }\n未设置 box-sizing: border-box，内容把卡片撑爆了"),
            4: ("性能", "首屏加载了 12 张 5MB 大图，无懒加载\n滚动时频繁触发重排（layout thrashing），帧率只有 12fps"),
        }
        self.tasks = [
            Task("f1", "页面白屏了",
                 "先看看页面渲染成什么样。用 view / 查看。",
                 check=self._ran("view /"),
                 hints=("view /",), lesson="fe_dom"),
            Task("f2", "修复 JS 错误",
                 "页面白屏多半是 JS 崩了。查 JS 错误，修复第一个问题。",
                 check=lambda s, c: 1 in s.scenario.fixed,
                 hints=("js errors", "fix 1"), lesson="fe_js", answer="fix 1"),
            Task("f3", "按钮失灵",
                 "页面能显示了，但「立即购买」按钮点了没反应。查一下事件绑定。",
                 check=lambda s, c: 2 in s.scenario.fixed,
                 hints=("event click", "fix 2"), lesson="fe_js", answer="fix 2"),
            Task("f4", "样式错乱",
                 "卡片把页面撑爆了，布局乱飞。检查 .card 的盒模型。",
                 check=lambda s, c: 3 in s.scenario.fixed,
                 hints=("inspect .card", "fix 3"), lesson="fe_css", answer="fix 3"),
            Task("f5", "性能优化",
                 "页面卡成 PPT。检查性能问题并优化。",
                 check=lambda s, c: 4 in s.scenario.fixed,
                 hints=("perf", "fix 4"), lesson="fe_perf", answer="fix 4"),
            Task("f6", "最终验收",
                 "所有问题都修完了吧？重新渲染页面验收。",
                 check=lambda s, c: s.scenario.render_ok,
                 hints=("view /",), lesson="fe_dom"),
        ]

    def _ran(self, kw):
        return lambda s, c: any(kw in x for x in s.scenario.ran)

    def handle(self, cmd, session):
        self.ran.add(cmd)
        tokens = shlex.split(cmd) if cmd.strip() else []
        if not tokens:
            raise CommandError("输入为空")
        c0 = tokens[0].lower()
        try:
            if c0 == "help":
                return self.help_text(session)
            if c0 == "view":
                return self._cmd_view(tokens[1] if len(tokens) > 1 else "/")
            if c0 == "inspect":
                sel = tokens[1] if len(tokens) > 1 else ""
                if sel in (".card", "#card", "card"):
                    if 3 in self.fixed:
                        return ".card { box-sizing: border-box; width: 100%; padding: 20px; }\n✅ 盒模型正常"
                    return (self.issue_text[3][1] + "\n（修复：fix 3）")
                raise CommandError(f"inspect: 只支持 .card（其他元素还轮不到查）")
            if c0 == "js":
                return self._cmd_js(tokens[1:])
            if c0 == "event":
                ev = tokens[1] if len(tokens) > 1 else ""
                if ev != "click":
                    raise CommandError("event click：查看点击事件")
                if 2 in self.fixed:
                    return "#buy-btn 绑定 click → buyNow() ✅ 正常"
                return self.issue_text[2][1] + "\n（修复：fix 2）"
            if c0 == "css":
                if len(tokens) > 1 and tokens[1] == "fix":
                    return "css fix 已并入 fix 命令：直接 fix 3"
                raise CommandError("用 inspect .card 查看样式，用 fix 3 修复")
            if c0 == "perf":
                if 4 in self.fixed:
                    return ("首屏 LCP 0.8s ✅  帧率 60fps ✅  已启用懒加载 ✅")
                return self.issue_text[4][1] + "\n（修复：fix 4）"
            if c0 == "fix":
                n = tokens[1] if len(tokens) > 1 else ""
                if not n.isdigit():
                    raise CommandError("fix <编号>：1=JS 2=事件 3=盒模型 4=性能")
                self.fixed.add(int(n))
                name, _ = self.issue_text[int(n)]
                return f"已修复问题 {n}（{name}）✅"
            if c0 == "screenshot":
                return self._cmd_view("/", shot=True)
            raise CommandError(f"{c0}: 未找到命令。输入 help 查看前端调试命令。")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"{c0}: 出错：{exc}")

    def _cmd_js(self, args):
        if not args or args[0] != "errors":
            raise CommandError("js errors：查看 JS 报错")
        if 1 in self.fixed:
            return "console 无报错 ✅"
        return self.issue_text[1][1] + "\n（修复：fix 1）"

    def _cmd_view(self, url, shot=False):
        head = "📸 截图：" if shot else "渲染结果："
        if url != "/":
            raise CommandError("view: 只有首页 /（其它页面还没部署）")
        missing = [n for n in (1, 2, 3, 4) if n not in self.fixed]
        if not missing:
            self.render_ok = True
            return (head + "\n"
                    "✅ 页面完整渲染！\n"
                    "  ├─ 头部导航栏 ✓\n"
                    "  ├─ Hero 大图 ✓（已懒加载）\n"
                    "  ├─ 商品卡片 x12 ✓（盒模型正常）\n"
                    "  ├─ 立即购买按钮 ✓（点击正常）\n"
                    "  └─ 性能：60fps ✓\n"
                    "  LCP 0.8s，全部组件就位。")
        lines = [head, "⚠ 页面渲染不完整，还有问题："]
        for n in missing:
            name, _ = self.issue_text[n]
            lines.append(f"  ❌ {name}（fix {n}）")
        lines.append("提示：用 js errors / event / inspect / perf 定位问题")
        return "\n".join(lines)

    def help_text(self, session):
        return T.box([
            "渲染：view / ｜ screenshot",
            "排查：js errors ｜ event click ｜ inspect .card ｜ perf",
            "修复：fix <编号>（1=JS 2=事件 3=盒模型 4=性能）",
        ], title="前端调试手册", color="cyan")

    def solve(self):
        return [
            "view /",
            "js errors",
            "fix 1",
            "event click",
            "fix 2",
            "inspect .card",
            "fix 3",
            "perf",
            "fix 4",
            "view /",
        ]

    def dashboard(self):
        items = [{"label": f"{n}. {self.issue_text[n][0]}",
                  "state": "已修复" if n in self.fixed else "待修复",
                  "ok": n in self.fixed} for n in (1, 2, 3, 4)]
        return {"theme": {"icon": "🎨", "title": "前端调试台", "accent": "#f778ba"},
                "panels": [
                    {"kind": "status", "title": "页面健康", "items": items},
                    {"kind": "kv", "title": "渲染", "items": [
                        ["状态", "完整渲染" if self.render_ok else "不完整"],
                        ["帧率", "60fps" if 4 in self.fixed else "12fps"]]},
                ]}
