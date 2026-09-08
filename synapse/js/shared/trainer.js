'use strict';
/* SYNAPSE · 小批量梯度下降训练器（确定性 + 发散保护） */
(function (root) {
  'use strict';
  const R = (typeof require !== 'undefined') ? require('./rng.js') : root.Synapse.rng;
  const L = (typeof require !== 'undefined') ? require('./losses.js') : root.Synapse.losses;
  const { createRng, shuffle } = R;
  const { lossValue, labelOf } = L;

  const DEFAULTS = { lr: 0.1, momentum: 0.9, batchSize: 8, epochs: 200, seed: 1, loss: 'mse', classifier: true };

  function gradsFinite(g) {
    for (let l = 0; l < g.dW.length; l++) {
      const m = g.dW[l];
      for (let i = 0; i < m.length; i++) {
        const row = m[i];
        for (let j = 0; j < row.length; j++) if (!Number.isFinite(row[j])) return false;
      }
      const b = g.db[l];
      for (let i = 0; i < b.length; i++) if (!Number.isFinite(b[i])) return false;
    }
    return true;
  }

  class Trainer {
    constructor(net, opts) {
      this.net = net;
      this.opts = Object.assign({}, DEFAULTS, opts || {});
      if (!(this.opts.epochs >= 1)) this.opts.epochs = 1;
      this.rng = createRng(this.opts.seed);
      this.vel = net.initVelocities();
      this.grads = net.initGrads();
      this.dataset = null;
      this.indices = [];
      this.state = this._freshState();
    }
    _freshState() {
      return { epoch: 0, loss: 0, acc: null, done: false, diverged: false, history: [] };
    }
    prepare(dataset) {
      if (!dataset || !Array.isArray(dataset.inputs) || !Array.isArray(dataset.targets)) throw new Error('数据集格式错误');
      if (dataset.inputs.length !== dataset.targets.length) throw new Error('输入与目标数量不符');
      if (dataset.inputs.length === 0) throw new Error('数据集为空');
      if (dataset.inputs[0].length !== this.net.layers[0]) throw new Error('数据集输入维度与网络不符');
      this.dataset = dataset;
      this.indices = dataset.inputs.map(function (_, i) { return i; });
      this.vel = this.net.initVelocities();
      this.grads = this.net.initGrads();
      this.state = this._freshState();
    }
    runEpoch() {
      if (this.state.done) return null;
      if (!this.dataset) throw new Error('尚未 prepare 数据集');
      const ds = this.dataset;
      const o = this.opts;
      const N = ds.inputs.length;
      if (this.state.epoch >= o.epochs) { this.state.done = true; return null; }
      shuffle(this.indices, this.rng);
      let lossSum = 0, accSum = 0;
      for (let start = 0; start < N; start += o.batchSize) {
        const end = Math.min(start + o.batchSize, N);
        const n = end - start;
        const grads = this.grads;
        this.net.zeroGrads(grads);
        for (let k = start; k < end; k++) {
          const idx = this.indices[k];
          // backward 返回的 pred 复用了同一次前向，省掉一次 predict
          const g = this.net.backward(ds.inputs[idx], ds.targets[idx], o.loss, grads);
          const pred = g.pred;
          lossSum += lossValue(o.loss, pred, ds.targets[idx]);
          if (o.classifier) accSum += (labelOf(pred) === labelOf(ds.targets[idx]) ? 1 : 0);
        }
        // 学习率过大 / 权重爆炸：梯度出现 NaN 或 Inf 时拒绝更新并停止，权重停留在上一个有限值
        if (!Number.isFinite(lossSum) || !gradsFinite(grads)) {
          this.state.diverged = true;
          this.state.done = true;
          return { epoch: this.state.epoch, loss: this.state.loss, acc: this.state.acc, diverged: true };
        }
        for (let l = 0; l < grads.dW.length; l++) {
          const a1 = grads.dW[l];
          for (let i = 0; i < a1.length; i++) { const row = a1[i]; for (let j = 0; j < row.length; j++) row[j] /= n; }
          const b1 = grads.db[l];
          for (let i = 0; i < b1.length; i++) b1[i] /= n;
        }
        this.net.applyGrad(grads.dW, grads.db, o.lr, o.momentum, this.vel.vW, this.vel.vB);
      }
      this.state.epoch++;
      const entry = {
        epoch: this.state.epoch,
        loss: lossSum / N,
        acc: o.classifier ? accSum / N : null
      };
      this.state.history.push(entry);
      this.state.loss = entry.loss;
      this.state.acc = entry.acc;
      if (this.state.epoch >= o.epochs) this.state.done = true;
      return entry;
    }
    fit(dataset, onEpoch) {
      this.prepare(dataset);
      let e;
      while ((e = this.runEpoch())) { if (onEpoch) onEpoch(e); }
      return this.state.history;
    }
    updateOpts(patch) {
      Object.assign(this.opts, patch || {});
      if (!(this.opts.epochs >= 1)) this.opts.epochs = 1;
      // 回合数调大后可以继续训练，不必重建网络
      if (this.opts.epochs > this.state.epoch) {
        this.state.done = false;
        this.state.diverged = false;
      }
    }
  }
  const api = { Trainer: Trainer, DEFAULTS: DEFAULTS };
  root.Synapse = root.Synapse || {};
  root.Synapse.trainer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
