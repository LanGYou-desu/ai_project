'use strict';
/* SYNAPSE · 井字棋规则与 minimax 教师 */
(function (root) {
  'use strict';
  const R = (typeof require !== 'undefined') ? require('./rng.js') : root.Synapse.rng;
  const { createRng } = R;

  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  function winner(board) {
    for (const ln of LINES) {
      const a = board[ln[0]], b = board[ln[1]], c = board[ln[2]];
      if (a !== 0 && a === b && b === c) return a;
    }
    return 0;
  }
  function legalMoves(board) {
    const m = [];
    for (let i = 0; i < 9; i++) if (board[i] === 0) m.push(i);
    return m;
  }
  function full(board) { return legalMoves(board).length === 0; }
  function minimaxScore(board, player) {
    const w = winner(board);
    if (w !== 0) return w === player ? 1 : -1;
    const moves = legalMoves(board);
    if (moves.length === 0) return 0;
    let best = -Infinity;
    for (const m of moves) {
      board[m] = player;
      const s = -minimaxScore(board, -player);
      board[m] = 0;
      if (s > best) best = s;
    }
    return best;
  }
  function bestMove(board, player, rng) {
    const moves = legalMoves(board);
    if (moves.length === 0) return -1;
    let best = -Infinity;
    const picks = [];
    for (const m of moves) {
      board[m] = player;
      const s = -minimaxScore(board, -player);
      board[m] = 0;
      if (s > best) { best = s; picks.length = 0; picks.push(m); }
      else if (s === best) picks.push(m);
    }
    if (rng) return picks[Math.floor(rng() * picks.length)];
    return picks[0];
  }
  function makeDataset(n, seed) {
    n = n || 400;
    const rng = createRng(seed == null ? 1 : seed);
    const inputs = [], targets = [];
    const seen = new Set();
    let guard = 0;
    while (inputs.length < n && guard < n * 20) {
      guard++;
      const board = new Array(9).fill(0);
      const states = [];
      let player = 1;
      let done = false;
      for (let step = 0; step < 9 && !done; step++) {
        const moves = legalMoves(board);
        if (moves.length === 0) { done = true; break; }
        states.push({ board: board.slice(), player: player });
        const mv = bestMove(board, player, rng);
        board[mv] = player;
        if (winner(board) !== 0) { done = true; break; }
        player = -player;
      }
      for (const st of states) {
        const key = st.board.join('');
        if (seen.has(key)) continue;
        seen.add(key);
        const mv = bestMove(st.board, st.player, rng);
        if (mv < 0) continue;
        const t = new Array(9).fill(0);
        t[mv] = 1;
        inputs.push(st.board.slice());
        targets.push(t);
        if (inputs.length >= n) break;
      }
    }
    return { inputs: inputs, targets: targets };
  }
  function predictMove(net, board) {
    const p = net.predict(board.slice());
    const moves = legalMoves(board);
    let best = moves[0];
    for (const m of moves) if (p[m] > p[best]) best = m;
    return best;
  }
  function playVsRandom(net, games, seed) {
    const rng = createRng(seed == null ? 1 : seed);
    let wins = 0, draws = 0, losses = 0;
    for (let g = 0; g < games; g++) {
      const board = new Array(9).fill(0);
      const netSide = rng() < 0.5 ? 1 : -1;
      let player = 1;
      let result = 0;
      for (let step = 0; step < 9; step++) {
        const moves = legalMoves(board);
        if (moves.length === 0) break;
        let mv;
        if (player === netSide) mv = predictMove(net, board);
        else mv = moves[Math.floor(rng() * moves.length)];
        board[mv] = player;
        const w = winner(board);
        if (w !== 0) { result = w; break; }
        player = -player;
      }
      const w = result !== 0 ? result : 0;
      if (w === netSide) wins++;
      else if (w === 0) draws++;
      else losses++;
    }
    return { wins: wins, draws: draws, losses: losses };
  }
  const api = { winner: winner, legalMoves: legalMoves, full: full, minimaxScore: minimaxScore, bestMove: bestMove, makeDataset: makeDataset, predictMove: predictMove, playVsRandom: playVsRandom, LINES: LINES };
  root.Synapse = root.Synapse || {};
  root.Synapse.tictactoe = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
