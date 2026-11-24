// packages/library-pipeline/src/ingest/storyweaver.ts
// LCP — StoryWeaver (Pratham Books) ingester
//
// 다국어 그림책(책마다 라이선스가 뒷장에 있다 — 대개 CC BY 4.0 이지만 **책마다 읽는다**).
// API: /api/v1/stories/{id|slug}/read (server-side fetch 가능).
// 그림책 구조: FrontCoverPage | StoryPage×N | BackCoverPage.
//   - StoryPage = 1 페이지 = 1 문단(짧은 문장) + 1 삽화(coverImage.sizes 최대).
//   - 본문 = StoryPage 텍스트 '\n\n' join → 문단 인덱스 == 페이지 순서.
//   - illustrations = 페이지별 삽화 URL (링크), idx 가 본문 문단과 정합.
//   - audioPath = readalong mp3 (단일 스트림 낭독 — 워크스페이스 보이스).
// UA 필수 (빈 UA → 403). 텍스트는 content div 만 (삽화 div·스크립트·페이지번호 제거).

import type { RawBook, BookIllustration } from '../types'
import { storyweaverLicense, storyweaverPageText } from '../ingest-article/storyweaver'
import { licenseClassOf, type LicenseClass } from '../ingest-article/_curation-spec'

/**
 * 도서로 적재해도 되는 라이선스 분류. NC(restricted)·ND·모르는 조건은 성공 RawBook 으로 넘기지 않는다 —
 * DB 의 lb_compute_kr_safe() 는 'CC%' 를 모두 안전으로 계산하므로(2026-10-27 실측) 여기서 막지 않으면
 * 제한 CC 책이 「한국 안전」 으로 승격된다. 원 라이선스 표기는 덮지 않는다(오류 메시지에 그대로 남긴다).
 */
const BOOK_LOADABLE: ReadonlySet<LicenseClass> = new Set(['public_domain', 'cc0', 'cc_by', 'cc_by_sa'])

// StoryWeaver 는 Cloudflare 가 Node TLS(JA3) 핑거프린트를 403 차단 — 브라우저 UA 사용.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const API = 'https://storyweaver.org.in/api/v1'

/**
 * StoryWeaver JSON fetch — undici fetch 우선, 실패(Cloudflare 403/네트워크) 시 curl 폴백.
 *   Cloudflare 가 Node 의 TLS 핸드셰이크를 핑거프린트 차단하므로(curl 은 통과),
 *   admin/dev 서버 작업인 큐레이션 fetch 는 curl 로 폴백한다.
 */
async function swFetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (res.ok) return await res.json()
  } catch {
    /* 네트워크/TLS 오류 → curl 폴백 */
  }
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const run = promisify(execFile)
    const { stdout } = await run(
      'curl',
      ['-s', '--max-time', '30', '-H', `User-Agent: ${UA}`, '-H', 'Accept: application/json', url],
      { maxBuffer: 32 * 1024 * 1024 },
    )
    if (stdout && stdout.trim()) return JSON.parse(stdout)
    throw new Error('empty response')
  } catch (e) {
    throw new Error(
      `StoryWeaver fetch failed (fetch blocked + curl fallback): ${
        e instanceof Error ? e.message : String(e)
      } — ${url}`,
    )
  }
}

interface SWSize {
  url: string
  width: number
  height: number
}
interface SWPage {
  pageType: string
  html: string
  coverImage?: { sizes?: SWSize[] } | null
}
interface SWRead {
  ok?: boolean
  data?: {
    pages?: SWPage[]
    authors?: Array<{ name: string }>
    audioPath?: string | null
    isAudio?: boolean
    level?: string | null
    slug?: string
    language?: string
  }
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&#39;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
}

function decodeEntities(s: string): string {
  return s.replace(/&#?\w+;/g, (m) => {
    const named = ENTITIES[m]
    if (named) return named
    const dec = m.match(/^&#(\d+);$/)
    if (dec?.[1]) return String.fromCodePoint(Number(dec[1]))
    const hex = m.match(/^&#x([0-9a-fA-F]+);$/)
    if (hex?.[1]) return String.fromCodePoint(parseInt(hex[1], 16))
    return ' '
  })
}

/**
 * 책 한 권의 라이선스 — **본문(이야기)에 귀속된** 명시 라이선스만 인정한다.
 *
 * ⚠️ 2026-06-14 도입 때부터 이 적재기는 모든 책을 'CC BY 4.0' 으로 **하드코딩**했다 — 책별 근거 없이
 *    발행 20권이 전부 CC BY 4.0 표시를 받았다(2026-10-27 감사). ACP 기사 적재기의 파서를 그대로 쓴다.
 *
 * 근거 구조(StoryWeaver 뒷장 실측): "Story Attribution: … Released under CC BY 4.0 license." 뒤에
 * "Illustration Attribution: …" 처럼 기여자별 구간이 이어진다. 판정:
 *   1. StoryPage 밖 글에 「Story Attribution:」 구간이 있어야 하고, 그 구간 안에 해석되는 라이선스가 **정확히 하나**.
 *      삽화·표지·홍보 문구에만 CC 가 있으면 본문 권리 근거가 아니다 → null.
 *   2. 뒷장 어디든 「All rights reserved」 가 있으면 null(저작권 유보와 CC 공존을 허용으로 보지 않는다).
 *   3. 뒷장의 다른 모든 라이선스 언급(released/licensed under …)도 같은 값으로 해석돼야 한다 —
 *      해석 못 하는 조건·다른 조건이 하나라도 있으면 null(모르는 조건을 「조건 없음」 으로 읽지 않는다).
 * 형식은 기존 도서 표기('CC BY 4.0', 'CC BY-NC 4.0')로 맞춘다. 실제 원문 구조가 이와 다르면 멈추고 검수한다.
 */
export function storyweaverBookLicense(pages: ReadonlyArray<{ pageType: string; html?: string | null }>): string | null {
  const back = pages
    .filter((p) => p.pageType !== 'StoryPage')
    .map((p) => storyweaverPageText(p.html ?? ''))
    .join(' ')
  if (!back.trim()) return null
  if (/all rights reserved/i.test(back)) return null
  const story = back.match(/Story Attribution:([\s\S]*?)(?=\b[A-Z][a-z]+ Attribution:|$)/)?.[1]
  if (!story) return null
  // 라이선스를 말하는 문장 단위로 본다 — "4.0" 의 점에서 자르지 않도록 「점 + 공백」 에서만 끊는다
  // 한 문장에 언급이 여럿이면(「…CC BY 4.0 license; illustrations released under CC BY-NC…」) 언급마다 따로 본다 —
  // 파서는 첫 일치만 돌려주므로 문장째 넘기면 뒤 조건이 묻힌다.
  const mentions = (text: string) =>
    text
      .split(/(?<=\.)\s+/)
      .flatMap((s) => s.split(/(?=\b(?:released|licen[cs]ed)\s+under\b)/i))
      .filter((s) => /^(?:released|licen[cs]ed)\s+under\b/i.test(s.trim()))
  const read = (sentence: string) => storyweaverLicense(sentence)
  const storyLicenses = mentions(story).map(read)
  if (storyLicenses.length === 0 || storyLicenses.some((l) => !l)) return null
  const found = new Set(storyLicenses as string[])
  if (found.size !== 1) return null
  for (const s of mentions(back)) {
    const l = read(s)
    if (!l || !found.has(l)) return null
  }
  const [label] = [...found] // 'CC-BY-4.0' · 'CC-BY-NC-SA-4.0'
  const v = label!.match(/-(\d[\d.]*)$/)?.[1]
  const kind = label!.replace(/-\d[\d.]*$/, '').replace(/^CC-BY/, 'CC BY')
  return v ? `${kind} ${v}` : kind
}

/** StoryWeaver 페이지 html → 순수 본문 텍스트 (삽화 div·스크립트·페이지번호 제거). */
function cleanPageText(html: string): string {
  let t = html
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // 삽화 div (data-*-src 속성에 이미지 URL) 제거 — 본문 텍스트는 content div 에만
  t = t.replace(/<div[^>]*\billustration\b[^>]*>[\s\S]*?<\/div>/gi, ' ')
  t = t.replace(/<[^>]+>/g, ' ')
  // jQuery 잔여 ($(document).ready(...) 류) 제거
  t = t.replace(/\$\(document[\s\S]*$/g, ' ')
  t = decodeEntities(t)
  // 페이지 번호 마커 "N/M"
  t = t.replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, ' ')
  return t.replace(/\s+/g, ' ').trim()
}

/** coverImage.sizes 최대 크기 URL (마지막 = 최대). */
function largestImage(page: SWPage): string | null {
  const sizes = page.coverImage?.sizes
  if (!Array.isArray(sizes) || sizes.length === 0) return null
  const u = sizes[sizes.length - 1]?.url
  return typeof u === 'string' && /^https?:\/\//.test(u) ? u : null
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * StoryWeaver story 1권 ingest.
 * @param sourceId story id (예: '2') 또는 slug (예: '2-smile-please')
 */
export async function ingestFromStoryWeaver(sourceId: string): Promise<RawBook> {
  const key = sourceId.trim().replace(/^storyweaver:/, '')
  if (!key) throw new Error('StoryWeaver: empty source_id')

  const url = `${API}/stories/${encodeURIComponent(key)}/read`
  const json = (await swFetchJson(url)) as SWRead
  const d = json?.data
  if (!d || !Array.isArray(d.pages) || d.pages.length === 0) {
    throw new Error(`StoryWeaver: unexpected response shape for ${key}`)
  }

  const front = d.pages.find((p) => p.pageType === 'FrontCoverPage') ?? null
  const back = d.pages.find((p) => p.pageType === 'BackCoverPage') ?? null

  // 제목 — back_cover_title span 우선, fallback front cover 첫 줄
  let title = ''
  if (back) {
    const m = back.html.match(/back_cover_title[^>]*>([\s\S]*?)<\/span>/i)
    if (m?.[1]) title = stripTags(m[1])
  }
  if (!title && front) {
    title = cleanPageText(front.html).replace(/\s*Author:.*$/i, '').trim()
  }
  if (!title) title = `StoryWeaver ${key}`

  // 줄거리(synopsis) — back cover
  let description: string | undefined
  if (back) {
    const m = back.html.match(/synopsis[^>]*>([\s\S]*?)<\/p>/i)
    if (m?.[1]) {
      const syn = stripTags(m[1])
      if (syn) description = syn
    }
  }

  // 저자
  const author =
    Array.isArray(d.authors) && d.authors.length > 0
      ? d.authors.map((a) => a.name).filter(Boolean).join(', ')
      : 'Pratham Books'

  // 본문 + 삽화 — StoryPage 만 (페이지 순서 == 문단 idx)
  const story = d.pages.filter((p) => p.pageType === 'StoryPage')
  const paragraphs: string[] = []
  const illustrations: BookIllustration[] = []
  for (const p of story) {
    const text = cleanPageText(p.html)
    const img = largestImage(p)
    if (!text && !img) continue
    const idx = paragraphs.length
    // 삽화만 있고 텍스트 없는 페이지 → nbsp placeholder (idx 정합 유지)
    paragraphs.push(text || ' ')
    if (img) illustrations.push({ idx, url: img, ...(text ? { alt: text } : {}) })
  }
  if (paragraphs.length === 0) {
    throw new Error(`StoryWeaver: no story pages with content for ${key}`)
  }

  const raw_content = paragraphs.join('\n\n')

  // 표지 — front cover 삽화
  const cover_image_url = front ? largestImage(front) ?? undefined : undefined

  // 낭독 오디오 (readalong) — 단일 스트림
  const audio_url =
    d.isAudio && typeof d.audioPath === 'string' && /^https?:\/\//.test(d.audioPath)
      ? d.audioPath
      : undefined

  const slug = typeof d.slug === 'string' && d.slug ? d.slug : key

  // 라이선스를 책에서 못 읽으면 적재하지 않는다 — 수집 오류로 멈춰 검수로 넘긴다(허용으로 채우지 않는다).
  const license = storyweaverBookLicense(d.pages)
  if (!license) {
    throw new Error(`StoryWeaver: 라이선스를 책에서 읽지 못했다(뒷장 문장 없음·상충) — 검수 필요: ${key}`)
  }
  if (!BOOK_LOADABLE.has(licenseClassOf(license))) {
    throw new Error(`StoryWeaver: 도서로 적재할 수 없는 라이선스(${license} · ${licenseClassOf(license)}) — 검수 필요: ${key}`)
  }

  return {
    source: 'storyweaver',
    source_id: key,
    source_url: `https://storyweaver.org.in/stories/${slug}`,
    title,
    author,
    language: 'en',
    license,
    raw_content,
    fetched_at: new Date(),
    illustrations,
    ...(cover_image_url ? { cover_image_url } : {}),
    ...(audio_url ? { audio_url } : {}),
    ...(description ? { description } : {}),
  }
}
