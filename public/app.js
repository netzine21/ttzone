(() => {
  let accessHeartbeatTimer = null;
  const STORAGE_KEYS = {
    users: 'ttgms:v1:users',
    games: 'ttgms:v1:games',
    registrationClosures: 'ttgms:v1:registration-closures',
    venues: 'ttgms:v1:venues',
    session: 'ttgms:v1:session',
    adminTab: 'ttgms:v1:admin-tab',
  };

  const FORMAT_LABELS = {
    singles: '개인전',
    doubles: '복식',
    team: '단체전',
  };

  const FORMAT_MODE_LABELS = {
    leagueOnly: '리그전만 진행',
    leagueTournament: '예선리그 후 본선 토너먼트',
  };

  const REGION_HIERARCHY = {
    서울특별시: ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'],
    부산광역시: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
    대구광역시: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
    인천광역시: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
    광주광역시: ['동구', '서구', '남구', '북구', '광산구'],
    대전광역시: ['동구', '중구', '서구', '유성구', '대덕구'],
    울산광역시: ['중구', '남구', '동구', '북구', '울주군'],
    세종특별자치시: ['세종특별자치시'],
    경기도: ['수원시', '성남시', '의정부시', '안양시', '부천시', '광명시', '평택시', '동두천시', '안산시', '고양시', '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시', '의왕시', '하남시', '용인시', '파주시', '이천시', '안성시', '김포시', '화성시', '광주시', '여주시', '양평군', '고양시 덕양구', '고양시 일산동구', '고양시 일산서구', '가평군', '연천군'],
    강원특별자치도: ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군'],
    충청북도: ['청주시 상당구', '청주시 서원구', '청주시 흥덕구', '청주시 청원구', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
    충청남도: ['천안시 동남구', '천안시 서북구', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
    전북특별자치도: ['전주시 완산구', '전주시 덕진구', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
    전라남도: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군'],
    경상북도: ['포항시 남구', '포항시 북구', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '군위군', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'],
    경상남도: ['창원시 의창구', '창원시 성산구', '창원시 마산합포구', '창원시 마산회원구', '창원시 진해구', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'],
    제주특별자치도: ['제주시', '서귀포시'],
  };
  const BROWSER_ROUTE_KEY = 'ttgms:v1:browser-route';

  function getFormatIconSvg(format) {
    const icons = {
      singles: '<circle cx="12" cy="7" r="3"></circle><path d="M6 20c.7-4 2.7-6 6-6s5.3 2 6 6"></path>',
      doubles: '<circle cx="8" cy="7" r="2.5"></circle><circle cx="16" cy="7" r="2.5"></circle><path d="M3 20c.5-3.6 2.2-5.5 5-5.5s4.5 1.9 5 5.5M11 20c.5-3.6 2.2-5.5 5-5.5s4.5 1.9 5 5.5"></path>',
      team: '<circle cx="6" cy="7" r="2.2"></circle><circle cx="12" cy="6" r="2.2"></circle><circle cx="18" cy="7" r="2.2"></circle><path d="M2 20c.4-3.4 1.7-5 4-5s3.6 1.6 4 5M8 20c.4-3.4 1.7-5 4-5s3.6 1.6 4 5M14 20c.4-3.4 1.7-5 4-5s3.6 1.6 4 5"></path>'
    };
    return icons[format] || icons.singles;
  }

  const state = {
    users: [],
    adminUsers: [],
    adminUserLoadError: '',
    adminVenues: [],
    adminVenueLoadError: '',
    adminVenueSearch: '',
    adminVenueSido: '',
    adminVenueSigungu: '',
    adminVenueImportRows: [],
    adminVenueImportMessage: '',
    adminVenueEditingId: null,
    adminDataLoading: false,
    adminAccess: [],
    adminAccessLoadError: '',
    adminAccessLoading: false,
    adminTab: 'users',
    adminVenueTab: 'register',
    venueRegionFilter: 'all',
    venueSearch: '',
    venues: [],
    leagueSeries: [],
    games: [],
    sessionUserId: null,
    authTab: 'signup',
    page: 'public',
    selectedPublicGameId: null,
    selectedGameId: null,
    detailTab: 'status',
    statusSubtab: 'info',
    progressSubtab: 'participants',
    progressTournamentLeague: 'upper',
    leagueResultsZoom: getLeagueBaseZoom(),
    tournamentZoom: 1,
    tournamentZoomInitialized: false,
    statusFormat: null,
    editingGameId: null,
    operationGameId: null,
    operationFormat: null,
    selectedScheduleGroup: null,
    editingRegistrationId: null,
    operationTournamentLeague: 'upper',
    tournamentGenerateLeague: 'upper',
    tournamentPrintPerPage: 2,
    operationMenu: 'groups',
    operationSubmenu: 'qualifying',
    showCreateGame: false,
    showLeagueSeries: false,
    selectedSeriesId: null,
    pendingGameId: null,
    signupCompleted: false,
    gameFilter: 'all',
    gamePage: 1,
    flash: null,
  };

  let flashTimer = null;
  let liveRefreshTimer = null;
  let liveRefreshInFlight = false;
  let scheduleResultsSaveTimer = null;
  let searchRenderTimer = null;
  let browserHistoryReady = false;
  let restoringBrowserHistory = false;
  let lastBrowserRouteKey = '';
  let selectedGroupPlayer = null;
  let tournamentPinchState = null;

  const app = document.getElementById('app');
  const topActions = document.getElementById('topActions');
  const mobileMenuActions = document.getElementById('mobileMenuActions');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const serviceMenuActions = document.getElementById('serviceMenuActions');
  const serviceMenu = document.getElementById('serviceMenu');
  const serviceMenuToggle = document.querySelector('.service-menu-toggle');
  const brand = document.querySelector('.brand');
  const brandName = document.querySelector('.brand-name');
  const THEME_STORAGE_KEY = 'ttground-theme';

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

  function getTheme() {
    return readJson(THEME_STORAGE_KEY, 'dark') === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme, persist = true) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    if (persist) writeJson(THEME_STORAGE_KEY, nextTheme);
    return nextTheme;
  }

  function readSessionJson(key, fallback) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeSessionJson(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'include',
      cache: options.cache || 'no-store',
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

  function startAccessHeartbeat() {
    if (accessHeartbeatTimer) return;
    const sendHeartbeat = () => { void apiRequest('/api/access-heartbeat').catch(() => {}); };
    sendHeartbeat();
    accessHeartbeatTimer = window.setInterval(sendHeartbeat, 30000);
  }

  function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function trimValue(value) {
    return String(value ?? '').trim();
  }

  function regionLabel(sido, sigungu) {
    return [trimValue(sido), trimValue(sigungu)].filter(Boolean).join(' ');
  }

  function inferRegionSelection(user = {}) {
    const rawSido = trimValue(user.regionSido);
    const rawSigungu = trimValue(user.regionSigungu);
    const legacyRegion = trimValue(user.region);
    const sido = Object.prototype.hasOwnProperty.call(REGION_HIERARCHY, rawSido)
      ? rawSido
      : Object.keys(REGION_HIERARCHY).find((item) => legacyRegion.replace(/\s/g, '').includes(item.replace(/\s/g, ''))) || '';
    const sigungu = rawSigungu && REGION_HIERARCHY[sido]?.includes(rawSigungu)
      ? rawSigungu
      : REGION_HIERARCHY[sido]?.find((item) => legacyRegion.replace(/\s/g, '').includes(item.replace(/\s/g, ''))) || '';
    return { sido, sigungu };
  }

  function renderRegionFields(prefix, user = {}, required = true) {
    const selected = inferRegionSelection(user);
    const requiredAttr = required ? ' required' : '';
    const sidoOptions = Object.keys(REGION_HIERARCHY).map((sido) => `<option value="${escapeHtml(sido)}" ${sido === selected.sido ? 'selected' : ''}>${escapeHtml(sido)}</option>`).join('');
    const sigunguOptions = (REGION_HIERARCHY[selected.sido] || []).map((sigungu) => `<option value="${escapeHtml(sigungu)}" ${sigungu === selected.sigungu ? 'selected' : ''}>${escapeHtml(sigungu)}</option>`).join('');
    return `<div class="field region-field"><label for="${prefix}RegionSido">활동지역${required ? ' <span class="field-requirement field-requirement--required">필수</span>' : ''}</label><div class="region-select-row"><select id="${prefix}RegionSido" name="regionSido" data-region-sido${requiredAttr}><option value="">시·도 선택</option>${sidoOptions}</select><select id="${prefix}RegionSigungu" name="regionSigungu" data-region-sigungu${requiredAttr} ${selected.sido ? '' : 'disabled'}><option value="">시·군·구 선택</option>${sigunguOptions}</select></div><input type="hidden" name="region" value="${escapeHtml(regionLabel(selected.sido, selected.sigungu))}" /></div>`;
  }

  function getVenueSuggestions() {
    const savedVenues = readJson(STORAGE_KEYS.venues, []);
    const directoryNames = [...state.venues, ...state.adminVenues].map((venue) => venue.name).filter(Boolean);
    const gameLocations = state.games.map((game) => game.location).filter(Boolean);
    return [...new Set([...directoryNames, ...(Array.isArray(savedVenues) ? savedVenues : []), ...gameLocations])]
      .map(trimValue)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ko'));
  }

  function rememberVenue(location) {
    const value = trimValue(location);
    if (!value) return;
    const venues = getVenueSuggestions().filter((item) => item !== value);
    writeJson(STORAGE_KEYS.venues, [value, ...venues].slice(0, 200));
  }

  function renderVenueSuggestions() {
    return getVenueSuggestions().map((venue) => `<option value="${escapeHtml(venue)}"></option>`).join('');
  }

  function findVenueByName(name) {
    const key = trimValue(name).toLowerCase();
    return [...state.adminVenues, ...state.venues].find((venue) => trimValue(venue.name).toLowerCase() === key) || null;
  }

  function formatPhoneNumber(value) {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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
    let session = null;
    let games = null;
    let venues = null;
    let leagueSeries = null;
    try {
      session = await apiRequest('/api/auth/me');
    } catch {
      // A temporary session failure should not prevent the public game list from loading.
    }
    try {
      games = await apiRequest('/api/games');
    } catch {
      // Fall back to local development data only when the game API is unavailable.
    }
    try {
      venues = await apiRequest('/api/venues');
    } catch {
      // The local venue history remains available if the directory API is unavailable.
    }
    try {
      leagueSeries = await apiRequest('/api/league-series');
    } catch {
      // Older/local deployments can continue without the optional series directory.
    }
    if (games) {
      const currentUser = session?.user || null;
      state.users = currentUser ? [currentUser] : [];
      const registrationClosures = readJson(STORAGE_KEYS.registrationClosures, {});
      state.games = (Array.isArray(games.games) ? games.games : []).map((game) => {
        if (game.registrationClosed && typeof game.registrationClosed === 'object') return game;
        const legacyClosed = registrationClosures[game.id] === true || game.registrationClosed === true;
        return legacyClosed ? { ...game, registrationClosed: { [getGameFormats(game)[0]]: true } } : { ...game, registrationClosed: {} };
      });
      state.sessionUserId = currentUser?.id || null;
      state.venues = Array.isArray(venues?.venues) ? venues.venues : [];
      state.leagueSeries = Array.isArray(leagueSeries?.series) ? leagueSeries.series : [];
      return;
    }

    const storedUsers = readJson(STORAGE_KEYS.users, []);
    const storedGames = readJson(STORAGE_KEYS.games, []);
    state.users = Array.isArray(storedUsers) ? storedUsers : [];
    state.games = Array.isArray(storedGames) ? storedGames : [];
    const storedSession = readJson(STORAGE_KEYS.session, null);
    state.sessionUserId = storedSession && typeof storedSession.userId === 'string' ? storedSession.userId : null;
    state.venues = Array.isArray(venues?.venues) ? venues.venues : [];
    state.leagueSeries = Array.isArray(leagueSeries?.series) ? leagueSeries.series : [];

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

  function getBrowserRoute() {
    return {
      page: state.page,
      selectedPublicGameId: state.selectedPublicGameId,
      selectedGameId: state.selectedGameId,
      detailTab: state.detailTab,
      statusSubtab: state.statusSubtab,
      progressSubtab: state.progressSubtab,
      progressTournamentLeague: state.progressTournamentLeague,
      statusFormat: state.statusFormat,
      editingGameId: state.editingGameId,
      operationGameId: state.operationGameId,
      operationFormat: state.operationFormat,
      operationMenu: state.operationMenu,
      operationSubmenu: state.operationSubmenu,
      showCreateGame: state.showCreateGame,
      showLeagueSeries: state.showLeagueSeries,
      selectedSeriesId: state.selectedSeriesId,
      authTab: state.authTab,
    };
  }

  function syncBrowserHistory() {
    const route = getBrowserRoute();
    writeSessionJson(BROWSER_ROUTE_KEY, route);
    const routeKey = JSON.stringify(route);
    const historyState = { ttgmsRoute: route };
    if (!browserHistoryReady) {
      window.history.replaceState(historyState, '', window.location.href);
      browserHistoryReady = true;
      lastBrowserRouteKey = routeKey;
      return;
    }
    if (restoringBrowserHistory) {
      window.history.replaceState(historyState, '', window.location.href);
      lastBrowserRouteKey = routeKey;
      return;
    }
    if (routeKey !== lastBrowserRouteKey) {
      window.history.pushState(historyState, '', window.location.href);
      lastBrowserRouteKey = routeKey;
    }
  }

  function restoreBrowserRoute(route) {
    if (!route || typeof route !== 'object') return;
    Object.assign(state, {
      page: route.page || 'public',
      selectedPublicGameId: route.selectedPublicGameId || null,
      selectedGameId: route.selectedGameId || null,
      detailTab: route.detailTab || 'status',
      statusSubtab: route.statusSubtab || 'info',
      progressSubtab: route.progressSubtab || 'participants',
      progressTournamentLeague: route.progressTournamentLeague || 'upper',
      statusFormat: route.statusFormat || null,
      editingGameId: route.editingGameId || null,
      operationGameId: route.operationGameId || null,
      operationFormat: route.operationFormat || null,
      operationMenu: route.operationMenu || 'groups',
      operationSubmenu: route.operationSubmenu || 'qualifying',
      showCreateGame: Boolean(route.showCreateGame),
      showLeagueSeries: Boolean(route.showLeagueSeries),
      selectedSeriesId: route.selectedSeriesId || null,
      authTab: route.authTab || 'signup',
    });
  }

  function handleBrowserPopState(event) {
    const route = event.state?.ttgmsRoute;
    if (!route) return;
    restoringBrowserHistory = true;
    restoreBrowserRoute(route);
    render();
    restoringBrowserHistory = false;
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

  function formatDateTimeLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatCount(value) {
    return new Intl.NumberFormat('ko-KR').format(value);
  }

  function formatOptional(value) {
    const text = trimValue(value);
    return text ? escapeHtml(text) : '<span class="muted">미입력</span>';
  }

  function genderLabel(gender) {
    if (gender === 'male') return '남자';
    if (gender === 'female') return '여자';
    return '미입력';
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

  function getRegistrationSource(registration) {
    if (registration.registrationSource === 'manual') return { key: 'manual', label: '개별등록' };
    if (registration.registrationSource === 'bulk') return { key: 'bulk', label: '일괄등록' };
    if (registration.registrationSource === 'online') return { key: 'online', label: '온라인등록' };
    return registration.registeredBy && registration.userId && registration.registeredBy === registration.userId
      ? { key: 'online', label: '온라인등록' }
      : { key: 'bulk', label: '일괄등록' };
  }

  function getGameFormats(game) {
    if (Array.isArray(game.formats) && game.formats.length) return game.formats;
    return game.format && FORMAT_LABELS[game.format] ? [game.format] : [];
  }

  function getFormatMode(game, format) {
    return game?.formatModes?.[format] === 'leagueOnly' ? 'leagueOnly' : 'leagueTournament';
  }

  function getFormatModeLabel(game, format) {
    return getFormatMode(game, format) === 'leagueOnly'
      ? '리그전만'
      : '예선리그 + 본선 토너먼트';
  }

  function renderFormatOptionsWithModes(game = null) {
    return `<div class="format-options format-options--with-modes">${Object.keys(FORMAT_LABELS).map((format) => `<label class="format-option-with-mode"><span class="format-option-with-mode__choice"><input type="checkbox" name="formats" value="${format}" ${game && getGameFormats(game).includes(format) ? 'checked' : ''} /><span>${escapeHtml(FORMAT_LABELS[format])}</span></span><select name="formatMode_${format}" aria-label="${escapeHtml(FORMAT_LABELS[format])} 경기 진행방식"><option value="leagueTournament" ${getFormatMode(game, format) === 'leagueTournament' ? 'selected' : ''}>예선리그 후 토너먼트</option><option value="leagueOnly" ${getFormatMode(game, format) === 'leagueOnly' ? 'selected' : ''}>리그전만</option></select></label>`).join('')}</div>`;
  }

  function isRegistrationClosed(game, format) {
    if (game?.registrationClosed === true) return true;
    return game?.registrationClosed?.[format] === true;
  }

  function getFormatStatus(game, format) {
    if (game?.formatStatuses?.[format] === 'completed') return { key: 'done', label: '경기종료' };
    const schedule = game?.preliminaryMatches?.[format];
    const tournament = getTournamentConfig(game, format);
    const tournamentLeagues = ['upper', 'lower'].filter((league) => tournament?.[league]);
    if (tournamentLeagues.length && tournamentLeagues.every((league) => tournament[league].completed === true)) return { key: 'done', label: '경기종료' };
    if (getFormatMode(game, format) === 'leagueOnly' && schedule?.completed === true) return { key: 'done', label: '경기종료' };
    if (schedule?.matches?.length) return { key: 'progress', label: '경기진행중' };
    if (isRegistrationClosed(game, format)) return { key: 'closed', label: '참가접수마감' };
    return { key: 'open', label: '참가접수중' };
  }

  function getGameStatus(game) {
    const explicitStatus = String(game.status || '').toLowerCase();
    const formats = getGameFormats(game);
    if (explicitStatus === 'completed' || game.completedAt) return { key: 'done', label: '경기종료' };
    const statuses = formats.map((format) => getFormatStatus(game, format));
    if (statuses.some((status) => status.key === 'open')) return { key: 'open', label: '참가접수중' };
    if (statuses.some((status) => status.key === 'closed')) return { key: 'closed', label: '참가접수마감' };
    if (statuses.some((status) => status.key === 'progress')) return { key: 'progress', label: '경기진행중' };
    return { key: 'done', label: '경기종료' };
  }

  function getPublicGameFilterKey(game) {
    const statusKey = getGameStatus(game).key;
    if (statusKey === 'open') return 'open';
    if (statusKey === 'done') return 'done';
    return 'progress';
  }

  function filterGamesByStatus(games, filterName) {
    if (!['open', 'progress', 'done'].includes(filterName)) return games;
    return games.filter((game) => getPublicGameFilterKey(game) === filterName);
  }

  function renderGameStatusFilters(games) {
    const counts = {
      all: games.length,
      open: games.filter((game) => getPublicGameFilterKey(game) === 'open').length,
      progress: games.filter((game) => getPublicGameFilterKey(game) === 'progress').length,
      done: games.filter((game) => getPublicGameFilterKey(game) === 'done').length,
    };
    const filters = [
      ['all', '전체 게임'],
      ['open', '참가접수중'],
      ['progress', '경기진행중'],
      ['done', '경기종료'],
    ];
    return `<div class="public-game-filter-group" role="group" aria-label="게임 상태 필터">${filters.map(([key, label]) => `<button type="button" class="public-game-filter ${state.gameFilter === key ? 'is-active' : ''}" data-game-filter="${key}" aria-pressed="${state.gameFilter === key ? 'true' : 'false'}">${label} <span class="public-game-filter__count">${formatCount(counts[key])}</span></button>`).join('')}</div>`;
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

  function parseRosterRows(rows) {
    if (!rows.length) return { rows: [], error: '등록할 참가선수 데이터가 없습니다.' };
    const header = rows[0].map((cell) => normalizeParticipantName(cell));
    const nicknameIndex = header.findIndex((cell) => ['닉네임', '선수명', '이름', 'name', 'nickname'].includes(cell));
    const memberIdIndex = header.findIndex((cell) => ['아이디', 'id', 'memberid'].includes(cell));
    const genderIndex = header.findIndex((cell) => ['성별', 'gender', 'sex'].includes(cell));
    const rankIndex = header.findIndex((cell) => ['부수', 'rank'].includes(cell));
    const teamNameIndex = header.findIndex((cell) => ['팀명', 'team', 'teamname'].includes(cell));
    const hasHeader = nicknameIndex >= 0;
    if (hasHeader) {
      const expectedHeaders = ['팀명', '닉네임', '아이디', '성별', '부수'];
      const isFixedTemplate = expectedHeaders.every((value, index) => header[index] === normalizeParticipantName(value));
      if (!isFixedTemplate) {
        return { rows: [], error: '다운로드한 양식의 첫 번째 헤더 행은 수정하지 말고 그대로 사용해 주세요.' };
      }
    }
    const dataRows = hasHeader ? rows.slice(1) : rows;
    return { rows: dataRows.map((row) => ({
      nickname: trimValue(row[hasHeader ? nicknameIndex : 0]),
      memberId: hasHeader && memberIdIndex >= 0 ? trimValue(row[memberIdIndex]) : '',
      gender: hasHeader && genderIndex >= 0 ? normalizeRosterGender(row[genderIndex]) : '',
      rank: hasHeader && rankIndex >= 0 ? trimValue(row[rankIndex]) : '',
      teamName: hasHeader && teamNameIndex >= 0 ? trimValue(row[teamNameIndex]) : '',
    })), error: '' };
  }

  function parseRosterText(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) return { rows: [], error: '등록할 참가선수 데이터가 없습니다.' };
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    return parseRosterRows(lines.map((line) => parseDelimitedLine(line, delimiter)));
  }

  function normalizeRosterGender(value) {
    const normalized = normalizeParticipantName(value);
    if (['남자', '남', 'male', 'm'].includes(normalized)) return 'male';
    if (['여자', '여', 'female', 'f'].includes(normalized)) return 'female';
    return '';
  }

  function xmlEscape(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concatBytes(chunks) {
    const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(size);
    let offset = 0;
    chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
    return result;
  }

  function writeUint16(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255]);
  }

  function writeUint32(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  }

  function createStoredZip(files) {
    const encoder = new TextEncoder();
    const localChunks = [];
    const centralChunks = [];
    let offset = 0;
    files.forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(content);
      const checksum = crc32(data);
      const local = concatBytes([
        writeUint32(0x04034b50), writeUint16(20), writeUint16(0x800), writeUint16(0), writeUint16(0), writeUint16(0),
        writeUint32(checksum), writeUint32(data.length), writeUint32(data.length), writeUint16(nameBytes.length), writeUint16(0), nameBytes, data,
      ]);
      const central = concatBytes([
        writeUint32(0x02014b50), writeUint16(20), writeUint16(20), writeUint16(0x800), writeUint16(0), writeUint16(0), writeUint16(0),
        writeUint32(checksum), writeUint32(data.length), writeUint32(data.length), writeUint16(nameBytes.length), writeUint16(0), writeUint16(0), writeUint16(0), writeUint16(0), writeUint32(0), writeUint32(offset), nameBytes,
      ]);
      localChunks.push(local);
      centralChunks.push(central);
      offset += local.length;
    });
    const central = concatBytes(centralChunks);
    const locals = concatBytes(localChunks);
    const end = concatBytes([
      writeUint32(0x06054b50), writeUint16(0), writeUint16(0), writeUint16(files.length), writeUint16(files.length), writeUint32(central.length), writeUint32(locals.length), writeUint16(0),
    ]);
    return concatBytes([locals, central, end]);
  }

  function buildRosterWorkbook() {
    const sheetRows = [
      ['팀명', '닉네임', '아이디', '성별', '부수'],
      ['탁구팀A', '홍길동', 'hong123', '남자', '3부'],
      ['', '김탁구', '', '여자', '4부'],
      ...Array.from({ length: 97 }, () => ['', '', '', '', '']),
    ];
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr/><dimension ref="A1:E100"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="12" customWidth="1"/><col min="5" max="5" width="12" customWidth="1"/></cols><sheetData>${sheetRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => { const ref = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`; const style = rowIndex === 0 ? '1' : '2'; return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xmlEscape(value)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData><sheetProtection sheet="1" objects="1" scenarios="1"/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6F78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="0"/></xf></cellXfs></styleSheet>`;
    const files = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="참가선수명부" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', stylesXml],
      ['xl/worksheets/sheet1.xml', sheetXml],
    ];
    return createStoredZip(files);
  }

  function downloadRosterTemplate() {
    const blob = new Blob([buildRosterWorkbook()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '참가선수명부_양식.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function readZipEntry(bytes, targetName) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endOffset = -1;
    for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }
    if (endOffset < 0) return null;
    const entryCount = view.getUint16(endOffset + 10, true);
    const centralOffset = view.getUint32(endOffset + 16, true);
    let offset = centralOffset;
    const decoder = new TextDecoder();
    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) return null;
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      const localOffset = view.getUint32(offset + 42, true);
      if (name === targetName) {
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);
        if (method === 0) return compressed;
        if (method === 8 && 'DecompressionStream' in window) {
          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return new Uint8Array(await new Response(stream).arrayBuffer());
        }
        return null;
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return null;
  }

  function xlsxColumnIndex(reference) {
    const letters = String(reference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
    return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  }

  async function parseRosterXlsx(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sheetBytes = await readZipEntry(bytes, 'xl/worksheets/sheet1.xml');
    if (!sheetBytes) return { rows: [], error: '엑셀 양식의 첫 번째 시트를 읽을 수 없습니다.' };
    const decoder = new TextDecoder();
    const sheetDocument = new DOMParser().parseFromString(decoder.decode(sheetBytes), 'application/xml');
    if (sheetDocument.querySelector('parsererror')) return { rows: [], error: '엑셀 양식의 내용을 읽을 수 없습니다.' };
    const sharedBytes = await readZipEntry(bytes, 'xl/sharedStrings.xml');
    const sharedDocument = sharedBytes ? new DOMParser().parseFromString(decoder.decode(sharedBytes), 'application/xml') : null;
    const sharedStrings = sharedDocument ? [...sharedDocument.getElementsByTagName('si')].map((item) => [...item.getElementsByTagName('t')].map((node) => node.textContent).join('')) : [];
    const rows = [...sheetDocument.getElementsByTagName('row')].map((row) => {
      const cells = [];
      [...row.getElementsByTagName('c')].forEach((cell) => {
        const column = xlsxColumnIndex(cell.getAttribute('r'));
        const type = cell.getAttribute('t');
        const valueNode = cell.getElementsByTagName(type === 'inlineStr' ? 't' : 'v')[0];
        let value = valueNode?.textContent || '';
        if (type === 's') value = sharedStrings[Number(value)] || '';
        cells[column] = value;
      });
      return cells.map((value) => value || '');
    });
    return parseRosterRows(rows);
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
            <button class="game-list-action game-list-action--primary" type="submit"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z" /><circle cx="12" cy="15" r="1.2" /></svg><span>로그인</span></button>
          </div>
        </form>
      `;
    }

    return `
      <form class="form-stack auth-signup-form" data-form="signup" novalidate>
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
            <label class="choice-option">남자 <input type="radio" name="gender" value="male" required /></label>
            <label class="choice-option">여자 <input type="radio" name="gender" value="female" required /></label>
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
        ${renderRegionFields('signup', {}, true)}
        <div class="helper-row">
          <span>필수 항목을 모두 입력해야 가입할 수 있습니다.</span>
          <span>활동지역을 기준으로 주변 탁구장을 우선 안내합니다.</span>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" type="submit"><svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.8-4.1 3.1-6.2 7-6.2s6.2 2.1 7 6.2"></path></svg><span>회원가입</span></button>
        </div>
      </form>
    `;
  }

  function renderAuthPage() {
    const isLogin = state.authTab === 'login';
    return `
      <section class="auth-simple">
        <div class="panel auth-simple__card">
          <div class="section-heading create-game-heading auth-heading">
            <div><h1>${isLogin ? '로그인' : '회원가입'}</h1></div>
            <button type="button" class="create-game-close" aria-label="${isLogin ? '로그인' : '회원가입'} 화면 닫기" data-open-public><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
          </div>
          ${renderAuthTab()}
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
    const formatStatuses = getGameFormats(game).map((format) => { const status = getFormatStatus(game, format); return `<span class="game-format-status game-format-status--${status.key}">${escapeHtml(FORMAT_LABELS[format])} ${escapeHtml(status.label)}</span>`; }).join('');
    return `
      <article class="game-card game-list-item" data-game-open="${escapeHtml(game.id)}">
        <div class="game-list-item__body"><div class="game-list-item__title-row"><span class="game-status game-status--${gameStatus.key}">${gameStatus.label}</span><h3 class="game-title-link" data-game-open="${escapeHtml(game.id)}">${escapeHtml(game.title)}</h3></div>${game.seriesName ? `<div class="game-series-label">${escapeHtml(game.seriesName)}${game.seriesRound ? ` · ${escapeHtml(String(game.seriesRound))}회차` : ''}</div>` : ''}<div class="game-format-status-list">${formatStatuses}</div><time class="game-list-item__date" datetime="${escapeHtml(game.scheduledAt)}">${escapeHtml(formatDateTime(game.scheduledAt))}</time></div>
      </article>
    `;
  }

  function renderPublicGamesPage() {
    const allGames = state.games
      .slice()
      .sort((left, right) => new Date(left.scheduledAt) - new Date(right.scheduledAt));
    const games = filterGamesByStatus(allGames, state.gameFilter);
    const gameList = games.length
      ? games.map((game) => renderGameCard(game, null, true)).join('')
      : `<div class="empty-state">${allGames.length ? '선택한 상태의 게임이 없습니다.' : '아직 생성된 게임이 없습니다. 운영자가 게임을 생성하면 이곳에 표시됩니다.'}</div>`;

    return `
      <section class="panel section-card">
        <div class="section-heading public-game-list-heading">
          <div>
            <h2>탁구경기 목록</h2>
          </div>
        </div>
        ${renderGameStatusFilters(allGames)}
        <div class="game-list">${gameList}</div>
      </section>
    `;
  }

  function renderVenueFinderPage(currentUser) {
    const activitySelection = inferRegionSelection(currentUser || {});
    const activityRegion = regionLabel(activitySelection.sido, activitySelection.sigungu) || trimValue(currentUser?.region);
    const allVenues = Array.isArray(state.venues) ? state.venues : [];
    const regions = [...new Set(allVenues.map((venue) => trimValue(venue.region)).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ko'));
    const search = trimValue(state.venueSearch).toLowerCase();
    const normalizeRegion = (value) => trimValue(value).toLowerCase().replace(/\s+/g, '');
    const canonicalRegion = (value) => {
      const normalized = normalizeRegion(value);
      const aliases = [
        ['서울특별시', '서울특별시'], ['서울시', '서울특별시'], ['서울', '서울특별시'],
        ['부산광역시', '부산광역시'], ['부산시', '부산광역시'], ['부산', '부산광역시'],
        ['대구광역시', '대구광역시'], ['대구시', '대구광역시'], ['대구', '대구광역시'],
        ['인천광역시', '인천광역시'], ['인천시', '인천광역시'], ['인천', '인천광역시'],
        ['광주광역시', '광주광역시'], ['광주시', '광주광역시'], ['광주', '광주광역시'],
        ['대전광역시', '대전광역시'], ['대전시', '대전광역시'], ['대전', '대전광역시'],
        ['울산광역시', '울산광역시'], ['울산시', '울산광역시'], ['울산', '울산광역시'],
        ['경기도', '경기도'], ['경기', '경기도'],
        ['강원특별자치도', '강원특별자치도'], ['강원도', '강원특별자치도'], ['강원', '강원특별자치도'],
        ['충청북도', '충청북도'], ['충북', '충청북도'], ['충청남도', '충청남도'], ['충남', '충청남도'],
        ['전북특별자치도', '전북특별자치도'], ['전라북도', '전북특별자치도'], ['전북', '전북특별자치도'],
        ['전라남도', '전라남도'], ['전남', '전라남도'], ['경상북도', '경상북도'], ['경북', '경상북도'],
        ['경상남도', '경상남도'], ['경남', '경상남도'], ['제주특별자치도', '제주특별자치도'],
        ['제주도', '제주특별자치도'], ['제주', '제주특별자치도'],
      ].sort((left, right) => right[0].length - left[0].length);
      const alias = aliases.find(([prefix]) => normalized.startsWith(prefix.toLowerCase()));
      return alias ? `${alias[1].toLowerCase()}${normalized.slice(alias[0].length)}` : normalized;
    };
    const matchesActivity = (venue) => {
      const wanted = canonicalRegion(activityRegion);
      const venueRegion = canonicalRegion(`${venue.regionSido || ''} ${venue.regionSigungu || ''} ${venue.region || ''}`);
      const venueAddress = canonicalRegion(venue.address || '');
      return Boolean(wanted && (venueRegion === wanted || (!venueRegion && venueAddress.includes(wanted))));
    };
    const matchesSearch = (venue) => !search || `${venue.name} ${venue.address} ${venue.phone || ''} ${venue.region || ''}`.toLowerCase().includes(search);
    const regionFilter = state.venueRegionFilter || 'all';
    const filteredVenues = allVenues
      .filter((venue) => regionFilter === 'all' || (regionFilter === 'activity' ? matchesActivity(venue) : trimValue(venue.region) === regionFilter))
      .filter(matchesSearch)
      .sort((left, right) => (activityRegion && matchesActivity(left) !== matchesActivity(right) ? (matchesActivity(left) ? -1 : 1) : left.name.localeCompare(right.name, 'ko')));
    const cards = filteredVenues.length ? filteredVenues.map((venue) => `<article class="venue-card"><div class="venue-card__heading"><h3>${escapeHtml(venue.name)}</h3>${venue.region ? `<span>${escapeHtml(venue.region)}</span>` : ''}</div><p class="venue-card__address"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg>${escapeHtml(venue.address)}</p>${venue.phone ? `<a class="venue-card__phone" href="tel:${escapeHtml(venue.phone)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3l1.2 4-2 1.5a14 14 0 0 0 5.3 5.3l1.5-2 4 1.2v3c0 1.1-.9 2-2 2C11.4 19 5 12.6 5 5c0-1.1.9-2 2-2z" /></svg>${escapeHtml(venue.phone)}</a>` : '<span class="venue-card__phone muted">전화번호 미등록</span>'}${venue.mapUrl ? `<a class="venue-card__map" href="${escapeHtml(venue.mapUrl)}" target="_blank" rel="noopener">지도 보기</a>` : ''}</article>`).join('') : '<div class="empty-state">조건에 맞는 탁구장이 없습니다.</div>';
    return `<section class="panel section-card venue-finder"><div class="section-heading venue-finder__heading"><div><p class="section-kicker">탁구인을 위한 부가서비스</p><h1>탁구장 찾기</h1><p class="subtle-note">지역별 탁구장 정보를 확인할 수 있습니다.</p></div><button type="button" class="create-game-close" aria-label="탁구장 찾기 닫기" data-back-dashboard><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button></div><div class="venue-finder__controls"><label class="venue-finder__search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 5 5" /></svg><input type="search" data-venue-search placeholder="탁구장명, 주소 검색" value="${escapeHtml(state.venueSearch || '')}" /></label><select data-venue-region-filter aria-label="탁구장 지역 선택"><option value="all" ${regionFilter === 'all' ? 'selected' : ''}>전체지역</option>${activityRegion ? `<option value="activity" ${regionFilter === 'activity' ? 'selected' : ''}>내 활동지역 (${escapeHtml(activityRegion)})</option>` : ''}${regions.map((region) => `<option value="${escapeHtml(region)}" ${regionFilter === region ? 'selected' : ''}>${escapeHtml(region)}</option>`).join('')}</select></div><div class="venue-finder__summary">${escapeHtml(String(filteredVenues.length))}개 탁구장${activityRegion && regionFilter === 'activity' ? ` · ${escapeHtml(activityRegion)} 우선` : ''}</div><div class="venue-list">${cards}</div></section>`;
  }

  function renderGameDetailMenu(game, isOwner) {
    return `<div class="game-detail-actions" aria-label="게임 메뉴"><button type="button" class="game-list-action" ${getCurrentUser() ? 'data-back-games' : 'data-public-back'}><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span>전체게임목록</span></button><button type="button" class="game-list-action ${state.detailTab === 'status' && !state.operationGameId ? 'is-active' : ''}" data-detail-tab="status"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" /></svg><span>경기요강</span></button><button type="button" class="game-list-action ${state.detailTab === 'progress' && !state.operationGameId ? 'is-active' : ''}" data-detail-tab="progress"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7" /></svg><span>경기진행현황</span></button>${isOwner ? `<button type="button" class="game-list-action ${state.operationGameId === game.id ? 'is-active' : ''}" data-open-operations="${escapeHtml(game.id)}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="8" /></svg><span>경기운영</span></button>` : ''}</div>`;
  }

  function getPublicFormat(game) {
    const formats = getGameFormats(game);
    return formats.includes(state.statusFormat) ? state.statusFormat : formats[0];
  }

  function renderGameRules(game, currentUser) {
    const operator = state.users.find((user) => user.id === game.operatorId);
    const formats = getGameFormats(game);
    const isOwner = currentUser?.id === game.operatorId;
    const hasAppliedAllFormats = currentUser && formats.length > 0 && formats.every((format) => getGameRegistrations(game, format).some((registration) => registration.userId === currentUser.id));
    const allFormatsClosed = formats.length > 0 && formats.every((format) => isRegistrationClosed(game, format));
    const applyAction = isOwner || allFormatsClosed || hasAppliedAllFormats ? '' : `<div class="public-apply-action"><button type="button" class="btn btn-primary" data-game-apply="${escapeHtml(game.id)}">참가신청</button></div>`;
    const editAction = currentUser?.id === game.operatorId ? `<div class="game-edit-bottom-action"><button type="button" class="game-list-action" data-edit-game="${escapeHtml(game.id)}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h4L19 9l-4-4L5 15v4zM13 7l4 4" /></svg><span>게임수정</span></button></div>` : '';
    const canDelete = currentUser?.role === 'admin' || (isOwner && !formats.some((format) => isRegistrationClosed(game, format)));
    const deleteAction = canDelete ? `<div class="game-edit-bottom-action"><button type="button" class="game-list-action game-list-action--danger" data-delete-game="${escapeHtml(game.id)}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M9 7V4h6v3M7 7l1 13h8l1-13" /></svg><span>${currentUser?.role === 'admin' ? '게임 삭제(관리자)' : '게임 삭제'}</span></button></div>` : '';
    const venueName = game.venueName || game.location;
    const venueAddress = game.venueAddress || '';
    const venuePhone = game.venuePhone || '';
    const operatorPhone = game.operatorPhone || operator?.phone || '';
    return `<dl class="meta-grid public-detail-meta"><div><dt>게임장소</dt><dd>${escapeHtml(venueName)}</dd></div><div><dt>탁구장 주소</dt><dd>${escapeHtml(venueAddress || '미입력')}</dd></div><div><dt>탁구장 전화번호</dt><dd>${escapeHtml(venuePhone || '미입력')}</dd></div><div><dt>게임일시</dt><dd>${escapeHtml(formatDateTime(game.scheduledAt))}</dd></div><div><dt>운영자</dt><dd>${escapeHtml(game.operatorNickname)}</dd></div><div><dt>운영자 휴대폰</dt><dd>${escapeHtml(operatorPhone || '미입력')}</dd></div><div><dt>경기방식</dt><dd class="format-detail-list">${formats.map((format) => `<span class="format-detail-item">${escapeHtml(FORMAT_LABELS[format])} <span class="format-detail-mode">(${escapeHtml(getFormatModeLabel(game, format))})</span></span>`).join(' · ')}</dd></div><div><dt>최대참가인원</dt><dd>${escapeHtml(String(game.maxParticipants))}명</dd></div></dl><div class="public-detail-note"><p class="section-kicker">게임안내</p><p>${game.note ? escapeHtml(game.note) : '<span class="muted">추가 안내가 없습니다.</span>'}</p></div>${applyAction}${editAction}${deleteAction}`;
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
    return `<div class="schedule-table-wrap"><table class="public-data-table public-participant-table"><thead><tr><th>소속팀</th><th>선수명</th><th>성별</th><th>통합부수</th></tr></thead><tbody>${registrations.map((participant) => `<tr><td>${escapeHtml(participant.teamName || '-')}</td><td>${escapeHtml(participant.nickname || '-')}</td><td>${escapeHtml(genderLabel(participant.gender))}</td><td>${escapeHtml(participant.rank || '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderPublicLeagueStandings(game, format) {
    const groups = game.qualifyingGroups?.[format]?.groups || [];
    if (!groups.length) return '<div class="empty-state">아직 예선 리그전 조편성이 생성되지 않았습니다.</div>';
    const standingGroups = new Map(getQualifyingStandings(game, format).map((group) => [group.name, group]));
    const maxPlayers = Math.max(...groups.map((group) => group.players.length));
    const leagueOnly = getFormatMode(game, format) === 'leagueOnly';
    const summaryTable = `<table class="public-league-summary public-league-summary--${escapeHtml(format)}"><tbody>${groups.map((group) => { const standingGroup = standingGroups.get(group.name); const participantCells = group.players.map((unit) => { const record = standingGroup?.standings.find((item) => item.player.playerKey === unit.playerKey); const rank = record?.rank; const members = unit.members?.length ? unit.members : [unit]; const names = members.map((member) => { const nickname = String(member.nickname || unit.nickname || unit.label); const displayName = format === 'team' && nickname.length > 1 ? nickname.slice(1) : nickname; return format === 'team' ? `<span class="public-league-entry__name">${escapeHtml(displayName)}</span>` : `<span class="public-league-entry__name">${escapeHtml(nickname)}</span><span class="public-league-entry__skill"> (${escapeHtml(member.rank || unit.rank || '-')})</span>`; }).join(', '); const team = format === 'singles' ? unit.teamName || unit.members?.[0]?.teamName || '-' : unit.label || unit.teamName || '-'; const recordText = record && (record.wins || record.losses || record.setsFor || record.setsAgainst) ? `<small class="public-league-entry__record">${record.wins}승 ${record.losses}패</small>` : ''; const primary = format === 'team' ? `<strong class="public-league-entry__team">${escapeHtml(team)}</strong><small class="public-league-entry__members">${names}</small>` : `<strong>${names}</strong><small>${escapeHtml(team)}</small>`; return `<td class="public-league-participant"><div class="public-league-entry rank-row rank-row--${rank || 'pending'}"><div>${rank ? `<span class="public-league-entry__rank">${rank}위</span>` : ''}${primary}${recordText}</div></div></td>`; }).join(''); const emptyCells = Array.from({ length: maxPlayers - group.players.length }, () => '<td class="public-league-participant public-league-participant--empty">-</td>').join(''); return `<tr><th class="public-league-summary__group">${escapeHtml(group.name)}</th>${participantCells}${emptyCells}</tr>`; }).join('')}</tbody></table>`;
    const matches = game.preliminaryMatches?.[format]?.matches || [];
    const leagueOnlyMatrices = leagueOnly
      ? groups.map((group) => `<section class="public-league-matrix"><h4>${escapeHtml(group.name)} 경기결과</h4>${renderScheduleMatrix(group, matches.filter((match) => match.groupName === group.name))}</section>`).join('')
      : '';
    const results = '';
    return `<div class="public-league-results-controls" aria-label="리그전 결과표 크기 조정"><button type="button" class="game-list-action" data-league-results-zoom="out" aria-label="결과표 축소"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6"></path></svg></button><button type="button" class="game-list-action zoom-value-control" data-league-results-zoom="reset" aria-label="리그전 결과표 기본 크기">기본 크기</button><button type="button" class="game-list-action" data-league-results-zoom="in" aria-label="결과표 확대"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6M11 8v6"></path></svg></button><button type="button" class="game-list-action competition-fullscreen-button" data-progress-fullscreen><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg><span data-progress-fullscreen-label>전체화면 전환</span></button></div><div class="public-league-results-viewport public-league-results-viewport--${leagueOnly ? 'league-only' : 'league-tournament'}" data-public-league-viewport><div class="public-league-results-stage" data-public-league-stage>${summaryTable}${leagueOnlyMatrices}</div></div>${results}`;
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

  function wrapTournamentBracket(content, publicView = false) {
    return `<div class="tournament-bracket-viewport" data-tournament-viewport${publicView ? ' data-public-tournament-viewport' : ''}><div class="tournament-bracket-stage" data-tournament-stage>${content}</div></div>`;
  }

  function tournamentRoundTitle(bracket, roundIndex, isFinal = false) {
    return isFinal ? '결승' : `${bracket.size / (2 ** roundIndex)}강`;
  }

  function getTournamentBaseZoom() {
    return 3;
  }

  function isTabletDevice() {
    const userAgent = navigator.userAgent || '';
    return /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function getLeagueBaseZoom() {
    // PC에서는 화면 너비에 맞춘 결과표를 다시 확대하지 않아 카드가 화면 밖으로 밀리지 않게 한다.
    return isTabletDevice() ? 1.4 : 1;
  }

  function renderPublicTournamentBracket(bracket, includeFullscreen = false) {
    if (!bracket?.rounds?.length) return '<div class="empty-state">아직 토너먼트 대진표가 생성되지 않았습니다.</div>';
    if (!state.tournamentZoomInitialized) {
      state.tournamentZoom = getTournamentBaseZoom();
      state.tournamentZoomInitialized = true;
    }
    syncTournamentBracket(bracket);
    const fullscreenControl = includeFullscreen ? `<button type="button" class="game-list-action competition-fullscreen-button" data-progress-fullscreen><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg><span data-progress-fullscreen-label>전체화면 전환</span></button>` : '';
    const controls = `<div class="public-tournament-results-controls" aria-label="토너먼트 대진표 크기 조정"><button type="button" class="game-list-action" data-tournament-zoom="out" aria-label="토너먼트 축소"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6"></path></svg></button><button type="button" class="game-list-action zoom-value-control" data-tournament-zoom="reset" aria-label="토너먼트 대진표 기본 크기">기본 크기</button><button type="button" class="game-list-action" data-tournament-zoom="in" aria-label="토너먼트 확대"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6M11 8v6"></path></svg></button>${fullscreenControl}</div>`;
    if (bracket.rounds.length === 1) return `${controls}${renderTournamentPodium(bracket)}${wrapTournamentBracket(`<div class="tournament-bracket public-tournament-bracket tournament-bracket--size-${bracket.size}"><div class="tournament-rounds tournament-rounds--single">${renderPublicTournamentRound(bracket.rounds[0], true, tournamentRoundTitle(bracket, 0, true), bracket.size, 0)}</div></div>`, true)}`;
    const roundsBeforeFinal = bracket.rounds.slice(0, -1);
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const leftRounds = roundsBeforeFinal.map((round) => round.slice(0, Math.ceil(round.length / 2)).map((match, index) => ({ ...match, bracketLocalIndex: index })));
    const rightRounds = roundsBeforeFinal.map((round) => round.slice(Math.ceil(round.length / 2)).reverse().map((match, index) => ({ ...match, bracketLocalIndex: index })));
    return `${controls}${renderTournamentPodium(bracket)}${wrapTournamentBracket(`<div class="tournament-bracket public-tournament-bracket tournament-bracket--size-${bracket.size} tournament-bracket--split"><div class="tournament-side-bracket tournament-side-bracket--left">${leftRounds.map((round, index) => renderPublicTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div><div class="tournament-center-bracket">${renderPublicTournamentRound(finalRound, true, tournamentRoundTitle(bracket, bracket.rounds.length - 1, true), bracket.size, bracket.rounds.length - 1)}</div><div class="tournament-side-bracket tournament-side-bracket--right">${rightRounds.map((round, index) => renderPublicTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div></div>`, true)}`;
  }

  function renderCompetitionView(game, currentUser, format) {
    const tournamentEnabled = getFormatMode(game, format) !== 'leagueOnly';
    const progressSubtab = tournamentEnabled && ['participants', 'league', 'tournament'].includes(state.progressSubtab) ? state.progressSubtab : (state.progressSubtab === 'league' ? 'league' : 'participants');
    const config = getTournamentConfig(game, format);
    const progressTabs = [
      ['participants', '참가선수', '<circle cx="9" cy="8" r="3"></circle><path d="M3 20c.7-3.3 2.7-5 6-5s5.3 1.7 6 5M16 6h5M18.5 3.5v5"></path>'],
      ['league', '리그전', '<circle cx="7" cy="7" r="2"></circle><circle cx="17" cy="7" r="2"></circle><circle cx="12" cy="17" r="2"></circle><path d="M8.5 8.5 11 15M15.5 8.5 13 15"></path>'],
      ['tournament', '토너먼트', '<path d="M5 4v16M19 4v16M5 8h6a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h2M5 16h6a3 3 0 0 0 3-3v-2a3 3 0 0 1 3-3h2"></path>']
    ].filter(([value]) => tournamentEnabled || value !== 'tournament');
    const participantCount = getGameRegistrations(game, format).length;
    const isOwner = currentUser?.id === game.operatorId;
    const groupSetup = game.qualifyingGroups?.[format];
    const canViewGroups = isOwner || groupSetup?.isPublic === true;
    const tournamentLeagues = ['upper', 'lower'].filter((league) => config?.[league]);
    const tournamentLeague = tournamentLeagues.includes(state.progressTournamentLeague) ? state.progressTournamentLeague : tournamentLeagues[0];
    const tournamentBracket = config?.[tournamentLeague];
    const tournamentContent = `${tournamentLeagues.length ? `<div class="tournament-progress-league-tabs" role="tablist" aria-label="토너먼트 리그 선택">${tournamentLeagues.map((league) => `<button type="button" class="game-list-action tournament-progress-league-tab ${league === tournamentLeague ? 'is-active' : ''}" data-tournament-progress-league="${league}"><span>${league === 'lower' ? '하위리그' : '상위리그'}</span><small>${config[league].completed ? '종료' : '진행 중'}</small></button>`).join('')}</div>${canViewGroups && tournamentBracket ? renderPublicTournamentBracket(tournamentBracket, true) : !canViewGroups ? '<div class="empty-state">운영자가 경기 진행을 준비 중입니다.</div>' : ''}` : '<div class="empty-state">아직 본선 토너먼트가 생성되지 않았습니다.</div>'}`;
    const progressContent = progressSubtab === 'participants' ? `<div class="competition-content-heading"><h3>[${escapeHtml(FORMAT_LABELS[format])} 참가자 목록]</h3><span>총 ${participantCount}명/팀</span></div>${renderPublicParticipantList(game, format)}` : progressSubtab === 'league' ? `${canViewGroups ? renderPublicLeagueStandings(game, format) : '<div class="empty-state">운영자가 조편성을 준비 중입니다.</div>'}` : tournamentContent;
    return `<div class="competition-view"><div class="competition-progress-toolbar"><div class="format-selector" role="tablist" aria-label="경기종목">${getGameFormats(game).map((item) => `<button type="button" class="format-selector__item ${item === format ? 'is-active' : ''}" data-status-format="${escapeHtml(item)}"><svg class="progress-tab__icon" viewBox="0 0 24 24" aria-hidden="true">${getFormatIconSvg(item)}</svg><span>${escapeHtml(FORMAT_LABELS[item])}</span></button>`).join('')}</div></div><div class="competition-subtabs competition-progress__tabs" role="tablist" aria-label="경기진행 메뉴">${progressTabs.map(([value, label, icon]) => `<button type="button" class="game-list-action progress-tab ${progressSubtab === value ? 'is-active' : ''}" data-status-progress="${value}"><svg class="game-list-action__icon progress-tab__icon" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span></button>`).join('')}</div>${progressContent}</div>`;
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
    const isOperating = isOwner && state.operationGameId === game.id;
    return `<section class="panel section-card public-game-detail"><div class="game-detail-header"><h1 class="game-detail-title">${escapeHtml(game.title)}</h1>${renderGameDetailMenu(game, isOwner)}</div>${isOperating ? renderOperationsPage(currentUser, true) : ''}${!isOperating && state.detailTab === 'status' ? renderGameRules(game, currentUser) : ''}${!isOperating && state.detailTab === 'progress' ? renderCompetitionView(game, currentUser, format) : ''}${!isOperating && state.detailTab === 'applications' ? renderApplicationsView(game, currentUser) : ''}</section>`;
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

  function getKnownVenues() {
    const venues = [...state.venues];
    state.games.forEach((game) => {
      if (!game.venueId || !game.venueName) return;
      if (venues.some((venue) => venue.id === game.venueId)) return;
      venues.push({ id: game.venueId, name: game.venueName, address: game.venueAddress || '', phone: game.venuePhone || '', status: 'approved' });
    });
    return venues.sort((left, right) => String(left.name).localeCompare(String(right.name), 'ko'));
  }

  function renderSeriesOptions(selectedId = '') {
    const currentUser = getCurrentUser();
    const options = state.leagueSeries
      .filter((series) => series.status === 'active' && (currentUser?.role === 'admin' || series.ownerId === currentUser?.id))
      .map((series) => `<option value="${escapeHtml(series.id)}" ${series.id === selectedId ? 'selected' : ''}>${escapeHtml(series.venueName)} · ${escapeHtml(series.name)}</option>`)
      .join('');
    return `<option value="">정기리그 없이 독립 경기</option>${options}`;
  }

  function renderLeagueSeriesPage(currentUser) {
    const venues = getKnownVenues();
    const ownedSeries = state.leagueSeries.filter((series) => series.ownerId === currentUser.id || currentUser.role === 'admin');
    return `
      <section class="panel section-card league-series-page">
        <div class="section-heading">
          <div><p class="section-kicker">정기 경기 관리</p><h1>정기리그 관리</h1><p class="section-note">탁구장별 정기리그를 등록해 두고 매 회차 경기를 연결해서 운영할 수 있습니다.</p></div>
          <button type="button" class="create-game-close" aria-label="정기리그 관리 닫기" data-back-dashboard><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
        </div>
        <form class="league-series-create" data-form="league-series">
          <div class="league-series-create__heading"><strong>새 정기리그 등록</strong><span>금요리그, 월정기리그처럼 반복 운영하는 경기 묶음입니다.</span></div>
          <div class="field-grid league-series-create__fields">
            <div class="field"><label for="leagueSeriesVenue">탁구장</label><select id="leagueSeriesVenue" name="venueId" required><option value="">탁구장 선택</option>${venues.map((venue) => `<option value="${escapeHtml(venue.id)}">${escapeHtml(venue.name)} · ${escapeHtml(venue.address || '주소 미입력')}</option>`).join('')}</select></div>
            <div class="field"><label for="leagueSeriesName">정기리그명</label><input id="leagueSeriesName" name="name" required placeholder="예: 금요리그" /></div>
            <div class="field"><label for="leagueSeriesSchedule">운영 일정</label><input id="leagueSeriesSchedule" name="scheduleLabel" placeholder="예: 매주 금요일" /></div>
            <div class="field"><label for="leagueSeriesMax">기본 참가인원</label><input id="leagueSeriesMax" name="defaultMaxParticipants" type="number" min="1" placeholder="선택 입력" /></div>
          </div>
          <div class="field"><label for="leagueSeriesDescription">운영 안내</label><textarea id="leagueSeriesDescription" name="description" placeholder="정기리그 운영 규칙이나 참가 안내"></textarea></div>
          <div class="field"><span class="field-label">기본 경기형식</span><div class="choice-row"><label class="choice-option">개인전 <input type="checkbox" name="defaultFormats" value="singles" checked /></label><label class="choice-option">복식 <input type="checkbox" name="defaultFormats" value="doubles" /></label><label class="choice-option">단체전 <input type="checkbox" name="defaultFormats" value="team" /></label></div></div>
          <div class="button-row"><button class="btn btn-primary" type="submit">정기리그 등록</button></div>
        </form>
        <div class="league-series-list">
          <div class="section-heading"><div><p class="section-kicker">등록된 정기리그</p><h2>정기리그 목록</h2></div><span class="subtle-note">${ownedSeries.length}개</span></div>
          ${ownedSeries.length ? ownedSeries.map((series) => `<article class="league-series-card"><div class="league-series-card__body"><strong>${escapeHtml(series.name)}</strong><span>${escapeHtml(series.venueName)} · ${escapeHtml(series.scheduleLabel || '운영 일정 미입력')}</span><small>${escapeHtml(series.description || '운영 안내가 없습니다.')} · ${series.gameCount}회 운영</small></div><button type="button" class="btn btn-secondary" data-series-create-game="${escapeHtml(series.id)}">이번 회차 경기 생성</button></article>`).join('') : '<div class="empty-state">등록된 정기리그가 없습니다. 위에서 첫 정기리그를 등록해 주세요.</div>'}
        </div>
      </section>
    `;
  }

  function renderGamesSection(currentUser) {
    const allGames = state.games
      .slice()
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const filteredGames = state.gameFilter === 'mine'
      ? allGames.filter((game) => game.operatorId === currentUser.id)
      : filterGamesByStatus(allGames, state.gameFilter);

    const gamesPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(filteredGames.length / gamesPerPage));
    const currentPage = Math.min(Math.max(state.gamePage, 1), totalPages);
    const pageStart = (currentPage - 1) * gamesPerPage;
    const visibleGames = filteredGames.slice(pageStart, pageStart + gamesPerPage);
    const listTitle = state.gameFilter === 'mine' ? '내가 생성한 게임' : '탁구경기 목록';

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

    const gameFilterAction = state.gameFilter === 'mine'
      ? '<button type="button" class="game-list-action is-active" data-game-filter="all" aria-pressed="true"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="8" cy="5" r="1.5" /><circle cx="14" cy="12" r="1.5" /><circle cx="10" cy="19" r="1.5" /></svg><span>전체 게임</span></button>'
      : '<button type="button" class="game-list-action" data-game-filter="mine" aria-pressed="false"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-3.3 3.2-5 7-5s6.2 1.7 7 5" /></svg><span>내 게임</span></button>';

    return `
      <section class="panel section-card">
        <div class="section-heading dashboard-game-list-heading">
          <div>
            <h2>${listTitle}</h2>
          </div>
          <div class="game-list-actions" aria-label="게임 목록 작업">
            <button type="button" class="game-list-action game-list-action--primary" data-show-create-game><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>게임 생성</span></button>
            <button type="button" class="game-list-action" data-show-league-series><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.5" /><circle cx="14" cy="12" r="1.5" /><circle cx="10" cy="18" r="1.5" /></svg><span>정기리그 관리</span></button>
            ${gameFilterAction}
          </div>
        </div>
        ${state.gameFilter === 'mine' ? '' : renderGameStatusFilters(allGames)}
        <div class="game-list">
          ${gameList}
        </div>
        ${pagination}
      </section>
    `;
  }

  function renderCreateGameForm(currentUser) {
    const selectedSeries = state.leagueSeries.find((series) => series.id === state.selectedSeriesId) || null;
    const selectedVenue = selectedSeries ? getKnownVenues().find((venue) => venue.id === selectedSeries.venueId) : null;
    const seriesDefaults = selectedSeries ? {
      formats: selectedSeries.defaultFormats,
      formatModes: selectedSeries.defaultFormatModes,
    } : null;
    return `
      <section class="panel section-card create-game-panel">
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
            <label for="gameVenueName"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg>탁구장명</span></label>
            <input id="gameVenueName" name="venueName" type="search" list="gameVenueSuggestions" data-venue-name data-venue-address-target="gameVenueAddress" data-venue-phone-target="gameVenuePhone" required value="${escapeHtml(selectedVenue?.name || '')}" placeholder="탁구장 이름 검색" />
            <datalist id="gameVenueSuggestions">${renderVenueSuggestions()}</datalist>
          </div>

          <div class="field">
            <label for="gameVenueAddress"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg>탁구장 주소</span></label>
            <input id="gameVenueAddress" name="venueAddress" type="text" required value="${escapeHtml(selectedVenue?.address || '')}" placeholder="도로명 주소를 입력하세요" />
            <small class="field-hint">등록된 탁구장을 선택하면 주소가 자동으로 입력됩니다.</small>
          </div>

          <div class="field">
            <label for="gameVenuePhone"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3l1.2 4-2 1.5a14 14 0 0 0 5.3 5.3l1.5-2 4 1.2v3c0 1.1-.9 2-2 2C11.4 19 5 12.6 5 5c0-1.1.9-2 2-2z" /></svg>탁구장 전화번호</span></label>
            <input id="gameVenuePhone" name="venuePhone" type="tel" value="${escapeHtml(selectedVenue?.phone || '')}" placeholder="예: 032-123-4567" />
          </div>

          <div class="field">
            <label for="gameSeriesId"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.5" /><circle cx="14" cy="12" r="1.5" /><circle cx="10" cy="18" r="1.5" /></svg>정기리그 연결</span></label>
            <select id="gameSeriesId" name="seriesId">${renderSeriesOptions(state.selectedSeriesId || '')}</select>
            <small class="field-hint">정기리그를 선택하면 이 경기가 해당 탁구장의 회차로 관리됩니다.</small>
          </div>

          <div class="field">
            <span class="field-label"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4c3 0 5 2 5 5v4M17 20c-3 0-5-2-5-5V9" /><ellipse cx="7" cy="4" rx="3" ry="2" /><ellipse cx="17" cy="20" rx="3" ry="2" /></svg>경기형식</span></span>
            ${renderFormatOptionsWithModes(seriesDefaults)}
          </div>

          <div class="field-grid create-game-date-row">
            <div class="field">
              <label for="gameMaxParticipants"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-3.3 3.2-5 7-5s6.2 1.7 7 5" /></svg>최대참가인원</span></label>
              <input id="gameMaxParticipants" name="maxParticipants" type="number" min="1" step="1" required value="${escapeHtml(String(selectedSeries?.defaultMaxParticipants || ''))}" />
            </div>
            <div class="field">
              <label for="gameScheduledAt"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>게임일시</span></label>
              <input id="gameScheduledAt" name="scheduledAt" type="datetime-local" required />
            </div>
          </div>

          <div class="field">
            <label for="gameNote"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>게임안내(선택)</span></label>
            <textarea id="gameNote" name="note"></textarea>
          </div>

          <div class="game-edit-bottom-action">
            <button class="game-list-action game-list-action--primary" type="submit"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>게임 생성</span></button>
          </div>
        </form>
      </section>
    `;
  }

  function renderEditGameForm(game) {
    return `
      <section class="panel section-card game-edit">
        <div class="section-heading create-game-heading">
          <div>
            <h2><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h4L19 9l-4-4L5 15v4zM13 7l4 4" /></svg>게임 수정</span></h2>
          </div>
          <button type="button" class="create-game-close" aria-label="게임 수정 닫기" data-cancel-game-edit><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
        </div>

        <form class="form-stack" data-form="game-edit" data-game-id="${escapeHtml(game.id)}">
          <div class="field">
            <label for="editGameTitle"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5zM14 4v5h5" /></svg>게임명</span></label>
            <input id="editGameTitle" name="title" type="text" required value="${escapeHtml(game.title)}" />
          </div>
          <div class="field">
            <label for="editGameVenueName"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg>탁구장명</span></label>
            <input id="editGameVenueName" name="venueName" type="search" list="editGameVenueSuggestions" data-venue-name data-venue-address-target="editGameVenueAddress" data-venue-phone-target="editGameVenuePhone" required value="${escapeHtml(game.venueName || game.location)}" placeholder="탁구장 이름 검색" />
            <datalist id="editGameVenueSuggestions">${renderVenueSuggestions()}</datalist>
          </div>

          <div class="field">
            <label for="editGameVenueAddress"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg>탁구장 주소</span></label>
            <input id="editGameVenueAddress" name="venueAddress" type="text" required value="${escapeHtml(game.venueAddress || '')}" placeholder="도로명 주소를 입력하세요" />
            <small class="field-hint">등록된 탁구장을 선택하면 주소가 자동으로 입력됩니다.</small>
          </div>

          <div class="field">
            <label for="editGameVenuePhone"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3l1.2 4-2 1.5a14 14 0 0 0 5.3 5.3l1.5-2 4 1.2v3c0 1.1-.9 2-2 2C11.4 19 5 12.6 5 5c0-1.1.9-2 2-2z" /></svg>탁구장 전화번호</span></label>
            <input id="editGameVenuePhone" name="venuePhone" type="tel" value="${escapeHtml(game.venuePhone || '')}" placeholder="예: 032-123-4567" />
          </div>
          <div class="field">
            <label for="editGameSeriesId"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.5" /><circle cx="14" cy="12" r="1.5" /><circle cx="10" cy="18" r="1.5" /></svg>정기리그 연결</span></label>
            <select id="editGameSeriesId" name="seriesId">${renderSeriesOptions(game.seriesId || '')}</select>
          </div>
          <div class="field">
              <span class="field-label"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4c3 0 5 2 5 5v4M17 20c-3 0-5-2-5-5V9" /><ellipse cx="7" cy="4" rx="3" ry="2" /><ellipse cx="17" cy="20" rx="3" ry="2" /></svg>경기형식</span></span>
              ${renderFormatOptionsWithModes(game)}
          </div>

          <div class="field-grid create-game-date-row">
            <div class="field">
              <label for="editGameMaxParticipants"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-3.3 3.2-5 7-5s6.2 1.7 7 5" /></svg>최대참가인원</span></label>
              <input id="editGameMaxParticipants" name="maxParticipants" type="number" min="${Math.max(1, getGameParticipants(game).length)}" step="1" required value="${escapeHtml(String(game.maxParticipants))}" />
            </div>
            <div class="field">
              <label for="editGameScheduledAt"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>게임일시</span></label>
              <input id="editGameScheduledAt" name="scheduledAt" type="datetime-local" required value="${escapeHtml(formatDateTimeLocalInput(game.scheduledAt))}" />
            </div>
          </div>
          <div class="field">
            <label for="editGameNote"><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>게임안내(선택)</span></label>
            <textarea id="editGameNote" name="note">${escapeHtml(game.note || '')}</textarea>
          </div>
          <div class="button-row game-edit-save-row">
            <button class="game-list-action game-list-action--primary" type="submit"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /><path d="M12 16v3" /></svg><span>수정 내용 저장</span></button>
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

  function getGroupingRankScore(unit) {
    const rankValues = [unit.rank, ...(unit.members || []).map((member) => member.rank)]
      .map((rank) => String(rank || '').match(/-?\d+(?:\.\d+)?/)?.[0])
      .filter(Boolean)
      .map(Number);
    return rankValues.length ? rankValues.reduce((sum, value) => sum + value, 0) / rankValues.length : Number.POSITIVE_INFINITY;
  }

  function getGroupingRankLabel(unit) {
    return [...new Set([unit.rank, ...(unit.members || []).map((member) => member.rank)].map((rank) => trimValue(rank)).filter(Boolean))].join(', ');
  }

  function buildQualifyingGroups(game, format, groupCount, groupingBasis = 'balanced') {
    const units = getGroupingUnits(game, format);
    const count = Math.max(1, Math.min(groupCount, units.length));
    const baseSize = Math.floor(units.length / count);
    const extraUnits = units.length % count;
    const extraGroupIndexes = shufflePlayers([...Array(count).keys()]).slice(0, extraUnits);
    const targetSizes = Array.from({ length: count }, (_, index) => baseSize + (extraGroupIndexes.includes(index) ? 1 : 0));
    const groups = Array.from({ length: count }, (_, index) => ({ name: `${index + 1}조`, players: [] }));
    const players = [...units].sort((left, right) => getGroupingRankScore(left) - getGroupingRankScore(right));

    if (groupingBasis === 'similar') {
      let targetIndex = 0;
      players.forEach((player) => {
        while (targetIndex < count - 1 && groups[targetIndex].players.length >= targetSizes[targetIndex]) targetIndex += 1;
        groups[targetIndex].players.push(player);
      });
      return groups;
    }

    let nextGroupIndex = 0;
    players.forEach((player) => {
      for (let offset = 0; offset < count; offset += 1) {
        const candidate = (nextGroupIndex + offset) % count;
        if (groups[candidate].players.length < targetSizes[candidate]) {
          groups[candidate].players.push(player);
          nextGroupIndex = (candidate + 1) % count;
          break;
        }
      }
    });
    return groups;
  }

  function renderOperationGroups(game, format) {
    const setup = game.qualifyingGroups?.[format];
    if (!setup) return '<div class="empty-state">아직 조편성이 없습니다. 참가자 수에 맞춰 조편성 수를 입력하고 조편성을 생성하세요.</div>';
    const hasSelectedPlayer = selectedGroupPlayer?.format === format;
    const selectedGroupName = hasSelectedPlayer ? setup.groups.find((group) => group.players.some((player) => player.playerKey === selectedGroupPlayer.playerKey))?.name : null;
    return `<div class="group-list">${setup.groups.map((group) => `
      <section class="qualifying-group" data-group-name="${escapeHtml(group.name)}" data-group-format="${escapeHtml(format)}">
        <div class="qualifying-group__heading ${hasSelectedPlayer && selectedGroupName !== group.name ? 'is-move-target' : ''}"><h3>${escapeHtml(group.name)}(${escapeHtml(String(group.players.length))}명)</h3></div>
        <div class="group-player-list">${group.players.map((player) => `<div class="group-player-row ${selectedGroupPlayer?.playerKey === player.playerKey && selectedGroupPlayer?.format === format ? 'is-selected' : ''}" data-group-player="${escapeHtml(player.playerKey)}" data-group-format="${escapeHtml(format)}" title="이동할 선수를 선택하세요"><span><strong>${escapeHtml(player.label || player.nickname)}${getGroupingRankLabel(player) ? `(${escapeHtml(getGroupingRankLabel(player))})` : ''}</strong>${player.members?.length > 1 ? ` · ${escapeHtml(String(player.members.length))}명` : ''}${player.members?.length > 1 ? `<small>${player.members.map((member) => escapeHtml(member.nickname)).join(', ')}</small>` : ''}</span></div>`).join('')}</div>
      </section>
    `).join('')}</div>`;
  }

  function renderRosterOperationPanel(games, game, formats, format) {
    const registrations = getGameRegistrations(game, format);
    const registrationClosed = isRegistrationClosed(game, format);
    const bulkCount = registrations.filter((registration) => getRegistrationSource(registration).key === 'bulk').length;
    const manualCount = registrations.filter((registration) => getRegistrationSource(registration).key === 'manual').length;
    const onlineCount = registrations.length - bulkCount - manualCount;
    const memberUsers = [...state.users, ...state.adminUsers]
      .filter((user, index, users) => user.memberId && users.findIndex((item) => item.memberIdKey === user.memberIdKey) === index);
    const memberSuggestions = memberUsers
      .filter((user) => user.memberId)
      .map((user) => `<option value="${escapeHtml(user.memberId)}">${escapeHtml(user.nickname)} · ${escapeHtml(genderLabel(user.gender))}</option>`)
      .join('');
    const registrationList = registrations.length
      ? `<div class="roster-list-table-wrap"><table class="roster-list-table"><thead><tr><th>번호</th><th>소속팀</th><th>선수명</th><th>성별</th><th>아이디</th><th>통합부수</th><th>등록방법</th><th>관리</th></tr></thead><tbody>${registrations.map((registration, index) => { const source = getRegistrationSource(registration); const editing = state.editingRegistrationId === registration.id; const canEdit = !registrationClosed; const value = (field) => escapeHtml(registration[field] || ''); return `<tr>${editing ? `<td>${index + 1}</td><td><input class="roster-edit-input" data-registration-field="teamName" data-registration-id="${escapeHtml(registration.id)}" value="${value('teamName')}" /></td><td><input class="roster-edit-input" data-registration-field="nickname" data-registration-id="${escapeHtml(registration.id)}" value="${value('nickname')}" /></td><td><select class="roster-edit-input" data-registration-field="gender" data-registration-id="${escapeHtml(registration.id)}"><option value="">선택</option><option value="male" ${registration.gender === 'male' ? 'selected' : ''}>남자</option><option value="female" ${registration.gender === 'female' ? 'selected' : ''}>여자</option></select></td><td><input class="roster-edit-input" data-registration-field="memberId" data-registration-id="${escapeHtml(registration.id)}" value="${value('memberId')}" /></td><td><input class="roster-edit-input" data-registration-field="rank" data-registration-id="${escapeHtml(registration.id)}" value="${value('rank')}" /></td><td><span class="registration-source registration-source--${source.key}">${source.label}</span></td><td><span class="roster-edit-actions"><button type="button" class="roster-edit-button" data-save-registration="${escapeHtml(registration.id)}">저장</button><button type="button" class="roster-edit-button roster-edit-button--muted" data-cancel-registration>취소</button></span></td>` : `<td>${index + 1}</td><td>${escapeHtml(registration.teamName || '-')}</td><td>${escapeHtml(registration.nickname || '-')}</td><td>${escapeHtml(genderLabel(registration.gender))}</td><td>${escapeHtml(registration.memberId || '-')}</td><td>${escapeHtml(registration.rank || '-')}</td><td><span class="registration-source registration-source--${source.key}">${source.label}</span></td><td>${canEdit ? `<span class="roster-edit-actions"><button type="button" class="roster-edit-button" data-edit-registration="${escapeHtml(registration.id)}">수정</button><button type="button" class="roster-edit-button roster-edit-button--danger" data-delete-registration="${escapeHtml(registration.id)}">삭제</button></span>` : '-'}</td>`}</tr>`; }).join('')}</tbody></table></div>`
      : '<div class="empty-state">아직 등록된 선수가 없습니다.</div>';
    return `
      <div class="roster-operation-panel">
        <div class="operation-controls roster-controls">
          <div class="field"><label for="operationRosterGame">게임</label><select id="operationRosterGame" data-operation-game>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === game.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></div>
          <div class="field"><label for="operationRosterFormat">경기종목</label><select id="operationRosterFormat" data-operation-format data-roster-format="${escapeHtml(game.id)}">${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div>
        </div>
        <section class="roster-manual-registration"><div class="roster-list-heading"><div><p class="section-kicker">개별 등록</p><h2>${escapeHtml(FORMAT_LABELS[format])} 선수 직접등록</h2></div></div><form class="roster-manual-form" data-form="operator-registration" data-game-id="${escapeHtml(game.id)}" data-format="${escapeHtml(format)}"><div class="field"><label for="manualTeamName">소속팀 <span class="optional-label">${format === 'singles' ? '(선택)' : '(필수)'}</span></label><input id="manualTeamName" name="teamName" type="text" ${format !== 'singles' ? 'required' : ''} /></div><div class="field"><label for="manualNickname">선수명</label><input id="manualNickname" name="nickname" data-manual-nickname type="text" required /></div><div class="field"><label for="manualMemberId">아이디 <span class="optional-label">(선택)</span></label><input id="manualMemberId" name="memberId" data-manual-member-id list="manualMemberSuggestions" type="text" /></div><datalist id="manualMemberSuggestions">${memberSuggestions}</datalist><div class="field"><label for="manualGender">성별</label><select id="manualGender" name="gender" data-manual-gender required><option value="">성별 선택</option><option value="male">남자</option><option value="female">여자</option></select></div><div class="field"><label for="manualRank">부수</label><input id="manualRank" name="rank" data-manual-rank type="text" required /></div><button type="submit" class="game-list-action game-list-action--primary" ${registrationClosed ? 'disabled' : ''}><span>선수등록</span></button></form></section>
        <div class="roster-import roster-import--standalone">
          <div class="roster-import-heading"><h2><span class="form-field-label"><svg class="form-field-icon" viewBox="0 0 24 24" aria-hidden="true">${getFormatIconSvg(format)}</svg>${escapeHtml(FORMAT_LABELS[format])} 참가선수 일괄등록</span></h2></div>
          <div class="roster-upload-actions"><label class="game-list-action game-list-action--primary file-button" for="operationRosterFile"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M8 8l4-4 4 4M5 14v5h14v-5"></path></svg><span>엑셀 명부 선택</span></label><input id="operationRosterFile" class="file-input" type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values" data-roster-upload="${escapeHtml(game.id)}" data-roster-format="${escapeHtml(format)}" /><button type="button" class="game-list-action" data-download-roster-template><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M8 11l4 4 4-4M5 20h14"></path></svg><span>엑셀 양식 다운로드</span></button></div>
          <div class="roster-registration-status roster-registration-status--upload"><div class="roster-registration-close">${registrationClosed ? `<button type="button" class="game-list-action" data-close-registration="${escapeHtml(game.id)}" data-close-registration-format="${escapeHtml(format)}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z"></path><path d="M9 14h6"></path></svg><span>선수등록 마감 취소</span></button>` : `<button type="button" class="game-list-action" data-close-registration="${escapeHtml(game.id)}" data-close-registration-format="${escapeHtml(format)}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z"></path></svg><span>선수등록 마감</span></button>`}</div></div>
        </div>
        <section class="roster-list-panel"><div class="roster-list-heading"><div><p class="section-kicker">등록 현황</p><h2>${escapeHtml(FORMAT_LABELS[format])} 참가선수 명부</h2></div><span>${registrations.length}명(팀)</span></div><div class="roster-list-summary"><span class="registration-source registration-source--bulk">일괄등록 ${bulkCount}</span><span class="registration-source registration-source--online">온라인등록 ${onlineCount}</span><span class="registration-source registration-source--manual">개별등록 ${manualCount}</span></div>${registrationList}<div class="roster-registration-status roster-registration-status--bottom"><div class="roster-registration-close">${registrationClosed ? `<button type="button" class="game-list-action" data-close-registration="${escapeHtml(game.id)}" data-close-registration-format="${escapeHtml(format)}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z"></path><path d="M9 14h6"></path></svg><span>선수등록 마감 취소</span></button>` : `<button type="button" class="game-list-action" data-close-registration="${escapeHtml(game.id)}" data-close-registration-format="${escapeHtml(format)}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z"></path></svg><span>선수등록 마감</span></button>`}</div></div></section>
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
    const rawLabel = (unit) => unit.label || unit.nickname || '미정';
    const label = (unit) => {
      const name = rawLabel(unit);
      const rank = unit.members?.length === 1 ? unit.members[0]?.rank || unit.rank || '' : '';
      return rank ? `${name}(${rank})` : name;
    };
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
    const findMatch = (left, right) => matches.find((match) => (match.sideAKey === left.playerKey && match.sideBKey === right.playerKey) || (match.sideAKey === right.playerKey && match.sideBKey === left.playerKey) || (!match.sideAKey && ((match.sideA === rawLabel(left) && match.sideB === rawLabel(right)) || (match.sideA === rawLabel(right) && match.sideB === rawLabel(left)))));
    const scoreForRow = (match, rowKey) => {
      const scoreParts = String(match.result?.score || '').match(/^(\d+)\s*[-:]\s*(\d+)$/);
      if (!scoreParts) return '';
      return rowKey === match.sideAKey ? scoreParts[1] : scoreParts[2];
    };
    const isWinningScore = (match, row) => {
      if (!match?.result?.winner) return false;
      if (match.sideAKey || match.sideBKey) return match.result.winner === 'A' ? row.playerKey === match.sideAKey : row.playerKey === match.sideBKey;
      const rowLabel = rawLabel(row);
      return match.result.winner === 'A' ? rowLabel === match.sideA : rowLabel === match.sideB;
    };
    return `<div class="matrix-wrap"><table class="schedule-matrix"><thead><tr><th>대진</th>${units.map((unit) => `<th>${escapeHtml(label(unit))}</th>`).join('')}<th class="record-column">승</th><th class="record-column">패</th><th class="record-column">순위</th></tr></thead><tbody>${units.map((row) => { const record = standings.get(row.playerKey) || { wins: 0, losses: 0, rank: '' }; return `<tr><th>${escapeHtml(label(row))}</th>${units.map((column) => { if (row.playerKey === column.playerKey) return '<td class="matrix-diagonal">-</td>'; const match = findMatch(row, column); const score = match ? scoreForRow(match, row.playerKey) : ''; const winnerClass = match && isWinningScore(match, row) ? ' matrix-score--winner' : ''; return `<td>${score ? `<strong class="matrix-score${winnerClass}">${escapeHtml(score)}</strong>` : '<span class="muted">&nbsp;</span>'}</td>`; }).join('')}<td class="matrix-entry-cell">${record.wins || record.losses ? record.wins : '&nbsp;'}</td><td class="matrix-entry-cell">${record.wins || record.losses ? record.losses : '&nbsp;'}</td><td class="matrix-entry-cell">${record.rank || '&nbsp;'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }

  function renderScheduleResultsTable(matches, editable = true, format = 'singles') {
    const ruleColumn = format === 'team' ? '' : '<th>경기규칙</th>';
    return `<div class="schedule-table-wrap schedule-results-table-wrap"><table class="schedule-table schedule-results-table"><thead><tr><th class="schedule-col-index">순번</th><th class="schedule-col-round">라운드</th><th class="schedule-col-match">대진</th>${ruleColumn ? '<th class="schedule-col-rule">경기규칙</th>' : ''}<th class="schedule-col-score">세트 스코어</th><th class="schedule-col-winner">승자</th></tr></thead><tbody>${matches.map((match, index) => `<tr><td class="schedule-col-index">${index + 1}</td><td class="schedule-col-round">${match.round}R</td><td class="schedule-col-match"><div class="schedule-matchup"><strong>${escapeHtml(match.sideA)}</strong><span>vs</span><strong>${escapeHtml(match.sideB)}</strong></div></td>${format === 'team' ? '' : '<td class="schedule-col-rule">11점 · 5전 3선승</td>'}<td class="schedule-col-score">${editable ? `<input class="schedule-result-input" data-match-score="${escapeHtml(match.id)}" value="${escapeHtml(match.result?.score || '')}" placeholder="세트 스코어" />` : escapeHtml(match.result?.score || '-')}</td><td class="schedule-col-winner">${editable ? `<select data-match-winner="${escapeHtml(match.id)}"><option value="">미입력</option><option value="A" ${match.result?.winner === 'A' ? 'selected' : ''}>${escapeHtml(match.sideA)}</option><option value="B" ${match.result?.winner === 'B' ? 'selected' : ''}>${escapeHtml(match.sideB)}</option></select>` : escapeHtml(match.result?.winner === 'A' ? match.sideA : match.result?.winner === 'B' ? match.sideB : '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderQualifyingStandingsOverview(game, format) {
    const standings = getQualifyingStandings(game, format);
    if (!standings.length) return '';
    return `<section class="qualifying-standings-overview"><div class="group-result-heading"><div><h2>[${escapeHtml(FORMAT_LABELS[format])}] 예선리그전 조별순위</h2></div></div><div class="qualifying-standings-grid">${standings.map((group) => `<section class="qualifying-standings-card"><div class="qualifying-standings-card__heading"><h3>${escapeHtml(group.name)}</h3><span>${group.complete ? '순위 확정' : '결과 입력 중'}</span></div><div class="qualifying-standing-list">${group.standings.map((record) => `<div class="qualifying-standing-row"><span class="rank-badge rank-badge--${record.rank || 'pending'}">${record.rank || '-'}</span><strong>${escapeHtml(tournamentLabel(record.player))}</strong><span class="qualifying-standing-record">${record.wins}승 ${record.losses}패</span></div>`).join('')}</div></section>`).join('')}</div></section>`;
  }

  function renderScheduleOperationPanel(games, game, formats, format, mode = 'generate') {
    const saved = game.preliminaryMatches?.[format];
    const groups = game.qualifyingGroups?.[format]?.groups || [];
    const matches = saved?.matches || [];
    const isResultsMode = mode === 'results';
    const showAllGroups = !state.selectedScheduleGroup || state.selectedScheduleGroup === '__all__';
    const selectedGroup = groups.find((group) => group.name === state.selectedScheduleGroup) || groups[0];
    const visibleGroups = !isResultsMode ? groups : showAllGroups ? groups : selectedGroup ? [selectedGroup] : [];
    const selectedMatches = selectedGroup ? matches.filter((match) => match.groupName === selectedGroup.name) : [];
    let savedContent = `${isResultsMode ? renderQualifyingStandingsOverview(game, format) : ''}${visibleGroups.map((group) => { const groupMatches = matches.filter((match) => match.groupName === group.name); const groupNumber = String(group.name).replace(/\s*조$/, ''); const scheduleTitle = isResultsMode ? `${FORMAT_LABELS[format]} ${group.name} 경기결과` : `[${FORMAT_LABELS[format]} (${groupNumber})조 대진표]`; return `<div class="schedule-summary"><strong>${escapeHtml(scheduleTitle)}</strong></div><div class="schedule-group-matrices"><section class="schedule-group-block"><div class="group-result-heading"><h3>${escapeHtml(group.name)} ${isResultsMode ? '경기결과 입력' : '대진 매트릭스'}</h3><span class="subtle-note">${escapeHtml(group.name)} 탁구대</span></div>${renderScheduleMatrix(group, groupMatches)}<h4 class="schedule-order-title">${escapeHtml(group.name)} 경기 진행순서</h4>${renderScheduleResultsTable(groupMatches, isResultsMode, format)}</section></div>`; }).join('')}${isResultsMode ? '<div class="button-row group-save-row"><button type="button" class="btn btn-secondary" data-save-schedule-results>경기결과 저장</button></div>' : ''}`;
    if (isResultsMode) savedContent = `<div class="schedule-result-divider" aria-hidden="true"></div>${savedContent}`;
    if (isResultsMode) {
      const controls = `<div class="public-league-results-controls" aria-label="경기결과 입력 화면 크기 조정"><button type="button" class="game-list-action" data-league-results-zoom="out" aria-label="결과입력 화면 축소"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6"></path></svg></button><button type="button" class="game-list-action zoom-value-control" data-league-results-zoom="reset" aria-label="리그전 결과입력 화면 기본 크기">기본 크기</button><button type="button" class="game-list-action" data-league-results-zoom="in" aria-label="결과입력 화면 확대"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6M11 8v6"></path></svg></button></div>`;
      savedContent = `<div class="schedule-result-toolbar schedule-result-toolbar--results">${controls}</div><div class="public-league-results-viewport public-league-results-viewport--operator" data-public-league-viewport><div class="public-league-results-stage" data-public-league-stage>${savedContent}</div></div>`;
    }
    if (!isResultsMode) {
      const controls = `<div class="public-league-results-controls" aria-label="리그전 대진표 크기 조정"><button type="button" class="game-list-action" data-league-results-zoom="out" aria-label="대진표 축소"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6"></path></svg></button><button type="button" class="game-list-action zoom-value-control" data-league-results-zoom="reset" aria-label="리그전 대진표 기본 크기">기본 크기</button><button type="button" class="game-list-action" data-league-results-zoom="in" aria-label="대진표 확대"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6M11 8v6"></path></svg></button></div>`;
      const printButton = '<button type="button" class="schedule-result-print" data-print-all-schedules aria-label="전체 리그전 대진표 출력" title="전체 대진표 출력"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V4h12v5M6 17H4V10h16v7h-2M6 14h12v6H6z"></path><path d="M17 12h1"></path></svg><span>대진표 출력</span></button>';
      savedContent = `<div class="schedule-result-divider" aria-hidden="true"></div><div class="schedule-result-heading"><h2>[${escapeHtml(FORMAT_LABELS[format])}] 리그전 대진표</h2></div><div class="schedule-result-toolbar">${controls}${printButton}</div><div class="public-league-results-viewport" data-public-league-viewport><div class="public-league-results-stage" data-public-league-stage>${savedContent}</div></div>`;
    }
    return `
      <div class="schedule-panel${isResultsMode ? ' schedule-panel--results' : ''}">
        <div class="operation-controls schedule-generation-controls${isResultsMode ? ' schedule-generation-controls--results' : ' schedule-generation-controls--compact'}">
          <div class="field"><label for="operationScheduleFormat">경기종목</label><select id="operationScheduleFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div>
          ${isResultsMode && groups.length ? `<div class="field"><label for="operationScheduleGroup">경기결과 입력 조</label><select id="operationScheduleGroup" data-schedule-group><option value="__all__" ${showAllGroups ? 'selected' : ''}>전체</option>${groups.map((group) => `<option value="${escapeHtml(group.name)}" ${!showAllGroups && group.name === selectedGroup?.name ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></div>` : ''}
          ${isResultsMode ? '' : '<button type="button" class="game-list-action game-list-action--primary" data-generate-schedule><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"></path><circle cx="12" cy="12" r="8"></circle></svg><span>대진표 생성</span></button>'}

        </div>

        ${!groups.length ? '<div class="empty-state">먼저 조편성을 완료해 주세요.</div>' : !saved ? (isResultsMode ? '<div class="empty-state">먼저 예선 대진표 생성 메뉴에서 대진표를 만들어 주세요.</div>' : '<div class="empty-state">대진표 생성 버튼을 눌러 예선리그 대진을 만들어 주세요.</div>') : savedContent}
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
      const standings = [...records.values()].sort((left, right) => {
        const leftHasResult = left.wins > 0 || left.losses > 0;
        const rightHasResult = right.wins > 0 || right.losses > 0;
        if (leftHasResult !== rightHasResult) return leftHasResult ? -1 : 1;
        return right.wins - left.wins || (right.setsFor - right.setsAgainst) - (left.setsFor - left.setsAgainst) || right.setsFor - left.setsFor;
      });
      const complete = groupMatches.length > 0 && groupMatches.every((match) => match.result?.winner && /^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')));
      let rank = 0;
      return { name: group.name, complete, standings: standings.map((record) => ({ ...record, rank: record.wins > 0 || record.losses > 0 ? ++rank : '' })) };
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

  function tournamentDisplayLabel(entry) {
    const label = tournamentLabel(entry);
    const rank = tournamentRankLabel(entry).match(/\d+/g)?.join(', ') || '';
    return rank ? `${label} (${rank})` : label;
  }

  function tournamentTeamDisplayLabel(entry) {
    const teamName = entry?.teamName || entry?.members?.find((member) => member.teamName)?.teamName;
    if (teamName) return teamName;
    return entry?.members?.length > 1 ? tournamentLabel(entry) : '개인';
  }

  function renderTournamentPlayerLabel(entry, emptyLabel = '대기') {
    const label = tournamentDisplayLabel(entry);
    if (!entry || label === '대기') return `<span class="tournament-player-label"><strong>${emptyLabel}</strong></span>`;
    return `<span class="tournament-player-label"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(tournamentTeamDisplayLabel(entry))}</small></span>`;
  }

  function renderPublicTournamentMatch(match) {
    const isBye = match.round === 1 && Boolean(match.sideA) !== Boolean(match.sideB);
    return `<div class="tournament-match" data-tournament-match="${escapeHtml(match.id)}" data-tournament-round="${match.round}"><div class="tournament-side ${match.result?.winner === 'A' ? 'is-winner' : ''}">${renderTournamentPlayerLabel(match.sideA, isBye && !match.sideA ? 'BYE' : '대기')}<strong>${escapeHtml(String(match.result?.score || '').split(/[-:]/)[0] || '')}</strong></div><div class="tournament-side ${match.result?.winner === 'B' ? 'is-winner' : ''}">${renderTournamentPlayerLabel(match.sideB, isBye && !match.sideB ? 'BYE' : '대기')}<strong>${escapeHtml(String(match.result?.score || '').split(/[-:]/)[1] || '')}</strong></div></div>`;
  }

  function buildTournamentBracket(entries, league, format) {
    if (!entries.length) return null;
    const orderedEntries = entries
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => {
        const rankDifference = (Number(left.entry.qualificationRank) || Number.MAX_SAFE_INTEGER) - (Number(right.entry.qualificationRank) || Number.MAX_SAFE_INTEGER);
        if (rankDifference) return rankDifference;
        const leftGroup = Number(String(left.entry.sourceGroup || '').match(/\d+/)?.[0]) || Number.MAX_SAFE_INTEGER;
        const rightGroup = Number(String(right.entry.sourceGroup || '').match(/\d+/)?.[0]) || Number.MAX_SAFE_INTEGER;
        return leftGroup - rightGroup || left.index - right.index;
      })
      .map(({ entry }) => entry);
    const size = entries.length === 1 ? 1 : 2 ** Math.ceil(Math.log2(entries.length));
    const seedOrder = getTournamentSeedOrder(size);
    const slots = seedOrder.map((seed) => orderedEntries[seed - 1] || null);
    const rounds = [];
    if (size === 1) {
      rounds.push([{ id: makeId('tmatch'), round: 1, matchIndex: 0, sideA: orderedEntries[0], sideB: null, result: null }]);
      return { league, format, size, entries: orderedEntries, rounds, seeded: true, pointsToWin: 11, bestOf: 5, generatedAt: new Date().toISOString() };
    }
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
    return { league, format, size, entries: orderedEntries, rounds, seeded: true, pointsToWin: 11, bestOf: 5, generatedAt: new Date().toISOString() };
  }

  function getTournamentSeedOrder(size) {
    if (size <= 1) return [1];
    let order = [1, 2];
    while (order.length < size) {
      const nextSize = order.length * 2;
      order = order.flatMap((seed) => [seed, nextSize + 1 - seed]);
    }
    return order;
  }

  function tournamentRoundLabel(entryCount) {
    const count = Number(entryCount) || 0;
    if (!count) return '-';
    return `${2 ** Math.ceil(Math.log2(Math.max(1, count)))}강`;
  }

  function tournamentWinner(match) {
    if (match.result?.winner === 'A' && match.sideA) return match.sideA;
    if (match.result?.winner === 'B' && match.sideB) return match.sideB;
    if (match.round === 1 && match.sideA && !match.sideB) return match.sideA;
    if (match.round === 1 && !match.sideA && match.sideB) return match.sideB;
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

  function renderTournamentMedal(rank, modifier) {
    const colors = {
      gold: ['#ffe08a', '#e5a91a', '#9a5a08'],
      silver: ['#f5f8fc', '#b9c6d4', '#697888'],
      bronze: ['#ffd0a5', '#c77b45', '#7c3d20'],
    }[modifier] || ['#f5f8fc', '#b9c6d4', '#697888'];
    return `<svg class="tournament-podium__medal-svg" viewBox="0 0 48 58" role="img" aria-label="${rank}등 메달"><path d="M7 0 23 21h7L14 0zM41 0 25 21h-7L34 0z" fill="#d9304f"/><path d="M7 0 23 21h4L14 0zM41 0 25 21h-4L34 0z" fill="#3153a6" opacity=".95"/><rect x="20" y="16" width="8" height="8" rx="2" fill="${colors[1]}"/><circle cx="24" cy="38" r="17" fill="${colors[2]}"/><circle cx="24" cy="37" r="14" fill="${colors[1]}" stroke="${colors[0]}" stroke-width="2"/><path d="M13 43c3 5 7 7 11 8M35 43c-3 5-7 7-11 8" fill="none" stroke="${colors[0]}" stroke-width="1.5" stroke-linecap="round"/><text x="24" y="43" text-anchor="middle" fill="#fff8e6" font-size="15" font-weight="900" font-family="inherit">${rank}</text></svg>`;
  }

  function renderTournamentPodium(bracket) {
    const placements = getTournamentPlacements(bracket);
    const cards = [
      { rank: 1, title: '우승', value: placements.winner ? tournamentLabel(placements.winner) : null, modifier: 'gold' },
      { rank: 2, title: '준우승', value: placements.runnerUp ? tournamentLabel(placements.runnerUp) : null, modifier: 'silver' },
      { rank: 3, title: '3등', value: placements.third.length ? placements.third.map((entry) => tournamentLabel(entry)).join(' · ') : null, modifier: 'bronze' },
    ];
    return `<section class="tournament-podium" aria-label="토너먼트 입상자"><div class="tournament-podium__cards">${cards.map((card) => `<div class="tournament-podium__card tournament-podium__card--${card.modifier}"><span class="tournament-podium__medal">${renderTournamentMedal(card.rank, card.modifier)}</span><div><strong>${card.title}</strong><span>${escapeHtml(card.value || '결정 대기')}</span></div></div>`).join('')}</div></section>`;
  }

  function rebalanceTournamentFirstRound(bracket) {
    const firstRound = bracket.rounds?.[0] || [];
    if (bracket.seeded || !firstRound.length || firstRound.some((match) => match.result?.winner || match.result?.score)) return;
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
    const labelA = tournamentDisplayLabel(match.sideA);
    const labelB = tournamentDisplayLabel(match.sideB);
    const playable = match.sideA && match.sideB;
    const scoreParts = String(match.result?.score || '').match(/^(\d+)\s*[-:]\s*(\d+)$/);
    const isBye = match.round === 1 && Boolean(match.sideA) !== Boolean(match.sideB);
    return `<div class="tournament-match" data-tournament-match="${escapeHtml(match.id)}" data-tournament-round="${match.round}"><div class="tournament-side ${match.result?.winner === 'A' ? 'is-winner' : ''}">${renderTournamentPlayerLabel(match.sideA, isBye && !match.sideA ? 'BYE' : '대기')}<strong>${scoreParts ? scoreParts[1] : ''}</strong></div><div class="tournament-side ${match.result?.winner === 'B' ? 'is-winner' : ''}">${renderTournamentPlayerLabel(match.sideB, isBye && !match.sideB ? 'BYE' : '대기')}<strong>${scoreParts ? scoreParts[2] : ''}</strong></div>${playable ? `<div class="tournament-match__input"><input class="schedule-result-input" data-tournament-score="${escapeHtml(match.id)}" value="${escapeHtml(match.result?.score || '')}" placeholder="세트 스코어" /><select data-tournament-winner="${escapeHtml(match.id)}"><option value="">승자 선택</option><option value="A" ${match.result?.winner === 'A' ? 'selected' : ''}>${escapeHtml(labelA)}</option><option value="B" ${match.result?.winner === 'B' ? 'selected' : ''}>${escapeHtml(labelB)}</option></select></div>` : `<small class="tournament-bye-note">${match.sideA || match.sideB ? '부전승' : '진출 대기'}</small>`}</div>`;
  }

  function renderTournamentRound(round, isFinal = false, title = '', bracketSize = 2, roundIndex = 0) {
    return renderBracketRound(round, renderTournamentMatch, isFinal, title, bracketSize, roundIndex);
  }

  function renderTournamentBracket(bracket) {
    syncTournamentBracket(bracket);
    const controls = `<div class="public-tournament-results-controls" aria-label="토너먼트 대진표 크기 조정"><button type="button" class="game-list-action" data-tournament-zoom="out" aria-label="토너먼트 축소"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6"></path></svg></button><button type="button" class="game-list-action zoom-value-control" data-tournament-zoom="reset" aria-label="토너먼트 대진표 기본 크기">기본 크기</button><button type="button" class="game-list-action" data-tournament-zoom="in" aria-label="토너먼트 확대"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6M11 8v6"></path></svg></button></div>`;
    if (bracket.rounds.length === 1) return `${controls}${wrapTournamentBracket(`<div class="tournament-bracket"><div class="tournament-rounds tournament-rounds--single">${renderTournamentRound(bracket.rounds[0], true, tournamentRoundTitle(bracket, 0, true), bracket.size, 0)}</div><p class="subtle-note">부전승은 자동 진출하며, 경기는 11점 5전 3선승입니다.</p></div>${renderTournamentPodium(bracket)}`)}`;
    const roundsBeforeFinal = bracket.rounds.slice(0, -1);
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const leftRounds = roundsBeforeFinal.map((round) => round.slice(0, Math.ceil(round.length / 2)).map((match, index) => ({ ...match, bracketLocalIndex: index })));
    const rightRounds = roundsBeforeFinal.map((round) => round.slice(Math.ceil(round.length / 2)).reverse().map((match, index) => ({ ...match, bracketLocalIndex: index })));
    return `${controls}${wrapTournamentBracket(`<div class="tournament-bracket tournament-bracket--split tournament-bracket--size-${bracket.size}"><div class="tournament-side-bracket tournament-side-bracket--left">${leftRounds.map((round, index) => renderTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div><div class="tournament-center-bracket">${renderTournamentRound(finalRound, true, tournamentRoundTitle(bracket, bracket.rounds.length - 1, true), bracket.size, bracket.rounds.length - 1)}</div><div class="tournament-side-bracket tournament-side-bracket--right">${rightRounds.map((round, index) => renderTournamentRound(round, false, tournamentRoundTitle(bracket, index), bracket.size, index)).join('')}</div><p class="subtle-note tournament-bracket__note">좌·우측 각 라운드의 승자가 중앙 결승으로 진출합니다. 부전승은 자동 진출하며, 경기는 11점 5전 3선승입니다.</p></div>${renderTournamentPodium(bracket)}`)}`;
  }

  function renderTournamentResultInputPanel(bracket) {
    if (!bracket?.rounds?.length) return '<div class="empty-state">생성된 토너먼트 경기가 없습니다.</div>';
    syncTournamentBracket(bracket);
    const rows = bracket.rounds.flatMap((round, roundIndex) => round.map((match) => {
      const labelA = tournamentDisplayLabel(match.sideA);
      const labelB = tournamentDisplayLabel(match.sideB);
      const playable = Boolean(match.sideA && match.sideB);
      const score = String(match.result?.score || '');
      const winner = match.result?.winner || '';
      const status = match.round === 1 && Boolean(match.sideA) !== Boolean(match.sideB)
        ? 'BYE'
        : !playable
          ? '대기'
          : winner
            ? '입력완료'
            : '입력대기';
      return `<tr class="${playable ? '' : 'is-disabled'}"><td>${escapeHtml(tournamentRoundTitle(bracket, roundIndex, roundIndex === bracket.rounds.length - 1))}</td><td><strong>${escapeHtml(labelA)}</strong><small>vs</small><strong>${escapeHtml(labelB)}</strong></td><td><input class="schedule-result-input" data-tournament-score="${escapeHtml(match.id)}" value="${escapeHtml(score)}" placeholder="세트 스코어" inputmode="numeric" ${playable ? '' : 'disabled'} /></td><td><select data-tournament-winner="${escapeHtml(match.id)}" ${playable ? '' : 'disabled'}><option value="">승자 선택</option><option value="A" ${winner === 'A' ? 'selected' : ''}>${escapeHtml(labelA)}</option><option value="B" ${winner === 'B' ? 'selected' : ''}>${escapeHtml(labelB)}</option></select></td><td><span class="tournament-result-status tournament-result-status--${playable ? 'ready' : 'pending'}">${status}</span></td></tr>`;
    })).join('');
    return `<section class="tournament-result-input-panel"><div class="group-result-heading"><h3>경기결과 입력</h3><span>생성된 대진표 기준</span></div><div class="schedule-table-wrap tournament-result-input-wrap"><table class="public-data-table tournament-result-input-table"><thead><tr><th>라운드</th><th>대진</th><th>세트 스코어</th><th>승자</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
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
    return `<div class="tournament-print-viewport" data-tournament-print-viewport><div class="tournament-print-stage" data-tournament-print-stage><div class="tournament-print-sheet-list tournament-print-sheet-list--${printPerPage}">${printable.matches.map((match) => { const rankA = tournamentRankLabel(match.sideA); const rankB = tournamentRankLabel(match.sideB); return `<section class="tournament-print-sheet"><div class="tournament-print-sheet__title">${league === 'lower' ? '하위리그' : '상위리그'} · ${escapeHtml(printRoundTitle)} 토너먼트 대진표</div><div class="tournament-print-sheet__players"><div class="tournament-print-sheet__players-label">선수이름</div><div><strong>${escapeHtml(tournamentLabel(match.sideA))}${rankA ? ` (${escapeHtml(rankA)})` : ''}</strong><span>[${escapeHtml(tournamentTeamLabel(match.sideA, format))}]</span></div><div><strong>${escapeHtml(tournamentLabel(match.sideB))}${rankB ? ` (${escapeHtml(rankB)})` : ''}</strong><span>[${escapeHtml(tournamentTeamLabel(match.sideB, format))}]</span></div></div><div class="tournament-print-sheet__result-row"><div>경기결과</div><div></div><div></div></div><table class="tournament-print-score-table"><colgroup><col style="width: 8%" /><col style="width: 8%" /><col style="width: 42%" /><col style="width: 42%" /></colgroup><tbody><tr><th rowspan="5">Set<br />점수</th><th>1Set</th><td></td><td></td></tr>${Array.from({ length: 4 }, (_, index) => `<tr><th>${index + 2}Set</th><td></td><td></td></tr>`).join('')}</tbody></table></section>`; }).join('')}</div></div></div>`;
  }

  function renderTournamentPrintPanel(games, game, formats, format) {
    const config = getTournamentConfig(game, format);
    const standings = getQualifyingStandings(game, format);
    const maxGroupSize = Math.max(1, ...standings.map((group) => group.standings.length));
    const selectedAdvance = Math.min(maxGroupSize, Math.max(1, Number.parseInt(config?.advancePerGroup, 10) || (maxGroupSize >= 2 ? 2 : 1)));
    const advanceOptions = Array.from({ length: maxGroupSize }, (_, index) => index + 1)
      .map((rank) => `<option value="${rank}" ${rank === selectedAdvance ? 'selected' : ''}>${rank}등</option>`)
      .join('');
    const lowerEnabled = config ? config.lowerEnabled === true : true;
    const qualification = config ? getTournamentQualificationEntries(game, format, selectedAdvance, lowerEnabled) : null;
    const availableLeagues = config ? ['upper', 'lower'].filter((leagueName) => config[leagueName]) : [];
    const controls = `<div class="public-tournament-results-controls" aria-label="토너먼트 대진표 크기 조정"><button type="button" class="game-list-action" data-tournament-zoom="out" aria-label="토너먼트 축소"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6"></path></svg></button><button type="button" class="game-list-action zoom-value-control" data-tournament-zoom="reset" aria-label="토너먼트 대진표 기본 크기">기본 크기</button><button type="button" class="game-list-action" data-tournament-zoom="in" aria-label="토너먼트 확대"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4M8 11h6M11 8v6"></path></svg></button></div>`;
    const qualificationPreview = qualification
      ? `${renderTournamentQualificationList('상위리그 본선 진출자', qualification.upperEntries)}${lowerEnabled ? renderTournamentQualificationList('하위리그 본선 진출자', qualification.lowerEntries) : ''}`
      : '';
    const generationLeague = state.tournamentGenerateLeague === 'lower' && lowerEnabled ? 'lower' : 'upper';
    const generationOptions = `<option value="upper" ${generationLeague === 'upper' ? 'selected' : ''}>상위리그</option>${lowerEnabled ? `<option value="lower" ${generationLeague === 'lower' ? 'selected' : ''}>하위리그</option>` : ''}`;
    const generationEntries = qualification?.[generationLeague === 'lower' ? 'lowerEntries' : 'upperEntries'] || [];
    const generationSection = `<section class="tournament-bracket-generation-card"><h3>본선 대진표 생성</h3><div class="operation-controls tournament-controls tournament-bracket-generation-controls"><div class="field"><label for="tournamentGenerateLeague">생성리그</label><select id="tournamentGenerateLeague" data-tournament-generate-league>${generationOptions}</select></div><div class="field"><label for="tournamentGenerateRound">Round</label><input id="tournamentGenerateRound" type="text" value="${escapeHtml(tournamentRoundLabel(generationEntries.length))}" readonly aria-readonly="true" /></div></div><div class="button-row tournament-bracket-generate-row"><button type="button" class="game-list-action game-list-action--primary" data-generate-tournament ${qualification ? '' : 'disabled'}><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"></path><circle cx="12" cy="12" r="8"></circle></svg><span>대진표 생성</span></button></div></section>`;
    const setup = `<section class="tournament-qualification-card"><h3>본선진출자 결정</h3><div class="operation-controls tournament-controls tournament-qualification-controls"><div class="field"><label for="operationTournamentPrintFormat">경기종목</label><select id="operationTournamentPrintFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div><div class="field"><label for="tournamentPrintAdvanceCount">본선진출순위</label><select id="tournamentPrintAdvanceCount" data-tournament-advance>${advanceOptions}</select></div><label class="check-line tournament-lower-option"><span>하위리그 진행</span><input type="checkbox" data-tournament-lower ${lowerEnabled ? 'checked' : ''} /></label><button type="button" class="game-list-action game-list-action--primary tournament-qualification-action" data-decide-tournament ${standings.length ? '' : 'disabled'}><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"></path><circle cx="12" cy="12" r="8"></circle></svg><span>본선진출자 결정</span></button></div></section>${!standings.length ? '<div class="empty-state">먼저 조편성과 예선리그 경기결과를 완료해 주세요.</div>' : `${qualificationPreview}${generationSection}`}`;
    const bracketOutput = availableLeagues.length
      ? `${controls}${availableLeagues.map((leagueName) => `<section class="tournament-print-league"><div class="tournament-print-league__heading"><strong>${leagueName === 'lower' ? '하위리그' : '상위리그'} 대진표</strong><button type="button" class="game-list-action game-list-action--primary tournament-print-league__button" data-print-tournament="${leagueName}"><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V4h12v5M6 18H4V10h16v8h-2M8 14h8v6H8z"></path></svg><span>대진표 인쇄</span></button></div><div data-tournament-print-sheet="${leagueName}">${renderTournamentPrintSheet(config[leagueName], format, leagueName)}</div></section>`).join('')}`
      : '';
    return `<div class="tournament-print-panel">${setup}${bracketOutput}</div>`;
  }

  function getTournamentConfig(game, format) {
    const tournament = game.tournaments;
    if (tournament?.[format]?.format === format) return tournament[format];
    if (tournament?.format === format) return tournament;
    return null;
  }

  function isTournamentComplete(config) {
    const matches = ['upper', 'lower']
      .flatMap((league) => config?.[league]?.rounds?.flat() || [])
      .filter((match) => match.sideA && match.sideB);
    return matches.length > 0 && matches.every((match) => match.result?.winner && /^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')));
  }

  function isTournamentBracketComplete(bracket) {
    const matches = bracket?.rounds?.flat().filter((match) => match.sideA && match.sideB) || [];
    return matches.length > 0 && matches.every((match) => match.result?.winner && /^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')));
  }

  function getTournamentQualificationEntries(game, format, advancePerGroup, lowerEnabled = true) {
    const standings = getQualifyingStandings(game, format);
    const upperEntries = standings.flatMap((group) => group.standings
      .slice(0, advancePerGroup)
      .map((record) => ({ ...record.player, qualificationRank: record.rank, sourceGroup: group.name })));
    const lowerEntries = lowerEnabled
      ? standings.flatMap((group) => group.standings
        .slice(advancePerGroup)
        .map((record) => ({ ...record.player, qualificationRank: record.rank, sourceGroup: group.name })))
      : [];
    return { standings, upperEntries, lowerEntries };
  }

  function renderTournamentQualificationList(title, entries) {
    if (!entries.length) return `<section class="tournament-qualification-list"><h3>${escapeHtml(title)}</h3><p class="empty-state">해당 진출자가 없습니다.</p></section>`;
    return `<section class="tournament-qualification-list"><div class="group-result-heading"><h3>${escapeHtml(title)}</h3><span>${entries.length}명/팀</span></div><ol>${entries.map((entry) => `<li><span class="rank-badge rank-badge--${entry.qualificationRank || 'pending'}">${entry.qualificationRank || '-'}위</span><strong>${escapeHtml(tournamentLabel(entry))}</strong><small>${escapeHtml(entry.sourceGroup || '')}</small></li>`).join('')}</ol></section>`;
  }

  function renderTournamentOperationPanel(games, game, formats, format) {
    const config = getTournamentConfig(game, format);
    const upper = config?.upper;
    const lower = config?.lower;
    const completionLabel = isTournamentComplete(config) ? '토너먼트 종료 및 저장' : '';
    if (!config || (!upper && !lower)) {
      return `<div class="tournament-panel"><div class="empty-state"><strong>본선 토너먼트 대진표가 아직 생성되지 않았습니다.</strong><p>대진표 메뉴에서 본선 진출자를 결정한 뒤 대진표를 생성해 주세요.</p></div></div>`;
    }
    return `<div class="tournament-panel"><div class="operation-controls tournament-controls tournament-results-format-control"><div class="field"><label for="operationTournamentResultFormat">경기종목</label><select id="operationTournamentResultFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div></div>${upper ? `<section class="tournament-league tournament-result-league"><div class="group-result-heading"><div><p class="section-kicker">상위리그 본선 토너먼트 경기결과</p><h2>${escapeHtml(String(upper.entries.length))}명/팀</h2></div><span class="subtle-note">${escapeHtml(String(upper.size))}강</span></div><div class="tournament-result-live-heading">전체 토너먼트 대진표</div>${renderPublicTournamentBracket(upper)}${renderTournamentResultInputPanel(upper)}<div class="button-row group-save-row"><button type="button" class="btn btn-secondary" data-save-tournament="upper">${completionLabel || '상위리그 경기결과 저장'}</button></div></section>` : ''}${lower ? `<section class="tournament-league tournament-result-league"><div class="group-result-heading"><div><p class="section-kicker">하위리그 본선 토너먼트 경기결과</p><h2>${escapeHtml(String(lower.entries.length))}명/팀</h2></div><span class="subtle-note">${escapeHtml(String(lower.size))}강</span></div><div class="tournament-result-live-heading">전체 토너먼트 대진표</div>${renderPublicTournamentBracket(lower)}${renderTournamentResultInputPanel(lower)}<div class="button-row group-save-row"><button type="button" class="btn btn-secondary" data-save-tournament="lower">${completionLabel || '하위리그 경기결과 저장'}</button></div></section>` : ''}</div>`;
  }

  function renderOperationsPage(currentUser, embedded = false) {
    const games = state.games.filter((game) => game.operatorId === currentUser.id);
    const game = games.find((item) => item.id === state.operationGameId) || games[0];
    if (!game) return `<section class="panel section-card"><div class="empty-state">운영 중인 게임이 없습니다. 먼저 게임을 생성해 주세요.</div></section>`;
    const formats = getGameFormats(game);
    const format = formats.includes(state.operationFormat) ? state.operationFormat : formats[0];
    const saved = game.qualifyingGroups?.[format];
    const participantCount = getGroupingUnits(game, format).length;
    const defaultGroupCount = saved?.groupCount || Math.max(1, Math.ceil(participantCount / 4));
    const groupingBasis = saved?.groupingBasis || 'balanced';
    const tournamentEnabled = getFormatMode(game, format) !== 'leagueOnly';
    const qualifyingResultTitle = tournamentEnabled ? `[${FORMAT_LABELS[format]}] 예선리그 조편성` : `[${FORMAT_LABELS[format]}] 리그전 조편성`;
    const activeOperationSubmenu = tournamentEnabled ? state.operationSubmenu : 'qualifying';
    const operationTitle = { roster: '선수등록', groups: '예선리그 조편성', print: '대진표 출력', results: '경기결과 입력' }[state.operationMenu] || '예선리그 조편성';
    return `
      <section class="panel section-card operations-page${embedded ? ' operations-page--embedded' : ''}">
        <div class="section-heading operations-heading">
          <h1>${operationTitle}</h1>
          <button type="button" class="create-game-close" aria-label="경기운영 닫기" data-back-dashboard><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
        </div>
        <div class="operation-menu"><button type="button" class="operation-menu__item ${state.operationMenu === 'roster' ? 'is-active' : ''}" data-operation-menu="roster"><svg class="operation-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c.7-3.3 2.7-5 6-5s5.3 1.7 6 5M16 6h5M18.5 3.5v5" /></svg><span>선수등록</span></button><button type="button" class="operation-menu__item ${state.operationMenu === 'groups' ? 'is-active' : ''}" data-operation-menu="groups"><svg class="operation-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="7" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M9 7h6M7 9v6M17 9v6M9 17h6" /></svg><span>조편성</span></button><button type="button" class="operation-menu__item ${state.operationMenu === 'print' ? 'is-active' : ''}" data-operation-menu="print"><svg class="operation-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V4h12v5M6 17H4V10h16v7h-2M6 14h12v6H6z" /><path d="M17 12h1" /></svg><span>대진표</span></button><button type="button" class="operation-menu__item ${state.operationMenu === 'results' ? 'is-active' : ''}" data-operation-menu="results"><svg class="operation-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 9l2 2 5-5M8 16h8" /></svg><span>결과입력</span></button></div>
        ${state.operationMenu === 'print' ? `<div class="operation-submenu"><button type="button" class="operation-submenu__item ${activeOperationSubmenu === 'qualifying' ? 'is-active' : ''}" data-operation-submenu="qualifying">리그전 대진표</button>${tournamentEnabled ? `<button type="button" class="operation-submenu__item ${activeOperationSubmenu === 'tournament' ? 'is-active' : ''}" data-operation-submenu="tournament">토너먼트 대진표</button>` : ''}</div>` : ''}
        ${state.operationMenu === 'results' ? `<div class="operation-submenu"><button type="button" class="operation-submenu__item ${activeOperationSubmenu === 'qualifying' ? 'is-active' : ''}" data-operation-submenu="qualifying">예선리그 경기결과 입력</button>${tournamentEnabled ? `<button type="button" class="operation-submenu__item ${activeOperationSubmenu === 'tournament' ? 'is-active' : ''}" data-operation-submenu="tournament">본선 토너먼트 경기결과 입력</button>` : ''}</div>` : ''}
        ${state.operationMenu === 'roster' ? renderRosterOperationPanel(games, game, formats, format) : state.operationMenu === 'print' && activeOperationSubmenu === 'qualifying' ? renderScheduleOperationPanel(games, game, formats, format, 'generate') : state.operationMenu === 'results' && activeOperationSubmenu === 'qualifying' ? renderScheduleOperationPanel(games, game, formats, format, 'results') : state.operationMenu === 'print' && activeOperationSubmenu === 'tournament' ? renderTournamentPrintPanel(games, game, formats, format) : state.operationMenu === 'results' && activeOperationSubmenu === 'tournament' ? renderTournamentOperationPanel(games, game, formats, format) : `<div class="operation-controls qualifying-controls">
          <div class="field"><label for="operationGame">게임</label><select id="operationGame" data-operation-game>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === game.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></div>
          <div class="qualifying-settings"><div class="field"><label for="operationFormat">경기종목</label><select id="operationFormat" data-operation-format>${formats.map((item) => `<option value="${escapeHtml(item)}" ${item === format ? 'selected' : ''}>${escapeHtml(FORMAT_LABELS[item])}</option>`).join('')}</select></div>
          <div class="field"><label for="groupCount">조편성 수(${format === 'singles' ? `${participantCount}명` : `${participantCount}팀`})</label><input id="groupCount" type="number" min="1" max="${Math.max(1, participantCount)}" value="${escapeHtml(String(defaultGroupCount))}" data-group-count /></div>
          <div class="field"><label for="groupingBasis">조편성 기준</label><select id="groupingBasis" data-grouping-basis><option value="balanced" ${groupingBasis === 'balanced' ? 'selected' : ''}>부수균등배치</option><option value="similar" ${groupingBasis === 'similar' ? 'selected' : ''}>동일부수배치</option></select></div></div>
          <button type="button" class="game-list-action game-list-action--primary qualifying-generate-action" data-generate-groups><svg class="game-list-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"></path><circle cx="12" cy="12" r="8"></circle></svg><span>조편성 생성</span></button>
        </div>
        <div class="qualifying-result-divider" aria-hidden="true"></div>
        <div class="group-result-heading qualifying-result-heading"><div><h2>${escapeHtml(qualifyingResultTitle)}</h2><p class="qualifying-result-guide">자동 조편성 후 운영자는 조를 수정할 수 있습니다.<br />이동할 선수를 선택한 뒤 민트색으로 강조된 조 제목을 선택하면 해당 조로 이동합니다.</p></div></div>
        ${renderOperationGroups(game, format)}
        ${saved ? `<div class="button-row group-save-row"><span class="group-visibility-status ${saved.isPublic ? 'is-public' : ''}">${saved.isPublic ? '회원 공개 중' : '현재 비공개'}</span><button type="button" class="game-list-action" data-save-groups><span>수정한 조편성 저장</span></button><button type="button" class="game-list-action game-list-action--primary" data-toggle-group-visibility="${escapeHtml(game.id)}"><span>${saved.isPublic ? '회원 공개 취소' : '회원 공개'}</span></button></div>` : ''}`}
      </section>
    `;
  }

  function getOperationStartMenu(game, format) {
    if (getGameFormats(game).some((item) => !isRegistrationClosed(game, item))) return 'roster';
    const qualifyingGroups = game.qualifyingGroups?.[format];
    if (!qualifyingGroups?.groups?.length || qualifyingGroups.isPublic !== true) return 'groups';
    if (!game.preliminaryMatches?.[format]?.matches?.length) return 'print';
    return 'results';
  }

  function openOperations(gameId = null, menu = null) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const games = state.games.filter((game) => game.operatorId === currentUser.id);
    const game = games.find((item) => item.id === gameId) || games[0];
    if (!game) {
      setFlash('경기운영을 시작하려면 먼저 게임을 생성해 주세요.', 'info');
      render();
      return;
    }
    state.selectedGameId = game.id;
    state.editingGameId = null;
    state.operationGameId = game.id;
    state.operationFormat = getGameFormats(game)[0] || null;
    state.selectedScheduleGroup = null;
    const initialMenu = ['groups', 'roster', 'print', 'results'].includes(menu) ? menu : getOperationStartMenu(game, state.operationFormat);
    state.operationMenu = initialMenu;
    state.operationSubmenu = 'qualifying';
    render();
  }

  function handleGenerateGroups() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const groupCount = Number.parseInt(document.querySelector('[data-group-count]')?.value, 10);
    const groupingBasis = document.querySelector('[data-grouping-basis]')?.value === 'similar' ? 'similar' : 'balanced';
    if (!currentUser || !game || game.operatorId !== currentUser.id || !format) return;
    const participantCount = getGroupingUnits(game, format).length;
    if (!participantCount) {
      setFlash('조편성할 참가자가 없습니다. 먼저 참가선수를 등록해 주세요.', 'error');
      render();
      return;
    }
    if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > participantCount) {
      setFlash(`조편성 수는 1개부터 참가 단위 수(${participantCount}개) 사이로 입력해 주세요.`, 'error');
      render();
      return;
    }
    if (game.qualifyingGroups?.[format]?.groups?.length && !window.confirm('기존 조편성을 새 기준으로 다시 생성할까요? 기존 조 이동과 결과가 초기화될 수 있습니다.')) return;
    game.qualifyingGroups = game.qualifyingGroups || {};
    const groups = buildQualifyingGroups(game, format, groupCount, groupingBasis);
    game.qualifyingGroups[format] = { groupCount, groupingBasis, groupSize: Math.ceil(participantCount / groupCount), groups, generatedAt: new Date().toISOString() };
    if (game.preliminaryMatches) delete game.preliminaryMatches[format];
    persistGames();
    setFlash(`${FORMAT_LABELS[format]} 조편성이 생성되었습니다.`, 'success');
    render();
  }

  async function handleGenerateSchedule() {
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
    const selectedGroupName = state.selectedScheduleGroup && state.selectedScheduleGroup !== '__all__' ? state.selectedScheduleGroup : null;
    const targetGroups = selectedGroupName ? groups.filter((group) => group.name === selectedGroupName) : groups;
    if (!targetGroups.length) {
      setFlash('대진표를 생성할 조를 확인해 주세요.', 'error');
      render();
      return;
    }
    const generatedMatches = targetGroups.flatMap((group, index) => buildRoundRobinMatches(group, format, index));
    const existingMatches = selectedGroupName
      ? (game.preliminaryMatches?.[format]?.matches || []).filter((match) => match.groupName !== selectedGroupName)
      : [];
    const matches = [...existingMatches, ...generatedMatches]
      .sort((left, right) => left.round - right.round || left.groupIndex - right.groupIndex)
      .map((match, index) => ({ ...match, order: index + 1 }));
    game.preliminaryMatches = game.preliminaryMatches || {};
    game.preliminaryMatches[format] = { format, pointsToWin: 11, bestOf: 5, groups: groups.map((group) => group.name), matches, generatedAt: new Date().toISOString() };
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/preliminary-matches`, {
        method: 'PATCH',
        body: JSON.stringify({ format, schedule: game.preliminaryMatches[format] }),
      });
      await loadState();
      setFlash(`${FORMAT_LABELS[format]} 예선 대진표가 생성되었습니다.`, 'success');
    } catch (error) {
      setFlash(error.message || '예선 대진표 저장에 실패했습니다.', 'error');
    }
    render();
  }

  async function handleDecideTournamentQualification() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const advancePerGroup = Number.parseInt(document.querySelector('[data-tournament-advance]')?.value, 10);
    const lowerEnabled = Boolean(document.querySelector('[data-tournament-lower]')?.checked);
    const standings = game ? getQualifyingStandings(game, format) : [];
    const preliminaryMatches = game?.preliminaryMatches?.[format]?.matches || [];
    const maxGroupSize = Math.max(0, ...standings.map((group) => group.standings.length));
    if (!currentUser || !game || game.operatorId !== currentUser.id || !format) return;
    if (!standings.length || !preliminaryMatches.length || preliminaryMatches.some((match) => !match.result?.winner || !/^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')))) {
      setFlash('예선리그 모든 경기결과를 먼저 입력하고 저장해 주세요.', 'error');
      render();
      return;
    }
    if (!Number.isInteger(advancePerGroup) || advancePerGroup < 1 || advancePerGroup > maxGroupSize) {
      setFlash(`상위리그 본선 진출순위는 1등부터 ${maxGroupSize}등까지 선택할 수 있습니다.`, 'error');
      render();
      return;
    }
    const previousConfig = getTournamentConfig(game, format);
    if ((previousConfig?.upper || previousConfig?.lower) && !window.confirm('본선 진출 기준을 다시 결정하면 기존 본선 대진표와 결과가 초기화됩니다. 계속할까요?')) return;
    game.tournaments = game.tournaments || {};
    game.tournaments[format] = {
      format,
      advancePerGroup,
      upperEnabled: true,
      lowerEnabled,
      qualificationConfirmed: true,
      upper: null,
      lower: null,
      decidedAt: new Date().toISOString(),
    };
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/tournaments`, {
        method: 'PATCH',
        body: JSON.stringify({ format, tournament: game.tournaments[format] }),
      });
      await loadState();
      setFlash(`${FORMAT_LABELS[format]} 본선 진출자가 결정되었습니다.`, 'success');
    } catch (error) {
      setFlash(error.message || '본선 진출자 결정 저장에 실패했습니다.', 'error');
    }
    render();
  }

  async function handleGenerateTournament() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const standings = game ? getQualifyingStandings(game, format) : [];
    const advancePerGroup = Number.parseInt(document.querySelector('[data-tournament-advance]')?.value, 10);
    const lowerEnabled = Boolean(document.querySelector('[data-tournament-lower]')?.checked);
    const generationLeague = document.querySelector('[data-tournament-generate-league]')?.value === 'lower' ? 'lower' : 'upper';
    const preliminaryMatches = game?.preliminaryMatches?.[format]?.matches || [];
    if (!currentUser || !game || game.operatorId !== currentUser.id || !format) return;
    if (!standings.length || !preliminaryMatches.length || preliminaryMatches.some((match) => !match.result?.winner || !/^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')))) {
      setFlash('예선리그 모든 경기결과를 먼저 입력하고 저장해 주세요.', 'error');
      render();
      return;
    }
    const maxGroupSize = Math.max(...standings.map((group) => group.standings.length));
    const maxAdvancePerGroup = maxGroupSize;
    if (!Number.isInteger(advancePerGroup) || advancePerGroup < 1 || advancePerGroup > maxAdvancePerGroup) {
      setFlash(`조별 진출 등수는 1등 또는 2등까지 입력해 주세요.`, 'error');
      render();
      return;
    }
    const upperEntries = standings.flatMap((group) => group.standings.slice(0, advancePerGroup).map((record) => ({ ...record.player, qualificationRank: record.rank, sourceGroup: group.name })));
    const lowerEntries = standings.flatMap((group) => group.standings.slice(advancePerGroup).map((record) => ({ ...record.player, qualificationRank: record.rank, sourceGroup: group.name })));
    const entries = generationLeague === 'lower' ? lowerEntries : upperEntries;
    if (generationLeague === 'lower' && !lowerEnabled) {
      setFlash('하위리그 진행을 먼저 선택해 주세요.', 'error');
      render();
      return;
    }
    if (!entries.length) {
      setFlash(`${generationLeague === 'lower' ? '하위리그' : '상위리그'} 본선 진출자가 없습니다.`, 'error');
      render();
      return;
    }
    const previousConfig = getTournamentConfig(game, format);
    const tournaments = {
      ...(previousConfig || {}),
      upper: previousConfig?.upper || null,
      lower: previousConfig?.lower || null,
    };
    tournaments[generationLeague] = buildTournamentBracket(entries, generationLeague, format);
    game.tournaments = game.tournaments || {};
    game.tournaments[format] = { ...tournaments, format, advancePerGroup, upperEnabled: true, lowerEnabled, qualificationConfirmed: true, generatedAt: new Date().toISOString() };
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/tournaments`, {
        method: 'PATCH',
        body: JSON.stringify({ format, tournament: game.tournaments[format] }),
      });
      await loadState();
      setFlash(`${FORMAT_LABELS[format]} ${generationLeague === 'lower' ? '하위리그' : '상위리그'} 본선 토너먼트가 구성되었습니다.`, 'success');
    } catch (error) {
      setFlash(error.message || '토너먼트 저장에 실패했습니다.', 'error');
      await loadState();
    }
    render();
  }

  async function handleSaveTournamentResults(leagueToSave = null) {
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
        if (scoreInput) syncTournamentWinnerFromScore(scoreInput);
        if (scoreInput || winnerInput) match.result = { score: trimValue(scoreInput?.value), winner: winnerInput?.value || '' };
      });
      syncTournamentBracket(bracket);
    });
    tournaments.updatedAt = new Date().toISOString();
    const leaguesToCheck = leagueToSave === 'upper' || leagueToSave === 'lower' ? leaguesToSave : ['upper', 'lower'];
    leaguesToCheck.forEach((league) => {
      const bracket = tournaments[league];
      if (bracket && isTournamentBracketComplete(bracket)) {
        bracket.completed = true;
        bracket.completedAt = new Date().toISOString();
      }
    });
    const enabledLeagues = ['upper', 'lower'].filter((league) => tournaments[league]);
    const tournamentComplete = enabledLeagues.length > 0 && enabledLeagues.every((league) => tournaments[league].completed === true);
    if (tournamentComplete) tournaments.completed = true;
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/tournaments`, {
        method: 'PATCH',
        body: JSON.stringify({ format, tournament: game.tournaments[format] }),
      });
      await loadState();
      setFlash(tournamentComplete ? '본선 토너먼트가 종료되었고 최종 결과가 저장되었습니다.' : `${leagueToSave === 'lower' ? '하위리그' : leagueToSave === 'upper' ? '상위리그' : '상·하위리그'} 본선 토너먼트 경기결과가 저장되었습니다.`, 'success');
    } catch (error) {
      setFlash(error.message || '토너먼트 경기결과 저장에 실패했습니다.', 'error');
    }
    render();
  }

  async function handleTournamentMatchChange(matchId) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const tournaments = getTournamentConfig(game, format);
    if (!currentUser || !game || game.operatorId !== currentUser.id || !tournaments || tournaments.completed) return;
    let targetMatch = null;
    let targetLeague = null;
    for (const league of ['upper', 'lower']) {
      const bracket = tournaments[league];
      const match = bracket?.rounds?.flat().find((item) => item.id === matchId);
      if (match) {
        targetMatch = match;
        targetLeague = league;
        break;
      }
    }
    if (!targetMatch || tournaments[targetLeague]?.completed) return;
    const scoreInput = document.querySelector(`[data-tournament-score="${CSS.escape(matchId)}"]`);
    const winnerInput = document.querySelector(`[data-tournament-winner="${CSS.escape(matchId)}"]`);
    if (scoreInput) syncTournamentWinnerFromScore(scoreInput);
    targetMatch.result = { score: trimValue(scoreInput?.value), winner: winnerInput?.value || '' };
    ['upper', 'lower'].forEach((league) => {
      if (tournaments[league]) syncTournamentBracket(tournaments[league]);
    });
    tournaments.updatedAt = new Date().toISOString();
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/tournaments`, {
        method: 'PATCH',
        body: JSON.stringify({ format, tournament: tournaments }),
      });
      await loadState();
      render();
    } catch (error) {
      setFlash(error.message || '토너먼트 경기결과 자동 저장에 실패했습니다.', 'error');
      render();
    }
  }

  function queueScheduleResultsSave() {
    window.clearTimeout(scheduleResultsSaveTimer);
    scheduleResultsSaveTimer = window.setTimeout(() => {
      scheduleResultsSaveTimer = null;
      void handleSaveScheduleResults(true);
    }, 1000);
  }

  function syncScheduleWinnerFromScore(input) {
    if (!input.matches('[data-match-score]')) return;
    const score = input.value.match(/^(\d+)\s*:\s*(\d+)$/);
    const winnerInput = document.querySelector(`[data-match-winner="${CSS.escape(input.dataset.matchScore)}"]`);
    if (!winnerInput) return;
    if (!score || score[1] === score[2]) {
      winnerInput.value = '';
      return;
    }
    winnerInput.value = Number(score[1]) > Number(score[2]) ? 'A' : 'B';
  }

  function syncTournamentWinnerFromScore(input) {
    if (!input.matches('[data-tournament-score]')) return;
    const score = input.value.match(/^(\d+)\s*:\s*(\d+)$/);
    const winnerInput = document.querySelector(`[data-tournament-winner="${CSS.escape(input.dataset.tournamentScore)}"]`);
    if (!winnerInput) return;
    if (!score || score[1] === score[2]) {
      winnerInput.value = '';
      return;
    }
    winnerInput.value = Number(score[1]) > Number(score[2]) ? 'A' : 'B';
  }

  function applySavedGame(game) {
    if (!game?.id) return;
    const index = state.games.findIndex((item) => item.id === game.id);
    if (index >= 0) state.games[index] = game;
  }

  async function handleSaveScheduleResults(silent = false) {
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
    const scheduleComplete = schedule.matches.length > 0 && schedule.matches.every((match) => match.result?.winner && /^(\d+)\s*[-:]\s*(\d+)$/.test(String(match.result.score || '')));
    if (scheduleComplete) {
      schedule.completed = true;
      schedule.completedAt = new Date().toISOString();
    }
    schedule.updatedAt = new Date().toISOString();
    try {
      const payload = await apiRequest(`/api/games/${encodeURIComponent(game.id)}/preliminary-matches`, {
        method: 'PATCH',
        body: JSON.stringify({ format, schedule }),
      });
      applySavedGame(payload.game);
      if (!silent) setFlash(scheduleComplete ? '예선리그 경기가 종료되었고 최종 결과가 저장되었습니다.' : '예선리그 경기결과가 저장되었습니다.', 'success');
    } catch (error) {
      console.error('예선리그 경기결과 자동 저장 실패:', error);
      setFlash(error.message || '예선리그 경기결과 자동 저장에 실패했습니다.', 'error');
    }
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

  function handlePrintAllSchedules() {
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const groups = game?.qualifyingGroups?.[format]?.groups || [];
    const matches = game?.preliminaryMatches?.[format]?.matches || [];
    if (!groups.length || !matches.length) return;
    const printRoot = document.createElement('div');
    printRoot.id = 'schedule-print-root';
    printRoot.className = 'schedule-print-root';
    printRoot.innerHTML = groups.map((group) => {
      const groupMatches = matches.filter((match) => match.groupName === group.name);
      const groupNumber = String(group.name).replace(/\s*조$/, '');
      return `<section class="schedule-print-group schedule-group-block"><div class="group-result-heading schedule-print-heading"><h3>[${escapeHtml(FORMAT_LABELS[format])} (${escapeHtml(groupNumber)})조 대진표]</h3><span>${escapeHtml(String(groupMatches.length))}경기 · ${escapeHtml(String(group.players.length))}명/팀</span></div>${renderScheduleMatrix(group, groupMatches)}<h4 class="schedule-order-title">${escapeHtml(group.name)} 경기 진행순서</h4>${renderScheduleResultsTable(groupMatches, false, format)}</section>`;
    }).join('');
    printRoot.querySelectorAll('.muted').forEach((element) => { element.textContent = ''; });
    document.body.appendChild(printRoot);
    const cleanup = () => document.body.classList.remove('is-printing-schedule');
    document.body.classList.add('is-printing-schedule');
    window.addEventListener('afterprint', () => {
      cleanup();
      printRoot.remove();
    }, { once: true });
    window.print();
  }

  function handlePrintTournament(printButton = null) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const config = getTournamentConfig(game, format);
    const league = printButton?.dataset.printTournament || 'upper';
    const bracket = config?.[league];
    const sheetContainer = bracket ? document.querySelector(`[data-tournament-print-sheet="${league}"]`) : null;
    const sheetList = sheetContainer?.querySelector('.tournament-print-sheet-list');
    if (!currentUser || !game || game.operatorId !== currentUser.id || !sheetList) return;
    const printRoot = document.createElement('div');
    printRoot.id = 'tournament-print-root';
    printRoot.className = 'tournament-print-root';
    printRoot.innerHTML = sheetList.outerHTML;
    document.body.appendChild(printRoot);
    const cleanup = () => {
      document.body.classList.remove('is-printing-tournament');
    };
    document.body.classList.add('is-printing-tournament');
    window.addEventListener('afterprint', () => {
      cleanup();
      printRoot.remove();
    }, { once: true });
    window.print();
  }

  async function handleSaveGroups() {
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
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/qualifying-groups`, {
        method: 'PATCH',
        body: JSON.stringify({ format, setup: game.qualifyingGroups[format] }),
      });
      await loadState();
      setFlash('수정한 조편성이 서버에 저장되었습니다. 예선 대진표를 다시 생성해 주세요.', 'success');
    } catch (error) {
      persistGames();
      setFlash(error.message || '조편성 저장에 실패했습니다.', 'error');
    }
    render();
  }

  async function handleSaveRegistration(registrationId) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const registration = game && getGameRegistrations(game).find((item) => item.id === registrationId);
    if (!currentUser || !game || game.operatorId !== currentUser.id || !registrationId || !registration) return;
    const values = Object.fromEntries([...document.querySelectorAll(`[data-registration-id="${CSS.escape(registrationId)}"][data-registration-field]`)].map((input) => [input.dataset.registrationField, trimValue(input.value)]));
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/registrations/${encodeURIComponent(registrationId)}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      await loadState();
      state.editingRegistrationId = null;
      setFlash('참가선수 정보가 수정되었습니다.', 'success');
    } catch (error) {
      setFlash(error.message || '참가선수 정보 수정에 실패했습니다.', 'error');
    }
    render();
  }

  async function handleDeleteRegistration(registrationId) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    if (!currentUser || !game || game.operatorId !== currentUser.id || !registrationId) return;
    if (!window.confirm('이 참가선수를 삭제할까요?')) return;
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/registrations/${encodeURIComponent(registrationId)}`, { method: 'DELETE' });
      await loadState();
      state.editingRegistrationId = null;
      setFlash('참가선수가 삭제되었습니다.', 'success');
    } catch (error) {
      setFlash(error.message || '참가선수 삭제에 실패했습니다.', 'error');
    }
    render();
  }

  async function handleToggleGroupVisibility() {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === state.operationGameId);
    const format = state.operationFormat;
    const setup = game?.qualifyingGroups?.[format];
    if (!currentUser || !game || game.operatorId !== currentUser.id || !setup) return;
    const isPublic = setup.isPublic !== true;
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/qualifying-groups/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ format, isPublic }),
      });
      await loadState();
      setFlash(isPublic ? '조편성이 회원에게 공개되었습니다.' : '조편성이 비공개로 전환되었습니다.', 'success');
    } catch (error) {
      setFlash(error.message || '조편성 공개 상태 변경에 실패했습니다.', 'error');
    }
    render();
  }

  function renderDashboard(currentUser) {
    const createPanel = state.showCreateGame ? renderCreateGameForm(currentUser) : '';
    const selectedGame = state.games.find((game) => game.id === state.selectedGameId);
    const editingGame = state.games.find((game) => game.id === state.editingGameId);

    if (state.page === 'admin' && currentUser.role === 'admin') return renderAdminPage(currentUser);
    if (state.showLeagueSeries) return renderLeagueSeriesPage(currentUser);
    if (state.operationGameId) {
      const operationGame = state.games.find((game) => game.id === state.operationGameId);
      if (operationGame?.operatorId === currentUser.id) {
        state.selectedGameId = operationGame.id;
        return renderGameDetailView(operationGame, currentUser);
      }
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
              <label class="choice-option">남자 <input type="radio" name="gender" value="male" ${currentUser.gender === 'male' ? 'checked' : ''} /></label>
              <label class="choice-option">여자 <input type="radio" name="gender" value="female" ${currentUser.gender === 'female' ? 'checked' : ''} /></label>
            </div>
          </div>
          <div class="field-grid">
            ${renderRegionFields('profile', currentUser, true)}
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
        <div class="account-danger-zone">
          <div><strong>회원탈퇴</strong><p>탈퇴하면 회원정보와 로그인 세션이 삭제되며 되돌릴 수 없습니다.</p></div>
          <button class="btn btn-danger" type="button" data-delete-account>회원탈퇴</button>
        </div>
      </section>
    `;
  }

  function getRoleLabel(role) {
    return role === 'admin' ? '시스템관리자' : role === 'operator' ? '운영자' : '일반회원';
  }

  function renderAdminVenueEditCard(venue, isEditing) {
    if (isEditing) {
      return `<form class="admin-venue-card" data-form="admin-venue" data-venue-id="${escapeHtml(venue.id)}"><div class="field"><label>탁구장명</label><input name="name" value="${escapeHtml(venue.name)}" required /></div><div class="field"><label>주소</label><input name="address" value="${escapeHtml(venue.address)}" required /></div><div class="field"><label>지역</label><input name="region" value="${escapeHtml(venue.region || '')}" placeholder="예: 인천광역시 미추홀구" /></div><div class="field"><label>전화번호</label><input name="phone" value="${escapeHtml(venue.phone || '')}" /></div><div class="field"><label>상태</label><select name="status"><option value="pending" ${venue.status === 'pending' ? 'selected' : ''}>승인대기</option><option value="approved" ${venue.status === 'approved' ? 'selected' : ''}>사용</option><option value="archived" ${venue.status === 'archived' ? 'selected' : ''}>보관</option></select></div><div class="button-row"><button class="btn btn-primary" type="submit">저장</button><button class="btn btn-ghost" type="button" data-admin-venue-edit-cancel>취소</button></div></form>`;
    }
    return `<article class="admin-venue-card admin-venue-card--result"><strong>${escapeHtml(venue.name)}</strong><span>${escapeHtml(venue.address)}</span><span>${escapeHtml(venue.region || '지역 미입력')}</span><span>${escapeHtml(venue.phone || '전화번호 미입력')}</span><span class="admin-role-badge">${venue.status === 'approved' ? '사용' : venue.status === 'archived' ? '보관' : '승인대기'}</span><button class="btn btn-secondary" type="button" data-admin-venue-edit="${escapeHtml(venue.id)}">수정</button></article>`;
  }

  function renderAdminPage(currentUser) {
    const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
    const venues = Array.isArray(state.adminVenues) ? state.adminVenues : [];
    const venueSearch = trimValue(state.adminVenueSearch).toLowerCase();
    const adminVenueTab = ['register', 'view', 'edit'].includes(state.adminVenueTab) ? state.adminVenueTab : 'register';
    const editVenues = adminVenueTab === 'edit' && venueSearch
      ? venues.filter((venue) => String(venue.name || '').toLowerCase().includes(venueSearch))
      : [];
    const editVenueRows = editVenues.map((venue) => renderAdminVenueEditCard(venue, state.adminVenueEditingId === venue.id)).join('');
    const regionParts = (venue) => trimValue(venue.region).split(/\s+/).filter(Boolean);
    const venueSido = state.adminVenueSido || '';
    const venueSigunguOptions = [...new Set(venues.filter((venue) => !venueSido || regionParts(venue)[0] === venueSido).map((venue) => regionParts(venue)[1]).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ko'));
    const viewVenues = venues.filter((venue) => {
      const parts = regionParts(venue);
      return (!venueSido || parts[0] === venueSido) && (!state.adminVenueSigungu || parts[1] === state.adminVenueSigungu);
    });
    const venueViewRows = viewVenues.map((venue) => `<tr><td>${escapeHtml(venue.name)}</td><td>${escapeHtml(venue.address)}</td><td>${escapeHtml(venue.region || '미입력')}</td><td>${escapeHtml(venue.phone || '미입력')}</td><td>${venue.status === 'approved' ? '사용' : venue.status === 'archived' ? '보관' : '승인대기'}</td></tr>`).join('');
    const loading = state.adminDataLoading;
    const access = Array.isArray(state.adminAccess) ? state.adminAccess : [];
    const adminTab = ['venues', 'access'].includes(state.adminTab) ? state.adminTab : 'users';
    return `
      <section class="panel section-card admin-page">
        <div class="section-heading admin-page__heading">
          <div><h1>시스템 관리</h1></div>
          <button type="button" class="create-game-close" aria-label="시스템 관리 닫기" data-back-dashboard><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
        </div>
        <div class="admin-role-card"><strong>${escapeHtml(currentUser.nickname)}</strong><span>시스템관리자</span></div>
        <nav class="admin-tabs" aria-label="시스템 관리 메뉴">
          <button type="button" class="admin-tab ${adminTab === 'users' ? 'is-active' : ''}" data-admin-tab="users">회원정보관리</button>
          <button type="button" class="admin-tab ${adminTab === 'venues' ? 'is-active' : ''}" data-admin-tab="venues">탁구장정보관리</button>
          <button type="button" class="admin-tab ${adminTab === 'access' ? 'is-active' : ''}" data-admin-tab="access">접속현황</button>
        </nav>
        <div class="admin-tab-panel ${adminTab === 'users' ? 'is-active' : ''}" data-admin-panel="users">
          <div class="section-heading admin-panel-heading"><div><p class="section-kicker">회원정보</p><h2>회원정보관리</h2></div><button class="btn btn-secondary" type="button" data-admin-refresh="users">회원정보 새로고침</button></div>
        <div class="admin-users-table-wrap">
          <table class="admin-users-table">
            <thead><tr><th>회원명</th><th>아이디</th><th>활동지역</th><th>연락처</th><th>권한</th><th>가입일</th></tr></thead>
            <tbody>${loading ? '<tr><td colspan="6">회원정보를 불러오는 중입니다...</td></tr>' : state.adminUserLoadError ? `<tr><td colspan="6">${escapeHtml(state.adminUserLoadError)}</td></tr>` : users.length ? users.map((user) => `<tr><td>${escapeHtml(user.nickname)}</td><td>${escapeHtml(user.memberId)}</td><td>${escapeHtml(regionLabel(user.regionSido, user.regionSigungu) || user.region || '미입력')}</td><td>${escapeHtml(user.phone || '미입력')}</td><td><span class="admin-role-badge admin-role-badge--${escapeHtml(user.role || 'user')}">${getRoleLabel(user.role)}</span></td><td>${escapeHtml(formatDateTime(user.createdAt))}</td></tr>`).join('') : '<tr><td colspan="6">등록된 회원이 없습니다.</td></tr>'}</tbody>
          </table>
        </div>
        </div>
        <div class="admin-tab-panel ${adminTab === 'venues' ? 'is-active' : ''}" data-admin-panel="venues">
        <div class="admin-venues-section" data-admin-venue-tab="${adminVenueTab}">
          <div class="section-heading"><div><p class="section-kicker">탁구장 정보 DB</p><h2>탁구장 정보 관리</h2></div></div>
          <nav class="admin-venue-tabs" aria-label="탁구장 관리 메뉴"><button type="button" class="admin-tab ${adminVenueTab === 'register' ? 'is-active' : ''}" data-admin-venue-tab-button="register">탁구장정보등록</button><button type="button" class="admin-tab ${adminVenueTab === 'view' ? 'is-active' : ''}" data-admin-venue-tab-button="view">탁구장보기</button><button type="button" class="admin-tab ${adminVenueTab === 'edit' ? 'is-active' : ''}" data-admin-venue-tab-button="edit">탁구장정보수정</button></nav>
          <form class="admin-venue-create" data-form="admin-venue-create">
            <div class="admin-venue-create__heading"><strong>새 탁구장 등록</strong></div>
            <div class="admin-venue-create__fields">
              <div class="field"><label for="adminVenueName">탁구장명</label><input id="adminVenueName" name="name" required placeholder="예: 부천탁구클럽" /></div>
              <div class="field"><label for="adminVenueAddress">주소</label><input id="adminVenueAddress" name="address" required placeholder="도로명 주소" /></div>
              <div class="field"><label for="adminVenuePhone">전화번호</label><input id="adminVenuePhone" name="phone" type="tel" placeholder="예: 032-123-4567" /></div>
              <div class="field"><label for="adminVenueRegion">지역</label><input id="adminVenueRegion" name="region" placeholder="예: 경기 부천시" /></div>
              <div class="field"><label for="adminVenueMapUrl">지도 링크</label><input id="adminVenueMapUrl" name="mapUrl" type="url" placeholder="선택 입력" /></div>
              <button class="btn btn-primary admin-venue-create__submit" type="submit">탁구장 등록</button>
            </div>
          </form>
          <div class="admin-venue-bulk-import">
            <div><strong>CSV·TSV 일괄등록</strong></div>
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" data-admin-venue-import-file />
            ${state.adminVenueImportRows.length ? `<p class="admin-import-summary">${state.adminVenueImportRows.length}건을 읽었습니다. 아래 버튼을 눌러 등록하세요.</p>` : ''}
            ${state.adminVenueImportMessage ? `<p class="admin-load-error">${escapeHtml(state.adminVenueImportMessage)}</p>` : ''}
            <button class="btn btn-secondary" type="button" data-admin-venue-import-submit ${state.adminVenueImportRows.length ? '' : 'disabled'}>일괄등록</button>
          </div>
          <div class="admin-venue-view-table">
            <div class="admin-venue-view-toolbar"><select data-admin-venue-sido><option value="">전체 시·도</option>${Object.keys(REGION_HIERARCHY).map((sido) => `<option value="${escapeHtml(sido)}" ${venueSido === sido ? 'selected' : ''}>${escapeHtml(sido)}</option>`).join('')}</select><select data-admin-venue-sigungu ${venueSido ? '' : 'disabled'}><option value="">전체 시·군·구</option>${venueSigunguOptions.map((sigungu) => `<option value="${escapeHtml(sigungu)}" ${state.adminVenueSigungu === sigungu ? 'selected' : ''}>${escapeHtml(sigungu)}</option>`).join('')}</select></div>
            <div class="admin-users-table-wrap"><table class="admin-users-table"><thead><tr><th>탁구장명</th><th>주소</th><th>지역</th><th>전화번호</th><th>상태</th></tr></thead><tbody>${loading ? '<tr><td colspan="5">탁구장정보를 불러오는 중입니다...</td></tr>' : state.adminVenueLoadError ? `<tr><td colspan="5">${escapeHtml(state.adminVenueLoadError)}</td></tr>` : venueViewRows || '<tr><td colspan="5">조회된 탁구장이 없습니다.</td></tr>'}</tbody></table></div>
          </div>
          <form class="admin-venue-toolbar" data-form="admin-venue-search"><input class="admin-venue-search" name="search" type="search" data-admin-venue-search placeholder="탁구장명 검색" value="${escapeHtml(state.adminVenueSearch)}" /><button class="btn btn-secondary admin-venue-search-submit" type="submit" data-admin-venue-search-submit><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5"></path></svg><span>검색</span></button></form>
          <div class="admin-venue-list">${loading ? '<p class="muted">탁구장정보를 불러오는 중입니다...</p>' : state.adminVenueLoadError ? `<p class="admin-load-error">${escapeHtml(state.adminVenueLoadError)}</p>` : editVenueRows || (venueSearch ? '<p class="muted">검색 결과가 없습니다.</p>' : '<p class="muted">탁구장명을 입력한 후 검색 버튼을 눌러 주세요.</p>')}</div>
        </div>
        </div>
        <div class="admin-tab-panel ${adminTab === 'access' ? 'is-active' : ''}" data-admin-panel="access">
          <div class="section-heading admin-panel-heading"><div><p class="section-kicker">실시간 접속</p><h2>접속현황</h2></div><button class="btn btn-secondary" type="button" data-admin-refresh="access">접속현황 새로고침</button></div>
          <div class="admin-users-table-wrap">
            <table class="admin-users-table">
              <thead><tr><th>구분</th><th>아이디</th><th>권한</th><th>최초 접속</th><th>최근 활동</th></tr></thead>
              <tbody>${state.adminAccessLoading ? '<tr><td colspan="5">접속현황을 불러오는 중입니다...</td></tr>' : state.adminAccessLoadError ? `<tr><td colspan="5">${escapeHtml(state.adminAccessLoadError)}</td></tr>` : access.length ? access.map((visitor) => `<tr><td>${escapeHtml(visitor.nickname || '비회원 방문자')}</td><td>${escapeHtml(visitor.memberId || '-')}</td><td>${escapeHtml(visitor.role ? getRoleLabel(visitor.role) : '비회원')}</td><td>${escapeHtml(formatDateTime(visitor.firstSeen))}</td><td>${escapeHtml(formatDateTime(visitor.lastSeen))}</td></tr>`).join('') : '<tr><td colspan="5">현재 접속자가 없습니다.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="button-row"><button class="btn btn-ghost" type="button" data-back-dashboard>게임목록으로 돌아가기</button></div>
      </section>
    `;
  }

  async function refreshAdminData(scope = 'all') {
    if (scope === 'access') {
      state.adminAccessLoading = true;
      state.adminAccessLoadError = '';
      render();
      try {
        const result = await apiRequest('/api/admin/access-status');
        state.adminAccess = Array.isArray(result.active) ? result.active : [];
      } catch (error) {
        state.adminAccessLoadError = `접속현황을 불러오지 못했습니다: ${error.message || '서버 오류'}`;
        setFlash(state.adminAccessLoadError, 'error');
      } finally {
        state.adminAccessLoading = false;
        render();
      }
      return;
    }
    const shouldLoadUsers = scope === 'all' || scope === 'users';
    const shouldLoadVenues = scope === 'all' || scope === 'venues';
    state.adminDataLoading = true;
    if (shouldLoadUsers) {
      state.adminUsers = [];
      state.adminUserLoadError = '';
    }
    if (shouldLoadVenues) {
      state.adminVenues = [];
      state.adminVenueLoadError = '';
    }
    render();
    const requests = [];
    if (shouldLoadUsers) requests.push(['users', apiRequest('/api/admin/users')]);
    if (shouldLoadVenues) requests.push(['venues', apiRequest('/api/admin/venues')]);
    const results = await Promise.all(requests.map(async ([kind, request]) => [kind, await Promise.allSettled([request])]))
      .then((items) => items.map(([kind, result]) => [kind, result[0]]));
    for (const [kind, result] of results) {
      if (kind === 'users' && result.status === 'fulfilled') {
        state.adminUsers = Array.isArray(result.value.users) ? result.value.users : [];
      } else if (kind === 'users') {
        state.adminUserLoadError = `회원 정보를 불러오지 못했습니다: ${result.reason?.message || '서버 오류'}`;
        setFlash(state.adminUserLoadError, 'error');
      } else if (kind === 'venues' && result.status === 'fulfilled') {
        state.adminVenues = Array.isArray(result.value.venues) ? result.value.venues : [];
        if (!state.adminVenues.length && state.venues.length) state.adminVenues = [...state.venues];
      } else {
        state.adminVenueLoadError = `탁구장 정보를 불러오지 못했습니다: ${result.reason?.message || '서버 오류'}`;
        setFlash(state.adminVenueLoadError, 'error');
      }
    }
    state.adminDataLoading = false;
    render();
  }

  async function openAdminPage() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') return;
    state.page = 'admin';
    state.selectedGameId = null;
    state.selectedPublicGameId = null;
    state.operationGameId = null;
    state.operationFormat = null;
    const savedAdminTab = readJson(STORAGE_KEYS.adminTab, 'users');
    state.adminTab = ['venues', 'access'].includes(savedAdminTab) ? savedAdminTab : 'users';
    state.adminAccess = [];
    state.adminAccessLoadError = '';
    state.adminAccessLoading = false;
    state.adminVenueImportRows = [];
    state.adminVenueImportMessage = '';
    state.adminVenueEditingId = null;
    await refreshAdminData();
    if (state.adminTab === 'access') await refreshAdminData('access');
  }

  async function handleAdminVenueUpdate(form) {
    const formData = Object.fromEntries(new FormData(form).entries());
    try {
      await apiRequest(`/api/admin/venues/${encodeURIComponent(form.dataset.venueId)}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      setFlash('탁구장 정보가 저장되었습니다.', 'success');
      await openAdminPage();
    } catch (error) {
      setFlash(error.message || '탁구장 정보 저장에 실패했습니다.', 'error');
      render();
    }
  }

  async function handleAdminVenueCreate(form) {
    const formData = Object.fromEntries(new FormData(form).entries());
    try {
      await apiRequest('/api/admin/venues', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setFlash('탁구장 정보가 등록되었습니다.', 'success');
      await openAdminPage();
    } catch (error) {
      setFlash(error.message || '탁구장 등록에 실패했습니다.', 'error');
      render();
    }
  }

  function parseVenueDelimitedText(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"' && text[index + 1] === '"' && quoted) {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        row.push(cell.trim());
        cell = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += character;
      }
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows.shift().map((header) => header.replace(/\s+/g, '').toLowerCase());
    const findColumn = (names) => headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
    const columns = {
      name: findColumn(['탁구장명', '탁구장', 'name']),
      address: findColumn(['주소', 'address']),
      phone: findColumn(['전화번호', '전화', 'phone']),
      region: findColumn(['지역', 'region']),
      mapUrl: findColumn(['지도링크', '지도', 'mapurl', 'url']),
    };
    return rows.map((values) => ({
      name: values[columns.name] || '',
      address: values[columns.address] || '',
      phone: columns.phone >= 0 ? values[columns.phone] || '' : '',
      region: columns.region >= 0 ? values[columns.region] || '' : '',
      mapUrl: columns.mapUrl >= 0 ? values[columns.mapUrl] || '' : '',
    })).filter((row) => row.name && row.address);
  }

  async function handleAdminVenueImportFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const delimiter = file.name.toLowerCase().endsWith('.tsv') || text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
    const rows = parseVenueDelimitedText(text, delimiter);
    state.adminVenueImportRows = rows;
    state.adminVenueImportMessage = rows.length ? '' : '헤더와 탁구장명·주소가 포함된 CSV 또는 TSV 파일을 선택해 주세요.';
    render();
  }

  async function handleAdminVenueBulkImport() {
    if (!state.adminVenueImportRows.length) return;
    try {
      const result = await apiRequest('/api/admin/venues/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ rows: state.adminVenueImportRows }),
      });
      state.adminVenueImportRows = [];
      state.adminVenueImportMessage = '';
      setFlash(`탁구장 ${result.imported}건을 일괄등록했습니다.`, 'success');
      await openAdminPage();
    } catch (error) {
      state.adminVenueImportMessage = error.message || '탁구장 일괄등록에 실패했습니다.';
      render();
    }
  }

  async function handleImportIncheonVenues() {
    try {
      const result = await apiRequest('/api/admin/venues/import-incheon', { method: 'POST', body: JSON.stringify({}) });
      setFlash(`인천 탁구장 ${result.imported}개를 승인대기 상태로 등록했습니다.`, 'success');
      await openAdminPage();
    } catch (error) {
      setFlash(error.message || '인천 탁구장 목록 등록에 실패했습니다.', 'error');
      render();
    }
  }

  async function handleImportBucheonVenues() {
    try {
      const result = await apiRequest('/api/admin/venues/import-bucheon', { method: 'POST', body: JSON.stringify({}) });
      setFlash(`부천 탁구장 ${result.imported}개를 승인대기 상태로 등록했습니다.`, 'success');
      await openAdminPage();
    } catch (error) {
      setFlash(error.message || '부천 탁구장 목록 등록에 실패했습니다.', 'error');
      render();
    }
  }

  async function handleAdminVenueBulkStatus() {
    const selectedInputs = [...document.querySelectorAll('[data-admin-venue-select]:checked')];
    const selected = selectedInputs.map((input) => input.value);
    const status = document.querySelector('[data-admin-venue-bulk-status]')?.value || '';
    if (!selected.length) {
      setFlash('상태를 변경할 탁구장을 선택해 주세요.', 'error');
      return;
    }
    const updates = selectedInputs.map((input) => ({
      id: input.value,
      status: input.closest('[data-form="admin-venue"]')?.querySelector('[name="status"]')?.value || '',
    }));
    try {
      const result = await apiRequest('/api/admin/venues/bulk-status', {
        method: 'PATCH',
        body: JSON.stringify({ ids: selected, status, updates }),
      });
      setFlash(`${result.updated}개 탁구장 상태를 변경했습니다.`, 'success');
      await openAdminPage();
    } catch (error) {
      setFlash(error.message || '탁구장 상태 변경에 실패했습니다.', 'error');
      render();
    }
  }

  function renderLockIcon(isLocked) {
    return `<svg class="top-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" class="top-action__shackle ${isLocked ? '' : 'is-open'}" /><rect x="5" y="10" width="14" height="10" rx="1.5" class="top-action__lock" /><circle cx="12" cy="15" r="1.3" class="top-action__keyhole" /></svg>`;
  }

  function renderUserIcon() {
    return '<svg class="top-action__user-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.8-4.1 3.1-6.2 7-6.2s6.2 2.1 7 6.2"></path></svg>';
  }

  function updateTopActions(currentUser) {
    const venueAction = '<button type="button" class="btn top-action" data-open-venues><svg class="top-action__user-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg><span>탁구장 찾기</span></button>';
    const fleaMarketAction = '<button type="button" class="btn top-action" data-coming-service><svg class="top-action__user-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14v12H5zM8 8a4 4 0 0 1 8 0" /><path d="M12 12v5M9.5 14.5h5" /></svg><span>탁구벼룩시장</span></button>';
    const shopAction = '<button type="button" class="btn top-action" data-coming-service><svg class="top-action__user-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14l-1 11H6zM8 9a4 4 0 0 1 8 0" /><path d="M9 13h6" /></svg><span>탁구용품 쇼핑몰</span></button>';
    const adminAction = currentUser?.role === 'admin'
      ? '<button type="button" class="btn top-action top-action--admin" data-open-admin><svg class="top-action__user-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.5" /><circle cx="12" cy="12" r="8" /></svg><span>시스템 관리</span></button>'
      : '';
    const themeAction = `<button type="button" class="btn top-action top-action--theme" data-theme-toggle><svg class="top-action__user-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg><span>${getTheme() === 'dark' ? '라이트 테마' : '다크 테마'}</span></button>`;
    const actions = currentUser
      ? `<button type="button" class="btn top-action" data-open-mypage>${renderUserIcon()}<span>Mypage</span></button><button type="button" class="btn top-action" data-logout>${renderUserIcon()}<span>로그아웃(${escapeHtml(currentUser.nickname)})</span></button>${venueAction}${adminAction}${themeAction}`
      : `<button type="button" class="btn top-action" data-open-auth="signup">${renderUserIcon()}<span>회원가입</span></button><button type="button" class="btn top-action" data-open-auth="login">${renderLockIcon(true)}<span>로그인</span></button>${venueAction}${adminAction}${themeAction}`;
    if (topActions) topActions.innerHTML = '';
    if (mobileMenuActions) mobileMenuActions.innerHTML = actions;
    if (serviceMenuActions) serviceMenuActions.innerHTML = venueAction + fleaMarketAction + shopAction;
    if (mobileMenuToggle) {
      mobileMenuToggle.classList.toggle('mobile-menu-toggle--authenticated', Boolean(currentUser));
      mobileMenuToggle.setAttribute('aria-label', currentUser ? '회원 메뉴 열기 (로그인됨)' : '회원 메뉴 열기');
    }
  }

  function setMobileMenuOpen(isOpen) {
    document.body.classList.toggle('mobile-menu-open', isOpen);
    mobileMenu?.setAttribute('aria-hidden', String(!isOpen));
    mobileMenuToggle?.setAttribute('aria-expanded', String(isOpen));
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function setServiceMenuOpen(isOpen) {
    document.body.classList.toggle('service-menu-open', isOpen);
    serviceMenu?.setAttribute('aria-hidden', String(!isOpen));
    serviceMenuToggle?.setAttribute('aria-expanded', String(isOpen));
  }

  function closeServiceMenu() {
    setServiceMenuOpen(false);
  }

  async function toggleProgressFullscreen() {
    const target = document.querySelector('.public-game-detail');
    if (!target) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else {
        setFlash('이 브라우저에서는 전체화면을 지원하지 않습니다.', 'error');
      }
    } catch (error) {
      setFlash(error.message || '전체화면 전환에 실패했습니다.', 'error');
    }
  }

  function updateProgressFullscreenButton() {
    const isFullscreen = Boolean(document.fullscreenElement);
    document.querySelectorAll('[data-progress-fullscreen-label]').forEach((label) => {
      label.textContent = isFullscreen ? '전체화면 해제' : '전체화면 전환';
    });
  }

  function shouldLiveRefresh() {
    if (state.detailTab !== 'progress' || state.operationGameId || !Boolean(state.selectedPublicGameId || state.selectedGameId)) return false;
    const liveGame = state.games.find((game) => game.id === (state.selectedPublicGameId || state.selectedGameId));
    const liveFormat = liveGame ? getPublicFormat(liveGame) : null;
    if (liveGame && liveFormat && getFormatStatus(liveGame, liveFormat).key === 'done') return false;
    if (state.progressSubtab === 'tournament' && liveGame) {
      const liveTournament = getTournamentConfig(liveGame, liveFormat);
      const liveLeague = liveTournament && ['upper', 'lower'].includes(state.progressTournamentLeague) && liveTournament[state.progressTournamentLeague]
        ? state.progressTournamentLeague
        : 'upper';
      if (liveTournament?.[liveLeague]?.completed) return false;
    }
    return true;
  }

  async function refreshLiveResults() {
    if (liveRefreshInFlight || !shouldLiveRefresh()) return;
    liveRefreshInFlight = true;
    const selectedGameId = state.selectedPublicGameId || state.selectedGameId;
    try {
      await loadState();
      if ((state.selectedPublicGameId || state.selectedGameId) === selectedGameId && shouldLiveRefresh()) render();
    } catch {
      // Keep the current result view when a periodic refresh temporarily fails.
    } finally {
      liveRefreshInFlight = false;
    }
  }

  function syncLiveRefresh() {
    if (!shouldLiveRefresh()) {
      if (liveRefreshTimer) window.clearInterval(liveRefreshTimer);
      liveRefreshTimer = null;
      return;
    }
    if (!liveRefreshTimer) liveRefreshTimer = window.setInterval(refreshLiveResults, 30000);
  }

  function fitTournamentBrackets() {
    document.querySelectorAll('[data-tournament-viewport]').forEach((viewport) => {
      const stage = viewport.querySelector('[data-tournament-stage]');
      if (!stage) return;
      stage.style.transform = 'none';
      stage.style.transformOrigin = 'top center';
      viewport.style.height = '';
      const availableWidth = viewport.clientWidth;
      const naturalWidth = Math.max(stage.scrollWidth, 1);
      if (!availableWidth) return;
      stage.style.width = `${naturalWidth}px`;
      const scale = Math.min(1, availableWidth / naturalWidth) * (state.tournamentZoom || 1);
      stage.style.transform = `scale(${scale})`;
      viewport.style.height = `${stage.scrollHeight * scale}px`;
    });
    document.querySelectorAll('[data-public-tournament-viewport]').forEach((viewport) => {
      const stage = viewport.querySelector('[data-tournament-stage]');
      if (!stage) return;
      const availableWidth = viewport.clientWidth;
      if (!availableWidth) return;
      stage.style.transformOrigin = 'top left';
      const naturalWidth = Math.max(stage.scrollWidth, 1);
      stage.style.width = `${naturalWidth}px`;
      const scale = Math.min(1, availableWidth / naturalWidth) * (state.tournamentZoom || 1);
      const visualWidth = naturalWidth * scale;
      const sideInset = Math.max(0, (availableWidth - visualWidth) / 2);
      stage.style.marginLeft = `${sideInset}px`;
      stage.style.marginRight = `${sideInset}px`;
      stage.style.transform = `scale(${scale})`;
      viewport.style.height = `${stage.scrollHeight * scale}px`;
    });
    document.querySelectorAll('[data-tournament-print-viewport]').forEach((viewport) => {
      const stage = viewport.querySelector('[data-tournament-print-stage]');
      if (!stage) return;
      stage.style.transform = 'none';
      viewport.style.height = '';
      const availableWidth = viewport.clientWidth;
      const naturalWidth = Math.max(stage.scrollWidth, 1);
      if (!availableWidth) return;
      stage.style.width = `${naturalWidth}px`;
      const scale = Math.min(1, availableWidth / naturalWidth) * (state.tournamentZoom || 1);
      stage.style.transform = `scale(${scale})`;
      viewport.style.height = `${stage.scrollHeight * scale}px`;
    });
    document.querySelectorAll('[data-public-league-viewport]').forEach((viewport) => {
      const stage = viewport.querySelector('[data-public-league-stage]');
      if (!stage) return;
      stage.style.transform = 'none';
      stage.style.transformOrigin = 'top left';
      viewport.style.height = '';
      const availableWidth = viewport.clientWidth;
      if (!availableWidth) {
        stage.style.transform = 'none';
        viewport.style.height = 'auto';
        return;
      }
      stage.style.width = `${Math.max(760, availableWidth)}px`;
      const naturalWidth = Math.max(stage.scrollWidth, 760);
      if (!stage.scrollHeight) {
        stage.style.transform = 'none';
        viewport.style.height = 'auto';
        return;
      }
      const scale = Math.min(1, availableWidth / naturalWidth) * (state.leagueResultsZoom || 1);
      stage.style.transform = `scale(${scale})`;
      viewport.style.height = `${stage.scrollHeight * scale}px`;
    });
    document.querySelectorAll('.schedule-panel--results .matrix-wrap').forEach((viewport) => {
      const table = viewport.querySelector('.schedule-matrix');
      if (!table) return;
      table.style.transform = 'none';
      viewport.style.height = '';
      const availableWidth = viewport.clientWidth;
      const naturalWidth = Math.max(table.scrollWidth, 1);
      if (!availableWidth || naturalWidth <= availableWidth) return;
      const scale = availableWidth / naturalWidth;
      table.style.transformOrigin = 'top left';
      table.style.transform = `scale(${scale})`;
      viewport.style.height = `${table.offsetHeight * scale}px`;
    });
  }

  function tournamentTouchDistance(touches) {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  function updateTournamentZoomControls() {
    const value = `${Math.round((state.tournamentZoom || 1) * 100)}%`;
    document.querySelectorAll('[data-tournament-zoom-value]').forEach((element) => {
      element.textContent = value;
    });
  }

  function handleTournamentTouchStart(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-tournament-viewport], [data-public-league-viewport]') : null;
    if (!target || event.touches.length < 2) return;
    tournamentPinchState = {
      distance: tournamentTouchDistance(event.touches),
      zoomKey: target.matches('[data-public-league-viewport]') ? 'leagueResultsZoom' : 'tournamentZoom',
      zoom: target.matches('[data-public-league-viewport]') ? (state.leagueResultsZoom || 1) : (state.tournamentZoom || 1),
    };
    event.preventDefault();
  }

  function handleTournamentTouchMove(event) {
    if (!tournamentPinchState || event.touches.length < 2) return;
    const distance = tournamentTouchDistance(event.touches);
    if (!distance || !tournamentPinchState.distance) return;
    const nextZoom = Math.max(0.7, tournamentPinchState.zoom * (distance / tournamentPinchState.distance));
    state[tournamentPinchState.zoomKey] = Math.round(nextZoom * 100) / 100;
    fitTournamentBrackets();
    updateTournamentZoomControls();
    event.preventDefault();
  }

  function handleTournamentTouchEnd(event) {
    if (event.touches.length < 2) tournamentPinchState = null;
  }

  function drawTournamentConnectors() {
    document.querySelectorAll('.tournament-bracket--split').forEach((bracket) => {
      const existingLayer = bracket.querySelector('.tournament-connector-layer');
      existingLayer?.remove();
      const rootRect = bracket.getBoundingClientRect();
      const rootWidth = bracket.offsetWidth;
      const rootHeight = bracket.offsetHeight;
      if (!rootWidth || !rootHeight) return;
      const scaleX = rootRect.width / rootWidth || 1;
      const scaleY = rootRect.height / rootHeight || 1;
      const point = (element, side = 'center') => {
        const rect = element.getBoundingClientRect();
        const left = (rect.left - rootRect.left) / scaleX;
        const right = (rect.right - rootRect.left) / scaleX;
        const top = (rect.top - rootRect.top) / scaleY;
        const bottom = (rect.bottom - rootRect.top) / scaleY;
        return { left, right, centerY: (top + bottom) / 2 };
      };
      const path = (svg, commands) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', commands);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', 'rgba(118, 240, 196, 0.55)');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        line.setAttribute('stroke-linecap', 'square');
        svg.appendChild(line);
      };
      const connectRoundPair = (svg, currentRound, nextRound, direction) => {
        const currentMatches = [...currentRound.querySelectorAll(':scope > .tournament-round__matches > .tournament-match')];
        const nextMatches = [...nextRound.querySelectorAll(':scope > .tournament-round__matches > .tournament-match')];
        currentMatches.forEach((match, index) => {
          const parent = nextMatches[Math.floor(index / 2)];
          if (!parent) return;
          const source = point(match);
          const target = point(parent);
          const sourceX = direction === 'left' ? source.right : source.left;
          const targetX = direction === 'left' ? target.left : target.right;
          const elbowX = sourceX + (targetX - sourceX) / 2;
          path(svg, `M ${sourceX} ${source.centerY} H ${elbowX} V ${target.centerY} H ${targetX}`);
        });
      };
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('tournament-connector-layer');
      svg.setAttribute('viewBox', `0 0 ${rootWidth} ${rootHeight}`);
      svg.setAttribute('width', String(rootWidth));
      svg.setAttribute('height', String(rootHeight));
      svg.setAttribute('aria-hidden', 'true');
      const sides = [
        { selector: '.tournament-side-bracket--left', direction: 'left' },
        { selector: '.tournament-side-bracket--right', direction: 'right' },
      ];
      sides.forEach(({ selector, direction }) => {
        const side = bracket.querySelector(selector);
        const rounds = side ? [...side.querySelectorAll(':scope > .tournament-round')] : [];
        rounds.slice(0, -1).forEach((round, index) => connectRoundPair(svg, round, rounds[index + 1], direction));
        const semifinal = rounds.at(-1)?.querySelector(':scope > .tournament-round__matches > .tournament-match');
        const finalMatch = bracket.querySelector('.tournament-center-bracket .tournament-round--final .tournament-match');
        if (!semifinal || !finalMatch) return;
        const source = point(semifinal);
        const target = point(finalMatch);
        const sourceX = direction === 'left' ? source.right : source.left;
        const targetX = direction === 'left' ? target.left : target.right;
        // Keep the final connector horizontal across responsive scale factors.
        path(svg, `M ${sourceX} ${source.centerY} H ${targetX}`);
      });
      bracket.prepend(svg);
    });
  }

  function render() {
    const currentUser = getCurrentUser();
    updateTopActions(currentUser);

    if (!app) return;

    const publicGame = state.games.find((game) => game.id === state.selectedPublicGameId);
    app.className = currentUser ? 'app app--dashboard' : state.page === 'auth' ? 'app app--auth' : 'app app--public';
    const showPublicHome = !currentUser && state.page === 'public' && !state.selectedGameId && !publicGame;
    const fullscreenTarget = document.fullscreenElement?.classList.contains('public-game-detail') ? document.fullscreenElement : null;
    const fullscreenGame = state.games.find((game) => game.id === (state.selectedPublicGameId || state.selectedGameId));
    if (fullscreenTarget && fullscreenGame) {
      const template = document.createElement('template');
      template.innerHTML = renderGameDetailView(fullscreenGame, currentUser);
      const nextSection = template.content.firstElementChild;
      if (nextSection) fullscreenTarget.replaceChildren(...Array.from(nextSection.childNodes));
    } else {
      app.innerHTML = `${renderFlash()}${state.signupCompleted ? renderSignupSuccess() : state.page === 'venues' ? renderVenueFinderPage(currentUser) : showPublicHome ? renderPublicGamesPage() : currentUser && state.page === 'mypage' ? renderMyPage(currentUser) : currentUser ? renderDashboard(currentUser) : state.page === 'auth' ? renderAuthPage() : publicGame ? renderPublicGameDetail(publicGame) : renderPublicGamesPage()}`;
    }
    updateProgressFullscreenButton();
    window.requestAnimationFrame(() => {
      fitTournamentBrackets();
      drawTournamentConnectors();
      window.requestAnimationFrame(fitTournamentBrackets);
      window.requestAnimationFrame(drawTournamentConnectors);
    });
    syncLiveRefresh();
    syncBrowserHistory();
  }

  async function goToHome(event) {
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
    await loadState();
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
    if (isRegistrationClosed(game, format)) {
      setFlash(`${FORMAT_LABELS[format]} 선수등록이 마감되었습니다.`, 'error');
      render();
      return;
    }

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
      Object.assign(existingRegistration, { nickname, memberId, rank, teamName, registrationSource: 'online', appliedAt: new Date().toISOString() });
    } else {
      game.registrations = [...registrations, { userId: currentUser.id, nickname, gender: currentUser.gender || '', memberId, rank, teamName, format, registrationSource: 'online', appliedAt: new Date().toISOString() }];
    }
    persistGames();
    setFlash(`${FORMAT_LABELS[format]} 참가신청 내용이 ${existingRegistration ? '수정' : '등록'}되었습니다.`, 'success');
    render();
  }

  async function handleOperatorRegistrationSubmit(form) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === form.dataset.gameId);
    const format = form.dataset.format;
    if (!currentUser || !game || game.operatorId !== currentUser.id || !format) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const nickname = trimValue(values.nickname);
    const gender = trimValue(values.gender);
    const rank = trimValue(values.rank);
    const teamName = trimValue(values.teamName);
    if (!nickname || !gender || !rank || (format !== 'singles' && !teamName)) {
      setFlash('이름, 성별, 부수와 경기형식에 필요한 팀명을 입력해 주세요. ID는 선택입니다.', 'error');
      render();
      return;
    }
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}/registrations/manual`, {
        method: 'POST',
        body: JSON.stringify({ format, ...values }),
      });
      await loadState();
      form.reset();
      setFlash(`${FORMAT_LABELS[format]} 개별 선수등록이 완료되었습니다.`, 'success');
    } catch (error) {
      setFlash(error.message || '개별 선수등록에 실패했습니다.', 'error');
    }
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
    const rosterFormat = input.dataset.rosterFormat || state.operationFormat;
    if (isRegistrationClosed(game, rosterFormat)) {
      setFlash(`${FORMAT_LABELS[rosterFormat]} 선수등록이 마감되었습니다.`, 'error');
      render();
      return;
    }
    const file = input.files?.[0];
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'csv', 'tsv', 'txt'].includes(extension)) {
      setFlash('엑셀(.xlsx), CSV 또는 TSV 파일을 업로드해 주세요.', 'error');
      render();
      return;
    }

    const formatSelect = document.querySelector(`[data-roster-format="${CSS.escape(game.id)}"]`);
    const format = formatSelect?.value || rosterFormat;
    const parsedRoster = extension === 'xlsx'
      ? await parseRosterXlsx(file)
      : parseRosterText(await file.text());
    if (parsedRoster.error) {
      setFlash(parsedRoster.error, 'error');
      render();
      return;
    }
    const rows = parsedRoster.rows;
    const registrations = getGameRegistrations(game);
    const formatRegistrations = getGameRegistrations(game, format);
    const existingKeys = new Set(formatRegistrations.map((participant) => participant.userId || `name:${normalizeParticipantName(participant.nickname)}`));
    const pendingRegistrations = [];
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
      const registration = {
        userId: matchedUser?.id || null,
        nickname: matchedUser?.nickname || row.nickname,
        gender: matchedUser?.gender || row.gender || '',
        memberId: row.memberId,
        rank: row.rank || matchedUser?.rank || '',
        teamName: row.teamName || '',
        format,
        appliedAt: new Date().toISOString(),
        registeredBy: currentUser.id,
        registrationSource: 'bulk',
      };
      registrations.push(registration);
      pendingRegistrations.push(registration);
      existingKeys.add(participantKey);
      added += 1;
    }
    if (pendingRegistrations.length) {
      try {
        await apiRequest(`/api/games/${encodeURIComponent(game.id)}/registrations/bulk`, {
          method: 'POST',
          body: JSON.stringify({ format, registrations: pendingRegistrations }),
        });
        await loadState();
        setFlash(`${added}명이 서버에 등록되었습니다. ${skipped}명은 중복, 빈 행 또는 정원 초과로 제외되었습니다.`, 'success');
        render();
        return;
      } catch (error) {
        if (!error.message.includes('Failed to fetch') && !error.message.includes('서버 요청')) {
          setFlash(error.message, 'error');
          render();
          return;
        }
      }
    }
    game.registrations = registrations;
    persistGames();
    setFlash(`${added}명이 이 브라우저에 임시 등록되었습니다. ${skipped}명은 중복, 빈 행 또는 정원 초과로 제외되었습니다.`, added ? 'info' : 'info');
    render();
  }

  function setGameFilter(filterName) {
    const allowedFilters = ['all', 'mine', 'open', 'progress', 'done'];
    state.gameFilter = allowedFilters.includes(filterName) ? filterName : 'all';
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
    state.operationGameId = null;
    state.operationFormat = null;
    state.selectedScheduleGroup = null;
    state.statusSubtab = state.detailTab === 'progress' ? 'progress' : 'info';
    render();
  }

  async function handleSignup(form) {
    const submittedData = new FormData(form);
    const formData = Object.fromEntries(submittedData.entries());
    const nickname = trimValue(formData.nickname);
    const memberId = trimValue(formData.memberId).toLowerCase();
    const password = trimValue(formData.password);
    const phone = formatPhoneNumber(formData.phone);
    const gender = trimValue(formData.gender);
    const regionSido = trimValue(formData.regionSido);
    const regionSigungu = trimValue(formData.regionSigungu);
    const region = regionLabel(regionSido, regionSigungu);
    const rank = trimValue(formData.rank);
    const memberIdKey = normalizeId(memberId);

    const missingFields = [
      !nickname ? '이름(닉네임)' : '',
      !memberId ? 'ID' : '',
      !password ? '비밀번호' : '',
      !gender ? '성별' : '',
      !rank ? '통합부수' : '',
      !phone ? '휴대폰번호' : '',
      !regionSido || !regionSigungu ? '활동지역' : '',
    ].filter(Boolean);
    if (missingFields.length) {
      setFlash(`회원가입 실패: ${missingFields.join(', ')} 항목을 입력해 주세요.`, 'error');
      render();
      return;
    }

    try {
      await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ nickname, memberId, password, phone, gender, rank, region, regionSido, regionSigungu }),
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
      regionSido,
      regionSigungu,
      rank,
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

  async function handleProfileUpdate(form) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const formData = Object.fromEntries(new FormData(form).entries());
    const nickname = trimValue(formData.nickname);
    const phone = trimValue(formData.phone);
    const gender = trimValue(formData.gender);
    const regionSido = trimValue(formData.regionSido);
    const regionSigungu = trimValue(formData.regionSigungu);
    const region = regionLabel(regionSido, regionSigungu);
    if (!nickname || !phone || !regionSido || !regionSigungu) {
      setFlash('닉네임, 휴대폰번호, 활동지역을 입력해 주세요.', 'error');
      render();
      return;
    }
    const profile = { nickname, phone, gender, region, regionSido, regionSigungu, rank: trimValue(formData.rank), address: trimValue(formData.address) };
    try {
      const result = await apiRequest('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(profile) });
      state.users = [result.user];
      state.sessionUserId = result.user.id;
    } catch (error) {
      if (!error.message.includes('Failed to fetch') && !error.message.includes('서버 요청')) {
        setFlash(`내 정보 수정 실패: ${error.message}`, 'error');
        render();
        return;
      }
      Object.assign(currentUser, { ...profile, updatedAt: new Date().toISOString() });
      persistUsers();
    }
    state.games.filter((game) => game.operatorId === currentUser.id).forEach((game) => {
      game.operatorNickname = currentUser.nickname;
    });
    persistGames();
    state.page = 'dashboard';
    setFlash('내 정보가 수정되었습니다.', 'success');
    render();
  }

  async function handleLeagueSeriesCreate(form) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const submittedData = new FormData(form);
    const defaultFormats = submittedData.getAll('defaultFormats').map(trimValue).filter(Boolean);
    const payload = {
      venueId: trimValue(submittedData.get('venueId')),
      name: trimValue(submittedData.get('name')),
      scheduleLabel: trimValue(submittedData.get('scheduleLabel')),
      description: trimValue(submittedData.get('description')),
      defaultMaxParticipants: trimValue(submittedData.get('defaultMaxParticipants')) || null,
      defaultFormats,
    };
    if (!payload.venueId || !payload.name || !defaultFormats.length) {
      setFlash('탁구장, 정기리그명, 기본 경기형식을 입력해 주세요.', 'error');
      render();
      return;
    }
    try {
      await apiRequest('/api/league-series', { method: 'POST', body: JSON.stringify(payload) });
      await loadState();
      setFlash('정기리그가 등록되었습니다. 이제 해당 리그에서 회차 경기를 생성할 수 있습니다.', 'success');
    } catch (error) {
      setFlash(error.message || '정기리그 등록에 실패했습니다.', 'error');
    }
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
    const venueName = trimValue(formData.venueName);
    const venueAddress = trimValue(formData.venueAddress);
    const venuePhone = trimValue(formData.venuePhone);
    const seriesId = trimValue(formData.seriesId);
    const selectedSeries = state.leagueSeries.find((series) => series.id === seriesId);
    const location = venueName && venueAddress ? `${venueName} · ${venueAddress}` : venueName;
    const formats = submittedData.getAll('formats').map(trimValue);
    const formatModes = Object.fromEntries(formats.map((format) => [format, submittedData.get(`formatMode_${format}`) === 'leagueOnly' ? 'leagueOnly' : 'leagueTournament']));
    const scheduledAt = trimValue(formData.scheduledAt);
    const note = trimValue(formData.note);
    const maxParticipants = Number.parseInt(trimValue(formData.maxParticipants), 10);

    if (!title || !venueName || !venueAddress || !formats.length || !scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < 1) {
      setFlash('게임 생성에 필요한 항목과 경기형식을 하나 이상 선택해 주세요.', 'error');
      render();
      return;
    }

    if (formats.some((format) => !Object.prototype.hasOwnProperty.call(FORMAT_LABELS, format))) {
      setFlash('경기형식을 개인전, 복식, 단체전 중에서 선택해 주세요.', 'error');
      render();
      return;
    }

    rememberVenue(location);

    try {
      await apiRequest('/api/games', {
        method: 'POST',
        body: JSON.stringify({ title, location, venueName, venueAddress, venuePhone, seriesId: seriesId || null, formats, formatModes, scheduledAt, maxParticipants, note }),
      });
      await loadState();
      form.reset();
      state.showCreateGame = false;
      state.selectedSeriesId = null;
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
      venueName,
      venueAddress,
      venuePhone,
      seriesId: seriesId || null,
      seriesName: selectedSeries?.name || '',
      seriesScheduleLabel: selectedSeries?.scheduleLabel || '',
      formats,
      formatModes,
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
    state.selectedSeriesId = null;
    setFlash('새 게임이 생성되었습니다. 생성한 회원이 해당 게임의 운영자입니다.', 'success');
    render();
  }

  async function handleGameUpdate(form) {
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
    const venueName = trimValue(formData.venueName);
    const venueAddress = trimValue(formData.venueAddress);
    const venuePhone = trimValue(formData.venuePhone);
    const seriesId = trimValue(formData.seriesId);
    const selectedSeries = state.leagueSeries.find((series) => series.id === seriesId);
    const location = venueName && venueAddress ? `${venueName} · ${venueAddress}` : venueName;
    const formats = submittedData.getAll('formats').map(trimValue);
    const formatModes = Object.fromEntries(formats.map((format) => [format, submittedData.get(`formatMode_${format}`) === 'leagueOnly' ? 'leagueOnly' : 'leagueTournament']));
    const scheduledAt = trimValue(formData.scheduledAt);
    const note = trimValue(formData.note);
    const maxParticipants = Number.parseInt(trimValue(formData.maxParticipants), 10);
    const participantCount = getGameParticipants(game).length;

    if (!title || !venueName || !venueAddress || !formats.length || !scheduledAt || !Number.isInteger(maxParticipants) || maxParticipants < participantCount) {
      setFlash(`필수 항목과 경기형식을 입력하고 최대참가인원을 현재 참가자 수(${participantCount}명) 이상으로 설정해 주세요.`, 'error');
      render();
      return;
    }
    if (formats.some((format) => !Object.prototype.hasOwnProperty.call(FORMAT_LABELS, format))) {
      setFlash('경기형식을 개인전, 복식, 단체전 중에서 선택해 주세요.', 'error');
      render();
      return;
    }

    rememberVenue(location);

    try {
      const savedPayload = await apiRequest(`/api/games/${encodeURIComponent(game.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, location, venueName, venueAddress, venuePhone, seriesId: seriesId || null, seriesRound: game.seriesRound || null, formats, formatModes, scheduledAt, maxParticipants, note }),
      });
      const savedFormats = savedPayload.game?.formats;
      if (!Array.isArray(savedFormats) || savedFormats.length !== formats.length || formats.some((format) => !savedFormats.includes(format))) {
        throw new Error('서버에 경기방식이 모두 저장되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      }
      await loadState();
      state.editingGameId = null;
      state.selectedGameId = game.id;
      setFlash('게임 정보가 서버에 저장되었습니다.', 'success');
      render();
      return;
    } catch (error) {
      if (!error.message.includes('Failed to fetch') && !error.message.includes('서버 요청')) {
        setFlash(error.message, 'error');
        render();
        return;
      }
    }

    Object.assign(game, { title, location, venueName, venueAddress, venuePhone, seriesId: seriesId || null, seriesName: selectedSeries?.name || '', seriesScheduleLabel: selectedSeries?.scheduleLabel || '', seriesRound: game.seriesRound || null, formats, formatModes, format: formats[0], scheduledAt, maxParticipants, note });
    persistGames();
    state.editingGameId = null;
    state.selectedGameId = game.id;
    setFlash('서버 연결이 없어 이 브라우저에만 임시 저장되었습니다.', 'info');
    render();
  }

  async function handleGameDelete(gameId) {
    const currentUser = getCurrentUser();
    const game = state.games.find((item) => item.id === gameId);
    if (!currentUser || !game) return;
    const isAdmin = currentUser.role === 'admin';
    const isOwner = game.operatorId === currentUser.id;
    if (!isAdmin && !isOwner) return;
    if (!isAdmin && getGameFormats(game).some((format) => isRegistrationClosed(game, format))) {
      setFlash('선수등록 마감 후에는 게임을 삭제할 수 없습니다.', 'error');
      render();
      return;
    }
    if (!window.confirm(`'${game.title}' 게임을 삭제하시겠습니까? 삭제 후 일반 게임목록에서 보이지 않습니다.`)) return;
    try {
      await apiRequest(`/api/games/${encodeURIComponent(game.id)}`, { method: 'DELETE' });
      await loadState();
      state.selectedGameId = null;
      state.selectedPublicGameId = null;
      state.operationGameId = null;
      setFlash('게임이 삭제되었습니다.', 'success');
      render();
    } catch (error) {
      setFlash(error.message || '게임 삭제에 실패했습니다.', 'error');
      render();
    }
  }

  async function handleAppClick(event) {
    const themeToggle = event.target.closest('[data-theme-toggle]');
    if (themeToggle) {
      applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
      updateTopActions(getCurrentUser());
      return;
    }

    const fullscreenButton = event.target.closest('[data-progress-fullscreen]');
    if (fullscreenButton) {
      await toggleProgressFullscreen();
      return;
    }

    const groupTarget = event.target.closest('[data-group-target]');
    if (groupTarget && selectedGroupPlayer) {
      moveDraggedGroupPlayer(selectedGroupPlayer.playerKey, selectedGroupPlayer.format, groupTarget.dataset.groupTarget);
      return;
    }

    const groupHeading = event.target.closest('.qualifying-group__heading');
    const targetGroup = groupHeading?.closest('[data-group-name]');
    if (targetGroup && selectedGroupPlayer) {
      moveDraggedGroupPlayer(selectedGroupPlayer.playerKey, selectedGroupPlayer.format, targetGroup.dataset.groupName);
      return;
    }

    const groupPlayer = event.target.closest('[data-group-player]');
    if (groupPlayer) {
      selectGroupPlayer(groupPlayer.dataset.groupPlayer, groupPlayer.dataset.groupFormat);
      return;
    }

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

    const adminButton = event.target.closest('[data-open-admin]');
    if (adminButton) {
      await openAdminPage();
      closeMobileMenu();
      return;
    }

    const openVenuesButton = event.target.closest('[data-open-venues]');
    if (openVenuesButton) {
      const user = getCurrentUser();
      state.page = 'venues';
      state.selectedGameId = null;
      state.selectedPublicGameId = null;
      state.operationGameId = null;
      state.venueSearch = '';
      state.venueRegionFilter = user?.region ? 'activity' : 'all';
      render();
      closeMobileMenu();
      return;
    }

    const comingServiceButton = event.target.closest('[data-coming-service]');
    if (comingServiceButton) {
      setFlash('해당 부가서비스는 준비 중입니다.', 'info');
      closeServiceMenu();
      return;
    }

    const adminTabButton = event.target.closest('[data-admin-tab]');
    if (adminTabButton) {
      state.adminTab = ['venues', 'access'].includes(adminTabButton.dataset.adminTab) ? adminTabButton.dataset.adminTab : 'users';
      writeJson(STORAGE_KEYS.adminTab, state.adminTab);
      render();
      if (state.adminTab === 'access') await refreshAdminData('access');
      return;
    }

    const adminVenueTabButton = event.target.closest('[data-admin-venue-tab-button]');
    if (adminVenueTabButton) {
      state.adminVenueTab = ['register', 'view', 'edit'].includes(adminVenueTabButton.dataset.adminVenueTabButton)
        ? adminVenueTabButton.dataset.adminVenueTabButton
        : 'register';
      state.adminVenueEditingId = null;
      render();
      return;
    }

    const adminVenueEditButton = event.target.closest('[data-admin-venue-edit]');
    if (adminVenueEditButton) {
      state.adminVenueEditingId = adminVenueEditButton.dataset.adminVenueEdit || null;
      render();
      return;
    }

    const adminVenueEditCancelButton = event.target.closest('[data-admin-venue-edit-cancel]');
    if (adminVenueEditCancelButton) {
      state.adminVenueEditingId = null;
      render();
      return;
    }

    const adminRefreshButton = event.target.closest('[data-admin-refresh]');
    if (adminRefreshButton) {
      await refreshAdminData(adminRefreshButton.dataset.adminRefresh || 'all');
      return;
    }

    const adminVenueImportButton = event.target.closest('[data-admin-venue-import-submit]');
    if (adminVenueImportButton) {
      await handleAdminVenueBulkImport();
      return;
    }

    const importIncheonButton = event.target.closest('[data-import-incheon]');
    if (importIncheonButton) {
      await handleImportIncheonVenues();
      return;
    }

    const importBucheonButton = event.target.closest('[data-import-bucheon]');
    if (importBucheonButton) {
      await handleImportBucheonVenues();
      return;
    }

    const bulkVenueSaveButton = event.target.closest('[data-admin-venue-bulk-save]');
    if (bulkVenueSaveButton) {
      await handleAdminVenueBulkStatus();
      return;
    }

    const selectAllVenues = event.target.closest('[data-admin-venue-select-all]');
    if (selectAllVenues) {
      document.querySelectorAll('[data-admin-venue-select]').forEach((input) => { input.checked = selectAllVenues.checked; });
      return;
    }

    const operationsButton = event.target.closest('[data-open-operations]');
    if (operationsButton) {
      openOperations(operationsButton.dataset.openOperations || null, operationsButton.dataset.operationMenu || null);
      return;
    }

    const showCreateGameButton = event.target.closest('[data-show-create-game]');
    if (showCreateGameButton) {
      state.showCreateGame = true;
      state.showLeagueSeries = false;
      state.selectedSeriesId = null;
      state.selectedGameId = null;
      render();
      return;
    }

    const showLeagueSeriesButton = event.target.closest('[data-show-league-series]');
    if (showLeagueSeriesButton) {
      state.showLeagueSeries = true;
      state.showCreateGame = false;
      state.selectedGameId = null;
      render();
      return;
    }

    const seriesCreateGameButton = event.target.closest('[data-series-create-game]');
    if (seriesCreateGameButton) {
      state.showLeagueSeries = false;
      state.showCreateGame = true;
      state.selectedSeriesId = seriesCreateGameButton.dataset.seriesCreateGame || null;
      state.selectedGameId = null;
      render();
      return;
    }

    const cancelCreateGameButton = event.target.closest('[data-cancel-create-game]');
    if (cancelCreateGameButton) {
      state.showCreateGame = false;
      state.selectedSeriesId = null;
      render();
      return;
    }

    const backDashboardButton = event.target.closest('[data-back-dashboard]');
    if (backDashboardButton) {
      state.page = 'dashboard';
      state.showLeagueSeries = false;
      state.showCreateGame = false;
      state.selectedSeriesId = null;
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

    const closeRegistrationButton = event.target.closest('[data-close-registration]');
    if (closeRegistrationButton) {
      const currentUser = getCurrentUser();
      const game = state.games.find((item) => item.id === closeRegistrationButton.dataset.closeRegistration);
      const format = closeRegistrationButton.dataset.closeRegistrationFormat;
      const isAdmin = currentUser?.role === 'admin';
      const isOwner = currentUser && game && game.operatorId === currentUser.id;
      if (!currentUser || !game || (!isAdmin && !isOwner) || !format) return;
      const reopening = isRegistrationClosed(game, format);
      const hasCompetitionData = Boolean(
        game.qualifyingGroups?.[format]?.groups?.length
        || game.preliminaryMatches?.[format]?.matches?.length
        || game.tournaments?.[format]
      );
      let resetCompetition = false;
      if (reopening) {
        const message = hasCompetitionData
          ? `${FORMAT_LABELS[format]} 선수등록 마감을 취소하면 이미 생성된 조편성·대진표·경기결과가 초기화됩니다. 참가선수 명부는 유지됩니다. 계속하시겠습니까?`
          : `${FORMAT_LABELS[format]} 선수등록 마감을 취소하시겠습니까? 참가선수 정보를 다시 수정할 수 있습니다.`;
        if (!window.confirm(message)) return;
        resetCompetition = hasCompetitionData;
      } else if (!window.confirm(`${FORMAT_LABELS[format]} 선수등록을 마감하시겠습니까? 마감 후에는 참가선수 정보를 수정할 수 없습니다.`)) {
        return;
      }
      try {
        await apiRequest(`/api/games/${encodeURIComponent(game.id)}/registrations/close`, {
          method: 'PATCH',
          body: JSON.stringify({ format, closed: !reopening, resetCompetition }),
        });
        await loadState();
        const updatedGame = state.games.find((item) => item.id === game.id);
        if (!reopening) {
          const allFormatsClosed = getGameFormats(updatedGame).every((item) => isRegistrationClosed(updatedGame, item));
          state.operationMenu = allFormatsClosed ? 'groups' : 'roster';
          setFlash(`${FORMAT_LABELS[format]} 선수등록이 마감되었습니다.${allFormatsClosed ? ' 이제 조편성을 진행해 주세요.' : ''}`, 'success');
        } else {
          state.operationMenu = 'roster';
          setFlash(`${FORMAT_LABELS[format]} 선수등록 마감이 취소되었습니다.${resetCompetition ? ' 기존 조편성·대진표는 초기화되었습니다.' : ''}`, 'success');
        }
      } catch (error) {
        setFlash(error.message || (reopening ? '선수등록 마감 취소에 실패했습니다.' : '선수등록 마감에 실패했습니다.'), 'error');
      }
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

    const decideTournamentButton = event.target.closest('[data-decide-tournament]');
    if (decideTournamentButton) {
      handleDecideTournamentQualification();
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

    const printAllSchedulesButton = event.target.closest('[data-print-all-schedules]');
    if (printAllSchedulesButton) {
      handlePrintAllSchedules();
      return;
    }

    const printTournamentButton = event.target.closest('[data-print-tournament]');
    if (printTournamentButton) {
      handlePrintTournament(printTournamentButton);
      return;
    }

    const saveGroupsButton = event.target.closest('[data-save-groups]');
    if (saveGroupsButton) {
      handleSaveGroups();
      return;
    }

    const toggleGroupVisibilityButton = event.target.closest('[data-toggle-group-visibility]');
    if (toggleGroupVisibilityButton) {
      handleToggleGroupVisibility();
      return;
    }

    const editRegistrationButton = event.target.closest('[data-edit-registration]');
    if (editRegistrationButton) {
      state.editingRegistrationId = editRegistrationButton.dataset.editRegistration;
      render();
      return;
    }

    const cancelRegistrationButton = event.target.closest('[data-cancel-registration]');
    if (cancelRegistrationButton) {
      state.editingRegistrationId = null;
      render();
      return;
    }

    const saveRegistrationButton = event.target.closest('[data-save-registration]');
    if (saveRegistrationButton) {
      handleSaveRegistration(saveRegistrationButton.dataset.saveRegistration);
      return;
    }

    const deleteRegistrationButton = event.target.closest('[data-delete-registration]');
    if (deleteRegistrationButton) {
      handleDeleteRegistration(deleteRegistrationButton.dataset.deleteRegistration);
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

    const leagueResultsZoomButton = event.target.closest('[data-league-results-zoom]');
    if (leagueResultsZoomButton) {
      const action = leagueResultsZoomButton.dataset.leagueResultsZoom;
      const currentZoom = state.leagueResultsZoom || 1;
      state.leagueResultsZoom = action === 'reset'
        ? getLeagueBaseZoom()
        : Math.max(0.7, currentZoom + (action === 'in' ? 0.1 : -0.1));
      render();
      return;
    }

    const tournamentZoomButton = event.target.closest('[data-tournament-zoom]');
    if (tournamentZoomButton) {
      const action = tournamentZoomButton.dataset.tournamentZoom;
      const currentZoom = state.tournamentZoom || 1;
      state.tournamentZoom = action === 'reset'
        ? getTournamentBaseZoom()
        : Math.max(0.7, currentZoom + (action === 'in' ? 0.1 : -0.1));
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

    const tournamentProgressLeagueButton = event.target.closest('[data-tournament-progress-league]');
    if (tournamentProgressLeagueButton) {
      state.progressTournamentLeague = tournamentProgressLeagueButton.dataset.tournamentProgressLeague;
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

    const deleteGameButton = event.target.closest('[data-delete-game]');
    if (deleteGameButton) {
      handleGameDelete(deleteGameButton.dataset.deleteGame);
      return;
    }

    const backGamesButton = event.target.closest('[data-back-games]');
    if (backGamesButton) {
      state.selectedGameId = null;
      state.operationGameId = null;
      state.operationFormat = null;
      state.detailTab = 'status';
      state.statusSubtab = 'info';
      render();
      return;
    }

    const publicBackButton = event.target.closest('[data-public-back]');
    if (publicBackButton) {
      state.selectedPublicGameId = null;
      state.operationGameId = null;
      state.operationFormat = null;
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
      return;
    }

    const deleteAccountButton = event.target.closest('[data-delete-account]');
    if (deleteAccountButton) {
      if (!window.confirm('회원탈퇴를 진행할까요? 탈퇴 후에는 회원정보를 복구할 수 없습니다.')) return;
      try {
        await apiRequest('/api/auth/account', { method: 'DELETE' });
        state.sessionUserId = null;
        state.page = 'public';
        persistSession();
        setFlash('회원탈퇴가 완료되었습니다.', 'info');
        render();
      } catch (error) {
        setFlash(error.message || '회원탈퇴에 실패했습니다.', 'error');
      }
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
      await handleProfileUpdate(form);
      return;
    }

    if (form.dataset.form === 'league-series') {
      await handleLeagueSeriesCreate(form);
      return;
    }

    if (form.dataset.form === 'admin-venue-search') {
      state.adminVenueSearch = trimValue(new FormData(form).get('search') || document.querySelector('[data-admin-venue-search]')?.value);
      state.adminVenueEditingId = null;
      render();
      return;
    }

    if (form.dataset.form === 'admin-venue') {
      await handleAdminVenueUpdate(form);
      return;
    }

    if (form.dataset.form === 'admin-venue-create') {
      await handleAdminVenueCreate(form);
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

    if (form.dataset.form === 'operator-registration') {
      await handleOperatorRegistrationSubmit(form);
      return;
    }

    if (form.dataset.form === 'game-edit') {
      await handleGameUpdate(form);
    }
  }

  async function handleAppChange(event) {
    const input = event.target;
    if (input.matches('[data-admin-venue-import-file]')) {
      await handleAdminVenueImportFile(input);
      return;
    }
    if (input.matches('[data-admin-venue-sido]')) {
      state.adminVenueSido = input.value || '';
      state.adminVenueSigungu = '';
      render();
      return;
    }
    if (input.matches('[data-admin-venue-sigungu]')) {
      state.adminVenueSigungu = input.value || '';
      render();
      return;
    }
    if (input.matches('[data-region-sido]')) {
      const form = input.closest('form');
      const sigunguInput = form?.querySelector('[data-region-sigungu]');
      const regionInput = form?.querySelector('input[name="region"]');
      const options = REGION_HIERARCHY[input.value] || [];
      if (sigunguInput) {
        sigunguInput.innerHTML = `<option value="">시·군·구 선택</option>${options.map((sigungu) => `<option value="${escapeHtml(sigungu)}">${escapeHtml(sigungu)}</option>`).join('')}`;
        sigunguInput.disabled = !input.value;
        sigunguInput.value = '';
      }
      if (regionInput) regionInput.value = '';
      return;
    }
    if (input.matches('[data-region-sigungu]')) {
      const form = input.closest('form');
      const sidoInput = form?.querySelector('[data-region-sido]');
      const regionInput = form?.querySelector('input[name="region"]');
      if (regionInput) regionInput.value = regionLabel(sidoInput?.value, input.value);
      return;
    }
    if (input.matches('[data-venue-region-filter]')) {
      state.venueRegionFilter = input.value || 'all';
      render();
      return;
    }
    if (input.matches('[data-tournament-score], [data-tournament-winner]')) {
      await handleTournamentMatchChange(input.dataset.tournamentScore || input.dataset.tournamentWinner);
      return;
    }
    if (input.matches('[data-match-winner]')) {
      queueScheduleResultsSave();
      return;
    }
    if (input.matches('[data-match-score]')) {
      queueScheduleResultsSave();
      return;
    }
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
      state.operationSubmenu = 'qualifying';
      render();
      return;
    }
    if (input.matches('[data-tournament-league]')) {
      state.operationTournamentLeague = input.value;
      render();
      return;
    }
    if (input.matches('[data-tournament-generate-league]')) {
      state.tournamentGenerateLeague = input.value === 'lower' ? 'lower' : 'upper';
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

  function handleAppInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.matches('[data-match-score], [data-tournament-score]')) {
      const digits = input.value.replace(/\D/g, '').slice(0, 2);
      input.value = digits.length > 1 ? `${digits[0]}:${digits[1]}` : digits;
      if (input.matches('[data-match-score]')) {
        syncScheduleWinnerFromScore(input);
        queueScheduleResultsSave();
      } else if (input.matches('[data-tournament-score]')) {
        syncTournamentWinnerFromScore(input);
      }
      return;
    }
    if (input.matches('[data-venue-search]')) {
      state.venueSearch = input.value;
      if (event.isComposing || input.dataset.composing) return;
      scheduleSearchRender('[data-venue-search]');
      return;
    }
    if (input.matches('[data-admin-venue-search], [data-admin-venue-view-search]')) {
      state.adminVenueSearch = input.value;
      return;
    }
    if (input.id === 'signupPhone') {
      const formatted = formatPhoneNumber(input.value);
      if (input.value !== formatted) input.value = formatted;
      return;
    }
    if (input.matches('[data-manual-member-id], [data-manual-nickname]')) {
      const key = input.matches('[data-manual-member-id]')
        ? normalizeId(input.value)
        : normalizeParticipantName(input.value);
      const member = [...state.users, ...state.adminUsers].find((user) => (input.matches('[data-manual-member-id]')
        ? user.memberIdKey === key
        : normalizeParticipantName(user.nickname) === key));
      if (member) {
        const form = input.closest('form');
        const nicknameInput = form?.querySelector('[data-manual-nickname]');
        const memberIdInput = form?.querySelector('[data-manual-member-id]');
        const genderInput = form?.querySelector('[data-manual-gender]');
        const rankInput = form?.querySelector('[data-manual-rank]');
        if (nicknameInput && input !== nicknameInput) nicknameInput.value = member.nickname || '';
        if (memberIdInput && input !== memberIdInput) memberIdInput.value = member.memberId || '';
        if (genderInput) genderInput.value = member.gender || '';
        if (rankInput) rankInput.value = member.rank || '';
      }
      return;
    }
    if (input.matches('[data-venue-name]')) {
      const venue = findVenueByName(input.value);
      const addressInput = document.getElementById(input.dataset.venueAddressTarget);
      const phoneInput = document.getElementById(input.dataset.venuePhoneTarget);
      if (venue && addressInput) addressInput.value = venue.address;
      if (venue && phoneInput) phoneInput.value = venue.phone || '';
    }
  }

  function handleCompositionStart(event) {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.matches('[data-admin-venue-search], [data-admin-venue-view-search], [data-venue-search]')) {
      window.clearTimeout(searchRenderTimer);
      input.dataset.composing = 'true';
    }
  }

  function handleCompositionEnd(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-admin-venue-search], [data-admin-venue-view-search], [data-venue-search]')) return;
    window.clearTimeout(searchRenderTimer);
    window.setTimeout(() => {
      delete input.dataset.composing;
      if (input.matches('[data-admin-venue-search], [data-admin-venue-view-search]')) {
        state.adminVenueSearch = input.value;
        return;
      }
      if (input.matches('[data-venue-search]')) state.venueSearch = input.value;
      render();
      const searchInput = document.querySelector(input.matches('[data-admin-venue-search]') ? '[data-admin-venue-search]' : input.matches('[data-admin-venue-view-search]') ? '[data-admin-venue-view-search]' : '[data-venue-search]');
      if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
    }, 0);
  }

  function scheduleSearchRender(selector) {
    window.clearTimeout(searchRenderTimer);
    searchRenderTimer = window.setTimeout(() => {
      render();
      const searchInput = document.querySelector(selector);
      if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
    }, 220);
  }

  function moveDraggedGroupPlayer(playerKey, format, targetGroupName) {
    const game = state.games.find((item) => item.id === state.operationGameId);
    const setup = game?.qualifyingGroups?.[format];
    if (!game || !setup || !targetGroupName) return;
    const sourceGroup = setup.groups.find((group) => group.players.some((player) => player.playerKey === playerKey));
    const targetGroup = setup.groups.find((group) => group.name === targetGroupName);
    if (!sourceGroup || !targetGroup || sourceGroup === targetGroup) return;
    const playerIndex = sourceGroup.players.findIndex((player) => player.playerKey === playerKey);
    const [player] = sourceGroup.players.splice(playerIndex, 1);
    targetGroup.players.push(player);
    selectedGroupPlayer = null;
    if (game.preliminaryMatches) delete game.preliminaryMatches[format];
    persistGames();
    setFlash(`${targetGroup.name}으로 이동했습니다. 저장 버튼을 눌러 반영해 주세요.`, 'info');
    render();
  }

  function updateGroupSelectionUi() {
    const selected = selectedGroupPlayer;
    const game = state.games.find((item) => item.id === state.operationGameId);
    const setup = selected ? game?.qualifyingGroups?.[selected.format] : null;
    const selectedGroupName = setup?.groups.find((group) => group.players.some((player) => player.playerKey === selected.playerKey))?.name;
    document.querySelectorAll('[data-group-player]').forEach((row) => {
      row.classList.toggle('is-selected', Boolean(selected && row.dataset.groupPlayer === selected.playerKey && row.dataset.groupFormat === selected.format));
    });
    document.querySelectorAll('.qualifying-group__heading').forEach((heading) => {
      const group = heading.closest('[data-group-name]');
      const matchesFormat = Boolean(selected && group?.dataset.groupFormat === selected.format);
      heading.classList.toggle('is-move-target', matchesFormat && group?.dataset.groupName !== selectedGroupName);
    });
  }

  function selectGroupPlayer(playerKey, format) {
    selectedGroupPlayer = selectedGroupPlayer?.playerKey === playerKey && selectedGroupPlayer?.format === format
      ? null
      : { playerKey, format };
    updateGroupSelectionUi();
  }

  async function handleStorageChange() {
    await loadState();
    render();
  }

  function wireEvents() {
    brand?.addEventListener('click', (event) => { void goToHome(event); });
    brandName?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void goToHome(event);
    });
    app.addEventListener('click', handleAppClick);
    topActions?.addEventListener('click', handleAppClick);
    mobileMenuActions?.addEventListener('click', async (event) => {
      await handleAppClick(event);
      closeMobileMenu();
    });
    mobileMenuToggle?.addEventListener('click', () => { closeServiceMenu(); setMobileMenuOpen(true); });
    serviceMenuActions?.addEventListener('click', async (event) => {
      await handleAppClick(event);
      closeServiceMenu();
    });
    serviceMenuToggle?.addEventListener('click', () => { closeMobileMenu(); setServiceMenuOpen(true); });
    document.querySelectorAll('[data-mobile-menu-close]').forEach((element) => element.addEventListener('click', closeMobileMenu));
    document.querySelectorAll('[data-service-menu-close]').forEach((element) => element.addEventListener('click', closeServiceMenu));
    app.addEventListener('submit', handleAppSubmit);
    app.addEventListener('change', handleAppChange);
    app.addEventListener('input', handleAppInput);
    app.addEventListener('compositionstart', handleCompositionStart);
    app.addEventListener('compositionend', handleCompositionEnd);
    app.addEventListener('touchstart', handleTournamentTouchStart, { passive: false });
    app.addEventListener('touchmove', handleTournamentTouchMove, { passive: false });
    app.addEventListener('touchend', handleTournamentTouchEnd, { passive: true });
    app.addEventListener('touchcancel', handleTournamentTouchEnd, { passive: true });
    document.addEventListener('fullscreenchange', updateProgressFullscreenButton);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('resize', () => {
      fitTournamentBrackets();
      window.requestAnimationFrame(drawTournamentConnectors);
    });
    window.addEventListener('popstate', handleBrowserPopState);
  }

  async function init() {
    applyTheme(getTheme(), false);
    await loadState();
    const savedRoute = readSessionJson(BROWSER_ROUTE_KEY, null);
    if (savedRoute) {
      restoreBrowserRoute(savedRoute);
      if (state.page === 'admin' && getCurrentUser()?.role === 'admin') {
        await refreshAdminData();
        if (state.adminTab === 'access') await refreshAdminData('access');
      }
    }
    wireEvents();
    startAccessHeartbeat();
    render();
  }

  init();
})();
