// scripts/vocab/refresh-published-words.mjs
//
// **게시된 단어장을 사전의 현재 상태로 따라잡힌다** (`shared_words` ← `shared_dictionary`).
//
// ── 왜 필요한가 (실측 2026-09-01) ───────────────────────────────────
// 발행은 사전의 **스냅샷을 뜬다** — `shared_words` 는 뜻·예문·발음·유의어·연어를 자기 컬럼에
// 복사해 갖는다(`lib/vcb/compose/publish.ts` `toSharedWords`). 그래서 나중에 사전이 좋아져도
// **이미 게시된 권은 그대로 남는다.** 학습자는 낡은 복사본을 본다.
//
// 실측 — 게시된 낱말 27,075행 중 사전에는 있는데 복사본이 빈 칸:
//   유의어 1,641 · 연어 1,161 · 반의어 466 · 학습자 노트 354
//
// LLM 이 필요 없다. **이미 있는 것을 옮겨 담기만** 하면 된다 — 발음기호 15,136칸을
// 같은 이유로 옮겼던 것과 같은 구조다(그 스크립트를 이 파일이 대체한다).
//
// ── ⚠️ 어느 칸이 학습자에게 닿는가 (실측 2026-09-01 · grep 전수) ─────
// 위 네 필드를 다 채우고 나서 내용 우위지수를 다시 쟀더니 **1.586 그대로**였다.
// 이유를 찾아보니 채운 것의 **90%가 읽는 화면이 없었다.**
//
//   | 칸 | 닿는 경로 |
//   |---|---|
//   | `pronunciation` · `example_en` · `meaning_ko` · `part_of_speech` · `cefr_level` | 구독·게임이 `vocabularies` 로 **복사**한다(`library/vocab/actions.ts` · `game/record-result.ts`) |
//   | `korean_learner_note` | 미리보기 모달이 읽는다(평면 세트에서는 노트, 목차 세트에서는 챕터 제목) |
//   | `synonyms` · `antonyms` · `collocations` | **아무도 안 읽는다.** `vocabularies` 에 그 컬럼이 없고, 학습자는 이 셋을 `shared_dictionary` 에서 **런타임에** 받는다(`flashcard/dict-extras.ts` · `library/reader-queries.ts`) |
//
// 그래서 기본값은 **닿는 칸만** 채운다. 셋을 마저 채우려면 `--all-fields` —
// 스냅샷을 완전하게 만드는 값은 있지만, 느린 쓰기 3,000여 건을 공유 DB 에 더하는 값이다.
// **"DB 에 있다" 는 "학습자가 본다" 가 아니다** — 이 저장소가 네 번째로 같은 자리에서 값을 치렀다.
//
// ── 절대 덮지 않는 것 ───────────────────────────────────────────────
// · **빈 칸만 채운다.** 이미 값이 있으면 손대지 않는다 — 발행 당시 컴포저가 고른 값이
//   더 맞을 수 있고(예문은 그 책의 코퍼스 문장이 사전 예문보다 낫다), 덮으면 되돌릴 수 없다.
// · **`korean_learner_note` 는 목차가 있는 세트에서 건드리지 않는다.** 그 세트에서 이 컬럼은
//   사전 노트가 아니라 **챕터 제목**이다(`toSharedWords`: `grouped ? e.group_label : ...`).
//   모르고 채우면 목차 라벨 자리에 사전 노트가 섞여 목차가 깨진다.
//   (실측: 목차 있는 26,575행의 노트 격차는 **0** 이고, 격차 354는 전부 평면 세트다.)
// · 빈 배열·빈 문자열은 넣지 않는다 — 다음 실행이 "채워졌다" 로 세어 구멍이 영영 남는다.
//
// ── 안전 ────────────────────────────────────────────────────────────
// · 기본은 드라이런. 실제로 쓰려면 `--commit`.
// · **재실행 안전** — 두 번째 실행은 "채울 것 0" 을 낸다.
//
// 실행: node scripts/vocab/refresh-published-words.mjs [--commit] [--all-fields] [--set <uuid>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const COMMIT = process.argv.includes('--commit')
/** 읽는 화면이 없는 칸(유의어·반의어·연어)까지 채운다 — 머리 주석의 표 참조. */
const ALL_FIELDS = process.argv.includes('--all-fields')
const ONLY_SET = (() => {
  const i = process.argv.indexOf('--set')
  return i >= 0 ? process.argv[i + 1] : null
})()

/** 학습자의 공용 서가에 뜨지 않는 칸 — `lib/library/vocab/queries.ts` 와 같아야 한다. */
const HIDDEN = ['library_book', 'library_article']
/**
 * 사전 조회 묶음.
 *
 * ⚠️ 300 으로 두었더니 **쓰기가 도는 중에** `canceling statement due to statement timeout`
 *   이 났다(드라이런은 통과했다 — 읽기만 할 때는 안 걸린다). 이 저장소가 이미 같은 자리에서
 *   값을 치렀다("몇 천 행짜리 조회는 언젠가 끊긴다 — 읽기 재시도"). 작게 자르고 재시도한다.
 */
const DICT_CHUNK = 120
/**
 * 한 번에 **동시에** 보내는 UPDATE 수.
 *
 * ⚠️ 200 으로 두었더니 이번엔 **쓰기가** `statement timeout` 으로 끊겼다(읽기를 고친 뒤에도).
 *   값이 낱말마다 달라 한 문장으로 못 묶으니 행마다 UPDATE 인데, 200개를 동시에 던지면
 *   커넥션이 고갈된다. 낮추고 **쓰기에도 재시도**를 건다 — 부분 적용은 재실행으로 메워지지만
 *   중간에 죽으면 사람이 다시 와야 한다.
 */
const WRITE_CHUNK = 40
/** 끊긴 조회를 몇 번까지 다시 물어볼 것인가. */
const READ_RETRIES = 4

/** 끊기면 잠깐 쉬고 다시 묻는다 — 지수 백오프. 마지막 시도까지 실패하면 그대로 던진다. */
async function withRetry(label, fn) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fn()
    if (!res.error) return res
    if (attempt >= READ_RETRIES) throw new Error(`${label}: ${res.error.message}`)
    const waitMs = 400 * 2 ** attempt
    console.warn(`  ! ${label} 끊김 — ${waitMs}ms 뒤 재시도 (${attempt + 1}/${READ_RETRIES})`)
    await new Promise((r) => setTimeout(r, waitMs))
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/** 배열 칸이 비었는가 — `null` 도 `[]` 도 빈 것이다. */
const emptyArr = (v) => !Array.isArray(v) || v.length === 0
/** 사전 쪽 배열이 쓸 만한가. */
const usableArr = (v) => Array.isArray(v) && v.length > 0

let q = supabase
  .from('shared_word_sets')
  .select('id, title')
  .eq('is_published', true)
  .not('category', 'in', `(${HIDDEN.join(',')})`)
if (ONLY_SET) q = q.eq('id', ONLY_SET)
// ⚠️ 이 첫 조회마저 끊긴 적이 있다(2026-09-01). 원인은 이 스크립트가 아니라 **다른 세션**이
//    `csat_dcp_items`(14만 행)를 훑고 있었던 것이다 — 워크스페이스가 DB 를 공유한다.
//    그래서 모든 조회에 재시도를 건다. 부분 적용은 재실행으로 메워지지만, 중간에 죽으면
//    사람이 다시 와야 한다.
const { data: sets } = await withRetry('shared_word_sets', () => q)

async function dictFor(words) {
  const map = new Map()
  const cols = 'word, ipa, ipa_us, synonyms, antonyms, collocations, korean_learner_note, example_en'
  for (let i = 0; i < words.length; i += DICT_CHUNK) {
    const { data } = await withRetry('shared_dictionary', () =>
      supabase.from('shared_dictionary').select(cols).in('word', words.slice(i, i + DICT_CHUNK)),
    )
    for (const d of data) map.set(d.word.toLowerCase(), d)
  }
  return map
}

const totals = { pronunciation: 0, synonyms: 0, antonyms: 0, collocations: 0, korean_learner_note: 0, example_en: 0 }
let written = 0
let scanned = 0

for (const s of sets) {
  // 이 세트가 목차를 갖는가 — 노트 컬럼의 의미가 여기서 갈린다.
  const { count: chCount, error: chErr } = await supabase
    .from('shared_words')
    .select('id', { count: 'exact', head: true })
    .eq('set_id', s.id)
    .not('chapter', 'is', null)
  if (chErr) throw new Error(`chapter count(${s.id}): ${chErr.message}`)
  const grouped = (chCount ?? 0) > 0

  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data } = await withRetry(`shared_words(${s.id})`, () =>
      supabase
        .from('shared_words')
        .select('id, word, pronunciation, synonyms, antonyms, collocations, korean_learner_note, example_en')
        .eq('set_id', s.id)
        .order('id')
        .range(from, from + PAGE - 1),
    )
    rows.push(...data)
    if (data.length < PAGE) break
  }
  if (rows.length === 0) continue
  scanned += rows.length

  const dict = await dictFor([...new Set(rows.map((r) => r.word))])

  const patches = []
  for (const r of rows) {
    const d = dict.get(r.word.toLowerCase())
    if (!d) continue
    const patch = {}

    const ipa = d.ipa || d.ipa_us
    if (!r.pronunciation && ipa) patch.pronunciation = ipa
    if (!r.example_en && d.example_en) patch.example_en = d.example_en
    // 읽는 화면이 없는 셋 — 머리 주석의 표 참조. 기본값에서 뺀다.
    if (ALL_FIELDS) {
      if (emptyArr(r.synonyms) && usableArr(d.synonyms)) patch.synonyms = d.synonyms
      if (emptyArr(r.antonyms) && usableArr(d.antonyms)) patch.antonyms = d.antonyms
      if (emptyArr(r.collocations) && usableArr(d.collocations)) patch.collocations = d.collocations
    }
    // ⚠️ 목차가 있는 세트에서 이 컬럼은 **챕터 제목**이다. 건드리지 않는다.
    if (!grouped && !r.korean_learner_note && d.korean_learner_note) {
      patch.korean_learner_note = d.korean_learner_note
    }

    if (Object.keys(patch).length === 0) continue
    for (const k of Object.keys(patch)) totals[k] += 1
    patches.push({ id: r.id, patch })
  }

  if (patches.length > 0) {
    console.info(
      `  ${s.title.slice(0, 30).padEnd(32)} ${String(rows.length).padStart(5)}행 중`
      + ` ${String(patches.length).padStart(5)}행 보강${grouped ? '' : ' (평면 — 노트 포함)'}`,
    )
  }
  if (!COMMIT) continue

  for (let i = 0; i < patches.length; i += WRITE_CHUNK) {
    const batch = patches.slice(i, i + WRITE_CHUNK)
    await Promise.all(
      batch.map((p) =>
        withRetry('shared_words update', () =>
          supabase.from('shared_words').update(p.patch).eq('id', p.id),
        ),
      ),
    )
    written += batch.length
  }
}

console.info('')
console.info(`세트 ${sets.length} · 훑은 낱말 ${scanned.toLocaleString()}`)
for (const [k, v] of Object.entries(totals)) {
  if (v > 0) console.info(`  ${k.padEnd(20)} ${v.toLocaleString()}`)
}
console.info(COMMIT ? `  기록한 행 ${written.toLocaleString()}` : '  드라이런 — --commit 으로 실제 기록')
