// scripts/textbook/__tests__/corpus-pilot-import.test.mjs
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { evaluateSource } from '../../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { normalizedTextHash } from '../../lib/corpus-dedup.mjs'
import { SYNTAX_PROBES, repositorySyntaxProbe } from '../../audit/csat-corpus-pilot-analyze.mjs'
import { assertFresh, selectPilotCandidates, preparePilotRow, verifyRawAttribution,
  prepareRegistryProfile, importCorpusPilot, PILOT_IDS } from '../../acp/import-corpus-pilot.mjs'

const NOW = '2026-09-19T01:00:00.000Z'
const hash = value => createHash('sha256').update(value).digest('hex')
function fixture(id = PILOT_IDS[0]) {
  const content = Array(20).fill('The child walked to school.').join(' ')
  const raw = `# A school walk\n\n##\n${content}\n\n##\n* License: [CC-BY]\n* Text: Story Author\n* Language: en\n`
  const article = { source: 'african_storybook', source_id: id, title: 'A school walk', author: 'Story Author',
    content, content_hash: hash(content), raw_hash: hash(raw), fetched_at: NOW,
    source_url: `https://github.com/global-asp/asp-source/blob/${'b'.repeat(40)}/en/${id.split(':')[1]}_a-school-walk.md`,
    origin_url: 'http://africanstorybook.org/stories/a-school-walk', license: 'CC-BY-3.0',
    license_url: 'https://creativecommons.org/licenses/by/3.0/', metadata: { commit: 'b'.repeat(40) } }
  const review = { source_id: id, contentHash: article.content_hash, verdict: 'narrative', genre: 'school story',
    register: 'narrative', topic: 'education', ageFit: ['elementary', 'middle'], learningPurposes: ['gist', 'detail'],
    quality: 'clean', reason: 'A complete school journey.', attributionVerified: true }
  const input = { title: article.title, status: 'ready', articleVLevel: 2, wordCount: 120, register: 'narrative',
    cefrLevel: 'A2', syntaxScore: 12, displayOnly: false, licenseClass: 'cc_by', copyrightSafeInKr: null,
    gatePublishable: true, gateBlockedBy: null, gateVerdict: 'narrative', gateGenre: review.genre,
    gatePurpose: 'csat', excerptWindows: 0, hasItems: false, outsidePct: null }
  const analysis = { source: article.source, source_id: id, contentHash: article.content_hash,
    normalizedContentHash: article.content_hash, contentReview: structuredClone(review),
    vrl: { p75: 2 }, cefr: { level: 'A2' }, syntax: { score: 12 }, canonicalPreviewInput: input,
    canonicalPreview: evaluateSource(input), usageBlockers: ['local_pilot_not_imported'] }
  const duplicate = { source_id: id, contentHash: article.content_hash, normalizedHash: normalizedTextHash(content),
    storedHashMatches: [], bodyMatches: [], titleMatches: [], urlMatches: [], pilotMatches: [] }
  const files = Object.fromEntries(['articles','analysis','review','dedup'].map(name => [name, { sha256: hash(name), modifiedAt: NOW }]))
  const bundle = { articles: [article], reviews: [review], files,
    analysis: { readOnly: true, measuredAt: NOW, rows: [analysis],
      syntaxProbes: SYNTAX_PROBES.map(([id, text]) => ({ id, text, differs: false })) },
    dedup: { readOnly: true, measuredAt: NOW, results: [duplicate], limitations: ['Bounded body comparison.'] },
    profileEvidence: { candidate: { source: 'african_storybook', role: 'GAP FILLER', automaticIngestion: false },
      metrics: { source: 'african_storybook', reviewed: 49 }, measuredAt: NOW, files: [] } }
  return { bundle, article, review, analysis, duplicate, raw }
}

function database(rows = []) {
  const state = { rows: structuredClone(rows), registry: { source: 'african_storybook', profile: null },
    insertCalls: [], updates: [], rpcCalls: [], errors: {} }
  const db = {
    from(table) {
      const call = { table, op: 'select', predicates: [], body: null }
      const q = {
        select() { return q }, order() { return q }, limit() { return q },
        eq(key, value) { call.predicates.push([key, value]); return q },
        is(key, value) { call.predicates.push([key, value]); return q },
        in(key, values) { call.predicates.push([key, values]); return q },
        gt() { return q },
        ilike(key, value) { call.predicates.push([key, value]); return q },
        insert(body) { call.op = 'insert'; call.body = body; return q },
        update(body) { call.op = 'update'; call.body = body; return q },
        single() { return execute(true) },
        then(resolve, reject) { return execute(false).then(resolve, reject) },
      }
      async function execute(single) {
        if (table === 'csat_source_registry') {
          if (state.errors.registry) return { data: null, error: { message: state.errors.registry } }
          if (call.op === 'update') {
            if (state.errors.profile) return { data: null, error: { message: state.errors.profile } }
            state.updates.push(call); state.registry.profile = call.body.profile
          }
          return { data: single ? structuredClone(state.registry) : [structuredClone(state.registry)], error: null }
        }
        if (table !== 'library_articles') throw new Error(`Unexpected table ${table}`)
        if (call.op === 'insert') {
          state.insertCalls.push(call)
          if (state.errors.insert) return { data: null, error: { code: '23505', message: state.errors.insert } }
          const inserted = call.body.map((row, i) => ({ id: `new-${i}`, ...row }))
          state.rows.push(...inserted)
          return { data: inserted.map(({ id, source_id, status }) => ({ id, source_id, status })), error: null }
        }
        if (call.op !== 'select') throw new Error('Existing articles must never be updated')
        if (state.errors.lookup) return { data: null, error: { message: state.errors.lookup } }
        return { data: state.rows.filter(row => call.predicates.every(([key, value]) =>
          Array.isArray(value) ? value.includes(row[key]) : key === 'title' ? row.title?.toLowerCase() === value.toLowerCase() : row[key] === value)), error: null }
      }
      return q
    },
    async rpc(name, args) {
      state.rpcCalls.push(name)
      if (name !== 'compute_syntax_score') throw new Error('Mutation RPC forbidden')
      const score = repositorySyntaxProbe(args.p_content)
      return { data: state.errors.drift ? { ...score, score: 100 } : score, error: null }
    },
  }
  return { db, state }
}

describe('corpus pilot evidence and pure selection', () => {
  it('prepares queued source and preserves provenance without analysis/publication fields', () => {
    const { bundle, article } = fixture()
    const selected = selectPilotCandidates(bundle, NOW)
    expect(selected.candidates).toHaveLength(1)
    const row = selected.candidates[0].row
    expect(row).toMatchObject({ status: 'queued', content: article.content, language: 'en', license_class: 'cc_by',
      source_fetched_at: NOW, copyright_safe_in_kr: true, display_only: false })
    expect(row.csat_fit.source_discovery).toMatchObject({ rawHash: article.raw_hash, contentHash: article.content_hash,
      fetchedAt: NOW, originUrl: article.origin_url, pinnedCommit: article.metadata.commit })
    for (const key of ['article_v_level', 'cefr_level', 'syntax_score', 'word_count', 'published_at', 'content_hash']) expect(row).not.toHaveProperty(key)
    expect(row.csat_fit.gate).toMatchObject({ publishable: true, verdict: 'narrative', purpose: 'csat' })
    expect(row.csat_fit.source_discovery.review).toMatchObject({ ageFit: ['elementary', 'middle'], topic: 'education',
      learningPurposes: ['main_point', 'content_match'] })
  })
  it('verifies the actual raw document author, body, license and index', () => {
    const { article, raw } = fixture()
    const line = `0136 | [Title](${article.origin_url}) | [CC-BY](${article.license_url})`
    expect(() => verifyRawAttribution(article, raw, line)).not.toThrow()
    expect(() => verifyRawAttribution({ ...article, author: 'Wrong' }, raw, line)).toThrow(/attribution/)
    expect(() => verifyRawAttribution(article, raw + 'changed', line)).toThrow(/Raw hash/)
    expect(() => verifyRawAttribution(article, raw, line.replace('CC-BY]', 'CC-BY-NC]'))).toThrow(/attribution/)
  })
  it.each(['articles','analysis','review','dedup'])('rejects stale %s file evidence', key => {
    const { bundle } = fixture(); bundle.files[key].modifiedAt = '2026-09-17T00:00:00Z'
    expect(() => selectPilotCandidates(bundle, NOW)).toThrow(/24 hours/)
  })
  it('rejects future-dated evidence and stale content/review/dedup revisions', () => {
    expect(() => assertFresh('2026-09-20T00:00:00Z', NOW, 'test')).toThrow(/future/)
    for (const target of ['article','analysis','review','duplicate']) {
      const f = fixture()
      if (target === 'article') f.article.content += ' changed'
      else f[target].contentHash = 'a'.repeat(64)
      expect(() => selectPilotCandidates(f.bundle, NOW)).toThrow(/hash|Stale/)
    }
  })
  it.each(['unknown-rights','nonclean','review','noneligible','unpinned'])('skips %s without expanding the pilot', problem => {
    const f = fixture()
    if (problem === 'unknown-rights') f.review.attributionVerified = false
    if (problem === 'nonclean') f.review.quality = 'needs_context'
    if (problem === 'review') f.review.verdict = 'review'
    if (problem === 'noneligible') f.analysis.canonicalPreview.status = 'rejected'
    if (problem === 'unpinned') f.article.source_url = 'https://github.com/global-asp/asp-source/blob/master/en/story.md'
    f.analysis.contentReview = structuredClone(f.review)
    const result = selectPilotCandidates(f.bundle, NOW)
    expect(result.candidates).toHaveLength(0); expect(result.skipped).toHaveLength(1)
  })
  it.each(['storedHashMatches','bodyMatches','pilotMatches','titleMatches','urlMatches'])('holds or skips existing %s evidence', key => {
    const { bundle, duplicate } = fixture(); duplicate[key] = [{ id: 'existing', normalizedExact: key !== 'titleMatches' }]
    const result = selectPilotCandidates(bundle, NOW)
    expect(result.candidates).toHaveLength(0)
    expect(result.skipped[0].reason).toMatch(/duplicate/)
    if (key === 'titleMatches') expect(result.skipped[0].reason).toContain('review')
  })
  it('fails closed when a newly eligible ID exceeds the fixed scope', () => {
    const { bundle } = fixture('african_storybook:0001')
    expect(() => selectPilotCandidates(bundle, NOW)).toThrow(/four-story scope/)
  })
  it('merges only the source profile and metrics, preserving existing unrelated keys', () => {
    const { bundle } = fixture()
    const profile = prepareRegistryProfile({ curatorNote: 'keep' }, bundle.profileEvidence, 1, NOW)
    expect(profile).toMatchObject({ curatorNote: 'keep', source: 'african_storybook', measuredMetrics: { currentlyImported: 1 } })
    expect(profile).not.toHaveProperty('rows')
    expect(() => prepareRegistryProfile(null, { ...bundle.profileEvidence,
      metrics: { ...bundle.profileEvidence.metrics, content: 'Do not store this source text.' } }, 1, NOW)).toThrow(/Raw text/)
  })
})

describe('corpus pilot I/O guards', () => {
  it('default dry-run performs no INSERT, registry UPDATE, or RPC', async () => {
    const { bundle } = fixture(), { db, state } = database()
    const result = await importCorpusPilot({ db, bundle, now: NOW })
    expect(result.planned).toHaveLength(1)
    expect(state.insertCalls).toHaveLength(0); expect(state.updates).toHaveLength(0); expect(state.rpcCalls).toHaveLength(0)
  })
  it('enqueues once then preserves the entire existing row on retry', async () => {
    const { bundle } = fixture(), { db, state } = database()
    await importCorpusPilot({ db, bundle, now: NOW, commit: true })
    const before = structuredClone(state.rows[0])
    state.rows[0].status = 'published'; state.rows[0].csat_fit.unrelated = { answer: 2 }
    const preserved = structuredClone(state.rows[0])
    const retry = await importCorpusPilot({ db, bundle, now: NOW, commit: true })
    expect(before.status).toBe('queued'); expect(state.rows[0]).toEqual(preserved)
    expect(state.insertCalls).toHaveLength(1); expect(retry.inserted).toHaveLength(0)
    expect(retry.skipped.some(s => s.reason === 'already_exists_preserved')).toBe(true)
  })
  it('never overwrites existing source/id body A with collected body B', async () => {
    const { bundle, article } = fixture()
    const existing = { id: 'old', source: article.source, source_id: article.source_id, content: 'Body A', status: 'published', csat_fit: { answer: 3 } }
    const { db, state } = database([existing])
    const result = await importCorpusPilot({ db, bundle, now: NOW, commit: true })
    expect(state.rows).toEqual([existing]); expect(state.insertCalls).toHaveLength(0)
    expect(result.skipped).toContainEqual({ source_id: article.source_id, reason: 'already_exists_preserved', articleId: 'old', bodyChanged: true })
  })
  it.each(['hash','normalized','title'])('blocks a live %s duplicate', async kind => {
    const { bundle, article } = fixture()
    const existing = { id: 'old', source: kind === 'normalized' ? 'storyweaver' : 'original', source_id: 'other',
      content: kind === 'normalized' ? article.content.toUpperCase() : 'Different content',
      content_hash: kind === 'hash' ? article.content_hash : null, title: kind === 'title' ? article.title : 'Different' }
    const { db, state } = database([existing])
    const result = await importCorpusPilot({ db, bundle, now: NOW, commit: true })
    expect(result.planned).toHaveLength(0); expect(state.insertCalls).toHaveLength(0)
    if (kind === 'title') expect(result.skipped[0].reason).toContain('review')
  })
  it('blocks old analysis drift before any write, while keeping a dry-run plan', async () => {
    const { bundle, analysis } = fixture(); analysis.usageBlockers.push('live_syntax_definition_drift')
    const { db, state } = database()
    expect((await importCorpusPilot({ db, bundle, now: NOW })).planned).toHaveLength(1)
    await expect(importCorpusPilot({ db, bundle, now: NOW, commit: true })).rejects.toThrow(/held/)
    expect(state.insertCalls).toHaveLength(0)
  })
  it.each(['registry','drift','lookup'])('fails before insert on %s preflight failure', async failure => {
    const { bundle } = fixture(), { db, state } = database(); state.errors[failure] = 'unavailable'
    await expect(importCorpusPilot({ db, bundle, now: NOW, commit: true })).rejects.toThrow()
    expect(state.insertCalls).toHaveLength(0)
  })
  it('surfaces concurrent insertion failure without updating any article or profile', async () => {
    const { bundle } = fixture(), { db, state } = database(); state.errors.insert = 'concurrent source key'
    await expect(importCorpusPilot({ db, bundle, now: NOW, commit: true })).rejects.toThrow(/rerun discovery/)
    expect(state.rows).toHaveLength(0); expect(state.updates).toHaveLength(0)
  })
  it('recovers profile failure by retrying without reinserting the queued article', async () => {
    const { bundle } = fixture(), { db, state } = database(); state.errors.profile = 'temporary error'
    await expect(importCorpusPilot({ db, bundle, now: NOW, commit: true })).rejects.toThrow(/remain queued/)
    expect(state.rows[0].status).toBe('queued')
    delete state.errors.profile
    const retry = await importCorpusPilot({ db, bundle, now: NOW, commit: true })
    expect(retry.profileUpdated).toBe(true); expect(state.insertCalls).toHaveLength(1)
  })
})
