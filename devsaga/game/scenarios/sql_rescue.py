"""场景 4：数据库救援 —— 内嵌一个迷你 SQL 引擎，用 SQL 拯救脏数据。

支持：SELECT（WHERE / JOIN / GROUP BY + 聚合 / ORDER BY / LIMIT / DISTINCT）、
UPDATE / DELETE / INSERT。
"""

import re

from .. import terminal as T
from .base import CommandError, Scenario, Task

_OPS = ("<=", ">=", "!=", "=", "<", ">")


class SqlEngine:
    def __init__(self, tables):
        self.tables = {t.name: t for t in tables}

    # ---- 值处理 ----
    @staticmethod
    def _val(s):
        s = s.strip()
        if s.startswith("'") or s.startswith('"'):
            return s[1:-1]
        if re.fullmatch(r"-?\d+", s):
            return int(s)
        if re.fullmatch(r"-?\d+\.\d+", s):
            return float(s)
        return s

    # ---- 行操作 ----
    def _combined(self, sql_rest, t1):
        """返回 (rows, colmap)，colmap: (table,col) 或 col -> 列值索引。"""
        rows = [dict(r) for r in self.tables[t1].rows]
        joined = False
        for m in re.finditer(
                r"join\s+(\w+)\s+on\s+([\w.]+)\s*=\s*([\w.]+|'[^']*'|\"[^\"]*\"|\d+)",
                sql_rest, re.I):
            t2 = m.group(1)
            if t2 not in self.tables:
                raise CommandError(f"SQL: 表 {t2} 不存在")
            left, right = m.group(2), m.group(3)
            t2rows = self.tables[t2].rows
            new_rows = []
            for r in rows:
                for r2 in t2rows:
                    lv = self._lookup(r, r2, left)
                    rv = self._lookup(r, r2, right)
                    if lv == rv:
                        merged = dict(r)
                        for k, v in r2.items():
                            merged[f"{t2}.{k}"] = v
                        new_rows.append(merged)
            rows = new_rows
            joined = True
        # 给首表列加前缀，便于统一查找
        prefixed = []
        for r in rows:
            nr = {}
            for k, v in r.items():
                nr[k if "." in k else f"{t1}.{k}"] = v
            prefixed.append(nr)
        return prefixed, joined

    def _lookup(self, r, r2, expr):
        expr = expr.strip()
        if "." in expr:
            t, c = expr.split(".", 1)
            key = f"{t}.{c}"
            if key in r:
                return r[key]
            # 右表限定的列（如 products.id）：当前行还没有这个键时去右表行里找
            if r2 is not None and c in r2:
                return r2[c]
            return r.get(c)
        if r2 is not None and expr in r2:
            return r2[expr]
        return r.get(expr)

    def _where(self, rows, cond, t1):
        if not cond or not cond.strip():
            return rows
        conds = re.split(r"\band\b", cond, flags=re.I)
        out = []
        for r in rows:
            ok = True
            for c in conds:
                c = c.strip()
                if not c:
                    continue
                m = re.match(r"([\w.]+)\s*(<=|>=|!=|=|<|>)\s*(.+)$", c)
                if not m:
                    raise CommandError(f"SQL: 看不懂条件 '{c}'（支持 = != < > <= >= 和 AND）")
                col, op, val = m.group(1), m.group(2), m.group(3).strip()
                got = r.get(col) if "." in col else r.get(f"{t1}.{col}", r.get(col))
                want = self._val(val)
                if not self._cmp(got, op, want):
                    ok = False
                    break
            if ok:
                out.append(r)
        return out

    def _cmp(self, got, op, want):
        try:
            if isinstance(got, int) and isinstance(want, int):
                pass
            elif isinstance(got, (int, float)) and isinstance(want, (int, float)):
                got, want = float(got), float(want)
            else:
                got, want = str(got), str(want)
        except Exception:
            got, want = str(got), str(want)
        if op == "=":
            return got == want
        if op == "!=":
            return got != want
        if op == "<":
            return got < want
        if op == ">":
            return got > want
        if op == "<=":
            return got <= want
        if op == ">=":
            return got >= want
        return False

    def _agg(self, func, values):
        values = list(values)
        if func == "COUNT":
            return len(values)
        values = [v for v in values if v is not None]
        if not values:
            return 0
        if func == "SUM":
            return sum(values)
        if func == "AVG":
            return sum(values) / len(values)
        if func == "MIN":
            return min(values)
        if func == "MAX":
            return max(values)
        raise CommandError(f"SQL: 不支持的聚合函数 {func}")

    # ---- 命令 ----
    def execute(self, sql):
        sql = sql.strip().rstrip(";").strip()
        if not sql:
            raise CommandError("SQL 为空")
        head = sql.split(None, 1)[0].upper()
        if head == "SELECT":
            return self._select(sql)
        if head == "UPDATE":
            return self._update(sql)
        if head == "DELETE":
            return self._delete(sql)
        if head == "INSERT":
            return self._insert(sql)
        raise CommandError("SQL: 只支持 SELECT / UPDATE / DELETE / INSERT")

    def _select(self, sql):
        rest = sql[6:].strip()
        limit = None
        m = re.search(r"\blimit\s+(\d+)\s*$", rest, re.I)
        if m:
            limit = int(m.group(1))
            rest = rest[: m.start()]
        order = None
        m = re.search(r"\border\s+by\s+([\w.]+)(?:\s+(asc|desc))?\s*$", rest, re.I)
        if m:
            order = (m.group(1), (m.group(2) or "asc").lower())
            rest = rest[: m.start()]
        group = None
        m = re.search(r"\bgroup\s+by\s+([\w.]+)\s*$", rest, re.I)
        if m:
            group = m.group(1)
            rest = rest[: m.start()]

        m = re.match(r"(.+?)\s+from\s+(\w+)\s*(.*)$", rest, re.I)
        if not m:
            raise CommandError("SQL: SELECT 语法错误（需要 FROM 表名）")
        cols_spec, t1, tail = m.group(1).strip(), m.group(2), m.group(3)
        if t1 not in self.tables:
            raise CommandError(f"SQL: 表 {t1} 不存在")
        cond = ""
        wm = re.search(r"\bwhere\b", tail, re.I)
        if wm:
            cond = tail[wm.end():].strip()
            tail = tail[: wm.start()]
        rows, _joined = self._combined(tail, t1)
        rows = self._where(rows, cond, t1)

        distinct = bool(re.match(r"distinct\b", cols_spec, re.I))
        if distinct:
            cols_spec = re.sub(r"^distinct\b", "", cols_spec, flags=re.I).strip()

        # 解析 select 列
        items = [c.strip() for c in cols_spec.split(",")]
        headers = []
        funcs = []  # (col, func) for aggregate items

        def resolve_col(expr):
            expr = expr.strip()
            if "." in expr:
                return expr
            return f"{t1}.{expr}"

        for it in items:
            fm = re.match(r"(\w+)\(([^)]*)\)", it, re.I)
            if it == "*":
                for col in self.tables[t1].columns:
                    funcs.append((f"{t1}.{col}", None))
                    headers.append(col)
            elif fm:
                fname = fm.group(1).upper()
                arg = fm.group(2).strip()
                col = resolve_col(arg) if arg and arg != "*" else None
                funcs.append((col, fname))
                headers.append(f"{fname}({arg})".upper() if arg else f"{fname}(*)".upper())
            else:
                funcs.append((resolve_col(it), None))
                headers.append(it.split(".")[-1])

        # 计算
        result_rows = []
        if any(f for _, f in funcs) or group:
            if group:
                buckets = {}
                for r in rows:
                    key = r.get(group) if "." in group else r.get(f"{t1}.{group}", r.get(group))
                    buckets.setdefault(key, []).append(r)
                for key in sorted(buckets, key=lambda k: (str(k), k if isinstance(k, int) else 0)):
                    bucket = buckets[key]
                    row = []
                    for col, f in funcs:
                        if f:
                            vals = [self._get(r, col) for r in bucket]
                            row.append(self._agg(f, vals))
                        else:
                            row.append(key if col == group else self._get(bucket[0], col))
                    result_rows.append(row)
            else:
                row = []
                for col, f in funcs:
                    vals = [self._get(r, col) for r in rows]
                    row.append(self._agg(f, vals))
                result_rows.append(row)
        else:
            for r in rows:
                result_rows.append([self._get(r, col) for col, _ in funcs])

        if order:
            ocol = order[0]
            idx = None
            for i, h in enumerate(headers):
                if h == ocol or h == ocol.split(".")[-1]:
                    idx = i
                    break
            if idx is None and group:
                idx = 0
            if idx is not None:
                result_rows.sort(key=lambda r: (str(r[idx]), r[idx] if isinstance(r[idx], (int, float)) else 0),
                                 reverse=(order[1] == "desc"))
        if limit is not None:
            result_rows = result_rows[:limit]

        if distinct:
            seen = set()
            uniq = []
            for r in result_rows:
                k = tuple(str(x) for x in r)
                if k not in seen:
                    seen.add(k)
                    uniq.append(r)
            result_rows = uniq

        return headers, result_rows

    def _get(self, row, col):
        if col is None:
            return None
        return row.get(col)

    def _update(self, sql):
        m = re.match(r"update\s+(\w+)\s+set\s+(.+?)(?:\s+where\s+(.+))?$", sql, re.I)
        if not m:
            raise CommandError("SQL: UPDATE 语法错误")
        tname, sets, cond = m.group(1), m.group(2), m.group(3)
        table = self.tables.get(tname)
        if table is None:
            raise CommandError(f"SQL: 表 {tname} 不存在")
        pairs = []
        for part in sets.split(","):
            km = re.match(r"(\w+)\s*=\s*(.+)$", part.strip())
            if not km:
                raise CommandError(f"SQL: 看不懂 SET 项 '{part}'")
            pairs.append((km.group(1), self._val(km.group(2))))
        rows = self._where([dict(r) for r in table.rows], cond or "", tname)
        for r in rows:
            for k, v in pairs:
                r[k] = v
        table.rows = rows
        return None, f"已更新 {len(rows)} 行"

    def _delete(self, sql):
        m = re.match(r"delete\s+from\s+(\w+)(?:\s+where\s+(.+))?$", sql, re.I)
        if not m:
            raise CommandError("SQL: DELETE 语法错误")
        tname, cond = m.group(1), m.group(2)
        table = self.tables.get(tname)
        if table is None:
            raise CommandError(f"SQL: 表 {tname} 不存在")
        all_rows = [dict(r) for r in table.rows]
        to_delete = self._where(all_rows, cond or "", tname)
        keep = [r for r in all_rows if r not in to_delete]
        table.rows = keep
        return None, f"已删除 {len(to_delete)} 行"

    def _insert(self, sql):
        m = re.match(r"insert\s+into\s+(\w+)\s*(?:\(([^)]+)\))?\s*values\s*\(([^)]+)\)", sql, re.I)
        if not m:
            raise CommandError("SQL: INSERT 语法错误")
        tname, cols_s, vals_s = m.group(1), m.group(2), m.group(3)
        table = self.tables.get(tname)
        if table is None:
            raise CommandError(f"SQL: 表 {tname} 不存在")
        cols = [c.strip() for c in cols_s.split(",")] if cols_s else table.columns
        vals = [self._val(v) for v in vals_s.split(",")]
        row = dict(zip(cols, vals))
        table.rows.append(row)
        return None, "已插入 1 行"


class Table:
    def __init__(self, name, columns, rows):
        self.name = name
        self.columns = columns
        self.rows = rows


class SqlRescue(Scenario):
    id = "sql_rescue"
    name = "数据库救援"
    tagline = "实习生往数据库里灌了一堆脏数据，客户订单全乱了。\nSQL 是你唯一的武器——查出来，修回去。"
    env = "sql（迷你数据库）"
    difficulty = 2
    xp_bonus = 120

    def setup(self):
        self.db = SqlEngine([
            Table("users", ["id", "name", "email", "city"], [
                {"id": 1, "name": "张三", "email": "zs@glitch.com", "city": "北京"},
                {"id": 2, "name": "李四", "email": "ls@glitch.com", "city": "上海"},
                {"id": 3, "name": "王五", "email": "ww@glitch.com", "city": "深圳"},
                {"id": 4, "name": "赵六", "email": "zl@glitch.com", "city": "北京"},
                {"id": 5, "name": "孙七", "email": "sq@glitch.com", "city": "广州"},
                {"id": 6, "name": "周八", "email": "zb@glitch.com", "city": "杭州"},
                {"id": 7, "name": "吴九", "email": "wu9@old-mail.example.com", "city": "成都"},
                {"id": 8, "name": "郑十", "email": "zs10@glitch.com", "city": "武汉"},
            ]),
            Table("products", ["id", "name", "price"], [
                {"id": 1, "name": "机械键盘", "price": 399},
                {"id": 2, "name": "显示器", "price": 1299},
                {"id": 3, "name": "鼠标", "price": 99},
                {"id": 4, "name": "机械键盘", "price": 499},
                {"id": 5, "name": "咖啡券", "price": 20},
                {"id": 6, "name": "显示器", "price": 1599},
            ]),
            Table("orders", ["id", "user_id", "product_id", "amount", "status"], [
                {"id": 1, "user_id": 1, "product_id": 1, "amount": 399, "status": "paid"},
                {"id": 2, "user_id": 1, "product_id": 6, "amount": 1599, "status": "paid"},
                {"id": 3, "user_id": 2, "product_id": 2, "amount": 1299, "status": "paid"},
                {"id": 4, "user_id": 3, "product_id": 4, "amount": 499, "status": "cancelled"},
                {"id": 5, "user_id": 4, "product_id": 3, "amount": 99, "status": "paid"},
                {"id": 6, "user_id": 5, "product_id": 1, "amount": 399, "status": "paid"},
                {"id": 7, "user_id": 6, "product_id": 5, "amount": 20, "status": "pending"},
                {"id": 8, "user_id": 7, "product_id": 2, "amount": 1299, "status": "paid"},
                {"id": 9, "user_id": 8, "product_id": 4, "amount": 499, "status": "paid"},
                {"id": 10, "user_id": 3, "product_id": 6, "amount": 1599, "status": "pending"},
                {"id": 11, "user_id": 2, "product_id": 5, "amount": 20, "status": "paid"},
                {"id": 12, "user_id": 1, "product_id": 3, "amount": 99, "status": "cancelled"},
            ]),
        ])
        self.last_result = None
        self.tasks = [
            Task("s1", "找出已支付订单",
                 "财务要核对已支付的订单。查询所有 status='paid' 的订单。\n（示例：SELECT * FROM orders WHERE status='paid'）",
                 check=self._rows("paid_orders"), hints=("SELECT * FROM orders WHERE status='paid'",),
                 lesson="sql_basic", answer="SELECT * FROM orders WHERE status='paid'"),
            Task("s2", "大额订单",
                 "哪些订单金额超过 1000？",
                 check=self._rows("big_orders"), hints=("SELECT * FROM orders WHERE amount > 1000",),
                 lesson="sql_basic", answer="SELECT * FROM orders WHERE amount > 1000"),
            Task("s3", "每个用户花了多少",
                 "按用户统计订单总金额（用 GROUP BY + SUM）。",
                 check=self._rows("user_sums"), hints=("SELECT user_id, SUM(amount) FROM orders GROUP BY user_id",),
                 lesson="sql_basic", answer="SELECT user_id, SUM(amount) FROM orders GROUP BY user_id"),
            Task("s4", "谁买了机械键盘",
                 "找出买过“机械键盘”的用户名（需要 JOIN users 和 products 两张表）。\n记得去重：SELECT DISTINCT ...",
                 check=self._rows("kb_users"), hints=(
                     "SELECT DISTINCT users.name FROM orders JOIN users ON orders.user_id=users.id JOIN products ON orders.product_id=products.id WHERE products.name='机械键盘'",),
                 lesson="sql_basic", answer="SELECT DISTINCT users.name FROM orders JOIN users ON orders.user_id=users.id JOIN products ON orders.product_id=products.id WHERE products.name='机械键盘'"),
            Task("s5", "修复脏数据",
                 "用户吴九的邮箱是错的（旧的离职邮箱）。把它改成 xiaohong@glitch.com。",
                 check=self._email_fixed, hints=("UPDATE users SET email='xiaohong@glitch.com' WHERE id=7",),
                 lesson="sql_write", answer="UPDATE users SET email='xiaohong@glitch.com' WHERE id=7"),
            Task("s6", "一共多少订单",
                 "全公司目前一共有多少条订单记录？用聚合函数数出来。",
                 check=self._rows("order_count"), hints=("SELECT COUNT(*) FROM orders",),
                 lesson="sql_basic", answer="SELECT COUNT(*) FROM orders"),
        ]

    # ---- 期望结果（手工核对）----
    def _expect(self, key):
        paid_ids = {1, 2, 3, 5, 6, 8, 9, 11}
        big_ids = {2, 3, 8, 10}
        if key == "paid_orders":
            rows = [r for r in self.db.tables["orders"].rows if r["id"] in paid_ids]
            return [(r["id"], r["user_id"], r["product_id"], r["amount"], r["status"]) for r in rows]
        if key == "big_orders":
            rows = [r for r in self.db.tables["orders"].rows if r["id"] in big_ids]
            return [(r["id"], r["user_id"], r["product_id"], r["amount"], r["status"]) for r in rows]
        if key == "user_sums":
            return [(1, 2097), (2, 1319), (3, 2098), (4, 99), (5, 399), (6, 20), (7, 1299), (8, 499)]
        if key == "kb_users":
            return [("张三",), ("王五",), ("孙七",), ("郑十",)]
        if key == "order_count":
            return [(12,)]
        return []

    def _rows(self, key):
        def check(session, cmd):
            res = session.scenario.last_result
            if res is None:
                return False
            headers, rows = res
            expect = session.scenario._expect(key)
            got = [tuple(r) for r in rows]
            return sorted(map(_norm_t, got)) == sorted(map(_norm_t, expect))
        return check

    def _email_fixed(self, session, cmd):
        users = self.db.tables["users"].rows
        u7 = next((u for u in users if u["id"] == 7), None)
        return u7 is not None and u7["email"] == "xiaohong@glitch.com"

    # ---------------- 命令 ----------------
    def handle(self, cmd, session):
        low = cmd.strip().lower()
        if low in ("tables",):
            return T.table(["表名", "列"], [[t.name, ", ".join(t.columns)] for t in self.db.tables.values()])
        if low.startswith("desc "):
            name = low[5:].strip()
            t = self.db.tables.get(name)
            if t is None:
                raise CommandError(f"SQL: 表 {name} 不存在")
            return T.table(["列名"], [[c] for c in t.columns])
        if low.startswith("help"):
            return self.help_text(session)
        try:
            result = self.db.execute(cmd)
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"SQL 执行失败：{exc}")
        headers, payload = result
        if headers is None:
            return payload
        self.last_result = (headers, payload)
        return T.table(headers, payload)

    def help_text(self, session):
        return T.box([
            "查询：SELECT 列 FROM 表 [JOIN 表 ON 条件] [WHERE 条件] [GROUP BY 列] [ORDER BY 列] [LIMIT n]",
            "  例：SELECT * FROM orders WHERE status='paid'",
            "  例：SELECT user_id, SUM(amount) FROM orders GROUP BY user_id",
            "  例：SELECT DISTINCT users.name FROM orders JOIN products ON orders.product_id=products.id",
            "修改：UPDATE 表 SET 列=值 WHERE 条件 ｜ DELETE FROM 表 WHERE 条件 ｜ INSERT INTO 表 (列) VALUES (...)",
            "辅助：tables 看所有表 ｜ desc <表名> 看表结构",
            "字符串值要加单引号：status='paid'",
        ], title="SQL 手册", color="cyan")

    def solve(self):
        return [
            "tables",
            "SELECT * FROM orders WHERE status='paid'",
            "SELECT * FROM orders WHERE amount > 1000",
            "SELECT user_id, SUM(amount) FROM orders GROUP BY user_id",
            "SELECT DISTINCT users.name FROM orders JOIN users ON orders.user_id = users.id JOIN products ON orders.product_id = products.id WHERE products.name='机械键盘'",
            "UPDATE users SET email='xiaohong@glitch.com' WHERE id=7",
            "SELECT COUNT(*) FROM orders",
        ]

    def dashboard(self):
        tables = [[t.name, len(t.rows)] for t in self.db.tables.values()]
        cnt = {}
        for r in self.db.tables["orders"].rows:
            cnt[r["status"]] = cnt.get(r["status"], 0) + 1
        status_map = {"paid": ("已支付", True), "pending": ("待支付", False),
                      "cancelled": ("已取消", True)}
        items = [{"label": f"{status_map.get(k, (k, True))[0]}（{v}）",
                  "state": str(v), "ok": status_map.get(k, ("", True))[1]}
                 for k, v in sorted(cnt.items())]
        last = f"{self.last_result[1] and len(self.last_result[1]) or 0} 行" if self.last_result else "—"
        return {"theme": {"icon": "🗄️", "title": "数据库工作台", "accent": "#58a6ff"},
                "panels": [
                    {"kind": "table", "title": "数据表", "headers": ["表名", "行数"], "rows": tables},
                    {"kind": "status", "title": "订单状态分布", "items": items},
                    {"kind": "kv", "title": "最近查询", "items": [["结果", last]]},
                ]}


def _norm_t(t):
    return tuple(x if not isinstance(x, float) or x != int(x) else int(x) for x in t)
