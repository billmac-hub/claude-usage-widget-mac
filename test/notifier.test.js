import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAlertTracker } from '../src/main/notifier.js';

const RESET_A = '2026-07-26T09:50:00Z';
const RESET_B = '2026-07-27T09:50:00Z'; // 다른 리셋 창

function limit(id, percent, resetsAt = RESET_A) {
  return { id, label: id, percent, resetsAt, kind: 'limit' };
}

test('no notification while below every threshold', () => {
  const tracker = createAlertTracker();
  assert.deepEqual(tracker.check([limit('session', 39)]), []);
  assert.deepEqual(tracker.check([limit('session', 60)]), []);
});

test('fires once when crossing the 85 threshold', () => {
  const tracker = createAlertTracker();
  tracker.check([limit('session', 39)]);
  const fired = tracker.check([limit('session', 90)]);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].threshold, 85);
});

test('does not re-fire while staying above the same threshold', () => {
  const tracker = createAlertTracker();
  tracker.check([limit('session', 90)]);
  assert.deepEqual(tracker.check([limit('session', 91)]), []);
  assert.deepEqual(tracker.check([limit('session', 94)]), []);
});

test('crossing 95 after already having crossed 85 fires only the 95 alert', () => {
  const tracker = createAlertTracker();
  tracker.check([limit('session', 90)]); // 85 fires here
  const fired = tracker.check([limit('session', 97)]);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].threshold, 95);
});

test('dropping below a threshold and climbing back re-fires it', () => {
  const tracker = createAlertTracker();
  tracker.check([limit('session', 90)]); // crosses 85
  tracker.check([limit('session', 80)]); // drops below 85 — flag clears
  const fired = tracker.check([limit('session', 88)]); // climbs back over 85
  assert.equal(fired.length, 1);
  assert.equal(fired[0].threshold, 85);
});

test('a new reset window clears prior crossings even if percent stayed high', () => {
  const tracker = createAlertTracker();
  tracker.check([limit('session', 96, RESET_A)]); // fires 95
  const fired = tracker.check([limit('session', 96, RESET_B)]); // 창이 바뀜, percent는 우연히 그대로
  assert.equal(fired.length, 1);
  assert.equal(fired[0].threshold, 95);
});

test('credit-kind metrics never notify regardless of percent', () => {
  const tracker = createAlertTracker();
  const fired = tracker.check([{ id: 'credit', label: '추가 크레딧', percent: 99, kind: 'credit' }]);
  assert.deepEqual(fired, []);
});

test('tracks multiple metrics independently', () => {
  const tracker = createAlertTracker();
  const fired = tracker.check([limit('session', 96), limit('weekly', 40)]);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].id, 'session');
});
