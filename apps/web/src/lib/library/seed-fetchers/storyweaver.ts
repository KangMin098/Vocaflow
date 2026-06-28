// apps/web/src/lib/library/seed-fetchers/storyweaver.ts
//
// StoryWeaver (Pratham Books) seed fetcher — CC BY 4.0 다국어 그림책.
//   books-search JSON API (서버 fetch, UA 필수). 레벨 1-4 필터 + 키워드 검색.
//   목록엔 저자 미포함 → ingest(read API) 에서 채움. 레벨은 genre/subjects 로 보존.
//   est_v_level 은 분석(coverage) 이 SSoT — fetch 단계 미설정 (lit2go 와 동일 정책).

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const API = 'https://storyweaver.org.in/api/v1/books-search'
// StoryWeaver 는 Cloudflare 가 Node TLS(JA3) 핑거프린트를 403 차단 — 브라우저 UA 사용.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * StoryWeaver JSON fetch — undici fetch 우선, 실패(Cloudflare 403) 시 curl 폴백.
 *   Cloudflare 가 Node TLS 핸드셰이크를 핑거프린트 차단(curl 통과) → admin/dev 서버에서 curl 폴백.
 *
 * ⚠ 이 모듈은 BulkFetchTab('use client') 가 getOptions() 용으로 import → webpack client 번들에
 *   포함됨. child_process 를 정적 import 하면 client 번들 resolve 실패 (Module not found).
 *   curl 폴백은 fetchBatch(서버 전용 API 경로)에서만 실행되므로, node 모듈을 webpack 이
 *   추적 못 하는 간접 require 로 로드한다 (client 번들엔 child_process 미포함).
 */
async function swFetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (res.ok) return await res.json()
  } catch {
    /* 네트워크/TLS 오류 → curl 폴백 */
  }
  try {
    // ESM 서버 런타임엔 require 가 없음(Next.js 라우트). webpack 이 정적 분석 못 하는
    // 간접 동적 import 로 node 모듈 로드 — client 번들엔 미포함, 서버 ESM 에선 동작.
    const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>
    const cp = (await dynImport('node:child_process')) as typeof import('child_process')
    const util = (await dynImport('node:util')) as typeof import('util')
    const run = util.promisify(cp.execFile)
    const { stdout } = await run(
      'curl',
      ['-s', '--max-time', '30', '-H', `User-Agent: ${UA}`, '-H', 'Accept: application/json', url],
      { maxBuffer: 32 * 1024 * 1024 },
    )
    if (stdout && stdout.trim()) return JSON.parse(stdout)
    throw new Error('empty response')
  } catch (e) {
    throw new Error(
      `StoryWeaver books-search failed (fetch blocked + curl fallback): ${
        e instanceof Error ? e.message : String(e)
      }`,
    )
  }
}

interface SWBook {
  id: number
  title: string
  language: string
  level: string | null
  slug: string
  coverImage?: { sizes?: Array<{ url: string; width: number; height: number }> } | null
}

/** StoryWeaver 레벨(1-4) → 추정 V-Level. 레벨이 곧 난이도(leveled reader) — A1~B1 권역.
 *  최종 난이도는 analyze coverage 가 SSoT (이 값은 카탈로그 난이도 밴드 필터용 추정). */
function levelToEstV(level: string | null): number | null {
  switch ((level ?? '').trim()) {
    case '1':
      return 2 // A1
    case '2':
      return 3 // A1-A2
    case '3':
      return 4 // A2-B1
    case '4':
      return 5 // B1
    default:
      return null
  }
}

/** coverImage.sizes 중 리스트 썸네일에 맞는 ~320px 폭 선택 (없으면 첫/마지막). */
function pickCover(b: SWBook): string | null {
  const sizes = b.coverImage?.sizes
  if (!Array.isArray(sizes) || sizes.length === 0) return null
  let best = sizes[0]
  for (const s of sizes) {
    if (
      typeof s?.url === 'string' &&
      Math.abs((s.width ?? 0) - 320) < Math.abs((best?.width ?? 99999) - 320)
    ) {
      best = s
    }
  }
  const url = best?.url
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null
}

export const storyweaverFetcher: SourceFetcher = {
  getOptions(): SourceOptions {
    return {
      sorts: [{ value: 'popular', label: '관련/인기순 (기본)' }],
      genres: [
        { value: '', label: '레벨 전체' },
        { value: '1', label: 'Level 1 (입문 · 한 줄)' },
        { value: '2', label: 'Level 2 (쉬움)' },
        { value: '3', label: 'Level 3 (중급)' },
        { value: '4', label: 'Level 4 (긴 글)' },
      ],
      advanced: ['search'],
      maxBatch: 24,
      hint:
        'StoryWeaver (Pratham Books) — CC BY 4.0 그림책. 페이지별 삽화 + 낭독 오디오. ' +
        '레벨 1-4 = A1-B1 초급 학습자/아동 본체. 저자는 ingest 시 채워짐.',
    }
  },

  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    const { genre, limit = 24, offset = 0, search } = params
    const perPage = Math.min(Math.max(limit, 1), 48)
    const page = Math.floor(offset / perPage) + 1

    const qs = new URLSearchParams()
    // ⚠ 단수 `language=English` 는 books-search 가 무시 → 다국어(Hindi 등) 섞임.
    //   배열형 `languages[]=English` 만 실제 언어 필터를 적용한다 (라이브 검증 2026-06-28).
    qs.append('languages[]', 'English')
    qs.set('per_page', String(perPage))
    qs.set('page', String(page))
    if (genre && /^[1-4]$/.test(genre)) qs.append('reading_levels[]', genre)
    if (search && search.trim()) qs.set('query', search.trim())

    const json = (await swFetchJson(`${API}?${qs.toString()}`)) as {
      ok?: boolean
      metadata?: { hits?: number; totalPages?: number }
      data?: SWBook[]
    }
    const data = Array.isArray(json.data) ? json.data : []

    const fetched: SeedRow[] = data
      // slug 필수 + 영어만 (API 언어 필터가 느슨할 때를 대비한 방어 — 비영어 책 제외).
      .filter((b) => b && b.slug && (b.language ?? '').trim().toLowerCase() === 'english')
      .map((b, i) => ({
        source: 'storyweaver',
        source_id: b.slug || String(b.id),
        title: b.title,
        author: null, // books-search 미포함 — ingest(read API) 에서 채움
        author_birth_year: null,
        author_death_year: null,
        language: 'en',
        genre: b.level ? `Level ${b.level}` : null,
        subjects: ['storyweaver', 'picture-book', ...(b.level ? [`level-${b.level}`] : [])],
        popularity_rank: offset + i + 1, // API 기본 정렬 = 관련/인기 proxy
        cover_url: pickCover(b),
        source_url: `https://storyweaver.org.in/stories/${b.slug || b.id}`,
        published_year: null,
        word_count: null,
        description: null,
        reading_time_minutes: null,
        enriched_at: null,
        // 레벨은 신뢰 가능한 난이도 신호 → fetch 시점에 est_v_level 설정 (난이도 밴드 필터용).
        est_v_level: levelToEstV(b.level),
      }))

    const total = json.metadata?.hits ?? null
    const nextOffset = data.length === perPage ? offset + data.length : null
    return { source: 'storyweaver', total_available: total, fetched, next_offset: nextOffset }
  },
}
