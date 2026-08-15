"""场景 8：容器风暴 —— 微服务全容器化上线，结果连环崩。用 Docker 命令排障。

支持：docker ps / ps -a / images / logs / inspect / start / stop / restart /
update --memory / rm / run / network ls / network connect / exec / stats。
"""

import re
import shlex

from .. import terminal as T
from .base import CommandError, Scenario, Task


def _parse_mem(s):
    """把 '512m' / '2g' / '1024' 解析成 MB。"""
    m = re.fullmatch(r"(\d+)([mgk]?)", s.strip().lower())
    if not m:
        raise CommandError(f"无法解析内存大小：{s}（支持 512m / 1g / 2g）")
    n = int(m.group(1))
    unit = m.group(2)
    if unit == "g":
        return n * 1024
    if unit == "k":
        return n // 1024
    return n


class Container:
    def __init__(self, name, image, status, host_port=None, mem_used=0, mem_limit=512,
                 network="default", log=(), inspect_extra=""):
        self.name = name
        self.image = image
        self.status = status          # running | stopped | exited
        self.host_port = host_port    # "8080:80"
        self.mem_used = mem_used      # MB
        self.mem_limit = mem_limit    # MB
        self.network = network
        self.log = list(log)
        self.inspect_extra = inspect_extra


class ContainerStorm(Scenario):
    id = "container_storm"
    name = "容器风暴"
    tagline = "公司决定拥抱微服务，一夜之间全上了 Docker。\n然后……连环崩。镜像、端口、内存、网络，全都跟你作对。"
    env = "docker（模拟容器环境）"
    difficulty = 2
    xp_bonus = 130

    def setup(self):
        self.ran = set()
        self.images = {
            "nginx:1.24": "42MB",
            "nginx:1.18": "38MB",
            "glitch-app:v2.3": "98MB",
            "mysql:8.0": "320MB",
            "redis:7.0": "45MB",
        }
        self.networks = {"default": ["db-1"], "app-net": ["web-1", "app-1"]}
        self.containers = {
            "web-1": Container("web-1", "nginx:1.24", "running", "8080:80",
                               mem_used=120, mem_limit=512, network="app-net",
                               log=["[nginx] started worker processes",
                                    "[nginx] listening on 0.0.0.0:80",
                                    "[nginx] GET /health 200"]),
            "legacy-web": Container("legacy-web", "nginx:1.18", "running", "8080:80",
                                    mem_used=90, mem_limit=256, network="app-net",
                                    log=["[nginx] 警告：8080 端口已被占用，绑定失败",
                                         "[nginx] 这个容器是三个月前开的，忘了关"]),
            "app-1": Container("app-1", "glitch-app:v2.3", "exited", None,
                               mem_used=0, mem_limit=256, network="app-net",
                               log=["[app] 启动中...",
                                    "[app] 加载配置... OK",
                                    "[app] 分配内存池 2G... 失败",
                                    "[app] Fatal: OutOfMemoryError - memory limit (256M) exceeded",
                                    "[app] 进程退出，退出码 137"],
                               inspect_extra="MemLimit: 256M（应用实际需要 2G）"),
            "db-1": Container("db-1", "mysql:8.0", "running", "3306:3306",
                              mem_used=450, mem_limit=1024, network="default",
                              log=["[mysql] ready for connections"]),
            "cache-1": Container("cache-1", "redis:7.0", "running", "6379:6379",
                                 mem_used=80, mem_limit=256, network="default",
                                 log=["[redis] Ready to accept connections"]),
        }
        self.state.update({"all_ok": False})
        self.tasks = [
            Task("c1", "看看战场",
                 "先看所有容器（包括停止的）。用 docker ps -a 查看。",
                 check=self._ran("docker ps"),
                 hints=("docker ps -a",), lesson="docker_basic"),
            Task("c2", "定位崩溃原因",
                 "app-1 崩了。看它的日志，找到崩溃原因。",
                 check=self._ran("logs app-1"),
                 hints=("docker logs app-1",), lesson="docker_basic"),
            Task("c3", "内存救援",
                 "app-1 的内存限制太小（256M），应用需要 2G。\n用 docker inspect 确认，然后改内存限制并启动它。",
                 check=self._app_recovered,
                 hints=("docker inspect app-1", "docker update --memory 2g app-1", "docker start app-1"),
                 lesson="docker_memory", answer="docker update --memory 2g app-1 && docker start app-1"),
            Task("c4", "端口之争",
                 "legacy-web 和 web-1 抢 8080 端口。旧容器该退休了：停掉 legacy-web。",
                 check=lambda s, c: s.scenario.containers["legacy-web"].status == "stopped",
                 hints=("docker stop legacy-web",), lesson="docker_basic", answer="docker stop legacy-web"),
            Task("c5", "网络孤岛",
                 "app-1 连不上 cache-1——它俩不在一个网络里。把 cache-1 加入 app-net。",
                 check=lambda s, c: "app-net" in s.scenario.containers["cache-1"].network,
                 hints=("docker network ls", "docker network connect app-net cache-1"),
                 lesson="docker_network", answer="docker network connect app-net cache-1"),
            Task("c6", "最终验收",
                 "全部容器就位后，进 web-1 里跑健康检查确认服务正常。",
                 check=lambda s, c: s.scenario.state.get("all_ok"),
                 hints=("docker exec web-1 curl localhost/health",),
                 lesson="docker_basic", answer="docker exec web-1 curl localhost/health"),
        ]

    def _ran(self, kw):
        return lambda s, c: any(kw in x for x in s.scenario.ran)

    def _app_recovered(self, s, c):
        a = s.scenario.containers["app-1"]
        return a.status == "running" and a.mem_limit >= 2048

    def _key_containers_ok(self):
        return all(self.containers[k].status == "running"
                   for k in ("web-1", "app-1", "db-1", "cache-1"))

    # ---------------- 命令 ----------------
    def handle(self, cmd, session):
        self.ran.add(cmd)
        tokens = shlex.split(cmd) if cmd.strip() else []
        if not tokens:
            raise CommandError("输入为空")
        if tokens[0].lower() != "docker":
            raise CommandError(f"{tokens[0]}: 未找到命令。这是 Docker 环境，试试 docker ps")
        args = tokens[1:]
        if not args:
            raise CommandError("docker: 需要子命令。docker ps / docker logs ...")
        sub = args[0]
        rest = args[1:]
        try:
            if sub == "ps":
                return self._cmd_ps("-a" in rest)
            if sub == "images":
                return T.table(["仓库:标签", "大小"],
                               [[k, v] for k, v in self.images.items()])
            if sub == "logs":
                if not rest:
                    raise CommandError("docker logs <容器名>")
                c = self._get(rest[0])
                return "\n".join(c.log) if c.log else "（日志为空）"
            if sub == "inspect":
                if not rest:
                    raise CommandError("docker inspect <容器名>")
                c = self._get(rest[0])
                return (f"容器：{c.name}\n镜像：{c.image}\n状态：{c.status}\n"
                        f"端口：{c.host_port or '无'}\n网络：{c.network}\n"
                        f"内存限制：{c.mem_limit}M（已用 {c.mem_used}M）\n"
                        + (c.inspect_extra + "\n" if c.inspect_extra else ""))
            if sub == "stats":
                rows = [[c.name, c.image, f"{c.mem_used}M / {c.mem_limit}M",
                         f"{c.mem_used / max(c.mem_limit, 1) * 100:.0f}%", c.status]
                        for c in self.containers.values()]
                return T.table(["容器", "镜像", "内存", "使用率", "状态"], rows)
            if sub == "start":
                c = self._get(rest[0])
                if c.host_port and self._port_conflict(c):
                    raise CommandError(f"docker: 端口 {c.host_port.split(':')[0]} 被其他容器占用，先处理冲突")
                c.status = "running"
                c.log.append(f"[docker] 已启动 {c.name}")
                return f"已启动 {c.name} ✅"
            if sub == "stop":
                c = self._get(rest[0])
                c.status = "stopped"
                return f"已停止 {c.name}"
            if sub == "restart":
                c = self._get(rest[0])
                if c.host_port and self._port_conflict(c):
                    raise CommandError(f"docker: 端口 {c.host_port.split(':')[0]} 被占用，重启失败")
                c.status = "running"
                return f"已重启 {c.name}"
            if sub == "update":
                return self._cmd_update(rest)
            if sub == "rm":
                if not rest:
                    raise CommandError("docker rm <容器名>")
                c = self._get(rest[0])
                if c.status == "running":
                    raise CommandError(f"docker: 无法删除运行中的容器 {c.name}，先 stop")
                del self.containers[c.name]
                return f"已删除容器 {c.name}"
            if sub == "run":
                return self._cmd_run(rest)
            if sub == "network":
                return self._cmd_network(rest)
            if sub == "exec":
                return self._cmd_exec(rest)
            if sub == "help":
                return self.help_text(session)
            raise CommandError(f"docker {sub}: 未知子命令（支持 ps/images/logs/inspect/stats/start/stop/restart/update/rm/run/network/exec）")
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"docker: 出错：{exc}")

    def _get(self, name):
        c = self.containers.get(name)
        if c is None:
            raise CommandError(f"docker: 容器 {name} 不存在。docker ps -a 看看有哪些。")
        return c

    def _port_conflict(self, c):
        host_port = c.host_port.split(":")[0] if c.host_port else None
        if not host_port:
            return False
        for other in self.containers.values():
            if other is c or other.status != "running":
                continue
            if other.host_port and other.host_port.split(":")[0] == host_port:
                return True
        return False

    def _cmd_ps(self, all_containers):
        rows = []
        for c in self.containers.values():
            if c.status == "running" or all_containers:
                rows.append([c.name, c.image, c.host_port or "-",
                             f"{c.mem_used}M/{c.mem_limit}M",
                             c.network, c.status])
        if not rows:
            return "（没有容器）"
        return T.table(["容器", "镜像", "端口", "内存", "网络", "状态"], rows)

    def _cmd_update(self, rest):
        if "--memory" not in rest:
            raise CommandError("用法：docker update --memory <大小> <容器名>")
        i = rest.index("--memory")
        if i + 2 >= len(rest):
            raise CommandError("用法：docker update --memory <大小> <容器名>")
        mem = _parse_mem(rest[i + 1])
        name = rest[i + 2]
        c = self._get(name)
        c.mem_limit = mem
        c.log.append(f"[docker] 内存限制更新为 {mem}M")
        return f"已将 {name} 的内存限制更新为 {mem}M（需要 restart/start 生效）"

    def _cmd_run(self, rest):
        name = None
        port = None
        image = None
        i = 0
        while i < len(rest):
            t = rest[i]
            if t == "--name" and i + 1 < len(rest):
                name = rest[i + 1]
                i += 2
            elif t == "-p" and i + 1 < len(rest):
                port = rest[i + 1]
                i += 2
            elif not t.startswith("-"):
                image = t
                i += 1
            else:
                i += 1
        if not image:
            raise CommandError("用法：docker run --name <名> -p <端口> <镜像>")
        if image not in self.images:
            raise CommandError(f"docker: 镜像 {image} 不存在。docker images 看看有哪些。")
        c = Container(name or "unnamed", image, "running", port,
                      mem_limit=512, network="app-net", log=[f"[docker] 容器已创建（{image}）"])
        if name:
            self.containers[name] = c
        return f"已创建并启动容器 {c.name}（{image}）"

    def _cmd_network(self, rest):
        if not rest:
            raise CommandError("docker network ls/connect <网络> <容器>")
        if rest[0] == "ls":
            rows = [[net, "bridge", ", ".join(cs)] for net, cs in self.networks.items()]
            return T.table(["网络", "驱动", "容器"], rows)
        if rest[0] == "connect":
            if len(rest) < 3:
                raise CommandError("docker network connect <网络> <容器>")
            net, name = rest[1], rest[2]
            if net not in self.networks:
                raise CommandError(f"docker: 网络 {net} 不存在")
            c = self._get(name)
            self.networks[net].append(c.name)
            c.network = net
            return f"已将 {name} 接入网络 {net} ✅"
        raise CommandError("docker network: 支持 ls / connect")

    def _cmd_exec(self, rest):
        if len(rest) < 2:
            raise CommandError("docker exec <容器名> <命令>")
        name = rest[0]
        c = self._get(name)
        if c.status != "running":
            raise CommandError(f"docker: 容器 {name} 未运行")
        inner = " ".join(rest[1:])
        if name == "web-1" and "curl" in inner:
            if self._key_containers_ok():
                self.state["all_ok"] = True
                return ("HTTP/1.1 200 OK\n"
                        '{"status": "ok", "service": "glitch-app", "version": "2.3.0"}')
            return ("HTTP/1.1 503 Service Unavailable\n"
                    '{"status": "degraded", "detail": "有容器不在运行"}')
        if inner in ("ps", "ls", "cat /etc/os-release"):
            return f"（容器 {name} 里执行了 {inner}，一切正常）"
        raise CommandError(f"docker exec: 暂不支持在 {name} 里执行 {inner}")

    def help_text(self, session):
        return T.box([
            "查看：docker ps [-a] ｜ docker images ｜ docker stats ｜ docker inspect <容器> ｜ docker logs <容器>",
            "操作：docker start/stop/restart <容器> ｜ docker update --memory <大小> <容器> ｜ docker rm <容器>",
            "创建：docker run --name <名> -p <端口> <镜像>",
            "网络：docker network ls ｜ docker network connect <网络> <容器>",
            "执行：docker exec <容器> <命令>（如 curl localhost/health）",
            "内存写法：512m / 1g / 2g",
        ], title="Docker 命令手册", color="cyan")

    def solve(self):
        return [
            "docker ps -a",
            "docker logs app-1",
            "docker inspect app-1",
            "docker update --memory 2g app-1",
            "docker start app-1",
            "docker stop legacy-web",
            "docker network ls",
            "docker network connect app-net cache-1",
            "docker exec web-1 curl localhost/health",
        ]

    def dashboard(self):
        rows = [[c.name, c.image, c.host_port or "-",
                 f"{c.mem_used}M/{c.mem_limit}M", c.network, c.status]
                for c in self.containers.values()]
        return {"theme": {"icon": "🐳", "title": "容器控制台", "accent": "#58a6ff"},
                "panels": [
                    {"kind": "table", "title": "容器", "headers": ["容器", "镜像", "端口", "内存", "网络", "状态"], "rows": rows},
                    {"kind": "kv", "title": "网络", "items": [[net, ", ".join(cs)] for net, cs in self.networks.items()]},
                ]}
