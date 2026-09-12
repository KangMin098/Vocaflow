// packages/library-pipeline/src/compose/extract.ts
//
// ACP §20 재저작 — 기사 URL 에서 본문만 건져 내기.
//
// 왜 필요한가: 발행사 상당수가 쓸 만한 피드를 주지 않는다(AP 는 자기 robots 가 자기 피드를
// 막고, CBC 는 연결이 안 되며, 피드가 있어도 최근분만 싣는다). 그럴 때 운영자가 아는 기사
// 주소를 직접 넣는 길이 필요하다.
//
// ⚠ 본문 비보관 원칙은 그대로다. 여기서 뽑은 본문은 **지문을 뜨고 사실 카드를 적는 동안만**
//   존재하고 저장되지 않는다. 이 파일은 "무엇을 읽었는가" 를 만들 뿐 "무엇을 남기는가" 는
//   바꾸지 않는다.
//
// 추출 순서 — 신뢰도가 높은 것부터. 뉴스 페이지는 네비·광고·추천글이 본문보다 길어서
// 통째로 태그를 벗기면 사실이 아니라 소음을 읽게 된다.
//   ① JSON-LD `NewsArticle.articleBody` — 발행사가 기계용으로 스스로 제공한 본문
//   ② `<article>` · `[itemprop=articleBody]` — 시맨틱 마크업
//   ③ `<main>` — 그 다음
//   ④ 본문 밀도가 가장 높은 <div> — 최후 수단
// 어느 단계에서 건졌는지(`via`)를 함께 돌려준다. 품질이 의심스러울 때 근거가 된다.

import { decodeEntities } from '../ingest-article/_helpers'

export type ExtractVia = 'json-ld' | 'article-tag' | 'main-tag' | 'density' | 'none'

export interface ExtractedArticle {
  title: string | null
  /** 본문 — 저장하지 않는다. 지문을 뜨고 사실을 적는 동안만 쓴다. */
  text: string
  via: ExtractVia
  wordCount: number
  /** 문장 단위 — 원장 작성 화면이 "어떤 사실이 있었나" 를 훑는 데 쓴다. */
  sentences: string[]
  /** 발행 시각(있으면) — I15 판정 재료 */
  publishedAt: string | null
}

/** 본문 밖 요소는 통째로 지운다 — 남겨 두면 메뉴·광고 문구가 사실로 섞인다. */
const NOISE_BLOCKS =
  /<(script|style|noscript|nav|header|footer|aside|form|figure|figcaption|svg|iframe|template)\b[^>]*>[\s\S]*?<\/\1>/gi

function stripToText(html: string): string {
  return decodeEntities(
    html
      .replace(NOISE_BLOCKS, ' ')
      // 문단 경계를 공백으로 살려 둔다 — 안 그러면 문장이 서로 달라붙는다.
      .replace(/<\/(p|div|li|h[1-6]|br)\s*>/gi, ' \n ')
      .replace(/<br\s*\/?>/gi, ' \n ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function wordsOf(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

/** JSON-LD 에서 NewsArticle 계열을 찾아 articleBody·headline·datePublished 를 꺼낸다. */
export function fromJsonLd(html: string): {
  body: string | null
  title: string | null
  publishedAt: string | null
} {
  const out = { body: null as string | null, title: null as string | null, publishedAt: null as string | null }
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(m[1]!.trim())
    } catch {
      continue
    }
    // @graph · 배열 · 단일 객체를 모두 흡수한다(발행사마다 구조가 다르다).
    const nodes: unknown[] = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { '@graph'?: unknown[] })['@graph'])
        ? (parsed as { '@graph': unknown[] })['@graph']
        : [parsed]

    for (const n of nodes) {
      if (typeof n !== 'object' || n === null) continue
      const o = n as Record<string, unknown>
      const type = Array.isArray(o['@type']) ? (o['@type'] as string[]).join(' ') : String(o['@type'] ?? '')
      if (!/Article|NewsArticle|ReportageNewsArticle|BlogPosting/i.test(type)) continue
      if (!out.body && typeof o['articleBody'] === 'string' && o['articleBody'].trim()) {
        out.body = decodeEntities(o['articleBody']).replace(/\s+/g, ' ').trim()
      }
      if (!out.title && typeof o['headline'] === 'string') out.title = decodeEntities(o['headline']).trim()
      const d = o['datePublished'] ?? o['dateCreated']
      if (!out.publishedAt && typeof d === 'string') out.publishedAt = d
    }
  }
  return out
}

/** 지정 태그 안쪽 텍스트 중 가장 긴 것. */
function fromTag(html: string, tag: string): string | null {
  // 백슬래시 이스케이프 없이 쓴다 — `(?![a-z])` 가 단어 경계 역할을 하고 `[^]` 가 개행을 포함한다.
  // (템플릿 리터럴 안의 `\b` 는 정규식 경계가 아니라 백스페이스 문자로 해석돼 조용히 망가진다.)
  const re = new RegExp('<' + tag + '(?![a-z])[^>]*>([^]*?)</' + tag + '>', 'gi')
  let best = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const t = stripToText(m[1]!)
    if (t.length > best.length) best = t
  }
  return best.length > 0 ? best : null
}

/** itemprop=articleBody 컨테이너. */
function fromItemprop(html: string): string | null {
  const m = html.match(/<([a-z]+)\b[^>]*itemprop\s*=\s*["']articleBody["'][^>]*>([\s\S]*?)<\/\1>/i)
  return m ? stripToText(m[2]!) : null
}

/**
 * 본문 밀도가 가장 높은 블록 — 최후 수단.
 * `<p>` 가 많이 든 컨테이너가 본문일 확률이 높다는 흔한 휴리스틱.
 */
function byDensity(html: string): string | null {
  const re = /<div\b[^>]*>([\s\S]*?)<\/div>/gi
  let best = ''
  let bestScore = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const inner = m[1]!
    const paras = (inner.match(/<p\b/gi) ?? []).length
    if (paras < 3) continue
    const text = stripToText(inner)
    const score = paras * 20 + text.length
    if (score > bestScore) {
      bestScore = score
      best = text
    }
  }
  return best.length > 0 ? best : null
}

function metaContent(html: string, keys: string[]): string | null {
  for (const k of keys) {
    const m = html.match(
      new RegExp(`<meta[^>]+(?:property|name)\s*=\s*["']${k}["'][^>]*content\s*=\s*["']([^"']*)["']`, 'i'),
    )
    if (m?.[1]) return decodeEntities(m[1]).trim()
    const m2 = html.match(
      new RegExp(`<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]*(?:property|name)\s*=\s*["']${k}["']`, 'i'),
    )
    if (m2?.[1]) return decodeEntities(m2[1]).trim()
  }
  return null
}

/** 종결부호 뒤 공백 기준 문장 분할 (compose 전반과 같은 규칙). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** 본문으로 인정할 최소 어수 — 이 아래면 네비·오류 페이지일 확률이 높다. */
export const MIN_ARTICLE_WORDS = 60

/**
 * 본문 가장자리에 붙는 상투 조각.
 *
 * 실측(2026-08-18)에서 첫 문장이 BBC 는 `By Olivia Ireland`, DW 는 퍼머링크 URL,
 * 연합뉴스는 `Facebook` 이었다. 이런 조각이 사실 카드의 첫 줄이 되면 **기자 이름이 사건이
 * 되어 버린다.** 문장처럼 안 생긴 짧은 줄만 걷어 낸다 — 긴 문장은 건드리지 않는다.
 */
const EDGE_NOISE =
  /^(by\s|share\b|print\b|email\b|facebook\b|twitter\b|whatsapp\b|telegram\b|kakao\b|copy link|url is copied|advertisement\b|listen\b|read more\b|sign up\b|subscribe\b|follow us\b|related\b|more from\b|most read\b|recommended\b|you may also like|trending\b|sponsored\b|watch\b|published\b|updated\b|source:|photo:|image:|getty\b|comments?\b)/i

/**
 * 기사 끝에 딸려 오는 **다른 기사 제목**을 알아보는 최대 길이.
 *
 * 실측 2026-08-19 (코리아헤럴드 기사 1건): 추출된 45문장 중 **25문장이 본문이 아니었다** —
 * 기자 메일 주소, `Related Stories`, 그 아래 다른 기사 제목 여러 줄, 반응 카운터(`good` `0`
 * `sad` `0`), `More from Headlines`, 또 다른 제목들. 그런데 이전 규칙은 마침표가 없는 줄을
 * **2단어 이하일 때만** 걷어 내서, `Big Bang to release new single 'Biiig' on 20th anniversary`
 * 같은 제목 줄에서 다듬기가 멈췄고 그 뒤 24줄이 전부 살아남았다.
 *
 * 구분의 근거는 문장부호다 — 기사 문장은 `.`·`?`·`!` 로 끝나고 **제목 줄은 끝나지 않는다.**
 * 가장자리에서만 적용하므로 본문 중간의 짧은 문장은 그대로 둔다.
 */
const HEADLINE_MAX_WORDS = 20

/** `17 August 2026` · `August 17, 2026` · `2026-08-17` 처럼 날짜만 있는 줄. */
const DATE_ONLY =
  /^(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})[.,]?$/

/** 문장으로 보기 어려운 조각인가 — 짧고, 상투 표지에 걸리거나, 날짜뿐인 줄. */
function isEdgeNoise(s: string): boolean {
  const t = s.trim()
  if (t.length === 0) return true
  if (/^https?:\/\/\S+$/i.test(t)) return true
  if (DATE_ONLY.test(t)) return true
  const words = t.split(/\s+/).length
  // 마침표로 끝나지 않는 짧은 줄 — 다른 기사 제목·위젯 라벨·메일 주소다.
  if (words <= HEADLINE_MAX_WORDS && !/[.!?]$/.test(t)) return true
  // 상투 표지는 마침표가 붙어 있어도 걷어 낸다("URL is copied." 같은 위젯 문구).
  if (words <= 8 && EDGE_NOISE.test(t)) return true
  return false
}

/**
 * 앞뒤 상투 조각을 걷어 낸다. **가운데는 건드리지 않는다** — 본문 중간의 짧은 문장은
 * 사실일 수 있고, 잘못 지우면 사실이 사라진다. 가장자리만 보수적으로 다듬는다.
 */
export function trimBoilerplate(sentences: string[]): string[] {
  let b = cutAtSectionHeader(sentences)
  let a = 0
  while (a < b && isEdgeNoise(sentences[a]!)) a++
  while (b > a && isEdgeNoise(sentences[b - 1]!)) b--
  return sentences.slice(a, b)
}

/**
 * 발행사가 붙이는 **섹션 머리** — 여기부터는 본문이 아니다.
 *
 * 왜 문장부호만으로는 부족한가 (실측 2026-08-19): 연합뉴스 꼬리의 관련 기사 제목이
 * `BIGBANG to release new single on 20th anniv.` 처럼 **약어 마침표로 끝난다.** 문장처럼
 * 보이므로 "마침표 없는 줄" 규칙을 그냥 지나가고, 그 뒤 목록이 통째로 본문에 남는다.
 * 그런데 그 앞에는 발행사가 **`Related Articles` 라고 스스로 적어 두었다** — 그것이 더
 * 확실한 근거다.
 */
const SECTION_HEADER =
  /^(related\b|more from\b|most read\b|recommended\b|you may also like|trending\b|editor'?s? picks?\b|read next\b|latest\b)/i

/**
 * 섹션 머리가 나오는 자리를 찾아 본문의 끝으로 삼는다.
 *
 * **뒤쪽 절반에서만** 찾는다 — 본문 첫머리에 우연히 걸리면 기사 전체가 사라진다.
 * 머리글은 짧다(6단어 이하). 못 찾으면 원래 길이를 그대로 돌려준다.
 */
function cutAtSectionHeader(sentences: string[]): number {
  const from = Math.floor(sentences.length / 2)
  for (let i = sentences.length - 1; i >= from; i--) {
    const t = sentences[i]!.trim()
    if (t.split(/\s+/).length <= 6 && SECTION_HEADER.test(t)) return i
  }
  return sentences.length
}

/**
 * 기사 HTML → 본문.
 *
 * 어느 경로로 건졌는지(`via`)를 함께 돌려준다. `density` 로 건진 것은 신뢰도가 낮으니
 * 화면이 그렇게 표시해야 한다 — "추출은 됐는데 엉뚱한 걸 읽은" 경우를 사람이 잡을 수 있게.
 */
export function extractArticle(html: string): ExtractedArticle {
  const ld = fromJsonLd(html)

  const candidates: Array<{ text: string; via: ExtractVia }> = []
  if (ld.body) candidates.push({ text: ld.body, via: 'json-ld' })
  const ip = fromItemprop(html)
  if (ip) candidates.push({ text: ip, via: 'article-tag' })
  const art = fromTag(html, 'article')
  if (art) candidates.push({ text: art, via: 'article-tag' })
  const main = fromTag(html, 'main')
  if (main) candidates.push({ text: main, via: 'main-tag' })
  const dens = byDensity(html)
  if (dens) candidates.push({ text: dens, via: 'density' })

  // JSON-LD 는 발행사가 기계용으로 준 본문이라 길이와 무관하게 신뢰한다(최소치는 채워야 한다).
  // 그 외에는 **가장 긴 후보**를 고른다 — 우선순위만 따르면 `<main>` 에 걸린 요약(77어)에서
  // 멈춰 본문 전체를 놓친다(2026-08-18 Al Jazeera 실측).
  const usable = candidates.filter((c) => wordsOf(c.text) >= MIN_ARTICLE_WORDS)
  const picked =
    usable.find((c) => c.via === 'json-ld') ??
    usable.sort((x, y) => wordsOf(y.text) - wordsOf(x.text))[0] ??
    candidates[0]

  const sentences = trimBoilerplate(splitSentences(picked?.text ?? ''))
  const text = sentences.join(' ')

  return {
    title: ld.title ?? metaContent(html, ['og:title', 'twitter:title']) ?? fromTag(html, 'title'),
    text,
    via: picked?.via ?? 'none',
    wordCount: wordsOf(text),
    sentences,
    publishedAt:
      ld.publishedAt ??
      metaContent(html, ['article:published_time', 'og:article:published_time', 'date']),
  }
}
