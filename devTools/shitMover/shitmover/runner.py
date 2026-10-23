"""检索、筛选、发表评论的主流程。"""

from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable

from .api import BiliApi, BiliError, CommentStats, LoginRequired, RiskControl, SearchVideo
from .config import Config, ConfigError
from .message import CommentChunk, FriendRef, build_comment_chunks
from .state import StateStore, UidStateStore

logger = logging.getLogger("shitmover")


@dataclass
class VideoCandidate:
    video: SearchVideo
    stats: CommentStats

    @property
    def ratio_text(self) -> str:
        return f"{self.stats.ratio * 100:.1f}%"


def _sleep(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def _post_sleep(cfg: Config) -> None:
    # 轻微随机化，避免固定节奏过于明显
    _sleep(cfg.post_delay_seconds * random.uniform(0.85, 1.15))


def comment_url(bvid: str, rpid: str | int) -> str:
    """评论在视频页中的跳转链接。"""
    return f"https://www.bilibili.com/video/{bvid}/#reply{rpid}"


def resolve_friends(api: BiliApi, cfg: Config) -> list[FriendRef]:
    resolved: list[FriendRef] = []
    for index, friend in enumerate(cfg.friends, start=1):
        try:
            name = api.resolve_user(friend.mid)
        except BiliError as exc:
            if friend.name:
                name = friend.name
                logger.warning(
                    "好友 %s 昵称解析失败（%s），使用配置中的 name=%s",
                    friend.mid,
                    exc,
                    name,
                )
            else:
                raise ConfigError(
                    f"好友 {friend.mid} 昵称解析失败，且配置中没有 name：{exc}"
                ) from exc
        name = name.strip()
        if not name:
            raise ConfigError(f"好友 {friend.mid} 的昵称为空")
        logger.info("好友 %d/%d：UID %s -> @%s", index, len(cfg.friends), friend.mid, name)
        resolved.append(FriendRef(mid=friend.mid, name=name))

    names = [friend.name for friend in resolved]
    duplicates = sorted({name for name in names if names.count(name) > 1})
    if duplicates:
        raise ConfigError(
            "以下好友昵称重复，无法精确 @："
            + "、".join(duplicates)
            + "。请确认账号昵称，或暂时移除其中一个。"
        )
    return resolved


SEARCH_PAGE_HARD_LIMIT = 50
SEARCH_PAGE_SIZE = 20


def iter_search_videos(api: BiliApi, cfg: Config):
    """按关键词和页码惰性地产出去重后的视频。

    search_pages=0 时自动翻页，直到结果耗尽或达到硬上限；
    调用方找满目标数量后会立即停止迭代，不再请求后续页面。
    """
    seen: set[str] = set()
    for keyword in cfg.keywords:
        try:
            api.open_search(keyword)
        except Exception as exc:
            logger.warning("打开搜索页失败（仍尝试接口搜索）：%s", exc)

        page = 1
        while True:
            try:
                videos = api.search_videos(keyword, page)
            except (LoginRequired, RiskControl):
                raise
            except BiliError as exc:
                logger.warning("搜索「%s」第 %d 页失败：%s", keyword, page, exc)
                break
            logger.info("搜索「%s」第 %d 页：%d 个结果", keyword, page, len(videos))
            if not videos:
                break
            for video in videos:
                if not video.bvid or video.aid <= 0 or video.bvid in seen:
                    continue
                seen.add(video.bvid)
                yield video

            if cfg.search_pages and page >= cfg.search_pages:
                break
            if page >= SEARCH_PAGE_HARD_LIMIT:
                logger.warning(
                    "搜索「%s」达到 %d 页硬上限，停止翻页",
                    keyword,
                    SEARCH_PAGE_HARD_LIMIT,
                )
                break
            if len(videos) < SEARCH_PAGE_SIZE:
                break
            page += 1
            _sleep(cfg.request_delay_seconds)
        _sleep(cfg.request_delay_seconds)


def scan_candidates(
    api: BiliApi,
    cfg: Config,
    state: StateStore,
    *,
    target: int | None = None,
    force: bool = False,
) -> list[VideoCandidate]:
    """持续搜索，直到找满 target 个符合条件的视频或搜索结果耗尽。"""
    if target is None:
        target = cfg.max_posts_per_run
    target = max(1, target)

    candidates: list[VideoCandidate] = []
    evaluated = 0
    skipped = 0

    for video in iter_search_videos(api, cfg):
        recorded_bvid = None if force else state.find_processed(video.bvid, video.aid)
        if recorded_bvid:
            old = state.get(recorded_bvid) or {}
            logger.info(
                "跳过已搬运过的视频 %s（状态=%s%s）",
                video.bvid,
                old.get("status", "unknown"),
                "" if recorded_bvid == video.bvid else f"，AID 匹配记录 {recorded_bvid}",
            )
            skipped += 1
            continue

        evaluated += 1
        logger.info(
            "[已检查 %d，已找到 %d/%d] %s | %s | UP：%s",
            evaluated,
            len(candidates),
            target,
            video.bvid,
            video.title,
            video.author,
        )
        try:
            stats = api.comment_stats(
                video.aid,
                pages=cfg.sample_pages,
                sort=cfg.comment_sort,
                include_replies=cfg.include_replies,
            )
        except (LoginRequired, RiskControl) as exc:
            logger.error("  停止搜索：%s", exc)
            raise
        except BiliError as exc:
            logger.warning("  读取评论失败，跳过：%s", exc)
            _sleep(cfg.request_delay_seconds)
            continue

        if stats.sampled == 0:
            logger.info("  没有可采样的评论（可能评论区关闭或评论数为 0），跳过")
            _sleep(cfg.request_delay_seconds)
            continue

        total = stats.total_comments or video.total_comments
        stats.total_comments = total
        qualifies = stats.ratio > cfg.min_at_ratio
        logger.info(
            "  @ 比例 %.1f%%（%d/%d 条），总评论 %d，%s（阈值 %.1f%%）",
            stats.ratio * 100,
            stats.at_comments,
            stats.sampled,
            total,
            "符合" if qualifies else "不符合",
            cfg.min_at_ratio * 100,
        )
        if qualifies:
            candidates.append(VideoCandidate(video=video, stats=stats))
            logger.info("  已找到 %d/%d 个符合阈值的视频", len(candidates), target)
            if len(candidates) >= target:
                logger.info("已找满 %d 个符合条件的视频，停止搜索", target)
                break
        _sleep(cfg.request_delay_seconds)

    candidates.sort(key=lambda item: item.stats.ratio, reverse=True)
    logger.info(
        "搜索检查完成：检查 %d 个新视频，跳过 %d 个已搬运视频，"
        "找到 %d/%d 个超过 @ 比例阈值的视频",
        evaluated,
        skipped,
        len(candidates),
        target,
    )
    return candidates


def render_content(cfg: Config, candidate: VideoCandidate) -> str:
    values = {
        "title": candidate.video.title,
        "url": candidate.video.url,
        "bvid": candidate.video.bvid,
        "author": candidate.video.author,
        "ratio": candidate.ratio_text,
        "at_comments": candidate.stats.at_comments,
        "sampled": candidate.stats.sampled,
        "total_comments": candidate.stats.total_comments,
    }
    try:
        return cfg.comment_template.format(**values)
    except KeyError as exc:
        raise ConfigError(
            f"comment_template 包含未知占位符 {exc}。"
            "可用占位符：title、url、bvid、author、ratio、at_comments、sampled、total_comments"
        ) from exc


def plan_candidate(
    cfg: Config, candidate: VideoCandidate, friends: list[FriendRef]
) -> tuple[str, list[CommentChunk]]:
    content = render_content(cfg, candidate)
    chunks = build_comment_chunks(
        friends,
        content,
        per_comment=cfg.mentions_per_comment,
        reply_suffix=cfg.reply_suffix,
        max_length=cfg.max_comment_length,
    )
    return content, chunks


def _log_plan(video: SearchVideo, chunks: list[CommentChunk]) -> None:
    logger.info(
        "  %s 将发布 %d 条评论，共 @ %d 人",
        video.bvid,
        len(chunks),
        sum(len(chunk.at_map) for chunk in chunks),
    )
    for chunk in chunks:
        names = " ".join(f"@{name}" for name in chunk.at_map)
        action = "回复首条评论" if chunk.is_reply else "发表首条评论"
        logger.info(
            "    第 %d 条（%s）：%s",
            chunk.index + 1,
            action,
            names,
        )


def _publish_chunks(
    api: BiliApi,
    cfg: Config,
    video: SearchVideo,
    chunks: list[CommentChunk],
    *,
    on_chunk: (
        Callable[[CommentChunk, str, str, list[dict[str, Any]]], None] | None
    ) = None,
) -> tuple[str, list[dict[str, Any]]]:
    """发布评论块；on_chunk 用于正常搬运时逐条写入状态。"""
    logger.info("  打开视频页：%s", video.url)
    api.open_video(video.url)

    first_rpid: str | None = None
    posted_chunks: list[dict[str, Any]] = []
    for chunk in chunks:
        root = first_rpid if chunk.is_reply else None
        parent = first_rpid if chunk.is_reply else None
        if chunk.is_reply and not first_rpid:
            raise BiliError("首条评论没有返回 rpid，无法继续回复")

        data = api.post_comment(
            video.aid,
            chunk.message,
            root=root,
            parent=parent,
            at_map=chunk.at_map,
        )
        rpid = str(data.get("rpid_str") or data.get("rpid") or "").strip()
        if not rpid:
            raise BiliError("发表评论成功，但接口未返回 rpid")

        if chunk.index == 0:
            first_rpid = rpid
        if first_rpid is None:
            raise BiliError("首条评论没有返回 rpid")
        jump_url = comment_url(video.bvid, rpid)
        posted_chunks.append(
            {
                "rpid": rpid,
                "url": jump_url,
                "mentions": list(chunk.at_map.values()),
                "message": chunk.message,
            }
        )
        logger.info(
            "  第 %d/%d 条已发布，rpid=%s", chunk.index + 1, len(chunks), rpid
        )
        logger.info("  评论链接：%s", jump_url)

        if on_chunk is not None:
            on_chunk(chunk, rpid, first_rpid, posted_chunks)
        if chunk.index < len(chunks) - 1:
            _post_sleep(cfg)

    if first_rpid is None:
        raise BiliError("没有发布任何评论")
    logger.info("  %s 发布完成，首条 rpid=%s", video.bvid, first_rpid)
    logger.info("  首条评论链接：%s", comment_url(video.bvid, first_rpid))
    return first_rpid, posted_chunks


def post_candidate(
    api: BiliApi,
    cfg: Config,
    candidate: VideoCandidate,
    friends: list[FriendRef],
    state: StateStore | UidStateStore | None,
) -> dict[str, Any]:
    content, chunks = plan_candidate(cfg, candidate, friends)
    _log_plan(candidate.video, chunks)

    def record_chunk(
        chunk: CommentChunk,
        rpid: str,
        first_rpid: str,
        posted_chunks: list[dict[str, Any]],
    ) -> None:
        if state is None:
            return
        is_last = chunk.index == len(chunks) - 1
        state.mark(
            candidate.video.bvid,
            {
                "aid": candidate.video.aid,
                "title": candidate.video.title,
                "url": candidate.video.url,
                "ratio": round(candidate.stats.ratio, 6),
                "at_comments": candidate.stats.at_comments,
                "sampled": candidate.stats.sampled,
                "total_comments": candidate.stats.total_comments,
                "status": "done" if is_last else "partial",
                "first_rpid": first_rpid,
                "chunks": posted_chunks,
                "posted_at": datetime.now().isoformat(timespec="seconds"),
            },
        )

    first_rpid, posted_chunks = _publish_chunks(
        api,
        cfg,
        candidate.video,
        chunks,
        on_chunk=record_chunk,
    )
    return {"rpid": first_rpid, "chunks": posted_chunks}


def resolve_uids(api: BiliApi, uids: list[int]) -> list[FriendRef]:
    """解析指定 UID，不依赖 config.json 的 friends。"""
    if not uids:
        raise ConfigError("至少需要指定一个 UID")
    if len(uids) != len(set(uids)):
        raise ConfigError("--uid 中存在重复 UID")

    resolved: list[FriendRef] = []
    for index, mid in enumerate(uids, start=1):
        try:
            name = api.resolve_user(mid)
        except (LoginRequired, RiskControl):
            raise
        except BiliError as exc:
            raise ConfigError(f"UID {mid} 昵称解析失败：{exc}") from exc
        name = name.strip()
        if not name:
            raise ConfigError(f"UID {mid} 的昵称为空")
        logger.info(
            "指定用户目标 %d/%d：UID %s -> @%s", index, len(uids), mid, name
        )
        resolved.append(FriendRef(mid=mid, name=name))

    names = [friend.name for friend in resolved]
    duplicates = sorted({name for name in names if names.count(name) > 1})
    if duplicates:
        raise ConfigError(
            "以下 UID 的昵称重复，无法精确 @："
            + "、".join(duplicates)
            + "。请确认账号昵称后再发送。"
        )
    return resolved


def send_manual(
    api: BiliApi,
    cfg: Config,
    video: SearchVideo,
    friends: list[FriendRef],
    *,
    dry_run: bool = False,
    assume_yes: bool = False,
) -> int:
    """单独向指定视频发送纯 @ 评论，不写入已发送状态。"""
    chunks = build_comment_chunks(
        friends,
        "",
        per_comment=cfg.mentions_per_comment,
        reply_suffix="",
        max_length=cfg.max_comment_length,
    )
    logger.info("单独发送：%s | %s", video.bvid, video.title)
    _log_plan(video, chunks)

    if dry_run:
        logger.info("dry-run 模式：只展示计划，不发布评论。")
        print(f"\n=== {video.bvid} {video.title} ===")
        for chunk in chunks:
            print(f"--- 第 {chunk.index + 1} 条 ---")
            print(chunk.message)
        return 0

    if not assume_yes and cfg.require_confirm:
        try:
            answer = input(
                f"即将在 {video.bvid} 下发布 {len(chunks)} 条评论，"
                f"@ {len(friends)} 人，确认继续？[y/N] "
            ).strip().lower()
        except EOFError:
            answer = ""
        if answer not in {"y", "yes"}:
            logger.info("已取消单独发送")
            return 0

    first_rpid, _posted = _publish_chunks(api, cfg, video, chunks)
    logger.info("单独发送完成：%s，首条 rpid=%s", video.bvid, first_rpid)
    logger.info("本次为单独发送，未写入已发送记录，不计入已发送部分")
    return 0


def run_scan(api: BiliApi, cfg: Config, state: StateStore, *, force: bool = False) -> int:
    candidates = scan_candidates(
        api, cfg, state, target=cfg.max_posts_per_run, force=force
    )
    if not candidates:
        logger.info("没有找到 @ 比例超过 %.1f%% 的视频", cfg.min_at_ratio * 100)
        return 0

    logger.info("符合阈值的视频（按 @ 比例从高到低）：")
    for index, candidate in enumerate(candidates, start=1):
        video = candidate.video
        logger.info(
            "%2d. %s | %s | @比例 %s（%d/%d）| 总评论 %d",
            index,
            video.bvid,
            video.title,
            candidate.ratio_text,
            candidate.stats.at_comments,
            candidate.stats.sampled,
            candidate.stats.total_comments,
        )
        logger.info("    %s", video.url)
    return 0


def run_post(
    api: BiliApi,
    cfg: Config,
    state: StateStore,
    *,
    dry_run: bool = False,
    assume_yes: bool = False,
    force: bool = False,
    uids: list[int] | None = None,
) -> int:
    uid_state: UidStateStore | None = None
    if uids:
        friends = resolve_uids(api, uids)
        uid_state = UidStateStore(
            StateStore(cfg.state_file.with_name("uid_state.json")),
            uids,
        )
        scan_state = uid_state
        logger.info(
            "指定用户模式：只 @ %d 个 UID；按 UID 分别记录，"
            "不使用/写入主已发送记录",
            len(friends),
        )
    else:
        cfg.validate_for_posting()
        friends = resolve_friends(api, cfg)
        scan_state = state

    candidates = scan_candidates(
        api, cfg, scan_state, target=cfg.max_posts_per_run, force=force
    )
    if not candidates:
        logger.info("没有找到符合条件的视频，未发布任何评论")
        return 0

    def friends_and_state(
        candidate: VideoCandidate,
    ) -> tuple[list[FriendRef], StateStore | UidStateStore]:
        """指定用户模式下过滤掉已经收过该视频的 UID。"""
        if uid_state is None:
            return friends, state
        if force:
            return friends, uid_state
        remaining = uid_state.remaining_uids(
            candidate.video.bvid, candidate.video.aid
        )
        if not remaining:
            return [], uid_state
        filtered = [friend for friend in friends if friend.mid in remaining]
        return filtered, UidStateStore(uid_state.store, list(remaining))

    logger.info("")
    logger.info("计划发布（本次最多 %d 个视频）：", min(len(candidates), cfg.max_posts_per_run))
    target_count = min(len(candidates), cfg.max_posts_per_run)
    target = candidates[:target_count]
    for index, candidate in enumerate(target, start=1):
        candidate_friends, _ = friends_and_state(candidate)
        if not candidate_friends:
            logger.info(
                "%2d. %s | 所有目标 UID 都已收到，跳过",
                index,
                candidate.video.bvid,
            )
            continue
        content, chunks = plan_candidate(cfg, candidate, candidate_friends)
        logger.info(
            "%2d. %s | @比例 %s | %d 条评论 | @ %d 人",
            index,
            candidate.video.bvid,
            candidate.ratio_text,
            len(chunks),
            len(candidate_friends),
        )
        if content:
            logger.info("    正文：%s", content.replace("\n", " / "))
        for chunk in chunks:
            action = "回复首条评论" if chunk.is_reply else "发表首条评论"
            logger.info(
                "    %s：%s",
                action,
                " ".join(f"@{name}" for name in chunk.at_map),
            )

    if dry_run:
        logger.info("")
        logger.info("dry-run 模式：只展示计划，不发布评论。")
        for candidate in target:
            candidate_friends, _ = friends_and_state(candidate)
            if not candidate_friends:
                continue
            _content, chunks = plan_candidate(cfg, candidate, candidate_friends)
            print(f"\n=== {candidate.video.bvid} {candidate.video.title} ===")
            for chunk in chunks:
                print(f"--- 第 {chunk.index + 1} 条 ---")
                print(chunk.message)
        return 0

    if not assume_yes and cfg.require_confirm:
        try:
            answer = input(
                f"即将在 {target_count} 个视频下发布评论，确认继续？[y/N] "
            ).strip().lower()
        except EOFError:
            answer = ""
        if answer not in {"y", "yes"}:
            logger.info("已取消发布")
            return 0

    posted = 0
    for index, candidate in enumerate(target, start=1):
        if not force and scan_state.is_processed_video(
            candidate.video.bvid, candidate.video.aid
        ):
            logger.info(
                "  发布前复查：%s 已经搬运过，跳过",
                candidate.video.bvid,
            )
            continue
        candidate_friends, candidate_state = friends_and_state(candidate)
        if not candidate_friends:
            logger.info(
                "  %s：所有目标 UID 都已收到，跳过",
                candidate.video.bvid,
            )
            continue
        logger.info("")
        logger.info(
            "[%d/%d] 处理 %s | @比例 %s | @ %d 人",
            index,
            target_count,
            candidate.video.bvid,
            candidate.ratio_text,
            len(candidate_friends),
        )
        try:
            post_candidate(
                api, cfg, candidate, candidate_friends, candidate_state
            )
            posted += 1
        except (LoginRequired, RiskControl):
            raise
        except BiliError as exc:
            logger.error("  发布失败：%s", exc)
        except Exception as exc:  # 浏览器页面异常等，继续下一个视频
            logger.exception("  发布过程出现异常：%s", exc)

        if index < target_count:
            _post_sleep(cfg)

    logger.info("")
    if uids:
        logger.info(
            "本次指定用户运行结束：成功 %d 个，目标 %d 个（未写入主已发送记录）",
            posted,
            target_count,
        )
    else:
        logger.info("本次运行结束：成功 %d 个，目标 %d 个", posted, target_count)
    return 0
