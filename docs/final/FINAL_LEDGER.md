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

## 3. 실행 순서(진행 표시 · 체크포인트 2026-10-18 저녁 · HEAD `22de94acf`)

| # | 작업 | 상태 | 증거 |
|---|---|---|---|
| 1 | 창작 산출물 DB 패키지 `_pending_authored_supply.sql` | CODE_IMPLEMENTED · EXTERNAL_APPROVAL_BLOCKED(A) | PGlite 20 · CI 러너 DB 실제 Postgres 적용 성공 |
| 2 | R5 창작 9문항 v2 + 맹검 A·B·C·D + 오답 근거 감사 | CODE_IMPLEMENTED · EXTERNAL_APPROVAL_BLOCKED(B·C) | review/ |
| 2b | FI-001(#293) 결속 출처 — 최신 납품 추측 제거 · 복구 API | CODE_IMPLEMENTED · ISOLATED 재현 6/6 | fi-001-provenance · delivery-binding 10 |
| 3 | 앱: 공급 요청 · /csat/learn · 채점 · G2 결속 · 지도 Workspace 카드 · As-Is 환류 | CODE_IMPLEMENTED | 광역 통과 |
| 4 | 격리 종단(PGlite · 실제 SQL + 서버 코드) | ISOLATED_E2E_VERIFIED(SQL+서버) | authored-flow 10 |
| 4b | 격리 브라우저 E2E(CI 로컬 Supabase · 1440/1280) | ISOLATED_E2E_VERIFIED(브라우저 · R5) — 1차 실패 원인(서버가 클라이언트 모듈 값 import) 수정 뒤 6/6 통과 · 보류 SQL 실제 Postgres 적용 성공 | CI run 39114115991 |
| 4c | 격리 브라우저 E2E — 창작 형식 9종(R5 밖) × 1440/1280 | ISOLATED_E2E_VERIFIED(브라우저 · 9종 PASS · R5 포함 10종) — 형식마다 납품·Gold 비노출·서버 채점·DB 결속·열기 세션·넘침 + 오답·안내 연습 비근거·응답 유실 재시도·재열기·승인 철회·키보드·지도 Workspace | CI run 39126159146 (`71a653ef6`) |
| 4d | 4c 가 잡은 제품 결함 3건 | 수정·재검증 PASS: content_needed Workspace 준비 중 오분류 · 지도 로더가 학습자 세션에서 service_role 전용 함수 호출(납품 링크 전부 유실) · 정본 연결 없는 TASK 링크 유실 | `4a751eeb9` `9647b45e1` `71a653ef6` |
| 5 | 단일 외부 승인 패키지(A · B · B2 · C) | 제출 대기 | [APPROVAL_PACKAGE](./APPROVAL_PACKAGE.md) |
| 6 | 과제 형식 레지스트리 + TASK 확장 6세트(E·E·R·R·S·V) | CODE_IMPLEMENTED · DATA(사람 Gold 전) | formats 12 · 세트 35 · expansion 리뷰 |
| 6b | 형식 4종 추가 + 나머지 TASK 세트 10개 · 맹검 2차 · 위치 단서 가드 | CODE_IMPLEMENTED · DATA(사람 Gold 전) | 17세트 위반 0 · AuthoredRunner 17 · expansion2 리뷰 |
| 6c | 통합 관찰 3(s.o · r.o · e.o) 관찰 계약 | CODE_IMPLEMENTED · VALIDATION_MISSING(브라우저) — 하위 TASK 직접 확인만 근거 · 측정 불가/근거 부족/통합 관찰 가능 · 점수 없음 | observation 14 · `22de94acf` |
| 6d | v.core_meaning | NOT_IMPLEMENTED(창작 세트 없음 — 지원 완료 표시 안 함) | — |
| 7 | 기출분석 ⑤ 구조 예측(서버 대조) · ② 구절 역할 먼저 짚기 | CODE_IMPLEMENTED · VALIDATION_MISSING(브라우저) | structure-check 3 · theater 54 |
| 7b | PR #250 「내 말로」 재기반 | main 병합(충돌 1 · 5,920 통과) · 마이그레이션 파일 버전을 적용 이력(20261014091841)에 맞춤 · 독립 리뷰 대기 | PR #250 코멘트 |

## 4. 다음 실행(후속 세션이 이 순서로)

1. PR #303: Codex 독립 판정(FI-001~013 + 4d 3건) 수용 대기 — 이 워크트리에 Codex CLI 없음, PR 코멘트로 요청(#issuecomment-6249838594). 수용 전 병합 안 함. 보류 SQL 개발 DB 미적용.
2. PR #250 재기반 결과 검토 · 독립 검증 · 안전 병합(safe-merge).
3. 남은 비보류 TASK 14개: 형식 추가(r.reference 지시 대상 · s.sentence_core 뼈대 표시 · v.semantic_relation 의미 동등 판정 …) → 작성 → 맹검 → 승인 패키지 B2 추가.
4. 독립 Codex 검증 요청(#293 반례 · 재전송 · 잘못된 delivery · PLAN 환류 · 새 형식 채점 계약).
5. 승인 도착 시 APPROVAL_PACKAGE §승인 후 실행 순서 → DEV_DB_E2E.

## 5. 외부 차단(사람 입력이 필요한 것만)

- A: 새 DB 변경 SQL·SHA 승인 · B: 평가 6문항 사람 Gold · C: 창작 원저작 권리 확인 — 모두 [APPROVAL_PACKAGE](./APPROVAL_PACKAGE.md) 한 곳.
- Codex CLI 미설치 — 독립 Codex 검증 미수행(맹검 Claude 에이전트로 대체, PASS 로 세지 않음).
- LEVEL 3 실학습 효과: `BLOCKED_EXTERNAL_PARTICIPANTS`.

## 6. 완료 판정(§15)

PRODUCT_CODE_COMPLETE ✗(v.core_meaning · 기출분석 ②⑤ 브라우저 · PR #250 남음) · ISOLATED_E2E_VERIFIED △(SQL+서버 ✓ · 브라우저 창작 10종 ✓ · 통합 관찰 · ②⑤ 브라우저 ✗) · DEV_DB_E2E_VERIFIED ✗(A 대기) ·
CONTENT_RELEASE_APPROVED ✗(B·C 대기) · SUPPORTED_TASK_COVERAGE_COMPLETE ✗ · EDUCATIONAL_EFFECT_VALIDATED ✗ · FINAL_COMPLETE ✗.

## 7. REWORK 체크포인트 (2026-10-18 밤 · HEAD `01c5e4bc0` · CI 39134594337 전부 success · e2e-shared-dev SKIPPED = 실DB 아님)

| 결함 | 수정 HEAD | 증거 | 상태 |
|---|---|---|---|
| FI-006 #298 | `a976d399a` | 실제 PG17 두 연결: 원본 SQL 4/6 → 수정 6/6 · 정상 대조군 2행 | 수정 · Codex 재검증 대기 |
| FI-010 #302 | `6e13095f6` · e2e `25b7d43b8` | 기록 실패 시 본문 0 · open-guard 3 · 실제 브라우저 1280/1440 재현(CI 39137567274) | 수정 · 재검증 대기 |
| FI-014 #307 | `a47755f94` | 문항별 대체 이유 4 · 형식 시험 5 · s-chunk-boundary revision 변경(승인 승계 없음) | 수정 · 사람 Gold 미승인 |
| FI-015 #308 | PR250 `bcc3b32a7` | 단일 CAS + 409 + 클라이언트 재전송 · route-race 5 · row-write-budget 141 유지 | 수정 · 재검증 대기 |
| FI-016 #309 | PR250 `4b210bbb8` | 비공개 인계 · 회귀 1 | 수정 · 재검증 대기 |
| FI-017 #310 | `40f058422` | PR250 실제 결합 · 중복 import 해소 · 결합 CI success | 수정 · 재검증 대기 |
| FI-018 #311 | PR #312 `cefc3e502` | safe-merge 20/20 · CI success · 비공개 인계 | 수정 · #312 먼저 병합 필요 |

- 승인 SQL 후보 SHA `dfb29f2dc3c3c0ecf516bdf47efa1d50f2f203ef7d399a60f3072d57c93ac229` · 개발 DB 미적용 · 사람 Gold/권리 0 · 적격 공급 0.
- 결정 대기: PR250 마이그레이션 `20261014091841` 첫 줄 주석을 적용 이력과 맞추는 변경(해시 bb4cc88d 일치 확인 · 자동 모드가 차단 → 사용자 결정).
- 병합 순서 제안: #312 → #250 → #303(#303 은 #250 을 포함). 모두 Codex 수용 전 병합 안 함.
