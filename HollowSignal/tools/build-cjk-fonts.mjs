import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = [
  'index.html',
  'styles.css',
  'src/main.js',
  'src/story/content.js',
  'src/ui/UI.js',
  'src/game/Game.js',
  'src/world/Chapter1.js',
  'src/world/Chapter2.js',
  'src/world/Chapter3.js',
  'src/world/Chapter4.js',
  'src/world/ChapterKit.js',
  'src/world/BaseLevel.js',
  'src/world/Props.js',
  'src/world/Listener.js',
  'src/engine/Player.js',
  'src/engine/Settings.js'
];

const chars = new Set();
for (let i = 0x20; i <= 0x7e; i++) chars.add(String.fromCodePoint(i));
for (const code of [0x00a0, 0x00b7, 0x00d7, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x2192, 0x2248, 0x25a0, 0x25a4, 0x25a5]) {
  chars.add(String.fromCodePoint(code));
}
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const ch of text) {
    if (!/[\s\u0000-\u001f]/.test(ch)) chars.add(ch);
  }
}
const out = path.join(root, 'assets/fonts/.src/chars.txt');
fs.writeFileSync(out, [...chars].sort().join(''), 'utf8');
const cjk = [...chars].filter((ch) => /[\u3400-\u9fff\uf900-\ufaff]/.test(ch)).length;
console.log(`wrote ${chars.size} unique characters (${cjk} CJK) to ${out}`);
