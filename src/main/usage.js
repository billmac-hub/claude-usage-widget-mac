// src/main/usage.js
import { execFile } from 'node:child_process';
import { userInfo } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const USER_AGENT = 'claude-code/2.0.0';
const ACCOUNT_PATTERN = /^[a-zA-Z0-9._-]+$/;

// Claude Code가 키체인 항목에 쓰는 계정명과 같은 규칙: $USER, 없으면 OS 사용자명.
export function claudeAccountName() {
  let name;
  try {
    name = process.env.USER || userInfo().username;
  } catch {
    return 'claude-code-user';
  }
  return ACCOUNT_PATTERN.test(name) ? name : 'claude-code-user';
}

// macOS 키체인에서 Claude Code CLI의 OAuth 토큰을 읽는다.
// 다른 앱이 이 항목을 처음 읽을 때 macOS가 접근 허용을 한 번 묻는 것은 정상 동작.
// USER 없이 실행된 claude는 같은 서비스 이름으로 'unknown' 계정 항목을 따로 만든다(2026-10-27 실측).
// 계정을 빼고 조회하면 그 빈 항목이 먼저 잡히므로 계정을 지정해 읽고, 없을 때만 계정 없이 다시 읽는다.
export async function getToken({ exec = execFileAsync, account = claudeAccountName(), now = Date.now() } = {}) {
  for (const accountArgs of [['-a', account], []]) {
    let stdout;
    try {
      ({ stdout } = await exec('security', ['find-generic-password', ...accountArgs, '-s', KEYCHAIN_SERVICE, '-w']));
    } catch {
      continue;
    }

    let oauth;
    try {
      oauth = JSON.parse(stdout)?.claudeAiOauth;
    } catch {
      continue;
    }
    const token = oauth?.accessToken;
    if (typeof token !== 'string' || !token) continue;

    // 위젯은 토큰을 갱신하지 않는다(갱신 토큰이 바뀌면 Claude Code 로그인이 풀릴 수 있음).
    // 만료됐으면 Claude Code가 다음 실행 때 갱신할 때까지 기다린다.
    if (Number.isFinite(oauth.expiresAt) && oauth.expiresAt <= now) return { error: 'expired' };
    return { token };
  }
  return { error: 'no_token' };
}

// /usage 화면과 같은 비공식 엔드포인트. 형식이 바뀔 수 있으므로 이 함수 밖에서
// 절대 throw하지 않고 항상 {error} 또는 {json}을 반환한다.
export async function fetchUsage(token) {
  let res;
  try {
    res = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': USER_AGENT,
      },
    });
  } catch {
    return { error: 'network' };
  }

  if (res.status === 401 || res.status === 403) return { error: 'auth' };
  if (!res.ok) return { error: 'network' };

  try {
    const json = await res.json();
    return { json };
  } catch {
    return { error: 'format' };
  }
}

// 서버 응답을 위젯이 그리는 4개 지표로 정규화한다. 이 API는 비공식이라 필드가
// 빠지거나 형식이 바뀔 수 있으므로(시스템 경계) 여기서만 방어적으로 검증한다 —
// 이 함수를 통과한 결과는 렌더러가 그대로 믿고 그린다.
export function normalize(json, fetchedAt) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.limits)) {
    return { error: 'format' };
  }

  const metrics = [];

  const session = json.limits.find((l) => l?.kind === 'session');
  const weekly = json.limits.find((l) => l?.kind === 'weekly_all');
  const scoped = json.limits.find((l) => l?.kind === 'weekly_scoped');

  const sessionMetric = session && toLimitMetric('session', '세션 · 5시간', session);
  if (sessionMetric) metrics.push(sessionMetric);

  const weeklyMetric = weekly && toLimitMetric('weekly', '주간 · 7일', weekly);
  if (weeklyMetric) metrics.push(weeklyMetric);

  if (scoped) {
    const modelName = scoped.scope?.model?.display_name;
    const label = typeof modelName === 'string' && modelName ? `주간 · ${modelName}` : '주간 · 모델';
    const modelMetric = toLimitMetric('model', label, scoped);
    if (modelMetric) metrics.push(modelMetric);
  }

  const extra = json.extra_usage;
  if (extra && extra.is_enabled && Number.isFinite(extra.utilization)) {
    const usedCents = Number(extra.used_credits);
    const limitCents = Number(extra.monthly_limit);
    if (Number.isFinite(usedCents) && Number.isFinite(limitCents) && limitCents > 0) {
      metrics.push({
        id: 'credit',
        label: '추가 크레딧',
        percent: Math.round(extra.utilization),
        used: usedCents / 100,
        limit: limitCents / 100,
        kind: 'credit',
      });
    }
  }

  if (metrics.length === 0) return { error: 'format' };
  return { metrics, fetchedAt, error: null };
}

function toLimitMetric(id, label, entry) {
  const percent = Number(entry?.percent);
  if (!Number.isFinite(percent)) return null;
  return {
    id,
    label,
    percent: Math.round(percent),
    resetsAt: typeof entry.resets_at === 'string' ? entry.resets_at : null,
    kind: 'limit',
  };
}
