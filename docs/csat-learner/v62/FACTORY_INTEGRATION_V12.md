# Factory Integration v1.2 — 최종 P1 2건 수정 · R5 브라우저 증거

> 기준: Codex 최종 검토 `review/factory-integration-contract-v11-final` · `aa73fac39`(대상 main `6ddd1909a` · PR #265 `8af914add`). 원본 검토 원장 · 최초 판정 변경 없음.
> 범위: `factory-integration.ts` 최소 수정 · 수용 시험 · R5 E2E 증거. 공장 내부 · 실제 생산/공급 · DB/RPC/RLS · 승인안 · 학습자 기록 변경 없음.
> **제품 코드 병합 ≠ Codex 독립 수용 PASS** — 아래 커밋을 Codex 재검토에 넘긴다.

## 1. 수정

| 결함 | 원인 | 수정 |
|---|---|---|
| **V11-P1-01** lifecycle 선언 우회 | 서버 주체 · 문맥에 lifecycle 이 없고, 가드가 manifest 의 현재 선언(test_fixture)만 보고 전환 승인을 요구 → product 로 바꾸면 건너뜀 | ① `ArtifactSubject` 에 lifecycle 포함(서버가 고정한 주체와 다른 선언 = 다른 주체) ② `TrustedQualificationContext.lifecycle: LifecycleSnapshot`(original · current · 전환 승인 기록: 대상 id · revision · 해시 · 범위 `product_release` · 철회). 판정 `lifecycleGate`: 서버 current 모름 → `lifecycle_unknown` · 선언 ≠ 서버 current → `lifecycle_declaration_mismatch` · current test_fixture → `test_fixture` · original test_fixture → 정확한 전환 기록 없으면 `lifecycle_transition_missing/_revoked/_scope/_other_artifact/_other_revision` ③ v1.1 boolean `lifecycleTransitionApproved` 는 **증거로 쓰지 않음**(입력 호환만) |
| **V11-P1-02** 기존 자산 필수 자격 누락 통과 | `Object.keys(q)` — 넘겨받은 키만 검사 | 고정 7개(`EXISTING_REQUIRED`)를 하나씩 **own property 이고 정확히 boolean true** 일 때만 통과. 객체 없음 · 빈 객체 · 누락 · false · null · undefined · `'true'` · 상속값 = `existing_unverified:<축>` 보류 |

`trustedQualificationContext()` 는 여전히 **브랜드를 붙이는 생성자**다 — 인증 · 승인 actor · 실제 승인/철회 · 원문/Gold · 현재 revision · 실행 기록 · lifecycle 등록부를 조회하지 않는다. 그 서버 reader 는 승인안 B · C 뒤의 일(**BLOCKED_NOT_IMPLEMENTED**)이며, 리더가 없으니 임의 승인 데이터를 만들어 넣지 않았다(제품 호출부 0).

## 2. 시험 결과(수정 HEAD `be97543e9`)

| 묶음 | 결과 | 비고 |
|---|---|---|
| Codex 정정 82(`fic-review-probes`) | **82/82** | 입력 · 정정 기록 불변 |
| Codex 최종 진단 46(`fic-final-probes`) | **46/46** | 원본 그대로 · 정정 0. 수정 전 코드(main)로 돌리면 **42/46 — 실패 4 = new-lifecycle-declaration-bypass · existing-empty_object · existing-missing_rights · existing-all_missing**(Codex 원장과 일치) |
| v1.2 추가 18(같은 파일) | **18/18** | lifecycle: 전환 없음 · product 위장 · 정상 product(양성) · 정확한 전환(양성) · 다른 콘텐츠 · 다른 revision · 다른 해시 · 철회 · 전환 기록 없음 · 상태 미확인 · boolean 무효 / 필수 자격: 객체 없음 · null · false · undefined · 'true' · 상속값 · 7개 true(양성). 수정 전 코드로는 11 실패 |
| 원본 연계 계약 19 · wire/Schema 7 | **19/19 · 7/7** | |
| 회귀(`src/lib/csat` · `components/csat` · `lib/learner`) | 2,051 통과 · 68 skip(통합 시험 환경 미설정 — PASS 로 세지 않음) | tsc · eslint 0 |

양성 fixture(정상 product · 승인된 전환 · 7개 true 기존 자산)는 **계약 시험 입력**이지 실제 콘텐츠 승인 수가 아니다.

## 3. R5 전용 브라우저 E2E — 원시 증거

- 명령: `node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-map-supply.mjs --base http://localhost:3005 --evidence docs/csat-learner/v62/evidence/r5-e2e-20261015`
- 코드 HEAD `be97543e9058c1660bcae17739daeaccdee2b968` · 추적 파일 수정 0 · 대상 개발 서버 `http://localhost:3005`(이 worktree · `next dev`) · 개발 DB
- 시각 2026-10-14T18:55:07Z → 18:55:44Z · chromium 1440×1000
- 결과 **6 PASS · 0 FAIL · 0 SKIP**(이 6건 외 다른 e2e 로 대체하지 않음)

| # | 검증 | 결과 |
|---|---|---|
| ① | 기존 적격 R5 확인 문항 공급 · 다음 행동 | PASS |
| ①b | 실제 주문 기록 없이 주문 계열 단계 0 · 기록 상태 표시 | PASS |
| ② | 같은 학습자 · 버전 → 같은 수요 키 | PASS |
| ③ | 푼 문항 재공급 없음 · 같은 TASK 로 복귀 | PASS |
| ④ | V2 · S5 공급 경로 없음 유지 · 보류 TASK 수요 없음 | PASS |
| ⑤ | 다른 학습자 격리 | PASS |

- 산출물: [`evidence/r5-e2e-20261015/results.json`](./evidence/r5-e2e-20261015/results.json)(항목별 detail) · Inspector 화면 7장(`01-…png` ~ `07-…png`)
- 계정: 합성 계정 2개 생성 → 실행 뒤 삭제 → **남은 계정 0**(getUserById 확인). 이메일 · 비밀번호 · 사용자 id 는 기록하지 않았다.
- 한계: PLAN 복귀는 「같은 TASK 의 Inspector 로 돌아옴」 까지 확인(저장된 PLAN 버전이 없는 합성 계정). 학습 효과 증거 아님.

## 4. 남은 계약 위험

- 신뢰 문맥 · lifecycle 등록부 · 기존 자산 등록부 · 실행 원장의 **서버 reader 없음** — 지금은 어떤 산출물도 실제로 accept 되지 않는다.
- 학습자 G · 납품은 계속 `check_at_delivery` · null.
- 수요 서명 v2 — 실제 v1 저장 데이터 0 은 「승인안 B 미적용」 사용자 상태에 근거(DB 실측으로 확정하지 않음).
- 실제 교재공장 연결: **MOCK_ONLY / NOT_CONNECTED**(주문 API · 결과 manifest · 활동 단위 생산 없음).

## 5. 최종 독립 판정(2026-10-15)

Codex **ACCEPT**(`review/factory-integration-v12-final` · `9733a7003`): Gate A PASS · Gate B PASS(R5 원시 증거 범위 — 저장 PLAN 버전 복귀 NOT_TESTED) · Gate C MOCK_ONLY / NOT_CONNECTED. 설계 범위 종료 — 서버 reader · 실제 공장 연결 · 승인안 적용은 별도 과제. 제품 상태 정본: [P-M4](./P-M4_LEARNER_WORKSPACE.md) §1.
