// packages/library-pipeline/src/ingest-article/storyweaver.ts
//
// **StoryWeaver (Pratham Books) — 초·중 이야기 지문.** 책마다 CC 라이선스가 글 안에 박혀 있다.
//
// ── 왜 이 소스인가 (실측 2026-09-02) ─────────────────────────────────
// 교재 지문 재고에 **이야기가 한 편도 없었다.** 초·중 창(42~173어)에 드는 글 154편의
// register 를 세면 expository 126 · news 62 · reference 2 · **narrative 0** 이고,
// 그 대부분(105편)이 NASA `image-article` — **사진 설명글**이다.
// 시중 초·중 독해 교재에서 이야기가 차지하는 몫을 생각하면 이건 재고 부족이 아니라
// **종류 부재**다. 편수를 늘려도 같은 사진 설명글이 늘 뿐이라 해결되지 않는다.
//
// ── 수준이 어수를 거의 결정한다 (실측 표본 149편) ────────────────────
//   Level 1  중앙 139어 · FK 1.99 · 중창 적중 69%   ← 통째로 쓴다
//   Level 2  중앙 335어 · FK 2.77 · 중창 14%        ← 발췌해야 한다
//   Level 3  중앙 807어 · FK 4.13 · 적중 0%         ← 발췌해야 한다
//
// 처음에 수준을 섞어 쟀을 때는 "중앙 193어 · 적중 20%" 로 나와 못 쓸 소스처럼 보였다.
// **평균이 답을 가렸다** — 이 소스는 "너무 길다" 가 아니라 어느 수준을 가져오느냐의 문제다.
//
// ⚠️ L3 을 목록에서 **지우지 않는다.** 통째로는 적중 0% 지만 난이도가 초5~6 에 가장 가깝고
//   (FK 4.13 vs 시중 4.42) **발췌 경로의 유일한 재료**다 — 그 칸이 후보 표본 400건 중
//   0건이었다. 지우면 메울 방법이 사라진다.
//
// ── 라이선스는 책마다 다르고, 책 안에 적혀 있다 ──────────────────────
// 뒷장(`BackInnerCoverPage`)에 "Story Attribution: … Released under CC BY 4.0 license."
// 가 글로 박혀 있다. 표본 149편 전부에서 찾혔다. **사이트 약관이 아니라 그 책의 표시를 읽는다**
// — 같은 플랫폼에도 CC BY-NC·CC BY-SA 가 섞이고, 그 차이가 발행 가능 여부를 가른다.
//
// ⚠️ 라이선스를 못 읽으면 **restricted 로 떨어뜨린다.** 못 읽었다는 것은 "CC 다" 가
//   아니라 "모른다" 이고, 모르는 것을 발행하면 그때는 되돌릴 수 없다.
//
// API: https://storyweaver.org.in/api/v1/books-search  (목록 · `levels[]` · `per_page` 상한 24)
//      https://storyweaver.org.in/api/v1/stories/<slug>/read  (본문)
// source_id: "storyweaver:<slug>"

import type { RawArticle } from '../types-article'

import { fetchWithTimeout, hashString } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const API = 'https://storyweaver.org.in/api/v1'

/**
 * 피드 = 읽기 수준. **통째로 쓸 수 있는 것과 발췌해야 쓸 수 있는 것을 갈라 적는다.**
 *
 * 실측(표본 40/수준): L1 중앙 139어·FK 1.99 · L2 335어·2.77 · L3 807어·4.13.
 * L3 은 통째로는 어수창 적중이 **0%** 지만, 난이도는 초5~6(3.5~5.5) 에 가장 가깝다 —
 * 그래서 **발췌 경로에서만** 쓴다(`excerptForBand`). 목록에서 지우면
 * 초5~6 칸을 메울 유일한 재료가 사라진다.
 */
export const STORYWEAVER_FEEDS: Array<{
  id: string
  label: string
  level: string
  /** 통째로 넣어도 되는가. `false` 면 발췌해야 교재 창에 든다. */
  wholeBookUsable: boolean
}> = [
  {
    id: 'level-1',
    label: 'StoryWeaver Level 1 — 초3~4 (중앙 139어 · FK 1.99)',
    level: '1',
    wholeBookUsable: true,
  },
  {
    id: 'level-2',
    label: 'StoryWeaver Level 2 — 발췌용 (중앙 335어 · FK 2.77)',
    level: '2',
    wholeBookUsable: false,
  },
  {
    id: 'level-3',
    label: 'StoryWeaver Level 3 — 발췌용 · 초5~6 재료 (중앙 807어 · FK 4.13)',
    level: '3',
    wholeBookUsable: false,
  },
]

export interface StoryweaverListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  level: string | null
  score?: ArticleScore
}

/** 목록 한 쪽의 상한. `per_page` 를 크게 줘도 **24 에서 잘린다**(실측) — 쪽을 넘겨야 한다. */
const PER_PAGE = 24
/** 목록에서 넘길 최대 쪽수. 남의 서버라 무한히 걷지 않는다. */
const MAX_PAGES = 20

interface RawBook {
  slug?: string
  title?: string
  level?: string
  description?: string
}

export function storyweaverBookUrl(slug: string): string {
  return `https://storyweaver.org.in/stories/${slug}`
}

function toItem(b: RawBook): StoryweaverListItem {
  const slug = b.slug ?? hashString(String(b.title ?? '')).toString(36)
  return {
    source_id: `storyweaver:${slug}`,
    title: (b.title ?? '(제목 미상)').trim(),
    url: storyweaverBookUrl(slug),
    // 그림책에는 발행일이 없다. **지어내지 않는다** — null 이 사실이다.
    published_at: null,
    description: (b.description ?? '').trim(),
    level: b.level ?? null,
  }
}

export async function listStoryweaverFeed(
  feedId: string = 'level-1',
  limit?: number
): Promise<StoryweaverListItem[]> {
  // ⚠️ **모르는 피드 이름에 조용히 Level 1 을 주지 않는다.**
  //   예전에는 `?? STORYWEAVER_FEEDS[0]` 이었고, `--level 3` 으로 부른 스크립트가
  //   **Level 1 책을 받아 놓고 "이미 있음 16" 이라고 보고했다.** 오류가 나지 않으니
  //   "L3 은 이미 다 넣었구나" 로 읽힌다 — 틀린 재고 판단으로 이어진다.
  const feed = STORYWEAVER_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    throw new Error(
      `StoryWeaver 피드 '${feedId}' 를 모른다. 쓸 수 있는 것: ${STORYWEAVER_FEEDS.map((f) => f.id).join(' · ')}`
    )
  }
  const want = limit ?? PER_PAGE * 2
  const items: StoryweaverListItem[] = []

  for (let page = 1; items.length < want && page <= MAX_PAGES; page++) {
    const url =
      `${API}/books-search?page=${page}&per_page=${PER_PAGE}` +
      `&languages%5B%5D=English&levels%5B%5D=${encodeURIComponent(feed.level)}`
    const res = await fetchWithTimeout(url)
    if (!res.ok) {
      if (items.length) break // 앞쪽은 받았다 — 받은 만큼은 쓴다
      throw new Error(`StoryWeaver list failed: ${res.status}`)
    }
    const json = (await res.json()) as { data?: RawBook[] }
    const got = json.data ?? []
    if (!got.length) break
    for (const b of got) items.push(toItem(b))
  }

  return applyArticleCurationSpec(items.slice(0, want), 'storyweaver', feedId, { maxItems: limit })
}

interface RawPage {
  pageType?: string
  html?: string
}

/**
 * 그림책 쪽에서 글만 뽑는다.
 *
 * ⚠️ `<script>` 를 **먼저** 지운다. 안 지우면 뷰어의 JS 가 낱말로 세어져
 *   231어짜리 책이 **997어**로 나온다(실측) — 교재 창 밖으로 밀려나 못 쓰는 책이 된다.
 */
export function storyweaverPageText(html: string): string {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d: string) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 쪽번호("3/10")는 글이 아니다 — 이야기 본문에 섞이면 문항 생성기가 문장으로 센다. */
export function stripPageNumbers(text: string): string {
  return text
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 뒷장에서 라이선스를 읽는다. **못 읽으면 null** — 짐작해서 CC 를 붙이지 않는다.
 *
 * 실측 형태: "Story Attribution: This story: The Red Raincoat is written by Kiran Kasturia.
 *             © Pratham Books, 2015. Some rights reserved. Released under CC BY 4.0 license."
 */
export function storyweaverLicense(backMatter: string): string | null {
  const m = backMatter.match(
    /Released under\s+(CC[ -]BY(?:[ -](?:NC|SA|ND|NC[ -]SA|NC[ -]ND))?)\s*([\d.]+)?\s*licen[cs]e/i
  )
  if (!m) return null
  const kind = m[1]!.replace(/\s+/g, '-').toUpperCase()
  return m[2] ? `${kind}-${m[2]}` : kind
}

/** 저작자 표시 — CC BY 계열은 표시가 의무라 못 읽으면 발행하면 안 된다. */
export function storyweaverAuthor(backMatter: string): string | null {
  return backMatter.match(/is written by\s+([^.]{2,80})\./i)?.[1]?.trim() ?? null
}

export async function ingestStoryweaverArticle(itemUrl: string): Promise<RawArticle> {
  const slug = itemUrl.match(/stories\/([a-z0-9-]+)/i)?.[1]
  if (!slug) throw new Error(`StoryWeaver URL 에서 slug 를 못 읽었다: ${itemUrl}`)

  const res = await fetchWithTimeout(`${API}/stories/${slug}/read`)
  if (!res.ok) throw new Error(`StoryWeaver read failed: ${res.status} ${itemUrl}`)
  const json = (await res.json()) as { data?: { pages?: RawPage[]; level?: string } }
  const pages = json.data?.pages ?? []
  if (!pages.length) throw new Error(`StoryWeaver 본문이 비었다: ${itemUrl}`)

  // 이야기 쪽과 앞뒤 표지를 **나눠서** 읽는다 — 표지 글(제목·저자·후원사 안내)이
  // 본문에 섞이면 지문 어수가 부풀고 첫 문단이 저작권 문구가 된다.
  const story = pages.filter((p) => p.pageType === 'StoryPage')
  const back = pages
    .filter((p) => p.pageType !== 'StoryPage')
    .map((p) => storyweaverPageText(p.html ?? ''))
    .join(' ')

  const content = stripPageNumbers(story.map((p) => storyweaverPageText(p.html ?? '')).join(' '))
  if (content.length < 80) {
    throw new Error(`StoryWeaver 본문이 너무 짧다: ${content.length}자 ${itemUrl}`)
  }

  const license = storyweaverLicense(back)
  const author = storyweaverAuthor(back)

  return {
    source: 'storyweaver',
    source_id: `storyweaver:${slug}`,
    source_url: itemUrl,
    title: (
      back.match(/^([^:]{2,90}?)\s+Author:/)?.[1] ?? slug.replace(/^\d+-/, '').replace(/-/g, ' ')
    ).trim(),
    author: author ?? 'StoryWeaver (Pratham Books)',
    language: 'en',
    // 못 읽었으면 `restricted` — "모른다" 를 "허용" 으로 바꾸지 않는다.
    license: license ?? 'restricted',
    published_at: null,
    content,
    // 읽기 수준이 메타데이터에 있다. Level 1 ≈ A1, Level 2 ≈ A2.
    estimated_cefr: json.data?.level === '1' ? 'A1' : json.data?.level === '2' ? 'A2' : null,
    fetched_at: new Date(),
  }
}
