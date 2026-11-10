"use strict";

/* OUTLAW CITY · HUD
 * 设计坐标固定为 1280×720；main.js 会把 2D context 缩放到实际 DPR 缓冲。
 * 风格：斜切面板、暖色危险提示 + 青色城市信息，避免把整屏塞满小字。
 */
const HUD = {
  font: "\"Bahnschrift\", \"Segoe UI Variable\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", \"Segoe UI\", sans-serif",
  mono: "\"Cascadia Mono\", \"Consolas\", \"Microsoft YaHei UI\", monospace",
  c: {
    ink: "rgba(5, 10, 16, 0.88)",
    ink2: "rgba(10, 18, 27, 0.78)",
    line: "rgba(255, 194, 92, 0.34)",
    amber: "#ffc25c",
    gold: "#f6a93b",
    cyan: "#7de9ff",
    blue: "#65c9ff",
    green: "#7ef0b2",
    red: "#ff7070",
    text: "#f7fafc",
    muted: "#a3b2c4",
    dim: "#6d7f93",
  },

  hour() {
    const t = (W.gameTime % CFG.DAY_LENGTH) / CFG.DAY_LENGTH;
    return (t * 24 + 6) % 24;
  },

  dayLight() {
    const h = this.hour();
    if (h >= 7 && h <= 18) {
      const x = (h - 7) / 11;
      return 0.35 + 0.65 * Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
    }
    return 0.12;
  },

  timeText() {
    const h = this.hour();
    return String(Math.floor(h)).padStart(2, "0") + ":" +
      String(Math.floor((h % 1) * 60)).padStart(2, "0");
  },

  draw(ctx) {
    const p = W.player;
    if (!p) return;
    this.flash(ctx);
    this.brand(ctx);
    this.minimap(ctx);
    this.topRight(ctx);
    this.missionBox(ctx);
    this.vitals(ctx);
    this.weaponBox(ctx);
    this.speed(ctx);
    this.notifications(ctx);
    this.prompt(ctx);
    if (W.state === "play" && !p.vehicle && !p.dead) this.crosshair(ctx);
  },

  /* ---------------- 基础绘制 ---------------- */

  rr(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  },

  // 有辨识度的斜切面板：左上和右下削角，取代所有方块都用圆角矩形的旧观感。
  cut(ctx, x, y, w, h, cut) {
    const c = Math.max(0, Math.min(cut || 0, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  },

  panel(ctx, x, y, w, h, accent) {
    if (!(w > 0 && h > 0)) return;
    ctx.save();
    this.cut(ctx, x, y, w, h, 10);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "rgba(14, 23, 34, 0.92)");
    g.addColorStop(0.64, "rgba(7, 13, 21, 0.90)");
    g.addColorStop(1, "rgba(4, 8, 14, 0.86)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.11)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // 面板左上角的细亮线，和大面积暗色形成层次。
    ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 12);
    ctx.lineTo(x + 1, y + h - 1);
    ctx.lineTo(x + w - 12, y + h - 1);
    ctx.stroke();
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(x + 16, y, Math.max(24, w * 0.14), 2);
      ctx.fillRect(x, y + 16, 2, Math.max(12, h * 0.22));
    }
    ctx.restore();
  },

  chip(ctx, x, y, w, h, text, color, align) {
    this.cut(ctx, x, y, w, h, 4);
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "700 10px " + this.font;
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, align === "left" ? x + 9 : x + w / 2, y + h / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  },

  /* ---------------- 品牌 / 状态 ---------------- */

  brand(ctx) {
    const x = 28, y = 22;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = this.c.red;
    ctx.fillRect(x, y + 2, 3, 36);
    ctx.fillStyle = this.c.amber;
    ctx.fillRect(x + 12, y + 2, 18, 2);
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 9px " + this.font;
    ctx.fillText("NIGHTFALL DISTRICT  /  SECTOR 07", x + 12, y + 14);
    ctx.fillStyle = this.c.text;
    ctx.font = "800 21px " + this.font;
    ctx.fillText("OUTLAW CITY", x + 12, y + 36);
    ctx.fillStyle = this.c.amber;
    ctx.font = "700 10px " + this.font;
    ctx.fillText("亡命都市", x + 185, y + 36);
    ctx.restore();
  },

  topRight(ctx) {
    const p = W.player;
    if (!p) return;
    const x = 28, y = 78, w = 300, h = 54;
    this.panel(ctx, x, y, w, h, "rgba(255, 194, 92, 0.72)");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "700 8px " + this.font;
    ctx.fillStyle = this.c.dim;
    ctx.fillText("CASH  /  现金", x + 16, y + 16);
    ctx.fillStyle = this.c.green;
    ctx.font = "800 19px " + this.font;
    ctx.fillText(Utils.fmtMoney(p.money), x + 16, y + 41);

    ctx.fillStyle = "rgba(255,255,255,0.11)";
    ctx.fillRect(x + 116, y + 11, 1, 31);

    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText("LOCAL  /  时间", x + 128, y + 16);
    ctx.fillStyle = this.c.cyan;
    ctx.font = "800 16px " + this.font;
    ctx.fillText(this.timeText(), x + 128, y + 40);

    const stars = Utils.clamp(p.wanted | 0, 0, 5);
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText(stars > 0 ? "WANTED  /  通缉" : "CLEAR  /  无通缉", x + 206, y + 16);
    for (let i = 0; i < 5; i++) {
      const on = i < stars;
      ctx.fillStyle = on ? (stars >= 4 ? this.c.red : this.c.amber) : "rgba(150, 163, 178, 0.22)";
      ctx.fillRect(x + 206 + i * 12, y + 27, 7, 13);
      if (on) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x + 206 + i * 12, y + 27, 7, 1);
      }
    }
    ctx.textAlign = "left";
  },

  /* ---------------- 小地图 ---------------- */

  minimap(ctx) {
    const pw = 224, px = W.viewW - pw - 20, py = 20;
    const mapSize = 192, mapX = px + 16, mapY = py + 38;
    const ph = 38 + mapSize + 30;
    this.panel(ctx, px, py, pw, ph, "rgba(125, 233, 255, 0.68)");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 9px " + this.font;
    ctx.fillStyle = this.c.cyan;
    ctx.fillText("DISTRICT MAP", px + 16, py + 21);
    ctx.fillStyle = this.c.dim;
    ctx.font = "600 8px " + this.font;
    ctx.fillText("黄昏街区", px + 106, py + 21);
    ctx.textAlign = "right";
    ctx.fillStyle = this.c.amber;
    ctx.font = "800 11px " + this.font;
    ctx.fillText("N", px + pw - 18, py + 21);
    ctx.strokeStyle = "rgba(255, 194, 92, 0.52)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + pw - 22, py + 26);
    ctx.lineTo(px + pw - 15, py + 26);
    ctx.stroke();
    ctx.textAlign = "left";

    this.drawMap(ctx, mapX, mapY, mapSize);

    ctx.fillStyle = this.c.dim;
    ctx.font = "600 8px " + this.font;
    ctx.fillText("NIGHTFALL  //  07", px + 16, py + ph - 11);
    const p = W.player;
    const coords = p ? (Math.floor(p.vehicle ? p.vehicle.x : p.x) + " · " +
      Math.floor(p.vehicle ? p.vehicle.y : p.y)) : "—";
    ctx.textAlign = "right";
    ctx.fillStyle = this.c.muted;
    ctx.font = "700 8px " + this.mono;
    ctx.fillText(coords, px + pw - 16, py + ph - 11);
    ctx.textAlign = "left";
  },

  drawMap(ctx, x, y, size) {
    if (!MapSys.data) return;
    const d = MapSys.data;
    const s = size / (d.worldW || 1);
    ctx.save();
    this.cut(ctx, x, y, size, size, 9);
    ctx.clip();
    const bg = ctx.createLinearGradient(x, y, x + size, y + size);
    bg.addColorStop(0, "#0b141d");
    bg.addColorStop(1, "#080e15");
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, size, size);

    // 水体与公园保留低饱和的青绿，建筑和道路用分层灰蓝。
    ctx.fillStyle = "#0d2d37";
    for (const w of d.water) ctx.fillRect(x + w.x * s, y + w.y * s, w.w * s, w.h * s);
    ctx.fillStyle = "#143328";
    for (const p of d.parks) ctx.fillRect(x + p.x * s, y + p.y * s, p.w * s, p.h * s);

    for (let i = 0; i < d.buildings.length; i++) {
      const b = d.buildings[i];
      if (b.hero) ctx.fillStyle = "#7d6034";
      else ctx.fillStyle = i % 3 === 0 ? "#2b3844" : i % 3 === 1 ? "#26323d" : "#222d38";
      ctx.fillRect(x + b.x * s, y + b.y * s, Math.max(1.4, b.w * s), Math.max(1.4, b.h * s));
    }

    ctx.fillStyle = "#404d58";
    for (const vx of d.roadsV) ctx.fillRect(x + vx * s - 2.2, y, 4.4, size);
    for (const hy of d.roadsH) ctx.fillRect(x, y + hy * s - 2.2, size, 4.4);

    ctx.strokeStyle = "rgba(255, 194, 92, 0.17)";
    ctx.lineWidth = 0.7;
    ctx.setLineDash([2, 6]);
    for (const vx of d.roadsV) {
      ctx.beginPath(); ctx.moveTo(x + vx * s, y); ctx.lineTo(x + vx * s, y + size); ctx.stroke();
    }
    for (const hy of d.roadsH) {
      ctx.beginPath(); ctx.moveTo(x, y + hy * s); ctx.lineTo(x + size, y + hy * s); ctx.stroke();
    }
    ctx.setLineDash([]);

    // 空中单轨的斜线是这座城市最明显的非正交地标。
    const cx = (W.player && W.player.x) || d.worldW / 2;
    const cz = (W.player && W.player.y) || d.worldH / 2;
    const diag = 0.63, half = d.worldW * 0.72;
    ctx.strokeStyle = "rgba(125, 233, 255, 0.30)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + (cx - Math.cos(diag) * half) * s, y + (cz - Math.sin(diag) * half) * s);
    ctx.lineTo(x + (cx + Math.cos(diag) * half) * s, y + (cz + Math.sin(diag) * half) * s);
    ctx.stroke();

    const p = W.player;
    if (p) {
      for (const v of W.vehicles) {
        if (v.wrecked) continue;
        ctx.fillStyle = v.siren ? this.c.red : "rgba(214, 224, 236, 0.66)";
        const vx = x + v.x * s, vy = y + v.y * s;
        ctx.fillRect(vx - 1.2, vy - 1.2, 2.4, 2.4);
      }
      for (const n of W.npcs) {
        if (n.dead) continue;
        ctx.fillStyle = n.police ? this.c.red : (n.gang ? "#ff9d55" : "rgba(160, 178, 198, 0.48)");
        ctx.fillRect(x + n.x * s - 0.8, y + n.y * s - 0.8, 1.6, 1.6);
      }
      if (Missions.current) {
        const mk = Missions.current.current;
        if (mk && mk.marker) {
          const mx = x + mk.marker.x * s, my = y + mk.marker.y * s;
          const pulse = 4 + Math.sin(Date.now() * 0.004) * 1.4;
          ctx.strokeStyle = mk.marker.color || this.c.amber;
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.arc(mx, my, pulse + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = mk.marker.color || this.c.amber;
          ctx.beginPath();
          ctx.moveTo(mx, my - 4);
          ctx.lineTo(mx + 4, my);
          ctx.lineTo(mx, my + 4);
          ctx.lineTo(mx - 4, my);
          ctx.closePath();
          ctx.fill();
        }
      }

      const vx = p.vehicle ? p.vehicle.x : p.x;
      const vy = p.vehicle ? p.vehicle.y : p.y;
      ctx.save();
      ctx.translate(x + vx * s, y + vy * s);
      ctx.rotate((p.vehicle ? p.vehicle.heading : p.heading) + Math.PI / 2);
      ctx.fillStyle = "rgba(125, 233, 255, 0.19)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-13, -27);
      ctx.lineTo(13, -27);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(6, 12, 18, 0.65)";
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5.5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5.5, 6);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = this.c.cyan;
      ctx.fill();
      ctx.restore();
    }

    const hx = (W.hospital ? W.hospital.x : 160) * s;
    const hy = (W.hospital ? W.hospital.y : 160) * s;
    ctx.fillStyle = "rgba(125, 233, 255, 0.90)";
    ctx.fillRect(x + hx - 3.5, y + hy - 1, 7, 2);
    ctx.fillRect(x + hx - 1, y + hy - 3.5, 2, 7);

    const vg = ctx.createLinearGradient(x, y, x + size, y + size);
    vg.addColorStop(0, "rgba(255,255,255,0.035)");
    vg.addColorStop(0.55, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.26)");
    ctx.fillStyle = vg;
    ctx.fillRect(x, y, size, size);
    ctx.restore();

    ctx.strokeStyle = "rgba(125, 233, 255, 0.22)";
    ctx.lineWidth = 1;
    this.cut(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 9);
    ctx.stroke();
  },

  /* ---------------- 生命 / 护甲 ---------------- */

  vitals(ctx) {
    const p = W.player;
    if (!p) return;
    const x = 28, y = W.viewH - 104, w = 310, h = 80;
    this.panel(ctx, x, y, w, h, "rgba(255, 112, 112, 0.66)");

    ctx.textAlign = "left";
    ctx.font = "700 9px " + this.font;
    ctx.fillStyle = this.c.dim;
    ctx.fillText("VITALS  /  生命体征", x + 16, y + 17);
    ctx.textAlign = "right";
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText("OUTLAW 01", x + w - 16, y + 17);
    ctx.textAlign = "left";

    const hp = Utils.clamp(p.health / CFG.PLAYER.health, 0, 1);
    const ar = Utils.clamp(p.armor / CFG.PLAYER.armor, 0, 1);
    const hc = p.health > 50 ? this.c.green : p.health > 25 ? this.c.amber : this.c.red;
    const pulse = p.health <= 25 ? 0.78 + 0.22 * Math.sin(Date.now() * 0.009) : 1;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = hc;
    ctx.font = "800 31px " + this.font;
    ctx.fillText(String(Math.ceil(p.health)), x + 16, y + 55);
    ctx.font = "700 8px " + this.font;
    ctx.fillStyle = this.c.dim;
    ctx.fillText("HP", x + 16, y + 68);
    ctx.restore();

    this.statBar(ctx, x + 78, y + 37, 214, 8, hp, hc);
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 7px " + this.font;
    ctx.fillText("ARMOR", x + 78, y + 63);
    this.statBar(ctx, x + 118, y + 56, 174, 5, ar, this.c.blue);
    ctx.textAlign = "right";
    ctx.fillStyle = this.c.blue;
    ctx.font = "800 13px " + this.font;
    ctx.fillText(String(Math.ceil(p.armor)), x + w - 16, y + 65);
    ctx.textAlign = "left";

    // 细小的“危险边缘”：低血量时红色斜线提醒，不增加额外文字。
    if (p.health <= 25) {
      ctx.fillStyle = "rgba(255, 112, 112, 0.85)";
      ctx.fillRect(x + w - 4, y + 10, 2, h - 20);
    }
  },

  statBar(ctx, x, y, w, h, ratio, color) {
    ctx.fillStyle = "rgba(255,255,255,0.075)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    for (let i = 1; i < 10; i++) ctx.fillRect(x + (w / 10) * i, y, 1, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * ratio, h);
    ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.fillRect(x, y, w * ratio, 1);
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.fillRect(x + w * ratio - 1, y - 2, 2, h + 4);
  },

  /* ---------------- 武器 / 载具 ---------------- */

  weaponBox(ctx) {
    const p = W.player;
    if (!p) return;
    if (p.vehicle) return this.vehicleCard(ctx, p.vehicle);

    const key = p.weapon();
    const def = CFG.WEAPONS[key] || { name: key, melee: true };
    const x = W.viewW - 338, y = W.viewH - 104, w = 310, h = 80;
    this.panel(ctx, x, y, w, h, "rgba(255, 194, 92, 0.66)");

    ctx.textAlign = "left";
    ctx.font = "700 9px " + this.font;
    ctx.fillStyle = this.c.amber;
    ctx.fillText("LOADOUT  /  武装", x + 16, y + 17);
    ctx.textAlign = "right";
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText("0" + (p.weaponIndex + 1) + " / 06", x + w - 16, y + 17);
    ctx.textAlign = "left";

    ctx.fillStyle = this.c.text;
    ctx.font = "800 17px " + this.font;
    ctx.fillText(def.name, x + 16, y + 43);
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText(def.melee ? "MELEE  /  近战" : ("KEY  " + key.toUpperCase()), x + 16, y + 58);

    ctx.save();
    ctx.globalAlpha = 0.15;
    this.weaponIcon(ctx, key, x + 214, y + 39, 1.15, this.c.amber);
    ctx.restore();

    if (def.melee) {
      ctx.textAlign = "right";
      ctx.fillStyle = this.c.amber;
      ctx.font = "800 30px " + this.font;
      ctx.fillText("∞", x + w - 16, y + 51);
      ctx.fillStyle = this.c.dim;
      ctx.font = "700 8px " + this.font;
      ctx.fillText("UNARMED", x + w - 16, y + 63);
    } else {
      const mag = p.mag[key] || 0, stock = p.ammo[key] || 0;
      ctx.textAlign = "right";
      ctx.fillStyle = p.reloading ? this.c.amber : this.c.text;
      ctx.font = "800 30px " + this.font;
      ctx.fillText(String(mag), x + w - 66, y + 52);
      ctx.fillStyle = this.c.dim;
      ctx.font = "700 13px " + this.font;
      ctx.fillText("/ " + stock, x + w - 16, y + 52);
      ctx.textAlign = "left";
      if (p.reloading) {
        const total = def.reload || 1;
        const prog = Utils.clamp(1 - p.reloadTimer / total, 0, 1);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(x + 16, y + h - 10, w - 32, 3);
        ctx.fillStyle = this.c.amber;
        ctx.fillRect(x + 16, y + h - 10, (w - 32) * prog, 3);
        ctx.fillStyle = this.c.amber;
        ctx.font = "700 8px " + this.font;
        ctx.fillText("RELOADING", x + 16, y + h - 16);
      } else {
        const max = def.mag || 12;
        const pip = Math.min(10, max);
        for (let i = 0; i < pip; i++) {
          ctx.fillStyle = i < Math.ceil(mag / Math.max(1, max) * pip) ? this.c.amber : "rgba(150, 163, 178, 0.22)";
          ctx.fillRect(x + 16 + i * 9, y + h - 13, 5, 3);
        }
        ctx.textAlign = "right";
        ctx.fillStyle = this.c.dim;
        ctx.font = "700 8px " + this.font;
        ctx.fillText("R  换弹  ·  Q  切换", x + w - 16, y + h - 10);
      }
    }
    ctx.textAlign = "left";
  },

  vehicleCard(ctx, v) {
    const x = W.viewW - 338, y = W.viewH - 104, w = 310, h = 80;
    this.panel(ctx, x, y, w, h, "rgba(125, 233, 255, 0.68)");
    ctx.textAlign = "left";
    ctx.font = "700 9px " + this.font;
    ctx.fillStyle = this.c.cyan;
    ctx.fillText("VEHICLE  /  载具", x + 16, y + 17);
    ctx.textAlign = "right";
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText("E  EXIT", x + w - 16, y + 17);
    ctx.textAlign = "left";

    ctx.fillStyle = this.c.text;
    ctx.font = "800 18px " + this.font;
    ctx.fillText(v.def.name || "VEHICLE", x + 16, y + 45);
    const health = Math.max(0, Math.min(1, (v.health || 0) / (v.maxHealth || 100)));
    this.statBar(ctx, x + 16, y + 58, w - 32, 6, health, health > 0.35 ? this.c.cyan : this.c.red);
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText("HULL  " + Math.round(health * 100) + "%", x + 16, y + 74);
    ctx.textAlign = "right";
    ctx.fillStyle = this.c.muted;
    ctx.font = "700 8px " + this.font;
    ctx.fillText("SPACE  手刹  ·  E  下车", x + w - 16, y + 74);
    ctx.textAlign = "left";
  },

  weaponIcon(ctx, key, cx, cy, s, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (key === "fist") {
      ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8 * s, cy + 8 * s);
      ctx.lineTo(cx + 8 * s, cy + 8 * s);
      ctx.stroke();
    } else if (key === "pistol") {
      ctx.rect(cx - 12 * s, cy - 5 * s, 21 * s, 7 * s);
      ctx.moveTo(cx + 4 * s, cy + 2 * s);
      ctx.lineTo(cx + 8 * s, cy + 13 * s);
      ctx.stroke();
    } else if (key === "rifle") {
      ctx.moveTo(cx - 18 * s, cy - 2 * s);
      ctx.lineTo(cx + 19 * s, cy - 2 * s);
      ctx.moveTo(cx - 6 * s, cy - 2 * s);
      ctx.lineTo(cx - 11 * s, cy + 7 * s);
      ctx.moveTo(cx + 10 * s, cy - 2 * s);
      ctx.lineTo(cx + 14 * s, cy + 5 * s);
      ctx.stroke();
    } else if (key === "shotgun") {
      ctx.moveTo(cx - 17 * s, cy - 4 * s);
      ctx.lineTo(cx + 18 * s, cy - 4 * s);
      ctx.moveTo(cx - 17 * s, cy - 1 * s);
      ctx.lineTo(cx + 18 * s, cy - 1 * s);
      ctx.moveTo(cx - 8 * s, cy + 1 * s);
      ctx.lineTo(cx - 13 * s, cy + 8 * s);
      ctx.stroke();
    } else if (key === "smg") {
      ctx.moveTo(cx - 14 * s, cy - 3 * s);
      ctx.lineTo(cx + 15 * s, cy - 3 * s);
      ctx.moveTo(cx - 4 * s, cy - 3 * s);
      ctx.lineTo(cx - 4 * s, cy + 9 * s);
      ctx.lineTo(cx + 1 * s, cy + 9 * s);
      ctx.lineTo(cx + 1 * s, cy - 3 * s);
      ctx.stroke();
    } else {
      ctx.rect(cx - 18 * s, cy - 5 * s, 32 * s, 10 * s);
      ctx.moveTo(cx + 14 * s, cy - 5 * s);
      ctx.lineTo(cx + 20 * s, cy);
      ctx.lineTo(cx + 14 * s, cy + 5 * s);
      ctx.stroke();
    }
  },

  /* ---------------- 速度表 ---------------- */

  speed(ctx) {
    const p = W.player;
    if (!p || !p.vehicle) return;
    const v = p.vehicle;
    const cx = W.viewW / 2, cy = W.viewH - 78, r = 59;
    const a0 = Math.PI * 0.76, a1 = Math.PI * 2.24;
    const ratio = Utils.clamp(Math.abs(v.fs || 0) / Math.max(1, v.def.maxSpeed || 1), 0, 1);
    const active = a0 + (a1 - a0) * ratio;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(4, 9, 15, 0.84)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, a0, a1);
    ctx.strokeStyle = "rgba(125, 233, 255, 0.12)";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, a0, active);
    ctx.strokeStyle = ratio > 0.82 ? this.c.amber : this.c.cyan;
    ctx.shadowColor = ratio > 0.82 ? "rgba(255,194,92,0.55)" : "rgba(125,233,255,0.50)";
    ctx.shadowBlur = 9;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let i = 0; i <= 12; i++) {
      const a = a0 + (a1 - a0) * i / 12;
      const x1 = cx + Math.cos(a) * (r + 2), y1 = cy + Math.sin(a) * (r + 2);
      const x2 = cx + Math.cos(a) * (r + (i % 3 === 0 ? 7 : 5));
      const y2 = cy + Math.sin(a) * (r + (i % 3 === 0 ? 7 : 5));
      ctx.strokeStyle = i / 12 <= ratio ? "rgba(220,250,255,0.72)" : "rgba(150,170,190,0.24)";
      ctx.lineWidth = i % 3 === 0 ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    const kmh = Math.round(Math.abs(v.fs || 0) * 0.36);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.c.text;
    ctx.font = "800 32px " + this.font;
    ctx.fillText(String(kmh), cx, cy + 10);
    ctx.fillStyle = this.c.dim;
    ctx.font = "800 8px " + this.font;
    ctx.fillText("KM/H", cx, cy + 23);
    ctx.fillStyle = this.c.cyan;
    ctx.font = "800 11px " + this.font;
    const gear = v.fs < -0.6 ? "R" : (Math.abs(v.fs) < 0.6 ? "N" : "D");
    ctx.fillText(gear, cx, cy - 19);
    ctx.textAlign = "left";
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = this.c.dim;
    ctx.font = "700 8px " + this.font;
    ctx.fillText((v.def.name || "VEHICLE").toUpperCase(), cx, cy - r - 8);
    ctx.textAlign = "left";
  },

  /* ---------------- 准星 ---------------- */

  crosshair(ctx) {
    const p = W.player;
    if (!p || p.vehicle) return;
    const mx = W.viewW / 2, my = W.viewH / 2;
    let gap = 6;
    const def = CFG.WEAPONS[p.weapon()];
    const aimK = W.aiming ? 0.55 : 1;
    gap += (def && def.spread ? def.spread : 0.02) * 28 * aimK;
    const col = W.aiming ? "rgba(125, 233, 255, 0.98)" : "rgba(255, 220, 160, 0.96)";

    ctx.save();
    ctx.lineCap = "round";
    const ticks = () => {
      ctx.beginPath();
      ctx.moveTo(mx - gap - 8, my); ctx.lineTo(mx - gap, my);
      ctx.moveTo(mx + gap, my); ctx.lineTo(mx + gap + 8, my);
      ctx.moveTo(mx, my - gap - 8); ctx.lineTo(mx, my - gap);
      ctx.moveTo(mx, my + gap); ctx.lineTo(mx, my + gap + 8);
      ctx.stroke();
    };
    ctx.strokeStyle = "rgba(0, 0, 0, 0.56)";
    ctx.lineWidth = 4;
    ticks();
    ctx.strokeStyle = col;
    ctx.lineWidth = W.aiming ? 1.4 : 1.7;
    ctx.shadowColor = W.aiming ? "rgba(70, 220, 255, 0.65)" : "rgba(255, 170, 70, 0.50)";
    ctx.shadowBlur = W.aiming ? 8 : 4;
    ticks();
    ctx.shadowBlur = 0;

    ctx.fillStyle = W.aiming ? "rgba(220, 252, 255, 0.98)" : "rgba(255, 240, 205, 0.98)";
    ctx.beginPath();
    ctx.arc(mx, my, 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = W.aiming ? "rgba(125,233,255,0.24)" : "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, gap + 12, 0, Math.PI * 2);
    ctx.stroke();
    if (W.aiming) {
      ctx.strokeStyle = "rgba(125,233,255,0.62)";
      ctx.beginPath();
      for (const a of [0.25, 0.75, 1.25, 1.75]) {
        const aa = Math.PI * a;
        const rr1 = gap + 17, rr2 = gap + 22;
        ctx.moveTo(mx + Math.cos(aa) * rr1, my + Math.sin(aa) * rr1);
        ctx.lineTo(mx + Math.cos(aa) * rr2, my + Math.sin(aa) * rr2);
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  /* ---------------- 任务 ---------------- */

  missionBox(ctx) {
    if (!Missions.current) return;
    const m = Missions.current;
    const s = m.current;
    const step = s && s.text ? s.text : "";
    const title = m.title || "未命名合约";
    const full = title + (step ? "  //  " + step : "");
    ctx.font = "700 12px " + this.font;
    const timerW = s && s.timeLeft !== undefined ? 72 : 0;
    const tw = Math.min(620, Math.max(420, ctx.measureText(full).width + 150 + timerW));
    const x = (W.viewW - tw) / 2, y = 18, h = 42;
    this.panel(ctx, x, y, tw, h, "rgba(255, 194, 92, 0.74)");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.c.amber;
    ctx.font = "800 8px " + this.font;
    ctx.fillText("ACTIVE CONTRACT  /  进行中", x + 34, y + 14);
    ctx.fillStyle = this.c.amber;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 10);
    ctx.lineTo(x + 22, y + 14);
    ctx.lineTo(x + 18, y + 18);
    ctx.lineTo(x + 14, y + 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.c.text;
    ctx.font = "700 12px " + this.font;
    let line = full;
    const maxW = tw - 48 - timerW;
    if (ctx.measureText(line).width > maxW) {
      while (line.length > 5 && ctx.measureText(line + "…").width > maxW) line = line.slice(0, -1);
      line += "…";
    }
    ctx.fillText(line, x + 34, y + 30);

    if (timerW) {
      const timer = String(Math.ceil(s.timeLeft)) + "s";
      ctx.font = "800 11px " + this.mono;
      ctx.textAlign = "right";
      ctx.fillStyle = s.timeLeft < 15 ? this.c.red : this.c.amber;
      ctx.fillText(timer, x + tw - 16, y + 30);
    }
    ctx.textAlign = "left";
  },

  /* ---------------- 交互提示 ---------------- */

  prompt(ctx) {
    if (!W.prompt) return;
    const pt = W.prompt;
    const text = pt.text || "";
    const hasKey = /^按\s*E/.test(text);
    const rest = hasKey ? text.replace(/^按\s*E\s*/, "") : text;
    ctx.font = "700 12px " + this.font;
    const tw = Math.min(560, ctx.measureText(rest).width + (hasKey ? 82 : 36));
    const p = W.player;
    const y = W.viewH - (p && p.vehicle ? 192 : 166);
    const x = (W.viewW - tw) / 2, h = 34;
    this.cut(ctx, x, y, tw, h, 5);
    ctx.fillStyle = "rgba(3, 8, 14, 0.82)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 194, 92, 0.40)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 194, 92, 0.85)";
    ctx.fillRect(x, y + 9, 2, h - 18);

    let tx = x + 18;
    if (hasKey) {
      ctx.fillStyle = this.c.amber;
      this.rr(ctx, tx, y + 7, 26, 20, 3);
      ctx.fill();
      ctx.fillStyle = "#10151c";
      ctx.font = "800 12px " + this.font;
      ctx.textAlign = "center";
      ctx.fillText("E", tx + 13, y + 21);
      ctx.textAlign = "left";
      tx += 36;
    }
    ctx.fillStyle = this.c.text;
    ctx.font = "700 12px " + this.font;
    ctx.fillText(rest, tx + 2, y + 21);
  },

  /* ---------------- 通知 ---------------- */

  notifications(ctx) {
    let y = 80;
    ctx.textAlign = "center";
    for (let i = 0; i < W.notifs.length && i < 4; i++) {
      const n = W.notifs[i];
      ctx.globalAlpha = Utils.clamp(n.t / 0.35, 0, 1);
      ctx.font = "700 12px " + this.font;
      const tw = Math.min(620, Math.max(180, ctx.measureText(n.text).width + 58));
      const x = (W.viewW - tw) / 2;
      this.cut(ctx, x, y, tw, 30, 4);
      ctx.fillStyle = "rgba(4, 9, 15, 0.82)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = n.color || this.c.amber;
      ctx.fillRect(x + 12, y + 11, 5, 8);
      ctx.fillStyle = n.color || this.c.text;
      ctx.font = "700 12px " + this.font;
      ctx.fillText(n.text, W.viewW / 2 + 4, y + 20);
      y += 36;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  },

  flash(ctx) {
    if (W.damageFlash > 0) {
      const a = Utils.clamp(W.damageFlash, 0, 1);
      const g = ctx.createRadialGradient(
        W.viewW / 2, W.viewH / 2, Math.min(W.viewW, W.viewH) * 0.18,
        W.viewW / 2, W.viewH / 2, Math.max(W.viewW, W.viewH) * 0.72
      );
      g.addColorStop(0, "rgba(220,38,38,0)");
      g.addColorStop(0.65, "rgba(220,38,38," + (a * 0.10).toFixed(3) + ")");
      g.addColorStop(1, "rgba(160,10,20," + (a * 0.46).toFixed(3) + ")");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W.viewW, W.viewH);
    }
  },
};
