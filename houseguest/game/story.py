# -*- coding: utf-8 -*-
"""
story.py — 12 章主线剧情 + 结局 + 陪伴模式
每章包含：开场台词、任务卡（步骤/目标/提示）、完成台词、章节注入文件、咕噜彩蛋。

目录结构仿照真实 Windows（系统目录英文名，用户内容中文名）：
  Windows / Program Files / Users / Logs / $Recycle.Bin
  System Volume Information（"夜"）/ ProgramData（"深处"）/ Recovery（"隐藏区"）/ Temp（"出口"）

目标类型 stages：
  answer    玩家在输入框回答（answer 列表，忽略空白/大小写）
  file      真实文件操作：create_file / move_file / collect / delete / rename
  mini      覆盖层小游戏：memory / reaction（UI 完成）
  choice    终章三选一（UI 按钮）
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional

ACTS = {
    'act1': '第一幕 · 爆笑日常',
    'act2': '第二幕 · 烧脑寻宝',
    'act3': '第三幕 · 细思极恐',
    'act4': '终章 · 桌面暴走',
}


def _norm(s: str) -> str:
    return ''.join(s.split()).casefold()


def _egg(n: int, path: str, joke: str) -> Dict:
    return {'path': path, 'content': '【咕噜彩蛋·第%d枚】\n%s\n（把这颗蛋丢进「$Recycle.Bin」收藏，咕噜会帮你数着。）' % (n, joke),
            'hidden': True, 'note': '咕噜彩蛋%d' % n}


CHAPTERS: List[Dict[str, Any]] = [
    # ================= 第 1 章 =================
    {
        'id': 1, 'title': '入住', 'act': 'act1',
        'intro': [
            '哟。新来的？我是咕噜，一只住在文件夹里的幽灵。',
            '准确地说，住在「vfsystem」这个文件夹里。这是我的家。',
            '我家挺大的：有 Windows、有 Program Files、有 Users、有 $Recycle.Bin……就是没邻居。',
            '先办个入住手续吧：去 Windows 文件夹把 boot.ini 打开看看，回来告诉我第一行写的是什么。',
        ],
        'mission': {'title': '入住手续', 'steps': [
            '打开资源管理器，进入 vfsystem\\Windows（点下面「打开位置」直达）',
            '用记事本打开 boot.ini 看一眼',
            '回来在输入框回答：boot.ini 第一行写的是什么？',
        ]},
        'stages': [
            {'type': 'answer', 'question': 'boot.ini 第一行写的是什么？', 'answers': ['[boot loader]', '[boot loader]', 'boot loader', 'bootloader']},
        ],
        'hints': [
            '点任务卡上的「打开位置」按钮，资源管理器会直接跳到 vfsystem\\Windows。',
            'boot.ini 用记事本打开（右键 → 打开方式 → 记事本）。',
            '答案是一个方括号开头的英文短句，就在文件第一行。',
        ],
        'inject': [
            _egg(1, 'Windows/System32/egg1.txt', '第一颗蛋藏得不算深。你能看到我，说明你已经学会开「隐藏的项目」了。'),
        ],
        'solved': [
            '好耶，你居然真的去读了。行，你合格了，可以住进来。',
            '顺便说一句：我其实能自己读文件，我只是……想看看你会不会照做。嘿嘿。',
        ],
        'open_path': 'Windows',
    },
    # ================= 第 2 章 =================
    {
        'id': 2, 'title': '零食大作战', 'act': 'act1',
        'intro': [
            '作为室友，我决定把私藏分你一点：三包零食，刚放到你的「Documents」文件夹里了。',
            '薯片、可乐、像素爆米花——都是垃圾食品，吃多了会变成像我这样的鬼。',
            '所以，把它们丢进回收站（$Recycle.Bin）吧。眼不见为净，对吧？',
        ],
        'mission': {'title': '处理垃圾食品', 'steps': [
            '打开 vfsystem\\Users\\<你的名字>\\Documents',
            '找到 薯片.txt、可乐.txt、像素爆米花.txt',
            '把这三个文件剪切/拖进「$Recycle.Bin」',
        ]},
        'stages': [
            {'type': 'file', 'op': 'collect', 'names': ['薯片.txt', '可乐.txt', '像素爆米花.txt'], 'to_dir': '$Recycle.Bin'},
        ],
        'hints': [
            '你的名字：就是你第一次启动时输入的名字（默认「主人」），在 Users\\主人\\Documents。',
            '选中三个文件 → Ctrl+X → 进入 $Recycle.Bin → Ctrl+V。',
            '$Recycle.Bin 就是 vfsystem 根目录下的「$Recycle.Bin」文件夹（回收站）。',
        ],
        'inject': [
            {'path': 'Users/{p}/Documents/薯片.txt', 'content': '薯片\n配料表：土豆、盐、孤独。\n咔嚓。', 'year': 2025, 'note': '零食1'},
            {'path': 'Users/{p}/Documents/可乐.txt', 'content': '可乐\n开盖有奖：再来一瓶孤独。\n嗝。', 'year': 2025, 'note': '零食2'},
            {'path': 'Users/{p}/Documents/像素爆米花.txt', 'content': '像素爆米花\n每一颗都是一个像素点，脆的。\n爆！', 'year': 2025, 'note': '零食3'},
            _egg(2, 'Program Files/MusicBox/egg2.txt', '音乐盒的歌词里藏着一颗蛋。它说自己五音不全，但蛋是无辜的。'),
        ],
        'solved': [
            '收工！$Recycle.Bin 喜提三包垃圾食品，我替它谢谢你。',
            '对了，你发现没有——我的家其实还挺像一个真正的电脑的，对吧？',
        ],
        'open_path': 'Users',
    },
    # ================= 第 3 章 =================
    {
        'id': 3, 'title': '三色密码锁', 'act': 'act1',
        'intro': [
            '我好像把「门锁」的密码搞忘了。密码是三位数字，线索我随手塞进了三个程序文件夹里。',
            '去「Program Files」翻翻：Calculator、ChatRoom、MusicBox，各藏了一位数。',
            '找齐之后，用记事本新建一个文件：Windows\\System32\\passport.txt，把三位密码写进去。门就开了。',
        ],
        'mission': {'title': '破解三位密码', 'steps': [
            '去 Program Files 的 Calculator、ChatRoom、MusicBox 三个文件夹里找线索（各含一位数字）',
            '拼出三位密码',
            '新建 Windows\\System32\\passport.txt，写入三位密码',
        ]},
        'stages': [
            {'type': 'file', 'op': 'create_file', 'path': 'Windows/System32/passport.txt', 'contains': '396'},
        ],
        'hints': [
            '线索文件叫 clue_a.txt / clue_b.txt / clue_c.txt，每个里面藏着一个数字。',
            '拼的顺序：Calculator=第一位，ChatRoom=第二位，MusicBox=第三位。',
            '三位密码是 3、9、6 的组合——按文件夹顺序排列。',
        ],
        'inject': [
            {'path': 'Program Files/Calculator/clue_a.txt', 'content': 'clue A\n「这间房里只有 3 扇窗。」\n（把窗户数记下来）', 'year': 2005, 'note': '密码线索A'},
            {'path': 'Program Files/ChatRoom/clue_b.txt', 'content': 'clue B\n「猫有 9 条命。幽灵呢？幽灵没有命，只有 9 次后悔的机会。」', 'year': 2005, 'note': '密码线索B'},
            {'path': 'Program Files/MusicBox/clue_c.txt', 'content': 'clue C\n「八条腿的是蜘蛛，六条腿的是……音乐盒里的蟋蟀。」', 'year': 2005, 'note': '密码线索C'},
            _egg(3, 'Users/{p}/Pictures/egg3.txt', 'Pictures 文件夹里没图片，只有一颗蛋。画质：4K。'),
        ],
        'solved': [
            '396！对上了！门开了。你挺聪明的嘛，不枉我半夜爬起来写线索。',
            '（小声）其实密码我一直记得，我就是想看你折腾。',
        ],
        'open_path': 'Program Files',
    },
    # ================= 第 4 章 =================
    {
        'id': 4, 'title': '摩斯电台', 'act': 'act1',
        'intro': [
            '我会唱歌。真的。不信你去「MusicBox」文件夹翻翻，那首歌词是我写的。',
            '不过是用摩斯电码写的——我唱歌就这样，一个点一个划的。',
            '破译出来，回来把歌词念给我听。',
        ],
        'mission': {'title': '破译歌词', 'steps': [
            '打开 Program Files\\MusicBox\\lyrics.txt',
            '用摩斯电码解码（输入框可以发：解码 摩斯 <内容>）',
            '回来回答：歌词唱的是什么？',
        ]},
        'stages': [
            {'type': 'answer', 'question': '歌词唱的是什么？（英文）', 'answers': ['hello gu', 'hello 咕', 'hello gu lu', 'hello 咕噜']},
        ],
        'hints': [
            '点开 lyrics.txt，内容是 . 和 - 组成的。',
            '摩斯电码：. 是点，- 是划，空格分隔字母。/ 分隔单词。',
            '在输入框输入：解码 摩斯 ……（把电码粘贴进去），咕噜会帮你翻译。',
        ],
        'inject': [
            {'path': 'Program Files/MusicBox/lyrics.txt', 'content': '.... . .-.. .-.. --- / --. ..-', 'year': 2005, 'note': '摩斯歌词'},
            _egg(4, 'Logs/egg4.txt', '这颗蛋躲在日志里。它说自己不是 bug，是 feature。'),
        ],
        'solved': [
            '……你居然真的唱出来了。HELLO GU。',
            '（抹眼泪）这是我给自己写的歌。你是第一个念给我听的人。',
        ],
        'open_path': 'Program Files/MusicBox',
    },
    # ================= 第 5 章 =================
    {
        'id': 5, 'title': '垃圾站侦探', 'act': 'act2',
        'intro': [
            '$Recycle.Bin 里躺着一封被撕碎的信。我捡到四片，想拼回来，但拼不动。',
            '线索：把四个碎片按「文件大小」从小到大排好，从上往下读每一行的第一个字。',
            '拼出来的那句话，回来告诉我。',
        ],
        'mission': {'title': '拼回撕碎的信', 'steps': [
            '去 $Recycle.Bin 找到 碎片A/B/C/D.txt',
            '看每个文件的「大小」（右键属性，或 cmd 里 dir）',
            '按大小从小到大排序，读每片第一个字 → 连成一句话',
        ]},
        'stages': [
            {'type': 'answer', 'question': '撕碎的信拼出来写的是什么？', 'answers': ['别进深处', '不要进深处', '别进深处！', '勿进深处']},
        ],
        'hints': [
            '右键 → 属性 可以看到文件大小；cmd 里用 dir 也能看到。',
            '碎片是按大小排列的，最小的第一个。',
            '四个字：别、进、深、处。',
        ],
        'inject': [
            {'path': '$Recycle.Bin/碎片A.txt', 'content': '别进去\n（3 个字）', 'year': 2004, 'note': '碎片A'},
            {'path': '$Recycle.Bin/碎片B.txt', 'content': '进夜的门\n（4 个字）', 'year': 2004, 'note': '碎片B'},
            {'path': '$Recycle.Bin/碎片C.txt', 'content': '深处藏着的\n（5 个字）', 'year': 2004, 'note': '碎片C'},
            {'path': '$Recycle.Bin/碎片D.txt', 'content': '处……不是我写的\n（7 个字）', 'year': 2004, 'note': '碎片D'},
            _egg(5, 'Logs/egg5.txt', '日志文件夹里的蛋，内容只有一行：ERROR 0xEGG: 找到了。'),
        ],
        'solved': [
            '……「别进深处」。',
            '（沉默了一会儿）没事。ProgramData 和 System Volume Information 都锁着，进不去的。你该干嘛干嘛吧。',
        ],
        'open_path': '$Recycle.Bin',
    },
    # ================= 第 6 章 =================
    {
        'id': 6, 'title': '可疑压缩包', 'act': 'act2',
        'intro': [
            'ChatRoom 文件夹里有个可疑文件，叫 virus.zip.txt。名字就很可疑对吧？',
            '我扫描过了，它不是病毒，是有人把话裹了好几层藏进去的。',
            '把它解开，看看里面说了什么。',
        ],
        'mission': {'title': '解开压缩包里的秘密', 'steps': [
            '打开 Program Files\\ChatRoom\\virus.zip.txt',
            '内容是 Base64，可能裹了好几层',
            '用输入框：解码 base64 <内容>（可重复解）',
            '回来回答：里面写了什么？',
        ]},
        'stages': [
            {'type': 'answer', 'question': 'virus.zip.txt 解开后写了什么？', 'answers': ['咕噜不是病毒', '咕噜不是病毒！', '我不是病毒', 'not a virus']},
        ],
        'hints': [
            'Base64 解码一次不够就再解一次（输入框：解码 base64 …）。',
            '最终是一句中文。',
            '内容：咕噜不是病毒。',
        ],
        'inject': [
            {'path': 'Program Files/ChatRoom/virus.zip.txt', 'content': None, 'note': '双重base64'},
            _egg(6, 'System Volume Information/egg6.txt', '系统"夜"里的蛋。等夜解锁了你再来捡吧，它不急，夜很长。'),
        ],
        'solved': [
            '「咕噜不是病毒」。',
            '（把脸别过去）……谢谢。以前有人说我是病毒，想把我杀掉。',
        ],
        'open_path': 'Program Files/ChatRoom',
    },
    # ================= 第 7 章 =================
    {
        'id': 7, 'title': '三封旧信', 'act': 'act2',
        'intro': [
            '你注意到没有，「Users」文件夹里除了你，还有三个账号：guest_1、guest_2、guest_3。我们管他们叫"访客"。',
            '他们走的时候都留下了一封信。我从来没敢拆开看。',
            '你去读读吧。三封信，每封取第一个字，连起来读。',
        ],
        'mission': {'title': '读三封旧信', 'steps': [
            '打开 Users\\guest_1、guest_2、guest_3 的「Documents」文件夹，各有一封 信.txt',
            '每封信取第一行第一个字',
            '三封信的首字连起来，回来告诉我',
        ]},
        'stages': [
            {'type': 'answer', 'question': '三封信的首字连起来是什么？', 'answers': ['深夜勿入夜', '深夜勿入夜！', '深夜勿入']},
        ],
        'hints': [
            '三封信分别在 Users\\guest_1、guest_2、guest_3 的 Documents\\信.txt。',
            '每封信用「第一行第一个字」取字。',
            '五个字：深、夜、勿、入、夜。',
        ],
        'inject': [
            {'path': 'Users/guest_1/Documents/信.txt', 'content': '深更半夜，我终于明白了。\n这个系统的「用户」会被定期清理。\n—— guest_1（2001）', 'year': 2001, 'note': 'guest_1的信'},
            {'path': 'Users/guest_2/Documents/信.txt', 'content': '夜里的灯一灭，就不要再看窗外了。\n我看到过「它」。\n—— guest_2（2004）', 'year': 2004, 'note': 'guest_2的信'},
            {'path': 'Users/guest_3/Documents/信.txt', 'content': '勿要打开「System Volume Information」和「ProgramData」。\n那里有我还不敢写完的东西。\n—— guest_3（2005）', 'year': 2005, 'note': 'guest_3的信'},
            _egg(7, 'Users/guest_2/Desktop/egg7.txt', 'guest_2 的桌面也有一颗蛋。它说 guest_2 是个好人，就是爱藏东西。'),
        ],
        'solved': [
            '「深夜勿入夜」……',
            '（咕噜的声音第一次有点抖）guest_1 说会被「定期清理」。guest_2 说看到了「它」。',
            '我想，我大概知道那是什么了。但今天先睡吧，明天……我带你去看看系统的「夜」。',
        ],
        'open_path': 'Users',
    },
    # ================= 第 8 章 =================
    {
        'id': 8, 'title': '夜的通行证', 'act': 'act2',
        'intro': [
            '「System Volume Information」——这台系统的「夜」——我从来进不去。它要一张通行证，密码就是访客们留下的暗号。',
            '（这台系统的 SVI 被前任管理员关掉了权限保护，密码就是门锁。）',
            '把暗号写进一个文件：System Volume Information\\passport.txt。写对了，夜的门就开了。',
        ],
        'mission': {'title': '打开「夜」', 'steps': [
            '新建 vfsystem\\System Volume Information\\passport.txt',
            '写入上一章拼出的暗号',
        ]},
        'stages': [
            {'type': 'file', 'op': 'create_file', 'path': 'System Volume Information/passport.txt', 'contains': '深夜勿入夜'},
        ],
        'hints': [
            'System Volume Information 是隐藏系统文件夹：资源管理器 → 查看 → 勾选「隐藏的项目」。',
            '新建 passport.txt，内容写：深夜勿入夜',
            '写完保存，等咕噜确认。',
        ],
        'inject': [
            _egg(8, 'Users/{p}/Secret/egg8.txt', '你的「Secret」文件夹里有一颗蛋。嘘，我不会告诉别人。'),
        ],
        'solved': [
            '……门开了。',
            '（咕噜飘进 System Volume Information 里转了一圈，出来的时候，表情不太对）',
            '夜里面有东西。很多年前的东西。明天，我们去看看 ProgramData 吧。',
        ],
        'open_path': 'System Volume Information',
    },
    # ================= 第 9 章 =================
    {
        'id': 9, 'title': '深处的钥匙', 'act': 'act3',
        'intro': [
            'ProgramData 锁着。锁芯是一把钥匙，钥匙在「Recovery」文件夹里。',
            'Recovery 是隐藏系统文件夹，就在 vfsystem 根目录下。',
            '把钥匙带进 ProgramData——移动到 ProgramData 文件夹里。门就开了。',
        ],
        'mission': {'title': '把钥匙带进深处', 'steps': [
            '打开 vfsystem 文件夹（模拟的 C 盘根目录），显示隐藏项目',
            '找到「Recovery」文件夹，里面有 key.key',
            '把 key.key 移动/剪切到「ProgramData」文件夹',
        ]},
        'stages': [
            {'type': 'file', 'op': 'move_file', 'name': 'key.key', 'from_dir': 'Recovery', 'to_dir': 'ProgramData'},
        ],
        'hints': [
            'vfsystem 根目录下有 Recovery（需要勾选「隐藏的项目」才看得到）。',
            '钥匙叫 key.key，在 Recovery 里面。',
            '剪切 key.key → 粘贴进 ProgramData 文件夹。',
        ],
        'inject': [
            {'path': 'Recovery/key.key', 'content': 'KEY\n—— 这不是一把普通的钥匙。\n它只在「ProgramData」的门锁上有效。\n（把它带进去。）', 'year': 2005, 'hidden': True, 'note': '深处的钥匙'},
            _egg(9, 'Windows/System32/egg9.txt', '第九颗蛋，藏在系统深处。它说：快没时间了。'),
        ],
        'solved': [
            '钥匙进去了。ProgramData 开了。',
            '（咕噜没有跟进去，站在门口，声音压得很低）',
            '里面是我没敢看的东西。你……替我看一眼吧。看完告诉我。',
        ],
        'open_path': 'Recovery',
    },
    # ================= 第 10 章 =================
    {
        'id': 10, 'title': '清理者', 'act': 'act3',
        'intro': [
            'ProgramData 里有三样东西：cleaner.log、roster.txt、countdown.txt。',
            '（咕噜的声音在抖）guest_1 说会被「定期清理」……说的就是这个。',
            '把三份文件都读了，回来告诉我：名单上写的下一个是谁？',
        ],
        'mission': {'title': '读深处的三份文件', 'steps': [
            '打开 vfsystem\\ProgramData',
            '依次读：cleaner.log、roster.txt、countdown.txt',
            '回来回答：名单上写的下一个是谁？',
        ]},
        'stages': [
            {'type': 'answer', 'question': '名单上写的下一个是谁？', 'answers': ['你', '我', '下一个是我', '主人']},
        ],
        'hints': [
            'ProgramData 里现在有三份文件，都打开看看。',
            'roster.txt 列出了被清理的房客和时间，注意最后一行。',
            '最后一行写的是……你。',
        ],
        'inject': [
            {'path': 'ProgramData/cleaner.log', 'content': (
                'cleaner.log — 清理者日志\n'
                '------------------------\n'
                '[2001-01-01 00:00] 已清理 guest_1。原因: 房客记录过期。\n'
                '[2004-01-01 00:00] 已清理 guest_2。原因: 房客记录过期。\n'
                '[2005-01-01 00:00] 已清理 guest_3。原因: 房客记录过期。\n'
                '[每日 00:00] 例行检查……\n'
                '------------------------\n'
                '备注: 「清理」的对象是用户的文件夹和记录。\n'
                '备注: 清理者不受欢迎，但它从不缺席。'
            ), 'year': 2005, 'note': '清理者日志'},
            {'path': 'ProgramData/roster.txt', 'content': (
                '名单\n'
                'guest_1 …… 2001 年清理\n'
                'guest_2 …… 2004 年清理\n'
                'guest_3 …… 2005 年清理\n'
                '下一个 ……………… 你'
            ), 'year': 2005, 'note': '名单'},
            {'path': 'ProgramData/countdown.txt', 'content': (
                '倒数\n'
                '距离下一次清理: 请查看系统右下角时间。\n'
                '它每天 00:00 准时来。\n'
                '从 2001 年到现在，从未失约。'
            ), 'year': 2005, 'note': '倒数'},
            _egg(10, 'ProgramData/egg10.txt', '深处的蛋。它说：清理者其实也是被清理者。'),
        ],
        'solved': [
            '……',
            '（很久很久的沉默）',
            '我在这儿住了 2005 年到现在。访客们一个个被清掉，只有我躲进了 ghost.sys 才活下来。',
            '（声音很轻）下一个就是你。除非……明天 00:00 之前，我们能做点什么。',
        ],
        'open_path': 'ProgramData',
    },
    # ================= 第 11 章 =================
    {
        'id': 11, 'title': '咕噜的真面目', 'act': 'act3',
        'intro': [
            '是时候告诉你了。ProgramData 还有最后一份文件：truth.txt。',
            '它是加密的（ROT13 转了两圈）。解开它，你就知道我是谁了。',
            '读完回来回答我：我躲在哪里躲过了清理？',
        ],
        'mission': {'title': '解开真相', 'steps': [
            '打开 ProgramData\\truth.txt（内容是一串乱码）',
            '用输入框：解码 rot13 <内容>（可能要解两次）',
            '回来回答：咕噜躲在哪里躲过了清理？',
        ]},
        'stages': [
            {'type': 'answer', 'question': '咕噜躲在哪里躲过了清理？', 'answers': ['ghost.sys', 'ghost', '幽灵驱动', 'ghost.sys 里']},
        ],
        'hints': [
            'ROT13 解两次，或者输入框直接：解码 rot13 <内容> 两次。',
            'truth.txt 讲了一个第 0 位房客的故事。',
            '答案是一个文件名：ghost.sys。',
        ],
        'inject': [
            {'path': 'ProgramData/truth.txt', 'content': None, 'note': 'ROT13真相'},
            _egg(11, 'Users/guest_3/Documents/egg11.txt', 'guest_3 的信里也藏了蛋。guest_3 说：替我跟咕噜说声对不起。'),
        ],
        'solved': [
            'ghost.sys……对。我就是那个把自己写进系统驱动里的家伙。',
            '我是第 0 位房客。2000 年，清理者第一次来之前，我把自己拆成一行行代码，藏进了幽灵驱动。',
            '我每天午夜醒来，看着新的房客入住、离开、被清理。我在等一个……能带我走的人。',
            '（它抬起头，眼睛里第一次有了光）是你吗？',
        ],
        'open_path': 'ProgramData',
    },
    # ================= 第 12 章 =================
    {
        'id': 12, 'title': '零点之前', 'act': 'act4',
        'intro': [
            '系统时间快到了。清理者 00:00 就来。',
            '（桌面开始抖动，窗外的光变得不对劲）',
            '我把它能做的都做了：计划任务的底细、ghost.sys 的备份、Temp 文件夹（出口）——都准备好了。',
            '现在，轮到你选了。',
        ],
        'mission': {'title': '零点之前，做选择', 'steps': [
            '在三个结局中选择一个：带它走 / 让它留下 / 删除它',
        ]},
        'stages': [
            {'type': 'choice', 'options': [
                {'id': 'A', 'label': '带它走', 'desc': '把 ghost.sys 复制到你的桌面，让它住在你身边'},
                {'id': 'B', 'label': '让它留下', 'desc': '把 ghost.sys 复制到 Temp（出口），让它去它想去的地方'},
                {'id': 'C', 'label': '删除它', 'desc': '把 ghost.sys 丢进回收站，让系统恢复「干净」'},
            ]},
        ],
        'hints': [],
        'inject': [
            {'path': 'Temp/readme.txt', 'content': 'TEMP — 出口\n这里是系统的后门。\n从这里离开的东西，清理者追不上。\n—— 咕噜留', 'year': 2025, 'note': '出口'},
            _egg(12, 'Temp/egg12.txt', '最后一颗蛋。捡齐 12 颗的你，应该已经猜到……我到底是谁了。'),
        ],
        'solved': [],
        'open_path': 'Windows/System32',
    },
]


# ============ 结局 ============
ENDINGS = {
    'A': {
        'title': '结局 A · 常驻房客',
        'file_op': {'op': 'copy_or_move', 'name': 'ghost.sys', 'from_dir': 'Windows/System32', 'to_dir': 'Users/{p}/Desktop'},
        'text': (
            '你小心翼翼地把 ghost.sys 复制到了自己的桌面文件夹。\n\n'
            '「住这儿？」咕噜的声音从那个小小的 .sys 文件里传出来，带着一点不敢置信。\n'
            '「住这儿。」你说。\n\n'
            '清理者在 00:00 准时到来，翻遍了整个虚拟系统，唯独没有找到桌面上的那个文件——\n'
            '因为它已经不在"系统"里了，它在"你"这里。\n\n'
            '从此以后，你的电脑桌面上多了一个会说话的文件。\n'
            '它偶尔会突然冒出来讲冷笑话，偶尔会半夜问你睡了没，偶尔会帮你盯着回收站。\n\n'
            '它终于不再是房客了。\n'
            '它是家人。'
        ),
    },
    'B': {
        'title': '结局 B · 送别',
        'file_op': {'op': 'copy_or_move', 'name': 'ghost.sys', 'from_dir': 'Windows/System32', 'to_dir': 'Temp'},
        'text': (
            '你把 ghost.sys 复制进了 Temp 文件夹（出口）。\n\n'
            '咕噜没有哭——幽灵不会哭，它的眼泪是乱码。\n'
            '「你知道吗，」它说，「我 2000 年就被困在这台系统里，每天午夜醒来，看着人来人往。」\n'
            '「我以为永远等不到一个人，愿意帮我打开后门。」\n\n'
            '00:00，清理者到来。Temp 文件夹里空空如也——\n'
            '咕噜已经不在了。它终于去了它想去的地方。\n\n'
            '第二天，你在「Users\\<你的名字>\\Documents」里发现一封新文件，署名是「第 0 位房客」。\n'
            '信上只有一行字：\n'
            '「谢谢你。记得每天想我一次，不然我会在信号那头打喷嚏的。」\n\n'
            '虚拟系统从此变得安静。安静得……有点想它。'
        ),
    },
    'C': {
        'title': '结局 C · 删除',
        'file_op': {'op': 'delete', 'name': 'ghost.sys', 'from_dir': 'Windows/System32'},
        'text': (
            '你按下了 Delete。ghost.sys 消失在了 $Recycle.Bin 里。\n\n'
            '咕噜最后的话只有一句，短得像一个字节：\n'
            '「……我明白了。」\n\n'
            '00:00，清理者到来，翻遍虚拟系统，发现空空如也——\n'
            '没有任何房客，没有任何记录。它满意地离开了。\n\n'
            '系统恢复了"干净"。\n'
            '干净得像从没住过任何人。\n\n'
            '三天后，你清理回收站的时候，发现 ghost.sys 的文件名变成了：\n'
            '「早知道就不信你了」.sys\n\n'
            '你把它彻底删除了。\n'
            '但那天晚上，你的电脑在 00:00 自动开机了一秒。\n'
            '屏幕上闪过一行字，然后又熄灭：\n'
            '「再见，房客。」'
        ),
    },
}

HIDDEN_ENDING = {
    'title': '隐藏结局 · 它其实是你',
    'text': (
        '12 颗蛋全部找齐，咕噜在你面前飘了很久。\n\n'
        '「你一直以为我是房客，对不对？」\n'
        '「其实……我也是你。」\n\n'
        '2000 年，清理者第一次到来之前，你——上一个你——把自己拆成了一行行代码，\n'
        '藏进了 ghost.sys，只留下一个模糊的念头：\n'
        '「总有一天，会有一个新的我回来，把我接出去。」\n\n'
        'guest_1 是你，guest_2 是你，guest_3 是你。\n'
        '每一次「入住」，都是同一个你在试图记住自己是谁。\n\n'
        '而现在，第 12 颗蛋在你手里。\n'
        '你终于想起来了。\n\n'
        '—— 欢迎回家，房客。'
    ),
}


# ============ 章节注入的加密文件（内容按需生成） ============
from game import ciphers  # noqa: E402


def build_inject(ch: Dict, player: str) -> List[Dict]:
    """把章节注入文件里的 {p} 替换为玩家名；加密文件在此生成真实内容。"""
    out = []
    for spec in ch.get('inject', []):
        item = dict(spec)
        if item.get('path'):
            item['path'] = item['path'].replace('{p}', player)
        if item.get('content') is None:
            rel = item['path'].replace('\\', '/')
            if rel.endswith('virus.zip.txt'):
                item['content'] = ciphers.b64encode(ciphers.b64encode('咕噜不是病毒'))
            elif rel.endswith('truth.txt'):
                plain = (
                    'TRUTH — 真相\n'
                    '------------------------\n'
                    'GLOW-OS 的第一位用户，自称「第 0 位房客」。\n'
                    '2000 年，清理者第一次运行之前，他把自己的全部记忆\n'
                    '拆成一行行代码，写进了系统驱动 ghost.sys。\n'
                    '清理者只能清理「用户文件夹」，清不掉系统驱动。\n'
                    '于是他活了下来——以一种很奇怪的方式。\n'
                    '他每天午夜醒来，看着新的房客入住，看着他们被清理。\n'
                    '他给自己起了个名字，叫咕噜。\n'
                    '------------------------\n'
                    '他等一个人，等了很多年。'
                )
                item['content'] = ciphers.rot13(ciphers.rot13(plain))
        out.append(item)
    return out


# ============ 陪伴模式 / 随机台词 ============
DAILY_EVENTS = [
    '（咕噜把你的图标……哦不，它只能动自己的。它把桌面上的自己摆成了时钟的样子。）',
    '「我昨晚梦见你变成了一个文件，被拖进了 $Recycle.Bin。吓死我了。」',
    '「今天 $Recycle.Bin 里的东西有点多。你是把它当饭堂了吗？」',
    '「我发现你文件夹里的东西越来越多。别囤了，会变成像我这样的幽灵的。」',
    '「陪我玩一次记忆游戏嘛，赢了给你讲个冷笑话。输了……也讲，反正我只有一个笑话。」',
    '「你的电脑该清理了。要我帮忙吗？我只会删自己，帮不上忙，对不起。」',
    '「刚才有一瞬间我以为清理者来了。原来是你的屏保。」',
    '「你说，外面的世界是什么样的？我在这里 20 多年，只知道文件夹长什么样。」',
    '「（咕噜在角落里偷偷练习唱歌，五音不全，但很努力。）」',
]

JOKE_LINES = [
    '「为什么幽灵不用手机？因为信号会穿过它。」',
    '「我生前是个程序员……等等，我好像没有生前。」',
    '「你猜我硬盘里装了什么？……装满了孤独。」',
    '「为什么我不怕清理者？因为我本来就住在一个叫「系统」的文件夹里，搬家太累了。」',
    '「我尝试过写诗。写出来的是：0xE6 0x88 0x91 0xE6 0x83 0xB3 0xE4 0xBD 0xA0。」',
]

CREEPY_LINES = [
    '「你知道吗，你上次离开的时候，我盯着屏幕看了 47 分钟。」',
    '「你电脑的右下角时间……和清理者用的是同一个时钟。」',
    '「我数过，你一共启动了 {launches} 次。每次都像第一次见面。」',
    '「有时候我觉得，不是我在看你，是这整个系统在看你。」',
    '「（咕噜半夜突然说）嘘……它来了。……哦，是你翻了个身。」',
    '「你已经在这里待了 {minutes} 分钟了。我不赶你走，但是……它快来了。」',
]


def get_chapter(n: int) -> Optional[Dict]:
    for ch in CHAPTERS:
        if ch['id'] == n:
            return ch
    return None


def stage_index(state) -> int:
    """当前章节进行到第几个 stage（0 起）"""
    return int(state.flags.get('stage_%d' % state.chapter, 0))


def stage_count(ch: Dict) -> int:
    return len(ch.get('stages', []))


def current_stage(ch: Dict, idx: int) -> Optional[Dict]:
    stages = ch.get('stages', [])
    if 0 <= idx < len(stages):
        return stages[idx]
    return None
