"""场景 11：安全防线 —— 公司网站被攻击了，你是值班安全工程师：溯源、修复、加固。

支持：log view / log search / scan / detail / fix / fw rule / check auth / check / report。
"""

import re
import shlex

from .. import terminal as T
from .base import CommandError, Scenario, Task

ATTACK_IP = "203.0.113.66"

LOG_LINES = [
    f"2025-01-15 03:12:04 {ATTACK_IP} POST /login 200 45ms  \"username=' OR '1'='1 --\"",
    f"2025-01-15 03:12:05 {ATTACK_IP} POST /login 200 41ms  \"username=admin' --\"",
    f"2025-01-15 03:13:22 {ATTACK_IP} GET /search?q=<script>alert(1)</script> 200 12ms",
    f"2025-01-15 03:14:57 {ATTACK_IP} POST /login 401 3ms   (第 1024 次暴力尝试)",
    "2025-01-15 03:16:30 203.0.113.77 GET / 200 9ms",
    "2025-01-15 03:18:02 198.51.100.9 GET /static/app.js 200 7ms",
]

FINDINGS = {
    "sqli": {
        "name": "SQL 注入",
        "risk": "高危",
        "desc": "登录接口把用户名直接拼进 SQL：SELECT * FROM users WHERE name='{user}'",
        "impact": "攻击者输入 ' OR '1'='1 即可绕过登录，看到全库数据。日志里已经出现这种尝试。",
        "fix_hint": "修复方案：改为参数化查询（? 占位符），绝不拼接字符串。",
    },
    "xss": {
        "name": "XSS 跨站脚本",
        "risk": "高危",
        "desc": "搜索框把用户输入直接输出到页面，没有转义",
        "impact": "攻击者注入 <script> 窃取其他用户的 Cookie，甚至伪造操作。日志里有 <script>alert(1)</script>。",
        "fix_hint": "修复方案：输出前 HTML 转义（< → &lt; 等），或使用框架的自动转义。",
    },
    "weak_password": {
        "name": "弱口令",
        "risk": "中危",
        "desc": "管理员账号使用默认密码 admin / 123456",
        "impact": "攻击者暴力破解 1024 次后就能登进去。日志里全是暴力尝试。",
        "fix_hint": "修复方案：强制改密 + 开启双因素认证（2FA）。",
    },
}


class SecurityFortress(Scenario):
    id = "security_fortress"
    name = "安全防线"
    tagline = "凌晨 3 点，入侵检测系统疯狂告警：有人在打我们的网站！\n你是今晚值班的安全工程师——溯源攻击、堵上漏洞、加固防线，天亮前交报告。"
    env = "security（模拟安全审计）"
    difficulty = 2
    xp_bonus = 130

    def setup(self):
        self.ran = set()
        self.fixed = set()
        self.blocked = set()
        self.auth_checked = False
        self.secure = False
        self.tasks = [
            Task("z1", "查看攻击日志",
                 "先看看访问日志里有什么异常。用 log view 查看，log search <关键字> 可以筛选。",
                 check=self._ran("log"),
                 hints=("log view", "log search 203.0.113.66"), lesson="sec_log"),
            Task("z2", "扫描漏洞",
                 "对登录页做一次漏洞扫描，看看问题有多严重。",
                 check=self._ran("scan"),
                 hints=("scan /login",), lesson="sec_sqli"),
            Task("z3", "修复 SQL 注入",
                 "日志里出现 ' OR '1'='1 —— 登录接口有 SQL 注入。用 detail sqli 看细节，然后修复。",
                 check=lambda s, c: "sqli" in s.scenario.fixed,
                 hints=("detail sqli", "fix sqli"), lesson="sec_sqli", answer="fix sqli"),
            Task("z4", "修复 XSS",
                 "搜索框存在 XSS：<script> 被直接执行。修复它。",
                 check=lambda s, c: "xss" in s.scenario.fixed,
                 hints=("detail xss", "fix xss"), lesson="sec_xss", answer="fix xss"),
            Task("z5", "封禁攻击者",
                 "从日志里找出攻击者的 IP，加入防火墙黑名单。",
                 check=lambda s, c: ATTACK_IP in s.scenario.blocked,
                 hints=("log search ' OR", f"fw rule add {ATTACK_IP}"), lesson="sec_firewall",
                 answer=f"fw rule add {ATTACK_IP}"),
            Task("z6", "加固弱口令",
                 "顺便做个账号安全审计：check auth。管理员密码太弱了，修掉。",
                 check=lambda s, c: "weak_password" in s.scenario.fixed,
                 hints=("check auth", "fix weak_password"), lesson="sec_password",
                 answer="fix weak_password"),
            Task("z7", "安全验收",
                 "所有漏洞都堵上了吗？跑一次全面检查，然后生成安全报告。",
                 check=lambda s, c: s.scenario.secure,
                 hints=("check", "report"), lesson="sec_firewall", answer="check → report"),
        ]

    def _ran(self, kw):
        return lambda s, c: any(kw in x for x in s.scenario.ran)

    def _open_findings(self):
        return [k for k in FINDINGS if k not in self.fixed]

    # ---------------- 命令 ----------------
    def handle(self, cmd, session):
        self.ran.add(cmd)
        tokens = shlex.split(cmd) if cmd.strip() else []
        if not tokens:
            raise CommandError("输入为空")
        c0 = tokens[0].lower()
        try:
            if c0 == "help":
                return self.help_text(session)
            if c0 == "log":
                return self._cmd_log(tokens[1:])
            if c0 == "scan":
                target = tokens[1] if len(tokens) > 1 else "/"
                open_list = self._open_findings()
                rows = [[FINDINGS[k]["name"], FINDINGS[k]["risk"], "未修复"]
                        for k in FINDINGS if k in open_list]
                if not rows:
                    return f"扫描 {target}：未发现漏洞 ✅"
                return (f"扫描 {target} 完成，发现 {len(rows)} 个漏洞：\n" +
                        T.table(["漏洞", "风险", "状态"], rows) +
                        "\n（用 detail <名称> 查看细节，fix <名称> 修复）")
            if c0 == "detail":
                return self._cmd_detail(tokens[1:])
            if c0 == "fix":
                if len(tokens) < 2:
                    raise CommandError("fix <sqli|xss|weak_password>")
                name = tokens[1].lower()
                if name not in FINDINGS:
                    raise CommandError(f"没有这个漏洞：{name}（可选 sqli / xss / weak_password）")
                self.fixed.add(name)
                return f"✅ 已修复【{FINDINGS[name]['name']}】——{FINDINGS[name]['fix_hint']}"
            if c0 == "fw":
                return self._cmd_fw(tokens[1:])
            if c0 == "check":
                if len(tokens) > 1 and tokens[1] == "auth":
                    self.auth_checked = True
                    return ("账号审计结果：\n"
                            "  ⚠ admin / 123456 —— 弱口令！任何人都能猜出来\n"
                            "  ✅ 其余 23 个账号密码强度达标\n"
                            "（修复：fix weak_password）")
                return self._cmd_check()
            if c0 == "report":
                return self._cmd_report()
            raise CommandError(f"{c0}: 未找到命令。输入 help 查看安全审计命令。")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"{c0}: 出错：{exc}")

    def _cmd_log(self, args):
        if args and args[0] in ("view", "list"):
            return "\n".join(LOG_LINES)
        if args and args[0] == "search":
            if len(args) < 2:
                raise CommandError("log search <关键字>")
            pat = args[1]
            try:
                rx = re.compile(re.escape(pat), re.I)
            except re.error:
                rx = re.compile(pat, re.I)
            hits = [ln for ln in LOG_LINES if rx.search(ln)]
            return "\n".join(hits) if hits else "（没有匹配的日志）"
        raise CommandError("log view ｜ log search <关键字>")

    def _cmd_detail(self, args):
        if not args:
            raise CommandError("detail <sqli|xss|weak_password>")
        name = args[0].lower()
        if name not in FINDINGS:
            raise CommandError(f"没有这个漏洞：{name}")
        f = FINDINGS[name]
        return (f"【{f['name']}】风险：{f['risk']}\n\n"
                f"{f['desc']}\n\n影响：{f['impact']}\n\n修复：{f['fix_hint']}")

    def _cmd_fw(self, args):
        if not args:
            raise CommandError("fw list ｜ fw rule add <IP> ｜ fw rule del <IP>")
        if args[0] == "list":
            return "\n".join(f"- {ip} 已封禁" for ip in sorted(self.blocked)) or "（防火墙规则为空）"
        if args[0] == "rule" and len(args) >= 3:
            op, ip = args[1].lower(), args[2]
            if op == "add":
                self.blocked.add(ip)
                return f"已封禁 {ip} ✅（该 IP 的所有请求将被拒绝）"
            if op == "del":
                self.blocked.discard(ip)
                return f"已解封 {ip}"
        raise CommandError("fw list ｜ fw rule add <IP> ｜ fw rule del <IP>")

    def _cmd_check(self):
        open_list = self._open_findings()
        lines = ["全面安全检查："]
        for k in FINDINGS:
            st = "未修复" if k in open_list else "已修复 ✅"
            lines.append(f"  {'❌' if k in open_list else '✅'} {FINDINGS[k]['name']}：{st}")
        if ATTACK_IP in self.blocked:
            lines.append(f"  ✅ 攻击者 {ATTACK_IP} 已封禁")
        else:
            lines.append(f"  ❌ 攻击者 {ATTACK_IP} 未封禁！")
        if not open_list and ATTACK_IP in self.blocked:
            self.secure = True
            lines.append("\n🎉 系统安全！可以生成报告了（report）")
        else:
            lines.append("\n还有问题未处理，继续排查。")
        return "\n".join(lines)

    def _cmd_report(self):
        if not self.secure:
            raise CommandError("系统还没验收通过：先 check 确认所有漏洞已修复、攻击者已封禁")
        return ("\n".join([
            "========== 安全事件报告 ==========",
            f"事件：网站遭受 SQL 注入 / XSS / 暴力破解攻击（来源 {ATTACK_IP}）",
            "处置：",
            "  1. 修复登录接口 SQL 注入（参数化查询）",
            "  2. 修复搜索框 XSS（HTML 转义）",
            "  3. 管理员弱口令整改 + 建议开启 2FA",
            f"  4. 攻击者 {ATTACK_IP} 已加入防火墙黑名单",
            "结论：漏洞已全部修复，系统恢复安全状态。",
            "==================================",
        ]))

    def help_text(self, session):
        return T.box([
            "日志：log view ｜ log search <关键字>",
            "扫描：scan [url] ｜ detail <sqli|xss|weak_password>",
            "修复：fix <sqli|xss|weak_password>",
            "防线：fw list ｜ fw rule add <IP> ｜ fw rule del <IP>",
            "审计：check auth ｜ check ｜ report",
        ], title="安全审计命令手册", color="cyan")

    def solve(self):
        return [
            "log view",
            "log search 203.0.113.66",
            "scan /login",
            "detail sqli",
            "fix sqli",
            "detail xss",
            "fix xss",
            f"fw rule add {ATTACK_IP}",
            "check auth",
            "fix weak_password",
            "check",
            "report",
        ]

    def dashboard(self):
        items = [{"label": f"{FINDINGS[k]['name']}（{FINDINGS[k]['risk']}）",
                  "state": "已修复" if k in self.fixed else "未修复",
                  "ok": k in self.fixed} for k in FINDINGS]
        items.append({"label": f"攻击者 {ATTACK_IP}",
                      "state": "已封禁" if ATTACK_IP in self.blocked else "活跃",
                      "ok": ATTACK_IP in self.blocked})
        return {"theme": {"icon": "🛡️", "title": "安全运营中心", "accent": "#f85149"},
                "panels": [
                    {"kind": "status", "title": "风险面板", "items": items},
                    {"kind": "log", "title": "最近日志", "lines": LOG_LINES[-4:]},
                ]}
