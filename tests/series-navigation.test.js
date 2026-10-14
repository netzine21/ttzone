const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Run the real click handlers and HTML rendering without starting network polling.
function createApp(user = null) {
  const app = { innerHTML: '', className: '' };
  const history = [];
  const requests = [];
  const storage = new Map();
  const sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const context = vm.createContext({
    console,
    navigator: { userAgent: 'test', platform: 'test', maxTouchPoints: 0 },
    localStorage: { getItem: () => null },
    document: {
      getElementById: (id) => id === 'app' ? app : null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: {
      sessionStorage,
      location: { href: 'http://localhost/' },
      history: {
        replaceState: (value) => { history[history.length ? history.length - 1 : 0] = value; },
        pushState: (value) => history.push(value),
      },
      requestAnimationFrame: () => {},
    },
    fetch: (url) => {
      requests.push(url);
      // Navigation must work even when the network never responds.
      return new Promise(() => {});
    },
  });
  const source = readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  assert.ok(source.includes('  init();'));
  vm.runInContext(source.replace('  init();', `
    globalThis.testApp = { state, render, handleAppClick, handleBrowserPopState };
  `), context);
  const api = context.testApp;
  api.state.leagueSeries = [
    { id: 'series-a', name: '오늘도 핑퐁 월례정기모임', status: 'active' },
    { id: 'series-b', name: '다른 정기리그', status: 'active' },
  ];
  api.state.games = [
    { id: 'game-a', title: '월례모임 1회차', seriesId: 'series-a', formats: ['singles'], scheduledAt: '2026-10-14T10:00:00Z', registrations: [], maxParticipants: 20, operatorId: 'owner' },
    { id: 'game-b', title: '다른 리그 경기', seriesId: 'series-b', formats: ['singles'], scheduledAt: '2026-10-15T10:00:00Z', registrations: [], maxParticipants: 20 },
  ];
  if (user) {
    api.state.users = [user];
    api.state.sessionUserId = user.id;
  }
  function click(attribute, dataset) {
    const element = { dataset };
    return api.handleAppClick({ target: { closest: (selector) => selector === `[${attribute}]` ? element : null } });
  }
  return { ...api, app, requests, history, click };
}

test('series opens immediately without refetching already loaded data', () => {
  const ui = createApp();
  void ui.click('data-public-series', { publicSeries: 'series-a' });
  assert.match(ui.app.innerHTML, /series-detail-page/);
  assert.match(ui.app.innerHTML, /월례모임 1회차/);
  assert.doesNotMatch(ui.app.innerHTML, /다른 리그 경기/);
  assert.equal(ui.requests.length, 0);
});

for (const user of [null, { id: 'member', nickname: '일반회원' }, { id: 'owner', nickname: '운영자' }]) {
  test(`mapped game opens and browser back restores series (${user?.id || 'guest'})`, async () => {
    const ui = createApp(user);
    ui.state.selectedPublicSeriesId = 'series-a';
    ui.render();
    const seriesRoute = ui.history.at(-1);
    await ui.click('data-game-open', { gameOpen: 'game-a' });
    assert.match(ui.app.innerHTML, /public-game-detail/);
    assert.match(ui.app.innerHTML, /월례모임 1회차/);
    assert.doesNotMatch(ui.app.innerHTML, /series-detail-page/);
    assert.equal(ui.state.selectedPublicSeriesId, null);
    assert.equal(user ? ui.state.selectedGameId : ui.state.selectedPublicGameId, 'game-a');
    if (user?.id === 'owner') assert.match(ui.app.innerHTML, /data-open-operations/);
    else assert.doesNotMatch(ui.app.innerHTML, /data-open-operations/);
    ui.handleBrowserPopState({ state: seriesRoute });
    assert.match(ui.app.innerHTML, /series-detail-page/);
    assert.equal(ui.state.selectedPublicSeriesId, 'series-a');
    await ui.click('data-game-open', { gameOpen: 'game-a' });
    await ui.click(user ? 'data-back-games' : 'data-public-back', {});
    assert.doesNotMatch(ui.app.innerHTML, /public-game-detail|series-detail-page/);
    assert.match(ui.app.innerHTML, /정기리그 목록/);
    await ui.click('data-public-series', { publicSeries: 'series-b' });
    assert.match(ui.app.innerHTML, /다른 리그 경기/);
    assert.doesNotMatch(ui.app.innerHTML, /월례모임 1회차/);
    await ui.click('data-public-series-back', {});
    assert.doesNotMatch(ui.app.innerHTML, /series-detail-page/);
    assert.match(ui.app.innerHTML, /정기리그 목록/);
    assert.equal(ui.requests.length, 0);
  });
}
