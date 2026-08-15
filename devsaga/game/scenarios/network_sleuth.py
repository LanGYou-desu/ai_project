"""场景 7：网络侦探 —— 线上服务挂了，从网络分层开始排查。

支持：ping / nslookup / cat /etc/hosts / cat /etc/resolv.conf / fix dns /
curl -v / tail / systemctl restart / iptables / tcpdump / ss。
"""

import shlex

from .. import terminal as T
from .base import CommandError, Scenario, Task


class NetworkSleuth(Scenario):
    id = "network_sleuth"
    name = "网络侦探"
    tagline = "客户投诉雪片般飞来：网站打不开了！\n从链路层到应用层，一层一层查下去——真相只有一个。"
    env = "network（模拟诊断）"
    difficulty = 2
    xp_bonus = 130

    def setup(self):
        self.ran = set()
        self.dns_table = {"api.glitch.com": "203.0.113.66", "www.glitch.com": "203.0.113.10"}
        self.hosts_content = ("203.0.113.66   api.glitch.com   # ← 谁写的？！应该是 203.0.113.10\n"
                              "203.0.113.10   www.glitch.com\n")
        self.backend_up = False
        self.firewall = [
            "-P INPUT DROP",
            "-A INPUT -i lo -j ACCEPT",
            "-A INPUT -p tcp --dport 22 -j ACCEPT",
            "-A INPUT -p tcp --dport 443 -j DROP    ← 问题！443 被 DROP 了",
            "-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
        ]
        self.nginx_log = [
            "2025/01/15 02:41:02 [error] upstream timed out (110: Connection timed out) while connecting to upstream",
            "2025/01/15 02:41:03 [error] connect() failed (111: Connection refused) while connecting to 127.0.0.1:9000",
            "2025/01/15 02:42:15 [error] upstream prematurely closed connection while reading response header from upstream",
        ]
        self.capture = [
            "02:43:01.123456 IP 203.0.113.77.50000 > 10.0.0.5.443: Flags [S], seq 1000, win 64240",
            "02:43:01.123457 IP 203.0.113.77.50001 > 10.0.0.5.443: Flags [S], seq 2000, win 64240",
            "02:43:01.123458 IP 203.0.113.77.50002 > 10.0.0.5.443: Flags [S], seq 3000, win 64240",
            "02:43:01.123459 IP 203.0.113.77.50003 > 10.0.0.5.443: Flags [S], seq 4000, win 64240",
            "02:43:01.123460 IP 203.0.113.77.50004 > 10.0.0.5.443: Flags [S], seq 5000, win 64240",
            "...（同一源 IP 疯狂发 SYN，从不回 ACK——典型 SYN Flood）",
        ]
        self.state.update({"dns_fixed": False, "backend_restarted": False,
                           "fw_443": False, "attacker_blocked": False, "final_ok": False})
        self.tasks = [
            Task("n1", "链路检查",
                 "先从最底层查起。ping 一下网关 10.0.0.1，确认链路通不通。",
                 check=self._ran("ping"), hints=("ping 10.0.0.1",), lesson="net_ping"),
            Task("n2", "DNS 异常",
                 "链路没问题。解析一下 api.glitch.com，看看解析结果对不对。\n发现不对后，查 /etc/hosts，然后用 fix dns 修复。",
                 check=lambda s, c: s.scenario.state.get("dns_fixed"),
                 hints=("nslookup api.glitch.com", "cat /etc/hosts", "fix dns"),
                 lesson="net_dns", answer="fix dns"),
            Task("n3", "502 的真相",
                 "用 curl -v 访问健康检查接口，看看返回什么。\n再看 nginx 错误日志，找到真正挂掉的服务并重启它。",
                 check=lambda s, c: s.scenario.state.get("backend_restarted"),
                 hints=("curl -v https://api.glitch.com/health",
                        "tail -n 20 /var/log/nginx/error.log",
                        "systemctl restart backend"),
                 lesson="net_http", answer="systemctl restart backend"),
            Task("n4", "防火墙误伤",
                 "检查防火墙 iptables -L：443 端口可能被误 DROP 了。放行它。",
                 check=lambda s, c: s.scenario.state.get("fw_443"),
                 hints=("iptables -L", "iptables -A INPUT -p tcp --dport 443 -j ACCEPT"),
                 lesson="net_iptables", answer="iptables -A INPUT -p tcp --dport 443 -j ACCEPT"),
            Task("n5", "SYN 洪水",
                 "抓包看看流量（tcpdump -n）：好像有人在打我们！\n找到攻击源 IP 并封禁它。",
                 check=lambda s, c: s.scenario.state.get("attacker_blocked"),
                 hints=("tcpdump -n", "iptables -A INPUT -s 203.0.113.77 -j DROP"),
                 lesson="net_attack", answer="iptables -A INPUT -s 203.0.113.77 -j DROP"),
            Task("n6", "最终验证",
                 "再 curl 一次健康检查，确认服务恢复。",
                 check=lambda s, c: s.scenario.state.get("final_ok"),
                 hints=("curl -v https://api.glitch.com/health",), lesson="net_http"),
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
            if c0 == "ping":
                target = tokens[1] if len(tokens) > 1 else ""
                if target in ("10.0.0.1", "api.glitch.com", "www.glitch.com", "203.0.113.10", "203.0.113.66"):
                    return (f"PING {target} (10.0.0.1) 56(84) bytes of data.\n"
                            f"64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.3 ms\n"
                            f"64 bytes from 10.0.0.1: icmp_seq=2 ttl=64 time=0.4 ms\n"
                            f"64 bytes from 10.0.0.1: icmp_seq=3 ttl=64 time=0.3 ms\n"
                            f"--- {target} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss")
                raise CommandError(f"ping: 未知主机 {target}")
            if c0 == "nslookup":
                target = tokens[1] if len(tokens) > 1 else ""
                if target == "api.glitch.com":
                    return ("Server:         8.8.8.8\n"
                            "Name:   api.glitch.com\n"
                            "Address: 203.0.113.66\n\n"
                            "⚠ 奇怪，api 服务应该解析到 203.0.113.10 才对！")
                if target in self.dns_table:
                    return f"Name:   {target}\nAddress: {self.dns_table[target]}"
                raise CommandError(f"nslookup: 无法解析 {target}")
            if c0 == "cat":
                target = tokens[1] if len(tokens) > 1 else ""
                if target == "/etc/hosts":
                    return self.hosts_content
                if target == "/etc/resolv.conf":
                    return "nameserver 8.8.8.8\nnameserver 1.1.1.1\n"
                if target == "/var/log/nginx/error.log":
                    return "\n".join(self.nginx_log)
                raise CommandError(f"cat: {target}: 没有这个文件（只模拟了 /etc/hosts /etc/resolv.conf /var/log/nginx/error.log）")
            if c0 == "fix":
                if len(tokens) > 1 and tokens[1] == "dns":
                    self.hosts_content = ("203.0.113.10   api.glitch.com\n"
                                          "203.0.113.10   www.glitch.com\n")
                    self.dns_table["api.glitch.com"] = "203.0.113.10"
                    self.state["dns_fixed"] = True
                    return "已修复 /etc/hosts：api.glitch.com → 203.0.113.10 ✅"
                raise CommandError("fix 只支持：fix dns")
            if c0 == "curl":
                target = tokens[2] if len(tokens) > 2 else ""
                if "api.glitch.com" not in target and "health" not in target:
                    raise CommandError("curl: 请访问 https://api.glitch.com/health")
                if not self.backend_up:
                    return ("* Connected to api.glitch.com (203.0.113.10) port 443\n"
                            "> GET /health HTTP/1.1\n"
                            "< HTTP/1.1 502 Bad Gateway\n"
                            "< Content-Type: application/json\n"
                            "< Server: nginx/1.24\n"
                            "{\"error\": \"bad_gateway\", \"hint\": \"nginx 连不上后端\"}")
                self.state["final_ok"] = True
                return ("* Connected to api.glitch.com (203.0.113.10) port 443\n"
                        "> GET /health HTTP/1.1\n"
                        "< HTTP/1.1 200 OK\n"
                        "< Content-Type: application/json\n"
                        "< Server: nginx/1.24\n"
                        '{"status": "ok", "version": "2.3.0"}')
            if c0 == "tail":
                if len(tokens) >= 4 and tokens[1] == "-n" and tokens[3].endswith("error.log"):
                    n = int(tokens[2]) if tokens[2].isdigit() else 20
                    return "\n".join(self.nginx_log[-n:])
                raise CommandError("用法：tail -n <行数> /var/log/nginx/error.log")
            if c0 == "systemctl":
                if len(tokens) >= 2 and tokens[1] == "restart" and len(tokens) >= 3 and tokens[2] == "backend":
                    self.backend_up = True
                    self.state["backend_restarted"] = True
                    return "已重启 backend 服务 ✅（nginx 错误日志里那个 127.0.0.1:9000 活了）"
                if len(tokens) >= 2 and tokens[1] == "status":
                    svc = tokens[2] if len(tokens) > 2 else ""
                    if svc == "backend":
                        return "● backend.service\n     Active: active (running)" if self.backend_up else \
                               "● backend.service\n     Active: failed (Result: exit-code)"
                    if svc == "nginx":
                        return "● nginx.service\n     Active: active (running)"
                raise CommandError("用法：systemctl status backend ｜ systemctl restart backend")
            if c0 == "iptables":
                if len(tokens) > 1 and tokens[1] == "-L":
                    return "\n".join(self.firewall)
                if len(tokens) > 1 and tokens[1] == "-A":
                    rule = " ".join(tokens[2:])
                    if "443" in rule and "ACCEPT" in rule:
                        self.firewall = [r for r in self.firewall if "443" not in r]
                        self.firewall.append("-A INPUT -p tcp --dport 443 -j ACCEPT")
                        self.state["fw_443"] = True
                        return "已添加规则：放行 443 ✅"
                    if "-s" in rule and "DROP" in rule:
                        ip = rule.split("-s")[1].split()[0]
                        self.firewall.append(f"-A INPUT -s {ip} -j DROP")
                        if ip == "203.0.113.77":
                            self.state["attacker_blocked"] = True
                        return f"已封禁 {ip} ✅"
                    raise CommandError("iptables: 只支持 -L 和 -A INPUT ...（443 放行 / -s IP DROP）")
                raise CommandError("用法：iptables -L ｜ iptables -A INPUT -p tcp --dport 443 -j ACCEPT ｜ iptables -A INPUT -s <IP> -j DROP")
            if c0 == "tcpdump":
                return "\n".join(self.capture)
            if c0 == "ss":
                return T.table(["Netid", "本地地址", "状态"],
                               [["tcp", "0.0.0.0:80", "LISTEN"], ["tcp", "0.0.0.0:443", "LISTEN"]])
            if c0 == "whoami":
                return "devops"
            raise CommandError(f"{c0}: 未找到命令。输入 help 查看网络排查命令。")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"{c0}: 出错：{exc}")

    def help_text(self, session):
        return T.box([
            "分层排查：链路 → DNS → 防火墙 → 应用",
            "ping <主机> ｜ nslookup <域名> ｜ cat /etc/hosts ｜ cat /etc/resolv.conf ｜ fix dns",
            "curl -v <url> ｜ tail -n <行数> /var/log/nginx/error.log ｜ systemctl restart backend",
            "iptables -L ｜ iptables -A INPUT -p tcp --dport 443 -j ACCEPT ｜ iptables -A INPUT -s <IP> -j DROP",
            "tcpdump -n ｜ ss -tlnp",
        ], title="网络排查手册", color="cyan")

    def solve(self):
        return [
            "ping 10.0.0.1",
            "nslookup api.glitch.com",
            "cat /etc/hosts",
            "fix dns",
            "curl -v https://api.glitch.com/health",
            "tail -n 20 /var/log/nginx/error.log",
            "systemctl restart backend",
            "iptables -L",
            "iptables -A INPUT -p tcp --dport 443 -j ACCEPT",
            "tcpdump -n",
            "iptables -A INPUT -s 203.0.113.77 -j DROP",
            "curl -v https://api.glitch.com/health",
        ]

    def dashboard(self):
        items = [
            {"label": "网关 10.0.0.1", "state": "可达", "ok": True},
            {"label": "DNS", "state": self.dns_table["api.glitch.com"], "ok": self.state["dns_fixed"]},
            {"label": "backend", "state": "运行中" if self.backend_up else "宕机", "ok": self.backend_up},
            {"label": "443 端口", "state": "已放行" if self.state["fw_443"] else "被 DROP", "ok": self.state["fw_443"]},
            {"label": "攻击源", "state": "已封禁" if self.state["attacker_blocked"] else "活跃", "ok": self.state["attacker_blocked"]},
        ]
        return {"theme": {"icon": "🌐", "title": "网络诊断台", "accent": "#58a6ff"},
                "panels": [
                    {"kind": "status", "title": "链路与服务", "items": items},
                    {"kind": "kv", "title": "域名解析", "items": [[k, v] for k, v in self.dns_table.items()]},
                ]}
