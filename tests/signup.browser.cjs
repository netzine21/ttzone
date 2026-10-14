// Exercise the real signup UI against synthetic API responses; no production accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.TTGMS_BROWSER_CHANNEL ? { channel: process.env.TTGMS_BROWSER_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let responseMode = 'success';
    let signupRequests = 0;
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/auth/signup') {
          signupRequests++;
          await new Promise((resolve) => setTimeout(resolve, 150));
          if (responseMode === 'network') return route.abort('failed');
          if (responseMode === 'duplicate') return route.fulfill({ status: 409, json: { error: '중복 ID' } });
          if (responseMode === 'server') return route.fulfill({ status: 500, json: { error: '회원가입 처리 중 오류가 발생했습니다.' } });
          if (responseMode === 'invalid') return route.fulfill({ status: 200, body: '<html>unavailable</html>', contentType: 'text/html' });
          return route.fulfill({ status: 201, json: { user: { id: 'synthetic-member' } } });
        }
        return route.fulfill({ json: { user: null, games: [], venues: [], series: [] } });
      }
      const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://localhost:4177/');
    await page.locator('.mobile-menu-toggle').click();
    await page.locator('[data-open-auth="signup"]').click();
    const form = page.locator('[data-form="signup"]');
    const feedback = form.locator('[data-signup-feedback]');
    const submit = () => form.evaluate((element) => element.requestSubmit());
    const value = (name) => form.locator(`[name="${name}"]`).inputValue();
    await page.locator('#signupNickname').fill('가입 검증');
    await page.locator('#signupMemberId').fill('test000');
    await page.locator('#signupPassword').fill('synthetic-password');
    await form.locator('[name="gender"][value="male"]').check();
    await page.locator('#signupRank').fill('7');
    await page.locator('#signupRegionSido').selectOption('경기도');
    await page.locator('#signupRegionSigungu').selectOption('수원시');

    // Reported regression: missing / whitespace phone must preserve every other field.
    for (const phone of ['', '   ']) {
      await page.locator('#signupPhone').fill(phone);
      await submit();
      await feedback.waitFor({ state: 'visible' });
      assert.match(await feedback.textContent(), /휴대폰번호 항목을 입력해 주세요/);
      assert.equal(await value('memberId'), 'test000');
      assert.equal(await value('password'), 'synthetic-password');
      assert.equal(await value('regionSigungu'), '수원시');
      assert.equal(await page.locator('#signupPhone').getAttribute('aria-invalid'), 'true');
      assert.equal(signupRequests, 0);
    }
    await page.waitForTimeout(3500);
    assert.equal(await feedback.isVisible(), true);
    assert.equal(await value('nickname'), '가입 검증');

    // Each required field has a specific persistent error, and no API call occurs.
    await page.locator('#signupPhone').fill('01000000000');
    for (const [name, label] of [['nickname', '이름(닉네임)'], ['memberId', 'ID'], ['password', '비밀번호'], ['rank', '통합부수'], ['regionSigungu', '활동지역 시·군·구']]) {
      const input = form.locator(`[name="${name}"]`);
      const original = await input.inputValue();
      if (name === 'regionSigungu') await input.selectOption('');
      else await input.fill('');
      await submit();
      assert.ok((await feedback.textContent()).includes(label));
      assert.equal(signupRequests, 0);
      if (name === 'regionSigungu') await input.selectOption(original);
      else await input.fill(original);
    }
    await form.locator('[name="gender"]').evaluateAll((inputs) => inputs.forEach((input) => { input.checked = false; }));
    await submit();
    assert.match(await feedback.textContent(), /성별/);
    await form.locator('[name="gender"][value="male"]').check();
    await page.locator('#signupRegionSido').selectOption('');
    await submit();
    assert.match(await feedback.textContent(), /활동지역 시·도/);
    await page.locator('#signupRegionSido').selectOption('경기도');
    await page.locator('#signupRegionSigungu').selectOption('수원시');

    for (const [mode, expected] of [['duplicate', /이미 사용 중인 ID/], ['server', /회원가입 처리 중 오류/], ['network', /서버에 연결하지 못했습니다/], ['invalid', /가입 완료를 확인하지 못했습니다/]]) {
      responseMode = mode;
      await submit();
      await feedback.waitFor({ state: 'visible' });
      assert.match(await feedback.textContent(), expected);
      assert.equal(await value('memberId'), 'test000');
      assert.equal(await value('phone'), '010-0000-0000');
      assert.equal(await form.locator('[type="submit"]').isEnabled(), true);
      assert.equal(await page.locator('.signup-success').count(), 0);
    }
    responseMode = 'success';
    const before = signupRequests;
    await form.evaluate((element) => { element.requestSubmit(); element.requestSubmit(); });
    await page.locator('.signup-success').waitFor();
    assert.equal(signupRequests, before + 1);
    assert.deepEqual(errors, []);
    console.log('PASS: required fields, blank/whitespace phone, persistent errors, preserved inputs, API failures, verified response and duplicate-submit prevention');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
