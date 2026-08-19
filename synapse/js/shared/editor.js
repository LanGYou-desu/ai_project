'use strict';
/* SYNAPSE · 网络图编辑器（纯逻辑，层列模型：连线只允许相邻两层） */
(function (root) {
  'use strict';
  const NW = (typeof require !== 'undefined') ? require('./network.js') : root.Synapse.network;
  const { Network } = NW;

  class SynapseEditor {
    constructor(opts) {
      opts = opts || {};
      this.inputCount = opts.inputCount || 2;
      this.outputCount = opts.outputCount || 1;
      this.outAct = opts.outAct || 'sigmoid';
      this.nextId = 1;
      this.layers = [];
      this.edges = [];
      const ins = [];
      for (let i = 0; i < this.inputCount; i++) ins.push(this._node('input', 0, 'x' + (i + 1), 'identity', 0));
      this.layers.push(ins);
      const outs = [];
      for (let i = 0; i < this.outputCount; i++) outs.push(this._node('output', 1, 'y' + (i + 1), this.outAct, 0));
      this.layers.push(outs);
    }
    _node(kind, layer, label, activation, bias) {
      return { id: this.nextId++, kind: kind, layer: layer, label: label, activation: activation, bias: bias || 0, pos: { x: 0, y: 0 } };
    }
    _renumber() { for (let l = 0; l < this.layers.length; l++) for (const n of this.layers[l]) n.layer = l; }
    node(id) { for (const col of this.layers) for (const n of col) if (n.id === id) return n; return null; }
    layerCount() { return this.layers.length; }
    nodeCount() { let c = 0; for (const col of this.layers) c += col.length; return c; }
    hiddenLayerCount() { return Math.max(0, this.layers.length - 2); }
    addHiddenLayer(index, count, activation) {
      if (index == null) index = this.layers.length - 1;
      if (index < 1 || index > this.layers.length - 1) throw new Error('隐藏层位置不合法');
      count = count || 4;
      activation = activation || 'tanh';
      const col = [];
      for (let i = 0; i < count; i++) col.push(this._node('hidden', index, 'h' + (i + 1), activation, 0));
      this.layers.splice(index, 0, col);
      this._renumber();
      this._pruneBadEdges();
    }
    removeHiddenLayer(index) {
      if (index < 1 || index >= this.layers.length - 1) throw new Error('不能删除输入/输出层');
      const ids = new Set(this.layers[index].map(function (n) { return n.id; }));
      this.layers.splice(index, 1);
      this._renumber();
      this.edges = this.edges.filter(function (e) { return !ids.has(e.from) && !ids.has(e.to); });
      this._pruneBadEdges();
    }
    addNeuron(layerIndex, activation) {
      if (layerIndex == null) layerIndex = Math.max(1, this.layers.length - 2);
      if (layerIndex < 1 || layerIndex >= this.layers.length - 1) throw new Error('只能给隐藏层加神经元');
      const col = this.layers[layerIndex];
      const act = activation || (col.length ? col[0].activation : 'tanh');
      const n = this._node('hidden', layerIndex, 'h' + (col.length + 1), act, 0);
      col.push(n);
      return n;
    }
    removeNeuron(id) {
      const n = this.node(id);
      if (!n) return false;
      if (n.kind === 'input' || n.kind === 'output') throw new Error('输入/输出神经元不能删除');
      if (this.layers[n.layer].length <= 1) throw new Error('每层至少保留一个神经元');
      this.layers[n.layer] = this.layers[n.layer].filter(function (x) { return x.id !== id; });
      this.edges = this.edges.filter(function (e) { return e.from !== id && e.to !== id; });
      return true;
    }
    _pruneBadEdges() {
      const self = this;
      this.edges = this.edges.filter(function (e) {
        const from = self.node(e.from), to = self.node(e.to);
        return from && to && to.layer === from.layer + 1;
      });
    }
    addEdge(fromId, toId) {
      const from = this.node(fromId), to = this.node(toId);
      if (!from || !to) throw new Error('节点不存在');
      if (to.layer !== from.layer + 1) throw new Error('连线只允许相邻两层之间');
      if (this.hasEdge(fromId, toId)) throw new Error('该连线已存在');
      this.edges.push({ id: this.nextId++, from: fromId, to: toId });
      return true;
    }
    removeEdge(fromId, toId) {
      this.edges = this.edges.filter(function (e) { return !(e.from === fromId && e.to === toId); });
    }
    hasEdge(fromId, toId) { return !!this.edgeBetween(fromId, toId); }
    edgeBetween(fromId, toId) { for (const e of this.edges) if (e.from === fromId && e.to === toId) return e; return null; }
    toggleEdge(fromId, toId) {
      try { this.addEdge(fromId, toId); return 'added'; }
      catch (e) { this.removeEdge(fromId, toId); return 'removed'; }
    }
    autoWire() {
      this.edges = [];
      for (let l = 0; l < this.layers.length - 1; l++) {
        const fromCol = this.layers[l], toCol = this.layers[l + 1];
        for (const f of fromCol) for (const t of toCol) this.edges.push({ id: this.nextId++, from: f.id, to: t.id });
      }
    }
    clearEdges() { this.edges = []; }
    edgeCount() { return this.edges.length; }
    toNetwork(seed) {
      for (const col of this.layers) if (col.length === 0) throw new Error('存在空层，无法构建网络');
      const counts = this.layers.map(function (c) { return c.length; });
      const hiddenActs = this.layers.slice(1, -1).map(function (col) { return col.map(function (n) { return n.activation; }); });
      const net = new Network({ layers: counts, hiddenActs: hiddenActs, outAct: this.outAct, seed: seed == null ? 7 : seed });
      const mask = [];
      for (let l = 0; l < net.W.length; l++) {
        const fromCol = this.layers[l], toCol = this.layers[l + 1];
        const m = toCol.map(function () { return fromCol.map(function () { return false; }); });
        for (const e of this.edges) {
          const from = this.node(e.from), to = this.node(e.to);
          if (!from || !to || to.layer !== from.layer + 1 || from.layer !== l) continue;
          const fi = fromCol.indexOf(from), ti = toCol.indexOf(to);
          if (fi < 0 || ti < 0) continue;
          m[ti][fi] = true;
        }
        for (let i = 0; i < toCol.length; i++) for (let j = 0; j < fromCol.length; j++) if (!m[i][j]) net.W[l][i][j] = 0;
        mask.push(m);
      }
      net.mask = mask;
      for (let l = 1; l < this.layers.length; l++) {
        const col = this.layers[l];
        for (let i = 0; i < col.length; i++) net.b[l - 1][i] = col[i].bias || 0;
      }
      return net;
    }
    getWeight(net, e) {
      const from = this.node(e.from), to = this.node(e.to);
      if (!from || !to || to.layer !== from.layer + 1) return 0;
      const l = from.layer;
      const fi = this.layers[l].indexOf(from), ti = this.layers[l + 1].indexOf(to);
      return net ? net.W[l][ti][fi] : 0;
    }
    setWeight(net, fromId, toId, w) {
      if (!this.hasEdge(fromId, toId)) this.addEdge(fromId, toId);
      const from = this.node(fromId), to = this.node(toId);
      const l = from.layer;
      const fi = this.layers[l].indexOf(from), ti = this.layers[l + 1].indexOf(to);
      net.W[l][ti][fi] = w;
    }
    serialize() {
      return {
        kind: 'SynapseEditor', version: 1,
        inputCount: this.inputCount, outputCount: this.outputCount, outAct: this.outAct, nextId: this.nextId,
        layers: this.layers.map(function (col) {
          return col.map(function (n) { return { id: n.id, kind: n.kind, layer: n.layer, label: n.label, activation: n.activation, bias: n.bias, pos: { x: n.pos.x, y: n.pos.y } }; });
        }),
        edges: this.edges.map(function (e) { return { id: e.id, from: e.from, to: e.to }; })
      };
    }
    static fromJSON(obj) {
      if (!obj || obj.kind !== 'SynapseEditor') throw new Error('不是合法的编辑器 JSON');
      const ed = new SynapseEditor({ inputCount: obj.inputCount, outputCount: obj.outputCount, outAct: obj.outAct });
      ed.nextId = obj.nextId;
      ed.layers = obj.layers.map(function (col) {
        return col.map(function (n) {
          return { id: n.id, kind: n.kind, layer: n.layer, label: n.label, activation: n.activation, bias: n.bias, pos: { x: n.pos.x, y: n.pos.y } };
        });
      });
      ed.edges = obj.edges.map(function (e) { return { id: e.id, from: e.from, to: e.to }; });
      return ed;
    }
  }
  const api = { SynapseEditor: SynapseEditor };
  root.Synapse = root.Synapse || {};
  root.Synapse.editor = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
