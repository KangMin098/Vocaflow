# Claude Code 실행 지시문 — Vocaflow 기출분석 학습 환경 v3.0

이 파일과 같은 폴더의 여섯 설계 문서를 작업 입력으로 사용하라. 작성일 2026-10-12. **문서가 만들어진 것은 구현 완료가 아니다.** 후속 작업은 최신 저장소 조사부터 실제 구현·검수·문서·PR까지 수행한다. 이 지시문 자체는 DB 변경/미승인 공개/독립 진단 채택/main merge 승인이 아니다.

## 1. 목적과 금지할 전환

기출분석은 정답을 빠르게 맞히게 하는 제품이 아니라 **원문에서 출제 설계의 성립 조건을 근거로 재구성하고, 문항의 본질과 적용 한계를 이해하는 학습 환경**이다. 진단은 내 학습 지도의 핵심이며 독립 증거를 사용한다. 탐구 클릭/강의/노트가 독립 진단이나 능력 달성으로 바뀌어서는 안 된다.

순서는 **평가 과제→원문 의미·구조→문항 성립 판단→근거 기반 설계 재구성→기출 비교→조건부 원리→선택적 자기 설명**. 추천 순서이지 통과 관문이 아니다. 정답/확신 제출, 강의 완주, 이전 장면 방문으로 설명을 잠그지 마라. 기존 문제풀이 확인 모드는 도움 이력을 보존하는 별도 경로로 유지하라.

공식 근거/원문 관찰/분석자의 설계 가설/일반화한 학습 원리를 구별하라. 실제 출제자의 내부 사고라고 단정하지 마라. 한국어 해설·역할 라벨만으로 영어의 실제 의미·범위·구문 이해를 대체하지 마라. 검수 없는 수치/유인/비교 쌍/반례를 만들지 마라. 연구/강사 교수법이 이 제품의 학습 효과를 입증했다고 쓰지 마라.

## 2. 작업 전에 반드시 확인할 현재 상태

읽기 순서: AGENTS → 현재 `agents/router.md`/task 관리/승인 정본 → `.agent-handoff/latest.md`(인수 작업이면 첫 동작) → 해당 영역 문서 → apps/web/CLAUDE → [CURRENT_STATE_AUDIT](CURRENT_STATE_AUDIT.md) → 나머지 v3 문서. 기존 외부 F01~F16/M0~M5/N0~N5 지시문과 현재 DECISIONS 이력을 지우지 마라.

2026-10-12 조사 기준:

- 초기 main 기준은 `47ac96dbee46b34451bf6493eb04d8b841626463`, **최종 재조회는 `c206b405dd0b44e54989f0bfdc6ef3c2cecac8c2`(PR #222 inquiry 통합)**다. 최신 main에서 시작하고 다시 fetch해 변경분을 조사하라. 현 라우트는 `apps/web/src/app/(app)/csat/item/[slug]/page.tsx`이며 옛 `(main)`에 새 구현하지 마라.
- `D:\workspace\Vocaflow` 원본은 공유 merge/dirty 상태였다. 남의 merge/검수 JSON/잠금을 고치지 마라. 최신 main 기준 소유 worktree와 VFC task/owner/scope를 만들라.
- 여섯 장면·도식·읽기 탭·SelfExplain·ComparePairs·원리 저장·F01 자유 해설·F14 revisit·지도 `?check=1`은 main에 있다. 코드가 있더라도 검수 미확인을 완료로 쓰지 말고 필요한 회귀를 실행하라.
- `feat/csat-inquiry-data`(조사 HEAD `4cb0b32bc`)의 preserved/altered/조건부 principle·analysis_version 연결·786개 정적 inquiry·drain 도구는 이제 PR #222로 main에 있다. 최신 main 결과를 재사용하고 다시 cherry-pick하지 마라. `DistractorDesign/PrincipleDesign`은 `SceneDiagrams.tsx`의 함수이며 같은 이름의 별도 파일은 없다. 남의 dirty 산출물을 가져와 전량 재작성하지 마라.
- 해당 build는 ‘마지막 verdict가 revise가 아님’을 pass로 대체한다. **명시 독립 pass+현재 hash/binding** 가드를 먼저 구현하라. 기존786개 전부 오답이라고 단정하지 마라.
- 학평 분석은 존재하나 inquiry v1 범위에서는 공개 보류이다. v3 설계/검증에 포함하되 검수·공개 승인 없이 보류를 해제하지 마라.
- `csat_lectures`, `csat_review_ledger`는 조회 당시 없다. 현재 테이블/함수/권한 경로를 직접 확인하라. 지시문에 새 테이블/필드가 존재한다고 가정하지 마라.

`pnpm sync:memory --check`·안전장치/작업 잠금을 현재 규약대로 처리하라. 규정상 별도 승인 작업은 실제 SQL/범위/dry-run/복구까지 준비한 후 사용자에게 구체적으로 요청하라. 정적 파일/UI의 승인된 정상 작업에 불필요한 추가 승인 관문을 만들지 마라.

## 3. 반드시 구현할 계약

아래 문서의 명세를 사용하라. 충돌이 생기면 최신 사용자 요청/AGENTS를 먼저 따르고 근거와 수정안을 기록하라.

| 입력 | 구현 지시 |
|---|---|
| [CSAT_LEARNING_PROCESS_V3](CSAT_LEARNING_PROCESS_V3.md) | 7장면의 질문·근거·의미 변환·조건/한계·교수 지원. 장면의 시범/탐구/선택적 설명은 이해 시험과 구별 |
| [CSAT_LEARNER_UX_V3](CSAT_LEARNER_UX_V3.md) | 두 메뉴·지도 홈·3영역 작업공간·state/event/exception·old alias·TTS hold·각 대표 문항 시나리오 |
| [CSAT_REASONING_DATA_V3](CSAT_REASONING_DATA_V3.md) | 기존26 type registry에 meaning/evidence/claim/choice/graph/pair/principle/cue binding. source truth와 선택 적합성 구분 |
| [CSAT_V3_IMPLEMENTATION_PLAN](CSAT_V3_IMPLEMENTATION_PLAN.md) | M0~M5/N0~N5/F01~F16 연결·실제 파일/담당·검수/대량 처리/DB복구/문서/PR |

원문·관계도·설명·대본/TTS를 같은 evidence ID로 선택하게 하라. primary target는 유일한 실제 DOM이며 related는 참조로 표현하라. 본문 재분할 차이를 padding/절단으로 숨기지 마라. 의미 scope·부정/양화·대조·지시·주절/수식·순서 경계·도표 조건을 해당 타입의 단위로 설명하라.

정적 inquiry 정본/labels와 서버 projection을 분리하라. 필요한 public DTO만 client로 내보내고 corpus·원문·비밀값·보류 자료를 번들에 넣지 마라. source/answer/analysis/units/visual/hash가 바뀌면 관련 v3 확장/pair/principle/cue를 stale로 하고 검수된 기존 분석을 권한 안에서 유지하라.

강의는 기존 `LecturePlayer`/tts를 재사용하라. `schemaVersion:3`을 별도 검증하고 missing는 legacy1로 읽으며 unknown reject. 새 의미/비교 큐를 넣으려고 legacy ROLE_ORDER/길이/target 검사를 삭제하지 마라. legacy 큐를 장면 label만 바꿔 v3 검수 강의로 취급하지 마라.

개인 노트는 기존 DissectionRecord version1의 optional reasoningNotes로 추가하고 model/normalize/continuity merge/held filter/auth route/storage 한도를 함께 검증하라. 기존 lure/formula 기록·독립 확인 상태를 보존하라. raw 사용자 입력/문항 ID는 funnel 이벤트에 넣지 마라.

## 4. M0~M5 실행 및 단계별 보고

**M0**: 최신 main/진행 브랜치/공유 잠금 확인→작업 등록→회귀 기준선/실제 데이터 읽기→대표 문항/기관·학년·26유형 coverage/보류 원장→합류 범위 확정. 실제 조사 근거를 남긴 뒤 M1로 가라.

**M1**: `내 학습 지도 / 기출 탐구`·목적/유형/회차 검색조건·지도 중심 홈→7장면/alias/check 우선순위→기록/노트/재개 진입→이벤트·URL/뒤로가기·키보드. 자유 해설/old link/복귀 회귀를 통과시켜라.

**M2**: 타입/binding/validator→**명시 독립 pass+writer≠reviewer+현재 hash/binding 공개 가드와 실패→성공 테스트**→2026학년도 수능34번부터 원문 의미↔판단↔설계↔TTS 수직 구현→순서36/삽입38/어법29/도표25 및 학평/M2706 검증. 공개 가드 통과 전 대표 v3 데이터는 비공개 preview만 가능하며 기존 not-revise 경로로 공개하지 마라. 예외는 미확인으로 표출하고 새로운 설명은 독립 본문 검수 후 공개하라. schema3/target/controller를 완성한 뒤 확장하라.

**M3**: M2 가드의 모든 확장 경로 적용/재실행 안전 확인→소량→26유형/기관·학년·장면별 확장→전량 coverage/skip/held/rejected 원장→본문 독립 심사. 원리/강의 전량 생성으로 실화면 통합을 미루지 마라.

**M4**: 양쪽 binding/권한을 검수한 쌍과 조건 mapping→candidate/bounded/generalized→선택적 노트·state merge/held·실패 복구→지도 과제 복귀. 원리 열람을 비교 클릭에 종속시키지 마라. 기존 독립 진단/전이 승인은 따로 보존하라.

**M5**: 관련 unit/data regression→CI lint/type/test·web build·실제 E2E→PC 두 폭 두 테마/음성/예외 검수→문서/도움말→수용 기준/Goal Check→소유 커밋/push/PR. 교차 리뷰는 그 작업에서 사용자 요청이 있을 때 수행하라. main merge는 현재 safe-merge와 해당 작업의 유효 사용자 지시를 따르라.

각 단계 결과는 `구현 완료 / 기계 검사 / 독립 내용 검수 / 실화면 / 공개 승인 / 교육 효과`를 별도 칸에 쓰고 변경 파일·데이터 분모·실행 명령·잔여 실패·복구·후속 의존성을 붙여라. 설명/공개 보류가 남았으면 전체 데이터 완료로 보고하지 마라. 실제 학습자가 없으면 교육 효과는 미검증이다.

## 5. 대량 배치의 정확한 실행 원칙

새 파이프라인을 만들기 전에 기존 inquiry/compare/analysis drain을 검색하라. inquiry 도구는 PR #222 이후 main에 있으므로 없는 도구라고 다시 만들지 마라. 해당 `.mjs`의 실제 argv/입출력/schema를 읽고 실행 명령을 확정하라. 감사에서 확인한 `inquiry-drain-build.mjs --dry` 외에 계획된 옵션을 이미 지원하는 것으로 쓰지 마라.

1. 현재 공개 적격 입력 manifest(item/pair ID·버전·해시·schema·필드 coverage)를 만든다. 권리/보류/원문/밑줄/도표 결손을 분리한다.
2. export는 현재 v3 완성 조건을 만족하는 입력만 skip한다. v1 output이 있다는 이유로 의미 데이터 보강을 영구 skip하지 않는다.
3. 청크 writer는 해당 전체 원문과 분석을 읽어 `ok/needs_source/needs_review/not_applicable`·변경 이유를 출력한다. 값이 없으면 만들지 않는다. 병렬 agent는 자기 청크만 소유하며 타인의 편집을 revert하지 않는다.
4. 별도 reviewer는 실제 본문·발문·선지·영역·binding을 대조한다. verdict/criteriaVersion/contentHash/reviewerRun/writerRun이 필요하다. 자기 검수/파일 존재/not-revise는 pass가 아니다.
5. validator→명시 pass만 포함한 preview/build→대표 실화면→전량 재계수. 빌드 대상과 공개 projection을 서로 검증한다. 최종 JSON은 단일 담당이 만든다.
6. 정적 산출물은 소유 commit revert로 복구한다. DB 교정이 필요할 때만 checkpoint/승인/dry-run/소량/적용/after checkpoint 분기를 실행한다. DB에 JSON 전체 overwrite로 기존 정답 키를 지우지 않는다.

API 키를 기다리며 생성이 막혔다고 끝내지 마라. 현재 실행 중인 에이전트가 청크 내용을 작성한다. 검수자를 별도 run으로 분리하고 실제 입력 결속을 유지한다.

## 6. 검수에 반드시 포함할 경우

- 2026#34의 `cannot be` 범위/전체 명제, 36의 선후 양쪽 조건, 38의 지시+뒤 예시 양쪽 결속, 29의 정형동사/수식, 25의 실제 도표 조건·원본 binding. 수치/의도를 재판독 없이 사실로 생성하지 마라.
- 평가원/모평/학평 고1·고2·고3, 26유형/retired/unknown·긍정/부정 발문·내용상 참인 비정답·n/a 변경·구조 없는 자료.
- 새로고침/뒤로가기/old scene query·check→help·학습 지도 복귀/재개·입력창 keyboard·원문 없음/로그인/held/stale/비교 없음·원리 후보.
- TTS load만/읽기만/재생/중단/언어 분리/수동 근거 선택 hold/재개/음성 실패/탭 숨김/빠른 scene change/오래된 cue·target 미존재.
- 구버전 개인 state·동시 저장·다른 user 접근·900KB·held 연결 note/pair/대본·권한 없는 partner·로그에 원문/자유 입력 누출 없음.
- PC1280/1440 라이트·다크의 실제 스크린샷/overflow/focus/가독성/44px/토큰·3B ref measure/compare. 모바일 디자인을 추가하지 마라.

기존 테스트 파일/명령과 추가 regression은 구현 계획 §10에서 시작하라. 날짜는 주입 또는 fake timer로 고정하라. 실패를 숨기거나 검증을 skip하지 마라. 실제 기능/내용/화면 검사와 학습자 효과 연구를 구별하라.

## 7. 기록·리뷰·커밋·PR

승인 규칙의 버전 차이는 감사 §6을 읽어라. 최신 main v1.1은 DB 변경/데이터 삭제 승인, 30파일 추가 검증, safe-merge를 통한 병합이다. 이번 사용자가 제공한 지침의 별도 확인 조건이 유효한 후속 작업에는 그 조건을 기록해 따르되 저장소 전체 정책이라고 재선언하지 마라. 설계-only task의 main merge 제외를 다른 구현 task의 전역 금지로 확대하지 마라. 비밀값/실패 상태 push는 승인으로 우회하지 않는다.

새 route/패턴/데이터/학습 전달 변경과 관련 문서를 같은 milestone에 고쳐라. Admin 배치 화면을 바꾸면 실제 도움말의 tabs/steps/drain/recovery도 같은 커밋에 고쳐라. 콘텐츠/수요가 바뀐 DB 작업은 자동 통계 생성 명령을 실행하고 수치 마커를 손으로 고치지 마라.

현재 `agents/scripts/review.mjs`는 코드 목적 대조를 수행하지만 **`--plan`을 처리하지 않는다**(2026-10-12 main 확인). 그 인자를 붙였다고 이 설계 파일을 검토했다는 보고를 하지 마라. 이번 요청의 설계 교차 검토에는 동일 목적/금지/수용 기준과 여섯 문서 본문을 반대 Claude/Codex 리뷰어에게 읽기 전용으로 제공하고 결과를 남겨라. 후속 구현 PR의 교차 리뷰는 해당 작업의 사용자 요청이 있을 때만 현재 정식 스크립트/규약으로 실행한다. 자동 Codex 리뷰는 없다. 수행한 리뷰의 P1/P2를 해결하고 변경 부분을 다시 대조한다. 구현 완료 판정은 테스트·타입·lint·수용 기준 증거·Goal Check로 한다.

소유 worktree·task·범위 안에서만 수정하고 `git commit --only <자기 경로>`를 사용하라. milestone/파일수≥5/작업 전환시 Conventional commit+현재 브랜치 push. DB 변경/데이터 삭제는 승인 요건을, 파일≥30은 추가 검증을, main은 safe-merge와 해당 task의 유효 사용자 지시를 따르라. secret/실패 상태 push/hook 우회/main 직접 push는 하지 마라. 이번 설계-only task의 main merge는 범위 밖이다.

PR 본문: 목적·이전/이후 동작·M/N/F 완료/미완료·데이터/공개/검수 분모·대표 근거/화면·테스트·반대 리뷰·복구·남은 승인/교육 미검증. task evidence/submit과 인수인계는 현재 VFC 규약대로 진행하되 다른 owner의 완료 판정을 대신하지 마라.

## 8. 최종 보고 수용 기준

설계 문서를 썼다는 이유로 구현이 끝났다고 하지 마라. 구현한 7장면과 메뉴/복귀 흐름을 실제 검증 증거로 보여라. 기존 자산·state·유형·강의·진단·권한 정책이 보존된 것을 검사하라. 미검수 콘텐츠/불충분한 원리는 공개 v3 정본에서 제외하고 이유/범위를 보여라. 실제 사용자 교육 효과는 별도 검증 결과가 있을 때만 보고하라.

완료 보고에는 커밋/PR·검수 자료 위치·실행 명령/결과·데이터 결손/보류·별도 승인·미검증 범위를 포함하라. main merge/배포/교육 효과가 실제로 끝나지 않았으면 그 단계까지 완료됐다고 쓰지 마라.
