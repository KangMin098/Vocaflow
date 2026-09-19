// scripts/audit/blank-exposure.mts
//
// 「저장도 렌더도 성공하는데 학습자에게 틀리게 보이는」 결함 계측 — 받아쓰기 · EchoMatch · 플래시카드 빈칸.
//
// 재는 것 (실제 shipped 함수를 import 해서 그대로 돌린다):
//   A. vocabularies (hub 진입) — blankSurface(example, word) 무-굴절형 → 빈칸 미삽입률 / 정답 노출률
//   B. shared_words (scoped 진입) — blankSurface(example, word, dictForms) → 같은 것
//   C. SpellForge 정답 노출 — 예문이 통째로 렌더되므로 예문에 단어가 들어 있으면 그대로 정답
//   D. 받아쓰기 resolveSetSource — 타깃 lemma 가 자기 source_sentence 에 실제로 있는가
//   E. 받아쓰기 evaluateTargets — matchSurface 미스 시 prefix 폴백이 **엉뚱한 토큰**을 채점하는가
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/blank-exposure.mts
// READ ONLY.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { blankSurface, matchSurface } from '../../apps/web/src/lib/text/surface-match'
import { evaluateTargets } from '../../apps/web/src/lib/dictation/targets'
import { scoreSentence } from '../../apps/web/src/lib/dictation/scoring'
import { isUsableSentence } from '../../apps/web/src/lib/dictation/source'
import { splitIntoSentences } from '../../apps/web/src/lib/echo/sentence-splitter'

const envText = fs.readFileSync('apps/web/.env.local', 'utf8')
function envGet(key: string): string {
  const re = new RegExp('^' + key + '\\s*=\\s*(.+)$', 'm')
  const m = envText.match(re)
  if (!m) throw new Error('missing env ' + key)
  return m[1].trim().replace(/^["']|["']$/g, '')
}

const db = createClient(envGet('NEXT_PUBLIC_SUPABASE_URL'), envGet('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

const SW_SAMPLE = Number(process.argv[2] ?? 40000)

function pct(a: number, b: number): string {
  return b === 0 ? '  n/a' : ((a / b) * 100).toFixed(2) + '%'
}

/** 예문 안에 그 단어(또는 굴절형)가 **눈에 보이는가** — 문자열 포함(정규식 아님, 어절 경계 무시).
 *  빈칸이 안 들어간 채 예문이 화면에 뜨면 학습자는 이걸 읽는다. */
function visiblyContains(sentence: string, word: string): boolean {
  const s = sentence.toLowerCase()
  const w = word.trim().toLowerCase()
  if (w.length < 2) return false
  if (s.includes(w)) return true
  // -y → -ies/-ied, e-탈락 등으로 어간만 남는 경우도 학습자 눈에는 정답이다 (앞 4글자 이상 일치)
  const stem = w.length >= 5 ? w.slice(0, w.length - 1) : w
  return stem.length >= 4 && s.includes(stem)
}

interface Bucket {
  n: number
  blankMiss: number
  blankMissButVisible: number
  matchMiss: number
  visible: number
}
function newBucket(): Bucket {
  return { n: 0, blankMiss: 0, blankMissButVisible: 0, matchMiss: 0, visible: 0 }
}

// ────────────────────────────────────────────────────────────────
// 사전 굴절형 로더 (workspace/scoped-words.loadInflectedForms 와 동일한 in() 배치)
// ────────────────────────────────────────────────────────────────
async function retry<T>(fn: () => Promise<T>, what: string): Promise<T> {
  let last: unknown
  for (let a = 0; a < 5; a += 1) {
    try {
      return await fn()
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 800 * (a + 1)))
    }
  }
  throw new Error(what + ' failed: ' + String(last))
}

// ⚠️ `.in(word, [...])` 는 이 머신에서 fetch 가 걸린다(150·100·50개 모두). 사전을 통째로 페이징한다.
let FORMS_CACHE: Map<string, string[]> | null = null
async function loadForms(_words: string[]): Promise<Map<string, string[]>> {
  if (FORMS_CACHE) return FORMS_CACHE
  const map = new Map<string, string[]>()
  let cursor = ''
  for (;;) {
    const rows = await retry(async () => {
      const { data, error } = await db
        .from('shared_dictionary')
        .select('word, inflected_forms')
        .gt('word', cursor)
        .order('word')
        .limit(1000)
      if (error) throw new Error(error.message)
      return (data ?? []) as Array<{ word: string; inflected_forms: string[] | null }>
    }, 'dict page')
    if (rows.length === 0) break
    for (const r of rows) {
      if (r.inflected_forms && r.inflected_forms.length > 0) map.set(r.word.toLowerCase(), r.inflected_forms)
    }
    cursor = rows[rows.length - 1].word
    process.stdout.write('\r  dict ' + map.size + '   ')
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r')
  FORMS_CACHE = map
  return map
}

// ────────────────────────────────────────────────────────────────
// A · B · C
// ────────────────────────────────────────────────────────────────
interface Pair {
  word: string
  lemma: string
  example: string
}

let EXACT_SUBSTR = 0
function measurePairs(label: string, pairs: Pair[], forms: Map<string, string[]> | null): Bucket {
  const b = newBucket()
  const samples: string[] = []
  EXACT_SUBSTR = 0
  for (const p of pairs) {
    b.n += 1
    const f = forms ? forms.get(p.lemma.toLowerCase()) ?? null : null
    const blanked = blankSurface(p.example, p.word, f)
    const vis = visiblyContains(p.example, p.word)
    if (p.example.toLowerCase().includes(p.word.trim().toLowerCase())) EXACT_SUBSTR += 1
    if (vis) b.visible += 1
    if (matchSurface(p.example, p.word, f) === null) b.matchMiss += 1
    if (blanked === p.example) {
      b.blankMiss += 1
      if (vis) {
        b.blankMissButVisible += 1
        if (samples.length < 6) samples.push('    ' + p.word.padEnd(16) + ' | ' + p.example.slice(0, 100))
      }
    }
  }
  console.log('\n── ' + label + ' ──')
  console.log('  예문 보유 행                 ' + b.n)
  console.log('  matchSurface 미스            ' + b.matchMiss + '  ' + pct(b.matchMiss, b.n))
  console.log('  빈칸 미삽입(문장 그대로 반환) ' + b.blankMiss + '  ' + pct(b.blankMiss, b.n))
  console.log('  ↳ 그중 정답이 예문에 보임     ' + b.blankMissButVisible + '  ' + pct(b.blankMissButVisible, b.n))
  console.log('  예문에 **철자 그대로** 정답이 있음 ' + EXACT_SUBSTR + '  ' + pct(EXACT_SUBSTR, b.n) + '   ← SpellForge.tsx:482 는 이 예문을 입력 화면에 통째 렌더한다')
  console.log('  예문에 단어(굴절형 포함)가 보임    ' + b.visible + '  ' + pct(b.visible, b.n))
  if (samples.length) {
    console.log('  ── 빈칸 없이 정답이 보이는 표본 ──')
    for (const s of samples) console.log(s)
  }
  return b
}

async function partA(): Promise<void> {
  const rows: Array<{ word: string; lemma: string | null; example_sentence: string | null }> = []
  let cursor = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const page = await retry(async () => {
      const { data, error } = await db
        .from('vocabularies')
        .select('id, word, lemma, example_sentence')
        .gt('id', cursor)
        .order('id')
        .limit(1000)
      if (error) throw new Error(error.message)
      return (data ?? []) as Array<{ id: string; word: string; lemma: string | null; example_sentence: string | null }>
    }, 'vocabularies page')
    if (page.length === 0) break
    rows.push(...page)
    cursor = page[page.length - 1].id
  }
  const pairs: Pair[] = rows
    .filter((r) => (r.example_sentence ?? '').trim().length >= 8 && (r.word ?? '').trim().length >= 2)
    .map((r) => ({ word: r.word, lemma: (r.lemma ?? r.word).toLowerCase(), example: r.example_sentence as string }))
  console.log('\n[A] vocabularies 전수 ' + rows.length + '행 — /flashcard hub · /spellforge hub 의 단어 출처')
  measurePairs('A1 hub-words.ts:50  blankSurface(example, word)  — 굴절형 없음 (shipped)', pairs, null)
  const forms = await loadForms(pairs.map((p) => p.lemma))
  measurePairs('A2 (참고) 같은 데이터에 사전 굴절형을 줬을 때', pairs, forms)
}

async function partB(): Promise<void> {
  // 발행 세트의 shared_words — /flashcard/play?set=… · /spellforge/play?set=… · 받아쓰기 ?set=
  const rows: Array<{ id: string; word: string; lemma: string | null; source_sentence: string | null; example_en: string | null }> = []
  let cursor = '00000000-0000-0000-0000-000000000000'
  while (rows.length < SW_SAMPLE) {
    const page = await retry(async () => {
      const { data, error } = await db
        .from('shared_words')
        .select('id, word, lemma, source_sentence, example_en')
        .gt('id', cursor)
        .order('id')
        .limit(1000)
      if (error) throw new Error(error.message)
      return (data ?? []) as typeof rows
    }, 'shared_words page')
    if (page.length === 0) break
    rows.push(...page)
    cursor = page[page.length - 1].id
    process.stdout.write('\r  shared_words ' + rows.length)
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r')
  const pairs: Pair[] = rows
    .map((r) => ({
      word: r.word,
      lemma: (r.lemma ?? r.word).toLowerCase(),
      example: (r.source_sentence ?? r.example_en ?? '').trim(),
    }))
    .filter((p) => p.example.length >= 8 && p.word.trim().length >= 2)
  console.log('\n[B] shared_words 표본 ' + rows.length + '행 — /flashcard/play?set= · /spellforge/play?set= 의 단어 출처')
  const forms = await loadForms(pairs.map((p) => p.lemma))
  measurePairs('B1 scoped-words.ts:53  blankSurface(example, word, inflectedForms) (shipped)', pairs, forms)

  // ── D · E · F: 받아쓰기 ──
  partDE(rows)
  partF(rows)
}

// ────────────────────────────────────────────────────────────────
// D · E — 받아쓰기
// ────────────────────────────────────────────────────────────────
function partDE(
  rows: Array<{ word: string; lemma: string | null; source_sentence: string | null; example_en: string | null }>,
): void {
  // resolveSetSource: 문장 = source_sentence ?? example_en, 타깃 = lemma (matchSurface 검증 없음)
  let n = 0
  let targetAbsent = 0
  const absentSamples: string[] = []
  // E: 채점 시뮬레이션 — 학습자가 **완벽하게** 받아썼다고 가정. 그런데도 hit=false 가 나오면 오채점.
  let graded = 0
  let falseMiss = 0
  let wrongToken = 0
  let truncatedPrefix = 0
  let noRating = 0
  const eSamples: string[] = []

  for (const r of rows) {
    const sentence = (r.source_sentence ?? r.example_en ?? '').trim()
    if (!sentence || !isUsableSentence(sentence)) continue
    const lemma = (r.lemma ?? r.word).toLowerCase()
    if (lemma.length < 2) continue
    n += 1
    const m = matchSurface(sentence, lemma, [])
    if (m === null) {
      targetAbsent += 1
      if (absentSamples.length < 6) absentSamples.push('    ' + lemma.padEnd(16) + ' | ' + sentence.slice(0, 96))
    }

    // 완벽 전사 채점
    const res = scoreSentence(sentence, sentence, 'smart')
    const out = evaluateTargets({
      expected: sentence,
      targetWords: [lemma],
      targetForms: { [lemma]: [] },
      wordResults: res.wordResults,
      hintsUsed: 0,
      maxHintLevel: 0,
      replayCount: 1,
      skipped: false,
    })[0]
    graded += 1
    if (!out.hit) {
      falseMiss += 1
      if (out.rating === 2 && !out.partial) noRating += 1
      // 폴백이 엉뚱한 토큰을 잡았는가: 잡힌 토큰이 lemma 의 굴절형으로 볼 수 없으면 오채점
      if (eSamples.length < 8) eSamples.push('    ' + lemma.padEnd(14) + ' rating=' + out.rating + ' | ' + sentence.slice(0, 88))
    }
    // 폴백이 고른 토큰 확인 (targets.ts 로직 재현)
    const surface = matchSurface(sentence, lemma, [])?.surface ?? lemma
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '')
    const key = norm(surface)
    const lemmaKey = norm(lemma)
    const exact = res.wordResults.find((w) => norm(w.expected) === key)
    if (!exact) {
      const fb = res.wordResults.find((w) =>
        norm(w.expected).startsWith(lemmaKey.slice(0, Math.max(3, lemmaKey.length - 2))),
      )
      if (fb && matchSurface(fb.expected, lemma, []) === null) {
        wrongToken += 1
        // 잘린 prefix 만으로 붙은 것인가(=lemma 통째로는 안 들어 있다) — 무관한 낱말을 잡을 수 있는 형태
        if (!norm(fb.expected).startsWith(lemmaKey)) truncatedPrefix += 1
        if (eSamples.length < 16)
          eSamples.push('    [오토큰] 타깃 ' + lemma.padEnd(12) + ' → 채점된 토큰 "' + fb.expected + '"  | ' + sentence.slice(0, 70))
      }
    }
  }

  console.log('\n── D  받아쓰기 resolveSetSource (source.ts:330~350) — 타깃이 그 문장에 실제로 있는가 ──')
  console.log('  받아쓰기에 쓰이는 문장   ' + n)
  console.log('  타깃 lemma 가 문장에 없음 ' + targetAbsent + '  ' + pct(targetAbsent, n))
  for (const s of absentSamples) console.log(s)

  console.log('\n── E  받아쓰기 evaluateTargets (targets.ts:78-90) — **완벽 전사**인데도 못 맞춘 것으로 채점 ──')
  console.log('  채점 시뮬레이션 문항     ' + graded)
  console.log('  완벽히 썼는데 hit=false  ' + falseMiss + '  ' + pct(falseMiss, graded))
  console.log('  ↳ rating=2(데이터 불일치) ' + noRating)
  console.log('  prefix 폴백이 다른 낱말을 채점 ' + wrongToken + '  ' + pct(wrongToken, graded))
  console.log('  ↳ lemma 통째가 아니라 **잘린 prefix** 로만 붙은 것 ' + truncatedPrefix)
  for (const s of eSamples) console.log(s)
}

/**
 * F — **반대 방향**: 타깃 낱말만 틀리게 썼는데도 hit=true 로 크레딧을 받는가.
 * 학습자 입력 = 정답 문장에서 타깃 표면형 토큰 하나만 'zzqxv' 로 바꾼 것.
 * 이 경우 화면은 "✓ 단어" 를 띄우고 FSRS 는 3~4(Easy/Good)를 준다 — 못 쓴 낱말인데.
 */
function partF(
  rows: Array<{ word: string; lemma: string | null; source_sentence: string | null; example_en: string | null }>,
): void {
  let n = 0
  let falseCredit = 0
  const samples: string[] = []
  for (const r of rows) {
    const sentence = (r.source_sentence ?? r.example_en ?? '').trim()
    if (!sentence || !isUsableSentence(sentence)) continue
    const lemma = (r.lemma ?? r.word).toLowerCase()
    if (lemma.length < 2) continue
    const m = matchSurface(sentence, lemma, [])
    if (!m) continue // 문장에 없는 타깃은 D 에서 셌다
    n += 1
    // 그 표면형 1회 출현만 오타로 바꾼다
    const typed = sentence.slice(0, m.index) + 'zzqxv' + sentence.slice(m.index + m.length)
    const res = scoreSentence(sentence, typed, 'smart')
    const out = evaluateTargets({
      expected: sentence,
      targetWords: [lemma],
      targetForms: { [lemma]: [] },
      wordResults: res.wordResults,
      hintsUsed: 0,
      maxHintLevel: 0,
      replayCount: 1,
      skipped: false,
    })[0]
    if (out.hit) {
      falseCredit += 1
      if (samples.length < 8)
        samples.push('    ' + lemma.padEnd(14) + ' 표면형 "' + m.surface + '" 를 오타냈는데 ✓  | ' + sentence.slice(0, 70))
    }
  }
  console.log('\n── F  타깃만 오타냈는데 ✓ 로 크레딧(거짓 성공) ──')
  console.log('  시뮬레이션 문항  ' + n)
  console.log('  거짓 크레딧      ' + falseCredit + '  ' + pct(falseCredit, n))
  for (const s of samples) console.log(s)
}

/**
 * G — EchoMatch(`/text/[id]/echo`) · 받아쓰기 텍스트 소스.
 *   lemmas = `vocabularies` WHERE text_id, 문장 = 그 텍스트 본문(v_text_content).
 *   그 텍스트 **어느 문장에서도** matchSurface 가 안 잡히는 단어는
 *   ① EchoMatch 청각 면(F3) 기록을 영영 못 받고 ② 받아쓰기 타깃이 되지 않는다.
 */
async function partG(): Promise<void> {
  const vocab: Array<{ word: string; lemma: string | null; text_id: string | null }> = []
  let cursor = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const page = await retry(async () => {
      const { data, error } = await db
        .from('vocabularies')
        .select('id, word, lemma, text_id')
        .not('text_id', 'is', null)
        .gt('id', cursor)
        .order('id')
        .limit(1000)
      if (error) throw new Error(error.message)
      return (data ?? []) as Array<{ id: string; word: string; lemma: string | null; text_id: string | null }>
    }, 'vocab text page')
    if (page.length === 0) break
    vocab.push(...page)
    cursor = page[page.length - 1].id
  }

  const textIds = [...new Set(vocab.map((v) => v.text_id!).filter(Boolean))]
  const contents = new Map<string, string>()
  for (const id of textIds) {
    const row = await retry(async () => {
      const { data, error } = await db.from('v_text_content').select('id, content').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data as { id: string; content: string | null } | null
    }, 'v_text_content ' + id)
    if (row?.content && row.content.trim().length > 0) contents.set(id, row.content)
    process.stdout.write('\r  text ' + contents.size + '/' + textIds.length + '  ')
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r')

  const forms = await loadForms([])
  const sentCache = new Map<string, string[]>()
  let n = 0
  let neverMatched = 0
  let notInTextAtAll = 0
  const samples: string[] = []
  for (const v of vocab) {
    const content = contents.get(v.text_id!)
    if (!content) continue
    let sents = sentCache.get(v.text_id!)
    if (!sents) {
      sents = splitIntoSentences(content)
      sentCache.set(v.text_id!, sents)
    }
    const lemma = (v.lemma ?? v.word).toLowerCase()
    if (lemma.length < 2) continue
    n += 1
    const f = forms.get(lemma) ?? []
    const hit = sents.some((s) => matchSurface(s, lemma, f) !== null)
    if (!hit) {
      neverMatched += 1
      if (!content.toLowerCase().includes(lemma.slice(0, Math.max(4, lemma.length - 2)))) notInTextAtAll += 1
      else if (samples.length < 8) samples.push('    ' + lemma.padEnd(16) + ' (본문에는 있는데 matchSurface 가 못 잡음)')
    }
  }
  console.log('\n── G  EchoMatch loadSoundLemmas × word-signal.lemmasInSentence (word-signal.ts:94) ──')
  console.log('  본문 있는 텍스트 ' + contents.size + '/' + textIds.length + ' · 그 텍스트의 내 단어 ' + n)
  console.log('  본문 어느 문장에서도 미매칭 ' + neverMatched + '  ' + pct(neverMatched, n))
  console.log('  ↳ 그중 애초에 본문에 없는 단어 ' + notInTextAtAll)
  console.log('  ↳ 본문에 있는데 규칙이 못 잡은 것 ' + (neverMatched - notInTextAtAll) + '  ← 청각 면(F3) 기록 영구 누락')
  for (const s of samples) console.log(s)
}

async function main(): Promise<void> {
  await partA()
  await partB()
  await partG()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
