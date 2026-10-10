// packages/library-pipeline/src/textbook/parallel-evidence.ts
import { htmlToPlainText } from '../ingest-article/_helpers'
import { normalizeResearchDoi } from '../ingest-article/research-origin'

type EvidenceGet = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>
type CrossrefRecord = { DOI: string; title?: string[]; author?: { given?: string; family?: string }[]; abstract?: string; 'container-title'?: string[]; type?: string; URL?: string }
type EpmcRecord = { doi: string; pmcid?: string; abstractText?: string }

/** Metadata providers fail independently; a bibliographic hold must not imply no body access. */
export async function acquirePrecisionMetadata(doi: string, get: EvidenceGet) {
  const attempts: string[] = []
  const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`
  const epmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`DOI:"${doi}"`)}&format=json&resultType=core`
  let crossref: { record: CrossrefRecord; raw: string; url: string } | null = null
  let epmc: { record: EpmcRecord; raw: string; url: string } | null = null
  try {
    const response = await get(crossrefUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const raw = await response.text()
    const record = JSON.parse(raw).message as CrossrefRecord | undefined
    if (typeof record?.DOI !== 'string' || normalizeResearchDoi(record.DOI) !== doi) throw new Error('DOI mismatch')
    crossref = { record, raw, url: crossrefUrl }
  } catch (error) { attempts.push(`Crossref: ${error instanceof Error ? error.message : String(error)}`) }
  try {
    const response = await get(epmcUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const raw = await response.text()
    const records = JSON.parse(raw).resultList?.result as EpmcRecord[] | undefined
    const record = records?.find((r) => typeof r.doi === 'string' && normalizeResearchDoi(r.doi) === doi)
    if (record) epmc = { record, raw, url: epmcUrl }
  } catch (error) { attempts.push(`Europe PMC search: ${error instanceof Error ? error.message : String(error)}`) }
  return { crossref, epmc, attempts }
}

export function selectPrecisionAbstract(epmcAbstract: string | null | undefined, crossrefAbstract: string | null | undefined) {
  for (const [provider, raw] of [['epmc', epmcAbstract], ['crossref', crossrefAbstract]] as const) {
    const text = typeof raw === 'string' ? htmlToPlainText(raw) : ''
    if (text.trim()) return { provider, text }
  }
  return null
}

/** Candidate failures do not skip later publishers or the caller's abstract fallback. */
export async function acquirePrecisionFullText(doi: string, urls: string[], get: EvidenceGet) {
  const attempts: string[] = []
  for (const url of urls) {
    let raw: string
    try {
      const response = await get(url)
      if (!response.ok) { attempts.push(`Full text ${response.status}: ${url}`); continue }
      raw = await response.text()
    } catch (error) {
      attempts.push(`Full text error: ${url}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const front = raw.match(/<front\b[^>]*>([\s\S]*?)<\/front>/i)?.[1] ?? ''
    const headerDoi = [...front.matchAll(/<article-id\b[^>]*pub-id-type=["']doi["'][^>]*>([\s\S]*?)<\/article-id>/gi)].map((m) => normalizeResearchDoi(htmlToPlainText(m[1]!)))
    const body = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    if (!headerDoi.includes(doi) || !body) { attempts.push(`JATS DOI/body missing or mismatched: ${url}`); continue }
    const text = htmlToPlainText(body)
    if (!text.trim()) { attempts.push(`Empty extracted body: ${url}`); continue }
    return { evidence: { url, raw, text }, attempts }
  }
  return { evidence: null, attempts }
}
