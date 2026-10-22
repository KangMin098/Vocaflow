# T-0084 rev1 — 독립 반례 결과

HEAD `17e23944431cfc0cb5031e889798c1489052fce7` · 판정 **REWORK**.

P1 **T0084-P1-1 — 결과 본문 미수신이 정상 0건으로 집계됨**

- 재현: 명시 외부 계정이 1명 있고 auth/역할 조회는 정상인 대조에서, 활동 SELECT 응답만 `{data:null,error:null}`로 둔다. 이는 실제 DB 장애 관측이 아닌 SDK 읽기 응답 대역의 독립 반례이며, 정상 빈 결과 `{data:[],error:null}`와 구분해야 한다.
- 실제: dashboard `verifiedActiveToday=0`; teacher funnel 네 수치 모두0; video `started/completed/byId={}`. 반환 데이터를 확인하지 못한 것을 실측 0으로 표시한다. 일반 `error`가 있는 실패 처리는 이미 통과하며 그 부분을 다시 만들 필요가 없다.
- 원인: 새 호출부가 기존 `keysetSelect`/`pagedSelect`에 전달한 SELECT 결과를 그대로 사용한다. 두 기존 helper는 `data ?? []`로 읽히지 않은 결과를 빈 배열로 바꾼다.
- 기대: 검증 가입자 수1은 유지하되 활동 미수신은 `verifiedActiveToday=null`; teacher funnel은 null; 영상 수치는 null. 정상 빈 배열은 여전히 실측0이다. 운영용 전체 계정 수와 수행/G2 판정은 그대로 둔다.
- 최소 수정: 이번에 바꾼 세 조회 경로에서 SELECT 결과가 배열인지 확인하고 미수신/형식 오류를 기존 unavailable/null 처리로 전달한다. 전역 pagination helper·SQL·G2·정본 변경은 요구하지 않는다. 공용 guard가 더 작으면 현재 허용 읽기 모듈 안에서 공유해도 된다.
- 재검증: `cohort-probe.test.ts`의 마지막4개(미수신3+빈배열 정상1), 기존 계정 분류/혼입/일반 실패 대조. 현재 **14통과/3실패**(원 제출13개+독립 정상1 통과, 독립 미수신3 실패). 이3개를 통과로 기록하지 않았다. 관련 타입/lint만 추가하고719개 전체나 UI 재실행은 변경 영향이 없으면 재사용한다.

초기 혼입 수정 자체는 기존 KPI·퍼널·영상 대조에서 통과한다. 계정 분류가 수행의 synthetic/G2/MAP/PLAN을 바꾸지 않았음을 diff로 확인했다. 같은 TASK/rev1에서 이 한 원인만 수정하며 새 TASK/PR/CI/worker를 만들지 않는다.

P2 **비차단**: `gen-db-stats.mjs`는 Node24의 직접 TypeScript import를 사용한다. 프로젝트 `.nvmrc`는20/engines>=20이며 그 환경에서는 import 실패가 catch되어 계정 분류가 `?`가 될 수 있다. 기존 tsx 실행 경로 또는 지원 범위의 읽기 방식으로 정리하는 편이 좋다. 현재 Node24 `--print` 성공을 Node20 성공으로 보고하지 않는다. 동일 fixture 스크립트 시험도 아직 없다.

제출 UI6/6은 실제 AdminKpiGrid+문자열 하네스이고 인증 페이지·Tailwind 적용 증거가 아니다. 그 한계를 그대로 유지한다. 현 main의 다른 owner가 CSAT UI를 편집 중이므로 강제 main 병합은 불필요하며 통합은 수용 후 소유권을 확인한다.
