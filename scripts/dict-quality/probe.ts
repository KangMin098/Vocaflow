// scripts/dict-quality/probe.ts
//
// 사전 품질 프로브 — "학습자에게 틀린 것을 가르치고 있지 않은가".
//
// 배경(2026-08-13): 9섹터 커버리지 측정 중 shared_dictionary 의 `he` 가
// pos=adverb · meaning_ko='아주' · 예문 "That cake looks he delicious right now."
// 로 들어가 있는 것을 발견했다. 비문이다. 분류 단계(LLM)의 환각이 그대로 남아 있었고,
// `it` 은 빈도 9위인데 주 뜻이 '정보 기술'(약어 IT)이었다.
//
// 커버리지는 "몇 %를 학습자원으로 만드는가" 를 잰다. 이 프로브는 그 반대편 —
// **만들어낸 학습자원이 옳은가** 를 잰다. 커버리지가 아무리 높아도 뜻이 틀리면
// 되돌릴 수 없는 오학습이다.
//
// 사용:
//   npx tsx scripts/dict-quality/probe.ts
//   npx tsx scripts/dict-quality/probe.ts --limit 40
//
// 검출 2계층:
//   A. 예문 미포함 — example_en 에 표제어가 굴절형으로도 안 나온다 (기계적 · 고정밀)
//   B. 기능어 오분류 — 폐쇄부류 단어에 내용어 POS 가 붙었다 (휴리스틱 · 사람 확인 필요)

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { matchSurface } from '../../apps/web/src/lib/text/surface-match'

const ENV_PATH = resolve(__dirname, '../../apps/web/.env.local')

function readEnv(key: string): string | undefined {
  try {
    const env = readFileSync(ENV_PATH, 'utf8')
    return env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim()
  } catch {
    return process.env[key]
  }
}

function serviceClient(): SupabaseClient {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('! apps/web/.env.local 의 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/** 영어 폐쇄부류 — 새 단어가 거의 추가되지 않는 문법 어휘. 내용어 POS 가 붙으면 의심. */
const CLOSED_CLASS = [
  'i','me','my','mine','myself','you','your','yours','yourself','yourselves',
  'he','him','his','himself','she','her','hers','herself','it','its','itself',
  'we','us','our','ours','ourselves','they','them','their','theirs','themselves',
  'this','that','these','those','who','whom','whose','which','what',
  'a','an','the','some','any','each','every','all','both','either','neither',
  'and','or','but','if','because','although','while','unless','whereas','though',
  'in','on','at','by','for','with','from','to','of','about','into','onto','upon',
  'over','under','between','among','through','during','before','after','until','within',
  'will','would','shall','should','can','could','may','might','must','ought',
  'not','no','nor','than','then','there','here','so','too','very','just',
]

/** 내용어 POS — 폐쇄부류에 붙으면 오분류 의심 */
const CONTENT_POS = new Set(['noun', 'adjective', 'adverb', 'idiom', 'phrasal_verb', 'abbreviation'])

interface Row {
  word: string
  pos: string | null
  meaning_ko: string | null
  example_en: string | null
  frequency_rank: number | null
  inflected_forms: string[] | null
}

/**
 * 예문이 표제어를 (굴절형 포함) 담고 있는가.
 *
 * ⚠️ 자체 규칙을 쓰지 않는다. `matchSurface` 가 이미 e탈락(make→making) ·
 * y→ies/ied(marry→married) · 자음중복(run→running) 을 다루고 회귀 테스트도 있다.
 * 여기서 규칙을 다시 쓰면 그 커버리지를 잃는다 — 실제로 초안이 두 번 오탐을 냈다:
 *   1차(접미사만): give→gave · foot→feet · fight→fought 등 11건 전부 오탐
 *   2차(+inflected_forms): prepare→preparing · marry→married 2건 오탐
 * 사전의 `inflected_forms` 는 knownForms 로 넘겨 불규칙까지 함께 잡는다.
 */
function exampleContainsHeadword(
  word: string,
  example: string,
  inflected: string[] | null,
): boolean {
  return matchSurface(example, word, inflected) !== null
}

async function main() {
  const limitArg = process.argv.indexOf('--limit')
  const showLimit = limitArg >= 0 ? Number(process.argv[limitArg + 1] ?? 30) : 30

  const client = serviceClient()

  // ── A. 예문 미포함 ──
  //   빈도가 높을수록 노출이 많으므로 빈도순으로 본다.
  const { data: aRows, error: aErr } = await client
    .from('shared_dictionary')
    .select('word, pos, meaning_ko, example_en, frequency_rank, inflected_forms')
    .not('classified_by', 'is', null)
    .not('example_en', 'is', null)
    .order('frequency_rank', { ascending: true, nullsFirst: false })
    .limit(20000)
  if (aErr) {
    console.error(`! 조회 실패: ${aErr.message}`)
    process.exit(1)
  }

  const scanned = (aRows ?? []) as Row[]
  const missingExample = scanned.filter(
    (r) =>
      // 단일 문자 표제어(s=초 · m=미터)는 제외 — matchSurface 가 2자 미만을 거부해
      // 구조적으로 오탐이 된다. 단위 기호는 예문 검증 대상이 아니다.
      /^[a-z]{2,}$/.test(r.word) &&
      r.example_en &&
      r.example_en.length > 0 &&
      !exampleContainsHeadword(r.word, r.example_en, r.inflected_forms),
  )

  console.log(`\n═══ A. 예문에 표제어가 없음 ═══`)
  console.log(`검사 ${scanned.length.toLocaleString()}행 (빈도 상위) → 검출 ${missingExample.length.toLocaleString()}건\n`)
  console.log(`  예문은 학습자가 그 단어를 실제로 만나는 유일한 맥락이다.`)
  console.log(`  표제어가 없는 예문은 맥락을 주지 못하고, 플래시카드 빈칸도 만들 수 없다.\n`)
  for (const r of missingExample.slice(0, showLimit)) {
    console.log(`  ${String(r.frequency_rank ?? '—').padStart(6)}  ${r.word.padEnd(20)} ${(r.meaning_ko ?? '').slice(0, 22).padEnd(24)} "${(r.example_en ?? '').slice(0, 56)}"`)
  }
  if (missingExample.length > showLimit) console.log(`  … 외 ${missingExample.length - showLimit}건`)

  // ── B. 폐쇄부류 오분류 ──
  const { data: bRows } = await client
    .from('shared_dictionary')
    .select('word, pos, meaning_ko, example_en, frequency_rank, inflected_forms')
    .not('classified_by', 'is', null)
    .in('word', CLOSED_CLASS)

  const suspects = ((bRows ?? []) as Row[])
    .filter((r) => r.pos && CONTENT_POS.has(r.pos))
    .sort((a, b) => (a.frequency_rank ?? 1e9) - (b.frequency_rank ?? 1e9))

  console.log(`\n═══ B. 폐쇄부류에 내용어 POS ═══`)
  console.log(`폐쇄부류 ${CLOSED_CLASS.length}개 중 사전 등재분에서 검출 ${suspects.length}건\n`)
  console.log(`  ⚠ 전부가 결함은 아니다 — "while(잠시)" · "no(아니오)" 처럼 실재하는 명사 용법이 있다.`)
  console.log(`  뜻과 예문이 **같은 의미**를 가리키는지 사람이 확인해야 한다.`)
  console.log(`  실제 결함이었던 예: he→adverb"아주"(비문 예문) · it→noun"정보 기술"(빈도 9위).\n`)
  for (const r of suspects.slice(0, showLimit)) {
    const mismatch = r.example_en && !exampleContainsHeadword(r.word, r.example_en, r.inflected_forms) ? ' ← 예문에 표제어 없음' : ''
    console.log(`  ${String(r.frequency_rank ?? '—').padStart(6)}  ${r.word.padEnd(12)} ${(r.pos ?? '').padEnd(12)} ${(r.meaning_ko ?? '').slice(0, 20).padEnd(22)} "${(r.example_en ?? '').slice(0, 44)}"${mismatch}`)
  }
  if (suspects.length > showLimit) console.log(`  … 외 ${suspects.length - showLimit}건`)

  console.log('')
}

void main()
