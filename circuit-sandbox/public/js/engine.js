'use strict';
// 电路沙盒 · MNA 求解器核心
// 修正节点法（Modified Nodal Analysis）：未知量 = 非 GND 节点电压 + K 个电压源支路电流。
// 节点 0 固定为 GND（参考点，电压 0），不进未知量。
// 电压源约定：端点 0 为负/参考，端点 1 为正，约束 v_b - v_a = E。

const DT = 1e-5;          // 时间步长 10µs（奈奎斯特 50kHz）
const VCC = 5.0;           // 逻辑高电平 / 默认供电
const VT = 0.02585;        // 300K 热电压
const BETA = 100;          // 默认三极管放大系数
const IS_DIODE = 1e-12;   // 默认二极管饱和电流

function zeros(n) {
  const a = [];
  for (let i = 0; i < n; i++) a[i] = new Float64Array(n);
  return a;
}
function zeroVec(n) { return new Float64Array(n); }

// 高斯消元（部分主元）。返回解向量 x，奇异时返回 null。原地修改 A、b。
function solveLinear(A, b) {
  const n = A.length;
  for (let col = 0; col < n; col++) {
    let max = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[max][col])) max = row;
    }
    if (Math.abs(A[max][col]) < 1e-12) return null;
    if (max !== col) {
      const tmp = A[col]; A[col] = A[max]; A[max] = tmp;
      const tb = b[col]; b[col] = b[max]; b[max] = tb;
    }
    const piv = A[col][col];
    for (let row = col + 1; row < n; row++) {
      const f = A[row][col] / piv;
      if (f === 0) continue;
      for (let k = col; k < n; k++) A[row][k] -= f * A[col][k];
      b[row] -= f * b[col];
    }
  }
  const x = new Float64Array(n);
  for (let row = n - 1; row >= 0; row--) {
    let s = b[row];
    for (let k = row + 1; k < n; k++) s -= A[row][k] * x[k];
    x[row] = s / A[row][row];
  }
  return x;
}

// 收集电压源支路：施加电压、电流未知的元件。返回 [{compId, termA, termB, E}]，约束 v_termB - v_termA = E。
function collectVBRANCHES(circ) {
  const br = [];
  for (const c of circ.comps.values()) {
    if (c.type === 'voltage') {
      br.push({ compId: c.id, termA: c.terminals[0].nodeId, termB: c.terminals[1].nodeId, E: c.params.v });
    } else if (c.type === 'switch') {
      if (c.state.closed) br.push({ compId: c.id, termA: c.terminals[0].nodeId, termB: c.terminals[1].nodeId, E: 0 });
    }
    // ac / opamp / gate / inductor 在后续任务加入
  }
  return br;
}

function step(circ, t, dt) {
  const nodeIds = [...circ.nodes.keys()].filter((id) => id !== 0);
  const N = nodeIds.length;
  const idx = new Map(nodeIds.map((id, i) => [id, i]));
  const vbr = collectVBRANCHES(circ);
  const K = vbr.length;
  const S = N + K;
  const A = zeros(S);
  const rhs = zeroVec(S);

  // 往节点 a、b 间加电导 g（若某端点为 GND 则只加对角，不加交叉项）
  const addCond = (a, b, g) => {
    if (a !== 0) A[idx.get(a)][idx.get(a)] += g;
    if (b !== 0) A[idx.get(b)][idx.get(b)] += g;
    if (a !== 0 && b !== 0) {
      A[idx.get(a)][idx.get(b)] -= g;
      A[idx.get(b)][idx.get(a)] -= g;
    }
  };
  // 往节点 a→b 加电流 i（GND 端不贡献行）
  const addCurr = (a, b, i) => {
    if (a !== 0) rhs[idx.get(a)] += i;
    if (b !== 0) rhs[idx.get(b)] -= i;
  };

  for (const c of circ.comps.values()) {
    const a = c.terminals[0].nodeId;
    const b = c.terminals[1].nodeId;
    switch (c.type) {
      case 'resistor': addCond(a, b, 1 / c.params.r); break;
      case 'current': addCurr(a, b, c.params.i); break;
      // capacitor / inductor / diode / bjt / gate / ac / opamp 在后续任务加入
    }
  }
  for (let k = 0; k < K; k++) {
    const { termA: a, termB: b, E } = vbr[k];
    const row = N + k;
    // 约束：v_b - v_a = E
    if (b !== 0) A[row][idx.get(b)] += 1;
    if (a !== 0) A[row][idx.get(a)] -= 1;
    // 支路电流耦合：电流 i 从 a 流向 b；a 行 +i，b 行 -i
    if (a !== 0) A[idx.get(a)][row] += 1;
    if (b !== 0) A[idx.get(b)][row] -= 1;
    rhs[row] = E;
  }

  const x = solveLinear(A, rhs);
  if (!x) return { ok: false, errors: ['短路或拓扑错误：矩阵奇异'], voltages: new Map(), currents: new Map() };

  const voltages = new Map();
  voltages.set(0, 0);
  for (let i = 0; i < N; i++) voltages.set(nodeIds[i], x[i]);
  const currents = new Map();
  for (let k = 0; k < K; k++) currents.set(vbr[k].compId, x[N + k]);
  // 电阻电流 = (v_a - v_b)/R，便于仪器与动画读取
  for (const c of circ.comps.values()) {
    if (c.type === 'resistor' && !currents.has(c.id)) {
      const a = c.terminals[0].nodeId, b = c.terminals[1].nodeId;
      currents.set(c.id, (voltages.get(a) - voltages.get(b)) / c.params.r);
    }
  }
  return { ok: true, errors: [], voltages, currents };
}

// 跑多步达到稳态（不渲染）
function settle(circ, maxSteps) {
  maxSteps = maxSteps || 20000;
  let r;
  let t = 0;
  for (let i = 0; i < maxSteps; i++) { r = step(circ, t, DT); t += DT; if (!r.ok) break; }
  return r || { ok: false, errors: ['无解'], voltages: new Map(), currents: new Map() };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function expSafe(v) { return v > 40 ? Math.exp(40) : v < -40 ? 0 : Math.exp(v); }

module.exports = { step, settle, DT, VCC, VT, BETA, IS_DIODE, clamp, expSafe };