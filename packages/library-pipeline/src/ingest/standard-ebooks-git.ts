// packages/library-pipeline/src/ingest/standard-ebooks-git.ts
//
// Standard Ebooks — 공개 저장소(GitHub)에서 직접 가져오는 인제스터.
//
// 왜 두 번째 경로인가:
//   ① 웹(single-page HTML) 경로가 대량 수집 뒤 차단됐다. Node 클라이언트만 연결이
//      끊기고(curl 은 통과) 하루 300권 넘게 받은 직후부터라, rate limit / 봇 보호로 보인다.
//      TLS 지문을 위장해 뚫는 대신, SE 가 **배포를 의도해 공개한 채널**로 옮긴다.
//   ② 읽는 순서를 추측하지 않는다. content.opf 의 spine 이 순서를 명시하므로
//      파일명 정렬(chapter-10 vs chapter-2) 같은 추측이 필요 없다.
//
// ⚠️ 분절에 대한 오해를 정정해 둔다: "파일이 곧 챕터" 가 아니다.
//   SE 저장소도 **대화편/작품 단위까지만** 나눈다 — 실측:
//       laws.xhtml 1,548KB (『법률』 12권 전체) · republic.xhtml 1,275KB (『국가』 10권 전체)
//   파일만 챕터로 쓰면 오히려 웹 경로보다 나빠진다(Plato 43챕터/133k → 27챕터/240k).
//   그래서 이 인제스터는 **파일을 받아 하나의 body 로 잇고, 내부 섹션 분절은
//   기존 htmlToPlainText 에 맡긴다.** 웹 경로와 동일한 입력이 되어 분절 품질이 같아지고,
//   달라지는 건 "어떻게 받아오는가" 뿐이다.
//
// 저장소 이름 규칙: source_id 의 '/' 를 '_' 로 (실측 4종 전부 200)
//   charles-dickens/a-christmas-carol            → charles-dickens_a-christmas-carol
//   plato/dialogues/benjamin-jowett              → plato_dialogues_benjamin-jowett
//   marcel-proust/in-search-of-lost-time/c-k-…   → marcel-proust_in-search-of-lost-time_c-k-…
//
// 반환은 기존 ingestFromStandardEbooks 와 **동일한 RawBook shape** — 이후 단계
// (normalize → segment → analyze)는 그대로 재사용한다.

import type { RawBook } from '../types'
import { htmlToPlainText } from './standard-ebooks'

const RAW_BASE = 'https://raw.githubusercontent.com/standardebooks'
const USER_AGENT = 'Vocaflow-LCP/2.0 (research)'

/** 저장소 기본 브랜치 후보 — SE 는 master 를 쓰지만 신규 저장소가 main 일 수 있다 */
const BRANCHES = ['master', 'main'] as const

/** 본문이 아닌 spine 항목 — 파일명 접두사로 판별 (content.opf 는 epub:type 을 안 싣는다) */
const NON_BODY_PREFIX =
  /^(titlepage|imprint|colophon|uncopyright|halftitlepage|dedication|epigraph|endnotes|loi|toc|copyright)/i

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) return null
  return res.text()
}

/** master → main 순으로 시도해 content.opf 를 찾고, 성공한 브랜치를 함께 돌려준다 */
async function fetchOpf(repo: string): Promise<{ opf: string; branch: string }> {
  for (const branch of BRANCHES) {
    const opf = await fetchText(`${RAW_BASE}/${repo}/${branch}/src/epub/content.opf`)
    if (opf) return { opf, branch }
  }
  throw new Error(`SE-git: content.opf 없음 — ${repo} (master/main 모두 실패)`)
}

/** XML 엔티티 + 태그 제거 → 평문 */
function stripTags(xml: string): string {
  return xml
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

/** <body> 안쪽 마크업 — 태그를 지우지 않는다. 분절은 htmlToPlainText 가 한다. */
function bodyMarkup(xhtml: string): string {
  return xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? xhtml
}

/** content.opf 의 dc: 메타데이터 */
function parseOpfMeta(opf: string): {
  title: string
  author?: string
  language: string
  license: string
} {
  const pick = (tag: string): string | undefined => {
    const m = opf.match(new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, 'i'))
    return m ? stripTags(m[1]!).trim() || undefined : undefined
  }
  return {
    title: pick('title') ?? 'Untitled',
    ...(pick('creator') !== undefined && { author: pick('creator') }),
    language: pick('language') ?? 'en',
    license: pick('rights') ?? 'PD-US',
  }
}

/**
 * Standard Ebooks 공개 저장소에서 raw 본문 + 메타 가져오기.
 *
 * @param sourceId 웹 경로와 **같은 형식** — '<author>/<title>[/<contributor>…]'
 *   내부에서 '/'→'_' 로 바꿔 저장소를 찾는다. 호출부는 기존 source_id 를 그대로 쓴다.
 */
export async function ingestFromStandardEbooksGit(sourceId: string): Promise<RawBook> {
  // 웹 인제스터와 동일한 검증 — URL 주입 차단
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/.test(sourceId)) {
    throw new Error(`Invalid Standard Ebooks source_id: ${sourceId}`)
  }
  const repo = sourceId.replace(/\//g, '_')

  const { opf, branch } = await fetchOpf(repo)
  const meta = parseOpfMeta(opf)

  // spine 이 읽는 순서다 — 파일명 정렬(chapter-10 vs chapter-2)로 추측하지 않는다
  const spine = [...opf.matchAll(/<itemref[^>]*idref="([^"]+)"/g)].map((m) => m[1]!)
  const bodyFiles = spine.filter((f) => !NON_BODY_PREFIX.test(f))
  if (bodyFiles.length === 0) {
    throw new Error(`SE-git: 본문 파일 0 — ${repo} (spine ${spine.length}개)`)
  }

  // spine 순서대로 파일을 받아 **하나의 body 로 잇는다**. 그러면 웹 single-page 와
  // 동일한 입력이 되어 htmlToPlainText 의 섹션 분절(epub:type 기반)이 그대로 적용된다
  // — 파일 하나가 『국가』 10권 전체인 경우에도 내부 섹션으로 나뉜다.
  const hrefMap = new Map<string, string>()
  const bodies: string[] = []
  let fetched = 0

  for (const file of bodyFiles) {
    const xhtml = await fetchText(`${RAW_BASE}/${repo}/${branch}/src/epub/text/${file}`)
    if (!xhtml) continue // 개별 파일 실패는 건너뛴다 — 책 전체를 버리지 않는다
    const markup = bodyMarkup(xhtml)
    if (markup.trim().length < 40) continue // 표지·간지 등 실질 본문 없음
    fetched++
    bodies.push(markup)

    // 파일 최상위 섹션 id → 원문 deep-link. 웹 경로가 TOC 를 긁어 만들던 맵을
    // 여기서는 파일명으로 직접 만든다(추측 없음).
    const slug = file.replace(/\.xhtml$/, '')
    for (const m of markup.matchAll(/<section\b[^>]*\bid="([^"]+)"/gi)) {
      if (!hrefMap.has(m[1]!)) {
        hrefMap.set(m[1]!, `https://standardebooks.org/ebooks/${sourceId}/text/${slug}`)
      }
    }
  }

  if (fetched === 0) throw new Error(`SE-git: 본문 파일 fetch 0 — ${repo}`)

  const raw_content = htmlToPlainText(`<html><body>${bodies.join('\n')}</body></html>`, hrefMap)
  if (!raw_content.trim()) throw new Error(`SE-git: 본문 추출 0 — ${repo}`)

  return {
    source: 'standard_ebooks',
    source_id: sourceId,
    source_url: `https://github.com/standardebooks/${repo}`,
    title: meta.title,
    ...(meta.author !== undefined && { author: meta.author }),
    language: meta.language,
    license: meta.license,
    raw_content,
    fetched_at: new Date(),
  }
}
