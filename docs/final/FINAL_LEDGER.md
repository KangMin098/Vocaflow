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
| FI-015 #308 | PR250 `bcc3b32a7`·`2549e407d` · e2e `88c3f1281` | 단일 CAS + 409 + 클라이언트 재전송(상한 5) · route-race 5 · push-retry 5 · 실제 브라우저 두 기기 1440/1280(409·유실은 가로채기) · row-write-budget 141 | 수정 · 재검증 대기 |
| FI-016 #309 | PR250 `4b210bbb8` | 비공개 인계 · 회귀 1 | 수정 · 재검증 대기 |
| FI-017 #310 | `40f058422` | PR250 실제 결합 · 중복 import 해소 · 결합 CI success | 수정 · 재검증 대기 |
| FI-018 #311 | PR #312 `cefc3e502` | safe-merge 20/20 · CI success · 비공개 인계 | 수정 · #312 먼저 병합 필요 |

- 승인 SQL 후보 SHA `dfb29f2dc3c3c0ecf516bdf47efa1d50f2f203ef7d399a60f3072d57c93ac229` · 개발 DB 미적용 · 사람 Gold/권리 0 · 적격 공급 0.
- 결정 대기: PR250 마이그레이션 `20261014091841` 첫 줄 주석을 적용 이력과 맞추는 변경(해시 bb4cc88d 일치 확인 · 자동 모드가 차단 → 사용자 결정).
- 병합 순서 제안: #312 → #250 → #303(#303 은 #250 을 포함). 모두 Codex 수용 전 병합 안 함.

## 8. 한 학습자 종단 격리 E2E (2026-10-19 · `39fe4fee0` · CI e2e 11/11)

`apps/web/tests/e2e-isolated/journey.isolated.spec.ts` — 같은 user id 하나로 끝까지(다른 spec 합산 아님).

| 구간 | 결과 |
|---|---|
| A 시험 기록 | PASS — 합성 회차 M9901(CI 격리 fixture · 실제 시험 아님) 저장 · 채점 |
| B 목표 | PASS — 목표 버전 생성 · 본인 행 |
| PLAN v1 | PASS — 같은 목표 버전 결속 |
| F 납품 · 학습 · 독립 2 · 전이 1 | PASS — R5 창작(격리 fixture 자격) · 실제 Runner · 서버 채점 |
| G2 | PASS — 3건 모두 그 납품에 결속 · evidence=true |
| H TASK 근거 상태 | **변경 확인** — `not_measured` → `checking`(직접 확인 판정) |
| H 다음 행동 | 변경 없음 — `relevance_unknown`(목표 시험 연결 확인 전) |
| PLAN v2 | 저장 PASS(check_result · 같은 목표 버전 · v1 보존) · **TASK 단계 변경 없음**(v1 · v2 모두 null — 같은 원인) |

- 발견·수정한 제품 결함: 날짜만 있는 시험 기록을 UTC 자정으로 읽어 KST 새벽 기록 뒤 PLAN 확정 422(`e54def25a`).
- 진단으로 확인한 정상 동작: 합성 도메인(example.com) 계정 시도는 지도 근거에서 제외된다.
- **증명되지 않은 것**: 「PLAN · 다음 행동이 수행 근거로 바뀐다」. 격리 DB 에 기준 시험(최근 평가원 회차) 문항 메타데이터 · 지도 라인 연결이 없어 To-Be 가 요구를 만들지 않는다. 다음 작업 = 그 메타데이터(원문 없이 배점 · 유형 · 라인 연결) fixture 로 relevance_unknown 해소 후 재검증.
- 이 시험은 relevance_unknown 일 때만 불변을 기록하고, 그 밖에는 변경을 요구한다.

## 9. FI-011 의미 환류 — 양성 경로 PASS (2026-10-19 · `f0790c5cc` · CI e2e 12/12)

| 경로(서로 다른 새 계정) | 근거 상태 | 다음 행동 | 저장 PLAN(TASK 항목) |
|---|---|---|---|
| 정답만(대조) | not_measured → checking | ind-1 → ind-2(가리킨 자료를 풀자 이동) | check 유지 — 진행만(가용량 = 미노출+수행 계약 · 규칙대로) |
| **양성 · 서로 다른 독립 확인 2 오답** | not_measured → **need_confirmed** | 「혼자 확인 ind-1」 → **없음 · 바로잡기 자료 필요** | **check → repair**(v2 → v3 · 같은 목표 버전 · v2 이력 불변) |

- 서버 isCorrect=false · G2 evidence=true(독립 첫 노출) · 같은 user/workspace/목표 버전.
- 발견 · 수정 결함: 바로잡기 단계가 방금 틀린 **창작 평가 자료**를 「받은 자료 · 혼자 확인」으로 다시 내밀었다(평가 자료 연습 재분류) → 바로잡기 자료에서 창작 평가 자료 제외 · 없으면 `repair_material_needed`(`539847fb3` · 빌드 수정 `f0790c5cc`).
- 남은 것: 바로잡기 **자료 자체**(교수 · 안내 연습 납품 → 바로잡기 단계 실행 → 성공 근거 → 적용 · 다시 확인). Codex 설계 요청.

## 10. 작업 큐 (FAST LOOP v3 · 2026-10-19 · 갱신 시각 기준)

| TASK | 목표 | 상태 | Claude owner | Codex | HEAD / PR | 파일 범위 | 다음 행동 |
|---|---|---|---|---|---|---|---|
| FI-011 바로잡기 수행 환류 | H(F·G) | **VERIFYING** | FINAL-OWNER | ACCEPT(01a14de8) — 앞 패킷 ACK, 이 HEAD 미인계 | `c45fe30c2` / #303 · CI 39209447701 진행 | authored/server.ts · AuthoredRunner · learn page · v4/plan.ts · journey spec | CI 통과 시 Codex 재검증 인계 |
| CI 빌드 캐시 | 총시간 KPI | **VERIFYING** | FINAL-OWNER | 미인계 | `3f1bed095` / #316 | .github/workflows/ci.yml(보호 경로) | 첫 실행은 캐시 생성 — 두 번째 실행부터 빌드 step 전후 비교 |
| #314 위임 정책 | 정책 | **REWORK**(PROPOSED 유지) | FINAL-OWNER | REWORK 6항목(DL-0186) | `59779da3b` / #314 | agents/policies · delegation.mjs | 신뢰된 채택 경로 · Codex 작성 주체 결속 · DB fail-closed 보완(우선순위 낮음) |
| #315 세션 라우터 | 협업 | **VERIFYING** | FINAL-OWNER | 미판정 | #315 | agents/sessions.json · codex-route.mjs | Codex 판정 대기 |
| #250 · #303 병합 | 통합 | **BLOCKED**(FI-011 수용 대기) | FINAL-OWNER | — | #250 `2549e407d` · #303 | — | FI-011 ACCEPT 뒤 최신 main 기준 safe-merge |
| A · B · B2 · C 승인 | E | **BLOCKED_EXTERNAL** | — | — | SQL `dfb29f2d…` | — | 사람 결정 대기 |

계측(CI 최근 5회): 전체 8.5~11분 · e2e 556s(빌드 217 · 브라우저 125 · Supabase 116) · 빌드는 3 job 이 각자 217~277s.

## 11. 협업 병목 실측 (2026-10-19 · FI-011/#304 · 원장: git · GitHub Actions · Codex 세션 기록)

구간 `f0790c5cc`(13:48 KST) → `bca65f920`(17:2x KST). 시각은 KST.

| 항목 | 실측 | 작업 / 대기 |
|---|---|---|
| CI | 17회 · 합계 168분(회당 ~10분) · 실패 6(진단용 반복 5 · Supabase CLI 다운로드 rate limit 1) | 대기 — 14:35~15:10 은 로컬에서 못 돌리는 격리 e2e 를 CI 로 4회 연속 진단(직렬 대기 ~40분) |
| Codex 리뷰 | 6턴 · 10~20분(합 ~85분) · 전부 REWORK | 작업 |
| Codex 전달 지연 | 90cff 인계 → 시작 즉시 · cd17 인계(16:52 큐) → 시작 17:20(28분) — 직전 턴 종료 뒤에도 큐 처리 대기 | 대기 |
| 재작업 | 설계 경합 1회: Codex 확정 전 재풀이 경로 구현(aa518 · 14:07) → 확정 설계와 달라 되돌림(db22abd · 4b9e7) 후 f140 재구현(16:07) — 약 2시간 | 낭비 |
| 실제 수정 | REWORK 수신 → 수정 커밋: 90cff 판정 → cd17 약 15분 · cd17 판정 → bca65 약 10분 | 작업 |
| 중복 리뷰 | 같은 SHA 재리뷰 0 · Codex 가 c45fe 반례를 재사용(재시험 생략) | — |
| PR CI 누락 | cd17 push 뒤 CI 미실행 35분 — #316 병합으로 PR CONFLICTING → pull_request 이벤트 안 뜸 | 대기(발견 지연) |

조치(같은 날): ① 인계 · 판정 결속 `codex-route.mjs handoff|verdict`(#315 · 자동 호출 없음 정책 유지) — git 에서 인계문 조립, 같은 HEAD·diff·수용 기준 재사용, 작업당 3회 상한 분류, 판정을 작업 ID + HEAD 에 결속(실제 응답 08:30 → cd17 결속 확인). ② push 직후 CI 와 Codex 인계를 병렬로(bca65 부터). ③ CI 감시는 전체 SHA 로 조회하고, 실행이 안 뜨면 PR mergeable 부터 본다.
남은 병목: 격리 e2e 를 로컬에서 못 돌려 CI 가 진단 도구가 되는 것(직렬 10분/회) · Codex 큐 처리 지연(28분 · Codex 런타임 쪽 — 이 저장소에서 못 고침).

## 12. T-0050 / rev5 — 바로잡기 → 적용 → 새 독립 확인 → G2 → MAP → PLAN (2026-10-20)

- 수신: AI-Control 큐 T-0050 · 설계 rev5(SHA 05ea6433… 대조 일치) · ACKNOWLEDGED 14:55Z · IMPLEMENTATION_STARTED 기록. 큐 `task start` 는 worker 등록이 사람 대화형 터미널 전용(TRUST_REQUIRED)이라 미실행.
- 구현 HEAD `57d03fd38`(앞 `b060561a7`): 격리 여정에서 안내 연습 · 전이 · 다시 확인 자료를 **실제 자료 받기 API** 로 받는다(단계별 수요 = 교수/안내 · 전이 · 독립 확인 · 평가 역할을 연습에 섞지 않음). 다시 확인 두 갈래 — pass: 새 지문 2 정답 → `passed_current_policy` · fail: 다시 틀림 → PLAN repair · 다음 행동 안내 연습(이전 성공 불승계). 처음 독립 오답 · PLAN v3~v5 불변 단언.
- C7 P2: 받은 자료 목록 링크에 지도 복귀 문맥 · 노트 소개 문구 modelLabel. 원노트 연결 메타데이터는 미구현(한계).
- 검증: 로컬 tsc · eslint · 관련 단위 1,390. `b060561a7` PR CI 격리 e2e — 새 종단 pass 통과, 실패 2 는 링크 기대값(수정). `57d03fd38` 원격 CI_PENDING — **LOCAL_FAST 는 기다리지 않는다**(원격 상태는 AI-Control `state/REMOTE_INTEGRATION.json` 에서 따로 추적).
- Codex 독립 수용: 인계 2회(01a154b4 · 01a154ba) queued · 판정 대기.

## 13. 창작 17세트 ↔ 실제 제품 흐름 연결 실측 (2026-10-20 · 저장소 정본 직접 대조)

- 원장: `apps/web/src/lib/knowledge/authored/*.json`(세트 · 역할 수) × `docs/csat-learner/v4/workspaces.json`(9 Workspace 의 core).
- **중심 Workspace 있음 7/17** — r.central_meaning · e.evidence_location · e.option_correspondence · r.inference · r.relation · s.form_scope · v.contextual_sense.
- **중심 Workspace 없음 10/17** — e.task_demand · r.discourse_function · r.discourse_structure · r.reference · s.attachment · s.chunk_boundary · s.sentence_core · s.structural_relation · v.multiword · v.semantic_relation. 「자료 받기」 카드는 Workspace 팝업의 core[0] 에만 뜨므로 학습자 진입 경로가 없다.
- **다시 확인 재고**: R5 만 independent_check 4(ind-3 · 4). 나머지 16세트는 2 — T-0050 순환(바로잡기 → 적용 → 다시 확인)을 밟으면 다시 확인이 항상 `material_needed` 에서 멈춘다.
- 다음 작업 후보(Codex 설계 입력 · 미채택): ① 10세트의 학습 진입 경로(기존 Workspace 보조 TASK 공급 또는 Workspace 정의 확장 — 정본 변경이면 사용자 결정) ② 7세트 다시 확인용 미노출 independent_check 2개씩 추가 작성(Gold · 권리는 사람 승인 별도).

## 14. T-0066 / rev1 — 보조 발문 요구(e.task_demand) 적용 · 새 독립 확인 순환 (2026-10-20)

- 세트 `e-task-demand.v1.json` 보충: independent_check 2(td-ind-3 「제목」 · td-ind-4 「흐름과 관계 없는 문장」) · transfer 1(td-transfer-2 「글의 순서」) — 새 지문 묶음 td-t7 · t8 · t9(기존 6문항 · 채점 계약 불변, diff 는 추가뿐). 검증기 통과.
- 세트 SHA-256 `8a91033b38d9ee68108a02422aff00790f0c21b5428facb4c56a2fa78c068bda`(이전 `dce3db7087d13ec1e069eb122eda5cca1a7201d6aba0b4fc30113ff4a2be0d55` — docs/final/APPROVAL_PACKAGE.md 표의 값은 이 작업 범위 밖이라 갱신 안 함 · 승인 직전 재대조). 사람 Gold · 권리 pending 유지 — 이전 revision 의 검토 · 승인은 승계하지 않는다.
- 검증: PGlite cycle() 에 보조 TASK 순환(pass/fail) 추가 · T-0056 부족 반례는 td-transfer-2 권리 철회라는 **명시적 재고 제한 fixture** 로 유지. 격리 브라우저 authored-support 를 전체 순환으로 확장(1440 pass · 1280 fail). 격리 fixture 의 임시 자격은 실제 DB 적용 · Gold · 권리 · 출시 · 학습 효과 승인이 아니다.

## 15. T-0068 — 비보류 13 TASK 새 독립 확인 재고 · 전체 순환 (2026-10-21)

- 13세트(s.attachment 제외 · 이미 끝난 R5 · 근거 위치 · 발문 요구 3세트 불변)에 세트마다 independent_check 2 + transfer 1, 모두 39문항 원창작 보충 — 새 지문 묶음 · 서로 다른 글 · 기존 6문항 바이트 그대로(diff 는 추가뿐) · 형식 · 교수 목표 유지. 제품 검증기(validateAuthoredSet) 통과 · 채점기 · 검증기 무변경.
- 세트 SHA-256(직전 → 지금):
  - e.option_correspondence `e-option-correspondence.v1.json` `c49e67cf1f0c802b84f7875e6a54a4e2c31bdbb3f0805010d4c4d93b1b87b3af` → `09654111ee813850861249cfb142ce0ec887c36bd65ffd15294911ed5115ea0f` · +opt-ind-3 · opt-ind-4 · opt-transfer-2
  - r.discourse_function `r-discourse-function.v1.json` `78fda0a70c72a068e471a43e50e72335c97d99d83bb7d0db764be884b323a1c6` → `a50f17d423ae4b1d09a9970be80ec0e6b9033f949a04f6f0b65f2c23faf1b083` · +df-ind-3 · df-ind-4 · df-transfer-2
  - r.discourse_structure `r-discourse-structure.v1.json` `3592c1cda72fcfd1cecbaddbd9caf427f51c894cf4750d9d9bc0302881f46064` → `3f8345758d6106c7dfc8348004fb5d246903fea70c8cfd32d1644c10b9374a9e` · +ds-ind-3 · ds-ind-4 · ds-transfer-2
  - r.inference `r-inference.v1.json` `fef751a23b29855d1ebf15f66dc7686c21fec2852259e71cbaba250ceb9c0ff5` → `651ccbe064fbc5ba63feea4e2e3fa3d0522eb378649bffd03f3ffa27cda3902d` · +inf-ind-3 · inf-ind-4 · inf-transfer-2
  - r.reference `r-reference.v1.json` `f97e759117cfff8dc4973d443e5402f70351379f146df9d97a396bb8ee9668f1` → `6807473e00f86c456b6500ca8007bc5e497196dc2f1930183d25d6024f5f5ecf` · +ref-ind-3 · ref-ind-4 · ref-transfer-2
  - r.relation `r-relation.v1.json` `9ce1b82dc3e1820ef1b76330f3e7826e64200e6949a38f0184ed1f3a3ccad98b` → `4a8c34feaa40228b3ec2389b6c6a7bd8852f067ba181e708e1285389bf7d5ea0` · +rel-ind-3 · rel-ind-4 · rel-transfer-2
  - s.chunk_boundary `s-chunk-boundary.v1.json` `c21b2cc6b24fa5f26702053deb9b8db19e38c5532f8b7d19bffbd5483ed42297` → `c7a0526ce33047116682931bc5818e12a05f4f87a2015737783b2e854e02f2de` · +cb-ind-3 · cb-ind-4 · cb-transfer-2
  - s.form_scope `s-form-scope.v1.json` `b388404c29bcc859dfe0163d7870dfacef255ff3b53b4413d81c5ce8c7d3e7b7` → `cedf02062f07755698bd3816f889baf5959942a80dbaceefa334a3dfaafb1604` · +gs-ind-3 · gs-ind-4 · gs-transfer-2
  - s.sentence_core `s-sentence-core.v1.json` `e2e0af18847830e6adb47ffebb983def3c65733d39e9ca0501fe8e66b650323f` → `b10859fbc4b7cab9063d306804ee2f2a218deaf9bc861dd47b7ceb7e4843fcc9` · +sc-ind-3 · sc-ind-4 · sc-transfer-2
  - s.structural_relation `s-structural-relation.v1.json` `c83b207fc8552218347618f78c014f12fa0fd261e0f7a74069a6c2f918750362` → `d393dfe4bd475fee2b677f2170e176e291694536b092a71eb7ab8834df34b83c` · +sr-ind-3 · sr-ind-4 · sr-transfer-2
  - v.contextual_sense `v-contextual-sense.v1.json` `4bbc973cdaffd8df36e6ab780fc4fefd3e7638e0a818e5a8652772e7f2ad5798` → `fb8bfaeba6461a2cf94ae65d22c95240c88e9a283f72f2bfaca840c5c3026ddb` · +vcs-ind-3 · vcs-ind-4 · vcs-transfer-2
  - v.multiword `v-multiword.v1.json` `103170d35eeed46b6843659296ce936e97f1dad5dae2f6c54b22f8f96435bb52` → `179725ab501da614cebd6d2076f475b2123829657e194e462fb579a5f49fb5b6` · +mw-ind-3 · mw-ind-4 · mw-transfer-2
  - v.semantic_relation `v-semantic-relation.v1.json` `2e4ae006891873b9eb43dc069086505bb8564831e25eed870fdd7015118d7f87` → `2763dfa3786da48773b54f0f74e3eb8dcf0ceeb710924d478aefe94c59995358` · +sem-ind-3 · sem-ind-4 · sem-transfer-2
- APPROVAL_PACKAGE 표를 이 값으로 갱신하고, 표에 남아 있던 발문 요구의 낡은 값(`dce3db70…`)도 실제 `8a91033b…` 로 맞췄다. 사람 Gold · 권리는 **pending 그대로**(승인 상태를 올리지 않음 · 이전 revision 의 검토 · 승인은 승계하지 않는다).
- 검증: PGlite cycle() 을 13 TASK 실제 공급 · 서버 채점 · G2 결속 · As-Is · PLAN pass/fail 로 확장(44/44). 형식별 유효 정답 · 유효 오답은 시험 어댑터 `apps/web/src/lib/knowledge/__tests__/authored-responses.ts`(제품 채점기로 17세트 전 문항 자체 검증). 격리 브라우저 `authored-format-cycle` = option_correspondence(중심) · segment_choice(보조) 1440 pass · 1280 fail. 격리 fixture 는 합성(「CI 격리 fixture — 사람 결정 아님」) — 실제 DB 적용 · 사람 승인 · 학습 효과로 세지 않는다.
- 발견(범위 밖 · 보고): 정본 준비 상태가 live 가 아닌 Workspace(ws.inference · ws.cohesion · ws.grammar-scope · ws.vocab-context)의 중심 TASK 는 적용 단계에 자료가 없을 때 PLAN 이 `material_needed` 대신 `no_content` 를 낸다(`map/v4/plan.ts:272` 가 home.readiness 만 본다). 순환 자체(단계 · 공급 · 해소)는 같다. map/v4 는 이 작업의 금지 경로라 고치지 않았고 시험은 현재 동작을 명시적으로 단언한다.
- rev1 REWORK(Codex P1 · 문항만): gs-ind-3 = 행위자 by 구가 있는 완료 수동(have abandoned → have been abandoned)으로 유일 오류화 · sc-transfer-2 = 고지대 제빵 사실 정정(takes less yeast · CSU Extension 「Baking at Elevation」) · P2 df-ind-4 · rel-ind-4 를 가상 사례로 표시. 위 SHA 는 수정 뒤 값. 채점기 · 검증기 · 엔진 무변경 · Gold/권리 pending.

## 16. T-0069 — V1 기본 의미(v.core_meaning) 학습 진입 · 같은 지도 복귀 (2026-10-21)

- ws.vocab-context 팝업의 보조 v.core_meaning 에 `VocabLearningCard`(창작 공급 카드 아님) — 기존 WordVault 복습(`/wordvault/review` · FSRS 자기 평가)으로 보낸다. 카드는 단어 수 · 오늘 복습 수 · 시험 빈도를 세지 않는다(조회 없이 만들지 않음).
- 복귀: `map-return` 의 고정 내부 경로 `VOCAB_PATHS`(/wordvault/review 하나) · `vocabMapReturnHref` — from=map 일 때만 전체 지도 + 검증한 문맥(map_task · ws · map_ws · map_plan · map_goal). map_item · map_attempt 는 싣지 않고 들어와도 버린다. 문맥 없는 일반 진입 · 옛 주소는 그대로.
- 복습 화면(지도에서 왔을 때만): 「학습 지도로」 막대 + 「학습 기록이지 지도의 확인 · 해소 근거가 아님」 안내 · 빈 단어 = 내 단어장에서 모으기 안내(「잘 따라가고 있어요」 아님) · 조회 실패 = 「0개가 아님」 알림(일반 진입은 예전처럼 오류 경계) · 끝난 뒤에도 「학습 지도로 돌아가기」.
- 근거 비승격: 뜻 보기 · 예문 · 자기 평가는 learning_records(FSRS)만 쓴다 — CSAT 시도 · G2 결속 · 계획 · 목표 이력 불변(격리 e2e 가 행 수로 단언). V1 직접 확인 도구는 아직 없다고 카드가 알린다. 지연 유지 간격은 정본 미승인 그대로(evidence-claims NOT_ESTABLISHED 무변경).
- 검증: 단위 map-return-vocab 6 · vocab-learning 6(빈 단어 · 조회 실패 · 문맥 없음 대조군) · web vitest 510 files pass. 인증 격리 `vocab-core-roundtrip` 1440/1280(지도 → 키보드 복습 진입 → 실제 복습 1회 → 완료 → 키보드 복귀 → 같은 Workspace 팝업) — fixture 는 격리 DB 의 내 단어 1개(합성).

## 17. T-0070 — 목표 → TASK 근거 · 이번 학습량 · 도달 조건 → 지금 할 행동 · 수행 후 PLAN 을 한 지도에 (2026-10-21)

- 화면: 전체 지도 상단 GoalRecordBar 아래 접힌 `GoalPlanSummary`(처음 한 줄: 목표에 필요한 TASK 수 · 지금 할 수 있는 수 · 시험 기록 수와 직접 확인 TASK 수를 따로). 펼치면 TASK 행 = NeedRank 순서 · 영역 · 목표와의 관계(사실 문항 · 배점) · 내 근거(직접 확인 vs 기출 관찰 간접) · 이번 단계 학습량(저장한 계획 / 제안 / 자료 없음 이유 / 조회 불가) · 도달 조건 · 「지금 할 수 있어요 n」(ActionRank · 상단 CTA 와 같은 지도 복귀 문맥) 또는 막힌 이유 · 같은 Workspace 계획 · 자료 버튼. 새 화면 · 새 순위 · 점수 · 기간 · 숙달률 없음.
- 계산: `lib/csat/map/v62/goal-plan.ts` — V4View · Ranks · 저장 계획만 읽는다. 계획량 = PLAN 편집기와 같은 applySaved(quantityBasis(latest)) · 같은 단계 저장 행만 「저장한 계획」.
- 결함 수정 ① `map/v4/plan.ts` — 정본 readiness 가 live 가 아니어도 단계가 열렸거나 단계 자료 링크가 있으면 no_content 가 아니라 그 단계 실제 상태(material_needed · shortage · stage_locked). readiness 는 live 로 올리지 않는다 · 실제 자료 없으면 null · no_content 그대로. T-0068 PGlite 의 notLive 예외를 지우고 13 TASK 모두 material_needed 를 단언.
- 결함 수정 ② `GoalRecordBar.mapStateOf` — 시험 기록 0 이어도 direct_check 근거가 있는 TASK 가 있으면 no_record 로 다음 행동을 숨기지 않는다(시험 proxy 는 승격하지 않음 · 기록 0 · 근거 0 · 목표 없음 대조군 유지).
- 검증(로컬): Codex probe 7/7(기준 5 실패 → 통과 · 정상 2 유지) · 이식 회귀 plan.test(readiness 4 + 정상) · map-state-direct 3 · goal-plan 6 · goal-plan-summary 5 · authored-flow PGlite 44 · web vitest 513 files. 인증 격리 `goal-plan-summary` A(1440 오답 → 바로잡기) · B(1280 정답 → 근거 축적) 작성 — 로컬 격리 Supabase 없음으로 **NOT_VERIFIED**, 다음 공식 통합 묶음 CI 에서 실행.
- rev1 REWORK R1(Codex P1 3): ① 요약 행 실행 링크에 상단 CTA(nextActionOf)와 같은 관문 — 그 묶음 저장 계획 없음 = 「계획 먼저 확정」 · 저장 뒤 자료/단계 변화(replanNeeded) = 「다시 확정」, 그때는 실행 링크 없음 ② 관련성 미확인을 「목표에 필요한 TASK」 수에 넣지 않고 「관련성 확인 전 n개」로 따로(행은 유지) ③ 지난 기준(past)은 보기 전용 — 실행 링크 · 계획/자료 버튼 없음 + 지금 기준 안내. Codex 새 probe 6/6 · 기존 probe 7/7.

## 18. T-0071 — Workspace 에서 내 원리 노트 · 고쳐 쓴 설명 다시 찾기 (2026-10-21)

- 받은 자료 카드(중심 · 보조) 안에 접힌 `LearningNotesPanel`(「내 원리 노트」). 펼칠 때만 GET /api/csat/state 를 읽는다 — PUT · loadSyncedDissectionRecord(기기 병합) · 새 캐시 · 새 저장소 없음. 카드가 이미 받은 그 TASK 본인 납품 목록(GET /api/csat/authored?task=…)과 잇는다.
- 결속(`lib/csat/map/v62/learning-notes.ts`): 노트 item = 납품 ref · 노트 authored.deliveryId = 납품 id · 납품 역할 = 원리 설명/안내 연습일 때만. 다른 TASK · 남의 납품 · 평가 역할 · 결속 없음(기출 노트)은 넣지 않는다. 처음/고친 계보는 T-0063 rootNoteOf/revisionChain(같은 문항 전체로 세우고 결속된 노트만 보임).
- 상태: 성공한 빈 목록 ≠ 확인 못 함(401 로그아웃 · 423 보류 판정 · 오류 · 공급 미설치). 보류로 걸러진 노트를 기기 사본으로 되살리지 않는다. TASK 가 바뀌면 key 로 새로 그리고 늦은 응답은 요청 순번으로 버린다.
- 이어 보기: 지금 유효(current=true)한 교수 납품만 「이어서 보기 · 대조하기」(withMapReturn + outgoingCtx · map_item/map_attempt 제거). 철회 · 미확인 · 지난 기준은 노트만. 지금 설명판과의 대조 완료를 주장하지 않는다(학습 화면 판 검사에 맡김). 노트 조회는 G2 · As-Is · PLAN · 숙달로 세지 않는다.
- 검증(로컬): learning-notes 7 · learning-notes-panel 5(렌더 · 상태 · 링크 문맥) · web vitest 515 files · tsc 0 · lint 0. 인증 격리: map-return-recap 의 T-0063 노트 여정을 확장(키보드 펼치기 → 처음/고친 계보 → 유효 안내 연습으로 이동 → 같은 지도 복귀 · 결속/계획 행 수 불변) — 미실행 NOT_VERIFIED, T-0070 A/B 와 같은 공식 통합 묶음 CI 에서 실행. jsdom/testing-library 가 없어 늦은 응답 버림은 단위가 아닌 코드 구조(순번)로만 보장.
- rev1 REWORK R1(Codex T0071-P1-1): 패널은 그 범위(보는 사람 · TASK · 납품 id 집합 — 안정 문자열)에서 읽은 노트 원본만 저장하고, 묶음 · 현재 자격 · 링크는 렌더마다 최신 rows 로 계산(notesView). 범위가 바뀌면 이전 결과 · 진행 중 요청을 순번으로 버리고 열려 있으면 다시 읽음 · rows 배열 참조만 바뀌면 재조회 없음. 납품 목록 오류 · 미설치 · 준비 중이면 이전 노트 · 링크 없이 확인 못 함. 철회 뒤 같은 본인 노트는 읽기만. viewer 를 WorkspaceModal → AuthoredSupplyCard → 패널로 전달. 검증: Codex Chromium 컴포넌트 프로토콜 수정 사본 11/11(완료 대기만 새 정상 동작으로) · 단위 15 · csat 2696.

## 19. T-0072 — 목표 변경 뒤 이전 PLAN 구분 · 새 목표 계획 확정 연결 (2026-10-21)

- 판정: `next-action.goalMismatch(ws, saved)` — 그 묶음 최신 저장 PLAN 의 goalVersionId ≠ 지금 목표 버전이면(옛 계획 null 포함 · 저장본 조회 실패/없음은 판단 안 함) 단계 · 자료 · 수량이 같아도 지금 목표의 확정 계획이 아니다. replanNeeded 가 이를 포함 → 상단 CTA(nextActionOf · replanWhy=goal) · 요약(goalPlanRows · planGate=replan · replanWhy) · 편집기(PlanSection)가 같은 판정.
- 화면: 상단 「계획 다시 확정하기」 + 목표 변경 이유 문구 · 요약 「목표가 바뀌었어요 — 지금 목표로 다시 확정한 뒤 시작」 · 편집기는 「저장됨」 대신 그때 목표 기준 안내(plan-goal-changed · 저장/지금 목표 버전) · 기본 저장 사유 goal_change. 같은 목표는 저장량 · 실행 링크 그대로. 과거 모드는 보기 전용.
- 저장: 기존 PlanSection 제출 · 서버 CAS(expectedVersion = 현재 저장 버전 · expectedGoalVersion = 지금 목표) · 멱등 키 재사용 — 학습자가 누를 때만 append-only 새 버전, 숨은 POST 없음. 확정 뒤 router.refresh 재조회로 새 목표 결속이 확인돼야 저장됨(확정 중 목표가 또 바뀌면 저장됨 아님). 이전 PLAN · 목표 이력 · G2 · 최초 독립 근거는 그대로.
- 검증(로컬): Codex goal-version probe 5/5(반례 3 · 정상 2) · next-action 목표 결속 5(옛 계획 · 조회 실패 대조 포함) · plan-goal-refresh 렌더 3 · csat 2704 · tsc 0 · lint 0. 실제 Chromium(실제 React PlanSection · POST 모의 · refresh=재조회 흉내) 5/5: 1440/1280 새 목표 → 안내 → 키보드 재확정(body reason=goal_change · expectedGoalVersion=지금 · expectedVersion=현재) → 재조회 뒤 저장됨 · 확정 중 목표 재변경 → 저장됨 아님 · 같은 목표 정상(숨은 POST 0) · 과거 보기 전용. 인증 격리 `goal-plan-version` 1440/1280 작성 — NOT_VERIFIED, 다음 공식 통합 묶음 CI.
- PR #328 REWORK(Codex T0072-P1-2): 첫 CI 39551480304 의 상단 CTA 는 같은 TASK(r.central_meaning · data-kind=supply) — 지금 할 활동이 없을 때 nextActionOf 가 자료 받기/기다림 분기를 목표 판정보다 먼저 골랐다(앞선 「다른 TASK」 설명은 틀렸다 · 정정). 최소 수정: 저장 PLAN 이 다른 목표에 묶였으면(goalMismatch) 보류 아닌 한 자료 받기·기다림 전에 같은 묶음 계획 다시 확정(replanWhy=goal). 저장 전 · 같은 목표 부족=자료 받기 · 보류 · 조회 실패는 그대로. 반례(실제 ranksOf · 자료 0) 이식 · goal-plan-version 에 재확정 전 상단 단언 복원 + 재확정 뒤 같은 TASK 자료 받기.

## 20. T-0073 — 시험 기록 없는 학습자의 목표에서 첫 직접 확인까지 (2026-10-21)

- GoalRecordBar: 목표 있음 · 시험 기록 0 · 직접 근거 0(no_record)에서도 기존 nextActionOf 의 다음 행동(저장 전 계획 확정 · 자료 받기 · 시작 · 기다림 이유)을 상단 주 행동으로 쓴다. 상태는 no_record 그대로 · 추천 아래 「기출 기록이 없어 근거가 부족해요 — 약점으로 정한 것은 없어요」 안내 유지(umap-no-record-note) · 「또는 기출 한 회 기록하기」는 보조. 다음 행동이 없으면 예전처럼 기록 CTA. 목표 없음 · 과거 보기는 실행 행동 없음. T-0072 목표 재확정 보호 그대로. 새 순위 · 진단 · 수량 · 저장 없음.
- 검증(로컬): Codex no-record-start probe 3/3(기준 1 실패 → 통과 · 대조 2 유지) · no-record-start 5(계획 확정 · 같은 목표 자료 0 = 자료 받기 · 목표 변경 재확정 · 목표 없음 · 과거) · map-state-direct 3 · map/diagnosis 1335 · tsc 0 · lint 0. 실제 Chromium(실제 GoalRecordBar · 고정 데이터) 4/4: 1440/1280 미측정 안내 + plan CTA 키보드 → 같은 Workspace 계획 탭 · 기록 보조 · 넘침 0 / 목표 없음 · 과거 대조. 인증 격리 `map-no-record-start` 1440/1280(기록 0 → 목표 → plan 확정 → 자료 받기 → 필요 시 재확정 → start → 혼자 확인 1회 → 같은 Workspace → G2 근거 1 · 시험 기록 0 유지) 작성 — NOT_VERIFIED, 다음 공식 통합 묶음.

## 21. T-0074 — 지금 확인한 범위 vs 정본 도달 조건 (2026-10-21)

- GoalPlanSummary: 직접 확인(basis direct_check) 행에 기존 근거 칩(EvidenceChips · view.evidence)을 함께 보인다 — 지금 정책 통과여도 「시간 지나 다시 확인 · 아직 근거 없음」(delayedRetention NOT_ESTABLISHED)이 옆에 남고, 통과 행에는 「지금 정책의 다시 확인은 통과했어요 — 도달 조건의 「다른 날」 유지는 아직 확인하지 않았어요」 안내. 범위 자료 없음 = 「확인할 수 없어요 — 0개라는 뜻은 아니에요」 · 원장 불명확 = 범위 확인 불가 안내. 직접 근거 없는 행에는 칩 · 안내 없음. GoalRecordBar 이유 문구에도 다시 확인 근거 없음. 정본 도달 조건 원문 · 새 판정 · 숙달/학습 효과/장기 유지 문구 없음.
- 검증(로컬): Codex criterion-scope probe 3/3 · criterion-scope 렌더 5 · 관련 21 · tsc 0 · lint 0. 실제 Chromium(실제 React GoalPlanSummary · 고정 데이터) 2/2: 1440/1280 통과 · 미측정 · 원장 불명확 행 · 키보드 펼치기 · 넘침 0. 인증 격리 journey pass 분기에 요약 칩 · 안내 단언 추가 — NOT_VERIFIED, 다음 공식 통합 묶음.

## 22. T-0075 — 풀이 저장 뒤 자료 연결 실패 복구 · 같은 수행 지도 복귀 (2026-10-21)

- AuthoredRunner 「다시 연결하기」: fetch 거절 · HTTP 오류 · JSON 모양 이상을 잡아 「방금 다시 연결하지 못했어요 — 풀이와 답은 그대로」 + 같은 버튼(키보드)으로 재시도. 결과 · 답 · clientMutationId · deliveryId 보존, 답 재전송 · 새 시도 없음, 반복 클릭 잠금 · finally 복원 유지. 첫 응답에 결속 메타가 없으면 「연결됐는지 확인하지 못했어요」 + 다시 연결하기(이전엔 아무것도 안 보였다).
- 결속 문구(binding-feedback.ts): evidence===true 만 「혼자 해낸 근거」. false 는 DB CHECK 닫힌 사유 7개만 사실대로(철회 · 첫 노출 아님 · 노출 확인 불가 · 자격 변경 · 납품 무효 · 도움 상태 불일치 · 연습 자료). 누락 · null · 미지 사유 = 확인 못 함 — 「연습 · 도움 받은 풀이」로 추정하던 문구 제거.
- 복귀: bind API 가 boundAttemptId(학습자 세션 · user_id · 결속 id 로 결속 행의 attempt_id — server.ts 정상 제출과 같은 helper)를 함께 돌려주고, Runner 는 양의 정수만 받아 map_attempt 로 잇는다. 조회 실패 · 남의 결속 · 없음 = null(이번 활동 특정 안 함). 새 표 · SQL · 판정 없음.
- 검증(로컬): binding-feedback 6 · bind route 3 · PGlite authored-flow 45(복구 멱등 · 같은 수행 id · 시도/결속 행 수 불변 · 다른 학습자/결속 아님/모르는 id null 포함) · authored Runner/delivery-binding 관련 · tsc 0 · lint 0. 실제 Chromium(실제 AuthoredRunner · 통제 HTTP 응답 · 인증/DB 아님) 16/16: 1440/1280 × unknown · revoked · network(첫 거절 → 키보드 재시도 성공) · http · shape · recovered · 메타 손실 · normal — 시도 POST 1 · bind 같은 제출 id/납품 · 오류 0 · 넘침 0. 인증 journey 에 통제 손실(실제 저장 · 결속 후 첫 응답 메타만 삭제) → 실제 bind API → 같은 attempt 복귀 · 시도/G2/PLAN 행 수 불변 단언 추가 — NOT_VERIFIED, T0074 와 한 공식 통합 묶음.
- REWORK(Codex T0075-P1-1 · 023c8474d): 안내 연습 A 다시 연결 대기 중 「다시 풀기」 → 새 제출 B 저장 → 늦은 A 응답이 B 결과에 map_attempt=41 을 붙였다. 수정: 다시 연결 중 again 핸들러 · 버튼 잠금 + 응답 도착 시 보낸 제출과 지금 제출이 다르면 응답 버림(stale). P2: 비근거 사유는 표의 자기 키만(Object.hasOwn — toString 등 상속 키 = 확인 못 함). 검증: Codex race 장치 1440/1280 통과(재시도 비활성 · 오류 0) · 기존 16/16 재통과 · 관련 26 · tsc 0 · lint 0.

## 23. T-0076 — 지도 근거 설명을 창작 학습 순환의 기록 · 바로잡기 판정에 맞춤 (2026-10-21)

- evidence-claims: 읽기 키 = PLAN · As-Is 와 같은 evidenceKeysOfTask(정본 확인 키 + 창작 채점 키) · 대표 키는 정본 키 우선. 바로잡기 = repairGate · lifecycle 와 같은 repairSuccess(막힌 기출 재시도 · 결속된 같은 TASK 안내 연습, 판단 · 서버 수신 모두 회차 뒤) — 결속 없음 · 수신 없음 · 이전 회차 · 다른 TASK · 창작 평가 재풀이는 성공 아님(PLAN 과 일치). 창작 첫 시도 결속 없음/불일치 = 「받은 자료와의 연결을 확인할 수 없음」(도움 · 해설 뒤라고 쓰지 않음).
- compose: 정본 확인 키가 없어도 창작 키가 있는 TASK(e.task_demand 등)의 근거 설명 생성 · 키가 전혀 없는 TASK 는 계속 생략.
- EvidenceBlock: 「이번 판정의 독립 확인 N문항」(currentCheck 원값)과 상세 기록(현재 주석까지 확인된 독립 확인 · 전체 기간 / 원장 못 읽음 = 확인 보류)을 분리. hashes 없는 창작 기록 = 주석 UNKNOWN 유지. PLAN · 진단 · 정본 · SQL · API 변경 없음.
- 검증(로컬): Codex probe 6/6(기준선 4 fail · 2 pass) · evidence-claims-independent 12(probe 이식 + 원인별 대조 + 결속 불일치) · compose-authored-evidence 3(실제 composeV4) · vitest related 19 파일 217 · tsc 0 · lint 0. 실제 Chromium(실제 React EvidenceBlock · evidenceView 실제 계산 · 고정 데이터) 14/14: 1440/1280 안내 연습 오답 = 해 봤어요 · 정답 = 맞혀 봤어요 · 창작 직접 확인 · 평가 재풀이(성공 아님) · 기출 재시도 · 원장 불명확(확인 보류) · 이번 판정 2문항 · 키보드 · 넘침 0. 인증 journey 의 안내 연습 오답 · 정답 직후 근거 상세(팝업 → 자세히 키보드) 단언 추가 — NOT_VERIFIED, 다음 공식 일일 sync 묶음.
- REWORK(Codex T0076-P1-1 · f9c036845): 원장(첫 시도 · 수행)을 다 읽지 못했는데 헤더가 「이번 판정의 독립 확인 0문항」이라 했다. 수정: ledger unknown 이면 「이번 판정 문항 수 확인 보류」 · data-current-items 생략(읽힌 빈 원장의 0 은 그대로). 검증: Codex probe + unknown-count 9/9(이전 7 · 2 fail) · 근거 관련 16 파일 143 · Chromium 14/14(원장 불명확 행 = 확인 보류) · tsc 0 · lint 0.

## 24. T-0077 — 계획 재확정 전후의 단계 · 학습량 변화 설명 (2026-10-21)

- PlanSection(기존 Workspace 계획 패널): ① 저장 전 — 최신 저장본 → 지금 화면 제안(shown = applySaved · quantityBasis · applyDraft 결과)의 바뀐 TASK 만 「단계 · 계획량 · 쓸 수 있는 자료 old → new」 + 「아직 저장하지 않았어요」, 목표가 바뀌었으면 기존 goalLabel 로 그때 → 지금. 순서만 바뀌면 순서 변화. 저장본 없음 = 비교할 저장본 없음 · 조회 실패 = 비교 불가 · 과거 보기 = 제안 비교 없음. ② 이력 — 각 버전 TASK 에 저장 당시 단계 + 계획량(같은 2문항의 확인 · 바로잡기 구분, 미정은 미정). ③ 저장된 변화 한 번 — 최신과 바로 앞 버전(version-1)만, 잘린 이력 = 비교 불가, 사유는 저장된 사유 라벨.
- plan-change.ts(순수): 단위는 각 쪽 단계 단위(적용 = 지문 · 그 밖 = 문항) · 서로 빼거나 합하지 않음 · null 은 미정. 판정 · 수량 · 순위 · 자동 POST 없음. submit · 저장 상태 · 409 · 복원 · 초안 핸들러 변경 없음.
- 검증(로컬): Codex NEXT-PLAN-CHANGE probe 3/3(기준선 1 fail · 2 pass) · plan-change 5 · plan-change-summary 7(실제 PlanSection 렌더) · PlanSection related 13 · tsc 0 · lint 0. 실제 Chromium(실제 React PlanSection · 고정 데이터 · router shim) 16/16: 1440/1280 제안 check2 → repair2 · 저장된 변화(이력 details 키보드 펼침) · 같은 저장본(저장됨 · 비교 없음) · 가용 null(미정) · 목표만 변경 · 조회 실패 · 과거 보기 · 넘침 0. 인증 goal-plan-version 에 재확정 전 제안(그때/지금 목표) · 저장 뒤 저장된 변화 · 이력 단계 단언 추가 — NOT_VERIFIED, 다음 공식 일일 묶음.

## 25. T-0078 — 수행 기록 조회 실패 때 MAP · PLAN 을 0건으로 다시 만들지 않고 복구 (2026-10-21)

- 판정 한 곳(v62/evidence-read.ts): 확인 첫 시도 · 수행 기록이 배열(빈 [] 포함)이면 ok, undefined 면 읽지 못함. composeV4 는 읽지 못함이면 null(0건 진단 · repair 재계획 · not_checked 계획 없음). instrumentHashes 만 모르는 경우는 기존 UNKNOWN 표시 그대로.
- load.ts — 이미 하던 조회의 오류를 같은 신호로: 창작 첫 시도 결속 오류(이전: 결속 없음으로 삼킴) → 첫 시도 원장 undefined · 안내 연습 결속 오류 → 수행 기록 undefined · 창작 납품(확인 · 바로잡기) · 확인 연결 오류 → 둘 다 undefined. 정상 0행 · 명시 비유효(철회) · 미설치 표(정상 []) 의미 그대로. 새 조회 · SQL · 권한 변경 없음.
- API: POST 계획 저장 · POST 자료 받기 — 읽지 못함이면 503 evidence_unavailable, commitPlan · requestAuthoredSupply 0회. 같은 clientKey 의 이미 성공한 영수증(prior)은 그 앞에서 그대로 · 본문 다르면 기존 409.
- 화면: UnifiedLearningMap 은 읽지 못함이면 MapReadUnavailable(읽지 못했음 · 0건/부족 아님 · 계획 확정/자료 받기 안 엶 · 다시 불러오기 한 번 = router.refresh). 지도 본체는 읽힌 데이터가 오면 새로 마운트돼 복귀 문맥으로 시작, 읽지 못한 동안 SESSION_CTX · 주소(map_task · ws · 일회성 키) 덮어쓰기 없음. PlanSection · AuthoredSupplyCard 는 503 evidence_unavailable 을 미설치 · 공급 준비 중과 다른 문구로.
- 검증(로컬): Codex probe 4/4(기준선 2 fail · 2 pass) · evidence-read 2 · compose-evidence-read 6 · compose-authored-evidence 4(원장 못 읽음 기대 = null 로 갱신 · 이유 주석) · load-evidence-read 5(결속 · 안내 연습 · 납품 오류 vs 정상 0행 · 철회 · 미설치) · plan route 3(503 · 저장 0 · 영수증 우선 · 409) · supply 4 · map-read-unavailable 2 · tsc 0 · lint 0. related 첫 실행 첫 실패 보존: plan-goal-binding 6건(모의 로드에 원장 필드 없음 → 503) — Codex 범위 승인 뒤 그 모의에 읽힌 빈 원장 [] 만 추가, 6/6. 실제 Chromium(실제 React 지도 · 계획 · 자료 받기 · 모의 HTTP) 12/12: 1440/1280 복구 화면(행동 CTA 0 · POST 0) → 키보드 재조회 1회 → 같은 map_task · ws · map_item 으로 정상 지도 · 계획/자료 받기 503 문구 · 넘침 0. 인증 격리 map-read-recovery(읽힌 빈 원장 첫 사용자 = 복구 화면 아님 · 계획 저장 200) 작성 — NOT_VERIFIED. 한계: 서버 원장 조회만 실패시키는 장애 주입은 격리 e2e 로 만들 수 없어 실패 경로는 단위 · 라우트 · 컴포넌트 시험만.
- REWORK(Codex T0078-P1-1 · f6876bd3b): 납품 유효성 RPC(workspace_delivery_current · supply_delivery_valid)가 둘 다 오류 · null 이어도 비유효로 접어 [] 를 돌려줬다(두 독립 실패를 「받은 자료 없음」으로). 수정: 성공한 명시 boolean 만 판정(본인 false = 비유효 · 대체 true/false = 그 판정), 둘 다 아니면 던져 기존 deliveriesRead=false → 원장 미확인. SQL · RPC · 권한 변경 없음. 검증: Codex delivery-validity 4/4 · load-evidence-read 7 · tsc 0 · lint 0.

## 26. T-0079 — 홈 첫 제안을 현재 TASK 근거 · 지도 읽기 상태와 연결 (2026-10-21)

- home-focus.homeFocusOf: 시험 기록 0 이어도 As-Is 에 basis direct_check 가 있으면 record(기록 없음)를 먼저 내지 않고 ranksOf 첫 행동(step)을 쓴다. 직접 근거는 있는데 행동이 없으면 pending(자료 · 단계 대기 — 「처음 시작 전」 아님). 직접 근거를 새로 계산 · 승격하지 않음.
- home-focus.homeMapStateOf(새 · page.tsx 가 사용): 없음 = preparing · 보류 판정 실패 = error · 현대 DTO(v4 · now)인데 필수 원장 못 읽음(T-0078 evidenceReadOf) = error · held = withheld · 그 밖 ok(읽힌 빈 [] = 정상 첫 진입). 기존 pickHomeSuggestion 우선순위 그대로.
- HomeLanding 문구: no_records = 「아직 시험 기록도 직접 확인도 없어요 — 약점을 정한 것은 아니에요. 지도에서 계획을 정하고 받은 자료로 바로 확인을 시작할 수 있어요 …」(시험 기록 입력 필수 문구 삭제) · records_only = 다음 단계(자료 · 대기 이유 포함) 확인. 새 CTA · 저장 · API 없음.
- 검증(로컬): Codex NEXT-HOME-MAP-ALIGNMENT probe 3/3(기준선 1 fail · 2 pass) · home-focus 4(직접 근거 · 목표 없음 · 진짜 빈 원장 · 원장 undefined = error · held · failed · null) · HomeLanding render + home-suggestion 22 · tsc 0 · lint 0. 실제 Chromium(실제 React HomeLanding · mapData null · router/link shim) 6/6: 1440/1280 직접 근거(check · 키보드 「지도에서 보기」 → #umap-h) · 오류(키보드 다시 열기 = refresh 1회) · 진짜 첫 사용자(no_records 새 문구) · 넘침 0 · 계획/공급 POST 0(분석 이벤트 beacon 은 기존 D2 · 별도 집계). 인증 격리 home-map-evidence(기록 0 → 목표 → 계획 → 자료 → 혼자 확인 1 → 홈이 no_records 아님 · 시험 기록 0 유지) 작성 — NOT_VERIFIED, 다음 공식 일일 묶음.

## 27. T-0080 — 홈 「확인 이어하기」가 실제 TASK · Workspace 를 복원 (2026-10-21)

- HomeLanding continue_check 링크: mapReturnQuery({ task }) → mapReturnQuery({ mapTask, ws }). home-progress 의 check.task 는 지도 TASK id 인데 과거 활동 키 칸(task)으로 보내 지도가 TASK 선택으로 쓰지 않았다 — 같은 탭의 옛 SESSION_CTX 선택이 남았다. map_item · map_attempt · map_plan · map_goal 은 만들지 않음. 저장 계획 관문 · 추천 우선순위 · 진단 · 계획 이어하기 분기 무변경.
- 검증(로컬): HomeLanding render 7(진짜 링크를 parseMapReturn 으로 읽어 mapTask · ws = progress · task null · 수행 문맥 키 없음) · tsc 0 · lint 0. 실제 Chromium(실제 React UnifiedLearningMap · Codex T-0078 compose fixture · 같은 모듈 런타임 재마운트) 4/4: 1440/1280 다른 TASK(v.core_meaning) 키보드 선택 뒤 map_task 링크 문맥 → r.central_meaning · ws.central-meaning 복원 / 대조 옛 task 링크 → 옛 선택 남음(반례 재현). 인증 home-map-evidence(T0079-P2-1 보완): 독립 확인 1회 뒤 continue_check 카드 링크(map_task · task 없음)를 키보드로 따라 같은 TASK · 묶음 지도, 앞서 지도에서 다른 TASK 선택 — NOT_VERIFIED, 다음 공식 일일 묶음.

## 28. T-0081 — 홈 저장 계획 이어보기가 실제 미완료 TASK · Workspace 로 (2026-10-21)

- home-progress.mapProgressOf: 저장 계획 제안에 task 추가 — 이미 계산한 applySaved(v.plans[id], sw.latest) 의 TASK 행 중 계획량이 있고 수행량이 못 미친 첫 행(계획 순서). 못 찾으면 그 묶음 이어보기를 닫는다(핵심 TASK 복사 · 추정 없음). 묶음 우선순위 · 계획량 · 수행량 · 단계 판정 · 과거 보기/목표 없음/미설치/조회 실패/원장 미확인/완료 보호 그대로.
- HomeLanding continue_plan 링크: mapReturnQuery({ ws }) → ({ mapTask: plan.task, ws }). 수행 문맥 키 없음 · 재확정 관문 우회 · 자동 저장 없음. continue_check(T-0080) · 다른 우선순위 무변경.
- 검증(로컬): home-progress 7(최소 유효 TASK 행 추가 · 중심 완료 + 보조 남음 = 보조 행 · 남은 행 없음 = 닫음 · 기존 완료/없음/에러 단언 보존) · HomeLanding render 7(계획 링크 parseMapReturn = mapTask/ws · task null · 수행 키 없음) · tsc 0 · lint 0. 실제 Chromium(실제 mapProgressOf + UnifiedLearningMap · Codex compose fixture + 저장 계획) 2/2: 1440/1280 다른 TASK(v.core_meaning) 키보드 선택 → 계획 카드 링크 문맥 재진입 = r.central_meaning · ws.central-meaning 복원. 인증 home-map-evidence: 평가 본문 첫 노출 전(계획 · 공급 뒤 start 전) 다른 TASK 선택 → 홈 continue_plan 키보드 → 같은 TASK · 묶음(기존 G2 독립 1 · 시험 0 단언 유지) — NOT_VERIFIED, 다음 공식 일일 묶음.
- REWORK(Codex T0081-P1-1 · 39051223d): 이어갈 행 선택이 묶음 집계(applySaved progress · 정본상 중심 TASK 만) 게이트 안에 있어 중심 2/2 완료 · 중심 배정 null 인데 보조 4/1 이 남은 실제 계획을 닫았다(제출 시험은 집계를 6/3 으로 흉내 내 가렸다). 수정: 실제 TASK 행에서 미완료 첫 행을 집계와 무관하게 선택 · 집계 값은 그대로(null = 말하지 않음) · 카드에 「이어갈 항목: TASK 행 양 · 단위」를 따로. 옛 모의 시험은 완료/계획량 없음을 행 값으로 표현하게 고침. 검증: Codex 실제 applySaved 5/5 · home-progress(실제 applySaved 3 포함) + render 18 · tsc 0 · lint 0 · Chromium 2/2(카드 이름/양 출처 · map_task/ws 복원).

## 29. T-0082 — 지금 확인 통과 뒤 유지 확인 준비 상태와 다음 학습 구분 (2026-10-21)

- v62/maintenance-state.ts: maintainPassed(TaskPlan) = need MAINTAIN · achievement resolved(V4 결과 읽기만) · 공용 문구 MAINTAIN_PASSED_LABEL. 새 판정 · 간격 · 도구 · 수량 없음(demand · skill-diagnosis · V4 무변경).
- rank.ts: 이 상태는 남은 혼자 확인 링크가 있어도 actionRank 에 넣지 않고 notActionable 'maintain_pending'(같은 회차는 해소 뒤 다시 판정되지 않음). next-action.ts: 대상 선택에서 maintain_pending 은 마지막(다른 TASK 의 실제 실행 · 계획 · 자료 받기 먼저) · 기존 보호(저장 전 계획 확정 · 목표 변경 재확정) 뒤에는 자료 받기 없이 wait + 「지금 확인은 통과했어요 — 다른 날 유지 확인은 기준(간격 · 도구)이 아직 정해지지 않아 열지 않았어요. 숙달 · 목표 달성 판정이 아니에요.」 — 예전 「앞 단계를 마치면 열려요」(stage_locked) 오안내 제거.
- 화면: GoalPlanSummary 이번 학습 = 「지금 확인 통과 — 다른 날 유지 확인은 기준이 정해지지 않아 이번 학습량이 없어요」 · TaskInspector BLOCKED_LABEL · WorkspaceList 막힘 칩 「지금 확인 통과 · 다른 날 유지 확인 기준 미정」. 자동 저장/POST · 새 수치 · 일정 없음.
- 검증(로컬): maintenance-state 5(실제 asIs → toBe → planWorkspaces → allTaskPlans/workspacePlan → ranksOf → nextActionOf: 새 링크 0 = maintain_pending wait · 남은 링크 있어도 실행 순위 밖 · demand 역할 그대로 · 다른 TASK 실행 우선 · 저장 전/목표 변경 보호 · 실제 REPAIR transfer material_needed 대조) · 렌더 3 · related 15 파일 135 · tsc 0 · lint 0. Codex dg-demand probe: 계약 3 통과 · 관찰 1(결함 stage_locked 를 단언) 은 의도대로 바뀌어 maintain_pending. 실제 Chromium(실제 compose: 독립 오답2 → 결속 안내 연습 → 전이 2 → 새 독립 2 정답 = resolved · MAINTAIN · 참조 문항) 4/4: 1440/1280 × 남은 확인 링크 없음/있음 — 상단 추천 = 다른 TASK(선지-본문 대응) · 요약 행 새 문구 · 실행 링크 0 · TASK 자세히(키보드) data-reason maintain_pending · Workspace 막힘 칩(키보드 펼침) · 자동 POST 0 · 넘침 0. 한계: 전역 3B 스킨 · 인증 Next+DB 미실행 — NOT_VERIFIED · 「유지만 남은」 상단 wait 화면은 단위 시험만(합성 화면에 다른 TASK 가 늘 있음).
- REWORK(Codex T0082-P1-1 · 0dd0281d8): Workspace 목록 행(workspaceRows)이 중심 TASK 의 남은 확인 링크(cm-ind-5)로 runnable · ws-next 를 그대로 냈다(rank · 상단만 고쳤다). 수정: 행 투영도 같은 maintainPassed — 링크 없음 · 새 행 상태 maintain(「지금 확인 통과 · 다른 날 유지 확인 기준 미정」, 「앞 단계 뒤에 열려요」 아님). 검증: maintenance-state 6(행: 남은 링크 있음/없음 = next null · maintain · REPAIR 대조) + 렌더 3 · related 13 파일 139 · tsc 0 · lint 0 · Chromium 4/4(행 data-state=maintain · 다음 링크 0 추가 확인).

## 30. T-0083 — 수식 관계 자료를 긴 문장 Workspace 의 학습 전용 진입으로 (2026-10-22)

- v62/instructional-supplement.ts(새 · 닫힌 표): ws.sentence-core × s.attachment · 교수 2역할(model_explanation · guided_practice)만. 정본 core/support · Workspace 정의 · S2/S3 독립성 보류 무변경.
- 서버: supply route 의 소속 검사(T-0056)에 이 한 조합만 예외 · buildDemand 는 이 조합이면 교수 2역할 줄만(기존 이유 need_without_stage · REPAIR 판정 없음 · 평가 역할 0). 본문은 기존 {task, template} — 클라이언트 role/수량 무시. 계획 미저장 · 원장 미확인 보호 그대로. 새 API · SQL 없음.
- 화면: WorkspaceModal 이 이 표로 AuthoredSupplyCard kind=instructional(「학습 자료 · 수식 관계」 + 「혼자 확인은 아직 준비 중 · 연습 기록으로만 · 계획/확인 결과 불변」) · 기존 받은 자료 목록 · 실행기 · 노트 · withMapReturn(outgoingCtx) 재사용.
- 검증(로컬): instructional-supplement 3(실제 composeV4 → buildDemand 교수 2역할만 · 다른 묶음/중심 대조) · supply route 6(이 조합만 통과 · 다른 묶음 거절 · role/수량 무시) · PGlite authored-flow 46(새 학습자 K: 실제 공급 = 원리 설명 · 안내 연습만 · 평가 납품 0 · 안내 연습 오답/정답 G2 evidence false · 모든 시도 practice · 계획 이력 불변 + 기존 45 유지) · 렌더 2 · related 21 파일 202 · tsc 0 · lint 0. 실제 Chromium(실제 React AuthoredSupplyCard instructional · 실제 outgoingCtx · 모의 HTTP) 10/10: 1440/1280 × 받은 교수 자료(링크 2 · from=map · ws · map_ws · map_item/attempt 없음) · 0건 · 조회 실패 · 미설치 · 과거 보기(버튼 없음) · 키보드 자료 받기 POST 본문 {task, template} 만 · 넘침 0. 인증 격리 attachment-instructional(계획 확정 → 카드 · 범위 문구 → 키보드 자료 받기 → 줄 = 교수 2역할 · 평가 납품 0 · 계획 불변) 작성 — NOT_VERIFIED. 한계: 학습 페이지 실행기 → 노트 → 복귀는 기존 경로 재사용(이번 화면 시험 밖) · 지도 전체 3B 스킨 아님.
- REWORK(Codex T0083-P1-1 · e5ff5d165): 학습 전용 카드가 TASK 단위 GET 목록의 평가 역할 행(at-ind-1 등)도 실행 링크로 보였다. 수정: kind=instructional 이면 카드 목록 · 노트 패널에 넘기는 rows 를 교수 2역할로만 투영(원장 · 서버 · 다른 카드 무변경). 검증: Chromium 14/14(1440/1280 · 교수 2 + 평가 3 + 미지 1 혼합 목록 → 교수 링크 2만 · 기존 support 카드 대조는 평가 행 그대로 · 기존 5 상태 재통과) · 렌더 2 · tsc 0 · lint 0.

## 31. T-0084 — 실사용 학습자 지표에서 내부 · 합성 · 미분류 계정 분리 (2026-10-22)

- lib/admin/account-cohort.ts(새 · server-only): 가입자 전 페이지(listUsers 1,000 × ≤100) + 운영 역할(admin · curator, 상한 1,000) + 기존 account-classification.classifyAccount 를 한 번 계산 → { verified 집합 · verifiedUsers · 수 요약 } 또는 unavailable(registry_invalid · read_failed). 요청(= admin 클라이언트)당 memo(cohortOf) · verifiedOnly(익명 · 고아 · 내부 · 미분류 행 제외, cohort 불가 = null). 판정 규칙 새로 없음 · 실계정 ID 추가 없음 · SQL/RPC/쓰기 없음.
- 적용: retention(동작 동일 · 조회부만 공용화) · 관리자 KPI learners.verified · verifiedActiveToday(오늘 daily_activity 키셋 · 검증 외부만) — /admin · /admin/analytics · /admin/users 주 수치를 실사용으로, 전체 계정 수는 「내부·미분류 포함」 참고로만 · 교사 퍼널(교사 · 학생 모두 검증 외부만, 기존 1,000행 잘림 → 키셋 전량 · 검증 0 = 실제 0 · 표 미조회) · 영상 시청 started/completed(검증 외부만 · id 정렬). 실패 · 잘림 = null(—), 0 으로 바꾸지 않음. practice.isSyntheticEmail · G2 · MAP · PLAN 무변경.
- scripts/docs/gen-db-stats.mjs: 같은 순수 분류 파일을 직접 import(Node 24 타입 제거) · 가입자 전 페이지 · 출력 = 실사용(검증 외부) / 전체 = 내부 · 미분류 · 활동 표 · 교사 채널은 「전 계정」 범위로 표기. 읽기 전용 실측(--print): 실사용 0(검증 목록 미설정) · 전체 가입 65 = 내부 1 · 미분류 64 — 옛 블록 「가입자 4」는 도메인 3개만 뺀 오염 값이었다. AGENTS.md 블록 재생성은 하지 않음(다른 작업자 변경 보존).
- 검증(로컬): account-cohort 12(외부 · 내부 목록 · 운영 역할 · 충돌 · 예약 도메인 .test · 합성 example.org · 익명 · 고아 · 2페이지 · auth/역할 실패 · 역할 상한 · 설정 오류 시 DB 미조회 · memo 1회 · KPI 전체 6/오늘 6 대 실사용 2/오늘 1 · cohort 불가 null · 퍼널 1,200 잡음 뒤 2페이지 검증 계정 · 미분류 학생 = 학생 아님 · 표 실패 null · 영상 5 시작 중 검증 2) · retention 8 + boundary 3 + classification 24 그대로 · admin 화면 render 19(라벨 갱신) · offset-paging-budget(기준선 불변 — 첫 실패를 키셋으로 해소) · row-cap-lies · lib/admin+app/admin+lib/__tests__+supabase 56 파일 719 통과 · tsc 0 · lint 0. account-cohort 13(반례 추가: 이메일 누락 · iso-learner.test · example.org 는 목록 없이 실사용 아님 · 명시 목록이면 포함). 실제 Chromium(실제 React AdminKpiGrid · fmt 동일 식 · 고정 learners) 6/6: 1440/1280 × 검증 12 · 실제 0 · 못 쟀음(—) — 주 수치 = 실사용 · 전체 계정은 「내부·미분류 포함」 hint 로만 · 0 과 — 구별 · 넘침 0 · 키보드 갇힘 없음. NOT_VERIFIED: env 의존 통합 3 파일 skip · 인증 /admin Next+DB 화면(서버 컴포넌트 KPI 문자열은 SSR render 19 로 확인 · Chromium 은 Tailwind 미적용).
- 남은 경로(기록): /admin/knowledge/product/[id] 시도 요약은 synthetic 만 뺀다 — 이 브랜치의 옛 「실제 학습자 N명」 문구는 main(030006f6a) 에서 이미 「비합성 표시 N건(M계정)」으로 재구조화돼 실사용 주장이 없으므로 덮지 않음(main 재구조화 보존). 실사용 효과 지표로 쓰려면 cohort 적용이 다음 작업. 명시 synthetic 열은 knowledge_trials · learning_decisions/first_attempts/sessions/task_attempts 에만 있고 이번 지표 표(learning_records · scores · daily_activity · funnel_events)에는 없다(information_schema 실측) — 그 표들은 계정 cohort 로만 거른다. gen-db-stats 는 같은 순수 분류를 import 하지만 동일 fixture 대조 시험은 없다(스크립트가 import 시 실행) — 실 DB --print 로만. VG-L3-D1-02 전체 PASS · 교육 효과 주장 없음.
