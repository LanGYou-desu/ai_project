'use strict';
const fs = require('fs');
const { FLAGS, ACT_TASKS, ACT_HINTS } = require('./worlddata');

const STORY_START = '你站在档案馆门口。三声门铃之后，灯亮了。';
const ACT_COMPLETE = {
  1: '第一幕 · 门房大厅 —— 完成。档案馆深处传来一声叹息，像是有东西在等你。',
  2: '第二幕 · 数据迷宫 —— 完成。回声越来越近了。',
  3: '第三幕 · 核心室 —— 完成。'
};
const MAX_STORY = 500;
const MAX_HINT_COUNT = 9999;

function defaultData() {
  return {
    solved: [],
    hints: { 1: 0, 2: 0, 3: 0 },
    commandsRun: 0,
    startedAt: Date.now(),
    story: [STORY_START],
    done: false,
    finishAt: null
  };
}

// 把磁盘上的存档规范化：过滤未知/重复口令、修正缺失字段、限制长度。
// 这样即使 state.json 被手工改坏，也不会让进度系统失效。
function normalizeData(raw) {
  const d = defaultData();
  if (!raw || typeof raw !== 'object') return d;

  const known = new Set(FLAGS.map(f => f.code.toLowerCase()));
  if (Array.isArray(raw.solved)) {
    const seen = new Set();
    for (const x of raw.solved) {
      const code = String(x).trim().toLowerCase();
      if (known.has(code) && !seen.has(code)) {
        seen.add(code);
        d.solved.push(code);
      }
    }
  }

  if (raw.hints && typeof raw.hints === 'object') {
    for (const a of [1, 2, 3]) {
      const n = Number(raw.hints[a]);
      d.hints[a] = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), MAX_HINT_COUNT) : 0;
    }
  }

  if (typeof raw.commandsRun === 'number' && Number.isFinite(raw.commandsRun)) {
    d.commandsRun = Math.max(0, Math.floor(raw.commandsRun));
  }
  if (typeof raw.startedAt === 'number' && Number.isFinite(raw.startedAt)) {
    d.startedAt = raw.startedAt;
  }
  if (Array.isArray(raw.story)) {
    d.story = raw.story.map(x => String(x).slice(0, 1000)).slice(0, MAX_STORY);
  }
  if (d.story.length === 0) d.story.push(STORY_START);

  d.done = d.solved.length === FLAGS.length;
  if (d.done) {
    d.finishAt = (typeof raw.finishAt === 'number' && Number.isFinite(raw.finishAt)) ? raw.finishAt : Date.now();
    if (!d.story.some(x => x.indexOf('激活完成') >= 0)) d.story.push('── 档案馆-7 激活完成 ──');
  } else {
    d.finishAt = null;
  }
  return d;
}

function createGameState(opts) {
  const stateFile = opts && opts.stateFile;
  if (typeof stateFile !== 'string' || stateFile.length === 0) {
    throw new Error('createGameState：缺少 stateFile');
  }

  let data = null;
  if (fs.existsSync(stateFile)) {
    try { data = normalizeData(JSON.parse(fs.readFileSync(stateFile, 'utf8'))); }
    catch (e) { data = null; }
  }
  if (!data) {
    data = defaultData();
    save();
  }

  function save() {
    const json = JSON.stringify(data, null, 2);
    const tmp = stateFile + '.tmp';
    try {
      fs.writeFileSync(tmp, json, 'utf8');
      fs.renameSync(tmp, stateFile);
    } catch (e) {
      try { fs.writeFileSync(stateFile, json, 'utf8'); } catch (e2) { /* 忽略写盘错误 */ }
      try { fs.unlinkSync(tmp); } catch (e3) { /* 忽略 */ }
    }
  }

  function currentAct() {
    if (data.done) return 4;
    const f = FLAGS.find(x => data.solved.indexOf(x.code.toLowerCase()) < 0);
    return f ? f.act : 4;
  }

  function solvedInAct(act) {
    return FLAGS.filter(f => f.act === act && data.solved.indexOf(f.code.toLowerCase()) >= 0).length;
  }

  function totalHints() {
    return (data.hints[1] || 0) + (data.hints[2] || 0) + (data.hints[3] || 0);
  }

  function checkFlag(raw) {
    const code = String(raw).trim().toLowerCase();
    const flag = FLAGS.find(f => f.code.toLowerCase() === code);
    if (!flag) return { ok: false, message: '「' + String(raw).trim() + '」——档案馆没有这个口令。' };
    if (data.solved.indexOf(code) >= 0) return { ok: true, message: '该口令已被记录过。' };
    data.solved.push(code);
    const msg = '✓ 口令正确：' + flag.flavor;

    const actFlags = FLAGS.filter(f => f.act === flag.act);
    if (solvedInAct(flag.act) === actFlags.length) {
      data.story.push(ACT_COMPLETE[flag.act]);
      const nextAct = flag.act + 1;
      const nextFlags = FLAGS.filter(f => f.act === nextAct);
      // 只有下一幕还没通关时才提示“获准进入”，避免倒序提交时剧情错乱
      if (nextFlags.length && solvedInAct(nextAct) < nextFlags.length) {
        data.story.push('档案馆深处传来新的指引——你已获准进入第 ' + nextAct + ' 幕。');
      }
    }

    if (data.solved.length === FLAGS.length && !data.done) {
      data.done = true;
      data.finishAt = Date.now();
      const minutes = Math.max(1, Math.round((data.finishAt - data.startedAt) / 60000));
      data.story.push('── 档案馆-7 激活完成 ──');
      data.story.push('耗时约 ' + minutes + ' 分钟，执行 ' + data.commandsRun + ' 条命令，使用 ' + totalHints() + ' 次提示。');
      data.story.push('ECHO 核心已重新接入网络。大静默的余波，从今天开始消散。');
    }

    save();
    return { ok: true, message: msg };
  }

  function getHint() {
    const act = currentAct();
    if (act > 3) return '档案馆已经完全解锁，不再需要提示。';
    const list = ACT_HINTS[act] || [];
    const used = data.hints[act] || 0;
    if (used >= list.length) return '这个区域已经没有更多提示了。';
    data.hints[act] = used + 1;
    save();
    return '第 ' + act + ' 幕 · 提示：' + list[used];
  }

  function countCommand() {
    data.commandsRun++;
    save();
  }

  function getState() {
    const act = currentAct();
    const tasks = {};
    for (const a of [1, 2, 3]) {
      const flagsOfAct = FLAGS.filter(f => f.act === a);
      tasks[a] = (ACT_TASKS[a] || []).map((text, i) => {
        const flag = flagsOfAct[i];
        return { text: text, solved: flag ? data.solved.indexOf(flag.code.toLowerCase()) >= 0 : false };
      });
    }
    return {
      solved: data.solved.slice(),
      act: act,
      done: data.done,
      hintsUsed: totalHints(),
      tasks: tasks,
      story: data.story.slice(),
      stats: {
        commandsRun: data.commandsRun,
        startedAt: data.startedAt,
        finishAt: data.finishAt,
        totalFlags: FLAGS.length
      }
    };
  }

  function reset() {
    data = defaultData();
    save();
    return getState();
  }

  return { checkFlag, getHint, countCommand, getState, reset, currentAct };
}

module.exports = { createGameState, FLAGS, normalizeData };
