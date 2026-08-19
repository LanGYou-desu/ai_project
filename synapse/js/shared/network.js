'use strict';
/* SYNAPSE · 神经网络核心：前向 / 反向传播 / 权重掩码 / 序列化 */
(function (root) {
  'use strict';
  const R = (typeof require !== 'undefined') ? require('./rng.js') : root.Synapse.rng;
  const A = (typeof require !== 'undefined') ? require('./activations.js') : root.Synapse.activations;
  const { createRng, randn } = R;
  const { ACTIVATIONS } = A;

  class Network {
    constructor(opts) {
      opts = opts || {};
      const layers = opts.layers;
      if (!Array.isArray(layers) || layers.length < 2) throw new Error('Network 至少需要 2 层');
      for (const n of layers) if (!Number.isInteger(n) || n < 1) throw new Error('层大小必须为正整数');
      this.layers = layers.slice();
      this.outAct = opts.outAct || 'sigmoid';
      if (this.outAct !== 'softmax' && !ACTIVATIONS[this.outAct]) throw new Error('未知输出激活: ' + this.outAct);
      this.seed = opts.seed == null ? 1 : opts.seed;
      const rng = opts.rng || createRng(this.seed);
      // 每个隐藏神经元的激活（支持逐神经元混合）
      this.acts = [];
      for (let l = 0; l < layers.length - 2; l++) {
        let spec = null;
        if (Array.isArray(opts.hiddenActs)) spec = opts.hiddenActs[l];
        if (spec == null) spec = opts.hiddenAct || 'tanh';
        const names = Array.isArray(spec) ? spec.slice() : new Array(layers[l + 1]).fill(spec);
        if (names.length !== layers[l + 1]) throw new Error('hiddenActs 长度与层大小不符');
        for (const nm of names) if (!ACTIVATIONS[nm]) throw new Error('未知激活: ' + nm);
        this.acts.push(names);
      }
      this.W = []; this.b = []; this.mask = [];
      for (let l = 0; l < layers.length - 1; l++) {
        const rows = layers[l + 1], cols = layers[l];
        const scale = Math.sqrt(2 / cols);
        const W = [];
        for (let i = 0; i < rows; i++) {
          const row = [];
          for (let j = 0; j < cols; j++) row.push(randn(rng) * scale);
          W.push(row);
        }
        this.W.push(W);
        this.b.push(new Array(rows).fill(0));
        this.mask.push(null);
      }
    }
    forward(input) {
      if (input.length !== this.layers[0]) throw new Error('输入维度不符');
      const z = [null];
      const a = [input.slice()];
      let prev = a[0];
      const L = this.W.length;
      for (let l = 0; l < L; l++) {
        const Wl = this.W[l], bl = this.b[l];
        const out = new Array(Wl.length);
        for (let i = 0; i < Wl.length; i++) {
          let s = bl[i];
          const row = Wl[i];
          for (let j = 0; j < row.length; j++) s += row[j] * prev[j];
          out[i] = s;
        }
        z.push(out);
        const isOut = l === L - 1;
        if (isOut && this.outAct === 'softmax') {
          let m = -Infinity;
          for (const v of out) if (v > m) m = v;
          let sum = 0;
          const e = new Array(out.length);
          for (let i = 0; i < out.length; i++) { const x = Math.exp(out[i] - m); e[i] = x; sum += x; }
          a.push(e.map(function (x) { return x / sum; }));
        } else {
          const isOut = l === L - 1;
          const names = isOut ? null : this.acts[l];
          const layer = new Array(out.length);
          for (let i = 0; i < out.length; i++) {
            layer[i] = isOut ? ACTIVATIONS[this.outAct].f(out[i]) : ACTIVATIONS[names[i]].f(out[i]);
          }
          a.push(layer);
        }
        prev = a[a.length - 1];
      }
      return { z: z, a: a };
    }
    predict(input) {
      const f = this.forward(input);
      return f.a[f.a.length - 1];
    }
    backward(input, target, loss) {
      const f = this.forward(input);
      const L = this.W.length;
      const dW = [];
      const db = [];
      const deltas = new Array(L);
      const aOut = f.a[L];
      const self = this;
      if (loss === 'ce') {
        deltas[L - 1] = aOut.map(function (v, i) { return v - target[i]; });
      } else if (loss === 'mse') {
        const scale = 2 / target.length;
        deltas[L - 1] = aOut.map(function (v, i) {
          const g = (v - target[i]) * scale;
          const df = self.outAct === 'softmax' ? 1 : ACTIVATIONS[self.outAct].df(v);
          return g * df;
        });
      } else {
        throw new Error('未知损失: ' + loss);
      }
      for (let l = L - 1; l >= 0; l--) {
        const aPrev = f.a[l];
        const Wl = this.W[l];
        const d = deltas[l];
        const dw = Wl.map(function (row, i) {
          return row.map(function (w, j) { return d[i] * aPrev[j]; });
        });
        dW.unshift(dw);
        db.unshift(d.slice());
        if (l > 0) {
          const prevD = new Array(f.a[l].length).fill(0);
          for (let i = 0; i < Wl.length; i++) {
            const d_i = d[i];
            const row = Wl[i];
            for (let j = 0; j < row.length; j++) prevD[j] += d_i * row[j];
          }
          const names = this.acts[l - 1];
          deltas[l - 1] = prevD.map(function (v, j) { return v * ACTIVATIONS[names[j]].df(f.a[l][j]); });
        }
      }
      return { dW: dW, db: db };
    }
    applyGrad(dW, db, lr, momentum, vW, vB) {
      for (let l = 0; l < this.W.length; l++) {
        const Wl = this.W[l];
        const mask = this.mask ? this.mask[l] : null;
        const dWl = dW[l], dbl = db[l];
        const vWl = vW[l], vBl = vB[l];
        for (let i = 0; i < Wl.length; i++) {
          const rowMask = mask ? mask[i] : null;
          let anyIn = false;
          for (let j = 0; j < Wl[i].length; j++) {
            if (rowMask && !rowMask[j]) continue;
            anyIn = true;
            vWl[i][j] = momentum * vWl[i][j] + dWl[i][j];
            Wl[i][j] -= lr * vWl[i][j];
          }
          if (rowMask && !anyIn) continue;
          vBl[i] = momentum * vBl[i] + dbl[i];
          this.b[l][i] -= lr * vBl[i];
        }
      }
    }
    initVelocities() {
      return {
        vW: this.W.map(function (m) { return m.map(function (r) { return r.map(function () { return 0; }); }); }),
        vB: this.b.map(function (r) { return r.map(function () { return 0; }); })
      };
    }
    serialize() {
      return {
        kind: 'SynapseNetwork', version: 1,
        layers: this.layers.slice(),
        outAct: this.outAct,
        seed: this.seed,
        acts: this.acts.map(function (a) { return a.slice(); }),
        W: this.W.map(function (m) { return m.map(function (r) { return r.slice(); }); }),
        b: this.b.map(function (r) { return r.slice(); }),
        mask: this.mask ? this.mask.map(function (m) { return m ? m.map(function (r) { return r.slice(); }) : null; }) : null
      };
    }
    clone() { return Network.fromJSON(this.serialize()); }
    static fromJSON(obj) {
      if (!obj || obj.kind !== 'SynapseNetwork') throw new Error('不是合法的网络 JSON');
      const n = Object.create(Network.prototype);
      n.layers = obj.layers.slice();
      n.outAct = obj.outAct;
      n.seed = obj.seed;
      n.acts = obj.acts.map(function (a) { return a.slice(); });
      n.W = obj.W.map(function (m) { return m.map(function (r) { return r.slice(); }); });
      n.b = obj.b.map(function (r) { return r.slice(); });
      n.mask = obj.mask ? obj.mask.map(function (m) { return m ? m.map(function (r) { return r.slice(); }) : null; }) : null;
      return n;
    }
  }
  const api = { Network: Network };
  root.Synapse = root.Synapse || {};
  root.Synapse.network = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
