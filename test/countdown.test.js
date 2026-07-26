// formatResetClock은 로컬 시간대로 표시하므로, 실행 환경의 시간대와 무관하게
// 테스트가 재현되도록 UTC로 고정한다 (실제 앱 동작은 이 값의 영향을 받지 않음).
process.env.TZ = 'UTC';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCountdown, formatResetClock } from '../src/shared/countdown.js';

const NOW = new Date('2026-07-26T13:52:00.000Z').getTime();

test('formatCountdown: minutes only under an hour', () => {
  const resetsAt = new Date(NOW + 41 * 60_000).toISOString();
  assert.equal(formatCountdown(resetsAt, NOW), '41분');
});

test('formatCountdown: hours and minutes under a day', () => {
  const resetsAt = new Date(NOW + 4 * 3_600_000 + 58 * 60_000).toISOString();
  assert.equal(formatCountdown(resetsAt, NOW), '4시간 58분');
});

test('formatCountdown: days and hours', () => {
  const resetsAt = new Date(NOW + 1 * 86_400_000 + 7 * 3_600_000).toISOString();
  assert.equal(formatCountdown(resetsAt, NOW), '1일 7시간');
});

test('formatCountdown: past target reads as reset', () => {
  const resetsAt = new Date(NOW - 1000).toISOString();
  assert.equal(formatCountdown(resetsAt, NOW), '곧 리셋');
});

test('formatCountdown: never rounds down to 0분', () => {
  const resetsAt = new Date(NOW + 20_000).toISOString(); // 20초 후
  assert.equal(formatCountdown(resetsAt, NOW), '1분');
});

test('formatCountdown: missing or invalid input', () => {
  assert.equal(formatCountdown(null, NOW), '');
  assert.equal(formatCountdown('not-a-date', NOW), '');
});

test('formatResetClock: same calendar day omits date', () => {
  const resetsAt = new Date(NOW + 4 * 3_600_000).toISOString(); // 같은 UTC날 안
  assert.equal(formatResetClock(resetsAt, NOW), '17:52');
});

test('formatResetClock: different day includes M/D', () => {
  const resetsAt = new Date(NOW + 30 * 3_600_000).toISOString(); // 다음날로 넘어감
  assert.equal(formatResetClock(resetsAt, NOW), '7/27 19:52');
});

test('formatResetClock: missing or invalid input', () => {
  assert.equal(formatResetClock(null, NOW), '');
  assert.equal(formatResetClock('garbage', NOW), '');
});
