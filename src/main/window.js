// src/main/window.js
import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readJson, writeJson } from './jsonFile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 280;
const INITIAL_HEIGHT = { collapsed: 216, expanded: 442 }; // 렌더러 첫 측정 전까지만 쓰는 추정치

export function createWindow(userDataDir, settings) {
  const boundsPath = join(userDataDir, 'window.json');
  const saved = readJson(boundsPath, {});
  const initialHeight = settings.expanded ? INITIAL_HEIGHT.expanded : INITIAL_HEIGHT.collapsed;

  // 저장된 위치가 모든 디스플레이 밖이면(모니터 구성 변경 등) 위치를 버리고 기본 위치로
  let { x, y } = saved;
  if (x !== undefined && y !== undefined) {
    const onScreen = screen.getAllDisplays().some(({ workArea: a }) => {
      return x + WIDTH > a.x + 40 && x < a.x + a.width - 40 && y >= a.y - 20 && y < a.y + a.height - 40;
    });
    if (!onScreen) {
      x = undefined;
      y = undefined;
    }
  }

  const win = new BrowserWindow({
    width: WIDTH,
    height: initialHeight,
    x,
    y,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    alwaysOnTop: settings.pinned,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (settings.pinned) win.setAlwaysOnTop(true, 'floating');
  win.loadFile(join(__dirname, '../renderer/index.html'));

  const persistPosition = () => {
    const bounds = win.getBounds();
    writeJson(boundsPath, { x: bounds.x, y: bounds.y });
  };
  win.on('move', persistPosition);

  return win;
}
