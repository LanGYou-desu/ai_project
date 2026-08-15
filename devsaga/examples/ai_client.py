"""外部 AI 客户端示例：通过 TCP 服务来玩 DevSaga。

启动服务：python main.py --serve 8765
运行本客户端：python examples/ai_client.py [场景ID]

协议：每行一个 JSON。本示例用一个简单策略（参考脚本 + 随机探索）
演示“机器也能玩”。你可以把它换成你自己的 LLM / RL 智能体。
"""

import json
import socket
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def send(sock, obj):
    sock.sendall((json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8"))


def recv(sock):
    line = sock.makefile("r", encoding="utf-8").readline()
    if not line:
        return None
    return json.loads(line)


def play(scenario_id, host="127.0.0.1", port=8765):
    from game.scenarios import new_scenario

    print(f"🤖 AI 客户端连接 {host}:{port}，挑战场景：{scenario_id}")
    sock = socket.create_connection((host, port), timeout=30)

    send(sock, {"type": "reset", "scenario": scenario_id, "profile": "AI-AGENT-1"})
    resp = recv(sock)
    assert resp["ok"], resp
    print("— 对局开始 —")
    print((resp["intro"] or "").strip()[:120] + "...")

    # 简单策略：先用参考脚本，再来几条随机命令展示协议
    scenario = new_scenario(scenario_id)
    commands = list(scenario.solve())
    commands += ["whoami", "ls", "help", "pwd", "date"]

    steps = 0
    for cmd in commands:
        if steps > 60:
            print("（步数上限，结束演示）")
            break
        send(sock, {"type": "step", "text": cmd})
        out = recv(sock)
        if not out or not out.get("ok"):
            print(f"  服务器错误：{out}")
            break
        steps += 1
        state = out["state"]
        text = (out.get("text") or "").strip().splitlines()
        preview = text[0][:80] if text else "(无输出)"
        print(f"  [{state['task_index']}/{state['task_count']}] $ {cmd}  →  {preview}")
        if out.get("task_done"):
            print(f"     ✅ 任务完成！得分 {state['score']}")
        if out.get("all_done"):
            print(f"🎉 场景通关！总分 {state['score']}，经验 {state['xp']}")
            break
    sock.close()


if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else "terminal_master"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
    play(sid, port=port)
