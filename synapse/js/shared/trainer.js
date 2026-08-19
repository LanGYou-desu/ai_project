'use strict';
/* SYNAPSE · 小批量梯度下降训练器（确定性） */
(function (root) {
  'use strict';
  const R = (typeof require !== 'undefined') ? require('./rng.js') : root.Synapse.rng;
  const L = (typeof require !== 'undefined') ? require('./losses.js') : root.Synapse.losses;
  const { createRng, shuffle } = R;
  const { lossValue, argmax } = L;

  const DEFAULTS = { lr: 0.1, momentum: 0.9, batchSize: 8, epochs: 200, seed: 1, loss: 'mse', classifier: true };

  class Trainer {
    constructor(net, opts) {
      this.net = net;
      this.opts = Object.assign({}, DEFAULTS, opts || {});
      if (!(this.opts.epochs >= 1)) this.opts.epochs = 1;
      this.rng = createRng(this.opts.seed);
      this.vel = net.initVelocities();
      this.dataset = null;
      this.indices = [];
      this.state = { epoch: 0, loss: 0, acc: null, done: false, history: [] };
    }
    prepare(dataset) {
      if (!dataset || !Array.isArray(dataset.inputs) || !Array.isArray(dataset.targets)) throw new Error('数据集格式错误');
      if (dataset.inputs.length !== dataset.targets.length) throw new Error('输入与目标数量不符');
      this.dataset = dataset;
      this.indices = dataset.inputs.map(function (_, i) { return i; });
      this.state = { epoch: 0, loss: 0, acc: null, done: false, history: [] };
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
        let dWacc = null, dbacc = null;
        for (let k = start; k < end; k++) {
          const idx = this.indices[k];
          const g = this.net.backward(ds.inputs[idx], ds.targets[idx], o.loss);
          if (!dWacc) {
            dWacc = g.dW; dbacc = g.db;
          } else {
            for (let l = 0; l < g.dW.length; l++) {
              const a1 = dWacc[l], a2 = g.dW[l];
              for (let i = 0; i < a1.length; i++) {
                const r1 = a1[i], r2 = a2[i];
                for (let j = 0; j < r1.length; j++) r1[j] += r2[j];
              }
              const b1 = dbacc[l], b2 = g.db[l];
              for (let i = 0; i < b1.length; i++) b1[i] += b2[i];
            }
          }
          const pred = this.net.predict(ds.inputs[idx]);
          lossSum += lossValue(o.loss, pred, ds.targets[idx]);
          if (o.classifier) accSum += (argmax(pred) === argmax(ds.targets[idx]) ? 1 : 0);
        }
        for (let l = 0; l < dWacc.length; l++) {
          const a1 = dWacc[l];
          for (let i = 0; i < a1.length; i++) for (let j = 0; j < a1[i].length; j++) a1[i][j] /= n;
          const b1 = dbacc[l];
          for (let i = 0; i < b1.length; i++) b1[i] /= n;
        }
        this.net.applyGrad(dWacc, dbacc, o.lr, o.momentum, this.vel.vW, this.vel.vB);
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
    updateOpts(patch) { Object.assign(this.opts, patch || {}); }
  }
  const api = { Trainer: Trainer, DEFAULTS: DEFAULTS };
  root.Synapse = root.Synapse || {};
  root.Synapse.trainer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
