"""配置加载与校验。"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ConfigError(ValueError):
    """配置文件错误。"""


@dataclass(frozen=True)
class Friend:
    mid: int
    name: str = ""


DEFAULTS: dict[str, Any] = {
    "keywords": ["抽象"],
    "search_pages": 0,
    "min_at_ratio": 0.05,
    "sample_pages": 3,
    "comment_sort": "hot",
    "include_replies": False,
    "friends": [],
    "comment_template": "",
    "reply_suffix": "",
    "mentions_per_comment": 10,
    "max_comment_length": 1000,
    "max_posts_per_run": 2,
    "post_delay_seconds": 10,
    "request_delay_seconds": 0.8,
    "require_confirm": True,
    "headless": False,
    "profile_dir": "browser_profile",
    "state_file": "data/state.json",
    "log_file": "data/run.log",
    "login_timeout_seconds": 300,
}


@dataclass
class Config:
    keywords: list[str]
    friends: list[Friend]
    search_pages: int
    min_at_ratio: float
    sample_pages: int
    comment_sort: str
    include_replies: bool
    comment_template: str
    reply_suffix: str
    mentions_per_comment: int
    max_comment_length: int
    max_posts_per_run: int
    post_delay_seconds: float
    request_delay_seconds: float
    require_confirm: bool
    headless: bool
    login_timeout_seconds: int
    base_dir: Path
    profile_dir: Path
    state_file: Path
    log_file: Path
    source_path: Path = field(default_factory=Path)

    def validate_for_posting(self) -> None:
        if not self.friends:
            raise ConfigError(
                "config.json 中的 friends 为空。请至少填写一个好友 UID（也可写成 "
                '{"mid": 123456, "name": "昵称"}）。'
            )
        mids = [friend.mid for friend in self.friends]
        if len(mids) != len(set(mids)):
            raise ConfigError("friends 中存在重复的 UID")


def _as_int(value: Any, name: str, minimum: int | None = None) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{name} 必须是整数") from exc
    if minimum is not None and result < minimum:
        raise ConfigError(f"{name} 不能小于 {minimum}")
    return result


def _as_float(value: Any, name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{name} 必须是数字") from exc


def _as_bool(value: Any, name: str) -> bool:
    if isinstance(value, bool):
        return value
    raise ConfigError(f"{name} 必须是 true 或 false")


def _parse_friends(value: Any) -> list[Friend]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ConfigError("friends 必须是数组，例如 [123456, 234567]")

    friends: list[Friend] = []
    for item in value:
        if isinstance(item, bool):
            raise ConfigError("friends 中的 UID 不合法")
        if isinstance(item, (int, str)):
            try:
                mid = int(item)
            except (TypeError, ValueError) as exc:
                raise ConfigError(f"friends 中的 UID 不合法：{item!r}") from exc
            friends.append(Friend(mid=mid))
            continue
        if isinstance(item, dict):
            if "mid" not in item:
                raise ConfigError(f"friends 项缺少 mid：{item!r}")
            mid = _as_int(item["mid"], "friends[].mid", minimum=1)
            name = str(item.get("name", "") or "").strip()
            friends.append(Friend(mid=mid, name=name))
            continue
        raise ConfigError(f"无法识别的 friends 项：{item!r}")

    for friend in friends:
        if friend.mid <= 0:
            raise ConfigError(f"好友 UID 必须大于 0：{friend.mid}")
    return friends


def load_config(path: str | Path) -> Config:
    source_path = Path(path)
    if not source_path.is_absolute():
        source_path = (Path.cwd() / source_path).resolve()

    if not source_path.exists():
        example = source_path.parent / "config.example.json"
        if example.exists():
            source_path.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
            raise ConfigError(
                f"未找到 {source_path}，已根据 config.example.json 创建。"
                "请填写 friends 后重新运行。"
            )
        raise ConfigError(f"配置文件不存在：{source_path}")

    try:
        raw = json.loads(source_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ConfigError(
            f"配置文件不是合法 JSON：第 {exc.lineno} 行第 {exc.colno} 列，{exc.msg}"
        ) from exc
    if not isinstance(raw, dict):
        raise ConfigError("配置文件顶层必须是 JSON 对象")

    values = {**DEFAULTS, **raw}
    base_dir = source_path.parent

    keywords_raw = values.get("keywords")
    if isinstance(keywords_raw, str):
        keywords = [keywords_raw]
    elif isinstance(keywords_raw, list):
        keywords = [str(item).strip() for item in keywords_raw if str(item).strip()]
    else:
        raise ConfigError("keywords 必须是字符串数组")
    if not keywords:
        raise ConfigError("keywords 不能为空")

    min_at_ratio = _as_float(values["min_at_ratio"], "min_at_ratio")
    if not 0 <= min_at_ratio <= 1:
        raise ConfigError("min_at_ratio 应在 0 到 1 之间，例如 0.05 表示 5%")

    search_pages = _as_int(values["search_pages"], "search_pages", minimum=0)
    if search_pages > 50:
        raise ConfigError("search_pages 不能超过 50；设为 0 表示自动翻页直到找满数量")

    mentions_per_comment = _as_int(
        values["mentions_per_comment"], "mentions_per_comment", minimum=1
    )
    if mentions_per_comment > 10:
        raise ConfigError("mentions_per_comment 最大为 10（B 站单条评论限制）")

    max_comment_length = _as_int(
        values["max_comment_length"], "max_comment_length", minimum=50
    )
    if max_comment_length > 1000:
        raise ConfigError("max_comment_length 不能超过 1000")

    comment_sort = str(values["comment_sort"]).strip().lower()
    if comment_sort not in {"hot", "new"}:
        raise ConfigError('comment_sort 只能是 "hot" 或 "new"')

    profile_dir = Path(str(values["profile_dir"]))
    state_file = Path(str(values["state_file"]))
    log_file = Path(str(values["log_file"]))

    def resolve(value: Path) -> Path:
        return value if value.is_absolute() else (base_dir / value).resolve()

    return Config(
        keywords=keywords,
        friends=_parse_friends(values.get("friends")),
        search_pages=search_pages,
        min_at_ratio=min_at_ratio,
        sample_pages=_as_int(values["sample_pages"], "sample_pages", minimum=1),
        comment_sort=comment_sort,
        include_replies=_as_bool(values["include_replies"], "include_replies"),
        comment_template=str(values["comment_template"]),
        reply_suffix=str(values["reply_suffix"]),
        mentions_per_comment=mentions_per_comment,
        max_comment_length=max_comment_length,
        max_posts_per_run=_as_int(
            values["max_posts_per_run"], "max_posts_per_run", minimum=1
        ),
        post_delay_seconds=_as_float(
            values["post_delay_seconds"], "post_delay_seconds"
        ),
        request_delay_seconds=_as_float(
            values["request_delay_seconds"], "request_delay_seconds"
        ),
        require_confirm=_as_bool(values["require_confirm"], "require_confirm"),
        headless=_as_bool(values["headless"], "headless"),
        login_timeout_seconds=_as_int(
            values["login_timeout_seconds"], "login_timeout_seconds", minimum=30
        ),
        base_dir=base_dir,
        profile_dir=resolve(profile_dir),
        state_file=resolve(state_file),
        log_file=resolve(log_file),
        source_path=source_path,
    )
