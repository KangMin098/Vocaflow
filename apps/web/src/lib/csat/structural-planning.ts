// apps/web/src/lib/csat/structural-planning.ts
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sealProductOrder } from '@vocaflow/library-pipeline/factory-order'
import { canonicalJson } from '@vocaflow/library-pipeline'

const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex')
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const fail = (code: string): never => { throw new Error(code) }

type RecordValue = Record<string, unknown>
const object = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : fail('STRUCTURAL_DATA_INVALID')
const array = (value: unknown): RecordValue[] => Array.isArray(value) ? value.map(object) : fail('STRUCTURAL_DATA_INVALID')
const content = async (dir: string, name: string) => JSON.parse(await readFile(path.join(dir, name), 'utf8')) as unknown
const currentFileHash = async (filePath: unknown) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) fail('STRUCTURAL_SOURCE_PATH_INVALID')
  return sha(await readFile(filePath as string))
}
const bodyWithoutHash = (value: RecordValue, key: string) => {
  const copy = { ...value }
  delete copy[key]
  return copy
}

export type StructuralPlanningProfile = {
  source_id: string
  profile_hash: string
  format: string
  word_count: number
  sentence_count: number
  median_sentence_words: number
  text_block_count: number
  heading_count: number
  list_item_count: number
  discourse_cues: Record<string, number>
}

export async function loadStructuralPlanningCatalog(dir: string) {
  if (!path.isAbsolute(dir)) fail('STRUCTURAL_DIRECTORY_INVALID')
  const input = object(await content(dir, 'role-screen-r1.input.json'))
  const screen = object(await content(dir, 'role-screen-r1.out.json'))
  const specs = array(await content(dir, 'structural-spec-r2.json'))
  const corpus = object(await content(dir, 'structural-corpus-r3.json'))
  if (input.schema !== 'reference-role-screen-input/1' ||
      screen.schema !== 'reference-role-screen/1' || screen.input_hash !== digest(input) ||
      screen.screen_hash !== digest(bodyWithoutHash(screen, 'screen_hash')) ||
      corpus.schema !== 'structural-reference-corpus/1' ||
      corpus.corpus_hash !== digest(bodyWithoutHash(corpus, 'corpus_hash')) ||
      corpus.role_screen_hash !== screen.screen_hash || corpus.calibration_eligible_n !== 0 ||
      corpus.grade_distribution_n !== 0 || corpus.benchmark_target_fit !== 'unopened' ||
      corpus.benchmark_level_separation !== 'unopened') fail('STRUCTURAL_CHAIN_INVALID')
  const sources = array(input.candidates).map(row => object(row.structural))
  const decisions = array(screen.decisions)
  const eligible = decisions.filter(row => row.structural_reference === 'eligible')
  const selected = array(screen.structural_corpus)
  const profiles = array(corpus.profiles)
  if (screen.source_count !== sources.length || decisions.length !== sources.length ||
      screen.calibration_eligible_n !== 0 || screen.grade_distribution_n !== 0 ||
      new Set(sources.map(row => row.source_id)).size !== sources.length ||
      new Set(decisions.map(row => row.source_id)).size !== decisions.length ||
      new Set(profiles.map(row => row.source_id)).size !== profiles.length ||
      profiles.length !== eligible.length || profiles.length !== selected.length ||
      profiles.length !== specs.length ||
      screen.structural_eligible_n !== profiles.length || corpus.profile_count !== profiles.length)
    fail('STRUCTURAL_SET_INVALID')
  const publicProfiles: StructuralPlanningProfile[] = []
  for (const profile of profiles) {
    const source = sources.find(row => row.source_id === profile.source_id)
    const decision = decisions.find(row => row.source_id === profile.source_id)
    const selectedRow = selected.find(row => row.source_id === profile.source_id)
    const spec = specs.find(row => row.source_id === profile.source_id)
    if (!source || !decision || !spec || !selectedRow) throw new Error('STRUCTURAL_PROFILE_INVALID')
    if (source.rights_scope !== 'authorized_internal_analysis' ||
        selectedRow.source_hash !== source.source_hash ||
        selectedRow.decision_hash !== decision.decision_hash ||
        decision.structural_reference !== 'eligible' ||
        decision.decision_hash !== digest(bodyWithoutHash(decision, 'decision_hash')) ||
        decision.structural_evidence_hash !== digest(source) ||
        decision.source_hash !== source.source_hash ||
        decision.rights_evidence_hash !== source.rights_evidence_hash ||
        profile.profile_hash !== digest(bodyWithoutHash(profile, 'profile_hash')) ||
        profile.role_decision_hash !== decision.decision_hash ||
        profile.source_hash !== source.source_hash || profile.excerpt_hash !== spec.excerpt_hash ||
        !hex(profile.profile_hash)) fail('STRUCTURAL_PROFILE_INVALID')
    if (await currentFileHash(source.source_path) !== source.source_hash ||
        await currentFileHash(source.rights_evidence_path) !== source.rights_evidence_hash)
      fail('STRUCTURAL_SOURCE_CHANGED')
    const html = await readFile(source.source_path as string, 'utf8')
    if (typeof spec.start_marker !== 'string' || typeof spec.end_marker !== 'string' ||
        !spec.start_marker || !spec.end_marker) fail('STRUCTURAL_LOCATOR_INVALID')
    const startMarker = spec.start_marker as string
    const endMarker = spec.end_marker as string
    const start = html.indexOf(startMarker)
    const end = html.indexOf(endMarker, start + startMarker.length)
    if (start < 0 || end <= start || html.indexOf(startMarker, start + 1) >= 0 ||
        sha(html.slice(start, end)) !== spec.excerpt_hash) fail('STRUCTURAL_EXCERPT_CHANGED')
    if (profile.measurement_scope !== 'non_grade_structure_only' ||
        !['article', 'storybook'].includes(String(profile.format)) ||
        ![profile.word_count, profile.sentence_count, profile.median_sentence_words,
          profile.text_block_count, profile.heading_count, profile.list_item_count]
          .every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0))
      fail('STRUCTURAL_PROFILE_INVALID')
    const cues = object(profile.discourse_cues)
    if (Object.values(cues).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0))
      fail('STRUCTURAL_PROFILE_INVALID')
    publicProfiles.push({ source_id: String(profile.source_id), profile_hash: profile.profile_hash as string,
      format: String(profile.format), word_count: profile.word_count as number,
      sentence_count: profile.sentence_count as number,
      median_sentence_words: profile.median_sentence_words as number,
      text_block_count: profile.text_block_count as number, heading_count: profile.heading_count as number,
      list_item_count: profile.list_item_count as number, discourse_cues: cues as Record<string, number> })
  }
  return { schema: 'structural-planning-catalog/1' as const, corpus_hash: corpus.corpus_hash as string,
    profiles: publicProfiles, calibration_eligible_n: 0 as const, grade_distribution_n: 0 as const }
}

export function planProductOrderStructure(orderInput: unknown,
  catalog: Awaited<ReturnType<typeof loadStructuralPlanningCatalog>>, selectedIds: unknown) {
  const { order, order_hash } = sealProductOrder(orderInput)
  if (!Array.isArray(selectedIds) || selectedIds.some(id => typeof id !== 'string') ||
      new Set(selectedIds).size !== selectedIds.length ||
      selectedIds.some(id => !catalog.profiles.some(profile => profile.source_id === id)))
    fail('STRUCTURAL_SELECTION_INVALID')
  const selected = catalog.profiles.filter(profile => (selectedIds as string[]).includes(profile.source_id))
  const body = { schema: 'product-order-structural-planning/1',
    product_order_id: order.product_order_id, order_revision: order.order_revision,
    order_hash, structural_corpus_hash: catalog.corpus_hash,
    selection: selected.length ? 'adopted' : 'ignored',
    profile_hashes: selected.map(profile => profile.profile_hash),
    binding: 'advisory_only', target_fit_evidence: false,
    level_separation_evidence: false, gold_s_evidence: false }
  return { ...body, note_hash: digest(body) }
}
