// scripts/audit/dict-render-path.mts
//
// READ-ONLY 측정 — shared_dictionary 컬럼이 학습자 화면까지 닿는지.
//   ① 컬럼별 채움률 (전체 / 학습자 도달 가능 부분집합)
//   ② 릴레이(shared_words) 에서 writer/reader 컬럼 불일치
//   ③ 렌더되는 컬럼이 화면까지 살아남는가 (정제·조건·키 모양)
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/dict-render-path.mts

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ENV_PATH = 'apps/web/.env.local'

// 이 머신은 ALPN 이 붙은 ClientHello 를 드롭한다 — Node 의 fetch/https 는 못 붙고 curl 은 붙는다
// (memory: reference-node-tls-alpn-blocked). 측정만 하려는 것이므로 curl 로 우회한다.
const TMP = mkdtempSync(join(tmpdir(), 'dict-audit-'))
let seq = 0

const curlFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as Request).url ?? String(input)
  const method = (init?.method ?? 'GET').toUpperCase()
  const hdrFile = join(TMP, `h${seq}`)
  const bodyFile = join(TMP, `b${seq}`)
  const inFile = join(TMP, `i${seq}`)
  seq += 1
  // ⚠️ `-X HEAD` 를 쓰면 curl 이 오지 않을 본문을 기다리며 멈춘다 — HEAD 는 `--head` 로.
  const verb = method === 'HEAD' ? ['--head'] : ['-X', method]
  const args = ['-s', '-S', '--http1.1', ...verb, '-D', hdrFile, '-o', bodyFile, url]
  // supabase-js 는 헤더를 `Headers` 인스턴스로 넘긴다 — Object.entries 로는 한 개도 안 나온다
  // (그러면 apikey 가 빠져 401 이 오는데, 원인이 헤더라는 것이 오류 문구에 안 보인다).
  if (init?.headers) {
    new Headers(init.headers as HeadersInit).forEach((v, k) => args.push('-H', `${k}: ${v}`))
  }
  if (init?.body != null) {
    writeFileSync(inFile, init.body as string)
    args.push('--data-binary', `@${inFile}`)
  }
  execFileSync('curl', args, { maxBuffer: 1024 * 1024 * 512 })
  const rawHeaders = readFileSync(hdrFile, 'utf8')
  const body = readFileSync(bodyFile, 'utf8')
  const lines = rawHeaders.split(/\r?\n/)
  const status = Number(lines[0]?.split(' ')[1] ?? 200)
  const headers = new Headers()
  for (const line of lines.slice(1)) {
    const i = line.indexOf(':')
    if (i > 0) headers.append(line.slice(0, i).trim(), line.slice(i + 1).trim())
  }
  return new Response(body, { status, headers })
}

function loadEnv(): { url: string; key: string } {
  const raw = readFileSync(ENV_PATH, 'utf8')
  const pick = (name: string): string => {
    const re = new RegExp('^\\s*' + name + '\\s*=\\s*(.+)\\s*$', 'm')
    const m = raw.match(re)
    if (!m) throw new Error(name + ' not found in ' + ENV_PATH)
    return m[1]!.trim().replace(/^["']|["']$/g, '')
  }
  return { url: pick('NEXT_PUBLIC_SUPABASE_URL'), key: pick('SUPABASE_SERVICE_ROLE_KEY') }
}

type Q = { count: number | null; error: { message: string } | null }

async function n(p: PromiseLike<Q>): Promise<number> {
  const { count, error } = await p
  if (error) throw new Error(error.message)
  return count ?? 0
}

const pct = (a: number, b: number): string => (b === 0 ? '  n/a' : ((a / b) * 100).toFixed(1) + '%')

// ── word-web 정제 규칙 사본 (apps/web/src/lib/dict/word-web.ts 와 동일) ──────────
function containsHeadword(candidate: string, headword: string): boolean {
  const head = headword.trim().toLowerCase()
  if (!head) return false
  return candidate
    .toLowerCase()
    .split(/[^a-z0-9'’-]+/)
    .some((tok) => tok === head)
}

function cleanWordWebRow(list: readonly string[] | null | undefined, headword: string): string[] | null {
  if (!Array.isArray(list)) return null
  const self = headword.trim().toLowerCase()
  const out = [
    ...new Set(
      list
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0)
        .filter((s) => s.toLowerCase() !== self)
        .filter((s) => !containsHeadword(s, self)),
    ),
  ]
  return out.length > 0 ? out : null
}

const exampleKey = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

// ── ① 컬럼별 채움률 ────────────────────────────────────────────────────────────
type Filt = (q: any) => any

const NOT_NULL: Filt = (q) => q
const textCol = (c: string): Filt => (q) => q.not(c, 'is', null).neq(c, '')
const arrCol = (c: string): Filt => (q) => q.not(c, 'is', null).neq(c, '{}')
const jsonArr = (c: string): Filt => (q) => q.not(c, 'is', null).neq(c, '[]')
const plain = (c: string): Filt => (q) => q.not(c, 'is', null)

const COLUMNS: Array<[string, Filt]> = [
  ['meaning_ko', textCol('meaning_ko')],
  ['meanings_ko', jsonArr('meanings_ko')],
  ['senses', jsonArr('senses')],
  ['example_en', textCol('example_en')],
  ['example_ko', textCol('example_ko')],
  ['synonyms', arrCol('synonyms')],
  ['antonyms', arrCol('antonyms')],
  ['collocations', arrCol('collocations')],
  ['derived_forms', arrCol('derived_forms')],
  ['related_terms', arrCol('related_terms')],
  ['homophones', arrCol('homophones')],
  ['spelling_variants', arrCol('spelling_variants')],
  ['inflected_forms', arrCol('inflected_forms')],
  ['inflections', plain('inflections')],
  ['korean_learner_note', textCol('korean_learner_note')],
  ['mnemonic_ko', textCol('mnemonic_ko')],
  ['ipa', textCol('ipa')],
  ['ipa_uk', textCol('ipa_uk')],
  ['ipa_us', textCol('ipa_us')],
  ['audio_url', textCol('audio_url')],
  ['audio_url_uk', textCol('audio_url_uk')],
  ['audio_url_us', textCol('audio_url_us')],
  ['image_url', textCol('image_url')],
  ['register', textCol('register')],
  ['word_register', textCol('word_register')],
  ['cefr_level', textCol('cefr_level')],
  ['v_level', plain('v_level')],
  ['frequency_rank', plain('frequency_rank')],
  ['list_tags', arrCol('list_tags')],
  ['base_word', textCol('base_word')],
  ['rhyme_key', textCol('rhyme_key')],
  ['primary_pos', textCol('primary_pos')],
  ['pos_set', arrCol('pos_set')],
  ['frequency_band', textCol('frequency_band')],
  ['cefrj_wordlist_band', textCol('cefrj_wordlist_band')],
  ['field_provenance', plain('field_provenance')],
]

// lookup_word_meaning 의 'direct' 분기가 요구하는 조건 = 리더가 도달할 수 있는 행
const reachable: Filt = (q) =>
  q.not('v_level', 'is', null).not('classified_by', 'is', null).not('meaning_ko', 'is', null)

async function fillRates(c: SupabaseClient) {
  const base = () => c.from('shared_dictionary').select('word', { count: 'exact', head: true })
  const total = await n(base())
  const reach = await n(reachable(base()))

  console.log('\n══ ① shared_dictionary 컬럼 채움률 ══')
  console.log(`전체 ${total} 행 · 리더 도달 가능(v_level+classified_by+meaning_ko) ${reach} 행 (${pct(reach, total)})\n`)
  console.log('컬럼'.padEnd(24) + '전체'.padStart(10) + '채움률'.padStart(10) + '도달가능'.padStart(12) + '도달채움률'.padStart(12))
  console.log('-'.repeat(70))
  const out: Record<string, { all: number; reach: number }> = {}
  for (const [name, f] of COLUMNS) {
    const a = await n(f(base()))
    const r = await n(f(reachable(base())))
    out[name] = { all: a, reach: r }
    console.log(name.padEnd(24) + String(a).padStart(10) + pct(a, total).padStart(10) + String(r).padStart(12) + pct(r, reach).padStart(12))
  }
  return { total, reach, out }
}

// ── ② 릴레이 불일치: shared_words.ipa(쓰기) vs .pronunciation(읽기) ───────────
async function relay(c: SupabaseClient) {
  console.log('\n══ ② 릴레이 shared_words — writer 가 채우는 칸 vs reader 가 읽는 칸 ══')
  const pub = () =>
    c
      .from('shared_words')
      .select('id, shared_word_sets!inner(is_published)', { count: 'exact', head: true })
      .eq('shared_word_sets.is_published', true)

  const total = await n(pub())
  const ipa = await n(textCol('ipa')(pub()))
  const pron = await n(textCol('pronunciation')(pub()))
  const kln = await n(textCol('korean_learner_note')(pub()))
  const syn = await n(arrCol('synonyms')(pub()))
  const ant = await n(arrCol('antonyms')(pub()))
  const col = await n(arrCol('collocations')(pub()))
  const defs = await n(plain('definitions_ko_full')(pub()))
  const exf = await n(plain('examples_full')(pub()))
  const src = await n(textCol('source_sentence')(pub()))
  const exen = await n(textCol('example_en')(pub()))

  console.log(`발행 세트 소속 shared_words ${total} 행`)
  const row = (label: string, v: number, note: string) =>
    console.log(label.padEnd(26) + String(v).padStart(9) + pct(v, total).padStart(9) + '  ' + note)
  row('ipa', ipa, 'writer: publish_book_word_sets 가 d.ipa 를 넣는다')
  row('pronunciation', pron, 'READER: scoped-words.ts:169 / deliver_chapter_vocab 가 읽는 칸')
  row('korean_learner_note', kln, 'READER: VocabSetPreviewModal:162')
  row('synonyms', syn, '리더 없음(학습자 화면은 shared_dictionary 에서 직접 읽음)')
  row('antonyms', ant, '리더 없음')
  row('collocations', col, '리더 없음')
  row('definitions_ko_full', defs, '리더 없음')
  row('examples_full', exf, '리더 없음')
  row('source_sentence', src, 'READER: scoped-words.ts example 1순위')
  row('example_en', exen, 'READER: scoped-words.ts example 2순위')
  return { total, ipa, pron }
}

// ── ③ 렌더되는 값이 화면까지 살아남는가 ──────────────────────────────────────
async function survival(c: SupabaseClient) {
  console.log('\n══ ③ 렌더 경로 생존율 ══')

  // 3-1 word-web 정제 후 남는가 (CardBack / WordLookupPopover 공통 규칙)
  const PAGE = 1000
  let from = 0
  const stat = {
    rows: 0,
    syn: { filled: 0, survives: 0 },
    ant: { filled: 0, survives: 0 },
    der: { filled: 0, survives: 0 },
    senses2: 0,
    meaningsFilled: 0,
    exKo: 0,
    shapeOk: 0,
    shapeOther: 0,
  }
  const otherKeys = new Map<string, number>()
  for (;;) {
    const { data, error } = await c
      .from('shared_dictionary')
      .select('word, synonyms, antonyms, derived_forms, meanings_ko')
      .order('word', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{
      word: string
      synonyms: string[] | null
      antonyms: string[] | null
      derived_forms: string[] | null
      meanings_ko: unknown
    }>
    if (rows.length === 0) break
    for (const r of rows) {
      stat.rows += 1
      const pairs: Array<[keyof typeof stat.syn extends never ? never : 'syn' | 'ant' | 'der', string[] | null]> = [
        ['syn', r.synonyms],
        ['ant', r.antonyms],
        ['der', r.derived_forms],
      ]
      for (const [k, list] of pairs) {
        if (Array.isArray(list) && list.length > 0) {
          stat[k].filled += 1
          if (cleanWordWebRow(list, r.word)) stat[k].survives += 1
        }
      }
      const m = r.meanings_ko
      if (Array.isArray(m) && m.length > 0) {
        stat.meaningsFilled += 1
        const senses = (m as Array<Record<string, unknown>>).filter(
          (s) => s && typeof s['meaning'] === 'string' && (s['meaning'] as string).trim(),
        )
        if (senses.length >= 2) stat.senses2 += 1
        if (senses.length > 0) stat.shapeOk += 1
        else {
          stat.shapeOther += 1
          for (const k of Object.keys((m as Array<Record<string, unknown>>)[0] ?? {})) {
            otherKeys.set(k, (otherKeys.get(k) ?? 0) + 1)
          }
        }
        if ((m as Array<Record<string, unknown>>).some((s) => typeof s?.['example_ko'] === 'string' && (s['example_ko'] as string).trim())) {
          stat.exKo += 1
        }
      }
    }
    if (rows.length < PAGE) break
    from += PAGE
  }

  console.log(`\n[3-1] 낱말 그물 정제(cleanWordWebRow) 생존 — 표본 ${stat.rows} 행 전수`)
  const w = (label: string, s: { filled: number; survives: number }) =>
    console.log(
      label.padEnd(14) +
        `채움 ${String(s.filled).padStart(7)} (${pct(s.filled, stat.rows)})  →  화면 ${String(s.survives).padStart(7)} (${pct(s.survives, stat.rows)})  소실 ${s.filled - s.survives} (${pct(s.filled - s.survives, s.filled)})`,
    )
  w('synonyms', stat.syn)
  w('antonyms', stat.ant)
  w('derived_forms', stat.der)

  console.log(`\n[3-2] meanings_ko 모양 — 채움 ${stat.meaningsFilled} · meaning 키 있음 ${stat.shapeOk} · 없음 ${stat.shapeOther}`)
  if (stat.shapeOther > 0) console.log('      다른 키:', [...otherKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
  console.log(`      CardBack "여러 뜻" 조건(senses>=2): ${stat.senses2} (${pct(stat.senses2, stat.rows)} of 전체)`)
  console.log(`      example_ko 보유(뜻 1개 이상): ${stat.exKo} (${pct(stat.exKo, stat.rows)})`)

  // 3-3 exampleTranslation 히트율 — 카드가 실제로 보여주는 예문에 해석이 붙는가
  console.log('\n[3-3] 카드 예문 해석(exampleTranslation) 히트율 — 발행 세트 표본')
  const SAMPLE = 4000
  const { data: swData, error: swErr } = await c
    .from('shared_words')
    .select('word, lemma, source_sentence, example_en, shared_word_sets!inner(is_published)')
    .eq('shared_word_sets.is_published', true)
    .limit(SAMPLE)
  if (swErr) throw new Error(swErr.message)
  const sw = (swData ?? []) as Array<{
    word: string
    lemma: string | null
    source_sentence: string | null
    example_en: string | null
  }>
  const lemmas = [...new Set(sw.map((r) => (r.lemma ?? r.word).toLowerCase()))]
  const dictMap = new Map<string, Set<string>>()
  for (let i = 0; i < lemmas.length; i += 500) {
    const { data, error } = await c
      .from('shared_dictionary')
      .select('word, meanings_ko')
      .in('word', lemmas.slice(i, i + 500))
    if (error) throw new Error(error.message)
    for (const d of (data ?? []) as Array<{ word: string; meanings_ko: unknown }>) {
      const keys = new Set<string>()
      if (Array.isArray(d.meanings_ko)) {
        for (const s of d.meanings_ko as Array<Record<string, unknown>>) {
          const ex = typeof s?.['example'] === 'string' ? (s['example'] as string).trim() : ''
          const ko = typeof s?.['example_ko'] === 'string' ? (s['example_ko'] as string).trim() : ''
          if (ex && ko) keys.add(exampleKey(ex))
        }
      }
      dictMap.set(d.word.toLowerCase(), keys)
    }
  }
  let shown = 0
  let fromSource = 0
  let hit = 0
  let hitIfDictExample = 0
  let dictExampleShown = 0
  for (const r of sw) {
    const example = r.source_sentence ?? r.example_en ?? ''
    if (!example) continue
    shown += 1
    if (r.source_sentence) fromSource += 1
    else dictExampleShown += 1
    const table = dictMap.get((r.lemma ?? r.word).toLowerCase())
    const ok = !!table && table.has(exampleKey(example))
    if (ok) hit += 1
    if (ok && !r.source_sentence) hitIfDictExample += 1
  }
  console.log(`      표본 ${sw.length} 행 · 예문 표시 ${shown}`)
  console.log(`      예문이 도서 원문 문장(source_sentence): ${fromSource} (${pct(fromSource, shown)})`)
  console.log(`      예문이 사전 example_en: ${dictExampleShown} (${pct(dictExampleShown, shown)})`)
  console.log(`      해석이 실제로 붙은 카드: ${hit} (${pct(hit, shown)})  [사전 예문인 것 중: ${hitIfDictExample} / ${dictExampleShown} = ${pct(hitIfDictExample, dictExampleShown)}]`)

  // 3-4 hub 경로: vocabularies.word 가 사전 표제어와 맞는가 (lemma 미사용 경로)
  console.log('\n[3-4] /flashcard hub 경로 — vocabularies.word 로 사전 조회 (lemma 미사용)')
  const { data: vData, error: vErr } = await c.from('vocabularies').select('word, lemma').limit(5000)
  if (vErr) {
    console.log('      vocabularies 조회 실패:', vErr.message)
  } else {
    const vs = (vData ?? []) as Array<{ word: string; lemma: string | null }>
    const words = [...new Set(vs.map((r) => (r.word ?? '').toLowerCase()).filter(Boolean))]
    const found = new Set<string>()
    for (let i = 0; i < words.length; i += 500) {
      const { data } = await c.from('shared_dictionary').select('word').in('word', words.slice(i, i + 500))
      for (const d of (data ?? []) as Array<{ word: string }>) found.add(d.word.toLowerCase())
    }
    const miss = words.filter((w) => !found.has(w))
    const lemmaDiff = vs.filter((r) => r.lemma && r.lemma.toLowerCase() !== (r.word ?? '').toLowerCase()).length
    console.log(`      vocabularies ${vs.length} 행 · distinct word ${words.length}`)
    console.log(`      표면형이 사전 표제어에 없음: ${miss.length} (${pct(miss.length, words.length)}) → 연어·니모닉·그물 전부 빈다`)
    console.log(`      lemma 가 word 와 다른 행: ${lemmaDiff} (${pct(lemmaDiff, vs.length)}) — hub-words.ts:36 은 lemma 를 안 쓴다`)
    if (miss.length > 0) console.log('      예:', miss.slice(0, 12).join(', '))
  }
}

async function main() {
  const { url, key } = loadEnv()
  const c = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: curlFetch },
  })
  await fillRates(c)
  await relay(c)
  await survival(c)
  rmSync(TMP, { recursive: true, force: true })
  console.log('\n완료 — 읽기 전용.')
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
