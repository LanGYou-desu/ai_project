/* ECO-ARK · 存档格式（浏览器 + Node 双端 UMD）
 * 存档只保存「种子 + 操作日志 + 章节状态」，演化本身由重放重建。
 * 因此格式必须可校验、可向后兼容：
 *   - validate() 拒绝损坏 / 未来版本 / 字段缺失的数据，避免读档时崩溃；
 *   - deserializeState() 以 createState 的默认值兜底，旧存档缺新字段也能读。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.ECOARK = root.ECOARK || {}; root.ECOARK.savefile = factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var CHAPTERS = (typeof module === 'object' && module.exports)
    ? require('./chapters.js') : root.ECOARK.chapters;

  // v1：初版；v2：章节状态新增冰期年检字段（读 v1 存档时用默认值补齐）
  var VERSION = 2;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // 存档是否可安全读入（损坏 / 未来版本 / 字段缺失一律拒绝）
  function validate(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
    if (typeof d.v !== 'number' || d.v < 1 || d.v > VERSION) return false;
    if (d.mode !== 'campaign' && d.mode !== 'sandbox') return false;
    if (typeof d.seed !== 'string' || !d.seed) return false;
    if (!Array.isArray(d.actions)) return false;
    if (typeof d.month !== 'number' || !isFinite(d.month) || d.month < 0) return false;
    if (d.mode === 'campaign' && !CHAPTERS.byNo(d.chapter)) return false;
    if (d.eventChance != null && (typeof d.eventChance !== 'number' || !isFinite(d.eventChance))) return false;
    return true;
  }

  // 章节状态 → 可 JSON 序列化的纯数据
  function serializeState(st) {
    if (!st || typeof st !== 'object') return null;
    var o = {};
    for (var k in st) if (has(st, k)) o[k] = st[k];
    return o;
  }

  // 纯数据 → 章节状态（缺字段用默认值补齐）
  function deserializeState(o) {
    if (!o || typeof o !== 'object') return null;
    var st = CHAPTERS.createState(o.no || 1);
    for (var k in o) if (has(o, k)) st[k] = o[k];
    return st;
  }

  return {
    VERSION: VERSION,
    validate: validate,
    serializeState: serializeState,
    deserializeState: deserializeState
  };
});
