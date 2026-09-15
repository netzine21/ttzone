const crypto = require('crypto');
const { getPool } = require('./db');

const SESSION_COOKIE = 'ttgms_session';
const SESSION_DAYS = 30;

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return [];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter((entry) => entry.length));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [algorithm, salt, expectedHex] = String(storedHash || '').split('$');
    if (algorithm !== 'scrypt' || !salt || !expectedHex) return resolve(false);
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      const actual = Buffer.from(derivedKey.toString('hex'), 'utf8');
      const expected = Buffer.from(expectedHex, 'utf8');
      resolve(actual.length === expected.length && crypto.timingSafeEqual(actual, expected));
    });
  });
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    memberId: row.member_id,
    memberIdKey: String(row.member_id).toLowerCase(),
    phone: row.phone,
    gender: row.gender,
    rank: row.rank,
    region: row.region || '',
    address: row.address || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicGame(row, formats = [], registrations = []) {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    formats,
    format: formats[0] || null,
    scheduledAt: row.scheduled_at,
    maxParticipants: row.max_participants,
    note: row.note || '',
    operatorId: row.operator_id,
    operatorNickname: row.operator_nickname,
    registrations,
    participants: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('요청 형식이 올바르지 않습니다.');
    error.statusCode = 400;
    throw error;
  }
}

async function findSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const result = await getPool().query(
    `select u.*
       from public.sessions s
       join public.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`
    , [hashToken(token)]
  );
  return result.rows[0] || null;
}

function sessionCookie(token, maxAge = null) {
  const age = maxAge === null ? '' : `; Max-Age=${maxAge}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/${age}`;
}

async function createSession(userId, remember = false) {
  const token = crypto.randomBytes(32).toString('base64url');
  const sessionDays = remember ? SESSION_DAYS : 1;
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  await getPool().query(
    'insert into public.sessions (user_id, token_hash, expires_at) values ($1, $2, $3)',
    [userId, hashToken(token), expiresAt]
  );
  return token;
}

function requirePool() {
  const pool = getPool();
  if (!pool) {
    const error = new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
    error.statusCode = 503;
    throw error;
  }
  return pool;
}

async function getGames() {
  const pool = requirePool();
  const games = await pool.query(
    `select g.*, u.nickname as operator_nickname
       from public.games g
       join public.users u on u.id = g.operator_id
      order by g.created_at desc`
  );
  const formats = await pool.query('select game_id, format from public.game_formats');
  const registrations = await pool.query(
    `select id, game_id, format, user_id, nickname, member_id, rank, team_name,
            registered_by, applied_at, updated_at
       from public.registrations
      order by applied_at`
  );
  return games.rows.map((game) => publicGame(
    game,
    formats.rows.filter((item) => item.game_id === game.id).map((item) => item.format),
    registrations.rows.filter((item) => item.game_id === game.id).map((item) => ({
      id: item.id,
      userId: item.user_id,
      nickname: item.nickname,
      memberId: item.member_id || '',
      rank: item.rank,
      teamName: item.team_name || '',
      format: item.format,
      registeredBy: item.registered_by,
      appliedAt: item.applied_at,
      updatedAt: item.updated_at,
    }))
  ));
}

async function handleApi(req, res, requestPath) {
  if (!requestPath.startsWith('/api/')) return false;

  try {
    const pool = requirePool();
    if (requestPath === '/api/auth/me' && req.method === 'GET') {
      return sendJson(res, 200, { user: publicUser(await findSession(req)) });
    }

    if (requestPath === '/api/auth/signup' && req.method === 'POST') {
      const body = await readBody(req);
      const nickname = String(body.nickname || '').trim();
      const memberId = String(body.memberId || '').trim();
      const password = String(body.password || '').trim();
      const phone = String(body.phone || '').trim();
      const gender = String(body.gender || '').trim();
      const rank = String(body.rank || '').trim();
      if (!nickname || !memberId || !password || !phone || !rank || !['male', 'female'].includes(gender)) {
        return sendJson(res, 400, { error: '필수 회원정보를 모두 입력해 주세요.' });
      }
      const passwordHash = await hashPassword(password);
      const result = await pool.query(
        `insert into public.users (nickname, member_id, password_hash, gender, rank, phone, region, address)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [nickname, memberId, passwordHash, gender, rank, phone, String(body.region || '').trim() || null, String(body.address || '').trim() || null]
      );
      return sendJson(res, 201, { user: publicUser(result.rows[0]) });
    }

    if (requestPath === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const memberId = String(body.memberId || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const result = await pool.query('select * from public.users where lower(member_id) = $1', [memberId]);
      const user = result.rows[0];
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return sendJson(res, 401, { error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
      }
      const remember = body.remember === true;
      const token = await createSession(user.id, remember);
      return sendJson(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(token, remember ? SESSION_DAYS * 24 * 60 * 60 : null) });
    }

    if (requestPath === '/api/auth/logout' && req.method === 'POST') {
      const token = parseCookies(req)[SESSION_COOKIE];
      if (token) await pool.query('delete from public.sessions where token_hash = $1', [hashToken(token)]);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    if (requestPath === '/api/games' && req.method === 'GET') {
      return sendJson(res, 200, { games: await getGames() });
    }

    if (requestPath === '/api/games' && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      const location = String(body.location || '').trim();
      const formats = Array.isArray(body.formats) ? [...new Set(body.formats)] : [];
      const maxParticipants = Number(body.maxParticipants);
      if (!title || !location || !formats.length || !body.scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < 1 || formats.some((format) => !['singles', 'doubles', 'team'].includes(format))) {
        return sendJson(res, 400, { error: '게임 필수정보를 확인해 주세요.' });
      }
      const client = await pool.connect();
      try {
        await client.query('begin');
        const gameResult = await client.query(
          `insert into public.games (operator_id, title, location, scheduled_at, max_participants, note)
           values ($1, $2, $3, $4, $5, $6) returning *`,
          [user.id, title, location, body.scheduledAt, maxParticipants, String(body.note || '').trim() || null]
        );
        for (const format of formats) await client.query('insert into public.game_formats (game_id, format) values ($1, $2)', [gameResult.rows[0].id, format]);
        await client.query('commit');
        const games = await getGames();
        return sendJson(res, 201, { game: games.find((item) => item.id === gameResult.rows[0].id) });
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }

    const registrationMatch = requestPath.match(/^\/api\/games\/([^/]+)\/registrations$/);
    if (registrationMatch && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = registrationMatch[1];
      const format = String(body.format || '');
      if (!['singles', 'doubles', 'team'].includes(format) || !String(body.nickname || '').trim() || !String(body.rank || '').trim() || (format !== 'singles' && !String(body.teamName || '').trim())) {
        return sendJson(res, 400, { error: '참가신청 정보를 확인해 주세요.' });
      }
      const existing = await pool.query('select id from public.registrations where game_id = $1 and format = $2 and user_id = $3', [gameId, format, user.id]);
      let result;
      if (existing.rows[0]) {
        result = await pool.query(
          `update public.registrations set nickname = $1, member_id = $2, rank = $3, team_name = $4, updated_at = now()
            where id = $5 returning *`,
          [String(body.nickname).trim(), String(body.memberId || '').trim() || null, String(body.rank).trim(), String(body.teamName || '').trim() || null, existing.rows[0].id]
        );
      } else {
        result = await pool.query(
          `insert into public.registrations (game_id, format, user_id, nickname, member_id, rank, team_name, registered_by)
           values ($1, $2, $3, $4, $5, $6, $7, $3) returning *`,
          [gameId, format, user.id, String(body.nickname).trim(), String(body.memberId || '').trim() || null, String(body.rank).trim(), String(body.teamName || '').trim() || null]
        );
      }
      return sendJson(res, 201, { registration: result.rows[0] });
    }

    return sendJson(res, 404, { error: 'API를 찾을 수 없습니다.' });
  } catch (error) {
    if (error.code === '23505') return sendJson(res, 409, { error: '이미 사용 중인 ID이거나 중복된 참가신청입니다.' });
    console.error(error);
    return sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : '서버 처리 중 오류가 발생했습니다.' });
  }
}

module.exports = { handleApi };
