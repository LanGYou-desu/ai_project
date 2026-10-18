// 墨战 · 天书纪 — 字库图鉴渲染
(function (g) {
  'use strict';

  function renderCharGrid(container, state, dict, opts) {
    const opts2 = opts || {};
    const byCat = {};
    for (const c of dict) {
      if (!byCat[c.cat]) byCat[c.cat] = [];
      byCat[c.cat].push(c);
    }
    const cats = Object.keys(byCat).sort();
    container.innerHTML = '';
    for (const cat of cats) {
      const sec = document.createElement('div');
      sec.className = 'gallery-section';
      const title = document.createElement('h3');
      title.textContent = cat + '部';
      sec.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'gallery-grid';
      for (const c of byCat[cat]) {
        const owned = state.gallery.chars.includes(c.ch);
        const card = document.createElement('div');
        card.className = 'gallery-card' + (owned ? ' owned' : ' locked');
        card.innerHTML = '<div class="gch">' + (owned ? c.ch : '？') + '</div>' +
          '<div class="gpy">' + (owned ? c.pinyin : '· · ·') + '</div>' +
          '<div class="gme">' + (owned ? c.meaning : '尚未收集') + '</div>';
        grid.appendChild(card);
      }
      sec.appendChild(grid);
      container.appendChild(sec);
    }
  }

  function renderWordList(container, state, words, opts) {
    const ownedSet = new Set(state.gallery.words);
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'gallery-grid wide';
    for (const w of words) {
      const owned = ownedSet.has(w.w);
      const card = document.createElement('div');
      card.className = 'gallery-card' + (owned ? ' owned' : ' locked');
      card.innerHTML = '<div class="gch small">' + (owned ? w.w : '？？') + '</div>' +
        '<div class="gpy">' + (owned ? w.p : '· · ·') + '</div>' +
        '<div class="gme">' + (owned ? w.m : '尚未收集') + '</div>';
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }

  g.INK_GALLERY = { renderCharGrid, renderWordList };
})(typeof globalThis !== 'undefined' ? globalThis : this);
