/* ============================================================
 * NETIME · 谜题状态机（浏览器 / Node 通用）
 * 时间密钥 / 线索档案 / 提示链 / 成就 / 存档
 * ============================================================ */
(function (global) {
  'use strict';

  var Story = global.Story || {};

  function now() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
  }

  function defaultState() {
    var eras = (Story.ERAS || []).map(function (e) { return e.id; });
    var unlocked = {};
    if (eras.length) unlocked[eras[0]] = true;
    return {
      version: 1,
      eraUnlocked: unlocked,   // era -> bool
      keysFound: {},           // era -> char
      keyOrder: [],            // [era...] 找到顺序
      passwordUnlocked: false,
      clues: [],               // {id,title,text,time,era}
      visitedPages: [],        // [pageId]
      hintsUsed: {},           // era -> count
      sourceViewed: [],        // [pageId]
      achievements: [],        // [achievement id]
      notes: []                // 玩家自记
    };
  }

  function load() {
    var store = global.localStorage;
    var raw = null;
    if (store && typeof store.getItem === 'function') raw = store.getItem('netime-save-v1');
    if (!raw) return defaultState();
    try {
      var st = JSON.parse(raw);
      var d = defaultState();
      // 合并（向前兼容）
      Object.keys(d).forEach(function (k) {
        if (st[k] !== undefined) d[k] = st[k];
      });
      return d;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    var store = global.localStorage;
    if (store && typeof store.setItem === 'function') {
      try { store.setItem('netime-save-v1', JSON.stringify(state)); } catch (e) { /* 忽略 */ }
    }
  }

  function erase() {
    var store = global.localStorage;
    if (store && typeof store.removeItem === 'function') {
      try { store.removeItem('netime-save-v1'); } catch (e) { /* 忽略 */ }
    }
  }

  var Puzzle = {
    state: null,
    init: function () {
      Puzzle.state = load();
      return Puzzle.state;
    },
    reset: function () {
      Puzzle.state = defaultState();
      erase();
      save(Puzzle.state);
      return Puzzle.state;
    },
    save: function () { save(Puzzle.state); },

    /* ---------- 年代解锁 ---------- */
    isEraUnlocked: function (era) { return !!Puzzle.state.eraUnlocked[era]; },
    isEraSolved: function (era) { return !!Puzzle.state.keysFound[era]; },

    /* ---------- 密钥提交 ---------- */
    // 1995-2010：提交单字密钥；2025：提交完整口令
    submitKey: function (era, value) {
      var input = String(value || '').trim();
      if (era === '2025') return Puzzle.submitPassword(input);

      var expect = (Story.KEYS || {})[era];
      if (!expect) return { ok: false, message: '这个年代不需要密钥。' };
      if (Puzzle.state.keysFound[era]) return { ok: false, message: '第 ' + expect.index + ' 枚密钥已经找到过了。' };
      if (input !== expect.char) {
        return { ok: false, message: '密钥校验失败：不对，再想想。（提示：可以点「提示」）' };
      }
      // 成功
      Puzzle.state.keysFound[era] = expect.char;
      Puzzle.state.keyOrder.push(era);
      var next = Puzzle.nextEra(era);
      if (next) {
        Puzzle.state.eraUnlocked[next] = true;
        Puzzle.award('key' + expect.index);
      }
      // 全部年代解锁 → 成就
      var eras = (Story.ERAS || []).map(function (e) { return e.id; });
      if (eras.every(function (e) { return Puzzle.state.eraUnlocked[e]; })) {
        Puzzle.award('era5');
      }
      Puzzle.save();
      return {
        ok: true,
        next: next,
        message: '第 ' + expect.index + ' 枚密钥「' + expect.char + '」验证通过！' + (next ? ' ' + next + ' 年的网络已解锁。' : '')
      };
    },

    submitPassword: function (value) {
      var input = String(value || '').trim();
      if (Puzzle.state.passwordUnlocked) return { ok: true, message: '信号已经解锁过了。' };
      if (input !== Story.PASSWORD) {
        return { ok: false, message: '口令错误。四个字，从 1995 到 2010，一路念下来。' };
      }
      Puzzle.state.passwordUnlocked = true;
      Puzzle.award('final');
      Puzzle.save();
      return { ok: true, message: '口令正确——锁开了。' };
    },

    // 下一个年代 id
    nextEra: function (era) {
      var eras = (Story.ERAS || []).map(function (e) { return e.id; });
      var i = eras.indexOf(era);
      if (i < 0 || i + 1 >= eras.length) return null;
      return eras[i + 1];
    },

    /* ---------- 线索档案 ---------- */
    addClue: function (page) {
      if (!page || !page.clue) return null;
      var exists = Puzzle.state.clues.some(function (c) { return c.id === page.clue.id; });
      if (exists) return null;
      var clue = {
        id: page.clue.id,
        era: page.era,
        title: page.clue.title,
        text: page.clue.text,
        pageId: page.id,
        time: now()
      };
      Puzzle.state.clues.push(clue);
      Puzzle.save();
      return clue;
    },

    /* ---------- 访问记录 ---------- */
    visit: function (pageId) {
      if (!pageId) return false;
      if (Puzzle.state.visitedPages.indexOf(pageId) >= 0) return false;
      Puzzle.state.visitedPages.push(pageId);
      Puzzle.save();
      return true;
    },

    /* ---------- 提示 ---------- */
    hints: function (era) {
      var all = (Story.HINTS || {})[era] || [];
      var used = Puzzle.state.hintsUsed[era] || 0;
      return all.slice(0, used + 1); // 已用 + 下一个
    },
    useHint: function (era) {
      var all = (Story.HINTS || {})[era] || [];
      var used = Puzzle.state.hintsUsed[era] || 0;
      if (used >= all.length) return null;
      Puzzle.state.hintsUsed[era] = used + 1;
      Puzzle.save();
      return all[used];
    },

    /* ---------- 成就 ---------- */
    award: function (id) {
      if (Puzzle.state.achievements.indexOf(id) >= 0) return false;
      Puzzle.state.achievements.push(id);
      Puzzle.save();
      return true;
    },
    hasAchievement: function (id) { return Puzzle.state.achievements.indexOf(id) >= 0; },

    /* ---------- 笔记 ---------- */
    addNote: function (text) {
      var t = String(text || '').trim();
      if (!t) return null;
      var note = { text: t, time: now() };
      Puzzle.state.notes.push(note);
      Puzzle.save();
      return note;
    },
    removeNote: function (idx) {
      if (idx >= 0 && idx < Puzzle.state.notes.length) {
        Puzzle.state.notes.splice(idx, 1);
        Puzzle.save();
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Puzzle;
  } else {
    global.NetPuzzle = Puzzle;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
