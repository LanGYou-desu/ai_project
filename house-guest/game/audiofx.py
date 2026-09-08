# -*- coding: utf-8 -*-
"""
audiofx.py — 程序化音效（winsound 蜂鸣，线程化避免卡 UI）
"""
from __future__ import annotations
import threading

try:
    import winsound
except Exception:  # 非 Windows
    winsound = None


def _beep(freq: int, dur: int) -> None:
    if winsound:
        try:
            winsound.Beep(freq, dur)
        except Exception:
            pass


def play(seq, async_ok: bool = True) -> None:
    """seq: [(freq, dur), ...]"""
    def _do():
        for f, d in seq:
            _beep(f, d)
    if async_ok:
        threading.Thread(target=_do, daemon=True).start()
    else:
        _do()


def success() -> None:
    play([(880, 90), (1174, 90), (1568, 160)])


def wrong() -> None:
    play([(220, 140), (180, 200)])


def glitch() -> None:
    play([(120, 60), (90, 60), (140, 60), (70, 120)])


def chime() -> None:
    play([(660, 100), (990, 180)])


def creepy() -> None:
    play([(160, 250), (130, 350)])


def boop() -> None:
    play([(600, 60)])
