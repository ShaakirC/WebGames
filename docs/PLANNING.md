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
- **Hosting (live):** GitHub Pages from the `main` branch, root folder, of
  [ShaakirC/WebGames](https://github.com/ShaakirC/WebGames), served on the `games.` subdomain
  of the owner's domain (registered at domains.co.za, with a DNS `CNAME games → shaakirc.github.io`).
  Every push to `main` deploys automatically.
  - GitHub keeps a `CNAME` file in the repo root for the custom domain. **Don't delete it.** If it
    was added through the GitHub UI, `git pull` before pushing.
  - `.nojekyll` stops GitHub Pages from hiding files whose names start with `_` (e.g. `_template.js`).

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
| `ui.stepper({ label, groupLabel, value, onMinus, onPlus, canMinus, canPlus, minusLabel, plusLabel, extra })` | The settings-bar "LABEL [−] value [+]" control. `canMinus`/`canPlus: false` disables a button. `minusLabel`/`plusLabel` are the aria-labels (default "Decrease/Increase <label>"), and `groupLabel` overrides the group's aria-label. `extra` nodes go after + (20 Questions' ∞ toggle; give such buttons `stepper__btn`). The game keeps the value and its limits; the helper only draws. Used by 20 Questions, Word Budget and Ship Sinker. |
| `ui.gate({ player, emoji, title, text, body, actionLabel, onAction })` | The "look away" card shown before one player's private screen: a centred card in `player`'s colour with a big emoji, title, muted text, optional `body` nodes (settings, rules…) and a `.btn--xl` action. Used by Chain Link (builder and solver gates), Word Budget and Ship Sinker. |
| `ui.inlineEditor({ root, getText, save, renderRow, render })` | Edits list rows in place, one at a time, keyed by a string like `"0:3"`. In the row renderer: `if (editor.isEditing(key)) return h('li', { 'data-editing-row': true, … }, editor.field('Edit note'))`. Start with `editor.start(key)`. `save(key, text)` returns `true` when a full redraw is needed (e.g. it deleted the row). Otherwise only that row is swapped, so the click that caused the blur still lands. Call `editor.reset()` on a new round. |

**Shared CSS classes** (in `base.css`):
- **Settings bar:** `.settings-bar` with `.settings-bar__field`, `__label` and `__input`.
- **Stepper:** `.stepper` with `__label`, `__btn` and `__value` (rendered by `ui.stepper`).
- **Two player cards:** `.player-columns` containing `.player-col` cards, with `__head`, `__name` and `__sub`.
- **Counter pill:** `.counter`, with `.counter--max` for when it's at its limit.
- **Gate:** `.gate` with `__emoji`, `__title` and `__text` (rendered by `ui.gate`).
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
| `gamenight:game:word-budget:state` | Word Budget | see §6.5 |
| `gamenight:game:word-budget:seen` | Word Budget | every word dealt so far (lowercase). Kept across rounds and score resets so words don't repeat |
| `gamenight:game:ship-sinker:state` | Ship Sinker | see §6.6 |
| `gamenight:game:four-up:state` | Four Up | see §6.7 |
| `gamenight:game:dots-and-boxes:state` | Dots & Boxes | see §6.8 |
| `gamenight:game:gomoku:state` | Gomoku | see §6.9 |
| `gamenight:game:wall-race:state` | Wall Race | see §6.10 |

If you change a game's state shape incompatibly, either migrate it in `mount()`
or rename the key (e.g. `state.v2`) so old saves don't crash the game.

### 4.8 Styling
- Colours come from tokens on `:root`. Never hard-code hex values in game CSS. Add a token if you need one.
  Game-specific tokens so far: `--board-wood`, `--board-line`, `--stone-black` and `--stone-white` (Gomoku).
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

### 6.5 Word Budget (`word-budget`)
**How it's played:** the clue-giver sees a list of words (default 8). The guesser **never looks at the
screen**. The clue-giver has a budget of spoken clue words (default 15) to get the guesser to say every
word on the list. Elephant → "trunk". Beyoncé → "singer"… "Mariah Carey?" → "Destiny's"… "Beyoncé!".
Guesses are free. Every word the clue-giver says costs one clue ("Destiny's Child" = 2). No part of the
target word, no gestures, no "sounds like". These rules are on the honour system and shown on the gate screen.
The list is fixed (no skipping or swapping words).

**Rounds and scoring:** each round both players give clues once. Who goes first alternates by round.
Most words guessed wins the round, fewer clues used breaks a tie, and anything else is a dead heat.
The second clue-giver's gate shows the score to beat.

**UI**
- Toolbar: round, win tally, *New round*, *Reset scores*.
- **Settings bar** (only before the round's first turn, then shown as read-only pills so both turns match):
  - Words − / + (3–15).
  - Clues − / + (from the number of words up to 50). Raising the word count above the clue budget pushes the clues up too.
  - Timer − / + through Off, 1:00, 1:30, 2:00, 3:00, 5:00. Off by default.
  - Word-type toggles: 🐘 Things, 🎤 People & places, 🏃 Actions, ✨ Describing. At least one stays on.
    Defaults are Things + People & places. All settings carry over between rounds.
- **Gate** ("🙉 X, you're giving clues. Y, turn around"), the rules, then **Deal my words**, which deals the
  list and starts the clock.
- **Play:** a HUD pinned under the top bar shows clues used / budget (red when out, "last guesses!"),
  the countdown if the timer is on (red under 10s), words got, **↶ Undo** and **End turn**. Below it, one card
  per word with **+1 clue** and **✓**, plus that word's clue count. Clues are logged against the card being
  worked on, which gives the total. Once the budget is used up, +1 is disabled but ✓ still works
  (for the last guess). Getting every word ends the turn automatically, and so does the timer running out.
  Ending early with clues left asks for confirmation.
- **Results:** a banner with the winner, and two columns (in turn order) listing each word ✓/✗ with its clue count.

**Dealing:** each slot picks a category by weight (Things 4, People & places 3, Actions 1.5, Describing 1),
then a random word from it that hasn't been dealt before (the `seen` key). When a category runs out,
its words become available again. With the default types there are no repeats for about 85 rounds.

**Word bank:** `js/games/word-budget-words.js`, about 1,900 words in four comma-separated lists
(`#` lines are comments). It includes plenty of South African people, places, brands, food and slang.
Duplicates (ignoring case) are dropped across all lists, keeping the first.

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0],
  settings: { words: 8, clues: 15, timer: 0 /* seconds, 0 = off */, types: ['things', 'people'] },
  first: 0 | 1,             // who gives clues first this round
  giver: 0 | 1,             // who is giving clues now
  phase: 'gate' | 'play' | 'results',
  turns: [                  // turns[i] = player i's turn as clue-giver, null until dealt
    { cards: [{ word: 'Beyoncé', clues: 2, got: true }],
      log: [0, 0, -1],      // n = clue on card n, -1-n = card n marked got (for Undo)
      startedAt: ms, endedAt: null | ms, end: null | 'all' | 'stopped' | 'time' }, …
  ],
  winner: null | 0 | 1 | 'tie'
}
```

**Known limitations:** the clue count relies on the clue-giver tapping honestly. A refresh mid-turn keeps the
board (the guesser isn't looking), and the timer keeps running through it.

### 6.6 Ship Sinker (`ship-sinker`)
**How it's played:** a mini version of the classic grid battle game. Each player secretly places a small fleet, then
they take turns firing at each other's waters. **A hit (or a sink) means you shoot again; a miss passes the turn.**
Sinking a ship reveals its whole outline. The first to sink the entire enemy fleet wins the round.

**Board sizes and fleets** (`FLEETS` at the top of `ship-sinker.js`). Ships go in straight lines, can touch, and can't overlap.

| Board | Ships |
|---|---|
| 5×5 | 3, 2 |
| 6×6 (default) | 3, 2, 2 |
| 7×7 | 4, 3, 2 |
| 8×8 | 4, 3, 3, 2 |

At 8×8 the cells drop to about 36px on a 360px phone, a bit under the usual 40px tap target. 5–7 are comfortable.

**Flow**
1. **Settings bar:** Board − / + (5–8). It can only be changed before either player has locked a fleet
   (changing it clears the current placement). After that it's shown as read-only pills. The size carries over.
2. **Gate** (`ui.gate`): "🙈 X, hide your fleet. Y, look away!". The player who places first, and fires first,
   alternates by round.
3. **Placement:** a tray of ships (longest first). Pick a ship, then tap a square. The tapped square is the ship's
   top/left end, and a ship dropped near the edge slides back onto the board. Overlaps shake the square.
   Desktop hover previews where it will land (red if it doesn't fit). Tapping a placed ship picks it back up.
   *↻ Rotate* (or the **R** key) switches across/down. There are also *🎲 Random fleet* and *Clear*.
   **🔒 Lock my fleet** is enabled once every ship is placed. Then comes the second player's gate, then battle.
   Refreshing during placement always goes back to the gate.
4. **Battle:** nothing on screen is secret any more, so there's no gate and both players can watch. A turn bar
   ("🎯 X, fire at Y's waters" plus the last result: miss, hit, or "Sunk a 3-ship!") sits above two boards, one
   per player's waters. Only the board being fired at is tappable, and it's ringed in the accent colour (and moved
   to the top on phones). Misses show •, hits 💥, and sunk ships get a red outline over their cells. Each board
   shows "n / N afloat", the fleet's ship lengths (sunk ones faded) and "hits from shots".
   - **👁 Hold to peek (Y, look away):** under each board. While its owner holds it (mouse, touch, or Space/Enter),
     their unsunk ships show on their own board with a dashed outline. Releasing, sliding off or losing focus hides
     them again. It only toggles a CSS class (`.is-peeking`), so nothing is saved or redrawn. The long-press menu on
     phones is suppressed. The button goes away once every ship is sunk, or when the round ends.
5. **Done:** a banner "🏆 X sank Y's whole fleet in N shots!" with *Next round*. Unsunk ships are revealed with
   a dashed outline. The win tally carries over between rounds.

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0], size: 6,
  first: 0 | 1,                 // places first and fires first; alternates each round
  phase: 'place' | 'play' | 'done',
  placer: 0 | 1, gate: true,
  draft: [{ len: 3, r: 2, c: 1, dir: 'h' | 'v' }] | null,  // r/c null = not placed yet
  fleets: [ships | null, ships | null],   // fleets[i] = player i's locked ships
  turn: 0 | 1,                            // who is firing
  shots: [['0,3', …], […]],               // shots[i] = "row,col" cells player i fired at
  last: null | { shooter, result: 'miss' | 'hit' | 'sunk', len },
  winner: null | 0 | 1
}
```
Hits, sinks and "afloat" counts are worked out from `fleets` + `shots`, never stored. Which ship is selected in the
tray is UI-only (not saved).

**Known limitations:** fleets are stored in plain text in localStorage. Firing first is a small advantage, which is
why the first player alternates by round.

### 6.7 Four Up (`four-up`)
**How it's played:** the classic four-in-a-row genre. Players take turns dropping a token into a 7-column × 6-row
upright grid, and it falls to the lowest free slot. The first to line up **four or more** across, down or diagonally
wins the round. A full board with no line is a draw. Who goes first alternates by round. Nothing is secret, so there's no gate.

**UI**
- Toolbar: round, win tally, *New round* (asks first if a game is in progress), *Reset scores*.
- A "● X's turn" pill in the current player's colour.
- **Board:** one CSS grid. Row 1 is the aiming row, where the current player's token bobs above the chosen column.
  Row 2 is a spacer, and rows 3–8 are the board: an accent-coloured frame (`.c4-frame`, a grid item spanning the
  board rows) with a hole per cell. The aimed column's holes are tinted in the player's colour. The latest token has a small dot.
- **Controls under the board** (as the user asked): **◀** and **▶** move the aim, skipping full columns, and are
  disabled when there's no open column that way. **⬇ Drop in column N** drops the token. Tapping any cell or aiming
  slot also moves the aim there (it never drops). Keys: **← / →** aim, **↓** drops. The listener is removed on leaving.
  After a drop the aim stays in the same column, or slides to the nearest open one if that column is now full.
- **Drop animation (1s):** the new token is rendered in its final cell with `.is-falling`, and `c4-fall` translates it
  from the aiming row (`--fall` = cells to fall, so the distance is `--fall × (cell + gap) + spacer + gap`) with a
  gravity ease-in and two small bounces. The state is saved straight away, but all controls are locked and the turn
  pill and banner wait until it lands (`FALL_MS` = 1000, kept in sync with the CSS). Under `prefers-reduced-motion`
  there's no animation and no wait.
- **End:** "🏆 X got four in a row!" or "🤝 The board is full. It's a draw!" with *Next round*. The winning tokens get a
  pulsing ring. Draws don't change the win tally.

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0],
  first: 0 | 1, turn: 0 | 1,
  board: [[null | 0 | 1, …7], …6],   // board[r][c], row 0 is the top
  cursor: 3,                         // aimed column (kept through a refresh)
  last: [r, c] | null, moves: 0,
  winner: null | 0 | 1 | 'draw',
  line: [[r, c], …]                  // winning cells (4+, may include more than one line)
}
```
Which token is falling is UI-only. A refresh mid-fall just shows the token in place.

### 6.8 Dots & Boxes (`dots-and-boxes`)
**How it's played:** start with a grid of dots. Players take turns joining two neighbouring dots with a line.
Drawing the **fourth side of a box claims it** (a dot in your colour) and **earns another turn**. One line can close
two boxes at once, which claims both. When every line is drawn, whoever owns the most boxes wins the round. With an
even number of boxes a tie is possible (a draw, which doesn't change the tally). Who goes first alternates by round.

**UI**
- Toolbar: round, win tally, *New round* (asks first if a game is in progress), *Reset scores*.
- **Settings bar:** a Grid stepper (`ui.stepper`), 3×3 to 6×6 boxes, default 4×4. It can only be changed before
  the first line, then it's shown as a read-only pill. The size carries over between rounds.
- **Score cards** for both players (box counts). The current player's card is tinted. Under them is the turn line:
  "X's turn: draw a line." or "✨ Box! X, go again."
- **Grid:** a `(2n+1)×(2n+1)` CSS grid. Even tracks are thin (`--dot`) and hold the dots, odd tracks are wide and
  hold the boxes. Each line is a `<button>` filling its track: `::after` is the visible stroke and `::before` adds
  `--reach` px of tap area on each side. Undrawn lines are faint dashes; hover/focus previews the line in the
  current player's colour. Drawn lines are solid in the colour of whoever drew them, and the latest line has a soft
  halo. Claimed boxes get a tint and a dot in the owner's colour.
- At 6×6 on a 375px phone the boxes are about 40px and the tap strip across a line is about 32px. 3–5 are roomier.
- **End:** "🏆 X wins 10–6!" or "🤝 8–8. It's a draw!" with *Next round*. All lines are disabled.

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0], size: 4,       // boxes per side
  first: 0 | 1, turn: 0 | 1,
  hLines: [[null | 0 | 1, …n], …n+1],    // hLines[r][c]: dot (r,c) → (r,c+1), value = who drew it
  vLines: [[null | 0 | 1, …n+1], …n],    // vLines[r][c]: dot (r,c) → (r+1,c)
  boxes:  [[null | 0 | 1, …n], …n],      // owner of each box
  moves: 0,
  last: null | { kind: 'h' | 'v', r, c },
  again: false,                          // the latest line claimed a box
  winner: null | 0 | 1 | 'draw'
}
```
Scores are counted from `boxes`, never stored.

### 6.9 Gomoku (`gomoku`)
**How it's played:** players take turns placing black and white stones on the points (intersections) of a grid.
The first to get **five or more** in an unbroken line, across, down or diagonally, wins. Nothing moves or is
captured. A full board with no line is a draw, which doesn't change the tally. Black goes first, and the player
who plays black alternates by round.

**UI**
- Toolbar: round, win tally, *New round* (asks first if a game is in progress), *Reset scores*.
- **Settings bar:** a Board stepper (`ui.stepper`) through 9×9, 11×11, 13×13 and 15×15 (the default and traditional
  size). It can only be changed before the first stone, then it's shown as a read-only pill. The size carries over.
- **Player cards** with each player's stone colour. The current player's card is tinted. On phones the "BLACK/WHITE"
  word is hidden (the stone icon shows it). Under them is the turn line.
- **Board:** one `<button>` per point in a CSS grid on a wood background. `::before`/`::after` draw the lines through
  each point's centre, cut short on the edges (`is-t/b/l/r`). Star points are marked: four near the corners plus the centre.
  The latest stone has a small dot in the opposite colour, and only a newly placed stone plays the pop animation.
  The winning stones get an accent ring.
- **Placing depends on the device** (`(hover: hover) and (pointer: fine)`):
  - **Mouse:** click a point to place. Hovering shows a faint preview stone.
  - **Touch:** points are only about 22px on a phone at 15×15, so the first tap shows a dashed preview stone and
    a big **Place at J8** button. Tap the same point again or press the button to place it. Tapping another point
    moves the preview.
- **Keyboard:** the board is a single tab stop (roving `tabindex`). Arrow keys move around and Enter/Space places
  (on touch devices Enter previews first, like a tap).
- Points are named like board notation: columns A–P skipping I, rows numbered from the bottom.

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0], size: 15,
  first: 0 | 1,                 // plays black; alternates each round
  turn: 0 | 1,
  board: [[null | 0 | 1, …n], …n],   // board[r][c] = player index (colour comes from `first`)
  moves: 0, last: [r, c] | null,
  winner: null | 0 | 1 | 'draw',
  line: [[r, c], …]             // winning stones
}
```
The touch preview and keyboard position are UI-only. The line check is the same idea as Four Up's (`winningLine`). If
a third game needs it, move it into a shared helper.

### 6.10 Wall Race (`wall-race`)
**An original design.** The user asked for Quoridor, which is a specific commercial game, so we don't recreate it.
This race-and-block game was picked instead (2026-10-28). It first shipped locally as "Crumbling Walls" with walls that
crumbled after 3 turns. The user then asked for permanent walls, so it became Wall Race with a wall budget, before
it was ever pushed. Its own mechanics: single-segment walls, an adjustable budget, adjustable board size, no jumping,
and pawns that block each other.

**How it's played:** each player has one pawn, starting in the middle of opposite edges. Player 1 starts at the
bottom and heads for the top row; player 2 does the reverse. On your turn, do one of these:
- **Step** one square up, down, left or right. You can't go through a wall or onto the other pawn.
- **Build** a wall segment in any open gap between two squares, if you have walls left.

Walls are permanent for the round. Each player has the same **budget** (default 8). **A wall can never leave either
player without a route home** (breadth-first search; pawns don't count as blocking a route). If your pawn has no legal
step (boxed in by walls plus the other pawn), you can build or *Pass*. The first pawn to reach its finish row wins the
round. Who acts first alternates by round.

**Opening setup** (user request, 2026-10-28): before the race, each player may place **up to 3 opening walls**
(`OPENING_WALLS`), which come out of their budget. The round's first player sets up first (player 1 in round 1, then
alternating, like everything else), then the other player, then the race starts with the first player to move. The
third opening wall hands over automatically. **✓ Done (n / 3)** (or **Skip: no opening walls**) hands over early.
Pawns can't move during setup, the no-sealing rule still applies, and Undo works. The second player sees the first
player's walls before placing theirs.

**UI**
- Toolbar: round, win tally, **↶ Undo** (one level: undoes the latest action by either player, not after a win),
  *New round* (asks first mid-game), *Reset scores*.
- **Settings bar:** two steppers (`ui.stepper`): Board 5×5, 7×7 (default) or 9×9, and Walls 3–15 per player
  (default 8). They can only be changed before the first action (including the first opening wall or Skip), then
  they're shown as read-only pills. Both carry over.
- **Setup:** the turn line reads "🧱 Setup: X, place up to 3 opening walls (1 / 3). Y sets up next." with a big
  Done/Skip button under the board. No squares glow.
- Player cards (⬆/⬇ shows which way each heads, plus "n walls left", red at 0). The current player's card is tinted.
  The turn line changes to "no walls left, step…" or "boxed in: pass" when needed.
- **Board:** a CSS grid with squares on even tracks and thin gaps on odd tracks (`--gaps` = size − 1). Finish rows are
  tinted in their owner's soft colour. Squares the current player can step to glow. Pawns show the player's initial,
  and the current one has a ring.
- **Gaps** are buttons with extra tap area (`::before`). Hovering previews a wall in the current player's colour. Gaps
  that would cut someone off are hatched and disabled. With no walls left, every gap is disabled (not hatched).
- **Walls** are drawn in the builder's colour. Only the newest wall, or the pawn that just moved, plays the pop animation.

**State** (`state` key)
```js
{
  round: 1, wins: [0, 0], size: 7, budget: 8, first: 0 | 1,
  phase: 'setup' | 'play',
  turn: 0 | 1,                             // who's acting: the setup player, then the player to move
  pawns: [[r, c], [r, c]],                 // pawns[0] starts bottom-middle, pawns[1] top-middle
  walls: [{ key: 'h-2-3' | 'v-4-1', owner, setup? }],  // h-r-c: below (r,c); v-r-c: right of (r,c); setup = opening wall
  moveNo: 0,                               // actions this round (setup walls and Done count)
  last: null | { type: 'move' | 'wall' | 'pass' | 'setup', by },
  undo: null | <state snapshot without undo>,
  winner: null | 0 | 1
}
```
Walls left = `budget` minus that player's walls, never stored. A save without a numeric `budget` (from before it
existed) gets the default on mount; otherwise both Walls buttons would stay disabled. A save without `phase` (from
before setup existed) is treated as `'play'`.

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
- [ ] More shared helpers as patterns repeat (e.g. timers, a confirm dialog).
- [x] − / + stepper → `ui.stepper` (20 Questions, Word Budget and Ship Sinker all use it).
- [x] Look-away gate screen → `ui.gate` (Chain Link, Word Budget and Ship Sinker all use it).
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

**Word Budget**
- [ ] Grow the word bank, especially Actions and Describing.
- [ ] Difficulty tags (easy / hard words) and a difficulty setting.
- [ ] Option to skip or swap a word for a clue penalty (currently the list is fixed by design).

**Ship Sinker**
- [x] "Hold to peek" at your own fleet during battle.
- [ ] Ship-shaped variety (e.g. an L-shaped piece) on bigger boards.
- [ ] Rule toggle: strict alternating turns instead of "hit → shoot again".

**Four Up**
- [ ] Undo last move.
- [ ] Board size options (e.g. 6×5, 8×7) and a "five in a row" variant.
- [ ] A short "who's first" coin-flip instead of strict alternation.

**Dots & Boxes**
- [ ] Undo last line.
- [ ] Rectangular grids (e.g. 5×3) and bigger boards for tablets.

**Gomoku**
- [ ] Undo last stone.
- [ ] Rule variants: "exactly five" (six or more doesn't count), or opening restrictions to balance black's advantage.
- [ ] Pinch/zoom or a larger 19×19 board for tablets.

**Wall Race**
- [ ] Optional rule: walls crumble after N turns (the original "Crumbling Walls" idea), as a toggle.
- [ ] Show each player's shortest route length as a hint.

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
- [x] Clue-budget word game (user idea, 2026-10-26) → built as **Word Budget**.
- [x] Wall-and-race game (user asked for Quoridor, 2026-10-28) → built as **Wall Race**, an original design (§6.10).
- [ ] **Redacted** (user idea, 2026-10-26, parked): player 1 sees a trivia question (10 words or fewer) and its
      answer, and hides all but N words. Player 2 guesses the answer from what's left. Needs a vetted
      question bank (one clear answer, the answer not in the question, no single giveaway word) with
      accepted alternate answers. Open questions: how many words are kept, co-op or competitive scoring,
      the number of guesses, and whether blanks show word positions.

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
- **2026-10-26:** Added Word Budget: a clue budget, a fixed word list, both players give clues each round,
  an optional timer, and a word bank of about 1,900 words including South African names.
- **2026-10-28:** Added Ship Sinker (hidden fleets, 5×5–8×8 boards, hit → shoot again, sunk ships outlined).
  Added the shared `ui.gate` look-away helper and `.gate` CSS.
- **2026-10-28:** Refactor: added `ui.stepper` and `.stepper` CSS for − / + settings. 20 Questions, Word Budget and
  Ship Sinker now use it and their own stepper CSS is gone. No visible change.
- **2026-10-28:** Refactor: Chain Link and Word Budget gates now use `ui.gate`. Their own gate CSS is gone. No visible change.
- **2026-10-28:** Ship Sinker: added "👁 Hold to peek" under each board to see your own hidden ships during battle.
- **2026-10-28:** Added Four Up (four-in-a-row): ◀ / ▶ aim + Drop button under the board, a 1s falling-token animation, winning-line highlight.
- **2026-10-28:** Added Dots & Boxes (3×3–6×6 grid via `ui.stepper`, closing a box claims it and gives another turn, most boxes wins).
- **2026-10-28:** Added Gomoku (9×9–15×15, click to place on desktop, tap-preview + Place on touch, keyboard arrows). Added board/stone colour tokens to `base.css`.
- **2026-10-28:** Added Wall Race (original race-and-block game: step or build a wall from a 3–15 budget, walls are permanent, no sealing anyone in, one-level Undo).
- **2026-10-28:** Wall Race: opening setup. Each player places up to 3 walls (from their budget) before the race, first player first.
