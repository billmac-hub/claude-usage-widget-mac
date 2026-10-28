import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, getToken, claudeAccountName } from '../src/main/usage.js';

const FETCHED_AT = '2026-07-26T13:52:00.000Z';

// 2026-07-26에 이 API에서 실제로 받은 응답의 축약본
const REAL_FIXTURE = {
  limits: [
    { kind: 'session', group: 'session', percent: 39, severity: 'normal', resets_at: '2026-07-26T09:50:00.727408+00:00', is_active: true },
    { kind: 'weekly_all', group: 'weekly', percent: 39, severity: 'normal', resets_at: '2026-07-27T12:00:00.727426+00:00', is_active: false },
    {
      kind: 'weekly_scoped',
      group: 'weekly',
      percent: 32,
      severity: 'normal',
      resets_at: '2026-07-27T11:59:59.727669+00:00',
      scope: { model: { id: null, display_name: 'Fable' }, surface: null },
      is_active: false,
    },
  ],
  extra_usage: {
    is_enabled: true,
    monthly_limit: 10000,
    used_credits: 4455.0,
    utilization: 44.55,
    currency: 'USD',
    decimal_places: 2,
  },
};

test('normalize: real fixture yields 4 metrics in order', () => {
  const result = normalize(REAL_FIXTURE, FETCHED_AT);
  assert.equal(result.error, null);
  assert.equal(result.fetchedAt, FETCHED_AT);
  assert.deepEqual(
    result.metrics.map((m) => m.id),
    ['session', 'weekly', 'model', 'credit'],
  );

  const session = result.metrics[0];
  assert.equal(session.label, '세션 · 5시간');
  assert.equal(session.percent, 39);
  assert.equal(session.resetsAt, '2026-07-26T09:50:00.727408+00:00');
  assert.equal(session.kind, 'limit');

  const model = result.metrics[2];
  assert.equal(model.label, '주간 · Fable');
  assert.equal(model.percent, 32);

  const credit = result.metrics[3];
  assert.equal(credit.percent, 45); // round(44.55)
  assert.equal(credit.used, 44.55);
  assert.equal(credit.limit, 100);
  assert.equal(credit.kind, 'credit');
});

test('normalize: missing weekly_scoped omits the model card, keeps the rest', () => {
  const fixture = { ...REAL_FIXTURE, limits: REAL_FIXTURE.limits.slice(0, 2) };
  const result = normalize(fixture, FETCHED_AT);
  assert.deepEqual(
    result.metrics.map((m) => m.id),
    ['session', 'weekly', 'credit'],
  );
});

test('normalize: extra_usage.is_enabled false excludes the credit card', () => {
  const fixture = { ...REAL_FIXTURE, extra_usage: { ...REAL_FIXTURE.extra_usage, is_enabled: false } };
  const result = normalize(fixture, FETCHED_AT);
  assert.deepEqual(
    result.metrics.map((m) => m.id),
    ['session', 'weekly', 'model'],
  );
});

test('normalize: missing extra_usage entirely excludes the credit card', () => {
  const { extra_usage, ...fixture } = REAL_FIXTURE;
  const result = normalize(fixture, FETCHED_AT);
  assert.deepEqual(
    result.metrics.map((m) => m.id),
    ['session', 'weekly', 'model'],
  );
});

test('normalize: empty limits array is a format error', () => {
  const result = normalize({ limits: [] }, FETCHED_AT);
  assert.deepEqual(result, { error: 'format' });
});

test('normalize: scoped entry without a model display_name still renders', () => {
  const fixture = {
    ...REAL_FIXTURE,
    limits: [
      REAL_FIXTURE.limits[0],
      REAL_FIXTURE.limits[1],
      { kind: 'weekly_scoped', percent: 10, resets_at: '2026-07-27T12:00:00Z', scope: {} },
    ],
  };
  const result = normalize(fixture, FETCHED_AT);
  const model = result.metrics.find((m) => m.id === 'model');
  assert.equal(model.label, '주간 · 모델');
});

test('normalize: entry with a non-numeric percent is dropped, not crashed', () => {
  const fixture = {
    limits: [{ kind: 'session', percent: 'oops', resets_at: '2026-07-26T09:50:00Z' }],
  };
  const result = normalize(fixture, FETCHED_AT);
  assert.deepEqual(result, { error: 'format' }); // 유일한 항목이 드롭되어 빈 metrics
});

test('normalize: non-object / unexpected shapes are format errors', () => {
  assert.deepEqual(normalize(null, FETCHED_AT), { error: 'format' });
  assert.deepEqual(normalize(undefined, FETCHED_AT), { error: 'format' });
  assert.deepEqual(normalize('<html>error</html>', FETCHED_AT), { error: 'format' });
  assert.deepEqual(normalize({}, FETCHED_AT), { error: 'format' });
  assert.deepEqual(normalize({ limits: 'not-an-array' }, FETCHED_AT), { error: 'format' });
});

// 키체인 조회를 흉내 낸다: entries는 계정명 → 저장된 JSON. 계정 없이 조회하면 맨 앞 항목이 잡힌다(macOS 동작).
function fakeKeychain(entries) {
  const calls = [];
  const exec = async (_cmd, args) => {
    calls.push(args);
    const i = args.indexOf('-a');
    const account = i >= 0 ? args[i + 1] : Object.keys(entries)[0];
    if (!(account in entries)) throw new Error('The specified item could not be found in the keychain.');
    return { stdout: JSON.stringify(entries[account]) };
  };
  return { exec, calls };
}

const NOW = Date.parse('2026-10-28T03:00:00Z');
const login = (expiresAt = NOW + 3_600_000) => ({ claudeAiOauth: { accessToken: 'tok-real', expiresAt } });

test('getToken: reads the account entry even when a stray mcp-only entry comes first', async () => {
  const { exec, calls } = fakeKeychain({ unknown: { mcpOAuth: {} }, billmac: login() });
  const result = await getToken({ exec, account: 'billmac', now: NOW });
  assert.deepEqual(result, { token: 'tok-real' });
  assert.deepEqual(calls[0].slice(0, 3), ['find-generic-password', '-a', 'billmac']);
});

test('getToken: falls back to an account-less lookup when the account entry is missing', async () => {
  const { exec } = fakeKeychain({ someone: login() });
  assert.deepEqual(await getToken({ exec, account: 'billmac', now: NOW }), { token: 'tok-real' });
});

test('getToken: entries without claudeAiOauth are no_token', async () => {
  const { exec } = fakeKeychain({ unknown: { mcpOAuth: {} } });
  assert.deepEqual(await getToken({ exec, account: 'billmac', now: NOW }), { error: 'no_token' });
});

test('getToken: an expired access token is reported as expired, not as logged out', async () => {
  const { exec } = fakeKeychain({ billmac: login(NOW - 1) });
  assert.deepEqual(await getToken({ exec, account: 'billmac', now: NOW }), { error: 'expired' });
});

test('getToken: unparseable keychain data is no_token', async () => {
  const exec = async () => ({ stdout: 'not json' });
  assert.deepEqual(await getToken({ exec, account: 'billmac', now: NOW }), { error: 'no_token' });
});

test('claudeAccountName: follows $USER like Claude Code, rejecting unsafe names', () => {
  const saved = process.env.USER;
  try {
    process.env.USER = 'billmac';
    assert.equal(claudeAccountName(), 'billmac');
    process.env.USER = 'bad name';
    assert.equal(claudeAccountName(), 'claude-code-user');
  } finally {
    process.env.USER = saved;
  }
});
