/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · dynamics.js
 * 昼夜循环（太阳/月亮/天空/雾/星光/灯光切换）与动态元素：
 * 云、飞鸟、风车、摩天轮、灯塔光束、小船、行人、炊烟、
 * 萤火虫、水灯、喷泉、烟花、旗帜、时钟指针、树木摇曳
 * ============================================================ */
(function () {
  'use strict';
  var H = window.H;
  var scene = null;

  H.updaters = []; // fn(dt, t)
  H.env = { t: 0.30, speed: 1, playing: true };
  H.state = { autoRotate: true, dynamics: true, fireworks: true };

  // 相位名（按一天时刻）
  function phaseName(t) {
    var h = t * 24;
    if (h < 4.5) return '深夜';
    if (h < 6.5) return '黎明';
    if (h < 9) return '清晨';
    if (h < 12) return '上午';
    if (h < 13.5) return '正午';
    if (h < 16.5) return '下午';
    if (h < 18.5) return '黄昏';
    if (h < 21) return '夜晚';
    return '深夜';
  }

  // ---------- 天空穹顶 ----------
  function buildSky() {
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: H.col('#3d7fd0') },
        uBottom: { value: H.col('#cfe8f5') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunGlow: { value: H.col('#fff2c4') },
        uSunAmount: { value: 0.4 },
        uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
        uMoonAmount: { value: 0 }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTop;',
        'uniform vec3 uBottom;',
        'uniform vec3 uSunDir;',
        'uniform vec3 uSunGlow;',
        'uniform float uSunAmount;',
        'uniform vec3 uMoonDir;',
        'uniform float uMoonAmount;',
        'varying vec3 vDir;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = clamp(d.y*0.5+0.5, 0.0, 1.0);',
        '  vec3 col = mix(uBottom, uTop, pow(h, 0.85));',
        '  float s = max(dot(d, uSunDir), 0.0);',
        '  col += uSunGlow * (pow(s, 350.0)*1.2 + pow(s, 24.0)*0.35) * uSunAmount;',
        '  float m = max(dot(d, uMoonDir), 0.0);',
        '  col += vec3(0.75,0.85,1.0) * (pow(m, 500.0)*0.9 + pow(m, 30.0)*0.12) * uMoonAmount;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n')
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(430, 40, 20), mat);
    scene.add(sky);
    return mat;
  }

  // ---------- 星星 ----------
  function buildStars() {
    var N = 420;
    var pos = new Float32Array(N * 3);
    var i;
    for (i = 0; i < N; i++) {
      var a = H.rng() * Math.PI * 2;
      var el = Math.asin(H.rng() * 0.92 + 0.06);
      var r = 400;
      pos[i * 3] = Math.cos(el) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(el) * r;
      pos[i * 3 + 2] = Math.cos(el) * Math.sin(a) * r;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xeaf2ff, size: 1.6, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    });
    var stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false;
    scene.add(stars);
    return stars;
  }

  // ---------- 太阳 / 月亮 ----------
  function buildSunMoon() {
    var sunGlow = H.glowTexture('rgba(255,240,200,1)', 'rgba(255,190,110,0.5)');
    var sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunGlow, transparent: true, depthWrite: false, fog: false
    }));
    sun.scale.set(52, 52, 1);
    scene.add(sun);
    var sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(7, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2c4, fog: false })
    );
    scene.add(sunCore);

    var moonGlow = H.glowTexture('rgba(220,235,255,1)', 'rgba(150,180,255,0.4)');
    var moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonGlow, transparent: true, opacity: 0, depthWrite: false, fog: false
    }));
    moon.scale.set(34, 34, 1);
    scene.add(moon);
    var moonCore = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false })
    );
    moonCore.visible = false;
    scene.add(moonCore);
    return { sun: sun, sunCore: sunCore, moon: moon, moonCore: moonCore };
  }

  // ---------- 云 ----------
  function buildClouds() {
    var cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9,
      emissive: 0x8898b0, emissiveIntensity: 0.55
    });
    H.cloudMat = cloudMat;
    var clouds = [];
    for (var i = 0; i < 10; i++) {
      var g = new THREE.Group();
      var n = 3 + Math.floor(H.rng() * 4);
      for (var j = 0; j < n; j++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(H.rand(1.8, 3.4), 12, 9), cloudMat);
        s.position.set(H.rand(-3, 3), H.rand(-0.8, 0.8), H.rand(-1.6, 1.6));
        s.scale.y = 0.5;
        g.add(s);
      }
      g.position.set(H.rand(-70, 70), H.rand(42, 58), H.rand(-70, 70));
      g.userData.speed = H.rand(0.5, 1.4);
      scene.add(g);
      clouds.push(g);
    }
    return clouds;
  }

  // ---------- 飞鸟 ----------
  function buildBirds() {
    var birds = [];
    for (var i = 0; i < 10; i++) {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.0, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.8 }));
      body.rotation.x = Math.PI / 2;
      body.castShadow = true;
      g.add(body);
      var wingGeo = new THREE.PlaneGeometry(0.85, 0.32);
      var wingMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, side: THREE.DoubleSide, roughness: 0.8 });
      var wlP = new THREE.Group();
      var wl = new THREE.Mesh(wingGeo, wingMat);
      wl.rotation.x = -Math.PI / 2;   // 水平翼面
      wl.position.set(-0.45, 0, 0);
      wlP.add(wl);
      g.add(wlP);
      var wrP = new THREE.Group();
      var wr = new THREE.Mesh(wingGeo, wingMat);
      wr.rotation.x = -Math.PI / 2;
      wr.position.set(0.45, 0, 0);
      wrP.add(wr);
      g.add(wrP);
      g.userData = {
        radius: H.rand(18, 42), height: H.rand(15, 26),
        speed: H.rand(0.10, 0.24), phase: H.rng() * 6.28, wlP: wlP, wrP: wrP
      };
      scene.add(g);
      birds.push(g);
    }
    return birds;
  }

  // ---------- 小船（沿河往返） ----------
  function buildBoat() {
    var g = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.1), H.mat('#e2685f'));
    hull.position.y = 0.15;
    hull.castShadow = true;
    g.add(hull);
    var bow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.0, 4), H.mat('#e2685f'));
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.15, 1.6);
    g.add(bow);
    var rim = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.2), H.mat('#f5f1e8'));
    rim.position.y = 0.42;
    g.add(rim);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.8), H.mat('#f6efe2'));
    cabin.position.set(-0.5, 0.75, 0);
    cabin.castShadow = true;
    g.add(cabin);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), H.mat('#7a5a3e'));
    mast.position.set(0.4, 1.1, 0);
    g.add(mast);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xc9403a, side: THREE.DoubleSide }));
    flag.position.set(0.7, 2.0, 0);
    g.add(flag);
    H.boatFlag = flag;
    scene.add(g);
    var pts = [
      new THREE.Vector3(27, -0.2, 53),
      new THREE.Vector3(22, -0.15, 48),
      new THREE.Vector3(17, 0.05, 43),
      new THREE.Vector3(13, 0.3, 38),
      new THREE.Vector3(10.2, 0.62, 33.5)
    ];
    var curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    return { g: g, curve: curve };
  }

  // ---------- 行人 ----------
  function buildNpcs() {
    var loops = [
      [[6, 0], [0, 6], [-6, 0], [0, -6]],                                  // 广场环行
      [[7, 0], [13, 0], [19, 0], [21.5, -4], [23, -8]],                    // 东街→神社参道
      [[0, 11], [4, 15], [8, 20], [12, 25], [16, 30], [19, 35], [21, 40], [22.5, 45]], // 海港道
      [[-8, 11], [-12, 12.5], [-16, 14], [-20, 15.5], [-23, 16.8]],        // 城堡道
      [[8, -11], [10.5, -14], [13, -17], [14.5, -18.5]],                   // 风车道
      [[-7, 0], [-13, 0], [-19, 0], [-19, -3], [-13, -3], [-7, -3]],       // 西街环线
      [[7, 0], [11, 0], [15, 0], [19, 0], [21.5, 1], [24, 2], [27.5, 3], [31, 4.5], [35, 6], [39, 7.5]] // 灯塔道
    ];
    var colors = [0xe2685f, 0x5b8f8b, 0xe8c66a, 0x8f7fb8, 0x6fa3d8, 0xf0a8c4];
    var npcs = [];
    for (var i = 0; i < loops.length; i++) {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.85, 8), H.mat(colors[i % colors.length]));
      body.position.y = 0.9;
      body.castShadow = true;
      g.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), H.mat('#f2c9a8'));
      head.position.y = 1.55;
      head.castShadow = true;
      g.add(head);
      var hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), H.mat('#5a4636'));
      hair.position.y = 1.58;
      g.add(hair);
      var legGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
      var legMat = H.mat('#3a3f4a');
      var legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.12, 0.4, 0);
      legL.geometry.translate(0, -0.2, 0);
      g.add(legL);
      var legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.12, 0.4, 0);
      legR.geometry.translate(0, -0.2, 0);
      g.add(legR);
      scene.add(g);
      npcs.push({
        g: g, path: loops[i], idx: 0, t: H.rng() * 4, pause: 0,
        speed: H.rand(1.1, 1.7), legL: legL, legR: legR, phase: H.rng() * 6.28
      });
    }
    return npcs;
  }

  // ---------- 炊烟 ----------
  function buildSmoke() {
    var origins = H.smokeOrigins;
    var N = origins.length * 12;
    var pos = new Float32Array(N * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var smokeTex = H.glowTexture('rgba(216,221,226,0.85)', 'rgba(216,221,226,0.3)');
    var mat = new THREE.PointsMaterial({
      color: 0xd8dde2, size: 0.45, map: smokeTex, transparent: true, opacity: 0.32,
      depthWrite: false, alphaTest: 0.02
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return { points: points, origins: origins, n: N };
  }

  // ---------- 萤火虫 ----------
  function buildFireflies() {
    var N = 70;
    var pos = new Float32Array(N * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xffe9a0, size: 0.32, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);
    var flies = [];
    for (var i = 0; i < N; i++) {
      var a = H.rng() * Math.PI * 2, r = H.rand(6, 30);
      var x = Math.cos(a) * r, z = Math.sin(a) * r;
      flies.push({
        x: x, y: H.groundHeight(x, z) + H.rand(0.8, 3.2), z: z,
        ph: H.rng() * 6.28, sp: H.rand(0.4, 1.1)
      });
    }
    return { points: points, flies: flies };
  }

  // ---------- 湖上水灯 ----------
  function buildLanterns() {
    var lanterns = [];
    for (var i = 0; i < 5; i++) {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), H.mat('#f5d76e'));
      body.castShadow = true;
      g.add(body);
      var glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), H.lanternGlowMat);
      glow.position.y = 0.1;
      g.add(glow);
      var top = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 4), H.mat('#c9403a'));
      top.position.y = 0.34;
      g.add(top);
      var a = H.rng() * Math.PI * 2;
      g.position.set(H.LAKE.x + Math.cos(a) * 3.4, H.LAKE_Y + 0.05, H.LAKE.z + Math.sin(a) * 3.4);
      scene.add(g);
      lanterns.push({ g: g, a: a, r: H.rand(2.2, 4.2), sp: H.rand(0.05, 0.12), ph: H.rng() * 6.28 });
    }
    return lanterns;
  }

  // ---------- 烟花 ----------
  function buildFireworks() {
    var active = [];
    var nextAt = 3;
    function spawn(now) {
      var center = new THREE.Vector3(H.rand(-26, 26), H.rand(22, 38), H.rand(-26, 26));
      var N = 130;
      var pos = new Float32Array(N * 3);
      var col = new Float32Array(N * 3);
      var vel = [];
      var hue = H.rng();
      var base = new THREE.Color().setHSL(hue, 0.9, 0.62);
      for (var i = 0; i < N; i++) {
        pos[i * 3] = center.x; pos[i * 3 + 1] = center.y; pos[i * 3 + 2] = center.z;
        var v = new THREE.Vector3(
          H.rand(-1, 1), H.rand(-0.6, 1), H.rand(-1, 1)
        ).normalize().multiplyScalar(H.rand(4.5, 8.5));
        vel.push(v);
        var c = base.clone().offsetHSL(H.rand(-0.06, 0.06), 0, H.rand(-0.12, 0.12));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var mat = new THREE.PointsMaterial({
        size: 0.85, vertexColors: true, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      });
      var points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      scene.add(points);
      active.push({ points: points, vel: vel, life: 0, dur: 2.4 });
    }
    function update(dt, t) {
      if (!H.state.fireworks || H.env.nightF < 0.55) return;
      if (t > nextAt) {
        spawn(t);
        nextAt = t + H.rand(5, 11);
      }
      var i, j;
      for (i = active.length - 1; i >= 0; i--) {
        var fw = active[i];
        fw.life += dt;
        var posAttr = fw.points.geometry.attributes.position;
        for (j = 0; j < fw.vel.length; j++) {
          var v = fw.vel[j];
          v.y -= 4.2 * dt;
          v.multiplyScalar(0.985);
          posAttr.setXYZ(j, posAttr.getX(j) + v.x * dt, posAttr.getY(j) + v.y * dt, posAttr.getZ(j) + v.z * dt);
        }
        posAttr.needsUpdate = true;
        fw.points.material.opacity = Math.max(0, 1 - fw.life / fw.dur);
        if (fw.life >= fw.dur) {
          scene.remove(fw.points);
          fw.points.geometry.dispose();
          fw.points.material.dispose();
          active.splice(i, 1);
        }
      }
    }
    return { update: update };
  }

  // ---------- 昼夜循环主更新 ----------
  var skyMat, stars, sunMoon, clouds, birds, boat, npcs, smoke, fireflies, lanterns, fireworks;

  H.setupDynamics = function (sceneRef) {
    scene = sceneRef;
    skyMat = buildSky();
    stars = buildStars();
    sunMoon = buildSunMoon();
    clouds = buildClouds();
    birds = buildBirds();
    boat = buildBoat();
    npcs = buildNpcs();
    smoke = buildSmoke();
    fireflies = buildFireflies();
    lanterns = buildLanterns();
    fireworks = buildFireworks();

    // 环境光与主方向光
    var hemi = new THREE.HemisphereLight(0xbfe3f5, 0x3a4a2f, 0.6);
    scene.add(hemi);
    var dir = new THREE.DirectionalLight(0xfff2df, 1.2);
    dir.position.set(60, 90, 40);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -72; dir.shadow.camera.right = 72;
    dir.shadow.camera.top = 72; dir.shadow.camera.bottom = -72;
    dir.shadow.camera.near = 10; dir.shadow.camera.far = 320;
    dir.shadow.bias = -0.0006;
    scene.add(dir);
    // 冷色补光（增加体积层次）
    var fill = new THREE.DirectionalLight(0xbfd9f5, 0);
    fill.position.set(-70, 50, -60);
    scene.add(fill);
    H.hemi = hemi;
    H.dir = dir;
    H.fill = fill;

    // 雾
    scene.fog = new THREE.FogExp2(0xbfd9e8, 0.0028);

    // 循环更新
    H.updateCycle = function (dt) {
      var env = H.env;
      if (env.playing) env.t = (env.t + dt * env.speed / 60) % 1;
      var t = env.t;
      var ang = (t - 0.25) * Math.PI * 2;
      var el = Math.sin(ang);
      var az = ang;
      var sunDir = new THREE.Vector3(
        Math.cos(az) * Math.cos(el),
        Math.sin(el),
        Math.sin(az) * Math.cos(el)
      ).normalize();
      var dayF = H.smoothstep(-0.02, 0.18, el);
      var nightF = H.smoothstep(0.02, -0.22, el);
      var duskF = Math.exp(-(el * el) / 0.045);
      env.dayF = dayF; env.nightF = nightF; env.duskF = duskF;
      env.sunDir = sunDir;

      // 天空颜色
      var topN = H.col('#0b1026'), topD = H.col('#3d7fd0'), topK = H.col('#4a3f7d');
      var botN = H.col('#1c2547'), botD = H.col('#cfe8f5'), botK = H.col('#ff9a63');
      var top = topN.clone().lerp(topD, dayF).lerp(topK, duskF * 0.75);
      var bot = botN.clone().lerp(botD, dayF).lerp(botK, duskF * 0.8);
      skyMat.uniforms.uTop.value.copy(top);
      skyMat.uniforms.uBottom.value.copy(bot);
      skyMat.uniforms.uSunDir.value.copy(sunDir);
      skyMat.uniforms.uSunGlow.value.copy(
        H.col('#fff2c4').lerp(H.col('#ff9a63'), duskF * 0.9)
      );
      skyMat.uniforms.uSunAmount.value = 0.35 * dayF + duskF * 1.1;
      skyMat.uniforms.uMoonDir.value.copy(sunDir).multiplyScalar(-1);
      skyMat.uniforms.uMoonAmount.value = nightF * 1.0;

      // 雾
      scene.fog.color.copy(bot);
      scene.fog.density = 0.0052 - 0.0024 * dayF + duskF * 0.0006;

      // 水面颜色随时间变化（夜晚海面不再反光发亮）
      var skyC = bot.clone().lerp(H.col('#cfe8f5'), 0.3);
      var deepC = H.col('#0e2f4e').lerp(H.col('#2c6a9e'), dayF);
      var shalC = H.col('#2b5d80').lerp(H.col('#6fc0dc'), dayF);
      for (var w = 0; w < H.waterMats.length; w++) {
        H.waterMats[w].uniforms.uSky.value.copy(skyC);
        H.waterMats[w].uniforms.uDeep.value.copy(deepC);
        H.waterMats[w].uniforms.uShallow.value.copy(shalC);
      }

      // 灯光（黄昏保留金色余晖；降低环境光提高明暗对比）
      hemi.intensity = 0.15 + 0.42 * dayF + 0.26 * duskF;
      hemi.color.copy(bot).lerp(H.col('#bfe3f5'), 0.5);
      fill.intensity = 0.05 + 0.16 * dayF;
      if (el > 0.02) {
        dir.position.copy(sunDir).multiplyScalar(150);
        dir.color.copy(H.col('#ff9d5c').lerp(H.col('#fff2df'), H.smoothstep(0, 0.38, el)));
        dir.intensity = 0.3 + 1.4 * dayF + 0.8 * duskF;
      } else {
        dir.position.copy(sunDir).multiplyScalar(-150);
        dir.color.set(0xa8c4ff);
        dir.intensity = 0.5 * nightF;
      }

      // 太阳 / 月亮
      sunMoon.sun.position.copy(sunDir).multiplyScalar(400);
      sunMoon.sunCore.position.copy(sunDir).multiplyScalar(400);
      sunMoon.sun.material.opacity = 0.25 + 0.75 * dayF + duskF * 0.4;
      sunMoon.sun.scale.setScalar(46 + duskF * 30);
      sunMoon.sunCore.visible = el > -0.05;
      var moonDir = sunDir.clone().multiplyScalar(-1);
      sunMoon.moon.position.copy(moonDir).multiplyScalar(400);
      sunMoon.moonCore.position.copy(moonDir).multiplyScalar(400);
      sunMoon.moon.material.opacity = nightF * 0.9;
      sunMoon.moonCore.visible = nightF > 0.05;

      // 星星
      stars.material.opacity = nightF * 0.9;
      stars.visible = nightF > 0.02;

      // 窗户/灯光/招牌
      var flicker = 0.92 + 0.08 * Math.sin(t * 60);
      for (var i = 0; i < H.winMats.length; i++) {
        H.winMats[i].emissiveIntensity = (0.05 + 1.7 * nightF) * flicker;
      }
      H.lampBulbMat.emissiveIntensity = 0.1 + 2.4 * nightF * flicker;
      H.lanternGlowMat.emissiveIntensity = 0.1 + 2.0 * nightF * flicker;
      for (var s = 0; s < H.signMats.length; s++) {
        H.signMats[s].emissiveIntensity = nightF * 1.25;
      }
      for (var l = 0; l < H.lampLights.length; l++) {
        H.lampLights[l].intensity = 18 * nightF;
      }
      for (var lg = 0; lg < H.lampGlows.length; lg++) {
        H.lampGlows[lg].opacity = 0.55 * nightF;
      }
      for (var f = 0; f < H.ferrisLights.length; f++) {
        H.ferrisLights[f].emissiveIntensity = 0.1 + 1.7 * nightF * flicker;
      }
      H.beamMat.opacity = nightF * 0.45;
      H.waterfallMat.uniforms.uTime.value = H.elapsed || 0;

      // 云的颜色
      H.cloudMat.color.copy(H.col('#b0bdd2').lerp(H.col('#ffffff'), dayF + duskF * 0.15));
    };

    // 更新 HUD 时钟
    H.updateHud = function () {
      var el = document.getElementById('clock');
      var ph = document.getElementById('phase');
      if (!el) return;
      var h24 = H.env.t * 24;
      var hh = Math.floor(h24), mm = Math.floor((h24 - hh) * 60);
      el.textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
      if (ph) ph.textContent = phaseName(H.env.t);
      var dot = document.getElementById('sunDot');
      if (dot) dot.style.left = (H.env.t * 100) + '%';
    };

    // 动态元素总更新
    H.updateDynamics = function (dt, t) {
      H.elapsed = t;
      var i, j;
      // 云
      for (i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        c.position.x += dt * c.userData.speed;
        c.position.y += Math.sin(t * 0.3 + i) * 0.002;
        if (c.position.x > 90) c.position.x = -90;
      }
      // 鸟
      for (i = 0; i < birds.length; i++) {
        var b = birds[i], u = b.userData;
        var ang = t * u.speed + u.phase;
        var x = Math.cos(ang) * u.radius;
        var z = Math.sin(ang) * u.radius;
        var y = u.height + Math.sin(t * 0.6 + u.phase) * 1.2;
        b.position.set(x, y, z);
        var vx = -Math.sin(ang) * u.radius * u.speed;
        var vz = Math.cos(ang) * u.radius * u.speed;
        b.rotation.y = Math.atan2(vx, vz);
        b.rotation.z = Math.sin(t * 0.9 + u.phase) * 0.15;
        var flap = Math.sin(t * 9 + u.phase) * 0.55;
        u.wlP.rotation.z = flap;
        u.wrP.rotation.z = -flap;
      }
      // 风车 / 摩天轮 / 灯塔
      if (H.windmillBlades) H.windmillBlades.rotation.z += dt * 1.3;
      if (H.wheel) {
        H.wheel.rotation.z -= dt * 0.4;
        // 吊舱反向旋转保持直立
        if (H.wheelCabins) {
          for (var ci = 0; ci < H.wheelCabins.length; ci++) {
            H.wheelCabins[ci].rotation.z = -H.wheel.rotation.z;
          }
        }
      }
      if (H.beam) H.beam.rotation.y += dt * 0.9 * (0.25 + H.env.nightF);
      // 小船
      var bt = (t / 48) % 1;
      var s = bt < 0.14 ? 0 : (bt - 0.14) / 0.86;
      var p = boat.curve.getPoint(s);
      var tan = boat.curve.getTangent(Math.min(s, 0.999));
      boat.g.position.copy(p);
      boat.g.position.y += Math.sin(t * 1.4) * 0.05;
      boat.g.rotation.y = Math.atan2(tan.x, tan.z);
      boat.g.rotation.z = Math.sin(t * 1.1) * 0.04;
      H.boatFlag.rotation.y = Math.sin(t * 2.2) * 0.4;
      // 行人
      for (i = 0; i < npcs.length; i++) {
        var np = npcs[i];
        if (np.pause > 0) {
          np.pause -= dt;
        } else {
          var a = np.path[np.idx];
          var b2 = np.path[(np.idx + 1) % np.path.length];
          var dx = b2[0] - a[0], dz = b2[1] - a[1];
          var dist = Math.hypot(dx, dz);
          np.t += dt * np.speed / dist;
          if (np.t >= 1) {
            np.t = 0;
            np.idx = (np.idx + 1) % np.path.length;
            np.pause = H.rand(0.6, 2.2);
          }
          var nx = H.lerp(a[0], b2[0], np.t);
          var nz = H.lerp(a[1], b2[1], np.t);
          np.g.position.set(nx, H.groundHeight(nx, nz), nz);
          np.g.rotation.y = Math.atan2(dx, dz);
        }
        var walk = Math.sin(t * 7 + np.phase) * 0.5;
        np.legL.rotation.x = walk;
        np.legR.rotation.x = -walk;
        np.g.position.y += Math.abs(Math.sin(t * 7 + np.phase)) * 0.03;
      }
      // 炊烟
      var sp = smoke.points.geometry.attributes.position;
      for (i = 0; i < smoke.n; i++) {
        var o = smoke.origins[i % smoke.origins.length];
        var life = ((t * 0.35) + (i % 12) / 12) % 1;
        var sway = Math.sin(t * 1.2 + i * 1.7) * 0.3 * life;
        sp.setXYZ(i,
          o.x + sway,
          o.y + life * 3.2,
          o.z + Math.cos(t * 1.1 + i) * 0.25 * life
        );
      }
      sp.needsUpdate = true;
      // 萤火虫
      fireflies.points.visible = H.env.nightF > 0.25;
      fireflies.points.material.opacity = H.env.nightF;
      if (fireflies.points.visible) {
        var fp = fireflies.points.geometry.attributes.position;
        for (i = 0; i < fireflies.flies.length; i++) {
          var fl = fireflies.flies[i];
          fp.setXYZ(i,
            fl.x + Math.sin(t * fl.sp + fl.ph) * 1.6,
            fl.y + Math.sin(t * 0.8 + fl.ph * 2) * 0.7,
            fl.z + Math.cos(t * fl.sp * 0.8 + fl.ph) * 1.6
          );
        }
        fp.needsUpdate = true;
      }
      // 水灯
      for (i = 0; i < lanterns.length; i++) {
        var ln = lanterns[i];
        ln.a += dt * ln.sp;
        ln.g.position.set(
          H.LAKE.x + Math.cos(ln.a) * ln.r,
          H.LAKE_Y + 0.05 + Math.sin(t * 1.1 + ln.ph) * 0.04,
          H.LAKE.z + Math.sin(ln.a) * ln.r
        );
        ln.g.rotation.y = ln.a + 1.5;
      }
      // 烟花
      fireworks.update(dt, t);
      // 旗帜
      for (i = 0; i < H.flags.length; i++) {
        var fg = H.flags[i];
        fg.mesh.rotation.y = Math.sin(t * 2.4 + fg.phase) * 0.35;
      }
      // 树木摇曳
      for (i = 0; i < H.swayTrees.length; i++) {
        var tr = H.swayTrees[i];
        tr.g.rotation.z = Math.sin(t * 1.4 + tr.ph) * tr.amp;
        tr.g.rotation.x = Math.cos(t * 1.1 + tr.ph) * tr.amp * 0.7;
      }
      // 喷泉
      if (H.fountain) {
        var f = H.fountain;
        var fpos = f.points.geometry.attributes.position;
        for (i = 0; i < f.count; i++) {
          var ph = (t * 1.1 + i / f.count) % 1;
          var rad = 0.1 + ph * 1.7;
          fpos.setXYZ(i,
            f.center.x + Math.cos(i * 2.4 + t * 0.6) * rad,
            f.center.y + 1.6 * (4 * ph * (1 - ph)) * (0.6 + 0.4 * ph),
            f.center.z + Math.sin(i * 2.4 + t * 0.6) * rad
          );
        }
        fpos.needsUpdate = true;
      }
      // 时钟指针（四面同步）
      if (H.clockHands && H.clockHands.hour.length) {
        var h24 = H.env.t * 24;
        var hourAng = (h24 % 12) / 12 * Math.PI * 2;
        var minAng = (h24 % 1) * Math.PI * 2;
        for (var hI = 0; hI < H.clockHands.hour.length; hI++) {
          H.clockHands.hour[hI].rotation.z = -hourAng;
          H.clockHands.minute[hI].rotation.z = -minAng;
        }
      }
      // 瀑底水花呼吸
      if (H.foam) {
        var sc = 1 + Math.sin(t * 2.2) * 0.12;
        H.foam.scale.set(sc, sc, sc);
        H.foam.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.1;
      }
      // 载具（汽车 / 飞艇）
      if (H.updateVehicles) H.updateVehicles(dt, t);
    };
  };
})();
