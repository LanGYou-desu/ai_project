# -*- coding: utf-8 -*-
"""
state.py — 存档与"它知道你的事"（本地指标）
全部数据只存在项目目录下的 save/game.json，不联网。
"""
from __future__ import annotations
import datetime
import json
import os
import socket
from typing import Dict, List, Optional


class State:
    def __init__(self, save_path: str):
        self.save_path = save_path
        self.player_name = '主人'
        self.chapter = 1
        self.inventory: List[str] = []
        self.treasures_found: List[int] = []   # 已完成的章节号
        self.eggs: List[int] = []              # 咕噜彩蛋
        self.flags: Dict[str, object] = {}
        self.endings: List[str] = []
        self.metrics = {
            'launches': 0,
            'first_visit': '',
            'last_visit': '',
            'total_minutes': 0,
        }
        self.daily = {'days_met': 0, 'last_day': '', 'pranks_today': []}
        self._session_start: Optional[datetime.datetime] = None
        self._loaded = False

    # ---------------- 存取 ----------------
    @classmethod
    def load(cls, save_path: str) -> 'State':
        st = cls(save_path)
        if os.path.exists(save_path):
            try:
                with open(save_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                st.player_name = data.get('player_name', '主人')
                st.chapter = int(data.get('chapter', 1))
                st.inventory = list(data.get('inventory', []))
                st.treasures_found = [int(x) for x in data.get('treasures_found', [])]
                st.eggs = [int(x) for x in data.get('eggs', [])]
                st.flags = dict(data.get('flags', {}))
                st.endings = list(data.get('endings', []))
                st.metrics.update(data.get('metrics', {}))
                st.daily.update(data.get('daily', {}))
                st._loaded = True
            except Exception:
                pass
        return st

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.save_path), exist_ok=True)
        data = {
            'player_name': self.player_name,
            'chapter': self.chapter,
            'inventory': self.inventory,
            'treasures_found': self.treasures_found,
            'eggs': self.eggs,
            'flags': self.flags,
            'endings': self.endings,
            'metrics': self.metrics,
            'daily': self.daily,
        }
        with open(self.save_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=1)

    # ---------------- 生命周期 ----------------
    def on_launch(self) -> None:
        now = datetime.datetime.now()
        self.metrics['launches'] = self.metrics.get('launches', 0) + 1
        if not self.metrics.get('first_visit'):
            self.metrics['first_visit'] = now.strftime('%Y-%m-%d %H:%M')
        self.metrics['last_visit'] = now.strftime('%Y-%m-%d %H:%M')
        self._session_start = now
        # 每日陪伴天数
        today = now.strftime('%Y-%m-%d')
        if self.daily.get('last_day') != today:
            if self.daily.get('last_day'):
                self.daily['days_met'] = self.daily.get('days_met', 0) + 1
            self.daily['last_day'] = today
            self.daily['pranks_today'] = []
        self.save()

    def on_close(self) -> None:
        if self._session_start:
            mins = int((datetime.datetime.now() - self._session_start).total_seconds() // 60)
            if mins < 1:
                mins = 1
            self.metrics['total_minutes'] = self.metrics.get('total_minutes', 0) + mins
            self._session_start = None
        self.save()

    # ---------------- 真实本机信息（用于"它知道你"） ----------------
    def real_facts(self) -> List[str]:
        facts = []
        now = datetime.datetime.now()
        facts.append('现在的时间是 ' + now.strftime('%Y-%m-%d %H:%M'))
        facts.append('你启动这个系统已经 ' + str(self.metrics.get('launches', 0)) + ' 次了')
        mins = self.metrics.get('total_minutes', 0)
        facts.append('你累计在这里待了 ' + str(mins) + ' 分钟')
        if self.metrics.get('first_visit'):
            facts.append('你第一次来是 ' + str(self.metrics['first_visit']))
        if self.metrics.get('last_visit'):
            facts.append('你上一次离开是 ' + str(self.metrics['last_visit']))
        try:
            facts.append('这台电脑的用户名是 ' + os.getlogin())
        except Exception:
            pass
        try:
            facts.append('电脑名字叫 ' + socket.gethostname())
        except Exception:
            pass
        return facts

    def write_access_logs(self, systemdir) -> None:
        """每次启动把真实本地指标写进虚拟系统的日志文件（玩家能真的读到）。"""
        now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        lines = [
            '访问记录（GLOW-OS 内部）',
            '--------------------------------',
            '生成时间: ' + now,
            '玩家: ' + self.player_name,
            '启动次数: ' + str(self.metrics.get('launches', 0)),
            '累计停留: ' + str(self.metrics.get('total_minutes', 0)) + ' 分钟',
            '上次离开: ' + str(self.metrics.get('last_visit', '—')),
            '第一次见面: ' + str(self.metrics.get('first_visit', '—')),
            '--------------------------------',
            '（这些数据只存在这台电脑的本地存储里。',
            self.player_name + '，我一直看着你。）',
        ]
        content = '\n'.join(lines) + '\n'
        for rel in ['Logs/access.log', 'Windows/System32/access.log']:
            try:
                systemdir.write_file(rel, content, year=2003)
            except Exception:
                pass

    # ---------------- 便捷 ----------------
    def has_key(self, key: str) -> bool:
        return key in self.inventory

    def give_key(self, key: str) -> None:
        if key not in self.inventory:
            self.inventory.append(key)
            self.save()

    def chapter_done(self) -> bool:
        return self.chapter in self.treasures_found

    def complete_chapter(self, n: int) -> None:
        if n not in self.treasures_found:
            self.treasures_found.append(n)
        if n >= self.chapter and n < 12:
            self.chapter = n + 1
        self.save()

    def egg_found(self, n: int) -> bool:
        return n in self.eggs

    def add_egg(self, n: int) -> None:
        if n not in self.eggs:
            self.eggs.append(n)
            self.save()
