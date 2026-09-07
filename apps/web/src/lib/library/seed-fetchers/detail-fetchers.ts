// 책별 디테일 페이지 enrich — Gutenberg / Standard Ebooks.
// listing 페이지엔 없는 description·subjects·published year·word count 추출.

export interface DetailFields {
  description?: string | null
  subjects?: string[]
  published_year?: number | null
  word_count?: number | null
  reading_time_minutes?: number | null
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
}
function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
}

async function fetchWithTimeout(url: string, ms = 15_000): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Vocaflow-Curator/1.0', Accept: 'text/html' },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

// Gutenberg 디테일: /ebooks/{id}
//   <table class="bibrec"> 안 tr 들 — Subject, Author, Release Date, Bookshelf, Language 등
//   description 없음 (Gutenberg 메타 부재)
export async function fetchGutenbergDetail(sourceId: string): Promise<DetailFields> {
  const html = await fetchWithTimeout(`https://www.gutenberg.org/ebooks/${sourceId}`)

  const subjects: string[] = []
  // <tr property="dcterms:subject"><td><a>Subject</a></td></tr>
  const subjRe = /<tr[^>]+property="dcterms:subject"[^>]*>([\s\S]*?)<\/tr>/g
  let m: RegExpExecArray | null
  while ((m = subjRe.exec(html)) !== null) {
    const t = stripTags(m[1] ?? '')
    if (t) subjects.push(t)
  }
  // bookshelf 도 추가 (LoCC 분류 대신 인간적 분류)
  const shelfRe = /<tr[^>]+itemprop="genre"[^>]*>([\s\S]*?)<\/tr>/g
  while ((m = shelfRe.exec(html)) !== null) {
    const t = stripTags(m[1] ?? '')
    if (t) subjects.push(t)
  }

  // Release Date — "Release Date: Aug 1, 2008" 패턴
  const releaseMatch = html.match(/Release Date[^<]*<[^>]+>[\s\S]*?(\d{4})/)
  const published_year = releaseMatch ? Number(releaseMatch[1]) : null

  // Gutenberg note 필드 (있으면 description 대체)
  // <tr property="dcterms:description"> 가끔 있음
  const descMatch = html.match(/<tr[^>]+property="dcterms:description"[^>]*>([\s\S]*?)<\/tr>/)
  const description = descMatch ? stripTags(descMatch[1] ?? '').slice(0, 1500) || null : null

  return {
    description,
    subjects: [...new Set(subjects)].slice(0, 15),
    published_year,
  }
}

// Standard Ebooks 디테일: /ebooks/{author-slug}/{title-slug}
//   description: <section id="description"> 의 <p> 들 (단, <aside> 는 반드시 제거 — 아래 참조)
//   subjects: <a href="/subjects/..."> 들
//   word_count: schema:wordCount
//   reading time: <aside id="reading-ease"> 의 "(N hours M minutes)"
//
// ★ 실측으로 잡은 결함 (2026-08-16) — **줄거리 자리에 모금 문구가 들어오고 있었다**
//   `<section id="description">` 안에 사이트가 후원 배너 `<aside class="donation">` 를 끼워 넣는다.
//   "첫 `<p>` 를 줄거리로 본다" 는 규칙이 그 배너의 첫 줄을 집어서, 표본 5권이 **전부**
//   `"Help us reach 40 new patrons by August 24"` (41자, 책마다 동일) 를 돌려줬다.
//   빈 값보다 나쁘다 — 관리자 화면에 그럴듯한 자리에 앉아 검수를 통과해 버린다.
//   그래서 `<aside>` 를 먼저 걷어내고, 남은 문단을 이어 붙인다(첫 문단은 저자 소개인 경우가 많아
//   한 문단만 쓰면 "이 책이 무슨 이야기인지" 가 안 나온다).
/**
 * Standard Ebooks 상세 HTML → 줄거리. **네트워크와 분리해 회귀로 고정한다**
 * (이 파서가 조용히 모금 문구를 집어 오던 것이 실제 사고였다).
 */
export function parseStandardEbooksDescription(html: string): string | null {
  const sec = html.match(/<section[^>]+id="description"[^>]*>([\s\S]*?)<\/section>/)
  if (!sec) return null
  const body = (sec[1] ?? '').replace(/<aside[\s\S]*?<\/aside>/gi, '')
  const paras: string[] = []
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g
  let pm: RegExpExecArray | null
  while ((pm = pRe.exec(body)) !== null) {
    const t = stripTags(pm[1] ?? '').trim()
    if (t) paras.push(t)
  }
  return paras.join(' ').slice(0, 1500) || null
}

/** Standard Ebooks 상세 HTML → 읽기 시간(분). "(5 hours 22 minutes)" · "(42 minutes)" 둘 다. */
export function parseStandardEbooksReadingMinutes(html: string): number | null {
  const rt = html.match(/\((?:(\d+)\s*hours?)?[\s,]*(?:(\d+)\s*minutes?)?\)/i)
  if (!rt || (!rt[1] && !rt[2])) return null
  return Number(rt[1] ?? 0) * 60 + Number(rt[2] ?? 0) || null
}

export async function fetchStandardEbooksDetail(sourceId: string): Promise<DetailFields> {
  const html = await fetchWithTimeout(`https://standardebooks.org/ebooks/${sourceId}`)

  // description — <section id="description"> 에서 <aside>(후원 배너 등) 제거 후 문단을 이어 붙인다
  let description: string | null = parseStandardEbooksDescription(html)
  if (!description) {
    const meta = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)
    if (meta) description = decodeHtml(meta[1] ?? '').slice(0, 1500) || null
  }

  // subjects: <a href="/subjects/{slug}">Name</a>
  const subjects: string[] = []
  const subjRe = /<a[^>]+href="\/subjects\/[^"]+"[^>]*>([^<]+)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = subjRe.exec(html)) !== null) {
    subjects.push(decodeHtml(m[1] ?? '').trim())
  }

  // word count — meta property="schema:wordCount" 또는 "Word count: N,NNN"
  let word_count: number | null = null
  const wcMeta = html.match(/property="schema:wordCount"[^>]+content="(\d+)"/) ||
    html.match(/Word count[^<]*<[^>]+>[\s\S]*?([\d,]+)/i)
  if (wcMeta) word_count = Number(wcMeta[1]?.replace(/,/g, ''))

  // reading time — 실제 마크업은 `<aside id="reading-ease">` 안의
  //   "88,518 words (5 hours 22 minutes) with a reading ease of 80.11 (easy)"
  // 이전 정규식은 "Reading ease" 가 **앞에** 오는 형태를 기대해 한 건도 매치되지 않았다(실측 0/5).
  // 시간·분 표기는 괄호 안이고, 짧은 책은 분만 나온다("(42 minutes)").
  const reading_time_minutes = parseStandardEbooksReadingMinutes(html)

  return {
    description,
    subjects: [...new Set(subjects)].slice(0, 15),
    word_count,
    reading_time_minutes,
  }
}

// ─────────────────────────────────────────────
// Lit2Go (USF) — v06.43
// 책 페이지 = https://etc.usf.edu/lit2go/{book-id}/
// description = <div class="description"> 또는 <meta name="description">
// subjects = 장르 + 컬렉션 (USF 분류)
// word count = "N,NNN words" 텍스트
// US grade (Flesch-Kincaid) = curation_meta 보존만 (V-Level final 은 coverage 가 SSoT)
// ─────────────────────────────────────────────
export async function fetchLit2GoDetail(sourceId: string): Promise<DetailFields> {
  const bookId = sourceId.replace(/^lit2go:/, '')
  const html = await fetchWithTimeout(`https://etc.usf.edu/lit2go/${bookId}/`)

  // description — <div class="description"> 또는 첫 큰 <p>
  let description: string | null = null
  const descMatch =
    html.match(/<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ??
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
  if (descMatch) {
    description = stripTags(descMatch[1] ?? '').slice(0, 1500) || null
  }

  // subjects — 장르 + 컬렉션 (Lit2Go 분류)
  const subjects: string[] = []
  const genreRe = /<a[^>]+href="\/lit2go\/genres\/[^"]+"[^>]*>([^<]+)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = genreRe.exec(html)) !== null) {
    subjects.push(stripTags(m[1] ?? '').trim())
  }
  const colRe = /<a[^>]+href="\/lit2go\/collections\/[^"]+"[^>]*>([^<]+)<\/a>/g
  while ((m = colRe.exec(html)) !== null) {
    subjects.push(stripTags(m[1] ?? '').trim())
  }

  // word count — "N,NNN words"
  let word_count: number | null = null
  const wcMatch = html.match(/([\d,]+)\s*words?/i)
  if (wcMatch) {
    const n = Number((wcMatch[1] ?? '').replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) word_count = n
  }

  // reading time = word_count / 200 wpm (Lit2Go 명시 X)
  const reading_time_minutes = word_count ? Math.round(word_count / 200) : null

  return {
    description,
    subjects: [...new Set(subjects)].slice(0, 15),
    word_count,
    reading_time_minutes,
  }
}
