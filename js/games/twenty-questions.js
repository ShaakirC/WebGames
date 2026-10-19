/*
 * 20 Questions
 * Each player locks in a secret pick (hidden). Each column belongs to one
 * player: their secret sits on top, and below it is the log of questions the
 * *other* player asked them about it. Reveal one at a time or both together.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;
  // Question limit per player: adjustable in steps; null = unlimited.
  const DEFAULT_LIMIT = 20;
  const LIMIT_STEP = 5;
  const LIMIT_MIN = 5;
  const LIMIT_MAX = 100;
  const ANSWERS = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
    { id: 'maybe', label: 'Sort of' },
  ];

  function freshSide() {
    return { secret: '', locked: false, revealed: false, questions: [] };
  }

  function freshState(prev) {
    return {
      round: prev ? prev.round + 1 : 1,
      wins: prev ? prev.wins : [0, 0],
      category: prev ? prev.category : '', // shared by both players; carries over between rounds
      maxQuestions: prev ? prev.maxQuestions : DEFAULT_LIMIT, // number, or null = unlimited
      lastLimit: prev ? prev.lastLimit : DEFAULT_LIMIT,       // restored when leaving unlimited
      winner: null, // player index who guessed correctly this round
      sides: [freshSide(), freshSide()],
    };
  }

  GameHub.register({
    id: 'twenty-questions',
    title: '20 Questions',
    emoji: '❓',
    description: 'Each secretly pick a thing, then take turns asking yes/no questions. First to guess wins the round.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      if (typeof state.category !== 'string') state.category = ''; // saves from before the shared category
      if (state.maxQuestions === undefined) state.maxQuestions = DEFAULT_LIMIT; // saves from before the limit setting
      if (!state.lastLimit) state.lastLimit = DEFAULT_LIMIT;
      const drafts = ['', '']; // unsent question text per column

      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      // Question text is editable in place. Keys are "column:index".
      const parseKey = (key) => key.split(':').map(Number);
      const editor = ui.inlineEditor({
        root,
        render,
        getText: (key) => { const [i, n] = parseKey(key); return state.sides[i].questions[n].text; },
        // Empty text is allowed (shows "No note"): the answer still matters.
        save: (key, text) => {
          const [i, n] = parseKey(key);
          const q = state.sides[i].questions[n];
          if (q) { q.text = text; save(); }
          return !q;
        },
        renderRow: (key) => { const [i, n] = parseKey(key); return renderQuestion(i, n); },
      });

      // ---- actions ---------------------------------------------------------
      function lock(i) {
        const side = state.sides[i];
        if (!side.secret.trim()) return ui.shake(root, `secret-${i}`);
        side.secret = side.secret.trim();
        side.locked = true;
        commit();
      }

      function unlock(i) {
        const name = ctx.players[i].name;
        if (!confirm(`Unlock ${name}'s secret to change it? Everyone else, look away!`)) return;
        state.sides[i].locked = false;
        commit();
      }

      function reveal(i) {
        state.sides[i].revealed = true;
        commit();
      }

      function revealAll() {
        state.sides.forEach((s) => { if (s.locked) s.revealed = true; });
        commit();
      }

      function addQuestion(i, answer) {
        state.sides[i].questions.push({ text: drafts[i].trim(), answer });
        drafts[i] = '';
        commit();
        ui.focus(root, `q-${i}`);
      }

      function cycleAnswer(i, n) {
        const q = state.sides[i].questions[n];
        const idx = ANSWERS.findIndex((a) => a.id === q.answer);
        q.answer = ANSWERS[(idx + 1) % ANSWERS.length].id;
        commit();
      }

      function removeQuestion(i, n) {
        state.sides[i].questions.splice(n, 1);
        commit();
      }

      // Column i's secret was guessed, so the *other* player wins.
      function markGuessed(i) {
        const guesser = 1 - i;
        state.winner = guesser;
        state.wins[guesser] += 1;
        state.sides.forEach((s) => { if (s.locked) s.revealed = true; });
        commit();
      }

      function newRound() {
        const inProgress = state.winner === null &&
          state.sides.some((s) => s.locked || s.questions.length);
        if (inProgress && !confirm('Start a new round? This round has no winner yet.')) return;
        state = freshState(state);
        drafts[0] = drafts[1] = '';
        editor.reset();
        commit();
      }

      function resetScores() {
        if (!ui.confirmFreshMatch()) return;
        state.wins = [0, 0];
        state.round = 1;
        commit();
      }

      // − / + change the limit by LIMIT_STEP. From unlimited, either one returns to the last number.
      function stepLimit(delta) {
        if (state.maxQuestions === null) {
          state.maxQuestions = state.lastLimit;
        } else {
          state.maxQuestions = Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, state.maxQuestions + delta));
        }
        commit();
      }

      function toggleUnlimited() {
        if (state.maxQuestions === null) {
          state.maxQuestions = state.lastLimit;
        } else {
          state.lastLimit = state.maxQuestions;
          state.maxQuestions = null;
        }
        commit();
      }

      // ---- rendering -------------------------------------------------------
      function render() {
        const canReveal = state.sides.some((s) => s.locked && !s.revealed);
        ui.renderInto(root, [
          ui.toolbar({
            round: state.round,
            wins: state.wins,
            players: ctx.players,
            actions: h('button', { class: 'btn', disabled: !canReveal, onclick: revealAll }, '👀 Reveal both'),
            onNewRound: newRound,
            onResetScores: resetScores,
          }),
          state.winner !== null && renderWinner(),
          renderSettings(),
          h('div', { class: 'player-columns' }, [0, 1].map(renderColumn)),
        ]);
      }

      function renderWinner() {
        const winner = ctx.players[state.winner];
        return h('div', { class: `banner ${winner.cssClass}` },
          h('span', null, `🏆 ${winner.name} wins round ${state.round}!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round')
        );
      }

      function renderSettings() {
        const limit = state.maxQuestions;
        const unlimited = limit === null;
        return h('div', { class: 'settings-bar' },
          h('label', { class: 'settings-bar__field' },
            h('span', { class: 'settings-bar__label' }, 'Category'),
            h('input', {
              class: 'input settings-bar__input',
              type: 'text',
              placeholder: 'Animal, celeb, number…',
              value: state.category,
              'data-focus-key': 'category',
              oninput: (e) => { state.category = e.target.value; save(); },
            })
          ),
          h('div', { class: 'tq-limit', role: 'group', 'aria-label': 'Questions per player' },
            h('span', { class: 'settings-bar__label' }, 'Questions'),
            h('button', {
              class: 'btn btn--sm tq-step',
              'aria-label': `${LIMIT_STEP} fewer questions`,
              disabled: !unlimited && limit <= LIMIT_MIN,
              onclick: () => stepLimit(-LIMIT_STEP),
            }, '−'),
            h('span', { class: 'tq-limit__value', 'aria-live': 'polite' }, unlimited ? '∞' : limit),
            h('button', {
              class: 'btn btn--sm tq-step',
              'aria-label': `${LIMIT_STEP} more questions`,
              disabled: !unlimited && limit >= LIMIT_MAX,
              onclick: () => stepLimit(LIMIT_STEP),
            }, '+'),
            h('button', {
              class: 'btn btn--sm tq-step tq-step--inf' + (unlimited ? ' is-active' : ''),
              title: unlimited ? 'Back to a question limit' : 'Unlimited questions',
              'aria-pressed': String(unlimited),
              onclick: toggleUnlimited,
            }, '∞')
          )
        );
      }

      function renderColumn(i) {
        const players = ctx.players;
        const me = players[i];
        const other = players[1 - i];
        const side = state.sides[i];
        const count = side.questions.length;
        const limit = state.maxQuestions;

        return h('section', { class: `player-col ${me.cssClass}` },
          h('header', { class: 'player-col__head' },
            h('h2', { class: 'player-col__name' }, me.name),
            h('span', {
              class: 'counter' + (limit !== null && count >= limit ? ' counter--max' : ''),
              title: 'Questions asked',
            }, `${count} / ${limit === null ? '∞' : limit}`)
          ),
          ui.secretPanel({
            side,
            focusKey: `secret-${i}`,
            label: 'Secret pick (hidden)',
            placeholder: `${me.name}, type your pick…`,
            lockedText: '🔒 Pick locked',
            revealedLabel: 'It was',
            onInput: (value) => { side.secret = value; save(); },
            onLock: () => lock(i),
            onReveal: () => reveal(i),
            onChange: () => unlock(i),
          }),
          h('h3', { class: 'player-col__sub' }, `${other.name}’s questions`),
          renderQuestions(i),
          renderAddForm(i, other),
          side.locked && state.winner === null &&
            h('button', { class: 'btn btn--win', onclick: () => markGuessed(i) },
              `🎉 ${other.name} guessed it!`)
        );
      }

      function renderQuestions(i) {
        const questions = state.sides[i].questions;
        if (!questions.length) return h('p', { class: 'empty' }, 'No questions yet.');
        return h('ol', { class: 'qlist' }, questions.map((q, n) => renderQuestion(i, n)));
      }

      function renderQuestion(i, n) {
        const q = state.sides[i].questions[n];
        const key = `${i}:${n}`;
        const over = state.maxQuestions !== null && n >= state.maxQuestions;
        const cls = 'qlist__item' + (over ? ' qlist__item--over' : '');
        const num = h('span', { class: 'qlist__num' }, n + 1);

        if (editor.isEditing(key)) {
          return h('li', { class: cls + ' is-editing', 'data-editing-row': true },
            num, editor.field(`Edit question ${n + 1}`));
        }

        const answer = ANSWERS.find((a) => a.id === q.answer) || ANSWERS[0];
        return h('li', { class: cls },
          num,
          h('span', {
            class: 'qlist__text',
            title: 'Tap to edit',
            onclick: () => editor.start(key),
          }, q.text || h('em', null, 'No note')),
          h('button', {
            class: `answer answer--${answer.id}`,
            title: 'Tap to change answer',
            onclick: () => cycleAnswer(i, n),
          }, answer.label),
          h('button', {
            class: 'icon-btn',
            'aria-label': `Edit question ${n + 1}`,
            onclick: () => editor.start(key),
          }, '✎'),
          h('button', {
            class: 'icon-btn',
            'aria-label': `Remove question ${n + 1}`,
            onclick: () => removeQuestion(i, n),
          }, '×')
        );
      }

      function renderAddForm(i, other) {
        return h('div', { class: 'qform' },
          h('input', {
            class: 'input',
            type: 'text',
            placeholder: `What did ${other.name} ask?`,
            value: drafts[i],
            'data-focus-key': `q-${i}`,
            oninput: (e) => { drafts[i] = e.target.value; },
          }),
          h('div', { class: 'qform__answers' },
            ANSWERS.map((a) =>
              h('button', { class: `btn answer-btn answer--${a.id}`, onclick: () => addQuestion(i, a.id) }, a.label)
            )
          )
        );
      }

      render();
    },
  });
})();
