<!-- docs/csat-learner/PRACTICE_PORT_BRIEF.md -->
# `/csat/practice` 이식: 신규 세션 인계서 (2026-10-08 사용자 결정)

| 항목 | 내용 |
|---|---|
| 담당 | **별도 깨끗한 worktree의 신규 세션.** 원래 vocaflow-b5 업무였으나 그 세션이 종료되어 재배정. vocaflow-51은 쓰지 않음 |
| 범위 | 이식 코드의 구현 · 검증 · 문서화 · 커밋 · push (한 작업 단위) |
| 금지 | 실제 DB 쓰기 · 다른 세션 브랜치 수정 · G2 SQL 적용(담당은 vocaflow-18이고, 적용은 별도 승인) |

## 1. 시작
1. 새 worktree는 `origin/main` 기준으로 만듭니다: `pnpm wt new csat-practice-port`
2. 브랜치 예: `feat/csat-practice-port`
3. 쓰기 전에 `node agents/scripts/lock.mjs acquire <agent>`
4. `.agent-goal.md`에 목적 · 수용 기준 · 하지 않을 것을 먼저 씁니다.

## 2. 먼저 읽을 것 (이 순서로)
1. `origin/feat/csat-learning-loop-g1`
   - `docs/csat-learner/G2_SESSION_CONTRACT.md`: 서버 세션 · 요청 멱등 · 첫 시도
   - `docs/csat-learner/G2_INTEGRATION_REVIEW.md`: §2 차이, §7 이전, §9 차단 요인
   - `docs/csat-learner/G0_LEARNING_CONTRACT.md`: activity · phase · help_level · completion
   - `docs/csat-learner/g2-draft/20261008160000_learning_sessions_integrated.sql`: **sha256 `779eb9bb0812719702e16e4fcf34fe5813ed6f9adaa8173cc81a1f7aa4182a01`만 유효.** `179d884b…`와 `5f3f108f…`는 폐기
2. `origin/feat/methodology-vnext` (**정본**)
   - `docs/methodology/VNEXT_ARCHITECTURE.md`
   - `supabase/migrations/20261008120000_knowledge_vnext.sql` (`learning_task_attempts`)
   - `lib/knowledge/product-server.ts` (`recordClaimSupportAttempt`) · `app/api/csat/item/[slug]/task/route.ts`
3. `origin/feat/knowledge-vnext` (**동결 · 이식 원천 · 정본 아님**)
   - `docs/methodology/VNEXT_MERGE.md` §0
   - `app/(main)/csat/practice/[slug]/page.tsx` · `components/knowledge/ClaimPractice.tsx`
   - `lib/knowledge/{practice,learner-practice,vnext}.ts` (`pickNext` · `judgeCapability` · `evaluateProtocol`)
   - `tests/e2e/40-knowledge-practice.spec.ts`
   - 그 브랜치의 VNEXT.md와 마이그레이션은 **폐기(미적용)** 입니다.

## 3. 이식 계약 (수용 기준)
- 기존 Practice의 의미를 보존합니다: 주장 문장 → 근거 0–3 → 선지 · 확신 → 판정 · 다음 행동.
- **서버 채점을 유지합니다.** 정답 키는 기록이 저장된 뒤에만 응답으로 내보냅니다. 채점 함수는 정본 `gradeClaimSupport`입니다(옛 `scoreClaim` 폐기).
- 학습 활동은 `activity='practice'`이고, 측정 단계는 `phase`로 분리합니다(practice / transfer / pre / post / delayed).
- 해설 먼저 보기와 독립 시도를 혼동하지 않습니다. 해설 먼저 보기는 시도가 아니라 세션의 `help_level=viewed_first`입니다.
- 전이 결과는 완료 수준과 다른 차원입니다(G0 §2).
- 합성 계정의 기록 · 이벤트를 분리합니다(`synthetic`).
- **골격 115문항(R-CLAIM · GIST · TOPIC · TITLE)은 평가용으로 격리합니다.** 효과 계산에서 제외하고 개발 · 연습용 후보로만 씁니다.
- `lib/csat/skeleton`(정답 근거 문장 번호)에 의존합니다. 골격을 바꾸면 Practice 채점 회귀를 반드시 돌립니다.

## 4. G2 적용 전 개발 방법
- **새 SQL의 표와 RPC(`learning_sessions` · `learning_mutations` · `learning_attempt_record` 등)가 존재한다고 가정하지 않습니다.**
- 쓰기 경로는 어댑터 하나 뒤에 둡니다. 「지금 = 정본 직접 INSERT(현 계약)」와 「G2 후 = `learning_attempt_record` RPC」를 바꿔 끼울 수 있게 합니다.
- 클라이언트는 다음을 만들어 보냅니다. G2의 멱등 · 순서 계약에 필요합니다.
  - 제출마다 새 `client_mutation_id`(uuid)
  - 판단 시각 `answered_at`(**필수**)
  - 세션의 `client_session_id`
  - 같은 논리적 변경의 재시도만 같은 id를 씁니다.
- G2 RPC 규칙: 판단 제출 전에 세션 공개(reveal)가 먼저 적용되어야 합니다. 세션에 붙는 시도는 activity · phase · item_ref · task_key · help_level을 세션에서 상속하며, 모순 값은 거부됩니다.
- 검증은 테스트 더블 또는 격리 DB(예: PGlite 하네스 `g2-draft/pglite-harness.mjs`)로 합니다.
- E2E는 **로그인 단계를 포함한 모든 브라우저 컨텍스트**에서 쓰기를 가로챕니다(G1 incident 재발 방지).

## 5. 이벤트
- `knowledge_task_viewed` · `knowledge_task_submitted`는 **현재 DB 허용 목록에 없습니다**(2026-10-08 확인).
- G2 통합 SQL(83종)이 적용될 때까지 송신을 켜지 않습니다. 실패를 반복 전송하거나 조용히 버리는 경로도 만들지 않습니다.

## 6. 최종 통합 전 확인 (사용자 결정 C항)
1. G2 실제 DB 스키마와 Practice 코드 계약이 일치
2. 같은 시도를 재전송해도 중복 저장 없음
3. 세션 공개 전 판단 제출 차단
4. 해설 먼저 보기가 독립 시도로 승격되지 않음
5. 첫 시도 · 복습 · 전이의 통계 분리
6. 학습 결과와 분석 이벤트 중복 없음
7. G1 완료 · 재개 기능 회귀 없음

DB 적용과 코드 병합은 각각 별도 승인 단계입니다.
