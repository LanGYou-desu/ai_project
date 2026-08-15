/* DevSaga 网页版 · Glitchworks 工位工作台（原生 JS，零依赖） */
"use strict";

const S = {
  profile: null,
  scenarios: [],
  game: null,
  quizSid: null,
  achSnapshot: new Set(),
  rankSnapshot: null,
  curPid: null,        // 算法题当前编辑的题目 id
  edCodes: {},         // 每题代码缓冲
  passedPids: new Set(),
  problems: [],
};

/* ================= 工具 ================= */
async function api(path, method = "GET", body) {
  const opt = { method, headers: {} };
  if (body !== undefined) {
    opt.headers["Content-Type"] = "application/json";
    opt.body = JSON.stringify(body);
  }
  const r = await fetch(path, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
const $ = s => document.querySelector(s);
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function nl(s) { return esc(s).replace(/\n/g, "<br>"); }
function pad(n, w) { return String(n).padStart(w, "0"); }

/* ================= 音效 ================= */
let muted = localStorage.getItem("devsaga_muted") === "1";
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  return actx;
}
function beep(freq, dur, type = "sine", vol = 0.07, delay = 0) {
  if (muted) return;
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  ok() { beep(660, .08); beep(990, .1, "sine", .06, .08); },
  err() { beep(170, .16, "sawtooth", .05); },
  click() { beep(440, .04, "square", .03); },
  level() { [523, 659, 784, 1047].forEach((f, i) => beep(f, .12, "sine", .06, i * .09)); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, .14, "triangle", .07, i * .11)); },
  coin() { beep(988, .06, "square", .04); beep(1319, .1, "square", .04, .06); },
};

/* ================= Toast / 彩带 / 模态 ================= */
function toast(text, cls = "") {
  const t = document.createElement("div");
  t.className = "toast " + cls;
  t.textContent = text;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 3200);
}
function confetti(n = 40) {
  const layer = $("#confetti-layer");
  const emojis = ["🎉", "⭐", "✨", "💻", "🚀", "✅"];
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    c.style.left = Math.random() * 100 + "vw";
    c.style.fontSize = (12 + Math.random() * 14) + "px";
    c.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
    c.style.animationDelay = (Math.random() * 0.4) + "s";
    layer.appendChild(c);
    setTimeout(() => c.remove(), 3600);
  }
}
function modal(title, html, opts) {
  const mask = $("#modal-mask"), box = $("#modal");
  box.innerHTML = "";
  if (title) { const h = document.createElement("h3"); h.textContent = title; box.appendChild(h); }
  const body = document.createElement("div");
  body.innerHTML = html;
  box.appendChild(body);
  if (opts && opts.buttons) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;margin-top:16px;justify-content:flex-end;";
    for (const b of opts.buttons) {
      const btn = document.createElement("button");
      btn.className = "mini";
      btn.textContent = b.label;
      btn.onclick = () => { closeModal(); if (b.action) b.action(); };
      row.appendChild(btn);
    }
    box.appendChild(row);
  }
  mask.classList.remove("hidden");
}
function closeModal() { $("#modal-mask").classList.add("hidden"); $("#modal").innerHTML = ""; }

/* ================= 时钟 / 顶栏 / 状态栏 ================= */
function tickClock() {
  const d = new Date();
  $("#clock").textContent = `${pad(d.getHours(),2)}:${pad(d.getMinutes(),2)}:${pad(d.getSeconds(),2)}`;
}
function renderProfile() {
  const p = S.profile, bar = $("#profile-bar");
  const need = p.next_xp || p.xp + 1;
  const xpPct = Math.min(100, Math.round(p.xp / need * 100));
  const enPct = Math.max(0, Math.min(100, p.energy));
  const enCol = p.energy > 40 ? "#d29922" : (p.energy > 15 ? "#d29922" : "#f85149");
  bar.innerHTML = "";
  const mk = html => { const s = document.createElement("span"); s.className = "stat"; s.innerHTML = html; bar.appendChild(s); };
  mk(`👤 <b>${esc(p.name)}</b><span class="chip">${esc(p.rank)}</span>`);
  mk(`<span>绩效 ${p.xp}</span><span class="bar"><i style="width:${xpPct}%"></i></span>`);
  mk(`<span title="能量">☕ ${p.energy}</span><span class="bar energy"><i style="width:${enPct}%;background:${enCol}"></i></span>`);
  mk(`<span>⭐ ${p.reputation}</span>`);
  mk(`<span class="dim" title="技术/沟通/冒险">技${p.stats.tech}·沟${p.stats.comm}·冒${p.stats.risk}</span>`);
  mk(`<span class="chip">难度：${esc(p.difficulty)}</span>`);
  $("#sb-employee").textContent = `员工：${p.name} [${p.rank}]`;
  $("#badge-learned").textContent = p.learned.length || "";
  $("#badge-ach").textContent = p.achievements.length || "";
}
function updateStatus() {
  const g = S.game;
  $("#sb-scenario").textContent = g ? `工单：${g.no} ${g.name}` : "工单：-";
  $("#sb-task").textContent = g && g.task && g.task.title ? `任务：${g.task.index}/${g.task.total}` : "任务：-";
}

/* ================= 视图路由 ================= */
function show(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $("#view-" + view).classList.remove("hidden");
  document.querySelectorAll(".nav").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  window.scrollTo(0, 0);
}
async function goView(view) {
  show(view);
  if (view === "home") renderHome();
  else if (view === "tickets") renderTickets();
  else if (view === "lessons") renderLessons();
  else if (view === "quiz-pick") renderQuizPick();
  else if (view === "achievements") renderAchievements();
  else if (view === "career") renderCareer();
  else if (view === "ending") renderEnding();
  else if (view === "settings") renderSettings();
}

/* ================= 我的工位 ================= */
async function renderHome() {
  const p = S.profile;
  if (!S.scenarios.length) S.scenarios = (await api("/api/scenarios")).scenarios;
  const total = S.scenarios.length;
  const learnedTotal = p.learned ? p.learned.length : 0;
  const achTotal = (await api("/api/achievements")).achievements.length;
  $("#home-hello").textContent = `早上好，${p.name}！今天处理什么工单？`;
  $("#home-tag").textContent = `${total} 个环境 · 80+ 个任务 · 33 道测验 · 每张工单都是真实的排障现场`;
  $("#home-cards").innerHTML = `
    <div class="dash"><span class="ic">🗂</span><div class="num">${p.finished.length}/${total}</div><div class="lbl">已修复工单</div></div>
    <div class="dash green"><span class="ic">📚</span><div class="num">${learnedTotal}</div><div class="lbl">已掌握知识点</div></div>
    <div class="dash yellow"><span class="ic">🏆</span><div class="num">${p.achievements.length}/${achTotal}</div><div class="lbl">成就</div></div>
    <div class="dash magenta"><span class="ic">⚡</span><div class="num">${p.xp}</div><div class="lbl">绩效 XP · ${esc(p.rank)}</div></div>`;
  const news = $("#home-news");
  news.innerHTML = "";
  const items = [];
  p.finished.slice(-5).reverse().forEach(id => {
    const sc = S.scenarios.find(s => s.id === id);
    if (sc) items.push({ t: "工单已修复", txt: `《${sc.name}》· 最佳 ${(p.best[id]||{}).score || 0} 分` });
  });
  Object.entries(p.quiz || {}).slice(-3).reverse().forEach(([sid, v]) => {
    const sc = S.scenarios.find(s => s.id === sid);
    if (sc) items.push({ t: "测验", txt: `《${sc.name}》 ${v}/3` });
  });
  if (!items.length) items.push({ t: "新的一天", txt: "去「工单台」接第一单吧！" });
  items.slice(0, 6).forEach(it => {
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML = `<span class="t">${esc(it.t)}</span><span>${esc(it.txt)}</span>`;
    news.appendChild(d);
  });
}

/* ================= 工单台 ================= */
const REPORTERS = {
  terminal_master: "运维老王", git_quest: "开发阿强", debug_detective: "QA 阿花",
  sql_rescue: "数据分析小美", sysadmin_er: "监控系统", algo_arena: "面试官",
  network_sleuth: "客户", container_storm: "运维老王", pipeline_deploy: "PM 小美",
  frontend_magic: "设计师", security_fortress: "安全扫描系统",
};
function ticketMeta(sc, idx) {
  const prio = sc.difficulty === 3 ? "P0" : (sc.difficulty === 2 ? "P1" : "P2");
  return { no: "DEV-" + pad(idx + 1, 3), prio, reporter: REPORTERS[sc.id] || "未知", idx };
}
async function renderTickets() {
  if (!S.scenarios.length) S.scenarios = (await api("/api/scenarios")).scenarios;
  const done = S.scenarios.filter(s => s.done).length;
  $("#ticket-summary").textContent = `共 ${S.scenarios.length} 单 · 已修复 ${done} 单`;
  const grid = $("#ticket-grid");
  grid.innerHTML = "";
  S.scenarios.forEach((sc, i) => {
    const m = ticketMeta(sc, i);
    const card = document.createElement("div");
    card.className = "ticket" + (sc.done ? " done" : "");
    card.innerHTML = `
      <div class="tk-head"><span class="tk-no">${m.no} · 报修：${esc(m.reporter)}</span><span class="tk-prio prio-${m.prio}">${m.prio}</span></div>
      <div class="tk-name">${esc(sc.name)}</div>
      <div class="tk-tag">${esc(sc.tagline.split("\n")[0])}</div>
      <div class="tk-meta">
        <span>${esc(sc.env)}</span><span class="stars">${"★".repeat(sc.difficulty)}</span>
        <span class="${sc.done ? "ok" : "tk-score"}">${sc.done ? "✅ 已修复" : (sc.best_score ? `最佳 ${sc.best_score} 分` : "待处理")}</span>
      </div>`;
    card.onclick = () => { sfx.click(); startGame(sc.id, m); };
    grid.appendChild(card);
  });
}

/* ================= 知识库 ================= */
let lessonsCache = null;
async function renderLessons(filter = "") {
  if (!lessonsCache) lessonsCache = await api("/api/lessons");
  const body = $("#lesson-body");
  const learned = S.profile.learned || [];
  $("#lesson-summary").textContent = `已掌握 ${learned.length}/${lessonsCache.categories.reduce((n, c) => n + c.topics.length, 0)} 篇`;
  body.innerHTML = "";
  for (const cat of lessonsCache.categories) {
    const topics = cat.topics.filter(t => !filter || t.title.includes(filter) || t.key.includes(filter));
    if (!topics.length) continue;
    const title = document.createElement("div");
    title.className = "cat-title";
    title.textContent = "▍" + cat.name;
    body.appendChild(title);
    const chips = document.createElement("div");
    chips.className = "topic-chips";
    topics.forEach(t => {
      const b = document.createElement("button");
      b.className = "topic" + (t.learned ? " learned" : "");
      b.textContent = t.title;
      b.onclick = async () => {
        sfx.click();
        const d = await api("/api/lessons/" + t.key);
        modal("📚 " + d.title, `<pre>${esc(d.lines.join("\n"))}</pre>`, {
          buttons: [{ label: "已掌握，收下 ✓", action: async () => { await refreshProfile(); lessonsCache = null; renderLessons(filter); } }]
        });
      };
      chips.appendChild(b);
    });
    body.appendChild(chips);
  }
}

/* ================= 测验 ================= */
async function renderQuizPick() {
  if (!S.scenarios.length) S.scenarios = (await api("/api/scenarios")).scenarios;
  const list = $("#quiz-pick-list");
  list.innerHTML = "";
  S.scenarios.forEach(sc => {
    const best = (S.profile.quiz || {})[sc.id];
    const card = document.createElement("div");
    card.className = "ticket";
    card.innerHTML = `<div class="tk-head"><span class="tk-no">${esc(sc.name)}</span><span class="tk-prio prio-P2">📝 3 题</span></div>
      <div class="tk-tag">${esc(sc.tagline.split("\n")[0])}</div>
      <div class="tk-meta"><span>课后测验</span><span class="${best === 3 ? "ok" : "tk-score"}">${best === undefined ? "未测" : `${best}/3`}</span></div>`;
    card.onclick = () => { sfx.click(); openQuiz(sc.id, sc.name); };
    list.appendChild(card);
  });
}
async function openQuiz(sid, name) {
  S.quizSid = sid;
  const data = await api("/api/quiz/" + sid);
  $("#quiz-title").textContent = `《${name}》课后测验`;
  const body = $("#quiz-body");
  body.innerHTML = "";
  data.quiz.forEach((q, i) => {
    const item = document.createElement("div");
    item.className = "quiz-item";
    item.innerHTML = `<div class="q">第 ${i + 1} 题：${esc(q.q)}</div>`;
    q.options.forEach((opt, j) => {
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="radio" name="q${i}" value="${String.fromCharCode(65 + j)}"> ${esc(opt)}`;
      lab.onclick = () => { item.querySelectorAll("label").forEach(l => l.classList.remove("sel")); lab.classList.add("sel"); };
      item.appendChild(lab);
    });
    body.appendChild(item);
  });
  const btn = document.createElement("button");
  btn.className = "big-btn";
  btn.textContent = "交卷";
  btn.onclick = submitQuiz;
  body.appendChild(btn);
  show("quiz");
}
async function submitQuiz() {
  const answers = [];
  document.querySelectorAll("#quiz-body .quiz-item").forEach((item, i) => {
    const sel = item.querySelector(`input[name="q${i}"]:checked`);
    answers.push(sel ? sel.value : "");
  });
  const data = await api("/api/quiz", "POST", { sid: S.quizSid, answers });
  const body = $("#quiz-body");
  body.innerHTML = "";
  const head = document.createElement("div");
  head.className = "card";
  head.innerHTML = `<h3>成绩：${data.score}/${data.total}　绩效 XP +${data.xp}${data.full ? "　🏆 解锁「学霸」！" : ""}</h3>`;
  body.appendChild(head);
  data.results.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "quiz-result " + (r.ok ? "ok" : "no");
    div.textContent = `第 ${i + 1} 题：${r.ok ? "✅ 正确" : "❌ 正确答案 " + r.correct}　${r.explain}`;
    body.appendChild(div);
  });
  if (data.full) { sfx.win(); confetti(30); toast("测验满分！解锁「学霸」成就", "gold"); }
  else sfx.ok();
  await refreshProfile();
}

/* ================= 成就 / 职业路线 / 结局 ================= */
async function renderAchievements() {
  const data = await api("/api/achievements");
  const got = data.achievements.filter(a => a.unlocked).length;
  $("#ach-summary").textContent = `已解锁 ${got}/${data.achievements.length}`;
  const grid = $("#ach-grid");
  grid.innerHTML = "";
  data.achievements.forEach(a => {
    const d = document.createElement("div");
    d.className = "ach" + (a.unlocked ? "" : " locked");
    d.innerHTML = `<div class="icon">${a.unlocked ? "🏆" : "🔒"}</div>
      <div class="name">${esc(a.name)}</div><div class="desc">${esc(a.desc)}</div>`;
    grid.appendChild(d);
  });
}
async function renderCareer() {
  const data = await api("/api/ranks");
  const p = S.profile;
  const body = $("#career-body");
  body.innerHTML = "";
  let curIdx = 0;
  data.ranks.forEach((r, i) => { if (p.xp >= r.xp) curIdx = i; });
  data.ranks.forEach((r, i) => {
    const isCur = i === curIdx, isNext = i === curIdx + 1;
    const row = document.createElement("div");
    row.className = "rank-row" + (isCur ? " current" : (isNext ? " next" : ""));
    row.innerHTML = `<span class="icon">${["🌱","🟢","🔵","🟣","⭐","🚀","👑","🔥"][i] || "🎯"}</span>
      <span class="name">${esc(r.name)}</span><span class="need">绩效 ≥ ${r.xp}</span>`;
    body.appendChild(row);
  });
  const prog = document.createElement("div");
  prog.className = "card rank-progress";
  const cur = data.ranks[curIdx], next = data.ranks[curIdx + 1];
  const span = next ? next.xp - cur.xp : 1;
  const pct2 = Math.min(100, Math.round((p.xp - cur.xp) / span * 100));
  prog.innerHTML = `<h3>晋升进度</h3>
    <div class="meter"><div class="mb"><i style="width:${pct2}%"></i></div></div>
    <div class="dim" style="font-size:12px;">${next ? `距离「${esc(next.name)}」还差 ${Math.max(0, next.xp - p.xp)} 绩效` : "已是最高职级，传奇！"}</div>`;
  body.appendChild(prog);
}
async function renderEnding() {
  const data = await api("/api/ending");
  $("#ending-card").innerHTML = `
    <div class="card"><div class="title" style="font-size:24px;color:var(--yellow);font-weight:700;margin-bottom:10px;">🎬 ${esc(data.title)}</div>
    <div style="line-height:1.8;">${nl(data.desc)}</div>
    <div class="dim" style="margin-top:14px;">技术力 ${S.profile.stats.tech} · 沟通力 ${S.profile.stats.comm} · 冒险精神 ${S.profile.stats.risk} · 已修复工单 ${S.profile.finished.length}/${S.scenarios.length || 11}</div></div>`;
  await refreshProfile();
}
async function renderSettings() {
  $("#diff-desc").textContent = `当前：${S.profile.difficulty}（简单=提示多·XP×1.5 ｜ 标准=默认 ｜ 地狱=步数上限60·能量消耗翻倍）`;
  $("#btn-sound").textContent = muted ? "🔇" : "🔊";
  $("#btn-sound2").textContent = muted ? "开启音效" : "关闭音效";
  $("#btn-difficulty").onclick = async () => {
    const d = await api("/api/difficulty", "POST", {});
    await refreshProfile();
    $("#diff-desc").textContent = `当前：${d.difficulty}（简单=提示多·XP×1.5 ｜ 标准=默认 ｜ 地狱=步数上限60·能量消耗翻倍）`;
  };
  $("#btn-newprofile").onclick = async () => {
    const name = $("#new-name").value.trim() || "新员工";
    await api("/api/profile", "POST", { name, difficulty: "normal" });
    lessonsCache = null;
    await refreshProfile();
    $("#new-name").value = "";
    renderHome();
    toast("新档案已创建", "ok");
  };
}

/* ================= 真实终端 ================= */
class Term {
  constructor(el, onEnter) {
    this.el = el;
    this.onEnter = onEnter;
    this.blocks = [];
    this.prompt = "$ ";
    this.buf = "";
    this.pos = 0;
    this.hist = [];
    this.hi = 0;
    this.queue = [];   // 多行粘贴后待执行的命令
    this.busy = false;
    el.addEventListener("click", () => el.focus());
    el.addEventListener("keydown", e => this.key(e));
    el.addEventListener("paste", e => this.paste(e));
  }
  print(text, cls) { this.blocks.push({ cls: cls || "", text }); this.render(); }
  clear() { this.blocks = []; this.render(); }
  setPrompt(p) { this.prompt = p; this.render(); }
  setCommand(cmd) { this.buf = cmd; this.pos = cmd.length; this.render(); }
  insert(t) { this.buf = this.buf.slice(0, this.pos) + t + this.buf.slice(this.pos); this.pos += t.length; this.render(); }
  paste(e) {
    e.preventDefault();
    const data = e.clipboardData || window.clipboardData;
    if (!data) return;
    const text = data.getData("text");
    if (!text) return;
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length <= 1) {
      this.insert(lines[0] || "");        // 单行：插到光标处，可编辑后回车
      this.el.focus();
    } else {
      this.insert(lines[0]);               // 多行：第一行进缓冲区
      this.queue.push(...lines.slice(1));  // 其余排队，回车后顺序执行
      this.print(`（已粘贴 ${lines.length} 行命令：回车执行第一行，其余将依次执行）`, "dim");
    }
  }
  run(cmd) {
    if (!cmd.trim()) return;
    this.hist.push(cmd);
    this.hi = this.hist.length;
    this.print(this.prompt + cmd, "cmdline");
    this.buf = ""; this.pos = 0;
    this.render();
    this.busy = true;
    Promise.resolve(this.onEnter(cmd)).finally(() => {
      this.busy = false;
      this.nextQueue();
    });
  }
  nextQueue() {
    if (this.busy || !this.queue.length) return;
    this.run(this.queue.shift());
  }
  key(e) {
    if (e.key === "Enter") {
      this.run(this.buf);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      if (this.hi > 0) { this.hi--; this.setCommand(this.hist[this.hi]); }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (this.hi < this.hist.length - 1) { this.hi++; this.setCommand(this.hist[this.hi]); }
      else { this.hi = this.hist.length; this.setCommand(""); }
      e.preventDefault();
    } else if (e.key === "ArrowLeft") { this.pos = Math.max(0, this.pos - 1); this.render(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { this.pos = Math.min(this.buf.length, this.pos + 1); this.render(); e.preventDefault(); }
    else if (e.key === "Home") { this.pos = 0; this.render(); e.preventDefault(); }
    else if (e.key === "End") { this.pos = this.buf.length; this.render(); e.preventDefault(); }
    else if (e.key === "Backspace") {
      if (this.pos > 0) { this.buf = this.buf.slice(0, this.pos - 1) + this.buf.slice(this.pos); this.pos--; this.render(); }
      e.preventDefault();
    } else if (e.key === "Delete") {
      if (this.pos < this.buf.length) { this.buf = this.buf.slice(0, this.pos) + this.buf.slice(this.pos + 1); this.render(); }
      e.preventDefault();
    } else if (e.key.toLowerCase() === "l" && e.ctrlKey) { this.clear(); e.preventDefault(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.buf = this.buf.slice(0, this.pos) + e.key + this.buf.slice(this.pos);
      this.pos++;
      this.render();
      e.preventDefault();
    }
  }
  render() {
    const parts = this.blocks.map(b => `<div class="tblock ${b.cls}">${esc(b.text)}</div>`).join("");
    const before = esc(this.buf.slice(0, this.pos));
    const after = esc(this.buf.slice(this.pos));
    this.el.innerHTML = parts +
      `<div class="tline"><span class="tprompt">${esc(this.prompt)}</span><span class="ttext">${before}</span><span class="cursor"></span><span class="ttext">${after}</span></div>`;
    this.el.scrollTop = this.el.scrollHeight;
  }
}

/* ================= 代码编辑器（算法竞技场） ================= */
const PY_RE = /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b(?:def|return|if|elif|else|for|while|in|not|and|or|import|from|as|pass|None|True|False|class|try|except|finally|with|lambda|global|raise|break|continue|yield|is|del)\b)|(@\w+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*(?=\s*\())|([A-Za-z_]\w*)/gm;
function highlightPython(code) {
  let out = "", last = 0, m;
  PY_RE.lastIndex = 0;
  while ((m = PY_RE.exec(code)) !== null) {
    out += esc(code.slice(last, m.index));
    if (m[1]) out += `<span class="c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="s">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="k">${esc(m[3])}</span>`;
    else if (m[4]) out += `<span class="d">${esc(m[4])}</span>`;
    else if (m[5]) out += `<span class="n">${esc(m[5])}</span>`;
    else if (m[6]) out += `<span class="f">${esc(m[6])}</span>`;
    else if (m[7]) out += esc(m[7]);
    last = m.index + m[0].length;
  }
  out += esc(code.slice(last));
  return out;
}
class Editor {
  constructor() {
    this.ta = $("#ta");
    this.hl = $("#hl");
    this.gutter = $("#gutter");
    this.wrap = $("#code-wrap");
    this.ta.addEventListener("input", () => this.sync());
    this.ta.addEventListener("scroll", () => this.syncScroll());
    this.wrap.addEventListener("scroll", () => this.syncScroll());
    this.ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCode(); }
      if (e.key === "Tab") { e.preventDefault(); this.insert("\t"); }
    });
  }
  set(code) { this.ta.value = code; this.sync(); }
  get() { return this.ta.value; }
  insert(txt) {
    const s = this.ta.selectionStart, e = this.ta.selectionEnd;
    this.ta.value = this.ta.value.slice(0, s) + txt + this.ta.value.slice(e);
    this.ta.selectionStart = this.ta.selectionEnd = s + txt.length;
    this.sync();
  }
  sync() {
    const lines = this.ta.value.split("\n").length;
    this.gutter.innerHTML = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join("");
    this.hl.innerHTML = highlightPython(this.ta.value);
    this.syncScroll();
  }
  syncScroll() {
    const top = this.wrap.scrollTop;
    this.gutter.scrollTop = top;
  }
  focus() { this.ta.focus(); }
}

/* ================= 游戏（工单处理） ================= */
const term = new Term($("#terminal"), cmd => sendCmd(cmd));
const editor = new Editor();
let isAlgo = false;

async function startGame(sid, meta) {
  const plot = S.profile.pending_plot;
  if (plot) {
    modal("🧭 命运的岔路口", `<p>${esc(plot.prompt)}</p><p class="dim">（你的选择会改变结局走向）</p>`);
    const d = document.createElement("div");
    d.className = "modal-opts";
    plot.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.textContent = o;
      b.onclick = async () => {
        closeModal();
        await api("/api/plot", "POST", { index: i });
        await refreshProfile();
        startGame(sid, meta);
      };
      d.appendChild(b);
    });
    $("#modal").appendChild(d);
    return;
  }
  const data = await api("/api/start", "POST", { scenario: sid });
  if (!meta) meta = ticketMeta({ id: sid, difficulty: data.difficulty }, 0);
  S.game = { sid, no: meta.no, name: data.name, env: data.env, prio: meta.prio,
             intro: data.intro, help: data.help, palette: data.palette || [],
             task: data.task, all_done: false };
  isAlgo = sid === "algo_arena";
  renderTicketHead(data);
  renderDashboard(data.dashboard);
  $("#terminal").classList.toggle("hidden", isAlgo);
  $("#editor-wrap").classList.toggle("hidden", !isAlgo);
  $("#palette-card").style.display = isAlgo ? "none" : "";
  if (isAlgo) setupAlgo(data);
  else {
    term.clear();
    term.setPrompt(data.prompt || "$ ");
    term.print(data.intro, "big");
    term.print("—— 输入命令开始排障，或点击右侧「快捷命令」。↑↓ 翻历史，Ctrl+L 清屏，支持复制粘贴 ——", "dim");
    renderPalette();
  }
  renderTask();
  show("game");
  if (isAlgo) editor.focus(); else term.focus();
}
function renderTicketHead(data) {
  const g = S.game;
  $("#ticket-head").innerHTML = `
    <span class="tk-title">${esc(g.no)} ${esc(g.name)}</span>
    <span class="chip">${esc(g.env)}</span>
    <span class="tk-prio prio-${g.prio}">${g.prio}</span>
    <div class="tk-progress">
      <span class="n" id="tk-prog-n">任务 ${g.task.index}/${g.task.total}</span>
      <div class="bar"><i id="tk-prog-bar" style="width:${pct(g.task)}%"></i></div>
    </div>`;
}
function pct(task) { return task && task.total ? Math.round(task.index / task.total * 100) : 0; }
function updateTicketHead() {
  const g = S.game;
  if (!g) return;
  const n = $("#tk-prog-n"), b = $("#tk-prog-bar");
  if (n && b) { n.textContent = `任务 ${g.task.index}/${g.task.total}`; b.style.width = pct(g.task) + "%"; }
}
function renderTask() {
  const t = S.game ? S.game.task : null;
  const card = $("#task-card");
  if (isAlgo) {
    const p = currentProblem();
    if (!p) { card.innerHTML = "<h3>工单详情</h3><p class='dim'>（工单已修复）</p>"; return; }
    const done = S.passedPids.has(p.id);
    card.innerHTML = `<h3>题目《${esc(p.title)}》${done ? "· ✅ 已通过" : ""}</h3>
      <div class="title" style="color:var(--yellow);font-weight:700;margin-bottom:6px;">${esc(p.func)}</div>
      <div class="brief" style="font-size:12.5px;line-height:1.6;white-space:pre-wrap;">${esc(p.desc)}</div>
      <div class="hintbox" style="margin-top:10px;color:var(--dim);font-size:12px;">${esc(p.example)}</div>`;
    return;
  }
  if (!t || !t.title) { card.innerHTML = "<h3>工单详情</h3><p class='dim'>（工单已修复）</p>"; return; }
  card.innerHTML = `<h3>工单详情 · 当前步骤</h3>
    <div class="title" style="color:var(--yellow);font-weight:700;margin-bottom:6px;">📌 ${esc(t.title)}</div>
    <div class="brief" style="font-size:12.5px;line-height:1.6;white-space:pre-wrap;">${nl(t.brief)}</div>
    <div class="hintbox" style="margin-top:10px;color:var(--dim);font-size:12px;">${t.hints.length ? "💡 " + esc(t.hints[0]) : ""}</div>`;
}
function renderPalette() {
  const box = $("#palette");
  box.innerHTML = "";
  (S.game.palette || []).forEach(cmd => {
    const b = document.createElement("button");
    b.className = "chip-btn";
    b.textContent = cmd;
    b.title = cmd;
    b.onclick = () => { sfx.click(); sendCmd(cmd); };
    box.appendChild(b);
  });
}

/* ---------- 算法编辑器模式 ---------- */
function currentProblem() { return S.problems.find(p => p.id === S.curPid) || null; }
function setupAlgo(data) {
  S.problems = data.problems || [];
  S.passedPids = new Set();
  $("#results").classList.add("hidden");
  $("#results").innerHTML = "";
  // 快捷题目切换
  const box = $("#palette");
  box.innerHTML = "";
  S.problems.forEach(p => {
    const b = document.createElement("button");
    b.className = "chip-btn";
    b.textContent = p.id;
    b.title = p.title;
    b.onclick = () => { sfx.click(); selectProblem(p.id); };
    box.appendChild(b);
  });
  $("#palette-title").innerHTML = "题目切换 <span class='dim'>（点击换题）</span>";
  selectProblem(S.problems[0].id, data);
}
function selectProblem(pid) {
  S.curPid = pid;
  const p = currentProblem();
  if (!p) return;
  if (!(pid in S.edCodes)) S.edCodes[pid] = p.starter;
  editor.set(S.edCodes[pid]);
  renderTask();
  $("#ed-status").textContent = `编辑 ${pid}.py · 已通过 ${S.passedPids.size}/${S.problems.length}`;
}
async function runCode() {
  const p = currentProblem();
  if (!p) return;
  S.edCodes[p.id] = editor.get();
  $("#btn-run").disabled = true;
  $("#ed-status").textContent = "判题中…";
  try {
    const d = await api("/api/code/run", "POST", { sid: p.id, code: S.edCodes[p.id] });
    if (d.passed === d.total) S.passedPids.add(p.id); else S.passedPids.delete(p.id);
    renderResults(p, d);
    if (d.task_done) { sfx.ok(); toast(`《${p.title}》通过！`, "ok"); }
    if (d.all_done) {
      S.game.all_done = true;
      sfx.win(); confetti(60);
      toast("全部题目通过！工单已修复", "gold");
    }
    S.game.task = d.task;
    renderTask();
    updateTicketHead();
    updateStatus();
    $("#ed-status").textContent = `编辑 ${p.id}.py · 已通过 ${S.passedPids.size}/${S.problems.length}`;
    refreshProfile();
    checkDeltas();
  } catch (e) {
    $("#ed-status").textContent = "判题失败：" + e.message;
    sfx.err();
  } finally {
    $("#btn-run").disabled = false;
    editor.focus();
  }
}
function renderResults(p, d) {
  const box = $("#results");
  box.classList.remove("hidden");
  box.innerHTML = "";
  const banner = document.createElement("div");
  banner.className = "res-banner " + (d.passed === d.total ? "pass" : "fail");
  banner.textContent = d.passed === d.total
    ? `🎉 《${p.title}》全部 ${d.total} 个用例通过！`
    : `《${p.title}》通过 ${d.passed}/${d.total} 个用例`;
  box.appendChild(banner);
  d.results.forEach((r, i) => {
    const c = document.createElement("div");
    c.className = "case " + (r.ok ? "ok" : "no");
    c.textContent = `用例${i + 1}  ${r.ok ? "✅" : "❌"}  期望: ${formatVal(r.expected)}  实际: ${formatVal(r.actual)}${r.error ? "  " + r.error : ""}`;
    box.appendChild(c);
  });
  box.scrollTop = 0;
}
function formatVal(v) {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "string" ? JSON.stringify(v) : String(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

/* ---------- 场景工作台面板 ---------- */
function renderDashboard(d) {
  const box = $("#dashboard");
  box.innerHTML = "";
  if (!d || !d.panels || !d.panels.length) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const theme = d.theme || {};
  box.style.setProperty("--accent", theme.accent || "#58a6ff");
  const title = document.createElement("div");
  title.className = "dash-title";
  title.innerHTML = `${esc(theme.icon || "🛠")} <b>${esc(theme.title || "工作台")}</b> 实时状态`;
  box.appendChild(title);
  const row = document.createElement("div");
  row.className = "dash-row";
  d.panels.forEach(p => row.appendChild(panelEl(p)));
  box.appendChild(row);
}
function panelEl(p) {
  const el = document.createElement("div");
  el.className = "dash-panel";
  el.innerHTML = `<div class="dp-title">${esc(p.title || "")}</div>`;
  const body = document.createElement("div");
  body.className = "dp-body";
  if (p.kind === "meter") {
    (p.items || []).forEach(m => {
      const v = Math.max(0, Math.min(m.max || 100, m.value || 0));
      const r = m.max ? v / m.max : 0;
      const cls = r > 0.85 ? " meter crit" : (r > 0.65 ? " meter warn" : " meter");
      const d = document.createElement("div");
      d.className = cls;
      d.innerHTML = `<div class="ml"><span>${esc(m.label)}</span><span>${m.value}${m.unit || ""}</span></div>
        <div class="mb"><i style="width:${Math.round(r * 100)}%"></i></div>`;
      body.appendChild(d);
    });
  } else if (p.kind === "status") {
    (p.items || []).forEach(it => {
      const cls = it.ok === null || it.ok === undefined ? " pill pend" : (it.ok ? " pill good" : " pill bad");
      const d = document.createElement("span");
      d.className = cls;
      d.innerHTML = `<i></i>${esc(it.label)} · ${esc(it.state)}`;
      body.appendChild(d);
    });
  } else if (p.kind === "table") {
    const tb = document.createElement("table");
    tb.className = "dp-table";
    const h = document.createElement("tr");
    (p.headers || []).forEach(x => { const th = document.createElement("th"); th.textContent = x; h.appendChild(th); });
    tb.appendChild(h);
    (p.rows || []).forEach(r => {
      const tr = document.createElement("tr");
      r.forEach(c => { const td = document.createElement("td"); td.textContent = c; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    body.appendChild(tb);
  } else if (p.kind === "kv") {
    (p.items || []).forEach(([k, v]) => {
      const d = document.createElement("div");
      d.className = "kv-row";
      d.innerHTML = `<span class="k">${esc(k)}</span><span>${esc(v)}</span>`;
      body.appendChild(d);
    });
  } else if (p.kind === "log") {
    const pre = document.createElement("div");
    pre.className = "dp-log";
    pre.textContent = (p.lines || []).join("\n");
    body.appendChild(pre);
  }
  el.appendChild(body);
  return el;
}

/* ---------- 命令执行（终端） ---------- */
async function sendCmd(text) {
  if (!S.game || S.game.all_done) return;
  try {
    const data = await api("/api/cmd", "POST", { text });
    if (data.text) term.print(data.text, "");
    if (data.messages) term.print(data.messages, "ok");
    S.game.task = data.task;
    S.profile = data.profile;
    if (data.dashboard) renderDashboard(data.dashboard);
    if (data.prompt) term.setPrompt(data.prompt);
    updateTicketHead();
    updateStatus();
    renderProfile();
    checkDeltas();
    if (data.task_done) sfx.ok();
    if (data.all_done) {
      S.game.all_done = true;
      term.print("🎉 工单已修复！得分 " + data.score, "ok big");
      term.print("去「测验中心」巩固一下，或接下一张工单。", "dim");
      sfx.win(); confetti(60);
      toast("工单修复完成！" + data.score + " 分", "gold");
      renderTask();
      return;
    }
    renderTask();
    if (data.event) showEvent(data.event);
  } catch (e) {
    term.print("⚠ " + e.message, "err");
    sfx.err();
  }
  term.focus();
}
function showEvent(ev) {
  modal("💬 " + ev.who, `<p>${esc(ev.line)}</p><p class="dim">（办公室小剧场 · 选一个回应）</p>`);
  const d = document.createElement("div");
  d.className = "modal-opts";
  ev.options.forEach((o, i) => {
    const b = document.createElement("button");
    b.textContent = o;
    b.onclick = async () => {
      closeModal();
      const r = await api("/api/event", "POST", { index: i });
      if (r.message) term.print(r.message, "dim");
      await refreshProfile();
    };
    d.appendChild(b);
  });
  $("#modal").appendChild(d);
}

/* ---------- 晋升 / 成就检测 ---------- */
function checkDeltas() {
  const p = S.profile;
  if (S.rankSnapshot !== null && p.rank !== S.rankSnapshot) {
    sfx.level(); confetti(40);
    modal("🎉 晋升！", `<p style="font-size:16px;">恭喜升职为 <b style="color:var(--yellow)">${esc(p.rank)}</b>！</p><p class="dim">绩效是硬通货，继续加油。</p>`, {
      buttons: [{ label: "继续干活", action: () => {} }]
    });
  }
  S.rankSnapshot = p.rank;
  const newAch = p.achievements.filter(a => !S.achSnapshot.has(a));
  newAch.forEach(a => { sfx.coin(); toast("🏆 解锁成就：" + a, "gold"); });
  S.achSnapshot = new Set(p.achievements);
}

/* ================= 事件绑定 ================= */
function bind() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.onclick = () => { sfx.click(); goView(btn.dataset.view); };
  });
  $("#btn-sound").onclick = toggleSound;
  $("#btn-sound2").onclick = toggleSound;
  $("#btn-exit").onclick = async () => {
    await api("/api/exit_scenario", "POST", {});
    S.game = null;
    S.problems = [];
    await refreshProfile();
    goView("tickets");
  };
  $("#btn-run").onclick = runCode;
  $("#btn-sample").onclick = () => {
    const p = currentProblem();
    if (p) modal("📋 示例", `<pre>${esc(p.example)}</pre>`, { buttons: [{ label: "关闭", action: () => {} }] });
  };
  $("#btn-hint").onclick = async () => {
    if (isAlgo) {
      const p = currentProblem();
      if (p) modal("💡 提示", `<pre>${esc(p.hint)}</pre>`, { buttons: [{ label: "明白了", action: () => {} }] });
      return;
    }
    const d = await api("/api/hint", "POST", {});
    modal("💡 提示", `<pre>${esc(d.hint)}</pre>`, { buttons: [{ label: "明白了", action: () => {} }] });
    await refreshProfile();
  };
  $("#btn-learn").onclick = async () => {
    if (isAlgo) {
      const p = currentProblem();
      modal("📚 知识点", `<pre>${esc(p.hint)}</pre>`, { buttons: [{ label: "已掌握 ✓", action: () => {} }] });
      return;
    }
    const d = await api("/api/learn", "POST", {});
    if (d.title) modal("📚 " + d.title, `<pre>${esc(d.lines.join("\n"))}</pre>`, {
      buttons: [{ label: "已掌握 ✓", action: async () => { await refreshProfile(); } }]
    });
    else modal("📚 知识点", "<p class='dim'>（当前步骤没有关联知识点）</p>");
  };
  $("#btn-coffee").onclick = async () => {
    const d = await api("/api/coffee", "POST", {});
    if (d.messages) term.print(d.messages, "");
    sfx.coin();
    await refreshProfile();
  };
  $("#btn-skip").onclick = async () => {
    if (isAlgo) { toast("算法题要自己写出来才算数哦", "err"); return; }
    const d = await api("/api/skip", "POST", {});
    S.game.task = d.task;
    if (d.messages) term.print(d.messages, "dim");
    if (d.dashboard) renderDashboard(d.dashboard);
    renderTask(); updateTicketHead(); updateStatus();
    await refreshProfile();
  };
  $("#btn-help").onclick = async () => {
    const d = await api("/api/help", "POST", {});
    modal("❓ 环境命令手册", `<pre>${esc(d.help || "（没有进行中的工单）")}</pre>`, {
      buttons: [{ label: "关闭", action: () => {} }]
    });
  };
  $("#lesson-search").addEventListener("input", e => {
    clearTimeout(S._lsTimer);
    S._lsTimer = setTimeout(() => renderLessons(e.target.value.trim()), 200);
  });
}
function toggleSound() {
  muted = !muted;
  localStorage.setItem("devsaga_muted", muted ? "1" : "0");
  $("#btn-sound").textContent = muted ? "🔇" : "🔊";
  const b2 = $("#btn-sound2");
  if (b2) b2.textContent = muted ? "开启音效" : "关闭音效";
  if (!muted) sfx.click();
}

/* ================= 启动 ================= */
async function refreshProfile() {
  const data = await api("/api/state");
  S.profile = data.state;
  renderProfile();
  return S.profile;
}
(async function init() {
  bind();
  tickClock();
  setInterval(tickClock, 1000);
  await refreshProfile();
  S.achSnapshot = new Set(S.profile.achievements);
  S.rankSnapshot = S.profile.rank;
  renderHome();
})();
