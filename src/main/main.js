// src/main/main.js
import { app, Notification, Menu } from 'electron';
import { join } from 'node:path';
import { getToken, fetchUsage, normalize } from './usage.js';
import { createAlertTracker } from './notifier.js';
import { createSettingsStore } from './settings.js';
import { createWindow } from './window.js';
import { registerIpc } from './ipc.js';
import { formatCountdown, formatResetClock } from '../shared/countdown.js';

const POLL_INTERVAL_MS = 180_000;
const REFRESH_THROTTLE_MS = 10_000;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let lastFetchAt = 0;
let lastGoodMetrics = null; // 마지막 성공값 — 오류가 나도 화면에서 지우지 않기 위해 유지
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
      fetchedAt: null,
    });
    return;
  }

  lastGoodMetrics = result.metrics;
  win?.webContents.send('usage:data', { error: null, metrics: result.metrics, fetchedAt: result.fetchedAt });

  for (const n of alertTracker.check(result.metrics)) {
    notifyThreshold(n);
  }
}

function notifyThreshold(n) {
  const remain = formatCountdown(n.resetsAt);
  const clock = formatResetClock(n.resetsAt);
  const body = remain && clock ? `${remain} 뒤 ${clock}에 리셋됩니다.` : '곧 리셋됩니다.';
  new Notification({ title: `${shortName(n)} 한도 ${n.percent}%`, body }).show();
}

function shortName(n) {
  const parts = n.label.split(' · ');
  return n.id === 'model' ? (parts[1] ?? n.label) : parts[0];
}

// 프레임 없는 창이라 타이틀바 메뉴가 없다 — 우클릭으로 자동 시작 토글 · 종료 제공.
function showContextMenu(settingsStore) {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  Menu.buildFromTemplate([
    {
      label: '로그인 시 자동 시작',
      type: 'checkbox',
      checked: openAtLogin,
      click: () => {
        const next = !openAtLogin;
        app.setLoginItemSettings({ openAtLogin: next });
        settingsStore.save({ openAtLogin: next });
      },
    },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]).popup({ window: win });
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const settingsStore = createSettingsStore(join(userData, 'settings.json'));
  const settings = settingsStore.load();

  if (settings.openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  win = createWindow(userData, settings);
  registerIpc({ win, settingsStore, requestRefresh: () => refresh(true) });
  win.webContents.on('context-menu', () => showContextMenu(settingsStore));

  refresh(true);
  setInterval(() => refresh(false), POLL_INTERVAL_MS);

  app.on('activate', () => {
    win.show();
    win.focus();
  });
});

app.on('window-all-closed', () => app.quit());
