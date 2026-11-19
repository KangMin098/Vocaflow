<!-- docs/implementation/learning-outcomes-20261021/02A-AI-REVIEW-RESULT.md -->
# 2A 결과 — AI 검토 창작 평가 자료 공급 경로

2026-10-21 · 구현 세션 Claude Code(Opus 5.5) · worktree `D:/workspace/Vocaflow-learning-outcomes-20261021-work` · 브랜치 `feat/learning-outcomes-20261021`(HEAD `100c2b925` 위 미커밋 변경). 커밋 · push · 공유 DB 쓰기 · 마이그레이션 적용 · 계정 생성 · 사람 검토 진술은 하지 않았다. 새 AI 리뷰를 만들지 않았다(기존 수락 영수증만 사용).

## 바뀐 파일(14)

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json` | 외부 `r5-central-meaning.v3-candidate-r2.json` **정확한 바이트 복사**. SHA-256 `682dfbd9…2846`(영수증과 일치 · 재포맷 없음). 세트 `r5-central-meaning.v3` · 11문항 · `validate-set` 위반 0. provenance `humanGold`/`rights` = pending 그대로 |
| `supabase/migrations/_pending_authored_ai_review.sql` | **신규 · 미적용**. `js_canonical_json` · `content_ai_decision`(+철회) · `content_ai_decision_record/revoke/ok` · `authored_ai_qualify` · `supply_human_decisions_ok` 래퍼(사람 판정 `_human` 보존) · `supply_dcp_source_policy_ok` · `authored_supply_decision_state` · `workspace_delivery_record` 래퍼(AI 결정 행 FOR SHARE) · 설치 후 권한 검증 블록 |
| `apps/web/src/lib/csat/authored/ai-review.ts` | **신규**. 순수 검증기 `verifyAiReviewReceipt`(세트 바이트 · JS canonical item/body/Gold · 두 모델 · 다른 세션 · 같은 입력 · 원본 result.txt 해시 · session.json) · `aiQualificationAxes` · 관리자 세션 실행 `recordAiReviewedSupply`(등록 → AI 결정 → 자격 → 승인, 재실행 안전) |
| `apps/web/src/lib/csat/authored/server.ts` | 재고 선택에 `decidedStock` — `authored_supply_decision_state` 가 `human`/`ai` 인 자격만 후보(함수 미설치 = 기존 동작, 다른 오류는 throw) |
| `apps/web/src/lib/csat/authored/__tests__/ai-review.pglite.test.ts` | **신규** 10개 — 아래 |
| `apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-learning.pglite.test.ts` | 설치 순서를 결합 순서로(창작 공급 + AI overlay 를 1C 앞에) |
| `docs/implementation/learning-outcomes-20261021/evidence/2a-ai-review/` (8) | `authored-final-ai-review.json` · `authored-revision-structural-r2.json` · `claude-65b8975d/{input,result}.txt,session.json` · `codex-f67f4b9a/{input,result}.txt,session.json` — 원본 그대로 복사(비밀값 패턴 검사 0) |
| `docs/DB_SCHEMA.md` · `docs/LEARNING_MODEL.md` · `docs/MODULES.md` · `docs/CHANGELOG.md` · `00-ROADMAP.md` · 이 파일 | 계약 갱신 |

⚠️ 루트에 임시 파일 `.tmp-2a-probe.mjs`(증거 복사 · 해시 스크립트)가 남아 있다 — 이 세션에서 `rm` 권한이 거절됐다. 커밋하지 말고 지울 것.

## 원본 증거 대조(실측)

| 파일 | SHA-256 | 영수증 값 |
|---|---|---|
| v3 세트(복사본) | `682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846` | source_file_sha256 ✓ |
| claude-65b8975d/input.txt · codex-f67f4b9a/input.txt | `b66e4e30…8d06`(둘 다) | prompt_sha256 ✓ |
| claude-65b8975d/result.txt | `5b108926…d74a` | response_sha256 ✓ |
| codex-f67f4b9a/result.txt | `5f6078b2…2903` | response_sha256 ✓ |
| session.json | claude session `65b8975d-…3186` · codex session `01a15d6a-f950-79f2-b83f-683e98166cfe`(request `f67f4b9a-…`) · 둘 다 exited | ✓ |

영수증의 item/body/Gold 해시(JS 키 정렬 `JSON.stringify`)는 **DB 가 등록 행을 `{id, role, passageGroup, body, gold}` 로 재구성해 `js_canonical_json` 으로 다시 계산**해 일치했다(가정 아님 — 시험이 실제 대조). DB revision(`jsonb::text` 해시)은 별개 값이며 결정 행에 둘 다 저장한다.

## 결합 설치 순서(실제 PGlite 에 이 순서로 적용)

C(`_pending_workspace_supply_c_qualification`) → B(`_pending_workspace_supply_b_orders`) → I1-S(`_pending_workspace_supply_i1_safety`) → I1-P(`_pending_workspace_supply_i1_partial`) → I2(`20261018120000_workspace_supply_c_annotation_binding`) → G2(`20261018120100_r5_delivery_g2_binding`) → D3(`20261020063000_factory_product_order_lineage_v1`) → grade_dcp_item 정의 → `_pending_authored_supply` → **`_pending_authored_ai_review`** → `_pending_factory_dcp_admission` → `_pending_factory_dcp_learning`.
이 전체 순서는 `dcp-learning.pglite.test.ts` 가 적용한다. `ai-review.pglite.test.ts` 는 창작 경로에 필요한 앞부분(C → B → I1-S → I2 → G2 → 창작 공급 → overlay)만 적용한다 — 창작 흐름 자체를 1C/1D 까지 얹은 한 DB 에서 돌린 것은 아니다.
overlay 는 1C 가 이미 있으면 설치를 거절한다(래퍼 중첩 순서 고정). 1C 의 `workspace_delivery_record` 래퍼가 overlay 래퍼를 감싸므로 목표 → 계획 자문 잠금(1C 의 실제 키 `map_goal:` · `map_plan:`) 뒤에 AI 결정 행 잠금이 온다. 이름 바꾸기로 사라진 검사 없음 — 사람 판정은 `supply_human_decisions_ok_human` 으로 그대로 호출된다.

## 명령 · 결과

| 명령 | 결과 |
|---|---|
| `pnpm --filter web exec vitest run src/lib/csat/authored/__tests__/ai-review.pglite.test.ts` | **PASS 10/10** |
| `pnpm --filter web exec vitest run src/lib/csat/map/v62/factory-bridge/__tests__/dcp-learning.pglite.test.ts`(결합 설치) | **PASS 27/27** — 실제 채점 · 배송 완료 후 열기 · 낡은 plan · 철회 · 원문 변경 · 직접 insert 회귀 |
| `pnpm --filter web exec vitest run src/lib/csat/authored src/lib/knowledge src/lib/csat/map/v62 src/lib/csat/map/v4 src/app/api/csat src/components/csat/authored src/lib/admin` | **PASS** 141 파일 · 2036 시험 · **SKIP** 3 파일 / 19 시험(기존 조건부 skip — 이번 변경과 무관, PASS 로 세지 않음). v3 바이트로 바꾼 뒤 기존 `authored-flow` · `authored-supply` 포함 |
| `pnpm --filter web exec tsc --noEmit -p .` | PASS |
| `pnpm --filter web exec eslint <변경 ts 4개>` | PASS |
| `pnpm --filter web exec tsx scripts/authored/validate-set.ts src/lib/knowledge/authored/r5-central-meaning.v1.json` | PASS(11문항 · 위반 0) |
| `node --test scripts/db/authored-supply/deploy.test.mjs` | PASS 6/6 |

`ai-review.pglite.test.ts` 가 덮는 것(Supabase 기본 권한 `alter default privileges … to anon, authenticated, service_role` 을 켠 채 설치):
- 실제 영수증 + v3 바이트 + 원본 응답 = 5개 통과 · 검토 없는 6개 존재 확인.
- 순수 반례: 한 AI 누락 · 같은 세션 · 다른 입력 · 응답 해시 불일치 · 사람 검토 주장 · 범위 확장 · 바이트 변경 · Gold 변경 · 본문 변경.
- 관리자 세션 실행: 5개만 등록 · AI 결정 5 · **사람 결정 0** · 범위 밖 문항 미등록 · `rights_grant=false` · `human_review=false` · 두 모델 claude,codex · 평가 역할 축 D=not_applicable · G=not_applicable. 반복 실행 = 행 추가 없음.
- DB 반례: 범위 밖(ind-1) · 한 AI · 같은 세션 · Gold 해시 변경 · 사람 검토 주장 · 같은 판본 다른 영수증(23505) · 학습자 세션(Forbidden) · 검토 없는 문항 자격 거절 · 직접 INSERT/UPDATE/DELETE 거절 · service_role INSERT/DELETE · record EXECUTE 없음 · anon EXECUTE 없음 · authenticated 의 내부 판정 EXECUTE 없음.
- 공급: 확인 단계 2 → ind-2 · ind-3 만(검토 없는 ind-1 은 후보 아님 · 거절 0) → 열기(Gold 미노출) → 실제 `gradeAuthored` 채점 정답 → G2 결속 `evidence=true` · 사람 결정 0 유지 → 재요청 새 납품 0(노출 재사용 없음) → ind-3 AI 결정 철회 → 기존 납품 `workspace_delivery_current=false` · 새 학습자에게 ind-2 만 + 부족분 생산 주문.

## NOT_RUN

- 공유 개발 DB 적용 · 실제 Supabase RLS(PGlite 는 슈퍼유저) · 두 연결 동시성(철회 vs 공급 직렬화는 FOR SHARE/UPDATE 설계만, 실측 없음) · 실로그인 E2E · `playwright.isolated.config.ts`(창작 isolated seed 는 v3 내용으로 재확인 필요) · `pnpm turbo` 전체 · 1C `dcp-admission` PGlite 스위트의 결합 설치판(1D 스위트만 결합으로 바꿨다 — 1C 스위트는 기존 단독 순서로 PASS).

## 결정 · 한계(사용자 확인 필요)

1. **결합 설치에서 DCP 권리 경로**: `_pending_authored_supply` 는 모든 신규 공급에 권리 결정을 요구해, 결합 설치에서는 1C DCP 공급이 사람 결정 없이 막혔다. 사람 결정을 만들지 않고 회귀를 지키려 `supply_dcp_source_policy_ok` 를 더했다 — 1C 등록 영수증 + 안내 연습 + 자격 F=pass(1C 가 등록된 권리 기록이 있을 때만 줌) + 원문 불변 + 현재 `csat_source_is_eligible`. AI 가 권리를 준 것이 아니며 평가(assess) 범위는 열지 않는다. 이 정책을 받아들일지는 DB 적용 승인 때 확인이 필요하다.
2. **창작 자격 축**: A(DB 재계산 해시 결속) · B · C(두 모델 내용 · 정답 수락) · D(안내 연습만) · E(평가 역할 Gold 수락) · F(**자체 창작 선언** — evidence `rights:first_party_original_declaration`, 외부 라이선스 부여 아님) · H(실제 채점기가 Gold 정답을 정답으로 채점할 때만) · G not_applicable. 축 검증 · 효과 검증 · 사람 Gold 를 했다고 주장하지 않는다.
3. 같은 판본에는 AI 결정 1건(철회 뒤 같은 판본 재결정 불가 — 새 판본 등록 필요).
4. 관리자 API 라우트 · 관리자 화면은 만들지 않았다(`recordAiReviewedSupply` 는 관리자 세션 클라이언트로 부를 준비만). 공유 DB 에 쓰지 않았으므로 현재 학습자에게 공급되는 것은 없다.

## 실패 · 복구

- SQL 미적용 상태: overlay 함수가 없으면 `server.ts` 는 기존 동작(42883 → 거르지 않음) — 화면 변화 없음.
- 적용 후 중단: `content_ai_decision_record` · `authored_ai_qualify` 실행권 회수(창작 AI 공급만 멈춤). 개별 문항은 `content_ai_decision_revoke` — 지금 공급 무효 · 과거 원장 보존.
- 되돌리기(이력 0행일 때만 · 별도 승인): SQL 머리말의 역순 절차. 행이 생긴 뒤에는 DROP 하지 않는다.
- v3 바이트를 다시 고치면 해시가 바뀌어 영수증 · DB 결정이 모두 무효가 된다 — 새 두 모델 검토가 필요하다.

## Codex 후속 연결

초기 `recordAiReviewedSupply`는 시험 외 호출부가 없어 등록을 실행할 제품 경계가 빠져 있었다. `POST /api/admin/csat/authored-ai-review`를 추가했다. `action=preview`는 두 AI의 입력·응답·완료 세션 원본과 세트 바이트를 대조하고 쓰기 세션을 열지 않는다. `action=register`는 관리자 본인 세션으로 기존 등록→AI 결정→자격→승인을 호출한다. service_role 대체 클라이언트는 없다. 폐쇄된 본문·전체 Origin·UTF-8 크기·원본 해시·명시적 완료 상태·request_id를 검사하며 타 사용자/승인 값을 받지 않는다. 저장 오류는 완료로 보고하지 않는다. 공유 DB 호출은 실행하지 않았다.

Codex 직접 실행: 관리자 경계5 + AI 등록/공급10 + 결합 DCP27 = **42/42 통과**, 변경 lint·web 타입 통과. 생성 HTML 보고서와 임시 스크립트는 제거했다. 근거 경로는 이번 사용자 지침과 기존 원천 권리·자격 정책을 함께 지키는 구현 선택이다. 별도 사람 검수 대기는 만들지 않는다. 보류 SQL 적용 자체는 AGENTS의 사용자 승인 대상이다.

## 남은 일(2B)

원천 기반 교수 활동 · 새 평가 결과의 실제 다음 계획 저장. 그 밖에: 관리자 UI/FAST 호출 경로, isolated E2E 를 v3 + AI 경로로 재실행, 실제 RLS · 동시성 시험, 공유 DB 적용 승인 패키지(SQL · 영향 · 복구).
