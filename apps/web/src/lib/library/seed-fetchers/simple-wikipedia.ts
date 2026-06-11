// Simple English Wikipedia — MediaWiki API 기반.
// 통제어휘 + 단순 문장 구조 위키 — q_learn=5 · Tier S (composite 4.6).
//
// v06.34 — Wikibooks 패턴 재사용 + Simple Wiki 특화 카테고리.
// 학습 친화 카테고리 우선 노출: Vital articles · Featured · Good articles · Schools.
//
// API: https://simple.wikipedia.org/w/api.php

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const API = 'https://simple.wikipedia.org/w/api.php'
const PAGE_SIZE = 50

// v06.34 — 실측 카테고리 (en.simple.wikipedia.org 멤버 수 검증)
// Featured articles · Sports · Very good articles 는 멤버 0건 → 제외
// 'Good articles' (47) 가 가장 안정적 정선 카테고리
const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'Good articles', label: 'Good Articles (정선)' },
  { value: 'Science', label: 'Science' },
  { value: 'History', label: 'History' },
  { value: 'Animals', label: 'Animals' },
  { value: 'Schools', label: 'Schools (학교)' },
  { value: 'Geography', label: 'Geography' },
  { value: 'People', label: 'People (인물)' },
  { value: 'Countries', label: 'Countries' },
]

interface CatMember {
  pageid: number
  title: string
  ns: number
}

interface CatResponse {
  query?: {
    categorymembers?: CatMember[]
    search?: Array<{ pageid: number; title: string; size: number; wordcount: number }>
    searchinfo?: { totalhits: number }
  }
}

export const simpleWikipediaFetcher: SourceFetcher = {
  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    const category = params.featuredOnly
      ? 'Good articles'
      : params.genre || 'Good articles'
    const offset = params.offset ?? 0
    const limit = Math.min(params.limit ?? PAGE_SIZE, 500)

    const useSearch = !!params.search
    const url = new URL(API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')
    if (useSearch) {
      url.searchParams.set('list', 'search')
      url.searchParams.set('srsearch', params.search!)
      url.searchParams.set('srnamespace', '0')
      url.searchParams.set('srlimit', String(limit))
      url.searchParams.set('sroffset', String(offset))
    } else {
      url.searchParams.set('list', 'categorymembers')
      url.searchParams.set('cmtitle', `Category:${category}`)
      url.searchParams.set('cmlimit', String(Math.min(offset + limit, 500)))
      url.searchParams.set('cmnamespace', '0')
      url.searchParams.set('cmsort', params.sort === 'recent' ? 'timestamp' : 'sortkey')
      if (params.sort === 'recent') url.searchParams.set('cmdir', 'desc')
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Vocaflow-Curator/1.0 (https://vocaflow.app)' },
    })
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          `Simple Wikipedia rate limit (HTTP 429) — 잠시 후 재시도 (보통 30초~1분)`,
        )
      }
      throw new Error(`simple_wikipedia HTTP ${res.status}`)
    }
    const data = (await res.json()) as CatResponse

    let rows: SeedRow[]
    let totalAvailable: number | null = null
    let hasMore = false

    const toTitleSlug = (t: string) => t.replace(/\s+/g, '_')

    if (useSearch) {
      const hits = data.query?.search ?? []
      totalAvailable = data.query?.searchinfo?.totalhits ?? null
      hasMore = hits.length === limit
      rows = hits.map((h) => ({
        source: 'simple_wikipedia',
        source_id: toTitleSlug(h.title),
        title: h.title,
        author: 'Wikipedia contributors',
        author_birth_year: null,
        author_death_year: null,
        language: 'en',
        genre: null,
        subjects: [],
        popularity_rank: null,
        cover_url: null,
        source_url: `https://simple.wikipedia.org/wiki/${encodeURIComponent(toTitleSlug(h.title))}`,
        published_year: null,
        word_count: h.wordcount,
      }))
    } else {
      const all = data.query?.categorymembers ?? []
      const slice = all.slice(offset, offset + limit)
      hasMore = offset + limit < all.length
      totalAvailable = all.length >= 500 ? null : all.length
      rows = slice.map((m) => ({
        source: 'simple_wikipedia',
        source_id: toTitleSlug(m.title),
        title: m.title,
        author: 'Wikipedia contributors',
        author_birth_year: null,
        author_death_year: null,
        language: 'en',
        genre: category,
        subjects: [category],
        popularity_rank: null,
        cover_url: null,
        source_url: `https://simple.wikipedia.org/wiki/${encodeURIComponent(toTitleSlug(m.title))}`,
        published_year: null,
        word_count: null,
      }))
    }

    return {
      source: 'simple_wikipedia',
      total_available: totalAvailable,
      fetched: rows,
      next_offset: hasMore ? offset + limit : null,
    }
  },

  getOptions(): SourceOptions {
    return {
      sorts: [
        { value: 'alpha', label: '카테고리 알파벳' },
        { value: 'recent', label: '최근 수정순' },
      ],
      genres: CATEGORIES,
      advanced: ['search', 'featuredOnly'],
      maxBatch: PAGE_SIZE,
      hint: '통제어휘 + 단순 문장. 카테고리별 평균 7~47권 (배치보다 적게 반환될 수 있음).',
    }
  },
}
