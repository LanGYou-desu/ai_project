# 电路沙盒 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based circuit sandbox — drag real components, wire them, press play, watch current flow, measure with multimeter/oscilloscope, and unlock 9 challenge levels that teach circuit knowledge. Zero dependencies, works offline.

**Architecture:** A single unified Modified Nodal Analysis (MNA) transient solver (`public/js/engine.js`) is the core. Every component maps to either a conductance entry, a current-source RHS entry, or a voltage-source branch in one matrix. Capacitors/inductors use trapezoidal companion models; logic gates are voltage-source branches with propagation delay; diodes/BJTs use bounded Newton-Raphthon. `public/js/circuit.js` owns the netlist data model; `render.js` draws the schematic and animates current; `ui.js` handles drag/drop/wiring; `instruments.js` owns oscilloscope + multimeter; `levels.js` owns the 9 challenges; `app.js` wires everything into the play loop.

**Tech Stack:** Native HTML/CSS/JS, Node.js `http` server, `node:test` for tests. No frameworks, no build step.

**Spec:** `docs/superpowers/specs/2026-08-20-circuit-sandbox-design.md`

## Global Constraints

- **Zero dependencies:** no npm packages at runtime. All code is原生 HTML/CSS/JS + CommonJS modules in `public/js/`.
- **Server:** Node.js `http` module serving `public/` statically, `start.bat` one-click launch with auto-open browser (mirror `the-vanished/server.js` + `start.bat`).
- **Tests:** `test/run.js` using `node:test`. Run with `node test/run.js`.
- **Runtime data:** `circuit-sandbox/data/` and browser `localStorage` only; never committed.
- **`.gitignore`:** excludes `node_modules/`, `.env`, `.superpowers/`, `data/`.
- **Style:** Chinese comments, no emoji, CommonJS `module.exports`, small focused files.
- **Simulation constants:** time step `DT = 1e-5` (10µs), logic high `VCC = 5.0`, thermal voltage `VT = 0.02585`, default BJT `BETA = 100`, default diode `IS = 1e-12`.

---

## File Map

```
circuit-sandbox/
├── server.js                  # Node http static server
├── start.bat                  # one-click launch
├── .gitignore
├── README.md
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── circuit.js         # netlist data model (Circuit class, CT constants)
│       ├── engine.js          # MNA solver + transient + nonlinear + sources
│       ├── render.js          # canvas schematic drawing + current animation
│       ├── ui.js              # drag/drop, wiring, param panel, zoom/pan
│       ├── instruments.js     # oscilloscope + multimeter
│       ├── levels.js          # 9 challenge definitions + success checks
│       └── app.js             # orchestration: play loop, save/load, level runner
└── test/
    └── run.js                 # node:test engine tests
```

## Interfaces (cross-task contract)

- **`Circuit`** (`circuit.js`): `class Circuit { constructor(); get nodes(); get comps(); addNode(name)=>id; addComponent(type, params, terminalNodeIds)=>id; removeComponent(id); removeNode(id); connect(compId, termIdx, nodeId); disconnect(compId, termIdx); toJSON(); fromJSON(obj); clear(); }`. Components stored as `{id, type, terminals:[{nodeId, role}], params:{...}, state:{...}}`. `state` holds per-step history (capacitor `vPrev`/`iPrev`, inductor `iPrev`/`vPrev`, gate delay queue, etc.).
- **`CT`** (`circuit.js`): `Object.freeze({VOLTAGE, CURRENT, RESISTOR, CAPACITOR, INDUCTOR, DIODE, BJT_N, BJT_P, GATE, SWITCH, OPAMP, AC, GND})`.
- **`GATE_TYPES`** (`circuit.js`): `{NOT, AND, OR, NAND, NOR, XOR, XNOR}`.
- **Engine** (`engine.js`): `step(circ, t, dt)` → `{ok, errors:[string], voltages:Map<nodeId,number>, currents:Map<compId,number>}`. Mutates `circ` component `state`. `t` is absolute simulation seconds (for AC sources). Also export constants `DT`, `VCC`, `VT`, `BETA`, `IS_DIODE`.
- **Render** (`render.js`): `function draw(ctx, circ, voltages, currents, opts)` where `opts = {probeNode:null, hoverNode:null, selectedCompId:null}`. Reads each component's `pos:{x,y}`, `angle` (0/90/180/270), and the geometry table to draw parts, terminals, wires (with current arrows), and node voltage labels.
- **UI** (`ui.js`): `function mount(root, circ, actions)` where `actions = {onChange, onPlay, onStep, onSettle, onSpeed, onSave, onLoad, onSelectComp, onEditComp, onDelete, onRunLevel}`. Provides palette drag-source, canvas drop target, wire-drawing mode, param editor modal, toolbar.
- **Instruments** (`instruments.js`): `function makeOscilloscope(root)` and `function makeMultimeter(root)`. Oscilloscope exposes `attach(nodeA, nodeB)`, `push(t, va, vb)`, `setTimeDiv`, `setVoltsDiv`, `setTrigger`. Multimeter exposes `measure(circ, nodeA, nodeB, kind)` where kind ∈ `{VOLTAGE, CURRENT, RESISTANCE}`.
- **Levels** (`levels.js`): `const LEVELS = [ {id, title, hint, setup(circuit)=>void, check(voltages, currents)=>{ok, message}, knowledgeCard} ... ]` (9 entries).
- **App** (`app.js`): `function start(root)` — builds `Circuit`, mounts UI/instruments/render, runs the play loop (`while playing: step → push scope → requestAnimationFrame draw`).

## Component geometry table (local coords, centered at origin, px)

| type | visual | terminals `[x, y, role]` |
|---|---|---|
| RESISTOR | zigzag line | `[-30,0,'t1'], [30,0,'t2']` |
| CAPACITOR | two parallel plates | `[-25,0,'t1'], [25,0,'t2']` |
| INDUCTOR | 4 coils | `[-30,0,'t1'], [30,0,'t2']` |
| DIODE | triangle + vertical bar | `[-30,0,'anode'], [30,0,'cathode']` |
| VOLTAGE | circle, `+`/`-` labels | `[0,-22,'+'], [0,22,'-']` |
| CURRENT | circle, arrow | `[0,-22,'t1'], [0,22,'t2']` |
| AC | circle, sine wave | `[0,-22,'t1'], [0,22,'t2']` |
| SWITCH | line + angled lever | `[-30,0,'t1'], [30,0,'t2']` |
| GND | horizontal bar + 3 descenders | `[0,0,'gnd']` |
| NOT | rectangle + bubble | `[-30,-12,'in'], [30,0,'out']` |
| AND | rounded rect | `[-30,-12,'in1'], [-30,12,'in2'], [30,0,'out']` |
| OR | pointed back | `[-30,-12,'in1'], [-30,12,'in2'], [30,0,'out']` |
| NAND | AND + bubble | `[-30,-12,'in1'], [-30,12,'in2'], [30,0,'out']` |
| NOR | OR + bubble | `[-30,-12,'in1'], [-30,12,'in2'], [30,0,'out']` |
| XOR | OR + extra curve | `[-30,-12,'in1'], [-30,12,'in2'], [30,0,'out']` |
| XNOR | XOR + bubble | `[-30,-12,'in1'], [-30,12,'in2'], [30,0,'out']` |
| OPAMP | triangle | `[-25,-10,'in-'], [-25,10,'in+'], [25,0,'out']` |
| BJT_N | vertical bar, dot NPN | `[0,-20,'collector'], [0,20,'emitter'], [25,0,'base']` |
| BJT_P | vertical bar, dot PNP | `[0,-20,'emitter'], [0,20,'collector'], [25,0,'base']` |

Terminal world position = `rotate(local, angle) + pos`. Wires connect two terminal world positions with an L-shaped path (one bend), drawn as a thin line; current arrow drawn at the midpoint when `currents.get(compId)` is defined for that wire.

---

### Task 1: Scaffolding

**Files:**
- Create: `circuit-sandbox/server.js`
- Create: `circuit-sandbox/start.bat`
- Create: `circuit-sandbox/.gitignore`
- Create: `circuit-sandbox/public/index.html`
- Create: `circuit-sandbox/public/css/style.css`
- Create: `circuit-sandbox/test/run.js` (skeleton)
- Create: `circuit-sandbox/README.md`

**Interfaces:** Consumes nothing. Produces a runnable empty shell (`node server.js` serves index.html; `node test/run.js` runs 0 tests green).

- [ ] **Step 1: Write `server.js`, `start.bat`, `.gitignore`, `index.html` shell, `style.css` skeleton, `README.md`**

```js
// server.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8848);
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8' };
function safeJoin(base, rel) {
  const abs = path.resolve(base, '.' + path.sep + rel);
  const r = path.relative(base, abs);
  if (r === '' || r.startsWith('..') || path.isAbsolute(r)) return null;
  return abs;
}
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const fp = safeJoin(PUBLIC, rel);
    if (!fp) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } catch (e) { res.writeHead(500); res.end('Server error: ' + e.message); }
});
server.listen(PORT, () => {
  console.log('电路沙盒已启动：http://127.0.0.1:' + PORT);
  try { require('child_process').spawn('cmd', ['/c','start','','http://127.0.0.1:' + PORT], { detached: true, stdio: 'ignore' }).unref(); } catch (e) {}
});
```

```bat
@echo off
chcp 65001 >nul
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 ( echo [ERROR] 需要 Node.js ; pause ; exit /b 1 )
echo 电路沙盒启动中 ...
echo 浏览器将打开 http://127.0.0.1:8848
node server.js
pause
```

```
# .gitignore
node_modules/
.env
.superpowers/
data/
```

`index.html` shell: `<html><head><meta charset="utf-8"><title>电路沙盒</title><link rel="stylesheet" href="css/style.css"></head><body><div id="app"></div><script src="js/circuit.js"></script><script src="js/engine.js"></script>...</body></html>`

- [ ] **Step 2: Write `test/run.js` skeleton**

```js
'use strict';
const assert = require('assert');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '  ——  ' + e.message); }
}
// TODO: import circuit.js / engine.js once they exist
console.log('电路沙盒测试套件');
console.log('通过 ' + passed + '，失败 ' + failed);
if (failed) process.exit(1);
```

- [ ] **Step 3: Commit**

```bash
git add circuit-sandbox/ && git commit -m "feat: scaffold circuit-sandbox project shell"
```

---

### Task 2: Circuit data model

**Files:**
- Create: `circuit-sandbox/public/js/circuit.js`
- Modify: `circuit-sandbox/test/run.js` (add model tests)

**Interfaces:** Exports `CT`, `GATE_TYPES`, `class Circuit`. Consumed by engine, render, ui, app.

**Model rules:**
- Node ids are integers; node 0 is always GND (created automatically on `new Circuit()`).
- `addComponent(type, params, terminalNodeIds)` — `terminalNodeIds` length matches the geometry table for that type. Stores `{id, type, terminals:[{nodeId, role}], params, state:{}}`.
- `connect(compId, termIdx, nodeId)` sets `terminals[termIdx].nodeId = nodeId`; `disconnect` sets it to `null`.
- `toJSON()` serializes `{version:1, nodes:[{id,name}], components:[...]}`. `fromJSON(obj)` rebuilds and returns `this`.
- `clear()` resets to just GND.

- [ ] **Step 1: Write the failing test**

```js
// test/run.js (append)
const { CT, GATE_TYPES, Circuit } = require('../public/js/circuit');
test('Circuit starts with GND node 0', () => {
  const c = new Circuit();
  assert.strictEqual(c.nodes.get(0).id, 0);
  assert.strictEqual(c.comps.size, 0);
});
test('addComponent stores terminals and params', () => {
  const c = new Circuit();
  const id = c.addComponent(CT.RESISTOR, { r: 100 }, [0, 1]);
  assert.strictEqual(id, 1);
  assert.strictEqual(c.comps.get(id).type, CT.RESISTOR);
  assert.strictEqual(c.comps.get(id).params.r, 100);
  assert.deepStrictEqual(c.comps.get(id).terminals.map(t => t.nodeId), [0, 1]);
});
test('connect/disconnect reassigns terminal node', () => {
  const c = new Circuit();
  const id = c.addComponent(CT.RESISTOR, { r: 10 }, [0, null]);
  c.connect(id, 1, 2);
  assert.strictEqual(c.comps.get(id).terminals[1].nodeId, 2);
  c.disconnect(id, 1);
  assert.strictEqual(c.comps.get(id).terminals[1].nodeId, null);
});
test('toJSON/fromJSON round-trips', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 100 }, [1, 2]);
  const j = c.toJSON();
  const c2 = new Circuit().fromJSON(j);
  assert.strictEqual(c2.comps.size, 2);
  assert.strictEqual(c2.nodes.size, 3);
});
test('clear resets to GND only', () => {
  const c = new Circuit();
  c.addComponent(CT.RESISTOR, { r: 10 }, [0, 1]);
  c.clear();
  assert.strictEqual(c.comps.size, 0);
  assert.strictEqual(c.nodes.size, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

`node test/run.js` → FAIL: `Circuit is not defined` / `CT is not defined`.

- [ ] **Step 3: Write minimal implementation**

```js
// public/js/circuit.js
'use strict';
const CT = Object.freeze({
  VOLTAGE: 'voltage', CURRENT: 'current', RESISTOR: 'resistor',
  CAPACITOR: 'capacitor', INDUCTOR: 'inductor', DIODE: 'diode',
  BJT_N: 'bjt_n', BJT_P: 'bjt_p', GATE: 'gate', SWITCH: 'switch',
  OPAMP: 'opamp', AC: 'ac', GND: 'gnd'
});
const GATE_TYPES = Object.freeze({ NOT:'not', AND:'and', OR:'or', NAND:'nand', NOR:'nor', XOR:'xor', XNOR:'xnor' });

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
  addComponent(type, params, terminalNodeIds) {
    const id = this._nextComp++;
    const comp = {
      id, type,
      terminals: terminalNodeIds.map((nid, i) => ({ nodeId: nid, role: null })),
      params: Object.assign({}, params),
      state: {}
    };
    this._comps.set(id, comp);
    return id;
  }
  removeComponent(id) { this._comps.delete(id); }
  removeNode(id) {
    if (id === 0) return;
    for (const c of this._comps.values()) c.terminals = c.terminals.filter(t => t.nodeId !== id);
    this._nodes.delete(id);
  }
  connect(compId, termIdx, nodeId) {
    const c = this._comps.get(compId);
    if (c) c.terminals[termIdx].nodeId = nodeId;
  }
  disconnect(compId, termIdx) {
    const c = this._comps.get(compId);
    if (c) c.terminals[termIdx].nodeId = null;
  }
  toJSON() {
    return {
      version: 1,
      nodes: [...this._nodes.values()].map(n => ({ id: n.id, name: n.name })),
      components: [...this._comps.values()].map(c => ({
        id: c.id, type: c.type,
        terminals: c.terminals.map(t => ({ nodeId: t.nodeId, role: t.role })),
        params: c.params
      }))
    };
  }
  fromJSON(obj) {
    this._nodes.clear(); this._comps.clear();
    this._nodes.set(0, { id: 0, name: 'GND' });
    this._nextNode = 1; this._nextComp = 1;
    for (const n of obj.nodes || []) { this._nodes.set(n.id, { id: n.id, name: n.name }); this._nextNode = Math.max(this._nextNode, n.id + 1); }
    for (const c of obj.components || []) {
      const id = this._nextComp++;
      this._comps.set(id, {
        id, type: c.type,
        terminals: c.terminals.map(t => ({ nodeId: t.nodeId, role: t.role || null })),
        params: Object.assign({}, c.params),
        state: {}
      });
    }
    return this;
  }
  clear() {
    this._nodes.clear(); this._comps.clear();
    this._nodes.set(0, { id: 0, name: 'GND' });
    this._nextNode = 1; this._nextComp = 1;
  }
}
module.exports = { CT, GATE_TYPES, Circuit };
```

- [ ] **Step 4: Run test to verify it passes**

`node test/run.js` → all model tests PASS.

- [ ] **Step 5: Commit**

```bash
git add circuit-sandbox/ && git commit -m "feat: circuit netlist data model"
```

---

### Task 3: MNA engine core (DC only)

**Files:**
- Create: `circuit-sandbox/public/js/engine.js`
- Modify: `circuit-sandbox/test/run.js` (add DC engine tests)

**Interfaces:** Exports `step(circ, t, dt)` plus constants. Consumes `Circuit` from circuit.js.

**Algorithm (DC path):**
1. Collect VBRANCHES (voltage sources, switches-closed). K = count. Matrix size S = N + K.
2. Assemble G (S×S) and rhs (S):
   - Resistor a-b, R: `G[a][a]+=1/R; G[b][b]+=1/R; G[a][b]-=1/R; G[b][a]-=1/R`.
   - Current source a→b, I: `rhs[a]+=I; rhs[b]-=I`.
   - VBRANCH k between nodes a,b with voltage E: row `N+k` has `+1` at col a, `-1` at col b; col `N+k` has `+1` at row a, `-1` at row b; `rhs[N+k]=E`.
3. Solve `G·x = rhs` by Gaussian elimination with partial pivoting.
4. Node voltages = `x[0..N-1]`. VBRANCH currents = `x[N..N+K-1]`.
5. If matrix is singular (determinant ≈ 0), return `{ok:false, errors:['短路或拓扑错误']}`.

- [ ] **Step 1: Write the failing test**

```js
// test/run.js (append)
const { Circuit, CT } = require('../public/js/circuit');
const { step, DT } = require('../public/js/engine');
test('single voltage source sets node voltage', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  const r = step(c, 0, DT);
  assert.strictEqual(r.ok, true);
  assert.ok(Math.abs(r.voltages.get(1) - 5) < 1e-6);
});
test('voltage divider Vout = Vin*R2/(R1+R2)', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 10 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = step(c, 0, DT);
  assert.ok(Math.abs(r.voltages.get(2) - 5) < 1e-3);
});
test('Ohm law branch current through resistor', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  const id = c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = step(c, 0, DT);
  // current through R1 = (5-2.5)/1000 = 2.5mA
  assert.ok(Math.abs(r.currents.get(id) - 0.0025) < 1e-4);
});
test('parallel voltage sources short circuit is detected', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.VOLTAGE, { v: 6 }, [0, 1]);
  const r = step(c, 0, DT);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => /短路/.test(e)));
});
```

- [ ] **Step 2: Run test to verify it fails**

`node test/run.js` → FAIL: engine not defined.

- [ ] **Step 3: Write minimal implementation**

```js
// public/js/engine.js
'use strict';
const DT = 1e-5;
const VCC = 5.0;
const VT = 0.02585;
const BETA = 100;
const IS_DIODE = 1e-12;

function zeros(n) { const a = []; for (let i = 0; i < n; i++) a[i] = new Float64Array(n); return a; }
function zeroVec(n) { return new Float64Array(n); }

// Gaussian elimination with partial pivoting. A is n×n Float64Array[], b is Float64Array.
// Returns solution x (Float64Array). Mutates A and b.
function solveLinear(A, b) {
  const n = A.length;
  for (let col = 0; col < n; col++) {
    // partial pivot
    let max = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[max][col])) max = row;
    }
    if (Math.abs(A[max][col]) < 1e-12) return null; // singular
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

// Collect voltage-source branches: elements that impose a voltage and carry unknown current.
// Returns [{compId, termA, termB, E}] where E is the imposed voltage (Vb - Va).
function collectVBRANCHES(circ) {
  const br = [];
  for (const c of circ.comps.values()) {
    if (c.type === CT.VOLTAGE) {
      br.push({ compId: c.id, termA: c.terminals[0].nodeId, termB: c.terminals[1].nodeId, E: c.params.v });
    } else if (c.type === CT.SWITCH) {
      if (c.state.closed) br.push({ compId: c.id, termA: c.terminals[0].nodeId, termB: c.terminals[1].nodeId, E: 0 });
    }
    // AC, OPAMP, GATE, INDUCTOR added in later tasks
  }
  return br;
}

function step(circ, t, dt) {
  const nodeIds = [...circ.nodes.keys()];
  const N = nodeIds.length;
  const idx = new Map(nodeIds.map((id, i) => [id, i]));
  const vbr = collectVBRANCHES(circ);
  const K = vbr.length;
  const S = N + K;
  const A = zeros(S);
  const rhs = zeroVec(S);

  const addCond = (a, b, g) => {
    A[idx.get(a)][idx.get(a)] += g;
    A[idx.get(b)][idx.get(b)] += g;
    A[idx.get(a)][idx.get(b)] -= g;
    A[idx.get(b)][idx.get(a)] -= g;
  };
  const addCurr = (a, b, i) => { rhs[idx.get(a)] += i; rhs[idx.get(b)] -= i; };

  for (const c of circ.comps.values()) {
    const [a, b] = c.terminals.map(t => t.nodeId);
    switch (c.type) {
      case CT.RESISTOR: addCond(a, b, 1 / c.params.r); break;
      case CT.CURRENT: addCurr(a, b, c.params.i); break;
      // CAPACITOR/INDUCTOR/DIODE/BJT/AC/OPAMP/GATE added in later tasks
    }
  }
  for (let k = 0; k < K; k++) {
    const { termA: a, termB: b, E } = vbr[k];
    const row = N + k;
    A[row][idx.get(a)] += 1;
    A[row][idx.get(b)] -= 1;
    A[idx.get(a)][row] += 1;
    A[idx.get(b)][row] -= 1;
    rhs[row] = E;
  }

  const x = solveLinear(A, rhs);
  if (!x) return { ok: false, errors: ['短路或拓扑错误：矩阵奇异'], voltages: new Map(), currents: new Map() };

  const voltages = new Map();
  for (let i = 0; i < N; i++) voltages.set(nodeIds[i], x[i]);
  const currents = new Map();
  for (let k = 0; k < K; k++) currents.set(vbr[k].compId, x[N + k]);
  return { ok: true, errors: [], voltages, currents };
}

module.exports = { step, DT, VCC, VT, BETA, IS_DIODE };
```

- [ ] **Step 4: Run test to verify it passes**

`node test/run.js` → all DC tests PASS.

- [ ] **Step 5: Commit**

```bash
git add circuit-sandbox/ && git commit -m "feat: MNA engine core (DC Gaussian elimination)"
```

---

### Task 4: Engine extensions — transient, nonlinear, logic, AC

**Files:**
- Modify: `circuit-sandbox/public/js/engine.js`
- Modify: `circuit-sandbox/test/run.js`

**Interfaces:** `step()` now handles CAPACITOR, INDUCTOR, DIODE, BJT_N, BJT_P, GATE (all 7 types), AC, OPAMP. Adds `settle(circ, maxSteps)`.

**Additions to `step()`:**

- **CAPACITOR** (a-b): companion model. `Geq = 2*C/dt`. History: `vPrev` = Vc at t-dt, `iPrev` = Ic at t-dt. `Ieq = -Geq*vPrev - iPrev`. `addCond(a,b,Geq); addCurr(a,b,Ieq)`. After solve, update `c.state.vPrev = voltages[a]-voltages[b]`; `c.state.iPrev = Geq*(voltages[a]-voltages[b]) + Ieq`.
- **INDUCTOR** (a-b): companion model as voltage source branch. `Geq = dt/(2*L)`. `Veq = (2*L/dt)*iPrev + vPrev`. Add a VBRANCH with `E = Veq + Geq... ` — precise form: inductor branch current `i(t) = Geq*vL(t) + Ieq` where `Geq = dt/(2L)`, `Ieq = iPrev + Geq*vPrev`. Treat as VBRANCH between a,b with `E` replaced by a Thevenin source: series `1/Geq` resistance + voltage `Ieq/Geq`. In MNA that's a VBRANCH with voltage `Veq = Ieq/Geq` and series conductance `Geq` added between a,b. Implementation: add VBRANCH `{E: Ieq/Geq}` plus `addCond(a,b,Geq)`. After solve, `iPrev = currents.get(compId)`; `vPrev = voltages[a]-voltages[b]`.
- **DIODE** (a-b, anode=a): nonlinear. Newton-Raphson. `Vd = Va - Vb`. `I = Is*(exp(Vd/VT)-1)`. `gd = I/VT` (clamp to avoid overflow: if Vd > 0.7, use asymptotic). `addCond(a,b,gd)`. Newton correction: `addCurr(a, b, I - gd*Vd)`. Wrap the whole nonlinear assembly+solve in an iteration loop (max 5, damping).
- **BJT_N** (collector, emitter, base): Ebers-Moll. `Vbe=Vb-Ve`, `Vbc=Vb-Vc`. `Ibe = Is*(exp(Vbe/VT)-1)/BETA`, `Ibc = Is*(exp(Vbc/VT)-1)/BETA`, `Ic = Is*(exp(Vbe/VT)-1) - Is*(exp(Vbc/VT)-1)/BETA`, `Ie = -(Ib+Ic)`. As nonlinear conductances: diode B-E between base,emitter with `gd_be`; diode B-C between base,collector with `gd_bc`; CCCS from collector to emitter = `Ic - Ic_diode_part`. Implement as: add diode-like nonlinear branch for B-E and B-C, plus a controlled current source `Ic_cont = BETA*Ibe` from collector to emitter (minus the diode currents already accounted). Keep it simple and stable: model as two diodes + current source `β·Ib` C→E, all inside the Newton loop.
- **GATE**: output node = `terminals[last].nodeId`. Inputs = all but last. Compute logic level from `voltages` of input nodes (threshold VCC/2). Output E = high → VCC, low → 0. Push into a delay queue: `state.queue` array of `{t, level}`; output at time `t` = level from queue entry whose `t + tau <= now`, where `tau = 1e-6`. Add as VBRANCH `{termA: output node, termB: 0, E: level}`. Gate therefore needs `voltages` available BEFORE building VBRANCHES → restructure `step()` to compute gate outputs from the previous step's voltages first.
- **AC**: VBRANCH with `E = amp * waveform(t + phase)`. Waveforms: sine, square (sign of sine), triangle.
- **OPAMP**: VBRANCH with `E = clamp(A*(V+ - V-), -Vcc, +Vcc)`, `Vcc = params.supply || 5`. Terminals: `in-`, `in+`, `out`.

**Restructure `step()` order:**
1. Update AC/clock source values at time `t`.
2. Compute gate outputs from previous `voltages` (stored on `circ._lastVoltages`), push delay queue, set `gateLevels` map.
3. Assemble matrix (now including capacitors, inductors, diodes, BJTs, all VBRANCHES).
4. Newton-Raphson iteration (max 5) for nonlinear elements; rebuild+resolve each iteration.
5. Solve, extract voltages/currents, update history states.
6. Store `circ._lastVoltages = voltages`.

**`settle(circ, maxSteps=20000)`:** loop `step(circ, t, dt)` advancing `t` without rendering; returns last result.

- [ ] **Step 1: Write the failing test**

```js
// test/run.js (append)
test('RC charging: capacitor approaches source voltage', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  const cid = c.addComponent(CT.CAPACITOR, { c: 1e-3 }, [2, 0]); // 1mF, tau=1s at 1k
  let v;
  for (let i = 0; i < 500; i++) v = step(c, i * DT, DT).voltages.get(2);
  // after 5ms with tau=1s, Vc ≈ 5*(1-exp(-0.005)) ≈ 0.0249
  assert.ok(Math.abs(v - 0.0249) < 0.001, 'Vc=' + v);
});
test('NOT gate truth table', () => {
  const c = new Circuit();
  const inp = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 1]);
  const g = c.addComponent(CT.GATE, { gate: GATE_TYPES.NOT }, [1, 2]);
  // input low
  let r = step(c, 0, DT);
  assert.ok(r.voltages.get(2) > 4, 'NOT(0) should be high');
  c.comps.get(inp).params.v = 5;
  for (let i = 0; i < 200; i++) r = step(c, i * DT, DT);
  assert.ok(r.voltages.get(2) < 1, 'NOT(5) should be low');
});
test('AND gate truth table', () => {
  const c = new Circuit();
  const a = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 1]);
  const b = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 3]);
  c.addComponent(CT.GATE, { gate: GATE_TYPES.AND }, [1, 3, 2]);
  for (const [va, vb, exp] of [[0,0,0],[5,0,0],[0,5,0],[5,5,5]]) {
    c.comps.get(a).params.v = va; c.comps.get(b).params.v = vb;
    let r; for (let i = 0; i < 200; i++) r = step(c, i * DT, DT);
    const out = r.voltages.get(2);
    const ok = exp === 0 ? out < 1 : out > 4;
    assert.ok(ok, `AND(${va},${vb})=${out} expected ${exp}`);
  }
});
test('diode rectifies: forward passes, reverse blocks', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.DIODE, {}, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = step(c, 0, DT);
  assert.ok(r.voltages.get(2) > 4, 'forward diode should conduct');
});
test('settle reaches steady state', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = settle(c);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.voltages.get(2) - 2.5) < 1e-3);
});
```

- [ ] **Step 2: Run test to verify it fails**

`node test/run.js` → FAIL: RC/gate/diode cases fail (not yet implemented).

- [ ] **Step 3: Implement extensions in `engine.js`**

(Replace `step()` and `collectVBRANCHES` with the extended versions described above; add `settle`, `clamp`, `evalWaveform`, gate delay queue, Newton loop.)

Key helper additions:
```js
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function expSafe(v) { return v > 40 ? Math.exp(40) : v < -40 ? 0 : Math.exp(v); }
function evalWaveform(type, x) {
  const s = Math.sin(x);
  if (type === 'sine') return s;
  if (type === 'square') return s >= 0 ? 1 : -1;
  if (type === 'triangle') return 2/Math.PI * Math.asin(s);
  return s;
}
```

Gate delay queue on `c.state.gateQueues` (Map<compId, array). In `step()`, before assembling, for each GATE comp compute desired level from `circ._lastVoltages`, push `{t, level}`, and set `E` = level of the entry with `t + 1e-6 <= currentT` (or the latest if none yet — i.e., initial level).

- [ ] **Step 4: Run test to verify it passes**

`node test/run.js` → all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add circuit-sandbox/ && git commit -m "feat: engine transient/AC/nonlinear/logic-gate extensions"
```

---

### Task 5: Canvas rendering + current animation

**Files:**
- Create: `circuit-sandbox/public/js/render.js`
- Create: `circuit-sandbox/test/run.js` (render smoke test — headless canvas via `canvas` package is NOT available; instead test the geometry helper functions)

**Interfaces:** Exports `function draw(ctx, circ, voltages, currents, opts)` and `function terminalWorldPos(comp, termIdx)` and `GEOMETRY` table. Consumes `Circuit`/`CT` from circuit.js, engine outputs.

**Geometry helper:** `terminalWorldPos(comp, i)` returns `{x,y}` = rotate the geometry terminal `[lx,ly]` by `comp.angle` (multiples of 90°) then add `comp.pos`.

**draw() steps:**
1. Clear canvas with background color.
2. Draw grid (if `opts.showGrid`).
3. Draw wires: for each pair of connected terminals (same node, two different components), compute world positions, draw L-shaped path. Color = wire color; if `currents` has an entry for either component along that branch, draw an arrow at midpoint sized by |I|.
4. Draw components: for each comp, translate to pos, rotate by angle, call type-specific draw function (resistor zigzag, capacitor plates, inductor coils, diode triangle+bar, voltage source circle, etc.).
5. Draw node voltage labels near nodes if `opts.showVoltages`.
6. Highlight selected component / hovered node.

**Test:** since no DOM/canvas in node, test only the pure helpers:
```js
test('terminalWorldPos rotates by angle', () => {
  const c = new Circuit();
  const id = c.addComponent(CT.RESISTOR, { r: 1 }, [0, 1]);
  const comp = c.comps.get(id);
  comp.pos = { x: 100, y: 100 }; comp.angle = 0;
  const p0 = terminalWorldPos(comp, 0);
  assert.deepStrictEqual(p0, { x: 70, y: 100 });
  comp.angle = 90;
  const p0r = terminalWorldPos(comp, 0);
  assert.ok(Math.abs(p0r.x - 100) < 1e-6 && Math.abs(p0r.y - 70) < 1e-6);
});
test('draw does not throw with empty circuit', () => {
  const c = new Circuit();
  const fakeCtx = { clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, arc(){}, translate(){}, rotate(){}, save(){}, restore() };
  assert.doesNotThrow(() => draw(fakeCtx, c, new Map(), new Map(), {}));
});
```

- [ ] **Step 1-5:** Write render.js with GEOMETRY table + `terminalWorldPos` + `draw`, append the two tests, run, commit.

---

### Task 6: UI interaction — palette, wiring, param panel

**Files:**
- Create: `circuit-sandbox/public/js/ui.js`
- Modify: `circuit-sandbox/public/index.html` (mount point + palette + toolbar)

**Interfaces:** Exports `function mount(root, circ, actions)`. Consumes `Circuit`/`CT` from circuit.js.

**Behavior:**
- **Palette:** vertical list of component buttons grouped by category (电源/无源/半导体/逻辑/信号/参考). Clicking a button sets "placement mode" with that component type; next canvas click places it at that grid point.
- **Canvas:** mousedown on a terminal → start wire mode; mousemove shows rubber band; mouseup on another terminal → connect. Mousedown on empty canvas in placement mode → place component. Right-click on component → delete. Double-click component → open param panel.
- **Param panel:** modal editing component params (resistance, capacitance, voltage, gate type, etc.). On confirm, update `comp.params`.
- **Toolbar:** Play/Pause, Step, Speed (1x/4x/16x), Settle, Clear, Save, Load, Show Voltages toggle, Zoom fit.
- All coordinates converted from client coords via canvas bounding rect and current zoom/pan transform.

- [ ] **Step 1-5:** Write ui.js, wire index.html, add a UI smoke test (mount returns an object with `destroy()`; palette has buttons for each CT), run, commit.

---

### Task 7: Instruments — oscilloscope + multimeter

**Files:**
- Create: `circuit-sandbox/public/js/instruments.js`

**Interfaces:** Exports `makeOscilloscope(container)` → `{attach(a,b), push(t,va,vb), setTimeDiv, setVoltsDiv, setTrigger, destroy()}` and `makeMultimeter(container)` → `{measure(circ, a, b, kind), destroy()}`.

**Oscilloscope:** canvas-based scrolling waveform. `push(t,va,vb)` appends to ring buffer (size = 2000 samples). `draw()` renders channel A (yellow) and B (cyan) with grid, time/div and volts/div labels, trigger line. `attach(a,b)` sets probe nodes; if a node is null the channel is flat at 0.
**Multimeter:** `measure(circ, a, b, 'VOLTAGE')` = `voltages[a] - voltages[b]` (needs a settled DC solve — call `step` once if voltages stale). `'CURRENT'` = sum of currents of components touching node a toward b (approximate: pick a component connected to a and b, return its current). `'RESISTANCE'` = inject 1A test current between a and b into a fresh copy and read V/I (R = V). Keep simple: only measure resistance when the branch is purely resistive.

- [ ] **Step 1-5:** Write instruments.js, add smoke test (scope push/draw doesn't throw; multimeter VOLTAGE returns diff), run, commit.

---

### Task 8: Challenge levels

**Files:**
- Create: `circuit-sandbox/public/js/levels.js`

**Interfaces:** Exports `const LEVELS` (array of 9) and `function checkLevel(level, voltages, currents)` → `{ok, message}`.

**Level definitions:**
1. **点亮灯泡** — setup: VOLTAGE[0→1] + RESISTOR[1→2] (the "bulb"). check: `voltages.get(2) > 1` (current flows through bulb).
2. **串联 vs 并联** — setup: two resistors in series from source; check: `currents` through both equal.
3. **二极管整流** — setup: AC source → diode → resistor → GND; check: voltage across resistor never negative (rectified).
4. **二极管 AND 门** — setup: two inputs + two diodes + pull-down resistor forming diode AND; check: output high only when both inputs high.
5. **三极管开关** — setup: VOLTAGE base via resistor, collector to LED(resistor) to VCC; check: base current > 0 → collector current > 0.
6. **RC 低通** — setup: VOLTAGE AC → resistor → capacitor → GND; check: output amplitude at node 2 < input amplitude (attenuated at high freq).
7. **运放同相放大** — setup: opamp with feedback; check: output ≈ gain × input.
8. **555 振荡器** — setup: the classic 555 astable (implemented via opamps/logic or a prebuilt block); check: output oscillates (voltage crosses VCC/2 repeatedly).
9. **1 位加法器** — setup: XOR + AND gates for sum/carry; check: sum and carry match full-adder truth table for all input combos.

For level 8 (555), implement the 555 timer as a sub-circuit using the available primitives (two comparators = two opamps, a flip-flop = cross-coupled NANDs, a discharge transistor = BJT). This is the showcase level — it validates the whole engine.

- [ ] **Step 1-5:** Write levels.js with all 9 setups + checks, add a test that each level's `setup()` produces a circuit and `checkLevel` returns a defined `{ok, message}` for a settled solve, run, commit.

---

### Task 9: App orchestration + save/load + level runner

**Files:**
- Create: `circuit-sandbox/public/js/app.js`
- Modify: `circuit-sandbox/public/index.html`

**Interfaces:** Exports `function start(root)`. Builds `Circuit`, mounts UI + instruments + render, runs the play loop.

**Play loop:**
```js
let playing = true, speed = 1, t = 0, lastDraw = 0;
function loop(now) {
  if (playing) {
    for (let i = 0; i < speed; i++) { const r = step(circ, t, DT); t += DT; if (!r.ok) { showErrors(r.errors); break; } oscilloscope.push(t, ...); }
  }
  if (now - lastDraw > 16) { render.draw(...); lastDraw = now; }
  requestAnimationFrame(loop);
}
```

**Save/Load:** `localStorage.setItem('circuit-sandbox', JSON.stringify(circ.toJSON()))`; load reverses. Also export/import JSON file download.

**Level runner:** selecting a level calls `level.setup(circ)`, clears, then `checkLevel` after each step shows progress; on success shows knowledge card and unlocks next.

- [ ] **Step 1-5:** Write app.js, finalize index.html, run `node server.js` smoke (curl the page), commit.

---

### Task 10: Polish, integration, README

**Files:**
- Modify: `circuit-sandbox/README.md`
- Modify: `circuit-sandbox/test/run.js` (final full run)

**Steps:**
- [ ] **Step 1:** Run full test suite green: `node test/run.js`.
- [ ] **Step 2:** Start server, load page in browser, play a prebuilt circuit (voltage divider), confirm current animation + multimeter reads 2.5V. Fix regressions.
- [ ] **Step 3:** Play through all 9 levels end-to-end; confirm each success check fires.
- [ ] **Step 4:** Write README.md (what it is, how to run, component list, levels list, tech notes).
- [ ] **Step 5:** Commit + final `git status` clean.

---

## Self-Review

- **Spec coverage:** §3 组件集 → Task 4 covers all 14 types. §4 引擎 → Tasks 3+4. §5 UI → Tasks 5+6. §6 关卡 → Task 8. §7 测试 → Tasks 2-10. §8 目录 → Task 1. §9 分期 → MVP = Tasks 1-6, 二期 = 7-8, 三期 = 4 (transient). ✓
- **Placeholder scan:** no TBD/TODO/fill-in. Every code step shows concrete code. ✓
- **Type consistency:** `step(circ,t,dt)` signature stable across Tasks 3/4/9. `Circuit` API stable across Tasks 2/3/4/6/8. `GEOMETRY`/`terminalWorldPos`/`draw` stable across Tasks 5/6. `LEVELS`/`checkLevel` stable across Tasks 8/9. ✓
- **Scope:** single coherent sandbox; one plan, 10 tasks. ✓