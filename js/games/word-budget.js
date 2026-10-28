/*
 * Word Budget
 * The clue-giver sees a list of words and has a budget of spoken clue words to get the
 * guesser (who never looks at the screen) to say them all. Each round both players
 * take a turn giving clues. Most words guessed wins; fewer clues used breaks a tie.
 * Word bank: js/games/word-budget-words.js (GameHub.assets['word-budget']).
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  const WORDS = { min: 3, max: 15, def: 8 };
  const CLUES = { max: 50, def: 15 };
  const TIMER_OPTIONS = [0, 60, 90, 120, 180, 300]; // seconds; 0 = off
  // Harder categories are dealt less often when they're switched on.
  const CATEGORIES = [
    { id: 'things', label: '🐘 Things', weight: 4 },
    { id: 'people', label: '🎤 People & places', weight: 3 },
    { id: 'actions', label: '🏃 Actions', weight: 1.5 },
    { id: 'describe', label: '✨ Describing', weight: 1 },
  ];
  const DEFAULT_TYPES = ['things', 'people'];

  function bank() {
    const asset = GameHub.assets['word-budget'];
    return asset ? asset.bank : {};
  }

  function freshSettings() {
    return { words: WORDS.def, clues: CLUES.def, timer: 0, types: DEFAULT_TYPES.slice() };
  }

  function freshState(prev) {
    const round = prev ? prev.round + 1 : 1;
    return {
      round,
      wins: prev ? prev.wins : [0, 0],
      settings: prev ? prev.settings : freshSettings(),
      first: (round - 1) % 2,  // who gives clues first; alternates each round
      giver: (round - 1) % 2,  // who is giving clues now
      phase: 'gate',           // 'gate' -> 'play' -> 'gate' (other player) -> 'play' -> 'results'
      turns: [null, null],     // turns[i] = player i's turn as clue-giver
      winner: null,            // 0 | 1 | 'tie' once both turns are done
    };
  }

  // A turn: { cards: [{ word, clues, got }], log: [cardIndex | -1-cardIndex], startedAt, endedAt, end }
  // log entries: n = a clue on card n, -1-n = card n marked as got (so undo can reverse either).
  const cluesUsed = (turn) => turn.cards.reduce((sum, c) => sum + c.clues, 0);
  const wordsGot = (turn) => turn.cards.filter((c) => c.got).length;

  function timeLeft(turn, seconds, now = Date.now()) {
    return Math.max(0, seconds * 1000 - ((turn.endedAt || now) - turn.startedAt));
  }

  const clueText = (n) => `${n} ${n === 1 ? 'clue' : 'clues'}`;

  function formatSeconds(ms) {
    const secs = Math.ceil(ms / 1000);
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }

  // Weighted pick of a category per slot, then a random unseen word from it.
  // When a category runs out of unseen words, its words become available again.
  function dealWords(count, types, seen) {
    const words = bank();
    const cats = CATEGORIES.filter((c) => types.includes(c.id) && (words[c.id] || []).length);
    const seenSet = new Set(seen.map((w) => w.toLowerCase()));
    const picked = [];
    const pickedSet = new Set();

    for (let n = 0; n < count && cats.length; n++) {
      const total = cats.reduce((sum, c) => sum + c.weight, 0);
      let r = Math.random() * total;
      const cat = cats.find((c) => (r -= c.weight) < 0) || cats[cats.length - 1];
      const list = words[cat.id];
      let pool = list.filter((w) => !seenSet.has(w.toLowerCase()) && !pickedSet.has(w.toLowerCase()));
      if (!pool.length) {
        list.forEach((w) => seenSet.delete(w.toLowerCase()));
        pool = list.filter((w) => !pickedSet.has(w.toLowerCase()));
      }
      if (!pool.length) { n--; cats.splice(cats.indexOf(cat), 1); continue; }
      const word = pool[Math.floor(Math.random() * pool.length)];
      picked.push(word);
      pickedSet.add(word.toLowerCase());
      seenSet.add(word.toLowerCase());
    }
    return { picked, seen: [...seenSet] };
  }

  GameHub.register({
    id: 'word-budget',
    title: 'Word Budget',
    emoji: '💬',
    description: 'Get your partner to say every word on the list, using only a limited budget of one-word clues.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      if (!state.settings) state.settings = freshSettings();
      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      const turn = () => state.turns[state.giver];
      const settings = () => state.settings;
      const roundStarted = () => state.turns.some(Boolean);

      // ---- settings (only before the round's first turn) -------------------
      function setWords(n) {
        const s = settings();
        s.words = Math.min(WORDS.max, Math.max(WORDS.min, n));
        if (s.clues < s.words) s.clues = s.words; // every word needs at least one clue
        commit();
      }

      function setClues(n) {
        const s = settings();
        s.clues = Math.min(CLUES.max, Math.max(s.words, n));
        commit();
      }

      function setTimer(seconds) {
        settings().timer = seconds;
        commit();
      }

      function toggleType(id) {
        const types = settings().types;
        const i = types.indexOf(id);
        if (i >= 0) {
          if (types.length === 1) return; // keep at least one category on
          types.splice(i, 1);
        } else {
          types.push(id);
        }
        commit();
      }

      // ---- turn flow -------------------------------------------------------
      function startTurn() {
        const s = settings();
        const { picked, seen } = dealWords(s.words, s.types, ctx.storage.get('seen', []));
        ctx.storage.set('seen', seen);
        state.turns[state.giver] = {
          cards: picked.map((word) => ({ word, clues: 0, got: false })),
          log: [],
          startedAt: Date.now(),
          endedAt: null,
          end: null, // 'all' | 'stopped' | 'time'
        };
        state.phase = 'play';
        commit();
      }

      function addClue(n) {
        const t = turn();
        if (t.endedAt || cluesUsed(t) >= settings().clues || t.cards[n].got) return;
        t.cards[n].clues += 1;
        t.log.push(n);
        commit();
      }

      function markGot(n) {
        const t = turn();
        if (t.endedAt || t.cards[n].got) return;
        t.cards[n].got = true;
        t.log.push(-1 - n);
        if (t.cards.every((c) => c.got)) return endTurn('all');
        commit();
      }

      function undo() {
        const t = turn();
        if (t.endedAt || !t.log.length) return;
        const entry = t.log.pop();
        if (entry >= 0) t.cards[entry].clues -= 1;
        else t.cards[-1 - entry].got = false;
        commit();
      }

      function stopTurn() {
        const t = turn();
        const outOfClues = cluesUsed(t) >= settings().clues;
        if (!outOfClues && !confirm('End your turn now? You still have clues left.')) return;
        endTurn('stopped');
      }

      function endTurn(reason) {
        const t = turn();
        t.endedAt = Date.now();
        t.end = reason;
        const other = 1 - state.giver;
        if (state.turns[other]) {
          state.phase = 'results';
          state.winner = winnerOf();
          if (state.winner !== 'tie') state.wins[state.winner] += 1;
        } else {
          state.giver = other;
          state.phase = 'gate';
        }
        commit();
      }

      // Most words guessed wins; fewer clues used breaks a tie.
      function winnerOf() {
        const [a, b] = state.turns;
        const diff = (wordsGot(b) - wordsGot(a)) || (cluesUsed(a) - cluesUsed(b));
        return diff === 0 ? 'tie' : (diff > 0 ? 1 : 0);
      }

      function newRound() {
        const inProgress = state.phase !== 'results' && roundStarted();
        if (inProgress && !confirm('Start a new round? This round isn’t finished.')) return;
        state = freshState(state);
        commit();
      }

      function resetScores() {
        if (!ui.confirmFreshMatch()) return;
        state.wins = [0, 0];
        state.round = 1;
        commit();
      }

      // The countdown only updates its own text; when it hits zero the turn ends.
      function checkClock() {
        const t = state.phase === 'play' && turn();
        const seconds = settings().timer;
        if (!t || !seconds || t.endedAt) return;
        const left = timeLeft(t, seconds);
        if (left <= 0) return endTurn('time');
        const el = root.querySelector('.wb-hud__time');
        if (el) {
          el.textContent = formatSeconds(left);
          el.classList.toggle('is-low', left <= 10000);
        }
      }
      const ticker = setInterval(checkClock, 250);

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
          state.phase === 'results' && renderWinner(),
          renderSettings(),
          state.phase === 'gate' && renderGate(),
          state.phase === 'play' && renderPlay(),
          state.phase === 'results' && renderResults(),
        ]);
      }

      function renderWinner() {
        if (state.winner === 'tie') {
          return h('div', { class: 'banner is-draw' },
            h('span', null, '🤝 Dead heat! Same words, same clues.'),
            h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
        }
        const winner = ctx.players[state.winner];
        return h('div', { class: `banner ${winner.cssClass}` },
          h('span', null, `🏆 ${winner.name} wins round ${state.round}!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round'));
      }

      function stepper(label, value, onMinus, onPlus, canMinus, canPlus) {
        return ui.stepper({
          label, value, onMinus, onPlus, canMinus, canPlus,
          minusLabel: `Fewer ${label.toLowerCase()}`,
          plusLabel: `More ${label.toLowerCase()}`,
        });
      }

      // Editable before the round's first turn; a read-only summary after that, so both turns match.
      function renderSettings() {
        const s = settings();
        if (roundStarted()) {
          return h('div', { class: 'wb-summary' },
            h('span', { class: 'pill' }, `${s.words} words`),
            h('span', { class: 'pill' }, `${s.clues} clues`),
            h('span', { class: 'pill' }, s.timer ? `⏱️ ${formatSeconds(s.timer * 1000)}` : 'No timer'),
            CATEGORIES.filter((c) => s.types.includes(c.id)).map((c) => h('span', { class: 'pill' }, c.label)));
        }
        const timerIdx = TIMER_OPTIONS.indexOf(s.timer);
        return h('div', { class: 'settings-bar wb-settings' },
          stepper('Words', s.words, () => setWords(s.words - 1), () => setWords(s.words + 1),
            s.words > WORDS.min, s.words < WORDS.max),
          stepper('Clues', s.clues, () => setClues(s.clues - 1), () => setClues(s.clues + 1),
            s.clues > s.words, s.clues < CLUES.max),
          stepper('Timer', s.timer ? formatSeconds(s.timer * 1000) : 'Off',
            () => setTimer(TIMER_OPTIONS[timerIdx - 1]), () => setTimer(TIMER_OPTIONS[timerIdx + 1]),
            timerIdx > 0, timerIdx < TIMER_OPTIONS.length - 1),
          h('div', { class: 'wb-types', role: 'group', 'aria-label': 'Word types' },
            CATEGORIES.map((c) => {
              const on = s.types.includes(c.id);
              return h('button', {
                class: 'btn btn--sm wb-type' + (on ? ' is-active' : ''),
                'aria-pressed': String(on),
                onclick: () => toggleType(c.id),
              }, c.label);
            }))
        );
      }

      function renderGate() {
        const players = ctx.players;
        const me = players[state.giver];
        const other = players[1 - state.giver];
        const done = state.turns[1 - state.giver];
        const s = settings();
        return ui.gate({
          player: me,
          emoji: '🙉',
          title: `${me.name}, you’re giving clues`,
          text: `${other.name}, turn around. No looking at the screen!`,
          body: [
            done && h('p', { class: 'wb-gate__beat' },
              `To beat: ${other.name} got ${wordsGot(done)} / ${done.cards.length} with ${cluesUsed(done)} clues.`),
            h('ul', { class: 'wb-rules' },
              h('li', null, `Get ${other.name} to say all ${s.words} words using ${s.clues} clue words or fewer.`),
              h('li', null, 'Every word you say counts: “Destiny’s Child” is 2 clues. Tap +1 for each one.'),
              h('li', null, 'No part of the word itself, no gestures, no “sounds like”. Guesses are free.')),
          ],
          actionLabel: 'Deal my words',
          onAction: startTurn,
        });
      }

      function renderPlay() {
        const me = ctx.players[state.giver];
        const t = turn();
        const s = settings();
        const used = cluesUsed(t);
        const out = used >= s.clues;
        return h('div', { class: `wb-play ${me.cssClass}` },
          h('div', { class: 'wb-hud' },
            h('div', { class: 'wb-hud__clues' + (out ? ' is-out' : '') },
              h('span', { class: 'wb-hud__big' }, used, h('small', null, ` / ${s.clues}`)),
              h('span', { class: 'wb-hud__label' }, out ? 'Out of clues: last guesses!' : `clues · ${s.clues - used} left`)),
            s.timer > 0 && h('span', { class: 'wb-hud__time', role: 'timer' }, formatSeconds(timeLeft(t, s.timer))),
            h('span', { class: 'wb-hud__got' }, `${wordsGot(t)} / ${t.cards.length} got`),
            h('div', { class: 'wb-hud__actions' },
              h('button', { class: 'btn btn--sm', disabled: !t.log.length, onclick: undo }, '↶ Undo'),
              h('button', { class: 'btn btn--sm' + (out ? ' btn--primary' : ''), onclick: stopTurn }, 'End turn'))),
          h('ol', { class: 'wb-cards' }, t.cards.map((card, n) => renderCard(card, n, out))));
      }

      function renderCard(card, n, out) {
        if (card.got) {
          return h('li', { class: 'wb-card is-got' },
            h('span', { class: 'wb-card__word' }, card.word),
            h('span', { class: 'wb-card__got' }, `✓ ${clueText(card.clues)}`));
        }
        return h('li', { class: 'wb-card' },
          h('span', { class: 'wb-card__word' }, card.word),
          h('span', { class: 'wb-card__count' }, card.clues ? clueText(card.clues) : ''),
          h('span', { class: 'wb-card__actions' },
            h('button', { class: 'btn wb-card__clue', disabled: out, onclick: () => addClue(n) }, '+1 clue'),
            h('button', { class: 'btn wb-card__tick', 'aria-label': `Got ${card.word}`, onclick: () => markGot(n) }, '✓')));
      }

      function renderResults() {
        const players = ctx.players;
        const order = [state.first, 1 - state.first];
        const endText = { all: 'Got them all!', stopped: 'Ended the turn', time: '⏱️ Time’s up' };
        return h('div', { class: 'player-columns' },
          order.map((i) => {
            const p = players[i];
            const t = state.turns[i];
            return h('section', { class: `player-col ${p.cssClass}` + (state.winner === i ? ' is-winner' : '') },
              h('header', { class: 'player-col__head' },
                h('h2', { class: 'player-col__name' }, (state.winner === i ? '👑 ' : '') + p.name),
                h('span', { class: 'counter' }, `${wordsGot(t)} / ${t.cards.length}`)),
              h('p', { class: 'wb-result__sub' }, `${cluesUsed(t)} clues used · ${endText[t.end] || ''}`),
              h('ul', { class: 'wb-result__list' },
                t.cards.map((c) => h('li', { class: 'wb-result__row' + (c.got ? ' is-got' : '') },
                  h('span', null, (c.got ? '✓ ' : '✗ ') + c.word),
                  h('span', { class: 'wb-result__clues' }, clueText(c.clues))))));
          }));
      }

      checkClock(); // a timer that ran out while the page was closed ends the turn now
      render();
      return () => clearInterval(ticker);
    },
  });
})();
