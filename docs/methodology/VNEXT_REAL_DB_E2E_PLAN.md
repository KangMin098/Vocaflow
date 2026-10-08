<!-- docs/methodology/VNEXT_REAL_DB_E2E_PLAN.md -->
# 학습 원리 vNext — 실제 DB E2E · 동시성 검증 계획과 테스트 데이터 범위(승인 요청서)

작성 2026-10-08 · 담당: 실제 DB 검증 세션(사용자 결정) · 상태: **§3 범위 조건부 승인(2026-10-08) · 미실행**(착수 조건 ①② 대기). 감사 결과는 [VNEXT_E2E_AUDIT.md](./VNEXT_E2E_AUDIT.md).
대상 코드: `feat/csat-g2-integration` 최신(첫 시도 키 수정 뒤의 커밋 — 착수 때 sha 를 이 문서 §6 에 적는다). 대상 DB: 개발 DB `jajenrevcbmrpaliomxv`.

## 1. 착수 조건(사용자 결정)

| # | 조건 | 2026-10-08 상태 |
|---|---|---|
| 1 | 통합 브랜치 첫 시도 키(과제 키 포함) 수정 · 회귀 완료 | 대기(통합 세션) |
| 2 | 통합 세션 DB 쓰기 잠금 해제 확인 | 대기 |
| 3 | 이 문서 §3 테스트 데이터 범위 승인 | ✅ 조건부 승인(2026-10-08) — PK 추적 정리 조건 |

## 2. 기준선(2026-10-08 실측)

- `learning_task_attempts` 0행 · `learning_sessions` 0행 · `learning_mutations` 0행 — 실행 전후를 행 수로 정확히 대조할 수 있다.
- 트리거: `learning_trial_sample_frozen_attempt` · `learning_trial_sample_frozen_session`(trial 에 묶인 표본 동결). 이 시험은 trial 에 묶지 않는다.
- ⚠️ **권한 실측과 설계 의도의 차이(F7)**: 통합 SQL 주석은 `learning_mutations` 를 「추가만」으로 두었지만, 실제로 `service_role` 은 세 표 모두 DELETE · UPDATE · TRUNCATE 를 가진다(Supabase 기본 권한이 회수되지 않음). 앱 코드가 지우지는 않지만 DB 가 막지는 않는다 — 정본 세션 검토 대상(SQL 후보로만, 이 시험 범위 밖).

## 3. 테스트 데이터 범위 — 승인 요청

| 항목 | 범위 |
|---|---|
| 계정 | 기존 E2E 테스트 계정 **1개**(`tests/e2e/fixtures/test-user`) — 그 `user_id` 의 행만 만든다. 새 계정 생성 없음 |
| 표 | `learning_sessions` · `learning_task_attempts` · `learning_mutations` 만 쓴다. 지식 등록부 · 적용 · trial · 진단 · 기출 표는 **쓰지 않는다** |
| 합성 표시 | 모든 세션 · 시도 `synthetic=true`(테스트 도메인 계정 규칙) → 효과 계산 · 최소 표본에서 제외 |
| 문항 | 주석 문항 `2022#20` + 골격 미리보기 문항 최대 5개 |
| 양 | 세션 ≤ 60 · 시도 ≤ 120 · 원장 ≤ 200 |
| 정리 | **(승인 조건)** 실행마다 고유 `test_run_id` 와 생성 PK 목록을 매니페스트(`scripts/knowledge/runs/<test_run_id>.json`)에 **쓰기 전에** 남기고, 정리는 **그 PK 만** 시도 → 세션 → 원장 순으로 지운다. 지우기 전에 각 행이 테스트 계정 · synthetic · 실행 시작 이후인지 다시 확인하고 아니면 건드리지 않고 보고. **계정 전체 일괄 삭제 금지.** 실패 시 남은 PK 를 매니페스트에 남기고 `--cleanup <매니페스트>` 로 그 PK 만 재시도 |
| 기록 | `/db-checkpoint` before/after(라벨 `vnext-real-e2e-<날짜>`) · 실행 전후 행 수 · 삭제 행 수를 이 문서 §6 에 |
| 실패 시 | 중간 실패에도 정리 단계는 항상 실행(try/finally). 정리 실패면 남은 행 id 를 보고하고 추가 쓰기 중단 |

## 4. 시나리오(통합 브랜치 학습자 화면 · 실제 RPC)

| # | 시나리오 | 통과 기준 |
|---|---|---|
| E1 | `/csat/practice/claim-support` 진입 → 주석 문항 풀이 → 판정 | 세션 1 · 시도 1 · 원장 2(공개 · 시도) · 정답 키는 저장 뒤에만 |
| E2 | 「맞춰 보기」 연타 · 응답 지연 중 재전송 | 시도 1 · 두 번째 응답 `duplicate` |
| E3 | 같은 문항 새로고침 뒤 재제출(새 mutation) | 시도 2 · 첫 시도 뷰는 1(판단 시각 이른 것) |
| E4 | 두 브라우저 컨텍스트(같은 계정) 동시 제출 | 같은 mutation 이면 1 · 다른 mutation 이면 2, 첫 시도는 1 |
| E5 | 연습 5문항 완료 → 다음 문항 | 전이 유형 추천 · 완료 수 5(표시 수와 별개) |
| E6 | 해설 먼저 보기 → 판단 | 세션 help_level=viewed_first · 첫 시도 뷰 `after_viewed_first` |
| E7 | 판단 뒤 해설 열람 | `explanation_viewed_at` 기록 · 시도 response 불변 |
| E8 | 서로 다른 과제(주석 과제 · 골격 과제)가 같은 문항 | 첫 시도가 과제별로 따로(첫 시도 키 수정 확인) |
| E9 | 학습자 권한 | 자기 세션 · 시도만 조회 · RPC 직접 호출 거부 |
| E10 | 노출 게이트 | 적용 중단(paused) 상태면 주석 문항이 학습자 목록에서 빠짐 — 상태를 바꾸지 않고 현재 상태 그대로 관찰 |

동시성(실제 DB): `scripts/knowledge/real-db-concurrency.mjs`(R1 같은 id 동시 · R2 다른 내용 conflict · R3 다른 id 동시 · R4 첫 시도 뷰 · R5 증가분 상한) — 개발 DB 가 아니면 · 통합 워크트리 잠금이 잡혀 있으면 · `--target-sha` 를 포함하지 않으면 시작 전에 거부, `--commit` 없으면 점검만. 2026-10-08 점검 실행: 잠금 때문에 거부됨(정상). 격리 시험 `scripts/knowledge/g2-concurrency-test.mjs` 의 C1·C2·C4 를 실제 DB 에서 두 연결(서비스 역할 REST 두 개 동시 호출)로 다시 — 같은 범위(§3) 안에서.

### 도구 장애 주입 시험(공유 DB 없이)

`node --test scripts/knowledge/__tests__/real-db-concurrency.test.mjs` — 메모리 가짜 클라이언트(기록 RPC 멱등 규칙 재현 + 장애 주입) **6/6(2026-10-08)**:
① 기록 뒤 행 수 조회 실패 → 예외 기록 · 정리 실행 · 합성 행 0 · 종료 코드 1 ② 정리 삭제 실패 → 남은 PK · 원인 · 미해결 mutation 보고, 원장 보존, `cleanup()` 재시도로 0 ③ 사후 집계 실패 → `after.error` · 종료 코드 1 ④ RPC 응답 유실(커밋됨) → mutation id 로 복구해 삭제 ⑤ 정상 → 기준선 복귀 · 종료 코드 0 ⑥ 다른 사용자 행 무변경.
한계: PostgREST 의 실제 오류 모양·네트워크 재시도 동작은 흉내일 뿐이다 — 실제 DB 실행 기록(§6)이 최종 근거.

## 5. 하지 않는 것

- 마이그레이션 · 스키마 · 권한 변경, 지식 등록부 · 적용 상태 변경(E10 은 관찰만), 실학습자 행 접근.
- 결과를 학습 효과로 보고하는 것 — 이 시험은 기술 경로 검증이다.

## 6. 실행 기록

(미실행 — 착수 조건 충족 뒤 기록)
