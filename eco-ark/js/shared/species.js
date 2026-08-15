/* ECO-ARK · 物种数据库（浏览器 + Node 双端 UMD） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.ECOARK = root.ECOARK || {}; root.ECOARK.species = factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  // 地形编码
  var TERRAIN = {
    GRASS: 0, FOREST: 1, WATER: 2, SAND: 3, ROCK: 4, MARSH: 5
  };
  var TERRAIN_NAMES = ['草地', '林地', '水域', '沙地', '岩地', '湿地'];
  var TERRAIN_COLORS = ['#4d7c3a', '#2f5d33', '#2b6ea8', '#c9b37a', '#7a7d85', '#3d6b4f'];

  function fit01(v, min, max) {
    // 舒适范围中间为 1，两端线性降到 0
    var mid = (min + max) / 2;
    var span = (max - min) / 2;
    if (span <= 0) return 1;
    var d = Math.abs(v - mid) / span;
    if (d >= 1) return 0;
    return 1 - d;
  }

  var PLANTS = [
    { id: 'moss',  name: '苔原苔藓', emoji: '🌿', color: '#7fae5a', type: 'plant',
      growth: 0.05, food: 4, cap: 0.5,
      terrain: { 0: 0.5, 1: 0.7, 2: 0, 3: 0.1, 4: 0.5, 5: 0.3 },
      tempMin: -8, tempMax: 32, moistMin: 0.15, moistMax: 1,
      unlock: 1, desc: '极耐寒的低矮苔藓，能在岩缝与冻土边缘存活，是冰期里最后的绿色。' },
    { id: 'grass', name: '草原禾草', emoji: '🌾', color: '#8bc34a', type: 'plant',
      growth: 0.10, food: 8, cap: 0.6,
      terrain: { 0: 1, 1: 0.3, 2: 0, 3: 0.05, 4: 0.02, 5: 0.4 },
      tempMin: 0, tempMax: 38, moistMin: 0.2, moistMax: 0.95,
      unlock: 1, desc: '草原基石的禾本科植物，生长快、能量密度高，支撑着整个食草动物网络。' },
    { id: 'shrub', name: '耐旱灌木', emoji: '🌵', color: '#6d9b3a', type: 'plant',
      growth: 0.055, food: 10, cap: 0.5,
      terrain: { 0: 0.8, 1: 0.5, 2: 0, 3: 0.4, 4: 0.1, 5: 0.4 },
      tempMin: -5, tempMax: 42, moistMin: 0.08, moistMax: 0.9,
      unlock: 1, desc: '根系深扎的灌木，干旱时仍能坚持光合，是荒漠边缘的生命线。' },
    { id: 'tree',  name: '落叶乔木', emoji: '🌳', color: '#3f7a3a', type: 'plant',
      growth: 0.028, food: 16, cap: 0.7,
      terrain: { 0: 0.35, 1: 1, 2: 0, 3: 0.02, 4: 0.02, 5: 0.2 },
      tempMin: -12, tempMax: 36, moistMin: 0.3, moistMax: 1,
      unlock: 2, desc: '缓慢生长的高大乔木，单株生物量巨大，是森林生态系统的骨架。' },
    { id: 'algae', name: '水生藻类', emoji: '🫧', color: '#3ecf8e', type: 'plant',
      growth: 0.14, food: 3, cap: 0.9,
      terrain: { 0: 0, 1: 0, 2: 1, 3: 0, 4: 0, 5: 0.5 },
      tempMin: 0, tempMax: 36, moistMin: 0.4, moistMax: 1,
      unlock: 1, desc: '水中的浮游生产者，繁殖极快，是水生态系统的能量之源。' },
    { id: 'reed',  name: '河岸芦苇', emoji: '🎋', color: '#a3b565', type: 'plant',
      growth: 0.07, food: 6, cap: 0.6,
      terrain: { 0: 0.15, 1: 0.1, 2: 0.4, 3: 0.02, 4: 0, 5: 1 },
      tempMin: 0, tempMax: 40, moistMin: 0.3, moistMax: 1,
      unlock: 2, desc: '湿地与浅水的挺水植物，为水陆交界带来生机。' },
    { id: 'cactus',name: '砂原仙人掌', emoji: '🌵', color: '#7d9b4a', type: 'plant',
      growth: 0.02, food: 2, cap: 0.4,
      terrain: { 0: 0.1, 1: 0, 2: 0, 3: 1, 4: 0.3, 5: 0.02 },
      tempMin: 10, tempMax: 52, moistMin: 0, moistMax: 0.3,
      unlock: 3, desc: '把水分储存在体内的沙漠植物，几乎不需要降水。' },
    { id: 'fern',  name: '巨型蕨类', emoji: '🌿', color: '#2e8b57', type: 'plant',
      growth: 0.035, food: 12, cap: 0.6,
      terrain: { 0: 0.15, 1: 1, 2: 0, 3: 0, 4: 0.1, 5: 0.6 },
      tempMin: 4, tempMax: 33, moistMin: 0.4, moistMax: 1,
      unlock: 2, desc: '偏爱湿润林下的巨型蕨类，能量丰沛但娇贵。' },
    { id: 'vine',  name: '外来藤蔓', emoji: '🪢', color: '#b94a8a', type: 'plant',
      growth: 0.13, food: 2, cap: 0.6,
      terrain: { 0: 0.85, 1: 0.55, 2: 0, 3: 0.05, 4: 0.05, 5: 0.8 },
      tempMin: 4, tempMax: 40, moistMin: 0.3, moistMax: 1,
      unlock: 99, invasive: true,
      desc: '来自另一颗星球的入侵物种：生长极快、几乎没有天敌，会挤占本土植物的生态位。' }
  ];

  var ANIMALS = [
    { id: 'insect', name: '草间昆虫', emoji: '🦗', color: '#c8d44a', type: 'herbivore',
      M: 0.05, metab: 0.010, repro: 0.7, reproE: 1.6, lifespan: 7, speed: 1.3, vision: 2,
      terrain: [0, 1, 5], diet: ['moss', 'grass', 'algae'], dietTerrain: null,
      tempMin: -2, tempMax: 38, moistMin: 0.02, moistMax: 1,
      unlock: 1, desc: '数量庞大、繁殖惊人的小食客，是能量金字塔最底层消费者的主力。' },
    { id: 'vole', name: '草甸田鼠', emoji: '🐭', color: '#b9a35a', type: 'herbivore',
      M: 0.3, metab: 0.045, repro: 0.52, reproE: 1.5, lifespan: 20, speed: 1.1, vision: 2,
      terrain: [0, 1, 5], diet: ['grass', 'moss'], dietTerrain: null,
      tempMin: -12, tempMax: 34, moistMin: 0.02, moistMax: 1,
      unlock: 1, desc: '草根与种子的搬运工，鼠年数量可暴涨，是许多掠食者的口粮。' },
    { id: 'rabbit', name: '原野野兔', emoji: '🐇', color: '#d8cfa8', type: 'herbivore',
      M: 1.2, metab: 0.11, repro: 0.5, reproE: 1.5, lifespan: 40, speed: 1.7, vision: 3,
      terrain: [0, 1, 5, 3], diet: ['grass', 'shrub', 'vine'], dietTerrain: null,
      tempMin: -14, tempMax: 38, moistMin: 0.02, moistMax: 1,
      unlock: 1, desc: '著名的 r 对策物种：繁殖力强、寿命短，没有天敌时足以啃秃整片草原。' },
    { id: 'deer', name: '林间白鹿', emoji: '🦌', color: '#c98a4b', type: 'herbivore',
      M: 8, metab: 0.5, repro: 0.28, reproE: 1.6, lifespan: 130, speed: 1.5, vision: 3,
      terrain: [0, 1, 5], diet: ['shrub', 'tree', 'fern', 'grass', 'vine'], dietTerrain: null,
      tempMin: -18, tempMax: 34, moistMin: 0.02, moistMax: 1,
      unlock: 2, desc: '森林与草甸之间的大型食草者，把植物能量转化为可观的动物生物量。' },
    { id: 'mammoth', name: '长毛猛犸', emoji: '🐘', color: '#8a7a6a', type: 'herbivore',
      M: 30, metab: 1.5, repro: 0.13, reproE: 2.0, lifespan: 260, speed: 1.0, vision: 3,
      terrain: [0, 1, 5], diet: ['grass', 'shrub', 'moss'], dietTerrain: null,
      tempMin: -34, tempMax: 28, moistMin: 0.02, moistMax: 1,
      unlock: 4, desc: '冰期巨兽：耐寒之王，能在零下三十度的苔原上安然觅食。' },
    { id: 'fish', name: '浅水鲦鱼', emoji: '🐟', color: '#5a9bd8', type: 'herbivore',
      M: 0.4, metab: 0.06, repro: 0.45, reproE: 1.5, lifespan: 26, speed: 1.4, vision: 2,
      terrain: [2], diet: ['algae'], dietTerrain: null,
      tempMin: -2, tempMax: 34, moistMin: 0.3, moistMax: 1,
      unlock: 2, desc: '水中的食藻小鱼，把水生植物转化为鱼群。' },
    { id: 'spider', name: '林间织蛛', emoji: '🕷️', color: '#5a5a6a', type: 'predator',
      M: 0.05, metab: 0.006, repro: 0.3, reproE: 1, lifespan: 13, speed: 2.2, vision: 6,
      terrain: [0, 1, 5, 4], prey: ['insect'], preyTerrain: null,
      tempMin: -6, tempMax: 38, moistMin: 0.02, moistMax: 1,
      unlock: 1, desc: '以昆虫为食的小型掠食者，编织的蛛网是生态网中最细的一环。' },
    { id: 'fox', name: '赤尾狐狸', emoji: '🦊', color: '#d8703a', type: 'predator',
      M: 2, metab: 0.1, repro: 0.13, reproE: 1.1, lifespan: 70, speed: 2.7, vision: 7,
      terrain: [0, 1, 5, 3], prey: ['vole', 'rabbit'], preyTerrain: null,
      tempMin: -16, tempMax: 38, moistMin: 0.02, moistMax: 1,
      unlock: 2, desc: '机敏的中型掠食者，控制着小兽的数量，防止草原被啃光。' },
    { id: 'wolf', name: '灰原狼群', emoji: '🐺', color: '#6a6a7a', type: 'predator',
      M: 6, metab: 0.22, repro: 0.11, reproE: 1.15, lifespan: 110, speed: 3.2, vision: 8,
      terrain: [0, 1, 5], prey: ['deer', 'rabbit'], preyTerrain: null,
      tempMin: -22, tempMax: 36, moistMin: 0.02, moistMax: 1,
      unlock: 3, desc: '顶级掠食者：追逐鹿群，维系森林草原的平衡，是营养级联的关键一环。' },
    { id: 'hawk', name: '巡天苍鹰', emoji: '🦅', color: '#7a6a8a', type: 'predator',
      M: 0.9, metab: 0.045, repro: 0.18, reproE: 1, lifespan: 55, speed: 4, vision: 8,
      terrain: [0, 1, 3, 4, 5], prey: ['insect', 'vole'], preyTerrain: null,
      tempMin: -16, tempMax: 38, moistMin: 0, moistMax: 1,
      unlock: 3, desc: '视野开阔的天空猎手，俯冲捕食昆虫与田鼠。' },
    { id: 'monitor', name: '巨蜥潜客', emoji: '🦎', color: '#6a8a5a', type: 'predator',
      M: 4.5, metab: 0.15, repro: 0.1, reproE: 1.15, lifespan: 130, speed: 2.4, vision: 7,
      terrain: [0, 1, 2, 5], prey: ['fish', 'vole', 'rabbit'], preyTerrain: null,
      tempMin: 8, tempMax: 44, moistMin: 0.05, moistMax: 1,
      unlock: 4, desc: '水陆两栖的伏击者，也会捡食腐肉，是湿地生态的清洁工。' }
  ];

  var DECOMPOSERS = [
    { id: 'fungus', name: '腐生真菌', emoji: '🍄', color: '#c8c0d0', type: 'decomposer',
      unlock: 1, desc: '把尸体与落叶分解回养分的隐形功臣，是碳与养分循环的最后一环。' }
  ];

  var ALL = PLANTS.concat(ANIMALS).concat(DECOMPOSERS);
  var BY_ID = {};
  ALL.forEach(function (s) { BY_ID[s.id] = s; });
  BY_ID.terrainNames = TERRAIN_NAMES;

  function list(type) {
    if (!type) return ALL.slice();
    return ALL.filter(function (s) { return s.type === type; });
  }

  function unlocked(chapter) {
    return ALL.filter(function (s) { return s.unlock <= chapter; });
  }

  function tempFit(s, temp) { return fit01(temp, s.tempMin, s.tempMax); }
  function moistFit(s, m) { return fit01(m, s.moistMin, s.moistMax); }
  function terrainFit(s, t) {
    if (s.type === 'plant') return s.terrain[t] || 0;
    return s.terrain.indexOf(t) >= 0 ? 1 : 0;
  }

  return {
    TERRAIN: TERRAIN, TERRAIN_NAMES: TERRAIN_NAMES, TERRAIN_COLORS: TERRAIN_COLORS,
    PLANTS: PLANTS, ANIMALS: ANIMALS, DECOMPOSERS: DECOMPOSERS, ALL: ALL,
    byId: function (id) { return BY_ID[id]; },
    list: list, unlocked: unlocked,
    tempFit: tempFit, moistFit: moistFit, terrainFit: terrainFit
  };
});
