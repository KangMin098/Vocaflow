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
//   description: <section id="description"> 또는 <meta name="description">
//   subjects: <a href="/subjects/..."> 들
//   word_count: schema:wordCount 또는 "N,NNN words" 텍스트
//   reading time: "N hours, M minutes" 텍스트
export async function fetchStandardEbooksDetail(sourceId: string): Promise<DetailFields> {
  const html = await fetchWithTimeout(`https://standardebooks.org/ebooks/${sourceId}`)

  // description — <section id="description"> 내부 <p> 첫 단락
  let description: string | null = null
  const sec = html.match(/<section[^>]+id="description"[^>]*>([\s\S]*?)<\/section>/)
  if (sec) {
    const firstP = sec[1]?.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    if (firstP) description = stripTags(firstP[1] ?? '').slice(0, 1500) || null
  }
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

  // reading time — "N hours, M minutes" → minutes
  let reading_time_minutes: number | null = null
  const rt = html.match(/(?:Reading ease|Reading time)[^<]*<[^>]+>[\s\S]*?(?:(\d+)\s*hours?)?[\s,]*(\d+)\s*minutes?/i)
  if (rt) {
    const h = Number(rt[1] ?? 0)
    const mn = Number(rt[2] ?? 0)
    reading_time_minutes = h * 60 + mn || null
  }

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
