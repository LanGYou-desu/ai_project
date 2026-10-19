/* ============================================================
 * 雨夜便利店 · js/dynamics.js
 * 动效：招牌/霓虹闪烁、自动门开合（含灯光外溢）、雨中雨势起伏、
 * 远处信号灯循环、店内灯轻微闪动、关东煮蒸汽、湿地面反光轻微呼吸
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R;

  R.setupDynamics = function () {
    R.dyn = {
      t: 0,
      sign: { value: 1, target: 1, dipT: 0, nextDip: 6 },
      neon: { value: 1, nextDip: 3 },
      door: { state: 'closed', timer: 5, open: 0, target: 0, cycles: 0 },
      traffic: { state: 0, timer: 9 },
      interior: 1,
      intensity: 1,
      film: 1
    };
    // 门口的暖光溢出（可动画材质）
    var spillMat = new THREE.MeshBasicMaterial({
      color: 0xffcf9a, map: R.glowTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.3)'),
      transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var spill = new THREE.Mesh(R.planeGeo(2, 2), spillMat);
    spill.rotation.x = -Math.PI / 2;
    spill.scale.set(2.6, 2.6, 1);
    spill.position.set(-2.6, 0.142, -0.1);
    R.scene.add(spill);
    R.dyn.spillMat = spillMat;
    // 店门口地面上的一小块亮斑（随门开合变化）
    R.dyn.doorSpillBase = 0.3;
    return R.dyn;
  };

  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  R.updateDynamics = function (dt, t) {
    var d = R.dyn;
    if (!d) return;
    d.t += dt;

    /* ---- 雨势起伏（整体强度缓慢波动） ---- */
    var swell = 0.82 + 0.18 * R.noise2(t * 0.11, 3.7);
    d.intensity = R.lerp(d.intensity, swell, 1 - Math.exp(-dt * 0.8));
    if (R.rain) {
      R.rain.streaks.mat.uniforms.uAlpha.value = 0.42 * d.intensity;
      R.rain.filmMat.uniforms.uIntensity.value = d.intensity;
      for (var ri = 0; ri < R.rain.rivuletMats.length; ri++) {
        R.rain.rivuletMats[ri].uniforms.uOpacity.value = 0.5 * (0.7 + 0.5 * d.intensity);
      }
    }

    /* ---- 招牌灯箱闪烁：平时稳定，偶尔快速抖两下 ---- */
    var s = d.sign;
    s.nextDip -= dt;
    if (s.nextDip <= 0 && s.dipT <= 0) {
      s.dipT = R.rand(0.18, 0.5);
      s.nextDip = R.rand(6, 22);
    }
    if (s.dipT > 0) {
      s.dipT -= dt;
      s.value = 0.55 + 0.45 * Math.abs(Math.sin(d.t * 42));
    } else {
      s.value = R.lerp(s.value, 0.97 + 0.03 * Math.sin(d.t * 1.7), 1 - Math.exp(-dt * 6));
    }
    if (R.signMat) {
      var v = s.value;
      R.signMat.color.setRGB(v, v, v * (0.985 + 0.015 * v));
    }
    if (R.signGlowMat) R.signGlowMat.opacity = 0.1 + 0.09 * s.value;

    /* ---- 竖排霓虹：更不稳定的老灯管 ---- */
    var n = d.neon;
    n.nextDip -= dt;
    var nv = 1;
    if (n.nextDip <= 0) {
      var r = R.rng();
      nv = r < 0.35 ? 0.25 : (r < 0.6 ? 0.6 : 1.0);
      n.nextDip = R.rand(0.6, 4.5);
    } else {
      nv = 1;
    }
    n.value = R.lerp(n.value, nv, 1 - Math.exp(-dt * (nv < 1 ? 26 : 8)));
    if (R.neon && R.neon.mat) {
      var c = n.value;
      R.neon.mat.color.setRGB(0.55 + 0.45 * c, 0.42 + 0.58 * c, 0.55 + 0.45 * c);
      if (R.neon.halo) R.neon.halo.material.opacity = 0.1 + 0.22 * c;
    }
    if (R.props && R.props.glows.neon) R.props.glows.neon.material.opacity = 0.16 * (0.35 + 0.65 * n.value);

    /* ---- 自动门：偶尔开合 ---- */
    var dr = d.door;
    dr.timer -= dt;
    if (dr.state === 'closed' && dr.timer <= 0) {
      dr.state = 'opening';
      dr.timer = 0.95;
      dr.cycles++;
    } else if (dr.state === 'opening') {
      dr.target = 1;
      if (dr.timer <= 0) { dr.state = 'open'; dr.timer = 3.2; }
    } else if (dr.state === 'open') {
      if (dr.timer <= 0) { dr.state = 'closing'; dr.timer = 1.25; }
    } else if (dr.state === 'closing') {
      dr.target = 0;
      if (dr.timer <= 0) { dr.state = 'closed'; dr.timer = R.rand(6, 15); }
    }
    var k = 1 - Math.exp(-dt * (dr.state === 'opening' ? 6.5 : 4.2));
    dr.open = R.lerp(dr.open, dr.target, k);
    if (R.store && R.store.door) {
      var panels = R.store.door.panels;
      var e = easeInOut(R.clamp(dr.open, 0, 1));
      panels[0].g.position.x = -e * 1.31;
      panels[1].g.position.x = e * 1.31;
    }
    // 门缝灯光外溢
    var spillTarget = 0.3 + 0.75 * easeInOut(R.clamp(dr.open, 0, 1));
    d.spillMat.opacity = R.lerp(d.spillMat.opacity, spillTarget * 0.6, 1 - Math.exp(-dt * 4));
    if (R.lights && R.lights.doorSpill) {
      R.lights.doorSpill.intensity = R.lerp(R.lights.doorSpill.intensity, 0.85 + 1.5 * dr.open, 1 - Math.exp(-dt * 5));
    }
    // 传感器 LED：门开时更亮（模拟感应闪烁）
    if (R.doorLed) {
      var led = dr.state === 'closed' ? (Math.sin(d.t * 2.1) > 0.6 ? 0.9 : 0.35) : 1.0;
      R.doorLed.material.color.setRGB(0.5 * led, 0.8 * led, 1.0 * led);
    }

    /* ---- 远处信号灯循环：绿 8s → 黄 2.4s → 红 9.5s ---- */
    var tr = d.traffic, tf = R.traffic;
    if (tf) {
      tr.timer -= dt;
      if (tr.timer <= 0) {
        tr.state = (tr.state + 1) % 3;
        tr.timer = tr.state === 0 ? 8.0 : (tr.state === 1 ? 2.4 : 9.5);
      }
      var names = ['green', 'yellow', 'red'];
      for (var li = 0; li < 3; li++) {
        var name = names[li];
        var on = (name === names[tr.state]);
        var lamp = tf.lamps[name];
        var target = new THREE.Color(on ? tf.base[name] : tf.dim[name]);
        lamp.mesh.material.color.lerp(target, 1 - Math.exp(-dt * 8));
        if (lamp.halo) lamp.halo.material.opacity = on ? 0.5 : 0.06;
      }
      var activeName = names[tr.state];
      var dc = new THREE.Color(tf.base[activeName]);
      tf.decal.material.color.lerp(dc, 1 - Math.exp(-dt * 3));
      tf.decal.material.opacity = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(d.t * 1.3)) + (activeName === 'green' ? 0.06 : 0);
    }

    /* ---- 店内荧光灯轻微闪动 ---- */
    if (R.lights && R.lights.interior) {
      var fl = 1 + 0.035 * Math.sin(d.t * 12.3) * (R.noise2(d.t * 0.7, 8.1) > 0.72 ? 1 : 0.25);
      d.interior = R.lerp(d.interior, fl, 1 - Math.exp(-dt * 10));
      for (var ii = 0; ii < R.lights.interior.length; ii++) {
        R.lights.interior[ii].intensity = R.lights.interior[ii].baseIntensity * d.interior;
      }
    }

    /* ---- 关东煮蒸汽 ---- */
    if (R.steam) {
      for (var si = 0; si < R.steam.length; si++) {
        var st = R.steam[si];
        var ph = (d.t * 0.42 + st.phase) % 1;
        st.spr.position.y = st.y0 + ph * 0.7;
        st.spr.position.x = st.x + Math.sin(ph * 6.0 + st.phase) * 0.05;
        st.spr.position.z = st.z + Math.cos(ph * 5.0 + st.phase) * 0.04;
        st.spr.material.opacity = 0.2 * Math.sin(ph * Math.PI);
        var sc = 0.24 + ph * 0.3;
        st.spr.scale.set(sc, sc, 1);
      }
    }

    /* ---- 湿地面反光：轻微呼吸（更像水膜在动） ---- */
    var g = R.props && R.props.glows;
    if (g) {
      var breathe = 0.9 + 0.1 * Math.sin(d.t * 0.9);
      if (g.lamp) g.lamp.material.opacity = 0.34 * breathe;
      if (g.vending) g.vending.material.opacity = 0.2 * (0.85 + 0.15 * Math.sin(d.t * 1.7));
      if (g.alley) g.alley.material.opacity = 0.24 * (0.9 + 0.1 * Math.sin(d.t * 1.1));
    }
    var rg = R.glows;
    if (rg) {
      if (rg.doorSpillMat) rg.doorSpillMat.opacity = 0.3 + 0.06 * Math.sin(d.t * 1.3);
    }
  };
})();
