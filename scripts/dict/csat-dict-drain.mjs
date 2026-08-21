// scripts/dict/csat-dict-drain.mjs
//
// **수능 기출 13개년 원문에 나왔는데 사전에 없는 낱말을 Claude Code 가 채우는 드레인.**
//
// 입력은 `csat-corpus-diff.mjs` 가 남긴 `diff.json` 의 `사전_결손_목록`.
// `drain-article-lemmas.mjs` 와 같은 형식·같은 규칙을 쓴다(청크 in/out · 개수 일치 검증).
//
// ── 왜 해소기를 한 번 더 통과시키나 ─────────────────────────────────
// 결손 목록은 "shared_dictionary 에 표제어가 없다" 까지만 본다. 그런데 학습자 경로는
// `resolve_dict_headword` 로 굴절·철자 변이를 푼다 — 그걸 안 거치면 이미 풀리는 낱말을
// 중복 등재해 사전 품질을 되레 깎는다. `unresolved_dict_words` RPC 가 그 게이트다.
//
// ── 빈도 반영까지가 한 세트 ─────────────────────────────────────────
// `lexicon_frequencies.lemma` 는 `shared_dictionary(word)` FK 라, 표제어가 생기기 전에는
// 기출 빈도를 넣을 수 없다. 그래서 넣은 뒤 `csat-corpus-apply.mjs --commit` 을 다시 돌려야
// 새 낱말이 `kice_csat` 빈도와 `kice-csat-*` 태그를 받는다.
//
// 재실행 안전: 내보내기는 읽기만 한다. 들여오기는 이미 있는 낱말을 건너뛴다.
//
// 실행:
//   pnpm dlx tsx scripts/dict/csat-dict-drain.mjs --export
//   … Claude Code 가 chunk-NN.json → chunk-NN.out.json …
//   pnpm dlx tsx scripts/dict/csat-dict-drain.mjs --import            # 검증만
//   pnpm dlx tsx scripts/dict/csat-dict-drain.mjs --import --commit   # 넣는다

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const OUT_DIR = path.resolve(arg('dir') ?? 'scripts/dict/csat-dict-gap')
const SRC_DIR = arg('src') ?? 'C:/Users/Administrator/Documents/수능영어기출/최종'
const CHUNK_SIZE = Number(arg('chunk') ?? 60)
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const POS = [
  'noun', 'adjective', 'verb', 'adverb', 'idiom', 'phrasal_verb', 'abbreviation',
  'interjection', 'preposition', 'determiner', 'pronoun', 'conjunction',
  'prefix', 'auxiliary', 'number', 'other',
]

/** 원문에서 그 낱말이 실제로 쓰인 문장 하나. 다의어의 어느 뜻인지는 문맥 없이 못 정한다. */
function sampleSentences(words) {
  const wanted = new Set(words)
  const found = new Map()
  const files = fs.readdirSync(SRC_DIR).filter((x) => /^\d{4}(_A)?\.txt$/.test(x)).sort()
  for (const f of files) {
    const text = fs.readFileSync(path.join(SRC_DIR, f), 'utf8').replace(/[\r\n]+/g, ' ')
    for (const sent of text.split(/(?<=[.!?])\s+/)) {
      const clean = sent.replace(/\s+/g, ' ').trim()
      if (clean.length < 20) continue
      const lower = clean.toLowerCase()
      for (const w of wanted) {
        if (found.has(w)) continue
        const esc = w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
        // 굴절형까지 허용한다 — 원문에 원형이 없을 수 있다.
        if (new RegExp('\\b' + esc + '(s|es|ed|ing|d)?\\b').test(lower)) {
          found.set(w, clean.slice(0, 200))
        }
      }
    }
  }
  return found
}

async function doExport() {
  const diff = JSON.parse(fs.readFileSync('scripts/dict/csat-corpus/diff.json', 'utf8'))
  const gaps = diff['사전_결손_목록']
  console.log(`결손 후보 ${gaps.length}`)

  // 해소기 게이트 — 이미 풀리는 낱말은 넣지 않는다.
  const unresolved = []
  for (let i = 0; i < gaps.length; i += 400) {
    const { data, error } = await db.rpc('unresolved_dict_words', {
      p_words: gaps.slice(i, i + 400).map((g) => g.lemma),
    })
    if (error) throw new Error('해소기 조회 실패: ' + error.message)
    for (const r of data ?? []) unresolved.push(typeof r === 'string' ? r : r.word)
  }
  const keep = new Set(unresolved)
  const missing = gaps.filter((g) => keep.has(g.lemma))
  console.log(`해소기가 푼 것 ${gaps.length - missing.length} (굴절·철자 변이)`)
  console.log(`진짜 빠진 낱말 ${missing.length}`)
  if (!missing.length) return console.log('채울 것이 없다.')

  const samples = sampleSentences(missing.map((m) => m.lemma))
  console.log(`문맥 문장 확보 ${samples.size}/${missing.length}`)

  missing.sort((a, b) => b.years_n - a.years_n || b.total - a.total || a.lemma.localeCompare(b.lemma))

  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^chunk-\d+\.(out\.)?json$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f))
  }
  let n = 0
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const rows = missing.slice(i, i + CHUNK_SIZE).map((g) => ({
      word: g.lemma,
      seen_in: samples.get(g.lemma) ?? null,
      csat_years: g.years_appeared,
      csat_freq: g.total,
    }))
    const file = path.join(OUT_DIR, `chunk-${String(n).padStart(2, '0')}.json`)
    fs.writeFileSync(file, JSON.stringify(rows, null, 1) + '\n')
    n++
  }
  fs.writeFileSync(path.join(OUT_DIR, '_PROMPT.md'), PROMPT)
  console.log(`청크 ${n}개 → ${path.relative(process.cwd(), OUT_DIR)}`)
}

const PROMPT = [
  '# 수능 기출 결손 낱말 사전 드레인 — Claude Code 작업 지시',
  '',
  '`chunk-NN.json` 을 읽고 **같은 폴더에** `chunk-NN.out.json` 을 쓴다.',
  '',
  '## 입력 한 줄',
  '```json',
  '{ "word": "upcycling", "seen_in": "…원문 문장…", "csat_years": [2021, 2024], "csat_freq": 3 }',
  '```',
  '',
  '## 출력 한 줄 (입력과 **같은 개수·같은 순서**)',
  '```json',
  '{ "word": "upcycling", "meaning_ko": "업사이클링(폐품을 더 가치 있는 물건으로 재탄생시키기)",',
  '  "pos": "noun", "cefr_level": "C1",',
  '  "example_en": "Upcycling turns discarded bottles into furniture." }',
  '```',
  '',
  '## 규칙',
  '- `meaning_ko` — 한국 고등학생·수능 응시자 기준 뜻. **`seen_in` 문맥의 뜻을 먼저**, 다른 흔한 뜻은 쉼표로.',
  '- `pos` — ' + POS.join(' · ') + ' 중 하나(소문자). 새 값을 만들지 않는다.',
  '- `cefr_level` — A1·A2·B1·B2·C1·C2 중 하나. **그 낱말 자체의 난이도**이지 지문 난이도가 아니다.',
  '- `example_en` — 짧고 자연스러운 한 문장. **`seen_in` 을 그대로 옮기지 않는다**(기출 원문 복제 금지).',
  '- 고유명사(인명·지명·상표)·약어 파편·오탈자·영어가 아닌 것은 그 줄을 **빼지 말고** `"skip": true` 를 붙인다.',
  '  빼면 개수가 어긋나 들여오기가 통째로 거부한다.',
  '- `csat_years` 가 길수록 반복 출제어다 — 뜻을 더 신중히 고른다.',
  '',
  '## 되돌리기',
  "`delete from shared_dictionary where classified_by='claude_code_opus_5' and source='ai-generated' and created_at > '…'`",
  '',
].join('\n')

async function doImport() {
  const chunks = fs.readdirSync(OUT_DIR).filter((f) => /^chunk-\d+\.json$/.test(f)).sort()
  if (!chunks.length) { console.error('청크가 없다. 먼저 --export.'); process.exit(2) }

  const rows = []
  const problems = []
  let pending = 0
  let skipped = 0

  for (const c of chunks) {
    const outFile = path.join(OUT_DIR, c.replace(/\.json$/, '.out.json'))
    if (!fs.existsSync(outFile)) { pending++; continue }
    const input = JSON.parse(fs.readFileSync(path.join(OUT_DIR, c), 'utf8'))
    let output
    try { output = JSON.parse(fs.readFileSync(outFile, 'utf8')) }
    catch (e) { problems.push(`${c}: 출력이 JSON 이 아니다 — ${e.message}`); continue }
    if (!Array.isArray(output) || output.length !== input.length) {
      problems.push(`${c}: 개수 불일치 (입력 ${input.length} · 출력 ${output?.length ?? '배열 아님'})`)
      continue
    }
    for (let i = 0; i < output.length; i++) {
      const o = output[i]
      const want = input[i].word
      if (o?.skip === true) { skipped++; continue }
      if (!o || String(o.word ?? '').toLowerCase() !== want) {
        problems.push(`${c}[${i}]: 낱말이 어긋난다 (기대 "${want}" · 실제 "${o?.word}")`); continue
      }
      if (!o.meaning_ko || !String(o.meaning_ko).trim()) {
        problems.push(`${c}[${i}] ${want}: meaning_ko 가 비었다`); continue
      }
      if (o.cefr_level && !CEFR.includes(o.cefr_level)) {
        problems.push(`${c}[${i}] ${want}: cefr_level "${o.cefr_level}" 은 제약 밖`); continue
      }
      if (o.pos && !POS.includes(String(o.pos).toLowerCase())) {
        problems.push(`${c}[${i}] ${want}: pos "${o.pos}" 는 목록 밖`); continue
      }
      rows.push({
        word: want,
        meaning_ko: String(o.meaning_ko).trim(),
        cefr_level: o.cefr_level ?? null,
        pos: o.pos ? String(o.pos).toLowerCase() : 'other',
        example_en: o.example_en ? String(o.example_en).trim() : null,
        // RPC 가 쓰는 'lcp_llm' 은 제약이 막는다 — 허용값을 쓰고 출처는 classified_by 로 남긴다.
        source: 'ai-generated',
        classified_by: 'claude_code_opus_5',
        verified: false,
        list_tags: ['kice-csat-13y'],
      })
    }
  }

  console.log(`청크 ${chunks.length} · 채워진 것 ${chunks.length - pending} · 남은 것 ${pending}`)
  console.log(`건너뜀(skip) ${skipped} · 넣을 수 있는 낱말 ${rows.length}`)
  if (problems.length) {
    console.log(`\n문제 ${problems.length}건:`)
    for (const p of problems.slice(0, 20)) console.log('  ' + p)
    if (problems.length > 20) console.log(`  … 외 ${problems.length - 20}건`)
  }
  if (!commit) return console.log('\n검증만 했다. 넣으려면 --commit')
  if (!rows.length) return console.log('넣을 것이 없다.')

  // 이미 있는 낱말은 건너뛴다 — 다른 출처가 채운 것을 덮지 않는다.
  const words = rows.map((r) => r.word)
  const have = new Set()
  for (let i = 0; i < words.length; i += 400) {
    const { data, error } = await db.from('shared_dictionary').select('word').in('word', words.slice(i, i + 400))
    if (error) throw new Error('중복 확인 실패: ' + error.message)
    for (const r of data ?? []) have.add(r.word)
  }
  const fresh = rows.filter((r) => !have.has(r.word))
  console.log(`이미 있음 ${rows.length - fresh.length} · 새로 넣을 것 ${fresh.length}`)

  let done = 0
  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100)
    const { error } = await db.from('shared_dictionary').insert(chunk)
    if (error) throw new Error(`적재 실패(${i}): ${error.message}`)
    done += chunk.length
    process.stdout.write(`\r적재 ${done}/${fresh.length}`)
  }
  console.log(`\n완료. 이제 \`csat-corpus-apply.mjs --commit\` 을 다시 돌려 기출 빈도·태그를 붙인다.`)
}

if (process.argv.includes('--import')) await doImport()
else await doExport()
