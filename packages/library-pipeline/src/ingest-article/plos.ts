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

/**
 * PLOS 피드 — **같은 소스인데 글의 결이 다르다.**
 *
 * ── 왜 나누는가 (실측 2026-08-21) ───────────────────────────────────
 * 교재 재고 실측에서 **논증문 교재 가용분이 0** 이었다. 신규 논증문이 전부
 * The Conversation(CC-BY-ND → `display_only`)에서 와 문항 생성기가 통째로 건너뛰기 때문이다.
 * 그래서 "논증문 소스를 더 붙이자" 로 갔는데 후보(Aeon·Quanta·Knowable)가 **전부 ND/NC** 라
 * 붙여도 결과가 같았다 — 즉 **소스 수 문제가 아니라 라이선스 문제**였다.
 *
 * 답은 이미 배선된 PLOS 안에 있었다. PLOS 는 연구논문만 내는 곳이 아니라
 * **Essay · Perspective · Opinion · Unsolved Mystery** 라는 논증 지면을 따로 갖고 있고,
 * 그것들도 다른 논문과 똑같이 CC BY 다. 실측(`doc_type:full` 기준):
 *   Perspective 1,362 · Opinion 710 · Essay 644 · Unsolved Mystery 67 = **2,783편**
 *
 * `recent` 피드가 `article_type` 을 안 집어서 이 2,783편이 최근순 뒤로 묻혀 있었다.
 * 새 소스가 아니라 **피드 하나**면 되는 일이었다.
 *
 * ⚠️ `Editorial`·`Review` 는 넣지 않는다. Editorial 은 저널 운영 공지가 섞이고,
 *   Review 는 논증이 아니라 문헌 종합이라 결이 설명문에 가깝다.
 */
export const PLOS_FEEDS: Array<{ id: string; label: string; articleTypes: readonly string[] }> = [
  { id: 'recent', label: 'Recent (오픈 학술)', articleTypes: [] },
  {
    id: 'essay',
    label: 'Essay · Perspective · Opinion (논증문)',
    articleTypes: ['Essay', 'Perspective', 'Opinion', 'Unsolved Mystery'],
  },
]

interface SolrDoc {
  id?: string
  title_display?: string
  journal?: string
  abstract?: string[]
  publication_date?: string
}
interface SolrResponse {
  /** `numFound` = 이 질의의 전체 건수. 페이지네이션의 끝을 추정 대신 알게 해 준다. */
  response?: { docs?: SolrDoc[]; numFound?: number }
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

/**
 * 초록과 본문을 **더하지 않고 합친다.**
 *
 * ⚠️ PLOS 에서 `abstract-content` 는 `article-text` 의 **자식**이다.
 *   실측(`10.1371/journal.pone.0348669` 원본 HTML):
 *     `<div class="article-text" id="artText">`  오프셋 100,807
 *       `<div class="abstract …"><h2>Abstract</h2>`
 *         `<div class="abstract-content">`       오프셋 101,053  ← article-text 안쪽
 *   `sliceDivByClass` 는 중첩 depth 를 세며 자르므로 두 조각 다 온전하지만, 바로 그래서
 *   **초록 조각은 본문 조각에 이미 통째로 들어 있다.** 예전처럼 `${abstract}\n\n${body}` 로
 *   앞에 한 번 더 붙이면 산출물이 `[초록] / "Abstract" / [같은 초록] / Introduction …` 이 된다.
 *   구조화 초록이면 Background·Methods·Results·Conclusion 블록이 통째로 반복된다.
 *
 *   실측 400편 중 **393편(98.3%)** 이 이 중복이었고(‘Abstract’ 제목이 있는 387편은 반례 0),
 *   96.7% 는 두 덩어리가 바이트 동일이었다. 그 결과 `word_count` 가 평균 **6.2% 과대**
 *   (중앙 5.7% · 최대 25.9%) — 학령 판정과 지문 규격 판정이 그만큼 틀린 분모 위에서 돌았다.
 *
 * 그래도 "앞에 붙이는" 갈래를 지우지는 않는다 — 두 경우에 그 갈래가 답이다:
 *   ① **본문 div 가 없고 초록 div 만 있는 편** — 실측 20편 중 1편이 그랬고 정상 산출이었다.
 *      초록만 버리면 그 편이 통째로 빈 지문이 되어 200단어 게이트에서 사라진다.
 *      (빈 `body` 는 `''.includes(…) === false` 라 아래 같은 줄이 그대로 처리한다.
 *       `if (!body.trim())` 같은 별도 갈래를 두면 **어떤 테스트도 죽일 수 없는 죽은 줄**이 된다 —
 *       실제로 변이 검사에서 그 줄만 무력화했더니 4검사가 전부 통과했다.)
 *   ② 초록이 `article-text` **밖**에 있는 레이아웃(마크업이 바뀌면 되살아난다).
 */
function joinAbstractAndBody(abstract: string, body: string): string {
  const needle = abstract.trim()
  if (!needle) return body
  // 본문 조각이 초록을 이미 품고 있으면(= 자식) 다시 붙이지 않는다.
  return body.includes(needle) ? body : `${abstract}\n\n${body}`
}

/** PLOS 본문 HTML → 산문(figures/tables/references/인용 제거). */
function extractProse(articleHtml: string): string {
  const abstract = sliceDivByClass(articleHtml, /\babstract-content\b/) ?? ''
  let body = sliceDivByClass(articleHtml, /\barticle-text\b/) ?? ''

  // References 이하 절단 (참고문헌·저자기여·펀딩 등 후미 = 산문 아님).
  body = body.replace(/<div[^>]*class="[^"]*\breferences\b[^"]*"[\s\S]*$/i, '')
  body = body.replace(/<(h[1-3])[^>]*>\s*References\s*<\/\1>[\s\S]*$/i, '')
  body = body.replace(/<(h[1-3])[^>]*>\s*Supporting information[\s\S]*$/i, '')

  let work = joinAbstractAndBody(abstract, body)
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
  const { items } = await listPlosFeedPage(feedId, rows, 0)
  return items
}

/**
 * Solr 한 페이지 — `start` 오프셋으로 이어 받는다.
 *
 * ⚠️ 예전에는 `start` 가 없어 **언제나 최신 rows(최대 50)편**이 상한이었다.
 *   `essay` 피드(Essay·Perspective·Opinion·Unsolved Mystery = 논증문)는 이 저장소에서
 *   **문항을 만들 수 있는 유일한 논증문 공급선**이고(The Conversation 은 CC BY-ND 라 제외)
 *   실측에서 V-Level 대역 적중이 46/46 = 100% 였다. 그런 소스가 50편에 갇혀 있었다.
 *
 * `total` 은 Solr 의 numFound — 이 피드에 남은 상류 총량이라 "소진" 판정의 근거가 된다.
 */
export async function listPlosFeedPage(
  feedId: string = 'recent',
  rows: number = 20,
  start: number = 0,
): Promise<{ items: PlosListItem[]; cont: number | null; total: number }> {
  const feed = PLOS_FEEDS.find((f) => f.id === feedId) ?? PLOS_FEEDS[0]!
  // 유형을 지정한 피드는 그 유형만, 아니면 정정문만 제외하고 전부.
  // 인용부호를 solr 에 그대로 넘겨야 두 단어짜리 유형('Unsolved Mystery')이 한 값으로 잡힌다.
  const typeClause = feed.articleTypes.length
    ? ` AND article_type:(${feed.articleTypes.map((t) => `"${t}"`).join(' OR ')})`
    : ' AND !article_type:"Correction"'

  const url = new URL(SOLR)
  url.searchParams.set('q', '*:*')
  url.searchParams.set('fq', `doc_type:full${typeClause}`)
  url.searchParams.set('fl', 'id,title_display,journal,abstract,publication_date')
  const pageRows = Math.min(rows, 50)
  url.searchParams.set('rows', String(pageRows))
  if (start > 0) url.searchParams.set('start', String(start))
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
  const total = data.response?.numFound ?? 0
  return {
    // 상한을 spec 의 maxItems 가 아니라 요청한 rows 로 둔다 — 대량 확보 경로에서
    // 50편을 받아 와 15편으로 잘리던 것과 같은 함정을 여기서도 막는다.
    items: applyArticleCurationSpec(raw, 'plos', feedId, { maxItems: pageRows }),
    // Solr 가 총량을 알려 주므로 "정말 끝" 을 추정하지 않고 안다.
    cont: start + pageRows < total ? start + pageRows : null,
    total,
  }
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
