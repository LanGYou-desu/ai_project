/* ============================================================
 * 雨夜便利店 · js/base.js
 * 微缩底座：正方形底座板 / 街道路面 / 人行道与路缘石 / 标线与斑马线 /
 * 盲道 / 排水沟与盖板 / 井盖 / 停车位 / 积水水洼 / 小巷地面
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R;

  /* ---------------- 全局尺寸常量（全场共用） ---------------- */
  R.G = {
    SIZE: 30,                 // 正方形底座边长
    HALF: 15,
    GY: 0.12,                 // 人行道 / 场地地面高度
    ROADY: 0,                 // 车行道路面高度
    BOTTOM: -1.5,             // 底座下缘
    // 建筑体块
    STORE: { x0: -8.6, x1: 2.6, z0: -9.4, z1: -0.8, wallTop: 3.30, parapet: 3.62, floor: 0.24, ceil: 2.90 },
    ROAD_S: { z0: 5.0, z1: 9.6 },        // 南侧东西向道路
    ROAD_E: { x0: 7.6, x1: 12.2 },       // 东侧南北向道路
    DOOR: { x0: -3.9, x1: -1.3 },        // 便利店入口
    ALLEY: { x0: -10.6, x1: -8.6, z0: -14.6, z1: -3.0 },
    HOUSE: { x0: -13.4, x1: -10.6, z0: -13.0, z1: -3.0, top: 6.2 }
  };

  /* ---------------- 程序化地面贴图（接近白，靠材质颜色染色） ---------------- */
  function texAsphalt() {
    return R.tileTex('asphalt', 256, 256, function (g, w, h) {
      g.fillStyle = '#eeeeef'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var v = 215 + Math.floor(R.rng() * 40);
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',0.75)';
        g.fillRect(R.rng() * w, R.rng() * h, R.rng() * 2.4 + 0.6, R.rng() * 2.4 + 0.6);
      }
      for (var p = 0; p < 7; p++) {           // 浅色补丁
        g.fillStyle = 'rgba(255,255,255,0.30)';
        g.beginPath();
        g.ellipse(R.rng() * w, R.rng() * h, R.rng() * 26 + 8, R.rng() * 20 + 6, R.rng() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(150,150,158,0.35)'; g.lineWidth = 1.2;   // 细裂缝
      for (var c = 0; c < 5; c++) {
        g.beginPath();
        var x = R.rng() * w, y = R.rng() * h;
        g.moveTo(x, y);
        for (var s = 0; s < 4; s++) { x += R.rand(-30, 30); y += R.rand(-30, 30); g.lineTo(x, y); }
        g.stroke();
      }
    });
  }
  function texConcrete() {
    return R.tileTex('concrete', 256, 256, function (g, w, h) {
      g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2000; i++) {
        var v = 226 + Math.floor(R.rng() * 26);
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 3) + ',0.6)';
        g.fillRect(R.rng() * w, R.rng() * h, 1.6, 1.6);
      }
      g.strokeStyle = 'rgba(178,176,170,0.75)'; g.lineWidth = 2;      // 分块伸缩缝
      g.strokeRect(1, 1, w - 2, h - 2);
      g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    });
  }
  function texYard() {
    return R.tileTex('yard', 256, 256, function (g, w, h) {
      g.fillStyle = '#eceae5'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2400; i++) {
        var v = 220 + Math.floor(R.rng() * 30);
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.55)';
        g.fillRect(R.rng() * w, R.rng() * h, 1.8, 1.8);
      }
      for (var s = 0; s < 12; s++) {          // 陈旧污渍
        g.fillStyle = 'rgba(120,118,112,' + (0.06 + R.rng() * 0.10).toFixed(2) + ')';
        g.beginPath();
        g.ellipse(R.rng() * w, R.rng() * h, R.rng() * 30 + 10, R.rng() * 22 + 8, R.rng() * 3, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
  function texGravel() {
    return R.tileTex('gravel', 128, 128, function (g, w, h) {
      g.fillStyle = '#e2e2e4'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 1400; i++) {
        var v = 170 + Math.floor(R.rng() * 80);
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 3) + ',0.85)';
        g.beginPath(); g.arc(R.rng() * w, R.rng() * h, R.rng() * 2 + 0.5, 0, Math.PI * 2); g.fill();
      }
    });
  }
  function texTactileBars() {
    return R.tileTex('tactileBars', 64, 64, function (g, w, h) {
      g.fillStyle = '#f5f0e2'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 4; i++) {
        var y = 6 + i * 14;
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(6, y, w - 12, 8);
        g.fillStyle = 'rgba(150,140,110,0.35)'; g.fillRect(6, y + 8, w - 12, 2);
      }
    });
  }
  function texTactileDots() {
    return R.tileTex('tactileDots', 64, 64, function (g, w, h) {
      g.fillStyle = '#f5f0e2'; g.fillRect(0, 0, w, h);
      for (var r = 0; r < 3; r++) {
        for (var c = 0; c < 3; c++) {
          var x = 8 + c * 24, y = 8 + r * 24;
          g.fillStyle = 'rgba(150,140,110,0.35)';
          g.beginPath(); g.arc(x + 1, y + 2, 6, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.95)';
          g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
        }
      }
    });
  }
  function texGrate() {
    return R.tileTex('grate', 64, 64, function (g, w, h) {
      g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(40,44,52,0.92)';
      for (var i = 0; i < 5; i++) g.fillRect(4, 5 + i * 12, w - 8, 7);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, w, 3);
      g.fillRect(0, h - 3, w, 3);
    });
  }
  function texManhole() {
    return R.tex('manhole', 128, 128, function (g, w, h) {
      g.fillStyle = '#d8dade'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(70,74,84,0.85)'; g.lineWidth = 3;
      g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(70,74,84,0.55)'; g.lineWidth = 2;
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        g.beginPath();
        g.moveTo(64 + Math.cos(a) * 16, 64 + Math.sin(a) * 16);
        g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
        g.stroke();
      }
      g.fillStyle = 'rgba(70,74,84,0.9)';
      g.beginPath(); g.arc(64, 64, 12, 0, Math.PI * 2); g.fill();
    });
  }
  function texBlob() {
    return R.tex('blob', 128, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      for (var i = 0; i < 9; i++) {
        var x = 24 + R.rng() * 80, y = 24 + R.rng() * 80, r = 12 + R.rng() * 26;
        var gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)');
        gr.addColorStop(0.6, 'rgba(255,255,255,0.75)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    });
  }

  /* ---------------- 地面分区数据（铺设base的核心；测试会校验无缝无重叠） ---------------- */
  // 每项：[x0, z0, x1, z1, 材质名, 高度]
  var PATCHES = [
    // 车行道（y = 0）
    [-15, 5.0, 7.6, 9.6, 'road', 0],
    [7.6, 5.0, 12.2, 9.6, 'road', 0],
    [12.2, 5.0, 15, 9.6, 'road', 0],
    [7.6, -15, 12.2, 5.0, 'road', 0],
    [7.6, 9.6, 12.2, 15, 'road', 0],
    // 人行道（y = 0.12）
    [-13.4, 3.4, 6.0, 5.0, 'walk', 0.12],
    [6.0, 3.4, 7.6, 5.0, 'walk', 0.12],
    [6.0, -15, 7.6, 3.4, 'walk', 0.12],
    [-13.4, 9.6, 7.6, 11.2, 'walk', 0.12],
    [12.2, 9.6, 15, 11.2, 'walk', 0.12],
    [12.2, -15, 13.8, 5.0, 'walk', 0.12],
    // 便利店前场：停车区（沥青）
    [-8.6, -0.8, 6.0, 3.4, 'lot', 0.12],
    // 便利店建筑占地（被建筑覆盖，仅为铺满底座）
    [-8.6, -9.4, 2.6, -0.8, 'yard', 0.12],
    // 场地 / 小巷 / 后场（混凝土）
    [-13.4, -3.0, -8.6, 3.4, 'yard', 0.12],
    [-10.6, -14.6, -8.6, -3.0, 'alley', 0.12],
    [-8.6, -14.6, 6.0, -9.4, 'yard', 0.12],
    [2.6, -9.4, 6.0, -0.8, 'yard', 0.12],
    [-13.4, -14.6, -10.6, -13.0, 'yard', 0.12],
    [-13.4, -13.0, -10.6, -3.0, 'gravel', 0.12],
    // 边缘背景带（暗色碎石地）
    [-13.4, -15, 6.0, -14.6, 'gravel', 0.12],
    [-15, -15, -13.4, 5.0, 'gravel', 0.12],
    [-15, 9.6, -13.4, 15, 'gravel', 0.12],
    [-13.4, 11.2, 7.6, 15, 'gravel', 0.12],
    [12.2, 11.2, 15, 15, 'gravel', 0.12],
    [13.8, -15, 15, 5.0, 'gravel', 0.12]
  ];
  R.base = { patches: PATCHES };

  /* ---------------- 构建 ---------------- */
  R.buildBase = function (root) {
    var G = R.G;
    var group = new THREE.Group();
    group.name = 'base';
    root.add(group);

    var mRoad = R.mat(0x23262e, { map: texAsphalt() });
    var mLot = R.mat(0x262a33, { map: texAsphalt() });
    var mWalk = R.mat(0x8f8c86, { map: texConcrete() });
    var mYard = R.mat(0x767470, { map: texYard() });
    var mAlley = R.mat(0x6b6964, { map: texYard() });
    var mGravel = R.mat(0x3b3c42, { map: texGravel() });
    var mByType = { road: mRoad, lot: mLot, walk: mWalk, yard: mYard, alley: mAlley, gravel: mGravel };

    var i, p;
    for (i = 0; i < PATCHES.length; i++) {
      p = PATCHES[i];
      R.patchT(group, p[0], p[1], p[2], p[3], p[5], mByType[p[4]], 2.0);
    }

    /* --- 底座板：侧面 + 顶部压边 + 侧面装饰凹线 --- */
    var mSlab = R.mat(0x1b1f29, { emissive: 0x0a0d14, emissiveIntensity: 0.5 });
    R.boxMesh(group, G.SIZE, 1.5, G.SIZE, mSlab, 0, -0.66, 0);         // 顶面 0.09
    var mTrim = R.mat(0x8a8781, { emissive: 0x14171d, emissiveIntensity: 0.7 });
    R.boxMesh(group, G.SIZE + 0.16, 0.08, G.SIZE + 0.16, mTrim, 0, 0.095, 0);
    var mGroove = R.mat(0x2a3040, { emissive: 0x0d1119, emissiveIntensity: 0.6 });
    R.boxMesh(group, G.SIZE + 0.06, 0.06, G.SIZE + 0.06, mGroove, 0, -0.52, 0);

    /* --- 路缘石：沿车行道与人行道交界处（分段 + 顶部倒角压条） --- */
    var mCurb = R.mat(0xb9b5ac, { emissive: 0x121519, emissiveIntensity: 0.8 });
    var mCurbTop = R.mat(0xcdc9c0, { emissive: 0x161a1f, emissiveIntensity: 0.8 });
    function curbRun(x0, z0, x1, z1) {           // 轴对齐分段缘石：段间留缝 + 顶部压条
      var horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
      var len = horiz ? x1 - x0 : z1 - z0;
      var segL = 2.4, t = 0;
      while (t < len - 0.02) {
        var L = Math.min(segL, len - t);
        var cl = L - 0.045;
        if (cl < 0.2) break;
        var c = t + L / 2;
        if (horiz) {
          R.boxMesh(group, cl, 0.12, 0.3, mCurb, x0 + c, 0.06, z0);
          R.boxMesh(group, cl - 0.05, 0.038, 0.34, mCurbTop, x0 + c, 0.1375, z0);
        } else {
          R.boxMesh(group, 0.3, 0.12, cl, mCurb, x0, 0.06, z0 + c);
          R.boxMesh(group, 0.34, 0.038, cl - 0.05, mCurbTop, x0, 0.1375, z0 + c);
        }
        t += L;
      }
    }
    curbRun(-15, 4.86, 7.6, 4.86);        // 南道北缘（路口以西）
    curbRun(-15, 9.74, 7.6, 9.74);
    curbRun(12.2, 9.74, 15, 9.74);
    curbRun(7.74, -15, 7.74, 4.86);       // 东道西缘
    curbRun(12.06, -15, 12.06, 4.86);     // 东道东缘（路口以北）
    curbRun(12.06, 9.74, 12.06, 15);

    /* --- 盲道（点状导向 + 到达斑马线的警示条） --- */
    var mTactileDot = R.mat(0xcfa93f, { map: texTactileDots() });
    var mTactileBar = R.mat(0xcfa93f, { map: texTactileBars() });
    function tactile(x0, z0, x1, z1, bar) {
      R.patchT(group, x0, z0, x1, z1, G.GY + 0.006, bar ? mTactileBar : mTactileDot, 0.5);
    }
    tactile(-9.4, 4.28, 6.4, 4.68, false);
    tactile(3.5, 4.68, 7.3, 5.0, true);
    tactile(6.62, -9.2, 7.02, 3.3, false);
    tactile(6.62, -9.7, 7.02, -9.2, true);

    /* --- 道路标线 --- */
    var mPaint = R.mat(0xdfe5ee, { emissive: 0x18202c, emissiveIntensity: 1 });
    var mPaintX = R.mat(0xdfe5ee, { emissive: 0x2a3648, emissiveIntensity: 1 });  // 斑马线更亮
    var RO = 0.014;                       // 路面标线抬升
    function markRoad(x0, z0, x1, z1, mat) {
      R.patch(group, x0, z0, x1, z1, RO, mat || mPaint);
    }
    // 中心虚线（南道 z=7.3 / 东道 x=9.9）
    var x;
    for (x = -14.6; x < 2.9; x += 4.2) markRoad(x, 7.22, x + 2.1, 7.4);
    for (x = 12.6; x < 14.9; x += 4.2) markRoad(x, 7.22, Math.min(x + 2.1, 14.9), 7.4);
    var z;
    for (z = -14.6; z < -0.1; z += 4.2) markRoad(9.82, z, 10.0, z + 2.1);
    for (z = 4.5; z < 5.0; z += 1.0) markRoad(9.82, z, 10.0, Math.min(z + 0.5, 5.0));
    for (z = 10.2; z < 14.9; z += 4.2) markRoad(9.82, z, 10.0, Math.min(z + 2.1, 14.9));
    // 车道边线
    markRoad(-15, 5.36, 7.5, 5.5);
    markRoad(-15, 9.1, 7.5, 9.24);
    markRoad(12.5, 9.1, 15, 9.24);
    markRoad(7.95, -15, 8.09, 5.0);
    markRoad(11.71, -15, 11.85, 0.3);
    markRoad(11.71, 4.4, 11.85, 5.0);
    markRoad(11.71, 10.1, 11.85, 15);
    // 停止线
    markRoad(3.05, 5.2, 3.5, 7.3);
    markRoad(12.45, 7.4, 12.9, 9.4);
    markRoad(7.8, 10.2, 9.8, 10.65);
    markRoad(10.05, 0.0, 12.05, 0.45);
    // 斑马线（南道：条带沿 Z；东道：条带沿 X，宽度略带变化）
    var cwW = [0.44, 0.5, 0.42, 0.47, 0.45, 0.49];
    var cwi = 0;
    for (x = 3.6; x < 6.95; x += 0.95) { markRoad(x, 5.05, x + cwW[cwi % 6], 9.55, mPaintX); cwi++; }
    for (z = 0.6; z < 4.15; z += 0.95) { markRoad(7.65, z, 12.15, z + cwW[cwi % 6], mPaintX); cwi++; }

    /* --- 便利店前场：停车位斜线 + 挡车器 + 自行车位框 --- */
    var lotY = G.GY + 0.006;
    var mPaint2 = R.mat(0xd8dee6, { emissive: 0x151c26, emissiveIntensity: 1 });
    function markLot(x0, z0, x1, z1) { R.patch(group, x0, z0, x1, z1, lotY, mPaint2); }
    var ci, cx;
    for (ci = 0; ci < 4; ci++) {                       // 4 条斜线划出 3 个车位
      cx = -7.9 + ci * 2.3;
      for (var seg = 0; seg < 9; seg++) {
        var t = seg / 9, t2 = (seg + 0.6) / 9;
        var ax = cx + t * 1.15, az = 3.25 - t * 2.6;
        var bx = cx + t2 * 1.15, bz = 3.25 - t2 * 2.6;
        var g2 = R.polyLine(ax, az, bx, bz, 0.1);
        R.patch(group, g2.x0, g2.z0, g2.x1, g2.z1, lotY, mPaint2);
      }
    }
    var mStop = R.mat(0xbdb8ae, { emissive: 0x101318, emissiveIntensity: 1 });
    var wsx;
    for (wsx = -7.0; wsx < -2.0; wsx += 2.3) {
      R.boxMesh(group, 0.5, 0.1, 0.2, mStop, wsx, G.GY + 0.05, 0.75);
      R.bolt(group, wsx - 0.18, G.GY + 0.108, 0.75, 0.011, 'y');      // 固定螺栓
      R.bolt(group, wsx + 0.18, G.GY + 0.108, 0.75, 0.011, 'y');
    }
    // 自行车位（白框 + 斜纹）
    R.patch(group, -7.5, 1.2, -7.42, 3.2, lotY, mPaint2);
    R.patch(group, -4.68, 1.2, -4.6, 3.2, lotY, mPaint2);
    R.patch(group, -7.5, 3.12, -4.6, 3.2, lotY, mPaint2);
    R.patch(group, -7.5, 1.2, -4.6, 1.28, lotY, mPaint2);

    /* --- 排水沟（暗色明沟 + 铸铁盖板） + 井盖 --- */
    var mGutter = R.mat(0x15181f, { emissive: 0x080b12, emissiveIntensity: 0.8 });
    var GO = 0.012;
    R.patch(group, -15, 5.02, 7.6, 5.34, GO, mGutter);
    R.patch(group, -15, 9.26, 7.6, 9.58, GO, mGutter);
    R.patch(group, 12.2, 9.26, 15, 9.58, GO, mGutter);
    R.patch(group, 7.62, -15, 7.94, 4.98, GO, mGutter);
    R.patch(group, 11.86, -15, 12.18, 4.98, GO, mGutter);
    var mGrate = R.mat(0x3a3f49, { map: texGrate(), emissive: 0x0a0d13, emissiveIntensity: 0.6 });
    var gr, gratePos = [
      [-12.0, 5.18], [-8.4, 5.18], [-3.0, 5.18], [1.2, 5.18], [4.6, 5.18],
      [-6.4, 9.42], [-1.0, 9.42], [4.2, 9.42], [13.6, 9.42],
      [7.78, -11.0], [7.78, -6.0], [7.78, -0.8], [7.78, 3.0],
      [12.02, -8.0], [12.02, -2.0], [12.02, 12.6]
    ];
    // 真实金属条格栅：暗底 + 边框（实例化）+ 横向格栅条（实例化）
    var grLong = [], grShort = [], grBars = [];
    for (gr = 0; gr < gratePos.length; gr++) {
      var gx = gratePos[gr][0], gz = gratePos[gr][1];
      R.patch(group, gx - 0.28, gz - 0.17, gx + 0.28, gz + 0.17, 0.015, mGutter);
      grLong.push({ x: gx, y: 0.022, z: gz - 0.152 }, { x: gx, y: 0.022, z: gz + 0.152 });
      grShort.push({ x: gx - 0.255, y: 0.022, z: gz }, { x: gx + 0.255, y: 0.022, z: gz });
      for (var gb2 = -2; gb2 <= 2; gb2++) grBars.push({ x: gx, y: 0.019, z: gz + gb2 * 0.06 });
    }
    R.instanced(group, R.boxGeo(0.56, 0.018, 0.036), 0x3f444d, grLong, { emissive: 0x14171c, emissiveIntensity: 0.9 });
    R.instanced(group, R.boxGeo(0.05, 0.018, 0.34), 0x3f444d, grShort, { emissive: 0x14171c, emissiveIntensity: 0.9 });
    R.instanced(group, R.boxGeo(0.49, 0.014, 0.03), 0x2f343d, grBars, { emissive: 0x101318, emissiveIntensity: 0.9 });
    var mMan = R.mat(0x2c303a, { emissive: 0x0b0e14, emissiveIntensity: 0.7 });
    var mManTop = R.mat(0x6d727c, { map: texManhole() });
    var mans = [[5.6, 6.3], [10.3, 12.6], [-4.9, 5.9]];
    for (i = 0; i < mans.length; i++) {
      var mx2 = mans[i][0], mz2 = mans[i][1];
      R.cylMesh(group, 0.34, 0.34, 0.024, mMan, mx2, 0.012, mz2, 20);              // 井圈
      var ring = new THREE.Mesh(R.torusGeo(0.33, 0.02, 8, 24), mMan);              // 加强圈
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(mx2, 0.026, mz2);
      group.add(ring);
      R.boltRing(group, mx2, 0.032, mz2, 0.285, 6, 'y', 0.013, mStop);             // 周边螺栓
      R.patch(group, mx2 - 0.3, mz2 - 0.3, mx2 + 0.3, mz2 + 0.3, 0.034, mManTop);  // 盖面花纹
    }
    // 小型阀门井盖
    var mCover = R.mat(0x4a4f58, { emissive: 0x0e1218, emissiveIntensity: 0.7 });
    [[-2.2, 1.4, G.GY], [11.0, 2.6, 0], [6.4, 10.9, G.GY]].forEach(function (cv) {
      R.cylMesh(group, 0.14, 0.14, 0.022, mCover, cv[0], cv[2] + 0.011, cv[1], 12);
    });
    // 前场方形雨水桝
    R.boxMesh(group, 0.6, 0.03, 0.6, mGrate, 1.3, G.GY + 0.015, 2.9);

    /* --- 积水水洼（不规则软边） --- */
    var blob = texBlob();
    var mPuddle = new THREE.MeshBasicMaterial({
      color: 0x0a111c, transparent: true, alphaMap: blob, depthWrite: false, opacity: 0.9
    });
    var mSheen = new THREE.MeshBasicMaterial({
      color: 0x92b8dd, transparent: true, alphaMap: blob, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.13
    });
    var puddles = [
      [3.4, 4.15, 2.1, 0.9, 0.3, 0],
      [-4.6, 5.35, 2.8, 0.5, 0, 0],
      [8.8, 7.2, 2.4, 1.4, 0.5, 0],
      [10.6, -4.0, 1.5, 0.9, 0.3, 0],
      [13.0, 6.3, 1.6, 0.9, 0.6, 0],
      [-9.6, -6.4, 0.7, 1.5, 0.2, 0.12],
      [4.35, 2.2, 1.5, 0.8, -0.4, 0.12],
      [-11.6, 0.6, 1.9, 1.1, 0.7, 0.12],
      [4.5, 3.7, 1.2, 0.7, 0.1, 0.12],
      [-1.0, 1.7, 2.3, 1.0, -0.2, 0.12],
      [-6.2, -12.4, 2.0, 1.1, 0.4, 0.12]
    ];
    for (i = 0; i < puddles.length; i++) {
      var pu = puddles[i];
      var y0 = (pu[5] > 0 ? G.GY : 0) + 0.018;
      var q = new THREE.Mesh(R.planeGeo(2, 2), mPuddle);
      q.rotation.x = -Math.PI / 2; q.rotation.z = pu[4];
      q.scale.set(pu[2], pu[3], 1);
      q.position.set(pu[0], y0, pu[1]);
      q.renderOrder = 1;
      group.add(q);
      var sh = new THREE.Mesh(R.planeGeo(2, 2), mSheen);
      sh.rotation.x = -Math.PI / 2; sh.rotation.z = pu[4] + 0.4;
      sh.scale.set(pu[2] * 1.15, pu[3] * 1.15, 1);
      sh.position.set(pu[0], y0 + 0.006, pu[1]);
      sh.renderOrder = 3;
      group.add(sh);
    }

    /* --- 小巷：排水浅槽 + 台阶 + 油渍 --- */
    var mChan = R.mat(0x1a1d24, { emissive: 0x080a10, emissiveIntensity: 0.8 });
    R.patch(group, -9.72, -14.4, -9.48, -3.2, G.GY + 0.004, mChan);
    var mOil = R.mat(0x1e2026, { emissive: 0x070a10, emissiveIntensity: 0.6 });
    [[-9.3, -8.0, 1.2, 0.7], [-10.0, -11.4, 1.0, 0.6], [-9.0, -4.2, 0.9, 0.5]].forEach(function (o) {
      R.patch(group, o[0] - o[2] / 2, o[1] - o[3] / 2, o[0] + o[2] / 2, o[1] + o[3] / 2, G.GY + 0.005, mOil);
    });
    R.boxMesh(group, 0.9, 0.06, 0.5, mCurb, -9.6, G.GY - 0.03, -3.15);

    /* --- 底座收藏铭牌（黄铜阴刻感） --- */
    function texPlaque() {
      return R.tex('plaque', 1024, 176, function (g, w, h) {
        g.fillStyle = '#272119'; g.fillRect(0, 0, w, h);
        var pg = g.createLinearGradient(0, 0, 0, h);
        pg.addColorStop(0, 'rgba(255,236,196,0.18)');
        pg.addColorStop(0.45, 'rgba(255,236,196,0.02)');
        pg.addColorStop(1, 'rgba(0,0,0,0.34)');
        g.fillStyle = pg; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(216,182,118,0.85)'; g.lineWidth = 4;
        g.strokeRect(10, 10, w - 20, h - 20);
        g.strokeStyle = 'rgba(216,182,118,0.35)'; g.lineWidth = 1.5;
        g.strokeRect(22, 22, w - 44, h - 44);
        g.textAlign = 'center';
        g.font = '600 52px "Yu Gothic UI","Yu Gothic","Meiryo","MS PGothic",sans-serif';
        g.fillStyle = 'rgba(8,6,4,0.9)';
        g.fillText('雨夜便利店 · RAINY NIGHT MART', w / 2 + 2, 80);
        g.fillStyle = '#dcbf85';
        g.fillText('雨夜便利店 · RAINY NIGHT MART', w / 2, 77);
        g.font = '400 24px "Yu Gothic UI","Yu Gothic","Meiryo",sans-serif';
        g.fillStyle = '#97815a';
        g.fillText('CONVENIENCE STORE DIORAMA — COLLECTIBLE MINIATURE', w / 2, 126);
      });
    }
    var mPlaque = R.mat(0xf4ead0, { map: texPlaque(), emissive: 0x171208, emissiveIntensity: 0.9 });
    R.boxMesh(group, 2.6, 0.44, 0.05, mPlaque, 1.5, -0.22, 15.015, 0, 0.006);
    [[-1.18, -0.15], [1.18, -0.15], [-1.18, 0.15], [1.18, 0.15]].forEach(function (sp) {
      R.bolt(group, 1.5 + sp[0], -0.22 + sp[1], 15.05, 0.02, 'z');
    });

    // 底座不投影但接受阴影（地面承影）
    group.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    return group;
  };

  /* 由两点生成轴对齐矩形（标线用），返回 {x0,z0,x1,z1} */
  R.polyLine = function (ax, az, bx, bz, w) {
    var dx = bx - ax, dz = bz - az;
    var len = Math.max(1e-6, Math.sqrt(dx * dx + dz * dz));
    var nx = -dz / len * w / 2, nz = dx / len * w / 2;
    return {
      x0: Math.min(ax + nx, ax - nx, bx + nx, bx - nx),
      x1: Math.max(ax + nx, ax - nx, bx + nx, bx - nx),
      z0: Math.min(az + nz, az - nz, bz + nz, bz - nz),
      z1: Math.max(az + nz, az - nz, bz + nz, bz - nz)
    };
  };
})();
