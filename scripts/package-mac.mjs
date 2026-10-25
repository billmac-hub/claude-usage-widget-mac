// Build a self-contained macOS .app WITHOUT electron-builder.
//
// Why: on macOS 26 (Tahoe) the Code Signing Monitor kills apps whose binaries
// carry a re-applied ad-hoc signature (V8 JIT is trapped → EXC_BREAKPOINT at
// launch). electron-builder renames+re-signs Electron's binaries, so its output
// crashes. Copying the PRISTINE, linker-signed Electron.app and only *adding*
// our app (no rename of the executable/helpers, no re-sign) preserves the
// signature macOS accepts. Same approach as ../task-widget/scripts/package-mac.mjs,
// verified working there on macOS 26.5.1.
//
// Result: dist/mac/사용량.app (self-contained, unsigned → first launch needs
// right-click → Open).
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PRODUCT = '사용량';
const BUNDLE_ID = 'com.bcuration.claudeusagewidget';
const OUT = join(ROOT, 'dist', 'mac');
const APP = join(OUT, `${PRODUCT}.app`);
const ELECTRON_APP = join(ROOT, 'node_modules', 'electron', 'dist', 'Electron.app');
const RES = join(APP, 'Contents', 'Resources');

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

// Electron 42+ no longer downloads its binary in postinstall — fetch it explicitly.
if (!existsSync(ELECTRON_APP)) run('npx', ['--no-install', 'install-electron']);
if (!existsSync(ELECTRON_APP)) throw new Error('run `npm install` first (electron missing)');

// 1. build/icon.png (1024) + .icns — sips/iconutil만 사용, 새 의존성 없음.
mkdirSync('build', { recursive: true });
run('sips', ['-z', '1024', '1024', 'assets/icon-source.png', '--out', 'build/icon.png']);

const ICONSET = join(OUT, 'icon.iconset');
rmSync(ICONSET, { recursive: true, force: true });
mkdirSync(ICONSET, { recursive: true });
for (const s of [16, 32, 128, 256, 512]) {
  run('sips', ['-z', `${s}`, `${s}`, 'build/icon.png', '--out', join(ICONSET, `icon_${s}x${s}.png`)]);
  run('sips', ['-z', `${s * 2}`, `${s * 2}`, 'build/icon.png', '--out', join(ICONSET, `icon_${s}x${s}@2x.png`)]);
}
const ICNS = join(OUT, 'icon.icns');
run('iconutil', ['-c', 'icns', ICONSET, '-o', ICNS]);

// 2. app.asar from a clean staging (package.json + src + assets)
const STAGE = join(OUT, 'stage');
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
cpSync(join(ROOT, 'package.json'), join(STAGE, 'package.json'));
cpSync(join(ROOT, 'src'), join(STAGE, 'src'), { recursive: true });
cpSync(join(ROOT, 'assets'), join(STAGE, 'assets'), { recursive: true }); // 로고 + 메뉴바 아이콘(trayTemplate.png) 포함
const ASAR = join(OUT, 'app.asar');
run('npx', ['--yes', '@electron/asar', 'pack', STAGE, ASAR]);

// 3. copy the PRISTINE Electron.app (NO re-sign — preserve linker-signed sigs).
//    Use `cp -R` (not fs.cpSync) so the framework's Versions symlinks are kept
//    verbatim — dereferencing them breaks the bundle (icudtl.dat not found).
rmSync(APP, { recursive: true, force: true });
run('cp', ['-R', ELECTRON_APP, APP]);

// 4. drop our app in; remove Electron's default welcome app so ours loads
rmSync(join(RES, 'default_app.asar'), { force: true });
cpSync(ASAR, join(RES, 'app.asar'));
cpSync(ICNS, join(RES, 'electron.icns')); // same filename Info.plist already points at

// 5. brand the display name + a UNIQUE bundle id (Info.plist edit only — still
//    NO re-sign). The unique CFBundleIdentifier is essential: if it stays
//    com.github.Electron, LaunchServices dedupes by bundle id and a Finder
//    double-click launches the registered dev Electron (node_modules) with its
//    default welcome app instead of this bundle.
const plist = join(APP, 'Contents', 'Info.plist');
run('plutil', ['-replace', 'CFBundleName', '-string', PRODUCT, plist]);
run('plutil', ['-replace', 'CFBundleDisplayName', '-string', PRODUCT, plist]);
run('plutil', ['-replace', 'CFBundleIdentifier', '-string', BUNDLE_ID, plist]);

// 6. deep ad-hoc sign to create the BUNDLE seal (_CodeSignature).
//    Without it, Gatekeeper treats a Finder launch as "damaged" and blocks it.
//    With the seal, it's a standard unsigned app: right-click → Open once.
run('codesign', ['--force', '--deep', '--sign', '-', APP]);
run('codesign', ['--verify', '--deep', '--strict', APP]);

console.log(`\n✓ ${APP}`);
