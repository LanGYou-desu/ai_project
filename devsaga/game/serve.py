"""TCP JSON 服务：让任何外部程序 / AI 通过网络来玩 DevSaga。

协议：每行一个 JSON 请求，服务端每行回一个 JSON 响应。
  {"type":"list"}                        -> 场景列表
  {"type":"reset","scenario":"terminal_master"}  -> 开始新对局（每个连接一个对局）
  {"type":"observe"}                     -> 当前状态快照
  {"type":"step","text":"ls"}            -> 执行一条命令
示例客户端见 examples/ai_client.py。
"""

import json
import socketserver
import threading

from . import engine as E
from . import terminal as T
from .scenarios import ALL_SCENARIOS


class GameHandler(socketserver.StreamRequestHandler):
    def setup(self):
        super().setup()
        self.stepper = None
        self.profile = E.default_profile("AI-AGENT")

    def handle(self):
        for raw in self.rfile:
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                resp = self.dispatch(req)
            except json.JSONDecodeError:
                resp = {"ok": False, "error": "JSON 解析失败"}
            except Exception as exc:  # noqa: BLE001
                resp = {"ok": False, "error": str(exc)}
            self.wfile.write((json.dumps(resp, ensure_ascii=False) + "\n").encode("utf-8"))
            self.wfile.flush()

    def dispatch(self, req):
        t = req.get("type")
        if t == "list":
            return {"ok": True, "scenarios": [
                {"id": s.id, "name": s.name, "difficulty": s.difficulty} for s in ALL_SCENARIOS]}
        if t == "reset":
            sid = req.get("scenario", "terminal_master")
            if sid not in [s.id for s in ALL_SCENARIOS]:
                return {"ok": False, "error": f"未知场景：{sid}"}
            self.profile = E.default_profile(req.get("profile", "AI-AGENT"))
            self.stepper = E.Stepper(self.profile, sid)
            return {"ok": True, "intro": self.stepper.scenario.intro(),
                    "help": self.stepper.scenario.help_text(self.stepper.session),
                    "state": self.stepper.observe()}
        if t == "observe":
            if self.stepper is None:
                return {"ok": False, "error": "请先 reset"}
            return {"ok": True, "state": self.stepper.observe()}
        if t == "step":
            if self.stepper is None:
                return {"ok": False, "error": "请先 reset"}
            text = req.get("text", "")
            out = self.stepper.step(text)
            return {"ok": True, **out}
        return {"ok": False, "error": f"未知请求类型：{t}"}


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def serve(port=8765):
    T.enable_ansi()
    print(f"🤖 DevSaga 机器接口已启动：127.0.0.1:{port}")
    print(f"   协议：每行一个 JSON（见 examples/ai_client.py）")
    print("   按 Ctrl+C 停止服务。")
    with ThreadingServer(("127.0.0.1", port), GameHandler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n服务已停止。")
