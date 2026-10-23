/* 光湾市 — colour scripts for three hours.
   Every visual value is a number or a #rrggbb colour so the whole city can
   dissolve smoothly from one hour into the next. */
(function () {
  "use strict";

  const morning = {
    skyTop: "#5c82a7", skyUpper: "#849eb2", skyMid: "#b7c3c2",
    skyLow: "#e9c6af", skyHorizon: "#ffe0b0",
    sunX: 174, sunY: 122, sunR: 22,
    sunColor: "#fff6ce", sunGlow: "#ffd18a", moonness: 0, starAlpha: 0,
    haze: "#e6d6c3", mistAlpha: 0.15,
    cloudLight: "#f7eadb", cloudMid: "#ddd5cf", cloudDark: "#bcc0c4",
    far: "#9eacb5", farDark: "#899ba9", farLit: "#cfd0c4", farAlpha: 0.55,
    oldWall: "#b8957e", oldWallLit: "#ddb797", oldWallDark: "#896c63",
    oldRoof: "#8e5c51", oldRoofLit: "#c67d67", oldTrim: "#675950",
    modern: "#7e94a7", modernLit: "#b6c2c7", modernDark: "#627a8f", glass: "#9ab6bd",
    windowOff: "#536679", windowWarm: "#ffe0a0", windowCool: "#c7e5e6",
    windowPink: "#f7bda8", litFrac: 0.10,
    bridge: "#9b8f86", bridgeDark: "#6e6662", bridgeLight: "#d0bda6", bridgeTrim: "#5b5755",
    lamp: "#ffdd9e", lampGlow: "#ffd78e", lampAlpha: 0.34,
    waterTop: "#7e9daa", waterMid: "#8eabb0", waterBottom: "#c8b19a",
    waterDeep: "#5b8190", glint: "#ffe2ae", waterLine: "#dde8df",
    reflectAlpha: 0.25, rippleAlpha: 0.32,
    quay: "#a79788", quayLight: "#c8b8a3", quayDark: "#7c716a",
    quayJoint: "#665f5b", pavingAlt: "#9e9084", puddle: "#9db9bd",
    treeDark: "#3c5b4e", treeMid: "#5c7d59", treeLight: "#92a26d",
    treeHi: "#ddc57a", trunk: "#5a4039", trunkLight: "#8a6655", leafLitter: "#b57c57",
    neonAlpha: 0, neon1: "#e6a36f", neon2: "#9ed6d4", neon3: "#f2cd8d", signInk: "#493d3b",
    birdAlpha: 0.52, lightDir: -1, shadowColor: "#34495b", shadowAlpha: 0.18,
    bokeh1: "#ffe5b0", bokeh2: "#c8e3e4", bokeh3: "#f6c8ad", bokehAlpha: 0.23,
    gradeColor: "#ffd6a6", gradeAlpha: 0.075, fillColor: "#a5ccd1", fillAlpha: 0.10,
    windowGlowAlpha: 0.28, streetGlowAlpha: 0.12
  };

  const dusk = {
    skyTop: "#2c3058", skyUpper: "#5f4d70", skyMid: "#a45f77",
    skyLow: "#ed8b68", skyHorizon: "#ffca79",
    sunX: 736, sunY: 205, sunR: 30,
    sunColor: "#ffe3a3", sunGlow: "#ff9d63", moonness: 0, starAlpha: 0.08,
    haze: "#a5777c", mistAlpha: 0.10,
    cloudLight: "#f8b58c", cloudMid: "#bf7583", cloudDark: "#70546c",
    far: "#786477", farDark: "#5b4d66", farLit: "#cf937d", farAlpha: 0.64,
    oldWall: "#8e5e5d", oldWallLit: "#c67f6e", oldWallDark: "#5f434f",
    oldRoof: "#5a3446", oldRoofLit: "#a3545b", oldTrim: "#3f303a",
    modern: "#4e4c67", modernLit: "#967678", modernDark: "#393953", glass: "#826a78",
    windowOff: "#3f3c54", windowWarm: "#ffd48a", windowCool: "#f5aa8c",
    windowPink: "#ff92a3", litFrac: 0.42,
    bridge: "#7b6669", bridgeDark: "#51434b", bridgeLight: "#b28c77", bridgeTrim: "#3e333d",
    lamp: "#ffd18c", lampGlow: "#ffb066", lampAlpha: 0.68,
    waterTop: "#635b78", waterMid: "#896879", waterBottom: "#c4856c",
    waterDeep: "#403e5b", glint: "#ffd080", waterLine: "#e9ae8c",
    reflectAlpha: 0.39, rippleAlpha: 0.40,
    quay: "#806b62", quayLight: "#ae8d77", quayDark: "#594b4a",
    quayJoint: "#453b3f", pavingAlt: "#77635d", puddle: "#9c7879",
    treeDark: "#303f3f", treeMid: "#4c5544", treeLight: "#837145",
    treeHi: "#dba55e", trunk: "#4a3433", trunkLight: "#785044", leafLitter: "#b16849",
    neonAlpha: 0.62, neon1: "#ffb66b", neon2: "#f67f9b", neon3: "#ffd88f", signInk: "#ffcb8a",
    birdAlpha: 0.26, lightDir: 1, shadowColor: "#422e3a", shadowAlpha: 0.22,
    bokeh1: "#ffc077", bokeh2: "#fa90a3", bokeh3: "#c89cb4", bokehAlpha: 0.30,
    gradeColor: "#ff9e68", gradeAlpha: 0.13, fillColor: "#6c628f", fillAlpha: 0.12,
    windowGlowAlpha: 0.55, streetGlowAlpha: 0.34
  };

  const night = {
    skyTop: "#040b1d", skyUpper: "#081a33", skyMid: "#0d2942",
    skyLow: "#123c4e", skyHorizon: "#245a60",
    sunX: 764, sunY: 98, sunR: 18,
    sunColor: "#eef8ff", sunGlow: "#6db6dd", moonness: 1, starAlpha: 0.92,
    haze: "#142f42", mistAlpha: 0.07,
    cloudLight: "#263f50", cloudMid: "#192e40", cloudDark: "#0d2033",
    far: "#172b3c", farDark: "#0c1e2d", farLit: "#315b64", farAlpha: 0.86,
    oldWall: "#31323f", oldWallLit: "#4c4950", oldWallDark: "#1d2430",
    oldRoof: "#1d2430", oldRoofLit: "#403b45", oldTrim: "#0f1820",
    modern: "#102130", modernLit: "#1f3946", modernDark: "#091722", glass: "#173a47",
    windowOff: "#0b1923", windowWarm: "#ffcf7d", windowCool: "#65e7ee",
    windowPink: "#ff70b7", litFrac: 0.66,
    bridge: "#2c3a41", bridgeDark: "#131f27", bridgeLight: "#54645f", bridgeTrim: "#0e191f",
    lamp: "#ffd277", lampGlow: "#ffb64e", lampAlpha: 0.96,
    waterTop: "#071c2a", waterMid: "#0b2b39", waterBottom: "#123b41",
    waterDeep: "#03111c", glint: "#7ce4dc", waterLine: "#347681",
    reflectAlpha: 0.54, rippleAlpha: 0.46,
    quay: "#23353a", quayLight: "#405252", quayDark: "#14262c",
    quayJoint: "#0c1a1f", pavingAlt: "#203238", puddle: "#184851",
    treeDark: "#102c2a", treeMid: "#1c4137", treeLight: "#315a4a",
    treeHi: "#7db79f", trunk: "#182626", trunkLight: "#394542", leafLitter: "#745c44",
    neonAlpha: 1, neon1: "#66f0e6", neon2: "#ff70bd", neon3: "#ffd36d", signInk: "#d9fff9",
    birdAlpha: 0, lightDir: 1, shadowColor: "#020b10", shadowAlpha: 0.24,
    bokeh1: "#73e9e2", bokeh2: "#ff7fc7", bokeh3: "#ffd477", bokehAlpha: 0.39,
    gradeColor: "#123848", gradeAlpha: 0.10, fillColor: "#20506a", fillAlpha: 0.10,
    windowGlowAlpha: 0.82, streetGlowAlpha: 0.72
  };

  const MODES = {
    morning: {
      label: "清晨", en: "MORNING TIDE", time: "06:18", temp: "18°",
      wind: "2.1", mood: "晨雾未散",
      keyLight: "晨日 · 东南偏东", fillLight: "海面反射 · 冷",
      track: "晨光序曲", trackEn: "MORNING TIDE",
      toast: "清晨 · 潮声与第一班渡轮", note: "MORNING · 06:18"
    },
    dusk: {
      label: "黄昏", en: "GOLDEN HOUR", time: "18:42", temp: "21°",
      wind: "3.4", mood: "晚风正暖",
      keyLight: "落日 · 西偏南", fillLight: "橱窗灯火 · 暖",
      track: "落日情书", trackEn: "A LETTER AT DUSK",
      toast: "黄昏 · 落日把海面写成金色", note: "GOLDEN HOUR · 18:42"
    },
    night: {
      label: "夜景", en: "AFTERGLOW", time: "22:16", temp: "16°",
      wind: "1.8", mood: "霓虹未眠",
      keyLight: "月光 · 西南高空", fillLight: "霓虹与窗火 · 青粉",
      track: "霓虹脉冲", trackEn: "NEON PULSE",
      toast: "夜景 · 潮汐与合成器一同亮起", note: "AFTERGLOW · 22:16"
    }
  };

  const PALETTES = { morning, dusk, night };

  function lerp(a, b, t) { return a + (b - a) * t; }

  function hexToRgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function lerpColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const r = Math.round(lerp(ca[0], cb[0], t));
    const g = Math.round(lerp(ca[1], cb[1], t));
    const bl = Math.round(lerp(ca[2], cb[2], t));
    return "#" + [r, g, bl].map(function (v) { return v.toString(16).padStart(2, "0"); }).join("");
  }

  function blendPalettes(a, b, t) {
    const out = {};
    for (const key in a) {
      const va = a[key];
      const vb = b[key] !== undefined ? b[key] : va;
      if (typeof va === "number" && typeof vb === "number") out[key] = lerp(va, vb, t);
      else if (typeof va === "string" && va.charAt(0) === "#" && typeof vb === "string") out[key] = lerpColor(va, vb, t);
      else if (Array.isArray(va)) {
        out[key] = va.map(function (v, i) { return typeof v === "number" ? lerp(v, vb[i], t) : lerpColor(v, vb[i], t); });
      } else out[key] = t < 0.5 ? va : vb;
    }
    return out;
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + alpha + ")";
  }

  function shade(hex, amount) {
    const c = hexToRgb(hex);
    const target = amount < 0 ? 0 : 255;
    const k = Math.abs(amount);
    return "#" + c.map(function (v) {
      return Math.round(lerp(v, target, k)).toString(16).padStart(2, "0");
    }).join("");
  }

  window.Lumen = window.Lumen || {};
  window.Lumen.PALETTES = PALETTES;
  window.Lumen.MODES = MODES;
  window.Lumen.blendPalettes = blendPalettes;
  window.Lumen.rgba = rgba;
  window.Lumen.shade = shade;
  window.Lumen.hexToRgb = hexToRgb;
  window.Lumen.ease = function (t) { return t * t * (3 - 2 * t); };
  window.Lumen.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
})();
