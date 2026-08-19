'use strict';
/* SYNAPSE · 主控制器：织造台交互 / 训练循环 / 训练场挑战 / 知识卡 / 存档 */
(function (root) {
  'use strict';
  const NW = root.Synapse.network.Network;
  const TR = root.Synapse.trainer.Trainer;
  const DST = root.Synapse.datasets.DATASETS;
  const ED = root.Synapse.editor.SynapseEditor;
  const R = root.Synapse.render;
  const audio = root.Synapse.audio;
  const L = root.Synapse.losses;
  const TT = root.Synapse.tictactoe;

  const $ = function (id) { return document.getElementById(id); };

  const S = {
    dsId: 'xor',
    editor: null, net: null, trainer: null, dataset: null,
    running: false, raf: 0, epochsPerFrame: 3,
    sel: null, wireMode: false, wireSrc: null, drag: null,
    ttt: null,
    challengeRun: null, challengeBest: 0,
    muted: false,
    hp: { lr: 0.2, momentum: 0.9, batch: 32, epochs: 300, seed: 7, loss: 'ce' },
    milestones: [0.5, 0.2, 0.1, 0.05, 0.02],
    best: loadBest(),
    sizes: { net: { w: 0, h: 0 }, loss: { w: 0, h: 0 }, viz: { w: 0, h: 0 } }
  };

  function loadBest() {
    try { return JSON.parse(localStorage.getItem('synapse.best')) || {}; }
    catch (e) { return {}; }
  }
  function saveBest() {
    try { localStorage.setItem('synapse.best', JSON.stringify(S.best)); } catch (e) { /* ignore */ }
  }

  const CHALLENGES = [
    { id: 'xor', goal: 0.95, goalLabel: '准确率 ≥ 95%', hint: '一条直线分不开 → 必须有隐藏层，试试 2-4-1' },
    { id: 'moons', goal: 0.9, goalLabel: '准确率 ≥ 90%', hint: 'tanh 隐藏层 + 交叉熵，预设即可过关' },
    { id: 'spiral', goal: 0.8, goalLabel: '准确率 ≥ 80%', hint: '16 个神经元不够就加一层 / 加神经元' },
    { id: 'digits', goal: 0.9, goalLabel: '准确率 ≥ 90%', hint: 'softmax 输出 + 交叉熵，试着加深网络' },
    { id: 'tictactoe', goal: 0.8, goalLabel: '教师落子 ≥ 80%', hint: '训练完去织造台跟它对一局棋' }
  ];

  const CONCEPTS = [
    { t: '神经元 NEURON', b: '一个"小计算器"：把每个输入乘上权重再求和，加上偏置，最后过一个激活函数，吐出一个数字。', tip: '在织造台里选中一个神经元，试试改它的偏置。' },
    { t: '权重 WEIGHT', b: '每条连线上的"音量旋钮"：正权重放大信号，负权重把信号反过来。训练的本质就是不断拧这些旋钮。', tip: '点一条连线，看它的权重值；训练时它一直在变。' },
    { t: '偏置 BIAS', b: '神经元的"起跑线"：即使所有输入都是 0，偏置也决定它偏向激活还是沉默。', tip: '给某个神经元一个很大的偏置，观察输出层变化。' },
    { t: '激活函数 ACTIVATION', b: '给神经元注入"非线性"：sigmoid 压到 0~1，tanh 压到 -1~1，ReLU 直接砍掉负数。没有非线性，再多层也只是一条直线。', tip: '把隐藏层从 sigmoid 换成 tanh，感受收敛速度。' },
    { t: '前向传播 FORWARD', b: '数据从输入层开始，一层层加权求和、激活，最后在输出层得到预测。', tip: '打开控制台看每个数据集的输入维度。' },
    { t: '损失函数 LOSS', b: '量化"预测离答案有多远"：MSE 量欧氏距离，交叉熵惩罚"信誓旦旦却答错"。损失越小，模型越好。', tip: '损失曲线在训练时实时下降，就是网络在变聪明。' },
    { t: '反向传播 BACKPROP', b: '从输出层开始，把损失的责任按链式法则一层层"分摊"回每个权重——谁对错误贡献大，谁被修得多。', tip: '这是整个沙盒最硬核的一块：梯度校验测试验证了它的正确性。' },
    { t: '梯度下降 GRADIENT DESCENT', b: '沿着"损失下降最快的方向"迈一小步，不断重复。就像摸黑下山：哪边陡就往哪边走。', tip: '把学习率调大，看损失曲线怎样震荡甚至起飞。' },
    { t: '学习率 LEARNING RATE', b: '一步迈多大：太大 → 在谷底来回震荡甚至发散；太小 → 蜗牛爬，半天学不会。', tip: '同一份数据，lr=0.01 和 lr=1.0 各试一次，对比曲线。' },
    { t: '动量 MOMENTUM', b: '像下坡的球带着惯性：保留上一次更新的势头，能冲过小坑、躲开震荡，更快更稳。', tip: '把动量改成 0 再训练，感受"没惯性的球"怎么爬。' },
    { t: '批大小与回合 BATCH & EPOCH', b: '一个"回合" = 把整个数据集过一遍；训练时按"批"分批计算梯度。批越大梯度越稳，但更新越少。', tip: 'XOR 只有 4 个样本，批大小填 4 就是全批训练。' },
    { t: '过拟合 OVERFITTING', b: '容量太大时，网络会"背答案"而不是学规律：训练集满分、换新数据就露馅。', tip: '螺旋数据集用超大网络训练，再切到数字集测试。' },
    { t: '种子与确定性 SEED', b: '随机初始化、数据洗牌都由种子决定。同一种子 → 完全相同的随机序列 → 训练结果可复现。', tip: '同一网络同一超参，换一个种子看看结果差多少。' }
  ];

  /* ================= 初始化 ================= */
  function init() {
    buildDsSelect();
    buildChallengeCards();
    buildConceptCards();
    bindEvents();
    loadDataset(S.dsId);
    window.addEventListener('resize', function () { fitAll(); draw(); });
    S.raf = requestAnimationFrame(tick);
  }

  function buildDsSelect() {
    const sel = $('ds-select');
    sel.innerHTML = '';
    for (const id in DST) {
      const d = DST[id];
      const o = document.createElement('option');
      o.value = id;
      o.textContent = d.name;
      sel.appendChild(o);
    }
    sel.value = S.dsId;
  }

  function buildChallengeCards() {
    const grid = $('challenge-cards');
    grid.innerHTML = '';
    for (const c of CHALLENGES) {
      const d = DST[c.id];
      const passed = (S.best[c.id] || 0) >= c.goal;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="c-head"><span class="c-name">' + d.name + '</span>' +
        '<span class="c-tag ' + (passed ? 'passed' : '') + '">' + (passed ? '✓ 已通关' : '未通关') + '</span></div>' +
        '<div class="c-desc">' + d.desc + '</div>' +
        '<div class="c-goal">🎯 达标线：' + c.goalLabel + '</div>' +
        '<div class="c-best" id="best-' + c.id + '">当前最佳：' + ((S.best[c.id] || 0) * 100).toFixed(1) + '%</div>' +
        '<div class="c-tip">💡 ' + c.hint + '</div>' +
        '<button class="c-btn" id="ch-' + c.id + '">载入并训练</button>';
      grid.appendChild(card);
    }
    for (const c of CHALLENGES) {
      $('ch-' + c.id).addEventListener('click', function () { challengeRun(c.id); });
    }
  }

  function buildConceptCards() {
    const grid = $('concept-cards');
    grid.innerHTML = '';
    for (const c of CONCEPTS) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<div class="c-head"><span class="c-name">' + c.t + '</span></div>' +
        '<div class="c-body">' + c.b + '</div>' +
        '<div class="c-tip">🧪 动手试：' + c.tip + '</div>';
      grid.appendChild(card);
    }
  }

  function bindEvents() {
    // 标签页
    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', function () {
        for (const t of document.querySelectorAll('.tab')) t.classList.remove('active');
        for (const p of document.querySelectorAll('.tab-panel')) p.classList.remove('active');
        tab.classList.add('active');
        $('tab-' + tab.dataset.tab).classList.add('active');
        fitAll();
        draw();
      });
    }
    // 工具栏
    $('btn-add-layer').addEventListener('click', function () {
      S.editor.addHiddenLayer(S.editor.layers.length - 1, 4, currentHiddenAct());
      afterStructure();
    });
    $('btn-del-layer').addEventListener('click', function () {
      if (S.editor.hiddenLayerCount() === 0) return;
      S.editor.removeHiddenLayer(S.editor.layers.length - 2);
      afterStructure();
    });
    $('btn-add-neuron').addEventListener('click', function () {
      if (S.editor.hiddenLayerCount() === 0) {
        S.editor.addHiddenLayer(1, 4, currentHiddenAct());
        afterStructure();
        return;
      }
      const li = selLayerIndex();
      S.editor.addNeuron(li, currentHiddenAct());
      afterStructure();
    });
    $('btn-del-node').addEventListener('click', function () {
      if (S.sel && S.sel.type === 'node') {
        try { S.editor.removeNeuron(S.sel.nodeId); afterStructure(); } catch (e) { alert(e.message); }
      }
    });
    $('btn-autowire').addEventListener('click', function () { S.editor.autoWire(); afterStructure(); });
    $('btn-clear-edges').addEventListener('click', function () { S.editor.clearEdges(); afterStructure(); });
    $('btn-wire-mode').addEventListener('click', function () {
      S.wireMode = !S.wireMode;
      S.wireSrc = null;
      this.classList.toggle('on', S.wireMode);
    });
    // 训练
    $('btn-train').addEventListener('click', startTrain);
    $('btn-pause').addEventListener('click', function () { S.running = false; updateButtons(); });
    $('btn-reset').addEventListener('click', function () { applyHP(); rebuildNet(); });
    // 数据集与超参
    $('ds-select').addEventListener('change', function () { loadDataset(this.value); });
    for (const id of ['hp-lr', 'hp-momentum', 'hp-batch', 'hp-epochs', 'hp-seed', 'hp-loss']) {
      $(id).addEventListener('change', applyHP);
    }
    // 网络画布交互
    const nc = $('net-canvas');
    nc.addEventListener('pointerdown', onNetDown);
    nc.addEventListener('pointermove', onNetMove);
    nc.addEventListener('pointerup', function () { S.drag = null; });
    nc.addEventListener('pointercancel', function () { S.drag = null; });
    nc.addEventListener('contextmenu', onNetRightClick);
    // 井字棋画布
    $('viz-canvas').addEventListener('click', onVizClick);
    // 存档
    $('btn-save').addEventListener('click', saveState);
    $('btn-load').addEventListener('click', function () { $('file-load').click(); });
    $('file-load').addEventListener('change', loadStateFile);
    $('btn-mute').addEventListener('click', function () {
      S.muted = !S.muted;
      audio.setMuted(S.muted);
      this.textContent = S.muted ? '🔇' : '🔊';
    });
  }

  function currentHiddenAct() {
    const d = DST[S.dsId];
    return d && d.preset ? d.preset.hiddenAct : 'tanh';
  }
  function selLayerIndex() {
    if (S.sel && S.sel.type === 'node') {
      const n = S.editor.node(S.sel.nodeId);
      if (n && n.kind === 'hidden') return n.layer;
    }
    return Math.max(1, S.editor.layers.length - 2);
  }
  function afterStructure() {
    S.sel = null;
    hideNodePanel();
    layoutAndFit();
    rebuildNet();
  }

  /* ================= 数据集加载 ================= */
  function loadDataset(id) {
    S.running = false;
    S.dsId = id;
    const d = DST[id];
    S.dataset = d.make(d.preset.seed);
    S.editor = new ED({ inputCount: d.in, outputCount: d.out, outAct: d.outAct });
    const hidden = d.preset.layers.slice(1, -1);
    for (let i = 0; i < hidden.length; i++) {
      S.editor.addHiddenLayer(i + 1, hidden[i], d.preset.hiddenAct);
    }
    const p = d.preset;
    S.hp = { lr: p.lr, momentum: p.momentum, batch: p.batchSize, epochs: p.epochs, seed: p.seed, loss: p.loss };
    writeHPInputs();
    S.editor.autoWire();
    layoutAndFit();
    rebuildNet();
    S.wireMode = false;
    S.wireSrc = null;
    $('btn-wire-mode').classList.remove('on');
    hideNodePanel();
    updateVizHead();
    $('ds-desc').textContent = d.desc;
    $('ds-select').value = id;
    draw();
  }

  function writeHPInputs() {
    $('hp-lr').value = S.hp.lr;
    $('hp-momentum').value = S.hp.momentum;
    $('hp-batch').value = S.hp.batch;
    $('hp-epochs').value = S.hp.epochs;
    $('hp-seed').value = S.hp.seed;
    $('hp-loss').value = S.hp.loss;
  }

  function applyHP() {
    S.hp.lr = parseFloat($('hp-lr').value) || 0.1;
    S.hp.momentum = parseFloat($('hp-momentum').value) || 0;
    S.hp.batch = parseInt($('hp-batch').value, 10) || 1;
    S.hp.epochs = parseInt($('hp-epochs').value, 10) || 1;
    S.hp.seed = parseInt($('hp-seed').value, 10) || 1;
    S.hp.loss = $('hp-loss').value;
    if (S.trainer) {
      S.trainer.updateOpts({ lr: S.hp.lr, momentum: S.hp.momentum, batchSize: S.hp.batch, epochs: S.hp.epochs, loss: S.hp.loss });
    }
    updateStats();
  }

  /* ================= 网络重建 ================= */
  function rebuildNet() {
    S.running = false;
    try {
      S.net = S.editor.toNetwork(S.hp.seed);
    } catch (e) {
      alert(e.message);
      return;
    }
    S.trainer = new TR(S.net, {
      lr: S.hp.lr, momentum: S.hp.momentum, batchSize: S.hp.batch, epochs: S.hp.epochs,
      seed: S.hp.seed, loss: S.hp.loss, classifier: true
    });
    S.trainer.prepare(S.dataset);
    updateNetDims();
    updateStats();
    updateButtons();
    if (S.dsId === 'tictactoe') newTTT(S.ttt ? S.ttt.userSide : 1);
    draw();
  }

  /* ================= 训练循环 ================= */
  function startTrain() {
    applyHP();
    if (!S.trainer) return;
    if (S.trainer.state.done) {
      rebuildNet();
      return;
    }
    S.running = true;
    updateButtons();
    audio.pop();
  }
  function pauseTrain() {
    S.running = false;
    updateButtons();
  }

  function onEpoch(e) {
    updateStats();
    if (S.challengeRun && e.acc != null && e.acc > S.challengeBest) S.challengeBest = e.acc;
    while (S.milestones.length && e.loss < S.milestones[0]) {
      S.milestones.shift();
      audio.milestone(e.loss);
    }
    if (e.epoch % 25 === 0) draw();
  }
  function onDone() {
    S.running = false;
    updateButtons();
    draw();
    if (S.challengeRun) {
      const c = S.challengeRun;
      const acc = S.trainer.state.acc;
      if (acc != null && (S.best[c] || 0) < acc) {
        S.best[c] = acc;
        saveBest();
      }
      const passed = acc != null && acc >= goalOf(c);
      if (passed) {
        audio.success();
        const card = $('best-' + c);
        if (card) card.textContent = '当前最佳：' + (acc * 100).toFixed(1) + '%  🎉 达标！';
        const tag = card ? card.parentElement.querySelector('.c-tag') : null;
        if (tag) { tag.textContent = '✓ 已通关'; tag.className = 'c-tag passed'; }
      } else {
        audio.tone(220, 0.25, 'sine', 0.05);
        const card = $('best-' + c);
        if (card) card.textContent = '当前最佳：' + (acc * 100).toFixed(1) + '%  （未达标，去织造台加容量）';
      }
      S.challengeRun = null;
      S.challengeBest = 0;
      S.epochsPerFrame = 3;
    } else if (S.trainer.state.acc != null && S.trainer.state.acc >= 0.95) {
      audio.success();
    }
  }
  function goalOf(id) {
    for (const c of CHALLENGES) if (c.id === id) return c.goal;
    return 1;
  }

  function tick() {
    if (S.running && S.trainer && !S.trainer.state.done) {
      for (let i = 0; i < S.epochsPerFrame; i++) {
        const e = S.trainer.runEpoch();
        if (e) onEpoch(e);
        if (S.trainer.state.done) { onDone(); break; }
      }
    }
    draw();
    S.raf = requestAnimationFrame(tick);
  }

  /* ================= 渲染 ================= */
  function fitCanvas(canvas, h, key) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(120, canvas.clientWidth || canvas.parentElement.clientWidth - 4);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.sizes[key] = { w: w, h: h };
    return ctx;
  }
  function fitAll() {
    fitCanvas($('net-canvas'), 500, 'net');
    fitCanvas($('loss-canvas'), 150, 'loss');
    fitCanvas($('viz-canvas'), 330, 'viz');
  }
  function layoutAndFit() {
    fitAll();
    if (S.editor) R.layout(S.editor, S.sizes.net.w, S.sizes.net.h);
  }

  function draw() {
    if (!S.editor || !S.net) return;
    const nctx = fitCanvas($('net-canvas'), 500, 'net');
    R.drawGraph(nctx, S.editor, S.net, S.sel, S.wireSrc, S.sizes.net.w, S.sizes.net.h);
    const lctx = fitCanvas($('loss-canvas'), 150, 'loss');
    R.drawLoss(lctx, S.trainer ? S.trainer.state.history : [], S.sizes.loss.w, S.sizes.loss.h);
    const vctx = fitCanvas($('viz-canvas'), 330, 'viz');
    drawViz(vctx);
  }

  function drawViz(ctx) {
    const d = DST[S.dsId];
    if (!d) return;
    if (d.viz === 'boundary') {
      R.drawBoundary(ctx, S.net, S.dataset, S.sizes.viz.w, S.sizes.viz.h, rangeOf(S.dataset));
    } else if (d.viz === 'digits') {
      R.drawDigitsViz(ctx, S.net, S.sizes.viz.w, S.sizes.viz.h);
    } else if (d.viz === 'tictactoe') {
      if (!S.ttt) newTTT(1);
      R.drawTTT(ctx, S.ttt, S.sizes.viz.w, S.sizes.viz.h);
    }
  }
  function rangeOf(ds) {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const inp of ds.inputs) {
      if (inp[0] < xmin) xmin = inp[0];
      if (inp[0] > xmax) xmax = inp[0];
      if (inp[1] < ymin) ymin = inp[1];
      if (inp[1] > ymax) ymax = inp[1];
    }
    const px = (xmax - xmin) * 0.25 || 0.5, py = (ymax - ymin) * 0.25 || 0.5;
    return [xmin - px, xmax + px, ymin - py, ymax + py];
  }

  function updateNetDims() {
    const layers = [];
    for (const col of S.editor.layers) layers.push(col.length);
    $('net-dims').textContent = layers.join(' → ') + ' · ' + S.editor.edgeCount() + ' 条连线';
  }
  function updateStats() {
    if (!S.trainer) return;
    $('st-epoch').textContent = S.trainer.state.epoch + ' / ' + S.trainer.opts.epochs;
    $('st-loss').textContent = S.trainer.state.epoch ? S.trainer.state.loss.toFixed(4) : '—';
    $('st-acc').textContent = (S.trainer.state.acc != null && S.trainer.state.epoch) ? (S.trainer.state.acc * 100).toFixed(1) + '%' : '—';
    $('progress-bar').style.width = (S.trainer.state.epoch / S.trainer.opts.epochs * 100) + '%';
  }
  function updateButtons() {
    $('btn-train').disabled = S.running;
    $('btn-pause').disabled = !S.running;
  }

  /* ================= 画布交互 ================= */
  function canvasPos(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function onNetDown(e) {
    if (!S.editor) return;
    const p = canvasPos(e);
    const node = R.hitNode(S.editor, p.x, p.y);
    if (S.wireMode) {
      if (!node) { S.wireSrc = null; }
      else if (!S.wireSrc) { S.wireSrc = node.id; audio.pop(); }
      else {
        S.editor.toggleEdge(S.wireSrc, node.id);
        audio.pop();
        S.wireSrc = null;
        afterStructure();
      }
      draw();
      return;
    }
    if (node) {
      S.sel = { type: 'node', nodeId: node.id };
      S.drag = { nodeId: node.id, dx: p.x - node.pos.x, dy: p.y - node.pos.y };
      showNodePanel();
    } else {
      const edge = R.hitEdge(S.editor, p.x, p.y);
      if (edge) {
        S.sel = { type: 'edge', edgeId: edge.id, fromId: edge.from, toId: edge.to };
        showNodePanel();
      } else {
        S.sel = null;
        hideNodePanel();
      }
    }
    draw();
  }
  function onNetMove(e) {
    if (!S.drag) return;
    const p = canvasPos(e);
    const n = S.editor.node(S.drag.nodeId);
    if (n) {
      n.pos.x = p.x - S.drag.dx;
      n.pos.y = p.y - S.drag.dy;
    }
    draw();
  }
  function onNetRightClick(e) {
    e.preventDefault();
    if (!S.editor) return;
    const p = canvasPos(e);
    const node = R.hitNode(S.editor, p.x, p.y);
    if (node && node.kind === 'hidden') {
      try { S.editor.removeNeuron(node.id); afterStructure(); } catch (err) { /* keep */ }
      return;
    }
    const edge = R.hitEdge(S.editor, p.x, p.y);
    if (edge) {
      S.editor.removeEdge(edge.from, edge.to);
      afterStructure();
    }
  }

  /* ================= 选中面板 ================= */
  function showNodePanel() {
    const p = $('node-panel');
    if (!S.sel) { p.hidden = true; return; }
    if (S.sel.type === 'node') {
      const n = S.editor.node(S.sel.nodeId);
      if (!n) { p.hidden = true; return; }
      const kindName = n.kind === 'input' ? '输入' : (n.kind === 'output' ? '输出' : '隐藏');
      let html = '<h3>神经元 ' + n.label + '</h3>' +
        '<div class="row"><label>类型</label><span>' + kindName + ' · 第 ' + (n.layer + 1) + ' 层</span></div>';
      if (n.kind === 'hidden') {
        html += '<div class="row"><label>激活</label><select id="np-act">' + actOptions(n.activation) + '</select></div>';
      }
      if (n.kind !== 'input') {
        html += '<div class="row"><label>偏置</label><input type="number" step="0.05" id="np-bias" value="' + n.bias + '"></div>';
      }
      if (n.kind === 'hidden') html += '<button class="del" id="np-del">删除该神经元</button>';
      p.innerHTML = html;
      if (n.kind === 'hidden') {
        $('np-act').addEventListener('change', function () {
          n.activation = this.value;
          const col = S.editor.layers[n.layer];
          const i = col.indexOf(n);
          if (S.net && n.layer - 1 >= 0 && S.net.acts[n.layer - 1]) S.net.acts[n.layer - 1][i] = this.value;
          draw();
        });
      }
      const biasEl = $('np-bias');
      if (biasEl) biasEl.addEventListener('input', function () {
        const v = parseFloat(this.value) || 0;
        n.bias = v;
        const col = S.editor.layers[n.layer];
        const i = col.indexOf(n);
        if (S.net && n.layer - 1 >= 0) S.net.b[n.layer - 1][i] = v;
        draw();
      });
      const del = $('np-del');
      if (del) del.addEventListener('click', function () {
        try { S.editor.removeNeuron(n.id); afterStructure(); hideNodePanel(); } catch (err) { alert(err.message); }
      });
    } else {
      const e = S.editor.edgeBetween(S.sel.fromId, S.sel.toId);
      if (!e) { p.hidden = true; return; }
      const from = S.editor.node(e.from), to = S.editor.node(e.to);
      const w = S.editor.getWeight(S.net, e);
      p.innerHTML = '<h3>连线 ' + from.label + ' → ' + to.label + '</h3>' +
        '<div class="row"><label>权重</label><input type="number" step="0.05" id="np-w" value="' + w.toFixed(3) + '"></div>' +
        '<div class="row"><label>当前</label><span id="np-w-cur">' + w.toFixed(3) + '（训练中会变化）</span></div>' +
        '<button class="del" id="np-del-edge">删除该连线</button>';
      $('np-w').addEventListener('input', function () {
        const v = parseFloat(this.value) || 0;
        try {
          S.editor.setWeight(S.net, e.from, e.to, v);
          $('np-w-cur').textContent = v.toFixed(3) + '（训练中会变化）';
        } catch (err) { /* ignore */ }
        draw();
      });
      $('np-del-edge').addEventListener('click', function () {
        S.editor.removeEdge(e.from, e.to);
        afterStructure();
        hideNodePanel();
      });
    }
    p.hidden = false;
  }
  function hideNodePanel() { $('node-panel').hidden = true; }
  function actOptions(cur) {
    const acts = ['sigmoid', 'tanh', 'relu', 'leaky', 'identity'];
    let h = '';
    for (const a of acts) h += '<option value="' + a + '"' + (a === cur ? ' selected' : '') + '>' + a + '</option>';
    return h;
  }

  /* ================= 井字棋 ================= */
  function newTTT(userSide) {
    S.ttt = {
      board: new Array(9).fill(0),
      userSide: userSide == null ? 1 : userSide,
      turn: 1,
      over: false,
      msg: (userSide === 1 ? '你执 ✕ 先手，点击棋盘落子' : '网络执 ✕ 先手…'),
      winLine: null
    };
    if (userSide === -1) setTimeout(netMove, 300);
    updateVizHead();
  }
  function updateVizHead() {
    const d = DST[S.dsId];
    if (!d) return;
    $('viz-title').textContent = d.viz === 'boundary' ? '决策边界（实时）' : (d.viz === 'digits' ? '数字识别测试' : '井字棋对战');
    const sub = $('viz-sub');
    if (d.viz === 'tictactoe') {
      sub.innerHTML = '<button id="ttt-x">✕ 先手</button> <button id="ttt-o">◯ 后手</button>';
      $('ttt-x').addEventListener('click', function () { newTTT(1); draw(); });
      $('ttt-o').addEventListener('click', function () { newTTT(-1); draw(); });
    } else {
      sub.innerHTML = '';
    }
  }
  function onVizClick(e) {
    const d = DST[S.dsId];
    if (!d || d.viz !== 'tictactoe' || !S.ttt || !S.net) return;
    const t = S.ttt;
    if (t.over || t.turn !== t.userSide) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const W = S.sizes.viz.w, H = S.sizes.viz.h;
    const size = Math.min(W - 40, H - 64);
    const ox = (W - size) / 2, oy = (H - size) / 2 + 14;
    const cw = size / 3;
    const c = Math.floor((x - ox) / cw), r = Math.floor((y - oy) / cw);
    if (r < 0 || r > 2 || c < 0 || c > 2) return;
    const idx = r * 3 + c;
    if (t.board[idx] !== 0) return;
    t.board[idx] = t.userSide;
    checkTTT();
    if (!t.over) {
      t.turn = -t.turn;
      t.msg = '网络思考中…';
      draw();
      setTimeout(netMove, 280);
    }
    draw();
  }
  function netMove() {
    const t = S.ttt;
    if (!t || t.over || !S.net) return;
    const mv = TT.predictMove(S.net, t.board);
    if (mv < 0) { t.over = true; t.msg = '平局 · 和棋'; draw(); return; }
    t.board[mv] = -t.userSide;
    checkTTT();
    if (!t.over) {
      t.turn = t.userSide;
      t.msg = '轮到你落子';
    }
    draw();
  }
  function checkTTT() {
    const t = S.ttt;
    const w = TT.winner(t.board);
    if (w !== 0) {
      t.over = true;
      t.winLine = winLineOf(t.board);
      t.msg = w === t.userSide ? '🎉 你赢了！' : '网络赢了！去加容量再来战';
      audio.tone(w === t.userSide ? 660 : 330, 0.25, 'sine', 0.06);
      return;
    }
    if (t.board.indexOf(0) === -1) {
      t.over = true;
      t.msg = '平局 · 和棋';
    }
  }
  function winLineOf(board) {
    for (const ln of TT.LINES) {
      const a = board[ln[0]], b = board[ln[1]], c = board[ln[2]];
      if (a !== 0 && a === b && b === c) return ln;
    }
    return null;
  }

  /* ================= 训练场挑战 ================= */
  function challengeRun(id) {
    loadDataset(id);
    S.challengeRun = id;
    S.challengeBest = S.best[id] || 0;
    S.epochsPerFrame = 6;
    startTrain();
    // 切到织造台看现场
    for (const t of document.querySelectorAll('.tab')) t.classList.remove('active');
    for (const p of document.querySelectorAll('.tab-panel')) p.classList.remove('active');
    document.querySelector('.tab[data-tab="workshop"]').classList.add('active');
    $('tab-workshop').classList.add('active');
  }

  /* ================= 存档 ================= */
  function saveState() {
    const data = {
      kind: 'SynapseSave', version: 1,
      dsId: S.dsId,
      editor: S.editor.serialize(),
      net: S.net.serialize(),
      hp: { lr: S.hp.lr, momentum: S.hp.momentum, batch: S.hp.batch, epochs: S.hp.epochs, seed: S.hp.seed, loss: S.hp.loss }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'synapse-net.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function loadStateFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (!data || data.kind !== 'SynapseSave') throw new Error('文件格式不对');
        S.dsId = data.dsId;
        S.editor = ED.fromJSON(data.editor);
        S.net = NW.fromJSON(data.net);
        S.dataset = DST[S.dsId].make(DST[S.dsId].preset.seed);
        S.hp = data.hp || S.hp;
        S.trainer = new TR(S.net, {
          lr: S.hp.lr, momentum: S.hp.momentum, batchSize: S.hp.batch, epochs: S.hp.epochs,
          seed: S.hp.seed, loss: S.hp.loss, classifier: true
        });
        S.trainer.prepare(S.dataset);
        $('ds-select').value = S.dsId;
        writeHPInputs();
        $('ds-desc').textContent = DST[S.dsId].desc;
        layoutAndFit();
        updateNetDims();
        updateStats();
        updateButtons();
        updateVizHead();
        if (S.dsId === 'tictactoe') newTTT(1);
        draw();
        alert('导入成功！');
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  /* ================= 启动 ================= */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
