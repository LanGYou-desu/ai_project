"""运行状态存储，防止重复评论。"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any


class StateStore:
    def __init__(self, path: Path):
        self.path = path
        self.data: dict[str, Any] = {"processed": {}}
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8-sig"))
        except (json.JSONDecodeError, OSError):
            return
        if isinstance(raw, dict) and isinstance(raw.get("processed"), dict):
            self.data = raw

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(self.path.suffix + ".tmp")
        temp.write_text(
            json.dumps(self.data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.replace(temp, self.path)

    def is_processed(self, bvid: str) -> bool:
        return bvid in self.data["processed"]

    def find_processed(self, bvid: str, aid: int | None = None) -> str | None:
        """返回已搬运记录的 BVID；同时按 AID 兜底匹配。"""
        if bvid in self.data["processed"]:
            return bvid
        if aid is None:
            return None
        try:
            target_aid = int(aid)
        except (TypeError, ValueError):
            return None
        if target_aid <= 0:
            return None
        for existing_bvid, record in self.data["processed"].items():
            try:
                recorded_aid = int(record.get("aid") or 0)
            except (TypeError, ValueError):
                continue
            if recorded_aid == target_aid:
                return existing_bvid
        return None

    def is_processed_video(self, bvid: str, aid: int | None = None) -> bool:
        return self.find_processed(bvid, aid) is not None

    def get(self, bvid: str) -> dict[str, Any] | None:
        return self.data["processed"].get(bvid)

    def mark(self, bvid: str, record: dict[str, Any]) -> None:
        record = dict(record)
        record["updated_at"] = datetime.now().isoformat(timespec="seconds")
        self.data["processed"][bvid] = record
        self._save()

    def records(self) -> dict[str, Any]:
        return dict(self.data["processed"])


class UidStateStore:
    """按 UID 分别记录指定用户模式的已发送视频。

    多个目标 UID 时，只要其中任意一个已经收到过该视频，就认为整个视频
    已处理，避免在同一条评论里重复 @ 已收到的用户。
    """

    def __init__(self, store: StateStore, uids: list[int]):
        self.store = store
        self.uids = sorted({int(uid) for uid in uids})
        self.uid_set = set(self.uids)
        if not self.uid_set:
            raise ValueError("UID 列表不能为空")

    @staticmethod
    def _record_uids(record: Any) -> set[int]:
        if not isinstance(record, dict):
            return set()
        result: set[int] = set()
        raw = record.get("uids")
        if isinstance(raw, (list, tuple, set)):
            for value in raw:
                try:
                    result.add(int(value))
                except (TypeError, ValueError):
                    continue
        if result:
            return result

        # 兼容旧版按 UID 组合保存的 scope 字段。
        scope = str(record.get("scope") or "")
        for part in scope.split(","):
            try:
                result.add(int(part.strip()))
            except (TypeError, ValueError):
                continue
        return result

    @staticmethod
    def _record_bvid(key: str, record: Any) -> str:
        if isinstance(record, dict):
            bvid = str(record.get("bvid") or "").strip()
            if bvid:
                return bvid
        # 旧版记录的 key 形如 "123:BV1xx..."。
        return key.rsplit(":", 1)[-1]

    def _matching_records(self):
        for key, record in self.store.records().items():
            if self.uid_set & self._record_uids(record):
                yield key, record

    def _seen_uids(self, bvid: str, aid: int | None = None) -> set[int]:
        target_aid: int | None = None
        if aid is not None:
            try:
                target_aid = int(aid)
            except (TypeError, ValueError):
                target_aid = None

        seen: set[int] = set()
        for key, record in self._matching_records():
            recorded_bvid = self._record_bvid(key, record)
            matched = recorded_bvid == bvid
            if not matched and target_aid is not None and target_aid > 0:
                try:
                    recorded_aid = int(record.get("aid") or 0)
                except (TypeError, ValueError):
                    recorded_aid = 0
                matched = recorded_aid == target_aid
            if matched:
                seen.update(self.uid_set & self._record_uids(record))
        return seen

    def remaining_uids(self, bvid: str, aid: int | None = None) -> set[int]:
        return self.uid_set - self._seen_uids(bvid, aid)

    def find_processed(self, bvid: str, aid: int | None = None) -> str | None:
        # 只有目标 UID 全部收过时，才算整个视频处理完成；否则由发布流程
        # 过滤掉已收过的 UID，只 @ 剩余用户。
        if not self.remaining_uids(bvid, aid):
            return bvid
        return None

    def is_processed(self, bvid: str) -> bool:
        return self.find_processed(bvid) is not None

    def is_processed_video(self, bvid: str, aid: int | None = None) -> bool:
        return self.find_processed(bvid, aid) is not None

    def get(self, bvid: str) -> dict[str, Any] | None:
        for key, record in self._matching_records():
            if self._record_bvid(key, record) == bvid:
                return record
        return None

    def mark(self, bvid: str, record: dict[str, Any]) -> None:
        merged = set(self.uid_set)
        for key, old in self.store.records().items():
            if self._record_bvid(key, old) == bvid:
                merged.update(self._record_uids(old))

        new_record = dict(record)
        new_record["bvid"] = bvid
        new_record["uids"] = sorted(merged)
        new_record.pop("scope", None)
        self.store.mark(bvid, new_record)
