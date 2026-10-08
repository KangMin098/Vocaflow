// scripts/textbook/production-evidence-resolver.mjs
import { createHash } from 'node:crypto'
import { MULTI_GRADE_DRY_RUN_MARKER, runMultiGradeFactoryDryRun, reviewDigest } from '@vocaflow/library-pipeline'
import { bindMultiGradeEvidence, sealMultiGradeProductOrder } from '@vocaflow/library-pipeline/multi-grade-order'
import { hash } from './frym-benchmark/benchmark.mjs'
import { verifyOrderRenderItems } from './factory-lineage.mjs'

const fail = reason => { throw Error(reason) }

// The verifier reads live article, parent, authority, order, audit and item rows.
// Supabase REST reads are not one transaction: a second sweep detects changes
// observed between sections, while publication still requires an atomic DB gate.
export async function resolveProductionEvidence(db, { sections, policy, now, group = null, evidence = null }) {
  if (!db || !policy || !Number.isFinite(Date.parse(now)) || !Array.isArray(sections) || !sections.length)
    fail('PRODUCTION_RESOLVER_INPUT_MISSING')
  if ((group === null) !== (evidence === null)) fail('PRODUCTION_GROUP_EVIDENCE_REQUIRED')
  if (new Set(sections.map(section => section.grade)).size !== sections.length ||
      new Set(sections.flatMap(section => section.printedItems?.map(item => item.id) ?? [])).size !==
        sections.reduce((sum, section) => sum + (section.printedItems?.length ?? 0), 0))
    fail('PRODUCTION_SECTION_OR_ITEM_DUPLICATE')
  let sealed = null
  let bound = null
  if (group) {
    sealed = sealMultiGradeProductOrder(group)
    bound = bindMultiGradeEvidence(sealed.group, evidence)
    if (sections.length !== sealed.group.orders.length || sections.some((section, index) =>
      section.grade !== sealed.group.orders[index].grade || section.orderId !== sealed.group.orders[index].order.product_order_id))
      fail('PRODUCTION_GROUP_SECTION_MIXED')
  } else if (sections.length !== 1 || sections[0].grade !== 'single') fail('PRODUCTION_SINGLE_ORDER_REQUIRED')

  async function authoritySnapshot() {
    const { data, error } = await db.from('reading_promotion_authority')
      .select('singleton, trust_policy_hash, benchmark_version, benchmark_snapshot_hash, revoked_certificate_hashes, revoked_eligibility_hashes, valid_until')
      .eq('singleton', true).maybeSingle()
    if (error || !data) fail('PRODUCTION_AUTHORITY_UNAVAILABLE')
    return data
  }

  async function sweep() {
    const observed = []
    for (const [index, section] of sections.entries()) {
      if (!section.orderId || !Array.isArray(section.printedItems) || !section.printedItems.length ||
          !Array.isArray(section.requests) || !section.requests.length) fail('PRODUCTION_SECTION_INCOMPLETE')
      const checked = await verifyOrderRenderItems(db, section.printedItems, section.orderId, section.requests, policy, now)
      const articleIds = [...new Set(section.printedItems.map(item => item.ref_id))]
      if (group) {
        const variant = bound.evidence.variants[index]
        if (articleIds.length !== 1 || section.requests.some(request => request.bundle?.certificate?.source_id !== bound.evidence.source_id ||
            request.evidence?.adaptation_hash !== variant.adaptation_hash) ||
          hash(section.printedItems.map(item => [item.id, item.source_item_digest])) !== variant.item_set_hash ||
          checked.order.order_revision !== variant.order_revision || checked.order.order_hash !== variant.order_hash ||
          checked.itemEvidence.some(({ lineage }) => lineage.source_hash !== bound.evidence.source_hash ||
            lineage.rights_hash !== bound.evidence.rights_hash ||
            lineage.adaptation_hash !== variant.passage_hash || lineage.benchmark_snapshot_hash !== variant.benchmark_snapshot_hash ||
            lineage.certificate_hash == null || lineage.eligibility_hash == null))
          fail('PRODUCTION_GRADE_EVIDENCE_STALE_OR_MIXED')
      }
      observed.push({ grade: section.grade, article_ids: articleIds, order: checked.order,
        item_evidence: checked.itemEvidence })
    }
    return observed
  }

  const authorityBeforeHash = hash(await authoritySnapshot())
  const first = await sweep()
  const second = await sweep()
  const authorityAfter = await authoritySnapshot()
  if (hash(first) !== hash(second) || authorityBeforeHash !== hash(authorityAfter))
    fail('PRODUCTION_EVIDENCE_CHANGED_DURING_RESOLVE')
  const snapshot = { schema: 'textbook-production-evidence-snapshot/1', evidence_level: 'live_revalidated_non_atomic',
    production_verified: false, verified_at: now, group_hash: sealed?.group_hash ?? null,
    group_evidence_hash: bound?.evidence_hash ?? null, authority_snapshot_hash: hash(authorityAfter), sections: second }
  return { ...snapshot, snapshot_hash: hash(snapshot) }
}

export async function runLiveMultiGradeFactoryDryRun(db, { group, evidence, stages, render, requestsByGrade, policy, now }) {
  if (!Array.isArray(stages) || !requestsByGrade || typeof requestsByGrade !== 'object')
    fail('MULTI_GRADE_LIVE_INPUT_MISSING')
  const sealed = sealMultiGradeProductOrder(group)
  const sections = stages.map((stage, index) => {
    const child = sealed.group.orders[index]
    if (!child || stage.grade !== child.grade || !Array.isArray(stage.items)) fail('PRODUCTION_GROUP_SECTION_MIXED')
    const requests = requestsByGrade[stage.grade]
    if (!Array.isArray(requests)) fail('MULTI_GRADE_PROMOTION_REQUEST_MISSING')
    return { grade: stage.grade, orderId: child.order.product_order_id, requests,
      printedItems: stage.items.map(item => ({ ...item, source_item_digest: reviewDigest(item.payload, item.answer_key) })) }
  })
  const snapshot = await resolveProductionEvidence(db, { sections, policy, now, group, evidence })
  const currentLineages = snapshot.sections.map(section => {
    const lineage = section.item_evidence[0]?.lineage
    if (!lineage || section.item_evidence.some(row => hash(row.lineage) !== hash(lineage)))
      fail('MULTI_GRADE_LIVE_LINEAGE_MIXED')
    return { grade: section.grade, article_id: section.article_ids[0], source_id: evidence.source_id, lineage }
  })
  const rendered = runMultiGradeFactoryDryRun({ group, evidence, currentEvidence: evidence,
    currentLineages, stages, render })
  if (!rendered.html.startsWith(MULTI_GRADE_DRY_RUN_MARKER + '\n')) fail('MULTI_GRADE_DRY_RUN_MARKER_MISSING')
  const html = '<!-- LIVE REVALIDATED NON-ATOMIC DRY RUN; NOT APPROVED FOR PUBLICATION -->' +
    rendered.html.slice(MULTI_GRADE_DRY_RUN_MARKER.length)
  const { manifest_hash: _oldHash, ...base } = rendered.manifest
  const manifest = { ...base, evidence_level: 'live_revalidated_non_atomic', production_verified: false,
    group_contract_source: 'caller_supplied', production_evidence_snapshot: snapshot,
    html_sha256: createHash('sha256').update(html).digest('hex') }
  return { html, manifest: { ...manifest, manifest_hash: hash(manifest) } }
}
