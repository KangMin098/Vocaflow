<!-- docs/implementation/learning-outcomes-20261021/01C-SUPPLY-RESULT.md -->
# 1C — 결과: 원문 파생 DCP 후보 등록과 Workspace 공급

**현재 판정: ACCEPT — 1C의 후보 등록·공급 서비스 및 격리 검증 범위.** 최종 Codex 확인은 문서 끝을 따른다. 아래 최초 제출과 R1/R2는 당시의 상태이며, 전체 E2E·공유 DB 적용 완료를 뜻하지 않는다.

기준 `65e2613bf` · 작업공간 `Vocaflow-learning-outcomes-20261021-work` · 작성 Claude Code(claude-opus-5-5) · 2026-10-21. **커밋 · 공유 DB 접속/쓰기 · SQL 실제 적용 · push · merge 없음.** Codex 검토 대기.

## 바뀐 실제 동작

| 파일 | 동작 |
|---|---|
| `apps/web/src/lib/csat/map/v62/factory-bridge/dcp-admission.ts` (신규) | `planAdmission`: 1B 검증을 그대로 재실행(`checkPacketIntegrity` · `validateOutput` · `checkSource`→`evaluateSource`). 원천은 호출자가 **지금 DB 에서 읽은 행** — 본문 · metadata digest 가 패킷과 다르면 `source_changed`. AI 검수(`vf.dcp-ai-review/1`)를 source digest · 출력 파일 sha · order/packet hash · 역할 · TASK · 문항 hash 에 대조. 근거 없는 pass · AI 의 F(권리) pass 거절. A 는 시스템 재판정 사실, F 는 등록 권리 기록이 있을 때만, G 는 공급 시점. 1B 기존 `vocaflow-ai-editorial-review/1` 은 결속(출력 sha · 원천 id)만 인정하고 축은 unknown(자격 보류). 기존 선택지 DCP 모양으로 변환: payload `{passage, choices[5], stem_ko, underline, summary_sentence, choice_language}` · answer_key `{answer 1..5, rationale_ko, evidence_quotes}`. 요청 키는 본문 hash 에서 결정론. 계획 `claims` 는 전부 false(등록 · 자격 · 출시 · 납품 · 사람 검수 아님). |
| `.../factory-bridge/dcp-supply.ts` (신규) | Supabase 경계. 관리자 세션: `factory_dcp_admit` → (필수 축 pass 일 때만) 기존 `content_qualification_record`(I2 서명, method「AI 검수 — 사람 검수 아님」). 출시 승인은 별도 `approveForGuidedPractice`(기존 `content_release_approve`, scope public). 학습자 본인 세션: 기존 `factory_order_open`(첫 주문 사유 `initial`) → `workspace_delivery_record`, 줄 · 주문 명시. 재전송은 자격을 다시 만들지 않는다. 실패는 `{ok:false, code, detail}`. 합성 계획은 `isolated` 옵션 없이 거절. |
| `supabase/migrations/_pending_factory_dcp_admission.sql` (신규 · **미적용**) | `factory_dcp_admission` 추가 전용 영수증 + `factory_dcp_admit(uuid,jsonb)` — 관리자/큐레이터만, 같은 키 같은 본문 = 이전 결과, 다른 본문 = 23505, 합성 수요 · 지원 밖 역할/TASK/유형 · 비-AI 검수 · 미등록/철회/다른 hash 공장 주문(D3) · 원문 본문 hash 불일치 · 부적격 원천 · 기존 자리(kind,ref_id,type,paragraph_idx) 충돌 거절. 후보 insert + 영수증은 한 함수 안 원자. `supply_artifact_revision` 을 감싸(`*_pre_dcp_admission` 원본) 등록 후보의 원문이 바뀌면 null → 기존 `workspace_delivery_record` · `supply_delivery_valid` 가 그대로 거절/false. 새 자격 · 승인 체계 없음. `_pending_authored_supply.sql` 은 원본을 `*_i1` 로 바꾸므로 이름은 겹치지 않는다 — 두 SQL 을 함께 올린 시험은 **NOT_RUN**(그 파일은 수정하지 않음). |
| `scripts/textbook/factory-production-local.mts` | `admission-plan --packet --output --review --current-source --out` (dry-run · 파일만 · DB 읽기/쓰기 없음 · 권리 null 고정). scripts tsconfig 포함 파일. |
| 시험 `__tests__/dcp-fixture.ts` · `dcp-admission.test.ts`(7) · `dcp-supply.pglite.test.ts`(9) | 실제 1A 서비스 → 1B 패킷/출력 → 계획, 그리고 C→B→I1-S→I1-P→I2→G2→D3→신규 SQL 을 PGlite 에 올려 서비스 함수로 종단 연결. |
| `docs/DB_SCHEMA.md` · `docs/CHANGELOG.md` | 미적용 SQL · 기능 한 줄. |

## AC 별 증거

| AC | 결과 | 증거 |
|---|---|---|
| C1 | PASS | `dcp-admission.test` C1 3건: 세 문항 → `isChoiceDcpType` · 5선지 · stem_ko · answer(2/4/1) · 요청 키 멱등 · 권리 없음 → F unknown 보류 · legacy 검수 → 축 unknown. PGlite C4: 실제 행 type/ref_id/item_role/answer 일치. 렌더러 `parseItem`(dcp-actions, 비공개)의 조건(passage · choices 5 · stem_ko)을 계약으로 대조 — 함수 직접 호출은 아님. |
| C2 | PASS | 본문 변경 · metadata 변경 · archived · display_only, 낡은 출력/검수 sha, 다른 task/role/order/packet 대상 검수, 근거 없는 pass, AI F pass, kind 위장, 합성 수요(실등록 불가 표시) · 출력 검증 실패. SQL 쪽: 합성 · 지원 밖 역할 · 비 AI 검수 · 다른 order hash · 철회 주문 거절. |
| C3 | PASS(범위 한정) | 학습자 · 로그아웃 세션 등록 Forbidden, authenticated 의 영수증 쓰기/anon 실행/원본 revision 실행 권한 없음, 다른 학습자 줄 · 닫힌 Workspace · 역할 다른 줄(independent_check) 거절. 공급은 학습자 세션 auth.uid 로만 실행. **구 goal/plan 거절은 이번 경로에 새 검사가 없다** — 기존 `factory_order_open`/`workspace_delivery_record` 의 계약을 그대로 쓰며 D3 `factory_lineage_personal_current`(link 경로)는 서비스가 부르지 않는다. 별도 시험 없음. |
| C4 | PASS | 등록→AI 자격→별도 승인(등록만으로 승인 0건 확인)→학습자 공급→`supply_delivery_valid` true. 재요청 = 같은 dcp id · 자격 반복 없음. 같은 키 다른 본문 거절. 같은 자리 새 본문 = slot occupied · 행 수 불변. 영수증 insert 오류 주입 → 후보 행까지 롤백. |
| C5 | PASS | 무승인(임의 approval) · 철회 승인 · F unknown 자격의 승인 시도 거절, 원천 부적격 → 공급 거절 · 현재 유효성 false(복구 시 true), 원문 본문 변경 → 기존 공급 false(행 보존) · 새 공급 `artifact not found` · 계획 단계 `source_changed`. 모든 실패가 `ok:false` + code. |
| C6 | PASS / 일부 NOT_RUN | 아래 표. |

## 실행한 검증(2026-10-21, 이 작업공간)

| 명령 | 결과 |
|---|---|
| `pnpm --filter web exec vitest run src/lib/csat/map/v62/factory-bridge src/lib/csat/map/v62/__tests__/{authored-supply,supply-c-annotation-binding,supply-i1,r5-delivery-g2-binding,supply-b-orders,supply-c-qualification}.pglite.test.ts --pool=forks --maxWorkers=1 --minWorkers=1` | 11 파일 · 258 통과(신규 16 포함) |
| `pnpm --filter web exec tsc --noEmit -p .` | 통과 |
| `pnpm --filter web exec tsc -p tsconfig.scripts.json` | 통과 (CLI 포함) |
| `pnpm --filter web exec eslint <신규 TS 5개>` | 통과 |
| `pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/factory-production-local.mts admission-plan --packet …/production-1b/run-20261021-a/chunk-01.json --output …/chunk-01.reviewed.out.json --review …/codex-item-review-resolved.json --current-source …/source-snapshot.json --out …/production-1c/admission-plan.json` | **NOT_RUN** — 실행 환경 권한 승인이 필요해 실행되지 않았다(우회하지 않음). 예상: 합성 수요 · 합성 정책 hash 로 `real_admissible=false`, legacy 검수라 세 문항 모두 `axis_B/C/D/H_unknown` · `axis_F_unknown` 보류. |
| `eslint` 의 `.mts` · 전체 e2e | NOT_RUN(변경 TS 만 lint, UI 변경 없음) |

## 한계 · 계약 불일치 기록

- **실제 1B 문항은 등록 불가 상태 그대로다**: 합성 수요 · 합성 정책 hash · 등록된 D3 공장 주문 없음 · 권리 기록 없음 · 축별 AI 판단이 없는 legacy 검수. 1B 합성 수요를 실제 주문으로 승격하지 않았다.
- 격리 행복 경로는 `synthetic_demand=false` 패킷 + 시험 DB 에 직접 넣은 공장 주문 행 + 시험 전용 권리 기록 id 로 「실제 등록 주문 · 권리 근거」 자리를 대신한다(`isolated` 옵션). D3 등록 RPC 는 service_role 경계라 호출하지 않았다.
- PGlite 는 슈퍼유저 단일 연결이라 RLS · 진짜 동시성은 실행되지 않는다(권한은 `has_*_privilege` · 정의자 함수 auth 검사로 확인).
- 계약 불일치 1: 적용된 I2 가 `content_qualification_record` 서명에 `p_annotation_ref/hash` 를 더했다 — 1C 는 I2 서명으로 호출(DCP 는 null; I2 제약은 csat_item 전용).
- 계약 불일치 2: I1-P 는 줄의 첫 주문 사유가 `initial` 이어야 한다 — 서비스가 이를 따른다.
- `_pending_authored_supply.sql` 을 함께 올리면 모든 신규 공급에 사람 권리 결정(`human-reviewed`)이 필요해진다. 1C 는 그 문구를 쓰거나 우회하지 않는다 — 그 SQL 이 적용되면 DCP 공급도 그 결정 없이는 막힌다(의도된 보수 동작, 별도 결정 필요).
- 지도 연습 정답 일치는 R5 독립 확인이 아니다. 세 문항은 한 지문 공유 — 독립 전이 기회 3개가 아니다.
- 공유 DB 적용(L4)은 사용자 승인 필요: SQL 검토 → 영향 범위(신규 표 1 · 함수 1 · revision 래퍼) → 격리 재현 → 승인 범위만 적용.

---

## 수정 R1 — Codex REQUEST_CHANGES 반례 수정 · 실제 호출 연결(2026-10-21, Claude Code claude-opus-5-5)

**경과**: 위 최초 결과는 **부분 완료**였다(C3 「구 goal/plan 거절」 미검사를 스스로 기록). Codex 독립 검토 = REQUEST_CHANGES. 원시 로그 `runtime/learning-outcomes-20261021/production-1c-codex-before-isolated.log` 는 이 작업공간에서 찾지 못했다(읽지 않음) — 반례는 Codex 가 남긴 시험 2개(`dcp-recovery.test.ts` · `dcp-supply.pglite.test.ts` 의 「Codex C3」)와 지시문으로 재현했다. 수정 전 두 반례는 실패(자격 영구 건너뜀 · 낡은 plan 수요에 납품 성공)였고, 수정 뒤 통과한다. 1B admission-plan CLI 의 NOT_RUN 은 Codex 가 실행해 해소(3문항 · real_admissible=false · qualification_ready=0 · shared writes 0).

| 반례 | 원인 | 수정 |
|---|---|---|
| 1 등록 성공 뒤 자격 실패 → 재요청이 replay 라며 자격을 영구 건너뜀 | 서비스가 `replayed` 면 자격 호출을 생략 | 보류 SQL 에 `factory_dcp_qualification`(후보당 1건 · 추가 전용) + `factory_dcp_qualify(uuid,jsonb)`: 등록 영수증 행 `for update` 잠금 → 인자를 영수증(판본 · 원문 hash · task · role)과 대조 · 현재 revision 확인 → 기존 `content_qualification_record` 를 같은 트랜잭션에서 호출 → 영수증. 같은 인자 = 같은 id(응답 유실 복구), 다른 인자 = 23505, `p_supersedes` 금지. 보류 후보 개선은 새 판본 등록으로만(이전 자격·승인 상속 없음). 서비스는 replay 여부와 무관하게 `factory_dcp_qualify` 를 부른다. |
| 2 plan1 수요 뒤 plan2 저장에도 납품 성공 | 공급 경로가 D3 계보를 안 봄 | `workspace_delivery_record` 래퍼(원본 `*_pre_dcp_admission`): 자격이 등록 후보면 주문 행 잠금 아래 줄/본인 일치 · `factory_lineage_personal_current` · 그 주문의 `factory_order_product_link` 가 영수증의 제품주문(id·판·hash)과 같음 · `factory_product_order_is_current` 를 확인(같은 요청 키 재전송은 원본 멱등 판정으로). 서비스 `receiveForLearner(learner, link, req)`: 학습자 세션 주문 → `d3Linker`(service_role + 실제 관리자 `p_actor` 로 기존 `factory_order_link_product`, 서명은 service SELECT) → 학습자 세션 납품. auth.uid 를 흉내내지 않는다. |
| 3 서비스가 시험에서만 호출됨 | 제품 호출부 없음 | `POST /api/admin/csat/dcp-admission`(`lib/admin/dcp-admission.ts`): `preview`(관리자·curator · service 로 원천 SELECT → planAdmission · RPC 0) · `admit`(admin · 관리자 세션 `createClient` 로 등록/자격 RPC · real_admissible=false 는 RPC 전 거절 · 미설치 `not_installed`). Origin/JSON/400000B/닫힌 본문/no-store. CLI `factory-order-draft.mjs admission-preview`. route-callers 통과 · ROUTES 갱신. **admit 쓰기는 실행하지 않았다.** 학습자 수신 API 는 만들지 않았다(링크 actor 를 학습자 요청에서 정할 근거가 없음 — 별도 결정). |
| RightsEvidence 주석 | 「사람 · 기관 결정」만 근거 | 「실제 원저작 · 라이선스 문서 관측값을 검수 역할(AI 포함)이 확인한 기록 · 검수는 권리를 새로 발급하지 않음」으로 정정. 코드상 AI 검수의 F pass 거절은 유지. |

### 수정 뒤 시험(실제 SQL · 격리 PGlite)

- `dcp-recovery.test.ts`(2): `factory_dcp_qualify` 경계 대역에서 ① 기록 전 실패 ② 기록 뒤 응답 유실 → 재요청 성공 · 같은 id · 세 번째도 같은 id · 자격 수 = 문항 수.
- `dcp-supply.pglite.test.ts`(15, 신규 6 + 기존 수정): 재요청 = 같은 기존 자격 id · `content_qualification` 행 불변(기존 `qualification_id=null` 기대를 교정) · 실제 SQL 트리거로 자격 insert 실패 주입 → 영수증 0 → 복구 → 응답 유실 재요청 같은 id · 다른 인자/다른 후보 인자 거절 · 학습자 Forbidden · 링크 뒤 goal 변경 · 링크 뒤 plan 변경(TOCTOU) 납품 거절 · 링크 없음/다른 줄/다른 제품주문 링크 거절 · 학습자 actor 링크 Forbidden · 링크 뒤 철회 → `product order not current` · 철회 뒤 링크 `product not current` · Codex C3(명시적 plan1) 거절 + 최신 plan 수요는 성공. `lineFor` 는 기본 최신 plan · 등록 제품주문 spec 사용, stale 시험만 `plan=1` 명시. 시험 트랜잭션 안 실패 RPC 는 savepoint 로만 되돌린다.
- 관리자 경계: `route.test.ts`(5) · `lib/admin/__tests__/dcp-admission.test.ts`(4) · CLI `factory-admission-preview.test.mjs`(2).

| 명령(2026-10-21, 이 작업공간) | 결과 |
|---|---|
| `pnpm --filter web exec vitest run src/lib/csat/map/v62/factory-bridge <supply 6 pglite> src/lib/admin/__tests__/dcp-admission.test.ts src/app/api/admin/csat src/app/api/__tests__/route-callers.test.ts --pool=forks --maxWorkers=1 --minWorkers=1` | 19 파일 · 315 통과 |
| `node --test scripts/textbook/__tests__/factory-admission-preview.test.mjs …/factory-order-draft.test.mjs …/factory-new-file.test.mjs` | 20 통과 |
| `pnpm --filter web exec tsc --noEmit -p .` · `pnpm --filter web exec tsc -p tsconfig.scripts.json` | 통과 · 통과 |
| `pnpm --filter web exec eslint <변경 TS 10개>` | 통과 |
| admit 실제 쓰기 · 공유 DB 적용 · e2e · `_pending_authored_supply.sql` 동시 적용 | **NOT_RUN** (지시상 쓰기 금지 · L4 승인 필요) |

### 남은 한계

- PGlite 단일 연결이라 진짜 동시 트랜잭션 경쟁은 실행되지 않는다 — 직렬화는 영수증 행 잠금 · 주문 행 잠금 설계로만 보장하며, plan/goal 행 insert 자체는 주문 행 잠금을 잡지 않으므로 납품 커밋 직전의 동시 plan 저장은 READ COMMITTED 에서 남는 창이다(`supply_delivery_valid` 가 납품 뒤 계보 변경을 false 로 보는지는 이번에 확인하지 않았다 — 미검증).
- `_pending_authored_supply.sql` 도 `workspace_delivery_record` 를 다시 만든다 — 두 보류 SQL 의 적용 순서 · 래퍼 결합은 미검증(NOT_RUN), 승인 패키지에서 순서를 정해야 한다.
- 공유 DB 적용(L4)은 사용자 승인 필요. 신규: 표 2 · 함수 2 · 래퍼 2.

---

## 수정 R2 — 현재 원천 조회 · 현재성 잠금 보완(2026-10-21, Claude Code claude-opus-5-5)

R1 위 「남은 한계」 첫 항목(주문 행만 잠가 goal/plan 동시 insert 창이 남음)과 Codex probe(`runtime/learning-outcomes-20261021/current-source-reader-before.json` — 직접 snapshot 은 preview ok, `currentSourceReader` 경유는 rejected/source_review)의 두 결함을 고쳤다. 커밋 · 공유 DB 접속/쓰기 · SQL 적용 · push 없음. probe 재실행(`probe-current-source-reader.mts`)은 Codex 몫 — 이 세션에서는 **NOT_RUN**.

| 결함 | 원인 | 수정 |
|---|---|---|
| 1 reader 경유 preview 가 source_review 로 거절 | `select('*')` 는 raw `csat_fit` 만 주고 평평한 `gate`/`windows`/`has_items` 가 없음 | `lib/admin/dcp-admission.ts`: `CURRENT_SOURCE_SELECT = SOURCE_POLICY_SELECT + content,source,source_url,license` (정본 투영 `gate:csat_fit->gate` · `windows:csat_fit->make->windows` 재사용). `has_items` = 같은 article 의 `csat_dcp_items`(kind=article, ref_id=id) head count > 0 — `/api/admin/csat/sources` 의 `currentSource` 와 같은 조회. 원천 조회 오류 · 문항 조회 오류 · null count 는 던진다(false/0 아님). 투영되지 않은 raw 행(`csat_fit` 키 존재)은 `source_row_not_projected` 로 거절. digest · `source_changed` 검사는 그대로(행 hash 로 바꾸지 않음). |
| 2 goal/plan 변경과 납품 사이 창 | 래퍼가 주문 행만 잠금 | 보류 SQL 의 `workspace_delivery_record` 래퍼가 현재성 조회 **전에** ① `pg_advisory_xact_lock(hashtext('map_goal:'‖user))` → ② `pg_advisory_xact_lock(hashtext('map_plan:'‖user‖':'‖template))` → ③ `learner_workspace` 행 `for update` → ④ `factory_order` 행 `for update`. ①② 는 `csat_map_goal_set` · `learner_workspace_plan_commit`(20261010180218 · 실제 DB 정의는 Codex 가 SELECT 로 확인)과 같은 키. user · template 은 `auth.uid()` 소유 주문 → 그 Workspace 행에서 유도(클라이언트 값 아님), 잠근 뒤 소유 · 템플릿 · 주문-Workspace 일치를 다시 확인. 재전송 멱등 · 줄/본인 · 계보 · D3 링크 · 철회 검사는 그대로. 새 표 · writer 변경 없음. |

**has_items 의 한계**: 지금 그 원천에 걸린 `csat_dcp_items` 가 있는지(현재 보유 문항)만 본다 — 과거 문항 이력 · 다른 kind 는 보지 않으며, 등록 직후 새 후보가 생기면 다음 조회부터 true 다.

**잠금의 한계**: 직렬화는 승인된 RPC writer(같은 자문 키)와 Workspace 행 갱신에만 성립한다. RPC 를 거치지 않는 직접 insert(관리자 SQL · 시험 픽스처)는 막지 않는다. writer 는 각각 한 키만 잡으므로 목표 → 계획 순서와 교착하지 않는다. 원본 `workspace_delivery_record_pre_dcp_admission` 내부 잠금 순서는 바꾸지 않았고 그와의 교착은 실행 검증하지 않았다.

### 시험

- `lib/admin/__tests__/dcp-admission.test.ts`(7, 신규 3 + 교체 1): select 문자열 = 정본 투영(+ 본문 · 출처 · 권리, `*` 없음) · 문항 head count 조회 인자 · 평평한 row + has_items · **reader 경유 preview = 같은 정상 snapshot 직접 preview**(probe 회귀) · raw `csat_fit` 행 거절 · 문항 조회 오류/null count/원천 오류 throw · 없음 null · 문항 0 → false.
- `dcp-supply.pglite.test.ts`(17, 신규 2): ① 정적 — writer 마이그레이션의 두 키 문자열이 있고, 래퍼 본문에 같은 키가 목표 < 계획 < Workspace 행 잠금 < 주문 행 잠금 < `factory_lineage_personal_current` 순서로 있으며 user/template 이 auth.uid 소유 주문 · Workspace 행에서 유도됨 ② 실행 — 정상 납품 트랜잭션 안에서 `pg_locks` 에 `map_goal:<user>` · `map_plan:<user>:<template>` 자문 잠금이 실제로 잡힘. 기존 링크 뒤 goal/plan 변경 거절 · 다른 줄 · 닫힌 Workspace · 철회 반례와 정상 납품 양성 대조 유지.
- **실제 2연결 동시성은 실행하지 않았다(NOT_RUN)** — PGlite 단일 연결. 위 시험은 같은 키 · 순서가 SQL 에 있고 실제로 잡힌다는 것까지만 보인다.

| 명령(2026-10-21, 이 작업공간) | 결과 |
|---|---|
| `pnpm --filter web exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 src/lib/csat/map/v62/factory-bridge/__tests__/ src/lib/admin/__tests__/dcp-admission.test.ts src/app/api/admin/csat/dcp-admission` | 8 파일 · 132 통과(dcp SQL 17 · 관리자 7 · route 5 포함) |
| `pnpm --filter web exec tsc --noEmit -p .` | 통과 |
| `pnpm --filter web exec eslint src/lib/admin/dcp-admission.ts src/lib/admin/__tests__/dcp-admission.test.ts src/lib/csat/map/v62/factory-bridge/__tests__/dcp-supply.pglite.test.ts` | 통과 |
| scripts 타입(`tsconfig.scripts.json`) · 나머지 supply pglite 6 · route-callers · CLI node 시험 | 이번에 재실행 안 함 — 이번 변경은 scripts · 그 경로를 건드리지 않아 R1 결과(같은 범위)를 재사용 |
| probe 재실행 · 2연결 동시성 · 공유 DB 적용 · admit 실제 쓰기 | **NOT_RUN** |

## 최종 Codex 확인

세 신규 구현 세션 `7aa174bb-5f53-49e1-9285-b16355647edd`, `51ee87f7-670f-4d8b-ae77-ff8b6d8779ef`, `c21e39c2-acda-4866-b7d3-60ab4a684137`의 결과를 순차 검증했다. 처음의 자격 복구/옛 계획 반례는 실제 두 실패를 보존했고, 수정 뒤 원천 조회와 같은 경로를 다시 확인했다.

- 실제 `admission-plan` CLI 실행: 문항 3개, `real_admissible=false`, `qualification_ready=0`. 합성 수요/정책과 미결속 검수의 보류 이유를 출력했다. 최초 CLI NOT_RUN은 해소했다.
- DB 실제 열 구조와 원천 정책 투영을 대조한 외부 probe: 수정 전 정상 snapshot 직접 호출은 ok, reader는 source_review로 거절. 수정 후 둘 다 ok (`current-source-reader-before.json`, `current-source-reader-after.json`). 실제 DB에는 쓰지 않았다.
- 추가 발견: 실제 Supabase의 표 기본 권한이 service_role에도 쓰기를 준다. 기존 시험은 이 기본 권한을 재현하지 않았고 새 영수증 표의 직접 insert 가드도 빠져 있었다. 실제 기본 권한을 모사한 시험에서 쓰기 권한 true와 가드 부재를 재현한 뒤, 두 표에 기존 `supply_writer_guard`를 적용하고 service_role은 SELECT만 남겼다. `production-1c-privilege-before-valid.log` 실패 2 → `production-1c-privilege-after.log` 19 통과. 최초 probe의 시험 helper 누락 오류는 결함 증거로 세지 않았다.
- 최종 관련 웹 **139/139**(SQL 19 포함), 웹 타입·변경 시험 lint exit 0. 직전 세션의 더 넓은 관련 회귀 315와 CLI Node 20 및 scripts 타입 검사는 범위가 겹치는 부분에서 재사용했다. 최종 로그 `production-1c-final-related.log`, 독립 핵심 26 로그 `production-1c-codex-after.log`. 로그 루트는 `D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021`.

공유 DB 적용·실제 입고/납품·학습자 브라우저·두 연결 동시성·보류 authored SQL과의 결합은 NOT_RUN이다. 잠금은 같은 키를 쓰는 실제 승인 writer와의 직렬화 계약 및 PGlite의 실제 잠금 획득까지 검증했다. 모든 운영 시나리오의 동시성을 실행했다고 주장하지 않는다. 다음 1D는 명시적 납품의 열기·수행·연습 기록이고, 원래 사람 판단을 요구하던 authored 공급은 단계 2에서 AI 판단을 사실대로 기록하는 경로로 보완한다.
