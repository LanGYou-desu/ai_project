"""场景 2：Git 时空冒险 —— 模拟一个迷你 git 仓库，用 git 命令拯救线上事故。

支持：status / log / show / branch / checkout / switch / add / commit /
stash / stash pop / revert / cherry-pick / reset / reflog / diff / merge / edit。
"""

import hashlib
import re
import shlex
from datetime import datetime

from .. import terminal as T
from .base import CommandError, Scenario, Task


class Commit:
    __slots__ = ("h", "msg", "parent", "files")

    def __init__(self, h, msg, parent, files):
        self.h = h
        self.msg = msg
        self.parent = parent
        self.files = files  # path -> content 快照


def make_hash(msg, files, parent):
    seed = msg + "|" + repr(sorted(files.items())) + "|" + str(parent)
    return hashlib.md5(seed.encode("utf-8")).hexdigest()[:8]


class GitRepo:
    def __init__(self):
        self.commits = {}       # hash -> Commit
        self.branches = {}      # name -> hash
        self.head_branch = None
        self.head_hash = None
        self.worktree = {}      # 当前工作区文件
        self.index = {}         # 已暂存 path -> content
        self.stash = []         # 暂存区列表（每个是文件快照 dict）
        self.reflog = []        # (hash, action)

    # ---- 基础 ----
    def head_files(self):
        return dict(self.commits[self.head_hash].files)

    def ancestors(self, h):
        seen = set()
        cur = h
        while cur and cur not in seen:
            seen.add(cur)
            c = self.commits.get(cur)
            cur = c.parent if c else None
        return seen

    def is_dirty(self):
        return self.worktree != self.head_files() or bool(self.index)

    def resolve(self, name):
        if name in self.branches:
            return self.branches[name]
        if name in self.commits:
            return name
        return None

    def new_commit(self, msg, files, parent, branch):
        h = make_hash(msg, files, parent)
        self.commits[h] = Commit(h, msg, parent, dict(files))
        if branch:
            self.branches[branch] = h
        self.head_hash = h
        self.reflog.append((h, f"commit: {msg[:30]}"))
        return h

    # ---- 命令 ----
    def cmd_log(self, all_branches=False, oneline=False):
        if all_branches:
            order = []
            seen = set()
            tips = sorted(self.branches.values())
            for tip in tips:
                cur = tip
                while cur and cur not in seen:
                    seen.add(cur)
                    order.append(cur)
                    c = self.commits[cur]
                    cur = c.parent
            lines = []
            for h in order:
                c = self.commits[h]
                lines.append(f"{h} {c.msg}" if oneline else f"commit {h}\n     {c.msg}")
            return "\n".join(lines)
        lines = []
        cur = self.head_hash
        while cur:
            c = self.commits[cur]
            lines.append(f"{c.h} {c.msg}" if oneline else f"commit {c.h}\n     {c.msg}")
            cur = c.parent
        return "\n".join(lines)

    def cmd_show(self, h):
        c = self.commits.get(h)
        if c is None:
            raise CommandError(f"git: 提交 {h} 不存在")
        parent = self.commits.get(c.parent) if c.parent else None
        out = [f"commit {c.h}", f"Author: dev <dev@glitchworks.com>", f"Date:   2025-01-15", "",
               f"    {c.msg}", ""]
        if parent is None:
            out.append("（初始提交，全部文件新增）")
            for p in sorted(c.files):
                out.append(f"  A  {p}")
        else:
            for p in sorted(set(c.files) | set(parent.files)):
                a = c.files.get(p)
                b = parent.files.get(p)
                if a != b:
                    if a is None:
                        out.append(f"  D  {p}")
                    elif b is None:
                        out.append(f"  A  {p}")
                    else:
                        out.append(f"  M  {p}")
        return "\n".join(out)

    def cmd_status(self):
        head = self.head_files()
        out = [f"位于分支 {self.head_branch}" if self.head_branch else f"HEAD 游离于 {self.head_hash}"]
        # 暂存区
        if self.index:
            out.append("")
            out.append("要提交的变更：")
            for p in sorted(self.index):
                if p in head:
                    out.append(f"        修改：{p}")
                else:
                    out.append(f"        新文件：{p}")
        # 未暂存
        unstaged = []
        for p in sorted(set(self.worktree) | set(head)):
            a = self.worktree.get(p)
            b = head.get(p)
            if a != b and p not in self.index:
                if a is None:
                    unstaged.append(f"        删除：{p}")
                elif b is None:
                    unstaged.append(f"        未跟踪：{p}")
                else:
                    unstaged.append(f"        修改：{p}")
        if unstaged:
            out.append("")
            out.append("未暂存的变更：")
            out.extend(unstaged)
        if not self.index and not unstaged:
            out.append("工作区干净，没什么可提交的")
        return "\n".join(out)

    def cmd_add(self, paths):
        head = self.head_files()
        for p in paths:
            if p not in self.worktree:
                raise CommandError(f"git: '{p}' 不存在")
            if self.worktree.get(p) == head.get(p):
                self.index.pop(p, None)
            else:
                self.index[p] = self.worktree[p]

    def cmd_commit(self, msg):
        if not msg:
            raise CommandError("git: 提交信息不能为空（git commit -m \"信息\"）")
        if not self.index:
            raise CommandError("git: 没有暂存的更改。先用 git add <文件>。")
        files = self.head_files()
        files.update(self.index)
        self.new_commit(msg, files, self.head_hash, self.head_branch)
        self.index = {}
        self.worktree = files

    def cmd_checkout(self, target):
        h = self.resolve(target)
        if h is None:
            raise CommandError(f"git: 分支或提交 '{target}' 不存在")
        if self.is_dirty() and h != self.head_hash:
            raise CommandError("git: 有未提交的改动，切换会丢失！先 git stash 暂存，再切换。")
        if target in self.branches:
            self.head_branch = target
        else:
            self.head_branch = None
        self.head_hash = h
        self.worktree = self.head_files()

    def cmd_stash(self):
        head = self.head_files()
        changes = {p: c for p, c in self.worktree.items() if head.get(p) != c}
        if not changes:
            raise CommandError("git: 没有可暂存的改动")
        self.stash.append(changes)
        self.worktree = head

    def cmd_stash_pop(self):
        if not self.stash:
            raise CommandError("git: stash 是空的")
        changes = self.stash.pop()
        self.worktree.update(changes)

    def cmd_revert(self, h):
        c = self.commits.get(h)
        if c is None:
            raise CommandError(f"git: 提交 {h} 不存在")
        parent = self.commits.get(c.parent) if c.parent else None
        files = self.worktree
        for p, content in c.files.items():
            old = parent.files.get(p) if parent else None
            if old is None:
                files.pop(p, None)   # 该提交新增的文件 → 删掉
            else:
                files[p] = old       # 该提交改动的文件 → 还原
        self.new_commit(f"Revert \"{c.msg}\"", files, self.head_hash, self.head_branch)

    def cmd_cherry_pick(self, h):
        c = self.commits.get(h)
        if c is None:
            raise CommandError(f"git: 提交 {h} 不存在")
        parent = self.commits.get(c.parent) if c.parent else None
        files = dict(self.worktree)
        parent_files = parent.files if parent else {}
        for p in parent_files:
            if p not in c.files:
                files.pop(p, None)
        for p, content in c.files.items():
            files[p] = content
        self.new_commit(f"cherry-pick: {c.msg}", files, self.head_hash, self.head_branch)

    def cmd_reset(self, h, hard):
        target = self.resolve(h)
        if target is None:
            raise CommandError(f"git: 找不到 {h}")
        old = self.head_hash
        self.branches[self.head_branch] = target if self.head_branch else None
        self.head_hash = target
        if hard:
            self.worktree = self.head_files()
            self.index = {}
        self.reflog.append((old, f"reset: moved to {target}"))

    def cmd_reflog(self):
        lines = []
        for h, action in self.reflog:
            lines.append(f"{h} HEAD@{{ {len(lines)} }}: {action}")
        return "\n".join(lines) if lines else "（reflog 为空）"

    def cmd_diff(self):
        head = self.head_files()
        lines = []
        for p in sorted(set(self.worktree) | set(head)):
            a = self.worktree.get(p)
            b = head.get(p)
            if a == b:
                continue
            lines.append(f"diff --git a/{p} b/{p}")
            if b is None:
                lines.append(f"新增文件 {p}")
            elif a is None:
                lines.append(f"删除文件 {p}")
            else:
                for ln in b.splitlines():
                    lines.append(f"- {ln}")
                for ln in a.splitlines():
                    lines.append(f"+ {ln}")
        return "\n".join(lines) if lines else "（没有差异）"

    def cmd_merge(self, branch):
        if branch not in self.branches:
            raise CommandError(f"git: 分支 '{branch}' 不存在")
        tip = self.branches[branch]
        head_anc = self.ancestors(self.head_hash)
        if tip in head_anc:
            return "Already up to date."
        if self.head_hash in self.ancestors(tip):
            # fast-forward
            self.branches[self.head_branch] = tip
            self.head_hash = tip
            self.worktree = self.head_files()
            self.reflog.append((self.head_hash, f"merge {branch} (fast-forward)"))
            return f"已快进合并：{branch} → {self.head_branch}"
        # 简单三方合并：按时间顺序应用分支上独有的提交
        merged = self.head_files()
        applied = []
        cur = tip
        while cur and cur not in head_anc:
            applied.append(cur)
            c = self.commits[cur]
            parent = self.commits.get(c.parent) if c.parent else None
            parent_files = parent.files if parent else {}
            for p in parent_files:
                if p not in c.files:
                    merged.pop(p, None)
            for p, content in c.files.items():
                merged[p] = content
            cur = c.parent
        applied.reverse()
        msg = f"Merge branch '{branch}' into {self.head_branch}"
        self.new_commit(msg, merged, self.head_hash, self.head_branch)
        self.worktree = merged
        self.reflog.append((self.head_hash, f"merge {branch}"))
        return f"合并完成：{msg}"


class GitQuest(Scenario):
    id = "git_quest"
    name = "Git 时空冒险"
    tagline = "昨天的提交把线上搞崩了，老板说：用 git 时间机器把事故救回来。\n历史就在那里，只是你还没学会怎么倒带。"
    env = "git（模拟仓库）"
    difficulty = 2
    xp_bonus = 120

    def setup(self):
        self.repo = GitRepo()
        self.ran = set()
        self._build_repo()
        self.state.update({"reverted": False, "cherry": False,
                           "merged": False, "stashed": False, "popped": False})
        self.tasks = [
            Task("g1", "查看提交历史",
                 "先看看最近发生了什么。用 git log 查看提交历史。",
                 check=lambda s, c: any("git log" in x for x in s.scenario.ran),
                 hints=("git log --oneline",), lesson="git_log"),
            Task("g2", "揪出引入 Bug 的提交",
                 "提交信息里有一条写着“✨ 优化性能：缓存加速接口”——就是它把线上搞崩的。\n输入那一次提交的 8 位哈希。",
                 check=lambda s, c: c.strip().lower() == "f0e9d8c7",
                 hints=("先 git log --oneline 看哈希，用 git show <哈希> 确认改动",),
                 lesson="git_log", answer="f0e9d8c7"),
            Task("g3", "安全回滚",
                 "用 git revert 撤销那个坏提交——注意不要破坏历史。",
                 check=lambda s, c: s.scenario.state.get("reverted"),
                 hints=("git revert f0e9d8c7",), lesson="git_revert"),
            Task("g4", "找回被误删的提交",
                 "阿强手滑 reset --hard 丢了一个提交，新功能“报表导出页面”没了！\n用 reflog 找到它（7d6e5f4a），再 cherry-pick 回来。",
                 check=lambda s, c: s.scenario.state.get("cherry"),
                 hints=("git reflog", "git cherry-pick 7d6e5f4a"), lesson="git_reflog"),
            Task("g5", "合并功能分支",
                 "报表功能在 feature 分支上开发完了，把它合并进当前分支。",
                 check=lambda s, c: s.scenario.state.get("merged"),
                 hints=("git merge feature",), lesson="git_log"),
            Task("g6", "暂存你的改动",
                 "你改到一半被叫去开会。先把 README.md 的改动藏起来：\n先用 edit README.md 模拟改文件，再 git stash。",
                 check=lambda s, c: s.scenario.state.get("stashed"),
                 hints=("edit README.md", "git stash"), lesson="git_stash"),
            Task("g7", "恢复暂存",
                 "会开完了。切到 feature 看看，再切回来，把改动恢复：git stash pop。",
                 check=lambda s, c: s.scenario.state.get("popped"),
                 hints=("git checkout feature", "git checkout main", "git stash pop"),
                 lesson="git_stash"),
        ]

    def _build_repo(self):
        r = self.repo
        f_init = {"app.py": "print('glitch app v1')\n", "README.md": "# glitch app\n"}
        f_pay = {**f_init, "payment.py": "def pay(amount):\n    return amount\n"}
        f_bug = {**f_pay, "app.py": "from cache import CACHE\nprint('glitch app v1')\n"}
        f_css = {**f_bug, "README.md": "# glitch app\n\n## 登录页 CSS 已修复\n"}
        f_feat = {**f_init, "report.py": "def gen_report():\n    return 'report'\n"}
        f_lost = {**f_feat, "report_ui.html": "<h1>报表导出</h1>\n"}

        r.commits["9e8f7a6b"] = Commit("9e8f7a6b", "🎉 初始化项目", None, f_init)
        r.commits["5a4b3c2d"] = Commit("5a4b3c2d", "🐛 修复支付金额计算", "9e8f7a6b", f_pay)
        r.commits["f0e9d8c7"] = Commit("f0e9d8c7", "✨ 优化性能：缓存加速接口", "5a4b3c2d", f_bug)
        r.commits["a1b2c3d4"] = Commit("a1b2c3d4", "🔥 修复登录页 CSS", "f0e9d8c7", f_css)
        r.commits["2b3c4d5e"] = Commit("2b3c4d5e", "✨ 新增导出报表功能", "9e8f7a6b", f_feat)
        r.commits["7d6e5f4a"] = Commit("7d6e5f4a", "🚀 新增报表导出页面", "2b3c4d5e", f_lost)

        r.branches["main"] = "a1b2c3d4"
        r.branches["feature"] = "2b3c4d5e"
        r.head_branch = "main"
        r.head_hash = "a1b2c3d4"
        r.worktree = dict(f_css)
        r.reflog = [
            ("a1b2c3d4", "commit: 🔥 修复登录页 CSS"),
            ("7d6e5f4a", "commit: 🚀 新增报表导出页面 (后已被 reset 丢弃)"),
            ("2b3c4d5e", "commit: ✨ 新增导出报表功能"),
            ("9e8f7a6b", "commit (initial): 🎉 初始化项目"),
        ]

    # ---------------- 命令 ----------------
    def handle(self, cmd, session):
        self.ran.add(cmd)
        tokens = shlex.split(cmd) if cmd.strip() else []
        if not tokens:
            raise CommandError("输入为空")
        if tokens[0].lower() != "git":
            if tokens[0].lower() == "edit":
                return self._cmd_edit(tokens[1:])
            raise CommandError(f"{tokens[0]}: 未找到命令。这是 git 环境，试试 git status")
        args = tokens[1:]
        if not args:
            raise CommandError("git: 需要子命令。git status / git log ...")
        sub = args[0]
        rest = args[1:]
        r = self.repo
        try:
            if sub == "status":
                return r.cmd_status()
            if sub == "log":
                oneline = "--oneline" in rest
                allb = "--all" in rest
                return r.cmd_log(all_branches=allb, oneline=oneline)
            if sub == "show":
                if not rest:
                    raise CommandError("git show <提交哈希>")
                return r.cmd_show(rest[0])
            if sub == "branch":
                lines = []
                for name in sorted(r.branches):
                    mark = "*" if name == r.head_branch else " "
                    lines.append(f"{mark} {name}")
                return "\n".join(lines)
            if sub in ("checkout", "switch"):
                if not rest:
                    raise CommandError(f"git {sub} <分支或提交>")
                target = rest[0]
                r.cmd_checkout(target)
                return f"已切换到 {target}"
            if sub == "add":
                if not rest:
                    raise CommandError("git add <文件>")
                r.cmd_add(rest)
                return "已暂存：" + " ".join(rest)
            if sub == "commit":
                msg = self._extract_msg(rest)
                r.cmd_commit(msg)
                return "提交成功！新提交：" + r.head_hash
            if sub == "stash":
                if rest and rest[0] == "pop":
                    r.cmd_stash_pop()
                    self.state["popped"] = True
                    return "已恢复暂存的改动"
                if rest and rest[0] == "list":
                    return "\n".join(f"stash@{i}: {len(c)} 个文件" for i, c in enumerate(r.stash)) or "（无 stash）"
                r.cmd_stash()
                self.state["stashed"] = True
                return "工作区已暂存，现在干净了。"
            if sub == "revert":
                if not rest:
                    raise CommandError("git revert <提交哈希>")
                r.cmd_revert(rest[0])
                if rest[0] == "f0e9d8c7":
                    self.state["reverted"] = True
                return "已生成反向提交：Revert " + rest[0]
            if sub == "cherry-pick":
                if not rest:
                    raise CommandError("git cherry-pick <提交哈希>")
                r.cmd_cherry_pick(rest[0])
                if rest[0] == "7d6e5f4a":
                    self.state["cherry"] = True
                return "已把提交捡到当前分支：" + rest[0]
            if sub == "reset":
                hard = "--hard" in rest
                soft = "--soft" in rest
                target = [x for x in rest if not x.startswith("-")]
                if not target:
                    raise CommandError("git reset [--hard|--soft] <提交>")
                r.cmd_reset(target[0], hard or not soft)
                return "已重置到 " + target[0]
            if sub == "reflog":
                return r.cmd_reflog()
            if sub == "diff":
                return r.cmd_diff()
            if sub == "merge":
                if not rest:
                    raise CommandError("git merge <分支>")
                out = r.cmd_merge(rest[0])
                if rest[0] == "feature":
                    self.state["merged"] = True
                return out
            raise CommandError(f"git {sub}: 未知子命令（本环境支持 status/log/show/branch/checkout/switch/add/commit/stash/revert/cherry-pick/reset/reflog/diff/merge）")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"git: 出错：{exc}")

    def _extract_msg(self, rest):
        if "-m" in rest:
            i = rest.index("-m")
            if i + 1 < len(rest):
                return rest[i + 1]
        if rest:
            return " ".join(rest)
        return ""

    def _cmd_edit(self, args):
        if not args:
            raise CommandError("edit <文件>：模拟修改文件")
        path = args[0]
        cur = self.repo.worktree.get(path)
        stamp = datetime.now().strftime("%H:%M:%S")
        if cur is None:
            self.repo.worktree[path] = "# 新建文件（未跟踪）\n"
            return f"已创建并编辑 {path}"
        self.repo.worktree[path] = cur + f"# {stamp} 我改了一行\n"
        return f"已编辑 {path}（工作区有改动）"

    def help_text(self, session):
        return T.box([
            "查看：git status ｜ git log [--oneline] [--all] ｜ git show <哈希> ｜ git branch ｜ git diff ｜ git reflog",
            "切换：git checkout/switch <分支|哈希>",
            "提交：git add <文件> ｜ git commit -m \"信息\"",
            "后悔：git revert <哈希> ｜ git cherry-pick <哈希> ｜ git reset [--hard] <哈希>",
            "应急：git stash ｜ git stash pop ｜ git stash list ｜ git merge <分支>",
            "其他：edit <文件>（模拟修改文件，制造未提交改动）",
        ], title="Git 命令手册", color="cyan")

    def solve(self):
        return [
            "git log --oneline",
            "f0e9d8c7",
            "git revert f0e9d8c7",
            "git reflog",
            "git cherry-pick 7d6e5f4a",
            "git merge feature",
            "edit README.md",
            "git stash",
            "git checkout feature",
            "git checkout main",
            "git stash pop",
        ]

    def dashboard(self):
        r = self.repo
        log_rows = []
        cur = r.head_hash
        for _ in range(5):
            if not cur:
                break
            c = r.commits[cur]
            log_rows.append([c.h, c.msg[:24]])
            cur = c.parent
        branch_rows = [[("●" if n == r.head_branch else "○") + " " + n,
                        r.commits[r.branches[n]].msg[:20]]
                       for n in sorted(r.branches)]
        return {"theme": {"icon": "🔀", "title": "Git 工作台", "accent": "#f0883e"},
                "panels": [
                    {"kind": "kv", "title": "仓库状态", "items": [
                        ["当前分支", r.head_branch or "（游离 HEAD）"],
                        ["HEAD", r.head_hash],
                        ["工作区", "有未提交改动" if r.is_dirty() else "干净"],
                        ["stash", f"{len(r.stash)} 条"]]},
                    {"kind": "table", "title": "提交历史", "headers": ["哈希", "信息"], "rows": log_rows},
                    {"kind": "table", "title": "分支", "headers": ["分支", "最新提交"], "rows": branch_rows},
                ]}
