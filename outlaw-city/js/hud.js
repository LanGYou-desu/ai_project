"use strict";
function drawBlip(ctx, x, y, color, t, label) {
  const r = 15 + Math.sin(t) * 4;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
  if (label) {
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px 'Segoe UI', sans-serif"; ctx.textAlign = "center";
    ctx.fillText(label, x, y + 4);
    ctx.textAlign = "left";
  }
}
const HUD = {
  hour() {
    const t = (W.gameTime % CFG.DAY_LENGTH) / CFG.DAY_LENGTH;
    return (t * 24 + 6) % 24;
  },
  dayLight() {
    const h = this.hour();
    if (h >= 7 && h <= 18) { const x = (h - 7) / 11; return 0.35 + 0.65 * Math.sin(Math.min(1, Math.max(0, x)) * Math.PI); }
    return 0.12;
  },
  draw(ctx) {
    this.bars(ctx);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    this.rr(ctx, 10, 10, 64, 22, 6); ctx.fill();
    ctx.fillStyle = "#38bdf8"; ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText("3D", 42, 26);
    this.topRight(ctx);
    this.weaponBox(ctx);
    this.minimap(ctx);
    this.missionBox(ctx);
    this.prompt(ctx);
    this.notifications(ctx);
    this.flash(ctx);
    if (W.state === "play") this.crosshair(ctx);
  },
  crosshair(ctx) {
    const mx = W.viewW / 2, my = W.viewH / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 11, my); ctx.lineTo(mx - 4, my);
    ctx.moveTo(mx + 4, my); ctx.lineTo(mx + 11, my);
    ctx.moveTo(mx, my - 11); ctx.lineTo(mx, my - 4);
    ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + 11);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(mx, my, 1.5, 0, Math.PI * 2); ctx.fill();
  },
  bars(ctx) {
    const p = W.player;
    const x = 20, y = W.viewH - 46, w = 240, h = 16;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    this.rr(ctx, x - 2, y - 2, w + 4, h * 2 + 8, 8); ctx.fill();
    const hw = w * Utils.clamp(p.health / CFG.PLAYER.health, 0, 1);
    const hc = p.health > 40 ? "#22c55e" : p.health > 20 ? "#eab308" : "#ef4444";
    ctx.fillStyle = "rgba(0,0,0,0.6)"; this.rr(ctx, x, y, w, h, 6); ctx.fill();
    ctx.fillStyle = hc; this.rr(ctx, x, y, Math.max(0, hw), h, 6); ctx.fill();
    const ay = y + h + 5;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; this.rr(ctx, x, ay, w, h, 6); ctx.fill();
    ctx.fillStyle = "#38bdf8"; this.rr(ctx, x, ay, w * Utils.clamp(p.armor / CFG.PLAYER.armor, 0, 1), h, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px 'Segoe UI', sans-serif";
    ctx.fillText(Math.ceil(p.health) + " HP", x + 6, y + 13);
    ctx.fillText(Math.ceil(p.armor) + " AP", x + 6, ay + 13);
  },
  topRight(ctx) {
    const p = W.player;
    const x = W.viewW - 30;
    ctx.textAlign = "right";
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#4ade80";
    ctx.fillText(Utils.fmtMoney(p.money), x, 34);
    ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#f87171";
    ctx.fillText("★".repeat(p.wanted) + "☆".repeat(5 - p.wanted), x, 56);
    const h = this.hour();
    const hh = String(Math.floor(h)).padStart(2, "0");
    const mm = String(Math.floor((h % 1) * 60)).padStart(2, "0");
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(hh + ":" + mm, x, 78);
    ctx.textAlign = "left";
  },
  weaponBox(ctx) {
    const p = W.player;
    const w = p.weapon(), def = CFG.WEAPONS[w];
    const x = W.viewW - 250, y = W.viewH - 60, bw = 230, bh = 44;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; this.rr(ctx, x, y, bw, bh, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px 'Segoe UI', sans-serif";
    ctx.fillText(def.name, x + 12, y + 20);
    if (!def.melee) {
      ctx.font = "13px 'Segoe UI', sans-serif";
      ctx.fillStyle = "#fbbf24";
      const magTxt = p.reloading ? "换弹中..." : (p.mag[w] + " / " + p.ammo[w]);
      ctx.fillText(magTxt, x + 12, y + 38);
      if (p.reloading) {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(x + 90, y + 34, (bw - 100) * Utils.clamp(1 - p.reloadTimer / def.reload, 0, 1), 4);
      }
    }
  },
  minimap(ctx) {
    const size = 190, x = W.viewW - size - 16, y = 16;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(MapSys.mini, x, y, size, size);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 2;
    this.rr(ctx, x - 1, y - 1, size + 2, size + 2, 6); ctx.stroke();
    const s = size / MapSys.data.worldW;
    const p = W.player;
    const px = p.vehicle ? p.vehicle.x : p.x;
    const py = p.vehicle ? p.vehicle.y : p.y;
    for (const v of W.vehicles) {
      if (v.wrecked) continue;
      ctx.fillStyle = v.siren ? "#ef4444" : "#cbd5e1";
      ctx.fillRect(x + v.x * s - 1.5, y + v.y * s - 1.5, 3, 3);
    }
    for (const n of W.npcs) {
      if (n.dead) continue;
      ctx.fillStyle = n.police ? "#ef4444" : (n.gang ? "#f97316" : "#94a3b8");
      ctx.fillRect(x + n.x * s - 1, y + n.y * s - 1, 2, 2);
    }
    if (Missions.current) {
      const mk = Missions.current.current;
      if (mk && mk.marker) {
        ctx.fillStyle = mk.marker.color;
        ctx.beginPath(); ctx.arc(x + mk.marker.x * s, y + mk.marker.y * s, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.save();
    ctx.translate(x + px * s, y + py * s);
    ctx.rotate(p.vehicle ? p.vehicle.heading : p.heading);
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  },
  missionBox(ctx) {
    if (!Missions.current) return;
    const m = Missions.current;
    const s = m.current;
    let txt = m.title + "  —  ";
    if (s) txt += s.text || "";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "bold 14px 'Segoe UI', sans-serif";
    const tw = ctx.measureText(txt).width + 24;
    const x = (W.viewW - tw) / 2, y = 12;
    this.rr(ctx, x, y, tw, 30, 8); ctx.fill();
    ctx.fillStyle = "#fde68a"; ctx.textAlign = "center";
    ctx.fillText(txt, W.viewW / 2, y + 21);
    if (s && s.timeLeft !== undefined) {
      ctx.fillStyle = "#f87171";
      ctx.fillText("剩余 " + Math.ceil(s.timeLeft) + " 秒", W.viewW / 2, y + 54);
    }
    ctx.textAlign = "left";
  },
  prompt(ctx) {
    if (!W.prompt) return;
    const pt = W.prompt;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    const tw = ctx.measureText(pt.text).width + 30;
    const x = (W.viewW - tw) / 2;
    const y = W.viewH - 120;
    this.rr(ctx, x, y, tw, 30, 8); ctx.fill();
    ctx.fillStyle = "#fde047"; ctx.textAlign = "center";
    ctx.fillText(pt.text, x + tw / 2, y + 21);
    ctx.textAlign = "left";
  },
  notifications(ctx) {
    let y = 120;
    ctx.textAlign = "center";
    for (let i = 0; i < W.notifs.length; i++) {
      const n = W.notifs[i];
      ctx.globalAlpha = Math.min(1, n.t);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.font = "bold 15px 'Segoe UI', sans-serif";
      const tw = ctx.measureText(n.text).width + 30;
      this.rr(ctx, (W.viewW - tw) / 2, y, tw, 28, 8); ctx.fill();
      ctx.fillStyle = n.color || "#ffffff";
      ctx.fillText(n.text, W.viewW / 2, y + 20);
      y += 34;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  },
  flash(ctx) {
    if (W.damageFlash > 0) {
      ctx.fillStyle = "rgba(220,38,38," + (W.damageFlash * 0.35) + ")";
      ctx.fillRect(0, 0, W.viewW, W.viewH);
    }
  },
  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
};
