# DevSaga 设计文档

## 1. 定位

一个**人机都能玩、都能学**的程序员模拟器：

- 对人类：终端里的职场养成游戏，每个场景是一个真实的开发环境模拟器，
  完成任务后讲解背后的知识点（find、git revert、SQL JOIN、SYN Flood……）。
- 对机器：同一套引擎通过 `ScriptIO` / `Stepper` 暴露给机器人（`--bot`）、
  判题器（`--grade`）、TCP 服务（`--serve`）和 Gym 风格 RL 接口（`game.env`）。

## 2. 核心架构

```
main.py ──▶ engine.run_scenario(profile, scenario, io)
                │                          ▲
                ▼                          │
        scenario.handle(cmd, session) ────┘  任务检查 Task.check(session, cmd)
        profile（XP/声望/能量/成就/存档）
        lessons（知识点卡片）
        events（办公室小剧场）
```

### 2.1 场景框架（game/scenarios/base.py）

```python
class Task:      # 一个任务：title/brief/check/hints/lesson/reward/xp
class Scenario:  # 一个环境：setup() 建初始状态，handle(cmd) 处理命令，solve() 参考脚本
```

- `Task.check(session, cmd)` 返回布尔；答题型任务直接比较玩家输入，效果型任务检查场景内部状态
- 新增场景 = 继承 `Scenario` + 实现 `handle` + 在 `scenarios/__init__.py` 注册

### 2.2 引擎与 IO 抽象（game/engine.py）

- `run_scenario` 是唯一主循环；`apply_command(profile, session, cmd)` 是单命令执行器，
  `Stepper` 基于它提供 reset/step/observe（TCP、RL 用）
- `IO` 抽象：`HumanIO`（交互终端）/ `ScriptIO`（脚本队列，机器人、测试用）
- 防御：步数上限 200，防止脚本死循环

### 2.3 判题沙箱（game/sandbox.py）

玩家代码四层隔离：

1. AST 静态检查：拒绝 `import os/subprocess/socket/...`、`open/eval/exec`、危险魔法属性
2. 子进程 `python -I -B`（隔离模式，忽略环境变量）
3. 超时 2s（`subprocess.run(timeout=...)`）
4. 输出截断 20KB

判题两种模式：`grade_function`（函数签名 + 隐藏测试用例）、`grade_stdin`（stdin/stdout）。

### 2.4 迷你 SQL 引擎（scenarios/sql_rescue.py）

正则解析子集：`SELECT [DISTINCT] 列 FROM 表 [JOIN 表 ON 条件]* [WHERE 条件]`
`[GROUP BY 列] [ORDER BY 列] [LIMIT n]` + `UPDATE/DELETE/INSERT`。

JOIN 用笛卡尔积 + ON 过滤实现；列解析要点：行内键带 `表名.列名` 前缀，
右表限定的列先查当前行、再回退到右表行（这是最容易出 bug 的地方，见测试
`test_join`）。

### 2.5 迷你 Git（scenarios/git_quest.py）

对象模型：`Commit(hash, msg, parent, files_snapshot)` + 分支指针 + HEAD + index +
stash 栈 + reflog。提交哈希由内容确定（md5），保证同一故事每次开局一致。
支持 log/show/status/checkout/stash/revert/cherry-pick/reset/reflog/diff/merge/edit。

## 3. 人机接口

| 接口 | 入口 | 说明 |
| --- | --- | --- |
| 终端 | `python main.py` | 人类游玩 |
| 机器人 | `--bot [id]` | 用 `Scenario.solve()` 参考脚本驱动引擎 |
| 判题 | `--grade <id> <file>` | 算法题判分 / 命令脚本回放 |
| TCP | `--serve [port]` | JSON-lines 协议，外部 AI 接入 |
| RL | `game.env.DevSagaEnv` | reset/step/observe，动作=命令字符串 |

## 4. 已知设计取舍

- **solve() 是参考解而非唯一解**：任务检查基于"效果"（状态变化）或"答案"，
  玩家的自由发挥空间很大；机器人只是最短路参考。
- **git merge 冲突模拟省略**：故事里刻意安排无冲突合并（不同文件），
  冲突解决留给人类玩家思考，代码里留了 TODO。
- **SQL 引擎是教学子集**：不支持子查询 / CASE / 多语句；报错信息刻意"像真数据库"。
- **Q-learning 演示**：状态 = (任务下标, 子目标标记)，演示了链式动作需要
  正确的状态表示——这是 RL 的经典知识点，注释里写了详细讲解。

## 5. 2.0 扩充：剧情 / 难度 / 测验 / 新场景

### 5.1 玩法系统（game/engine.py）

- **属性**：`profile["stats"] = {tech, comm, risk}`。小剧场（`maybe_event`）
  和剧情抉择（`maybe_plot`）都会积累属性；每个选项是 `(文本, 属性, 增量)`。
- **结局**：`compute_ending(profile)` 纯数据驱动 —— 通关数 + 属性阈值映射到
  `ENDINGS` 五条路线（技术/沟通/冒险/稳定/实习）。加结局只需改 `ENDINGS`。
- **难度**：`DIFFICULTIES` 配置表（提示阈值 / 步数上限 / 能量消耗 / XP 倍率），
  在 `apply_command`、`run_scenario`、`_complete_task` 三个点接入。
- **成就**：`SCENARIO_ACHIEVEMENTS` 把场景通关映射到专属成就，新增场景
  只需加一行。

### 5.2 课后测验（game/lessons.py）

`QUIZZES[scenario_id] = [(问题, 选项, 答案字母, 解析), ...]`，每场景 3 题。
`run_quiz` 走标准 IO 抽象（人类 / 机器人 / 测试共用），答对 +10 XP，
满分解锁「学霸」成就。成绩存 `profile["quiz"]`。

### 5.3 新场景三连（Docker / CI/CD / 前端）

- `container_storm`：容器状态机 —— 端口冲突检测、内存限制（`update --memory`）、
  网络接入。OOM 知识：退出码 137。
- `pipeline_deploy`：流水线状态机 —— build/test/lint 依次门禁，`fix <文件>`
  模拟改代码，蓝绿发布 + rollback。
- `frontend_magic`：四个编号问题（JS/事件/盒模型/性能），`fix <n>` 修复，
  `view /` 验收渲染完整性。

三个场景都遵守 `Scenario` 契约：`setup()` 建状态 → `tasks` 定义 → `handle()`
实现命令 → `solve()` 给参考脚本（机器人可通关）。

### 5.4 网页版（game/webui.py + web/）

本地 HTTP 服务（stdlib `http.server`，零依赖），把同一套引擎暴露成 JSON API：

- 会话：`STATE` 持有全局 `profile` + `Stepper`（复用 `engine.Stepper`），
  `/api/cmd` 逐条执行命令并返回 `{text, messages, task_done, all_done, state, task, event}`
- `messages` 来自 Stepper 收集的 `ScriptIO.out`（任务完成提示 + 知识点卡片）
- 随机事件/剧情抉择在 API 层实现（`_maybe_event` / `_apply_plot`），前端弹窗交互
- 前端 `web/`：原生 JS 单页应用，命令面板（`PALETTES` 按场景配置可点按钮）+ 输入框双模式，
  纯鼠标也能玩
- 启动：`python main.py --web`（自动开浏览器）或启动器选项 [1]

## 6. 扩展指南

1. 复制 `game/scenarios/terminal_master.py` 的结构写新场景
2. `setup()` 里建状态 + 定义 `tasks`（每项带 lesson 知识点 key）
3. `handle()` 里实现环境命令；`solve()` 给参考脚本（机器人才能通关）
4. `game/scenarios/__init__.py` 的 `ALL_SCENARIOS` 注册
5. 知识点写进 `game/lessons.py` 的 `TOPICS`；测验写进 `QUIZZES`
6. 专属成就加进 `SCENARIO_ACHIEVEMENTS`
7. 跑 `python -m unittest discover -s tests` 保证全绿
