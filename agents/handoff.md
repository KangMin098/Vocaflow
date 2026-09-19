# 인수인계 양식

> `node agents/scripts/handoff.mjs <from> <to> …` 가 이 양식으로 `.agent-handoff/latest.md` 를 만든다(손으로 쓰지 않는다).
> 검사: `node agents/scripts/handoff.mjs --validate`. 라우팅·폴백 규칙은 [router.md](./router.md).

## 필수 6항목

| # | 제목 | 채우는 곳 | 비면 |
|---|---|---|---|
| 1 | 브랜치 | 자동 — 현재 브랜치 @ HEAD | — |
| 2 | 변경 파일 | 자동 — `git status --porcelain` (공유 워크스페이스라 남의 변경이 섞일 수 있다) | — |
| 3 | 완료된 것 | `--done "…"` (여러 번) | validate FAIL |
| 4 | 남은 것과 수용 기준 | `--todo "…"` · `--accept "…"` (여러 번) | validate FAIL — 수용 기준이 없으면 받는 쪽이 끝을 모른다 |
| 5 | 다음 한 동작 | `--next "…"` (하나) | validate FAIL |
| 6 | 실행 금지 사항 | `--forbid "…"` + 항상 들어가는 4개(force/main push·`--no-verify` · 마이그레이션 자동 적용 · `.env` · 남의 잠금) | — |

부록: `git diff HEAD --stat` · 작성 에이전트의 최근 대화 10턴(비밀값 패턴이 있는 턴은 생략) · 받는 쪽 시작 명령.
기계용 `latest.json` 에 `{from, to, branch, head, files, created_at, ack}` 가 함께 남는다 — `--verify` 가 이것으로
「브랜치가 같은가 · 인계 시점 커밋이 지금의 조상인가 · 인계된 변경이 작업 트리나 이후 커밋에 남아 있는가」를 본다.

## 좋은 예

```
node agents/scripts/handoff.mjs claude codex \
  --done "guard.mjs 판정표 62건 + CLI 테스트" \
  --todo "Codex 쪽 훅 실측 (codex 설치 후)" \
  --accept "codex exec 로 rm -rf 시도 시 exit 2 차단 로그가 .agent-logs/guard.jsonl 에 codex 로 남는다" \
  --next "npm i -g @openai/codex 후 codex login" \
  --forbid "agents/mcp.source.json 외의 MCP 파일 손편집"
```

수용 기준은 **확인 가능한 문장**으로 쓴다 — "잘 동작한다" 가 아니라 "무슨 명령을 치면 무엇이 나온다".
