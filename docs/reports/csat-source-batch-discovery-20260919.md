# CSAT source asset audit and batch discovery — 2026-09-19

This run starts from the working tree, including pre-existing uncommitted normalization work. Authorship of uncommitted assets is unknown unless a report says otherwise. Historical counts are not used as current evidence. The supplied task ends mid-section 29.

## Evidence and execution scope

Live metadata audit: 109,043 articles; 87,716 ready/published candidates; 38,605 distinct article references. Initial grade counts: usable 9,103; conditional excerpt 4,296; excerpt preparation 10,861; unjudged 48,811; missing analysis 3; blocked 14,642. Initial revision/grade drift and orphan references: zero. Duplicate content hashes: 115 groups; duplication is a review signal, not permission to delete.

Evidence: `.agent-logs/csat-sources-discovery-20260919.json`, live SQL catalog (`to_regclass`, information_schema, function definitions), and the extended audit's per-ID work manifest. Scans are sequential, not a single MVCC snapshot. No schema migration is required by this run.

## Asset inventory

Y/N describe inspected behavior, not inferred reliability. Last use is a verifiable commit or report date, not an invented runtime date. All paths are repository-relative.

| Asset | Origin / last evidence | Caller and purpose | Safety / schema / resume / rollback / tests | Decision |
|---|---|---|---|---|
| `scripts/csat/gate-rules.mjs` | Claude history, Sep 6–17 | importers; purpose-specific publication rules | Current fields; pure; rule version 3/code version 1; gate-screen control corpus | KEEP; publication is distinct from final source permission |
| `gate-book-export.mjs`, `gate-article-export.mjs`, their drain outputs | Claude, `3f575bcd`, `2d17f29a` | manual agent judgment; book/title grouping | Legacy title collisions/partial text remain historical limitations; new scoped article mode exports full text, UUID/revision/SHA256, skips judged/raw rows and refuses to overwrite evidence | IMPROVE applied to article export; retain book evidence |
| `scripts/csat/gate-import.mjs` | Claude, `2d17f29a` Sep 17 | both book and article drains; legacy diagnostics | Legacy writes merged whole csat_fit without CAS and used title-keyed judgments without body revision. Searched callers; correspondence help migrated to scoped UUID flow | RETIRE commit path with explicit error; KEEP read-only diagnosis and old evidence |
| `gate-drain-validate.mjs` | Claude; current local outputs | verifies input order, vocabulary, conflicts | Read-only; does not establish body revision or install itself inside importer | KEEP as one gate, not sufficient approval |
| `gate-mixed-export.mjs` / `gate-mixed-import.mjs` | Claude legacy L3 recovery | per-ID recovery of mixed book fragments; new scoped content import | Legacy import rewrites timestamps, lacks CAS/backup/rv/cv and can restore archived rows. New --input validates UUID/revision/body, backs up before values, writes gate only and skips exact replays | RETIRE legacy unscoped commit; CONSOLIDATE new article judgments into the improved scoped importer |
| `plos-extract.mjs` / `plos-extract-recheck.mjs`, `lib-plos.mjs` | Claude, `00fd7e2b` Sep 5 | raw → derivative passages; content integrity checks | Dry-run/cursors/hash identity; new derivatives require separate judgment/analysis; extraction is not readiness | KEEP, CONDITIONAL and demand-bound; do not re-extract all raw rows |
| `scripts/acp/plos-abstract-repair.mjs` | Claude, Sep 15 repair history | duplicated abstract repair | Backup JSONL and affected-ID reprocess path; changes bodies and downstream analysis | KEEP for its exact defect only; do not reuse as generic cleaner |
| `scripts/acp/reprocess.mjs` | Claude, `1132df51` Sep 15 | selected-ID article reanalysis | Dry-run selects IDs only; retries reads; replaces vocabulary; RPC errors not checked; failed rows printed but exit remains success; repeats successful rows on retry | IMPROVE; not selected to repair one missing V-Level with existing vocabulary |
| `compute_article_vrl(uuid)` | live DB function | existing dictionary p75 calculation | Existing vocab only; skips empty vocabulary; updates V-Level/components/timestamps; no text rewrite | KEEP; narrowly call once for confirmed missing field, with row lock and backup |
| `source-eligibility.ts:evaluateSource`, `source-eligibility-row.ts` | working-tree normalization, Sep 18 report | web/API/scan/composer policy | Pure canonical v3; policy and eligibility tests; row projection reused | KEEP; `judgeSource` retained only as diagnostic subroutine |
| `source-policy-refresh.mjs` | uncommitted normalization, Sep 18 report | cache export/import and quality scan | Dry-run export; explicit writes; offset resume; backups; invalid/future dates previously bypassed TTL; input-only differences previously skipped | IMPROVE in this run: strict preflight, current revision/item/input validation, exact diff manifest, full-field verification |
| `scripts/audit/csat-sources-audit.mjs`, checks, workflow | uncommitted normalization, Sep 18 report | full live audit; scheduled read-only CI definition | Grade-only checks previously missed same-grade contract drift; orphan IDs previously did not fail CI | IMPROVE in this run: shared projection, full contract comparison, reason counts and A–D candidate IDs |
| eligibility/inventory/yield/defect scanners | Claude, `b328cb6b`, `e9ba39ce`, `bac7a75f` | separate fast metadata, policy, body and yield observations | Read-only DB; some regenerate local JSON; full vs sample distinguished; existing scanner tests | KEEP; these are different measurements, not duplicate mutation batches |
| `extraction-defect.ts`, VOA cleaner and tests | existing + Sep 18 uncommitted improvements | ingestion and review signal detection | Heuristics with known false positives; source fixtures; no auto-rejection | KEEP; conditional review remains necessary |
| eligibility cache migrations and SQL consumers | uncommitted files; live functions inspected | revision fail-closed learner/textbook consumers | Source/answers preserved; history for input/result revisions; quality-only history is not retained by trigger | KEEP; local per-batch full backups required; do not reapply migrations |
| `/admin/csat/sources` operations API, inspector and help | uncommitted Sep 18 normalization | queue → content/reasons/links/history → cache revalidation | Current source revision guards; existing API/Playwright tests; cache revalidation is not content judgment | KEEP; document batch limitations in existing help |
| `scripts/csat/analysis-drain-*`, `.claude/agents/csat-item-analyst.md`, generated Codex agent | Claude then shared agent setup | KICE exam question analysis | Different corpus and schema from library source material | KEEP; do not run against library_articles |
| Sep 18 audit, normalization, final JSON, quality review; `.agent-logs` SQL/backups | report author attribution only | earlier decisions, failures, rollback evidence | Historical evidence; original bodies/answers preserved; local artifacts not fresh proof | KEEP; do not rewrite historical results |

No asset is deleted because of age. No duplicate Claude/Codex CEFR backfill for this corpus was found: similarly named VCB/book tools target different entities. Canonical policy projection is consolidated by importing `sourceEligibilityInput` instead of copying it in the audit. Legacy dangerous writes now fail explicitly and direct callers to the scoped importer; their code and evidence remain readable.

## Instruction audit

Repository search found root AGENTS.md, root CLAUDE.md and web/mobile/design-token CLAUDE.md; no nested AGENTS.override.md. Root CLAUDE imports AGENTS and adds tool-specific notes. The web supplement's stale CLAUDE source-of-truth, removed-section and purple Admin references were corrected to the current AGENTS contract. No alternative eligibility policy in agent instructions was found. Existing check: 8/9 pass; generated `.codex/config.toml` marker is missing (pre-existing). Unrelated local MCP settings were not regenerated. Added one root operational rule and a narrow `.agents/skills/csat-source-audit/SKILL.md`; details stay in the skill/docs.

## Batch candidate matrix — before mutation

Groups overlap and are not additive. SQL aggregates were recomputed during this run; candidate IDs and exact reason intersections are emitted by the extended audit.

| Batch | Targets | Cause / dependency | Existing asset | Auto / risk / cost | Priority |
|---|---:|---|---|---|---|
| Cache reconcile | 0 initial revision/grade drift; full-contract audit pending | Current source + item evidence | source-policy-refresh | A; low; writes changed cache rows only | P0 |
| Missing V-Level | 1 of 3 missing-analysis rows | Existing vocab p75 = 6, current value NULL | compute_article_vrl | A; low; one row, no model/API expense | P1 |
| Non-prose source decisions | 2 of 3 missing-analysis rows | VOA episode index and frequency table, both zero vocabulary | scoped content review; legacy importer needs CAS | B; two actual agent judgments, preserve bodies | P1 |
| Content judgment after excluding other blocking policies | 9,517 | Current content needed; existing title/revision safety gap | gate article/book exports | B; agent work; do not claim auto-approved | P1 |
| Quality review | 5,161 | Signals overlap; source/anchor validation before changes | extraction-defect-scan + parser tests | C; potentially high text impact; sampling is not full approval | P1 |
| Raw extraction with no other blocking policy | 1,576 | Derivative generation → judgment → analysis | plos-extract | C; high; demand and excerpt validation first | P2 |
| Accepted-content excerpt materialization with no other blocking policy | 3,907 | Question creation/review, not cache backfill | store-new-types | C; high; demand first | P2 |
| Already excluded by stable policy | 59,316 | CEFR/legal/safety/content/too-short blockers | evaluateSource | D/no mutation; do not lower CEFR or reopen a license | P3 |

Full reason counts differ from the unjudged grade: content_unjudged 17,568; raw_content_unjudged 31,529; CEFR above band 55,234; excerpt_not_materialized 49,687. One source may have all three. Pending metadata is not a single manual review queue.

Analysis and assignment: candidate CEFR values are present and valid; V-Level/VRL timestamp missing on three. category_tags is empty on all 87,716 candidates, but downstream source policy uses `csat_fit` topic/purpose and register, not an invented age/format column. No blanket category backfill is authorized by an empty unused column. Pipeline states outside candidates: queued 937, failed 4 (fetch/vocabulary insert errors), analyzing 1; a state alone does not prove stale analysis. Missing version provenance must be reported as unknown, not guessed outdated.

Measured educational keys after the two non-prose decisions: topic/topicMargin/topicV on 56,578 sources, shape/type on 66,705, gate on 70,168; purpose library 5,268, raw 36,337, csat 19,603, kids 8,960, missing 17,548. Gate producer version was rv3 for 69,815 rows, missing for 351 legacy chunk judgments plus ungated rows. Missing provenance is not evidence that every result needs recomputation.

Downstream live SQL before the linked-source batch: 19 DCP attempts, 19 render records, zero render records with sourceManifest; repaired first three sources have zero DCP attempts. Rejected-but-linked candidates: 334 sources / 43,411 items, already blocked by the canonical policy. These are preserved historical links, not 43,411 unsafe currently eligible items. Unknown historical render exposure remains unknown.

## LLM and deterministic execution distinction

The gate exports/imports do not call a model provider. Their judgments are agent-authored files; legacy judgment outputs lack reliable model/prompt-version/revision provenance. `gate-drain-validate` passed vocabulary/ordering checks with warnings for absent/short rationale and genre; that does not validate source identity or authorize import. Current scoped review records the exact body revision and reason and is tested with real HTTP requests against a local fake server.

`analyze/cefr-detect.ts` actually calls Anthropic `claude-haiku-4-5-20251001`, despite the stale header mentioning gpt-4o-mini. It samples the first 1,500 characters, requests at most 8 output tokens, regex-validates A1–C2, and falls back to a missing LLM signal when credentials/calls fail. Pricing constants in that file are implementation assumptions, not a live price quote. No explicit prompt version or resumable provider job is recorded there. Full `acp/reprocess` also replaces vocabulary and can invoke this analysis; it was not used to recompute already valid CEFR. This run made zero paid model calls.

ANALYZED means required metrics are valid. ELIGIBLE is canonical source permission. READY also needs item-level validation. ASSIGNED requires an actual assignment/manifest. USED requires usage evidence. Item-linked is neither proof of review nor learner use; historical render manifests are incomplete.

## Execution and re-audit

### Linked-source content batch — preflight

After policy exclusions, 14 unjudged sources already have one DCP item each (6 Gutenberg, 8 original). This is the entire immediately linked content-judgment subset, not a random sample of the unlinked backlog. All 14 full bodies were exported with UUID/revision/SHA256 and read by the current agent. Decisions: 2 expository use, 8 narrative, 4 reject (broken quotation/excerpt, commentary/reference fragments, sensitive violent crime, flattened epic verse). The safety judgment is about the actual passage; religious subject matter is not itself a rejection reason.

Dry-run manifest: `.agent-logs/csat-linked-review-20260919-out.json.plan-2026-09-19T02-28-38-472Z.json`. Source fields changed: `csat_fit.gate` only; bodies, status and 14 linked items preserved. Expected source permission: accepted passages may become conditional, subject to canonical policy and item-level checks; reject passages remain blocked. Provider calls/cost: zero. Small batch is the first two sources (one accept, one reject), followed by verification and the remaining 12; replay must change zero rows. Source integrity and policy checks precede any question use.

### Applied and verified

| Batch | Dry-run | Small batch → remaining | Replay | Observed effect |
|---|---:|---|---:|---|
| Existing-vocabulary V-Level | NULL → p75 V6 | 1 row, checked body/gate hashes | cache changed 0 | unknown → blocked by unchanged C1 CEFR; 5 items preserved |
| Full-body non-prose review | 2 gate changes | 1 → 1 | gate/cache changed 0 | two VOA index/schedule sources unknown → blocked; no items |
| Linked-source content review | 14 gate changes | 2 → 12 | gate/cache changed 0 | 10 unjudged → conditional excerpt; 4 unjudged → blocked; 14 items preserved |

Across these operations: 17 source rows and their 17 caches changed, no source body/status/question/answer deletion or rewrite. No migration, question generation, publication or deployment. In the newly confirmed violent-crime case, rejection uses the explicit `sensitive-violence` reason; the existing decision function already supports rejection reasons and no global genre rule was relaxed.

| Grade | Before | After |
|---|---:|---:|
| usable | 9,103 | 9,103 |
| conditional excerpt | 4,296 | 4,306 |
| excerpt preparation | 10,861 | 10,861 |
| unjudged | 48,811 | 48,797 |
| unknown | 3 | 0 |
| blocked | 14,642 | 14,649 |
| total | 87,716 | 87,716 |

The remaining two missing-analysis bodies are deliberately rejected non-prose; analysisStatus remains truthful and no fake V-Level was inserted. Actionable linked/unjudged/non-raw sources with no other policy exclusion: **14 → 0**. Rejected sources passing `csat_source_is_eligible`: **0**. Source/cache revision mismatches: **0** on post-batch SQL.

Full body scan rerun: 87,716 candidates, seven shared rules flag 4,712, elapsed 594.4 seconds; independent live SQL confirms 450 VOA comment-system bodies. Combined cached quality-review union stays 5,161. Body signal counts are unchanged because no body was edited. False positives remain documented; these counts are not automatic rejection targets. Duplicate content hashes remain 115 groups and were not deleted.

Each batch has before/after checkpoints and full cache backups under `.agent-logs`; disappeared metrics were rotating `bloat_sampled_pct` samples, not vanished data. Source rollback restores only the recorded gate key or V-Level/components/timestamp fields after comparing current revision/value, then regenerates affected policy caches; never restore an entire old article or overwrite a newer gate. Backups include old values, intended new values, run IDs and target IDs. SQL source repair and before/after body/gate digests are saved separately.

Validation: 16 batch/audit/HTTP integration tests and 63 existing Admin help/source-screen tests passed. Scoped export skipped both already reviewed non-prose records (exported 0, skipped 2). `pnpm docs:db-stats` executed after mutations. The eligibility snapshot scan encountered one statement timeout in its existing excerpt-backlog query, then succeeded on retry without data mutation. Full corpus re-audit and final evidence are recorded separately below.

### Remaining work and delivery boundary

The corpus is **not fully content-reviewed**. The remaining non-raw content candidates have no linked items; do not call them manual-review completed. Raw extraction (1,576) and accepted-content excerpt generation (3,907) are conditional supply work, not repair of existing learner use. Quality candidates (5,161) need source-specific confirmation and anchor validation. An eligibility audit passing does not make these batches unnecessary or complete. Four failed ingestion rows and one analyzing row were classified, not restarted without validating recovery and downstream demand.

No commit/push was performed: the working tree already contains extensive intertwined changes and untracked dependencies from prior work, and the existing MCP generated-file check fails. Committing only these paths would absorb earlier work or omit required dependencies. No force push, hook bypass, schema change or main merge occurred.

### Final acceptance evidence

Final full metadata/contract audit: **2026-09-19T02:32:10Z–02:32:50Z, exit 0**. All 109,043 rows and 87,716 candidate contracts were checked; findings empty, orphan references zero, snapshot inventory/candidate/all-grade deltas zero. The 38,605 reference-ID input was verified against a fresh SQL DISTINCT aggregate (matching MD5 `7a272033bde44ba74ed05ca2e2b7eef5`), not trusted because an old file existed. Full row IDs stay in `.agent-logs/csat-source-discovery-verified-20260919.json`; [compact reproducible result](./csat-source-discovery-summary-20260919.json) retains all counts/reasons without tens of thousands of IDs.

Remaining automated work discovery: cache refresh 0, actionable analysis repair 0, unlinked content judgment 9,501, raw extraction 1,576, excerpt materialization 3,907, quality review 5,161, policy exclusions 59,323. These sets overlap. The 9,501 judgments remain real work, not an asserted human-only queue or completed normalization.

Skill validation: Python launcher unavailable, so the validator's frontmatter/name/description/scaffold constraints were checked with Node; referenced files and operational commands were exercised. Repository agent check remains 8/9 due solely to the pre-existing missing GENERATED marker. No full application build or remote scheduled execution is claimed.
