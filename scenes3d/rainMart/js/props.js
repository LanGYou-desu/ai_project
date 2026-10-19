/* ============================================================
 * 雨夜便利店 · js/props.js
 * 外景道具（精细几何版）：自动贩卖机 / 自行车与车架 / 雨伞架 / 垃圾桶 /
 * 路灯 / 电线杆与电线 / 路牌 / 护栏 / 空调外机 / 公告栏 / 小巷杂物 /
 * 邻家民居 / 背景建筑群 / 远处红绿灯 / 霓虹灯箱
 *
 * 建模原则：结构一律用真实几何表达（辐条 / 百叶 / 螺栓 / 格栅 / 铰链），
 *           贴图只承载图案信息（品牌 / 文字 / 标志），不模拟立体结构。
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R;
  var JP = '"Yu Gothic UI","Yu Gothic","Hiragino Kaku Gothic ProN","MS PGothic","Meiryo",sans-serif';

  /* ---------------- 几何小工具 ---------------- */
  // 圆弧件（挡泥板 / 提环 / 弹簧）
  function arcGeo(key, r, tube, arc, rseg, tseg) {
    return R.geo('arc|' + key, function () {
      return new THREE.TorusGeometry(r, tube, rseg || 6, tseg || 18, arc);
    });
  }
  // 开口四棱台管（车筐围栏）
  function openTube4(key, r1, r2, h) {
    return R.geo('ot4|' + key, function () {
      return new THREE.CylinderGeometry(r1, r2, h, 4, 1, true, Math.PI / 4, Math.PI * 2);
    });
  }

  /* ---------------- 贴图 ---------------- */
  // 贩卖机顶部品牌灯箱面
  function texVendingBrand(i) {
    return R.tex('vendingBrand' + i, 256, 64, function (g, w, h) {
      if (i === 0) {
        g.fillStyle = '#eef4fa'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#2b6fb5'; g.fillRect(0, 0, w, 11);
        g.fillStyle = '#245a8c';
        g.font = 'bold 26px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('つめたい のみもの', w / 2 - 26, h / 2 + 5);
        g.fillStyle = '#b03a3a';
        g.font = 'bold 22px ' + JP;
        g.fillText('¥130', w - 40, h / 2 + 5);
      } else {
        g.fillStyle = '#2b3550'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e08a3c'; g.fillRect(0, 0, w, 11);
        g.fillStyle = '#f2e2c8';
        g.font = 'bold 24px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('あったか〜い コーヒー', w / 2 - 18, h / 2 + 5);
        g.fillStyle = '#e0b062';
        g.font = 'bold 19px ' + JP;
        g.fillText('HOT', w - 32, h / 2 + 5);
      }
    });
  }
  function texHazard() {
    return R.tileTex('hazard', 64, 64, function (g, w, h) {
      g.fillStyle = '#e8c93f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#232323';
      for (var i = -2; i < 6; i++) {
        g.beginPath();
        g.moveTo(i * 16, h); g.lineTo(i * 16 + 16, h); g.lineTo(i * 16 + 32, 0); g.lineTo(i * 16 + 16, 0);
        g.closePath(); g.fill();
      }
    }, 4, 1);
  }
  function texPlate(text, bg, fg, w, h, fs) {
    return R.tex('plate|' + text + bg, w || 256, h || 96, function (g, W, H) {
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4;
      g.strokeRect(3, 3, W - 6, H - 6);
      g.fillStyle = fg;
      g.font = 'bold ' + (fs || 44) + 'px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, W / 2, H / 2 + 2);
    });
  }
  function texGuideGreen() {
    return R.tex('guideGreen', 512, 128, function (g, w, h) {
      g.fillStyle = '#1f6b46'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#f2f5f3'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#ffffff';
      g.font = 'bold 54px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('東町三丁目', 180, h / 2);
      g.beginPath();
      g.moveTo(400, 26); g.lineTo(470, 64); g.lineTo(400, 102);
      g.lineTo(400, 78); g.lineTo(330, 78); g.lineTo(330, 50); g.lineTo(400, 50);
      g.closePath(); g.fill();
    });
  }
  function texParkingSign() {
    return R.tex('parkSign', 128, 160, function (g, w, h) {
      g.fillStyle = '#2b6fb5'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#ffffff';
      g.font = 'bold 78px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('P', w / 2, 66);
      g.font = 'bold 26px ' + JP;
      g.fillText('駐車場', w / 2, 122);
    });
  }
  // 公告栏软木板底（纸张改为独立几何）
  function texCork() {
    return R.tex('cork', 256, 192, function (g, w, h) {
      g.fillStyle = '#a89272'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var v = 150 + Math.floor(R.rng() * 60);
        g.fillStyle = 'rgba(' + v + ',' + (v - 18) + ',' + (v - 40) + ',0.5)';
        g.fillRect(R.rng() * w, R.rng() * h, R.rng() * 3 + 1, R.rng() * 2 + 1);
      }
    });
  }
  // 公告纸张（三种版式）
  function texFlyer(i) {
    return R.tex('flyer' + i, 128, 176, function (g, w, h) {
      var cols = [['#f8f4ee', '#c0522a', '#3a4048'], ['#eef4fa', '#2b6fb5', '#37506a'], ['#f6f0e2', '#8a6a20', '#4a4436']][i % 3];
      g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
      g.fillStyle = cols[1]; g.fillRect(0, 0, w, 26);
      g.fillStyle = '#ffffff';
      g.font = 'bold 17px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['お知らせ', '講座のご案内', '秋の催し'][i % 3], w / 2, 13);
      g.fillStyle = cols[1];
      g.beginPath(); g.arc(w / 2, 62, 24, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(w / 2 - 6, 56, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = cols[2];
      for (var l = 0; l < 5; l++) g.fillRect(14, 96 + l * 12, w - 28 - (l === 4 ? 40 : 0), 4);
      g.fillStyle = cols[1];
      g.fillRect(14, h - 22, 52, 10);
    });
  }
  // 分类回收图示（瓶 / 罐 / 纸）
  function texRecycle(i) {
    return R.tex('recyclePict' + i, 64, 64, function (g, w, h) {
      g.fillStyle = '#f4f6f2'; g.fillRect(0, 0, w, h);
      var col = ['#2b6fb5', '#c0522a', '#4a545e'][i % 3];
      g.strokeStyle = col; g.lineWidth = 4; g.lineCap = 'round';
      if (i % 3 === 0) {           // 瓶
        g.strokeRect(24, 24, 16, 30);
        g.fillStyle = col; g.fillRect(28, 10, 8, 12);
        g.fillRect(26, 8, 12, 4);
      } else if (i % 3 === 1) {    // 罐
        g.strokeRect(20, 18, 24, 34);
        g.fillStyle = col;
        g.beginPath(); g.ellipse(32, 18, 12, 4, 0, 0, Math.PI * 2); g.fill();
      } else {                     // 报纸
        g.strokeRect(14, 20, 36, 26);
        g.beginPath(); g.moveTo(22, 28); g.lineTo(42, 28);
        g.moveTo(22, 36); g.lineTo(42, 36); g.stroke();
      }
      g.fillStyle = col;
      g.font = 'bold 12px ' + JP; g.textAlign = 'center';
      g.fillText(['ペット', 'カン', '古紙'][i % 3], 32, 62);
    });
  }
  function texShutter() {
    return R.tileTex('shutter', 64, 64, function (g, w, h) {
      g.fillStyle = '#9aa0a4'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(70,76,80,0.55)';
      for (var i = 0; i < 4; i++) g.fillRect(0, i * 16 + 12, w, 4);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (var j = 0; j < 4; j++) g.fillRect(0, j * 16, w, 3);
    }, 4, 1);
  }
  function texWindowPanel(lit) {
    return R.tex('winPanel' + (lit ? 1 : 0), 96, 128, function (g, w, h) {
      g.fillStyle = '#c7ccd2'; g.fillRect(0, 0, w, h);         // 窗框
      g.fillStyle = lit ? '#f6dcae' : '#28313e';
      g.fillRect(8, 8, w - 16, h - 16);
      if (lit) {
        g.fillStyle = 'rgba(200,150,90,0.35)';
        for (var i = 0; i < 7; i++) g.fillRect(8, 14 + i * 16, w - 16, 8);   // 百叶
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(8, 8, 22, h - 16);
      } else {
        g.fillStyle = 'rgba(150,180,205,0.18)';
        g.fillRect(8, 8, 26, h - 16);
        g.fillStyle = 'rgba(140,170,195,0.12)';
        g.fillRect(8, 8, w - 16, 10);
      }
      g.fillStyle = '#b6bbc1'; g.fillRect(w / 2 - 3, 8, 6, h - 16);
    });
  }
  // 背景楼立面（清水混凝土：层间压条 / 分格缝 / 雨渍；窗户为真实几何，不再画在贴图上）
  function texFacade(variant) {
    var key = 'facade' + variant + 'v3';
    if (R.__facadeCache && R.__facadeCache[key]) return R.__facadeCache[key];
    R.__facadeCache = R.__facadeCache || {};
    var map = R.makeCanvasTexture(320, 320, function (g, w, h) {
      g.fillStyle = variant === 0 ? '#3f444b' : '#383c43'; g.fillRect(0, 0, w, h);
      // 混凝土斑驳（亮斑 + 暗斑）
      for (var i = 0; i < 80; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.012 + R.rng() * 0.026).toFixed(3) + ')';
        g.fillRect(R.rng() * w, R.rng() * h, 14 + R.rng() * 34, 6 + R.rng() * 16);
      }
      for (var j = 0; j < 46; j++) {
        g.fillStyle = 'rgba(0,0,0,' + (0.03 + R.rng() * 0.05).toFixed(3) + ')';
        g.fillRect(R.rng() * w, R.rng() * h, 18 + R.rng() * 38, 8 + R.rng() * 16);
      }
      // 层间压条（上亮下暗，读出楼板节奏）
      for (var f = 0; f < 7; f++) {
        var y0 = 44 + f * 44;
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, y0 - 2, w, 2);
        g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(0, y0, w, 3);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y0 + 3, w, 1);
      }
      // 竖向分格缝
      for (var c = 0; c < 4; c++) {
        var x0 = 40 + c * 80;
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x0, 0, 2, h);
        g.fillStyle = 'rgba(255,255,255,0.045)'; g.fillRect(x0 + 2, 0, 1, h);
      }
      // 雨渍：自层间线向下拖尾
      for (var k = 0; k < 14; k++) {
        var sx = R.rng() * w, sy = 44 + Math.floor(R.rng() * 7) * 44;
        var ln = 26 + R.rng() * 88;
        var drip = g.createLinearGradient(0, sy, 0, sy + ln);
        drip.addColorStop(0, 'rgba(10,12,15,0.30)');
        drip.addColorStop(1, 'rgba(10,12,15,0)');
        g.fillStyle = drip;
        g.fillRect(sx, sy, 2 + R.rng() * 5, ln);
      }
    });
    var emi = R.makeCanvasTexture(320, 320, function (g, w, h) {
      // 极弱的夜色环境反射（不含任何假窗）；发光窗户全部由真实几何承担
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#10151c');
      grad.addColorStop(1, '#070a0e');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    });
    R.__facadeCache[key] = { map: map, emi: emi };
    return R.__facadeCache[key];
  }
  function texNeon() {
    return R.tex('neon', 96, 384, function (g, w, h) {
      g.fillStyle = '#121620'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ff7fb0'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#ffd0e2';
      g.font = 'bold 62px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      var t = 'カラオケ';
      for (var i = 0; i < t.length; i++) g.fillText(t[i], w / 2, 54 + i * 70);
    });
  }
  function texLaundry() {
    return R.tex('laundry', 320, 96, function (g, w, h) {
      g.fillStyle = '#eaf4fb'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b6fb5'; g.fillRect(0, 0, w, 10);
      g.fillStyle = '#245a8c';
      g.font = 'bold 40px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('コインランドリー', w / 2, 54);
    });
  }
  // 空调冷凝器翅片（细密横线）
  function texFin() {
    return R.tileTex('fin', 64, 64, function (g, w, h) {
      g.fillStyle = '#b4babe'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(90,98,105,0.75)';
      for (var i = 0; i < 16; i++) g.fillRect(0, i * 4 + 1, w, 1.6);
      g.fillStyle = 'rgba(255,255,255,0.20)';
      for (var j = 0; j < 16; j++) g.fillRect(0, j * 4 + 2.8, w, 1);
    }, 3, 3);
  }

  /* ---------------- 构建 ---------------- */
  R.buildProps = function (root) {
    var G = R.G;
    var g0 = new THREE.Group();
    g0.name = 'props';
    root.add(g0);
    R.props = { glows: {}, lights: [] };
    function expose(key, mesh, mat) {
      R.props.glows[key] = mesh;
      if (mat) R.props.glows[key + 'Mat'] = mat;
    }
    var mSteelDark = R.mat(0x3a4148, { emissive: 0x11161b, emissiveIntensity: 0.9 });
    var mPoleGray = R.mat(0xb4b6b4, { emissive: 0x191d20, emissiveIntensity: 0.85 });
    var mWhite = R.mat(0xe7eaeb, { emissive: 0x1c2124, emissiveIntensity: 0.8 });
    var mChrome = R.mat(0xbfc6cc, { emissive: 0x1d2329, emissiveIntensity: 0.95 });
    var mBrass = R.mat(0xb08a4a, { emissive: 0x2a2010, emissiveIntensity: 0.9 });
    var mPorc = R.mat(0xd8dde2, { emissive: 0x24282c, emissiveIntensity: 0.9 });
    var mPorc2 = R.mat(0xb8bec6, { emissive: 0x1c2126, emissiveIntensity: 0.9 });

    /* ---- 微型零件实例收集 ---- */
    var VB = { btn: [], chip: [], prod: {} };
    function pushProd(kind, hex, x, y, z, ry) {
      var k = kind + '|' + hex;
      if (!VB.prod[k]) VB.prod[k] = [];
      VB.prod[k].push({ x: x, y: y, z: z, ry: ry || 0 });
    }
    var IB = { step: [], fbolt: [], gbrk: [] };   // 电柱踏脚钉 / 法兰螺栓 / 护栏夹板
    var VGEOS = {
      can: R.cylGeo(0.031, 0.031, 0.105, 12),
      bottle: R.cylGeo(0.03, 0.034, 0.185, 12)
    };
    var VCAN_COLS = [0xd9524f, 0xe8873c, 0xe6c33f, 0x4f9fd9, 0x6fc46f, 0xf0f0f0, 0x2f7a5a, 0x8a4a8a];
    var VCUP_COLS = [0xc06a2a, 0xd9a05a, 0x8a5a2a, 0xe0c8a0, 0xa8442a];

    /* ---------- 自动贩卖机（结构全部为几何：橱窗 / 货道 / 按键 / 取物口） ---------- */
    var pad = R.mat(0x9b9d99, { emissive: 0x14181c, emissiveIntensity: 0.8 });
    R.patch(g0, 2.9, 0.55, 5.5, 1.85, G.GY + 0.012, pad);
    var mVCavity = R.mat(0x141a20, { emissive: 0x090d12, emissiveIntensity: 0.9, gradient: 4 });
    var mVPanel = R.mat(0xdfe3e6, { emissive: 0x272c30, emissiveIntensity: 0.9, gradient: 3 });
    var vGlass = R.mat(0x9fc8dc, {
      opacity: 0.13, transparent: true, depthWrite: false,
      emissive: 0x16262e, emissiveIntensity: 0.85, gradient: 2
    });
    function vending(x, faceIdx, bodyHex) {
      var mBody = R.mat(bodyHex, { emissive: 0x1a2028, emissiveIntensity: 0.9 });
      var y0 = G.GY, zC = 1.2, zF = zC + 0.37;
      // 底座 + 可调脚
      R.boxMesh(g0, 0.98, 0.07, 0.68, mSteelDark, x, y0 + 0.035, zC, 0, 0.01);
      [[-0.44, -0.28], [-0.44, 0.28], [0.44, -0.28], [0.44, 0.28]].forEach(function (f) {
        R.cylMesh(g0, 0.028, 0.034, 0.05, R.boltMat(), x + f[0], y0 - 0.008, zC + f[1], 8);
      });
      // 主体
      R.boxMesh(g0, 1.02, 1.58, 0.74, mBody, x, y0 + 0.07 + 0.79, zC, 0, 0.016);
      // 顶部品牌灯箱
      R.boxMesh(g0, 1.05, 0.31, 0.77, R.mat(0x2b3540, { emissive: 0x0c1216, emissiveIntensity: 0.9 }), x, y0 + 1.805, zC, 0, 0.012);
      var brand = new THREE.Mesh(R.planeGeo(1.0, 0.26), new THREE.MeshBasicMaterial({ map: texVendingBrand(faceIdx), fog: true }));
      brand.position.set(x, y0 + 1.805, zF + 0.011);
      g0.add(brand);
      // 顶部小细节：人感传感器 + 天线管
      R.boxMesh(g0, 0.1, 0.045, 0.06, mSteelDark, x - 0.2, y0 + 1.985, zF - 0.16);
      R.cylMesh(g0, 0.012, 0.012, 0.1, mSteelDark, x + 0.44, y0 + 2.1, zC - 0.3, 6);
      R.halo(g0, x, y0 + 1.83, zF + 0.08, 1.15, faceIdx === 0 ? 0xcfe8ff : 0xffdcb0, 0.24);
      // 展示橱窗：内凹腔 + 背光板
      var winY0 = y0 + 0.48, winY1 = y0 + 1.46, winCX = x - 0.04;
      R.boxMesh(g0, 0.8, 1.0, 0.5, mVCavity, winCX, (winY0 + winY1) / 2, zC + 0.02);
      R.boxMesh(g0, 0.76, 0.96, 0.02, R.mat(faceIdx === 0 ? 0x3c4c58 : 0x4a3c2c, {
        emissive: faceIdx === 0 ? 0x24323c : 0x2c2318, emissiveIntensity: 0.9, gradient: 4, soft: true
      }), winCX, (winY0 + winY1) / 2, zC - 0.19);
      // 窗框（上下左右）
      R.boxMesh(g0, 0.84, 0.035, 0.05, mSteelDark, winCX, winY0 - 0.02, zF - 0.03);
      R.boxMesh(g0, 0.84, 0.035, 0.05, mSteelDark, winCX, winY1 + 0.02, zF - 0.03);
      R.boxMesh(g0, 0.035, 1.04, 0.05, mSteelDark, winCX - 0.415, (winY0 + winY1) / 2, zF - 0.03);
      R.boxMesh(g0, 0.035, 1.04, 0.05, mSteelDark, winCX + 0.415, (winY0 + winY1) / 2, zF - 0.03);
      // 三层货道 + 商品（前后两排）+ 价签
      for (var row = 0; row < 3; row++) {
        var shY = winY0 + 0.17 + row * 0.28;
        R.boxMesh(g0, 0.76, 0.012, 0.42, mVPanel, winCX, shY, zC + 0.04);
        for (var c = 0; c < 4; c++) {
          var px = winCX - 0.29 + c * 0.19;
          var isCan = ((row + c) % 2) === 0;
          var kind = isCan ? 'can' : 'bottle';
          var hex = faceIdx === 0 ? VCAN_COLS[(row * 4 + c) % VCAN_COLS.length] : VCUP_COLS[(row * 4 + c) % VCUP_COLS.length];
          pushProd(kind, hex, px, shY + (isCan ? 0.062 : 0.1), 1.4, 0);
          pushProd(kind, VCAN_COLS[(row * 2 + c + 3) % VCAN_COLS.length], px, shY + (isCan ? 0.062 : 0.1), 1.19, 0);
          VB.chip.push({ x: px, y: shY - 0.026, z: 1.455 });
        }
      }
      // 橱窗玻璃（嵌在窗框内）
      R.boxMesh(g0, 0.8, 1.0, 0.012, vGlass, winCX, (winY0 + winY1) / 2, zF - 0.012).castShadow = false;
      // 控制面板（右列）：按键 + 显示屏 + 投币 / 纸币 / 退币
      R.boxMesh(g0, 0.3, 1.32, 0.02, mVPanel, x + 0.33, y0 + 0.86, zF + 0.004);
      for (var bi = 0; bi < 10; bi++) {
        VB.btn.push({ x: x + 0.25 + (bi % 2) * 0.16, y: y0 + 1.4 - Math.floor(bi / 2) * 0.05, z: zF + 0.018, rx: Math.PI / 2 });
      }
      R.boxMesh(g0, 0.24, 0.1, 0.025, mSteelDark, x + 0.33, y0 + 1.6, zF + 0.012);
      R.boxMesh(g0, 0.2, 0.07, 0.012, R.glowMat(0x8fd8b0, 1), x + 0.33, y0 + 1.6, zF + 0.028);
      // 投币板
      R.boxMesh(g0, 0.24, 0.3, 0.02, R.mat(0x9aa0a6, { emissive: 0x161b20, emissiveIntensity: 0.9 }), x + 0.33, y0 + 1.13, zF + 0.008);
      R.boxMesh(g0, 0.014, 0.05, 0.012, mVCavity, x + 0.33, y0 + 1.19, zF + 0.022);       // 投币口
      R.boxMesh(g0, 0.08, 0.014, 0.012, mVCavity, x + 0.33, y0 + 1.11, zF + 0.022);       // 纸币口
      R.cylMesh(g0, 0.013, 0.013, 0.02, mBrass, x + 0.39, y0 + 1.03, zF + 0.02, 8).rotation.x = Math.PI / 2; // 退币钮
      R.boxMesh(g0, 0.05, 0.03, 0.012, mBrass, x + 0.27, y0 + 1.03, zF + 0.02);           // 退币扳手
      // 取物口：内凹 + 盖板 + 把手 + 铰链
      R.boxMesh(g0, 0.8, 0.36, 0.18, mVCavity, x - 0.06, y0 + 0.33, zF - 0.1);
      R.boxMesh(g0, 0.84, 0.03, 0.03, mSteelDark, x - 0.06, y0 + 0.525, zF - 0.005);
      R.boxMesh(g0, 0.84, 0.03, 0.03, mSteelDark, x - 0.06, y0 + 0.135, zF - 0.005);
      R.boxMesh(g0, 0.03, 0.42, 0.03, mSteelDark, x - 0.46, y0 + 0.33, zF - 0.005);
      R.boxMesh(g0, 0.03, 0.42, 0.03, mSteelDark, x + 0.34, y0 + 0.33, zF - 0.005);
      var flap = R.boxMesh(g0, 0.72, 0.3, 0.018, R.mat(0x2c343c, { emissive: 0x0d1116, emissiveIntensity: 0.9 }), x - 0.06, y0 + 0.34, zF - 0.07);
      flap.rotation.x = -0.14;
      var fh = R.cylMesh(g0, 0.012, 0.012, 0.44, mSteelDark, x - 0.06, y0 + 0.29, zF - 0.052, 8);
      fh.rotation.z = Math.PI / 2;
      R.cylMesh(g0, 0.01, 0.01, 0.05, mSteelDark, x - 0.38, y0 + 0.48, zF - 0.048, 6).rotation.z = Math.PI / 2;
      R.cylMesh(g0, 0.01, 0.01, 0.05, mSteelDark, x + 0.26, y0 + 0.48, zF - 0.048, 6).rotation.z = Math.PI / 2;
      // 侧面百叶（左右各 6 条）
      for (var lv = 0; lv < 6; lv++) {
        R.boxMesh(g0, 0.02, 0.016, 0.44, mSteelDark, x - 0.515, y0 + 0.5 + lv * 0.08, zC);
        R.boxMesh(g0, 0.02, 0.016, 0.44, mSteelDark, x + 0.515, y0 + 0.5 + lv * 0.08, zC);
      }
      // 灯箱下的投光 + 地面光斑
      R.groundGlow(g0, x, 2.3, 1.5, 1.15, 0.15, faceIdx === 0 ? 0xbfe4ff : 0xffd9a8, 0.3);
      R.halo(g0, x, 1.5, zF + 0.06, 1.5, faceIdx === 0 ? 0xcfe8ff : 0xffdcb0, 0.28);
    }
    vending(3.65, 0, 0xeef1f4);
    vending(4.85, 1, 0x2b3550);
    expose('vending', R.groundGlow(g0, 4.25, 2.6, 3.2, 1.9, 0.151, 0x9fd0ff, 0.20));
    R.props.lights.push({ x: 4.25, y: 1.6, z: 2.1, color: 0xbfe0ff, intensity: 1.05, distance: 5.2, decay: 2.0 });
    /* ---------- 自行车 + 车架（真辐条 / 挡泥板 / 传动 / 线缆） ---------- */
    function bike(x, z, ry, hex, withBasket) {
      var b = new THREE.Group();
      var RY = 0.33;
      var mFrame = R.mat(hex, { emissive: 0x1a0f0c, emissiveIntensity: 0.9 });
      var mTire = R.mat(0x23282e, { emissive: 0x0b0e12, emissiveIntensity: 0.9 });
      var mSaddle = R.mat(0x2b2f36, { emissive: 0x0d1013, emissiveIntensity: 0.9 });
      var fenderGeo = arcGeo('fender', 0.346, 0.012, 2.0);
      function wheel(wx) {
        var tire = new THREE.Mesh(R.torusGeo(0.302, 0.03, 8, 26), mTire);
        tire.position.set(wx, RY, 0); b.add(tire);
        var rim = new THREE.Mesh(R.torusGeo(0.272, 0.012, 6, 26), mChrome);
        rim.position.set(wx, RY, 0); b.add(rim);
        var hub = R.cylMesh(b, 0.03, 0.03, 0.096, mChrome, wx, RY, 0, 10); hub.rotation.x = Math.PI / 2;
        var fl1 = R.cylMesh(b, 0.042, 0.042, 0.012, mChrome, wx, RY, 0.038, 10); fl1.rotation.x = Math.PI / 2;
        var fl2 = R.cylMesh(b, 0.042, 0.042, 0.012, mChrome, wx, RY, -0.038, 10); fl2.rotation.x = Math.PI / 2;
        for (var s = 0; s < 12; s++) {
          var a = s / 12 * Math.PI * 2 + 0.26;
          var zz = (s % 2) ? 0.032 : -0.032;
          R.tubeBetween(b, wx, RY, zz, wx + Math.cos(a) * 0.268, RY + Math.sin(a) * 0.268, 0, 0.0042, mChrome, 4);
        }
        R.tubeBetween(b, wx + Math.cos(0.7) * 0.286, RY + Math.sin(0.7) * 0.286, 0,
          wx + Math.cos(0.7) * 0.312, RY + Math.sin(0.7) * 0.312, 0, 0.006, mChrome, 5);
        var fen = new THREE.Mesh(fenderGeo, mChrome);
        fen.position.set(wx, RY, 0); fen.rotation.z = Math.PI / 2 - 1.0;
        b.add(fen);
        R.tubeBetween(b, wx - 0.3, RY + 0.13, 0, wx - 0.17, RY + 0.03, 0, 0.005, mChrome, 5);
        R.tubeBetween(b, wx + 0.3, RY + 0.13, 0, wx + 0.17, RY + 0.03, 0, 0.005, mChrome, 5);
      }
      wheel(-0.53); wheel(0.53);
      function tube(x1, y1, x2, y2, r, mat, seg) {
        var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
        var t = R.cylMesh(b, r, r, len, mat || mFrame, (x1 + x2) / 2, (y1 + y2) / 2, 0, seg || 10);
        t.rotation.z = Math.PI / 2 + Math.atan2(dy, dx);
        return t;
      }
      // 车架（含前叉双腿 / 头管）
      tube(0.02, 0.30, -0.53, RY, 0.022);            // 后下叉
      tube(0.06, 0.74, -0.53, RY, 0.018);            // 后上叉
      tube(0.02, 0.30, 0.08, 0.80, 0.024);           // 立管
      tube(0.02, 0.30, 0.50, 0.63, 0.026);           // 下管
      tube(0.08, 0.80, 0.48, 0.67, 0.024);           // 上管
      R.cylMesh(b, 0.026, 0.026, 0.16, mFrame, 0.49, 0.635, 0, 10);
      R.tubeBetween(b, 0.49, 0.6, 0.048, 0.53, RY, 0.048, 0.017, mChrome, 8);
      R.tubeBetween(b, 0.49, 0.6, -0.048, 0.53, RY, -0.048, 0.017, mChrome, 8);
      // 座管 + 车座 + 座轨
      tube(0.07, 0.79, 0.06, 0.88, 0.017);
      R.boxMesh(b, 0.22, 0.05, 0.13, mSaddle, 0.02, 0.905, 0);
      R.boxMesh(b, 0.09, 0.035, 0.06, mSaddle, 0.13, 0.9, 0);
      R.tubeBetween(b, -0.06, 0.872, 0.035, 0.09, 0.872, 0.035, 0.006, mChrome, 5);
      R.tubeBetween(b, -0.06, 0.872, -0.035, 0.09, 0.872, -0.035, 0.006, mChrome, 5);
      // 车把立管 + 车把 + 握把 + 车铃 + 刹车把
      tube(0.44, 0.66, 0.44, 1.0, 0.02);
      var bar = R.cylMesh(b, 0.014, 0.014, 0.5, mChrome, 0.44, 1.0, 0, 10);
      bar.rotation.x = Math.PI / 2;
      R.cylMesh(b, 0.019, 0.019, 0.11, mSaddle, 0.44, 1.0, 0.195, 10).rotation.x = Math.PI / 2;
      R.cylMesh(b, 0.019, 0.019, 0.11, mSaddle, 0.44, 1.0, -0.195, 10).rotation.x = Math.PI / 2;
      var bell = new THREE.Mesh(R.sphGeo(0.024, 10, 7), mChrome); bell.position.set(0.43, 1.035, 0.12); b.add(bell);
      R.boxMesh(b, 0.03, 0.012, 0.05, mSteelDark, 0.4, 1.03, 0.12);
      var lev1 = R.boxMesh(b, 0.07, 0.012, 0.028, mSteelDark, 0.5, 0.985, 0.15); lev1.rotation.z = -0.25;
      var lev2 = R.boxMesh(b, 0.07, 0.012, 0.028, mSteelDark, 0.5, 0.985, -0.15); lev2.rotation.z = -0.25;
      // 刹车线缆 + 车灯线
      R.tubeBetween(b, 0.5, 0.99, 0.16, 0.52, 0.62, 0.05, 0.005, mSteelDark, 5);
      R.tubeBetween(b, 0.52, 0.62, 0.05, 0.6, 0.66, 0.03, 0.005, mSteelDark, 5);
      R.tubeBetween(b, 0.5, 0.99, -0.16, 0.1, 0.72, -0.03, 0.005, mSteelDark, 5);
      R.tubeBetween(b, 0.1, 0.72, -0.03, -0.06, 0.72, -0.02, 0.005, mSteelDark, 5);
      // 传动：牙盘 / 曲柄 / 踏板 / 链条 / 飞轮
      var ring = R.cylMesh(b, 0.075, 0.075, 0.008, mChrome, 0.02, 0.3, 0.035, 22);
      ring.rotation.x = Math.PI / 2;
      R.cylMesh(b, 0.03, 0.03, 0.02, mSteelDark, 0.02, 0.3, 0.045, 8).rotation.x = Math.PI / 2;
      var crank1 = R.boxMesh(b, 0.02, 0.13, 0.016, mChrome, 0.02, 0.365, 0.056); crank1.rotation.z = 0.06;
      var crank2 = R.boxMesh(b, 0.02, 0.13, 0.016, mChrome, 0.02, 0.235, 0.056); crank2.rotation.z = 0.06;
      R.boxMesh(b, 0.09, 0.018, 0.05, mSteelDark, 0.02, 0.435, 0.08);
      R.boxMesh(b, 0.09, 0.018, 0.05, mSteelDark, 0.02, 0.165, 0.08);
      R.tubeBetween(b, 0.02, 0.373, 0.04, -0.53, 0.36, 0.035, 0.007, mSteelDark, 5);
      R.tubeBetween(b, 0.02, 0.227, 0.04, -0.53, 0.30, 0.035, 0.007, mSteelDark, 5);
      R.cylMesh(b, 0.032, 0.032, 0.01, mChrome, -0.53, RY, 0.04, 14).rotation.x = Math.PI / 2;
      // 后货架 + 支腿 + 弹簧夹
      R.boxMesh(b, 0.34, 0.014, 0.02, mChrome, -0.42, 0.745, 0.06);
      R.boxMesh(b, 0.34, 0.014, 0.02, mChrome, -0.42, 0.745, -0.06);
      R.tubeBetween(b, -0.3, 0.74, 0.07, -0.5, 0.36, 0.045, 0.006, mChrome, 6);
      R.tubeBetween(b, -0.3, 0.74, -0.07, -0.5, 0.36, -0.045, 0.006, mChrome, 6);
      R.tubeBetween(b, -0.57, 0.74, 0.06, -0.55, 0.7, 0.02, 0.006, mChrome, 6);
      var spring = new THREE.Mesh(arcGeo('rackSpring', 0.035, 0.007, Math.PI * 1.5), mChrome);
      spring.position.set(-0.5, 0.76, 0); spring.rotation.y = Math.PI / 2; b.add(spring);
      R.boxMesh(b, 0.02, 0.012, 0.1, mChrome, -0.5, 0.765, 0.03);
      // 前方车筐（铁丝围栏）
      if (withBasket) {
        var bw = new THREE.Mesh(openTube4('basket', 0.16, 0.125, 0.2), mChrome);
        bw.position.set(0.64, 0.73, 0); b.add(bw);
        var rim2 = new THREE.Mesh(openTube4('basketRim', 0.17, 0.162, 0.025), mChrome);
        rim2.position.set(0.64, 0.84, 0); b.add(rim2);
        R.boxMesh(b, 0.18, 0.008, 0.18, mChrome, 0.64, 0.635, 0);
        R.tubeBetween(b, 0.62, 0.63, 0.09, 0.52, 0.63, 0.05, 0.005, mChrome, 5);
        R.tubeBetween(b, 0.62, 0.63, -0.09, 0.52, 0.63, -0.05, 0.005, mChrome, 5);
      }
      // 车灯 + 反光片 + 支脚 + 挂锁
      var head = R.cylMesh(b, 0.045, 0.045, 0.07, R.mat(0xe8e8e2, { emissive: 0x8a8a80, emissiveIntensity: 0.7 }), 0.66, 0.72, 0, 10);
      head.rotation.z = Math.PI / 2;
      R.tubeBetween(b, 0.62, 0.72, 0.02, 0.5, 0.72, 0.02, 0.004, mSteelDark, 5);
      R.boxMesh(b, 0.02, 0.05, 0.08, R.mat(0xd94f2f, { emissive: 0x8a2a10, emissiveIntensity: 0.9 }), -0.6, 0.6, 0);
      R.boxMesh(b, 0.02, 0.04, 0.06, R.mat(0xd97a2f, { emissive: 0x6a3a10, emissiveIntensity: 0.9 }), 0.575, 0.52, 0);
      var leg = R.cylMesh(b, 0.012, 0.012, 0.34, mSteelDark, 0.02, 0.16, -0.06, 6);
      leg.rotation.x = 0.22;
      R.boxMesh(b, 0.05, 0.015, 0.04, mSteelDark, 0.02, 0.0, -0.1);
      var lock = new THREE.Mesh(R.torusGeo(0.05, 0.009, 6, 14), R.mat(0x2f4f6a, { emissive: 0x101a24, emissiveIntensity: 0.9 }));
      lock.position.set(0.12, 0.66, 0); lock.rotation.x = Math.PI / 2; lock.rotation.z = 0.4; b.add(lock);
      b.position.set(x, G.GY, z);
      b.rotation.y = ry;
      g0.add(b);
      R.contact(g0, x, z, 0.95, 0.42, 0.42, G.GY + 0.008).rotation.z = ry;
      return b;
    }
    bike(-6.4, 2.35, -1.62, 0x9a3b34, true);
    bike(-5.5, 2.45, -1.75, 0x2f4f6a, false);
    function rack(x, z) {
      R.cylMesh(g0, 0.026, 0.026, 0.62, mPoleGray, x, G.GY + 0.31, z - 0.3, 10);
      R.cylMesh(g0, 0.026, 0.026, 0.62, mPoleGray, x, G.GY + 0.31, z + 0.3, 10);
      var bar = R.cylMesh(g0, 0.026, 0.026, 0.62, mPoleGray, x, G.GY + 0.6, z, 10);
      bar.rotation.x = Math.PI / 2;
      R.cylMesh(g0, 0.045, 0.05, 0.03, mSteelDark, x, G.GY + 0.015, z - 0.3, 10);
      R.cylMesh(g0, 0.045, 0.05, 0.03, mSteelDark, x, G.GY + 0.015, z + 0.3, 10);
    }
    rack(-6.9, 2.35); rack(-5.2, 2.35);

    /* ---------- 雨伞架 + 雨伞（伞骨 / 伞尖 / J 形手柄） ---------- */
    var us = new THREE.Group();
    us.position.set(-4.32, G.GY, -0.5);
    g0.add(us);
    var mUmBasket = R.mat(0x8f979e, { emissive: 0x161b1f, emissiveIntensity: 0.9 });
    R.cylMesh(us, 0.2, 0.17, 0.56, mUmBasket, 0, 0.28, 0, 16);
    var usRim = new THREE.Mesh(R.torusGeo(0.2, 0.012, 6, 22), mChrome);
    usRim.rotation.x = Math.PI / 2; usRim.position.set(0, 0.56, 0); us.add(usRim);
    var usBase = new THREE.Mesh(R.torusGeo(0.165, 0.01, 6, 20), mSteelDark);
    usBase.rotation.x = Math.PI / 2; usBase.position.set(0, 0.025, 0); us.add(usBase);
    var usBot = new THREE.Mesh(R.circleGeo(0.16, 16), R.mat(0x2f353c, { emissive: 0x0d1116, emissiveIntensity: 0.9 }));
    usBot.rotation.x = -Math.PI / 2; usBot.position.set(0, 0.07, 0); us.add(usBot);
    R.cylMesh(us, 0.016, 0.016, 0.52, mUmBasket, 0, 0.3, 0, 8);
    var umbCols = [0x9fd0e8, 0xc0392b, 0x2b3a5c, 0xe0c04a];
    var mShaft = R.mat(0xc8ccd0, { emissive: 0x1e2226, emissiveIntensity: 0.9 });
    for (var ui = 0; ui < 4; ui++) {
      var ue = new THREE.Group();
      var a = ui * 1.55 + 0.4;
      var lean = R.rand(0.12, 0.3);
      var mU = R.mat(umbCols[ui], {
        emissive: umbCols[ui], emissiveIntensity: 0.12, opacity: ui === 0 ? 0.55 : 1,
        transparent: ui === 0, side: THREE.DoubleSide
      });
      var shaft = R.cylMesh(ue, 0.011, 0.011, 0.95, mShaft, 0, 0.5, 0, 6);
      var canopy = R.cylMesh(ue, 0.02, 0.155, 0.28, mU, 0, 0.88, 0, 10);
      var tip = R.cylMesh(ue, 0.008, 0.008, 0.08, mShaft, 0, 1.05, 0, 6);
      for (var rb = 0; rb < 4; rb++) {
        var ra = rb * Math.PI / 2 + 0.4;
        R.tubeBetween(ue, 0, 1.0, 0, Math.cos(ra) * 0.14, 0.79, Math.sin(ra) * 0.14, 0.004, mShaft, 4);
      }
      var hd = new THREE.Mesh(arcGeo('umHandle', 0.035, 0.009, Math.PI * 1.2), mShaft);
      hd.position.set(0.035, 0.055, 0); hd.rotation.y = Math.PI / 2; hd.rotation.z = Math.PI; ue.add(hd);
      var sp = R.cylMesh(ue, 0.012, 0.012, 0.1, mShaft, 0, 0.06, 0, 6);
      shaft.rotation.z = lean; canopy.rotation.z = lean; tip.rotation.z = lean; sp.rotation.z = lean;
      ue.position.set(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07);
      ue.rotation.y = a;
      us.add(ue);
    }
    R.contact(g0, -4.32, -0.5, 0.34, 0.34, 0.45, G.GY + 0.008);

    /* ---------- 垃圾桶（三分回收）：铰链 / 投口翻盖 / 图示牌 ---------- */
    var binCols = [0x3f78c0, 0xd9a03c, 0x9aa2a8];
    for (var bi = 0; bi < 3; bi++) {
      var bx = -0.66 + bi * 0.66;
      var bz = 2.55;
      R.boxMesh(g0, 0.44, 0.6, 0.44, R.mat(0x5f676d, { emissive: 0x141a1f, emissiveIntensity: 0.9 }), bx, G.GY + 0.31, bz, 0, 0.012);
      R.boxMesh(g0, 0.4, 0.06, 0.4, mSteelDark, bx, G.GY + 0.045, bz);
      [[-0.17, -0.17], [-0.17, 0.17], [0.17, -0.17], [0.17, 0.17]].forEach(function (f) {
        R.boxMesh(g0, 0.06, 0.03, 0.06, mSteelDark, bx + f[0], G.GY + 0.015, bz + f[1]);
      });
      var lid = R.boxMesh(g0, 0.48, 0.09, 0.48, R.mat(binCols[bi], { emissive: 0x101418, emissiveIntensity: 0.95, gradient: 4, soft: true }), bx, G.GY + 0.655, bz, 0, 0.012);
      R.boxMesh(g0, 0.12, 0.022, 0.03, mSteelDark, bx, G.GY + 0.71, bz + 0.2);
      R.cylMesh(g0, 0.012, 0.012, 0.05, mSteelDark, bx - 0.12, G.GY + 0.71, bz - 0.225, 8).rotation.z = Math.PI / 2;
      R.cylMesh(g0, 0.012, 0.012, 0.05, mSteelDark, bx + 0.12, G.GY + 0.71, bz - 0.225, 8).rotation.z = Math.PI / 2;
      // 投口（朝 +Z 面向人行道）+ 翻盖 + 弹簧
      R.boxMesh(g0, 0.3, 0.2, 0.02, R.mat(0x171c22, { emissive: 0x0a0e13, emissiveIntensity: 0.9 }), bx, G.GY + 0.52, bz + 0.215);
      var bflap = R.boxMesh(g0, 0.28, 0.2, 0.014, R.mat(0x39424a, { emissive: 0x11161b, emissiveIntensity: 0.9 }), bx, G.GY + 0.52, bz + 0.245);
      bflap.rotation.x = -0.22;
      R.cylMesh(g0, 0.011, 0.011, 0.24, mSteelDark, bx, G.GY + 0.625, bz + 0.25, 8).rotation.z = Math.PI / 2;
      var bspring = new THREE.Mesh(arcGeo('binSpring', 0.02, 0.005, Math.PI * 1.6), mChrome);
      bspring.position.set(bx + 0.13, G.GY + 0.61, bz + 0.235); bspring.rotation.x = Math.PI / 2; g0.add(bspring);
      // 分类图示牌
      var pict = texRecycle(bi);
      var plateM = R.mat(0xf4f6f2, {
        map: pict, emissiveMap: pict, emissive: 0x8a8a86, emissiveIntensity: 0.5, gradient: 4
      });
      R.boxMesh(g0, 0.3, 0.3, 0.014, plateM, bx, G.GY + 0.32, bz + 0.222);
      R.boxMesh(g0, 0.34, 0.34, 0.01, R.mat(0x8f979e, { emissive: 0x161b20, emissiveIntensity: 0.9 }), bx, G.GY + 0.32, bz + 0.212);
    }
    R.cylMesh(g0, 0.03, 0.03, 1.25, mPoleGray, 1.15, G.GY + 0.62, 2.9, 10);
    R.boltRing(g0, 1.15, G.GY + 0.015, 2.9, 0.07, 4, 'y', 0.009);
    var binSign = new THREE.Mesh(R.planeGeo(0.62, 0.24), new THREE.MeshToonMaterial({
      map: texPlate('ゴミは分別', '#f6f6f2', '#2f9b6b', 256, 96, 40),
      emissiveMap: texPlate('ゴミは分別', '#f6f6f2', '#2f9b6b', 256, 96, 40),
      emissive: 0x9a9a92, emissiveIntensity: 0.5, gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
    }));
    binSign.position.set(1.15, G.GY + 1.28, 2.9);
    g0.add(binSign);
    R.boxMesh(g0, 0.66, 0.28, 0.02, mSteelDark, 1.15, G.GY + 1.28, 2.885);
    R.bolt(g0, 1.15 - 0.27, G.GY + 1.42, 2.9, 0.008, 'z');
    R.bolt(g0, 1.15 + 0.27, G.GY + 1.42, 2.9, 0.008, 'z');
    /* ---------- 路灯（法兰 / 检修门 / 灯头罩 / 光电元件） ---------- */
    function streetLamp(x, z, h, big) {
      var g = new THREE.Group();
      g.position.set(x, G.GY, z);
      g0.add(g);
      R.cylMesh(g, 0.15, 0.17, 0.04, mSteelDark, 0, 0.02, 0, 14);
      R.boltRing(g, 0, 0.045, 0, 0.115, 4, 'y', 0.011);
      R.cylMesh(g, 0.1, 0.13, 0.16, mSteelDark, 0, 0.08, 0, 14);
      R.cylMesh(g, h * 0.011, h * 0.02, h, mPoleGray, 0, h / 2, 0, 16);
      R.cylMesh(g, h * 0.016, h * 0.016, 0.05, mPoleGray, 0, h * 0.55, 0, 16);
      var door = R.boxMesh(g, 0.06, 0.18, 0.012, R.mat(0xa8aaad, { emissive: 0x181c1f, emissiveIntensity: 0.9 }), 0, 0.42, 0.105);
      door.rotation.y = 0.15;
      R.bolt(g, 0.04, 0.46, 0.112, 0.007, 'z');
      R.bolt(g, 0.04, 0.38, 0.112, 0.007, 'z');
      if (big) {
        R.boxMesh(g, 0.34, 0.36, 0.34, mSteelDark, 0, h + 0.1, 0, 0, 0.014);
        R.boxMesh(g, 0.4, 0.05, 0.4, mPoleGray, 0, h + 0.305, 0);
        R.cylMesh(g, 0.02, 0.02, 0.07, mSteelDark, 0, h + 0.36, 0, 8);
        var ring = new THREE.Mesh(R.torusGeo(0.145, 0.012, 6, 22), mPoleGray);
        ring.rotation.x = Math.PI / 2; ring.position.set(0, h - 0.085, 0); g.add(ring);
        var panelMat = R.glowMat(0xffeccb, 1);
        var pn = new THREE.Mesh(R.planeGeo(0.28, 0.28), panelMat);
        pn.rotation.x = Math.PI / 2;
        pn.position.set(0, h - 0.075, 0);
        g.add(pn);
        R.tubeBetween(g, 0, h + 0.32, 0.145, 0, h + 0.06, 0.145, 0.01, mSteelDark, 6);
        R.tubeBetween(g, 0, h + 0.32, -0.145, 0, h + 0.06, -0.145, 0.01, mSteelDark, 6);
        R.cylMesh(g, 0.022, 0.022, 0.05, mSteelDark, 0.14, h + 0.33, 0.12, 8);
        R.halo(g, 0, h, 0, 1.7, 0xffe3b0, 0.5);
        R.halo(g, 0, h - 0.2, 0, 3.4, 0xffdca8, 0.18);
        var openCyl = R.geo('openCyl|' + (h - 0.2).toFixed(2), function () {
          return new THREE.CylinderGeometry(1.5, 0.42, h - 0.2, 14, 1, true);
        });
        var shaft = new THREE.Mesh(openCyl, R.addMat(0xffd9a0, 0.05));
        shaft.position.y = (h - 0.2) / 2;
        g.add(shaft);
        expose('lamp', R.groundGlow(g0, x, z + 0.5, 3.6, 3.0, 0.145, 0xffd9a2, 0.34));
        R.props.lights.push({ x: x, y: h - 0.1, z: z, color: 0xffdcae, intensity: 2.3, distance: 15, decay: 1.9 });
      } else {
        R.boxMesh(g, 0.2, 0.22, 0.2, mSteelDark, 0, h + 0.06, 0, 0, 0.01);
        R.boxMesh(g, 0.24, 0.04, 0.24, mPoleGray, 0, h + 0.19, 0);
        R.cylMesh(g, 0.012, 0.012, 0.05, mSteelDark, 0, h + 0.23, 0, 6);
        var ring2 = new THREE.Mesh(R.torusGeo(0.085, 0.008, 6, 16), mPoleGray);
        ring2.rotation.x = Math.PI / 2; ring2.position.set(0, h - 0.05, 0); g.add(ring2);
        var pn2 = new THREE.Mesh(R.planeGeo(0.16, 0.16), R.glowMat(0xdfe8f2, 1));
        pn2.rotation.x = Math.PI / 2;
        pn2.position.set(0, h - 0.045, 0);
        g.add(pn2);
        R.halo(g, 0, h, 0, 0.9, 0xcfe0f2, 0.34);
        R.groundGlow(g0, x, z + 0.4, 1.8, 1.5, 0.145, 0xbcd4ee, 0.16);
      }
      R.contact(g0, x, z, 0.3, 0.3, 0.4, G.GY + 0.008);
    }
    streetLamp(4.6, 4.35, 4.2, true);
    streetLamp(-11.4, 4.4, 3.6, false);
    streetLamp(13.1, -6.2, 3.6, false);
    streetLamp(-6.2, 10.0, 3.4, false);

    /* ---------- 电线杆 + 电线（踏脚钉 / 横担 / 瓷瓶 / 变压器 / 熔断器） ---------- */
    var mPole = R.mat(0xa8a8a2, { emissive: 0x191c1e, emissiveIntensity: 0.85 });
    var mArm = R.mat(0x6b6f72, { emissive: 0x14181a, emissiveIntensity: 0.9 });
    function insulator(parent, x, y, z) {
      R.cylMesh(parent, 0.026, 0.032, 0.05, mPorc, x, y, z, 10);
      R.cylMesh(parent, 0.055, 0.048, 0.02, mPorc, x, y + 0.034, z, 12);
      R.cylMesh(parent, 0.047, 0.04, 0.02, mPorc, x, y + 0.055, z, 12);
      R.cylMesh(parent, 0.028, 0.03, 0.05, mPorc2, x, y + 0.076, z, 10);
      R.cylMesh(parent, 0.009, 0.009, 0.03, mSteelDark, x, y + 0.112, z, 6);
    }
    function crossarm(parent, y, along, half) {
      var len = half * 2 + 0.1;
      if (along === 'x') {
        R.boxMesh(parent, len, 0.09, 0.09, mArm, 0, y, 0, 0, 0.012);
        for (var i = -1; i <= 1; i++) insulator(parent, i * half, y + 0.05, 0);
        R.tubeBetween(parent, -half * 0.9, y - 0.03, 0, -0.08, y - 0.6, 0, 0.014, mArm, 6);
        R.tubeBetween(parent, half * 0.9, y - 0.03, 0, 0.08, y - 0.6, 0, 0.014, mArm, 6);
      } else {
        R.boxMesh(parent, 0.09, 0.09, len, mArm, 0, y, 0, 0, 0.012);
        for (var j = -1; j <= 1; j++) insulator(parent, 0, y + 0.05, j * half);
        R.tubeBetween(parent, 0, y - 0.03, -half * 0.9, 0, y - 0.6, -0.08, 0.014, mArm, 6);
        R.tubeBetween(parent, 0, y - 0.03, half * 0.9, 0, y - 0.6, 0.08, 0.014, mArm, 6);
      }
    }
    function utilityPole(x, z, h, withStuff) {
      var g = new THREE.Group();
      g.position.set(x, G.GY, z);
      g0.add(g);
      R.cylMesh(g, 0.3, 0.34, 0.22, R.mat(0x8f8c85, { emissive: 0x16191c, emissiveIntensity: 0.85 }), 0, 0.11, 0, 12);
      R.cylMesh(g, 0.16, 0.24, h, mPole, 0, h / 2, 0, 16);
      R.cylMesh(g, 0.19, 0.19, 0.03, mPole, 0, h * 0.34, 0, 16);
      R.cylMesh(g, 0.185, 0.185, 0.03, mPole, 0, h * 0.67, 0, 16);
      R.cylMesh(g, 0.25, 0.25, 0.62, R.mat(0xd9c34a, { map: texHazard(), emissive: 0x252012, emissiveIntensity: 0.9 }), 0, 1.15, 0, 12);
      R.cylMesh(g, 0.252, 0.252, 0.03, mSteelDark, 0, 1.44, 0, 12);
      R.cylMesh(g, 0.252, 0.252, 0.03, mSteelDark, 0, 0.86, 0, 12);
      // 踏脚钉（实例化收集，世界坐标）
      var sb;
      for (sb = 0; sb < 9; sb++) {
        IB.step.push({ x: x - 0.15, y: G.GY + 1.9 + sb * 0.44, z: z, rz: Math.PI / 2 });
        IB.step.push({ x: x + 0.15, y: G.GY + 2.12 + sb * 0.44, z: z, rz: Math.PI / 2 });
      }
      if (withStuff) {
        crossarm(g, h - 0.5, 'z', 0.62);
        crossarm(g, h - 1.1, 'x', 0.62);
        // 变压器（桶身 + 散热片 + 吊架 + 套管）
        var tx = -0.48, ty = h - 2.6;
        R.cylMesh(g, 0.33, 0.33, 0.72, R.mat(0x7f8488, { emissive: 0x181c1f, emissiveIntensity: 0.9 }), tx, ty, 0, 14);
        R.cylMesh(g, 0.35, 0.35, 0.05, mSteelDark, tx, ty + 0.36, 0, 14);
        for (var fi = 0; fi < 8; fi++) {
          var fa = fi / 8 * Math.PI * 2;
          var fin = R.boxMesh(g, 0.05, 0.6, 0.1, R.mat(0x8f9498, { emissive: 0x191d20, emissiveIntensity: 0.9 }),
            tx + Math.cos(fa) * 0.34, ty, Math.sin(fa) * 0.34);
          fin.rotation.y = -fa;
        }
        R.cylMesh(g, 0.03, 0.03, 0.12, mPorc, tx - 0.14, ty + 0.44, 0, 8);
        R.cylMesh(g, 0.03, 0.03, 0.12, mPorc, tx + 0.14, ty + 0.44, 0, 8);
        R.tubeBetween(g, tx, ty + 0.4, 0, -0.12, h - 2.0, 0, 0.022, mSteelDark, 6);
        R.boxMesh(g, 0.08, 0.5, 0.08, mSteelDark, tx + 0.22, ty, 0);
        // 跌落式熔断器 ×2
        for (var fu = -1; fu <= 1; fu += 2) {
          R.cylMesh(g, 0.03, 0.03, 0.1, mPorc, fu * 0.38, h - 1.5, 0.17, 8);
          R.cylMesh(g, 0.021, 0.021, 0.3, mPorc2, fu * 0.38, h - 1.68, 0.17, 8);
          R.boxMesh(g, 0.018, 0.3, 0.018, mSteelDark, fu * 0.38, h - 1.68, 0.2);
          R.tubeBetween(g, fu * 0.38, h - 1.45, 0.08, fu * 0.35, h - 1.2, 0.02, 0.01, mSteelDark, 5);
          R.tubeBetween(g, fu * 0.38, h - 1.83, 0.17, fu * 0.5, h - 2.05, 0.1, 0.012, mSteelDark, 5);
        }
        // 电缆盘
        var coil = new THREE.Mesh(R.torusGeo(0.23, 0.05, 6, 14), R.mat(0x2f353b, { emissive: 0x0c0f13, emissiveIntensity: 0.9 }));
        coil.position.set(0.1, 4.1, 0.05);
        coil.rotation.y = 0.4;
        g.add(coil);
        R.tubeBetween(g, 0.24, 4.0, 0.05, 0.12, 3.6, 0.05, 0.01, mSteelDark, 5);
        // 街名牌 + 电柱广告（带框与螺栓）
        var namePlate = new THREE.Mesh(R.planeGeo(0.54, 0.2), new THREE.MeshToonMaterial({
          map: texPlate('東町三丁目', '#f4f6f4', '#245a8c', 256, 96, 40),
          emissiveMap: texPlate('東町三丁目', '#f4f6f4', '#245a8c', 256, 96, 40),
          emissive: 0x9a9a94, emissiveIntensity: 0.45, gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
        }));
        namePlate.position.set(0, 2.75, 0.27);
        g.add(namePlate);
        R.bolt(g, 0, 2.75, 0.28, 0.007, 'z');
        var ad = new THREE.Mesh(R.planeGeo(0.4, 0.56), new THREE.MeshToonMaterial({
          map: texPlate('不動産', '#f7f7f2', '#c0522a', 192, 256, 48),
          emissiveMap: texPlate('不動産', '#f7f7f2', '#c0522a', 192, 256, 48),
          emissive: 0x8a8a84, emissiveIntensity: 0.5, gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
        }));
        ad.position.set(0.29, 2.0, 0);
        ad.rotation.y = Math.PI / 2;
        g.add(ad);
        R.boxMesh(g, 0.03, 0.6, 0.44, mSteelDark, 0.27, 2.0, 0);
        R.bolt(g, 0.3, 2.2, 0.16, 0.007, 'x');
        R.bolt(g, 0.3, 1.8, 0.16, 0.007, 'x');
      } else {
        crossarm(g, h - 0.5, 'z', 0.62);
      }
      return g;
    }
    utilityPole(6.9, 4.3, 9.2, true);
    utilityPole(-14.15, 3.85, 8.6, false);
    utilityPole(6.9, -14.35, 8.6, false);
    // 电线（悬链线近似）
    var mWire = new THREE.LineBasicMaterial({ color: 0x0e131b, fog: true });
    function wire(x1, y1, z1, x2, y2, z2, sag) {
      var pts = [], n = 16;
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        var s = 4 * t * (1 - t);
        pts.push(new THREE.Vector3(
          x1 + (x2 - x1) * t,
          y1 + (y2 - y1) * t - sag * s,
          z1 + (z2 - z1) * t));
      }
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      g0.add(new THREE.Line(geo, mWire));
    }
    var pw = [
      { y: 8.86, dt: -0.16, dy: -0.60, ze: -0.62 },
      { y: 8.26, dt: -0.16, dy: 0.0, ze: 0.62 },
      { y: 8.06, dt: 0.2, dy: -0.30, ze: 0 }
    ];
    for (var wi = 0; wi < pw.length; wi++) {
      wire(pw[wi].dt > 0 ? 7.9 : 6.9, pw[wi].y, 4.3, -14.15, pw[wi].y + pw[wi].dy, 3.85 + pw[wi].ze, 0.5);
      wire(-14.15, pw[wi].y + pw[wi].dy, 3.85 + pw[wi].ze, -15.05, pw[wi].y + pw[wi].dy - 0.05, 3.8, 0.04);
    }
    wire(6.9, 8.2, 4.3, 6.9, 8.1, -14.35, 0.55);
    wire(7.1, 7.85, 4.3, 7.1, 7.75, -14.35, 0.6);
    wire(6.4, 7.9, 4.3, 2.4, 3.55, -0.72, 0.35);       // 引入线到便利店屋顶
    wire(6.3, 7.75, 4.3, 2.1, 3.45, -0.78, 0.4);
    wire(13.6, 8.0, 4.3, 6.9, 8.1, 4.3, 0.0);          // 通向画面外的支线
    wire(6.9, 8.1, 4.3, 6.9, 8.0, 15.2, 0.6);
    /* ---------- 路牌（背框 / 抱箍 / 法兰） ---------- */
    var sign = new THREE.Group();
    sign.position.set(5.35, G.GY, 4.62);
    sign.rotation.y = -0.14;
    g0.add(sign);
    R.cylMesh(sign, 0.045, 0.05, 2.9, mPoleGray, 0, 1.45, 0, 12);
    R.cylMesh(sign, 0.09, 0.11, 0.12, mSteelDark, 0, 0.06, 0, 12);
    R.boltRing(sign, 0, 0.02, 0, 0.075, 4, 'y', 0.009);
    R.boxMesh(sign, 1.54, 0.42, 0.03, mSteelDark, 0, 2.55, 0);
    R.boxMesh(sign, 0.04, 0.36, 0.04, mSteelDark, -0.5, 2.55, 0);
    R.boxMesh(sign, 0.04, 0.36, 0.04, mSteelDark, 0.5, 2.55, 0);
    var guide = new THREE.Mesh(R.planeGeo(1.5, 0.38), new THREE.MeshToonMaterial({
      map: texGuideGreen(), emissiveMap: texGuideGreen(), emissive: 0x8a8f8a, emissiveIntensity: 0.45,
      gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
    }));
    guide.position.set(0, 2.55, 0.035);
    sign.add(guide);
    R.boxMesh(sign, 0.12, 0.06, 0.1, mSteelDark, 0, 2.55, 0.02);
    R.bolt(sign, -0.09, 2.55, 0.075, 0.007, 'z');
    R.bolt(sign, 0.09, 2.55, 0.075, 0.007, 'z');
    R.boxMesh(sign, 0.5, 0.6, 0.03, mSteelDark, 0, 1.92, 0);
    var park = new THREE.Mesh(R.planeGeo(0.46, 0.56), new THREE.MeshToonMaterial({
      map: texParkingSign(), emissiveMap: texParkingSign(), emissive: 0x8f949a, emissiveIntensity: 0.5,
      gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
    }));
    park.position.set(0, 1.92, 0.035);
    sign.add(park);
    R.boxMesh(sign, 0.1, 0.05, 0.09, mSteelDark, 0, 1.92, 0.018);
    R.bolt(sign, -0.08, 1.92, 0.07, 0.006, 'z');
    R.bolt(sign, 0.08, 1.92, 0.07, 0.006, 'z');

    /* ---------- 街角护栏（法兰 / 抱箍 / 反光板 / 端头封盖） ---------- */
    var mGuard = R.mat(0xe9ecec, { emissive: 0x232829, emissiveIntensity: 0.85 });
    var mRefl = R.mat(0xd9a02f, { emissive: 0x6a4a10, emissiveIntensity: 1 });
    function guardPost(px, pz) {
      R.cylMesh(g0, 0.075, 0.085, 0.03, mSteelDark, px, G.GY + 0.015, pz, 12);
      R.cylMesh(g0, 0.042, 0.05, 0.74, mGuard, px, G.GY + 0.4, pz, 12);
    }
    function guardX(x0, x1, z) {
      var n = Math.max(2, Math.round((x1 - x0) / 1.6) + 1);
      for (var i = 0; i < n; i++) {
        var x = x0 + (x1 - x0) * i / (n - 1);
        guardPost(x, z);
        R.bolt(g0, x - 0.05, G.GY + 0.035, z, 0.009, 'y');
        R.bolt(g0, x + 0.05, G.GY + 0.035, z, 0.009, 'y');
        IB.gbrk.push({ x: x, y: G.GY + 0.73, z: z });
        IB.gbrk.push({ x: x, y: G.GY + 0.45, z: z });
        R.boxMesh(g0, 0.07, 0.12, 0.014, mWhite, x, G.GY + 0.62, z + 0.052);
        R.boxMesh(g0, 0.05, 0.08, 0.012, mRefl, x, G.GY + 0.62, z + 0.062);
        R.bolt(g0, x, G.GY + 0.62, z + 0.072, 0.006, 'z');
      }
      R.cylMesh(g0, 0.034, 0.034, x1 - x0 + 0.05, mGuard, (x0 + x1) / 2, G.GY + 0.73, z, 12).rotation.z = Math.PI / 2;
      R.cylMesh(g0, 0.03, 0.03, x1 - x0 + 0.05, mGuard, (x0 + x1) / 2, G.GY + 0.45, z, 12).rotation.z = Math.PI / 2;
      [[x0 - 0.025, 0.73, 0.035], [x1 + 0.025, 0.73, 0.035], [x0 - 0.025, 0.45, 0.03], [x1 + 0.025, 0.45, 0.03]].forEach(function (c) {
        var cap = new THREE.Mesh(R.sphGeo(c[2], 10, 8), mGuard);
        cap.position.set(c[0], G.GY + c[1], z);
        g0.add(cap);
      });
    }
    function guardZ(z0, z1, x) {
      var n = Math.max(2, Math.round((z1 - z0) / 1.6) + 1);
      for (var i = 0; i < n; i++) {
        var z = z0 + (z1 - z0) * i / (n - 1);
        guardPost(x, z);
        R.bolt(g0, x, G.GY + 0.035, z - 0.05, 0.009, 'y');
        R.bolt(g0, x, G.GY + 0.035, z + 0.05, 0.009, 'y');
        IB.gbrk.push({ x: x, y: G.GY + 0.73, z: z });
        IB.gbrk.push({ x: x, y: G.GY + 0.45, z: z });
        R.boxMesh(g0, 0.014, 0.12, 0.07, mWhite, x + 0.052, G.GY + 0.62, z);
        R.boxMesh(g0, 0.012, 0.08, 0.05, mRefl, x + 0.062, G.GY + 0.62, z);
        R.bolt(g0, x + 0.072, G.GY + 0.62, z, 0.006, 'x');
      }
      R.cylMesh(g0, 0.034, 0.034, z1 - z0 + 0.05, mGuard, x, G.GY + 0.73, (z0 + z1) / 2, 12).rotation.x = Math.PI / 2;
      R.cylMesh(g0, 0.03, 0.03, z1 - z0 + 0.05, mGuard, x, G.GY + 0.45, (z0 + z1) / 2, 12).rotation.x = Math.PI / 2;
      [[z0 - 0.025, 0.73, 0.035], [z1 + 0.025, 0.73, 0.035], [z0 - 0.025, 0.45, 0.03], [z1 + 0.025, 0.45, 0.03]].forEach(function (c) {
        var cap = new THREE.Mesh(R.sphGeo(c[2], 10, 8), mGuard);
        cap.position.set(x, G.GY + c[1], c[0]);
        g0.add(cap);
      });
    }
    guardX(-6.6, 3.1, 5.12);
    guardZ(-1.7, 4.6, 7.66);
    guardX(-4.6, 2.4, 9.85);

    /* ---------- 空调外机（风扇格栅 / 叶片 / 百叶 / 铜管 / 检修阀） ---------- */
    var mAC = R.mat(0xc4c8cb, { emissive: 0x1a1f24, emissiveIntensity: 0.9 });
    var mFin = R.mat(0xd7dde0, { map: texFin(), emissive: 0x1c2126, emissiveIntensity: 0.85 });
    var mCopper = R.mat(0xb08050, { emissive: 0x2a1e10, emissiveIntensity: 0.9 });
    var mFanPart = R.mat(0x8f959a, { emissive: 0x171b1f, emissiveIntensity: 0.9 });
    function acUnit(x, y, z, ry, w2, hh, dd, wallMount) {
      w2 = w2 || 0.82; hh = hh || 0.6; dd = dd || 0.34;
      var a = new THREE.Group();
      a.position.set(x, y, z);
      a.rotation.y = ry || 0;
      g0.add(a);
      R.boxMesh(a, w2, hh, dd, mAC, 0, 0, 0, 0, 0.014);
      R.boxMesh(a, w2 * 0.96, hh * 0.96, 0.02, R.mat(0x9aa0a5, { emissive: 0x161b20, emissiveIntensity: 0.9 }), 0, 0, dd / 2 + 0.005);
      var fcx = w2 * 0.22, fr = hh * 0.34;
      var ring = new THREE.Mesh(R.torusGeo(fr, 0.012, 6, 22), R.mat(0x6b7176, { emissive: 0x12161a, emissiveIntensity: 0.9 }));
      ring.position.set(fcx, 0, dd / 2 + 0.022); a.add(ring);
      for (var fs = 0; fs < 12; fs++) {
        var fa = fs / 12 * Math.PI * 2;
        var bar = R.boxMesh(a, fr * 0.94, 0.011, 0.011, mFanPart, fcx + Math.cos(fa) * fr * 0.47, Math.sin(fa) * fr * 0.47, dd / 2 + 0.03);
        bar.rotation.z = fa;
      }
      R.cylMesh(a, 0.035, 0.035, 0.02, R.mat(0x5b6167, { emissive: 0x101418, emissiveIntensity: 0.9 }), fcx, 0, dd / 2 + 0.036, 10).rotation.x = Math.PI / 2;
      for (var bl = 0; bl < 3; bl++) {
        var blade = R.boxMesh(a, hh * 0.3, 0.02, 0.014, mFanPart, fcx, 0, dd / 2 - 0.004);
        blade.rotation.z = bl * 2.094 + 0.5;
      }
      for (var lv = 0; lv < 5; lv++) {
        R.boxMesh(a, 0.02, 0.02, dd * 0.72, R.mat(0x9aa0a5, { emissive: 0x161b20, emissiveIntensity: 0.9 }), -w2 / 2 - 0.005, -hh * 0.3 + lv * 0.05, 0);
      }
      R.boxMesh(a, w2 * 0.9, hh * 0.9, 0.02, mFin, 0, 0, -dd / 2 - 0.005);
      R.tubeBetween(a, w2 * 0.22, -hh / 2 + 0.02, -dd / 2 - 0.02, w2 * 0.22, -hh / 2 - 0.26, -dd / 2 - 0.02, 0.011, mCopper, 6);
      R.tubeBetween(a, w2 * 0.22, -hh / 2 - 0.26, -dd / 2 - 0.02, w2 * 0.34, -hh / 2 - 0.34, -dd / 2 - 0.07, 0.011, mCopper, 6);
      R.tubeBetween(a, w2 * 0.1, -hh / 2 + 0.02, -dd / 2 - 0.02, w2 * 0.1, -hh / 2 - 0.2, -dd / 2 - 0.02, 0.011, mCopper, 6);
      R.cylMesh(a, 0.018, 0.018, 0.05, mBrass, w2 * 0.34, -hh / 2 - 0.375, -dd / 2 - 0.07, 8);
      R.cylMesh(a, 0.014, 0.014, 0.03, mBrass, w2 * 0.1, -hh / 2 - 0.23, -dd / 2 - 0.02, 8);
      if (wallMount) {
        R.boxMesh(a, 0.05, 0.5, 0.05, mSteelDark, -w2 * 0.42, -hh / 2 - 0.2, -dd * 0.2);
        R.boxMesh(a, 0.05, 0.5, 0.05, mSteelDark, w2 * 0.42, -hh / 2 - 0.2, -dd * 0.2);
        R.bolt(a, -w2 * 0.42, -hh / 2 - 0.06, 0.06, 0.008, 'z');
        R.bolt(a, w2 * 0.42, -hh / 2 - 0.06, 0.06, 0.008, 'z');
      } else {
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) {
          R.boxMesh(a, 0.06, 0.05, 0.06, mSteelDark, c[0] * (w2 / 2 - 0.06), -hh / 2 - 0.025, c[1] * (dd / 2 - 0.06));
        });
      }
      return a;
    }
    acUnit(2.95, G.GY + 0.31, -2.3, 0, 0.84, 0.62, 0.36);
    R.contact(g0, 2.95, -2.3, 0.6, 0.36, 0.4, G.GY + 0.008);
    acUnit(-1.7, G.GY + 0.31, -10.2, 0, 0.8, 0.6, 0.34);
    R.contact(g0, -1.7, -10.2, 0.58, 0.34, 0.4, G.GY + 0.008);
    acUnit(0.9, 3.9, -8.2, 0, 0.8, 0.58, 0.34);                    // 屋顶外机（第二台）
    acUnit(-10.44, 2.3, -6.0, Math.PI / 2, 0.76, 0.56, 0.32, true); // 邻家外墙挂机
    // 啤酒箱堆（顶层加瓶颈）
    var crateCols = [0x9a3b34, 0x2f4f6a, 0x9a3b34, 0xb08a3a];
    for (var cr = 0; cr < 4; cr++) {
      var cy = G.GY + 0.15 + (cr % 2) * 0.3;
      var cz = -4.4 + Math.floor(cr / 2) * 0.4;
      R.boxMesh(g0, 0.44, 0.28, 0.34, R.mat(crateCols[cr], { emissive: 0x14100c, emissiveIntensity: 0.9 }), 4.6, cy, cz, 0.06 * cr, 0.012);
      R.boxMesh(g0, 0.4, 0.02, 0.3, R.mat(0x20262c, { emissive: 0x0b0e12, emissiveIntensity: 0.9 }), 4.6, cy + 0.15, cz, 0.06 * cr);
      if (cr % 2 === 1) {
        for (var nb = 0; nb < 6; nb++) {
          R.cylMesh(g0, 0.021, 0.021, 0.08, R.mat(0x2f5a34, { emissive: 0x122415, emissiveIntensity: 0.9 }),
            4.42 + (nb % 3) * 0.15, cy + 0.19, cz - 0.09 + Math.floor(nb / 3) * 0.12, 8);
        }
      }
    }
    // 消火栓标柱（带框 / 螺栓 / 反光带）
    R.cylMesh(g0, 0.045, 0.05, 1.0, R.mat(0xd9d2c0, { emissive: 0x22201a, emissiveIntensity: 0.9 }), 5.7, G.GY + 0.5, 3.3, 10);
    R.cylMesh(g0, 0.06, 0.06, 0.03, mSteelDark, 5.7, G.GY + 0.015, 3.3, 10);
    var hyd = new THREE.Mesh(R.planeGeo(0.26, 0.34), new THREE.MeshToonMaterial({
      map: texPlate('消火栓', '#f2f2ee', '#c0392b', 192, 256, 44),
      emissiveMap: texPlate('消火栓', '#f2f2ee', '#c0392b', 192, 256, 44),
      emissive: 0x9a9a94, emissiveIntensity: 0.4, gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
    }));
    hyd.position.set(5.7, G.GY + 1.05, 3.3);
    g0.add(hyd);
    R.boxMesh(g0, 0.3, 0.38, 0.02, mSteelDark, 5.7, G.GY + 1.05, 3.285);
    R.bolt(g0, 5.7, G.GY + 1.2, 3.3, 0.007, 'z');
    R.bolt(g0, 5.7, G.GY + 0.9, 3.3, 0.007, 'z');
    R.boxMesh(g0, 0.06, 0.05, 0.05, R.mat(0xd94f2f, { emissive: 0x8a2a10, emissiveIntensity: 0.9 }), 5.7, G.GY + 0.7, 3.34);
    /* ---------- 小巷：公告栏 / 壁灯 / 纸箱 / 托盘 / 垃圾袋 / 杂草 ---------- */
    // 通知板（木框 + 角撑 + 檐板 + 独立纸张与图钉，挂于民居东墙）
    var bb = new THREE.Group();
    bb.position.set(-10.55, 1.7, -7.4);
    bb.rotation.y = Math.PI / 2;
    g0.add(bb);
    var mWood = R.mat(0x6b4f34, { emissive: 0x160f08, emissiveIntensity: 0.9 });
    var mWood2 = R.mat(0x8a6a48, { emissive: 0x1c140c, emissiveIntensity: 0.9 });
    R.boxMesh(bb, 1.34, 0.94, 0.05, mWood, 0, 0, 0, 0, 0.012);
    var cork = new THREE.Mesh(R.planeGeo(1.22, 0.82), new THREE.MeshToonMaterial({
      map: texCork(), emissiveMap: texCork(), emissive: 0x3a3226, emissiveIntensity: 0.35,
      gradientMap: R.toonTex(4, true)
    }));
    cork.position.set(0, 0, 0.032);
    bb.add(cork);
    R.boxMesh(bb, 1.44, 0.07, 0.08, mWood2, 0, 0.505, 0);
    R.boxMesh(bb, 1.44, 0.07, 0.08, mWood2, 0, -0.505, 0);
    R.boxMesh(bb, 0.07, 1.0, 0.08, mWood2, -0.685, 0, 0);
    R.boxMesh(bb, 0.07, 1.0, 0.08, mWood2, 0.685, 0, 0);
    [[-0.61, 0.44], [0.61, 0.44], [-0.61, -0.44], [0.61, -0.44]].forEach(function (c, ci) {
      R.boxMesh(bb, 0.13, 0.09, 0.1, mWood, c[0], c[1], 0.02, ci % 2 ? -0.6 : 0.6);
    });
    var bbRoof = R.boxMesh(bb, 1.52, 0.035, 0.3, mWood2, 0, 0.585, 0.1);
    bbRoof.rotation.x = -0.2;
    R.tubeBetween(bb, -0.62, 0.56, 0.06, -0.5, 0.52, 0.2, 0.012, mWood, 5);
    R.tubeBetween(bb, 0.62, 0.56, 0.06, 0.5, 0.52, 0.2, 0.012, mWood, 5);
    [[-0.42, 0.22, 0.1, 0], [-0.13, 0.26, -0.16, 1], [0.17, 0.2, 0.07, 2], [0.45, 0.24, -0.05, 0], [0.03, -0.2, 0.26, 1], [0.42, -0.24, -0.2, 2]].forEach(function (f) {
      var fm = new THREE.MeshToonMaterial({
        map: texFlyer(f[3]), emissiveMap: texFlyer(f[3]),
        emissive: 0x8f8f88, emissiveIntensity: 0.4,
        gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
      });
      var fp = new THREE.Mesh(R.planeGeo(0.17, 0.23), fm);
      fp.position.set(f[0], f[1], 0.045);
      fp.rotation.z = f[2];
      bb.add(fp);
      var pin = new THREE.Mesh(R.sphGeo(0.009, 6, 5), R.mat(0xd94f2f, { emissive: 0x6a2410, emissiveIntensity: 0.9 }));
      pin.position.set(f[0], f[1] + 0.1, 0.055);
      bb.add(pin);
    });
    R.boxMesh(bb, 0.06, 0.12, 0.1, mSteelDark, -0.5, 0.3, -0.07);
    R.boxMesh(bb, 0.06, 0.12, 0.1, mSteelDark, 0.5, 0.3, -0.07);
    // 巷内壁灯（灯罩 / 灯泡 / 光晕 / 地面光斑）
    var wl = new THREE.Group();
    wl.position.set(-10.55, 2.5, -5.4);
    wl.rotation.y = Math.PI / 2;
    g0.add(wl);
    R.boxMesh(wl, 0.1, 0.16, 0.06, mSteelDark, 0, 0, -0.03);
    R.cylMesh(wl, 0.1, 0.14, 0.09, R.mat(0xd9d2c0, { emissive: 0x22201a, emissiveIntensity: 0.9 }), 0, -0.1, 0.05, 12);
    var wlBulb = new THREE.Mesh(R.planeGeo(0.16, 0.16), R.glowMat(0xffe2b0, 0.95));
    wlBulb.rotation.x = Math.PI / 2;
    wlBulb.position.set(0, -0.15, 0.05);
    wl.add(wlBulb);
    R.halo(g0, -10.45, 2.36, -5.4, 1.2, 0xffd9a0, 0.34);
    expose('alley', R.groundGlow(g0, -9.9, -5.4, 1.5, 1.3, 0.14, 0xffcf96, 0.24));
    // 纸箱堆（含上盖翻边与胶带）
    [[-9.72, -12.35, 0.5, 0.42, 0.44, 0.3, 0], [-9.24, -12.72, 0.42, 0.34, 0.36, -0.5, 0], [-9.6, -12.9, 0.46, 0.4, 0.4, 0.9, 0.4]].forEach(function (c) {
      var cy = G.GY + c[3] / 2 + c[6];
      R.boxMesh(g0, c[2], c[3], c[4], R.mat(0xb08a5a, { emissive: 0x1f1810, emissiveIntensity: 0.9 }), c[0], cy, c[1], c[5], 0.012);
      R.boxMesh(g0, c[2] * 0.47, 0.02, c[4] * 0.9, R.mat(0xa07c50, { emissive: 0x1a140d, emissiveIntensity: 0.9 }), c[0] - c[2] * 0.24, cy + c[3] / 2 + 0.012, c[1], c[5]);
      R.boxMesh(g0, c[2] * 0.47, 0.02, c[4] * 0.9, R.mat(0xa07c50, { emissive: 0x1a140d, emissiveIntensity: 0.9 }), c[0] + c[2] * 0.24, cy + c[3] / 2 + 0.012, c[1], c[5]);
      R.boxMesh(g0, c[2] * 0.9, 0.014, 0.06, R.mat(0xd9c9a0, { emissive: 0x2a2620, emissiveIntensity: 0.8 }), c[0], cy + c[3] / 2 + 0.02, c[1], c[5]);
      R.contact(g0, c[0], c[1], c[2] * 0.75, c[4] * 0.75, 0.4, G.GY + 0.006);
    });
    // 木托盘（斜靠）
    var pal = new THREE.Group();
    pal.position.set(-9.02, G.GY + 0.02, -4.3);
    pal.rotation.y = -1.35;
    g0.add(pal);
    for (var pk = 0; pk < 5; pk++) {
      var pp2 = R.boxMesh(pal, 1.0, 0.03, 0.13, R.mat(0x9a7b52, { emissive: 0x1c150e, emissiveIntensity: 0.9 }), 0, 0.5 - pk * 0.02, -0.24 + pk * 0.12, 0, 0.008);
      pp2.rotation.z = 0.16;
    }
    for (var pr = 0; pr < 3; pr++) {
      R.boxMesh(pal, 0.08, 0.1, 0.6, R.mat(0x8a6a48, { emissive: 0x18120c, emissiveIntensity: 0.9 }), -0.42 + pr * 0.42, 0.44, 0, 0, 0);
    }
    // 垃圾袋（球体 + 收口）
    [[-9.4, -11.4, 0.3], [-9.76, -11.78, 0.27], [-9.5, -12.08, 0.24]].forEach(function (bg2, i) {
      var bcol = [0x3a4048, 0x2f353c, 0x464c54][i];
      var bag = new THREE.Mesh(R.sphGeo(bg2[2], 12, 9), R.mat(bcol, { emissive: 0x0f1216, emissiveIntensity: 0.9 }));
      bag.position.set(bg2[0], G.GY + bg2[2] * 0.62, bg2[1]);
      bag.scale.y = 0.78;
      g0.add(bag);
      R.cylMesh(g0, 0.012, 0.032, 0.07, R.mat(bcol, { emissive: 0x0f1216, emissiveIntensity: 0.9 }), bg2[0], G.GY + bg2[2] * 1.26, bg2[1], 6);
      R.contact(g0, bg2[0], bg2[1], bg2[2] * 0.8, bg2[2] * 0.8, 0.4, G.GY + 0.006);
    });
    // 杂草（每丛三片斜叶）
    var mWeed = R.mat(0x4a6a3a, { emissive: 0x141d10, emissiveIntensity: 0.9, side: THREE.DoubleSide });
    [[-9.2, -3.6], [-9.35, -7.1], [-8.86, -8.9], [-9.55, -10.4], [-8.75, -13.1], [-9.95, -13.62], [-8.9, -4.6], [-9.3, -9.7], [-8.8, -12.0]].forEach(function (w) {
      for (var b2 = 0; b2 < 3; b2++) {
        var hgt = 0.18 + R.rng() * 0.2;
        var c2 = R.cylMesh(g0, 0.004, 0.02, hgt, mWeed, w[0] + (b2 - 1) * 0.05, G.GY + hgt / 2, w[1] + (R.rng() - 0.5) * 0.06, 4);
        c2.rotation.z = (b2 - 1) * 0.22;
      }
    });

    /* ---------- 邻家民居（窗框 / 檐沟 / 雨落管 / 电表箱 / 屋顶设备） ---------- */
    var H = G.HOUSE;
    var hw = H.x1 - H.x0, hd = H.z1 - H.z0;
    var hcx = (H.x0 + H.x1) / 2, hcz = (H.z0 + H.z1) / 2;
    var mHouse = R.mat(0xcdc6b8, { emissive: 0x201e1a, emissiveIntensity: 0.85 });
    R.boxMesh(g0, hw + 0.14, 0.3, hd + 0.14, R.mat(0x8f8a80, { emissive: 0x181613, emissiveIntensity: 0.85 }), hcx, G.GY + 0.05, hcz, 0, 0.01);
    R.boxMesh(g0, hw, H.top, hd, mHouse, hcx, G.GY + H.top / 2, hcz, 0, 0.016);
    R.boxMesh(g0, hw + 0.3, 0.22, hd + 0.3, R.mat(0x6f6a62, { emissive: 0x141311, emissiveIntensity: 0.9 }), hcx, G.GY + H.top + 0.11, hcz, 0, 0.014);
    // 东墙窗（外凸窗框 + 窗台 + 玻璃面）
    function houseWinE(z, y, w2, h2, lit) {
      R.boxMesh(g0, 0.06, h2 + 0.1, w2 + 0.1, R.mat(0xb4ada0, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }), H.x1 + 0.01, y, z);
      var wp = new THREE.Mesh(R.planeGeo(w2, h2), new THREE.MeshToonMaterial({
        map: texWindowPanel(lit), emissiveMap: texWindowPanel(lit),
        emissive: lit ? 0x8a7454 : 0x2a3038, emissiveIntensity: lit ? 0.85 : 0.5,
        gradientMap: R.toonTex(4, true)
      }));
      wp.position.set(H.x1 + 0.045, y, z);
      wp.rotation.y = Math.PI / 2;
      g0.add(wp);
      R.boxMesh(g0, 0.1, 0.05, w2 + 0.16, R.mat(0xd9d4c8, { emissive: 0x22201c, emissiveIntensity: 0.85 }), H.x1 + 0.06, y - h2 / 2 - 0.045, z);
    }
    houseWinE(-4.6, 1.7, 0.8, 1.0, true);
    houseWinE(-8.6, 1.7, 0.8, 1.0, false);
    houseWinE(-5.4, 4.4, 0.9, 1.0, false);
    houseWinE(-8.0, 4.4, 0.9, 1.0, true);
    // 南向入口：门 / 拉手 / 雨棚 / 斜撑 / 踏步 / 门牌
    R.boxMesh(g0, 0.9, 2.0, 0.08, R.mat(0x5a4a3a, { emissive: 0x130f0a, emissiveIntensity: 0.9 }), hcx + 0.3, G.GY + 1.0, H.z1 + 0.02, 0, 0.008);
    R.boxMesh(g0, 0.16, 0.5, 0.06, R.mat(0xd9d4c8, { emissive: 0x22201c, emissiveIntensity: 0.85 }), hcx + 0.62, G.GY + 1.05, H.z1 + 0.06);
    R.bolt(g0, hcx + 0.62, G.GY + 1.25, H.z1 + 0.1, 0.008, 'z');
    R.bolt(g0, hcx + 0.62, G.GY + 0.85, H.z1 + 0.1, 0.008, 'z');
    R.boxMesh(g0, 1.2, 0.06, 0.7, R.mat(0x6f6a62, { emissive: 0x141311, emissiveIntensity: 0.9 }), hcx + 0.3, G.GY + 2.28, H.z1 + 0.32, 0, 0.01);
    R.tubeBetween(g0, hcx - 0.25, G.GY + 2.24, H.z1 + 0.6, hcx - 0.25, G.GY + 1.78, H.z1 + 0.08, 0.012, mSteelDark, 5);
    R.tubeBetween(g0, hcx + 0.85, G.GY + 2.24, H.z1 + 0.6, hcx + 0.85, G.GY + 1.78, H.z1 + 0.08, 0.012, mSteelDark, 5);
    R.boxMesh(g0, 1.1, 0.12, 0.5, R.mat(0x9a958c, { emissive: 0x1a1815, emissiveIntensity: 0.85 }), hcx + 0.3, G.GY + 0.06, H.z1 + 0.25);
    var np = new THREE.Mesh(R.planeGeo(0.22, 0.12), new THREE.MeshToonMaterial({
      map: texPlate('101', '#f2f2ee', '#333a40', 128, 96, 56),
      emissiveMap: texPlate('101', '#f2f2ee', '#333a40', 128, 96, 56),
      emissive: 0x8a8a86, emissiveIntensity: 0.4,
      gradientMap: R.toonTex(4, true)
    }));
    np.position.set(hcx - 0.35, G.GY + 1.9, H.z1 + 0.062);
    g0.add(np);
    // 电表箱 + 引下管
    R.boxMesh(g0, 0.12, 0.24, 0.18, R.mat(0xd9d4c8, { emissive: 0x22201c, emissiveIntensity: 0.85 }), H.x1 + 0.05, 1.5, -11.6, 0, 0.008);
    R.tubeBetween(g0, H.x1 + 0.06, 1.62, -11.6, H.x1 + 0.06, 3.3, -11.6, 0.011, mSteelDark, 5);
    // 檐沟 + 管卡 + 雨落管 + 落水弯头
    var gut = R.cylMesh(g0, 0.05, 0.05, hd + 0.2, R.mat(0xb4b0a8, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }), H.x1 + 0.08, G.GY + H.top + 0.05, hcz, 10);
    gut.rotation.x = Math.PI / 2;
    for (var gb = 0; gb < 4; gb++) R.boxMesh(g0, 0.1, 0.04, 0.05, mSteelDark, H.x1 + 0.05, G.GY + H.top + 0.02, H.z0 + 1.2 + gb * 2.6);
    R.cylMesh(g0, 0.045, 0.045, H.top - 0.2, R.mat(0xb4b0a8, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }), H.x1 + 0.1, G.GY + (H.top - 0.2) / 2 + 0.1, H.z0 + 0.15, 10);
    var elbow = R.cylMesh(g0, 0.045, 0.045, 0.3, R.mat(0xb4b0a8, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }), H.x1 + 0.15, G.GY + 0.14, H.z0 + 0.28, 10);
    elbow.rotation.z = 1.1;
    R.boxMesh(g0, 0.1, 0.08, 0.14, R.mat(0x8f8a80, { emissive: 0x181613, emissiveIntensity: 0.85 }), H.x1 + 0.26, G.GY + 0.045, H.z0 + 0.36);
    R.boxMesh(g0, 0.06, 0.05, 0.05, mSteelDark, H.x1 + 0.09, G.GY + H.top - 0.45, H.z0 + 0.15);
    R.boxMesh(g0, 0.06, 0.05, 0.05, mSteelDark, H.x1 + 0.09, G.GY + 2.2, H.z0 + 0.15);
    // 屋顶：楼梯间 + 东侧栏杆 + 天线 + 高架水槽
    R.boxMesh(g0, 1.5, 1.1, 1.8, R.mat(0xc4bdb0, { emissive: 0x1e1c19, emissiveIntensity: 0.85 }), H.x0 + 1.2, G.GY + H.top + 0.22 + 0.55, -10.2, 0, 0.014);
    R.boxMesh(g0, 1.6, 0.1, 1.9, R.mat(0x6f6a62, { emissive: 0x141311, emissiveIntensity: 0.9 }), H.x0 + 1.2, G.GY + H.top + 0.22 + 1.15, -10.2);
    R.boxMesh(g0, 0.5, 0.5, 0.06, R.mat(0x2a3038, { emissive: 0x0d1114, emissiveIntensity: 0.9 }), H.x0 + 1.2, G.GY + H.top + 0.9, -9.3);
    for (var rb2 = 0; rb2 < 6; rb2++) {
      R.cylMesh(g0, 0.015, 0.015, 0.5, mSteelDark, H.x1 - 0.12, G.GY + H.top + 0.47, H.z1 - 0.6 - rb2 * 1.6, 6);
    }
    R.cylMesh(g0, 0.018, 0.018, hd - 0.9, mSteelDark, H.x1 - 0.12, G.GY + H.top + 0.68, hcz, 8).rotation.x = Math.PI / 2;
    R.cylMesh(g0, 0.02, 0.03, 1.6, mSteelDark, H.x0 + 0.6, G.GY + H.top + 1.1, -4.0, 8);
    R.boxMesh(g0, 0.9, 0.02, 0.02, mSteelDark, H.x0 + 0.6, G.GY + H.top + 1.85, -4.0);
    R.boxMesh(g0, 0.7, 0.02, 0.02, mSteelDark, H.x0 + 0.6, G.GY + H.top + 1.7, -4.0);
    R.tubeBetween(g0, H.x0 + 0.6, G.GY + H.top + 1.9, -4.0, H.x0 + 0.05, G.GY + H.top + 1.5, -4.4, 0.006, mSteelDark, 4);
    var wt = new THREE.Group();
    wt.position.set(-12.6, G.GY + H.top + 0.22, -12.0);
    g0.add(wt);
    R.cylMesh(wt, 0.34, 0.34, 0.6, R.mat(0xb9bcbe, { emissive: 0x1b1e20, emissiveIntensity: 0.9 }), 0, 0.75, 0, 14);
    R.cylMesh(wt, 0.36, 0.36, 0.04, R.mat(0xa2a6a8, { emissive: 0x181b1d, emissiveIntensity: 0.9 }), 0, 1.07, 0, 14);
    [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]].forEach(function (l2) {
      R.cylMesh(wt, 0.02, 0.02, 0.45, mSteelDark, l2[0], 0.22, l2[1], 6);
    });
    R.contact(g0, hcx, H.z1 + 0.2, 1.4, 0.7, 0.35, G.GY + 0.006);
    /* ---------- 民居门头壁灯 + 南檐沟 / 西南落水管 ---------- */
    R.tubeBetween(g0, hcx + 1.05, G.GY + 2.12, H.z1 + 0.02, hcx + 1.05, G.GY + 2.24, H.z1 + 0.22, 0.012, mSteelDark, 5);
    R.boxMesh(g0, 0.24, 0.1, 0.2, R.mat(0x3a3f45, { emissive: 0x0f1215, emissiveIntensity: 0.9 }), hcx + 1.05, G.GY + 2.28, H.z1 + 0.24, 0, 0.008);
    var hnLamp = new THREE.Mesh(R.planeGeo(0.18, 0.08), R.glowMat(0xffd9a0, 0.92));
    hnLamp.rotation.x = Math.PI / 2;
    hnLamp.position.set(hcx + 1.05, G.GY + 2.225, H.z1 + 0.24);
    g0.add(hnLamp);
    R.halo(g0, hcx + 1.05, G.GY + 2.2, H.z1 + 0.26, 1.0, 0xffd9a0, 0.2);
    R.groundGlow(g0, hcx + 1.05, H.z1 + 0.45, 0.9, 0.7, 0.14, 0xffca8f, 0.12);
    var gut2 = R.cylMesh(g0, 0.05, 0.05, hw + 0.2, R.mat(0xb4b0a8, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }), hcx, G.GY + H.top + 0.05, H.z1 + 0.08, 10);
    gut2.rotation.z = Math.PI / 2;
    for (var gb2 = 0; gb2 < 3; gb2++) {
      R.boxMesh(g0, 0.05, 0.04, 0.1, mSteelDark, H.x0 + 0.7 + gb2 * 0.7, G.GY + H.top + 0.02, H.z1 + 0.06);
    }
    R.cylMesh(g0, 0.045, 0.045, H.top - 0.26, R.mat(0xb4b0a8, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }), H.x0 + 0.12, G.GY + (H.top - 0.26) / 2 + 0.12, H.z1 + 0.1, 10);
    var eb2 = R.cylMesh(g0, 0.04, 0.04, 0.26, R.mat(0xb4b0a8, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }), H.x0 + 0.2, G.GY + 0.13, H.z1 + 0.16, 10);
    eb2.rotation.z = 1.2;
    R.boxMesh(g0, 0.12, 0.08, 0.12, R.mat(0x8f8a80, { emissive: 0x181613, emissiveIntensity: 0.85 }), H.x0 + 0.34, G.GY + 0.045, H.z1 + 0.1);
    /* ---------- 背景建筑群（女儿墙 / 楼梯间 / 水箱 / 天线 / 卷帘门店铺） ---------- */
    var mRoofAxis = R.mat(0x6f6a62, { emissive: 0x141311, emissiveIntensity: 0.9 });
    function bgRoof(x, z, w2, d2, topY, idx) {
      R.boxMesh(g0, w2 + 0.2, 0.12, d2 + 0.2, R.mat(0x565a60, { emissive: 0x101317, emissiveIntensity: 0.9 }), x, topY + 0.06, z);
      // 女儿墙压顶线（略微出挑）
      R.boxMesh(g0, w2 + 0.28, 0.03, d2 + 0.28, R.mat(0x777d84, { emissive: 0x15191d, emissiveIntensity: 0.9 }), x, topY + 0.135, z);
      if (idx % 3 === 0) {
        R.boxMesh(g0, w2 * 0.24, 1.0, d2 * 0.3, R.mat(0xa9a49a, { emissive: 0x1a1815, emissiveIntensity: 0.85 }), x - w2 * 0.26, topY + 0.56, z - d2 * 0.2, 0, 0.012);
      }
      if (idx % 2 === 0) {
        R.cylMesh(g0, 0.42, 0.42, 0.66, R.mat(0xb9bcbe, { emissive: 0x1b1e20, emissiveIntensity: 0.9 }), x + w2 * 0.2, topY + 0.55, z + d2 * 0.18, 12);
        R.cylMesh(g0, 0.44, 0.44, 0.05, R.mat(0xa2a6a8, { emissive: 0x181b1d, emissiveIntensity: 0.9 }), x + w2 * 0.2, topY + 0.9, z + d2 * 0.18, 12);
        [[-0.24, -0.24], [-0.24, 0.24], [0.24, -0.24], [0.24, 0.24]].forEach(function (l2) {
          R.cylMesh(g0, 0.02, 0.02, 0.3, mRoofAxis, x + w2 * 0.2 + l2[0], topY + 0.14, z + d2 * 0.18 + l2[1], 6);
        });
      } else {
        R.boxMesh(g0, 0.9, 0.56, 0.4, R.mat(0xc4c8cb, { emissive: 0x1a1f24, emissiveIntensity: 0.9 }), x + w2 * 0.24, topY + 0.4, z - d2 * 0.22, 0.3, 0.012);
        R.boxMesh(g0, 0.62, 0.44, 0.36, R.mat(0xbfc3c6, { emissive: 0x191e23, emissiveIntensity: 0.9 }), x + w2 * 0.05, topY + 0.34, z + d2 * 0.24, -0.2, 0.012);
        R.cylMesh(g0, 0.018, 0.026, 2.4, mRoofAxis, x - w2 * 0.3, topY + 1.26, z + d2 * 0.1, 8);
        R.boxMesh(g0, 1.1, 0.02, 0.02, mRoofAxis, x - w2 * 0.3, topY + 2.1, z + d2 * 0.1);
        R.boxMesh(g0, 0.85, 0.02, 0.02, mRoofAxis, x - w2 * 0.3, topY + 1.92, z + d2 * 0.1);
        R.boxMesh(g0, 0.6, 0.02, 0.02, mRoofAxis, x - w2 * 0.3, topY + 1.74, z + d2 * 0.1);
      }
      // 屋顶排气管 + 防雨帽
      R.cylMesh(g0, 0.05, 0.05, 0.5, mRoofAxis, x + w2 * 0.28, topY + 0.37, z - d2 * 0.26, 8);
      R.cylMesh(g0, 0.09, 0.08, 0.07, mRoofAxis, x + w2 * 0.28, topY + 0.64, z - d2 * 0.26, 8);
    }
    var bgList = [];
    function bgBuilding(x, z, w2, d2, h2, variant, idx) {
      var tex = texFacade(variant);
      var bm = new THREE.MeshToonMaterial({
        color: 0x9aa0a6,
        map: tex.map, emissiveMap: tex.emi,
        emissive: 0xffffff, emissiveIntensity: 0.85,
        gradientMap: R.toonTex(3)
      });
      var bld = new THREE.Mesh(R.boxGeo(w2, h2, d2), bm);
      bld.position.set(x, G.GY + h2 / 2, z);
      g0.add(bld);
      bgRoof(x, z, w2, d2, G.GY + h2, idx);
      bgList.push({ x: x, z: z, w2: w2, d2: d2, h2: h2, idx: idx });
    }
    bgBuilding(-3.6, -12.4, 8.0, 5.2, 9.2, 0, 0);
    bgBuilding(4.2, -13.4, 6.4, 3.2, 7.0, 1, 1);
    bgBuilding(13.8, -12.4, 2.4, 4.8, 10.5, 1, 2);
    bgBuilding(13.8, -2.2, 2.4, 5.4, 8.0, 0, 3);
    bgBuilding(-14.3, -7.0, 1.4, 7.6, 10.5, 0, 4);      // 西墙贴齐底座边（切面式收边）
    bgBuilding(-13.9, 1.6, 2.2, 3.6, 7.2, 1, 5);        // 同上，避免越出底座
    bgBuilding(4.8, 13.65, 5.4, 2.7, 9.6, 0, 6);        // 收窄西移，让出东侧马路延伸段
    bgBuilding(13.6, 13.4, 2.6, 3.0, 7.4, 1, 7);
    bgBuilding(-9.5, 13.2, 9.0, 3.0, 7.6, 1, 8);
    bgBuilding(0.0, 14.0, 2.6, 1.6, 6.2, 0, 9);
    bgBuilding(13.9, 5.4, 2.2, 7.6, 6.8, 0, 10);

    /* ---------- 背景楼真实开窗：实例化窗框 / 窗台 / 亮窗 / 暗窗 ---------- */
    var winFrameT = [], winSillT = [], winLitT = [], winDarkT = [];
    var WNH = 1.0;
    var winExclude = [
      [5.5, 3.4, 11.8, 7.15, 6.55, 12.8],   // 竖排霓虹「カラオケ」
      [12.0, 2.2, 2.9, 13.2, 4.05, 7.5],    // 洗濯店灯箱
      [-4.7, 2.5, -10.1, 1.8, 4.0, -9.2]    // クリーニング 招牌
    ];
    function winBlocked(x, y, z) {
      for (var wb = 0; wb < winExclude.length; wb++) {
        var we = winExclude[wb];
        if (x > we[0] && x < we[3] && y > we[1] && y < we[4] && z > we[2] && z < we[5]) return true;
      }
      return false;
    }
    for (var wi = 0; wi < bgList.length; wi++) {
      var BW = bgList[wi];
      var fcs = [
        { nx: 1, nz: 0, face: BW.x + BW.w2 / 2, span: BW.d2, along: 'z', ry: Math.PI / 2 },
        { nx: -1, nz: 0, face: BW.x - BW.w2 / 2, span: BW.d2, along: 'z', ry: -Math.PI / 2 },
        { nx: 0, nz: 1, face: BW.z + BW.d2 / 2, span: BW.w2, along: 'x', ry: 0 },
        { nx: 0, nz: -1, face: BW.z - BW.d2 / 2, span: BW.w2, along: 'x', ry: Math.PI }
      ];
      for (var fi = 0; fi < fcs.length; fi++) {
        var FC = fcs[fi];
        if (Math.abs(FC.face) > 14.92) continue;          // 贴底座边缘的外墙不开窗
        if (BW.idx === 4 && FC.nx === 1) continue;        // 民居背后夹缝面，无采光意义
        var cols = Math.max(1, Math.round((FC.span - 0.7) / 2.1));
        var rows = Math.floor((BW.h2 - 4.45 - WNH / 2 - 0.35) / 2.65) + 1;
        for (var rr = 0; rr < rows; rr++) {
          var wy = 4.45 + rr * 2.65;                      // 首层留给店面，二层起开窗
          for (var cc = 0; cc < cols; cc++) {
            var u = cols === 1 ? 0 : (cc / (cols - 1) - 0.5) * (FC.span - 1.6);
            var wx = FC.along === 'x' ? BW.x + u : FC.face;
            var wz = FC.along === 'x' ? FC.face : BW.z + u;
            var wyA = G.GY + wy;
            if (winBlocked(wx, wyA, wz)) continue;
            var ww = 0.9 + R.rng() * 0.22, wh = 0.88 + R.rng() * 0.2;
            winFrameT.push({ x: wx + FC.nx * 0.012, y: wyA, z: wz + FC.nz * 0.012, ry: FC.ry, sx: ww + 0.16, sy: wh + 0.16 });
            winSillT.push({ x: wx + FC.nx * 0.05, y: wyA - wh / 2 - 0.11, z: wz + FC.nz * 0.05, ry: FC.ry, sx: ww + 0.24 });
            (R.rng() < 0.3 ? winLitT : winDarkT).push({ x: wx + FC.nx * 0.062, y: wyA, z: wz + FC.nz * 0.062, ry: FC.ry, sx: ww, sy: wh });
          }
        }
      }
    }
    R.props.bgWindows = {
      total: winFrameT.length, lit: winLitT.length, dark: winDarkT.length,
      frames: R.instanced(g0, R.boxGeo(1, 1, 0.065), 0xb4ada0, winFrameT, { emissive: 0x1c1a17, emissiveIntensity: 0.85 }),
      sills: R.instanced(g0, R.boxGeo(1, 0.05, 0.13), 0xd9d4c8, winSillT, { emissive: 0x22201c, emissiveIntensity: 0.85 }),
      litMesh: R.instanced(g0, R.planeGeo(1, 1), 0xffffff, winLitT, {
        map: texWindowPanel(true), emissiveMap: texWindowPanel(true),
        emissive: 0x8a7454, emissiveIntensity: 0.9, gradient: 4, soft: true
      }),
      darkMesh: R.instanced(g0, R.planeGeo(1, 1), 0xdfe5ea, winDarkT, {
        map: texWindowPanel(false), emissiveMap: texWindowPanel(false),
        emissive: 0x2a3038, emissiveIntensity: 0.55, gradient: 4, soft: true
      })
    };

    /* ---------- 立面配件：雨落管（管卡 / 落水弯头）/ 电表箱 / 引下缆 ---------- */
    var mPipeBg = R.mat(0xb4b0a8, { emissive: 0x1c1a17, emissiveIntensity: 0.85 });
    for (var xi = 0; xi < bgList.length; xi++) {
      var BE = bgList[xi];
      var cnr = [
        [BE.x - BE.w2 / 2 - 0.07, BE.z + BE.d2 / 2 + 0.07],
        [BE.x + BE.w2 / 2 + 0.07, BE.z - BE.d2 / 2 - 0.07],
        [BE.x + BE.w2 / 2 + 0.07, BE.z + BE.d2 / 2 + 0.07],
        [BE.x - BE.w2 / 2 - 0.07, BE.z - BE.d2 / 2 - 0.07]
      ];
      for (var cn = 0; cn < cnr.length; cn++) {
        var ccx = cnr[cn][0], ccz = cnr[cn][1];
        if (Math.abs(ccx) > 14.85 || Math.abs(ccz) > 14.85) continue;       // 不越出底座
        if (ccx > -3.8 && ccx < 0.8 && ccz > -9.95 && ccz < -9.55) continue; // 避开便利店卷帘门
        R.cylMesh(g0, 0.042, 0.042, BE.h2 - 0.08, mPipeBg, ccx, G.GY + (BE.h2 - 0.08) / 2, ccz, 8);
        R.boxMesh(g0, 0.06, 0.05, 0.1, mSteelDark, ccx - 0.02, G.GY + BE.h2 * 0.36, ccz - 0.02);
        R.boxMesh(g0, 0.06, 0.05, 0.1, mSteelDark, ccx - 0.02, G.GY + BE.h2 * 0.72, ccz - 0.02);
        var eb = R.cylMesh(g0, 0.038, 0.038, 0.26, mPipeBg, ccx + 0.08, G.GY + 0.13, ccz + 0.08, 8);
        eb.rotation.z = 1.2;
        R.boxMesh(g0, 0.1, 0.08, 0.16, R.mat(0x8f8a80, { emissive: 0x181613, emissiveIntensity: 0.85 }), ccx + 0.22, G.GY + 0.045, ccz + 0.22);
        break;
      }
      // 电表箱 / 引下电缆（短引下，止于首排窗台之下，不与窗户相交）
      var inx = BE.x < 0 ? BE.w2 / 2 + 0.06 : -BE.w2 / 2 - 0.06;
      if (BE.idx % 2 === 0) {
        R.boxMesh(g0, 0.12, 0.26, 0.18, R.mat(0xd9d4c8, { emissive: 0x22201c, emissiveIntensity: 0.85 }), BE.x + inx, G.GY + 1.65, BE.z + BE.d2 * 0.22, 0, 0.008);
        R.tubeBetween(g0, BE.x + inx, G.GY + 1.8, BE.z + BE.d2 * 0.22, BE.x + inx, G.GY + 3.2, BE.z + BE.d2 * 0.22, 0.011, mSteelDark, 5);
        R.boxMesh(g0, 0.05, 0.07, 0.05, mSteelDark, BE.x + inx, G.GY + 3.24, BE.z + BE.d2 * 0.22);
      } else {
        var inz = BE.z < 0 ? BE.d2 / 2 + 0.06 : -BE.d2 / 2 - 0.06;
        R.tubeBetween(g0, BE.x + BE.w2 * 0.3, G.GY + 2.3, BE.z + inz, BE.x + BE.w2 * 0.3, G.GY + 3.2, BE.z + inz, 0.012, mSteelDark, 5);
        R.boxMesh(g0, 0.14, 0.2, 0.1, R.mat(0x565b61, { emissive: 0x14181c, emissiveIntensity: 0.9 }), BE.x + BE.w2 * 0.3, G.GY + 2.15, BE.z + inz, 0, 0.008);
      }
    }

    /* ---------- 两处楼门：门框 / 门扇 / 踏步 / 门口垫板 / 门头壁灯 ---------- */
    function bgDoor(dx, dz, ry) {
      var DG = new THREE.Group();
      DG.position.set(dx, 0, dz);
      DG.rotation.y = ry;
      g0.add(DG);
      R.boxMesh(DG, 1.34, 2.34, 0.09, R.mat(0x6a6f75, { emissive: 0x14171a, emissiveIntensity: 0.9 }), 0, G.GY + 1.17, 0.012, 0, 0.01);
      R.boxMesh(DG, 1.06, 2.1, 0.06, R.mat(0x4a5058, { emissive: 0x101318, emissiveIntensity: 0.9 }), 0, G.GY + 1.05, 0.065, 0, 0.008);
      R.boxMesh(DG, 0.16, 0.05, 0.04, R.mat(0x8f969c, { emissive: 0x181c20, emissiveIntensity: 0.9 }), 0.38, G.GY + 1.02, 0.11);
      R.boxMesh(DG, 1.5, 0.09, 0.46, R.mat(0x9a958c, { emissive: 0x1a1815, emissiveIntensity: 0.85 }), 0, G.GY + 0.045, 0.2);
      R.boxMesh(DG, 1.7, 0.02, 0.9, R.mat(0x6a6e73, { emissive: 0x14171a, emissiveIntensity: 0.85 }), 0, G.GY + 0.01, 0.32);
      R.tubeBetween(DG, -0.74, G.GY + 2.42, 0.02, -0.74, G.GY + 2.56, 0.24, 0.012, mSteelDark, 5);
      R.boxMesh(DG, 0.24, 0.1, 0.22, R.mat(0x3a3f45, { emissive: 0x0f1215, emissiveIntensity: 0.9 }), -0.74, G.GY + 2.6, 0.26, 0, 0.008);
      var dgl = new THREE.Mesh(R.planeGeo(0.18, 0.09), R.glowMat(0xffd9a0, 0.9));
      dgl.rotation.x = Math.PI / 2;
      dgl.position.set(-0.74, G.GY + 2.545, 0.26);
      DG.add(dgl);
      R.halo(DG, -0.74, G.GY + 2.52, 0.26, 1.0, 0xffd9a0, 0.22);
      R.groundGlow(DG, 0, 0.55, 1.2, 0.9, 0.155, 0xffca8f, 0.13);
    }
    bgDoor(3.9, 12.3, Math.PI);          // 卡拉OK楼北面入口（面向街心）
    bgDoor(12.8, 2.7, -Math.PI / 2);     // 东侧楼西面入口（临东侧便道）
    // B1 底层卷帘门店铺 + 小招牌（临街面）
    R.boxMesh(g0, 4.2, 2.6, 0.08, R.mat(0xdfe3e6, { map: texShutter(), emissive: 0x22262a, emissiveIntensity: 0.7 }), -1.5, G.GY + 1.34, -9.76, 0, 0.01);
    R.boxMesh(g0, 0.08, 2.7, 0.12, mSteelDark, -1.5 - 2.14, G.GY + 1.39, -9.75);
    R.boxMesh(g0, 0.08, 2.7, 0.12, mSteelDark, -1.5 + 2.14, G.GY + 1.39, -9.75);
    R.boxMesh(g0, 4.5, 0.2, 0.16, mSteelDark, -1.5, G.GY + 2.8, -9.75, 0, 0.01);
    var shopSign = new THREE.Mesh(R.planeGeo(3.6, 0.6), new THREE.MeshToonMaterial({
      map: texPlate('クリーニング', '#f2f4f6', '#2b6fb5', 384, 96, 44),
      emissiveMap: texPlate('クリーニング', '#f2f4f6', '#2b6fb5', 384, 96, 44),
      emissive: 0x8f9296, emissiveIntensity: 0.55,
      gradientMap: R.toonTex(4, true)
    }));
    shopSign.position.set(-1.5, G.GY + 3.3, -9.72);
    g0.add(shopSign);
    R.boxMesh(g0, 3.8, 0.72, 0.06, mSteelDark, -1.5, G.GY + 3.3, -9.77);
    R.halo(g0, -1.5, G.GY + 3.1, -9.4, 2.4, 0xcfe0f0, 0.14);
    // 远处街角贩卖机（简化版 + 冷光）
    R.boxMesh(g0, 0.98, 1.9, 0.7, R.mat(0xdfe3e6, { emissive: 0x22262c, emissiveIntensity: 0.9 }), 5.2, G.GY + 0.95, -11.35, 0, 0.012);
    var fv = new THREE.Mesh(R.planeGeo(0.9, 0.5), R.glowMat(0xbfe4ff, 0.85));
    fv.position.set(5.2, G.GY + 1.42, -10.99);
    g0.add(fv);
    R.groundGlow(g0, 5.2, -10.5, 1.6, 1.0, 0.14, 0x9fd0ff, 0.14);
    R.contact(g0, 5.2, -11.35, 0.6, 0.42, 0.4, G.GY + 0.006);

    /* ---------- 竖排霓虹「カラオケ」 + 洗濯店灯箱 ---------- */
    R.boxMesh(g0, 0.56, 2.24, 0.12, R.mat(0x22262c, { emissive: 0x0c0f13, emissiveIntensity: 0.9 }), 6.35, 4.9, 12.28, 0, 0.012);
    var neonPlane = new THREE.Mesh(R.planeGeo(0.5, 2.12), new THREE.MeshBasicMaterial({ map: texNeon(), fog: true }));
    neonPlane.position.set(6.35, 4.9, 12.21);
    neonPlane.rotation.y = Math.PI;
    g0.add(neonPlane);
    R.neon = { mat: neonPlane.material, halo: R.halo(g0, 6.35, 4.9, 11.6, 3.4, 0xff9fc4, 0.5) };
    expose('neon', R.groundGlow(g0, 6.35, 11.0, 2.4, 1.6, 0.145, 0xff8fb8, 0.3));
    R.tubeBetween(g0, 6.2, 6.0, 12.3, 6.2, 5.4, 12.02, 0.014, mSteelDark, 5);
    R.tubeBetween(g0, 6.5, 6.0, 12.3, 6.5, 5.4, 12.02, 0.014, mSteelDark, 5);
    // 洗濯店灯箱（东侧楼西立面）
    var lBox = R.boxMesh(g0, 0.14, 1.0, 3.4, R.mat(0x2b3a4a, { emissive: 0x0e141c, emissiveIntensity: 0.9 }), 12.72, 3.1, 5.2, 0, 0.012);
    var lPlane = new THREE.Mesh(R.planeGeo(3.2, 0.86), new THREE.MeshBasicMaterial({ map: texLaundry(), fog: true }));
    lPlane.position.set(12.64, 3.1, 5.2);
    lPlane.rotation.y = -Math.PI / 2;
    g0.add(lPlane);
    expose('laundry', R.groundGlow(g0, 12.1, 5.2, 1.0, 2.6, 0.14, 0xcfe4f6, 0.2));
    R.tubeBetween(g0, 12.78, 3.55, 4.6, 12.6, 3.2, 4.6, 0.012, mSteelDark, 5);
    R.tubeBetween(g0, 12.78, 3.55, 5.8, 12.6, 3.2, 5.8, 0.012, mSteelDark, 5);
    /* ---------- 远处红绿灯（悬臂 / 灯头罩檐 / 遮阳板 / 行人灯） ---------- */
    var sig = new THREE.Group();
    sig.position.set(12.95, G.GY, 10.45);
    g0.add(sig);
    R.cylMesh(sig, 0.07, 0.09, 5.4, mPoleGray, 0, 2.7, 0, 14);
    R.cylMesh(sig, 0.13, 0.16, 0.12, mSteelDark, 0, 0.06, 0, 14);
    R.boltRing(sig, 0, 0.03, 0, 0.1, 4, 'y', 0.01);
    R.tubeBetween(sig, 0, 5.32, 0, -0.9, 5.32, 0.01, 0.045, mPoleGray, 10);
    R.tubeBetween(sig, -0.9, 5.32, 0.01, -1.98, 5.08, 0.06, 0.045, mPoleGray, 10);
    R.tubeBetween(sig, 0, 4.78, 0, -1.72, 5.02, 0.05, 0.02, mSteelDark, 6);
    var head = new THREE.Group();
    head.position.set(-1.98, 4.98, 0.1);
    sig.add(head);
    R.boxMesh(head, 0.92, 0.36, 0.26, R.mat(0x3f464c, { emissive: 0x11151a, emissiveIntensity: 0.9 }), 0, 0, 0, 0, 0.012);
    R.boxMesh(head, 1.0, 0.06, 0.34, R.mat(0x2c3238, { emissive: 0x0d1013, emissiveIntensity: 0.9 }), 0, 0.2, 0.02);
    R.boxMesh(head, 0.5, 0.1, 0.08, R.mat(0x2c3238, { emissive: 0x0d1013, emissiveIntensity: 0.9 }), -0.1, 0.27, 0);
    R.bolt(head, 0, 0.32, 0.06, 0.009, 'y');
    R.traffic = { state: 0, lamps: {}, base: {}, dim: {} };
    var lampXs = { red: -0.29, yellow: 0, green: 0.29 };
    var lampCols = { red: 0xd94f3f, yellow: 0xd9b23f, green: 0x54b06a };
    var lampDark = { red: 0x3a1a16, yellow: 0x3a3014, green: 0x1a3320 };
    ['red', 'yellow', 'green'].forEach(function (nm2) {
      var lx = lampXs[nm2];
      var face = new THREE.Mesh(R.circleGeo(0.1, 18), new THREE.MeshBasicMaterial({ color: lampDark[nm2], fog: true }));
      face.position.set(lx, 0, 0.135);
      head.add(face);
      var ring = new THREE.Mesh(R.torusGeo(0.115, 0.014, 6, 20), R.mat(0x2c3238, { emissive: 0x0d1013, emissiveIntensity: 0.9 }));
      ring.position.set(lx, 0, 0.128);
      head.add(ring);
      var visor = R.boxMesh(head, 0.26, 0.03, 0.22, R.mat(0x333a40, { emissive: 0x0f1216, emissiveIntensity: 0.9 }), lx, 0.12, 0.17);
      visor.rotation.x = -0.38;
      R.traffic.lamps[nm2] = {
        mesh: face,
        halo: R.halo(g0, 12.95 - 1.98 + lx, G.GY + 4.98, 10.45 + 0.32, 0.6, lampCols[nm2], 0.06)
      };
      R.traffic.base[nm2] = lampCols[nm2];
      R.traffic.dim[nm2] = lampDark[nm2];
    });
    // 行人灯（立柱上，绿色常亮）
    var ped = new THREE.Group();
    ped.position.set(0.14, 2.6, 0.06);
    sig.add(ped);
    R.boxMesh(ped, 0.24, 0.46, 0.18, R.mat(0x3f464c, { emissive: 0x11151a, emissiveIntensity: 0.9 }), 0, 0, 0, 0, 0.01);
    R.boxMesh(ped, 0.28, 0.05, 0.22, R.mat(0x2c3238, { emissive: 0x0d1013, emissiveIntensity: 0.9 }), 0, 0.26, 0.02);
    var pedR = new THREE.Mesh(R.circleGeo(0.07, 12), new THREE.MeshBasicMaterial({ color: 0x2c2024, fog: true }));
    pedR.position.set(0, 0.1, 0.095);
    ped.add(pedR);
    var pedG = new THREE.Mesh(R.circleGeo(0.07, 12), R.glowMat(0x54b06a, 1));
    pedG.position.set(0, -0.1, 0.095);
    ped.add(pedG);
    R.halo(g0, 12.95 + 0.14, G.GY + 2.5, 10.51, 0.5, 0x6fc47e, 0.3);
    // 信号灯地面反光贴片
    var decalMat = new THREE.MeshBasicMaterial({
      map: R.glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.25)'),
      color: 0x54b06a,
      transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var decal = new THREE.Mesh(R.planeGeo(2.6, 1.6), decalMat);
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(12.95 - 1.98, G.GY + 0.015, 10.45 + 1.15);
    g0.add(decal);
    R.traffic.decal = decal;
    R.traffic.state = 0;
    R.contact(g0, 12.95, 10.45, 0.34, 0.34, 0.4, G.GY + 0.006);

    /* ---------- 微零件实例化汇总（按键 / 价签 / 商品 / 踏脚钉 / 抱箍） ---------- */
    for (var pk2 in VB.prod) {
      if (!Object.prototype.hasOwnProperty.call(VB.prod, pk2)) continue;
      var pp3 = pk2.split('|');
      R.instanced(g0, VGEOS[pp3[0]], parseInt(pp3[1], 10), VB.prod[pk2], {
        emissive: parseInt(pp3[1], 10), emissiveIntensity: 0.18, gradient: 4, soft: true
      });
    }
    if (VB.btn.length) {
      R.instanced(g0, R.cylGeo(0.015, 0.015, 0.02, 10), 0xd8dde2, VB.btn, { emissive: 0x2a2e33, emissiveIntensity: 0.6 });
    }
    if (VB.chip.length) {
      R.instanced(g0, R.boxGeo(0.075, 0.045, 0.014), 0xf2f4f0, VB.chip, { emissive: 0x3a3a36, emissiveIntensity: 0.5 });
    }
    if (IB.step.length) {
      R.instanced(g0, R.cylGeo(0.011, 0.011, 0.13, 6), 0x8a8f94, IB.step, { emissive: 0x171b1f, emissiveIntensity: 0.9 });
    }
    if (IB.gbrk.length) {
      R.instanced(g0, R.boxGeo(0.07, 0.05, 0.07), 0x8f969c, IB.gbrk, { emissive: 0x181c20, emissiveIntensity: 0.9 });
    }
    return g0;
  };
})();
