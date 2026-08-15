"""场景 9：发布流水线 —— 周五 17:00，你负责发布 v2.3，流水线第一道就红了。

支持：pipeline status / run / logs / retry，fix <文件>，deploy --blue/--green，
health check，rollback，test run。
"""

import shlex

from .. import terminal as T
from .base import CommandError, Scenario, Task


class PipelineDeploy(Scenario):
    id = "pipeline_deploy"
    name = "发布流水线"
    tagline = "周五 17:00，老板说：今天必须把 v2.3 发上去。\n流水线从 build 到 lint 全线飘红——你负责把它们一个个救绿。"
    env = "ci/cd（模拟流水线）"
    difficulty = 2
    xp_bonus = 130

    def setup(self):
        self.ran = set()
        self.stage_logs = {
            "build": ["$ npm run build",
                      "> glitch-app@2.3.0 build",
                      "ERROR in ./src/app.py:42:5",
                      "SyntaxError: Unexpected token ':'",
                      "构建失败，退出码 1"],
            "test": ["$ pytest -q",
                     "FAILED test_app.py::test_add",
                     "E   assert add(1, 2) == 4",
                     "E    +  where add(1, 2) = 3",
                     "1 failed, 11 passed"],
            "lint": ["$ flake8 src/",
                     "E: app.py:18:4 - 检测到 eval( 使用（安全风险）",
                     "W: app.py:92 行过长（>100 字符）"],
        }
        self.stages = {"build": "fail", "test": "pending", "lint": "pending", "deploy": "pending"}
        self.app_fixed = False
        self.test_fixed = False
        self.build_passed = False
        self.test_passed = False
        self.lint_passed = False
        self.blue_version = "v2.2"
        self.blue_health = "ok"
        self.green_version = None
        self.green_health = "unknown"
        self.rolled_back = False
        self.deployed_green = False
        self.tasks = [
            Task("p1", "查看流水线状态",
                 "看看流水线现在卡在哪。用 pipeline status 查看各阶段状态。",
                 check=self._ran("pipeline status"),
                 hints=("pipeline status",), lesson="ci_build"),
            Task("p2", "修好构建",
                 "build 阶段挂了。看日志找到原因，修好后再跑一次流水线。",
                 check=lambda s, c: s.scenario.build_passed,
                 hints=("pipeline logs build", "fix app.py", "pipeline run"),
                 lesson="ci_build", answer="fix app.py → pipeline run"),
            Task("p3", "闯过测试门禁",
                 "build 绿了，test 又红了。看测试日志，找到失败的用例并修复。",
                 check=lambda s, c: s.scenario.test_passed,
                 hints=("pipeline logs test", "fix test_app.py", "pipeline run"),
                 lesson="ci_test", answer="fix test_app.py → pipeline run"),
            Task("p4", "过代码门禁",
                 "test 也绿了，但 lint 拦住了：代码里有 eval（安全风险）。修掉它。",
                 check=lambda s, c: s.scenario.lint_passed,
                 hints=("pipeline logs lint", "fix app.py", "pipeline run"),
                 lesson="ci_test", answer="fix app.py → pipeline run"),
            Task("p5", "蓝绿发布与回滚",
                 "部署到蓝色环境试试水——健康检查挂了！用 rollback 回滚，保住线上。",
                 check=lambda s, c: s.scenario.rolled_back,
                 hints=("deploy --blue v2.3", "health check", "rollback"),
                 lesson="ci_deploy", answer="deploy --blue v2.3 → rollback"),
            Task("p6", "全绿上线",
                 "问题修好了，这次部署到绿色环境，健康检查确认后正式上线。",
                 check=lambda s, c: s.scenario.deployed_green,
                 hints=("deploy --green v2.3", "health check"),
                 lesson="ci_deploy", answer="deploy --green v2.3"),
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
            if c0 == "pipeline":
                return self._pipeline(tokens[1:])
            if c0 == "fix":
                return self._fix(tokens[1:])
            if c0 == "deploy":
                return self._deploy(tokens[1:])
            if c0 == "health":
                return self._health()
            if c0 == "rollback":
                self.blue_version = "v2.2"
                self.blue_health = "ok"
                self.rolled_back = True
                return ("已回滚：蓝环境恢复为 v2.2，线上服务正常 ✅\n"
                        "（绿环境还是干净的，可以排查问题后再发）")
            if c0 == "test":
                if len(tokens) > 1 and tokens[1] == "run":
                    return self._test_run()
                raise CommandError("用法：test run")
            if c0 == "approve":
                return "审批通过。（只是个仪式，别太当真）"
            raise CommandError(f"{c0}: 未找到命令。输入 help 查看流水线命令。")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"{c0}: 出错：{exc}")

    def _pipeline(self, args):
        if not args:
            raise CommandError("用法：pipeline status ｜ pipeline run ｜ pipeline logs <阶段>")
        sub = args[0]
        if sub == "status":
            rows = [[s, "✅" if st == "pass" else ("❌" if st == "fail" else "⏳"),
                     st] for s, st in self.stages.items()]
            return T.table(["阶段", "状态", "详情"], rows)
        if sub == "run":
            return self._pipeline_run()
        if sub == "logs":
            if len(args) < 2:
                raise CommandError("pipeline logs <build|test|lint>")
            stage = args[1]
            if stage not in self.stage_logs:
                raise CommandError("pipeline logs: 可选 build / test / lint")
            return "\n".join(self.stage_logs[stage])
        if sub == "retry":
            if len(args) < 2:
                raise CommandError("pipeline retry <阶段>")
            stage = args[1]
            if stage in self.stages:
                self.stages[stage] = "pending"
            return f"已重置 {stage} 阶段。再跑一次 pipeline run。"
        raise CommandError("pipeline: 支持 status / run / logs / retry")

    def _pipeline_run(self):
        out = []
        if not self.app_fixed:
            self.stages["build"] = "fail"
            out.append("❌ build 失败：src/app.py:42 语法错误（Unexpected token ':'）")
            self._tail_stages_fail()
            return "\n".join(out)
        self.stages["build"] = "pass"
        self.build_passed = True
        out.append("✅ build 通过")
        if not self.test_fixed:
            self.stages["test"] = "fail"
            out.append("❌ test 失败：test_add 断言 add(1,2) == 4 未通过")
            self.stages["lint"] = "pending"
            return "\n".join(out)
        self.stages["test"] = "pass"
        self.test_passed = True
        out.append("✅ test 通过（12 个用例全绿）")
        if not self.app_fixed:
            self.stages["lint"] = "fail"
            out.append("❌ lint 失败：app.py 使用 eval（安全风险）")
            return "\n".join(out)
        self.stages["lint"] = "pass"
        self.lint_passed = True
        out.append("✅ lint 通过（无安全风险，代码风格达标）")
        out.append("🎉 流水线全绿！可以 deploy 了。")
        return "\n".join(out)

    def _tail_stages_fail(self):
        for s in ("test", "lint"):
            self.stages[s] = "pending"

    def _fix(self, args):
        if not args:
            raise CommandError("fix <文件>：修复文件问题（app.py / test_app.py）")
        f = args[0]
        if f in ("app.py", "src/app.py"):
            self.app_fixed = True
            self.stage_logs["build"] = ["$ npm run build", "> glitch-app@2.3.0 build",
                                        "✅ 构建完成（1.2s）"]
            self.stage_logs["lint"] = ["$ flake8 src/", "✅ 无错误"]
            return f"已修复 {f}：语法错误和 eval 都清掉了。重新跑 pipeline run 验证。"
        if f in ("test_app.py", "tests/test_app.py"):
            self.test_fixed = True
            self.stage_logs["test"] = ["$ pytest -q", "12 passed in 0.4s"]
            return f"已修复 {f}：断言改成 add(1, 2) == 3 了。重新跑 pipeline run 验证。"
        raise CommandError(f"fix: 不知道 {f} 是什么文件（可选 app.py / test_app.py）")

    def _deploy(self, args):
        if len(args) < 2:
            raise CommandError("用法：deploy --blue <版本> 或 deploy --green <版本>")
        flag, tag = args[0], args[1]
        if flag == "--blue":
            self.blue_version = tag
            self.blue_health = "down"
            self.stages["deploy"] = "running"
            return (f"已部署 {tag} 到蓝色环境。\n"
                    "⚠ 健康检查失败：/health 返回 500（新版本有 bug！）\n"
                    "输入 health check 查看详情，或 rollback 回滚。")
        if flag == "--green":
            self.green_version = tag
            self.green_health = "ok"
            self.stages["deploy"] = "pass"
            self.deployed_green = True
            return f"已部署 {tag} 到绿色环境 ✅ 健康检查通过。正式上线成功！"
        raise CommandError("deploy: 只支持 --blue / --green")

    def _health(self):
        return (f"蓝环境：{self.blue_version}  {self.blue_health}\n"
                f"绿环境：{self.green_version or '-'}  {self.green_health}")

    def _test_run(self):
        if self.test_fixed:
            return "$ pytest -q\n12 passed in 0.4s ✅"
        return ("$ pytest -q\n"
                "FAILED test_app.py::test_add\n"
                "E   assert add(1, 2) == 4\n"
                "1 failed, 11 passed ❌")

    def help_text(self, session):
        return T.box([
            "流水线：pipeline status ｜ pipeline run ｜ pipeline logs <build|test|lint> ｜ pipeline retry <阶段>",
            "修复：fix app.py ｜ fix test_app.py（模拟修改代码）",
            "发布：deploy --blue <版本> ｜ deploy --green <版本> ｜ health check ｜ rollback",
            "测试：test run（单独跑单测）",
            "流程：修 build → 修 test → 修 lint → 蓝绿发布",
        ], title="流水线命令手册", color="cyan")

    def solve(self):
        return [
            "pipeline status",
            "pipeline logs build",
            "fix app.py",
            "pipeline run",
            "pipeline logs test",
            "fix test_app.py",
            "pipeline run",
            "deploy --blue v2.3",
            "health check",
            "rollback",
            "deploy --green v2.3",
            "health check",
        ]

    def dashboard(self):
        stmap = {"pass": ("✅ 通过", True), "fail": ("❌ 失败", False),
                 "pending": ("⏳ 待运行", None), "running": ("🔁 运行中", None)}
        stages = [{"label": s, "state": stmap[self.stages[s]][0], "ok": stmap[self.stages[s]][1]}
                  for s in ("build", "test", "lint", "deploy")]
        return {"theme": {"icon": "🚀", "title": "发布控制台", "accent": "#bc8cff"},
                "panels": [
                    {"kind": "status", "title": "流水线阶段", "items": stages},
                    {"kind": "kv", "title": "部署环境", "items": [
                        ["蓝环境", f"{self.blue_version} · {self.blue_health}"],
                        ["绿环境", f"{self.green_version or '-'} · {self.green_health}"]]},
                ]}
