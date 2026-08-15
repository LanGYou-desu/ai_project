'use strict';
/* =========================================================
 * 赛博安全学院 — 核心引擎
 * 终端模拟 / 游戏状态 / 虚拟文件系统 / 成就系统 / 虚拟浏览器
 * ========================================================= */

/* ---------- 通用工具 ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tokenize(line) {
  const out = []; let cur = ''; let q = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '\\' && i + 1 < line.length) { cur += line[++i]; } // 转义字符
      else if (ch === q) q = null;
      else cur += ch;
    } else if (ch === '"') q = ch;
    else if (ch === ' ' || ch === '\t') { if (cur) { out.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function pad(n, w = 2) { return String(n).padStart(w, '0'); }
function hex(b) { return b.toString(16).padStart(2, '0').toUpperCase(); }

function isProbablyBinary(bytes) {
  if (!bytes.length) return false;
  let bad = 0;
  const n = Math.min(bytes.length, 1024);
  for (let i = 0; i < n; i++) {
    const c = bytes[i];
    const isText = (c >= 9 && c <= 13) || (c >= 32 && c <= 126) || (c >= 128); // 含 UTF-8 中文字节
    if (!isText) bad++;
  }
  return (bad / n) > 0.1; // 控制字符过多 → 视为二进制
}

/* ---------- 音效 (WebAudio) ---------- */
const Sound = {
  ctx: null,
  enabled: true,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 忽略 */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) { /* 忽略 */ } }
  },
  beep(freq, dur = 0.08, type = 'square', gain = 0.04) {
    if (!this.enabled || !this.ctx) return;
    try {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(gain, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur + 0.03);
    } catch (e) { /* 忽略 */ }
  },
  tick() { this.beep(2200, 0.015, 'square', 0.006); },
  click() { this.beep(1400, 0.012, 'square', 0.015); },
  ok() { this.beep(880, 0.09, 'sine', 0.05); this.beep(1320, 0.12, 'sine', 0.05); },
  good() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.16, 'sine', 0.055), i * 110)); },
  err() { this.beep(160, 0.28, 'sawtooth', 0.06); },
};

/* ---------- 终端 ---------- */
class Terminal {
  constructor() {
    this.out = document.getElementById('output');
    this.input = document.getElementById('input');
    this.promptEl = document.getElementById('prompt');
    this.prompt = 'guest@cyber:~$';
    this.history = [];
    this.histIdx = 0;
    this.askResolve = null;
    const self = this;
    this.input.addEventListener('keydown', (e) => self.onKey(e));
    this.out.addEventListener('click', () => self.input.focus());
  }
  setPrompt(p) { this.prompt = p; this.promptEl.textContent = p; }
  scroll() { this.out.scrollTop = this.out.scrollHeight; }
  print(text, cls = '') {
    const line = document.createElement('div');
    line.className = 'line' + (cls ? ' ' + cls : '');
    if (typeof text === 'string') line.textContent = text;
    else line.appendChild(text);
    this.out.appendChild(line);
    // 防止长会话 DOM 膨胀: 超过上限时裁剪最旧的节点
    if (this.out.children.length > 800) {
      for (let i = 0; i < 200; i++) {
        if (this.out.firstChild) this.out.removeChild(this.out.firstChild);
      }
    }
    this.scroll();
    return line;
  }
  printNode(node) { return this.print(node); }
  newline(n = 1) { for (let i = 0; i < n; i++) this.print(''); }
  async type(text, cls = '', speed = 7) {
    const line = document.createElement('div');
    line.className = 'line' + (cls ? ' ' + cls : '');
    this.out.appendChild(line);
    for (const ch of text) {
      line.textContent += ch;
      this.scroll();
      if (ch !== ' ' && ch !== '\n' && Math.random() < 0.05) Sound.tick();
      await sleep(speed);
    }
    return line;
  }
  async typeLines(lines, cls = '', speed = 7) {
    for (const l of lines) await this.type(l, cls, speed);
  }
  echo(text) { this.print(this.prompt + text, 'cmdline'); }
  clear() { this.out.innerHTML = ''; }
  onKey(e) {
    if (e.key === 'Enter') {
      const val = this.input.value;
      this.input.value = '';
      if (val.trim()) this.history.push(val);
      this.histIdx = this.history.length;
      if (this.askResolve) {
        this.echo(val);
        const r = this.askResolve; this.askResolve = null;
        r(val);
        return;
      }
      this.echo(val);
      Game.onCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.histIdx > 0) { this.histIdx--; this.input.value = this.history[this.histIdx] || ''; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.histIdx < this.history.length) { this.histIdx++; this.input.value = this.history[this.histIdx] || ''; }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.tabComplete();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      Game.onCommand('clear');
    }
  }
  ask(promptText) {
    if (this.askResolve) return Promise.resolve('');
    this.setPrompt(promptText);
    return new Promise((res) => { this.askResolve = res; });
  }
  tabComplete() {
    const val = this.input.value;
    const parts = val.split(' ');
    const partial = (parts[parts.length - 1] || '').toLowerCase();
    if (!partial) return;
    const cands = completionCandidates(partial);
    if (cands.length === 1) {
      parts[parts.length - 1] = cands[0];
      this.input.value = parts.join(' ');
    } else if (cands.length > 1) {
      T.print('候选: ' + cands.join('  '), 'dim');
    } else {
      Sound.err();
    }
  }
}

/* ---------- Tab 补全候选 ---------- */
function completionCandidates(partial) {
  const set = new Set(Object.keys(GLOBAL_COMMANDS));
  const lvl = Game.active;
  if (lvl) {
    if (lvl.commands) Object.keys(lvl.commands).forEach((c) => set.add(c));
    const sc = activeScenario();
    if (sc && sc.commands) Object.keys(sc.commands).forEach((c) => set.add(c));
    Object.keys(mergedFs()).forEach((f) => set.add(f));
  }
  return [...set].filter((c) => c.toLowerCase().startsWith(partial)).sort();
}

/* ---------- 游戏状态 ---------- */
const Game = {
  levels: [],
  active: null,
  xp: 0,
  hintsUsed: 0,
  flagsFound: new Set(),
  achievements: new Set(),
  cardsRead: new Set(),
  quizzesDone: new Set(),
  challengesDone: new Set(),
  activeChallenge: null,
  startedAt: 0,
  inIntro: false,
  hasStarted: false,
  browsing: null,
  browserLine: null,
  labRows: null,
  remote: false,
  showPanel: true,
  scenario: null, // 当前激活的扩展任务场景 id
  mistakes: [],          // 错题本 [{type, id, ...}]
  mistakesTotal: 0,      // 历史错题总数 (用于清零成就)
  challengeRecords: {},  // {id: {bestMs, errors, count}}
  guideShown: false,     // 新手引导是否已展示
  save() { saveGame(); },
  onCommand(line) { handleCommand(line); },
};

const GLOBAL_COMMANDS = {}; // 全局命令注册表

const RANKS = [
  [0, '见习特工'],
  [100, '初级渗透员'],
  [250, '网络侦察兵'],
  [500, '白帽黑客'],
  [900, '安全专家'],
  [1400, '赛博传奇'],
];

const ACHIEVEMENTS = {
  first_command: { name: '第一行命令', desc: '输入了你的第一条命令', icon: '⌨️' },
  graduate: { name: '顺利毕业', desc: '完成新兵训练', icon: '🎓' },
  recon_pro: { name: '侦察尖兵', desc: '完成网络侦察任务', icon: '📡' },
  codebreaker: { name: '密码破译者', desc: '完成密码破译任务', icon: '🔓' },
  web_pwner: { name: 'Web 杀手', desc: '完成 Web 渗透任务', icon: '🕸️' },
  patcher_king: { name: '补丁之王', desc: '完成逆向工程任务', icon: '🛠️' },
  forensic_master: { name: '取证大师', desc: '完成数字取证任务', icon: '🔬' },
  total_pwn: { name: '终极渗透者', desc: '完成终极渗透考核', icon: '👑' },
  password_lover: { name: '爆破专家', desc: '成功字典爆破一个密码哈希', icon: '💥' },
  scholar: { name: '学无止境', desc: '阅读 5 张以上知识卡片', icon: '📚' },
  zero_hint: { name: '无师自通', desc: '全程不使用提示通关', icon: '🧠' },
  speed_run: { name: '闪电渗透', desc: '40 分钟内通关', icon: '⚡' },
  student: { name: '勤学善思', desc: '通过一次课后测验', icon: '📖' },
  quiz_master: { name: '满腹经纶', desc: '完成全部课程测验', icon: '🎖️' },
  lab_ranger: { name: '靶场巡警', desc: '成功连接本地真实靶场', icon: '🏁' },
  real_pwn: { name: '真枪实弹', desc: '在真实靶场上完成 Web 渗透', icon: '🔥' },
  challenger: { name: '小试牛刀', desc: '完成任意一个实战挑战', icon: '🎯' },
  challenge_master: { name: '挑战大师', desc: '完成全部实战挑战', icon: '🏆' },
  blue_team: { name: '蓝队新星', desc: '完成应急响应任务', icon: '🛡️' },
  malware_hunter: { name: '恶意猎手', desc: '完成恶意文件分析任务', icon: '🦠' },
  demo_student: { name: '好学生', desc: '观看过一次示例教学', icon: '🎬' },
  scenario_clear: { name: '任务达人', desc: '完成任意一个扩展任务场景', icon: '🧩' },
  explorer: { name: '探索者', desc: '完成全部扩展任务场景', icon: '🗺️' },
  ai_hunter: { name: 'AI 猎手', desc: '完成 AI 安全任务', icon: '🤖' },
  mistake_cleaner: { name: '知错能改', desc: '把错题本全部清零', icon: '🧽' },
};

/* ---------- 游戏流程 ---------- */
function rankOf(xp) {
  let r = RANKS[0][1];
  for (const [m, n] of RANKS) if (xp >= m) r = n;
  return r;
}

function award(xp, why) {
  Game.xp += xp;
  T.print(`  [+${xp} XP] ${why}`, 'info');
  Game.save();
  updateHud();
}

/* ---------- 多场景系统 ---------- */
function activeScenario() {
  const lvl = Game.active;
  if (!lvl || !Game.scenario || !lvl.scenarios) return null;
  return lvl.scenarios.find((s) => s.id === Game.scenario) || null;
}
function activeObjectives() {
  const lvl = Game.active;
  if (!lvl) return [];
  const sc = activeScenario();
  if (sc && sc.objectives) return sc.objectives;
  return lvl.objectives || [];
}
function activeHints() {
  const sc = activeScenario();
  if (sc && sc.hints) return sc.hints;
  const lvl = Game.active;
  return lvl ? lvl.hints : null;
}
function scenarioCount(lvl) {
  return lvl && lvl.scenarios ? lvl.scenarios.length : 0;
}
function scenariosDoneCount(lvl) {
  return lvl && lvl.scenarios ? lvl.scenarios.filter((s) => s.done).length : 0;
}
/* 场景钩子优先于关卡钩子 */
function callHook(name) {
  const args = Array.prototype.slice.call(arguments, 1);
  const lvl = Game.active;
  if (!lvl) return;
  const sc = activeScenario();
  if (sc && typeof sc[name] === 'function') sc[name].apply(sc, args);
  if (typeof lvl[name] === 'function') lvl[name].apply(lvl, args);
}

function completeObjective(id) {
  const objs = activeObjectives();
  const o = objs.find((x) => x.id === id);
  if (!o || o.done) return;
  o.done = true;
  T.print(`✔ 目标完成: ${o.desc}`, 'success');
  Sound.ok();
  award(o.xp || 50, '任务目标');
  maybeWin();
}

function maybeWin() {
  const lvl = Game.active;
  if (!lvl) return;
  // 场景进行中即使主线已通关也继续结算 (扩展场景在通关后仍可做)
  if (lvl.won && !activeScenario()) return;
  const objs = activeObjectives();
  if (!objs.length) return;
  if (!objs.every((o) => o.done)) return;
  const sc = activeScenario();
  if (sc) scenarioDone(sc);
  else winLevel(lvl);
}

function scenarioDone(sc) {
  sc.done = true;
  Game.scenario = null;
  T.print(`✔ 扩展任务场景完成: ${sc.title}!`, 'success');
  Sound.good();
  award(sc.xpBonus || 100, '扩展场景');
  unlockAchievement('scenario_clear');
  const lvl = Game.active;
  if (lvl && lvl.scenarios && lvl.scenarios.every((s) => s.done)) unlockAchievement('explorer');
  T.print('输入 scenario 查看其它场景，或输入 mission 回到主线任务。', 'dim');
  updateHud();
  Game.save();
}

GLOBAL_COMMANDS['scenario'] = async (toks) => {
  const lvl = Game.active;
  if (!lvl || !lvl.scenarios || !lvl.scenarios.length) {
    T.print('本关没有扩展任务场景。', 'info');
    return;
  }
  const arg = (toks[1] || '').toLowerCase();
  if (arg === 'main') {
    Game.scenario = null;
    T.print('已切回主线任务。', 'info');
    updateHud();
    return;
  }
  const n = parseInt(arg, 10);
  if (!n) {
    T.print(`═══ 本关任务场景 (主线 + ${lvl.scenarios.length} 个扩展) ═══`, 'header');
    T.print(`  [主] ${lvl.name} (主线) ${lvl.won ? '✔' : (Game.scenario === null ? '▶' : '')}`, Game.scenario === null ? 'info' : 'dim');
    lvl.scenarios.forEach((s, i) => {
      const st = s.done ? '✔ 完成' : (Game.scenario === s.id ? '▶ 进行中' : '· 未完成');
      T.print(`  [${i + 1}] ${s.title} (+${s.xpBonus || 100} XP) ${st}`, s.done ? 'success' : (Game.scenario === s.id ? 'info' : 'cmd'));
    });
    T.print('用法: scenario <编号> 切换到该场景; scenario main 回主线; mission 查看当前场景目标', 'cmd');
    return;
  }
  const sc = lvl.scenarios[n - 1];
  if (!sc) { T.print('场景编号无效。', 'error'); return; }
  if (sc.done) { T.print('该场景已完成。', 'info'); return; }
  Game.scenario = sc.id;
  T.print(`═══ 扩展场景 ${n}: ${sc.title} ═══`, 'header');
  sc.brief.split('\n').forEach((l) => T.print('  ' + l, 'normal'));
  T.print('任务目标:', 'info');
  sc.objectives.forEach((o) => T.print(`  ${o.done ? '[✔]' : '[ ]'} ${o.desc}`, o.done ? 'success' : 'pending'));
  if (sc.hints && sc.hints.length) T.print('卡住可用 hint (场景提示)。', 'dim');
  updateHud();
};
GLOBAL_COMMANDS['scenario'].usage = 'scenario [编号|main] — 切换本关任务场景';

function unlockAchievement(key) {
  if (Game.achievements.has(key)) return;
  const a = ACHIEVEMENTS[key];
  if (!a) return;
  Game.achievements.add(key);
  T.print(`🏆 成就解锁: ${a.name} — ${a.desc}`, 'achievement');
  Sound.good();
  award(50, '成就');
}

async function winLevel(lvl) {
  if (lvl.won) return;
  lvl.won = true;
  T.newline();
  T.print('════════════════════════════════════', 'success');
  T.print(`  [任务完成] L${lvl.id} ${lvl.name}`, 'success');
  T.print('════════════════════════════════════', 'success');
  Sound.good();
  if (lvl.winAch) unlockAchievement(lvl.winAch);
  Game.save();
  updateHud();
  const last = Game.levels[Game.levels.length - 1].id;
  if (lvl.id === last) {
    await endGame();
  } else {
    T.print('输入 next 进入下一关；或使用 learn 阅读本关知识卡片。', 'dim');
    if (typeof Lab !== 'undefined' && Lab.available) {
      T.print('实战进阶: 到真实靶场用真实工具练习本关技术 — 输入 lab 查看。', 'dim');
    }
  }
}

async function loadLevel(id, resumed = false) {
  const lvl = Game.levels.find((l) => l.id === id);
  if (!lvl) return;
  Game.active = lvl;
  Game.scenario = null;
  Game.remote = false;
  Game.browsing = null;
  Game.browserLine = null;
  T.setPrompt(lvl.prompt);
  updateHud();
  if (resumed) {
    T.print(`[进度恢复] 任务 L${lvl.id} ${lvl.name}`, 'info');
    T.print('输入 mission 查看目标，输入 help 查看命令。', 'dim');
    return;
  }
  Game.inIntro = true;
  await lvl.intro(T);
  Game.inIntro = false;
  const demo = (typeof DEMO_FOR_LEVEL !== 'undefined' && DEMO_FOR_LEVEL[lvl.id]) ? DEMO_FOR_LEVEL[lvl.id] : null;
  if (demo) T.print(`新手建议: 先看示例教学 demo ${demo} (输入 demo 查看全部演示)`, 'dim');
  T.print('输入 mission 查看任务目标；卡住时用 hint (共 3 级) 或 course 学原理。', 'dim');
  Game.save();
}

async function endGame() {
  unlockAchievement('total_pwn');
  if (Game.hintsUsed === 0) unlockAchievement('zero_hint');
  const mins = Math.max(1, Math.round((Date.now() - Game.startedAt) / 60000));
  if (mins <= 40) unlockAchievement('speed_run');
  T.newline(2);
  await T.typeLines([
    '┌───────────────────────────────────────────┐',
    '│      M I S S I O N   C O M P L E T E      │',
    '└───────────────────────────────────────────┘',
  ], 'success', 14);
  T.newline();
  T.print(`最终等级: ${rankOf(Game.xp)}     总 XP: ${Game.xp}     总用时: ${mins} 分钟`, 'info');
  T.print('你已走完从新兵到渗透者的全部课程。', 'normal');
  T.print('记住: 白帽与黑帽的区别，不在技术，而在选择。', 'info');
  T.print(`知识卡片阅读: ${Game.cardsRead.size} 张     已收集成就: ${Game.achievements.size}/${Object.keys(ACHIEVEMENTS).length}`, 'dim');
  T.print('输入 reset 可以重新开始游戏。', 'dim');
  Game.save();
}

function updateHud() {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const lvl = Game.active;
  const lvlTxt = lvl ? `L${lvl.id} ${lvl.name}` : '待命';
  let labTxt = '靶场: 离线';
  if (typeof Lab !== 'undefined' && Lab.available) labTxt = '靶场: 在线';
  const parts = [
    `任务: ${lvlTxt}`,
    `XP: ${Game.xp}`,
    `等级: ${rankOf(Game.xp)}`,
    `Flag: ${Game.flagsFound.size}/${Game.levels.length}`,
    `提示: ${Game.hintsUsed}`,
    labTxt,
  ];
  hud.textContent = parts.join('   |   ');
  renderObjPanel();
}

/* 右上角常驻任务面板 */
function renderObjPanel() {
  const panel = document.getElementById('objpanel');
  if (!panel) return;
  if (!Game.showPanel || !Game.hasStarted || !Game.active) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  panel.textContent = '';
  const lvl = Game.active;
  const sc = activeScenario();
  const title = document.createElement('div');
  title.className = 'op-title';
  title.textContent = `🎯 L${lvl.id} ${lvl.name}` + (sc ? ` · ${sc.title}` : ' · 主线');
  panel.appendChild(title);
  if (!sc && scenarioCount(lvl)) {
    const scLine = document.createElement('div');
    scLine.className = 'op-item op-pending';
    scLine.textContent = `扩展场景 ${scenariosDoneCount(lvl)}/${scenarioCount(lvl)} (scenario 查看)`;
    panel.appendChild(scLine);
  }
  if (lvl.won && !sc) {
    const w = document.createElement('div');
    w.className = 'op-item op-done';
    w.textContent = '✔ 本关已完成 — 输入 next 进入下一关';
    panel.appendChild(w);
  }
  activeObjectives().forEach((o) => {
    const el = document.createElement('div');
    el.className = 'op-item ' + (o.done ? 'op-done' : 'op-pending');
    el.textContent = (o.done ? '✔ ' : '· ') + o.desc;
    panel.appendChild(el);
  });
}

GLOBAL_COMMANDS['panel'] = (toks) => {
  const v = (toks[1] || '').toLowerCase();
  if (v === 'on') Game.showPanel = true;
  else if (v === 'off') Game.showPanel = false;
  else { T.print(`任务面板: ${Game.showPanel ? '开' : '关'} — 用法: panel on|off`, 'info'); return; }
  try { localStorage.setItem('cyber-panel', Game.showPanel ? '1' : '0'); } catch (e) { /* 忽略 */ }
  T.print(`✔ 任务面板已${Game.showPanel ? '开启' : '关闭'}`, 'info');
  updateHud();
  Game.save();
};
GLOBAL_COMMANDS['panel'].usage = 'panel on|off — 右上角任务面板开关';

async function askLine(promptText) {
  const v = await T.ask(promptText);
  T.setPrompt(Game.active ? Game.active.prompt : 'guest@cyber:~$');
  return v;
}

/* ---------- 命令分发 ---------- */
async function handleCommand(line) {
  const toks = tokenize(line);
  const cmd = (toks[0] || '').toLowerCase();
  if (!cmd) return;
  Sound.ensure();
  if (cmd !== 'clear') Sound.click();
  if (cmd === 'clear') { T.clear(); Game.save(); return; }
  if (Game.inIntro) { T.print('系统正在初始化，请稍候...', 'dim'); return; }
  let handler = GLOBAL_COMMANDS[cmd];
  // 场景命令优先于关卡命令 (允许扩展场景覆盖/新增)
  if (!handler && Game.active && Game.active.scenarios && Game.scenario) {
    const sc = Game.active.scenarios.find((s) => s.id === Game.scenario);
    if (sc && sc.commands && sc.commands[cmd]) handler = sc.commands[cmd];
  }
  if (!handler && Game.active && Game.active.commands) handler = Game.active.commands[cmd];
  if (handler) {
    try {
      await handler(toks);
    } catch (err) {
      console.error(err);
      T.print('内部错误: ' + (err && err.message ? err.message : err), 'error');
    }
  } else {
    T.print(`命令未找到: ${cmd} — 输入 help 查看可用命令`, 'error');
    Sound.err();
  }
  updateHud();
  Game.save();
}

/* =========================================================
 * 虚拟文件系统
 * ========================================================= */
function mergedFs() {
  const lvl = Game.active;
  if (!lvl) return {};
  let sfs = {};
  const sc = activeScenario();
  if (sc && sc.fs) sfs = sc.fs;
  return Object.assign({}, lvl.fs || {}, sfs, lvl.fsRemote || {});
}
function toBytes(data) {
  if (typeof data === 'string') return strToBytes(data);
  if (data instanceof Uint8Array) return data;
  if (data && Array.isArray(data.bytes)) return Uint8Array.from(data.bytes);
  if (data && typeof data.bytes === 'string') return strToBytes(data.bytes);
  return new Uint8Array(0);
}
function getFile(name) {
  const fs = mergedFs();
  if (!(name in fs)) { T.print(`文件不存在: ${name}`, 'error'); return null; }
  return { name, bytes: toBytes(fs[name]) };
}
function fileSize(data) { return toBytes(data).length; }

GLOBAL_COMMANDS['ls'] = (toks) => {
  const fs = mergedFs();
  const keys = Object.keys(fs);
  if (!keys.length) { T.print('(目录为空)', 'dim'); return; }
  keys.forEach((k) => {
    const b = toBytes(fs[k]);
    const type = isProbablyBinary(b) ? 'binary' : 'text';
    T.print(`${String(b.length).padStart(6)}  ${isProbablyBinary(b) ? '#' : '·'}  ${k}   (${type})`, 'cmd');
  });
};

GLOBAL_COMMANDS['cat'] = (toks) => {
  const name = toks[1];
  if (!name) { T.print('用法: cat <文件>', 'info'); return; }
  const f = getFile(name);
  if (!f) return;
  if (isProbablyBinary(f.bytes)) {
    T.print('⚠ 该文件是二进制数据，已尝试文本解码:', 'error');
    let s = '';
    for (let i = 0; i < Math.min(f.bytes.length, 600); i++) {
      const c = f.bytes[i];
      s += (c >= 32 && c < 127) || c === 10 || c === 13 ? String.fromCharCode(c) : '·';
    }
    s.split('\n').forEach((l) => T.print(l, 'normal'));
    T.print('(提示: 试试 file / hexdump / strings 分析二进制)', 'dim');
  } else {
    bytesToStr(f.bytes).split('\n').forEach((l) => T.print(l, 'normal'));
  }
  callHook('onCatFile', name, bytesToStr(f.bytes));
};

GLOBAL_COMMANDS['file'] = (toks) => {
  const name = toks[1];
  if (!name) { T.print('用法: file <文件>', 'info'); return; }
  const f = getFile(name);
  if (!f) return;
  const b = f.bytes;
  const sigs = [
    { m: [0x7f, 0x45, 0x4c, 0x46], n: 'ELF 可执行文件' },
    { m: [0xff, 0xd8, 0xff], n: 'JPEG 图像' },
    { m: [0x89, 0x50, 0x4e, 0x47], n: 'PNG 图像' },
    { m: [0x50, 0x4b], n: 'ZIP 压缩包' },
    { m: [0x4d, 0x5a], n: 'PE 可执行文件 (Windows)' },
    { m: [0x25, 0x50, 0x44, 0x46], n: 'PDF 文档' },
  ];
  let kind = '数据文件';
  for (const s of sigs) {
    if (s.m.every((v, i) => b[i] === v)) { kind = s.n; break; }
  }
  T.print(`${name}: ${kind} (${b.length} 字节)`, 'info');
  // 全镜像内签名扫描
  const found = [];
  for (const s of sigs) {
    let i = b.indexOf(s.m[0]);
    while (i !== -1 && i < b.length) {
      if (s.m.every((v, j) => b[i + j] === v)) { found.push(`${s.n} @ 0x${hex(i)}`); break; }
      i = b.indexOf(s.m[0], i + 1);
    }
  }
  if (found.length) {
    T.print('  镜像内签名扫描:', 'dim');
    found.forEach((x) => T.print('    └─ ' + x, 'cmd'));
  }
  if (isProbablyBinary(b)) T.print('  提示: 试试 strings / tail / hexdump', 'dim');
  callHook('onFileDetect');
};

GLOBAL_COMMANDS['strings'] = (toks) => {
  const name = toks[1];
  if (!name) { T.print('用法: strings <文件>', 'info'); return; }
  const f = getFile(name);
  if (!f) return;
  const runs = [];
  let cur = '';
  const flush = () => { if (cur.length >= 4) runs.push(cur); cur = ''; };
  for (const c of f.bytes) {
    if ((c >= 32 && c <= 126) || c === 9) cur += String.fromCharCode(c);
    else flush();
  }
  flush();
  if (!runs.length) { T.print('未提取到可读字符串。', 'dim'); return; }
  T.print(`共提取 ${runs.length} 个字符串:`, 'info');
  runs.forEach((r) => T.print('  ' + r, 'cmd'));
  callHook('onStrings', runs);
};

GLOBAL_COMMANDS['tail'] = (toks) => {
  const name = toks[1];
  if (!name) { T.print('用法: tail <文件> [字节数]', 'info'); return; }
  const f = getFile(name);
  if (!f) return;
  const n = toks[2] ? (parseInt(toks[2], 10) || 128) : 128;
  const slice = f.bytes.slice(-Math.min(n, f.bytes.length));
  T.print(`${name} 末尾 ${slice.length} 字节:`, 'info');
  let s = '';
  for (const c of slice) s += (c >= 32 && c < 127) || c === 10 || c === 13 ? String.fromCharCode(c) : '.';
  s.split('\n').forEach((l) => T.print('  ' + l, 'cmd'));
  callHook('onTail', slice);
};

GLOBAL_COMMANDS['hexdump'] = (toks) => {
  const name = toks[1];
  if (!name) { T.print('用法: hexdump <文件> [起始偏移(16进制)]', 'info'); return; }
  const f = getFile(name);
  if (!f) return;
  const start = toks[2] ? (parseInt(toks[2], 16) || 0) : 0;
  const b = f.bytes;
  if (start >= b.length) { T.print('偏移超出文件长度。', 'error'); return; }
  const maxLines = 24;
  let lines = 0;
  for (let off = start; off < b.length && lines < maxLines; off += 16) {
    const chunk = b.slice(off, off + 16);
    const hx = Array.from(chunk).map(hex).join(' ').padEnd(47, ' ');
    const asc = Array.from(chunk).map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : '.')).join('');
    T.print(`${pad(off, 8)}  ${hx}  |${asc}|`, 'cmd');
    lines++;
  }
  if (b.length - start > maxLines * 16) T.print(`  ... (共 ${b.length} 字节，仅显示前 ${lines * 16} 字节)`, 'dim');
};

/* =========================================================
 * 全局命令 (注册表声明见文件头部)
 * ========================================================= */

/* 帮助索引: 命令 → 简要说明 (help <关键词> 检索用) */
const HELP_INDEX = [
  ['help', '查看帮助 (help <关键词> 可检索)'], ['mission', '查看当前任务目标'], ['hint', '3级渐进提示'],
  ['learn', '本关知识卡片'], ['status', '角色状态与成就'], ['levels', '关卡列表'], ['map', '学习进度地图'],
  ['course', '课本式课程 (course <n> <章>)'], ['quiz', '课后测验'], ['demo', '示例教学 (demo <主题>)'],
  ['docs', '知识手册 (docs <章> / docs term <词>)'], ['tools', '工具箱 (tools <命令> 手册)'],
  ['challenge', '实战挑战大厅'], ['scenario', '切换扩展任务场景'], ['next', '进入下一关'],
  ['lab', '本地靶场 (lab get/exec/read)'], ['browser', '打开真实浏览器窗口'], ['ai', '实验室 AI 聊天'],
  ['submit', '提交 flag 或答案'], ['mistakes', '错题本回顾'], ['board', '挑战排行榜'], ['export', '导出学习报告'],
  ['theme', '切换界面主题'], ['panel', '任务面板开关'], ['sound', '音效开关'], ['guide', '新手引导'],
  ['ls', '列出文件'], ['cat', '查看文件内容'], ['file', '识别文件类型'], ['strings', '提取可读字符串'],
  ['tail', '查看文件末尾'], ['hexdump', '十六进制查看'], ['b64', 'Base64 编解码'], ['rot13', 'ROT13 移位'],
  ['caesar', '凯撒密码'], ['vig', '维吉尼亚密码'], ['xor', '异或运算'], ['md5', 'MD5 哈希'], ['sha256', 'SHA-256 哈希'],
  ['crack', '字典爆破哈希'], ['scan', '网络扫描'], ['banner', '抓取服务指纹'], ['connect', '连接服务器'],
  ['web', '打开目标网站'], ['login', '登录目标'], ['search', '站内搜索'], ['dump', '导出数据'], ['logout', '退出登录'],
  ['disasm', '反汇编'], ['analyze', '分析程序'], ['patch', '修改二进制'], ['run', '运行程序'],
  ['quarantine', '隔离可疑文件'], ['ask', '和 AI 对话'],
  ['start', '开始游戏'], ['resume', '恢复进度'], ['save', '保存进度'], ['reset', '重置进度'],
  ['clear', '清屏'], ['credits', '制作信息'],
];

GLOBAL_COMMANDS['help'] = (toks) => {
  const kw = (toks[1] || '').toLowerCase();
  if (kw) {
    const hits = HELP_INDEX.filter(([c, d]) => c.includes(kw) || d.includes(kw));
    if (!hits.length) { T.print(`没有找到与 "${kw}" 相关的命令。输入 help 查看全部。`, 'error'); return; }
    T.print(`═══ 命令检索: "${kw}" (${hits.length} 条) ═══`, 'header');
    hits.forEach(([c, d]) => T.print(`  ${c.padEnd(12)} ${d}`, 'cmd'));
    return;
  }
  T.print('═══ 命令帮助 (分层) ═══  Tab 可补全命令, help <关键词> 可检索', 'header');
  const groups = [
    ['🎯 任务与进度', ['mission', 'hint', 'scenario', 'next', 'map', 'status', 'levels']],
    ['📚 学习中心', ['course', 'quiz', 'demo', 'docs', 'learn', 'tools', 'challenge', 'mistakes', 'guide']],
    ['💾 文件操作', ['ls', 'cat', 'file', 'strings', 'tail', 'hexdump']],
    ['🔐 密码学工具', ['b64', 'rot13', 'caesar', 'vig', 'xor', 'md5', 'sha256', 'crack']],
    ['🧰 靶场与真实工具', ['lab', 'browser', 'ai', 'submit', 'board', 'export']],
    ['🎨 界面与系统', ['theme', 'panel', 'sound', 'clear', 'credits']],
    ['🔄 游戏流程', ['start', 'resume', 'save', 'reset', 'help']],
  ];
  groups.forEach(([title, cmds]) => {
    T.print(title + ':', 'info');
    cmds.forEach((c) => {
      const hit = HELP_INDEX.find(([cc]) => cc === c);
      T.print(`  ${c.padEnd(10)} ${hit ? hit[1] : ''}`, 'cmd');
    });
  });
  const lvl = Game.active;
  if (lvl && lvl.commands) {
    T.print(`当前任务 [L${lvl.id} ${lvl.name}] 专属命令:`, 'info');
    Object.keys(lvl.commands).forEach((k) => {
      const c = lvl.commands[k];
      if (c.usage) T.print('  ' + c.usage, 'cmd');
    });
  }
  T.print('输入 mission 查看任务目标; help <关键词> 检索命令', 'dim');
};

GLOBAL_COMMANDS['mission'] = (toks) => {
  const lvl = Game.active;
  if (!lvl) { T.print('当前没有进行中的任务。输入 start 开始游戏。', 'info'); return; }
  if (lvl.scenarios && lvl.scenarios.length && !Game.scenario) {
    T.print(`═══ [任务 L${lvl.id}] ${lvl.name} (主线) ═══`, 'header');
    lvl.brief.split('\n').forEach((l) => T.print('  ' + l, 'normal'));
    T.print('任务目标:', 'info');
    lvl.objectives.forEach((o) => {
      T.print(`  ${o.done ? '[✔]' : '[ ]'} ${o.desc}`, o.done ? 'success' : 'pending');
    });
    if (scenarioCount(lvl)) {
      T.print(`扩展场景: ${scenariosDoneCount(lvl)}/${scenarioCount(lvl)} 已完成 — 输入 scenario 查看`, 'dim');
    }
    return;
  }
  const sc = activeScenario();
  if (sc) {
    T.print(`═══ [任务 L${lvl.id}] 扩展场景: ${sc.title} ═══`, 'header');
    sc.brief.split('\n').forEach((l) => T.print('  ' + l, 'normal'));
  } else {
    T.print(`═══ [任务 L${lvl.id}] ${lvl.name} ═══`, 'header');
    lvl.brief.split('\n').forEach((l) => T.print('  ' + l, 'normal'));
  }
  T.print('任务目标:', 'info');
  activeObjectives().forEach((o) => {
    T.print(`  ${o.done ? '[✔]' : '[ ]'} ${o.desc}`, o.done ? 'success' : 'pending');
  });
  if (!sc && scenarioCount(lvl)) T.print(`扩展场景: ${scenariosDoneCount(lvl)}/${scenarioCount(lvl)} — 输入 scenario 查看`, 'dim');
};

GLOBAL_COMMANDS['hint'] = (toks) => {
  // 挑战进行中: 直接给出该挑战的提示
  if (Game.activeChallenge) {
    const ch = Game.activeChallenge;
    const c = CHALLENGES.find((x) => x.id === ch.id);
    if (c) {
      T.print('💡 挑战提示: ' + c.hint, 'hint');
      Game.hintsUsed++;
      Game.save();
      return;
    }
  }
  const lvl = Game.active;
  const hints = activeHints();
  if (!lvl || !hints || !hints.length) { T.print('当前没有可用的提示。', 'info'); return; }
  // 已用完全部提示: 不再展示也不再扣分
  if ((lvl.hintLevel || 0) >= hints.length) { T.print('已使用完所有提示 — 建议复习 course 或试试 demo。', 'info'); return; }
  const idx = lvl.hintLevel || 0;
  const level = idx + 1;
  if (!lvl.hintUsed) { lvl.hintUsed = true; Game.hintsUsed++; }
  T.print(`💡 提示 ${level}/${hints.length}: ${hints[idx]}`, 'hint');
  if (level >= 2) {
    const penalty = level === 2 ? 10 : 20;
    Game.xp = Math.max(0, Game.xp - penalty);
    T.print(`  (第 ${level} 级提示: -${penalty} XP)`, 'dim');
  }
  if (level >= hints.length) {
    T.print('  (这是最终答案提示 — 建议先自己试! 使用任何提示都会失去「无师自通」成就)', 'error');
  }
  lvl.hintLevel = idx + 1;
  updateHud();
  Game.save();
};

GLOBAL_COMMANDS['learn'] = async (toks) => {
  const lvl = Game.active;
  if (!lvl || !lvl.learn || !lvl.learn.length) { T.print('本关没有知识卡片。', 'info'); return; }
  const n = parseInt(toks[1], 10);
  if (!n) {
    T.print(`本关知识卡片 (共 ${lvl.learn.length} 张):`, 'info');
    lvl.learn.forEach((c, i) => T.print(`  [${i + 1}] ${c.t}`, 'cmd'));
    T.print('输入 learn <编号> 查看内容', 'dim');
    return;
  }
  const c = lvl.learn[n - 1];
  if (!c) { T.print('编号无效。', 'error'); return; }
  T.print(`── ${c.t} ──`, 'header');
  await T.type(c.b, 'normal', 5);
  const key = `${lvl.id}:${n - 1}`;
  if (!Game.cardsRead.has(key)) {
    Game.cardsRead.add(key);
    if (Game.cardsRead.size >= 5) unlockAchievement('scholar');
    Game.save();
  }
};

GLOBAL_COMMANDS['status'] = (toks) => {
  const lvl = Game.active;
  T.print(`XP: ${Game.xp}     等级: ${rankOf(Game.xp)}`, 'info');
  T.print(`当前任务: ${lvl ? 'L' + lvl.id + ' ' + lvl.name : '未开始'}`, 'info');
  T.print(`已找到 flag: ${Game.flagsFound.size}/${Game.levels.length}     已用提示: ${Game.hintsUsed} 次`, 'info');
  T.print('成就:', 'info');
  Object.keys(ACHIEVEMENTS).forEach((k) => {
    const a = ACHIEVEMENTS[k];
    T.print(`  ${Game.achievements.has(k) ? '🏆' : '·'} ${a.name} — ${a.desc}`, Game.achievements.has(k) ? 'success' : 'dim');
  });
};

GLOBAL_COMMANDS['levels'] = (toks) => {
  Game.levels.forEach((l) => {
    const st = l.won ? '✔ 完成' : (Game.active && Game.active.id === l.id ? '▶ 当前' : '· 未解锁');
    T.print(`  L${l.id}  ${l.name.padEnd(10)} ${st}`, l.won ? 'success' : (Game.active && Game.active.id === l.id ? 'info' : 'dim'));
  });
};

/* ---------- 学习进度地图 ---------- */
GLOBAL_COMMANDS['map'] = (toks) => {
  T.print('═══ 学习进度地图 ═══', 'header');
  T.print('  (关卡主线 + 扩展场景 + 课程/挑战/成就总览)', 'dim');
  Game.levels.forEach((l, i) => {
    const st = l.won ? '✔' : (Game.active && Game.active.id === l.id ? '▶' : '·');
    const sc = scenarioCount(l);
    const scTxt = sc ? `  (扩展场景 ${scenariosDoneCount(l)}/${sc})` : '';
    const line = `  ${st} L${l.id} ${l.name.padEnd(12)}${scTxt}`;
    T.print(line, l.won ? 'success' : (Game.active && Game.active.id === l.id ? 'info' : 'dim'));
    if (i < Game.levels.length - 1) T.print('   │', 'dim');
  });
  T.newline();
  const quizDone = Game.quizzesDone.size;
  T.print(`  课程测验: ${quizDone}/${COURSES.length}   挑战: ${Game.challengesDone.size}/${CHALLENGES.length}`, 'info');
  T.print(`  成就: ${Game.achievements.size}/${Object.keys(ACHIEVEMENTS).length}   XP: ${Game.xp} (${rankOf(Game.xp)})`, 'info');
  T.print('下一步建议: ' + (Game.active && !Game.active.won ? `完成 L${Game.active.id} 主线或扩展场景` : (Game.challengesDone.size < CHALLENGES.length ? '去挑战大厅看看 (challenge)' : (quizDone < COURSES.length ? '补课程测验 (quiz)' : '把 docs 手册翻一遍 (docs)'))), 'hint');
};

/* ---------- 错题本 ---------- */
GLOBAL_COMMANDS['mistakes'] = async (toks) => {
  const list = Game.mistakes;
  if (!list.length) {
    if (Game.mistakesTotal > 0) {
      unlockAchievement('mistake_cleaner');
      T.print('✔ 错题本已清空 — 全部重新答对了! 成就「知错能改」已解锁。', 'success');
    } else {
      T.print('错题本是空的 — 继续保持!', 'info');
    }
    Game.save();
    return;
  }
  const n = parseInt(toks[1], 10);
  if (!n) {
    T.print(`═══ 错题本 (${list.length} 条, 历史共 ${Game.mistakesTotal} 错) ═══`, 'header');
    list.forEach((m, i) => {
      const who = m.type === 'quiz' ? `测验[${m.courseTitle}]` : `挑战[${m.id} ${m.title || ''}]`;
      const what = m.type === 'quiz' ? m.q : m.title;
      T.print(`  [${i + 1}] ${who} — ${what}`, 'cmd');
    });
    T.print('用法: mistakes <编号> 重新作答; 全对清空解锁成就', 'dim');
    return;
  }
  const m = list[n - 1];
  if (!m) { T.print('编号无效。', 'error'); return; }
  if (m.type === 'quiz') {
    T.print('问题: ' + m.q, 'normal');
    // 从课程数据里找回原题(选项顺序不变), 以便判断
    const crs = COURSES.find((c) => c.id === m.courseId);
    const q = crs && crs.quiz.find((x) => x.q === m.q);
    if (q) q.options.forEach((o, i) => T.print(`  ${String.fromCharCode(97 + i)}) ${o}`, 'cmd'));
    const ans = (await askLine('答案 (a/b/c/d): ')).trim().toLowerCase();
    let sel = -1;
    if (ans.length === 1 && ans >= 'a' && ans <= 'd') sel = ans.charCodeAt(0) - 97;
    else sel = parseInt(ans, 10) - 1;
    const isRight = q ? sel === q.answer : (ans === String(m.correct).toLowerCase());
    if (isRight) {
      list.splice(n - 1, 1);
      T.print('✔ 答对了! 已从错题本移除。', 'success');
      Sound.ok();
      award(20, '错题重答');
    } else {
      T.print(`✘ 仍不正确。正确答案: ${q ? q.options[q.answer] : m.correct}`, 'error');
      Sound.err();
    }
    if (m.explain) T.print('  讲解: ' + m.explain, 'dim');
  } else {
    T.print(`挑战[${m.id}] ${m.title} — 提示: ${m.hint || '重试挑战命令' }`, 'normal');
    const ans = (await askLine('答案: ')).trim().toLowerCase();
    if (ans === String(m.answer).toLowerCase()) {
      list.splice(n - 1, 1);
      T.print('✔ 答对了! 已从错题本移除。', 'success');
      Sound.ok();
      award(20, '错题重答');
    } else {
      T.print(`✘ 仍不正确。答案: ${m.answer}`, 'error');
      Sound.err();
    }
  }
  if (!list.length && Game.mistakesTotal > 0) unlockAchievement('mistake_cleaner');
  Game.save();
};
GLOBAL_COMMANDS['mistakes'].usage = 'mistakes [编号] — 错题本回顾重答';

/* ---------- 挑战排行榜 ---------- */
function fmtTime(ms) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`;
}
GLOBAL_COMMANDS['board'] = (toks) => {
  T.print('═══ 挑战排行榜 (本机最佳) ═══', 'header');
  let totalMs = 0;
  let done = 0;
  CHALLENGES.forEach((c) => {
    const r = Game.challengeRecords[c.id];
    const mark = Game.challengesDone.has(c.id) ? '✔' : '·';
    const time = r ? fmtTime(r.bestMs) : '—';
    const errs = r ? String(r.errors) : '—';
    T.print(`  ${mark} [${String(c.id).padStart(2, ' ')}] ${c.title.padEnd(14)} 最佳 ${time}  错误 ${errs}`, Game.challengesDone.has(c.id) ? 'success' : 'dim');
    if (r) { totalMs += r.bestMs; done++; }
  });
  T.newline();
  T.print(`  已完成 ${done}/${CHALLENGES.length} 个挑战, 累计最佳用时 ${fmtTime(totalMs)}`, 'info');
  T.print(`  徽章: ${Game.achievements.has('speed_run') ? '⚡闪电渗透 ' : ''}${Game.achievements.has('zero_hint') ? '🧠无师自通 ' : ''}${Game.achievements.has('challenge_master') ? '🏆挑战大师' : ''}`, 'dim');
};
GLOBAL_COMMANDS['board'].usage = 'board — 挑战排行榜 (本机)';

/* ---------- 导出学习报告 ---------- */
function buildReport() {
  const L = [];
  L.push('# 赛博安全学院 · 学习报告');
  L.push('');
  L.push(`- 生成时间: ${new Date().toLocaleString()}`);
  L.push(`- 等级: ${rankOf(Game.xp)} | XP: ${Game.xp} | 提示使用: ${Game.hintsUsed} 次`);
  L.push('');
  L.push('## 关卡进度');
  Game.levels.forEach((l) => {
    const sc = scenarioCount(l) ? ` (扩展场景 ${scenariosDoneCount(l)}/${scenarioCount(l)})` : '';
    L.push(`- ${l.won ? '✔' : '·'} L${l.id} ${l.name}${sc}`);
  });
  L.push('');
  L.push('## 课程与测验');
  COURSES.forEach((c) => L.push(`- ${Game.quizzesDone.has(c.id) ? '✔' : '·'} course ${c.id} ${c.title}`));
  L.push('');
  L.push('## 挑战');
  CHALLENGES.forEach((c) => {
    const r = Game.challengeRecords[c.id];
    L.push(`- ${Game.challengesDone.has(c.id) ? '✔' : '·'} challenge ${c.id} ${c.title}${r ? ` (最佳 ${fmtTime(r.bestMs)}, 错误 ${r.errors})` : ''}`);
  });
  L.push('');
  L.push('## 成就');
  Object.keys(ACHIEVEMENTS).forEach((k) => {
    if (Game.achievements.has(k)) L.push(`- 🏆 ${ACHIEVEMENTS[k].name} — ${ACHIEVEMENTS[k].desc}`);
  });
  L.push('');
  L.push('## 错题记录');
  (Game.mistakes || []).forEach((m) => L.push(`- ${m.type === 'quiz' ? '测验' : '挑战'} ${m.q || m.title} (正确答案: ${m.correct || m.answer})`));
  L.push('');
  return L.join('\n');
}
GLOBAL_COMMANDS['export'] = (toks) => {
  const md = buildReport();
  T.print('═══ 学习报告 (Markdown) ═══', 'header');
  md.split('\n').forEach((l) => T.print(l, 'normal'));
  try {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cyber-academy-report.md';
    if (document.body) document.body.appendChild(a);
    a.click();
    if (a.parentNode) a.parentNode.removeChild(a);
    T.print('✔ 已下载: cyber-academy-report.md', 'success');
  } catch (e) {
    T.print('(浏览器自动下载不可用 — 可手动复制上方内容存档)', 'dim');
  }
};
GLOBAL_COMMANDS['export'].usage = 'export — 导出学习报告 (Markdown)';

/* ---------- 新手引导 (可随时重看) ---------- */
GLOBAL_COMMANDS['guide'] = (toks) => {
  T.print('═══ 新手引导 · 三步上手 ═══', 'header');
  T.print('  1️⃣  学原理    course 1 1     (第 1 课: 终端入门)');
  T.print('  2️⃣  看示例    demo terminal  (先看教学录像)');
  T.print('  3️⃣  动手打    mission        (看目标, 用 ls / cat 探索)');
  T.newline();
  T.print('  常用入口: challenge 挑战 | docs 手册 | tools 工具箱 | theme 换肤', 'dim');
  T.print('  卡住时:   hint 三级提示 | course 复习 | demo 示例', 'dim');
};

GLOBAL_COMMANDS['submit'] = (toks) => {
  const inp = toks.slice(1).join(' ').trim();
  if (!inp) { T.print('用法: submit <flag 或答案>', 'info'); return; }
  // 挑战模式优先
  if (Game.activeChallenge) {
    const ch = Game.activeChallenge;
    if (String(ch.answer).toLowerCase() === inp.toLowerCase()) {
      completeChallenge();
    } else {
      ch.tries++;
      ch.errors = (ch.errors || 0) + 1;
      T.print('✘ 挑战答案错误。', 'error');
      Sound.err();
      const c = CHALLENGES.find((x) => x.id === ch.id);
      if (c && ch.tries >= 2) T.print('💡 提示: ' + c.hint, 'hint');
    }
    return;
  }
  const lvl = Game.active;
  if (!lvl) { T.print('当前没有任务。', 'info'); return; }
  const sc = activeScenario();
  const flag = sc ? (sc.flag || '') : (lvl.flag || '');
  const answers = sc ? (sc.answers || {}) : (lvl.answers || {});
  if (flag && inp.toLowerCase() === flag.toLowerCase()) {
    if (Game.flagsFound.has(flag)) { T.print('该 flag 已提交过。', 'info'); return; }
    Game.flagsFound.add(flag);
    Sound.good();
    T.print('✔ FLAG 验证通过!', 'success');
    award(100, '提交 flag: ' + flag);
    completeObjective('flag');
    return;
  }
  if (answers && answers[inp.toLowerCase()]) {
    completeObjective(answers[inp.toLowerCase()]);
    return;
  }
  T.print('✘ 验证失败，再想想。', 'error');
  Sound.err();
};

GLOBAL_COMMANDS['next'] = async (toks) => {
  const lvl = Game.active;
  if (!lvl) { await loadLevel(0); return; }
  if (!lvl.won) { T.print('当前任务尚未完成，完成所有目标后再输入 next。', 'error'); return; }
  const last = Game.levels[Game.levels.length - 1].id;
  if (lvl.id >= last) { T.print('已经是最后一关了!', 'info'); return; }
  await loadLevel(lvl.id + 1);
};

GLOBAL_COMMANDS['save'] = (toks) => {
  Game.save();
  T.print('进度已保存。', 'info');
};

GLOBAL_COMMANDS['sound'] = (toks) => {
  const v = (toks[1] || '').toLowerCase();
  if (v === 'on') { Sound.enabled = true; T.print('音效已开启。', 'info'); }
  else if (v === 'off') { Sound.enabled = false; T.print('音效已关闭。', 'info'); }
  else T.print(`音效: ${Sound.enabled ? '开' : '关'} — 用法: sound on|off`, 'info');
};

GLOBAL_COMMANDS['credits'] = (toks) => {
  T.print('═══ 赛博安全学院 ═══', 'header');
  T.print('一款「边玩边学」的网络安全渗透教程游戏', 'normal');
  T.print('内容: 网络侦察 · 密码学 · Web 渗透 · 逆向工程 · 数字取证', 'dim');
  T.print('免责声明: 本游戏所有目标均为虚构，仅供学习研究。', 'info');
};

/* =========================================================
 * 虚拟浏览器 (用于 Web 渗透关卡)
 * ========================================================= */
class FakeWeb {
  constructor(cfg) {
    this.cfg = cfg;
    this.loggedIn = false;
    this.user = null;
    this.page = 'home';
    this.searchTerm = '';
    this.xssFired = false;
    this.cookie = '9f2c1a7b';
  }
  node() {
    const wrap = document.createElement('div');
    wrap.className = 'browser';
    const bar = document.createElement('div');
    bar.className = 'browser-bar';
    const dots = document.createElement('span');
    dots.className = 'b-dots';
    dots.textContent = '● ● ●';
    const title = document.createElement('span');
    title.className = 'b-title';
    title.textContent = `${this.cfg.app} — ${this.cfg.host}`;
    bar.appendChild(dots); bar.appendChild(title);
    const body = document.createElement('div');
    body.className = 'browser-body';
    this.fill(body);
    wrap.appendChild(bar); wrap.appendChild(body);
    return wrap;
  }
  text(body, t, cls) {
    const e = document.createElement('div');
    e.textContent = t;
    if (cls) e.className = cls;
    body.appendChild(e);
    return e;
  }
  fill(body) {
    const h = document.createElement('h3');
    h.textContent = this.cfg.app;
    body.appendChild(h);
    if (!this.loggedIn) {
      this.text(body, '欢迎登录', 'page-title');
      this.text(body, `用户名: [ ${'输入 login <用户> <密码> 登录'.padEnd(24)} ]`, 'form');
      this.text(body, `密码:   [ ${'例如: login admin pass'.padEnd(24)} ]`, 'form');
      this.text(body, '[ 登 录 ]', 'btn');
      this.text(body, '提示: 管理员账户为 admin', 'note');
    } else if (this.page === 'xss') {
      this.text(body, '⚠ 安全警告', 'page-title');
      this.text(body, '页面弹窗: alert(1)', 'xss');
      this.text(body, '脚本执行成功!', 'xss');
      this.text(body, `📡 窃取的会话 Cookie: session=${this.cookie}`, 'xss-cookie');
    } else if (this.page === 'results') {
      this.text(body, `欢迎回来, ${this.user}`, 'page-title');
      this.text(body, `搜索结果: "${this.searchTerm}"`, 'cmd');
      this.text(body, '未找到匹配的事务记录。', 'dim');
      this.text(body, '[搜索] [查询用户] [导出数据]', 'btn');
    } else {
      this.text(body, `欢迎回来, ${this.user} (管理员)`, 'page-title');
      this.text(body, '账户总览', 'sec');
      const hostName = String(this.cfg.host).replace('http://', '');
      this.text(body, `用户: admin    邮箱: admin@${hostName}`, 'cmd');
      this.text(body, '后台工具: [查询用户] [搜索记录] [导出数据(dump)]', 'btn');
      this.text(body, '站内搜索: 试试 search <关键词>', 'note');
    }
  }
  update() {
    const nl = this.node();
    if (Game.browserLine && Game.browserLine.parentNode) {
      Game.browserLine.textContent = ''; // 清空旧内容
      Game.browserLine.appendChild(nl);
    } else {
      Game.browserLine = T.printNode(nl);
    }
    T.scroll();
  }
}
