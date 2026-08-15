/* LINGUA · 音变规则库：一千年里可能发生的各种语音变化（24 条，附现实语言学参照） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.sounds = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VOWELS = 'aeiou';
  var CON = '(?:ng|ch|sh|[pbtdkgmnlrwysfvhzc])'; // 辅音（含二合字母）
  var VOICED = 'bdgvzmnrlwy'; // 浊辅音
  var UNVOICED_MAP = { p: 'b', t: 'd', k: 'g', s: 'z', f: 'v' };

  function isVowel(c) { return VOWELS.indexOf(c) >= 0; }

  function mapEach(word, map) {
    var out = '';
    for (var i = 0; i < word.length; i++) {
      var c = word[i];
      out += map[c] != null ? map[c] : c;
    }
    return out;
  }

  function mapMedial(word, map) {
    var out = '';
    for (var i = 0; i < word.length; i++) {
      var c = word[i];
      if (i > 0 && i < word.length - 1 && map[c] != null) out += map[c];
      else out += c;
    }
    return out;
  }

  function dropFirstOfCluster(word) {
    return word.replace(new RegExp(CON + '(?=' + CON + ')'), '');
  }

  function epenthesize(word) {
    return word.replace(new RegExp(CON + '(?=' + CON + ')'), '$&a');
  }

  var RULES = [
    { id: 'vshift_front', name: '元音前移', prob: 0.55, weight: 5, epochLo: 0, epochHi: 19,
      desc: '整个元音系统向前移动：a→e, e→i, i→u, o→a, u→o。像合唱团全体升了一个调。',
      real: '现实参照：英语「元音大推移」(Great Vowel Shift) 让 name 从 /naːmə/ 变成今天的 /neɪm/。',
      fn: function (w) { return mapEach(w, { a: 'e', e: 'i', i: 'u', o: 'a', u: 'o' }); } },

    { id: 'vshift_back', name: '元音后移', prob: 0.55, weight: 5, epochLo: 0, epochHi: 19,
      desc: '元音整体向后收：a→o, o→u, u→i, e→a, i→e。说话的人喉咙越来越懒。',
      real: '现实参照：部分方言的元音后移，如英格兰北部 a 读作 /ɔː/。',
      fn: function (w) { return mapEach(w, { a: 'o', o: 'u', u: 'i', e: 'a', i: 'e' }); } },

    { id: 'vshift_merge', name: '元音合并', prob: 0.5, weight: 4, epochLo: 0, epochHi: 19,
      desc: '相近的元音开始不分家：e 并入 a，i 并入 e，u 并入 o。音位在减少。',
      real: '现实参照：希腊语的 i 与 ei 合流，导致两个古音位在现代希腊语里发同一个音。',
      fn: function (w) { return mapEach(w, { e: 'a', i: 'e', u: 'o' }); } },

    { id: 'vdrop_final', name: '词尾元音脱落', prob: 0.4, weight: 4, epochLo: 1, epochHi: 19,
      desc: '词尾的元音被吞掉。说话更快，但词和词要靠别的办法分清。',
      real: '现实参照：拉丁语 murus → 法语 mur，词尾元音全部失落。',
      fn: function (w) { return w.length > 3 ? w.replace(/([aeiou])$/, '') : w; } },

    { id: 'vweak_mid', name: '央化', prob: 0.4, weight: 3, epochLo: 2, epochHi: 16,
      desc: '夹在中间的 a 变得含混，向 e 靠拢。',
      real: '现实参照：英语弱读音节的元音都变成 ə（如 family 里的 y）。',
      fn: function (w) { return mapMedial(w, { a: 'e' }); } },

    { id: 'lenition', name: '辅音弱化', prob: 0.5, weight: 5, epochLo: 1, epochHi: 18,
      desc: '词中间的塞音一个个软下去：p→b→v→w，t→d→r，k→g→h。',
      real: '现实参照：拉丁语 vita → 西班牙语 vida → 部分拉美口音 [βiða]。',
      fn: function (w) { return mapMedial(w, { p: 'b', b: 'v', v: 'w', t: 'd', d: 'r', k: 'g', g: 'h' }); } },

    { id: 'final_dev', name: '词尾清化', prob: 0.45, weight: 4, epochLo: 1, epochHi: 17,
      desc: '词尾的浊音不再振动：b→p，d→t，g→k。话说到最后一个音就泄了气。',
      real: '现实参照：德语 Auslautverhärtung，Rad（轮子）读作 [rat]。',
      fn: function (w) {
        var last = w[w.length - 1];
        var m = { b: 'p', d: 't', g: 'k', v: 'f', z: 's' };
        return m[last] ? w.slice(0, -1) + m[last] : w;
      } },

    { id: 'palatal', name: '颚化', prob: 0.5, weight: 4, epochLo: 2, epochHi: 19,
      desc: 'k、g、t 在高元音前变软：ki→chi，gi→ji，ti→si。',
      real: '现实参照：拉丁语 centum 的 k 在 i/e 前变成意大利语的 [tʃ]。',
      fn: function (w) {
        return w.replace(/k(?=[ie])/g, 'ch').replace(/g(?=[ie])/g, 'j').replace(/t(?=i)/g, 's');
      } },

    { id: 'nasal_assim', name: '鼻音同化', prob: 0.4, weight: 3, epochLo: 1, epochHi: 15,
      desc: 'n 遇到双唇音变成 m，遇到软腭音变成 ng。鼻子跟着邻居走。',
      real: '现实参照：拉丁语 in- 在 possible 前变成 im-：impossible。',
      fn: function (w) {
        return w.replace(/n(?=[pb])/g, 'm').replace(/n(?=[kg])/g, 'ng');
      } },

    { id: 'cluster_simplify', name: '辅音簇简化', prob: 0.35, weight: 3, epochLo: 3, epochHi: 19,
      desc: '挨在一起的两个辅音丢掉一个——太难发了。',
      real: '现实参照：英语 knight 的 kn- 只剩一个 n 的音。',
      fn: dropFirstOfCluster },

    { id: 'epenthesis', name: '插音', prob: 0.35, weight: 3, epochLo: 0, epochHi: 8,
      desc: '两个辅音之间长出一个 a，把音节重新撑开。',
      real: '现实参照：拉丁语 schola → 西班牙语 escuela，前面长出一个 e。',
      fn: epenthesize },

    { id: 'liquid_swap', name: '流音互换', prob: 0.3, weight: 2, epochLo: 2, epochHi: 19,
      desc: 'r 和 l 偶尔互换位置——舌头打结是语言史的一部分。',
      real: '现实参照：拉丁语 periculum → 西班牙语 peligro（r 变成了 l）。',
      fn: function (w, rng) { return rng.chance(0.5) ? w.replace(/r/g, 'l') : w.replace(/l/g, 'r'); } },

    { id: 'spirant_init', name: '词首擦化', prob: 0.35, weight: 3, epochLo: 2, epochHi: 19,
      desc: '开头的塞音被气流磨成擦音：b→v，t→s，k→s。',
      real: '现实参照：希腊语 phi/theta/khi 由塞音演变为擦音 [f/θ/x]。',
      fn: function (w) {
        var m = { b: 'v', t: 's', k: 's' };
        var first = w[0];
        return m[first] ? m[first] + w.slice(1) : w;
      } },

    { id: 'lengthen_preN', name: '鼻音前长化', prob: 0.4, weight: 3, epochLo: 0, epochHi: 14,
      desc: '鼻音前的元音被拖长：an→aan，on→oon。',
      real: '现实参照：法语鼻元音（pain 里的鼻化 a）是这条路的尽头。',
      fn: function (w) { return w.replace(/([aeiou])(?=(?:n|m|ng)$)/, '$1$1'); } },

    { id: 'geminate', name: '辅音重叠', prob: 0.3, weight: 2, epochLo: 0, epochHi: 10,
      desc: '中间的辅音被拉长双写：kata→katta。强调的冲动变成了音变。',
      real: '现实参照：拉丁语 aqua → 意大利语 acqua，双写表示重读。',
      fn: function (w) { return w.replace(/([pbtdkg])(?=[aeiou])/, '$1$1'); } },

    { id: 'final_n_drop', name: '词尾鼻音脱落', prob: 0.35, weight: 3, epochLo: 5, epochHi: 19,
      desc: '词尾的 n、m 渐渐听不见了，只留下前面拉长的元音。',
      real: '现实参照：法语词尾鼻音的弱化与鼻元音化。',
      fn: function (w) { return w.replace(/(?:n|m|ng)$/, ''); } },

    { id: 'initial_h', name: '词首加 h', prob: 0.3, weight: 2, epochLo: 4, epochHi: 19,
      desc: '以元音开头的词前面长出一个小小的 h——像清嗓子。',
      real: '现实参照：部分罗曼方言在元音前添加辅音以分隔音节。',
      fn: function (w) { return isVowel(w[0]) ? 'h' + w : w; } },

    { id: 'umlaut', name: '元音和谐', prob: 0.35, weight: 2, epochLo: 4, epochHi: 19,
      desc: '词里一旦有 i，前面的 a 就跟着变成 e——元音们开始互相攀比。',
      real: '现实参照：日耳曼语 umlaut：man → men，foot → feet。',
      fn: function (w) {
        return w.indexOf('i') > 0 ? w.replace(/a/g, 'e') : w;
      } },

    { id: 'metathesis', name: '换位', prob: 0.25, weight: 2, epochLo: 3, epochHi: 19,
      desc: '相邻的两个辅音交换位置——舌头打了个结，然后习惯成自然。',
      real: '现实参照：拉丁语 parabola → 西班牙语 palabra（r 与 b 互换）。',
      fn: function (w) { return w.replace(new RegExp('(' + CON + ')(' + CON + ')'), '$2$1'); } },

    { id: 'diphthong', name: '双元音化', prob: 0.4, weight: 3, epochLo: 2, epochHi: 19,
      desc: '单元音裂成双元音：a→ai，e→ei，o→ou，u→au。音调变得更起伏。',
      real: '现实参照：拉丁语 bonus → 西班牙语 bueno（o 裂成 ue）。',
      fn: function (w) { return mapEach(w, { a: 'ai', e: 'ei', o: 'ou', u: 'au' }); } },

    { id: 'initial_drop', name: '词首辅音脱落', prob: 0.25, weight: 2, epochLo: 4, epochHi: 19,
      desc: '词首的辅音被整个吞掉——说得快，就懒得开口了。',
      real: '现实参照：希腊语词首 s- 的失落（sem- 系列词在部分语言中丢 s）。',
      fn: function (w) {
        if (w.length <= 2) return w;
        var re = new RegExp('^' + CON);
        var m = w.match(re);
        return m ? w.slice(m[0].length) : w;
      } },

    { id: 'voicing_assim', name: '浊化同化', prob: 0.3, weight: 2, epochLo: 3, epochHi: 19,
      desc: '辅音簇里，后一个音跟着前一个的声带振动：p→b，t→d，k→g。',
      real: '现实参照：俄语中的浊化同化（вокзал 读作 [vagzal]）。',
      fn: function (w) {
        var out = '';
        for (var i = 0; i < w.length; i++) {
          var c = w[i];
          var prev = i > 0 ? w[i - 1] : '';
          if (UNVOICED_MAP[c] && VOICED.indexOf(prev) >= 0) out += UNVOICED_MAP[c];
          else out += c;
        }
        return out;
      } },

    { id: 'glide', name: '滑音元音化', prob: 0.3, weight: 2, epochLo: 2, epochHi: 19,
      desc: '元音后的 w、y 滑向元音本身：w→u，y→i。辅音变成了元音。',
      real: '现实参照：中古英语的 w 在部分位置元音化（law 的读音演变）。',
      fn: function (w) {
        var out = '';
        for (var i = 0; i < w.length; i++) {
          var c = w[i];
          var prev = i > 0 ? w[i - 1] : '';
          if ((c === 'w' || c === 'y') && isVowel(prev)) out += c === 'w' ? 'u' : 'i';
          else out += c;
        }
        return out;
      } },

    { id: 'final_vowel_raising', name: '词尾元音高化', prob: 0.35, weight: 2, epochLo: 3, epochHi: 19,
      desc: '词尾的元音慢慢抬高：a→e，e→i，o→u。尾音越来越轻、越来越高。',
      real: '现实参照：托斯卡纳方言词尾元音的抬高，以及法语词尾 e 的弱化。',
      fn: function (w) {
        var m = { a: 'e', e: 'i', o: 'u' };
        var last = w[w.length - 1];
        return m[last] ? w.slice(0, -1) + m[last] : w;
      } }
  ];

  var BY_ID = {};
  RULES.forEach(function (r) { BY_ID[r.id] = r; });

  function pickRules(rng, n, epoch) {
    var pool = RULES.filter(function (r) { return r.epochLo <= epoch && epoch <= r.epochHi; });
    var picked = [];
    var available = pool.slice();
    for (var i = 0; i < n && available.length > 0; i++) {
      var total = 0;
      available.forEach(function (r) { total += r.weight; });
      var roll = rng.next() * total;
      var idx = 0;
      for (var j = 0; j < available.length; j++) {
        roll -= available[j].weight;
        if (roll <= 0) { idx = j; break; }
      }
      picked.push(available[idx]);
      available.splice(idx, 1);
    }
    return picked;
  }

  function applyRule(word, rule, rng) {
    var out = rule.fn(word, rng);
    return out === word ? word : out;
  }

  return { RULES: RULES, BY_ID: BY_ID, pickRules: pickRules, applyRule: applyRule, isVowel: isVowel };
});
