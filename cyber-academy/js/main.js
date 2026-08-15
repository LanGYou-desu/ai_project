'use strict';
/* =========================================================
 * 赛博安全学院 — 主程序
 * 启动画面 / 存档 / 矩阵背景 / start-resume-reset
 * ========================================================= */

const SAVE_KEY = 'cyber-academy-save-v1';
let T;

/* ---------- 存档 ---------- */
function saveGame() {
  try {
    const data = {
      v: 4,
      xp: Game.xp,
      hintsUsed: Game.hintsUsed,
      flagsFound: [...Game.flagsFound],
      achievements: [...Game.achievements],
      cardsRead: [...Game.cardsRead],
      quizzesDone: [...Game.quizzesDone],
      challengesDone: [...Game.challengesDone],
      mistakes: Game.mistakes,
      mistakesTotal: Game.mistakesTotal,
      challengeRecords: Game.challengeRecords,
      guideShown: Game.guideShown,
      startedAt: Game.startedAt,
      hasStarted: Game.hasStarted,
      activeId: Game.active ? Game.active.id : null,
      levels: {},
    };
    Game.levels.forEach((l) => {
      const obj = {};
      l.objectives.forEach((o) => { if (o.done) obj[o.id] = true; });
      const scenarios = {};
      if (l.scenarios) l.scenarios.forEach((s) => { scenarios[s.id] = !!s.done; });
      data.levels[l.id] = { won: !!l.won, hintUsed: !!l.hintUsed, hintLevel: l.hintLevel || 0, objectives: obj, scenarios };
    });
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* localStorage 不可用时静默 */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // 版本校验: v<3 的旧档结构不兼容, 视为无存档
    if (typeof s.v !== 'number' || s.v < 3) return null;
    return s;
  } catch (e) { return null; }
}

function restoreSave(s) {
  Game.xp = s.xp || 0;
  Game.hintsUsed = s.hintsUsed || 0;
  Game.startedAt = s.startedAt || 0;
  Game.hasStarted = !!s.hasStarted;
  Game.mistakes = Array.isArray(s.mistakes) ? s.mistakes : [];
  Game.mistakesTotal = s.mistakesTotal || 0;
  Game.challengeRecords = s.challengeRecords && typeof s.challengeRecords === 'object' ? s.challengeRecords : {};
  Game.guideShown = !!s.guideShown;
  (s.flagsFound || []).forEach((f) => Game.flagsFound.add(f));
  (s.achievements || []).forEach((a) => Game.achievements.add(a));
  (s.cardsRead || []).forEach((c) => Game.cardsRead.add(c));
  (s.quizzesDone || []).forEach((q) => Game.quizzesDone.add(q));
  (s.challengesDone || []).forEach((c) => Game.challengesDone.add(c));
  Game.levels.forEach((l) => {
    const sl = (s.levels || {})[l.id];
    if (!sl) return;
    l.won = !!sl.won;
    l.hintUsed = !!sl.hintUsed;
    l.hintLevel = sl.hintLevel || 0;
    l.objectives.forEach((o) => { if (sl.objectives && sl.objectives[o.id]) o.done = true; });
    if (l.scenarios && sl.scenarios) l.scenarios.forEach((sc) => { sc.done = !!sl.scenarios[sc.id]; });
  });
}

function resetProgress() {
  Game.levels.forEach((l) => {
    l.won = false; l.hintUsed = false; l.hintLevel = 0;
    l.objectives.forEach((o) => { o.done = false; });
    if (l.scenarios) l.scenarios.forEach((sc) => { sc.done = false; });
    delete l.fsRemote;
  });
  Game.scenario = null;
  Game.xp = 0; Game.hintsUsed = 0;
  Game.flagsFound = new Set(); Game.achievements = new Set(); Game.cardsRead = new Set(); Game.quizzesDone = new Set(); Game.challengesDone = new Set();
  Game.mistakes = []; Game.mistakesTotal = 0; Game.challengeRecords = {}; Game.guideShown = false;
  Game.active = null; Game.hasStarted = false; Game.startedAt = 0;
  Game.labRows = null; Game.activeChallenge = null; Game.scenario = null;
}

/* ---------- UI 主题 ---------- */
const THEMES = {
  crt: '绿光经典 (CRT)',
  amber: '琥珀磷光',
  blue: '海蓝',
  white: '白底经典',
  violet: '紫罗兰',
  matrix: '矩阵雨',
};
const THEME_KEY = 'cyber-academy-theme';
const THEME_MATRIX = { crt: '#0c6', amber: '#ffb000', blue: '#4da6ff', white: '#98c379', violet: '#c792ff', matrix: '#0f6' };

function applyTheme(name) {
  const t = THEMES[name] ? name : 'crt';
  document.body.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* 忽略 */ }
  return t;
}

GLOBAL_COMMANDS['theme'] = (toks) => {
  const name = (toks[1] || '').toLowerCase();
  if (!name || name === 'list') {
    T.print('═══ 界面主题 ═══ (共 ' + Object.keys(THEMES).length + ' 套)', 'header');
    Object.keys(THEMES).forEach((k) => {
      const cur = document.body.dataset.theme === k;
      T.print(`  ${cur ? '▶' : ' '} ${k.padEnd(8)} ${THEMES[k]}`, cur ? 'success' : 'cmd');
    });
    T.print('用法: theme <名称> 切换主题 (例如 theme amber)', 'cmd');
    return;
  }
  if (!THEMES[name]) { T.print('没有这个主题。输入 theme 查看全部。', 'error'); return; }
  applyTheme(name);
  T.print(`✔ 主题已切换: ${THEMES[name]}`, 'success');
};

/* ---------- 矩阵背景 ---------- */
let matrixTimer = null;
function startMatrix() {
  const cv = document.getElementById('matrix');
  if (!cv || !cv.getContext) return;
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const ctx = cv.getContext('2d');
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01X#+';
  const cols = Math.max(1, Math.floor(cv.width / 14));
  const drops = Array.from({ length: cols }, () => Math.random() * -80);
  const theme = document.body.dataset.theme || 'crt';
  const color = THEME_MATRIX[theme] || '#0c6';
  if (matrixTimer) clearInterval(matrixTimer);
  matrixTimer = setInterval(() => {
    ctx.fillStyle = 'rgba(2, 8, 3, 0.10)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = color;
    ctx.font = '13px monospace';
    for (let i = 0; i < cols; i++) {
      const ch = chars[(Math.random() * chars.length) | 0];
      ctx.fillText(ch, i * 14, drops[i] * 14);
      if (drops[i] * 14 > cv.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }, 60);
}
function stopMatrix() {
  if (matrixTimer) { clearInterval(matrixTimer); matrixTimer = null; }
  const cv = document.getElementById('matrix');
  if (cv && cv.getContext) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}
window.addEventListener('resize', () => { if (matrixTimer) startMatrix(); });

/* ---------- 启动画面 ---------- */
const TITLE_ART = [
  '  ██████╗██╗   ██╗██████╗ ███████╗██████╗     █████╗  ██████╗ █████╗ ██████╗ ███████╗███╗   ███╗██╗   ██╗',
  ' ██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗   ██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝████╗ ████║╚██╗ ██╔╝',
  ' ██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝   ███████║██║     ███████║██████╔╝█████╗  ██╔████╔██║ ╚████╔╝ ',
  ' ██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗   ██╔══██║██║     ██╔══██║██╔══██╗██╔══╝  ██║╚██╔╝██║  ╚██╔╝  ',
  ' ╚██████╗   ██║   ██████╔╝███████╗██║  ██║   ██║  ██║╚██████╗██║  ██║██║  ██║███████╗██║ ╚═╝ ██║   ██║   ',
  '  ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝   ╚═╝   ',
];

async function bootSeq(t) {
  await t.typeLines([
    'CYBER-OS v2.4.1  [安全教学模拟系统]',
    '正在加载内核模块 ... [ OK ]',
    '  载入 net-scan 网络侦察模块 [ OK ]',
    '  载入 crypto-lib 密码学模块 [ OK ]',
    '  载入 web-fuzz Web 渗透模块 [ OK ]',
    '  载入 rev-lab 逆向工程模块 [ OK ]',
    '  载入 forensics 取证模块    [ OK ]',
    '身份认证: 新兵 #0713 已接入',
    '',
  ], 'dim', 6);
}

async function showTitle() {
  T.clear();
  startMatrix();
  TITLE_ART.forEach((l) => T.print(l, 'art'));
  T.newline();
  T.print('═══ 边玩边学 · 网络安全渗透训练营 ═══', 'header');
  T.newline();
  await T.type('一个教你「网络侦察 · 密码学 · Web 渗透 · 逆向工程 · 数字取证」的可玩教程。\n', 'normal', 6);
  T.newline();
  const s = loadSave();
  if (s && s.hasStarted) {
    T.print(`检测到上次进度: L${s.activeId != null ? s.activeId : 0} · XP ${s.xp || 0}`, 'info');
    T.print('输入 resume 继续游戏，或输入 start 重新开始。', 'dim');
  } else {
    T.print('输入 start 开始游戏', 'cmd');
  }
  T.print('输入 help 查看命令说明', 'dim');
}

/* ---------- 全局命令: start / resume / reset ---------- */
GLOBAL_COMMANDS['start'] = async (toks) => {
  if (Game.hasStarted) { T.print('游戏已开始。输入 resume 恢复进度，reset 重新开始。', 'info'); return; }
  resetProgress();
  Game.startedAt = Date.now();
  Game.hasStarted = true;
  stopMatrix();
  T.clear();
  await bootSeq(T);
  await loadLevel(0);
  if (!Game.guideShown) {
    Game.guideShown = true;
    await showGuide();
  }
  Game.save();
};

/* ---------- 新手引导 ---------- */
async function showGuide() {
  T.newline();
  T.print('═══ 新手引导 · 三步上手 ═══', 'header');
  T.print('  1️⃣  学原理    course 1 1     (第 1 课: 终端入门, 共 13 门课)');
  T.print('  2️⃣  看示例    demo terminal  (先看教学录像, 再自己动手)');
  T.print('  3️⃣  动手打    mission        (看任务目标; 用 ls / cat 探索)');
  T.newline();
  T.print('  常用入口:  challenge 挑战大厅 | docs 知识手册 | tools 工具箱 | theme 换肤', 'dim');
  T.print('  卡住了?    hint 三级提示 | course 复习 | demo 示例', 'dim');
  T.print('  想再看引导: 输入 guide', 'dim');
  T.newline();
}

GLOBAL_COMMANDS['resume'] = async (toks) => {
  const s = loadSave();
  if (!s || !s.hasStarted) { T.print('没有可恢复的进度。输入 start 开始新游戏。', 'info'); return; }
  resetProgress();
  restoreSave(s);
  Game.hasStarted = true;
  stopMatrix();
  T.clear();
  await loadLevel(s.activeId != null ? s.activeId : 0, true);
  Game.save();
};

GLOBAL_COMMANDS['reset'] = async (toks) => {
  const ans = await askLine('确定要清空所有进度吗? (y/n) ');
  if (ans.trim().toLowerCase() === 'y') {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
    T.print('进度已清空。', 'info');
    resetProgress();
    T.clear();
    await showTitle();
  } else {
    T.print('已取消。', 'dim');
  }
};

/* ---------- 启动 ---------- */
function boot() {
  Game.levels.sort((a, b) => a.id - b.id);
  T = new Terminal();
  let savedTheme = 'crt';
  try { savedTheme = localStorage.getItem(THEME_KEY) || 'crt'; } catch (e) { /* 忽略 */ }
  applyTheme(savedTheme);
  try { Game.showPanel = localStorage.getItem('cyber-panel') !== '0'; } catch (e) { /* 忽略 */ }
  showTitle();
  updateHud();
  T.input.focus();
  if (typeof Lab !== 'undefined') Lab.init(); // 探测本地靶场 (异步，不阻塞)
}

document.addEventListener('DOMContentLoaded', boot);
