// apps/web/src/lib/library/librivox-audio.ts
//
// LibriVox 오디오 해결기 (서버 전용).
// 정책 (v06.x): LibriVox 는 독립 소스가 아니라, Gutenberg/SE 도서에 "보이스"를 연결.
//   - Gutenberg 도서: source_id = gutenberg id → LibriVox url_text_source 의 gutenberg id 와
//     EXACT 매칭 (무손실, 신뢰).
//   - SE/기타: 제목 + 저자(성) best-effort 매칭 (제목 변형/버전으로 실패 가능 → null).
//   - 같은 작품에 여러 LibriVox 버전이 있으면 SOLO(낭독자 1명) 우선 — 학습 일관성.
//
// 오디오 파일은 저장하지 않음 — archive.org listen_url 직접 스트리밍.

const LV_API = 'https://librivox.org/api/feed/audiobooks/'
const TIMEOUT_MS = 12_000
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

export interface AudioSection {
  n: number
  title: string
  url: string
  secs: number | null
  reader: string | null
}

export interface LibriVoxAudioInfo {
  archive_url: string | null
  librivox_url: string
  total_secs: number | null
  section_count: number
  sections: AudioSection[]
}

export interface LibriVoxMatch {
  librivox_id: string
  librivox_title: string
  voices: number
  consistency: 'solo' | 'multi' | 'unknown'
  /** 매칭 경로 — 신뢰도 표시용 */
  via: 'gutenberg_id' | 'title_author'
}

export interface ResolveResult {
  audio: LibriVoxAudioInfo | null
  match: LibriVoxMatch | null
}

interface LVReader {
  display_name?: string | null
}
interface LVSection {
  section_number?: string | number | null
  title?: string | null
  listen_url?: string | null
  playtime?: string | number | null
  readers?: LVReader[]
}
interface LVAuthor {
  first_name?: string | null
  last_name?: string | null
}
interface LVBook {
  id: number | string
  title: string
  url_text_source?: string | null
  url_librivox?: string | null
  url_iarchive?: string | null
  totaltimesecs?: number | string | null
  authors?: LVAuthor[]
  sections?: LVSection[]
}

/** 도서 1권에 대한 LibriVox 보이스 해결. 매칭 실패 시 audio=null. */
export async function resolveLibriVoxAudioForBook(input: {
  gutenbergId?: string | null
  title: string
  author?: string | null
  /** 도서 텍스트 챕터 수 — 섹션 수가 가장 근접한 LibriVox 버전 우선 선택용 */
  chapterCount?: number | null
}): Promise<ResolveResult> {
  const sname = surname(input.author)
  const tnorm = normTitle(input.title)

  // 후보 수집 — 저자(성) 검색 + 제목 검색 union (절단/관사 회피 위해 둘 다)
  const seen = new Map<string, LVBook>()
  const collect = (books: LVBook[]) => {
    for (const b of books) seen.set(String(b.id), b)
  }
  if (sname) collect(await lvSearch(`author=${encodeURIComponent('^' + sname)}`))
  collect(await lvSearch(`title=${encodeURIComponent('^' + titleQuery(input.title))}`))
  const candidates = [...seen.values()]
  if (candidates.length === 0) return { audio: null, match: null }

  let matched: LVBook[] = []
  let via: LibriVoxMatch['via'] = 'gutenberg_id'

  if (input.gutenbergId) {
    matched = candidates.filter((b) => gutenbergIdFromUrl(b.url_text_source) === input.gutenbergId)
    via = 'gutenberg_id'
  }
  if (matched.length === 0) {
    // SE/기타 또는 gutenberg id 미스 → 제목 접두 + 저자 성 best-effort
    matched = candidates.filter((b) => {
      const bt = normTitle(b.title)
      const titleOk =
        bt.startsWith(tnorm.slice(0, Math.min(10, tnorm.length))) ||
        tnorm.startsWith(bt.slice(0, Math.min(10, bt.length)))
      const authOk =
        !sname ||
        (b.authors ?? []).some((a) => {
          const ln = norm(a.last_name ?? '')
          return ln === sname || (ln.length >= 3 && sname.includes(ln))
        })
      return titleOk && authOk
    })
    via = 'title_author'
  }
  if (matched.length === 0) return { audio: null, match: null }

  // 정렬 우선순위:
  //   1) 도서 챕터 수에 섹션 수가 가장 근접 (텍스트↔낭독 챕터 정합 — 사용자 요청)
  //   2) 솔로(낭독자 적은 순) — 목소리 일관성
  //   3) 섹션 많은(완본) 우선
  const target = input.chapterCount && input.chapterCount > 0 ? input.chapterCount : null
  matched.sort((a, b) => {
    if (target != null) {
      const da = Math.abs((a.sections?.length ?? 0) - target)
      const db = Math.abs((b.sections?.length ?? 0) - target)
      if (da !== db) return da - db
    }
    const va = readerCount(a)
    const vb = readerCount(b)
    if (va !== vb) return va - vb
    return (b.sections?.length ?? 0) - (a.sections?.length ?? 0)
  })

  const chosen = matched[0]!
  const audio = buildAudio(chosen)
  if (!audio) return { audio: null, match: null }
  const voices = readerCount(chosen)
  return {
    audio,
    match: {
      librivox_id: String(chosen.id),
      librivox_title: chosen.title,
      voices,
      consistency: voices === 0 ? 'unknown' : voices === 1 ? 'solo' : 'multi',
      via,
    },
  }
}

/** LibriVox project id 로 직접 오디오 조회 (기존 librivox 도서 호환). */
export async function fetchLibriVoxAudioById(id: string): Promise<LibriVoxAudioInfo | null> {
  const books = await lvSearch(`id=${encodeURIComponent(id)}`)
  const b = books[0]
  return b ? buildAudio(b) : null
}

/**
 * Standard Ebooks 슬러그 → 원천 Project Gutenberg id.
 * SE 텍스트는 대부분 Gutenberg 전사본 파생 — ebook 페이지 출처 링크에서 gutenberg id 추출.
 * (Wikisource·Internet Archive 등 다른 출처면 null → 호출자가 title/author fallback)
 */
export async function gutenbergIdFromStandardEbooks(seSlug: string): Promise<string | null> {
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/.test(seSlug)) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`https://standardebooks.org/ebooks/${seSlug}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      next: { revalidate: 604800 },
    })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/gutenberg\.org\/(?:ebooks|etext|files|cache\/epub)\/(\d{1,7})/i)
    return m?.[1] ?? null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// ── helpers ───────────────────────────────────────

async function lvSearch(params: string): Promise<LVBook[]> {
  const url = `${LV_API}?${params}&format=json&extended=1&limit=80`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return []
    const j = (await res.json()) as { books?: LVBook[] }
    return j.books ?? []
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}

function buildAudio(book: LVBook): LibriVoxAudioInfo | null {
  const raw = Array.isArray(book.sections) ? book.sections : []
  const sections: AudioSection[] = []
  for (const s of raw) {
    const url = typeof s.listen_url === 'string' ? s.listen_url.trim() : ''
    if (!isArchiveOrgUrl(url)) continue
    sections.push({
      n: toInt(s.section_number) ?? sections.length + 1,
      title: (typeof s.title === 'string' && s.title.trim()) || `Section ${sections.length + 1}`,
      url,
      secs: toInt(s.playtime),
      reader: s.readers?.[0]?.display_name?.trim() || null,
    })
  }
  if (sections.length === 0) return null
  return {
    archive_url: isHttpUrl(book.url_iarchive) ? book.url_iarchive!.trim() : null,
    librivox_url: book.url_librivox?.trim() || `https://librivox.org/?p=${book.id}`,
    total_secs: toInt(book.totaltimesecs),
    section_count: sections.length,
    sections,
  }
}

function readerCount(b: LVBook): number {
  const set = new Set<string>()
  for (const s of b.sections ?? []) {
    const n = s.readers?.[0]?.display_name?.trim()
    if (n) set.add(n)
  }
  return set.size
}

function gutenbergIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/gutenberg\.org\/(?:etext|ebooks|files|cache\/epub)\/(\d{1,7})/i)
  return m?.[1] ?? null
}

function isArchiveOrgUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && /(^|\.)archive\.org$/i.test(u.hostname)
  } catch {
    return false
  }
}

function isHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function toInt(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10)
  return Number.isFinite(n) ? n : null
}

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normTitle(s: string): string {
  return norm((s || '').replace(/[:;(].*$/, ''))
}

/** "Last, First" → Last / "First Last" → Last (소문자 정규화) */
function surname(author: string | null | undefined): string {
  const a = (author ?? '').trim()
  if (!a) return ''
  if (a.includes(',')) return norm(a.split(',')[0]!)
  const parts = a.split(/\s+/)
  return norm(parts[parts.length - 1]!)
}

/** LibriVox title prefix 검색용 — 관사 보존, 앞 3단어. */
function titleQuery(title: string): string {
  return (title || '')
    .replace(/[:;].*$/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
}
