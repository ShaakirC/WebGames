# Game Night: Planning & Infrastructure

The source of truth for how this project is built and where it is going.
**Agents: read this before changing anything, and update it when you change
architecture, add a game, or finish or add a roadmap item.**

---

## 1. What this is

A small web app for two people (a couple) to play quick party-style games
together on **one shared screen** (laptop, tablet or phone). The home screen
lists the games; picking one opens that game's interface. More games will be
added over time, so everything is built around a plug-in **game module**
system.

### Goals
- Zero friction: open `index.html` and play. No install, no build, no server, no accounts.
- Fast to add a new game: one JS file, one optional CSS file, two `<script>`/`<link>` tags.
- Works well on phone, tablet and desktop, in both light and dark mode.
- State survives an accidental refresh (localStorage).

### Non-goals (for now)
- Online multiplayer across two devices (see Roadmap §8).
- Accounts, a backend, analytics.
- Frameworks or bundlers. Keep it plain HTML/CSS/JS until there's a real need.

---

## 2. Running it

- **Simplest:** double-click `index.html`. Everything works over `file://`.
- **Local server (optional, for phone testing on the same Wi‑Fi):**
  `npx serve .` or `python -m http.server 8000`, then open the LAN IP.
- **Hosting (optional):** it's a static site, so GitHub Pages, Netlify or
  Cloudflare Pages work with no config.

> ⚠️ Do **not** convert scripts to ES modules (`type="module"`) without also
> deciding to require a local server. Browsers block module imports over
> `file://`. That is why the project uses classic scripts plus a global `GameHub`.

---

## 3. File layout

```
index.html                  Shell: top bar, #app mount point, loads CSS + JS in order
css/
  base.css                  Design tokens, light/dark themes, shared components, home screen
  games/<id>.css            One per game, every rule scoped under .game--<id>
js/
  core/hub.js               GameHub: registry, router, home screen, players, storage, h()
  core/ui.js                GameHub.ui: shared game building blocks (toolbar, secret panel, editor…)
  games/<id>.js             One per game; calls GameHub.register({...})
  games/<id>-words.js etc.  Optional data file for a game; sets GameHub.assets['<id>']; loads before the game
  games/_template.js        Starter for new games (NOT loaded by index.html)
  app.js                    Boot: GameHub.start()
docs/
  PLANNING.md               This file
CLAUDE.md                   Short agent briefing that points here
```

Script load order in `index.html` matters: **hub.js → ui.js → games (data files before their game) → app.js**.
The order of the game `<script>` tags is the order of cards on the home screen.

---

## 4. Architecture

### 4.1 The hub (`js/core/hub.js`)
Exposes a single global, `window.GameHub`:

| Member | Purpose |
|---|---|
| `register(game)` | Add a game module. Validates `id`, `title`, `mount`. Throws on a duplicate or invalid id. |
| `start()` | Begins hash routing and renders the current route. Called once by `app.js`. |
| `h(tag, attrs, ...children)` | Tiny DOM builder (see 4.4). |
| `storage` | Global namespaced localStorage (`get/set/remove`). Games should use `ctx.storage` instead. |
| `getPlayers()` | Current player list (see 4.3). |
| `assets` | Empty object for game data files. A data script sets `GameHub.assets['<id>'] = {...}` and the game reads it. This keeps big lists out of the game logic without adding globals. |

### 4.2 Routing
Hash-based, so it works on `file://` and the browser back button works:

| Hash | View |
|---|---|
| `#/` or empty | Home screen (player names + game cards) |
| `#/game/<id>` | Mounts that game |

On every route change the hub calls the previous game's cleanup function (if
any), empties `#app`, sets `body[data-view]` to `home` or `game`, and updates
the top-bar title and `document.title`. An unknown game id falls back to home.
If `mount()` throws, the error is shown in place of the game.

### 4.3 Players
Always exactly two players, named on the home screen and stored under
`gamenight:players`. `ctx.players` returns:

```js
[{ index: 0, name: 'Shaakir', cssClass: 'p1' },
 { index: 1, name: '…',       cssClass: 'p2' }]
```

Empty names fall back to "Player 1" / "Player 2". Read `ctx.players` **at
render time**, not once at mount, so a rename always shows up.

**Player colours:** add `p.cssClass` (`p1`/`p2`) to an element and its subtree
gets `--pc` (strong colour) and `--pc-soft` (tint). Use these instead of
hard-coding colours so every game stays consistent.

### 4.4 `h()` DOM helper
```js
h('button', { class: 'btn', onclick: fn, disabled: !ok, 'data-focus-key': 'x' },
  'Label', maybeNode && h('span', null, 'more'), [arrayOf, nodes]);
```
- `class` sets className. `on<event>` adds a listener. `value`/`checked` are set as properties.
- `true` gives an empty boolean attribute. `false`/`null`/`undefined` leaves it out.
- Children: strings, numbers, nodes and (nested) arrays. `null`/`false` are skipped.
- Text always goes in as text nodes, so **user input is never parsed as HTML**.
  Never use `innerHTML` with user-supplied text.

### 4.5 Game module contract
```js
GameHub.register({
  id: 'kebab-case-id',   // required, unique, used in URL + CSS scope + storage namespace
  title: 'Display Name', // required
  emoji: '🎯',           // optional, home card icon
  description: '…',      // optional, one sentence on the home card
  mount(root, ctx) {     // required
    // root: an empty <section class="game game--<id>"> owned by this game
    // ctx.players  -> current players (getter, always fresh)
    // ctx.storage  -> localStorage namespaced to "gamenight:game:<id>:"
    // ctx.h        -> same as GameHub.h
    // ctx.goHome() -> navigate back to the home screen
    return () => { /* optional cleanup: remove document listeners, clear timers */ };
  },
});
```

**Rules for game modules**
1. Wrap the file in an IIFE (`(function () { 'use strict'; … })();`) so nothing leaks to globals.
2. Only render inside `root`. Anything added to `document` (listeners,
   intervals) must be removed in the returned cleanup function.
3. Keep all game state in one plain JSON-serialisable `state` object. Persist it with
   `ctx.storage.set('state', state)` after every change and restore it on mount.
4. Re-rendering is "rebuild everything". Always redraw with **`ui.renderInto(root, [...])`**, never
   a bare `root.replaceChildren(...)`. `renderInto` skips `false`/`null` (a bare `replaceChildren`
   prints them as the text "false") and restores focus and caret, so typing isn't interrupted.
   Give every text input a `data-focus-key`. To keep focus in text inputs across re-renders, give them a
   `data-focus-key` and restore focus after render (see `twenty-questions.js`).
   Keep unsent text drafts in a closure variable or in state.
5. **Before writing UI, check `GameHub.ui` (§4.6)** for a toolbar, secret entry, in-place
   editing, etc. If a pattern now appears in a third game, move it into `ui.js` rather than copying it.
6. Use the shared components in `base.css` (`.btn`, `.input`, `.card`, `.pill`,
   `.score-chip`, `.toolbar`, `.banner`, `.empty`) before inventing new ones.
7. Put game CSS in `css/games/<id>.css` and prefix **every** selector with `.game--<id>`.

### 4.6 Shared UI building blocks (`js/core/ui.js` → `GameHub.ui`)
Use these instead of rebuilding them. Their styles are in `css/base.css`. Use them via
`const { h, ui } = GameHub;`.

| Helper | What it does |
|---|---|
| `ui.renderInto(root, children)` | The redraw for every game. Flattens arrays, skips `null`/`false`, and restores focus and caret by `data-focus-key`. |
| `ui.focus(root, key, { caretEnd })` | Focus the element with `data-focus-key="key"`. |
| `ui.shake(root, key)` | Shake and focus an input (validation feedback). |
| `ui.toolbar({ round, wins, players, actions, onNewRound, onResetScores })` | The standard top bar: "Round N" pill, win chips, any extra `actions` nodes, *New round*, *Reset scores*. Leave out a field to hide that part. |
| `ui.confirmFreshMatch()` | The standard "fresh match" confirm. On yes, set `wins = [0,0]` and `round = 1`. |
| `ui.secretPanel({ side, focusKey, placeholder, inputmode, label, lockedText, revealedLabel, onInput, onLock, onReveal, onChange })` | Hidden-entry → locked → revealed panel. `side` needs `{ secret, locked, revealed }`. Pass `onChange: null` to hide *Change*. Put `p1`/`p2` on an ancestor for colours. |
| `ui.inlineEditor({ root, getText, save, renderRow, render })` | Edits list rows in place, one at a time, keyed by a string like `"0:3"`. In the row renderer: `if (editor.isEditing(key)) return h('li', { 'data-editing-row': true, … }, editor.field('Edit note'))`. Start with `editor.start(key)`. `save(key, text)` returns `true` when a full redraw is needed (e.g. it deleted the row). Otherwise only that row is swapped, so the click that caused the blur still lands. Call `editor.reset()` on a new round. |

**Shared CSS classes** (in `base.css`):
- **Settings bar:** `.settings-bar` with `.settings-bar__field`, `__label` and `__input`.
- **Two player cards:** `.player-columns` containing `.player-col` cards, with `__head`, `__name` and `__sub`.
- **Counter pill:** `.counter`, with `.counter--max` for when it's at its limit.
- **Others:** `.banner`, `.toolbar`, `.pill`, `.score-chip`, `.card`, `.empty`, `.field`.

### 4.7 Storage keys
All keys are prefixed `gamenight:`.

| Key | Owner | Contents |
|---|---|---|
| `gamenight:players` | hub | `["Name 1", "Name 2"]` |
| `gamenight:theme` | hub (+ inline script in `index.html` `<head>`) | `"light"` / `"dark"`. Missing = follow OS |
| `gamenight:game:twenty-questions:state` | 20 Questions | see §6.1 |
| `gamenight:game:first-last:state` | First & Last | see §6.2 |
| `gamenight:game:chain-link:state` | Chain Link | see §6.3 |
| `gamenight:game:mystery-number:state` | Mystery Number | see §6.4 |

If you change a game's state shape incompatibly, either migrate it in `mount()`
or rename the key (e.g. `state.v2`) so old saves don't crash the game.

### 4.8 Styling
- Colours come from tokens on `:root`. Never hard-code hex values in game CSS. Add a token if you need one.
- **Theme:** the top-bar ☀️/🌙 button sets `<html data-theme="light|dark">` and saves it.
  With no saved choice, the OS setting applies. The dark tokens exist **twice** in `base.css`:
  once under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and once
  under `:root[data-theme="dark"]`. Any new token must go in all three places (light + both dark blocks).
  A small inline script in `index.html`'s `<head>` applies the saved theme before first paint.
- Tap targets are at least about 40px tall. Big actions use `.btn--xl`.
- Layout must work from 360px wide upwards with no horizontal scroll.
- Animations are disabled under `prefers-reduced-motion`.

---

## 5. Adding a game (checklist)

1. Copy `js/games/_template.js` to `js/games/<id>.js` and set `id`, `title`, `emoji`, `description`.
2. Build `mount(root, ctx)` following the rules in §4.5.
3. Optional: create `css/games/<id>.css`, scoped under `.game--<id>`.
4. In `index.html`, add `<link rel="stylesheet" href="css/games/<id>.css">` with the
   other game styles, and `<script src="js/games/<id>.js"></script>` **before** `app.js`.
5. Add a section for the game under §6 (rules, UI, state shape) and update the
   storage table in §4.7.
6. Test using the manual checklist in §7.

---

## 6. Games

### 6.1 20 Questions (`twenty-questions`)
**How it's played:** each player secretly picks something (a number, animal,
character, celeb…). Players take turns asking each other yes/no questions. The
first to guess the other's pick wins the round.

**UI**
- Toolbar: round number, win tally per player, *Reveal both*, *New round*, *Reset scores*.
- **Settings bar** above both columns (wraps on narrow screens):
  - **Category:** one shared, always-editable category for the round (e.g. "Animal").
  - **Questions:** a per-player limit with **− / +** in steps of 5 (5–100, default 20) and an **∞** toggle
    for unlimited. From ∞, pressing − / + or ∞ again goes back to the last number used.
  - Both carry over to the next round.
- Two columns, one per player. Each column belongs to that player and their pick:
  - **Top:** the secret panel. Before locking: a *secret* password field with a
    Show/Hide peek, then **Lock it in**. Once locked, it shows "🔒 Pick locked" with *Reveal* and *Change*.
    Once revealed, it shows the pick in large text.
  - **Middle:** the log of questions the *other* player asked about this pick. Each
    row has a number, note text, an answer badge (tap to cycle Yes → No → Sort of),
    ✎ edit and × remove. Tapping the text or ✎ edits it in place: Enter/Save keeps it,
    Esc cancels, and clicking away also saves. Empty text is kept as "No note", because the answer still matters.
  - **Add form:** an optional question note, then tap **Yes / No / Sort of** to log it.
  - Counter `n / limit` (or `n / ∞`). It turns red at the limit. Going over is allowed but flagged.
  - **"🎉 <other> guessed it!"** awards the round to the other player and reveals both picks.

**State** (`state` key)
```js
{
  round: 1,
  wins: [0, 0],
  winner: null | 0 | 1,
  category: '',          // shared by both players
  maxQuestions: 20,      // number, or null = unlimited
  lastLimit: 20,         // restored when leaving unlimited
  sides: [ // index = player whose pick it is
    { secret: '', locked: false, revealed: false,
      questions: [{ text: '', answer: 'yes' | 'no' | 'maybe' }] },
    { … }
  ]
}
```

**Known limitations:** on one shared screen, the other player has to look away
while a secret is typed. Secrets are stored in plain text in localStorage.

### 6.2 First & Last (`first-last`)
**How it's played:** reveal two random letters, the first and last letter of a
word. The first player to say a real word of **5+ letters** that starts and ends
with them gets the point. No word checking: players referee each other.

**UI**
- Two large letter tiles (starts with / ends with) with a flip-in animation.
- **Reveal letters / Next letters / Skip** button. Dealing before anyone scores counts as a skip.
- Two big player buttons with live scores and a 👑 for the leader. Only one
  point per deal (buttons lock after a claim).
- *Undo last point*, *Reset*, and a "Recent" history of pairs and who won them.
- Keyboard: **Space** deals, **1 / 2** awards the point (ignored while typing in inputs).

**Letter generation:** separate weighted tables for first letters
(`FIRST_WEIGHTS`) and last letters (`LAST_WEIGHTS`) at the top of
`first-last.js`. They favour common letters and leave out hard endings (X, Z, Q, J, V…)
so most pairs are playable. The same pair is never dealt twice in a row.

**State** (`state` key)
```js
{
  scores: [0, 0],
  current: { first: 's', last: 'e' } | null,
  dealId: 7,         // increments every deal
  claimed: false,    // has someone scored on the current deal?
  history: [{ first, last, winner: 0 | 1, dealId }]  // newest first, max 50
}
```

### 6.3 Chain Link (`chain-link`)
**How it's played:** each player secretly builds a chain of N words (default 5,
choose 4–8) for the other. Every word joins onto the one before it as a compound or
common phrase: BOOK → CASE (bookcase) → CLOSED (case closed) → BOOK (closed book) → WORM
(bookworm). The solver sees the first word in full and **only the first letter** of
every other word, with **no length hint**. They solve the words in order.

**Flow**
1. **Gate** ("🙈 Shaakir, build a chain for Zahra. Zahra, look away!"). Before
   the first builder starts, it also has the chain-length picker.
2. **Builder** (one at a time): N text inputs, letters only. Under each empty row:
   - row 1: random starter ideas (↻ for more);
   - other rows: **suggestion chips** of words that join onto the word above, from the
     offline list. Dashed chips are dead ends, meaning the list has no ideas after them.
   - Each filled row shows a preview "book + case ✓". The ✓ means the pair is in the list.
     Words not in the list are allowed.
   - 🎲 *Random chain* fills every row from the list, and *Clear* empties them.
   - **Lock** (enabled when every word has 2+ letters) goes to the second builder's gate,
     then to play.
3. **Play, one solver at a time, timed.** `state.solver` decides who goes. The first solver
   alternates each round (round 1: player 1, round 2: player 2…). Each solver gets a
   "⏱️ Name, you're up!" screen. The clock starts on **Start the clock**, and the second solver also sees
   the first solver's time to beat. While solving, a big timer (m:ss.t) sits above that player's board.
   - The current row is highlighted and has the word typed **inline**: the revealed letters, then an
     underlined text box, then **Go** (Enter works too) and **💡**.
   - Either the whole word or just the remainder after the shown letters counts ("case" or "ase" after "C").
     Rows unlock one at a time, in order.
   - **💡** reveals the next letter, clears the box, and adds a **time penalty** (`HINT_PENALTY_MS`,
     10s), so the clock visibly jumps. Revealing the last letter solves the word.
   - **Only the builder's exact word counts.** A guess that fits the previous word but not the
     next one (book → *club* when the chain continues case → closed) is wrong on purpose. The next
     link is what tells you which word it is. There is deliberately no "accept anyway" option.
   - Wrong guesses show "✗ … isn't it" but are **not counted** and have no penalty.
4. When both have finished, the **lowest time wins** (elapsed time plus hint penalties). An exact tie is a
   "dead heat". The results screen shows both times, hints used and both full chains.
   The win tally carries over between rounds.

The clock uses saved `Date.now()` timestamps, so it keeps running through a refresh and is
always correct. There is no pause. Only the timer text updates every 100ms. The rest of
the screen is not redrawn, so typing isn't disturbed. The interval is cleared when you leave the game.

Refreshing during the build phase always goes back to the gate, so a half-built chain
is never shown to the wrong person.

**Word list:** `js/games/chain-link-words.js` is a hand-written, offline list of about 280
words with about 2,000 follower links. Its format is one line per word, `word: follower, follower, …`.
Add lines freely. The random chain only walks through words that have their own
line, and it never repeats a word.

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0], length: 5,
  phase: 'build' | 'play',
  solver: 0 | 1,                               // who is solving now (play phase)
  builder: 0 | 1, gate: true, draft: ['book', 'case', …],
  chains: [['book', …] | null, […] | null],   // chains[i] built BY player i
  boards: [                                    // boards[i] = player i solving chains[1 - i]
    { row: 1, shown: 1, hints: 0, lastWrong: '',
      startedAt: null | ms, finishedAt: null | ms }, …
  ],
  scored: false
}
```

**Known limitations**
- Suggestions only cover words in the list. Online suggestions (e.g. the free Datamuse API)
  could be added as an optional extra, but it's noisy for compound words.
- Words are stored in plain text in localStorage.

### 6.4 Mystery Number (`mystery-number`)
**How it's played:** each player locks in a secret number. Players ask each other
open-ended, silly questions ("could I win a fight against this many chickens?", "would
I get sick eating this many hot dogs?") and write down whatever they conclude. **The app
never says higher or lower.** A guess is only ever ✓ or ✗. The first correct guess wins the round.

**UI**
- Toolbar: round, win tally, *Reveal both*, *New round*, *Reset scores* (also sets the round back to 1).
- **Settings bar:** an optional shared free-text **Range** ("1–100"). It carries over between rounds.
- Two columns. **Column i belongs to player i:**
  - **Top:** their own secret number (password field with `inputmode="decimal"`, Show/Hide peek,
    **Lock it in**). It must parse as a number. Commas and spaces are stripped, and decimals and negatives are OK.
    Locked: *Reveal* / *Change* (Change is hidden once the round is won).
  - **"<Me>'s notes on <Other>'s number":** a free-text note list (Enter or *Add*, × to delete).
    Tapping a note or ✎ edits it in place: Enter/Save keeps it, Esc cancels, clicking away saves,
    and emptying it deletes the note. Guess entries can't be edited.
  - **🎯 Guess box:** disabled until the other player has locked in. A wrong guess flashes "✗ Nope!",
    adds a red "✗ Guessed 40" entry to the notes (it can't be deleted) and adds 1 to the guess counter
    in the header. A correct guess wins, reveals both numbers and shows a banner
    "🏆 X found Y's number (37) in 4 guesses!".

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0], range: '', winner: null | 0 | 1,
  sides: [ // sides[i]: player i's own secret + player i's notes/guesses about the OTHER number
    { secret: '37', locked: true, revealed: false, guesses: 2,
      notes: [{ kind: 'note', text: '…' }, { kind: 'guess', text: '40', correct: false }] },
    { … }
  ]
}
```

**Known limitations:** same as 20 Questions. On one screen the other player looks away while a number is
typed, and numbers are stored in plain text in localStorage.

---

## 7. Manual test checklist
There are no automated tests yet. Before you finish a change:
- [ ] Home screen lists every game. Renaming players updates them inside games.
- [ ] Each game opens from its card. *← All games* and the browser Back button return home.
- [ ] Refresh mid-game: the state is restored.
- [ ] No console errors (open DevTools).
- [ ] 375px-wide viewport (phone): no horizontal scroll, everything tappable.
- [ ] Dark mode (OS setting) looks right.
- [ ] Leaving a game removes its document listeners (e.g. Space no longer deals on the home screen).

---

## 8. Roadmap / ideas

**Infrastructure**
- [x] Manual light/dark toggle in the top bar (`data-theme`).
- [ ] Settings panel: sound on/off, etc.
- [ ] More shared helpers as patterns repeat (e.g. the look-away gate screen, timers, a confirm dialog).
- [ ] Replace `confirm()` with an in-app modal.
- [ ] PWA manifest + service worker, so it installs to the home screen and works offline.
- [ ] Optional automated smoke tests (e.g. Playwright) once there are more games.
- [ ] Two-device mode (each player on their own phone): needs a realtime backend
      (e.g. Firebase/Supabase/PartyKit). This would also fix secret entry in 20 Questions.

**20 Questions**
- [ ] Turn indicator (whose turn to ask).
- [ ] Optional "guess" entries that are logged differently from questions.
- [ ] Hold-to-peek secret instead of a Show toggle.

**First & Last**
- [ ] Difficulty setting (easy / normal / hard letter tables).
- [ ] Optional countdown timer per deal.
- [ ] Configurable minimum word length.
- [ ] First to N points wins a match.

**Chain Link**
- [ ] Grow the word list, and maybe let players save new pairs they invent ("teach it").
- [ ] Optional online suggestions (Datamuse) when the offline list has nothing.
- [ ] Pause button for the timer.
- [ ] Setting for the hint penalty (currently fixed at 10s).

**New game ideas** (brainstormed with the user 2026-10-19; ★ = the assistant's top picks)
- [ ] ★ Categories: random letter + category + short countdown, first to answer taps to score.
- [ ] ★ Would You Rather, "sync" mode: both secretly pick A/B, reveal together, score matches.
- [x] ~~Hot & Cold numbers~~ → built as **Mystery Number** (no higher/lower, by user request).
- [ ] Word Chain: next word starts with the last letter of the previous one, turn timer, repeat detection.
- [ ] Hidden Word / Hangman duel (reuse the Chain Link gate pattern).
- [ ] Anagram race (needs a word list).
- [ ] Who Knows Who Better (needs a question bank).
- [ ] Fishbowl / Taboo-style describe-it with a timer (needs a word bank).
- [ ] Speed Tap reaction duel (false-start detection).
- [ ] Simple tally / scoreboard for offline games.

- [x] Shared UI helpers (`js/core/ui.js`): toolbar, secret panel, inline editor, focus-safe rendering.

---

## 9. Changelog
- **2026-10-19:** Initial build: hub (registry, routing, players, storage),
  20 Questions, First & Last, game template, this document.
- **2026-10-19:** 20 Questions: per-player category replaced by one shared category bar above the columns.
- **2026-10-19:** Fixed stray "false" text in 20 Questions. Added the light/dark toggle in the top bar.
- **2026-10-19:** Added Chain Link with an offline word list. Added `GameHub.assets` for game data files.
- **2026-10-19:** Chain Link: removed the "accept it" button. Only the builder's exact word counts (game design rule).
- **2026-10-19:** "Reset scores" in 20 Questions and Chain Link now also sets the round counter back to 1
  (the round counter otherwise only ever goes up). The current round in progress is kept.
- **2026-10-19:** Added Mystery Number (secret numbers, free-text notes, right/wrong-only guessing).
- **2026-10-19:** In-place editing of Mystery Number notes and 20 Questions question text.
- **2026-10-19:** Refactor: added `js/core/ui.js` (`GameHub.ui`) and shared CSS (settings bar, player
  columns, counter, secret panel, inline edit). All four games and the template now use them. No visible change.
- **2026-10-19:** 20 Questions: adjustable question limit (− / + by 5, ∞ unlimited) next to the category.
- **2026-10-19:** Chain Link: words typed inline in each row. Now one solver at a time with a timer, lowest time wins,
  hints add +10s, and wrong guesses are no longer counted.
