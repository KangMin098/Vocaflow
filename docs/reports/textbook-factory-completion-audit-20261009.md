# Textbook Factory Completion Audit — 2026-10-09

Baseline: `0ac948681` on `feat/textbook-factory-phase1`. This audit concerns executable pipeline capability, not availability of commercial content. `DONE` means the currently implemented contract has a corresponding code path and relevant synthetic verification; it does not mean real educational or production validation.

| Area | Contract | Code | Synthetic E2E | UI | Recovery | Status |
|---|---|---|---|---|---|---|
| Product Order | Sealed single-grade document and group contract | `factory-order.ts`, `multi-grade-order.ts` | P03 fixtures | JSON registration only | Revision hash invalidates reuse | PARTIAL |
| Product planning / curriculum assembly | Brief and optional order planning hash | Deterministic brief-to-family/skill/source/curve planner; no production unit fulfillment | Brief/order fixture only | Structured brief form, still separate from order registration | Brief changes alter planning hash | PARTIAL |
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
| Catalog/revision | Runtime impact inspection | `production-revision-impact.mjs` | Impact tests | No order-specific graph | No persisted revise/republish workflow | PARTIAL |
| Multi-grade | Group and grade child lineage | Multi-grade order/production | P03 group modes | No grade-group authoring | Changed child blocks group | PARTIAL |
| Recovery/runbook | Fail closed and manual reissue | Promotion/atomic runner | Partial failure tests | No run-centric recovery view | Rebuild/republish not unified | PARTIAL |
| Admin UI | Nine-stage general factory | `/admin/csat/*` | UI model tests | JSON registration; no complete order-centric control | Blockers are mostly general | PARTIAL |
| Real commercial corpus and operational Gold-S | Separate operational gates | Fail-closed contracts | Not applicable | Not applicable | Not applicable | DEFERRED_REAL_DATA |

## P01–P20 production capability

The `PRODUCT_CAPABILITIES` enum is a target and item contract, not proof of a dedicated passage, item, activity, explanation and layout adapter. The audited status below is intentionally conservative. Only P03 appears in the signed promotion through atomic publication synthetic fixture. `CONTRACT_ONLY` means the Product Order can name the family but a complete family-specific production path has not been demonstrated.

| Family | Product | Passage/adaptation | Item/activity | Explanation/layout | Benchmark/publication | Synthetic E2E | Status |
|---|---|---|---|---|---|---|---|
| P01 | Multi-Level Reader | Generic adaptation | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P02 | Narrative Reading | Generic adaptation | Basic/relation contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P03 | Knowledge Reader | Adapted fixture | Main-point fixture | Reading HTML/manifest | Signed synthetic gate | Verified | SYNTHETIC_E2E_VALIDATED |
| P04 | Science/Social/History | Generic adaptation | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P05 | Vocabulary-in-Context | Generic reading passage | Vocabulary item contract | Dedicated full flow unverified | Generic gates | Not family-tested | CONTRACT_ONLY |
| P06 | Academic Sentence | Generic reading passage | Grammar item contract | Dedicated full flow unverified | Generic gates | Not family-tested | CONTRACT_ONLY |
| P07 | Main Idea | Generic reading passage | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P08 | Structure | Generic reading passage | Relation item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P09 | Relation | Generic reading passage | Relation item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P10 | Inference | Generic reading passage | Inference item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P11 | Evidence | Generic reading passage | Evidence item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P12 | Argument | Generic reading passage | Claim/implication contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P13 | Comparative | Multi-passage required | Missing adapter | Missing layout | No E2E | None | NOT_SUPPORTED |
| P14 | Text + Data | Table/chart required | Missing adapter | Missing layout | No E2E | None | NOT_SUPPORTED |
| P15 | Current Issues | Generic reading passage | Basic/evidence contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P16 | Knowledge Builder | Generic adaptation | Basic item contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P17 | Exam Bridge | Generic adaptation | Basic/inference contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P18 | KICE Academic Reading | Timer required | Missing timed adapter | Missing timed layout | No E2E | None | NOT_SUPPORTED |
| P19 | Reading Intervention | Generic adaptation | Vocabulary/main-point contract | Generic reading layout | Generic gates | Not family-tested | CONTRACT_ONLY |
| P20 | Multi-text Argument | Multi-passage required | Missing adapter | Missing layout | No E2E | None | NOT_SUPPORTED |

Non-reading products (listening, dictation, cards, diagnostic workbook and mixed-domain books) have existing platform modules but no demonstrated adapter into the same Product Order → atomic production chain. They are `MISSING` for this factory goal, not covered by the P01–P20 enum.

## Goal issue classification

- `BLOCKER`: No continuous brief-to-order-to-press flow; no single three-order master E2E with all requested failure injections; no order-centric UI control/status; family-specific production support is narrower than the product range.
- `REQUIRED_FOR_COMPLETION`: Unit/volume progression and balance contract; capability matrix tied to executable adapter evidence; catalog/revision recovery workflow.
- `NON_BLOCKING`: Cosmetic UI refinements and future performance work.
- `DEFERRED`: Real permission, commercial admission, Korean calibration cohort, real Gold-S, real seed and external publication.

Current verdict: `TEXTBOOK_FACTORY_PIPELINE_COMPLETE=false`, `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED=false`. The prior report's synthetic P03 backbone remains valid but was too narrow for this broader objective.
