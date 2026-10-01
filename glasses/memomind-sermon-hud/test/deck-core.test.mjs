import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paginate, linesFor, screenForCard, clampFit, itemText, transInfo, headerText, footerText, actionFor, normalizeDeck, fmtClock, DEFAULT_FIT,
} from '../src/deck-core.js';
import { SAMPLE_DECK } from '../src/sample-deck.js';

test('이미지 전환(trans)마다 새 화면이 시작되고 컷 번호를 물려받는다', () => {
  const s = paginate([
    { t: 'trans', x: '▶ 이미지 #2 전환 ◀' }, { t: 'p', x: '가' },
    { t: 'trans', x: '▶ 본문 이미지 #3 전환 ◀' }, { t: 'quote', x: '수 1:9, "강하고 담대하라"' },
  ]);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].trans, { n: 2, scripture: false });
  assert.deepEqual(s[1].trans, { n: 3, scripture: true });
});

test('전환 바 자체는 화면에 글로 찍히지 않는다', () => {
  const s = paginate([{ t: 'trans', x: '▶ 이미지 #2 전환 ◀' }, { t: 'p', x: '본문' }]);
  assert.ok(!s[0].body.includes('전환'));
});

test('대지 선언은 화면 맨 위에서 시작하고 대지 번호가 올라간다', () => {
  const s = paginate([
    { t: 'p', x: '서론' },
    { t: 'head', x: '첫째, 하나님은 임재를 약속하십니다.' }, { t: 'p', x: '설명' },
    { t: 'head', x: '둘째, 담대함은 순종입니다.' },
    { t: 'head', x: '말씀을 정리합니다.' },
  ]);
  assert.equal(s.length, 4);
  assert.deepEqual(s.map((x) => x.section), [0, 1, 2, 'C']);
  assert.ok(s[1].body.startsWith('■ 첫째'));
});

test('펀치라인 head 는 새 화면을 열지 않고 앞 문단에 붙는다', () => {
  const s = paginate([
    { t: 'p', x: '두려운 채로 한 걸음을 내딛는 것입니다.' },
    { t: 'head', x: '그래서 우리는 순종으로 걸음을 뗍니다.' },
  ]);
  assert.equal(s.length, 1);
});

test('성구는 표기와 본문을 두 줄로 나눈다', () => {
  assert.equal(itemText({ t: 'quote', x: '요 7:18, "스스로 말하는 자는"' }), '‹요 7:18›\n"스스로 말하는 자는"');
  assert.equal(itemText({ t: 'quote', x: '고전 13:4-7, "사랑은"' }), '‹고전 13:4-7›\n"사랑은"');
});

test('예화는 ex) 대신 ◆ 기호로 표시한다', () => {
  assert.equal(itemText({ t: 'ex', x: 'ex) 아무것도 가져가지 말게' }), '◆ 아무것도 가져가지 말게');
});

test('어떤 화면도 정해진 줄 수를 넘지 않는다', () => {
  const long = '가나다라마바사아자차. '.repeat(60);
  const s = paginate([{ t: 'p', x: long }, { t: 'p', x: '끝' }]);
  assert.ok(s.length > 1);
  for (const sc of s) assert.ok(linesFor(sc.body, DEFAULT_FIT.charsPerLine) <= DEFAULT_FIT.maxLines, sc.body.length);
});

test('샘플 설교: 성구 전문이 잘리지 않고 화면 하나에 온전히 들어간다', () => {
  const deck = normalizeDeck(SAMPLE_DECK);
  const s = paginate(deck.cards);
  for (const q of deck.cards.filter((c) => c.t === 'quote')) {
    const verse = q.x.slice(q.x.indexOf('"'));
    assert.equal(s.filter((x) => x.body.includes(verse)).length, 1, verse.slice(0, 20));
  }
  assert.ok(s.every((x) => x.body.split('\n').length > 1 || x.body.length > 25), '한 줄짜리 자투리 화면이 없어야 한다');
});

test('머리말·꼬리말 형식', () => {
  assert.equal(headerText({ section: 2, trans: { n: 7, scripture: false } }, 754, 30), '② 대지  ▶#07      12:34 / 30:00');
  assert.equal(headerText({ section: 0, trans: { n: 3, scripture: true } }, 5, 0), '서론  ▶본문#03      00:05');
  assert.equal(headerText({ section: 'C', trans: null }, 0, 0), '결론      00:00');
  assert.match(footerText(0, 4), /^━+─+  1\/4$/);
  assert.equal(fmtClock(3599), '59:59');
});

test('버튼: 한 번=다음, 두 번=이전, 길게=타이머', () => {
  const b = (action) => actionFor({ name: 'device.button', data: { action } });
  assert.equal(b('single'), 'next');
  assert.equal(b('double'), 'prev');
  assert.equal(b('long'), 'timer');
});

test('고개 제스처는 기본 꺼짐 — 설교 중 끄덕임으로 넘어가지 않게', () => {
  const ev = { name: 'device.imuGesture', data: { gesture: 'right', active: true } };
  assert.equal(actionFor(ev), null);
  assert.equal(actionFor(ev, { gestures: true }), 'next');
  assert.equal(actionFor({ name: 'device.imuGesture', data: { gesture: 'nod', active: true } }, { gestures: true }), null);
});

test('설교앱 cardArr 를 그대로 받고, 잘못된 입력은 거절한다', () => {
  const d = normalizeDeck('[{"t":"head","x":"가"},{"t":"zzz","x":"버림"}]');
  assert.equal(d.cards.length, 1);
  assert.throws(() => normalizeDeck('[]'));
  assert.throws(() => normalizeDeck('{"cards":[{"t":"zzz","x":"a"}]}'));
});

test('trans 번호 파싱', () => {
  assert.deepEqual(transInfo('▶ 본문 이미지 #12 전환 ◀'), { n: 12, scripture: true });
  assert.deepEqual(transInfo('▶ 전환 ◀'), { n: null, scripture: false });
});

test('보정값을 바꿔도 보던 카드가 들어 있는 화면으로 돌아온다', () => {
  const deck = normalizeDeck(SAMPLE_DECK);
  const before = paginate(deck.cards, { charsPerLine: 30, maxLines: 12 });
  const card = before[4].start;
  const after = paginate(deck.cards, { charsPerLine: 18, maxLines: 6 });
  const j = screenForCard(after, card);
  assert.ok(after[j].start <= card && (j === after.length - 1 || after[j + 1].start > card));
});

test('보정값은 안전 범위로 묶인다', () => {
  assert.deepEqual(clampFit({ charsPerLine: 999, maxLines: 0 }), { charsPerLine: 60, maxLines: 3 });
  assert.deepEqual(clampFit({ charsPerLine: 'x' }), DEFAULT_FIT);
});
