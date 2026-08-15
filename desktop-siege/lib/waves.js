(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'));
  else root.DS_WAVES = factory(root.DS_RNG);
})(typeof self !== 'undefined' ? self : this, function (rngModule) {
'use strict';
// 波次生成：根据真实扫描数据 + 种子，确定性地生成 20 波敌人 + 无尽模式。
const { createRng } = rngModule;

const CLASS_POOLS = {
  fodder: ['txt', 'doc', 'docx', 'log', 'md', 'json', 'csv', 'ini', 'xls', 'ppt'],
  rusher: ['exe', 'msi', 'scr', 'bat', 'cmd', 'lnk'],
  tank: ['pdf', 'zip', 'rar', '7z', 'iso'],
  splitter: ['zip', 'rar', '7z', 'tar', 'gz', 'apk'],
  swarm: ['dll', 'sys', 'tmp', 'dat', 'bin'],
  healer: ['jpg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'mp3', 'wav', 'avi']
};

const THEMES = ['downloads', 'documents', 'pictures', 'processes', 'mixed', 'system'];

function extToClass(ext) {
  for (const cls of Object.keys(CLASS_POOLS)) {
    if (CLASS_POOLS[cls].indexOf(ext) >= 0) return cls;
  }
  return null;
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
  return {
    count: fodder + rusher + tank + swarm + splitter + healer + (boss ? 1 : 0),
    composition: comp,
    theme: THEMES[(n + 1) % THEMES.length],
    boss: boss,
    bossTheme: boss ? bossThemeFor(n + 1) : null
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
  const files = scan.files || [];
  const procs = scan.processes || [];
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

// 生成完整波次（含敌人名单）
function generateWaves(scan, opts) {
  opts = opts || {};
  const seed = opts.seed !== undefined ? opts.seed : 20810719;
  const rng = createRng(seed);
  const waves = [];
  const total = opts.totalWaves || 20;
  for (let i = 0; i < total; i++) {
    const spec = waveSpec(i);
    const pool = namePool(scan, spec.theme);
    const enemies = [];
    const comp = spec.composition;
    for (const cls of Object.keys(comp)) {
      for (let k = 0; k < comp[cls]; k++) {
        enemies.push(makeEnemy(rng, cls, pool, i + 1));
      }
    }
    if (spec.boss) enemies.push(makeBoss(rng, scan, spec, i + 1));
    enemies.sort(function () { return rng.rnd() - 0.5; });
    waves.push({
      num: i + 1,
      theme: spec.theme,
      boss: spec.boss,
      bossName: spec.boss ? enemies[enemies.length - 1].name : null,
      enemies: enemies
    });
  }
  return waves;
}

function makeEnemy(rng, cls, pool, waveNum) {
  const name = pickName(rng, pool);
  const ext = name.split('.').pop();
  const mapped = extToClass(ext);
  const finalCls = mapped && rng.chance(0.7) ? mapped : cls;
  return {
    id: 'e-' + waveNum + '-' + rng.int(1000, 9999),
    cls: finalCls,
    name: name,
    hp: 0, maxHp: 0, speed: 0, radius: 0, score: 0
  };
}

function pickName(rng, pool) {
  if (!pool.length) return '文件.txt';
  return pool[rng.int(0, pool.length - 1)];
}

function makeBoss(rng, scan, spec, waveNum) {
  const largest = scan.largest;
  const docs = scan.largestDoc;
  const media = scan.largestMedia;
  const arc = scan.largestArchive;
  const procs = scan.processes || [];
  const nameBase =
    spec.bossTheme === 'downloads' ? (arc || largest) :
    spec.bossTheme === 'documents' ? (docs || largest) :
    spec.bossTheme === 'pictures' ? (media || largest) : (largest);
  const candidates = [];
  if (nameBase) candidates.push(nameBase.name + '.' + nameBase.ext);
  if (procs.length) candidates.push(procs[rng.int(0, Math.min(procs.length, 60) - 1)]);
  candidates.push('桌面之核');
  return {
    id: 'boss-' + waveNum,
    cls: 'boss',
    name: candidates[rng.int(0, candidates.length - 1)],
    hp: 0, maxHp: 0, speed: 0, radius: 0, score: 0
  };
}

// 无尽模式：第 21 波起，按轮次递增
function generateEndlessWave(scan, round, opts) {
  opts = opts || {};
  const rng = createRng((opts.seed || 20810719) + round * 7919);
  const waveNum = 20 + round;
  const spec = waveSpec(waveNum);
  const pool = namePool(scan, THEMES[round % THEMES.length]);
  const enemies = [];
  for (const cls of Object.keys(spec.composition)) {
    for (let k = 0; k < spec.composition[cls]; k++) {
      enemies.push(makeEnemy(rng, cls, pool, waveNum));
    }
  }
  if (round % 3 === 2) enemies.push(makeBoss(rng, scan, spec, waveNum));
  return {
    num: waveNum,
    theme: THEMES[round % THEMES.length],
    boss: round % 3 === 2,
    enemies: enemies
  };
}

return { generateWaves, generateEndlessWave, waveSpec, extToClass, namePool, CLASS_POOLS, THEMES };
});