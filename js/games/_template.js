/*
 * TEMPLATE: copy this file to js/games/<your-id>.js to start a new game.
 * This file is NOT loaded by index.html. See docs/PLANNING.md → "Adding a game".
 *
 * Checklist:
 *   1. Copy to js/games/<id>.js and rename id/title/emoji/description.
 *   2. (Optional) add css/games/<id>.css, scoped under `.game--<id>`.
 *   3. Add <script> (and <link>) tags to index.html.
 *   4. Add a section for it under "Games" in docs/PLANNING.md.
 *
 * Shared building blocks (js/core/ui.js, styled in css/base.css):
 *   ui.renderInto, ui.toolbar, ui.confirmFreshMatch, ui.secretPanel, ui.inlineEditor,
 *   ui.focus, ui.shake, plus CSS: .settings-bar, .player-columns / .player-col, .counter, .banner
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  function freshState(prev) {
    return {
      round: prev ? prev.round + 1 : 1,
      wins: prev ? prev.wins : [0, 0],
      winner: null,
    };
  }

  GameHub.register({
    id: 'my-game',            // lowercase kebab-case, unique; used in the URL (#/game/my-game)
    title: 'My Game',
    emoji: '🎯',
    description: 'One sentence shown on the home screen card.',

    // root: an empty <section class="game game--my-game"> owned by this game.
    // ctx:  { players, storage, h, goHome }
    // Return an optional cleanup function (remove document listeners, timers…).
    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      function win(i) {
        state.winner = i;
        state.wins[i] += 1;
        commit();
      }

      function newRound() {
        state = freshState(state);
        commit();
      }

      function resetScores() {
        if (!ui.confirmFreshMatch()) return;
        state.wins = [0, 0];
        state.round = 1;
        commit();
      }

      function render() {
        const players = ctx.players; // read at render time so renames show up
        ui.renderInto(root, [
          ui.toolbar({
            round: state.round,
            wins: state.wins,
            players,
            onNewRound: newRound,
            onResetScores: resetScores,
          }),
          state.winner !== null && h('div', { class: `banner ${players[state.winner].cssClass}` },
            h('span', null, `🏆 ${players[state.winner].name} wins!`),
            h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round')
          ),
          h('div', { class: 'player-columns' },
            players.map((p, i) =>
              h('section', { class: `player-col ${p.cssClass}` },
                h('header', { class: 'player-col__head' },
                  h('h2', { class: 'player-col__name' }, p.name)
                ),
                h('button', { class: 'btn btn--primary', disabled: state.winner !== null, onclick: () => win(i) },
                  'I win!')
              )
            )
          ),
        ]);
      }

      render();
      return () => { /* cleanup */ };
    },
  });
})();
