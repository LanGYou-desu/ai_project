// 墨战 · 天书纪 — 存档系统（本地 localStorage + 后端文件双写）
(function (g) {
  'use strict';

  const KEY = 'ink_saga_save_v1';
  const SLOTS = ['pen', 'ink', 'paper', 'stone'];
  const RARITY_IDS = ['white', 'green', 'blue', 'purple', 'gold'];

  // 装备条目校验：损坏/导入的存档里缺字段或 rarity 非法时，退回凡品，避免 UI 读 r.color 崩溃
  function cleanItem(it, slot) {
    if (!it || typeof it !== 'object') return null;
    const s = SLOTS.indexOf(it.slot) >= 0 ? it.slot : slot;
    if (SLOTS.indexOf(s) < 0) return null;
    const uid = Number(it.uid);
    return {
      uid: Number.isFinite(uid) ? uid : Date.now() + Math.floor(Math.random() * 1000),
      slot: s,
      rarity: RARITY_IDS.indexOf(it.rarity) >= 0 ? it.rarity : 'white',
      name: String(it.name == null ? '装备' : it.name).slice(0, 40),
      desc: String(it.desc == null ? '' : it.desc).slice(0, 40),
      power: Math.max(0, Math.floor(num(it.power, 0))),
      crit: Math.max(0, num(it.crit, 0)),
      hp: Math.max(0, Math.floor(num(it.hp, 0))),
      qiMul: Math.max(0, num(it.qiMul, 0))
    };
  }

  function defaultState() {
    return {
      version: 1,
      name: '无名书生',
      growth: { qi: 0, levels: { power: 1, crit: 1, pool: 1, qi: 1, combo: 1, boss: 1 }, spendTotal: 0 },
      stats: {
        totalKills: 0, maxComboEver: 0, totalPerfects: 0, totalQi: 0, totalWritten: 0, totalWrong: 0,
        killMote: 0, killIdiom: 0, bosses: [], bestEndless: 0,
        practiceCount: 0, reportCount: 0, practiceSessions: 0, craftCount: 0,
        taBest: 0, taRuns: 0, dailyDone: 0, dailyStreak: 0, dailyLast: null, lastDailyReward: null,
        killByType: {}, wrongChars: [],
        runs: 0
      },
      story: { chapterProgress: 'prologue', finished: false, endings: [], cleared: [], lastEnding: null },
      equipment: { pen: null, ink: null, paper: null, stone: null },
      inventory: [],
      gallery: { chars: [], words: [], idioms: [] },
      achievements: [],
      settings: { volume: 0.5, threshold: 0.15, perfectTh: 0.5 }
    };
  }

  // 去掉 __proto__ / constructor / prototype 等危险键，避免 JSON 存档污染原型
  function clean(value, depth) {
    if (depth > 8) return null;
    if (Array.isArray(value)) return value.map(v => clean(v, depth + 1));
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        out[k] = clean(value[k], depth + 1);
      }
      return out;
    }
    return value;
  }

  function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  let state = null;
  let knownChars = null;
  function ensureState(st) {
    if (!st || typeof st !== 'object') return defaultState();
    st.stats = obj(st.stats);
    st.growth = obj(st.growth);
    st.growth.levels = obj(st.growth.levels);
    st.story = obj(st.story);
    st.gallery = obj(st.gallery);
    st.equipment = obj(st.equipment);
    st.stats.wrongChars = arr(st.stats.wrongChars);
    st.stats.bosses = arr(st.stats.bosses);
    st.gallery.chars = arr(st.gallery.chars);
    st.gallery.words = arr(st.gallery.words);
    st.gallery.idioms = arr(st.gallery.idioms);
    st.inventory = arr(st.inventory);
    return st;
  }
  function isKnownChar(ch) {
    if (!g.INK_DICT) return true;
    if (!knownChars) knownChars = new Set(g.INK_DICT.map(c => c.ch));
    return knownChars.has(ch);
  }

  function applyParsed(parsed) {
    const d = defaultState();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return d;
    if (typeof parsed.name === 'string') d.name = parsed.name.slice(0, 24) || d.name;

    const growth = obj(parsed.growth);
    d.growth.qi = Math.max(0, Math.floor(num(growth.qi, 0)));
    d.growth.spendTotal = Math.max(0, Math.floor(num(growth.spendTotal, 0)));
    const levels = obj(growth.levels);
    for (const id of Object.keys(d.growth.levels)) d.growth.levels[id] = clamp(Math.floor(num(levels[id], 1)), 1, 99);

    const stats = obj(parsed.stats);
    for (const k of ['totalKills', 'maxComboEver', 'totalPerfects', 'totalQi', 'totalWritten', 'totalWrong',
      'killMote', 'killIdiom', 'bestEndless', 'practiceCount', 'reportCount', 'practiceSessions', 'craftCount',
      'taBest', 'taRuns', 'dailyDone', 'dailyStreak', 'runs']) {
      d.stats[k] = Math.max(0, Math.floor(num(stats[k], 0)));
    }
    d.stats.dailyLast = stats.dailyLast == null ? null : String(stats.dailyLast).slice(0, 20);
    d.stats.lastDailyReward = stats.lastDailyReward == null ? null : String(stats.lastDailyReward).slice(0, 20);
    d.stats.bosses = arr(stats.bosses).filter(x => typeof x === 'string').slice(0, 64);
    d.stats.killByType = obj(stats.killByType);
    d.stats.wrongChars = arr(stats.wrongChars)
      .filter(w => w && typeof w.ch === 'string' && w.ch.length === 1)
      .map(w => ({ ch: w.ch, count: Math.max(0, Math.floor(num(w.count, 0))) }))
      .slice(0, 300);

    const story = obj(parsed.story);
    if (typeof story.chapterProgress === 'string') d.story.chapterProgress = story.chapterProgress;
    d.story.finished = !!story.finished;
    d.story.endings = arr(story.endings).filter(x => typeof x === 'string').slice(0, 32);
    d.story.cleared = arr(story.cleared).filter(x => typeof x === 'string').slice(0, 64);
    d.story.lastEnding = story.lastEnding == null ? null : String(story.lastEnding);

    const eq = obj(parsed.equipment);
    for (const slot of SLOTS) d.equipment[slot] = cleanItem(eq[slot], slot);
    d.inventory = arr(parsed.inventory).map(i => cleanItem(i, i && i.slot)).filter(Boolean).slice(0, 30);

    const gallery = obj(parsed.gallery);
    d.gallery.chars = arr(gallery.chars).filter(x => typeof x === 'string' && x.length === 1 && isKnownChar(x)).slice(0, 400);
    d.gallery.words = arr(gallery.words).filter(x => typeof x === 'string').slice(0, 400);
    d.gallery.idioms = arr(gallery.idioms).filter(x => typeof x === 'string').slice(0, 400);

    d.achievements = arr(parsed.achievements).filter(x => typeof x === 'string').slice(0, 200);

    const settings = obj(parsed.settings);
    d.settings.volume = clamp(num(settings.volume, 0.5), 0, 1);
    d.settings.threshold = clamp(num(settings.threshold, 0.15), 0.05, 0.5);
    d.settings.perfectTh = clamp(num(settings.perfectTh, 0.5), 0.3, 0.9);
    return d;
  }

  function load() {
    if (state) return state;
    state = defaultState();
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(KEY) : null;
      if (raw) state = applyParsed(clean(JSON.parse(raw), 0));
    } catch (e) {
      state = defaultState();
    }
    if (state.equipment && !state.equipment.pen && g.INK_EQUIP) {
      state.equipment.pen = g.INK_EQUIP.makeItem('pen', 'white');
    }
    if (g.INK_EQUIP && g.INK_EQUIP.syncUid) g.INK_EQUIP.syncUid(state);
    if (typeof fetch === 'function') {
      fetch('/api/save').then(r => r.json()).then(res => {
        if (!res || !res.ok || !res.save || !res.save.version) return;
        const remote = applyParsed(clean(res.save, 0));
        let changed = false;
        if (remote.growth.qi > state.growth.qi) { state.growth.qi = remote.growth.qi; changed = true; }
        for (const k of Object.keys(remote.growth.levels)) {
          const lv = remote.growth.levels[k] || 1;
          if (lv > (state.growth.levels[k] || 1)) { state.growth.levels[k] = lv; changed = true; }
        }
        const union = (a, b) => [...new Set([...arr(a), ...arr(b)])];
        const before = JSON.stringify([state.gallery, state.achievements, state.story.endings, state.story.cleared]);
        state.gallery.chars = union(state.gallery.chars, remote.gallery.chars);
        state.gallery.words = union(state.gallery.words, remote.gallery.words);
        state.gallery.idioms = union(state.gallery.idioms, remote.gallery.idioms);
        state.achievements = union(state.achievements, remote.achievements);
        state.story.endings = union(state.story.endings, remote.story.endings);
        state.story.cleared = union(state.story.cleared, remote.story.cleared);
        if (before !== JSON.stringify([state.gallery, state.achievements, state.story.endings, state.story.cleared])) changed = true;
        const best = Math.max(state.stats.bestEndless || 0, remote.stats.bestEndless || 0);
        if (best !== state.stats.bestEndless) { state.stats.bestEndless = best; changed = true; }
        const kills = Math.max(state.stats.totalKills || 0, remote.stats.totalKills || 0);
        if (kills !== state.stats.totalKills) { state.stats.totalKills = kills; changed = true; }
        if (remote.story.finished && !state.story.finished) { state.story.finished = true; changed = true; }
        if (changed) { persistLocal(); g.INK_EVENTS && g.INK_EVENTS.emit('save-loaded'); }
      }).catch(() => {});
    }
    return state;
  }

  function persistLocal() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function save() {
    persistLocal();
    if (typeof fetch !== 'function') return;
    try {
      fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {});
    } catch (e) {}
  }

  // 战斗结算 → 并入全局统计（图鉴/错字/Boss 击杀一次性落盘）
  function applyRun(stats) {
    const st = ensureState(load());
    const s = stats || {};
    st.stats.runs = (st.stats.runs || 0) + 1;
    st.stats.totalKills = (st.stats.totalKills || 0) + (s.kills || 0);
    st.stats.totalQi = (st.stats.totalQi || 0) + (s.qiEarned || 0);
    st.stats.totalWritten = (st.stats.totalWritten || 0) + (s.written || 0);
    st.stats.totalWrong = (st.stats.totalWrong || 0) + (s.wrong || 0);
    const kbt = obj(s.killByType);
    st.stats.killByType = obj(st.stats.killByType);
    for (const k of Object.keys(kbt)) {
      const v = num(kbt[k], 0);
      if (v > 0) st.stats.killByType[k] = (st.stats.killByType[k] || 0) + v;
    }
    st.stats.killMote = (st.stats.killMote || 0) + num(kbt.mote, 0);
    st.stats.killIdiom = (st.stats.killIdiom || 0) + num(kbt.idiom, 0);
    st.stats.maxComboEver = Math.max(st.stats.maxComboEver || 0, num(s.maxCombo, 0));
    st.stats.totalPerfects = (st.stats.totalPerfects || 0) + num(s.perfects, 0);
    for (const ch of Object.keys(obj(s.charsUsed))) addGalleryChar(ch, false);
    for (const w of arr(s.wordsUsed)) addGalleryWord(w, false);
    for (const w of arr(s.idiomsUsed)) addGalleryIdiom(w, false);
    for (const id of arr(s.bosses)) addBossKill(id, false);
    st.stats.wrongChars = arr(st.stats.wrongChars);
    for (const m of arr(s.misses)) {
      if (!m || typeof m.ch !== 'string' || m.ch.length !== 1) continue;
      const found = st.stats.wrongChars.find(w => w.ch === m.ch);
      if (found) found.count += num(m.count, 0); else st.stats.wrongChars.push({ ch: m.ch, count: Math.max(1, num(m.count, 1)) });
    }
    st.growth.qi = (st.growth.qi || 0) + num(s.qiEarned, 0);
    save();
  }

  function addGalleryChar(ch, persist) {
    const st = ensureState(load());
    if (ch && ch.length === 1 && isKnownChar(ch) && !st.gallery.chars.includes(ch)) {
      st.gallery.chars.push(ch);
      if (persist !== false) save();
    }
  }
  function addGalleryWord(w, persist) {
    const st = ensureState(load());
    if (w && typeof w === 'string' && !st.gallery.words.includes(w)) {
      st.gallery.words.push(w);
      if (persist !== false) save();
    }
  }
  function addGalleryIdiom(w, persist) {
    const st = ensureState(load());
    if (w && typeof w === 'string' && !st.gallery.idioms.includes(w)) {
      st.gallery.idioms.push(w);
      if (persist !== false) save();
    }
  }
  function addBossKill(id, persist) {
    const st = ensureState(load());
    if (typeof id === 'string' && !st.stats.bosses.includes(id)) {
      st.stats.bosses.push(id);
      if (persist !== false) save();
    }
  }
  function unlockChars(chars) {
    for (const c of arr(chars)) addGalleryChar(c, false);
    save();
  }
  function _inject(data) {
    state = data;
    if (g.INK_EQUIP && g.INK_EQUIP.syncUid) g.INK_EQUIP.syncUid(state);
    persistLocal();
  }
  function addItem(item) {
    if (!item || typeof item !== 'object') return null;
    const st = ensureState(load());
    st.inventory = arr(st.inventory);
    if (st.inventory.length >= 30) st.inventory.shift();
    st.inventory.push(item);
    save();
    return item;
  }
  function equipItem(itemUid) {
    const st = ensureState(load());
    const idx = (st.inventory || []).findIndex(it => it && String(it.uid) === String(itemUid));
    if (idx < 0) return { ok: false, reason: '物品不存在' };
    const it = st.inventory[idx];
    if (!it.slot || SLOTS.indexOf(it.slot) < 0) return { ok: false, reason: '装备槽位无效' };
    const old = st.equipment[it.slot];
    st.equipment[it.slot] = it;
    st.inventory.splice(idx, 1);
    if (old) st.inventory.push(old);
    save();
    return { ok: true };
  }
  function unequipItem(slot) {
    if (SLOTS.indexOf(slot) < 0) return { ok: false, reason: '装备槽位无效' };
    const st = ensureState(load());
    const old = st.equipment[slot];
    if (!old) return { ok: false, reason: '该槽位无装备' };
    st.equipment[slot] = null;
    st.inventory = arr(st.inventory);
    st.inventory.push(old);
    save();
    return { ok: true };
  }

  g.INK_SAVE = { load, save, applyRun, addGalleryChar, addGalleryWord, addGalleryIdiom, addBossKill, unlockChars, defaultState, _inject, addItem, equipItem, unequipItem, sanitize: (v) => clean(v, 0) };
  g.INK_EVENTS = g.INK_EVENTS || { handlers: {}, on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }, emit(ev, data) { (this.handlers[ev] || []).forEach(fn => fn(data)); } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
