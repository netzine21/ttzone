// Compare the actual desktop layouts with the previous CSS, using synthetic API data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.TTGMS_UI_OUTPUT || os.tmpdir();
const oldCss = execFileSync('git', ['show', 'HEAD:public/styles.css'], { cwd: root, encoding: 'utf8' });
const newCss = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const series = ['동인천 탁구 정기 수요리그', '라니핑퐁 목요 정기리그', '오늘도핑퐁 월례정기모임'].map((name, index) => ({ id: `series-${index}`, name, ownerId: 'owner', status: 'active', scheduleLabel: index === 1 ? '매주 목요일' : '매월 토요일', defaultFormats: ['singles'], gameCount: 2 }));
const titles = ['티티그라운드 Open 기념 탁구대회', '26년 TTK70-솔개 10월 번개모임(테스트)', '26년 TTK70-솔개 10월 정기모임', '74년 호랑이 탁구동호인 인천지역 번개모임(테스트)', '26년 10월 오늘도 핑퐁 정기월례 모임', '라니핑퐁 목요 정기리그 새로운 경기'];
const games = titles.map((title, index) => ({ id: `game-${index}`, title, seriesId: `series-${index % 3}`, operatorId: 'owner', operatorNickname: '운영자', formats: ['singles'], scheduledAt: '2026-10-22T10:00:00Z', venueName: '테스트 탁구장', venueAddress: '테스트 주소', maxParticipants: 24, registrations: [], registrationClosed: {}, formatStatuses: index % 3 === 1 ? { singles: 'completed' } : {} }));

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.TTGMS_BROWSER_CHANNEL ? { channel: process.env.TTGMS_BROWSER_CHANNEL } : {}) });
  try {
    let baseline = true;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => sessionStorage.clear());
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: url.pathname === '/api/auth/me' ? { user: { id: 'owner', nickname: '운영자', gender: 'male', rank: '7부' } } : url.pathname === '/api/games' ? { games } : url.pathname === '/api/league-series' ? { series } : { venues: [] } });
      if (url.pathname === '/public/styles.css') return route.fulfill({ body: baseline ? oldCss : newCss, contentType: 'text/css' });
      const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
      return route.fulfill({ body: fs.readFileSync(file), contentType: ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const home = async () => { await page.goto('http://localhost:4177/'); await page.locator('.series-directory-card').first().waitFor(); };
    const fonts = () => page.evaluate(() => Object.fromEntries([
      ['root', 'html'], ['body', 'body'], ['title', '.game-title-link'], ['date', '.game-list-item__date'], ['status', '.game-format-status'], ['series', '.series-directory-card__body strong'], ['menu', '[data-show-league-series]'],
    ].map(([key, selector]) => [key, parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)])));
    await home();
    const before = await fonts();
    await page.screenshot({ path: path.join(output, 'desktop-readability-before.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileBefore = await fonts();
    baseline = false;
    await page.reload();
    await page.locator('.series-directory-card').first().waitFor();
    assert.deepEqual(await fonts(), mobileBefore);
    for (const width of [821, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      const after = await fonts();
      assert.equal(after.root, 20);
      assert.ok(after.title >= 22 && after.date >= 16 && after.status >= 16 && after.menu >= 18);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('.game-title-link').evaluateAll((elements) => elements.some((element) => element.scrollHeight > element.clientHeight + 1)), false);
      if (width === 1440) {
        await page.screenshot({ path: path.join(output, 'desktop-readability-after.png'), fullPage: true });
        console.log(JSON.stringify({ before, after }));
      }
      await page.locator('[data-show-league-series]').click();
      await page.locator('#leagueSeriesLogo').waitFor();
      const sizes = await page.evaluate(() => ['.field label', '.field input', '.field-hint'].map((selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)));
      assert.ok(sizes[0] >= 18 && sizes[1] >= 18 && sizes[2] >= 16);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 1440) await page.screenshot({ path: path.join(output, 'desktop-readability-league-form.png'), fullPage: true });
      await home();
    }
    await page.emulateMedia({ media: 'print' });
    assert.equal((await fonts()).root, 16);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop readability at 821–1920px, long titles/form layout, mobile font sizes unchanged, print scale unchanged');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
