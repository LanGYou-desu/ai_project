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
  // 分类标签：单输出视为二分类（阈值 0.5），多输出取 argmax
  function labelOf(v) {
    if (v.length === 1) return v[0] >= 0.5 ? 1 : 0;
    return argmax(v);
  }
  function accuracy(preds, targets) {
    if (!preds.length) return 0;
    let ok = 0;
    for (let i = 0; i < preds.length; i++) if (labelOf(preds[i]) === labelOf(targets[i])) ok++;
    return ok / preds.length;
  }
  const api = { lossValue: lossValue, argmax: argmax, labelOf: labelOf, accuracy: accuracy };
  root.Synapse = root.Synapse || {};
  root.Synapse.losses = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
