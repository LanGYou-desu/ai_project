/* ============================================================
 * 雨夜便利店 · js/interior.js
 * 店内陈设：饮料柜 / 便当冷柜 / 冰柜 / 货架与商品 / 收银台 / 咖啡机 /
 * 关东煮 / 杂志架 / 饭团架 / 靠窗吧台 / 储物柜与后场门 / 灯箱海报 / 地面导视
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R;
  var JP = '"Yu Gothic UI","Yu Gothic","Hiragino Kaku Gothic ProN","MS PGothic","Meiryo",sans-serif';

  /* ---------------- 贴图 ---------------- */
  function texFloorTile() {
    return R.tileTex('floorTile', 128, 128, function (g, w, h) {
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 700; i++) {
        var v = 232 + Math.floor(R.rng() * 20);
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 6) + ',0.6)';
        g.fillRect(R.rng() * w, R.rng() * h, 2, 2);
      }
      g.strokeStyle = 'rgba(190,186,176,0.9)'; g.lineWidth = 2;
      g.strokeRect(1, 1, w - 2, h - 2);
    });
  }
  function texCoolerStrip() {
    return R.tileTex('coolerStrip', 512, 64, function (g, w, h) {
      g.fillStyle = '#f8fbfa'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b6fb5'; g.fillRect(0, 0, w, 9);
      g.fillStyle = '#8fd0ea';
      g.font = 'bold 30px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('つめた〜い ドリンク', w / 2, 34);
    }, 3, 1);
  }
  function texBentoStrip() {
    return R.tex('bentoStrip', 512, 64, function (g, w, h) {
      g.fillStyle = '#fdf7ef'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e08a3c'; g.fillRect(0, 0, w, 9);
      g.fillStyle = '#a45a20';
      g.font = 'bold 30px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('お弁当・おにぎり・サンドイッチ', w / 2, 34);
    });
  }
  function texMenu() {
    return R.tex('menu', 256, 320, function (g, w, h) {
      g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e08a3c'; g.fillRect(0, 0, w, 34);
      g.fillStyle = '#ffffff';
      g.font = 'bold 22px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ホットメニュー', w / 2, 18);
      var items = [['おでん', '¥120'], ['肉まん', '¥150'], ['ホットコーヒー', '¥120'],
        ['からあげ', '¥220'], ['フランク', '¥180'], ['カフェラテ', '¥180']];
      for (var i = 0; i < items.length; i++) {
        var y = 62 + i * 42;
        g.fillStyle = '#f6ead8'; g.fillRect(10, y - 15, w - 20, 34);
        g.fillStyle = '#5a4632'; g.font = 'bold 20px ' + JP; g.textAlign = 'left';
        g.fillText(items[i][0], 20, y + 2);
        g.fillStyle = '#c0522a'; g.textAlign = 'right';
        g.fillText(items[i][1], w - 20, y + 2);
      }
    });
  }
  function texCoffee() {
    return R.tex('coffeeFace', 256, 256, function (g, w, h) {
      g.fillStyle = '#242a30'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3b444c'; g.fillRect(12, 12, w - 24, 96);
      g.fillStyle = '#bfe6ff'; g.fillRect(24, 24, w - 48, 72);
      g.fillStyle = '#20465a'; g.font = 'bold 20px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('HOT / ICE', w / 2, 60);
      for (var i = 0; i < 3; i++) {
        g.fillStyle = i === 0 ? '#e08a3c' : '#4a545e';
        g.beginPath(); g.arc(52 + i * 76, 148, 26, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.font = 'bold 20px ' + JP;
        g.fillText(['S', 'M', 'L'][i], 52 + i * 76, 149);
      }
      g.fillStyle = '#10151a'; g.fillRect(60, 190, w - 120, 54);
      g.fillStyle = '#c8ccd0'; g.fillRect(84, 178, w - 168, 12);
    });
  }
  function texOden() {
    return R.tex('odenSign', 256, 96, function (g, w, h) {
      g.fillStyle = '#fff6e6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9701f'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#c05a1a';
      g.font = 'bold 56px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('おでん', w / 2, h / 2 + 2);
    });
  }
  function texIce() {
    return R.tex('iceSign', 256, 64, function (g, w, h) {
      g.fillStyle = '#eef7ff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b6fb5'; g.fillRect(0, 0, w, 8);
      g.fillStyle = '#245a8c';
      g.font = 'bold 34px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('アイスクリーム', w / 2, 36);
    });
  }
  function texTag(text, bg, fg) {
    return R.tex('tag|' + text, 192, 64, function (g, w, h) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg;
      g.font = 'bold 30px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 1);
    });
  }
  function texArrow() {
    return R.tex('floorArrow', 128, 64, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(47,155,107,0.85)';
      g.fillRect(0, 8, w, h - 16);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(34, 18); g.lineTo(72, 32); g.lineTo(34, 46);
      g.lineTo(34, 38); g.lineTo(14, 38); g.lineTo(14, 26); g.lineTo(34, 26);
      g.closePath(); g.fill();
      g.font = 'bold 22px ' + JP; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('レジ', 78, 34);
    });
  }

  /* ---------------- 商品实例收集 ---------------- */
  var GEOS = {
    snack: R.boxGeo(0.11, 0.15, 0.06),
    can: R.cylGeo(0.032, 0.032, 0.115, 8),
    bottle: R.cylGeo(0.032, 0.036, 0.2, 8),
    bento: R.boxGeo(0.17, 0.05, 0.12),
    onigiri: R.cylGeo(0.055, 0.055, 0.055, 3),
    nori: R.boxGeo(0.09, 0.03, 0.02),
    mag: R.boxGeo(0.022, 0.26, 0.19),
    ice: R.boxGeo(0.085, 0.06, 0.06),
    daily: R.boxGeo(0.09, 0.17, 0.09),
    pack: R.boxGeo(0.05, 0.09, 0.022)
  };
  var COLORS = {
    can: [0xd9524f, 0xe8873c, 0xe6c33f, 0x4f9fd9, 0x6fc46f, 0xf0f0f0],
    bottle: [0x6fc46f, 0xe8b0c0, 0x9a6fd0, 0x4fc4c4],
    snack: [0xe0552f, 0xf0a92e, 0x2f9b6b, 0x2b6fb5, 0xd94f7a, 0xf2df6a],
    bento: [0xd0472f, 0xe8903c, 0x3f7a4f, 0xc8b48a],
    onigiri: [0xf7f4ea],
    nori: [0x23301e],
    mag: [0xd04060, 0x3f78c0, 0xe0a030, 0x40a068, 0xefe6dc],
    ice: [0xe05f7a, 0x6fb0e0, 0xf0d060, 0x9a6fd0],
    daily: [0xdfe4e8, 0x9fb8c8, 0xc8b89a],
    pack: [0xf2f2f2, 0xd04040, 0x4060c0, 0x40a080]
  };

  R.buildInterior = function (root) {
    var g0 = new THREE.Group();
    g0.name = 'interior';
    root.add(g0);
    var prod = {};
    function addProd(geoKey, hex, x, y, z, ry, s) {
      var k = geoKey + '|' + hex;
      if (!prod[k]) prod[k] = { geo: geoKey, hex: hex, list: [] };
      prod[k].list.push({ x: x, y: y, z: z, ry: ry || 0, rx: geoKey === 'onigiri' ? Math.PI / 2 : 0, sx: s || 1, sy: s || 1, sz: s || 1 });
    }
    function pickColor(kind) {
      var arr = COLORS[kind];
      return arr[Math.floor(R.rng() * arr.length)];
    }

    /* ---------- 地面 / 天花 ---------- */
    var mTile = R.mat(0xd8d3c9, { map: texFloorTile(), emissive: 0x3c3629, emissiveIntensity: 0.8, gradient: 5, soft: true });
    R.patchT(g0, -8.36, -9.16, 2.36, -1.02, 0.245, mTile, 1.0);
    var mCeil = R.mat(0xd6d1c8, { emissive: 0x2e2b24, emissiveIntensity: 0.8, gradient: 5, soft: true });
    R.boxMesh(g0, 10.8, 0.04, 8.2, mCeil, -3.0, 2.88, -5.09);
    // 天花灯盘 4×2
    var mPanel = R.glowMat(0xfff2dc, 1);
    var mPanelFr = R.mat(0xdcdcd8, { emissive: 0x2a2a28, emissiveIntensity: 0.9 });
    var lx = [-6.8, -3.8, -0.8, 1.8], lz = [-3.4, -6.8];
    for (var a = 0; a < lx.length; a++) {
      for (var b = 0; b < lz.length; b++) {
        R.boxMesh(g0, 1.14, 0.05, 0.58, mPanelFr, lx[a], 2.855, lz[b]);
        R.patch(g0, lx[a] - 0.52, lz[b] - 0.26, lx[a] + 0.52, lz[b] + 0.26, 2.83, mPanel);
      }
    }

    /* ---------- 饮料柜（4 台，背墙左侧） ---------- */
    var mCoolBody = R.mat(0xe9efee, { emissive: 0x1d2a2c, emissiveIntensity: 0.9 });
    var mCoolIn = R.mat(0xf6fbfa, { emissive: 0xcfe6e6, emissiveIntensity: 0.55, gradient: 5, soft: true });
    var mShelf = R.mat(0xdfe3e4, { emissive: 0x2a3033, emissiveIntensity: 0.8 });
    var mRail = R.mat(0x8f979c, { emissive: 0x14181b, emissiveIntensity: 0.8 });
    var mCoolGlass = R.mat(0xdff0f4, {
      opacity: 0.22, transparent: true, depthWrite: false, emissive: 0x22343c, emissiveIntensity: 0.9, gradient: 2
    });
    function cooler(cx, w) {
      R.boxMesh(g0, w, 2.35, 0.04, mCoolIn, cx, 1.415, -9.09);                 // 背板（亮）
      R.boxMesh(g0, 0.05, 2.35, 0.68, mCoolBody, cx - w / 2 + 0.025, 1.415, -8.75);
      R.boxMesh(g0, 0.05, 2.35, 0.68, mCoolBody, cx + w / 2 - 0.025, 1.415, -8.75);
      R.boxMesh(g0, w, 0.07, 0.68, mCoolBody, cx, 2.55, -8.75);
      R.boxMesh(g0, w, 0.07, 0.68, mCoolBody, cx, 0.275, -8.75);
      var i;
      for (i = 0; i < 4; i++) {
        var y = 0.62 + i * 0.43;
        R.boxMesh(g0, w - 0.1, 0.03, 0.5, mShelf, cx, y, -8.78);
        R.boxMesh(g0, w - 0.1, 0.045, 0.02, mRail, cx, y + 0.02, -8.52);
        var cols = Math.round(w / 0.14);
        for (var c = 0; c < cols; c++) {
          var px = cx - (cols - 1) * 0.075 + c * 0.15;
          var isCan = R.rng() < 0.55;
          addProd(isCan ? 'can' : 'bottle', pickColor(isCan ? 'can' : 'bottle'),
            px, y + (isCan ? 0.075 : 0.12), -8.66, 0, 1);
          if (R.rng() < 0.8) {
            var k2 = isCan ? 'can' : 'bottle';
            addProd(k2, pickColor(k2), px, y + (isCan ? 0.075 : 0.12), -8.86, 0, 1);
          }
        }
      }
      // 玻璃门 + 门框
      R.boxMesh(g0, w - 0.06, 2.14, 0.02, mCoolGlass, cx, 1.42, -8.41).castShadow = false;
      R.boxMesh(g0, w - 0.02, 0.05, 0.05, mRail, cx, 2.48, -8.41);
      R.boxMesh(g0, w - 0.02, 0.05, 0.05, mRail, cx, 0.35, -8.41);
      R.boxMesh(g0, 0.05, 2.2, 0.05, mRail, cx - w / 2 + 0.05, 1.42, -8.41);
      R.boxMesh(g0, 0.05, 2.2, 0.05, mRail, cx + w / 2 - 0.05, 1.42, -8.41);
      R.boxMesh(g0, 0.03, 1.0, 0.04, mRail, cx + w / 2 - 0.16, 1.35, -8.39);
      R.boxMesh(g0, 0.03, 1.0, 0.04, mRail, cx - w / 2 + 0.16, 1.35, -8.39);     // 对开侧门把
      R.boxMesh(g0, w - 0.24, 0.025, 0.02, R.glowMat(0xcfeaff, 0.85), cx, 2.38, -8.5); // 柜内 LED 灯带
    }
    var coolXs = [-7.85, -6.95, -6.05, -5.15];
    for (var ci = 0; ci < coolXs.length; ci++) cooler(coolXs[ci], 0.9);
    // 冷柜上方灯箱条
    var strip1 = new THREE.Mesh(R.planeGeo(3.96, 0.3), new THREE.MeshBasicMaterial({ map: texCoolerStrip(), fog: true }));
    strip1.position.set(-6.5, 2.74, -8.44);
    g0.add(strip1);
    R.boxMesh(g0, 4.0, 0.12, 0.1, mRail, -6.5, 2.62, -8.42);

    /* ---------- 便当冷柜（暖光，背墙中部） ---------- */
    var mWarmIn = R.mat(0xfdf3e2, { emissive: 0xf0d8b0, emissiveIntensity: 0.5, gradient: 5, soft: true });
    R.boxMesh(g0, 1.8, 2.1, 0.04, mWarmIn, -3.6, 1.29, -9.09);
    R.boxMesh(g0, 0.05, 2.1, 0.68, mCoolBody, -4.475, 1.29, -8.75);
    R.boxMesh(g0, 0.05, 2.1, 0.68, mCoolBody, -2.725, 1.29, -8.75);
    R.boxMesh(g0, 1.8, 0.07, 0.68, mCoolBody, -3.6, 2.31, -8.75);
    R.boxMesh(g0, 1.8, 0.07, 0.68, mCoolBody, -3.6, 0.275, -8.75);
    for (var bi = 0; bi < 4; bi++) {
      var by = 0.62 + bi * 0.4;
      R.boxMesh(g0, 1.7, 0.03, 0.5, mShelf, -3.6, by, -8.78);
      R.boxMesh(g0, 1.7, 0.045, 0.02, mRail, -3.6, by + 0.02, -8.52);
      for (var bc = 0; bc < 7; bc++) {
        var bx = -4.29 + bc * 0.23;
        addProd('bento', pickColor('bento'), bx, by + 0.045, -8.7, R.rand(-0.06, 0.06), 1);
      }
    }
    R.boxMesh(g0, 1.74, 2.1, 0.02, mCoolGlass, -3.6, 1.29, -8.41).castShadow = false;
    R.boxMesh(g0, 0.06, 2.0, 0.05, mRail, -3.605, 1.29, -8.4);
    R.boxMesh(g0, 1.78, 0.05, 0.05, mRail, -3.6, 2.22, -8.41);
    R.boxMesh(g0, 1.78, 0.05, 0.05, mRail, -3.6, 0.35, -8.41);
    var strip2 = new THREE.Mesh(R.planeGeo(1.84, 0.28), new THREE.MeshBasicMaterial({ map: texBentoStrip(), fog: true }));
    strip2.position.set(-3.6, 2.42, -8.44);
    g0.add(strip2);

    /* ---------- 立式冰柜（アイス，中部） ---------- */
    var mFreeze = R.mat(0x4a5560, { emissive: 0x11161c, emissiveIntensity: 0.9 });
    var mFreezeIn = R.mat(0xdcf0f8, { emissive: 0x9fd0e8, emissiveIntensity: 0.45, gradient: 5, soft: true });
    R.boxMesh(g0, 1.2, 0.62, 0.86, mFreeze, -0.95, 0.55, -7.05, 0, 0.014);
    R.boxMesh(g0, 1.06, 0.06, 0.72, mFreezeIn, -0.95, 0.72, -7.05);
    for (var ii = 0; ii < 6; ii++) {
      addProd('ice', pickColor('ice'), -1.42 + ii * 0.19, 0.76, -6.85, R.rand(-0.2, 0.2), 1);
      addProd('ice', pickColor('ice'), -1.42 + ii * 0.19, 0.76, -7.22, R.rand(-0.2, 0.2), 1);
    }
    R.boxMesh(g0, 0.6, 0.02, 0.78, mCoolGlass, -1.26, 0.9, -7.05);
    R.boxMesh(g0, 0.6, 0.02, 0.78, mCoolGlass, -0.64, 0.9, -7.05);
    R.boxMesh(g0, 0.26, 0.03, 0.03, mRail, -1.26, 0.925, -6.68);                 // 滑盖把手
    R.boxMesh(g0, 0.26, 0.03, 0.03, mRail, -0.64, 0.925, -6.68);
    R.boxMesh(g0, 0.5, 0.12, 0.012, R.glowMat(0xbfe6ff, 0.5), -0.95, 0.5, -6.615); // 前脸灯条
    var iceSign = new THREE.Mesh(R.planeGeo(0.8, 0.2), new THREE.MeshBasicMaterial({ map: texIce(), fog: true }));
    iceSign.position.set(-0.95, 0.62, -6.6);
    g0.add(iceSign);
    R.boxMesh(g0, 0.84, 0.22, 0.03, mRail, -0.95, 0.62, -6.62);

    /* ---------- 储物柜 + 后场门 + 打扫角（背墙右侧） ---------- */
    var mLock = R.mat(0xb9c2c6, { emissive: 0x1a2126, emissiveIntensity: 0.9 });
    R.boxMesh(g0, 1.6, 1.78, 0.34, mLock, -1.5, 1.13, -8.93, 0, 0.014);
    for (var li = 0; li < 3; li++) {
      R.boxMesh(g0, 0.46, 1.62, 0.03, R.mat(0xc9d2d6), -2.08 + li * 0.52, 1.13, -8.74);
      R.boxMesh(g0, 0.1, 0.03, 0.03, mRail, -1.88 + li * 0.52, 1.2, -8.72);
      R.boxMesh(g0, 0.1, 0.14, 0.02, R.mat(0xeceff1), -2.08 + li * 0.52, 1.7, -8.73);
      for (var lv = 0; lv < 3; lv++) {                                     // 通风孔
        R.boxMesh(g0, 0.28, 0.012, 0.008, mRail, -2.08 + li * 0.52, 1.74 - lv * 0.032, -8.722);
      }
      R.boxMesh(g0, 0.09, 0.05, 0.008, R.mat(0xf2f4f2, { emissive: 0x2c2c28, emissiveIntensity: 0.8 }), -2.08 + li * 0.52, 1.46, -8.722); // 门牌
    }
    R.boxMesh(g0, 1.66, 0.06, 0.38, mRail, -1.5, 2.05, -8.93);
    R.boxMesh(g0, 0.42, 0.3, 0.3, mLock, -1.0, 2.2, -8.9, 0, 0.01);
    // 后场门
    var mBackDoor = R.mat(0x9fb0a6, { emissive: 0x18211d, emissiveIntensity: 0.9 });
    R.boxMesh(g0, 1.0, 2.05, 0.06, mBackDoor, 0.2, 1.27, -9.12, 0, 0.012);
    R.boxMesh(g0, 0.4, 0.4, 0.02, R.glowMat(0xf6e2b8, 0.85), 0.2, 1.8, -9.08);
    R.boxMesh(g0, 0.7, 0.05, 0.04, mRail, 0.2, 1.15, -9.07);                       // 推杠
    R.boxMesh(g0, 0.05, 0.06, 0.06, mRail, -0.1, 1.15, -9.09);
    R.boxMesh(g0, 0.05, 0.06, 0.06, mRail, 0.5, 1.15, -9.09);
    R.boxMesh(g0, 0.06, 0.18, 0.04, mRail, 0.62, 1.3, -9.08);
    var staffTag = new THREE.Mesh(R.planeGeo(0.34, 0.11), new THREE.MeshBasicMaterial({ map: texTag('STAFF ONLY', '#f2f2ee', '#8a8f92'), fog: true }));
    staffTag.position.set(0.2, 1.42, -9.088);
    g0.add(staffTag);
    // 打扫角：拖把桶 + 桶 + 扫把
    R.cylMesh(g0, 0.16, 0.13, 0.32, R.mat(0xd9c24a, { emissive: 0x1c1a10, emissiveIntensity: 0.9 }), 1.35, 0.4, -8.85, 10);
    R.cylMesh(g0, 0.13, 0.11, 0.26, R.mat(0x6f7d86, { emissive: 0x131a1f, emissiveIntensity: 0.9 }), 1.75, 0.37, -8.8, 10);
    var broom = R.cylMesh(g0, 0.016, 0.016, 1.2, R.mat(0xb08a5a), 2.05, 0.84, -8.86, 6);
    broom.rotation.z = 0.24;
    R.boxMesh(g0, 0.24, 0.34, 0.06, R.mat(0x8a6a44), 2.2, 0.3, -8.86, 0.2);

    /* ---------- 货架 1（零食 / 方便食品，中部） ---------- */
    var mGond = R.mat(0xe2e0da, { emissive: 0x2a2a26, emissiveIntensity: 0.9 });
    var mGondTop = R.mat(0xd0cec8, { emissive: 0x24241f, emissiveIntensity: 0.9 });
    function gondola(cx, w, cz, levels, dense, kinds) {
      var half = w / 2;
      R.boxMesh(g0, w, 0.2, 1.0, mGond, cx, 0.34, cz, 0, 0.012);
      R.boxMesh(g0, w, 0.05, 1.04, mGondTop, cx, 1.4, cz, 0, 0.012);
      R.boxMesh(g0, 0.05, 1.16, 1.0, mGond, cx - half + 0.025, 0.82, cz, 0, 0.012);
      R.boxMesh(g0, 0.05, 1.16, 1.0, mGond, cx + half - 0.025, 0.82, cz, 0, 0.012);
      R.boxMesh(g0, w, 1.16, 0.03, R.mat(0xeceee9, { emissive: 0x2e2f2b, emissiveIntensity: 0.8 }), cx, 0.82, cz - 0.48);
      for (var s = 0; s < levels; s++) {
        R.boxMesh(g0, w - 0.06, 0.03, 0.92, mGond, cx, 0.62 + s * 0.36, cz);
        R.boxMesh(g0, w - 0.06, 0.045, 0.02, mRail, cx, 0.64 + s * 0.36, cz + 0.46);
      }
      var colsN = Math.round(dense);
      for (var row = 0; row < 2; row++) {
        var pz = cz + 0.22 - row * 0.42;
        for (var s2 = 0; s2 <= levels; s2++) {
          var y2 = 0.44 + s2 * 0.36;
          for (var c = 0; c < colsN; c++) {
            if (R.rng() < 0.12) continue;
            var px = cx - (colsN - 1) * 0.115 + c * 0.23;
            var kind = kinds[Math.floor(R.rng() * kinds.length)];
            addProd(kind, pickColor(kind), px + R.rand(-0.02, 0.02), y2, pz, R.rand(-0.15, 0.15), 1);
          }
        }
      }
      // 货架前端价签 + 托臂
      for (var c2 = 0; c2 < colsN; c2 += 2) {
        R.boxMesh(g0, 0.07, 0.05, 0.01, R.mat(0xf4f6f2), cx - (colsN - 1) * 0.115 + c2 * 0.23, 0.7, cz + 0.47);
      }
      for (var s4 = 0; s4 < levels; s4++) {
        var by2 = 0.62 + s4 * 0.36;
        R.boxMesh(g0, 0.05, 0.12, 0.03, mRail, cx - half + 0.055, by2 - 0.1, cz + 0.44);
        R.boxMesh(g0, 0.05, 0.12, 0.03, mRail, cx + half - 0.055, by2 - 0.1, cz + 0.44);
      }
    }
    gondola(-4.9, 6.0, -5.4, 2, 24, ['snack', 'daily']);
    gondola(-6.5, 2.8, -7.5, 2, 11, ['daily', 'snack']);
    // 货架侧面价牌
    R.boxMesh(g0, 0.5, 0.24, 0.02, R.mat(0xf7f7f3), -8.02, 1.55, -5.4);
    var tagSnack = new THREE.Mesh(R.planeGeo(0.48, 0.22), new THREE.MeshBasicMaterial({ map: texTag('お菓子', '#f7f7f3', '#c05a1a'), fog: true }));
    tagSnack.position.set(-8.02, 1.55, -5.38);
    g0.add(tagSnack);

    /* ---------- 收银台（L 形）+ 咖啡机 + POS ---------- */
    var mCount = R.mat(0xe8e8e0, { emissive: 0x2c2c26, emissiveIntensity: 0.9 });
    var mCountTop = R.mat(0xcfc3ad, { emissive: 0x2a2419, emissiveIntensity: 0.85, gradient: 5, soft: true });
    R.boxMesh(g0, 2.36, 0.71, 0.5, mCount, 0.72, 0.595, -5.1, 0, 0.014);           // 主柜台
    R.boxMesh(g0, 2.5, 0.05, 0.62, mCountTop, 0.72, 0.975, -5.1);
    R.boxMesh(g0, 2.36, 0.1, 0.02, R.mat(0x2f9b6b, { emissive: 0x0e2c1f, emissiveIntensity: 1 }), 0.72, 0.78, -4.84);
    R.boxMesh(g0, 0.46, 0.71, 2.6, mCount, 2.13, 0.595, -3.8, 0, 0.014);           // 侧柜台
    R.boxMesh(g0, 0.6, 0.05, 2.6, mCountTop, 2.13, 0.975, -3.8);
    // 收银机（POS）
    R.boxMesh(g0, 0.3, 0.05, 0.24, R.mat(0x3a4046, { emissive: 0x11151a, emissiveIntensity: 0.9 }), 1.5, 1.02, -5.12);
    var posScreen = R.boxMesh(g0, 0.3, 0.24, 0.03, R.mat(0x2b3238, { emissive: 0x121820, emissiveIntensity: 0.9 }), 1.5, 1.17, -5.18);
    posScreen.rotation.x = -0.22;
    R.boxMesh(g0, 0.24, 0.18, 0.01, R.glowMat(0xcfeaff, 0.95), 1.5, 1.17, -5.163).rotation.x = -0.22;
    R.boxMesh(g0, 0.14, 0.1, 0.12, R.mat(0x39434c, { emissive: 0x11161c, emissiveIntensity: 0.9 }), 1.98, 1.05, -5.05);
    // 键盘 / 小票机 / 读卡器 / 钱箱面板
    for (var kr = 0; kr < 3; kr++) {
      for (var kc = 0; kc < 4; kc++) {
        R.boxMesh(g0, 0.034, 0.012, 0.028, R.mat(0xc8ccd0, { emissive: 0x1a1e22, emissiveIntensity: 0.8 }), 1.5 + (kc - 1.5) * 0.044, 1.045, -5.09 + kr * 0.048);
      }
    }
    R.boxMesh(g0, 0.16, 0.14, 0.16, R.mat(0x39434c, { emissive: 0x11161c, emissiveIntensity: 0.9 }), 0.55, 1.07, -5.12);
    R.boxMesh(g0, 0.12, 0.02, 0.12, mRail, 0.55, 1.152, -5.12);
    R.boxMesh(g0, 0.1, 0.035, 0.12, R.mat(0x2b3238, { emissive: 0x121820, emissiveIntensity: 0.9 }), 0.9, 1.02, -5.04);
    R.boxMesh(g0, 0.9, 0.3, 0.02, R.mat(0x9aa2a8, { emissive: 0x161b1f, emissiveIntensity: 0.8 }), 0.72, 0.42, -4.84);
    R.cylMesh(g0, 0.035, 0.03, 0.1, R.mat(0xe8e8e0), 0.34, 1.05, -5.15, 8);
    var mRail2 = R.mat(0x9aa2a8, { emissive: 0x161b1f, emissiveIntensity: 0.8 });
    // 咖啡机（面向顾客 +Z）
    R.boxMesh(g0, 0.52, 0.62, 0.56, R.mat(0x2b3238, { emissive: 0x111820, emissiveIntensity: 0.95 }), -0.3, 1.29, -5.1, 0, 0.014);
    var coffeeFace = new THREE.Mesh(R.planeGeo(0.46, 0.54), new THREE.MeshBasicMaterial({ map: texCoffee(), fog: true }));
    coffeeFace.position.set(-0.3, 1.29, -4.815);
    g0.add(coffeeFace);
    R.boxMesh(g0, 0.34, 0.05, 0.3, mRail2, -0.3, 0.99, -4.95);
    // 出液口 / 纸杯堆
    R.boxMesh(g0, 0.06, 0.05, 0.06, R.mat(0x39434c, { emissive: 0x121820, emissiveIntensity: 0.9 }), -0.3, 1.01, -4.825);
    R.cylMesh(g0, 0.035, 0.03, 0.09, R.mat(0xf2f0ea, { emissive: 0x2c2c28, emissiveIntensity: 0.8 }), -0.62, 1.05, -5.05, 8);
    R.cylMesh(g0, 0.033, 0.033, 0.02, R.mat(0xf2f0ea, { emissive: 0x2c2c28, emissiveIntensity: 0.8 }), -0.62, 1.105, -5.05, 8);
    R.groundGlow(g0, -0.3, -4.6, 0.7, 0.5, 0.25, 0xffe0b0, 0.2);
    // 侧柜台上的热水机 + 制冰机
    R.boxMesh(g0, 0.4, 0.58, 0.44, R.mat(0x39434c, { emissive: 0x121820, emissiveIntensity: 0.9 }), 2.15, 1.29, -4.3, 0, 0.012);
    R.boxMesh(g0, 0.36, 0.42, 0.4, R.mat(0xb8c2c8, { emissive: 0x1a2024, emissiveIntensity: 0.9 }), 2.15, 1.21, -3.3, 0, 0.012);
    R.boxMesh(g0, 0.3, 0.03, 0.34, R.glowMat(0xbfe6ff, 0.7), 2.15, 1.43, -3.3);
    // 香烟柜（东墙，面向店内）
    R.boxMesh(g0, 0.3, 0.5, 2.0, R.mat(0xd8dde0, { emissive: 0x1e2429, emissiveIntensity: 0.9 }), 2.2, 1.3, -4.6, 0, 0.012);
    for (var pi = 0; pi < 8; pi++) {
      for (var pj = 0; pj < 2; pj++) {
        addProd('pack', pickColor('pack'), 2.03, 1.2 + pj * 0.12, -5.4 + pi * 0.22, Math.PI / 2, 1);
      }
    }
    var staffTag2 = new THREE.Mesh(R.planeGeo(0.5, 0.16), new THREE.MeshBasicMaterial({ map: texTag('たばこ', '#f4f4f0', '#c05a2a'), fog: true }));
    staffTag2.position.set(2.03, 1.6, -4.6);
    staffTag2.rotation.y = -Math.PI / 2;
    g0.add(staffTag2);
    // 收银台上方吊牌
    var regTag = new THREE.Mesh(R.planeGeo(0.44, 0.2), new THREE.MeshBasicMaterial({ map: texTag('レジ', '#f4f8f4', '#2f9b6b'), fog: true, side: THREE.DoubleSide }));
    regTag.position.set(0.72, 2.25, -4.9);
    g0.add(regTag);
    R.boxMesh(g0, 0.01, 0.42, 0.01, mRail2, 0.72, 2.6, -4.9);

    /* ---------- 关东煮柜台（面向门口） ---------- */
    var oden = new THREE.Group();
    oden.position.set(1.45, 0.24, -2.85);
    g0.add(oden);
    var mSteel = R.mat(0xbfc7cd, { emissive: 0x1e2429, emissiveIntensity: 0.95 });
    R.boxMesh(oden, 1.0, 0.66, 0.9, mSteel, 0, 0.33, 0, 0, 0.016);
    R.boxMesh(oden, 0.96, 0.04, 0.86, R.mat(0x8f979e, { emissive: 0x181d21, emissiveIntensity: 0.9 }), 0, 0.68, 0);
    R.boxMesh(oden, 1.0, 0.06, 0.9, R.mat(0xd9701f, { emissive: 0x2c1607, emissiveIntensity: 1 }), 0, 0.09, 0, 0, 0.012);
    var potY = 0.78;
    var mBroth = R.mat(0xd9a05a, { emissive: 0xb8722a, emissiveIntensity: 0.65 });
    [-0.24, 0.24].forEach(function (px) {
      R.cylMesh(oden, 0.19, 0.19, 0.16, mSteel, px, potY + 0.08, 0);
      R.cylMesh(oden, 0.17, 0.17, 0.02, mBroth, px, potY + 0.15, 0);
      var hd2 = R.cylMesh(oden, 0.011, 0.011, 0.14, mSteel, px, 0.87, 0.21, 6);  // 提手
      hd2.rotation.z = Math.PI / 2;
      for (var s = 0; s < 4; s++) {                       // 串
        var sx = px - 0.09 + (s % 2) * 0.18, sz = -0.06 + Math.floor(s / 2) * 0.12;
        var sk = R.cylMesh(oden, 0.012, 0.012, 0.2, R.mat(s % 2 ? 0xc8923a : 0xe0d0a8, { emissive: 0x2a2214, emissiveIntensity: 0.9 }), sx, potY + 0.2, sz, 6);
        sk.rotation.x = R.rand(-0.2, 0.2); sk.rotation.z = R.rand(-0.2, 0.2);
      }
    });
    R.boxMesh(oden, 1.0, 0.3, 0.94, mCoolGlass, 0, 0.86, 0);   // 玻璃罩
    var odenSign = new THREE.Mesh(R.planeGeo(0.7, 0.26), new THREE.MeshBasicMaterial({ map: texOden(), fog: true }));
    odenSign.position.set(0, 1.16, -0.44);
    oden.add(odenSign);
    R.boxMesh(oden, 0.74, 0.3, 0.04, mRail2, 0, 1.16, -0.46);
    R.groundGlow(oden, 0, 0.75, 0.9, 0.6, 0.02, 0xffc890, 0.3);
    // 关东煮蒸汽（由 dynamics 驱动）
    R.steam = [];
    for (var st = 0; st < 4; st++) {
      var sp = R.halo(oden, -0.24 + (st % 2) * 0.48, 1.0, R.rand(-0.1, 0.1), 0.36, 0xffe4c0, 0.16);
      R.steam.push({ spr: sp, y0: 0.98, phase: st * 0.7, x: sp.position.x, z: sp.position.z });
    }

    /* ---------- 杂志架（近门口） ---------- */
    var mag = new THREE.Group();
    mag.position.set(-0.3, 0.24, -3.15);
    g0.add(mag);
    var mMag = R.mat(0xdbd8d0, { emissive: 0x28271f, emissiveIntensity: 0.85 });
    R.boxMesh(mag, 1.24, 0.04, 0.16, mMag, 0, 0.06, 0.44);
    R.boxMesh(mag, 1.24, 1.16, 0.05, mMag, 0, 0.62, -0.4);
    R.boxMesh(mag, 0.05, 1.2, 0.86, mMag, -0.6, 0.62, 0);
    R.boxMesh(mag, 0.05, 1.2, 0.86, mMag, 0.6, 0.62, 0);
    for (var tr = 0; tr < 3; tr++) {
      var ty = 0.34 + tr * 0.36;
      var shelf = R.boxMesh(mag, 1.2, 0.04, 0.34, mMag, 0, ty, 0.2);
      shelf.rotation.x = 0.34;
      for (var mc = 0; mc < 5; mc++) {
        var mz = 0.2 + Math.sin(0.34) * 0.02;
        addProd('mag', pickColor('mag'), mag.position.x - 0.48 + mc * 0.24,
          mag.position.y + ty + 0.14, mag.position.z + mz + 0.06, 0, 1);
      }
    }
    var magTag = new THREE.Mesh(R.planeGeo(0.5, 0.16), new THREE.MeshBasicMaterial({ map: texTag('雑誌', '#f4f2ec', '#2b6fb5'), fog: true }));
    magTag.position.set(0, 1.34, 0.1);
    mag.add(magTag);

    /* ---------- 饭团架（门口内侧） ---------- */
    var oni = new THREE.Group();
    oni.position.set(-3.0, 0.24, -2.8);
    g0.add(oni);
    var mOni = R.mat(0xcfd6d2, { emissive: 0x252a28, emissiveIntensity: 0.9 });
    R.boxMesh(oni, 1.2, 0.04, 0.16, mOni, 0, 0.06, 0.32);
    R.boxMesh(oni, 1.2, 0.96, 0.04, mOni, 0, 0.52, -0.28);
    R.boxMesh(oni, 0.04, 0.98, 0.6, mOni, -0.58, 0.53, 0);
    R.boxMesh(oni, 0.04, 0.98, 0.6, mOni, 0.58, 0.53, 0);
    for (var ot = 0; ot < 3; ot++) {
      var oy = 0.28 + ot * 0.3;
      R.boxMesh(oni, 1.14, 0.035, 0.3, mOni, 0, oy, 0.16).rotation.x = 0.3;
      for (var oc = 0; oc < 4; oc++) {
        var ox = -0.42 + oc * 0.28;
        addProd('onigiri', 0xf7f4ea, oni.position.x + ox,
          oni.position.y + oy + 0.09, oni.position.z + 0.2, R.rand(-0.3, 0.3), 1);
        addProd('nori', 0x23301e, oni.position.x + ox,
          oni.position.y + oy + 0.045, oni.position.z + 0.225, R.rand(-0.3, 0.3), 1);
      }
    }
    var oniTag = new THREE.Mesh(R.planeGeo(0.56, 0.18), new THREE.MeshBasicMaterial({ map: texTag('おにぎり', '#f4f2ec', '#c05a2a'), fog: true }));
    oniTag.position.set(0, 1.16, 0.05);
    oni.add(oniTag);

    /* ---------- 靠窗吧台 + 高脚凳（左窗内） ---------- */
    var mBar = R.mat(0xd6cdbb, { emissive: 0x2a251b, emissiveIntensity: 0.85, gradient: 5, soft: true });
    R.boxMesh(g0, 3.3, 0.06, 0.42, mBar, -6.25, 1.02, -1.55, 0, 0.012);
    R.boxMesh(g0, 0.08, 1.0, 0.3, mGond, -7.75, 0.51, -1.55);
    R.boxMesh(g0, 0.08, 1.0, 0.3, mGond, -4.75, 0.51, -1.55);
    R.boxMesh(g0, 3.3, 0.3, 0.06, mGond, -6.25, 0.4, -1.75);
    for (var si = 0; si < 3; si++) {
      var sx2 = -7.4 + si * 1.15;
      R.cylMesh(g0, 0.17, 0.17, 0.05, R.mat(0xc06a4a, { emissive: 0x2a140c, emissiveIntensity: 0.9 }), sx2, 0.68, -1.25, 12);
      R.cylMesh(g0, 0.022, 0.022, 0.42, mRail2, sx2, 0.45, -1.25, 8);
      R.cylMesh(g0, 0.11, 0.12, 0.03, mRail2, sx2, 0.26, -1.25, 10);
      R.boxMesh(g0, 0.24, 0.04, 0.02, mRail2, sx2, 0.92, -1.28);
    }
    // 吧台上的纸杯架 + 纸巾盒
    R.boxMesh(g0, 0.22, 0.24, 0.2, mRail2, -5.4, 1.16, -1.55, 0, 0.01);
    R.boxMesh(g0, 0.24, 0.1, 0.14, R.mat(0xe8e4dc), -7.2, 1.1, -1.5);

    /* ---------- 店内灯箱 / 海报 / 地面导视 ---------- */
    var menu = new THREE.Mesh(R.planeGeo(0.8, 1.0), new THREE.MeshBasicMaterial({ map: texMenu(), fog: true }));
    menu.position.set(2.3, 1.85, -4.6);
    menu.rotation.y = -Math.PI / 2;
    g0.add(menu);
    R.boxMesh(g0, 0.04, 1.08, 0.88, mRail2, 2.33, 1.85, -4.6, 0, 0.012);
    function inPoster(x, y, z, w, h, ry, idx) {
      var fr = new THREE.Group();
      R.boxMesh(fr, w + 0.05, h + 0.05, 0.02, mRail2, 0, 0, 0, 0, 0.008);
      var texP = R.tex('inPoster' + idx, 200, 250, function (g, w2, h2) {
        var cols = [['#f2d7e0', '#c0396b', 'SALE'], ['#dbe9f7', '#1f5fa8', 'NEW'], ['#fdf0d5', '#c07a1f', '限定']];
        var c2 = cols[idx % 3];
        g.fillStyle = c2[0]; g.fillRect(0, 0, w2, h2);
        g.fillStyle = c2[1];
        g.font = 'bold 40px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(c2[2], w2 / 2, 38);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.arc(w2 / 2, h2 * 0.52, 46, 0, Math.PI * 2); g.fill();
        g.fillStyle = c2[1];
        g.font = 'bold 26px ' + JP;
        g.fillText('おすすめ', w2 / 2, h2 * 0.82);
      });
      var pm = new THREE.Mesh(R.planeGeo(w, h), new THREE.MeshToonMaterial({
        map: texP, emissiveMap: texP, emissive: 0xcccccc, emissiveIntensity: 0.45, gradientMap: R.toonTex(4, true)
      }));
      pm.position.z = 0.015;
      fr.add(pm);
      fr.position.set(x, y, z);
      fr.rotation.y = ry;
      g0.add(fr);
    }
    inPoster(-8.33, 1.95, -3.2, 0.66, 0.84, Math.PI / 2, 0);
    inPoster(-8.33, 1.95, -5.6, 0.66, 0.84, Math.PI / 2, 1);
    inPoster(2.33, 2.2, -6.6, 0.6, 0.78, -Math.PI / 2, 2);
    // 地面导视箭头
    var mArrow = new THREE.MeshBasicMaterial({ map: texArrow(), transparent: true, depthWrite: false, fog: true });
    var a1 = new THREE.Mesh(R.planeGeo(0.9, 0.45), mArrow);
    a1.rotation.x = -Math.PI / 2; a1.rotation.z = 0;
    a1.position.set(-3.0, 0.25, -1.8);
    g0.add(a1);
    var a2 = new THREE.Mesh(R.planeGeo(0.9, 0.45), mArrow);
    a2.rotation.x = -Math.PI / 2; a2.rotation.z = -Math.PI / 2;
    a2.position.set(-2.0, 0.25, -4.2);
    g0.add(a2);
    // 门口内侧小垃圾桶
    R.cylMesh(g0, 0.15, 0.13, 0.5, R.mat(0x6f7a72, { emissive: 0x141a17, emissiveIntensity: 0.9 }), -1.75, 0.5, -1.5, 12);

    /* ---------- 天花消防件 + 非常口标志 ---------- */
    [[-6.5, -4.6], [-1.6, -6.2], [1.4, -2.6]].forEach(function (sp) {
      R.cylMesh(g0, 0.012, 0.012, 0.09, R.mat(0xc9ccd0, { emissive: 0x22262a, emissiveIntensity: 0.8 }), sp[0], 2.81, sp[1], 8);
      R.cylMesh(g0, 0.03, 0.026, 0.02, R.mat(0xd9d0c0, { emissive: 0x22201c, emissiveIntensity: 0.8 }), sp[0], 2.76, sp[1], 10);
    });
    R.cylMesh(g0, 0.07, 0.07, 0.03, R.mat(0xece8e0, { emissive: 0x2e2c28, emissiveIntensity: 0.8 }), 0.9, 2.85, -5.0, 12);  // 烟感
    R.boxMesh(g0, 0.54, 0.24, 0.03, R.mat(0x2f9b6b, { emissive: 0x0e2c1f, emissiveIntensity: 1 }), 0.2, 2.55, -9.13);
    var exitSign = new THREE.Mesh(R.planeGeo(0.5, 0.2), R.glowMat(0x7fe0a0, 0.9));
    exitSign.position.set(0.2, 2.55, -9.1);
    g0.add(exitSign);

    /* ---------- 汇总：按颜色分组的实例化商品 ---------- */
    var prodCount = 0, prodMeshes = 0;
    for (var key in prod) {
      var entry = prod[key];
      R.instanced(g0, GEOS[entry.geo], entry.hex, entry.list, {
        emissive: entry.hex, emissiveIntensity: 0.2, gradient: 4, soft: true
      });
      prodCount += entry.list.length;
      prodMeshes++;
    }

    R.interior = {
      group: g0,
      lightSpots: [
        { x: -5.4, y: 2.5, z: -3.4 },
        { x: -5.4, y: 2.5, z: -7.4 },
        { x: 1.2, y: 2.5, z: -4.4 }
      ],
      products: prodCount,
      productMeshes: prodMeshes
    };
    return g0;
  };
})();
