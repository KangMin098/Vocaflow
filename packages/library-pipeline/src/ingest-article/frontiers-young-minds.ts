// packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts
//
// **Frontiers for Young Minds — 8~15세 대상 심사받는 과학지.** CC BY 4.0.
//
// ── 왜 이 소스인가 ───────────────────────────────────────────────────
// 학년 칸 재고를 재면 **중3 칸만 비어 있다**(실측 2026-09-05):
//
//     초3~4 40 · 초5~6 86 · 초6~중1 185 · 중1~2 130 · **중3 13**
//
// 그리고 채워진 칸들의 **시중 자리가 14.9~34.3** 이다 — 시중 지문 분포에서 아래쪽,
// 즉 **시중보다 쉬운 글만 모여 있다.** FrYM 은 둘을 함께 겨냥한다:
// 실측 FK 중앙 10.55(중3) · 중창 적중 **100%**(89~158어) · 심사물이라 어휘 밀도가 높다.
//
// ── 초록이 곧 지문 단위다 ────────────────────────────────────────────
// 이 학술지는 어린이 독자용이라 초록이 **완결된 한 편**으로 쓰인다 —
// "Have you ever followed a recipe to make your favorite cake?" 처럼 시작해
// 물음을 던지고 답한다. 그래서 발췌가 필요 없다(실측 132~152어 · 창 100~200 안).
//
// ⚠️ **본문(full text)을 가져오지 않는다.** 초록만으로 지문이 되고, 본문은 훨씬 길어
//   발췌가 필요하며 그림·표 참조가 문장 안에 박혀 있다("Figure 1 shows…").
//   지문에 그림 참조가 남으면 학습자가 없는 그림을 찾는다.
//
// ── 라이선스는 Crossref 가 글마다 준다 ───────────────────────────────
// `license[].URL` 에 `creativecommons.org/licenses/by/4.0` 이 들어온다.
// ⚠️ **"이 학술지는 CC BY 다" 로 뭉뚱그리지 않는다** — 글마다 확인하고,
//   못 읽으면 넣지 않는다. 같은 학술지에도 다른 라이선스가 섞일 수 있다.
//
// API: https://api.crossref.org/journals/2296-6846/works  (ISSN 2296-6846)
// source_id: "frym:<DOI>"

import type { RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const CROSSREF = 'https://api.crossref.org/journals/2296-6846/works'

/**
 * 피드 = 정렬 축. Crossref 는 `rows` 를 한 번에 100까지 준다 — 그 이상은 `offset`.
 * 학술지가 1,977편이라 한 번에 다 받지 않는다.
 */
export const FRYM_FEEDS: Array<{ id: string; label: string; sort: string }> = [
  { id: 'recent', label: 'Frontiers for Young Minds — 최신', sort: 'published' },
  {
    id: 'cited',
    label: 'Frontiers for Young Minds — 많이 인용된 순',
    sort: 'is-referenced-by-count',
  },
]

export interface FrymListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  /** 글마다 확인한 라이선스 URL. **못 읽으면 null** — 뭉뚱그리지 않는다. */
  licenseUrl: string | null
  score?: ArticleScore
}

const PER_PAGE = 100

/**
 * Crossref 초록은 JATS 조각으로 온다 — `<jats:p>` 같은 태그가 섞여 있다.
 * 태그를 지우고 엔티티를 되돌린다.
 */
export function frymAbstractText(abstract: string | null | undefined): string {
  return String(abstract ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d: string) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** CC 라이선스 URL 만 고른다. 없으면 null — **짐작해서 붙이지 않는다.** */
export function frymLicenseUrl(license: Array<{ URL?: string }> | undefined): string | null {
  return (license ?? []).map((l) => l.URL).find((u) => u && /creativecommons\.org/.test(u)) ?? null
}

/** CC 라이선스 URL → 우리 표기. 모르는 꼴이면 null. */
export function frymLicenseCode(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i)
  if (!m) return null
  return `CC-${m[1]!.toUpperCase()}-${m[2]}`
}

interface CrossrefWork {
  DOI?: string
  title?: string[]
  URL?: string
  abstract?: string
  license?: Array<{ URL?: string }>
  published?: { 'date-parts'?: number[][] }
}

/** Crossref `date-parts` → ISO 날짜. 부분 날짜(연도만)도 받는다. */
export function frymPublishedAt(published: CrossrefWork['published']): string | null {
  const p = published?.['date-parts']?.[0]
  if (!p?.length) return null
  const [y, m = 1, d = 1] = p
  if (!y) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

export async function listFrymFeed(feedId = 'recent', limit?: number): Promise<FrymListItem[]> {
  const feed = FRYM_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    throw new Error(
      `FrYM 피드 '${feedId}' 를 모른다. 쓸 수 있는 것: ${FRYM_FEEDS.map((f) => f.id).join(' · ')}`
    )
  }
  const want = limit ?? PER_PAGE
  const items: FrymListItem[] = []

  for (let offset = 0; items.length < want && offset < 2_000; offset += PER_PAGE) {
    const url =
      `${CROSSREF}?rows=${Math.min(want, PER_PAGE)}&offset=${offset}` +
      `&sort=${feed.sort}&order=desc&select=DOI,title,license,URL,abstract,published`
    // ⚠️ **Accept 를 명시해야 한다.** `fetchWithTimeout` 의 기본값이
    //   `application/rss+xml, …` 이라 Crossref 가 **406** 을 돌려준다(실측).
    //   같은 주소를 curl 은 받아 오는데 그건 curl 이 `*/*` 을 보내기 때문이다.
    const res = await fetchWithTimeout(url, { accept: 'application/json' })
    if (!res.ok) {
      if (items.length) break
      throw new Error(`FrYM Crossref list failed: ${res.status}`)
    }
    const json = (await res.json()) as { message?: { items?: CrossrefWork[] } }
    const got = json.message?.items ?? []
    if (!got.length) break

    for (const w of got) {
      if (!w.DOI) continue
      // **초록이 없으면 지문이 없다** — 목록 단계에서 뺀다.
      const abstract = frymAbstractText(w.abstract)
      if (!abstract) continue
      items.push({
        source_id: `frym:${w.DOI}`,
        title: (w.title ?? [])[0]?.replace(/\s+/g, ' ').trim() || '(제목 미상)',
        url: w.URL ?? `https://doi.org/${w.DOI}`,
        published_at: frymPublishedAt(w.published),
        description: abstract.slice(0, 300),
        licenseUrl: frymLicenseUrl(w.license),
      })
    }
  }

  return applyArticleCurationSpec(items.slice(0, want), 'frym', feedId, { maxItems: limit })
}

/**
 * DOI 로 한 편을 받는다. **초록만** 쓴다(§머리말).
 *
 * ⚠️ 목록에서 이미 초록을 받았지만 여기서 다시 받는다 — 적재 경로가 목록을 거치지 않고
 *   URL 하나로 불릴 수 있고(라우트의 `enqueue`), 그때도 같은 결과가 나와야 한다.
 */
export async function ingestFrymArticle(itemUrl: string): Promise<RawArticle> {
  const doi = itemUrl.match(/10\.3389\/frym\.[\d.]+/i)?.[0]
  if (!doi) throw new Error(`FrYM URL 에서 DOI 를 못 읽었다: ${itemUrl}`)

  const res = await fetchWithTimeout(
    // ⚠️ 단건 조회에는 `select` 를 붙이지 않는다 — **목록 전용 파라미터**라
    //   `/works/<doi>?select=…` 은 **400** 을 돌려준다(실측 8건 전부).
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { accept: 'application/json' }
  )
  if (!res.ok) throw new Error(`FrYM Crossref fetch failed: ${res.status} ${doi}`)
  const w = ((await res.json()) as { message?: CrossrefWork }).message
  if (!w) throw new Error(`FrYM Crossref 응답이 비었다: ${doi}`)

  const content = frymAbstractText(w.abstract)
  if (content.length < 200) {
    throw new Error(`FrYM 초록이 너무 짧다: ${content.length}자 ${doi}`)
  }

  const licenseUrl = frymLicenseUrl(w.license)
  const code = frymLicenseCode(licenseUrl)
  if (!code) {
    // **모르는 것을 허용으로 바꾸지 않는다.** 학술지 단위로 뭉뚱그리면 예외를 못 본다.
    throw new Error(`FrYM 라이선스를 글에서 확인하지 못했다: ${doi}`)
  }

  return {
    source: 'frym',
    source_id: `frym:${w.DOI ?? doi}`,
    source_url: w.URL ?? `https://doi.org/${doi}`,
    title: (w.title ?? [])[0]?.replace(/\s+/g, ' ').trim() || '(제목 미상)',
    author: 'Frontiers for Young Minds',
    language: 'en',
    license: code,
    published_at: frymPublishedAt(w.published) ? new Date(frymPublishedAt(w.published)!) : null,
    content,
    // 8~15세 대상이지만 심사물이라 등급이 붙어 있지 않다 — analyze 가 판정한다.
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}
