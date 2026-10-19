/*
 * First & Last
 * Reveal two random letters: the first and last letter of a word. The first
 * player to say a real word of 5+ letters that fits taps their name to score.
 *
 * Letters are weighted so most pairs are playable (lots of S/C/P starts and
 * E/S/T/Y endings, no X/Z endings). Tweak the tables below to change difficulty.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;
  const MIN_WORD_LENGTH = 5;
  const HISTORY_LIMIT = 50;

  const FIRST_WEIGHTS = {
    s: 11, c: 9, p: 8, b: 6, d: 6, m: 6, t: 6, a: 6, r: 5, f: 5, h: 5,
    g: 4, l: 4, w: 4, e: 4, i: 3, o: 3, n: 3, u: 2, v: 2, k: 1.5, j: 1, y: 0.8, q: 0.5, z: 0.4,
  };
  const LAST_WEIGHTS = {
    e: 12, s: 10, t: 8, y: 7, d: 7, n: 7, r: 6, l: 5, h: 3, k: 3, g: 3,
    a: 3, c: 2, m: 2, p: 2, o: 2, w: 1, f: 1,
  };

  function weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [letter, w] of entries) {
      r -= w;
      if (r < 0) return letter;
    }
    return entries[entries.length - 1][0];
  }

  function dealPair(prev) {
    let pair;
    do {
      pair = { first: weightedPick(FIRST_WEIGHTS), last: weightedPick(LAST_WEIGHTS) };
    } while (prev && pair.first === prev.first && pair.last === prev.last);
    return pair;
  }

  function freshState() {
    return { scores: [0, 0], current: null, dealId: 0, claimed: false, history: [] };
  }

  GameHub.register({
    id: 'first-last',
    title: 'First & Last',
    emoji: '🔤',
    description: `Two letters appear. First to say a ${MIN_WORD_LENGTH}+ letter word that starts and ends with them scores a point.`,

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      let justDealt = false; // play the tile animation only right after a deal
      let bumped = null;     // player index whose score just changed

      const commit = () => { ctx.storage.set('state', state); render(); };

      // ---- actions ---------------------------------------------------------
      function deal() {
        state.current = dealPair(state.current);
        state.dealId += 1;
        state.claimed = false;
        justDealt = true;
        commit();
      }

      function award(i) {
        if (!state.current || state.claimed) return;
        state.scores[i] += 1;
        state.claimed = true;
        state.history.unshift({ ...state.current, winner: i, dealId: state.dealId });
        state.history.length = Math.min(state.history.length, HISTORY_LIMIT);
        bumped = i;
        commit();
      }

      function undo() {
        const last = state.history.shift();
        if (!last) return;
        state.scores[last.winner] = Math.max(0, state.scores[last.winner] - 1);
        if (last.dealId === state.dealId) state.claimed = false;
        bumped = last.winner;
        commit();
      }

      function reset() {
        if (!confirm('Reset scores to 0–0 and clear history?')) return;
        state = freshState();
        commit();
      }

      // Space = deal, 1 / 2 = award point. Ignored while typing or when a
      // focused button would already handle the key itself.
      function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target instanceof Element ? e.target : null;
        if (target && target.closest('input, textarea, select, [contenteditable]')) return;
        if (e.key === ' ') {
          if (target && target.closest('button, a')) return;
          e.preventDefault();
          deal();
        } else if (e.key === '1' || e.key === '2') {
          award(Number(e.key) - 1);
        }
      }

      // ---- rendering -------------------------------------------------------
      function tile(letter, label) {
        return h('div', { class: 'fl-tile' + (letter ? '' : ' fl-tile--empty') },
          h('span', { class: 'fl-tile__letter' }, letter ? letter.toUpperCase() : '?'),
          h('span', { class: 'fl-tile__label' }, label)
        );
      }

      function render() {
        const players = ctx.players;
        const cur = state.current;
        const [s0, s1] = state.scores;
        const leader = s0 === s1 ? null : (s0 > s1 ? 0 : 1);

        const rule = cur
          ? ['Say a word of ', h('strong', null, `${MIN_WORD_LENGTH}+ letters`),
             ' starting with ', h('strong', null, cur.first.toUpperCase()),
             ' and ending with ', h('strong', null, cur.last.toUpperCase())]
          : 'Hit the button to reveal two letters.';

        ui.renderInto(root,
          h('div', { class: 'fl' },
            h('p', { class: 'fl__rule' }, rule),

            h('div', { class: 'fl__tiles' + (justDealt ? ' fl__tiles--fresh' : '') },
              tile(cur && cur.first, 'starts with'),
              h('span', { class: 'fl__dots', 'aria-hidden': 'true' }, '…'),
              tile(cur && cur.last, 'ends with')
            ),

            h('button', { class: 'btn btn--primary btn--xl fl__deal', onclick: deal },
              cur ? (state.claimed ? 'Next letters' : 'Skip / new letters') : 'Reveal letters'),

            h('div', { class: 'fl__players' },
              players.map((p, i) =>
                h('button', {
                  class: `fl-player ${p.cssClass}` + (bumped === i ? ' is-bumped' : ''),
                  disabled: !cur || state.claimed,
                  onclick: () => award(i),
                },
                  h('span', { class: 'fl-player__name' }, leader === i ? '👑 ' : '', p.name),
                  h('span', { class: 'fl-player__score' }, state.scores[i]),
                  h('span', { class: 'fl-player__hint' },
                    state.claimed ? (state.history[0].winner === i ? '+1 this round' : '—') : 'Tap if you got it')
                )
              )
            ),

            h('div', { class: 'fl__footer' },
              h('button', { class: 'btn btn--sm', disabled: !state.history.length, onclick: undo }, '↶ Undo last point'),
              h('button', { class: 'btn btn--ghost btn--sm', onclick: reset }, 'Reset'),
              h('span', { class: 'fl__keys' }, 'Keys: Space = deal · 1 / 2 = point')
            ),

            state.history.length > 0 && h('div', { class: 'fl__history' },
              h('h3', { class: 'fl__history-title' }, 'Recent'),
              h('ul', { class: 'fl__history-list' },
                state.history.slice(0, 12).map((entry) =>
                  h('li', { class: `fl-hist ${players[entry.winner].cssClass}` },
                    h('span', { class: 'fl-hist__pair' }, `${entry.first.toUpperCase()}…${entry.last.toUpperCase()}`),
                    h('span', { class: 'fl-hist__who' }, players[entry.winner].name)
                  )
                )
              )
            )
          )
        );

        justDealt = false;
        bumped = null;
      }

      document.addEventListener('keydown', onKey);
      render();
      return () => document.removeEventListener('keydown', onKey);
    },
  });
})();
