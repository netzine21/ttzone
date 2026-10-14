// An isolated SQL adapter exercises the real API/crypto/transaction code without a live DB.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Readable } = require('node:stream');
const { publicRegistration } = require('../../server/participant-registration');
const GAME_ID = '10000000-0000-4000-8000-000000000001';
const MEMBER_ID = '20000000-0000-4000-8000-000000000001';
function createHarness({ capacity = 4, formats = ['singles', 'doubles'] } = {}) {
  const db = {
    game: { id: GAME_ID, title: '비회원 참가 검증 경기', operator_id: 'owner', max_participants: capacity, registration_closed: {}, qualifying_groups: {}, preliminary_matches: {}, tournaments: {}, deleted_at: null },
    formats, registrations: [], users: [{ id: MEMBER_ID, nickname: '기존 회원', member_id: 'member', gender: 'female', rank: '6부', phone: '01000000000' }], sessions: [],
  };
  let queue = Promise.resolve();
  const logs = [];
  async function query(sql, values = []) {
    const text = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (/^(alter|create)/.test(text)) return { rows: [] };
    if (text.startsWith('insert into public.visitor_sessions')) return { rows: [] };
    if (text.startsWith('select user_id from public.sessions')) return { rows: db.sessions.filter((row) => row.token_hash === values[0]) };
    if (text.startsWith('select u.* from public.sessions')) {
      const session = db.sessions.find((row) => row.token_hash === values[0]);
      return { rows: db.users.filter((row) => row.id === session?.user_id) };
    }
    if (text.startsWith('insert into public.sessions')) { db.sessions.push({ user_id: values[0], token_hash: values[1] }); return { rows: [] }; }
    if (text.startsWith('select * from public.users')) return { rows: db.users.filter((row) => row.member_id.toLowerCase() === values[0]) };
    if (text.startsWith('insert into public.users')) {
      if (db.users.some((row) => row.member_id === values[1])) throw Object.assign(new Error('duplicate user'), { code: '23505' });
      const row = { id: crypto.randomUUID(), nickname: values[0], member_id: values[1], password_hash: values[2], gender: values[3], rank: values[4], phone: values[5], region: values[6], region_sido: values[7], region_sigungu: values[8], role: 'user' };
      db.users.push(row); return { rows: [{ ...row }] };
    }
    if (/^select (\*|id) from public.games/.test(text)) return { rows: db.game.id === values[0] && !(text.includes('deleted_at is null') && db.game.deleted_at) ? [{ ...db.game }] : [] };
    if (text.startsWith('select format from public.game_formats')) return { rows: values[0] === GAME_ID && db.formats.includes(values[1]) ? [{ format: values[1] }] : [] };
    if (text.startsWith('select * from public.registrations')) return { rows: db.registrations.filter((row) => row.game_id === values[0] && (text.includes('guest_token_hash') ? row.guest_token_hash === values[1] : row.user_id === values[1])).map((row) => ({ ...row })) };
    if (text.startsWith('select id from public.registrations')) return { rows: db.registrations.filter((row) => row.game_id === values[0] && row.format === values[1] && row.user_id === values[2]).map((row) => ({ id: row.id })) };
    if (text.startsWith('select count(*)')) return { rows: [{ count: db.registrations.filter((row) => row.game_id === values[0] && row.format === values[1]).length }] };
    if (text.startsWith('insert into public.registrations')) {
      const row = { id: crypto.randomUUID(), nickname: values[0], gender: values[1], rank: values[2], team_name: values[3], game_id: values[4], format: values[5], user_id: values[6], member_id: values[7], guest_token_hash: values[8], applied_at: new Date().toISOString() };
      db.registrations.push(row); return { rows: [{ ...row }] };
    }
    if (text.startsWith('update public.registrations set nickname')) {
      const row = db.registrations.find((item) => item.id === values[4]);
      Object.assign(row, { nickname: values[0], gender: values[1], rank: values[2], team_name: values[3] });
      return { rows: [{ ...row }] };
    }
    if (text.startsWith('update public.registrations set user_id')) {
      const rows = db.registrations.filter((row) => row.game_id === values[0] && row.guest_token_hash === values[1]);
      rows.forEach((row) => Object.assign(row, { user_id: values[2], member_id: values[3] }));
      return { rows: rows.map((row) => ({ ...row })) };
    }
    if (text.startsWith('delete from public.registrations where id')) { db.registrations = db.registrations.filter((row) => row.id !== values[0]); return { rows: [] }; }
    throw new Error(`Unhandled test SQL: ${text.slice(0, 100)}`);
  }
  const pool = {
    query,
    async connect() {
      let unlock, snapshot;
      return {
        async query(sql, values) {
          if (sql === 'begin') {
            const previous = queue;
            queue = new Promise((resolve) => { unlock = resolve; });
            await previous;
            snapshot = structuredClone(db);
            return { rows: [] };
          }
          if (sql === 'rollback') { Object.assign(db, snapshot); return { rows: [] }; }
          if (sql === 'commit') return { rows: [] };
          return query(sql, values);
        },
        release() { unlock?.(); },
      };
    },
  };
  const apiPath = path.resolve(__dirname, '../../server/api.js');
  const actualRequire = createRequire(apiPath);
  const moduleValue = { exports: {} };
  const wrapper = vm.runInNewContext(`(function(require, module, exports) { ${fs.readFileSync(apiPath, 'utf8')}\n})`, { Buffer, console: { error: (...args) => logs.push(args) } });
  wrapper((name) => name === './db' ? { getPool: () => pool } : actualRequire(name), moduleValue, moduleValue.exports);
  const { handleApi } = moduleValue.exports;
  async function request(method, url, body, { token, session } = {}) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    req.method = method;
    req.headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(session ? { cookie: `ttgms_session=${session}` } : {}) };
    let status, headers, payload;
    const res = { writeHead: (code, values) => { status = code; headers = values; }, end: (value) => { payload = JSON.parse(value); } };
    await handleApi(req, res, url);
    return { status, headers, body: payload };
  }
  function sessionFor(userId = MEMBER_ID) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.sessions.push({ token_hash: crypto.createHash('sha256').update(token).digest('hex'), user_id: userId });
    return token;
  }
  function publicGame() {
    return { id: GAME_ID, title: db.game.title, operatorId: 'owner', operatorNickname: '운영자', maxParticipants: db.game.max_participants, formats: db.formats, formatModes: { singles: 'leagueOnly' }, venueName: '테스트탁구장', venueAddress: '테스트 주소', scheduledAt: '2026-10-20T10:00:00Z', registrationClosed: db.game.registration_closed, qualifyingGroups: db.game.qualifying_groups, preliminaryMatches: db.game.preliminary_matches, tournaments: db.game.tournaments, registrations: db.registrations.map(publicRegistration) };
  }
  return { db, request, handleApi, sessionFor, publicGame, logs };
}
module.exports = { createHarness, GAME_ID, MEMBER_ID };
