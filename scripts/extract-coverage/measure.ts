// scripts/extract-coverage/measure.ts
//
// 추출 커버리지 자동 측정 — "학습자가 넣은 스크립트의 단어 중 몇 %가 학습자원이 되는가".
//
// 회차마다 **같은 명령**으로 같은 코퍼스를 돌려 델타를 본다. 그게 자기발전의 정의다.
//
// 사용:
//   npx tsx scripts/extract-coverage/measure.ts                 # 기본 샘플 1편
//   npx tsx scripts/extract-coverage/measure.ts <파일|디렉터리>  # 코퍼스 일괄
//   npx tsx scripts/extract-coverage/measure.ts corpus --json    # 기계 판독 출력
//
// 디렉터리를 주면 그 안의 *.txt 를 전부 편별로 측정하고 합산 리포트를 낸다.
// 골든셋 18편은 `scripts/extract-coverage/corpus/` 에 넣는다 (git 미추적 — .gitignore).
//
// 클라이언트 토큰화와 서버 사전 해석을 **분리해서** 보고한다 — 어느 쪽이 흘렸는지
// 귀속시킬 수 있어야 하기 때문이다. 해석은 실 DB 의 resolve_dict_headword 를 직접 호출한다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, basename, join } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  BUCKET_META,
  classifyPending,
  triageCandidates,
  type PendingBucket,
} from '../../apps/web/src/lib/admin/pending-words/triage'
import { tokenizeText, type TokenizationDiagnostics } from '../../apps/web/src/lib/text-extract/tokenize'

const ENV_PATH = resolve(__dirname, '../../apps/web/.env.local')

function readEnv(key: string): string | undefined {
  try {
    const env = readFileSync(ENV_PATH, 'utf8')
    return env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim()
  } catch {
    return process.env[key]
  }
}

function serviceClient(): SupabaseClient | null {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

interface TextResult {
  name: string
  chars: number
  totalWords: number
  uniqueRaw: number
  candidates: number
  resolved: number
  coveragePct: number
  unresolved: string[]
  diagnostics: TokenizationDiagnostics
}

/** 사전이 해석하지 못한 단어 — unresolved_dict_words RPC (없으면 null 로 graceful) */
async function unresolvedWords(
  client: SupabaseClient,
  words: string[],
): Promise<string[] | null> {
  const { data, error } = await client.rpc('unresolved_dict_words' as never, {
    p_words: words,
  } as never)
  if (error) {
    console.error(`  ! unresolved_dict_words 실패: ${error.message}`)
    return null
  }
  return (data as unknown as string[]) ?? []
}

async function measureOne(
  client: SupabaseClient | null,
  name: string,
  text: string,
): Promise<TextResult> {
  const t = tokenizeText(text)
  let unresolved: string[] = []
  let resolved = t.words.length

  if (client && t.words.length > 0) {
    const got = await unresolvedWords(client, t.words)
    if (got) {
      unresolved = got
      resolved = t.words.length - got.length
    }
  }

  return {
    name,
    chars: text.length,
    totalWords: t.totalWords,
    uniqueRaw: t.uniqueRaw,
    candidates: t.words.length,
    resolved,
    coveragePct: t.words.length === 0 ? 0 : Math.round((resolved / t.words.length) * 1000) / 10,
    unresolved,
    diagnostics: t.diagnostics,
  }
}

/** 입력 경로 → 측정 대상 목록 (파일 1개 또는 디렉터리의 *.txt) */
function collectInputs(target: string): { name: string; text: string }[] {
  const st = statSync(target)
  if (st.isFile()) {
    return [{ name: basename(target), text: readFileSync(target, 'utf8') }]
  }
  return readdirSync(target)
    .filter((f) => f.toLowerCase().endsWith('.txt'))
    .sort()
    .map((f) => ({ name: f, text: readFileSync(join(target, f), 'utf8') }))
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`
}

async function main() {
  const args = process.argv.slice(2)
  const asJson = args.includes('--json')
  const target = resolve(args.find((a) => !a.startsWith('--')) ?? join(__dirname, 'sample-talk.txt'))

  const client = serviceClient()
  if (!client) {
    console.error('! apps/web/.env.local 의 SUPABASE_SERVICE_ROLE_KEY 없음 — 토큰화만 측정합니다.')
  }

  const inputs = collectInputs(target)
  if (inputs.length === 0) {
    console.error(`측정할 .txt 가 없습니다: ${target}`)
    process.exitCode = 1
    return
  }

  const results: TextResult[] = []
  for (const input of inputs) {
    results.push(await measureOne(client, input.name, input.text))
  }

  if (asJson) {
    console.log(JSON.stringify({ target, results }, null, 2))
    return
  }

  // ── 편별 ──
  console.log(`\n코퍼스: ${target}  (${inputs.length}편)\n`)
  console.log('편'.padEnd(38) + '자'.padStart(9) + '후보'.padStart(8) + '해석'.padStart(8) + '커버리지'.padStart(10))
  console.log('─'.repeat(73))
  for (const r of results) {
    console.log(
      r.name.slice(0, 36).padEnd(38) +
        r.chars.toLocaleString().padStart(9) +
        String(r.candidates).padStart(8) +
        String(r.resolved).padStart(8) +
        pct(r.coveragePct).padStart(10),
    )
  }

  // ── 합산 ──
  const totalCandidates = results.reduce((a, r) => a + r.candidates, 0)
  const totalResolved = results.reduce((a, r) => a + r.resolved, 0)
  const totalChars = results.reduce((a, r) => a + r.chars, 0)
  const overall = totalCandidates === 0 ? 0 : (totalResolved / totalCandidates) * 100
  console.log('─'.repeat(73))
  console.log(
    '합계'.padEnd(38) +
      totalChars.toLocaleString().padStart(9) +
      String(totalCandidates).padStart(8) +
      String(totalResolved).padStart(8) +
      pct(overall).padStart(10),
  )

  // ── 사전 갭 (편 전체 합집합 · 빈출 순) ──
  const gapCount = new Map<string, number>()
  for (const r of results) {
    for (const w of r.unresolved) gapCount.set(w, (gapCount.get(w) ?? 0) + 1)
  }
  const gaps = [...gapCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  // ── 갭을 조치별로 분류 (Admin /admin/pending-words 와 같은 규칙) ──
  //   등재해야 할 것과, 등재하면 안 되는 것(철자 변이 = 해석기 버그)이 섞여 있다.
  //   후보는 표제어 직접 존재가 아니라 **해석 가능성**으로 묻는다 (굴절형 미스 방지).
  const candidates = [...new Set(gaps.flatMap(([w]) => triageCandidates(w)))]
  const resolvable = new Set<string>(candidates)
  if (client && candidates.length > 0) {
    const notResolved = await unresolvedWords(client, candidates)
    for (const w of notResolved ?? []) resolvable.delete(w)
  }
  const byBucket = new Map<PendingBucket, [string, number][]>()
  for (const g of gaps) {
    const b = classifyPending(g[0], resolvable)
    if (!byBucket.has(b)) byBucket.set(b, [])
    byBucket.get(b)!.push(g)
  }

  console.log(`\n사전 갭 ${gaps.length}종 — 조치별:`)
  const buckets = (Object.keys(BUCKET_META) as PendingBucket[]).sort(
    (a, b) => BUCKET_META[a].priority - BUCKET_META[b].priority,
  )
  for (const b of buckets) {
    const items = byBucket.get(b) ?? []
    if (items.length === 0) continue
    console.log(`\n  [${BUCKET_META[b].label}] ${items.length}종 — ${BUCKET_META[b].action}`)
    for (const [w, n] of items.slice(0, 30)) console.log(`    ${String(n).padStart(3)}편  ${w}`)
    if (items.length > 30) console.log(`    … 외 ${items.length - 30}종`)
  }
  const variantCount = (byBucket.get('spelling_variant') ?? []).length
  if (variantCount > 0) {
    console.log(
      `\n  ⚠ 철자 변이 ${variantCount}종 — 사전에 넣지 말 것. resolve_dict_headword 의 변이 매핑 구멍이다.`,
    )
  }

  // ── 토큰화 처리 내역 합산 (누수 진단) ──
  const d = results.reduce(
    (acc, r) => {
      for (const k of Object.keys(acc) as (keyof TokenizationDiagnostics)[]) {
        acc[k] += r.diagnostics[k]
      }
      return acc
    },
    {
      contractionsResolved: 0, hyphenCompounds: 0, numericDropped: 0, diacriticsFolded: 0,
      bracketMarkers: 0, speakerLabels: 0, stopwordsRemoved: 0, truncated: 0,
    } as TokenizationDiagnostics,
  )
  console.log('\n토큰화 처리 내역 (합산):')
  console.log(`  축약형 복원 ${d.contractionsResolved} · 하이픈 ${d.hyphenCompounds} · 숫자결합 제외 ${d.numericDropped}`)
  console.log(`  발음기호 ${d.diacriticsFolded} · 전사마커 ${d.bracketMarkers} · 화자라벨 ${d.speakerLabels}`)
  console.log(`  기능어 제외 ${d.stopwordsRemoved} · 상한절단 ${d.truncated}${d.truncated > 0 ? '  ← 누수! 상한을 올리거나 본문을 나눌 것' : ''}`)
  console.log('')
}

void main()
