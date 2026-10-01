// 샘플 설교(수 1:5-9) 카드 배열 생성 — 성구는 저장소의 bible/b06.json 에서 직접 읽는다.
// 실제 사용 때는 이 파일 대신 설교앱의 파일맵.cardArr 를 붙여 넣는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const josh = JSON.parse(readFileSync(join(here, '../../../bible/b06.json'), 'utf8')).chapters[0];
const v = (n) => josh[n - 1];

const cards = [
  { t: 'trans', x: '▶ 이미지 #2 전환 ◀' },
  { t: 'p', x: '여러분, 새로운 출발 앞에 서 보신 적 있으십니까.' },
  { t: 'p', x: '익숙한 자리를 떠나 아무도 가 보지 않은 길로 들어서야 할 때, 우리 마음은 이렇게 묻습니다. "내가 정말 해낼 수 있을까?"' },
  { t: 'head', x: '오늘 하나님은 그 질문에 답을 주십니다.' },
  { t: 'trans', x: '▶ 본문 이미지 #3 전환 ◀' },
  { t: 'quote', x: '수 1:5, "' + v(5) + '"' },
  { t: 'trans', x: '▶ 이미지 #4 전환 ◀' },
  { t: 'head', x: '첫째, 하나님은 능력이 아니라 임재를 약속하십니다.' },
  { t: 'p', x: '하나님은 여호수아에게 새로운 능력을 주겠다고 말씀하지 않으셨습니다.' },
  { t: 'p', x: '"내가 너와 함께 있을 것이다." 이 한 마디였습니다.' },
  { t: 'head', x: '능력의 약속이 아니라 임재의 약속입니다.' },
  { t: 'ex', x: 'ex) 아무것도 가져가지 말게' },
  { t: 'p', x: '한 선교사가 오지로 떠나기 전날 밤, 후원 교회 목사님께 편지를 썼습니다. "무엇을 가지고 가야 할지 모르겠습니다." 목사님은 짧게 답장하셨습니다. "아무것도 가져가지 말게. 다만 하나님을 모시고 가게." 그 한 줄이 그를 삼십 년 동안 버티게 했습니다.' },
  { t: 'head', x: '그래서 우리는 무엇을 쥐었는지보다 누구와 함께 가는지를 먼저 묻습니다.' },
  { t: 'trans', x: '▶ 본문 이미지 #5 전환 ◀' },
  { t: 'quote', x: '수 1:9, "' + v(9) + '"' },
  { t: 'trans', x: '▶ 이미지 #6 전환 ◀' },
  { t: 'head', x: '둘째, 담대함은 감정이 아니라 순종입니다.' },
  { t: 'p', x: '하나님은 "담대한 마음이 들면 가라"고 하지 않으셨습니다. "강하고 담대하라"고 명령하셨습니다.' },
  { t: 'p', x: '두려움이 사라진 다음에 걷는 것이 아니라, 두려운 채로 한 걸음을 내딛는 것. 그것이 성경이 말하는 담대함입니다.' },
  { t: 'head', x: '그래서 우리는 확신을 기다리지 않고 순종으로 걸음을 뗍니다.' },
  { t: 'trans', x: '▶ 이미지 #7 전환 ◀' },
  { t: 'head', x: '말씀을 정리합니다.' },
  { t: 'p', x: '오늘 여러분의 자리에서 붙들어야 할 것은 내 능력이 아니라 함께하시는 하나님이십니다.' },
  { t: 'head', x: '두려운 채로, 그러나 함께 걸어갑시다.' },
];

const deck = { title: '강하고 담대하라', ref: '수 1:5-9', targetMin: 30, cards };
writeFileSync(join(here, '../src/sample-deck.js'),
  '// 자동 생성: node tools/make-sample.mjs (성구 출처: bible/b06.json)\nexport const SAMPLE_DECK = ' +
  JSON.stringify(deck, null, 1) + ';\n');
console.log('카드', cards.length, '개 → src/sample-deck.js');
