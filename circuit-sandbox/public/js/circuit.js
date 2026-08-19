'use strict';
// 电路沙盒 · 网表数据模型
// 节点 id 为整数，节点 0 固定为 GND。元件 = {id, type, terminals:[{nodeId, role}], params, state}。

const CT = Object.freeze({
  VOLTAGE: 'voltage',
  CURRENT: 'current',
  RESISTOR: 'resistor',
  CAPACITOR: 'capacitor',
  INDUCTOR: 'inductor',
  DIODE: 'diode',
  BJT_N: 'bjt_n',
  BJT_P: 'bjt_p',
  GATE: 'gate',
  SWITCH: 'switch',
  OPAMP: 'opamp',
  AC: 'ac',
  GND: 'gnd'
});

const GATE_TYPES = Object.freeze({
  NOT: 'not',
  AND: 'and',
  OR: 'or',
  NAND: 'nand',
  NOR: 'nor',
  XOR: 'xor',
  XNOR: 'xnor'
});

class Circuit {
  constructor() {
    this._nodes = new Map();
    this._comps = new Map();
    this._nextNode = 1;
    this._nextComp = 1;
    this._nodes.set(0, { id: 0, name: 'GND' });
  }

  get nodes() { return this._nodes; }
  get comps() { return this._comps; }

  addNode(name) {
    const id = this._nextNode++;
    this._nodes.set(id, { id, name: name || ('N' + id) });
    return id;
  }

  _ensureNode(nodeId) {
    if (nodeId == null || !this._nodes.has(nodeId)) {
      if (nodeId != null) this._nodes.set(nodeId, { id: nodeId, name: 'N' + nodeId });
    }
    if (nodeId != null && nodeId >= this._nextNode) this._nextNode = nodeId + 1;
  }

  addComponent(type, params, terminalNodeIds) {
    const id = this._nextComp++;
    const comp = {
      id,
      type,
      terminals: terminalNodeIds.map((nid) => ({ nodeId: nid, role: null })),
      params: Object.assign({}, params),
      state: {}
    };
    for (const nid of terminalNodeIds) this._ensureNode(nid);
    this._comps.set(id, comp);
    return id;
  }

  removeComponent(id) { this._comps.delete(id); }

  removeNode(id) {
    if (id === 0) return;
    for (const c of this._comps.values()) {
      c.terminals = c.terminals.filter((t) => t.nodeId !== id);
    }
    this._nodes.delete(id);
  }

  connect(compId, termIdx, nodeId) {
    const c = this._comps.get(compId);
    if (c) {
      c.terminals[termIdx].nodeId = nodeId;
      this._ensureNode(nodeId);
    }
  }

  disconnect(compId, termIdx) {
    const c = this._comps.get(compId);
    if (c) c.terminals[termIdx].nodeId = null;
  }

  toJSON() {
    return {
      version: 1,
      nodes: [...this._nodes.values()].map((n) => ({ id: n.id, name: n.name })),
      components: [...this._comps.values()].map((c) => ({
        id: c.id,
        type: c.type,
        terminals: c.terminals.map((t) => ({ nodeId: t.nodeId, role: t.role })),
        params: c.params
      }))
    };
  }

  fromJSON(obj) {
    this._nodes.clear();
    this._comps.clear();
    this._nodes.set(0, { id: 0, name: 'GND' });
    this._nextNode = 1;
    this._nextComp = 1;
    for (const n of obj.nodes || []) {
      this._nodes.set(n.id, { id: n.id, name: n.name });
      if (n.id >= this._nextNode) this._nextNode = n.id + 1;
    }
    for (const c of obj.components || []) {
      const id = this._nextComp++;
      this._comps.set(id, {
        id,
        type: c.type,
        terminals: c.terminals.map((t) => ({ nodeId: t.nodeId, role: t.role || null })),
        params: Object.assign({}, c.params),
        state: {}
      });
      if (c.id >= this._nextComp) this._nextComp = c.id + 1;
    }
    return this;
  }

  clear() {
    this._nodes.clear();
    this._comps.clear();
    this._nodes.set(0, { id: 0, name: 'GND' });
    this._nextNode = 1;
    this._nextComp = 1;
  }
}

module.exports = { CT, GATE_TYPES, Circuit };