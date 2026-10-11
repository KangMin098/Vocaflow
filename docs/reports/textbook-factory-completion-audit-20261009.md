# Textbook Factory Completion Audit — 2026-10-09

Baseline: `0ac948681` on `feat/textbook-factory-phase1`. This audit concerns executable pipeline capability, not availability of commercial content. `DONE` means the currently implemented contract has a corresponding code path and relevant synthetic verification; it does not mean real educational or production validation.

| Area | Contract | Code | Synthetic E2E | UI | Recovery | Status |
|---|---|---|---|---|---|---|
| Product Order | Sealed single-grade document and group contract | `factory-order.ts`, `multi-grade-order.ts`, structured brief-to-order draft | P03 M1, H1 and M1-M2 fixture paths | Structured brief, server-sealed order preview and restricted registration; no raw JSON required | Revision hash invalidates reuse | PARTIAL |
| Product planning / curriculum assembly | Brief and sealed order planning hash | Deterministic planner plus 20-day synthetic schedule/item ledger and volume composition; no DB multi-passage atomic volume | M1/H1/M1-M2 brief-bound order fixtures and 40-cell multi-grade schedule with item/answer/explanation records | Structured brief and family selector now hand off to the registered order draft | Brief, sealed order, item, day or grade changes block synthetic volume | PARTIAL |
| Source routing | Rights/quality/target routes | `routeFactorySource` | Factory-order tests | General sourcing screen | Changed rights invalidates | DONE |
| Adaptation | Target and content review bound to source | Academic-reading contract and review | P03 fixture | General authoring screen | Changed source/draft blocks | DONE |
| Benchmark | Two-stage seal, admission and decision | `frym-benchmark` | Fixture tests | No order-specific decision view | Stale receipt blocks | PARTIAL |
| Gold-S | Candidate/review/certification contract | Gold-S gate and signed evidence | Separate issuance fixture | No order-specific view | Expiry/revocation blocks | PARTIAL |
| Seed eligibility | Certificate-bound eligibility | Seed gate | Synthetic signed evidence | No order-specific view | Changed approval blocks | PARTIAL |
| Controlled promotion | `queued → ready`, one order revision | Admin RPC, RLS and DB trigger | Synthetic and DB smoke | Registration only | Replay/rollback | PARTIAL |
| Item | Promotion/order lineage | Item export/import and lineage verifier | P03 | General authoring | Stale item rejected | PARTIAL |
| Explanation | Item digest inheritance | Explanation lineage | P03 | General explanation screen | Stale explanation rejected | PARTIAL |
| Editorial review | Same evidence chain | Factory lineage | P03 | General review screen | Changed review rejected | PARTIAL |
| Unit assembly | Grade-bound unit hash | Multi-grade production | P03 | General press screen | Mixed unit rejected | PARTIAL |
| Volume assembly | Group and unit hash | Multi-grade production | P03 | General press screen | Mixed volume rejected | PARTIAL |
| Render | Atomic snapshot and output hash | Atomic renderer | P03 | Admin artifact download | Failed output cleanup | DONE |
| Publish simulation | One-time approval, guarded serve | Atomic publish/serve RPC | P03 | Admin artifact download | Replay rejected | DONE |
| Catalog/revision | Runtime impact inspection | `production-revision-impact.mjs`, `production-revision-workflow.mjs`, durable external revision journal and CLI, `planFactoryImpact` | Source/item changes propagate through publication; synthetic review/rebuild/republish resumes after interrupted writes and rejects mixed history | No order-specific graph | Persisted synthetic journal; actual catalog mutation remains separate | PARTIAL |
| Multi-grade | Group and grade child lineage | Multi-grade order/production | P03 group modes | No grade-group authoring | Changed child blocks group | PARTIAL |
| Recovery/runbook | Fail closed and revision-bound reissue | Promotion/atomic runner, append-only external revision journal | Master failure matrix, replay and terminated-process recovery tests | CLI status/recovery diagnosis; no admin run-centric view | [단계별 복구 절차](../textbook-factory-recovery.md); persisted synthetic republish, manual dead-lock quarantine | PARTIAL |
| Admin UI | Nine-stage general factory plus order trace | `/admin/csat/*`, read-only order trace API and structured draft API | UI model, order-trace tests and rollback DB smoke | Structured brief-to-order registration; current order/promotion/item/review blockers visible. Development DB order-bound render/publish observer applied and verified; unit/volume remain unmeasured | Stale and rights reasons shown; no run-centric recovery control | PARTIAL |
| Real commercial corpus and operational Gold-S | Separate operational gates | Fail-closed contracts | Not applicable | Not applicable | Not applicable | DEFERRED_REAL_DATA |

## P01–P20 production capability

The `PRODUCT_CAPABILITIES` enum is a target and item contract, not proof of a dedicated passage, item, activity, explanation and layout adapter. The audited status below is intentionally conservative. P03 has a synthetic run through the same promotion execution function as the CLI, using a mock promotion RPC that creates the `ready` row and audit, followed by atomic publication simulation. It does not prove a live DB promotion and render in one run. The other P01–P12/P15–P17/P19 families have a deterministic, family-checked generic synthetic ready-to-volume safety wrapper, but their family-specific teaching semantics and promotion-to-publication master run remain unproven. They stay `CONTRACT_ONLY`; the four resource/time layouts stay `IMPLEMENTED`.

`product-capability-status.ts` exposes this conservative runtime classification to the admin planning API. Its regression checks all 20 family IDs, contract-state parity and the existence of cited synthetic evidence files. It does not convert an item contract into a production adapter.

| Family | Product | Passage/adaptation | Item/activity | Explanation/layout | Benchmark/publication | Synthetic E2E | Status |
|---|---|---|---|---|---|---|---|
| P01 | Multi-Level Reader | Generic adaptation | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; level progression unproven | CONTRACT_ONLY |
| P02 | Narrative Reading | Generic adaptation | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; narrative design unproven | CONTRACT_ONLY |
| P03 | Knowledge Reader | Adapted fixture | Main-point fixture | Reading HTML/manifest | Brief-bound master test invokes shared CLI promotion function with mock RPC, atomic render and publish simulation | No live DB promotion and render in one run | SYNTHETIC_E2E_VALIDATED |
| P04 | Science/Social/History | Generic adaptation | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; domain design unproven | CONTRACT_ONLY |
| P05 | Vocabulary-in-Context | Generic reading passage | Token-bound focus span | Generic safety wrapper | Generic gates | Ready-to-volume fixture; vocabulary design unproven | CONTRACT_ONLY |
| P06 | Academic Sentence | Generic reading passage | Token-bound focus span | Generic safety wrapper | Generic gates | Ready-to-volume fixture; syntax design unproven | CONTRACT_ONLY |
| P07 | Main Idea | Generic reading passage | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; main-idea design unproven | CONTRACT_ONLY |
| P08 | Structure | Generic reading passage | Two nonoverlapping passage spans | Generic safety wrapper | Generic gates | Ready-to-volume fixture; structure design unproven | CONTRACT_ONLY |
| P09 | Relation | Generic reading passage | Two nonoverlapping passage spans | Generic safety wrapper | Generic gates | Ready-to-volume fixture; relation design unproven | CONTRACT_ONLY |
| P10 | Inference | Generic reading passage | Two nonoverlapping passage spans | Generic safety wrapper | Generic gates | Ready-to-volume fixture; inference design unproven | CONTRACT_ONLY |
| P11 | Evidence | Generic reading passage | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; evidence teaching unproven | CONTRACT_ONLY |
| P12 | Argument | Generic reading passage | Two nonoverlapping passage spans | Generic safety wrapper | Generic gates | Ready-to-volume fixture; argument design unproven | CONTRACT_ONLY |
| P13 | Comparative | Sealed target second-text resource | Cross-text quote validation | Escaped Text B unit | Ready→volume synthetic only | Item/resource/layout mutation rejected | IMPLEMENTED |
| P14 | Text + Data | Sealed target data resource | Passage/data quote validation | Escaped source-data unit | Ready→volume synthetic only | Changed data/layout rejected | IMPLEMENTED |
| P15 | Current Issues | Generic reading passage | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; currency unproven | CONTRACT_ONLY |
| P16 | Knowledge Builder | Generic adaptation | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; background scaffold unproven | CONTRACT_ONLY |
| P17 | Exam Bridge | Generic adaptation | Order-bound item quote | Generic safety wrapper | Generic gates | Ready-to-volume fixture; exam alignment unproven | CONTRACT_ONLY |
| P18 | KICE Academic Reading | Exam target and positive time budget | Item time-budget validation | Printed time-budget unit; no running timer | Ready→volume synthetic only | Missing/changed time budget rejected | IMPLEMENTED |
| P19 | Reading Intervention | Generic adaptation | Token-bound focus span | Generic safety wrapper | Generic gates | Ready-to-volume fixture; intervention scaffold unproven | CONTRACT_ONLY |
| P20 | Multi-text Argument | Sealed target second-text resource | Cross-text quote validation | Escaped Text B unit | Ready→volume synthetic only | Item/resource/layout mutation rejected | IMPLEMENTED |

Non-reading products (listening, dictation, cards, diagnostic workbook and mixed-domain books) have existing platform modules but no demonstrated adapter into the same Product Order → atomic production chain. They are `MISSING` for this factory goal, not covered by the P01–P20 enum.

The four specialized layouts consume sealed order resources and reviewed item payloads in synthetic dry-runs. They do not recheck external resource rights/revisions at the atomic DB boundary. JS group registration rejects them, and the development DB now has two active BEFORE triggers (approved SHA-256 `ea6693b72d7796869850179772be9d2b9ffff5dc8a6bf5a01f35bf073c690a86`) that reject specialized group/snapshot writes before commit. Rollback-only smoke left zero rows. P18 prints a per-item time budget and does not implement an interactive countdown.

The 15 other family units except P03 are rebuilt from the sealed family/item contract and reviewed item passage quotes. P05/P06/P19 require a token-bound focus span; P08/P09/P10/P12 require two unique nonoverlapping passage spans. Changed item evidence, unsupported type, grade or output HTML fails before volume assembly. This generic safety wrapper does not establish family-specific teaching behavior, semantic answer correctness or independent editorial quality. An order-bound production status RPC is applied to the development DB from approved SHA-256 `e66023c46e2d611c2da8adfbbcec5e61682616a4f07d121faf86d73fe5d77da1` (ledger version `20261009104020`). Rollback-only smoke passed registered/captured/rendered/published observations, stale registered order, detached publication approval, rights revocation fail-closed and anon denial; production group/snapshot/artifact and synthetic child counts remained zero. This verifies the observation contract but no real order has completed an operational production run.

The first fresh full run found one help-text density failure (2,619/2,600) with 4,049 other web tests passing. The text was shortened; the affected 40 tests and a fresh web run then passed (4,050 passed, 250 skipped, 0 failed). All 14 other forced lint/type/test tasks passed; web lint was rerun after the text correction. Agent config passed 11/11 and the read-only cross-review found no remaining P1/P2 after its stale-order and detached-approval findings were fixed.

`pnpm.cmd docs:db-stats` was attempted again after the order observation migration but could not run because this worktree lacks `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the protected DB statistics block was not edited. Direct DB pre/post counts and role checks confirmed the RPC was absent before, installed afterward, and synthetic production rows stayed at zero. The Security Advisor reported no finding referencing the new RPC. Earlier DB trigger/RLS checks and the before/after health checkpoint were completed through the development DB connector.

## Goal issue classification

- `BLOCKER`: Brief-to-order registration is connected, but no continuous registered-order-to-press flow exists for an operator; order trace cannot observe current unit/volume assembly evidence; most families remain contract-only and non-reading adapters are missing.
- `REQUIRED_FOR_COMPLETION`: Multi-passage atomic volume production beyond synthetic curriculum fulfillment; capability matrix tied to executable adapter evidence; catalog/revision recovery workflow.
- `NON_BLOCKING`: Cosmetic UI refinements and future performance work.
- `DEFERRED`: Real permission, commercial admission, Korean calibration cohort, real Gold-S, real seed and external publication.

Current verdict: `TEXTBOOK_FACTORY_PIPELINE_COMPLETE=false`, `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED=false`. The prior report's synthetic P03 backbone remains valid but was too narrow for this broader objective.

Planned student-volume assembly now has an executable CLI for sealed `brief/orders/units` inputs beyond the three fixed reference presets. It reuses the existing fulfillment engine and rederives HTML, receipt and manifest from current input before writing. Single H3, noncontiguous M1/H3 and the full E5–H3 eight-grade schedule are covered in synthetic assembly tests; a 40-cell M1/M2 CLI execution verifies actual files, stale-input rejection before writes and no overwrite. Teacher editions are explicitly excluded by the user. This closes CLI accessibility for planned assembly, but DB atomic multi-passage production, semantic product adapters and registered-order orchestration remain incomplete.

This unit passed the fresh library suite (3,049/3,049), final focused fulfillment/CLI suite (7/7), package typecheck and agent config (11/11). Claude Code's read-only review identified disk read-back and completion-marker atomicity defects; both were fixed and its final review found no remaining P1/P2. Written artifacts are reloaded and rederived before the complete marker is linked into place. The web suite was not rerun for this library/script-only unit; its latest fresh result remains 4,055 passed / 250 skipped. No DB write or actual publication occurred.

The shared P03 reference runner is now executable outside the test harness through `synthetic-master-run.mjs` and the admin-only `/admin/csat/new` synthetic production panel. Three fixed orders (M1, H1 and M1–M2) use the same shared production functions and in-memory promotion/atomic/publication RPCs. The API accepts only these presets, never caller paths or evidence. HTML and manifest downloads are marked synthetic/non-production, with benchmark snapshot, Gold-S decision and seed approval explicitly listed as injected evidence. This closes reference-run accessibility; it does not close arbitrary registered-order production, family-specific adapters or actual benchmark/certification execution.

Reference execution verification: shared runner/preflight 14/14, agent config 11/11 and final cross-review pass. Actual Next.js/Playwright PC runs completed all three presets, verified downloaded HTML hashes against manifests, cleared prior output after selection changes and rejected injected caller evidence (400). Runtime QA found and fixed bundler-incompatible filesystem URL loading by using a static JSON import. The fresh forced full run passed 14 other tasks but found touch-target scanner and help-density failures; both were corrected without lowering limits. The final fresh web result is 4,055 passed / 250 skipped / 0 failed, with web typecheck and lint rerun successfully. PowerShell logged a NativeCommandError for Vite's stderr deprecation warning during redirected execution; the Vitest report contains no failed tests or unhandled errors. No DB write occurred in this unit.

The master suite covers 14 source/rights/order/grade/adaptation/benchmark/Gold-S/seed/item/explanation/editorial/unit/volume mutations, render mutation, promotion/snapshot/publication replay and catalog stale propagation. A benchmark-version-only mutation originally escaped the multi-grade renderer; the production check and fixture now compare it with the item lineage. Synthetic recovery demonstrates the required new group revision, unapproved finalize, independent output approval and approved capture/finalize sequence. Replay in this matrix uses a stateful mock; deployed DB concurrency and one-time consumption have separate DB smoke evidence.

Revision recovery now has a file-backed synthetic execution path: immutable two-manifest baseline, independently recalculated impact, chained durable revisions, idempotent completed-event retries, atomic writer-lock registration and read-only recovery diagnosis. A child process terminated before/after lock registration and during initial start leaves no false completed revision; stopped-writer quarantine is explicit and reversible. Atomic CLI dry-runs can start this journal after writing output. The final related master/revision/CLI suite passed 32/32, script syntax 273/273, module/document checks 10/10 and agent config 11/11. Cross-review passed after crash-lock and initial-start recovery findings were fixed. Web typecheck passed; the full web suite was not rerun for this script-only unit (latest full result remains 4,050 passed / 250 skipped).

The `reading-promotion/preflight.test.mjs` suite runs standalone M1 and H1 orders plus an M1–M2 grade group. Each is generated from a structured brief and executes the CLI's shared promotion function against a mock RPC that changes `queued` to `ready` and records the audit before atomic render/publish simulation. A single master verification test executes all three and checks distinct synthetic, non-production receipts. Source/item impact reaches a publication artifact when publication depends on render. The extracted harness now has a fixed-reference CLI and admin rehearsal API; both use mock RPCs rather than a live DB run. The 19 requested failure injections and synthetic approval-consumption recovery are covered; the order-specific UI observes DB production records, but cannot observe unit/volume assembly evidence. The verdict remains false.

## 2026-10-10 update — registered order to student volume

The branch was rebased onto current `main` by transplanting the textbook-only files from `d431fd82b` (the old branch had exceeded the two-week limit and carried unrelated design/map work). `order-production-run.ts` and its CLI now connect a registered structured order draft to the planned student volume: drain export per grade/day cell → agent fill → family adapter gate → planned volume → lineage manifest. Verified in tests (6/6): single E5 and H3, noncontiguous M1/H3, contiguous M1–M3, E6/H2 via CLI; all 16 single-passage families (P01–P12, P15–P17, P19) pass their adapter gate; P13/P14/P18/P20 are refused with an explicit reason; family-semantic failure (P09 secondary evidence, P05 focus), revision change, foreign/missing/tampered cells and mixed briefs block before output; interrupted output is replaced and completed runs cannot be overwritten. Library suite 3,057/3,057.

This closes the "registered order cannot reach a student volume" gap for single-passage families as a file-based run. Still open: the run is not connected to DB promotion/atomic snapshot/publication (only P03 has that path); adapters remain generic grounding gates, not family-specific teaching design (P01–P12/P15–P17/P19 stay `CONTRACT_ONLY`); specialized families lack planner-produced resources; non-reading products (vocabulary cards, listening, dictation, diagnostic) have no adapter; the admin screen does not yet show run-directory status. Verdict unchanged: `TEXTBOOK_FACTORY_PIPELINE_COMPLETE=false`, `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED=false`.

## 2026-10-11 update — admin run status and atomic multi-day volume

- Admin: `/admin/csat/new` order status now lists order-production runs (`GET /api/admin/csat/order-runs`): current stage, blockers, drain staleness and DB-registered revision mismatch. Route tests 3/3; web 4,628 passed / 247 skipped.
- Atomic volume: `atomic-volume.mjs` assembles a multi-day M1/H3 volume from per-day published atomic snapshots and re-serves every section on verification. Tests 4/4, including the real manifest from the P03 M1–M2 synthetic master and invalidation when one day's evidence is revoked. Order binding per section relies on the published run manifest (DB serve proves snapshot/HTML only); closing that needs a migration.
- Still open: producing per-day atomic snapshots from an order-production run requires per-day promotion/Gold-S/benchmark evidence, which only the P03 fixture path builds today; family-specific teaching adapters; specialized-family resources; non-reading adapters; revision-impact propagation for runs. Verdict unchanged (both flags false).

- Per-day atomic chain: the P03 M1/M2 synthetic master now runs per planned day with shared trust keys; all 3 planned days become 3 published atomic snapshots composed into one volume (test 5/5; existing master suites 14/14). Generic order-production runs (other families, arbitrary briefs) still do not feed this chain: per-day promotion evidence (Gold-S, benchmark, three-persona item reviews) is built only by the P03 fixture.

- Order run → atomic volume: `run-atomic-bridge.mjs` connects any planned-path order-production run (all 16 single-passage families; single, contiguous and noncontiguous multi-grade) to per-day synthetic promotion, atomic snapshot, publication simulation and a verified multi-day volume (tests 7/7, including revoked-day invalidation, trust-policy mismatch and post-gate item tampering). Capability table: the generic families keep `CONTRACT_ONLY` (teaching design is still generic); their missing list now names live DB promotion instead of synthetic promotion-to-publication.
- Specialized families: P13/P14/P18/P20 now run through the order-production run with sealed per-day resources (cycled when fewer than days) or an exam target and printed time budgets; all 20 families assemble a student volume with lineage (run tests 7/7, including wrong-day resource, invented resource quote, missing resource and missing time budget). They remain `IMPLEMENTED`, not E2E: atomic production refuses them by design (JS + DB triggers), and the admin form cannot yet enter resources.
- Run revision impact: `run-revision.mjs` turns a change in a registered run into day-level rebuild/reuse decisions and rebuilds only affected days as new atomic group revisions (tests 3/3: one-day explanation fix rebuilds day 2 only and invalidates the old volume; order revision rebuilds all days; unchanged runs rebuild nothing; changed order set/plan refused). Not yet persisted through the hash-chain revision journal.
- Journaled run revision: rebuilt days are persisted through the existing hash-chain revision journal, one journal per rebuilt day; an injected crash after review leaves the day in `revise` and the volume not ready, a rerun completes it without duplicate records, and an edited record blocks the volume (run-revision tests 4/4).

## 2026-10-11 re-judgment against the work order

Baseline `dcc3bb43f` + work order `docs/methodology/TEXTBOOK_FACTORY_CLAUDE_WORK_ORDER.md` (`306df711d`). Judged from code and tests on this branch, not from earlier sections. `DONE` = executable path with synthetic verification; never real-content or operational validation.

### Work-order areas

| # | Area | Evidence in code/tests | Status |
|---|---|---|---|
| 1 | Registered order → production run → days → unit → volume | `order-production-run.ts`/CLI re-seal the same structured drafts the admin draft route registers; `run-atomic-bridge.mjs` → per-day promotion, atomic snapshot, publication simulation; `atomic-volume.mjs` composes/verifies | PARTIAL — synthetic in-memory DB only; no live DB promotion of a run; admin cannot start a run (CLI only) |
| 2a | P01–P20 executable adapters | All 20 run through `order-production-run` with a family gate (generic grounding for 15, resource/time layouts for P13/P14/P18/P20) | PARTIAL — 15 families are generic grounding gates, not family-specific teaching design (`CONTRACT_ONLY`) |
| 2b | Specialized resources / exam targets | Structured draft accepts `exam`/`resources`; per-day resource cycling; P18 printed time budget | PARTIAL — admin registration form has no resource/exam input; atomic production refused by DB gate (migration needed) |
| 3 | Non-reading products (vocabulary, syntax, grammar, listening, dictation, cards, diagnostic) | Generators exist outside the factory: `grammar-choice.ts`, `vocab-choice.ts`, `word-order.ts`, `listen-choose.ts`, `vocab/typeset.ts`; none takes a Product Order or emits order lineage; no dictation or diagnostic workbook generator | MISSING (factory connection) |
| 4a | Grade scopes: single, contiguous, noncontiguous, E5–H3 | Run tests: E5, E6/H2, H1, H3, M1/H3, M1–M3, M2–M3; planned-volume E5–H3 eight grades | DONE (synthetic) |
| 4b | Delivery modes in the run → atomic path | Only `grade_specific_adaptations` (multi-grade) and `single_grade` exercised from runs; `shared_passage_grade_specific_items` and `grade_specific_units` only in fixed fixtures (`multi-grade-order.test.ts`, P03 master) | PARTIAL |
| 4c | Many days/passages in one volume | Planned volume (file) and atomic multi-day volume (3 days, 16 families) | DONE (synthetic) |
| 5a | Admin observation | `/api/admin/csat/order-trace` (DB evidence) + `/api/admin/csat/order-runs` (run stage, blockers, stale, revision mismatch) | PARTIAL — revision journals and atomic-volume state not shown in admin |
| 5b | Recovery / revision | `run-revision.mjs` day-level impact, selective rebuild, hash-chain journal with resume; interrupted output never complete | DONE (synthetic) |
| 6 | Required failure injections on the run path | Done: order/grade mix, item/explanation change, order revision, resource change, revoked day, output tamper, interrupted retry, trust-policy mismatch. Fixed P03 master only: source/adaptation change, benchmark version, expired authority, promotion/snapshot replay | PARTIAL — benchmark/policy revision, expiry and snapshot replay not injected on the run path |
| 7 | Capability display matches evidence | `product-capability-status.ts` cites run/bridge tests; P03 `SYNTHETIC_E2E_VALIDATED`, specialized `IMPLEMENTED`, others `CONTRACT_ONLY` | DONE |
| — | Real rights, corpus, Korean grade benchmark, Gold-S issuance, DB seed, external publication, teacher edition | Out of scope per work order | DEFERRED_REAL_DATA / EXCLUDED |

### Order of remaining blockers

1. Area 3 — connect existing non-reading generators to the same order/run lineage (largest MISSING).
2. Areas 4b and 6 — run the two remaining delivery modes and the missing failure injections from a run.
3. Area 2b — admin input for resources/exam targets.
4. Areas 2a, 5a, 1 (live DB) — family-specific teaching adapters, admin journal view, and DB-side work that needs reviewed migrations.

Verdict: `TEXTBOOK_FACTORY_PIPELINE_COMPLETE=false`, `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED=false`.
- Area 3 update: non-reading products now ride the same order lineage as sealed `activity_types` — grammar, word order (syntax), vocabulary, listening, dictation, word cards and a diagnostic check, all generated from the run's passages by existing generators (companion tests 4/4, including CLI block-then-complete, missing resources, empty activity, unattributed audio, stale output). Status MISSING → PARTIAL: file-level only (not in atomic snapshots), the admin form has no field, dictation/cards are single-word scope and the diagnostic reuses run items rather than a calibrated test.
- Areas 4b and 6 update: all four delivery modes now run from an order-production run (single, shared passage + grade-specific items, grade-specific adaptations, grade-specific units) and the missing run-path injections pass — benchmark/evidence/rights policy revision (stale cell hash), expired trust root (Gold-S rejection), replayed snapshot across days (bridge tests 10/10). 4b → DONE (synthetic); 6 → DONE (synthetic) for the listed injections.
- Area 2b/3 admin input: the planning form exposes companion activities and the registration form exposes the exam target and sealed resources (JSON array); the draft route test seals P13 resources, rejects P13 without them and P18 without an exam, and seals companion activities (3/3). 2b → DONE for registration input (atomic production of specialized families still needs a migration).
- Cross-review of `f27f8806a..dfdfaf6d4` (independent Claude reviewer, read-only): 1 P1 and 3 P2 found and fixed with regressions — order/brief companion mismatch now stale; companion resources hashed into lineage; auto delivery mode no longer infers shared passage; empty unit / one-skill diagnostic block. No open P1/P2 from this review.

### 2026-10-11 — family semantic adapters (area 2a)

`family-semantic-review.ts` adds an executable family-specific gate for all 20 families: per-family criteria derived from the product definitions, reviewed through an agent drain with exact passage quotes, required before a run completes (unit tests 2/2, CLI tests updated, planning guard 1/1).

Live drain (Claude as drain agent and reviewer; synthetic order, real prose; files kept outside the repository): P09 Relation Reading, middle_2, 3 days (order / insert / long_reference).
- Two earlier attempts stopped honestly before review: a diagnostic companion on single-skill P09 (`COMPANION_DIAGNOSTIC_TOO_NARROW` → planning guard added) and a grammar companion with no generator candidate in short passages (`COMPANION_ACTIVITY_EMPTY`).
- Review v1 failed day 3: the item asked only for the referent of "them", not a relation between sentences (`FAMILY_REVIEW_FAILED:relation_item`); the run stayed blocked with no `complete.json`.
- Day 3 was rewritten to ask what "This system" summarizes before the "but" contrast; re-import kept days 1–2 hashes, and the old review was rejected for day 3 (`FAMILY_REVIEW_UNIT_STALE`).
- Review v2 passed all units; `complete.json` recorded drain `c2e514e5…`, receipt `2a68ea3a…`, manifest `1b00dba5…`, family review receipt `1587ec8e…`; re-import is refused.

Capability: the 15 generic families move `CONTRACT_ONLY` → `IMPLEMENTED` (structural adapter + executable family review). Missing per family remains a real-content review run and live DB promotion; the specialized four still lack atomic production. Only P09 has had a live family review. Verdict unchanged: both flags false.

- DB volume proof (user-approved migration, applied to dev 2026-10-11): `reading_production_volume` + register/serve RPCs prove inside the DB that each day is published current and belongs to exactly the volume's orders. Rollback smoke and privilege/advisor checks passed; client tests 6/6. Live success path unmeasured because the DB has 0 promoted production groups — this remains tied to the separate "live DB promotion of a run" item.

### 2026-10-11 — live DB measurement of the volume success path (rollback-only)

User-approved script `scripts/textbook/atomic-volume-db-measure.sql` (template SHA-256 `9956ad363a1f2d20afa635d04c837004e8557ea66a3b6f0584961110767aa3f6`; `atomic-volume-db-measure.mjs` injects fresh ed25519 keys, the only difference from the template) ran once on vocaflow-dev in one transaction ending in `ROLLBACK`. Through the real RPCs it promoted two days of one registered order, registered two production groups, captured/finalized/approved/re-captured/finalized and published both snapshots, then registered and served the volume:

| Step | Result |
|---|---|
| day 1 / day 2 published | published_current (2 snapshots) |
| volume registered | 2 DB-derived sections, volume hash `b1bccb28…` |
| same revision replay | refused — "volume revision replay or downgrade" |
| wrong order hash | refused — "volume order missing or stale" |
| volume served | both days present, output hash `dac4f1dc…` equals SHA-256 of the served HTML |
| day 2 certificate revoked | volume refused — "production evidence stale or rights blocked" |

Before/after counts were identical (library_articles 91,793; csat_dcp_items 834,311; csat_item_reviews 549; orders, authority, audits, permits, groups, snapshots, artifacts, volumes all 0). Limitation: dev has one active admin, so the required second approver was simulated by changing the group's `registered_by` inside the transaction, exactly as the earlier atomic smoke did; a real two-admin approval is unmeasured. Synthetic order and trust root only; not production evidence.

- Cross-review of `9696b8a24..e85a70d4e` (independent Claude reviewer, read-only): no P1; 4 P2 + 1 low.
  - `review` now re-hashes `student.html`, re-verifies the companion practice and requires the same companion resources file (hash) before completing.
  - The capability table over-claimed: the 14 generic families with only the generic review module go back to `CONTRACT_ONLY`; P09, which has a live family review, stays `IMPLEMENTED`; P03 no longer lists the review module as evidence.
  - The measurement's revocation check now accepts only `check_violation` (template SHA-256 is now `e67a688dcd3c10ee3d48c907ec8a7a215479c0bdbd038feeddfca3a97847d625`). The executed run's message was the intended "production evidence stale or rights blocked", so its result stands.
  - Known, not fixed: `_reading_production_volume_check` accepts extra keys and textual `order_revision` in the caller's order objects, so equivalent registrations can hash differently. There is no security impact and the JS client always sends canonical objects; changing it needs a new migration.

- More live family reviews (Claude as drain agent and reviewer, real prose, synthetic orders, files outside the repo): P05 Vocabulary-in-Context (middle_3, vocab_choice "mitigate" / long_vocab "ration"), P07 Main Idea (high_1, topic / title), P12 Argument (high_2, claim / implication). P05 and P07 passed first time (complete; manifests `f3695441…`, `77864b9e…`). P12 day 1 failed `evidence_supports` because the keyed choice said "gradual" while the passage proposes only a targeted limit; after rewording, re-import kept day 2's hash, the old review was rejected as stale for day 1, and review v2 completed (manifest `ce9272b5…`). Capability: P05, P07, P09, P12 are `IMPLEMENTED`; the other 11 generic families stay `CONTRACT_ONLY` until reviewed on real content.

### 2026-10-11 — live family review for the remaining 11 generic families

Writers and reviewer were separated: four parallel writer subagents filled the drains (P01 E6, P02 M1, P04 M2, P06 H1, P08 H1, P10 H2, P11 M3, P15 H2, P16 M2, P17 H3, P19 E5; two days each), Claude reviewed every unit against the family criteria with exact passage quotes. Files stay outside the repository.

Review v1: 14 of 22 units passed; P04, P10, P11, P15, P17, P19 completed. Eight units failed, five because of pipeline defects rather than writing:
- P02 day 1 had no narrative — the planner scheduled an expository genre for the narrative family. Fix: `FAMILY_GENRE_MISMATCH` (P02 accepts only narrative genres).
- P06 day 2 and both P08 units printed the answer: the sentence to correct, the (A)(B)(C) sentences and the sentence to insert were already in the passage. Fix: `ITEM_ANSWER_VISIBLE_IN_PASSAGE` blocks order/insert/grammar_fix/word_order items that quote a 6+ word passage sentence.
- P01 could not be judged: its purpose (re-level a source without changing claims) needs the source, which runs did not carry. Fix: optional cell `source_text`, required for P01 (`P01_SOURCE_TEXT_REQUIRED`) and included in the review export.
- P16 day 1 stated an outside figure without a source (content fix).
- Also observed: nearly every keyed answer was choice 1. Fix: `ORDER_RUN_ANSWER_POSITION_BIAS` when one choice number exceeds 60% of a grade's keys across 5+ units.

After the guards and a rewrite drain, review v2 passed all remaining units; P01, P02 (narrative-only re-plan), P06, P08 and P16 completed. Recorded caveat: P06 day 2 is labelled grammar_fix but asks for the main verb of a long-subject sentence (structure tested; label loose).

Capability: all 15 generic families now have a structural adapter plus a live family review → `IMPLEMENTED`. Still missing per family: live DB promotion of a run and real-content operational use. P13/P14/P18/P20 stay `IMPLEMENTED` with atomic production blocked by the DB gate. Verdict unchanged: both flags false.

### 2026-10-11 — reviewed order-production run through the live DB RPCs (rollback-only, approved)

`scripts/textbook/run-db-measure.mjs <run-input.json> <run-dir>` re-seals a completed, family-reviewed run under a fresh synthetic trust root (the existing family review must still pass), then emits one rollback-only SQL script that pushes the run's own order document, passages, items, choices, explanations, evidence and unit HTML through the real promotion → group → capture → approval → finalize → publish → volume register/serve RPCs.

Executed once on vocaflow-dev for the reviewed P09 run (middle_2, 3 days; generated SQL `6595c976…33ed`, approved). The final served-volume assertion was shortened to key substrings at execution time; the generator now emits that same form. Results:

| Step | Result |
|---|---|
| DB `_reading_json_hash` of the trust policy = JS hash | equal (`3ea355e0…`) |
| DB hash of the sealed run order document = JS run order hash | equal (`54aff83f…`) — cross-language order lineage |
| days 1–3: run passage promoted, run items (order / insert / long_reference) stored with 3 reviews, group, snapshot, approval, publication of the run's unit HTML | all published_current |
| volume registered / served | 3 DB-derived sections; served HTML contains every unit's passage and question |

Before/after counts identical (articles 91,793; items 834,311; reviews 549; orders, authority, audits, permits, groups, snapshots, artifacts, volumes 0). Limits as before: one active admin (second approver simulated); synthetic source article and trust root; single-grade runs only in this generator. The DB item table accepts every generic item type used by the 15 generic families (checked against its CHECK constraint).

- Cross-review of `a43724a6f..df158c75b` (independent Claude reviewer, read-only): 1 P1 + 5 P2, all fixed.
  - P1: the P01 source was outside the review hash, so a swapped source kept a stale claim-preservation review valid. The family review unit hash now binds the source; the old P01 review was rejected as stale and P01 was re-reviewed against the source-bound hash (complete).
  - Visible-answer guard now normalises case, curly quotes, ellipses, spacing and trailing punctuation, splits sentences before closing quotes/brackets, and checks the choices as well as the question.
  - Answer-position bias counts every item of a unit, not only the first.
  - Admin planning: choosing P02 now sends narrative-only genres and says so, instead of returning a generic error.
  - `run-db-measure.mjs`: the served-volume check regex had lost its `\s` (heredoc backslash trap); fixed with the editor. Re-sealing now refuses a reviewed fill if the re-exported cell's plan differs (`RUN_CELL_PLAN_CHANGED`).

### 2026-10-11 — multi-grade reviewed run through the live DB RPCs (rollback-only, approved)

`run-db-measure.mjs` now emits one production group per day containing every grade of the run (grade-specific adaptations, sections in the brief's grade order, each grade with its own adapted passage, items and order). A new multi-grade P07 run (middle_1 + high_2, noncontiguous, 2 days; written by a drain subagent, family-reviewed by Claude — both grades share each day's topic at different levels, every item has a supporting-detail distractor) completed and was pushed through the DB exactly as generated (SQL `a3e2d0e4…c2ea`, approved, executed verbatim):

| Step | Result |
|---|---|
| DB trust hash = JS | equal |
| DB order hash = JS run order hash, middle_1 and high_2 | both equal |
| day 1 / day 2: two grades promoted, items with 3 reviews, one group per day, snapshot, approval, publication | published_current (2 grades, 2 items each day) |
| volume over both orders registered / served | 2 sections; served HTML contains all four units' passages and questions |

Before/after counts identical. Same limits as before (simulated second approver; synthetic source and trust root). Area 4 (grade scopes in the live DB) is now measured for single and noncontiguous multi-grade runs.

### 2026-10-11 — specialized families in atomic production (approved migration)

Migration `20261011072230` (approved, applied to dev) replaces the blanket DB refusal of P13/P14/P18/P20 with revalidation of sealed resources/exam targets on group registration and of resource quotes / printed time budgets on snapshot capture (rollback smoke 15/15). The JS registration/capture refusal was replaced by the same checks (`checkSpecializedOrder`, `checkSpecializedItems`), and the run bridge now carries resource and time-budget fields and renders the specialized layout. P13 and P18 runs reach a verified atomic volume; a resource quote altered after the run gate is rejected (bridge tests 11/11). Capability: the specialized four stay `IMPLEMENTED`; their missing list now names a live family review on real content and live DB promotion instead of the DB gate. Note: the strengthened visible-answer guard also caught bridge fixtures that printed the evidence sentence as an answer choice; the fixtures now paraphrase.

### 2026-10-11 — specialized families: live family review and DB measurement

P13 (high_1), P14 (middle_3), P18 (high_3) and P20 (high_2) each ran a 2-day order-production run with sealed resources (P18: exam `csat`, printed time budgets 90/100 s) and a live family semantic review of all 8 units. P18 first failed the review: its questions asked for the main point and an inference while the plan sealed `topic` and `title`; the questions were rewritten to the planned types, re-imported, and passed. All four runs reached `complete`.

Migration `20261011075550_csat_dcp_items_specialized_types` (approved, applied to dev) lets `csat_dcp_items` store the P13/P14/P20 item types. The `run-db-measure.mjs` generator now passes `resource_url`/`evidence_resource`/`time_limit_seconds` into item payloads so the DB guard of `20261011072230` re-checks them. Executed verbatim, rollback-only: P13, P14, P18 and P20 each 6/6 (DB trust hash = JS, DB order hash = JS, day 1 and day 2 published through the real RPCs, volume registered, served volume holds every reviewed passage and question). Counts after: articles 91,793, csat_dcp_items 834,311, csat_item_reviews 549, production groups 0, order revisions 0 — unchanged. Capability: the specialized four join the live-family-review list; they stay `IMPLEMENTED` because the second approver is still simulated (live DB promotion and real-content operation remain missing).

### 2026-10-11 — second approval by the other agent

The user confirmed there is one human administrator; a second approver is an agent with a reviewer role. Migration `20261011094405_reading_production_agent_reviewer` (approved, applied to dev) adds agent reviewer keys, a producer declaration and `approve_reading_production_output_by_agent`. `run-db-measure.mjs` no longer rewrites `registered_by`: the human admin registers a Codex and a Claude reviewer key, the run is declared as produced by Claude, and each day is approved with a receipt signed by the Codex key. P13 rollback-only measurement 11/11: three refusals (the producing agent's own key, a receipt for another output hash, a failed criterion), two agent approvals, two publications, volume registered and served; counts unchanged (articles 91,793, csat_dcp_items 834,311, csat_item_reviews 549, groups 0, reviewers 0, receipts 0). Limits: both agent keys live on the same machine, and the measurement receipt is generated from the family review, not from a Codex review of the rendered output; a Codex review drain that signs its own receipt is the next step, so `live DB promotion` stays in the missing list.

### 2026-10-11 — operator path from a completed run to an atomic volume, and admin observation (areas 1 and 5a)

Until now `produceRunAtomicVolume` and `reviseRunAtomicVolumeJournaled` were called only from tests. `scripts/textbook/run-atomic.mjs` makes them an operator path:
- `produce --input --run-dir` re-seals a completed, family-reviewed run under one synthetic trust root (`run-reseal.mjs`, shared with `run-db-measure.mjs`), produces every day as an atomic snapshot and writes `atomic/{volume.html, volume.json, status.json}`; it refuses an incomplete run and an existing `atomic/`.
- `revise --prior-input --prior-run-dir --input --run-dir` rebuilds only the changed days and journals each one under `atomic/journal/day-N-rR`.
- `status --run-dir` re-verifies the volume seal, HTML hash, run completion hash and every journal chain.

Executed on the reviewed P13 run (`volume_ready`, 2 days, single_grade). CLI test (1/1, real CLIs end to end): two completed P05 multi-grade runs → produce (3 days × 2 grades) → refused re-produce → revise with only day 2's explanation changed (rebuild [2], reuse [1, 3], `day-2-r2` complete) → deleting the last journal record → `revision_incomplete` → editing the volume HTML → `broken` → an incomplete run refused with `RUN_NOT_COMPLETE`.

Admin: `/api/admin/csat/order-runs` now returns `atomic` per run, and the order panel shows its state, day count, revision, delivery modes and journal states. The server re-fingerprints the volume HTML and the latest record of every journal; any change since the last `status` reads `status_stale`, a missing status file `status_missing` (API tests 4/4). Help: the field and a rerun caution were added.

Reclassification: area 1 → DONE for the synthetic operator path (still no live DB promotion of a run with a real second reviewer's own review); area 5a → DONE (run, blockers, stale, atomic volume, revision journals visible in admin and CLI; no admin buttons that start or retry production, which stays in the CLI by design). Verdict unchanged: both flags false.

### 2026-10-11 — operator path from a completed run to an atomic volume, and admin observation (areas 1 and 5a)

Until now `produceRunAtomicVolume` and `reviseRunAtomicVolumeJournaled` were called only from tests. `scripts/textbook/run-atomic.mjs` makes them an operator path:
- `produce --input --run-dir` re-seals a completed, family-reviewed run under one synthetic trust root (`run-reseal.mjs`, shared with `run-db-measure.mjs`), produces every day as an atomic snapshot and writes `atomic/{volume.html, volume.json, status.json}`; it refuses an incomplete run and an existing `atomic/`.
- `revise --prior-input --prior-run-dir --input --run-dir` rebuilds only the changed days and journals each one under `atomic/journal/day-N-rR`.
- `status --run-dir` re-verifies the volume seal, HTML hash, run completion hash and every journal chain.

Executed on the reviewed P13 run (`volume_ready`, 2 days, single_grade). CLI test (1/1, real CLIs end to end): two completed P05 multi-grade runs → produce (3 days × 2 grades) → refused re-produce → revise with only day 2's explanation changed (rebuild [2], reuse [1, 3], `day-2-r2` complete) → deleting the last journal record → `revision_incomplete` → editing the volume HTML → `broken` → an incomplete run refused with `RUN_NOT_COMPLETE`.

Admin: `/api/admin/csat/order-runs` now returns `atomic` per run, and the order panel shows its state, day count, revision, delivery modes and journal states. The server re-fingerprints the volume HTML and the latest record of every journal; any change since the last `status` reads `status_stale`, a missing status file `status_missing` (API tests 4/4). Help: the field and a rerun caution were added.

Reclassification: area 1 → DONE for the synthetic operator path (still no live DB promotion of a run with a real second reviewer's own review); area 5a → DONE (run, blockers, stale, atomic volume, revision journals visible in admin and CLI; no admin buttons that start or retry production, which stays in the CLI by design). Verdict unchanged: both flags false.
