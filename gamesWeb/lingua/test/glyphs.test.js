const { test } = require('node:test');
const assert = require('node:assert');
const glyphs = require('../js/glyphs.js');
const lex = require('../js/shared/lexicon.js');

function shapeOk(p) {
  return p && Array.isArray(p.lines) && Array.isArray(p.circles) && Array.isArray(p.arcs) &&
    p.lines.every(l => l.length === 4 && l.every(Number.isFinite)) &&
    p.circles.every(c => c.length === 3 && c.every(Number.isFinite)) &&
    p.arcs.every(a => a.length === 5 && a.every(Number.isFinite));
}

test('每个词汇都有专属象形字形（不再退回随机纹理）', () => {
  const missing = lex.LEXICON.filter(e => !glyphs.hasGlyph(e.gloss)).map(e => e.gloss);
  assert.deepStrictEqual(missing, [], '缺少字形图元: ' + missing.join(' '));
  assert.strictEqual(lex.LEXICON.length, 124);
});

test('所有字形图元坐标合法且在画布范围内', () => {
  lex.LEXICON.forEach(e => {
    const p = glyphs.pictogram(e.gloss);
    assert.ok(shapeOk(p), e.gloss + ' 字形结构应完整');
    assert.ok(p.lines.length + p.circles.length + p.arcs.length > 0, e.gloss + ' 字形不应为空');
    p.lines.forEach(l => l.forEach(v => assert.ok(v >= -0.01 && v <= 1.01, e.gloss + ' 坐标越界: ' + v)));
    p.circles.forEach(c => {
      assert.ok(c[2] > 0 && c[2] <= 0.5, e.gloss + ' 半径异常: ' + c[2]);
      assert.ok(c[0] - c[2] >= -0.01 && c[0] + c[2] <= 1.01 && c[1] - c[2] >= -0.01 && c[1] + c[2] <= 1.01, e.gloss + ' 圆形越界');
    });
  });
});

test('未收录词义仍有确定性兜底字形', () => {
  const a = glyphs.pictogram('不存在的词');
  const b = glyphs.pictogram('不存在的词');
  assert.ok(shapeOk(a));
  assert.ok(a.lines.length >= 1);
  assert.deepStrictEqual(a, b, '兜底字形必须可复现');
  assert.strictEqual(glyphs.hasGlyph('不存在的词'), false);
});

test('字形图元被缓存复用（重绘不再重建数组）', () => {
  const a = glyphs.pictogram('水');
  const b = glyphs.pictogram('水');
  assert.strictEqual(a, b, '同一词义应返回同一份图元');
  const m1 = glyphs.scriptMark('woda');
  const m2 = glyphs.scriptMark('woda');
  assert.strictEqual(m1, m2);
  assert.notStrictEqual(glyphs.scriptMark('woda'), glyphs.scriptMark('wode'));
});
