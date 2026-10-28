/*
 * Four Up
 * Players take turns dropping tokens into a 7×6 upright grid. Tokens fall to the lowest free
 * slot. The first to line up four in a row (across, down or diagonally) wins the round.
 * The current player aims with ◀ / ▶ under the board (or taps a column), then presses Drop.
 * Each token falls into place over one second.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  const COLS = 7;
  const ROWS = 6;
  const FALL_MS = 1000; // keep in sync with the c4-fall animation in four-up.css
  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // Lowest free row in a column, or -1 when it's full. Row 0 is the top.
  function landingRow(board, c) {
    for (let r = ROWS - 1; r >= 0; r--) if (board[r][c] === null) return r;
    return -1;
  }

  // Every cell in a line of 4+ through (r, c), or null.
  function winningLine(board, r, c) {
    const p = board[r][c];
    const line = [];
    for (const [dr, dc] of DIRECTIONS) {
      const run = [[r, c]];
      for (const sign of [1, -1]) {
        let rr = r + dr * sign;
        let cc = c + dc * sign;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === p) {
          run.push([rr, cc]);
          rr += dr * sign;
          cc += dc * sign;
        }
      }
      if (run.length >= 4) line.push(...run);
    }
    return line.length ? line : null;
  }

  function freshState(prev) {
    const round = prev ? prev.round + 1 : 1;
    const first = (round - 1) % 2; // alternates each round
    return {
      round,
      wins: prev ? prev.wins : [0, 0],
      first,
      turn: first,
      board: emptyBoard(),  // board[r][c] = null | 0 | 1
      cursor: Math.floor(COLS / 2),
      last: null,           // [r, c] of the latest token
      moves: 0,
      winner: null,         // null | 0 | 1 | 'draw'
      line: [],             // winning cells
    };
  }

  GameHub.register({
    id: 'four-up',
    title: 'Four Up',
    emoji: '🔴',
    description: 'Take turns dropping tokens into the grid. First to line up four in a row wins.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      // UI only: the token currently falling. Controls are locked until it lands.
      let falling = null;
      let fallTimer = null;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const isOver = () => state.winner !== null;
      const isFull = (c) => landingRow(state.board, c) < 0;
      const canPlay = () => !isOver() && !falling;

      // Next column in that direction that still has room, or null.
      function nextOpen(from, step) {
        for (let c = from + step; c >= 0 && c < COLS; c += step) if (!isFull(c)) return c;
        return null;
      }

      function move(step) {
        const c = nextOpen(state.cursor, step);
        if (!canPlay() || c === null) return;
        state.cursor = c;
        commit();
      }

      function aim(c) {
        if (!canPlay() || isFull(c) || c === state.cursor) return;
        state.cursor = c;
        commit();
      }

      function drop() {
        if (!canPlay()) return;
        const c = state.cursor;
        const r = landingRow(state.board, c);
        if (r < 0) return;
        const p = state.turn;
        state.board[r][c] = p;
        state.last = [r, c];
        state.moves += 1;

        const line = winningLine(state.board, r, c);
        if (line) {
          state.winner = p;
          state.line = line;
          state.wins[p] += 1;
        } else if (state.moves === ROWS * COLS) {
          state.winner = 'draw';
        } else {
          state.turn = 1 - p;
          // Stay in the same column if it still has room, otherwise slide to the nearest open one.
          if (isFull(c)) state.cursor = nextOpen(c, 1) ?? nextOpen(c, -1);
        }
        save();

        falling = [r, c];
        render();
        fallTimer = setTimeout(() => {
          falling = null;
          render();
        }, reducedMotion ? 0 : FALL_MS);
      }

      function newRound() {
        if (!isOver() && state.moves > 0 && !confirm('Start a new round? This game isn’t finished.')) return;
        clearTimeout(fallTimer);
        falling = null;
        state = freshState(state);
        commit();
      }

      function resetScores() {
        if (!ui.confirmFreshMatch()) return;
        state.wins = [0, 0];
        state.round = 1;
        commit();
      }

      function onKey(e) {
        if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'ArrowLeft') move(-1);
        else if (e.key === 'ArrowRight') move(1);
        else if (e.key === 'ArrowDown') drop();
        else return;
        e.preventDefault(); // don't scroll the page
      }
      document.addEventListener('keydown', onKey);

      // ---- rendering -------------------------------------------------------
      function render() {
        ui.renderInto(root, [
          ui.toolbar({
            round: state.round,
            wins: state.wins,
            players: ctx.players,
            onNewRound: newRound,
            onResetScores: resetScores,
          }),
          isOver() && !falling && renderResult(),
          renderPlay(),
        ]);
      }

      function renderResult() {
        if (state.winner === 'draw') {
          return h('div', { class: 'banner is-draw' },
            h('span', null, '🤝 The board is full. It’s a draw!'),
            h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
        }
        const winner = ctx.players[state.winner];
        return h('div', { class: `banner ${winner.cssClass}` },
          h('span', null, `🏆 ${winner.name} got four in a row!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
      }

      function renderPlay() {
        const players = ctx.players;
        // While a token falls it's still the dropper's moment; the turn visibly passes when it lands.
        const me = players[falling ? state.board[falling[0]][falling[1]] : state.turn];
        const over = isOver();
        const locked = !canPlay();
        return h('div', { class: `c4 ${me.cssClass}` },
          !over && h('p', { class: 'c4-turn', 'aria-live': 'polite' },
            h('span', { class: `c4-turn__dot ${me.cssClass}`, 'aria-hidden': 'true' }),
            `${me.name}’s turn`),
          renderBoard(),
          !over && h('div', { class: 'c4-controls' },
            h('button', {
              class: 'btn btn--xl c4-arrow',
              'aria-label': 'Move left',
              'data-focus-key': 'left',
              disabled: locked || nextOpen(state.cursor, -1) === null,
              onclick: () => move(-1),
            }, '◀'),
            h('button', {
              class: 'btn btn--primary btn--xl c4-drop',
              'data-focus-key': 'drop',
              disabled: locked || isFull(state.cursor),
              onclick: drop,
            }, `⬇ Drop in column ${state.cursor + 1}`),
            h('button', {
              class: 'btn btn--xl c4-arrow',
              'aria-label': 'Move right',
              'data-focus-key': 'right',
              disabled: locked || nextOpen(state.cursor, 1) === null,
              onclick: () => move(1),
            }, '▶')),
          !over && h('p', { class: 'c4-keys' }, 'Keys: ← / → aim · ↓ drop · or tap a column'));
      }

      // One grid: row 1 is the aiming row above the board, row 2 a spacer, rows 3+ the board.
      function renderBoard() {
        const players = ctx.players;
        const over = isOver();
        const winSet = new Set(state.line.map(([r, c]) => `${r},${c}`));
        const items = [h('div', { class: 'c4-frame', 'aria-hidden': 'true' })];

        // Aiming row: the current player's token hovers over the chosen column.
        for (let c = 0; c < COLS; c++) {
          const here = !over && !falling && c === state.cursor;
          items.push(h('div', {
            class: 'c4-aim',
            style: `grid-row:1;grid-column:${c + 1}`,
            onclick: () => aim(c),
            'aria-hidden': 'true',
          }, here && h('div', { class: `c4-token is-ghost ${players[state.turn].cssClass}` })));
        }

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const p = state.board[r][c];
            const area = `grid-row:${r + 3};grid-column:${c + 1}`;
            items.push(h('div', {
              class: 'c4-cell' + (!over && !falling && c === state.cursor ? ' is-aimed' : ''),
              style: area,
              onclick: () => aim(c),
            }));
            if (p === null) continue;
            const isFalling = falling && falling[0] === r && falling[1] === c;
            const isLast = state.last && state.last[0] === r && state.last[1] === c;
            items.push(h('div', {
              class: `c4-token ${players[p].cssClass}` +
                (isFalling ? ' is-falling' : '') +
                (isLast && !over ? ' is-last' : '') +
                (!falling && winSet.has(`${r},${c}`) ? ' is-win' : ''),
              style: `${area};--fall:${r + 1}`,
              'aria-hidden': 'true',
            }));
          }
        }

        const filled = state.board.map((row) => row.map((p) => (p === null ? '·' : p === 0 ? '1' : '2')).join(''));
        return h('div', {
          class: 'c4-board',
          role: 'img',
          'aria-label': `Board, top to bottom (1 = ${players[0].name}, 2 = ${players[1].name}): ${filled.join(' / ')}`,
        }, items);
      }

      render();
      return () => {
        clearTimeout(fallTimer);
        document.removeEventListener('keydown', onKey);
      };
    },
  });
})();
