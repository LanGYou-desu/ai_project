'use strict';

// ── 叙事生成器 ──
// 把浏览器访问记录转化为一段文学叙事。
// 不是数据分析，不是监控——是一面镜子，让你看到自己今天的样子。

// ── 公共 API ──

function generateNarrative(visits, timeRange) {
  if (!visits || visits.length === 0) {
    const emptyDate = timeRange ? formatDate(timeRange.startMs) + ' 到 ' + formatDate(timeRange.endMs) : '今天';
    return {
      date: emptyDate,
      summary: '这个时间段你没有访问任何网站，或者历史记录不可用。',
      chapters: [],
      ending: '也许你在这个时间段需要的不是屏幕，而是别的什么。'
    };
  }

  // 按时间排序（ oldest first ）
  const sorted = [...visits].sort((a, b) => a.visitTime - b.visitTime);
  const date = timeRange
    ? formatDate(timeRange.startMs) + ' — ' + formatDate(timeRange.endMs)
    : formatDate(sorted[0].visitTime);

  // 分组为时段（间隔 > 15 分钟视为不同时段）
  const sessions = groupIntoSessions(sorted, 15 * 60 * 1000);

  // 生成章节
  const chapters = sessions.map(generateChapter);

  // 生成摘要
  const summary = generateSummary(sorted, timeRange);

  // 生成每日概览（在章节之前，提供整体视角）
  const overview = generateOverview(sorted, chapters, timeRange);

  // 生成结尾
  const ending = generateEnding(sorted, chapters, timeRange);

  return { date, summary, overview, chapters, ending };
}

// ── 核心逻辑 ──

function groupIntoSessions(visits, gapMs) {
  gapMs = gapMs || 30 * 60 * 1000; // 30 分钟
  const sessions = [];
  let current = null;

  for (const v of visits) {
    if (!current || (v.visitTime - current.end) > gapMs) {
      if (current) sessions.push(current);
      current = { visits: [v], start: v.visitTime, end: v.visitTime };
    } else {
      current.visits.push(v);
      current.end = v.visitTime;
    }
  }

  if (current) sessions.push(current);
  return sessions;
}

function generateChapter(session) {
  const domains = groupByDomain(session.visits);
  const sortedDomains = Object.entries(domains)
    .sort((a, b) => b[1].count - a[1].count);
  const topDomain = sortedDomains[0];

  const visitCount = session.visits.length;
  const uniqueDomains = Object.keys(domains).length;
  const durationMin = Math.round((session.end - session.start) / 60000);

  const pattern = detectPattern(session, domains);
  const narrative = composeNarrative(session, pattern, topDomain, sortedDomains);

  return {
    time: formatTime(session.start) + ' — ' + formatTime(session.end),
    duration: durationMin + ' 分钟',
    pattern: pattern,
    topDomain: topDomain ? topDomain[0] : '未知',
    visits: visitCount,
    domains: uniqueDomains,
    narrative: narrative
  };
}

function detectPattern(session, domains) {
  const count = session.visits.length;
  const uniqueCount = Object.keys(domains).length;
  const durationMin = Math.max((session.end - session.start) / 60000, 1);
  const maxRepeat = Math.max.apply(null, Object.values(domains).map(function(d) { return d.count; }));
  const dominantRatio = maxRepeat / count;
  const density = count / durationMin; // visits per minute

  // racing: 极高密度 — 短时间内大量点击
  if (density >= 1.5 && count >= 8) return 'racing';

  // absorbed: 极少访问但持续很久 — 深度沉浸
  if (count <= 3 && durationMin >= 60) return 'absorbed';

  // searching: 主域名高度重复 — 在同一个地方反复寻找
  if (dominantRatio >= 0.5 && maxRepeat >= 5) return 'searching';

  // scattered: 多域名分散 — 注意力在多个平台间跳跃
  if (uniqueCount >= 3 && count >= 10) return 'scattered';

  // oscillating: 恰好 2 个域名来回 — 在两个选项间犹豫
  if (uniqueCount === 2 && count >= 4) return 'oscillating';

  return 'steady';
}

// ── 叙事模板 ──
// 每个模式有多个变体，随机选择，避免重复感。

function composeNarrative(session, pattern, topDomain, sortedDomains) {
  const domainName = topDomain ? topDomain[0] : '某个地方';
  const count = session.visits.length;
  const duration = Math.round((session.end - session.start) / 60000);
  const timeOfDay = getTimeOfDay(session.start);

  const others = sortedDomains.filter(function(d) { return d[0] !== domainName; }).slice(0, 3);
  const otherNames = others.map(function(d) { return d[0]; });

  const variants = {
    scattered: [
      // 变体 1
      timeOfDay + '，你的注意力碎成了许多片。' + count + ' 次点击，' + uniqueCount() + ' 个地方，在 ' + duration + ' 分钟里。' +
      (otherNames.length > 0 ? '从 ' + domainName + ' 到 ' + otherNames.join('、') + '，' : '') +
      '像一只飞蛾在几盏灯之间来回。你最终关掉了屏幕，记不起自己一开始要找什么。',
      // 变体 2
      timeOfDay + '，你在几个窗口之间来回跳转。' + count + ' 次点击，' + duration + ' 分钟，' +
      uniqueCount() + ' 个不同的地方。你没有停留在任何一处，也没有离开任何一处。' +
      '最后你只是关掉了屏幕，好像什么都没发生过。',
      // 变体 3
      timeOfDay + '，' + count + ' 次点击在 ' + duration + ' 分钟内展开，' +
      uniqueCount() + ' 个不同的域名像走马灯一样在你眼前旋转。' +
      '你从 ' + domainName + ' 出发，经过' + (otherNames.length > 0 ? otherNames.join('、') : '几个页面') + '，' +
      '最终停在某个地方，记不起自己一开始要找什么。'
    ],
    absorbed: [
      timeOfDay + '，世界安静了下来。你打开 ' + domainName + '，然后就忘了时间。' +
      '没有跳转，没有关闭，只有你和屏幕之间的沉默对话。' +
      '这是今天最慢的一个小时——' + duration + ' 分钟，像停在没有风的海面上。',
      timeOfDay + '，你在 ' + domainName + ' 待了 ' + duration + ' 分钟。' +
      '没有搜索，没有跳转，只是看着。这是今天最安静的一段时间，' +
      '好像世界只剩下你和这个页面。',
      timeOfDay + '，' + duration + ' 分钟，' + count + ' 次访问，' +
      '全部在 ' + domainName + '。你没有离开，也没有被什么东西拉走。' +
      '这是今天最完整的一段时间，好像整个世界都安静了下来。'
    ],
    searching: [
      timeOfDay + '，你开始寻找。搜索、点击、返回、再搜索。' +
      '你的手指在键盘上飞奔，像一只不安的鸟。' +
      '你在 ' + domainName + ' 上停留了 ' + duration + ' 分钟，但你没有找到你想要的。' +
      '你在寻找中度过了这个' + timeOfDay + '。',
      timeOfDay + '，你在 ' + domainName + ' 和几个相关页面之间来回。' +
      count + ' 次点击，' + duration + ' 分钟。你好像在找什么，' +
      '但又说不清楚。每一次点击都带来一点希望，每一次返回都带来一点失落。',
      timeOfDay + '，' + count + ' 次访问，大部分集中在 ' + domainName + '。' +
      '像在迷宫里来回，你试过每一条路，但出口好像在移动。' +
      duration + ' 分钟后，你还在原地，但手还在动。'
    ],
    oscillating: [
      timeOfDay + '，你在两个世界之间来回。' + domainName + ' 和另一个地方，' +
      '像一个钟摆，从一个问题摆到另一个问题。' + count + ' 次切换，' +
      duration + ' 分钟，你没有答案，但你很忙。',
      timeOfDay + '，你在 ' + domainName + ' 和另一个页面之间反复切换。' +
      '像一个钟摆，从一个问题摆到另一个问题。' + count + ' 次切换，' +
      duration + ' 分钟。你好像在等什么，但什么都没等来。'
    ],
    racing: [
      timeOfDay + '，你从床上爬起来，手指在屏幕上滑行。' +
      count + ' 次点击，' + uniqueCount() + ' 个地方，' + duration + ' 分钟。' +
      '你还没有完全睡醒，但你的手已经知道该往哪里去。',
      timeOfDay + '，你的手指在屏幕上飞奔。' + count + ' 次点击，' +
      uniqueCount() + ' 个地方，' + duration + ' 分钟。' +
      '像一场没有终点的赛跑，你还没有完全清醒，但已经在路上了。'
    ],
    steady: [
      timeOfDay + '，你在 ' + domainName + ' 待了 ' + duration + ' 分钟。' +
      '不快，不慢，就是这样的节奏。',
      timeOfDay + '，' + duration + ' 分钟，' + count + ' 次访问，' +
      '大部分时间在 ' + domainName + '。没有特别的高潮，也没有特别的低谷。' +
      '就是这样，平平淡淡的一个时段。',
      timeOfDay + '，' + count + ' 次访问，' + duration + ' 分钟。' +
      '你在 ' + domainName + ' 和几个其他页面之间平稳移动。' +
      '没有特别的原因，也没有特别的终点。'
    ]
  };

  var list = variants[pattern] || variants.steady;
  return list[Math.floor(Math.random() * list.length)];

  function uniqueCount() {
    return Object.keys(groupByDomain(session.visits)).length;
  }
}

// ── 每日概览 ──

function generateOverview(visits, chapters, timeRange) {
  const totalDomains = new Set(visits.map(extractDomain)).size;
  const topDomain = getTopDomainOverall(visits);
  const totalDuration = Math.round(
    (visits[visits.length - 1].visitTime - visits[0].visitTime) / 60000
  );
  const periodLabel = timeRange ? (formatDate(timeRange.startMs) + ' 到 ' + formatDate(timeRange.endMs)) : '今天';

  // 统计各模式数量
  const counts = {};
  for (let i = 0; i < chapters.length; i++) {
    const p = chapters[i].pattern;
    counts[p] = (counts[p] || 0) + 1;
  }

  const patternLabels = {
    racing: '匆忙',
    absorbed: '沉浸',
    searching: '寻找',
    scattered: '漂移',
    oscillating: '犹豫',
    steady: '平稳'
  };

  const parts = Object.keys(counts).map(function(p) {
    return counts[p] + ' 段' + (patternLabels[p] || p);
  });

  let overview = periodLabel + '，' + visits.length + ' 次访问，' + totalDomains + ' 个网站。';
  overview += '在 ' + topDomain + ' 待得最久，一共 ' + totalDuration + ' 分钟。';

  if (parts.length > 0) {
    overview += ' 今天的节奏：' + parts.join('、') + '。';
  }

  return overview;
}

// ── 摘要 & 结尾 ──

function generateSummary(visits, timeRange) {
  const totalDomains = new Set(visits.map(extractDomain)).size;
  const topDomain = getTopDomainOverall(visits);
  const period = timeRange ? (formatDate(timeRange.startMs) + ' 到 ' + formatDate(timeRange.endMs)) : '今天';
  return period + '，你访问了 ' + visits.length + ' 次，' + totalDomains + ' 个网站，在 ' + topDomain + ' 待得最久。';
}

function generateEnding(visits, chapters, timeRange) {
  const totalDomains = new Set(visits.map(extractDomain)).size;
  const topDomain = getTopDomainOverall(visits);
  const totalDuration = Math.round(
    (visits[visits.length - 1].visitTime - visits[0].visitTime) / 60000
  );

  const searchingCount = chapters.filter(function(c) { return c.pattern === 'searching'; }).length;
  const absorbedCount = chapters.filter(function(c) { return c.pattern === 'absorbed'; }).length;
  const scatteredCount = chapters.filter(function(c) { return c.pattern === 'scattered'; }).length;

  var parts = [];
  if (searchingCount > 0) parts.push(searchingCount + ' 个时段你在寻找');
  if (absorbedCount > 0) parts.push(absorbedCount + ' 个时段你在停留');
  if (scatteredCount > 0) parts.push(scatteredCount + ' 个时段你在切换');

  const periodLabel = timeRange ? (formatDate(timeRange.startMs) + ' 到 ' + formatDate(timeRange.endMs)) : '今天';
  var reflection = periodLabel + '，你一共访问了 ' + totalDomains + ' 个网站，在 ' + topDomain + ' 待得最久。';

  if (parts.length > 0) {
    reflection += '有 ' + parts.join('，') + '。';
  }

  reflection += '你在屏幕前度过了 ' + totalDuration + ' 分钟。没有答案，但你还是在这里，度过了这段时间。';

  return reflection;
}

// ── 工具函数 ──

function extractDomain(url) {
  try {
    var u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch (e) {
    return '未知';
  }
}

function getTopDomainOverall(visits) {
  var domains = groupByDomain(visits);
  var sorted = Object.keys(domains).sort(function(a, b) {
    return domains[b].count - domains[a].count;
  });
  return sorted.length > 0 ? sorted[0] : '某个地方';
}

function groupByDomain(visits) {
  var groups = {};
  for (var i = 0; i < visits.length; i++) {
    var domain = extractDomain(visits[i].url);
    if (!groups[domain]) groups[domain] = { count: 0, titles: [] };
    groups[domain].count++;
    if (visits[i].title && visits[i].title !== '(无标题)') {
      groups[domain].titles.push(visits[i].title);
    }
  }
  return groups;
}

function formatTime(ts) {
  var d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function formatDate(ts) {
  var d = new Date(ts);
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
}

function getTimeOfDay(ts) {
  var h = new Date(ts).getHours();
  if (h >= 5 && h < 11) return '清晨';
  if (h >= 11 && h < 14) return '中午';
  if (h >= 14 && h < 18) return '下午';
  if (h >= 18 && h < 22) return '傍晚';
  return '深夜';
}

module.exports = { generateNarrative };