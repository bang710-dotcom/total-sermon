# CLAUDE.md — 토탈 설교 앱 (작업 메모리)

이 폴더(`total-sermon-web`)는 **정적 PWA "토탈 설교 앱"**의 배포 저장소다.
- 앱 본체: `index.html`(단일 파일, 메인 로직은 끝부분 큰 IIFE) · 서비스워커 `sw.js`.
- 백엔드: 구글시트 Apps Script 웹앱(`Code.gs`, 이 저장소가 아니라 `Dropbox/total-sermon/apps-script/Code.gs`에 보관). 델타 동기화(변경분만, `ID` 기준 멱등 upsert + 삭제로그 툼스톤).
- 로컬 저장: 설정·대기열·테마는 localStorage, 대용량 데이터(`data`)·`syncAt`·`seriesList`·`composeDraft`는 IndexedDB(`tsa`/`kv`).
- 자동 커밋·푸시 워처가 이 폴더에서 돌며 origin/main에 푸시 → 배포된다.

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
