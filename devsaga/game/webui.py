"""网页版后端：本地 HTTP 服务，把 DevSaga 搬进浏览器（零第三方依赖）。

启动：python main.py --web [端口]（默认 8766，会自动打开浏览器）
API 一览：
  GET  /api/state            档案快照 + 待做剧情抉择
  POST /api/profile          {name, difficulty} 新建档案
  GET  /api/scenarios        场景列表
  POST /api/start            {scenario} 开始场景（新建会话）
  POST /api/cmd              {text} 执行命令
  POST /api/hint | skip | coffee | learn | help | exit_scenario
  POST /api/event            {index} 办公室小剧场回应
  POST /api/plot             {index} 剧情抉择
  GET  /api/quiz/<sid>       测验题目
  POST /api/quiz             {sid, answers} 批改
  GET  /api/ending           命运结算
  POST /api/difficulty       切换难度
  GET  /api/achievements     成就列表
"""

import json
import mimetypes
import os
import random
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

from . import engine as E
from . import lessons
from . import terminal as T
from .scenarios import ALL_SCENARIOS, SCENARIO_MAP

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")

# 网页版可点击命令面板（按场景）。答案型任务的选项也放进去，方便纯鼠标操作。
PALETTES = {
    "terminal_master": [
        "ls", "pwd", "cat /opt/app/config.ini", "grep -c ERROR /opt/app/logs/access.log",
        "find / -name config.ini", "chmod +x /opt/app/deploy.sh", "/opt/app/deploy.sh",
        "tail -n 20 /opt/app/logs/access.log", "mv /opt/app/logs/error.log /opt/app/logs/error_2025.log",
        'find /opt/app -name "*.py"', "whoami", "date", "tree /opt/app",
    ],
    "git_quest": [
        "git status", "git log --oneline", "git show f0e9d8c7", "git revert f0e9d8c7",
        "git reflog", "git cherry-pick 7d6e5f4a", "git merge feature",
        "edit README.md", "git stash", "git checkout feature", "git checkout main", "git stash pop",
        "git branch", "git diff",
    ],
    "debug_detective": ["A", "B", "C", "D", "step", "vars", "run", "reset", "5"],
    "sql_rescue": [
        "SELECT * FROM orders WHERE status='paid'",
        "SELECT * FROM orders WHERE amount > 1000",
        "SELECT user_id, SUM(amount) FROM orders GROUP BY user_id",
        "SELECT DISTINCT users.name FROM orders JOIN users ON orders.user_id=users.id JOIN products ON orders.product_id=products.id WHERE products.name='机械键盘'",
        "UPDATE users SET email='xiaohong@glitch.com' WHERE id=7",
        "SELECT COUNT(*) FROM orders",
        "tables", "desc users",
    ],
    "sysadmin_er": [
        "uptime", "top", "ps aux", "kill 1337", "df -h", "du -sh /var/log/*",
        "rm /var/log/huge.log", "systemctl restart nginx", "netstat -tlnp",
        "kill 7777", "systemctl start mysql", "free -m", "cat /proc/meminfo",
    ],
    "algo_arena": ["problems", "status", "hint two_sum", "example two_sum"]
                  + [f"submit {p['id']}" for p in __import__(
                      "game.scenarios.algo_arena", fromlist=["PROBLEMS"]).PROBLEMS],
    "network_sleuth": [
        "ping 10.0.0.1", "nslookup api.glitch.com", "cat /etc/hosts", "fix dns",
        "curl -v https://api.glitch.com/health", "tail -n 20 /var/log/nginx/error.log",
        "systemctl restart backend", "iptables -L",
        "iptables -A INPUT -p tcp --dport 443 -j ACCEPT",
        "tcpdump -n", "iptables -A INPUT -s 203.0.113.77 -j DROP",
    ],
    "container_storm": [
        "docker ps -a", "docker images", "docker logs app-1", "docker inspect app-1",
        "docker update --memory 2g app-1", "docker start app-1", "docker stop legacy-web",
        "docker network ls", "docker network connect app-net cache-1",
        "docker exec web-1 curl localhost/health", "docker stats",
    ],
    "pipeline_deploy": [
        "pipeline status", "pipeline run", "pipeline logs build", "pipeline logs test",
        "pipeline logs lint", "fix app.py", "fix test_app.py", "deploy --blue v2.3",
        "deploy --green v2.3", "health check", "rollback", "test run",
    ],
    "frontend_magic": [
        "view /", "js errors", "event click", "inspect .card", "perf",
        "fix 1", "fix 2", "fix 3", "fix 4", "screenshot",
    ],
    "security_fortress": [
        "log view", "log search 203.0.113.66", "scan /login",
        "detail sqli", "fix sqli", "detail xss", "fix xss",
        "fw list", "fw rule add 203.0.113.66", "check auth",
        "fix weak_password", "check", "report",
    ],
}


class WebState:
    def __init__(self):
        self.lock = threading.Lock()
        self.profile = None      # 延迟加载
        self.stepper = None

    def ensure_profile(self):
        if self.profile is None:
            self.profile = E.load_profile() or E.default_profile("新员工")
        return self.profile

    def snapshot(self):
        p = self.ensure_profile()
        rank_name, _ = E.rank_for(p["xp"])
        nxt = E.next_rank(p["xp"])
        pending_plot = None
        for cid, prompt, options in E.PLOT_CHOICES:
            if cid not in p["choices_done"]:
                pending_plot = {"id": cid, "prompt": prompt,
                                "options": [o[0] for o in options]}
                break
        return {
            "name": p["name"], "rank": rank_name, "xp": p["xp"],
            "next_rank": nxt[0] if nxt else None,
            "next_xp": nxt[1] if nxt else p["xp"],
            "reputation": p["reputation"], "energy": p["coffee"],
            "stats": p["stats"], "difficulty": E.diff_cfg(p)["label"],
            "achievements": p["achievements"], "finished": list(p["finished"]),
            "best": p["best"], "quiz": p.get("quiz", {}),
            "learned": p.get("learned_topics", []),
            "web_stats": p.get("web_stats", {}),
            "pending_plot": pending_plot,
        }

    def scenario_info(self):
        p = self.ensure_profile()
        out = []
        for cls in ALL_SCENARIOS:
            best = p["best"].get(cls.id)
            out.append({
                "id": cls.id, "name": cls.name, "tagline": cls.tagline,
                "env": cls.env, "difficulty": cls.difficulty,
                "done": cls.id in p["finished"],
                "best_score": best["score"] if best else None,
            })
        return out


STATE = WebState()


def _profile_snapshot():
    return STATE.snapshot()


def _stats(profile, key, amount=1):
    p = profile.setdefault("web_stats", {})
    p[key] = p.get(key, 0) + amount


def _write_solution(sid, code):
    path = os.path.join(E.workspace_dir(), sid + ".py")
    with open(path, "w", encoding="utf-8") as f:
        f.write(code)
    return path


def _mark_learned(profile, lesson_key):
    if not lesson_key:
        return
    p = profile.setdefault("learned_topics", [])
    if lesson_key not in p:
        p.append(lesson_key)


def _task_info(stepper):
    t = stepper.session.current_task()
    return {
        "index": stepper.session.task_idx,
        "total": len(stepper.session.tasks),
        "title": t.title if t else None,
        "brief": t.brief if t else None,
        "hints": list(t.hints) if t else [],
        "has_lesson": bool(t and t.lesson),
    }


def _dashboard(stepper):
    """按场景渲染的结构化工作台数据（各场景实现 dashboard()）。"""
    try:
        return stepper.scenario.dashboard()
    except Exception:  # noqa: BLE001 - 面板渲染失败不影响游戏
        return {"theme": {"icon": "🛠", "title": "工作台", "accent": "#58a6ff"}, "panels": []}


# 各场景的终端提示符（贴合真实环境）
PROMPTS = {
    "terminal_master": "dev@glitchworks:~$ ",
    "git_quest": "(main) dev@glitch:~/repo$ ",
    "debug_detective": "dbg> ",
    "sql_rescue": "mysql> ",
    "sysadmin_er": "root@server:~# ",
    "algo_arena": "judge> ",
    "network_sleuth": "netdiag@glitch:~$ ",
    "container_storm": "root@host:~# ",
    "pipeline_deploy": "ci-runner:~$ ",
    "frontend_magic": "console> ",
    "security_fortress": "audit@glitch:~$ ",
}


def _prompt(stepper):
    """实时提示符：终端显示当前目录，Git 显示当前分支，其余用场景预设。"""
    base = PROMPTS.get(stepper.scenario_id, "$ ")
    try:
        kv = {}
        for p in stepper.scenario.dashboard().get("panels", []):
            if p.get("kind") == "kv":
                kv.update(dict(p.get("items", [])))
        if stepper.scenario_id == "terminal_master":
            cwd = kv.get("当前目录", "~")
            return f"dev@glitchworks:{cwd}$ "
        if stepper.scenario_id == "git_quest":
            branch = kv.get("当前分支", "main")
            return f"({branch}) dev@glitch:~/repo$ "
    except Exception:  # noqa: BLE001
        pass
    return base


def _start_scenario(sid):
    if sid not in SCENARIO_MAP:
        raise KeyError(f"未知场景：{sid}")
    p = STATE.ensure_profile()
    p["settings"]["color"] = False
    stepper = E.Stepper(p, sid)
    stepper.reset()
    STATE.stepper = stepper
    sc = stepper.scenario
    return {
        "name": sc.name, "env": sc.env, "difficulty": sc.difficulty,
        "intro": sc.intro() or sc.tagline,
        "help": sc.help_text(stepper.session),
        "palette": PALETTES.get(sid, []),
        "prompt": _prompt(stepper),
        "dashboard": _dashboard(stepper),
        "task": _task_info(stepper),
        "state": stepper.observe(),
        **(_algo_problems(sid)),
    }


def _algo_problems(sid):
    """算法竞技场：返回题目清单与起始模板（网页编辑器用）。"""
    if sid != "algo_arena":
        return {}
    from .scenarios.algo_arena import PROBLEMS
    return {"problems": [{
        "id": p["id"], "title": p["title"], "difficulty": p["difficulty"],
        "desc": p["desc"], "func": p["func"], "example": p["example"],
        "hint": p["hint"],
        "starter": p["func"] + "\n    # TODO: 在这里实现你的代码\n    pass\n",
    } for p in PROBLEMS]}


def _maybe_event(stepper):
    """网页版随机事件：约 30% 概率在整 5 步触发。"""
    s = stepper.session
    if s.steps % 5 != 0 or random.random() > 0.3 or not s.current_task():
        return None
    who, line, options = random.choice(E.STANDUPS)
    return {"who": who, "line": line, "options": [o[0] for o in options]}


def _apply_event(stepper, index):
    s = stepper.session
    who, line, options = random.choice(E.STANDUPS)  # 与触发时同分布即可，索引对应
    if not (0 <= index < len(options)):
        return {"message": "（你沉默了，空气突然安静）"}
    _, stat, val = options[index]
    s.profile["stats"][stat] += val
    E.add_xp(s.profile, 5, s.io)
    s.xp_gained += 5
    s.profile["reputation"] += 2
    return {"message": f"（{who}点点头，属性+{val}，声望+2，XP+5）"}


def _apply_plot(profile, index):
    for cid, prompt, options in E.PLOT_CHOICES:
        if cid in profile["choices_done"]:
            continue
        profile["choices_done"].append(cid)
        if 0 <= index < len(options):
            _, stat, val = options[index]
            profile["stats"][stat] += val
            return {"message": f"（{stat} +{val}，命运已悄然改变…）"}
        return {"message": "（你选择了沉默，命运没有改变）"}
    return {"message": "（没有待做的抉择）"}


def _grade_quiz(sid, answers):
    qs = lessons.QUIZZES.get(sid)
    if not qs:
        raise KeyError("该场景没有测验")
    p = STATE.ensure_profile()
    score = 0
    results = []
    for i, (q, options, ans, explain) in enumerate(qs):
        got = (answers[i] if i < len(answers) else "").strip().upper()
        ok = got == ans
        score += 1 if ok else 0
        results.append({"ok": ok, "correct": ans, "your": got, "explain": explain})
    xp = score * 10
    E.add_xp(p, xp)
    p.setdefault("quiz", {})
    p["quiz"][sid] = max(p["quiz"].get(sid, 0), score)
    if score == len(qs):
        E.unlock_achievement(p, "quiz_master")
    E.save_profile(p)
    return {"score": score, "total": len(qs), "xp": xp,
            "results": results, "full": score == len(qs)}


class Handler(BaseHTTPRequestHandler):
    server_version = "DevSagaWeb/1.0"

    def log_message(self, fmt, *args):
        pass  # 安静点

    # ---------- 工具 ----------
    def _send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path):
        if not os.path.isfile(path):
            self._send_json({"error": "not found"}, 404)
            return
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") else ""))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _ok(self, obj=None):
        if obj is None:
            obj = {}
        obj["profile"] = _profile_snapshot()
        self._send_json(obj)

    # ---------- 路由 ----------
    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        with STATE.lock:
            try:
                if path in ("/", "/index.html"):
                    self._send_file(os.path.join(WEB_DIR, "index.html"))
                elif path.startswith("/static/"):
                    self._send_file(os.path.join(WEB_DIR, path[len("/static/"):]))
                elif path == "/api/state":
                    self._ok({"state": _profile_snapshot()})
                elif path == "/api/scenarios":
                    self._ok({"scenarios": STATE.scenario_info()})
                elif path == "/api/achievements":
                    p = STATE.ensure_profile()
                    self._ok({"achievements": [
                        {"id": k, "name": v[0], "desc": v[1],
                         "unlocked": k in p["achievements"]}
                        for k, v in E.ACHIEVEMENTS.items()]})
                elif path == "/api/ranks":
                    p = STATE.ensure_profile()
                    self._ok({"ranks": [{"name": n, "xp": need} for n, need in E.RANKS]})
                elif path == "/api/lessons":
                    p = STATE.ensure_profile()
                    learned = set(p.get("learned_topics", []))
                    cats = {}
                    for key in lessons.TOPICS:
                        title, _ = lessons.TOPICS[key]
                        cat = lessons.topic_category(key)
                        cats.setdefault(cat, []).append(
                            {"key": key, "title": title, "learned": key in learned})
                    self._ok({"categories": [{"name": c, "topics": cats[c]}
                                             for c in sorted(cats)]})
                elif path.startswith("/api/lessons/"):
                    key = path[len("/api/lessons/"):]
                    if key not in lessons.TOPICS:
                        self._send_json({"error": "no such topic"}, 404)
                        return
                    title, lines = lessons.TOPICS[key]
                    _mark_learned(STATE.ensure_profile(), key)
                    E.save_profile(STATE.profile)
                    self._ok({"key": key, "title": title, "lines": lines,
                              "category": lessons.topic_category(key)})
                elif path == "/api/ending":
                    p = STATE.ensure_profile()
                    title, desc, kind = E.compute_ending(p)
                    E.unlock_achievement(p, "ending_seen")
                    E.save_profile(p)
                    self._ok({"title": title, "desc": desc, "kind": kind})
                elif path.startswith("/api/quiz/"):
                    sid = path[len("/api/quiz/"):]
                    qs = lessons.QUIZZES.get(sid)
                    if not qs:
                        self._send_json({"error": "no quiz"}, 404)
                        return
                    self._ok({"quiz": [{"q": q, "options": opts} for q, opts, _, _ in qs]})
                else:
                    self._send_json({"error": "not found"}, 404)
            except Exception as exc:  # noqa: BLE001
                self._send_json({"error": str(exc)}, 500)

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        with STATE.lock:
            try:
                data = self._read_json()
                if path == "/api/profile":
                    STATE.profile = E.default_profile(data.get("name") or "新员工")
                    STATE.profile["settings"]["difficulty"] = data.get("difficulty", "normal")
                    STATE.stepper = None
                    E.save_profile(STATE.profile)
                    self._ok({"message": "档案已创建"})
                elif path == "/api/start":
                    self._ok(_start_scenario(data.get("scenario", "")))
                elif path == "/api/cmd":
                    self._cmd(data)
                elif path == "/api/hint":
                    self._hint()
                elif path == "/api/skip":
                    self._skip()
                elif path == "/api/coffee":
                    self._coffee()
                elif path == "/api/learn":
                    self._learn()
                elif path == "/api/help" or path == "/api/dashboard":
                    if STATE.stepper is None:
                        self._send_json({"error": "没有进行中的场景"}, 400)
                        return
                    st = STATE.stepper
                    self._ok({"help": st.scenario.help_text(st.session),
                              "dashboard": _dashboard(st)})
                elif path == "/api/exit_scenario":
                    if STATE.stepper:
                        E.save_profile(STATE.profile)
                        STATE.stepper = None
                    self._ok({"message": "已离开场景"})
                elif path == "/api/event":
                    self._ok(_apply_event(STATE.stepper, int(data.get("index", -1))))
                elif path == "/api/plot":
                    self._ok(_apply_plot(STATE.ensure_profile(), int(data.get("index", -1))))
                elif path == "/api/code/save":
                    st = self._require_stepper()
                    _write_solution(data.get("sid", ""), data.get("code", ""))
                    self._ok({"message": "已保存"})
                elif path == "/api/code/run":
                    self._code_run(data)
                elif path == "/api/quiz":
                    self._ok(_grade_quiz(data.get("sid", ""), data.get("answers", [])))
                elif path == "/api/difficulty":
                    p = STATE.ensure_profile()
                    order = ["easy", "normal", "hard"]
                    cur = p["settings"].get("difficulty", "normal")
                    nxt = order[(order.index(cur) + 1) % 3] if cur in order else "normal"
                    p["settings"]["difficulty"] = nxt
                    E.save_profile(p)
                    self._ok({"difficulty": E.diff_cfg(p)["label"]})
                else:
                    self._send_json({"error": "not found"}, 404)
            except Exception as exc:  # noqa: BLE001
                self._send_json({"error": str(exc)}, 500)

    # ---------- 场景内操作 ----------
    def _require_stepper(self):
        if STATE.stepper is None:
            raise KeyError("没有进行中的场景，请先开始一个场景")
        return STATE.stepper

    def _cmd(self, data):
        st = self._require_stepper()
        prev_task = st.session.current_task()
        out = st.step(data.get("text", ""))
        _stats(STATE.profile, "commands")
        if out["task_done"] and prev_task is not None and prev_task.lesson:
            _mark_learned(STATE.profile, prev_task.lesson)   # 任务完成 = 掌握该知识点
        E.save_profile(STATE.profile)
        self._ok({
            "text": out["text"], "messages": out["messages"],
            "task_done": out["task_done"], "all_done": out["all_done"],
            "score": out["score"], "state": out["state"],
            "task": _task_info(st), "dashboard": _dashboard(st),
            "prompt": _prompt(st),
            "event": _maybe_event(st),
        })

    def _hint(self):
        st = self._require_stepper()
        t = st.session.current_task()
        st.session.hint_used = True
        _stats(STATE.profile, "hints")
        hint = t.hints[0] if t and t.hints else "（这道题没有提示）"
        self._ok({"hint": hint})

    def _skip(self):
        st = self._require_stepper()
        t = st.session.current_task()
        if t:
            E._complete_task(st.session, t, skipped=True)
            E.save_profile(STATE.profile)
        self._ok({"task": _task_info(st), "messages": "\n".join(st.io.out)})

    def _coffee(self):
        st = self._require_stepper()
        E._drink_coffee(STATE.profile, st.session)
        _stats(STATE.profile, "coffees")
        E.save_profile(STATE.profile)
        self._ok({"messages": "\n".join(st.io.out)})

    def _learn(self):
        st = self._require_stepper()
        t = st.session.current_task()
        if t and t.lesson and t.lesson in lessons.TOPICS:
            title, lines = lessons.TOPICS[t.lesson]
            _mark_learned(STATE.profile, t.lesson)
            E.save_profile(STATE.profile)
            self._ok({"title": title, "lines": lines, "category": lessons.topic_category(t.lesson)})
        else:
            self._ok({"title": None, "lines": []})

    def _code_run(self, data):
        """算法编辑器判题：保存代码 → 判分 → 完成对应任务。"""
        st = self._require_stepper()
        sid = data.get("sid", "")
        code = data.get("code", "")
        _write_solution(sid, code)
        try:
            passed, total, results = st.scenario.grade_problem(sid, code)
        except Exception as exc:  # noqa: BLE001
            self._send_json({"error": str(exc)}, 400)
            return
        task_done = False
        t = st.session.current_task()
        if passed == total and t and t.check(st.session, f"submit {sid}"):
            E._complete_task(st.session, t)
            task_done = True
        E.save_profile(STATE.profile)
        self._ok({
            "passed": passed, "total": total,
            "results": [{"ok": ok, "actual": actual, "expected": expected, "error": err}
                        for _, ok, actual, expected, err in results],
            "task_done": task_done, "all_done": st.session.all_done(),
            "task": _task_info(st), "state": st.observe(),
            "messages": "\n".join(st.io.out),
        })


def create_server(port=8766):
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def _open_browser(url):
    """打开浏览器（只调用一次）；失败时打印网址兜底。"""
    try:
        ok = webbrowser.open(url)
    except Exception:  # noqa: BLE001
        ok = False
    if not ok:
        print(f"  ⚠ 未能自动打开浏览器，请手动访问：{url}")


def run(port=8766, open_browser=True):
    T.enable_ansi()
    T.ENABLE_COLOR = False
    E.T.ENABLE_COLOR = False
    if not os.path.isdir(WEB_DIR):
        print(f"[web] 找不到 web 目录：{WEB_DIR}")
        return
    server = create_server(port)
    url = f"http://127.0.0.1:{port}"
    print(f"  DevSaga 网页版已启动：{url}")
    print("  浏览器应已自动打开；关闭此窗口即停止服务。")
    if open_browser:
        threading.Timer(0.8, lambda: _open_browser(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  服务已停止。")
    finally:
        server.server_close()
