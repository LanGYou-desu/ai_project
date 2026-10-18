/* LASTBROADCAST · 前端主逻辑（js/main.js）集成测试
   在最小浏览器沙箱里真实加载 index.html 的 6 个脚本，并走真实的点击事件路径 */
const { test } = require('node:test');
const assert = require('node:assert');
const { bootGame, clickAct, clickPhone } = require('./_boot.js');

function findBtn(dom, act, id) {
  const btns = dom.getEl('actions').querySelectorAll('button[data-act]');
  return btns.filter(function (b) {
    return b.getAttribute('data-act') === act && (id === undefined || b.getAttribute('data-id') === id);
  })[0];
}

function playSongs(dom, n, song) {
  for (let i = 0; i < n; i++) {
    clickAct(dom, 'menu:songs');
    clickAct(dom, 'song:' + (song || 'nightstar'));
  }
}

test('首屏：时间轴/精力/电话总机就绪，且未交互前不创建 AudioContext（自动播放策略）', () => {
  const { dom, fake } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  assert.strictEqual(dom.getEl('turnLabel').textContent, '22:00 · 入夜');
  assert.strictEqual(dom.getEl('remaining').textContent, '还剩 24 小时');
  assert.strictEqual(dom.getEl('stamVal').textContent, '70');
  assert.match(dom.getEl('phone')._children[0].innerHTML, /苏珊/);
  assert.strictEqual(fake.log.ctx, null, '页面加载阶段不应创建 AudioContext');
  assert.ok(dom.getEl('actions').innerHTML.includes('menu:songs'));
});

test('首次交互后音频解锁：上下文建立、环境音生效、来电铃补响', () => {
  const { dom, fake } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  assert.strictEqual(fake.log.created.filter(n => n.kind === 'filter').length, 0);
  dom.document.dispatch('pointerdown', {});
  assert.ok(fake.log.ctx, '交互后应创建 AudioContext');
  assert.strictEqual(fake.log.ctx.state, 'running');
  const bp = fake.log.created.filter(n => n.kind === 'filter' && n.type === 'bandpass')[0];
  assert.ok(bp, '应建立环境音层（bandpass 滤波器）');
  assert.ok(bp.connections[0].gain.value > 0, '环境音增益应被打开');
});

test('整夜跑完（11 回合 + 终局）会弹出结局面板与成就提示（回归：toast 未定义导致结局页不出现）', () => {
  const { dom } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  playSongs(dom, 11);
  assert.strictEqual(dom.getEl('turnLabel').textContent, '22:00 · 终局');
  assert.strictEqual(dom.getEl('remaining').textContent, '终局时刻');
  clickAct(dom, 'final:hope');
  assert.strictEqual(dom.getEl('ending').classList.contains('hidden'), false, '终局必须弹出结局页');
  assert.ok(dom.getEl('endTitle').textContent.length > 0);
  assert.match(dom.getEl('endFates').innerHTML, /听众|苏珊/);
  assert.ok(dom.getEl('endUnlock').innerHTML.includes('结局图鉴'));
  assert.match(dom.getEl('toast').textContent, /成就解锁|已解锁/);
});

test('最后发言按钮之外的动作用旧按钮触发时会被拒绝并给出提示（不再静默失败）', () => {
  const { dom } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  const staleSilence = findBtn(dom, 'silence');
  playSongs(dom, 11);
  staleSilence.click();                       // 第 11 回合点了一个过期的"沉默"
  assert.match(dom.getEl('toast').textContent, /最后一刻/);
  assert.strictEqual(dom.getEl('ending').classList.contains('hidden'), true, '非法动作不应结束游戏');
});

test('歌单每帧只读一次收藏存档（回归：31 首歌各 parse 一次 localStorage）', () => {
  const { dom } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  dom.lsReads['lb-favs'] = 0;
  clickAct(dom, 'menu:songs');
  assert.strictEqual(dom.lsReads['lb-favs'], 1, '渲染一次歌单只应读取一次收藏，实际 ' + dom.lsReads['lb-favs']);
});

test('收藏按钮：写入存档并与引擎状态同步（含播放 +1 希望）', () => {
  const { dom } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  clickAct(dom, 'menu:songs');
  findBtn(dom, 'fav', 'starlet').click();
  assert.deepStrictEqual(JSON.parse(dom.localStorage.getItem('lb-favs')), ['starlet']);
  clickAct(dom, 'song:starlet');
  assert.ok(dom.getEl('log')._children.some(c => c.innerHTML.includes('收藏的歌')), '播放收藏曲应有加成日志');
});

test('「再播一夜」不会重复绑定全局监听（回归：重播 N 次后一次点击触发 N 次）', () => {
  const { dom } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  const replay = dom.getEl('btnReplay');
  assert.strictEqual(replay.handlerCount('click'), 1);
  playSongs(dom, 2);
  dom.getEl('btnReplay')._handlers.click[0]({});
  dom.getEl('btnReplay')._handlers.click[0]({});
  assert.strictEqual(dom.getEl('btnReplay').handlerCount('click'), 1, '重播后监听器数量必须仍是 1');
  assert.strictEqual(dom.getEl('turnLabel').textContent, '22:00 · 入夜', '重播应回到第一幕');
});

test('存档：合法存档可继续，字段缺失的坏存档被拒绝且给出提示', () => {
  const a = bootGame({ seed: { 'lb-intro-seen': '1' } });
  playSongs(a.dom, 3);
  const save = a.dom.localStorage.getItem('lb-save');
  assert.ok(save, '每回合应自动存档');

  const b = bootGame({ seed: { 'lb-intro-seen': '1', 'lb-save': save } });
  assert.strictEqual(b.dom.getEl('btnContinue').classList.contains('hidden'), false);
  b.dom.getEl('btnContinue')._handlers.click[0]({});
  assert.strictEqual(b.dom.getEl('turnLabel').textContent, '04:00 · 黎明前');
  assert.match(b.dom.getEl('toast').textContent, /已恢复/);

  const c = bootGame({ seed: { 'lb-intro-seen': '1', 'lb-save': '{"game":{"turn":3,"hope":50}}' } });
  c.dom.getEl('btnContinue')._handlers.click[0]({});
  assert.match(c.dom.getEl('toast').textContent, /没有找到存档/);
  assert.strictEqual(c.dom.getEl('turnLabel').textContent, '22:00 · 入夜', '拒绝坏存档后应保持新局');
});

test('FREQUENCY X：没接温教授的电话时显示为"听不懂"的灰按钮，接了才可点', () => {
  const noProf = bootGame({ seed: { 'lb-intro-seen': '1' } });
  playSongs(noProf.dom, 10);
  assert.ok(noProf.dom.getEl('actions').innerHTML.includes('FREQUENCY X · 听不懂'));
  assert.strictEqual(noProf.dom.getEl('actions').innerHTML.includes('data-act="menu:x"'), false);

  const withProf = bootGame({ seed: { 'lb-intro-seen': '1' } });
  for (let i = 0; i < 9; i++) { clickAct(withProf.dom, 'menu:songs'); clickAct(withProf.dom, 'song:nightstar'); }
  clickAct(withProf.dom, 'call:professor');       // 第 10 幕（T9）接温教授 → 进入 T10
  assert.ok(withProf.dom.getEl('actions').innerHTML.includes('data-act="menu:x"'), '接了教授后可解码');
  clickAct(withProf.dom, 'menu:x');
  clickAct(withProf.dom, 'signal:x:decode');
  const saved = JSON.parse(withProf.dom.localStorage.getItem('lb-save')).game;
  assert.strictEqual(saved.flags.signalDecoded, true, '解码后应写入 signalDecoded');
  assert.strictEqual(saved.flags.professorMet, true);
});

test('隐藏曲《纪念日》：集齐 6 个基础结局才出现在歌单，数量提示同步', () => {
  const locked = bootGame({ seed: { 'lb-intro-seen': '1' } });
  clickAct(locked.dom, 'menu:songs');
  assert.strictEqual(locked.dom.getEl('actions').innerHTML.includes('纪念日'), false);
  clickAct(locked.dom, 'back');
  assert.ok(locked.dom.getEl('actions').innerHTML.includes('30 首'), '未解锁时应显示 30 首');

  const base6 = ['dawn', 'signal', 'fire', 'dust', 'beacon', 'afterglow'];
  const open = bootGame({ seed: { 'lb-intro-seen': '1', 'lb-endings': JSON.stringify(base6) } });
  clickAct(open.dom, 'menu:songs');
  assert.ok(open.dom.getEl('actions').innerHTML.includes('纪念日'), '集齐基础结局后应出现隐藏曲');
  clickAct(open.dom, 'back');
  assert.ok(open.dom.getEl('actions').innerHTML.includes('31 首'), '解锁后应显示 31 首');
});

test('本地存储不可用（隐私模式）时给出提示，且游戏仍可玩', () => {
  const { dom } = bootGame({ storageThrows: true, seed: {} });
  assert.match(dom.getEl('toast').textContent, /本地存储/);
  assert.doesNotThrow(() => playSongs(dom, 2));
  assert.strictEqual(dom.getEl('turnLabel').textContent, '02:00 · 深夜');
});

test('底噪强度随剧情变化（军队切频最吵、停电后最安静）', () => {
  const { dom, fake } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  dom.document.dispatch('pointerdown', {});
  const gains = fake.log.created.filter(n => n.kind === 'gain');
  const noiseGain = gains[1];                       // ensure(): master -> noise -> hum -> music
  assert.strictEqual(noiseGain.gain.value, 0.05);   // 入夜
  playSongs(dom, 5);                                // 推进到 08:00（军队切频）
  assert.strictEqual(noiseGain.gain.value, 0.09);
  playSongs(dom, 3);                                // 推进到 14:00（停电）
  assert.strictEqual(noiseGain.gain.value, 0.03);
});

test('电话总机可直接接听；城市窗口/情绪曲线/VU/示波器逐帧绘制不报错', () => {
  const { dom } = bootGame({ seed: { 'lb-intro-seen': '1' } });
  clickPhone(dom, 0);                                  // 接苏珊（T0）
  assert.ok(dom.getEl('log')._children.some(c => c.innerHTML.includes('苏珊')));
  assert.doesNotThrow(() => dom.flushFrames(3));
  dom.document.hidden = true;
  assert.doesNotThrow(() => dom.document.dispatch('visibilitychange', {}));
  dom.document.hidden = false;
  assert.doesNotThrow(() => dom.document.dispatch('visibilitychange', {}));
  assert.doesNotThrow(() => dom.flushFrames(1));
});
