// packages/library-pipeline/src/ingest-article/_helpers.ts
// ACP v1.0 Phase 19 — Shared RSS / HTML / fetch utilities for article ingesters.
//
// VOA / NASA / NIH / wikinews / the_conversation / simple_wikipedia 모두 동일 패턴
// (RSS/atom parsing + HTML→text + timeout fetch) 사용.
// 본 파일이 단일 출처 — 각 ingester 가 import.

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface RssListItem {
  /** GUID 또는 link 해시 — caller 가 source prefix 추가 */
  guid: string | null
  title: string
  url: string
  published_at: string | null
  /** plain-text 짧은 설명 (CDATA + HTML stripped + entity decoded, 최대 400자) */
  description: string
}

/**
 * 표준 RSS 2.0 / Atom feed XML 을 파싱하여 item 배열 반환.
 * <item> 또는 <entry> 모두 지원 — 단순 정규식 기반 (의존성 0).
 */
export function parseRssFeed(xml: string): RssListItem[] {
  const items: RssListItem[] = []
  // RSS 2.0
  const rssItem = /<item\b[^>]*>([\s\S]*?)<\/item>/g
  // Atom
  const atomEntry = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g

  const blocks: string[] = []
  let m: RegExpExecArray | null
  while ((m = rssItem.exec(xml)) !== null) blocks.push(m[1]!)
  while ((m = atomEntry.exec(xml)) !== null) blocks.push(m[1]!)

  for (const block of blocks) {
    const title = extractTag(block, 'title')
    // Atom 은 <link href="..."/>, RSS 는 <link>url</link>
    const link =
      extractTag(block, 'link') ?? block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? null
    const guid = extractTag(block, 'guid') ?? extractTag(block, 'id') ?? null
    const pubDate = extractTag(block, 'pubDate') ?? extractTag(block, 'published') ?? null
    // v06.70 — The Conversation atom 의 <summary>(짧은 요약) vs <content>(풀 본문) 우선순위 수정.
    //   summary 우선 시 minDescriptionLen 가드 통과 못함 → content 가 있으면 우선.
    //   여러 후보 중 가장 긴 것 선택 (description/content/summary 모두 후보).
    const candidates = [
      extractTag(block, 'description'),
      extractTag(block, 'content'),
      extractTag(block, 'summary'),
    ].filter((s): s is string => typeof s === 'string' && s.length > 0)
    const desc = candidates.sort((a, b) => b.length - a.length)[0] ?? ''

    if (!link) continue
    items.push({
      guid,
      title: decodeEntities(title ?? '(제목 없음)').trim(),
      url: link.trim(),
      published_at: safeDateISO(pubDate),
      // v06.70 — entity-encoded HTML(&lt;p&gt;...&lt;/p&gt;) 처리:
      //   decodeEntities 먼저 → stripTags. 이전 순서는 stripTags 가 entity 못 풀어 HTML 태그 잔존.
      description: stripTags(decodeEntities(desc)).replace(/\s+/g, ' ').trim().slice(0, 400),
    })
  }
  return items
}

/**
 * 안전한 날짜 파싱 — `new Date(s)` 가 **Invalid Date**(truthy)를 만들 수 있어,
 * 이후 `.toISOString()` 이 "Invalid time value" 로 throw 되는 것을 차단.
 * 파싱 불가/빈 값이면 null 반환.
 */
export function safeDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 안전한 날짜 → ISO 문자열. 파싱 불가면 null (toISOString throw 차단). */
export function safeDateISO(s: string | null | undefined): string | null {
  return safeDate(s)?.toISOString() ?? null
}

/** HTML <tag> 내용 추출 (CDATA + 일반 텍스트 지원). 첫 매치만. */
export function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
    'i',
  )
  const m = block.match(re)
  return (m?.[1] ?? m?.[2])?.trim()
}

/** 여러 패턴 중 첫 매치 반환. */
export function extractFirst(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    // hex 수치 엔티티(&#x27; 등) — 이게 없어 owid/voa 제목에 &#x27; 잔존했음(v06.208 수정)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

/** Article body HTML → plain text (script/style/figure/aside 제거 + 줄바꿈 보존). */
export function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n')
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '\n')
  s = s.replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * ACP §18 §4-C — 텍스트 어휘 노이즈 비율 (0~1, numeric(4,3)).
 *   noise = (수식기호 + LaTeX + 인용마커 [n] + URL + sub/superscript) / 전체 토큰.
 * LaTeX·수식·인용 오염 탐지 — 0.08 초과 시 어휘 파이프라인 탈락(읽기용만).
 */
export function computeLexicalNoise(text: string): number {
  if (!text) return 0
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  let noise = 0
  for (const t of tokens) {
    if (
      /[∑∫√∞≤≥≈×÷±→←∂∇µλσθαβγπΔΩ]/.test(t) || // 수식 기호
      /\\[a-zA-Z]{2,}/.test(t) || // LaTeX 명령 (\alpha \frac)
      /\$[^$]*\$/.test(t) || // inline math $...$
      /^\[\d+(?:[,–-]\d+)*\]$/.test(t) || // 인용 [12] [3,4]
      /^https?:\/\//.test(t) || // URL
      /\^\{|_\{|\\\(|\\\)/.test(t) // sub/superscript, \( \)
    ) {
      noise++
    }
  }
  return Math.round((noise / tokens.length) * 1000) / 1000
}

/** Abort-friendly fetch with timeout + browser-like User-Agent. */
export async function fetchWithTimeout(
  url: string,
  options: {
    timeoutMs?: number
    accept?: string
    extraHeaders?: Record<string, string>
  } = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: options.accept ?? 'application/rss+xml, application/xml, text/xml, text/html',
        ...options.extraHeaders,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}
