/* ============================================================
 * 雨夜便利店 · js/store.js
 * 便利店外壳：墙体 / 玻璃幕墙与竖框 / 自动门（可开合）/ 屋檐雨棚 /
 * 招牌灯箱 / 屋顶与女儿墙 / 落水管 / 外立面海报 / 营业中吊牌
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R;
  var JP = '"Yu Gothic UI","Yu Gothic","Hiragino Kaku Gothic ProN","MS PGothic","Meiryo",sans-serif';

  /* ---------------- 贴图 ---------------- */
  function texWall() {
    return R.tileTex('storeWall', 128, 128, function (g, w, h) {
      g.fillStyle = '#f6f4ef'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var v = 235 + Math.floor(R.rng() * 20);
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 4) + ',0.6)';
        g.fillRect(R.rng() * w, R.rng() * h, 2, 2);
      }
      g.fillStyle = 'rgba(180,178,172,0.5)';
      for (var p = 0; p < 3; p++) g.fillRect(0, p * 42 + 18, w, 1.5);
    });
  }
  // 招牌：白底 + 品牌绿 + 蓝橙条纹 + 日文店名 + 24h
  function texSign() {
    return R.tex('sign', 1024, 256, function (g, w, h) {
      g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, w, h);
      // 顶部品牌条纹
      g.fillStyle = '#2f9b6b'; g.fillRect(0, 0, w, 26);
      g.fillStyle = '#2b6fb5'; g.fillRect(0, 26, w, 12);
      g.fillStyle = '#e08a3c'; g.fillRect(0, 38, w, 8);
      // 左侧圆形标志
      g.fillStyle = '#2f9b6b';
      g.beginPath(); g.arc(112, 146, 62, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fdfdfb';
      g.beginPath(); g.arc(112, 146, 46, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b6fb5';
      g.beginPath(); g.arc(112, 146, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fdfdfb';
      g.font = 'bold 42px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('D', 112, 148);
      // 店名
      g.fillStyle = '#20463a';
      g.font = 'bold 120px ' + JP; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('デイリーマート', 208, 148);
      // 英文与 24h
      g.fillStyle = '#4a6f62';
      g.font = 'bold 40px ' + JP;
      g.fillText('DAILY MART', 214, 218);
      g.fillStyle = '#2f9b6b';
      g.fillRect(w - 260, 96, 236, 104);
      g.fillStyle = '#fdfdfb';
      g.font = 'bold 84px ' + JP; g.textAlign = 'center';
      g.fillText('24h', w - 142, 152);
    });
  }
  // 遮挡灯箱顶部的品牌条（冷柜 / 厨柜上方的连续灯条）
  function texBrandStrip() {
    return R.tileTex('brandStrip', 512, 64, function (g, w, h) {
      g.fillStyle = '#f7faf8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2f9b6b'; g.fillRect(0, 0, w, 10);
      g.fillStyle = '#2b6fb5'; g.fillRect(0, 10, w, 5);
      g.fillStyle = '#2a5c4a';
      g.font = 'bold 30px ' + JP; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('デイリーマート', 12, 38);
      g.fillStyle = '#7aa79a';
      g.font = 'bold 22px ' + JP;
      g.fillText('DAILY MART', 250, 38);
      g.fillStyle = '#2f9b6b';
      g.fillRect(w - 90, 20, 70, 34);
      g.fillStyle = '#ffffff';
      g.font = 'bold 24px ' + JP; g.textAlign = 'center';
      g.fillText('24h', w - 55, 38);
    }, 6, 1);
  }
  function texPoster(i) {
    var ads = [
      ['#f6d8e2', '#c0396b', '新発売', 'いちごミルク', '今週のおすすめ'],
      ['#dbe9f7', '#1f5fa8', 'ホット', 'カフェラテ', 'あたたかい一杯'],
      ['#fdf0d5', '#c07a1f', '期間限定', 'おでん', 'だし香る冬の味']
    ];
    var a = ads[i % 3];
    return R.tex('poster' + (i % 3), 256, 320, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, a[0]); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath(); g.arc(w * 0.72, h * 0.42, 46, 0, Math.PI * 2); g.fill();
      g.fillStyle = a[1];
      g.font = 'bold 30px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(a[2], w / 2, 48);
      g.beginPath(); g.arc(w * 0.72, h * 0.42, 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.font = 'bold 34px ' + JP;
      g.fillText('♪', w * 0.72, h * 0.42 + 2);
      g.fillStyle = a[1];
      g.font = 'bold 40px ' + JP;
      g.fillText(a[3], w / 2, h * 0.66);
      g.font = 'bold 22px ' + JP;
      g.fillText(a[4], w / 2, h * 0.8);
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, h - 16, w, 16);
    });
  }
  function texOpenSign() {
    return R.tex('openSign', 128, 80, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2f9b6b'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#2f9b6b';
      g.font = 'bold 40px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('営業中', w / 2, h / 2 + 2);
    });
  }

  /* ---------------- 构建外壳 ---------------- */
  R.buildStore = function (root) {
    var G = R.G, S = G.STORE;
    var g0 = new THREE.Group();
    g0.name = 'store';
    root.add(g0);

    var mWall = R.mat(0xe9e5db, { map: texWall(), gradient: 3 });
    var mWallIn = R.mat(0xdad3c6, { emissive: 0x3b3427, emissiveIntensity: 0.7, gradient: 5, soft: true });
    var mBand = R.mat(0x2f9b6b, { emissive: 0x0c2a1d, emissiveIntensity: 0.9, gradient: 3 });
    var mBandWhite = R.mat(0xf2f4f1, { emissive: 0x30363a, emissiveIntensity: 0.7 });
    var mFrame = R.mat(0x33413a, { emissive: 0x0a110d, emissiveIntensity: 0.9, gradient: 3 });   // 窗框深绿灰
    var mFrameL = R.mat(0x8d979b, { emissive: 0x131a1e, emissiveIntensity: 0.8 });             // 铝框
    var mRoof = R.mat(0x6f737b, { emissive: 0x0e1116, emissiveIntensity: 0.8 });
    var mCeilExt = R.mat(0xefece4, { emissive: 0x2b2a26, emissiveIntensity: 0.9 });
    var OW = 0.016;                     // 主描边宽度

    /* --- 内部楼板 / 天花 / 内墙 --- */
    var mFloor = R.mat(0xc9c4bb, { emissive: 0x40392c, emissiveIntensity: 0.85, gradient: 5, soft: true });
    R.boxMesh(g0, 11.2, 0.12, 8.4, mFloor, -3.0, 0.18, -5.1);                    // 室内地板（0.12..0.24）
    R.boxMesh(g0, 11.2, 0.10, 8.4, mCeilExt, -3.0, 2.95, -5.1);                  // 天花板（2.90..3.00）
    // 内墙贴面
    R.boxMesh(g0, 10.8, 2.66, 0.04, mWallIn, -3.0, 1.57, -9.16);
    R.boxMesh(g0, 0.04, 2.66, 8.4, mWallIn, -8.36, 1.57, -5.1);
    R.boxMesh(g0, 0.04, 2.66, 8.4, mWallIn, 2.36, 1.57, -5.1);

    /* --- 外墙 --- */
    R.boxMesh(g0, 4.52, 0.5, 0.22, mBand, -6.34, 0.37, -0.91, 0, OW);            // 前端左裙板（含品牌色带）
    R.boxMesh(g0, 3.75, 0.5, 0.22, mBand, 0.73, 0.37, -0.91, 0, OW);             // 前端右裙板
    R.boxMesh(g0, 11.2, 0.68, 0.22, mWall, -3.0, 2.96, -0.91, 0, OW);            // 窗上横带（2.62..3.30）
    R.boxMesh(g0, 0.5, 2.0, 0.22, mBandWhite, -8.35, 1.62, -0.91, 0, OW);        // 西侧墩柱
    R.boxMesh(g0, 0.5, 2.0, 0.22, mBandWhite, 2.35, 1.62, -0.91, 0, OW);
    R.boxMesh(g0, 0.2, 2.0, 0.22, mWall, -4.0, 1.62, -0.91, 0, OW);              // 门两侧短墩
    R.boxMesh(g0, 0.2, 2.0, 0.22, mWall, -1.2, 1.62, -0.91, 0, OW);
    // 侧墙 / 后墙
    R.boxMesh(g0, 0.22, 3.18, 8.6, mWall, -8.49, 1.71, -5.1, 0, OW);
    R.boxMesh(g0, 0.22, 3.18, 8.6, mWall, 2.49, 1.71, -5.1, 0, OW);
    R.boxMesh(g0, 11.2, 3.18, 0.22, mWall, -3.0, 1.71, -9.29, 0, OW);
    // 墙脚线（深色反水）
    R.boxMesh(g0, 11.1, 0.14, 0.26, mFrame, -3.0, 0.19, -0.9);
    // 窗户上下横框
    R.boxMesh(g0, 8.0, 0.07, 0.14, mFrame, -5.2, 0.655, -0.89);
    R.boxMesh(g0, 8.0, 0.07, 0.14, mFrame, -5.2, 2.585, -0.89);
    R.boxMesh(g0, 4.1, 0.07, 0.14, mFrame, -6.15, 2.585, -0.89);
    // 竖框
    var mullions = [-8.2, -6.15, -4.1, -1.1, 0.55, 2.2];
    mullions.forEach(function (x) {
      R.boxMesh(g0, 0.07, 1.93, 0.12, mFrame, x, 1.62, -0.89);
      R.boxMesh(g0, 0.026, 1.9, 0.02, mFrameL, x, 1.62, -0.822);   // 铝质压条
    });

    /* --- 玻璃幕墙（登记给 rain.js 做雨痕） --- */
    R.glass = [];
    var mGlass = R.mat(0xbfd8e2, {
      opacity: 0.15, transparent: true, depthWrite: false,
      emissive: 0x0f1c22, emissiveIntensity: 0.9, gradient: 2, side: THREE.DoubleSide
    });
    function pane(x0, x1, y0, y1, z, ry) {
      var m = R.boxMesh(g0, Math.abs(x1 - x0), Math.abs(y1 - y0), 0.02, mGlass, (x0 + x1) / 2, (y0 + y1) / 2, z);
      m.castShadow = false;
      R.glass.push({ mesh: m, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: y0, y1: y1, z: z });
      return m;
    }
    pane(-8.2, -6.15, 0.69, 2.55, -0.97);
    pane(-6.15, -4.1, 0.69, 2.55, -0.97);
    pane(-1.1, 0.55, 0.69, 2.55, -0.97);
    pane(0.55, 2.2, 0.69, 2.55, -0.97);

    /* --- 入口：凹龛 + 自动门 --- */
    var D = G.DOOR;
    R.boxMesh(g0, 2.9, 0.12, 0.28, mFrame, (D.x0 + D.x1) / 2, 0.18, -0.9);         // 凹龛楼板接缝
    R.boxMesh(g0, 2.9, 0.12, 0.22, mWall, (D.x0 + D.x1) / 2, 2.68, -0.91, 0, 0.01); // 凹龛顶
    R.boxMesh(g0, 0.1, 2.5, 0.22, mWall, D.x0 + 0.05, 1.62, -0.91, 0, OW);
    R.boxMesh(g0, 0.1, 2.5, 0.22, mWall, D.x1 - 0.05, 1.62, -0.91, 0, OW);
    R.boxMesh(g0, 2.9, 0.09, 0.9, mCeilExt, (D.x0 + D.x1) / 2, 2.63, -1.15);        // 凹龛吊顶
    R.boxMesh(g0, 0.5, 0.06, 0.3, mFrameL, (D.x0 + D.x1) / 2, 2.6, -1.1, 0, 0.008); // 门机传感器
    var gLed = R.glowMat(0x8fd8ff, 0.9);
    var ml = new THREE.Mesh(R.boxGeo(0.06, 0.02, 0.02), gLed);
    ml.position.set((D.x0 + D.x1) / 2 + 0.18, 2.57, -1.16); g0.add(ml);
    R.doorLed = ml;
    // 门框
    R.boxMesh(g0, 0.08, 2.38, 0.1, mFrame, -3.94, 1.45, -1.1);                     // 左门柱
    R.boxMesh(g0, 0.08, 2.38, 0.1, mFrame, -1.26, 1.45, -1.1);                     // 右门柱
    R.boxMesh(g0, 2.76, 0.14, 0.12, mFrame, -2.6, 2.56, -1.1);                     // 门楣
    R.boxMesh(g0, 2.76, 0.05, 0.12, mFrame, -2.6, 0.27, -1.1);                     // 地轨
    // 两扇滑动门板（初始关闭）
    var doorPanels = [];
    function panel(dir) {
      var p = new THREE.Group();
      var x0 = dir < 0 ? -3.9 : -2.6, x1 = dir < 0 ? -2.6 : -1.3;
      var cx = (x0 + x1) / 2;
      R.boxMesh(p, 1.3, 0.06, 0.05, mFrameL, cx, 2.47, 0);
      R.boxMesh(p, 1.3, 0.06, 0.05, mFrameL, cx, 0.31, 0);
      R.boxMesh(p, 0.06, 2.22, 0.05, mFrameL, dir < 0 ? x0 + 0.03 : x1 - 0.03, 1.39, 0);
      R.boxMesh(p, 0.06, 2.22, 0.05, mFrameL, dir < 0 ? x1 - 0.03 : x0 + 0.03, 1.39, 0);
      var gl = R.boxMesh(p, 1.18, 2.1, 0.015, mGlass, cx, 1.39, 0);
      gl.castShadow = false;
      R.boxMesh(p, 0.03, 1.1, 0.06, mFrameL, dir < 0 ? x1 - 0.13 : x0 + 0.13, 1.3, 0); // 拉手竖条
      R.boxMesh(p, 0.08, 0.1, 0.06, mFrameL, cx, 2.42, 0);                          // 吊挂座
      R.boxMesh(p, 0.05, 0.08, 0.05, mFrameL, dir < 0 ? x0 + 0.07 : x1 - 0.07, 0.26, 0); // 下导靴
      p.position.set(0, 0, -1.1);
      g0.add(p);
      return { g: p, cx: cx, dir: dir, slide: 0 };
    }
    doorPanels.push(panel(-1), panel(1));
    // 门口地垫（外 / 内）
    function texMat() {
      return R.tileTex('doormat', 128, 64, function (g, w, h) {
        g.fillStyle = '#3a3f46'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.16)';
        for (var i = 0; i < 9; i++) g.fillRect(4, 3 + i * 7, w - 8, 3);
        g.fillStyle = 'rgba(240,240,235,0.8)';
        g.font = 'bold 17px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('WELCOME', w / 2, h - 8);
      });
    }
    var mMat0 = R.mat(0x3c4149, { map: texMat() });
    R.boxMesh(g0, 2.5, 0.03, 0.72, mMat0, -2.6, 0.135, -0.4);                      // 门外地垫
    R.boxMesh(g0, 2.5, 0.03, 0.34, mBoxMat2(), -2.6, 0.255, -1.35);                // 门内地垫
    function mBoxMat2() { return R.mat(0x2f333a, { map: texMat() }); }
    // 台阶（外低内高）
    R.boxMesh(g0, 2.6, 0.12, 0.12, mBandWhite, -2.6, 0.06, -0.86);

    /* --- 屋檐雨棚 --- */
    var mCanopy = R.mat(0xefece4, { emissive: 0x2c2b27, emissiveIntensity: 0.9 });
    R.boxMesh(g0, 11.0, 0.13, 1.18, mCanopy, -3.0, 2.795, -0.21, 0, 0.014);       // 雨棚板
    R.boxMesh(g0, 11.0, 0.3, 0.08, mBand, -3.0, 2.71, 0.35, 0, 0.012);             // 雨棚前缘（品牌绿）
    R.boxMesh(g0, 11.0, 0.05, 0.1, mBandWhite, -3.0, 2.585, 0.35);                 // 前缘白线
    for (var cr = 0; cr < 6; cr++) {                                               // 雨棚下支撑肋
      R.boxMesh(g0, 0.06, 0.1, 1.1, mCanopy, -7.9 + cr * 2.0, 2.68, -0.21);
    }
    R.boxMesh(g0, 10.94, 0.06, 0.06, mFrame, -3.0, 2.6, 0.33);                     // 前缘滴水唇
    // 雨棚下筒灯 + 灯光溢出
    R.glows = R.glows || {};
    var mDown = R.glowMat(0xfff0d2, 1);
    [-7.2, -3.0, 1.2].forEach(function (x) {
      var d = new THREE.Mesh(R.circleGeo(0.075, 14), mDown);
      d.rotation.x = Math.PI / 2;
      d.position.set(x, 2.727, -0.05);
      g0.add(d);
      R.halo(g0, x, 2.715, -0.05, 0.42, 0xffe6bd, 0.5);
      R.groundGlow(g0, x, 0.55, 1.5, 1.0, 0.152, 0xffdcae, 0.30);
    });
    // 雨棚斜拉杆 + 墙座
    [-7.6, 1.6].forEach(function (x) {
      var rod = R.cylMesh(g0, 0.018, 0.018, 1.34, mFrameL, x, 2.5, -0.25, 8);
      rod.rotation.x = 1.19;
      R.boxMesh(g0, 0.1, 0.14, 0.05, mFrameL, x, 2.25, -0.83);
    });

    /* --- 招牌灯箱 --- */
    var mSignBox = R.mat(0xf6f5f1, { emissive: 0x8a8f88, emissiveIntensity: 0.55 });
    R.boxMesh(g0, 10.9, 0.66, 0.18, R.mat(0x2a6049, { emissive: 0x0d2b1f, emissiveIntensity: 1 }), -3.0, 3.16, -0.71, 0, 0.014);
    var signBody = R.boxMesh(g0, 10.7, 0.54, 0.16, mSignBox, -3.0, 3.16, -0.7);
    var signTex = texSign();
    var mSign = new THREE.Mesh(R.planeGeo(10.7, 0.54), new THREE.MeshBasicMaterial({
      map: signTex, color: 0xffffff, fog: true
    }));
    mSign.position.set(-3.0, 3.16, -0.618);
    g0.add(mSign);
    R.signMat = mSign.material;                       // 由 dynamics 做闪烁
    R.halo(g0, -3.0, 3.16, -0.5, 3.6, 0xdff0e6, 0.16);
    R.glows.sign = R.groundGlow(g0, -3.0, 1.5, 8.6, 2.6, 0.153, 0xbdf0d4, 0.12);
    R.glows.sign.material = R.glows.sign.material.clone();   // 独立材质参与闪烁
    R.signGlowMat = R.glows.sign.material;
    // 招牌下方小灯（24時間営業）
    var mPlate = R.mat(0xffffff, { emissive: 0xf4f8f5, emissiveIntensity: 0.9 });
    R.boxMesh(g0, 1.25, 0.16, 0.26, mPlate, 1.6, 2.72, -0.55, 0, 0.008);
    var tex24 = R.tex('plate24h', 256, 40, function (g, w, h) {
      g.fillStyle = '#f4f8f5'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2f9b6b';
      g.font = 'bold 26px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('24時間営業', w / 2, h / 2 + 1);
    });
    var plate24 = new THREE.Mesh(R.planeGeo(1.2, 0.15), new THREE.MeshBasicMaterial({ map: tex24, fog: true }));
    plate24.position.set(1.6, 2.72, -0.418);
    g0.add(plate24);

    /* --- 屋顶 / 女儿墙 --- */
    R.boxMesh(g0, 11.2, 0.1, 8.6, mRoof, -3.0, 3.29, -5.1, 0, 0.012);
    R.boxMesh(g0, 11.2, 0.32, 0.16, mWall, -3.0, 3.46, -0.88, 0, 0.012);
    R.boxMesh(g0, 11.2, 0.32, 0.16, mWall, -3.0, 3.46, -9.32, 0, 0.012);
    R.boxMesh(g0, 0.16, 0.32, 8.6, mWall, -8.52, 3.46, -5.1, 0, 0.012);
    R.boxMesh(g0, 0.16, 0.32, 8.6, mWall, 2.52, 3.46, -5.1, 0, 0.012);
    var mCoping = R.mat(0xb9bcc0, { emissive: 0x151a1f, emissiveIntensity: 0.8 });
    R.boxMesh(g0, 11.3, 0.05, 0.22, mCoping, -3.0, 3.645, -0.88);
    R.boxMesh(g0, 11.3, 0.05, 0.22, mCoping, -3.0, 3.645, -9.32);
    R.boxMesh(g0, 0.22, 0.05, 8.7, mCoping, -8.52, 3.645, -5.1);
    R.boxMesh(g0, 0.22, 0.05, 8.7, mCoping, 2.52, 3.645, -5.1);
    // 屋顶设备：通风管、空调外机、检修梯、检修口
    var mVent = R.mat(0x9aa0a6, { emissive: 0x141a20, emissiveIntensity: 0.8 });
    R.cylMesh(g0, 0.11, 0.11, 0.5, mVent, -6.6, 3.59, -6.6, 10);
    R.cylMesh(g0, 0.16, 0.16, 0.06, mVent, -6.6, 3.86, -6.6, 10);
    R.cylMesh(g0, 0.09, 0.09, 0.36, mVent, -5.6, 3.52, -7.9, 10);
    R.cylMesh(g0, 0.13, 0.13, 0.05, mVent, -5.6, 3.72, -7.9, 10);
    R.boxMesh(g0, 0.86, 0.7, 1.0, mVent, 0.9, 3.69, -7.6, 0, 0.012);              // 屋顶空调外机
    R.cylMesh(g0, 0.3, 0.3, 0.02, R.mat(0x4a5057), 0.9, 3.55, -7.08, 14).rotation.x = Math.PI / 2;
    for (var i = 0; i < 7; i++) {                                                 // 检修梯
      R.boxMesh(g0, 0.44, 0.03, 0.03, mVent, 1.2, 3.5 + i * 0.34, -9.16);
    }
    R.boxMesh(g0, 0.05, 2.4, 0.05, mVent, 0.96, 4.5, -9.16);
    R.boxMesh(g0, 0.05, 2.4, 0.05, mVent, 1.44, 4.5, -9.16);
    R.boxMesh(g0, 0.9, 0.14, 0.9, mRoof, -7.4, 3.41, -2.6, 0, 0.01);              // 检修口

    /* --- 落水管 --- */
    var mPipe = R.mat(0xd6d3cb, { emissive: 0x22262b, emissiveIntensity: 0.7 });
    function drain(x, z, h, ry) {
      R.cylMesh(g0, 0.05, 0.05, h, mPipe, x, 0.12 + h / 2, z, 8);
      var elbow = R.cylMesh(g0, 0.05, 0.05, 0.26, mPipe, x, 0.2, z + 0.13, 8);
      elbow.rotation.x = Math.PI / 2.6;
      if (ry) elbow.rotation.y = ry;
      R.boxMesh(g0, 0.13, 0.05, 0.13, mFrame, x, 0.12 + h * 0.45, z);   // 管卡
      R.boxMesh(g0, 0.13, 0.05, 0.13, mFrame, x, 0.12 + h * 0.8, z);    // 管卡
    }
    drain(-8.46, -0.66, 3.3);
    drain(2.46, -0.66, 3.3);
    drain(2.46, -9.36, 3.3);
    drain(-8.46, -9.36, 3.3);

    /* --- 外立面海报框 + 营业中吊牌 --- */
    function posterFrame(x, y, z, w, h, ry, idx) {
      var grp = new THREE.Group();
      var mFr = R.mat(0x6b7278, { emissive: 0x14181c, emissiveIntensity: 0.9 });
      R.boxMesh(grp, w + 0.06, h + 0.06, 0.03, mFr, 0, 0, 0, 0, 0.008);
      var pm = new THREE.Mesh(R.planeGeo(w, h), new THREE.MeshToonMaterial({
        map: texPoster(idx), emissiveMap: texPoster(idx), emissive: 0xdcdcdc, emissiveIntensity: 0.5,
        gradientMap: R.toonTex(4, true)
      }));
      pm.position.z = 0.02;
      grp.add(pm);
      grp.position.set(x, y, z);
      grp.rotation.y = ry || 0;
      g0.add(grp);
    }
    posterFrame(-8.35, 1.62, -0.78, 0.34, 0.72, 0, 0);
    posterFrame(2.35, 1.62, -0.78, 0.34, 0.72, 0, 2);
    posterFrame(-6.15, 0.66, -0.84, 0.3, 0.62, 0, 1);      // 窗下横带上的小海报
    // 东侧外墙大海报
    posterFrame(2.63, 1.55, -1.55, 0.86, 1.1, Math.PI / 2, 1);
    // 后墙后场门 + 壁灯 + 门五金 / 踏步
    var mDoor = R.mat(0x9aa39d, { emissive: 0x161c1a, emissiveIntensity: 0.9 });
    R.boxMesh(g0, 1.0, 2.1, 0.08, mDoor, 0.9, 1.17, -9.44, 0, 0.012);
    R.boxMesh(g0, 0.62, 0.5, 0.03, R.mat(0x5b6460), 0.9, 1.68, -9.48);
    R.boxMesh(g0, 0.16, 0.1, 0.12, R.mat(0x3c4348), 0.9, 2.42, -9.5);
    R.boxMesh(g0, 1.2, 0.06, 0.12, mRoof, 0.9, 2.27, -9.47);                       // 后门雨檐
    R.boxMesh(g0, 1.2, 0.1, 0.42, mBandWhite, 0.9, 0.06, -9.58, 0, 0.01);          // 后门踏步
    R.boxMesh(g0, 0.05, 0.14, 0.05, mFrame, 0.45, 1.9, -9.47);                     // 铰链
    R.boxMesh(g0, 0.05, 0.14, 0.05, mFrame, 0.45, 0.85, -9.47);
    R.boxMesh(g0, 0.16, 0.05, 0.08, mFrameL, 1.26, 1.06, -9.49);                   // 门把
    var lamp = new THREE.Mesh(R.boxGeo(0.14, 0.02, 0.1), R.glowMat(0xffdca8, 1));
    lamp.position.set(0.9, 2.36, -9.5); g0.add(lamp);
    R.halo(g0, 0.9, 2.3, -9.5, 0.7, 0xffd8a0, 0.45);
    R.groundGlow(g0, 0.9, -9.0, 1.1, 0.9, 0.148, 0xffcf96, 0.26);

    // 营业中吊牌（挂在右窗内侧）
    var mHang = new THREE.Mesh(R.planeGeo(0.42, 0.26), new THREE.MeshToonMaterial({
      map: texOpenSign(), emissiveMap: texOpenSign(), emissive: 0xffffff, emissiveIntensity: 0.85,
      gradientMap: R.toonTex(4, true), side: THREE.DoubleSide
    }));
    mHang.position.set(-0.5, 2.05, -1.06);
    g0.add(mHang);
    R.boxMesh(g0, 0.01, 0.3, 0.01, mFrameL, -0.5, 2.33, -1.06);

    R.store = {
      group: g0,
      door: { panels: doorPanels, closedCx: [doorPanels[0].cx, doorPanels[1].cx] },
      brandStripTex: texBrandStrip()
    };
    return g0;
  };
})();
