// src/main/settings.js
import { readJson, writeJson } from './jsonFile.js';

const DEFAULTS = { pinned: true, expanded: false, openAtLogin: true };

export function createSettingsStore(filePath) {
  return {
    load() {
      return { ...DEFAULTS, ...readJson(filePath, DEFAULTS) };
    },
    save(patch) {
      const next = { ...this.load(), ...patch };
      writeJson(filePath, next);
      return next;
    },
  };
}
