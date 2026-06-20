> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_copyright_gate_us_license.md
> category: project

---

2026-06-05 PM 결정 — `library_books.copyright_safe_in_kr` 게이트를 한국 저작권(저자 사후 70년) → **소스 라이선스 신뢰(US PD / CC)** 로 전환. Migration `20260605120000_copyright_gate_us_license`.

- 트리거 `lb_compute_kr_safe()` 가 이제 `author_death_year` 대신 `license` 로 판정: `license ILIKE '%public domain%' OR 'PD%' OR 'CC%'`. 트리거 발화 컬럼도 `BEFORE INSERT OR UPDATE OF license`.
- 실측 license 값은 free-text 4종: `U.S. Public Domain`(82) · `Public domain in the USA.`(8) · `CC-BY-SA-3.0`(2) · `PD-US`(2). 적용 후 94권 전부 safe (이전 9 safe).
- **컬럼명 `_in_kr` 유지** (rename 21파일 cascade 회피) — 의미는 US-safe. RLS `anyone_read_published_safe` · enroll RPC · 게시 게이트가 이 컬럼 공유하므로 트리거 1개 변경으로 전 경로 반영.

**Why:** ingest 소스(Gutenberg/SE/Wikibooks)는 모두 자유배포 cleared인데, KR 사후70년 규칙이 사망연도 미기록 PD-US 고전 82권을 전부 '미확인'으로 차단했음.

**How to apply:** `copyright_safe_in_kr` 를 KR 저작권 신호로 읽지 말 것 — US/소스 라이선스 신호. 한계 2건: (1) `ILIKE 'CC%'` 가 CC-BY-NC(비상업)까지 매칭(현재 0건, NC 소스 추가 시 재검토). (2) 연간 cron `recompute-kr-safe` 가 author_death_year touch라 이제 dead no-op (무해, 미DROP). 게시 게이트 UI는 [[project_curation_preview_publish_ux]] 참고.

