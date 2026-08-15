"""场景 6：算法竞技场 —— 真正的编码挑战。

玩家在自己熟悉的编辑器里写 Python 函数，保存到工作区文件，
然后回到游戏里用 submit 提交判题（沙箱隔离执行 + 隐藏测试用例）。
"""

import os

from .. import engine as E
from .. import sandbox
from .. import terminal as T
from .base import CommandError, Scenario, Task

PROBLEMS = [
    {
        "id": "two_sum",
        "title": "两数之和",
        "difficulty": 1,
        "desc": "给定整数列表 nums 和目标值 target，返回两个数（下标）之和等于 target 的下标列表。\n假设只有一组答案。",
        "func": "def two_sum(nums, target):",
        "example": "输入：nums=[2,7,11,15], target=9 → 返回 [0, 1]（因为 2+7=9）",
        "tests": [(([2, 7, 11, 15], 9), [0, 1]),
                  (([3, 2, 4], 6), [1, 2]),
                  (([3, 3], 6), [0, 1]),
                  (([-1, -2, -3], -5), [1, 2])],
        "hint": "遍历时把 target-x 记在字典里，O(n)。",
        "lesson": "algo_twosum",
    },
    {
        "id": "is_palindrome",
        "title": "回文判断",
        "difficulty": 1,
        "desc": "判断字符串 s 是否是回文（忽略大小写和空格）。返回 True/False。",
        "func": "def is_palindrome(s):",
        "example": "is_palindrome('A man a plan a canal Panama') → True",
        "tests": [(("racecar",), True),
                  (("hello",), False),
                  (("A man a plan a canal Panama",), True),
                  (("",), True),
                  (("No lemon no melon",), True)],
        "hint": "先清洗：去掉空格、转小写，再和反转比较。",
        "lesson": "algo_twosum",
    },
    {
        "id": "fizzbuzz",
        "title": "FizzBuzz",
        "difficulty": 1,
        "desc": "返回 1..n 的列表：3 的倍数替换为 'Fizz'，5 的倍数替换为 'Buzz'，\n同时是 3 和 5 的倍数替换为 'FizzBuzz'。",
        "func": "def fizzbuzz(n):",
        "example": "fizzbuzz(5) → [1, 2, 'Fizz', 4, 'Buzz']",
        "tests": [((5,), [1, 2, "Fizz", 4, "Buzz"]),
                  ((15,), [1, 2, "Fizz", 4, "Buzz", "Fizz", 7, 8, "Fizz", "Buzz", 11, "Fizz", 13, 14, "FizzBuzz"]),
                  ((1,), [1])],
        "hint": "先判断 15 的倍数，再判断 3 和 5。",
        "lesson": "algo_twosum",
    },
    {
        "id": "brackets",
        "title": "括号匹配",
        "difficulty": 2,
        "desc": "给定只包含 ()[]{} 的字符串 s，判断括号是否正确闭合。",
        "func": "def is_valid(s):",
        "example": "is_valid('()[]{}') → True；is_valid('([)]') → False",
        "tests": [(("()[]{}",), True),
                  (("(]",), False),
                  (("([)]",), False),
                  (("({[]})",), True),
                  (("",), True),
                  (("((()))",), True)],
        "hint": "经典栈：左括号入栈，右括号与栈顶配对。",
        "lesson": "algo_brackets",
    },
    {
        "id": "max_subarray",
        "title": "最大子数组和",
        "difficulty": 2,
        "desc": "给定整数列表 nums，找出和最大的连续子数组，返回其和。",
        "func": "def max_subarray(nums):",
        "example": "max_subarray([-2,1,-3,4,-1,2,1,-5,4]) → 6（子数组 [4,-1,2,1]）",
        "tests": [(([-2, 1, -3, 4, -1, 2, 1, -5, 4],), 6),
                  (([1],), 1),
                  (([-1, -2],), -1),
                  (([5, 4, -1, 7, 8],), 23)],
        "hint": "Kadane 算法：cur = max(x, cur+x)，一路更新最优。",
        "lesson": "algo_maxsub",
    },
    {
        "id": "merge_sorted",
        "title": "合并有序列表",
        "difficulty": 2,
        "desc": "合并两个已升序排列的整数列表 a、b，返回一个新的升序列表。",
        "func": "def merge_sorted(a, b):",
        "example": "merge_sorted([1,2,4],[1,3,4]) → [1,1,2,3,4,4]",
        "tests": [(([1, 2, 4], [1, 3, 4]), [1, 1, 2, 3, 4, 4]),
                  (([], [0]), [0]),
                  (([5], [1, 2]), [1, 2, 5]),
                  (([1, 2, 3], []), [1, 2, 3])],
        "hint": "双指针：谁小取谁；或 a + b 后排序（也行，但 O(n log n)）。",
        "lesson": "algo_maxsub",
    },
    {
        "id": "climb_stairs",
        "title": "爬楼梯",
        "difficulty": 1,
        "desc": "一次可以爬 1 或 2 级台阶，爬到第 n 级一共有多少种方法？返回方法数。",
        "func": "def climb_stairs(n):",
        "example": "climb_stairs(3) → 3（1+1+1 / 1+2 / 2+1）",
        "tests": [((1,), 1),
                  ((2,), 2),
                  ((3,), 3),
                  ((5,), 8),
                  ((10,), 89)],
        "hint": "斐波那契：f(n) = f(n-1) + f(n-2)。",
        "lesson": "algo_dp",
    },
    {
        "id": "is_anagram",
        "title": "字母异位词",
        "difficulty": 1,
        "desc": "判断两个字符串 a、b 是否由相同字符组成（异位词）。忽略大小写。返回 True/False。",
        "func": "def is_anagram(a, b):",
        "example": "is_anagram('anagram','nagaram') → True",
        "tests": [(("anagram", "nagaram"), True),
                  (("rat", "car"), False),
                  (("", ""), True),
                  (("aab", "aba"), True),
                  (("Listen", "Silent"), True)],
        "hint": "排序后比较，或数每个字符出现次数。",
        "lesson": "algo_hash",
    },
    {
        "id": "binary_search",
        "title": "二分查找",
        "difficulty": 2,
        "desc": "在升序列表 nums 中查找 target，返回下标；不存在返回 -1。",
        "func": "def binary_search(nums, target):",
        "example": "binary_search([1,3,5,7,9], 5) → 2",
        "tests": [(([1, 3, 5, 7, 9], 5), 2),
                  (([1, 3, 5, 7, 9], 4), -1),
                  (([1], 1), 0),
                  (([], 5), -1),
                  (([1, 2, 3, 4, 5], 1), 0)],
        "hint": "每次砍掉一半：while low <= high，mid = (low+high)//2。",
        "lesson": "algo_binary",
    },
    {
        "id": "hanoi",
        "title": "汉诺塔",
        "difficulty": 2,
        "desc": "把 n 个盘子从 A 柱移到 C 柱（借助 B），每次只能移动一个且大盘不能压小盘。返回最少移动步数。",
        "func": "def hanoi(n):",
        "example": "hanoi(3) → 7",
        "tests": [((1,), 1),
                  ((2,), 3),
                  ((3,), 7),
                  ((5,), 31),
                  ((8,), 255)],
        "hint": "递归：先把 n-1 个移走，再移最大的，再把 n-1 个移回来。f(n)=2f(n-1)+1。",
        "lesson": "algo_recursion",
    },
    {
        "id": "coin_change",
        "title": "零钱兑换",
        "difficulty": 3,
        "desc": "给定硬币面值列表 coins 和金额 amount，求凑出 amount 所需的最少硬币数；\n无法凑出返回 -1。（每种硬币数量无限）",
        "func": "def coin_change(coins, amount):",
        "example": "coin_change([1,2,5], 11) → 3（5+5+1）",
        "tests": [(([1, 2, 5], 11), 3),
                  (([2], 3), -1),
                  (([1], 0), 0),
                  (([1, 3, 4], 6), 2),
                  (([2, 5, 10, 1], 27), 4)],
        "hint": "DP：dp[i] = min(dp[i-c] + 1)，从 0 到 amount 递推。",
        "lesson": "algo_dp",
    },
    {
        "id": "sliding_max",
        "title": "滑动窗口最大值",
        "difficulty": 3,
        "desc": "给定列表 nums 和窗口大小 k，窗口每次右移一格，返回每个窗口内的最大值组成的列表。",
        "func": "def sliding_max(nums, k):",
        "example": "sliding_max([1,3,-1,-3,5,3,6,7], 3) → [3,3,5,5,6,7]",
        "tests": [(([1, 3, -1, -3, 5, 3, 6, 7], 3), [3, 3, 5, 5, 6, 7]),
                  (([1], 1), [1]),
                  (([1, -1], 1), [1, -1]),
                  (([9, 11], 2), [11]),
                  (([4, -2], 2), [4])],
        "hint": "单调递减双端队列：队首是窗口最大值，O(n)。",
        "lesson": "algo_sliding",
    },
    {
        "id": "reverse_string",
        "title": "反转字符串",
        "difficulty": 1,
        "desc": "返回字符串 s 的反转。",
        "func": "def reverse_string(s):",
        "example": "reverse_string('hello') → 'olleh'",
        "tests": [(("hello",), "olleh"),
                  (("",), ""),
                  (("a",), "a"),
                  (("DevSaga",), "agaSveD"),
                  (("12345",), "54321")],
        "hint": "Python 切片 s[::-1] 一行搞定；面试时再写双指针版。",
        "lesson": "algo_string",
    },
    {
        "id": "contains_duplicate",
        "title": "存在重复元素",
        "difficulty": 1,
        "desc": "给定整数列表 nums，如果任意值出现至少两次返回 True，否则 False。",
        "func": "def contains_duplicate(nums):",
        "example": "contains_duplicate([1,2,3,1]) → True",
        "tests": [(([1, 2, 3, 1],), True),
                  (([1, 2, 3, 4],), False),
                  (([],), False),
                  (([1, 1, 1],), True),
                  (([1, 2, 3, 4, 5],), False)],
        "hint": "set 去重后长度变短 = 有重复；O(n)。",
        "lesson": "algo_set",
    },
    {
        "id": "sqrt_int",
        "title": "整数平方根",
        "difficulty": 2,
        "desc": "实现 int sqrt(n)：返回最大的整数 x 满足 x*x <= n（不导入 math）。",
        "func": "def sqrt_int(n):",
        "example": "sqrt_int(8) → 2（因为 2*2=4 <= 8，3*3=9 > 8）",
        "tests": [((4,), 2),
                  ((8,), 2),
                  ((0,), 0),
                  ((1,), 1),
                  ((100,), 10),
                  ((99,), 9)],
        "hint": "二分查找 0..n 之间的整数；或牛顿迭代。",
        "lesson": "algo_binary",
    },
]

REFERENCES = {
    "two_sum": (
        "def two_sum(nums, target):\n"
        "    seen = {}\n"
        "    for i, x in enumerate(nums):\n"
        "        need = target - x\n"
        "        if need in seen:\n"
        "            return [seen[need], i]\n"
        "        seen[x] = i\n"
        "    return []\n"),
    "is_palindrome": (
        "def is_palindrome(s):\n"
        "    s = ''.join(ch.lower() for ch in s if ch != ' ')\n"
        "    return s == s[::-1]\n"),
    "fizzbuzz": (
        "def fizzbuzz(n):\n"
        "    out = []\n"
        "    for i in range(1, n + 1):\n"
        "        if i % 15 == 0:\n"
        "            out.append('FizzBuzz')\n"
        "        elif i % 3 == 0:\n"
        "            out.append('Fizz')\n"
        "        elif i % 5 == 0:\n"
        "            out.append('Buzz')\n"
        "        else:\n"
        "            out.append(i)\n"
        "    return out\n"),
    "brackets": (
        "def is_valid(s):\n"
        "    st = []\n"
        "    pair = {')': '(', ']': '[', '}': '{'}\n"
        "    for ch in s:\n"
        "        if ch in '([{':\n"
        "            st.append(ch)\n"
        "        elif ch in ')]}':\n"
        "            if not st or st.pop() != pair[ch]:\n"
        "                return False\n"
        "    return not st\n"),
    "max_subarray": (
        "def max_subarray(nums):\n"
        "    cur = best = nums[0]\n"
        "    for x in nums[1:]:\n"
        "        cur = max(x, cur + x)\n"
        "        best = max(best, cur)\n"
        "    return best\n"),
    "merge_sorted": (
        "def merge_sorted(a, b):\n"
        "    i = j = 0\n"
        "    out = []\n"
        "    while i < len(a) and j < len(b):\n"
        "        if a[i] <= b[j]:\n"
        "            out.append(a[i]); i += 1\n"
        "        else:\n"
        "            out.append(b[j]); j += 1\n"
        "    out.extend(a[i:])\n"
        "    out.extend(b[j:])\n"
        "    return out\n"),
    "climb_stairs": (
        "def climb_stairs(n):\n"
        "    a, b = 1, 1\n"
        "    for _ in range(n - 1):\n"
        "        a, b = b, a + b\n"
        "    return b\n"),
    "is_anagram": (
        "def is_anagram(a, b):\n"
        "    a, b = a.lower(), b.lower()\n"
        "    return sorted(a) == sorted(b)\n"),
    "binary_search": (
        "def binary_search(nums, target):\n"
        "    lo, hi = 0, len(nums) - 1\n"
        "    while lo <= hi:\n"
        "        mid = (lo + hi) // 2\n"
        "        if nums[mid] == target:\n"
        "            return mid\n"
        "        if nums[mid] < target:\n"
        "            lo = mid + 1\n"
        "        else:\n"
        "            hi = mid - 1\n"
        "    return -1\n"),
    "hanoi": (
        "def hanoi(n):\n"
        "    return (1 << n) - 1\n"),
    "coin_change": (
        "def coin_change(coins, amount):\n"
        "    dp = [amount + 1] * (amount + 1)\n"
        "    dp[0] = 0\n"
        "    for i in range(1, amount + 1):\n"
        "        for c in coins:\n"
        "            if i >= c:\n"
        "                dp[i] = min(dp[i], dp[i - c] + 1)\n"
        "    return dp[amount] if dp[amount] <= amount else -1\n"),
    "sliding_max": (
        "def sliding_max(nums, k):\n"
        "    from collections import deque\n"
        "    dq = deque()\n"
        "    out = []\n"
        "    for i, x in enumerate(nums):\n"
        "        while dq and nums[dq[-1]] <= x:\n"
        "            dq.pop()\n"
        "        dq.append(i)\n"
        "        if dq[0] <= i - k:\n"
        "            dq.popleft()\n"
        "        if i >= k - 1:\n"
        "            out.append(nums[dq[0]])\n"
        "    return out\n"),
    "reverse_string": (
        "def reverse_string(s):\n"
        "    return s[::-1]\n"),
    "contains_duplicate": (
        "def contains_duplicate(nums):\n"
        "    return len(set(nums)) != len(nums)\n"),
    "sqrt_int": (
        "def sqrt_int(n):\n"
        "    lo, hi = 0, n\n"
        "    while lo <= hi:\n"
        "        mid = (lo + hi) // 2\n"
        "        if mid * mid <= n:\n"
        "            lo = mid + 1\n"
        "        else:\n"
        "            hi = mid - 1\n"
        "    return hi\n"),
}


def reference_code(pid):
    return REFERENCES.get(pid, "")


class AlgoArena(Scenario):
    id = "algo_arena"
    name = "算法竞技场"
    tagline = "真正的战斗开始了。这次没有模拟——你要亲手写出能跑的代码。\n在你自己熟悉的编辑器里写函数，保存后回游戏提交判题。"
    env = "coding-judge（沙箱判题）"
    difficulty = 3
    xp_bonus = 200

    def setup(self):
        self.passed = {}
        self.workspace = E.workspace_dir()
        self.tasks = []
        for p in PROBLEMS:
            pid = p["id"]
            self.tasks.append(Task(
                f"a_{pid}", f"通过《{p['title']}》",
                p["desc"] + f"\n函数签名：{p['func']}\n提交：submit {pid}（判题）",
                check=(lambda s, c, pid=pid: s.scenario.passed.get(pid) is True),
                reward=150, xp=50,
                hints=(f"写一个文件：{os.path.join(self.workspace, pid + '.py')}，\n"
                       "然后在游戏里输入：submit " + pid,),
                lesson=p["lesson"]))

    # ---------------- 命令 ----------------
    def handle(self, cmd, session):
        tokens = cmd.split()
        if not tokens:
            raise CommandError("输入为空")
        c0 = tokens[0].lower()
        if c0 in ("problems", "list"):
            rows = []
            for p in PROBLEMS:
                st = "✅" if self.passed.get(p["id"]) else "⬜"
                rows.append([st, p["id"], p["title"], "★" * p["difficulty"]])
            return T.table(["状态", "ID", "题目", "难度"], rows)
        if c0 == "open":
            pid = tokens[1] if len(tokens) > 1 else ""
            p = self._find(pid)
            return T.box([p["desc"], "", "签名：" + p["func"], "", "示例：" + p["example"]],
                         title=f"题目 {p['id']}：《{p['title']}》", color="cyan")
        if c0 == "example":
            pid = tokens[1] if len(tokens) > 1 else ""
            p = self._find(pid)
            return "示例：" + p["example"]
        if c0 == "hint":
            pid = tokens[1] if len(tokens) > 1 else ""
            p = self._find(pid)
            return T.paint("💡 " + p["hint"], "yellow")
        if c0 == "status":
            done = [p["id"] for p in PROBLEMS if self.passed.get(p["id"])]
            return "已通过：" + ("、".join(done) if done else "（还没有）")
        if c0 == "submit":
            return self._submit(tokens[1:], session)
        if c0 == "help":
            return self.help_text(session)
        raise CommandError("未知命令。可用：problems ｜ open <id> ｜ example <id> ｜ hint <id> ｜ status ｜ submit <id>")

    def _find(self, pid):
        for p in PROBLEMS:
            if p["id"] == pid:
                return p
        raise CommandError(f"没有这道题：{pid}。输入 problems 看题目列表。")

    def grade_problem(self, pid, code):
        """判一道题（网页编辑器模式用）：更新 passed 并返回详细结果。

        返回 (passed, total, results)，results 为
        [(index, ok, actual, expected, error), ...]。
        """
        p = self._find(pid)
        func_name = p["func"].split("(")[0].split()[1]
        passed, total, results = sandbox.grade_function(code, func_name, p["tests"])
        if passed == total:
            self.passed[pid] = True
        return passed, total, results

    def _submit(self, args, session):
        if not args:
            raise CommandError("用法：submit <题目id> [文件路径]")
        pid = args[0]
        p = self._find(pid)
        path = args[1] if len(args) > 1 else self._default_file(pid)
        if not os.path.exists(path):
            raise CommandError(
                f"找不到文件：{path}\n"
                f"请在你的编辑器里写一个文件（函数名：{p['func'].split('(')[0][4:]}），\n"
                f"然后提交：submit {pid} {path}")
        with open(path, "r", encoding="utf-8") as f:
            code = f.read()
        passed, total, results = self.grade_problem(pid, code)
        rows = []
        for i, ok, actual, expected, err in results:
            rows.append(["✅" if ok else "❌", f"用例{i + 1}",
                         repr(actual) if actual is not None else "-",
                         repr(expected), err])
        out = T.table(["结果", "用例", "你的输出", "期望", "说明"], rows)
        if passed == total:
            self.passed[pid] = True
            out += "\n" + T.paint(f"🎉 全部 {total} 个用例通过！《{p['title']}》完成！", "green", "bold")
        else:
            out += "\n" + T.paint(f"通过了 {passed}/{total} 个用例，继续加油！", "yellow")
        return out

    def _default_file(self, pid):
        for f in (os.path.join(self.workspace, pid + ".py"),
                  os.path.join(self.workspace, "solution.py")):
            if os.path.exists(f):
                return f
        return os.path.join(self.workspace, pid + ".py")

    def help_text(self, session):
        return T.box([
            "玩法：在你自己喜欢的编辑器里写函数，保存到 " + self.workspace + " 目录下",
            "  （文件名：<题目id>.py 或 solution.py），然后回来提交判题。",
            "命令：problems 看题目 ｜ open <id> 看题 ｜ example <id> 看示例",
            "     hint <id> 看提示 ｜ status 看进度 ｜ submit <id> [文件] 判题",
            "环境：Python 3.13 沙箱，禁止 import os/subprocess/socket 等（防作弊），超时 2 秒。",
        ], title="算法竞技场说明", color="cyan")

    def solve(self):
        return ["problems"] + [f"open {p['id']}" for p in PROBLEMS] + \
               [f"submit {p['id']}" for p in PROBLEMS]

    def dashboard(self):
        passed_n = sum(1 for p in PROBLEMS if self.passed.get(p["id"]))
        rows = [[("✅" if self.passed.get(p["id"]) else "⬜"),
                 p["id"], p["title"], "★" * p["difficulty"]] for p in PROBLEMS]
        return {"theme": {"icon": "⚙️", "title": "判题工作台", "accent": "#bc8cff"},
                "panels": [
                    {"kind": "kv", "title": "工作区", "items": [
                        ["目录", self.workspace],
                        ["已通过", f"{passed_n}/{len(PROBLEMS)} 题"]]},
                    {"kind": "table", "title": "题目清单", "headers": ["状态", "ID", "题目", "难度"], "rows": rows},
                ]}
