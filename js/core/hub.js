/*
 * Game Night hub
 * --------------
 * Owns everything shared between games: the game registry, hash routing,
 * the home screen, player names, localStorage helpers and the `h()` DOM helper.
 *
 * Games never touch the hub's internals. They call GameHub.register({...})
 * and receive a `ctx` object when mounted. See docs/PLANNING.md.
 */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'gamenight:';
  const DEFAULT_PLAYERS = ['Player 1', 'Player 2'];
  const games = [];
  let activeCleanup = null;

  // ---------------------------------------------------------------------------
  // Storage (JSON values, namespaced, never throws)
  // ---------------------------------------------------------------------------
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      } catch (e) {
        /* storage full or blocked: the game still works, it just won't persist */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + key);
      } catch (e) {
        /* ignore */
      }
    },
  };

  function scopedStorage(namespace) {
    return {
      get: (key, fallback) => storage.get(namespace + ':' + key, fallback),
      set: (key, value) => storage.set(namespace + ':' + key, value),
      remove: (key) => storage.remove(namespace + ':' + key),
    };
  }

  // ---------------------------------------------------------------------------
  // h(tag, attrs, ...children): tiny DOM builder
  //   attrs.class      -> className
  //   attrs.onclick    -> addEventListener('click', fn)  (any on* key)
  //   attrs.value      -> set as property (keeps inputs in sync)
  //   attrs.dataset    -> merged into el.dataset
  //   true / false     -> boolean attribute present / omitted
  // children may be strings, numbers, nodes, arrays, or null/false (skipped).
  // Text is always set via text nodes, so user input is never parsed as HTML.
  // ---------------------------------------------------------------------------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key === 'value' || key === 'checked') el[key] = value;
        else if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else el.setAttribute(key, value === true ? '' : String(value));
      }
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(el, children) {
    for (const child of children) {
      if (child == null || child === false) continue;
      if (Array.isArray(child)) appendChildren(el, child);
      else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }

  // ---------------------------------------------------------------------------
  // Players
  // ---------------------------------------------------------------------------
  function getPlayers() {
    const names = storage.get('players', DEFAULT_PLAYERS);
    return [0, 1].map((i) => {
      const name = (names[i] || '').trim() || DEFAULT_PLAYERS[i];
      return { index: i, name, cssClass: 'p' + (i + 1) };
    });
  }

  function setPlayerName(index, name) {
    const names = storage.get('players', DEFAULT_PLAYERS).slice();
    names[index] = name;
    storage.set('players', names);
  }

  // ---------------------------------------------------------------------------
  // Theme: no saved choice = follow the OS. A click saves the opposite of what's
  // showing now. The inline script in index.html applies the saved value early.
  // ---------------------------------------------------------------------------
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
  }

  function updateThemeButton() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const dark = currentTheme() === 'dark';
    btn.textContent = dark ? '☀️' : '🌙';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    storage.set('theme', next);
    updateThemeButton();
  }

  // ---------------------------------------------------------------------------
  // Registry
  // ---------------------------------------------------------------------------
  function register(game) {
    for (const field of ['id', 'title', 'mount']) {
      if (!game || !game[field]) throw new Error(`GameHub.register: game is missing "${field}"`);
    }
    if (!/^[a-z0-9-]+$/.test(game.id)) {
      throw new Error(`GameHub.register: id "${game.id}" must be lowercase kebab-case`);
    }
    if (games.some((g) => g.id === game.id)) {
      throw new Error(`GameHub.register: duplicate game id "${game.id}"`);
    }
    games.push(game);
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------
  function renderHome(root) {
    const players = getPlayers();

    const playerFields = players.map((p) =>
      h('label', { class: `player-field ${p.cssClass}` },
        h('span', { class: 'player-field__dot', 'aria-hidden': 'true' }),
        h('input', {
          class: 'input',
          type: 'text',
          maxlength: '20',
          value: p.name === `Player ${p.index + 1}` ? '' : p.name,
          placeholder: `Player ${p.index + 1}`,
          'aria-label': `Player ${p.index + 1} name`,
          oninput: (e) => setPlayerName(p.index, e.target.value),
        })
      )
    );

    const cards = games.map((g) =>
      h('a', { class: 'game-card', href: `#/game/${g.id}` },
        h('span', { class: 'game-card__emoji', 'aria-hidden': 'true' }, g.emoji || '🎲'),
        h('span', { class: 'game-card__body' },
          h('span', { class: 'game-card__title' }, g.title),
          g.description && h('span', { class: 'game-card__desc' }, g.description)
        ),
        h('span', { class: 'game-card__go', 'aria-hidden': 'true' }, '→')
      )
    );

    root.append(
      h('section', { class: 'home' },
        h('div', { class: 'home__hero' },
          h('h1', { class: 'home__title' }, 'Pick a game'),
          h('p', { class: 'home__lede' }, 'Two players, one screen.')
        ),
        h('div', { class: 'card players-card' },
          h('h2', { class: 'card__title' }, 'Who’s playing?'),
          h('div', { class: 'players-card__fields' }, playerFields)
        ),
        h('div', { class: 'game-grid' },
          cards.length ? cards : h('p', { class: 'empty' }, 'No games registered yet.')
        )
      )
    );
  }

  function renderGame(root, game) {
    const ctx = {
      get players() { return getPlayers(); },
      storage: scopedStorage('game:' + game.id),
      h,
      goHome() { location.hash = '#/'; },
    };
    const container = h('section', { class: `game game--${game.id}` });
    root.append(container);
    try {
      const cleanup = game.mount(container, ctx);
      if (typeof cleanup === 'function') activeCleanup = cleanup;
    } catch (err) {
      console.error(err);
      container.replaceChildren(
        h('div', { class: 'card error' },
          h('h2', null, 'This game failed to load'),
          h('pre', null, String(err && err.stack || err))
        )
      );
    }
  }

  function route() {
    if (activeCleanup) {
      try { activeCleanup(); } catch (e) { console.error(e); }
      activeCleanup = null;
    }

    const root = document.getElementById('app');
    root.replaceChildren();

    const [section, id] = location.hash.replace(/^#\/?/, '').split('/');
    const game = section === 'game' ? games.find((g) => g.id === id) : null;

    document.body.dataset.view = game ? 'game' : 'home';
    document.getElementById('topbar-title').textContent = game ? game.title : '';
    document.title = game ? `${game.title} · Game Night` : 'Game Night';

    if (game) renderGame(root, game);
    else renderHome(root);
    window.scrollTo(0, 0);
  }

  function start() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    darkQuery.addEventListener('change', updateThemeButton);
    updateThemeButton();

    window.addEventListener('hashchange', route);
    route();
  }

  // assets: a shared bag for data files that load before their game,
  // keyed by game id (e.g. GameHub.assets['chain-link'] = { links }).
  window.GameHub = { register, start, h, storage, getPlayers, assets: {} };
})();
