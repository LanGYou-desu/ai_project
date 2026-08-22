/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · terrain.js
 * 高低错落的地形：中央台地、神社丘陵、城堡山、湖泊河流、
 * 瀑布、海岸悬崖 —— 一切由高度函数驱动
 * ============================================================ */
(function () {
  'use strict';
  var H = window.H;

  H.WATER_Y = -0.6;   // 海平面
  H.LAKE_Y = 0.7;     // 湖面（台地脚下的水潭）
  H.LAKE = { x: 9, z: 30, r: 6.2 };
  // 河流路径：从湖流向东南海面（形成入海口与港口）
  H.RIVER = [[9, 32], [12, 38], [16, 43], [21, 49], [27, 54], [33, 59]];

  H.distToPath = function (x, z, pts) {
    var d = 1e9, i;
    for (i = 0; i < pts.length - 1; i++) {
      var ax = pts[i][0], az = pts[i][1];
      var bx = pts[i + 1][0], bz = pts[i + 1][1];
      var dx = bx - ax, dz = bz - az;
      var L2 = dx * dx + dz * dz;
      var t = H.clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
      var px = ax + dx * t, pz = az + dz * t;
      d = Math.min(d, Math.hypot(x - px, z - pz));
    }
    return d;
  };

  // ---------- 原始高度函数（不含建筑整平平台） ----------
  H.rawGroundHeight = function (x, z) {
    var r = Math.hypot(x, z);
    // 中央台地（小镇主城区，平坦）
    var plateau = H.smoothstep(27, 20, Math.hypot(x, z));
    var y = 6.2 * plateau;
    // 神社丘陵（东）
    y += 10.5 * H.gauss(Math.hypot(x - 28, z + 16), 13);
    // 城堡山（西）
    y += 7.5 * H.gauss(Math.hypot(x + 27, z - 19), 12);
    // 东北林丘
    y += 3.2 * H.gauss(Math.hypot(x - 17, z + 25), 10);
    // 东南岬角（港口半岛，河流从中穿流入海）
    y += 6.0 * H.gauss(Math.hypot(x - 24, z - 38), 15);
    // 西南草丘（风车坪）
    y += 2.6 * H.gauss(Math.hypot(x + 20, z + 8), 9);
    // 起伏噪声（台地上衰减，保证街道平整）
    var und = (H.fbm(x * 0.045, z * 0.045, 3) - 0.5) * 4.4 * (1 - plateau * 0.9);
    y += und;
    // 岛屿边缘：坠向海面的悬崖海岸（r>66 处沉入海下）
    var edge = H.smoothstep(52, 66, r);
    y = H.lerp(y, -3.4, edge);
    // 湖泊下挖
    var dl = Math.hypot(x - H.LAKE.x, z - H.LAKE.z);
    var lake = H.smoothstep(H.LAKE.r, H.LAKE.r * 0.42, dl);
    y = H.lerp(y, -1.6, lake * 0.96);
    // 河道下挖
    var dr = H.distToPath(x, z, H.RIVER);
    var river = H.smoothstep(3.4, 1.5, dr);
    y = H.lerp(y, -1.4, river * 0.92);
    return y;
  };

  // ---------- 建筑整平平台（让地形适配建筑，而非建筑悬空） ----------
  // [x, z, 平台高度, 内半径(全平), 外半径(渐变到自然地形)]
  H.PADS = [
    // 民居（沿街两侧）
    [11, -5.2, 6.48, 2.7, 4.4], [15, -5.2, 7.13, 2.7, 4.4],
    [11, 5.2, 6.12, 2.7, 4.4], [15, 5.2, 6.19, 2.7, 4.4], [19, 5.2, 6.30, 2.7, 4.4],
    [-11, -5.2, 6.72, 2.7, 4.4], [-15, -5.2, 7.67, 2.7, 4.4], [-19, -5.2, 8.42, 2.7, 4.4],
    [-11, 5.2, 6.29, 2.7, 4.4], [-15, 5.2, 6.57, 2.7, 4.4], [-19, 5.2, 6.97, 2.7, 4.4],
    [-6, 14.5, 6.28, 2.7, 4.4], [-2, 15, 6.22, 2.7, 4.4],
    [10.5, -20, 5.93, 2.7, 4.4], [21, 29, 2.61, 2.7, 4.4],
    // 店铺
    [-5, -14.5, 6.15, 3.0, 4.8], [0, -15.5, 6.12, 3.0, 4.8], [5, -14.5, 6.32, 3.0, 4.8],
    // 地标
    [13, -9, 7.31, 2.9, 4.7],       // 钟楼
    [28, -16, 10.56, 4.6, 7.2],     // 神社
    [-27, 19, 6.99, 6.6, 10.5],     // 城堡
    [16, -21, 5.03, 2.8, 4.6],      // 风车
    [-17, 10, 7.50, 4.6, 7.2],      // 摩天轮
    [43, 9, 0.80, 3.2, 5.4],        // 灯塔
    [22.3, -7.5, 7.21, 1.6, 3.0],   // 鸟居
    [35, -17, 6.46, 2.6, 4.2]       // 五重塔
  ];
  H.groundHeight = function (x, z) {
    var y = H.rawGroundHeight(x, z);
    var i, p;
    for (i = 0; i < H.PADS.length; i++) {
      p = H.PADS[i];
      var d = Math.hypot(x - p[0], z - p[1]);
      var m = H.smoothstep(p[4], p[3], d);
      y = H.lerp(y, p[2], m);
    }
    return y;
  };

  // ---------- 共享水面着色器 ----------
  H.makeWaterMat = function () {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3(0, 20, 60) },
        uDeep: { value: H.col('#2c6a9e') },
        uShallow: { value: H.col('#6fc0dc') },
        uSky: { value: H.col('#bfe2f2') }
      },
      vertexShader: [
        'varying vec3 vWorld;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vWorld = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform vec3 uCam;',
        'uniform vec3 uDeep;',
        'uniform vec3 uShallow;',
        'uniform vec3 uSky;',
        'varying vec3 vWorld;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
        'void main(){',
        '  float w1 = sin(vWorld.x*0.32 + uTime*1.15) * 0.5;',
        '  float w2 = sin(vWorld.z*0.27 - uTime*1.35) * 0.5;',
        '  float w3 = sin((vWorld.x+vWorld.z)*0.12 + uTime*0.6) * 0.5;',
        '  float waves = w1 + w2 + w3;',
        '  vec3 col = mix(uDeep, uShallow, 0.45 + 0.25*sin(uTime*0.5 + vWorld.x*0.05 + vWorld.z*0.04));',
        '  vec3 V = normalize(uCam - vWorld);',
        '  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);',
        '  col = mix(col, uSky, fres*0.55);',
        '  float sparkle = step(0.985, hash(floor(vWorld.xz*3.0) + floor(uTime*2.0))) * 0.35;',
        '  col += sparkle;',
        '  col += smoothstep(1.35, 1.55, waves) * 0.18;',
        '  gl_FragColor = vec4(col, 0.93);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n')
    });
  };

  // ---------- 瀑布着色器 ----------
  H.makeWaterfallMat = function () {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uA: { value: H.col('#eaf7ff') },
        uB: { value: H.col('#9fd4ee') }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform vec3 uA;',
        'uniform vec3 uB;',
        'varying vec2 vUv;',
        'void main(){',
        '  float n = sin(vUv.y*46.0 - uTime*7.0)*0.5 + 0.5;',
        '  n = pow(n, 2.2);',
        '  float n2 = sin(vUv.y*23.0 - uTime*4.2 + vUv.x*6.0)*0.5 + 0.5;',
        '  vec3 col = mix(uA, uB, n*0.55 + n2*0.25);',
        '  float alpha = smoothstep(0.0,0.12,vUv.y) * smoothstep(1.0,0.88,vUv.y) * 0.88;',
        '  gl_FragColor = vec4(col, alpha);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n')
    });
  };

  // ---------- 河流水带（沿路径、随高度下降的几何条带） ----------
  function buildRiverRibbon() {
    var pts = H.RIVER.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
    var curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
    var N = 42, i;
    var positions = new Float32Array((N + 1) * 2 * 3);
    var uvs = new Float32Array((N + 1) * 2 * 2);
    var indices = [];
    for (i = 0; i <= N; i++) {
      var s = i / N;
      var p = curve.getPoint(s);
      var t = curve.getTangent(s);
      // 水面从湖面高度缓降到海平面
      var y = H.lerp(H.LAKE_Y + 0.02, H.WATER_Y + 0.06, s * s * (3 - 2 * s));
      var nx = -t.z, nz = t.x;
      var len = Math.hypot(nx, nz) || 1;
      nx /= len; nz /= len;
      var w = H.lerp(3.0, 2.0, s);
      var o = i * 6;
      positions[o] = p.x + nx * w / 2; positions[o + 1] = y; positions[o + 2] = p.z + nz * w / 2;
      positions[o + 3] = p.x - nx * w / 2; positions[o + 4] = y; positions[o + 5] = p.z - nz * w / 2;
      var uo = i * 4;
      uvs[uo] = 0; uvs[uo + 1] = s;
      uvs[uo + 2] = 1; uvs[uo + 3] = s;
      if (i < N) {
        var a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
        indices.push(a, b, c, b, d, c);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  // ---------- 地形网格 ----------
  function buildTerrainMesh() {
    var size = 196, seg = 220;
    var geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var c = new THREE.Color();
    var g1 = H.col('#8fc065'), g2 = H.col('#6fa653'), g3 = H.col('#5a8c46');
    var sand = H.col('#e8d7a2'), sandWet = H.col('#cfc08c');
    var rock = H.col('#8b8b93'), rockDark = H.col('#6f7078');
    var dirt = H.col('#a08059'), mud = H.col('#8a6f52');
    var i;
    for (i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var y = H.groundHeight(x, z);
      pos.setY(i, y);
      // 坡度（有限差分）
      var dx = (H.groundHeight(x + 0.9, z) - H.groundHeight(x - 0.9, z)) / 1.8;
      var dz = (H.groundHeight(x, z + 0.9) - H.groundHeight(x, z - 0.9)) / 1.8;
      var slope = Math.hypot(dx, dz);
      var n1 = H.fbm(x * 0.11, z * 0.11, 2);
      var n2 = H.fbm(x * 0.33 + 9, z * 0.33, 1);
      if (y < H.WATER_Y + 0.02) {
        c.copy(sandWet).lerp(mud, n2 * 0.5);
      } else if (y < 0.9) {
        c.copy(sandWet).lerp(sand, H.smoothstep(H.WATER_Y + 0.02, 0.9, y));
      } else {
        c.copy(g1).lerp(g2, n1).lerp(g3, n2 * 0.55);
        // 峭壁岩层
        c.lerp(rock, H.smoothstep(0.72, 1.35, slope));
        c.lerp(rockDark, H.smoothstep(1.1, 1.8, slope) * 0.7);
        // 山体高处少量岩石
        c.lerp(rock, H.smoothstep(9.5, 16, y) * 0.45);
        // 湖边/河岸泥土
        var dl = Math.hypot(x - H.LAKE.x, z - H.LAKE.z);
        c.lerp(dirt, H.smoothstep(H.LAKE.r + 1.2, H.LAKE.r - 0.5, dl) * 0.4);
        var dr = H.distToPath(x, z, H.RIVER);
        c.lerp(dirt, H.smoothstep(3.2, 1.6, dr) * 0.35);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0.0, map: H.texGrass() });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  // ---------- 组装 ----------
  H.buildTerrain = function (scene) {
    scene.add(buildTerrainMesh());

    // 大海
    var waterMat = H.makeWaterMat();
    H.waterMats = [waterMat];
    var sea = new THREE.Mesh(new THREE.CircleGeometry(320, 64), waterMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = H.WATER_Y;
    scene.add(sea);

    // 湖面
    var lake = new THREE.Mesh(new THREE.CircleGeometry(H.LAKE.r - 0.15, 40), waterMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(H.LAKE.x, H.LAKE_Y, H.LAKE.z);
    scene.add(lake);

    // 河流
    var river = new THREE.Mesh(buildRiverRibbon(), waterMat);
    scene.add(river);

    // 台地小溪：沿地形从高原边缘流入湖中（贴合坡面的流动水带）
    H.waterfallMat = H.makeWaterfallMat(); // 保留（水面统一时间）
    var sPts = [[5.2, 19.6], [5.9, 21.4], [6.8, 23.4], [7.8, 25.4], [8.6, 27.2]];
    var sN = 24;
    var sPos = new Float32Array((sN + 1) * 2 * 3);
    var sIdx = [];
    for (var si = 0; si <= sN; si++) {
      var ss = si / sN;
      var seg = ss * (sPts.length - 1);
      var k0 = Math.min(Math.floor(seg), sPts.length - 2);
      var kf = seg - k0;
      var sx = H.lerp(sPts[k0][0], sPts[k0 + 1][0], kf);
      var sz = H.lerp(sPts[k0][1], sPts[k0 + 1][1], kf);
      var sy = Math.max(H.groundHeight(sx, sz) + 0.14, H.LAKE_Y + 0.03);
      var tx = (sPts[k0 + 1][0] - sPts[k0][0]), tz = (sPts[k0 + 1][1] - sPts[k0][1]);
      var tl = Math.hypot(tx, tz) || 1;
      var nx = -tz / tl, nz = tx / tl;
      var sw = H.lerp(0.9, 1.5, ss);
      var so = si * 6;
      sPos[so] = sx + nx * sw / 2; sPos[so + 1] = sy; sPos[so + 2] = sz + nz * sw / 2;
      sPos[so + 3] = sx - nx * sw / 2; sPos[so + 4] = sy; sPos[so + 5] = sz - nz * sw / 2;
      if (si < sN) {
        var sa = si * 2, sb = si * 2 + 1, sc = si * 2 + 2, sd = si * 2 + 3;
        sIdx.push(sa, sb, sc, sb, sd, sc);
      }
    }
    var streamGeo = new THREE.BufferGeometry();
    streamGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    streamGeo.setIndex(sIdx);
    streamGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(streamGeo, waterMat));

    // 溪口白色水花圈与薄雾
    var mistTex = H.glowTexture('rgba(255,255,255,0.9)', 'rgba(220,240,255,0.35)');
    var mist = new THREE.Sprite(new THREE.SpriteMaterial({
      map: mistTex, transparent: true, opacity: 0.4, depthWrite: false
    }));
    mist.position.set(8.6, H.LAKE_Y + 0.7, 26.6);
    mist.scale.set(4.5, 2.2, 1);
    scene.add(mist);
    H.waterfallMist = mist;

    var foam = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.9, 28),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(8.6, H.LAKE_Y + 0.03, 26.9);
    scene.add(foam);
    H.foam = foam;
  };
})();
