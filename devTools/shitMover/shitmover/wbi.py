"""B 站 WBI 签名。

B 站部分 Web API（搜索、发表评论等）要求对查询参数做 WBI 签名。
签名算法：取 nav 接口返回的 img_key/sub_key，按固定表重排出 mixin_key，
再将参数按 key 排序拼接，追加 wts，最后计算 md5(query + mixin_key)。
"""

from __future__ import annotations

import hashlib
import re
import time
from typing import Any, Mapping
from urllib.parse import urlencode

MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]


class WbiError(RuntimeError):
    """WBI 密钥或签名异常。"""


def mixin_key(img_key: str, sub_key: str) -> str:
    """由 img_key 和 sub_key 生成 32 位 mixin_key。"""
    orig = f"{img_key}{sub_key}"
    if len(orig) < 64:
        raise WbiError("WBI 密钥长度异常")
    return "".join(orig[i] for i in MIXIN_KEY_ENC_TAB)[:32]


def sign(
    params: Mapping[str, Any],
    img_key: str,
    sub_key: str,
    wts: int | None = None,
) -> dict[str, Any]:
    """返回带 wts / w_rid 的参数字典。"""
    cleaned = {key: value for key, value in params.items() if value is not None}
    cleaned["wts"] = int(time.time()) if wts is None else int(wts)
    ordered = dict(sorted(cleaned.items()))
    query = urlencode(ordered)
    query = re.sub(r"[!'()*]", "", query)
    ordered["w_rid"] = hashlib.md5(
        f"{query}{mixin_key(img_key, sub_key)}".encode("utf-8")
    ).hexdigest()
    return ordered
