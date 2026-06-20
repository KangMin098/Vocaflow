> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_inflection_book_residual_verified.md
> category: project

---

Reconnaissance 2026-05-31 overturned the sequential plan's Phase 1 & Phase 2 premises (7th over-spec block; see [[feedback_spec_memory_claims_unverified]]).

**Phase 1 (inflection fill) — already solved.** `shared_dictionary.inflections jsonb` is 64% filled (25,152/39,107) by external source `freq_external_a`. Shape: `{"forms":[{"form","freq"}],"source"}` — a morphological FAMILY cluster (incl. derivations + prefixed + informal variants, e.g. happy→happily/happiness/unhappy). Extraction reads it via `inflections @? '$.forms[*].form ? (@ == "<surface>")'` (2 GIN indexes; `find_unmatched_lemmas` + `extract_vocabulary_for_user_v2` L2 path). Empty 36% are mostly surface-form duplicate rows (was/were/went) whose lemma cluster already covers them. Genuine top-5k residual = 58 compound nouns (weekend/bedroom/laptop) that match via L1 anyway. Suppletives (better/best/mice/feet) already covered. → Do NOT build inflection-fill.mjs.

**Phase 2 (derivational seed) — near-zero value.** Real book residual (library_book_vocabularies, 14,291 distinct words) = **2,073 unmatched** (recall 85.49%), NOT the plan's 376. Breakdown: dominated by **proper nouns** (Elizabeth/Holmes/London/Pemberley) + Roman-numeral chapter artifacts (ii/iv/vii) + foreign fragments (de/la/du) + 139 apostrophe artifacts; ~726 derivation-recoverable but ALL archaic hapax (overspread/suitableness/inclemency, freq ≤7). **Extractor silently drops unmatched words by design** (returns only dict-matched ≥ threshold) — so proper nouns are NOT a quality problem.

**Only positive-value action:** tiny curated enrichment of genuinely-common lexemes ENTIRELY absent from dict — `forever, american, somber, madman, countryman, englishman, nobleman, horseback, bedside` (~dozens total, not thousands). Small enough to do directly via Supabase MCP per [[feedback_claude_code_is_llm]].

**2026-05-31 — diagnostic vs extractor divergence fixed.** `find_unbound_book_lemmas` (admin curation diagnostic, see ADR 0001/0002 in docs/adr/) used rule-based `en_inflection_bases`/`en_derivational_bases`, but the real extractor (`extract_vocabulary_for_user_v2`/`extract_book_vocabulary_admin`) maps via freq_external_a `inflections` cluster — so it over-reported cluster-recoverable derivations as genuine_miss. Migration `unbound_cluster_base` (applied) added a `cluster_base TEXT` column = the base whose cluster contains the lemma (same predicate as extractor: v_level+classified_by+meaning_ko, ORDER BY frequency_rank). reason classification UNCHANGED (ADR D1 keeps derivations as seed candidates). Validated on "Twenty years after" (book 9124af41): genuine_miss 376 → 257 have cluster_base, noise 80 → 12. UI: BookExtractionPanel.tsx shows `클러스터 base` column + `↻ 클러스터 회수 N` stat chip. So "derivation/inflection unmapping" was a diagnostic artifact, not a real extraction gap.

