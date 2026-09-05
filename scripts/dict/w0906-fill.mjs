// scripts/dict/w0906-fill.mjs
//
// **사전 결손 4종을 한 번의 통과로 채운다** — collocations · korean_learner_note ·
// synonyms · ipa.
//
// ── 왜 하나로 묶었나 ──────────────────────────────────────────────────
// 항목마다 따로 드레인을 돌리면 **같은 낱말을 네 번 읽는다.** 에이전트가 받는 입력
// (표제어·품사·뜻·예문)은 넷이 똑같고, 판단의 근거도 같다. 실측 분포가 그걸 뒷받침한다 —
// 결손 낱말 33,634 중 **6,343개는 넷을 전부** 비웠고, 6,589개는 셋을 비웠다.
// 그래서 결손이 많은 낱말부터 처리하면 한 통과가 네 지표를 동시에 올린다.
//
//   결손 4종 6,343 · 3종 6,589 · 2종 10,751 · 1종 9,951
//
// ── 대상 순서 ────────────────────────────────────────────────────────
// ① 결손 개수 많은 순 — 통과당 지표 상승이 가장 크다
// ② 같으면 빈도순(rank 낮은 것 먼저) — 학습자가 실제로 만나는 낱말이 먼저 고쳐진다
//
// 두 자를 겹쳐 쓰는 이유: 지표만 보면 저빈도부터 채워도 숫자는 오르지만, 그러면
// **분모만 채우고 학습자는 아무것도 못 느낀다.** 이 저장소가 한 번 그 함정을 진단했다
// (rank ≤12k 구간은 collocations 99% · note 100% 로 이미 차 있었다).
//
// ── 3단 ──────────────────────────────────────────────────────────────
//   chunk           결손 낱말을 뽑는다 → chunk-NN.json  (이미 찬 항목은 `need` 에서 빠진다)
//   Claude Code     chunk-NN.out.json 을 채운다 (사양: 같은 폴더 _PROMPT.md)
//   apply --commit  게이트 통과분만 적재. **비어 있던 칸만 쓴다 — 덮어쓰기 경로가 없다**
//
// chunk 은 이미 채워진 항목을 `need` 에서 빼므로 **몇 번을 돌려도 결과가 같다.**
// apply 는 게이트를 통과 못 한 항목을 **넣지 않고 건너뛴 수를 출력한다** — 우회 플래그 없음.
// 빈 값이 들어가면 다음 chunk 이 "완료" 로 세어 구멍이 영영 남는다.
//
// 실행:
//   node scripts/dict/w0906-fill.mjs chunk [--dir D] [--size 250] [--limit 21000]
//   node scripts/dict/w0906-fill.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const CMD = process.argv[2]
const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : d
}
const DIR = arg('--dir', 'scripts/dict/w0906-fill')
const SIZE = parseInt(arg('--size', '250'), 10)
const LIMIT = parseInt(arg('--limit', '0'), 10)
const COMMIT = process.argv.includes('--commit')

const FIELDS = ['collocations', 'korean_learner_note', 'synonyms', 'ipa']

const missing = {
  collocations: (r) => !Array.isArray(r.collocations) || r.collocations.length === 0,
  korean_learner_note: (r) => !r.korean_learner_note || r.korean_learner_note.trim().length <= 5,
  synonyms: (r) => !Array.isArray(r.synonyms) || r.synonyms.length === 0,
  ipa: (r) => !r.ipa || !r.ipa.trim(),
}

// ⚠️ 페이지를 1,000행으로 잡으면 16.5초가 걸리고 자주 statement timeout 이 난다(실측
// 2026-09-06: 1000행 16,516ms · 500행 2,790ms · **250행 394ms**). 넓은 select 와
// word 정렬이 겹치면 비용이 선형이 아니다 — 페이지를 작게 두고 횟수로 넘긴다.
/**
 * 물러섰다 다시 — supabase-js 는 실패를 **던지지 않고 `{ error }` 로 돌려준다.**
 * try/catch 만 두면 재시도가 한 번도 안 걸리고 그대로 죽는다(이 저장소에서 두 번 데였다).
 * 여러 세션이 같은 DB 를 쓰므로 statement timeout 은 일상이다.
 */
async function retry(fn, tries = 8) {
  let last
  for (let i = 0; i < tries; i += 1) {
    // PostgREST 빌더는 thenable 이지 Promise 가 아니라 `.catch` 가 없다 — await 로 감싼다
    let r
    try { r = await fn() } catch (e) { r = { error: e } }
    if (!r.error) return r
    last = r
    await new Promise((res) => setTimeout(res, Math.min(20_000, 700 * 2 ** i)))
  }
  return last
}

async function pageAll(select) {
  const out = []
  let cursor = ''
  for (;;) {
    const { data, error } = await retry(() => db
      .from('shared_dictionary')
      // ⚠️ `.eq('archived', false)` 를 서버에 걸면 statement timeout 이 난다(실측 —
      //    그 컬럼에 인덱스가 없어 word 정렬과 겹치면 전수 스캔이 된다).
      //    archived 는 211행뿐이라 여기서 거른다.
      .select(`${select}, archived`)
      .gt('word', cursor)
      .order('word')
      .limit(250))
    if (error) throw new Error(String(error.message ?? error))
    if (!data.length) break
    for (const r of data) if (!r.archived) out.push(r)
    cursor = data[data.length - 1].word
    process.stdout.write(`\r  훑음 ${out.length}`)
  }
  process.stdout.write('\n')
  return out
}

async function doChunk() {
  const rows = await pageAll(
    'word, pos, primary_pos, meaning_ko, example_en, cefr_level, v_level, frequency_rank, collocations, korean_learner_note, synonyms, ipa',
  )
  const targets = []
  for (const r of rows) {
    const need = FIELDS.filter((f) => missing[f](r))
    if (!need.length) continue
    targets.push({
      word: r.word,
      pos: r.primary_pos ?? r.pos ?? null,
      meaning_ko: r.meaning_ko,
      example_en: r.example_en,
      cefr: r.cefr_level,
      v_level: r.v_level,
      rank: r.frequency_rank,
      need,
      _n: need.length,
    })
  }
  // 결손 많은 것 먼저, 같으면 빈도순 (위 「대상 순서」 주석)
  targets.sort((a, b) => b._n - a._n || (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.word.localeCompare(b.word))
  const picked = (LIMIT ? targets.slice(0, LIMIT) : targets).map(({ _n, ...t }) => t)

  fs.mkdirSync(DIR, { recursive: true })
  for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))
  const n = writeChunks(DIR, picked, SIZE)

  const tally = Object.fromEntries(FIELDS.map((f) => [f, picked.filter((t) => t.need.includes(f)).length]))
  console.log(`  결손 낱말 ${targets.length} · 이번 대상 ${picked.length} · 청크 ${n} → ${DIR}/chunk-NN.json`)
  console.log(`  채울 칸 — ${FIELDS.map((f) => `${f} ${tally[f]}`).join(' · ')}`)
}

// ── 게이트 ────────────────────────────────────────────────────────────
// 넣지 않는 쪽이 기본이다. 애매하면 버린다 — 빈 값이나 엉뚱한 값이 들어가면 다음 chunk 이
// "완료" 로 세어 그 낱말은 영영 다시 안 잡힌다.

const ASCII_PHRASE = /^[a-zA-Z][a-zA-Z '’\-]*$/

/** 그 구절이 표제어(굴절형 포함)를 담고 있는가 — 연어의 정의가 그것이다 */
function holdsWord(phrase, word) {
  const p = phrase.toLowerCase()
  const w = word.toLowerCase()
  if (p.includes(w)) return true
  // 굴절형 — 규칙형만 본다(불규칙까지 요구하면 멀쩡한 연어를 버린다)
  const stem = w.length > 4 ? w.slice(0, -1) : w
  return p.includes(stem)
}

function gateCollocations(v, word) {
  if (!Array.isArray(v)) return null
  const out = []
  for (const raw of v) {
    if (typeof raw !== 'string') continue
    const s = raw.trim().replace(/\s+/g, ' ')
    if (!s || !ASCII_PHRASE.test(s)) continue
    const words = s.split(' ')
    if (words.length < 2 || words.length > 5) continue
    if (s.toLowerCase() === word.toLowerCase()) continue
    if (!holdsWord(s, word)) continue
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) continue
    out.push(s)
  }
  return out.length >= 2 ? out.slice(0, 5) : null
}

function gateSynonyms(v, word) {
  if (!Array.isArray(v)) return null
  const out = []
  for (const raw of v) {
    if (typeof raw !== 'string') continue
    const s = raw.trim().replace(/\s+/g, ' ')
    if (!s || !ASCII_PHRASE.test(s)) continue
    if (s.split(' ').length > 3) continue
    if (s.toLowerCase() === word.toLowerCase()) continue
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) continue
    out.push(s)
  }
  return out.length >= 2 ? out.slice(0, 5) : null
}

/**
 * 한국인 학습자 노트 — **뜻을 다시 쓴 것은 반려한다.**
 *
 * 이 칸의 값은 "뜻" 이 아니라 "한국인이 여기서 틀린다" 다. 뜻을 되풀이하면 카드에 같은 말이
 * 두 번 나오고, 채움률만 오른다.
 */
function gateNote(v, meaning) {
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/\s+/g, ' ')
  if (s.length < 12 || s.length > 160) return null
  if (!/[가-힣]/.test(s)) return null
  const m = String(meaning ?? '').replace(/\s+/g, '')
  if (m && s.replace(/\s+/g, '').includes(m) && s.length < m.length + 20) return null
  return s
}

/** IPA — 한글·괄호 없이, 음성기호 문자를 실제로 담고 있어야 한다 */
function gateIpa(v) {
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/^\/+|\/+$/g, '').replace(/^\[|\]$/g, '').trim()
  if (!s || s.length > 40) return null
  if (/[가-힣]/.test(s)) return null
  if (!/[ˈˌəɪʊɛæɑɔʌʃʒθðŋɹɜː]/.test(s)) return null
  if (/[0-9]/.test(s)) return null
  return s
}

async function doApply() {
  const outs = readOuts(DIR)
  if (!outs.length) {
    console.log('  채워진 청크가 없다.')
    return
  }
  const byWord = new Map()
  for (const arr of outs) for (const it of arr ?? []) if (it?.word) byWord.set(String(it.word), it)
  console.log(`  파일 ${outs.length} · 낱말 ${byWord.size}`)

  const rows = await pageAll('word, meaning_ko, collocations, korean_learner_note, synonyms, ipa')
  const cur = new Map(rows.map((r) => [r.word, r]))

  const stat = Object.fromEntries(FIELDS.map((f) => [f, { ok: 0, rejected: 0, already: 0 }]))
  const updates = []
  let unknown = 0
  for (const [word, it] of byWord) {
    const r = cur.get(word)
    if (!r) { unknown += 1; continue }
    const patch = {}
    for (const f of FIELDS) {
      if (!(f in it)) continue
      // **비어 있던 칸만 쓴다** — 덮어쓰기 경로 자체를 두지 않는다
      if (!missing[f](r)) { stat[f].already += 1; continue }
      const v =
        f === 'collocations' ? gateCollocations(it[f], word)
        : f === 'synonyms' ? gateSynonyms(it[f], word)
        : f === 'korean_learner_note' ? gateNote(it[f], r.meaning_ko)
        : gateIpa(it[f])
      if (v == null) { stat[f].rejected += 1; continue }
      patch[f] = v
      stat[f].ok += 1
    }
    if (Object.keys(patch).length) updates.push({ word, patch })
  }

  console.log('')
  for (const f of FIELDS) {
    const s = stat[f]
    console.log(`  ${f.padEnd(20)} 적재 ${String(s.ok).padStart(5)} · 게이트 반려 ${String(s.rejected).padStart(5)} · 이미 있음 ${s.already}`)
  }
  console.log(`  사전에 없는 낱말 ${unknown} · 갱신할 행 ${updates.length}`)

  if (!COMMIT) {
    console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
    return
  }
  let done = 0
  for (let i = 0; i < updates.length; i += 4) {
    await Promise.all(updates.slice(i, i + 4).map(async (u) => {
      const { error } = await db.from('shared_dictionary').update(u.patch).eq('word', u.word)
      if (error) throw new Error(`${u.word}: ${error.message}`)
      done += 1
    }))
    process.stdout.write(`\r  반영 ${done}/${updates.length}`)
  }
  console.log('\n→ 반영 완료')
}

if (CMD === 'chunk') await doChunk()
else if (CMD === 'apply') await doApply()
else console.error('usage: node scripts/dict/w0906-fill.mjs chunk|apply [--dir D] [--size N] [--limit N] [--commit]')
