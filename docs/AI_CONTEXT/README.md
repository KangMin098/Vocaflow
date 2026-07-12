# docs/AI_CONTEXT — 작업 history mirror

> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.

Claude Code 의 외부 memory (`~/.claude/projects/<encoded>/memory/`) 를 repo 안으로 mirror.
Claude Project (chat) 가 GitHub sync 로 작업 history 까지 보게 함.

## 카테고리

- **project/** — 76 파일 (작업 milestone / 결과)
- **feedback/** — 12 파일 (사용자 피드백 룰 (반복 지시 차단))
- **reference/** — 0 파일 (외부 시스템 참조 (Linear / Slack 등 위치))

## 갱신

```bash
node scripts/sync-export-memory.mjs
node scripts/sync-export-memory.mjs --refresh-context  # docs/CONTEXT.md 자동 블록도
```

사람이 수동 편집 X — script 가 매번 덮어씀.
