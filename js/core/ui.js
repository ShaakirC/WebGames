/*
 * GameHub.ui: shared building blocks for game modules.
 * Loaded after hub.js and before any game. Styles for everything here live in css/base.css.
 *
 *   ui.renderInto(root, children)   redraw a game, keeping focus + caret, skipping null/false
 *   ui.focus(root, key, {caretEnd}) focus the element with data-focus-key="key"
 *   ui.shake(root, key)             shake + focus an input (validation feedback)
 *   ui.toolbar({...})               round pill, win chips, extra actions, New round, Reset scores
 *   ui.confirmFreshMatch()          the standard "reset scores + round" confirm
 *   ui.secretPanel({...})           hidden-entry → locked → revealed panel for a secret
 *   ui.stepper({...})               settings-bar "LABEL − value +" control
 *   ui.gate({...})                "look away" card shown before one player's private screen
 *   ui.inlineEditor({...})          edit list rows in place (Enter/Save, Esc, blur saves)
 *
 * See docs/PLANNING.md §4.6 for usage.
 */
(function () {
  'use strict';

  const { h } = GameHub;

  function flatten(children) {
    return [children].flat(Infinity).filter((c) => c != null && c !== false && c !== '');
  }

  // ---------------------------------------------------------------------------
  // Rendering + focus
  // ---------------------------------------------------------------------------
  function focus(root, key, opts) {
    const el = root.querySelector(`[data-focus-key="${key}"]`);
    if (!el) return null;
    el.focus();
    if (opts && opts.caretEnd && typeof el.setSelectionRange === 'function') {
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* not a text input */ }
    }
    return el;
  }

  // Replace root's content. Whatever had focus (matched by data-focus-key) gets it back,
  // with the caret where it was, so redraws never interrupt typing. Unlike a bare
  // replaceChildren(), null/false children are skipped instead of printed as text.
  function renderInto(root, children) {
    const active = document.activeElement;
    const key = active && root.contains(active) ? active.dataset.focusKey : null;
    let caret = null;
    try {
      if (key && typeof active.selectionStart === 'number') caret = [active.selectionStart, active.selectionEnd];
    } catch (e) { /* selection not supported on this input type */ }

    root.replaceChildren(...flatten(children));

    if (!key) return;
    const el = root.querySelector(`[data-focus-key="${key}"]`);
    if (!el) return;
    el.focus();
    if (caret && typeof el.setSelectionRange === 'function') {
      const max = el.value.length;
      try { el.setSelectionRange(Math.min(caret[0], max), Math.min(caret[1], max)); } catch (e) { /* ignore */ }
    }
  }

  function shake(root, key) {
    const el = root.querySelector(`[data-focus-key="${key}"]`);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // restart the animation
    el.classList.add('shake');
    el.focus();
  }

  // ---------------------------------------------------------------------------
  // Toolbar: Round N · [P1 wins] [P2 wins] ……… [actions] [New round] [Reset scores]
  // ---------------------------------------------------------------------------
  function toolbar({ round, wins, players, actions, onNewRound, onResetScores }) {
    return h('div', { class: 'toolbar' },
      h('div', { class: 'toolbar__info' },
        round != null && h('span', { class: 'pill' }, `Round ${round}`),
        wins && players.map((p, i) =>
          h('span', { class: `score-chip ${p.cssClass}` }, p.name, ' ', h('strong', null, wins[i]))
        )
      ),
      h('div', { class: 'toolbar__actions' },
        actions,
        onNewRound && h('button', { class: 'btn', onclick: onNewRound }, 'New round'),
        onResetScores && h('button', { class: 'btn btn--ghost btn--sm', onclick: onResetScores }, 'Reset scores')
      )
    );
  }

  function confirmFreshMatch() {
    return confirm('Start a fresh match? Scores go back to 0–0 and this becomes round 1.');
  }

  // ---------------------------------------------------------------------------
  // Secret panel. `side` needs { secret, locked, revealed }.
  //   unlocked: password input + Show/Hide peek + "Lock it in"
  //   locked:   status text + Reveal (+ Change if onChange is given)
  //   revealed: label + the secret in large text
  // Put `p1`/`p2` on an ancestor for player colours.
  // ---------------------------------------------------------------------------
  function secretPanel(opts) {
    const {
      side, focusKey, placeholder, inputmode,
      label = 'Secret (hidden)',
      lockedText = '🔒 Locked',
      revealedLabel = 'It was',
      onInput, onLock, onReveal, onChange,
    } = opts;

    if (!side.locked) {
      const input = h('input', {
        class: 'input secret-panel__input',
        type: 'password',
        inputmode,
        autocomplete: 'off',
        placeholder,
        value: side.secret,
        'data-focus-key': focusKey,
        oninput: (e) => onInput(e.target.value),
        onkeydown: (e) => { if (e.key === 'Enter') onLock(); },
      });
      const peek = h('button', {
        class: 'btn btn--ghost btn--sm',
        type: 'button',
        'aria-label': 'Show or hide what you typed',
        onclick: () => {
          input.type = input.type === 'password' ? 'text' : 'password';
          peek.textContent = input.type === 'password' ? 'Show' : 'Hide';
        },
      }, 'Show');

      return h('div', { class: 'secret-panel' },
        h('label', { class: 'field' },
          h('span', { class: 'field__label' }, label),
          h('span', { class: 'secret-panel__row' }, input, peek)
        ),
        h('button', { class: 'btn btn--primary', onclick: onLock }, '🔒 Lock it in')
      );
    }

    if (!side.revealed) {
      return h('div', { class: 'secret-panel secret-panel--locked' },
        h('span', { class: 'secret-panel__status' }, lockedText),
        h('span', { class: 'secret-panel__actions' },
          onReveal && h('button', { class: 'btn btn--sm', onclick: onReveal }, 'Reveal'),
          onChange && h('button', { class: 'btn btn--ghost btn--sm', onclick: onChange }, 'Change')
        )
      );
    }

    return h('div', { class: 'secret-panel secret-panel--revealed' },
      h('span', { class: 'secret-panel__label' }, revealedLabel),
      h('span', { class: 'secret-panel__value' }, side.secret)
    );
  }

  // ---------------------------------------------------------------------------
  // − / + stepper for a settings bar: LABEL [−] value [+] [extra…]
  //   label                    shown before the buttons (and the group's aria-label unless groupLabel is given)
  //   value                    text or number to show between the buttons
  //   onMinus, onPlus          click handlers
  //   canMinus, canPlus        false disables that button (default true)
  //   minusLabel, plusLabel    aria-labels (default "Decrease <label>" / "Increase <label>")
  //   extra                    optional nodes after + (e.g. an ∞ toggle; give buttons class stepper__btn)
  // ---------------------------------------------------------------------------
  function stepper(opts) {
    const {
      label, groupLabel = label, value,
      onMinus, onPlus, canMinus = true, canPlus = true,
      minusLabel = `Decrease ${label.toLowerCase()}`,
      plusLabel = `Increase ${label.toLowerCase()}`,
      extra,
    } = opts;
    return h('div', { class: 'stepper', role: 'group', 'aria-label': groupLabel },
      h('span', { class: 'settings-bar__label stepper__label' }, label),
      h('button', { class: 'btn btn--sm stepper__btn', 'aria-label': minusLabel, disabled: !canMinus, onclick: onMinus }, '−'),
      h('span', { class: 'stepper__value', 'aria-live': 'polite' }, value),
      h('button', { class: 'btn btn--sm stepper__btn', 'aria-label': plusLabel, disabled: !canPlus, onclick: onPlus }, '+'),
      extra
    );
  }

  // ---------------------------------------------------------------------------
  // Look-away gate: a centred card in one player's colour shown before private info.
  //   player       the player about to act (for colours)
  //   emoji, title, text
  //   body         optional extra nodes between the text and the button (settings, rules…)
  //   actionLabel, onAction   the big button that leaves the gate
  // ---------------------------------------------------------------------------
  function gate({ player, emoji = '🙈', title, text, body, actionLabel, onAction }) {
    return h('div', { class: `card gate ${player.cssClass}` },
      h('div', { class: 'gate__emoji', 'aria-hidden': 'true' }, emoji),
      h('h2', { class: 'gate__title' }, title),
      text && h('p', { class: 'gate__text' }, text),
      body,
      onAction && h('button', { class: 'btn btn--primary btn--xl', onclick: onAction }, actionLabel)
    );
  }

  // ---------------------------------------------------------------------------
  // Inline editor for list rows, one row at a time. Keys are strings you choose (e.g. "0:3").
  //   getText(key)       -> current text of that row
  //   save(key, text)    -> store the trimmed text. Return true if a FULL redraw is needed
  //                         (e.g. you deleted the row, so other rows' indexes shifted).
  //   renderRow(key)     -> a fresh row element (used to swap just that row after saving)
  //   render()           -> the game's full redraw
  // In your row renderer: if editor.isEditing(key), render
  //   h('li', { class: '… is-editing', 'data-editing-row': true }, …, editor.field('Edit note'))
  // Saving only swaps the edited row, so a click that caused the blur still lands.
  // ---------------------------------------------------------------------------
  function inlineEditor({ root, getText, save, renderRow, render }) {
    let editing = null; // { key, draft }

    const api = {
      isEditing: (key) => editing !== null && editing.key === key,

      start(key) {
        api.finish();
        editing = { key, draft: getText(key) || '' };
        render();
        focus(root, 'edit', { caretEnd: true });
      },

      finish(cancel) {
        if (!editing) return;
        const { key, draft } = editing;
        editing = null;
        const needsFullRender = !cancel && save(key, draft.trim());
        const row = root.querySelector('[data-editing-row]');
        const fresh = !needsFullRender && row ? renderRow(key) : null;
        if (fresh) row.replaceWith(fresh);
        else render();
      },

      reset() { editing = null; },

      // The input + Save button for the row being edited.
      field(ariaLabel) {
        return [
          h('input', {
            class: 'input inline-edit__input',
            type: 'text',
            'aria-label': ariaLabel,
            value: editing ? editing.draft : '',
            'data-focus-key': 'edit',
            oninput: (e) => { if (editing) editing.draft = e.target.value; },
            onkeydown: (e) => {
              if (e.key === 'Enter') { e.preventDefault(); api.finish(); }
              else if (e.key === 'Escape') { e.preventDefault(); api.finish(true); }
            },
            onblur: () => api.finish(),
          }),
          h('button', {
            class: 'btn btn--primary btn--sm',
            onmousedown: (e) => e.preventDefault(), // keep focus so blur doesn't fire first
            onclick: () => api.finish(),
          }, 'Save'),
        ];
      },
    };
    return api;
  }

  GameHub.ui = {
    renderInto, focus, shake, toolbar, confirmFreshMatch, secretPanel, stepper, gate, inlineEditor,
  };
})();
