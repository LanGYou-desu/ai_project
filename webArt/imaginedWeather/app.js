/* =========================================================
   臆候局 / interface, archive, generation and export
   ========================================================= */

(function () {
  "use strict";

  const DATA = window.YHJ_DATA;
  const FAMILIES = DATA.FAMILIES;
  const RANDOM_FEELINGS = DATA.RANDOM_FEELINGS;
  const INFERENCE = DATA.INFERENCE;

  const ARCHIVE_KEY = "yhj.archive.v2";
  const SEQUENCE_KEY = "yhj.sequence.v2";
  const CURRENT_KEY = "yhj.current.v2";
  const MAX_ARCHIVE = 24;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const pad = (value, length) => String(value).padStart(length === undefined ? 2 : length, "0");

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function random() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rand(rng, min, max) {
    return min + rng() * (max - min);
  }

  function round(value, precision) {
    return Number(value.toFixed(precision === undefined ? 1 : precision));
  }

  function channels(hex) {
    return window.YHJ.channels(hex);
  }

  function colorAlpha(hex, alpha) {
    const parts = channels(hex).split(",").map((part) => part.trim());
    return "rgba(" + parts.join(", ") + ", " + alpha + ")";
  }

  function formatTemperature(value) {
    const number = Number(value);
    return (number < 0 ? "−" : "") + Math.abs(number).toFixed(1);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
  }

  function formatShortDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return pad(date.getMonth() + 1) + "." + pad(date.getDate());
  }

  function inferFamily(text) {
    if (!text) return null;
    const scores = new Map();
    for (const rule of INFERENCE) {
      let score = 0;
      for (const word of rule.words) {
        if (text.includes(word)) score += word.length + 1;
      }
      if (score > 0) scores.set(rule.family, score);
    }
    if (!scores.size) return null;
    return Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  function makeReadings(rng, ranges) {
    return {
      temp: round(rand(rng, ranges.temp[0], ranges.temp[1]), 1),
      humidity: Math.round(rand(rng, ranges.humidity[0], ranges.humidity[1])),
      pressure: Math.round(rand(rng, ranges.pressure[0], ranges.pressure[1])),
      visibility: round(rand(rng, ranges.visibility[0], ranges.visibility[1]), 1)
    };
  }

  function makeCoordinate(rng) {
    const latDeg = Math.floor(rand(rng, 8, 64));
    const latMin = Math.floor(rand(rng, 0, 60));
    const lonDeg = Math.floor(rand(rng, 4, 144));
    const lonMin = Math.floor(rand(rng, 0, 60));
    return pad(latDeg) + "°" + pad(latMin) + "′N / " + pad(lonDeg) + "°" + pad(lonMin) + "′E";
  }

  function buildSpec(options) {
    const family = FAMILIES[options.familyKey] || FAMILIES.fog;
    const seed = hashString(String(options.seedKey));
    const rng = mulberry32(seed);
    const nameIndex = options.nameIndex === undefined || options.nameIndex === null
      ? Math.floor(rng() * family.names.length)
      : options.nameIndex;
    const paletteIndex = options.paletteIndex === undefined || options.paletteIndex === null
      ? Math.floor(rng() * family.palettes.length)
      : options.paletteIndex;
    const descriptionIndex = options.descriptionIndex === undefined || options.descriptionIndex === null
      ? Math.floor(rng() * family.descriptions.length)
      : options.descriptionIndex;
    const sensationIndex = options.sensationIndex === undefined || options.sensationIndex === null
      ? Math.floor(rng() * family.sensations.length)
      : options.sensationIndex;
    const name = family.names[nameIndex] || family.names[0];
    const palette = family.palettes[paletteIndex] || family.palettes[0];
    const condition = family.conditions[Math.floor(rng() * family.conditions.length)];
    const duration = family.durations[Math.floor(rng() * family.durations.length)];

    return {
      id: "yhj-" + seed.toString(36) + "-" + options.no,
      no: options.no,
      input: String(options.input || "一段没有名字的感受").slice(0, 80),
      familyKey: options.familyKey,
      familyLabel: family.label,
      titleA: name.a,
      titleB: name.b,
      enName: name.en,
      description: family.descriptions[descriptionIndex] || family.descriptions[0],
      sensation: family.sensations[sensationIndex] || family.sensations[0],
      condition: condition,
      duration: duration,
      readings: makeReadings(rng, family.readings),
      coordinate: makeCoordinate(rng),
      seed: seed,
      createdAt: new Date(options.createdAt || Date.now()).toISOString(),
      palette: palette
    };
  }

  const DEFAULT_SPEC = {
    id: "yhj-specimen-0001",
    no: 1,
    input: "一个还没有结束的下午",
    familyKey: "fog",
    familyLabel: "低云",
    titleA: "琥珀色",
    titleB: "低云",
    enName: "AMBER STRATUS",
    description: "一阵低低地悬在窗沿上方一米处的暖雾。它不带来雨，只让所有声音变软，像一层被太阳晒暖的旧绒布。预计在有人想起你时缓慢散开。",
    sensation: "像一条晒过太阳的旧毛毯",
    condition: "低云 · 暖雾",
    duration: "至有人先开口",
    readings: { temp: 22.4, humidity: 67, pressure: 1012, visibility: 0.8 },
    coordinate: "31°14′N / 121°29′E",
    seed: 190861,
    createdAt: new Date().toISOString(),
    palette: FAMILIES.fog.palettes[0]
  };

  const storage = {
    get(key) {
      try { return window.localStorage.getItem(key); }
      catch (error) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); return true; }
      catch (error) { return false; }
    }
  };

  function isValidSpec(spec) {
    return Boolean(
      spec &&
      typeof spec === "object" &&
      spec.titleA &&
      spec.titleB &&
      spec.familyKey &&
      FAMILIES[spec.familyKey] &&
      spec.readings &&
      spec.palette
    );
  }

  function seedArchive() {
    const now = Date.now();
    const entries = [
      { input: "没说出口的再见", familyKey: "rain", no: 2, seedKey: "archive-rain-02", age: 1000 * 60 * 60 * 24 * 5 },
      { input: "去年冬天", familyKey: "snow", no: 3, seedKey: "archive-snow-03", age: 1000 * 60 * 60 * 24 * 2 },
      { input: "无人接听的电话", familyKey: "storm", no: 4, seedKey: "archive-storm-04", age: 1000 * 60 * 42 }
    ];
    const currentObservation = Object.assign({}, DEFAULT_SPEC, {
      createdAt: new Date(now - 1000 * 60 * 18).toISOString()
    });
    return [currentObservation].concat(entries.map((entry) => buildSpec({
      input: entry.input,
      familyKey: entry.familyKey,
      no: entry.no,
      seedKey: entry.seedKey,
      createdAt: new Date(now - entry.age)
    }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function saveArchive(archive) {
    storage.set(ARCHIVE_KEY, JSON.stringify(archive.slice(0, MAX_ARCHIVE)));
  }

  function loadArchive() {
    const raw = storage.get(ARCHIVE_KEY);
    if (raw === null) {
      const seeded = seedArchive();
      saveArchive(seeded);
      storage.set(SEQUENCE_KEY, "5");
      return seeded;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Invalid archive");
      return parsed.filter(isValidSpec).slice(0, MAX_ARCHIVE);
    } catch (error) {
      const seeded = seedArchive();
      saveArchive(seeded);
      return seeded;
    }
  }

  function loadCurrent() {
    const raw = storage.get(CURRENT_KEY);
    if (!raw) return DEFAULT_SPEC;
    try {
      const parsed = JSON.parse(raw);
      if (!isValidSpec(parsed)) return DEFAULT_SPEC;
      if (!parsed.palette) parsed.palette = FAMILIES[parsed.familyKey].palettes[0];
      return parsed;
    } catch (error) {
      return DEFAULT_SPEC;
    }
  }

  function loadSequence(archive, current) {
    const raw = Number.parseInt(storage.get(SEQUENCE_KEY) || "", 10);
    const maxNo = Math.max(1, ...archive.map((spec) => Number(spec.no) || 0), Number(current && current.no) || 0);
    if (Number.isFinite(raw) && raw > maxNo) return raw;
    return maxNo + 1;
  }

  const state = {
    current: null,
    archive: [],
    sequence: 5,
    busy: false,
    soundOn: false
  };

  const dom = {
    root: document.documentElement,
    specimen: $(".specimen"),
    weatherTitle: $("#weather-title"),
    titleA: $("#title-a"),
    titleB: $("#title-b"),
    titleMark: $("#title-mark"),
    weatherEn: $("#weather-en"),
    description: $("#weather-description"),
    source: $("#weather-source"),
    sensation: $("#weather-sensation"),
    number: $("#specimen-number"),
    stageNumber: $("#backdrop-index"),
    windowNumber: $("#window-number"),
    coordinate: $("#backdrop-coordinate"),
    condition: $("#arch-condition"),
    archTemperature: $("#arch-temperature"),
    duration: $("#arch-duration"),
    canvas: $("#weather-canvas"),
    archShell: $("#arch-shell"),
    clock: $("#clock"),
    canvasClock: $("#canvas-clock"),
    form: $("#weather-form"),
    input: $("#feeling-input"),
    inputCount: $("#input-count"),
    castButton: $("#cast-button"),
    castText: $("#cast-text"),
    randomButton: $("#random-button"),
    exportButton: $("#export-button"),
    soundButton: $("#sound-button"),
    soundValue: $("#sound-value"),
    archiveButton: $("#archive-button"),
    archiveCount: $("#archive-count"),
    archiveOverlay: $("#archive-overlay"),
    archiveGrid: $("#archive-grid"),
    archiveFootnote: $("#archive-footnote"),
    closeArchive: $("#close-archive"),
    clearArchive: $("#clear-archive"),
    toast: $("#toast"),
    readings: {
      temp: $("#reading-temp"),
      humidity: $("#reading-humidity"),
      pressure: $("#reading-pressure"),
      visibility: $("#reading-visibility")
    }
  };

  const weatherSound = new window.YHJ.WeatherSound();
  const weatherWindow = new window.YHJ.WeatherWindow(dom.canvas, function (spec) {
    if (spec) weatherSound.chime(spec);
  });

  // -------------------------------------------------------
  // Rendering
  // -------------------------------------------------------

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function animateReadings(readings) {
    const entries = [
      { element: dom.readings.temp, target: Number(readings.temp), decimals: 1, negative: Number(readings.temp) < 0 },
      { element: dom.readings.humidity, target: Number(readings.humidity), decimals: 0, negative: false },
      { element: dom.readings.pressure, target: Number(readings.pressure), decimals: 0, negative: false },
      { element: dom.readings.visibility, target: Number(readings.visibility), decimals: 1, negative: false }
    ];
    for (const entry of entries) {
      if (!entry.element) continue;
      if (REDUCED_MOTION) {
        entry.element.textContent = (entry.negative ? "−" : "") + Math.abs(entry.target).toFixed(entry.decimals);
        continue;
      }
      const previous = Number.parseFloat(entry.element.textContent.replace("−", "-"));
      const start = Number.isFinite(previous) ? previous : 0;
      const startTime = performance.now();
      const duration = 620;
      const tick = (now) => {
        const progress = clamp((now - startTime) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = start + (entry.target - start) * eased;
        entry.element.textContent = (entry.negative ? "−" : "") + Math.abs(value).toFixed(entry.decimals);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  function durationLabel(value) {
    if (/^(至|约|短于|直至)/.test(value)) return "持续" + value;
    return value;
  }

  function applyPagePalette(spec) {
    if (!spec.palette) return;
    dom.root.style.setProperty("--stage-glow", channels(spec.palette.glow));
    dom.root.style.setProperty("--stage-soft", channels(spec.palette.soft));
  }

  function updateSpecimenView(spec) {
    if (!spec) return;
    setText(dom.titleA, spec.titleA);
    setText(dom.titleB, spec.titleB);
    setText(dom.weatherEn, spec.enName);
    setText(dom.description, spec.description);
    setText(dom.source, spec.input);
    setText(dom.sensation, spec.sensation);
    setText(dom.number, "NO. " + pad(spec.no, 4));
    setText(dom.stageNumber, pad(spec.no, 3));
    setText(dom.windowNumber, pad(spec.no % 100, 2));
    setText(dom.titleMark, pad(spec.no % 100, 2));
    setText(dom.condition, spec.condition);
    setText(dom.archTemperature, "AIR " + formatTemperature(spec.readings.temp) + "°C");
    setText(dom.duration, durationLabel(spec.duration));
    setText(dom.coordinate, spec.coordinate);
    setText(dom.canvasClock, getClockTime());

    const longTitle = Array.from(spec.titleA).length > 4 || Array.from(spec.titleB).length > 4;
    dom.weatherTitle.classList.toggle("is-long", longTitle);

    const accessibleTitle = spec.titleA + spec.titleB + "，" + spec.condition;
    dom.weatherTitle.setAttribute("aria-label", accessibleTitle);
    dom.canvas.setAttribute("aria-label", "臆象天气观测窗：" + accessibleTitle + "。" + spec.description);

    dom.weatherTitle.classList.remove("is-arriving");
    void dom.weatherTitle.offsetWidth;
    dom.weatherTitle.classList.add("is-arriving");

    animateReadings(spec.readings);
    applyPagePalette(spec);
    weatherWindow.setSpecimen(spec);
    weatherSound.updateSpec(spec);
    document.title = spec.titleA + spec.titleB + " · 臆候局";

    storage.set(CURRENT_KEY, JSON.stringify(spec));
    state.current = spec;
  }

  function createArchiveCard(spec) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "archive-card";
    card.dataset.specId = spec.id;
    if (state.current && spec.id === state.current.id) card.classList.add("is-current");
    card.setAttribute("aria-label", "调取天气：" + spec.titleA + spec.titleB + "，第 " + spec.no + " 号");

    const rng = mulberry32((spec.seed || 1) ^ 0x1a2b3c);
    const orbX = 38 + Math.round(rng() * 36);
    const orbY = 26 + Math.round(rng() * 24);
    const palette = spec.palette || FAMILIES[spec.familyKey].palettes[0];

    const art = document.createElement("span");
    art.className = "archive-art";
    art.dataset.family = spec.familyKey;
    art.style.background = "linear-gradient(158deg, " + palette.bg + ", " + palette.deep + ")";
    art.style.setProperty("--orb-glow", channels(palette.glow));
    art.style.setProperty("--orb-soft", channels(palette.soft));
    art.style.setProperty("--orb-x", orbX + "%");
    art.style.setProperty("--orb-y", orbY + "%");

    const veil = document.createElement("span");
    veil.className = "mini-veil";
    const miniWeather = document.createElement("span");
    miniWeather.className = "mini-weather";
    const miniArch = document.createElement("span");
    miniArch.className = "mini-arch";
    const miniNo = document.createElement("span");
    miniNo.className = "mini-no";
    miniNo.textContent = "NO. " + pad(spec.no, 4);
    const miniStamp = document.createElement("span");
    miniStamp.className = "mini-stamp";
    miniStamp.textContent = "臆";
    art.append(veil, miniWeather, miniArch, miniNo, miniStamp);

    const meta = document.createElement("span");
    meta.className = "archive-card-meta";
    const topLine = document.createElement("span");
    topLine.className = "archive-card-topline";
    const left = document.createElement("span");
    left.textContent = (spec.familyLabel || FAMILIES[spec.familyKey].label) + " · " + formatShortDate(spec.createdAt);
    const right = document.createElement("span");
    right.textContent = state.current && spec.id === state.current.id ? "CURRENT" : "ARCHIVED";
    topLine.append(left, right);

    const title = document.createElement("span");
    title.className = "archive-card-title";
    const titleText = document.createElement("span");
    titleText.textContent = spec.titleA + spec.titleB;
    const english = document.createElement("em");
    english.textContent = spec.enName;
    title.append(titleText, english);

    meta.append(topLine, title);
    card.append(art, meta);
    return card;
  }

  function renderArchive() {
    dom.archiveGrid.replaceChildren();
    dom.archiveGrid.style.setProperty("--archive-cols", state.archive.length > 3 ? "4" : "3");
    if (!state.archive.length) {
      const empty = document.createElement("div");
      empty.className = "archive-empty";
      empty.innerHTML = "<strong>这里还没有一场天气</strong><span>回到观测台，交出一段感受。<br>本局会替你把它变成一种气候。</span>";
      dom.archiveGrid.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const spec of state.archive) {
      fragment.appendChild(createArchiveCard(spec));
    }
    dom.archiveGrid.appendChild(fragment);
  }

  function updateArchiveUI() {
    const count = state.archive.length;
    setText(dom.archiveCount, pad(count, 2));
    setText(dom.archiveFootnote, count ? "共收录 " + pad(count, 2) + " 种天气" : "档案室目前为空");
    dom.archiveButton.setAttribute("aria-label", "打开臆象档案，共 " + count + " 条记录");
    renderArchive();
  }

  function showToast(message, duration) {
    window.clearTimeout(showToast.timer);
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    showToast.timer = window.setTimeout(function () {
      dom.toast.classList.remove("is-visible");
    }, duration || 2800);
  }

  // -------------------------------------------------------
  // Generation and reveal choreography
  // -------------------------------------------------------

  function setBusy(busy) {
    state.busy = busy;
    dom.castButton.disabled = busy;
    setText(dom.castText, busy ? "正在凝结…" : "铸造天气");
  }

  async function revealSpecimen(spec, announce) {
    if (state.busy) return;
    setBusy(true);
    if (!REDUCED_MOTION) {
      dom.specimen.classList.add("is-shifting");
      dom.archShell.classList.remove("is-changing");
      void dom.archShell.offsetWidth;
      dom.archShell.classList.add("is-changing");
      await wait(390);
    }
    updateSpecimenView(spec);
    if (!REDUCED_MOTION) await wait(510);
    dom.specimen.classList.remove("is-shifting");
    dom.archShell.classList.remove("is-changing");
    setBusy(false);
    if (announce) showToast(announce);
  }

  function generateWeather(inputValue) {
    if (state.busy) return;
    const cleaned = String(inputValue || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const usedInput = cleaned || RANDOM_FEELINGS[Math.floor(Math.random() * RANDOM_FEELINGS.length)];
    const familyKeys = Object.keys(FAMILIES);
    const familyKey = inferFamily(cleaned) || familyKeys[Math.floor(Math.random() * familyKeys.length)];
    const no = state.sequence;
    state.sequence += 1;
    storage.set(SEQUENCE_KEY, String(state.sequence));

    const spec = buildSpec({
      input: usedInput,
      familyKey: familyKey,
      no: no,
      seedKey: usedInput + "|" + no + "|" + Date.now() + "|" + Math.random(),
      createdAt: new Date()
    });

    state.archive = [spec].concat(state.archive).slice(0, MAX_ARCHIVE);
    saveArchive(state.archive);
    updateArchiveUI();
    revealSpecimen(spec, "已归档 · No. " + pad(spec.no, 4) + " · " + spec.titleA + spec.titleB);
  }

  function randomWeather() {
    const feeling = RANDOM_FEELINGS[Math.floor(Math.random() * RANDOM_FEELINGS.length)];
    generateWeather(feeling);
  }

  // -------------------------------------------------------
  // Export a specimen card
  // -------------------------------------------------------

  function wrapCanvasText(ctx, text, maxWidth) {
    const chars = Array.from(text);
    const lines = [];
    let line = "";
    for (const char of chars) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawArchiveWindow(ctx, spec, sourceCanvas, x, y, width, height) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + width / 2);
    ctx.arc(x + width / 2, y + width / 2, width / 2, Math.PI, 0);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.clip();

    const p = spec.palette;
    const sky = ctx.createLinearGradient(x, y, x + width, y + height);
    sky.addColorStop(0, p.bg);
    sky.addColorStop(1, p.deep);
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, width, height);

    if (sourceCanvas && sourceCanvas.width > 0) {
      const sourceRatio = sourceCanvas.width / sourceCanvas.height;
      const targetRatio = width / height;
      let sx = 0;
      let sy = 0;
      let sw = sourceCanvas.width;
      let sh = sourceCanvas.height;
      if (sourceRatio > targetRatio) {
        sw = sourceCanvas.height * targetRatio;
        sx = (sourceCanvas.width - sw) / 2;
      } else {
        sh = sourceCanvas.width / targetRatio;
        sy = (sourceCanvas.height - sh) / 2;
      }
      ctx.drawImage(sourceCanvas, sx, sy, sw, sh, x, y, width, height);
    }

    const shade = ctx.createLinearGradient(x, y, x, y + height);
    shade.addColorStop(0, "rgba(4, 8, 6, 0.05)");
    shade.addColorStop(0.62, "rgba(4, 8, 6, 0.02)");
    shade.addColorStop(1, "rgba(4, 8, 6, 0.42)");
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + width / 2);
    ctx.arc(x + width / 2, y + width / 2, width / 2, Math.PI, 0);
    ctx.lineTo(x + width, y + height);
    ctx.strokeStyle = "rgba(25, 35, 31, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function exportSpecimenCard(spec) {
    if (!spec) return;
    const card = document.createElement("canvas");
    card.width = 1200;
    card.height = 1600;
    const ctx = card.getContext("2d");
    const ink = "#19231f";
    const muted = "#7f8175";
    const paper = "#ede7da";
    const vermilion = "#cf5136";

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, 1200, 1600);
    const wash = ctx.createLinearGradient(0, 0, 1200, 1600);
    wash.addColorStop(0, "rgba(255, 252, 242, 0.44)");
    wash.addColorStop(0.6, "rgba(232, 224, 207, 0.1)");
    wash.addColorStop(1, "rgba(217, 205, 181, 0.55)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 1200, 1600);

    ctx.strokeStyle = "rgba(25, 35, 31, 0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(38, 38, 1124, 1524);
    ctx.strokeStyle = "rgba(25, 35, 31, 0.08)";
    ctx.strokeRect(48, 48, 1104, 1504);

    ctx.fillStyle = vermilion;
    ctx.font = '22px "Songti SC", "SimSun", serif';
    ctx.textBaseline = "middle";
    ctx.fillText("臆", 83, 106);
    ctx.strokeStyle = vermilion;
    ctx.strokeRect(72, 84, 50, 50);
    ctx.fillStyle = ink;
    ctx.font = '600 20px "Songti SC", "SimSun", serif';
    ctx.fillText("臆候局", 142, 100);
    ctx.fillStyle = muted;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText("BUREAU OF IMAGINED WEATHER  /  SPECIMEN CARD", 142, 120);
    ctx.textAlign = "right";
    ctx.fillText("NO. " + pad(spec.no, 4) + "    " + formatDate(spec.createdAt), 1124, 92);
    ctx.fillText(spec.coordinate, 1124, 112);
    ctx.textAlign = "left";

    ctx.strokeStyle = "rgba(25, 35, 31, 0.32)";
    ctx.beginPath();
    ctx.moveTo(72, 158);
    ctx.lineTo(1128, 158);
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.font = '400 105px "Songti SC", "SimSun", serif';
    ctx.fillText(spec.titleA, 88, 288);
    ctx.fillText(spec.titleB, 122, 392);
    ctx.fillStyle = muted;
    ctx.font = 'italic 25px "Bodoni MT", "Times New Roman", serif';
    ctx.fillText(spec.enName, 94, 452);

    ctx.fillStyle = "#46534c";
    ctx.font = '26px "Songti SC", "SimSun", serif';
    const descriptionLines = wrapCanvasText(ctx, spec.description, 505);
    descriptionLines.slice(0, 7).forEach(function (line, index) {
      ctx.fillText(line, 88, 516 + index * 45);
    });

    drawArchiveWindow(ctx, spec, dom.canvas, 675, 205, 410, 725);

    const bodyBottom = Math.max(826, 516 + Math.min(descriptionLines.length, 7) * 45);
    ctx.fillStyle = muted;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText("SAMPLE / 感受样本", 88, bodyBottom);
    ctx.fillStyle = ink;
    ctx.font = '24px "Songti SC", "SimSun", serif';
    ctx.fillText("「" + spec.input + "」", 88, bodyBottom + 35);
    ctx.fillStyle = muted;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText("SENSATION / 体感", 88, bodyBottom + 78);
    ctx.fillStyle = ink;
    ctx.font = '22px "Songti SC", "SimSun", serif';
    ctx.fillText(spec.sensation, 88, bodyBottom + 110);

    const readings = [
      ["温度 / TEMP", formatTemperature(spec.readings.temp) + "°C"],
      ["湿度 / HUM", spec.readings.humidity + "%"],
      ["气压 / PRES", spec.readings.pressure + " hPa"],
      ["能见度 / VIS", spec.readings.visibility + " km"]
    ];
    ctx.strokeStyle = "rgba(25, 35, 31, 0.32)";
    ctx.beginPath();
    ctx.moveTo(88, 1120);
    ctx.lineTo(1128, 1120);
    ctx.stroke();
    readings.forEach(function (reading, index) {
      const x = 88 + (index % 2) * 260;
      const y = 1162 + Math.floor(index / 2) * 105;
      ctx.fillStyle = muted;
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(reading[0], x, y);
      ctx.fillStyle = ink;
      ctx.font = '38px "Bodoni MT", "Times New Roman", serif';
      ctx.fillText(reading[1], x, y + 38);
    });

    ctx.save();
    ctx.translate(956, 1084);
    ctx.rotate(-0.035);
    ctx.fillStyle = colorAlpha(vermilion, 0.92);
    ctx.fillRect(0, 0, 118, 62);
    ctx.fillStyle = paper;
    ctx.font = '25px "Songti SC", "SimSun", serif';
    ctx.fillText("臆候局", 16, 28);
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText("SEALED IN WEATHER", 16, 46);
    ctx.restore();

    ctx.strokeStyle = "rgba(25, 35, 31, 0.22)";
    ctx.beginPath();
    ctx.moveTo(72, 1488);
    ctx.lineTo(1128, 1488);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText("A WEATHER THAT NEVER HAPPENED, BUT WAS FELT.", 72, 1524);
    ctx.textAlign = "right";
    ctx.fillText("臆候局  ·  仅存于此设备", 1128, 1524);
    ctx.textAlign = "left";

    // A wide printed grid keeps the card archival without creating a huge pixel-noise file.
    ctx.strokeStyle = "rgba(25, 35, 31, 0.035)";
    ctx.lineWidth = 1;
    for (let x = 108; x < 1128; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, 48);
      ctx.lineTo(x, 1552);
      ctx.stroke();
    }
    for (let y = 190; y < 1540; y += 72) {
      ctx.beginPath();
      ctx.moveTo(48, y);
      ctx.lineTo(1152, y);
      ctx.stroke();
    }

    const filename = "臆候局_" + spec.titleA + spec.titleB + "_No." + pad(spec.no, 4) + ".png";
    card.toBlob(function (blob) {
      if (!blob) {
        showToast("标本卡没有成功生成，请再试一次。");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename.replace(/[\\/:*?"<>|]/g, "_");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      showToast("标本卡已生成 · 可以收进口袋了");
    }, "image/png");
  }

  // -------------------------------------------------------
  // Clock and archive dialog
  // -------------------------------------------------------

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  function getClockTime() {
    const now = new Date();
    return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
  }

  function updateClock() {
    const now = new Date();
    setText(
      dom.clock,
      pad(now.getDate()) + " " + MONTHS[now.getMonth()] + " " + now.getFullYear() +
      " · " + WEEKDAYS[now.getDay()] + " " + pad(now.getHours()) + ":" + pad(now.getMinutes())
    );
    setText(dom.canvasClock, getClockTime());
  }

  let archiveLastFocus = null;

  function openArchive() {
    archiveLastFocus = document.activeElement;
    dom.archiveOverlay.hidden = false;
    document.body.classList.add("has-overlay");
    weatherWindow.pause();
    renderArchive();
    window.requestAnimationFrame(function () { dom.closeArchive.focus(); });
  }

  function closeArchive() {
    if (dom.archiveOverlay.hidden) return;
    dom.archiveOverlay.hidden = true;
    document.body.classList.remove("has-overlay");
    weatherWindow.resume();
    if (archiveLastFocus && typeof archiveLastFocus.focus === "function") archiveLastFocus.focus();
  }

  function trapArchiveFocus(event) {
    if (event.key !== "Tab" || dom.archiveOverlay.hidden) return;
    const focusable = $$("button, [href], input, [tabindex]:not([tabindex='-1'])", dom.archiveOverlay)
      .filter(function (element) { return !element.disabled && element.offsetParent !== null; });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  let clearConfirmTimer = 0;

  function clearArchive() {
    if (!state.archive.length) {
      showToast("档案室已经是空的");
      return;
    }
    if (!dom.clearArchive.dataset.confirm) {
      dom.clearArchive.dataset.confirm = "true";
      dom.clearArchive.textContent = "再次点击确认清空";
      window.clearTimeout(clearConfirmTimer);
      clearConfirmTimer = window.setTimeout(function () {
        delete dom.clearArchive.dataset.confirm;
        dom.clearArchive.textContent = "清空档案";
      }, 3200);
      return;
    }
    delete dom.clearArchive.dataset.confirm;
    dom.clearArchive.textContent = "清空档案";
    state.archive = [];
    saveArchive([]);
    updateArchiveUI();
    showToast("所有天气已散去");
  }

  // -------------------------------------------------------
  // Events
  // -------------------------------------------------------

  function bindInterfaceEvents() {
    dom.form.addEventListener("submit", function (event) {
      event.preventDefault();
      generateWeather(dom.input.value);
    });

    dom.input.addEventListener("input", function () {
      setText(dom.inputCount, Array.from(dom.input.value).length + " / 40");
    });

    $$("#suggestions button").forEach(function (button) {
      button.addEventListener("click", function () {
        const feeling = button.dataset.feeling || "";
        dom.input.value = feeling;
        setText(dom.inputCount, Array.from(feeling).length + " / 40");
        generateWeather(feeling);
      });
    });

    dom.randomButton.addEventListener("click", randomWeather);

    dom.exportButton.addEventListener("click", function () {
      if (state.busy) return;
      dom.exportButton.disabled = true;
      exportSpecimenCard(state.current);
      window.setTimeout(function () { dom.exportButton.disabled = false; }, 900);
    });

    dom.soundButton.addEventListener("click", async function () {
      if (!state.soundOn) {
        const enabled = await weatherSound.enable();
        if (!enabled) {
          showToast("这台设备似乎没有可用的声场");
          return;
        }
        state.soundOn = true;
        dom.soundButton.setAttribute("aria-pressed", "true");
        setText(dom.soundValue, "ON");
        if (state.current) weatherSound.updateSpec(state.current);
        showToast("声场已开启 · 建议戴上耳机");
      } else {
        weatherSound.disable();
        state.soundOn = false;
        dom.soundButton.setAttribute("aria-pressed", "false");
        setText(dom.soundValue, "OFF");
        showToast("声场已关闭");
      }
    });

    dom.archiveButton.addEventListener("click", openArchive);
    dom.closeArchive.addEventListener("click", closeArchive);
    dom.clearArchive.addEventListener("click", clearArchive);

    dom.archiveOverlay.addEventListener("click", function (event) {
      if (event.target.closest("[data-close-overlay]")) {
        closeArchive();
        return;
      }
      const card = event.target.closest(".archive-card");
      if (!card) return;
      const spec = state.archive.find(function (entry) { return entry.id === card.dataset.specId; });
      if (!spec) return;
      closeArchive();
      if (state.current && spec.id === state.current.id) {
        showToast("这场天气正在观测窗里");
        return;
      }
      revealSpecimen(spec, "已调取 · No. " + pad(spec.no, 4) + " · " + spec.titleA + spec.titleB);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeArchive();
      trapArchiveFocus(event);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dom.input.focus();
      }
    });
  }

  // -------------------------------------------------------
  // Boot
  // -------------------------------------------------------

  function boot() {
    state.archive = loadArchive();
    const initial = loadCurrent();
    state.sequence = loadSequence(state.archive, initial);
    state.current = initial;

    updateSpecimenView(initial);
    updateArchiveUI();
    updateClock();
    window.setInterval(updateClock, 1000);
    bindInterfaceEvents();
    setText(dom.inputCount, "0 / 40");
    setBusy(false);

    window.setTimeout(function () {
      if (state.current && state.current.id === initial.id) {
        dom.weatherTitle.classList.remove("is-arriving");
      }
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
