import { Game } from './game/Game.js';

const canvas = document.getElementById('game-canvas');
const loading = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');

function showBootFailure(error) {
  console.error('THE HOLLOW SIGNAL failed to start:', error);
  if (!loading) return;
  loading.classList.remove('is-hidden');
  loading.classList.remove('is-leaving');
  if (loadingStatus) {
    loadingStatus.textContent = 'The archive could not be mounted.';
  }
  const percent = document.getElementById('loading-percent');
  if (percent) percent.textContent = 'ERROR';
  const log = document.getElementById('loading-log');
  if (log) {
    log.textContent = 'WebGL2 is required. If the problem persists, reload the page.\n' +
      String(error && error.message ? error.message : error);
  }
}

try {
  if (!canvas) throw new Error('Game canvas is missing from index.html.');
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) throw new Error('This browser does not provide WebGL2.');
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
} catch (error) {
  showBootFailure(error);
}
