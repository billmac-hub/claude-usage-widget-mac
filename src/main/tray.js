// src/main/tray.js
import { Tray, Menu, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function setupTray({ app, win, settingsStore }) {
  const img = nativeImage.createFromPath(join(__dirname, '../../assets/trayTemplate.png'));
  img.setTemplateImage(true);
  const tray = new Tray(img);
  tray.setToolTip('사용량');

  const toggleVisible = () => {
    if (win.isVisible()) win.hide();
    else {
      win.show();
      win.focus();
    }
  };

  const buildMenu = () =>
    Menu.buildFromTemplate([
      { label: win.isVisible() ? '숨기기' : '보이기', click: toggleVisible },
      { type: 'separator' },
      {
        label: '로그인 시 자동 시작',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: () => {
          const next = !app.getLoginItemSettings().openAtLogin;
          app.setLoginItemSettings({ openAtLogin: next });
          settingsStore.save({ openAtLogin: next });
        },
      },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() },
    ]);

  tray.on('click', toggleVisible);
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));

  return tray;
}
