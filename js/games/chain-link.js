/*
 * Chain Link
 * Each player secretly builds a chain of words for the other, where every word
 * joins onto the one before it (book → case → closed → book → worm).
 * The solver sees the first word in full and only the first letter of the
 * rest (no length hint), and must solve them in order. One player solves at a
 * time against the clock. Hints reveal one more letter and add a time penalty.
 * Lowest time wins.
 *
 * Builders get suggestions from the offline list in chain-link-words.js.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;
  const LENGTHS = [4, 5, 6, 7, 8];
  const DEFAULT_LENGTH = 5;
  const MIN_WORD = 2;
  const MAX_CHIPS = 30;
  const HINT_PENALTY_MS = 10000; // each revealed letter adds this to the solver's time
  const links = (GameHub.assets['chain-link'] || {}).links || {};
  const heads = Object.keys(links);

  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Words known to follow `word`, ones that lead somewhere further listed first.
  function followers(word) {
    return (links[clean(word)] || []).slice().sort((a, b) =>
      (links[b] ? 1 : 0) - (links[a] ? 1 : 0) || a.localeCompare(b));
  }

  function pickStarters(n) {
    return shuffle(heads.filter((w) => links[w].length >= 5)).slice(0, n);
  }

  // Random walk through the word list, no repeats. Returns null if it can't find one.
  function randomChain(length) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const chain = pickStarters(1);
      if (!chain.length) return null;
      while (chain.length < length) {
        const isLast = chain.length === length - 1;
        const options = shuffle(links[chain[chain.length - 1]] || [])
          .filter((w) => !chain.includes(w) && (isLast || links[w]));
        if (!options.length) break;
        chain.push(options[0]);
      }
      if (chain.length === length) return chain;
    }
    return null;
  }

  function freshBoard() {
    // row: index of the word being solved (0 is given). shown: letters visible in that row.
    // startedAt / finishedAt: Date.now() timestamps, so the clock survives a refresh.
    return { row: 1, shown: 1, hints: 0, lastWrong: '', startedAt: null, finishedAt: null };
  }

  // Elapsed solve time plus the hint penalty, in ms.
  function boardTime(board, now = Date.now()) {
    if (!board.startedAt) return 0;
    return (board.finishedAt || now) - board.startedAt + board.hints * HINT_PENALTY_MS;
  }

  function formatTime(ms) {
    const tenths = Math.max(0, Math.floor(ms / 100));
    const secs = Math.floor(tenths / 10);
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}.${tenths % 10}`;
  }

  function freshState(prev) {
    const round = prev ? prev.round + 1 : 1;
    return {
      round,
      solver: (round - 1) % 2, // who solves first; alternates each round
      wins: prev ? prev.wins : [0, 0],
      length: prev ? prev.length : DEFAULT_LENGTH,
      phase: 'build',      // 'build' -> 'play'
      builder: 0,          // who is building right now
      gate: true,          // show the "look away" screen before building
      draft: [],           // the current builder's words in progress
      chains: [null, null], // chains[i] = built BY player i (solved by the other)
      boards: [freshBoard(), freshBoard()], // boards[i] = player i solving chains[1 - i]
      scored: false,
    };
  }

  GameHub.register({
    id: 'chain-link',
    title: 'Chain Link',
    emoji: '🔗',
    description: 'Build a secret chain of linked words (book → case → closed). Race the clock to solve each other’s chains from just the first letters.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      if (state.phase === 'build') state.gate = true; // never reopen a half-built chain after a refresh
      if (state.solver == null) state.solver = 0;     // saves from before the timed version
      let starters = pickStarters(8);
      const guessDrafts = ['', ''];
      let shake = null; // board index to shake once after a wrong guess

      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };
      const chainFor = (i) => state.chains[1 - i];

      const focus = (key) => ui.focus(root, key);

      // ---- build actions ---------------------------------------------------
      function startBuilding() {
        state.gate = false;
        commit();
        focus('b-0');
      }

      function setLength(n) {
        state.length = n;
        state.draft = state.draft.slice(0, n);
        commit();
      }

      function setWord(k, value) {
        state.draft[k] = value;
        commit();
      }

      function pickWord(k, word) {
        state.draft[k] = word;
        commit();
        focus(k + 1 < state.length ? `b-${k + 1}` : 'lock');
      }

      function fillRandom() {
        const chain = randomChain(state.length);
        if (chain) {
          state.draft = chain;
          commit();
        }
      }

      function draftComplete() {
        for (let k = 0; k < state.length; k++) {
          if (clean(state.draft[k]).length < MIN_WORD) return false;
        }
        return true;
      }

      function lockChain() {
        if (!draftComplete()) return;
        state.chains[state.builder] = state.draft.slice(0, state.length).map(clean);
        state.draft = [];
        if (state.builder === 0) {
          state.builder = 1;
          state.gate = true;
        } else {
          state.phase = 'play';
        }
        commit();
      }

      // ---- play actions (one solver at a time: state.solver) ----------------
      function startSolving() {
        const board = state.boards[state.solver];
        if (!board.startedAt) board.startedAt = Date.now();
        commit();
        focus(`guess-${state.solver}`);
      }

      function advance(i) {
        const board = state.boards[i];
        board.row += 1;
        board.shown = 1;
        board.lastWrong = '';
        if (board.row >= chainFor(i).length) finish(i);
      }

      function finish(i) {
        state.boards[i].finishedAt = Date.now();
        if (!state.boards[1 - i].finishedAt) {
          state.solver = 1 - i;
          return;
        }
        const winner = winnerOf();
        if (winner !== null) state.wins[winner] += 1;
        state.scored = true;
      }

      function guess(i) {
        const board = state.boards[i];
        const chain = chainFor(i);
        const attempt = clean(guessDrafts[i]);
        if (!attempt || board.row >= chain.length) return;
        // Accept the whole word, or just the part after the letters already shown.
        const word = chain[board.row];
        if (attempt === word || word.slice(0, board.shown) + attempt === word) {
          advance(i);
        } else {
          board.lastWrong = attempt;
          shake = i;
        }
        guessDrafts[i] = '';
        commit();
        focus(`guess-${i}`);
      }

      function hint(i) {
        const board = state.boards[i];
        const word = chainFor(i)[board.row];
        board.hints += 1;
        board.shown += 1;
        board.lastWrong = '';
        guessDrafts[i] = ''; // a typed remainder no longer lines up with the new prefix
        if (board.shown >= word.length) advance(i);
        commit();
        focus(`guess-${i}`);
      }

      function winnerOf() {
        const [a, b] = state.boards.map((board) => boardTime(board));
        return a === b ? null : (a < b ? 0 : 1);
      }

      // Update just the clock text 10x a second (a full re-render would disturb typing).
      const ticker = setInterval(() => {
        if (state.phase !== 'play' || state.scored) return;
        const board = state.boards[state.solver];
        const el = root.querySelector('.cl-timer__value');
        if (el && board.startedAt && !board.finishedAt) el.textContent = formatTime(boardTime(board));
      }, 100);

      function newRound() {
        const inProgress = !state.scored &&
          (state.phase === 'play' || state.chains[0] || state.draft.some(Boolean));
        if (inProgress && !confirm('Start a new round? This round isn’t finished.')) return;
        state = freshState(state);
        guessDrafts[0] = guessDrafts[1] = '';
        starters = pickStarters(8);
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
          state.phase === 'build' ? renderBuild() : renderPlay(),
        ]);
        shake = null;
      }

      // Build phase ------------------------------------------------------------
      function renderBuild() {
        const players = ctx.players;
        const me = players[state.builder];
        const other = players[1 - state.builder];

        if (state.gate) {
          return h('div', { class: `card cl-gate ${me.cssClass}` },
            h('div', { class: 'cl-gate__emoji', 'aria-hidden': 'true' }, '🙈'),
            h('h2', { class: 'cl-gate__title' }, `${me.name}, build a chain for ${other.name}`),
            h('p', { class: 'cl-gate__text' }, `${other.name}, look away!`),
            state.builder === 0 && h('div', { class: 'cl-length' },
              h('span', { class: 'cl-length__label' }, 'Words per chain'),
              LENGTHS.map((n) =>
                h('button', {
                  class: 'btn btn--sm' + (n === state.length ? ' is-active' : ''),
                  onclick: () => setLength(n),
                }, n)
              )
            ),
            h('button', { class: 'btn btn--primary btn--xl', onclick: startBuilding }, `I’m ${me.name}, let’s go`)
          );
        }

        const rows = [];
        for (let k = 0; k < state.length; k++) rows.push(renderBuildRow(k));

        return h('div', { class: `cl-build ${me.cssClass}` },
          h('div', { class: 'cl-build__head' },
            h('h2', { class: 'cl-build__title' }, `${me.name}’s chain for ${other.name}`),
            h('p', { class: 'cl-build__help' },
              `Each word joins onto the one before it (book + case = bookcase). ${other.name} sees the first word in full and only the first letter of the rest.`)
          ),
          h('div', { class: 'cl-build__tools' },
            h('button', { class: 'btn btn--sm', onclick: fillRandom }, '🎲 Random chain'),
            h('button', {
              class: 'btn btn--ghost btn--sm',
              disabled: !state.draft.some(Boolean),
              onclick: () => { state.draft = []; commit(); },
            }, 'Clear')
          ),
          h('ol', { class: 'cl-build__rows' }, rows),
          h('button', {
            class: 'btn btn--primary btn--xl cl-build__lock',
            disabled: !draftComplete(),
            'data-focus-key': 'lock',
            onclick: lockChain,
          }, state.builder === 0 ? `🔒 Lock & pass to ${other.name}` : '🔒 Lock & start playing')
        );
      }

      function chip(k, word, deadEnd) {
        return h('button', {
          class: 'cl-chip' + (deadEnd ? ' is-dead' : ''),
          title: deadEnd ? 'No ideas after this one' : null,
          onclick: () => pickWord(k, word),
        }, word);
      }

      function renderBuildRow(k) {
        const word = state.draft[k] || '';
        const prev = k > 0 ? clean(state.draft[k - 1]) : '';
        const isLast = k === state.length - 1;
        const known = prev && word && (links[prev] || []).includes(clean(word));

        let ideas = null;
        if (!word && k === 0) {
          ideas = h('div', { class: 'cl-chips' },
            h('span', { class: 'cl-chips__label' }, 'Ideas:'),
            starters.map((w) => chip(k, w, false)),
            h('button', {
              class: 'icon-btn',
              title: 'More ideas',
              'aria-label': 'More ideas',
              onclick: () => { starters = pickStarters(8); render(); },
            }, '↻')
          );
        } else if (!word && prev) {
          const options = followers(prev).slice(0, MAX_CHIPS);
          ideas = h('div', { class: 'cl-chips' },
            options.length
              ? [h('span', { class: 'cl-chips__label' }, `${prev} + …`),
                 options.map((w) => chip(k, w, !isLast && !links[w]))]
              : h('span', { class: 'cl-chips__label' }, `No ideas for “${prev}”. Type your own.`)
          );
        }

        return h('li', { class: 'cl-build-row' },
          h('span', { class: 'cl-num' }, k + 1),
          h('div', { class: 'cl-build-row__main' },
            h('input', {
              class: 'input',
              type: 'text',
              autocomplete: 'off',
              autocapitalize: 'off',
              spellcheck: 'false',
              placeholder: k === 0 ? 'First word (shown in full)' : (prev ? `What joins onto “${prev}”?` : 'Next word'),
              value: word,
              'data-focus-key': `b-${k}`,
              oninput: (e) => setWord(k, e.target.value.replace(/[^a-zA-Z]/g, '')),
            }),
            prev && word && h('span', { class: 'cl-preview' + (known ? ' is-known' : '') },
              `${prev} + ${clean(word)}`, known ? ' ✓' : ''),
            ideas
          )
        );
      }

      // Play phase -------------------------------------------------------------
      function renderPlay() {
        if (state.scored) return renderResults();

        const players = ctx.players;
        const i = state.solver;
        const me = players[i];
        const setter = players[1 - i];
        const board = state.boards[i];
        const otherBoard = state.boards[1 - i];
        const toBeat = otherBoard.finishedAt
          ? h('p', { class: 'cl-to-beat' }, `${players[1 - i].name}’s time to beat: `,
              h('strong', null, formatTime(boardTime(otherBoard))))
          : null;

        if (!board.startedAt) {
          return h('div', { class: `card cl-gate ${me.cssClass}` },
            h('div', { class: 'cl-gate__emoji', 'aria-hidden': 'true' }, '⏱️'),
            h('h2', { class: 'cl-gate__title' }, `${me.name}, you’re up!`),
            h('p', { class: 'cl-gate__text' },
              `Solve ${setter.name}’s ${chainFor(i).length}-word chain as fast as you can. ` +
              `Each 💡 hint adds ${HINT_PENALTY_MS / 1000} seconds.`),
            toBeat,
            h('button', { class: 'btn btn--primary btn--xl', onclick: startSolving }, 'Start the clock')
          );
        }

        return h('div', { class: 'cl-solo' },
          h('div', { class: `cl-timer ${me.cssClass}` },
            h('span', { class: 'cl-timer__value', role: 'timer' }, formatTime(boardTime(board))),
            board.hints > 0 && h('span', { class: 'cl-timer__penalty' },
              `includes +${board.hints * HINT_PENALTY_MS / 1000}s for ${plural(board.hints, 'hint')}`),
            toBeat
          ),
          renderBoard(i)
        );
      }

      function renderResults() {
        const players = ctx.players;
        const winner = winnerOf();
        const times = state.boards.map((b) => boardTime(b));
        const margin = Math.abs(times[0] - times[1]);
        return [
          h('div', { class: 'banner ' + (winner === null ? 'is-draw' : players[winner].cssClass) },
            h('span', null, winner === null
              ? `🤝 Round ${state.round} is a dead heat!`
              : `🏆 ${players[winner].name} wins round ${state.round} by ${formatTime(margin)}`),
            h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round')
          ),
          h('div', { class: 'cl-results' },
            [0, 1].map((i) => {
              const board = state.boards[i];
              return h('div', { class: `cl-result ${players[i].cssClass}` + (winner === i ? ' is-winner' : '') },
                h('span', { class: 'cl-result__name' }, winner === i ? '👑 ' : '', players[i].name),
                h('span', { class: 'cl-result__time' }, formatTime(times[i])),
                h('span', { class: 'cl-result__meta' },
                  board.hints
                    ? `${plural(board.hints, 'hint')} (+${board.hints * HINT_PENALTY_MS / 1000}s)`
                    : 'no hints'),
                h('span', { class: 'cl-result__chain' },
                  chainFor(i).map((w) => w.toUpperCase()).join(' → '))
              );
            })
          ),
        ];
      }

      function renderBoard(i) {
        const players = ctx.players;
        const me = players[i];
        const setter = players[1 - i];
        const board = state.boards[i];
        const chain = chainFor(i);

        return h('section', { class: `cl-board ${me.cssClass}` },
          h('header', { class: 'cl-board__head' },
            h('h2', { class: 'cl-board__name' }, me.name),
            h('span', { class: 'cl-board__sub' }, `solving ${setter.name}’s chain`)
          ),
          h('ol', { class: 'cl-rows' }, chain.map((word, r) => renderRow(i, board, word, r))),
          board.lastWrong && h('p', { class: 'cl-wrong' }, `✗ “${board.lastWrong}” isn’t it`)
        );
      }

      function renderRow(i, board, word, r) {
        const num = h('span', { class: 'cl-num' }, r + 1);
        if (r < board.row) {
          return h('li', { class: 'cl-row is-solved' },
            num,
            h('span', { class: 'cl-word' }, word.toUpperCase())
          );
        }
        if (r > board.row) {
          return h('li', { class: 'cl-row' },
            num,
            h('span', { class: 'cl-word' }, word[0].toUpperCase(), h('span', { class: 'cl-blank' }, '…'))
          );
        }
        // Current row: revealed letters, then the player types the rest inline.
        return h('li', { class: 'cl-row is-current' + (shake === i ? ' is-wrong' : '') },
          num,
          h('span', { class: 'cl-fill' },
            h('span', { class: 'cl-word' }, word.slice(0, board.shown).toUpperCase()),
            h('input', {
              class: 'cl-fill__input',
              type: 'text',
              autocomplete: 'off',
              autocapitalize: 'off',
              spellcheck: 'false',
              enterkeyhint: 'go',
              'aria-label': `Word ${r + 1}`,
              placeholder: '…',
              value: guessDrafts[i],
              'data-focus-key': `guess-${i}`,
              oninput: (e) => { guessDrafts[i] = e.target.value; },
              onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); guess(i); } },
            })
          ),
          h('button', { class: 'btn btn--primary btn--sm', onclick: () => guess(i) }, 'Go'),
          h('button', {
            class: 'btn btn--sm',
            title: `Reveal the next letter (+${HINT_PENALTY_MS / 1000}s)`,
            'aria-label': `Hint: reveal the next letter, adds ${HINT_PENALTY_MS / 1000} seconds`,
            onclick: () => hint(i),
          }, '💡')
        );
      }

      render();
      return () => clearInterval(ticker);
    },
  });
})();
