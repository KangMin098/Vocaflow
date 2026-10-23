# CSAT 전역 기본골격 v4.0 — S0 읽기 전용 실사 (2026-10-23)

기준서: 사용자 제공 `Vocaflow_CSAT_전역_기본골격_최종합의기준_v4.0_20261023.md`(저장소 밖, sha256 `a5c7fd8d…`). 이 폴더는 학습지도 v4(`docs/csat-learner/v4/`, 생성 원천 JSON)와 **다른 체계**다. AI-Control T-0131.

| 문서 | 내용 |
|---|---|
| [TYPE_REGISTRY](./TYPE_REGISTRY.md) | DB 26유형(독해 19·장문 7) + 로컬 수능 듣기 18유형(248문항), 실제 표본 ID, 미분류 16 |
| [READINESS_MATRIX](./READINESS_MATRIX.md) | 3,714 / 공개 3,412 분모별 자원·검수·공개 독립 상태 |
| [REPRESENTATIVE_EDGE_CASES](./REPRESENTATIVE_EDGE_CASES.md) | 유형별 실제 정상·경계 ID, 34·22·38 회귀, 강의 37 cue, 지정 6 수정 후보 |
| [GAP_AND_ASSUMPTION_REGISTER](./GAP_AND_ASSUMPTION_REGISTER.md) | DATA_GAP·UNKNOWN·AUTH_BLOCKED·QUERY_BLOCKED |
| [S1_ADAPTER_PLAN](./S1_ADAPTER_PLAN.md) | CORE-01~12 / AT01~20 매핑, S1 최소 순서, 역할별 반증 |
| [REPRODUCE.sql](./REPRODUCE.sql) · [CHECKS.json](./CHECKS.json) | 재현 질의·실행/차단 기록 |

문항별 메타데이터(5.7MB, 원문·선지 전문 없음)는 저장소에 넣지 않고 AI-Control `verification/reviews/T-0131-codex-s0-20261023/ITEM_METADATA.json`(sha256 `6d44c53c6861c87e…`)에 둔다.

## 정정 이력 (Codex 독립 대조 REJECT → run2)

run1(`6781f80d8`)의 결함 8건을 독립 검토자(`csat-v4-s0-verification`)가 재현했고, run2에서 Claude가 DB·코드로 다시 확인한 뒤 보완본을 정본으로 채택했다.

| ID | run1 오류 | 정정 |
|---|---|---|
| S0-R01 | 최신 in_review 186 중 183이 옛 공개판 노출(stale) | 반대: 이전 공개판 있는 것 **3**(H2103G2#28·H2104G3#28·H2410G2#41), 183은 공개판 없음 |
| S0-R02 | 듣기 확보 자료 없음 | DB 0이지만 `scripts/csat/data/classified.json`에 수능 듣기 **248문항·18유형** |
| S0-R03 | 표본이 조건 서술뿐 | 유형별 실제 정상·경계 ID |
| S0-R04 | 비교는 정적 import라 비공개 미전송 불가 | `page.tsx:181~202`가 서버에서 `projectV3Pairs`로 공개·결속 필터 후 전달 |
| S0-R05 | CORE-05 근거가 inline/visual type뿐 | `teaching-contract.ts#TEACHING_MODELS` 26 교수 모델 존재를 **평가 후보**로 기재(재사용 결정은 S1), `AnalysisTheater.tsx:846-852` 재생 중 자동 `selectScene`은 CORE-03/09 충돌 후보 |
| S0-R06 | 유형 20/6·active 21/retired 5, cue `sec` | 19/7·22/4, listening_end 합 2,288, `est_sec`/`total_sec_est` |
| S0-R07 | 의미 검수 unknown, 유형 미상 11 | 의미 27은 로더 검사 통과(내용 정확성은 별도), 유형은 DB type_id로 조인 |
| S0-R08 | 허용 경로 불일치 | `task amend`로 `docs/csat-learner/skeleton-v4/` 추가 |

v6.0 기준서(`Vocaflow_CSAT_5인_최종교차심사_목표우선_통합설계_v6.0_20261023.md`) 반영: S0 문서는 기존 코드의 **사실만** 기록하고 재사용 결정은 하지 않는다(S1에서 F01~F10 4대안 비교).

**기존 독립 수용 기록:** AI-Control `verification/reviews/T-0131-v6-recheck-20261023/INDEPENDENT_REVIEW.md`는 고정 커밋 `68633c195`의 원 작업 5문서에 대해 R01~R08 ACCEPT를 기록했다. 이는 메타데이터 등록·공백 보고·계약 충돌 식별에 한정된 S0 수용이며, TASK 전체 완료나 이번 Claude Code 재검증의 수용을 대신하지 않는다. 이번 재개에서는 아래 검증 결과와 함께 S0 범위 독립 재검증을 요청한다.

S0 판정 범위: 메타데이터 매핑·공백 보고·계약 충돌 식별. 내용 감수·UI·정상 로그인 RLS·학습 효과는 PASS가 아니다(NOT_EVALUATED / AUTH_BLOCKED).

## 2026-10-23 재개 검증과 제출 경계

- 이전 Codex PID 31224 종료 확인 → `task prepare-resume` 시도 → 공식 `task reap`으로 종료 실행만 회수 → 같은 owner `csat-v4-s0`·TASK·브랜치에서 run6 재개. 미커밋 변경이 없어 continuation은 적용되지 않았다. `9d559e3ab`·`68633c195`를 보존했다.
- 보존 `ITEM_METADATA.json`을 재집계했다. 3,714/3,698/16, 공개 3,412, in_review 186 중 이전 공개판 3/없음 183이 일치한다. 신규 실DB 질의 결과로 보고하지 않는다. 유형·listening_end는 기존 SELECT snapshot의 관측 시각을 유지한다.
- 94개 원천 파일 해시 변화 0, 분류기 630행 재실행 불일치 0, 듣기 248/18/14, 표본 ID 108회 대조, 37 cue의 version/시간 필드를 확인했다. 준비도 전체/공개 분모와 부록 언어 집계 분모·가중치 67/A7 0은 보존 자료와 일치한다. 미분류 원인 후보와 임시 로드맵 대응은 여전히 미검증이다.
- 관련 순수 테스트 3파일 25개 PASS/실패 0/skip 0. 의존성이 설치된 `D:/workspace/Vocaflow-main-serving/apps/web`에서 실행했으며 테스트·전이 의존성·설정/lockfile 20개가 작업 브랜치와 동일함을 해시로 확인했다. 작업 워크트리에 의존성을 설치하거나 제품 파일을 수정하지 않았다. 상세 기록은 [CHECKS.json](./CHECKS.json)의 `resumeVerification`과 AI-Control `runtime/t0131-resume-20261023/audit.json`에 있다.
- TASK 설명은 S1 F01~F10의 4대안 비교·34/22/38 시나리오·37 cue 공개/매체/상태 계약·AT01~26·S2 착수 조건까지 요구한다. **해당 S1 산출물은 없으며 S1 미완료, S2 착수 불가다.** 이 폴더의 `S1_ADAPTER_PLAN.md`는 S0 관측 대장이다.
- `task submit`은 TASK 전체를 REVIEW로 옮기며 단계별 제출 옵션이 없다(`lib/tasks.mjs#submitForReview`). 따라서 S0만으로 전체 TASK를 제출하거나 계약을 축소하지 않는다. 정상 절차는 현재 run의 S0 증거를 `task evidence`로 등록하고 고정 커밋의 S0 범위 리뷰 파일을 요청·보존하는 것이다. 다른 owner의 전체 TASK 완료 판정과 로컬 main 통합은 전체 계약 충족 후에만 진행한다.
