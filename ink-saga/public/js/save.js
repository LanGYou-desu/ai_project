// 墨战 · 天书纪 — 存档系统（本地 localStorage + 后端文件双写）
(function (g) {
  'use strict';

  const KEY = 'ink_saga_save_v1';

  function defaultState() {
    return {
      version: 1,
      name: '无名书生',
      growth: { qi: 0, levels: { power: 1, crit: 1, pool: 1, qi: 1 }, spendTotal: 0 },
      stats: {
        totalKills: 0, maxComboEver: 0, totalPerfects: 0,
        killMote: 0, killIdiom: 0, bosses: [], bestEndless: 0,
        practiceCount: 0, reportCount: 0,
        wrongChars: [],      // [{ch, count}]
        runs: 0
      },
      story: { chapterProgress: 'prologue', finished: false, endings: [], lastEnding: null },
      equipment: { pen: null, ink: null, paper: null, stone: null },
      inventory: [],
      gallery: { chars: [], words: [], idioms: [] },
      achievements: [],
      settings: { volume: 0.5, threshold: 0.15 }
    };
  }

  let state = null;

  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(defaultState(), parsed);
        state.growth = Object.assign(defaultState().growth, parsed.growth || {});
        state.stats = Object.assign(defaultState().stats, parsed.stats || {});
        state.story = Object.assign(defaultState().story, parsed.story || {});
        state.gallery = Object.assign(defaultState().gallery, parsed.gallery || {});
        state.settings = Object.assign(defaultState().settings, parsed.settings || {});
        state.achievements = parsed.achievements || [];
      } else {
        state = defaultState();
      }
    } catch (e) {
      state = defaultState();
    }
    // 新手福利：一支凡品狼毫笔
    if (state.equipment && !state.equipment.pen && g.INK_EQUIP) {
      state.equipment.pen = g.INK_EQUIP.makeItem('pen', 'white');
    }
    // 尝试从服务器拉取并智能合并（qi 取大、收集取并集、统计取大）
    fetch('/api/save').then(r => r.json()).then(res => {
      if (res && res.ok && res.save && res.save.version) {
        const remote = res.save;
        let changed = false;
        if ((remote.growth.qi || 0) > (state.growth.qi || 0)) { state.growth.qi = remote.growth.qi; changed = true; }
        for (const k of Object.keys(remote.growth.levels || {})) {
          const lv = remote.growth.levels[k] || 1;
          if (lv > (state.growth.levels[k] || 1)) { state.growth.levels[k] = lv; changed = true; }
        }
        const union = (a, b) => { const s = new Set([...(a || []), ...(b || [])]); return [...s]; };
        state.gallery.chars = union(state.gallery.chars, remote.gallery && remote.gallery.chars);
        state.gallery.words = union(state.gallery.words, remote.gallery && remote.gallery.words);
        state.gallery.idioms = union(state.gallery.idioms, remote.gallery && remote.gallery.idioms);
        state.achievements = union(state.achievements, remote.achievements);
        state.story.endings = union(state.story.endings, remote.story && remote.story.endings);
        state.story.cleared = union(state.story.cleared, remote.story && remote.story.cleared);
        state.stats.bestEndless = Math.max(state.stats.bestEndless || 0, (remote.stats && remote.stats.bestEndless) || 0);
        state.stats.totalKills = Math.max(state.stats.totalKills || 0, (remote.stats && remote.stats.totalKills) || 0);
        if (remote.story && remote.story.finished) state.story.finished = true;
        if (changed || state.achievements.length || state.gallery.chars.length) { persistLocal(); g.INK_EVENTS && g.INK_EVENTS.emit('save-loaded'); }
      }
    }).catch(() => {});
    return state;
  }

  function persistLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function save() {
    persistLocal();
    try {
      fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {});
    } catch (e) {}
  }

  // 战斗结算 → 并入全局统计
  function applyRun(stats, player) {
    const st = load();
    st.stats.runs++;
    st.stats.totalKills += stats.kills;
    st.stats.totalQi = (st.stats.totalQi || 0) + (stats.qiEarned || 0);
    st.stats.totalWritten = (st.stats.totalWritten || 0) + (stats.written || 0);
    st.stats.totalWrong = (st.stats.totalWrong || 0) + (stats.wrong || 0);
    for (const k of Object.keys(stats.killByType || {})) {
      st.stats.killByType = st.stats.killByType || {};
      st.stats.killByType[k] = (st.stats.killByType[k] || 0) + stats.killByType[k];
    }
    st.stats.maxComboEver = Math.max(st.stats.maxComboEver || 0, stats.maxCombo);
    st.stats.totalPerfects += stats.perfects;
    if (stats.kills > 0) {
      // 敌人类型击杀统计：根据本场击杀数粗略归入（简化：按统计敌人种类）
    }
    // 图鉴收集
    for (const ch of Object.keys(stats.charsUsed || {})) addGalleryChar(ch);
    // 错字记录（报告素材）
    for (const m of stats.misses || []) {
      const found = st.stats.wrongChars.find(w => w.ch === m.ch);
      if (found) found.count += m.count; else st.stats.wrongChars.push({ ch: m.ch, count: m.count });
    }
    // 文气入库
    st.growth.qi += stats.qiEarned || 0;
    save();
  }

  function addGalleryChar(ch) {
    const st = load();
    if (ch && ch.length === 1 && !st.gallery.chars.includes(ch)) { st.gallery.chars.push(ch); save(); }
  }
  function addGalleryWord(w) {
    const st = load();
    if (w && !st.gallery.words.includes(w)) { st.gallery.words.push(w); save(); }
  }
  function addGalleryIdiom(w) {
    const st = load();
    if (w && !st.gallery.idioms.includes(w)) { st.gallery.idioms.push(w); save(); }
  }

  // 记录 Boss 击杀
  function addBossKill(id) {
    const st = load();
    if (!st.stats.bosses.includes(id)) st.stats.bosses.push(id);
    save();
  }

  function unlockChars(chars) {
    const st = load();
    for (const c of chars || []) addGalleryChar(c);
  }

  function _inject(data) { state = data; persistLocal(); }

  function addItem(item) {
    const st = load();
    st.inventory = st.inventory || [];
    if (st.inventory.length >= 30) { st.inventory.shift(); }
    st.inventory.push(item);
    save();
    return item;
  }
  function equipItem(itemUid) {
    const st = load();
    const idx = (st.inventory || []).findIndex(it => it.uid === itemUid);
    if (idx < 0) return { ok: false, reason: '物品不存在' };
    const it = st.inventory[idx];
    // 换下旧装备进背包
    const old = st.equipment[it.slot];
    st.equipment[it.slot] = it;
    st.inventory.splice(idx, 1);
    if (old) st.inventory.push(old);
    save();
    return { ok: true };
  }
  function unequipItem(slot) {
    const st = load();
    const old = st.equipment[slot];
    if (!old) return { ok: false, reason: '该槽位无装备' };
    st.equipment[slot] = null;
    st.inventory = st.inventory || [];
    st.inventory.push(old);
    save();
    return { ok: true };
  }

  g.INK_SAVE = { load, save, applyRun, addGalleryChar, addGalleryWord, addGalleryIdiom, addBossKill, unlockChars, defaultState, _inject, addItem, equipItem, unequipItem };
  // 轻量事件总线
  g.INK_EVENTS = g.INK_EVENTS || { handlers: {}, on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }, emit(ev, data) { (this.handlers[ev] || []).forEach(fn => fn(data)); } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
