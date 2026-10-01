// 시뮬레이터 자동 점검 — Browser Studio 를 띄운 상태에서 실행한다.
//   npm run studio   (다른 터미널)
//   npm run simulate
// 버튼·제스처를 차례로 눌러 보고 화면을 screens-out/ 에 저장하며, 결과를 한 줄씩 출력한다.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const OUT = process.argv[2] || 'screens-out';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const URL_ = process.env.STUDIO_URL || 'http://127.0.0.1:4173/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
await p.goto(URL_, { waitUntil: 'networkidle' });
// 권한 승인 창 — 실제 앱 설치 때의 동의 단계와 같다
const dlg = p.locator('dialog[open]');
await dlg.waitFor({ timeout: 10000 });
for (const box of await dlg.locator('input[type=checkbox]').all()) await box.check();
await dlg.locator('button').first().click();
await dlg.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});

// 플러그인이 처음 그릴 때까지 대기
const frame = () => p.frames().find((f) => f.url().includes('index.html') && f !== p.mainFrame());
const waitPhone = async (ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const f = frame();
    if (f) { const t = await f.locator('#pos').textContent().catch(() => null); if (t && t !== '—') return f; }
    await p.waitForTimeout(250);
  }
  throw new Error('플러그인 화면이 준비되지 않았습니다');
};
await p.waitForFunction(() => /confirmed|확인|Draw|ok/i.test(document.querySelector('#transport-status')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(1500);

// 지난 실행의 저장 상태(위치·보정값)를 지우고 같은 출발점에서 시작
{
  const f0 = await waitPhone();
  await f0.locator('details').nth(1).evaluate((d) => { d.open = true; });
  await f0.locator('#cpl').fill('30'); await f0.locator('#mxl').fill('12');
  await f0.locator('#fitApply').click();
  await f0.locator('details').nth(0).evaluate((d) => { d.open = true; });
  await f0.locator('#sample').click();
  await p.waitForTimeout(800);
}

const canvas = p.locator('#device-canvas');
const shot = async (name) => { await p.waitForTimeout(700); await canvas.screenshot({ path: `${OUT}/${name}.png` }); };
const status = async () => (await p.locator('#transport-status').textContent()).trim();
const phone = async () => { const f = frame(); return f ? (await f.locator('#pos').textContent()) : '?'; };

await p.screenshot({ path: `${OUT}/00-studio-full.png` });
await shot('01-screen1');
const report = [`시작: ${await phone()} | ${await status()}`];

for (let i = 2; i <= 4; i++) {
  await p.click('button[data-button="single"]');
  await shot(`0${i}-after-single`);
  report.push(`한 번 누름 → ${await phone()}`);
}
await p.click('button[data-button="double"]');
await shot('05-after-double');
report.push(`두 번 누름(이전) → ${await phone()}`);

await p.click('button[data-gesture="right"]');
await p.waitForTimeout(500);
report.push(`고개 오른쪽(기본 꺼짐) → ${await phone()}  (변화 없어야 정상)`);

await p.waitForTimeout(400);
await p.click('button[data-button="long"]');
await p.waitForTimeout(2600);
await p.click('button[data-button="single"]');
await shot('06-timer-running');
report.push(`길게(타이머 시작) 후 다음 → ${await phone()} | 폰 버튼: ${await frame().locator('#timer').textContent()}`);

// 연타 방지(300ms) 확인: 빠르게 두 번 누르면 한 장만 넘어가야 한다
const before = await phone();
await p.click('button[data-button="single"]'); await p.click('button[data-button="single"]', { delay: 0 });
await p.waitForTimeout(600);
report.push(`연타 2회(300ms 이내): ${before} → ${await phone()}`);

// 마지막 장까지 넘겨 결론 화면 캡처
for (let k = 0; k < 8; k++) { await p.waitForTimeout(350); await p.click('button[data-button="single"]'); }
await shot('07-last');
report.push(`끝까지 → ${await phone()} (마지막 장에서 멈춰야 정상)`);

// 실기기 보정: 시뮬레이터 실제 폭에 맞춰 37자 × 11줄로 — 3번째 화면에서 보정
for (let k = 0; k < 6; k++) { await p.waitForTimeout(350); await p.click('button[data-button="double"]'); }
for (let k = 0; k < 2; k++) { await p.waitForTimeout(350); await p.click('button[data-button="single"]'); }
await p.waitForTimeout(800);   // 마지막 클릭 이벤트가 처리될 때까지
const fr = frame();
const beforeFit = await phone();
const firstLine = (await fr.locator('#preview').textContent()).split('\n')[0];
await fr.locator('details').nth(1).evaluate((d) => { d.open = true; });
await fr.locator('#cpl').fill('37'); await fr.locator('#mxl').fill('11');
await fr.locator('#fitApply').click();
await shot('09-after-calibration');
report.push(`보정 전 ${beforeFit} "${firstLine.slice(0,20)}" → 보정 후 ${await phone()} "${(await fr.locator('#preview').textContent()).split('\n')[0].slice(0,20)}"`);

// 재시작(Reload) 후 같은 위치·같은 보정값으로 이어지는지
const posBefore = await phone();
await p.click('#reload');
const dlg2 = p.locator('dialog[open]');
if (await dlg2.count()) { for (const box of await dlg2.locator('input[type=checkbox]').all()) await box.check(); await dlg2.locator('button').first().click(); }
await p.waitForTimeout(800);
await waitPhone();
report.push(`다시 시작: ${posBefore} → ${await phone()} | 보정값 ${await frame().locator('#cpl').inputValue()}자×${await frame().locator('#mxl').inputValue()}줄`);

// 폰 쪽 조작판 캡처
const f = frame();
await f.locator('main').screenshot({ path: `${OUT}/08-phone-panel.png` });
report.push('플러그인 로그:\n' + (await f.locator('#log').textContent()).split('\n').slice(0, 14).join('\n'));
report.push('오류: ' + (errors.length ? errors.join('\n') : '없음'));
console.log(report.join('\n'));
await b.close();
