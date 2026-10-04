// packages/library-pipeline/src/ingest-article/research-origin.test.ts
import { describe, expect, it } from 'vitest'
import { frymFullTextContainer, frymFullTextContent } from './frontiers-young-minds'
import { articleResearchOrigin, extractFrymResearchOrigin, normalizeResearchDoi, researchBodyHash, validateResearchOrigin } from './research-origin'
import { ensureOriginal } from '../../../../scripts/textbook/_originals.mjs'

const url = 'https://kids.frontiersin.org/articles/10.3389/frym.2021.556361/full'
const checkedAt = '2026-10-04T00:00:00Z'
const now = Date.parse(checkedAt)
const prose = 'Microbes can remove methane from the air in drylands.'
const original = '<h6>Original Source Article</h6><p>Lafuente et al. 2019. Global drivers. doi: 10.1111/GEB.12928</p>'
const references = '<h6>References</h6><p>Other citation doi: 10.1000/reference.1</p>'
const page = (tail: string, metaUrl = url) => `<meta property="og:url" content="${metaUrl}"><div class="fulltext-content"><p>${prose}</p>${tail}</div>`
const extract = (html: string) => extractFrymResearchOrigin({ html, container: frymFullTextContainer(html), studentUrl: url, body: frymFullTextContent(html), checkedAt })
const origin = extract(page(original + references))

describe('FYM publisher-declared original research', () => {
  it('captures the original research while keeping references outside learning prose', () => {
    expect(origin.relations.map((r) => r.original_work_id)).toEqual(['10.1111/geb.12928'])
    expect(origin.section_text).toContain('Lafuente')
    expect(origin.section_text).not.toContain('reference.1')
    expect(frymFullTextContent(page(original + references))).toBe(prose)
    expect(origin.body_hash).toBe(researchBodyHash(prose))
  })
  it('does not turn ordinary references into original research', () => {
    expect(extract(page(references))).toMatchObject({ status: 'no_explicit_original_source', relations: [], section_text: '' })
  })
  it('supports multiple explicit originals and deduplicates DOI case', () => {
    const tail = '<h6><strong>Original Source Articles</strong></h6><p>doi: 10.1111/GEB.12928. doi: 10.1000/second. doi: 10.1111/geb.12928.</p>'
    expect(extract(page(tail + references)).relations.map((r) => r.original_work_id)).toEqual(['10.1111/geb.12928', '10.1000/second'])
  })
  it('rejects its own and other FYM student DOI as a research original', () => {
    expect(extract(page('<h6>Original Source Article</h6><p>doi: 10.3389/frym.2021.556361. doi: 10.3389/frym.2020.00110</p>')).status).toBe('original_source_without_doi')
  })
  it('preserves an explicit citation without DOI as a hold, not a guessed pair', () => {
    const result = extract(page('<h6>Original Source Article</h6><p>An author and book citation without an identifier.</p>'))
    expect(result.status).toBe('original_source_without_doi')
    expect(result.section_text).toContain('book citation')
  })
  it('requires the actual page URL and a complete body container', () => {
    expect(() => extract(page(original, url.replace('556361', '999999')))).toThrow(/disagrees/)
    expect(() => extract('<meta property="og:url" content="' + url + '">')).toThrow(/missing/)
    expect(() => extract(page(original).replace('og:url', 'og:title'))).toThrow(/disagrees/)
  })
  it('normalizes resolver DOI strings but rejects arbitrary URLs and labels', () => {
    expect(normalizeResearchDoi('https://doi.org/10.1111/GEB.12928.')).toBe('10.1111/geb.12928')
    expect(normalizeResearchDoi('https://example.com/10.1111/geb.12928')).toBeNull()
    expect(normalizeResearchDoi('some unrelated title')).toBeNull()
  })
  it('removes citation wrapper parentheses while preserving valid DOI parentheses', () => {
    expect(extract(page('<h6>Original Source Article</h6><p>Author 2019. Study (doi: 10.1111/GEB.12928).</p>')).relations[0]?.original_work_id).toBe('10.1111/geb.12928')
    expect(normalizeResearchDoi('(10.1111/geb.12928)')).toBeNull()
    expect(normalizeResearchDoi('10.1000/abc(def)')).toBe('10.1000/abc(def)')
    expect(normalizeResearchDoi('10.1000/abc(def)).')).toBe('10.1000/abc(def)')
  })
  it('binds evidence to current body/URL and rejects future clocks', () => {
    expect(validateResearchOrigin(origin, url, prose, now)).toEqual(origin)
    expect(validateResearchOrigin(origin, url, `${prose} Changed.`, now)).toBeNull()
    expect(validateResearchOrigin(origin, url.replace('556361', '999999'), prose, now)).toBeNull()
    expect(validateResearchOrigin({ ...origin, checked_at: '2026-10-05T00:00:00Z' }, url, prose, now)).toBeNull()
  })
  it('rejects invented citation evidence and mismatching research resolver', () => {
    const relation = origin.relations[0]!
    expect(validateResearchOrigin({ ...origin, relations: [{ ...relation, evidence: 'Invented evidence 10.1111/geb.12928' }] }, url, prose, now)).toBeNull()
    expect(validateResearchOrigin({ ...origin, relations: [{ ...relation, research_url: 'https://example.com' }] }, url, prose, now)).toBeNull()
  })
  it('attaches only to complete FYM bodies and never to excerpts', () => {
    const article = { source: 'frym', source_url: url, content: prose, research_origin: origin, fetched_at: new Date(checkedAt) }
    expect(articleResearchOrigin(article)).toEqual({ research_origin: origin })
    expect(() => articleResearchOrigin({ ...article, content: 'A shorter excerpt.' })).toThrow(/not bound/)
    expect(() => articleResearchOrigin({ ...article, source: 'frontiers' })).toThrow(/not bound/)
  })
  it('inserts a new source with rights and origin without changing its content', async () => {
    let inserted: Record<string, unknown> | undefined
    const db = { from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      insert: (row: Record<string, unknown>) => { inserted = row; return { select: () => ({ single: async () => ({ data: { id: 'new-original' }, error: null }) }) } },
    }) }
    const article = { source: 'frym', source_id: 'frym:10.3389/frym.2021.556361', source_url: url, content: prose, title: 'Methane', license: 'CC-BY-4.0', published_at: null, fetched_at: new Date(checkedAt), research_origin: origin }
    await ensureOriginal(db, { article, sourceId: article.source_id.replace('frym:', 'frym-full:') }, { commit: true })
    expect(inserted?.content).toBe(prose)
    expect(inserted?.csat_fit).toMatchObject({ rights: { attribution: { url } }, research_origin: origin })
  })
})
