# Vocaflow 최종 목표 추적 원장 (FINAL LEDGER)

> 최상위 지시: 「VOCAFLOW FINAL MISSION」(2026-10-18 사용자). 목표 A~H 전체 경로 = 최종 제품.
> 작업 공간: `D:\workspace\Vocaflow-final-product` · 브랜치 `feat/vocaflow-final-product` · 기준 origin/main `c3a03d168`(#292 병합).
> 이 파일은 후속 세션이 같은 지시문만으로 이어 가기 위한 체크포인트다. 상태 값은 지시문 §2 의 7종만 쓴다.
> 근거는 코드·DB 직접 질의만(문서 수치 금지). DB 사실은 2026-10-18 `execute_sql` 읽기 질의로 확인했다.

## 0. 확인된 DB 사실 (2026-10-18 · 개발 DB `jajenrevcbmrpaliomxv`)

- 적용 이력: `20261017200000`(DB-1) · `20261017200100`(DB-2) · `20261018120000`(I2 주석 결속) · `20261018120100`(G2 결속) **모두 적용됨**.
  - 두 20261018 파일 머리의 「⚠️ 보류(적용 안 함)」 주석은 바이트 불변 승격의 흔적이다. 사실과 다르다(`R5_DB_APPROVAL_PACKAGE.md` 4행도 낡음).
- `content_qualification` 0행 · `workspace_content_delivery` 0행 → 실제 적격 콘텐츠 0건.
- `learning_task_attempts.item_ref` 는 자유 텍스트(FK 없음, 1–120자) — 비기출 산출물 ref 를 그대로 담을 수 있다.

## 1. 목표 A~H 상태

| 목표 | 상태 | 근거 · 남은 일 |
|---|---|---|
| A 시험 기록 · 현재 능력 | CODE_IMPLEMENTED · VALIDATION_MISSING | 기록 입력 `csat_dx_record_session` · `lib/csat/map/v4/as-is.ts`(독립 첫 시도만 상태 변경). 실학습자 검증 없음 |
| B 목표 설정 | CODE_IMPLEMENTED(점수·등급·시험·날짜) · INTEGRATION_MISSING(학습 조건) | `csat_map_goal_version` · `GoalBar`. 학습 조건 계약 `v62/target-spec.ts` importer 0 · DB 확장 승인 대기(D-12) |
| C 개인화 학습지도 | CODE_IMPLEMENTED · DATA_MISSING(22/29 TASK 콘텐츠 없음) | `?tab=map&view=full`. 정량 불확실성 표시 NOT_IMPLEMENTED(`to-be.ts` 는 무근거 수치를 의도적으로 만들지 않음 — 유지) |
| D 출제 원리 학습 | CODE_IMPLEMENTED(극장 7장면 · 근거/분류/비교/원리 패널) · NOT_IMPLEMENTED(②구조 · ⑤전체구조 상호작용) | v3.2 「내 말로」 저장은 PR #250 미병합 → INTEGRATION_MISSING |
| E 콘텐츠 공급 | CODE_IMPLEMENTED(FQ·승인·수요·주문·납품) · **NOT_IMPLEMENTED(자체 창작 산출물 종류)** · DATA_MISSING(적격 0) · EXTERNAL_APPROVAL_BLOCKED(기출 권리) | `artifact_kind` 에 창작 종류 없음. revision·노출·납품·G2 가 csat/dcp 만 처리. 권리 결정 증거 결속 없음 |
| F 학습 실행(Workspace) | CODE_IMPLEMENTED(기존 화면 링크) · NOT_IMPLEMENTED(납품 자료 실행 화면) | 앱에 수요/납품을 쓰는 경로 0. 「내 말로」 서버 근거 없음 |
| G 독립 전이 | CODE_IMPLEMENTED(G2 결속 RPC · 도움/연습/독립/전이 구분) · DATA_MISSING | 결속은 csat_item 만(창작 종류 거절). 실제 Postgres 동시성 VALIDATION_MISSING |
| H 증거 환류 · PLAN | CODE_IMPLEMENTED | `learner_workspace_plan` 추가 전용 · 사유 7종 · 학습자 확정. 납품 결속 근거가 지도에 반영되는지는 VALIDATION_MISSING |

## 2. 결정 기록

- **D-F1 (2026-10-18) 첫 적격 공급은 자체 창작 산출물 종류 `authored_item` 로 연다.** 근거: 두 AI 권리 검토가 기출 전체를 INSUFFICIENT 로 판정(`docs/research/r5-2020-24-review-packet-20261018/AI-VERIFICATION.md`). 기출 `csat_item` 으로 위장하지 않는다.
  - 창작물도 사람 확인 없이 권리·Gold PASS 를 기록하지 않는다 → 사람 결정 원장(`content_human_decision`, kind = rights | gold)을 새로 두고 공급 시점에 대조한다.
  - 채점은 기존 claim-support 형식(주장 · 뒷받침 · 관계)에 중심 의미 선다형을 더한다. 창작 지문은 우리 저작물이라 학습자에게 원문을 보여 줄 수 있다.
  - 교수·안내 연습과 평가(독립·전이·지연)는 **지문 묶음(passage group)을 공유하지 않는다** — 등록 RPC 가 막는다.
- **D-F2 Codex CLI 미설치(2026-10-18 확인).** 독립 검증은 별도 맹검 Claude 에이전트로 대신하고, Codex 검증 단계는 「미수행 — 도구 없음」으로 남긴다(PASS 로 세지 않는다).

## 3. 실행 순서(진행 표시 · 체크포인트 2026-10-18)

| # | 작업 | 상태 | 증거 |
|---|---|---|---|
| 1 | 창작 산출물 DB 패키지 `_pending_authored_supply.sql` | CODE_IMPLEMENTED · EXTERNAL_APPROVAL_BLOCKED(A) | PGlite 20 |
| 2 | R5 창작 9문항 + 맹검 A·B·C + 채점 보정 | CODE_IMPLEMENTED · EXTERNAL_APPROVAL_BLOCKED(B·C) | authored-items 14 · review/ |
| 3 | 앱: 공급 요청 · /csat/learn · 채점 · G2 결속 · 지도 Workspace 카드 · As-Is 환류 | CODE_IMPLEMENTED | tsc 0 · 광역 5,893 |
| 4 | 격리 종단(PGlite · 실제 SQL + 서버 코드) | ISOLATED_E2E_VERIFIED(LEVEL 1, 브라우저 제외) | authored-flow 10 |
| 4b | 격리 브라우저 E2E(CI 로컬 Supabase · 1280/1440) | VALIDATION_MISSING — 로컬 Docker 없음, CI job 추가 필요 | — |
| 5 | 단일 외부 승인 패키지 | 제출 대기 | [APPROVAL_PACKAGE](./APPROVAL_PACKAGE.md) |
| 6 | 영역 확장(V·S·R·E 22 TASK) | NOT_IMPLEMENTED(콘텐츠) — 창작 세트 형식 · 공급 경로는 TASK 무관하게 재사용 가능 | — |
| 7 | 기출분석 ②구조 · ⑤전체구조 상호작용 · v3.2 「내 말로」 병합(PR #250) | NOT_IMPLEMENTED / INTEGRATION_MISSING | — |

## 4. 다음 실행(후속 세션이 이 순서로)

1. CI 격리 job 에 「보류 창작 SQL 을 러너 DB 에만 적용 + 관리자 fixture 로 승인 흉내 + 학습자 브라우저 풀이 + DB 단언」 spec 추가(`apps/web/tests/e2e-isolated/`). 개발 DB 무관.
2. 영역 확장 — 창작 세트 JSON 을 TASK 별로 추가(형식 = `r5-central-meaning.v1.json`), `AUTHORED_TASK_KEYS` 에 키 추가, 맹검 2인 → 사람 Gold 패킷. 우선순위: R(ready 2: r.reference · r.relation) → E(e.evidence_location live) → V · S.
3. 기출분석 ② · ⑤ 상호작용, PR #250 재기반 병합 검토.
4. 승인 도착 시 §승인 후 실행 순서(APPROVAL_PACKAGE) → DEV_DB_E2E.

## 5. 외부 차단(사람 입력이 필요한 것만)

- A: 새 DB 변경 SQL·SHA 승인 · B: 평가 6문항 사람 Gold · C: 창작 원저작 권리 확인 — 모두 [APPROVAL_PACKAGE](./APPROVAL_PACKAGE.md) 한 곳.
- Codex CLI 미설치 — 독립 Codex 검증 미수행(맹검 Claude 에이전트로 대체, PASS 로 세지 않음).
- LEVEL 3 실학습 효과: `BLOCKED_EXTERNAL_PARTICIPANTS`.

## 6. 완료 판정(§15)

PRODUCT_CODE_COMPLETE ✗(영역 확장 · 기출분석 ②⑤ 남음) · ISOLATED_E2E_VERIFIED △(SQL+서버 ✓ · 브라우저 ✗) · DEV_DB_E2E_VERIFIED ✗(A 대기) ·
CONTENT_RELEASE_APPROVED ✗(B·C 대기) · SUPPORTED_TASK_COVERAGE_COMPLETE ✗ · EDUCATIONAL_EFFECT_VALIDATED ✗ · FINAL_COMPLETE ✗.
