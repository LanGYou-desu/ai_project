# -*- coding: utf-8 -*-
"""
test_game_flow.py — 无头（纯文本界面）整局流程
不起 tkinter，也不起观测线程：直接驱动 Game 的方法与 Tracker._tick，
验证"玩家做对了操作 → 章节推进 / 结局触发"这条主线。
"""
import io
import os
import shutil
import tempfile
import unittest
from unittest import mock

import main as main_mod
from game.console_ui import ConsoleUI
from game.tracker import Tracker


class TestGameFlow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = io.StringIO()
        # 不要真的发出 beep
        self._audio = mock.patch.object(main_mod.audiofx, 'play')
        self._audio.start()
        self.g = main_mod.Game(
            '阿明', tts_enabled=False, prefer_gui=False,
            vfsystem_dir=os.path.join(self.tmp.name, 'vfsystem'),
            save_path=os.path.join(self.tmp.name, 'save', 'game.json'))
        self.ui = ConsoleUI(
            on_input=self.g.on_input, on_choose=self.g.on_choose, on_hint=self.g.on_hint,
            on_open_path=self.g.on_open_path, on_close=self.g.quit, on_console=self.g._console,
            stream=self.out)
        self.g.overlay = self.ui
        self.g.build_system()
        # 观测器只创建、不启动线程：测试里用 _tick() 手动推进
        self.g.tracker = Tracker(self.g.sd, self.g.state,
                                 on_stage_done=self.g.handle_stage_done,
                                 on_egg=self.g.handle_egg,
                                 on_event=self.g.handle_fs_event)

    def tearDown(self):
        if self.g.tracker:
            self.g.tracker.stop()
        self.g.quit()
        self.ui.close()
        self._audio.stop()
        self.tmp.cleanup()

    def test_player_name_is_sanitized_in_paths(self):
        self.assertEqual(self.g.state.player_name, '阿明')
        self.assertTrue(os.path.isdir(self.g.sd.full('Users/阿明/Documents')))

    def test_wrong_then_right_answer_advances_chapter(self):
        self.g.start_chapter(1, delay=0)
        self.assertIn('不对', self.g.on_input('随便乱写'))
        self.assertEqual(self.g.state.chapter, 1)
        self.assertEqual(self.g.on_input('[boot loader]'), '答对了！')
        self.assertEqual(self.g.state.chapter, 2)
        # 第 2 章的文件真的被注入到虚拟系统里
        self.assertTrue(os.path.exists(self.g.sd.full('Users/阿明/Documents/薯片.txt')))

    def test_chapter7_answer_unlocks_chapter8_and_puzzle_is_solvable(self):
        self.g.state.chapter = 7
        self.g.state.flags = {}
        self.g.start_chapter(7, delay=0)
        self.assertEqual(self.g.on_input('深夜勿入夜'), '答对了！')
        self.assertEqual(self.g.state.chapter, 8)
        # 按第 8 章要求写入通行证 → 观测器应当判定完成 → 推进到第 9 章
        self.g.sd.write_file('System Volume Information/passport.txt', '深夜勿入夜')
        self.g.tracker._tick()
        self.assertEqual(self.g.state.chapter, 9)
        self.assertTrue(os.path.exists(self.g.sd.full('Recovery/key.key')))

    def test_ending_a_triggered_by_real_file_operation(self):
        self.g.state.chapter = 12
        self.g.start_chapter(12, delay=0)
        self.g.on_choose('A')
        self.assertFalse(self.g.state.flags.get('ending_done'))
        shutil.copy2(self.g.sd.full('Windows/System32/ghost.sys'),
                     self.g.sd.full('Users/阿明/Desktop/ghost.sys'))
        self.g.check_ending()
        self.assertTrue(self.g.state.flags.get('ending_done'))
        self.assertIn('A', self.g.state.endings)
        self.assertEqual(self.g.state.chapter, 13)

    def test_invalid_ending_choice_is_ignored(self):
        self.g.state.flags['ending_choice'] = 'X'
        self.g.check_ending()  # 不应抛 KeyError
        self.assertFalse(self.g.state.flags.get('ending_done'))
        self.g.on_choose('X')  # 不应抛 KeyError
        self.assertEqual(self.g.state.flags.get('ending_choice'), 'X')

    def test_resume_after_finished_ending_shows_ending_again(self):
        """走完 B 结局后重开，不能卡在终章那个已经失效的选择上。"""
        self.g.state.flags['ending_choice'] = 'B'
        self.g.state.flags['ending_done'] = True
        self.g.resume()
        self.assertIsNotNone(self.ui._pending)
        kind, items = self.ui._pending
        self.assertEqual(kind, 'actions')
        self.assertEqual([a['label'] for a in items], ['重新开始', '退出'])

    def test_resume_companion_mode(self):
        self.g.state.chapter = 13
        self.g.resume()
        self.assertEqual(self.g.state.chapter, 13)
        self.assertIn('陪伴模式', self.out.getvalue())

    def test_play_command_does_not_crash_without_gui(self):
        reply = self.g.on_input('玩')
        self.assertIn('记顺序', reply)

    def test_console_command_dispatches_chat(self):
        """观测台里打字（原先只有 quit/reset/help 有效，聊天命令被丢掉）"""
        self.g.state.chapter = 13  # 陪伴模式，没有答案判定，任何输入都走聊天
        self.g._console_cmd('你好')
        self.assertIn('阿明', self.out.getvalue())

    def test_reset_keeps_player_name_and_rebuilds(self):
        self.g.state.chapter = 4
        self.g.state.eggs = [1, 2]
        self.g.state.save()
        self.g.reset_game()
        self.assertEqual(self.g.state.player_name, '阿明')
        self.assertEqual(self.g.state.chapter, 1)
        self.assertEqual(self.g.state.eggs, [])
        self.assertTrue(os.path.isdir(self.g.sd.full('Users/阿明/Documents')))
        self.assertTrue(os.path.exists(self.g.sd.full('Windows/boot.ini')))
        if self.g.tracker:
            self.g.tracker.stop()

    def test_open_path_rejects_escape(self):
        self.g.state.chapter = 1
        with mock.patch.object(main_mod.story, 'get_chapter') as gc,                 mock.patch.object(self.g, '_console') as log:
            gc.return_value = dict(main_mod.story.get_chapter(1), open_path='../../')
            self.g.on_open_path()
        self.assertTrue(any('路径被拒绝' in str(c) for c in log.call_args_list),
                        log.call_args_list)


if __name__ == '__main__':
    unittest.main()
