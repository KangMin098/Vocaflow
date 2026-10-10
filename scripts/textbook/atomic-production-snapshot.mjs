// scripts/textbook/atomic-production-snapshot.mjs
import { createHash } from 'node:crypto'
import { MULTI_GRADE_DRY_RUN_MARKER, reviewDigest, runMultiGradeFactoryDryRun } from '@vocaflow/library-pipeline'
import { bindMultiGradeEvidence, sealMultiGradeProductOrder } from '@vocaflow/library-pipeline/multi-grade-order'
import { hash } from './frym-benchmark/benchmark.mjs'
import { sourceRightsHash } from './frym-benchmark/gold-s-import-gate.mjs'
import { validateGoldSImport } from './frym-benchmark/gold-s-import-gate.mjs'
import { targetKey } from './academic-reading-contract.mjs'

const sha = value => createHash('sha256').update(value, 'utf8').digest('hex')
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const fail = reason => { throw Error(reason) }
const specialized = new Set(['P13', 'P14', 'P18', 'P20'])

export async function registerTrustedProductionGroup(db, { group, evidence, sections } = {}) {
  if (!db?.rpc || !Array.isArray(sections)) fail('ATOMIC_GROUP_REGISTRATION_INVALID')
  if (group?.orders?.some(entry => specialized.has(entry?.order?.product_family)))
    fail('ATOMIC_SPECIALIZED_PRODUCTION_REVALIDATION_PENDING')
  const sealed = sealMultiGradeProductOrder(group)
  bindMultiGradeEvidence(sealed.group, evidence)
  if (sections.length !== sealed.group.orders.length || sections.some((section, index) =>
    section.grade !== sealed.group.orders[index].grade ||
    section.order_id !== sealed.group.orders[index].order.product_order_id ||
    typeof section.article_id !== 'string' || typeof section.audit_id !== 'string' ||
    !Array.isArray(section.item_ids) || !section.item_ids.length ||
    new Set(section.item_ids).size !== section.item_ids.length) ||
    new Set(sections.flatMap(section => section.item_ids)).size !==
      sections.reduce((total, section) => total + section.item_ids.length, 0))
    fail('ATOMIC_GROUP_SECTION_MIXED')
  const { data, error } = await db.rpc('register_reading_production_group', {
    p_group_id: sealed.group.group_id, p_group_revision: sealed.group.group_revision,
    p_sections: sections, p_group_document: sealed.group, p_evidence_document: evidence,
  })
  if (error || data?.group_id !== sealed.group.group_id || data?.group_revision !== sealed.group.group_revision)
    fail('ATOMIC_GROUP_REGISTRATION_FAILED')
  return data
}

export async function approveTrustedProductionOutput(db, { snapshotId, snapshotHash, html } = {}) {
  if (!db?.rpc || typeof snapshotId !== 'string' || !hex(snapshotHash) ||
      typeof html !== 'string' || !html.length)
    fail('ATOMIC_OUTPUT_APPROVAL_INPUT_INVALID')
  const outputHash = sha(html)
  const { data, error } = await db.rpc('approve_reading_production_output', {
    p_snapshot_id: snapshotId, p_snapshot_hash: snapshotHash, p_output_hash: outputHash,
  })
  if (error || data?.approved_output_hash !== outputHash || !hex(data?.approved_evidence_hash))
    fail('ATOMIC_OUTPUT_APPROVAL_FAILED')
  return data
}

// Only the RPC may supply group/evidence. Its SQL reads and locks all mutable
// dependencies in one transaction. A caller can choose stage presentation but
// cannot choose the order, grade, item, source, or promotion evidence.
export async function captureTrustedProductionSnapshot(db, groupId) {
  if (!db?.rpc || typeof groupId !== 'string' || !groupId.trim()) fail('ATOMIC_SNAPSHOT_INPUT_INVALID')
  const { data, error } = await db.rpc('capture_reading_production_snapshot', { p_group_id: groupId })
  if (error || !data) fail('ATOMIC_SNAPSHOT_CAPTURE_FAILED')
  const { snapshot_id: snapshotId, snapshot_hash: snapshotHash, evidence, expires_at: expiresAt,
    captured_at: capturedAt } = data
  if (typeof snapshotId !== 'string' || !hex(snapshotHash) || evidence?.schema !== 'reading-production-evidence/1' ||
      evidence.group_id !== groupId || !Array.isArray(evidence.sections) || !evidence.sections.length ||
      (evidence.approved_output_hash !== null && !hex(evidence.approved_output_hash)) ||
      !Number.isFinite(Date.parse(expiresAt)) || !Number.isFinite(Date.parse(capturedAt)))
    fail('ATOMIC_SNAPSHOT_RESPONSE_INVALID')
  if (evidence.group_document?.orders?.some(entry => specialized.has(entry?.order?.product_family)))
    fail('ATOMIC_SPECIALIZED_PRODUCTION_REVALIDATION_PENDING')
  const sealed = sealMultiGradeProductOrder(evidence.group_document)
  const bound = bindMultiGradeEvidence(sealed.group, evidence.evidence_document)
  if (sealed.group.group_id !== groupId || sealed.group.group_revision !== evidence.group_revision ||
      evidence.sections.length !== sealed.group.orders.length || bound.evidence.variants.length !== evidence.sections.length)
    fail('ATOMIC_SNAPSHOT_GROUP_MIXED')
  for (const [index, section] of evidence.sections.entries()) {
    const child = sealed.group.orders[index]
    const variant = bound.evidence.variants[index]
    const gold = validateGoldSImport({ draft: { adapted_from_id: section.source_id,
      text: section.article_content, reading: { target: child.order.target } },
      targetKey: targetKey(child.order.target), source: section.source_evidence,
      bundle: section.gold_s?.proof_bundle, policy: section.gold_s?.operational_policy,
      now: new Date(Date.parse(capturedAt)).toISOString() })
    if (section.grade !== child.grade || section.order_id !== child.order.product_order_id ||
        section.order_revision !== child.order.order_revision || section.order_hash !== sealed.child_order_hashes[child.grade] ||
        section.article_id == null || section.source_id !== bound.evidence.source_id ||
        section.source_content_hash !== bound.evidence.source_hash ||
        sourceRightsHash(section.source_evidence) !== bound.evidence.rights_hash ||
        !gold.ok || hash(gold.certificate) !== hash(section.gold_s) ||
        gold.certificate.certificate_hash !== section.certificate_hash ||
        gold.certificate.eligibility_hash !== section.eligibility_hash ||
        section.benchmark_snapshot_hash !== variant.benchmark_snapshot_hash ||
        !Array.isArray(section.items) || !section.items.length ||
        hash(section.items.map(item => [item.id, reviewDigest(item.payload, item.answer_key)])) !== variant.item_set_hash ||
        section.items.some(item => item.ref_id !== section.article_id ||
          (item.state && item.state.status !== 'usable') ||
          !Array.isArray(item.reviews) || item.reviews.length !== 3 ||
          new Set(item.reviews.map(row => row.persona)).size !== 3 ||
          item.reviews.some(row => row.verdict !== 'pass' ||
            row.reviewed_digest !== reviewDigest(item.payload, item.answer_key)) ||
          item.payload?.factory_lineage?.product_order_id !== section.order_id ||
          item.payload?.factory_lineage?.promotion_request_id !== section.audit_id ||
          item.payload?.factory_lineage?.rights_hash !== bound.evidence.rights_hash ||
          item.payload?.factory_lineage?.certificate_hash !== section.certificate_hash ||
          item.payload?.factory_lineage?.eligibility_hash !== section.eligibility_hash ||
          item.payload?.factory_lineage?.adaptation_hash !== variant.passage_hash ||
          item.payload?.factory_lineage?.benchmark_version !== variant.benchmark_version ||
          item.payload?.factory_lineage?.benchmark_snapshot_hash !== variant.benchmark_snapshot_hash))
      fail('ATOMIC_SNAPSHOT_GRADE_EVIDENCE_MIXED')
  }
  return { snapshotId, snapshotHash, expiresAt, evidence, group: sealed.group, groupEvidence: bound.evidence }
}

export async function runAtomicMultiGradeFactoryDryRun(db, input) {
  if (!input || Object.hasOwn(input, 'group') || Object.hasOwn(input, 'evidence') ||
      Object.hasOwn(input, 'currentLineages') || Object.hasOwn(input, 'requestsByGrade') ||
      !Array.isArray(input.stages) || !input.render) fail('ATOMIC_PRODUCTION_CALLER_EVIDENCE_FORBIDDEN')
  const { groupId, stages, render } = input
  const trusted = await captureTrustedProductionSnapshot(db, groupId)
  if (stages.length !== trusted.evidence.sections.length) fail('ATOMIC_PRODUCTION_SECTION_MIXED')
  const currentLineages = []
  for (const [index, section] of trusted.evidence.sections.entries()) {
    const stage = stages[index]
    const item = section.items[0]
    const lineage = item.payload?.factory_lineage
    const explanationByItem = new Map(stage?.explanations?.map(row => [row.item_id, row]) ?? [])
    if (stage?.grade !== section.grade || stage.article_id !== section.article_id ||
        stage.passage !== section.article_content || !Array.isArray(stage.items) ||
        stage.items.length !== section.items.length ||
        section.items.some((recorded, position) =>
          recorded.id !== stage.items[position]?.id ||
          reviewDigest(recorded.payload, recorded.answer_key) !==
            reviewDigest(stage.items[position]?.payload, stage.items[position]?.answer_key) ||
          !((recorded.answer_key?.explanation_ko || recorded.answer_key?.rationale_ko)?.trim()) ||
          explanationByItem.get(recorded.id)?.text !==
            (recorded.answer_key?.explanation_ko || recorded.answer_key?.rationale_ko)) ||
        section.items.some(row => hash(row.payload?.factory_lineage) !== hash(lineage)))
      fail('ATOMIC_PRODUCTION_STAGE_STALE_OR_MIXED')
    currentLineages.push({ grade: section.grade, article_id: section.article_id,
      source_id: section.source_id, lineage })
  }
  const rendered = runMultiGradeFactoryDryRun({ group: trusted.group, evidence: trusted.groupEvidence,
    currentEvidence: trusted.groupEvidence, currentLineages, stages, render })
  if (!rendered.html.startsWith(MULTI_GRADE_DRY_RUN_MARKER + '\n')) fail('ATOMIC_PRODUCTION_DRY_RUN_MARKER_MISSING')
  const html = '<!-- ATOMIC SNAPSHOT DRY RUN; UNPUBLISHED -->' + rendered.html.slice(MULTI_GRADE_DRY_RUN_MARKER.length)
  const outputHash = sha(html)
  if (trusted.evidence.approved_output_hash && trusted.evidence.approved_output_hash !== outputHash)
    fail('ATOMIC_PRODUCTION_OUTPUT_NOT_APPROVED')
  // This second RPC locks and rechecks all dependencies. A changed source,
  // certificate, order, item, or group makes the temporary output unusable.
  const { data: finalized, error } = await db.rpc('finalize_reading_production_snapshot', {
    p_snapshot_id: trusted.snapshotId, p_snapshot_hash: trusted.snapshotHash, p_output_hash: outputHash,
  })
  if (error || finalized?.status !== 'rendered_unpublished' ||
      finalized.snapshot_id !== trusted.snapshotId || finalized.snapshot_hash !== trusted.snapshotHash ||
      finalized.output_hash !== outputHash) fail('ATOMIC_PRODUCTION_FINALIZATION_FAILED')
  const { manifest_hash: _priorHash, ...base } = rendered.manifest
  const manifest = { ...base, evidence_level: 'atomic_snapshot_unpublished', production_verified: false,
    group_contract_source: 'db_registered', snapshot_id: trusted.snapshotId,
    snapshot_hash: trusted.snapshotHash, snapshot_expires_at: trusted.expiresAt,
    approved_output_hash: trusted.evidence.approved_output_hash,
    html_sha256: outputHash, finalization: finalized }
  return { html, manifest: { ...manifest, manifest_hash: hash(manifest) } }
}

export async function publishAtomicProductionArtifact(db, { html, manifest } = {}) {
  if (!db?.rpc || typeof html !== 'string' ||
      manifest?.evidence_level !== 'atomic_snapshot_unpublished' ||
      manifest.production_verified !== false || !hex(manifest.snapshot_hash) ||
      !hex(manifest.html_sha256) || manifest.approved_output_hash !== manifest.html_sha256 ||
      sha(html) !== manifest.html_sha256)
    fail('ATOMIC_PUBLICATION_INPUT_STALE')
  const { data, error } = await db.rpc('publish_reading_production_artifact', {
    p_snapshot_id: manifest.snapshot_id, p_snapshot_hash: manifest.snapshot_hash, p_html: html,
  })
  if (error || data?.status !== 'published_current' || data.snapshot_id !== manifest.snapshot_id ||
      data.snapshot_hash !== manifest.snapshot_hash || data.output_hash !== manifest.html_sha256)
    fail('ATOMIC_PUBLICATION_REJECTED')
  return { ...data, production_verified: false }
}

export async function serveAtomicProductionArtifact(db, snapshotId) {
  if (!db?.rpc || typeof snapshotId !== 'string' || !snapshotId.trim()) fail('ATOMIC_SERVE_INPUT_INVALID')
  const { data, error } = await db.rpc('serve_reading_production_artifact', { p_snapshot_id: snapshotId })
  if (error || data?.snapshot_id !== snapshotId || !hex(data.snapshot_hash) ||
      !hex(data.output_hash) || typeof data.html !== 'string' || sha(data.html) !== data.output_hash)
    fail('ATOMIC_SERVE_REJECTED')
  return data
}
