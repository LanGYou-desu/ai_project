/* ============================================================
 * 雨夜便利店 · js/rain.js
 * 持续降雨（实例化雨丝着色器）/ 玻璃雨痕（水痕滑落着色器）/
 * 屋檐滴水与落点涟漪 / 地面积水水膜涟漪 + 雨点迸溅
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R;

  /* 阵风风场（确定性低频起伏；驱动雨丝斜度 / 水痕摆动 / 滴水飘移） */
  R.wind = { x: 0.055, z: 0.02, gust: 1 };

  /* ---------------- 雨丝 ---------------- */
  function buildRainStreaks(root) {
    var COUNT = 1250, NEAR_COUNT = 260, H = 16.0, SPREAD = 16.6;
    var G = R.G;
    // 雨滴不落在便利店内部（会穿过屋顶被看到）
    var banList = [
      [G.STORE.x0 - 0.2, G.STORE.z0 - 0.2, G.STORE.x1 + 0.2, G.STORE.z1 + 0.2],
      [G.HOUSE.x0 - 0.2, G.HOUSE.z0 - 0.2, G.HOUSE.x1 + 0.2, G.HOUSE.z1 + 0.2]
    ];
    function banned(x, z) {
      for (var i = 0; i < banList.length; i++) {
        var b = banList[i];
        if (x > b[0] && x < b[2] && z > b[1] && z < b[3]) return true;
      }
      return false;
    }
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: H },
        uWind: { value: new THREE.Vector2(0.055, 0.02) },
        uColor: { value: new THREE.Color(0x9db6d4) },
        uAlpha: { value: 0.5 }
      },
      vertexShader: [
        'attribute vec3 iOffset;',
        'attribute vec4 iParams;',
        'attribute float iKind;',
        'uniform float uTime;',
        'uniform float uHeight;',
        'uniform vec2 uWind;',
        'varying float vA;',
        'varying vec2 vLoc;',
        'varying float vShim;',
        'void main() {',
        '  float big = step(0.5, iKind);',
        '  float y = mod(iOffset.y - uTime * iParams.x, uHeight);',
        '  float ca = cos(iParams.w), sa = sin(iParams.w);',
        '  vec3 p = vec3(position.x * iParams.z * 0.14 * mix(1.0, 1.35, big), position.y * iParams.y * 1.12, 0.0);',
        '  p = vec3(p.x * ca, p.y, p.x * sa);',
        '  float sway = sin(uTime * 1.6 + iParams.w * 6.2831 + y * 0.35) * 0.055;',
        '  vec3 base = vec3(iOffset.x + uWind.x * y * 4.0 + sway, y, iOffset.z + uWind.y * y * 4.0 + sway * 0.6);',
        '  vec4 baseMv = modelViewMatrix * vec4(base, 1.0);',
        '  float dist = -baseMv.z;',
        '  float elong = 1.0 + 0.30 * (1.0 - smoothstep(5.0, 22.0, dist));',
        '  vec4 mv = baseMv + modelViewMatrix * vec4(p.x, p.y * elong, 0.0, 0.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  float near = 1.0 - smoothstep(26.0, 58.0, dist);',
        '  float nearBig = 1.0 - smoothstep(16.0, 27.0, dist);',
        '  near = mix(near, nearBig, big);',
        '  vA = smoothstep(0.0, 1.1, y) * (1.0 - smoothstep(uHeight - 2.2, uHeight, y)) * near;',
        '  vA *= mix(1.0, 1.2, big);',
        '  vShim = 0.84 + 0.16 * sin(uTime * 9.0 + iParams.w * 43.0);',
        '  vLoc = position.xy;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uAlpha;',
        'varying float vA;',
        'varying vec2 vLoc;',
        'varying float vShim;',
        'void main() {',
        '  float edge = smoothstep(0.5, 0.06, abs(vLoc.x));',      // 软边：雨丝横向渐隐
        '  float tip = 1.0 - 0.35 * abs(vLoc.y) * 2.0;',           // 两端略淡
        '  float a = (vA * vShim * uAlpha + vA * vA * 0.15) * edge * tip;',
        '  if (a < 0.004) discard;',
        '  gl_FragColor = vec4(uColor, a);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    function buildLayer(count, speedR, lenR, thickR, kind) {
      var off = [], par = [], knd = [];
      var i = 0, guard = 0;
      while (i < count && guard < count * 30) {
        guard++;
        var x = R.rand(-SPREAD, SPREAD), z = R.rand(-SPREAD, SPREAD);
        if (banned(x, z)) continue;
        off.push(x, R.rand(0, H), z);
        par.push(R.rand(speedR[0], speedR[1]), R.rand(lenR[0], lenR[1]), R.rand(thickR[0], thickR[1]), R.rand(0, Math.PI * 2));
        knd.push(kind);
        i++;
      }
      var geo = new THREE.PlaneGeometry(1, 1);
      var n = off.length / 3;
      geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(new Float32Array(off), 3));
      geo.setAttribute('iParams', new THREE.InstancedBufferAttribute(new Float32Array(par), 4));
      geo.setAttribute('iKind', new THREE.InstancedBufferAttribute(new Float32Array(knd), 1));
      var inst = new THREE.InstancedMesh(geo, mat, n);
      inst.frustumCulled = false;
      inst.castShadow = false; inst.receiveShadow = false;
      root.add(inst);
      return { mesh: inst, count: n };
    }
    var mainLayer = buildLayer(COUNT, [13, 20], [0.5, 1.5], [0.5, 1.25], 0);
    // 近景大雨层：更长更亮、贴近镜头才显形，增强纵深临场感（共享同一材质）
    var nearLayer = buildLayer(NEAR_COUNT, [20, 27], [0.9, 1.7], [0.75, 1.3], 1);
    return { mesh: mainLayer.mesh, mat: mat, count: mainLayer.count, near: nearLayer };
  }

  /* ---------------- 玻璃雨痕 ---------------- */
  function buildRivulets(root) {
    var mats = [];
    if (!R.glass) return mats;
    var vs = [
      'varying vec2 vUv;',
      'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    ].join('\n');
    var fs = [
      'uniform float uTime;',
      'uniform float uOpacity;',
      'uniform vec2 uWind;',
      'varying vec2 vUv;',
      'float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void main() {',
      '  vec2 uv = vUv;',
      '  float a = 0.0;',
      '  for (int i = 0; i < 9; i++) {',
      '    float fi = float(i);',
      '    float seed = h(vec2(fi * 3.13, 1.7));',
      '    float col = h(vec2(fi, 7.31));',
      '    float speed = 0.05 + 0.10 * h(vec2(fi, 2.2));',
      '    float t = uTime * speed + seed * 7.0;',
      '    float w = 0.010 + 0.018 * h(vec2(fi, 5.1));',
      '    float cx = col + 0.025 * sin(t * 6.28 + fi * 2.0) + uWind.x * 0.6 * sin(t * 1.7 + fi * 1.31);',
      '    float band = smoothstep(w, 0.0, abs(uv.x - cx));',
      '    float head = fract(t);',
      '    float d = head - uv.y;',
      '    float trail = band * exp(-max(d, 0.0) * 7.0) * step(0.0, d);',
      '    float drop = smoothstep(0.09, 0.0, length(vec2((uv.x - cx) * 1.5, (uv.y - head) * 1.15))) * band;',
      '    a += trail * 0.55 + drop * 0.85;',
      '  }',
      '  a = clamp(a, 0.0, 1.0) * uOpacity;',
      '  if (a < 0.01) discard;',
      '  gl_FragColor = vec4(vec3(0.78, 0.86, 0.98), a);',
      '}'
    ].join('\n');
    for (var i = 0; i < R.glass.length; i++) {
      var pane = R.glass[i];
      var m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: R.rand(0, 30) }, uOpacity: { value: 0.55 }, uWind: { value: new THREE.Vector2(0.055, 0.02) } },
        vertexShader: vs, fragmentShader: fs,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      var w = (pane.x1 - pane.x0) - 0.04, h = (pane.y1 - pane.y0) - 0.04;
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      pl.position.set((pane.x0 + pane.x1) / 2, (pane.y0 + pane.y1) / 2, pane.z + 0.035);
      pl.castShadow = false; pl.receiveShadow = false;
      root.add(pl);
      mats.push(m);
    }
    return mats;
  }

  /* ---------------- 地面积水水膜（涟漪 + 迸溅） ---------------- */
  function buildFilm(root) {
    var G = R.G;
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
        uWind: { value: new THREE.Vector2(0.055, 0.02) }
      },
      vertexShader: [
        'varying vec2 vW;',
        'void main() {',
        '  vW = position.xy;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform float uIntensity;',
        'uniform vec2 uWind;',
        'varying vec2 vW;',
        'float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'void main() {',
        '  float mask = 1.0;',
        '  if (vW.x > -8.7 && vW.x < 2.7 && vW.y > -9.5 && vW.y < -0.7) mask = 0.0;',   // 店内不落雨
        '  float a = 0.0;',
        '  for (int i = 0; i < 14; i++) {',
        '    float fi = float(i);',
        '    float period = 1.5 + 0.9 * h(vec2(fi, 1.0));',
        '    float cycle = uTime / period + h(vec2(fi, 7.0)) * 4.0;',
        '    float age = fract(cycle);',
        '    float idx = floor(cycle);',
        '    vec2 c = vec2(h(vec2(fi, idx)) * 28.0 - 14.0 - uWind.x * 18.0 * age, h(vec2(fi + 5.0, idx + 3.7)) * 28.0 - 14.0 - uWind.y * 18.0 * age);',
        '    float d = length(vW - c);',
        '    float r = age * 0.95;',
        '    float ring = smoothstep(0.055, 0.0, abs(d - r));',
        '    float ring2 = smoothstep(0.05, 0.0, abs(d - r * 0.55));',
        '    a += (ring + ring2 * 0.6) * (1.0 - age) * 0.55;',
        '  }',
        '  vec2 cell = floor(vW * 15.0);',
        '  float sp = h(cell);',
        '  float ph = uTime * 1.1 + sp * 9.0;',
        '  float pulse = fract(ph);',
        '  float on = step(0.93, h(cell + floor(ph) * 11.0));',
        '  a += on * smoothstep(1.0, 0.0, pulse) * 0.5;',
        '  float gust = clamp(length(uWind) * 9.0, 0.30, 1.15);',
        '  a = clamp(a, 0.0, 1.0) * mask * uIntensity;',
        '  a *= 0.72 + 0.42 * gust;',
        '  if (a < 0.006) discard;',
        '  gl_FragColor = vec4(vec3(0.62, 0.74, 0.92), a * 0.55);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var geo = new THREE.PlaneGeometry(G.SIZE, G.SIZE);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.028;
    mesh.renderOrder = 3;
    mesh.castShadow = false; mesh.receiveShadow = false;
    root.add(mesh);
    return mat;
  }

  /* ---------------- 屋檐滴水 + 涟漪 ---------------- */
  function buildDrips(root) {
    var G = R.G;
    // 滴水点：雨棚前缘 / 屋顶边 / 落水管 / 邻家屋檐
    var emitters = [];
    var cx;
    for (cx = -8.2; cx < 2.4; cx += 1.7) {
      emitters.push({ x: cx, z: 0.34, y0: 2.72, y1: 0.16, ground: 0.13 });
    }
    emitters.push({ x: -8.62, z: -2.2, y0: 3.33, y1: 0.16, ground: 0.13 });
    emitters.push({ x: -6.0, z: -9.5, y0: 3.33, y1: 0.16, ground: 0.13 });
    emitters.push({ x: -2.0, z: -9.5, y0: 3.33, y1: 0.16, ground: 0.13 });
    emitters.push({ x: 2.72, z: -4.6, y0: 3.33, y1: 0.16, ground: 0.13 });
    emitters.push({ x: -8.5, z: -0.62, y0: 0.5, y1: 0.14, ground: 0.13 });      // 落水管口
    emitters.push({ x: 2.5, z: -0.62, y0: 0.5, y1: 0.14, ground: 0.13 });
    emitters.push({ x: 2.5, z: -9.34, y0: 0.5, y1: 0.14, ground: 0.13 });
    emitters.push({ x: -12.6, z: -2.96, y0: 6.26, y1: 0.16, ground: 0.13 });     // 邻家屋檐
    emitters.push({ x: -11.3, z: -2.96, y0: 6.26, y1: 0.16, ground: 0.13 });
    var drips = [];
    for (var i = 0; i < emitters.length; i++) {
      var e = emitters[i];
      drips.push({
        e: e, t: R.rand(0, 1.4), period: R.rand(0.9, 2.2), falling: false,
        y: e.y0, vy: 0, dur: 0, dx: 0, dz: 0, hvx: 0, hvz: 0
      });
    }
    var posArr = new Float32Array(drips.length * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    var mat = new THREE.PointsMaterial({
      map: R.dotTexture(0.45), color: 0xcfe2f5, size: 0.085, sizeAttenuation: true,
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: true
    });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    root.add(pts);
    // 涟漪环
    var ripples = [];
    var ringGeo = R.ringGeo(0.42, 0.5, 22);
    for (var r = 0; r < 20; r++) {
      var rm = new THREE.MeshBasicMaterial({
        color: 0xa8c4e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, map: R.dotTexture(0.5)
      });
      var mesh = new THREE.Mesh(ringGeo, rm);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 4;
      root.add(mesh);
      ripples.push({ mesh: mesh, mat: rm, t: 0, active: false, life: 1.1 });
    }
    return { drips: drips, points: pts, posArr: posArr, ripples: ripples, rippleIdx: 0 };
  }

  /* ---------------- 组装 ---------------- */
  R.buildRain = function (root) {
    var streaks = buildRainStreaks(root);
    var filmMat = buildFilm(root);
    var rivuletMats = buildRivulets(root);
    var dripSys = buildDrips(root);
    R.rain = {
      streaks: streaks,
      filmMat: filmMat,
      rivuletMats: rivuletMats,
      drips: dripSys.drips,
      points: dripSys.points,
      ripples: dripSys.ripples,
      _rippleIdx: 0,
      /** 手动触发一个落点涟漪 */
      spawnRipple: function (x, y, z, life, strength) {
        var rp = dripSys.ripples[dripSys.rippleIdx % dripSys.ripples.length];
        dripSys.rippleIdx++;
        rp.mesh.position.set(x, y, z);
        rp.mesh.visible = true;
        rp.active = true;
        rp.t = 0;
        rp.life = life || 1.1;
        rp.strength = strength === undefined ? 0.5 : strength;
        return rp;
      }
    };
    return R.rain;
  };

  /* ---------------- 每帧更新 ---------------- */
  R.updateRain = function (dt, t) {
    var rain = R.rain;
    if (!rain) return;

    /* 阵风：确定性低频风场（驱动雨丝斜度 / 水痕摆动 / 滴水飘移） */
    var g1 = Math.sin(t * 0.19 + 0.4) * 0.60 + Math.sin(t * 0.43 + 2.1) * 0.30 + Math.sin(t * 1.07 + 4.4) * 0.22;
    var gust = R.clamp(0.70 + 0.5 * g1, 0.20, 1.30);
    var wx = (0.042 * Math.sin(t * 0.16 + 0.9) + 0.026 * Math.sin(t * 0.57 + 2.2)) * (0.45 + 0.85 * gust);
    var wz = (0.028 * Math.sin(t * 0.12 + 3.4) + 0.016 * Math.sin(t * 0.44 + 5.1)) * (0.45 + 0.85 * gust);
    R.wind.x = wx; R.wind.z = wz; R.wind.gust = gust;

    rain.streaks.mat.uniforms.uTime.value = t;
    rain.streaks.mat.uniforms.uWind.value.set(wx, wz);
    rain.filmMat.uniforms.uTime.value = t;
    rain.filmMat.uniforms.uWind.value.set(wx, wz);
    var i;
    for (i = 0; i < rain.rivuletMats.length; i++) {
      rain.rivuletMats[i].uniforms.uTime.value = t;
      rain.rivuletMats[i].uniforms.uWind.value.set(wx, wz);
    }

    // 滴水：自由落体 + 风致飘移 + 落地涟漪
    var pos = rain.points.geometry.attributes.position;
    for (i = 0; i < rain.drips.length; i++) {
      var d = rain.drips[i];
      var show = 0;
      if (!d.falling) {
        d.t -= dt;
        if (d.t <= 0) {
          d.falling = true;
          d.y = d.e.y0;
          d.vy = 0;
          d.dur = 0;
          d.dx = 0; d.dz = 0; d.hvx = 0; d.hvz = 0;
        }
      } else {
        d.dur += dt;
        d.vy -= 9.8 * dt * 0.55;
        d.y += d.vy * dt * 6.0;
        d.hvx += (wx * 3.4 - d.hvx) * Math.min(1, dt * 2.5);      // 风把水珠吹偏
        d.hvz += (wz * 3.4 - d.hvz) * Math.min(1, dt * 2.5);
        d.dx += d.hvx * dt * 6.0;
        d.dz += d.hvz * dt * 6.0;
        show = 1;
        if (d.y <= d.e.y1) {
          d.falling = false;
          d.t = d.period * R.rand(0.6, 1.5);
          show = 0;
          R.rain.spawnRipple(d.e.x + d.dx, d.e.ground + 0.012, d.e.z + d.dz, 1.2, 0.55);
        }
      }
      pos.setXYZ(i, d.e.x + (d.falling ? d.dx : 0), d.falling ? d.y : -50, d.e.z + (d.falling ? d.dz : 0));
    }
    pos.needsUpdate = true;

    // 涟漪环扩散（初生闪光 + 缓出扩散）
    for (i = 0; i < rain.ripples.length; i++) {
      var rp = rain.ripples[i];
      if (!rp.active) continue;
      rp.t += dt / rp.life;
      if (rp.t >= 1) {
        rp.active = false;
        rp.mesh.visible = false;
        rp.mat.opacity = 0;
        continue;
      }
      var s = 0.06 + (1 - Math.pow(1 - rp.t, 1.35)) * 0.86;
      rp.mesh.scale.set(s, s, s);
      var base = (1 - rp.t) * (rp.strength || 0.5);
      rp.mat.opacity = Math.min(0.88, base * (1 + 0.7 * Math.exp(-rp.t * 9)));
    }
  };
})();
