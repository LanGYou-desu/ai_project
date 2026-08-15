/* LINGUA · 语言歌谣：用当前分支的演化词形生成短句（A4） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.lyrics = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 模板：words 为 {gloss: word} 词形表（也兼容 {gloss: {word, cat}}）
  function lyricsFor(words, grammar) {
    var form = function (g) { var v = words[g]; return typeof v === 'string' ? v : (v ? v.word : ''); };
    var has = function (g) { return !!form(g); };
    var out = [];

    if (has('战士') && has('狼') && has('看')) {
      var wo = grammar.wordOrder || 'SVO';
      var seq = wo === 'SOV' ? ['战士', '狼', '看'] : wo === 'VSO' ? ['看', '战士', '狼'] : ['战士', '看', '狼'];
      out.push({
        title: '语序之歌', zh: '战士看着狼。',
        line: seq.map(function (g) { return form(g); }).join(' '),
        gloss: seq.join('·')
      });
    }
    if (has('月亮') && has('孩子') && has('睡')) {
      out.push({
        title: '摇篮曲', zh: '月亮看着孩子入睡。',
        line: [form('月亮'), form('孩子'), form('睡')].join(' '),
        gloss: '月亮·孩子·睡'
      });
    }
    if (has('渔夫') && has('拿') && has('鱼') && has('三')) {
      out.push({
        title: '数鱼谣', zh: '渔夫拿起了三条鱼。',
        line: [form('渔夫'), form('拿'), form('鱼'), form('三')].join(' '),
        gloss: '渔夫·拿·鱼·三'
      });
    }
    if (has('火') && has('说') && has('水') && has('敌人')) {
      out.push({
        title: '水火谚', zh: '火说：水是敌人。',
        line: [form('火'), form('说'), form('水'), form('敌人')].join(' '),
        gloss: '火·说·水·敌人'
      });
    }
    if (has('母亲') && has('给') && has('孩子') && has('水')) {
      out.push({
        title: '赠水谣', zh: '母亲把水给了孩子。',
        line: [form('母亲'), form('给'), form('孩子'), form('水')].join(' '),
        gloss: '母亲·给·孩子·水'
      });
    }
    return out;
  }

  return { lyricsFor: lyricsFor };
});
