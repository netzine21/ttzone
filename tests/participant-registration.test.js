const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createHarness, GAME_ID, MEMBER_ID } = require('./helpers/participant-harness.cjs');
const path = `/api/games/${GAME_ID}/guest-registrations`;
const token = () => crypto.randomBytes(32).toString('base64url');
const participant = { format: 'singles', nickname: '비회원 선수', gender: 'male', rank: '7부' };
const signup = { nickname: '가입 선수', memberId: 'guestmember', password: 'synthetic-password', phone: '01000000000', gender: 'male', rank: '7부', region: '경기도 수원시', regionSido: '경기도', regionSigungu: '수원시' };

test('guest saves without account, retry is idempotent, token/hash never appears in response', async () => {
  const app = createHarness(); const key = token();
  for (let i = 0; i < 2; i++) {
    const result = await app.request('POST', path, participant, { token: key });
    assert.equal(result.status, 201);
    assert.equal(result.body.registration.nickname, participant.nickname);
    assert.ok(!JSON.stringify(result.body).includes(key));
    assert.ok(!JSON.stringify(result.body).includes('guest_token_hash'));
  }
  assert.equal(app.db.registrations.length, 1);
  assert.equal(app.db.registrations[0].user_id, null);
  assert.notEqual(app.db.registrations[0].guest_token_hash, key);
  assert.equal(app.db.users.length, 1);
});

test('only private proof can view, modify or cancel the owned entry', async () => {
  const app = createHarness(); const key = token();
  await app.request('POST', path, participant, { token: key });
  assert.equal((await app.request('GET', path)).status, 403);
  assert.equal((await app.request('GET', path, undefined, { token: token() })).body.registrations.length, 0);
  assert.equal((await app.request('PATCH', path, { ...participant, nickname: '공격자' }, { token: token() })).status, 404);
  assert.equal((await app.request('DELETE', path, { format: 'singles' }, { token: token() })).status, 404);
  assert.equal((await app.request('PATCH', path, { ...participant, nickname: '수정한 선수' }, { token: key })).status, 200);
  assert.equal((await app.request('GET', path, undefined, { token: key })).body.registrations[0].nickname, '수정한 선수');
  assert.equal((await app.request('DELETE', path, { format: 'singles' }, { token: key })).status, 200);
  assert.equal(app.db.registrations.length, 0);
});

test('server enforces required data, valid formats, missing/deleted games and registration closure', async () => {
  const app = createHarness(); const key = token();
  for (const body of [{ ...participant, gender: '' }, { ...participant, nickname: ' ' }, { ...participant, rank: '' }, { ...participant, format: 'team' }, { ...participant, format: 'doubles' }]) {
    assert.equal((await app.request('POST', path, body, { token: key })).status, 400);
  }
  app.db.game.registration_closed.singles = true;
  assert.equal((await app.request('POST', path, participant, { token: key })).status, 400);
  app.db.game.registration_closed = {};
  app.db.game.qualifying_groups.singles = { groups: [{}] };
  assert.equal((await app.request('POST', path, participant, { token: key })).status, 400);
  app.db.game.deleted_at = '2026-10-14';
  assert.equal((await app.request('POST', path, participant, { token: key })).status, 404);
  assert.equal((await app.request('POST', path.replace(GAME_ID, crypto.randomUUID()), participant, { token: key })).status, 404);
  assert.equal(app.db.registrations.length, 0);
});

test('simultaneous member and guest requests cannot exceed the last place; full entry can still be edited', async () => {
  const app = createHarness({ capacity: 1 }); const key = token();
  const session = app.sessionFor();
  const result = await Promise.all([
    app.request('POST', path, participant, { token: key }),
    app.request('POST', `/api/games/${GAME_ID}/registrations`, participant, { session }),
  ]);
  assert.deepEqual(result.map((row) => row.status).sort(), [201, 409]);
  assert.equal(app.db.registrations.length, 1);
  const guestWon = app.db.registrations[0].user_id === null;
  const update = await app.request('POST', guestWon ? path : `/api/games/${GAME_ID}/registrations`, { ...participant, rank: '6부' }, guestWon ? { token: key } : { session });
  assert.equal(update.status, 201);
  assert.equal(app.db.registrations[0].rank, '6부');
});

test('authenticated member uses saved profile and cancellation is restricted to that member', async () => {
  const app = createHarness(); const session = app.sessionFor();
  const result = await app.request('POST', `/api/games/${GAME_ID}/registrations`, { format: 'singles' }, { session });
  assert.equal(result.status, 201);
  assert.equal(result.body.registration.userId, MEMBER_ID);
  assert.equal(result.body.registration.gender, 'female');
  assert.equal((await app.request('DELETE', `/api/games/${GAME_ID}/registrations/self`, { format: 'singles' })).status, 401);
  assert.equal((await app.request('DELETE', `/api/games/${GAME_ID}/registrations/self`, { format: 'singles' }, { session })).status, 200);
});

test('signup and linking are atomic; possession of a matching name is insufficient', async () => {
  const app = createHarness(); const key = token();
  await app.request('POST', path, participant, { token: key });
  const invalid = await app.request('POST', '/api/auth/signup', { ...signup, guestClaim: { gameId: GAME_ID, token: token() } });
  assert.equal(invalid.status, 404);
  assert.equal(app.db.users.length, 1);
  assert.equal(app.db.registrations[0].user_id, null);
  const saved = await app.request('POST', '/api/auth/signup', { ...signup, guestClaim: { gameId: GAME_ID, token: key } });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.guestLinked, true);
  assert.equal(app.db.registrations[0].user_id, saved.body.user.id);
  assert.equal(app.db.registrations.length, 1);
  assert.equal((await app.request('PATCH', path, participant, { token: key })).status, 409);
  const login = await app.request('POST', '/api/auth/login', { memberId: signup.memberId, password: signup.password });
  assert.equal(login.status, 200);
  assert.ok(login.headers['Set-Cookie'].some((cookie) => cookie.includes('HttpOnly') && cookie.includes('Secure')));
});

test('existing member may claim with proof; duplicate member entries cause an atomic conflict', async () => {
  const app = createHarness(); const key = token(); const session = app.sessionFor();
  await app.request('POST', path, participant, { token: key });
  assert.equal((await app.request('POST', `${path}/claim`, {}, { token: key })).status, 401);
  await app.request('POST', `/api/games/${GAME_ID}/registrations`, { format: 'singles' }, { session });
  assert.equal((await app.request('POST', `${path}/claim`, {}, { token: key, session })).status, 409);
  assert.equal(app.db.registrations[0].user_id, null);
  await app.request('DELETE', `/api/games/${GAME_ID}/registrations/self`, { format: 'singles' }, { session });
  assert.equal((await app.request('POST', `${path}/claim`, {}, { token: key, session })).status, 200);
  assert.equal(app.db.registrations[0].user_id, MEMBER_ID);
});

test('closed registrations remain viewable and linkable but cannot be changed or cancelled', async () => {
  const app = createHarness(); const key = token(); const session = app.sessionFor();
  await app.request('POST', path, participant, { token: key });
  app.db.game.registration_closed.singles = true;
  assert.equal((await app.request('GET', path, undefined, { token: key })).body.registrations.length, 1);
  assert.equal((await app.request('PATCH', path, participant, { token: key })).status, 400);
  assert.equal((await app.request('DELETE', path, { format: 'singles' }, { token: key })).status, 400);
  assert.equal((await app.request('POST', `${path}/claim`, {}, { token: key, session })).status, 200);
  assert.equal(app.db.registrations.length, 1);
});
