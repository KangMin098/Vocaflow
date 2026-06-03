// packages/library-pipeline/src/ingest/standard-ebooks.ts
// Phase 13 — Standard Ebooks ingester
//
// SE는 EPUB 외에도 single-page HTML reader 제공 → EPUB 파싱 없이 Gutenberg와
// 동일한 RawBook shape 반환 가능. 의존성 0 추가.
//
// URL 패턴:
//   메타: https://standardebooks.org/ebooks/<author-slug>/<title-slug>
//   본문: https://standardebooks.org/ebooks/<author-slug>/<title-slug>/text/single-page
//   OPDS: https://standardebooks.org/opds/all
//
// source_id 형식: "<author-slug>/<title-slug>" (예: "lewis-carroll/alice-s-adventures-in-wonderland")

import type { RawBook } from '../types'
import { CHAPTER_GROUP_SEP } from '../segment/segment'

const SE_BASE = 'https://standardebooks.org'
const USER_AGENT = 'Vocaflow-LCP/2.0 (research)'

interface SEMeta {
  title: string
  author?: string
  author_birth_year?: number
  author_death_year?: number
  language: string
  license: string
}

/**
 * Standard Ebooks source_id 로 raw 본문 + 메타 가져오기.
 * Rate limit: 60초당 5건 권장 (호출자 책임).
 *
 * @param sourceId "<author-slug>/<title-slug>[/<contributor-slug>...]"
 *   예: 'lewis-carroll/alice-s-adventures-in-wonderland'
 *       'honore-de-balzac/a-woman-of-thirty/ellen-marriage' (+ 번역자)
 *       'jacob-grimm_wilhelm-grimm/household-tales/margaret-hunt' (다중 저자 '_' 결합 + 번역자)
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromStandardEbooks(sourceId: string): Promise<RawBook> {
  // SE 슬러그: 소문자/숫자/하이픈/언더스코어(다중 저자) 세그먼트가 '/' 로 이어짐 (≥2: author/title).
  // 번역자·일러스트레이터 세그먼트가 추가될 수 있어 개수 제한 없음. '.'·공백·대문자 불허 (URL 주입 방지).
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/.test(sourceId)) {
    throw new Error(`Invalid Standard Ebooks source_id: ${sourceId}`)
  }

  const ebookUrl = `${SE_BASE}/ebooks/${sourceId}`

  // 1. 메타 fetch (SE는 illustrator 포함 canonical slug로 301 redirect 가능)
  const metaRes = await fetch(ebookUrl, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!metaRes.ok) {
    throw new Error(`SE meta fetch failed: ${metaRes.status} ${ebookUrl}`)
  }
  const metaHtml = await metaRes.text()
  const meta = parseMetaHtml(metaHtml)

  // canonical URL (redirect 따라간 후) 기준으로 single-page URL 파생
  const canonicalEbookUrl = metaRes.url.replace(/\/+$/, '')
  const textUrl = `${canonicalEbookUrl}/text/single-page`

  // 2. 단일 페이지 본문 fetch (모든 chapter 포함된 HTML)
  const textRes = await fetch(textUrl, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!textRes.ok) {
    throw new Error(`SE single-page fetch failed: ${textRes.status} ${textUrl}`)
  }
  const fullHtml = await textRes.text()

  // 3. HTML → plain text 변환 (chapter <section> 경계는 마커로 보존하여 segmenter가 분절)
  const raw_content = htmlToPlainText(fullHtml)

  return {
    source: 'standard_ebooks',
    source_id: sourceId,
    source_url: textUrl,
    title: meta.title,
    ...(meta.author !== undefined && { author: meta.author }),
    ...(meta.author_birth_year !== undefined && {
      author_birth_year: meta.author_birth_year,
    }),
    ...(meta.author_death_year !== undefined && {
      author_death_year: meta.author_death_year,
    }),
    language: meta.language,
    license: meta.license,
    raw_content,
    fetched_at: new Date(),
  }
}

/**
 * SE ebook 메타 HTML 에서 title / author / 생몰년 / language / license 파싱.
 * SE는 schema.org microdata 풍부하므로 정규식만으로 충분.
 */
function parseMetaHtml(html: string): SEMeta {
  const get = (re: RegExp): string | undefined => {
    const m = html.match(re)
    return m?.[1]?.trim()
  }

  // <h1 property="schema:name" ...>Title</h1> 또는 <title>Title — Standard Ebooks</title>
  const title =
    get(/<h1[^>]*property="schema:name"[^>]*>([^<]+)<\/h1>/) ??
    get(/<h1[^>]*>([^<]+)<\/h1>/) ??
    get(/<title>([^<—]+?)(?:\s*[—–-]\s*Standard Ebooks)?<\/title>/)

  if (!title) {
    throw new Error('SE meta: title not found')
  }

  // SE 패턴: <a property="schema:author" typeof="schema:Person" ...>
  //          <span property="schema:name">Author Name</span> ...
  // 1차: schema:author 블록 내부 schema:name span 추출 (nested)
  // 2차: 일반 <a property="schema:author">Direct Text</a> fallback
  const authorBlock = html.match(
    /<a[^>]*property="schema:author"[^>]*>([\s\S]*?)<\/a>/,
  )?.[1]
  const author =
    (authorBlock &&
      authorBlock.match(/<span[^>]*property="schema:name"[^>]*>([^<]+)<\/span>/)?.[1]?.trim()) ||
    get(/<a[^>]*property="schema:author"[^>]*>([^<]+)<\/a>/)

  // SE는 ebook page 에 birthDate/deathDate 직접 노출 안 함 — undefined.
  // (seed-enqueue 사용 시 curated-seed.json 의 값이 admin_enqueue_book 으로 직접 전달됨)
  const birth = get(/property="schema:birthDate"[^>]*content="(\d{4})/)
  const death = get(/property="schema:deathDate"[^>]*content="(\d{4})/)

  // SE는 모든 책이 PD 또는 CC0 (License: U.S. Public Domain or CC0)
  const license =
    get(/<a[^>]+href="\/licenses\/[^"]*"[^>]*>([^<]+)<\/a>/) ??
    'U.S. Public Domain'

  return {
    title: title,
    ...(author !== undefined && { author }),
    ...(birth !== undefined && { author_birth_year: parseInt(birth, 10) }),
    ...(death !== undefined && { author_death_year: parseInt(death, 10) }),
    language: 'en',
    license,
  }
}

/**
 * SE single-page HTML → plain text 변환.
 * - <section> 경계: 빈 줄 2개 (segmenter chapter 감지 도움)
 * - <h2>~<h6>: 줄바꿈 + 제목 (segmenter chapter 패턴 감지)
 * - <p>: 줄바꿈
 * - 기타 태그 stripped
 * - HTML entity 디코딩 (최소)
 */
function htmlToPlainText(html: string): string {
  // 1. <body> 만 추출
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let work = bodyMatch ? bodyMatch[1]! : html

  // 2. <nav>, <footer>, <script>, <style> 제거 (boilerplate).
  //   ⚠ <header> 는 제거하지 않음 — SE 는 챕터 제목(hgroup)을 <section><header><hgroup>…
  //   으로 감싸므로(에피그래프 있는 챕터), header 를 지우면 제목이 사라져 일부만 null 됨.
  work = work.replace(/<(nav|footer|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')

  // 2.5. SE 구조 섹션 → segmenter "CHAPTER N" 마커 주입 + 계층(Volume/Book·sub-book)을
  //   group_label 로 반영 (옵션 1-full — 평면 chapter_idx 유지, 계층은 별도 라벨).
  //   - chapter: "CHAPTER N. <순수 제목><US><group>" — 제목과 그룹을 U+001F 로 구분해 실어 보냄.
  //     segment.ts 가 분리하여 chapter_title / group_label 로 적재 (스키마 컬럼).
  //   - volume / part(=Book): 라벨만 기억 + heading 제거 (본문 오염 방지)
  //   - sub-book 합본(Green Forest 등 part 없음): chapter id prefix(…-chapter-N) 로 그룹.
  //   - SE 챕터 제목은 <hgroup><h_>로마숫자</h_><p epub:type="title">제목</p></hgroup> 구조라
  //     title 요소까지 추출 (<header>/<figure> 래퍼 건너뜀).
  const cleanTxt = (s: string | undefined): string =>
    (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const titleOf = (block: string | undefined): string =>
    cleanTxt(block?.match(/epub:type="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|span)>/i)?.[1])
  const structLabel = (block: string | undefined, kind: string): string => {
    const t = titleOf(block)
    if (t) return t
    const ord = cleanTxt(block?.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1])
    return ord ? `${kind} ${ord}` : ''
  }
  const chapterLabel = (block: string | undefined): string => {
    const t = titleOf(block)
    if (t) return t
    const all = cleanTxt(block)
    return /^[IVXLCDM\d]+\.?$/i.test(all) ? '' : all
  }
  // slug → 제목 ("lightfoot-the-deer" → "Lightfoot the Deer")
  const SMALL = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'for', 'at', 'by'])
  const slugToTitle = (slug: string): string =>
    slug
      .split('-')
      .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')

  // 사전 스캔: chapter id prefix 가 2종+ 이면 합본(sub-book) — 단일 책의 자기 slug 오그룹 회피.
  const subbookPrefixes = new Set<string>()
  for (const m of work.matchAll(/\bid="([^"]*?)-chapter-\d+"/gi)) subbookPrefixes.add(m[1]!)
  const useSubbook = subbookPrefixes.size > 1
  // 희곡 Scene 처리 — scene 이 2개 이상일 때만 Act 컨테이너를 그룹으로, z3998:scene 을
  // leaf 챕터로 (Hamlet: Act→Scene 다수 2층). 그리스 비극처럼 연극 전체가 단일 scene 이면
  // 유용한 분할이 아니므로 제외 → 기존 fallback (Agamemnon 등 회귀 방지).
  const useScenes = (work.match(/epub:type="[^"]*z3998:scene/gi) ?? []).length >= 2

  let chapterSeq = 0
  let curVolume = ''
  let curBook = ''
  // 콘텐츠 단위 epub:type — 소설 chapter 외에 단편/시 모음(article 기반)도 포함.
  //   (Just So Stories=se:short-story article · 시집=z3998:poem · 우화=z3998:fable)
  const UNIT_TYPES = ['chapter', 'short-story', 'z3998:story', 'z3998:poem', 'z3998:fable']
  work = work.replace(
    /<(?:section|article)\b([^>]*)>\s*(?:<header\b[^>]*>\s*)?(?:<figure\b[^>]*>[\s\S]*?<\/figure>\s*)?(<hgroup\b[^>]*>[\s\S]*?<\/hgroup>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>)?/gi,
    (_m: string, attrs: string, block: string | undefined) => {
      const ty = (attrs.match(/epub:type="([^"]*)"/i)?.[1] ?? '').toLowerCase()
      // 희곡 Act 컨테이너(scene 2개+ 보유 시) → Book(그룹) 레벨, leaf 아님. Act→Scene 2층.
      if (useScenes && ty.includes('z3998:drama') && ty.includes('chapter')) {
        curBook = chapterLabel(block) // "Act I"
        curVolume = '' // 희곡은 Volume 없음
        return '\n\n\n'
      }
      // leaf 단위: scene(scene 2개+) 또는 일반 unit(chapter/short-story/poem/fable)
      if ((useScenes && ty.includes('z3998:scene')) || UNIT_TYPES.some((k) => ty.includes(k))) {
        chapterSeq++
        const title = chapterLabel(block)
        let group = [curVolume, curBook].filter(Boolean).join(' › ')
        if (!group && useSubbook) {
          const pm = (attrs.match(/\bid="([^"]*)"/i)?.[1] ?? '').match(/^(.*?)-chapter-\d+$/)
          if (pm?.[1]) group = slugToTitle(pm[1])
        }
        const suffix =
          title || group ? `. ${title}${group ? CHAPTER_GROUP_SEP + group : ''}` : ''
        return `\n\n\nCHAPTER ${chapterSeq}${suffix}\n\n`
      }
      if (/\bvolume\b/.test(ty)) {
        curVolume = structLabel(block, 'Volume')
        curBook = '' // 새 Volume → Book 컨텍스트 리셋
        return '\n\n\n'
      }
      if (/\bpart\b/.test(ty)) {
        curBook = structLabel(block, 'Book')
        return '\n\n\n'
      }
      return '\n\n\n' // frontmatter 등 — 경계만 (heading 은 소비되어 본문 비오염)
    },
  )

  // 3. 나머지 section/article 경계 → 빈 줄 (위에서 미소비분 + 닫는 태그)
  work = work.replace(/<(?:section|article)\b[^>]*>/gi, '\n\n\n')
  work = work.replace(/<\/(?:section|article)>/gi, '\n\n')

  // 4. heading → "\n\n제목\n\n" (segmenter ALLCAPS/CHAPTER 패턴 감지)
  work = work.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, '\n\n$2\n\n')

  // 5. block-level → 줄바꿈
  work = work.replace(/<\/(p|div|li|blockquote|hr|br)>/gi, '\n')
  work = work.replace(/<br\s*\/?>/gi, '\n')

  // 6. 모든 남은 태그 strip
  work = work.replace(/<[^>]+>/g, '')

  // 7. HTML entity 디코딩 (최소)
  work = work
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')

  // 8. whitespace 정규화 (3+ 개 newline → 2개)
  work = work.replace(/[ \t]+/g, ' ')
  work = work.replace(/\n{3,}/g, '\n\n\n')
  work = work.replace(/^[ \t]+|[ \t]+$/gm, '')

  return work.trim()
}
