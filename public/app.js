(() => {
  const STORAGE_KEYS = {
    users: 'ttgms:v1:users',
    games: 'ttgms:v1:games',
    session: 'ttgms:v1:session',
  };

  const FORMAT_LABELS = {
    singles: '개인전',
    doubles: '복식',
    team: '단체전',
  };

  const state = {
    users: [],
    games: [],
    sessionUserId: null,
    authTab: 'signup',
    page: 'public',
    selectedPublicGameId: null,
    selectedGameId: null,
    detailTab: 'status',
    statusSubtab: 'info',
    progressSubtab: 'participants',
    statusFormat: null,
    editingGameId: null,
    operationGameId: null,
    operationFormat: null,
    selectedScheduleGroup: null,
    operationTournamentLeague: 'upper',
    tournamentPrintPerPage: 2,
    operationMenu: 'groups',
    operationSubmenu: 'qualifying',
    showCreateGame: false,
    pendingGameId: null,
    signupCompleted: false,
    gameFilter: 'all',
    gamePage: 1,
    flash: null,
  };

  let flashTimer = null;

  const app = document.getElementById('app');
  const topActions = document.getElementById('topActions');
  const mobileMenuActions = document.getElementById('mobileMenuActions');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const brand = document.querySelector('.brand');

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || '서버 요청에 실패했습니다.');
    return payload;
  }

  function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function trimValue(value) {
    return String(value ?? '').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function makeId(prefix) {
    if (window.crypto?.randomUUID) {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  async function hashPassword(password) {
    const source = String(password ?? '');

    if (window.crypto?.subtle && window.isSecureContext) {
      const digest = await window.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(source),
      );

      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }

    return `plain:${source}`;
  }

  async function loadState() {
    try {
      const [session, games] = await Promise.all([
        apiRequest('/api/auth/me'),
        apiRequest('/api/games'),
      ]);
      const currentUser = session.user || null;
      state.users = currentUser ? [currentUser] : [];
      state.games = Array.isArray(games.games) ? games.games : [];
      state.sessionUserId = currentUser?.id || null;
      return;
    } catch {
      // Keep local development usable before the database environment is configured.
    }

    const storedUsers = readJson(STORAGE_KEYS.users, []);
    const storedGames = readJson(STORAGE_KEYS.games, []);
    state.users = Array.isArray(storedUsers) ? storedUsers : [];
    state.games = Array.isArray(storedGames) ? storedGames : [];
    const session = readJson(STORAGE_KEYS.session, null);
    state.sessionUserId = session && typeof session.userId === 'string' ? session.userId : null;

    const existingUser = getCurrentUser();
    if (state.sessionUserId && !existingUser) {
      state.sessionUserId = null;
      writeJson(STORAGE_KEYS.session, null);
    }
  }

  function persistUsers() {
    writeJson(STORAGE_KEYS.users, state.users);
  }

  function persistGames() {
    writeJson(STORAGE_KEYS.games, state.games);
  }

  function persistSession() {
    writeJson(STORAGE_KEYS.session, state.sessionUserId ? { userId: state.sessionUserId } : null);
  }

  function getCurrentUser() {
    return state.users.find((user) => user.id === state.sessionUserId) || null;
  }

  function formatDateTime(value) {
    if (!value) return '미정';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function formatCount(value) {
    return new Intl.NumberFormat('ko-KR').format(value);
  }

  function formatOptional(value) {
    const text = trimValue(value);
    return text ? escapeHtml(text) : '<span class="muted">미입력</span>';
  }

  function getGameParticipants(game) {
    return Array.isArray(game.participants) ? game.participants : [];
  }

  function getGameRegistrations(game, format = null) {
    if (Array.isArray(game.registrations)) {
      const legacyFormat = getGameFormats(game)[0];
      const legacy = getGameParticipants(game).map((participant) => ({ ...participant, format: participant.format || legacyFormat }));
      const knownKeys = new Set(game.registrations.map((registration) => registration.userId || `name:${normalizeParticipantName(registration.nickname)}`));
      const combined = [...game.registrations, ...legacy.filter((participant) => !knownKeys.has(participant.userId || `name:${normalizeParticipantName(participant.nickname)}`))];
      return format ? combined.filter((registration) => registration.format === format) : combined;
    }
    const legacyFormat = getGameFormats(game)[0];
    const legacy = getGameParticipants(game).map((participant) => ({ ...participant, format: legacyFormat }));
    return format ? legacy.filter((registration) => registration.format === format) : legacy;
  }

  function getGameFormats(game) {
    if (Array.isArray(game.formats) && game.formats.length) return game.formats;
    return game.format && FORMAT_LABELS[game.format] ? [game.format] : [];
  }

  function getGameStatus(game) {
    const explicitStatus = String(game.status || '').toLowerCase();
    if (explicitStatus === 'completed' || game.completedAt) return { key: 'done', label: '종료' };

    const preliminaryMatches = Object.values(game.preliminaryMatches || {})
      .flatMap((schedule) => Array.isArray(schedule?.matches) ? schedule.matches : []);
    const tournamentMatches = Object.values(game.tournaments || {})
      .flatMap((tournament) => ['upper', 'lower'].flatMap((league) => tournament?.[league]?.rounds?.flat() || []));
    const allMatches = [...preliminaryMatches, ...tournamentMatches];
    if (allMatches.length && allMatches.every((match) => match.result?.winner && match.result?.score)) {
      return { key: 'done', label: '종료' };
    }

    if (explicitStatus === 'in_progress') return { key: 'progress', label: '진행중' };

    const formats = getGameFormats(game);
    const isFull = formats.length > 0 && formats.every((format) => getGameRegistrations(game, format).length >= Number(game.maxParticipants || 0));
    const scheduledAt = new Date(game.scheduledAt).getTime();
    if (Number.isFinite(scheduledAt) && scheduledAt <= Date.now()) return { key: 'progress', label: '진행중' };
    if (isFull) return { key: 'closed', label: '접수마감' };
    return { key: 'open', label: '참가접수중' };
  }

  function hasJoined(game, userId) {
    return getGameRegistrations(game).some((participant) => participant.userId === userId);
  }

  function normalizeParticipantName(value) {
    return trimValue(value).replace(/\s+/g, '').toLowerCase();
  }

  function parseDelimitedLine(line, delimiter) {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const nextCharacter = line[index + 1];
      if (character === '"' && quoted && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        cells.push(trimValue(cell));
        cell = '';
      } else {
        cell += character;
      }
    }
    cells.push(trimValue(cell));
    return cells;
  }

  function parseRosterText(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const rows = lines.map((line) => parseDelimitedLine(line, delimiter));
    const header = rows[0].map((cell) => normalizeParticipantName(cell));
    const nicknameIndex = header.findIndex((cell) => ['닉네임', '선수명', '이름', 'name', 'nickname'].includes(cell));
    const memberIdIndex = header.findIndex((cell) => ['아이디', 'id', 'memberid'].includes(cell));
    const rankIndex = header.findIndex((cell) => ['부수', 'rank'].includes(cell));
    const teamNameIndex = header.findIndex((cell) => ['팀명', 'team', 'teamname'].includes(cell));
    const hasHeader = nicknameIndex >= 0;
    const dataRows = hasHeader ? rows.slice(1) : rows;
    return dataRows.map((row) => ({
      nickname: trimValue(row[hasHeader ? nicknameIndex : 0]),
      memberId: hasHeader && memberIdIndex >= 0 ? trimValue(row[memberIdIndex]) : '',
      rank: hasHeader && rankIndex >= 0 ? trimValue(row[rankIndex]) : '',
      teamName: hasHeader && teamNameIndex >= 0 ? trimValue(row[teamNameIndex]) : '',
    }));
  }

  function downloadRosterTemplate() {
    const csv = '\uFEFF팀명,닉네임,아이디,부수\n탁구팀A,홍길동,hong123,3부\n,김탁구,,4부\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '참가선수명부_양식.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function getFlashClass(type) {
    if (type === 'success') return 'flash--success';
    if (type === 'error') return 'flash--error';
    return 'flash--info';
  }

  function setFlash(message, type = 'info') {
    state.flash = {
      id: Date.now(),
      message,
      type,
    };

    if (flashTimer) {
      window.clearTimeout(flashTimer);
    }

    const flashId = state.flash.id;
    flashTimer = window.setTimeout(() => {
      if (state.flash && state.flash.id === flashId) {
        state.flash = null;
        render();
      }
    }, 3200);
  }

  function clearFlash() {
    state.flash = null;
    if (flashTimer) {
      window.clearTimeout(flashTimer);
      flashTimer = null;
    }
  }

  function saveAll() {
    persistUsers();
    persistGames();
    persistSession();
  }

  function renderFlash() {
    if (!state.flash) return '';
    return `
      <div class="flash ${getFlashClass(state.flash.type)}" role="status">
        ${escapeHtml(state.flash.message)}
      </div>
    `;
  }

  function renderAuthTab() {
    if (state.authTab === 'login') {
      return `
        <form class="form-stack auth-login-form" data-form="login">
          <div class="field">
            <label for="loginMemberId">아이디</label>
            <input id="loginMemberId" name="memberId" type="text" autocomplete="username" required placeholder="아이디" />
          </div>
          <div class="field">
            <label for="loginPassword">비밀번호</label>
            <input id="loginPassword" name="password" type="password" autocomplete="current-password" required placeholder="비밀번호" />
          </div>
          <label class="check-line login-remember"><input type="checkbox" name="remember" /> 로그인 상태 유지</label>
          <div class="button-row">
            <button class="btn btn-primary" type="submit">로그인</button>
          </div>
        </form>
      `;
    }

    return `
      <form class="form-stack" data-form="signup" novalidate>
        <div class="field">
          <label for="signupNickname">이름(닉네임) <span class="field-requirement field-requirement--required">필수</span></label>
          <input id="signupNickname" name="nickname" type="text" autocomplete="nickname" required placeholder="표시될 이름 또는 닉네임" />
        </div>
        <div class="field">
          <label for="signupMemberId">ID <span class="field-requirement field-requirement--required">필수</span></label>
          <input id="signupMemberId" name="memberId" type="text" autocomplete="username" required placeholder="로그인 아이디" />
        </div>
        <div class="field">
          <label for="signupPassword">비밀번호 <span class="field-requirement field-requirement--required">필수</span></label>
          <input id="signupPassword" name="password" type="password" autocomplete="new-password" required placeholder="비밀번호" />
        </div>
        <div class="field">
          <label>성별 <span class="field-requirement field-requirement--required">필수</span></label>
          <div class="choice-row">
            <label class="choice-option"><input type="radio" name="gender" value="male" required /> 남자</label>
            <label class="choice-option"><input type="radio" name="gender" value="female" required /> 여자</label>
          </div>
        </div>
        <div class="field">
          <label for="signupRank">통합부수 <span class="field-requirement field-requirement--required">필수</span></label>
          <input id="signupRank" name="rank" type="text" autocomplete="off" required placeholder="예: 1부, 2부, 3부" />
        </div>
        <div class="field">
          <label for="signupPhone">휴대폰번호 <span class="field-requirement field-requirement--required">필수</span></label>
          <input id="signupPhone" name="phone" type="tel" autocomplete="tel" required placeholder="예: 010-1234-5678" />
        </div>
        <div class="field">
          <label for="signupRegion">활동지역 <span class="field-requirement field-requirement--optional">선택</span></label>
          <input id="signupRegion" name="region" type="text" autocomplete="address-level2" placeholder="예: 서울 강남 / 경기 분당" />
        </div>
        <div class="field">
          <label for="signupAddress">주소 <span class="field-requirement field-requirement--optional">선택</span></label>
          <input id="signupAddress" name="address" type="text" autocomplete="street-address" placeholder="주소를 입력하세요" />
        </div>
        <div class="helper-row">
          <span>필수 항목을 모두 입력해야 가입할 수 있습니다.</span>
          <span>활동지역과 주소는 선택 입력입니다.</span>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" type="submit">회원가입</button>
        </div>
      </form>
    `;
  }

  function renderAuthPage() {
    const isLogin = state.authTab === 'login';
    return `
      <section class="auth-simple">
        <div class="panel auth-simple__card">
          <h1>${isLogin ? '로그인' : '회원가입'}</h1>
          ${renderAuthTab()}
          <button type="button" class="btn btn-ghost auth-simple__back" data-open-public>게임목록으로 돌아가기</button>
        </div>
      </section>
    `;
  }

  function renderSignupSuccess() {
    return `
      <section class="auth-simple">
        <button type="button" class="panel signup-success" data-home-after-signup>
          <span class="signup-success__mark">✓</span>
          <strong>회원가입이 완료되었습니다.</strong>
          <span>이 내용을 클릭하면 초기 화면으로 이동합니다.</span>
        </button>
      </section>
    `;
  }

  function renderMetricCard(label, value) {
    return `
      <article class="metric-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }

  function renderProfileGrid(user) {
    return `
      <div class="profile-grid">
        <div class="profile-item">
          <span>닉네임</span>
          <strong>${escapeHtml(user.nickname)}</strong>
        </div>
        <div class="profile-item">
          <span>ID</span>
          <strong>${escapeHtml(user.memberId)}</strong>
        </div>
        <div class="profile-item">
          <span>휴대폰</span>
          <strong>${escapeHtml(user.phone)}</strong>
        </div>
        <div class="profile-item">
          <span>활동지역</span>
          <strong>${formatOptional(user.region)}</strong>
        </div>
        <div class="profile-item">
          <span>탁구부수</span>
          <strong>${formatOptional(user.rank)}</strong>
        </div>
      </div>
    `;
  }

  function renderGameCard(game, currentUser, isPublic = false) {
    const gameStatus = getGameStatus(game);
    return `
      <article class="game-card game-list-item" data-game-open="${escapeHtml(game.id)}">
        <div class="game-list-item__body"><div class="game-list-item__title-row"><span class="game-status game-status--${gameStatus.key}">${gameStatus.label}</span><h3 class="game-title-link" data-game-open="${escapeHtml(game.id)}">${escapeHtml(game.title)}</h3></div><time class="game-list-item__date" datetime="${escapeHtml(game.scheduledAt)}">${escapeHtml(formatDateTime(game.scheduledAt))}</time></div>
      </article>
    `;
  }

  function renderPublicGamesPage() {
    const games = state.games
      .slice()
      .sort((left, right) => new Date(left.scheduledAt) - new Date(right.scheduledAt));
    const gameList = games.length
      ? games.map((game) => renderGameCard(game, null, true)).join('')
      : '<div class="empty-state">아직 생성된 게임이 없습니다. 운영자가 게임을 생성하면 이곳에 표시됩니다.</div>';

    return `
      <section class="panel section-card">
        <div class="section-heading public-game-list-heading">
          <div>
            <h2>공개 게임목록 <span class="public-game-list-count">· ${formatCount(games.length)}개 게임</span></h2>
          </div>
        </div>
        <div class="game-list">${gameList}</div>
      </section>
    `;
  }

  function renderDetailTabs() {
    const tabs = [['status', '경기요강'], ['progress', '경기진행현황']];
    return `<div class="detail-tabs" role="tablist" aria-label="게임 상세 메뉴">${tabs.map(([value, label]) => `<button type="button" class="detail-tab ${state.detailTab === value ? 'is-active' : ''}" data-detail-tab="${value}">${label}</button>`).join('')}</div>`;
  }

  function getPublicFormat(game) {
    const formats = getGameFormats(game);
    return formats.includes(state.statusFormat) ? state.statusFormat : formats[0];
  }

  function renderGameRules(game, currentUser) {
    const operator = state.users.find((user) => user.id === game.operatorId);
    const formats = getGameFormats(game);
    const hasAppliedAllFormats = currentUser && formats.length > 0 && formats.every((format) => getGameRegistrations(game, format).some((registration) => registration.userId === currentUser.id));
    const applyAction = hasAppliedAllFormats ? '' : `<div class="public-apply-action"><button type="button" class="btn btn-primary" data-game-apply="${escapeHtml(game.id)}">참가신청</button></div>`;
    return `<dl class="meta-grid public-detail-meta"><div><dt>게임장소</dt><dd>${escapeHtml(game.location)}</dd></div><div><dt>게임일시</dt><dd>${escapeHtml(formatDateTime(game.scheduledAt))}</dd></div><div><dt>운영자</dt><dd>${escapeHtml(game.operatorNickname)}</dd></div><div><dt>운영자 휴대폰</dt><dd>${escapeHtml(operator?.phone || '미입력')}</dd></div><div><dt>경기방식</dt><dd>${formats.map((format) => escapeHtml(FORMAT_LABELS[format])).join(' · ')}</dd></div><div><dt>최대참가인원</dt><dd>${escapeHtml(String(game.maxParticipants))}명</dd></div></dl><div class="public-detail-note"><p class="section-kicker">경기요강 안내</p><p>${game.note ? escapeHtml(game.note) : '<span class="muted">추가 안내가 없습니다.</span>'}</p></div>${applyAction}`;
  }

  function getPublicGroupStandings(game, format) {
    return getQualifyingStandings(game, format).reduce((map, group) => {
      map.set(group.name, new Map(group.standings.map((record) => [record.player.playerKey, record])));
      return map;
    }, new Map());
  }

  function renderPublicGroupParticipants(game, format) {
    const groups = game.qualifyingGroups?.[format]?.groups || [];
    if (!groups.length) return '<div class="empty-state">아직 조편성이 생성되지 않았습니다.</div>';
    const standings = getPublicGroupStandings(game, format);
    return `<div class="public-group-grid">${groups.map((group) => `<section class="public-group-card"><div class="public-group-card__heading"><h3>${escapeHtml(group.name)}</h3><span>${group.players.length}명/팀</span></div><div class="schedule-table-wrap"><table class="public-data-table"><thead><tr><th>순위</th><th>이름</th><th>부수</th><th>소속팀</th></tr></thead><tbody>${group.players.flatMap((unit) => { const record = standings.get(group.name)?.get(unit.playerKey); const rank = record?.rank || ''; const members = unit.members?.length ? unit.members : [unit]; const teamName = format === 'singles' ? unit.teamName || unit.members?.[0]?.teamName || '-' : unit.label || unit.teamName || '-'; return members.map((member) => `<tr class="rank-row rank-row--${rank || 'pending'}"><td><span class="rank-badge rank-badge--${rank || 'pending'}">${rank || '-'}</span></td><td>${escapeHtml(member.nickname || unit.nickname || unit.label)}</td><td>${escapeHtml(member.rank || unit.rank || '-')}</td><td>${escapeHtml(teamName)}</td></tr>`); }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }

  function renderPublicParticipantList(game, format) {
    const registrations = getGameRegistrations(game, format);
    if (!registrations.length) return '<div class="empty-state">아직 참가신청한 회원이 없습니다.</div>';
    return `<div class="schedule-table-wrap"><table class="public-data-table public-participant-table"><thead><tr><th>소속팀</th><th>참가자 이름</th><th>부수</th></tr></thead><tbody>${registrations.map((participant) => `<tr><td>${escapeHtml(participant.teamName || '-')}</td><td>${escapeHtml(participant.nickname || '-')}</td><td>${escapeHtml(participant.rank || '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderPublicLeagueStandings(game, format) {
    const groups = game.qualifyingGroups?.[format]?.groups || [];
    if (!groups.length) return '<div class="empty-state">아직 예선 리그전 조편성이 생성되지 않았습니다.</div>';
    const standingGroups = new Map(getQualifyingStandings(game, format).map((group) => [group.name, group]));
    const maxPlayers = Math.max(...groups.map((group) => group.players.length));
    return `<div class="schedule-table-wrap"><table class="public-league-summary"><tbody>${groups.map((group) => { const standingGroup = standingGroups.get(group.name); const complete = Boolean(standingGroup?.complete); const participantCells = group.players.map((unit) => { const record = standingGroup?.standings.find((item) => item.player.playerKey === unit.playerKey); const rank = complete ? record?.rank : null; const members = unit.members?.length ? unit.members : [unit]; const names = members.map((member) => escapeHtml(member.nickname || unit.nickname || unit.label)).join(', '); const ranks = members.map((member) => escapeHtml(member.rank || unit.rank || '-')).join(', '); const team = format === 'singles' ? unit.teamName || unit.members?.[0]?.teamName || '-' : unit.label || unit.teamName || '-'; return `<td class="public-league-participant"><div class="public-league-entry rank-row rank-row--${rank || 'pending'}"><div><strong>${names}</strong><small>부수 ${ranks} · 소속팀 ${escapeHtml(team)}</small></div>${rank ? `<span class="rank-badge rank-badge--${rank}">${rank}위</span>` : ''}</div></td>`; }).join(''); const emptyCells = Array.from({ length: maxPlayers - group.players.length }, () => '<td class="public-league-participant public-league-participant--empty">-</td>').join(''); return `<tr><th class="public-league-summary__group">${escapeHtml(group.name)}</th>${participantCells}${emptyCells}</tr>`; }).join('')}</tbody></table></div>`;
  }

  function renderPublicMatchScheduleTable(game, format) {
    const matches = game.preliminaryMatches?.[format]?.matches || [];
    if (!matches.length) return '<div class="empty-state">아직 예선 리그전 대진표가 생성되지 않았습니다.</div>';
    return `<div class="schedule-table-wrap"><table class="public-data-table"><thead><tr><th>순번</th><th>조</th><th>라운드</th><th>대진</th><th>세트 스코어</th><th>승자</th></tr></thead><tbody>${matches.map((match, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(match.groupName)}</td><td>${match.round}라운드</td><td>${escapeHtml(match.sideA)}<small>vs</small>${escapeHtml(match.sideB)}</td><td>${escapeHtml(match.result?.score || '-')}</td><td>${match.result?.winner === 'A' ? escapeHtml(match.sideA) : match.result?.winner === 'B' ? escapeHtml(match.sideB) : '-'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderBracketRound(round, renderMatch, isFinal = false, title = '', bracketSize = 2, roundIndex = 0) {
    const span = isFinal ? 1 : 2 ** roundIndex;
    const slotCount = isFinal ? 1 : Math.max(1, bracketSize / 4);
    const cards = round.map((match, index) => {
      const localIndex = match.bracketLocalIndex ?? index;
      const card = renderMatch(match);
      return card.replace('class="tournament-match"', `class="tournament-match" style="grid-row: ${localIndex * span + 1} / span ${span}"`);
    }).join('');
    const connectors = !isFinal
      ? Array.from({ length: Math.floor(round.length / 2) }, (_, index) => `<span class="tournament-round__connector" style="grid-row: ${index * 2 * span + 1} / span ${2 * span}"></span>`).join('')
      : '';
    return `<div class="tournament-round${isFinal ? ' tournament-round--final' : ''}">${title ? `<h4>${escapeHtml(title)}</h4>` : ''}<div class="tournament-round__matches" style="--bracket-slots: ${slotCount}">${cards}${connectors}</div></div>`;
  }

  function renderPublicTournamentRound(round, isFinal = false, title = '', bracketSize = 2, roundIndex = 0) {
    return renderBracketRound(round, renderPublicTournamentMatch, isFinal, title, bracketSize, roundIndex);
  }

  function tournamentRoundTitle(bracket, roundIndex, isFinal = false) {
    return isFinal ? '결승' : `${bracket.size / (2 ** roundIndex)}강`;
  }

  function renderPublicTournamentBracket(bracket) {
    if (!bracket?.rounds?.length) return '<div class="empty-state">아직 토너먼트 대진표가 생성되지 않았습니다.</div>';
    syncTournamentBracket(bracket);
    if (bracket.rounds.length === 1) return `<div class="tournament-bracket public-tournament-bracket tournament-bracket--size-${bracket.size}"><div class="tournament-rounds tournament-rounds--single">${renderPublicTournamentRound(bracket.rounds[0], true, tournamentRoundTitle(bracket, 0, true), bracket.size, 0)}</div></div>${renderTournamentPodium(bracket)}`;
    const roundsBeforeFinal = bracket.rounds.slice(0, -1);
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const leftRounds = roundsBeforeFinal.map((round) => round.slice(0, Math.ceil(round.length / 2)).map((match, index) => ({ ...match, bracketLocalIndex: index })));
    const rightRounds = roundsBeforeFinal.map((round) => round.slice(Math.ceil(round.length / 2)).reverse().map((match, index) => ({ ...match, bracketLocalIndex: index })));
    return `<div class="tournament-bracket public-tournament-bracket tournament-bracket--size-${bracket.size} tournament-bracket--split"><div class="tournament-side-bracket tournament-side-bracket--left">${leftRounds.map((round, index) => renderPublicTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div><div class="tournament-center-bracket">${renderPublicTournamentRound(finalRound, true, tournamentRoundTitle(bracket, bracket.rounds.length - 1, true), bracket.size, bracket.rounds.length - 1)}</div><div class="tournament-side-bracket tournament-side-bracket--right">${rightRounds.map((round, index) => renderPublicTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div></div>${renderTournamentPodium(bracket)}`;
  }

  function renderCompetitionView(game, format) {
    const progressSubtab = ['participants', 'league', 'tournament'].includes(state.progressSubtab) ? state.progressSubtab : 'participants';
    const config = getTournamentConfig(game, format);
    const progressTabs = [['participants', '참가자 목록'], ['league', '리그전'], ['tournament', '토너먼트']];
    const progressContent = progressSubtab === 'participants' ? `<h3>${escapeHtml(FORMAT_LABELS[format])} 참가자 목록</h3>${renderPublicParticipantList(game, format)}` : progressSubtab === 'league' ? `<h3>${escapeHtml(FORMAT_LABELS[format])} 리그전</h3>${renderPublicLeagueStandings(game, format)}` : `<h3>${escapeHtml(FORMAT_LABELS[format])} 토너먼트</h3>${config?.upper ? `<h4>상위리그</h4>${renderPublicTournamentBracket(config.upper)}` : ''}${config?.lower ? `<h4>하위리그</h4>${renderPublicTournamentBracket(config.lower)}` : (!config ? '<div class="empty-state">아직 본선 토너먼트가 생성되지 않았습니다.</div>' : '')}`;
    return `<div class="competition-view"><div class="format-selector" role="tablist" aria-label="경기종목">${getGameFormats(game).map((item) => `<button type="button" class="format-selector__item ${item === format ? 'is-active' : ''}" data-status-format="${escapeHtml(item)}">${escapeHtml(FORMAT_LABELS[item])}</button>`).join('')}</div><div class="competition-subtabs competition-progress__tabs" role="tablist" aria-label="경기진행 메뉴">${progressTabs.map(([value, label]) => `<button type="button" class="detail-tab ${progressSubtab === value ? 'is-active' : ''}" data-status-progress="${value}">${label}</button>`).join('')}</div>${progressContent}</div>`;
  }
  function renderApplicationsView(game, currentUser) {
    if (!currentUser) return `<div class="public-apply-cta"><p>신청조회·수정 및 참가신청은 로그인 후 이용할 수 있습니다.</p><button type="button" class="btn btn-primary" data-game-apply="${escapeHtml(game.id)}">로그인하고 참가신청</button></div>`;
    const formats = getGameFormats(game);
    return `<div class="application-view"><p class="subtle-note">현재 로그인한 회원의 신청내역을 확인하고 경기종목별 신청내용을 수정할 수 있습니다.</p>${renderMyApplications(game, currentUser)}<div class="format-registration-list">${formats.map((format) => `<section class="format-registration-card"><div class="format-registration-heading"><h3>${escapeHtml(FORMAT_LABELS[format])} 참가신청</h3><span class="subtle-note">${getGameRegistrations(game, format).length} / ${game.maxParticipants}명</span></div>${renderRegistrationForm(game, currentUser, format)}</section>`).join('')}</div></div>`;
  }

  function renderGameScheduleView(game, format) {
    return `<div class="public-schedule-view"><h3>${escapeHtml(FORMAT_LABELS[format])} 경기일정</h3>${renderPublicMatchScheduleTable(game, format)}${getTournamentConfig(game, format)?.upper ? `<h4>상위리그 토너먼트</h4>${renderPublicTournamentBracket(getTournamentConfig(game, format).upper)}` : ''}${getTournamentConfig(game, format)?.lower ? `<h4>하위리그 토너먼트</h4>${renderPublicTournamentBracket(getTournamentConfig(game, format).lower)}` : ''}</div>`;
  }

  function renderGameDetailView(game, currentUser) {
    const formats = getGameFormats(game);
    const format = getPublicFormat(game);
    const isOwner = currentUser && game.operatorId === currentUser.id;
    return `<section class="panel section-card public-game-detail"><div class="section-heading"><div><button type="button" class="btn btn-ghost" ${currentUser ? 'data-back-games' : 'data-public-back'}>게임 목록으로</button><h1 class="game-detail-title">${escapeHtml(game.title)}</h1></div>${isOwner ? `<div class="button-row"><button type="button" class="btn btn-primary" data-open-operations="${escapeHtml(game.id)}">경기운영</button><button type="button" class="btn btn-secondary" data-edit-game="${escapeHtml(game.id)}">게임 수정</button></div>` : ''}</div>${renderDetailTabs()}${state.detailTab === 'status' ? renderGameRules(game, currentUser) : ''}${state.detailTab === 'progress' ? renderCompetitionView(game, format) : ''}${state.detailTab === 'applications' ? renderApplicationsView(game, currentUser) : ''}</section>`;
  }

  function renderPublicGameDetail(game) {
    return renderGameDetailView(game, getCurrentUser());
  }

  function renderRegistrationForm(game, currentUser, format) {
    const registration = getGameRegistrations(game, format).find((item) => item.userId === currentUser.id);
    const isFull = getGameRegistrations(game, format).length >= game.maxParticipants;
    const requiresTeam = format !== 'singles';
    return `
      <form class="registration-form" data-form="game-apply" data-game-id="${escapeHtml(game.id)}" data-format="${escapeHtml(format)}">
        <div class="registration-fields">
          ${requiresTeam ? `<div class="field"><label for="team-${escapeHtml(format)}">팀명</label><input id="team-${escapeHtml(format)}" name="teamName" type="text" ${registration ? `value="${escapeHtml(registration.teamName || '')}"` : 'required'} placeholder="팀명을 입력하세요" /></div>` : ''}
          <div class="field"><label for="name-${escapeHtml(format)}">이름</label><input id="name-${escapeHtml(format)}" name="nickname" type="text" required value="${escapeHtml(registration?.nickname || currentUser.nickname)}" /></div>
          <div class="field"><label for="member-id-${escapeHtml(format)}">ID <span class="optional-label">(선택)</span></label><input id="member-id-${escapeHtml(format)}" name="memberId" type="text" value="${escapeHtml(registration?.memberId || currentUser.memberId || '')}" placeholder="없으면 비워두세요" /></div>
          <div class="field"><label for="rank-${escapeHtml(format)}">부수</label><input id="rank-${escapeHtml(format)}" name="rank" type="text" required value="${escapeHtml(registration?.rank || currentUser.rank || '')}" placeholder="예: 3부" /></div>
        </div>
        <button class="btn btn-primary" type="submit" ${isFull && !registration ? 'disabled' : ''}>${registration ? '신청 내용 수정 저장' : isFull ? '정원 마감' : '참가신청'}</button>
      </form>
    `;
  }

  function renderParticipantStatus(game, format) {
    const registrations = getGameRegistrations(game, format);
    if (!registrations.length) return '<p class="muted">아직 참가신청자가 없습니다.</p>';

    if (format === 'team') {
      const teams = new Map();
      registrations.forEach((registration) => {
        const teamName = registration.teamName || '팀명 미입력';
        if (!teams.has(teamName)) teams.set(teamName, []);
        teams.get(teamName).push(registration);
      });
      return `<div class="team-list">${Array.from(teams.entries()).map(([teamName, members]) => `
        <div class="team-card">
          <div class="team-card__heading"><strong>${escapeHtml(teamName)}</strong><span>${escapeHtml(String(members.length))}명</span></div>
          <div class="team-members">${members.map((member) => `<span class="participant-chip">${escapeHtml(member.nickname)}${member.rank ? ` · ${escapeHtml(member.rank)}` : ''}</span>`).join('')}</div>
        </div>
      `).join('')}</div>`;
    }

    return `<div class="participant-chip-list">${registrations.map((participant) => `<span class="participant-chip">${escapeHtml(participant.nickname)}${participant.rank ? ` · ${escapeHtml(participant.rank)}` : ''}</span>`).join('')}</div>`;
  }

  function renderParticipantStatusPanels(game, formats) {
    return `<div class="participant-status-list">${formats.map((format) => `
      <section class="participant-status-card">
        <div class="format-registration-heading"><h3>${escapeHtml(FORMAT_LABELS[format])}</h3><span class="subtle-note">${escapeHtml(String(getGameRegistrations(game, format).length))} / ${escapeHtml(String(game.maxParticipants))}명</span></div>
        ${renderParticipantStatus(game, format)}
      </section>
    `).join('')}</div>`;
  }

  function renderMyApplications(game, currentUser) {
    const registrations = getGameRegistrations(game).filter((registration) => registration.userId === currentUser.id);
    return `<div class="my-applications">
      <p class="subtle-note">현재 로그인한 회원의 참가신청 내역입니다. 수정하려면 참가신청 탭에서 해당 형식의 내용을 다시 저장하세요.</p>
      ${registrations.length ? registrations.map((registration) => `<div class="application-summary"><strong>${escapeHtml(FORMAT_LABELS[registration.format] || '경기')}</strong><span>${escapeHtml(registration.nickname)}${registration.teamName ? ` · ${escapeHtml(registration.teamName)}` : ''} · ${escapeHtml(registration.rank || '부수 미입력')}</span></div>`).join('') : '<div class="empty-state">아직 참가신청한 내역이 없습니다.</div>'}
    </div>`;
  }

  function renderGamesSection(currentUser) {
    const filteredGames = state.games
      .slice()
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .filter((game) => (state.gameFilter === 'mine' ? game.operatorId === currentUser.id : true));

    const gamesPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(filteredGames.length / gamesPerPage));
    const currentPage = Math.min(Math.max(state.gamePage, 1), totalPages);
    const pageStart = (currentPage - 1) * gamesPerPage;
    const visibleGames = filteredGames.slice(pageStart, pageStart + gamesPerPage);
    const listTitle = state.gameFilter === 'mine' ? '내 게임' : '공개 게임목록';

    const gameList = visibleGames.length
      ? visibleGames.map((game) => renderGameCard(game, currentUser)).join('')
      : `<div class="empty-state">${
          state.gameFilter === 'mine'
            ? '아직 내가 만든 게임이 없습니다. 게임 생성 버튼으로 첫 게임을 등록해 보세요.'
            : '아직 등록된 게임이 없습니다. 지금 바로 첫 게임을 만들어 보세요.'
        }</div>`;

    const pagination = filteredGames.length > gamesPerPage
      ? `<nav class="game-pagination" aria-label="게임 목록 페이지 이동">
          <button type="button" class="game-pagination__button" data-game-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>이전</button>
          <div class="game-pagination__pages">
            ${Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => `<button type="button" class="game-pagination__page ${page === currentPage ? 'is-active' : ''}" data-game-page="${page}" aria-label="${page}페이지" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`).join('')}
          </div>
          <button type="button" class="game-pagination__button" data-game-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>다음</button>
        </nav>`
      : '';

    return `
      <section class="panel section-card">
        <div class="section-heading dashboard-game-list-heading">
          <div>
            <h2>${listTitle} <span class="public-game-list-count">· ${formatCount(filteredGames.length)}개 게임</span></h2>
          </div>
          <div class="game-list-actions" aria-label="게임 목록 작업">
            <button type="button" class="game-list-action game-list-action--primary" data-show-create-game><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>게임 생성</span></button>
            <button type="button" class="game-list-action ${state.gameFilter === 'mine' ? 'is-active' : ''}" data-game-filter="mine" aria-pressed="${state.gameFilter === 'mine'}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-3.3 3.2-5 7-5s6.2 1.7 7 5" /></svg><span>내 게임</span></button>
          </div>
        </div>
        <div class="game-list">
          ${gameList}
        </div>
        ${pagination}
      </section>
    `;
  }

  function renderCreateGameForm() {
    return `
      <section class="panel section-card">
        <div class="section-heading create-game-heading">
          <div>
            <h2>새 게임 생성</h2>
          </div>
          <button type="button" class="create-game-close" aria-label="게임 생성 닫기" data-cancel-create-game><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
        </div>

        <form class="form-stack" data-form="game">
          <div class="field">
            <label for="gameTitle"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5zM14 4v5h5" /></svg>게임명</span></label>
            <input id="gameTitle" name="title" type="text" required />
          </div>

          <div class="field">
            <label for="gameLocation"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg>게임장소</span></label>
            <input id="gameLocation" name="location" type="text" required />
          </div>

          <div class="field">
            <span class="field-label"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4c3 0 5 2 5 5v4M17 20c-3 0-5-2-5-5V9" /><ellipse cx="7" cy="4" rx="3" ry="2" /><ellipse cx="17" cy="20" rx="3" ry="2" /></svg>경기형식</span></span>
            <div class="format-options">
              <label><span>개인전</span><input type="checkbox" name="formats" value="singles" /></label>
              <label><span>복식</span><input type="checkbox" name="formats" value="doubles" /></label>
              <label><span>단체전</span><input type="checkbox" name="formats" value="team" /></label>
            </div>
          </div>

          <div class="field-grid create-game-date-row">
            <div class="field">
              <label for="gameMaxParticipants"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-3.3 3.2-5 7-5s6.2 1.7 7 5" /></svg>최대참가인원</span></label>
              <input id="gameMaxParticipants" name="maxParticipants" type="number" min="1" step="1" required />
            </div>
            <div class="field">
              <label for="gameScheduledAt"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>게임일시</span></label>
              <input id="gameScheduledAt" name="scheduledAt" type="datetime-local" required />
            </div>
          </div>

          <div class="field">
            <label for="gameNote"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>게임안내(선택)</span></label>
            <div class="bullet-textarea"><span aria-hidden="true">•</span><textarea id="gameNote" name="note"></textarea></div>
          </div>

          <div class="button-row">
            <button class="btn btn-primary" type="submit">게임 생성</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderEditGameForm(game) {
    return `
      <section class="panel section-card game-edit">
        <div class="section-heading">
          <div>
            <p class="section-kicker">운영자 전용</p>
            <h2>게임 정보 수정</h2>
            <p>게임명, 장소, 경기형식, 일시, 최대참가인원과 안내문을 수정할 수 있습니다.</p>
          </div>
          <button type="button" class="btn btn-ghost" data-cancel-game-edit>취소</button>
        </div>

        <form class="form-stack" data-form="game-edit" data-game-id="${escapeHtml(game.id)}">
          <div class="field">
            <label for="editGameTitle">게임명</label>
            <input id="editGameTitle" name="title" type="text" required value="${escapeHtml(game.title)}" />
          </div>
          <div class="field">
            <label for="editGameLocation">게임장소</label>
            <input id="editGameLocation" name="location" type="text" required value="${escapeHtml(game.location)}" />
          </div>
          <div class="field-grid">
            <div class="field">
              <span class="field-label">경기형식</span>
              <div class="format-options">
                ${['singles', 'doubles', 'team'].map((format) => `<label><span>${FORMAT_LABELS[format]}</span><input type="checkbox" name="formats" value="${format}" ${getGameFormats(game).includes(format) ? 'checked' : ''} /></label>`).join('')}
              </div>
              <span class="subtle-note">개인전·복식·단체전을 여러 개 선택할 수 있습니다.</span>
            </div>
            <div class="field">
              <label for="editGameMaxParticipants">최대참가인원</label>
              <input id="editGameMaxParticipants" name="maxParticipants" type="number" min="${Math.max(1, getGameParticipants(game).length)}" step="1" required value="${escapeHtml(String(game.maxParticipants))}" />
            </div>
          </div>
          <div class="field">
            <label for="editGameScheduledAt">게임일시</label>
            <input id="editGameScheduledAt" name="scheduledAt" type="datetime-local" required value="${escapeHtml(game.scheduledAt)}" />
          </div>
          <div class="field">
            <label for="editGameNote">게임 안내(선택)</label>
            <textarea id="editGameNote" name="note">${escapeHtml(game.note || '')}</textarea>
          </div>
          <div class="helper-row">
            <span>경기형식: 개인전 · 복식 · 단체전</span>
            <span>현재 참가자 ${escapeHtml(String(getGameParticipants(game).length))}명</span>
          </div>
          <div class="button-row">
            <button class="btn btn-primary" type="submit">수정 내용 저장</button>
          </div>
        </form>
      </section>
    `;
  }

  function shufflePlayers(players) {
    const shuffled = [...players];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function getGroupingUnits(game, format) {
    const registrations = getGameRegistrations(game, format);
    if (format === 'singles') {
      return registrations.map((registration, index) => ({
        playerKey: registration.userId || `${normalizeParticipantName(registration.nickname)}_${index}`,
        label: registration.nickname,
        rank: registration.rank || '',
        teamName: registration.teamName || '',
        members: [registration],
      }));
    }
    const teams = new Map();
    registrations.forEach((registration, index) => {
      const teamName = registration.teamName || `팀명 미입력 ${index + 1}`;
      if (!teams.has(teamName)) teams.set(teamName, []);
      teams.get(teamName).push(registration);
    });
    return Array.from(teams.entries()).map(([teamName, members]) => ({
      playerKey: `team:${normalizeParticipantName(teamName)}`,
      label: teamName,
      members,
    }));
  }

  function buildQualifyingGroups(game, format, groupCount) {
    const units = getGroupingUnits(game, format);
    const count = Math.max(1, Math.min(groupCount, units.length));
    const baseSize = Math.floor(units.length / count);
    const extraUnits = units.length % count;
    const extraGroupIndexes = shufflePlayers([...Array(count).keys()]).slice(0, extraUnits);
    const targetSizes = Array.from({ length: count }, (_, index) => baseSize + (extraGroupIndexes.includes(index) ? 1 : 0));
    const groups = Array.from({ length: count }, (_, index) => ({ name: `${index + 1}조`, players: [] }));
    const players = [...units];

    if (format !== 'singles') {
      const groupOrder = shufflePlayers([...Array(count).keys()]);
      shufflePlayers(players).forEach((player, index) => {
        groups[groupOrder[index % count]].players.push(player);
      });
      return groups;
    }

    const rankCounts = groups.map(() => ({}));
    players.sort((left, right) => (right.rank || '부수 미입력').localeCompare(left.rank || '부수 미입력', 'ko'));
    players.forEach((player) => {
      const rank = player.rank || '부수 미입력';
      const eligibleIndexes = groups.map((group, index) => index).filter((index) => groups[index].players.length < targetSizes[index]);
      const targetIndex = eligibleIndexes.reduce((bestIndex, index) => {
        const group = groups[index];
        const bestRankCount = rankCounts[bestIndex][rank] || 0;
        const rankCount = rankCounts[index][rank] || 0;
        if (rankCount < bestRankCount) return index;
        if (rankCount === bestRankCount && group.players.length < groups[bestIndex].players.length) return index;
        return bestIndex;
      }, eligibleIndexes[0]);
      groups[targetIndex].players.push(player);
      rankCounts[targetIndex][rank] = (rankCounts[targetIndex][rank] || 0) + 1;
    });
    return groups;
  }

  function renderOperationGroups(game, format) {
    const setup = game.qualifyingGroups?.[format];
    if (!setup) return '<div class="empty-state">아직 조편성이 없습니다. 참가자 수에 맞춰 조 수를 입력하고 조편성을 생성하세요.</div>';
    return `<div class="group-list">${setup.groups.map((group) => `
      <section class="qualifying-group">
        <div class="qualifying-group__heading"><h3>${escapeHtml(group.name)}</h3><span>${escapeHtml(String(group.players.length))}명</span></div>
        <div class="group-player-list">${group.players.map((player) => `<div class="group-player-row"><span><strong>${escapeHtml(player.label || player.nickname)}</strong>${player.members?.length > 1 ? ` · ${escapeHtml(String(player.members.length))}명` : player.rank ? ` · ${escapeHtml(player.rank)}` : ''}${player.members?.length > 1 ? `<small>${player.members.map((member) => escapeHtml(member.nickname)).join(', ')}</small>` : ''}</span><select data-group-assignment="${escapeHtml(player.playerKey)}" data-group-format="${escapeHtml(format)}"><option value="">조 선택</option>${setup.groups.map((option) => `<option value="${escapeHtml(option.name)}" ${option.name === group.name ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}</select></div>`).join('')}</div>
      </section>
    `).join('')}</div>`;
  }

  function renderRosterOperationPanel(games, game, formats, format) {
    const registrations = getGameRegistrations(game, format);
    return `
      <div class="roster-operation-panel">
        <div class="operation-controls roster-controls">
          <div class="field"><label for="operationRosterGame">게임</label><select id="operationRosterGame" data-operation-game>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === game.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></div>
          <div class="field"><label for="operationRosterFormat">경기종목</label><select id="operationRosterFormat" data-operation-format data-roster-format="${escapeHtml(game.id)}">${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div>
        </div>
        <div class="roster-import roster-import--standalone">
          <div><p class="section-kicker">운영자 전용</p><h2>참가선수 일괄등록</h2><p>선택한 경기종목의 명부를 CSV 또는 TSV 파일로 업로드하세요. 기존 참가자는 중복 등록되지 않습니다.</p></div>
          <div class="roster-schema"><strong>${escapeHtml(FORMAT_LABELS[format])} 명부 열</strong><span>${format === 'singles' ? '닉네임 또는 선수명, 아이디(선택), 부수' : '팀명, 닉네임 또는 선수명, 아이디(선택), 부수'}</span></div>
          <div class="button-row"><label class="btn btn-primary file-button" for="operationRosterFile">명부 파일 선택</label><input id="operationRosterFile" class="file-input" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" data-roster-upload="${escapeHtml(game.id)}" /><button type="button" class="btn btn-ghost" data-download-roster-template>양식 다운로드</button></div>
          <p class="subtle-note">현재 ${escapeHtml(String(registrations.length))}명(팀) 등록 · 참가형식별로 한 번씩 업로드하세요.</p>
        </div>
      </div>
    `;
  }

  function buildRoundRobinMatches(group, format, groupIndex) {
    const units = group.players || [];
    if (units.length < 2) return [];
    const rotation = [...units];
    if (rotation.length % 2) rotation.push(null);
    const matches = [];
    const rounds = rotation.length - 1;
    for (let round = 0; round < rounds; round += 1) {
      for (let index = 0; index < rotation.length / 2; index += 1) {
        const first = rotation[index];
        const second = rotation[rotation.length - 1 - index];
        if (first && second) {
          matches.push({
            id: makeId('match'),
            groupName: group.name,
            groupIndex,
            round: round + 1,
            format,
            table: `${group.name} 탁구대`,
            sideAKey: first.playerKey,
            sideBKey: second.playerKey,
            sideA: first.label || first.nickname,
            sideB: second.label || second.nickname,
            sideAMembers: first.members?.map((member) => member.nickname) || [first.nickname],
            sideBMembers: second.members?.map((member) => member.nickname) || [second.nickname],
            bestOf: 5,
            pointsToWin: 11,
            result: null,
          });
        }
      }
      const fixed = rotation[0];
      const rest = rotation.slice(1);
      rest.unshift(rest.pop());
      rotation.splice(0, rotation.length, fixed, ...rest);
    }
    return matches;
  }

  function renderScheduleMatrix(group, matches) {
    const units = group.players || [];
    const label = (unit) => unit.label || unit.nickname || '미정';
    const standings = new Map(units.map((unit) => [unit.playerKey, { wins: 0, losses: 0 }]));
    matches.forEach((match) => {
      if (!match.result?.winner) return;
      const winnerKey = match.result.winner === 'A' ? match.sideAKey : match.sideBKey;
      const loserKey = match.result.winner === 'A' ? match.sideBKey : match.sideAKey;
      if (standings.has(winnerKey)) standings.get(winnerKey).wins += 1;
      if (standings.has(loserKey)) standings.get(loserKey).losses += 1;
    });
    const ranking = [...standings.entries()].sort((left, right) => right[1].wins - left[1].wins);
    ranking.forEach(([playerKey, record], index) => { record.rank = record.wins || record.losses ? index + 1 : ''; });
    const findMatch = (left, right) => matches.find((match) => (match.sideAKey === left.playerKey && match.sideBKey === right.playerKey) || (match.sideAKey === right.playerKey && match.sideBKey === left.playerKey) || (!match.sideAKey && ((match.sideA === label(left) && match.sideB === label(right)) || (match.sideA === label(right) && match.sideB === label(left)))));
    const scoreForRow = (match, rowKey) => {
      const scoreParts = String(match.result?.score || '').match(/^(\d+)\s*[-:]\s*(\d+)$/);
      if (!scoreParts) return '';
      return rowKey === match.sideAKey ? scoreParts[1] : scoreParts[2];
    };
    return `<div class="matrix-wrap"><table class="schedule-matrix"><thead><tr><th>대진</th>${units.map((unit) => `<th>${escapeHtml(label(unit))}</th>`).join('')}<th class="record-column">승</th><th class="record-column">패</th><th class="record-column">순위</th></tr></thead><tbody>${units.map((row) => { const record = standings.get(row.playerKey) || { wins: 0, losses: 0, rank: '' }; return `<tr><th>${escapeHtml(label(row))}</th>${units.map((column) => { if (row.playerKey === column.playerKey) return '<td class="matrix-diagonal">-</td>'; const match = findMatch(row, column); const score = match ? scoreForRow(match, row.playerKey) : ''; return `<td>${score ? `<strong>${escapeHtml(score)}</strong>` : '<span class="muted">&nbsp;</span>'}</td>`; }).join('')}<td class="matrix-entry-cell">${record.wins || record.losses ? record.wins : '&nbsp;'}</td><td class="matrix-entry-cell">${record.wins || record.losses ? record.losses : '&nbsp;'}</td><td class="matrix-entry-cell">${record.rank || '&nbsp;'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }

  function renderScheduleResultsTable(matches, editable = true) {
    return `<div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>순번</th><th>라운드</th><th>조 / 탁구대</th><th>대진</th><th>경기규칙</th><th>세트 스코어</th><th>승자</th></tr></thead><tbody>${matches.map((match, index) => `<tr><td>${index + 1}</td><td>${match.round}라운드</td><td>${escapeHtml(match.table)}</td><td><strong>${escapeHtml(match.sideA)}</strong><small>vs</small><strong>${escapeHtml(match.sideB)}</strong></td><td>11점 · 5전 3선승</td><td>${editable ? `<input class="schedule-result-input" data-match-score="${escapeHtml(match.id)}" value="${escapeHtml(match.result?.score || '')}" placeholder="세트 스코어" />` : escapeHtml(match.result?.score || '-')}</td><td>${editable ? `<select data-match-winner="${escapeHtml(match.id)}"><option value="">미입력</option><option value="A" ${match.result?.winner === 'A' ? 'selected' : ''}>${escapeHtml(match.sideA)}</option><option value="B" ${match.result?.winner === 'B' ? 'selected' : ''}>${escapeHtml(match.sideB)}</option></select>` : escapeHtml(match.result?.winner === 'A' ? match.sideA : match.result?.winner === 'B' ? match.sideB : '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderQualifyingStandingsOverview(game, format) {
    const standings = getQualifyingStandings(game, format);
    if (!standings.length) return '';
    return `<section class="qualifying-standings-overview"><div class="group-result-heading"><div><p class="section-kicker">예선 결과</p><h2>조별 순위</h2></div><span class="subtle-note">승수 · 세트 득실 기준</span></div><div class="qualifying-standings-grid">${standings.map((group) => `<section class="qualifying-standings-card"><div class="qualifying-standings-card__heading"><h3>${escapeHtml(group.name)}</h3><span>${group.complete ? '순위 확정' : '결과 입력 중'}</span></div><div class="qualifying-standing-list">${group.standings.map((record) => `<div class="qualifying-standing-row"><span class="rank-badge rank-badge--${record.rank || 'pending'}">${record.rank || '-'}</span><strong>${escapeHtml(tournamentLabel(record.player))}</strong><span class="qualifying-standing-record">${record.wins}승 ${record.losses}패</span></div>`).join('')}</div></section>`).join('')}</div></section>`;
  }

  function renderScheduleOperationPanel(games, game, formats, format, mode = 'generate') {
    const saved = game.preliminaryMatches?.[format];
    const groups = game.qualifyingGroups?.[format]?.groups || [];
    const matches = saved?.matches || [];
    const selectedGroup = groups.find((group) => group.name === state.selectedScheduleGroup) || groups[0];
    const selectedMatches = selectedGroup ? matches.filter((match) => match.groupName === selectedGroup.name) : [];
    const isResultsMode = mode === 'results';
    return `
      <div class="schedule-panel">
        <div class="operation-controls">
          <div class="field"><label for="operationScheduleGame">게임</label><select id="operationScheduleGame" data-operation-game>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === game.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></div>
          <div class="field"><label for="operationScheduleFormat">경기종목</label><select id="operationScheduleFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div>
          ${groups.length ? `<div class="field"><label for="operationScheduleGroup">${isResultsMode ? '경기결과 입력 조' : '출력할 조'}</label><select id="operationScheduleGroup" data-schedule-group>${groups.map((group) => `<option value="${escapeHtml(group.name)}" ${group.name === selectedGroup?.name ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></div>` : ''}
          ${isResultsMode ? '' : '<button type="button" class="btn btn-primary" data-generate-schedule>대진표 자동 생성</button>'}
          ${saved && !isResultsMode ? '<button type="button" class="btn btn-secondary" data-print-schedule>대진표 인쇄</button>' : ''}
        </div>
        <div class="operation-note">${isResultsMode ? '생성된 예선 대진표의 경기 결과를 입력하고 저장합니다. 점수는 11점 5전 3선승 기준입니다.' : '조별 단일리그 대진표를 자동 생성합니다. 같은 조의 선수 또는 팀이 서로 한 번씩 경기하며, 각 조는 해당 조 전용 탁구대를 사용합니다.'}</div>
        ${!groups.length ? '<div class="empty-state">먼저 조편성을 완료해 주세요.</div>' : !saved ? (isResultsMode ? '<div class="empty-state">먼저 예선 대진표 생성 메뉴에서 대진표를 만들어 주세요.</div>' : '<div class="empty-state">대진표 자동 생성 버튼을 눌러 예선리그 대진을 만들어 주세요.</div>') : `${isResultsMode ? renderQualifyingStandingsOverview(game, format) : ''}<div class="schedule-summary"><strong>${escapeHtml(FORMAT_LABELS[format])} ${escapeHtml(selectedGroup.name)} ${isResultsMode ? '경기결과' : '대진표'}</strong><span>${escapeHtml(String(selectedMatches.length))}경기 · ${escapeHtml(String(selectedGroup.players.length))}명/팀</span></div><div class="schedule-group-matrices"><section class="schedule-group-block"><div class="group-result-heading"><h3>${escapeHtml(selectedGroup.name)} ${isResultsMode ? '경기결과 입력' : '대진 매트릭스'}</h3><span class="subtle-note">${escapeHtml(selectedGroup.name)} 탁구대</span></div>${renderScheduleMatrix(selectedGroup, selectedMatches)}<h4 class="schedule-order-title">${escapeHtml(selectedGroup.name)} 경기 진행순서</h4>${renderScheduleResultsTable(selectedMatches, isResultsMode)}</section></div>${isResultsMode ? '<div class="button-row group-save-row"><button type="button" class="btn btn-secondary" data-save-schedule-results>경기결과 저장</button></div>' : ''}`}
      </div>
    `;
  }

  function getQualifyingStandings(game, format) {
    const groups = game.qualifyingGroups?.[format]?.groups || [];
    const matches = game.preliminaryMatches?.[format]?.matches || [];
    return groups.map((group) => {
      const records = new Map((group.players || []).map((player) => [player.playerKey, {
        player,
        wins: 0,
        losses: 0,
        setsFor: 0,
        setsAgainst: 0,
      }]));
      const groupMatches = matches.filter((match) => match.groupName === group.name);
      groupMatches.forEach((match) => {
        const score = String(match.result?.score || '').match(/^(\d+)\s*[-:]\s*(\d+)$/);
        if (!score || !match.result?.winner) return;
        const left = records.get(match.sideAKey);
        const right = records.get(match.sideBKey);
        if (!left || !right) return;
        const leftSets = Number(score[1]);
        const rightSets = Number(score[2]);
        left.setsFor += leftSets;
        left.setsAgainst += rightSets;
        right.setsFor += rightSets;
        right.setsAgainst += leftSets;
        if (match.result.winner === 'A') {
          left.wins += 1;
          right.losses += 1;
        } else {
          right.wins += 1;
          left.losses += 1;
        }
      });
      const standings = [...records.values()].sort((left, right) => right.wins - left.wins || (right.setsFor - right.setsAgainst) - (left.setsFor - left.setsAgainst) || right.setsFor - left.setsFor);
      const complete = groupMatches.length > 0 && groupMatches.every((match) => match.result?.winner && /^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')));
      return { name: group.name, complete, standings: standings.map((record, index) => ({ ...record, rank: complete ? index + 1 : null })) };
    });
  }

  function tournamentLabel(entry) {
    return entry?.label || entry?.nickname || entry?.name || '대기';
  }

  function tournamentTeamLabel(entry, format) {
    return entry?.teamName || entry?.members?.[0]?.teamName || (format !== 'singles' ? entry?.label : '') || '-';
  }

  function tournamentRankLabel(entry) {
    const memberRanks = (entry?.members || []).map((member) => member.rank).filter(Boolean);
    return [...new Set(memberRanks)].join(', ') || entry?.rank || '';
  }

  function renderPublicTournamentMatch(match) {
    return `<div class="tournament-match"><div class="tournament-side ${match.result?.winner === 'A' ? 'is-winner' : ''}"><span>${escapeHtml(tournamentLabel(match.sideA))}</span><strong>${escapeHtml(String(match.result?.score || '').split(/[-:]/)[0] || '')}</strong></div><div class="tournament-side ${match.result?.winner === 'B' ? 'is-winner' : ''}"><span>${escapeHtml(tournamentLabel(match.sideB))}</span><strong>${escapeHtml(String(match.result?.score || '').split(/[-:]/)[1] || '')}</strong></div></div>`;
  }

  function buildTournamentBracket(entries, league, format) {
    if (!entries.length) return null;
    const size = 2 ** Math.ceil(Math.log2(entries.length));
    const halfSize = size / 2;
    const leftEntries = entries.slice(0, Math.ceil(entries.length / 2));
    const rightEntries = entries.slice(Math.ceil(entries.length / 2));
    const slots = [...leftEntries];
    while (slots.length < halfSize) slots.push(null);
    slots.push(...rightEntries);
    while (slots.length < size) slots.push(null);
    const rounds = [];
    const firstRound = [];
    for (let index = 0; index < size / 2; index += 1) {
      const left = slots[index * 2];
      const right = slots[index * 2 + 1];
      firstRound.push({ id: makeId('tmatch'), round: 1, matchIndex: index, sideA: left, sideB: right, result: null });
    }
    rounds.push(firstRound);
    for (let round = 2; round <= Math.log2(size); round += 1) {
      rounds.push(Array.from({ length: size / (2 ** round) }, (_, matchIndex) => ({ id: makeId('tmatch'), round, matchIndex, sideA: null, sideB: null, result: null })));
    }
    if (size === 1) rounds[0][0] = { id: makeId('tmatch'), round: 1, matchIndex: 0, sideA: entries[0], sideB: null, result: null };
    return { league, format, size, entries, rounds, pointsToWin: 11, bestOf: 5, generatedAt: new Date().toISOString() };
  }

  function tournamentWinner(match) {
    if (match.result?.winner === 'A' && match.sideA) return match.sideA;
    if (match.result?.winner === 'B' && match.sideB) return match.sideB;
    if (match.sideA && !match.sideB) return match.sideA;
    if (!match.sideA && match.sideB) return match.sideB;
    return null;
  }

  function tournamentLoser(match) {
    if (match.result?.winner === 'A' && match.sideB) return match.sideB;
    if (match.result?.winner === 'B' && match.sideA) return match.sideA;
    return null;
  }

  function getTournamentPlacements(bracket) {
    syncTournamentBracket(bracket);
    const final = bracket.rounds?.at(-1)?.[0];
    const semifinalRound = bracket.rounds?.length > 1 ? bracket.rounds.at(-2) : [];
    const winner = final ? tournamentWinner(final) : null;
    const runnerUp = final?.result?.winner ? tournamentLoser(final) : null;
    const third = semifinalRound.flatMap((match) => {
      const loser = tournamentLoser(match);
      return loser ? [loser] : [];
    });
    return { winner, runnerUp, third };
  }

  function renderTournamentPodium(bracket) {
    const placements = getTournamentPlacements(bracket);
    const cards = [
      { rank: 1, title: '우승', value: placements.winner ? tournamentLabel(placements.winner) : null, modifier: 'gold' },
      { rank: 2, title: '준우승', value: placements.runnerUp ? tournamentLabel(placements.runnerUp) : null, modifier: 'silver' },
      { rank: 3, title: '3등', value: placements.third.length ? placements.third.map((entry) => tournamentLabel(entry)).join(' · ') : null, modifier: 'bronze' },
    ];
    return `<section class="tournament-podium" aria-label="토너먼트 입상자"><p class="section-kicker">입상 결과</p><div class="tournament-podium__cards">${cards.map((card) => `<div class="tournament-podium__card tournament-podium__card--${card.modifier}"><span class="tournament-podium__medal">${card.rank}</span><div><strong>${card.title}</strong><span>${escapeHtml(card.value || '결정 대기')}</span></div></div>`).join('')}</div>${placements.third.length > 1 ? '<small class="tournament-podium__note">준결승 패배자는 공동 3위로 표시됩니다.</small>' : ''}</section>`;
  }

  function rebalanceTournamentFirstRound(bracket) {
    const firstRound = bracket.rounds?.[0] || [];
    if (!firstRound.length || firstRound.some((match) => match.result?.winner || match.result?.score)) return;
    const entries = (bracket.entries?.length ? bracket.entries : firstRound.flatMap((match) => [match.sideA, match.sideB])).filter(Boolean);
    const size = bracket.size || firstRound.length * 2;
    const halfSize = size / 2;
    const leftEntries = entries.slice(0, Math.ceil(entries.length / 2));
    const rightEntries = entries.slice(Math.ceil(entries.length / 2));
    const slots = [...leftEntries];
    while (slots.length < halfSize) slots.push(null);
    slots.push(...rightEntries);
    while (slots.length < size) slots.push(null);
    firstRound.forEach((match, index) => {
      match.sideA = slots[index * 2] || null;
      match.sideB = slots[index * 2 + 1] || null;
      match.result = null;
      match.sideAKey = match.sideA?.playerKey || '';
      match.sideBKey = match.sideB?.playerKey || '';
    });
    bracket.rounds.slice(1).forEach((round) => round.forEach((match) => {
      match.sideA = null;
      match.sideB = null;
      match.sideAKey = '';
      match.sideBKey = '';
      match.result = null;
    }));
  }

  function syncTournamentBracket(bracket) {
    rebalanceTournamentFirstRound(bracket);
    for (let roundIndex = 1; roundIndex < bracket.rounds.length; roundIndex += 1) {
      const previousRound = bracket.rounds[roundIndex - 1];
      bracket.rounds[roundIndex].forEach((match, matchIndex) => {
        const previousA = previousRound[matchIndex * 2];
        const previousB = previousRound[matchIndex * 2 + 1];
        match.sideA = tournamentWinner(previousA);
        match.sideB = tournamentWinner(previousB);
        if (match.sideAKey !== match.sideA?.playerKey || match.sideBKey !== match.sideB?.playerKey) match.result = null;
        match.sideAKey = match.sideA?.playerKey || '';
        match.sideBKey = match.sideB?.playerKey || '';
      });
    }
  }

  function renderTournamentMatch(match) {
    const labelA = tournamentLabel(match.sideA);
    const labelB = tournamentLabel(match.sideB);
    const playable = match.sideA && match.sideB;
    const scoreParts = String(match.result?.score || '').match(/^(\d+)\s*[-:]\s*(\d+)$/);
    return `<div class="tournament-match"><div class="tournament-side ${match.result?.winner === 'A' ? 'is-winner' : ''}"><span>${escapeHtml(labelA)}</span><strong>${scoreParts ? scoreParts[1] : ''}</strong></div><div class="tournament-side ${match.result?.winner === 'B' ? 'is-winner' : ''}"><span>${escapeHtml(labelB)}</span><strong>${scoreParts ? scoreParts[2] : ''}</strong></div>${playable ? `<div class="tournament-match__input"><input class="schedule-result-input" data-tournament-score="${escapeHtml(match.id)}" value="${escapeHtml(match.result?.score || '')}" placeholder="세트 스코어" /><select data-tournament-winner="${escapeHtml(match.id)}"><option value="">승자 선택</option><option value="A" ${match.result?.winner === 'A' ? 'selected' : ''}>${escapeHtml(labelA)}</option><option value="B" ${match.result?.winner === 'B' ? 'selected' : ''}>${escapeHtml(labelB)}</option></select></div>` : `<small class="tournament-bye-note">${match.sideA || match.sideB ? '부전승' : '진출 대기'}</small>`}</div>`;
  }

  function renderTournamentRound(round, isFinal = false, title = '', bracketSize = 2, roundIndex = 0) {
    return renderBracketRound(round, renderTournamentMatch, isFinal, title, bracketSize, roundIndex);
  }

  function renderTournamentBracket(bracket) {
    syncTournamentBracket(bracket);
    if (bracket.rounds.length === 1) return `<div class="tournament-bracket"><div class="tournament-rounds tournament-rounds--single">${renderTournamentRound(bracket.rounds[0], true, tournamentRoundTitle(bracket, 0, true), bracket.size, 0)}</div><p class="subtle-note">부전승은 자동 진출하며, 경기는 11점 5전 3선승입니다.</p></div>${renderTournamentPodium(bracket)}`;
    const roundsBeforeFinal = bracket.rounds.slice(0, -1);
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const leftRounds = roundsBeforeFinal.map((round) => round.slice(0, Math.ceil(round.length / 2)).map((match, index) => ({ ...match, bracketLocalIndex: index })));
    const rightRounds = roundsBeforeFinal.map((round) => round.slice(Math.ceil(round.length / 2)).reverse().map((match, index) => ({ ...match, bracketLocalIndex: index })));
    return `<div class="tournament-bracket tournament-bracket--split tournament-bracket--size-${bracket.size}"><div class="tournament-side-bracket tournament-side-bracket--left">${leftRounds.map((round, index) => renderTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div><div class="tournament-center-bracket">${renderTournamentRound(finalRound, true, tournamentRoundTitle(bracket, bracket.rounds.length - 1, true), bracket.size, bracket.rounds.length - 1)}</div><div class="tournament-side-bracket tournament-side-bracket--right">${rightRounds.map((round, index) => renderTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div><p class="subtle-note tournament-bracket__note">좌·우측 각 라운드의 승자가 중앙 결승으로 진출합니다. 부전승은 자동 진출하며, 경기는 11점 5전 3선승입니다.</p></div>${renderTournamentPodium(bracket)}`;
  }

  function getTournamentPrintableRound(bracket) {
    if (!bracket?.rounds?.length) return null;
    syncTournamentBracket(bracket);
    for (let index = 0; index < bracket.rounds.length; index += 1) {
      const matches = bracket.rounds[index].filter((match) => match.sideA && match.sideB);
      const pendingMatches = matches.filter((match) => !match.result?.winner);
      if (pendingMatches.length) return { roundIndex: index, matches: pendingMatches };
    }
    return null;
  }

  function renderTournamentPrintSheet(bracket, format, league) {
    const printable = getTournamentPrintableRound(bracket);
    if (!printable) return '<div class="empty-state">모든 토너먼트 경기가 종료되었습니다.</div>';
    const roundTitle = tournamentRoundTitle(bracket, printable.roundIndex, printable.roundIndex === bracket.rounds.length - 1);
    const printRoundTitle = roundTitle.endsWith('강') ? `(${roundTitle.slice(0, -1)})강` : roundTitle;
    const printPerPage = [1, 2, 4].includes(Number(state.tournamentPrintPerPage)) ? Number(state.tournamentPrintPerPage) : 2;
    return `<div class="tournament-print-sheet-list tournament-print-sheet-list--${printPerPage}">${printable.matches.map((match) => { const rankA = tournamentRankLabel(match.sideA); const rankB = tournamentRankLabel(match.sideB); return `<section class="tournament-print-sheet"><div class="tournament-print-sheet__title">${league === 'lower' ? '하위리그' : '상위리그'} · ${escapeHtml(printRoundTitle)} 토너먼트 대진표</div><div class="tournament-print-sheet__players"><div class="tournament-print-sheet__players-label">선수이름</div><div><strong>${escapeHtml(tournamentLabel(match.sideA))}${rankA ? ` (${escapeHtml(rankA)})` : ''}</strong><span>[${escapeHtml(tournamentTeamLabel(match.sideA, format))}]</span></div><div><strong>${escapeHtml(tournamentLabel(match.sideB))}${rankB ? ` (${escapeHtml(rankB)})` : ''}</strong><span>[${escapeHtml(tournamentTeamLabel(match.sideB, format))}]</span></div></div><div class="tournament-print-sheet__result-row"><div>경기결과</div><div></div><div></div></div><table class="tournament-print-score-table"><colgroup><col style="width: 8%" /><col style="width: 8%" /><col style="width: 42%" /><col style="width: 42%" /></colgroup><tbody><tr><th rowspan="5">Set<br />점수</th><th>1Set</th><td></td><td></td></tr>${Array.from({ length: 4 }, (_, index) => `<tr><th>${index + 2}Set</th><td></td><td></td></tr>`).join('')}</tbody></table></section>`; }).join('')}</div>`;
  }

  function renderTournamentPrintPanel(games, game, formats, format) {
    const config = getTournamentConfig(game, format);
    const availableLeagues = config ? ['upper', 'lower'] : [];
    const league = availableLeagues.includes(state.operationTournamentLeague) ? state.operationTournamentLeague : availableLeagues[0];
    const bracket = config?.[league];
    const printPerPage = [1, 2, 4].includes(Number(state.tournamentPrintPerPage)) ? Number(state.tournamentPrintPerPage) : 2;
    return `<div class="tournament-print-panel"><div class="operation-controls tournament-controls"><div class="field"><label for="operationTournamentPrintGame">게임</label><select id="operationTournamentPrintGame" data-operation-game>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === game.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></div><div class="field"><label for="operationTournamentPrintFormat">경기종목</label><select id="operationTournamentPrintFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div>${availableLeagues.length > 1 ? `<div class="field"><label for="operationTournamentLeague">출력할 리그</label><select id="operationTournamentLeague" data-tournament-league><option value="upper" ${league === 'upper' ? 'selected' : ''}>상위리그 대진표</option><option value="lower" ${league === 'lower' ? 'selected' : ''}>하위리그 대진표</option></select></div>` : ''}<div class="field"><label for="tournamentPrintPerPage">페이지당 경기 수</label><select id="tournamentPrintPerPage" data-tournament-print-count><option value="1" ${printPerPage === 1 ? 'selected' : ''}>1경기</option><option value="2" ${printPerPage === 2 ? 'selected' : ''}>2경기</option><option value="4" ${printPerPage === 4 ? 'selected' : ''}>4경기</option></select></div><button type="button" class="btn btn-primary" data-print-tournament ${bracket ? '' : 'disabled'}>${league === 'lower' ? '하위리그 현재 라운드 인쇄' : '상위리그 현재 라운드 인쇄'}</button></div>${bracket ? `<div class="tournament-print-selected-league"><strong>${league === 'lower' ? '하위리그' : '상위리그'} 대진표</strong><span>현재 선택한 리그만 인쇄됩니다.</span></div>${renderTournamentPrintSheet(bracket, format, league)}` : `<div class="empty-state"><strong>${league === 'lower' ? '하위리그 대진표가 아직 생성되지 않았습니다.' : '상위리그 대진표가 아직 생성되지 않았습니다.'}</strong><p>경기결과 입력 &gt; 본선 토너먼트 경기결과 입력에서 해당 리그를 선택하고 토너먼트를 구성해 주세요.</p></div>`}</div>`;
  }

  function getTournamentConfig(game, format) {
    const tournament = game.tournaments;
    if (tournament?.[format]?.format === format) return tournament[format];
    if (tournament?.format === format) return tournament;
    return null;
  }

  function renderTournamentOperationPanel(games, game, formats, format) {
    const standings = getQualifyingStandings(game, format);
    const config = getTournamentConfig(game, format);
    const upper = config?.upper;
    const lower = config?.lower;
    const defaultAdvance = Math.max(1, ...standings.map((group) => group.standings.length)) >= 2 ? 2 : 1;
    const selectedAdvance = Math.min(4, Math.max(1, Number.parseInt(config?.advancePerGroup || document.querySelector('[data-tournament-advance]')?.value, 10) || defaultAdvance));
    const advanceOptions = [1, 2, 3, 4].filter((rank) => rank <= Math.max(1, ...standings.map((group) => group.standings.length))).map((rank) => `<option value="${rank}" ${rank === selectedAdvance ? 'selected' : ''}>${rank}등</option>`).join('');
    return `<div class="tournament-panel"><div class="operation-controls tournament-controls"><div class="field"><label for="operationTournamentGame">게임</label><select id="operationTournamentGame" data-operation-game>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === game.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></div><div class="field"><label for="operationTournamentFormat">경기종목</label><select id="operationTournamentFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div><div class="field"><label for="tournamentAdvanceCount">조별 진출 등수</label><select id="tournamentAdvanceCount" data-tournament-advance>${advanceOptions}</select></div><label class="check-line"><input type="checkbox" data-tournament-upper ${config?.upperEnabled !== false ? 'checked' : ''} /> 상위리그</label><label class="check-line"><input type="checkbox" data-tournament-lower ${config ? (config.lowerEnabled ? 'checked' : '') : 'checked'} /> 하위리그</label><button type="button" class="btn btn-primary" data-generate-tournament>토너먼트 구성</button></div><div class="operation-note">예선리그 조별 순위 기준으로 진출자를 자동 선발합니다. 상위리그는 각 조 1~4등까지 진출하고, 하위리그는 상위리그 진출자를 제외한 참가자로 구성됩니다. 하위리그가 필요하지 않으면 선택을 해제하세요.</div>${!standings.length ? '<div class="empty-state">먼저 조편성과 예선리그 경기결과를 완료해 주세요.</div>' : ''}${standings.length && !config ? '<div class="empty-state">예선 순위가 확정되었습니다. 상위리그와 하위리그가 기본 선택되어 있습니다. 토너먼트 구성 버튼을 눌러 대진표를 생성해 주세요.</div>' : ''}${upper ? `<section class="tournament-league"><div class="group-result-heading"><div><p class="section-kicker">상위리그 토너먼트 대진표 및 경기결과</p><h2>${escapeHtml(String(upper.entries.length))}명/팀</h2></div><span class="subtle-note">${escapeHtml(String(upper.size))}강</span></div>${renderTournamentBracket(upper)}<div class="button-row group-save-row"><button type="button" class="btn btn-secondary" data-save-tournament="upper">상위리그 경기결과 저장</button></div></section>` : ''}${lower ? `<section class="tournament-league"><div class="group-result-heading"><div><p class="section-kicker">하위리그 토너먼트 대진표 및 경기결과</p><h2>${escapeHtml(String(lower.entries.length))}명/팀</h2></div><span class="subtle-note">${escapeHtml(String(lower.size))}강</span></div>${renderTournamentBracket(lower)}<div class="button-row group-save-row"><button type="button" class="btn btn-secondary" data-save-tournament="lower">하위리그 경기결과 저장</button></div></section>` : ''}</div>`;
  }

  function renderOperationsPage(currentUser) {
    const games = state.games.filter((game) => game.operatorId === currentUser.id);
    const game = games.find((item) => item.id === state.operationGameId) || games[0];
    if (!game) return `<section class="panel section-card"><div class="empty-state">운영 중인 게임이 없습니다. 먼저 게임을 생성해 주세요.</div></section>`;
    const formats = getGameFormats(game);
    const format = formats.includes(state.operationFormat) ? state.operationFormat : formats[0];
    const saved = game.qualifyingGroups?.[format];
    const participantCount = getGroupingUnits(game, format).length;
    const defaultGroupCount = saved?.groupCount || Math.max(1, Math.ceil(participantCount / 4));
    const calculatedSizes = saved?.groups?.map((group) => group.players.length) || [];
    const calculatedSizeText = calculatedSizes.length ? calculatedSizes.join('명, ') + '명' : '조 수를 정하면 자동 계산';
    return `
      <section class="panel section-card operations-page">
        <div class="section-heading">
          <div><button type="button" class="btn btn-ghost" data-back-dashboard>대시보드로</button><p class="section-kicker">경기운영</p><h1>예선리그 조편성</h1><p>게임 생성자만 조편성을 생성하고 수정할 수 있습니다.</p></div>
          <span class="status-chip">운영자 전용</span>
        </div>
        <div class="operation-menu"><button type="button" class="operation-menu__item ${state.operationMenu === 'roster' ? 'is-active' : ''}" data-operation-menu="roster">참가선수 등록</button><button type="button" class="operation-menu__item ${state.operationMenu === 'groups' ? 'is-active' : ''}" data-operation-menu="groups">예선리그 조편성</button><button type="button" class="operation-menu__item ${state.operationMenu === 'print' ? 'is-active' : ''}" data-operation-menu="print">대진표 출력</button><button type="button" class="operation-menu__item ${state.operationMenu === 'results' ? 'is-active' : ''}" data-operation-menu="results">경기결과 입력</button></div>
        ${state.operationMenu === 'print' ? `<div class="operation-submenu"><button type="button" class="operation-submenu__item ${state.operationSubmenu === 'qualifying' ? 'is-active' : ''}" data-operation-submenu="qualifying">예선리그 대진표 출력</button><button type="button" class="operation-submenu__item ${state.operationSubmenu === 'tournament' ? 'is-active' : ''}" data-operation-submenu="tournament">본선 토너먼트 대진표 출력</button></div>` : ''}
        ${state.operationMenu === 'results' ? `<div class="operation-submenu"><button type="button" class="operation-submenu__item ${state.operationSubmenu === 'qualifying' ? 'is-active' : ''}" data-operation-submenu="qualifying">예선리그 경기결과 입력</button><button type="button" class="operation-submenu__item ${state.operationSubmenu === 'tournament' ? 'is-active' : ''}" data-operation-submenu="tournament">본선 토너먼트 경기결과 입력</button></div>` : ''}
        ${state.operationMenu === 'roster' ? renderRosterOperationPanel(games, game, formats, format) : state.operationMenu === 'print' && state.operationSubmenu === 'qualifying' ? renderScheduleOperationPanel(games, game, formats, format, 'generate') : state.operationMenu === 'results' && state.operationSubmenu === 'qualifying' ? renderScheduleOperationPanel(games, game, formats, format, 'results') : state.operationMenu === 'print' && state.operationSubmenu === 'tournament' ? renderTournamentPrintPanel(games, game, formats, format) : state.operationMenu === 'results' && state.operationSubmenu === 'tournament' ? renderTournamentOperationPanel(games, game, formats, format) : `<div class="operation-controls">
          <div class="field"><label for="operationGame">게임</label><select id="operationGame" data-operation-game>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === game.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></div>
          <div class="field"><label for="operationFormat">경기종목</label><select id="operationFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div>
          <div class="field"><label for="groupCount">조 수</label><input id="groupCount" type="number" min="1" max="${Math.max(1, participantCount)}" value="${escapeHtml(String(defaultGroupCount))}" data-group-count /></div>
          <button type="button" class="btn btn-primary" data-generate-groups>조편성 생성</button>
        </div>
        <div class="operation-note">조별 인원/팀 수는 참가자 수를 기준으로 자동 계산됩니다. 현재 계산 결과: ${escapeHtml(calculatedSizeText)}. 나머지 인원/팀이 있으면 추가 배정 조는 무작위로 정합니다. 개인전은 선수 이름 단위로 부수가 같은 선수가 최대한 다른 조에 분산되고, 복식·단체전은 팀명 단위로 무작위 배정됩니다.</div>
        <div class="group-result-heading"><div><p class="section-kicker">조편성 결과</p><h2>${escapeHtml(FORMAT_LABELS[format])} 예선리그</h2></div>${saved ? '<span class="subtle-note">생성 후 선수별 조 이동 가능</span>' : ''}</div>
        ${renderOperationGroups(game, format)}
        ${saved ? '<div class="button-row group-save-row"><button type="button" class="btn btn-secondary" data-save-groups>수정한 조편성 저장</button></div>' : ''}`}
      </section>
    `;
  }

  function openOperations(gameId = null, menu = 'groups') {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const games = state.games.filter((game) => game.operatorId === currentUser.id);
    const game = games.find((item) => item.id === gameId) || games[0];
    if (!game) {
      setFlash('경기운영을 시작하려면 먼저 게임을 생성해 주세요.', 'info');
      render();
      return;
    }
    state.selectedGameId = null;
    state.editingGameId = null;
    state.operationGameId = game.id;
    state.operationFormat = getGameFormats(game)[0] || null;
    state.selectedScheduleGroup = null;
    state.operationMenu = ['groups', 'roster', 'print', 'results'].includes(menu) ? menu : 'groups';
    state.operationSubmenu = 'qualifying';
    render();
  }

  function handleGenerateGroups() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const groupCount = Number.parseInt(document.querySelector('[data-group-count]')?.value, 10);
    if (!currentUser || !game || game.operatorId !== currentUser.id || !format) return;
    const participantCount = getGroupingUnits(game, format).length;
    if (!participantCount) {
      setFlash('조편성할 참가자가 없습니다. 먼저 참가선수를 등록해 주세요.', 'error');
      render();
      return;
    }
    if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > participantCount) {
      setFlash(`조 수는 1개부터 참가 단위 수(${participantCount}개) 사이로 입력해 주세요.`, 'error');
      render();
      return;
    }
    game.qualifyingGroups = game.qualifyingGroups || {};
    const groups = buildQualifyingGroups(game, format, groupCount);
    game.qualifyingGroups[format] = { groupCount, groupSize: Math.ceil(participantCount / groupCount), groups, generatedAt: new Date().toISOString() };
    if (game.preliminaryMatches) delete game.preliminaryMatches[format];
    persistGames();
    setFlash(`${FORMAT_LABELS[format]} 조편성이 생성되었습니다.`, 'success');
    render();
  }

  function handleGenerateSchedule() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const groups = game?.qualifyingGroups?.[format]?.groups || [];
    if (!currentUser || !game || game.operatorId !== currentUser.id || !format) return;
    if (!groups.length) {
      setFlash('먼저 조편성을 완료해 주세요.', 'error');
      render();
      return;
    }
    const matches = groups.flatMap((group, index) => buildRoundRobinMatches(group, format, index))
      .sort((left, right) => left.round - right.round || left.groupIndex - right.groupIndex)
      .map((match, index) => ({ ...match, order: index + 1 }));
    game.preliminaryMatches = game.preliminaryMatches || {};
    game.preliminaryMatches[format] = { format, pointsToWin: 11, bestOf: 5, groups: groups.map((group) => group.name), matches, generatedAt: new Date().toISOString() };
    persistGames();
    setFlash(`${FORMAT_LABELS[format]} 예선 대진표가 생성되었습니다.`, 'success');
    render();
  }

  function handleGenerateTournament() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const standings = game ? getQualifyingStandings(game, format) : [];
    const advancePerGroup = Number.parseInt(document.querySelector('[data-tournament-advance]')?.value, 10);
    const upperEnabled = Boolean(document.querySelector('[data-tournament-upper]')?.checked);
    const lowerEnabled = Boolean(document.querySelector('[data-tournament-lower]')?.checked);
    const preliminaryMatches = game?.preliminaryMatches?.[format]?.matches || [];
    if (!currentUser || !game || game.operatorId !== currentUser.id || !format) return;
    if (!standings.length || !preliminaryMatches.length || preliminaryMatches.some((match) => !match.result?.winner || !/^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')))) {
      setFlash('예선리그 모든 경기결과를 먼저 입력하고 저장해 주세요.', 'error');
      render();
      return;
    }
    const maxGroupSize = Math.max(...standings.map((group) => group.standings.length));
    const maxAdvancePerGroup = Math.min(4, maxGroupSize);
    if (!Number.isInteger(advancePerGroup) || advancePerGroup < 1 || advancePerGroup > maxAdvancePerGroup) {
      setFlash(`조별 진출 등수는 1등 또는 2등까지 입력해 주세요.`, 'error');
      render();
      return;
    }
    if (!upperEnabled && !lowerEnabled) {
      setFlash('상위리그 또는 하위리그 중 하나 이상 선택해 주세요.', 'error');
      render();
      return;
    }
    const upperEntries = standings.flatMap((group) => group.standings.slice(0, advancePerGroup).map((record) => ({ ...record.player, qualificationRank: record.rank, sourceGroup: group.name })));
    const lowerEntries = standings.flatMap((group) => group.standings.slice(upperEnabled ? advancePerGroup : 0).map((record) => ({ ...record.player, qualificationRank: record.rank, sourceGroup: group.name })));
    const tournaments = {};
    if (upperEnabled && upperEntries.length) tournaments.upper = buildTournamentBracket(upperEntries, 'upper', format);
    if (lowerEnabled && lowerEntries.length) tournaments.lower = buildTournamentBracket(lowerEntries, 'lower', format);
    game.tournaments = game.tournaments || {};
    game.tournaments[format] = { format, advancePerGroup, upperEnabled, lowerEnabled, upper: tournaments.upper || null, lower: tournaments.lower || null, generatedAt: new Date().toISOString() };
    persistGames();
    setFlash(`${FORMAT_LABELS[format]} 본선 토너먼트가 구성되었습니다.`, 'success');
    render();
  }

  function handleSaveTournamentResults(leagueToSave = null) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const tournaments = getTournamentConfig(game, format);
    if (!currentUser || !game || game.operatorId !== currentUser.id || !tournaments) return;
    const leaguesToSave = leagueToSave === 'upper' || leagueToSave === 'lower' ? [leagueToSave] : ['upper', 'lower'];
    leaguesToSave.forEach((league) => {
      const bracket = tournaments[league];
      if (!bracket) return;
      bracket.rounds.flat().forEach((match) => {
        const scoreInput = document.querySelector(`[data-tournament-score="${CSS.escape(match.id)}"]`);
        const winnerInput = document.querySelector(`[data-tournament-winner="${CSS.escape(match.id)}"]`);
        if (scoreInput || winnerInput) match.result = { score: trimValue(scoreInput?.value), winner: winnerInput?.value || '' };
      });
      syncTournamentBracket(bracket);
    });
    tournaments.updatedAt = new Date().toISOString();
    persistGames();
    setFlash(`${leagueToSave === 'lower' ? '하위리그' : leagueToSave === 'upper' ? '상위리그' : '상·하위리그'} 본선 토너먼트 경기결과가 저장되었습니다.`, 'success');
    render();
  }

  function handleSaveScheduleResults() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const schedule = game?.preliminaryMatches?.[format];
    if (!currentUser || !game || game.operatorId !== currentUser.id || !schedule) return;
    schedule.matches.forEach((match) => {
      const scoreInput = document.querySelector(`[data-match-score="${CSS.escape(match.id)}"]`);
      const winnerInput = document.querySelector(`[data-match-winner="${CSS.escape(match.id)}"]`);
      if (scoreInput || winnerInput) match.result = { score: trimValue(scoreInput?.value), winner: winnerInput?.value || '' };
    });
    schedule.updatedAt = new Date().toISOString();
    persistGames();
    setFlash('예선리그 경기결과가 저장되었습니다.', 'success');
    render();
  }

  function handlePrintSchedule() {
    const schedulePanel = document.querySelector('.schedule-panel');
    const groupBlock = schedulePanel?.querySelector('.schedule-group-block');
    if (!groupBlock) return;
    const printRoot = document.createElement('div');
    printRoot.id = 'schedule-print-root';
    printRoot.className = 'schedule-print-root';
    printRoot.innerHTML = groupBlock.outerHTML;
    printRoot.querySelectorAll('.muted').forEach((element) => { element.textContent = ''; });
    printRoot.querySelectorAll('input, select').forEach((element) => {
      const blankCell = document.createElement('span');
      blankCell.className = 'print-handwrite-cell';
      blankCell.innerHTML = '&nbsp;';
      element.replaceWith(blankCell);
    });
    document.body.appendChild(printRoot);
    const cleanup = () => document.body.classList.remove('is-printing-schedule');
    document.body.classList.add('is-printing-schedule');
    window.addEventListener('afterprint', () => {
      cleanup();
      printRoot.remove();
    }, { once: true });
    window.print();
  }

  function handlePrintTournament() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const config = getTournamentConfig(game, format);
    const league = document.querySelector('[data-tournament-league]')?.value || state.operationTournamentLeague || 'upper';
    const bracket = config?.[league];
    const sheetList = bracket ? document.querySelector('.tournament-print-sheet-list') : null;
    if (!currentUser || !game || game.operatorId !== currentUser.id || !sheetList) return;
    const printRoot = document.createElement('div');
    printRoot.id = 'tournament-print-root';
    printRoot.className = 'tournament-print-root';
    const printPerPage = [1, 2, 4].includes(Number(state.tournamentPrintPerPage)) ? Number(state.tournamentPrintPerPage) : 2;
    printRoot.dataset.printCount = String(printPerPage);
    printRoot.innerHTML = sheetList.outerHTML;
    document.body.appendChild(printRoot);
    const cleanup = () => {
      document.body.classList.remove('is-printing-tournament');
      delete document.body.dataset.printCount;
    };
    document.body.dataset.printCount = String(printPerPage);
    document.body.classList.add('is-printing-tournament');
    window.addEventListener('afterprint', () => {
      cleanup();
      printRoot.remove();
    }, { once: true });
    window.print();
  }

  function handleSaveGroups() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const setup = game?.qualifyingGroups?.[format];
    if (!currentUser || !game || game.operatorId !== currentUser.id || !setup) return;
    const assignments = new Map([...document.querySelectorAll('[data-group-assignment]')].map((select) => [select.dataset.groupAssignment, select.value]));
    const groups = setup.groups.map((group) => ({ name: group.name, players: [] }));
    setup.groups.forEach((group) => group.players.forEach((player) => {
      const target = groups.find((candidate) => candidate.name === assignments.get(player.playerKey)) || groups.find((candidate) => candidate.name === group.name);
      target.players.push(player);
    }));
    game.qualifyingGroups[format] = { ...setup, groups, updatedAt: new Date().toISOString() };
    if (game.preliminaryMatches) delete game.preliminaryMatches[format];
    persistGames();
    setFlash('수정한 조편성이 저장되었습니다. 예선 대진표를 다시 생성해 주세요.', 'success');
    render();
  }

  function renderDashboard(currentUser) {
    const createPanel = state.showCreateGame ? renderCreateGameForm() : '';
    const selectedGame = state.games.find((game) => game.id === state.selectedGameId);
    const editingGame = state.games.find((game) => game.id === state.editingGameId);

    if (state.operationGameId) {
      const operationGame = state.games.find((game) => game.id === state.operationGameId);
      if (operationGame?.operatorId === currentUser.id) return renderOperationsPage(currentUser);
      state.operationGameId = null;
    }
    if (editingGame && editingGame.operatorId === currentUser.id) return `${renderEditGameForm(editingGame)}`;
    if (selectedGame) return `${renderGameDetailView(selectedGame, currentUser)}`;

    return state.showCreateGame ? createPanel : renderGamesSection(currentUser);
  }
  function renderMyPage(currentUser) {
    return `
      <section class="panel auth-simple__card mypage-card">
        <p class="section-kicker">Mypage</p>
        <h1>내 정보</h1>
        <p class="auth-simple__note">회원정보를 확인하고 필요한 내용을 수정할 수 있습니다.</p>
        <form class="form-stack" data-form="profile">
          <div class="field">
            <label for="profileMemberId">아이디</label>
            <input id="profileMemberId" type="text" value="${escapeHtml(currentUser.memberId)}" readonly />
          </div>
          <div class="field">
            <label for="profileNickname">닉네임</label>
            <input id="profileNickname" name="nickname" type="text" value="${escapeHtml(currentUser.nickname)}" required />
          </div>
          <div class="field">
            <label for="profilePhone">휴대폰번호</label>
            <input id="profilePhone" name="phone" type="tel" value="${escapeHtml(currentUser.phone)}" required />
          </div>
          <div class="field">
            <label>성별</label>
            <div class="choice-row">
              <label class="choice-option"><input type="radio" name="gender" value="male" ${currentUser.gender === 'male' ? 'checked' : ''} /> 남자</label>
              <label class="choice-option"><input type="radio" name="gender" value="female" ${currentUser.gender === 'female' ? 'checked' : ''} /> 여자</label>
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label for="profileRegion">활동지역</label>
              <input id="profileRegion" name="region" type="text" value="${escapeHtml(currentUser.region || '')}" />
            </div>
            <div class="field">
              <label for="profileRank">탁구부수</label>
              <input id="profileRank" name="rank" type="text" value="${escapeHtml(currentUser.rank || '')}" />
            </div>
          </div>
          <div class="field">
            <label for="profileAddress">주소</label>
            <input id="profileAddress" name="address" type="text" value="${escapeHtml(currentUser.address || '')}" />
          </div>
          <div class="button-row">
            <button class="btn btn-primary" type="submit">내 정보 저장</button>
            <button class="btn btn-ghost" type="button" data-back-dashboard>돌아가기</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderLockIcon(isLocked) {
    return `<svg class="top-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" class="top-action__shackle ${isLocked ? '' : 'is-open'}" /><rect x="5" y="10" width="14" height="10" rx="1.5" class="top-action__lock" /><circle cx="12" cy="15" r="1.3" class="top-action__keyhole" /></svg>`;
  }

  function updateTopActions(currentUser) {
    const actions = currentUser
      ? `<button type="button" class="btn top-action" data-logout>${renderLockIcon(false)}<span>로그아웃(${escapeHtml(currentUser.nickname)})</span></button><button type="button" class="btn top-action" data-open-mypage>Mypage</button>`
      : `<button type="button" class="btn top-action" data-open-auth="signup"><span>회원가입</span></button><button type="button" class="btn top-action" data-open-auth="login">${renderLockIcon(true)}<span>로그인</span></button>`;
    if (topActions) topActions.innerHTML = actions;
    if (mobileMenuActions) mobileMenuActions.innerHTML = actions;
  }

  function setMobileMenuOpen(isOpen) {
    document.body.classList.toggle('mobile-menu-open', isOpen);
    mobileMenu?.setAttribute('aria-hidden', String(!isOpen));
    mobileMenuToggle?.setAttribute('aria-expanded', String(isOpen));
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function render() {
    const currentUser = getCurrentUser();
    updateTopActions(currentUser);

    if (!app) return;

    const publicGame = state.games.find((game) => game.id === state.selectedPublicGameId);
    app.className = currentUser ? 'app app--dashboard' : state.page === 'auth' ? 'app app--auth' : 'app app--public';
    const showPublicHome = state.page === 'public' && !state.selectedGameId && !publicGame;
    app.innerHTML = `${renderFlash()}${state.signupCompleted ? renderSignupSuccess() : showPublicHome ? renderPublicGamesPage() : currentUser && state.page === 'mypage' ? renderMyPage(currentUser) : currentUser ? renderDashboard(currentUser) : state.page === 'auth' ? renderAuthPage() : publicGame ? renderPublicGameDetail(publicGame) : renderPublicGamesPage()}`;
  }

  function goToHome(event) {
    event?.preventDefault();
    state.page = getCurrentUser() ? 'dashboard' : 'public';
    state.selectedPublicGameId = null;
    state.selectedGameId = null;
    state.editingGameId = null;
    state.operationGameId = null;
    state.operationFormat = null;
    state.selectedScheduleGroup = null;
    state.pendingGameId = null;
    state.signupCompleted = false;
    state.detailTab = 'status';
    state.statusSubtab = 'info';
    state.progressSubtab = 'participants';
    clearFlash();
    render();
  }

  function openAuthTab(tabName) {
    state.signupCompleted = false;
    state.page = 'auth';
    state.authTab = tabName === 'login' ? 'login' : 'signup';
    clearFlash();
    render();
  }

  function openLoginForGame(gameId = null) {
    state.pendingGameId = gameId;
    if (gameId) state.detailTab = 'applications';
    state.page = 'auth';
    state.authTab = 'login';
    setFlash('참가신청을 계속하려면 로그인해 주세요.', 'info');
    render();
  }

  function openGameDetail(gameId) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === gameId);
    if (!game) return;
    if (!currentUser) {
      openLoginForGame(gameId);
      return;
    }
    state.selectedGameId = game.id;
    state.detailTab = 'status';
    state.statusSubtab = 'info';
    state.statusFormat = getGameFormats(game)[0] || null;
    render();
  }

  function openGameFromCard(gameId) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === gameId);
    if (!game) return;
    state.detailTab = 'status';
    state.statusSubtab = 'info';
    state.progressSubtab = 'participants';
    state.statusFormat = getGameFormats(game)[0] || null;
    if (currentUser) {
      state.selectedPublicGameId = null;
      state.selectedGameId = game.id;
      state.page = 'dashboard';
    } else {
      state.selectedGameId = null;
      state.selectedPublicGameId = game.id;
      state.page = 'public';
    }
    render();
  }

  function handleGameApply(gameId) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === gameId);
    if (!game) return;
    if (!currentUser) {
      openLoginForGame(gameId);
      return;
    }
    state.selectedGameId = game.id;
    state.detailTab = 'applications';
    state.statusSubtab = 'info';
    state.statusFormat = getGameFormats(game)[0] || null;
    render();
  }

  async function handleRegistrationSubmit(form) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === form.dataset.gameId);
    const format = form.dataset.format;
    if (!currentUser || !game || !getGameFormats(game).includes(format)) return;

    const formData = Object.fromEntries(new FormData(form).entries());
    const nickname = trimValue(formData.nickname);
    const memberId = trimValue(formData.memberId);
    const rank = trimValue(formData.rank);
    const teamName = trimValue(formData.teamName);
    if (!nickname || !rank || (format !== 'singles' && !teamName)) {
      setFlash('이름, 부수와 경기형식에 필요한 팀명을 입력해 주세요. ID는 선택입니다.', 'error');
      render();
      return;
    }

    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/registrations`, {
        method: 'POST',
        body: JSON.stringify({ format, nickname, memberId, rank, teamName }),
      });
      await loadState();
      setFlash(`${FORMAT_LABELS[format]} 참가신청 내용이 저장되었습니다.`, 'success');
      render();
      return;
    } catch (error) {
      if (!error.message.includes('Failed to fetch') && !error.message.includes('서버 요청')) {
        setFlash(error.message, 'error');
        render();
        return;
      }
    }

    const registrations = getGameRegistrations(game);
    const existingRegistration = registrations.find((item) => item.userId === currentUser.id && item.format === format);
    if (getGameRegistrations(game, format).length >= game.maxParticipants) {
      setFlash('해당 경기형식의 참가 정원이 마감되었습니다.', 'error');
      render();
      return;
    }
    if (existingRegistration) {
      Object.assign(existingRegistration, { nickname, memberId, rank, teamName, appliedAt: new Date().toISOString() });
    } else {
      game.registrations = [...registrations, { userId: currentUser.id, nickname, memberId, rank, teamName, format, appliedAt: new Date().toISOString() }];
    }
    persistGames();
    setFlash(`${FORMAT_LABELS[format]} 참가신청 내용이 ${existingRegistration ? '수정' : '등록'}되었습니다.`, 'success');
    render();
  }

  async function handleRosterUpload(input) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === input.dataset.rosterUpload);
    if (!currentUser || !game || game.operatorId !== currentUser.id) {
      setFlash('게임 운영자만 참가선수 명부를 등록할 수 있습니다.', 'error');
      render();
      return;
    }
    const file = input.files?.[0];
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['csv', 'tsv', 'txt'].includes(extension)) {
      setFlash('CSV 또는 TSV 파일을 업로드해 주세요. 엑셀 파일은 CSV 형식으로 저장하면 됩니다.', 'error');
      render();
      return;
    }

    const formatSelect = document.querySelector(`[data-roster-format="${CSS.escape(game.id)}"]`);
    const format = formatSelect?.value;
    const rows = parseRosterText(await file.text());
    const registrations = getGameRegistrations(game);
    const formatRegistrations = getGameRegistrations(game, format);
    const existingKeys = new Set(formatRegistrations.map((participant) => participant.userId || `name:${normalizeParticipantName(participant.nickname)}`));
    let added = 0;
    let skipped = 0;
    for (const row of rows) {
      const requiresTeam = format !== 'singles';
      if (!row.nickname || !row.rank || (requiresTeam && !row.teamName) || formatRegistrations.length + added >= game.maxParticipants) {
        skipped += 1;
        continue;
      }
      const matchedUser = row.memberId ? state.users.find((user) => user.memberIdKey === normalizeId(row.memberId)) : null;
      const participantKey = matchedUser ? matchedUser.id : `name:${normalizeParticipantName(row.nickname)}`;
      if (existingKeys.has(participantKey)) {
        skipped += 1;
        continue;
      }
      registrations.push({
        userId: matchedUser?.id || null,
        nickname: matchedUser?.nickname || row.nickname,
        memberId: row.memberId,
        rank: row.rank || matchedUser?.rank || '',
        teamName: row.teamName || '',
        format,
        appliedAt: new Date().toISOString(),
        registeredBy: currentUser.id,
      });
      existingKeys.add(participantKey);
      added += 1;
    }
    game.registrations = registrations;
    persistGames();
    setFlash(`${added}명이 참가 등록되었습니다. ${skipped}명은 중복, 빈 행 또는 정원 초과로 제외되었습니다.`, added ? 'success' : 'info');
    render();
  }

  function setGameFilter(filterName) {
    state.gameFilter = filterName === 'mine' && state.gameFilter !== 'mine' ? 'mine' : 'all';
    state.gamePage = 1;
    render();
  }

  function setGamePage(pageNumber) {
    const nextPage = Number(pageNumber);
    if (!Number.isInteger(nextPage) || nextPage < 1) return;
    state.gamePage = nextPage;
    render();
  }

  function setDetailTab(tabName) {
    const allowedTabs = ['status', 'progress', 'applications'];
    state.detailTab = allowedTabs.includes(tabName) ? tabName : 'status';
    state.statusSubtab = state.detailTab === 'progress' ? 'progress' : 'info';
    render();
  }

  async function handleSignup(form) {
    const submittedData = new FormData(form);
    const formData = Object.fromEntries(submittedData.entries());
    const nickname = trimValue(formData.nickname);
    const memberId = trimValue(formData.memberId);
    const password = trimValue(formData.password);
    const phone = trimValue(formData.phone);
    const gender = trimValue(formData.gender);
    const region = trimValue(formData.region);
    const rank = trimValue(formData.rank);
    const address = trimValue(formData.address);
    const memberIdKey = normalizeId(memberId);

    const missingFields = [
      !nickname ? '이름(닉네임)' : '',
      !memberId ? 'ID' : '',
      !password ? '비밀번호' : '',
      !gender ? '성별' : '',
      !rank ? '통합부수' : '',
      !phone ? '휴대폰번호' : '',
    ].filter(Boolean);
    if (missingFields.length) {
      setFlash(`회원가입 실패: ${missingFields.join(', ')} 항목을 입력해 주세요.`, 'error');
      render();
      return;
    }

    try {
      await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ nickname, memberId, password, phone, gender, rank, region, address }),
      });
      form.reset();
      state.signupCompleted = true;
      state.page = 'signup-success';
      setFlash('회원가입이 완료되었습니다.', 'success');
      render();
      return;
    } catch (error) {
      if (!error.message.includes('Failed to fetch') && !error.message.includes('서버 요청')) {
        setFlash(`회원가입 실패: ${error.message}`, 'error');
        render();
        return;
      }
    }

    if (state.users.some((user) => user.memberIdKey === memberIdKey)) {
      setFlash('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.', 'error');
      render();
      return;
    }

    const passwordHash = await hashPassword(password);

    state.users.push({
      id: makeId('user'),
      nickname,
      memberId,
      memberIdKey,
      passwordHash,
      phone,
      gender,
      region,
      rank,
      address,
      createdAt: new Date().toISOString(),
    });

    persistUsers();
    form.reset();
    state.signupCompleted = true;
    state.page = 'signup-success';
    setFlash('회원가입이 완료되었습니다.', 'success');
    render();
  }

  async function handleLogin(form) {
    const submittedData = new FormData(form);
    const formData = Object.fromEntries(submittedData.entries());
    const memberIdKey = normalizeId(formData.memberId);
    const password = trimValue(formData.password);

    if (!memberIdKey || !password) {
      setFlash('아이디와 비밀번호를 입력해 주세요.', 'error');
      render();
      return;
    }

    try {
      const remember = formData.remember === 'on';
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ memberId: memberIdKey, password, remember }),
      });
      state.users = [result.user];
      state.sessionUserId = result.user.id;
      state.page = 'dashboard';
      state.selectedGameId = state.pendingGameId;
      state.pendingGameId = null;
      form.reset();
      await loadState();
      clearFlash();
      setFlash(`${result.user.nickname}님, 로그인되었습니다.`, 'success');
      render();
      return;
    } catch (error) {
      if (!error.message.includes('Failed to fetch') && !error.message.includes('서버 요청')) {
        setFlash(error.message, 'error');
        render();
        return;
      }
    }

    const user = state.users.find((item) => item.memberIdKey === memberIdKey);

    if (!user) {
      setFlash('등록된 아이디를 찾을 수 없습니다.', 'error');
      render();
      return;
    }

    const passwordHash = await hashPassword(password);

    if (passwordHash !== user.passwordHash) {
      setFlash('비밀번호가 일치하지 않습니다.', 'error');
      render();
      return;
    }

    state.sessionUserId = user.id;
    persistSession();
    state.page = 'dashboard';
    state.selectedGameId = state.pendingGameId;
    state.pendingGameId = null;
    form.reset();
    clearFlash();
    setFlash(`${user.nickname}님, 로그인되었습니다.`, 'success');
    render();
  }

  function handleProfileUpdate(form) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const formData = Object.fromEntries(new FormData(form).entries());
    const nickname = trimValue(formData.nickname);
    const phone = trimValue(formData.phone);
    const gender = trimValue(formData.gender);
    if (!nickname || !phone) {
      setFlash('닉네임과 휴대폰번호를 입력해 주세요.', 'error');
      render();
      return;
    }
    Object.assign(currentUser, {
      nickname,
      phone,
      gender,
      region: trimValue(formData.region),
      rank: trimValue(formData.rank),
      address: trimValue(formData.address),
      updatedAt: new Date().toISOString(),
    });
    state.games.filter((game) => game.operatorId === currentUser.id).forEach((game) => {
      game.operatorNickname = currentUser.nickname;
    });
    persistUsers();
    persistGames();
    state.page = 'dashboard';
    setFlash('내 정보가 수정되었습니다.', 'success');
    render();
  }

  async function handleGameCreate(form) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setFlash('로그인이 필요합니다.', 'error');
      render();
      return;
    }

    const submittedData = new FormData(form);
    const formData = Object.fromEntries(submittedData.entries());
    const title = trimValue(formData.title);
    const location = trimValue(formData.location);
    const formats = submittedData.getAll('formats').map(trimValue);
    const scheduledAt = trimValue(formData.scheduledAt);
    const note = trimValue(formData.note);
    const maxParticipants = Number.parseInt(trimValue(formData.maxParticipants), 10);

    if (!title || !location || !formats.length || !scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < 1) {
      setFlash('게임 생성에 필요한 항목과 경기형식을 하나 이상 선택해 주세요.', 'error');
      render();
      return;
    }

    if (formats.some((format) => !Object.prototype.hasOwnProperty.call(FORMAT_LABELS, format))) {
      setFlash('경기형식을 개인전, 복식, 단체전 중에서 선택해 주세요.', 'error');
      render();
      return;
    }

    try {
      await apiRequest('/api/games', {
        method: 'POST',
        body: JSON.stringify({ title, location, formats, scheduledAt, maxParticipants, note }),
      });
      await loadState();
      form.reset();
      state.showCreateGame = false;
      setFlash('새 게임이 생성되었습니다. 생성한 회원이 해당 게임의 운영자입니다.', 'success');
      render();
      return;
    } catch (error) {
      if (!error.message.includes('Failed to fetch') && !error.message.includes('서버 요청')) {
        setFlash(error.message, 'error');
        render();
        return;
      }
    }

    state.games.push({
      id: makeId('game'),
      title,
      location,
      formats,
      format: formats[0],
      scheduledAt,
      maxParticipants,
      note,
      operatorId: currentUser.id,
      operatorNickname: currentUser.nickname,
      participants: [],
      createdAt: new Date().toISOString(),
    });

    persistGames();
    form.reset();
    state.showCreateGame = false;
    setFlash('새 게임이 생성되었습니다. 생성한 회원이 해당 게임의 운영자입니다.', 'success');
    render();
  }

  function handleGameUpdate(form) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === form.dataset.gameId);
    if (!currentUser || !game || game.operatorId !== currentUser.id) {
      setFlash('게임 운영자만 게임을 수정할 수 있습니다.', 'error');
      render();
      return;
    }

    const submittedData = new FormData(form);
    const formData = Object.fromEntries(submittedData.entries());
    const title = trimValue(formData.title);
    const location = trimValue(formData.location);
    const formats = submittedData.getAll('formats').map(trimValue);
    const scheduledAt = trimValue(formData.scheduledAt);
    const note = trimValue(formData.note);
    const maxParticipants = Number.parseInt(trimValue(formData.maxParticipants), 10);
    const participantCount = getGameParticipants(game).length;

    if (!title || !location || !formats.length || !scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < participantCount) {
      setFlash(`필수 항목과 경기형식을 입력하고 최대참가인원을 현재 참가자 수(${participantCount}명) 이상으로 설정해 주세요.`, 'error');
      render();
      return;
    }
    if (formats.some((format) => !Object.prototype.hasOwnProperty.call(FORMAT_LABELS, format))) {
      setFlash('경기형식을 개인전, 복식, 단체전 중에서 선택해 주세요.', 'error');
      render();
      return;
    }

    Object.assign(game, { title, location, formats, format: formats[0], scheduledAt, maxParticipants, note });
    persistGames();
    state.editingGameId = null;
    state.selectedGameId = game.id;
    setFlash('게임 정보가 수정되었습니다.', 'success');
    render();
  }

  async function handleAppClick(event) {
    const authAction = event.target.closest('[data-open-auth]');
    if (authAction) {
      openAuthTab(authAction.dataset.openAuth);
      return;
    }

    const mypageButton = event.target.closest('[data-open-mypage]');
    if (mypageButton) {
      state.page = 'mypage';
      state.selectedGameId = null;
      state.operationGameId = null;
      render();
      return;
    }

    const operationsButton = event.target.closest('[data-open-operations]');
    if (operationsButton) {
      openOperations(operationsButton.dataset.openOperations || null, operationsButton.dataset.operationMenu || 'groups');
      return;
    }

    const showCreateGameButton = event.target.closest('[data-show-create-game]');
    if (showCreateGameButton) {
      state.showCreateGame = true;
      state.selectedGameId = null;
      render();
      return;
    }

    const cancelCreateGameButton = event.target.closest('[data-cancel-create-game]');
    if (cancelCreateGameButton) {
      state.showCreateGame = false;
      render();
      return;
    }

    const backDashboardButton = event.target.closest('[data-back-dashboard]');
    if (backDashboardButton) {
      state.page = 'dashboard';
      state.operationGameId = null;
      state.operationFormat = null;
      state.selectedScheduleGroup = null;
      render();
      return;
    }

    const operationMenuButton = event.target.closest('[data-operation-menu]');
    if (operationMenuButton) {
      state.operationMenu = ['groups', 'roster', 'print', 'results'].includes(operationMenuButton.dataset.operationMenu) ? operationMenuButton.dataset.operationMenu : 'groups';
      state.operationSubmenu = 'qualifying';
      render();
      return;
    }

    const operationSubmenuButton = event.target.closest('[data-operation-submenu]');
    if (operationSubmenuButton) {
      state.operationSubmenu = ['qualifying', 'tournament'].includes(operationSubmenuButton.dataset.operationSubmenu) ? operationSubmenuButton.dataset.operationSubmenu : 'qualifying';
      render();
      return;
    }

    const generateGroupsButton = event.target.closest('[data-generate-groups]');
    if (generateGroupsButton) {
      handleGenerateGroups();
      return;
    }

    const generateScheduleButton = event.target.closest('[data-generate-schedule]');
    if (generateScheduleButton) {
      handleGenerateSchedule();
      return;
    }

    const generateTournamentButton = event.target.closest('[data-generate-tournament]');
    if (generateTournamentButton) {
      handleGenerateTournament();
      return;
    }

    const saveScheduleResultsButton = event.target.closest('[data-save-schedule-results]');
    if (saveScheduleResultsButton) {
      handleSaveScheduleResults();
      return;
    }

    const saveTournamentButton = event.target.closest('[data-save-tournament]');
    if (saveTournamentButton) {
      handleSaveTournamentResults(saveTournamentButton.dataset.saveTournament || null);
      return;
    }

    const printScheduleButton = event.target.closest('[data-print-schedule]');
    if (printScheduleButton) {
      handlePrintSchedule();
      return;
    }

    const printTournamentButton = event.target.closest('[data-print-tournament]');
    if (printTournamentButton) {
      handlePrintTournament();
      return;
    }

    const saveGroupsButton = event.target.closest('[data-save-groups]');
    if (saveGroupsButton) {
      handleSaveGroups();
      return;
    }

    const authTabButton = event.target.closest('[data-auth-tab]');
    if (authTabButton) {
      openAuthTab(authTabButton.dataset.authTab);
      return;
    }

    const filterButton = event.target.closest('[data-game-filter]');
    if (filterButton) {
      setGameFilter(filterButton.dataset.gameFilter);
      return;
    }

    const gamePageButton = event.target.closest('[data-game-page]');
    if (gamePageButton && !gamePageButton.disabled) {
      setGamePage(gamePageButton.dataset.gamePage);
      return;
    }

    const openLoginButton = event.target.closest('[data-open-login]');
    if (openLoginButton) {
      openLoginForGame();
      return;
    }

    const openPublicButton = event.target.closest('[data-open-public]');
    if (openPublicButton) {
      state.page = 'public';
      clearFlash();
      render();
      return;
    }

    const signupSuccessButton = event.target.closest('[data-home-after-signup]');
    if (signupSuccessButton) {
      goToHome(event);
      return;
    }

    const gameOpenButton = event.target.closest('[data-game-open]');
    if (gameOpenButton) {
      openGameFromCard(gameOpenButton.dataset.gameOpen);
      return;
    }

    const publicDetailButton = event.target.closest('[data-public-detail]');
    if (publicDetailButton) {
      state.selectedPublicGameId = publicDetailButton.dataset.publicDetail;
      state.detailTab = 'status';
      const publicGame = state.games.find((game) => game.id === state.selectedPublicGameId);
      state.statusSubtab = 'info';
      state.progressSubtab = 'participants';
      state.statusFormat = publicGame ? getGameFormats(publicGame)[0] || null : null;
      render();
      return;
    }

    const statusFormatButton = event.target.closest('[data-status-format]');
    if (statusFormatButton) {
      state.statusFormat = statusFormatButton.dataset.statusFormat;
      render();
      return;
    }

    const statusSubtabButton = event.target.closest('[data-status-subtab]');
    if (statusSubtabButton) {
      state.statusSubtab = statusSubtabButton.dataset.statusSubtab;
      render();
      return;
    }

    const statusProgressButton = event.target.closest('[data-status-progress]');
    if (statusProgressButton) {
      state.progressSubtab = statusProgressButton.dataset.statusProgress;
      render();
      return;
    }

    const detailTabButton = event.target.closest('[data-detail-tab]');
    if (detailTabButton) {
      if (detailTabButton.dataset.detailTab === 'applications' && !getCurrentUser()) {
        openLoginForGame(state.selectedPublicGameId || state.selectedGameId);
        return;
      }
      setDetailTab(detailTabButton.dataset.detailTab);
      return;
    }

    const applyButton = event.target.closest('[data-game-apply]');
    if (applyButton) {
      handleGameApply(applyButton.dataset.gameApply);
      return;
    }

    const detailButton = event.target.closest('[data-game-detail]');
    if (detailButton) {
      openGameDetail(detailButton.dataset.gameDetail);
      return;
    }

    const editGameButton = event.target.closest('[data-edit-game]');
    if (editGameButton) {
      const currentUser = getCurrentUser();
      const game = state.games.find((item) => item.id === editGameButton.dataset.editGame);
      if (currentUser && game && game.operatorId === currentUser.id) {
        state.selectedGameId = game.id;
        state.editingGameId = game.id;
        render();
      }
      return;
    }

    const backGamesButton = event.target.closest('[data-back-games]');
    if (backGamesButton) {
      state.selectedGameId = null;
      state.detailTab = 'status';
      state.statusSubtab = 'info';
      render();
      return;
    }

    const publicBackButton = event.target.closest('[data-public-back]');
    if (publicBackButton) {
      state.selectedPublicGameId = null;
      state.detailTab = 'status';
      state.statusSubtab = 'info';
      render();
      return;
    }

    const cancelGameEditButton = event.target.closest('[data-cancel-game-edit]');
    if (cancelGameEditButton) {
      state.editingGameId = null;
      render();
      return;
    }

    const downloadTemplateButton = event.target.closest('[data-download-roster-template]');
    if (downloadTemplateButton) {
      downloadRosterTemplate();
    }

    const logoutButton = event.target.closest('[data-logout]');
    if (logoutButton) {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      } catch {
        // Local fallback still clears the browser session.
      }
      state.sessionUserId = null;
      persistSession();
      setFlash('로그아웃되었습니다.', 'info');
      render();
    }
  }

  async function handleAppSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    event.preventDefault();

    if (form.dataset.form === 'signup') {
      await handleSignup(form);
      return;
    }

    if (form.dataset.form === 'login') {
      await handleLogin(form);
      return;
    }

    if (form.dataset.form === 'profile') {
      handleProfileUpdate(form);
      return;
    }

    if (form.dataset.form === 'game') {
      await handleGameCreate(form);
      return;
    }

    if (form.dataset.form === 'game-apply') {
      await handleRegistrationSubmit(form);
      return;
    }

    if (form.dataset.form === 'game-edit') {
      handleGameUpdate(form);
    }
  }

  async function handleAppChange(event) {
    const input = event.target;
    if (input.matches('[data-operation-game]')) {
      state.operationGameId = input.value;
      const game = state.games.find((item) => item.id === input.value);
      state.operationFormat = getGameFormats(game || {})[0] || null;
      state.selectedScheduleGroup = null;
      render();
      return;
    }
    if (input.matches('[data-operation-format]')) {
      state.operationFormat = input.value;
      state.selectedScheduleGroup = null;
      render();
      return;
    }
    if (input.matches('[data-tournament-league]')) {
      state.operationTournamentLeague = input.value;
      render();
      return;
    }
    if (input.matches('[data-tournament-print-count]')) {
      state.tournamentPrintPerPage = Number(input.value) || 2;
      render();
      return;
    }
    if (input.matches('[data-schedule-group]')) {
      state.selectedScheduleGroup = input.value;
      render();
      return;
    }
    if (input instanceof HTMLInputElement && input.dataset.rosterUpload) {
      await handleRosterUpload(input);
    }
  }

  async function handleStorageChange() {
    await loadState();
    render();
  }

  function wireEvents() {
    brand?.addEventListener('click', goToHome);
    app.addEventListener('click', handleAppClick);
    topActions?.addEventListener('click', handleAppClick);
    mobileMenuActions?.addEventListener('click', async (event) => {
      await handleAppClick(event);
      closeMobileMenu();
    });
    mobileMenuToggle?.addEventListener('click', () => setMobileMenuOpen(true));
    document.querySelectorAll('[data-mobile-menu-close]').forEach((element) => element.addEventListener('click', closeMobileMenu));
    app.addEventListener('submit', handleAppSubmit);
    app.addEventListener('change', handleAppChange);
    window.addEventListener('storage', handleStorageChange);
  }

  async function init() {
    await loadState();
    wireEvents();
    render();
  }

  init();
})();
