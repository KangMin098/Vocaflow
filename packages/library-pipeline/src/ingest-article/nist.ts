// packages/library-pipeline/src/ingest-article/nist.ts
//
// **NIST (미국 표준기술연구소) — 이미 「채택」인데 `library_articles` 에 0행이던 소스.**
//
// ── 왜 이 소스인가 (정찰 실측 2026-09-08 · docs/reports/source-probe/tech-media.md §4-4) ──
// `SUMMARY.md` §2 가 오래전에 채택해 뒀는데 수확기가 없어 **한 편도 안 들어와 있었다.**
// 「기술·매체」 칸을 겨눌 때 가장 싼 답이 새 소스가 아니라 이것인 이유 셋:
//
//   · **명중률이 PLOS 의 3.7배** — 창 180어 단위 기술·매체 26.7% (PLOS 7.3% · Gutenberg 0.7%)
//   · **퍼블릭 도메인** — 미국 연방정부 저작물. 이 저장소가 nasa·usgs·noaa 를 받은 근거와 같다
//   · **등록(register)이 교재에 가깝다** — 569어 중앙값의 설명문이지 8,000어 논문이 아니다
//
// ── 대량 접근 경로는 사이트맵 하나뿐이다 ─────────────────────────────
// RSS 는 **40건 창**(뉴스 40 · 블로그 40)이고, HTML 목록(`/news-events/news`)은 **pager 가 JS**
// 라 서버 HTML 에 2쪽 이후가 없다. 남는 것은 사이트맵이고, 그것이 전수 열거다.
//
//     https://www.nist.gov/sitemap.xml            → 56 페이지 색인
//     https://www.nist.gov/sitemap.xml?page=N     → 페이지당 최대 2,000 loc
//
// **실측 2026-09-08 (전 56쪽 전수 열거 · 총 110,154 loc)**
//     news-events/news/  **6,991**   ← 기존 문서의 6,496 은 낮게 잡혀 있었다
//     blogs/             **2,022**
//     (그 밖: publications 74,515 · people 6,706 · itl 2,038 …)
//
// ⚠️ **「뉴스는 1~4쪽, 블로그는 4~5쪽」으로 줄여 잡지 않는다.** 실측에서 뉴스 1편이
//   **13쪽**에 있었다. 쪽 번호로 범위를 좁히면 그 1편은 오류 없이 영영 안 보인다 —
//   2026-08-16 IA 사고(정렬 없는 페이지 넘김 → 214건 중복 + 동수 누락)와 같은 부류다.
//   그래서 이 어댑터는 **색인이 말하는 쪽을 전부** 읽는다(약 11MB · 56 요청 · 1분).
//
// ── 열쇠: URL 경로다. 노드 id 가 있는데도 안 쓰는 이유를 적어 둔다 ────
// 기사 HTML 에는 Drupal 노드 id 가 있다(`<link rel="shortlink" href="/node/391921">`).
// 슬러그보다 나은 식별자지만 **사이트맵에는 없다** — 노드 id 로 열쇠를 잡으면 목록기가
// 편당 본문 GET 을 한 번씩 해야 열쇠를 만들 수 있고, 그러면 **이미 가진 9,013편을 다시
// 사 오고 나서야** 중복인 줄 알게 된다(Frontiers 가 순서를 뒤집었다가 600편 중 326편을
// 그렇게 버렸다). 그래서 **소스 자신의 열거 단위인 URL 경로**를 열쇠로 삼는다.
//   · 목록기는 사이트맵 loc 의 경로를, 적재기는 **`<link rel="canonical">`** 의 경로를
//     쓴다 — 요청 URL 이 아니라 정본 URL 이라 추적 파라미터·리다이렉트가 열쇠를 못 가른다.
//   · 감수하는 것: 슬러그가 바뀌면 같은 글이 새 행이 된다. NIST 뉴스 URL 은
//     `news-events/news/<연>/<월>/<슬러그>` 로 발행 시점에 고정되고 canonical 이
//     사이트맵과 같은 값이었다(표본 실측). 값싼 위험이라 받는다 — 대신 **해시로는
//     물러서지 않는다**(그 물러섬이 VOA 249행을 만들었다).
//
// ── 본문 (실측 함정 넷) ──────────────────────────────────────────────
//  1. **`<title>` 꼬리 `| NIST`** — 그대로 저장하면 분류기가 창마다 그것을 3번 읽는다
//     (`lib-topic.mjs` 의 `TITLE_REPEAT`). 정찰이 IPR 에서 명중률 51.1% → 43.4% 로 갈린
//     그 함정이다. `og:title` 을 먼저 보고, 없으면 `<title>` 의 `|` 뒤를 자른다.
//  2. **짧은 글이 섞인다** — 표본 12편 중 2편이 87어·139어(보도자료 스텁). 150어 미만은 버린다.
//  3. **본문 컨테이너는 `div.text-with-summary`** — 그 안에 figure 캡션·이미지 저작권
//     문구가 섞여 있다. 캡션을 남기면 창이 산문 게이트를 통과하면서 내용이 조각난다.
//  4. **후미 상용구** — "Media Contact" · "Follow us on" · "*Editor's note" · 배포 정보.
//     문단 단위로 잘라 낸다(위치가 아니라 **표식**으로 — 본문 중간의 인용을 안 죽인다).
//
// ── 라이선스 ─────────────────────────────────────────────────────────
// PD(미 연방정부 저작물). NIST 저작권 고지: *"...are in the public domain and are not
// subject to copyright protection in the United States."* 다만 **NIST 로고·직원 사진·
// 외부 제공 이미지는 예외**다 — 이 어댑터는 **텍스트만** 가져오므로 무관하다.

import type { RawArticle } from '../types-article'

import { decodeEntities, fetchWithTimeout, stripTags } from './_helpers'
import { sourceKey } from './source-key'

const NIST = 'https://www.nist.gov'

/** 사이트맵 색인 실측 쪽수(2026-09-08). 크게 달라지면 무언가 바뀐 것이라 수확기가 알린다. */
export const NIST_SITEMAP_PAGES_MEASURED = 56

/** 150어 미만은 버린다 — 정찰 §4-4 (표본 12편 중 2편이 87어·139어). */
export const NIST_MIN_WORDS = 150

/** 본문에 비ASCII 가 섞이는 일은 드물지만 상한은 Frontiers 와 같은 값으로 둔다. */
export const NIST_MAX_NON_ASCII = 0.02

export interface NistFeed {
  /** 피드 id = 커서 파일 이름의 일부 */
  id: string
  /** 사이트맵 경로 접두어 — 이 문자열로 loc 을 가른다 */
  prefix: string
  label: string
  /** 실측 편수 (2026-09-08 전수 열거) — 우선순위 판단용이지 상한이 아니다 */
  measured: number
  /** 왜 이 피드를 켰는지의 기록 */
  aimsAt: string
}

export const NIST_FEEDS: readonly NistFeed[] = [
  {
    id: 'news',
    prefix: 'news-events/news/',
    label: 'NIST 뉴스',
    measured: 6991,
    aimsAt: '기술·매체 (창 26.7%)',
  },
  {
    id: 'blogs',
    prefix: 'blogs/',
    label: 'NIST 블로그 (Taking Measure 외)',
    measured: 2022,
    aimsAt: '기술·매체 · 산문 등록',
  },
]

export function nistFeed(id: string): NistFeed | null {
  return NIST_FEEDS.find((f) => f.id === id) ?? null
}

// ═══════════════════════════════════════════════════════════════════
// 열쇠 — URL → 경로
// ═══════════════════════════════════════════════════════════════════

/**
 * `https://www.nist.gov/blogs/taking-measure/x?utm=1#top` → `blogs/taking-measure/x`.
 *
 * 소문자로 내린다(사이트맵은 전부 소문자였으나 canonical 이 대문자를 줄 여지를 막는다).
 * 호스트가 nist.gov 가 아니면 null — **남의 주소로 열쇠를 만들지 않는다.**
 */
export function nistPath(url: string | null | undefined): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!/(^|\.)nist\.gov$/i.test(u.hostname)) return null
  const p = u.pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
  return p ? p : null
}

// ═══════════════════════════════════════════════════════════════════
// 목록 — 사이트맵 전수 열거
// ═══════════════════════════════════════════════════════════════════

export interface NistListItem {
  /** `nist:<URL 경로>` — **적재기와 같은 함수**가 만든다 */
  source_id: string
  /** 접두어 없는 안정 식별자 = URL 경로. 커서 seen 에 들어가는 값 */
  path: string
  url: string
  /** 사이트맵 lastmod. 발행일이 아니라 **수정일**이다 — 발행일은 본문 meta 에서 읽는다 */
  lastmod: string | null
  feed: string
}

/** 색인이 말하는 사이트맵 쪽 주소 전부. **쪽 수를 우리가 가정하지 않는다.** */
export async function listNistSitemapPages(): Promise<string[]> {
  const res = await fetchWithTimeout(`${NIST}/sitemap.xml`, { accept: 'application/xml' })
  if (!res.ok) throw new Error(`NIST sitemap index failed: ${res.status}`)
  const xml = await res.text()
  const pages = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.trim())
  if (pages.length === 0) {
    throw new Error('NIST sitemap 색인에 sitemap 항목이 하나도 없다 — 형식이 바뀌었다')
  }
  return pages
}

/** 사이트맵 한 쪽 → `{path, url, lastmod}` 전부(피드 필터 이전). */
export async function fetchNistSitemapPage(
  pageUrl: string,
): Promise<Array<{ path: string; url: string; lastmod: string | null }>> {
  const res = await fetchWithTimeout(pageUrl, { accept: 'application/xml', timeoutMs: 60_000 })
  if (!res.ok) throw new Error(`NIST sitemap page failed: ${res.status} (${pageUrl})`)
  const xml = await res.text()
  const out: Array<{ path: string; url: string; lastmod: string | null }> = []
  // url 블록 단위로 읽는다 — loc 과 lastmod 를 따로 훑어 **순서로 짝짓지 않는다**
  //   (lastmod 없는 항목이 하나만 있어도 그 뒤가 전부 한 칸씩 밀린다. 실측 3건이 그랬다).
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = m[1]!
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim()
    if (!loc) continue
    const p = nistPath(loc)
    if (!p) continue
    out.push({
      path: p,
      url: loc,
      lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? null,
    })
  }
  return out
}

/**
 * **한 피드 전량.** 사이트맵 색인이 말하는 쪽을 전부 읽고 접두어로 거른다.
 *
 * 페이지 토큰을 돌려주지 않는다 — 이것은 페이지 넘김이 아니라 **전수 열거**다.
 * (VOA 사이트맵 수확기와 같은 성질. 커서가 담는 것은 다음-쪽이 아니라 seen 이다.)
 *
 * @param opts.onPage 쪽마다 부르는 진행 보고 — 1분짜리 열거를 말없이 하지 않기 위해서다.
 */
export async function listNistFeed(
  feedId: string,
  opts: { gapMs?: number; onPage?: (done: number, total: number, found: number) => void } = {},
): Promise<NistListItem[]> {
  const feed = nistFeed(feedId)
  if (!feed) {
    throw new Error(
      `NIST 피드 '${feedId}' 를 모른다. 쓸 수 있는 것: ${NIST_FEEDS.map((f) => f.id).join(' · ')}`,
    )
  }
  const pages = await listNistSitemapPages()
  const gap = opts.gapMs ?? 700
  const seen = new Set<string>()
  const items: NistListItem[] = []
  for (let i = 0; i < pages.length; i++) {
    const rows = await fetchNistSitemapPage(pages[i]!)
    for (const r of rows) {
      if (!r.path.startsWith(feed.prefix)) continue
      // 같은 경로가 두 쪽에 나오면 **한 번만** 센다 — 사이트맵이 중복을 준 적은 없으나
      //   중복이 오면 조용히 두 행이 되는 쪽이 훨씬 비싸다.
      if (seen.has(r.path)) continue
      seen.add(r.path)
      items.push({
        source_id: sourceKey('nist', { url: r.url }),
        path: r.path,
        url: r.url,
        lastmod: r.lastmod,
        feed: feed.id,
      })
    }
    opts.onPage?.(i + 1, pages.length, items.length)
    if (i < pages.length - 1 && gap > 0) await new Promise((res) => setTimeout(res, gap))
  }
  return items
}

// ═══════════════════════════════════════════════════════════════════
// 본문
// ═══════════════════════════════════════════════════════════════════

/** 여는 태그에서 시작해 depth 0 까지 — 자식 동명 태그에 속지 않는다. */
function sliceBalancedDiv(html: string, openIndex: number): string | null {
  if (openIndex < 0) return null
  const re = /<div\b[^>]*>|<\/div>/gi
  re.lastIndex = openIndex
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith('</')) depth--
    else depth++
    if (depth === 0) return html.slice(openIndex, m.index + m[0].length)
  }
  return null
}

/**
 * 본문 컨테이너. **못 찾으면 null — 문서 전체로 물러서지 않는다.**
 * 물러서면 머리말·꼬리말·메뉴가 지문이 되고, 그것은 오류 없이 통과한다.
 */
export function nistBodyHtml(html: string): string | null {
  const i = html.search(/<div\b[^>]*class="[^"]*\btext-with-summary\b[^"]*"[^>]*>/i)
  return sliceBalancedDiv(html, i)
}

/** 지문이 될 수 없는 구조 — 통째로 지운다. 캡션은 figure 안에 있다. */
const DROP_BLOCKS = [
  'figure',
  'figcaption',
  'table',
  'script',
  'style',
  'noscript',
  'aside',
  'form',
  'iframe',
]

function dropBlocks(html: string): string {
  let s = html
  for (const tag of DROP_BLOCKS) {
    s = s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ')
    s = s.replace(new RegExp(`<${tag}\\b[^>]*/>`, 'gi'), ' ')
  }
  return s
}

/**
 * **후미 상용구 표식.** 문단이 이것으로 시작하면 그 문단부터 끝까지 버린다.
 *
 * ⚠️ 위치("뒤 30%")가 아니라 표식으로 자른다 — 위치로 자르면 짧은 글의 본문이 잘린다.
 */
const TAIL_MARKER =
  /^\s*(?:\*?\s*editor'?s?\s*note|media contact|press contact|contact\s*:|for more information|follow (?:us|nist)\b|released\s+\w+\s+\d|updated\s*:|this (?:blog|article|post|story) (?:was )?(?:originally|first) (?:published|appeared)|disclaimer\s*:|about nist\b|related links?|paper\s*:|papers?\s*:|reference\s*:|references\s*:|read more about|learn more about nist)/i

/** 한 문단이 지문 문장이 아닌가 — 이미지 저작권·크레딧 줄. */
const CREDIT_LINE = /^\s*(?:credit|photo|image|illustration|source)s?\s*:/i

export interface NistBody {
  text: string
  paragraphs: number
  /** 후미 표식 뒤로 버린 문단 수 — 잘라 낸 규모를 눈으로 보게 한다 */
  droppedTail: number
  nonAsciiRatio: number
}

/** 컨테이너 HTML → 지문 텍스트. p 만 본다(목록·표는 산문이 아니다). */
export function nistExtractBody(containerHtml: string): NistBody {
  const clean = dropBlocks(containerHtml)
  const paras: string[] = []
  for (const m of clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = decodeEntities(stripTags(m[1]!))
      .replace(/\s+/g, ' ')
      .trim()
    if (t) paras.push(t)
  }
  let cut = paras.length
  for (let i = 0; i < paras.length; i++) {
    if (TAIL_MARKER.test(paras[i]!)) {
      cut = i
      break
    }
  }
  const kept = paras.slice(0, cut).filter((p) => !CREDIT_LINE.test(p))
  const text = kept.join('\n\n')
  const nonAscii = (text.match(/[^\x00-\x7F]/g) ?? []).length
  return {
    text,
    paragraphs: kept.length,
    droppedTail: paras.length - cut,
    nonAsciiRatio: text.length ? nonAscii / text.length : 0,
  }
}

function meta(html: string, re: RegExp): string | null {
  const m = html.match(re)
  if (!m) return null
  const v = decodeEntities(stripTags(m[1]!)).replace(/\s+/g, ' ').trim()
  return v || null
}

/**
 * **제목에서 사이트명 꼬리를 자른다** — 함정 1.
 * `og:title` 이 이미 깨끗하지만, 없을 때 title 태그로 물러서면 `| NIST` 가 딸려 온다.
 */
export function nistCleanTitle(raw: string): string {
  return raw
    .replace(/\s*[|–—]\s*NIST\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface NistArticle {
  source_id: string
  path: string
  url: string
  title: string
  author: string | null
  published_at: string | null
  content: string
  words: number
  body: NistBody
}

/**
 * 기사 한 편. **열쇠는 canonical 에서 만든다** — 요청 URL 이 리다이렉트를 타도 같은 값이 나온다.
 * 본문 컨테이너가 없으면 던진다(빈 글을 만들어 통과시키지 않는다).
 */
export async function fetchNistArticle(url: string): Promise<NistArticle> {
  const res = await fetchWithTimeout(url, { accept: 'text/html', timeoutMs: 45_000 })
  if (!res.ok) throw new Error(`NIST article failed: ${res.status} (${url})`)
  const html = await res.text()

  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? null
  const p = nistPath(canonical) ?? nistPath(url)
  if (!p) throw new Error(`NIST 경로를 못 읽었다: ${url}`)

  const container = nistBodyHtml(html)
  if (!container) throw new Error(`NIST 본문 컨테이너(div.text-with-summary)가 없다: ${url}`)
  const body = nistExtractBody(container)

  const title = nistCleanTitle(
    meta(html, /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i) ??
      meta(html, /<meta[^>]+name="dcterms\.title"[^>]+content="([^"]*)"/i) ??
      meta(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
      '',
  )
  if (!title) throw new Error(`NIST 제목을 못 읽었다: ${url}`)

  return {
    source_id: sourceKey('nist', { url: `${NIST}/${p}` }),
    path: p,
    url: canonical ?? url,
    title,
    author: meta(html, /<meta[^>]+name="dcterms\.creator"[^>]+content="([^"]*)"/i),
    published_at:
      meta(html, /<meta[^>]+property="article:published_time"[^>]+content="([^"]*)"/i) ??
      meta(html, /<meta[^>]+name="dcterms\.created"[^>]+content="([^"]*)"/i),
    content: body.text,
    words: (body.text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length,
    body,
  }
}

/** ACP 표준 적재 경로 — 다른 어댑터와 같은 모양으로 RawArticle 을 돌려준다. */
export async function ingestNistArticle(url: string): Promise<RawArticle> {
  const a = await fetchNistArticle(url)
  return {
    source: 'nist',
    source_id: a.source_id,
    source_url: a.url,
    title: a.title,
    author: a.author ?? undefined,
    language: 'en',
    // 미 연방정부 저작물. **표기는 지어내지 않고** usgs·noaa·factbook 이 이미 쓰는 문자열을
    //   그대로 쓴다(DB 실측 868행). 새 문자열을 만들면 `license_class` 매핑에서 조용히 빠진다.
    license: 'Public Domain (US Government)',
    published_at: a.published_at ? new Date(a.published_at) : null,
    content: a.content,
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}
