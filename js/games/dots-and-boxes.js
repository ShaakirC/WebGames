/*
 * Dots & Boxes
 * Players take turns drawing a line between two neighbouring dots. Drawing the fourth side
 * of a box claims it (a dot in your colour) and earns another turn. When every line is drawn,
 * whoever owns the most boxes wins the round.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  const SIZE = { min: 3, max: 6, def: 4 }; // boxes per side

  // hLines[r][c]: the line from dot (r, c) to (r, c+1); r = 0..n, c = 0..n-1.
  // vLines[r][c]: the line from dot (r, c) to (r+1, c); r = 0..n-1, c = 0..n.
  // Each holds null or the index of the player who drew it. boxes[r][c] holds the owner.
  const grid = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(null));

  function freshBoard(n) {
    return { hLines: grid(n + 1, n), vLines: grid(n, n + 1), boxes: grid(n, n) };
  }

  function freshState(prev) {
    const round = prev ? prev.round + 1 : 1;
    const size = prev ? prev.size : SIZE.def;
    const first = (round - 1) % 2; // alternates each round
    return {
      round,
      wins: prev ? prev.wins : [0, 0],
      size,
      first,
      turn: first,
      ...freshBoard(size),
      moves: 0,
      last: null,     // { kind: 'h' | 'v', r, c } of the latest line
      again: false,   // did the latest line claim a box (so the same player goes again)?
      winner: null,   // null | 0 | 1 | 'draw'
    };
  }

  GameHub.register({
    id: 'dots-and-boxes',
    title: 'Dots & Boxes',
    emoji: '🟦',
    description: 'Take turns joining dots. Close a box to claim it and go again. Most boxes wins.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      const n = () => state.size;
      const isOver = () => state.winner !== null;
      const score = (p) => state.boxes.flat().filter((o) => o === p).length;

      function isClosed(r, c) {
        return state.hLines[r][c] !== null && state.hLines[r + 1][c] !== null &&
          state.vLines[r][c] !== null && state.vLines[r][c + 1] !== null;
      }

      // ---- settings (only before the first line) ---------------------------
      function setSize(size) {
        if (state.moves > 0) return;
        state.size = Math.min(SIZE.max, Math.max(SIZE.min, size));
        Object.assign(state, freshBoard(state.size));
        commit();
      }

      // ---- play ------------------------------------------------------------
      function draw(kind, r, c) {
        const lines = kind === 'h' ? state.hLines : state.vLines;
        if (isOver() || lines[r][c] !== null) return;
        const p = state.turn;
        lines[r][c] = p;
        state.moves += 1;
        state.last = { kind, r, c };

        // A line borders at most two boxes: above/below for 'h', left/right for 'v'.
        const sides = kind === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
        let claimed = 0;
        for (const [br, bc] of sides) {
          if (br < 0 || bc < 0 || br >= n() || bc >= n()) continue;
          if (state.boxes[br][bc] === null && isClosed(br, bc)) {
            state.boxes[br][bc] = p;
            claimed += 1;
          }
        }

        state.again = claimed > 0;
        if (!state.again) state.turn = 1 - p;

        if (state.boxes.flat().every((o) => o !== null)) {
          const [a, b] = [score(0), score(1)];
          state.winner = a === b ? 'draw' : (a > b ? 0 : 1);
          if (state.winner !== 'draw') state.wins[state.winner] += 1;
        }
        commit();
      }

      function newRound() {
        if (!isOver() && state.moves > 0 && !confirm('Start a new round? This game isn’t finished.')) return;
        state = freshState(state);
        commit();
      }

      function resetScores() {
        if (!ui.confirmFreshMatch()) return;
        state.wins = [0, 0];
        state.round = 1;
        commit();
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
      }

      function renderResult() {
        const [a, b] = [score(0), score(1)];
        if (state.winner === 'draw') {
          return h('div', { class: 'banner is-draw' },
            h('span', null, `🤝 ${a}–${b}. It’s a draw!`),
            h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
        }
        const winner = ctx.players[state.winner];
        const hi = Math.max(a, b);
        const lo = Math.min(a, b);
        return h('div', { class: `banner ${winner.cssClass}` },
          h('span', null, `🏆 ${winner.name} wins ${hi}–${lo}!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
      }

      function renderSettings() {
        const label = `${n()}×${n()} boxes`;
        if (state.moves > 0) {
          return h('div', { class: 'db-summary' }, h('span', { class: 'pill' }, label));
        }
        return h('div', { class: 'settings-bar' },
          ui.stepper({
            label: 'Grid',
            groupLabel: 'Grid size',
            value: label,
            onMinus: () => setSize(n() - 1),
            onPlus: () => setSize(n() + 1),
            canMinus: n() > SIZE.min,
            canPlus: n() < SIZE.max,
            minusLabel: 'Smaller grid',
            plusLabel: 'Bigger grid',
          }));
      }

      function renderPlay() {
        const players = ctx.players;
        const me = players[state.turn];
        const over = isOver();
        return h('div', { class: `db ${me.cssClass}` },
          h('div', { class: 'db-scores' },
            players.map((p, i) => h('div', {
              class: `db-score ${p.cssClass}` + (!over && state.turn === i ? ' is-turn' : ''),
            },
              h('span', { class: 'db-score__name' }, p.name),
              h('span', { class: 'db-score__value' }, score(i))))),
          !over && h('p', { class: 'db-turn', 'aria-live': 'polite' },
            state.again ? `✨ Box! ${me.name}, go again.` : `${me.name}’s turn: draw a line.`),
          renderGrid());
      }

      // A (2n+1)×(2n+1) CSS grid: dots on even tracks, lines between them, boxes in the middle.
      function renderGrid() {
        const players = ctx.players;
        const size = n();
        const over = isOver();
        const items = [];
        const at = (row, col) => `grid-row:${row + 1};grid-column:${col + 1}`;
        const isLast = (kind, r, c) => state.last && state.last.kind === kind && state.last.r === r && state.last.c === c;

        const line = (kind, r, c, owner) => {
          const to = kind === 'h' ? `${r + 1},${c + 2}` : `${r + 2},${c + 1}`;
          return h('button', {
            class: `db-line db-line--${kind}` +
              (owner !== null ? ` is-drawn ${players[owner].cssClass}` : '') +
              (isLast(kind, r, c) ? ' is-last' : ''),
            style: kind === 'h' ? at(2 * r, 2 * c + 1) : at(2 * r + 1, 2 * c),
            'aria-label': `Line from dot ${r + 1},${c + 1} to ${to}` + (owner !== null ? `, drawn by ${players[owner].name}` : ''),
            'data-focus-key': `${kind}-${r}-${c}`,
            disabled: over || owner !== null,
            onclick: () => draw(kind, r, c),
          });
        };

        for (let r = 0; r <= size; r++) {
          for (let c = 0; c <= size; c++) {
            items.push(h('div', { class: 'db-dot', style: at(2 * r, 2 * c), 'aria-hidden': 'true' }));
            if (c < size) items.push(line('h', r, c, state.hLines[r][c]));
            if (r < size) items.push(line('v', r, c, state.vLines[r][c]));
            if (r < size && c < size) {
              const owner = state.boxes[r][c];
              items.push(h('div', {
                class: 'db-box' + (owner !== null ? ` is-claimed ${players[owner].cssClass}` : ''),
                style: at(2 * r + 1, 2 * c + 1),
                'aria-label': owner !== null ? `Box claimed by ${players[owner].name}` : null,
                role: owner !== null ? 'img' : null,
              }));
            }
          }
        }
        return h('div', { class: 'db-grid', style: `--n:${size}` }, items);
      }

      render(); // no document listeners or timers, so no cleanup
    },
  });
})();
