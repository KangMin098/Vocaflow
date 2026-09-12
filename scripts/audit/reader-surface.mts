// scripts/audit/reader-surface.mts
// READ-ONLY audit — 리더/글 표면의 "저장도 렌더도 성공하는데 학습자에게 틀리게 보이는" 결함 측정.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/reader-surface.mts

import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// env
// ─────────────────────────────────────────────
function loadEnv(): { url: string; key: string } {
  const raw = readFileSync('apps/web/.env.local', 'utf8')
  const pick = (name: string): string => {
    const m = raw.match(new RegExp('^' + name + '\\s*=\\s*"?([^"\\r\\n]+)"?\\s*$', 'm'))
    if (!m) throw new Error('missing env ' + name)
    return m[1]!.trim()
  }
  return { url: pick('NEXT_PUBLIC_SUPABASE_URL'), key: pick('SUPABASE_SERVICE_ROLE_KEY') }
}

// ─────────────────────────────────────────────
// pipeline 함수 복제 (packages/library-pipeline/src/segment/offset-calculator.ts 그대로)
// ─────────────────────────────────────────────
const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
  'St', 'Mt', 'Ave', 'Rd',
  'Inc', 'Co', 'Ltd', 'Corp',
  'eg', 'ie', 'etc', 'vs', 'cf',
  'pm', 'am',
])

function computeParagraphOffsets(content: string): number[] {
  const offsets: number[] = [0]
  const re = /\n\s*\n+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) offsets.push(m.index + m[0].length)
  return offsets
}

function computeSentenceOffsets(content: string): number[] {
  const offsets: number[] = [0]
  const re = /([.!?])\s+(?=[A-Z"'])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const before = content.slice(Math.max(0, m.index - 10), m.index)
    const lastWord = before.split(/\s+/).pop()?.replace(/[^a-zA-Z]/g, '') ?? ''
    if (ABBREVIATIONS.has(lastWord)) continue
    offsets.push(m.index + m[0].length)
  }
  return offsets
}

function countWords(content: string): number {
  const matches = content.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g)
  return matches?.length ?? 0
}

// ChapterContent.tsx splitByOffsets 그대로
function splitByOffsets(content: string, offsets: number[]): string[] {
  if (offsets.length === 0) return [content]
  const result: string[] = []
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i]!
    const end = i + 1 < offsets.length ? offsets[i + 1]! : content.length
    result.push(content.slice(start, end).trim())
  }
  return result
}

// ─────────────────────────────────────────────
// paging helper
// ─────────────────────────────────────────────
async function paged<T>(
  q: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
  page = 1000,
  max = Infinity,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await retry(() => q(from, from + page - 1), label)
    if (error) throw new Error(label + ': ' + error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < page || out.length >= max) break
    from += page
  }
  return out
}

/** 이 머신의 TLS 가 간헐적으로 끊긴다 — 측정치가 아니라 전송 문제이므로 재시도한다. */
async function retry<T>(fn: () => PromiseLike<T>, label: string, tries = 5): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fn()
      // supabase-js 는 전송 실패를 throw 하지 않고 { error } 로 돌려준다 — 여기서 되잡는다.
      const err = (r as { error?: { message?: string } | null })?.error
      if (err && /fetch failed|network|ETIMEDOUT|ECONNRESET|socket/i.test(err.message ?? '')) {
        throw new Error(err.message ?? 'transport')
      }
      return r
    } catch (e) {
      last = e
      const c = (e as { cause?: { code?: string } })?.cause?.code
      console.error(`  [retry ${i + 1}/${tries}] ${label}: ${String((e as Error).message)} ${c ?? ''}`)
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw new Error(label + ' (재시도 ' + tries + '회 실패): ' + String(last))
}

function pct(n: number, d: number): string {
  return d === 0 ? '-' : ((n / d) * 100).toFixed(2) + '%'
}

// ─────────────────────────────────────────────
type ChapterMeta = {
  id: string
  library_book_id: string
  chapter_idx: number
  chapter_title: string | null
  word_count: number
  content_hash: string | null
  paragraph_offsets: number[] | null
  sentence_offsets: number[] | null
}

async function main(): Promise<void> {
  const { url, key } = loadEnv()
  const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } })

  const out: string[] = []
  const say = (s = ''): void => {
    out.push(s)
    console.log(s)
  }

  // ══════════════════════════════════════════
  // 0. 모집단
  // ══════════════════════════════════════════
  say('════ 0. 모집단 ════')
  const books = await paged<{ id: string; title: string; status: string; word_count: number | null; chapter_count: number | null; reading_minutes: number | null }>(
    (f, t) => db.from('library_books').select('id, title, status, word_count, chapter_count, reading_minutes').order('id').range(f, t),
    'library_books',
  )
  const published = books.filter((b) => b.status === 'published')
  say(`library_books ${books.length} (published ${published.length})`)
  const pubIds = new Set(published.map((b) => b.id))

  const chapters = await paged<ChapterMeta>(
    (f, t) =>
      db
        .from('library_chapters_master')
        .select('id, library_book_id, chapter_idx, chapter_title, word_count, content_hash, paragraph_offsets, sentence_offsets')
        .order('id')
        .range(f, t),
    'library_chapters_master',
  )
  say(`library_chapters_master ${chapters.length} rows`)
  const pubChapters = chapters.filter((c) => pubIds.has(c.library_book_id))
  say(`  그중 published 도서 소속 ${pubChapters.length}`)

  // ══════════════════════════════════════════
  // 1. offsets 구조 검사 (본문 없이 가능한 것)
  // ══════════════════════════════════════════
  say('')
  say('════ 1. offsets 구조 (전수, 본문 미조회) ════')
  let poNull = 0, poEmpty = 0, poNonZeroFirst = 0, poNonMono = 0
  let soNull = 0, soEmpty = 0, soLen1 = 0
  const nonZeroFirstSamples: ChapterMeta[] = []
  const nonMonoSamples: ChapterMeta[] = []
  for (const c of pubChapters) {
    const po = c.paragraph_offsets
    if (po == null) poNull++
    else if (po.length === 0) poEmpty++
    else {
      if (po[0] !== 0) { poNonZeroFirst++; if (nonZeroFirstSamples.length < 5) nonZeroFirstSamples.push(c) }
      for (let i = 1; i < po.length; i++) {
        if (po[i]! <= po[i - 1]!) { poNonMono++; if (nonMonoSamples.length < 5) nonMonoSamples.push(c); break }
      }
    }
    const so = c.sentence_offsets
    if (so == null) soNull++
    else if (so.length === 0) soEmpty++
    else if (so.length === 1) soLen1++
  }
  say(`paragraph_offsets: null ${poNull} · 빈배열 ${poEmpty} · 첫값≠0 ${poNonZeroFirst} · 비단조 ${poNonMono}  / ${pubChapters.length}`)
  say(`sentence_offsets : null ${soNull} · 빈배열 ${soEmpty} · 길이1 ${soLen1}  / ${pubChapters.length}`)
  for (const s of nonZeroFirstSamples) say(`  [첫값≠0] book=${s.library_book_id} ch=${s.chapter_idx} po[0]=${s.paragraph_offsets?.[0]}`)
  for (const s of nonMonoSamples) say(`  [비단조] book=${s.library_book_id} ch=${s.chapter_idx}`)

  // ══════════════════════════════════════════
  // 2. content_hash 무결성
  // ══════════════════════════════════════════
  say('')
  say('════ 2. content_hash ════')
  const nullHash = pubChapters.filter((c) => !c.content_hash)
  say(`content_hash NULL (published 도서): ${nullHash.length}`)

  // orphan: hash 가 content_chunks 에 없는가 — 배치 in() 조회
  const allHashes = Array.from(new Set(chapters.map((c) => c.content_hash).filter(Boolean) as string[]))
  say(`distinct content_hash (전체 챕터) ${allHashes.length} / 챕터 ${chapters.length}`)
  const existing = new Set<string>()
  for (let i = 0; i < allHashes.length; i += 100) {
    const slice = allHashes.slice(i, i + 100)
    const { data, error } = await retry(
      () => db.from('content_chunks').select('hash').in('hash', slice),
      'content_chunks hash probe',
    )
    if (error) throw new Error('content_chunks hash probe: ' + error.message)
    for (const r of data as Array<{ hash: string }>) existing.add(r.hash)
  }
  const orphans = chapters.filter((c) => c.content_hash && !existing.has(c.content_hash))
  const orphansPub = orphans.filter((c) => pubIds.has(c.library_book_id))
  say(`orphan hash (content_chunks 에 없음): 전체 ${orphans.length} · published ${orphansPub.length}`)
  for (const s of orphansPub.slice(0, 5)) say(`  [orphan] book=${s.library_book_id} ch=${s.chapter_idx} hash=${s.content_hash?.slice(0, 12)}`)

  // 같은 책 안에서 hash 중복 = 학습자가 다른 장에서 같은 본문을 읽는다
  const byBook = new Map<string, ChapterMeta[]>()
  for (const c of pubChapters) {
    const arr = byBook.get(c.library_book_id) ?? []
    arr.push(c)
    byBook.set(c.library_book_id, arr)
  }
  let dupBooks = 0, dupChapterRows = 0
  const dupSamples: string[] = []
  for (const [bid, arr] of byBook) {
    const m = new Map<string, ChapterMeta[]>()
    for (const c of arr) {
      if (!c.content_hash) continue
      const g = m.get(c.content_hash) ?? []
      g.push(c)
      m.set(c.content_hash, g)
    }
    let bookHas = false
    for (const [h, g] of m) {
      if (g.length > 1) {
        bookHas = true
        dupChapterRows += g.length
        if (dupSamples.length < 6) {
          const t = books.find((b) => b.id === bid)?.title ?? bid
          dupSamples.push(`  [중복본문] "${t}" ch=${g.map((x) => x.chapter_idx).join(',')} hash=${h.slice(0, 10)} wc=${g[0]!.word_count}`)
        }
      }
    }
    if (bookHas) dupBooks++
  }
  say(`같은 책 안 content_hash 중복: ${dupBooks}권 · 관련 챕터 ${dupChapterRows}행`)
  dupSamples.forEach((s) => say(s))

  // ══════════════════════════════════════════
  // 3. chapter_idx 연속성
  // ══════════════════════════════════════════
  say('')
  say('════ 3. chapter_idx 연속성 (published) ════')
  let gapBooks = 0, dupIdxBooks = 0, notStart1 = 0
  const gapSamples: string[] = []
  for (const [bid, arr] of byBook) {
    const idxs = arr.map((c) => c.chapter_idx).sort((a, b) => a - b)
    const uniq = new Set(idxs)
    if (uniq.size !== idxs.length) dupIdxBooks++
    if (idxs[0] !== 1) notStart1++
    const expected = idxs[idxs.length - 1]! - idxs[0]! + 1
    if (uniq.size !== expected) {
      gapBooks++
      if (gapSamples.length < 5) {
        const t = books.find((b) => b.id === bid)?.title ?? bid
        gapSamples.push(`  [idx 구멍] "${t}" n=${idxs.length} range=${idxs[0]}~${idxs[idxs.length - 1]}`)
      }
    }
  }
  say(`published 도서 ${byBook.size}권: idx 구멍 ${gapBooks} · idx 중복 ${dupIdxBooks} · 1로 시작 안 함 ${notStart1}`)
  gapSamples.forEach((s) => say(s))

  // ══════════════════════════════════════════
  // 4. 본문 대조 — 표본
  // ══════════════════════════════════════════
  say('')
  say('════ 4. 본문 대조 표본 ════')
  // 선택 규칙: published 도서 소속 + content_hash 존재 챕터를 (library_book_id, chapter_idx) 정렬 후
  //            균등 간격(stride)으로 SAMPLE_N 개. 도서 편중 방지.
  const SAMPLE_N = 400
  const pool = pubChapters
    .filter((c) => c.content_hash && existing.has(c.content_hash))
    .sort((a, b) => (a.library_book_id < b.library_book_id ? -1 : a.library_book_id > b.library_book_id ? 1 : a.chapter_idx - b.chapter_idx))
  const stride = Math.max(1, Math.floor(pool.length / SAMPLE_N))
  const sample: ChapterMeta[] = []
  for (let i = 0; i < pool.length && sample.length < SAMPLE_N; i += stride) sample.push(pool[i]!)
  say(`표본 ${sample.length} / 모집단 ${pool.length} (stride=${stride}, 결정적)`)

  const hashes = Array.from(new Set(sample.map((c) => c.content_hash!)))
  const contentMap = new Map<string, string>()
  for (let i = 0; i < hashes.length; i += 20) {
    const slice = hashes.slice(i, i + 20)
    const { data, error } = await retry(
      () => db.from('content_chunks').select('hash, content').in('hash', slice),
      'content_chunks fetch',
    )
    if (error) throw new Error('content_chunks fetch: ' + error.message)
    for (const r of data as Array<{ hash: string; content: string }>) contentMap.set(r.hash, r.content)
  }

  let poMismatch = 0, poOutOfRange = 0, poDroppedHead = 0, poEmptyPara = 0
  let soMismatch = 0, soOutOfRange = 0, soLen1WithText = 0
  let wcMismatch = 0, wcBig = 0
  let titleInBody = 0, titleChecked = 0
  let soChecked = 0, soMidWord = 0, soLowerStart = 0, poChecked = 0, poMidWord = 0
  let leadingTrimLoss = 0
  const poSamples: string[] = [], soSamples: string[] = [], wcSamples: string[] = [], rangeSamples: string[] = []
  let sumAbsWcDiff = 0

  const bookTitle = (id: string): string => books.find((b) => b.id === id)?.title ?? id

  for (const c of sample) {
    const content = contentMap.get(c.content_hash!)
    if (content == null) continue
    const po = c.paragraph_offsets ?? []
    const so = c.sentence_offsets ?? []

    // 4-a. 재계산 대조
    const rpo = computeParagraphOffsets(content)
    const rso = computeSentenceOffsets(content)
    const eq = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i])
    if (!eq(po, rpo)) {
      poMismatch++
      if (poSamples.length < 6) {
        const firstDiff = po.findIndex((v, i) => v !== rpo[i])
        poSamples.push(
          `  [PO불일치] "${bookTitle(c.library_book_id)}" ch=${c.chapter_idx} 저장 ${po.length}개 / 실제 ${rpo.length}개 · 첫차이 i=${firstDiff} 저장=${po[firstDiff]} 실제=${rpo[firstDiff]} · len=${content.length}`,
        )
      }
    }
    if (!eq(so, rso)) {
      soMismatch++
      if (soSamples.length < 6) {
        const firstDiff = so.findIndex((v, i) => v !== rso[i])
        soSamples.push(
          `  [SO불일치] "${bookTitle(c.library_book_id)}" ch=${c.chapter_idx} 저장 ${so.length}개 / 실제 ${rso.length}개 · 첫차이 i=${firstDiff} 저장=${so[firstDiff]} 실제=${rso[firstDiff]}`,
        )
      }
    }

    // 4-b. 범위 초과 = 렌더 시 빈 문단
    if (po.length > 0 && po[po.length - 1]! >= content.length) {
      poOutOfRange++
      if (rangeSamples.length < 6) rangeSamples.push(`  [PO범위초과] "${bookTitle(c.library_book_id)}" ch=${c.chapter_idx} max(po)=${po[po.length - 1]} len=${content.length}`)
    }
    if (so.length > 0 && so[so.length - 1]! >= content.length) soOutOfRange++
    if (po.length > 0 && po[0]! > 0) poDroppedHead++
    if (so.length === 1 && countWords(content) > 60) soLen1WithText++

    // 4-c. splitByOffsets 렌더 결과에 빈 문단이 생기는가
    const paras = splitByOffsets(content, po)
    if (paras.some((p) => p.length === 0)) poEmptyPara++
    // 렌더 결과를 이어붙였을 때 원문 단어가 사라지는가 (trim 손실 제외한 실제 누락)
    const renderedWords = countWords(paras.join('\n\n'))
    const actualWords = countWords(content)
    if (renderedWords < actualWords) leadingTrimLoss++

    // 4-c-2. 경계 정렬 — EchoMatch 는 sentence_offsets 로 잘라 "따라 읽기" 문장을 만든다.
    //        경계가 낱말 한복판이면 학습자는 조각을 읽게 된다.
    for (const o of so) {
      if (o <= 0 || o >= content.length) continue
      soChecked++
      const prev = content[o - 1]!
      const cur = content[o]!
      if (/[A-Za-z]/.test(prev) && /[A-Za-z]/.test(cur)) soMidWord++
      else if (/[a-z]/.test(cur)) soLowerStart++
    }
    for (const o of po) {
      if (o <= 0 || o >= content.length) continue
      poChecked++
      if (/[A-Za-z]/.test(content[o - 1]!) && /[A-Za-z]/.test(content[o]!)) poMidWord++
    }

    // 4-d. word_count 정합
    if (c.word_count !== actualWords) {
      wcMismatch++
      sumAbsWcDiff += Math.abs(c.word_count - actualWords)
      const rel = actualWords === 0 ? 1 : Math.abs(c.word_count - actualWords) / actualWords
      if (rel > 0.05) {
        wcBig++
        if (wcSamples.length < 6) wcSamples.push(`  [WC] "${bookTitle(c.library_book_id)}" ch=${c.chapter_idx} 저장=${c.word_count} 실제=${actualWords} (${(rel * 100).toFixed(1)}% 차)`)
      }
    }

    // 4-e. 제목이 본문 머리에 실제로 있는가 (엉뚱한 장 제목 탐지)
    const t = (c.chapter_title ?? '').trim()
    if (t.length >= 4) {
      titleChecked++
      const head = content.slice(0, 400).toLowerCase().replace(/\s+/g, ' ')
      if (head.includes(t.toLowerCase().replace(/\s+/g, ' '))) titleInBody++
    }
  }

  const n = sample.length
  say(`PO 재계산 불일치      ${poMismatch}/${n} (${pct(poMismatch, n)})`)
  poSamples.forEach((s) => say(s))
  say(`SO 재계산 불일치      ${soMismatch}/${n} (${pct(soMismatch, n)})`)
  soSamples.forEach((s) => say(s))
  say(`PO 범위 초과          ${poOutOfRange}/${n}`)
  rangeSamples.forEach((s) => say(s))
  say(`SO 범위 초과          ${soOutOfRange}/${n}`)
  say(`PO 첫값>0 (머리 유실) ${poDroppedHead}/${n}`)
  say(`렌더 시 빈 문단 발생  ${poEmptyPara}/${n}`)
  say(`렌더 후 단어 유실     ${leadingTrimLoss}/${n}`)
  say(`SO 길이1 인데 본문>60단어 ${soLen1WithText}/${n}  (EchoMatch 가 fallback 하는지 여부와 직결)`)
  say(`word_count 불일치     ${wcMismatch}/${n} · 5%초과 ${wcBig} · 평균 절대차 ${wcMismatch ? (sumAbsWcDiff / wcMismatch).toFixed(1) : 0}`)
  wcSamples.forEach((s) => say(s))
  say(`제목이 본문 머리 400자 안에 있음 ${titleInBody}/${titleChecked}`)
  say(`문장 경계가 낱말 한복판  ${soMidWord}/${soChecked} (${pct(soMidWord, soChecked)})  — EchoMatch 따라읽기 문장`)
  say(`문장 경계가 소문자로 시작 ${soLowerStart}/${soChecked} (${pct(soLowerStart, soChecked)})`)
  say(`문단 경계가 낱말 한복판  ${poMidWord}/${poChecked} (${pct(poMidWord, poChecked)})`)

  // ══════════════════════════════════════════
  // 5. library_books 집계 컬럼
  // ══════════════════════════════════════════
  say('')
  say('════ 5. library_books 집계 vs 실제 챕터 ════')
  let bcMismatch = 0, bwMismatch = 0, rmMismatch = 0
  const bSamples: string[] = []
  for (const b of published) {
    const arr = byBook.get(b.id) ?? []
    const sumWc = arr.reduce((s, c) => s + (c.word_count ?? 0), 0)
    if ((b.chapter_count ?? -1) !== arr.length) {
      bcMismatch++
      if (bSamples.length < 8) bSamples.push(`  [ch_count] "${b.title}" 저장=${b.chapter_count} 실제=${arr.length}`)
    }
    if (b.word_count != null && sumWc > 0 && Math.abs(b.word_count - sumWc) / sumWc > 0.05) bwMismatch++
    const expMin = Math.ceil(sumWc / 150)
    if (b.reading_minutes != null && sumWc > 0 && Math.abs(b.reading_minutes - expMin) > Math.max(2, expMin * 0.1)) rmMismatch++
  }
  say(`published ${published.length}권 — chapter_count 불일치 ${bcMismatch} · word_count 5%초과 ${bwMismatch} · reading_minutes 불일치 ${rmMismatch}`)
  bSamples.forEach((s) => say(s))

  // ══════════════════════════════════════════
  // 6. library_articles
  // ══════════════════════════════════════════
  say('')
  say('════ 6. library_articles ════')
  const { count: artTotal } = await retry(
    () => db.from('library_articles').select('*', { count: 'exact', head: true }),
    'articles count',
  )
  const { count: artPub } = await retry(
    () => db.from('library_articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    'articles published count',
  )
  say(`library_articles ${artTotal} · published ${artPub}`)

  const arts = await paged<{ id: string; title: string; content: string | null; word_count: number | null; source: string | null; copyright_safe_in_kr: boolean | null }>(
    (f, t) =>
      db
        .from('library_articles')
        .select('id, title, content, word_count, source, copyright_safe_in_kr')
        .eq('status', 'published')
        .order('id')
        .range(f, t),
    'published articles',
    200,
  )
  say(`published 전수 적재 ${arts.length}편`)

  let aNullContent = 0, aShort = 0, aMidWord = 0, aNoTerminal = 0, aHtml = 0, aEntity = 0, aBoiler = 0, aWcMismatch = 0, aTitleDup = 0
  const midWordS: string[] = [], boilerS: string[] = [], htmlS: string[] = [], wcS: string[] = []
  const BOILER = [
    /\bcookie[s]? policy\b/i, /\bsubscribe to our newsletter\b/i, /\bsign up for\b/i,
    /\ball rights reserved\b/i, /\bread more\b\s*$/i, /\bshare this\b/i,
    /\bskip to (main )?content\b/i, /\[edit\]/i, /\bjump to navigation\b/i,
    /\bfrom wikipedia, the free encyclopedia\b/i, /\bthis article needs additional citations\b/i,
    /\bretrieved from\b/i, /\bcategories\s*:/i, /\bprivacy policy\b/i,
  ]
  for (const a of arts) {
    const c = a.content
    if (!c || c.trim().length === 0) { aNullContent++; continue }
    const wc = countWords(c)
    if (wc < 50) aShort++
    const tail = c.trimEnd()
    const lastCh = tail.slice(-1)
    if (/[A-Za-z]/.test(lastCh)) {
      aNoTerminal++
      // 마지막 "단어"가 잘렸는지: 마지막 토큰이 사전형이 아닐 가능성은 못 재므로
      // "끝이 알파벳 + 문장부호 없음" 자체를 절단 후보로 센다.
      const lastWords = tail.split(/\s+/).slice(-6).join(' ')
      if (midWordS.length < 6) midWordS.push(`  [절단후보] "${a.title.slice(0, 50)}" (${a.source}) …${lastWords}`)
      aMidWord++
    }
    if (/<\/?(p|div|br|span|a|img|h[1-6]|ul|li|table)\b[^>]*>/i.test(c)) {
      aHtml++
      if (htmlS.length < 6) {
        const m = c.match(/<\/?(p|div|br|span|a|img|h[1-6]|ul|li|table)\b[^>]*>/i)
        htmlS.push(`  [HTML] "${a.title.slice(0, 50)}" (${a.source}) → ${m?.[0]}`)
      }
    }
    if (/&(nbsp|amp|lt|gt|quot|#39|#x?[0-9a-f]+);/i.test(c)) aEntity++
    const hitB = BOILER.find((r) => r.test(c))
    if (hitB) {
      aBoiler++
      if (boilerS.length < 8) {
        const m = c.match(hitB)
        const at = c.search(hitB)
        boilerS.push(`  [보일러] "${a.title.slice(0, 45)}" (${a.source}) "${m?.[0]}" @${at}/${c.length}`)
      }
    }
    if (a.word_count != null && wc > 0 && Math.abs(a.word_count - wc) / wc > 0.1) {
      aWcMismatch++
      if (wcS.length < 5) wcS.push(`  [글WC] "${a.title.slice(0, 45)}" 저장=${a.word_count} 실제=${wc}`)
    }
    const head = c.slice(0, 200).trim().toLowerCase()
    if (a.title && head.startsWith(a.title.trim().toLowerCase())) aTitleDup++
  }
  const an = arts.length
  say(`content 비어있음      ${aNullContent}/${an}`)
  say(`50단어 미만          ${aShort}/${an}`)
  say(`끝이 문장부호 아님(절단 후보) ${aMidWord}/${an} (${pct(aMidWord, an)})`)
  midWordS.forEach((s) => say(s))
  say(`HTML 태그 잔존        ${aHtml}/${an}`)
  htmlS.forEach((s) => say(s))
  say(`HTML 엔티티 잔존      ${aEntity}/${an}`)
  say(`보일러플레이트/내비    ${aBoiler}/${an}`)
  boilerS.forEach((s) => say(s))
  say(`word_count 10%초과 불일치 ${aWcMismatch}/${an}`)
  wcS.forEach((s) => say(s))
  say(`제목이 본문 첫머리에 중복 ${aTitleDup}/${an}`)

  say('')
  say('════ 끝 ════')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
