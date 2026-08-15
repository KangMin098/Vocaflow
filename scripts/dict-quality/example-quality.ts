// scripts/dict-quality/example-quality.ts
//
// 예문이 **그 단어를 가르치는가** 를 잰다.
//
// 10회차 프로브(probe.ts)는 "예문에 표제어가 있는가" 를 봤다. 통과한다고 좋은 예문은 아니다.
// 실측(2026-08-15): 예문 5,452개가 **9개 틀의 복사본**이었다 —
//   "The result seemed remarkably {W} to everyone."  ×1,101
//   "The {W} is mentioned several times in the text." ×1,578
// 표제어는 들어 있고 문법도 맞지만, 그 단어가 무슨 뜻인지는 한 글자도 알려주지 않는다.
// 학습자에게는 **없는 것보다 나쁘다** — 내용이 있는 척하기 때문이다(ADR 0004 D4 와 같은 논리).
//
// 탐지 방법: 예문에서 표제어를 `{W}` 로 치환한 **틀**이 여러 단어에 재사용됐는지 센다.
// 사람이 쓴 예문은 단어마다 문장이 다르므로 틀이 겹치지 않는다. 임계값은 재사용 N회 이상.
//
// 두 테이블을 함께 본다 — 발행 단어장(`shared_words`)은 발행 시점에 예문을 **복사**하므로
// 사전만 고치면 학습자 화면은 그대로다(M7 이 챕터 세트에서 찾아낸 드리프트와 같은 구조).
//
// 사용:
//   npx tsx scripts/dict-quality/example-quality.ts            # 요약
//   npx tsx scripts/dict-quality/example-quality.ts --frames   # 틀 목록
//   npx tsx scripts/dict-quality/example-quality.ts --words A1 # 해당 레벨의 대상 단어

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ENV_PATH = resolve(__dirname, '../../apps/web/.env.local')

/** 틀 재사용이 이 횟수 이상이면 템플릿으로 본다 — 우연히 같은 문장이 나올 수는 없는 수준 */
const REUSE_THRESHOLD = 10

function readEnv(key: string): string | undefined {
  try {
    return readFileSync(ENV_PATH, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim()
  } catch {
    return process.env[key]
  }
}

function serviceClient(): SupabaseClient {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('apps/web/.env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 필요하다.')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

interface Row {
  word: string
  example_en: string | null
  cefr_level?: string | null
  source?: string | null
}

/** 표제어를 `{W}` 로 치환 — 대소문자·복수형 어미는 무시하고 문장 골격만 남긴다 */
function frameOf(word: string, example: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return example
    .toLowerCase()
    .replace(new RegExp(`\\b${escaped}\\w*\\b`, 'gi'), '{W}')
    .replace(/\s+/g, ' ')
    .trim()
}

/** PostgREST 기본 1000행 상한을 넘겨 **전량** 읽는다 (v06.161 집계 cap 결함과 같은 함정) */
async function fetchAll(client: SupabaseClient, table: string, cols: string): Promise<Row[]> {
  const PAGE = 1000
  const out: Row[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client
      .from(table)
      .select(cols)
      .not('example_en', 'is', null)
      .order('word', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
    const rows = (data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

function analyze(rows: Row[]) {
  const frames = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.example_en || r.example_en.length < 8) continue
    const f = frameOf(r.word, r.example_en)
    if (!frames.has(f)) frames.set(f, [])
    frames.get(f)!.push(r)
  }
  const templated = [...frames.entries()]
    .filter(([, list]) => list.length >= REUSE_THRESHOLD)
    .sort((a, b) => b[1].length - a[1].length)
  const affected = templated.reduce((a, [, list]) => a + list.length, 0)
  return { total: rows.length, frames, templated, affected }
}

async function main() {
  const mode = process.argv[2] ?? ''
  const levelArg = process.argv[3]
  const client = serviceClient()

  const dict = await fetchAll(client, 'shared_dictionary', 'word, example_en, cefr_level, source')
  const sets = await fetchAll(client, 'shared_words', 'word, example_en')

  const d = analyze(dict)
  const s = analyze(sets)

  console.log('\n═══ 예문 품질 — 틀 재사용 (임계 ' + REUSE_THRESHOLD + '회)')
  console.log(
    `  shared_dictionary  예문 ${d.total.toLocaleString()} · 템플릿 ${d.affected.toLocaleString()}` +
      ` (${((d.affected / Math.max(1, d.total)) * 100).toFixed(1)}%) · 틀 ${d.templated.length}종`,
  )
  console.log(
    `  shared_words(발행) 예문 ${s.total.toLocaleString()} · 템플릿 ${s.affected.toLocaleString()}` +
      ` (${((s.affected / Math.max(1, s.total)) * 100).toFixed(1)}%) · 틀 ${s.templated.length}종`,
  )
  console.log(
    `  → 발행 세트는 예문을 복사해 갖는다. 사전만 고치면 학습자 화면은 그대로다.`,
  )

  if (mode === '--frames') {
    console.log('\n  틀 (사전):')
    for (const [f, list] of d.templated) {
      console.log(`    ${String(list.length).padStart(5)}회  ${f.slice(0, 78)}`)
    }
    console.log('\n  틀 (발행 세트):')
    for (const [f, list] of s.templated) {
      console.log(`    ${String(list.length).padStart(5)}회  ${f.slice(0, 78)}`)
    }
  }

  if (mode === '--words') {
    const want = levelArg ?? 'A1'
    const words = d.templated
      .flatMap(([, list]) => list)
      .filter((r) => (r.cefr_level ?? '') === want)
      .map((r) => r.word)
      .sort()
    console.log(`\n  ${want} 대상 ${words.length}종:`)
    console.log('    ' + words.join(' '))
  }

  // 레벨 분포 — 초급일수록 급하다(그 단어를 만나는 학습자가 많고, 예문 의존도가 높다)
  const byLevel = new Map<string, number>()
  for (const [, list] of d.templated) {
    for (const r of list) {
      const k = r.cefr_level ?? '?'
      byLevel.set(k, (byLevel.get(k) ?? 0) + 1)
    }
  }
  console.log('\n  레벨 분포:', [...byLevel.entries()].sort().map(([k, v]) => `${k}:${v}`).join(' · '))
  console.log('')
}

void main()
