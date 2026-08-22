/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · util.js
 * 共享工具：确定性随机、值噪声、材质缓存、颜色
 * ============================================================ */
(function () {
  'use strict';
  var H = window.H = window.H || {};

  H.lerp = function (a, b, t) { return a + (b - a) * t; };
  H.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  H.smoothstep = function (a, b, x) {
    var t = H.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // 高斯衰减：dist=0 时为 1，dist=r 附近显著衰减
  H.gauss = function (d, r) { return Math.exp(-(d * d) / (r * r * 0.72)); };

  // 确定性随机数（保证每次刷新小镇布局一致）
  H.mulberry32 = function (seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  H.rng = H.mulberry32(20260821);
  H.rand = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + H.rng() * (b - a);
  };
  H.pick = function (arr) { return arr[Math.floor(H.rng() * arr.length)]; };

  // 值噪声（平滑双线性插值）
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  H.noise2 = function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi);
    var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return H.lerp(H.lerp(a, b, u), H.lerp(c, d, u), v);
  };
  H.fbm = function (x, y, oct) {
    oct = oct || 3;
    var v = 0, amp = 0.5, f = 1, i;
    for (i = 0; i < oct; i++) { v += amp * H.noise2(x * f, y * f); amp *= 0.5; f *= 2.03; }
    return v; // 约 0..1
  };

  H.col = function (hex) { return new THREE.Color(hex); };

  // ---------- 程序化纹理（烘焙好 1x1 平铺，配合材质颜色染色） ----------
  H.texPlaster = function () {
    return H.makeCanvasTexture(128, 128, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 1400; i++) {
        var v = 232 + Math.floor(H.rng() * 24);
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        g.fillRect(H.rng() * w, H.rng() * h, H.rng() * 2.6 + 0.8, H.rng() * 2.6 + 0.8);
      }
      // 轻微垂直线（板材拼缝）
      g.fillStyle = 'rgba(150,150,150,0.12)';
      for (var p = 0; p < 5; p++) g.fillRect(p * 26 + H.rng() * 4, 0, 1.5, h);
    });
  };
  H.texRoof = function () {
    return H.makeCanvasTexture(256, 256, function (g, w, h) {
      var rows = 7, cols = 7, rh = h / rows, cw = w / cols;
      g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
      for (var r = 0; r < rows; r++) {
        for (var c = -1; c < cols + 1; c++) {
          var shade = 185 + Math.floor(H.rng() * 60);
          g.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
          var x = c * cw + (r % 2) * cw / 2;
          g.beginPath();
          g.arc(x + cw / 2, (r + 1) * rh, cw / 2 - 1, Math.PI, 0);
          g.fill();
          g.fillRect(x + 1, r * rh, cw - 2, rh / 2);
        }
        g.strokeStyle = 'rgba(70,70,70,0.5)';
        g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(0, (r + 1) * rh); g.lineTo(w, (r + 1) * rh); g.stroke();
      }
    });
  };
  H.texStone = function () {
    return H.makeCanvasTexture(256, 256, function (g, w, h) {
      g.fillStyle = '#9c9c9c'; g.fillRect(0, 0, w, h); // 灰缝
      var rows = 4, cols = 4, rh = h / rows;
      for (var r = 0; r < rows; r++) {
        var off = (r % 2) * (w / cols) / 2;
        for (var c = -1; c < cols + 1; c++) {
          var shade = 195 + Math.floor(H.rng() * 40);
          g.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
          g.fillRect(c * (w / cols) + off + 3, r * rh + 3, w / cols - 6, rh - 6);
          // 石面颗粒
          for (var i = 0; i < 22; i++) {
            var v = shade - 25 + Math.floor(H.rng() * 50);
            g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.5)';
            g.fillRect(c * (w / cols) + off + 3 + H.rng() * (w / cols - 6), r * rh + 3 + H.rng() * (rh - 6), 2, 2);
          }
        }
      }
    });
  };
  H.texWood = function () {
    return H.makeCanvasTexture(128, 128, function (g, w, h) {
      g.fillStyle = '#d8c4a0'; g.fillRect(0, 0, w, h);
      var planks = 4, pw = w / planks;
      for (var p = 0; p < planks; p++) {
        var shade = 195 + Math.floor(H.rng() * 45);
        g.fillStyle = 'rgb(' + shade + ',' + Math.floor(shade * 0.88) + ',' + Math.floor(shade * 0.68) + ')';
        g.fillRect(p * pw + 2, 0, pw - 4, h);
        // 木纹
        g.strokeStyle = 'rgba(110,80,50,0.35)';
        g.lineWidth = 1;
        for (var k = 0; k < 7; k++) {
          g.beginPath();
          var x0 = p * pw + 4 + H.rng() * (pw - 8);
          g.moveTo(x0, 0);
          g.bezierCurveTo(x0 + H.rng() * 4 - 2, h * 0.33, x0 + H.rng() * 4 - 2, h * 0.66, x0 + H.rng() * 3 - 1.5, h);
          g.stroke();
        }
      }
      g.fillStyle = 'rgba(90,60,35,0.5)';
      for (var p2 = 0; p2 <= planks; p2++) g.fillRect(p2 * pw - 1, 0, 2, h);
    });
  };
  H.texCobble = function () {
    return H.makeCanvasTexture(256, 256, function (g, w, h) {
      g.fillStyle = '#6f6f6f'; g.fillRect(0, 0, w, h);
      var n = 6, cell = w / n;
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          var shade = 150 + Math.floor(H.rng() * 60);
          g.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
          var cx = c * cell + cell / 2 + (r % 2) * cell / 2;
          g.beginPath();
          g.ellipse(cx, r * cell + cell / 2, cell / 2 - 2.5, cell / 2 - 3, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
  };
  H.texGrass = function () {
    return H.makeCanvasTexture(128, 128, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var v = 216 + Math.floor(H.rng() * 40);
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        g.fillRect(H.rng() * w, H.rng() * h, H.rng() * 1.8 + 0.5, H.rng() * 3.5 + 1);
      }
    });
  };

  // ---------- 材质缓存：同一颜色/参数只创建一次，并按颜色自动附纹理 ----------
  var matCache = {};
  var texByColor = {};
  function autoTexture(hex) {
    if (hex in texByColor) return texByColor[hex];
    var t = null;
    var stone = ['#b7b2a7', '#cfc8bb', '#a5a0a0', '#9a968c', '#9a958f', '#8f8a84', '#b9b4a9', '#aaa599', '#9a968c'];
    var wood = ['#8a5a3b', '#7a5a3e', '#6b4a3a', '#9a7a56', '#a08059', '#b08968', '#8a6a4a', '#5a4636'];
    var walls = ['#f2e7d3', '#f7d9c4', '#cfe8d8', '#dbe7f2', '#f3efe4', '#f6efe2', '#e8dcc6', '#f2ede4'];
    var tiles = ['#c96f4a', '#5b7080', '#4f8a8b', '#a5624a', '#3a3f4a', '#4f7d8a'];
    if (stone.indexOf(hex) >= 0) t = H.texStone();
    else if (wood.indexOf(hex) >= 0) t = H.texWood();
    else if (walls.indexOf(hex) >= 0) t = H.texPlaster();
    else if (tiles.indexOf(hex) >= 0) t = H.texRoof();
    texByColor[hex] = t || null;
    return t;
  }
  H.mat = function (hex, opts) {
    opts = opts || {};
    var key = hex + '|' + JSON.stringify(opts);
    if (matCache[key]) return matCache[key];
    var m = new THREE.MeshStandardMaterial(Object.assign({
      color: hex, roughness: 0.85, metalness: 0.0
    }, opts));
    var tex = autoTexture(hex);
    if (tex && !opts.map && !opts.emissiveMap) {
      m.map = tex;
      m.roughness = 0.92;
    }
    matCache[key] = m;
    return m;
  };

  // 局部坐标 -> 世界坐标（仅绕 Y 旋转的分组使用）
  H.worldPos = function (group, lx, ly, lz) {
    var v = new THREE.Vector3(lx, ly, lz);
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
    return v.add(group.position);
  };

  // 圆角矩形 canvas 贴图（用于招牌文字等）
  H.makeCanvasTexture = function (w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };

  // 店铺招牌贴图（中文字）
  H.signTexture = function (text, bg, fg) {
    return H.makeCanvasTexture(256, 72, function (g, w, h) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = fg;
      g.font = 'bold 40px "PingFang SC","Microsoft YaHei",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2);
    });
  };

  // 条纹贴图（遮阳篷）
  H.stripesTexture = function (c1, c2, n) {
    return H.makeCanvasTexture(128, 64, function (g, w, h) {
      var sw = w / n;
      for (var i = 0; i < n; i++) {
        g.fillStyle = (i % 2 === 0) ? c1 : c2;
        g.fillRect(i * sw, 0, sw + 1, h);
      }
    });
  };

  // 径向渐变光晕贴图（太阳/月亮/灯光）
  H.glowTexture = function (inner, outer) {
    return H.makeCanvasTexture(128, 128, function (g, w, h) {
      var r = w / 2;
      var gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, inner);
      gr.addColorStop(0.35, outer);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  };

  // 软阴影贴图（接触阴影）
  var shadowTexCache = null;
  H.shadowTexture = function () {
    if (shadowTexCache) return shadowTexCache;
    shadowTexCache = H.makeCanvasTexture(128, 128, function (g, w, h) {
      var r = w / 2;
      var gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.5)');
      gr.addColorStop(0.6, 'rgba(0,0,0,0.22)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    return shadowTexCache;
  };

  // 接触阴影圆盘（让物体“落地”）
  H.addShadowDisc = function (scene, x, z, r, opacity) {
    var m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({
        map: H.shadowTexture(), transparent: true, opacity: opacity || 0.4, depthWrite: false
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, H.groundHeight(x, z) + 0.035, z);
    scene.add(m);
    return m;
  };

  // 建筑地基：采样四角+中心的地形高差（供自适应石基使用）
  H.baseInfo = function (x, z, w, d, ry) {
    ry = ry || 0;
    var cos = Math.cos(ry), sin = Math.sin(ry);
    var corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    var mn = H.groundHeight(x, z), mx = mn, i;
    for (i = 0; i < corners.length; i++) {
      var wx = x + corners[i][0] * cos + corners[i][1] * sin;
      var wz = z - corners[i][0] * sin + corners[i][1] * cos;
      var h = H.groundHeight(wx, wz);
      if (h < mn) mn = h;
      if (h > mx) mx = h;
    }
    return { min: mn, max: mx };
  };
})();
