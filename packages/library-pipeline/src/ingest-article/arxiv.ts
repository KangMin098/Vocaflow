// packages/library-pipeline/src/ingest-article/arxiv.ts
// ACP v1.0 Phase 19 — arXiv abstract ingester
//
// arXiv = 학술 preprint 저장소. 본 ingester 는 **abstract 만** 추출 (논문 전문 X).
//
// License:
//   - 2022+ 대부분 논문: CC-BY 4.0 / CC0 / CC-BY-SA 등 명시
//   - 그 외: arXiv non-exclusive perpetual license — abstract 표시는 fair use
//   - abstract 만 추출하므로 보수적 표기: 'CC-BY-4.0' (대부분) — 정확한 라이선스는
//     analyze 단계에서 individual paper metadata 로 보강 권장
//
// Feeds (대표 카테고리만 — 학습자 친화 분야):
//   - cs.AI / cs.CL / cs.LG  (CS — AI/NLP/ML — 인기 분야)
//   - q-bio                  (Quantitative Biology)
//   - math.HO                (Math — History & Overview — 학습자 접근성 ↑)
//   - physics.gen-ph         (General Physics)
//
// source_id 형식: 'arxiv:<paper_id>' (예: 'arxiv:2401.12345')

import type { RawArticle } from '../types-article'

import {
  decodeEntities,
  fetchWithTimeout,
  hashString,
  parseRssFeed,
  stripTags,
} from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

export const ARXIV_FEEDS: Array<{ id: string; label: string; url: string; field: string }> = [
  {
    id: 'cs-AI',
    label: 'CS — Artificial Intelligence',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    field: 'cs.AI',
  },
  {
    id: 'cs-CL',
    label: 'CS — Computation & Language (NLP)',
    url: 'https://rss.arxiv.org/rss/cs.CL',
    field: 'cs.CL',
  },
  {
    id: 'cs-LG',
    label: 'CS — Machine Learning',
    url: 'https://rss.arxiv.org/rss/cs.LG',
    field: 'cs.LG',
  },
  {
    id: 'q-bio',
    label: 'Quantitative Biology',
    url: 'https://rss.arxiv.org/rss/q-bio',
    field: 'q-bio',
  },
  {
    id: 'math-HO',
    label: 'Math — History & Overview',
    url: 'https://rss.arxiv.org/rss/math.HO',
    field: 'math.HO',
  },
  {
    id: 'physics-gen-ph',
    label: 'Physics — General',
    url: 'https://rss.arxiv.org/rss/physics.gen-ph',
    field: 'physics.gen-ph',
  },
]

export interface ArxivListItem {
  source_id: string
  /** 'arXiv:2401.12345v1 ' prefix 제거된 깨끗한 제목 */
  title: string
  url: string
  published_at: string | null
  description: string
  /** 추출된 arXiv ID — 'arxiv:' prefix 없음 (예: '2401.12345') */
  arxiv_id: string
  /** v06.41 — 학습 친화도 score */
  score?: ArticleScore
  /** v06.45 — audio 보유 여부 (arXiv 학술 abstract → 대부분 false) */
  has_audio?: boolean
}

export async function listArxivFeed(
  feedUrl: string,
  feedId: string = 'cs-AI',
  _limit: number = 20,
): Promise<ArxivListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`arXiv RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  const raw = parseRssFeed(xml).map((it) => {
    const arxivId = parseArxivId(it.url) ?? parseArxivId(it.guid ?? '') ?? hashString(it.url).toString(36)
    const cleanTitle = it.title.replace(/^arXiv:\s*[\d.v]+\s*/i, '').trim()
    return {
      source_id: `arxiv:${arxivId}`,
      title: cleanTitle || it.title,
      url: it.url,
      published_at: it.published_at,
      description: it.description,
      arxiv_id: arxivId,
    }
  })
  return applyArticleCurationSpec(raw, 'arxiv', feedId)
}

/**
 * 단일 arXiv abstract ingestion.
 * - RSS description 에 이미 abstract 포함 → 별도 HTML fetch 불필요 (효율 ↑)
 * - feedUrl 가 주어지면 RSS 에서 직접 추출 (1 HTTP call)
 * - 미제공 시 arxiv.org/abs/{id} 파싱 fallback (2 HTTP call 비용)
 *
 * @param itemUrlOrId arxiv URL (예: https://arxiv.org/abs/2401.12345) 또는 ID
 * @param feedUrl     동일 카테고리 RSS URL (제공 시 효율 ↑)
 */
export async function ingestArxivArticle(
  itemUrlOrId: string,
  feedUrl?: string,
): Promise<RawArticle> {
  const arxivId = parseArxivId(itemUrlOrId) ?? itemUrlOrId.trim()
  if (!/^\d{4}\.\d{4,5}(?:v\d+)?$/.test(arxivId) && !/^[a-z\-]+\/\d{7}/i.test(arxivId)) {
    throw new Error(`Invalid arXiv ID: ${arxivId}`)
  }
  const absUrl = `https://arxiv.org/abs/${arxivId}`

  // Fast path: RSS feed 가 주어지면 거기서 직접 추출
  if (feedUrl) {
    try {
      // ingest 시점에는 spec 무관하게 raw item 만 필요 — 임의 feedId 로 호출 (filter 후 못 찾으면 fallthrough)
      const items = await listArxivFeed(feedUrl, 'cs-AI')
      const match = items.find((it) => it.arxiv_id === arxivId || it.url === absUrl)
      if (match && match.description.length >= 100) {
        return buildArticle(match.arxiv_id, match.title, match.description, absUrl, match.published_at)
      }
    } catch {
      // fallthrough to HTML fetch
    }
  }

  // Slow path: arxiv.org/abs/{id} HTML 페이지에서 abstract 추출
  const res = await fetchWithTimeout(absUrl, { accept: 'text/html' })
  if (!res.ok) throw new Error(`arXiv abs page fetch failed: ${res.status} ${absUrl}`)
  const html = await res.text()

  // <meta name="citation_title" content="..." />
  const title =
    html.match(/<meta\s+name="citation_title"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<h1[^>]*class="title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ??
    '(제목 미상)'

  // <blockquote class="abstract"> 안에 abstract — "Abstract: " prefix 제거
  const abstractMatch = html.match(
    /<blockquote[^>]*class="[^"]*abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i,
  )
  const abstractText = decodeEntities(stripTags(abstractMatch?.[1] ?? ''))
    .replace(/^\s*Abstract:?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (abstractText.length < 100) {
    throw new Error(`arXiv abstract too short: ${abstractText.length} chars`)
  }

  const submitMatch = html.match(/Submitted on\s*<[^>]*>([^<]+)<\/td>/i)
  const publishedAt = submitMatch?.[1]?.trim() ?? null

  return buildArticle(arxivId, decodeEntities(title).trim(), abstractText, absUrl, publishedAt)
}

function buildArticle(
  arxivId: string,
  title: string,
  abstractText: string,
  url: string,
  publishedAt: string | null,
): RawArticle {
  return {
    source: 'arxiv',
    source_id: `arxiv:${arxivId}`,
    source_url: url,
    title,
    author: 'arXiv contributors', // 정확한 author 는 abs page 메타에 있으나 단순화
    language: 'en',
    license: 'CC-BY-4.0', // 보수적 표기 — 실제 라이선스는 paper별 상이 가능
    published_at: publishedAt ? safeDate(publishedAt) : null,
    content: abstractText,
    estimated_cefr: 'C1', // 학술 abstract → C1 default (analyze 가 재검증)
    fetched_at: new Date(),
  }
}

// ─── helpers ─────────────────────────────────────

function parseArxivId(s: string): string | null {
  // 새 ID: YYMM.NNNNN(vN) 예: 2401.12345 / 2401.12345v2
  let m = s.match(/(\d{4}\.\d{4,5}(?:v\d+)?)/i)
  if (m) return m[1]!
  // 구 ID: arch-ive/YYMMNNN 예: cs/0301001
  m = s.match(/([a-z\-]+\/\d{7})/i)
  return m?.[1] ?? null
}

function safeDate(s: string): Date | null {
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
