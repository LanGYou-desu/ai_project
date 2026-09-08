# -*- coding: utf-8 -*-
"""
main.py — 桌灵 · 房客 入口
启动流程：单实例检查 → 加载存档 → 构建/校验虚拟系统目录 → 注入当前章节文件
        → 启动目录观测器 → 启动界面（tkinter 透明悬浮层，不可用时退化为纯文本）
        → 章节状态机
用法：
    python main.py                # 正常启动
    python main.py --name 阿明    # 指定房客名字
    python main.py --reset        # 重置进度并重建虚拟系统
    python main.py --no-tts       # 关闭语音
    python main.py --no-gui       # 不使用图形悬浮层（纯文本界面，适合服务器/非 Windows）
"""
from __future__ import annotations
import errno
import os
import random
import socket
import sys
import threading
import time

# 让 game 包可导入（脚本目录在 sys.path）
BASE = os.path.dirname(os.path.abspath(__file__))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

from game import audiofx, story, tracker as tracker_mod  # noqa: E402
from game.ghost import GhostBrain  # noqa: E402
from game.state import State  # noqa: E402
from game.systemdir import SystemDir, sanitize_name  # noqa: E402
from game.tts import TTS  # noqa: E402

VFSYSTEM_DIR = os.path.join(BASE, 'vfsystem')
SAVE_PATH = os.path.join(BASE, 'save', 'game.json')
PORT = 47321


def single_instance() -> bool:
    """用本地端口占用做单实例锁。

    只有"端口已被占用"才算另一个咕噜在运行；其它错误（权限、协议不支持等）
    不应该阻止启动。
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('127.0.0.1', PORT))
        s.listen(1)
    except OSError as e:
        s.close()
        # 10048 = WSAEADDRINUSE（Windows）
        return e.errno not in (errno.EADDRINUSE, 10048)
    globals()['_lock_sock'] = s  # 保持引用，避免 socket 被 GC 关闭
    return True


def make_ui(game: 'Game', prefer_gui: bool = True):
    """创建界面：优先 tkinter 透明悬浮层；tkinter 缺失/无显示时退化为纯文本界面。"""
    kwargs = dict(
        on_input=game.on_input,
        on_choose=game.on_choose,
        on_hint=game.on_hint,
        on_open_path=game.on_open_path,
        on_close=game.quit,
        on_console=game._console,
    )
    if prefer_gui:
        try:
            from game.overlay import Overlay
            ui = Overlay(**kwargs)
            game.ui_kind = 'gui'
            return ui
        except Exception as e:
            game._console('[系统] 图形界面不可用（%s: %s），改用纯文本模式。'
                          % (type(e).__name__, e))
    from game.console_ui import ConsoleUI
    game.ui_kind = 'console'
    return ConsoleUI(**kwargs)


class Game:
    def __init__(self, player_name: str, tts_enabled: bool = True, prefer_gui: bool = True,
                 vfsystem_dir: str = VFSYSTEM_DIR, save_path: str = SAVE_PATH):
        self.vfsystem_dir = vfsystem_dir
        self.save_path = save_path
        self.prefer_gui = prefer_gui
        self.state = State.load(save_path)
        self.state.player_name = sanitize_name(player_name or self.state.player_name)
        self.state.save()
        self.state.on_launch()
        self.sd = SystemDir(vfsystem_dir)
        self.tts = TTS()
        self.tts.enabled = tts_enabled
        self.ghost = GhostBrain(self.state)
        self.overlay = None  # type: ignore
        self.tracker = None  # type: ignore
        self.ui_kind = 'gui' if prefer_gui else 'console'
        self._ended = False
        self._last_ambient = 0.0
        self._ambient_interval = 90 + random.random() * 120

    # ---------------- 基础设施 ----------------
    def say(self, text: str, tts: bool = True) -> None:
        if not text:
            return
        self._console('[咕噜] ' + text)
        if self.overlay:
            self.overlay.show_bubble(text, tts=False)
        if tts:
            self.tts.speak(text)

    def say_at(self, delay_ms: int, text: str) -> None:
        if self.overlay:
            self.overlay.later(delay_ms, lambda t=text: self.say(t))
        else:
            self.say(text)

    def _console(self, text: str) -> None:
        try:
            print(text, flush=True)
        except Exception:
            pass

    def _ui_call(self, fn) -> None:
        """把界面操作调度到界面线程（tkinter 不是线程安全的）"""
        if self.overlay is not None:
            self.overlay.post(fn)
        else:
            fn()

    # ---------------- 章节流程 ----------------
    def build_system(self) -> None:
        if not os.path.exists(os.path.join(self.vfsystem_dir, 'Windows')):
            os.makedirs(self.vfsystem_dir, exist_ok=True)
            self.sd.build(self.state.player_name)
            self._console('[系统] 虚拟系统目录已创建: vfsystem\\（模拟 C 盘）')

    def reset_game(self) -> None:
        self._console('[系统] 正在重置……')
        name = self.state.player_name
        if self.tracker:
            self.tracker.stop()
            self.tracker = None
        import shutil
        if os.path.exists(self.vfsystem_dir):
            shutil.rmtree(self.vfsystem_dir, ignore_errors=True)
        save_dir = os.path.dirname(self.save_path)
        if save_dir and os.path.exists(save_dir):
            shutil.rmtree(save_dir, ignore_errors=True)
        self.state = State.load(self.save_path)
        # 重置进度但保留玩家名字（否则咕噜会突然开始叫「主人」）
        self.state.player_name = sanitize_name(name)
        self.state.on_launch()
        self.ghost = GhostBrain(self.state)
        self.build_system()
        self.state.write_access_logs(self.sd)
        self.start_tracker()
        self.start_chapter(self.state.chapter)

    def start_tracker(self) -> None:
        self.tracker = tracker_mod.Tracker(
            self.sd, self.state,
            on_stage_done=self.handle_stage_done,
            on_egg=self.handle_egg,
            on_event=self.handle_fs_event,
        )
        self.tracker.start()

    def inject_chapter_files(self, ch_id: int) -> None:
        ch = story.get_chapter(ch_id)
        if not ch:
            return
        files = story.build_inject(ch, self.state.player_name)
        self.sd.inject(files)
        self._console('[系统] 已注入第 %d 章的文件到 vfsystem' % ch_id)

    def start_chapter(self, ch_id: int, delay: int = 600) -> None:
        ch = story.get_chapter(ch_id)
        if not ch:
            self.start_companion(delay)
            return
        self.inject_chapter_files(ch_id)
        act = story.ACTS.get(ch['act'], '')
        if self.overlay:
            self.overlay.set_hud('第 %d/12 章 · %s · 蛋 %d/12' % (ch_id, act, len(self.state.eggs)))
            self.overlay.set_mission(ch['mission']['title'], ch['mission']['steps'])
            self.overlay.set_open_target('📂 ' + ch.get('open_path', 'vfsystem 根目录'))
        if ch['act'] in ('act3', 'act4'):
            if self.overlay:
                self.overlay.glitch(900)
            audiofx.creepy()
        for i, line in enumerate(ch['intro']):
            self.say_at(delay + i * 2600, line)
        if self.overlay:
            self.overlay.spawn_particles(14)

    def handle_stage_done(self) -> None:
        if self.overlay:
            self.overlay.post(self._do_stage_done)
        else:
            self._do_stage_done()

    def _do_stage_done(self) -> None:
        ch = story.get_chapter(self.state.chapter)
        if not ch:
            return
        idx = story.stage_index(self.state)
        audiofx.success()
        if idx >= len(ch.get('stages', [])):
            # 本章完成
            n = ch['id']
            self.state.complete_chapter(n)
            self.state.flags.pop('stage_%d' % n, None)
            self.state.save()
            delay = 400
            for line in ch.get('solved', []):
                self.say_at(delay, line)
                delay += 2400
            if n < 12:
                self.start_chapter(self.state.chapter, delay=delay + 800)
            else:
                self._console('[咕噜] ……该做选择了。')
        else:
            self.say('完成！看看任务卡，下一步是——')
            ch2 = story.get_chapter(self.state.chapter)
            if ch2 and self.overlay:
                self.overlay.set_mission(ch2['mission']['title'], ch2['mission']['steps'])

    def handle_egg(self, n: int) -> None:
        if self.overlay:
            self.overlay.post(lambda: self._do_egg(n))
        else:
            self._do_egg(n)

    def _do_egg(self, n: int) -> None:
        audiofx.chime()
        self._console('[咕噜] 彩蛋 +1！')
        if self.overlay:
            self.overlay.spawn_particles(20, '#fbbf24')
            self.overlay.set_hud(self._hud_text())
        if len(self.state.eggs) == 12:
            self.say('……12 颗蛋，全齐了。我没想到你真的会找到。等一切都结束的时候，我告诉你一个秘密。')
        else:
            self.say('彩蛋 %d/12！你真行，%s。' % (len(self.state.eggs), self.state.player_name))

    def handle_fs_event(self, kind: str, path: str) -> None:
        label = {'created': '新文件', 'removed': '文件消失', 'updated': '文件变化'}.get(kind, kind)
        self._console('[观测台] %s → %s' % (label, path))

    # ---------------- 输入 ----------------
    def on_input(self, text: str) -> str:
        text = text or ''
        low = text.strip().casefold()
        if not low:
            return ''
        # 陪玩（图形模式下才有小游戏；纯文本模式会给出说明）
        if not text.startswith('('):
            if '玩' in low or '游戏' in low or '记忆' in low:
                if self.overlay:
                    self.overlay.show_mini_memory(
                        start_level=3, max_level=5,
                        on_done=lambda ok: self.say(
                            ('赢了！奖励你一个冷笑话：' + random.choice(story.JOKE_LINES)) if ok
                            else '没事，幽灵不记仇（才怪）。'))
                return '来！我出符号，你记顺序，从 3 个开始，到 5 个就赢。'
            if '反应' in low:
                if self.overlay:
                    self.overlay.show_mini_reaction(
                        rounds=5,
                        on_done=lambda ok: self.say('手速不错。' if ok else '……你刚才是在等我说话吗？'))
                return '好，看到变绿就点。别抢跑，我会盯着你。'
        ch = story.get_chapter(self.state.chapter)
        if ch:
            idx = story.stage_index(self.state)
            stage = story.current_stage(ch, idx)
            if stage and stage.get('type') == 'answer' and not text.startswith('('):
                if self._check_answer(stage, text):
                    audiofx.success()
                    self.state.flags['stage_%d' % ch['id']] = idx + 1
                    self.state.save()
                    self.handle_stage_done()
                    return '答对了！'
                audiofx.wrong()
                return '不对哦……再想想。（要提示就发「提示」）'
        reply = self.ghost.respond(text)
        self.tts.speak(reply)
        return reply

    def _check_answer(self, stage, text: str) -> bool:
        answers = stage.get('answers', [])
        t = ''.join(text.split()).casefold()
        for a in answers:
            na = ''.join(a.split()).casefold()
            if t == na:
                return True
            if len(na) >= 2 and na in t:
                return True
        return False

    def on_hint(self) -> str:
        return self.ghost.hint(self.state.chapter)

    def on_open_path(self) -> None:
        ch = story.get_chapter(self.state.chapter)
        target = ''
        if ch:
            target = ch.get('open_path', '')
        elif self.state.flags.get('ending_choice'):
            target = {'A': 'Users/%s/Desktop' % self.state.player_name,
                      'B': 'Temp',
                      'C': 'Windows/System32'}.get(self.state.flags['ending_choice'], '')
        try:
            full = self.sd.full(target)
        except ValueError as e:
            self._console('[系统] 路径被拒绝：%s' % e)
            return
        if os.path.exists(full):
            try:
                os.startfile(full)  # type: ignore[attr-defined]
            except Exception:
                self._console('[系统] 无法自动打开，请手动进入 vfsystem\\%s' % target)
        else:
            self._console('[系统] 目录还不存在：%s' % full)

    # ---------------- 终章选择与结局 ----------------
    def on_choose(self, oid: str) -> None:
        if oid not in story.ENDINGS:
            self._console('[系统] 未知的结局选项：%r' % (oid,))
            return
        self.state.flags['stage_12'] = 1
        self.state.flags['ending_choice'] = oid
        self.state.save()
        audiofx.glitch()
        if self.overlay:
            self.overlay.glitch(1200)
        instr = {
            'A': '好。把 ghost.sys 复制一份到 Users\\%s\\Desktop。它就住进你那儿了。' % self.state.player_name,
            'B': '好。把 ghost.sys 复制一份到 Temp 文件夹（出口）。让它去它想去的地方。',
            'C': '好。把 Windows\\System32 里的 ghost.sys 删掉（Delete 键）。',
        }[oid]
        self.say(instr)
        if self.overlay:
            self.overlay.set_mission('零点之前 · 执行最后一步', [instr])
            self.overlay.set_open_target('📂 ' + {'A': 'Users/%s/Desktop' % self.state.player_name,
                                                  'B': 'Temp',
                                                  'C': 'Windows/System32'}[oid])
            self.overlay.spawn_particles(30)

    def check_ending(self) -> None:
        oid = self.state.flags.get('ending_choice')
        if oid not in story.ENDINGS or self.state.flags.get('ending_done') or not self.tracker:
            return
        op = dict(story.ENDINGS[oid]['file_op'])
        op['to_dir'] = str(op.get('to_dir', '')).replace('{p}', self.state.player_name)
        op['from_dir'] = str(op.get('from_dir', '')).replace('{p}', self.state.player_name)
        if self.tracker.check_ending_action(op):
            self.state.flags['ending_done'] = True
            if oid not in self.state.endings:
                self.state.endings.append(oid)
            if oid == 'A':
                self.state.chapter = 13
            self.state.save()
            audiofx.creepy()
            self.show_ending(oid)

    def show_ending(self, oid: str) -> None:
        if oid not in story.ENDINGS:
            return
        text = story.ENDINGS[oid]['text'].replace('{p}', self.state.player_name)
        title = story.ENDINGS[oid]['title']
        if len(self.state.eggs) >= 12:
            title = story.HIDDEN_ENDING['title']
            text = story.HIDDEN_ENDING['text'] + '\n\n— — —\n\n' + text
        if oid == 'A':
            actions = [
                {'label': '继续 · 陪伴模式', 'action': self.start_companion},
                {'label': '退出', 'action': self.quit},
            ]
        else:
            actions = [
                {'label': '重新开始', 'action': self.reset_game},
                {'label': '退出', 'action': self.quit},
            ]
        if self.overlay:
            self.overlay.show_ending(title, text, actions)
        else:
            self._console(text)
        self._console('—— ' + title + ' ——')

    # ---------------- 陪伴模式 ----------------
    def start_companion(self, delay: int = 0) -> None:
        self.state.chapter = 13
        self.state.save()
        if self.overlay:
            self.overlay.set_hud('陪伴模式 · 已入住 %d 天 · 蛋 %d/12' % (
                self.state.daily.get('days_met', 0), len(self.state.eggs)))
            self.overlay.set_mission('陪伴模式', [
                '咕噜已经搬进你的桌面文件夹，成为常住房客了。',
                '它偶尔会冒出来整蛊、讲笑话、要你陪它玩。',
                '随时可以在输入框跟它聊天（发「玩」可以开小游戏）。',
            ])
            self.overlay.set_open_target('📂 Users/%s/Desktop' % self.state.player_name)
        lines = [
            '（咕噜从你的桌面文件夹里探出头）',
            '这里比系统文件夹亮多了。而且……离你近。',
            '以后的日子，请多指教啦，%s。' % self.state.player_name,
        ]
        for i, line in enumerate(lines):
            self.say_at(delay + i * 2400, line)
        if self.overlay:
            self.overlay.spawn_particles(24)

    # ---------------- 周期任务 ----------------
    def _hud_text(self) -> str:
        ch = self.state.chapter
        if ch > 12:
            return '陪伴模式 · 已入住 %d 天 · 蛋 %d/12' % (self.state.daily.get('days_met', 0), len(self.state.eggs))
        chd = story.get_chapter(ch)
        act = story.ACTS.get(chd['act'], '') if chd else ''
        return '第 %d/12 章 · %s · 蛋 %d/12' % (ch, act, len(self.state.eggs))

    def _tick(self) -> None:
        self.check_ending()
        now = time.time()
        if now - self._last_ambient > self._ambient_interval and not self.state.flags.get('ending_done'):
            self._last_ambient = now
            self._ambient_interval = 120 + random.random() * 120
            line = self.ghost.ambient()
            if line:
                self.say(line, tts=False)
            if random.random() < 0.4 and self.overlay:
                self.overlay.spawn_particles(10)
        if self.state.chapter > 12:
            # 陪伴模式随机整蛊
            if random.random() < 0.02:
                ev = random.choice(story.DAILY_EVENTS)
                self.say(ev, tts=False)
                if self.overlay:
                    self.overlay.spawn_particles(8)
        if self.overlay:
            self.overlay.later(1000, self._tick)

    # ---------------- 输入特殊命令 ----------------
    def _start_console_reader(self) -> None:
        """图形模式下另开一个线程读终端命令（观测台）。"""
        def reader():
            try:
                while not self._ended:
                    line = input()
                    if line and line.strip():
                        self._console_cmd(line.strip())
            except Exception:
                pass
        threading.Thread(target=reader, daemon=True).start()

    def _console_cmd(self, cmd: str) -> None:
        c = cmd.strip().lower()
        if c in ('quit', 'exit', 'q'):
            self._ui_call(self.quit)
        elif c == 'reset':
            self._ui_call(self.reset_game)
        elif c == 'help':
            self._console('命令: 提示 / 解码 <算法> <内容> / 玩 / 反应 / quit / reset')
        else:
            # 其余输入当作与咕噜对话/解谜回答。
            # （原先这些命令只写在帮助里，实际发过去毫无反应。）
            self._ui_call(lambda: self._say_reply(self.on_input(cmd)))

    def _say_reply(self, reply: str) -> None:
        """把一次输入的回复显示出来（观测台 + 气泡）。"""
        if not reply:
            return
        if self.overlay:
            self.overlay.show_bubble(reply, tts=False)
        self._console('[咕噜] ' + reply)

    def quit(self) -> None:
        if self._ended:
            return
        self._ended = True
        self.state.on_close()
        self.state.save()
        self._console('[咕噜] 再见，%s。我等你回来。' % self.state.player_name)
        if self.tracker:
            self.tracker.stop()
            self.tracker = None
        self.tts.shutdown()
        if self.overlay:
            try:
                self.overlay.close()
            except Exception:
                pass

    # ---------------- 启动 ----------------
    def resume(self) -> None:
        """决定启动时展示什么：已完成的结局 / 陪伴模式 / 当前章节。"""
        if self.state.flags.get('ending_done'):
            # 存档里已经走完结局：直接回到结局画面，而不是卡在终章的选择上
            self.show_ending(str(self.state.flags.get('ending_choice') or 'A'))
        elif self.state.chapter > 12:
            self.start_companion(delay=500)
        else:
            self.start_chapter(self.state.chapter, delay=800)

    def run(self) -> None:
        self._console('══════════════════════════════════════')
        self._console('   桌灵 · 房客 — THE HOUSE GUEST')
        self._console('══════════════════════════════════════')
        self._console('（这个控制台是观测台：咕噜说的话、系统事件都会显示在这里）')
        self._console('输入 quit 退出 / reset 重置 / help 帮助')
        self.build_system()
        self.state.write_access_logs(self.sd)
        self.start_tracker()
        self.overlay = make_ui(self, prefer_gui=self.prefer_gui)
        if self.ui_kind == 'gui':
            self._console('[系统] 桌面悬浮层已就绪。看屏幕——咕噜来了。')
            self._start_console_reader()
        else:
            self._console('[系统] 已进入纯文本模式。')
        self._last_ambient = time.time()
        self.resume()
        self.overlay.later(1000, self._tick)
        try:
            self.overlay.run()
        except KeyboardInterrupt:
            pass
        finally:
            if not self._ended:
                self.quit()


def _out(text: str) -> None:
    """在任意终端编码下都不要因为打印中文而崩掉。"""
    try:
        print(text, flush=True)
    except Exception:
        try:
            print(text.encode('ascii', 'replace').decode('ascii'), flush=True)
        except Exception:
            pass


def ask_name() -> str:
    """首次启动时询问玩家名字。

    终端编码不可控（管道、老式代码页），所以：提示单独打印、失败就退回英文，
    读到的内容一律交给 sanitize_name 清洗（代理字符/控制字符都会被丢掉）。
    """
    try:
        print('你叫什么名字？（直接回车用「主人」）> ', end='', flush=True)
    except Exception:
        _out('Your name? (Enter = 主人) > ')
    try:
        if not sys.stdin.isatty():
            # 管道/重定向输入的编码跟随系统代码页（Windows 上常是 GBK），
            # 而项目里的脚本一律用 UTF-8，这里统一按 UTF-8 读。
            sys.stdin.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    try:
        line = input()
    except (EOFError, KeyboardInterrupt):
        line = ''
    return sanitize_name(line)


def main() -> None:
    import argparse
    ap = argparse.ArgumentParser(description='桌灵 · 房客')
    ap.add_argument('--name', default='', help='房客名字')
    ap.add_argument('--reset', action='store_true', help='重置进度并重建虚拟系统')
    ap.add_argument('--no-tts', action='store_true', help='关闭语音')
    ap.add_argument('--no-gui', action='store_true', help='不使用图形悬浮层（纯文本界面）')
    args = ap.parse_args()

    if not single_instance():
        _out('已经有一个咕噜飘在桌面上了。先关掉它，或者看看右下角任务栏。')
        return

    if args.reset:
        import shutil
        for p in (VFSYSTEM_DIR, os.path.join(BASE, 'save')):
            if os.path.exists(p):
                shutil.rmtree(p, ignore_errors=True)
        _out('[系统] 已重置。')

    st = State.load(SAVE_PATH)
    # 注意：没有存档时 State 的默认名字就是「主人」，所以不能只看名字是否为空，
    # 否则首次启动永远不会问玩家名字（README 承诺的首次启动提示会失效）。
    fresh = (not st.loaded) and not os.path.exists(os.path.join(VFSYSTEM_DIR, 'Windows'))
    name = sanitize_name(args.name) if args.name else ''
    if not name and not fresh:
        name = sanitize_name(st.player_name)
    if fresh and not name:
        name = ask_name()

    g = Game(name, tts_enabled=not args.no_tts, prefer_gui=not args.no_gui)
    g.run()


if __name__ == '__main__':
    main()
