# Textbook Factory 합성 실행·복구 절차

이 문서는 Product Order에서 합성 조판·게시 예행까지의 실패를 복구하는 절차다. 합성 fixture는 `synthetic_fixture=true`, `non_production=true`로만 사용하며 실제 Gold-S·seed·게시를 만들지 않는다.

| 실패 시점 | 확인할 현재 증거 | 복구 방법 | 기존 결과 취급 |
|---|---|---|---|
| 기획·주문 | brief hash, order revision/hash, capability | brief를 다시 계산하고 새 revision으로 주문을 봉인한다 | 이전 주문 revision의 하위 산출물은 stale |
| source·각색 | 원문/권리/각색 해시, source route | 변경된 원천·타겟으로 후보를 다시 생성·검수한다 | 이전 검수·후보를 덮어쓰지 않는다 |
| benchmark·Gold-S·seed | 각각의 snapshot/certificate/eligibility hash와 만료·철회 | 최신 증거로 다시 평가하고 새 승인 증거를 발급한다 | 기존 서명·승인을 재사용하지 않는다 |
| queued→ready | 현재 주문/원천/권리/승격 요청·감사 | 승인된 동일 요청의 재시도 결과가 이미 ready인지 확인한다. 변경이 있으면 새 요청을 만든다 | 혼합·만료 요청은 RPC가 거부하며 수동 UPDATE하지 않는다 |
| item·explanation·editorial | 현재 ready 지문, 완전한 factory lineage, 문항 digest | 변경된 단계부터 재생성하고 해설과 검수를 다시 받는다 | 옛 문항·해설·검수는 후속 조립에서 제외한다 |
| unit·volume | 주문/학년별 unit hash, 균형·진도 계획 | 영향받은 단원부터 다시 조립한 뒤 권 전체를 다시 검증한다 | 다른 학년·revision의 단원을 섞지 않는다 |
| atomic capture·render | snapshot ID/hash, 만료, approved output hash | capture 전 실패는 현재 입력을 재검증한다. 승인된 capture 뒤 finalize가 실패하면 같은 승인은 이미 소비됐다. 새 그룹 revision 등록 → 미승인 capture·조판·finalize → 그 출력에 대한 독립 관리자 승인 → 승인 소비용 새 capture·finalize 순서로 재발행한다 | 실패 HTML을 게시하지 않는다. 소비된 승인·snapshot을 재사용하지 않는다 |
| publish simulation | snapshot/output hash, 현재 권리·인증·ready | 게시 RPC가 실패하면 현재 증거를 재조회한다. 변경이 있으면 새 snapshot과 새 출력으로 재발행한다 | 이미 게시된 동일 snapshot을 재게시하지 않는다 |
| catalog/revision | 변경된 artifact ID와 source→publication 의존 그래프 | `planFactoryImpact`로 영향 범위를 계산해 stale 또는 invalidated로 제안한다. 새 revision을 만들고 재검증한다 | 제안만으로 실제 게시 상태를 바꾸거나 재발행하지 않는다 |

재실행 안전성: 읽기·계획·검증은 같은 입력에 재실행 가능하다. 제한 승격은 동일 승인·동일 요청의 idempotent 결과를 확인한 뒤에만 재시도한다. 출력 승인이 결속된 원자 snapshot capture는 그 승인을 소비한다. finalize 실패 후 단순 재호출은 막히므로 새 그룹 revision의 미승인 조판을 먼저 완료한 뒤 그 snapshot/output hash에 대한 독립 승인을 받아야 한다. publish도 1회 경로다. 합성 테스트는 소비된 승인 재사용 거부와 새 revision→미승인 조판→독립 승인→승인 소비용 snapshot의 복구 순서를 검증했다. 실제 DB 롤백은 진행 중인 테스트 트랜잭션에만 적용한다. 이미 커밋된 승격·게시를 임의 DELETE/UPDATE로 되돌리지 않는다.

운영 판정: `TEXTBOOK_FACTORY_PIPELINE_COMPLETE`는 합성 공정의 구현·검증 상태다. `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED`는 실제 증거를 사용한 별도 운영 E2E 이후에만 참이다.

개정 영향 예행은 `inspectProductionRevisionImpact`로 이전·새 manifest의 변경 범위를 계산한 뒤 `beginSyntheticRevisionWorkflow`로 시작한다. 변경은 `needs_review → revise → republish → complete` 순서로만 진행한다. 재구축 실패는 `needs_review`로 돌아가며 같은 이벤트 ID의 다른 내용은 거부한다. 권리 철회는 `withdraw`에서 종료하고 이전 revision을 다시 발행하지 않는다. 모든 이벤트는 동일 group ID와 새 manifest hash에 결속하며 최종 출력 hash가 재구축 hash와 다르면 발행 예행도 거부한다. 이 journal은 합성·비운영 검사이며 실제 카탈로그나 게시 행을 수정하지 않는다.

## 프로세스 중단 후 개정 예행 재개

`production-revision-run.mjs`는 저장소 밖 run directory에 `revision-000000.json`부터 변경 불가 기록을 쌓는다. 각 기록은 이전 journal hash, 같은 run ID, 원래 두 manifest hash와 합성 상태 전이를 다시 검증한다. 확정 파일은 임시 파일 fsync 후 hard-link로 생성하므로 기존 기록을 덮어쓰지 않는다. 이 보장은 프로세스 중단 복구용이며 전원 손실·네트워크 파일시스템의 내구성을 보증하지 않는다.

```powershell
pnpm exec tsx scripts/textbook/production-revision-run.mjs start --run-dir D:/textbook-runs/revision-1 --prior D:/textbook-runs/prior.manifest.json --next D:/textbook-runs/next.manifest.json
pnpm exec tsx scripts/textbook/production-revision-run.mjs advance --run-dir D:/textbook-runs/revision-1 --event D:/textbook-runs/review-event.json
pnpm exec tsx scripts/textbook/production-revision-run.mjs status --run-dir D:/textbook-runs/revision-1
pnpm exec tsx scripts/textbook/production-revision-run.mjs recover --run-dir D:/textbook-runs/revision-1
```

이벤트에는 `event_id`, `type`, `group_id`, `next_manifest_hash`, `proof_hash`를 넣는다. `type`은 `review_approved / rebuild_failed / rebuild_passed / publication_simulated` 중 현재 상태에 허용된 값만 쓴다. 마지막 예행에는 `output_hash=proof_hash`가 필요하며 직전 재구축 출력 hash와 같아야 한다. 같은 이벤트 재시도는 마지막 완료 상태에서도 idempotent지만 같은 ID의 다른 내용은 거부한다. 권리 철회 예행은 start에 `--cause rights_revoked`를 주며 `withdraw`에서 종료한다.

잠금도 완성·fsync한 임시 파일을 hard-link로 등록해 부분 JSON lock을 남기지 않는다. `recover`는 읽기 전용이며 lock을 삭제하지 않는다. 같은 머신의 종료된 소유자면 `manual_quarantine_required`와 lock token을 반환한다. 먼저 모든 해당 run 작성자를 멈추고 복구 운영자 한 명만 작업하게 한 뒤 `.writer-lock`을 존재하지 않는 `.pending-<새 UUID>`로 `Move-Item -LiteralPath`로 옮긴다. 원래 token의 pending 파일이 이미 있을 수 있으므로 대상 이름은 새 UUID를 쓴다. 이 격리는 가역적이며 새 작성자가 실행 중일 때 수행하면 안 된다. 다시 recover의 `resume_ready`를 확인하고 advance한다. 실행 중인 프로세스·다른 머신 lock은 보류한다. 빈·손상 lock도 자동 삭제하지 않고 구체적인 수동 격리 오류를 낸다.

`.pending-*`는 확정되지 않은 잔여물로 개수만 표시하고 성공 기록으로 읽지 않는다. 최초 start가 확정 기록 전에 중단되면 recover는 `state=not_started`, `sequence=null`과 잠금 진단을 반환한다. 잠금 격리 후 같은 두 manifest로 start를 재시도한다. 확정 기록이 손상되거나 순번이 빠지면 복구도 차단하므로 기록을 고쳐 이어가지 말고 보존한 뒤 새 run에서 재검토한다. 이후 미완료 임시 쓰기는 마지막 확정 상태부터 다시 advance한다.

원자 조판 dry-run에 `--previous-manifest PATH --revision-run-dir DIR`를 함께 주면 출력 파일을 확정한 뒤 개정 저널도 시작한다. 저널 저장 실패 시 명령은 실패하고 이미 저장된 조판물은 게시하지 않는다. 출력 manifest를 보존해 위 start 명령으로 저널을 재개할 수 있다. publish 동작에는 이 옵션을 허용하지 않는다. 이 경로도 `synthetic_fixture=true`, `non_production=true`, `publish_eligible=false`이며 실제 카탈로그 수정·재게시 승인이 아니다.
## Fixed reference production rehearsal

Run `pnpm exec tsx scripts/textbook/synthetic-master-run.mjs --order all --out-dir <new-external-directory>` to execute M1, H1 and M1–M2 P03 reference orders. The output directory must not exist; reruns use a new directory and do not overwrite evidence. The admin-only synthetic production panel on `/admin/csat/new` invokes the same runner and downloads HTML/manifest without DB writes. Failed runs produce no successful UI result. These presets inject benchmark/certification/seed fixtures, use mock RPCs and cannot publish or certify actual content.

## Planned student volume execution

`pnpm exec tsx scripts/textbook/planned-volume-run.mjs --input <external-json> --out-dir <new-external-directory>` accepts exactly `brief`, `orders` and `units`. Orders must carry current sealed planning hashes; the unit ledger must cover every planned day/grade, item, passage length and source mix. It emits `student.html`, its manifest and a fulfillment receipt. Output is rebuilt from the input before writing; the last file `complete.json` signals that every write completed. No teacher edition is generated.

Invalid input creates no output directory. Existing output is never overwritten. Files are read back and compared with the current input before a complete, fsynced marker is atomically linked into place. Parse `complete.json` and match its planning/receipt/manifest hashes; file presence alone is not success. If writing fails or execution stops, keep partial evidence as incomplete and rerun into a new directory. This is synthetic plan-ledger assembly, not DB atomic production, live source validation, certification or publication.

## Registered-order production run (2026-10-10)

`pnpm exec tsx scripts/textbook/order-production-run.mjs export --input <run-input.json> --run-dir <new-external-dir>` takes the same structured drafts that `/api/admin/csat/product-order-draft` seals and registers (`{ schema: 'textbook-order-production-input/1', sealed_at, drafts[] }`), re-seals them and writes `drain.json`: one cell per grade/day bound to `product_order_id`, `order_revision`, `order_hash`, plan hash and a cell hash. The agent drain writes `drain.out.json`; `import` re-derives the drain from the current drafts, rejects missing/duplicate/foreign/stale cells, runs the family adapter (`renderReadingFamilyUnit`; P03 exact-span gate) on every cell and only then assembles `student.html`, its manifest, `receipt.json` and `lineage.json`. `status --run-dir` reports the current stage, blockers and whether the drain is stale.

Recovery: a blocked import writes `result.json` with blockers and exit code 2, never student output; fix the fill and rerun `import` (safe to rerun). A changed draft (revision, brief, grade) makes every cell stale — export into a new run directory. Student files left without `complete.json` are treated as an interrupted attempt and replaced on the next import. After `complete.json`, import refuses to run again. P13/P14/P18/P20 are refused at export (`ORDER_RUN_FAMILY_NOT_IN_PLANNED_PATH`) because the planner does not yet produce their sealed resources/time budgets. No DB write occurs; DB promotion and atomic publication remain the separate P03 path.

## Multi-day volume from atomic snapshots (2026-10-11)

`scripts/textbook/atomic-volume.mjs` composes a student volume from one published atomic snapshot per day (`composeAtomicPlannedVolume(db, { orders, sections: [{ day, manifest }] })`). Every section must be a published atomic manifest whose units cover every order of the volume with the current revision/hash; days must be 1..N without gaps; snapshots and unit IDs cannot repeat. Each section is re-served through `serve_reading_production_artifact`, which re-checks current DB evidence, so revoking rights, changing an order or item in any day makes `verifyAtomicPlannedVolume` fail for the whole volume. No new table or migration is used. Limitation: the order list of a section comes from its published run manifest; the DB proves the snapshot and HTML but not that list. A DB-side volume RPC would close this and needs a reviewed migration. Recovery: re-run the affected day's atomic production (new group revision → capture → approve → finalize → publish), replace that day's manifest and recompose; nothing else needs rerunning.

Per-day atomic production for one order pair (2026-10-11): `exerciseMultiGradeDay(day, keys)` in `reading-promotion/synthetic-master.mjs` runs the existing promotion → register → capture → approve → finalize → publish chain for day N of the brief-bound P03 M1/M2 orders (day 1 is the original fixture). The trust keys must be shared across days because the trust policy is sealed into the order; fresh keys produce different order hashes and the volume composer rejects them. The 3-day test composes all planned days into one atomic volume and invalidates it when day 3's evidence is revoked. This is synthetic (in-memory DB); it shows the per-day atomic path end to end for one family (P03), not for arbitrary order-production runs.

## Order-production run to atomic volume (2026-10-11)

`scripts/textbook/run-atomic-bridge.mjs` takes an `assembled` order-production run and, for each planned day, builds synthetic promotion evidence (content review, signed Gold-S certificate and seed eligibility, factory evidence binding), promotes every grade's passage through the shared promotion executor, registers a grade-specific-adaptation group, captures/approves/finalizes the atomic snapshot, simulates publication and finally composes and verifies the multi-day atomic volume. The run's drafts must seal the synthetic trust root's `policy_hash` as their trust policy (`RUN_TRUST_POLICY_MISMATCH` otherwise). The family adapter is re-run inside atomic production on the gated item fields (`gatedItems`) the run carries; changed or foreign items fail. Everything is in memory: no DB write, `production_verified=false`. Recovery is the same as for one day: rebuild the failing day and recompose.

## Specialized families in the production run (2026-10-11)

The structured order draft now accepts `exam` (P18 and any R13 skill) and `resources` (licensed second texts for P13/P20, data for P14), validated by the order's target schema and sealed into the order hash. An order may seal several resources of its kind; day N uses resource `(N-1) mod count`, which the drain cell carries (`cell.resource` with URL, content, attribution and SHA-256). Items must set `resource_url` to that day's resource and quote it exactly in `evidence_resource`; P18 items need a positive `time_limit_seconds` printed as `[제한 N초]` (no running timer). The student page prints the resource and its attribution under the passage; `lineage.json` records each unit's `resource_sha256`. Blocks: `ORDER_RUN_RESOURCE_NOT_FOR_THIS_DAY`, `SPECIALIZED_READING_RESOURCE_UNGROUNDED`, `SPECIALIZED_READING_TIMER_MISSING`, and a missing sealed resource fails sealing. Atomic production for these four families still stops with `ATOMIC_SPECIALIZED_PRODUCTION_REVALIDATION_PENDING` (registration code and DB triggers `20261009095727`); lifting that needs DB-side resource revalidation and a reviewed migration. The admin registration form has no resource input yet; resources come through the draft JSON.

## Revision impact for a run and its atomic volume (2026-10-11)

`scripts/textbook/run-revision.mjs`: `inspectRunRevision(priorRun, nextRun)` compares two assembled runs cell by cell (order hash/revision, passage hash, unit hash, sealed resource hash, gated item fields) and returns `rebuild_days`, `reuse_days` and per-day reasons. A changed order set or plan is refused (`RUN_REVISION_ORDER_SET_CHANGED`, `RUN_REVISION_PLAN_CHANGED`) — export a new run instead. `reviseRunAtomicVolume` rebuilds only the changed days as a new group revision with a new snapshot, reuses the other days' published snapshots, recomposes and verifies the volume, and reports artifact-level impact per rebuilt day through `inspectProductionRevisionImpact`. The earlier volume is not edited; it stops verifying because its rebuilt day is no longer served. An order revision change rebuilds every day of that grade; no change rebuilds nothing. Synthetic/in-memory only; the persisted revision journal (`production-revision-journal.mjs`) is not yet driven by this run-level flow.

Journaled run revision (2026-10-11): `reviseRunAtomicVolumeJournaled({ ..., journalRoot })` records every rebuilt day in its own hash-chained journal `journalRoot/day-<N>-r<revision>` (outside the repository): start → `review_approved` (proof = impact hash) → `rebuild_passed` (proof = output HTML hash) → `publication_simulated` → `complete`. Rebuilds are deterministic, so after an interruption simply rerun the same call: start/advance are idempotent and no record is written twice. `runRevisionJournalStatus(journalRoot)` is read-only; the volume is usable only when every day journal is `complete` (a broken or edited record shows `unreadable` and blocks it). A stuck writer lock is diagnosed with the existing `recoverRevisionJournal` on that day's directory.

## Non-reading companion practice (2026-10-11)

A brief may list `companion_activities` (`grammar_practice`, `word_order_practice`, `vocab_practice`, `listening_practice`, `dictation_practice`, `vocab_cards`, `diagnostic_check`). They are part of the plan hash and sealed into every order as `activity_types`. `companion-practice.ts` runs the existing generators (`grammar-choice`, `word-order`, `vocab-choice`, `listen-choose`, `vocab/typeset` cloze) on each unit's own passage; dictation and cards reuse the licensed word audio and Korean meanings; the diagnostic check takes one run item per planned skill. Every item carries the unit's order ID, revision, hash and passage hash.

CLI: `order-production-run.mjs import ... --companion-resources <json>` (`antonyms`, `pos`, `common_words` or `null`, `word_pool`, `audio`). Without the resources an order with companion activities blocks (`COMPANION_RESOURCE_MISSING:*`); an activity with no generated item for a grade blocks (`COMPANION_ACTIVITY_EMPTY`) — fix the passage or resources and rerun `import` (safe). Audio without attribution is never used. On success `practice.html` and `practice.manifest.json` are written and re-verified before `complete.json`, which records `practice_manifest_hash`. Companion practice is file-level only; it is not part of the atomic snapshot path, and the admin planning form does not yet expose the field.

Delivery modes from a run (2026-10-11): `produceRunAtomicVolume({ run, trust, deliveryMode })` defaults to `auto` = `grade_specific_adaptations`; `shared_passage_grade_specific_items` and `grade_specific_units` must be requested explicitly (corrected after review: inferring shared passage from identical filled passages let them bypass the adaptation guard). Each day result records its `delivery_mode`. A mismatched forced mode is refused by the group contract (`SHARED_PASSAGE_VARIANT_MISMATCH`, `GRADE_ADAPTATION_MISSING_OR_REUSED`). `syntheticTrustRoot({ validUntil })` allows expiry injection; an expired issuer fails Gold-S validation before promotion.

Review fixes (2026-10-11): fulfillment now rejects an order whose sealed `activity_types` differ from the brief's `companion_activities` (`PRODUCT_PLAN_ORDER_STALE`); the companion manifest and `complete.json` record `companion_resources_sha256` of the resources file; a diagnostic that covers fewer than two planned skills blocks (`COMPANION_DIAGNOSTIC_TOO_NARROW`) and a unit without items blocks (`COMPANION_UNIT_WITHOUT_ITEMS`).

## Family semantic review stage (2026-10-11)

`import` no longer completes a run. After the volume, lineage and companion practice are written and re-verified, it writes `review.json` (`family-semantic-review.ts`): every unit with its passage, gated items and the family's criteria (two per family from `FAMILY_CRITERIA` plus `answer_unique`, `evidence_supports`, `grade_fit`). The agent drain writes `review.out.json` (`reviewer_id`, per unit `unit_hash`, `verdict`, boolean per criterion, an exact passage `quote`, `rationale`). `order-production-run.mjs review --input … --run-dir …` re-derives the run from the current drafts and fill; a changed draft or fill blocks with `FAMILY_REVIEW_RUN_STALE_REIMPORT_REQUIRED`. Missing, foreign, stale (`unit_hash`) or failing units, an invented quote, extra/missing criteria and a pass verdict with a false criterion block. Only a full pass writes `review.result.json` and then `complete.json` with `family_review_receipt_hash`. Status shows stage `family_reviewed` (in progress or blocked with the unit IDs).

Recovery: fix the failing unit in `drain.out.json`, rerun `import` (rewrites `review.json`; unchanged units keep their hashes), review only what changed, rerun `review`. A diagnostic companion for a single-skill family is now rejected at planning time (`COMPANION_DIAGNOSTIC_NEEDS_TWO_SKILLS`).

## DB-proven volume (2026-10-11, migration 20261011022148)

`registerDbAtomicVolume(db, { volumeId, revision, orders, sections })` sends only orders and `{ day, snapshot_id }`; the DB re-derives and stores the section list and volume hash. `serveDbAtomicVolume(db, volumeId)` returns the concatenated HTML only after the DB re-checks every day (published current, evidence current, group orders = volume orders at the current registered revision). This closes the earlier limitation that order binding came from the run manifest. Recovery after a day is rebuilt: publish the new day snapshot, then register a strictly newer volume revision; the old revision cannot be re-registered and serving it fails once its day is no longer the approved snapshot. The success path still needs real promoted groups in the DB (0 today); it is verified with a mock DB, and the refusal paths with a rollback-only DB smoke.

Live measurement (2026-10-11): `node scripts/textbook/atomic-volume-db-measure.mjs` prints the rollback-only DB measurement with fresh keys; run it only after approval and compare table counts before and after. Results are in the completion audit.
