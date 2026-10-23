#!/usr/bin/env python
"""自动搬史程序入口。

用法：
    python shit_mover.py login
    python shit_mover.py scan --keyword 抽象
    python shit_mover.py run --dry-run
    python shit_mover.py run
    python shit_mover.py run --uid 123456
"""

from shitmover.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
