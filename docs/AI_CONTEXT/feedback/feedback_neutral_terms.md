> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_neutral_terms.md
> category: feedback

---

When writing code comments, doc, migration commentary, or instructional plans, do NOT name third-party tools/decks as the source of imported data. Use neutral terms instead.

| Avoid | Prefer |
|---|---|
| "Anki 23.10+ 검증" | "FSRS 표준" |
| "Anki-style" | (omit) or "SM-2 표준" |
| "Anki/RemNote 호환" | "표준 SRS 호환" |
| "Anki C2 부정확 자동 흡수" | "CEFR 라벨 부정확 자동 흡수" |
| "Oxford Dictionary A1-C2" | "외부 시드 사전" |
| "(Anki) history" / "Oxford-anki source" | "prior 'imported' provenance" |

**Why:** On 2026-05-12 the user explicitly requested project-wide removal of "Anki" and "Oxford" terms. The mechanism behind those references (FSRS, SM-2, imported seed dictionary) is fine — but the vendor/deck attribution shouldn't appear in our codebase or docs. Phase 14.6 plans drafted before that decision still contain "Anki C2 부정확" phrasing; substitute before applying.

**How to apply:**
- Code comments, docstrings, SQL comments, README → rewrite with neutral wording.
- DB `source` enum values like 'oxford5000' that are already in migration history are left in place (immutable artifacts) but do not propagate them into new code or doc text.
- External CSVs under `packages/library-pipeline/data/ngsl/` are untouched (false-positive substring matches in `bank/rank/tank/thank`).

