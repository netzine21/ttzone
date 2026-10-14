const crypto = require('node:crypto');

const FORMATS = ['singles', 'doubles', 'team'];
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
function validateToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail(403, '본인 신청 확인 링크가 필요합니다. 저장한 전용 링크로 다시 접속해 주세요.');
  return tokenHash(token);
}
function publicRegistration(row) {
  return { id: row.id, gameId: row.game_id, format: row.format, userId: row.user_id, nickname: row.nickname, gender: row.gender, rank: row.rank, teamName: row.team_name || '', appliedAt: row.applied_at };
}
function assertOpen(game, format) {
  if (game.registration_closed === true || game.registration_closed?.[format] || game.qualifying_groups?.[format]?.groups?.length || game.preliminary_matches?.[format]?.matches?.length || game.tournaments?.[format]) {
    throw fail(400, '선수등록이 마감되었거나 경기 준비가 시작되어 신청·수정·취소할 수 없습니다. 운영자에게 문의해 주세요.');
  }
}

function createParticipantRegistration(pool) {
  let schemaPromise;
  async function ensureSchema() {
    if (!schemaPromise) schemaPromise = pool.query(`alter table public.registrations add column if not exists guest_token_hash text;
      create unique index if not exists registrations_guest_format_key on public.registrations (game_id, format, guest_token_hash) where guest_token_hash is not null`)
      .catch((error) => { schemaPromise = null; throw error; });
    return schemaPromise;
  }
  async function transaction(gameId, action) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query('select * from public.games where id = $1 for update', [gameId]);
      const game = result.rows[0];
      if (!game || game.deleted_at) throw fail(404, '경기를 찾을 수 없습니다.');
      const value = await action(client, game);
      await client.query('commit');
      return value;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }
  async function claim(client, gameId, token, user) {
    const hash = validateToken(token);
    const owned = await client.query('select * from public.registrations where game_id = $1 and guest_token_hash = $2 for update', [gameId, hash]);
    if (!owned.rows.length) throw fail(404, '연결할 비회원 신청이 없습니다. 전용 링크를 확인해 주세요.');
    if (owned.rows.some((row) => row.user_id && row.user_id !== user.id)) throw fail(403, '이미 다른 회원에게 연결된 신청입니다.');
    for (const row of owned.rows) {
      const existing = await client.query('select id from public.registrations where game_id = $1 and format = $2 and user_id = $3', [gameId, row.format, user.id]);
      if (existing.rows.some((item) => item.id !== row.id)) throw fail(409, '이 계정으로 이미 신청한 종목이 있습니다. 운영자에게 신청 정리를 요청해 주세요.');
    }
    const result = await client.query(`update public.registrations set user_id = $3, member_id = $4, registered_by = $3, updated_at = now()
      where game_id = $1 and guest_token_hash = $2 returning *`, [gameId, hash, user.id, user.member_id]);
    return result.rows.map(publicRegistration);
  }
  async function claimAfterSignup(gameId, token, user, client) {
    await ensureSchema();
    if (!/^[0-9a-f-]{36}$/i.test(gameId)) throw fail(400, '신청한 경기 주소를 확인해 주세요.');
    // The caller owns the signup transaction, so account creation and linking are atomic.
    const game = await client.query('select id from public.games where id = $1 and deleted_at is null for update', [gameId]);
    if (!game.rows[0]) throw fail(404, '신청한 경기를 찾을 수 없습니다.');
    return claim(client, gameId, token, user);
  }
  async function handle(req, res, requestPath, { readBody, findSession, sendJson }) {
    const match = requestPath.match(/^\/api\/games\/([^/]+)\/(guest-registrations(?:\/claim)?|registrations(?:\/self)?)$/);
    if (!match || !['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return false;
    const [, gameId, route] = match;
    if (route === 'registrations' && req.method !== 'POST') return false;
    if (route === 'registrations/self' && req.method !== 'DELETE') return false;
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(gameId)) throw fail(400, '경기 주소를 확인해 주세요.');
    await ensureSchema();
    const guest = route.startsWith('guest-');
    const claiming = route.endsWith('/claim');
    if (claiming && req.method !== 'POST') throw fail(405, '지원하지 않는 요청입니다.');
    const user = !guest || claiming ? await findSession(req) : null;
    if ((!guest || claiming) && !user) throw fail(401, '로그인이 필요합니다.');
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const hash = guest ? validateToken(token) : null;
    const body = ['POST', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const payload = await transaction(gameId, async (client, game) => {
      if (claiming) return { registrations: await claim(client, gameId, token, user) };
      const ownQuery = guest
        ? 'select * from public.registrations where game_id = $1 and guest_token_hash = $2'
        : 'select * from public.registrations where game_id = $1 and user_id = $2';
      const owned = await client.query(ownQuery, [gameId, guest ? hash : user.id]);
      if (guest && owned.rows.some((row) => row.user_id)) throw fail(409, '회원으로 연결된 신청입니다. 로그인하여 확인해 주세요.');
      if (req.method === 'GET') return { registrations: owned.rows.map(publicRegistration) };
      const format = String(body.format || '');
      if (!FORMATS.includes(format)) throw fail(400, '경기종목을 선택해 주세요.');
      const available = await client.query('select format from public.game_formats where game_id = $1 and format = $2', [gameId, format]);
      if (!available.rows[0]) throw fail(400, '이 경기에서 진행하지 않는 종목입니다.');
      assertOpen(game, format);
      const existing = owned.rows.find((row) => row.format === format);
      if (req.method === 'DELETE') {
        if (!existing) throw fail(404, '취소할 본인 신청이 없습니다.');
        await client.query('delete from public.registrations where id = $1', [existing.id]);
        return { ok: true, registrationId: existing.id };
      }
      if (req.method === 'PATCH' && !existing) throw fail(404, '수정할 본인 신청이 없습니다.');
      const nickname = String(body.nickname || user?.nickname || '').trim();
      const gender = String(guest ? body.gender || '' : user.gender || '').trim();
      const rank = String(body.rank || user?.rank || '').trim();
      const teamName = String(body.teamName || '').trim();
      if (!nickname || nickname.length > 60 || !['male', 'female'].includes(gender) || !rank || rank.length > 20 || teamName.length > 100 || (format !== 'singles' && !teamName)) throw fail(400, '이름, 성별, 부수와 필요한 팀명을 확인해 주세요.');
      if (!existing) {
        const count = await client.query('select count(*)::int as count from public.registrations where game_id = $1 and format = $2', [gameId, format]);
        if (count.rows[0].count >= game.max_participants) throw fail(409, '해당 종목의 참가 정원이 마감되었습니다.');
      }
      const values = [nickname, gender, rank, teamName || null];
      const result = existing
        ? await client.query('update public.registrations set nickname = $1, gender = $2, rank = $3, team_name = $4, updated_at = now() where id = $5 returning *', [...values, existing.id])
        : await client.query(`insert into public.registrations (nickname, gender, rank, team_name, game_id, format, user_id, member_id, registered_by, registration_source, guest_token_hash)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $7, 'online', $9) returning *`, [...values, gameId, format, user?.id || null, user?.member_id || null, hash]);
      return { registration: publicRegistration(result.rows[0]) };
    });
    sendJson(res, req.method === 'POST' && !claiming ? 201 : 200, payload);
    return true;
  }
  return { handle, claimAfterSignup, ensureSchema };
}
module.exports = { createParticipantRegistration, publicRegistration, assertOpen, validateToken };
