/* ECO-ARK · 剧情章节 / 目标 / 星级评分（浏览器 + Node 双端 UMD） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.ECOARK = root.ECOARK || {}; root.ECOARK.chapters = factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var SPEC = (typeof module === 'object' && module.exports)
    ? require('./species.js') : root.ECOARK.species;

  var CHAPTERS = [
    {
      no: 1, id: 'seed', name: '播种纪元', years: 12,
      title: '第一章 · 播种纪元',
      intro: '2097 年，大迁徙号生态方舟抵达了濒死的「苔原星」。这颗星球曾拥有海洋与森林，如今只剩下龟裂的土壤与稀疏的绿意。你的任务：让绿色重新覆盖大地。',
      briefing: '在培养皿中拖动鼠标放置植物。苔藓、禾草与灌木是最容易成活的先锋物种。',
      unlockSpecies: ['moss', 'grass', 'shrub'],
      unlockKnowledge: ['energy-pyramid', 'producer'],
      objectives: [
        { id: 'o1', desc: '亲手放置至少 3 种不同的植物', check: 'placed >= 3' },
        { id: 'o2', desc: '植被覆盖率 ≥ 22% 并保持 3 年', check: 'cover >= 0.22 for 3y' }
      ],
      hint: '点击左侧物种卡片，再到培养皿上拖动放置。禾草(🌾)生长最快，苔藓(🌿)最耐寒。'
    },
    {
      no: 2, id: 'prairie', name: '草原呼吸', years: 20,
      title: '第二章 · 草原呼吸',
      intro: '绿色回来了，但方舟传感器发出警告：植被疯长，养分被锁死在枯枝败叶里。没有消费者，能量流动就会停滞。是时候引入第一群食草者了。',
      briefing: '昆虫与田鼠繁殖极快，野兔与白鹿更稳重。小心：食草动物过多会啃光草原，过少则能量滞留。',
      unlockSpecies: ['insect', 'vole', 'rabbit', 'deer', 'tree', 'fern', 'reed'],
      unlockKnowledge: ['consumer', 'carrying'],
      objectives: [
        { id: 'o1', desc: '食草动物总量 ≥ 60 并保持 8 年', check: 'herb >= 60 for 8y' },
        { id: 'o2', desc: '期间植被覆盖率始终 > 8%（草原不被啃秃）', check: 'cover > 0.08 for 8y' }
      ],
      hint: '先放 15~25 只野兔和 10 只田鼠，观察它们如何跟随草场起伏。不够就补充，太多就移除。'
    },
    {
      no: 3, id: 'apex', name: '王者降临', years: 22,
      title: '第三章 · 王者降临',
      intro: '食草动物稳定了，但它们的种群开始周期性地暴涨暴跌——没有天敌的猎物种群总会冲破草原的承载极限。方舟议会决定：引入掠食者。',
      briefing: '蜘蛛吃昆虫，狐狸猎田鼠与野兔，灰狼追逐白鹿。顶级掠食者会让食物网形成稳定的三层结构。',
      unlockSpecies: ['spider', 'fox', 'wolf', 'hawk', 'cactus'],
      unlockKnowledge: ['trophic', 'lotka', 'cascade'],
      objectives: [
        { id: 'o1', desc: '建立完整食物网：植物 + 食草 + 捕食三层共存 10 年', check: '3 levels for 10y' },
        { id: 'o2', desc: '捕食者总量 ≥ 15 并保持 5 年', check: 'pred >= 15 for 5y' },
        { id: 'o3', desc: '见证营养级联：引入捕食者后食草动物峰值回落 ≥ 30%', check: 'cascade observed' }
      ],
      hint: '先放 6~10 只狐狸对付野兔，再放 4~6 只狼压制鹿群。观察右侧曲线：捕食者峰值总是滞后于猎物峰值。'
    },
    {
      no: 4, id: 'ice', name: '冰河时代', years: 45,
      title: '第四章 · 冰河时代',
      intro: '方舟的深空望远镜捕捉到一片星际尘埃云正掠过苔原星——未来数年阳光将被削弱，全球气温骤降，一场微型冰期即将到来。',
      briefing: '冰期会自动降临。耐寒的苔藓、猛犸与灰狼能扛过去；怕冷的物种会大量死亡。提前扩大耐寒物种的数量吧。',
      unlockSpecies: ['mammoth', 'monitor', 'algae'],
      unlockKnowledge: ['resilience', 'strategy'],
      objectives: [
        { id: 'o1', desc: '冰期期间（约 2.5 年低温）每年至少 3 个物种存活', check: '>=3 species through ice' },
        { id: 'o2', desc: '冰期期间至少 1 个耐寒物种（苔藓/猛犸/灰狼）存活', check: 'cold species alive' },
        { id: 'o3', desc: '冰期结束后生态系统恢复：生物量回到冰期前的 50%', check: 'recovery >= 50%' }
      ],
      hint: '冰期将在第 2 年到来，持续约 2.5 年（严冬最低约 -7℃）。多放些苔藓和猛犸——它们最耐寒。'
    },
    {
      no: 5, id: 'invasion', name: '入侵警报', years: 25,
      title: '第五章 · 入侵警报',
      intro: '冰期过去，万物复苏——但一艘坠毁的采矿船带来的样本瓶破裂了。来自另一颗星球的藤蔓以肉眼可见的速度疯长，正在吞噬整片草原。',
      briefing: '外来藤蔓没有天敌，繁殖极快。你需要用「清除」工具剪除藤蔓，同时保持本土植物和动物的活力。',
      unlockSpecies: ['vine'],
      unlockKnowledge: ['invasive', 'niche'],
      objectives: [
        { id: 'o1', desc: '藤蔓入侵爆发（覆盖率曾 ≥ 15%）', check: 'vine erupted' },
        { id: 'o2', desc: '将藤蔓覆盖率压回 < 30% 并保持 10 年', check: 'vine < 30% for 10y' },
        { id: 'o3', desc: '本土植物总覆盖超过藤蔓覆盖', check: 'native > vine' }
      ],
      hint: '藤蔓没有天敌，只能手动清除。点选「除草」工具，在紫色区域拖动。也可以让食草动物啃食藤蔓——虽然味道不佳。'
    },
    {
      no: 6, id: 'ark', name: '千年方舟', years: 120,
      title: '第六章 · 千年方舟',
      intro: '风暴过去，苔原星第一次迎来了真正的春天。方舟主计算机宣布：最终考验开始——在不干预的情况下，让生态系统自主运行一百二十年，证明它配得上「方舟」之名。',
      briefing: '最后的自由演化。你可以继续放置、清除或施肥，但评分将根据多样性、稳定性与生物量综合评定。',
      unlockSpecies: [],
      unlockKnowledge: ['biodiversity', 'nutrient'],
      objectives: [
        { id: 'o1', desc: '生态系统自主运行 120 年', check: 'years >= 120' },
        { id: 'o2', desc: '物种多样性 ≥ 8', check: 'species >= 8' },
        { id: 'o3', desc: '稳定性 ≥ 0.6 并保持 10 年', check: 'stable 10y' }
      ],
      hint: '多样化的食物网比单一物种更稳定。必要时用施肥工具挽救养分枯竭的区域。'
    }
  ];

  var BY_NO = {};
  CHAPTERS.forEach(function (c) { BY_NO[c.no] = c; });

  function herbCount(sim) {
    var st = sim.getStats();
    var n = 0;
    Object.keys(st.counts).forEach(function (id) {
      var sp = SPEC.byId(id);
      if (sp && sp.type === 'herbivore') n += st.counts[id];
    });
    return n;
  }
  function predCount(sim) {
    var st = sim.getStats();
    var n = 0;
    Object.keys(st.counts).forEach(function (id) {
      var sp = SPEC.byId(id);
      if (sp && sp.type === 'predator') n += st.counts[id];
    });
    return n;
  }
  function plantCoverage(sim) {
    var st = sim.getStats();
    var total = 0;
    Object.keys(st.plantCov).forEach(function (id) {
      if (id !== 'vine') total += st.plantCov[id];
    });
    return total / (sim.w * sim.h);
  }
  function vineCoverage(sim) {
    var st = sim.getStats();
    return (st.plantCov.vine || 0) / (sim.w * sim.h);
  }
  function speciesAlive(sim) {
    return sim.getStats().aliveSpecies;
  }

  // 章节运行时状态
  function createState(no) {
    return {
      no: no,
      placedSet: {},          // 放置过的物种
      consecutive: {},        // 各目标连续满足的年数
      herbPeak: 0,            // 食草动物历史峰值
      iceStarted: false,      // 冰期是否已开始
      iceObservations: 0,     // 冰期期间经过的年检次数
      iceYearsOk: 0,          // 冰期年检中「≥3 物种存活」的次数
      iceBiomassBefore: null, // 冰期前的生物量基线
      iceMin: null,           // 冰期中的最低生物量
      iceEnded: false,
      vineErupted: false,
      cascadeObserved: false,
      recoveryDone: false,
      coldAlive: false,
      prevBiomass: null       // 上一年生物量（用于取冰期前基线）
    };
  }

  // 每年推进一次章节状态，返回目标完成度
  function update(no, sim, state) {
    if (!state) state = createState(no);
    var ch = BY_NO[no];
    var st = sim.getStats();
    var herb = herbCount(sim), pred = predCount(sim);
    var cover = plantCoverage(sim), vine = vineCoverage(sim);
    var alive = speciesAlive(sim);

    // 冰期状态必须在目标判定之前更新，否则同一年的 o2/o3 读不到 iceStarted
    var iceActive = false;
    if (no === 4) {
      iceActive = st.activeEvents.some(function (e) { return e.name === '冰期'; });
      if (iceActive && !state.iceStarted) {
        state.iceStarted = true;
        // 优先用「冰期前一年」的生物量作为基线（年检时冰期可能已持续数月）
        state.iceBiomassBefore = state.prevBiomass != null ? state.prevBiomass : st.totalBiomass;
        state.iceMin = null;
        state.iceObservations = 0;
        state.iceYearsOk = 0;
      }
      if (iceActive) {
        state.iceObservations++;
        if (state.iceMin == null || st.totalBiomass < state.iceMin) state.iceMin = st.totalBiomass;
        state.iceEnded = false;
      } else if (state.iceStarted && state.iceMin != null) {
        state.iceEnded = true;
      }
    }

    var results = {};
    ch.objectives.forEach(function (o) {
      var done = false, prog = 0, key = o.id;
      if (o.id === 'o1') {
        if (no === 1) { // 放置 3 种植物
          prog = Object.keys(state.placedSet).length / 3;
          done = Object.keys(state.placedSet).length >= 3;
        } else if (no === 2) {
          state.consecutive[key] = (herb >= 60) ? (state.consecutive[key] || 0) + 1 : 0;
          prog = Math.min(1, herb / 60);
          done = state.consecutive[key] >= 8;
        } else if (no === 3) {
          var three = (cover > 0.01) && (herb > 0) && (pred > 0);
          state.consecutive[key] = three ? (state.consecutive[key] || 0) + 1 : 0;
          prog = Math.min(1, (three ? 1 : 0) * 0.7 + Math.min(1, st.years / 10) * 0.3);
          done = state.consecutive[key] >= 10;
        } else if (no === 4) {
          // 冰期期间每年都至少有 3 个物种存活（冰期结束后结算）
          if (!state.iceStarted) prog = 0;
          else {
            if (iceActive && alive >= 3) state.iceYearsOk++;
            prog = state.iceObservations > 0 ? state.iceYearsOk / state.iceObservations : 0;
            done = state.iceEnded && state.iceObservations > 0 && state.iceYearsOk >= state.iceObservations;
          }
        } else if (no === 5) {
          state.consecutive[key] = (vine >= 0.15) ? (state.consecutive[key] || 0) + 1 : 0;
          if (vine >= 0.15) state.vineErupted = true;
          prog = Math.min(1, vine / 0.3);
          done = state.vineErupted;
        } else if (no === 6) {
          prog = Math.min(1, st.year / 120);
          done = st.year >= 120;
        }
      } else if (o.id === 'o2') {
        if (no === 1) {
          state.consecutive[key] = (cover >= 0.22) ? (state.consecutive[key] || 0) + 1 : 0;
          prog = Math.min(1, cover / 0.22);
          done = state.consecutive[key] >= 3;
        } else if (no === 2) {
          var ok2 = (cover > 0.08);
          state.consecutive[key] = ok2 ? (state.consecutive[key] || 0) + 1 : 0;
          prog = Math.min(1, (herb >= 60 ? 0.5 : 0) + (ok2 ? 0.5 : 0));
          done = (herb >= 60) && state.consecutive[key] >= 8;
        } else if (no === 3) {
          state.consecutive[key] = (pred >= 15) ? (state.consecutive[key] || 0) + 1 : 0;
          prog = Math.min(1, pred / 15);
          done = state.consecutive[key] >= 5;
        } else if (no === 4) {
          // 耐寒物种：苔藓是植物（不在 counts 里，要看覆盖），猛犸/灰狼是动物
          var cold = (st.plantCov.moss > 0.001) || (st.counts.mammoth > 0) || (st.counts.wolf > 0);
          if (state.iceStarted && cold) state.coldAlive = true;
          done = state.coldAlive;
          prog = state.coldAlive ? 1 : 0;
        } else if (no === 5) {
          state.consecutive[key] = (vine < 0.30) ? (state.consecutive[key] || 0) + 1 : 0;
          prog = Math.min(1, (1 - vine / 0.3));
          done = (state.consecutive[key] || 0) >= 10;
        } else if (no === 6) {
          prog = Math.min(1, alive / 8);
          done = alive >= 8;
        }
      } else if (o.id === 'o3') {
        if (no === 3) {
          if (!state.cascadeObserved && pred > 0 && herb > 0) {
            if (herb > state.herbPeak) state.herbPeak = herb;
            if (state.herbPeak > 0 && herb < state.herbPeak * 0.7 && state.herbPeak > 80) {
              state.cascadeObserved = true;
            }
          }
          prog = state.cascadeObserved ? 1 : (state.herbPeak > 0 ? 0.5 : 0.1);
          done = state.cascadeObserved;
        } else if (no === 4) {
          if (state.iceEnded && state.iceBiomassBefore != null &&
              st.totalBiomass >= state.iceBiomassBefore * 0.5) {
            state.recoveryDone = true;
          }
          prog = state.recoveryDone ? 1 : (state.iceMin != null ? 0.5 : 0.1);
          done = state.recoveryDone;
        } else if (no === 5) {
          prog = Math.min(1, cover / Math.max(vine, 0.01));
          done = cover > vine;
        } else if (no === 6) {
          var stableOk = st.stability >= 0.6;
          state.consecutive[key] = stableOk ? (state.consecutive[key] || 0) + 1 : 0;
          prog = Math.min(1, st.stability / 0.6);
          done = (state.consecutive[key] || 0) >= 10;
        }
      }
      results[key] = { done: !!done, prog: clamp01(prog), desc: o.desc };
    });

    // 供下一年取「冰期前基线」使用
    state.prevBiomass = st.totalBiomass;

    return {
      chapter: ch,
      objectives: results,
      allDone: ch.objectives.every(function (o) { return results[o.id].done; }),
      state: state
    };
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  // 章节结束评分：1~3 星
  function rate(no, sim, state, result) {
    var st = sim.getStats();
    var doneCount = Object.keys(result.objectives).filter(function (k) { return result.objectives[k].done; }).length;
    var total = Object.keys(result.objectives).length;
    var base = doneCount / total;
    var bonus = 0;
    if (no === 1) bonus = st.plantBiomass > 50 ? 0.2 : 0;
    if (no === 2) bonus = st.animalBiomass > 0 ? 0.2 : 0;
    if (no === 3) bonus = state.cascadeObserved ? 0.3 : 0;
    if (no === 4) bonus = state.coldAlive ? 0.25 : 0;
    if (no === 5) bonus = (vineCoverage(sim) < 0.1 ? 0.3 : 0.1);
    if (no === 6) {
      var score = Math.min(1, st.aliveSpecies / 10) * st.stability * Math.min(1, st.totalBiomass / 400);
      bonus = score * 0.8;
      base = Math.min(1, doneCount / total);
    }
    var totalScore = Math.min(1, base * 0.7 + bonus);
    return { stars: totalScore >= 0.85 ? 3 : (totalScore >= 0.55 ? 2 : 1), score: totalScore };
  }

  return {
    CHAPTERS: CHAPTERS,
    byNo: function (no) { return BY_NO[no]; },
    total: CHAPTERS.length,
    createState: createState,
    update: update,
    rate: rate,
    herbCount: herbCount, predCount: predCount,
    plantCoverage: plantCoverage, vineCoverage: vineCoverage
  };
});
