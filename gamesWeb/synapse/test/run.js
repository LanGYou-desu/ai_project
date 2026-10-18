'use strict';
/* SYNAPSE · 零依赖单元测试：node test/run.js */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SH = path.join(ROOT, 'js', 'shared');
function load(name) { return require(path.join(SH, name)); }

const R = load('rng.js');
const A = load('activations.js');
const L = load('losses.js');
const NW = load('network.js');
const TR = load('trainer.js');
const DS = load('datasets.js');
const TT = load('tictactoe.js');
const ED = load('editor.js');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  ✗ ' + msg); }
}
function eq(a, b, msg) { ok(a === b, (msg || '') + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function near(a, b, tol, msg) {
  tol = tol == null ? 1e-9 : tol;
  ok(Math.abs(a - b) <= tol, (msg || '') + ' (got ' + a + ', want ' + b + ')');
}
function arrClose(a, b, tol, msg) {
  tol = tol == null ? 1e-9 : tol;
  if (a.length !== b.length) return ok(false, (msg || '') + ' 长度不同');
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tol) return ok(false, (msg || '') + ' 位置' + i + ': ' + a[i] + ' vs ' + b[i]);
  }
  ok(true, (msg || '') + ' ✓');
}
function section(name) { console.log('\n== ' + name + ' =='); }

/* ---------- RNG ---------- */
section('RNG 确定性');
{
  const a = R.createRng(42), b = R.createRng(42);
  let same = true;
  for (let i = 0; i < 100; i++) if (a() !== b()) same = false;
  ok(same, '同种子产生相同序列');
  const c = R.createRng(43), d = R.createRng(42);
  ok(c() !== d(), '不同种子产生不同序列');
  const arr = [1,2,3,4,5,6,7,8];
  const s1 = R.shuffle(arr.slice(), R.createRng(9));
  const s2 = R.shuffle(arr.slice(), R.createRng(9));
  ok(s1.join(',') === s2.join(','), 'shuffle 确定性');
  ok(s1.slice().sort().join(',') === '1,2,3,4,5,6,7,8', 'shuffle 保留元素');
  let sum = 0, n = 20000;
  for (let i = 0; i < n; i++) sum += R.randn(R.createRng(i));
  near(sum / n, 0, 0.05, 'randn 均值≈0');
}

/* ---------- 激活函数 ---------- */
section('激活函数');
{
  near(A.act('sigmoid', 0), 0.5, 1e-12, 'sigmoid(0)=0.5');
  near(A.dact('sigmoid', 0.5), 0.25, 1e-12, 'sigmoid df');
  near(A.act('tanh', 0), 0, 1e-12, 'tanh(0)=0');
  near(A.dact('tanh', 0), 1, 1e-12, 'tanh df(0)=1');
  eq(A.act('relu', -3), 0, 'relu(-3)=0');
  eq(A.act('relu', 3), 3, 'relu(3)=3');
  near(A.act('leaky', -3), -0.03, 1e-12, 'leaky(-3)');
  eq(A.act('identity', 5), 5, 'identity');
  eq(A.NAMES.length, 5, '5 种激活');
}

/* ---------- 损失函数 ---------- */
section('损失函数');
{
  near(L.lossValue('mse', [0.5, 0.5], [1, 0]), 0.25, 1e-12, 'mse 值');
  near(L.lossValue('ce', [0.5], [1]), Math.log(2), 1e-9, 'ce 二分类 (t=1,p=0.5)=ln2');
  near(L.lossValue('ce', [0.5], [0]), Math.log(2), 1e-9, 'ce 二分类 (t=0,p=0.5)=ln2');
  near(L.lossValue('ce', [0.7, 0.3], [1, 0]), -Math.log(0.7), 1e-9, 'ce one-hot');
  eq(L.argmax([0.1, 0.8, 0.05]), 1, 'argmax');
  near(L.accuracy([[0.1, 0.9], [0.9, 0.1]], [[0, 1], [1, 0]]), 1, 1e-12, 'accuracy');
}

/* ---------- 前向传播 ---------- */
section('前向传播');
{
  const net = new NW.Network({ layers: [2, 1], outAct: 'sigmoid', seed: 1 });
  net.W[0] = [[1, -1]]; net.b[0] = [0.5];
  const p = net.predict([1, 0]);
  near(p[0], 1 / (1 + Math.exp(-1.5)), 1e-12, '手算前向 sigmoid(1.5)');
  const net2 = new NW.Network({ layers: [2, 2, 1], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 1 });
  net2.W[0] = [[1, 0], [0, 1]]; net2.b[0] = [0, 0];
  net2.W[1] = [[1, 1]]; net2.b[1] = [0];
  const p2 = net2.predict([0.5, -0.5]);
  const h0 = Math.tanh(0.5), h1 = Math.tanh(-0.5);
  near(p2[0], 1 / (1 + Math.exp(-(h0 + h1))), 1e-12, '两层前向');
  const net3 = new NW.Network({ layers: [2, 3], outAct: 'softmax', seed: 1 });
  const p3 = net3.predict([1, 1]);
  let s = 0; for (const v of p3) s += v;
  near(s, 1, 1e-12, 'softmax 求和=1');
  ok(net3.predict([1, 0]).length === 3, 'softmax 输出维度');
}

/* ---------- 反向传播梯度校验 ---------- */
section('梯度校验（数值 vs 解析）');
function gradCheck(net, input, target, loss, eps, tol) {
  eps = eps == null ? 1e-6 : eps;
  tol = tol == null ? 1e-4 : tol;
  const g = net.backward(input, target, loss);
  let allOk = true, worst = 0;
  for (let l = 0; l < net.W.length; l++) {
    for (let i = 0; i < net.W[l].length; i++) {
      for (let j = 0; j < net.W[l][i].length; j++) {
        const orig = net.W[l][i][j];
        net.W[l][i][j] = orig + eps;
        const fp = L.lossValue(loss, net.predict(input), target);
        net.W[l][i][j] = orig - eps;
        const fm = L.lossValue(loss, net.predict(input), target);
        net.W[l][i][j] = orig;
        const num = (fp - fm) / (2 * eps);
        const ana = g.dW[l][i][j];
        const rel = Math.abs(num - ana) / (Math.abs(num) + Math.abs(ana) + 1e-12);
        if (rel > tol) { allOk = false; worst = Math.max(worst, rel); }
      }
    }
    for (let i = 0; i < net.b[l].length; i++) {
      const orig = net.b[l][i];
      net.b[l][i] = orig + eps;
      const fp = L.lossValue(loss, net.predict(input), target);
      net.b[l][i] = orig - eps;
      const fm = L.lossValue(loss, net.predict(input), target);
      net.b[l][i] = orig;
      const num = (fp - fm) / (2 * eps);
      const ana = g.db[l][i];
      const rel = Math.abs(num - ana) / (Math.abs(num) + Math.abs(ana) + 1e-12);
      if (rel > tol) { allOk = false; worst = Math.max(worst, rel); }
    }
  }
  return { allOk: allOk, worst: worst };
}
{
  let net = new NW.Network({ layers: [2, 2, 1], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 3 });
  let r = gradCheck(net, [0.3, -0.7], [0.4], 'mse');
  ok(r.allOk, 'tanh/sigmoid mse 梯度 (worst=' + r.worst.toFixed(2e1) + ')');
  net = new NW.Network({ layers: [2, 3, 1], hiddenAct: 'relu', outAct: 'sigmoid', seed: 5 });
  r = gradCheck(net, [-0.2, 0.8], [1], 'ce');
  ok(r.allOk, 'relu/sigmoid ce 梯度 (worst=' + r.worst.toFixed(2e1) + ')');
  net = new NW.Network({ layers: [2, 3, 2], hiddenAct: 'sigmoid', outAct: 'softmax', seed: 8 });
  r = gradCheck(net, [0.1, 0.9], [0, 1], 'ce');
  ok(r.allOk, 'softmax ce 梯度 (worst=' + r.worst.toFixed(2e1) + ')');
  net = new NW.Network({ layers: [3, 4, 2], hiddenActs: [['relu', 'tanh', 'sigmoid', 'leaky']], outAct: 'softmax', seed: 11 });
  r = gradCheck(net, [0.4, -0.3, 0.2], [1, 0], 'ce');
  ok(r.allOk, '混合激活 softmax ce 梯度 (worst=' + r.worst.toFixed(2e1) + ')');
}

/* ---------- 序列化 ---------- */
section('序列化');
{
  const net = new NW.Network({ layers: [3, 5, 2], hiddenAct: 'relu', outAct: 'softmax', seed: 42 });
  const clone = NW.Network.fromJSON(net.serialize());
  let same = true;
  for (let l = 0; l < net.W.length; l++) for (let i = 0; i < net.W[l].length; i++) for (let j = 0; j < net.W[l][i].length; j++) if (net.W[l][i][j] !== clone.W[l][i][j]) same = false;
  ok(same, '网络序列化往返一致');
  eq(clone.outAct, 'softmax', 'outAct 保留');
  const p1 = net.predict([1, 0, 1]), p2 = clone.predict([1, 0, 1]);
  arrClose(p1, p2, 1e-12, '克隆网络预测一致');
}

/* ---------- 掩码 ---------- */
section('权重掩码');
{
  const net = new NW.Network({ layers: [2, 3, 1], hiddenAct: 'sigmoid', outAct: 'sigmoid', seed: 2 });
  net.mask = [
    [[true, false], [false, true], [false, false]],
    [[true, true, false]]
  ];
  for (let l = 0; l < net.W.length; l++) {
    for (let i = 0; i < net.W[l].length; i++) for (let j = 0; j < net.W[l][i].length; j++) {
      if (!net.mask[l][i][j]) net.W[l][i][j] = 0;
    }
  }
  const snapshot = JSON.stringify(net.serialize().W);
  const tr = new TR.Trainer(net, { lr: 0.5, momentum: 0, batchSize: 2, epochs: 5, loss: 'mse', classifier: false });
  tr.fit({ inputs: [[0,0],[0,1],[1,0],[1,1]], targets: [[0],[1],[1],[0]] });
  const after = net.serialize().W;
  let maskedUntouched = true;
  for (let l = 0; l < net.W.length; l++) {
    for (let i = 0; i < net.W[l].length; i++) for (let j = 0; j < net.W[l][i].length; j++) {
      if (!net.mask[l][i][j] && Math.abs(after[l][i][j]) > 1e-15) maskedUntouched = false;
    }
  }
  ok(maskedUntouched, '被掩码的权重在训练后仍为 0');
}

/* ---------- XOR 收敛 ---------- */
section('XOR 训练收敛');
{
  const ds = DS.makeXor();
  const preset = DS.DATASETS.xor.preset;
  const net = new NW.Network({ layers: preset.layers, hiddenAct: preset.hiddenAct, outAct: 'sigmoid', seed: preset.seed });
  const tr = new TR.Trainer(net, { lr: preset.lr, momentum: preset.momentum, batchSize: preset.batchSize, epochs: preset.epochs, seed: preset.seed, loss: preset.loss, classifier: true });
  const hist = tr.fit(ds);
  ok(hist[hist.length - 1].loss < 0.1, 'XOR 最终 loss < 0.1 (=' + hist[hist.length - 1].loss.toFixed(4) + ')');
  let allRight = true;
  for (const inp of [[0,0],[0,1],[1,0],[1,1]]) {
    const p = net.predict(inp)[0];
    const want = (inp[0] !== inp[1]) ? 1 : 0;
    if (Math.abs(p - want) > 0.2) allRight = false;
  }
  ok(allRight, 'XOR 全部样本预测正确');

  // 确定性：同种子两次训练历史一致
  const netA = new NW.Network({ layers: preset.layers, hiddenAct: preset.hiddenAct, outAct: 'sigmoid', seed: preset.seed });
  const trA = new TR.Trainer(netA, { lr: preset.lr, momentum: preset.momentum, batchSize: preset.batchSize, epochs: 50, seed: preset.seed, loss: preset.loss });
  const hA = trA.fit(ds);
  const netB = new NW.Network({ layers: preset.layers, hiddenAct: preset.hiddenAct, outAct: 'sigmoid', seed: preset.seed });
  const trB = new TR.Trainer(netB, { lr: preset.lr, momentum: preset.momentum, batchSize: preset.batchSize, epochs: 50, seed: preset.seed, loss: preset.loss });
  const hB = trB.fit(ds);
  let det = true;
  for (let i = 0; i < hA.length; i++) if (hA[i].loss !== hB[i].loss) det = false;
  ok(det, '训练确定性：同种子历史逐项一致');
}

/* ---------- 二维数据集 ---------- */
section('二维数据集');
{
  const m1 = DS.makeMoons(120, 1);
  const m2 = DS.makeMoons(120, 1);
  ok(m1.inputs.length === 120 && m1.targets.length === 120, 'moons 数量');
  let det = true;
  for (let i = 0; i < 120; i++) for (let j = 0; j < 2; j++) if (m1.inputs[i][j] !== m2.inputs[i][j]) det = false;
  ok(det, 'moons 确定性');
  let c0 = 0, c1 = 0;
  for (const t of m1.targets) t[0] === 0 ? c0++ : c1++;
  ok(c0 === 60 && c1 === 60, 'moons 类别均衡');
  const sp = DS.makeSpiral(140, 3);
  ok(sp.inputs.length === 140, 'spiral 数量');
  const s1 = DS.makeSpiral(140, 3), s2 = DS.makeSpiral(140, 3);
  det = true;
  for (let i = 0; i < 140; i++) for (let j = 0; j < 2; j++) if (s1.inputs[i][j] !== s2.inputs[i][j]) det = false;
  ok(det, 'spiral 确定性');
}

/* ---------- 手写数字 ---------- */
section('手写数字');
{
  const ds = DS.makeDigits(60, 1);
  eq(ds.inputs.length, 600, '600 个样本');
  eq(ds.inputs[0].length, 35, '输入 35 像素');
  eq(ds.targets[0].length, 10, '输出 10 类');
  const perClass = {};
  for (const t of ds.targets) { const d = L.argmax(t); perClass[d] = (perClass[d] || 0) + 1; }
  let all60 = true;
  for (let d = 0; d < 10; d++) if (perClass[d] !== 60) all60 = false;
  ok(all60, '每类 60 个样本');
  ok(DS.glyphArray(8).length === 35 && DS.glyphArray(8).filter(Boolean).length > 0, '字模有效');

  const preset = DS.DATASETS.digits.preset;
  const net = new NW.Network({ layers: preset.layers, hiddenAct: preset.hiddenAct, outAct: 'softmax', seed: preset.seed });
  const tr = new TR.Trainer(net, { lr: preset.lr, momentum: preset.momentum, batchSize: preset.batchSize, epochs: preset.epochs, seed: preset.seed, loss: preset.loss, classifier: true });
  const hist = tr.fit(ds);
  const trainAcc = hist[hist.length - 1].acc;
  ok(trainAcc > 0.9, '数字训练集准确率 > 0.9 (=' + (trainAcc * 100).toFixed(1) + '%)');
  const testDs = DS.makeDigits(20, 999);
  let okc = 0;
  for (let i = 0; i < testDs.inputs.length; i++) {
    if (L.argmax(net.predict(testDs.inputs[i])) === L.argmax(testDs.targets[i])) okc++;
  }
  const testAcc = okc / testDs.inputs.length;
  ok(testAcc > 0.85, '数字测试集准确率 > 0.85 (=' + (testAcc * 100).toFixed(1) + '%)');
}

/* ---------- 井字棋 ---------- */
section('井字棋');
{
  eq(TT.winner([1,1,1,0,0,0,0,0,0]), 1, 'X 三连胜');
  eq(TT.winner([-1,0,0,0,-1,0,0,0,-1]), -1, 'O 斜线胜');
  eq(TT.winner([1,0,0,0,0,0,0,0,0]), 0, '无胜负');
  eq(TT.legalMoves([1,0,0,0,0,0,0,0,0]).length, 8, '合法落子');
  // minimax：X 走中间可强制和棋/胜
  const b0 = [0,0,0,0,0,0,0,0,0];
  const mv = TT.bestMove(b0, 1);
  ok([0,2,4,6,8].includes(mv), '空盘最佳首手是角/中');
  // 一步杀：X 有两条连线缺口
  const bKill = [1,1,0, 0,-1,0, 0,0,-1];
  eq(TT.bestMove(bKill, 1), 2, 'X 双线杀选 (0,2)');
  const ds = TT.makeDataset(400, 7);
  eq(ds.inputs.length, 400, '井字棋数据集 400 条');
  let legalOk = true;
  for (const t of ds.targets) {
    const idx = L.argmax(t);
    if (ds.inputs[ds.targets.indexOf(t)][idx] !== 0) legalOk = false;
  }
  ok(legalOk, '教师落子全部合法');

  const preset = DS.DATASETS.tictactoe.preset;
  const net = new NW.Network({ layers: preset.layers, hiddenAct: preset.hiddenAct, outAct: 'softmax', seed: preset.seed });
  const tr = new TR.Trainer(net, { lr: preset.lr, momentum: preset.momentum, batchSize: preset.batchSize, epochs: preset.epochs, seed: preset.seed, loss: preset.loss, classifier: true });
  const hist = tr.fit(ds);
  ok(hist[hist.length - 1].acc > 0.85, '井字棋教师落子准确率 > 0.85 (=' + (hist[hist.length - 1].acc * 100).toFixed(1) + '%)');
  const res = TT.playVsRandom(net, 200, 5);
  ok(res.wins + res.draws >= 170, '对战随机玩家胜+和 >= 170/200 (w=' + res.wins + ' d=' + res.draws + ' l=' + res.losses + ')');
  ok(res.wins >= 120, '对战随机玩家胜局 >= 120/200 (w=' + res.wins + ')');
}

/* ---------- 编辑器 ---------- */
section('编辑器');
{
  const ed = new ED.SynapseEditor({ inputCount: 2, outputCount: 1, outAct: 'sigmoid' });
  eq(ed.layerCount(), 2, '初始 2 层');
  eq(ed.nodeCount(), 3, '初始 3 个神经元');
  ed.addHiddenLayer(1, 3, 'tanh');
  eq(ed.layerCount(), 3, '加一层后 3 层');
  eq(ed.hiddenLayerCount(), 1, '1 个隐藏层');
  eq(ed.layers[0][0].layer, 0, '输入层号 0');
  eq(ed.layers[2][0].layer, 2, '输出层号 2');
  const h = ed.layers[1][0];
  ed.addEdge(ed.layers[0][0].id, h.id);
  ed.addEdge(h.id, ed.layers[2][0].id);
  eq(ed.edgeCount(), 2, '两条连线');
  let threw = false;
  try { ed.addEdge(ed.layers[0][0].id, ed.layers[2][0].id); } catch (e) { threw = true; }
  ok(threw, '跨层连线被拒绝');
  threw = false;
  try { ed.addEdge(ed.layers[0][0].id, h.id); } catch (e) { threw = true; }
  ok(threw, '重复连线被拒绝');
  ed.autoWire();
  eq(ed.edgeCount(), 2 * 3 + 3 * 1, '自动连线全连接');
  ed.clearEdges();
  eq(ed.edgeCount(), 0, '清空连线');
  ed.autoWire();
  ed.removeNeuron(h.id);
  eq(ed.layers[1].length, 2, '删神经元');
  eq(ed.edgeCount(), 2 * 2 + 2 * 1, '删神经元后连线同步清理');
  threw = false;
  try { ed.removeNeuron(ed.layers[0][0].id); } catch (e) { threw = true; }
  ok(threw, '输入神经元不可删');
  // 序列化往返
  const ed2 = ED.SynapseEditor.fromJSON(ed.serialize());
  eq(ed2.layerCount(), ed.layerCount(), '编辑器往返层数一致');
  eq(ed2.edgeCount(), ed.edgeCount(), '编辑器往返连线一致');
  eq(ed2.nodeCount(), ed.nodeCount(), '编辑器往返节点一致');

  // toNetwork 掩码映射
  const ed3 = new ED.SynapseEditor({ inputCount: 2, outputCount: 1, outAct: 'sigmoid' });
  ed3.addHiddenLayer(1, 2, 'sigmoid');
  ed3.layers[1][0].bias = 0.7;
  ed3.layers[1][0].activation = 'relu';
  ed3.addEdge(ed3.layers[0][0].id, ed3.layers[1][0].id);
  ed3.addEdge(ed3.layers[1][0].id, ed3.layers[2][0].id);
  ed3.addEdge(ed3.layers[1][1].id, ed3.layers[2][0].id);
  const net = ed3.toNetwork(7);
  eq(net.layers.join(','), '2,2,1', '网络层结构');
  eq(net.acts[0][0], 'relu', '逐神经元激活映射');
  eq(net.acts[0][1], 'sigmoid', '逐神经元激活映射 2');
  near(net.b[0][0], 0.7, 1e-12, '偏置映射');
  ok(net.mask[0][0][0], '掩码：存在的连线为 true');
  ok(!net.mask[0][1][0], '掩码：缺失连线为 false');
  ok(!net.mask[0][1][1] && !net.mask[0][0][1], '掩码其余为 false');
  ok(net.mask[1][0][0] && net.mask[1][0][1], '第二层掩码');
  near(net.W[0][1][0], 0, 1e-15, '掩码权重为 0');
  eq(net.acts.length, 1, '一层隐藏激活');

  // 增删隐藏层时跨层连线的清理
  const ed4 = new ED.SynapseEditor({ inputCount: 1, outputCount: 1, outAct: 'sigmoid' });
  ed4.addHiddenLayer(1, 2, 'tanh');
  ed4.addHiddenLayer(2, 2, 'tanh');
  ed4.autoWire();
  eq(ed4.edgeCount(), 1 * 2 + 2 * 2 + 2 * 1, '三层全连接数');
  ed4.removeHiddenLayer(1);
  eq(ed4.layerCount(), 3, '删层后剩 3 层');
  eq(ed4.edgeCount(), 2, '删层后仅保留未跨层连线');
  ed4.removeHiddenLayer(1);
  eq(ed4.layerCount(), 2, '再删一层回到 2 层');
  eq(ed4.edgeCount(), 0, '跨层连线全部清理');
}

/* ---------- 编辑器 → 网络 → 训练闭环 ---------- */
section('编辑器训练闭环（XOR 自定义稀疏网络）');
{
  const ed = new ED.SynapseEditor({ inputCount: 2, outputCount: 1, outAct: 'sigmoid' });
  ed.addHiddenLayer(1, 4, 'sigmoid');
  ed.autoWire();
  const net = ed.toNetwork(7);
  const ds = DS.makeXor();
  const tr = new TR.Trainer(net, { lr: 0.6, momentum: 0.9, batchSize: 4, epochs: 300, seed: 7, loss: 'ce', classifier: true });
  tr.fit(ds);
  let okc = 0;
  for (const inp of [[0,0],[0,1],[1,0],[1,1]]) {
    const p = net.predict(inp)[0];
    const want = (inp[0] !== inp[1]) ? 1 : 0;
    if (Math.abs(p - want) <= 0.5) okc++;
  }
  ok(okc === 4, '编辑器构建的掩码网络 XOR 全部学对');
}


/* ---------- 二分类标签与准确率 ---------- */
section('二分类标签与准确率');
{
  eq(L.labelOf([0.2]), 0, 'labelOf 单输出 < 0.5 → 0');
  eq(L.labelOf([0.5]), 1, 'labelOf 单输出 = 0.5 → 1');
  eq(L.labelOf([0.8]), 1, 'labelOf 单输出 > 0.5 → 1');
  eq(L.labelOf([0.1, 0.8, 0.1]), 1, 'labelOf 多输出 argmax');
  eq(L.labelOf([0.9, 0.1]), 0, 'labelOf 多输出 argmax 2');
  near(L.accuracy([[0.1], [0.9]], [[0], [1]]), 1, 1e-12, 'accuracy 二分类');
  near(L.accuracy([[0.1], [0.9]], [[1], [0]]), 0, 1e-12, 'accuracy 二分类全错');
  eq(L.accuracy([], []), 0, 'accuracy 空输入');

  // 回归：单输出二分类的准确率不能再恒为 1（旧实现 argmax([0]) === argmax([1])）
  const preset = DS.DATASETS.xor.preset;
  const net = new NW.Network({ layers: preset.layers, hiddenAct: preset.hiddenAct, outAct: 'sigmoid', seed: 12345 });
  const tr = new TR.Trainer(net, { lr: preset.lr, momentum: preset.momentum, batchSize: preset.batchSize, epochs: 1, seed: 7, loss: preset.loss, classifier: true });
  const h = tr.fit(DS.makeXor());
  ok(h[0].acc < 1, '未训练网络首回合 acc < 1 (=' + h[0].acc + ')');
  const net2 = new NW.Network({ layers: preset.layers, hiddenAct: preset.hiddenAct, outAct: 'sigmoid', seed: preset.seed });
  const tr2 = new TR.Trainer(net2, { lr: preset.lr, momentum: preset.momentum, batchSize: preset.batchSize, epochs: preset.epochs, seed: preset.seed, loss: preset.loss, classifier: true });
  const h2 = tr2.fit(DS.makeXor());
  near(h2[h2.length - 1].acc, 1, 1e-12, 'XOR 训练后 acc = 1');
}

/* ---------- 梯度校验补充：mse+softmax / 多标签 / 累加器 ---------- */
section('梯度校验补充（mse+softmax / 多标签 / 累加器）');
{
  let net = new NW.Network({ layers: [2, 3, 2], hiddenAct: 'tanh', outAct: 'softmax', seed: 8 });
  let r = gradCheck(net, [0.1, 0.9], [0, 1], 'mse');
  ok(r.allOk, 'softmax + mse 梯度 (worst=' + r.worst.toExponential(2) + ')');
  net = new NW.Network({ layers: [2, 4, 3], hiddenAct: 'relu', outAct: 'softmax', seed: 12 });
  r = gradCheck(net, [0.5, -0.2], [1, 0, 0], 'mse');
  ok(r.allOk, 'softmax + mse 三分类梯度 (worst=' + r.worst.toExponential(2) + ')');
  net = new NW.Network({ layers: [2, 3, 3], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 13 });
  r = gradCheck(net, [0.2, 0.7], [1, 0, 1], 'ce');
  ok(r.allOk, 'sigmoid 多标签 ce 梯度 (worst=' + r.worst.toExponential(2) + ')');
  net = new NW.Network({ layers: [3, 5, 4, 2], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 15 });
  r = gradCheck(net, [0.2, -0.4, 0.9], [0.3, 0.8], 'mse');
  ok(r.allOk, '深网络 mse 梯度 (worst=' + r.worst.toExponential(2) + ')');

  // backward 自带 pred，训练循环不必再 predict 一次
  net = new NW.Network({ layers: [2, 3, 2], hiddenAct: 'tanh', outAct: 'softmax', seed: 8 });
  const g = net.backward([0.1, 0.9], [0, 1], 'ce');
  arrClose(g.pred, net.predict([0.1, 0.9]), 1e-15, 'backward().pred == predict()');

  // 预分配累加器与逐样本梯度求和等价
  const g1 = net.backward([0.1, 0.9], [0, 1], 'ce');
  const g2 = net.backward([0.4, 0.2], [1, 0], 'ce');
  const acc = net.initGrads();
  net.zeroGrads(acc);
  net.backward([0.1, 0.9], [0, 1], 'ce', acc);
  net.backward([0.4, 0.2], [1, 0], 'ce', acc);
  let maxDiff = 0;
  for (let l = 0; l < g1.dW.length; l++) {
    for (let i = 0; i < g1.dW[l].length; i++) for (let j = 0; j < g1.dW[l][i].length; j++) {
      maxDiff = Math.max(maxDiff, Math.abs(acc.dW[l][i][j] - (g1.dW[l][i][j] + g2.dW[l][i][j])));
    }
    for (let i = 0; i < g1.db[l].length; i++) maxDiff = Math.max(maxDiff, Math.abs(acc.db[l][i] - (g1.db[l][i] + g2.db[l][i])));
  }
  ok(maxDiff < 1e-15, '梯度累加器 == 逐样本之和 (diff=' + maxDiff + ')');
  net.zeroGrads(acc);
  ok(acc.dW[0][0][0] === 0 && acc.db[0][0] === 0, 'zeroGrads 清零');

  // 交叉熵 + 非 sigmoid/softmax 输出：明确报错，而不是静默算错梯度
  let threw = false;
  try { new NW.Network({ layers: [2, 2, 1], hiddenAct: 'tanh', outAct: 'tanh', seed: 3 }).backward([0.1, 0.2], [1], 'ce'); }
  catch (e) { threw = true; }
  ok(threw, 'ce + tanh 输出抛错');
}

/* ---------- 数值稳定性与鲁棒性 ---------- */
section('数值稳定性与鲁棒性');
{
  // 极端学习率：梯度爆炸时拒绝更新并停止，权重保持有限（不再写入 NaN）
  const net = new NW.Network({ layers: [2, 4, 1], hiddenAct: 'tanh', outAct: 'identity', seed: 7 });
  const tr = new TR.Trainer(net, { lr: 1e300, momentum: 0.9, batchSize: 4, epochs: 50, seed: 7, loss: 'mse', classifier: true });
  const hist = tr.fit(DS.makeXor());
  ok(tr.state.diverged, '极端学习率 → 标记 diverged');
  ok(tr.state.done, '发散后停止训练');
  let allFinite = true;
  for (let l = 0; l < net.W.length; l++) for (let i = 0; i < net.W[l].length; i++) for (let j = 0; j < net.W[l][i].length; j++) if (!Number.isFinite(net.W[l][i][j])) allFinite = false;
  for (let l = 0; l < net.b.length; l++) for (let i = 0; i < net.b[l].length; i++) if (!Number.isFinite(net.b[l][i])) allFinite = false;
  ok(allFinite, '发散时权重保持有限（未写入 NaN/Inf）');
  ok(hist.length === 0 || Number.isFinite(hist[hist.length - 1].loss), '历史记录里没有 NaN');
  // 正常学习率不会误判发散
  const net2 = new NW.Network({ layers: [2, 4, 1], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 7 });
  const tr2 = new TR.Trainer(net2, { lr: 0.5, momentum: 0.9, batchSize: 4, epochs: 50, seed: 7, loss: 'ce' });
  tr2.fit(DS.makeXor());
  ok(!tr2.state.diverged, '正常学习率不触发发散保护');

  // 空数据集 / 维度不符 / 数量不符
  const t = new TR.Trainer(new NW.Network({ layers: [2, 1], outAct: 'sigmoid', seed: 1 }));
  let threw = false;
  try { t.fit({ inputs: [], targets: [] }); } catch (e) { threw = true; }
  ok(threw, '空数据集抛错');
  threw = false;
  try { new TR.Trainer(new NW.Network({ layers: [3, 1], outAct: 'sigmoid', seed: 1 })).fit(DS.makeXor()); } catch (e) { threw = true; }
  ok(threw, '数据集输入维度与网络不符抛错');
  threw = false;
  try { t.fit({ inputs: [[0, 0]], targets: [] }); } catch (e) { threw = true; }
  ok(threw, '输入/目标数量不符抛错');

  // prepare 重置动量与梯度缓冲
  const net3 = new NW.Network({ layers: [2, 3, 1], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 1 });
  const tr3 = new TR.Trainer(net3, { lr: 0.5, momentum: 0.9, batchSize: 2, epochs: 3, seed: 1, loss: 'mse' });
  tr3.fit(DS.makeXor());
  tr3.prepare(DS.makeXor());
  ok(tr3.vel.vW.every(function (m) { return m.every(function (r) { return r.every(function (x) { return x === 0; }); }); }), 'prepare 重置动量');
  ok(tr3.state.history.length === 0 && tr3.state.epoch === 0, 'prepare 重置训练状态');

  // 回合数调大后可继续训练（不必重建网络）
  const net4 = new NW.Network({ layers: [2, 3, 1], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 1 });
  const tr4 = new TR.Trainer(net4, { lr: 0.5, momentum: 0.9, batchSize: 2, epochs: 2, seed: 1, loss: 'mse' });
  tr4.fit(DS.makeXor());
  ok(tr4.state.done, '2 回合后 done');
  tr4.updateOpts({ epochs: 5 });
  ok(!tr4.state.done, '调大回合数后 done 清除');
  ok(!!tr4.runEpoch(), '可继续训练');
}

/* ---------- 序列化校验 ---------- */
section('序列化校验');
{
  const net = new NW.Network({ layers: [2, 3, 1], hiddenAct: 'tanh', outAct: 'sigmoid', seed: 4 });
  const clone = NW.Network.fromJSON(net.serialize());
  arrClose(clone.predict([0.3, 0.6]), net.predict([0.3, 0.6]), 1e-15, 'fromJSON 往返预测一致');
  const c2 = net.clone();
  c2.W[0][0][0] += 10;
  ok(c2.W[0][0][0] !== net.W[0][0][0], 'clone 与原网络不共享权重数组');
  const bad = [
    ['层数不足', { kind: 'SynapseNetwork', layers: [2], outAct: 'sigmoid', acts: [], W: [], b: [] }],
    ['权重行数不符', { kind: 'SynapseNetwork', layers: [2, 3, 1], outAct: 'sigmoid', acts: [['tanh', 'tanh', 'tanh']], W: [[[1, 2]], [[1, 2, 3]]], b: [[0, 0, 0], [0]] }],
    ['权重列数不符', { kind: 'SynapseNetwork', layers: [2, 3, 1], outAct: 'sigmoid', acts: [['tanh', 'tanh', 'tanh']], W: [[[1, 2, 3], [1, 2], [1, 2]], [[1, 2, 3]]], b: [[0, 0, 0], [0]] }],
    ['缺激活列表', { kind: 'SynapseNetwork', layers: [2, 3, 1], outAct: 'sigmoid', W: [[[1, 2], [1, 2], [1, 2]], [[1, 2, 3]]], b: [[0, 0, 0], [0]] }],
    ['权重含 NaN', { kind: 'SynapseNetwork', layers: [2, 1], outAct: 'sigmoid', acts: [], W: [[[NaN, 1]]], b: [[0]] }],
    ['未知输出激活', { kind: 'SynapseNetwork', layers: [2, 1], outAct: 'foo', acts: [], W: [[[1, 1]]], b: [[0]] }],
    ['掩码形状不符', { kind: 'SynapseNetwork', layers: [2, 1], outAct: 'sigmoid', acts: [], W: [[[1, 1]]], b: [[0]], mask: [[[true]]] }]
  ];
  for (const pair of bad) {
    let threw = false;
    try { NW.Network.fromJSON(pair[1]); } catch (e) { threw = true; }
    ok(threw, 'fromJSON 拒绝：' + pair[0]);
  }
}

/* ---------- 井字棋补充 ---------- */
section('井字棋补充');
{
  const net = new NW.Network({ layers: [9, 9], outAct: 'softmax', seed: 1 });
  eq(TT.predictMove(net, [1, -1, 1, -1, 1, -1, 1, -1, 1]), -1, 'predictMove 满盘返回 -1');
  eq(TT.bestMove([1, -1, 1, -1, 1, -1, 1, -1, 1], 1), -1, 'bestMove 满盘返回 -1');
  let threw = false;
  try { TT.predictMove(new NW.Network({ layers: [9, 1], outAct: 'sigmoid', seed: 1 }), new Array(9).fill(0)); } catch (e) { threw = true; }
  ok(threw, 'predictMove 输出维度不符抛错');

  // 置换表：命中不改变结果，且不破坏 minimax 的正确性
  TT.clearCache();
  const b = [1, 0, 0, 0, -1, 0, 0, 0, 0];
  const first = TT.minimaxScore(b.slice(), 1);
  const second = TT.minimaxScore(b.slice(), 1);
  eq(first, second, 'minimax 缓存命中结果一致');
  ok(TT.cacheSize() > 0, '置换表已填充');
  const empty = new Array(9).fill(0);
  let allDraw = true;
  for (const m of TT.legalMoves(empty)) {
    empty[m] = 1;
    if (TT.minimaxScore(empty.slice(), -1) !== 0) allDraw = false;
    empty[m] = 0;
  }
  ok(allDraw, '空盘首手后 O 视角值均为 0（X 无法强胜）');
  eq(TT.bestMove([1, 1, 0, 0, -1, 0, 0, 0, -1], 1), 2, '双线杀仍然选 (0,2)');
}

/* ---------- 挑战达标线（真实二分类准确率） ---------- */
section('挑战达标线');
{
  const GOALS = { xor: 0.95, moons: 0.9, spiral: 0.8 };
  for (const id of ['xor', 'moons', 'spiral']) {
    const d = DS.DATASETS[id], p = d.preset, ds = d.make(p.seed);
    const net = new NW.Network({ layers: p.layers, hiddenAct: p.hiddenAct, outAct: d.outAct, seed: p.seed });
    const tr = new TR.Trainer(net, { lr: p.lr, momentum: p.momentum, batchSize: p.batchSize, epochs: p.epochs, seed: p.seed, loss: p.loss, classifier: true });
    const hist = tr.fit(ds);
    const acc = hist[hist.length - 1].acc;
    ok(acc >= GOALS[id], id + ' 预设训练后准确率 ≥ 达标线 ' + GOALS[id] + ' (=' + (acc * 100).toFixed(1) + '%)');
  }
}

/* ---------- 总结 ---------- */
console.log('\n========================================');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
console.log('========================================');
if (failed > 0) process.exit(1);
