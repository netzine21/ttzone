const crypto = require('crypto');
const { getPool } = require('./db');

const SESSION_COOKIE = 'ttgms_session';
const SESSION_DAYS = 30;
let gameStateColumnsPromise = null;
let accessColumnsPromise = null;

async function ensureAccessColumns() {
  if (!accessColumnsPromise) {
    accessColumnsPromise = getPool().query(
      `alter table public.users
         add column if not exists role text not null default 'user';
       alter table public.games
         add column if not exists deleted_at timestamptz,
         add column if not exists deleted_by uuid references public.users(id) on delete set null`
    );
  }
  return accessColumnsPromise;
}

async function ensureGameStateColumns() {
  if (!gameStateColumnsPromise) {
    gameStateColumnsPromise = getPool().query(
      `alter table public.games
         add column if not exists qualifying_groups jsonb not null default '{}'::jsonb,
         add column if not exists preliminary_matches jsonb not null default '{}'::jsonb,
         add column if not exists tournaments jsonb not null default '{}'::jsonb,
         add column if not exists registration_closed jsonb not null default '{}'::jsonb,
         add column if not exists format_modes jsonb not null default '{}'::jsonb;
       alter table public.registrations
         add column if not exists registration_source text not null default 'bulk';
       update public.registrations
          set registration_source = 'online'
        where user_id is not null and registration_source = 'bulk'`
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
    role: row.role || 'user',
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
    formatModes: row.format_modes || {},
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

function normalizeFormatModes(value, formats) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(formats.map((format) => [
    format,
    source[format] === 'leagueOnly' ? 'leagueOnly' : 'leagueTournament',
  ]));
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
  await ensureAccessColumns();
  await ensureGameStateColumns();
  const games = await pool.query(
    `select g.*, u.nickname as operator_nickname
       from public.games g
       join public.users u on u.id = g.operator_id
      where g.deleted_at is null
      order by g.created_at desc`
  );
  const formats = await pool.query('select game_id, format from public.game_formats');
  const registrations = await pool.query(
    `select id, game_id, format, user_id, nickname, member_id, rank, team_name,
            registered_by, registration_source, applied_at, updated_at
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
      registrationSource: item.registration_source || (item.user_id ? 'online' : 'bulk'),
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
    await ensureAccessColumns();
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
      const formatModes = normalizeFormatModes(body.formatModes, formats);
      const maxParticipants = Number(body.maxParticipants);
      if (!title || !location || !formats.length || !body.scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < 1 || formats.some((format) => !['singles', 'doubles', 'team'].includes(format))) {
        return sendJson(res, 400, { error: '게임 필수정보를 확인해 주세요.' });
      }
      const client = await pool.connect();
      try {
        await client.query('begin');
        const gameResult = await client.query(
          `insert into public.games (operator_id, title, location, scheduled_at, max_participants, note, format_modes)
           values ($1, $2, $3, $4, $5, $6, $7) returning *`,
          [user.id, title, location, body.scheduledAt, maxParticipants, String(body.note || '').trim() || null, JSON.stringify(formatModes)]
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
      const formatModes = normalizeFormatModes(body.formatModes, formats);
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
              set title = $1, location = $2, scheduled_at = $3, max_participants = $4, note = $5, format_modes = $6, updated_at = now()
            where id = $7 and operator_id = $8
            returning id`,
          [title, location, body.scheduledAt, maxParticipants, String(body.note || '').trim() || null, JSON.stringify(formatModes), gameId, user.id]
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

    const preliminaryMatchesMatch = requestPath.match(/^\/api\/games\/([^/]+)\/preliminary-matches$/);
    if (preliminaryMatchesMatch && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = preliminaryMatchesMatch[1];
      const format = String(body.format || '');
      const schedule = body.schedule;
      if (!['singles', 'doubles', 'team'].includes(format) || !schedule || !Array.isArray(schedule.matches)) {
        return sendJson(res, 400, { error: '예선 경기결과 정보를 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `update public.games
            set preliminary_matches = jsonb_set(coalesce(preliminary_matches, '{}'::jsonb), ARRAY[$1]::text[], $2::jsonb, true),
                updated_at = now()
          where id = $3 and operator_id = $4
          returning id`,
        [format, JSON.stringify(schedule), gameId, user.id]
      );
      if (!gameResult.rows[0]) return sendJson(res, 404, { error: '경기결과를 저장할 게임을 찾을 수 없거나 운영자 권한이 없습니다.' });
      const games = await getGames(user.id);
      return sendJson(res, 200, { game: games.find((item) => item.id === gameId) });
    }

    const tournamentResultsMatch = requestPath.match(/^\/api\/games\/([^/]+)\/tournaments$/);
    if (tournamentResultsMatch && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = tournamentResultsMatch[1];
      const format = String(body.format || '');
      const tournament = body.tournament;
      if (!['singles', 'doubles', 'team'].includes(format) || !tournament || typeof tournament !== 'object') {
        return sendJson(res, 400, { error: '토너먼트 경기결과 정보를 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `update public.games
            set tournaments = jsonb_set(coalesce(tournaments, '{}'::jsonb), ARRAY[$1]::text[], $2::jsonb, true),
                updated_at = now()
          where id = $3 and operator_id = $4
          returning id`,
        [format, JSON.stringify(tournament), gameId, user.id]
      );
      if (!gameResult.rows[0]) return sendJson(res, 404, { error: '토너먼트 결과를 저장할 게임을 찾을 수 없거나 운영자 권한이 없습니다.' });
      const games = await getGames(user.id);
      return sendJson(res, 200, { game: games.find((item) => item.id === gameId) });
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
      const resetCompetition = !closed && body.resetCompetition === true;
      if (!['singles', 'doubles', 'team'].includes(format)) {
        return sendJson(res, 400, { error: '마감할 경기종목을 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `select id, operator_id, qualifying_groups, preliminary_matches, tournaments
           from public.games
          where id = $1`,
        [gameId]
      );
      const gameRow = gameResult.rows[0];
      if (!gameRow) return sendJson(res, 404, { error: '마감할 게임을 찾을 수 없습니다.' });
      if (user.role !== 'admin' && gameRow.operator_id !== user.id) {
        return sendJson(res, 403, { error: '게임 운영자 또는 관리자만 선수등록 마감을 변경할 수 있습니다.' });
      }

      const hasCompetitionData = Boolean(
        gameRow.qualifying_groups?.[format]?.groups?.length
        || gameRow.preliminary_matches?.[format]?.matches?.length
        || gameRow.tournaments?.[format]
      );
      if (!closed && hasCompetitionData && !resetCompetition) {
        return sendJson(res, 400, {
          error: '이미 조편성 또는 대진표가 생성되어 있습니다. 기존 경기 데이터를 초기화하고 마감을 취소하시겠습니까?',
          requiresReset: true,
        });
      }

      const updateQuery = resetCompetition
        ? `update public.games
              set registration_closed = jsonb_set(coalesce(registration_closed, '{}'::jsonb), $1::text[], 'false'::jsonb, true),
                  qualifying_groups = coalesce(qualifying_groups, '{}'::jsonb) - $2,
                  preliminary_matches = coalesce(preliminary_matches, '{}'::jsonb) - $2,
                  tournaments = coalesce(tournaments, '{}'::jsonb) - $2,
                  updated_at = now()
            where id = $3
            returning id`
        : `update public.games
              set registration_closed = jsonb_set(coalesce(registration_closed, '{}'::jsonb), $1::text[], $2::jsonb, true),
                  updated_at = now()
            where id = $3
            returning id`;
      const updateParams = resetCompetition
        ? [`{${format}}`, format, gameId]
        : [`{${format}}`, JSON.stringify(closed), gameId];
      const updatedResult = await pool.query(updateQuery, updateParams);
      if (!updatedResult.rows[0]) return sendJson(res, 404, { error: '마감 상태를 변경할 게임을 찾을 수 없습니다.' });
      const games = await getGames(user.id);
      return sendJson(res, 200, { game: games.find((item) => item.id === gameId), format, closed: resetCompetition ? false : closed, resetCompetition });
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
            `insert into public.registrations (game_id, format, user_id, nickname, member_id, rank, team_name, registered_by, registration_source)
             values ($1, $2, null, $3, $4, $5, $6, $7, 'bulk')`,
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
    const registrationUpdateMatch = requestPath.match(/^\/api\/games\/([^/]+)\/registrations\/([^/]+)$/);
    const manualRegistrationMatch = requestPath.match(/^\/api\/games\/([^/]+)\/registrations\/manual$/);
    if (manualRegistrationMatch && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = manualRegistrationMatch[1];
      const format = String(body.format || '');
      const nickname = String(body.nickname || '').trim();
      const memberId = String(body.memberId || '').trim();
      const rank = String(body.rank || '').trim();
      const teamName = String(body.teamName || '').trim();
      if (!['singles', 'doubles', 'team'].includes(format) || !nickname || !rank || (format !== 'singles' && !teamName)) {
        return sendJson(res, 400, { error: '개별등록 정보를 확인해 주세요.' });
      }
      const gameResult = await pool.query(
        `select id, max_participants, registration_closed, qualifying_groups, preliminary_matches, tournaments
           from public.games where id = $1 and operator_id = $2`,
        [gameId, user.id]
      );
      const game = gameResult.rows[0];
      if (!game) return sendJson(res, 404, { error: '등록할 게임을 찾을 수 없거나 운영자 권한이 없습니다.' });
      if (game.registration_closed?.[format] === true) return sendJson(res, 400, { error: '해당 경기종목의 선수등록이 마감되었습니다.' });
      if (game.qualifying_groups?.[format]?.groups?.length || game.preliminary_matches?.[format]?.matches?.length || game.tournaments?.[format]) {
        return sendJson(res, 400, { error: '조편성 또는 경기진행이 시작되어 선수를 추가할 수 없습니다.' });
      }
      const countResult = await pool.query('select count(*)::int as count from public.registrations where game_id = $1 and format = $2', [gameId, format]);
      if (Number(countResult.rows[0]?.count || 0) >= Number(game.max_participants)) return sendJson(res, 400, { error: '해당 경기종목의 정원이 마감되었습니다.' });
      const duplicate = await pool.query(
        `select id from public.registrations where game_id = $1 and format = $2 and (lower(nickname) = lower($3) or ($4 <> '' and lower(coalesce(member_id, '')) = lower($4))) limit 1`,
        [gameId, format, nickname, memberId]
      );
      if (duplicate.rows[0]) return sendJson(res, 409, { error: '같은 선수명 또는 아이디가 이미 등록되어 있습니다.' });
      const result = await pool.query(
        `insert into public.registrations (game_id, format, user_id, nickname, member_id, rank, team_name, registered_by, registration_source)
         values ($1, $2, null, $3, $4, $5, $6, $7, 'manual') returning *`,
        [gameId, format, nickname, memberId || null, rank, teamName || null, user.id]
      );
      return sendJson(res, 201, { registration: result.rows[0] });
    }
    if (registrationUpdateMatch && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = registrationUpdateMatch[1];
      const registrationId = registrationUpdateMatch[2];
      const nickname = String(body.nickname || '').trim();
      const memberId = String(body.memberId || '').trim();
      const rank = String(body.rank || '').trim();
      const teamName = String(body.teamName || '').trim();
      const registration = await pool.query(
        `select r.format, g.registration_closed
           from public.registrations r
           join public.games g on g.id = r.game_id
          where r.id = $1 and r.game_id = $2 and g.operator_id = $3`,
        [registrationId, gameId, user.id]
      );
      const row = registration.rows[0];
      if (!row) return sendJson(res, 404, { error: '수정할 참가선수를 찾을 수 없습니다.' });
      if (row.registration_closed?.[row.format] === true) return sendJson(res, 400, { error: '선수등록이 마감되어 수정할 수 없습니다.' });
      if (!nickname || !rank || (row.format !== 'singles' && !teamName)) return sendJson(res, 400, { error: '선수명, 부수와 팀명을 확인해 주세요.' });
      const updated = await pool.query(
        `update public.registrations
            set nickname = $1, member_id = $2, rank = $3, team_name = $4, updated_at = now()
          where id = $5 and game_id = $6
          returning *`,
        [nickname, memberId || null, rank, teamName || null, registrationId, gameId]
      );
      return sendJson(res, 200, { registration: updated.rows[0] });
    }
    if (registrationUpdateMatch && req.method === 'DELETE') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const gameId = registrationUpdateMatch[1];
      const registrationId = registrationUpdateMatch[2];
      const registration = await pool.query(
        `select r.format, g.registration_closed, g.qualifying_groups, g.preliminary_matches, g.tournaments
           from public.registrations r join public.games g on g.id = r.game_id
          where r.id = $1 and r.game_id = $2 and g.operator_id = $3`,
        [registrationId, gameId, user.id]
      );
      const row = registration.rows[0];
      if (!row) return sendJson(res, 404, { error: '삭제할 참가선수를 찾을 수 없습니다.' });
      if (row.registration_closed?.[row.format] === true || row.qualifying_groups?.[row.format]?.groups?.length || row.preliminary_matches?.[row.format]?.matches?.length || row.tournaments?.[row.format]) {
        return sendJson(res, 400, { error: '선수등록 마감 또는 경기진행이 시작되어 삭제할 수 없습니다.' });
      }
      await pool.query('delete from public.registrations where id = $1 and game_id = $2', [registrationId, gameId]);
      return sendJson(res, 200, { ok: true, registrationId });
    }
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
          `update public.registrations set nickname = $1, member_id = $2, rank = $3, team_name = $4, registration_source = 'online', updated_at = now()
            where id = $5 returning *`,
          [String(body.nickname).trim(), String(body.memberId || '').trim() || null, String(body.rank).trim(), String(body.teamName || '').trim() || null, existing.rows[0].id]
        );
      } else {
        result = await pool.query(
          `insert into public.registrations (game_id, format, user_id, nickname, member_id, rank, team_name, registered_by, registration_source)
           values ($1, $2, $3, $4, $5, $6, $7, $3, 'online') returning *`,
          [gameId, format, user.id, String(body.nickname).trim(), String(body.memberId || '').trim() || null, String(body.rank).trim(), String(body.teamName || '').trim() || null]
        );
      }
      return sendJson(res, 201, { registration: result.rows[0] });
    }

    if (gameUpdateMatch && req.method === 'DELETE') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const gameId = gameUpdateMatch[1];
      const result = await pool.query(
        `select operator_id, registration_closed, deleted_at
           from public.games
          where id = $1`,
        [gameId]
      );
      const game = result.rows[0];
      if (!game || game.deleted_at) return sendJson(res, 404, { error: '삭제할 게임을 찾을 수 없습니다.' });
      const isAdmin = user.role === 'admin';
      const isOwner = String(game.operator_id) === String(user.id);
      if (!isAdmin && !isOwner) return sendJson(res, 403, { error: '게임 운영자 또는 관리자만 삭제할 수 있습니다.' });
      const closed = game.registration_closed === true || Object.values(game.registration_closed || {}).some(Boolean);
      if (!isAdmin && closed) return sendJson(res, 400, { error: '선수등록 마감 후에는 게임을 삭제할 수 없습니다.' });
      await pool.query(
        `update public.games
            set deleted_at = now(), deleted_by = $1, updated_at = now()
          where id = $2`,
        [user.id, gameId]
      );
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'API를 찾을 수 없습니다.' });
  } catch (error) {
    if (error.code === '23505') return sendJson(res, 409, { error: '이미 사용 중인 ID이거나 중복된 참가신청입니다.' });
    console.error(error);
    return sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : '서버 처리 중 오류가 발생했습니다.' });
  }
}

module.exports = { handleApi };
