"""场景 1：终端老兵 —— 模拟一个 Linux 文件系统，用真实 shell 命令排障。

支持：ls / cd / pwd / cat / head / tail / grep / find / wc / echo（重定向）/
mkdir / touch / rm / mv / cp / chmod / whoami / date / tree，以及简单管道和脚本执行。
"""

import fnmatch
import re
import shlex

from .. import terminal as T
from .base import CommandError, Scenario, Task


class Node:
    __slots__ = ("kind", "content", "mode")

    def __init__(self, kind, content="", mode="644"):
        self.kind = kind      # "dir" | "file"
        self.content = content
        self.mode = mode      # 例如 "644" / "755"


class VFS:
    def __init__(self):
        self.nodes = {}       # 绝对路径 -> Node
        self.cwd = "/"

    def norm(self, path):
        if not path.startswith("/"):
            path = path.rstrip("/")
            base = self.cwd if self.cwd != "/" else ""
            path = base + "/" + path if path else self.cwd
        parts = []
        for seg in path.split("/"):
            if seg in ("", "."):
                continue
            if seg == "..":
                if parts:
                    parts.pop()
            else:
                parts.append(seg)
        return "/" + "/".join(parts)

    def get(self, path):
        return self.nodes.get(self.norm(path))

    def exists(self, path):
        return self.norm(path) in self.nodes

    def mkdir(self, path, mode="755"):
        self.nodes[self.norm(path)] = Node("dir", mode=mode)

    def touch(self, path, content="", mode="644"):
        p = self.norm(path)
        if p not in self.nodes:
            self.nodes[p] = Node("file", content, mode)
        return p

    def add(self, path, node):
        self.nodes[self.norm(path)] = node

    def ls(self, path="/"):
        base = self.norm(path)
        prefix = base.rstrip("/") + "/"
        out = []
        for p in self.nodes:
            if p.startswith(prefix):
                rest = p[len(prefix):]
                if rest and "/" not in rest:
                    out.append(rest)
        return sorted(out)

    def parent(self, path):
        p = self.norm(path).rstrip("/")
        if "/" not in p:
            return "/"
        return p[: p.rfind("/")] or "/"

    def walk(self, path="/"):
        base = self.norm(path)
        prefix = base.rstrip("/") + "/"
        for p in sorted(self.nodes):
            if p == base or p.startswith(prefix):
                yield p


def _mode_str(mode, kind):
    if kind == "dir":
        base = "d"
    else:
        base = "-"
    bits = [int(c) for c in mode[:3]]
    mapping = [(4, "r"), (2, "w"), (1, "x")]
    for b in bits:
        for val, ch in mapping:
            base += ch if b & val else "-"
    return base


class TerminalMaster(Scenario):
    id = "terminal_master"
    name = "终端老兵"
    tagline = "凌晨 2 点，老板甩来一台老服务器：日志乱、配置丢、脚本没权限。\n用 Linux 命令把它收拾干净——这是每个程序员的成人礼。"
    env = "linux-shell（模拟）"
    difficulty = 1
    xp_bonus = 100

    def setup(self):
        self.fs = VFS()
        self.read_files = set()
        self.ran_commands = set()
        self._build_fs()
        self.state["chmod_deploy"] = False
        self.state["deployed"] = False
        self.state["grep500"] = False
        self.state["pycount"] = False
        self._tail20 = self.access_log[-20:]
        self.tasks = [
            Task("t1", "找到并查看配置文件",
                 "系统报错说找不到 /opt/app/config.ini，但配置文件明明在服务器上。\n先全盘找出来，再查看它的内容。（提示：先 find 再 cat）",
                 check=lambda s, c: any("config.ini" in p for p in s.scenario.read_files),
                 hints=("find / -name config.ini", "cat <找到的路径>"),
                 lesson="find", answer="find / -name config.ini → cat /opt/app/config.ini"),
            Task("t2", "统计 500 错误次数",
                 "老板要一份事故报告：access.log 里到底有多少条 500 错误？\n用一条命令数出来。（提示：grep -c）",
                 check=lambda s, c: bool(re.search(r"grep\s*-c.*500.*access\.log", c.lower())),
                 hints=('grep -c " 500 " /opt/app/logs/access.log',),
                 lesson="grep", answer='grep -c " 500 " /opt/app/logs/access.log'),
            Task("t3", "导出访问日志摘要",
                 "把 access.log 的【最后 20 行】保存到 /opt/app/report.txt，作为今晚的排查记录。\n（提示：tail -n 20 ... > 目标文件）",
                 check=self._check_report,
                 hints=("tail -n 20 /opt/app/logs/access.log > /opt/app/report.txt",),
                 lesson="redirect", answer="tail -n 20 /opt/app/logs/access.log > /opt/app/report.txt"),
            Task("t4", "让部署脚本跑起来",
                 "deploy.sh 写好了但跑不起来——权限不对。给它加上执行权限，然后运行它。\n（提示：chmod +x，然后 ./deploy.sh）",
                 check=lambda s, c: s.scenario.state.get("chmod_deploy") and s.scenario.state.get("deployed"),
                 hints=("chmod +x /opt/app/deploy.sh", "/opt/app/deploy.sh"),
                 lesson="chmod", answer="chmod +x /opt/app/deploy.sh && /opt/app/deploy.sh"),
            Task("t5", "归档错误日志",
                 "error.log 已经没用了，把它移动到 logs/ 目录下并改名为 error_2025.log。\n（提示：mv 原路径 新路径）",
                 check=self._check_moved,
                 hints=("mv /opt/app/logs/error.log /opt/app/logs/error_2025.log",),
                 lesson="redirect", answer="mv /opt/app/logs/error.log /opt/app/logs/error_2025.log"),
            Task("t6", "统计 Python 文件数量",
                 "新来的实习生说项目里有很多 .py 文件，到底是几个？统计出来。\n（提示：find 找 *.py，管道给 wc -l）",
                 check=lambda s, c: bool(re.search(
                     r"find\b.*-name\s+[\"']?\*?\.py[\"']?\s*\|\s*wc\s*-l", c.lower())),
                 hints=('find /opt/app -name "*.py" | wc -l',),
                 lesson="find", answer='find /opt/app -name "*.py" | wc -l'),
        ]

    # ---------------- 文件系统构造 ----------------
    def _build_fs(self):
        fs = self.fs
        fs.add("/", Node("dir", mode="755"))
        for d in ["/home", "/home/dev", "/opt", "/opt/app", "/opt/app/src",
                  "/opt/app/logs", "/var", "/var/log", "/etc"]:
            fs.mkdir(d)
        fs.add("/home/dev/notes.txt", Node("file", "明天记得修 payment bug！\n", "644"))
        fs.add("/home/dev/todo.md", Node("file", "- [ ] 写周报\n- [ ] 修线上 500\n- [ ] 请假\n", "644"))
        fs.add("/opt/app/config.ini", Node("file",
            "[server]\nport=8080\nhost=0.0.0.0\n\n[db]\nurl=mysql://glitch:****@10.0.0.5/glitchdb\n", "644"))
        fs.add("/opt/app/deploy.sh", Node("file",
            "#!/bin/sh\n"
            "echo \"开始部署 v2.3 ...\"\n"
            "echo \"编译前端... 完成\"\n"
            "echo \"重启后端服务... 完成\"\n"
            "touch /var/log/deploy_ok.txt\n"
            "echo \"部署成功！新版本已上线 🎉\"\n", "644"))
        fs.add("/opt/app/src/main.py", Node("file", "def main():\n    print('hello glitch')\n", "644"))
        fs.add("/opt/app/src/utils.py", Node("file", "import math\n", "644"))
        fs.add("/opt/app/src/db.py", Node("file", "import sqlite3\n", "644"))
        self.access_log = [
            "2025-01-15 00:01:12 203.0.113.10 GET /api/users 200 42ms",
            "2025-01-15 00:03:44 198.51.100.7 GET / 200 11ms",
            "2025-01-15 00:05:01 203.0.113.10 GET /api/orders 500 999ms",
            "2025-01-15 00:07:33 192.0.2.15 GET /api/login 200 23ms",
            "2025-01-15 00:09:21 198.51.100.7 POST /api/orders 500 1200ms",
            "2025-01-15 00:12:05 203.0.113.10 GET /static/app.js 200 8ms",
            "2025-01-15 00:15:48 192.0.2.15 GET /api/users 200 39ms",
            "2025-01-15 00:18:22 203.0.113.10 GET /api/reports 500 2001ms",
            "2025-01-15 00:20:56 198.51.100.7 GET /api/users 200 41ms",
            "2025-01-15 00:23:10 192.0.2.15 GET / 200 12ms",
            "2025-01-15 00:26:44 203.0.113.10 GET /api/orders 500 800ms",
            "2025-01-15 00:29:01 198.51.100.7 GET /static/app.js 200 9ms",
            "2025-01-15 00:31:37 192.0.2.15 GET /api/login 200 21ms",
            "2025-01-15 00:34:20 203.0.113.10 GET /api/users 200 44ms",
            "2025-01-15 00:37:52 198.51.100.7 POST /api/reports 500 3005ms",
            "2025-01-15 00:40:11 192.0.2.15 GET / 200 10ms",
            "2025-01-15 00:43:29 203.0.113.10 GET /api/users 200 37ms",
            "2025-01-15 00:46:58 198.51.100.7 GET /api/orders 200 56ms",
            "2025-01-15 00:49:33 192.0.2.15 GET /static/app.js 200 7ms",
            "2025-01-15 00:52:06 203.0.113.10 GET /api/login 200 19ms",
            "2025-01-15 00:55:44 198.51.100.7 GET / 200 13ms",
            "2025-01-15 00:58:12 192.0.2.15 GET /api/users 200 40ms",
            "2025-01-15 01:01:55 203.0.113.10 GET /api/orders 200 52ms",
            "2025-01-15 01:04:30 198.51.100.7 GET /api/reports 200 66ms",
            "2025-01-15 01:07:08 192.0.2.15 GET /static/app.js 200 8ms",
            "2025-01-15 01:09:47 203.0.113.10 GET / 200 11ms",
            "2025-01-15 01:12:29 198.51.100.7 GET /api/login 200 18ms",
            "2025-01-15 01:15:03 192.0.2.15 GET /api/users 200 43ms",
            "2025-01-15 01:17:41 203.0.113.10 GET /api/orders 200 49ms",
            "2025-01-15 01:20:16 198.51.100.7 GET / 200 12ms",
        ]
        fs.add("/opt/app/logs/access.log", Node("file", "\n".join(self.access_log) + "\n", "644"))
        fs.add("/opt/app/logs/error.log", Node("file",
            "2025-01-15 00:05:01 [ERROR] TimeoutError: read timed out\n"
            "2025-01-15 00:09:21 [ERROR] ConnectionError: upstream closed\n"
            "2025-01-15 00:18:22 [ERROR] OOM: Java heap space\n"
            "2025-01-15 00:26:44 [ERROR] 500: Internal Server Error\n"
            "2025-01-15 00:37:52 [ERROR] WorkerTimeout: gevent 30s\n", "644"))
        fs.add("/var/log/syslog", Node("file",
            "Jan 15 00:00:01 glitch kernel: [0.000000] Boot\n"
            "Jan 15 01:00:00 glitch crond: cron started\n", "644"))
        fs.add("/etc/nginx.conf", Node("file",
            "server {\n    listen 80;\n    location / { proxy_pass http://127.0.0.1:8080; }\n}\n", "644"))

    # ---------------- 任务检查 ----------------
    def _check_report(self, session, cmd):
        node = self.fs.get("/opt/app/report.txt")
        if node is None or node.kind != "file":
            return False
        expected = "\n".join(self._tail20)
        return node.content == expected

    def _check_moved(self, session, cmd):
        return (self.fs.exists("/opt/app/logs/error_2025.log")
                and not self.fs.exists("/opt/app/logs/error.log"))

    # ---------------- 命令处理 ----------------
    def _resolve(self, path):
        p = self.fs.norm(path)
        if not self.fs.exists(p):
            raise CommandError(f"ls: 无法访问 '{path}': 没有那个文件或目录")
        return p

    def handle(self, cmd, session):
        tokens = shlex.split(cmd) if cmd.strip() else []
        if not tokens:
            raise CommandError("输入为空。输入 help 查看可用命令。")

        # 管道：只支持单级管道（find/grep 输出 -> wc/grep）
        if "|" in tokens:
            i = tokens.index("|")
            left, right = tokens[:i], tokens[i + 1:]
            if not right:
                raise CommandError("管道右边没有命令")
            out = self._exec(left, session, capture=True)
            return self._pipe_out(out, right)

        # 重定向：echo / cat / tail ... > file
        for op in (">>", ">"):
            if op in tokens:
                i = tokens.index(op)
                if i + 1 >= len(tokens):
                    raise CommandError(f"'{op}' 后面需要文件名")
                target = self._resolve_parent(tokens[i + 1])
                out = self._exec(tokens[:i], session, capture=True)
                self._write_file(target, out, append=(op == ">>"))
                self.ran_commands.add(cmd)
                return f"已写入 {target}（{len(out)} 字节）"

        return self._exec(tokens, session, capture=False)

    def _resolve_parent(self, path):
        p = self.fs.norm(path)
        parent = self.fs.parent(p)
        if not self.fs.exists(parent):
            raise CommandError(f"无法写入 '{path}': 目录 {parent} 不存在")
        return p

    def _write_file(self, path, content, append=False):
        node = self.fs.get(path)
        if node is None:
            self.fs.add(path, Node("file", content, "644"))
        elif node.kind == "dir":
            raise CommandError(f"'{path}' 是一个目录")
        else:
            node.content = (node.content + content) if append else content

    def _exec(self, tokens, session, capture=False):
        """执行 token 列表，返回输出文本；capture=True 时不打印。"""
        if not tokens:
            raise CommandError("空命令")
        cmd0 = tokens[0]
        out_parts = []

        def emit(text):
            if capture:
                out_parts.append(str(text))
            else:
                out_parts.append(str(text))

        # 脚本执行：./xxx 或 /path/script
        if cmd0.startswith("./") or cmd0.startswith("/"):
            self._run_script(cmd0, emit)
            self.ran_commands.add(" ".join(tokens))
            return "\n".join(out_parts)

        c = cmd0.lower()
        try:
            if c == "help":
                emit(self.help_text(session))
            elif c == "clear":
                return "\x1b[2J\x1b[H"
            elif c in ("pwd",):
                emit(self.fs.cwd)
            elif c in ("whoami",):
                emit("dev")
            elif c in ("hostname",):
                emit("glitchworks")
            elif c in ("date",):
                emit("2025年01月15日 星期三 02:47:36 CST")
            elif c == "ls":
                emit(self._cmd_ls(tokens[1:]))
            elif c == "cd":
                if len(tokens) < 2:
                    self.fs.cwd = "/"
                else:
                    target = tokens[1]
                    if target == "-":
                        target = getattr(self, "_last_cwd", "/")
                    p = self.fs.norm(target)
                    node = self.fs.get(p)
                    if node is None or node.kind != "dir":
                        raise CommandError(f"cd: 无法进入 '{target}': 不是目录或不存在")
                    self._last_cwd = self.fs.cwd
                    self.fs.cwd = p
            elif c == "cat":
                if len(tokens) < 2:
                    raise CommandError("用法：cat <文件>")
                p = self._resolve(tokens[1])
                node = self.fs.get(p)
                if node.kind == "dir":
                    raise CommandError(f"cat: {tokens[1]}: 是一个目录")
                self.read_files.add(p)
                emit(node.content.rstrip("\n") or "（空文件）")
            elif c in ("head", "tail"):
                emit(self._cmd_head_tail(c, tokens[1:]))
            elif c == "grep":
                emit(self._cmd_grep(tokens[1:], session))
            elif c == "find":
                emit(self._cmd_find(tokens[1:]))
            elif c == "wc":
                emit(self._cmd_wc(tokens[1:]))
            elif c == "echo":
                text = " ".join(tokens[1:])
                emit(text)
            elif c == "mkdir":
                for t in tokens[1:]:
                    self.fs.mkdir(t)
                emit("")
            elif c == "touch":
                for t in tokens[1:]:
                    self.fs.touch(t)
                emit("")
            elif c == "rm":
                self._cmd_rm(tokens[1:])
                emit("")
            elif c == "mv":
                self._cmd_mv(tokens[1:])
                emit("")
            elif c == "cp":
                self._cmd_cp(tokens[1:])
                emit("")
            elif c == "chmod":
                self._cmd_chmod(tokens[1:], session)
                emit("")
            elif c == "tree":
                emit(self._cmd_tree(tokens[1:] if len(tokens) > 1 else ["."]))
            elif c == "su":
                emit("权限拒绝：su 需要 root 密码，但你是实习生。")
            elif c in ("vim", "nano", "vi"):
                emit(f"{c}: 你想得美，这里是模拟终端。用 echo > 文件 来写东西吧。")
            else:
                raise CommandError(f"{cmd0}: 未找到命令。输入 help 查看可用命令。")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"{cmd0}: 出错：{exc}")
        self.ran_commands.add(" ".join(tokens))
        return "\n".join(out_parts)

    def _cmd_ls(self, args):
        path = args[-1] if args and not args[0].startswith("-") else "."
        long = "-l" in args
        p = self._resolve(path)
        node = self.fs.get(p)
        if node.kind == "file":
            return p
        names = self.fs.ls(p)
        if not long:
            return "  ".join(names) if names else "（空目录）"
        lines = ["总计 " + str(len(names))]
        for n in names:
            child = self.fs.get(self.fs.norm(p + "/" + n))
            size = len(child.content) if child.kind == "file" else 4096
            lines.append(f"{_mode_str(child.mode, child.kind)}  1 dev dev {size:>6} 2025-01-15 02:00 {n}")
        return "\n".join(lines)

    def _cmd_head_tail(self, which, args):
        n = 10
        rest = list(args)
        if rest and rest[0] == "-n":
            if len(rest) < 2 or not rest[1].isdigit():
                raise CommandError(f"{which}: -n 需要数字参数")
            n = int(rest[1])
            rest = rest[2:]
        elif rest and rest[0].startswith("-") and rest[0][1:].isdigit():
            n = int(rest[0][1:])
            rest = rest[1:]
        if not rest:
            raise CommandError(f"用法：{which} -n <行数> <文件>")
        p = self._resolve(rest[0])
        node = self.fs.get(p)
        if node.kind == "dir":
            raise CommandError(f"{which}: {rest[0]}: 是一个目录")
        lines = node.content.splitlines()
        if which == "head":
            return "\n".join(lines[:n])
        return "\n".join(lines[-n:])

    def _cmd_grep(self, args, session):
        count_only = False
        recursive = False
        while args and args[0].startswith("-"):
            opt = args.pop(0)
            if "-c" in opt:
                count_only = True
            if "-r" in opt or "-R" in opt:
                recursive = True
            elif opt not in ("-c", "-i", "-n", "-v"):
                raise CommandError(f"grep: 不支持的选项 {opt}")
        if not args:
            raise CommandError("用法：grep [-c] [-r] <模式> <文件|目录>")
        pattern = args[0]
        target = args[1] if len(args) > 1 else None
        if target is None:
            raise CommandError("grep: 请指定要搜索的文件")
        try:
            rx = re.compile(pattern)
        except re.error as exc:
            raise CommandError(f"grep: 正则错误：{exc}")

        files = []
        if recursive:
            p = self._resolve(target)
            for path in self.fs.walk(p):
                node = self.fs.get(path)
                if node.kind == "file":
                    files.append((path, node))
        else:
            p = self._resolve(target)
            node = self.fs.get(p)
            if node.kind == "dir":
                raise CommandError("grep: 目标是个目录，加 -r 试试")
            files.append((p, node))

        total = 0
        lines_out = []
        for path, node in files:
            hits = [ln for ln in node.content.splitlines() if rx.search(ln)]
            if count_only:
                total += len(hits)
            else:
                for ln in hits:
                    lines_out.append((f"{path}:" if recursive else "") + ln)
        if count_only:
            if session is not None and pattern == " 500 " and "access.log" in target:
                session.scenario.state["grep500"] = True
            return str(total)
        return "\n".join(lines_out) if lines_out else "（没有匹配的行）"

    def _cmd_find(self, args):
        if "-name" not in args:
            raise CommandError("用法：find <路径> -name <模式>，例如 find / -name \"*.py\"")
        i = args.index("-name")
        path = args[0] if i > 0 else "."
        pattern = args[i + 1] if i + 1 < len(args) else "*"
        p = self._resolve(path)
        found = []
        for fp in self.fs.walk(p):
            name = fp.rstrip("/").rsplit("/", 1)[-1]
            if fnmatch.fnmatch(name, pattern):
                found.append(fp)
        return "\n".join(found) if found else "（没有匹配的文件）"

    def _cmd_wc(self, args):
        if not args or not args[0].startswith("-"):
            raise CommandError("用法：wc -l <文件> 或 wc -c <文件>")
        opt = args[0]
        if len(args) < 2:
            raise CommandError("wc: 请指定文件")
        p = self._resolve(args[1])
        node = self.fs.get(p)
        if node.kind == "dir":
            raise CommandError("wc: 目标是个目录")
        if "-l" in opt:
            return str(len(node.content.splitlines()))
        if "-c" in opt:
            return str(len(node.content.encode("utf-8")))
        raise CommandError("wc: 只支持 -l 和 -c")

    def _cmd_rm(self, args):
        if not args:
            raise CommandError("用法：rm [-r] <路径>")
        recursive = "-r" in args or "-rf" in args
        for a in args:
            if a.startswith("-"):
                continue
            p = self.fs.norm(a)
            node = self.fs.get(p)
            if node is None:
                raise CommandError(f"rm: 无法删除 '{a}': 不存在")
            if node.kind == "dir" and not recursive:
                raise CommandError(f"rm: 无法删除目录 '{a}': 加 -r 试试")
            del self.fs.nodes[p]

    def _cmd_mv(self, args):
        if len(args) < 2:
            raise CommandError("用法：mv <源> <目标>")
        src = self.fs.norm(args[0])
        dst = self.fs.norm(args[1])
        node = self.fs.get(src)
        if node is None:
            raise CommandError(f"mv: '{args[0]}' 不存在")
        dst_node = self.fs.get(dst)
        if dst_node is not None and dst_node.kind == "dir":
            dst = self.fs.norm(dst + "/" + src.rsplit("/", 1)[-1])
        if dst == src:
            return
        del self.fs.nodes[src]
        self.fs.add(dst, node)

    def _cmd_cp(self, args):
        if len(args) < 2:
            raise CommandError("用法：cp <源> <目标>")
        src = self.fs.norm(args[0])
        dst = self.fs.norm(args[1])
        node = self.fs.get(src)
        if node is None:
            raise CommandError(f"cp: '{args[0]}' 不存在")
        if node.kind == "dir":
            raise CommandError("cp: 暂不支持复制目录")
        dst_node = self.fs.get(dst)
        if dst_node is not None and dst_node.kind == "dir":
            dst = self.fs.norm(dst + "/" + src.rsplit("/", 1)[-1])
        self.fs.add(dst, Node("file", node.content, node.mode))

    def _cmd_chmod(self, args, session):
        if len(args) < 2:
            raise CommandError("用法：chmod +x <文件> 或 chmod <数字权限> <文件>")
        mode_arg, target = args[0], args[1]
        p = self._resolve(target)
        node = self.fs.get(p)
        if node.kind == "dir":
            raise CommandError("chmod: 目标是个目录")
        if mode_arg in ("+x", "+X", "a+x"):
            node.mode = node.mode[:2] + "1"
            if p == "/opt/app/deploy.sh":
                self.state["chmod_deploy"] = True
        elif mode_arg in ("-x",):
            node.mode = node.mode[:2] + "0"
        elif len(mode_arg) == 3 and mode_arg.isdigit():
            node.mode = mode_arg
        else:
            raise CommandError(f"chmod: 无法理解模式 '{mode_arg}'")

    def _cmd_tree(self, args):
        p = self._resolve(args[0] if args else ".")
        lines = [p]
        prefix = p.rstrip("/") + "/"
        children = [fp for fp in self.fs.walk(p) if fp != p]
        for i, fp in enumerate(children):
            rel = fp[len(prefix):]
            name = rel.rsplit("/", 1)[-1]
            depth = rel.count("/")
            node = self.fs.get(fp)
            suffix = "/" if node.kind == "dir" else ""
            lines.append("  " * depth + "├─ " + name + suffix)
        return "\n".join(lines)

    def _run_script(self, path, emit):
        p = self.fs.norm(path)
        node = self.fs.get(p)
        if node is None:
            raise CommandError(f"bash: {path}: 没有那个文件或目录")
        if node.kind == "dir":
            raise CommandError(f"bash: {path}: 是一个目录")
        if "1" not in node.mode:
            raise CommandError(f"bash: {path}: 权限不够（Permission denied）。先用 chmod +x 试试。")
        for line in node.content.splitlines():
            if line.startswith("#!"):
                continue
            parts = shlex.split(line)
            if not parts:
                continue
            if parts[0] == "echo":
                emit(" ".join(parts[1:]))
            elif parts[0] == "touch":
                if len(parts) > 1:
                    self.fs.touch(parts[1])
            elif parts[0] == "cat":
                if len(parts) > 1:
                    f = self.fs.get(self.fs.norm(parts[1]))
                    if f:
                        emit(f.content.rstrip("\n"))
            else:
                emit("$ " + line)
        if p == "/opt/app/deploy.sh":
            self.state["deployed"] = True

    def _pipe_out(self, out, right):
        r0 = right[0].lower()
        if r0 == "wc":
            if "-l" in right:
                count = len([x for x in out.splitlines() if x.strip()])
                return str(count)
            if "-c" in right:
                return str(len(out.encode("utf-8")))
            raise CommandError("wc: 管道后只支持 -l / -c")
        if r0 == "grep":
            if len(right) < 2:
                raise CommandError("grep: 管道用法：... | grep <模式>")
            try:
                rx = re.compile(right[1])
            except re.error as exc:
                raise CommandError(f"grep: 正则错误：{exc}")
            hits = [ln for ln in out.splitlines() if rx.search(ln)]
            return "\n".join(hits) if hits else "（没有匹配的行）"
        if r0 == "head":
            n = int(right[right.index("-n") + 1]) if "-n" in right else 10
            return "\n".join(out.splitlines()[:n])
        if r0 == "tail":
            n = int(right[right.index("-n") + 1]) if "-n" in right else 10
            return "\n".join(out.splitlines()[-n:])
        raise CommandError(f"{right[0]}: 暂不支持这个管道命令")

    # ---------------- 帮助 ----------------
    def help_text(self, session):
        return T.box([
            "文件操作：ls [-l] [路径] ｜ cd <路径> ｜ pwd ｜ cat <文件>",
            "内容操作：head/tail -n <行数> <文件> ｜ grep [-c] [-r] <模式> <文件> ｜ wc -l/-c <文件>",
            "搜索统计：find <路径> -name <模式> ｜ tree [路径]",
            "修改操作：echo <文本> > <文件>（>> 追加）｜ mkdir ｜ touch ｜ rm [-r] ｜ mv ｜ cp",
            "权限操作：chmod +x <文件> ｜ chmod <数字> <文件>",
            "其他：whoami ｜ date ｜ hostname ｜ clear ｜ 直接运行 ./脚本",
            "管道：... | wc -l ｜ ... | grep <模式>",
        ], title="终端命令手册", color="cyan")

    def solve(self):
        return [
            "find / -name config.ini",
            "cat /opt/app/config.ini",
            'grep -c " 500 " /opt/app/logs/access.log',
            "tail -n 20 /opt/app/logs/access.log > /opt/app/report.txt",
            "chmod +x /opt/app/deploy.sh",
            "/opt/app/deploy.sh",
            "mv /opt/app/logs/error.log /opt/app/logs/error_2025.log",
            'find /opt/app -name "*.py" | wc -l',
        ]

    def dashboard(self):
        def st(path, label, done_key=None, done_text=None):
            node = self.fs.get(path)
            if node is None:
                return [label, "—"]
            if done_key and self.state.get(done_key):
                return [label, done_text or "已完成 ✓"]
            if path in self.read_files:
                return [label, "已查看 ✓"]
            return [label, "待处理"]
        rows = [
            st("/opt/app/config.ini", "config.ini"),
            st("/opt/app/report.txt", "report.txt"),
            st("/opt/app/logs/error_2025.log", "error_2025.log"),
            st("/opt/app/deploy.sh", "deploy.sh", "deployed", "已执行 ✓"),
        ]
        return {"theme": {"icon": "🖥️", "title": "终端工作台", "accent": "#3fb950"},
                "panels": [
                    {"kind": "kv", "title": "会话", "items": [
                        ["当前目录", self.fs.cwd], ["用户", "dev"], ["主机", "glitchworks"]]},
                    {"kind": "table", "title": "关键文件", "headers": ["文件", "状态"], "rows": rows},
                ]}
