# CLAUDE.md — 토탈 설교 앱 (작업 메모리)

이 폴더(`total-sermon-web`)는 **정적 PWA "토탈 설교 앱"**의 배포 저장소다.
- 앱 본체: `index.html`(단일 파일, 메인 로직은 끝부분 큰 IIFE) · 서비스워커 `sw.js`.
- 백엔드: 구글시트 Apps Script 웹앱(`Code.gs`, 이 저장소가 아니라 `Dropbox/total-sermon/apps-script/Code.gs`에 보관). 델타 동기화(변경분만, `ID` 기준 멱등 upsert + 삭제로그 툼스톤).
- 로컬 저장: 설정·대기열·테마는 localStorage, 대용량 데이터(`data`)·`syncAt`·`seriesList`·`composeDraft`는 IndexedDB(`tsa`/`kv`).
- 자동 커밋·푸시 워처가 이 폴더에서 돌며 origin/main에 푸시 → 배포된다.
- 예화 데이터: `illustrations.json`(마스터색인 변환본, `total-sermon/tools/build_illustrations_json.py`로 재생성) + `illustrations-archive.json`(과거 원고 ex) 블록 스냅샷 — 예화 도서관 「내가 쓴 예화」 소스, 기기 보유 원고는 앱이 실시간 추출·대체). 상세: `Dropbox/total-sermon/docs/예화아카이브_통합_20260712.md`.
- **예화 샤드(v444+)**: 앱은 부팅 때 `ill-index.json`(story·sourceNote·source 제외 색인)만 파싱하고, 전문은 `ill-story-NN.<해시8>.json` 샤드로 백그라운드 병합(`illustLoad`/`illEnsureStories`/`illustLoadFull`). **illustrations.json 을 갱신하면 반드시 샤드도 재생성** — `build_illustrations_json.py`가 끝에서 자동 호출하며, 수동으로는 `python3 total-sermon/tools/build_ill_shards.py <illustrations.json 경로>`. illustrations.json 자체는 성경앱(CORS)·폴백용으로 계속 배포한다. 옛 해시 샤드는 생성기가 지우고, 기기 캐시는 앱이 청소.

## ⚠ 버전 규칙 (앱 코드 수정 시 항상 지킬 것)

앱 코드(`index.html`/`sw.js` 등)를 수정하면 **두 버전 번호를 항상 같은 값으로 함께 +1** 한다.

1. `sw.js` 의 `var CACHE = 'tsa-vNNN';`  — 서비스워커 캐시 무효화(새 코드 반영).
2. `index.html` 의 `var APP_VER = 'vNNN';` — 메뉴 하단 "앱 버전" 표시값.

→ 둘이 어긋나면(예: 캐시 v235 / 표시 v234) 실제 배포 버전을 화면으로 확인할 수 없다. **둘은 항상 동일 번호**여야 한다. 한쪽만 올리지 말 것.

## 요약본 두 종류 — `요약본` / `실제요약본` (v519+)

- **`요약본`** = 준비한 원고를 요약한 것(설교 상세 → 요약본·주제어).
- **`실제요약본`** = 유튜브 영상(실제로 선포한 설교)을 전사해 요약한 것. 서로 덮어쓰지 않는다.
- 밖으로 내보낼 때(성경앱 [설교] 노트·옵시디언·카드뉴스·공유·상태 배지)는 헬퍼 **`sumText(s)`**(=`실제요약본 || 요약본`)를 쓴다. 새 코드에서 `s['요약본']`을 직접 읽지 말 것.
- 시트 컬럼 `실제요약본`은 `SERMON_HEADERS` 맨 끝에 추가돼 있다 → **Apps Script `setup` 재실행 필요**.
- 유튜브 전사는 **앱에서 Gemini를 직접 호출**한다(설정 → Gemini API 키). 워커에서 부르면 `User location is not supported` 지역 차단이 나기 때문. 링크는 표준 `watch?v=` 형태로 정규화하고, 요청은 항상 10분 창으로 잘라 병렬 호출한다(통짜 요청은 500).

## 작성초안(`__작성초안__`) 우선순위 — v539+

미저장 작성 버퍼는 `시리즈초안` 시트의 예약행 1개(`__작성초안__`)로 기기 간에 오간다. **같은 설교 ID면 그 ID의 최종 저장본(설교 행 `수정일`)이 초안보다 우선**이다.
- `_cdraftAbsorbed(snap)` — 초안이 기반한 설교 행의 `수정일 ≥ snap.at + 2분`이면 "이미 저장에 흡수된 옛 초안"으로 보고 제안하지 않고 그 행을 지운다. 2분 여유는 기기 시계와 시트 서버 시각의 오차 때문(오판으로 흡수 처리하면 다른 기기의 미저장 원고가 사라지므로 보수적으로).
- `maybeOfferRemoteComposeDraft` — 예전엔 초안끼리만(`local.at` vs `snap.at`) 비교해서, 저장을 마쳐 로컬 초안이 빈 기기에서 옛 원격 초안이 항상 이기고 **최종본 이전 내용이 작성창을 덮어썼다**(2026-08-26 사례). 지금은 위 게이트를 통과한 초안만 배너로 제안하고, 배너에 초안 시각·시트 최종 저장 시각을 함께 보여 주며 **[최종 저장본 열기] / [초안 불러오기] / [무시]** 3지선다를 준다.
- `clearComposeDraft(true)`(저장 완료 시) → `dropComposeDraftRemote(true)` → `_sweepComposeDraftRemote()` — 로컬 캐시에 없는(아직 델타로 못 받은) 다른 기기 초안 행까지 시트에서 직접 받아 정리한다. 이 정리를 안 하면 그 행이 살아남아 나중에 되살아난다. 흡수되지 않은 진짜 미저장 초안은 건드리지 않는다.

## 산출물 파일명 — 시리즈 회차 번호 (v540)

파일명은 `sermonFileBase(meta, type)` 하나가 만든다: `YYYYMMDD 원고형태_예배구분_시리즈명+회차_제목_본문`.
- 회차 번호의 **정본은 별도 필드 `시리즈순번`**(입력칸 `#c_seriesNo`)이다. v539까지는 이 함수가 `시리즈` 문자열 끝의 숫자만 찾아서, 정상 입력(시리즈="요한복음" / 시리즈순번="3")이면 **번호가 통째로 빠진 파일명**이 나왔다. 지금은 `seriesTag(meta)`가 ①시리즈명 끝의 숫자(옛 입력 방식) ②`시리즈순번` 순으로 쓴다.
- **저장은 새 이름 하나로만**, **되읽기는 새·옛 이름 둘 다** 본다(`sermonFileBases`/`sermonFileNames`/`_nfcEqAny`/`_nfcInclAny`, `imgDataNames().jsonAlts·transAlts·backstagePrefixes`). 이 폴백을 지우면 v540 이전에 만든 **전환표·컷 사이드카·백스테이지 zip을 못 찾아 전환표가 새로 생성**되고 이미지 번호가 어긋난다.
- `docxFileName`(리더스앱 txt·폴더스캔 base)과 `ltcFileName`(LTC 교재)은 원래 시리즈를 넣지 않는 별도 규칙 — 건드리지 말 것.

## 검증 게이트 · 회중 반응 — v548

외부 설교 스킬 묶음(`cys-claude-sermon-skills`) 검토(`Dropbox/total-sermon/docs/외부설교스킬_검토_20260902.html`)에서 가져온 것들. 핵심 발상은 **AI가 쓴 답을 다시 AI에게 검사시키지 않고, 앱이 이미 가진 확정 데이터와 기계적으로 대조**하는 것이다.

- **성경 참조 실재성** — `VERSE_COUNTS_RAW`(66권 장별 절 수, 16진·약 3.3KB 상수) + `refAudit(text)` / `refAuditBare(list, bookIdx)` / `refAuditHtml()`. fetch 없이 즉시 판정한다. 자동 검사 지점: 본문연구 「AI 정리」(상호본문·클라이맥스·단락 범위), 「강해 검증」의 근거절, **완성 원고를 받은 직후**(`aiManuscript`). 수동은 작성 화면 [📕 성경 참조 전체 검증](`auditComposeRefs`).
  → ⚠ **`bible/bNN.json` 을 교체하면 이 표도 다시 뽑을 것.** 생성 명령은 `VERSE_COUNTS_RAW` 위 주석에 있다.
  → 오탐 방지: 절(`장:절`)이 있는 표기만 검사하고, 앞 글자가 한글·영문·숫자면(“그렇지요 3:16”) 건너뛴다.
- **사본 경계 본문 경고** — `MSS_DISPUTED`(막 16:9-20, 요 7:53-8:11, 요일 5:7-8 등 15곳) + `mssWarnFor()`. 작성 화면 본문칸 아래(`#c_mssWarn`, `renderMssWarn`)와 본문연구 창 머리(`#stMss`, `openStudy`)에 뜬다.
- **선택지 5결 매트릭스** — `MSG_DIVERSITY_RULE` 을 `P_SERMON`·`P_OCC`·`P_TOPIC`·`P_DAWN` 끝에 부착(`METAPHOR_AXIS_RULE` 뒤). 선택지가 서로 다른 결(신학명제/실천권면/내러티브/실존진단/종말소망)에서 나오게 하고, 핵심메시지 25~45자·추상명사 나열 금지를 함께 건다.
- **찬송 번호 대조** — `hymnFixSync()` 가 `sanitizeHymns()` 안에서 성경앱 645장 목록과 맞춘다. **사용자 입력용 `hymnResolve` 와 우선순위가 반대다** — 모델은 곡명이 정확하고 번호를 자주 틀리므로 여기서는 곡명 우선, 목록에 없는 번호는 떼어 낸다. 호출 전에 `await studyLoadHymns()` 로 목록을 확보해 둔다(목록이 없으면 손대지 않는다).
- **흔한 오용** — `MISUSE_RULE` 을 `P_STUDYSYN` 에 부착하고 출력 JSON에 `흔한오용[]`(주장·유형·바로잡기) 추가 → `renderStudyAi` 의 「⚠ 이 본문의 흔한 오용」.
- **회중 반응 시뮬레이션** — `PERSONAS_ADULT`(전체 회중 8인)·`PERSONAS_YOUTH`(대학부 8인) 두 벌 + `P_PERSONA` + `aiPersona(kind)` / `renderPersona`. 「강해 검증」이 *원고가 본문에 맞는가*를 보는 데 비해 이건 *누가 어떻게 듣는가*를 본다. 페르소나 목록이 **유일한 발화 근거**이고, 페르소나끼리 대화 금지·신학 수준 초과 발화 금지·없는 일화 창작 금지를 프롬프트에서 못 박는다. 페르소나를 고치려면 두 배열만 손대면 된다.

## 집중모드 본문 열 좌우 이동 — v549

모니터 두 대를 쓰면 브라우저가 놓인 화면이 시선에서 비껴 있어, 그 화면 "가운데"의 본문을 보려고 고개를 계속 돌려야 한다. 그래서 집중모드 본문 열을 좌우로 옮길 수 있게 했다.

- **`--fmShiftX`(CSS 변수) + `body.focusMode #editorPane{position:relative;left:var(--fmShiftX,0px)}`.
  ⚠ `transform` 은 쓰지 말 것** — 진입·종료 FLIP 애니메이션(`fmFlip`)이 `#editorPane` 의 `transform` 을 인라인으로 쓴다. 둘이 겹치면 전환이 깨진다.
- 조작 셋: 툴바 `◀ ⊙ ▶`(`data-act="shiftL/shiftMid/shiftR"`, `.fbPos`) · 빈 여백 마우스 드래그(더블클릭=가운데) · `⌃⌥←`/`⌃⌥→`/`⌃⌥0`.
  → 단축키에 `⌥←/⌥→` 단독을 쓰지 않은 이유: macOS에서 **단어 단위 커서 이동**이라 타이핑을 방해한다.
  → 드래그는 **pointer 가 아니라 mouse 이벤트**다. `mousedown` 의 `preventDefault` 는 선택·포커스 이동만 막고 `click`·`dblclick` 은 그대로 흘려보내, "끌어서 옮기기"와 "더블클릭해서 가운데로"가 함께 동작한다(pointerdown 에서 막으면 브라우저마다 뒤따르는 마우스 이벤트가 갈린다). 마우스 전용이라 아이패드 스크롤 제스처는 건드리지 않는다.
- 함수: `fmShiftMax()`(열이 화면 밖으로 안 나가는 한계 = 좌우 여백) · `fmApplyShift(px, save)` · `fmCurShift()` · `fmNudgeShift(d)`. 값은 `localStorage['tsa.fmShiftX']` 에 **기기별로** 둔다(사무실·집의 화면 배치가 다르므로).
- 창을 좁히면 `resize` 에서 다시 가두되 **저장값은 건드리지 않는다** — 넓은 화면으로 돌아오면 원래 위치가 복원된다. 복원은 `fmRestorePrefs()` 안에서.
- 툴바의 위치 버튼은 `@media (max-width:900px)` 에서 숨긴다(옮길 여백이 없는 화면에선 의미가 없다).

## 작업 규칙
- 앱 코드 변경 후: 인라인 `<script>` 블록 문법 재검사(현재 3블록) + 위 두 버전 +1. 한 번에 확인하려면 `bash Dropbox/total-sermon/tools/smoke.sh`(문법+버전일치+샤드 정합). 백업 정리는 `tools/cleanup_baks.sh`(종류별 최근 5개 유지).
- 큰 변경 전 `index.html.bak-*` 백업 생성(`.gitignore`로 추적 제외됨).
- 백엔드(`Code.gs`) 변경은 수동 반영: 구글시트 → 확장 → Apps Script에 전체 붙여넣기 → `setup` 실행 → 배포 관리에서 기존 웹앱 **"새 버전"**으로(URL 유지).
- 멀티기기 동기화 설계·문제·해결책은 `Dropbox/total-sermon/docs/멀티기기_사용문제_진단_20260623.md` 참고.

## ⚠ 자동 커밋·푸시 워처 — 이 저장소에 git 명령을 직접 돌리지 말 것 (중요)

이 폴더에는 **맥에서 자동 커밋·푸시 워처가 상시** 돌며 변경을 origin/main에 푸시 → 배포한다. 이 워처가 인덱스(`.git/index`)를 수시로 건드린다.

**작업 지침(반드시 지킬 것):**
- 코드 변경은 **파일 편집(Read/Write/Edit)만** 한다. 커밋·푸시는 **워처에 맡긴다.** 굳이 즉시 올려야 하면 *사용자에게* 수동 `git add/commit/push`를 안내한다(에이전트가 샌드박스에서 직접 돌리지 않는다).
- **에이전트는 이 저장소에서 git 명령(`status`/`add`/`commit`/`reset`/`rev-list`/`fetch` 등 인덱스·refs를 건드리는 것)을 샌드박스 bash로 실행하지 않는다.** 이유: 워처와 동시에 실행되면 인덱스 잠금 충돌이 나고, 샌드박스↔맥 마운트가 파일 삭제(unlink)를 막아 `git`이 자기 `.git/index.lock`을 못 지운다 → **고아 잠금이 남아 워처의 자동 커밋이 영구히 멈춘다.**
- 배포 반영 여부·버전 확인은 git 대신 **파일 내용으로** 확인한다(예: `grep "var APP_VER" index.html`, 코드 식별자 grep, 파일 diff). 원격 상태가 정말 필요하면 사용자에게 물어본다.

**증상과 복구:** 변경이 origin에 안 올라가고 자동 푸시가 멈춘 듯하면 십중팔구 **stale `.git/index.lock`**이다. 맥 터미널에서 `rm -f .git/index.lock` 한 번이면 워처가 재개된다. (이 잠금 파일 자체는 정상이며 평소엔 git이 만들고 즉시 지운다 — 워처 단독 동작 시엔 문제 없음. 고아 잠금은 에이전트가 샌드박스 git을 끼어 돌렸을 때만 발생했다.)

## HWPX(한글) 산출물 — v493+

앱은 원고·카드원고·LTC 교재·설교계획·이미지자료·전환표시본을 **hwpx로 직접 생성**한다(기본값).
- 껍데기 템플릿: `total-sermon-web/hwpx/templates/{manuscript,dawn,card,ltc,plan}.hwpx`
  = 목사님 실제 원고에서 본문만 비운 파일. 용지·여백·글꼴·색·표 서식이 그 안 header.xml(charPr/paraPr/borderFill)에 확정돼 있다.
- 앱 코드: `index.html` 의 `HWPX_TYPES`(역할→ID 지도) + `hwpxBuild()`. **새 서식을 만들지 않고** 역할 ID로 문단만 찍는다.
- 같은 템플릿·같은 지도를 Cowork 스킬 **hwpx-sermon-docs** 도 쓴다(`hwpx/build_hwpx.py`, `hwpx/hwpx_types.json`).
  → 템플릿이나 역할 지도를 고치면 **앱·스킬 양쪽을 함께** 고칠 것. 템플릿은 두 벌
  (`total-sermon-web/hwpx/templates/`, `Dropbox/total-sermon/hwpx/templates/`)이므로 항상 같이 갱신한다.
- **템플릿의 `Preview/PrvImage.png` (v546, 2026-08-31)**: hwpx 안의 이 그림이 곧 macOS Finder 의 문서
  썸네일이다. 예전 껍데기에는 1×1 짜리 **반투명 초록 픽셀**(RGBA 0,255,0,127)이 들어 있어, 그 1픽셀이
  아이콘 크기로 확대되며 앱이 만든 hwpx 가 전부 **초록색 박스**로 보였다(파일·열기 자체는 정상).
  5종 템플릿 모두 210×297 흰 종이 PNG 로 교체했다. **앞으로 템플릿을 새로 뜰 때 이 1×1 스텁이 다시
  들어가지 않게 확인할 것.** 이미 만들어진 파일은 `total-sermon/tools/fix_hwpx_preview.py <폴더>` 로 일괄 교정
  (1×1 짜리만 골라 바꾸므로 한글이 저장한 진짜 미리보기는 건드리지 않는다). Finder 아이콘이 그대로면
  `qlmanage -r cache && killall Finder`.
- **전환 표시 PDF (v529, v530에서 썸네일 축소)**: 전환표시본과 같은 본문·전환표에 「배경 이미지 생성」으로 만든 그림을 각 전환 바 오른쪽 끝에 작은 참고 썸네일(본문 폭 21%)로 겹쳐 올려 PDF로 조판한다(음수 여백 flex — 그림 때문에 쪽수가 늘지 않게)(`tpdfImgMap`/`tpdfBlocks`/`buildTransPdfBlob`/`saveTransPdf`, 캐스케이드 키 `transpdf`). hwpx가 아니라 html2canvas+jsPDF로 만들지만 용지·여백·색은 hwpx 전환표시본과 같은 규격(216×290mm·여백 10mm·12pt·바 #EE0000). 이미지는 저장된 백스테이지 zip(NN.png)에서 읽으며, 없으면 만들지 않고 안내한다.
- **전환 표시 PDF의 보이지 않는 텍스트층 (v534)**: 페이지 래스터 위에 `renderingMode:'invisible'` 로 같은 글자를 같은 자리에 얹어, 아이패드 PDF 뷰어에서 하이라이트·밑줄·검색·복사가 되게 한다(스캔본 OCR과 같은 원리, 보이는 조판은 불변). 줄 위치는 `tpdfLineBoxes()` 가 DOM Range 로 글자마다 측정해 줄 단위로 묶고, `tpdfDrawTextLayer()` 가 px→mm 로 환산해 찍는다(자간은 charSpace 로 실제 폭에 맞춤, 글자폭 40% 초과 보정은 무시). 글꼴은 `fonts/pdf-text-layer-ko.ttf` — Noto Serif KR 한글 전체를 서브셋한 뒤 **외곽선을 지우고 자폭(hmtx)·cmap 만 남긴 220KB** 파일(보이지 않으니 모양 불필요 → PDF 용량 부담 최소). 없으면 텍스트층만 건너뛰고 예전처럼 만든다.
- **원고 수정 반영 — 전환표 재정렬 (v532)**: 산출물을 다 만든 뒤 원고 문장을 고쳤을 때, 전환표를 새로 만들지 않고 **컷 번호·개수·순서는 그대로 둔 채 앵커만 새 원고 문단에 다시 붙인다**(이미 만든 배경 이미지를 그대로 씀). 순서를 지키면서 전체 유사도 합이 최대가 되는 배치를 동적계획법으로 찾고(`retransMatch`), 전환 바 삽입은 AI 없이 로컬로 한다(`retransBody`). 진입점 넷 — ⓪**`ensureTransTable`(v533, 가장 중요)**: 표가 이미 있고 원고 서명만 달라졌으면 **AI로 새 표를 만들지 않고 재정렬**한다(예전엔 여기서 새 표가 나와 대지 선언 컷이 사라지고 번호가 한 칸씩 밀려 이미지와 어긋났다). 재정렬 실패분이 34%를 넘을 때만 새 표를 만들고, `force`([전환표 다시 잡기]·[다시 생성])는 그대로 새 표. 재정렬했으면 `window._transRealigned`로 컷 사이드카도 묻지 않고 같이 맞춘다 ①[♻ 원고 수정 반영] 버튼(`btnRetrans`→`applyRetrans`: 전환표·컷 사이드카 갱신 → 전환표시본 → 전환 PDF) ②컷 사이드카가 낡았을 때 뜨는 3지선다(`askCutsStale`, 기본값 "위치만 다시 맞추기") ③`ensureTransBody`가 옛 전환표시본을 재사용하기 전 신선도 검사(`transBodyFresh`·파일맵 `transBodySig`) — 문장이 하나라도 다르면 재사용하지 않고 재정렬한다. 앵커 단락이 삭제됐거나 유사도가 낮은 컷은 `weak`로 보고(같은 자리 겹침 허용 — 뒤 컷이 줄줄이 밀리지 않게).
- DOCX 생성 코드는 그대로 두었다. 설정 → 도구 → **산출물 파일 형식**에서 DOCX로 되돌릴 수 있다.
- 되읽기(카드원고 추출·LTC 되읽기·드래그 가져오기·폴더 스캔)는 `zipDocParas()` 가 docx·hwpx 를 모두 처리한다(옛 docx 파일도 계속 인식).
