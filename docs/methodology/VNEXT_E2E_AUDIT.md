<!-- docs/methodology/VNEXT_E2E_AUDIT.md -->
# 학습 원리 vNext — 종단 간 연결 감사 · G2 동시성 시험

작성 2026-10-08 · 담당: 실제 DB 검증 세션(knowledge-vnext 검토 세션, 사용자 결정) · **읽기 전용 감사 + 격리 PostgreSQL 시험 — 공유 개발 DB 쓰기 0건**.
대상: `origin/feat/methodology-vnext`(정본 · 스키마/관리자) · `origin/feat/csat-practice-port`(학습자 이식) · `origin/feat/csat-learning-loop-g1`(기출 학습 계약 · 진단).
「연결됨」은 코드·DB 에서 실제 호출/제약을 확인한 것만 쓴다. 실제 학습 효과는 실학습자 데이터가 없어 **어느 항목에서도 입증되지 않았다**.

## 0. 적용 상태(개발 DB 실측)

| 마이그레이션 | 개발 DB | 적용 본문 sha256 = 커밋 파일 |
|---|---|---|
| 20261008120000 knowledge_vnext | 적용 | — |
| 20261008140000 knowledge_review_cascade_guard | 적용 | `e97f5852…895d2` |
| 20261008150000 knowledge_statement_review_fix | 적용 | `78baa027…eba2486` ✓ |
| 20261008160000 learning_sessions_integrated(G2 통합) | 적용 | `8d1d0624…21327b5` ✓ |
| 20261008170000 knowledge_trial_evidence_guard | 적용 | `38fb5a5b…918d8f` ✓ |

대조: `supabase_migrations.schema_migrations.statements` 를 UTF-8 sha256 으로 계산해 `git show origin/feat/methodology-vnext:<파일>` 과 비교. ⚠️ 150000 · 160000 · 170000 파일 머리말은 아직 「미적용 · 승인 대기」라고 적혀 있다 — 문서 낡음(정본 세션 정리 대상).
멱등 키 명칭은 160000 이 `client_mutation_id` 로 확정했고 `_pending_20261008140100`(`client_attempt_id`)을 흡수·폐기했다.

## 1. 다섯 연결 질문

| # | 질문 | 판정 | 근거 | 끊긴 곳 |
|---|---|---|---|---|
| Q1 | 강사·연구 자료가 역량·원리 판단에 닿는가 | **부분** | `claims-import.mjs` → RPC `knowledge_import_claim` → 항목 `extracted` · 채택은 `setItemStatusAction`(수동) · efficacy 가드(준실험 이상 연구 근거 또는 비합성 분석 trial) · 근거 변경 → 재검토(140000/150000/170000) | 가져온 강사 주장을 원리 채택으로 올리는 기준이 없다(사람/에이전트 판정뿐). 강사 귀속만으로는 efficacy 가드를 못 넘는다(설계 의도) |
| Q2 | 원리가 학습 과제 선택·구성에 영향을 주는가 | **부분(켜기/끄기만)** | `practice-server.serverPool` 이 주석 문항마다 `loadLiveApplication` + `live-chain.isLive` 로 포함 여부만 정한다 | 문항·단계·순서는 고정 규칙(`TRAIN_TYPES` · `pickNext` 5회마다 전이). 원리·방법 데이터가 과제 구성을 정하지 않는다 |
| Q3 | 진단이 근거 있는 추천을 만드는가 | **끊김(학습 원리와의 연결)** | 진단 엔진 `rule-v1` 은 속성별 숙달 · `insufficient` · 증거 플래그를 낸다(자체로는 근거 있음) | 진단 속성(A1–A9)을 지식 항목·적용·연습 과제로 잇는 코드가 없다. 연습 기록도 진단으로 돌아가지 않는다 |
| Q4 | 첫 시도·중복 제출·전이를 구별하는가 | **부분 → DB 는 통과, 앱 기본 경로가 아직 옛 쓰기** | DB: 160000 원장 PK + 부분 유일 인덱스 + RPC `learning_attempt_record`(inserted/duplicate/conflict) — §2 시험 12/12 · 앱: `firstAttempts`(판단 시각) · `pickNext`(문항 단위 완료 수) · 전이는 phase | ① 이식 코드의 기본 쓰기 경로가 `directWriter`(유일 키 없이 읽고 넣기 — 동시 요청 틈)이고 RPC 경로 `g2Writer` 는 `PRACTICE_ATTEMPT_WRITER=g2` 일 때만 쓴다 ② 앱 첫 시도 키(`itemId+phase`)와 DB 뷰 키(`user·task_key·item_ref·phase`)가 다르다(과제 키 차이) |
| Q5 | 학습 결과가 방법론·원리 검토로 돌아가는가 | **끊김(수동/없음)** | DB 준비됨: 160000 이 최소 표본을 「실제 학습자의 독립 첫 시도」로 다시 정의 · 표본 동결 트리거 · 170000 합성 불변 | `evaluateProtocol` 호출처 0(테스트뿐) · trial 을 여는 경로 · 시도에 `trial_id` 를 다는 경로 · 분석 결과를 `knowledge_trials` 에 쓰는 경로 · efficacy 갱신 경로가 없다. 결과로 항목을 재검토하는 자동 경로도 없다(근거 변경 때만) |

## 2. G2 통합 SQL 동시성 시험 — 실제 PostgreSQL(격리)

`scripts/knowledge/g2-concurrency-test.mjs` — embedded-postgres 격리 클러스터(Supabase 역할·auth 재현 bootstrap)에 정본 마이그레이션 12개를 **커밋된 그대로** 적용하고 두 연결로 RPC 를 동시에 부른다. 공유 개발 DB 를 쓰지 않는다.

| # | 시나리오 | 결과 |
|---|---|---|
| C1 | 같은 `client_mutation_id` 동시 | 뒤쪽이 앞쪽 커밋까지 대기 → `duplicate` · 같은 attempt_id · 행 1 ✓ |
| C2 | 같은 id · 다른 내용 동시 | 뒤쪽 `conflict` · 앞쪽 내용 보존 · 행 1 ✓ |
| C3 | 앞쪽 롤백 | 뒤쪽 `inserted` · 시도 1 · 원장 1(유령 없음) ✓ |
| C4 | 다른 id 동시 | 서로 기다리지 않음 · 둘 다 `inserted` ✓ |
| C5 | 순차 재전송 | `duplicate` · 같은 attempt_id ✓ |
| C6 | 판단 시각 빼고 재전송 | `conflict`(서버 now() 로 조용히 통과하지 않음) ✓ |
| C7 | 첫 시도 뷰 | 문항·단계당 1행 · 늦게 도착한 이른 판단이 첫 시도 ✓ |
| C8 | 권한 | authenticated: RPC 실행 거부 · 자기 시도만 SELECT · 원장 읽기 거부 ✓ |

**12/12 통과(2026-10-08).** 결론: DB 수준 멱등·동시성은 설계대로 동작한다. 남은 동시성 틈은 DB 가 아니라 앱 기본 쓰기 경로(Q4 ①)다.

재실행: `node scripts/knowledge/g2-concurrency-test.mjs --pg-dir <isolated-pg 하네스>` — 하네스는 정본 쪽 `vnext-schema-test.mjs` 와 같은 `isolated-pg`(lib.mjs · bootstrap.sql · embedded-postgres). 데이터 폴더가 하네스 폴더 안에 생기므로 **복사본**을 가리킨다(남의 워크트리에 쓰지 않게). 경로에 8.3 짧은 이름(`ADMINI~1`)을 쓰면 initdb 가 실패한다 — 긴 경로를 쓴다.

## 3. 발견과 담당

| # | 발견 | 심각도 | 담당(사용자 결정 역할) |
|---|---|---|---|
| F1 | 학습자 이식 기본 쓰기 경로가 `directWriter` — 160000 이 적용됐으니 `g2Writer`(RPC)로 바꿔야 동시 요청 틈이 닫힌다 | 높음 | 이식 세션(코드) |
| F2 | 앱 첫 시도 키에 과제 키가 없다(DB 뷰와 다름) — 골격 과제와 주석 과제가 같은 문항이면 섞인다 | 중 | 이식 세션(코드) |
| F3 | 효과 피드백 경로 없음(Q5) — trial 열기 · `trial_id` 부여 · 분석 기록 · efficacy 갱신 | 높음(목표 기준) | 정본 세션(DB·관리자) + 이식 세션(앱 호출) |
| F4 | 진단 ↔ 학습 원리 연결 없음(Q3) | 높음(목표 기준) | 미배정 — 사용자 결정 필요 |
| F5 | 원리가 과제를 「켜고 끌」 뿐 구성하지 않음(Q2) | 중(설계 과제) | 미배정 |
| F6 | 150000·160000·170000 머리말 「미적용」 문구 낡음 | 낮음 | 정본 세션 |

## 4. 실제 DB 검증 착수 조건(사용자 결정)

| 조건 | 상태(2026-10-08) |
|---|---|
| 통합 SQL 적용·검증 | ✅ 적용 · 해시 일치(정본 세션 검증 기록은 그쪽 보고 기준) |
| DB 쓰기 잠금 해제 | ❌ 정본 워크트리 잠금 유지 중 |
| 적용 SQL 전체 sha256 확인 | ✅ §0 |
| 테스트 데이터 작성·삭제 범위 승인 | ❌ 미승인 |
| 이식 브랜치·정본 버전 확인 | ⚠️ 이식 브랜치 `54aa73186` 은 160000 적용 전 기준(F1) |

실제 DB E2E(학습자 화면 → RPC → 첫 시도 뷰 · 중복 클릭 · 새로고침 · 세션 분리 · 전이)는 F1 반영과 위 미충족 조건 해소 뒤에 한다.
