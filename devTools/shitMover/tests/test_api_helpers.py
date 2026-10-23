from __future__ import annotations

import unittest

from shitmover.api import BiliApi, BiliError, RiskControl, clean_title


class FakePage:
    def __init__(self, result: dict):
        self.result = result

    def evaluate(self, script: str, arg: dict) -> dict:
        return self.result


class CommentHelperTest(unittest.TestCase):
    def test_members_means_at(self) -> None:
        reply = {"content": {"message": "看看", "members": [{"mid": 1}]}}
        self.assertTrue(BiliApi._has_at(reply))

    def test_literal_at_means_at(self) -> None:
        self.assertTrue(BiliApi._has_at({"content": {"message": "@某人 来看"}}))

    def test_plain_comment(self) -> None:
        self.assertFalse(BiliApi._has_at({"content": {"message": "哈哈哈哈哈"}}))
        self.assertFalse(BiliApi._has_at({}))

    def test_clean_search_title(self) -> None:
        self.assertEqual(
            clean_title('AI+软件<em class="keyword">测试</em>_教程 &amp; 入门'),
            "AI+软件测试_教程 & 入门",
        )


class RequestJsonTest(unittest.TestCase):
    def test_http_412_raises_risk_control_without_html_dump(self) -> None:
        page = FakePage(
            {
                "status": 412,
                "data": None,
                "text": "<!DOCTYPE html><html>error</html>",
            }
        )
        api = BiliApi(page)

        with self.assertRaises(RiskControl) as context:
            api._request_json("https://api.bilibili.com/x/v2/reply")

        message = str(context.exception)
        self.assertIn("HTTP 412", message)
        self.assertNotIn("<!DOCTYPE", message)

    def test_other_non_json_response_is_generic_error(self) -> None:
        page = FakePage({"status": 500, "data": None, "text": "server error"})
        api = BiliApi(page)

        with self.assertRaises(BiliError) as context:
            api._request_json("https://api.bilibili.com/x/v2/reply")

        self.assertNotIsInstance(context.exception, RiskControl)
        self.assertIn("HTTP 500", str(context.exception))


if __name__ == "__main__":
    unittest.main()
