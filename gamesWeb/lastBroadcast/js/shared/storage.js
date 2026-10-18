/* LASTBROADCAST · 安全 localStorage 封装（E4） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LB = root.LB || {}; root.LB.storage = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var mem = {};
  var available = true;
  try {
    var k = '__lb_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
  } catch (e) { available = false; }
  function get(key) {
    try { if (available) { var v = window.localStorage.getItem(key); return v === null ? null : v; } } catch (e) {}
    return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
  }
  function set(key, val) {
    try { if (available) { window.localStorage.setItem(key, String(val)); return; } } catch (e) {}
    mem[key] = String(val);
  }
  function remove(key) {
    try { if (available) { window.localStorage.removeItem(key); return; } } catch (e) {}
    delete mem[key];
  }
  return { get: get, set: set, remove: remove, available: available };
});
