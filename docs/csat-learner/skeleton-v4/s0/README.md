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
| S0-R05 | CORE-05 근거가 inline/visual type뿐 | `teaching-contract.ts#TEACHING_MODELS` 26 교수 모델 재사용, `AnalysisTheater.tsx:846` 재생 중 자동 장면 전환은 CORE-03/09 충돌 |
| S0-R06 | 유형 20/6·active 21/retired 5, cue `sec` | 19/7·22/4, listening_end 합 2,288, `est_sec`/`total_sec_est` |
| S0-R07 | 의미 검수 unknown, 유형 미상 11 | 의미 27은 로더 검사 통과(내용 정확성은 별도), 유형은 DB type_id로 조인 |
| S0-R08 | 허용 경로 불일치 | `task amend`로 `docs/csat-learner/skeleton-v4/` 추가 |

S0 판정 범위: 메타데이터 매핑·공백 보고·계약 충돌 식별. 내용 감수·UI·정상 로그인 RLS·학습 효과는 PASS가 아니다(NOT_EVALUATED / AUTH_BLOCKED).
