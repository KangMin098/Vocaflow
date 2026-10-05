// scripts/textbook/academic-reading-review.mjs
import fs from 'node:fs'
import path from 'node:path'
import { adaptationKey, canonical, digest, targetKey } from './academic-reading-contract.mjs'
import { articleLicenseSchema, readingTargetSchema, READING_ENGINE_VERSION } from '@vocaflow/library-pipeline/academic-reading'
import { readingAnalysisSchema, readingSkillsForType, validateReadingItem, validateReadingPresentation } from '@vocaflow/library-pipeline/academic-reading-contract'
import { normalizeSourceMarkup } from '@vocaflow/library-pipeline'

export const REVIEWERS = ['claude_code', 'codex']
export const REVIEW_DIMENSIONS = [
  'claim_preserved',
  'relation_preserved',
  'scope_preserved',
  'epistemic_strength_preserved',
  'no_hallucinated_content',
  'lexical_target_fit',
  'syntax_target_fit',
  'reasoning_target_fit',
  'age_appropriateness',
  'overall_level_fit',
  'rights_and_attribution',
  'item_evidence_supported',
]
export const DISTORTIONS = [
  'CAUSE_REVERSAL', 'SCOPE_EXPANSION', 'SCOPE_REDUCTION',
  'CLAIM_STRENGTHENING', 'CLAIM_WEAKENING', 'CONTRAST_LOSS',
  'CONDITION_LOSS', 'ADDED_CAUSALITY', 'UNSUPPORTED_DETAIL',
  'KEY_DETAIL_OMISSION',
]
export const READING_REVIEW_PARENT_COLUMNS = 'id, content, updated_at, source, source_url, license, license_class, display_only, copyright_safe_in_kr, status, csat_fit'

export function reviewIdentity(row, exported) {
  if (!exported?.reading || !row?.reading) throw new Error('reading export and draft required')
  if (typeof exported.source_text !== 'string' ||
      digest(exported.source_text) !== exported.reading.source_hash ||
      row.source_text !== exported.source_text)
    throw new Error('exported source body does not match its hash or draft')
  return {
    source_id: exported.adapted_from_id,
    source_revision: exported.reading.source_revision,
    source_hash: exported.reading.source_hash,
    target_key: exported.reading.target_key,
    target_hash: digest(canonical(exported.reading.target)),
    draft_hash: digest(canonical({
      title: row.title?.trim(),
      text: row.text?.trim(),
      source_rights: articleLicenseSchema.parse(row.reading.source_rights),
      reading_analysis: readingAnalysisSchema.parse(row.reading.reading_analysis),
    })),
  }
}

export function reviewTemplate(row, exported, reviewer) {
  if (!REVIEWERS.includes(reviewer)) throw new Error('unknown reviewer')
  return {
    ...reviewIdentity(row, exported), reviewer, verdict: null,
    dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map(k => [k, null])),
    distortions: [],
    source_quote: '', passage_quote: '', rationale: '',
  }
}

export function prepareReviewRows(source, drafts) {
  if (!Array.isArray(source) || !Array.isArray(drafts) || source.some(r => !r.reading))
    throw new Error('reading source and draft arrays required')
  const byIdentity = new Map()
  for (const input of source) {
    const key = `${input.adapted_from_id}:${input.reading.target_key}`
    if (byIdentity.has(key)) throw new Error(`duplicate source ${key}`)
    byIdentity.set(key, input)
  }
  const complete = []
  const held = []
  const seen = new Set()
  for (const draft of drafts) {
    const key = `${draft.adapted_from_id}:${draft.reading?.target_key}`
    if (seen.has(key)) throw new Error(`duplicate draft ${key}`)
    seen.add(key)
    const input = byIdentity.get(key)
    if (!input) throw new Error(`draft has no source ${key}`)
    if (!draft.title?.trim() || !draft.text?.trim()) {
      held.push({ source_id: draft.adapted_from_id, reason: 'empty title or passage' })
      continue
    }
    try { reviewTemplate(draft, input, REVIEWERS[0]); complete.push([draft, input]) }
    catch (error) { held.push({ source_id: draft.adapted_from_id, reason: error.message }) }
  }
  if (seen.size !== byIdentity.size) throw new Error('draft is missing a source row')
  return { complete, held }
}

export function mergeReviewTemplates(existing, complete, reviewer) {
  if (!Array.isArray(existing)) throw new Error('review file must be an array')
  const rows = [...existing]
  let added = 0
  for (const [draft, input] of complete) {
    const template = reviewTemplate(draft, input, reviewer)
    if (rows.some(r => r?.source_id === template.source_id && r?.target_key === template.target_key &&
        r?.source_hash === template.source_hash && r?.source_revision === template.source_revision &&
        r?.target_hash === template.target_hash && r?.draft_hash === template.draft_hash)) continue
    rows.push(template)
    added++
  }
  return { rows, added }
}

export function readAgentReviews(dir, file) {
  const stem = file.replace(/\.out\.json$/, '')
  return REVIEWERS.map(reviewer => {
    const reviewFile = path.join(dir, `${stem}.${reviewer}.review.json`)
    if (!fs.existsSync(reviewFile)) return null
    return JSON.parse(fs.readFileSync(reviewFile, 'utf8'))
  })
}

export function validateAgentReviews(row, exported, reviews) {
  const identity = reviewIdentity(row, exported)
  if (!Array.isArray(reviews) || reviews.length !== REVIEWERS.length)
    return { ok: false, reason: 'two independent agent reviews required' }
  const certificate = []
  for (const [index, reviewer] of REVIEWERS.entries()) {
    const matches = reviews[index]?.filter?.(r => Object.entries(identity).every(([k, v]) => r?.[k] === v))
    if (!matches || matches.length !== 1) return { ok: false, reason: `${reviewer} review missing or duplicated` }
    const r = matches[0]
    if (r.reviewer !== reviewer || Object.entries(identity).some(([k, v]) => r[k] !== v))
      return { ok: false, reason: `${reviewer} review identity is stale or mismatched` }
    if (r.verdict !== 'pass') return { ok: false, reason: `${reviewer} review did not pass` }
    if (!r.dimensions || Object.keys(r.dimensions).sort().join() !== [...REVIEW_DIMENSIONS].sort().join() ||
        REVIEW_DIMENSIONS.some(k => r.dimensions[k] !== true))
      return { ok: false, reason: `${reviewer} review dimension failed or missing` }
    if (!Array.isArray(r.distortions) || r.distortions.some(x => !DISTORTIONS.includes(x)) || r.distortions.length)
      return { ok: false, reason: `${reviewer} distortion detected or malformed` }
    if (typeof r.source_quote !== 'string' || typeof r.passage_quote !== 'string' ||
        r.source_quote.length < 8 || r.passage_quote.length < 8 ||
        !exported.source_text.includes(r.source_quote) || !row.text.includes(r.passage_quote) ||
        typeof r.rationale !== 'string' || r.rationale.trim().length < 20)
      return { ok: false, reason: `${reviewer} review evidence missing` }
    certificate.push({ reviewer, review_hash: digest(canonical(r)), verdict: r.verdict, review: r })
  }
  return { ok: true, certificate: { version: 1, ...identity, reviews: certificate } }
}

export function validateStoredAgentReview(article, parent) {
  const spec = article?.composed_spec?.academic_reading
  const cert = spec?.content_review
  if (spec?.state !== 'agent_reviewed' || cert?.version !== 1) return false
  if (!Array.isArray(spec.target?.resources)) return false
  if (!readingTargetSchema.safeParse(spec.target).success) return false
  if (!articleLicenseSchema.safeParse(spec.provenance?.rights).success ||
      !readingAnalysisSchema.safeParse(spec.analysis).success) return false
  if (!parent || parent.id !== article.adapted_from_id ||
      parent.updated_at !== spec.provenance?.source_revision ||
      digest(parent.content ?? '') !== spec.provenance?.source_hash) return false
  const rights = spec.provenance?.rights
  if (parent.source !== rights.canonical_source || parent.source_url !== rights.canonical_url ||
      parent.license !== rights.license || parent.display_only !== false ||
      parent.copyright_safe_in_kr !== true ||
      !['cc_by', 'cc_by_sa', 'cc0', 'public_domain'].includes(parent.license_class) ||
      (parent.license_class === 'cc_by_sa') !== rights.share_alike ||
      ['archived', 'failed'].includes(parent.status) ||
      ['reject', 'discard'].includes(parent.csat_fit?.gate?.verdict) ||
      parent.csat_fit?.gate?.retain?.verdict === 'discard') return false
  if (article.source !== parent.source || article.license !== rights.license ||
      article.license_class !== parent.license_class || article.display_only !== false ||
      article.copyright_safe_in_kr !== true) return false
  if (spec.target_key !== targetKey(spec.target) ||
      spec.provenance?.source_id !== article.adapted_from_id ||
      article.source_id !== adaptationKey(article.adapted_from_id, spec.target)) return false
  const expected = {
    source_id: article.adapted_from_id,
    source_revision: spec.provenance?.source_revision,
    source_hash: spec.provenance?.source_hash,
    target_key: spec.target_key,
    target_hash: digest(canonical(spec.target)),
    draft_hash: digest(canonical({
      title: article.title,
      text: article.content,
      source_rights: spec.provenance?.rights,
      reading_analysis: spec.analysis,
    })),
  }
  if (!Object.entries(expected).every(([k, v]) => v && cert[k] === v) ||
      !Array.isArray(cert.reviews) || cert.reviews.length !== REVIEWERS.length ||
      cert.reviews.some(r => !r || typeof r !== 'object')) return false
  const exported = {
    adapted_from_id: parent.id,
    source_text: parent.content,
    reading: { source_revision: spec.provenance.source_revision, source_hash: spec.provenance.source_hash, target_key: spec.target_key, target: spec.target },
  }
  const draft = { title: article.title, text: article.content, source_text: parent.content,
    reading: { source_rights: spec.provenance.rights, reading_analysis: spec.analysis } }
  const checked = validateAgentReviews(draft, exported, cert.reviews.map(r => [r.review]))
  return checked.ok && canonical(checked.certificate) === canonical(cert)
}

export function canExportReadingItem(article, parent, type) {
  const spec = article?.composed_spec?.academic_reading
  return Boolean(spec && validateStoredAgentReview(article, parent) &&
    spec.target.passage_v_level === article.article_v_level &&
    readingSkillsForType(type, spec.target).length > 0)
}

export function readingReviewAllowsItem(article, parent, type) {
  return !(article?.source_id?.startsWith('reading:') || article?.composed_spec?.academic_reading) ||
    canExportReadingItem(article, parent, type)
}

export function normalizeReviewedLongBody(content) {
  return String(content ?? '').split(/\n\s*\n+/).map(normalizeSourceMarkup).join('\n\n')
}

export function reviewedPassageIsComplete(article, passage, type = null, parts = null) {
  if (!(article?.source_id?.startsWith('reading:') || article?.composed_spec?.academic_reading)) return true
  // 검수 후의 내용 삭제는 허용하지 않는다. 정제기(cleanPassageText/normalizeSourceMarkup)는
  // [12] 같은 실제 수치도 참조표시로 지울 수 있으므로 비교의 기준으로 쓰지 않는다.
  const compact = s => String(s ?? '').replace(/[‘’']/g, "'").replace(/[“”"]/g, '"').replace(/\s+/g, ' ').trim()
  if (type === 'long_order') {
    const sourceParts = String(article.content ?? '').split(/\n\s*\n+/).map(compact)
    if (sourceParts.length !== 4 || !Array.isArray(parts) || parts.length !== 4 ||
        parts.map(p => p.label).join() !== '(A),(B),(C),(D)' ||
        parts.some(p => typeof p.text !== 'string')) return false
    const shown = [parts[0].text, ...parts.slice(1).map(p => `${p.label}\n${p.text}`)].join('\n\n')
    return passage === shown && compact(parts[0].text) === sourceParts[0] &&
      parts.map(p => compact(p.text)).sort().join('\n') === sourceParts.sort().join('\n')
  }
  return compact(passage) === compact(article.content)
}

export function readingItemSourceFailure(row, original, source, parent, type, band) {
  const spec = source?.composed_spec?.academic_reading
  if (!spec || !row?.reading || !original?.reading) return 'reading source/export contract missing'
  if (!validateStoredAgentReview(source, parent)) return 'reading agent review or parent binding changed'
  if (!reviewedPassageIsComplete(source, original.passage, type, original.parts)) return 'reviewed passage was truncated'
  if (spec.version !== READING_ENGINE_VERSION || original.reading.version !== spec.version ||
      row.reading.version !== spec.version) return 'reading item version mismatch'
  if (!['ready','published'].includes(source.status) || source.article_v_level !== band ||
      spec.target.passage_v_level !== band) return 'reading source status/level changed'
  if (digest(source.content) !== original.reading.source_hash ||
      source.updated_at !== original.reading.source_revision) return 'reading source changed; export again'
  if (row.reading.source_hash !== original.reading.source_hash ||
      row.reading.source_revision !== original.reading.source_revision ||
      canonical(spec.target) !== canonical(original.reading.target)) return 'reading binding changed'
  return validateReadingPresentation(row, original.passage, type) ?? validateReadingItem({
    version: row.reading.version, target: row.reading.target, skill: row.reading.skill,
    passage_level: row.reading.passage_level, item_reasoning_level: row.reading.item_reasoning_level,
    item_difficulty: row.reading.item_difficulty, difficulty_evidence: row.reading.difficulty_evidence,
    evidence: row.reading.evidence,
  }, spec.target, type, original.passage, spec.analysis.passage_profile.overall_level.level)
}
