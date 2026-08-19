// 墨战 · 天书纪 — 字诀系统：汉字元素 → 战斗效果
(function (g) {
  'use strict';

  // 元素 → 效果函数。ctx: {enemy, player, enemies, fx, audio}
  const EFFECTS = {
    fire:   { dmg: 1.35, label: '烈焰焚身', apply(ctx) { ctx.enemy.burn = Math.max(ctx.enemy.burn || 0, 3); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '焚', '#e2571a'); ctx.audio.thunder && ctx.audio.splat(0.5); } },
    water:  { dmg: 0.9, label: '寒水缓行', apply(ctx) { ctx.enemy.slow = Math.max(ctx.enemy.slow || 0, 2.5); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '缓', '#2f6fd0'); } },
    wood:   { dmg: 1.0, label: '生机滋长', apply(ctx) { ctx.player.qiBonus = (ctx.player.qiBonus || 0) + 5; ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '生', '#3e8e3a'); } },
    metal:  { dmg: 1.25, label: '金戈锐气', apply(ctx) { ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '锐', '#9aa0a8'); } },
    earth:  { dmg: 1.05, label: '镇地一击', apply(ctx) { ctx.enemy.stun = Math.max(ctx.enemy.stun || 0, 1.2); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '镇', '#8a6239'); } },
    thunder:{ dmg: 1.2, label: '雷霆链击', apply(ctx) { ctx.audio.thunder(); ctx.fx.lightning(ctx.enemy.x, ctx.enemy.y); const chain = ctx.enemies.filter(e => e !== ctx.enemy && Math.hypot(e.x - ctx.enemy.x, e.y - ctx.enemy.y) < 260 && e.hp > 0).slice(0, 3); for (const e of chain) { e.hp -= ctx.dmg * 0.6; ctx.fx.addText(e.x, e.y - e.r, '链', '#e0b400'); } } },
    wind:   { dmg: 1.0, label: '疾风推送', apply(ctx) { ctx.enemy.x += 55; ctx.enemy.stun = Math.max(ctx.enemy.stun || 0, 0.4); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '疾', '#2ea8a0'); } },
    light:  { dmg: 1.2, label: '明光破暗', apply(ctx) { if (ctx.enemy.el === 'dark') ctx.dmg *= 1.5; ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + 4); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '明', '#f5e27a'); } },
    dark:   { dmg: 1.15, label: '墨噬返还', apply(ctx) { ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + ctx.dmg * 0.15); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '噬', '#6b4a8a'); } },
    heart:  { dmg: 0.6, label: '仁心回春', apply(ctx) { ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + 10); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '愈', '#d85f8a'); ctx.audio.heal(); } },
    shield: { dmg: 0.8, label: '墨盾护体', apply(ctx) { ctx.player.shield = Math.min(60, (ctx.player.shield || 0) + 25); ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '盾', '#c9c9d8'); ctx.audio.shield(); } },
    blade:  { dmg: 1.15, label: '兵戈之威', apply(ctx) { ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '兵', '#c03333'); } },
    void:   { dmg: 0.9, label: '文气纵横', apply(ctx) { ctx.player.qiBonus = (ctx.player.qiBonus || 0) + 10; ctx.fx.addText(ctx.enemy.x, ctx.enemy.y - ctx.enemy.r, '文', '#3a3a3a'); } }
  };

  // 敌人元素弱点：火克木克土克水克火；雷克风；光克暗；金克土
  const WEAKNESS = {
    fire: 'wood', water: 'fire', wood: 'earth', metal: 'earth', earth: 'water',
    thunder: 'wind', wind: 'earth', light: 'dark', dark: 'light'
  };

  function elementMult(attackEl, enemyEl) {
    if (!attackEl || !enemyEl) return 1;
    if (WEAKNESS[attackEl] === enemyEl) return 1.6;   // 克制
    if (WEAKNESS[enemyEl] === attackEl) return 0.6;   // 被克
    if (attackEl === enemyEl) return 0.8;
    return 1;
  }

  g.INK_SPELLS = { EFFECTS, WEAKNESS, elementMult };
})(typeof globalThis !== 'undefined' ? globalThis : this);
