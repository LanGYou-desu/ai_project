/* LINGUA · 语法演化事件库 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.grammar = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT = {
    wordOrder: 'SVO',   // SVO / SOV / VSO
    plural: null,       // null | '-k'
    past: null,         // null | '-ta'
    articles: false,    // false | true
    genitive: null,     // null | '-s'
    question: null,     // null | '-ma'
    passive: false,     // false | true
    evidential: null,   // null | '-ya'
    numerals: '一至三',  // 一至三 / 一至十
    dual: null,         // null | '-n'  双数标记
    gender: null,       // null | '阴/阳'
    negation: null,     // null | '-na' 否定后缀
    progressive: null,  // null | '-ga' 进行体
    onom: false,        // 拟声词化
    redup: false,       // 叠词
    classifier: null,   // null | '-ka' 量词
    perfect: null,      // null | '-to' 完成体
    pronouns: false,    // 完整代词系统
    honorific: false,   // 敬语
    compounding: false, // 复合词化
    postpos: null       // null | '-ni' 后置词
  };

  var EVENTS = [
    { id: 'wo_sov', name: '语序变为 SOV', weight: 3,
      flavor: '猎手们习惯把猎物放在动词前——重要的东西要先开口。',
      apply: function (g) { g.wordOrder = 'SOV'; return '语序从 SVO 变成 SOV：宾语被提前了。'; } },
    { id: 'wo_vso', name: '语序变为 VSO', weight: 2,
      flavor: '祭祀时巫师总是先喊出动作，再喊出对象。',
      apply: function (g) { g.wordOrder = 'VSO'; return '语序从 SVO 变成 VSO：动词跑到了最前面。'; } },
    { id: 'plural_k', name: '复数标记 -k', weight: 3,
      flavor: '说起一群狼时，人们会在词尾加一个 k。',
      apply: function (g) { g.plural = '-k'; return '名词复数标记出现：词尾的 -k。'; } },
    { id: 'past_ta', name: '过去时标记 -ta', weight: 3,
      flavor: '讲故事的人开始给动词加上过去标记。',
      apply: function (g) { g.past = '-ta'; return '动词过去时标记出现：-ta。'; } },
    { id: 'art_la', name: '冠词出现', weight: 2,
      flavor: '人们开始说"那个太阳"——冠词从指示词里长了出来。',
      apply: function (g) { g.articles = true; return '冠词出现（那个/一个）。'; } },
    { id: 'gen_s', name: '属格标记 -s', weight: 2,
      flavor: '所有权开始用后缀表达：母亲的屋 = matas koro。',
      apply: function (g) { g.genitive = '-s'; return '属格标记出现：-s。'; } },
    { id: 'q_ma', name: '疑问标记 -ma', weight: 2,
      flavor: '问句有了专门的收尾音——一问，就知道在问。',
      apply: function (g) { g.question = '-ma'; return '疑问标记出现：-ma。'; } },
    { id: 'passive', name: '被动语态出现', weight: 2,
      flavor: '受苦的一方开始占据句子的首位。',
      apply: function (g) { g.passive = true; return '被动语态出现。'; } },
    { id: 'evid_ya', name: '传闻标记 -ya', weight: 2,
      flavor: '"听说"被语法化：动词后加 -ya 表示消息来自传闻。',
      apply: function (g) { g.evidential = '-ya'; return '传闻标记出现：-ya（"据说"）。'; } },
    { id: 'numerals_ten', name: '数词扩展至十', weight: 2,
      flavor: '贸易需要计数——数词系统从一到三扩展到了十。',
      apply: function (g) { g.numerals = '一至十'; return '数词系统扩展到一至十。'; } },
    { id: 'dual_n', name: '双数标记 -n', weight: 2,
      flavor: '说起成双的东西时，词尾会多一个 n：两只眼睛、一对鞋。',
      apply: function (g) { g.dual = '-n'; return '双数标记出现：-n（只用于成双成对）。'; } },
    { id: 'gender', name: '名词分阴阳', weight: 2,
      flavor: '名词开始分阴阳——太阳是阳，月亮是阴，石头是阳，河流是阴。',
      apply: function (g) { g.gender = '阴/阳'; return '名词性类出现：阴/阳。'; } },
    { id: 'neg_na', name: '否定标记 -na', weight: 2,
      flavor: '"不"不再是一个独立的词，而是粘在动词尾巴上：吃na。',
      apply: function (g) { g.negation = '-na'; return '否定标记出现：-na。'; } },
    { id: 'prog_ga', name: '进行体标记 -ga', weight: 2,
      flavor: '正在发生的事，动词会换一个样子——人们开始区分"在唱"和"唱过"。',
      apply: function (g) { g.progressive = '-ga'; return '进行体标记出现：-ga。'; } },
    { id: 'onom', name: '拟声词化', weight: 2, epochLo: 5, epochHi: 19,
      flavor: '雷就是"轰"，风就是"呼"——人们开始直接用声音命名声音。',
      apply: function (g) { g.onom = true; return '拟声词化出现。'; } },
    { id: 'redup', name: '叠词', weight: 2, epochLo: 6, epochHi: 19,
      flavor: '"小小""慢慢""星星亮亮"——重复成了强调的方式。',
      apply: function (g) { g.redup = true; return '叠词用法出现。'; } },
    { id: 'classifier', name: '量词 -ka', weight: 2, epochLo: 7, epochHi: 19,
      flavor: '数词不再直接贴着名词：三条鱼要"鱼三ka"。',
      apply: function (g) { g.classifier = '-ka'; return '量词标记出现：-ka。'; } },
    { id: 'perfect', name: '完成体标记 -to', weight: 2, epochLo: 8, epochHi: 19,
      flavor: '"已经做完"和"正在做"彻底分了家。',
      apply: function (g) { g.perfect = '-to'; return '完成体标记出现：-to。'; } },
    { id: 'pronouns', name: '代词系统完善', weight: 2, epochLo: 9, epochHi: 19,
      flavor: '我、你、他不再是借来的词——代词长出了自己的形状。',
      apply: function (g) { g.pronouns = true; return '完整的代词系统出现。'; } },
    { id: 'honorific', name: '敬语系统', weight: 2, epochLo: 10, epochHi: 19,
      flavor: '对长辈说话要加"尊"，对神灵说话要加"圣"。',
      apply: function (g) { g.honorific = true; return '敬语系统出现。'; } },
    { id: 'compounding', name: '复合词化', weight: 2, epochLo: 11, epochHi: 19,
      flavor: '"太阳之眼"不再是一个短语，而是一个词。',
      apply: function (g) { g.compounding = true; return '复合词化开始：短语被焊成了词。'; } },
    { id: 'postpos', name: '后置词 -ni', weight: 2, epochLo: 12, epochHi: 19,
      flavor: '"山上""水里"——方位词退到了名词后面，变成后置词。',
      apply: function (g) { g.postpos = '-ni'; return '后置词标记出现：-ni。'; } }
  ];

  function freshGrammar() { return JSON.parse(JSON.stringify(DEFAULT)); }

  return { DEFAULT: DEFAULT, EVENTS: EVENTS, freshGrammar: freshGrammar };
});
