# G2 독립 검증 준비 — M8 적용 후 smoke · 실제 DB E2E 정합성 · F7(2026-10-08 · methodology · 읽기 전용)

> 이 세션은 M8 · F7 · 제품 통합 코드를 쓰지 않는다(담당 vocaflow-f5). DB 쓰기 없음. 아래는 f5 가 내는 결과를 독립 검토하기 위한 준비다.

## 1. M8 적용 후 독립 smoke — [`m8-post-apply-smoke.mjs`](../../scripts/knowledge/m8-post-apply-smoke.mjs)

- 실제 개발 DB 에서 **한 트랜잭션 안에서만** 쓰고 끝에 ROLLBACK 한다. 시작과 끝의 세션 · 시도 · 원장 행 수가 같은지 단언한다.
- M8 미적용이면 아무것도 하지 않고 exit 2(지금 그렇게 멈추는 것을 확인함).
- 단언:
  - 원장에 `20261008180000` 기록 · 뷰에 `timing_uncertain` 열
  - 세션 synthetic 양방향 불변
  - 시도 synthetic 양방향 불변(세션 있음 · 없음)
  - 합성 불일치 기록 거부
  - 정상 기록 `inserted` → 같은 mutation 재전송 `duplicate`
- 격리 PG 독립 검사는 [`m8-review-probe.mjs`](../../scripts/knowledge/m8-review-probe.mjs)(M8 `1558cf32…` 에서 10/10). f5 가 M8-G 로 SHA 를 `9d2ebc80…` 로 바꿨다 — push 되면 같은 probe 로 다시 돌린다.

## 2. 실제 DB E2E 11개 시나리오 ↔ f5 브랜치의 기존 테스트(읽기 · `origin/feat/csat-g2-integration`)

| # | 사용자 승인 시나리오 | 지금 덮는 테스트 | 실제 DB 에서 아직 없는 것 |
|---|---|---|---|
| 1 | 기출 문항 진입 · 풀이 | `csat-learning-loop.spec.ts` 1 · 2 | 실제 DB 기록 확인 |
| 2 | 연타 · 재전송 중복 | `40-csat-practice` 「중복 클릭은 한 번 전송」 · 「실패 뒤 재시도는 같은 제출 id」 | **가로챈 쓰기**로만 검증 — 실제 RPC `duplicate` 확인 필요 |
| 3 | 새로고침 후 재제출 | `csat-learning-loop` 3(이전 단계 복원) | 재제출의 mutation 처리(새 id 인지 같은 id 인지) 실제 DB 확인 |
| 4 | 두 브라우저 동시 제출 | `csat-learning-loop` 6(두 기기) | **B6′ 실제 DB 동시성** — 격리에서만 검증 |
| 5 | 5회 뒤 전이 추천 | 없음 | 전부 |
| 6 | 해설 먼저 보기 | `40-csat-practice` 「해설 먼저 보기는 시도가 아니다」 | 실제 DB 세션 help_level · 첫 시도 뷰 제외 |
| 7 | 판단 뒤 해설 열람 | `40-csat-practice` 「판단을 보낸 뒤 연 해설은 … 별도 행동」 | 실제 DB `explanation_viewed_at` · `after_explanation` |
| 8 | 같은 문항의 서로 다른 과제 | 없음 | 전부(첫 시도 키가 과제별로 갈리는지) |
| 9 | 학습자 권한 | 응집 게이트 E2E(본인 행만 · 쓰기 거부는 vertical-1 E2E) | 새 표 `learning_sessions` · `learning_mutations` 직접 읽기 · 쓰기 거부 |
| 10 | 학습자 노출 게이트 | `vertical-cohesion-link-gate-e2e.mts`(not_live · 11/11) | f5 의 G2 route 전환 뒤 재실행 |
| 11 | 기출 → Practice → 복습 → 재평가 | 없음 | 전부 |

- 기존 `40-csat-practice` 는 「어느 컨텍스트에서도 DB 쓰기가 새지 않았다(가로챈 쓰기 0)」를 단언한다. 실제 DB 를 쓰지 않는 테스트라 2 · 4 · 6 · 7 의 DB 쪽 의미는 검증하지 않는다.
- 데이터 범위 점검 기준(사용자 승인):
  - 테스트 계정 1 · 세션 ≤ 60 · 시도 ≤ 120 · 원장 ≤ 200
  - 모두 `synthetic=true` · 실행별 고유 ID · 생성 PK 목록
  - 이번 실행 행만 정리(실패해도) · 실행 전후 체크포인트
- 정리 경로 참고: `learning_mutations.user_id` 는 `auth.users` 에 `ON DELETE CASCADE` 다. 테스트 계정을 지우면 원장도 함께 지워진다. 「기존 E2E 계정 1개를 계속 쓴다」 조건과 맞추려면 계정을 지우지 말고 생성 PK 로 지워야 한다 — 그 경로가 F7 과 맞물린다(아래).

## 3. F7 — `learning_mutations` 원장 불변성 · 권한(실제 DB 읽기 · M8 과 별개)

| 항목 | 실측 |
|---|---|
| 행 수 | 원장 0 · 세션 0 · 시도 0 |
| 권한 | `postgres` · `service_role` = SELECT · INSERT · UPDATE · DELETE · TRUNCATE · REFERENCES · TRIGGER. authenticated · anon 없음 |
| RLS | on · 정책 0(160000) |
| 트리거 | 없음 — UPDATE · DELETE 를 막는 장치가 없다 |
| 제약 | PK `(user_id, client_mutation_id)` · kind ∈ {session, attempt} · `user_id → auth.users ON DELETE CASCADE` |

검토 관점(f5 의 F7 SQL `_pending_20261008190000` · sha `d19261dd…` 가 push 되면 대조):

1. **payload · kind · target 수정 금지.** 원장 payload 를 고치면 재전송 비교 기준이 바뀐다. 그러면 같은 요청이 conflict 가 되거나, 다른 요청이 duplicate 로 통과한다.
2. **단건 DELETE 금지 · 정리는 정해진 경로로만.** 원장 행만 지우면 같은 mutation id 의 재전송이 `new` 로 다시 들어가 시도가 두 번 생긴다(멱등 붕괴). 정리는 계정 단위 cascade 이거나, 시도 · 세션과 함께 지우는 경로만 허용한다.
3. **TRUNCATE 금지.** service_role 의 TRUNCATE 를 회수하거나, 트리거로 막지 못하는 점을 명시한다.
4. 테스트 정리 경로: 「생성 PK 목록으로 이번 실행 행만」 지우는 조건과 2번이 충돌하지 않아야 한다.
5. 160000 · 170000 · M8 의 트리거 · 함수와 이름 · 동작이 겹치지 않아야 한다.

## 4. E5 · E8 · E11 이 실제 제품 기능과 이어지는가(읽기 · `origin/feat/csat-g2-integration` `0b2da40ae`)

| # | 제품 쪽 실측 | 판정 |
|---|---|---|
| E5 5회 뒤 전이 추천 | `lib/knowledge/practice` 가 연습 5문항을 채우면 전이 문항을 추천한다(단위 테스트 `practice.test.ts` 「연습 5문항을 채우면 전이 문항을 추천한다」) | **기능 있음** — 실제 DB E2E 만 없다 |
| E8 같은 문항의 다른 과제 | 첫 시도 뷰는 `(user_id, task_key, item_ref, phase)` 마다 가장 이른 판단을 고른다 → 과제가 다르면 첫 시도가 따로 잡힌다. 다만 2022#36 처럼 한 문항에 과제가 하나뿐이면(`currentItemTask` 는 첫 과제 하나) 제품 화면에서는 이 경우가 생기지 않는다 | **DB 계약은 있음** — 제품 경로로 만들려면 practice 과제와 문항 과제를 같은 문항에서 함께 풀어야 한다 |
| E11 기출 → Practice → 복습 → 재평가 | 복습: 해설 극장 「다시 보기」 세션이 `phase 'review'` 로 열린다(`learning-session.ts`). 재평가: `post` · `delayed` 는 효과 검증 설계(관리자 · `protocol.ts`)에만 있다. **학습자 화면이 기출 문항에서 `/csat/practice` 로 보내는 링크가 없다**(csat 컴포넌트 · 페이지에서 0건). 학습자에게 지연 재평가를 예약 · 안내하는 경로도 없다 | **제품 기능 빈칸** — 테스트를 쓰기 전에 연결(기출 → Practice 진입 · 복습 시점 · 재평가 문항 제시)이 먼저 필요하다 |

E11 은 「테스트 누락」이 아니라 **제품 연결 누락**이다. f5 에 전달하고 사용자에게 범위 결정을 요청한다.
