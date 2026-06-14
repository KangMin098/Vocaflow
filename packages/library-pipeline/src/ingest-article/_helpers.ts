// packages/library-pipeline/src/ingest-article/_helpers.ts
// ACP v1.0 Phase 19 — Shared RSS / HTML / fetch utilities for article ingesters.
//
// VOA / NASA / NIH / arXiv 모두 동일 패턴 (RSS parsing + HTML→text + timeout fetch) 사용.
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
    const desc =
      extractTag(block, 'description') ??
      extractTag(block, 'summary') ??
      extractTag(block, 'content') ??
      ''

    if (!link) continue
    items.push({
      guid,
      title: decodeEntities(title ?? '(제목 없음)').trim(),
      url: link.trim(),
      published_at: safeDateISO(pubDate),
      description: decodeEntities(stripTags(desc)).trim().slice(0, 400),
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
