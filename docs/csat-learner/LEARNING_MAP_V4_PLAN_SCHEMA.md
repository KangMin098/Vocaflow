# 학습 지도 rev4.0 — 목표 · Workspace · PLAN 스키마 검토안(3차 · **미적용**)

> SQL: [`supabase/migrations/_pending_map_v4_plan.sql`](../../supabase/migrations/_pending_map_v4_plan.sql) — 승인 대기. 개발 DB 에 **적용하지 않았다**(2026-10-11 실측: 세 테이블 모두 `to_regclass` null).
> 승인 절차: 사용자가 SQL 을 보고 승인 → `ls supabase/migrations` 로 겹치지 않는 번호 → 파일 이름 변경 → 적용 직전 sha256 기록 → `/db-checkpoint` 앞뒤 → 아래 §5 검증.

## 1. 무엇을 · 왜

| 테이블 · 함수 | 목적 | 계약(지시서 §4) |
|---|---|---|
| `csat_map_goal_version` | 목표 변경 이력(추가 전용). 점수 · 등급(선택) · 대상 시험 · 날짜 | 목표 변경 이력 |
| `learner_workspace` | 학습자 × Template · 정의 버전(`canon_version`) · 상태 · 그때의 목표 버전 | 템플릿 · 정의 버전 · 개인 Workspace |
| `learner_workspace_plan` | 계획 버전(추가 전용) — `plan`(순서 · TASK별 단계 · 계획량 · 가용량 · 규칙 · 일정) · 사유 · 메모 · 기준 시점 · 정의 버전 · 목표 버전 | 선택 TASK · 정량 계획 · 일정 · 우선순위 · 수정 사유 · 버전 |
| `csat_map_goal_set(...)` | 최신 목표(`csat_map_goal`) 갱신 + 이력 한 줄 — 같은 `client_key` 는 처음 결과 | 멱등 |
| `learner_workspace_plan_commit(...)` | Workspace 찾기/만들기 + 다음 버전. 멱등(client_key) · 기대 버전(낡으면 `plan_version_conflict`) · 계획량 검증(`planned ≤ available`, 가용량 없으면 계획량 없음) | 중복 제출 · 동시 수정 보호 |

정성 성취 조건은 저장하지 않는다 — 코드북(`learner_criterion`) · 정의 버전으로 재현된다. 실제 수행은 `learning_task_attempts` 를 **조회**한다(복제 없음 · plan jsonb 에 시도 · 정오 칸 없음). 근거 상태 · 직접 확인 판정도 저장하지 않는다(조회 때 계산 — 기존 원칙).

## 2. 영향 분석

| 대상 | 영향 |
|---|---|
| 기존 테이블 | 변경 없음. `csat_map_goal` 은 RPC 가 갱신(지금 `PUT /api/csat/diagnosis/map/goal` 의 upsert 와 같은 결과) — API 를 RPC 로 바꾸는 것은 적용 뒤 앱 변경 |
| 백필 | `csat_map_goal` 1행(2026-10-10 실측) → 이력 1행 |
| RLS · 권한 | 세 테이블 본인 SELECT 만. INSERT/UPDATE/DELETE 는 학습자에게 없음. RPC 는 service_role 만 실행. `revoke truncate, update` (이력 2 표) |
| 학습자 기록 | 계정 삭제 시 cascade(추가 전용 가드가 계정 삭제만 허용) |
| 다른 작업 | `funnel_events` CHECK 변경 없음(이벤트는 기존 허용 목록 재사용) |
| 마이그레이션 번호 | 이름 `_pending_*` — CI 번호 검사 · 적용 대상이 아니다 |

## 3. 되돌리기

SQL 머리의 `DROP` 4줄(함수 2 · 테이블 3 · 가드 함수). 기존 테이블을 바꾸지 않으므로 되돌릴 데이터 변경이 없다. 하네스가 이 문으로 되돌린 뒤 기존 `csat_map_goal` 이 남는 것을 확인한다.

## 4. 오프라인 검증(2026-10-11 · 공유 DB 미접속)

`node scripts/csat/map/v4/plan-sql-harness.mjs <PGlite 설치 폴더>`(PGlite 0.2.17 · 저장소 의존성 아님) — **21/21**: 적용 · 백필 · 목표 멱등 · 최신 값 · 첫 계획 · 중복 제출 · 수정 버전 · 사유 보존 · 낡은 버전 거절 · 계획량 > 가용량 거절 · 가용량 없는 계획량 거절 · 알 수 없는 사유 거절 · 수행 기록 칸 없음 · UPDATE/DELETE 거절(계획 · 목표) · 다른 학습자 0행 · 학습자 INSERT 거절 · 학습자 RPC 거절 · 본인 2버전 · 계정 삭제 cascade · 롤백.
하네스가 잡은 결함 1: 계획량 검증에서 `available` 이 null 이면 비교가 NULL 이 되어 위반에서 빠졌다 → `coalesce(..., false)` 로 고침.

## 5. 적용 뒤 검증 계획(승인 뒤)

1. 적용 직전 · 직후 `/db-checkpoint`. 2. `select count(*) from csat_map_goal_version` = 적용 시점 `csat_map_goal` 행 수. 3. 학습자 RLS 클라이언트로 다른 사람 행 0 · INSERT 거절(실제 DB smoke — 합성 계정, 끝나면 `e2e-cleanup.mjs`). 4. 서버 API 가 RPC 로 계획 확정 → 같은 client_key 재전송 reused · 낡은 버전 409. 5. 화면: 「이 기기에만」 문구를 「저장됨 · 버전 N」 으로 바꾸고 E2E 에 확정 · 수정 · 사유 · 버전 단언 추가.

## 6. 적용 전 앱 상태

화면의 계획 조정은 **이 기기 초안**(localStorage)뿐이고 화면에 그렇게 쓴다. 저장 기능을 완료했다고 보지 않는다.
