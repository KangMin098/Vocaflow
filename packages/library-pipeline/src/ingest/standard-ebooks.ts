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
import { CHAPTER_GROUP_SEP, CHAPTER_HREF_SEP } from '../segment/segment'

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

  // 2.5. 목차(TOC) fetch → 섹션 id → 실제 챕터 URL 매핑 (best-effort).
  //   single-page 의 <section id="…"> 와 TOC href 의 fragment(또는 last segment) 가 동일 id →
  //   파일 분리형(/text/chapter-1)·앵커형(/text/fables#…)·명명형(/text/charmides)·중첩형
  //   (/text/chapter-1-1-1) 을 추측 없이 정확히 deep-link. 실패 시 빈 맵 → 렌더가 TOC 로 fallback.
  const hrefMap = await fetchChapterHrefMap(canonicalEbookUrl)

  // 3. HTML → plain text 변환 (chapter <section> 경계는 마커로 보존하여 segmenter가 분절)
  const raw_content = htmlToPlainText(fullHtml, hrefMap)

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
 * SE 도서 목차 페이지({ebookUrl}/text) 를 fetch → 섹션 id → 절대 챕터 URL 매핑.
 *
 * TOC 의 챕터 링크는 도서 구조마다 형식이 다르다 (검증된 4종):
 *   - 파일 분리형:  href="text/chapter-1"                    (단권 소설)
 *   - 앵커형:       href="text/fables#the-fox-and-the-grapes" (우화·시 모음 — 한 파일 내 #fragment)
 *   - 명명형:       href="text/charmides"                     (플라톤 대화편 등)
 *   - 중첩형:       href="text/chapter-1-1-1"                 (Les Mis 다권 volume-book-chapter)
 * 어느 형식이든 fragment(있으면) 또는 last path segment 가 single-page 의 <section id> 와 동일.
 * 이 id 를 키로 매핑하면 ingest 의 챕터 마커가 추측 없이 정확한 deep-link 를 싣는다.
 *
 * 실패(네트워크/파싱)는 비치명적 — 빈 맵 반환 (해당 책은 렌더 시 도서 TOC 로 fallback).
 */
async function fetchChapterHrefMap(canonicalEbookUrl: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const tocUrl = `${canonicalEbookUrl}/text`
    const res = await fetch(tocUrl, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return map
    const html = await res.text()
    // 목차 nav 의 모든 챕터 링크 href 추출 (상대경로 "text/…" 기준).
    for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
      const href = m[1]!
      // .../text/<tail> 형태만 (tail = 단일 세그먼트 + 선택적 #fragment)
      const tm = href.match(/(?:^|\/)text\/([^"/]+)$/)
      if (!tm) continue
      const tail = tm[1]! // 예: "chapter-1" | "fables#the-fox-and-the-grapes" | "charmides"
      const hashIdx = tail.indexOf('#')
      const id = hashIdx >= 0 ? tail.slice(hashIdx + 1) : tail
      if (!id || id === 'single-page') continue
      if (!map.has(id)) map.set(id, `${canonicalEbookUrl}/text/${tail}`)
    }
  } catch {
    // 네트워크 오류 — 빈 맵 (fallback)
  }
  return map
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
 * front/back-matter <section> 을 본문(+제목)째 제거 — 중첩 깊이 추적.
 *
 * SE 는 <section epub:type="frontmatter …"> / "backmatter …" 로 일관 태깅한다.
 * 이를 제거하지 않으면 **미주(endnotes, 수십만 단어)·부록·colophon 이 챕터로 적재**되어
 * (예: Gibbon idx 74 = 473k 미주 = 책의 30%) 단어추출·난이도·LibriVox 매핑을 오염시킨다.
 * 정규식 단순 치환은 중첩 <section> 에서 깨지므로 깊이 추적 토크나이저로 안전 제거.
 * (frontmatter 는 어차피 첫 챕터 이전이라 대부분 버려졌지만, backmatter 차단이 핵심.)
 */
// v06.35 — matter 제거의 안전망: 본문 단위를 품은 섹션은 지우지 않는다.
//
//   Personal Recollections of Joan of Arc 는 73개 chapter 가 세 개의
//   `<section epub:type="frontmatter part z3998:fiction">` 안에 중첩돼 있다.
//   (SE 가 이 책의 Book 1/2/3 을 그렇게 태깅했다 — 보통은 `part` 나 bodymatter 다.)
//   그래서 frontmatter 제거가 **본문 전체를 삼켰고**, raw_content 가 0바이트가 됐다.
//   실패는 한참 뒤 DB 에서 `store_content_chunk: empty content` 로 터져 원인이 안 보였다.
//
//   태깅 변종을 일일이 쫓는 대신 불변식을 둔다 — matter 판정이 틀려도 본문은 지킨다.
//   endnotes·colophon·copyright 같은 진짜 boilerplate 는 chapter 를 품지 않으므로
//   기존 제거 동작(Gibbon 473k 미주 차단 등)에 영향이 없다.
const UNIT_SECTION_RE =
  /epub:type="[^"]*\b(?:chapter|short-story|z3998:story|z3998:poem|z3998:fable)\b/i

/** 여는 <section> 위치에서 짝이 맞는 </section> 까지의 구간을 돌려준다 (없으면 끝까지). */
function sectionBody(html: string, openTagEnd: number): string {
  const re = /<section\b[^>]*>|<\/section\s*>/gi
  re.lastIndex = openTagEnd
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) return html.slice(openTagEnd, m.index)
  }
  return html.slice(openTagEnd)
}

function stripMatterSections(html: string): string {
  const re = /<section\b([^>]*)>|<\/section\s*>/gi
  let out = ''
  let pos = 0
  let depth = 0
  let skipDepth = -1 // 제거 중인 matter 섹션의 진입 시점 depth (-1 = 보존 모드)
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const isClose = m[0].startsWith('</')
    if (skipDepth === -1) {
      // 보존 모드 — 태그 직전까지 텍스트 방출
      out += html.slice(pos, m.index)
      if (!isClose) {
        const ty = (m[1]?.match(/epub:type="([^"]*)"/i)?.[1] ?? '').toLowerCase()
        if (
          /\b(?:frontmatter|backmatter)\b/.test(ty) &&
          // ★ 안전망 — 이 블록이 본문 단위를 품고 있으면 보존한다 (위 주석)
          !UNIT_SECTION_RE.test(sectionBody(html, re.lastIndex))
        ) {
          skipDepth = depth // 이 섹션부터 제거 시작 (여는 태그도 미방출)
          depth++
          pos = re.lastIndex
          continue
        }
        out += m[0]
        depth++
        pos = re.lastIndex
      } else {
        out += m[0]
        depth = Math.max(0, depth - 1)
        pos = re.lastIndex
      }
    } else {
      // 제거 모드 — 아무것도 방출하지 않음
      if (!isClose) {
        depth++
      } else {
        depth = Math.max(0, depth - 1)
        if (depth === skipDepth) {
          skipDepth = -1
          pos = re.lastIndex // 닫는 태그 직후부터 다시 보존
        }
      }
    }
  }
  out += html.slice(pos)
  return out
}

/**
 * SE single-page HTML → plain text 변환.
 * - front/back-matter 섹션 제거 (미주·부록 오염 차단)
 * - <section> 경계: 빈 줄 2개 (segmenter chapter 감지 도움)
 * - <h2>~<h6>: 줄바꿈 + 제목 (segmenter chapter 패턴 감지)
 * - <p>: 줄바꿈
 * - 기타 태그 stripped
 * - HTML entity 디코딩 (최소)
 */
/** export 이유: test/entity-decode.test.ts 회귀 (수치 엔티티 잔존 재발 방지). */
export function htmlToPlainText(html: string, hrefMap: Map<string, string> = new Map()): string {
  // 1. <body> 만 추출
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let work = bodyMatch ? bodyMatch[1]! : html

  // 2. <nav>, <footer>, <script>, <style> 제거 (boilerplate).
  //   ⚠ <header> 는 제거하지 않음 — SE 는 챕터 제목(hgroup)을 <section><header><hgroup>…
  //   으로 감싸므로(에피그래프 있는 챕터), header 를 지우면 제목이 사라져 일부만 null 됨.
  work = work.replace(/<(nav|footer|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')

  // 2.3. front/back-matter 섹션 제거 (미주·부록·colophon·titlepage 등) — 챕터 오염 차단.
  work = stripMatterSections(work)

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
      //   ⚠ 'z3998:subchapter'(간지 — General Observations·Digression 등)는 substring 으로
      //     'chapter' 에 오매칭되어 챕터 번호를 먹어 전체 번호가 밀렸다. subchapter 는 unit 에서
      //     제외 → 마커 없이 직전 챕터에 병합 (번호가 LibriVox 정통 Roman 과 정합).
      const isUnit = !ty.includes('subchapter') && UNIT_TYPES.some((k) => ty.includes(k))
      if ((useScenes && ty.includes('z3998:scene')) || isUnit) {
        chapterSeq++
        const title = chapterLabel(block)
        const secId = attrs.match(/\bid="([^"]*)"/i)?.[1] ?? ''
        let group = [curVolume, curBook].filter(Boolean).join(' › ')
        if (!group && useSubbook) {
          const pm = secId.match(/^(.*?)-chapter-\d+$/)
          if (pm?.[1]) group = slugToTitle(pm[1])
        }
        // 섹션 id 로 TOC 매핑 조회 → 정확한 원본 챕터 deep-link (없으면 미부착).
        const href = secId ? hrefMap.get(secId) : undefined
        const meta =
          `${title}` +
          (group ? CHAPTER_GROUP_SEP + group : '') +
          (href ? CHAPTER_HREF_SEP + href : '')
        const suffix = title || group || href ? `. ${meta}` : ''
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

  // 7. HTML entity 디코딩
  //    named 만 열거하면 수치 엔티티(&#8220; 등)가 본문에 남아 토큰 첫 글자를 먹는다
  //    (pressbooks 에서 실측된 결함 — 같은 whitelist 를 복사한 여기도 동일 위험) → generic fallback 필수.
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
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))

  // 8. whitespace 정규화 (3+ 개 newline → 2개)
  work = work.replace(/[ \t]+/g, ' ')
  work = work.replace(/\n{3,}/g, '\n\n\n')
  work = work.replace(/^[ \t]+|[ \t]+$/gm, '')

  return work.trim()
}
