'use strict';
/* SYNAPSE · 内置数据集（全部确定性可复现） */
(function (root) {
  'use strict';
  const R = (typeof require !== 'undefined') ? require('./rng.js') : root.Synapse.rng;
  const T = (typeof require !== 'undefined') ? require('./tictactoe.js') : root.Synapse.tictactoe;
  const { createRng, randn } = R;

  // 5x7 位图字体（0-9）：手写数字数据集的"字模"
  const GLYPHS = {
    '0': ['01110','10001','10011','10101','11001','10001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00010','00100','01000','11111'],
    '3': ['11111','00010','00100','00010','00001','10001','01110'],
    '4': ['00100','01100','10100','11111','00100','00100','00100'],
    '5': ['11111','10000','11110','00001','00001','10001','01110'],
    '6': ['00110','01000','10000','11110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00010','01100']
  };
  function glyphArray(digit) {
    const rows = GLYPHS[String(digit)];
    const out = new Array(35).fill(0);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) out[r * 5 + c] = rows[r][c] === '1' ? 1 : 0;
    return out;
  }

  function makeXor() {
    return {
      inputs: [[0,0],[0,1],[1,0],[1,1]],
      targets: [[0],[1],[1],[0]]
    };
  }

  function makeMoons(n, seed, noise) {
    n = n || 120; noise = noise == null ? 0.12 : noise;
    const rng = createRng(seed == null ? 1 : seed);
    const half = Math.floor(n / 2);
    const inputs = [], targets = [];
    for (let i = 0; i < n; i++) {
      const c = i % 2;
      const k = Math.floor(i / 2);
      const t = (k / half) * Math.PI;
      const nx = randn(rng) * noise, ny = randn(rng) * noise;
      let x, y;
      if (c === 0) { x = Math.cos(t) + nx; y = Math.sin(t) + 0.3 + ny; }
      else { x = 1 - Math.cos(t) + nx; y = 0.5 - Math.sin(t) + ny; }
      inputs.push([x, y]);
      targets.push([c === 0 ? 1 : 0]);
    }
    return { inputs: inputs, targets: targets };
  }

  function makeSpiral(n, seed) {
    n = n || 140;
    const rng = createRng(seed == null ? 1 : seed);
    const half = Math.floor(n / 2);
    const inputs = [], targets = [];
    for (let i = 0; i < n; i++) {
      const c = i % 2;
      const k = Math.floor(i / 2);
      const t = (k / half) * 3 * Math.PI + (c === 0 ? 0 : Math.PI);
      const r = (k / half) * 1.0;
      inputs.push([r * Math.cos(t) + randn(rng) * 0.05, r * Math.sin(t) + randn(rng) * 0.05]);
      targets.push([c === 0 ? 1 : 0]);
    }
    return { inputs: inputs, targets: targets };
  }

  function makeDigits(samplesPerClass, seed) {
    samplesPerClass = samplesPerClass || 60;
    const rng = createRng(seed == null ? 1 : seed);
    const inputs = [], targets = [];
    for (let d = 0; d < 10; d++) {
      const base = glyphArray(d);
      for (let s = 0; s < samplesPerClass; s++) {
        const dx = Math.floor(rng() * 3) - 1;
        const dy = Math.floor(rng() * 3) - 1;
        const arr = new Array(35).fill(0);
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 5; c++) {
            const rr = r - dy, cc = c - dx;
            let v = 0;
            if (rr >= 0 && rr < 7 && cc >= 0 && cc < 5) v = base[rr * 5 + cc];
            if (v && rng() < 0.04) v = 0;
            else if (!v && rng() < 0.01) v = 1;
            arr[r * 5 + c] = v;
          }
        }
        inputs.push(arr);
        const t = new Array(10).fill(0);
        t[d] = 1;
        targets.push(t);
      }
    }
    return { inputs: inputs, targets: targets };
  }

  function makeTicTacToe(n, seed) { return T.makeDataset(n, seed); }

  const DATASETS = {
    xor: {
      id: 'xor', name: 'XOR 异或', desc: '「线性不可分」的经典入门题：一条直线永远分不开两类点',
      in: 2, out: 1, outAct: 'sigmoid', viz: 'boundary', axis: '0~1',
      preset: { layers: [2, 4, 1], hiddenAct: 'sigmoid', loss: 'ce', lr: 0.6, momentum: 0.9, batchSize: 4, epochs: 300, seed: 7 },
      make: makeXor
    },
    moons: {
      id: 'moons', name: '双月 MOONS', desc: '两个月牙交错：需要网络学会弯曲的决策边界',
      in: 2, out: 1, outAct: 'sigmoid', viz: 'boundary', axis: '-1~2',
      preset: { layers: [2, 8, 1], hiddenAct: 'tanh', loss: 'ce', lr: 0.15, momentum: 0.9, batchSize: 8, epochs: 300, seed: 7 },
      make: function (seed) { return makeMoons(120, seed); }
    },
    spiral: {
      id: 'spiral', name: '螺旋 SPIRAL', desc: '最难的二维数据集：两类点像 DNA 一样缠绕，考验网络容量',
      in: 2, out: 1, outAct: 'sigmoid', viz: 'boundary', axis: '-1~1',
      preset: { layers: [2, 16, 1], hiddenAct: 'tanh', loss: 'ce', lr: 0.08, momentum: 0.9, batchSize: 16, epochs: 500, seed: 7 },
      make: function (seed) { return makeSpiral(140, seed); }
    },
    digits: {
      id: 'digits', name: '手写数字 DIGITS', desc: '35 像素的位图数字（带随机平移与噪声），一窥「图像识别」',
      in: 35, out: 10, outAct: 'softmax', viz: 'digits', axis: null,
      preset: { layers: [35, 20, 10], hiddenAct: 'tanh', loss: 'ce', lr: 0.2, momentum: 0.9, batchSize: 32, epochs: 140, seed: 7 },
      make: function (seed) { return makeDigits(60, seed); }
    },
    tictactoe: {
      id: 'tictactoe', name: '井字棋 TIC-TAC-TOE', desc: '向 minimax 完美教师学习，再与它对弈：看看网络学会了多少棋理',
      in: 9, out: 9, outAct: 'softmax', viz: 'tictactoe', axis: null,
      preset: { layers: [9, 24, 9], hiddenAct: 'tanh', loss: 'ce', lr: 0.25, momentum: 0.9, batchSize: 32, epochs: 200, seed: 7 },
      make: function (seed) { return makeTicTacToe(500, seed); }
    }
  };

  const api = { DATASETS: DATASETS, GLYPHS: GLYPHS, glyphArray: glyphArray, makeXor: makeXor, makeMoons: makeMoons, makeSpiral: makeSpiral, makeDigits: makeDigits, makeTicTacToe: makeTicTacToe };
  root.Synapse = root.Synapse || {};
  root.Synapse.datasets = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
