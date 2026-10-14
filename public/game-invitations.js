/* Shared, side-effect-free helpers for game creation and invitations. */
(function (root, factory) {
  const helpers = factory();
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  else root.GameInvitations = helpers;
})(typeof window === 'object' ? window : this, function () {
  function localDateTime(date) {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  function makeDraft({ source = null, series = null, venue = null } = {}) {
    const formats = source?.formats || (source?.format ? [source.format] : null) || series?.defaultFormats || ['singles'];
    return {
      title: '', scheduledAt: '',
      venueName: source?.venueName || source?.location || venue?.name || '',
      venueAddress: source?.venueAddress || venue?.address || '',
      venuePhone: source?.venuePhone || venue?.phone || '',
      formats: formats.length ? [...formats] : ['singles'],
      formatModes: { ...(source?.formatModes || series?.defaultFormatModes || {}) },
      maxParticipants: source?.maxParticipants || series?.defaultMaxParticipants || 16,
      note: source?.note || '', seriesId: series?.id || '',
      sourceGameId: source?.id || '', reuseRoster: false,
    };
  }
  function inviteUrl(href, gameId) {
    const url = new URL('/', href);
    url.searchParams.set('game', gameId);
    return url.href;
  }
  function routeUrl(href, route) {
    const url = new URL(href);
    const gameId = route.inviteGameId || route.selectedPublicGameId || route.selectedGameId || route.pendingGameId;
    if (gameId) url.searchParams.set('game', gameId);
    else url.searchParams.delete('game');
    if (route.pendingGameId) url.searchParams.set('join', '1');
    else url.searchParams.delete('join');
    return url.href;
  }
  function suggestedTitle(draft, seriesName = '') {
    if (!draft.scheduledAt) return '';
    const date = new Date(draft.scheduledAt);
    return `${date.getMonth() + 1}월 ${date.getDate()}일 ${seriesName || draft.venueName || '함께하는 탁구'}${seriesName ? '' : ' 게임'}`;
  }
  return { localDateTime, makeDraft, inviteUrl, routeUrl, suggestedTitle };
});
