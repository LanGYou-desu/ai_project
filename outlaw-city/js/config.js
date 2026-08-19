"use strict";
const CFG = {
  WORLD: { cols: 13, rows: 13, cell: 320, road: 64, margin: 12, chunk: 1040 },
  PLAYER: { speed: 170, sprint: 275, radius: 11, health: 100, armor: 100 },
  DAY_LENGTH: 600,
  START_MONEY: 600,
  START_AMMO: { pistol: 60, smg: 150, shotgun: 24, rifle: 60, rocket: 6 },
  VEHICLES: {
    sedan:  { name: "轿车",   w: 46, h: 88, maxSpeed: 320, accel: 170, turn: 2.6, health: 340, colors: ["#8d99ae", "#cbd5e1", "#334155", "#94a3b8", "#7f1d1d", "#1e3a8a", "#44403c"] },
    sports: { name: "跑车",   w: 44, h: 82, maxSpeed: 450, accel: 260, turn: 3.2, health: 240, colors: ["#dc2626", "#f59e0b", "#0ea5e9", "#10b981", "#f8fafc", "#e11d48"] },
    taxi:   { name: "出租车", w: 46, h: 88, maxSpeed: 300, accel: 165, turn: 2.6, health: 310, colors: ["#facc15"] },
    police: { name: "警车",   w: 48, h: 92, maxSpeed: 370, accel: 205, turn: 2.9, health: 380, colors: ["#0f172a"] },
    truck:  { name: "卡车",   w: 62, h: 134, maxSpeed: 235, accel: 115, turn: 1.9, health: 800, colors: ["#475569", "#92400e", "#166534", "#7f1d1d"] },
    bike:   { name: "摩托",   w: 22, h: 48, maxSpeed: 420, accel: 230, turn: 3.7, health: 170, colors: ["#f43f5e", "#6366f1", "#22c55e", "#eab308", "#a855f7"] },
  },
  WEAPONS: {
    fist:    { name: "拳头",   dmg: 8,  rate: 2.4, range: 50,  melee: true,  auto: false },
    pistol:  { name: "手枪",   dmg: 22, rate: 4.0, spread: 0.06, bulletSpeed: 950,  range: 720,  mag: 12, reload: 1.1, auto: false },
    smg:     { name: "冲锋枪", dmg: 11, rate: 11,  spread: 0.14, bulletSpeed: 880,  range: 620,  mag: 60, reload: 1.8, auto: true },
    shotgun: { name: "霰弹枪", dmg: 9,  pellets: 8, rate: 1.1, spread: 0.32, bulletSpeed: 820, range: 400, mag: 8, reload: 2.2, auto: false },
    rifle:   { name: "步枪",   dmg: 34, rate: 6.5, spread: 0.035, bulletSpeed: 1250, range: 1150, mag: 30, reload: 1.6, auto: true },
    rocket:  { name: "火箭筒", dmg: 150, splash: 140, rate: 0.7, spread: 0.02, bulletSpeed: 580, range: 950, mag: 5, reload: 2.8, auto: false },
  },
  WEAPON_ORDER: ["fist", "pistol", "smg", "shotgun", "rifle", "rocket"],
  NPC: {
    civilian: { health: 60, speed: 62 },
    gang:     { health: 85, speed: 95 },
    boss:     { health: 350, speed: 70 },
    police:   { health: 70, speed: 100 },
  },
  POLICE: { maxCars: 12, sight: 260, engage: 400, loseTime: 12 },
  BUILDING_COLORS: ["#8a7f6d", "#9c8d7a", "#7d8896", "#a08a72", "#6e7f8d", "#8d7b6b", "#b0a18e", "#5f6a7a", "#a6907c", "#7a8a6e", "#9a9a8a", "#88686a"],
};
