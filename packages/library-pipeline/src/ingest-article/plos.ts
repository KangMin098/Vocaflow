// packages/library-pipeline/src/ingest-article/plos.ts
// ACP §18 — PLOS (Public Library of Science) ingester.
//
// PLOS = CC-BY 오픈액세스 과학 저널(HTML 서버렌더). 킬러급 학술 산문(C2) — S4 심화 다독.
// 라이선스: CC BY 4.0 (본문 명시) → license_class=cc_by → 발행 허용.
// 본문 추출: abstract + article-text 산문. figures/tables/References/Supporting info + 인용 상첨자 제거
//   (methods/stats 노이즈 → lexical_noise 게이트가 초과분 read-only 처리). 의존성 0 정규식.
//
// URL: https://journals.plos.org/<journal>/article?id=<doi>  (예: 10.1371/journal.pbio.3002946)
// source_id: "plos:<doi>"

import type { RawArticle } from '../types-article'

import { decodeEntities, extractFirst, fetchWithTimeout, htmlToPlainText, safeDate } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

export interface PlosListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

const SOLR = 'https://api.plos.org/search'

interface SolrDoc {
  id?: string
  title_display?: string
  journal?: string
  abstract?: string[]
  publication_date?: string
}
interface SolrResponse {
  response?: { docs?: SolrDoc[] }
}

/** class 정규식 매칭 첫 <div> inner HTML 을 깊이 추적 슬라이스(중첩 div 안전). */
function sliceDivByClass(html: string, classRe: RegExp): string | null {
  const openRe = /<div\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = openRe.exec(html)) !== null) {
    const cls = m[1]!.match(/\bclass="([^"]*)"/i)?.[1] ?? ''
    if (!classRe.test(cls)) continue
    const start = openRe.lastIndex
    const walk = /<div\b[^>]*>|<\/div\s*>/gi
    walk.lastIndex = start
    let depth = 1
    let w: RegExpExecArray | null
    while ((w = walk.exec(html)) !== null) {
      if (w[0].startsWith('</')) {
        depth--
        if (depth === 0) return html.slice(start, w.index)
      } else depth++
    }
    return html.slice(start)
  }
  return null
}

/** PLOS 본문 HTML → 산문(figures/tables/references/인용 제거). */
function extractProse(articleHtml: string): string {
  const abstract = sliceDivByClass(articleHtml, /\babstract-content\b/) ?? ''
  let body = sliceDivByClass(articleHtml, /\barticle-text\b/) ?? ''

  // References 이하 절단 (참고문헌·저자기여·펀딩 등 후미 = 산문 아님).
  body = body.replace(/<div[^>]*class="[^"]*\breferences\b[^"]*"[\s\S]*$/i, '')
  body = body.replace(/<(h[1-3])[^>]*>\s*References\s*<\/\1>[\s\S]*$/i, '')
  body = body.replace(/<(h[1-3])[^>]*>\s*Supporting information[\s\S]*$/i, '')

  let work = `${abstract}\n\n${body}`
  // figure/table/미주 블록 제거
  work = work.replace(/<div[^>]*class="[^"]*\bfigure\b[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi, '\n')
  work = work.replace(/<figure[\s\S]*?<\/figure>/gi, '\n')
  work = work.replace(/<table[\s\S]*?<\/table>/gi, '\n')
  // 인용 상첨자·참조 링크 제거 ([1], [2,3] 등)
  work = work.replace(/<a[^>]*class="[^"]*\bref-tip\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
  work = work.replace(/\[\s*(?:<[^>]+>)*\d+(?:[,–-]\s*\d+)*(?:<[^>]+>)*\s*\]/g, '')
  return htmlToPlainText(work)
}

/** 최근 PLOS 기사 목록 (solr API — full 문서). 대량 GET picker. */
export async function listPlosFeed(feedId: string = 'recent', rows: number = 20): Promise<PlosListItem[]> {
  const url = new URL(SOLR)
  url.searchParams.set('q', '*:*')
  url.searchParams.set('fq', 'doc_type:full AND !article_type:"Correction"')
  url.searchParams.set('fl', 'id,title_display,journal,abstract,publication_date')
  url.searchParams.set('rows', String(Math.min(rows, 50)))
  url.searchParams.set('sort', 'publication_date desc')
  url.searchParams.set('wt', 'json')

  const res = await fetchWithTimeout(url.toString(), { accept: 'application/json' })
  if (!res.ok) throw new Error(`PLOS solr failed: ${res.status}`)
  const data = JSON.parse(await res.text()) as SolrResponse
  const raw: PlosListItem[] = (data.response?.docs ?? [])
    .filter((d) => d.id && d.journal)
    .map((d) => ({
      source_id: `plos:${d.id}`,
      title: decodeEntities((d.title_display ?? '').replace(/<[^>]+>/g, '').trim()),
      url: `https://journals.plos.org/${plosJournalSlug(d.journal!)}/article?id=${d.id}`,
      published_at: d.publication_date ?? null,
      description: decodeEntities((d.abstract?.[0] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).slice(0, 300),
    }))
  return applyArticleCurationSpec(raw, 'plos', feedId)
}

// journal 표시명 → URL slug (solr journal 필드는 표시명).
function plosJournalSlug(journal: string): string {
  const j = journal.toLowerCase()
  if (j.includes('biology')) return 'plosbiology'
  if (j.includes('medicine')) return 'plosmedicine'
  if (j.includes('genetics')) return 'plosgenetics'
  if (j.includes('computational')) return 'ploscompbiol'
  if (j.includes('pathogens')) return 'plospathogens'
  if (j.includes('neglected')) return 'plosntds'
  if (j.includes('climate')) return 'climate'
  if (j.includes('global public health')) return 'globalpublichealth'
  if (j.includes('water')) return 'water'
  if (j.includes('digital health')) return 'digitalhealth'
  return 'plosone'
}

/** 단일 PLOS 기사 → 산문 추출. input = article URL 또는 doi. */
export async function ingestPlosArticle(itemUrl: string): Promise<RawArticle> {
  const doi = itemUrl.match(/id=(10\.1371\/[^&\s]+)/)?.[1] ?? itemUrl.match(/^(10\.1371\/\S+)$/)?.[1]
  if (!doi) throw new Error(`PLOS: DOI 추출 실패 (${itemUrl})`)
  const url = itemUrl.startsWith('http') ? itemUrl : `https://journals.plos.org/plosone/article?id=${doi}`

  const res = await fetchWithTimeout(url, { accept: 'text/html' })
  if (!res.ok) throw new Error(`PLOS fetch failed: ${res.status} ${url}`)
  const html = await res.text()

  const title =
    extractFirst(html, [
      /<meta\s+name="citation_title"\s+content="([^"]+)"/i,
      /<h1[^>]*id="artTitle"[^>]*>([\s\S]*?)<\/h1>/i,
    ]) ?? '(제목 미상)'
  const publishedAt = extractFirst(html, [
    /<meta\s+name="citation_publication_date"\s+content="([^"]+)"/i,
    /<meta\s+name="citation_date"\s+content="([^"]+)"/i,
  ])
  const author =
    extractFirst(html, [/<meta\s+name="citation_author"\s+content="([^"]+)"/i]) ?? 'PLOS authors'

  const content = extractProse(html)
  if (content.trim().split(/\s+/).filter(Boolean).length < 200) {
    throw new Error(`PLOS body too short: ${content.trim().length} chars (${doi})`)
  }

  return {
    source: 'plos',
    source_id: `plos:${doi}`,
    source_url: url,
    title: decodeEntities(title.replace(/<[^>]+>/g, '').trim()),
    author: decodeEntities(author).trim(),
    language: 'en',
    license: 'CC-BY-4.0', // PLOS = CC BY 4.0 → 발행 허용
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null,
    audio_url: null,
    fetched_at: new Date(),
  }
}
