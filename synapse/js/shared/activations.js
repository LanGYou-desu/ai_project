'use strict';
/* SYNAPSE · 激活函数（f 与导数 df；df 接收激活后的输出 y） */
(function (root) {
  'use strict';
  const ACTIVATIONS = {
    sigmoid:  { f: function (x) { return 1 / (1 + Math.exp(-x)); }, df: function (y) { return y * (1 - y); } },
    tanh:     { f: function (x) { return Math.tanh(x); },          df: function (y) { return 1 - y * y; } },
    relu:     { f: function (x) { return x > 0 ? x : 0; },         df: function (y) { return y > 0 ? 1 : 0; } },
    leaky:    { f: function (x) { return x > 0 ? x : 0.01 * x; },  df: function (y) { return y > 0 ? 1 : 0.01; } },
    identity: { f: function (x) { return x; },                     df: function () { return 1; } }
  };
  const NAMES = Object.keys(ACTIVATIONS);
  function act(name, x) { return ACTIVATIONS[name].f(x); }
  function dact(name, y) { return ACTIVATIONS[name].df(y); }
  const api = { ACTIVATIONS: ACTIVATIONS, NAMES: NAMES, act: act, dact: dact };
  root.Synapse = root.Synapse || {};
  root.Synapse.activations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
