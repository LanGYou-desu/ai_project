"""场景 5：系统急救 —— 凌晨 3 点，生产服务器告警，用运维命令救它。

支持：uptime / top / ps / kill / df / free / du / rm / systemctl /
netstat / ss / tail / cat /proc/meminfo。
"""

import shlex

from .. import terminal as T
from .base import CommandError, Scenario, Task


class SysadminER(Scenario):
    id = "sysadmin_er"
    name = "系统急救"
    tagline = "凌晨 3:00，监控大屏疯狂闪红：CPU 97%、内存爆了、磁盘快满、端口被占。\n服务器在你手里喘息，稳住。"
    env = "linux-server（模拟监控）"
    difficulty = 2
    xp_bonus = 120

    def setup(self):
        self.ran = set()
        self.procs = [
            {"pid": 1, "name": "systemd", "cpu": 0.1, "mem": 0.5, "cmd": "/usr/lib/systemd/systemd"},
            {"pid": 9001, "name": "nginx", "cpu": 2.0, "mem": 1.2, "cmd": "nginx: master process"},
            {"pid": 9002, "name": "nginx", "cpu": 3.0, "mem": 1.0, "cmd": "nginx: worker process"},
            {"pid": 1337, "name": "xmrig", "cpu": 88.0, "mem": 12.4, "cmd": "./xmrig -o pool.mine.io:3333"},
            {"pid": 4242, "name": "java-app", "cpu": 4.0, "mem": 34.2, "cmd": "java -Xmx8g -jar app.jar"},
            {"pid": 7777, "name": "node_legacy", "cpu": 1.0, "mem": 0.8, "cmd": "node legacy/server.js"},
        ]
        self.services = {"nginx": "running", "mysql": "stopped"}
        self.ports = {"80": 9002, "8080": 7777}
        self.mem_used = 15200      # MB / 16000
        self.mem_total = 16000
        self.disk_used = 98        # GB / 100
        self.disk_total = 100
        self.cpu = 97.0
        self.syslog = [
            "Jan 15 02:41:12 glitch kernel: Out of memory: Killed process 4242 (java-app)",
            "Jan 15 02:42:01 glitch nginx: worker process 9002 exited with signal 9",
            "Jan 15 02:43:55 glitch sshd: Failed password for root from 203.0.113.77 port 51234",
            "Jan 15 02:45:20 glitch kernel: TCP: time wait bucket table overflow",
            "Jan 15 02:46:33 glitch systemd: nginx.service: Failed to restart: no space left on device",
            "Jan 15 02:47:01 glitch crond: (root) CMD (/usr/local/bin/backup.sh)",
        ]
        self.du = {"/var/log/huge.log": "40G", "/var/log": "43G", "/var": "44G",
                   "/home": "12G", "/opt": "25G", "/tmp": "3G", "/usr": "11G"}
        self.state.update({"huge_removed": False, "nginx_restarted": False, "zombie_killed": False})
        self.tasks = [
            Task("y1", "查看系统负载",
                 "先看服务器状态。用 uptime 查看负载情况。",
                 check=self._ran("uptime"), hints=("uptime",), lesson="sys_ps"),
            Task("y2", "揪出 CPU 杀手",
                 "CPU 97%！用 top 或 ps 找到吃 CPU 最多的进程，然后把它干掉。",
                 check=self._no_xmrig, hints=("top", "ps aux --sort=-%cpu", "kill 1337"),
                 lesson="sys_ps", answer="kill 1337"),
            Task("y3", "清理磁盘",
                 "磁盘 98% 满！用 df -h 看分区，再找出哪个大文件占地方（du -sh），删掉它。",
                 check=lambda s, c: s.scenario.state.get("huge_removed"),
                 hints=("df -h", "du -sh /var/log/*", "rm /var/log/huge.log"),
                 lesson="sys_disk", answer="rm /var/log/huge.log"),
            Task("y4", "内存泄漏急救",
                 "内存占用 95%，nginx worker 一直在泄漏。重启 nginx 服务释放内存。",
                 check=lambda s, c: s.scenario.state.get("nginx_restarted"),
                 hints=("systemctl restart nginx",), lesson="sys_service", answer="systemctl restart nginx"),
            Task("y5", "释放被占的端口",
                 "8080 端口被一个僵尸进程占着，新服务起不来。用 netstat 找到占用者并杀掉它。",
                 check=lambda s, c: s.scenario.state.get("zombie_killed"),
                 hints=("netstat -tlnp", "kill 7777"), lesson="sys_service", answer="kill 7777"),
            Task("y6", "确认服务在线",
                 "最后确认：mysql 服务是否 running？如果不是，启动它。",
                 check=self._mysql_up, hints=("systemctl status mysql", "systemctl start mysql"),
                 lesson="sys_service", answer="systemctl start mysql"),
        ]

    def _ran(self, kw):
        return lambda s, c: any(kw in x for x in s.scenario.ran)

    def _no_xmrig(self, s, c):
        return all(p["name"] != "xmrig" for p in s.scenario.procs)

    def _mysql_up(self, s, c):
        return s.scenario.services.get("mysql") == "running"

    def handle(self, cmd, session):
        self.ran = getattr(self, "ran", set())
        self.ran.add(cmd)
        tokens = shlex.split(cmd) if cmd.strip() else []
        if not tokens:
            raise CommandError("输入为空")
        c0 = tokens[0].lower()
        try:
            if c0 == "help":
                return self.help_text(session)
            if c0 == "uptime":
                return f" 02:47:36 up 3 days,  2:11,  2 users,  load average: 23.41, 18.77, 12.05"
            if c0 == "top":
                lines = [f"top - 02:47:36 up 3 days,  2 users,  load average: {self.cpu / 4:.2f}, 18.77, 12.05",
                         f"Tasks: 142 total", f"%Cpu(s): {self.cpu:.1f} us",
                         f"MiB Mem :  {self.mem_total} total,  {self.mem_total - self.mem_used} free,  {self.mem_used} used",
                         "",
                         "  PID  USER   %CPU  %MEM  COMMAND"]
                for p in sorted(self.procs, key=lambda x: -x["cpu"]):
                    lines.append(f"{p['pid']:>5}  dev   {p['cpu']:>4.1f}  {p['mem']:>4.1f}  {p['cmd']}")
                return "\n".join(lines)
            if c0 == "ps":
                if len(tokens) > 1 and tokens[1] == "aux":
                    rows = [[p["pid"], p["name"], f"{p['cpu']:.1f}", f"{p['mem']:.1f}", p["cmd"]]
                            for p in sorted(self.procs, key=lambda x: -x["cpu"])]
                    return T.table(["PID", "名称", "%CPU", "%MEM", "命令行"], rows)
                rows = [[p["pid"], p["name"], f"{p['cpu']:.1f}%"] for p in self.procs]
                return T.table(["PID", "名称", "CPU"], rows)
            if c0 == "kill":
                if len(tokens) < 2 or not tokens[1].isdigit():
                    raise CommandError("用法：kill <PID>")
                pid = int(tokens[1])
                victim = next((p for p in self.procs if p["pid"] == pid), None)
                if victim is None:
                    raise CommandError(f"kill: 进程 {pid} 不存在")
                self.procs = [p for p in self.procs if p["pid"] != pid]
                if pid == 1337:
                    self.cpu = 23.0
                    self.state["zombie_killed"] = self.state.get("zombie_killed", False)
                if pid == 7777:
                    self.ports.pop("8080", None)
                    self.state["zombie_killed"] = True
                return f"已终止进程 {pid}（{victim['name']}）。"
            if c0 == "df":
                used = self.disk_used if not self.state["huge_removed"] else self.disk_used - 40
                pct = int(used / self.disk_total * 100)
                return T.table(["文件系统", "容量", "已用", "可用", "使用率", "挂载点"],
                               [["/dev/sda1", f"{self.disk_total}G", f"{used}G",
                                 f"{self.disk_total - used}G", f"{pct}%", "/"],
                                ["/dev/sdb1", "500G", "120G", "380G", "24%", "/data"]])
            if c0 == "free":
                free = self.mem_total - self.mem_used
                return T.table(["", "总量", "已用", "可用"],
                               [["内存(MB)", self.mem_total, self.mem_used, free]])
            if c0 == "du":
                path = tokens[1] if len(tokens) > 1 else "/var/log/*"
                if path.endswith("*"):
                    base = path[:-1] or "/"
                    rows = [[k, v] for k, v in self.du.items() if k.startswith(base)]
                    return T.table(["路径", "大小"], rows)
                if path in self.du:
                    return f"{self.du[path]}    {path}"
                return "（没有找到这个大文件，试试 du -sh /var/log/*）"
            if c0 == "rm":
                if len(tokens) < 2:
                    raise CommandError("用法：rm <路径>")
                if tokens[1] == "/var/log/huge.log":
                    self.state["huge_removed"] = True
                    return "已删除 /var/log/huge.log（磁盘释放了 40G）"
                raise CommandError(f"rm: 无法删除 {tokens[1]}: 权限不够（这是生产服务器！）")
            if c0 == "systemctl":
                return self._systemctl(tokens[1:])
            if c0 in ("netstat", "ss"):
                if len(tokens) > 1 and tokens[1] == "-tlnp":
                    rows = []
                    for port, pid in self.ports.items():
                        proc = next((p for p in self.procs if p["pid"] == pid), None)
                        rows.append([f"0.0.0.0:{port}", "LISTEN", pid,
                                     proc["name"] if proc else "?"])
                    if not rows:
                        return "（没有监听中的端口）"
                    return T.table(["本地地址", "状态", "PID", "进程"], rows)
                raise CommandError("用法：netstat -tlnp 或 ss -tlnp")
            if c0 == "tail":
                if len(tokens) >= 2 and tokens[1] == "-n" and len(tokens) >= 3 and tokens[2].isdigit():
                    n = int(tokens[2])
                    path = tokens[3] if len(tokens) > 3 else ""
                    if path in ("/var/log/syslog", "/var/log/messages"):
                        return "\n".join(self.syslog[-n:])
                    raise CommandError(f"tail: {path}: 无法读取（只模拟了 /var/log/syslog）")
                raise CommandError("用法：tail -n <行数> /var/log/syslog")
            if c0 == "cat":
                if len(tokens) > 1 and tokens[1] == "/proc/meminfo":
                    free = self.mem_total - self.mem_used
                    return (f"MemTotal:      {self.mem_total * 1024} kB\n"
                            f"MemFree:        {free * 1024} kB\n"
                            f"MemAvailable:   {free * 1024} kB")
                raise CommandError("cat: 只模拟了 /proc/meminfo")
            if c0 in ("whoami",):
                return "root"
            if c0 in ("date",):
                return "2025年01月15日 星期三 02:47:36 CST"
            if c0 in ("reboot", "shutdown", "init"):
                raise CommandError(f"{c0}: 别闹，这是生产服务器！")
            raise CommandError(f"{c0}: 未找到命令。输入 help 查看运维命令。")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"{c0}: 出错：{exc}")

    def _systemctl(self, args):
        if not args:
            raise CommandError("用法：systemctl status/restart/start/stop <服务>")
        act, svc = args[0].lower(), (args[1] if len(args) > 1 else "")
        if svc not in self.services:
            raise CommandError(f"systemctl: 服务 {svc} 不存在（可选 nginx / mysql）")
        if act == "status":
            st = self.services[svc]
            return (f"● {svc}.service - {svc}\n"
                    f"     Active: active (running) since 3 days ago\n" if st == "running"
                    else f"● {svc}.service\n     Active: inactive (dead)")
        if act == "restart":
            self.services[svc] = "running"
            if svc == "nginx":
                self.state["nginx_restarted"] = True
                self.mem_used = 8600   # 泄漏的 worker 被杀，内存释放
            return f"已重启 {svc}。"
        if act == "start":
            self.services[svc] = "running"
            return f"已启动 {svc}。"
        if act == "stop":
            self.services[svc] = "stopped"
            return f"已停止 {svc}。"
        raise CommandError("systemctl: 支持 status/restart/start/stop")

    def help_text(self, session):
        return T.box([
            "监控：uptime ｜ top ｜ ps aux ｜ df -h ｜ free -m ｜ du -sh <路径>",
            "操作：kill <PID> ｜ rm <文件> ｜ systemctl status/restart/start/stop <服务>",
            "网络：netstat -tlnp ｜ ss -tlnp",
            "日志：tail -n <行数> /var/log/syslog ｜ cat /proc/meminfo",
        ], title="运维命令手册", color="cyan")

    def solve(self):
        return [
            "uptime",
            "top",
            "kill 1337",
            "df -h",
            "du -sh /var/log/*",
            "rm /var/log/huge.log",
            "systemctl restart nginx",
            "netstat -tlnp",
            "kill 7777",
            "systemctl start mysql",
        ]

    def dashboard(self):
        disk_used = self.disk_used if not self.state["huge_removed"] else self.disk_used - 40
        procs = sorted(self.procs, key=lambda x: -x["cpu"])[:4]
        return {"theme": {"icon": "📊", "title": "监控工作台", "accent": "#3fb950"},
                "panels": [
                    {"kind": "meter", "title": "服务器资源", "items": [
                        {"label": "CPU", "value": self.cpu, "max": 100, "unit": "%"},
                        {"label": "内存", "value": self.mem_used, "max": self.mem_total, "unit": "MB"},
                        {"label": "磁盘", "value": disk_used, "max": self.disk_total, "unit": "GB"}]},
                    {"kind": "status", "title": "服务", "items": [
                        {"label": "nginx", "state": self.services["nginx"], "ok": self.services["nginx"] == "running"},
                        {"label": "mysql", "state": self.services["mysql"], "ok": self.services["mysql"] == "running"}]},
                    {"kind": "table", "title": "进程 TOP4", "headers": ["PID", "进程", "CPU%"],
                     "rows": [[p["pid"], p["name"], f"{p['cpu']:.1f}"] for p in procs]},
                ]}
