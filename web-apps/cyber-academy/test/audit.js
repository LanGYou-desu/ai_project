'use strict';
/* =========================================================
 * 文档与教学完整性审计
 * 检查: 命令文档覆盖 / 示例教学映射 / 教材领域覆盖 / 关卡教学配套
 * 用法: node test/audit.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');

global.document = {
  body: { dataset: {} },
  getElementById(id) {
    if (id === 'output') return outputEl;
    if (id === 'input') return inputEl;
    if (id === 'prompt') return promptEl;
    if (id === 'hud') return hudEl;
    if (id === 'matrix') return { width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, clearRect() {} }) };
    return null;
  },
  createElement(tag) {
    return {
      tagName: tag, className: '', textContent: '', children: [], style: {}, colSpan: 1,
      appendChild(c) { this.children.push(c); c.parentNode = this; },
      replaceWith() {},
      addEventListener() {},
    };
  },
  addEventListener() {},
};
global.window = { addEventListener() {} };
global.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
};

const files = [
  'js/crypto.js', 'js/core.js', 'js/tools.js', 'js/course.js', 'js/challenges.js', 'js/demo.js', 'js/docs.js', 'js/lab.js',
  'js/levels/level0.js', 'js/levels/level1.js', 'js/levels/level2.js',
  'js/levels/level3.js', 'js/levels/level4.js', 'js/levels/level5.js', 'js/levels/level6.js',
  'js/levels/level7.js', 'js/levels/level8.js', 'js/levels/level9.js',
  'js/main.js',
];
let code = '';
for (const f of files) code += '\n/* ===== ' + f + ' ===== */\n' + fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n';

code += `
;(function audit() {
  'use strict';
  var outputEl = { children: [], scrollTop: 0, innerHTML: '', appendChild(el) { this.children.push(el); }, addEventListener() {} };
  var inputEl = { value: '', addEventListener() {}, focus() {} };
  var promptEl = { textContent: '' };
  var hudEl = { textContent: '' };
  document.getElementById = function (id) {
    if (id === 'output') return outputEl;
    if (id === 'input') return inputEl;
    if (id === 'prompt') return promptEl;
    if (id === 'hud') return hudEl;
    if (id === 'matrix') return { width: 0, height: 0, getContext: function () { return { fillRect: function(){}, fillText: function(){}, clearRect: function(){} }; } };
    return null;
  };
  document.createElement = function (tag) {
    return { tagName: tag, className: '', textContent: '', children: [], style: {}, colSpan: 1, appendChild: function (c) { this.children.push(c); }, replaceWith: function () {}, addEventListener: function () {} };
  };
  Terminal.prototype.type = async function (t, c) { this.print(t, c); };
  Terminal.prototype.typeLines = async function (l, c) { l.forEach(function (x) { this.print(x, c); }, this); };
  Terminal.prototype.print = function (t, c) { return t; };
  T = new Terminal();

  var R = [];
  var check = function (n, c) { R.push([n, !!c]); };

  var README = require('fs').readFileSync(require('path').join(__dirname, '..', 'README.md'), 'utf8');
  var helpSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'core.js'), 'utf8');
  var docsAppendix = (DOC_APPENDIX[0] || {}).lines ? DOC_APPENDIX[0].lines.join(' ') : '';
  var docsAll = DOCBOOK.concat(DOC_APPENDIX).map(function (c) { return c.title + ' ' + c.lines.join(' '); }).join(' ');

  /* ---- 1. 命令文档覆盖: 每个全局命令必须出现在 docs 附录A + README ---- */
  var commands = Object.keys(GLOBAL_COMMANDS).concat(['clear']);
  var missingAppendix = commands.filter(function (c) { return docsAppendix.indexOf(c) === -1; });
  check('命令全覆盖 docs 附录A', missingAppendix.length === 0);
  if (missingAppendix.length) console.log('  docs 附录A 缺: ' + missingAppendix.join(', '));
  var missingReadme = commands.filter(function (c) { return README.indexOf(c) === -1; });
  check('命令全覆盖 README', missingReadme.length === 0);
  if (missingReadme.length) console.log('  README 缺: ' + missingReadme.join(', '));
  check('help 分层+检索+TAB提示', helpSrc.indexOf('分层') !== -1 && helpSrc.indexOf('检索') !== -1 && helpSrc.indexOf('Tab 可补全') !== -1);
  check('help 覆盖核心命令', ['scenario', 'browser', 'ai', 'panel', 'demo', 'docs', 'theme'].every(function (c) { return helpSrc.indexOf(c) !== -1; }));

  /* ---- 2. 示例教学映射 ---- */
  var demoTopics = DEMOS.map(function (d) { return d.topic; });
  var missingDemos = Object.keys(DEMO_FOR_LEVEL).filter(function (lvl) { return demoTopics.indexOf(DEMO_FOR_LEVEL[lvl]) === -1; });
  check('每关都有对应 demo', missingDemos.length === 0);
  if (missingDemos.length) console.log('  DEMO_FOR_LEVEL 缺: ' + missingDemos.join(', '));
  check('demo 主题互不重复', new Set(demoTopics).size === demoTopics.length);

  /* ---- 3. 教材领域覆盖 ---- */
  var required = ['网络', '密码', 'Web', '系统', '恶意软件', '取证', '蓝队', '云', 'AI', '逆向', '社会工程', '无线', '渗透测试', '职业', '移动', '工控'];
  var missingDocs = required.filter(function (k) { return docsAll.indexOf(k) === -1; });
  check('教材覆盖 15+ 领域', missingDocs.length === 0);
  if (missingDocs.length) console.log('  docs 缺领域: ' + missingDocs.join(', '));

  /* ---- 4. 关卡教学配套 ---- */
  check('每关教学配套完整', Game.levels.every(function (l) {
    return l.intro && l.brief && l.flag && l.objectives.length >= 3 &&
      Array.isArray(l.hints) && l.hints.length === 3 && l.learn && l.learn.length >= 3;
  }));
  check('关卡数 ≥ 10', Game.levels.length >= 10);
  check('每关有 demo 映射', Game.levels.every(function (l) { return DEMO_FOR_LEVEL[l.id] !== undefined; }));

  /* ---- 5. 扩展场景配套 ---- */
  var allScenarios = [];
  Game.levels.forEach(function (l) { if (l.scenarios) allScenarios = allScenarios.concat(l.scenarios); });
  check('场景配套完整', allScenarios.every(function (s) {
    return s.id && s.title && s.brief && s.flag && s.objectives.length >= 2 && s.hints && s.hints.length === 3;
  }));
  check('场景有独立 flag', allScenarios.every(function (s) { return /^flag\\{/.test(s.flag); }));

  /* ---- 6. 工具手册覆盖 ---- */
  var toolCmds = Object.keys(TOOL_MANUAL);
  check('工具手册覆盖 14 个工具', toolCmds.length >= 14);

  /* ---- 7. 课程完整性 ---- */
  check('课程 13 门×5 章', COURSES.length === 13 && COURSES.every(function (c) { return c.chapters.length === 5; }));
  check('每门课程有测验', COURSES.every(function (c) { return c.quiz.length === 3; }));

  /* ---- 8. 挑战完整性 ---- */
  check('挑战 20 个且答案唯一', CHALLENGES.length === 20 && new Set(CHALLENGES.map(function (c) { return c.answer; })).size === CHALLENGES.length);

  var pass = 0;
  R.forEach(function (r) { console.log((r[1] ? '  PASS  ' : '  FAIL  ') + r[0]); if (r[1]) pass++; });
  console.log('\\n' + pass + '/' + R.length + ' 项通过 (文档与教学完整性审计)');
  if (pass !== R.length) process.exit(1);
})();
`;
eval(code);
