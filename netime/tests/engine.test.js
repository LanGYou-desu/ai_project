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
