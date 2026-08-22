/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · vehicles.js
 * 载具：沿石路往返的彩色小车（含货车）、空中飞艇
 * 车轮转动、车身贴合坡地、夜间车灯发光
 * ============================================================ */
(function () {
  'use strict';
  var H = window.H;
  var scene = null;
  var cars = [];
  var airship = null;
  H.carLightMats = [];
  H.carTailMats = [];

  // ---------- 小车模型 ----------
  function makeCar(color, isTruck) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 3.1), H.mat(color));
    body.position.y = 0.62;
    body.castShadow = true;
    g.add(body);
    var hood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.9), H.mat(color));
    hood.position.set(0, 0.98, 1.15);
    hood.castShadow = true;
    g.add(hood);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 1.5), H.mat('#9fd8e8'));
    cabin.position.set(0, 1.12, -0.25);
    cabin.castShadow = true;
    g.add(cabin);
    if (isTruck) {
      var cargo = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.05, 1.9), H.mat('#e8dcc6'));
      cargo.position.set(0, 1.28, -0.6);
      cargo.castShadow = true;
      g.add(cargo);
      var cargoBand = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.18, 1.92), H.mat('#8a6a4a'));
      cargoBand.position.set(0, 0.85, -0.6);
      g.add(cargoBand);
    }
    // 车轮（组旋转出轴向，内圈自转）
    var wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12);
    var wheelMat = H.mat('#2a2d35', { roughness: 0.6 });
    var wheels = [];
    var offs = [[-0.72, 1.05], [0.72, 1.05], [-0.72, -1.05], [0.72, -1.05]];
    for (var i = 0; i < offs.length; i++) {
      var wg = new THREE.Group();
      wg.rotation.z = Math.PI / 2;
      var wm = new THREE.Mesh(wheelGeo, wheelMat);
      wm.castShadow = true;
      wg.add(wm);
      wg.position.set(offs[i][0], 0.3, offs[i][1]);
      g.add(wg);
      wheels.push(wm);
    }
    // 车灯 / 尾灯
    var hlMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a0, emissiveIntensity: 0.3, roughness: 0.3 });
    var tlMat = new THREE.MeshStandardMaterial({ color: 0xaa2a2a, emissive: 0xff3030, emissiveIntensity: 0.2, roughness: 0.4 });
    H.carLightMats.push(hlMat);
    H.carTailMats.push(tlMat);
    var hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), hlMat);
    hl1.position.set(-0.48, 0.66, 1.56);
    g.add(hl1);
    var hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), hlMat);
    hl2.position.set(0.48, 0.66, 1.56);
    g.add(hl2);
    var tl1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), tlMat);
    tl1.position.set(-0.48, 0.66, -1.56);
    g.add(tl1);
    var tl2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), tlMat);
    tl2.position.set(0.48, 0.66, -1.56);
    g.add(tl2);
    // 接触阴影（随车移动）
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 20),
      new THREE.MeshBasicMaterial({ map: H.shadowTexture(), transparent: true, opacity: 0.42, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.06;
    g.add(shadow);
    return { g: g, wheels: wheels };
  }

  // ---------- 飞艇 ----------
  function makeAirship() {
    var g = new THREE.Group();
    var envelope = new THREE.Mesh(new THREE.SphereGeometry(1.7, 18, 12), H.mat('#f5f1e8'));
    envelope.scale.set(1, 0.62, 2.5);
    envelope.castShadow = true;
    g.add(envelope);
    var stripe = new THREE.Mesh(new THREE.SphereGeometry(1.72, 18, 12), H.mat('#c9564e'));
    stripe.scale.set(1.01, 0.62, 2.52);
    stripe.position.y = 0;
    stripe.scale.y = 0.16;
    g.add(stripe);
    // 尾翼
    var finV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.9), H.mat('#c9564e'));
    finV.position.set(0, 0.4, -3.8);
    g.add(finV);
    var finL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.9), H.mat('#c9564e'));
    finL.position.set(-0.5, 0, -3.8);
    g.add(finL);
    var finR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.9), H.mat('#c9564e'));
    finR.position.set(0.5, 0, -3.8);
    g.add(finR);
    // 吊舱
    var gondola = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.7), H.mat('#8a5a3b'));
    gondola.position.set(0, -1.25, -0.2);
    gondola.castShadow = true;
    g.add(gondola);
    var winMat = new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd27a, emissiveIntensity: 0.3 });
    var win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.4), winMat);
    win.position.set(0, -1.1, -0.2);
    g.add(win);
    H.carLightMats.push(winMat);
    // 螺旋桨
    var prop = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 3), H.mat('#8a5a3b'));
    prop.rotation.x = Math.PI / 2;
    prop.position.set(0, 0, -4.6);
    g.add(prop);
    return { g: g, prop: prop };
  }

  // ---------- 路径工具 ----------
  function buildPath(pts) {
    var cum = [0], total = 0, i;
    for (i = 0; i < pts.length - 1; i++) {
      total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      cum.push(total);
    }
    return { pts: pts, cum: cum, total: total };
  }
  function pathPoint(path, u) {
    var d = Math.max(0, Math.min(path.total, u * path.total));
    var i = 0;
    while (i < path.cum.length - 2 && path.cum[i + 1] < d) i++;
    var seg = path.cum[i + 1] - path.cum[i];
    var f = seg > 0 ? (d - path.cum[i]) / seg : 0;
    var ax = path.pts[i][0], az = path.pts[i][1];
    var bx = path.pts[i + 1][0], bz = path.pts[i + 1][1];
    return { x: H.lerp(ax, bx, f), z: H.lerp(az, bz, f) };
  }

  // ---------- 构建 ----------
  H.buildVehicles = function (sceneRef) {
    scene = sceneRef;
    var routes = [
      { pts: [[7, 0], [11, 0], [15, 0], [19, 0], [20.5, -3.5], [22, -7], [23.5, -10.5], [25, -13]], color: 0xe2685f, speed: 6.5 },
      { pts: [[0, 11], [4, 15], [8, 20], [12, 25], [16, 30], [19, 35], [21, 40], [22.5, 45], [23.5, 48]], color: 0x5b8f8b, speed: 5.5, truck: true },
      { pts: [[-8, 11], [-12, 12.5], [-16, 14], [-20, 15.5], [-23, 16.8]], color: 0xe8c66a, speed: 5.8 },
      { pts: [[7, 0], [11, 0], [15, 0], [19, 0], [21.5, 1], [24, 2], [27.5, 3], [31, 4.5], [35, 6], [39, 7.5]], color: 0x6fa3d8, speed: 6.0 }
    ];
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      var car = makeCar(r.color, r.truck);
      var path = buildPath(r.pts);
      car.g.position.set(r.pts[0][0], H.groundHeight(r.pts[0][0], r.pts[0][1]) + 0.24, r.pts[0][1]);
      scene.add(car.g);
      cars.push({
        g: car.g, wheels: car.wheels, path: path,
        u: (i * 0.27) % 1, dir: 1, speed: r.speed,
        yaw: 0, turn: 0, targetYaw: 0, ph: i * 1.7
      });
    }
    // 飞艇
    airship = makeAirship();
    airship.g.position.set(0, 34, 0);
    scene.add(airship.g);
  };

  // ---------- 更新 ----------
  H.updateVehicles = function (dt, t) {
    var i, j;
    for (i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.turn > 0) {
        c.turn -= dt;
        c.yaw += (c.targetYaw - c.yaw) * Math.min(1, dt * 3.5);
      } else {
        c.u += c.dir * c.speed * dt / c.path.total;
        if (c.u >= 1) { c.u = 1; c.dir = -1; c.turn = 1.2; c.targetYaw = c.yaw + Math.PI; }
        if (c.u <= 0) { c.u = 0; c.dir = 1; c.turn = 1.2; c.targetYaw = c.yaw + Math.PI; }
        var p = pathPoint(c.path, c.u);
        var p2 = pathPoint(c.path, c.u + c.dir * 0.012);
        var yaw = Math.atan2(p2.x - p.x, p2.z - p.z);
        c.yaw += (yaw - c.yaw) * Math.min(1, dt * 5);
        c.g.position.set(p.x, H.groundHeight(p.x, p.z) + 0.24 + Math.sin(t * 3 + c.ph) * 0.012, p.z);
        // 车轮滚动
        var spin = c.speed * dt / 0.3;
        for (j = 0; j < c.wheels.length; j++) c.wheels[j].rotation.y += spin;
      }
      c.g.rotation.y = c.yaw;
    }
    // 车灯（夜间亮起）
    var nf = H.env ? H.env.nightF : 0;
    for (i = 0; i < H.carLightMats.length; i++) {
      H.carLightMats[i].emissiveIntensity = 0.3 + 2.2 * nf;
    }
    for (i = 0; i < H.carTailMats.length; i++) {
      H.carTailMats[i].emissiveIntensity = 0.2 + 1.6 * nf;
    }
    // 飞艇
    if (airship) {
      var ang = t * 0.025 + 1.2;
      airship.g.position.set(Math.cos(ang) * 55, 34 + Math.sin(t * 0.35) * 1.6, Math.sin(ang) * 55);
      airship.g.rotation.y = -ang - Math.PI / 2;
      airship.g.rotation.z = Math.sin(t * 0.5) * 0.05;
      airship.prop.rotation.z += dt * 6;
    }
  };
})();
