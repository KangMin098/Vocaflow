// scripts/extract-coverage/export-corpus.ts
//
// 측정 코퍼스를 **실 발행 콘텐츠**에서 뽑는다 — 회차마다 같은 규칙으로 같은 표본을.
//
// 왜 자작 코퍼스가 아니라 이것인가:
//   8회차의 9섹터 코퍼스는 내가 쓴 글이라, 내가 아는 함정만 들어 있다. 학습자가 실제로
//   만나는 글은 발행 파이프라인(ACP)이 실어 온 것이고, 그쪽이 진짜 분포다.
//   여기서 뽑은 표본은 **라이선스가 확인된 것만** 담는다:
//     · `display_only` 는 제외 (CC-BY-ND — 파생 금지라 학습자원 생성 대상이 아니다)
//     · 나머지는 PD(US Gov) · CC-BY · CC-BY-SA — 로컬 측정·학습자원 생성 모두 허용
//   파일은 `corpus/` 에 떨어지고 그 디렉터리는 git 미추적이다(원문을 저장소에 넣지 않는다).
//
// 표본 규칙 (재현 가능해야 하므로 무작위를 쓰지 않는다):
//   소스별로 **본문이 긴 순서**로 최대 N편. 길이 상한을 두어 한 편이 표본을 지배하지 않게 한다.
//   → 같은 DB 상태면 항상 같은 표본이 나온다.
//
// 사용:
//   npx tsx scripts/extract-coverage/export-corpus.ts            # 소스당 2편 · 편당 12,000자
//   npx tsx scripts/extract-coverage/export-corpus.ts 3 20000    # 소스당 3편 · 편당 20,000자

import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ENV_PATH = resolve(__dirname, '../../apps/web/.env.local')
const OUT_DIR = resolve(__dirname, 'corpus')

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
    console.error('apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 필요하다.')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/** 파일명 안전화 — 리포트의 "편" 이름이 되므로 읽을 수 있어야 한다 */
function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48)
    .toLowerCase()
}

async function main() {
  const perSource = Number(process.argv[2] ?? 2)
  const maxChars = Number(process.argv[3] ?? 12_000)
  const client = serviceClient()

  // display_only 는 파생 금지(ND) — 학습자원 생성 대상이 아니므로 측정 표본에서도 뺀다.
  const { data, error } = await client
    .from('library_articles')
    .select('id, source, title, content, license, display_only, article_v_level, word_count')
    .eq('status', 'published')
    .eq('display_only', false)
    .not('content', 'is', null)

  if (error) {
    console.error('조회 실패:', error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as Array<{
    id: string
    source: string
    title: string | null
    content: string
    license: string | null
    article_v_level: number | null
  }>

  // 소스별 상위 N (본문 길이 내림차순 · 동률은 id 로 고정 → 재현 가능)
  const bySource = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!bySource.has(r.source)) bySource.set(r.source, [])
    bySource.get(r.source)!.push(r)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  // 이전 표본을 남기면 회차 간 비교가 깨진다 — 매번 갈아엎는다.
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.txt')) unlinkSync(join(OUT_DIR, f))
  }

  let files = 0
  let chars = 0
  const manifest: string[] = ['# 코퍼스 표본 (export-corpus.ts 생성 · git 미추적)', '']

  for (const [source, list] of [...bySource.entries()].sort()) {
    const picked = list
      .sort((a, b) => b.content.length - a.content.length || a.id.localeCompare(b.id))
      .slice(0, perSource)
    for (const [i, r] of picked.entries()) {
      const body = r.content.slice(0, maxChars)
      const name = `${source}-${i + 1}-${slug(r.title ?? r.id)}.txt`
      writeFileSync(join(OUT_DIR, name), body, 'utf8')
      files++
      chars += body.length
      manifest.push(
        `- ${name} — ${source} · ${r.license ?? 'license?'} · V${r.article_v_level ?? '?'} · ${body.length}자`,
      )
    }
  }

  writeFileSync(join(OUT_DIR, 'MANIFEST.md'), manifest.join('\n') + '\n', 'utf8')
  console.log(`\n표본 ${files}편 · ${chars.toLocaleString()}자 · 소스 ${bySource.size}종 → ${OUT_DIR}`)
  console.log(`측정: npx tsx scripts/extract-coverage/measure.ts scripts/extract-coverage/corpus\n`)
}

void main()
