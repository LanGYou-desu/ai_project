// 墨战 · 天书纪 — 应用主控（菜单 / 剧情流程 / 战斗宿主 / 图鉴 / 修炼 / 成就 / 报告）
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- 数据 ----------
  const DICT = window.INK_DICT || [];
  const WORDS = window.INK_WORDS || { words2: [], idioms: [] };
  const STORY = window.INK_STORY || { chapters: [], endings: {} };
  const AUDIO = new window.INK_AUDIO.InkAudio();
  window.INK_AUDIO.instance = AUDIO;

  const NEXT = {
    prologue: 'ch1', ch1: 'ch2', ch2a: 'ch3', ch2b: 'ch3', ch3: 'ch4', ch4: 'ch5',
    ch5a: 'ch6', ch5b: 'ch6', ch6a: 'finale', ch6b: 'finale', ch6c: 'finale'
  };
  const chapterById = (id) => STORY.chapters.find(c => c.id === id);

  let battle = null;
  let battleResolve = null; // 战斗结束后继续流程的闭包

  // ---------- 屏幕管理 ----------
  const screens = ['menu', 'story', 'endless', 'gallery', 'growth', 'achievements', 'report', 'settings', 'battle'];
  function showScreen(name) {
    for (const s of screens) {
      const el = $('#screen-' + s);
      if (el) el.classList.toggle('active', s === name);
    }
    window.scrollTo(0, 0);
  }
  function openModal(id) {
    const m = $('#' + id);
    if (m) m.classList.add('open');
  }
  function closeModal(id) {
    const m = $('#' + id);
    if (m) m.classList.remove('open');
  }

  // ---------- 音频初始化（需用户手势） ----------
  function initAudio() {
    AUDIO.ensure();
    const st = window.INK_SAVE.load();
    AUDIO.setEnabled(st.settings.volume > 0);
    if (st.settings.volume !== undefined) AUDIO.master && (AUDIO.master.gain.value = st.settings.volume);
  }
  document.addEventListener('pointerdown', () => { if (!AUDIO.ctx) initAudio(); }, { once: false });

  // ---------- 主菜单 ----------
  function buildMenu() {
    const st = window.INK_SAVE.load();
    $('#menu-name').textContent = st.name + ' · ' + titleOf(st);
    $('#menu-qi').textContent = '文气 ' + st.growth.qi;
    const pct = Math.round(st.gallery.chars.length / DICT.length * 100);
    $('#menu-gallery-pct').textContent = '字库图鉴 ' + st.gallery.chars.length + '/' + DICT.length + ' (' + pct + '%)';
    const ach = st.achievements.length;
    $('#menu-ach').textContent = '成就 ' + ach + '/' + (window.INK_ACHIEVEMENTS.ACHIEVEMENTS.length);
  }

  // ---------- 剧情模式 ----------
  function buildStoryMenu() {
    const st = window.INK_SAVE.load();
    const cleared = st.story.cleared || [];
    st.story.cleared = cleared;
    const list = $('#story-list');
    list.innerHTML = '';
    let index = 0;
    for (const ch of STORY.chapters) {
      // 是否主线章节（分支也显示，但标记）
      const isBranch = ['ch2a', 'ch2b', 'ch5a', 'ch5b', 'ch6a', 'ch6b', 'ch6c'].includes(ch.id);
      const unlocked = ch.id === 'prologue' || cleared.some(cid => NEXT[cid] === ch.id) || cleared.includes(ch.id);
      if (!unlocked) continue;
      const item = document.createElement('div');
      item.className = 'story-item' + (cleared.includes(ch.id) ? ' done' : '');
      item.innerHTML = '<div class="si-no">' + String(index + 1).padStart(2, '0') + '</div>' +
        '<div class="si-body"><div class="si-title">' + ch.title + '</div>' +
        '<div class="si-eph">' + ch.epigraph + '</div></div>' +
        '<div class="si-btn">' + (cleared.includes(ch.id) ? '再战' : '进入') + '</div>';
      if (isBranch) item.classList.add('branch');
      item.onclick = () => startChapter(ch.id);
      list.appendChild(item);
      index++;
    }
    if (!list.children.length) {
      list.innerHTML = '<div class="empty-tip">暂无可用章节</div>';
    }
    // 结局回廊
    const ends = $('#ending-list');
    ends.innerHTML = '';
    for (const [id, e] of Object.entries(STORY.endings)) {
      const got = st.story.endings.includes(id);
      const item = document.createElement('div');
      item.className = 'ending-card ' + (got ? 'got' : '');
      item.innerHTML = '<div class="ec-name">' + (got ? e.name : '？？？') + '</div>' +
        '<div class="ec-grade">' + (got ? e.grade : '?') + '</div>' +
        '<div class="ec-desc">' + (got ? e.desc : '尚未达成') + '</div>';
      ends.appendChild(item);
    }
  }

  // 章节开场（打字机）
  let sceneIdx = 0;
  let sceneList = [];
  let sceneEl = null;
  let currentChapterId = null;
  function startChapter(chapterId) {
    const ch = chapterById(chapterId);
    if (!ch) return;
    currentChapterId = chapterId;
    showScreen('battle');
    $('#battle-title').textContent = ch.title;
    // 展示开场场景
    sceneList = ch.scenes || [];
    sceneIdx = 0;
    sceneEl = $('#story-scene');
    sceneEl.classList.add('open');
    $('#scene-text').textContent = '';
    showSceneText();
    battleResolve = () => beginBattle({ mode: 'story', chapterId }, ch);
  }
  function showSceneText() {
    const sc = sceneList[sceneIdx];
    if (!sc) { closeSceneAndGo(); return; }
    // 场景插图
    const theme = window.INK_THEMES ? window.INK_THEMES.themeOf(currentChapterId, 'story') : null;
    const art = $('#scene-art');
    if (art && window.INK_SCENEART) {
      art.width = art.clientWidth || 640;
      art.height = art.clientHeight || 220;
      window.INK_SCENEART.drawSceneBackdrop(art, theme ? theme.bg : 'paper');
    }
    $('#scene-text').textContent = '';
    $('#scene-who').textContent = sc.t === 'char' ? sc.who : '';
    const txt = sc.text;
    let i = 0;
    const speed = 30;
    AUDIO.ensure();
    const timer = setInterval(() => {
      i += 1;
      $('#scene-text').textContent = txt.slice(0, i);
      if (i >= txt.length) clearInterval(timer);
    }, speed);
    $('#scene-text').dataset.timer = timer;
    $('#scene-next').textContent = '点击继续 ▸';
  }
  function sceneNext() {
    const timer = $('#scene-text').dataset.timer;
    if (timer) { clearInterval(Number(timer)); $('#scene-text').dataset.timer = ''; }
    sceneIdx++;
    if (sceneIdx >= sceneList.length) {
      // 场景结束，进入战斗
      closeSceneAndGo();
    } else {
      showSceneText();
    }
  }
  function closeSceneAndGo() {
    sceneEl.classList.remove('open');
    const go = battleResolve;
    battleResolve = null;
    if (go) go();
  }
  $('#scene-next').addEventListener('click', sceneNext);
  $('#scene-text').addEventListener('click', sceneNext);

  // ---------- 战斗宿主 ----------
  function beginBattle(config, chapter) {
    const canvas = $('#battle-canvas');
    // 清理旧战斗
    if (battle) { battle.destroy(); battle = null; }
    showScreen('battle');
    $('#battle-title').textContent = config.mode === 'story' ? (chapter ? chapter.title : '战斗') : '无尽模式 · 第 ' + config.level + ' 层';
    $('#battle-subtitle').textContent = config.mode === 'story' ? (chapter ? chapter.epigraph : '') : '深渊无底，墨海无涯';
    // HUD 重置
    $('#hud-hp-fill').style.width = '100%';
    $('#hud-combo').textContent = '0';
    $('#hud-qi').textContent = '0';
    $('#hud-score').textContent = '0';
    $('#boss-bar').style.display = 'none';
    $('#hud-hint').textContent = '按住鼠标左键，在空中书写敌人头顶的字';

    const st = window.INK_SAVE.load();
    battle = new window.INK_BATTLE.Battle({
      canvas,
      mode: config.mode,
      config,
      dict: DICT,
      words: WORDS,
      getState: () => ({ growth: st.growth }),
      theme: window.INK_THEMES.themeOf(config.chapterId, config.mode),
      threshold: st.settings.threshold,
      perfectTh: st.settings.perfectTh || 0.5,
      onHud: updateHud,
      onEnd: (stats, player) => onBattleEnd(stats, player, config, chapter)
    });
    battle.start();
    const pb = $('#battle-pause'); if (pb) pb.textContent = '⏸ 暂停';
    $('#pause-overlay').classList.remove('open');
    requestAnimationFrame(() => loop(battle));
  }

  function loop(b) {
    if (!b || b.state === 'destroyed') return;
    const dt = Math.min(0.05, (performance.now() - (b._last || performance.now())) / 1000);
    b._last = performance.now();
    b.update(dt);
    b.render();
    requestAnimationFrame(() => loop(b));
  }

  function updateHud(h) {
    $('#hud-hp-fill').style.width = Math.max(0, h.hp / h.maxHp * 100) + '%';
    $('#hud-hp-text').textContent = h.hp + '/' + h.maxHp + (h.shield > 0 ? ' 盾' + h.shield : '');
    $('#hud-combo').textContent = h.combo > 1 ? h.combo + ' 连墨' : '';
    $('#hud-qi').textContent = '文气 ' + h.qi;
    $('#hud-score').textContent = '墨迹 ' + h.score;
    $('#hud-wave').textContent = h.wave;
    const bb = $('#boss-bar');
    if (h.boss) {
      bb.style.display = 'block';
      $('#boss-name').textContent = h.boss.name + (h.boss.guarded ? '（守御中）' : '（破防！）');
      $('#boss-fill').style.width = Math.max(0, h.boss.hp / h.boss.maxHp * 100) + '%';
    } else {
      bb.style.display = 'none';
    }
  }

  function onBattleEnd(stats, player, config, chapter) {
    // 写错字等统计并入
    const st = window.INK_SAVE.load();
    if (stats.result === 'clear') {
      // 收集图鉴
      for (const ch of Object.keys(stats.charsUsed || {})) window.INK_SAVE.addGalleryChar(ch);
      // Boss 击杀
      if (chapter && chapter.boss) window.INK_SAVE.addBossKill(chapter.boss.id);
    }
    window.INK_SAVE.applyRun(stats, player);
    // 装备掉落入包
    for (const it of (stats.drops || [])) {
      window.INK_SAVE.addItem(it);
      showToast('获得装备：「' + it.name + '」');
    }

    if (config.mode === 'story') {
      if (stats.result === 'clear') {
        // 标记章节完成
        const st2 = window.INK_SAVE.load();
        st2.story.cleared = st2.story.cleared || [];
        if (!st2.story.cleared.includes(config.chapterId)) st2.story.cleared.push(config.chapterId);
        // 解锁字
        if (chapter && chapter.reward && chapter.reward.unlockChars) {
          for (const c of chapter.reward.unlockChars) window.INK_SAVE.addGalleryChar(c);
        }
        st2.story.chapterProgress = config.chapterId;
        window.INK_SAVE.save();
        showResultModal(stats, 'clear', () => {
          if (chapter && chapter.choice) {
            showChoice(chapter);
          } else {
            const nextId = NEXT[config.chapterId];
            if (nextId) startChapter(nextId);
            else endStory(config.chapterId);
          }
        });
      } else {
        showResultModal(stats, 'defeat', () => {
          // 重试本章
          startChapter(config.chapterId);
        }, true);
      }
    } else if (config.daily) {
      // 每日一墨
      const st2 = window.INK_SAVE.load();
      if (stats.result === 'clear' && config.level < (config.dailyLevels || 5)) {
        showResultModal(stats, 'clear', () => {
          beginBattle({ mode: 'endless', level: config.level + 1, seed: config.seed, daily: true, dailyLevels: config.dailyLevels });
        }, false, '进入今日第 ' + (config.level + 1) + ' 层');
      } else {
        st2.stats.dailyDone = (st2.stats.dailyDone || 0) + 1;
        const today = String(dailySeed());
        if (st2.stats.lastDailyReward !== today) {
          const y = new Date(); y.setDate(y.getDate() - 1);
          const yesterday = String(y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate());
          const streak = st2.stats.dailyLast === yesterday ? (st2.stats.dailyStreak || 0) + 1 : 1;
          st2.stats.dailyLast = today;
          st2.stats.dailyStreak = streak;
          st2.stats.lastDailyReward = today;
          const bonus = 200 + (streak - 1) * 50;
          st2.growth.qi += bonus;
          window.INK_SAVE.save();
          showToast('每日一墨完成奖励：+' + bonus + ' 文气' + (streak > 1 ? '（连胜 ' + streak + ' 天！）' : ''));
        }
        window.INK_SAVE.save();
        submitLeaderboard(st2, stats, config.level, 'daily');
        showResultModal(stats, stats.result, () => { showScreen('menu'); buildMenu(); }, stats.result === 'defeat', stats.result === 'clear' ? '今日挑战完成' : null, true, 'daily');
      }
    } else {
      // 无尽模式
      if (stats.result === 'clear') {
        const st2 = window.INK_SAVE.load();
        if (config.level > (st2.stats.bestEndless || 0)) { st2.stats.bestEndless = config.level; window.INK_SAVE.save(); }
        const lvBonus = config.level * 10;
        st2.growth.qi += lvBonus;
        window.INK_SAVE.save();
        if (config.level % 5 === 0) showToast('第 ' + config.level + ' 层通关奖励：+' + lvBonus + ' 文气');
        showResultModal(stats, 'clear', () => {
          beginBattle({ mode: 'endless', level: config.level + 1 });
        }, false, '进入第 ' + (config.level + 1) + ' 层');
      } else {
        submitLeaderboard(st, stats, config.level);
        showResultModal(stats, 'defeat', () => { showScreen('menu'); buildMenu(); }, true, null, true, 'endless');
      }
    }
    // 成就检查
    window.INK_ACHIEVEMENTS.checkAll(window.INK_SAVE.load(), (a, rw) => {
      showToast('成就达成：' + a.name + (rw ? '（+' + rw + ' 文气）' : ''));
    });
  }

  function showResultModal(stats, result, onContinue, isRetry, continueLabel, showBoard, boardMode) {
    $('#result-title').textContent = result === 'clear' ? (stats.mode === 'story' ? '本章得胜' : '守界成功') : '砚血耗尽';
    $('#result-kills').textContent = stats.kills;
    $('#result-combo').textContent = stats.maxCombo;
    $('#result-perfect').textContent = stats.perfects;
    $('#result-wrong').textContent = stats.wrong;
    $('#result-qi').textContent = stats.qiEarned;
    $('#result-score').textContent = stats.score;
    $('#result-time').textContent = Math.round(stats.time) + 's';
    $('#result-continue').textContent = isRetry ? '重整旗鼓' : (continueLabel || '继续');
    $('#result-continue').onclick = () => { closeModal('result-modal'); if (onContinue) onContinue(); };
    const board = $('#result-board');
    board.style.display = showBoard ? 'block' : 'none';
    if (showBoard) renderLeaderboard(board, stats.score, stats.level, boardMode);
    openModal('result-modal');
  }

  // ---------- 剧情选择 / 结局 ----------
  function showChoice(chapter) {
    $('#choice-title').textContent = chapter.choice.prompt;
    const box = $('#choice-options');
    box.innerHTML = '';
    for (const opt of chapter.choice.options) {
      const b = document.createElement('button');
      b.className = 'btn choice-btn';
      b.textContent = opt.label;
      b.onclick = () => {
        closeModal('choice-modal');
        if (opt.ending) {
          finishEnding(opt.ending, chapter.id);
        } else if (opt.next) {
          startChapter(opt.next);
        }
      };
      box.appendChild(b);
    }
    openModal('choice-modal');
  }

  function finishEnding(endingId, chapterId) {
    let eid = endingId;
    // 隐藏结局：问天路线的「人」字 → 问天者
    const st = window.INK_SAVE.load();
    if (endingId === 'hengmo' && (st.story.cleared || []).includes('ch6b')) eid = 'wenyin';
    const e = STORY.endings[eid];
    const st2 = window.INK_SAVE.load();
    st2.story.endings = st2.story.endings || [];
    if (!st2.story.endings.includes(eid)) st2.story.endings.push(eid);
    st2.story.finished = true;
    st2.story.lastEnding = eid;
    window.INK_SAVE.save();
    $('#ending-modal-title').textContent = '结局 · ' + e.name;
    $('#ending-modal-grade').textContent = e.grade + ' 级结局';
    $('#ending-modal-desc').textContent = e.desc;
    $('#ending-modal-scene').textContent = '「' + e.scene + '」';
    $('#ending-modal-again').onclick = () => { closeModal('ending-modal'); showScreen('story'); buildStoryMenu(); };
    openModal('ending-modal');
  }

  function endStory(chapterId) {
    // 最终章无选项但未进结局（异常兜底）
    showScreen('story');
    buildStoryMenu();
  }

  // ---------- 无尽模式 ----------
  function startEndless() {
    const st = window.INK_SAVE.load();
    beginBattle({ mode: 'endless', level: 1 });
  }

  // 每日一墨：按日期种子生成确定性挑战（5 层）
  function dailySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function startDaily() {
    const seed = dailySeed();
    beginBattle({ mode: 'endless', level: 1, seed, daily: true, dailyLevels: 5 });
    $('#battle-subtitle').textContent = '每日一墨 · ' + new Date().toLocaleDateString('zh-CN') + ' · 同一种子，天下同题';
  }

  function submitLeaderboard(st, stats, level, mode) {
    const m = mode || 'endless';
    try {
      fetch('/api/leaderboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: st.name, mode: m, date: m === 'daily' ? String(dailySeed()) : undefined, score: stats.score, chars: stats.kills })
      }).catch(() => {});
    } catch (e) {}
  }

  async function renderLeaderboard(el, myScore, myLevel, mode) {
    try {
      const m = mode || 'endless';
      const q = m === 'daily' ? '?mode=daily&date=' + dailySeed() : '?mode=endless';
      const res = await fetch('/api/leaderboard' + q);
      const data = await res.json();
      const board = (data.board || []).slice(0, 10);
      el.innerHTML = '<div class="lb-head">' + (m === 'daily' ? '今日一墨榜' : '无尽排行榜') + ' · 墨迹榜</div>';
      if (!board.length) { el.innerHTML += '<div class="empty-tip">暂无记录，等你来写第一笔</div>'; return; }
      board.forEach((b, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row' + (b.score === myScore ? ' me' : '');
        row.innerHTML = '<span class="lb-rank">' + (i + 1) + '</span><span class="lb-name">' + b.name + '</span><span class="lb-score">' + b.score + '</span>';
        el.appendChild(row);
      });
    } catch (e) {
      el.innerHTML = '<div class="empty-tip">排行榜不可用（后端未启动）</div>';
    }
  }

  // ---------- 图鉴 ----------
  function buildGallery() {
    const st = window.INK_SAVE.load();
    window.INK_GALLERY.renderCharGrid($('#gallery-chars'), st, DICT);
    window.INK_GALLERY.renderWordList($('#gallery-words'), st, WORDS.words2);
    window.INK_GALLERY.renderWordList($('#gallery-idioms'), st, WORDS.idioms);
    $('#gallery-count').textContent = '已收集 ' + st.gallery.chars.length + ' / ' + DICT.length + ' 字 · ' + st.gallery.words.length + ' / ' + WORDS.words2.length + ' 词 · ' + st.gallery.idioms.length + ' / ' + WORDS.idioms.length + ' 成语';
  }

  // ---------- 修炼 ----------
  function buildGrowth() {
    const st = window.INK_SAVE.load();
    $('#growth-qi').textContent = '当前文气：' + st.growth.qi;
    const box = $('#growth-list');
    box.innerHTML = '';
    const sts = window.INK_GROWTH.statsOf(st);
    for (const up of window.INK_GROWTH.UPGRADES) {
      const lv = st.growth.levels[up.id] || 1;
      const cost = window.INK_GROWTH.costOf(up, lv);
      const maxed = lv >= up.max;
      const item = document.createElement('div');
      item.className = 'growth-item';
      item.innerHTML = '<div class="gi-name">' + up.name + ' <span class="gi-lv">Lv.' + lv + '/' + up.max + '</span></div>' +
        '<div class="gi-desc">' + up.desc + '</div>' +
        '<div class="gi-cur">当前：' + (up.id === 'power' ? '伤害 ' + sts.power : up.id === 'crit' ? '暴击 ' + Math.round(sts.critChance * 100) + '%' : up.id === 'pool' ? '砚血 ' + sts.maxHp : '文气 ×' + sts.qiMul) + '</div>' +
        '<button class="btn gi-btn" ' + (maxed ? 'disabled' : '') + '>' + (maxed ? '已满级' : '升级 ' + cost + ' 文气') + '</button>';
      const btn = item.querySelector('.gi-btn');
      btn.onclick = () => {
        const r = window.INK_GROWTH.buy(st, up.id);
        if (r.ok) {
          window.INK_SAVE.save();
          showToast(up.name + ' 升至 Lv.' + r.level);
          buildGrowth();
        } else {
          showToast(r.reason || '无法升级');
        }
      };
      if (!maxed && st.growth.qi < cost) btn.classList.add('cant');
      box.appendChild(item);
    }
  }

  // ---------- 成就 ----------
  function buildAchievements() {
    const st = window.INK_SAVE.load();
    const box = $('#ach-list');
    box.innerHTML = '';
    for (const a of window.INK_ACHIEVEMENTS.ACHIEVEMENTS) {
      const got = st.achievements.includes(a.id);
      const item = document.createElement('div');
      item.className = 'ach-item ' + (got ? 'got' : '');
      item.innerHTML = '<div class="ach-icon">' + a.icon + '</div>' +
        '<div class="ach-body"><div class="ach-name">' + a.name + '</div><div class="ach-desc">' + a.desc + '</div></div>' +
        '<div class="ach-state">' + (got ? '✓' : '·') + '</div>';
      box.appendChild(item);
    }
  }

  // ---------- 称号 ----------
  function titleOf(st) {
    const n = (st.achievements || []).length;
    if (n >= 23) return '承墨天人';
    if (n >= 19) return '墨战宗师';
    if (n >= 14) return '镇字之士';
    if (n >= 9) return '习字书生';
    if (n >= 4) return '初执笔生';
    return '无名书生';
  }

  // ---------- 文房四宝 ----------
  function buildEquip() {
    const st = window.INK_SAVE.load();
    const eq = st.equipment || {};
    $('#eq-qi').textContent = '文气 ' + st.growth.qi;
    // 四槽位
    const slotsEl = $('#eq-slots');
    slotsEl.innerHTML = '';
    for (const slot of window.INK_EQUIP.SLOTS) {
      const it = eq[slot];
      const card = document.createElement('div');
      card.className = 'eq-slot';
      if (it) {
        const r = window.INK_EQUIP.RARITY_MAP[it.rarity];
        card.style.borderColor = r.color;
        card.innerHTML = '<div class="eq-slot-name">' + window.INK_EQUIP.SLOT_CN[slot] + '</div>' +
          '<div class="eq-item-name" style="color:' + r.color + '">' + it.name + '</div>' +
          '<div class="eq-item-stat">' + window.INK_EQUIP.statText(it) + '</div>' +
          '<button class="btn btn-ghost eq-btn" data-act="unequip" data-slot="' + slot + '">卸下</button>';
      } else {
        card.innerHTML = '<div class="eq-slot-name">' + window.INK_EQUIP.SLOT_CN[slot] + '</div>' +
          '<div class="eq-empty">空</div><button class="btn btn-ghost eq-btn" disabled>—</button>';
      }
      slotsEl.appendChild(card);
    }
    // 背包
    const invEl = $('#eq-inventory');
    invEl.innerHTML = '';
    const inv = st.inventory || [];
    if (!inv.length) invEl.innerHTML = '<div class="empty-tip">背包空空如也——杀敌有几率掉落文房四宝</div>';
    for (const it of inv) {
      const r = window.INK_EQUIP.RARITY_MAP[it.rarity];
      const d = document.createElement('div');
      d.className = 'eq-inv-item';
      d.innerHTML = '<div class="eq-item-name" style="color:' + r.color + '">' + it.name + '</div>' +
        '<div class="eq-item-stat">' + window.INK_EQUIP.statText(it) + '</div>' +
        '<button class="btn btn-ghost eq-btn" data-act="equip" data-uid="' + it.uid + '">装备</button>';
      invEl.appendChild(d);
    }
    // 合成（每槽位）
    const craftEl = $('#eq-craft');
    craftEl.innerHTML = '';
    for (const slot of window.INK_EQUIP.SLOTS) {
      const items = inv.filter(i => i.slot === slot);
      const b = document.createElement('button');
      b.className = 'btn eq-btn';
      b.textContent = '合成·' + window.INK_EQUIP.SLOT_CN[slot] + '（' + items.length + '/3）→ 升一阶（100 文气）';
      b.disabled = items.length < 3 || st.growth.qi < 100;
      b.dataset.craft = slot;
      craftEl.appendChild(b);
    }
  }
  // 装备交互（事件委托）
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.act === 'unequip') {
      const r = window.INK_SAVE.unequipItem(t.dataset.slot);
      if (r.ok) { showToast('已卸下'); buildEquip(); } else showToast(r.reason);
    } else if (t.dataset.act === 'equip') {
      const r = window.INK_SAVE.equipItem(Number(t.dataset.uid));
      if (r.ok) { showToast('已装备'); buildEquip(); } else showToast(r.reason);
    } else if (t.dataset.craft) {
      const st = window.INK_SAVE.load();
      if (st.growth.qi < 100) { showToast('文气不足'); return; }
      const items = (st.inventory || []).filter(i => i.slot === t.dataset.craft);
      const r = window.INK_EQUIP.craftUpgrade(items);
      if (!r.ok) { showToast(r.reason); return; }
      st.growth.qi -= 100;
      st.inventory = st.inventory.filter(i => !r.consumed.includes(i.uid));
      st.inventory.push(r.item);
      st.stats.craftCount = (st.stats.craftCount || 0) + 1;
      window.INK_SAVE.save();
      window.INK_ACHIEVEMENTS.checkAll(st, a => showToast('成就达成：' + a.name));
      showToast('合成成功：「' + r.item.name + '」');
      buildEquip();
    }
  });

  // ---------- 出征纪 ----------
  function buildStats() {
    const st = window.INK_SAVE.load();
    const s = st.stats;
    const acc = (s.totalWritten + s.totalWrong) > 0 ? Math.round(s.totalWritten / (s.totalWritten + s.totalWrong) * 100) : 100;
    $('#stats-title').innerHTML = '<span class="st-title-name">' + st.name + '</span> <span class="st-title-tag">' + titleOf(st) + '</span>';
    const cards = [
      { k: '出征次数', v: s.runs || 0 }, { k: '累计杀敌', v: s.totalKills || 0 },
      { k: '最高连墨', v: s.maxComboEver || 0 }, { k: '完美笔法', v: s.totalPerfects || 0 },
      { k: '书写命中率', v: acc + '%' }, { k: '累计获得文气', v: s.totalQi || 0 },
      { k: '无尽最高层', v: s.bestEndless || 0 }, { k: '每日一墨', v: s.dailyDone || 0 },
      { k: '练习场次数', v: s.practiceSessions || 0 }, { k: '字库收集', v: st.gallery.chars.length + '/' + DICT.length },
      { k: '词语收集', v: st.gallery.words.length + '/' + WORDS.words2.length }, { k: '成语收集', v: st.gallery.idioms.length + '/' + WORDS.idioms.length },
      { k: '结局', v: (st.story.endings || []).length + '/6' }, { k: '成就', v: st.achievements.length + '/' + window.INK_ACHIEVEMENTS.ACHIEVEMENTS.length }
    ];
    const grid = $('#stats-grid');
    grid.innerHTML = '';
    for (const c of cards) {
      const d = document.createElement('div');
      d.className = 'stat-card';
      d.innerHTML = '<b>' + c.v + '</b><span>' + c.k + '</span>';
      grid.appendChild(d);
    }
    // 杀敌明细
    const KB_LABEL = { mote: '墨点', wrong: '错字妖', radical: '部首兽', word: '废词魔', idiom: '成语魇', 'boss:idiom_beast': 'Boss 成语魇', 'boss:calligrapher': 'Boss 大书法家', 'boss:oracle': 'Boss 甲骨文之灵', 'boss:inkdragon': 'Boss 墨龙' };
    const breakEl = $('#stats-killbreak');
    breakEl.innerHTML = '';
    const kbt = s.killByType || {};
    const maxK = Math.max(1, ...Object.values(kbt));
    for (const [key, label] of Object.entries(KB_LABEL)) {
      const v = kbt[key] || 0;
      const row = document.createElement('div');
      row.className = 'kb-row';
      row.innerHTML = '<span class="kb-label">' + label + '</span><div class="kb-track"><div class="kb-fill" style="width:' + (v / maxK * 100) + '%"></div></div><span class="kb-val">' + v + '</span>';
      breakEl.appendChild(row);
    }
    if (!Object.keys(kbt).length) breakEl.innerHTML = '<div class="empty-tip">尚无记录，快去出征！</div>';
  }

  // ---------- 报告 ----------
  function buildReport() {
    const st = window.INK_SAVE.load();
    const wrong = st.stats.wrongChars || [];
    const el = $('#report-body');
    if (!wrong.length) {
      el.innerHTML = '<div class="empty-tip">暂无错字记录。去打一场仗吧——写错的字都会记在这里。</div>';
      return;
    }
    const sorted = [...wrong].sort((a, b) => b.count - a.count);
    let html = '<table class="report-table"><thead><tr><th>字</th><th>拼音</th><th>释义</th><th>写错次数</th></tr></thead><tbody>';
    for (const w of sorted.slice(0, 30)) {
      const d = DICT.find(c => c.ch === w.ch);
      html += '<tr><td class="rt-char">' + w.ch + '</td><td>' + (d ? d.pinyin : '—') + '</td><td>' + (d ? d.meaning : '—') + '</td><td>' + w.count + '</td></tr>';
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  async function exportReport() {
    const st = window.INK_SAVE.load();
    const wrong = [...(st.stats.wrongChars || [])].sort((a, b) => b.count - a.count).slice(0, 30);
    const rows = wrong.map(w => {
      const d = DICT.find(c => c.ch === w.ch);
      return '<tr><td>' + w.ch + '</td><td>' + (d ? d.pinyin : '—') + '</td><td>' + (d ? d.meaning : '—') + '</td><td>' + w.count + '</td></tr>';
    }).join('');
    const html = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>汉字体检报告</title><style>body{font-family:"KaiTi",serif;background:#f6f1e3;color:#2a2018;padding:40px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #8a7a6a;padding:8px 12px}th{background:#e8dfc8}h1{text-align:center;border-bottom:3px double #8a2818;padding-bottom:10px}</style></head><body><h1>墨战 · 天书纪 — 汉字体检报告</h1><p>生成时间：' + new Date().toLocaleString('zh-CN') + '　｜　书生：' + st.name + '</p><p>总场次：' + st.stats.runs + '　累计杀敌：' + st.stats.totalKills + '　最高连击：' + st.stats.maxComboEver + '</p><table><thead><tr><th>字</th><th>拼音</th><th>释义</th><th>写错次数</th></tr></thead><tbody>' + rows + '</tbody></table><p style="margin-top:20px;color:#7a6a5a">建议：对着这些字多写几遍，然后回到《墨战》里用它们杀敌——记忆最牢的字，是打过仗的字。</p></body></html>';
    try {
      const res = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'report', filename: '汉字体检报告-' + Date.now() + '.html', content: html })
      });
      const data = await res.json();
      if (data.ok) {
        st.stats.reportCount = (st.stats.reportCount || 0) + 1;
        window.INK_SAVE.save();
        window.INK_ACHIEVEMENTS.checkAll(st, a => showToast('成就达成：' + a.name));
        showToast('报告已导出到磁盘：' + data.path);
      }
    } catch (e) {
      // 后端不可用：本地下载兜底
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '汉字体检报告.html';
      a.click();
      showToast('后端未启动，已改为本地下载');
    }
  }

  async function genPractice() {
    try {
      const res = await fetch('/api/practice?count=12');
      const data = await res.json();
      if (data.ok) {
        const st = window.INK_SAVE.load();
        st.stats.practiceCount = (st.stats.practiceCount || 0) + 1;
        window.INK_SAVE.save();
        window.INK_ACHIEVEMENTS.checkAll(st, a => showToast('成就达成：' + a.name));
        showToast('练习字帖已生成：' + data.path);
      }
    } catch (e) {
      showToast('需要启动后端（start.bat）才能生成字帖文件');
    }
  }

  // ---------- 设置 ----------
  function buildSettings() {
    const st = window.INK_SAVE.load();
    $('#set-name').value = st.name;
    $('#set-volume').value = st.settings.volume;
    $('#set-threshold').value = st.settings.threshold;
    $('#set-perfect').value = st.settings.perfectTh || 0.5;
    $('#set-vol-label').textContent = '音量 ' + Math.round(st.settings.volume * 100) + '%';
    $('#set-th-label').textContent = '识别灵敏度 ' + Math.round(st.settings.threshold * 100) + '%（越低越易识别，也越易误判）';
    $('#set-pf-label').textContent = '完美判定 ' + Math.round((st.settings.perfectTh || 0.5) * 100) + '%（得分高于此即「笔笔生花」）';
  }
  // 存档备份
  const seBtn = $('#save-export');
  if (seBtn) seBtn.addEventListener('click', async () => {
    const st = window.INK_SAVE.load();
    const json = JSON.stringify(st, null, 2);
    try {
      const res = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'export', filename: 'ink-saga-save-' + Date.now() + '.json', content: json })
      });
      const data = await res.json();
      if (data.ok) showToast('存档已导出：' + data.path);
    } catch (e) {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ink-saga-save.json';
      a.click();
      showToast('后端未启动，已改为本地下载');
    }
  });
  const siBtn = $('#save-import');
  if (siBtn) siBtn.addEventListener('click', () => { const f = $('#save-import-file'); if (f) f.click(); });
  const siFile = $('#save-import-file');
  if (siFile) siFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || data.version !== 1) { showToast('不是有效的墨战存档'); return; }
        const cur = window.INK_SAVE.load();
        const merged = Object.assign(window.INK_SAVE.defaultState(), data);
        merged.growth = Object.assign(cur.growth, data.growth || {});
        merged.stats = Object.assign(cur.stats, data.stats || {});
        merged.story = Object.assign(cur.story, data.story || {});
        merged.gallery = Object.assign(cur.gallery, data.gallery || {});
        merged.achievements = [...new Set([...(cur.achievements || []), ...(data.achievements || [])])];
        // 注入合并后的状态（save.js 的 load 引用内部 state，这里直接覆盖缓存）
        window.INK_SAVE._inject && window.INK_SAVE._inject(merged);
        localStorage.setItem('ink_saga_save_v1', JSON.stringify(merged));
        fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) }).catch(() => {});
        showToast('存档已导入');
        buildMenu();
      } catch (err) {
        showToast('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
    $('#set-name').addEventListener('change', (e) => { const st = window.INK_SAVE.load(); st.name = e.target.value || '无名书生'; window.INK_SAVE.save(); });
  $('#set-volume').addEventListener('input', (e) => { const st = window.INK_SAVE.load(); st.settings.volume = Number(e.target.value); AUDIO.setEnabled(st.settings.volume > 0); $('#set-vol-label').textContent = '音量 ' + Math.round(st.settings.volume * 100) + '%'; window.INK_SAVE.save(); });
  $('#set-threshold').addEventListener('input', (e) => { const st = window.INK_SAVE.load(); st.settings.threshold = Number(e.target.value); $('#set-th-label').textContent = '识别灵敏度 ' + Math.round(st.settings.threshold * 100) + '%'; window.INK_SAVE.save(); });
  $('#set-perfect').addEventListener('input', (e) => { const st = window.INK_SAVE.load(); st.settings.perfectTh = Number(e.target.value); $('#set-pf-label').textContent = '完美判定 ' + Math.round(st.settings.perfectTh * 100) + '%（得分高于此即「笔笔生花」）'; window.INK_SAVE.save(); });

  // ---------- 书法练习场 ----------
  let practice = null;
  function openPractice() {
    if (practice) { practice.destroy(); practice = null; }
    showScreen('practice');
    const canvas = $('#practice-canvas');
    practice = new window.INK_PRACTICE.Practice({
      canvas,
      dict: DICT,
      verdictEl: $('#practice-verdict'),
      onUpdate: () => {}
    });
    const st = window.INK_SAVE.load();
    $('#practice-total').textContent = st.stats.practiceSessions || 0;
    practice.randomTarget();
    requestAnimationFrame((ts) => practice.loop(ts));
  }
  function buildPicker() {
    const grid = $('#picker-grid');
    if (grid.dataset.built) return;
    grid.dataset.built = '1';
    for (const c of DICT) {
      const b = document.createElement('button');
      b.className = 'picker-cell';
      b.textContent = c.ch;
      b.title = c.pinyin + ' · ' + c.meaning;
      b.onclick = () => {
        if (practice) practice.setTarget(c.ch);
        closeModal('picker-modal');
      };
      grid.appendChild(b);
    }
  }

  // ---------- 挥毫疾书 ----------
  let ta = null;
  function startTimeAttack() {
    if (ta) { ta.destroy(); ta = null; }
    showScreen('timeattack');
    const canvas = $('#ta-canvas');
    ta = new window.INK_TIMEATTACK.TimeAttack({
      canvas,
      dict: DICT,
      onHud: (h) => {
        const te = $('#ta-time'); if (te) te.textContent = h.time + 's';
        const se = $('#ta-score'); if (se) se.textContent = '墨迹 ' + h.score;
        const ce = $('#ta-combo'); if (ce) ce.textContent = h.combo > 1 ? h.combo + ' 连墨' : '';
        const xe = $('#ta-correct'); if (xe) xe.textContent = '写对 ' + h.correct + ' · 失误 ' + h.wrong;
        const tg = $('#ta-target'); if (tg) tg.textContent = h.target || '';
        const py = $('#ta-pinyin'); if (py) py.textContent = h.pinyin || '';
      },
      onEnd: (r) => {
        const st = window.INK_SAVE.load();
        const reward = Math.round(r.score / 10);
        st.growth.qi += reward;
        if (r.score > (st.stats.taBest || 0)) { st.stats.taBest = r.score; window.INK_SAVE.save(); showToast('新纪录！墨迹 ' + r.score); }
        st.stats.taRuns = (st.stats.taRuns || 0) + 1;
        window.INK_SAVE.save();
        window.INK_ACHIEVEMENTS.checkAll(st, a => showToast('成就达成：' + a.name));
        // 结算
        $('#result-title').textContent = '挥毫疾书 · 结算';
        $('#rl-kills').textContent = '写对';
        $('#rl-combo').textContent = '最高连墨';
        $('#rl-perfect').textContent = '得分';
        $('#rl-wrong').textContent = '失误';
        $('#rl-qi').textContent = '奖励文气';
        $('#rl-score').textContent = '最佳纪录';
        $('#rl-time').textContent = '时长';
        $('#result-kills').textContent = r.correct;
        $('#result-combo').textContent = r.maxCombo;
        $('#result-perfect').textContent = r.score;
        $('#result-wrong').textContent = r.wrong;
        $('#result-qi').textContent = reward;
        $('#result-score').textContent = '最佳 ' + (st.stats.taBest || 0);
        $('#result-time').textContent = '60s';
        $('#result-continue').textContent = '回到菜单';
        $('#result-continue').onclick = () => { closeModal('result-modal'); ta = null; showScreen('menu'); buildMenu(); };
        $('#result-board').style.display = 'none';
        openModal('result-modal');
      }
    });
    requestAnimationFrame((ts) => ta.loop(ts));
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- 按钮绑定 ----------
  function bindNav() {
    const nav = {
      'nav-story': () => { buildStoryMenu(); showScreen('story'); },
      'nav-endless': () => { showScreen('endless'); renderLeaderboard($('#endless-board'), -1, 0); },
      'nav-gallery': () => { buildGallery(); showScreen('gallery'); },
      'nav-growth': () => { buildGrowth(); showScreen('growth'); },
      'nav-achievements': () => { buildAchievements(); showScreen('achievements'); },
      'nav-report': () => { buildReport(); showScreen('report'); },
      'nav-settings': () => { buildSettings(); showScreen('settings'); },
      'nav-menu': () => { showScreen('menu'); buildMenu(); },
      'nav-menu2': () => { showScreen('menu'); buildMenu(); },
      'practice-back': () => { if (practice) { practice.destroy(); practice = null; } showScreen('menu'); buildMenu(); },
      'nav-gallery-back': () => { showScreen('menu'); buildMenu(); },
      'nav-growth-back': () => { showScreen('menu'); buildMenu(); },
      'nav-ach-back': () => { showScreen('menu'); buildMenu(); },
      'nav-report-back': () => { showScreen('menu'); buildMenu(); },
      'nav-settings-back': () => { showScreen('menu'); buildMenu(); },
      'nav-stats-back': () => { showScreen('menu'); buildMenu(); }
    };
    for (const [id, fn] of Object.entries(nav)) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { initAudio(); fn(); });
    }
    // 菜单主按钮
    const menuBtns = {
      'menu-story': () => { initAudio(); buildStoryMenu(); showScreen('story'); },
      'menu-endless': () => { initAudio(); startEndless(); },
      'menu-daily': () => { initAudio(); startDaily(); },
      'menu-practice': () => { initAudio(); openPractice(); },
      'menu-stats': () => { initAudio(); buildStats(); showScreen('stats'); },
      'menu-equip': () => { initAudio(); buildEquip(); showScreen('equip'); },
      'nav-equip-back': () => { showScreen('menu'); buildMenu(); },
      'menu-timeattack': () => { initAudio(); startTimeAttack(); },
      'menu-gallery': () => { initAudio(); buildGallery(); showScreen('gallery'); },
      'menu-growth': () => { initAudio(); buildGrowth(); showScreen('growth'); },
      'menu-achievements': () => { initAudio(); buildAchievements(); showScreen('achievements'); },
      'menu-report': () => { initAudio(); buildReport(); showScreen('report'); },
      'menu-settings': () => { initAudio(); buildSettings(); showScreen('settings'); },
      'menu-export-report': () => { initAudio(); exportReport(); },
      'menu-practice': () => { initAudio(); genPractice(); }
    };
    for (const [id, fn] of Object.entries(menuBtns)) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }
    // 练习场交互
    const pr = $('#practice-rand');
    if (pr) pr.addEventListener('click', () => { if (practice) practice.randomTarget(); });
    const pp = $('#practice-pick');
    if (pp) pp.addEventListener('click', () => { buildPicker(); openModal('picker-modal'); });
    const pc = $('#picker-close');
    if (pc) pc.addEventListener('click', () => closeModal('picker-modal'));
    // 限时模式退场
    const taq = $('#ta-quit');
    if (taq) taq.addEventListener('click', () => { if (ta) { ta.destroy(); ta = null; } showScreen('menu'); buildMenu(); });
    // 战斗退出
    $('#battle-quit').addEventListener('click', () => {
      if (battle) { battle.destroy(); battle = null; }
      showScreen('menu'); buildMenu();
    });
    // 战斗暂停
    const pauseBtn = $('#battle-pause');
    function togglePause() {
      if (!battle || battle.state !== 'running') return;
      const p = !battle.paused;
      battle.setPaused(p);
      $('#pause-overlay').classList.toggle('open', p);
      pauseBtn.textContent = p ? '▶ 继续' : '⏸ 暂停';
    }
    pauseBtn.addEventListener('click', togglePause);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (battle && battle.state === 'running') togglePause();
      }
    });
    // 战斗提示
    $('#hud-help').addEventListener('click', () => {
      openModal('help-modal');
    });
    $('#help-close').addEventListener('click', () => closeModal('help-modal'));
    // 开局导引
    $('#guide-start').addEventListener('click', () => { closeModal('guide-modal'); initAudio(); });
  }

  // 暴露给内联 onclick 的入口
  window.INK_START_ENDLESS = startEndless;
  window.INK_EXPORT_REPORT = exportReport;
  window.INK_GEN_PRACTICE = genPractice;

  // ---------- 启动 ----------
  window.addEventListener('load', () => {
    const st = window.INK_SAVE.load();
    AUDIO.setEnabled(st.settings.volume > 0);
    bindNav();
    buildMenu();
    showScreen('menu');
    openModal('guide-modal');
  });
})();
