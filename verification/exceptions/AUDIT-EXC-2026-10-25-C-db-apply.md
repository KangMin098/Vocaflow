# 감사 예외 AUDIT-EXC-2026-10-25-C — 승인 티켓·실행 이력 없는 DB 쓰기 2회

- 기록: 2026-10-25, owner `csat-lecture-audit-c`(Claude). 사용자 결정(같은 날): 적용 데이터 **유지** · 이 예외 기록 · 이후 관리성 DB 쓰기는 승인 러너.
- 승인 티켓은 **소급 생성하지 않았다.** 데이터는 롤백하지 않았다.

## 사실

| # | 대상 | SQL 파일 · 전체 SHA-256 | 실행 |
|---|---|---|---|
| 1 | `public.csat_items.choices[4]` — 2025#30 · M1809#35 · M2006#35 · M2106#35 · M2206#35 · M2209#35 | `research/csat-lecture-audit-c-20261024:docs/csat-learner/lecture-audit-c-20261024/g/db-fix/C-six/forward.sql` · `d79e119c159450035f2e7814363965f5b3e58900c7133b9d3e3a90074310aa58` | claude.ai Supabase 커넥터 `execute_sql`, DO 블록(6행 아니면 전체 예외) |
| 2 | `public.csat_items.passage` 2014A#29 + `public.csat_item_analyses` v6 draft 1행 insert | `…/g/db-fix/B-2014A29/stage1.sql` · `12c2915e873623b3a133fb9b20fa51bf272c8880d14741515da76a4c03b58764` | 같은 경로, DO 블록 |

- 승인 메시지: 사용자 대화 2026-10-25 「승인」 — 직전 보고의 승인 필요 목록 1(6건 forward)·2(단계 1)에 대한 답. 한 낱말 승인이라 범위는 실행자 해석이며, 3(사람 내용 승인)·단계 2·되돌리기(삭제)는 실행하지 않았다.
- SELECT 증거(실행 직전/직후):
  - 6건 choices md5 전 `b7c5a422…` `0dc1e7cc…` `a2b537e7…` `89281d41…` `a4aa1417…` `02ce114a…` → 후 `f8230ca0…` `a598f33f…` `39d319b9…` `11632335…` `1311573e…` `2a5004c8…` · passage md5 불변.
  - 2014A#29 passage md5 `354dba3df716d6db04d6cc643afeec3e` → `6b4dd8818f63a6c9086b06dd8833027a` · v6 draft choice_analysis `6d6966e6…` · design_intent `26bda96c…` · solve_procedure `6a6e9fb5…` · 검수 0 · 최신 published v5.
- 원장 수리 기록: 로컬 main `ff0a5da48`(커밋 `1f466e8eb`).
- 사후 검증: 연구 브랜치 `…/g/post-apply-20261025/RESULT.md`(결속 감사 7문항 · 판본 충돌 기록).

## 왜 예외인가

정책(당시 dev-mode `db_apply`)은 대화 승인 뒤 `mcp__supabase__*` 적용을 허용했으나, 실제 실행은 다른 서버(`mcp__claude_ai_Supabase__*`)였다. 승인 창·1회용 티켓 훅(`vocaflow-db-approval.mjs`)은 Bash 전용이라 어느 MCP 경로에도 티켓·실행 기록이 남지 않는다.

## 보완 (2026-10-25)

- 전역 PreToolUse 훅 `~/.claude/hooks/vocaflow-db-mcp-guard.mjs`(사본 `vocaflow-db-mcp-guard.mjs.copy`) — Vocaflow 워크트리에서 이름에 supabase 가 든 MCP 서버의 `apply_migration` 은 항상 거부, `execute_sql` 은 읽기 전용 SELECT 만 통과. 판정 불가 = 거부. 시험 10/10.
- `config/dev-mode.json` `db_apply` — 실행 도구와 무관하게 승인형 배포 러너(`scripts/db/<id>/deploy.mjs apply --confirm-sha`, 티켓)로만.
- 한계: Codex 세션 · 다른 클라이언트에는 이 훅이 없다(Codex 는 MCP Supabase 쓰기 권한 설정을 별도로 확인해야 한다 — 미확인).
