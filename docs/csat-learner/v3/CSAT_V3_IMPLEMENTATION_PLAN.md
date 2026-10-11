# v3.0 통합 구현·검수 계획

2026-10-12 · 실행 대상은 후속 Claude Code. 이 문서는 실행 계획이며 각 단계의 구현/검수는 아직 수행하지 않았다. 현재 사실은 [감사](CURRENT_STATE_AUDIT.md), 목표 계약은 [프로세스](CSAT_LEARNING_PROCESS_V3.md)·[UX](CSAT_LEARNER_UX_V3.md)·[데이터](CSAT_REASONING_DATA_V3.md)를 따른다.

## 1. 실행 순서와 통합 전제

**M0 → M1 → M2 검수 가드+대표 수직 구현 → M3 전량 확장 → M4 비교·원리·기록·지도 복귀 → M5 출시 검수**. 명시 독립 pass/현재 binding 검사 가드는 **M2 대표 콘텐츠의 첫 공개 빌드보다 먼저** 완성한다. 그 전 대표 데이터는 비공개 preview만 가능하며 옛 not-revise 빌드로 공개하지 않는다. UI·데이터·강의를 따로 전량 완성한 뒤 마지막에 연결하는 방식은 금지한다.

최신 main의 여섯 장면·도식·check 모드와 inquiry v1을 통합 기준으로 삼는다. 최종 재조회 main `c206b405d`는 PR #222로 `feat/csat-inquiry-data`를 이미 통합했다. 후속 Claude는 최신 main에서 시작하여 이 결과를 바로 확장하고 다시 cherry-pick하지 않는다. 이 docs 브랜치처럼 초기 main 기반이면 정식 task scope를 확인해 최신 main을 동기화한다. 남의 dirty 파일·검수 산출물·잠금을 가져오지 않으며 원본 공유 작업트리의 진행 중 merge를 해결하지 않는다.

사용자가 승인한 플랫폼 목표와 사용자 이번 요청을 작업 명세에 결속한다. 이 작업은 CSAT 탐구 개선이며 플랫폼 전체 R0 충족이나 학습 지도 독립 진단 승인 작업이 아니다. VFC owner/task·워크트리·잠금·파일/DB 범위를 현재 규약대로 등록한다. 다른 세션이 가진 같은 파일·DB scope를 동시에 수정하지 않는다.

기존 복구 작업 F01~F16은 감사의 개별 판정을 유지한다. 해결된 F01/F14 등을 다시 구현하지 않고 회귀로 고정한다. 기존 M/N 단계와 아래 단계는 배치 순서를 통합한 것이며 과거 완료 표기를 지우지 않는다.

## 2. 실제 수정 지점과 소유권

경로는 저장소 루트 기준. ‘추가’ 표기는 새로 만들 계약이며 현재 존재한다고 주장하지 않는다.

| 책임 | 현재 파일/영역 | v3 수정과 소유권 |
|---|---|---|
| 학습자 통합 담당 1명 | `apps/web/src/app/(app)/csat/{page.tsx,item/[slug]/page.tsx,browse/page.tsx,diagnosis/page.tsx}` | DTO/projection·URL·check 우선순위·지도↔탐구 복귀·partner 접근. item route·Theater를 병렬 작성자에게 중복 배정하지 않음 |
| 동일 UI 담당 | `apps/web/src/components/csat/home/CsatRail.tsx`, `browse/CsatWorkspace.tsx`, `theater/{AnalysisTheater,SceneNav,SceneDiagrams,ComparePairs,SelfExplain}.tsx` | 2메뉴·검색 필터·7장면·선택 상태·근거 중심 동시 표시. 기존 record/formulas/space 기능의 새 진입 보존 |
| 의미/유형 계약 담당 | `apps/web/src/lib/csat/{learner,teaching-contract,passage-skeleton,skeleton,design}.ts`, `inquiry/scenes.ts`, `components/csat/PassageMap.tsx` | 원문 단위 adapter·의미/범위 주석·근거 ID·판단/설계 분리. 새 데이터 타입은 기존 teaching-contract에 연결 |
| 탐구 데이터 담당 | `apps/web/src/lib/csat/inquiry/{data,labels}.ts`, `inquiry-data.json`; `apps/web/src/components/csat/theater/SceneDiagrams.tsx`의 `DistractorDesign/PrincipleDesign`; `scripts/csat/inquiry-drain-{export,validate,build}.mjs` | main에 통합된 v1 보존/v3 binding·graph·meaning 확장. 두 함수 이름의 별도 .tsx 파일은 현재 없다. 정본 writer와 reviewer는 별도 run/agent이며 서로의 입력을 덮어쓰지 않음 |
| 비교 담당 | `apps/web/src/lib/csat/compare-data.json`, `theater/ComparePairs.tsx`; `scripts/csat/compare-drain-{export,import}.mjs` | 쌍 검수·양쪽 binding·조건 mapping·접근 projection. 최종 공개 JSON은 담당 1명만 build |
| 강의 담당 | `apps/web/src/lib/csat/lecture/{types,validate,player,focus,targets,store,tts}.ts`, `components/csat/lecture/{LectureStage,LecturePlayerBar}.tsx` | schema3 validator/scene binding·manual hold·primary target. 플레이어/음성 엔진 재작성 금지, 조정은 한 controller에서 |
| 기록 담당 | `apps/web/src/lib/csat/dissect.ts`, `session/{model,sync,store}.ts`, `continuity.ts`, `item-state*.ts`, `learning-session.ts`, `embargo-gate.ts`, `apps/web/src/app/api/csat/state/route.ts` | optional reasoningNotes·merge·held 비노출·세션 귀속·오류 복구. DissectionRecord/EXPLAIN_MAX 정본은 `dissect.ts`; state version1/기존 lure·formula 기록 보존 |
| 지도 연결 담당 | `apps/web/src/lib/csat/map/{learner-path,curriculum,prescription,lifecycle-evidence}.ts` 및 실제 지도 Workspace | 탐구 링크/복귀 계약만 변경. 능력 번호·독립 판정/주석/adoption/전이 승인 조건은 변경하지 않음 |
| 공통 검수 담당 | 관련 `__tests__`, `apps/web/tests/e2e/`, `apps/web/src/lib/analytics/events.ts` | D2/D3, 권한·실제 상태 전이·PC 시각 QA. 입력 텍스트/문항 ID를 funnel payload에 넣지 않음 |

추가 후보 `inquiry/{reasoning-types,binding,projection,validation}.ts`는 M2에서 현재 inquiry 모듈과 중복 여부를 확인하고 최소 분리한다. 서버 정본 데이터를 client 모듈이 import하지 않도록 경계를 둔다. 파일 이름보다 소유 기능/검증 계약을 우선한다. 현재 존재하지 않는 `session/merge.ts`나 `csat_lectures`를 수정 대상으로 쓰지 않는다.

## 3. M0 — 현황 확정·회귀 기준선 (N0 / F02·F09·F15·F16)

1. AGENTS→현재 router/VFC→해당 영역 1~3문서→apps/web/CLAUDE를 읽고 branch/head/merge/dirty/잠금을 기록한다. main과 진행 브랜치의 병합/폐기 상태를 원격 이력에서 확인한다. 세션 memory check와 안전장치 check를 수행한다.
2. 최종 main에서 라우트 grep·type registry·강의/비교/inquiry 재계수. DB에는 읽기 SQL만 사용해 실제 테이블·공개 view·최신 published analysis·units를 조회한다. 오류/count=null은 0으로 처리하지 않는다. 원문·밑줄·도표 provenance와 공개 보류를 문항별로 구분한다.
3. F01~F16 각각 `구현 사실/통과한 검사/실화면/데이터 미확인/남은 조치`를 별도 열로 갱신한다. 전량 검수 없이 완료된 것으로 쓰지 않는다. N0에는 이전 목적/유형/회차 메뉴별 현재 링크·개인 기록 진입·query 파서 목록을 만든다.
4. 대표 문항은 2026#34·36·38·29·25, M2706#36, H2603G3#34를 포함한다. 고1/고2 학평은 실제 공개 가능 후보를 읽기 조회해 ID/분석/원문 상태를 고른다. retired 유형도 registry/fallback/legacy 읽기를 확인한다.
5. 테스트 계정은 권한·개인 기록 삭제 없이 제공된 검증 방법으로 사용한다. 브라우저가 없으면 로컬 렌더 검증은 미검증으로 남기고 실제 QA 전에 통과를 선언하지 않는다.

**산출/탈출**: 통합 diff 범위·기준선 결과·대표 목록·필드 coverage/권리 상태·실제 명령 manifest. CI/실화면 기존 실패와 신규 회귀를 구분한다. M0에서 코드/데이터가 미검증이면 그 영역을 ‘완료’로 넘기지 않는다.

## 4. M1 — 메뉴·자유 탐구·상태 골격 (N1·N2·N3 / F01·F03·F12·F14)

- 두 주요 메뉴 `내 학습 지도 / 기출 탐구`. `/csat`는 지도 중심 시작점. 목적/유형/회차는 browse의 검색 조건/맥락으로 옮긴다. 유형·회차 deep link와 개인 기록/원리 노트/재개 접근은 보존한다. 처음 진단/미완료/관찰 있음/확인 필요/탐구 복귀 상태에서 같은 화면이 무엇을 먼저 제안하는지 UX 표대로 구현한다.
- 7장면 enum·old query alias·최소 panel state를 구현. 기존 question/choice/reveal 콘텐츠가 새 judgment 장면에서 즉시 열리는지 확인한다. `?check=1`은 독립 확인 화면을 우선하며 요청 시 언제든 해설로 전환 가능하다. 해설을 연 이후 independent=false/help 상태를 보존하고 정답 제출 여부를 접근 조건으로 삼지 않는다.
- scene 수동 선택은 history push, 오디오 진행은 replace. 브라우저 뒤로/새로고침·기존 `answer/distractor` 링크·불명 query 처리·복귀 URL/anchor를 검사한다. 텍스트 입력/선지/팝업 안 Arrow/Space를 Theater가 탈취하지 않는다.
- 새 진입·상호작용 이벤트를 같은 커밋에 추가하되 속성은 닫힌 enum/숫자/boolean. 클릭을 능력 달성으로 저장하지 않는다.

**데이터/예외**: 의미·비교·강의 없으면 같은 장면에서 이유/기존 검수 분석/가능한 다음 동작을 제공한다. 원문 재입력·로그인 필요·공개 보류를 ‘데이터 준비 중’ 한 문구로 뭉개지 않는다.

**검수/문서/PR**: 7장면 접근/alias/help 회귀, N1~N3 old link/개인 기록 진입, 1280/1440 first viewport·탭 이동. ROUTES·MODULES·DELIVERY/DECISIONS·이벤트·CHANGELOG 동반 갱신. 데이터 대량 작성 없이 작은 UI milestone PR로 종료.

## 5. M2 — 근거·의미·판단·설계 수직 구현 (F04·F06~F08·F10·F11)

첫 작업은 새 타입/binding 정의와 **독립 검수 공개 가드**다. inquiry build의 `not revise` 허용을 `explicit pass + writer≠reviewer + 현재 content/binding/hash + criteria revision`으로 바꾸고 미검수/낡은 pass/동일 writer/unknown verdict/revision 충돌의 실패→성공 회귀를 만든다. 이 가드가 통과하기 전에는 대표 v3 데이터를 비공개 preview로만 검토한다. 기존 공개 v1은 legacy 상태로 보존하며 v3 pass로 자동 승격하지 않는다.

- v3 타입/불변식, source/answer/analysis/units/visual/content binding, provenance, primary/related target을 먼저 검증기로 구현한다. sourceHash는 현재 권한 경로의 정본에서 내부 manifest로 계산한다. DB source를 SSR/public 정적 JSON에 가져와 권리 정책을 우회하지 않는다.
- 대표 문항에서 meaning↔원문 구문/scope↔relation↔judgment↔design↔TTS가 동일 evidence ID를 사용하게 한다. 근거 클릭은 현재 장면의 주장/원문/관계도/대본을 선택한다. 자동 재생하지 않는다. text literal 일치만으로 의미 명제가 검수됐다고 하지 않는다.
- selectedAsAnswer/contentTruth/requirementFit 분리, 빈칸 범위/극성·순서 양쪽 경계·삽입 선후 요건·어법 finite clause·도표 조건을 적용한다. retained/altered가 n/a인 유형은 변경 사실을 만들어 채우지 않는다.
- source/units 불일치·밑줄 범위 모호·원본 없는 도표는 해당 assertion/diagram만 unavailable/stale로 보류하고 검수된 분석 접근은 유지한다. 검수된 데이터와 legacy를 명시적으로 구별한다.
- 강의 schema3 분기·별도 역할/장면 허용 표·대본/target 검증을 구현하고 schema1 회귀를 유지한다. vocab 의미 설명을 앞당기면 기존 ROLE_ORDER가 거부한다는 감사 내용을 재현한다. 새 validator로 해결하며 전역 검사를 제거하지 않는다. cue/scene/claim/evidence 바인딩 없는 기존 대본은 legacy로 표시한다.

**데이터**: 대표별 version/hash/검수 결과를 static inquiry v3에 담는다. DB 정답 오류가 별도로 입증되지 않으면 v3 필드 추가를 이유로 분석 버전 전체를 새로 발행하지 않는다.

**검수/문서/PR**: 단계 간 evidence 정합·의미 scope·반례·target DOM·schema unknown reject·중단/hold/race·개인기록 비노출 회귀. 2026#34 등 대표 화면의 원문→영어 의미→한국어 설명→선지 요건을 독립 심사한다. 데이터 계약/타입 blueprint/강의 문서/디자인 reference 대응표 업데이트. 대표 수직 구현이 통과하기 전 전량 확대 금지.

## 6. M3 — 가드가 적용된 26유형·기관/학년 확장 (F02·F05·F07~F11)

**M2의 가드가 모든 확장 경로에 적용되는지 확인**: skip도 schema/hash/필수 coverage가 맞을 때만 허용한다. 리뷰 파일명 정렬이 최신 판정을 결정하지 않게 한다. 새 배치/비교/강의 exporter·builder가 추가되면 명시 pass/현재 hash 조건을 우회하지 못하도록 해당 경로의 실패→성공 회귀를 추가한다. 검수 가드를 M3까지 미루지 않는다.

배치 단위는 타입/기관/학년/필요 장면/실패 사유로 정한다. 하나의 작성 청크에는 원문·최신 분석·필수 의미 scope·선지·existing inquiry·강의/쌍 binding을 제공한다. 본문 없이 제목/옛 분석 요약만으로 생성하지 않는다. 작성 에이전트가 결손을 숨겨 모든 field를 ‘ok’로 채우지 않는다. 청크 병렬 작업은 서로 다른 `.out.json`만 소유하고 최종 validator/build는 단일 담당이 수행한다. 작성자 자기 검수는 독립 pass를 대체하지 않는다.

순서: 대표 소량→26유형마다 적어도 한 적격 문항/retired legacy→공개 적격 집합 확장. 학평 고1/2/3는 단순 배지 추가가 아니라 실제 의미·분석·units·권리/검수 상태를 확인한다. 학평 공개 보류는 유지하고, 승인/검수 요건을 충족한 집합만 공개한다. 결손 항목도 분모/원장에 남긴다. 전량에 적용한 coverage를 기관·학년·유형·장면·status로 출력한 뒤 제외 표본을 눈으로 확인한다.

**기존 명령 검증**: 최신 main의 inquiry export/validate/build 실제 인자 파서를 읽어 실행 manifest를 고정한다. 확인된 `inquiry-drain-build.mjs --dry`는 파일 빌드 preview이며 DB checkpoint가 아니다. 새 schema/review 인자가 필요하면 구현·문서·테스트를 먼저 끝낸다. 존재하지 않는 `--schema v3 --review-pass`를 기존 지원 옵션처럼 실행하지 않는다.

**DB 분기**: 기본은 정적 파일 변경. DB 오류 교정/마이그레이션/대량 발행이 필요하면 아래 §9를 적용해 승인된 범위만 처리한다. 저장소 규칙상 승인 요건을 데이터 v3 작업 전체에 새 승인 관문으로 늘리지 않는다.

**검수/문서/PR**: 전량 mechanical 검사+각 본문에 대한 독립 내용 심사+실패 유형 회귀, 26 registry coverage·unknown fallback·분석 갱신 뒤 stale. Admin에 배치 액션/탭/label/절차가 바뀌면 기존 `lib/admin/help/<pipeline>.ts`의 실제 파일을 찾아 같은 커밋에 고친다. large JSON의 review manifest/hash/분모/skip/held counts와 되돌리기 절차를 PR에 기록.

## 7. M4 — 비교→조건부 원리→자기 설명·지도 복귀 (N4 / F13·F15)

- 기존831쌍 선언을 유지하되 v3 검수 대상으로 자동 승격하지 않는다. 양쪽 최신 binding·접근 가능한 partner·명시한 구조 mapping·구체적 성립 조건/경계·writer/reviewer pass가 맞을 때 공개한다. cross-type 상대는 같은 type siblings만 사용하는 현재 route를 바꿔 RLS 허용 ID 집합으로 별도 조회한다.
- 비교 화면에는 원문 복제 전체 대신 권리 범위의 양쪽 근거·관계 변환·변하지 않은 조건·갈라지는 조건을 함께 표시한다. 초점은 한 비교 관계. stale partner/권한 거절/동일 근거 중복/비교 없음/원문 재입력을 각각 처리한다.
- 원리는 generalized/bounded/candidate의 지지 상태를 따른다. 비교 **데이터**가 없어서 검수 미달이면 후보/문항 범위 설명을 제공한다. 학습자가 비교를 클릭하지 않았다는 이유로 원리/대본을 잠그지 않는다.
- 선택적 자기 설명을 원리 노트로 확장하되 기존 lure 기록/원리 저장은 보존한다. state 모델·정규화·동시 merge·held 비노출·route auth·저장 실패/재시도·오프라인/기기 복귀를 같이 구현한다. 자동 의미 채점·능력 달성 판정은 도입하지 않는다.
- 지도에서 온 학습자는 이전 과제/상태로 복귀할 수 있다. 탐구·음성·자기 설명 이력을 independent 진단으로 만들지 않는다. 독립 확인/전이는 기존 주석·adoption·blind judge·B7 등 승인 기준을 따르고 탐구와 별도 session으로 진행한다.

**검수/문서/PR**: 양쪽 version 하나만 바뀌어도 비공개·짧은 노트 입력 Arrow/Space·다른 사용자 접근·900KB guard·동시 append·오래된 notes read·held 연결 notes. 조건부 원리/반례 품질을 본문 심사. LEARNING_MODEL은 탐구와 독립 진단 구분만 기록, 실제 효과 미입증 명시.

## 8. M5 — 회귀·실화면·문서·릴리스 (N5 / F01~F16 최종 대조)

기능 검증: 아래 §10 + CI 동일 lint/type/test·web build·대상 E2E. 검사 결과/명령/commit/head를 기록한다. baseline 실패는 정확히 설명하고 실패 상태 push는 하지 않는다(안전 중단, 사용자 확인으로도 우회하지 않음). 회피용 skip/no-verify 금지.

실화면: **PC1280/1440 × 라이트/다크**, `/csat`·browse·대표 item 각 장면, 처음/기록 있음/check/help/권한 없음/원문 없음/stale/비교 없음/TTS 실패. 실제 스크린샷과 DOM overflow 결과를 남긴다. 기존 3B 대응 골격·토큰·44px focus·한글 break-keep·색 외 의미·keyboard reach·reduced motion을 확인한다. 디자인 reference measure/compare를 현재 문서의 실제 명령으로 실행하며 비교표 없이 ‘참조와 같다’고 보고하지 않는다. 모바일 전용 UI/390px 검수는 추가하지 않는다.

교육 검증: 연구 근거로 설계 방향은 설명할 수 있지만 실제 학습자 없으면 이해/전이/학습 효과는 **미검증**. 별도 동의·독립 평가 과제·루브릭·지연 전이 계획을 제시한다. 클릭/체류/완주/자기평가는 교육 효과 대리지표가 아니다. 기능 출시와 효과 입증을 같은 완료 체크로 묶지 않는다.

문서: 구현 사실만 DELIVERY·MODULES·ROUTES·DESIGN_SYSTEM(패턴 변경시)·CONVENTIONS(새 패턴시)·Admin help·CHANGELOG에 반영한다. DB 변경시 DB_SCHEMA, 콘텐츠/수요 수치 변화시 `pnpm docs:db-stats` 실행. 이번 v3 설계의 ‘예정’을 코드 완료 문장으로 일괄 바꾸지 않는다.

PR: 목표·범위·7장면 대표 증거·F/N 남은 항목·공개 보류/coverage·검사·화면 비교표·복구를 쓴다. 소유 파일만 커밋/push한다. 이번 사용자가 요청한 설계 교차 리뷰는 수행하고, 후속 구현 PR 교차 리뷰는 그 작업에서 사용자 요청이 있을 때만 수행한다. 자동 Codex 리뷰를 부활시키지 않는다. 완료 판정은 테스트·타입·lint·수용 기준 증거·Goal Check로 한다. main 병합은 최신 safe-merge와 해당 작업의 유효 사용자 지시를 따르며 이번 설계-only task는 병합하지 않는다. 구현/데이터/시각/교육/승인을 서로 다른 상태로 보고한다.

## 9. 승인·dry-run·체크포인트·복구

최신 저장소 정책 v1.1은 DB 변경/데이터 삭제 승인, 30파일 추가 검증, safe-merge를 규정한다. 이번 세션의 사용자 제공 지침에는 더 엄격한 확인 조건이 있으므로 적용 출처를 분리한다. 이번 설계 작업의 main merge는 scope 밖이다. 후속 Claude는 작업의 유효 사용자 지시를 우선하고 최신 정책 정본을 다시 확인한다. 아래 표의 별도 확인 조건을 저장소 전체의 현재 정책이라고 복제하지 않는다.

| 작업 | 선행 요건 | 복구/검수 |
|---|---|---|
| 정적 inquiry/compare/강의 파일 | DB 쓰기 없음 확인, 기존 파일+input/review manifest hash 보존, preview diff·권리/근거 게이트 | 소유 build 커밋 revert, 기존 schema1/v1 read 확인. 사용자의 새 노트 삭제 금지 |
| DB 읽기 감사 | 실제 table/view/RLS·권한·오류 처리 확인, 최소 필드 | DB 변경 없음. 오류를 count0으로 묻지 않고 재조회 |
| DB 소량/대량 분석 교정·발행 | 해당 checkpoint skill을 읽고 before checkpoint·현재 revision/row 수·dry-run planned delta·개별 내용 검수. 승인 필요한 작업은 구체 SQL/대상/복구를 먼저 제시 | 소량 적용→검증→승인 scope 전량→after checkpoint. 다른 최신 작업이 생긴 row는 복구 충돌 원장으로 분리, 무조건 과거 JSON overwrite 금지 |
| 마이그레이션 | 직전 migration 번호 점검, SQL/권한·RLS/검증/복구 제시, **사용자 승인 후** 적용 | 승인 범위만 적용. 자동 migrate 금지, DROP/TRUNCATE는 별도 사용자 확인 |
| 학평 공개 보류 해제/rights 변경/독립 진단·전이 채택 | 해당 기존 승인/검수 정책의 실제 요건 확인 | 탐구 메뉴 변경이 승인을 대신하지 않음. 미승인 상태를 공개·확정 근거로 표출하지 않음 |
| 파일≥30 변경·main merge | 최신 정책에서는 추가 검증/안전 병합. 이번 사용자 지침의 별도 확인이 유효한 작업은 그 범위를 명시해 따름 | 30파일 검증을 커밋 분할로 우회하지 않음. main은 safe-merge 외 경로 금지 |
| 실패 상태 push·새 secret/환경 파일 | 최신 정책의 안전 중단; 확인으로 오류/비밀값 보호를 우회하지 않음 | 원인 수정·재검증. 비밀값 출력/커밋 금지 |

체크포인트 결과에 API 키/DB URL/사용자 원문을 남기지 않는다. `source-command-db-checkpoint`는 실제 DB 변경 분기에서 적용한다. 정적 build dry-run을 DB backup으로 오기하지 않는다. 중단 후 재실행은 chunk ID+binding+revision/coverage로 skip를 판단하며 partial output을 ready로 import하지 않는다.

## 10. 필요한 테스트와 검수 증거

기존 실제 파일을 시작점으로 사용한다. 계획된 추가 테스트는 구현 후 경로를 확정한다. 불필요한 문구 snapshot/단순 구현 복제 대신 계약을 깨는 입력과 이전 회귀를 검증한다.

| 계약 | 현재 회귀 시작점 | 추가 실패/성공 증거 |
|---|---|---|
| 장면/도식/읽기 | `src/lib/csat/inquiry/__tests__/scenes.test.ts`, `src/components/csat/theater/__tests__/SceneDiagrams.test.tsx`, `src/components/csat/__tests__/theater-delivery-guard.test.ts` | old alias·free help·manual/audio history·meaning/choice scope·missing data |
| 음성/target | `src/lib/csat/lecture/__tests__/core.test.ts`, E2E `46-csat-lecture.spec.ts` | legacy/schema3/unknown·잘못된 anchor·primary 유일성·manual hold·중단 후 stale cue·무음/실패 |
| 개인 기록 | `src/lib/csat/session/__tests__/dissect.test.ts`, `src/lib/csat/__tests__/continuity.test.ts`, `src/app/api/csat/state/__tests__/route.test.ts` | optional notes 구버전/동시 append·길이·사용자 간 분리·재시도 |
| embargo/help/진단 | `src/lib/csat/__tests__/embargo-gate*.test.ts`, `learning-session.test.ts`, map/diagnosis 기존 테스트 | held note/partner/대본 누출·도움 후 independent 제외·능력 enum 불변 |
| 전체 flow | `apps/web/tests/e2e/{csat-continuity,csat-learning-loop,csat-item-layout,42-csat-item-map,43-csat-map-a11y}.spec.ts` | 지도→탐구→복귀/check→help, 7장면/두 메뉴/노트/TTS/누락; PC 두 폭 두 테마 |
| 데이터 공정 | inquiry/compare validator와 새 build guard 테스트(추가) | pass 없음·writer 동일·source/answer/unit/pair 변경·리뷰 hash 불일치·재실행 diff0 |

위 unit 경로는 `apps/web` 기준이다. 실제 실행 예: `pnpm --filter web exec vitest run src/lib/csat/inquiry/__tests__/scenes.test.ts src/lib/csat/lecture/__tests__/core.test.ts src/lib/csat/__tests__/continuity.test.ts src/app/api/csat/state/__tests__/route.test.ts`. E2E는 제공된 test:e2e runner/인자 파서를 확인해 대상 파일을 실행한다. 현재 설계 작성자는 이 구현 테스트를 실행했다고 주장하지 않는다.

## 11. 완료 기준

- 7장면은 자유 열람이며 meaning·judgment·design이 근거/가설을 구분해 실제 문항 성립을 설명한다.
- 두 메뉴·지도 중심 홈·검색 필터·old link·개인기록·복귀가 동작한다. 기존 진단/PROTOCOL 번호 의미와 승인/권한이 보존된다.
- 공개 v3 콘텐츠는 source/answer/analysis/units/visual/검수 hash가 유효하다. 결손·보류·stale는 이유가 있고 허위 원리/수치/의도를 채우지 않는다.
- 26유형과 학평 범위의 coverage/결손 분모가 명시되고 대표 수직 흐름을 독립 내용 심사했다. 미적격 데이터는 전량 완료 보고에서 제외한다.
- 기존 state·강의/비교·도식·F01~F16 수용 기준이 회귀 검사로 유지된다. 실제 PC 화면/음성 동기화/오류 상태 검수 자료가 있다.
- 테스트·타입·lint·수용 기준 증거·Goal Check, 문서·소유 커밋·PR·복구 자료 완료. 사용자 요청으로 수행한 교차 리뷰는 P1/P2를 해소한다. main merge/정책 승인/교육 효과는 각각 실제 상태로 별도 보고한다.
