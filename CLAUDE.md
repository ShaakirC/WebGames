# Game Night: agent briefing

A plain HTML/CSS/JS web app of two-player party games on one shared screen.
There is no build step, and it must keep working when `index.html` is opened from `file://`.

**Read [docs/PLANNING.md](docs/PLANNING.md) first.** It covers the architecture,
the game module contract, storage keys, styling rules and the roadmap.

Key rules:
- Games are self-contained modules: `js/games/<id>.js` (calls `GameHub.register`) +
  optional `css/games/<id>.css` (every selector scoped under `.game--<id>`).
  Start from `js/games/_template.js`.
- Reuse `GameHub.ui` (`js/core/ui.js`): `renderInto`, `toolbar`, `secretPanel`, `inlineEditor`…
  and the shared CSS in `base.css` before writing new UI (see PLANNING.md §4.6).
- No ES modules, frameworks or bundlers. Use classic scripts and the `GameHub` global.
- Never put user text into `innerHTML`. Build DOM with `h()`.
- Colours come from CSS tokens in `css/base.css` (light + dark). Use `p1`/`p2`
  classes for player colours.
- After any change, update docs/PLANNING.md (game specs, storage table, roadmap, changelog).
