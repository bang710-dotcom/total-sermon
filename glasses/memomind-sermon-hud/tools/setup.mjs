// 공식 SDK 파일을 vendor/ 로 복사한다.
// SDK 는 MemoMind Open Platform 약관 적용 대상이라 이 저장소에 함께 싣지 않는다(.gitignore).
//   node tools/setup.mjs /path/to/plugin-open-platform
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] || process.env.MEMOMIND_SDK || '');
const src = join(root, 'PhoneSDK/examples/novel-reader/vendor/gm-plugin-web-sdk.esm.js');
if (!process.argv[2] && !process.env.MEMOMIND_SDK) {
  console.error('사용법: node tools/setup.mjs <plugin-open-platform 경로>\n' +
    '  먼저: git clone https://github.com/memomind-open/plugin-open-platform');
  process.exit(1);
}
if (!existsSync(src)) { console.error('SDK 파일을 찾지 못했습니다: ' + src); process.exit(1); }
const out = join(dirname(fileURLToPath(import.meta.url)), '../vendor');
mkdirSync(out, { recursive: true });
copyFileSync(src, join(out, 'gm-plugin-web-sdk.esm.js'));
console.log('SDK 복사 완료 → vendor/gm-plugin-web-sdk.esm.js');
