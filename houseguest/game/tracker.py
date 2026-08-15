# -*- coding: utf-8 -*-
"""
tracker.py — 虚拟系统目录观测器
- 每 1.5 秒轮询 vfsystem 的真实目录状态（文件/大小/时间/隐藏属性）
- 检测玩家的真实操作：新建 / 删除 / 改名 / 移动 / 内容写入
- 校验当前章节的 file 型任务目标
- 检测咕噜彩蛋（eggN.txt 被丢进 $Recycle.Bin）
全部只读/只扫描游戏自己的目录，绝不越界。
"""
from __future__ import annotations
import os
import re
import threading
import time
from typing import Callable, Dict, List, Optional, Tuple

from game import story
from game.state import State
from game.systemdir import SystemDir

POLL_INTERVAL = 1.5


def _norm(s: str) -> str:
    return ''.join(str(s).split()).casefold()


def _file_stat(path: str) -> Optional[Dict]:
    try:
        st = os.stat(path)
        hidden = bool(getattr(st, 'st_file_attributes', 0) & 0x2)
        return {'size': st.st_size, 'mtime': st.st_mtime, 'hidden': hidden}
    except Exception:
        return None


def snapshot(sd: SystemDir) -> Dict[str, Dict]:
    """返回 {小写相对路径: stat}"""
    snap: Dict[str, Dict] = {}
    base = sd.cdrive
    for dirpath, dirnames, filenames in os.walk(base):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, base).replace('\\', '/')
            st = _file_stat(full)
            if st is not None:
                snap[rel.casefold()] = st
    return snap


def read_text(path: str) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception:
        return ''


class Tracker:
    def __init__(self, sd: SystemDir, state: State, on_stage_done: Callable[[], None],
                 on_egg: Callable[[int], None], on_event: Optional[Callable[[str, str], None]] = None):
        self.sd = sd
        self.state = state
        self.on_stage_done = on_stage_done
        self.on_egg = on_egg
        self.on_event = on_event
        self._snap: Dict[str, Dict] = {}
        self._stop = False
        self._thread: Optional[threading.Thread] = None
        self._egg_re = re.compile(r'egg(\d+)\.txt')

    # ---------------- 生命周期 ----------------
    def start(self) -> None:
        self._snap = snapshot(self.sd)
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        if self._thread:
            self._thread.join(timeout=3)

    def _loop(self) -> None:
        while not self._stop:
            try:
                self._tick()
            except Exception:
                pass
            time.sleep(POLL_INTERVAL)

    def _tick(self) -> None:
        new = snapshot(self.sd)
        old = self._snap
        # 差异事件
        for path in sorted(set(new) - set(old)):
            self._emit('created', path)
        for path in sorted(set(old) - set(new)):
            self._emit('removed', path)
        for path in sorted(set(new) & set(old)):
            if new[path].get('size') != old[path].get('size') or abs((new[path].get('mtime') or 0) - (old[path].get('mtime') or 0)) > 0.5:
                self._emit('updated', path)
        self._snap = new
        # 彩蛋检测：eggN.txt 出现在 $Recycle.Bin
        self._check_eggs(new)
        # 当前章节 file 目标
        self._check_current_stage()

    def _emit(self, kind: str, path: str) -> None:
        if self.on_event:
            try:
                self.on_event(kind, path)
            except Exception:
                pass

    # ---------------- 彩蛋 ----------------
    def _check_eggs(self, snap: Dict[str, Dict]) -> None:
        for path in snap:
            m = self._egg_re.search(path)
            if m and path.startswith('$recycle.bin/'):
                n = int(m.group(1))
                if not self.state.egg_found(n):
                    self.state.add_egg(n)
                    if self.on_egg:
                        try:
                            self.on_egg(n)
                        except Exception:
                            pass

    # ---------------- 章节目标 ----------------
    def _check_current_stage(self) -> None:
        ch = story.get_chapter(self.state.chapter)
        if not ch:
            return
        idx = story.stage_index(self.state)
        stage = story.current_stage(ch, idx)
        if not stage:
            return
        if stage.get('type') != 'file':
            return
        if self.check_file_objective(stage):
            self._stage_done(ch, idx)

    def _stage_done(self, ch: Dict, idx: int) -> None:
        self.state.flags['stage_%d' % ch['id']] = idx + 1
        self.state.save()
        if self.on_stage_done:
            try:
                self.on_stage_done()
            except Exception:
                pass

    # ---------------- 文件目标校验 ----------------
    def check_file_objective(self, stage: Dict) -> bool:
        op = stage.get('op')
        try:
            if op == 'create_file':
                path = self.sd.full(stage['path'])
                if not os.path.exists(path):
                    return False
                content = _norm(read_text(path))
                for kw in stage.get('contains_list', [stage['contains']]):
                    if _norm(kw) not in content:
                        return False
                return True
            if op == 'move_file':
                name = stage['name']
                in_from = os.path.exists(os.path.join(self.sd.full(stage['from_dir']), name))
                in_to = os.path.exists(os.path.join(self.sd.full(stage['to_dir']), name))
                return (not in_from) and in_to
            if op == 'collect':
                for name in stage['names']:
                    if not os.path.exists(os.path.join(self.sd.full(stage['to_dir']), name)):
                        return False
                return True
            if op == 'delete':
                return not os.path.exists(os.path.join(self.sd.full(stage['from_dir']), stage['name']))
            if op == 'rename':
                return (not os.path.exists(self.sd.full(stage['from']))) and os.path.exists(self.sd.full(stage['to']))
            if op == 'copy_or_move':
                return os.path.exists(os.path.join(self.sd.full(stage['to_dir']), stage['name']))
        except Exception:
            return False
        return False

    # ---------------- 结局文件操作 ----------------
    def check_ending_action(self, op: Dict) -> bool:
        return self.check_file_objective(op)
