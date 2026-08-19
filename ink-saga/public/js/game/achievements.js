// 墨战 · 天书纪 — 成就系统（达成自动发放文气奖励）
(function (g) {
  'use strict';

  const REWARDS = {
    first_blood: 30, combo10: 40, combo30: 80, perfect10: 50,
    slayer_mote: 50, slayer_idiom: 80,
    boss1: 100, boss2: 100, boss3: 100, boss4: 120,
    story_clear: 120, end_hengmo: 60, end_zhenmo: 60, end_fenshu: 60, end_guiyin: 60, end_wenyin: 80,
    endless10: 60, endless20: 120, gallery50: 60, gallery100: 120,
    practice: 40, report: 40,
    combo50: 120, endless30: 200, practice50: 60, daily1: 80, endings_all: 150,
    ta300: 80, taRuns10: 50,
    slayer_mimic: 90, slayer_poem: 110, slayer_pen: 100, slayer_inkchild: 70,
    boss5: 120, boss6: 140, equip_first: 50, equip_gold: 150, equip_full: 130,
    craft_once: 60, inv10: 80, gallery200: 120, gallery250: 150,
    words50: 80, idioms50: 80, poem5: 60, daily7: 200, ta500: 120,
    endless50: 250, all_max: 300
  };
  const rewardOf = (id) => REWARDS[id] || 30;

  const ACHIEVEMENTS = [
    { id: 'first_blood', name: '初战告捷', desc: '消灭第一个敌人', icon: '斩', cond: s => (s.stats.totalKills || 0) >= 1 },
    { id: 'combo10', name: '十连墨', desc: '连击达到 10', icon: '墨', cond: s => (s.stats.maxComboEver || 0) >= 10 },
    { id: 'combo30', name: '三十连墨', desc: '连击达到 30', icon: '锋', cond: s => (s.stats.maxComboEver || 0) >= 30 },
    { id: 'perfect10', name: '笔笔生花', desc: '累计 10 次完美书写', icon: '花', cond: s => (s.stats.totalPerfects || 0) >= 10 },
    { id: 'slayer_mote', name: '墨点克星', desc: '消灭 50 个墨点', icon: '点', cond: s => (s.stats.killMote || 0) >= 50 },
    { id: 'slayer_idiom', name: '成语破魇', desc: '消灭 15 只成语魇', icon: '魇', cond: s => (s.stats.killIdiom || 0) >= 15 },
    { id: 'boss1', name: '伏魇', desc: '击败成语魇（Boss）', icon: '魇', cond: s => (s.stats.bosses || []).includes('idiom_beast') },
    { id: 'boss2', name: '破铁', desc: '击败大书法家（Boss）', icon: '铁', cond: s => (s.stats.bosses || []).includes('calligrapher') },
    { id: 'boss3', name: '问骨', desc: '击败甲骨文之灵（Boss）', icon: '骨', cond: s => (s.stats.bosses || []).includes('oracle') },
    { id: 'boss4', name: '镇龙', desc: '击败墨龙（Boss）', icon: '龙', cond: s => (s.stats.bosses || []).includes('inkdragon') },
    { id: 'story_clear', name: '天书纪', desc: '通关剧情模式', icon: '书', cond: s => !!(s.story && s.story.finished) },
    { id: 'end_hengmo', name: '承墨者', desc: '达成结局：承墨者', icon: '人', cond: s => ((s.story && s.story.endings) || []).includes('hengmo') },
    { id: 'end_zhenmo', name: '镇墨者', desc: '达成结局：镇墨者', icon: '封', cond: s => ((s.story && s.story.endings) || []).includes('zhenmo') },
    { id: 'end_fenshu', name: '焚书者', desc: '达成结局：焚书者', icon: '墨', cond: s => ((s.story && s.story.endings) || []).includes('fenshu') },
    { id: 'end_guiyin', name: '归隐者', desc: '达成结局：归隐者', icon: '归', cond: s => ((s.story && s.story.endings) || []).includes('guiyin') },
    { id: 'end_wenyin', name: '问天者', desc: '达成结局：问天者（隐藏）', icon: '文', cond: s => ((s.story && s.story.endings) || []).includes('wenyin') },
    { id: 'endless10', name: '十层墨海', desc: '无尽模式到达第 10 层', icon: '海', cond: s => (s.stats.bestEndless || 0) >= 10 },
    { id: 'endless20', name: '二十层墨渊', desc: '无尽模式到达第 20 层', icon: '渊', cond: s => (s.stats.bestEndless || 0) >= 20 },
    { id: 'gallery50', name: '藏书五十', desc: '字库图鉴收集 50 字', icon: '藏', cond: s => (s.gallery && s.gallery.chars ? s.gallery.chars.length : 0) >= 50 },
    { id: 'gallery100', name: '藏书百卷', desc: '字库图鉴收集 100 字', icon: '库', cond: s => (s.gallery && s.gallery.chars ? s.gallery.chars.length : 0) >= 100 },
    { id: 'practice', name: '出口成章', desc: '生成一次练习字帖', icon: '帖', cond: s => (s.stats.practiceCount || 0) >= 1 },
    { id: 'report', name: '自查其身', desc: '导出一份汉字体检报告', icon: '检', cond: s => (s.stats.reportCount || 0) >= 1 },
    { id: 'combo50', name: '五十连墨', desc: '连击达到 50', icon: '墨', cond: s => (s.stats.maxComboEver || 0) >= 50 },
    { id: 'endless30', name: '三十层墨渊', desc: '无尽模式到达第 30 层', icon: '渊', cond: s => (s.stats.bestEndless || 0) >= 30 },
    { id: 'practice50', name: '习字成痴', desc: '书法练习场累计 50 次', icon: '练', cond: s => (s.stats.practiceSessions || 0) >= 50 },
    { id: 'daily1', name: '每日一墨', desc: '完成一次每日一墨挑战', icon: '日', cond: s => (s.stats.dailyDone || 0) >= 1 },
    { id: 'endings_all', name: '天书全集', desc: '收集全部结局', icon: '全', cond: s => ((s.story && s.story.endings) || []).length >= 5 },
    { id: 'ta300', name: '疾书三百', desc: '挥毫疾书单局得分 ≥ 300', icon: '疾', cond: s => (s.stats.taBest || 0) >= 300 },
    { id: 'taRuns10', name: '挥毫十次', desc: '挥毫疾书累计 10 局', icon: '毫', cond: s => (s.stats.taRuns || 0) >= 10 },
    { id: 'slayer_mimic', name: '破傀', desc: '消灭 20 只墨傀', icon: '傀', cond: s => ((s.stats.killByType || {}).mimic || 0) >= 20 },
    { id: 'slayer_poem', name: '诗句成锋', desc: '消灭 10 只诗魔', icon: '诗', cond: s => ((s.stats.killByType || {}).poem || 0) >= 10 },
    { id: 'slayer_pen', name: '笔妖克星', desc: '在笔妖写完前消灭 15 只', icon: '笔', cond: s => ((s.stats.killByType || {}).pen || 0) >= 15 },
    { id: 'slayer_inkchild', name: '墨童收割', desc: '消灭 60 只墨童', icon: '童', cond: s => ((s.stats.killByType || {}).inkchild || 0) >= 60 },
    { id: 'boss5', name: '镇纸', desc: '击败镇纸兽（Boss）', icon: '镇', cond: s => (s.stats.bosses || []).includes('zhenzhi') },
    { id: 'boss6', name: '伏仙', desc: '击败落笔仙（Boss）', icon: '仙', cond: s => (s.stats.bosses || []).includes('luobi') },
    { id: 'equip_first', name: '如虎添翼', desc: '装备第一件文房四宝', icon: '翼', cond: s => !!(s.equipment && (s.equipment.pen || s.equipment.ink || s.equipment.paper || s.equipment.stone)) },
    { id: 'equip_gold', name: '圣品在身', desc: '装备一件圣品装备', icon: '圣', cond: s => { const eq = s.equipment || {}; return Object.values(eq).some(i => i && i.rarity === 'gold'); } },
    { id: 'equip_full', name: '四宝齐备', desc: '四个槽位全部装备', icon: '宝', cond: s => { const eq = s.equipment || {}; return eq.pen && eq.ink && eq.paper && eq.stone; } },
    { id: 'craft_once', name: '化三为一', desc: '合成成功一次装备', icon: '合', cond: s => (s.stats.craftCount || 0) >= 1 },
    { id: 'inv10', name: '宝库充盈', desc: '背包同时持有 10 件装备', icon: '库', cond: s => (s.inventory || []).length >= 10 },
    { id: 'gallery200', name: '藏书二百', desc: '字库图鉴收集 200 字', icon: '典', cond: s => (s.gallery && s.gallery.chars ? s.gallery.chars.length : 0) >= 200 },
    { id: 'gallery250', name: '藏书二百五', desc: '字库图鉴收集 250 字', icon: '籍', cond: s => (s.gallery && s.gallery.chars ? s.gallery.chars.length : 0) >= 250 },
    { id: 'words50', name: '词海拾贝', desc: '收集 50 个双字词', icon: '词', cond: s => (s.gallery && s.gallery.words ? s.gallery.words.length : 0) >= 50 },
    { id: 'idioms50', name: '成语满仓', desc: '收集 50 个成语', icon: '成', cond: s => (s.gallery && s.gallery.idioms ? s.gallery.idioms.length : 0) >= 50 },
    { id: 'poem5', name: '诗中圣手', desc: '击溃 5 只诗魔', icon: '咏', cond: s => ((s.stats.killByType || {}).poem || 0) >= 5 },
    { id: 'daily7', name: '七日墨火', desc: '每日一墨连胜 7 天', icon: '七', cond: s => (s.stats.dailyStreak || 0) >= 7 },
    { id: 'ta500', name: '疾书五百', desc: '挥毫疾书单局得分 ≥ 500', icon: '速', cond: s => (s.stats.taBest || 0) >= 500 },
    { id: 'endless50', name: '五十层墨狱', desc: '无尽模式到达第 50 层', icon: '狱', cond: s => (s.stats.bestEndless || 0) >= 50 },
    { id: 'all_max', name: '登峰造极', desc: '全部修炼升至满级', icon: '峰', cond: s => { const lv = s.growth && s.growth.levels; if (!lv) return false; const max = { power: 8, crit: 8, pool: 8, qi: 5, combo: 5, boss: 5 }; return Object.entries(max).every(([k, m]) => (lv[k] || 1) >= m); } }
  ];

  function checkAll(state, newAchieved) {
    for (const a of ACHIEVEMENTS) {
      if (state.achievements.includes(a.id)) continue;
      if (a.cond(state)) {
        state.achievements.push(a.id);
        if (!state.growth) state.growth = { qi: 0, levels: { power: 1, crit: 1, pool: 1, qi: 1 }, spendTotal: 0 };
        const rw = rewardOf(a.id);
        state.growth.qi = (state.growth.qi || 0) + rw;
        if (newAchieved) newAchieved(a, rw);
      }
    }
  }

  g.INK_ACHIEVEMENTS = { ACHIEVEMENTS, checkAll, rewardOf };
})(typeof globalThis !== 'undefined' ? globalThis : this);
