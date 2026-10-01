// 설교 HUD 핵심 로직 — DOM·SDK 없이 순수 함수만 (Node 테스트 대상)
//
// 입력은 토탈 설교 앱의 카드원고 배열 그대로다:
//   파일맵.cardArr = [{ t: 'trans'|'quote'|'ex'|'head'|'p', x: '...' }, ...]
// 한 항목 = 카드원고의 "한 줄(한 생각)". 안경 화면 한 장에 여러 줄을 담는다.

export const SCREEN = Object.freeze({
  width: 600,
  height: 350,
  marginX: 12,
  headerY: 4, headerH: 26,
  bodyY: 34, bodyH: 280,
  footerY: 318, footerH: 28,
});

// ⚠ 실기기 펌웨어 폰트는 공개 측정 도구가 없다. 시뮬레이터(17px system-ui)
//   기준으로 보수적으로 잡은 값 — 실기기에서 반드시 다시 맞출 것.
export const DEFAULT_FIT = Object.freeze({ charsPerLine: 30, maxLines: 12 });

// 한글·한자·전각 = 1칸, 그 밖(라틴·숫자·공백·문장부호) = 0.55칸
export function visualWidth(s) {
  let w = 0;
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    const wide = (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3000 && cp <= 0x9fff) ||
      (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xff00 && cp <= 0xffef);
    w += wide ? 1 : 0.55;
  }
  return w;
}

export function linesFor(text, charsPerLine) {
  return String(text).split('\n')
    .reduce((n, part) => n + Math.max(1, Math.ceil(visualWidth(part) / charsPerLine)), 0);
}

// 화면에 찍을 글 — 카드 종류를 색 대신 기호로 구분한다(단색 화면)
export function itemText(b) {
  const x = String(b.x || '').trim();
  if (b.t === 'ex') return '◆ ' + x.replace(/^ex\)\s*/, '');
  if (b.t === 'head') return '■ ' + x;
  if (b.t === 'quote') {
    // 「요 7:18, "본문"」 → 성구 표기를 한 줄로 떼어 낸다
    const m = x.match(/^([1-3]?[가-힣]{1,3}\s*\d+:\d+(?:[-–]\d+(?::\d+)?)?[a-c]?)\s*,?\s*(.*)$/);
    return m ? '‹' + m[1] + '›\n' + m[2] : x;
  }
  return x;
}

// trans 번호: "▶ 이미지 #7 전환 ◀" / "▶ 본문 이미지 #8 전환 ◀"
export function transInfo(x) {
  const m = String(x || '').match(/#\s*(\d+)/);
  return { n: m ? Number(m[1]) : null, scripture: /본문/.test(String(x || '')) };
}

// 대지 선언 / 결론 머리 판별 — 설교앱의 head 는 펀치라인("그래서 우리는…")에도 쓰이므로
// 화면을 새로 여는 것은 이 두 경우뿐이다.
const POINT_RE = /^(첫|둘|셋|넷|다섯)\s*(째|번째)|^[①-⑩]|^\d+\.\s|^(첫|두|세|네|다섯)\s*번째\s*메시지/;
const CONCL_RE = /^말씀을\s*정리/;

// 카드 배열 → 화면 배열
//   · trans(이미지 전환)에서 반드시 새 화면 — 영상 화면과 안경 화면의 박자를 맞춘다
//   · 대지 선언·결론 머리는 새 화면의 첫 줄로 — 화면 중간에 묻히지 않게
//   · 그 밖의 head(펀치라인)는 앞 문단에 붙여 흐르게 한다
//   · 화면 용량을 넘으면 다음 화면으로, 한 항목 자체가 넘치면 문장 단위로 쪼갠다
export function paginate(cards, fit = DEFAULT_FIT) {
  const { charsPerLine, maxLines } = fit;
  const screens = [];
  let cur = null;
  let pendingTrans = null;
  let section = 0;   // 0 = 서론, n = n대지, 'C' = 결론

  let at = 0;   // 지금 읽는 카드 번호 — 화면이 어느 카드에서 시작하는지 기억(보정 후 위치 유지용)
  const open = () => {
    cur = { items: [], lines: 0, trans: pendingTrans, section, start: at };
    pendingTrans = null;
    screens.push(cur);
  };
  const push = (text, kind) => {
    const need = linesFor(text, charsPerLine);
    if (!cur || (cur.items.length && cur.lines + need > maxLines)) open();
    cur.items.push({ kind, text });
    cur.lines += need;
  };

  for (const [k, b] of (cards || []).entries()) {
    at = k;
    if (!b || !String(b.x || '').trim()) continue;
    if (b.t === 'trans') { pendingTrans = transInfo(b.x); cur = null; continue; }
    const raw = String(b.x).trim();
    if (b.t === 'head' && (POINT_RE.test(raw) || CONCL_RE.test(raw))) {
      section = CONCL_RE.test(raw) ? 'C' : (typeof section === 'number' ? section + 1 : 1);
      if (cur && cur.items.length) cur = null;
      if (cur) cur.section = section;   // 전환 직후 빈 화면이면 그 화면이 곧 새 대지
    }
    const text = itemText(b);
    if (linesFor(text, charsPerLine) <= maxLines) { push(text, b.t); continue; }
    for (const piece of splitLong(text, charsPerLine, maxLines)) { cur = null; push(piece, b.t); }
  }
  return screens.map((s, i) => ({
    index: i,
    section: s.section,
    trans: s.trans,
    start: s.start,
    body: s.items.map((it) => it.text).join('\n'),
    kinds: s.items.map((it) => it.kind),
  }));
}

function splitLong(text, charsPerLine, maxLines) {
  const sentences = String(text).match(/[^.!?。…]+[.!?。…]*\s*/g) || [text];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && linesFor(buf + s, charsPerLine) > maxLines) { out.push(buf.trim()); buf = ''; }
    buf += s;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

// 진행 막대 — 유니코드 블록 문자(단색 화면)
export function progressBar(i, n, width = 24) {
  if (n <= 1) return '━'.repeat(width);
  const filled = Math.round(((i + 1) / n) * width);
  return '━'.repeat(filled) + '─'.repeat(width - filled);
}

const CIRCLED = '⓪①②③④⑤⑥⑦⑧⑨⑩';

// 머리말: "② 대지  ▶#07         12:34 / 30:00"
export function headerText(screen, elapsedSec, targetMin) {
  const left = [
    screen.section === 'C' ? '결론' : screen.section ? CIRCLED[screen.section] + ' 대지' : '서론',
    screen.trans && screen.trans.n ? (screen.trans.scripture ? '▶본문#' : '▶#') + String(screen.trans.n).padStart(2, '0') : '',
  ].filter(Boolean).join('  ');
  const right = fmtClock(elapsedSec) + (targetMin ? ' / ' + fmtClock(targetMin * 60) : '');
  return left + '      ' + right;
}

export function footerText(i, n) {
  return progressBar(i, n) + '  ' + (i + 1) + '/' + n;
}

// 강단에서 고개를 끄덕이는 것은 자연스러운 동작이라 제스처 넘김은 기본 꺼둔다
export function actionFor(event, opts = { gestures: false }) {
  if (event.name === 'device.button') {
    return { single: 'next', double: 'prev', long: 'timer' }[event.data && event.data.action] || null;
  }
  if (event.name === 'device.imuGesture' && opts.gestures) {
    const g = event.data && event.data.active !== false && event.data.gesture;
    return { right: 'next', left: 'prev' }[g] || null;
  }
  return null;
}

// 설교앱에서 붙여 넣은 JSON을 받아들인다:
//   ① cardArr 그대로  [{t,x}, ...]
//   ② { title, ref, targetMin, cards: [{t,x}, ...] }
export function normalizeDeck(input) {
  const v = typeof input === 'string' ? JSON.parse(input) : input;
  const cards = Array.isArray(v) ? v : v && v.cards;
  if (!Array.isArray(cards) || !cards.length) throw new Error('카드 배열이 비어 있습니다');
  const okT = new Set(['trans', 'quote', 'ex', 'head', 'p']);
  const clean = cards.filter((b) => b && okT.has(b.t) && typeof b.x === 'string');
  if (!clean.length) throw new Error('t·x 형식의 카드가 없습니다');
  return {
    title: (v && !Array.isArray(v) && v.title) || '설교',
    ref: (v && !Array.isArray(v) && v.ref) || '',
    targetMin: Number((v && !Array.isArray(v) && v.targetMin) || 30),
    cards: clean,
  };
}

// 보정값을 바꿔 화면을 다시 나눈 뒤, 보던 카드가 들어 있는 화면을 찾는다
export function screenForCard(screens, cardIndex) {
  let best = 0;
  for (const sc of screens) if (sc.start <= cardIndex) best = sc.index;
  return best;
}

export function clampFit(fit) {
  const n = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  return {
    charsPerLine: n(fit && fit.charsPerLine, 12, 60, DEFAULT_FIT.charsPerLine),
    maxLines: n(fit && fit.maxLines, 3, 20, DEFAULT_FIT.maxLines),
  };
}
