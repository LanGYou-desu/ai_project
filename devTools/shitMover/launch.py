"""一键启动：选择全部好友或指定用户，设置次数并连续运行。"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "config.json"


def default_count() -> int:
    try:
        data = json.loads(CONFIG.read_text(encoding="utf-8-sig"))
        return max(1, int(data.get("max_posts_per_run", 2)))
    except Exception:
        return 2


def ask_mode() -> str | None:
    print()
    print("请选择搬史模式：")
    print("[1] 全部好友（正常搬史，写入已发送记录）")
    print("[2] 指定 UID（只 @ 指定用户，不写入主已发送记录）")
    print("[3] 退出程序")
    while True:
        try:
            choice = input("请选择 [1/2/3]（默认 1）：").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\n已退出")
            return None
        if choice in {"", "1", "a", "all"}:
            return "all"
        if choice in {"2", "u", "uid"}:
            return "uid"
        if choice in {"3", "q", "quit", "exit"}:
            return None
        print("请输入 1、2 或 3。")


def ask_count(default: int) -> int | None:
    print(f"本次最高搬史次数（直接回车使用 {default}）：")
    while True:
        try:
            raw = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n已取消")
            return None
        if not raw:
            return default
        try:
            count = int(raw)
        except ValueError:
            print("请输入大于 0 的整数。")
            continue
        if count < 1:
            print("次数必须大于 0。")
            continue
        return count


def ask_uids() -> str | None:
    print("请输入要 @ 的 UID（多个用逗号分隔）：")
    while True:
        try:
            raw = input("> ").strip().strip('"').strip("'")
        except (EOFError, KeyboardInterrupt):
            print("\n已取消")
            return None
        parts = [part for part in re.split(r"[,，\s]+", raw) if part]
        if parts and all(part.isdigit() and int(part) > 0 for part in parts):
            return raw
        print("UID 必须是大于 0 的整数，多个用逗号分隔。")


def ask_continue() -> bool:
    print()
    print("[1] 继续搬史（使用相同设置再执行一次）")
    print("[2] 结束程序")
    try:
        choice = input("请选择 [1/2]（默认 2）：").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n已结束")
        return False
    return choice in {"1", "y", "yes", "c", "continue"}


def run_once(count: int, uid_arg: str | None = None) -> int:
    if uid_arg:
        print(f"\n将最多搬史 {count} 个视频（指定 UID 模式），开始搜索...\n")
    else:
        print(f"\n将最多搬史 {count} 个视频，开始搜索...\n")

    command = [
        sys.executable,
        str(ROOT / "shit_mover.py"),
        "run",
        "--posts",
        str(count),
        "--yes",
    ]
    if uid_arg:
        command.extend(["--uid", uid_arg])
    return subprocess.call(command, cwd=str(ROOT))


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 52)
    print(" 搬史工具 - 一键启动")
    print(" 正常模式会跳过已搬运视频；指定 UID 模式不计入主记录")
    print("=" * 52)

    mode = ask_mode()
    if mode is None:
        return 0

    count = ask_count(default_count())
    if count is None:
        return 2

    uid_arg = None
    if mode == "uid":
        uid_arg = ask_uids()
        if uid_arg is None:
            return 2

    while True:
        try:
            code = run_once(count, uid_arg)
        except KeyboardInterrupt:
            print("\n已中断，程序结束。")
            return 0
        print(f"\n本次运行结束（退出码 {code}）。")
        if code == 130:
            print("运行被中断，程序结束。")
            return 0
        if code == 4:
            print(
                "\n触发 B 站风控（HTTP 412 等），程序已停止。"
                "请等待 10-30 分钟后再启动，不要立即重试。"
            )
            return code
        if code != 0:
            print(f"\n本次运行失败（退出码 {code}），程序结束。")
            return code
        if not ask_continue():
            print("程序结束。")
            return 0
        if uid_arg:
            print(
                f"\n继续搬史：本次仍最多 {count} 个视频，"
                f"继续只 @ 指定 UID。"
            )
        else:
            print(f"\n继续搬史：本次仍最多 {count} 个视频。")


if __name__ == "__main__":
    raise SystemExit(main())
