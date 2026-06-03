// Standard Ebooks — 공개 HTML 페이지 스크래핑.
// (OPDS 피드 /opds/all 은 2024년 Patreon 회원 인증 필수로 변경 — 401 반환)
// 공개 listing: https://standardebooks.org/ebooks?page=N&per-page=48

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const LIST_URL = 'https://standardebooks.org/ebooks'
const PAGE_SIZE = 48 // SE 페이지 max

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

// SE 마크업 (schema.org RDFa):
//   <li typeof="schema:Book" about="/ebooks/{author-slug}/{title-slug}">
//     ...<img src="/images/covers/...jpg">
//     <p><a href="/ebooks/..."><span property="schema:name">Title</span></a></p>
//     <p class="author"><a ...><span property="schema:name">Author Name</span></a></p>
//   </li>
function parsePage(html: string): SeedRow[] {
  const rows: SeedRow[] = []
  const cardRe = /<li[^>]+typeof="schema:Book"[^>]+about="(\/ebooks\/[^"]+)"[^>]*>([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null
  while ((m = cardRe.exec(html)) !== null) {
    const href = m[1]!
    const inner = m[2]!
    const sourceId = href.replace(/^\/ebooks\//, '').replace(/\/$/, '')
    if (!sourceId.includes('/')) continue

    // schema:name 두 번 등장 — 첫째가 제목, author 영역 안 schema:name 이 저자
    const titleMatch = inner.match(/<span[^>]+property="schema:name"[^>]*>([\s\S]*?)<\/span>/)
    const title = titleMatch ? stripTags(titleMatch[1] ?? '') : ''
    if (!title) continue

    const authorMatch = inner.match(
      /<p[^>]+class="author"[\s\S]*?<span[^>]+property="schema:name"[^>]*>([\s\S]*?)<\/span>/,
    )
    const author = authorMatch ? stripTags(authorMatch[1] ?? '') : null

    const coverMatch = inner.match(/<img[^>]+src="([^"]+cover[^"]*\.(?:jpg|jpeg|png|avif))"/i)
    const cover = coverMatch?.[1] ?? null

    rows.push({
      source: 'standard_ebooks',
      source_id: sourceId,
      title,
      author,
      author_birth_year: null,
      author_death_year: null,
      language: 'en',
      genre: null,
      subjects: [],
      popularity_rank: null,
      cover_url: cover ? (cover.startsWith('http') ? cover : `https://standardebooks.org${cover}`) : null,
      source_url: `https://standardebooks.org${href}`,
      published_year: null,
      word_count: null,
    })
  }
  return rows
}

const GENRES: Array<{ value: string; label: string }> = [
  { value: '', label: '전체' },
  // SE listing 은 URL 파라미터 collection 으로 카테고리 필터 가능 (제한적):
  { value: 'novels', label: 'Novels' },
  { value: 'short-stories', label: 'Short Stories' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'plays', label: 'Plays' },
  { value: 'nonfiction', label: 'Nonfiction' },
]

export const standardEbooksFetcher: SourceFetcher = {
  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    const offset = params.offset ?? 0
    const page = Math.floor(offset / PAGE_SIZE) + 1

    const url = new URL(LIST_URL)
    url.searchParams.set('per-page', String(PAGE_SIZE))
    url.searchParams.set('page', String(page))
    // sort: SE 의 ?sort=newest|author-alpha|reading-ease|length|title-alpha
    const sortMap: Record<string, string> = {
      recent: 'newest',
      newest: 'newest',
      alpha: 'author-alpha',
      'author-alpha': 'author-alpha',
      'title-alpha': 'title-alpha',
      'reading-ease': 'reading-ease',
      length: 'length',
    }
    url.searchParams.set('sort', sortMap[params.sort ?? 'newest'] ?? 'newest')
    // collection 우선 subjectSlug, 그 다음 genre
    const col = params.subjectSlug || params.genre
    if (col) url.searchParams.set('collection', col)
    // 키워드 검색
    if (params.search) url.searchParams.set('query', params.search)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Vocaflow-Curator/1.0 (https://vocaflow.app)',
        Accept: 'text/html',
      },
    })
    if (!res.ok) {
      throw new Error(
        `standard-ebooks HTTP ${res.status} — URL: ${url.toString()}` +
          (res.status === 401 || res.status === 403
            ? ' (공개 페이지 접근 거부 — Cloudflare bot challenge 가능)'
            : ''),
      )
    }
    const html = await res.text()
    const rows = parsePage(html)
    // 다음 페이지 여부 — pagination 링크 존재 확인
    const hasNext = /rel="next"|class="next"/.test(html) || rows.length === PAGE_SIZE

    return {
      source: 'standard_ebooks',
      total_available: null, // 전체 카운트는 페이지에 명시 안 됨
      fetched: rows,
      next_offset: hasNext ? offset + PAGE_SIZE : null,
    }
  },
  getOptions(): SourceOptions {
    return {
      sorts: [
        { value: 'newest', label: '최신순' },
        { value: 'author-alpha', label: '저자 알파벳' },
        { value: 'title-alpha', label: '제목 알파벳' },
        { value: 'reading-ease', label: '읽기 난이도' },
        { value: 'length', label: '분량순' },
      ],
      genres: GENRES,
      advanced: ['search', 'subjectSlug'],
      maxBatch: PAGE_SIZE,
      hint: 'Standard Ebooks — collection slug 로 카테고리 필터, sort 5종',
    }
  },
}
