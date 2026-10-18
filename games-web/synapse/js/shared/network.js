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
          const sm = new Array(out.length);
          for (let i = 0; i < out.length; i++) sm[i] = e[i] / sum;
          a.push(sm);
        } else {
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
    /* 预分配梯度缓冲：训练循环里逐批复用，避免每个样本都分配临时数组 */
    initGrads() {
      return {
        dW: this.W.map(function (m) { return m.map(function (r) { return new Array(r.length).fill(0); }); }),
        db: this.b.map(function (r) { return new Array(r.length).fill(0); })
      };
    }
    zeroGrads(g) {
      for (let l = 0; l < g.dW.length; l++) {
        const m = g.dW[l];
        for (let i = 0; i < m.length; i++) m[i].fill(0);
        g.db[l].fill(0);
      }
    }
    /* 反向传播 → { dW, db, pred }（pred 复用同一次前向，调用方不必再 predict 一遍）
       传入 acc（initGrads 的产物）时梯度就地累加进 acc，不再分配新数组 */
    backward(input, target, loss, acc) {
      const f = this.forward(input);
      const L = this.W.length;
      const aOut = f.a[L];
      const n = aOut.length;
      const deltas = new Array(L);
      const dOut = new Array(n);
      if (loss === 'ce') {
        if (this.outAct === 'softmax') {
          // softmax + 交叉熵：dL/dz = a - t
          for (let i = 0; i < n; i++) dOut[i] = aOut[i] - target[i];
        } else if (this.outAct === 'sigmoid') {
          if (n === 1) {
            // 二分类交叉熵：dL/dz = a - t
            dOut[0] = aOut[0] - target[0];
          } else {
            // 多标签：L = -Σ t_i·ln a_i，dL/dz_i = -t_i·(1 - a_i)
            for (let i = 0; i < n; i++) dOut[i] = -target[i] * (1 - aOut[i]);
          }
        } else {
          throw new Error('交叉熵损失需要 sigmoid 或 softmax 输出激活，当前为 ' + this.outAct);
        }
      } else if (loss === 'mse') {
        const scale = 2 / n;
        if (this.outAct === 'softmax') {
          // softmax 的雅可比不是恒等矩阵：dL/dz_j = a_j·(g_j - Σ_i g_i·a_i)
          let dot = 0;
          for (let i = 0; i < n; i++) dot += (aOut[i] - target[i]) * aOut[i];
          for (let i = 0; i < n; i++) dOut[i] = scale * aOut[i] * ((aOut[i] - target[i]) - dot);
        } else {
          const df = ACTIVATIONS[this.outAct].df;
          for (let i = 0; i < n; i++) dOut[i] = (aOut[i] - target[i]) * scale * df(aOut[i]);
        }
      } else {
        throw new Error('未知损失: ' + loss);
      }
      deltas[L - 1] = dOut;

      const dW = acc ? acc.dW : new Array(L);
      const db = acc ? acc.db : new Array(L);
      for (let l = L - 1; l >= 0; l--) {
        const aPrev = f.a[l];
        const Wl = this.W[l];
        const d = deltas[l];
        if (acc) {
          const dWl = dW[l], dbl = db[l];
          for (let i = 0; i < Wl.length; i++) {
            const di = d[i], row = Wl[i], g = dWl[i];
            for (let j = 0; j < row.length; j++) g[j] += di * aPrev[j];
            dbl[i] += di;
          }
        } else {
          const dw = new Array(Wl.length);
          for (let i = 0; i < Wl.length; i++) {
            const di = d[i], row = Wl[i], g = new Array(row.length);
            for (let j = 0; j < row.length; j++) g[j] = di * aPrev[j];
            dw[i] = g;
          }
          dW[l] = dw;
          db[l] = d.slice();
        }
        if (l > 0) {
          const prevD = new Array(aPrev.length).fill(0);
          for (let i = 0; i < Wl.length; i++) {
            const di = d[i];
            const row = Wl[i];
            for (let j = 0; j < row.length; j++) prevD[j] += di * row[j];
          }
          const names = this.acts[l - 1];
          const aL = f.a[l];
          const next = new Array(prevD.length);
          for (let j = 0; j < prevD.length; j++) next[j] = prevD[j] * ACTIVATIONS[names[j]].df(aL[j]);
          deltas[l - 1] = next;
        }
      }
      return { dW: dW, db: db, pred: aOut };
    }
    applyGrad(dW, db, lr, momentum, vW, vB) {
      for (let l = 0; l < this.W.length; l++) {
        const Wl = this.W[l];
        const mask = (this.mask && this.mask[l]) ? this.mask[l] : null;
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
      const layers = obj.layers;
      if (!Array.isArray(layers) || layers.length < 2) throw new Error('网络 JSON 的 layers 非法（至少 2 层）');
      for (const size of layers) if (!Number.isInteger(size) || size < 1) throw new Error('网络 JSON 层大小必须为正整数');
      const outAct = obj.outAct || 'sigmoid';
      if (outAct !== 'softmax' && !ACTIVATIONS[outAct]) throw new Error('未知输出激活: ' + outAct);
      const L = layers.length - 1;
      if (!Array.isArray(obj.W) || obj.W.length !== L) throw new Error('网络 JSON 的权重层数不符');
      if (!Array.isArray(obj.b) || obj.b.length !== L) throw new Error('网络 JSON 的偏置层数不符');
      for (let l = 0; l < L; l++) {
        const Wl = obj.W[l], bl = obj.b[l];
        if (!Array.isArray(Wl) || Wl.length !== layers[l + 1]) throw new Error('网络 JSON 第 ' + l + ' 层权重行数不符');
        if (!Array.isArray(bl) || bl.length !== layers[l + 1]) throw new Error('网络 JSON 第 ' + l + ' 层偏置长度不符');
        for (let i = 0; i < Wl.length; i++) {
          const row = Wl[i];
          if (!Array.isArray(row) || row.length !== layers[l]) throw new Error('网络 JSON 第 ' + l + ' 层权重列数不符');
          for (let j = 0; j < row.length; j++) if (!Number.isFinite(row[j])) throw new Error('网络 JSON 权重含非有限值');
          if (!Number.isFinite(bl[i])) throw new Error('网络 JSON 偏置含非有限值');
        }
      }
      const acts = [];
      for (let l = 0; l < layers.length - 2; l++) {
        const spec = obj.acts ? obj.acts[l] : null;
        if (!Array.isArray(spec) || spec.length !== layers[l + 1]) throw new Error('网络 JSON 第 ' + l + ' 层激活列表不符');
        for (const nm of spec) if (!ACTIVATIONS[nm]) throw new Error('未知激活: ' + nm);
        acts.push(spec.slice());
      }
      let mask = null;
      if (obj.mask) {
        if (!Array.isArray(obj.mask) || obj.mask.length !== L) throw new Error('网络 JSON 的掩码层数不符');
        mask = obj.mask.map(function (m, l) {
          if (!m) return null;
          if (!Array.isArray(m) || m.length !== layers[l + 1]) throw new Error('网络 JSON 掩码行数不符');
          return m.map(function (row) {
            if (!Array.isArray(row) || row.length !== layers[l]) throw new Error('网络 JSON 掩码列数不符');
            return row.map(function (v) { return !!v; });
          });
        });
      }
      const n = Object.create(Network.prototype);
      n.layers = layers.slice();
      n.outAct = outAct;
      n.seed = obj.seed == null ? 1 : obj.seed;
      n.acts = acts;
      n.W = obj.W.map(function (m) { return m.map(function (r) { return r.slice(); }); });
      n.b = obj.b.map(function (r) { return r.slice(); });
      n.mask = mask;
      return n;
    }
  }
  const api = { Network: Network };
  root.Synapse = root.Synapse || {};
  root.Synapse.network = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
