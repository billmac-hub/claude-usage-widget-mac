// src/main/ipc.js
import { ipcMain } from 'electron';

export function registerIpc({ win, settingsStore, requestRefresh }) {
  ipcMain.handle('usage:refresh', () => {
    requestRefresh();
  });

  ipcMain.handle('settings:load', () => settingsStore.load());

  ipcMain.handle('win:togglePin', () => {
    const next = !win.isAlwaysOnTop();
    win.setAlwaysOnTop(next, 'floating');
    settingsStore.save({ pinned: next });
    return next;
  });

  ipcMain.handle('win:setExpanded', (_e, expanded) => {
    settingsStore.save({ expanded: Boolean(expanded) });
  });

  // 렌더러가 실측한 콘텐츠 높이로 창을 맞춘다 — 접힘/펼침 카드 수가 바뀌어도
  // 매직넘버 없이 항상 실제 레이아웃과 창 크기가 일치한다.
  ipcMain.handle('win:setHeight', (_e, height) => {
    const h = Math.round(Number(height));
    if (!Number.isFinite(h) || h <= 0) return;
    const bounds = win.getBounds();
    if (bounds.height === h) return;
    win.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: h }, true);
  });
}
