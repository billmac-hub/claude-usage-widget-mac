// src/main/main.js
import { app, dialog, Notification } from 'electron';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { createNotify } from './notify.js';
import { getToken, fetchUsage, normalize } from './usage.js';
import { createAlertTracker } from './notifier.js';
import { createSettingsStore } from './settings.js';
import { createWindow } from './window.js';
import { registerIpc } from './ipc.js';
import { setupTray } from './tray.js';
import { formatCountdown, formatResetClock } from '../shared/countdown.js';

const POLL_INTERVAL_MS = 120_000;
const REFRESH_THROTTLE_MS = 10_000;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let lastFetchAt = 0;
let lastGoodMetrics = null; // 마지막 성공값 — 오류가 나도 화면에서 지우지 않기 위해 유지
let lastGoodFetchedAt = null; // "HH:MM 기준" 표시에 쓰는, 그 성공값을 얻은 시각
const alertTracker = createAlertTracker();

async function loadUsage() {
  const tokenResult = await getToken();
  if (tokenResult.error) return { error: tokenResult.error };

  const usageResult = await fetchUsage(tokenResult.token);
  if (usageResult.error) return { error: usageResult.error };

  return normalize(usageResult.json, new Date().toISOString());
}

async function refresh(force) {
  const now = Date.now();
  if (!force && now - lastFetchAt < REFRESH_THROTTLE_MS) return;
  lastFetchAt = now;

  const result = await loadUsage();

  if (result.error) {
    win?.webContents.send('usage:data', {
      error: result.error,
      metrics: lastGoodMetrics ?? [],
      fetchedAt: lastGoodFetchedAt,
    });
    return;
  }

  lastGoodMetrics = result.metrics;
  lastGoodFetchedAt = result.fetchedAt;
  win?.webContents.send('usage:data', { error: null, metrics: result.metrics, fetchedAt: result.fetchedAt });

  for (const n of alertTracker.check(result.metrics)) {
    notifyThreshold(n);
  }
}

const notify = createNotify({ Notification, execFile });

function notifyThreshold(n) {
  const remain = formatCountdown(n.resetsAt);
  const clock = formatResetClock(n.resetsAt);
  const body = remain && clock ? `${remain} 뒤 ${clock}에 리셋됩니다.` : '곧 리셋됩니다.';
  notify(`${shortName(n)} 한도 ${n.percent}%`, body);
}

function shortName(n) {
  const parts = n.label.split(' · ');
  return n.id === 'model' ? (parts[1] ?? n.label) : parts[0];
}

// scripts/package-mac.mjs는 서명 보존을 위해 순정 Electron 실행 파일 이름을 그대로 써서
// app.isPackaged가 배포본에서도 항상 false다 — 앱 코드가 app.asar 안에 있는지로 판단한다.
const isBundledApp = () => app.getAppPath().endsWith('.asar');

// 다운로드 폴더 등 응용 프로그램 폴더 밖에서 실행하면 macOS가 앱을 임시 경로로 옮겨
// 실행(App Translocation)해서 로그인 항목 등록이 깨진다. 배포본에서만 옮기기를 제안한다.
function offerMoveToApplications() {
  if (!isBundledApp() || app.isInApplicationsFolder()) return false;
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    message: '응용 프로그램 폴더로 옮길까요?',
    detail: '옮겨야 로그인 시 자동 시작이 정상 동작해요.',
    buttons: ['옮기기', '나중에'],
    defaultId: 0,
    cancelId: 1,
  });
  if (choice !== 0) return false;
  try {
    return app.moveToApplicationsFolder(); // 성공하면 옮긴 앱이 다시 실행되고 이 앱은 종료된다
  } catch {
    return false;
  }
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const settingsStore = createSettingsStore(join(userData, 'settings.json'));
  const settings = settingsStore.load();

  if (offerMoveToApplications()) return;

  // 임시 경로가 로그인 항목에 등록되지 않도록, 설치 위치가 확정된 경우에만 등록한다
  if (settings.openAtLogin && (!isBundledApp() || app.isInApplicationsFolder())) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  win = createWindow(userData, settings);
  registerIpc({ win, settingsStore, requestRefresh: () => refresh(true) });
  setupTray({ app, win, settingsStore });

  refresh(true);
  setInterval(() => refresh(false), POLL_INTERVAL_MS);

  app.on('activate', () => {
    win.show();
    win.focus();
  });
});

app.on('window-all-closed', () => app.quit());
