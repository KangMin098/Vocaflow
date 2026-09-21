@AGENTS.md

# Vocaflow — Claude Code 전용 보충

> 공용 규칙의 정본은 위에서 불러온 `AGENTS.md` 다. 여기에는 **Claude Code 에만 해당하는 것**만 둔다.
> 공용 규칙을 이 파일에 다시 쓰면 `node agents/scripts/check.mjs` 가 중복으로 실패한다 — 고칠 곳은 AGENTS.md 다.
> (v06.34 까지의 495줄 원문 중 200줄 한도를 넘는 배경은 `docs/agents/CONTEXT_DETAIL.md` 에 그대로 있다.)

## 스킬 · 서브에이전트 · 슬래시 명령

- UI 작업에서 `vocaflow-design` · `design-taste-frontend` 는 필요할 때 부르는 선택 스킬이다.
- 드레인 청크 팬아웃은 `.claude/agents/` 의 전용 서브에이전트로: `csat-item-analyst` · `pending-words-judge` · `vcb-enrich-chunk` · `vcb-seed-validator` · `vcb-curation-comparator`. 진입은 슬래시 명령(`/pending-words-drain` · `/vcb-batch-enrich` · `/vcb-seed-validate` · `/vcb-curate-compare`).
- DB 위험 작업은 `/db-checkpoint` 로 앞뒤 스냅샷, 장애는 `/db-incident`, 헬스 판정·조치는 `/db-health-audit` → `/db-remediate`.
- 서브에이전트는 **독립 청크를 병렬로 돌릴 때와 넓은 탐색**에만 쓴다. 파일 하나·사실 하나 확인은 직접 한다.
- 3개 이상 영역에 걸치거나 되돌리기 어려운 변경은 plan mode 로 계획부터 세운다.

## Supabase MCP (Claude 쪽)

- 서버 이름 `supabase` — 정의는 `agents/mcp.source.json`, `.mcp.json` 은 생성물. 토큰은 셸 환경의 `SUPABASE_ACCESS_TOKEN`.
- `mcp__supabase__apply_migration` 은 사용자가 SQL 을 본 뒤 승인한 경우에만 호출한다. 조회는 `execute_sql`.
- 모델: 이 저장소 작업은 항상 Opus + xhigh effort (memory rule).

## 커밋 서명

- 공용 커밋 규칙(AGENTS.md ③)에 더해 Claude 가 쓴 커밋의 마지막 줄: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Bash 도구에서는 `git commit --only <paths> -F - <<'MSG'` 형태로 메시지를 넘긴다(PowerShell here-string 은 제목에 `@` 를 남긴다).

## Codex 와 함께 일할 때

- 분담·폴백 규칙: `agents/router.md`. Claude 기본 몫은 설계·계획·큰 리팩터·문서·대화형 탐색.
- 기능 하나를 끝내면 반대 에이전트 리뷰: `codex review --uncommitted` (Codex 가 설치·로그인된 경우).
- 사용량 한도 메시지를 보면 즉시 `node agents/scripts/handoff.mjs claude codex` → 출력된 시작 명령을 사용자에게 전달.
- 세션 시작 훅이 `.agent-handoff/latest.md` 요약을 주입하면, 첫 동작은 그 파일의 **수용 기준 재확인**이다.
