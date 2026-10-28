/*
 * Wall Race
 * An original race-and-block game. Each player has one pawn and races to the far side.
 * On your turn, either step one square (not through walls or onto the other pawn) or build one
 * wall segment between two squares, from a per-round budget. Walls are permanent, and a wall may
 * never leave either player without a route home.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  const SIZES = [5, 7, 9];
  const DEFAULT_SIZE = 7;
  const WALLS = { min: 3, max: 15, def: 8 }; // walls per player per round
  const STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Edge keys. 'h-r-c' sits between (r, c) and (r+1, c); 'v-r-c' between (r, c) and (r, c+1).
  function edgeBetween([r1, c1], [r2, c2]) {
    if (c1 === c2) return `h-${Math.min(r1, r2)}-${c1}`;
    return `v-${r1}-${Math.min(c1, c2)}`;
  }

  const goalRow = (p, n) => (p === 0 ? 0 : n - 1); // player 0 starts at the bottom and heads up

  // Can (r, c) reach the goal row? Pawns don't block a route, only walls do.
  function hasRoute(blocked, start, goal, n) {
    const seen = new Set([start.join(',')]);
    const queue = [start];
    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === goal) return true;
      for (const [dr, dc] of STEPS) {
        const next = [r + dr, c + dc];
        if (next[0] < 0 || next[1] < 0 || next[0] >= n || next[1] >= n) continue;
        const key = next.join(',');
        if (seen.has(key) || blocked.has(edgeBetween([r, c], next))) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    return false;
  }

  function startPawns(n) {
    const mid = Math.floor(n / 2);
    return [[n - 1, mid], [0, mid]];
  }

  function freshState(prev) {
    const round = prev ? prev.round + 1 : 1;
    const size = prev ? prev.size : DEFAULT_SIZE;
    const first = (round - 1) % 2; // alternates each round
    return {
      round,
      wins: prev ? prev.wins : [0, 0],
      size,
      budget: prev && typeof prev.budget === 'number' ? prev.budget : WALLS.def, // walls per player this round
      first,
      turn: first,
      pawns: startPawns(size),
      walls: [],       // [{ key, owner }]
      moveNo: 0,       // actions taken this round
      last: null,      // { type: 'move' | 'wall' | 'pass', by }
      undo: null,      // snapshot before the latest action
      winner: null,
    };
  }

  GameHub.register({
    id: 'wall-race',
    title: 'Wall Race',
    emoji: '🧱',
    description: 'Race to the far side. Each turn, step forward or spend a wall to block your opponent.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      // Saves from before the wall budget existed: give them the default, or both − / + stay disabled.
      if (typeof state.budget !== 'number') state.budget = WALLS.def;
      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };
      let justActed = false;

      const n = () => state.size;
      const isOver = () => state.winner !== null;
      const blockedSet = () => new Set(state.walls.map((w) => w.key));
      const wallsLeft = (p) => state.budget - state.walls.filter((w) => w.owner === p).length;

      function legalMoves(p) {
        const [r, c] = state.pawns[p];
        const other = state.pawns[1 - p];
        const blocked = blockedSet();
        return STEPS.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) =>
          rr >= 0 && cc >= 0 && rr < n() && cc < n() &&
          !(rr === other[0] && cc === other[1]) &&
          !blocked.has(edgeBetween([r, c], [rr, cc])));
      }

      // A wall is allowed on an open inner edge if both players still have a route home afterwards.
      function canBuild(key) {
        const blocked = blockedSet();
        if (blocked.has(key)) return false;
        blocked.add(key);
        return [0, 1].every((p) => hasRoute(blocked, state.pawns[p], goalRow(p, n()), n()));
      }

      // ---- settings (only before the first action) -------------------------
      function setSize(size) {
        if (state.moveNo > 0) return;
        state.size = size;
        state.pawns = startPawns(size);
        commit();
      }

      function setBudget(count) {
        if (state.moveNo > 0) return;
        state.budget = Math.min(WALLS.max, Math.max(WALLS.min, count));
        commit();
      }

      // ---- actions ---------------------------------------------------------
      // Every action: snapshot for Undo, apply, then pass the turn (unless it won).
      function act(apply) {
        if (isOver()) return;
        const { undo, ...before } = state;
        state.undo = JSON.parse(JSON.stringify(before));
        apply(state.turn);
        state.moveNo += 1;
        if (state.winner === null) state.turn = 1 - state.turn;
        justActed = true; // the next render animates just this action's wall or pawn
        commit();
      }

      function moveTo(r, c) {
        const p = state.turn;
        if (!legalMoves(p).some(([rr, cc]) => rr === r && cc === c)) return;
        act(() => {
          state.pawns[p] = [r, c];
          state.last = { type: 'move', by: p };
          if (r === goalRow(p, n())) {
            state.winner = p;
            state.wins[p] += 1;
          }
        });
      }

      function build(key) {
        if (wallsLeft(state.turn) <= 0 || !canBuild(key)) return;
        act((p) => {
          state.walls.push({ key, owner: p });
          state.last = { type: 'wall', by: p };
        });
      }

      function pass() {
        if (legalMoves(state.turn).length) return;
        act((p) => { state.last = { type: 'pass', by: p }; });
      }

      function undoLast() {
        if (!state.undo || isOver()) return;
        state = { ...state.undo, undo: null };
        commit();
      }

      function newRound() {
        if (!isOver() && state.moveNo > 0 && !confirm('Start a new round? This game isn’t finished.')) return;
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
            actions: h('button', { class: 'btn btn--sm', disabled: !state.undo || isOver(), onclick: undoLast }, '↶ Undo'),
            onNewRound: newRound,
            onResetScores: resetScores,
          }),
          isOver() && renderResult(),
          renderSettings(),
          renderPlay(),
        ]);
        justActed = false;
      }

      function renderResult() {
        const winner = ctx.players[state.winner];
        return h('div', { class: `banner ${winner.cssClass}` },
          h('span', null, `🏆 ${winner.name} made it across!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
      }

      function renderSettings() {
        const label = `${n()}×${n()}`;
        if (state.moveNo > 0) {
          return h('div', { class: 'wr-summary' },
            h('span', { class: 'pill' }, label),
            h('span', { class: 'pill' }, `🧱 ${state.budget} walls each`));
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
          }),
          ui.stepper({
            label: 'Walls',
            groupLabel: 'Walls per player',
            value: state.budget,
            onMinus: () => setBudget(state.budget - 1),
            onPlus: () => setBudget(state.budget + 1),
            canMinus: state.budget > WALLS.min,
            canPlus: state.budget < WALLS.max,
            minusLabel: 'Fewer walls',
            plusLabel: 'More walls',
          }));
      }

      function renderPlay() {
        const players = ctx.players;
        const over = isOver();
        const me = players[state.turn];
        const stuck = !over && legalMoves(state.turn).length === 0;
        const canWall = wallsLeft(state.turn) > 0;
        let hint = `${me.name}’s turn: step to a glowing square, or tap a gap to build a wall.`;
        if (!canWall) hint = `${me.name}’s turn: no walls left, step to a glowing square.`;
        if (stuck) hint = canWall ? `${me.name} is boxed in: build a wall or pass.` : `${me.name} is boxed in: pass.`;
        return h('div', { class: `wr ${me.cssClass}` },
          h('div', { class: 'wr-players' },
            players.map((p, i) => {
              const left = wallsLeft(i);
              return h('div', { class: `wr-player ${p.cssClass}` + (!over && state.turn === i ? ' is-turn' : '') },
                h('span', { class: 'wr-player__name' }, `${i === 0 ? '⬆' : '⬇'} ${p.name}`),
                h('span', { class: 'wr-player__walls' + (left === 0 ? ' is-out' : '') },
                  `🧱 ${left} ${left === 1 ? 'wall' : 'walls'} left`));
            })),
          !over && h('p', { class: 'wr-turn', 'aria-live': 'polite' }, hint),
          renderBoard(),
          stuck && h('button', { class: 'btn', onclick: pass }, 'Pass (no moves)'),
          h('p', { class: 'wr-rules' },
            'Walls stay for the rest of the round. Hatched gaps can’t be built on: they would cut someone off.'));
      }

      // Grid: cells on even tracks, gaps (where walls go) on odd tracks.
      function renderBoard() {
        const players = ctx.players;
        const size = n();
        const over = isOver();
        const at = (row, col) => `grid-row:${row + 1};grid-column:${col + 1}`;
        const moves = over ? [] : legalMoves(state.turn);
        const canStep = (r, c) => moves.some(([rr, cc]) => rr === r && cc === c);
        const walls = new Map(state.walls.map((w) => [w.key, w]));
        const canWall = !over && wallsLeft(state.turn) > 0;
        const items = [];

        const gap = (key, row, col, kind) => {
          const wall = walls.get(key);
          if (wall) {
            const isNew = justActed && state.last && state.last.type === 'wall' && state.walls[state.walls.length - 1] === wall;
            return h('div', {
              class: `wr-wall wr-wall--${kind} ${players[wall.owner].cssClass}` + (isNew ? ' is-new' : ''),
              style: at(row, col),
              role: 'img',
              'aria-label': `Wall by ${players[wall.owner].name}`,
            });
          }
          // Hatched = would cut someone off. Out of walls just disables the gaps.
          const sealing = !over && !canBuild(key);
          const ok = canWall && !sealing;
          return h('button', {
            class: `wr-gap wr-gap--${kind}` + (sealing ? ' is-blocked' : ''),
            style: at(row, col),
            'aria-label': ok ? 'Build a wall here' : sealing ? 'Can’t build here: it would cut someone off' : 'No walls left',
            disabled: !ok,
            onclick: () => build(key),
          });
        };

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const pawn = state.pawns.findIndex(([pr, pc]) => pr === r && pc === c);
            const goalFor = r === 0 ? 0 : r === size - 1 ? 1 : null;
            const step = canStep(r, c);
            items.push(h('button', {
              class: 'wr-cell' + (goalFor !== null ? ` is-goal-${goalFor}` : '') + (step ? ' is-step' : ''),
              style: at(2 * r, 2 * c),
              'aria-label': (pawn >= 0 ? `${players[pawn].name}’s pawn` : step ? 'Step here' : 'Square') +
                (goalFor !== null ? `, ${players[goalFor].name}’s finish row` : ''),
              disabled: !step,
              onclick: () => moveTo(r, c),
            }, pawn >= 0 && h('span', {
              class: `wr-pawn ${players[pawn].cssClass}` + (state.turn === pawn && !over ? ' is-turn' : '') +
                (justActed && state.last && state.last.type === 'move' && state.last.by === pawn ? ' is-new' : '') +
                (state.winner === pawn ? ' is-win' : ''),
              'aria-hidden': 'true',
            }, players[pawn].name.charAt(0).toUpperCase())));
            if (c < size - 1) items.push(gap(`v-${r}-${c}`, 2 * r, 2 * c + 1, 'v'));
            if (r < size - 1) items.push(gap(`h-${r}-${c}`, 2 * r + 1, 2 * c, 'h'));
            if (r < size - 1 && c < size - 1) items.push(h('div', { class: 'wr-post', style: at(2 * r + 1, 2 * c + 1), 'aria-hidden': 'true' }));
          }
        }
        return h('div', { class: 'wr-board', style: `--gaps:${size - 1}` }, items);
      }

      render(); // no document listeners or timers, so no cleanup
    },
  });
})();
