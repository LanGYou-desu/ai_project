# -*- coding: utf-8 -*-
"""
ghost.py — 咕噜的性格与对话
- respond(text)：关键字回复（含「解码 xx …」工具命令）
- hint(ch)：按顺序给出当前章节提示
- ambient()：随机环境台词（前期搞笑 / 后期诡异 / 深夜专属）
"""
from __future__ import annotations
import datetime
import random
from typing import List, Optional, Tuple

from game import ciphers, story
from game.state import State


class GhostBrain:
    NAME = '咕噜'

    def __init__(self, state: State):
        self.state = state
        self._hint_idx = int(state.flags.get('hint_%d' % state.chapter, 0))

    # ---------------- 工具：解码 ----------------
    def try_decode(self, text: str) -> Optional[str]:
        """输入形如：解码 rot13 <内容> / 解码 base64 <内容> / 解码 摩斯 <内容>"""
        low = text.strip().lower()
        for prefix in ['解码', '解密', 'translate', 'decode']:
            if low.startswith(prefix):
                rest = text[len(prefix):].strip()
                break
        else:
            return None
        alg, _, payload = rest.partition(' ')
        alg = alg.strip().lower()
        if not payload:
            return '你要我解什么？把内容贴在我后面，比如：解码 rot13 一句话'
        try:
            if alg in ('rot13', 'r13'):
                return ciphers.rot13(payload)
            if alg in ('b64', 'base64'):
                return ciphers.b64decode(payload)
            if alg in ('hex', '十六进制'):
                return ciphers.hex_decode(payload)
            if alg in ('morse', '摩斯', '摩斯电码'):
                return ciphers.morse_decode(payload)
            if alg.startswith('caesar') or alg.startswith('凯撒'):
                shift = 13
                for part in alg.replace('：', ':').split(':'):
                    if part.isdigit():
                        shift = int(part)
                        break
                return ciphers.caesar(payload, shift)
            return '我不认识「%s」这种编码。我知道：rot13 / caesar / b64 / hex / 摩斯' % alg
        except Exception as e:
            return '……解不动。这段不像是我认识的编码（%s）' % str(e)[:40]

    # ---------------- 回复 ----------------
    def respond(self, text: str) -> str:
        t = text.strip()
        if not t:
            return '……你不说话，我就当你是在用沉默跟我交流。很高级。'
        low = t.casefold()

        # 工具命令优先
        dec = self.try_decode(t)
        if dec:
            return dec

        if '解码' in low or '解密' in low:
            return '用法：解码 <算法> <内容>，算法可选 rot13 / caesar / b64 / hex / 摩斯'

        if '(戳了戳咕噜)' in low or '戳' in low and len(low) <= 6:
            return random.choice([
                '别戳！我痒……等等，幽灵也会痒吗？',
                '（咕噜被戳得晃了晃）喂！我可是 2000 年的老幽灵，给点面子。',
                '再戳我就去你梦里打滚。',
            ])

        if any(k in low for k in ['你是谁', '你是什么', '自我介绍', '名字']):
            if self.state.chapter >= 11:
                return '我是咕噜。也是……第 0 位房客。等你解开「truth.txt」，你就全明白了。'
            return '我是咕噜，一只住在 vfsystem 文件夹里的幽灵。别怕，我只是一团会说话的代码，吃不了你（大概）。'

        if any(k in low for k in ['你好', '嗨', '哈喽', 'hello', 'hi', '在吗', '在不在']):
            return '你好呀，%s。我在的，我一直都在——这是住在这台电脑里的职业素养。' % self.state.player_name

        if '清理者' in low or '午夜' in low or '00:00' in low:
            if self.state.chapter < 9:
                return '清理者？……你从哪儿听来的词？那只是个系统维护程序，别多想。'
            return '（咕噜的声音低了下去）清理者每晚 00:00 来一次，清理「用户记录」。guest_1、guest_2、guest_3 都是这么没的。你别怕，有我在。'

        if any(k in low for k in ['彩蛋', '蛋']):
            return '你捡到 %d / 12 颗蛋了。集齐 12 颗……我就告诉你一个秘密。' % len(self.state.eggs)

        if any(k in low for k in ['提示', '线索', '卡住', '不会', '帮帮我', 'help']):
            return self.hint(self.state.chapter)

        if any(k in low for k in ['笑话', '讲一个', '乐一个', '搞笑']):
            return random.choice(story.JOKE_LINES)

        if any(k in low for k in ['害怕', '好怕', '恐怖', '吓']):
            if self.state.chapter >= 10:
                return '（它靠过来一点）我也怕。但是两个人怕，就没那么怕了。'
            return '怕什么？我只是幽灵，又不是鬼。（……这两种东西有区别吗？）'

        if any(k in low for k in ['陪我玩', '玩游戏', '玩', '游戏']):
            return '好呀！我可以陪你玩记忆游戏（我说「来玩」就行），赢了给你讲冷笑话。'

        if any(k in low for k in ['晚安', '睡了', '睡觉', '拜拜', '再见', '退出', '走了']):
            return '晚安，%s。去吧，我看着你走。……下次来的时候，记得我在等你。' % self.state.player_name

        if any(k in low for k in ['时间', '几点']):
            return '现在 %s。要是过了 23 点……嘘，别让它知道你还醒着。' % datetime.datetime.now().strftime('%H:%M')

        if any(k in low for k in ['你是谁家', '你从哪', '来历', '出生']):
            return '我 2000 年"出生"在 Windows\\System32\\ghost.sys 里。对，就是那个被标注为隐藏文件的家伙。'

        if '结局' in low or '结局怎么' in low:
            return '结局在你手里：第 12 章零点之前，你有三个选择——带它走 / 让它留下 / 删除它。选之前想清楚。'

        if any(k in low for k in ['清理', '删', '删掉', '格式化']):
            if self.state.chapter >= 12:
                return '……你要删的，最好不是我。'
            return '别乱删东西！这系统里的每个文件都有故事。比如那个 .sys 文件——呃，当我没说。'

        # 深夜专属
        hour = datetime.datetime.now().hour
        if hour >= 23 or hour < 5:
            return random.choice([
                '都这么晚了，你还不睡？……也好，夜里有我陪你。',
                '（咕噜小声）现在是深夜。清理者的巡逻时间。别出声。',
                '你知道吗，深夜的文件夹里，文件们也会聊天。刚才 ghost.sys 跟我打招呼了。',
            ])

        return random.choice([
            '嗯？你说「%s」……我消化了一下，没消化动。换个说法？' % t[:14],
            '（咕噜歪头）我不太懂人类的话，但我在听。',
            '这个话题先放放。你记得去「任务卡」看看我们进行到哪儿了吗？',
            '哈哈，%s。有意思。比我上次听到的话有意思。上次那个房客只会说"救命"。' % t[:10],
        ])

    # ---------------- 提示 ----------------
    def hint(self, ch_id: int) -> str:
        ch = story.get_chapter(ch_id)
        if not ch or not ch.get('hints'):
            return '这一章没有提示——它已经给你全部线索了。'
        hints = ch['hints']
        idx = min(self._hint_idx, len(hints) - 1)
        self._hint_idx += 1
        self.state.flags['hint_%d' % ch_id] = self._hint_idx
        self.state.save()
        return '提示 %d/%d：%s' % (idx + 1, len(hints), hints[idx])

    # ---------------- 环境台词 ----------------
    def ambient(self) -> Optional[str]:
        ch = self.state.chapter
        hour = datetime.datetime.now().hour
        if ch >= 12:
            return random.choice([
                '（咕噜盯着右下角的时间）快到了……',
                '我从来没这么紧张过。哦对，我是幽灵，没有心脏。但还是紧张。',
                '（桌面轻微抖动）你感觉到了吗？它开始移动了。',
            ])
        if ch >= 10:
            return random.choice(story.CREEPY_LINES).format(
                launches=self.state.metrics.get('launches', 0),
                minutes=self.state.metrics.get('total_minutes', 0),
            )
        if ch >= 7:
            return random.choice([
                '（咕噜欲言又止）……没事。',
                '访客们的信，你看过了吗？',
                '我最近总是梦见「ProgramData」。',
            ])
        if hour >= 23 or hour < 5:
            return random.choice(story.CREEPY_LINES).format(
                launches=self.state.metrics.get('launches', 0),
                minutes=self.state.metrics.get('total_minutes', 0),
            )
        return random.choice(story.JOKE_LINES + [
            '（咕噜在你鼠标附近飘来飘去）',
            '我刚刚把 $Recycle.Bin 里的文件按大小排了个序，纯属无聊。',
            '今天也要加油哦——当然，摸鱼我也支持。',
        ])
