'use strict';
/* LOOM · 内置纹样库（全部用织造程序本身书写，能被 DSL 解析器读回） */
(function (root) {
  'use strict';
  var W = (typeof require !== 'undefined') ? require('./weave.js') : root.Loom.weave;
  var D = (typeof require !== 'undefined') ? require('./dsl.js') : root.Loom.dsl;

  /* 把 '##..' 这样的位图变成 liftplan 段落：'#' = 该根经线抬起（经浮于表） */
  function bitmapToLiftplan(rows) {
    var out = ['liftplan'];
    for (var p = 0; p < rows.length; p++) {
      var ups = [];
      for (var e = 0; e < rows[p].length; e++) if (rows[p][e] === '#') ups.push(e + 1);
      out.push('  ' + (p + 1) + ': ' + (ups.length ? ups.join(' ') : '-'));
    }
    return out.join('\n');
  }

  var DIAMOND = [
    '............',
    '.....##.....',
    '....#..#....',
    '...#....#...',
    '..#......#..',
    '.#........#.',
    '.#........#.',
    '..#......#..',
    '...#....#...',
    '....#..#....',
    '.....##.....',
    '............'
  ];

  var PLAIN = [
    'title 平纹 · 一上一下',
    'warp 32 / weft 32',
    'shafts 2 / treadles 2',
    '',
    'threading 1 2',
    'tieup',
    '  1: 1',
    '  2: 2',
    'treadling 1 2'
  ].join('\n');

  var BASKET = [
    'title 方平组织 · 2/2 方平',
    'warp 32 / weft 32',
    'shafts 4 / treadles 2',
    '',
    'threading 1 2 3 4',
    'tieup',
    '  1: 1 2',
    '  2: 3 4',
    'treadling 1 1 2 2'
  ].join('\n');

  var TWILL22 = [
    'title 2/2 斜纹 · 牛仔布的组织',
    'warp 32 / weft 32',
    'shafts 4 / treadles 4',
    '',
    'threading 1 2 3 4',
    'tieup',
    '  1: 1 2',
    '  2: 2 3',
    '  3: 3 4',
    '  4: 4 1',
    'treadling 1 2 3 4'
  ].join('\n');

  var TWILL13 = [
    'title 1/3 斜纹 · 纬面',
    'warp 32 / weft 32',
    'shafts 4 / treadles 4',
    '',
    'threading 1 2 3 4',
    'tieup',
    '  1: 1',
    '  2: 2',
    '  3: 3',
    '  4: 4',
    'treadling 1 2 3 4'
  ].join('\n');

  var TWILL31 = [
    'title 3/1 斜纹 · 经面',
    'warp 32 / weft 32',
    'shafts 4 / treadles 4',
    '',
    'threading 1 2 3 4',
    'tieup',
    '  1: 1 2 3',
    '  2: 2 3 4',
    '  3: 3 4 1',
    '  4: 4 1 2',
    'treadling 1 2 3 4'
  ].join('\n');

  var SATIN5 = [
    'title 5 枚经面缎纹 · 飞数 2',
    'warp 30 / weft 30',
    'shafts 5 / treadles 5',
    '',
    'threading 1 2 3 4 5',
    'tieup',
    '  1: 2 3 4 5',
    '  2: 1 2 4 5',
    '  3: 1 2 3 4',
    '  4: 1 3 4 5',
    '  5: 1 2 3 5',
    'treadling 1 2 3 4 5'
  ].join('\n');

  var SATEEN5 = [
    'title 5 枚纬面缎纹 · 飞数 2',
    'warp 30 / weft 30',
    'shafts 5 / treadles 5',
    '',
    'threading 1 2 3 4 5',
    'tieup',
    '  1: 1',
    '  2: 3',
    '  3: 5',
    '  4: 2',
    '  5: 4',
    'treadling 1 2 3 4 5'
  ].join('\n');

  var SATIN8 = [
    'title 8 枚经面缎纹 · 飞数 3',
    'warp 32 / weft 32',
    'shafts 8 / treadles 8',
    '',
    'threading 1 2 3 4 5 6 7 8',
    'tieup',
    '  1: 2 3 4 5 6 7 8',
    '  2: 1 2 3 5 6 7 8',
    '  3: 1 2 3 4 5 6 8',
    '  4: 1 3 4 5 6 7 8',
    '  5: 1 2 3 4 6 7 8',
    '  6: 1 2 3 4 5 6 7',
    '  7: 1 2 4 5 6 7 8',
    '  8: 1 2 3 4 5 7 8',
    'treadling 1 2 3 4 5 6 7 8'
  ].join('\n');

  var POINTED = [
    'title 点斜纹 · 人字 / V 形',
    'warp 36 / weft 36',
    'shafts 4 / treadles 4',
    '',
    'threading 1 2 3 4 3 2',
    'tieup',
    '  1: 1 2',
    '  2: 2 3',
    '  3: 3 4',
    '  4: 4 1',
    'treadling 1 2 3 4 3 2'
  ].join('\n');

  var STRIPE_V = [
    'title 纵条纹 · 两片综框交替',
    'warp 32 / weft 32',
    'shafts 2 / treadles 2',
    '',
    'threading 1 2',
    'tieup',
    '  1: 1',
    '  2: 2',
    'treadling 1 1 2 2'
  ].join('\n');

  var MOTIF = [
    'title 菱格提花 · 手绘提升计划',
    'warp 12 / weft 12',
    'warp-yarn #d9773f',
    'weft-yarn #2f4a5e',
    '',
    bitmapToLiftplan(DIAMOND)
  ].join('\n');

  var PLAIN_TWO = [
    'title 双色平纹 · 颜色与组织的乘法',
    'warp 32 / weft 32',
    'shafts 2 / treadles 2',
    'warp-yarn #c94f3d',
    'weft-yarn #f2e4c9',
    '',
    'threading 1 2',
    'tieup',
    '  1: 1',
    '  2: 2',
    'treadling 1 2'
  ].join('\n');

  var LIBRARY = [
    { id: 'plain',   name: '平纹',           group: '基本组织', note: '最基础的一上一下，最结实也最薄。', dsl: PLAIN },
    { id: 'basket',  name: '方平组织',       group: '基本组织', note: '两根经纱并列浮起，表面呈方格。', dsl: BASKET },
    { id: 'twill22', name: '2/2 斜纹',       group: '斜纹',     note: '牛仔布的组织，斜向纹理清晰。', dsl: TWILL22 },
    { id: 'twill13', name: '1/3 斜纹',       group: '斜纹',     note: '纬面斜纹，纬纱占表面。', dsl: TWILL13 },
    { id: 'twill31', name: '3/1 斜纹',       group: '斜纹',     note: '经面斜纹，光泽强、耐磨。', dsl: TWILL31 },
    { id: 'pointed', name: '点斜纹（人字）', group: '斜纹',     note: '斜向在折返处反转，形成人字纹。', dsl: POINTED },
    { id: 'satin5',  name: '5 枚经面缎纹',   group: '缎纹',     note: '飞数 2，表面平滑有光泽。', dsl: SATIN5 },
    { id: 'sateen5', name: '5 枚纬面缎纹',   group: '缎纹',     note: '飞数 2，纬纱浮长占表面。', dsl: SATEEN5 },
    { id: 'satin8',  name: '8 枚经面缎纹',   group: '缎纹',     note: '飞数 3，浮长更长、更亮也更娇气。', dsl: SATIN8 },
    { id: 'stripev', name: '纵条纹',         group: '变化组织', note: '两片综框交替踏，形成经向条纹。', dsl: STRIPE_V },
    { id: 'motif',   name: '菱格提花',       group: '提花',     note: '直接写提升计划，逐点控制每根经线。', dsl: MOTIF },
    { id: 'plain2',  name: '双色平纹',       group: '提花',     note: '组织不变，只换纱线颜色，效果完全不同。', dsl: PLAIN_TWO }
  ];

  /* 计算每个纹样的最小循环单元，供组织识别做精确比对 */
  function tiles() {
    var out = [];
    for (var i = 0; i < LIBRARY.length; i++) {
      var p = LIBRARY[i];
      var parsed = D.parse(p.dsl);
      var built = W.build(parsed.spec);
      if (built.errors.length) continue;
      var m = W.drawdown(built.draft);
      var rep = W.repeatOf(m);
      out.push({ id: p.id, name: p.name, tile: W.tileOf(m, rep.w, rep.h), repeat: rep });
    }
    return out;
  }

  var api = { LIBRARY: LIBRARY, bitmapToLiftplan: bitmapToLiftplan, tiles: tiles, DIAMOND: DIAMOND };
  root.Loom = root.Loom || {};
  root.Loom.patterns = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
