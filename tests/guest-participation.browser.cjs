// Real frontend + real API and password hashing, backed by an isolated SQL adapter.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require('playwright');
const { createHarness, GAME_ID, MEMBER_ID } = require('./helpers/participant-harness.cjs');
const root = path.resolve(__dirname, '..');
const output = process.env.TTGMS_UI_OUTPUT || os.tmpdir();

(async () => {
  const app = createHarness();
  const requests = [];
  let failSave = false;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    requests.push({ url: req.url, method: req.method });
    try {
      if (url.pathname === '/api/games') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ games: [app.publicGame()] })); }
      if (url.pathname === '/api/venues') return res.end(JSON.stringify({ venues: [] }));
      if (url.pathname === '/api/league-series') return res.end(JSON.stringify({ series: [] }));
      if (failSave && url.pathname.endsWith('/guest-registrations') && req.method === 'POST') { res.writeHead(503); return res.end(JSON.stringify({ error: '테스트 저장 실패' })); }
      if (url.pathname.startsWith('/api/')) return await app.handleApi(req, res, url.pathname);
      const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(500); res.end('{}'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, ...(process.env.TTGMS_BROWSER_CHANNEL ? { channel: process.env.TTGMS_BROWSER_CHANNEL } : {}) });
  const errors = [];
  async function pageFor(context) {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    return page;
  }
  try {
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await pageFor(guest);
    await page.goto(`${base}?game=${GAME_ID}`);
    await page.locator('[data-game-apply]').click();
    await page.locator('[data-participation-login]').waitFor();
    assert.equal(await page.locator('form[data-form="login"]').count(), 0);
    await page.locator('[data-guest-start]').click();
    const form = page.locator('[data-form="game-apply"][data-format="singles"]');
    await form.locator('[name="nickname"]').fill('비회원 검증 선수');
    await form.locator('[name="rank"]').fill('7부');
    await form.locator('[type="submit"]').click();
    await form.getByText(/성별.*입력해 주세요/).waitFor();
    assert.equal(await form.locator('[name="nickname"]').inputValue(), '비회원 검증 선수');
    assert.equal(app.db.registrations.length, 0);
    await form.locator('[name="gender"]').selectOption('male');
    await page.screenshot({ path: path.join(output, 'guest-participation-form-mobile.png'), fullPage: true });
    failSave = true;
    await form.locator('[type="submit"]').click();
    await form.getByText(/테스트 저장 실패.*입력한 내용은 유지/).waitFor();
    assert.equal(await page.locator('.guest-completion').count(), 0);
    assert.equal(await form.locator('[name="nickname"]').inputValue(), '비회원 검증 선수');
    failSave = false;
    await form.evaluate((element) => { element.requestSubmit(); element.requestSubmit(); });
    await page.getByRole('heading', { name: '참가신청이 완료되었습니다!' }).waitFor();
    assert.equal(app.db.registrations.length, 1);
    assert.equal(app.db.users.length, 1);
    const privateLink = await page.locator('#guestManagementLink').inputValue();
    assert.match(new URL(privateLink).hash, /^#entry=[A-Za-z0-9_-]{43}$/);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'guest-participation-complete-mobile.png'), fullPage: true });
    const strangerContext = await browser.newContext();
    const stranger = await pageFor(strangerContext);
    await stranger.goto(`${base}?game=${GAME_ID}&apply=1`);
    assert.equal(await stranger.locator('#guestManagementLink').count(), 0);
    assert.equal(await stranger.locator('[data-cancel-participation]').count(), 0);

    // The private fragment is consumed before requests and restores ownership on a new device.
    const restoredContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const restored = await pageFor(restoredContext);
    await restored.goto(privateLink);
    await restored.locator('#guestManagementLink').waitFor();
    assert.equal(new URL(restored.url()).hash, '');
    assert.ok(requests.every((request) => !request.url.includes('entry=')));
    const restoredForm = restored.locator('[data-form="game-apply"][data-format="singles"]');
    await restoredForm.locator('[name="rank"]').fill('6부');
    await restoredForm.locator('[type="submit"]').click();
    await restored.getByText('참가신청 내용이 저장되었습니다.', { exact: true }).waitFor();
    assert.equal(app.db.registrations[0].rank, '6부');
    await restored.reload();
    await restored.locator('#guestManagementLink').waitFor();
    assert.equal(await restoredForm.locator('[name="rank"]').inputValue(), '6부');
    restored.on('dialog', (dialog) => dialog.accept());
    await restoredForm.locator('[data-cancel-participation]').click();
    await restored.getByText('참가신청이 취소되었습니다.', { exact: true }).waitFor();
    assert.equal(app.db.registrations.length, 0);
    await restoredForm.locator('[name="nickname"]').fill('비회원 검증 선수');
    await restoredForm.locator('[name="gender"]').selectOption('male');
    await restoredForm.locator('[name="rank"]').fill('6부');
    await restoredForm.locator('[type="submit"]').click();
    await restored.locator('[data-guest-signup]').waitFor();

    // Enrollment reuses player information and links the existing row atomically.
    await restored.locator('[data-guest-signup]').click();
    await restored.reload();
    await restored.locator('#signupNickname').waitFor();
    assert.equal(await restored.locator('#signupNickname').inputValue(), '비회원 검증 선수');
    assert.equal(await restored.locator('#signupRank').inputValue(), '6부');
    assert.equal(await restored.locator('[name="gender"][value="male"]').isChecked(), true);
    await restored.locator('#signupMemberId').fill('guest001');
    await restored.locator('#signupPassword').fill('synthetic-password');
    await restored.locator('#signupPhone').fill('01000000000');
    await restored.locator('#signupRegionSido').selectOption('경기도');
    await restored.locator('#signupRegionSigungu').selectOption('수원시');
    await restored.locator('[data-form="signup"] [type="submit"]').click();
    await restored.getByText('기존 참가신청도 새 계정에 연결되었습니다.', { exact: true }).waitFor();
    assert.equal(app.db.registrations.length, 1);
    assert.equal(app.db.users.length, 2);
    assert.equal(app.db.registrations[0].user_id, app.db.users[1].id);
    await restored.locator('[data-home-after-signup]').click();
    await restored.locator('[data-form="login"] [name="memberId"]').fill('guest001');
    await restored.locator('[data-form="login"] [name="password"]').fill('synthetic-password');
    await restored.locator('[data-form="login"] [type="submit"]').click();
    await restored.locator('.participation-saved').waitFor();
    assert.equal(await restored.locator('.guest-completion').count(), 0);
    assert.equal(app.db.registrations.length, 1);
    await restored.screenshot({ path: path.join(output, 'member-linked-participation-mobile.png'), fullPage: true });

    // A member can submit using the saved profile without opening or filling fields.
    const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await memberContext.addCookies([{ url: base, name: 'ttgms_session', value: app.sessionFor(MEMBER_ID) }]);
    const memberPage = await pageFor(memberContext);
    await memberPage.goto(`${base}?game=${GAME_ID}&apply=1`);
    const memberForm = memberPage.locator('[data-form="game-apply"][data-format="singles"]');
    assert.equal(await memberForm.locator('details').getAttribute('open'), null);
    await memberForm.getByRole('button', { name: '이 정보로 참가신청', exact: true }).click();
    await memberPage.locator('.participation-saved').waitFor();
    assert.equal(app.db.registrations.length, 2);
    assert.equal(app.db.registrations[1].user_id, MEMBER_ID);
    assert.equal(app.db.registrations[1].nickname, '기존 회원');
    // An existing account can also connect a guest application after logging in.
    await stranger.locator('[data-guest-start]').click();
    const doubles = stranger.locator('[data-form="game-apply"][data-format="doubles"]');
    await doubles.locator('[name="nickname"]').fill('기존 계정 연결 선수');
    await doubles.locator('[name="gender"]').selectOption('male');
    await doubles.locator('[name="rank"]').fill('6부');
    await doubles.locator('[name="teamName"]').fill('검증 복식팀');
    await doubles.locator('[type="submit"]').click();
    await stranger.locator('[data-guest-signup]').waitFor();
    await stranger.locator('[data-participation-login]').click();
    await stranger.locator('[data-form="login"] [name="memberId"]').fill('guest001');
    await stranger.locator('[data-form="login"] [name="password"]').fill('synthetic-password');
    await stranger.locator('[data-form="login"] [type="submit"]').click();
    await stranger.locator('[data-form="game-apply"][data-format="doubles"] .participation-saved').waitFor();
    assert.equal(app.db.registrations.length, 3);
    assert.equal(app.db.registrations[2].user_id, app.db.users[1].id);
    assert.equal(app.db.registrations[2].team_name, '검증 복식팀');
    assert.deepEqual(errors, []);
    console.log('PASS: guest form, required data/errors preserve inputs, real API save, duplicate submit, private cross-device management, edit/cancel, enrollment/link/login, member one-click and responsive layout');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
