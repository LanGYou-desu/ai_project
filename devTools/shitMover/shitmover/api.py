"""在已登录的浏览器上下文中调用 B 站 Web API。"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from html import unescape
from typing import Any
from urllib.parse import quote, urlencode

from .wbi import sign

API_BASE = "https://api.bilibili.com"
COMMENT_PAGE_SIZE = 20

_FETCH_JS = r"""
async ({url, method, body}) => {
  try {
    const options = {method, credentials: "include"};
    if (body !== null && body !== undefined) {
      options.headers = {"Content-Type": "application/x-www-form-urlencoded"};
      options.body = body;
    }
    const response = await fetch(url, options);
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (err) { data = null; }
    return {
      status: response.status,
      data: data,
      text: data === null ? text.slice(0, 800) : null
    };
  } catch (err) {
    return {status: 0, data: null, text: String(err)};
  }
}
"""


class BiliError(RuntimeError):
    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


class LoginRequired(BiliError):
    pass


class RiskControl(BiliError):
    pass


@dataclass
class SearchVideo:
    bvid: str
    aid: int
    title: str
    author: str
    play: int
    total_comments: int
    url: str
    duration: str = ""


@dataclass
class CommentStats:
    total_comments: int
    sampled: int
    at_comments: int

    @property
    def ratio(self) -> float:
        return self.at_comments / self.sampled if self.sampled else 0.0


def clean_title(value: str) -> str:
    return unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class BiliApi:
    def __init__(self, page: Any, request_delay: float = 0.8):
        self.page = page
        self.request_delay = max(0.0, request_delay)
        self._wbi_keys: tuple[str, str] | None = None
        self._csrf: str | None = None
        self._user_cache: dict[int, str] = {}

    # ---------- 底层请求 ----------

    def _request_json(
        self, url: str, method: str = "GET", body: str | None = None
    ) -> dict[str, Any]:
        try:
            result = self.page.evaluate(
                _FETCH_JS, {"url": url, "method": method, "body": body}
            )
        except Exception as exc:  # Playwright 异常
            raise BiliError(f"浏览器请求失败：{exc}") from exc

        status = _to_int(result.get("status"))
        if status == 0:
            raise BiliError(f"网络请求失败：{result.get('text')}")
        if status in (412, 429):
            raise RiskControl(
                f"B 站接口触发风控（HTTP {status}）。请立即停止本次运行，"
                "等待 10-30 分钟（必要时更久）后再试，不要连续重试。"
                "建议把 --posts 降到 2-5，sample_pages 降到 1-2，"
                "并把 request_delay_seconds 调到 2-3 秒。"
            )
        data = result.get("data")
        if not isinstance(data, dict):
            raise BiliError(
                f"接口返回非 JSON（HTTP {status}）：{result.get('text')}"
            )
        return data

    def _unwrap(self, payload: dict[str, Any], action: str) -> Any:
        code = payload.get("code")
        if code == 0:
            return payload.get("data")
        message = payload.get("message") or payload.get("msg") or "未知错误"
        if code == -101:
            self._csrf = None
            raise LoginRequired("未登录或登录已失效，请先运行 login 命令登录")
        if code in (-352, -412, 412, 12015):
            raise RiskControl(
                f"{action}触发 B 站风控：[{code}] {message}。"
                "请稍后重试，或先手动在浏览器中完成一次评论/验证。"
            )
        if code == 12002:
            raise BiliError("该视频评论区已关闭", code)
        raise BiliError(f"{action}失败：[{code}] {message}", code)

    def nav(self) -> dict[str, Any]:
        return self._request_json(f"{API_BASE}/x/web-interface/nav")

    def is_logged_in(self) -> bool:
        payload = self.nav()
        return payload.get("code") == 0 and bool(
            (payload.get("data") or {}).get("isLogin")
        )

    def _ensure_wbi(self, force: bool = False) -> tuple[str, str]:
        if self._wbi_keys and not force:
            return self._wbi_keys
        payload = self.nav()
        data = payload.get("data") or {}
        wbi_img = data.get("wbi_img") or {}
        img_url = str(wbi_img.get("img_url") or "")
        sub_url = str(wbi_img.get("sub_url") or "")
        if not img_url or not sub_url:
            self._unwrap(payload, "获取 WBI 密钥")
            raise BiliError("获取 WBI 密钥失败：响应缺少 wbi_img")
        img_key = img_url.rsplit("/", 1)[-1].split(".")[0]
        sub_key = sub_url.rsplit("/", 1)[-1].split(".")[0]
        self._wbi_keys = (img_key, sub_key)
        return self._wbi_keys

    def _signed_request(self, method: str, path: str, params: dict[str, Any]) -> Any:
        last_error: BiliError | None = None
        for attempt in range(2):
            img_key, sub_key = self._ensure_wbi(force=attempt > 0)
            signed = sign(params, img_key, sub_key)
            if method == "GET":
                url = f"{API_BASE}{path}?{urlencode(signed)}"
                payload = self._request_json(url)
            else:
                payload = self._request_json(
                    f"{API_BASE}{path}", "POST", urlencode(signed)
                )
            if payload.get("code") in (-403, 403) and attempt == 0:
                last_error = BiliError(
                    f"{path} WBI 签名失效：[{payload.get('code')}] "
                    f"{payload.get('message')}"
                )
                continue
            return self._unwrap(payload, path)
        raise last_error or BiliError(f"{path} 请求失败")

    def _unsigned_get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{API_BASE}{path}"
        if params:
            url = f"{url}?{urlencode(params)}"
        return self._unwrap(self._request_json(url), path)

    def _signed_get(self, path: str, params: dict[str, Any]) -> Any:
        return self._signed_request("GET", path, params)

    def _signed_post(self, path: str, params: dict[str, Any]) -> Any:
        return self._signed_request("POST", path, params)

    # ---------- 业务接口 ----------

    def open_search(self, keyword: str) -> None:
        """在浏览器中打开 B 站搜索页，再通过接口取结构化结果。"""
        url = f"https://search.bilibili.com/all?keyword={quote(keyword)}"
        self.page.goto(url, wait_until="domcontentloaded", timeout=60000)
        self.page.wait_for_timeout(800)

    def search_videos(self, keyword: str, page: int = 1) -> list[SearchVideo]:
        data = self._signed_get(
            "/x/web-interface/wbi/search/type",
            {"search_type": "video", "keyword": keyword, "page": page},
        )
        items = (data or {}).get("result") or []
        videos: list[SearchVideo] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            bvid = str(item.get("bvid") or "").strip()
            if not bvid:
                continue
            videos.append(
                SearchVideo(
                    bvid=bvid,
                    aid=_to_int(item.get("aid")),
                    title=clean_title(str(item.get("title") or "")),
                    author=str(item.get("author") or ""),
                    play=_to_int(item.get("play")),
                    total_comments=_to_int(item.get("review")),
                    url=f"https://www.bilibili.com/video/{bvid}/",
                    duration=str(item.get("duration") or ""),
                )
            )
        return videos

    def video_info(self, bvid: str) -> SearchVideo:
        data = self._unsigned_get("/x/web-interface/view", {"bvid": bvid}) or {}
        owner = data.get("owner") or {}
        stat = data.get("stat") or {}
        return SearchVideo(
            bvid=str(data.get("bvid") or bvid),
            aid=_to_int(data.get("aid")),
            title=str(data.get("title") or ""),
            author=str(owner.get("name") or ""),
            play=_to_int(stat.get("view")),
            total_comments=_to_int(stat.get("reply")),
            url=f"https://www.bilibili.com/video/{bvid}/",
            duration=str(data.get("duration") or ""),
        )

    def resolve_user(self, mid: int) -> str:
        """通过 UID 获取当前昵称。"""
        if mid in self._user_cache:
            return self._user_cache[mid]

        payload = self._request_json(
            f"{API_BASE}/x/web-interface/card?mid={mid}&photo=false"
        )
        if payload.get("code") == 0:
            card = (payload.get("data") or {}).get("card") or {}
            name = str(card.get("name") or "").strip()
            if name:
                self._user_cache[mid] = name
                return name

        # 兼容 card 接口失效的情况
        try:
            data = self._signed_get("/x/space/wbi/acc/info", {"mid": mid}) or {}
            name = str(data.get("name") or "").strip()
        except BiliError:
            name = ""
        if not name:
            raise BiliError(
                f"无法解析好友 UID {mid} 的昵称。请在 config.json 中为该好友填写 name。"
            )
        self._user_cache[mid] = name
        return name

    def fetch_comments(
        self, aid: int, pages: int = 3, sort: str = "hot"
    ) -> tuple[list[dict[str, Any]], int]:
        """获取置顶/热门评论，返回 (评论列表, 评论总数)。"""
        sort_code = 2 if sort == "hot" else 0
        replies: list[dict[str, Any]] = []
        seen: set[str] = set()
        total = 0

        for page_no in range(1, pages + 1):
            params = {
                "type": 1,
                "oid": aid,
                "pn": page_no,
                "ps": COMMENT_PAGE_SIZE,
                "sort": sort_code,
            }
            payload = self._request_json(
                f"{API_BASE}/x/v2/reply?{urlencode(params)}"
            )
            if payload.get("code") == 12002:
                return [], total
            data = self._unwrap(payload, f"读取第 {page_no} 页评论") or {}
            page_info = data.get("page") or {}
            total = max(total, _to_int(page_info.get("count")))
            batch = [item for item in (data.get("replies") or []) if isinstance(item, dict)]

            fresh: list[dict[str, Any]] = []
            for item in batch:
                key = str(item.get("rpid") or item.get("rpid_str") or "")
                if not key or key in seen:
                    continue
                seen.add(key)
                fresh.append(item)
            replies.extend(fresh)
            # 未登录时 B 站可能只返回 3 条；继续翻页通常也拿不到新数据，
            # 用 rpid 去重并在没有新增时停止，避免重复计数。
            if not fresh:
                break
            if page_no < pages and self.request_delay:
                time.sleep(self.request_delay)

        return replies, total

    @staticmethod
    def _has_at(reply: dict[str, Any]) -> bool:
        content = reply.get("content") or {}
        members = content.get("members") or []
        message = str(content.get("message") or "")
        return bool(members) or "@" in message

    def comment_stats(
        self,
        aid: int,
        pages: int = 3,
        sort: str = "hot",
        include_replies: bool = False,
    ) -> CommentStats:
        replies, total = self.fetch_comments(aid, pages=pages, sort=sort)
        sampled = 0
        at_comments = 0
        for reply in replies:
            sampled += 1
            if self._has_at(reply):
                at_comments += 1
            if include_replies:
                for sub in reply.get("replies") or []:
                    if not isinstance(sub, dict):
                        continue
                    sampled += 1
                    if self._has_at(sub):
                        at_comments += 1
        return CommentStats(
            total_comments=total,
            sampled=sampled,
            at_comments=at_comments,
        )

    def get_csrf(self) -> str:
        if self._csrf:
            return self._csrf
        for cookie in self.page.context.cookies():
            if (
                cookie.get("name") == "bili_jct"
                and "bilibili.com" in str(cookie.get("domain") or "")
            ):
                self._csrf = str(cookie.get("value") or "")
                break
        if not self._csrf:
            raise LoginRequired("未找到 bili_jct Cookie，请先登录 B 站")
        return self._csrf

    def open_video(self, url: str) -> None:
        self.page.goto(url, wait_until="domcontentloaded", timeout=60000)
        self.page.wait_for_timeout(1500)

    def post_comment(
        self,
        aid: int,
        message: str,
        root: str | int | None = None,
        parent: str | int | None = None,
        at_map: dict[str, int] | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "oid": aid,
            "type": 1,
            "message": message,
            "plat": 1,
            "csrf": self.get_csrf(),
            "gaia_source": "main_web",
        }
        if root is not None:
            params["root"] = str(root)
            params["parent"] = str(parent if parent is not None else root)
        if at_map:
            params["at_name_to_mid"] = json.dumps(
                at_map, ensure_ascii=False, separators=(",", ":")
            )

        data = self._signed_post("/x/v2/reply/add", params)
        if not isinstance(data, dict):
            raise BiliError("发表评论接口未返回有效数据")
        return data
