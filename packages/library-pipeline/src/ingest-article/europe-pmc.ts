// packages/library-pipeline/src/ingest-article/europe-pmc.ts
//
// **Europe PMC — 라이선스를 질의로 고정하는 유일한 공급선.**
//
// ── 왜 이 소스인가 (실측 2026-09-13) ─────────────────────────────────
// 재검증 시점의 재고는 이랬다: 변형 가능(ND·NC 아님) 논증문 **1,485편 · 소스 2곳**
// (plos 1,476 · owid 9). 사실상 PLOS 하나다. 논증문을 늘리려는 시도는 두 번 실패했는데
// 둘 다 **라이선스** 때문이었다 — The Conversation 은 CC BY-ND 라 `display_only` 로 들어가
// 문항이 0개이고(2026-08-21, 신규 46편 전량), Aeon·Quanta·Knowable 은 ND/NC 라 붙여도 같았다.
//
// 이 소스가 다른 점은 편수가 아니라 **필터의 위치**다:
//
//   `LICENSE:"cc by" AND LANG:"eng" AND IN_EPMC:y`  → 서버가 걸러 준다
//
// DOAB 는 책마다 라이선스가 달라(변형 가능 33.6% · ND·NC 56.0% · 표기 없음 10.4%) 편당 판정을
// 따로 만들어야 하고, 그 판정이 한 번 느슨해지면 **오류 없이** 위법 교재가 나온다. 여기서는
// 질의에 박혀 있어 혼재가 애초에 들어오지 않는다. 그래도 적재기는 **응답의 license 를 다시 본다** —
// 질의를 누가 고칠 수 있고, 고쳐도 아무 오류가 나지 않기 때문이다(§licenseAllowed).
//
// 상류 실측 2026-09-13:
//   CC BY × 영어 × 전문 보유          5,218,944편
//   그중 `PUB_TYPE:"review"`            618,178편  ← 논증문. 주장 + 근거 + 반론 구조
//   서론 발췌 규격 수확률                 97.5%    (`scripts/textbook/epmc-yield-probe.mjs`, 표본 40편)
//
// 소재는 생의학 전용이 아니다 — Frontiers in Psychology 4,951 · language/learning 6,319 ·
// social/cultural 3,575 · climate/environment 3,183 · education 2,583 (전부 CC BY 영어 review).
//
// ⚠️ **PLOS·Frontiers 와 겹친다.** 둘은 이미 배선돼 있고 Europe PMC 안에도 들어 있다. 중복은
//   `source_id` 로 막히지 않는다 — 열쇠 접두어가 다르기 때문이다(`plos:…` vs `europe_pmc:PMC…`).
//   그래서 목록기가 **발행처를 질의에서 빼는** 선택지를 갖는다(§EPMC_FEEDS 의 `excludePublishers`).
//
// ⚠️ 이 파일은 **본문을 가져오는 데까지만** 책임진다. 학령·어수·register 는 분석 단계
//   (`scripts/acp/process-queue.mjs`)가, 게시 가능 여부는 `source-eligibility.ts` 7축이 정한다.

import { fetchWithTimeout } from './_helpers'
import type { RawArticle } from '../types-article'
import { ShortBodyError } from './short-body'

const REST = 'https://www.ebi.ac.uk/europepmc/webservices/rest'

/** 본문이 이보다 짧으면 지문이 될 수 없다 — 조판 최소 창(90어)에 여유를 뒀다. */
export const EPMC_MIN_WORDS = 120

/**
 * **통과하는 라이선스만.** ND·NC 는 여기 없다 — 본문을 잘라 문항으로 바꾸는 것이
 * 파생이기 때문이다. `cc0`·`cc by`·`cc by-sa` 만 받는다.
 *
 * Europe PMC 의 `license` 필드는 소문자 코드다(`cc by`, `cc by-nc-nd`, `cc0`, …).
 */
const ALLOWED_LICENSE = new Set(['cc by', 'cc by-sa', 'cc0', 'cc-by', 'cc-by-sa'])

export function epmcLicenseAllowed(license: string | null | undefined): boolean {
  if (!license) return false
  return ALLOWED_LICENSE.has(license.trim().toLowerCase())
}

/** DB 가 쓰는 라이선스 코드로 옮긴다. 모르는 값은 `null` — **추측하지 않는다.** */
export function epmcLicenseCode(license: string | null | undefined): string | null {
  const k = (license ?? '').trim().toLowerCase()
  if (k === 'cc0') return 'CC0-1.0'
  if (k === 'cc by' || k === 'cc-by') return 'CC-BY-4.0'
  if (k === 'cc by-sa' || k === 'cc-by-sa') return 'CC-BY-SA-4.0'
  return null
}

export interface EpmcFeed {
  id: string
  label: string
  /** 이 피드를 정의하는 추가 조건. 라이선스·언어·전문보유는 공통이라 여기 적지 않는다. */
  filter: string
  /**
   * 질의에서 뺄 발행처. **이미 배선된 소스와의 중복을 목록기 단계에서 막는다** —
   * 열쇠 접두어가 달라 `source_id` 중복 검사로는 잡히지 않기 때문이다.
   */
  excludePublishers?: readonly string[]
}

/** 이미 배선된 소스와 겹치는 발행처 — 기본으로 뺀다. */
export const EPMC_WIRED_OVERLAP = ['PLOS', 'Frontiers Media SA'] as const

/**
 * 피드 = 계측·수확 단위. **소재 균형이 피드로 표현된다** — 하나로 두면 생의학이 전부 차지한다
 * (Europe PMC 의 모집단이 그렇다). 그래서 register·소재축으로 갈라 둔다.
 */
export const EPMC_FEEDS: readonly EpmcFeed[] = [
  {
    id: 'review',
    label: 'Europe PMC — 리뷰 (논증 구조)',
    filter: 'PUB_TYPE:"review"',
    excludePublishers: EPMC_WIRED_OVERLAP,
  },
  {
    id: 'psychology',
    label: 'Europe PMC — 심리 (수능 최빈출 소재)',
    filter: 'PUB_TYPE:"review" AND JOURNAL:"Frontiers in Psychology"',
  },
  {
    id: 'education',
    label: 'Europe PMC — 교육·학습',
    filter: 'PUB_TYPE:"review" AND (TITLE:"education" OR TITLE:"learning" OR TITLE:"language")',
    excludePublishers: EPMC_WIRED_OVERLAP,
  },
  {
    id: 'environment',
    label: 'Europe PMC — 기후·환경',
    filter: 'PUB_TYPE:"review" AND (TITLE:"climate" OR TITLE:"environment")',
    excludePublishers: EPMC_WIRED_OVERLAP,
  },
  {
    id: 'society',
    label: 'Europe PMC — 사회·문화',
    filter: 'PUB_TYPE:"review" AND (TITLE:"social" OR TITLE:"cultural" OR TITLE:"society")',
    excludePublishers: EPMC_WIRED_OVERLAP,
  },
]

export function epmcFeed(id: string): EpmcFeed | null {
  return EPMC_FEEDS.find((f) => f.id === id) ?? null
}

/**
 * 질의문. **라이선스·언어·전문보유는 여기서 고정한다** — 피드가 바꿀 수 없게 두는 것이 요점이다.
 * 피드가 라이선스를 건드릴 수 있으면 「필터가 질의에 있다」는 보장이 사라진다.
 */
export function buildEpmcQuery(feedId = 'review'): string {
  const feed = epmcFeed(feedId)
  if (!feed) {
    throw new Error(
      `Europe PMC 피드 '${feedId}' 를 모른다. 쓸 수 있는 것: ${EPMC_FEEDS.map((f) => f.id).join(' · ')}`,
    )
  }
  const parts = ['OPEN_ACCESS:y', 'IN_EPMC:y', 'LICENSE:"cc by"', 'LANG:"eng"', feed.filter]
  for (const pub of feed.excludePublishers ?? []) parts.push(`NOT PUBLISHER:"${pub}"`)
  return parts.join(' AND ')
}

/**
 * 목록 주소. **커서(`cursorMark`)로 넘긴다** — `page` 는 깊이가 깊어지면 흔들린다.
 * 첫 호출은 `cursor = '*'`.
 */
export function buildEpmcListUrl(feedId: string, pageSize: number, cursor = '*'): string {
  const q = encodeURIComponent(buildEpmcQuery(feedId))
  const size = Math.max(1, Math.min(1000, pageSize))
  return `${REST}/search?query=${q}&format=json&pageSize=${size}&cursorMark=${encodeURIComponent(cursor)}&resultType=core`
}

export interface EpmcListItem {
  /** `PMC1234567` — 안정 식별자. DOI 가 없는 항목도 있어 이쪽을 열쇠로 쓴다. */
  pmcid: string
  title: string
  url: string
  license: string | null
  journal: string | null
  publisher: string | null
  publishedAt: string | null
  feedId: string
}

interface EpmcSearchResponse {
  hitCount?: number
  nextCursorMark?: string
  resultList?: {
    result?: Array<{
      pmcid?: string
      title?: string
      license?: string
      firstPublicationDate?: string
      journalInfo?: { journal?: { title?: string }; dateOfPublication?: string }
      bookOrReportDetails?: { publisher?: string }
    }>
  }
}

/** 사람이 보는 주소. 열쇠는 PMCID 이고 이 주소는 표시·출처용이다. */
export const epmcArticleUrl = (pmcid: string): string =>
  `https://europepmc.org/article/PMC/${pmcid.replace(/^PMC/i, '')}`

export interface EpmcListPage {
  items: EpmcListItem[]
  nextCursor: string | null
  hitCount: number
}

/**
 * 목록 한 페이지. **라이선스를 여기서도 건다** — 질의가 이미 걸고 있지만, 질의는 사람이 고칠 수
 * 있고 고쳐도 오류가 나지 않는다. 두 겹으로 두는 비용은 한 줄이고, 한 겹이 뚫리면 위법이다.
 */
export async function listEpmcFeedPage(
  feedId = 'review',
  pageSize = 100,
  cursor = '*',
): Promise<EpmcListPage> {
  const res = await fetchWithTimeout(buildEpmcListUrl(feedId, pageSize, cursor), {
    accept: 'application/json',
    timeoutMs: 30_000,
  })
  if (!res.ok) throw new Error(`Europe PMC 목록 실패: HTTP ${res.status}`)
  const json = (await res.json()) as EpmcSearchResponse
  const rows = json.resultList?.result ?? []
  const items: EpmcListItem[] = []
  for (const r of rows) {
    if (!r.pmcid) continue // 열쇠를 못 만드는 항목은 담지 않는다 — 해시로 물러서지 않는다
    if (!epmcLicenseAllowed(r.license)) continue
    items.push({
      pmcid: r.pmcid,
      title: (r.title ?? '').replace(/\.$/, '').trim() || '(제목 미상)',
      url: epmcArticleUrl(r.pmcid),
      license: r.license ?? null,
      journal: r.journalInfo?.journal?.title ?? null,
      publisher: r.bookOrReportDetails?.publisher ?? null,
      publishedAt: r.firstPublicationDate ?? null,
      feedId,
    })
  }
  // 커서가 그대로 돌아오면 끝이다 — 같은 값으로 다시 물으면 **무한 루프**가 된다.
  const next = json.nextCursorMark && json.nextCursorMark !== cursor ? json.nextCursorMark : null
  return { items, nextCursor: next, hitCount: json.hitCount ?? 0 }
}

/** 여러 페이지를 이어 받는다. `limit` 까지 모으거나 커서가 끝나면 멈춘다. */
export async function listEpmcFeed(feedId = 'review', limit = 100): Promise<EpmcListItem[]> {
  const out: EpmcListItem[] = []
  let cursor = '*'
  while (out.length < limit) {
    const page = await listEpmcFeedPage(feedId, Math.min(100, limit - out.length), cursor)
    out.push(...page.items)
    if (!page.nextCursor || page.items.length === 0) break
    cursor = page.nextCursor
  }
  return out.slice(0, limit)
}

// ── 본문 ─────────────────────────────────────────────────────────────

export const epmcFullTextUrl = (pmcid: string): string => `${REST}/${pmcid}/fullTextXML`

const strip = (s: string): string =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x2019;|&rsquo;/g, '’')
    .replace(/&#x201c;|&ldquo;/g, '“')
    .replace(/&#x201d;|&rdquo;/g, '”')
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const epmcWordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length

export interface EpmcSection {
  title: string
  xml: string
}

/**
 * 최상위 `<sec>` 블록. **깊이를 센다** — `<sec …>[\s\S]*?</sec>` 로 잡으면 중첩된 하위 절의
 * 닫는 태그에서 끊긴다. 실측 2026-09-13 에 그렇게 해서 Introduction 이 **있는** 논문을
 * 「서론 절 없음」으로 셌고 수확률이 15%p 낮게 나왔다.
 */
export function epmcTopLevelSections(xml: string): EpmcSection[] {
  const body = xml.match(/<body\b[^>]*>([\s\S]*)<\/body>/)?.[1] ?? ''
  const out: EpmcSection[] = []
  const open = /<sec\b[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = open.exec(body)) !== null) {
    let depth = 1
    let i = open.lastIndex
    while (depth > 0 && i < body.length) {
      const nextOpen = body.indexOf('<sec', i)
      const nextClose = body.indexOf('</sec>', i)
      if (nextClose === -1) break
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        i = nextOpen + 4
      } else {
        depth--
        i = nextClose + 6
      }
    }
    const block = body.slice(m.index, i)
    // `<label>1.</label><title>Introduction</title>` — label 이 사이에 끼는 문서가 많다.
    const title = strip(block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '')
    out.push({ title, xml: block })
    open.lastIndex = i // 하위 절을 다시 최상위로 세지 않는다
  }
  return out
}

/**
 * 서론에 해당하는 부분. 제목이 맞는 절 → 첫 절 → **본문 앞머리** 순으로 물러선다.
 *
 * ⚠️ `<sec>` 이 하나도 없는 문서가 있다(실측 표본 40편 중 6편 = 15%). 본문이 `<body><p>…` 로
 *   곧장 이어지는 형식인데, 이걸 「서론 없음」으로 세면 멀쩡한 논문을 통째로 버린다.
 */
export function epmcIntroSection(xml: string): EpmcSection | null {
  const secs = epmcTopLevelSections(xml)
  const named = secs.find((s) => /^(?:\d+\.?\s*)?(introduction|background)\b/i.test(s.title))
  if (named) return named
  if (secs.length > 0) return secs[0]!
  const body = xml.match(/<body\b[^>]*>([\s\S]*)<\/body>/)?.[1]
  return body ? { title: '(절 없음 — 본문 앞머리)', xml: body } : null
}

/**
 * 지문이 되는 문단들. **표·그림 캡션과 인용 번호는 지문이 아니다** — 걷어 낸다.
 * 걷지 않으면 "[12]" 가 어수에 들어가고 학습자 화면에 참조 번호가 남는다.
 */
export function epmcParagraphs(sectionXml: string): string[] {
  const cleaned = sectionXml
    .replace(/<table-wrap[\s\S]*?<\/table-wrap>/g, ' ')
    .replace(/<fig[\s\S]*?<\/fig>/g, ' ')
    .replace(/<xref\b[^>]*>[\s\S]*?<\/xref>/g, ' ')
    .replace(/<supplementary-material[\s\S]*?<\/supplementary-material>/g, ' ')
  return [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => strip(m[1]!))
    .filter((p) => p.length > 0)
}

export interface EpmcFetched {
  pmcid: string
  title: string
  content: string
  words: number
  license: string | null
  /** 절이 있었는가 — 없으면 본문 앞머리로 물러선 것이다(계측에 쓴다). */
  hadSections: boolean
}

/** 절이 없는 문서에서 서론 대신 쓸 앞 문단 수. 논문 끝의 결론을 서론으로 세지 않기 위한 상한. */
const NO_SEC_PARAGRAPH_CAP = 6

/**
 * 본문 취득. **서론만 가져온다** — 논문 전체는 지문 규격(90~400어)의 수십 배이고,
 * 방법·결과 절은 통계 표기가 많아 지문이 되지 못한다.
 */
export async function fetchEpmcArticle(pmcid: string): Promise<EpmcFetched | null> {
  const res = await fetchWithTimeout(epmcFullTextUrl(pmcid), {
    accept: 'application/xml',
    timeoutMs: 45_000,
  })
  if (!res.ok) return null
  const xml = await res.text()
  if (!/<body\b/.test(xml)) return null

  const secs = epmcTopLevelSections(xml)
  const intro = epmcIntroSection(xml)
  if (!intro) return null

  const all = epmcParagraphs(intro.xml)
  const paras = secs.length > 0 ? all : all.slice(0, NO_SEC_PARAGRAPH_CAP)
  const content = paras.join('\n\n')
  const title = strip(
    xml.match(/<article-title\b[^>]*>([\s\S]*?)<\/article-title>/)?.[1] ?? '',
  )
  // 라이선스는 전문 XML 에도 적혀 있다 — 목록과 다르면 **더 제한적인 쪽**을 믿어야 하므로
  //   여기서 읽어 호출부가 다시 판정할 수 있게 돌려준다.
  const licenseUrl = xml.match(/<license[^>]*xlink:href="([^"]+)"/)?.[1] ?? null
  const license = licenseUrl
    ? /\/by\/[\d.]+/.test(licenseUrl)
      ? 'cc by'
      : /\/by-sa\//.test(licenseUrl)
        ? 'cc by-sa'
        : /publicdomain\/zero/.test(licenseUrl)
          ? 'cc0'
          : licenseUrl
    : null

  return {
    pmcid,
    title: title || '(제목 미상)',
    content,
    words: epmcWordCount(content),
    license,
    hadSections: secs.length > 0,
  }
}

/**
 * 적재 한 건. **라이선스를 세 번째로 확인한다** — 질의 · 목록 · 여기.
 * 앞의 둘이 뚫려도 여기서 던지면 위법 본문이 DB 에 들어가지 않는다.
 *
 * `listLicense` 는 목록에서 본 값이다. 전문 XML 의 값과 다르면 **둘 중 더 제한적인 쪽**으로
 * 판정한다 — 느슨한 쪽을 고르면 그 선택이 그대로 위법이 된다.
 */
export async function ingestEuropePmcArticle(
  pmcidOrUrl: string,
  listLicense: string | null = null,
): Promise<RawArticle> {
  const pmcid = pmcidOrUrl.match(/PMC\d+/i)?.[0]?.toUpperCase()
  if (!pmcid) throw new Error(`Europe PMC PMCID 를 못 읽었다: ${pmcidOrUrl}`)

  const got = await fetchEpmcArticle(pmcid)
  if (!got) throw new Error(`Europe PMC 본문을 못 받았다: ${pmcid}`)
  // 짧아도 버리지 않는다 — 기사를 다 만든 뒤 `ShortBodyError` 로 들고 나간다(short-body.ts).
  const shortBody = got.words < EPMC_MIN_WORDS

  // 목록 값과 본문 값 중 **통과하지 못하는 쪽이 있으면 통과시키지 않는다.**
  const candidates = [listLicense, got.license].filter((x): x is string => !!x)
  if (candidates.length === 0) {
    throw new Error(`Europe PMC 라이선스 표기가 없다 — 통과시키지 않는다: ${pmcid}`)
  }
  const blocked = candidates.find((l) => !epmcLicenseAllowed(l))
  if (blocked) {
    throw new Error(`Europe PMC 라이선스가 통과 목록 밖이다(${blocked}): ${pmcid}`)
  }

  const code = epmcLicenseCode(candidates[0]!)
  if (!code) throw new Error(`Europe PMC 라이선스 코드를 모른다(${candidates[0]}): ${pmcid}`)

  const article: RawArticle = {
    source: 'europe_pmc',
    // 열쇠는 PMCID. DOI 가 없는 항목이 있어 DOI 로는 전수를 덮지 못한다.
    source_id: `europe_pmc:${pmcid}`,
    title: got.title,
    source_url: epmcArticleUrl(pmcid),
    language: 'en',
    license: code,
    published_at: null,
    content: got.content,
    estimated_cefr: null,
    fetched_at: new Date(),
  }
  if (shortBody) {
    throw new ShortBodyError(`Europe PMC 본문이 너무 짧다(${got.words}어 < ${EPMC_MIN_WORDS}): ${pmcid}`, {
      source: article.source,
      url: article.source_url,
      content: article.content,
      article,
    })
  }
  return article
}
