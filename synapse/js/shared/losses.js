'use strict';
/* SYNAPSE · 损失函数与度量 */
(function (root) {
  'use strict';
  function lossValue(loss, pred, target) {
    if (loss === 'mse') {
      let s = 0;
      for (let i = 0; i < pred.length; i++) { const d = pred[i] - target[i]; s += d * d; }
      return s / pred.length;
    }
    if (loss === 'ce') {
      if (target.length === 1) {
        const p = Math.min(Math.max(pred[0], 1e-12), 1 - 1e-12);
        return -(target[0] * Math.log(p) + (1 - target[0]) * Math.log(1 - p));
      }
      let s = 0;
      for (let i = 0; i < pred.length; i++) {
        if (target[i] > 0) s -= target[i] * Math.log(Math.max(pred[i], 1e-12));
      }
      return s;
    }
    throw new Error('未知损失函数: ' + loss);
  }
  function argmax(a) {
    let b = 0;
    for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i;
    return b;
  }
  function accuracy(preds, targets) {
    let ok = 0;
    for (let i = 0; i < preds.length; i++) if (argmax(preds[i]) === argmax(targets[i])) ok++;
    return ok / preds.length;
  }
  function mean(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }
  const api = { lossValue: lossValue, argmax: argmax, accuracy: accuracy, mean: mean };
  root.Synapse = root.Synapse || {};
  root.Synapse.losses = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
