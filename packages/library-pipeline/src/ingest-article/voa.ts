// packages/library-pipeline/src/ingest-article/voa.ts
// ACP v1.0 Phase 18 — VOA Learning English article ingester
//
// VOA Learning English: 미국의 소리 (U.S. federal government) — Public Domain.
// CEFR 3단계 등급 콘텐츠 (Level 1/2/3) 제공 — 학습 친화적 짧은 뉴스/스크립트.
//
// RSS feed:
//   https://learningenglish.voanews.com/api/zrgoqe$omp     (As It Is, Level 2-3)
//   https://learningenglish.voanews.com/api/zptp_e-p_t     (Science & Technology)
//   https://learningenglish.voanews.com/api/zjroyeuvy_     (Words and Their Stories, Level 3)
//   ... (각 카테고리별 RSS — VOA 가 RSS URL 직접 제공)
//
// source_id 형식: 'voa:<article_id>' 또는 URL slug
// MVP 동작: RSS 1개 카테고리 fetch → item N 개 → 각 item URL → HTML → transcript 추출

import type { RawArticle } from '../types-article'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'
import { safeDate, safeDateISO } from './_helpers'

// VOA WAF 는 비브라우저 UA (curl/bot) 를 403 차단 → 일반 브라우저 UA 로 fetch.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15_000
const MAX_ITEMS_PER_FEED = 20

/** VOA RSS feed 목록 — 카테고리별. id 는 admin UI 에서 선택.
 *  v06.44 — VOA endpoint 변경 (2026-06-14 확인):
 *    옛 /api/{slug} 형식 → 'Invalid url' 반환 (deprecated).
 *    새 /rss/?count=N&zoneid={N} 패턴 표준.
 *  zoneid 매핑 (main page navigation auto-discover):
 *    3521 = As It Is · 987 = Words & Their Stories · 1579 = Science & Tech
 *    952 = Lessons of the Day (Anna 시리즈 — Let's Learn English 대체)
 *  P2 — register gap 보강 2종 (zoneid 라이브 검증):
 *    1581 = American Stories (서사/narrative) · 955 = Health & Lifestyle (설명문/expository)
 */
export const VOA_FEEDS: Array<{ id: string; label: string; level: 1 | 2 | 3; url: string }> = [
  {
    id: 'as-it-is',
    label: 'As It Is (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=3521',
  },
  {
    id: 'words-and-their-stories',
    label: 'Words and Their Stories (Level 3)',
    level: 3,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=987',
  },
  {
    id: 'science-technology',
    label: 'Science & Technology (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=1579',
  },
  {
    id: 'lets-learn-english',
    label: "Let's Learn English (Level 1) — Lessons of the Day",
    level: 1,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=952',
  },
  // P2 — register gap 보강: 서사(American Stories) + 설명문(Health & Lifestyle).
  //   둘 다 frozen archive (FEED_SPECS frozen:true). zoneid 라이브 검증 완료.
  {
    id: 'american-stories',
    label: 'American Stories (Level 3) — 단편 서사',
    level: 3,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=1581',
  },
  {
    id: 'health-lifestyle',
    label: 'Health & Lifestyle (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=955',
  },
]

/**
 * RSS feed 의 최근 article N개 가져오기 (메타만 — 본문은 별도 fetch).
 * v06.41 — 큐레이션 spec 적용: 필터 + score + sort + top N (_curation-spec.ts)
 */
export interface VoaListItem {
  source_id: string // voa:<guid>
  title: string
  url: string
  published_at: string | null
  description: string
  /** 학습 친화도 score (0~1) + breakdown — v06.41 큐레이션 spec */
  score?: ArticleScore
  /** v06.45 — audio 보유 여부 (LCP 연계). VOA Learning English 는 학습 정체성으로 100% true */
  has_audio?: boolean
}

export async function listVoaFeed(
  feedUrl: string,
  feedId: string = 'as-it-is',
  _limit: number = MAX_ITEMS_PER_FEED,
): Promise<VoaListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) {
    throw new Error(`VOA RSS fetch failed: ${res.status}`)
  }
  const xml = await res.text()
  const raw = parseRssItems(xml)
  // v06.45 — VOA Learning English 는 모두 audio 가 article HTML 에 존재 (학습 정체성).
  //          list 단계에서 RSS 만으로는 확정 불가하지만 has_audio=true 휴리스틱.
  const withAudio = raw.map((it) => ({ ...it, has_audio: true }))
  return applyArticleCurationSpec(withAudio, 'voa', feedId)
}

/**
 * class 에 주어진 단어를 가진 첫 <div> 를 div 중첩을 세어 균형 있게 추출 (inner HTML).
 * 중첩 div(오디오 플레이어 등)로 시작하는 컨테이너를 non-greedy 정규식이 첫 `</div></div>`
 * 에서 잘라내던 문제 해결 — 매칭 div 의 진짜 짝을 찾아 컨테이너 전체를 반환.
 */
function extractDivByClass(html: string, className: string): string | null {
  const open = new RegExp(`<div[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'i').exec(html)
  if (!open) return null
  const start = open.index + open[0].length
  const tagRe = /<\/?div\b[^>]*>/gi
  tagRe.lastIndex = start
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return html.slice(start, m.index)
    } else {
      depth += 1
    }
  }
  return html.slice(start) // 짝 없으면 끝까지 (안전 폴백)
}

/**
 * 단일 VOA article fetch — RawArticle 반환 (ACP 파이프라인 입력).
 */
export async function ingestVoaArticle(itemUrl: string, hintLevel?: 1 | 2 | 3): Promise<RawArticle> {
  const res = await fetchWithTimeout(itemUrl, { Accept: 'text/html' })
  if (!res.ok) throw new Error(`VOA article fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const title = extractFirst(html, [
    /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    /<meta\s+name="title"\s+content="([^"]+)"/i,
    /<title>([^<]+?)(?:\s*\|\s*VOA)?<\/title>/i,
  ]) ?? '(제목 미상)'

  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
  ])

  // VOA 본문: <div class="wsw"> 컨테이너를 div 중첩 균형으로 추출.
  //   wsw 가 오디오 플레이어 div 로 시작해서, 기존 non-greedy `</div></div>` 정규식은
  //   첫 블록(~100자)에서 끊겨 본문(transcript) 22개 단락을 통째로 놓쳤음 → "too short" 오발.
  //   균형 추출 후 <p> transcript 우선(플레이어/캡션 잡음 배제), 빈약하면 컨테이너 전체.
  // wsw 컨테이너가 있어야 transcript 기사. <article>/whole-html 폴백은 클립(transcript 없는
  //   오디오/비디오)에서 nav·footer chrome 을 본문으로 긁으므로 쓰지 않음 — 없으면 reject.
  const containerHtml = extractDivByClass(html, 'wsw')
  if (!containerHtml) {
    throw new Error('VOA article has no transcript body (no wsw container — audio/video clip?)')
  }
  const paraText = htmlToPlainText(
    [...containerHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1] ?? '').join('\n'),
  )
  const content = (paraText.trim().length >= 200 ? paraText : htmlToPlainText(containerHtml))
    .replace(/no media source currently available\.?/gi, '') // VOA 오디오 플레이어 boilerplate
    .replace(/[ \t ]+/g, ' ')
    .trim()

  if (content.length < 200) {
    throw new Error(`VOA article body too short: ${content.length} chars`)
  }

  // source_id: URL 의 마지막 슬러그
  const slugMatch = itemUrl.match(/\/([a-z0-9\-]+)\/?(?:\?|$)/i)
  const sourceId = `voa:${slugMatch?.[1] ?? hashString(itemUrl).toString(36)}`

  // v06.45 — audio_url 추출 (LCP librivox_audio 와 동일 연계 패턴):
  //   VOA Learning English = 학습 정체성으로 거의 100% audio (transcript + voice).
  //   우선순위: <audio src="..."> → voa-audio.voanews.eu/*.mp3 → 일반 mp3.
  const audioUrl =
    html.match(/<audio[^>]+src="(https?:[^"]+\.mp3[^"]*)"/i)?.[1] ??
    html.match(/(https?:\/\/voa-audio\.voanews\.eu\/[^\s<>"']+\.mp3[^\s<>"']*)/i)?.[1] ??
    html.match(/(https?:[^\s<>"']+\.mp3[^\s<>"']*)/i)?.[1] ??
    null

  return {
    source: 'voa',
    source_id: sourceId,
    source_url: itemUrl,
    title: decodeEntities(title).trim(),
    author: 'VOA Learning English',
    language: 'en',
    license: 'PD-Government',
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: hintLevel ? VOA_LEVEL_TO_CEFR[hintLevel] : null,
    audio_url: audioUrl,
    fetched_at: new Date(),
  }
}

const VOA_LEVEL_TO_CEFR: Record<1 | 2 | 3, string> = {
  1: 'A2',
  2: 'B1',
  3: 'B2',
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseRssItems(xml: string): VoaListItem[] {
  const items: VoaListItem[] = []
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]!
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    const guid = extractTag(block, 'guid')
    const pubDate = extractTag(block, 'pubDate')
    const desc = extractTag(block, 'description')

    if (!link) continue
    // v06.45.1 — source_id 는 link URL 의 article ID 우선 (guid 가 URL 일 때
    //  옛 slugFromGuid 가 .html 의 'html' 만 매치해 모든 item 이 동일 ID 가 되는 버그 수정).
    //  우선순위: /1234567.html article ID → 끝 slug → link hash.
    const fromLink =
      link.match(/\/(\d{4,})\.html?$/)?.[1] ??           // /8010609.html 형식
      link.match(/\/([a-z0-9\-]{6,})\/?$/i)?.[1] ??      // /article-slug/
      null
    const slug = (fromLink && fromLink !== 'html')
      ? fromLink
      : (guid ? slugFromGuid(guid) : hashString(link).toString(36))
    items.push({
      source_id: `voa:${slug && slug !== 'html' ? slug : hashString(link).toString(36)}`,
      title: decodeEntities(title ?? '(제목 없음)').trim(),
      url: link.trim(),
      published_at: safeDateISO(pubDate),
      description: decodeEntities(stripTags(desc ?? '')).trim().slice(0, 400),
    })
  }
  return items
}

function extractTag(block: string, tag: string): string | undefined {
  // CDATA 와 일반 텍스트 모두 지원
  const re = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, 'i')
  const m = block.match(re)
  return (m?.[1] ?? m?.[2])?.trim()
}

function extractFirst(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

function slugFromGuid(guid: string): string {
  const m = guid.match(/([a-z0-9\-]+)\/?$/i)
  return m?.[1] ?? guid.replace(/[^a-z0-9\-]/gi, '').slice(0, 40)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n')
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}

async function fetchWithTimeout(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, text/html',
        ...extraHeaders,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}
