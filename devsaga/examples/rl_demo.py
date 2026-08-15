"""Q-learning 强化学习演示：让 AI 从零学会玩《终端老兵》。

状态 = (当前任务下标, 子目标标记)。子目标标记用来解决"链式动作"难题：
任务 4 需要先 chmod 再执行 deploy.sh —— 如果状态里不记录"chmod 已做"，
AI 会永远卡在"先执行 deploy.sh"的死循环里（这是 RL 里经典的状态表示问题）。
加上这个标记后，AI 就能学会完整的多步动作链。

运行：python examples/rl_demo.py [回合数]
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game.env import DevSagaEnv

# 候选动作：参考通关命令 + 干扰命令
CHMOD = "chmod +x /opt/app/deploy.sh"
DEPLOY = "/opt/app/deploy.sh"

ACTIONS = [
    "find / -name config.ini",
    "cat /opt/app/config.ini",
    'grep -c " 500 " /opt/app/logs/access.log',
    "tail -n 20 /opt/app/logs/access.log > /opt/app/report.txt",
    CHMOD,
    DEPLOY,
    "mv /opt/app/logs/error.log /opt/app/logs/error_2025.log",
    'find /opt/app -name "*.py" | wc -l',
    # ---- 干扰项 ----
    "ls",
    "pwd",
    "whoami",
    "cat /home/dev/notes.txt",
    "tree /opt/app",
    "grep -c ERROR /opt/app/logs/access.log",
]


def main(episodes=300):
    env = DevSagaEnv("terminal_master")
    q = {}  # (state, action) -> 价值
    alpha, gamma, eps = 0.2, 0.95, 0.6
    eps_min = 0.06
    recent = []

    for ep in range(1, episodes + 1):
        env.reset()
        total = 0.0
        obs = env.observe()
        state = (obs["task_index"], False)
        for _ in range(50):
            if random.random() < eps:
                a = random.randrange(len(ACTIONS))
            else:
                vals = [q.get((state, i), 0.0) for i in range(len(ACTIONS))]
                best = max(vals)
                a = random.choice([i for i, v in enumerate(vals) if v == best])
            action = ACTIONS[a]
            out, reward, done, _ = env.step(action)
            total += reward
            ns_obs = env.observe()
            ns = (ns_obs["task_index"], action == CHMOD)
            old = q.get((state, a), 0.0)
            future = max([q.get((ns, i), 0.0) for i in range(len(ACTIONS))], default=0.0) if not done else 0.0
            q[(state, a)] = old + alpha * (reward + gamma * future - old)
            state = ns
            if done:
                break
        eps = max(eps_min, eps * 0.99)
        recent.append(total)
        if ep % 50 == 0 or ep == episodes:
            avg = sum(recent[-10:]) / min(10, len(recent))
            print(f"回合 {ep:>3}/{episodes}  近10局平均奖励 {avg:6.2f}  ε={eps:.2f}")

    # 最终评估：贪心策略
    env.reset()
    print("\n🧪 最终评估（贪心策略，无探索）：")
    steps = 0
    for step in range(50):
        obs = env.observe()
        state = (obs["task_index"], obs["task_index"] > 0 and _last_was_chmod(env))
        vals = [q.get((state, i), 0.0) for i in range(len(ACTIONS))]
        a = max(range(len(ACTIONS)), key=lambda i: vals[i])
        out, reward, done, _ = env.step(ACTIONS[a])
        steps += 1
        if out["task_done"]:
            print(f"  ✅ 第{steps}步: {ACTIONS[a]}")
        if done:
            print(f"\n🎉 AI 学会了通关《终端老兵》！总得分 {out['score']}，用时 {steps} 步")
            return
    print("（50 步内未通关，增加回合数再试试）")


def _last_was_chmod(env):
    """评估时从执行历史推断子目标标记。"""
    return bool(env.stepper.session.commands_run) and env.stepper.session.commands_run[-1] == CHMOD


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    main(n)
