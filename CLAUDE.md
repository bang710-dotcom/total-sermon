# CLAUDE.md — 토탈 설교 앱 (작업 메모리)

이 폴더(`total-sermon-web`)는 **정적 PWA "토탈 설교 앱"**의 배포 저장소다.
- 앱 본체: `index.html`(단일 파일, 메인 로직은 끝부분 큰 IIFE) · 서비스워커 `sw.js`.
- 백엔드: 구글시트 Apps Script 웹앱(`Code.gs`, 이 저장소가 아니라 `Dropbox/total-sermon/apps-script/Code.gs`에 보관). 델타 동기화(변경분만, `ID` 기준 멱등 upsert + 삭제로그 툼스톤).
- 로컬 저장: 설정·대기열·테마는 localStorage, 대용량 데이터(`data`)·`syncAt`·`seriesList`·`composeDraft`는 IndexedDB(`tsa`/`kv`).
- 자동 커밋·푸시 워처가 이 폴더에서 돌며 origin/main에 푸시 → 배포된다.
- 예화 데이터: `illustrations.json`(마스터색인 변환본, `total-sermon/tools/build_illustrations_json.py`로 재생성) + `illustrations-archive.json`(과거 원고 ex) 블록 스냅샷 — 예화 도서관 「내가 쓴 예화」 소스, 기기 보유 원고는 앱이 실시간 추출·대체). 상세: `Dropbox/total-sermon/docs/예화아카이브_통합_20260712.md`.

## ⚠ 버전 규칙 (앱 코드 수정 시 항상 지킬 것)

앱 코드(`index.html`/`sw.js` 등)를 수정하면 **두 버전 번호를 항상 같은 값으로 함께 +1** 한다.

1. `sw.js` 의 `var CACHE = 'tsa-vNNN';`  — 서비스워커 캐시 무효화(새 코드 반영).
2. `index.html` 의 `var APP_VER = 'vNNN';` — 메뉴 하단 "앱 버전" 표시값.

→ 둘이 어긋나면(예: 캐시 v235 / 표시 v234) 실제 배포 버전을 화면으로 확인할 수 없다. **둘은 항상 동일 번호**여야 한다. 한쪽만 올리지 말 것.

## 작업 규칙
- 앱 코드 변경 후: 인라인 `<script>` 블록 문법 재검사(현재 3블록) + 위 두 버전 +1.
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
