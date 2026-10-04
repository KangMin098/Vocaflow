// packages/library-pipeline/src/textbook/parallel-evidence.ts
import { htmlToPlainText } from '../ingest-article/_helpers'
import { normalizeResearchDoi } from '../ingest-article/research-origin'

export function selectPrecisionAbstract(epmcAbstract: string | null | undefined, crossrefAbstract: string | null | undefined) {
  for (const [provider, raw] of [['epmc', epmcAbstract], ['crossref', crossrefAbstract]] as const) {
    const text = typeof raw === 'string' ? htmlToPlainText(raw) : ''
    if (text.trim()) return { provider, text }
  }
  return null
}

/** Candidate failures do not skip later publishers or the caller's abstract fallback. */
export async function acquirePrecisionFullText(doi: string, urls: string[], get: (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>) {
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
