"""评论内容与 @ 分块。"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass


@dataclass(frozen=True)
class FriendRef:
    mid: int
    name: str


@dataclass(frozen=True)
class CommentChunk:
    index: int
    message: str
    at_map: dict[str, int]
    is_reply: bool


def build_comment_chunks(
    friends: list[FriendRef],
    content: str,
    per_comment: int = 10,
    reply_suffix: str = "",
    max_length: int = 1000,
) -> list[CommentChunk]:
    """把好友分成每条最多 per_comment 人的若干评论。

    第一条评论附带正文；后续评论通过回复第一条评论继续 @。
    返回顺序即发布顺序。
    """
    if not friends:
        raise ValueError("好友列表为空")
    if not 1 <= per_comment <= 10:
        raise ValueError("每条评论最多只能 @ 10 人")

    names = [friend.name.strip() for friend in friends]
    for name in names:
        if not name:
            raise ValueError("好友昵称为空")
    duplicates = sorted(name for name, count in Counter(names).items() if count > 1)
    if duplicates:
        raise ValueError(
            "以下好友昵称重复，无法用 at_name_to_mid 精确区分："
            + "、".join(duplicates)
            + "。请确认这些账号的昵称，或暂时移除其中一个。"
        )

    chunks: list[CommentChunk] = []
    for index, start in enumerate(range(0, len(friends), per_comment)):
        part = friends[start : start + per_comment]
        mentions = " ".join(f"@{friend.name.strip()}" for friend in part)
        at_map = {friend.name.strip(): friend.mid for friend in part}

        if index == 0:
            message = mentions + (f"\n{content}" if content else "")
        else:
            message = mentions + (f"\n{reply_suffix}" if reply_suffix else "")

        if len(message) > max_length:
            raise ValueError(
                f"第 {index + 1} 条评论长度 {len(message)} 超过上限 {max_length}，"
                "请缩短 comment_template 或减少单条 @ 人数"
            )
        chunks.append(
            CommentChunk(
                index=index,
                message=message,
                at_map=at_map,
                is_reply=index > 0,
            )
        )
    return chunks
