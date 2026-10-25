// src/main/notify.js
// Electron 42+에서 서명 안 된 맥 앱은 Notification이 `failed`(UNErrorDomain 1)로 끝나 알림이 안 뜬다.
// 그럴 때 osascript(display notification)로 대신 띄운다. Notification·execFile은 주입(테스트용).
const OSASCRIPT = '/usr/bin/osascript';

export function escapeAppleScript(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createNotify({ Notification, execFile }) {
  function fallback(title, body) {
    const script = `display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}"`;
    execFile(OSASCRIPT, ['-e', script], () => {}); // 셸 없이 직접 실행, 실패해도 앱은 계속
  }

  return function notify(title, body) {
    if (!Notification.isSupported()) return fallback(title, body);
    let fell = false;
    const n = new Notification({ title, body });
    n.on('failed', () => {
      if (fell) return;
      fell = true;
      fallback(title, body);
    });
    n.show();
  };
}
