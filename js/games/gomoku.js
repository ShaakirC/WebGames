/*
 * Gomoku (five in a row)
 * Players take turns placing black and white stones on the points of a grid. The first to get
 * five (or more) in an unbroken line, across, down or diagonally, wins. Nothing moves or is captured.
 * Mouse: click a point to place (with a hover preview). Touch: tap to preview, tap again or press Place.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  const SIZES = [9, 11, 13, 15];
  const DEFAULT_SIZE = 15;
  const WIN = 5;
  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const COLS = 'ABCDEFGHJKLMNOP'; // board notation skips I

  const pointName = (r, c, n) => `${COLS[c]}${n - r}`;
  const emptyBoard = (n) => Array.from({ length: n }, () => Array(n).fill(null));

  // Every stone in a line of WIN+ through (r, c), or null.
  function winningLine(board, r, c) {
    const n = board.length;
    const p = board[r][c];
    const line = [];
    for (const [dr, dc] of DIRECTIONS) {
      const run = [[r, c]];
      for (const sign of [1, -1]) {
        let rr = r + dr * sign;
        let cc = c + dc * sign;
        while (rr >= 0 && rr < n && cc >= 0 && cc < n && board[rr][cc] === p) {
          run.push([rr, cc]);
          rr += dr * sign;
          cc += dc * sign;
        }
      }
      if (run.length >= WIN) line.push(...run);
    }
    return line.length ? line : null;
  }

  // Marker dots on the traditional points: four near the corners plus the centre.
  function starPoints(n) {
    const k = n >= 13 ? 3 : 2;
    const mid = (n - 1) / 2;
    return new Set([[k, k], [k, n - 1 - k], [mid, mid], [n - 1 - k, k], [n - 1 - k, n - 1 - k]].map(([r, c]) => `${r},${c}`));
  }

  function freshState(prev) {
    const round = prev ? prev.round + 1 : 1;
    const size = prev ? prev.size : DEFAULT_SIZE;
    const first = (round - 1) % 2; // plays black and goes first; alternates each round
    return {
      round,
      wins: prev ? prev.wins : [0, 0],
      size,
      first,
      turn: first,
      board: emptyBoard(size), // board[r][c] = null | player index
      moves: 0,
      last: null,              // [r, c] of the latest stone
      winner: null,            // null | 0 | 1 | 'draw'
      line: [],                // winning stones
    };
  }

  GameHub.register({
    id: 'gomoku',
    title: 'Gomoku',
    emoji: '⚫',
    description: 'Take turns placing black and white stones. First to get five in a row wins.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      // Touch screens get tap-to-preview + confirm, since points are small on a phone.
      const directPlace = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      let pending = null;                                     // [r, c] previewed on touch
      let justPlaced = false;                                 // animate only a stone placed this render
      let focusAt = [Math.floor(state.size / 2), Math.floor(state.size / 2)]; // keyboard position

      const n = () => state.size;
      const isOver = () => state.winner !== null;
      const colourOf = (p) => (p === state.first ? 'black' : 'white');

      // ---- settings (only before the first stone) --------------------------
      function setSize(size) {
        if (state.moves > 0) return;
        state.size = size;
        state.board = emptyBoard(size);
        pending = null;
        focusAt = [Math.floor(size / 2), Math.floor(size / 2)];
        commit();
      }

      // ---- play ------------------------------------------------------------
      function tap(r, c) {
        if (isOver() || state.board[r][c] !== null) return;
        focusAt = [r, c];
        if (directPlace || (pending && pending[0] === r && pending[1] === c)) return place(r, c);
        pending = [r, c];
        render();
      }

      function place(r, c) {
        if (isOver() || state.board[r][c] !== null) return;
        const p = state.turn;
        state.board[r][c] = p;
        state.moves += 1;
        state.last = [r, c];
        pending = null;
        justPlaced = true;

        const line = winningLine(state.board, r, c);
        if (line) {
          state.winner = p;
          state.line = line;
          state.wins[p] += 1;
        } else if (state.moves === n() * n()) {
          state.winner = 'draw';
        } else {
          state.turn = 1 - p;
        }
        commit();
      }

      function newRound() {
        if (!isOver() && state.moves > 0 && !confirm('Start a new round? This game isn’t finished.')) return;
        state = freshState(state);
        pending = null;
        commit();
      }

      function resetScores() {
        if (!ui.confirmFreshMatch()) return;
        state.wins = [0, 0];
        state.round = 1;
        commit();
      }

      // Arrow keys move focus around the board (one tab stop for the whole grid).
      function onBoardKey(e) {
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        const d = moves[e.key];
        if (!d) return;
        e.preventDefault();
        const clamp = (v) => Math.min(n() - 1, Math.max(0, v));
        focusAt = [clamp(focusAt[0] + d[0]), clamp(focusAt[1] + d[1])];
        const target = `pt-${focusAt[0]}-${focusAt[1]}`; // the redraw refocuses the old point first
        render();
        ui.focus(root, target);
      }

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
          isOver() && renderResult(),
          renderSettings(),
          renderPlay(),
        ]);
        justPlaced = false;
      }

      function renderResult() {
        if (state.winner === 'draw') {
          return h('div', { class: 'banner is-draw' },
            h('span', null, '🤝 The board is full. It’s a draw!'),
            h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
        }
        const winner = ctx.players[state.winner];
        return h('div', { class: `banner ${winner.cssClass}` },
          h('span', null, `🏆 ${winner.name} got five in a row!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
      }

      function renderSettings() {
        const label = `${n()}×${n()}`;
        if (state.moves > 0) {
          return h('div', { class: 'gm-summary' }, h('span', { class: 'pill' }, label));
        }
        const i = SIZES.indexOf(n());
        return h('div', { class: 'settings-bar' },
          ui.stepper({
            label: 'Board',
            groupLabel: 'Board size',
            value: label,
            onMinus: () => setSize(SIZES[i - 1]),
            onPlus: () => setSize(SIZES[i + 1]),
            canMinus: i > 0,
            canPlus: i < SIZES.length - 1,
            minusLabel: 'Smaller board',
            plusLabel: 'Bigger board',
          }));
      }

      function renderPlay() {
        const players = ctx.players;
        const over = isOver();
        const me = players[state.turn];
        return h('div', { class: `gm ${me.cssClass}` },
          h('div', { class: 'gm-players' },
            players.map((p, i) => h('div', {
              class: `gm-player ${p.cssClass}` + (!over && state.turn === i ? ' is-turn' : ''),
            },
              h('span', { class: `gm-player__stone is-${colourOf(i)}`, 'aria-hidden': 'true' }),
              h('span', { class: 'gm-player__name' }, p.name),
              h('span', { class: 'gm-player__colour' }, colourOf(i)))),
          ),
          !over && h('p', { class: 'gm-turn', 'aria-live': 'polite' },
            `${me.name}’s turn (${colourOf(state.turn)}). ` +
            (directPlace ? 'Click a point.' : pending ? 'Tap again or press Place.' : 'Tap a point.')),
          renderBoard(),
          !over && !directPlace && h('button', {
            class: 'btn btn--primary btn--xl gm-place',
            disabled: !pending,
            onclick: () => pending && place(pending[0], pending[1]),
          }, pending ? `Place at ${pointName(pending[0], pending[1], n())}` : 'Place stone'));
      }

      function renderBoard() {
        const size = n();
        const over = isOver();
        const stars = starPoints(size);
        const winSet = new Set(state.line.map(([r, c]) => `${r},${c}`));
        const turnColour = colourOf(state.turn);
        const cells = [];

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const key = `${r},${c}`;
            const p = state.board[r][c];
            const isPending = pending && pending[0] === r && pending[1] === c;
            const isLast = state.last && state.last[0] === r && state.last[1] === c;
            const edges = (r === 0 ? ' is-t' : '') + (r === size - 1 ? ' is-b' : '') +
              (c === 0 ? ' is-l' : '') + (c === size - 1 ? ' is-r' : '');
            const what = p !== null ? colourOf(p) : 'empty';
            cells.push(h('button', {
              class: 'gm-pt' + edges + (p !== null ? ' is-taken' : ''),
              'aria-label': `${pointName(r, c, size)}, ${what}` + (isPending ? ', preview' : ''),
              'data-focus-key': `pt-${r}-${c}`,
              tabindex: r === focusAt[0] && c === focusAt[1] ? '0' : '-1',
              disabled: over && p === null,
              onclick: () => tap(r, c),
              onfocus: () => { focusAt = [r, c]; },
            },
              stars.has(key) && h('span', { class: 'gm-star', 'aria-hidden': 'true' }),
              p !== null && h('span', {
                class: `gm-stone is-${colourOf(p)}` + (isLast && !over ? ' is-last' : '') +
                  (isLast && justPlaced ? ' is-new' : '') + (winSet.has(key) ? ' is-win' : ''),
                'aria-hidden': 'true',
              }),
              p === null && !over && h('span', {
                class: `gm-stone is-${turnColour} is-ghost` + (isPending ? ' is-pending' : ''),
                'aria-hidden': 'true',
              })));
          }
        }
        return h('div', {
          class: 'gm-board' + (directPlace ? ' is-direct' : ''),
          style: `--n:${size}`,
          role: 'group',
          'aria-label': `${size} by ${size} board. Arrow keys move, Enter places.`,
          onkeydown: onBoardKey,
        }, cells);
      }

      render(); // no document listeners or timers, so no cleanup
    },
  });
})();
