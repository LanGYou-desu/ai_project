/* 光湾市 — application shell, controls and audio bootstrap. */
(function () {
  "use strict";

  const L = window.Lumen;
  const MODES = L.MODES;
  const canvas = document.getElementById("city");
  const intro = document.getElementById("intro");
  const enterSound = document.getElementById("enterSound");
  const enterMuted = document.getElementById("enterMuted");
  const soundToggle = document.getElementById("soundToggle");
  const soundLabel = document.getElementById("trackTitle");
  const volume = document.getElementById("volume");
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const modeButtons = Array.from(document.querySelectorAll(".time-btn"));

  let entered = false;
  let toastTimer = 0;
  let currentMode = "morning";

  const audio = new L.HarborAudio();
  const scene = new L.PixelCity(canvas, {
    audio,
    introActive: function () { return !entered; },
    onGreeting: function () { audio.playGreeting(); }
  });
  scene.start();

  function setMode(mode, options) {
    if (!MODES[mode]) return;
    currentMode = mode;
    scene.setMode(mode);
    audio.setMode(mode);
    updateInterface(mode);
    if (!options || options.announce !== false) showToast(MODES[mode].toast);
  }

  function updateInterface(mode) {
    const meta = MODES[mode];
    document.body.dataset.mode = mode;
    document.getElementById("clock").textContent = meta.time;
    document.getElementById("temp").textContent = meta.temp;
    document.getElementById("wind").textContent = meta.wind;
    document.getElementById("moodLabel").textContent = meta.mood;
    document.getElementById("keyLight").textContent = meta.keyLight;
    document.getElementById("fillLight").textContent = meta.fillLight;
    modeButtons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    updateSoundLabel();
    const theme = mode === "night" ? "#07111d" : mode === "dusk" ? "#2b1f28" : "#101b22";
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", theme);
  }

  function updateSoundLabel() {
    const meta = MODES[currentMode];
    soundToggle.setAttribute("aria-pressed", String(audio.enabled));
    soundToggle.setAttribute("aria-label", audio.enabled ? "关闭声音" : "开启声音");
    if (audio.enabled) {
      soundLabel.textContent = meta.track + " · " + meta.trackEn;
    } else {
      soundLabel.textContent = entered ? "静音漫游" : "等待入城";
    }
  }

  function showToast(text) {
    if (!entered) return;
    toastText.textContent = text;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
  }

  function finishIntro() {
    entered = true;
    document.body.classList.add("is-ready");
    intro.classList.add("is-leaving");
    intro.setAttribute("aria-hidden", "true");
    window.setTimeout(function () { intro.style.display = "none"; }, 1200);
    showToast(MODES[currentMode].toast);
  }

  async function enter(withSound) {
    finishIntro();
    if (withSound) {
      try {
        await audio.enable(currentMode);
      } catch (error) {
        audio.enabled = false;
      }
      audio.setVolume(Number(volume.value));
      updateSoundLabel();
    } else {
      updateSoundLabel();
    }
  }

  async function toggleSound() {
    if (!entered) return;
    if (!audio.started) {
      audio.setVolume(Number(volume.value));
      try {
        await audio.enable(currentMode);
      } catch (error) {
        audio.enabled = false;
      }
      updateSoundLabel();
      if (audio.enabled) showToast(MODES[currentMode].label + " · " + MODES[currentMode].track);
      return;
    }
    if (audio.enabled) {
      audio.disable();
      updateSoundLabel();
      showToast("声音已关闭 · 城市仍在呼吸");
    } else {
      audio.setVolume(Number(volume.value));
      try {
        await audio.enable(currentMode);
      } catch (error) {
        audio.enabled = false;
      }
      updateSoundLabel();
      if (audio.enabled) showToast(MODES[currentMode].label + " · " + MODES[currentMode].track);
    }
  }

  enterSound.addEventListener("click", function () { enter(true); });
  enterMuted.addEventListener("click", function () { enter(false); });
  soundToggle.addEventListener("click", toggleSound);
  volume.addEventListener("input", function () { audio.setVolume(Number(volume.value)); });

  modeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      if (!entered) return;
      setMode(button.dataset.mode);
    });
  });

  document.addEventListener("keydown", function (event) {
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (!entered) return;
    if (event.key === "1") setMode("morning");
    else if (event.key === "2") setMode("dusk");
    else if (event.key === "3") setMode("night");
    else if (event.key.toLowerCase() === "m") toggleSound();
    else if (event.key === "Escape") {
      toast.classList.remove("is-visible");
      intro.blur();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (!audio.ctx) return;
    if (document.hidden) return;
    if (audio.enabled && audio.ctx.state === "suspended") {
      audio.ctx.resume().catch(function () {});
    }
  });

  updateInterface("morning");
  // Expose a tiny debug hook without cluttering the global namespace too much.
  window.Lumen.city = scene;
  window.Lumen.soundtrack = audio;
})();
