const crypto = require('crypto');
const { getPool } = require('./db');
const incheonVenues = require('./incheon-venues');
const bucheonVenues = require('./bucheon-venues');

const SESSION_COOKIE = 'ttgms_session';
const VISITOR_COOKIE = 'ttgms_visitor';
const SESSION_DAYS = 30;
let gameStateColumnsPromise = null;
let accessColumnsPromise = null;
let gameAccessColumnsPromise = null;
let gameVenueColumnsPromise = null;
let leagueSeriesColumnsPromise = null;
let regionColumnsPromise = null;
let venueColumnsPromise = null;
let visitorColumnsPromise = null;

async function ensureVisitorColumns() {
  if (!visitorColumnsPromise) {
    visitorColumnsPromise = getPool().query(
      `create table if not exists public.visitor_sessions (
         id uuid primary key default gen_random_uuid(),
         visitor_key uuid not null unique,
         user_id uuid references public.users(id) on delete set null,
         first_seen timestamptz not null default now(),
         last_seen timestamptz not null default now(),
         user_agent text
       );
       create index if not exists visitor_sessions_last_seen_idx
         on public.visitor_sessions(last_seen);
       create index if not exists visitor_sessions_user_id_idx
         on public.visitor_sessions(user_id)`
    );
  }
  return visitorColumnsPromise;
}

async function ensureVenueColumns() {
  if (!venueColumnsPromise) {
    venueColumnsPromise = getPool().query(
      `create table if not exists public.venues (
         id uuid primary key default gen_random_uuid(),
         name text not null,
         address text not null,
         phone text,
         region text,
         map_url text,
         status text not null default 'pending',
         created_by uuid references public.users(id) on delete set null,
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       );
       create unique index if not exists venues_name_address_key
         on public.venues (lower(name), lower(address));
       alter table public.venues
         add column if not exists phone text`
    );
  }
  return venueColumnsPromise;
}

async function ensureGameVenueColumns() {
  if (!gameVenueColumnsPromise) {
    gameVenueColumnsPromise = getPool().query(
      `alter table public.games
         add column if not exists venue_id uuid references public.venues(id) on delete set null,
         add column if not exists venue_name text,
         add column if not exists venue_address text,
         add column if not exists venue_phone text`
    );
  }
  return gameVenueColumnsPromise;
}

async function ensureLeagueSeriesColumns() {
  if (!leagueSeriesColumnsPromise) {
    leagueSeriesColumnsPromise = getPool().query(
      `create table if not exists public.league_series (
         id uuid primary key default gen_random_uuid(),
         venue_id uuid references public.venues(id) on delete set null,
         owner_id uuid not null references public.users(id) on delete restrict,
         name text not null,
         logo_url text,
         schedule_label text,
         description text,
         default_formats jsonb not null default '["singles"]'::jsonb,
         default_format_modes jsonb not null default '{}'::jsonb,
         default_max_participants integer check (default_max_participants is null or default_max_participants > 0),
         status text not null default 'active' check (status in ('active', 'archived')),
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       );
       alter table public.league_series
         add column if not exists logo_url text;
       alter table public.league_series
         alter column venue_id drop not null;
       alter table public.games
         add column if not exists series_id uuid references public.league_series(id) on delete set null,
         add column if not exists series_round integer;
       create index if not exists league_series_venue_id_idx on public.league_series(venue_id);
       create index if not exists league_series_owner_id_idx on public.league_series(owner_id);
       create index if not exists games_series_id_idx on public.games(series_id)`
    );
  }
  return leagueSeriesColumnsPromise;
}

async function ensureAccessColumns() {
  if (!accessColumnsPromise) {
    accessColumnsPromise = getPool().query(
      `alter table public.users
         add column if not exists role text not null default 'user'`
    );
  }
  return accessColumnsPromise;
}

async function ensureGameAccessColumns() {
  if (!gameAccessColumnsPromise) {
    gameAccessColumnsPromise = getPool().query(
      `alter table public.games
         add column if not exists deleted_at timestamptz,
         add column if not exists deleted_by uuid references public.users(id) on delete set null`
    );
  }
  return gameAccessColumnsPromise;
}

async function ensureRegionColumns() {
  if (!regionColumnsPromise) {
    regionColumnsPromise = getPool().query(
      `alter table public.users
         add column if not exists region_sido text,
         add column if not exists region_sigungu text`
    );
  }
  return regionColumnsPromise;
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
         add column if not exists registration_source text not null default 'bulk',
         add column if not exists gender text;
       update public.registrations
          set registration_source = 'online'
        where user_id is not null and registration_source = 'bulk'`
    );
  }
  return gameStateColumnsPromise;
}

function sendJson(res, statusCode, payload, headers = {}) {
  const responseHeaders = { ...headers };
  if (res.visitorCookie) {
    const existingCookies = responseHeaders['Set-Cookie']
      ? (Array.isArray(responseHeaders['Set-Cookie']) ? responseHeaders['Set-Cookie'] : [responseHeaders['Set-Cookie']])
      : [];
    responseHeaders['Set-Cookie'] = [res.visitorCookie, ...existingCookies];
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...responseHeaders,
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
    regionSido: row.region_sido || '',
    regionSigungu: row.region_sigungu || '',
    address: row.address || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicGame(row, formats = [], registrations = [], viewerId = null) {
  const isOwner = viewerId && String(row.operator_id) === String(viewerId);
  const locationParts = String(row.location || '').split(' · ');
  const qualifyingGroups = row.qualifying_groups || {};
  const visibleQualifyingGroups = Object.fromEntries(Object.entries(qualifyingGroups).map(([format, setup]) => [
    format,
    isOwner || setup?.isPublic === true || setup?.isPublic === 'true' ? setup : { isPublic: false },
  ]));
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    venueId: row.venue_id || null,
    venueName: row.venue_name || locationParts[0] || row.location,
    venueAddress: row.venue_address || locationParts.slice(1).join(' · '),
    venuePhone: row.venue_phone || '',
    seriesId: row.series_id || null,
    seriesName: row.series_name || '',
    seriesScheduleLabel: row.series_schedule_label || '',
    seriesRound: row.series_round || null,
    formats,
    format: formats[0] || null,
    formatModes: row.format_modes || {},
    scheduledAt: row.scheduled_at,
    maxParticipants: row.max_participants,
    note: row.note || '',
    operatorId: row.operator_id,
    operatorNickname: row.operator_nickname,
    operatorPhone: row.operator_phone || '',
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

function publicLeagueSeries(row) {
  return {
    id: row.id,
    venueId: row.venue_id,
    venueName: row.venue_name || '',
    venueAddress: row.venue_address || '',
    ownerId: row.owner_id,
    ownerNickname: row.owner_nickname || '',
    name: row.name,
    logoUrl: row.logo_url || '',
    scheduleLabel: row.schedule_label || '',
    description: row.description || '',
    defaultFormats: Array.isArray(row.default_formats) ? row.default_formats : [],
    defaultFormatModes: row.default_format_modes || {},
    defaultMaxParticipants: row.default_max_participants || null,
    status: row.status,
    gameCount: Number(row.game_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getLeagueSeries(viewerId = null) {
  const pool = requirePool();
  await ensureVenueColumns();
  await ensureLeagueSeriesColumns();
  const result = await pool.query(
    `select s.*, v.name as venue_name, v.address as venue_address,
            u.nickname as owner_nickname,
            count(g.id)::int as game_count
       from public.league_series s
       left join public.venues v on v.id = s.venue_id
       join public.users u on u.id = s.owner_id
       left join public.games g on g.series_id = s.id and g.deleted_at is null
      where s.status = 'active' or s.owner_id = $1
      group by s.id, v.name, v.address, u.nickname
      order by v.name, s.name`,
    [viewerId]
  );
  return result.rows.map(publicLeagueSeries);
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

async function trackVisitor(req, res, pool) {
  await ensureVisitorColumns();
  const cookies = parseCookies(req);
  let visitorKey = cookies[VISITOR_COOKIE];
  if (!visitorKey || !/^[0-9a-f-]{36}$/i.test(visitorKey)) {
    visitorKey = crypto.randomUUID();
    res.visitorCookie = `${VISITOR_COOKIE}=${encodeURIComponent(visitorKey)}; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax; Path=/`;
  }
  const sessionToken = cookies[SESSION_COOKIE];
  const sessionResult = sessionToken
    ? await pool.query('select user_id from public.sessions where token_hash = $1 and expires_at > now()', [hashToken(sessionToken)])
    : { rows: [] };
  await pool.query(
    `insert into public.visitor_sessions (visitor_key, user_id, user_agent)
     values ($1, $2, $3)
     on conflict (visitor_key) do update
       set user_id = coalesce(excluded.user_id, public.visitor_sessions.user_id),
           last_seen = now(),
           user_agent = coalesce(excluded.user_agent, public.visitor_sessions.user_agent)`,
    [visitorKey, sessionResult.rows[0]?.user_id || null, String(req.headers['user-agent'] || '').slice(0, 500) || null]
  );
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
  await ensureGameAccessColumns();
  await ensureGameStateColumns();
  await ensureVenueColumns();
  await ensureGameVenueColumns();
  await ensureLeagueSeriesColumns();
  const games = await pool.query(
    `select g.*, u.nickname as operator_nickname, u.phone as operator_phone,
            s.name as series_name, s.schedule_label as series_schedule_label
       from public.games g
       join public.users u on u.id = g.operator_id
       left join public.league_series s on s.id = g.series_id
      where g.deleted_at is null
      order by g.created_at desc`
  );
  const formats = await pool.query('select game_id, format from public.game_formats');
  const registrations = await pool.query(
    `select r.id, r.game_id, r.format, r.user_id, r.nickname, r.member_id, r.rank, r.team_name,
            coalesce(r.gender, u.gender, member.gender) as gender,
            r.registered_by, r.registration_source, r.applied_at, r.updated_at
       from public.registrations r
       left join public.users u on u.id = r.user_id
       left join public.users member
         on r.user_id is null
        and r.member_id is not null
        and lower(member.member_id) = lower(r.member_id)
      order by r.applied_at`
  );
  return games.rows.map((game) => publicGame(
    game,
    formats.rows.filter((item) => item.game_id === game.id).map((item) => item.format),
    registrations.rows.filter((item) => item.game_id === game.id).map((item) => ({
      id: item.id,
      userId: item.user_id,
      nickname: item.nickname,
      gender: item.gender || '',
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
    try {
      await trackVisitor(req, res, pool);
    } catch (error) {
      console.error('방문자 접속 기록 저장 실패:', error);
    }
    if (requestPath === '/api/access-heartbeat' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true });
    }
    if (requestPath === '/api/auth/me' && req.method === 'GET') {
      return sendJson(res, 200, { user: publicUser(await findSession(req)) });
    }

    if (requestPath === '/api/admin/users' && req.method === 'GET') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 회원 목록을 확인할 수 있습니다.' });
      const result = await pool.query(
        `select id, nickname, member_id, gender, rank, phone, region, address, role, created_at, updated_at
           from public.users
          order by created_at desc`
      );
      return sendJson(res, 200, { users: result.rows.map(publicUser) });
    }

    if (requestPath === '/api/admin/access-status' && req.method === 'GET') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 접속현황을 확인할 수 있습니다.' });
      await ensureVisitorColumns();
      const result = await pool.query(
        `select vs.visitor_key, vs.user_id, vs.first_seen, vs.last_seen,
                u.nickname, u.member_id, u.role
           from public.visitor_sessions vs
           left join public.users u on u.id = vs.user_id
          where vs.last_seen > now() - interval '2 minutes'
          order by vs.last_seen desc`
      );
      return sendJson(res, 200, {
        active: result.rows.map((row) => ({
          visitorKey: row.visitor_key,
          userId: row.user_id,
          nickname: row.nickname || '',
          memberId: row.member_id || '',
          role: row.role || '',
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,
        })),
      });
    }

    if (requestPath === '/api/venues' && req.method === 'GET') {
      await ensureVenueColumns();
      const result = await pool.query(
        `select id, name, address, phone, region, map_url, status, created_by, created_at, updated_at
           from public.venues
          where status = 'approved'
          order by name`
      );
      return sendJson(res, 200, { venues: result.rows.map((venue) => ({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        phone: venue.phone || '',
        region: venue.region || '',
        regionSido: venue.region_sido || '',
        regionSigungu: venue.region_sigungu || '',
        mapUrl: venue.map_url || '',
        status: venue.status,
        createdBy: venue.created_by,
        createdAt: venue.created_at,
        updatedAt: venue.updated_at,
      })) });
    }

    if (requestPath === '/api/venues' && req.method === 'POST') {
      await ensureVenueColumns();
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const address = String(body.address || '').trim();
      const phone = String(body.phone || '').trim();
      if (!name || !address) return sendJson(res, 400, { error: '탁구장명과 주소를 입력해 주세요.' });
      const result = await pool.query(
        `insert into public.venues (name, address, phone, region, map_url, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict ((lower(name)), (lower(address)))
         do update set phone = coalesce(excluded.phone, public.venues.phone), updated_at = now()
         returning *`,
        [name, address, phone || null, String(body.region || '').trim() || null, String(body.mapUrl || '').trim() || null, user.role === 'admin' ? 'approved' : 'pending', user.id]
      );
      return sendJson(res, 201, { venue: result.rows[0] });
    }

    if (requestPath === '/api/admin/venues' && req.method === 'GET') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 탁구장 목록을 관리할 수 있습니다.' });
      await ensureVenueColumns();
      const result = await pool.query('select * from public.venues order by name');
      return sendJson(res, 200, { venues: result.rows.map((venue) => ({ id: venue.id, name: venue.name, address: venue.address, phone: venue.phone || '', region: venue.region || '', regionSido: venue.region_sido || '', regionSigungu: venue.region_sigungu || '', mapUrl: venue.map_url || '', status: venue.status, createdAt: venue.created_at, updatedAt: venue.updated_at })) });
    }

    if (requestPath === '/api/admin/venues' && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 탁구장을 등록할 수 있습니다.' });
      await ensureVenueColumns();
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const address = String(body.address || '').trim();
      const phone = String(body.phone || '').trim();
      const region = String(body.region || '').trim();
      const mapUrl = String(body.mapUrl || '').trim();
      if (!name || !address) return sendJson(res, 400, { error: '탁구장명과 주소를 입력해 주세요.' });
      const result = await pool.query(
        `insert into public.venues (name, address, phone, region, map_url, status, created_by)
         values ($1, $2, $3, $4, $5, 'approved', $6)
         on conflict ((lower(name)), (lower(address))) do update
           set phone = coalesce(excluded.phone, public.venues.phone),
               region = coalesce(nullif(excluded.region, ''), public.venues.region),
               map_url = coalesce(nullif(excluded.map_url, ''), public.venues.map_url),
               status = 'approved',
               updated_at = now()
         returning *`,
        [name, address, phone || null, region || null, mapUrl || null, user.id]
      );
      return sendJson(res, 201, { venue: result.rows[0] });
    }

    if (requestPath === '/api/admin/venues/bulk-import' && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 탁구장을 일괄등록할 수 있습니다.' });
      await ensureVenueColumns();
      const body = await readBody(req);
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2000) : [];
      if (!rows.length) return sendJson(res, 400, { error: '등록할 탁구장 데이터가 없습니다.' });
      const client = await pool.connect();
      let imported = 0;
      try {
        await client.query('begin');
        for (const row of rows) {
          const name = String(row.name || '').trim();
          const address = String(row.address || '').trim();
          if (!name || !address) continue;
          await client.query(
            `insert into public.venues (name, address, phone, region, map_url, status, created_by)
             values ($1, $2, $3, $4, $5, 'approved', $6)
             on conflict ((lower(name)), (lower(address))) do update
               set phone = coalesce(nullif(excluded.phone, ''), public.venues.phone),
                   region = coalesce(nullif(excluded.region, ''), public.venues.region),
                   map_url = coalesce(nullif(excluded.map_url, ''), public.venues.map_url),
                   updated_at = now()`,
            [name, address, String(row.phone || '').trim() || null, String(row.region || '').trim() || null, String(row.mapUrl || '').trim() || null, user.id]
          );
          imported += 1;
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
      return sendJson(res, 200, { imported });
    }

    if (requestPath === '/api/admin/venues/import-incheon' && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 인천 탁구장 목록을 가져올 수 있습니다.' });
      await ensureVenueColumns();
      const client = await pool.connect();
      try {
        await client.query('begin');
        for (const [name, address, phone] of incheonVenues) {
          await client.query(
            `insert into public.venues (name, address, phone, region, status, created_by)
             values ($1, $2, $3, '인천', 'pending', $4)
             on conflict ((lower(name)), (lower(address))) do update
               set phone = coalesce(excluded.phone, public.venues.phone), updated_at = now()`,
            [name, address, phone || null, user.id]
          );
        }
        await client.query('commit');
        return sendJson(res, 200, { imported: incheonVenues.length, status: 'pending' });
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }

    if (requestPath === '/api/admin/venues/import-bucheon' && req.method === 'POST') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 부천 탁구장 목록을 가져올 수 있습니다.' });
      await ensureVenueColumns();
      const client = await pool.connect();
      try {
        await client.query('begin');
        for (const [name, address, phone] of bucheonVenues) {
          await client.query(
            `insert into public.venues (name, address, phone, region, status, created_by)
             values ($1, $2, $3, '경기 부천시', 'pending', $4)
             on conflict ((lower(name)), (lower(address))) do update
               set phone = coalesce(excluded.phone, public.venues.phone), updated_at = now()` ,
            [name, address, phone || null, user.id]
          );
        }
        await client.query('commit');
        return sendJson(res, 200, { imported: bucheonVenues.length, status: 'pending' });
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }

    if (requestPath === '/api/admin/venues/bulk-status' && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 탁구장 상태를 변경할 수 있습니다.' });
      await ensureVenueColumns();
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      const bulkStatus = ['pending', 'approved', 'archived'].includes(body.status) ? body.status : null;
      const requestedUpdates = Array.isArray(body.updates) ? body.updates : [];
      const updates = ids.map((id) => {
        const requested = requestedUpdates.find((item) => String(item.id) === String(id));
        return { id, status: bulkStatus || requested?.status };
      });
      if (!updates.length || updates.some((item) => !['pending', 'approved', 'archived'].includes(item.status))) {
        return sendJson(res, 400, { error: '변경할 장소의 상태를 선택해 주세요.' });
      }
      const client = await pool.connect();
      try {
        await client.query('begin');
        let updated = 0;
        for (const item of updates) {
          const result = await client.query(
            `update public.venues set status = $1, updated_at = now() where id = $2::uuid returning id`,
            [item.status, item.id]
          );
          updated += result.rowCount;
        }
        if (updated !== updates.length) {
          await client.query('rollback');
          return sendJson(res, 400, { error: '일부 탁구장 정보를 찾지 못해 저장을 취소했습니다.' });
        }
        await client.query('commit');
        return sendJson(res, 200, { updated, status: bulkStatus || '개별 상태' });
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }

    const adminVenueMatch = requestPath.match(/^\/api\/admin\/venues\/([^/]+)$/);
    if (adminVenueMatch && req.method === 'PATCH') {
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      if (user.role !== 'admin') return sendJson(res, 403, { error: '시스템관리자만 탁구장 정보를 수정할 수 있습니다.' });
      await ensureVenueColumns();
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const address = String(body.address || '').trim();
      const phone = String(body.phone || '').trim();
      const status = ['pending', 'approved', 'archived'].includes(body.status) ? body.status : 'approved';
      if (!name || !address) return sendJson(res, 400, { error: '탁구장명과 주소를 입력해 주세요.' });
      const result = await pool.query(
        `update public.venues
            set name = $1,
                address = $2,
                phone = $3,
                region = coalesce(nullif($4, ''), region),
                map_url = coalesce(nullif($5, ''), map_url),
                status = $6,
                updated_at = now()
          where id = $7
          returning *`,
        [name, address, phone || null, String(body.region || '').trim() || null, String(body.mapUrl || '').trim() || null, status, adminVenueMatch[1]]
      );
      if (!result.rows[0]) return sendJson(res, 404, { error: '탁구장 정보를 찾을 수 없습니다.' });
      return sendJson(res, 200, { venue: result.rows[0] });
    }

    if (requestPath === '/api/auth/signup' && req.method === 'POST') {
      await ensureRegionColumns();
      const body = await readBody(req);
      const nickname = String(body.nickname || '').trim();
      const memberId = String(body.memberId || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const phone = String(body.phone || '').trim();
      const gender = String(body.gender || '').trim();
      const rank = String(body.rank || '').trim();
      const region = String(body.region || '').trim();
      const regionSido = String(body.regionSido || '').trim();
      const regionSigungu = String(body.regionSigungu || '').trim();
      if (!nickname || !memberId || !password || !phone || !rank || !region || !regionSido || !regionSigungu || !['male', 'female'].includes(gender)) {
        return sendJson(res, 400, { error: '필수 회원정보를 모두 입력해 주세요.' });
      }
      const passwordHash = await hashPassword(password);
      const result = await pool.query(
        `insert into public.users (nickname, member_id, password_hash, gender, rank, phone, region, region_sido, region_sigungu, address)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning *`,
        [nickname, memberId, passwordHash, gender, rank, phone, region, regionSido, regionSigungu, String(body.address || '').trim() || null]
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

    if (requestPath === '/api/auth/account' && req.method === 'DELETE') {
      await ensureGameAccessColumns();
      await ensureVisitorColumns();
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const ownedGames = await pool.query(
        `select id, title
           from public.games
          where operator_id = $1
          limit 1`,
        [user.id]
      );
      if (ownedGames.rows.length) {
        return sendJson(res, 409, { error: '생성한 게임이 있어 회원탈퇴를 진행할 수 없습니다. 운영 중인 게임을 먼저 정리해 주세요.' });
      }
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query('delete from public.sessions where user_id = $1', [user.id]);
        await client.query('update public.visitor_sessions set user_id = null where user_id = $1', [user.id]);
        await client.query('delete from public.users where id = $1', [user.id]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    if (requestPath === '/api/auth/profile' && req.method === 'PATCH') {
      await ensureRegionColumns();
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const nickname = String(body.nickname || '').trim();
      const phone = String(body.phone || '').trim();
      const gender = String(body.gender || '').trim();
      const rank = String(body.rank || '').trim();
      const region = String(body.region || '').trim();
      const regionSido = String(body.regionSido || '').trim();
      const regionSigungu = String(body.regionSigungu || '').trim();
      if (!nickname || !phone || !rank || !region || !regionSido || !regionSigungu || !['male', 'female'].includes(gender)) {
        return sendJson(res, 400, { error: '필수 회원정보를 모두 입력해 주세요.' });
      }
      const result = await pool.query(
        `update public.users
            set nickname = $1,
                phone = $2,
                gender = $3,
                rank = $4,
                region = $5,
                region_sido = $6,
                region_sigungu = $7,
                address = $8,
                updated_at = now()
          where id = $9
          returning *`,
        [nickname, phone, gender, rank, region, regionSido, regionSigungu, String(body.address || '').trim() || null, user.id]
      );
      return sendJson(res, 200, { user: publicUser(result.rows[0]) });
    }

    if (requestPath === '/api/league-series' && req.method === 'GET') {
      const viewer = await findSession(req);
      return sendJson(res, 200, { series: await getLeagueSeries(viewer?.id || null) });
    }

    if (requestPath === '/api/league-series' && req.method === 'POST') {
      await ensureVenueColumns();
      await ensureLeagueSeriesColumns();
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const logoUrl = String(body.logoUrl || '').trim();
      const scheduleLabel = String(body.scheduleLabel || '').trim();
      const description = String(body.description || '').trim();
      const formats = Array.isArray(body.defaultFormats) ? [...new Set(body.defaultFormats)] : ['singles'];
      const formatModes = normalizeFormatModes(body.defaultFormatModes, formats);
      const defaultMaxParticipants = body.defaultMaxParticipants ? Number(body.defaultMaxParticipants) : null;
      if (!name || logoUrl.length > 3000000 || (logoUrl && !/^(https?:\/\/|data:image\/)/i.test(logoUrl)) || !formats.length || formats.some((format) => !['singles', 'doubles', 'team'].includes(format)) || (defaultMaxParticipants !== null && (!Number.isInteger(defaultMaxParticipants) || defaultMaxParticipants < 1))) {
        return sendJson(res, 400, { error: '정기리그명과 기본 경기형식 정보를 확인해 주세요.' });
      }
      const result = await pool.query(
        `insert into public.league_series (owner_id, name, logo_url, schedule_label, description, default_formats, default_format_modes, default_max_participants)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id`,
        [user.id, name, logoUrl || null, scheduleLabel || null, description || null, JSON.stringify(formats), JSON.stringify(formatModes), defaultMaxParticipants]
      );
      const series = (await getLeagueSeries(user.id)).find((item) => item.id === result.rows[0].id);
      return sendJson(res, 201, { series });
    }

    const leagueSeriesMatch = requestPath.match(/^\/api\/league-series\/([^/]+)$/);
    if (leagueSeriesMatch && ['PATCH', 'PUT'].includes(req.method)) {
      await ensureLeagueSeriesColumns();
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const logoUrl = String(body.logoUrl || '').trim();
      const scheduleLabel = String(body.scheduleLabel || '').trim();
      const description = String(body.description || '').trim();
      const formats = Array.isArray(body.defaultFormats) ? [...new Set(body.defaultFormats)] : ['singles'];
      const formatModes = normalizeFormatModes(body.defaultFormatModes, formats);
      const defaultMaxParticipants = body.defaultMaxParticipants ? Number(body.defaultMaxParticipants) : null;
      const status = body.status === 'archived' ? 'archived' : 'active';
      if (!name || logoUrl.length > 3000000 || (logoUrl && !/^(https?:\/\/|data:image\/)/i.test(logoUrl)) || !formats.length || formats.some((format) => !['singles', 'doubles', 'team'].includes(format)) || (defaultMaxParticipants !== null && (!Number.isInteger(defaultMaxParticipants) || defaultMaxParticipants < 1))) {
        return sendJson(res, 400, { error: '정기리그명과 기본 설정을 확인해 주세요.' });
      }
      const result = await pool.query(
        `update public.league_series
            set name = $1, logo_url = $2, schedule_label = $3, description = $4,
                default_formats = $5, default_format_modes = $6,
                default_max_participants = $7, status = $8, updated_at = now()
          where id = $9 and (owner_id = $10 or exists (select 1 from public.users where id = $10 and role = 'admin'))
          returning id`,
        [name, logoUrl || null, scheduleLabel || null, description || null, JSON.stringify(formats), JSON.stringify(formatModes), defaultMaxParticipants, status, leagueSeriesMatch[1], user.id]
      );
      if (!result.rows[0]) return sendJson(res, 404, { error: '수정할 정기리그를 찾을 수 없거나 권한이 없습니다.' });
      const series = (await getLeagueSeries(user.id)).find((item) => item.id === result.rows[0].id);
      return sendJson(res, 200, { series });
    }

    if (requestPath === '/api/games' && req.method === 'GET') {
      const viewer = await findSession(req);
      return sendJson(res, 200, { games: await getGames(viewer?.id || null) });
    }

    if (requestPath === '/api/games' && req.method === 'POST') {
      await ensureVenueColumns();
      await ensureGameVenueColumns();
      await ensureLeagueSeriesColumns();
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      const location = String(body.location || '').trim();
      const venueName = String(body.venueName || '').trim();
      const venueAddress = String(body.venueAddress || '').trim();
      const venuePhone = String(body.venuePhone || '').trim();
      const seriesId = String(body.seriesId || '').trim() || null;
      const seriesRound = body.seriesRound ? Number(body.seriesRound) : null;
      const formats = Array.isArray(body.formats) ? [...new Set(body.formats)] : [];
      const formatModes = normalizeFormatModes(body.formatModes, formats);
      const maxParticipants = Number(body.maxParticipants);
      if (!title || !location || !venueName || !venueAddress || !formats.length || !body.scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < 1 || formats.some((format) => !['singles', 'doubles', 'team'].includes(format))) {
        return sendJson(res, 400, { error: '게임 필수정보를 확인해 주세요.' });
      }
      const venueResult = await pool.query(
        `insert into public.venues (name, address, phone, status, created_by)
         values ($1, $2, $3, $4, $5)
         on conflict ((lower(name)), (lower(address)))
         do update set phone = coalesce(excluded.phone, public.venues.phone), updated_at = now()
         returning id`,
        [venueName, venueAddress, venuePhone || null, user.role === 'admin' ? 'approved' : 'pending', user.id]
      );
      const venueId = venueResult.rows[0].id;
      const client = await pool.connect();
      try {
        await client.query('begin');
        let resolvedSeriesRound = Number.isInteger(seriesRound) ? seriesRound : null;
        if (seriesId) {
          const seriesResult = await client.query(
            `select id from public.league_series
              where id = $1 and status = 'active'
                and (owner_id = $2 or exists (select 1 from public.users where id = $2 and role = 'admin'))`,
            [seriesId, user.id]
          );
          if (!seriesResult.rows[0]) {
            await client.query('rollback');
            return sendJson(res, 403, { error: '선택한 정기리그를 사용할 권한이 없습니다.' });
          }
          if (!resolvedSeriesRound) {
            const nextRoundResult = await client.query(
              `select coalesce(max(series_round), 0) + 1 as next_round
                 from public.games
                where series_id = $1 and deleted_at is null`,
              [seriesId]
            );
            resolvedSeriesRound = Number(nextRoundResult.rows[0]?.next_round || 1);
          }
        }
        const gameResult = await client.query(
          `insert into public.games (operator_id, title, location, venue_id, venue_name, venue_address, venue_phone, series_id, series_round, scheduled_at, max_participants, note, format_modes)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning *`,
          [user.id, title, location, venueId, venueName, venueAddress, venuePhone, seriesId, resolvedSeriesRound, body.scheduledAt, maxParticipants, String(body.note || '').trim() || null, JSON.stringify(formatModes)]
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
      await ensureVenueColumns();
      await ensureGameVenueColumns();
      await ensureLeagueSeriesColumns();
      const user = await findSession(req);
      if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const gameId = gameUpdateMatch[1];
      const title = String(body.title || '').trim();
      const location = String(body.location || '').trim();
      const venueName = String(body.venueName || '').trim();
      const venueAddress = String(body.venueAddress || '').trim();
      const venuePhone = String(body.venuePhone || '').trim();
      const seriesId = String(body.seriesId || '').trim() || null;
      const seriesRound = body.seriesRound ? Number(body.seriesRound) : null;
      const formats = Array.isArray(body.formats) ? [...new Set(body.formats)] : [];
      const formatModes = normalizeFormatModes(body.formatModes, formats);
      const maxParticipants = Number(body.maxParticipants);
      if (!title || !location || !venueName || !venueAddress || !formats.length || !body.scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < 1 || formats.some((format) => !['singles', 'doubles', 'team'].includes(format))) {
        return sendJson(res, 400, { error: '게임 필수정보를 확인해 주세요.' });
      }
      const venueResult = await pool.query(
        `insert into public.venues (name, address, phone, status, created_by)
         values ($1, $2, $3, $4, $5)
         on conflict ((lower(name)), (lower(address)))
         do update set phone = coalesce(excluded.phone, public.venues.phone), updated_at = now()
         returning id`,
        [venueName, venueAddress, venuePhone || null, user.role === 'admin' ? 'approved' : 'pending', user.id]
      );
      const venueId = venueResult.rows[0].id;
      const participantCount = await pool.query('select count(*)::int as count from public.registrations where game_id = $1', [gameId]);
      if (maxParticipants < participantCount.rows[0].count) {
        return sendJson(res, 400, { error: `최대참가인원은 현재 참가자 수(${participantCount.rows[0].count}명) 이상이어야 합니다.` });
      }
      const client = await pool.connect();
      try {
        await client.query('begin');
        if (seriesId) {
          const seriesResult = await client.query(
            `select id from public.league_series
              where id = $1 and status = 'active'
                and (owner_id = $2 or exists (select 1 from public.users where id = $2 and role = 'admin'))`,
            [seriesId, user.id]
          );
          if (!seriesResult.rows[0]) {
            await client.query('rollback');
            return sendJson(res, 403, { error: '선택한 정기리그를 사용할 권한이 없습니다.' });
          }
        }
        const gameResult = await client.query(
          `update public.games
              set title = $1, location = $2, venue_id = $3, venue_name = $4, venue_address = $5, venue_phone = $6, series_id = $7, series_round = $8, scheduled_at = $9, max_participants = $10, note = $11, format_modes = $12, updated_at = now()
            where id = $13 and operator_id = $14
            returning id`,
          [title, location, venueId, venueName, venueAddress, venuePhone, seriesId, Number.isInteger(seriesRound) ? seriesRound : null, body.scheduledAt, maxParticipants, String(body.note || '').trim() || null, JSON.stringify(formatModes), gameId, user.id]
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
          const gender = ['male', 'female'].includes(String(row.gender || '').trim()) ? String(row.gender).trim() : null;
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
          const memberResult = memberId
            ? await client.query('select id from public.users where lower(member_id) = lower($1) limit 1', [memberId])
            : { rows: [] };
          const userId = memberResult.rows[0]?.id || null;
          await client.query(
            `insert into public.registrations (game_id, format, user_id, nickname, gender, member_id, rank, team_name, registered_by, registration_source)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'bulk')`,
            [gameId, format, userId, nickname, gender, memberId, rank, teamName || null, user.id]
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
      const gender = String(body.gender || '').trim();
      const rank = String(body.rank || '').trim();
      const teamName = String(body.teamName || '').trim();
      if (!['singles', 'doubles', 'team'].includes(format) || !nickname || !['male', 'female'].includes(gender) || !rank || (format !== 'singles' && !teamName)) {
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
      const memberResult = memberId
        ? await pool.query('select id, gender from public.users where lower(member_id) = lower($1) limit 1', [memberId])
        : { rows: [] };
      const userId = memberResult.rows[0]?.id || null;
      const result = await pool.query(
        `insert into public.registrations (game_id, format, user_id, nickname, gender, member_id, rank, team_name, registered_by, registration_source)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual') returning *`,
        [gameId, format, userId, nickname, memberResult.rows[0]?.gender || gender, memberId || null, rank, teamName || null, user.id]
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
      const gender = String(body.gender || '').trim();
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
      if (!nickname || !['male', 'female'].includes(gender) || !rank || (row.format !== 'singles' && !teamName)) return sendJson(res, 400, { error: '선수명, 성별, 부수와 팀명을 확인해 주세요.' });
      const memberResult = memberId
        ? await pool.query('select id, gender from public.users where lower(member_id) = lower($1) limit 1', [memberId])
        : { rows: [] };
      const userId = memberResult.rows[0]?.id || null;
      const updated = await pool.query(
        `update public.registrations
            set user_id = coalesce($1, user_id), nickname = $2, gender = coalesce($3, gender), member_id = $4, rank = $5, team_name = $6, updated_at = now()
          where id = $7 and game_id = $8
          returning *`,
        [userId, nickname, memberResult.rows[0]?.gender || gender, memberId || null, rank, teamName || null, registrationId, gameId]
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
          `update public.registrations set nickname = $1, gender = $2, member_id = $3, rank = $4, team_name = $5, registration_source = 'online', updated_at = now()
            where id = $6 returning *`,
          [String(body.nickname).trim(), user.gender, String(body.memberId || '').trim() || null, String(body.rank).trim(), String(body.teamName || '').trim() || null, existing.rows[0].id]
        );
      } else {
        result = await pool.query(
          `insert into public.registrations (game_id, format, user_id, nickname, gender, member_id, rank, team_name, registered_by, registration_source)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $3, 'online') returning *`,
          [gameId, format, user.id, String(body.nickname).trim(), user.gender, String(body.memberId || '').trim() || null, String(body.rank).trim(), String(body.teamName || '').trim() || null]
        );
      }
      return sendJson(res, 201, { registration: result.rows[0] });
    }

    if (gameUpdateMatch && req.method === 'DELETE') {
      await ensureGameAccessColumns();
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
