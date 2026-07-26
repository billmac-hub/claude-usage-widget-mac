import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { readJson, writeJson } from '../src/main/jsonFile.js';

function tmpFile() {
  const dir = mkdtempSync(join(tmpdir(), 'cuw-'));
  return { dir, file: join(dir, 'nested', 'data.json') };
}

test('writeJson then readJson round-trips and creates dirs', () => {
  const { dir, file } = tmpFile();
  writeJson(file, { a: 1 });
  assert.deepEqual(readJson(file, null), { a: 1 });
  rmSync(dir, { recursive: true, force: true });
});

test('readJson returns fallback when missing', () => {
  const { dir, file } = tmpFile();
  assert.deepEqual(readJson(file, { x: true }), { x: true });
  rmSync(dir, { recursive: true, force: true });
});

test('readJson backs up a corrupt file before returning fallback', () => {
  const { dir, file } = tmpFile();
  writeJson(file, { ok: 1 });
  writeFileSync(file, '{bad json', 'utf8');
  const result = readJson(file, { fb: 1 });
  assert.deepEqual(result, { fb: 1 });
  assert.equal(existsSync(file), false);
  const backups = readdirSync(dirname(file)).filter((f) => f.includes('.corrupt-'));
  assert.equal(backups.length, 1);
  rmSync(dir, { recursive: true, force: true });
});
