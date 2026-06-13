// apps/web/src/lib/library/seed-fetchers/lit2go.ts
//
// Lit2Go (USF) seed fetcher.
//
// Lit2Go = University of South Florida 가 운영하는 K-12 학습용 짧은 지문/이야기/시 라이브러리.
// 본문은 Public Domain (저작권 소멸 작품), USF 가 쓴 줄거리/요약은 CC-BY (인용 의무).
//
// ─── 사용자 정책 (외부 비평 반영) ─────────────────────────────────────
//
// Lit2Go 가 주는 grade = "미국 학년 (Flesch-Kincaid)" 이다. EFL 한국 학습자 난이도와 다르다.
// 따라서 Vocaflow 정책:
//   1. Lit2Go US grade 는 `curation_meta.lit2go_grade` 로 보존 (cross-validate 신호용)
//   2. `est_v_level` 은 보정된 추정치 (필드는 채우되, FINAL v_level 은 analyze 단계에서
//      coverage 모델로 계산 — coverage 가 SSoT)
//   3. content_maturity (kids/teen/adult) — 미국 학년 + 장르 기반 별도 라벨
//      (낮은 grade=쉬운 영어이지만 10대에게 유치할 수 있음 — hi-lo 표시)
//
// URL 패턴:
//   목록 (장르별): https://etc.usf.edu/lit2go/genres/{genre-slug}/
//   목록 (학년별): https://etc.usf.edu/lit2go/readability/{grade-int}/
//   책 상세:    https://etc.usf.edu/lit2go/{book-id}/
//   passage:    https://etc.usf.edu/lit2go/{book-id}/{passage-slug}/
//
// source_id 형식: 'lit2go:{book-id}' (예: 'lit2go:91' for "Adventures of Sherlock Holmes")

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const LIT2GO_BASE = 'https://etc.usf.edu/lit2go'

// 사용자 정책 — US grade → est_v_level 보정 (final 은 coverage 가 SSoT).
// 미국 원어민 grade 가 EFL 한국 학습자 기준 +2 정도 어려움 (어휘 커버리지 지배).
// → conservative bump.
function lit2goGradeToEstVLevel(grade: number | null): number | null {
  if (grade == null || Number.isNaN(grade)) return null
  if (grade <= 2) return 4   // K-2 picture book/fable → V4 (A2/B1 어휘)
  if (grade <= 5) return 6   // 3-5 grade → V6 (B1)
  if (grade <= 8) return 7   // 6-8 grade → V7 (B1-B2)
  if (grade <= 12) return 8  // 9-12 grade → V8 (B2)
  return 9                   // college → V9 (C1)
}

// content_maturity — 미국 학년 + 장르 + 컬렉션 신호.
// "kids" = 유아용 picture-book/fable (10대에게 유치 가능)
// "teen" = 청소년 적합 모험·과학·역사
// "adult" = 성인 문학·고전·논픽션
function inferMaturity(grade: number | null, genre: string | null): 'kids' | 'teen' | 'adult' {
  const g = (genre ?? '').toLowerCase()
  if (g.includes('fable') || g.includes('fairy') || g.includes("children")) return 'kids'
  if (grade == null) return 'teen'
  if (grade <= 3) return 'kids'
  if (grade <= 8) return 'teen'
  return 'adult'
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
}

function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
}

// Lit2Go 카드 마크업 (USF 사이트 RDFa 미사용 — class 기반):
//   <li class="lit2go-item">
//     <a href="/lit2go/123/title-slug/">Title</a>
//     <p class="author">Author Name</p>
//     <p class="readability">Reading Level: 6.3</p>
//     <p class="genre">Adventure</p>
//     <p class="word-count">14,235 words</p>
//   </li>
// 실 마크업은 listing 페이지마다 약간 다름 — 보수적 정규식 사용.
function parseListing(html: string, sourceUrl: string): SeedRow[] {
  const rows: SeedRow[] = []
  // 1) item 블록 찾기 — Lit2Go 는 책 카드를 <article> or <li> 로 감쌈.
  //    href="/lit2go/{book-id}/" 패턴이 안정적인 식별 키.
  const cardRe = /<a\s+[^>]*href="\/lit2go\/(\d+)\/(?:([^"\/]+)\/)?"[^>]*>([^<]+)<\/a>([\s\S]{0,1200})/gi
  let m: RegExpExecArray | null
  const seen = new Set<string>()

  while ((m = cardRe.exec(html)) !== null) {
    const bookId = m[1]!
    if (seen.has(bookId)) continue
    seen.add(bookId)

    const title = stripTags(m[3] ?? '')
    if (!title || title.length < 2) continue

    const ctx = m[4] ?? ''

    // 저자
    const authorMatch = ctx.match(/<a[^>]+href="\/lit2go\/authors\/[^"]+"[^>]*>([^<]+)<\/a>/i)
    const author = authorMatch ? stripTags(authorMatch[1] ?? '') : null

    // 학년 (Flesch-Kincaid)
    const gradeMatch = ctx.match(/Reading\s+Level[^0-9]*([\d.]+)/i)
    const grade = gradeMatch ? parseFloat(gradeMatch[1] ?? '') : null

    // 장르 (Lit2Go 분류)
    const genreMatch = ctx.match(/<a[^>]+href="\/lit2go\/genres\/[^"]+"[^>]*>([^<]+)<\/a>/i)
    const genre = genreMatch ? stripTags(genreMatch[1] ?? '') : null

    // 단어 수
    const wcMatch = ctx.match(/([\d,]+)\s*words?/i)
    const wordCount = wcMatch
      ? parseInt((wcMatch[1] ?? '').replace(/,/g, ''), 10)
      : null

    // 표지 (Lit2Go 는 cover 가 거의 없음 — title 페이지에서만 가져옴)
    const coverMatch = ctx.match(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png))"/i)
    const cover = coverMatch?.[1] ?? null

    const estV = lit2goGradeToEstVLevel(grade)
    const maturity = inferMaturity(grade, genre)

    rows.push({
      source: 'lit2go',
      source_id: `lit2go:${bookId}`,
      title,
      author,
      author_birth_year: null,
      author_death_year: null,
      language: 'en',
      genre,
      subjects: genre ? [genre] : [],
      popularity_rank: null,
      cover_url: cover && cover.startsWith('http') ? cover : cover ? `https://etc.usf.edu${cover}` : null,
      source_url: `${LIT2GO_BASE}/${bookId}/`,
      published_year: null,
      word_count: wordCount,
      // enriched 후보 — bulk fetch 직후 보강 가능
      description: null,
      reading_time_minutes: wordCount ? Math.round(wordCount / 200) : null,
      enriched_at: null,
    })

    // est_v_level / content_maturity / lit2go_grade 는 enqueue 시
    // `library_seed_catalog.curation_meta` JSONB 로 적재 (별도 호출자가).
    // SeedRow 인터페이스는 공통이므로 여기선 추가 필드 X — meta 보존 위해
    // (실제 적재는 enqueueSeedRow 가 row.source 기반 추가 메타 처리)
    void estV
    void maturity
    void sourceUrl
  }

  return rows
}

const LIT2GO_GENRE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '장르 전체' },
  { value: 'adventure', label: 'Adventure (모험)' },
  { value: 'fable', label: 'Fable (우화)' },
  { value: 'fairy-tale', label: 'Fairy Tale (동화)' },
  { value: 'fiction', label: 'Fiction (소설)' },
  { value: 'historical-fiction', label: 'Historical Fiction (역사 소설)' },
  { value: 'mystery', label: 'Mystery (추리)' },
  { value: 'mythology', label: 'Mythology (신화)' },
  { value: 'nonfiction', label: 'Nonfiction (논픽션)' },
  { value: 'poetry', label: 'Poetry (시)' },
  { value: 'science-fiction', label: 'Science Fiction (SF)' },
  { value: 'short-story', label: 'Short Story (단편)' },
]

function gradeBandToReadabilityPath(band: FetchBatchParams['lit2goGradeBand']): string | null {
  switch (band) {
    case 'k-2':  return 'readability/0-1-2-3'
    case '3-5':  return 'readability/4-5-6'
    case '6-8':  return 'readability/7-8-9'
    case '9-12': return 'readability/10-11-12'
    default:     return null
  }
}

async function fetchListingPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Vocaflow-LCP/2.0 (admin curation)',
      Accept: 'text/html',
    },
  })
  if (!res.ok) {
    throw new Error(`Lit2Go listing fetch failed: ${res.status} ${url}`)
  }
  return await res.text()
}

export const lit2goFetcher: SourceFetcher = {
  getOptions(): SourceOptions {
    return {
      sorts: [
        { value: 'popular', label: 'Lit2Go 기본순' },
        { value: 'alpha', label: '제목 가나다순' },
      ],
      genres: LIT2GO_GENRE_OPTIONS,
      advanced: ['search', 'lit2goGradeBand', 'lit2goAudioOnly'],
      maxBatch: 40,
      hint:
        'USF Lit2Go — K-12 학습 지문·시·단편. 본문 PD / USF 요약 CC-BY. ' +
        '⚠ 제공 grade 는 미국 원어민 학년 (Flesch-Kincaid). EFL 난이도 ≠ — coverage 모델이 SSoT.',
    }
  },

  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    const { genre, lit2goGradeBand, limit = 32, offset = 0, search } = params

    // 우선순위: gradeBand > genre > search > 전체
    let listingUrl = `${LIT2GO_BASE}/books/`
    if (lit2goGradeBand && lit2goGradeBand !== 'all') {
      const path = gradeBandToReadabilityPath(lit2goGradeBand)
      if (path) listingUrl = `${LIT2GO_BASE}/${path}/`
    } else if (genre && genre.length > 0) {
      listingUrl = `${LIT2GO_BASE}/genres/${encodeURIComponent(genre)}/`
    } else if (search && search.trim().length > 0) {
      listingUrl = `${LIT2GO_BASE}/?s=${encodeURIComponent(search.trim())}`
    }

    const html = await fetchListingPage(listingUrl)
    let allRows = parseListing(html, listingUrl)

    // search 가 있는데 grade/genre 검색이라 클라이언트 측 부분 매칭으로 추가 필터
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase()
      allRows = allRows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.author ?? '').toLowerCase().includes(q),
      )
    }

    // offset / limit 적용
    const slice = allRows.slice(offset, offset + limit)
    const nextOffset = offset + slice.length < allRows.length ? offset + slice.length : null

    return {
      source: 'lit2go',
      total_available: allRows.length,
      fetched: slice,
      next_offset: nextOffset,
    }
  },
}

// 외부에서 v-level/maturity 보정 필요 시 직접 호출 가능
export {
  lit2goGradeToEstVLevel,
  inferMaturity as lit2goInferMaturity,
}
