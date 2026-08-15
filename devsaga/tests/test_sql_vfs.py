"""SQL 引擎与文件系统（VFS）单元测试。"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game.scenarios.sql_rescue import SqlRescue
from game.scenarios.terminal_master import TerminalMaster


class SqlEngineTests(unittest.TestCase):
    def setUp(self):
        # 每个测试用全新的数据库，避免相互污染
        self.sc = SqlRescue()
        self.db = self.sc.db

    def _q(self, sql):
        headers, rows = self.db.execute(sql)
        return [tuple(r) for r in rows]

    def test_select_where(self):
        rows = self._q("SELECT * FROM orders WHERE status='paid'")
        self.assertEqual(len(rows), 8)
        self.assertTrue(all(r[4] == "paid" for r in rows))

    def test_select_amount(self):
        rows = self._q("SELECT * FROM orders WHERE amount > 1000")
        self.assertEqual(len(rows), 4)
        self.assertEqual(sorted(r[0] for r in rows), [2, 3, 8, 10])

    def test_group_by_sum(self):
        rows = self._q("SELECT user_id, SUM(amount) FROM orders GROUP BY user_id")
        d = dict(rows)
        self.assertEqual(d[1], 2097)
        self.assertEqual(d[2], 1319)
        self.assertEqual(d[3], 2098)
        self.assertEqual(sum(d.values()), 7830)

    def test_join(self):
        rows = self._q(
            "SELECT DISTINCT users.name FROM orders "
            "JOIN users ON orders.user_id = users.id "
            "JOIN products ON orders.product_id = products.id "
            "WHERE products.name='机械键盘'")
        names = sorted(r[0] for r in rows)
        self.assertEqual(names, ["孙七", "张三", "王五", "郑十"])

    def test_update(self):
        self.sc._email_fixed(None, None)  # 先看当前状态
        self.db.execute("UPDATE users SET email='xiaohong@glitch.com' WHERE id=7")
        u7 = next(u for u in self.db.tables["users"].rows if u["id"] == 7)
        self.assertEqual(u7["email"], "xiaohong@glitch.com")

    def test_delete(self):
        n = len(self.db.tables["orders"].rows)
        self.db.execute("DELETE FROM orders WHERE status='cancelled'")
        rows = self.db.tables["orders"].rows
        self.assertEqual(len(rows), n - 2)
        self.assertTrue(all(r["status"] != "cancelled" for r in rows))

    def test_count(self):
        rows = self._q("SELECT COUNT(*) FROM orders")
        self.assertEqual(rows, [(12,)])

    def test_bad_sql(self):
        from game.scenarios.base import CommandError
        with self.assertRaises(CommandError):
            self.db.execute("SELECT FROM WHERE")


class VfsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sc = TerminalMaster()

    def test_norm(self):
        fs = self.sc.fs
        self.assertEqual(fs.norm("/opt/app"), "/opt/app")
        fs.cwd = "/opt/app"
        self.assertEqual(fs.norm("config.ini"), "/opt/app/config.ini")
        self.assertEqual(fs.norm("../logs"), "/opt/logs")
        self.assertEqual(fs.norm("/"), "/")

    def test_find(self):
        out = self.sc._cmd_find(["/", "-name", "config.ini"])
        self.assertIn("/opt/app/config.ini", out)

    def test_tail_redirect(self):
        self.sc.handle("tail -n 20 /opt/app/logs/access.log > /opt/app/report.txt", None)
        self.assertTrue(self.sc._check_report(None, ""))

    def test_chmod_and_run(self):
        self.sc.handle("chmod +x /opt/app/deploy.sh", None)
        self.assertTrue(self.sc.state["chmod_deploy"])
        self.sc.handle("/opt/app/deploy.sh", None)
        self.assertTrue(self.sc.state["deployed"])
        self.assertTrue(self.sc.fs.exists("/var/log/deploy_ok.txt"))

    def test_mv(self):
        self.sc.handle("mv /opt/app/logs/error.log /opt/app/logs/error_2025.log", None)
        self.assertTrue(self.sc._check_moved(None, ""))

    def test_grep_count(self):
        out = self.sc._cmd_grep(['-c', ' 500 ', '/opt/app/logs/access.log'], None)
        self.assertEqual(int(out), 5)

    def test_pipeline(self):
        out = self.sc.handle('find /opt/app -name "*.py" | wc -l', None)
        self.assertEqual(int(out), 3)


if __name__ == "__main__":
    unittest.main()
