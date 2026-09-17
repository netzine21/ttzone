const crypto = require('crypto');
const { getPool } = require('./db');

const SESSION_COOKIE = 'ttgms_session';
const SESSION_DAYS = 30;
let gameStateColumnsPromise = null;

async function ensureGameStateColumns() {
  if (!gameStateColumnsPromise) {
    gameStateColumnsPromise = getPool().query(
      `alter table public.games
         add column if not exists qualifying_groups jsonb not null default '{}'::jsonb,
         add column if not exists preliminary_matches jsonb not null default '{}'::jsonb,
         add column if not exists tournaments jsonb not null default '{}'::jsonb,
         add column if not exists registration_closed jsonb not null default '{}'::jsonb`
    );
  }
  return gameStateColumnsPromise;
}

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

function publicGame(row, formats = [], registrations = [], viewerId = null) {
  const isOwner = viewerId && String(row.operator_id) === String(viewerId);
  const qualifyingGroups = row.qualifying_groups || {};
  const visibleQualifyingGroups = Object.fromEntries(Object.entries(qualifyingGroups).map(([format, setup]) => [
    format,
    isOwner || setup?.isPublic === true || setup?.isPublic === 'true' ? setup : { isPublic: false },
  ]));
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
    qualifyingGroups: visibleQualifyingGroups,
    preliminaryMatches: row.preliminary_matches || {},
    tournaments: row.tournaments || {},
    registrationClosed: row.registration_closed || {},
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

async function getGames(viewerId = null) {
  const pool = requirePool();
  await ensureGameStateColumns();
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
    })),
    viewerId
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
      const viewer = await findSession(req);
      return sendJson(res, 200, { games: await getGames(viewer?.id || null) });
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

    const gameUpdateMatch = requestPath.match(/^\/api\/games\/([^/]+)$/);
    if (gameUpdateMatch && ['PATCH', 'PUT'].includes(req.method)) {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = gameUpdateMatch[1];
      const title = String(body.title || '').trim();
      const location = String(body.location || '').trim();
      const formats = Array.isArray(body.formats) ? [...new Set(body.formats)] : [];
      const maxParticipants = Number(body.maxParticipants);
      if (!title || !location || !formats.length || !body.scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < 1 || formats.some((format) => !['singles', 'doubles', 'team'].includes(format))) {
        return sendJson(res, 400, { error: '게임 필수정보를 확인해 주세요.' });
      }
      const participantCount = await pool.query('select count(*)::int as count from public.registrations where game_id = $1', [gameId]);
      if (maxParticipants < participantCount.rows[0].count) {
        return sendJson(res, 400, { error: `최대참가인원은 현재 참가자 수(${participantCount.rows[0].count}명) 이상이어야 합니다.` });
      }
      const client = await pool.connect();
      try {
        await client.query('begin');
        const gameResult = await client.query(
          `update public.games
              set title = $1, location = $2, scheduled_at = $3, max_participants = $4, note = $5, updated_at = now()
            where id = $6 and operator_id = $7
            returning id`,
          [title, location, body.scheduledAt, maxParticipants, String(body.note || '').trim() || null, gameId, user.id]
        );
        if (!gameResult.rows[0]) {
          await client.query('rollback');
          return sendJson(res, 404, { error: '수정할 게임을 찾을 수 없거나 운영자 권한이 없습니다.' });
        }
        await client.query('delete from public.game_formats where game_id = $1', [gameId]);
        for (const format of formats) await client.query('insert into public.game_formats (game_id, format) values ($1, $2)', [gameId, format]);
        await client.query('commit');
        const games = await getGames();
        return sendJson(res, 200, { game: games.find((item) => item.id === gameId) });
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }

    const qualifyingGroupsMatch = requestPath.match(/^\/api\/games\/([^/]+)\/qualifying-groups$/);
    if (qualifyingGroupsMatch && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = qualifyingGroupsMatch[1];
      const format = String(body.format || '');
      const setup = body.setup;
      if (!['singles', 'doubles', 'team'].includes(format) || !setup || !Array.isArray(setup.groups)) {
        return sendJson(res, 400, { error: '조편성 정보를 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `update public.games
            set qualifying_groups = jsonb_set(coalesce(qualifying_groups, '{}'::jsonb), $1::text[], $2::jsonb, true),
                preliminary_matches = coalesce(preliminary_matches, '{}'::jsonb) - $3,
                updated_at = now()
          where id = $4 and operator_id = $5
          returning id`,
        [`{${format}}`, JSON.stringify(setup), format, gameId, user.id]
      );
      if (!gameResult.rows[0]) return sendJson(res, 404, { error: '저장할 게임을 찾을 수 없거나 운영자 권한이 없습니다.' });
      const games = await getGames();
      return sendJson(res, 200, { game: games.find((item) => item.id === gameId) });
    }

    const qualifyingVisibilityMatch = requestPath.match(/^\/api\/games\/([^/]+)\/qualifying-groups\/visibility$/);
    if (qualifyingVisibilityMatch && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = qualifyingVisibilityMatch[1];
      const format = String(body.format || '');
      const isPublic = body.isPublic === true;
      if (!['singles', 'doubles', 'team'].includes(format)) {
        return sendJson(res, 400, { error: '공개할 경기종목을 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `update public.games
            set qualifying_groups = jsonb_set(
              jsonb_set(
                coalesce(qualifying_groups, '{}'::jsonb),
                ARRAY[$1, 'isPublic']::text[],
                to_jsonb($2::boolean),
                true
              ),
              ARRAY[$1, 'publishedAt']::text[],
              case when $2::boolean then to_jsonb(now()) else 'null'::jsonb end,
              true
            ),
                updated_at = now()
          where id = $3 and operator_id = $4
          returning id`,
        [format, isPublic, gameId, user.id]
      );
      if (!gameResult.rows[0]) return sendJson(res, 404, { error: '공개 상태를 변경할 게임을 찾을 수 없습니다.' });
      const games = await getGames(user.id);
      return sendJson(res, 200, { game: games.find((item) => item.id === gameId), isPublic });
    }

    const registrationCloseMatch = requestPath.match(/^\/api\/games\/([^/]+)\/registrations\/close$/);
    if (registrationCloseMatch && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = registrationCloseMatch[1];
      const format = String(body.format || '');
      const closed = body.closed === true;
      if (!['singles', 'doubles', 'team'].includes(format)) {
        return sendJson(res, 400, { error: '마감할 경기종목을 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `update public.games
            set registration_closed = jsonb_set(coalesce(registration_closed, '{}'::jsonb), $1::text[], $2::jsonb, true),
                updated_at = now()
          where id = $3 and operator_id = $4
          returning id`,
        [`{${format}}`, JSON.stringify(closed), gameId, user.id]
      );
      if (!gameResult.rows[0]) return sendJson(res, 404, { error: '마감할 게임을 찾을 수 없거나 운영자 권한이 없습니다.' });
      const games = await getGames(user.id);
      return sendJson(res, 200, { game: games.find((item) => item.id === gameId), format, closed });
    }

    const bulkRegistrationMatch = requestPath.match(/^\/api\/games\/([^/]+)\/registrations\/bulk$/);
    if (bulkRegistrationMatch && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = bulkRegistrationMatch[1];
      const format = String(body.format || '');
      const rows = Array.isArray(body.registrations) ? body.registrations : [];
      if (!['singles', 'doubles', 'team'].includes(format) || !rows.length) {
        return sendJson(res, 400, { error: '일괄등록 정보를 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `select g.id, g.max_participants, g.registration_closed
           from public.games g
          where g.id = $1 and g.operator_id = $2`,
        [gameId, user.id]
      );
      if (!gameResult.rows[0]) return sendJson(res, 404, { error: '등록할 게임을 찾을 수 없거나 운영자 권한이 없습니다.' });
      if (gameResult.rows[0].registration_closed?.[format] === true) return sendJson(res, 400, { error: '해당 경기종목의 선수등록이 마감되었습니다.' });
      const formatResult = await pool.query('select 1 from public.game_formats where game_id = $1 and format = $2', [gameId, format]);
      if (!formatResult.rows[0]) return sendJson(res, 400, { error: '해당 게임에 등록되지 않은 경기형식입니다.' });
      const client = await pool.connect();
      let added = 0;
      let skipped = 0;
      try {
        await client.query('begin');
        const currentCountResult = await client.query('select count(*)::int as count from public.registrations where game_id = $1 and format = $2', [gameId, format]);
        let currentCount = currentCountResult.rows[0].count;
        for (const row of rows) {
          const nickname = String(row.nickname || '').trim();
          const rank = String(row.rank || '').trim();
          const teamName = String(row.teamName || '').trim();
          const memberId = String(row.memberId || '').trim() || null;
          if (!nickname || !rank || (format !== 'singles' && !teamName) || currentCount >= gameResult.rows[0].max_participants) {
            skipped += 1;
            continue;
          }
          const duplicate = await client.query(
            `select id from public.registrations
              where game_id = $1 and format = $2
                and ((user_id is null and lower(nickname) = lower($3)) or (user_id is not null and member_id is not null and lower(member_id) = lower($4)))
              limit 1`,
            [gameId, format, nickname, memberId || '']
          );
          if (duplicate.rows[0]) {
            skipped += 1;
            continue;
          }
          await client.query(
            `insert into public.registrations (game_id, format, user_id, nickname, member_id, rank, team_name, registered_by)
             values ($1, $2, null, $3, $4, $5, $6, $7)`,
            [gameId, format, nickname, memberId, rank, teamName || null, user.id]
          );
          currentCount += 1;
          added += 1;
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
      const games = await getGames();
      return sendJson(res, 201, { added, skipped, game: games.find((item) => item.id === gameId) });
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
      const gameStatus = await pool.query('select registration_closed from public.games where id = $1', [gameId]);
      if (gameStatus.rows[0]?.registration_closed?.[format] === true) return sendJson(res, 400, { error: '해당 경기종목의 선수등록이 마감되었습니다.' });
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
