/* LINGUA · 世界设定数据（与演化逻辑解耦） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.worlddata = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SPLITS = [
    { epoch: 6, flavor: '一场大洪水把部落冲散成两支：一支留在原地，一支翻过了东边的山。' },
    { epoch: 12, flavor: '翻山的那一支越走越远，和留在原地的亲戚渐渐断了来往。' },
    { epoch: 16, flavor: '海面继续上升，靠海的部族再次分裂：一支造船远航，一支退回山里。' }
  ];
  var LOANS = [
    { epoch: 8,  branchIndex: [0, 1], words: [{ gloss: '马', word: 'kanpa', cat: 'object' }, { gloss: '剑', word: 'sawru', cat: 'object' }, { gloss: '商人', word: 'bazar', cat: 'people' }, { gloss: '盐', word: 'nemti', cat: 'object' }], flavor: '北方的骑兵带来了铁器和陌生的词。', note: '借词' },
    { epoch: 14, branchIndex: [1, 0], words: [{ gloss: '茶', word: 'chaya', cat: 'object' }, { gloss: '帆', word: 'salwa', cat: 'object' }, { gloss: '珍珠', word: 'muti', cat: 'object' }, { gloss: '香料', word: 'spisa', cat: 'object' }], flavor: '南来的海商逆河而上，带来了茶、香料和远方的词。', note: '借词·海商' },
    { epoch: 11, branchIndex: [0, 0], words: [{ gloss: '书', word: 'buka', cat: 'object' }, { gloss: '纸', word: 'pira', cat: 'object' }, { gloss: '法', word: 'toba', cat: 'abstract' }, { gloss: '信', word: 'sura', cat: 'abstract' }], flavor: '远来的传教士带来了书写——还有几个陌生的词。', note: '借词·传教士' },
    { epoch: 15, branchIndex: [1, 1], words: [{ gloss: '税', word: 'taksa', cat: 'abstract' }, { gloss: '令', word: 'gata', cat: 'abstract' }, { gloss: '城', word: 'barga', cat: 'object' }, { gloss: '兵', word: 'solda', cat: 'people' }], flavor: '新兴的官府开始征税点兵，也带来了官话里的词。', note: '借词·官府' }
  ];
  var WRITING_EPOCH = 10;
  var WRITING_FLAVOR = '巫师开始在龟甲上刻记号——文字诞生了。';
  var FLAVORS = [
    '这一年收成很好，宴会上人们唱了整夜。',
    '部落与邻族交换了石器和兽皮。',
    '一场瘟疫夺走了三分之一的族人。',
    '孩子们开始用新的口音说话，大人们皱起眉头。',
    '旱季延长了，人们沿着河床寻找新的水源。',
    '老巫师去世前，把所有的歌教给了最小的徒弟。',
    '战争结束了，俘虏成了家里的劳力。',
    '丰收之后，人们第一次在河边建起了石屋。',
    '一场山火让部落连夜迁徙，很多词在匆忙中被改了。',
    '远方的旅人留下来做了女婿，带来了几种新说法。',
    '两个部族第一次交换了歌谣——语速快的那个总是赢。',
    '山洪冲走了羊群，人们发誓再也不提那个词。',
    '一位远来的歌者教会了部落新的音调。',
    '母亲们开始用叠词哄孩子，年轻人觉得幼稚，却也偷偷地学。',
    '为了一段姻缘，两个村子合并了语言。',
    '巫师禁止直呼神灵之名，人们改用绕弯的说法。'
  ];
  var NAME_WORDS = ['水', '河', '山', '星', '风', '月亮', '火', '石'];
  return { SPLITS: SPLITS, LOANS: LOANS, WRITING_EPOCH: WRITING_EPOCH, WRITING_FLAVOR: WRITING_FLAVOR, FLAVORS: FLAVORS, NAME_WORDS: NAME_WORDS };
});
