// scripts/compose/bench-text.mjs
//
// ACP §20 — **외부 플랫폼 산출물을 우리 계측기로 재는 벤치마크.**
//
// 왜 필요한가: "글로벌 수준보다 상위" 를 목표로 삼으려면 그 수준이 몇인지 알아야 한다.
// 정의 없이 개선하면 반증 불가능한 자기만족이 된다. 그래서 News in Levels·Breaking News
// English 같은 검증된 레벨별 콘텐츠를 **우리 산출물과 똑같은 지표로** 재서 기준선을 만든다.
//
// 재는 것은 drain-review 와 같다(어수·문장·문단·밴드 초과). 다른 점은 DB 에 없는 텍스트를
// 파일에서 읽고, 어휘를 그 자리에서 토큰화해 사전을 조회한다는 것뿐이다.
//
// ⚠️ 외부 텍스트는 **측정에만 쓰고 저장하지 않는다** — 재저작 파이프라인의 본문 비보관
//   원칙과 같다. 이 스크립트는 아무것도 쓰지 않는다.
//
// 실행: pnpm dlx tsx scripts/compose/bench-text.mjs --file <파일> --band elementary [--label 이름]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (k) => {
  const i = process.argv.indexOf('--' + k)
  return i >= 0 ? process.argv[i + 1] : null
}

const { createClient } = await import('@supabase/supabase-js')
const { GRADE_BANDS, profileBand } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const file = arg('file')
const band = arg('band') ?? 'elementary'
const label = arg('label') ?? path.basename(file ?? '')
if (!file) throw new Error('--file <파일> 필요')
if (!GRADE_BANDS[band]) throw new Error('알 수 없는 밴드: ' + band)

const text = fs.readFileSync(path.resolve(file), 'utf8').trim()

const paragraphs = text
  .split(/\n\s*\n+/)
  .map((p) => p.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
const perParagraph = paragraphs.map((p) =>
  p
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean),
)
const sentences = perParagraph.flat()
const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length)
const words = text.split(/\s+/).filter(Boolean).length

// 어휘 — 소문자 알파벳 토큰만. 사전에 없는 것은 판정 불가로 따로 센다(쉽다고 하지 않는다).
const tokens = [
  ...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z' ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  ),
]
const dict = []
for (let i = 0; i < tokens.length; i += 400) {
  const { data } = await db
    .from('shared_dictionary')
    .select('word,v_level')
    .in('word', tokens.slice(i, i + 400))
  dict.push(...(data ?? []))
}
const vmap = new Map(dict.map((d) => [d.word, d.v_level]))
const profile = profileBand(
  tokens.map((w) => ({ word: w, v: vmap.get(w) ?? null })),
  band,
)

const med = (xs) => {
  const a = [...xs].sort((x, y) => x - y)
  return a.length ? a[Math.floor(a.length / 2)] : 0
}

const g = GRADE_BANDS[band]
console.log('▸ ' + label + '  [' + g.label + ' 밴드 V≤' + g.vRange.max + ']')
console.log(
  '  ' + words + '어 · ' + sentences.length + '문장 · ' + paragraphs.length + '문단 · 평균 ' +
    (sentences.length ? Math.round((words / sentences.length) * 10) / 10 : 0) + '어절',
)
console.log(
  '  첫 문장 ' + (lens[0] ?? 0) + ' · 중앙 ' + med(lens) + ' · 최장 ' +
    (lens.length ? Math.max(...lens) : 0) + ' · 문단별 ' + perParagraph.map((s) => s.length).join('·'),
)
console.log(
  '  밴드 초과 ' + (profile.aboveShare * 100).toFixed(1) + '% (판정 ' + profile.known +
    ' · 사전에 없음 ' + profile.unknown + ')',
)
if (profile.offenders.length) {
  console.log(
    '  넘는 단어: ' + profile.offenders.slice(0, 8).map((o) => o.word + '(V' + o.v + ')').join(' · '),
  )
}
