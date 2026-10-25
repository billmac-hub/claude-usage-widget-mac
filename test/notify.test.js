import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createNotify, escapeAppleScript } from '../src/main/notify.js';

// 가짜 Notification: show() 호출을 기록하고, 테스트가 emit('failed')로 실패를 흉내낸다.
function makeFakes({ supported = true } = {}) {
  const shown = [];
  const execCalls = [];
  class FakeNotification extends EventEmitter {
    static isSupported() { return supported; }
    constructor(opts) { super(); this.opts = opts; shown.push(this); }
    show() { this.shown = true; }
  }
  const execFile = (file, args) => { execCalls.push({ file, args }); };
  return { FakeNotification, execFile, shown, execCalls };
}

test('정상일 때는 osascript를 부르지 않는다', () => {
  const f = makeFakes();
  createNotify({ Notification: f.FakeNotification, execFile: f.execFile })('제목', '본문');
  assert.equal(f.shown.length, 1);
  assert.equal(f.shown[0].shown, true);
  assert.equal(f.execCalls.length, 0);
});

test('failed 이벤트가 오면 osascript를 1번 부른다 (절대경로, 인자 확인)', () => {
  const f = makeFakes();
  createNotify({ Notification: f.FakeNotification, execFile: f.execFile })('세션 한도 90%', '곧 리셋됩니다.');
  f.shown[0].emit('failed', {}, 'UNErrorDomain 1');
  f.shown[0].emit('failed', {}, 'again'); // 중복 이벤트가 와도 1번만
  assert.equal(f.execCalls.length, 1);
  assert.equal(f.execCalls[0].file, '/usr/bin/osascript');
  assert.deepEqual(f.execCalls[0].args, [
    '-e', 'display notification "곧 리셋됩니다." with title "세션 한도 90%"',
  ]);
});

test('isSupported()가 false면 바로 osascript로 대신한다', () => {
  const f = makeFakes({ supported: false });
  createNotify({ Notification: f.FakeNotification, execFile: f.execFile })('t', 'b');
  assert.equal(f.shown.length, 0);
  assert.equal(f.execCalls.length, 1);
});

test('따옴표와 역슬래시를 AppleScript 문자열용으로 이스케이프한다', () => {
  assert.equal(escapeAppleScript('a"b\\c'), 'a\\"b\\\\c');
  const f = makeFakes({ supported: false });
  createNotify({ Notification: f.FakeNotification, execFile: f.execFile })('say "hi"', 'path\\x');
  assert.equal(
    f.execCalls[0].args[1],
    'display notification "path\\\\x" with title "say \\"hi\\""',
  );
});
