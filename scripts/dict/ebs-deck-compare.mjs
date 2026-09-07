// scripts/dict/ebs-deck-compare.mjs
//
// **EBS 보카 덱(.apkg)을 기출 실측 근거와 대조한다 — 읽기 전용.**
//
// 묻는 것: 이 덱을 다 외우면 수능 지문 어휘를 얼마나 덮는가. 그리고 덱에 있는데
// 13개년 기출에 한 번도 안 나온 낱말은 몇 개인가.
//
// ⚠️ 파일명이 `_ebs_voca_1800` 이지만 **실제 카드는 1,306장**이다(실측). 이름을 근거로 쓰지 않는다.
//
// 커버리지를 셀 때 **덱 낱말은 표제어 그대로 비교하지 않는다** — 덱은 `vegetated`·`specify` 처럼
// 굴절·파생형을 섞어 담고, 기출 코퍼스는 원형으로 접혀 있다. `shared_dictionary.inflected_forms`
// 로 한 번 풀어서 맞춘다. 안 그러면 덮고 있는 것을 안 덮는다고 세게 된다.
//
// 실행: pnpm dlx tsx scripts/dict/ebs-deck-compare.mjs [--apkg <경로>]

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const APKG = arg('apkg') ?? 'C:/Users/Administrator/Documents/수능영어기출/최종/_ebs_voca_1800.apkg'
const TMP = fs.mkdtempSync(path.join(process.env.TEMP ?? '.', 'ebsdeck-'))

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** .apkg 는 zip 이다. 의존성을 늘리지 않으려고 중앙 디렉터리를 직접 읽는다. */
function unzipTo(file, dir) {
  const b = fs.readFileSync(file)
  let i = b.length - 22
  while (b.readUInt32LE(i) !== 0x06054b50) i--
  const n = b.readUInt16LE(i + 10)
  let off = b.readUInt32LE(i + 16)
  const out = []
  for (let k = 0; k < n; k++) {
    const nl = b.readUInt16LE(off + 28)
    const el = b.readUInt16LE(off + 30)
    const cl = b.readUInt16LE(off + 32)
    const name = b.toString('utf8', off + 46, off + 46 + nl)
    const method = b.readUInt16LE(off + 10)
    const comp = b.readUInt32LE(off + 20)
    const lho = b.readUInt32LE(off + 42)
    const lnl = b.readUInt16LE(lho + 26)
    const lel = b.readUInt16LE(lho + 28)
    const raw = b.subarray(lho + 30 + lnl + lel, lho + 30 + lnl + lel + comp)
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw
    const target = path.join(dir, name.replace(/[^\w.]/g, '_'))
    fs.writeFileSync(target, data)
    out.push(target)
    off += 46 + nl + el + cl
  }
  return out
}

const files = unzipTo(APKG, TMP)
const colFile = files.find((f) => f.endsWith('collection.anki21')) ?? files.find((f) => f.endsWith('collection.anki2'))
if (!colFile) throw new Error('.apkg 안에 collection 이 없다')

const anki = new DatabaseSync(colFile, { readOnly: true })
const notes = anki.prepare('select flds from notes').all()

/** 카드 앞면에서 표제어만 남긴다 — 덱이 색상 span·div 로 감싸 두었다. */
function headword(fld) {
  const front = String(fld).split('\u001f')[0] ?? ''
  const text = front
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
    .toLowerCase()
  // 괄호 주석·품사 표시·여러 어형 병기를 떼고 첫 표제어만
  const first = text.split(/[,/(]/)[0].trim()
  return /^[a-z][a-z'\- ]*$/.test(first) ? first : null
}

const deck = [...new Set(notes.map((n) => headword(n.flds)).filter(Boolean))]
const multiword = deck.filter((w) => w.includes(' '))
const single = deck.filter((w) => !w.includes(' '))

// ── 사전 대조 ───────────────────────────────────────────────────────
async function fetchIn(col, values, select) {
  const out = []
  for (let i = 0; i < values.length; i += 400) {
    const { data, error } = await db.from('shared_dictionary').select(select).in(col, values.slice(i, i + 400))
    if (error) throw new Error('사전 조회 실패: ' + error.message)
    out.push(...data)
  }
  return out
}
const dictRows = await fetchIn('word', single, 'word')
const inDict = new Set(dictRows.map((r) => r.word))

// 덱의 굴절·파생형을 표제어로 푼다 (vegetated → vegetate 등)
const notHead = single.filter((w) => !inDict.has(w))
const resolved = new Map()
for (let i = 0; i < notHead.length; i += 150) {
  const slice = notHead.slice(i, i + 150)
  const sliceSet = new Set(slice)
  const { data, error } = await db.from('shared_dictionary').select('word, inflected_forms').overlaps('inflected_forms', slice)
  if (error) throw new Error('굴절형 조회 실패: ' + error.message)
  for (const row of data) {
    for (const inf of row.inflected_forms ?? []) if (sliceSet.has(inf) && !resolved.has(inf)) resolved.set(inf, row.word)
  }
}

// ── 기출 근거 대조 ──────────────────────────────────────────────────
const freq = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('lexicon_frequencies')
    .select('lemma, raw_count, metadata')
    .eq('source_id', 1)
    .range(from, from + 999)
  if (error) throw new Error('빈도 조회 실패: ' + error.message)
  freq.push(...data)
  if (data.length < 1000) break
}
const corpus = new Map(freq.filter((f) => f.metadata?.evidence === 'corpus_v1').map((f) => [f.lemma, f]))

/** 덱 낱말이 기출에 나왔는가 — 표제어로든, 굴절형을 푼 원형으로든. */
const deckLemma = (w) => (corpus.has(w) ? w : resolved.get(w) && corpus.has(resolved.get(w)) ? resolved.get(w) : null)
const covered = single.map((w) => ({ w, lemma: deckLemma(w) }))
const hit = covered.filter((c) => c.lemma)
const miss = covered.filter((c) => !c.lemma)

// ── 반대 방향 — 기출 핵심어 중 덱이 안 담은 것 ──────────────────────
// ⚠️ 그냥 세면 time·people·good 이 "덱이 놓친 핵심어" 로 잡힌다(첫 실행 실측).
//   수능 대비 덱은 그런 낱말을 **일부러 안 담는다** — 이미 아는 것으로 전제한다.
//   그대로 보고하면 덱을 부당하게 깎는 숫자가 된다. **학습 대상 낱말로 좁혀서** 잰다:
//   NGSL(일반 서비스 어휘) 태그가 붙지 않았고 CEFR B1 이상인 것.
const deckAll = new Set([...single, ...[...resolved.values()]])
const core4All = [...corpus.values()].filter((f) => f.raw_count >= 4)
const meta = new Map()
for (let i = 0; i < core4All.length; i += 400) {
  const slice = core4All.slice(i, i + 400).map((f) => f.lemma)
  const { data, error } = await db.from('shared_dictionary').select('word, cefr_level, list_tags').in('word', slice)
  if (error) throw new Error('난이도 조회 실패: ' + error.message)
  for (const r of data) meta.set(r.word, r)
}
const BASIC_TAGS = ['ngsl_gr_1.0', 'ngsl_1.2', 'ngsl_spoken_1.2']
const isTarget = (lemma) => {
  const m = meta.get(lemma)
  if (!m) return true
  if ((m.list_tags ?? []).some((t) => BASIC_TAGS.includes(t))) return false
  return ['B1', 'B2', 'C1', 'C2'].includes(m.cefr_level ?? '')
}
const core4 = core4All.filter((f) => isTarget(f.lemma))
const coreMissing = core4
  .filter((f) => !deckAll.has(f.lemma))
  .sort((a, b) => b.raw_count - a.raw_count || (b.metadata?.token_count ?? 0) - (a.metadata?.token_count ?? 0))
const report = {
  덱: { 카드: notes.length, 고유표제어: deck.length, 단일어: single.length, 다어절: multiword.length },
  사전: { 표제어로_존재: inDict.size, 굴절형으로_해소: resolved.size, 사전에_없음: single.length - inDict.size - resolved.size },
  기출_대조: {
    기출에_등장: hit.length,
    기출에_없음: miss.length,
    커버리지: `${((100 * hit.length) / single.length).toFixed(1)}%`,
  },
  역방향: {
    기출_4개년이상_전체: core4All.length,
    그중_학습대상: core4.length,
    제외_기초어: core4All.length - core4.length,
    기출_4개년이상_핵심어: core4.length,
    덱이_담은_것: core4.length - coreMissing.length,
    덱이_놓친_것: coreMissing.length,
    핵심어_커버리지: `${((100 * (core4.length - coreMissing.length)) / core4.length).toFixed(1)}%`,
  },
}

fs.mkdirSync('scripts/dict/csat-corpus', { recursive: true })
fs.writeFileSync(
  'scripts/dict/csat-corpus/ebs-deck.json',
  JSON.stringify(
    {
      report,
      덱_단일어: single,
      기출에_없는_덱낱말: miss.map((m) => m.w),
      덱이_놓친_핵심어: coreMissing.map((f) => ({
        lemma: f.lemma,
        years: f.raw_count,
        tokens: f.metadata?.token_count ?? null,
      })),
    },
    null,
    1,
  ),
)

console.log(JSON.stringify(report, null, 1))
console.log('')
console.log('덱이 놓친 기출 핵심어(4개년 이상) 상위 30:')
console.log(coreMissing.slice(0, 30).map((f) => `${f.lemma}(${f.raw_count}y)`).join(', '))
console.log('')
console.log('→ scripts/dict/csat-corpus/ebs-deck.json')

// ── 태깅 (--tag --commit) ───────────────────────────────────────────
// 덱 **수록 여부**만 사전에 남긴다(뜻·예문 등 덱 내용은 복사하지 않는다).
// 출처가 불명확한 제3자 배포본이므로 그 사실을 `frequency_data_sources.citation` 에 적는다 —
// `csat-prep-*` 가 근거 없이 남아 오해를 부른 전례가 있다(2026-08-21 실측 37%/39% 무근거).
const TAG = 'ebs-voca-1306'
if (process.argv.includes('--tag')) {
  const commit = process.argv.includes('--commit')
  // 굴절형으로 들어온 카드는 **표제어로 바꿔** 태그한다 — 굴절형을 표제어로 만들지 않는다.
  const targets = [...new Set(single.map((w) => (inDict.has(w) ? w : (resolved.get(w) ?? null))).filter(Boolean))]
  console.log(`태그 대상 ${targets.length} (사전 표제어 ${inDict.size} + 굴절형 해소 ${resolved.size})`)
  if (!commit) {
    console.log('dry-run — 쓰지 않았다. 반영하려면 --tag --commit')
  } else {
    const { error: srcErr } = await db.from('frequency_data_sources').upsert(
      {
        source_key: TAG,
        citation:
          'EBS 보카 Anki 덱 (제3자 배포본 · 원출처 미확인 · 파일명은 1800 이나 실제 1,306장). ' +
          '2026-08-21 기출 13개년 원문 대조: 덱→기출 커버리지 57.5%(749/1,303) · ' +
          '기출 4개년+ 학습대상 192개 중 30.2%(58)만 수록',
        license: 'unverified — 재배포 금지, 수록 여부만 참조',
      },
      { onConflict: 'source_key' },
    )
    if (srcErr) throw new Error('출처 기록 실패: ' + srcErr.message)

    let tagged = 0
    for (let i = 0; i < targets.length; i += 200) {
      const slice = targets.slice(i, i + 200)
      const { data, error } = await db.from('shared_dictionary').select('word, list_tags').in('word', slice)
      if (error) throw new Error('태그 조회 실패: ' + error.message)
      const need = data.filter((r) => !(r.list_tags ?? []).includes(TAG))
      for (const r of need) {
        const { error: uErr } = await db
          .from('shared_dictionary')
          .update({ list_tags: [...(r.list_tags ?? []), TAG], updated_at: new Date().toISOString() })
          .eq('word', r.word)
        if (uErr) throw new Error(`${r.word} 태그 실패: ` + uErr.message)
        tagged += 1
      }
      process.stdout.write(`태그 ${Math.min(i + 200, targets.length)}/${targets.length}`)
    }
    console.log(`
새로 붙인 태그 ${tagged} · 이미 있던 것 ${targets.length - tagged}`)
  }
}

anki.close()
try { fs.rmSync(TMP, { recursive: true, force: true }) } catch { /* 임시 폴더는 남아도 무해 */ }
