'use strict';
const E = global.NetEngine;
const P = global.NetPuzzle;
const T = global.NetTools;
const NetSites = global.NetSites;
const Story = global.Story;
const SITES = NetSites.SITES;

// 提取页面 HTML 中 <p> 文本
function paragraphTexts(html) {
  const out = [];
  const re = new RegExp('<p>([^<]*)</p>', 'g');
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

test('剧情：五枚线索对应五个年代', function () {
  Story.ERAS.forEach(function (era) {
    assert(SITES['e' + era.id + '_portal'] || era.home, era.id + ' 应有入口页面');
  });
});

test('剧情：1995 ROT13 密文可解且指向「网」', function () {
  const gb = SITES['e1995_guestbook'];
  assert(gb, '留言板应存在');
  assertContains(gb.html, 'Gur svefg xrl vf: JNAT', '密文应在留言板中');
  const dec = T.rot13('Gur svefg xrl vf: JNAT');
  assertContains(dec, 'WANG', '解码后应出现 WANG');
  assertContains(dec, 'The first key is', '解码后应出现提示语');
});

test('剧情：1995 告别帖有 SIGMA-7 的十年之约', function () {
  assertContains(SITES['e1995_bbs_thread'].html, '十年后见', '告别帖应有 SIGMA-7 回复');
});

test('剧情：2000 源代码摩斯解码出隐藏页地址', function () {
  const lab = SITES['e2000_lab'];
  assertContains(lab.html, 'YOU SHOULD GO TO RADIO', '源代码注释应有明文提示');
  assertContains(lab.html, '-.-- --- ..- / ... .... --- ..- .-.. -..', '源代码注释应有摩斯电码');
  const dec = T.morseDecode('-.-- --- ..- / ... .... --- ..- .-.. -.. / --. --- / - --- / .-. .- -.. .. ---');
  assertEq(dec, 'YOU SHOULD GO TO RADIO');
  const r = E.resolve('http://home.new-line.com/~guyan/radio.html');
  assertEq(r.page.id, 'e2000_lab_radio', 'radio.html 应指向隐藏页');
  assertContains(SITES['e2000_lab_radio'].html, '第二枚密钥：络');
});

test('剧情：2000 留言板呼应五年之约（时间线自洽）', function () {
  assertContains(SITES['e2000_lab_guestbook'].html, '五年了。你还在听吗？');
  assertContains(SITES['e2000_lab_radio'].html, '五年了。你还在听吗？');
  assertContains(SITES['e2000_lab_radio'].html, '我还在听');
  assertContains(SITES['e2010_forum'].html, '十五年整了');
  assertContains(SITES['e2010_keeper'].html, '十五年整');
});

test('剧情：2005 藏头诗指向第三条回复', function () {
  const blog = SITES['e2005_blog'];
  const paras = paragraphTexts(blog.html);
  assert(paras.length >= 6, '博客应至少 6 段');
  const acro = T.firstCharsOfLines(paras.join('\n'));
  assertEq(acro, '钥匙在第三条', '藏头应指向第三条回复');
  assertContains(blog.html, '第三枚钥匙是：之', '第三条回复应含密钥');
});

test('剧情：2010 Base64 签名 → 搜索 → 私密日志', function () {
  assertContains(SITES['e2010_forum'].html, 'b2JsaXZpb25fa2VlcGVy', '寻人帖应有签名档');
  const id = T.b64decodeUtf8('b2JsaXZpb25fa2VlcGVy');
  assertEq(id, 'oblivion_keeper');
  const res = E.search('2010', id);
  assert(res.some(function (p) { return p.id === 'e2010_keeper'; }), '搜索应命中私密日志');
  assertContains(SITES['e2010_keeper'].html, '第四枚密钥：声');
});

test('剧情：2025 信号页有口令表单', function () {
  const sig = SITES['e2025_signal'];
  assertContains(sig.html, 'data-netime="unlock"', '信号页应有解锁表单');
  assertContains(sig.html, '四个字', '信号页应提示口令长度');
});

test('剧情：结局页与留言表单', function () {
  const fin = SITES['e2025_final'];
  assertContains(fin.html, '网络之声 · 永存');
  assertContains(fin.html, 'data-netime="reply"');
  assertContains(fin.html, '--. --- --- -.. -... -.-- .', '结局页源代码应有摩斯彩蛋');
  assertEq(T.morseDecode('--. --- --- -.. -... -.-- .'), 'GOODBYE');
});

test('剧情：终章解释广播三十年的动机', function () {
  const fin = SITES['e2025_final'];
  assertContains(fin.html, '为什么广播三十年', '终章应回答动机');
  assertContains(fin.html, '声音，永远不会消失，它只是在等', '动机应与主题呼应');
  assertContains(fin.html, '怕他回来的时候，找不到我', '应点出 SIGMA-7 之约');
});

test('剧情：关于顾言页补充 SIGMA-7 背景', function () {
  const about = SITES['e2025_about'];
  assertContains(about.html, 'SIGMA-7', '关于页应提及 SIGMA-7');
  assertContains(about.html, '第一位听众来信的署名', '应说明 SIGMA-7 的身份');
  assertContains(about.html, '不是在逃跑，而是在等一个人回来', '应点明动机');
});

test('剧情：完整通关模拟（headless playthrough）', function () {
  P.reset();
  // 1) 访问 1995 留言板 → 解码 ROT13 → 提交「网」
  const dec1 = T.rot13('Gur svefg xrl vf: JNAT. V jvyy or jnvgvat va gur cynpr jurer gur fvtany yvirf.');
  assertContains(dec1, 'WANG');
  assert(P.submitKey('1995', '网').ok, '1995 应解锁');

  // 2) 访问 2000 实验室 → 查看源代码 → 摩斯解码 → 访问 radio.html → 提交「络」
  const dec2 = T.morseDecode('-.-- --- ..- / ... .... --- ..- .-.. -.. / --. --- / - --- / .-. .- -.. .. ---');
  assertEq(dec2, 'YOU SHOULD GO TO RADIO');
  const r2 = E.resolve('http://home.new-line.com/~guyan/radio.html');
  assert(r2.page, 'radio.html 应存在');
  assert(P.submitKey('2000', '络').ok, '2000 应解锁');

  // 3) 访问 2005 博客 → 藏头 → 第三条回复 → 提交「之」
  const paras = paragraphTexts(SITES['e2005_blog'].html);
  const acro = T.firstCharsOfLines(paras.join('\n'));
  assertEq(acro, '钥匙在第三条');
  assert(P.submitKey('2005', '之').ok, '2005 应解锁');

  // 4) 访问 2010 寻人帖 → Base64 解码 → 搜索 → 私密日志 → 提交「声」
  const id4 = T.b64decodeUtf8('b2JsaXZpb25fa2VlcGVy');
  const res4 = E.search('2010', id4);
  assert(res4.some(function (p) { return p.id === 'e2010_keeper'; }));
  assert(P.submitKey('2010', '声').ok, '2010 应解锁');

  // 5) 2025 档案馆 → 输入口令 → 结局
  assert(P.isEraUnlocked('2025'), '2025 应解锁');
  assert(P.submitPassword('网络之声').ok, '口令应通过');

  // 全部成就
  ['key1', 'key2', 'key3', 'key4', 'era5', 'final'].forEach(function (a) {
    assert(P.hasAchievement(a), '成就 ' + a + ' 应达成');
  });
});

test('剧情：所有线索页都能在对应年代内通过链接/搜索到达', function () {
  // 关键页面可达性（从各年代首页开始，链接可达或可搜索）
  function reachableFromHome(era, targetId) {
    const homeId = E.eraHome(era);
    const stack = [homeId];
    const seen = {};
    while (stack.length) {
      const cur = stack.pop();
      if (seen[cur]) continue;
      seen[cur] = true;
      if (cur === targetId) return true;
      const p = SITES[cur];
      const re = /href="([^"]+)"/g;
      let m;
      while ((m = re.exec(p.html)) !== null) {
        const r = E.resolve(m[1]);
        if (r.page && !r.page.hidden) stack.push(r.page.id);
      }
    }
    // 也允许通过搜索到达
    return E.search(era, '顾言').some(function (p) { return p.id === targetId; }) ||
           E.search(era, '网络之声').some(function (p) { return p.id === targetId; });
  }
  assert(reachableFromHome('1995', 'e1995_guestbook'), '1995 留言板应可达');
  assert(reachableFromHome('2000', 'e2000_lab'), '2000 实验室应可达');
  assert(reachableFromHome('2005', 'e2005_blog'), '2005 博客应可达');
  assert(reachableFromHome('2010', 'e2010_forum'), '2010 寻人帖应可达');
  assert(reachableFromHome('2025', 'e2025_signal'), '2025 信号页应可达');
});

test('剧情：每年代至少有一枚密钥线索', function () {
  ['1995', '2000', '2005', '2010'].forEach(function (era) {
    const keys = Story.KEYS[era];
    assert(keys && keys.char, era + ' 应有密钥定义');
  });
});

test('剧情：拨号年代仅为 1995/2000/2005', function () {
  Story.ERAS.forEach(function (era) {
    if (['1995', '2000', '2005'].indexOf(era.id) >= 0) {
      assert(era.dialup, era.id + ' 应为拨号年代');
    } else {
      assert(!era.dialup, era.id + ' 不应为拨号年代');
    }
  });
});

test('剧情：clue 定义齐全（每个谜题页都有线索）', function () {
  const clueIds = ['c1995', 'c1995b', 'c2000', 'c2000b', 'c2005', 'c2010', 'c2010b'];
  clueIds.forEach(function (cid) {
    let found = false;
    Object.keys(SITES).forEach(function (k) {
      if (SITES[k].clue && SITES[k].clue.id === cid) found = true;
    });
    assert(found, '线索 ' + cid + ' 应被某个页面定义');
  });
});
