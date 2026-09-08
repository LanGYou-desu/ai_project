# -*- coding: utf-8 -*-
"""
systemdir.py — 虚拟系统目录构建器
在项目目录下真实创建一个仿真实 Windows 的 C 盘（vfsystem 文件夹本身即盘根）：
  vfsystem/{Windows, Program Files, Users, Logs, $Recycle.Bin,
            System Volume Information, ProgramData, Recovery, Temp}
- 真实文件/真实内容；隐藏文件用 attrib +h（真实资源管理器默认看不到）；
- 历史文件用 os.utime 伪造"修改日期"（资源管理器里显示 2001/2005 年）。
- 系统层目录/文件一律英文命名；仅用户个人内容（文档/回收站里的文件）保留中文。
- 游戏的全部"系统活动"都被圈在这个目录里，删掉 vfsystem 即彻底干净。
"""
from __future__ import annotations
import datetime
import json
import os
import subprocess
from typing import Dict, List, Optional

MANIFEST = "manifest.json"


def _fmt(ts: datetime.datetime) -> float:
    return ts.timestamp()


def set_mtime(path: str, year: int, month: int = 1, day: int = 1, hour: int = 0, minute: int = 0) -> None:
    try:
        ts = _fmt(datetime.datetime(year, month, day, hour, minute))
        os.utime(path, (ts, ts))
    except Exception:
        pass


def hide(path: str) -> None:
    """给文件/目录设置真实隐藏属性（attrib +h，路径需加引号防空格）"""
    try:
        subprocess.run('attrib +h "%s"' % path, check=False, capture_output=True, shell=True)
    except Exception:
        pass


def show(path: str) -> None:
    try:
        subprocess.run('attrib -h "%s"' % path, check=False, capture_output=True, shell=True)
    except Exception:
        pass


def is_hidden(path: str) -> bool:
    try:
        return bool(os.stat(path).st_file_attributes & 0x2)
    except Exception:
        return False


class SystemDir:
    """管理虚拟系统目录。root = 项目下的 vfsystem/"""

    def __init__(self, root: str):
        self.root = root
        self.cdrive = root  # vfsystem 文件夹本身即模拟的 C 盘根目录
        self.manifest_path = os.path.join(root, MANIFEST)

    # ---------------- 基础路径 ----------------
    def p(self, *parts: str) -> str:
        return os.path.join(self.cdrive, *parts)

    def rel(self, abspath: str) -> str:
        return os.path.relpath(abspath, self.cdrive)

    # ---------------- 文件/目录操作（都会记录进清单） ----------------
    def ensure_dir(self, relpath: str, year: Optional[int] = None) -> str:
        path = os.path.join(self.cdrive, relpath)
        os.makedirs(path, exist_ok=True)
        if year:
            set_mtime(path, year)
        return path

    def write_file(self, relpath: str, content: str, year: Optional[int] = None,
                   hidden: bool = False, binary_hint: bool = False) -> str:
        path = self.ensure_dir(os.path.dirname(relpath))
        full = os.path.join(path, os.path.basename(relpath))
        # Windows 上对"已存在的隐藏文件"直接写会 PermissionError，
        # 因此先删除旧文件再写（隐藏属性随新文件重建）。
        if os.path.exists(full):
            try:
                os.remove(full)
            except OSError:
                show(full)
                try:
                    os.remove(full)
                except OSError:
                    pass
        with open(full, 'w', encoding='utf-8') as f:
            f.write(content)
        if year:
            set_mtime(full, year)
        if hidden:
            hide(full)
        return full

    def manifest_add(self, relpath: str, note: str = '') -> None:
        data = {}
        if os.path.exists(self.manifest_path):
            try:
                with open(self.manifest_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                data = {}
        data[relpath] = {'note': note, 'created': datetime.datetime.now().isoformat(timespec='seconds')}
        with open(self.manifest_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=1)

    # ---------------- 构建基础系统 ----------------
    def build(self, player_name: str) -> None:
        os.makedirs(self.root, exist_ok=True)
        # 边界说明文件（告诉玩家这个目录就是游戏的活动范围）
        with open(os.path.join(self.root, 'README.txt'), 'w', encoding='utf-8') as f:
            f.write(
                '这里是「桌灵·房客」的虚拟系统目录。\n'
                '这个文件夹（vfsystem）本身，就模拟你电脑里的 C 盘。\n'
                '目录结构仿照真实 Windows：\n'
                '  - Windows / Program Files / Users / Logs / $Recycle.Bin\n'
                '  - System Volume Information / ProgramData / Recovery / Temp\n'
                '  - 你可以在真实资源管理器中翻看、移动、删除这里的文件\n'
                '  - 游戏只监控这一个文件夹，绝不会碰它之外的东西\n'
                '  - 想彻底卸载？删掉整个 vfsystem 和 save 文件夹即可。\n'
                '祝你和房客相处愉快。\n'
            )
        self.manifest_add('README.txt', '边界说明')

        # ---- 顶层（仿真实 Windows 结构，系统目录一律英文） ----
        self.ensure_dir('Windows/System32', 2001)
        self.ensure_dir('Program Files', 2005)
        self.ensure_dir('Users', 2001)
        self.ensure_dir('Logs', 2003)
        self.ensure_dir('$Recycle.Bin', 2004)
        self.ensure_dir('System Volume Information', 2005)
        self.ensure_dir('ProgramData', 2005)
        self.ensure_dir('Recovery', 2005)
        self.ensure_dir('Temp', 2005)
        hide(self.p('System Volume Information'))
        hide(self.p('ProgramData'))
        hide(self.p('Recovery'))

        # ---- Windows ----
        self.write_file('Windows/boot.ini', (
            '[boot loader]\n'
            'timeout=3\n'
            'GLOW-OS 1.0 "壳" 内核 —— 一个住在文件夹里的操作系统\n'
            '加载模块: 桌面层 / 输入层 / 幽灵驱动(ghost.sys)\n'
            '状态: 正常（大概）\n'
        ), year=2001)
        self.write_file('Windows/System32/ghost.sys', (
            'BINARY DATA — 0x47484F53542E535953\n'
            '（这是一只幽灵的驱动程序。别问，问就是量子力学。）\n'
        ), year=2001, hidden=True)
        self.write_file('Windows/System32/clock.dll.txt', (
            'GLOW 时钟模块\n'
            '时间: 见右下角。\n'
            '（它认识你的作息。你半夜打开它，它都知道。）\n'
        ), year=2001)
        self.write_file('Windows/System32/mood.dat', (
            '心情值: 42/100\n'
            '备注: 在等一个人类入住。\n'
        ), year=2001)
        self.write_file('Windows/System32/users.dat', (
            '已注册用户: 3\n'
            '[guest_1] 状态: 已离开\n'
            '[guest_2] 状态: 已离开\n'
            '[guest_3] 状态: 已离开\n'
            '[%s] 状态: 正在登录…\n' % player_name
        ), year=2001)
        self.write_file('Windows/System32/tasks.ini', (
            '[scheduled tasks]\n'
            'task_0 = ghost_wake  每天 00:00  运行 ghost.sys\n'
            'task_1 = ???         每日 00:00  （内容被抹掉了）\n'
            'task_2 = ???         每日 00:00  （内容被抹掉了）\n'
            '（底下两行是什么时候出现的？没人记得。）\n'
        ), year=2005, hidden=True)

        # ---- Program Files（程序目录用英文名，说明内容保留中文） ----
        self.write_file('Program Files/Calculator/note.txt', (
            '一个计算器。\n'
            '但它算不出我有多孤独。\n'
            '（至少 2005 年的时候它是这么写的。）\n'
        ), year=2005)
        self.write_file('Program Files/ChatRoom/note.txt', (
            '聊天室。\n'
            '里面只有我一个人。还有回音。\n'
            '你好。\n'
            '你好。\n'
            '你……好？\n'
        ), year=2005)
        self.write_file('Program Files/MusicBox/note.txt', (
            '音乐盒。\n'
            '会放一首永远记不住歌词的歌。\n'
            '歌词好像和"钥匙"有关。\n'
        ), year=2005)

        # ---- Users（账号名用英文，符合真实 Windows 习惯；个人文件保留中文） ----
        for guest in ['guest_1', 'guest_2', 'guest_3']:
            self.ensure_dir('Users/%s/Documents' % guest, 2001)
            self.ensure_dir('Users/%s/Desktop' % guest, 2001)
        player = player_name.strip() or '主人'
        self.ensure_dir('Users/%s/Documents' % player, 2025)
        self.ensure_dir('Users/%s/Desktop' % player, 2025)
        self.ensure_dir('Users/%s/Pictures' % player, 2025)
        self.ensure_dir('Users/%s/Music' % player, 2025)
        self.ensure_dir('Users/%s/Secret' % player, 2025)
        self.write_file('Users/%s/Documents/入住协议.txt' % player, (
            '欢迎入住 GLOW-OS。\n'
            '本机已有 3 位房客入住过。你是第 4 位。\n'
            '前 3 位房客走的时候，都留下了一封信。\n'
            '如果你想找它们，去「Users」文件夹看看。\n'
            '—— 管理员（大概）\n'
        ), year=2025)

        # ---- Logs ----
        self.write_file('Logs/boot.log', (
            'GLOW-OS 1.0 启动日志\n'
            '第 1 次冷启动\n'
            '内存: 假装很大\n'
            '幽灵驱动: 已加载\n'
            '（每次你打开它，它都会数数。）\n'
        ), year=2001)
        self.write_file('Logs/error.log', (
            'ERROR 0xGHOST: 检测到不明访客。\n'
            'ERROR 0xGHOST: 访客是鬼。\n'
            'ERROR 0xGHOST: 习惯就好。\n'
        ), year=2003)
        self.write_file('Logs/access.log', (
            '（访问记录将由游戏在每次启动时用你的真实本地数据刷新。）\n'
        ), year=2003)

        # ---- $Recycle.Bin（回收站里的"用户文件"保留中文，符合真实使用习惯） ----
        self.write_file('$Recycle.Bin/已删除的便签1.txt', (
            '（被撕碎的便签，只留下几个字：）\n'
            '……不该……看见……那个文件夹……\n'
        ), year=2004)
        self.write_file('$Recycle.Bin/已删除的便签2.txt', (
            '（另一张便签，字迹发抖：）\n'
            '夜里有东西在动。不是咕噜。\n'
        ), year=2004)
        self.write_file('$Recycle.Bin/废弃快捷方式.lnk', (
            '快捷方式指向: C:\\ProgramData\\entry.txt\n'
            '（已被删除。为什么会被删除呢？）\n'
        ), year=2004, hidden=True)

        # ---- System Volume Information（"夜"：本来就不该进去的地方） ----
        self.write_file('System Volume Information/readme.txt', (
            '你找到这里了。\n'
            '这是系统的"夜"。\n'
            '有些文件只在夜里出现。\n'
            '如果你在看这行字，说明夜已经认了你。\n'
        ), year=2005, hidden=True)

        # ---- ProgramData（"深处"） ----
        self.write_file('ProgramData/entry.txt', (
            '这里是深处。\n'
            '再往里，就不是"系统"了。\n'
            '钥匙在「Recovery」里。找到它，把它带进来。\n'
        ), year=2005, hidden=True)

    # ---------------- 章节注入 ----------------
    def inject(self, files: List[Dict]) -> None:
        """story 章节开始时调用：向虚拟系统写入新文件（真实出现在资源管理器里）。
        files: [{path:'Users/x/y.txt', content:'...', year:2005, hidden:True, note:'章节5线索'}]
        """
        for spec in files:
            self.write_file(spec['path'], spec.get('content', ''),
                            year=spec.get('year'), hidden=spec.get('hidden', False))
            self.manifest_add(spec['path'], spec.get('note', '章节注入'))

    def exists(self, relpath: str) -> bool:
        return os.path.exists(os.path.join(self.cdrive, relpath))

    def full(self, relpath: str) -> str:
        return os.path.join(self.cdrive, relpath)
