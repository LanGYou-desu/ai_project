'use strict';
const fs = require('fs');
const { FLAGS, ACT_TASKS, ACT_HINTS } = require('./worlddata');

const STORY_START = '你站在档案馆门口。三声门铃之后，灯亮了。';
const ACT_COMPLETE = {
  1: '第一幕 · 门房大厅 —— 完成。档案馆深处传来一声叹息，像是有东西在等你。',
  2: '第二幕 · 数据迷宫 —— 完成。回声越来越近了。',
  3: '第三幕 · 核心室 —— 完成。'
};

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

function createGameState(opts) {
  const stateFile = opts.stateFile;
  let data = null;
  if (fs.existsSync(stateFile)) {
    try {
      data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch (e) { data = null; }
  }
  if (!data) {
    data = defaultData();
    save();
  }

  function save() {
    try { fs.writeFileSync(stateFile, JSON.stringify(data, null, 2), 'utf8'); } catch (e) { /* 忽略写盘错误 */ }
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
    let msg = '✓ 口令正确：' + flag.flavor;
    const actFlags = FLAGS.filter(f => f.act === flag.act);
    if (solvedInAct(flag.act) === actFlags.length) {
      data.story.push(ACT_COMPLETE[flag.act]);
      const next = FLAGS.find(f => f.act === flag.act + 1);
      if (next) data.story.push('档案馆深处传来新的指引——你已获准进入第 ' + (flag.act + 1) + ' 幕。');
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
    const idx = Math.min(data.hints[act] || 0, list.length - 1);
    data.hints[act] = (data.hints[act] || 0) + 1;
    save();
    if ((data.hints[act] || 0) > list.length) return '这个区域已经没有更多提示了。';
    return '第 ' + act + ' 幕 · 提示：' + list[idx];
  }

  function countCommand() {
    data.commandsRun++;
    save();
  }

  function getState() {
    const act = currentAct();
    const tasks = {};
    for (const a of [1, 2, 3]) {
      tasks[a] = (ACT_TASKS[a] || []).map((text, i) => {
        const flagsOfAct = FLAGS.filter(f => f.act === a);
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

module.exports = { createGameState, FLAGS };
