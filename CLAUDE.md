@AGENTS.md

# Vocaflow — Claude Code 전용 보충

> 공용 규칙의 정본은 위에서 불러온 `AGENTS.md` 다. 여기에는 **Claude Code 에만 해당하는 것**만 둔다.
> 공용 규칙은 이 파일에 다시 쓰지 않는다 — 고칠 곳은 AGENTS.md 다.
> (v06.34 까지의 495줄 원문 중 200줄 한도를 넘는 배경은 `docs/agents/CONTEXT_DETAIL.md` 에 그대로 있다.)

## 스킬 · 서브에이전트 · 슬래시 명령

- UI 작업에서 `vocaflow-design` · `design-taste-frontend` 는 필요할 때 부르는 선택 스킬이다.
- 드레인 청크 팬아웃은 `.claude/agents/` 의 전용 서브에이전트로: `csat-item-analyst` · `pending-words-judge` · `vcb-enrich-chunk` · `vcb-seed-validator` · `vcb-curation-comparator` · `video-request-designer`(영상 요청 설계, `pnpm video requests:export` 뒤). 진입은 슬래시 명령(`/pending-words-drain` · `/vcb-batch-enrich` · `/vcb-seed-validate` · `/vcb-curate-compare`).
- DB 위험 작업은 `/db-checkpoint` 로 앞뒤 스냅샷, 장애는 `/db-incident`, 헬스 판정·조치는 `/db-health-audit` → `/db-remediate`.
- 서브에이전트는 **독립 청크를 병렬로 돌릴 때와 넓은 탐색**에만 쓴다. 파일 하나·사실 하나 확인은 직접 한다.
- 되돌리기 어렵거나 범위가 불명확한 작업만 계획부터 정리한다. 파일 수·영역 수만으로 plan mode를 강제하지 않는다.

## Supabase MCP (Claude 쪽)

- 서버 이름 `supabase` — 정의는 `agents/mcp.source.json`, `.mcp.json` 은 생성물. 토큰은 셸 환경의 `SUPABASE_ACCESS_TOKEN`.
- `mcp__supabase__apply_migration` · `execute_sql` 은 도구 권한이 허용돼 있다(2026-10-21). 쓰기는 사용자가 대화에서 SQL 을 보고 승인하면 바로 호출한다 — 승인 전 호출 금지. 조회는 `execute_sql`.
- 모델과 사고 수준은 작업 난도·지연·비용에 맞춰 선택한다. 특정 고비용 조합을 프로젝트에서 강제하지 않는다.

## 커밋 서명

- 공용 커밋 규칙(AGENTS.md ③)에 더해 작성 에이전트를 서명한다. 모델 이름을 넣을 때는 실제 사용한 모델을 쓴다.
- Bash 도구에서는 `git commit --only <paths> -F - <<'MSG'` 형태로 메시지를 넘긴다(PowerShell here-string 은 제목에 `@` 를 남긴다).

## Codex 와 함께 일할 때

- 분담·폴백 규칙: `agents/router.md`. 공통 브랜치 판단은 `AGENTS.md`와 `docs/WORKTREE.md`를 따르며 AI 교대·작업 단계 변경만으로 공간을 새로 만들지 않는다.
- 자동 Codex 리뷰는 없다(2026-10-10 사용자 결정). Stop 훅·DB 게이트·오케스트레이터 모두 Codex 를 부르지 않는다. `review.mjs` · `codex review` 는 사용자가 요청할 때만 쓴다. 계획·머지 전에 Codex 리뷰를 돌리지 않는다.
- 사용량 한도 메시지를 보면 즉시 `node agents/scripts/handoff.mjs claude codex` → 출력된 시작 명령을 사용자에게 전달.
- 세션 시작 훅이 `.agent-handoff/latest.md` 요약을 주입하면, 첫 동작은 그 파일의 **수용 기준 재확인**이다.
