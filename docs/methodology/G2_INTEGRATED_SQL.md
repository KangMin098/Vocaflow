# G2 통합 SQL — 승인 요청서(2026-10-08)

> 학습 원리(methodology) · 기출 학습(G2) · practice 이식이 함께 쓰는 공통 스키마 한 세트.
> **역할**(사용자 확정): methodology 세션 = 계약 · 설계 · 검증 · 승인 요청 / **실제 적용 = vocaflow-18 단독** / 다른 세션은 공통 스키마 적용 금지.
> 이 문서는 적용하지 않는다 — 승인 뒤 vocaflow-18 이 아래 절차대로 적용한다.

## 1. 대상 파일 · 해시

| 파일 | sha256 | 상태 |
|---|---|---|
| `supabase/migrations/20261008160000_learning_sessions_integrated.sql` | `8d1d06249b8d649442da4cd007a857b65668dc7a56f42824fcd94aefc21327b5` | **적용됨** 2026-10-08 · vocaflow-18 · 원장 `20261008160000` |
| 원본 초안(기출 쪽 · `origin/feat/csat-learning-loop-g1` `docs/csat-learner/g2-draft/…`) | `779eb9bb0812719702e16e4fcf34fe5813ed6f9adaa8173cc81a1f7aa4182a01` | 입력(조립기가 해시 확인) |
| 조립기 `scripts/knowledge/build-g2-integrated.mjs` | — | 초안에 M1–M5 만 정확한 치환으로 얹는다(나머지 바이트 동일) |
| `_pending_20261008140100_learning_task_attempts_idempotency.sql` | `3b7df58a…47e2` | **폐기** — client_mutation_id 로 흡수(파일 삭제) |
| 별건 `_pending_20261008170000_knowledge_trial_evidence_guard.sql` | `38fb5a5b3d0023475b96682ac019ae26fd94ce53cd60d4e604e18a9ddc918d8f` | 별도 승인(methodology PR #153 머지 blocker) — 이 세트와 독립, 순서 무관 |

## 2. 변경 객체

| 구분 | 객체 | 내용 |
|---|---|---|
| 새 표 | `learning_sessions` | 서버 학습 세션(판단 0건도 이력) · 단계 정합 CHECK · 삭제 표시 · `explanation_viewed_at`(M1 · B8) · RLS 본인 SELECT · 쓰기 service_role |
| 새 표 | `learning_mutations` | 요청 멱등 원장 `(user_id, client_mutation_id)` · RLS on · 정책 0 · 학습자 권한 없음 |
| 확장 | `learning_task_attempts` | `session_id` · `activity` · `help_level` · `client_mutation_id`(+ 부분 유일 인덱스) · `phase` 에 `review` — 모두 NULL 허용(기존 호출 호환) |
| RPC | `learning_mutation_claim` · `learning_session_apply`(+`p_explanation_viewed_at`) · `learning_attempt_record` | service_role 전용 · inserted / duplicate / conflict · 세션 상속 · 모순 거부 |
| 뷰 | `learning_first_attempts` | 학습 계약상 첫 판단(판단 시각 순) · `after_viewed_first` · `after_explanation`(M2) · security_invoker |
| 함수 교체 | `knowledge_trials_analyzed_guard` | **M3 · M5c** 최소 표본 = 실제 학습자의 독립(independent) 첫 시도(합성 · 힌트 · 해설 먼저 · 해설 뒤 · 반복 제외) · 표본 세션을 잠근 뒤 센다 |
| 새 트리거 | `learning_trial_sample_frozen_attempt` · `_session` | **M5d** 분석 완료된 실제 검증의 표본 고정(시도 추가 · 수정 · 같은 묶음의 더 이른 시도, 공개 · 도움 · 해설 시각 변경 거부 · 삭제는 막지 않음) |
| 규칙 변경 | `learning_session_apply` | **M5a** 공개 시각 · 도움 수준 · 해설 열람 시각 = 가장 이른 시각이 이긴다(도착순 아님) |
| CHECK 재정의 | `funnel_events_event_check` | 현재 68 ∪ knowledge 2 ∪ 기출 13 = 83 |

## 3. 영향 범위(개발 DB 실측 · 읽기만 · 2026-10-08)

- `learning_task_attempts` **0행** — 확장 · 인덱스 · CHECK 교체가 기존 행에 닿지 않는다
- `funnel_events` **21,000행** — 쓰인 이벤트 전부 새 목록 안(목록 밖 0) · 현재 CHECK 68종 전부 새 목록에 포함(빠진 것 0)
- `learning_sessions` · `learning_mutations` 없음(새로 만든다) · 원장 최신 `20261008150000` — 번호 충돌 없음
- 기존 데이터 변경 · 삭제 · 백필 **없음**. 잠금: `funnel_events` CHECK 재정의가 표 스캔(21,000행 · 짧음)

## 4. 검증(격리 PostgreSQL · `scripts/knowledge/g2-integrated-test.mjs` — 44/44)

기존 스키마 전부(등록부 7 · vNext · 가드 140000 · 150000 · 후보 170000 · 현재 68종 CHECK 의 funnel_events) 위에 적용한 뒤:
세션 열기 · 재전송 duplicate · 같은 키 다른 내용 conflict(빈 세션 없음) · 공개 전 시도 거부 · 남의 세션 시도 거부 · 세션과 다른 도움 수준 거부(B7 서버 검증 유지) · 상속(activity · phase · item · help · task) · 시도 재전송 duplicate · 같은 키 다른 응답 conflict ·
**두 연결 동시 같은 요청 → inserted 1 · duplicate 1 · 행 1(B6′)** · 동시 다른 요청 둘 다 inserted · 첫 시도 = 판단 시각 순 · 해설 먼저 표시 · 해설 열람 시각 먼저 값 유지(M1) · 해설 뒤 판단 표시(M2) · 효과 게이트가 독립 첫 시도만 셈(M3 거부 · 허용) · 이벤트(기존 유지 · 새 15 허용 · 목록 밖 거부) · phase review · 학습자 권한(세션 본인만 · 직접 쓰기 거부 · 원장 거부 · RPC 거부 · 첫 시도 뷰 본인만) ·
**M5(통합 리뷰 Codex P1 4건)**: 늦게 온 더 이른 해설 열람 · 「해설 먼저」 공개가 이김 · 힌트 기록은 독립 표본 아님 · 분석 완료 뒤 표본 세션 시각 변경 · 시도 추가 거부 · 같은 묶음(학습자 · 과제 · 문항 · 단계)에 표본보다 이른 시도(검증 없는 시도 포함) 거부 · 늦은 반복 시도는 허용 · **되돌리기 블록을 그대로 실행 → 새 표 · 열 없음 · 효과 게이트 원래 본문 · 이벤트 68종 복원**.

## 4-1. 최종 preflight(2026-10-08 · 사용자 조건부 승인 뒤 · DB 쓰기 없음)

검토 기준 커밋 `e80ea5491` · **SHA-256 `8d1d06249b8d649442da4cd007a857b65668dc7a56f42824fcd94aefc21327b5`**(재계산 일치). 이전 `c3167ae9…` · `9786b92f…` · `da627938…` 는 폐기 — 적용 대상 아님.

| # | 점검 | 결과 |
|---|---|---|
| 1 | SQL diff · 승인 범위 | 기출 쪽 초안(779eb9bb…)에서 빌더 `build-g2-integrated.mjs` 가 더한 것만: M1 해설 열람 시각 · M2 뷰 after_explanation · M3 효과 게이트 = 실학습자 독립 첫 시도 · M4 머리말/되돌리기 · M5a/a′ 공개 시각 · 도움 수준 병합 · M5b 뷰 실효 도움 수준 · M5c 잠금 · M5d 분석 뒤 표본 고정 · M6 재전송 원문 비교 · M7 합성 일치. 이 세트 밖 객체 없음(170000 · 응집 빌드 미포함) |
| 2 | SHA-256 재계산 | 일치 |
| 3 | 격리 테스트 | **44/44**(43 + M7 최소 표본 우회 단언 1 추가 · SQL 변경 없음 → SHA 그대로) |
| 4 | 합성 세션 + 합성 아님 시도 | RPC 거부(`contradicts`) — **저장 차단** |
| 5 | 과거 오염 행 | 시도 행을 synthetic=false 로 덮어도 첫 시도 뷰는 세션 합성을 따라 합성 — **집계 제외**(두 겹 유지) |
| 6 | 최소 표본 우회 | 합성 세션(오염 행 포함)만으로 `analyzed` 전환 거부 |
| 7 | 실제 DB(읽기만) | 원장 최신 `20261008150000`(이 SQL 은 그 뒤 — 순서 충돌 없음) · `learning_sessions` · `learning_mutations` · `learning_first_attempts` 없음 · 새 RPC 3종 없음 · `learning_task_attempts` 13열(격리 환경 사전 상태와 같음) · **기존 시도 0행 · trial 2 · analyzed 0 · 검토 이력 165** · funnel CHECK 68종(새 SQL 이 83종으로) · 권한: authenticated SELECT · service_role 전체 · 활성 연결 1/13. checkpoint 기록은 DB 쓰기라 적용자(vocaflow-18)가 5절 절차로 찍는다 |
| 8 | 적용 뒤 smoke · 되돌리기 | 5절 ⑤(한 트랜잭션 롤백 smoke) · 7절(실행 가능한 되돌리기 — 격리에서 실제 실행 검증) |

**영향 범위 결론**: 기존 시도 0행이라 과거 오염 행은 실제 DB 에 없다(5번은 격리 실증). 기존 검토 이력 165 · trial 2 행은 이 SQL 이 삭제 · 변경하지 않는다 — 적용 뒤 같은 수인지 사후 검사에서 다시 센다. 바뀌는 것은 새 표 2 · 뷰 1 · RPC 3 · `learning_task_attempts` 열 추가(NULL 허용) · 트리거 함수 교체 · funnel CHECK 확장.

## 5. 적용 절차(vocaflow-18)

1. 다른 세션 DB 쓰기 없음 확인 · `ls supabase/migrations` + `schema_migrations` 로 번호 확인
2. sha256 재확인(위 값과 같을 때만) · `/db-checkpoint` before(`g2-integrated-20261008`)
3. **사전 검사**(읽기): `learning_task_attempts` 행 수 · `funnel_events` 의 목록 밖 이벤트 0 · 현재 CHECK 가 68종 ⊂ 새 목록
4. 정식 경로로 적용(파일 이름에서 `_pending_` 제거 · 해시 게이트 `scripts/db/apply-approved-sql.mjs … --record 20261008160000 learning_sessions_integrated`)
5. **사후 검사**: 새 표 · RLS · 정책 수 · RPC 실행 권한(service_role 만) · 뷰 security_invoker · CHECK 83종 · 위 4절 단언을 한 트랜잭션 롤백 smoke 로(실제 계정 · 합성 표시)
6. after 체크포인트 · diff 확인

## 6. 배포 순서 계약

① 이 SQL 적용 → ② 사후 검사 → ③ 코드 전환(문항 과제 `POST /api/csat/item/[slug]/task` · `/csat/practice` 기록을 `learning_attempt_record` 로 — `client_mutation_id` · `answered_at` 필수 · B5 합성 판정은 서버 관리 목록) → ④ 이벤트 15종 정의 · 송신 활성화(`events.ts` 한 커밋).
③을 ①보다 먼저 배포하지 않는다(RPC 없음 → 500). ③ 전까지 기존 직접 INSERT 경로는 그대로 동작한다.
B6′(동시 중복 제출)은 ① 뒤 실제 DB 에서 동시 요청 멱등을 다시 검증하기 전까지 「임시 수용」 — 효과 집계 · 링크 연결에서 제외 유지.

## 7. 되돌리기

파일 맨 끝 주석 블록(한 트랜잭션 · **실행 가능한 완성본** — 각 줄의 「-- 」를 벗겨 실행 · 격리 DB 에서 실제 실행 검증): CHECK 68종 복원 → 고정 트리거 삭제 → `knowledge_trials_analyzed_guard` 를 20261008120000 본문으로 → 뷰 · RPC 삭제 → 시도 표 열 · 인덱스 · phase CHECK 복원 → 새 표 삭제.
전제: 적용 뒤 새 이벤트 · `review` phase · 세션 연결 행이 생겼다면 먼저 처리해야 CHECK · FK 복원이 통과한다(G2_INTEGRATION_REVIEW §8).

## 8. 남은 결정 · blocker

- B7 P1 2건은 practice 이식 코드에서 고쳤다(`8b9d66620` · RPC 검증은 완화하지 않는다 — 격리 검증이 거부를 확인).
- **f5 독립 심사(2026-10-08 · CONDITIONAL) P1 반영**: ① 도움 수준은 **더 많이 도움받은 쪽**이 이긴다(viewed_first > hint > independent · M5a′) — 공개 · 해설 열람 시각은 가장 이른 것. ② B8 해설 열람 시각은 practice 공개와 **다른 client_mutation_id** 로 보낸다(같은 id 면 payload 가 달라 conflict → 열람 시각 유실). 격리 테스트 43/43 · M6 재전송은 요청 원문으로 비교(세션 상속 전 · Codex P1) · M7 합성 표시는 세션과 같아야 하고 첫 시도 뷰는 세션 합성도 합성으로 본다(Codex P1).
- f5 P2(기록만 · 이 세트에서 고치지 않음): 고정 트리거 예외가 claim 까지 되돌림 · 직접 INSERT 행은 첫 시도 집계 밖 · 표본 행 DELETE 는 막지 않음.
- B8 은 M1 · M2 로 반영 — practice 는 ③ 단계에서 해설 열람 시각을 `learning_session_apply(p_explanation_viewed_at)` 로 보낸다.
- 상태 E(직접 확인된 원인)를 만드는 기록 경로는 이 세트 밖이다.

## 9. 적용 기록(2026-10-08 · vocaflow-18)

- 사용자 최종 승인 sha `8d1d0624…` 그대로 적용(해시 게이트 `apply-approved-sql.mjs` · 체크포인트 `g2-integrated-20261008` 앞뒤). 적용 직전 워크트리에 다른 세션의 미승인 M8 수정이 있어 멈췄고, 원복을 확인한 뒤 적용했다.
- 사후 검사(읽기): RLS on(learning_mutations 정책 0 · learning_sessions 1) · RPC 3종 실행 권한 service_role 만 · 뷰 security_invoker · funnel CHECK 83종 · 시도 0 · trial 2 · analyzed 0 · 검토 이력 165(적용 전과 같음) · 트리거 4. 체크포인트 diff 는 회전 표본 bloat 1쌍만(정상).
- 실제 DB 롤백 smoke(5절 ⑤)는 하지 않았다 — 같은 단언은 격리 44/44 로 확인.
- **후속 M8**(사용자 결정 · 별도 승인): 공유 세션에서 도움 전 판단까지 비독립으로 세는 과소 집계(보수적 · P1 아님). 세션 `help_received_at` + 뷰가 그 전 판단은 independent. 근거 · 패치는 f5(`feat/csat-learning-loop-g1` docs/csat-learner/g2-draft/m8-help-received-at.patch). methodology 빌더에서 후속 SQL 로 만든다.
