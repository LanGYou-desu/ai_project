'use strict';
const E = global.NetEngine;
const NetSites = global.NetSites;
const Story = global.Story;

test('URL 解析：已知网址可解析到页面', function () {
  const r = E.resolve('http://bbs.yemaomao.cn/thread/1024');
  assert(r.page, '页面应存在');
  assertEq(r.page.id, 'e1995_bbs_thread');
});

test('URL 解析：尾斜杠与大小写无关紧要', function () {
  const r = E.resolve('http://www.chinanet-news.com/');
  assertEq(r.page.id, 'e1995_portal');
});

test('URL 解析：不存在的网址返回 404', function () {
  const r = E.resolve('http://www.chinanet-news.com/nothing-here');
  assert(r.notFound, '应为 404');
});

test('URL 解析：page id 直接解析', function () {
  assertEq(E.resolve('e2000_lab').page.id, 'e2000_lab');
});

test('搜索：query 参数解码', function () {
  const r = E.resolve('http://search.weiyu.cn/?q=' + encodeURIComponent('oblivion_keeper'));
  assertEq(r.page.id, 'e2010_search');
  assertEq(r.query, 'oblivion_keeper');
});

test('导航 + 历史后退/前进', function () {
  E.navigate('e1995_portal');
  E.navigate('e1995_bbs');
  assert(E.canBack(), '应可后退');
  const b = E.back();
  assertEq(b.id, 'e1995_portal');
  assert(E.canForward(), '应可前进');
  const f = E.forward();
  assertEq(f.id, 'e1995_bbs');
});

test('年代切换：回到对应年代首页', function () {
  const r = E.switchEra('2000');
  assertEq(r.page.id, 'e2000_portal');
  assertEq(E.state.era, '2000');
  const r2 = E.switchEra('1995');
  assertEq(r2.page.id, 'e1995_portal');
});

test('搜索：1995 搜「网络之声」能命中关键页面', function () {
  const res = E.search('1995', '网络之声');
  const ids = res.map(function (p) { return p.id; });
  assert(ids.indexOf('e1995_bbs') >= 0, '应命中夜猫子BBS');
  assert(ids.indexOf('e1995_bbs_thread') >= 0, '应命中告别帖');
  assert(ids.indexOf('e1995_show') >= 0, '应命中节目单');
});

test('搜索：2010 搜 oblivion_keeper 能命中私密日志', function () {
  const res = E.search('2010', 'oblivion_keeper');
  const ids = res.map(function (p) { return p.id; });
  assert(ids.indexOf('e2010_keeper') >= 0, '应命中 oblivion_keeper 主页');
});

test('搜索：隐藏页不出现在结果中', function () {
  const res2000 = E.search('2000', 'radio');
  const ids2000 = res2000.map(function (p) { return p.id; });
  assert(ids2000.indexOf('e2000_lab_radio') < 0, 'radio.html 隐藏页不应被搜到');
  const res2025 = E.search('2025', '信号');
  const ids2025 = res2025.map(function (p) { return p.id; });
  assert(ids2025.indexOf('e2025_final') < 0, '结局页不应被搜到');
});

test('链接完整性：所有页面内的链接都能解析', function () {
  const SITES = NetSites.SITES;
  let broken = 0;
  Object.keys(SITES).forEach(function (id) {
    const p = SITES[id];
    const re = /href="([^"]+)"/g;
    let m;
    while ((m = re.exec(p.html)) !== null) {
      const href = m[1];
      if (href === 'javascript:void(0)') continue;
      if (href.charAt(0) === '#') continue;
      const r = E.resolve(href);
      if (r.notFound) {
        broken++;
        console.log('    broken link in ' + id + ': ' + href);
      }
    }
  });
  assertEq(broken, 0, '存在无法解析的链接');
});

test('链接完整性：隐藏页不应被任何页面链接', function () {
  const SITES = NetSites.SITES;
  const hiddenIds = Object.keys(SITES).filter(function (k) { return SITES[k].hidden; });
  assert(hiddenIds.length > 0, '应存在隐藏页');
  hiddenIds.forEach(function (hid) {
    const p = SITES[hid];
    Object.keys(SITES).forEach(function (id) {
      if (id === hid) return;
      assert(SITES[id].html.indexOf(p.url) < 0,
        '页面 ' + id + ' 不应链接到隐藏页 ' + p.url);
    });
  });
});

test('页面完整性：每个年代有首页且存在', function () {
  Story.ERAS.forEach(function (era) {
    const home = E.eraHome(era.id);
    assert(home && NetSites.SITES[home], era.id + ' 的首页缺失');
  });
});

test('页面完整性：每个页面有标题、URL、关键词', function () {
  const SITES = NetSites.SITES;
  Object.keys(SITES).forEach(function (id) {
    const p = SITES[id];
    assert(p.title, id + ' 缺 title');
    assert(p.url, id + ' 缺 url');
    assert(Array.isArray(p.keywords), id + ' 缺 keywords');
  });
});

test('搜索页渲染：有结果与无结果', function () {
  const html1 = E.resultsHtml('1995', '夜猫子');
  assertContains(html1, '夜猫子BBS');
  const html2 = E.resultsHtml('1995', '不存在的关键词xyz');
  assertContains(html2, '没有找到');
});

test('404 页面生成', function () {
  const h = E.notFoundHtml('1995', 'http://x.cn/y');
  assertContains(h, '404');
  assertContains(h, 'http://x.cn/y');
});

/* ---------- 规范化 / 历史 / 转义 / 索引 ---------- */

test('URL 解析：大小写与锚点无关', function () {
  assertEq(E.resolve('HTTP://WWW.CHINANET-NEWS.COM/').page.id, 'e1995_portal');
  assertEq(E.resolve('http://BBS.Yemaomao.cn/Thread/1024').page.id, 'e1995_bbs_thread');
  assertEq(E.resolve('E2000_LAB').page.id, 'e2000_lab');
  assertEq(E.resolve('http://weiyu.cn/#top').page.id, 'e2010_weibo');
});

test('历史：后退/前进保留搜索查询串', function () {
  E.switchEra('2010');
  E.navigate('http://weiyu.cn/');
  E.navigate('http://search.weiyu.cn/?q=oblivion_keeper');
  assertEq(E.state.currentQuery, 'oblivion_keeper');
  assertEq(E.back().id, 'e2010_weibo');
  assertEq(E.state.currentQuery, null);
  assertEq(E.forward().id, 'e2010_search');
  assertEq(E.state.currentQuery, 'oblivion_keeper', '前进应恢复查询串');
  assertContains(E.resultsHtml(E.state.era, E.state.currentQuery), 'oblivion_keeper 的主页');
});

test('历史：同一页面换查询串也会入栈', function () {
  E.switchEra('2010');                       // 首页 e2010_weibo 入栈 1 次
  E.navigate('http://search.weiyu.cn/?q=aaa');
  E.navigate('http://search.weiyu.cn/?q=bbb');
  assertEq(E.state.history.length, 2, '换查询串应产生一条历史');
  assertEq(E.back().id, 'e2010_search');
  assertEq(E.state.currentQuery, 'aaa', '后退应回到上一个查询串');
});

test('404：当前页面引用被清空，再次导航可恢复', function () {
  E.switchEra('2010');
  E.navigate('http://weiyu.cn/');
  assert(E.current(), '应有当前页面');
  const r = E.navigate('http://nope.cn/x');
  assert(r.notFound, '应返回 404');
  assertEq(E.current(), null, '404 后不应再有当前页面（否则查看源代码会显示上一页）');
  E.navigate('http://weiyu.cn/');
  assertEq(E.current().id, 'e2010_weibo');
  assertEq(E.state.notFound, null);
});

test('搜索/404 页面转义 HTML（手输关键词不能注入标签）', function () {
  const html = E.resultsHtml('2010', '<img src=x onerror=alert(1)>');
  assert(html.indexOf('<img') < 0, '不应出现原始标签');
  assertContains(html, '&lt;img');
  const nf = E.notFoundHtml('2010', '<script>alert(1)</script>');
  assert(nf.indexOf('<script>') < 0);
  assertContains(nf, '&lt;script&gt;');
});

test('搜索索引：重建后结果不变', function () {
  const before = E.search('1995', '网络之声').map(function (p) { return p.id; }).join(',');
  E.buildIndexes();
  const after = E.search('1995', '网络之声').map(function (p) { return p.id; }).join(',');
  assertEq(after, before);
  assert(before.length > 0);
});

test('搜索引擎：1995-2010 各有一台，2025 年没有', function () {
  ['1995', '2000', '2005', '2010'].forEach(function (era) {
    assert(E.eraSearchPage(era), era + ' 应有搜索引擎');
  });
  assertEq(E.eraSearchPage('2025'), null, '2025 年没有搜索引擎');
});
