export const QUALITY_PRESETS = {
  low: {
    label: '低',
    renderScale: 0.68,
    maxPixelRatio: 1.0,
    msaaSamples: 0,
    shadowMapSize: 512,
    shadows: true,
    particleScale: 0.35,
    fogDistance: 38,
    anisotropy: 2,
    obliqueCullDistance: 15,
    lodBias: 2.0
  },
  medium: {
    label: '中',
    renderScale: 0.88,
    maxPixelRatio: 1.25,
    msaaSamples: 2,
    shadowMapSize: 1024,
    shadows: true,
    particleScale: 0.72,
    fogDistance: 52,
    anisotropy: 4,
    obliqueCullDistance: 23,
    lodBias: 1.0
  },
  high: {
    label: '高',
    renderScale: 1.0,
    maxPixelRatio: 1.5,
    msaaSamples: 4,
    shadowMapSize: 2048,
    shadows: true,
    particleScale: 1.0,
    fogDistance: 68,
    anisotropy: 8,
    obliqueCullDistance: 34,
    lodBias: 0.55
  }
};

const DEFAULTS = {
  quality: 'medium',
  sensitivity: 1.0,
  volume: 0.75,
  grain: 0.55,
  subtitles: true,
  reducedMotion: false,
  fov: 72
};

const STORAGE_KEY = 'hollow-signal.settings.v1';

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this._listeners = new Set();
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      for (const key of Object.keys(DEFAULTS)) {
        if (data[key] !== undefined) this.values[key] = data[key];
      }
    } catch {
      // Corrupt settings are not worth preserving.
    }
    if (!QUALITY_PRESETS[this.values.quality]) this.values.quality = 'medium';
    this.values.volume = Math.max(0, Math.min(1, Number(this.values.volume)));
    this.values.sensitivity = Math.max(0.35, Math.min(2.5, Number(this.values.sensitivity)));
    this.values.fov = Math.max(62, Math.min(90, Number(this.values.fov)));
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      // Private browsing can reject storage.
    }
  }

  get quality() { return QUALITY_PRESETS[this.values.quality]; }
  get qualityName() { return this.values.quality; }

  set(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.save();
    for (const cb of this._listeners) cb(key, value, this.values);
  }

  subscribe(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }
}
