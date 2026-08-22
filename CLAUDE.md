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
  → 템플릿이나 역할 지도를 고치면 **앱·스킬 양쪽을 함께** 고칠 것.
- **전환 표시 PDF (v529)**: 전환표시본과 같은 본문·전환표에 「배경 이미지 생성」으로 만든 그림을 각 전환 바 아래에 참고 썸네일로 끼워 PDF로 조판한다(`tpdfImgMap`/`tpdfBlocks`/`buildTransPdfBlob`/`saveTransPdf`, 캐스케이드 키 `transpdf`). hwpx가 아니라 html2canvas+jsPDF로 만들지만 용지·여백·색은 hwpx 전환표시본과 같은 규격(216×290mm·여백 10mm·12pt·바 #EE0000). 이미지는 저장된 백스테이지 zip(NN.png)에서 읽으며, 없으면 만들지 않고 안내한다.
- DOCX 생성 코드는 그대로 두었다. 설정 → 도구 → **산출물 파일 형식**에서 DOCX로 되돌릴 수 있다.
- 되읽기(카드원고 추출·LTC 되읽기·드래그 가져오기·폴더 스캔)는 `zipDocParas()` 가 docx·hwpx 를 모두 처리한다(옛 docx 파일도 계속 인식).
