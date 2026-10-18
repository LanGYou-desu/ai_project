"""DevSagaEnv：OpenAI Gym 风格的强化学习接口。

动作 = 一条命令字符串；观察 = 结构化状态；奖励 = 任务进度增量。
让真正的 AI（Q-learning / DQN / LLM agent）能在这个游戏环境里训练。
"""

from . import engine as E


class DevSagaEnv:
    def __init__(self, scenario_id="terminal_master", profile=None):
        self.scenario_id = scenario_id
        self.profile = profile or E.default_profile("RL-AGENT")
        self.stepper = E.Stepper(self.profile, scenario_id)

    def reset(self):
        return self.stepper.reset()

    def step(self, action):
        before = self.stepper.session.task_idx
        out = self.stepper.step(action)
        after = self.stepper.session.task_idx
        reward = (after - before) * 10.0 - 0.05 * len(action) - 0.1
        done = self.stepper.session.all_done()
        return out, reward, done, {}

    def observe(self):
        return self.stepper.observe()

    @property
    def task_count(self):
        return len(self.stepper.session.tasks)
