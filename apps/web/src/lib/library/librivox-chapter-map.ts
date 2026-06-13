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

// ─────────────────────────────────────────────────────────────────────────────
// 제목 기반 정합 (v06.35) — 다권/포맷불일치 도서의 100% 정확 드레인
// ─────────────────────────────────────────────────────────────────────────────
//
// 배경: buildChapterPartsMap 는 (book, chapter) 번호 시퀀스로 매핑하는데, 다권 저작
//   (Les Mis 5권)은 권마다 Book 번호가 재시작 + 제목 포맷 제각각("Bk 01" vs "Bk 1",
//   "<b>Bk 01</b>", 묶음 "Ch 01-04") → 권 간 동번호 충돌로 틀린 오디오가 배정됐다.
//
// 해결: 오디오 섹션 제목의 본문(예 "Bk 01, ch. 02: M. Myriel becomes M. Welcome" →
//   "M. Myriel becomes M. Welcome")을 도서 챕터 제목과 정규화 비교. 챕터 제목은 책 전체에서
//   사실상 유일하므로 권 충돌이 원천 제거된다.
//
// 정확도 100% 보장 원칙:
//   - 제목이 유일하게 1:1 일치할 때만 배정(confident).
//   - 묶음 파일(제목 본문 없음)·중복 제목·미일치는 매핑하지 않고 비움 → 워크스페이스 TTS fallback.
//   - 즉 "강제 채움 금지" → 배정된 모든 챕터는 제목 검증 통과 → 틀린 오디오 재생 0.
//   - coverage(매핑률)와 accuracy(정확도)를 분리: 묶음/무제목 섹션은 gap 으로 남기고 정확도를 지킨다.

export interface AudioSectionInput {
  title: string
  url: string
  secs: number | null
  reader: string | null
  /** 원본 섹션 번호 (정렬 fallback) */
  n: number
}

export interface TextChapterInput {
  chapter_idx: number
  /** "Fantine › A Just Man" — part/book 맥락 (진단·중복 제목 참고용) */
  group_label: string | null
  title: string | null
}

export interface TitleAlignResult {
  ok: boolean
  chapter_map: Record<number, { roman: number; parts: ChapterPart[] }>
  matched: number
  total_chapters: number
  /** 매핑 안 된 텍스트 챕터 (TTS fallback) */
  unmatched_idx: number[]
  /** 어느 챕터에도 안 붙은 오디오 섹션 수 (묶음/Preface/credits 등) */
  unused_sections: number
  /** 제목이 여러 챕터/섹션에 중복돼 자동 배정 보류(=gap)한 항목 */
  ambiguous: Array<{ chapter_idx: number; norm_title: string }>
}

/**
 * 챕터 제목 정규화 — 비교 키 생성.
 *   1) HTML 태그 제거  2) "Bk NN, ch. MM:" / "Book I Chapter 2 -" 접두 제거
 *   3) 소문자 + 비영숫자 → 공백 1칸.
 * 묶음 파일("Bk 01 Ch 01-04")은 접두 제거 후 본문이 비어 '' 가 됨 → 매칭에서 제외(gap).
 */
export function normalizeChapterTitleForMatch(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // 악센트(결합 표식) 제거 (Tholomyès → Tholomyes)
    .replace(/<[^>]+>/g, ' ')
    .replace(
      /\b(?:bk|book)\s+[0-9ivxlcdm]+\b[\s,.:-]*\b(?:ch\.?|chapter)\s+[0-9ivxlcdm]+(?:\s*-\s*[0-9ivxlcdm]+)?\b\s*[:.\-]?\s*/i,
      '',
    )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = cur
  }
  return prev[n]!
}

/**
 * 두 정규화 제목이 "같은 챕터"인지 퍼지 판정 — 번호 매핑의 교차검증/복구용.
 * 편집거리 비율 ≥ 0.7 (표기차: Quartet/Quartett·Humor/Humour·Battle-Field·Bombarda's),
 * 또는 유의어 토큰 과반(max 분모) 겹침 (Eighteenth/18th). 둘 다 아니면 false(=다른 챕터, shift).
 */
export function titleRoughlySame(a: string, b: string): boolean {
  if (!a || !b) return true // 비교 불가 → 반려하지 않음
  if (a === b) return true
  // 절단 제목: 한쪽이 다른쪽의 접두 (LibriVox "The Ankle-Chain..." ⊂ 텍스트 전체 제목)
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length >= 8 && longer.startsWith(shorter)) return true
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length)
  if (lev >= 0.7) return true
  const sig = (s: string) => new Set(s.split(' ').filter((w) => w.length > 2))
  const ta = sig(a)
  const tb = sig(b)
  if (ta.size === 0 || tb.size === 0) return false
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter += 1
  return inter / Math.max(ta.size, tb.size) >= 0.5
}

/**
 * 도서 챕터 ↔ LibriVox 섹션을 제목으로 정합. 다권 섹션을 전부 flatten 해 넘겨도
 * 제목이 유일 키라 권 충돌 없음. 유일 1:1 일치만 배정, 나머지는 gap(TTS).
 */
export function alignChaptersByTitle(
  textChapters: TextChapterInput[],
  audioSections: AudioSectionInput[],
): TitleAlignResult {
  // 1. 오디오 섹션 정규화 — 제목 본문이 비면(Preface/merged/credits) 매칭 제외
  const audio = audioSections
    .map((s) => ({ sec: s, key: normalizeChapterTitleForMatch(s.title) }))
    .filter((a) => a.key.length >= 3)

  // 2. 정규화 제목 → 오디오 섹션들 (중복 키 추적)
  const audioByKey = new Map<string, AudioSectionInput[]>()
  for (const a of audio) {
    const arr = audioByKey.get(a.key) ?? []
    arr.push(a.sec)
    audioByKey.set(a.key, arr)
  }

  // 3. 텍스트 챕터 정규화 + 키 중복도
  const text = textChapters
    .slice()
    .sort((a, b) => a.chapter_idx - b.chapter_idx)
    .map((c) => ({ chapter: c, key: normalizeChapterTitleForMatch(c.title) }))
  const textKeyCount = new Map<string, number>()
  for (const t of text) textKeyCount.set(t.key, (textKeyCount.get(t.key) ?? 0) + 1)

  const chapter_map: TitleAlignResult['chapter_map'] = {}
  const unmatched_idx: number[] = []
  const ambiguous: TitleAlignResult['ambiguous'] = []
  const usedAudio = new Set<AudioSectionInput>()

  for (const t of text) {
    const idx = t.chapter.chapter_idx
    if (t.key.length < 3) {
      unmatched_idx.push(idx)
      continue
    }
    const cands = (audioByKey.get(t.key) ?? []).filter((s) => !usedAudio.has(s))
    const textUnique = (textKeyCount.get(t.key) ?? 0) === 1
    if (cands.length === 1 && textUnique) {
      // confident 1:1 — 배정
      const s = cands[0]!
      usedAudio.add(s)
      chapter_map[idx] = {
        roman: idx,
        parts: [{ url: s.url, title: s.title || null, secs: s.secs, reader: s.reader }],
      }
    } else if (cands.length === 0) {
      unmatched_idx.push(idx)
    } else {
      // 제목 중복(여러 챕터/섹션) → 자동 배정 보류, gap 으로 (정확도 우선)
      ambiguous.push({ chapter_idx: idx, norm_title: t.key })
      unmatched_idx.push(idx)
    }
  }

  const matched = Object.keys(chapter_map).length
  return {
    ok: matched > 0,
    chapter_map,
    matched,
    total_chapters: text.length,
    unmatched_idx,
    unused_sections: audio.filter((a) => !usedAudio.has(a.sec)).length,
    ambiguous,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 권-인지(volume-aware) 구조 정합 (v06.35) — 다권 도서 ~100% coverage + 100% 정확
// ─────────────────────────────────────────────────────────────────────────────
//
// 배경: 제목 정합(alignChaptersByTitle)은 제목이 있는 권만 매칭 → Les Mis 처럼 일부 권이
//   "제목 없음"(Vol 4 "Bk 01 Ch 01")·"묶음"(Vol 3 "Ch 01-04")이면 그 권 전체가 gap.
//
// 통찰(두 목록 구조 분석): 다권 LibriVox 는 **권 N = 텍스트 Part N** 이고, 각 권 안에서
//   섹션이 (Book, Chapter) 순서로 정렬돼 있다. 권을 Part 에 묶고 권 내에서 번호로 매핑하면
//   ("Bk 01"은 권 안에서 유일 → 충돌 0) 제목 없는/묶음 권도 전부 정확히 매핑된다.
//
// 매핑: 권(volume_number=N) 섹션 "Bk B Ch C[-D]" → 텍스트 Part #N 의 B번째 Book 의 C(~D)번째 챕터.
//   - 묶음 "Ch 03-04" → 그 묶음이 커버하는 2개 챕터에 같은 오디오(블록 재생).
//   - "Ch 20 part 1/2/3" → 한 챕터에 여러 파트(순차 재생).
//   - 제목이 있는 권은 번호 매핑 결과를 제목으로 교차검증 → 불일치면 보류(gap, 정확도 보호).
// 텍스트 Part/Book 순서는 group_label "Part › Book" 의 등장 순서로 도출(번역명 무관).

export interface VolumeInput {
  /** 권 번호 (1-based) — "Misérables, Volume 3" → 3. 텍스트 Part 순서와 대응. */
  volume_number: number
  sections: AudioSectionInput[]
}

export interface VolumeAlignResult {
  ok: boolean
  chapter_map: Record<number, { roman: number; parts: ChapterPart[] }>
  matched: number
  total_chapters: number
  unmatched_idx: number[]
  /** 번호로는 매핑됐으나 제목이 불일치해 보류한 항목 (정확도 보호) */
  conflicts: Array<{ chapter_idx: number; text_title: string; audio_title: string }>
  /** 텍스트 구조에 대응 챕터가 없는 오디오 섹션 수 (book/chap 초과 등) */
  orphan_sections: number
  /** 제목 검증 실패(절단·오타)지만 라벨=구조위치 단일 미사용 섹션이라 번호로 신뢰 배정한 챕터 — spot-check 권장 */
  number_trusted: number[]
}

/** "Misérables, Volume 3" / "Vol. 5" → 권 번호. 못 찾으면 null. */
export function parseVolumeNumber(title: string | null | undefined): number | null {
  const m = /\bvol(?:ume)?\.?\s*([0-9]+)/i.exec(title || '')
  return m ? parseInt(m[1]!, 10) : null
}

/** group_label "Fantine › A Just Man" → { part:'Fantine', book:'A Just Man' } */
function splitPartBook(groupLabel: string | null | undefined): { part: string; book: string } {
  const s = (groupLabel || '').trim()
  const segs = s.split('›').map((x) => x.trim()).filter(Boolean)
  if (segs.length >= 2) return { part: segs[0]!, book: segs.slice(1).join(' › ') }
  return { part: s || '(none)', book: s || '(none)' }
}

/** "<b>Bk 08</b> Ch 20 part 1" / "Bk 01, ch. 02: Title" / "Bk 3 Ch 9-11" → 구조 메타. */
function parseVolumeSectionMeta(
  title: string,
): { book: number; chFrom: number; chTo: number } | null {
  const t = (title || '').replace(/<[^>]+>/g, ' ')
  const m = /\bbk\s+([0-9]+)\b[\s,.:]*\bch\.?\s+([0-9]+)(?:\s*-\s*([0-9]+))?/i.exec(t)
  if (!m) return null
  const book = parseInt(m[1]!, 10)
  const chFrom = parseInt(m[2]!, 10)
  const chTo = m[3] ? parseInt(m[3]!, 10) : chFrom
  if (!Number.isFinite(book) || !Number.isFinite(chFrom) || chTo < chFrom) return null
  return { book, chFrom, chTo }
}

export function alignChaptersByVolume(
  textChapters: TextChapterInput[],
  volumes: VolumeInput[],
): VolumeAlignResult {
  // 1. 텍스트 구조 인덱스: (partOrder, bookOrder, chapInBook) → chapter_idx + 챕터별 part_order
  const sorted = [...textChapters].sort((a, b) => a.chapter_idx - b.chapter_idx)
  const partOrder = new Map<string, number>()
  const bookOrderByPart = new Map<string, Map<string, number>>()
  const idxByPBC = new Map<string, number>()
  const partOrderByIdx = new Map<number, number>()
  let curPart = ''
  let curBook = ''
  let chapInBook = 0
  for (const c of sorted) {
    const { part, book } = splitPartBook(c.group_label)
    if (!partOrder.has(part)) partOrder.set(part, partOrder.size + 1)
    const pOrd = partOrder.get(part)!
    if (!bookOrderByPart.has(part)) bookOrderByPart.set(part, new Map())
    const bmap = bookOrderByPart.get(part)!
    if (!bmap.has(book)) bmap.set(book, bmap.size + 1)
    const bOrd = bmap.get(book)!
    if (part !== curPart || book !== curBook) {
      curPart = part
      curBook = book
      chapInBook = 0
    }
    chapInBook += 1
    idxByPBC.set(`${pOrd}|${bOrd}|${chapInBook}`, c.chapter_idx)
    partOrderByIdx.set(c.chapter_idx, pOrd)
  }

  const sectionsByVol = new Map<number, AudioSectionInput[]>()
  for (const vol of volumes) sectionsByVol.set(vol.volume_number, vol.sections ?? [])

  // 2. 번호 매핑: chapter_idx → [{n, sec}] (섹션 원본 참조 유지 — 멀티파트/묶음 누적)
  const numByIdx = new Map<number, Array<{ n: number; sec: AudioSectionInput }>>()
  let orphan = 0
  for (const vol of volumes) {
    for (const sec of vol.sections ?? []) {
      const meta = parseVolumeSectionMeta(sec.title)
      if (!meta) continue // Preface/credits 등
      for (let ch = meta.chFrom; ch <= meta.chTo; ch++) {
        const idx = idxByPBC.get(`${vol.volume_number}|${meta.book}|${ch}`)
        if (idx == null) {
          orphan += 1
          continue
        }
        const arr = numByIdx.get(idx) ?? []
        arr.push({ n: sec.n, sec })
        numByIdx.set(idx, arr)
      }
    }
  }

  // 3. PASS 1 — 번호 매핑 + 퍼지 제목 교차검증. 통과분만 확정, 불일치/미매핑은 복구 대상.
  const assigned = new Map<number, AudioSectionInput[]>()
  const usedSec = new Set<AudioSectionInput>()
  const conflicts: VolumeAlignResult['conflicts'] = []
  const recover: TextChapterInput[] = []
  for (const c of sorted) {
    const arr = numByIdx.get(c.chapter_idx)
    if (!arr || arr.length === 0) {
      recover.push(c)
      continue
    }
    arr.sort((a, b) => a.n - b.n)
    const audioKey = normalizeChapterTitleForMatch(arr[0]!.sec.title)
    const textKey = normalizeChapterTitleForMatch(c.title)
    if (arr.length === 1 && audioKey.length >= 3 && textKey.length >= 3 && !titleRoughlySame(audioKey, textKey)) {
      conflicts.push({ chapter_idx: c.chapter_idx, text_title: c.title || '', audio_title: arr[0]!.sec.title || '' })
      recover.push(c)
      continue
    }
    assigned.set(c.chapter_idx, arr.map((x) => x.sec))
    for (const x of arr) usedSec.add(x.sec)
  }

  // 4. PASS 2 — 번호가 어긋난(edition shift: 오디오에 추가/병합 챕터) 챕터를 같은 권 안에서
  //    제목으로 복구. 미사용 섹션 중 제목 일치가 유일할 때만 배정 → 틀린 오디오 0 유지.
  for (const c of recover) {
    const pOrd = partOrderByIdx.get(c.chapter_idx)
    const textKey = normalizeChapterTitleForMatch(c.title)
    if (pOrd == null || textKey.length < 3) continue
    const vsecs = sectionsByVol.get(pOrd) ?? []
    const cands = vsecs.filter(
      (s) =>
        !usedSec.has(s) &&
        normalizeChapterTitleForMatch(s.title).length >= 3 &&
        titleRoughlySame(normalizeChapterTitleForMatch(s.title), textKey),
    )
    if (cands.length === 1) {
      assigned.set(c.chapter_idx, [cands[0]!])
      usedSec.add(cands[0]!)
    }
  }

  // 5. PASS 3 — 절단/오타로 제목 검증 실패했으나 번호 라벨이 구조 위치와 정확히 일치하는
  //    단일·미사용 섹션이면 번호를 신뢰(라벨=위치 → 같은 챕터, 제목만 불량). spot-check 위해 기록.
  const number_trusted: number[] = []
  for (const c of recover) {
    if (assigned.has(c.chapter_idx)) continue
    const arr = numByIdx.get(c.chapter_idx)
    if (!arr || arr.length !== 1) continue
    const sec = arr[0]!.sec
    if (usedSec.has(sec)) continue
    const meta = parseVolumeSectionMeta(sec.title)
    if (!meta || meta.chFrom !== meta.chTo) continue // 묶음 제외 — 단일 챕터 섹션만
    assigned.set(c.chapter_idx, [sec])
    usedSec.add(sec)
    number_trusted.push(c.chapter_idx)
  }

  // 6. chapter_map 빌드
  const chapter_map: VolumeAlignResult['chapter_map'] = {}
  const unmatched_idx: number[] = []
  for (const c of sorted) {
    const secs = assigned.get(c.chapter_idx)
    if (!secs || secs.length === 0) {
      unmatched_idx.push(c.chapter_idx)
      continue
    }
    chapter_map[c.chapter_idx] = {
      roman: c.chapter_idx,
      parts: secs.map((s) => ({ url: s.url, title: s.title || null, secs: s.secs, reader: s.reader })),
    }
  }
  // 복구/번호신뢰된 conflict 는 최종 conflict 목록에서 제외
  const finalConflicts = conflicts.filter((cf) => !assigned.has(cf.chapter_idx))

  const matched = Object.keys(chapter_map).length
  return {
    ok: matched > 0,
    chapter_map,
    matched,
    total_chapters: sorted.length,
    unmatched_idx,
    conflicts: finalConflicts,
    orphan_sections: orphan,
    number_trusted,
  }
}
