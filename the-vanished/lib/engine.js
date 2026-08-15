'use strict';
// THE VANISHED · 时间线引擎：真实时间推进 / 事件投递 / 计分 / 结局
const fs = require('fs');
const { EVENTS, ENDINGS } = require('./story');

const EVIDENCE_POINTS = 7;   // 证据文件数量
const CHECKPOINT_POINTS = 2; // 每个检查点答对得分

class VanishedEngine {
  constructor(opts) {
    this.stateFile = opts.stateFile;
    this.hooks = opts.hooks || {};
    this.load();
  }

  load() {
    let data = null;
    if (fs.existsSync(this.stateFile)) {
      try { data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')); } catch (e) { data = null; }
    }
    if (!data || data.version !== 1) {
      data = {
        version: 1,
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
      this.state = data;
      this.save();
    } else {
      data.lastTickMs = Date.now();
      this.state = data;
      this.save();
    }
  }

  save() {
    try { fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8'); } catch (e) { /* 忽略 */ }
  }

  elapsedSeconds() { return this.state.accumulatedMs / 1000; }

  tick(nowMs) {
    const now = nowMs || Date.now();
    const dt = now - this.state.lastTickMs;
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
    this.state.accumulatedMs += n * 1000;
    this.state.lastTickMs += n * 1000;
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
    for (const cp of EVENTS) {
      if (cp.kind === 'checkpoint' && this.state.answers[cp.cid] === cp.correct) s += CHECKPOINT_POINTS;
    }
    const action = EVENTS.find(e => e.cid === 'action');
    if (action && this.state.answers[action.cid] === action.correct) s += 3;
    return s;
  }

  finish() {
    if (this.state.ended) return;
    const score = this.calcScore();
    const action = EVENTS.find(e => e.cid === 'action');
    const actionCorrect = action ? this.state.answers[action.cid] === action.correct : false;
    let ending;
    if (!actionCorrect) {
      if (score >= 8) ending = 'okay';
      else if (score >= 4) ending = 'bad';
      else ending = 'worst';
    } else {
      if (score >= 11) ending = 'perfect';
      else if (score >= 8) ending = 'good';
      else if (score >= 4) ending = 'okay';
      else ending = 'bad';
    }
    this.state.ended = true;
    this.state.ending = ending;
    this.state.finalScore = score;
    this.save();
    if (this.hooks.onEnding) this.hooks.onEnding(ending, score);
  }

  getPendingCheckpoint() {
    if (this.state.ended) return null;
    for (const cp of EVENTS) {
      if (cp.kind === 'checkpoint' && this.state.delivered.indexOf(cp.id) >= 0 && !this.state.answers[cp.cid]) return cp;
    }
    return null;
  }

  answerCheckpoint(cid, optionId) {
    if (this.state.answers[cid]) return { ok: false, message: '该检查点已经作答过了。' };
    const cp = EVENTS.find(e => e.kind === 'checkpoint' && e.cid === cid);
    if (!cp) return { ok: false, message: '未知的检查点。' };
    const correct = optionId === cp.correct;
    this.state.answers[cid] = optionId;
    this.save();
    return { ok: true, correct: correct, explain: cp.explain, score: this.calcScore() };
  }

  viewEvidence(file) {
    const ev = EVENTS.find(e => e.kind === 'evidence' && e.file === file);
    if (!ev) return { ok: false, message: '未知的证据文件。' };
    if (this.state.delivered.indexOf(ev.id) < 0) return { ok: false, message: '这份证据还没有生成。' };
    if (this.state.evidenceViewed.indexOf(file) >= 0) return { ok: true, already: true };
    this.state.evidenceViewed.push(file);
    this.save();
    return { ok: true, already: false, score: this.calcScore() };
  }

  setSpeed(n) {
    this.state.speed = Math.max(0.5, Math.min(Number(n) || 1, 100));
    this.save();
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
    }
    return p;
  }

  getState() {
    const delivered = EVENTS.filter(e => this.state.delivered.indexOf(e.id) >= 0);
    const pending = this.getPendingCheckpoint();
    return {
      elapsed: Math.floor(this.elapsedSeconds()),
      totalSeconds: EVENTS[EVENTS.length - 1].at,
      speed: this.state.speed,
      delivered: delivered.map(e => this.publicEvent(e)),
      attention: this.calcScore(),
      evidenceViewed: this.state.evidenceViewed.slice(),
      checkpoint: pending ? pending.cid : null,
      ended: this.state.ended,
      ending: this.state.ending,
      finalScore: this.state.finalScore,
      stats: {
        startedAt: this.state.startedAt,
        answered: Object.keys(this.state.answers).length,
        evidenceCount: this.state.evidenceViewed.length
      }
    };
  }

  restart() {
    const keep = this.state;
    this.state = {
      version: 1,
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
    this.save();
    return this.getState();
  }
}

module.exports = { VanishedEngine, EVENTS, ENDINGS };
