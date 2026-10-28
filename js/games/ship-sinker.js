/*
 * Ship Sinker
 * Each player secretly places a small fleet on a grid, then they take turns firing at
 * each other's waters. A hit (or a sink) means you shoot again; a miss passes the turn.
 * Sinking a ship reveals its whole outline. First to sink the entire enemy fleet wins.
 * Only placement is secret: the battle boards show nothing the other player doesn't know.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  const SIZE = { min: 5, max: 8, def: 6 };
  // Ship lengths for each board size, longest first.
  const FLEETS = {
    5: [3, 2],
    6: [3, 2, 2],
    7: [4, 3, 2],
    8: [4, 3, 3, 2],
  };
  const COLS = 'ABCDEFGH';

  const cellKey = (r, c) => `${r},${c}`;
  const cellName = (r, c) => `${COLS[c]}${r + 1}`;

  // A ship: { len, r, c, dir: 'h' | 'v' }. r/c are its top-left cell, null while not placed.
  function shipCells(ship) {
    if (ship.r == null) return [];
    return Array.from({ length: ship.len }, (_, k) =>
      ship.dir === 'h' ? [ship.r, ship.c + k] : [ship.r + k, ship.c]);
  }

  function shipAt(ships, r, c) {
    return ships.findIndex((s) => shipCells(s).some(([sr, sc]) => sr === r && sc === c));
  }

  function fits(ship, others, size) {
    const cells = shipCells(ship);
    return cells.every(([r, c]) => r >= 0 && c >= 0 && r < size && c < size && shipAt(others, r, c) < 0);
  }

  // Slide a ship so it stays on the board when it's dropped near an edge.
  function clampToBoard(ship, r, c, size) {
    return {
      ...ship,
      r: ship.dir === 'v' ? Math.min(r, size - ship.len) : r,
      c: ship.dir === 'h' ? Math.min(c, size - ship.len) : c,
    };
  }

  const freshDraft = (size) => FLEETS[size].map((len) => ({ len, r: null, c: null, dir: 'h' }));

  function randomFleet(size) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const placed = [];
      for (const len of FLEETS[size]) {
        for (let tries = 0; tries < 200; tries++) {
          const dir = Math.random() < 0.5 ? 'h' : 'v';
          const ship = {
            len, dir,
            r: Math.floor(Math.random() * (dir === 'v' ? size - len + 1 : size)),
            c: Math.floor(Math.random() * (dir === 'h' ? size - len + 1 : size)),
          };
          if (fits(ship, placed, size)) { placed.push(ship); break; }
        }
      }
      if (placed.length === FLEETS[size].length) return placed;
    }
    return freshDraft(size);
  }

  const isSunk = (ship, shots) => shipCells(ship).every(([r, c]) => shots.includes(cellKey(r, c)));
  const hitsOn = (fleet, shots) => shots.filter((k) => {
    const [r, c] = k.split(',').map(Number);
    return shipAt(fleet, r, c) >= 0;
  }).length;

  function freshState(prev) {
    const round = prev ? prev.round + 1 : 1;
    const size = prev ? prev.size : SIZE.def;
    const first = (round - 1) % 2; // places first and fires first; alternates each round
    return {
      round,
      wins: prev ? prev.wins : [0, 0],
      size,
      first,
      phase: 'place',          // 'place' -> 'play' -> 'done'
      placer: first,           // who is placing now
      gate: true,              // show the "look away" screen before placing
      draft: freshDraft(size), // the placer's ships in progress
      fleets: [null, null],    // fleets[i] = player i's locked ships
      turn: first,             // who is firing now
      shots: [[], []],         // shots[i] = "r,c" cells player i fired at (in the other's waters)
      last: null,              // { shooter, result: 'miss' | 'hit' | 'sunk', len }
      winner: null,
    };
  }

  GameHub.register({
    id: 'ship-sinker',
    title: 'Ship Sinker',
    emoji: '🚢',
    description: 'Hide a tiny fleet, then take turns firing. Hit and you go again. Sink them all to win.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      if (state.phase === 'place') state.gate = true; // never show a half-placed fleet after a refresh
      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      const firstUnplaced = (from = 0) => {
        const n = state.draft.length;
        for (let k = 0; k < n; k++) {
          const i = (from + k) % n;
          if (state.draft[i].r == null) return i;
        }
        return null;
      };
      let selected = state.draft ? firstUnplaced() : null; // UI only: the ship being placed

      const placedShips = () => state.draft.filter((s) => s.r != null);
      const allPlaced = () => state.draft.every((s) => s.r != null);
      const settingsLocked = () => state.phase !== 'place' || state.fleets.some(Boolean);

      // ---- settings (only before anyone has locked a fleet) -----------------
      function setSize(n) {
        if (settingsLocked()) return;
        state.size = Math.min(SIZE.max, Math.max(SIZE.min, n));
        state.draft = freshDraft(state.size);
        selected = 0;
        commit();
      }

      // ---- placement -------------------------------------------------------
      function leaveGate() {
        state.gate = false;
        selected = firstUnplaced();
        commit();
      }

      function selectShip(i) {
        state.draft[i].r = null; // picking up a placed ship takes it off the board
        state.draft[i].c = null;
        selected = i;
        commit();
      }

      function rotate() {
        if (selected == null) return;
        const ship = state.draft[selected];
        ship.dir = ship.dir === 'h' ? 'v' : 'h';
        commit();
      }

      function placeAt(r, c) {
        const onShip = state.draft.findIndex((s) => shipAt([s], r, c) >= 0);
        if (onShip >= 0) return selectShip(onShip);
        if (selected == null) return;
        const ship = clampToBoard(state.draft[selected], r, c, state.size);
        const others = state.draft.filter((s, i) => i !== selected);
        if (!fits(ship, others, state.size)) return ui.shake(root, `place-${r}-${c}`);
        state.draft[selected] = ship;
        selected = firstUnplaced(selected + 1);
        commit();
      }

      function randomize() {
        state.draft = randomFleet(state.size);
        selected = null;
        commit();
      }

      function clearDraft() {
        state.draft = freshDraft(state.size);
        selected = 0;
        commit();
      }

      function lockFleet() {
        if (!allPlaced()) return;
        state.fleets[state.placer] = state.draft.map((s) => ({ ...s }));
        const other = 1 - state.placer;
        if (state.fleets[other]) {
          state.phase = 'play';
          state.draft = null;
          state.turn = state.first;
        } else {
          state.placer = other;
          state.gate = true;
          state.draft = freshDraft(state.size);
        }
        selected = state.draft ? 0 : null;
        commit();
      }

      // Outline where the selected ship would land (desktop hover). Only touches classes, no redraw.
      function preview(r, c) {
        clearPreview();
        if (selected == null || state.draft.some((s) => shipAt([s], r, c) >= 0)) return;
        const ship = clampToBoard(state.draft[selected], r, c, state.size);
        const others = state.draft.filter((s, i) => i !== selected);
        const bad = !fits(ship, others, state.size);
        shipCells(ship).forEach(([sr, sc]) => {
          const el = root.querySelector(`[data-cell="${cellKey(sr, sc)}"]`);
          if (el) el.classList.add('is-preview', ...(bad ? ['is-bad'] : []));
        });
      }

      function clearPreview() {
        root.querySelectorAll('.ss-cell.is-preview').forEach((el) => el.classList.remove('is-preview', 'is-bad'));
      }

      // ---- battle ----------------------------------------------------------
      function fire(r, c) {
        if (state.phase !== 'play') return;
        const shooter = state.turn;
        const target = 1 - shooter;
        const shots = state.shots[shooter];
        const key = cellKey(r, c);
        if (shots.includes(key)) return;
        shots.push(key);

        const fleet = state.fleets[target];
        const i = shipAt(fleet, r, c);
        if (i < 0) {
          state.last = { shooter, result: 'miss' };
          state.turn = target;
        } else if (isSunk(fleet[i], shots)) {
          state.last = { shooter, result: 'sunk', len: fleet[i].len };
          if (fleet.every((s) => isSunk(s, shots))) {
            state.phase = 'done';
            state.winner = shooter;
            state.wins[shooter] += 1;
          }
        } else {
          state.last = { shooter, result: 'hit' };
        }
        commit();
      }

      function newRound() {
        const started = state.fleets.some(Boolean) || (state.draft && placedShips().length);
        if (state.phase !== 'done' && started && !confirm('Start a new round? This round isn’t finished.')) return;
        state = freshState(state);
        selected = 0;
        commit();
      }

      function resetScores() {
        if (!ui.confirmFreshMatch()) return;
        state.wins = [0, 0];
        state.round = 1;
        commit();
      }

      function onKey(e) {
        if (e.key !== 'r' && e.key !== 'R') return;
        if (state.phase !== 'place' || state.gate || e.ctrlKey || e.metaKey || e.altKey) return;
        rotate();
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
          state.phase === 'done' && renderWinner(),
          renderSettings(),
          state.phase === 'place' && (state.gate ? renderGate() : renderPlacement()),
          state.phase !== 'place' && renderBattle(),
        ]);
      }

      function renderWinner() {
        const winner = ctx.players[state.winner];
        const loser = ctx.players[1 - state.winner];
        const shots = state.shots[state.winner].length;
        return h('div', { class: `banner ${winner.cssClass}` },
          h('span', null, `🏆 ${winner.name} sank ${loser.name}’s whole fleet in ${shots} shots!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
      }

      function renderSettings() {
        const fleetText = `Ships: ${FLEETS[state.size].join(' · ')}`;
        if (settingsLocked()) {
          return h('div', { class: 'ss-summary' },
            h('span', { class: 'pill' }, `${state.size}×${state.size}`),
            h('span', { class: 'pill' }, fleetText));
        }
        return h('div', { class: 'settings-bar ss-settings' },
          ui.stepper({
            label: 'Board',
            groupLabel: 'Board size',
            value: `${state.size}×${state.size}`,
            onMinus: () => setSize(state.size - 1),
            onPlus: () => setSize(state.size + 1),
            canMinus: state.size > SIZE.min,
            canPlus: state.size < SIZE.max,
            minusLabel: 'Smaller board',
            plusLabel: 'Bigger board',
          }),
          h('span', { class: 'ss-settings__fleet' }, fleetText));
      }

      function renderGate() {
        const me = ctx.players[state.placer];
        const other = ctx.players[1 - state.placer];
        return ui.gate({
          player: me,
          emoji: '🙈',
          title: `${me.name}, hide your fleet`,
          text: `${other.name}, look away!`,
          body: h('p', { class: 'ss-gate__note' },
            `Place ${FLEETS[state.size].length} ships on the ${state.size}×${state.size} board. ` +
            'Straight lines only, no overlapping.'),
          actionLabel: 'Place my ships',
          onAction: leaveGate,
        });
      }

      function renderPlacement() {
        const me = ctx.players[state.placer];
        const ship = selected != null ? state.draft[selected] : null;
        const hint = ship ? `Tap a square to place the ${ship.len}-ship`
          : allPlaced() ? 'All set! Tap a ship to move it.' : 'Pick a ship below';
        return h('div', { class: `card ss-place ${me.cssClass}` },
          h('header', { class: 'ss-place__head' },
            h('h2', { class: 'ss-place__title' }, `${me.name}’s fleet`),
            h('span', { class: 'ss-place__hint', 'aria-live': 'polite' }, hint)),
          renderBoard({
            ships: placedShips(),
            prefix: 'place',
            onCell: placeAt,
            onHover: preview,
            label: `${me.name}’s fleet`,
          }),
          h('div', { class: 'ss-tray', role: 'group', 'aria-label': 'Ships' },
            state.draft.map((s, i) => h('button', {
              class: 'btn btn--sm ss-tray__ship' + (selected === i ? ' is-selected' : '') + (s.r != null ? ' is-placed' : ''),
              'aria-pressed': String(selected === i),
              'aria-label': `${s.len}-ship${s.r != null ? ', placed' : ''}`,
              onclick: () => selectShip(i),
            }, blocks(s.len), s.r != null && '✓'))),
          h('div', { class: 'ss-place__tools' },
            h('button', { class: 'btn btn--sm', disabled: !ship, onclick: rotate },
              `↻ Rotate (${ship && ship.dir === 'v' ? 'down' : 'across'})`),
            h('button', { class: 'btn btn--sm', onclick: randomize }, '🎲 Random fleet'),
            h('button', { class: 'btn btn--sm btn--ghost', onclick: clearDraft }, 'Clear')),
          h('button', { class: 'btn btn--primary btn--xl', disabled: !allPlaced(), onclick: lockFleet }, '🔒 Lock my fleet'));
      }

      function blocks(len) {
        return h('span', { class: 'ss-blocks', 'aria-hidden': 'true' }, Array.from({ length: len }, () => h('i')));
      }

      function renderBattle() {
        const players = ctx.players;
        const playing = state.phase === 'play';
        const shooter = players[state.turn];
        return h('div', { class: 'ss-battle' },
          playing && h('div', { class: `ss-turn ${shooter.cssClass}` },
            h('span', { class: 'ss-turn__who' }, `🎯 ${shooter.name}, fire at ${players[1 - state.turn].name}’s waters`),
            state.last && h('span', { class: 'ss-turn__last' }, lastText())),
          h('div', { class: 'player-columns' }, [0, 1].map(renderWaters)));
      }

      function lastText() {
        const name = ctx.players[state.last.shooter].name;
        if (state.last.result === 'miss') return `💦 ${name} missed.`;
        if (state.last.result === 'hit') return '💥 Hit! Go again.';
        return `🔥 Sunk a ${state.last.len}-ship! Go again.`;
      }

      // owner's fleet, fired at by the other player
      function renderWaters(owner) {
        const players = ctx.players;
        const p = players[owner];
        const shots = state.shots[1 - owner];
        const fleet = state.fleets[owner];
        const isTarget = state.phase === 'play' && state.turn !== owner;
        const done = state.phase === 'done';
        const afloat = fleet.filter((s) => !isSunk(s, shots)).length;
        // Sunk ships are always shown; the rest only once the round is over.
        const shown = fleet.filter((s) => done || isSunk(s, shots));

        return h('section', { class: `player-col ss-waters ${p.cssClass}` + (isTarget ? ' is-target' : '') },
          h('header', { class: 'player-col__head' },
            h('div', null,
              h('h2', { class: 'player-col__name' }, `${p.name}’s waters`),
              h('div', { class: 'player-col__sub' },
                `${players[1 - owner].name} ${isTarget ? 'is firing' : 'fires here'}`)),
            h('span', { class: 'counter' + (afloat === 0 ? ' counter--max' : '') }, `${afloat} / ${fleet.length} afloat`)),
          renderBoard({
            ships: shown,
            shots,
            fleet,
            prefix: `w${owner}`,
            onCell: isTarget ? fire : null,
            label: `${p.name}’s waters`,
          }),
          h('div', { class: 'ss-fleet', 'aria-label': 'Ships' },
            fleet.map((s) => h('span', { class: 'ss-fleet__ship' + (isSunk(s, shots) ? ' is-sunk' : '') }, blocks(s.len)))),
          h('p', { class: 'ss-waters__stats' },
            `${hitsOn(fleet, shots)} hits from ${shots.length} shots`));
      }

      // One grid. Cells are buttons placed explicitly; ships are overlays spanning their cells.
      function renderBoard({ ships, shots = [], fleet = [], prefix, onCell, onHover, label }) {
        const n = state.size;
        const cells = [];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const key = cellKey(r, c);
            const shot = shots.includes(key);
            const hit = shot && shipAt(fleet, r, c) >= 0;
            const status = shot ? (hit ? ', hit' : ', miss') : '';
            cells.push(h('button', {
              class: 'ss-cell' + (shot ? (hit ? ' is-hit' : ' is-miss') : ''),
              style: `grid-row:${r + 1};grid-column:${c + 1}`,
              'data-cell': key,
              'data-focus-key': `${prefix}-${r}-${c}`,
              'aria-label': cellName(r, c) + status,
              disabled: !onCell || shot,
              onclick: onCell ? () => onCell(r, c) : null,
              onmouseenter: onHover ? () => onHover(r, c) : null,
            }, shot ? (hit ? '💥' : '•') : ''));
          }
        }
        const overlays = ships.map((s) => h('div', {
          class: 'ss-ship' + (shots.length > 0 && isSunk(s, shots) ? ' is-sunk' : '') +
            (state.phase === 'done' && !isSunk(s, shots) ? ' is-ghost' : ''),
          style: `grid-row:${s.r + 1} / span ${s.dir === 'v' ? s.len : 1};` +
            `grid-column:${s.c + 1} / span ${s.dir === 'h' ? s.len : 1}`,
          'aria-hidden': 'true',
        }));
        return h('div', {
          class: 'ss-board' + (onCell ? ' is-live' : ''),
          style: `--n:${n}`,
          role: 'group',
          'aria-label': label,
          onmouseleave: onHover ? clearPreview : null,
        }, cells, overlays);
      }

      render();
      return () => document.removeEventListener('keydown', onKey);
    },
  });
})();
