// Browser integration checks using synthetic API data, never the production DB.
// Supply Playwright through NODE_PATH or a local development installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.TTGMS_UI_OUTPUT || os.tmpdir();
const user = { id: 'owner', nickname: '테스트 진행자', memberId: 'testowner', rank: '7', gender: 'male' };
const games = [{ id: 'source', title: '이전 정기리그', operatorId: user.id, operatorNickname: user.nickname, venueName: '테스트탁구장', venueAddress: '테스트시 테스트로 1', venuePhone: '', location: '테스트탁구장', scheduledAt: '2026-10-10T14:00:00', maxParticipants: 16, formats: ['singles'], formatModes: { singles: 'leagueOnly' }, note: '함께 즐겁게 경기해요', seriesId: 'series', seriesRound: 1, registrations: [{ nickname: '테스트선수', rank: '7', format: 'singles', teamName: '' }], preliminaryMatches: { singles: { completed: true, matches: [] } }, createdAt: '2026-10-10T00:00:00Z' }];
let failCreation = false;
let createRequests = [];
let bulkRequests = 0;

async function bindContext(browser, authenticated) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
  let currentUser = authenticated ? user : null;
  await context.addInitScript(() => {
    window.copiedInvitations = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => window.copiedInvitations.push(value) } });
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: undefined });
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      let data = {};
      if (url.pathname === '/api/auth/me') data = { user: currentUser };
      if (url.pathname === '/api/auth/login') { currentUser = { ...user, id: 'member', nickname: '테스트 참가자' }; data = { user: currentUser }; }
      if (url.pathname === '/api/venues') data = { venues: [{ id: 'venue', name: '테스트탁구장', address: '테스트시 테스트로 1' }] };
      if (url.pathname === '/api/league-series') data = { series: [{ id: 'series', ownerId: 'owner', venueId: 'venue', name: '테스트 월례리그', status: 'active', defaultFormats: ['singles'], defaultMaxParticipants: 16 }] };
      if (url.pathname === '/api/games' && request.method() === 'GET') data = { games };
      if (url.pathname === '/api/games' && request.method() === 'POST') {
        const payload = request.postDataJSON();
        createRequests.push(payload);
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (failCreation) return route.fulfill({ status: 503, json: { error: '테스트 저장 실패' } });
        const game = { ...payload, id: `new-${games.length}`, operatorId: 'owner', operatorNickname: user.nickname, registrations: [], seriesRound: payload.seriesId ? 2 : null };
        games.push(game);
        data = { game };
      }
      if (/^\/api\/games\/[^/]+$/.test(url.pathname) && request.method() === 'PATCH') {
        const game = games.find((item) => item.id === decodeURIComponent(url.pathname.split('/').at(-1)));
        Object.assign(game, request.postDataJSON());
        data = { game };
      }
      const bulk = url.pathname.match(/^\/api\/games\/([^/]+)\/registrations\/bulk$/);
      if (bulk) {
        bulkRequests++;
        const payload = request.postDataJSON();
        const game = games.find((item) => item.id === bulk[1]);
        game.registrations = payload.registrations.map((row) => ({ ...row, format: payload.format }));
        data = { added: game.registrations.length, skipped: 0, game };
      }
      return route.fulfill({ json: data });
    }
    const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.TTGMS_BROWSER_CHANNEL ? { channel: process.env.TTGMS_BROWSER_CHANNEL } : {}) });
  try {
    const owner = await bindContext(browser, true);
    const page = owner.page;
    await page.goto('http://localhost:4177/');
    await page.locator('[data-show-create-game]').click();
    assert.equal(await page.locator('[data-reuse-game]').isVisible(), false);
    assert.equal(await page.locator('#gameTitle').isVisible(), true);
    await page.screenshot({ path: path.join(output, 'create-direct-start-mobile.png'), fullPage: true });
    await page.locator('#gameTitle').fill('직접 작성 중인 새 게임');
    await page.locator('[data-game-import] > summary').click();
    assert.equal(await page.locator('[data-import-game]').isDisabled(), true);
    await page.locator('[data-reuse-game]').selectOption('source');
    assert.equal(await page.locator('#gameTitle').inputValue(), '직접 작성 중인 새 게임');
    assert.equal(await page.locator('#gameVenueName').inputValue(), '');
    assert.equal(createRequests.length, 0);
    await page.locator('[data-reuse-game]').selectOption('');
    assert.equal(await page.locator('[data-import-game]').isDisabled(), true);
    assert.equal(await page.locator('#gameTitle').inputValue(), '직접 작성 중인 새 게임');
    await page.locator('[data-reuse-game]').selectOption('source');
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'create-import-picker-mobile.png'), fullPage: true });
    await page.locator('[data-import-game]').click();
    assert.equal(await page.locator('[data-reuse-game]').inputValue(), 'source');
    assert.equal(await page.locator('[data-reuse-game]').isVisible(), false);
    await page.locator('.create-source-banner').getByText('이전 정기리그', { exact: false }).waitFor();
    assert.equal(await page.locator('#gameTitle').inputValue(), '이전 정기리그');
    await page.locator('#gameTitle').fill('수정한 게임 이름');
    await page.locator('[data-create-day="1"]').click();
    await page.locator('#gameMaxParticipants').fill('12');
    await page.locator('#gameMaxParticipants').press('Tab');
    assert.equal(await page.locator('#gameTitle').inputValue(), '수정한 게임 이름');
    assert.equal(await page.locator('[data-reuse-game]').inputValue(), 'source');
    await page.screenshot({ path: path.join(output, 'create-imported-mobile.png'), fullPage: true });
    await page.locator('[data-create-fresh]').click();
    assert.equal(await page.locator('#gameTitle').inputValue(), '');
    assert.equal(await page.locator('#gameVenueName').inputValue(), '');
    assert.equal(await page.locator('#gameScheduledAt').inputValue(), '');
    assert.equal(await page.locator('#gameMaxParticipants').inputValue(), '16');
    assert.equal(await page.locator('[name="reuseRoster"]').count(), 0);
    console.log('PASS: fresh form is default; optional import is separate and explicit; selection alone preserves edits; imported source is labeled; reset creates blank draft');
    await page.locator('#gameVenueName').fill('테스트탁구장');
    await page.locator('#gameVenueName').press('Tab');
    assert.equal(await page.locator('#gameVenueAddress').inputValue(), '테스트시 테스트로 1');
    assert.equal(await page.locator('.create-extra').getAttribute('open'), null);
    await page.locator('[data-create-day="1"]').click();
    assert.match(await page.locator('#gameTitle').inputValue(), /테스트탁구장 게임/);
    await page.locator('#gameTitle').fill('함께 탁구해요');
    await page.locator('[data-create-capacity="24"]').click();
    assert.equal(await page.locator('#gameTitle').inputValue(), '함께 탁구해요');
    await page.screenshot({ path: path.join(output, 'quick-create-mobile.png'), fullPage: true });
    const localSchedule = await page.locator('#gameScheduledAt').inputValue();
    // Two submit events while the save is pending must create only one game.
    await page.locator('form[data-form="game"]').evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
    await page.locator('.game-creation-notice').waitFor();
    assert.equal(await page.locator('.game-invitation').count(), 0);
    assert.match(await page.locator('.game-creation-notice').textContent(), /게임이 생성되었습니다.*내용을 확인한 후 참가자를 초대/);
    assert.equal(await page.locator('[data-detail-tab="status"]').getAttribute('class').then((value) => value.includes('is-active')), true);
    assert.equal(await page.locator('.public-detail-meta').getByText('24명', { exact: true }).isVisible(), true);
    await page.screenshot({ path: path.join(output, 'game-created-rules-mobile.png'), fullPage: true });
    const actionLayout = await page.locator('.game-rules-actions').evaluate((element) => {
      const buttons = [...element.querySelectorAll('button')];
      return {
        gap: buttons[1].getBoundingClientRect().left - buttons[0].getBoundingClientRect().right,
        borders: buttons.map((button) => getComputedStyle(button).borderTopWidth),
        icons: buttons.map((button) => Boolean(button.querySelector('svg'))),
      };
    });
    assert.ok(actionLayout.gap >= 10);
    assert.deepEqual(actionLayout.borders, ['1px', '1px', '1px']);
    assert.deepEqual(actionLayout.icons, [true, true, true]);
    for (const width of [320, 390, 1280, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const toolbar = await page.locator('.game-rules-actions').evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const first = element.querySelector('button').getBoundingClientRect();
        const meta = document.querySelector('.public-detail-meta').getBoundingClientRect();
        const deletion = document.querySelector('[data-delete-game]').getBoundingClientRect();
        return { leftAligned: Math.abs(first.left - bounds.left) < 1, beforeRules: bounds.bottom <= meta.top, compact: first.width < bounds.width * .7 && first.height < 48, deletionBelow: deletion.top > meta.bottom };
      });
      assert.deepEqual(toolbar, { leftAligned: true, beforeRules: true, compact: true, deletionBelow: true });
      if (width === 1280) {
        await page.screenshot({ path: path.join(output, 'owner-actions-desktop-dark.png'), fullPage: true });
        await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
        assert.equal(await page.locator('[data-open-invite]').evaluate((element) => getComputedStyle(element).backgroundColor === 'rgb(255, 255, 255)'), false);
        await page.screenshot({ path: path.join(output, 'owner-actions-desktop-light.png'), fullPage: true });
        await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(createRequests.length, 1);
    assert.equal(createRequests[0].maxParticipants, 24);
    assert.equal(createRequests[0].scheduledAt, new Date(`${localSchedule}:00+09:00`).toISOString());
    assert.equal('registrations' in createRequests[0], false);
    assert.equal('preliminaryMatches' in createRequests[0], false);
    // Review, edit and save before opening the invitation. Shares use the saved game.
    await page.locator('[data-edit-game]').click();
    await page.locator('#editGameTitle').fill('확인 후 수정한 게임');
    await page.locator('form[data-form="game-edit"] [type="submit"]').click();
    await page.locator('.public-game-detail').waitFor();
    await page.getByRole('heading', { name: '확인 후 수정한 게임', exact: true }).waitFor();
    await page.locator('[data-open-invite]').click();
    await page.locator('.game-invitation').waitFor();
    await page.locator('[data-invite-copy="link"]').click();
    const invite = await page.locator('#gameInviteLink').inputValue();
    assert.equal(await page.evaluate(() => window.copiedInvitations.at(-1)), invite);
    await page.getByText('단체방 초대 문구', { exact: true }).click();
    await page.locator('[data-invite-copy="text"]').click();
    assert.match(await page.evaluate(() => window.copiedInvitations.at(-1)), /확인 후 수정한 게임.*\n일시:.*\n장소:/);
    await page.locator('[data-invite-share]').click();
    // Exercise native sharing without launching an OS dialog or sending messages.
    await page.evaluate(() => {
      window.shareCalls = 0;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      navigator.share = async () => { window.shareCalls++; };
    });
    await page.locator('[data-invite-share]').click();
    await page.getByText('기기의 공유 창 처리가 완료되었습니다. 선택한 앱에서 전송 여부를 확인해 주세요.', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-invite-share]').isEnabled(), true);
    await page.evaluate(() => { navigator.share = async () => { throw new DOMException('cancelled', 'AbortError'); }; });
    await page.locator('[data-invite-share]').click();
    await page.getByText(/공유를 취소했습니다/).waitFor();
    await page.evaluate(() => { navigator.share = async () => { throw new Error('host failure'); }; });
    await page.locator('[data-invite-share]').click();
    await page.getByText(/공유 창을 열 수 없습니다/).waitFor();
    await page.evaluate(() => {
      window.shareCalls = 0;
      navigator.share = () => { window.shareCalls++; return new Promise((resolve, reject) => { window.rejectPendingShare = reject; }); };
    });
    await page.locator('[data-invite-share]').evaluate((button) => { button.click(); button.click(); });
    assert.equal(await page.locator('[data-invite-share]').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.shareCalls), 1);
    await page.getByText(/공유 창의 응답이 지연되고 있습니다/).waitFor({ timeout: 12000 });
    assert.equal(await page.locator('[data-invite-share]').isEnabled(), true);
    await page.evaluate(() => window.rejectPendingShare(new Error('late host error')));
    await page.locator('[data-invite-copy="link"]').click();
    assert.equal(await page.evaluate(() => window.copiedInvitations.at(-1)), invite);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
      navigator.share = () => { throw new Error('unsupported share must not be called'); };
    });
    await page.locator('[data-invite-share]').click();
    await page.getByText('초대 문구를 복사했습니다. 단체방에 붙여넣어 주세요.', { exact: true }).waitFor();
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
    await page.locator('[data-invite-copy="link"]').click();
    await page.getByText(/자동 복사를 사용할 수 없습니다/).waitFor();
    await page.locator('[data-invite-qr]').click();
    await page.locator('.invite-qr svg').waitFor();
    await page.getByRole('heading', { name: '현장에서 QR로 초대하기' }).waitFor();
    assert.match(await page.locator('.invite-qr-help').textContent(), /다른 스마트폰의 카메라/);
    assert.match(await page.locator('.invite-qr-help').textContent(), /같은 휴대폰/);
    await page.locator('.invite-qr').screenshot({ path: path.join(output, 'game-invite-qr.png') });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'game-invite-mobile.png'), fullPage: true });
    await page.locator('[data-invite-close]').click();
    await page.locator('.public-detail-meta').waitFor();
    assert.equal(await page.locator('.game-invitation').count(), 0);
    await page.locator('[data-detail-tab="progress"]').click();
    assert.equal(await page.locator('[data-open-invite]').count(), 0);
    await page.locator('[data-detail-tab="status"]').click();
    await page.locator('[data-open-invite]').click();
    assert.equal(await page.locator('#gameInviteLink').inputValue(), invite);
    console.log('PASS: creation opens rules; review/edit/save before inviting; duplicate-submit guard, link/text copy, QR, responsive layout');

    const guest = await bindContext(browser, false);
    await guest.page.goto(invite);
    await guest.page.getByRole('heading', { name: '확인 후 수정한 게임', exact: true }).waitFor();
    assert.equal(await guest.page.locator('[data-edit-game]').count(), 0);
    assert.equal(await guest.page.locator('.game-rules-actions').count(), 0);
    assert.equal(await guest.page.locator('[data-open-operations]').count(), 0);
    await guest.page.reload();
    await guest.page.locator('[data-game-apply]').click();
    await guest.page.locator('[data-participation-login]').click();
    assert.equal(new URL(guest.page.url()).searchParams.get('join'), '1');
    await guest.page.reload();
    await guest.page.locator('form[data-form="login"]').waitFor();
    await guest.page.locator('form[data-form="login"] [name="memberId"]').fill('fixture');
    await guest.page.locator('form[data-form="login"] [name="password"]').fill('fixture-password');
    await guest.page.locator('form[data-form="login"] [type="submit"]').click();
    await guest.page.locator('form[data-form="game-apply"]').waitFor();
    assert.equal(new URL(guest.page.url()).searchParams.get('game'), new URL(invite).searchParams.get('game'));
    console.log('PASS: independent guest link, reload, login destination survives reload, application form resumes');

    await page.goto('http://localhost:4177/?game=source');
    await page.locator('[data-clone-game="source"]').click();
    assert.equal(await page.locator('#gameScheduledAt').inputValue(), '');
    assert.equal(await page.locator('#gameSeriesId').inputValue(), '');
    assert.equal(await page.locator('[name="reuseRoster"]').isChecked(), false);
    await page.locator('[data-create-day="1"]').click();
    await page.locator('.quick-create-submit').click();
    await page.locator('.game-creation-notice').waitFor();
    assert.equal(bulkRequests, 0);
    assert.equal(games.at(-1).registrations.length, 0);
    assert.equal('preliminaryMatches' in games.at(-1), false);
    console.log('PASS: clone copies settings only, not old date, league, participants or results');

    await page.goto('http://localhost:4177/?game=source');
    await page.locator('[data-next-round="source"]').click();
    assert.equal(await page.locator('#gameSeriesId').inputValue(), 'series');
    await page.locator('[data-create-day="1"]').click();
    await page.locator('[name="reuseRoster"]').check();
    await page.locator('.quick-create-submit').click();
    await page.locator('.game-creation-notice').waitFor();
    assert.match(await page.locator('.game-creation-notice').textContent(), /이전 명단 1명 등록/);
    assert.equal(bulkRequests, 1);
    assert.equal(games.at(-1).registrations.length, 1);
    assert.equal(games.at(-1).seriesRound, 2);
    await page.locator('[data-open-invite]').click();
    await page.locator('[data-invite-open]').click();
    await page.getByText('테스트선수', { exact: true }).first().waitFor();
    assert.equal(await page.locator('.game-invitation').count(), 0);
    console.log('PASS: next-round series mapping and explicit roster reuse');

    await page.goto('http://localhost:4177/?game=source');
    await page.locator('[data-clone-game="source"]').click();
    await page.locator('[data-create-day="1"]').click();
    const expectedTitle = await page.locator('#gameTitle').inputValue();
    const count = games.length;
    failCreation = true;
    await page.locator('.quick-create-submit').click();
    await page.getByText(/테스트 저장 실패/).waitFor();
    assert.equal(await page.locator('#gameTitle').inputValue(), expectedTitle);
    assert.equal(await page.locator('.quick-create-submit').isEnabled(), true);
    assert.equal(games.length, count);
    assert.equal(await page.locator('.game-invitation').count(), 0);
    failCreation = false;
    await page.goto('http://localhost:4177/?game=source');
    await page.locator('[data-open-invite]').click();
    await page.locator('[data-invite-prepare]').click();
    await page.locator('[data-group-count]').waitFor();
    await page.goto('http://localhost:4177/?game=source');
    await page.locator('[data-clone-game="source"]').click();
    await page.locator('#gameVenueName').fill('새 장소');
    await page.locator('#gameVenueName').press('Tab');
    assert.equal(await page.locator('#gameVenueAddress').inputValue(), '');
    assert.equal(await page.locator('.create-location-details').getAttribute('open'), '');
    await page.locator('#gameVenueAddress').fill('직접 입력한 주소');
    await page.locator('[data-create-day="1"]').click();
    await page.locator('input[name="formats"][value="singles"]').uncheck();
    await page.locator('.quick-create-submit').click();
    await page.getByText(/장소·주소·날짜·시간·게임명·종목·모집인원을 확인/).waitFor();
    assert.equal(await page.locator('#gameVenueAddress').inputValue(), '직접 입력한 주소');
    await guest.page.goto('http://localhost:4177/?game=missing');
    await guest.page.getByText(/초대받은 경기를 찾을 수 없습니다/).waitFor();
    assert.deepEqual(owner.errors, []);
    assert.deepEqual(guest.errors, []);
    console.log('PASS: failed save preserves inputs without fake invitation; invalid link feedback; no JS errors');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
