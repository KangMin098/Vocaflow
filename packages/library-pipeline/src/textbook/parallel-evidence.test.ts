// packages/library-pipeline/src/textbook/parallel-evidence.test.ts
import { describe, expect, it, vi } from 'vitest'
import { acquirePrecisionFullText, acquirePrecisionMetadata, selectPrecisionAbstract } from './parallel-evidence'

const doi = '10.3389/fpsyg.2019.02246'
const xml = `<article><front><article-id pub-id-type="doi">${doi}</article-id></front><body><p>Research evidence.</p></body></article>`
const response = (raw: string, status = 200) => ({ ok: status === 200, status, text: async () => raw })
describe('precision evidence recovery', () => {
  it('still acquires EPMC full-text evidence when Crossref times out', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('Crossref timeout')).mockResolvedValueOnce(response(JSON.stringify({ resultList: { result: [{ doi, pmcid: 'PMC12345', abstractText: 'EPMC abstract.' }] } }))).mockResolvedValueOnce(response(xml))
    const metadata = await acquirePrecisionMetadata(doi, get)
    expect(metadata.crossref).toBeNull()
    expect(metadata.epmc?.record.pmcid).toBe('PMC12345')
    const result = await acquirePrecisionFullText(doi, ['epmc'], get)
    expect(result.evidence?.text).toBe('Research evidence.')
    expect(metadata.attempts.join()).toContain('Crossref timeout')
    expect(get).toHaveBeenCalledTimes(3)
  })
  it('rejects mismatched metadata without skipping the other provider', async () => {
    const get = vi.fn().mockResolvedValueOnce(response(JSON.stringify({ message: { DOI: '10.1038/srep29517', abstract: 'Wrong abstract.' } }))).mockResolvedValueOnce(response(JSON.stringify({ resultList: { result: [{ doi, abstractText: 'Right abstract.' }] } })))
    const result = await acquirePrecisionMetadata(doi, get)
    expect(result.crossref).toBeNull()
    expect(selectPrecisionAbstract(result.epmc?.record.abstractText, result.crossref?.record.abstract)?.text).toBe('Right abstract.')
    expect(result.attempts.join()).toContain('DOI mismatch')
  })
  it('binds a Crossref fallback abstract to Crossref even when EPMC has a record', () => {
    expect(selectPrecisionAbstract(undefined, '<jats:p>Crossref abstract.</jats:p>')).toEqual({ provider: 'crossref', text: 'Crossref abstract.' })
    expect(selectPrecisionAbstract(' ', '<p>Crossref abstract.</p>')?.provider).toBe('crossref')
    expect(selectPrecisionAbstract('<p>EPMC abstract.</p>', '<p>Crossref abstract.</p>')?.provider).toBe('epmc')
    expect(selectPrecisionAbstract('', undefined)).toBeNull()
  })
  it('continues to publisher XML after the first full-text endpoint times out', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(response(xml))
    const result = await acquirePrecisionFullText(doi, ['epmc', 'publisher'], get)
    expect(result.evidence).toEqual({ url: 'publisher', raw: xml, text: 'Research evidence.' })
    expect(result.attempts.join()).toContain('timeout')
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('returns an absent full text for abstract fallback after network/body failures', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true, status: 200, text: async () => { throw new Error('broken stream') } })
    const result = await acquirePrecisionFullText(doi, ['epmc', 'publisher'], get)
    expect(result.evidence).toBeNull()
    expect(result.attempts).toHaveLength(2)
  })
  it('rejects successful responses containing another DOI or an empty body', async () => {
    const get = vi.fn().mockResolvedValueOnce(response(xml.replace(doi, '10.1038/srep29517'))).mockResolvedValueOnce(response(xml.replace('Research evidence.', ''))).mockResolvedValueOnce(response(xml))
    const result = await acquirePrecisionFullText(doi, ['wrong', 'empty', 'matching'], get)
    expect(result.evidence?.url).toBe('matching')
    expect(result.attempts).toHaveLength(2)
  })
})
