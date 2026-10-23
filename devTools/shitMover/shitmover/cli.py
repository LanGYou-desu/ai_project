"""命令行入口与浏览器会话管理。"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from . import __version__
from .api import BiliApi, LoginRequired, RiskControl
from .config import Config, ConfigError, load_config
from .runner import comment_url, resolve_uids, run_post, run_scan, send_manual
from .state import StateStore

logger = logging.getLogger("shitmover")


def _setup_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def setup_logging(cfg: Config) -> None:
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False

    console = logging.StreamHandler()
    console.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    )
    logger.addHandler(console)

    cfg.log_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(cfg.log_file, encoding="utf-8")
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    )
    logger.addHandler(file_handler)


@contextmanager
def browser_session(cfg: Config, headless: bool) -> Iterator[tuple[Any, Any, BiliApi]]:
    from playwright.sync_api import sync_playwright

    cfg.profile_dir.mkdir(parents=True, exist_ok=True)
    playwright = sync_playwright().start()
    context = None
    try:
        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(cfg.profile_dir),
                headless=headless,
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                viewport={"width": 1440, "height": 900},
            )
        except Exception as exc:
            raise RuntimeError(
                f"启动浏览器失败：{exc}\n"
                f"请确认 {cfg.profile_dir} 没有被其他 Chrome/脚本占用。"
            ) from exc

        page = context.pages[0] if context.pages else context.new_page()
        page.goto(
            "https://www.bilibili.com/",
            wait_until="domcontentloaded",
            timeout=60000,
        )
        api = BiliApi(page, request_delay=cfg.request_delay_seconds)
        yield context, page, api
    finally:
        if context is not None:
            try:
                context.close()
            except Exception:
                pass
        try:
            playwright.stop()
        except Exception:
            pass


def ensure_login(context: Any, api: BiliApi, cfg: Config) -> None:
    if api.is_logged_in():
        logger.info("已检测到 B 站登录状态")
        return

    if cfg.headless:
        raise LoginRequired(
            "当前为无头模式，无法扫码登录。请先运行 python shit_mover.py login"
            "（会打开浏览器登录），或运行时加 --headful。"
        )

    logger.info("未登录，正在打开 B 站登录页...")
    login_page = context.new_page()
    login_page.goto(
        "https://passport.bilibili.com/login",
        wait_until="domcontentloaded",
        timeout=60000,
    )
    logger.info(
        "请在浏览器窗口中扫码或输入账号登录；登录成功后程序会自动继续（最多等待 %d 秒）。",
        cfg.login_timeout_seconds,
    )

    import time

    deadline = time.time() + cfg.login_timeout_seconds
    while time.time() < deadline:
        api.page.wait_for_timeout(3000)
        if api.is_logged_in():
            logger.info("登录成功")
            try:
                login_page.close()
            except Exception:
                pass
            return
    raise LoginRequired(
        f"等待登录超时（{cfg.login_timeout_seconds} 秒）。请重新运行 login 命令。"
    )


def _apply_overrides(cfg: Config, args: argparse.Namespace) -> None:
    if getattr(args, "keyword", None):
        keywords: list[str] = []
        for raw in args.keyword:
            for item in str(raw).split(","):
                keyword = item.strip()
                if keyword and keyword not in keywords:
                    keywords.append(keyword)
        if keywords:
            cfg.keywords = keywords

    if getattr(args, "posts", None) is not None:
        if args.posts < 1:
            raise ConfigError("--posts 必须大于 0")
        cfg.max_posts_per_run = args.posts

    if getattr(args, "headless", False):
        cfg.headless = True
    if getattr(args, "headful", False):
        cfg.headless = False


BVID_RE = re.compile(r"(?i)\bbv[0-9a-z]{10}\b")


def _parse_bvid(value: str) -> str:
    match = BVID_RE.search(str(value or "").strip())
    if not match:
        raise ConfigError(
            "无法识别视频 BV 号。请传入 BVID（如 BV1xx411c7mD）"
            "或包含 BVID 的视频链接。"
        )
    bvid = match.group(0)
    return "BV" + bvid[2:] if bvid[:2] != "BV" else bvid


def _parse_uids(values: list[str]) -> list[int]:
    uids: list[int] = []
    for raw in values:
        for item in re.split(r"[,，\s]+", str(raw).strip()):
            if not item:
                continue
            try:
                uid = int(item)
            except ValueError as exc:
                raise ConfigError(f"UID 不合法：{item!r}") from exc
            if uid <= 0:
                raise ConfigError(f"UID 必须大于 0：{uid}")
            if uid not in uids:
                uids.append(uid)
    if not uids:
        raise ConfigError("至少需要指定一个 --uid")
    return uids


def _add_browser_args(parser: argparse.ArgumentParser) -> None:
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--headless", action="store_true", help="无头模式运行浏览器")
    group.add_argument("--headful", action="store_true", help="显示浏览器窗口（覆盖配置）")


def _add_scan_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--keyword",
        action="append",
        help="覆盖配置中的搜索关键词，可多次指定或用逗号分隔",
    )
    parser.add_argument("--force", action="store_true", help="忽略已处理记录，重新检查")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="shit_mover.py",
        description="自动检索 B 站视频，筛选评论区 @ 比例高的视频，并 @ 好友或指定 UID。",
    )
    parser.add_argument("--version", action="version", version=__version__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    login = subparsers.add_parser("login", help="打开浏览器登录并保存登录状态")
    login.add_argument("--config", default="config.json", help="配置文件路径")
    login.add_argument(
        "--timeout", type=int, default=None, help="等待登录的秒数（默认读取配置）"
    )

    scan = subparsers.add_parser("scan", help="只检索并输出 @ 比例，不发布评论")
    scan.add_argument("--config", default="config.json", help="配置文件路径")
    _add_browser_args(scan)
    _add_scan_args(scan)
    scan.add_argument(
        "--guest",
        action="store_true",
        help="不要求登录直接扫描；未登录时 B 站只返回少量评论，统计不准确",
    )

    run = subparsers.add_parser("run", help="检索、筛选并自动 @ 好友或指定 UID")
    run.add_argument("--config", default="config.json", help="配置文件路径")
    _add_browser_args(run)
    _add_scan_args(run)
    run.add_argument("--posts", type=int, help="本次最多在多少个视频下发布")
    run.add_argument(
        "--uid",
        action="append",
        help="指定用户模式：只 @ 这些 UID；不写入主已发送记录，可重复或用逗号分隔",
    )
    run.add_argument("--dry-run", action="store_true", help="只展示计划，不发布")
    run.add_argument("--yes", action="store_true", help="跳过发布前确认")

    send = subparsers.add_parser(
        "send",
        help="额外命令：手动向指定视频 @ 指定 UID（不写入已发送记录）",
    )
    send.add_argument("video", help="视频 BVID 或完整视频链接")
    send.add_argument(
        "--uid",
        action="append",
        required=True,
        help="要 @ 的 UID，可多次指定或用逗号分隔",
    )
    send.add_argument("--config", default="config.json", help="配置文件路径")
    _add_browser_args(send)
    send.add_argument("--dry-run", action="store_true", help="只展示计划，不发布")
    send.add_argument("--yes", action="store_true", help="跳过发布前确认")

    status = subparsers.add_parser(
        "status", help="查看主已发送记录（不含指定 UID 模式和手动 send）"
    )
    status.add_argument("--config", default="config.json", help="配置文件路径")

    return parser


def _load(args: argparse.Namespace) -> Config:
    cfg = load_config(args.config)
    _apply_overrides(cfg, args)
    return cfg


def cmd_login(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    if args.timeout is not None:
        if args.timeout < 30:
            raise ConfigError("--timeout 不能小于 30 秒")
        cfg.login_timeout_seconds = args.timeout
    setup_logging(cfg)
    logger.info("浏览器配置目录：%s", cfg.profile_dir)
    with browser_session(cfg, headless=False) as (context, _page, api):
        ensure_login(context, api, cfg)
    logger.info("登录状态已保存到 %s", cfg.profile_dir)
    return 0


def cmd_scan(args: argparse.Namespace) -> int:
    cfg = _load(args)
    setup_logging(cfg)
    logger.info(
        "开始扫描：关键词=%s，阈值=%.1f%%，采样=%d 页/视频，目标找到 %d 个",
        "、".join(cfg.keywords),
        cfg.min_at_ratio * 100,
        cfg.sample_pages,
        cfg.max_posts_per_run,
    )
    state = StateStore(cfg.state_file)
    with browser_session(cfg, headless=cfg.headless) as (context, _page, api):
        if args.guest:
            if not api.is_logged_in():
                logger.warning(
                    "guest 模式：未登录时 B 站通常只返回少量评论，@ 比例仅供参考"
                )
        else:
            ensure_login(context, api, cfg)
        return run_scan(api, cfg, state, force=args.force)


def cmd_run(args: argparse.Namespace) -> int:
    cfg = _load(args)
    uids = _parse_uids(args.uid) if args.uid else None
    setup_logging(cfg)
    if uids:
        logger.info(
            "开始运行（指定用户模式）：关键词=%s，阈值=%.1f%%，UID=%d 个，"
            "目标搬史=%d 个视频%s",
            "、".join(cfg.keywords),
            cfg.min_at_ratio * 100,
            len(uids),
            cfg.max_posts_per_run,
            "（dry-run）" if args.dry_run else "",
        )
    else:
        cfg.validate_for_posting()
        logger.info(
            "开始运行：关键词=%s，阈值=%.1f%%，好友=%d 人，目标搬史=%d 个视频%s",
            "、".join(cfg.keywords),
            cfg.min_at_ratio * 100,
            len(cfg.friends),
            cfg.max_posts_per_run,
            "（dry-run）" if args.dry_run else "",
        )
    state = StateStore(cfg.state_file)
    with browser_session(cfg, headless=cfg.headless) as (context, _page, api):
        ensure_login(context, api, cfg)
        return run_post(
            api,
            cfg,
            state,
            dry_run=args.dry_run,
            assume_yes=args.yes,
            force=args.force,
            uids=uids,
        )


def cmd_send(args: argparse.Namespace) -> int:
    cfg = _load(args)
    setup_logging(cfg)
    bvid = _parse_bvid(args.video)
    uids = _parse_uids(args.uid)
    logger.info(
        "开始单独发送：视频=%s，UID=%d 个%s",
        bvid,
        len(uids),
        "（dry-run）" if args.dry_run else "",
    )
    with browser_session(cfg, headless=cfg.headless) as (context, _page, api):
        ensure_login(context, api, cfg)
        video = api.video_info(bvid)
        if video.aid <= 0:
            raise ConfigError(f"无法获取视频信息：{bvid}")
        logger.info("视频信息：%s | %s", video.bvid, video.title)
        friends = resolve_uids(api, uids)
        return send_manual(
            api,
            cfg,
            video,
            friends,
            dry_run=args.dry_run,
            assume_yes=args.yes,
        )


def cmd_status(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    state = StateStore(cfg.state_file)
    records = state.records()
    if not records:
        print("主已发送记录为空（指定 UID 模式和 send 不计入）。")
        return 0
    print(f"主记录已处理 {len(records)} 个视频（不含指定 UID 模式和 send）：")
    for bvid, record in sorted(
        records.items(), key=lambda item: item[1].get("posted_at", "")
    ):
        print(
            f"{bvid} | {record.get('status', '?'):7s} | "
            f"{record.get('posted_at', '?')} | rpid={record.get('first_rpid', '?')} | "
            f"{record.get('title', '')}"
        )
        chunks = record.get("chunks") or []
        if chunks:
            for chunk in chunks:
                rpid = chunk.get("rpid")
                if rpid:
                    print(f"    评论 {rpid}: {comment_url(bvid, rpid)}")
        elif record.get("first_rpid"):
            print(f"    {comment_url(bvid, record['first_rpid'])}")
    return 0


def main(argv: list[str] | None = None) -> int:
    _setup_console()
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "login":
            return cmd_login(args)
        if args.command == "scan":
            return cmd_scan(args)
        if args.command == "run":
            return cmd_run(args)
        if args.command == "send":
            return cmd_send(args)
        if args.command == "status":
            return cmd_status(args)
        parser.print_help()
        return 2
    except ConfigError as exc:
        print(f"配置错误：{exc}", file=sys.stderr)
        return 2
    except LoginRequired as exc:
        print(f"需要登录：{exc}", file=sys.stderr)
        return 3
    except RiskControl as exc:
        print(f"触发风控：{exc}", file=sys.stderr)
        return 4
    except KeyboardInterrupt:
        print("\n已中断。", file=sys.stderr)
        return 130
    except Exception as exc:
        logger.exception("运行失败：%s", exc)
        print(f"运行失败：{exc}", file=sys.stderr)
        return 1
