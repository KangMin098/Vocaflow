// scripts/csat/build-choice-polarity.mjs
//
// **긍정형 발문 문항 목록**을 굽는다 — `apps/web/src/lib/csat/choice-polarity.json`.
//
// 왜 필요한가: 선택≠참거짓 유형(어법 · 어휘 · 안내문 · 내용 일치 · 도표)에서 화면은 정답 아닌 선지를 「내용은 맞음」으로 그린다.
// 그런데 「일치하는 것은?」 · 「(A)(B)(C) … 가장 적절한 것은?」 처럼 발문이 긍정형이면 **오답이 틀린 진술**이다
// (2026-10-11 실측 136문항). 판정에는 발문이 필요한데, 학습자 쪽 뷰는 발문 원문을 일부러 숨긴다
// (`20260925120000_csat_items_public_hide_stem`). 그래서 발문 대신 **문항 id 목록만** 커밋한다.
//
// 판정 규칙은 드레인 validate 와 같은 함수(`lib-analysis-rules.mjs` 의 `stemPositive`)를 쓴다.
// 신선도: `apps/web/src/lib/csat/__tests__/choice-polarity-fresh.integration.test.ts` 가 DB 로 다시 센다.
//
//   node scripts/csat/build-choice-polarity.mjs           (검사만 — 바뀌는 수를 출력)
//   node scripts/csat/build-choice-polarity.mjs --write   (파일을 쓴다)
//
// 재실행 안전: 같은 DB 상태면 같은 파일을 쓴다(id 정렬).

import fs from 'node:fs'
import path from 'node:path'
import { CHOICE_TRUTH_TYPES, stemPositive } from './lib-analysis-rules.mjs'
import { isKiceExam } from './lib-exam-id.mjs'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const WRITE = process.argv.includes('--write')
const OUT = path.resolve('apps/web/src/lib/csat/choice-polarity.json')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('csat_items')
    .select('id, type_id, stem')
    .eq('in_scope', true)
    .in('type_id', [...CHOICE_TRUTH_TYPES])
    .order('id')
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  rows.push(...data)
  if (data.length < 1000) break
}

// 두 집합을 **일부러 함께** 굽는다 — 학평 문항 화면도 같은 판정이 필요하다. 수는 집합별로 갈라 보인다.
const positive = rows.filter((r) => stemPositive(r.stem)).map((r) => r.id).sort()
const byType = {}
for (const r of rows) {
  if (!stemPositive(r.stem)) continue
  const key = `${isKiceExam(r.id) ? 'kice' : 'hakpyeong'}:${r.type_id}`
  byType[key] = (byType[key] ?? 0) + 1
}

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).positive ?? [] : []
const added = positive.filter((id) => !prev.includes(id)).length
const removed = prev.filter((id) => !positive.includes(id)).length
console.log(`선택≠참거짓 유형 ${rows.length}문항 중 긍정형 ${positive.length} ${JSON.stringify(byType)} · 이전 대비 +${added} −${removed}`)

if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify({ rule: 'stemPositive (scripts/csat/lib-analysis-rules.mjs)', positive }, null, 1) + '\n')
  console.log(`→ ${path.relative(process.cwd(), OUT)}`)
} else {
  console.log('(검사만 — --write 로 쓴다)')
}
