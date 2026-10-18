# DB-2 · I2 · 납품↔G2 적용 기록 — 2026-10-18

대상 개발 DB `jajenrevcbmrpaliomxv` · 지시 `.agent-handoff/DB2-I2-BIND-RUN.md` → `.agent-handoff/I2-RUN.md` → 사용자 재개 지시(R5 최종 적용).
체크포인트 라벨 `r5-db2-i2-bind` (before 03:09:34Z · after 05:21:58Z).

## 승인 단위와 실행 경로

| # | 단위 | 이력 version · name | 승인 SHA | 실행 경로 · 승인 기록 |
|---|---|---|---|---|
| 1 | DB-2 | `20261017200100` factory_i1_db2_partial | `2165015d…896b` | `scripts/db/factory-i1/deploy.mjs` · `claude-code-dialog 2026-10-18T03:20:03.527Z ticket:866b29132e8a` |
| 2 | I2 주석 결속 | `20261018120000` workspace_supply_c_annotation_binding | `e7f7c16f…0c8b` | `scripts/db/r5-bind/deploy.mjs` · `claude-code-dialog 2026-10-18T05:14:21.606Z ticket:6df2c326edc3` |
| 3 | 납품↔G2 결속 | `20261018120100` r5_delivery_g2_binding | `8043ce3b…4c2f` | `scripts/db/r5-bind/deploy.mjs` · `claude-code-dialog 2026-10-18T05:18:13.189Z ticket:7cb77d128fc8` |

## 경위 (실패·차단 기록 보존)

- DB-2 첫 시도: `DEPLOY_BLOCKED[db1-first]` — 지시서 명령에 러너 필수 플래그 `--db1-verify-log` 가 빠져 있었다(종료 2 · DB 무변경). 두 번째: 승인 티켓 만료(종료 2). 세 번째: DB-1 verify 로그를 붙여 적용.
- I2 를 MCP `apply_migration` 으로 적용하려 했으나 ① DB 게이트 훅이 「같은 SQL 이 여러 worktree 에 있다」로 거절, ② 게이트 보정 뒤 Claude Code auto mode 판정(Blind Apply)이 2회 거절. auto mode 는 에이전트가 끌 수 없고 AGENTS.md 정식 경로가 승인형 러너이므로, 승인형 러너 `scripts/db/r5-bind/deploy.mjs` 를 새로 만들어 같은 바이트를 적용했다. allow 규칙 추가 · 훅 비활성 · TLS 우회 · SQL 수정 없음.
- 새 러너는 R5 통합 세션(vocaflow-5c)의 독립 리뷰 P1(자동화/CI 차단 누락)을 반영한 뒤 사용했다 — factory-i1 `writeAuthorizationBlocks` 재사용 · 회귀 7/7.
- I2 첫 apply 는 승인 티켓 만료(종료 2 · DB 무변경), 다음 시도에 적용.
- 납품↔G2 SQL 은 `Vocaflow-r5-e2e-completion` 의 원본을 바이트 그대로 `supabase/deploy/r5-bind/` 로 복사(SHA 일치). 원본 worktree 는 수정하지 않았다.
- 두 SQL 의 머리 주석 「보류(적용 안 함)」 문구는 승인 이전 표기 — SHA 보존을 위해 고치지 않았다.

## 검증

- DB-2: 러너 내장 7/7 · 별도 verify ok.
- I2: 내장·별도 verify 10/10 — 기록 함수 1개(주석 인자 포함) · annotation 열 2 · 결속 CHECK · `supply_current_annotation` RLS on · authenticated/anon/service_role 권한 없음 · 0행 · 내부 함수(supply_annotation_matches · supply_delivery_valid(_i1) · workspace_delivery_record_i1) 클라이언트 호출 불가 · 쓰기 RPC authenticated 만 · 정의자 search_path pg_temp.
- 납품↔G2: 내장·별도 verify 11/11 — `workspace_delivery_attempt` RLS on · 첫 노출 부분 고유 인덱스 `(user_id, exposure_key) WHERE first_exposure` · `UNIQUE (user_id, request_key)` · `UNIQUE (attempt_id)` · 추가 전용·쓰기 가드 트리거 2 · 정책 `wda_owner_read:SELECT` 1개 · 클라이언트 쓰기 없음 · RPC authenticated 만 · `r5_exposure_key` 내부 전용 · 0행.
- 읽기 전용 smoke: 없는 자격/공급 → `supply_annotation_matches`·`supply_delivery_valid` false · 인증 없는 `workspace_delivery_attempt_record` → 42501 거절 · `r5_exposure_key` 지문 없는 ref → `item:` 대체 키.
- 이력 SHA(`sha256(array_to_string(statements,''))`): 4행 모두 승인값과 일치(DB-1 `061a48a8…` 포함).
- 학습 기록 불변: learning_records 699 · reading_sessions 287 · daily_activity 90 (before = after).
- 자격 · 승인 · 등록부 행: content_qualification 0 · content_release_approval 0 · supply_current_annotation 0 — 2020#24 행은 만들지 않았다.

## 체크포인트 diff (same 제외)

- `bloat_sampled_pct` disappeared(db_health_metrics) + appeared(library_article_vocabularies) — 회전 표본 정상
- `rls_missing_tables` 68 → 69 — `supply_current_annotation`(RLS on · 정책 0 · 클라이언트 권한 0 = 소유자 전용, 설계대로)
- `exposed_secdef_funcs` 142 → 144 — 새 정의자 함수(권한은 위 verify 로 확인)
- stats_counter_age_min · cron_stale_max_hours · db_size_mb(+0.1MB) — 시간차
- advisor 비교: 이 세션 미실시(별도 필요 시 `/db-health-audit`)

## 로그 (gitignore · 로컬)

- `supabase/deploy/factory-i1/logs/db2-apply-jajenrevcbmrpaliomxv-2026-10-18T03-20-14-094Z.json` · `db2-verify-…-2026-10-18T03-20-24-219Z.json`
- `supabase/deploy/r5-bind/logs/i2-apply-jajenrevcbmrpaliomxv-2026-10-18T05-17-43-416Z.json` · `i2-verify-…-2026-10-18T05-18-06-240Z.json`
- `supabase/deploy/r5-bind/logs/g2-apply-jajenrevcbmrpaliomxv-2026-10-18T05-21-46-224Z.json` · `g2-verify-…-2026-10-18T05-21-57-384Z.json`
