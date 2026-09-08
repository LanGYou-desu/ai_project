# -*- coding: utf-8 -*-
"""
overlay.py — 透明桌面悬浮层（tkinter）
- 无边框、置顶、透明色抠图的悬浮窗，盖在真实桌面上
- 幽灵（可拖拽）、对话气泡、任务卡、输入框、章节 HUD、粒子/故障特效
- 记忆游戏 / 反应游戏 / 三选一结局 模态
透明区域不挡鼠标；所有不透明内容由本窗口接收点击。
"""
from __future__ import annotations
import math
import queue
import random
import time
import tkinter as tk
from typing import Callable, Dict, List, Optional

MAGENTA = '#FF00FE'
GHOST_MAIN = '#8b5cf6'
GHOST_DARK = '#5b21b6'
PANEL_BG = '#141428'
PANEL_LINE = '#3b3b6b'
TEXT = '#d8d8f0'
DIM = '#8a8ab0'
PINK = '#f472b6'
CYAN = '#22d3ee'
WARN = '#fbbf24'
DANGER = '#f87171'
OK = '#4ade80'

FONT = ('Microsoft YaHei', 11)
FONT_S = ('Microsoft YaHei', 9)
FONT_MONO = ('Consolas', 11)


class Overlay:
    def __init__(self, on_input: Callable[[str], str],
                 on_choose: Callable[[str], None],
                 on_mini_pass: Callable[[str], None],
                 on_hint: Callable[[], str],
                 on_open_path: Callable[[], None],
                 on_close: Callable[[], None],
                 on_console: Callable[[str], None]):
        self.on_input = on_input
        self.on_choose = on_choose
        self.on_mini_pass = on_mini_pass
        self.on_hint = on_hint
        self.on_open_path = on_open_path
        self.on_close = on_close
        self.on_console = on_console

        self.root = tk.Tk()
        self.root.title('桌灵·房客')
        self.root.overrideredirect(True)
        self.root.attributes('-topmost', True)
        try:
            self.root.attributes('-transparentcolor', MAGENTA)
        except Exception:
            pass
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        self.W, self.H = sw, sh
        self.root.geometry('%dx%d+0+0' % (sw, sh))
        self.root.configure(bg=MAGENTA)

        self.canvas = tk.Canvas(self.root, width=sw, height=sh, bg=MAGENTA,
                                highlightthickness=0, bd=0)
        self.canvas.pack(fill='both', expand=True)

        # 幽灵初始位置：右下角上方一点
        self.gx, self.gy = sw - 260, sh - 300
        self._ghost_items: Dict[str, int] = {}
        self._state = 'normal'
        self._draw_ghost(self.gx, self.gy)
        self._drag_off = (0, 0)
        self._drag_start = None

        self.bubble_text = None
        self.bubble_rect = None
        self._bubble_job = None

        # 粒子
        self._particles: List[Dict] = []
        self._fx_job = None

        # 队列
        self._bubble_q: 'queue.Queue[tuple]' = queue.Queue()
        self._line_q: 'queue.Queue[tuple]' = queue.Queue()
        self._call_q: 'queue.Queue' = queue.Queue()

        self._build_panels()

        # 定时循环
        self._t = 0.0
        self._loop()

        self.root.protocol('WM_DELETE_WINDOW', self._on_close)

    # ================= 幽灵绘制 =================
    def _draw_ghost(self, x: int, y: int) -> None:
        c = self.canvas
        size = 64
        items: Dict[str, int] = {}
        # 主体
        items['body'] = c.create_oval(x - size // 2, y - size // 2 + 6, x + size // 2, y + size // 2 + 14,
                                      fill=GHOST_MAIN, outline='', tags=('ghost', 'body'))
        # 下摆波浪
        items['tail'] = c.create_arc(x - size // 2, y + 2, x + size // 2, y + size // 2 + 26,
                                     start=0, extent=180, style='chord', fill=GHOST_MAIN, outline='', tags=('ghost', 'tail'))
        # 眼睛（正常）
        items['eye_l'] = c.create_oval(x - 16, y - 10, x - 6, y + 2, fill='#0b0b16', outline='', tags=('ghost', 'eye'))
        items['eye_r'] = c.create_oval(x + 6, y - 10, x + 16, y + 2, fill='#0b0b16', outline='', tags=('ghost', 'eye'))
        # 嘴巴（正常：微笑弧）
        items['mouth'] = c.create_arc(x - 10, y + 2, x + 10, y + 14, start=0, extent=180,
                                      style='arc', outline='#0b0b16', width=2, tags=('ghost', 'mouth'))
        # 腮红
        items['blush_l'] = c.create_oval(x - 22, y + 2, x - 13, y + 9, fill=PINK, outline='', tags=('ghost', 'blush'))
        items['blush_r'] = c.create_oval(x + 13, y + 2, x + 22, y + 9, fill=PINK, outline='', tags=('ghost', 'blush'))
        self._ghost_items = items
        c.tag_bind('ghost', '<ButtonPress-1>', self._on_ghost_press)
        c.tag_bind('ghost', '<B1-Motion>', self._on_ghost_drag)
        c.tag_bind('ghost', '<ButtonRelease-1>', self._on_ghost_release)

    def _on_ghost_press(self, ev) -> None:
        self._drag_off = (ev.x - self.gx, ev.y - self.gy)
        self._drag_start = (ev.x, ev.y)

    def _on_ghost_drag(self, ev) -> None:
        self.gx, self.gy = ev.x - self._drag_off[0], ev.y - self._drag_off[1]
        self._move_ghost(self.gx, self.gy)

    def _on_ghost_release(self, ev) -> None:
        if self._drag_start and abs(ev.x - self._drag_start[0]) + abs(ev.y - self._drag_start[1]) < 6:
            self._bubble_q.put(('ghost', None))  # 点了一下幽灵

    def _move_ghost(self, x: int, y: int) -> None:
        c = self.canvas
        c.coords('body', x - 32, y - 26 + 6, x + 32, y + 26 + 14)
        c.coords('tail', x - 32, y + 2, x + 32, y + 26 + 26)
        if self._state == 'scared':
            c.coords('eye_l', x - 18, y - 14, x - 2, y + 4)
            c.coords('eye_r', x + 2, y - 14, x + 18, y + 4)
            c.itemconfigure('mouth', outline=DANGER, start=0, extent=180)
        elif self._state == 'angry':
            c.coords('eye_l', x - 16, y - 10, x - 6, y + 2)
            c.coords('eye_r', x + 6, y - 10, x + 16, y + 2)
            c.itemconfigure('mouth', outline=DANGER, start=180, extent=180)
        else:
            c.coords('eye_l', x - 16, y - 10, x - 6, y + 2)
            c.coords('eye_r', x + 6, y - 10, x + 16, y + 2)
            c.itemconfigure('mouth', outline='#0b0b16', start=0, extent=180)
        c.coords('mouth', x - 10, y + 2, x + 10, y + 14)
        c.coords('blush_l', x - 22, y + 2, x - 13, y + 9)
        c.coords('blush_r', x + 13, y + 2, x + 22, y + 9)
        if self.bubble_rect is not None:
            self._place_bubble(x, y - 90)

    def set_ghost_state(self, state: str) -> None:
        self._state = state
        self._move_ghost(self.gx, self.gy)

    # ================= 气泡 =================
    def _place_bubble(self, x: int, y: int) -> None:
        c = self.canvas
        if self.bubble_rect is not None:
            c.coords(self.bubble_rect, x - 140, y - 20, x + 140, y + 40)
            c.coords(self.bubble_text, x, y + 10)
            c.itemconfigure(self.bubble_rect, state='normal')
            c.itemconfigure(self.bubble_text, state='normal')
        else:
            self.bubble_rect = c.create_rectangle(x - 140, y - 20, x + 140, y + 40,
                                                  fill='#101024', outline=PANEL_LINE, width=1)
            self.bubble_text = c.create_text(x, y + 10, text='', fill=TEXT, font=FONT_S,
                                             width=270, justify='left')

    def show_bubble(self, text: str, tts: bool = True) -> None:
        self._bubble_q.put(('show', (text, tts)))

    def _do_bubble(self, text: str) -> None:
        c = self.canvas
        if self.bubble_rect is None:
            self.bubble_rect = c.create_rectangle(0, 0, 280, 60, fill='#101024', outline=PANEL_LINE, width=1)
            self.bubble_text = c.create_text(0, 0, text='', fill=TEXT, font=FONT_S, width=270, justify='left')
        self._place_bubble(self.gx, self.gy - 100)
        c.itemconfigure(self.bubble_text, text=text)
        c.tag_raise(self.bubble_rect)
        c.tag_raise(self.bubble_text)
        if self._bubble_job:
            self.root.after_cancel(self._bubble_job)
        self._bubble_job = self.root.after(max(4000, 1200 + len(text) * 90), self._hide_bubble)

    def _hide_bubble(self) -> None:
        if self.bubble_rect is not None:
            self.canvas.itemconfigure(self.bubble_rect, state='hidden')
            self.canvas.itemconfigure(self.bubble_text, state='hidden')

    # ================= 面板 =================
    def _build_panels(self) -> None:
        c = self.canvas
        # 任务卡（底部居中）
        self.mission_frame = tk.Frame(c, bg=PANEL_BG, highlightbackground=PANEL_LINE, highlightthickness=1)
        self.mission_title = tk.Label(self.mission_frame, text='', bg=PANEL_BG, fg=CYAN,
                                      font=('Microsoft YaHei', 10, 'bold'), anchor='w')
        self.mission_title.pack(fill='x', padx=10, pady=(6, 2))
        self.mission_text = tk.Label(self.mission_frame, text='', bg=PANEL_BG, fg=TEXT,
                                     font=FONT_S, justify='left', anchor='w', wraplength=560)
        self.mission_text.pack(fill='x', padx=10)
        self.mission_btns = tk.Frame(self.mission_frame, bg=PANEL_BG)
        self.mission_btns.pack(fill='x', padx=10, pady=6)
        self.hint_btn = tk.Button(self.mission_btns, text='💡 提示', command=self._on_hint_click,
                                  bg='#241a4d', fg=TEXT, relief='flat', font=FONT_S, cursor='hand2')
        self.hint_btn.pack(side='left', padx=(0, 6))
        self.open_btn = tk.Button(self.mission_btns, text='📂 打开位置', command=self.on_open_path,
                                  bg='#123a4d', fg=TEXT, relief='flat', font=FONT_S, cursor='hand2')
        self.open_btn.pack(side='left')
        self.hint_label = tk.Label(self.mission_frame, text='', bg=PANEL_BG, fg=WARN,
                                   font=FONT_S, justify='left', anchor='w', wraplength=560)
        self.hint_label.pack(fill='x', padx=10, pady=(0, 6))
        c.create_window(self.W // 2, self.H - 116, window=self.mission_frame, anchor='center')

        # HUD（右上）
        self.hud_frame = tk.Frame(c, bg='#0d0d1e', highlightbackground=PANEL_LINE, highlightthickness=1)
        self.hud_label = tk.Label(self.hud_frame, text='', bg='#0d0d1e', fg=DIM, font=FONT_S)
        self.hud_label.pack(padx=10, pady=5)
        c.create_window(self.W - 12, 12, window=self.hud_frame, anchor='ne')

        # 输入面板（右下）
        self.input_frame = tk.Frame(c, bg=PANEL_BG, highlightbackground=PANEL_LINE, highlightthickness=1)
        self.entry = tk.Entry(self.input_frame, width=34, bg='#0b0b18', fg=TEXT, insertbackground=TEXT,
                              font=FONT, relief='flat')
        self.entry.pack(side='left', padx=6, pady=6, ipady=3)
        self.entry.bind('<Return>', self._on_send)
        send_btn = tk.Button(self.input_frame, text='说', command=self._on_send, bg='#4c1d95', fg='white',
                             relief='flat', font=FONT_S, cursor='hand2')
        send_btn.pack(side='left', padx=(0, 6))
        c.create_window(self.W - 12, self.H - 50, window=self.input_frame, anchor='se')

    def _on_send(self, _ev=None) -> None:
        text = self.entry.get()
        self.entry.delete(0, 'end')
        if not text.strip():
            return
        self.on_console('[你] ' + text)
        reply = self.on_input(text.strip())
        if reply:
            self.show_bubble(reply, tts=True)
            self.on_console('[咕噜] ' + reply)

    def _on_hint_click(self) -> None:
        h = self.on_hint()
        if h:
            self.hint_label.config(text=h)
            self.show_bubble('提示：' + h, tts=False)
            self.on_console('[咕噜] ' + h)

    def set_mission(self, title: str, steps: List[str], show_buttons: bool = True) -> None:
        self.mission_title.config(text=title)
        self.mission_text.config(text='\n'.join('• ' + s for s in steps))
        self.hint_label.config(text='')

    def set_hud(self, text: str) -> None:
        self.hud_label.config(text=text)

    def set_open_target(self, label: str) -> None:
        self.open_btn.config(text=label)

    # ================= 模态：选择 =================
    def show_choice(self, title: str, text: str, options: List[Dict]) -> None:
        c = self.canvas
        self._modal_rect = c.create_rectangle(0, 0, self.W, self.H, fill='#000000', outline='')
        frame = tk.Frame(c, bg='#101024', highlightbackground=GHOST_MAIN, highlightthickness=1)
        tk.Label(frame, text=title, bg='#101024', fg=CYAN, font=('Microsoft YaHei', 15, 'bold')).pack(padx=24, pady=(18, 8))
        tk.Label(frame, text=text, bg='#101024', fg=TEXT, font=FONT, justify='left', wraplength=520).pack(padx=24)
        btns = tk.Frame(frame, bg='#101024')
        btns.pack(padx=24, pady=16)
        for opt in options:
            b = tk.Button(btns, text='%s — %s' % (opt['label'], opt['desc']), width=46,
                          command=lambda oid=opt['id']: self._choose(oid, frame),
                          bg='#241a4d', fg=TEXT, relief='flat', font=FONT_S, cursor='hand2',
                          wraplength=460, justify='left')
            b.pack(pady=4)
        self._modal_window = c.create_window(self.W // 2, self.H // 2, window=frame, anchor='center')

    def _choose(self, oid: str, frame) -> None:
        self._close_modal()
        self.on_choose(oid)

    def _close_modal(self) -> None:
        c = self.canvas
        if getattr(self, '_modal_window', None):
            c.delete(self._modal_window)
            self._modal_window = None
        if getattr(self, '_modal_rect', None):
            c.delete(self._modal_rect)
            self._modal_rect = None

    # ================= 模态：小游戏 =================
    def show_mini_memory(self, start_level: int = 3, max_level: int = 5, on_done=None) -> None:
        c = self.canvas
        self._modal_rect = c.create_rectangle(0, 0, self.W, self.H, fill='#000000', outline='')
        frame = tk.Frame(c, bg='#101024', highlightbackground=GHOST_MAIN, highlightthickness=1)
        title = tk.Label(frame, text='🧠 记忆游戏 — 记住闪过的符号', bg='#101024', fg=CYAN,
                         font=('Microsoft YaHei', 14, 'bold'))
        title.pack(padx=24, pady=(16, 4))
        info = tk.Label(frame, text='', bg='#101024', fg=TEXT, font=FONT)
        info.pack(pady=(0, 10))
        grid = tk.Frame(frame, bg='#101024')
        grid.pack(padx=24, pady=8)
        symbols = ['🟣', '🟢', '🔵', '🟠', '🔴', '⚪', '🟡', '🟤']
        import random as _r
        btns: List[tk.Button] = []
        for i in range(8):
            b = tk.Button(grid, text=symbols[i], width=4, height=2, font=('Segoe UI Emoji', 16),
                          bg='#1a1a36', fg='white', relief='flat', state='disabled', cursor='hand2')
            b.grid(row=i // 4, column=i % 4, padx=4, pady=4)
            btns.append(b)

        state = {'level': start_level, 'seq': [], 'idx': 0, 'locked': True, 'flash_job': None}

        def flash_round():
            seq = [_r.choice(symbols) for _ in range(state['level'])]
            state['seq'] = seq
            state['idx'] = 0
            state['locked'] = True
            for b in btns:
                b.config(state='disabled', bg='#1a1a36')
            info.config(text='记住这 %d 个符号…' % len(seq), fg=WARN)

            def flash(i):
                if i >= len(seq):
                    state['locked'] = False
                    for b in btns:
                        b.config(state='normal')
                    info.config(text='轮到你了！按顺序点击', fg=OK)
                    return
                sym = seq[i]
                for b in btns:
                    if b['text'] == sym:
                        b.config(bg='#4c1d95')
                def unflash():
                    for b in btns:
                        b.config(bg='#1a1a36')
                state['flash_job'] = frame.after(450, lambda: (unflash(), frame.after(250, lambda: flash(i + 1))))
            flash(0)

        def on_click(i):
            if state['locked']:
                return
            b = btns[i]
            if b['text'] == state['seq'][state['idx']]:
                b.config(bg='#14532d')
                state['idx'] += 1
                if state['idx'] >= len(state['seq']):
                    state['level'] += 1
                    if state['level'] > max_level:
                        info.config(text='🎉 全部通过！', fg=OK)
                        for bb in btns:
                            bb.config(state='disabled')
                        _close(True)
                    else:
                        frame.after(700, flash_round)
            else:
                info.config(text='错了，重来！', fg=DANGER)
                state['locked'] = True
                for bb in btns:
                    bb.config(state='disabled')
                state['level'] = start_level
                frame.after(700, flash_round)

        for i, b in enumerate(btns):
            b.config(command=lambda i=i: on_click(i))

        def _close(ok: bool):
            self._close_modal()
            if on_done:
                on_done(ok)

        frame.after(600, flash_round)
        self._modal_window = c.create_window(self.W // 2, self.H // 2, window=frame, anchor='center')

    def show_mini_reaction(self, rounds: int = 5, on_done=None) -> None:
        c = self.canvas
        self._modal_rect = c.create_rectangle(0, 0, self.W, self.H, fill='#000000', outline='')
        frame = tk.Frame(c, bg='#101024', highlightbackground=GHOST_MAIN, highlightthickness=1)
        title = tk.Label(frame, text='⚡ 反应测试 — 等它变绿再点', bg='#101024', fg=CYAN,
                         font=('Microsoft YaHei', 14, 'bold'))
        title.pack(padx=24, pady=(16, 4))
        info = tk.Label(frame, text='', bg='#101024', fg=TEXT, font=FONT)
        info.pack(pady=(0, 10))
        target = tk.Button(frame, text='●', width=8, height=3, font=('Segoe UI', 24),
                           bg='#7f1d1d', fg='white', relief='flat', state='disabled')
        target.pack(padx=24, pady=8)
        import random as _r
        state = {'round': 0, 'lit_at': None, 'hits': 0, 'waiting': True, 'job': None}

        def arm():
            if state['round'] >= rounds:
                info.config(text='🎉 完成！命中 %d/%d' % (state['hits'], rounds), fg=OK)
                _close(True)
                return
            state['waiting'] = True
            target.config(state='disabled', bg='#7f1d1d', text='…')
            info.config(text='第 %d/%d 轮：等它变绿！' % (state['round'] + 1, rounds), fg=WARN)
            delay = 1200 + _r.random() * 1800
            state['job'] = frame.after(int(delay), light)

        def light():
            state['waiting'] = False
            state['lit_at'] = time.time()
            target.config(state='normal', bg='#166534', text='●')

        def click():
            now = time.time()
            if state['waiting']:
                info.config(text='太早了！重来', fg=DANGER)
                state['round'] += 1
                frame.after(600, arm)
                return
            dt = (now - state['lit_at']) * 1000
            state['hits'] += 1
            state['round'] += 1
            info.config(text='命中！%dms' % int(dt), fg=OK)
            frame.after(500, arm)

        target.config(command=click)
        frame.after(600, arm)

        def _close(ok: bool):
            if state.get('job'):
                try:
                    frame.after_cancel(state['job'])
                except Exception:
                    pass
            self._close_modal()
            if on_done:
                on_done(ok)

        self._modal_window = c.create_window(self.W // 2, self.H // 2, window=frame, anchor='center')

    # ================= 结局 =================
    def show_ending(self, title: str, text: str, actions: List[Dict]) -> None:
        c = self.canvas
        self._modal_rect = c.create_rectangle(0, 0, self.W, self.H, fill='#000000', outline='')
        frame = tk.Frame(c, bg='#0d0d1e', highlightbackground=GHOST_MAIN, highlightthickness=2)
        tk.Label(frame, text=title, bg='#0d0d1e', fg=CYAN, font=('Microsoft YaHei', 20, 'bold')).pack(padx=40, pady=(24, 12))
        txt = tk.Label(frame, text=text, bg='#0d0d1e', fg=TEXT, font=FONT, justify='left',
                       wraplength=600, anchor='w')
        txt.pack(padx=40)
        btns = tk.Frame(frame, bg='#0d0d1e')
        btns.pack(pady=20)
        for act in actions:
            b = tk.Button(btns, text=act['label'], command=lambda a=act: self._ending_action(a),
                          bg='#241a4d', fg=TEXT, relief='flat', font=FONT, cursor='hand2')
            b.pack(side='left', padx=6)
        self._modal_window = c.create_window(self.W // 2, self.H // 2, window=frame, anchor='center')

    def _ending_action(self, act: Dict) -> None:
        self._close_modal()
        if act.get('action'):
            act['action']()

    # ================= 特效 =================
    def spawn_particles(self, n: int = 18, color: Optional[str] = None) -> None:
        for _ in range(n):
            x = self.gx + random.randint(-140, 140)
            y = self.gy + random.randint(-90, 90)
            self._particles.append({
                'x': x, 'y': y, 'vx': random.uniform(-1.2, 1.2),
                'vy': random.uniform(-2.4, -0.4), 'life': random.randint(30, 70),
                'max': 70, 'r': random.randint(2, 5),
                'color': color or random.choice([GHOST_MAIN, CYAN, PINK]),
                'id': None,
            })

    def glitch(self, duration_ms: int = 700) -> None:
        c = self.canvas
        self.set_ghost_state('scared')
        end = time.time() + duration_ms / 1000

        def loop():
            if time.time() > end:
                self.set_ghost_state('normal')
                return
            dx = random.randint(-6, 6)
            self._move_ghost(self.gx + dx, self.gy)
            y = random.randint(0, self.H)
            c.create_line(0, y, self.W, y, fill='#ff0055', width=random.randint(1, 3), tags='glitchline')
            self.root.after(50, lambda: c.delete('glitchline'))
            self.root.after(60, loop)

        loop()

    # ================= 主循环 =================
    def _loop(self) -> None:
        self._t += 0.03
        # 幽灵漂浮
        c = self.canvas
        sway = math.sin(self._t * 2.2) * 5
        self._move_ghost(self.gx, self.gy + sway)
        # 粒子
        for p in self._particles:
            p['x'] += p['vx']
            p['y'] += p['vy']
            p['life'] -= 1
            if p['id'] is None:
                p['id'] = c.create_oval(p['x'], p['y'], p['x'] + p['r'], p['y'] + p['r'],
                                        fill=p['color'], outline='', tags='fx')
            else:
                c.coords(p['id'], p['x'], p['y'], p['x'] + p['r'], p['y'] + p['r'])
        self._particles = [p for p in self._particles if p['life'] > 0 and p['id'] is not None]
        for p in self._particles:
            if p['life'] <= 0 and p['id'] is not None:
                c.delete(p['id'])
        # 队列
        try:
            while True:
                fn = self._call_q.get_nowait()
                try:
                    fn()
                except Exception:
                    pass
        except queue.Empty:
            pass
        try:
            while True:
                kind, payload = self._bubble_q.get_nowait()
                if kind == 'show':
                    self._do_bubble(payload[0])
                elif kind == 'ghost':
                    self._on_ghost_clicked()
        except queue.Empty:
            pass
        try:
            while True:
                kind, payload = self._line_q.get_nowait()
                if kind == 'console':
                    self.on_console(payload)
        except queue.Empty:
            pass
        self.root.after(30, self._loop)

    def _on_ghost_clicked(self) -> None:
        reply = self.on_input('(戳了戳咕噜)')
        if reply:
            self.show_bubble(reply, tts=True)

    def console(self, text: str) -> None:
        self._line_q.put(('console', text))

    def later(self, ms: int, fn) -> None:
        """主线程延时执行（tkinter 线程安全）"""
        self.root.after(ms, fn)

    def post(self, fn) -> None:
        """从任意线程投递任务到主线程执行"""
        self._call_q.put(fn)

    def _on_close(self) -> None:
        try:
            self.on_close()
        finally:
            try:
                self.root.destroy()
            except Exception:
                pass

    def run(self) -> None:
        self.root.mainloop()
