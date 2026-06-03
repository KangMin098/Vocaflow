// Project Gutenberg fetcher — Gutendex API 우선 + gutenberg.org 본가 HTML fallback.
//
// v06.34 — 사용자 명시 요청: "Gutendex 가 제공하는 조건 전체"
//   - Gutendex 전체 파라미터: search · languages · topic · author_year_start/end
//     · copyright · ids · sort (popular/ascending/descending) · mime_type
//   - 페이지당 32 entries (Gutendex 고정)
//   - Gutendex 차단/timeout 시 본가 HTML 스크래핑 fallback
//
// Gutendex API: https://gutendex.com/books/
// 본가 search: https://www.gutenberg.org/ebooks/search/

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const GUTENDEX_BASE = 'https://gutendex.com/books'
const GUTENBERG_HTML_BASE = 'https://www.gutenberg.org/ebooks/search/'
const PAGE_SIZE_GUTENDEX = 32
const PAGE_SIZE_HTML = 25

// ─── Gutendex 응답 타입 ────────────────────────────────
interface GutendexBook {
  id: number
  title: string
  authors: Array<{ name: string; birth_year: number | null; death_year: number | null }>
  translators: Array<{ name: string }>
  subjects: string[]
  bookshelves: string[]
  languages: string[]
  copyright: boolean | null
  media_type: string
  formats: Record<string, string>
  download_count: number
}

interface GutendexResponse {
  count: number
  next: string | null
  previous: string | null
  results: GutendexBook[]
}

// ─── Gutendex topic 후보 ────────────────────────────────
const GUTENDEX_TOPICS: Array<{ value: string; label: string }> = [
  { value: '', label: '전체' },
  { value: 'fiction', label: 'Fiction' },
  { value: 'science fiction', label: 'Science Fiction' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'romance', label: 'Romance' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'horror', label: 'Horror' },
  { value: "children", label: "Children's" },
  { value: 'poetry', label: 'Poetry' },
  { value: 'history', label: 'History' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'biography', label: 'Biography' },
  { value: 'drama', label: 'Drama' },
  { value: 'short stories', label: 'Short Stories' },
  { value: 'essay', label: 'Essay' },
  { value: 'travel', label: 'Travel' },
  { value: 'science', label: 'Science' },
  { value: 'religion', label: 'Religion' },
  { value: 'humor', label: 'Humor' },
]

// v06.34 — POPULAR_LANGS 제거 (영어 강제 정책)

// ─── Gutendex API 호출 ────────────────────────────────
async function fetchFromGutendex(params: FetchBatchParams): Promise<FetchBatchResult> {
  const offset = params.offset ?? 0
  const page = Math.floor(offset / PAGE_SIZE_GUTENDEX) + 1

  const url = new URL(GUTENDEX_BASE + '/')
  url.searchParams.set('page', String(page))

  // sort: popular (download_count desc) · ascending/descending (id) — 기본 popular
  // 본 fetcher 는 'recent' 입력 시 ascending(id 작은 순=오래된 책 우선) 으로 매핑 안 됨
  // Gutendex 는 release_date 정렬 미지원 → 'recent' 은 'descending' 으로 매핑 (큰 ID = 최근 추가)
  const sortMap: Record<string, string> = {
    popular: 'popular',
    recent: 'descending',
    alpha: 'ascending',
    ascending: 'ascending',
    descending: 'descending',
  }
  url.searchParams.set('sort', sortMap[params.sort ?? 'popular'] ?? 'popular')

  // v06.34 정책: Vocaflow 는 영어 학습 플랫폼 — 모든 fetch 영어 강제
  url.searchParams.set('languages', 'en')

  // topic
  if (params.genre) url.searchParams.set('topic', params.genre)

  // search
  if (params.search) url.searchParams.set('search', params.search)

  // author year range
  if (params.authorYearStart != null) {
    url.searchParams.set('author_year_start', String(params.authorYearStart))
  }
  if (params.authorYearEnd != null) {
    url.searchParams.set('author_year_end', String(params.authorYearEnd))
  }

  // copyright
  if (params.copyright !== undefined && params.copyright !== null) {
    url.searchParams.set('copyright', params.copyright ? 'true' : 'false')
  }

  // ids (특정 ID 일괄)
  if (params.ids && params.ids.length > 0) {
    url.searchParams.set('ids', params.ids.join(','))
  }

  // mime_type
  if (params.mimeType) url.searchParams.set('mime_type', params.mimeType)

  const controller = new AbortController()
  // Gutendex(서드파티 호스팅)는 종종 다운/지연됨. 6s 안에 응답 없으면 빠르게 gutenberg.org
  // 본가 HTML fallback 으로 전환 (이전 15s 는 다운 시 가져오기가 멈춘 듯 느껴짐).
  const timer = setTimeout(() => controller.abort(), 6_000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Vocaflow-Curator/1.0 (https://vocaflow.app)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`gutendex HTTP ${res.status}`)
    const data = (await res.json()) as GutendexResponse

    const rows: SeedRow[] = data.results.map((b) => {
      const author = b.authors[0]?.name ?? null
      const lang = b.languages[0] ?? 'en'
      const coverUrl =
        b.formats['image/jpeg'] ?? null
      const subjectsList = b.subjects.slice(0, 8)
      // 첫 번째 bookshelf 또는 subject 의 핵심어를 genre 로
      const primaryShelf = b.bookshelves[0] ?? null
      const genre =
        primaryShelf?.replace(/^Browsing:\s*/i, '').split(/\s*[—·]\s*/)[0]?.trim() ??
        subjectsList[0]?.split(/\s*[-—]\s*/)[0]?.trim() ??
        null
      return {
        source: 'gutenberg',
        source_id: String(b.id),
        title: b.title,
        author,
        author_birth_year: b.authors[0]?.birth_year ?? null,
        author_death_year: b.authors[0]?.death_year ?? null,
        language: lang,
        genre,
        subjects: subjectsList,
        popularity_rank: b.download_count,
        cover_url: coverUrl,
        source_url: `https://www.gutenberg.org/ebooks/${b.id}`,
        published_year: null, // Gutendex 에 published 없음 — 저자 사망 연도로 대체 가능
        word_count: null,
      }
    })

    return {
      source: 'gutenberg',
      total_available: data.count,
      fetched: rows,
      next_offset: data.next ? offset + PAGE_SIZE_GUTENDEX : null,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ─── gutenberg.org 본가 HTML fallback ────────────────────────────────
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
}
function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
}
function parseHtmlPage(html: string): SeedRow[] {
  const rows: SeedRow[] = []
  const cardRe = /<li[^>]+class="[^"]*booklink[^"]*"[^>]*>([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null
  while ((m = cardRe.exec(html)) !== null) {
    const inner = m[1]!
    const idMatch = inner.match(/href="\/ebooks\/(\d+)"/)
    if (!idMatch) continue
    const sourceId = idMatch[1]!
    const title = stripTags(
      inner.match(/<span[^>]+class="title"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '',
    )
    if (!title) continue
    const author = stripTags(
      inner.match(/<span[^>]+class="subtitle"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '',
    ) || null
    const extras = Array.from(
      inner.matchAll(/<span[^>]+class="[^"]*extra[^"]*"[^>]*>([\s\S]*?)<\/span>/g),
    )
      .map((x) => stripTags(x[1] ?? ''))
      .filter(Boolean)
    const dlMatch = extras.find((t) => /downloads/i.test(t))?.match(/([\d,]+)/)
    const downloads = dlMatch ? Number(dlMatch[1]!.replace(/,/g, '')) : null
    const coverPath = inner.match(/<img[^>]+src="([^"]+)"/)?.[1]
    const cover = coverPath
      ? coverPath.startsWith('http')
        ? coverPath
        : `https://www.gutenberg.org${coverPath}`
      : null
    rows.push({
      source: 'gutenberg',
      source_id: sourceId,
      title,
      author,
      author_birth_year: null,
      author_death_year: null,
      language: 'en',
      genre: null,
      subjects: [],
      popularity_rank: downloads,
      cover_url: cover,
      source_url: `https://www.gutenberg.org/ebooks/${sourceId}`,
      published_year: null,
      word_count: null,
    })
  }
  return rows
}
async function fetchFromHtml(params: FetchBatchParams): Promise<FetchBatchResult> {
  const offset = params.offset ?? 0
  const page = Math.floor(offset / PAGE_SIZE_HTML) + 1
  const url = new URL(GUTENBERG_HTML_BASE)
  url.searchParams.set(
    'sort_order',
    params.sort === 'recent' ? 'release_date' : 'downloads',
  )
  url.searchParams.set('page', String(page))
  // query 는 keyword 검색 — search 우선, 없으면 genre
  const q = params.search || params.genre
  if (q) url.searchParams.set('query', q)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Vocaflow-Curator/1.0 (https://vocaflow.app)',
        Accept: 'text/html',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`gutenberg HTTP ${res.status}`)
    const html = await res.text()
    const rows = parseHtmlPage(html)
    const hasNext =
      /href="[^"]*page=\d+"[^>]*>Next/i.test(html) || rows.length === PAGE_SIZE_HTML
    return {
      source: 'gutenberg',
      total_available: null,
      fetched: rows,
      next_offset: hasNext ? offset + PAGE_SIZE_HTML : null,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ─── 외부 export ────────────────────────────────
export const gutendexFetcher: SourceFetcher = {
  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    // Gutendex 우선 — 차단/timeout 시 본가 fallback
    try {
      return await fetchFromGutendex(params)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[gutendex] fallback to gutenberg.org HTML:', err)
      return await fetchFromHtml(params)
    }
  },

  getOptions(): SourceOptions {
    return {
      sorts: [
        { value: 'popular', label: '인기순 (다운로드)' },
        { value: 'recent', label: '최근 추가순' },
        { value: 'ascending', label: 'ID 작은 순' },
        { value: 'descending', label: 'ID 큰 순' },
      ],
      genres: GUTENDEX_TOPICS,
      // v06.34 — languages 옵션 제외 (영어 강제 정책)
      advanced: ['search', 'authorYearRange', 'copyright', 'ids', 'mimeType'],
      maxBatch: PAGE_SIZE_GUTENDEX,
      hint: '영어 도서만 (Gutendex API) · 차단 시 gutenberg.org 본가 fallback',
    }
  },
}
