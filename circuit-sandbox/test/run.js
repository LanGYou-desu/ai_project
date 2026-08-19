'use strict';
// 电路沙盒 测试套件（node:test 风格，零依赖）
const assert = require('assert');
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '  ——  ' + e.message);
  }
}
console.log('电路沙盒测试套件');
// 各任务的测试将在对应模块实现后追加于此。
console.log('通过 ' + passed + '，失败 ' + failed);
if (failed) process.exit(1);