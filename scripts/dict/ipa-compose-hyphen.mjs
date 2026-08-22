// scripts/dict/ipa-compose-hyphen.mjs
//
// **하이픈 복합어의 IPA 를 조각 발음으로 합성한다.** 기본은 dry-run · `--commit` 으로 반영.
//
// 왜 이것만 하는가 (실측 2026-08-22):
// 기출 드레인이 넣은 낱말 중 `ipa` 가 빈 것 95개인데 **CMUdict 에 있는 것은 0개**다.
// 대부분 파생어(`monumentality`·`attentional`·`revalidated`)나 조어(`captology`·`cloudwork`)라
// 사전에 없다. 그런 낱말의 발음을 규칙으로 지어내면 **강세 위치가 자주 틀린다**
// (monument → monumentality 는 강세가 옮겨간다). 학습용 사전에서 틀린 발음은 빈칸보다 나쁘다.
//
// 반면 **하이픈 복합어는 조각을 그대로 이어 읽는다** — `non-market` = `non` + `market`.
// 조각이 모두 CMUdict 에 있는 것만 합성한다. 나머지는 **비워 둔다**(추측하지 않는다).
// 드레인 행뿐 아니라 사전 전체의 하이픈 낱말이 대상이다 — 같은 근거가 같은 방식으로 적용된다.
//
// 실행:
//   pnpm dlx tsx scripts/dict/ipa-compose-hyphen.mjs
//   pnpm dlx tsx scripts/dict/ipa-compose-hyphen.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const cmu = JSON.parse(fs.readFileSync('scripts/dict/data/cmudict/cmudict-enrich.json', 'utf8'))

/** `/ˈeɪz/` 형태에서 슬래시를 벗긴다. */
const bare = (s) => String(s ?? '').replace(/^\/|\/$/g, '')

/**
 * CMUdict 의 **단독 표제어 발음이 접두사로 쓰일 때와 다른** 조각의 교정표.
 * 합성 대상 943개의 첫 조각을 전수로 훑어 확인한 결과 어긋나는 것은 `re` 하나였다(2026-08-22):
 * CMUdict `re` = /ɹˈeɪ/ (음계 '레') 인데 접두사 `re-` 는 /ɹˈi/ 다.
 * 나머지 상위 조각(non·self·cross·co·pre·post·anti·multi·over…)은 접두사 발음과 같아 손대지 않는다.
 * **새 조각을 추가할 때는 반드시 실제 발음을 확인하고 넣을 것** — 틀린 발음은 빈칸보다 나쁘다.
 */
const PREFIX_FIX = { re: 'ɹˈi' }

/**
 * 조각 발음을 이어 붙인다.
 * 앞 조각의 **1차 강세(ˈ)는 2차 강세(ˌ)로 낮춘다** — 복합어는 강세가 하나가 주가 되고
 * 앞부분은 약해진다(non-MARKET). 그대로 두면 강세가 둘로 읽혀 틀린 발음이 된다.
 */
function compose(parts) {
  const last = parts.length - 1
  return (
    '/' +
    parts
      .map((p, i) => {
        const ipa = PREFIX_FIX[p] ?? bare(cmu[p]?.ipa)
        return i === last ? ipa : ipa.replace(/ˈ/g, 'ˌ')
      })
      .join('-') +
    '/'
  )
}

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, ipa, field_provenance')
    .is('ipa', null)
    .like('word', '%-%')
    // ⚠️ order 없이 range 로 페이징하면 순서가 보장되지 않아 **실행마다 대상이 달라진다**
    //   (실측: 980 → 943 → 952). 같은 함정을 csat-dict-health.mjs 에서도 겪었다.
    .order('word', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error('조회 실패: ' + error.message)
  rows.push(...data)
  if (data.length < 1000) break
}

const doable = rows.filter((r) => {
  const parts = r.word.split('-')
  return parts.length >= 2 && parts.every((p) => p && cmu[p]?.ipa)
})
const skipped = rows.length - doable.length

console.log(`ipa 빈 하이픈 낱말 ${rows.length} · 조각이 모두 CMUdict 에 있음 ${doable.length} · 합성 불가 ${skipped}`)
for (const r of doable.slice(0, 12)) console.log(`  ${r.word.padEnd(20)} → ${compose(r.word.split('-'))}`)
if (doable.length > 12) console.log(`  … 외 ${doable.length - 12}개`)

if (!commit) {
  console.log('\ndry-run — 쓰지 않았다. 반영하려면 --commit')
  process.exit(0)
}

let done = 0
for (const r of doable) {
  const { error } = await db
    .from('shared_dictionary')
    .update({
      ipa: compose(r.word.split('-')),
      field_provenance: {
        ...(r.field_provenance ?? {}),
        ipa: 'cmudict-hyphen-composed',
      },
      updated_at: new Date().toISOString(),
    })
    .eq('word', r.word)
  if (error) throw new Error(`${r.word} 갱신 실패: ` + error.message)
  done += 1
}
console.log(`\n반영 ${done}개`)
