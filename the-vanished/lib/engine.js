'use strict';
// THE VANISHED · 时间线引擎：真实时间推进 / 事件投递 / 计分 / 结局
const fs = require('fs');
const { EVENTS, ENDINGS } = require('./story');

const STATE_VERSION = 1;
const EVIDENCE_POINTS = 7;        // 每份证据 +1，上限 = 证据文件数量
const CHECKPOINT_POINTS = 2;      // 每个检查点答对 +2
const ACTION_BONUS_POINTS = 3;    // 最终行动在检查点 2 分之外额外 +3
const MIN_SPEED = 0.5;
const MAX_SPEED = 100;
// 单次 tick 最多补记的真实时间：休眠/系统时钟前跳时暂停时间线，而不是瞬间播完
const MAX_TICK_MS = 5000;
// 结局阈值（与 README 表格一致）
const THRESHOLDS = { perfect: 11, good: 8, okay: 4 };

const CHECKPOINTS = EVENTS.filter(function (e) { return e.kind === 'checkpoint'; });
const EVIDENCE_EVENTS = EVENTS.filter(function (e) { return e.kind === 'evidence'; });
const ACTION_EVENT = EVENTS.find(function (e) { return e.cid === 'action'; });
const EVENT_IDS = EVENTS.map(function (e) { return e.id; });

function clampSpeed(n) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return 1;
  return Math.max(MIN_SPEED, Math.min(v, MAX_SPEED));
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

class VanishedEngine {
  constructor(opts) {
    this.stateFile = opts.stateFile;
    this.hooks = opts.hooks || {};
    this.load();
  }

  freshState() {
    return {
      version: STATE_VERSION,
      startedAt: Date.now(),
      accumulatedMs: 0,
      lastTickMs: Date.now(),
      speed: 1,
      delivered: [],
      evidenceViewed: [],
      answers: {},
      ended: false,
      ending: null,
      finalScore: 0
    };
  }

  // 存档可能被手工编辑、被旧版本写入或写坏：一律校正成合法状态，绝不抛异常
  sanitize(raw) {
    const s = this.freshState();
    if (!isPlainObject(raw)) return s;

    const num = function (v, dflt) {
      return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : dflt;
    };
    s.startedAt = num(raw.startedAt, s.startedAt);
    s.accumulatedMs = num(raw.accumulatedMs, 0);
    s.speed = clampSpeed(raw.speed);

    if (Array.isArray(raw.delivered)) {
      for (const id of raw.delivered) {
        if (typeof id === 'string' && EVENT_IDS.indexOf(id) >= 0 && s.delivered.indexOf(id) < 0) {
          s.delivered.push(id);
        }
      }
    }
    if (Array.isArray(raw.evidenceViewed)) {
      for (const f of raw.evidenceViewed) {
        if (typeof f === 'string' &&
            EVIDENCE_EVENTS.some(function (e) { return e.file === f; }) &&
            s.evidenceViewed.indexOf(f) < 0) {
          s.evidenceViewed.push(f);
        }
      }
    }
    if (isPlainObject(raw.answers)) {
      for (const cid of Object.keys(raw.answers)) {
        const cp = CHECKPOINTS.find(function (e) { return e.cid === cid; });
        if (!cp) continue;
        const opt = raw.answers[cid];
        if (cp.options.some(function (o) { return o.id === opt; })) s.answers[cid] = opt;
      }
    }
    s.ended = raw.ended === true;
    s.ending = (s.ended && ENDINGS[raw.ending]) ? raw.ending : null;
    s.finalScore = s.ended ? num(raw.finalScore, 0) : 0;
    return s;
  }

  load() {
    let data = null;
    if (fs.existsSync(this.stateFile)) {
      try { data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')); } catch (e) { data = null; }
    }
    if (!data || data.version !== STATE_VERSION) {
      this.state = this.freshState();
    } else {
      this.state = this.sanitize(data);
      this.state.lastTickMs = Date.now(); // 离线期间的时间不计入
    }
    this.save();
  }

  save() {
    try { fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8'); } catch (e) { /* 忽略 */ }
  }

  elapsedSeconds() { return this.state.accumulatedMs / 1000; }

  tick(nowMs) {
    const now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
    const raw = now - this.state.lastTickMs;
    // 负的 dt（时钟回拨）忽略；过大的 dt（休眠/时钟前跳）夹紧，避免一次 tick 播完全部事件
    const dt = Math.min(Math.max(raw, 0), MAX_TICK_MS);
    if (dt > 0) this.state.accumulatedMs += dt * this.state.speed;
    this.state.lastTickMs = now;
    let changed = false;
    const elapsed = this.elapsedSeconds();
    for (const ev of EVENTS) {
      if (ev.at <= elapsed && this.state.delivered.indexOf(ev.id) < 0) {
        this.state.delivered.push(ev.id);
        this.deliver(ev);
        changed = true;
      }
    }
    if (changed) this.save();
    return changed;
  }

  advanceSeconds(n) {
    const ms = Number(n) * 1000;
    if (!isFinite(ms) || ms <= 0) return false;
    this.state.accumulatedMs += ms;
    this.state.lastTickMs += ms;
    return this.tick(this.state.lastTickMs);
  }

  deliver(ev) {
    if (ev.kind === 'evidence' && this.hooks.writeEvidence) this.hooks.writeEvidence(ev);
    if (ev.kind === 'toast' && this.hooks.toast) this.hooks.toast(ev);
    if (ev.kind === 'ending') this.finish();
  }

  calcScore() {
    let s = 0;
    s += Math.min(this.state.evidenceViewed.length, EVIDENCE_POINTS);
    for (const cp of CHECKPOINTS) {
      if (this.state.answers[cp.cid] === cp.correct) s += CHECKPOINT_POINTS;
    }
    if (ACTION_EVENT && this.state.answers[ACTION_EVENT.cid] === ACTION_EVENT.correct) {
      s += ACTION_BONUS_POINTS;
    }
    return s;
  }

  finish() {
    if (this.state.ended) return;
    const score = this.calcScore();
    const actionCorrect = !!ACTION_EVENT && this.state.answers[ACTION_EVENT.cid] === ACTION_EVENT.correct;
    let ending;
    if (actionCorrect) {
      if (score >= THRESHOLDS.perfect) ending = 'perfect';
      else if (score >= THRESHOLDS.good) ending = 'good';
      else if (score >= THRESHOLDS.okay) ending = 'okay';
      else ending = 'bad';
    } else {
      if (score >= THRESHOLDS.good) ending = 'okay';
      else if (score >= THRESHOLDS.okay) ending = 'bad';
      else ending = 'worst';
    }
    this.state.ended = true;
    this.state.ending = ending;
    this.state.finalScore = score;
    this.save();
    if (this.hooks.onEnding) this.hooks.onEnding(ending, score);
  }

  getPendingCheckpoint() {
    if (this.state.ended) return null;
    for (const cp of CHECKPOINTS) {
      if (this.state.delivered.indexOf(cp.id) >= 0 && !this.state.answers[cp.cid]) return cp;
    }
    return null;
  }

  answerCheckpoint(cid, optionId) {
    const cp = CHECKPOINTS.find(function (e) { return e.cid === cid; });
    if (!cp) return { ok: false, message: '未知的检查点。' };
    if (this.state.delivered.indexOf(cp.id) < 0) return { ok: false, message: '这个检查点还没有出现。' };
    if (this.state.answers[cid]) return { ok: false, message: '该检查点已经作答过了。' };
    if (!cp.options.some(function (o) { return o.id === optionId; })) {
      return { ok: false, message: '无效的选项。' };
    }
    const correct = optionId === cp.correct;
    this.state.answers[cid] = optionId;
    this.save();
    // correctOption 只在这里（作答之后）返回，前端用它标出正确选项
    return { ok: true, correct: correct, correctOption: cp.correct, explain: cp.explain, score: this.calcScore() };
  }

  viewEvidence(file) {
    const ev = EVIDENCE_EVENTS.find(function (e) { return e.file === file; });
    if (!ev) return { ok: false, message: '未知的证据文件。' };
    if (this.state.delivered.indexOf(ev.id) < 0) return { ok: false, message: '这份证据还没有生成。' };
    if (this.state.evidenceViewed.indexOf(file) >= 0) return { ok: true, already: true };
    this.state.evidenceViewed.push(file);
    this.save();
    return { ok: true, already: false, score: this.calcScore() };
  }

  setSpeed(n) {
    this.state.speed = clampSpeed(n);
    this.save();
    return this.state.speed;
  }

  publicEvent(ev) {
    const p = { id: ev.id, at: ev.at, kind: ev.kind };
    if (ev.kind === 'chat') { p.from = ev.from; p.text = ev.text; p.time = ev.time; }
    if (ev.kind === 'system') { p.text = ev.text; }
    if (ev.kind === 'toast') { p.title = ev.title; p.text = ev.text; }
    if (ev.kind === 'evidence') { p.file = ev.file; p.name = ev.name; }
    if (ev.kind === 'checkpoint') {
      p.cid = ev.cid;
      p.question = ev.question;
      p.options = ev.options;
      p.answered = !!this.state.answers[ev.cid];
      p.answerId = this.state.answers[ev.cid] || null;
      p.answeredCorrectly = p.answered ? this.state.answers[ev.cid] === ev.correct : null;
      // 正确答案只在作答之后下发，避免还没答就能从 /api/state 里看到答案
      p.correctOption = p.answered ? ev.correct : null;
    }
    return p;
  }

  getState() {
    const st = this.state;
    const delivered = EVENTS.filter(function (e) { return st.delivered.indexOf(e.id) >= 0; });
    const pending = this.getPendingCheckpoint();
    const ending = this.state.ended ? ENDINGS[this.state.ending] : null;
    return {
      elapsed: Math.floor(this.elapsedSeconds()),
      totalSeconds: EVENTS.reduce(function (m, e) { return Math.max(m, e.at); }, 0),
      speed: this.state.speed,
      delivered: delivered.map((e) => this.publicEvent(e)),
      // 结算之后分数冻结：后续的作答/查看不会让界面数字与结局记录互相矛盾
      attention: this.state.ended ? this.state.finalScore : this.calcScore(),
      evidenceViewed: this.state.evidenceViewed.slice(),
      checkpoint: pending ? pending.cid : null,
      ended: this.state.ended,
      ending: this.state.ending,
      endingTitle: ending ? ending.title : null,
      endingText: ending ? ending.text : null,
      finalScore: this.state.finalScore,
      stats: {
        startedAt: this.state.startedAt,
        answered: Object.keys(this.state.answers).length,
        evidenceCount: this.state.evidenceViewed.length
      }
    };
  }

  restart() {
    this.state = this.freshState();
    this.save();
    return this.getState();
  }
}

module.exports = {
  VanishedEngine,
  EVENTS,
  ENDINGS,
  // 计分与阈值：供测试与 README 对照
  SCORE: {
    evidence: EVIDENCE_POINTS,
    checkpoint: CHECKPOINT_POINTS,
    actionBonus: ACTION_BONUS_POINTS,
    max: EVIDENCE_POINTS + CHECKPOINT_POINTS * CHECKPOINTS.length + ACTION_BONUS_POINTS
  },
  THRESHOLDS,
  MAX_TICK_MS
};
