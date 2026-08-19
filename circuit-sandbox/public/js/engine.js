'use strict';
// 电路沙盒 · MNA 求解器（完整）
// 修正节点法瞬态求解器。节点 0 = GND（参考点，不进未知量）。
// 电压源约定：端点 0 为负/参考，端点 1 为正，约束 v_b - v_a = E。
// 电容/电感用梯形伴生模型；二极管/三极管用有界牛顿-拉夫逊；逻辑门为带延迟的电压源支路。

const DT = 1e-5;
const VCC = 5.0;
const VT = 0.02585;
const BETA = 100;
const IS_DIODE = 1e-12;
const GATE_DELAY = 1e-6; // 逻辑门传播延迟 1µs

function zeros(n) {
  const a = [];
  for (let i = 0; i < n; i++) a[i] = new Float64Array(n);
  return a;
}
function zeroVec(n) { return new Float64Array(n); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function expSafe(v, maxExp) { maxExp = maxExp || 40; return v > maxExp ? Math.exp(maxExp) : v < -40 ? 0 : Math.exp(v); }
function fExp(v) { return expSafe(v / VT, 30) - 1; } // exp(v/Vt)-1，指数钳位 30 防溢出

// 高斯消元（部分主元）。返回解向量 x，奇异时返回 null。
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

// 交流源波形
function evalWaveform(type, x) {
  const s = Math.sin(x);
  if (type === 'sine') return s;
  if (type === 'square') return s >= 0 ? 1 : -1;
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(s);
  return s;
}

// 电压源支路：施加电压、电流未知。约束 v_termB - v_termA = E。
// 返回 {vbr:[{compId, termA, termB, E}], K}
function collectVBRANCHES(circ, t, gateOut, prevV) {
  const vbr = [];
  for (const c of circ.comps.values()) {
    const a = c.terminals[0].nodeId;
    const b = c.terminals[1].nodeId;
    if (c.type === 'voltage') {
      vbr.push({ compId: c.id, termA: a, termB: b, E: c.params.v });
    } else if (c.type === 'switch') {
      if (c.state.closed) vbr.push({ compId: c.id, termA: a, termB: b, E: 0 });
    } else if (c.type === 'ac') {
      const w = 2 * Math.PI * (c.params.freq || 1);
      const e = (c.params.amp || 1) * evalWaveform(c.params.waveform || 'sine', w * t + (c.params.phase || 0)) + (c.params.offset || 0);
      vbr.push({ compId: c.id, termA: a, termB: b, E: e });
    } else if (c.type === 'opamp') {
      // 端点：[in-, in+, out]；用 上一步电压避免代数环
      const vm = prevV.get(c.terminals[0].nodeId) || 0;
      const vp = prevV.get(c.terminals[1].nodeId) || 0;
      const supply = c.params.supply || VCC;
      const e = clamp((c.params.gain || 1e5) * (vp - vm), -supply, supply);
      vbr.push({ compId: c.id, termA: a, termB: b, E: e });
    } else if (c.type === 'gate') {
      const level = gateOut.get(c.id) || 0;
      const outNode = c.terminals[c.terminals.length - 1].nodeId;
      vbr.push({ compId: c.id, termA: 0, termB: outNode, E: level ? VCC : 0 });
    }
    // inductor 走伴生模型，不在此列
  }
  return vbr;
}

// 逻辑门：根据上一步输入电压算期望输出电平（0/1）
function computeGateLevel(c, prevV) {
  const inTerms = c.terminals.slice(0, -1);
  const outTerm = c.terminals[c.terminals.length - 1];
  const inputs = inTerms.map((t) => (prevV.get(t.nodeId) || 0) >= VCC / 2 ? 1 : 0);
  const gate = c.params.gate;
  let out;
  switch (gate) {
    case 'not': out = inputs[0] === 0 ? 1 : 0; break;
    case 'and': out = inputs.every((x) => x === 1) ? 1 : 0; break;
    case 'or': out = inputs.some((x) => x === 1) ? 1 : 0; break;
    case 'nand': out = inputs.every((x) => x === 1) ? 0 : 1; break;
    case 'nor': out = inputs.some((x) => x === 1) ? 0 : 1; break;
    case 'xor': out = inputs.reduce((a, b) => a ^ b, 0); break;
    case 'xnor': out = inputs.reduce((a, b) => a ^ b, 0) === 0 ? 1 : 0; break;
    default: out = 0;
  }
  return out;
}

// 门延迟状态机：输出在输入变化后 τ 才翻转。首次调用时根据初始输入立即设定输出（无延迟）。
function updateGateDelay(c, t, prevV) {
  const s = c.state;
  if (!s.gate) {
    s.gate = { outLevel: 0, pendingLevel: null, pendingTime: -1e9 };
    s.gate.outLevel = computeGateLevel(c, prevV);
  }
  const g = s.gate;
  const desired = computeGateLevel(c, prevV);
  if (desired === g.outLevel) { g.pendingLevel = null; return; }
  if (g.pendingLevel === desired) {
    if (t >= g.pendingTime + GATE_DELAY) { g.outLevel = desired; g.pendingLevel = null; }
  } else {
    g.pendingLevel = desired;
    g.pendingTime = t;
  }
}

// 组装线性系统。vEst = 当前电压估计（用于非线性线性化）。
function buildSystem(circ, t, dt, vEst, gateOut, prevV) {
  const nodeIds = [...circ.nodes.keys()].filter((id) => id !== 0);
  const N = nodeIds.length;
  const idx = new Map(nodeIds.map((id, i) => [id, i]));
  const vbr = collectVBRANCHES(circ, t, gateOut, prevV);
  const K = vbr.length;
  const S = N + K;
  const A = zeros(S);
  const rhs = zeroVec(S);

  const addCond = (a, b, g) => {
    if (a !== 0) A[idx.get(a)][idx.get(a)] += g;
    if (b !== 0) A[idx.get(b)][idx.get(b)] += g;
    if (a !== 0 && b !== 0) {
      A[idx.get(a)][idx.get(b)] -= g;
      A[idx.get(b)][idx.get(a)] -= g;
    }
  };
  // 电流 i 从 a 流向 b：从 a 抽出、注入 b
  const addCurr = (a, b, i) => {
    if (a !== 0) rhs[idx.get(a)] -= i;
    if (b !== 0) rhs[idx.get(b)] += i;
  };
  // 往节点 n 注入电流 i（流入为正）
  const addNodeCurrent = (n, i) => { if (n !== 0) rhs[idx.get(n)] += i; };

  for (const c of circ.comps.values()) {
    const a = c.terminals[0].nodeId;
    const b = c.terminals[1].nodeId;
    switch (c.type) {
      case 'resistor': addCond(a, b, 1 / c.params.r); break;
      case 'current': addCurr(a, b, c.params.i); break;
      case 'capacitor': {
        const Geq = 2 * c.params.c / dt;
        const vPrev = c.state.vPrev || 0;
        const iPrev = c.state.iPrev || 0;
        const Ieq = -Geq * vPrev - iPrev;
        addCond(a, b, Geq);
        addCurr(a, b, Ieq);
        break;
      }
      case 'inductor': {
        const Geq = dt / (2 * c.params.l);
        const vPrev = c.state.vPrev || 0;
        const iPrev = c.state.iPrev || 0;
        const Ieq = Geq * vPrev + iPrev;
        addCond(a, b, Geq);
        addCurr(a, b, Ieq);
        break;
      }
      case 'diode': {
        // 阳极 a，阴极 b。钳位 vd 防指数溢出，线性化围绕钳位点（isrc 用 vdC 保持一致）
        const vd = (vEst.get(a) || 0) - (vEst.get(b) || 0);
        const vdC = clamp(vd, -0.2, 0.75);
        const i0 = IS_DIODE * fExp(vdC);
        const gd = (i0 + IS_DIODE) / VT; // dI/dVd
        addCond(a, b, gd);
        addCurr(a, b, i0 - gd * vdC);
        break;
      }
      case 'bjt_n': case 'bjt_p': {
        // NPN: 端点 [collector, emitter, base]；PNP: 端点 [emitter, collector, base]
        const t0 = c.terminals[0].nodeId, t1 = c.terminals[1].nodeId, t2 = c.terminals[2].nodeId;
        const cc = c.type === 'bjt_n' ? t0 : t1;
        const ee = c.type === 'bjt_n' ? t1 : t0;
        const bb = t2;
        const sign = c.type === 'bjt_p' ? -1 : 1;
        const Vb = vEst.get(bb) || 0, Ve = vEst.get(ee) || 0, Vc = vEst.get(cc) || 0;
        const Vbe = sign * (Vb - Ve);
        const Vbc = sign * (Vb - Vc);
        const fbe = fExp(Vbe);
        const fbc = fExp(Vbc);
        const ge = expSafe(Vbe / VT, 30) / VT;
        const gc = expSafe(Vbc / VT, 30) / VT;
        const A_is = IS_DIODE / BETA; // Is/β
        const B_is = IS_DIODE;        // Is
        // 端电流（流入端）：Ib, Ic, Ie
        const Ib = sign * (A_is * fbe + A_is * fbc);
        const Ic = sign * (B_is * fbe - A_is * fbc);
        const Ie = -(Ib + Ic);
        const It = [Ic, Ie, Ib];
        // 雅可比 dIt/dV，行 [collector, emitter, base]，列 [Vc, Ve, Vb]
        const J = [
          [A_is * gc, -B_is * ge, B_is * ge - A_is * gc], // dIc
          [0, (A_is + B_is) * ge, -(A_is + B_is) * ge],   // dIe
          [-A_is * gc, -A_is * ge, A_is * ge + A_is * gc] // dIb
        ];
        const terms = [cc, ee, bb];
        const v0 = [Vc, Ve, Vb]; // 实际节点电压（源扫描保证 Vbe 在合理范围）
        for (let ti = 0; ti < 3; ti++) {
          const tn = terms[ti];
          let isrc = It[ti];
          for (let tj = 0; tj < 3; tj++) {
            const g = J[ti][tj];
            if (tn !== 0 && terms[tj] !== 0) A[idx.get(tn)][idx.get(terms[tj])] += g;
            isrc -= g * v0[tj];
          }
          addNodeCurrent(tn, -isrc); // 端电流流出节点 → 注入为负
        }
        break;
      }
    }
  }
  for (let k = 0; k < K; k++) {
    const { termA: a, termB: b, E } = vbr[k];
    const row = N + k;
    if (b !== 0) A[row][idx.get(b)] += 1;
    if (a !== 0) A[row][idx.get(a)] -= 1;
    if (a !== 0) A[idx.get(a)][row] += 1;
    if (b !== 0) A[idx.get(b)][row] -= 1;
    rhs[row] = E;
  }
  return { A, rhs, vbr, N, nodeIds, idx };
}

function step(circ, t, dt) {
  const nodeIds = [...circ.nodes.keys()].filter((id) => id !== 0);
  const N = nodeIds.length;
  const prevV = circ._lastVoltages || new Map();

  // 门延迟状态更新（基于上一步电压）
  const gateOut = new Map();
  for (const c of circ.comps.values()) {
    if (c.type === 'gate') { updateGateDelay(c, t, prevV); gateOut.set(c.id, c.state.gate.outLevel); }
  }

  // 牛顿-拉夫逊迭代（二极管/三极管非线性）
  let vEst = new Map();
  vEst.set(0, 0);
  for (const id of nodeIds) vEst.set(id, prevV.get(id) || 0);
  let x = null;
  for (let iter = 0; iter < 6; iter++) {
    const sys = buildSystem(circ, t, dt, vEst, gateOut, prevV);
    x = solveLinear(sys.A, sys.rhs);
    if (!x) return { ok: false, errors: ['短路或拓扑错误：矩阵奇异'], voltages: new Map(), currents: new Map() };
    const newV = new Map();
    newV.set(0, 0);
    for (let i = 0; i < N; i++) newV.set(nodeIds[i], x[i]);
    let maxDelta = 0;
    for (let i = 0; i < N; i++) maxDelta = Math.max(maxDelta, Math.abs(x[i] - (vEst.get(nodeIds[i]) || 0)));
    vEst = newV;
    if (maxDelta < 1e-8) break;
  }

  const voltages = vEst;
  const currents = new Map();
  // 从解中取电压源支路电流
  const sys0 = buildSystem(circ, t, dt, voltages, gateOut, prevV);
  for (let k = 0; k < sys0.vbr.length; k++) currents.set(sys0.vbr[k].compId, x[N + k]);
  // 电阻/电容/电感电流 = (v_a - v_b)*Geq + Ieq 形式，或直接 (Va-Vb)/R
  for (const c of circ.comps.values()) {
    if (currents.has(c.id)) continue;
    const a = c.terminals[0].nodeId, b = c.terminals[1].nodeId;
    const va = voltages.get(a) || 0, vb = voltages.get(b) || 0;
    if (c.type === 'resistor') currents.set(c.id, (va - vb) / c.params.r);
    else if (c.type === 'capacitor') {
      const Geq = 2 * c.params.c / dt;
      const vPrev = c.state.vPrev || 0, iPrev = c.state.iPrev || 0;
      const Ieq = -Geq * vPrev - iPrev;
      currents.set(c.id, Geq * (va - vb) + Ieq);
    } else if (c.type === 'inductor') {
      const Geq = dt / (2 * c.params.l);
      const vPrev = c.state.vPrev || 0, iPrev = c.state.iPrev || 0;
      const Ieq = Geq * vPrev + iPrev;
      currents.set(c.id, Geq * (va - vb) + Ieq);
    } else if (c.type === 'current') currents.set(c.id, c.params.i);
    else if (c.type === 'bjt_n' || c.type === 'bjt_p') {
      const t0 = c.terminals[0].nodeId, t1 = c.terminals[1].nodeId, t2 = c.terminals[2].nodeId;
      const cc = c.type === 'bjt_n' ? t0 : t1;
      const ee = c.type === 'bjt_n' ? t1 : t0;
      const bb = t2;
      const sign = c.type === 'bjt_p' ? -1 : 1;
      const Vb = voltages.get(bb) || 0, Ve = voltages.get(ee) || 0, Vc = voltages.get(cc) || 0;
      const fbe = fExp(sign * (Vb - Ve)), fbc = fExp(sign * (Vb - Vc));
      const Ic = sign * (IS_DIODE * fbe - (IS_DIODE / BETA) * fbc);
      currents.set(c.id, Ic); // 记录集电极电流
    }
  }

  // 更新历史态
  for (const c of circ.comps.values()) {
    const a = c.terminals[0].nodeId, b = c.terminals[1].nodeId;
    const va = voltages.get(a) || 0, vb = voltages.get(b) || 0;
    if (c.type === 'capacitor' || c.type === 'inductor') {
      const prevVc = c.state.vPrev || 0, prevIc = c.state.iPrev || 0;
      let Geq, Ieq;
      if (c.type === 'capacitor') { Geq = 2 * c.params.c / dt; Ieq = -Geq * prevVc - prevIc; }
      else { Geq = dt / (2 * c.params.l); Ieq = Geq * prevVc + prevIc; }
      const newI = Geq * (va - vb) + Ieq;
      c.state.vPrev = va - vb;
      c.state.iPrev = newI;
    }
  }

  circ._lastVoltages = voltages;
  return { ok: true, errors: [], voltages, currents };
}

function settle(circ, maxSteps) {
  maxSteps = maxSteps || 20000;
  // 源扫描：直流电压源从 0 逐步升到目标值，避免 stiff 非线性元件（二极管/三极管）牛顿发散
  const vsrcs = [];
  for (const c of circ.comps.values()) {
    if (c.type === 'voltage') vsrcs.push({ comp: c, target: c.params.v });
  }
  const saved = vsrcs.map((x) => x.target);
  const rampSteps = Math.min(800, Math.floor(maxSteps / 5));
  for (let s = 1; s <= rampSteps; s++) {
    const frac = s / rampSteps;
    for (let i = 0; i < vsrcs.length; i++) vsrcs[i].comp.params.v = saved[i] * frac;
    step(circ, s * DT, DT);
  }
  for (let i = 0; i < vsrcs.length; i++) vsrcs[i].comp.params.v = saved[i];
  let r, t = rampSteps * DT;
  for (let i = 0; i < maxSteps - rampSteps; i++) { r = step(circ, t, DT); t += DT; if (!r.ok) break; }
  return r || { ok: false, errors: ['无解'], voltages: new Map(), currents: new Map() };
}

module.exports = { step, settle, DT, VCC, VT, BETA, IS_DIODE, GATE_DELAY, clamp, expSafe };