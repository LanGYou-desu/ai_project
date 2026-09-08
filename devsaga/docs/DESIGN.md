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
- 防御：步数上限由难度配置（简单 300 / 标准 200 / 地狱 60），防止脚本死循环；
  `Stepper` 和 `run_scenario` 共用同一套 `apply_command`，行为一致

### 2.3 判题沙箱（game/sandbox.py）

玩家代码多层隔离：

1. AST 静态检查：拒绝 `import os/subprocess/socket/...`、`open/eval/exec`、危险魔法属性，
   以及 `__import__` / `getattr` / `vars` / `globals` 等可绕过的逃逸原语
2. 子进程 `python -I -B`（隔离模式，忽略环境变量）
3. 超时 2s（`subprocess.run(timeout=...)`）
4. 输入截断 20KB、stdout/stderr 截断 20KB；子进程强制 UTF-8 解码（`errors="replace"`）
5. 判题输出用每次随机生成的 nonce 标记，再用 `ast.literal_eval` 解析，
   玩家代码无法通过 `print("DEV_R:...)` 伪造结果

判题两种模式：`grade_function`（函数签名 + 隐藏测试用例）、`grade_stdin`（stdin/stdout，
只有该模式允许 `input()`）。

### 2.4 迷你 SQL 引擎（scenarios/sql_rescue.py）

正则解析子集：`SELECT [DISTINCT] 列 FROM 表 [JOIN 表 ON 条件]* [WHERE 条件]`
`[GROUP BY 列] [ORDER BY 列] [LIMIT n]` + `UPDATE/DELETE/INSERT`。

JOIN 用笛卡尔积 + ON 过滤实现；列解析要点：行内键带 `表名.列名` 前缀，
右表限定的列先查当前行、再回退到右表行（这是最容易出 bug 的地方，见测试
`test_join`）。`WHERE` 的 `AND` 拆分忽略引号内部（`name='a and b'` 不会被拆开）。

写操作为保证数据安全：`UPDATE` 逐行判断命中条件后原地修改，未命中的行保持原样；
`DELETE` 按行位置删除，不会因为重复行内容相同而多删。对应回归测试见
`tests/test_fixes.py::SqlCorrectnessTests`。

### 2.5 迷你 Git（scenarios/git_quest.py）

对象模型：`Commit(hash, msg, parent, files_snapshot)` + 分支指针 + HEAD + index +
stash 栈 + reflog。提交哈希由内容确定（md5），保证同一故事每次开局一致。
支持 log/show/status/checkout/stash/revert/cherry-pick/reset/reflog/diff/merge/edit。

`stash` 用 `path -> content | None` 记录改动，`None` 表示文件被删除，因此
stash/pop 能完整还原“修改 + 删除”两类工作区状态；`revert` 同时处理新增、修改、
删除三类文件；detached HEAD 下 `reset`/`merge` 不会往 `branches[None]` 里写脏数据。

## 3. 人机接口

| 接口 | 入口 | 说明 |
| --- | --- | --- |
| 终端 | `python main.py` | 人类游玩 |
| 机器人 | `--bot [id]` | 用 `Scenario.solve()` 参考脚本驱动引擎 |
| 判题 | `--grade <id> <file>` | 算法题判分 / 命令脚本回放 |
| TCP | `--serve [port]` | JSON-lines 协议，外部 AI 接入 |
| RL | `game.env.DevSagaEnv` | reset/step/observe，动作=命令字符串 |
| 网页版 | `python main.py --web [port]` | 本地 HTTP + JSON API，浏览器游玩（默认 8766） |

## 4. 已知设计取舍

- **solve() 是参考解而非唯一解**：任务检查基于"效果"（状态变化）或"答案"，
  玩家的自由发挥空间很大；机器人只是最短路参考。
- **git merge 冲突模拟省略**：故事里刻意安排无冲突合并（不同文件），
  当前实现是“按提交顺序应用分支独有改动”的简化三方合并，冲突解决留给玩家思考。
- **SQL 引擎是教学子集**：不支持子查询 / CASE / 多语句；报错信息刻意"像真数据库"。
- **Q-learning 演示**：状态 = (任务下标, 子目标标记)，演示了链式动作需要
  正确的状态表示——这是 RL 的经典知识点，注释里写了详细讲解。`main.py` 会自动
  切换 UTF-8 输出；单独运行 `examples/*.py` 时，Windows GBK 控制台建议设置
  `PYTHONUTF8=1`，否则 emoji 可能触发 `UnicodeEncodeError`。

## 5. 2.0 扩充：剧情 / 难度 / 测验 / 新场景

### 5.1 玩法系统（game/engine.py）

- **属性**：`profile["stats"] = {tech, comm, risk}`。小剧场（`maybe_event`）
  和剧情抉择（`maybe_plot`）都会积累属性；每个选项是 `(文本, 属性, 增量)`。
- **结局**：`compute_ending(profile)` 纯数据驱动 —— 通关数 + 属性阈值映射到
  `ENDINGS` 五条路线（技术/沟通/冒险/稳定/实习）；标题到路线的映射统一放在
  `ENDINGS`，新增结局时改这里并补一条 `route()` 分支即可。
- **难度**：`DIFFICULTIES` 配置表（提示阈值 / 步数上限 / 能量消耗 / XP 倍率），
  在 `apply_command`、`run_scenario`、`_complete_task` 三个点接入。
- **成就**：`SCENARIO_ACHIEVEMENTS` 把场景通关映射到专属成就，新增场景
  只需加一行；`algo_perfect` 在算法竞技场全部题目通过时解锁。
- **通关结算**：`finalize_scenario()` 统一负责加分、声望、最佳成绩、场景成就和
  `all_scenarios`，`run_scenario`、`Stepper`（TCP/RL/WebUI）共用且幂等。

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
  `/api/cmd` 逐条执行命令并返回 `{text, messages, task_done, all_done, state, task,
  dashboard, prompt, event}`
- `messages` 来自 Stepper 收集的 `ScriptIO.out`（任务完成提示 + 知识点卡片）
- 随机事件/剧情抉择在 API 层实现（`_maybe_event` / `_apply_plot`），前端弹窗交互；
  触发时把选项存进 `stepper.pending_event`，`_apply_event` 用同一组选项结算，
  避免“看到 A、加成 B”的错位
- 安全边界：`/static/` 路径收敛在 `web/` 内；请求体上限 1MB；算法题 id 必须来自
  内置题库（防止 `sid=../evil` 越界写文件）；HTTP 响应带 `nosniff`
- 通关结算复用 `engine.finalize_scenario`，网页版也会写入 `profile["finished"]`、
  最佳成绩和成就，与终端版存档完全互通
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
7. 跑 `python -m unittest discover -s tests -p "test_*.py"` 保证 85 项全绿

## 7. 质量与安全修复（本轮）

- **SQL 写操作数据丢失**：旧 `UPDATE` 用“命中行”整体替换 `table.rows`，执行一次
  `UPDATE users SET ... WHERE id=7` 会丢掉其余 7 个用户。现在逐行判断命中条件后
  原地修改，未命中行原样保留；`DELETE` 改为按行位置删除。回归测试：
  `tests/test_fixes.py::SqlCorrectnessTests`。
- **WebUI 路径穿越 / 越界写文件**：`/static/%2e%2e/README.md` 以前可以读到 `web/` 之外；
  `/api/code/run` 的 `sid` 以前直接拼进工作区文件名，`sid=../evil` 可以写到工作区外。
  现在静态路径必须落在 `web/` 内，算法题 id 必须在 `PROBLEMS` 白名单内，并加 1MB
  请求体上限。回归测试：`tests/test_webui.py::test_static_path_traversal_blocked`、
  `test_request_body_limit`、`test_code_run_rejects_path_traversal`。
- **沙箱逃逸**：旧 AST 检查只拦 `import os` 和 `open()`，但 `__import__('os')`、
  `getattr(__builtins__, '__import__')`、`vars()` 等都能绕过。现在把这些逃逸原语
  列入黑名单；判题结果用随机 nonce 标记 + `ast.literal_eval` 解析，防止玩家用
  `print` 伪造判题输出。回归测试：`tests/test_fixes.py::SandboxHardeningTests`。
- **网页版通关不落档**：旧实现只有 `run_scenario` 做通关结算，WebUI/TCP 用 `Stepper`
  直接逐步执行，通关后 `profile["finished"]`、最佳成绩、场景成就都不会更新。
  现在统一调用幂等的 `engine.finalize_scenario`。回归测试：
  `tests/test_webui.py::test_web_completion_persists_profile`、
  `tests/test_fixes.py::EnginePersistenceTests::test_finalize_scenario_is_idempotent`。
- **随机事件选项错位**：WebUI 触发事件时随机一组选项，结算时又随机一次，导致
  玩家选第 2 项却按另一组选项加属性。现在把选项存进 `stepper.pending_event`，
  结算使用同一组。回归测试：`tests/test_fixes.py::WebEventConsistencyTests`。
- **存档与编码健壮性**：存档改为临时文件 + `os.replace` 原子写入；损坏/非 JSON
  对象的存档安全回退；`load_profile` 合并 `settings`/`stats` 并保留
  `learned_topics`/`web_stats`。stdout/stderr 启动时切到 UTF-8，避免 GBK 控制台
  因 emoji 抛 `UnicodeEncodeError`。
- **其他一致性修复**：`parser.tokenize` 处理未闭合引号（`log search ' OR` 不再抛
  `ValueError`）；终端 VFS 的 `ls -l <路径>`、`rm -r`、目录 `mv`/`cp`、`chmod +x`
  行为修正；终端 UI 按 ANSI 可见宽度排版；`--grade algo_arena` 只判文件里实际
  定义的题目函数；`main.py` 对未知场景/非法端口给出友好错误。
