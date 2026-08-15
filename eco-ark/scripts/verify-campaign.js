/* ECO-ARK · 剧情全章节可通关性验证（自动玩家）
 * 用一个「称职玩家」策略依次打通 6 章，验证每章目标都可达成。
 * node scripts/verify-campaign.js
 */
'use strict';
const SIM = require('../js/shared/sim.js');
const CH = require('../js/shared/chapters.js');

function mk(seed, eventChance) {
  return SIM.createSim({ seed, w: 84, h: 54, eventChance: eventChance || 0 });
}
function paintMany(sim, id, n) {
  for (let i = 0; i < n; i++) {
    sim.paintAt(id, Math.floor(Math.random() * sim.w), Math.floor(Math.random() * sim.h));
  }
}
function runYears(sim, n) { for (let i = 0; i < n * 12; i++) sim.step(); }

function chapter1(seed) {
  const s = mk(seed);
  const st = CH.createState(1);
  ['grass', 'moss', 'shrub'].forEach(id => paintMany(s, id, 300));
  st.placedSet.grass = true; st.placedSet.moss = true; st.placedSet.shrub = true;
  let r;
  for (let y = 0; y < 12; y++) {
    runYears(s, 1);
    r = CH.update(1, s, st);
    if (r.allDone) return true;
  }
  return r.allDone;
}

function chapter2(seed) {
  const s = mk(seed);
  const st = CH.createState(2);
  paintMany(s, 'grass', 400); paintMany(s, 'shrub', 200);
  s.place('rabbit', 25); s.place('insect', 60); s.place('vole', 30);
  let r;
  for (let y = 0; y < 20; y++) {
    runYears(s, 1);
    r = CH.update(2, s, st);
    if (r.allDone) return true;
    const herb = CH.herbCount(s);
    if (herb < 40 && y > 2) { s.place('rabbit', 15); s.place('insect', 30); } // 补充
  }
  return r.allDone;
}

function chapter3(seed) {
  const s = mk(seed);
  const st = CH.createState(3);
  paintMany(s, 'grass', 400); paintMany(s, 'shrub', 250); paintMany(s, 'moss', 150);
  s.place('rabbit', 35); s.place('vole', 35); s.place('insect', 70);
  s.place('spider', 12); s.place('fox', 7);
  let r;
  for (let y = 0; y < 22; y++) {
    runYears(s, 1);
    r = CH.update(3, s, st);
    if (r.allDone) return true;
    if (CH.predCount(s) < 12 && y > 3) s.place('fox', 4);
    if (CH.herbCount(s) < 60 && y > 3) { s.place('rabbit', 15); s.place('vole', 15); }
  }
  return r.allDone;
}

function chapter4(seed) {
  const s = mk(seed);
  const st = CH.createState(4);
  paintMany(s, 'grass', 400); paintMany(s, 'moss', 350); paintMany(s, 'shrub', 200);
  s.place('rabbit', 30); s.place('vole', 30); s.place('mammoth', 14);
  s.place('fox', 6); s.place('wolf', 5);
  s.triggerEvent('iceage'); // 第 2 年冰期（与剧本一致）
  let r;
  for (let y = 0; y < 45; y++) {
    runYears(s, 1);
    r = CH.update(4, s, st);
    if (r.allDone) return true;
    if (CH.herbCount(s) < 20 && y > 10) { s.place('mammoth', 6); s.place('vole', 20); }
  }
  return r.allDone;
}

function chapter5(seed) {
  const s = mk(seed);
  const st = CH.createState(5);
  const SPEC = require('../js/shared/species.js');
  const NP = SPEC.PLANTS.length;
  const vi = SPEC.PLANTS.findIndex(p => p.id === 'vine');
  paintMany(s, 'grass', 400); paintMany(s, 'shrub', 250);
  s.place('rabbit', 35); s.place('vole', 30); s.place('deer', 12);
  s.place('fox', 6);
  s.triggerEvent('vine'); // 半年后入侵（与剧本一致）
  let r;
  for (let y = 0; y < 25; y++) {
    runYears(s, 1);
    r = CH.update(5, s, st);
    if (r.allDone) return true;
    // 自动玩家：定向除草——只清除藤蔓密集的格子（像玩家看到紫色区域后动手）
    if (CH.vineCoverage(s) > 0.20) {
      let cleared = 0;
      for (let i = 0; i < s.w * s.h; i++) {
        if (s.coverage[i * NP + vi] > 0.35) {
          const x = i % s.w, y = (i / s.w) | 0;
          s.removeAt(x, y, 1.4);
          if (++cleared > 120) break;
        }
      }
    }
    // 食物补充
    if (CH.herbCount(s) < 40 && y > 2) { s.place('rabbit', 12); s.place('deer', 5); }
  }
  return r.allDone;
}

function chapter6(seed) {
  const s = mk(seed, 0.014);
  const st = CH.createState(6);
  // 第 5 章收尾的完整食物网
  paintMany(s, 'grass', 450); paintMany(s, 'shrub', 300); paintMany(s, 'moss', 250);
  s.place('insect', 90); s.place('vole', 45); s.place('rabbit', 40); s.place('deer', 14);
  s.place('spider', 14); s.place('fox', 7); s.place('hawk', 6);
  let r;
  for (let y = 0; y < 130; y++) {
    runYears(s, 1);
    r = CH.update(6, s, st);
    if (r.allDone) return true;
    const stt = s.getStats();
    // 自动玩家维护：猎物过少补猎物，捕食者过盛移除
    if (CH.herbCount(s) < 60) { s.place('vole', 20); s.place('rabbit', 15); }
    if (CH.predCount(s) > 60) {
      for (let i = 0; i < 15; i++) s.removeAt(Math.floor(Math.random() * s.w), Math.floor(Math.random() * s.h), 1.2);
    }
    if (stt.aliveSpecies < 8 && y % 2 === 0) {
      if (!(stt.counts.spider)) s.place('spider', 8);
      if (!(stt.counts.hawk)) s.place('hawk', 4);
      if (!(stt.counts.deer)) s.place('deer', 6);
    }
  }
  return r.allDone;
}

const chapters = [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6];
const names = ['播种纪元', '草原呼吸', '王者降临', '冰河时代', '入侵警报', '千年方舟'];
let allOk = true;
chapters.forEach((fn, i) => {
  const t0 = Date.now();
  const ok = fn('verify-ch' + (i + 1));
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('第 ' + (i + 1) + ' 章「' + names[i] + '」: ' + (ok ? '✅ 可通关' : '❌ 无法通关') + '（' + sec + 's）');
  if (!ok) allOk = false;
});
console.log(allOk ? '\n🎉 全部 6 章均可通关' : '\n⚠️ 存在无法通关的章节');
process.exit(allOk ? 0 : 1);
