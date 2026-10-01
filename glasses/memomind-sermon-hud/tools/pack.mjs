// 배포 폴더(dist/)를 만들고 공식 패키저로 .mmpkg 를 만든다.
//   node tools/pack.mjs /path/to/plugin-open-platform
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdkRoot = resolve(process.argv[2] || process.env.MEMOMIND_SDK || '');
const packager = join(sdkRoot, 'PhoneSDK/tools/build-mmpkg.mjs');
if (!existsSync(packager)) { console.error('사용법: node tools/pack.mjs <plugin-open-platform 경로>'); process.exit(1); }
if (!existsSync(join(here, 'vendor/gm-plugin-web-sdk.esm.js'))) { console.error('먼저 node tools/setup.mjs <경로> 로 SDK 를 가져오세요'); process.exit(1); }

const dist = join(here, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'src'), { recursive: true });
for (const f of ['index.html', 'style.css', 'manifest.json']) cpSync(join(here, f), join(dist, f));
for (const f of ['plugin.js', 'deck-core.js', 'sample-deck.js']) cpSync(join(here, 'src', f), join(dist, 'src', f));
cpSync(join(here, 'vendor'), join(dist, 'vendor'), { recursive: true });

const { version } = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const out = join(here, `sermon-hud-${version}.mmpkg`);
execFileSync(process.execPath, [packager, dist, out], { stdio: 'inherit' });
