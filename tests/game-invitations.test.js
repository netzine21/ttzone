const assert = require('node:assert/strict');
const test = require('node:test');
const { makeDraft, inviteUrl, routeUrl, suggestedTitle, localDateTime } = require('../public/game-invitations');

test('copy retains only editable settings and starts a fresh independent game', () => {
  const source = { id: 'old', title: '지난 경기', scheduledAt: '2026-01-01', seriesId: 'old-series', formats: ['doubles'], formatModes: { doubles: 'leagueOnly' }, venueName: '구장', venueAddress: '주소', maxParticipants: 12, registrations: [{ nickname: '기존선수' }], qualifyingGroups: {}, completedAt: 'yesterday' };
  const draft = makeDraft({ source });
  assert.equal(draft.title, '지난 경기');
  assert.equal(draft.titleEdited, true);
  assert.equal(draft.scheduledAt, '');
  assert.equal(draft.seriesId, '');
  assert.equal(draft.reuseRoster, false);
  assert.equal(draft.venueName, '구장');
  assert.equal(draft.maxParticipants, 12);
  for (const key of ['id', 'registrations', 'qualifyingGroups', 'completedAt']) assert.equal(key in draft, false);
  draft.formats.push('singles');
  draft.formatModes.doubles = 'leagueTournament';
  assert.deepEqual(source.formats, ['doubles']);
  assert.equal(source.formatModes.doubles, 'leagueOnly');
});

test('next round inherits series defaults without old round or match state', () => {
  const draft = makeDraft({ series: { id: 'series', defaultFormats: ['team'], defaultMaxParticipants: 24 }, venue: { name: '구장', address: '주소' } });
  assert.equal(draft.seriesId, 'series');
  assert.deepEqual(draft.formats, ['team']);
  assert.equal(draft.maxParticipants, 24);
  assert.equal(draft.venueAddress, '주소');
  assert.equal('seriesRound' in draft, false);
});

test('invitation strips unrelated query and fragment and preserves only game identifier', () => {
  const url = new URL(inviteUrl('https://ttground.com/?foo=old#section', 'game a'));
  assert.equal(url.pathname, '/');
  assert.equal(url.searchParams.get('game'), 'game a');
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, '');
});

test('history links retain login destination and remove it when returning home', () => {
  const join = routeUrl('https://ttground.com/', { pendingGameId: 'game' });
  assert.equal(new URL(join).searchParams.get('join'), '1');
  assert.equal(new URL(join).searchParams.get('game'), 'game');
  const resumed = routeUrl(join, { selectedGameId: 'game' });
  assert.equal(new URL(resumed).searchParams.has('join'), false);
  assert.equal(routeUrl(resumed, {}), 'https://ttground.com/');
});

test('suggested title and quick date use local calendar values', () => {
  assert.equal(localDateTime(new Date(2026, 9, 17, 14, 30)), '2026-10-17T14:30');
  assert.equal(suggestedTitle({ scheduledAt: '2026-10-17T14:30', venueName: '우리탁구장' }), '10월 17일 우리탁구장 게임');
  assert.equal(suggestedTitle({ scheduledAt: '2026-10-17T14:30' }, '월례리그'), '10월 17일 월례리그');
});
