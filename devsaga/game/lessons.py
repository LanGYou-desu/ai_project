"""知识点手册：每个任务背后的真实计算机知识，边玩边学。"""

TOPICS = {
    "find": ("find 查找文件", [
        "find 在目录树中递归查找文件：",
        "  find / -name \"config.ini\"   # 全盘按名字找",
        "  find /opt -name \"*.py\"       # 按后缀找",
        "  find . -mtime -1             # 找最近 1 天修改的文件",
        "配合 wc -l 可以统计数量：find /opt -name \"*.py\" | wc -l",
    ]),
    "grep": ("grep 文本搜索", [
        "grep 在文件内容中按正则搜索行：",
        "  grep \"ERROR\" app.log          # 找含 ERROR 的行",
        "  grep -c \"ERROR\" app.log       # 只输出匹配行数",
        "  grep -rn \"TODO\" src/          # 递归搜索并带行号",
        "配合 sort/uniq 可做统计：grep \" 500 \" log | sort | uniq -c | sort -rn",
    ]),
    "redirect": ("重定向与管道", [
        "> 覆盖写入，>> 追加写入：",
        "  tail -n 20 access.log > report.txt   # 写文件（覆盖）",
        "  echo \"done\" >> report.txt           # 追加",
        "| 管道把前一个命令的输出喂给后一个：",
        "  find / -name \"*.py\" | wc -l         # 统计数量",
        "注意：> 会清空原文件，生产环境手滑了很危险！",
    ]),
    "chmod": ("文件权限 chmod", [
        "Linux 权限分三组：所有者 / 组 / 其他人，每组 rwx。",
        "  chmod +x script.sh   # 加上执行权限（所有人）",
        "  chmod 755 script.sh  # rwxr-xr-x：所有者全权，其他人只读+执行",
        "  chmod 600 secret.key # 只有所有者可读写（私钥常用）",
        "没有执行权限时运行脚本会报 Permission denied。",
    ]),
    "git_log": ("git log 查看历史", [
        "git log 按时间倒序列出提交：",
        "  git log --oneline      # 一行一个提交（哈希+信息）",
        "  git log --oneline --graph --all   # 图形化看分支",
        "  git show <hash>        # 看某次提交改了什么",
        "提交哈希（前 8 位）是每次提交的唯一指纹。",
    ]),
    "git_revert": ("git revert 安全回滚", [
        "git revert <hash> 生成一次【反向提交】来撤销指定提交：",
        "  - 保留历史，适合已经推到远程的分支",
        "  - 和 git reset 不同：revert 不删历史，reset 会",
        "revert 后 HEAD 会多出一条 \"Revert ...\" 的提交。",
    ]),
    "git_reflog": ("git reflog 后悔药", [
        "reflog 记录 HEAD 的所有移动历史，包括被 reset 掉的提交：",
        "  git reflog        # 查看所有历史位置",
        "  git cherry-pick <hash>   # 把某个提交的改动捡到当前分支",
        "手滑 reset --hard 之后，靠 reflog 就能找回来。",
        "黄金法则：reflog 是本地急救箱，但只在本地有效。",
    ]),
    "git_stash": ("git stash 暂存", [
        "改到一半要切分支？git stash 把工作区改动藏起来：",
        "  git stash         # 暂存未提交的改动，工作区变干净",
        "  git stash pop     # 恢复最近一次暂存",
        "  git stash list    # 查看暂存列表",
        "不 stash 直接切换分支，git 会拒绝或把改动带过去。",
    ]),
    "bug_offbyone": ("经典 Bug：差一错误 Off-by-one", [
        "数组索引从 0 开始，最后一个元素是 len(arr)-1：",
        "  arr = [10, 20, 30]",
        "  arr[0] = 10, arr[1] = 20, arr[2] = 30",
        "  arr[3]  → IndexError: list index out of range",
        "循环遍历习惯写成 for i in range(len(arr))，用 arr[i]。",
    ]),
    "bug_mutable": ("经典 Bug：可变默认参数", [
        "Python 函数默认参数只求值一次，且会【共享】：",
        "  def add(x, lst=[]):   # 这个 [] 是所有调用共用的！",
        "      lst.append(x)",
        "      return lst",
        "  add(1) → [1]   add(2) → [1, 2]   add(3) → [1, 2, 3]",
        "正确写法：def add(x, lst=None): lst = lst or []",
    ]),
    "bug_float": ("经典 Bug：浮点精度", [
        "二进制无法精确表示 0.1，所以 0.1 + 0.2 != 0.3：",
        "  0.1 + 0.2 = 0.30000000000000004",
        "比较浮点数要用误差：abs(a - b) < 1e-9",
        "金额计算用 Decimal 或整数（分）来存。",
    ]),
    "bug_scope": ("经典 Bug：变量作用域", [
        "函数内给同名变量赋值，会创建局部变量，遮蔽全局：",
        "  count = 0",
        "  def inc():\n      count += 1   # UnboundLocalError！",
        "函数内想改全局变量必须声明 global count。",
        "这也提醒我们：全局可变状态是 bug 的温床。",
    ]),
    "bug_copy": ("经典 Bug：浅拷贝", [
        "b = a 只是复制了引用，两者指向同一个对象：",
        "  a = [1, 2, 3]",
        "  b = a",
        "  b.append(4)   # a 也变成 [1, 2, 3, 4]！",
        "需要独立副本：b = a.copy() 或 b = list(a) 或 copy.deepcopy。",
    ]),
    "bug_infinite": ("经典 Bug：死循环", [
        "循环条件永远为真就会死循环：",
        "  i = 0",
        "  while i < 10:\n      print(i)\n      # 忘了 i += 1 → 死循环",
        "排查：检查循环变量是否更新、条件是否可能收敛。",
        "生产环境死循环会吃满 CPU，把服务器拖垮。",
    ]),
    "bug_sqli": ("经典 Bug：SQL 注入", [
        "把用户输入直接拼进 SQL 是致命漏洞：",
        "  f\"SELECT * FROM users WHERE name='{name}'\"",
        "输入 name = \"' OR '1'='1\" 就能绕过认证！",
        "正确做法：参数化查询（? 占位符），永远不要拼字符串。",
    ]),
    "sql_basic": ("SQL 基础查询", [
        "  SELECT 列 FROM 表 WHERE 条件",
        "  SELECT * FROM orders WHERE amount > 1000",
        "  SELECT user_id, SUM(amount) FROM orders GROUP BY user_id",
        "  JOIN 把多张表按关系连起来：",
        "  SELECT users.name FROM users JOIN orders ON users.id = orders.user_id",
        "字符串条件用单引号：WHERE status='paid'",
    ]),
    "sql_write": ("SQL 增删改", [
        "  UPDATE users SET email='a@b.com' WHERE id=7",
        "  DELETE FROM orders WHERE status='cancelled'",
        "  INSERT INTO users (name, email) VALUES ('张三', 'z@x.com')",
        "危险习惯：UPDATE/DELETE 忘写 WHERE = 全表遭殃！",
        "生产环境建议先 SELECT 确认再改。",
    ]),
    "sys_ps": ("进程管理", [
        "  ps aux        # 列出所有进程",
        "  top           # 实时监控，按 CPU/内存排序",
        "  kill <pid>    # 结束进程（先 kill，再 kill -9）",
        "查 CPU 占用：ps aux --sort=-%cpu | head",
        "僵尸进程、挖矿进程（xmrig）、泄漏进程都能用 top/ps 揪出来。",
    ]),
    "sys_disk": ("磁盘与内存", [
        "  df -h         # 磁盘分区使用率",
        "  du -sh /var/log/*   # 目录占用大小",
        "  free -m       # 内存使用（MB）",
        "磁盘满的常见元凶：日志文件、临时文件、Docker 卷。",
        "内存告警先看进程再决定 kill 还是重启服务。",
    ]),
    "sys_service": ("服务管理 systemctl", [
        "  systemctl status nginx    # 查看服务状态",
        "  systemctl restart nginx   # 重启（改配置后用）",
        "  systemctl start/stop nginx",
        "服务起不来看日志：journalctl -u nginx -n 50",
        "端口被占用：ss -tlnp 看谁占着端口，kill 掉再重启。",
    ]),
    "net_ping": ("网络排查第一招", [
        "分层排查：链路层 → DNS → TCP → HTTP → 应用。",
        "  ping 10.0.0.1        # 网关通不通（链路）",
        "  nslookup api.x.com   # 域名解析对不对（DNS）",
        "  curl -v https://api.x.com/health   # 应用通不通（HTTP）",
        "从底层往上查，能快速定位问题出在哪一层。",
    ]),
    "net_dns": ("DNS 解析", [
        "域名 → IP 的解析顺序大致是：/etc/hosts 优先于 DNS 服务器。",
        "  cat /etc/hosts        # 本机静态解析表",
        "  cat /etc/resolv.conf  # DNS 服务器配置",
        "/etc/hosts 里写了错误映射，所有流量都会被带到错误 IP。",
        "nslookup 结果和预期不一致时，先查 hosts 文件。",
    ]),
    "net_http": ("HTTP 状态码", [
        "  2xx 成功（200 OK）",
        "  3xx 重定向",
        "  4xx 客户端错误（404 不存在、403 禁止）",
        "  5xx 服务端错误（500 内部错误、502 Bad Gateway、504 超时）",
        "502 = 网关/反向代理连不上后端，多半是后端服务挂了。",
        "curl -v 会打印 TLS 握手、请求头、响应头，排查神器。",
    ]),
    "net_iptables": ("防火墙 iptables", [
        "  iptables -L                    # 列出规则",
        "  iptables -A INPUT -p tcp --dport 443 -j ACCEPT  # 放行 443",
        "  iptables -A INPUT -s 1.2.3.4 -j DROP             # 封禁 IP",
        "规则从上往下匹配，顺序很重要。",
        "常见事故：改规则手滑把 SSH(22) 也 DROP 了，服务器失联。",
    ]),
    "net_attack": ("常见网络攻击", [
        "SYN Flood：攻击者发大量 SYN 包不完成握手，耗尽连接表。",
        "特征：tcpdump 里同一源 IP 大量 SYN、无 ACK。",
        "对策：防火墙封源 IP、启用 SYN cookies。",
        "tcpdump -n 直接看报文，是网络工程师的显微镜。",
    ]),
    "algo_twosum": ("算法：两数之和", [
        "暴力法 O(n²)：两层循环。",
        "哈希表 O(n)：遍历时把 target - x 记下来，一次命中。",
        "经典思路：用空间换时间。",
        "dict.get 比 先判断 in 再取 更简洁也更高效。",
    ]),
    "algo_brackets": ("算法：括号匹配", [
        "经典栈应用：左括号入栈，右括号与栈顶配对。",
        "  def is_valid(s):\n      st = []\n      pair = {')':'(', ']':'[', '}':'{'}\n      for c in s:\n          if c in '([{': st.append(c)\n          elif not st or st.pop() != pair[c]: return False\n      return not st",
        "栈 = 后进先出，天然匹配括号的嵌套结构。",
    ]),
    "algo_maxsub": ("算法：最大子数组和", [
        "Kadane 算法 O(n)：",
        "  cur = best = nums[0]",
        "  for x in nums[1:]:\n      cur = max(x, cur + x)\n      best = max(best, cur)",
        "关键思想：要么从当前位置重新开始，要么延续之前的和。",
    ]),
    "career": ("职场生存指南", [
        "1. 先读文档再动手，别当伸手党",
        "2. 报 bug 带现场：报错信息、复现步骤、环境",
        "3. 改代码前先看懂历史（git log / blame）",
        "4. 上线前备份，出事后先回滚再分析",
        "5. 写完代码自己先测，别把 QA 当质检员",
        "6. 学到的知识要总结成文档，教是最好的学",
    ]),
}


def topic_category(key):
    """按知识点 key 推断所属类别（用于知识库分组展示）。"""
    prefix = key.split("_")[0] if "_" in key else key
    table = {
        "find": "终端", "grep": "终端", "redirect": "终端", "chmod": "终端",
        "git": "Git", "bug": "调试", "sql": "SQL", "sys": "运维",
        "net": "网络", "algo": "算法", "docker": "容器", "ci": "CI/CD",
        "fe": "前端", "career": "职场",
    }
    return table.get(prefix, "通用")


def show_lesson(io, key, brief=False):
    if key not in TOPICS:
        io.print("（暂无该知识点）")
        return
    title, lines = TOPICS[key]
    if brief:
        io.print(T_border(lines, title=title, color="yellow"))
    else:
        io.print(T_border(lines, title="📚 " + title, color="yellow"))


def T_border(lines, title=None, color="yellow"):
    from . import terminal as T
    return T.box(lines, title=title, color=color)


def browse_topics(io):
    from . import terminal as T
    keys = sorted(TOPICS)
    while True:
        io.print(T.box(["这里收录了游戏里出现的所有知识点，边玩边查。",
                        "输入编号查看，输入 0 返回。"], title="📚 知识手册", color="yellow"))
        for i, k in enumerate(keys, 1):
            title, _ = TOPICS[k]
            io.print(T.paint(f"  {i:2d}. {title}", "cyan"))
        ans = io.input("选择 > ").strip()
        if ans in ("0", "exit", "quit", "back", ""):
            return
        if ans.isdigit() and 1 <= int(ans) <= len(keys):
            show_lesson(io, keys[int(ans) - 1])
            io.pause()


# =====================================================================
# 2.0 扩充：新主题（容器 / CI/CD / 前端 / 算法）
# =====================================================================

TOPICS.update({
    "docker_basic": ("Docker 基础", [
        "  docker ps -a        # 列出所有容器（-a 包含停止的）",
        "  docker logs <容器>   # 看容器日志，崩溃原因都在里面",
        "  docker inspect <容器> # 看详细配置（内存限制/端口/网络）",
        "  docker stop/start/restart <容器>",
        "  docker exec <容器> <命令>   # 进容器里执行命令",
        "容器 = 隔离的进程；排障顺序：ps → logs → inspect。",
    ]),
    "docker_memory": ("容器内存与 OOM", [
        "容器有内存上限（mem_limit），超了会被内核 OOM Kill：",
        "  退出码 137 = 被 SIGKILL（通常就是 OOM）",
        "  docker update --memory 2g <容器>  # 改限制",
        "真实排查：docker stats 看实时内存，docker inspect 看限制。",
        "应用要 2G，限制给 256M —— 这不是应用的 bug，是配置的 bug。",
    ]),
    "docker_network": ("容器网络", [
        "容器默认在 default 网络，互相之间不能直接按名字访问。",
        "  docker network ls                    # 看有哪些网络",
        "  docker network connect app-net cache-1  # 把容器接入网络",
        "同一网络里的容器可以用容器名互相通信（内置 DNS）。",
        "微服务连不上缓存/数据库，八成是网络没打通。",
    ]),
    "ci_build": ("CI 构建与语法错误", [
        "CI 第一步 build：把源码编译/打包成可运行产物。",
        "  SyntaxError: Unexpected token ':'  # 语法错误，编译器直接拒绝",
        "构建失败最常见的两类：语法错误、依赖缺失。",
        "看日志定位：pipeline logs build",
        "修完代码一定要重新跑流水线，别只改文件不验证。",
    ]),
    "ci_test": ("测试门禁与代码门禁", [
        "流水线里测试是门禁：任何用例失败都不能发布。",
        "  pytest 断言失败：assert add(1,2) == 4  ← 期望值写错了",
        "lint（静态检查）会拦下安全风险：eval、密码硬编码、过长行。",
        "门禁的意义：把问题挡在上线之前，而不是让线上替你测试。",
    ]),
    "ci_deploy": ("蓝绿发布与回滚", [
        "蓝绿发布：两套环境（蓝=线上，绿=新版本），切流量而非原地升级。",
        "  deploy --blue v2.3  → 先小流量验证",
        "  健康检查失败 → rollback（切回旧版本，秒级恢复）",
        "回滚是最高优先级的操作：先恢复线上，再查原因。",
        "全绿后 deploy --green 正式接管流量。",
    ]),
    "fe_dom": ("DOM 与页面渲染", [
        "浏览器把 HTML 解析成 DOM 树，脚本操作 DOM 实现交互。",
        "JS 一崩（ReferenceError 等），脚本后面的代码全部不执行 → 白屏。",
        "排障顺序：Console（JS 报错）→ Elements（结构）→ Network（资源）→ Performance。",
        "view 渲染不完整时，先看 JS 错误，再看样式，最后看性能。",
    ]),
    "fe_css": ("盒模型", [
        "每个元素都是一个盒子：content + padding + border + margin。",
        "width: 100% 指的是 content 的宽度，padding/border 会把它撑爆！",
        "  box-sizing: border-box   # width 包含 padding 和 border",
        "经典布局 bug：设了 100% 宽又加 padding，卡片溢出容器。",
    ]),
    "fe_js": ("JS 错误与事件绑定", [
        "  Uncaught ReferenceError: xxx is not defined  # 函数没定义就调用",
        "事件绑定：元素.addEventListener('click', fn) 或 onclick 属性。",
        "绑错函数（onclick='wrongFn'）→ 点击没反应或直接报错。",
        "排查：console 看报错 → 检查绑定的处理函数是否存在、参数对不对。",
    ]),
    "fe_perf": ("前端性能", [
        "首屏卡顿三大元凶：大图不懒加载、JS 阻塞渲染、频繁重排。",
        "  loading=\"lazy\"   # 图片滚动到视口才加载",
        "重排（layout thrashing）：反复读写布局属性，强制浏览器反复计算。",
        "目标：LCP < 2.5s，帧率 60fps。用 Performance 面板定位。",
    ]),
    "algo_dp": ("动态规划入门", [
        "DP = 把大问题拆成重叠子问题，用表存答案避免重复计算。",
        "  爬楼梯：f(n) = f(n-1) + f(n-2)（斐波那契）",
        "  零钱兑换：dp[i] = min(dp[i-c] + 1 for c in coins)",
        "三要素：状态定义、转移方程、初始条件。",
        "先写暴力递归，再记忆化，最后改成递推表——思路就通了。",
    ]),
    "algo_recursion": ("递归与分治", [
        "递归 = 函数调用自己，必须有终止条件。",
        "  汉诺塔：移动 n 个盘子 = 移 n-1 个 + 移最大 + 再移 n-1 个",
        "  f(n) = 2*f(n-1) + 1，f(1) = 1",
        "递归三步：终止条件 → 拆子问题 → 合并结果。",
        "递归深度过大可能栈溢出，但 n 小时完全没问题。",
    ]),
    "algo_binary": ("二分查找", [
        "在【有序】序列里查找，每次砍掉一半：O(log n)。",
        "  while lo <= hi:\n      mid = (lo + hi) // 2\n      if nums[mid] < target: lo = mid + 1\n      elif nums[mid] > target: hi = mid - 1\n      else: return mid",
        "边界是最大坑：<= 还是 <，+1 还是 -1，建议记住一个模板。",
    ]),
    "algo_hash": ("哈希表", [
        "哈希表（字典/集合）：O(1) 查找，用空间换时间。",
        "  异位词：统计每个字符出现次数，或直接排序后比较",
        "  两数之和：遍历时把 target-x 记进字典",
        "Python 里 dict/set 底层就是哈希表，很多 O(n²) 能优化成 O(n)。",
    ]),
    "algo_sliding": ("滑动窗口", [
        "固定长度窗口在数组上右移，求每个窗口的最值/和。",
        "暴力 O(n·k)；优化用单调队列 O(n)。",
        "  单调递减双端队列：队首是当前窗口最大值，新元素从队尾挤掉更小的",
        "  dq[0] <= i - k 时队首出窗口 → 弹出",
        "滑动窗口是双指针的进阶版，经典题：最大值、中位数、最小覆盖子串。",
    ]),
    "algo_string": ("字符串处理", [
        "Python 字符串不可变，很多操作生成新串：",
        "  s[::-1]          # 反转",
        "  s.upper()/lower()/strip()",
        "  ''.join(parts)   # 拼接（比 += 高效）",
        "  s.split(sep)     # 切分",
        "回文、反转、子串都是常客，先想清楚切片和索引。",
    ]),
    "algo_set": ("集合与去重", [
        "set 基于哈希表，O(1) 判断成员：",
        "  len(set(nums)) != len(nums)   # 有没有重复",
        "  set(a) & set(b)               # 交集",
        "去重、查重、求交集并集，用集合一行搞定。",
        "注意：集合元素必须可哈希（list 不行，tuple 可以）。",
    ]),
    "sec_log": ("日志溯源", [
        "攻击都会留下痕迹，日志是第一现场：",
        "  时间、来源 IP、请求路径、参数、状态码",
        "SQL 注入特征：' OR '1'='1、admin' --",
        "XSS 特征：<script>、javascript:",
        "暴力破解特征：同一账号/IP 高频 401/403",
        "排查顺序：看异常请求 → 定位漏洞 → 修复 → 封 IP。",
    ]),
    "sec_sqli": ("SQL 注入", [
        "把用户输入拼进 SQL 字符串 = 把数据库钥匙交给攻击者：",
        "  name = \"' OR '1'='1\"  →  WHERE name='' OR '1'='1' 恒真",
        "  name = \"admin' --\"    →  注释掉后面的条件",
        "正确做法：参数化查询（? 占位符）或 ORM，永远不拼接。",
        "防御纵深：最小权限账号 + 输入校验 + 参数化。",
    ]),
    "sec_xss": ("XSS 跨站脚本", [
        "XSS = 攻击者的脚本在【你的浏览器】里执行：",
        "  <script>alert(document.cookie)</script>",
        "反射型：输入回显在页面；存储型：存进数据库人人中招",
        "危害：偷 Cookie、伪造操作、钓鱼。",
        "防御：输出转义（< → &lt;）、CSP 头、HttpOnly Cookie。",
    ]),
    "sec_password": ("弱口令与账号安全", [
        "admin/123456 是攻击者的万能钥匙：",
        "  默认口令不换 = 大门敞开",
        "暴力破解：字典 + 高频尝试，几小时就能试完常见密码",
        "防御：强制复杂度、登录限速/锁定、双因素认证（2FA）。",
        "安全审计第一步永远是：查弱口令和默认口令。",
    ]),
    "sec_firewall": ("防火墙与封禁", [
        "发现攻击者 IP 后：先封禁止血，再修漏洞治本。",
        "  fw rule add <IP>   # 拒绝该 IP 全部请求",
        "封禁是临时措施：漏洞不修，攻击者换个 IP 又来。",
        "WAF/防火墙规则、限流、验证码都是常见防线。",
    ]),
})


# =====================================================================
# 课后测验：每个场景 3 道题。答题满分有成就。
# =====================================================================

QUIZZES = {
    "terminal_master": [
        ("grep -c 'ERROR' app.log 会输出什么？",
         ["包含 ERROR 的行内容", "匹配行数", "文件大小", "报错信息"], "B",
         "grep -c 只输出匹配的行数（count）。"),
        ("tail -n 20 access.log > report.txt 做了什么？",
         ["把前 20 行追加到 report.txt", "把最后 20 行覆盖写入 report.txt",
          "把最后 20 行打印到屏幕", "把整个文件复制到 report.txt"], "B",
         "> 是覆盖重定向，把 tail 的输出写进文件。"),
        ("执行 ./deploy.sh 报 Permission denied，应该先执行什么？",
         ["chmod +x deploy.sh", "sudo ./deploy.sh", "rm deploy.sh", "cd deploy.sh"], "A",
         "没有执行权限（x），用 chmod +x 加上。"),
    ],
    "git_quest": [
        ("git revert 和 git reset --hard 的关键区别？",
         ["revert 保留历史，reset 删历史", "没有区别",
          "revert 只能用于远程", "reset 更安全"], "A",
         "revert 生成反向提交保留历史，reset 移动指针可能丢提交。"),
        ("手滑 reset --hard 丢了提交，怎么找回来？",
         ["git reflog", "git log --all", "git branch -a", "git stash list"], "A",
         "reflog 记录 HEAD 的所有移动，包括被 reset 掉的提交。"),
        ("改到一半要切分支，先做什么？",
         ["git stash", "git add .", "git commit", "git merge"], "A",
         "git stash 暂存未提交改动，切完分支再 stash pop。"),
    ],
    "debug_detective": [
        ("arr = [1,2,3]，访问 arr[3] 会？",
         ["返回 3", "返回 None", "IndexError", "死循环"], "C",
         "索引从 0 开始，arr[3] 越界抛 IndexError。"),
        ("def add(x, bag=[]): bag.append(x) —— 连续调用两次会？",
         ["每次都是空列表", "第二次带着第一次的结果", "报错", "只保留最后一次"], "B",
         "默认参数 [] 只创建一次，所有调用共享。"),
        ("0.1 + 0.2 == 0.3 的结果是？",
         ["True", "False", "TypeError", "None"], "B",
         "二进制浮点表示不了 0.1，比较要用误差。"),
    ],
    "sql_rescue": [
        ("SELECT * FROM orders WHERE amount > 1000 会查出？",
         ["金额小于 1000 的订单", "金额大于 1000 的订单", "所有订单", "报错"], "B",
         "WHERE 过滤出满足条件的行。"),
        ("统计每个用户的订单数，用哪个语句？",
         ["SELECT user_id, COUNT(*) FROM orders GROUP BY user_id",
          "SELECT user_id FROM orders", "SELECT * FROM orders",
          "DELETE FROM orders"], "A",
         "GROUP BY 分组 + COUNT 聚合。"),
        ("UPDATE users SET email='a@b.com' 忘写 WHERE 会？",
         ["只改第一行", "改所有行", "报错", "不生效"], "B",
         "没有 WHERE 就是全表更新——生产事故级操作。"),
    ],
    "sysadmin_er": [
        ("磁盘快满了，先看哪个命令？",
         ["df -h", "top", "kill", "netstat"], "A",
         "df -h 看磁盘分区使用率，du 再定位大目录。"),
        ("进程 CPU 占用 90%，应该？",
         ["ps aux 找到 PID 再 kill", "重启服务器", "格式化磁盘", "删日志"], "A",
         "top/ps 定位进程，kill 终止。"),
        ("nginx 配置改了，生效命令是？",
         ["systemctl restart nginx", "kill -9 nginx", "rm nginx.conf", "reboot"], "A",
         "systemctl restart 重启服务加载新配置。"),
    ],
    "algo_arena": [
        ("两数之和的最优复杂度？",
         ["O(n²) 暴力", "O(n) 哈希表", "O(log n)", "O(1)"], "B",
         "遍历一次，用字典记录 target-x。"),
        ("括号匹配用什么数据结构？",
         ["栈", "队列", "哈希表", "树"], "A",
         "左括号入栈，右括号与栈顶配对。"),
        ("最大子数组和的经典算法是？",
         ["Kadane 算法 O(n)", "冒泡排序", "二分查找", "快速幂"], "A",
         "cur = max(x, cur+x)，一趟搞定。"),
    ],
    "network_sleuth": [
        ("curl 返回 502 通常说明？",
         ["客户端请求错了", "网关/代理连不上后端", "DNS 解析失败", "防火墙拦截"], "B",
         "502 Bad Gateway = 反向代理连不上上游服务。"),
        ("nslookup 结果不对，先查哪个文件？",
         ["/etc/hosts", "/var/log/nginx/error.log", "/etc/passwd", "/proc/meminfo"], "A",
         "hosts 优先于 DNS 服务器，写错就全错。"),
        ("tcpdump 看到同一 IP 疯狂发 SYN 不回 ACK，是？",
         ["SYN Flood 攻击", "正常访问", "DNS 污染", "证书过期"], "A",
         "SYN Flood 用大量半连接耗尽连接表。"),
    ],
    "container_storm": [
        ("容器退出码 137 通常意味着？",
         ["正常退出", "被 OOM Kill", "网络断开", "镜像不存在"], "B",
         "137 = 128 + 9(SIGKILL)，最常见原因是内存超限。"),
        ("两个容器都想绑定 8080 端口会？",
         ["两个都成功", "后启动的报端口占用", "系统重启", "网络断开"], "B",
         "宿主机端口是唯一的，冲突时启动失败。"),
        ("app 连不上 redis，最可能是？",
         ["不在同一网络", "redis 镜像太大", "端口写错格式", "需要 sudo"], "A",
         "不同网络的容器不能互相访问，用 network connect 打通。"),
    ],
    "pipeline_deploy": [
        ("流水线里测试阶段的作用是？",
         ["发布新功能", "拦截有问题的代码", "加速构建", "备份代码"], "B",
         "测试是门禁：用例不过就不允许发布。"),
        ("蓝绿发布的 rollback 指的是？",
         ["删掉新版本代码", "切回旧版本流量", "重启流水线", "清空缓存"], "B",
         "回滚 = 把流量切回健康环境，秒级恢复。"),
        ("lint 阶段拦下 eval() 是因为？",
         ["运行慢", "有安全风险", "语法错误", "风格问题"], "B",
         "eval 执行任意字符串，是代码注入的入口。"),
    ],
    "frontend_magic": [
        ("页面白屏，第一件事查？",
         ["JS 控制台报错", "CSS 颜色", "数据库", "服务器负载"], "A",
         "JS 一崩脚本全停，页面就渲染不出来。"),
        ("width:100% 加上 padding 后元素变宽是因为？",
         ["没有 box-sizing: border-box", "浏览器 bug", "字体太大", "没加 float"], "A",
         "默认 content-box，宽度不含 padding。"),
        ("首屏加载 12 张 5MB 大图卡顿，最佳方案？",
         ["懒加载 + 压缩图片", "删掉图片", "用视频", "加更多 CDN"], "A",
         "lazy 加载 + 图片压缩，立竿见影。"),
    ],
    "security_fortress": [
        ("SQL 注入的根本原因是什么？",
         ["把用户输入拼进 SQL 字符串", "数据库密码太短", "服务器没开防火墙", "用了 ORM"], "A",
         "拼接字符串是根因，参数化查询/ORM 是解药。"),
        ("XSS 攻击的代码在哪里执行？",
         ["攻击者的服务器上", "受害者的浏览器里", "数据库里", "防火墙里"], "B",
         "XSS 注入的脚本在受害者浏览器里执行，盗取 Cookie。"),
        ("发现攻击者 IP 后正确的处置顺序是？",
         ["先封禁止血，再修漏洞治本", "先删日志", "先改密码", "等明天再说"], "A",
         "封禁是止血，修复漏洞才是治本，否则换 IP 再来。"),
    ],
}


def run_quiz(profile, io, scenario_id):
    """课后测验：3 道选择题，答对得分 + 满分解锁成就。返回得分。"""
    from . import terminal as T
    from .engine import add_xp, unlock_achievement

    qs = QUIZZES.get(scenario_id)
    if not qs:
        io.print(T.paint("（这个场景还没有测验）", "dim"))
        return 0
    profile.setdefault("quiz", {})
    score = 0
    io.print(T.box([f"《{scenario_id}》课后测验：{len(qs)} 道题，答对一题 +10 XP",
                    "输入选项字母作答（A/B/C）。"], title="📝 课后测验", color="magenta"))
    for i, (q, options, answer, explain) in enumerate(qs, 1):
        io.print(T.paint(f"第 {i} 题：{q}", "bold"))
        for j, opt in enumerate(options):
            io.print(T.paint(f"   {chr(65 + j)}) {opt}", "cyan"))
        ans = io.input("你的答案 > ").strip().upper()
        if ans == answer:
            score += 1
            io.print(T.paint("  ✅ 答对了！", "green"))
        else:
            io.print(T.paint(f"  ❌ 正确答案是 {answer}。", "red") + T.paint("  " + explain, "dim"))
    xp = score * 10
    add_xp(profile, xp, io)
    profile["quiz"][scenario_id] = max(profile["quiz"].get(scenario_id, 0), score)
    if score == len(qs):
        unlock_achievement(profile, "quiz_master", io)
    io.print(T.paint(f"\n成绩：{score}/{len(qs)}，XP +{xp}", "bold", "green"))
    return score
