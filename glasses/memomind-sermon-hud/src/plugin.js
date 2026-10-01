// MemoMind One 설교 HUD — 폰 WebView에서 도는 Web 플러그인
// 안경 화면: 머리말(대지·전환 컷·시간) / 본문(카드 몇 줄) / 꼬리말(진행 막대)
// 조작: 버튼 한 번 = 다음, 두 번 = 이전, 길게 = 타이머 시작·멈춤
import { createGMPlugin } from '../vendor/gm-plugin-web-sdk.esm.js';
import {
  SCREEN, DEFAULT_FIT, paginate, headerText, footerText, actionFor, normalizeDeck,
  screenForCard, clampFit,
} from './deck-core.js';
import { SAMPLE_DECK } from './sample-deck.js';

const ID = { header: 1, body: 2, footer: 3 };
const CLOCK_TICK_MS = 10_000;   // 머리말 시계 갱신 간격 — 매초 보내면 BLE를 낭비한다
const $ = (sel) => document.querySelector(sel);

const state = {
  deck: null, screens: [], i: 0,
  running: false, startedAt: 0, elapsedBefore: 0,
  gestures: false,
  fit: { ...DEFAULT_FIT },
};
let gm = null;
let busy = Promise.resolve();

const log = (msg) => {
  const el = $('#log');
  el.textContent = new Date().toLocaleTimeString() + '  ' + msg + '\n' + el.textContent.slice(0, 3000);
};
const elapsed = () => state.elapsedBefore + (state.running ? (Date.now() - state.startedAt) / 1000 : 0);

// 안경으로 보내는 호출은 한 줄로 세운다(겹쳐 보내지 않음)
const send = (fn) => { busy = busy.then(fn).catch((e) => log('그리기 실패: ' + (e.message || JSON.stringify(e)))); return busy; };

function textBox(id, y, h, text, border = 0) {
  return gm.display.updateText({
    id, x: SCREEN.marginX, y, width: SCREEN.width - SCREEN.marginX * 2, height: h,
    border, radius: border ? 6 : 0, text,
  });
}

function drawHeader() {
  const s = state.screens[state.i];
  return textBox(ID.header, SCREEN.headerY, SCREEN.headerH, headerText(s, elapsed(), state.deck.targetMin));
}

function drawAll() {
  const s = state.screens[state.i];
  renderPhone();
  return send(async () => {
    await drawHeader();
    await textBox(ID.body, SCREEN.bodyY, SCREEN.bodyH, s.body);
    await textBox(ID.footer, SCREEN.footerY, SCREEN.footerH, footerText(state.i, state.screens.length));
  });
}

function go(delta) {
  const n = state.screens.length;
  const next = Math.min(n - 1, Math.max(0, state.i + delta));
  if (next === state.i) return;
  state.i = next;
  savePos();
  drawAll();
}

function toggleTimer() {
  if (state.running) { state.elapsedBefore = elapsed(); state.running = false; }
  else { state.startedAt = Date.now(); state.running = true; }
  renderPhone();
  send(drawHeader);
}

function loadDeck(deck, pos = 0) {
  state.deck = deck;
  state.screens = paginate(deck.cards, state.fit);
  state.i = Math.min(pos, state.screens.length - 1);
  state.running = false; state.elapsedBefore = 0;
  log(`「${deck.title}」 카드 ${deck.cards.length}줄 → 안경 화면 ${state.screens.length}장`);
  drawAll();
}

// ── 저장: 브라우저 localStorage 가 아니라 호스트 저장소(gm.storage) ──
async function savePos() {
  try { await gm.storage.set('pos', state.i); } catch (e) { /* 저장 실패가 설교를 막으면 안 된다 */ }
}
async function saveDeck() {
  try { await gm.storage.set('deck', JSON.stringify(state.deck)); } catch (e) { log('설교 저장 실패: ' + e.message); }
}
async function restore() {
  try {
    const f = await gm.storage.get('fit');
    if (f && f.value) state.fit = clampFit(JSON.parse(f.value));
  } catch (e) { /* 기본값 */ }
  try {
    const d = await gm.storage.get('deck');
    const p = await gm.storage.get('pos');
    if (d && d.value) { loadDeck(normalizeDeck(d.value), Number(p && p.value) || 0); log('지난 위치에서 이어 갑니다'); return true; }
  } catch (e) { /* 처음 실행 */ }
  return false;
}

// ── 폰 화면(조작판) ──
function renderPhone() {
  const s = state.screens[state.i];
  $('#title').textContent = state.deck ? `${state.deck.title} · ${state.deck.ref}` : '설교를 불러오세요';
  $('#pos').textContent = state.screens.length ? `${state.i + 1} / ${state.screens.length}` : '—';
  $('#preview').textContent = s ? s.body : '';
  $('#timer').textContent = state.running ? '⏸ 멈춤' : '▶ 시작';
  $('#cpl').value = state.fit.charsPerLine;
  $('#mxl').value = state.fit.maxLines;
}

function bindPhone() {
  $('#prev').onclick = () => go(-1);
  $('#next').onclick = () => go(+1);
  $('#timer').onclick = toggleTimer;
  $('#sample').onclick = async () => { loadDeck(normalizeDeck(SAMPLE_DECK)); await saveDeck(); savePos(); };
  $('#load').onclick = async () => {
    try { loadDeck(normalizeDeck($('#paste').value)); await saveDeck(); savePos(); }
    catch (e) { log('불러오기 실패: ' + e.message); }
  };
  $('#fitApply').onclick = () => {
    state.fit = clampFit({ charsPerLine: $('#cpl').value, maxLines: $('#mxl').value });
    if (state.deck) {
      const card = state.screens[state.i].start;
      state.screens = paginate(state.deck.cards, state.fit);
      state.i = screenForCard(state.screens, card);
      log(`보정 ${state.fit.charsPerLine}자 × ${state.fit.maxLines}줄 → 화면 ${state.screens.length}장`);
      savePos(); drawAll();
    }
    gm.storage.set('fit', JSON.stringify(state.fit)).catch(() => {});
  };
  $('#gestures').onchange = (e) => { state.gestures = e.target.checked; log('고개 제스처 넘김 ' + (state.gestures ? '켬' : '끔')); };
}

async function main() {
  bindPhone();
  gm = createGMPlugin();
  await gm.ready();
  log('브리지 연결됨');
  await gm.device.subscribeEvents(['button', 'imuGesture', 'connection']);
  gm.on('device.button', (data) => handle({ name: 'device.button', data }));
  gm.on('device.imuGesture', (data) => handle({ name: 'device.imuGesture', data }));
  gm.on('device.connection', (data) => { log('연결 상태: ' + JSON.stringify(data)); if (state.deck) drawAll(); });
  if (!(await restore())) { loadDeck(normalizeDeck(SAMPLE_DECK)); await saveDeck(); }
  setInterval(() => { if (state.running && state.deck) send(drawHeader); }, CLOCK_TICK_MS);
}

let lastAt = 0;
function handle(ev) {
  const now = Date.now();
  if (now - lastAt < 300) return;   // 연타 방지 — 설교 중 두 장씩 넘어가면 치명적
  lastAt = now;
  const act = actionFor(ev, { gestures: state.gestures });
  log(`${ev.name} ${JSON.stringify(ev.data)} → ${act || '무시'}`);
  if (act === 'next') go(+1);
  else if (act === 'prev') go(-1);
  else if (act === 'timer') toggleTimer();
}

main().catch((e) => log('시작 실패: ' + (e.message || JSON.stringify(e))));
