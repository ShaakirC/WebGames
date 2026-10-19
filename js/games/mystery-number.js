/*
 * Mystery Number
 * Each player locks in a secret number. They ask each other open-ended questions
 * ("could I beat this many chickens in a fight?") and jot whatever they learn in
 * free-text notes. Guessing only ever says right or wrong, never higher or lower.
 * First correct guess wins the round.
 *
 * Column i belongs to player i: their own secret on top, then THEIR notes and
 * guesses about the OTHER player's number.
 */
(function () {
  'use strict';

  const { h, ui } = GameHub;

  // "1,000" / " 42 " -> number. Returns NaN for anything that isn't a plain number.
  function parseNumber(text) {
    const s = String(text || '').replace(/[,\s]/g, '');
    return s === '' ? NaN : Number(s);
  }

  function freshSide() {
    // notes: { kind: 'note' | 'guess', text, correct? }
    return { secret: '', locked: false, revealed: false, notes: [], guesses: 0 };
  }

  function freshState(prev) {
    return {
      round: prev ? prev.round + 1 : 1,
      wins: prev ? prev.wins : [0, 0],
      range: prev ? prev.range : '', // shared, free text, e.g. "1–100"
      winner: null,
      sides: [freshSide(), freshSide()],
    };
  }

  GameHub.register({
    id: 'mystery-number',
    title: 'Mystery Number',
    emoji: '🔢',
    description: 'Each hide a number, then ask anything (“could I fight this many chickens?”). Take notes, guess, and no higher/lower help.',

    mount(root, ctx) {
      let state = ctx.storage.get('state', null) || freshState();
      const noteDrafts = ['', ''];
      const guessDrafts = ['', ''];
      let flash = null; // { i, ok } feedback for the last guess, shown once

      const save = () => ctx.storage.set('state', state);
      const commit = () => { save(); render(); };

      // Notes are editable in place. Keys are "column:index". Emptying a note deletes it.
      const parseKey = (key) => key.split(':').map(Number);
      const editor = ui.inlineEditor({
        root,
        render,
        getText: (key) => { const [i, n] = parseKey(key); return state.sides[i].notes[n].text; },
        save: (key, text) => {
          const [i, n] = parseKey(key);
          const notes = state.sides[i].notes;
          if (!notes[n]) return true;
          if (text) notes[n].text = text;
          else notes.splice(n, 1);
          save();
          return !text; // deleted -> other rows shift, so redraw everything
        },
        renderRow: (key) => { const [i, n] = parseKey(key); return renderNote(i, n); },
      });

      // ---- actions ---------------------------------------------------------
      function lock(i) {
        const side = state.sides[i];
        if (!Number.isFinite(parseNumber(side.secret))) return ui.shake(root, `secret-${i}`);
        side.secret = String(parseNumber(side.secret));
        side.locked = true;
        commit();
      }

      function unlock(i) {
        if (!confirm(`Unlock ${ctx.players[i].name}'s number to change it? Everyone else, look away!`)) return;
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

      function addNote(i) {
        const text = noteDrafts[i].trim();
        if (!text) return;
        state.sides[i].notes.push({ kind: 'note', text });
        noteDrafts[i] = '';
        commit();
        ui.focus(root, `note-${i}`);
      }

      function removeNote(i, n) {
        state.sides[i].notes.splice(n, 1);
        commit();
      }

      // Player i guesses the OTHER player's number.
      function guess(i) {
        const target = state.sides[1 - i];
        const value = parseNumber(guessDrafts[i]);
        if (!target.locked || state.winner !== null) return;
        if (!Number.isFinite(value)) return ui.shake(root, `guess-${i}`);

        const side = state.sides[i];
        const correct = value === parseNumber(target.secret);
        side.guesses += 1;
        side.notes.push({ kind: 'guess', text: String(value), correct });
        guessDrafts[i] = '';
        flash = { i, ok: correct };

        if (correct) {
          state.winner = i;
          state.wins[i] += 1;
          state.sides.forEach((s) => { if (s.locked) s.revealed = true; });
        }
        commit();
        if (!correct) ui.focus(root, `guess-${i}`);
      }

      function newRound() {
        const inProgress = state.winner === null &&
          state.sides.some((s) => s.locked || s.notes.length);
        if (inProgress && !confirm('Start a new round? This round has no winner yet.')) return;
        state = freshState(state);
        noteDrafts[0] = noteDrafts[1] = guessDrafts[0] = guessDrafts[1] = '';
        editor.reset();
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
        flash = null;
      }

      function renderWinner() {
        const players = ctx.players;
        const i = state.winner;
        const side = state.sides[i];
        return h('div', { class: `banner ${players[i].cssClass}` },
          h('span', null,
            `🏆 ${players[i].name} found ${players[1 - i].name}’s number (${state.sides[1 - i].secret}) ` +
            `in ${side.guesses} ${side.guesses === 1 ? 'guess' : 'guesses'}!`),
          h('button', { class: 'btn btn--primary', onclick: newRound }, 'Next round')
        );
      }

      function renderSettings() {
        return h('div', { class: 'settings-bar' },
          h('label', { class: 'settings-bar__field' },
            h('span', { class: 'settings-bar__label' }, 'Range'),
            h('input', {
              class: 'input settings-bar__input',
              type: 'text',
              placeholder: 'Optional, e.g. 1–100',
              value: state.range,
              'data-focus-key': 'range',
              oninput: (e) => { state.range = e.target.value; save(); },
            })
          )
        );
      }

      function renderColumn(i) {
        const players = ctx.players;
        const me = players[i];
        const other = players[1 - i];
        const side = state.sides[i];

        return h('section', { class: `player-col ${me.cssClass}` },
          h('header', { class: 'player-col__head' },
            h('h2', { class: 'player-col__name' }, me.name),
            h('span', { class: 'counter', title: 'Guesses made' },
              `🎯 ${side.guesses} ${side.guesses === 1 ? 'guess' : 'guesses'}`)
          ),
          ui.secretPanel({
            side,
            focusKey: `secret-${i}`,
            inputmode: 'decimal',
            label: 'Your secret number (hidden)',
            placeholder: `${me.name}, type your number…`,
            lockedText: '🔒 Number locked',
            revealedLabel: `${me.name}’s number was`,
            onInput: (value) => { side.secret = value; save(); },
            onLock: () => lock(i),
            onReveal: () => reveal(i),
            onChange: state.winner === null ? () => unlock(i) : null,
          }),
          h('h3', { class: 'player-col__sub' }, `${me.name}’s notes on ${other.name}’s number`),
          renderNotes(i),
          renderNoteForm(i),
          renderGuessForm(i, other)
        );
      }

      function renderNotes(i) {
        const notes = state.sides[i].notes;
        if (!notes.length) {
          return h('p', { class: 'empty' }, 'Nothing yet. Ask a question and note what you learn.');
        }
        return h('ul', { class: 'mn-notes' }, notes.map((note, n) => renderNote(i, n)));
      }

      function renderNote(i, n) {
        const note = state.sides[i].notes[n];
        const key = `${i}:${n}`;

        if (editor.isEditing(key)) {
          return h('li', { class: 'mn-note is-editing', 'data-editing-row': true }, editor.field('Edit note'));
        }

        if (note.kind === 'guess') {
          return h('li', { class: 'mn-note ' + (note.correct ? 'is-correct' : 'is-wrong') },
            h('span', { class: 'mn-note__text' },
              note.correct ? `✓ Guessed ${note.text}!` : `✗ Guessed ${note.text}`)
          );
        }

        return h('li', { class: 'mn-note' },
          h('span', {
            class: 'mn-note__text is-editable',
            title: 'Tap to edit',
            onclick: () => editor.start(key),
          }, note.text),
          h('button', { class: 'icon-btn', 'aria-label': 'Edit note', onclick: () => editor.start(key) }, '✎'),
          h('button', { class: 'icon-btn', 'aria-label': 'Remove note', onclick: () => removeNote(i, n) }, '×')
        );
      }

      function renderNoteForm(i) {
        return h('div', { class: 'mn-form' },
          h('input', {
            class: 'input',
            type: 'text',
            placeholder: 'Add a note: “more than 25 chickens”…',
            value: noteDrafts[i],
            'data-focus-key': `note-${i}`,
            oninput: (e) => { noteDrafts[i] = e.target.value; },
            onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(i); } },
          }),
          h('button', { class: 'btn', onclick: () => addNote(i) }, 'Add')
        );
      }

      function renderGuessForm(i, other) {
        const targetLocked = state.sides[1 - i].locked;
        const over = state.winner !== null;
        const feedback = flash && flash.i === i && !flash.ok &&
          h('span', { class: 'mn-guess__feedback' }, '✗ Nope!');

        return h('div', { class: 'mn-guess' },
          h('div', { class: 'mn-form' },
            h('input', {
              class: 'input mn-guess__input',
              type: 'text',
              inputmode: 'decimal',
              autocomplete: 'off',
              placeholder: targetLocked ? `Guess ${other.name}’s number` : `Waiting for ${other.name} to lock in…`,
              disabled: !targetLocked || over,
              value: guessDrafts[i],
              'data-focus-key': `guess-${i}`,
              oninput: (e) => { guessDrafts[i] = e.target.value; },
              onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); guess(i); } },
            }),
            h('button', {
              class: 'btn btn--primary',
              disabled: !targetLocked || over,
              onclick: () => guess(i),
            }, '🎯 Guess')
          ),
          feedback
        );
      }

      render();
    },
  });
})();
