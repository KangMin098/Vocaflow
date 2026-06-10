// apps/web/src/lib/library/librivox-chapter-map.ts
//
// 다권(multi-volume) LibriVox 낭독 → 도서 챕터별 오디오 파트 매핑 (순수 함수).
//
// 배경: Gibbon "Decline and Fall" 등은 LibriVox 에서 6권으로 나뉘고, 한 챕터가
//   "Chapter LXXI: Part 1..N" 여러 섹션으로 쪼개진다. 우리 본문 챕터는 chapter_idx(1..N)
//   이지만 간지("General Observations"·"Digression")·미주(Endnotes)가 챕터로 섞여 들어가
//   LibriVox 의 Roman 챕터 번호와 1:1 이 아니다.
//
// 전략 (안전 우선 — 잘못된 매핑은 학습자에게 엉뚱한 챕터 오디오를 들려주므로 금지):
//   1. LibriVox 섹션 제목에서 Roman 챕터 번호 + Part 번호 파싱 → roman 그룹.
//   2. roman 집합이 1..K 연속이어야 함(아니면 중단).
//   3. 우리 챕터에서 간지/미주(제목 패턴 + word_count 이상치) 제외 → "실챕터" 순서.
//   4. **count-gate**: 실챕터 수 == LibriVox 챕터 수(K) 일 때만 매핑. 어긋나면 중단(TTS fallback).
//   5. 실챕터[i] ↔ roman (i+1) 의 파트들. (양쪽 다 책 본문 순서 = 같은 시퀀스)

export interface LvSectionInput {
  /** LibriVox 섹션 제목 — "Chapter LXXI: Part 3" / "Introduction and Prefaces" */
  title: string
  /** archive.org 스트리밍 URL */
  url: string
  secs: number | null
  reader: string | null
  /** 원본 섹션 번호 (Part 파싱 실패 시 정렬 fallback) */
  n: number
}

export interface OurChapterInput {
  chapter_idx: number
  word_count: number
  /** 본문 첫머리(~200자) — "CHAPTER 39. General Observations…" 등 간지 감지용 */
  head: string
}

export interface ChapterPart {
  url: string
  title: string | null
  secs: number | null
  reader: string | null
}

export interface ChapterPartsMap {
  ok: boolean
  reason: string | null
  /** chapter_idx → { roman, parts[] } */
  chapter_map: Record<number, { roman: number; parts: ChapterPart[] }>
  mapped_chapters: number
  lv_chapter_count: number
  real_chapter_count: number
  /** 간지/미주로 제외된 우리 chapter_idx (진단용) */
  excluded_idx: number[]
}

// 간지·부록·미주 제목 패턴 — "introduction" 은 제외(Gibbon Ch I 부제가 "Introduction" 이라 오탐).
const INTERSTITIAL_RE =
  /general observations|digression|^appendix\b|\bappendix\b|endnotes?\b|bibliograph|colophon|errata|list of illustrations|^index\b|translator'?s?\s+note|editor'?s?\s+note/i

const ROMAN_MAP: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

export function romanToInt(s: string): number | null {
  const up = (s || '').toUpperCase()
  if (!up) return null
  let total = 0
  let prev = 0
  for (let i = up.length - 1; i >= 0; i--) {
    const v = ROMAN_MAP[up[i]!]
    if (v == null) return null
    if (v < prev) total -= v
    else {
      total += v
      prev = v
    }
  }
  return total > 0 ? total : null
}

/** "Chapter LXXI: Part 3" → { roman: 71, part: 3 } / 비챕터 섹션이면 null.
 *  (구버전 호환 — 단권/Roman 전용. 새 코드는 parseSectionChapterMeta 사용) */
export function parseSectionChapter(title: string): { roman: number; part: number | null } | null {
  const meta = parseSectionChapterMeta(title)
  if (!meta || meta.book != null) return null
  return { roman: meta.chapter, part: meta.part }
}

/** Roman 또는 Arabic 숫자 파싱. */
function parseRomanOrArabic(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return romanToInt(t)
}

/**
 * LV 섹션 제목에서 (book, chapter, part) 메타 추출.
 *   "01 - Book I, Chapter 01"             → { book:1, chapter:1, part:null }
 *   "12 - Book I, Chapter 11: Who Heir? part 1" → { book:1, chapter:11, part:1 }
 *   "Chapter LXXI: Part 3"                → { book:null, chapter:71, part:3 }
 *   "Chapter 01"                          → { book:null, chapter:1, part:null }
 *   "Preface" / "Introduction"            → null (비챕터 — 건너뜀)
 * 다권 저작(Two Treatises 등)은 book/chapter 가 분리되어 Book I Ch 1..N 과 Book II Ch 1..M 이
 * 서로 다른 sequence 로 처리됨 → 챕터당 1 voice chapter 로 묶임.
 */
export function parseSectionChapterMeta(
  title: string,
): { book: number | null; chapter: number; part: number | null } | null {
  if (!title) return null

  // 1. "Book X, Chapter Y" / "Book X. Chapter Y" / "Book X Chapter Y"
  //    X·Y 둘 다 Roman 또는 Arabic 허용. 중간 구분자 자유.
  const bookCh = /\bbook\s+([ivxlcdm]+|\d+)\b[^a-z0-9]{0,4}(?:chapter|ch\.?)\s+(\d+|[ivxlcdm]+)\b/i.exec(
    title,
  )
  if (bookCh) {
    const book = parseRomanOrArabic(bookCh[1]!)
    const chapter = parseRomanOrArabic(bookCh[2]!)
    if (book != null && chapter != null) {
      const pm = /\bpart\s+(\d+)\b/i.exec(title)
      return { book, chapter, part: pm ? parseInt(pm[1]!, 10) : null }
    }
  }

  // 2. 단독 "Chapter X" — Roman 또는 Arabic
  const ch = /\bchapter\s+(\d+|[ivxlcdm]+)\b/i.exec(title)
  if (!ch) return null
  const num = parseRomanOrArabic(ch[1]!)
  if (num == null) return null
  const pm = /\bpart\s+(\d+)\b/i.exec(title)
  return { book: null, chapter: num, part: pm ? parseInt(pm[1]!, 10) : null }
}

/** LV 섹션들을 (book, chapter) 단위 voice chapter 그룹으로 묶음 (insertion order 보존). */
interface VoiceChapter {
  book: number | null
  chapter: number
  parts: ChapterPart[]
}
function buildVoiceChapters(sections: LvSectionInput[]): VoiceChapter[] {
  const order: string[] = []
  const groups = new Map<
    string,
    { book: number | null; chapter: number; parts: Array<{ part: number; sec: LvSectionInput }> }
  >()
  for (const s of sections) {
    const meta = parseSectionChapterMeta(s.title)
    if (!meta) continue
    const key = meta.book != null ? `b${meta.book}c${meta.chapter}` : `c${meta.chapter}`
    let g = groups.get(key)
    if (!g) {
      g = { book: meta.book, chapter: meta.chapter, parts: [] }
      groups.set(key, g)
      order.push(key)
    }
    g.parts.push({ part: meta.part ?? g.parts.length + 1, sec: s })
  }
  return order.map((key) => {
    const g = groups.get(key)!
    const parts = g.parts
      .sort((a, b) => a.part - b.part || a.sec.n - b.sec.n)
      .map((p) => ({
        url: p.sec.url,
        title: p.sec.title || null,
        secs: p.sec.secs,
        reader: p.sec.reader,
      }))
    return { book: g.book, chapter: g.chapter, parts }
  })
}

/** 책별 챕터 번호가 1..N 연속인지 검증 (정합 안전 가드). */
function verifyWithinBookContiguity(vcs: VoiceChapter[]): string | null {
  const byBook = new Map<number | null, number[]>()
  for (const vc of vcs) {
    const arr = byBook.get(vc.book) ?? []
    arr.push(vc.chapter)
    byBook.set(vc.book, arr)
  }
  for (const [book, chapters] of byBook) {
    chapters.sort((a, b) => a - b)
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i] !== i + 1) {
        const list = chapters.join(',')
        return book != null
          ? `LibriVox Book ${book} 챕터 번호가 1..N 연속이 아님 (${list})`
          : `LibriVox 챕터 번호가 1..N 연속이 아님 (${list})`
      }
    }
  }
  return null
}

/** 본문 head 에서 "CHAPTER N" 접두를 떼고 제목 본체만 (간지 패턴 매칭용). */
function titleBody(head: string): string {
  return (head || '').replace(/^\s*chapter\s+[0-9ivxlcdm]+[.\s:)-]*/i, '').trim()
}

export function buildChapterPartsMap(
  sections: LvSectionInput[],
  chapters: OurChapterInput[],
): ChapterPartsMap {
  // 1. Voice chapter 그룹화 (Roman + Arabic + "Book X, Chapter Y" 다권 인식)
  const voiceChapters = buildVoiceChapters(sections)

  const fail = (reason: string, realCount = 0, excluded: number[] = []): ChapterPartsMap => ({
    ok: false,
    reason,
    chapter_map: {},
    mapped_chapters: 0,
    lv_chapter_count: voiceChapters.length,
    real_chapter_count: realCount,
    excluded_idx: excluded,
  })

  if (voiceChapters.length === 0) return fail('LibriVox 섹션에서 챕터 번호를 찾지 못함')

  // 2. 책별 챕터 번호 1..N 연속 검증 (Book I 1..11, Book II 1..19 식)
  const contigErr = verifyWithinBookContiguity(voiceChapters)
  if (contigErr) return fail(contigErr)

  // 3. 실챕터 검출 — 간지/미주 제외 (1차: outlier+title 둘 다 / 2차: title 만)
  const sorted = [...chapters].sort((a, b) => a.chapter_idx - b.chapter_idx)
  const wcs = sorted.map((c) => c.word_count).sort((a, b) => a - b)
  const median = wcs.length ? (wcs[Math.floor(wcs.length / 2)] ?? 0) : 0
  const outlier = median > 0 ? median * 4 : Infinity

  // 1차 — outlier(미주 덩어리 의심) 동시 제외
  const excluded1: number[] = []
  const real1 = sorted.filter((c) => {
    const body = titleBody(c.head)
    const isInterstitial = INTERSTITIAL_RE.test(body) || INTERSTITIAL_RE.test(c.head)
    const isOutlier = c.word_count > outlier
    if (isInterstitial || isOutlier) {
      excluded1.push(c.chapter_idx)
      return false
    }
    return true
  })

  let real = real1
  let excluded = excluded1

  // 2차 — 1차 count-gate 실패 시 outlier 만 풀고 재시도. (장 자체가 긴 책 — Two Treatises Ch 11 등)
  if (real.length !== voiceChapters.length) {
    const excluded2: number[] = []
    const real2 = sorted.filter((c) => {
      const body = titleBody(c.head)
      const isInterstitial = INTERSTITIAL_RE.test(body) || INTERSTITIAL_RE.test(c.head)
      if (isInterstitial) {
        excluded2.push(c.chapter_idx)
        return false
      }
      return true
    })
    if (real2.length === voiceChapters.length) {
      real = real2
      excluded = excluded2
    }
  }

  // 4. count-gate — 안전 차단
  if (real.length !== voiceChapters.length) {
    return fail(
      `매핑 안전 차단 — 실챕터 ${real.length}개 ≠ LibriVox 챕터 ${voiceChapters.length}개 (간지/미주 감지 불일치)`,
      real.length,
      excluded,
    )
  }

  // 5. 매핑 (시퀀스 1:1) — roman 은 SE chapter_idx 와 일치하는 1..K 순번 (표시용 안전)
  const chapter_map: ChapterPartsMap['chapter_map'] = {}
  for (let i = 0; i < voiceChapters.length; i++) {
    const vc = voiceChapters[i]!
    const our = real[i]!
    chapter_map[our.chapter_idx] = { roman: i + 1, parts: vc.parts }
  }

  return {
    ok: true,
    reason: null,
    chapter_map,
    mapped_chapters: voiceChapters.length,
    lv_chapter_count: voiceChapters.length,
    real_chapter_count: real.length,
    excluded_idx: excluded,
  }
}
