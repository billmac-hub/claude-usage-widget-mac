import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSettingsStore } from '../src/main/settings.js';

function tmpPath() {
  const dir = mkdtempSync(join(tmpdir(), 'cuw-settings-'));
  return { dir, file: join(dir, 'settings.json') };
}

test('load returns defaults when no file exists yet', () => {
  const { dir, file } = tmpPath();
  const store = createSettingsStore(file);
  assert.deepEqual(store.load(), { pinned: true, expanded: false, openAtLogin: true });
  rmSync(dir, { recursive: true, force: true });
});

test('save patches and persists only the given keys', () => {
  const { dir, file } = tmpPath();
  const store = createSettingsStore(file);
  store.save({ expanded: true });
  assert.deepEqual(store.load(), { pinned: true, expanded: true, openAtLogin: true });
  store.save({ pinned: false });
  assert.deepEqual(store.load(), { pinned: false, expanded: true, openAtLogin: true });
  rmSync(dir, { recursive: true, force: true });
});
