(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'));
  else root.DS_WAVES = factory(root.DS_RNG);
})(typeof self !== 'undefined' ? self : this, function (rngModule) {
'use strict';
// 波次生成：根据真实扫描数据 + 种子，确定性地生成 20 波敌人 + 无尽模式。
const { createRng } = rngModule;

// 类别池：每个扩展名只归属一个类别（下表由 CLASS_POOLS 一次性展开为 EXT_CLASS，
// 因此不存在「同一扩展名映射到多个类别、结果取决于遍历顺序」的歧义）。
const CLASS_POOLS = {
  fodder: ['txt', 'doc', 'docx', 'log', 'md', 'json', 'csv', 'ini', 'xls', 'ppt'],
  rusher: ['exe', 'msi', 'scr', 'bat', 'cmd', 'lnk'],
  tank: ['pdf', 'zip', 'rar', '7z', 'iso'],
  splitter: ['tar', 'gz', 'apk'],
  swarm: ['dll', 'sys', 'tmp', 'dat', 'bin'],
  healer: ['jpg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'mp3', 'wav', 'avi']
};

// 扩展名 → 类别（唯一映射，显式构建一次）
const EXT_CLASS = (function () {
  const m = Object.create(null);
  for (const cls of Object.keys(CLASS_POOLS)) {
    for (const ext of CLASS_POOLS[cls]) {
      if (m[ext] === undefined) m[ext] = cls;
    }
  }
  return m;
})();

const THEMES = ['downloads', 'documents', 'pictures', 'processes', 'mixed', 'system'];

function extToClass(ext) {
  if (typeof ext !== 'string') return null;
  return EXT_CLASS[ext.toLowerCase()] || null;
}

// 波次规格：构成随难度递增
function waveSpec(n) {
  const w = n + 1;
  const fodder = Math.max(3, Math.round(4 + w * 1.4));
  const rusher = Math.round(1 + w * 0.7);
  const tank = Math.round(w * 0.35);
  const swarm = Math.round(w * 0.6);
  const splitter = Math.round(w * 0.3);
  const healer = n >= 4 ? Math.round(w * 0.2) : 0;
  const comp = { fodder: fodder, rusher: rusher, tank: tank, swarm: swarm, splitter: splitter, healer: healer };
  const boss = [5, 10, 15, 20].indexOf(n + 1) >= 0;
  const bossTheme = boss ? bossThemeFor(n + 1) : null;
  return {
    count: fodder + rusher + tank + swarm + splitter + healer + (boss ? 1 : 0),
    composition: comp,
    // Boss 波的敌人主题跟随 Boss 主题，避免出现「system 波里塞 downloads Boss」这种错位
    theme: bossTheme || THEMES[(n + 1) % THEMES.length],
    boss: boss,
    bossTheme: bossTheme
  };
}

function bossThemeFor(waveNum) {
  if (waveNum === 5) return 'downloads';
  if (waveNum === 10) return 'documents';
  if (waveNum === 15) return 'pictures';
  return 'system';
}

// 从扫描数据中取敌人名字
function namePool(scan, theme) {
  const src = scan && typeof scan === 'object' ? scan : {};
  const files = Array.isArray(src.files) ? src.files : [];
  const procs = Array.isArray(src.processes) ? src.processes : [];
  let pool;
  switch (theme) {
    case 'downloads': pool = files.filter(f => f.dir === 'Downloads').map(f => f.name + '.' + f.ext); break;
    case 'documents': pool = files.filter(f => ['Documents', 'Desktop'].indexOf(f.dir) >= 0).map(f => f.name + '.' + f.ext); break;
    case 'pictures': pool = files.filter(f => ['Pictures', 'Music', 'Videos'].indexOf(f.dir) >= 0).map(f => f.name + '.' + f.ext); break;
    case 'processes': pool = procs.slice(); break;
    case 'system': pool = files.map(f => f.name + '.' + f.ext).concat(procs.slice(0, 40)); break;
    default: pool = files.map(f => f.name + '.' + f.ext);
  }
  if (!pool.length) {
    pool = ['桌面文件.txt', '文档.pdf', '图片.jpg', '程序.exe', '压缩包.zip'];
  }
  return pool;
}

// 按构成表生成敌人列表（保持 类别 → 数量 的确定性顺序）
function buildEnemies(rng, spec, pool, waveNum) {
  const enemies = [];
  const comp = spec.composition;
  for (const cls of Object.keys(comp)) {
    for (let k = 0; k < comp[cls]; k++) {
      enemies.push(makeEnemy(rng, cls, pool, waveNum));
    }
  }
  return enemies;
}

// 生成完整波次（含敌人名单）
function generateWaves(scan, opts) {
  opts = opts || {};
  const seed = opts.seed !== undefined ? opts.seed : 20810719;
  const rng = createRng(seed);
  const waves = [];
  const total = opts.totalWaves || 20;
  scan = scan && typeof scan === 'object' ? scan : {};
  for (let i = 0; i < total; i++) {
    const spec = waveSpec(i);
    const pool = namePool(scan, spec.theme);
    const enemies = buildEnemies(rng, spec, pool, i + 1);
    let bossName = null;
    if (spec.boss) {
      const boss = makeBoss(rng, scan, spec, i + 1);
      bossName = boss.name;
      enemies.push(boss);
    }
    // 洗牌用 Fisher-Yates（sort 的比较器带随机数不是有效比较器，结果不稳定）
    const shuffled = rng.shuffle(enemies);
    waves.push({
      num: i + 1,
      theme: spec.theme,
      boss: spec.boss,
      bossName: bossName,
      count: shuffled.length,
      enemies: shuffled
    });
  }
  return waves;
}

function makeEnemy(rng, cls, pool, waveNum) {
  const name = pickName(rng, pool);
  // 类别由波次构成决定；扩展名只用于「取名字」，不再反过来改写类别
  // （旧实现会让 70% 的敌人被扩展名改写类别，使实际构成与 spec 不符）
  return {
    id: 'e-' + waveNum + '-' + rng.int(1000, 9999),
    cls: cls,
    name: name,
    ext: name.split('.').pop(),
    hp: 0, maxHp: 0, speed: 0, radius: 0, score: 0
  };
}

function pickName(rng, pool) {
  if (!pool.length) return '文件.txt';
  return pool[rng.int(0, pool.length - 1)];
}

// Boss 命名：优先「该主题里最大的真实文件」，退化顺序 主题最大 → 全局最大 → 进程名 → 兜底
function bossNameFor(rng, scan, spec) {
  const s = scan && typeof scan === 'object' ? scan : {};
  const byTheme =
    spec.bossTheme === 'downloads' ? (s.largestArchive || s.largest) :
    spec.bossTheme === 'documents' ? (s.largestDoc || s.largest) :
    spec.bossTheme === 'pictures' ? (s.largestMedia || s.largest) : s.largest;
  if (byTheme && byTheme.name) return byTheme.name + '.' + byTheme.ext;
  if (s.largest && s.largest.name) return s.largest.name + '.' + s.largest.ext;
  const procs = Array.isArray(s.processes) ? s.processes : [];
  if (procs.length) return procs[rng.int(0, Math.min(procs.length, 60) - 1)];
  return '桌面之核';
}

function makeBoss(rng, scan, spec, waveNum) {
  return {
    id: 'boss-' + waveNum,
    cls: 'boss',
    name: bossNameFor(rng, scan, spec),
    hp: 0, maxHp: 0, speed: 0, radius: 0, score: 0
  };
}

// 无尽模式：第 21 波起，按轮次递增；每 3 轮一个 Boss
function generateEndlessWave(scan, round, opts) {
  opts = opts || {};
  const rng = createRng((opts.seed || 20810719) + round * 7919);
  const waveNum = 20 + round;
  const spec = waveSpec(waveNum);
  const theme = THEMES[round % THEMES.length];
  const pool = namePool(scan, theme);
  const enemies = buildEnemies(rng, spec, pool, waveNum);
  const isBoss = round % 3 === 2;
  let bossName = null;
  if (isBoss) {
    const boss = makeBoss(rng, scan, { bossTheme: theme }, waveNum);
    bossName = boss.name;
    enemies.push(boss);
  }
  return {
    num: waveNum,
    theme: theme,
    boss: isBoss,
    bossName: bossName,
    count: enemies.length,
    enemies: enemies
  };
}

return { generateWaves, generateEndlessWave, waveSpec, extToClass, namePool, CLASS_POOLS, EXT_CLASS, THEMES };
});