// scripts/dict-quality/apply-pending-dict-migrations.ts
//
// 마이그레이션 2건을 **service-role DML** 로 적용한다.
//   · 20260815090000_ngsl_top2000_basic_gaps.sql
//   · 20260815093000_template_examples_remove_and_reauthor.sql
//
// 왜 `apply_migration` 이 아닌가: 적용 시점에 Supabase MCP 연결이 끊겨 있었다.
// `supabase db push` 는 **다른 세션의 미적용 마이그레이션까지 함께** 밀어 올리므로 쓰지 않는다.
// 두 파일 모두 DDL 이 없고 INSERT/UPDATE 뿐이라 PostgREST 로 같은 결과를 낼 수 있다.
//
// 재실행 안전: ① 신규 표제어는 이미 있으면 건너뛴다 ② 예문 정리는 대상 틀이 사라진 뒤에는
// 매칭이 0건이라 no-op. 그래서 나중에 마이그레이션 파일이 정식 경로로 다시 적용돼도 무해하다.
//
// 사용:
//   npx tsx scripts/dict-quality/apply-pending-dict-migrations.ts          # dry-run (기본)
//   npx tsx scripts/dict-quality/apply-pending-dict-migrations.ts --apply  # 실제 적용

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ENV_PATH = resolve(__dirname, '../../apps/web/.env.local')
const APPLY = process.argv.includes('--apply')

function readEnv(key: string): string | undefined {
  try {
    return readFileSync(ENV_PATH, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim()
  } catch {
    return process.env[key]
  }
}

function client(): SupabaseClient {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('apps/web/.env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 필요하다.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ── 마이그레이션 ①: 빈도 상위 기초어 ───────────────────────────────
interface NewEntry {
  word: string
  pos: string
  meaning: string
  cefr: string
  example: string
  register?: string
  posSet?: string[]
  base?: string
}

const NEW_ENTRIES: NewEntry[] = [
  { word: 'something', pos: 'pronoun', meaning: '어떤 것, 무언가', cefr: 'A1', example: 'I heard something moving behind the door.' },
  { word: 'someone', pos: 'pronoun', meaning: '누군가, 어떤 사람', cefr: 'A1', example: 'Someone left an umbrella by the front door.' },
  { word: 'whatever', pos: 'pronoun', meaning: '무엇이든, ~하는 것은 무엇이나', cefr: 'A2', example: 'Take whatever you need from the shelf.', posSet: ['pronoun', 'determiner'] },
  { word: 'throughout', pos: 'preposition', meaning: '~내내, ~ 전체에 걸쳐', cefr: 'B1', example: 'The library stays open throughout the summer.', posSet: ['preposition', 'adverb'] },
  { word: 'okay', pos: 'adjective', meaning: '괜찮은, 무방한', cefr: 'A1', example: 'Is it okay if I open the window?', register: 'informal', posSet: ['adjective', 'adverb', 'interjection'] },
  { word: 'onto', pos: 'preposition', meaning: '~ 위로 (표면에 닿는 이동)', cefr: 'A2', example: 'The cat jumped onto the kitchen table.' },
  { word: 'everywhere', pos: 'adverb', meaning: '어디에나, 모든 곳에', cefr: 'A2', example: 'By morning, snow had settled everywhere in the valley.' },
  { word: 'hi', pos: 'interjection', meaning: '안녕 (가벼운 인사)', cefr: 'A1', example: 'Hi, I did not expect to see you here.', register: 'informal' },
  { word: 'fifteen', pos: 'determiner', meaning: '15, 열다섯', cefr: 'A1', example: 'The next bus leaves in fifteen minutes.', posSet: ['determiner', 'number'] },
  { word: 'forty', pos: 'determiner', meaning: '40, 마흔', cefr: 'A1', example: 'She swam forty laps before breakfast.', posSet: ['determiner', 'number'] },
  { word: 'cannot', pos: 'auxiliary', meaning: '~할 수 없다 (can 의 부정)', cefr: 'A1', example: 'I cannot open this jar by myself.', base: 'can' },
]

// ── 마이그레이션 ②: 템플릿 예문 ────────────────────────────────────
const TEMPLATE_FRAMES = new Set([
  'the {w} is mentioned several times in the text.',
  'the result seemed remarkably {w} to everyone.',
  'the result appeared notably {w}.',
  'she answered the question {w}.',
  'they decided to {w} the matter together.',
  'he often uses the expression "{w}" in conversation.',
  'they planned to {w} the issue carefully.',
  'she responded to the question {w}.',
  'the report contains the abbreviation "{w}".',
])

const REAUTHORED: Record<string, string> = {
  photo: 'She keeps a photo of her grandmother on the desk.',
  auto: 'He works at an auto repair shop near the station.',
  annoyed: 'He was annoyed that the train was late again.',
  annoying: 'The annoying beep repeated every thirty seconds.',
  somewhere: 'I left my keys somewhere between the car and the office.',
  everyday: 'Cooking rice is an everyday task in this household.',
  magician: 'The magician pulled three coins from an empty hat.',
  torn: 'The map was torn along the fold and missing a corner.',
  endangered: 'Only about forty of these endangered birds remain in the wild.',
  faraway: 'She dreamed of faraway islands she had only seen in books.',
  driverless: 'A driverless bus now runs between the two terminals.',
  crisply: 'He folded the letter crisply and slid it into the envelope.',
  airsick: 'She felt airsick during the bumpy descent.',
  carsick: 'The child gets carsick on winding mountain roads.',
  eighty: 'My grandfather turned eighty last spring.',
  african: 'The museum displays African masks carved from dark wood.',
  european: 'Several European cities banned cars from the old centre.',
  'good-looking': 'The house was good-looking from the street but cold inside.',
  'hard-working': 'She is a hard-working student who rarely misses a class.',
  'front-page': 'The flood became front-page news the next morning.',
  'after-school': 'He joined an after-school club that builds robots.',
  'deep-sea': 'Deep-sea creatures survive without any sunlight.',
  'deep-water': 'The port is deep-water, so large ships can dock there.',
  'fair-haired': 'A fair-haired boy waved from the second-floor window.',
  'first-class': 'The hotel offered first-class service at a modest price.',
  'north-east': 'The wind blew from the north-east all afternoon.',
  'north-west': 'They drove north-west until the road ended.',
  'south-east': 'Rain moves in from the south-east at this time of year.',
  'south-west': 'The kitchen window faces south-west and catches the sunset.',
  'fed up': 'She was fed up with waiting and left without her order.',
}

/**
 * SQL 의 `lower(regexp_replace(example, '\m'||word||'\M', '{W}', 'gi'))` 와 **같은 규칙**.
 * 프로브(example-quality.ts)는 `\w*` 를 붙여 조금 더 넓게 잡지만, 여기서는 마이그레이션이
 * 세어 둔 행 집합과 정확히 일치해야 하므로 단어 경계 정확 일치를 쓴다.
 */
function frameOf(word: string, example: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return example.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '{W}').toLowerCase()
}

async function fetchAll<T>(c: SupabaseClient, table: string, cols: string): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await c
      .from(table)
      .select(cols)
      .not('example_en', 'is', null)
      .order('id' in ({} as never) ? 'word' : 'word', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const rows = (data ?? []) as unknown as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function main() {
  const c = client()
  console.log(APPLY ? '\n▶ 적용 모드\n' : '\n▶ DRY-RUN (적용하려면 --apply)\n')

  // ── ① 기초어 등재 ────────────────────────────────────────────
  const words = NEW_ENTRIES.map((e) => e.word)
  const { data: existing, error: exErr } = await c.from('shared_dictionary').select('word').in('word', words)
  if (exErr) throw new Error(exErr.message)
  const have = new Set((existing ?? []).map((r) => (r as { word: string }).word))
  const toInsert = NEW_ENTRIES.filter((e) => !have.has(e.word))
  console.log(`① 기초어 등재: 대상 ${NEW_ENTRIES.length} · 이미 있음 ${have.size} · 넣을 것 ${toInsert.length}`)

  if (APPLY && toInsert.length > 0) {
    const rows = toInsert.map((e) => ({
      word: e.word,
      pos: e.pos,
      primary_pos: e.pos,
      pos_set: e.posSet ?? [e.pos],
      meaning_ko: e.meaning,
      meanings_ko: [{ pos: e.pos, meaning: e.meaning }],
      cefr_level: e.cefr,
      example_en: e.example,
      senses: [
        {
          pos: e.pos,
          sense_idx: 0,
          sense_ko: e.meaning,
          sense_en: null,
          register: e.register ?? 'neutral',
          examples: [{ en: e.example }],
        },
      ],
      source: 'manual',
      verified: true,
      word_register: 'standard',
      ...(e.base ? { base_word: e.base } : {}),
    }))
    const { error } = await c.from('shared_dictionary').insert(rows)
    if (error) throw new Error(`등재 실패: ${error.message}`)
    console.log(`   → ${rows.length}종 등재`)
  }

  // `prove` 굴절에 `proven` 연결
  const { data: proveRow } = await c.from('shared_dictionary').select('word, inflected_forms').eq('word', 'prove').maybeSingle()
  const forms: string[] = (proveRow as { inflected_forms: string[] | null } | null)?.inflected_forms ?? []
  const needProven = proveRow != null && !forms.includes('proven')
  console.log(`   prove.inflected_forms 에 proven 추가 필요: ${needProven}`)
  if (APPLY && needProven) {
    const { error } = await c
      .from('shared_dictionary')
      .update({ inflected_forms: [...forms, 'proven'], updated_at: new Date().toISOString() })
      .eq('word', 'prove')
    if (error) throw new Error(`prove 갱신 실패: ${error.message}`)
    console.log('   → proven 연결')
  }

  // ── ② 템플릿 예문 ────────────────────────────────────────────
  type DictRow = { word: string; example_en: string; senses: unknown }
  type SetRow = { id: string; word: string; example_en: string }

  const dict = await fetchAll<DictRow>(c, 'shared_dictionary', 'word, example_en, senses')
  const sets = await fetchAll<SetRow>(c, 'shared_words', 'id, word, example_en')

  const dictHit = dict.filter((r) => TEMPLATE_FRAMES.has(frameOf(r.word, r.example_en)))
  const setHit = sets.filter((r) => TEMPLATE_FRAMES.has(frameOf(r.word, r.example_en)))

  const dictReauthor = dictHit.filter((r) => REAUTHORED[r.word] !== undefined)
  const dictNull = dictHit.filter((r) => REAUTHORED[r.word] === undefined)
  const setReauthor = setHit.filter((r) => REAUTHORED[r.word.toLowerCase()] !== undefined)
  const setNull = setHit.filter((r) => REAUTHORED[r.word.toLowerCase()] === undefined)

  console.log(
    `\n② 템플릿 예문:\n` +
      `   shared_dictionary  대상 ${dictHit.length} (재작성 ${dictReauthor.length} · 비움 ${dictNull.length})\n` +
      `   shared_words(발행) 대상 ${setHit.length} (재작성 ${setReauthor.length} · 비움 ${setNull.length})`,
  )

  // 하이픈·공백이 든 표제어는 PostgreSQL `\m..\M` 와 JS `\b` 의 단어 경계 해석이 달라
  // 매칭 수가 갈린다(SQL 5,452 vs JS 5,489). **틀이 9개 문장과 정확히 일치할 때만** 대상이므로
  // 오탐은 구조적으로 불가능하고, 차이분은 SQL 이 놓친 같은 부류다. 그래도 눈으로 확인한다.
  const odd = dictHit.filter((r) => /[-\s']/.test(r.word)).slice(0, 5)
  if (odd.length > 0) {
    console.log('   (경계 차이 표본)')
    for (const r of odd) console.log(`     ${JSON.stringify(r.word)} → ${r.example_en.slice(0, 64)}`)
  }

  if (APPLY) {
    // 되돌릴 수 있게 원본을 남긴다 — 템플릿이라 가치는 없지만, 되돌릴 수 없는 변경은 만들지 않는다.
    const backup = {
      appliedAt: new Date().toISOString(),
      shared_dictionary: dictHit.map((r) => ({ word: r.word, example_en: r.example_en })),
      shared_words: setHit.map((r) => ({ id: r.id, word: r.word, example_en: r.example_en })),
    }
    mkdirSync(resolve(__dirname, '../../a11y-report'), { recursive: true })
    const backupPath = resolve(__dirname, `../../a11y-report/template-examples-backup.json`)
    writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8')
    console.log(`   백업: ${backupPath} (${dictHit.length + setHit.length}행)`)

    for (const r of dictReauthor) {
      const ex = REAUTHORED[r.word]!
      const senses = Array.isArray(r.senses) && r.senses.length > 0
        ? (r.senses as Array<Record<string, unknown>>).map((s, i) => (i === 0 ? { ...s, examples: [{ en: ex }] } : s))
        : r.senses
      const { error } = await c
        .from('shared_dictionary')
        .update({ example_en: ex, senses, updated_at: new Date().toISOString() })
        .eq('word', r.word)
      if (error) throw new Error(`재작성 실패(${r.word}): ${error.message}`)
    }
    console.log(`   → 사전 재작성 ${dictReauthor.length}`)

    for (const part of chunk(dictNull.map((r) => r.word), 200)) {
      const { error } = await c
        .from('shared_dictionary')
        .update({ example_en: null, updated_at: new Date().toISOString() })
        .in('word', part)
      if (error) throw new Error(`사전 비우기 실패: ${error.message}`)
    }
    console.log(`   → 사전 비움 ${dictNull.length}`)

    for (const r of setReauthor) {
      const { error } = await c
        .from('shared_words')
        .update({ example_en: REAUTHORED[r.word.toLowerCase()]! })
        .eq('id', r.id)
      if (error) throw new Error(`세트 재작성 실패(${r.word}): ${error.message}`)
    }
    console.log(`   → 세트 재작성 ${setReauthor.length}`)

    for (const part of chunk(setNull.map((r) => r.id), 200)) {
      const { error } = await c.from('shared_words').update({ example_en: null }).in('id', part)
      if (error) throw new Error(`세트 비우기 실패: ${error.message}`)
    }
    console.log(`   → 세트 비움 ${setNull.length}`)
  }

  console.log('')
}

void main().catch((e) => {
  console.error('중단:', e.message)
  process.exit(1)
})
