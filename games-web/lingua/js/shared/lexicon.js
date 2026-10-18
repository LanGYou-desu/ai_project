/* LINGUA · 原始词汇表（原型语言词根 + 中文释义 + 语义类别） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.lexicon = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // gloss: 中文释义, word: 原始词形（小写，元音可双写表长音）, cat: 语义类别
  var LEXICON = [
    // 自然
    { gloss: '太阳', word: 'suna', cat: 'nature' },
    { gloss: '月亮', word: 'mune', cat: 'nature' },
    { gloss: '水', word: 'woda', cat: 'nature' },
    { gloss: '火', word: 'agni', cat: 'nature' },
    { gloss: '山', word: 'kalma', cat: 'nature' },
    { gloss: '树', word: 'tekwa', cat: 'nature' },
    { gloss: '海', word: 'mora', cat: 'nature' },
    { gloss: '河', word: 'sila', cat: 'nature' },
    { gloss: '星', word: 'hela', cat: 'nature' },
    { gloss: '云', word: 'wumba', cat: 'nature' },
    { gloss: '雨', word: 'lesu', cat: 'nature' },
    { gloss: '雪', word: 'sneha', cat: 'nature' },
    { gloss: '风', word: 'winta', cat: 'nature' },
    { gloss: '石', word: 'kata', cat: 'nature' },
    { gloss: '土', word: 'dama', cat: 'nature' },
    // 身体
    { gloss: '眼睛', word: 'okwa', cat: 'body' },
    { gloss: '手', word: 'tana', cat: 'body' },
    { gloss: '心', word: 'kurdi', cat: 'body' },
    { gloss: '血', word: 'sengu', cat: 'body' },
    { gloss: '头', word: 'kapa', cat: 'body' },
    // 亲属
    { gloss: '母亲', word: 'mata', cat: 'family' },
    { gloss: '父亲', word: 'pata', cat: 'family' },
    { gloss: '孩子', word: 'pikwa', cat: 'family' },
    { gloss: '兄弟', word: 'brata', cat: 'family' },
    { gloss: '姐妹', word: 'sista', cat: 'family' },
    // 人
    { gloss: '王', word: 'kumba', cat: 'people' },
    { gloss: '战士', word: 'wira', cat: 'people' },
    { gloss: '巫师', word: 'maga', cat: 'people' },
    { gloss: '朋友', word: 'pendu', cat: 'people' },
    { gloss: '敌人', word: 'torga', cat: 'people' },
    { gloss: '猎人', word: 'kira', cat: 'people' },
    { gloss: '渔夫', word: 'nanga', cat: 'people' },
    // 动作
    { gloss: '走', word: 'gwa', cat: 'action' },
    { gloss: '吃', word: 'laku', cat: 'action' },
    { gloss: '说', word: 'tela', cat: 'action' },
    { gloss: '爱', word: 'amara', cat: 'action' },
    { gloss: '死', word: 'marta', cat: 'action' },
    { gloss: '唱', word: 'siga', cat: 'action' },
    { gloss: '看', word: 'welda', cat: 'action' },
    { gloss: '听', word: 'horda', cat: 'action' },
    { gloss: '睡', word: 'nosma', cat: 'action' },
    { gloss: '跑', word: 'kala', cat: 'action' },
    // 物
    { gloss: '家', word: 'koro', cat: 'object' },
    { gloss: '路', word: 'wata', cat: 'object' },
    { gloss: '桥', word: 'tiba', cat: 'object' },
    { gloss: '舟', word: 'nawa', cat: 'object' },
    { gloss: '铁', word: 'garna', cat: 'object' },
    { gloss: '金', word: 'surma', cat: 'object' },
    { gloss: '布', word: 'tula', cat: 'object' },
    { gloss: '刀', word: 'kera', cat: 'object' },
    // 抽象
    { gloss: '名字', word: 'nima', cat: 'abstract' },
    { gloss: '语言', word: 'tarka', cat: 'abstract' },
    { gloss: '梦', word: 'sapna', cat: 'abstract' },
    { gloss: '死亡', word: 'maru', cat: 'abstract' },
    { gloss: '神', word: 'dewsa', cat: 'abstract' },
    { gloss: '灵魂', word: 'atma', cat: 'abstract' },
    { gloss: '故事', word: 'kanta', cat: 'abstract' },
    // 数词
    { gloss: '一', word: 'bana', cat: 'number' },
    { gloss: '二', word: 'tara', cat: 'number' },
    { gloss: '三', word: 'nusa', cat: 'number' },
    // 时间
    { gloss: '年', word: 'sara', cat: 'time' },
    { gloss: '春', word: 'wesra', cat: 'time' },
    { gloss: '冬', word: 'hima', cat: 'time' },
    { gloss: '夜', word: 'ratna', cat: 'time' },
    { gloss: '日', word: 'dela', cat: 'time' },
    { gloss: '狼', word: 'wolka', cat: 'animal' },
    { gloss: '熊', word: 'berna', cat: 'animal' },
    { gloss: '鹿', word: 'helwa', cat: 'animal' },
    { gloss: '鱼', word: 'piska', cat: 'animal' },
    { gloss: '鸟', word: 'ferga', cat: 'animal' },
    { gloss: '蛇', word: 'serga', cat: 'animal' },
    { gloss: '兔', word: 'turpa', cat: 'animal' },
    { gloss: '红', word: 'ruda', cat: 'color' },
    { gloss: '黑', word: 'sama', cat: 'color' },
    { gloss: '白', word: 'bela', cat: 'color' },
    { gloss: '蓝', word: 'zula', cat: 'color' },
    { gloss: '怕', word: 'tremi', cat: 'emotion' },
    { gloss: '喜', word: 'gada', cat: 'emotion' },
    { gloss: '怒', word: 'wanga', cat: 'emotion' },
    { gloss: '哭', word: 'kraya', cat: 'emotion' },
    { gloss: '笑', word: 'smeha', cat: 'emotion' },
    { gloss: '东', word: 'esra', cat: 'direction' },
    { gloss: '西', word: 'wesa', cat: 'direction' },
    { gloss: '南', word: 'suda', cat: 'direction' },
    { gloss: '北', word: 'norta', cat: 'direction' },
    { gloss: '雷', word: 'troma', cat: 'nature' },
    { gloss: '雾', word: 'mista', cat: 'nature' },
    { gloss: '岛', word: 'wisa', cat: 'nature' },
    { gloss: '湖', word: 'laga', cat: 'nature' },
    { gloss: '藤', word: 'wika', cat: 'nature' },
    { gloss: '弓', word: 'sanku', cat: 'object' },
    { gloss: '箭', word: 'tirwa', cat: 'object' },
    { gloss: '网', word: 'neta', cat: 'object' },
    { gloss: '绳', word: 'gurda', cat: 'object' },
    { gloss: '陶', word: 'kuta', cat: 'object' },
    { gloss: '祖父', word: 'awo', cat: 'family' },
    { gloss: '祖母', word: 'ama', cat: 'family' },
    { gloss: '女儿', word: 'tuka', cat: 'family' },
    { gloss: '儿子', word: 'puna', cat: 'family' },
    { gloss: '飞', word: 'fliga', cat: 'action' },
    { gloss: '游', word: 'nagwa', cat: 'action' },
    { gloss: '知', word: 'sapa', cat: 'action' },
    { gloss: '给', word: 'dawa', cat: 'action' },
    { gloss: '建', word: 'bora', cat: 'action' },
    { gloss: '歌', word: 'sigwa', cat: 'abstract' },
    { gloss: '舞', word: 'dansa', cat: 'abstract' },
  { gloss: '坐', word: 'sada', cat: 'action' },
  { gloss: '拿', word: 'tema', cat: 'action' },
  { gloss: '找', word: 'wanda', cat: 'action' },
  { gloss: '来', word: 'gama', cat: 'action' },
  { gloss: '去', word: 'duwa', cat: 'action' },
  { gloss: '站', word: 'stara', cat: 'action' },
  { gloss: '躺', word: 'lega', cat: 'action' },
  { gloss: '想', word: 'sanka', cat: 'abstract' },
  { gloss: '问', word: 'kahta', cat: 'abstract' },
  { gloss: '答', word: 'warga', cat: 'abstract' },
  { gloss: '愿', word: 'welpa', cat: 'abstract' },
  { gloss: '时', word: 'tima', cat: 'abstract' },
  { gloss: '上', word: 'upa', cat: 'direction' },
  { gloss: '下', word: 'neda', cat: 'direction' },
  { gloss: '里', word: 'inna', cat: 'direction' },
  { gloss: '外', word: 'ula', cat: 'direction' },
  { gloss: '前', word: 'fanta', cat: 'direction' },
  { gloss: '后', word: 'bako', cat: 'direction' }
  ];

  var BY_GLOSS = {};
  LEXICON.forEach(function (e) { BY_GLOSS[e.gloss] = e; });

  var CATS = {
    nature: '天地自然', body: '身体', family: '亲属', people: '人群',
    action: '动作', object: '器物', abstract: '抽象', number: '数词', time: '时间',
    animal: '动物', color: '颜色', emotion: '情绪', direction: '方位'
  };

  function protoLexicon() {
    var m = {};
    LEXICON.forEach(function (e) { m[e.gloss] = { word: e.word, cat: e.cat }; });
    return m;
  }

  return { LEXICON: LEXICON, BY_GLOSS: BY_GLOSS, CATS: CATS, protoLexicon: protoLexicon };
});
