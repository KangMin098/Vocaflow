# P6 학습 기록 조사 — 해설 화면 노출·독립 시도·숙달 분리 (2026-10-24, 읽기 전용)

근거: `main` 브랜치 코드(`git show main:`), 개발 DB `jajenrevcbmrpaliomxv` SELECT(information_schema · pg_policies · count).

## 1. 기존 활동 이벤트
- `apps/web/src/lib/analytics/events.ts:173-248` — `csat_lecture_played` · `csat_lecture_ended` · `csat_session_started` · `csat_session_explained` · `csat_paper_read` · `csat_review_*`. 속성은 숫자·불리언·열거형만(D3). 분석용 퍼널이며 학습자 기록 정본이 아니다(문항·버전 결속, 학습자 RLS 복구 용도 아님). DB CHECK allowlist 의 정확한 목록: NOT_VERIFIED(이번 조사에서 미질의).

## 2. 지도·Workspace 기록
- `lib/csat/map/v62/exposure-ledger.ts:38-45` 가 6+1 원장을 읽는다: `learning_task_attempts` · `learning_sessions` · `csat_trap_attempts` · `csat_session_attempts` · `csat_review_queue` · `csat_dx_response`(+`csat_dx_session`). 모두 `user_id` 기준, 읽기만.
- `lib/csat/map/load.ts:196-848` — `learning_task_attempts` 를 task_key·item_ref·phase·help_level 로 읽어 진행·전이 횟수를 센다.

## 3. 독립 수행 근거(현재 정의)
- `learning-session.ts:15-17` HelpLevel `independent|hint|viewed_first`, Completion `viewed|guided|independent`. `revealSession`(159행) "한 번 정한 help 는 바꾸지 않는다".
- DB `learning_session_apply`(마이그레이션 `20261008190000_learning_records_append_only.sql`, security **invoker**) — help_level 은 순위가 **올라가기만**(independent→hint→viewed_first), `explanation_viewed_at = least(...)`, `help_server_at/explanation_server_at` 서버 시각, 미래 시각은 `help_clock_suspect`. 즉 **비소급성이 이미 DB에서 강제**된다.
- `learning_task_attempts`: response jsonb · is_correct · content_hash · help_level · client_mutation_id · session_id. 실제 학습자 행은 UPDATE 거부 트리거(append-only), TRUNCATE 회수.
- `/api/csat/item/[slug]/reveal/route.ts:6,48-51` — 공개는 시도가 아니라 별도 mutation(`p_explanation_viewed_at`).
- `csat_session_attempts`(correct·confused·sec, item_id text, 1행) · `csat_trap_attempts` · `csat_item_attempts` · dx 표는 버전 결속 열 없음.

## 4. 숙달 판정
- `lib/csat/map/core.ts:4-6,148,336` — 숙달·취약 어휘 금지(`FORBIDDEN_WORDS`), rule_proxy 만. `v4/observation.ts:4-9` "숙달도 계산 없음 — 관찰 기록만". 자동 승격 경로: 발견 못함(코드 grep 범위 내). 전수 부재 증명은 NOT_VERIFIED.

## 5. RLS·쓰기 경로 (pg_policies 실측)
| 표 | 정책 | 쓰기 |
|---|---|---|
| learning_sessions | own_select(SELECT, `user_id=auth.uid()`) | RPC `learning_session_apply` 경유, 원장 `learning_mutations`(UPDATE 회수) |
| learning_task_attempts | own_select(SELECT) | 서버 경로, append-only 트리거 |
| csat_learner_state | own ALL — 단 `/api/csat/state/route.ts:11` 주석상 직접 읽기·쓰기 회수(20261005170100), API 가 서비스 역할로 본인 행만 |
| csat_session_attempts | own ALL + `item_answer_embargoed` 차단 |
| csat_item_attempts | cia_owner ALL |
| csat_trap_attempts | own INSERT/SELECT |
| csat_dx_* | own_select |

## 6. 재로그인·다기기 복구
- `csat_learner_state(user_id, record jsonb, updated_at)` 3행 — DissectionRecord 통째 jsonb, `/api/csat/state` GET/merge-PUT/DELETE(`route.ts:74-165`). 병합은 앱 코드(revealedAt 먼저 공개한 쪽 승리). **DELETE 가능 → 감사 원장이 아님.**
- `learning_sessions`(359) · `learning_task_attempts`(129) · `learning_mutations`(504) — 서버 정본, `client_session_id` unique 로 멱등(`on conflict do nothing`).
- 로컬 저장(IndexedDB/localStorage) 세부: NOT_VERIFIED.

## 7. AnalysisTheater 기록
- `AnalysisTheater.tsx:386-387` `withView` → `openSession(... legacy: committedOf(...))`, `:465` `finishSession` → `persist`. persist 대상이 `/api/csat/state`(jsonb)인지 `learning_session_apply`까지 가는지: reveal 라우트는 apply 호출 확인, finish/step 경로의 DB 도달은 NOT_VERIFIED.
- `learning_sessions.activity` CHECK = `theater|dissect|practice` — 해설(theater) 이미 수용.

## 8. P6 기능별 후보
| 기능 | 판정 | 근거·이유 |
|---|---|---|
| 노출 기록(answer_viewed / decisive_hint) | **IMPROVE** `learning_sessions`+`learning_mutations` | 이미 비소급(least·rank 단조)·서버시각·RLS·멱등. 부족: 노출 **종류**(answer vs decisive_hint)·lecture version/digest·analysis_version 열. 열 추가는 기존 소비자(exposure-ledger·load.ts select 목록 명시) 비파괴. 대안 NEW `csat_exposure_events` append-only 표는 비용↑·같은 보장 재구현 |
| 독립 시도 | **REUSE** `learning_task_attempts` | append-only, content_hash 로 버전 결속, help_level 기록. 판정 규칙: 시도 `answered_at`(서버 `received_at`) < 세션 `help_server_at`/`explanation_server_at` 및 노출 시각 |
| 해설 후 확인 | **REUSE** 같은 표 + phase/help_level=`viewed_first` | 별도 task_key 또는 phase 로 구분; 독립으로 승격 불가(rank 단조) |
| 숙달 제외 | **REUSE** 현 금지 규칙 + 가드 테스트 추가 | 현재 숙달 계산 자체가 없음 |
| 복구 | **REUSE** 서버 원장, `csat_learner_state` 는 UI 재개 캐시로만 | jsonb 는 삭제·덮어쓰기 가능해 정본 부적합 |

append-only 노출 원장 후보: `learning_mutations`(UPDATE 회수·트리거, payload jsonb에 키 추가 가능) — 소비자 파괴 없이 노출 종류·버전 키를 담을 수 있음. 단 payload 키 추가는 RPC 서명 변경(마이그레이션, DB 승인 필요).
