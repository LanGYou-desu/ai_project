"""安全沙箱：在隔离的子进程里执行玩家提交的 Python 代码（算法竞技场判题用）。

隔离措施：AST 静态检查（禁危险 import / open / eval / exec / 危险属性）+
subprocess 隔离模式（-I）+ 超时 + 输出长度限制。零第三方依赖。
"""

import ast
import os
import subprocess
import sys
import tempfile

BANNED_IMPORTS = {
    "os", "subprocess", "sys", "socket", "ctypes", "multiprocessing",
    "threading", "shutil", "pathlib", "builtins", "importlib", "io",
    "signal", "asyncio", "pickle", "sqlite3", "http", "urllib", "ftplib",
    "telnetlib", "smtplib", "webbrowser", "glob", "shlex", "platform",
}
BANNED_ATTRS = {"__import__", "__builtins__", "__globals__", "__subclasses__", "__bases__", "__mro__"}
BANNED_NAMES = {"open", "eval", "exec", "compile", "input", "breakpoint", "memoryview"}
MAX_OUTPUT = 20000
DEFAULT_TIMEOUT = 2.0


def validate_code(code):
    """AST 静态检查。返回 (ok, message)。"""
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return False, f"语法错误：第 {exc.lineno} 行 {exc.msg}"
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                top = a.name.split(".")[0]
                if top in BANNED_IMPORTS:
                    return False, f"禁止导入模块：{a.name}"
        elif isinstance(node, ast.ImportFrom):
            if node.module is None:
                return False, "禁止相对导入"
            top = node.module.split(".")[0]
            if top in BANNED_IMPORTS:
                return False, f"禁止导入模块：{node.module}"
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in BANNED_NAMES:
                return False, f"禁止使用：{node.func.id}()"
            if isinstance(node.func, ast.Attribute) and node.func.attr in BANNED_ATTRS:
                return False, f"禁止访问：{node.func.attr}"
        elif isinstance(node, ast.Attribute) and node.attr in BANNED_ATTRS:
            return False, f"禁止访问：{node.attr}"
    return True, None


def _norm(value):
    """把结果归一化以便比较（tuple -> list）。"""
    if isinstance(value, tuple):
        return [_norm(v) for v in value]
    if isinstance(value, list):
        return [_norm(v) for v in value]
    if isinstance(value, dict):
        return {k: _norm(v) for k, v in sorted(value.items(), key=lambda kv: str(kv[0]))}
    if isinstance(value, set):
        return sorted(_norm(v) for v in value)
    return value


def run_code(code, timeout=DEFAULT_TIMEOUT, stdin_text=""):
    """在子进程里执行代码，返回 (ok, output, error)。

    ok=True 表示进程正常退出（无论代码逻辑是否正确），output 为 stdout。
    ok=False 表示编译/运行错误或超时。
    """
    ok, msg = validate_code(code)
    if not ok:
        return False, "", msg
    with tempfile.TemporaryDirectory(prefix="devsaga_") as tmp:
        src = os.path.join(tmp, "solution.py")
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)
        env = dict(os.environ)
        env.pop("PYTHONPATH", None)
        env.pop("PYTHONHOME", None)
        try:
            proc = subprocess.run(
                [sys.executable, "-I", "-B", src],
                input=stdin_text,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env,
                cwd=tmp,
            )
        except subprocess.TimeoutExpired:
            return False, "", f"运行超时（>{timeout}s）"
        except OSError as exc:
            return False, "", f"无法启动沙箱进程：{exc}"
    out = proc.stdout[:MAX_OUTPUT]
    err = proc.stderr.strip()
    if proc.returncode != 0:
        tail = "\n".join(err.splitlines()[-6:]) if err else f"退出码 {proc.returncode}"
        return False, out, tail
    return True, out, ""


def _extract_func(code, func_name):
    """从玩家代码里提取指定函数的源码（用于拼接测试调用）。"""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            return ast.get_source_segment(code, node)
    return None


def grade_function(code, func_name, tests, timeout=DEFAULT_TIMEOUT):
    """判题：tests 为 [(args, expected)]，逐条执行并比较结果。

    返回 (passed, total, feedback_list)。
    feedback_list: [(index, ok, actual, expected, error)]
    """
    func_src = _extract_func(code, func_name)
    if func_src is None:
        return 0, len(tests), [(0, False, None, None, f"没有找到函数 {func_name}()")]

    results = []
    for i, (args, expected) in enumerate(tests):
        probe = (func_src + "\n" +
                 "try:\n"
                 f"    _r = {func_name}(*{args!r})\n"
                 '    print("DEV_R:" + repr(_r))\n'
                 "except Exception as _e:\n"
                 '    print("DEV_E:" + type(_e).__name__ + ":" + str(_e))\n')
        ok, out, err = run_code(probe, timeout=timeout)
        if not ok:
            results.append((i, False, None, expected, err or "运行失败"))
            continue
        line = out.strip().splitlines()[-1] if out.strip() else ""
        if line.startswith("DEV_E:"):
            results.append((i, False, None, expected, line[6:]))
            continue
        if line.startswith("DEV_R:"):
            try:
                actual = eval(line[6:])  # noqa: S307 - 沙箱内已执行，此处只是解析自身输出
            except Exception:
                results.append((i, False, line, expected, "输出无法解析"))
                continue
            ok = _norm(actual) == _norm(expected)
            results.append((i, ok, actual, expected, "" if ok else "结果不匹配"))
        else:
            results.append((i, False, None, expected, "没有产生可判定的输出"))
    passed = sum(1 for _, ok, _, _, _ in results if ok)
    return passed, len(tests), results


def grade_stdin(code, cases, timeout=DEFAULT_TIMEOUT):
    """判题（stdin/stdout 模式）：cases 为 [(stdin_text, expected_stdout)]。"""
    results = []
    for i, (stdin_text, expected) in enumerate(cases):
        ok, out, err = run_code(code, timeout=timeout, stdin_text=stdin_text)
        actual = out.strip()
        expected = expected.strip()
        if ok and actual == expected:
            results.append((i, True, actual, expected, ""))
        else:
            results.append((i, False, actual, expected, err or "输出不匹配"))
    passed = sum(1 for _, ok, _, _, _ in results if ok)
    return passed, len(results), results
