// scripts/dict-quality/frequency-gap.ts
//
// "학습자가 흔히 만나는 단어인데 우리 사전이 설명하지 못하는 것" 을 순위째로 센다.
//
// 왜 필요한가: 커버리지(추출된 후보 중 몇 %를 해석하나)는 **글이 쉬우면 좋아 보인다**.
// 반대편 지표가 필요하다 — 빈도 상위 N 을 얼마나 덮고 있나. 상위 1000 에 구멍이 있으면
// 어떤 글을 넣어도 학습자가 그 단어에서 막힌다.
//
// 기준 목록: NGSL 1.2(일반)·NGSL-Spoken 1.2(구어). 강연·영상 자막 같은 **말하는 영어**는
// 후자 쪽 분포에 가깝다.
//
// 사용:
//   npx tsx scripts/dict-quality/frequency-gap.ts              # 상위 2000 · 요약
//   npx tsx scripts/dict-quality/frequency-gap.ts 1000 --list  # 상위 1000 · 누락 전량 출력
//   npx tsx scripts/dict-quality/frequency-gap.ts 2000 --seed  # VCB seed 형식(JSON) 출력

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ENV_PATH = resolve(__dirname, '../../apps/web/.env.local')
const DATA_DIR = resolve(__dirname, '../../packages/library-pipeline/data/ngsl')

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

/** `Lemma,SFI Rank,...` 헤더의 stats CSV → 순위 순 lemma 배열 */
function readRanked(file: string, limit: number): string[] {
  const rows = readFileSync(resolve(DATA_DIR, file), 'utf8').split(/\r?\n/).slice(1)
  const out: string[] = []
  for (const line of rows) {
    if (!line.trim()) continue
    const lemma = line.split(',')[0]?.trim().toLowerCase()
    if (!lemma || !/^[a-z][a-z'-]*$/.test(lemma)) continue
    out.push(lemma)
    if (out.length >= limit) break
  }
  return out
}

/** 사전이 이 형태를 **설명할 수 있는가** — 표제어 직접 존재 + 4계층 해석 */
async function resolvable(client: SupabaseClient, words: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  const CHUNK = 400
  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK)
    const { data, error } = await client
      .from('shared_dictionary')
      .select('word')
      .in('word', chunk)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) found.add((r as { word: string }).word)
  }
  // 표제어에 없더라도 해석기가 풀어내면 학습자에게 뜻을 줄 수 있다.
  //
  // ⚠️ RPC 인자 이름은 `p_surface` 다. 초안이 `p_word` 로 불렀고, supabase-js 는 그걸
  //    **에러로 돌려줄 뿐 던지지 않는다** — `const { data }` 만 읽으면 전부 null 이 되어
  //    "해석 가능한 단어" 가 전부 누락으로 집계된다(실측: 굴절형으로 이미 등록된
  //    himself·herself·themselves 가 갭으로 보고됐다). 그래서 여기서는 **에러를 던진다**.
  //    조용히 0을 반환하는 측정은 측정이 아니다.
  const missing = words.filter((w) => !found.has(w))
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50)
    const results = await Promise.all(
      chunk.map(async (w) => {
        const { data, error } = await client.rpc('resolve_dict_headword', { p_surface: w })
        if (error) throw new Error(`resolve_dict_headword('${w}') 실패: ${error.message}`)
        return [w, data as string | null] as const
      }),
    )
    for (const [w, head] of results) if (head) found.add(w)
  }
  return found
}

async function main() {
  const limit = Number(process.argv[2] ?? 2000)
  const mode = process.argv[3] ?? ''
  const client = serviceClient()

  const lists: Array<{ label: string; file: string }> = [
    { label: 'NGSL 일반', file: 'NGSL_1.2_stats.csv' },
    { label: 'NGSL 구어', file: 'NGSL-Spoken_1.2_stats.csv' },
  ]

  const allMissing = new Map<string, { list: string; rank: number }>()

  for (const { label, file } of lists) {
    const ranked = readRanked(file, limit)
    const ok = await resolvable(client, ranked)
    const missing = ranked.map((w, i) => ({ w, rank: i + 1 })).filter(({ w }) => !ok.has(w))

    // 밴드별로 나눠 본다 — 상위 500 의 구멍은 하위 2000 의 구멍과 무게가 다르다.
    const bands = [100, 500, 1000, 2000]
    console.log(`\n═══ ${label} (상위 ${ranked.length})`)
    let prev = 0
    for (const b of bands) {
      if (prev >= ranked.length) break
      const inBand = missing.filter((m) => m.rank > prev && m.rank <= b)
      const denom = Math.min(b, ranked.length) - prev
      if (denom > 0) {
        const cov = ((denom - inBand.length) / denom) * 100
        console.log(
          `  ${String(prev + 1).padStart(5)}–${String(Math.min(b, ranked.length)).padEnd(5)} 커버 ${cov.toFixed(1)}%  누락 ${inBand.length}` +
            (inBand.length ? `  · ${inBand.slice(0, 12).map((m) => m.w).join(' ')}` : ''),
        )
      }
      prev = b
    }
    console.log(`  합계 누락 ${missing.length} / ${ranked.length} (${((missing.length / ranked.length) * 100).toFixed(1)}%)`)
    for (const m of missing) {
      if (!allMissing.has(m.w)) allMissing.set(m.w, { list: label, rank: m.rank })
    }
  }

  const sorted = [...allMissing.entries()].sort((a, b) => a[1].rank - b[1].rank)
  console.log(`\n두 목록 합집합 누락: ${sorted.length}종`)

  if (mode === '--list') {
    for (const [w, meta] of sorted) console.log(`  ${String(meta.rank).padStart(5)}  ${w}  (${meta.list})`)
  }
  if (mode === '--seed') {
    console.log(JSON.stringify(sorted.map(([w, m]) => ({ lemma: w, rank: m.rank, source: m.list })), null, 2))
  }
}

void main()
