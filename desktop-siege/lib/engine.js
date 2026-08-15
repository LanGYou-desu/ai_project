(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'));
  else root.DS_ENGINE = factory(root.DS_RNG);
})(typeof self !== 'undefined' ? self : this, function (rngModule) {
'use strict';
// 桌面保卫战 · 纯逻辑游戏引擎（无 DOM 依赖，可 headless 测试）
const { createRng } = rngModule;

const ARENA = { w: 1600, h: 1000 };

const CLASS_STATS = {
  fodder:   { hp: 24,  speed: 58,  radius: 15, score: 10, contactDmg: 10 },
  rusher:   { hp: 15,  speed: 150, radius: 12, score: 15, contactDmg: 12 },
  tank:     { hp: 150, speed: 36,  radius: 26, score: 40, contactDmg: 18 },
  splitter: { hp: 48,  speed: 72,  radius: 18, score: 25, contactDmg: 12 },
  swarm:    { hp: 8,   speed: 138, radius: 8,  score: 8,  contactDmg: 8 },
  healer:   { hp: 70,  speed: 62,  radius: 20, score: 35, contactDmg: 12 },
  shard:    { hp: 12,  speed: 165, radius: 7,  score: 5,  contactDmg: 6 },
  boss:     { hp: 1500, speed: 42, radius: 58, score: 500, contactDmg: 30 }
};

const POWERUP_KINDS = ['rapid', 'spread', 'shield', 'heal', 'freeze', 'pierce'];

class GameEngine {
  constructor(opts) {
    this.opts = opts || {};
    this.seed = this.opts.seed !== undefined ? this.opts.seed : 20810719;
    this.wavesData = this.opts.waves || [];
    this.endlessWaveGen = this.opts.endlessWaveGen || null;
    this.rng = createRng(this.seed);
    this.onEvent = this.opts.onEvent || function () {};
    this.reset();
  }

  reset() {
    this.player = {
      x: ARENA.w / 2, y: ARENA.h / 2, radius: 16,
      hp: 100, maxHp: 100, shield: 0, maxShield: 60,
      speed: 260, fireRate: 0.16, fireCd: 0, damage: 12, bulletSpeed: 560,
      aimX: 1, aimY: 0, invuln: 0, alive: true
    };
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.bossProjectiles = [];
    this.boss = null;
    this.waveIndex = -1;
    this.currentWave = null;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1.0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.kills = 0;
    this.time = 0;
    this.freeze = 0;
    this.gameOver = false;
    this.ended = false;
    this.endless = false;
    this.waveState = 'idle';
    this.bannerTimer = 0;
    this.power = { rapid: 0, spread: 0, shield: 0, freeze: 0, pierce: 0 };
    this.stats = { wavesCleared: 0, maxCombo: 0, damageDealt: 0 };
    this.nextWave();
    return this;
  }

  waveNum() { return this.waveIndex + 1; }

  nextWave() {
    this.waveIndex++;
    const idx = this.waveIndex;
    if (idx < this.wavesData.length) {
      const data = this.wavesData[idx];
      this.currentWave = data;
      this.spawnQueue = data.enemies.slice();
      this.spawnInterval = Math.max(0.3, 1.05 - idx * 0.03);
      this.waveState = 'banner';
      this.bannerTimer = data.boss ? 3.2 : 2.2;
      this.onEvent({ type: 'waveStart', num: data.num, boss: data.boss, bossName: data.bossName || null, theme: data.theme });
    } else {
      this.endless = true;
      const round = idx - this.wavesData.length + 1;
      let data = null;
      if (this.endlessWaveGen) data = this.endlessWaveGen(round);
      else data = { num: idx + 1, theme: 'mixed', boss: false, enemies: this.currentWave ? this.currentWave.enemies.slice() : [] };
      this.currentWave = data;
      this.spawnQueue = data.enemies.slice();
      this.spawnInterval = 0.5;
      this.waveState = 'banner';
      this.bannerTimer = 2.0;
      this.onEvent({ type: 'waveStart', num: data.num, boss: data.boss, bossName: data.bossName || null, theme: data.theme });
    }
  }

  spawnX() {
    const side = this.rng.int(0, 1);
    return side === 0 ? -50 : ARENA.w + 50;
  }
  spawnY() { return this.rng.int(80, ARENA.h - 80); }

  spawnEnemy(spec) {
    const st = CLASS_STATS[spec.cls] || CLASS_STATS.fodder;
    const w = this.waveNum();
    const hpMul = 1 + (w - 1) * 0.14;
    const spdMul = 1 + (w - 1) * 0.02;
    const e = {
      id: spec.id || 'e-' + this.rng.int(10000, 99999),
      cls: spec.cls,
      name: spec.name,
      x: this.spawnX(),
      y: this.spawnY(),
      hp: Math.round(st.hp * hpMul),
      maxHp: Math.round(st.hp * hpMul),
      speed: st.speed * spdMul,
      radius: st.radius,
      score: st.score,
      contactDmg: st.contactDmg,
      fireCd: 0,
      hitFlash: 0
    };
    if (spec.cls === 'boss') {
      e.hp = Math.round(st.hp * (1 + w * 0.32));
      e.maxHp = e.hp;
      e.contactDmg = 35;
      e.fireCd = 1.8;
      this.boss = e;
    }
    this.enemies.push(e);
    return e;
  }

  makeShard(cls, name, x, y) {
    const st = CLASS_STATS[cls];
    return {
      id: 's-' + this.rng.int(100000, 999999),
      cls: cls, name: name, x: x, y: y,
      hp: st.hp, maxHp: st.hp, speed: st.speed, radius: st.radius,
      score: st.score, contactDmg: st.contactDmg, fireCd: 0, hitFlash: 0
    };
  }

  tick(dt, input) {
    input = input || {};
    if (this.gameOver || this.ended) return;
    dt = Math.max(0, Math.min(dt, 0.05));
    this.time += dt;

    if (this.waveState === 'banner') {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.waveState = 'spawning';
    }
    if (this.waveState === 'spawning' || this.waveState === 'active') {
      this.waveState = 'active';
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawnQueue.length) {
        this.spawnEnemy(this.spawnQueue.shift());
        this.spawnTimer = this.spawnInterval;
      }
    }

    if (this.freeze > 0) this.freeze -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    for (const k of ['rapid', 'spread', 'pierce']) {
      if (this.power[k] > 0) this.power[k] -= dt;
    }

    const p = this.player;
    if (p.alive) {
      let dx = 0, dy = 0;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
      if (dx || dy) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len; dy /= len;
        p.x += dx * p.speed * dt;
        p.y += dy * p.speed * dt;
      }
      p.x = Math.max(p.radius, Math.min(ARENA.w - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(ARENA.h - p.radius, p.y));
      if (input.aimX !== undefined && input.aimY !== undefined) {
        const adx = input.aimX - p.x;
        const ady = input.aimY - p.y;
        const alen = Math.sqrt(adx * adx + ady * ady);
        if (alen > 2) { p.aimX = adx / alen; p.aimY = ady / alen; }
      }
      p.fireCd -= dt;
      const rate = this.power.rapid > 0 ? p.fireRate * 0.55 : p.fireRate;
      if (input.firing && p.fireCd <= 0) {
        p.fireCd = rate;
        const shots = this.power.spread > 0 ? 3 : 1;
        const baseAng = Math.atan2(p.aimY, p.aimX);
        for (let i = 0; i < shots; i++) {
          const ang = baseAng + (shots > 1 ? (i - 1) * 0.26 : 0);
          this.bullets.push({
            x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20,
            vx: Math.cos(ang) * p.bulletSpeed, vy: Math.sin(ang) * p.bulletSpeed,
            damage: p.damage, pierce: this.power.pierce > 0 ? 2 : 0, life: 1.6
          });
        }
      }
      p.invuln = Math.max(0, p.invuln - dt);
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -30 || b.x > ARENA.w + 30 || b.y < -30 || b.y > ARENA.h + 30) {
        this.bullets.splice(i, 1);
        continue;
      }
      let shouldRemove = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const d2 = (e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y);
        const rr = e.radius + 7;
        if (d2 <= rr * rr) {
          this.damageEnemy(e, b.damage);
          if (b.pierce > 0) { b.pierce--; }
          else { shouldRemove = true; }
          break;
        }
      }
      if (shouldRemove) this.bullets.splice(i, 1);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      let spd = e.speed;
      if (e.cls === 'healer') {
        if (len < 260) spd = -e.speed * 0.7;
        else spd = e.speed;
        if (this.time % 1.0 < dt * 2) {
          let best = null;
          for (const o of this.enemies) {
            if (o === e || o.hp >= o.maxHp) continue;
            const od = (o.x - e.x) * (o.x - e.x) + (o.y - e.y) * (o.y - e.y);
            if (!best || od < best.d) best = { d: od, o: o };
          }
          if (best) best.o.hp = Math.min(best.o.maxHp, best.o.hp + 10);
        }
      } else if (e.cls === 'rusher') {
        spd *= 1.35;
      } else if (e.cls === 'boss') {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = 2.4;
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          const sx = Math.max(24, Math.min(ARENA.w - 24, e.x));
          const sy = Math.max(24, Math.min(ARENA.h - 24, e.y));
          for (let k = -2; k <= 2; k++) {
            const a = ang + k * 0.24;
            this.bossProjectiles.push({ x: sx, y: sy, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 9, life: 4.5 });
          }
        }
      }
      if (this.freeze > 0) spd *= 0.45;
      e.x += (dx / len) * spd * dt;
      e.y += (dy / len) * spd * dt;
      if (p.alive) {
        const rr = e.radius + p.radius;
        const d2 = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
        if (d2 <= rr * rr && p.invuln <= 0) {
          if (p.shield > 0) {
            const absorbed = Math.min(p.shield, e.contactDmg);
            p.shield -= absorbed;
            p.hp -= Math.max(0, e.contactDmg - absorbed);
          } else {
            p.hp -= e.contactDmg;
          }
          p.invuln = 0.8;
          this.onEvent({ type: 'playerHit', hp: p.hp });
          if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
            this.gameOver = true;
            this.onEvent({ type: 'gameOver', score: this.score, waves: this.stats.wavesCleared, kills: this.kills });
          }
        }
      }
    }

    for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
      const pr = this.bossProjectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || pr.x < -30 || pr.x > ARENA.w + 30 || pr.y < -30 || pr.y > ARENA.h + 30) {
        this.bossProjectiles.splice(i, 1);
        continue;
      }
      if (p.alive) {
        const d2 = (pr.x - p.x) * (pr.x - p.x) + (pr.y - p.y) * (pr.y - p.y);
        const rr = pr.r + p.radius;
        if (d2 <= rr * rr && p.invuln <= 0) {
          p.hp -= 14;
          p.invuln = 0.6;
          this.bossProjectiles.splice(i, 1);
          this.onEvent({ type: 'playerHit', hp: p.hp });
          if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
            this.gameOver = true;
            this.onEvent({ type: 'gameOver', score: this.score, waves: this.stats.wavesCleared, kills: this.kills });
          }
        }
      }
    }

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.ttl -= dt;
      if (pu.ttl <= 0) { this.powerups.splice(i, 1); continue; }
      if (p.alive) {
        const d2 = (pu.x - p.x) * (pu.x - p.x) + (pu.y - p.y) * (pu.y - p.y);
        if (d2 <= 30 * 30) {
          this.applyPowerup(pu.kind);
          this.onEvent({ type: 'powerup', kind: pu.kind });
          this.powerups.splice(i, 1);
        }
      }
    }

    if (this.waveState === 'active' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.stats.wavesCleared++;
      const bonus = 100 + this.waveNum() * 25;
      this.score += bonus;
      this.onEvent({ type: 'waveClear', num: this.currentWave ? this.currentWave.num : this.waveNum(), bonus: bonus });
      this.nextWave();
    }
  }

  damageEnemy(e, dmg) {
    if (!e || e.hp <= 0) return;
    e.hp -= dmg;
    e.hitFlash = 0.08;
    this.stats.damageDealt += dmg;
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.kills++;
    this.combo++;
    this.comboTimer = 3;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    const base = e.score || 10;
    this.score += Math.round(base * (1 + Math.min(this.combo, 10) * 0.1));
    if (e.cls === 'splitter') {
      for (let k = 0; k < 3; k++) {
        this.enemies.push(this.makeShard('shard', e.name + '·碎片', e.x + (k - 1) * 22, e.y + (k % 2 ? 14 : -14)));
      }
    }
    if (e.cls === 'boss') {
      this.boss = null;
      this.score += 300;
      this.onEvent({ type: 'bossDefeated', wave: this.waveNum() });
    }
    if (this.rng.chance(0.13) && this.powerups.length < 6) {
      this.powerups.push({ x: e.x, y: e.y, kind: POWERUP_KINDS[this.rng.int(0, POWERUP_KINDS.length - 1)], ttl: 9 });
    }
    this.onEvent({ type: 'kill', cls: e.cls, combo: this.combo });
  }

  applyPowerup(kind) {
    const p = this.player;
    switch (kind) {
      case 'rapid': this.power.rapid = 6; break;
      case 'spread': this.power.spread = 6; break;
      case 'shield': p.shield = Math.min(p.maxShield, p.shield + 45); break;
      case 'heal': p.hp = Math.min(p.maxHp, p.hp + 35); break;
      case 'freeze': this.freeze = 4; break;
      case 'pierce': this.power.pierce = 5; break;
    }
  }

  forceKillAll() {
    while (this.enemies.length) this.killEnemy(this.enemies[0]);
  }

  // 测试辅助：清空生成队列 + 场上敌人 + 推进到下一波
  forceClearWave() {
    this.spawnQueue = [];
    while (this.enemies.length) this.killEnemy(this.enemies[0]);
    this.tick(0.05, {});
  }

  getState() {
    return {
      time: this.time,
      wave: this.waveNum(),
      waveState: this.waveState,
      score: this.score,
      combo: this.combo,
      kills: this.kills,
      gameOver: this.gameOver,
      ended: this.ended,
      endless: this.endless,
      freeze: this.freeze > 0,
      power: Object.assign({}, this.power),
      player: {
        x: this.player.x, y: this.player.y, hp: this.player.hp, maxHp: this.player.maxHp,
        shield: this.player.shield, alive: this.player.alive
      },
      boss: this.boss ? { name: this.boss.name, hp: this.boss.hp, maxHp: this.boss.maxHp, cls: this.boss.cls } : null,
      enemies: this.enemies.map(function (e) {
        return { id: e.id, cls: e.cls, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, radius: e.radius };
      }),
      bulletCount: this.bullets.length,
      bossProjectileCount: this.bossProjectiles.length,
      powerupCount: this.powerups.length,
      powerups: this.powerups.map(function (pu) { return { x: pu.x, y: pu.y, kind: pu.kind, ttl: pu.ttl }; }),
      stats: Object.assign({}, this.stats)
    };
  }
}

return { GameEngine, ARENA, CLASS_STATS, POWERUP_KINDS };
});