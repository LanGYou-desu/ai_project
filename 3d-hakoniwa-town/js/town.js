/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · town.js
 * 台地小镇：广场喷泉、民居、店铺、钟楼、神社、城堡、
 * 风车、摩天轮、灯塔、港口码头、桥梁台阶与花草树木
 * ============================================================ */
(function () {
  'use strict';
  var H = window.H;
  var scene = null;

  // ---------- 共享几何与发光材质 ----------
  var winGeo = new THREE.PlaneGeometry(0.55, 0.66);
  var winGeoSmall = new THREE.PlaneGeometry(0.42, 0.5);
  H.winMats = [];
  H.signMats = [];
  H.lampLights = [];
  H.lampGlows = [];
  H.smokeOrigins = [];
  H.swayTrees = [];
  H.flags = [];

  function makeWinMat(emissive, base) {
    var m = new THREE.MeshStandardMaterial({
      color: base, emissive: emissive, emissiveIntensity: 0, roughness: 0.35, metalness: 0.05
    });
    H.winMats.push(m);
    return m;
  }
  var winWarm = makeWinMat(0xffc46b, 0x232840);
  var winCool = makeWinMat(0xbfe6ff, 0x1f2738);
  var winWarm2 = makeWinMat(0xffb04f, 0x2a2c3e);

  H.lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff1cf, emissive: 0xffdf9e, emissiveIntensity: 0, roughness: 0.3
  });
  H.lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe9b8, emissive: 0xffb45e, emissiveIntensity: 0, roughness: 0.4
  });
  H.beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false, fog: false
  });

  // ---------- 基础构件 ----------
  function box(w, h, d, color, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), H.mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, color, seg, opts) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), H.mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cone(r, h, color, seg, opts) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 4), H.mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function sph(r, color, opts) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), H.mat(color, opts));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  var winFrameGeo = new THREE.PlaneGeometry(0.68, 0.8);
  var winFrameGeoSmall = new THREE.PlaneGeometry(0.53, 0.62);
  function addWin(group, x, y, z, ry, mat, small, shut) {
    // 窗框（贴墙内衬，白色饰边）
    var fr = new THREE.Mesh(small ? winFrameGeoSmall : winFrameGeo, H.mat('#efe6d2'));
    fr.position.set(x, y, z);
    fr.rotation.y = ry;
    fr.translateZ(-0.012);
    group.add(fr);
    var m = new THREE.Mesh(small ? winGeoSmall : winGeo, mat || winWarm);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.translateZ(0.02);
    group.add(m);
    // 窗棂（横竖条，夜间透光成剪影）
    var barMat = H.mat('#4a3f33');
    var hb = new THREE.Mesh(new THREE.PlaneGeometry(small ? 0.53 : 0.68, 0.045), barMat);
    hb.position.set(x, y, z);
    hb.rotation.y = ry;
    hb.translateZ(0.03);
    group.add(hb);
    var vb = new THREE.Mesh(new THREE.PlaneGeometry(0.045, small ? 0.62 : 0.8), barMat);
    vb.position.set(x, y, z);
    vb.rotation.y = ry;
    vb.translateZ(0.03);
    group.add(vb);
    // 百叶窗板（shut）
    if (shut) {
      var dirX = Math.cos(ry), dirZ = -Math.sin(ry);
      var sw2 = small ? 0.42 : 0.55;
      var off = sw2 / 2 + 0.1;
      for (var sI = -1; sI <= 1; sI += 2) {
        var sh = new THREE.Mesh(new THREE.PlaneGeometry(0.17, small ? 0.52 : 0.7), H.mat('#8a6a4a'));
        sh.position.set(x + dirX * off * sI, y, z + dirZ * off * sI);
        sh.rotation.y = ry;
        sh.translateZ(0.012);
        group.add(sh);
      }
    }
  }
  function gableRoof(w, h, d, color) {
    var shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.closePath();
    var geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    var m = new THREE.Mesh(geo, H.mat(color));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ---------- 民居 ----------
  function house(x, z, ry, o) {
    o = o || {};
    var g = new THREE.Group();
    var w = o.w || H.rand(2.8, 3.6), d = o.d || H.rand(2.8, 3.6), h = o.h || H.rand(2.6, 3.5);
    var wall = o.wall || H.pick(['#f2e7d3', '#f7d9c4', '#cfe8d8', '#dbe7f2', '#f3efe4']);
    var roof = o.roof || H.pick(['#c96f4a', '#5b7080', '#4f8a8b', '#6b4a3a', '#a5624a']);
    // 依据四角地形自适应石基：低角落地、高角埋入，石基完整包住高差
    var bi = H.baseInfo(x, z, w, d, ry);
    var ft = (bi.max - bi.min) + 0.35;
    g.position.set(x, bi.min, z);
    g.rotation.y = ry;
    var plinth = box(w + 0.22, ft + 0.9, d + 0.22, '#b7b2a7');
    plinth.position.y = (ft - 0.9) / 2;
    g.add(plinth);
    var base = box(w, h, d, wall);
    base.position.y = ft + h / 2;
    g.add(base);
    var roofM = gableRoof(w + 0.7, h * 0.55 + 0.4, d + 0.7, roof);
    roofM.position.y = ft + h;
    g.add(roofM);
    var ridgeCap = box(0.18, 0.2, d + 0.84, '#5a4a3a');
    ridgeCap.position.y = ft + h + (h * 0.55 + 0.4) + 0.04;
    g.add(ridgeCap);
    // 檐口饰边
    var fas1 = box(0.12, 0.14, d + 0.82, '#efe6d2');
    fas1.position.set(-(w + 0.7) / 2, ft + h + 0.02, 0);
    g.add(fas1);
    var fas2 = box(0.12, 0.14, d + 0.82, '#efe6d2');
    fas2.position.set((w + 0.7) / 2, ft + h + 0.02, 0);
    g.add(fas2);
    // 墙角饰线
    var cornerCols = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    for (var ci = 0; ci < cornerCols.length; ci++) {
      var cor = box(0.12, h + 0.12, 0.12, '#efe6d2');
      cor.position.set(cornerCols[ci][0], ft + h / 2, cornerCols[ci][1]);
      g.add(cor);
    }
    // 门（带门框）
    var door = box(0.72, 1.35, 0.08, o.door || '#8a5a3b');
    door.position.set(0, ft + 0.675, d / 2 + 0.04);
    g.add(door);
    var postL = box(0.1, 1.5, 0.1, '#6b4a3a');
    postL.position.set(-0.43, ft + 0.75, d / 2 + 0.05);
    g.add(postL);
    var postR = box(0.1, 1.5, 0.1, '#6b4a3a');
    postR.position.set(0.43, ft + 0.75, d / 2 + 0.05);
    g.add(postR);
    var lintel = box(0.96, 0.12, 0.1, '#6b4a3a');
    lintel.position.set(0, ft + 1.46, d / 2 + 0.05);
    g.add(lintel);
    var knob = sph(0.06, '#e8c66a', { metalness: 0.6, roughness: 0.3 });
    knob.position.set(0.22, ft + 0.7, d / 2 + 0.1);
    g.add(knob);
    // 窗（正/背/侧）
    addWin(g, -w / 4, ft + 1.75, d / 2 + 0.02, 0, winWarm, false, true);
    addWin(g, w / 4, ft + 1.75, d / 2 + 0.02, 0, winCool, false, true);
    addWin(g, 0, ft + 1.75, -d / 2 - 0.02, Math.PI, winWarm2, false, true);
    addWin(g, w / 2 + 0.02, ft + 1.75, -d / 4, Math.PI / 2, winCool);
    addWin(g, -w / 2 - 0.02, ft + 1.75, -d / 4, -Math.PI / 2, winWarm);
    // 烟囱
    if (o.chimney !== false) {
      var ch = box(0.38, 1.15, 0.38, '#9a6a52');
      ch.position.set(w * 0.28, ft + h + 0.75, -d * 0.15);
      g.add(ch);
      var cap = box(0.5, 0.12, 0.5, '#6b4a3a');
      cap.position.set(w * 0.28, ft + h + 1.36, -d * 0.15);
      g.add(cap);
      H.smokeOrigins.push(H.worldPos(g, w * 0.28, ft + h + 1.5, -d * 0.15));
    }
    // 花坛
    var fb = cyl(0.55, 0.62, 0.3, '#b7b2a7', 8);
    fb.position.set(w / 2 + 0.5, ft + 0.15, d / 2 + 0.3);
    g.add(fb);
    var fbFlower = sph(0.4, H.pick(['#e78ab8', '#f0b8cc', '#f5d76e']), { roughness: 0.9 });
    fbFlower.scale.y = 0.55;
    fbFlower.position.set(w / 2 + 0.5, ft + 0.45, d / 2 + 0.3);
    g.add(fbFlower);
    H.addShadowDisc(scene, x, z, Math.max(w, d) * 0.95, 0.38);
    scene.add(g);
    return g;
  }

  // ---------- 店铺（带发光招牌与条纹遮阳篷） ----------
  function shop(x, z, ry, name, wall, roof) {
    var g = new THREE.Group();
    var w = 4.2, d = 3.6, h = 3.4;
    var bi = H.baseInfo(x, z, w, d, ry);
    var ft = (bi.max - bi.min) + 0.3;
    g.position.set(x, bi.min, z);
    g.rotation.y = ry;
    var plinth = box(w + 0.24, ft + 0.9, d + 0.24, '#b7b2a7');
    plinth.position.y = (ft - 0.9) / 2;
    g.add(plinth);
    var base = box(w, h, d, wall);
    base.position.y = ft + h / 2;
    g.add(base);
    var roofSlab = box(w + 0.5, 0.28, d + 0.5, roof);
    roofSlab.position.y = ft + h + 0.14;
    g.add(roofSlab);
    var parapet = box(w + 0.5, 0.35, 0.2, roof);
    parapet.position.set(0, ft + h + 0.45, -d / 2 - 0.15);
    g.add(parapet);
    H.addShadowDisc(scene, x, z, 3.1, 0.36);
    // 招牌（夜间发光）
    var tex = H.signTexture(name, '#2f3a52', '#ffe9b8');
    var signMat = new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.6
    });
    H.signMats.push(signMat);
    var sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.72, 0.12), signMat);
    sign.position.set(0, ft + h - 0.55, d / 2 + 0.1);
    g.add(sign);
    var signFrame = box(2.9, 0.12, 0.18, '#5a4636');
    signFrame.position.set(0, ft + h - 0.12, d / 2 + 0.08);
    g.add(signFrame);
    // 门与橱窗
    var door = box(1.0, 2.0, 0.08, '#7a5a3e');
    door.position.set(0, ft + 1.0, d / 2 + 0.04);
    g.add(door);
    var postL = box(0.1, 2.1, 0.1, '#5a4636');
    postL.position.set(-0.57, ft + 1.05, d / 2 + 0.05);
    g.add(postL);
    var postR = box(0.1, 2.1, 0.1, '#5a4636');
    postR.position.set(0.57, ft + 1.05, d / 2 + 0.05);
    g.add(postR);
    var lintel = box(1.24, 0.12, 0.1, '#5a4636');
    lintel.position.set(0, ft + 2.08, d / 2 + 0.05);
    g.add(lintel);
    addWin(g, -1.35, ft + 1.9, d / 2 + 0.02, 0, winCool);
    addWin(g, 1.35, ft + 1.9, d / 2 + 0.02, 0, winCool);
    // 遮阳篷（条纹）
    var stripes = H.stripesTexture('#e2685f', '#f6efe2', 8);
    var awnMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.9, side: THREE.DoubleSide });
    var awn = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), awnMat);
    awn.position.set(0, ft + 2.35, d / 2 + 0.55);
    awn.rotation.x = -0.5;
    awn.castShadow = true;
    g.add(awn);
    // 门口灯笼
    var lan = cyl(0.16, 0.16, 0.5, '#8a4a3a', 8);
    lan.position.set(0.9, ft + 2.0, d / 2 + 0.28);
    g.add(lan);
    var glow = sph(0.2, '#ffe3a0', { emissive: 0xffc46b, emissiveIntensity: 0 });
    glow.position.set(0.9, ft + 2.35, d / 2 + 0.28);
    g.add(glow);
    H.winMats.push(glow.material);
    scene.add(g);
    return g;
  }

  // ---------- 钟楼 ----------
  function clockTower(x, z, ry) {
    var g = new THREE.Group();
    var w = 3.2, d = 3.2;
    var bi = H.baseInfo(x, z, w, d, ry);
    var ft = (bi.max - bi.min) + 0.35;
    g.position.set(x, bi.min, z);
    g.rotation.y = ry;
    var plinth = box(3.7, ft + 0.9, 3.7, '#b7b2a7');
    plinth.position.y = (ft - 0.9) / 2;
    g.add(plinth);
    var base = box(3.2, 7.4, 3.2, '#cfc8bb');
    base.position.y = ft + 3.7;
    g.add(base);
    var ledge = box(4.0, 0.5, 4.0, '#b7b2a7');
    ledge.position.y = ft + 7.65;
    g.add(ledge);
    var top = box(2.6, 1.6, 2.6, '#d8d2c6');
    top.position.y = ft + 8.7;
    g.add(top);
    H.addShadowDisc(scene, x, z, 3.0, 0.38);
    // 四面钟面
    var faceGeo = new THREE.CircleGeometry(0.95, 24);
    var faceMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, emissive: 0xfff3c9, emissiveIntensity: 0, roughness: 0.5 });
    H.winMats.push(faceMat);
    var hands = { hour: [], minute: [] };
    for (var i = 0; i < 4; i++) {
      var ang = i * Math.PI / 2;
      var face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(Math.sin(ang) * 1.35, ft + 8.9, Math.cos(ang) * 1.35);
      face.rotation.y = ang;
      g.add(face);
      // 每面配一组指针（挂在各自朝向的组里）
      var hg = new THREE.Group();
      hg.position.set(Math.sin(ang) * 1.41, ft + 8.9, Math.cos(ang) * 1.41);
      hg.rotation.y = ang;
      var hh = box(0.09, 0.5, 0.03, '#3a3a44');
      hh.geometry.translate(0, 0.2, 0);
      hg.add(hh);
      var mm = box(0.06, 0.7, 0.03, '#3a3a44');
      mm.geometry.translate(0, 0.28, 0);
      hg.add(mm);
      g.add(hg);
      hands.hour.push(hh); hands.minute.push(mm);
    }
    H.clockHands = hands;
    // 尖顶
    var spire = cone(1.7, 2.8, '#5b7080', 4);
    spire.position.y = ft + 10.9;
    g.add(spire);
    var ball = sph(0.22, '#e8c66a', { metalness: 0.7, roughness: 0.25 });
    ball.position.y = ft + 12.5;
    g.add(ball);
    // 钟楼门（带门框）
    var door = box(1.0, 1.9, 0.1, '#6b4a3a');
    door.position.set(0, ft + 0.95, 1.65);
    g.add(door);
    var postL = box(0.1, 2.0, 0.1, '#5a4636');
    postL.position.set(-0.57, ft + 1.0, 1.66);
    g.add(postL);
    var postR = box(0.1, 2.0, 0.1, '#5a4636');
    postR.position.set(0.57, ft + 1.0, 1.66);
    g.add(postR);
    var lintel = box(1.24, 0.12, 0.1, '#5a4636');
    lintel.position.set(0, ft + 2.03, 1.66);
    g.add(lintel);
    addWin(g, -0.9, ft + 2.6, 1.62, 0, winWarm);
    addWin(g, 0.9, ft + 2.6, 1.62, 0, winCool);
    addWin(g, 0, ft + 2.6, -1.62, Math.PI, winWarm2);
    scene.add(g);
    return g;
  }

  // ---------- 灯塔 ----------
  function lighthouse(x, z) {
    var g = new THREE.Group();
    var y0 = H.groundHeight(x, z);
    g.position.set(x, y0, z);
    var base = cyl(2.3, 2.7, 2.2, '#b7b2a7', 14);
    base.position.y = 0.3;
    g.add(base);
    var cols = ['#f5f1e8', '#c9564e'];
    for (var i = 0; i < 4; i++) {
      var t = cyl(1.7 - i * 0.12, 1.95 - i * 0.12, 2.5, cols[i % 2], 14);
      t.position.y = 1.4 + 2.5 * i + 1.25;
      g.add(t);
    }
    var room = cyl(1.3, 1.5, 1.7, '#3a4a5e', 12);
    room.position.y = 11.9;
    g.add(room);
    var glass = cyl(1.15, 1.15, 1.2, '#bfe6ff', 12, { emissive: 0xffe9b8, emissiveIntensity: 0, transparent: true, opacity: 0.85 });
    glass.position.y = 11.9;
    g.add(glass);
    H.winMats.push(glass.material);
    var roof = cone(1.6, 1.4, '#c9564e', 12);
    roof.position.y = 13.4;
    g.add(roof);
    // 灯室观景台护栏
    var gallery = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.07, 8, 24), H.mat('#b7b2a7'));
    gallery.rotation.x = Math.PI / 2;
    gallery.position.y = 12.78;
    g.add(gallery);
    var lamp = sph(0.55, '#fff7dc', { emissive: 0xfff1c4, emissiveIntensity: 0 });
    lamp.position.y = 11.9;
    g.add(lamp);
    H.winMats.push(lamp.material);
    // 旋转光束
    var beam = new THREE.Mesh(new THREE.ConeGeometry(1.7, 24, 20, 1, true), H.beamMat);
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0, 11.9, 14);
    g.add(beam);
    H.beam = beam;
    // 门与窗
    var door = box(0.9, 1.5, 0.1, '#6b4a3a');
    door.position.set(0, 0.75, 2.6);
    g.add(door);
    addWin(g, 0, 5.2, 2.15, 0, winWarm);
    addWin(g, 0, 8.2, 1.98, 0, winCool);
    scene.add(g);
    return g;
  }

  // ---------- 风车 ----------
  function windmill(x, z) {
    var g = new THREE.Group();
    var wbi = H.baseInfo(x, z, 3.6, 3.6, 0);
    var bodyH = 5.4 + (wbi.max - wbi.min) + 1.2;
    g.position.set(x, wbi.min, z);
    var body = cyl(1.15, 1.75, bodyH, '#b08968', 12);
    body.position.y = 5.4 - bodyH / 2;
    g.add(body);
    var band1 = cyl(1.2, 1.35, 0.5, '#8a5a3b', 12);
    band1.position.y = 3.4;
    g.add(band1);
    var cap = cone(1.5, 1.6, '#6b4a3a', 12);
    cap.position.y = 6.1;
    g.add(cap);
    // 叶片
    var blades = new THREE.Group();
    blades.position.set(0, 5.8, 1.5);
    for (var i = 0; i < 4; i++) {
      var blade = new THREE.Group();
      var arm = box(0.24, 4.3, 0.1, '#7a5a3e');
      arm.position.y = 2.15;
      blade.add(arm);
      var sail = box(0.9, 3.2, 0.06, '#f3efe4');
      sail.position.set(0.42, 2.0, 0.06);
      blade.add(sail);
      blade.rotation.z = i * Math.PI / 2;
      blades.add(blade);
    }
    g.add(blades);
    H.windmillBlades = blades;
    var hub = sph(0.3, '#4a3a2c');
    hub.position.set(0, 5.8, 1.55);
    g.add(hub);
    var door = box(0.8, 1.4, 0.1, '#5a4636');
    door.position.set(0, 0.7, 1.75);
    g.add(door);
    addWin(g, 0, 2.6, 1.9, 0, winWarm);
    scene.add(g);
    return g;
  }

  // ---------- 摩天轮 ----------
  function ferrisWheel(x, z, ry) {
    var g = new THREE.Group();
    var R = 5.0;
    var fbi = H.baseInfo(x, z, 6.4, 6.4, ry);
    var legH = (R + 2.6) + (fbi.max - fbi.min) + 0.9;
    g.position.set(x, fbi.min, z);
    g.rotation.y = ry;
    // 支架（自适应坡地高差，加横撑）
    var leg1 = box(0.45, legH, 0.45, '#5b7080');
    leg1.position.set(-2.6, (R + 2.6) - legH / 2, 0);
    leg1.rotation.z = 0.18;
    g.add(leg1);
    var leg2 = box(0.45, legH, 0.45, '#5b7080');
    leg2.position.set(2.6, (R + 2.6) - legH / 2, 0);
    leg2.rotation.z = -0.18;
    g.add(leg2);
    var cross = box(5.4, 0.28, 0.3, '#4a4a55');
    cross.position.set(0, 2.3, 0);
    g.add(cross);
    var axle = cyl(0.35, 0.35, 0.8, '#4a4a55', 10);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(0, R + 0.4, 0);
    g.add(axle);
    // 轮盘
    var wheel = new THREE.Group();
    wheel.position.set(0, R + 0.4, 0.3);
    var ring1 = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 8, 40), H.mat('#e2685f'));
    ring1.castShadow = true;
    wheel.add(ring1);
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.16, 8, 30), H.mat('#5b7080'));
    wheel.add(ring2);
    var spokeGeo = new THREE.CylinderGeometry(0.09, 0.09, R, 6);
    for (var i = 0; i < 8; i++) {
      var sp = new THREE.Mesh(spokeGeo, H.mat('#4a4a55'));
      var a = i * Math.PI / 4;
      sp.position.set(Math.sin(a) * R / 2, Math.cos(a) * R / 2, 0);
      sp.rotation.z = -a;
      wheel.add(sp);
    }
    // 吊舱与彩灯
    var lightMats = [
      new THREE.MeshStandardMaterial({ color: 0x6fd8ff, emissive: 0x6fd8ff, emissiveIntensity: 0 }),
      new THREE.MeshStandardMaterial({ color: 0xffd76f, emissive: 0xffd76f, emissiveIntensity: 0 }),
      new THREE.MeshStandardMaterial({ color: 0xff8fb8, emissive: 0xff8fb8, emissiveIntensity: 0 })
    ];
    H.ferrisLights = lightMats;
    H.wheelCabins = [];
    var cabinColors = ['#e2685f', '#5b8f8b', '#e8c66a', '#8f7fb8', '#6fa3d8'];
    for (var j = 0; j < 8; j++) {
      var b = j * Math.PI / 4;
      var bx = Math.sin(b) * R, by = Math.cos(b) * R;
      var cab = box(1.0, 0.9, 0.9, cabinColors[j % cabinColors.length]);
      cab.position.set(bx, by - 0.55, 0.55);
      wheel.add(cab);
      H.wheelCabins.push(cab);
      var cabTop = box(1.1, 0.1, 1.0, '#4a4a55');
      cabTop.position.set(bx, by - 0.08, 0.55);
      wheel.add(cabTop);
      var light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lightMats[j % 3]);
      light.position.set(bx, by + 0.1, 0.55);
      wheel.add(light);
    }
    g.add(wheel);
    H.wheel = wheel;
    scene.add(g);
    return g;
  }

  // ---------- 神社 ----------
  function shrine(x, z) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    g.rotation.y = -0.88;
    var plat = box(6.4, 3.4, 6.4, '#b7b2a7');
    plat.position.y = -0.8;
    g.add(plat);
    var steps = box(3.4, 0.45, 0.9, '#cfc8bb');
    steps.position.set(0, 0.22, 3.65);
    g.add(steps);
    var wall = box(4.6, 2.5, 3.6, '#c9564e');
    wall.position.y = 0.9 + 1.25;
    g.add(wall);
    var trim = box(4.8, 0.3, 3.8, '#f5f1e8');
    trim.position.y = 3.55;
    g.add(trim);
    var roof = gableRoof(5.8, 2.1, 5.0, '#3a3f4a');
    roof.position.y = 3.7;
    g.add(roof);
    var ridge = box(0.18, 0.24, 5.2, '#e8c66a', { metalness: 0.5, roughness: 0.35 });
    ridge.position.y = 5.95;
    g.add(ridge);
    var door = box(1.5, 2.0, 0.12, '#5a3a2c');
    door.position.set(0, 1.9, 1.86);
    g.add(door);
    // 神龛内暖光
    var inner = sph(0.7, '#ffe3a0', { emissive: 0xffc46b, emissiveIntensity: 0 });
    inner.scale.set(1, 0.6, 0.3);
    inner.position.set(0, 2.0, 1.5);
    g.add(inner);
    H.winMats.push(inner.material);
    // 御币/装饰
    var rope = box(2.2, 0.16, 0.16, '#e8d9a8');
    rope.position.set(0, 3.0, 1.95);
    g.add(rope);
    var tassel = box(0.16, 0.6, 0.16, '#f5f1e8');
    tassel.position.set(0, 2.62, 1.95);
    g.add(tassel);
    // 赛钱箱（奉纳箱）
    var offering = box(1.4, 0.55, 0.8, '#8a5a3b');
    offering.position.set(0, 1.18, 2.55);
    g.add(offering);
    var slot = box(1.1, 0.08, 0.12, '#3a2c20');
    slot.position.set(0, 1.5, 2.4);
    g.add(slot);
    var offRoof = gableRoof(1.7, 0.35, 1.05, '#3a3f4a');
    offRoof.position.set(0, 1.5, 2.55);
    g.add(offRoof);
    scene.add(g);
    return g;
  }

  // ---------- 鸟居 ----------
  function torii(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    g.rotation.y = ry;
    var pillarGeo = new THREE.CylinderGeometry(0.22, 0.28, 3.4, 10);
    var p1 = new THREE.Mesh(pillarGeo, H.mat('#c9403a'));
    p1.castShadow = true; p1.position.set(-1.5, 1.7, 0);
    g.add(p1);
    var p2 = new THREE.Mesh(pillarGeo, H.mat('#c9403a'));
    p2.castShadow = true; p2.position.set(1.5, 1.7, 0);
    g.add(p2);
    var top = box(4.3, 0.35, 0.4, '#c9403a');
    top.position.set(0, 3.55, 0);
    top.rotation.z = 0.03;
    g.add(top);
    var mid = box(3.5, 0.26, 0.32, '#c9403a');
    mid.position.set(0, 2.65, 0);
    g.add(mid);
    var plate = box(0.5, 0.5, 0.2, '#5a3a2c');
    plate.position.set(0, 3.35, 0);
    g.add(plate);
    scene.add(g);
    return g;
  }

  // ---------- 石灯笼 ----------
  function stoneLantern(x, z) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    var base = cyl(0.42, 0.5, 0.3, '#9a968c', 8);
    base.position.y = 0.15;
    g.add(base);
    var pillar = cyl(0.14, 0.18, 0.9, '#9a968c', 8);
    pillar.position.y = 0.75;
    g.add(pillar);
    var boxPart = box(0.5, 0.4, 0.5, '#9a968c');
    boxPart.position.y = 1.4;
    g.add(boxPart);
    var light = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.24), H.lanternGlowMat);
    light.position.set(0, 1.4, 0.26);
    g.add(light);
    var cap = cone(0.55, 0.35, '#8b877c', 4);
    cap.position.y = 1.78;
    g.add(cap);
    scene.add(g);
    return g;
  }

  // ---------- 城堡（两层天守：下层宽檐四坡顶，上层从屋顶中央升起） ----------
  function castle(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    g.rotation.y = ry;
    // 斜面石裙座 + 石板平台（向下加深贴合山坡）
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 8.4, 3.2, 4), H.mat('#9a958f'));
    skirt.rotation.y = Math.PI / 4;
    skirt.position.y = -0.9;
    skirt.castShadow = true;
    g.add(skirt);
    var plat = box(11, 1.1, 11, '#a5a0a0');
    plat.position.y = 0.55;
    g.add(plat);
    // ---- 底层（一层）----
    var tier1 = box(7.2, 3.1, 7.2, '#f2ede4');
    tier1.position.y = 1.1 + 1.55;
    g.add(tier1);
    // 底层宽檐四坡顶（浅而宽，檐口出挑）
    var eaveTrim1 = box(8.1, 0.22, 8.1, '#e8dfc8');
    eaveTrim1.position.y = 4.2;
    g.add(eaveTrim1);
    var roof1 = cone(6.0, 1.7, '#4f7d8a', 4);
    roof1.rotation.y = Math.PI / 4;
    roof1.position.y = 4.2 + 0.85;
    g.add(roof1);
    // ---- 上层塔楼：底边下沉嵌入屋面（屋面从墙身四周露出，浑然一体）----
    var tier2 = box(4.3, 2.6, 4.3, '#f2ede4');
    tier2.position.y = 4.9 + 1.3;
    g.add(tier2);
    var eaveTrim2 = box(5.0, 0.2, 5.0, '#e8dfc8');
    eaveTrim2.position.y = 7.5;
    g.add(eaveTrim2);
    var roof2 = cone(3.8, 1.7, '#4f7d8a', 4);
    roof2.rotation.y = Math.PI / 4;
    roof2.position.y = 7.5 + 0.85;
    g.add(roof2);
    // 顶层屋脊金饰与天守台
    var crown = box(1.7, 0.4, 1.7, '#e8c66a', { metalness: 0.5, roughness: 0.3 });
    crown.position.y = 9.2 + 0.2;
    g.add(crown);
    var goldTip = sph(0.16, '#e8c66a', { metalness: 0.7, roughness: 0.2 });
    goldTip.position.y = 9.75;
    g.add(goldTip);
    // ---- 角楼（立于平台四角，各有伞顶金球）----
    var corners = [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]];
    for (var i = 0; i < 4; i++) {
      var t = cyl(0.72, 0.85, 2.7, '#f2ede4', 10);
      t.position.set(corners[i][0], 1.1 + 1.35, corners[i][1]);
      g.add(t);
      var cap = cone(1.0, 1.3, '#4f7d8a', 4);
      cap.position.set(corners[i][0], 1.1 + 2.7 + 0.65, corners[i][1]);
      g.add(cap);
      var tip = sph(0.12, '#e8c66a', { metalness: 0.7, roughness: 0.2 });
      tip.position.set(corners[i][0], 1.1 + 2.7 + 1.32, corners[i][1]);
      g.add(tip);
    }
    // ---- 窗（深色窗缝 + 白框）----
    addWin(g, -1.7, 2.7, 3.5, 0, winCool);
    addWin(g, 1.7, 2.7, 3.5, 0, winCool);
    addWin(g, 0, 3.6, 3.5, 0, winWarm);
    addWin(g, -3.5, 2.7, 0, -Math.PI / 2, winWarm2);
    addWin(g, 3.5, 2.7, 0, Math.PI / 2, winCool);
    addWin(g, -1.1, 7.6, 2.2, 0, winWarm);
    addWin(g, 1.1, 7.6, 2.2, 0, winCool);
    // ---- 金饰大门 ----
    var door = box(1.7, 2.3, 0.14, '#6b4a3a');
    door.position.set(0, 1.1 + 1.15, 3.5);
    g.add(door);
    var doorTrim = box(2.0, 0.18, 0.16, '#e8c66a', { metalness: 0.5, roughness: 0.35 });
    doorTrim.position.set(0, 1.1 + 2.35, 3.5);
    g.add(doorTrim);
    // ---- 前墙 + 垛口 + 城门楼 ----
    var wallL = box(4.8, 2.6, 0.8, '#a5a0a0');
    wallL.position.set(-5.4, 0.3, 5.4);
    g.add(wallL);
    var wallR = box(4.8, 2.6, 0.8, '#a5a0a0');
    wallR.position.set(5.4, 0.3, 5.4);
    g.add(wallR);
    for (var wI = -1; wI <= 1; wI++) {
      var merlonL = box(0.5, 0.4, 0.5, '#8f8a84');
      merlonL.position.set(-5.4 + wI * 1.5, 1.75, 5.4);
      g.add(merlonL);
      var merlonR = box(0.5, 0.4, 0.5, '#8f8a84');
      merlonR.position.set(5.4 + wI * 1.5, 1.75, 5.4);
      g.add(merlonR);
    }
    var gateTop = box(3.6, 0.9, 1.0, '#a5a0a0');
    gateTop.position.set(0, 1.9, 5.4);
    g.add(gateTop);
    var gateRoof = gableRoof(4.0, 0.9, 1.3, '#4f7d8a');
    gateRoof.position.set(0, 2.3, 5.4);
    g.add(gateRoof);
    var gateDoor = box(2.7, 1.5, 0.1, '#6b4a3a');
    gateDoor.position.set(0, 0.75, 5.4);
    g.add(gateDoor);
    var gateTrim = box(2.9, 0.14, 0.12, '#e8c66a', { metalness: 0.5, roughness: 0.35 });
    gateTrim.position.set(0, 1.5, 5.4);
    g.add(gateTrim);
    // ---- 天守旗 ----
    var pole = cyl(0.06, 0.06, 2.2, '#4a4a55', 6);
    pole.position.y = 9.6 + 1.0;
    g.add(pole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.85), new THREE.MeshStandardMaterial({ color: 0xc9403a, side: THREE.DoubleSide }));
    flag.position.set(0.72, 9.6 + 1.85, 0);
    flag.castShadow = true;
    g.add(flag);
    H.flags.push({ mesh: flag, phase: 0 });
    H.addShadowDisc(scene, x, z, 6.4, 0.4);
    scene.add(g);
    return g;
  }

  // ---------- 五重塔 ----------
  function pagoda(x, z) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    g.rotation.y = -0.4;
    var plat = box(4.2, 0.7, 4.2, '#b7b2a7');
    plat.position.y = 0.35;
    g.add(plat);
    var bodyCols = ['#f2ede4', '#f6efe2', '#f2ede4', '#f6efe2', '#e8dcc6'];
    var roofCol = '#4f7d8a';
    var y = 0.7;
    var bw = 3.0;
    for (var i = 0; i < 5; i++) {
      var body = box(bw, 0.9, bw, bodyCols[i]);
      body.position.y = y + 0.45;
      g.add(body);
      addWin(g, 0, y + 0.5, bw / 2 + 0.02, 0, winWarm);
      var roof = cone(bw * 1.25, 0.7, roofCol, 4);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = y + 0.9 + 0.35;
      g.add(roof);
      y += 1.25;
      bw -= 0.32;
    }
    var spire = cyl(0.09, 0.14, 1.5, '#e8c66a', 8, { metalness: 0.5, roughness: 0.3 });
    spire.position.y = y + 0.55;
    g.add(spire);
    var tip = sph(0.18, '#e8c66a', { metalness: 0.7, roughness: 0.2 });
    tip.position.y = y + 1.35;
    g.add(tip);
    H.addShadowDisc(scene, x, z, 3.0, 0.4);
    scene.add(g);
    return g;
  }

  // ---------- 喷泉 ----------
  function fountain(x, z) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    var basin = cyl(2.4, 2.6, 0.8, '#b7b2a7', 24);
    basin.position.y = 0.4;
    g.add(basin);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.16, 8, 32), H.mat('#cfc8bb'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.8;
    g.add(rim);
    var water = new THREE.Mesh(new THREE.CircleGeometry(2.25, 24),
      new THREE.MeshStandardMaterial({ color: 0x6fc0dc, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.75;
    g.add(water);
    var pillar = cyl(0.32, 0.45, 1.4, '#b7b2a7', 12);
    pillar.position.y = 1.4;
    g.add(pillar);
    var bowl = cyl(0.95, 0.4, 0.35, '#cfc8bb', 14);
    bowl.position.y = 2.2;
    g.add(bowl);
    var bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16),
      new THREE.MeshStandardMaterial({ color: 0x7fd4f0, transparent: true, opacity: 0.85, roughness: 0.1 }));
    bowlWater.rotation.x = -Math.PI / 2;
    bowlWater.position.y = 2.4;
    g.add(bowlWater);
    // 水柱粒子
    var N = 40;
    var pos = new Float32Array(N * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xdff4ff, size: 0.24, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    g.add(points);
    // center 使用喷泉组局部坐标（Points 是组子节点）
    H.fountain = { points: points, count: N, center: new THREE.Vector3(0, 0.8, 0) };
    scene.add(g);
    return g;
  }

  // ---------- 木箱 / 木桶 ----------
  function crate(x, z, s) {
    s = s || 0.6;
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    var c = box(s, s, s, '#a08059');
    c.position.y = s / 2;
    g.add(c);
    var e1 = box(s + 0.05, s * 0.16, s + 0.05, '#6b4a3a');
    e1.position.y = s * 0.5;
    g.add(e1);
    var e2 = box(s + 0.05, s * 0.16, s + 0.05, '#6b4a3a');
    e2.position.y = s * 0.16;
    g.add(e2);
    scene.add(g);
    H.addShadowDisc(scene, x, z, s * 0.95, 0.3);
  }
  function barrel(x, z) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    var b = cyl(0.3, 0.35, 0.8, '#8a5a3b', 10);
    b.position.y = 0.4;
    g.add(b);
    var r1 = cyl(0.33, 0.35, 0.08, '#4a4a55', 10);
    r1.position.y = 0.22;
    g.add(r1);
    var r2 = cyl(0.33, 0.35, 0.08, '#4a4a55', 10);
    r2.position.y = 0.6;
    g.add(r2);
    scene.add(g);
    H.addShadowDisc(scene, x, z, 0.62, 0.3);
  }

  // ---------- 长椅 / 路灯 / 码头 / 小船 ----------
  function bench(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    g.rotation.y = ry;
    var seat = box(1.7, 0.12, 0.5, '#8a5a3b');
    seat.position.y = 0.46;
    g.add(seat);
    var back = box(1.7, 0.4, 0.1, '#8a5a3b');
    back.position.set(0, 0.82, -0.2);
    back.rotation.x = 0.15;
    g.add(back);
    var l1 = box(0.1, 0.46, 0.44, '#4a4a55');
    l1.position.set(-0.7, 0.23, 0);
    g.add(l1);
    var l2 = box(0.1, 0.46, 0.44, '#4a4a55');
    l2.position.set(0.7, 0.23, 0);
    g.add(l2);
    scene.add(g);
    H.addShadowDisc(scene, x, z, 1.15, 0.3);
    return g;
  }

  function lamp(x, z, withLight) {
    var g = new THREE.Group();
    var y0 = H.groundHeight(x, z);
    g.position.set(x, y0, z);
    var basePlate = cyl(0.2, 0.27, 0.16, '#3a3f4a', 8);
    basePlate.position.y = 0.08;
    g.add(basePlate);
    var pole = cyl(0.07, 0.1, 2.9, '#3a3f4a', 8);
    pole.position.y = 1.45;
    g.add(pole);
    var arm = box(0.06, 0.06, 0.7, '#3a3f4a');
    arm.position.set(0, 2.86, 0.3);
    g.add(arm);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), H.lampBulbMat);
    bulb.position.set(0, 2.8, 0.62);
    g.add(bulb);
    var cap = cone(0.3, 0.24, '#3a3f4a', 8);
    cap.position.set(0, 3.05, 0.62);
    g.add(cap);
    // 灯光光晕（夜晚可见）
    var glowSpr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: H.glowTexture('rgba(255,233,160,0.9)', 'rgba(255,210,120,0.35)'),
      transparent: true, opacity: 0, depthWrite: false
    }));
    glowSpr.position.set(0, 2.8, 0.62);
    glowSpr.scale.set(2.8, 2.8, 1);
    g.add(glowSpr);
    H.lampGlows.push(glowSpr.material);
    if (withLight) {
      var pl = new THREE.PointLight(0xffd9a0, 0, 13, 2);
      pl.position.set(0, 2.75, 0.62);
      g.add(pl);
      H.lampLights.push(pl);
    }
    scene.add(g);
    return g;
  }

  function dock(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0.12, z);
    g.rotation.y = ry;
    var deck = box(9, 0.3, 3, '#9a7a56');
    deck.position.y = 0;
    g.add(deck);
    var plank = box(9.2, 0.05, 0.18, '#7a5a3e');
    plank.position.y = 0.18;
    g.add(plank);
    for (var i = -4; i <= 4; i += 2) {
      var post = cyl(0.14, 0.14, 2.4, '#6b4a3a', 8);
      post.position.set(i, -0.6, 1.5);
      g.add(post);
    }
    // 系船柱
    var bollard = cyl(0.12, 0.15, 0.5, '#4a4a55', 8);
    bollard.position.set(3.5, 0.3, 1.4);
    g.add(bollard);
    scene.add(g);
    return g;
  }

  function mooredBoat(x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, H.WATER_Y + 0.02, z);
    g.rotation.y = ry;
    var hull = box(2.6, 0.5, 1.1, '#f5f1e8');
    hull.position.y = 0.15;
    g.add(hull);
    var bow = cone(0.9, 1.0, '#c9564e', 4);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.15, 1.6);
    g.add(bow);
    var rim = box(2.7, 0.12, 1.2, '#c9564e');
    rim.position.y = 0.42;
    g.add(rim);
    var mast = cyl(0.06, 0.06, 1.8, '#7a5a3e', 6);
    mast.position.y = 1.2;
    g.add(mast);
    var sail = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1), new THREE.MeshStandardMaterial({ color: 0xf6efe2, side: THREE.DoubleSide }));
    sail.position.set(0, 1.6, 0.1);
    g.add(sail);
    scene.add(g);
    return g;
  }

  // ---------- 石路 ----------
  function road(points, width) {
    width = width || 2.6;
    var n = points.length;
    var pos = [];
    for (var i = 0; i < n - 1; i++) {
      var ax = points[i][0], az = points[i][1];
      var bx = points[i + 1][0], bz = points[i + 1][1];
      var segLen = Math.hypot(bx - ax, bz - az);
      var steps = Math.max(1, Math.ceil(segLen / 1.1));
      for (var s = 0; s < steps; s++) {
        var f0 = s / steps, f1 = (s + 1) / steps;
        var mx = H.lerp(ax, bx, (f0 + f1) / 2), mz = H.lerp(az, bz, (f0 + f1) / 2);
        var nx = H.lerp(ax, bx, f1), nz = H.lerp(az, bz, f1);
        var my = H.groundHeight(mx, mz);
        var m = box(width, 0.22, segLen / steps + 0.12, '#8f8a80');
        m.position.set(mx, my + 0.1, mz);
        m.lookAt(nx, H.groundHeight(nx, nz) + 0.1, nz);
        scene.add(m);
      }
    }
  }

  function stairs(x0, z0, x1, z1, n, width) {
    var y0 = H.groundHeight(x0, z0), y1 = H.groundHeight(x1, z1);
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n;
      var x = H.lerp(x0, x1, f), z = H.lerp(z0, z1, f);
      var y = H.lerp(y0, y1, f);
      var st = box(width || 3.0, 0.3, 0.6, '#b7b2a7');
      st.position.set(x, y + 0.1, z);
      st.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      scene.add(st);
    }
  }

  // ---------- 木栅栏 ----------
  function fence(x0, z0, x1, z1, n) {
    n = n || Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0)));
    var i, x, z, y, nx, nz, mx, mz, my, len;
    for (i = 0; i <= n; i++) {
      var f = i / n;
      x = H.lerp(x0, x1, f); z = H.lerp(z0, z1, f);
      y = H.groundHeight(x, z);
      var post = box(0.12, 1.0, 0.12, '#8a5a3b');
      post.position.set(x, y + 0.5, z);
      scene.add(post);
      if (i < n) {
        nx = H.lerp(x0, x1, (i + 1) / n); nz = H.lerp(z0, z1, (i + 1) / n);
        mx = (x + nx) / 2; mz = (z + nz) / 2;
        my = (y + H.groundHeight(nx, nz)) / 2;
        len = Math.hypot(nx - x, nz - z);
        var rail = box(0.07, 0.07, len + 0.08, '#7a5a3e');
        rail.position.set(mx, my + 0.84, mz);
        rail.lookAt(nx, H.groundHeight(nx, nz) + 0.84, nz);
        scene.add(rail);
        var rail2 = box(0.07, 0.07, len + 0.08, '#7a5a3e');
        rail2.position.set(mx, my + 0.45, mz);
        rail2.lookAt(nx, H.groundHeight(nx, nz) + 0.45, nz);
        scene.add(rail2);
      }
    }
  }

  // ---------- 树木 ----------
  function tree(x, z, type, s) {
    s = s || H.rand(0.85, 1.25);
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    var trunkH = H.rand(1.2, 2.0) * s;
    var trunk = cyl(0.12 * s, 0.18 * s, trunkH, '#6b4a3a', 7);
    trunk.position.y = trunkH / 2;
    g.add(trunk);
    if (type === 'pine') {
      var c1 = cone(1.25 * s, 1.6 * s, '#3f7a4a', 8);
      c1.position.y = trunkH + 0.7 * s;
      g.add(c1);
      var c2 = cone(0.95 * s, 1.4 * s, '#46885a', 8);
      c2.position.y = trunkH + 1.7 * s;
      g.add(c2);
      var c3 = cone(0.6 * s, 1.1 * s, '#3f7a4a', 8);
      c3.position.y = trunkH + 2.6 * s;
      g.add(c3);
    } else if (type === 'cherry') {
      var canopy = new THREE.Group();
      var cols = ['#f4b8d0', '#f8cede', '#f0a8c4'];
      var offs = [[0, 0, 0, 1.15], [0.7, -0.25, 0.3, 0.85], [-0.65, -0.2, -0.25, 0.8], [0.1, 0.55, -0.35, 0.75]];
      for (var i = 0; i < offs.length; i++) {
        var sp = sph(offs[i][3] * s, cols[i % 3]);
        sp.position.set(offs[i][0] * s, trunkH + 1.1 * s + offs[i][1] * s, offs[i][2] * s);
        canopy.add(sp);
      }
      g.add(canopy);
    } else {
      var canopy2 = new THREE.Group();
      var cols2 = ['#6fae5a', '#5e9e4e', '#7fbe68'];
      var offs2 = [[0, 0, 0, 1.1], [0.65, -0.3, 0.3, 0.8], [-0.6, -0.25, -0.2, 0.75], [0.05, 0.5, -0.3, 0.7]];
      for (var j = 0; j < offs2.length; j++) {
        var sp2 = sph(offs2[j][3] * s, cols2[j % 3]);
        sp2.position.set(offs2[j][0] * s, trunkH + 1.0 * s + offs2[j][1] * s, offs2[j][2] * s);
        canopy2.add(sp2);
      }
      g.add(canopy2);
    }
    scene.add(g);
    H.addShadowDisc(scene, x, z, 1.6 * s, 0.32);
    H.swayTrees.push({ g: g, ph: H.rng() * 6.28, amp: H.rand(0.008, 0.02) });
    return g;
  }

  // ---------- 花与岩石（实例化） ----------
  function flowersAndRocks() {
    var flowerSpots = [];
    var i, a, r, x, z;
    // 喷泉公园 / 广场周边
    for (i = 0; i < 90; i++) {
      a = H.rng() * Math.PI * 2; r = H.rand(8.2, 13);
      flowerSpots.push([Math.cos(a) * r, Math.sin(a) * r * 0.9]);
    }
    // 神社坡道
    for (i = 0; i < 60; i++) { flowerSpots.push([H.rand(18, 32), H.rand(-22, -6)]); }
    // 城堡山坡
    for (i = 0; i < 50; i++) { flowerSpots.push([H.rand(-34, -18), H.rand(8, 26)]); }
    // 湖岸 / 瀑布旁
    for (i = 0; i < 40; i++) { flowerSpots.push([H.rand(2, 16), H.rand(18, 34)]); }
    // 港口岬角
    for (i = 0; i < 30; i++) { flowerSpots.push([H.rand(14, 30), H.rand(30, 48)]); }
    // 随机草地
    for (i = 0; i < 140; i++) {
      a = H.rng() * Math.PI * 2; r = H.rand(8, 42);
      flowerSpots.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    var spots = [];
    for (i = 0; i < flowerSpots.length; i++) {
      x = flowerSpots[i][0]; z = flowerSpots[i][1];
      var y = H.groundHeight(x, z);
      if (y < 1.2 || y > 13) continue;
      var sl = Math.abs(H.groundHeight(x + 0.6, z) - y) + Math.abs(H.groundHeight(x, z + 0.6) - y);
      if (sl > 1.6) continue;
      // 避开广场
      if (Math.hypot(x, z) < 7.6) continue;
      spots.push([x, y, z]);
    }
    var N = spots.length;
    var stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.36, 5);
    var headGeo = new THREE.SphereGeometry(0.12, 7, 6);
    var stems = new THREE.InstancedMesh(stemGeo, H.mat('#4c7a3a'), N);
    var heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N);
    var dummy = new THREE.Object3D();
    var palette = [0xe78ab8, 0xf5d76e, 0xffffff, 0xe2685f, 0xb892e0, 0xf0a8c4];
    for (i = 0; i < N; i++) {
      dummy.position.set(spots[i][0], spots[i][1] + 0.18, spots[i][2]);
      dummy.rotation.set(0, H.rng() * 6.28, H.rng() * 0.2 - 0.1);
      dummy.scale.setScalar(H.rand(0.7, 1.4));
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      dummy.position.y = spots[i][1] + 0.42;
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      heads.setColorAt(i, new THREE.Color(palette[Math.floor(H.rng() * palette.length)]));
    }
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    scene.add(stems); scene.add(heads);

    // 草丛（给草地增加层次感）
    var grassGeo = new THREE.ConeGeometry(0.09, 0.42, 5);
    var grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), N);
    for (i = 0; i < N; i++) {
      dummy.position.set(
        spots[i][0] + H.rand(-0.7, 0.7),
        spots[i][1] + 0.2,
        spots[i][2] + H.rand(-0.7, 0.7)
      );
      dummy.rotation.set(H.rand(-0.16, 0.16), H.rng() * 6.28, H.rand(-0.16, 0.16));
      dummy.scale.set(H.rand(0.8, 1.6), H.rand(0.9, 2.1), H.rand(0.8, 1.6));
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      var gc = new THREE.Color().setHSL(0.28 + H.rng() * 0.06, 0.45, 0.3 + H.rng() * 0.14);
      grass.setColorAt(i, gc);
    }
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    scene.add(grass);

    // 岩石
    var rocks = [];
    for (i = 0; i < 260; i++) {
      a = H.rng() * Math.PI * 2; r = H.rand(14, 56);
      x = Math.cos(a) * r; z = Math.sin(a) * r;
      var ry = H.groundHeight(x, z);
      if (ry < -1.5) continue;
      var slr = Math.abs(H.groundHeight(x + 0.8, z) - ry) + Math.abs(H.groundHeight(x, z + 0.8) - ry);
      if (slr > 3.2) continue;
      if (ry < 1.2 || slr > 0.9 || H.rng() < 0.35) rocks.push([x, ry, z]);
    }
    var RN = rocks.length;
    var rockGeo = new THREE.DodecahedronGeometry(1, 0);
    var rockMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), RN);
    for (i = 0; i < RN; i++) {
      dummy.position.set(rocks[i][0], rocks[i][1] + 0.15, rocks[i][2]);
      dummy.rotation.set(H.rng() * 3, H.rng() * 3, H.rng() * 3);
      dummy.scale.set(H.rand(0.4, 1.6), H.rand(0.3, 1.1), H.rand(0.4, 1.6));
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      var shade = 0.45 + H.rng() * 0.3;
      rockMesh.setColorAt(i, new THREE.Color(shade, shade * 0.98, shade * 1.02));
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
    rockMesh.castShadow = true; rockMesh.receiveShadow = true;
    scene.add(rockMesh);
  }

  // ---------- 灌木 ----------
  function bush(x, z, s) {
    s = s || 1;
    var g = new THREE.Group();
    g.position.set(x, H.groundHeight(x, z), z);
    var b1 = sph(0.5 * s, '#4c7a3a');
    b1.scale.y = 0.75;
    b1.position.y = 0.35 * s;
    g.add(b1);
    var b2 = sph(0.38 * s, '#5e9e4e');
    b2.scale.y = 0.7;
    b2.position.set(0.4 * s, 0.3 * s, 0.15 * s);
    g.add(b2);
    scene.add(g);
    H.addShadowDisc(scene, x, z, 0.8 * s, 0.3);
    H.swayTrees.push({ g: g, ph: H.rng() * 6.28, amp: H.rand(0.01, 0.02) });
    return g;
  }

  // ---------- 布局 ----------
  H.buildTown = function (sceneRef) {
    scene = sceneRef;

    // 广场地面
    var plaza = new THREE.Mesh(new THREE.CircleGeometry(7.6, 48), H.mat('#b9b4a9'));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, H.groundHeight(0, 0) + 0.06, 0);
    plaza.receiveShadow = true;
    scene.add(plaza);
    var plazaInner = new THREE.Mesh(new THREE.CircleGeometry(5.6, 40), H.mat('#aaa599'));
    plazaInner.rotation.x = -Math.PI / 2;
    plazaInner.position.set(0, H.groundHeight(0, 0) + 0.08, 0);
    plazaInner.receiveShadow = true;
    scene.add(plazaInner);

    // 喷泉 / 长椅
    fountain(0, 0);
    bench(4.6, 1.8, Math.PI * 0.75);
    bench(-4.6, 1.8, -Math.PI * 0.75);
    bench(4.6, -1.8, Math.PI * 0.25);
    bench(-4.6, -1.8, -Math.PI * 0.25);

    // ---- 民居：沿街两侧整齐排列，门朝向街道（不再压路） ----
    // 东街北侧（面朝南）
    house(11, -5.2, 0, { w: 3.2, roof: '#c96f4a' });
    house(15, -5.2, 0, { w: 2.9, roof: '#5b7080' });
    // 东街南侧（面朝北）
    house(11, 5.2, Math.PI, { w: 3.3, roof: '#4f8a8b' });
    house(15, 5.2, Math.PI, { w: 3.0, roof: '#a5624a' });
    house(19, 5.2, Math.PI, { w: 3.4, roof: '#c96f4a' });
    // 西街北侧（面朝南）
    house(-11, -5.2, 0, { w: 3.1, roof: '#a5624a' });
    house(-15, -5.2, 0, { w: 2.8, roof: '#6b4a3a' });
    house(-19, -5.2, 0, { w: 3.3, roof: '#c96f4a' });
    // 西街南侧（面朝北）
    house(-11, 5.2, Math.PI, { w: 3.2, roof: '#5b7080' });
    house(-15, 5.2, Math.PI, { w: 3.4, roof: '#4f8a8b' });
    house(-19, 5.2, Math.PI, { w: 2.9, roof: '#a5624a' });
    // 南街（面朝北）
    house(-6, 14.5, Math.PI, { w: 3.0, roof: '#5b7080' });
    house(-2, 15, Math.PI, { w: 3.2, roof: '#4f8a8b' });
    // 山坡小屋（风车脚下，门朝道路）
    house(10.5, -20, 1.21, { w: 2.7, roof: '#a5624a' });
    // 港口仓库（岬角，门朝海港路）
    house(21, 29, -0.98, { w: 3.4, roof: '#6b4a3a', wall: '#f2e7d3' });

    // ---- 店铺：面向商业街 ----
    shop(-5, -14.5, 0, '茶屋', '#dbe7f2', '#5b7080');
    shop(0, -15.5, 0, '花屋', '#f7d9c4', '#c96f4a');
    shop(5, -14.5, 0, '面包房', '#f3efe4', '#4f8a8b');

    // 钟楼（东北街区，面向小镇）
    clockTower(13, -9, -0.5);

    // ---- 神社（东丘）与鸟居、石灯笼 ----
    shrine(28, -16);
    torii(22.3, -7.5, 2.74);
    stoneLantern(21.6, -9.0);
    stoneLantern(23.9, -8.4);
    stoneLantern(26.2, -17.5);
    stoneLantern(28.5, -18.5);

    // 城堡（西丘，城门正对小镇方向）
    castle(-27, 19, 2.2);

    // 风车（东北林丘）
    windmill(16, -21);

    // 摩天轮（西南公园）
    ferrisWheel(-17, 10, 0.35);

    // 灯塔（东南海角）
    lighthouse(43, 9);

    // 五重塔（神社丘陵东侧，面朝大海）
    pagoda(35, -17);

    // ---- 港口与船只 ----
    dock(26.5, 52.5, 0.55);
    mooredBoat(32, 57, 1.2);
    mooredBoat(34, 55, 2.2);
    crate(22.6, 28.5, 0.7);
    crate(20, 27.8, 0.5);
    barrel(22.4, 30.2);
    crate(1.6, -13.3, 0.55);
    barrel(2.4, -13.6);

    // ---- 道路：十字主街 + 放射状通往各区 ----
    road([[6.5, 0], [11, 0], [15, 0], [19, 0]], 2.6);                      // 东街（连广场）
    road([[-6.5, 0], [-11, 0], [-15, 0], [-19, 0]], 2.6);                    // 西街（连广场）
    road([[0, -7.5], [0, -11]], 2.4);                                        // 广场→商业街联络路
    road([[0, 7.5], [0, 11]], 2.4);                                          // 广场→南街联络路
    road([[-8, -11], [0, -11], [8, -11]], 2.4);                              // 商业街
    road([[-8, 11], [0, 11], [8, 11]], 2.4);                                 // 南街
    road([[19, 0], [20.5, -3.5], [22, -7], [23.5, -10.5], [25, -13]], 2.4);  // 神社参道
    road([[-8, 11], [-12, 12.5], [-16, 14], [-20, 15.5], [-23, 16.8]], 2.4); // 城堡道
    road([[0, 11], [4, 15], [8, 20], [12, 25], [16, 30], [19, 35], [21, 40], [22.5, 45], [23.5, 48]], 2.8); // 海港道
    road([[8, -11], [10.5, -14], [13, -17], [14.5, -18.5]], 2.2);            // 风车道
    road([[19, 0], [21.5, 1], [24, 2], [27.5, 3], [31, 4.5], [35, 6], [39, 7.5]], 2.2); // 灯塔道
    stairs(25, -13, 27.5, -15.5, 10, 3.0);
    stairs(-23, 16.8, -25.5, 18.2, 8, 3.0);

    // ---- 路灯（沿街布置，不占路面） ----
    lamp(4.6, 4.6, true);
    lamp(-4.6, 4.6, true);
    lamp(4.6, -4.6, true);
    lamp(-4.6, -4.6, true);
    lamp(9.8, 2.8, true);
    lamp(-9.8, 2.8, true);
    lamp(9.8, -2.8, true);
    lamp(-9.8, -2.8, true);
    lamp(2.2, -9.2, true);
    lamp(2.2, 9.2, true);
    lamp(15.5, 26.5, true);
    lamp(21.5, 37.5, true);

    // 木栅栏（码头栈道边 / 灯塔观景台边）
    fence(21.5, 45.5, 23.0, 48.5, 4);
    fence(34.5, 8.2, 39.2, 9.0, 6);

    // ---- 树木（樱花/松树/阔叶 + 海岸新植） ----
    var i, a, r;
    for (i = 0; i < 7; i++) {
      a = H.rng() * Math.PI * 2; r = H.rand(6, 9);
      tree(28 + Math.cos(a) * r, -16 + Math.sin(a) * r, 'cherry', H.rand(0.9, 1.2));
    }
    for (i = 0; i < 7; i++) {
      a = H.rng() * Math.PI * 2; r = H.rand(6, 10);
      tree(-27 + Math.cos(a) * r, 19 + Math.sin(a) * r, 'pine', H.rand(0.9, 1.3));
    }
    for (i = 0; i < 6; i++) {
      a = H.rng() * Math.PI * 2; r = H.rand(4, 9);
      tree(16 + Math.cos(a) * r, -24 + Math.sin(a) * r, H.pick(['pine', 'leaf']), H.rand(0.85, 1.25));
    }
    for (i = 0; i < 4; i++) {
      a = H.rng() * Math.PI * 2; r = H.rand(4.5, 7);
      tree(-17 + Math.cos(a) * r, 10 + Math.sin(a) * r, 'leaf', H.rand(0.85, 1.15));
    }
    var ringSpots = [[-24, -4], [-21, -12], [-13, -19], [-6, -24], [4, -25], [12, -24], [-27, 2], [24, 4], [31, -3], [35, -9], [-31, -11], [-34, 5], [30, -20], [-20, -24], [38, 16], [-38, 12], [36, -6], [33, 12], [40, 14], [26, 20], [12, 22], [2, 22], [-14, 22], [-24, 22], [-32, 14], [-34, 4], [-30, -10], [-20, -26], [10, -28], [24, -24], [36, -20], [42, -2]];
    for (i = 0; i < ringSpots.length; i++) {
      var t = H.rng() < 0.5 ? 'leaf' : 'pine';
      tree(ringSpots[i][0], ringSpots[i][1], t, H.rand(0.9, 1.35));
    }
    // ---- 灌木（房屋前院与街角） ----
    bush(11, -7.5); bush(15, -7.5); bush(-11, -7.5); bush(-15, -7.5);
    bush(11, 7.5); bush(15, 7.5); bush(-11, 7.5); bush(-15, 7.5);
    bush(0, 13.2); bush(-10, -13); bush(7, -15);
    bush(25, 40); bush(21, 41); bush(16, 35);
    bush(37, -14); bush(39, -18);

    flowersAndRocks();
  };
})();
