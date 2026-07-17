> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_session_log_practice.md
> category: feedback

---

사용자 명시(2026-07-05): **세션(대화)이 끝날 때마다 진행상황 요약을 문서에 누적 저장**해, 세션이 바뀌어도 작업을 매끄럽게 이어갈 수 있게 하라. Vocaflow 한정.

문서: `docs/SESSION_LOG.md` (git 추적, sync 스크립트가 안 건드리는 위치. `docs/AI_CONTEXT/`는 자동생성이라 금지).

**How to apply:**
- 세션/논리 구간 종료 시 `docs/SESSION_LOG.md`의 "세션 기록" 섹션 **맨 위에 최신 항목 prepend** (날짜 — 제목 + 무엇을 했나/남았나/관련 파일·커밋).
- 최상단 **"▶ 지금 이어서 할 일 (RESUME HERE)"** 블록은 매번 **통째로 덮어써** 최신 상태만 유지. 새 세션은 여기부터 읽는다.
- 문서가 ~800줄 초과하면 `docs/SESSION_LOG_02.md`를 새로 만들고 이전/새 문서에 상호 링크(체인).
- 이 갱신은 [[feedback_auto_doc_and_git]] 표준 흐름의 일부로 별도 알림 없이 자동 수행.

**Why:** 사용자는 장기 연속 작업(감사·마이그레이션·모듈 구축)을 여러 세션에 걸쳐 진행하며, 컨텍스트 유실 없이 재개하길 원함. CHANGELOG(릴리스 단위)·memory(단발 milestone)와 달리 SESSION_LOG는 "지금 어디까지 했고 다음에 뭘"을 한 곳에 담는 resume anchor.

