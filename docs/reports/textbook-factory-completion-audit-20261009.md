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
| Catalog/revision | Runtime impact inspection | `production-revision-impact.mjs`, `production-revision-workflow.mjs`, `planFactoryImpact` | Source/item changes propagate through publication; synthetic review/rebuild/republish state machine exercises failed rebuild and rights withdrawal | No order-specific graph | Synthetic journal only; no persisted catalog revise/republish workflow | PARTIAL |
| Multi-grade | Group and grade child lineage | Multi-grade order/production | P03 group modes | No grade-group authoring | Changed child blocks group | PARTIAL |
| Recovery/runbook | Fail closed and revision-bound reissue | Promotion/atomic runner | Master failure matrix and replay tests | No run-centric recovery view | [단계별 복구 절차](../textbook-factory-recovery.md); persisted republish remains unavailable | PARTIAL |
| Admin UI | Nine-stage general factory plus order trace | `/admin/csat/*`, read-only order trace API and structured draft API | UI model and order-trace tests | Structured brief-to-order registration; current order/promotion/item/review blockers visible; downstream unit/volume/render/publish remain unmeasured | Stale and rights reasons shown; no run-centric recovery control | PARTIAL |
| Real commercial corpus and operational Gold-S | Separate operational gates | Fail-closed contracts | Not applicable | Not applicable | Not applicable | DEFERRED_REAL_DATA |

## P01–P20 production capability

The `PRODUCT_CAPABILITIES` enum is a target and item contract, not proof of a dedicated passage, item, activity, explanation and layout adapter. The audited status below is intentionally conservative. P03 has a synthetic run through the same promotion execution function as the CLI, using a mock promotion RPC that creates the `ready` row and audit, followed by atomic publication simulation. It does not prove a live DB promotion and render in one run. `CONTRACT_ONLY` means the Product Order can name the family but a complete family-specific production path has not been demonstrated.

`product-capability-status.ts` exposes this conservative runtime classification to the admin planning API. Its regression checks all 20 family IDs, contract-state parity and the existence of cited synthetic evidence files. It does not convert an item contract into a production adapter.

| Family | Product | Passage/adaptation | Item/activity | Explanation/layout | Benchmark/publication | Synthetic E2E | Status |
|---|---|---|---|---|---|---|---|
| P01 | Multi-Level Reader | Generic adaptation | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P02 | Narrative Reading | Generic adaptation | Basic/relation contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P03 | Knowledge Reader | Adapted fixture | Main-point fixture | Reading HTML/manifest | Brief-bound master test invokes shared CLI promotion function with mock RPC, atomic render and publish simulation | No live DB promotion and render in one run | SYNTHETIC_E2E_VALIDATED |
| P04 | Science/Social/History | Generic adaptation | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P05 | Vocabulary-in-Context | Generic reading passage | Vocabulary item contract | Dedicated full flow unverified | Generic gates | Not family-tested | CONTRACT_ONLY |
| P06 | Academic Sentence | Generic reading passage | Grammar item contract | Dedicated full flow unverified | Generic gates | Not family-tested | CONTRACT_ONLY |
| P07 | Main Idea | Generic reading passage | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P08 | Structure | Generic reading passage | Relation item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P09 | Relation | Generic reading passage | Relation item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P10 | Inference | Generic reading passage | Inference item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P11 | Evidence | Generic reading passage | Evidence item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P12 | Argument | Generic reading passage | Claim/implication contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P13 | Comparative | Sealed target second-text resource | Cross-text quote validation | Escaped Text B unit | Ready→volume synthetic only | Item/resource/layout mutation rejected | IMPLEMENTED |
| P14 | Text + Data | Sealed target data resource | Passage/data quote validation | Escaped source-data unit | Ready→volume synthetic only | Changed data/layout rejected | IMPLEMENTED |
| P15 | Current Issues | Generic reading passage | Basic/evidence contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P16 | Knowledge Builder | Generic adaptation | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P17 | Exam Bridge | Generic adaptation | Basic/inference contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P18 | KICE Academic Reading | Exam target and positive time budget | Item time-budget validation | Printed time-budget unit; no running timer | Ready→volume synthetic only | Missing/changed time budget rejected | IMPLEMENTED |
| P19 | Reading Intervention | Generic adaptation | Vocabulary/main-point contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P20 | Multi-text Argument | Sealed target second-text resource | Cross-text quote validation | Escaped Text B unit | Ready→volume synthetic only | Item/resource/layout mutation rejected | IMPLEMENTED |

Non-reading products (listening, dictation, cards, diagnostic workbook and mixed-domain books) have existing platform modules but no demonstrated adapter into the same Product Order → atomic production chain. They are `MISSING` for this factory goal, not covered by the P01–P20 enum.

The four specialized layouts consume sealed order resources and reviewed item payloads in synthetic dry-runs. They do not recheck external resource rights/revisions at the atomic DB boundary. JS group registration rejects them, and the development DB now has two active BEFORE triggers (approved SHA-256 `ea6693b72d7796869850179772be9d2b9ffff5dc8a6bf5a01f35bf073c690a86`) that reject specialized group/snapshot writes before commit. Rollback-only smoke left zero rows. P18 prints a per-item time budget and does not implement an interactive countdown.

`pnpm.cmd docs:db-stats` was attempted after the migration but could not run because this worktree lacks `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the protected DB statistics block was not edited. Direct DB trigger/RLS checks and the before/after health checkpoint were completed through the development DB connector.

## Goal issue classification

- `BLOCKER`: Brief-to-order registration is connected, but no continuous registered-order-to-press flow exists for an operator; order trace still cannot observe current unit/volume/render/publish evidence; most families remain contract-only and non-reading adapters are missing.
- `REQUIRED_FOR_COMPLETION`: Multi-passage atomic volume production beyond synthetic curriculum fulfillment; capability matrix tied to executable adapter evidence; catalog/revision recovery workflow.
- `NON_BLOCKING`: Cosmetic UI refinements and future performance work.
- `DEFERRED`: Real permission, commercial admission, Korean calibration cohort, real Gold-S, real seed and external publication.

Current verdict: `TEXTBOOK_FACTORY_PIPELINE_COMPLETE=false`, `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED=false`. The prior report's synthetic P03 backbone remains valid but was too narrow for this broader objective.

The master suite covers 14 source/rights/order/grade/adaptation/benchmark/Gold-S/seed/item/explanation/editorial/unit/volume mutations, render mutation, promotion/snapshot/publication replay and catalog stale propagation. A benchmark-version-only mutation originally escaped the multi-grade renderer; the production check and fixture now compare it with the item lineage. Synthetic recovery demonstrates the required new group revision, unapproved finalize, independent output approval and approved capture/finalize sequence. Replay in this matrix uses a stateful mock; deployed DB concurrency and one-time consumption have separate DB smoke evidence.

The `reading-promotion/preflight.test.mjs` suite runs standalone M1 and H1 orders plus an M1–M2 grade group. Each is generated from a structured brief and executes the CLI's shared promotion function against a mock RPC that changes `queued` to `ready` and records the audit before atomic render/publish simulation. A single master verification test executes all three and checks distinct synthetic, non-production receipts. Source/item impact reaches a publication artifact when publication depends on render. This is an executable test harness, not an operational CLI or live DB run. The 19 requested failure injections and synthetic approval-consumption recovery are covered; the order-specific UI still cannot observe downstream production artifacts. The verdict remains false.
