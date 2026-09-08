// 墨战 · 天书纪 — 剧情路线判定（隐藏结局）
(function (g) {
  'use strict';

  // 本次路线选择「问天」时，「人」字结局会转为隐藏结局「问天者」。
  // 只依赖本次路线的标记，不再依赖历史 cleared 记录——否则一旦通关过 ch6b，
  // 承墨者结局会被永久劫持，end_hengmo / endings_all 成就再也无法达成。
  function resolveEnding(endingId, flags) {
    if (endingId === 'hengmo' && flags && flags.wenyin) return 'wenyin';
    return endingId;
  }

  g.INK_STORYFLOW = { resolveEnding };
})(typeof globalThis !== 'undefined' ? globalThis : this);
