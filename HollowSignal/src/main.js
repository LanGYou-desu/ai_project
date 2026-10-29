import { Game } from './game/Game.js';

const canvas = document.getElementById('game-canvas');
const loading = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');

function showBootFailure(error) {
  console.error('空洞信号启动失败：', error);
  if (!loading) return;
  loading.classList.remove('is-hidden');
  loading.classList.remove('is-leaving');
  if (loadingStatus) {
    loadingStatus.textContent = '声学档案无法挂载。';
  }
  const percent = document.getElementById('loading-percent');
  if (percent) percent.textContent = '错误';
  const log = document.getElementById('loading-log');
  if (log) {
    log.textContent = '需要 WebGL2。如果问题仍然存在，请重新加载页面。\n' +
      String(error && error.message ? error.message : error);
  }
}

async function boot() {
  if (!canvas) throw new Error('index.html 中缺少游戏画布。');
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) throw new Error('此浏览器不提供 WebGL2。');

  // The station signage and notes are painted onto canvas textures. Wait for
  // the bundled CJK faces so Chinese glyphs are present in the first bake.
  if (document.fonts) {
    await Promise.allSettled([
      document.fonts.load('500 32px "Noto Sans SC"'),
      document.fonts.load('300 64px "Noto Serif SC"')
    ]);
    await document.fonts.ready;
  }

  const game = new Game(canvas);
  window.__hollow = game;
  window.HOLLOW_SIGNAL = {
    version: '1.0.0',
    getState: () => game.getState(),
    debugChapter: (index, options) => game.debugChapter(index, options),
    debugTeleport: (x, z, yaw, pitch) => game.debugTeleport(x, z, yaw, pitch),
    debugUseNearest: () => game.debugUseNearest(),
    debugCompleteChapter: () => game.debugCompleteChapter(),
    debugChoice: (id) => game.debugChoice(id)
  };
}

boot().catch(showBootFailure);
