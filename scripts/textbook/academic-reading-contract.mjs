// scripts/textbook/academic-reading-contract.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
import {
  readingTargetSchema,
  readingDirectives,
  READING_ENGINE_VERSION,
} from '@vocaflow/library-pipeline/academic-reading'
import {
  validateReadingAnalysis,
  validateReadingLicense,
} from '@vocaflow/library-pipeline/academic-reading-contract'

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`
  return JSON.stringify(value)
}
export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex')
export function readTarget(file) {
  return file ? readingTargetSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))) : null
}
export const targetIdentity = (target) => ({
  ...target,
  resources: target.resources.map((r) => ({
    kind: r.kind,
    canonical_source: r.canonical_source,
    canonical_url: r.canonical_url,
    content_hash: digest(r.content),
  })),
})
export const targetKey = (target) =>
  digest(canonical({ version: READING_ENGINE_VERSION, target: targetIdentity(target) })).slice(
    0,
    24
  )
export const adaptationKey = (sourceId, target) => `reading:${sourceId}:${targetKey(target)}`
export function readingTask(source, target) {
  return {
    version: READING_ENGINE_VERSION,
    target,
    target_key: targetKey(target),
    source_hash: digest(source.content ?? ''),
    source_revision: source.updated_at,
    source_rights: source.csat_fit?.reading_license ?? null,
    brief: 'scripts/textbook/academic-reading-brief.md',
    reading_directives: readingDirectives(target),
    reading_analysis: null,
  }
}
export function validateReadingDraft(row, exported, current, now) {
  const no = (reason) => ({ ok: false, reason })
  if (!exported?.reading || !row.reading) return no('export contract missing')
  const target = readingTargetSchema.safeParse(exported.reading.target)
  if (!target.success) return no('invalid exported target')
  if (
    exported.reading.version !== READING_ENGINE_VERSION ||
    row.reading.version !== READING_ENGINE_VERSION
  )
    return no('reading engine version mismatch')
  if (
    row.adapted_from_id !== exported.adapted_from_id ||
    canonical(row.reading.target) !== canonical(target.data) ||
    row.reading.target_key !== targetKey(target.data)
  )
    return no('target or parent was changed')
  if (!current || current.id !== row.adapted_from_id) return no('current source missing')
  if (
    current.updated_at !== exported.reading.source_revision ||
    digest(current.content ?? '') !== exported.reading.source_hash
  )
    return no('source revision or body hash changed; export again')
  if (
    row.source_text !== current.content ||
    row.reading.source_hash !== exported.reading.source_hash ||
    row.reading.source_revision !== current.updated_at
  )
    return no('source text or binding was changed')
  if (
    row.target_v_level !== target.data.passage_v_level ||
    row.target_band !== target.data.language_band ||
    row.source_feed !== current.source ||
    row.source_url !== current.source_url ||
    row.source_license !== current.license_class
  )
    return no('source/level metadata mismatch')
  if (
    current.display_only !== false ||
    current.copyright_safe_in_kr !== true ||
    !['cc_by', 'cc_by_sa', 'cc0', 'public_domain'].includes(current.license_class) ||
    ['archived', 'failed'].includes(current.status)
  )
    return no('source rights/status currently block adaptation')
  if (
    ['reject', 'discard'].includes(current.csat_fit?.gate?.verdict) ||
    current.csat_fit?.gate?.retain?.verdict === 'discard'
  )
    return no('source content/retention rejected')
  const license = validateReadingLicense(target.data, row.reading.source_rights)
  if (!license.ok) return no(license.reason)
  if (
    license.rights.canonical_url !== current.source_url ||
    license.rights.canonical_source !== current.source
  )
    return no('article license is bound to a different source')
  const checked = Date.parse(license.rights.checked_at)
  if (!Number.isFinite(now) || checked > now || checked < Date.parse(current.updated_at))
    return no('license evidence must be checked after the source revision and before import')
  if (target.data.resources.some((r) => Date.parse(r.checked_at) > now))
    return no('resource license check is in the future')
  if ((current.license_class === 'cc_by_sa') !== license.rights.share_alike)
    return no('share-alike disagrees with current source license')
  if (license.rights.license !== current.license)
    return no('license text disagrees with current source')
  const analysis = validateReadingAnalysis(
    target.data,
    row.reading.reading_analysis,
    current.content,
    row.text ?? ''
  )
  if (!analysis.ok) return analysis
  if (
    analysis.analysis.parallel_pair &&
    (current.source !== 'frym' ||
      analysis.analysis.parallel_pair.student_url !== current.source_url ||
      !current.content.includes(analysis.analysis.parallel_pair.evidence) ||
      !analysis.analysis.parallel_pair.evidence.includes(
        analysis.analysis.parallel_pair.original_work_id
      ))
  )
    return no('research/student pair has no source-bound DOI evidence')
  return {
    ok: true,
    target: target.data,
    spec: {
      version: READING_ENGINE_VERSION,
      target_key: targetKey(target.data),
      target: target.data,
      provenance: {
        source_id: current.id,
        source_revision: current.updated_at,
        source_hash: digest(current.content),
        rights: license.rights,
        resources: target.data.resources.map((r, index) => ({
          resource_index: index,
          content_hash: digest(r.content),
          canonical_source: r.canonical_source,
          canonical_url: r.canonical_url,
          license: r.license,
          license_url: r.license_url,
          license_evidence: r.license_evidence,
          checked_at: r.checked_at,
          commercial_use: r.commercial_use,
          derivative_use: r.derivative_use,
          ai_processing: r.ai_processing,
          third_party_text: r.third_party_text,
          share_alike: r.share_alike,
          attribution: r.attribution,
        })),
      },
      analysis: analysis.analysis,
      state: 'awaiting_content_review',
    },
  }
}
