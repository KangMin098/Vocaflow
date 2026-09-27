// scripts/csat/orphan-items-snapshot.mjs
//
// **원천을 잃은 교재 문항을 지우기 전에 되돌릴 근거를 남긴다.** 읽기 전용.
//
// ── 왜 ───────────────────────────────────────────────────────────────
// 2026-09-24 에 gutenberg 40,519행을 지웠더니 `csat_dcp_items` 의 문항 46,031개가
// 원천을 잃었다(가리키던 글 9,672개가 **100% 그 gutenberg** 였다 — 전수 귀속).
//
// **그 문항들은 못 쓰는 게 아니다.** `payload` 에 지문·문장이 들어 있어 원천 없이도
// 렌더된다 — 즉 퇴출 사유에 해당하는 19세기 대화문·셰익스피어 대사가 교재 재고에
// 그대로 남아 있다. 사용자가 삭제를 지시했다(2026-09-24).
//
// ── 무엇을 담나 ──────────────────────────────────────────────────────
// gutenberg 퇴출 때와 달리 **본문(payload)을 담는다.** 그때는 원문이 PD 라 다시 받을
// 수 있었지만, 이 문항들은 **LLM 이 만든 산출물**이라 어디서도 다시 못 받는다. 약 51 MB.
// `.agent-logs/` 는 gitignore 라 저장소가 커지지 않는다.
//
// 되살려도 `ref_id` 가 가리키던 글은 없다. 이 파일은 **「문항을 다시 넣는」 근거**이지
// 「원천을 되살리는」 근거가 아니다.
//
// ── OFFSET 페이지네이션을 쓰지 않는다 (두 번 데였다) ────────────────
//   1) `library_articles` 를 range 로 훑어 live 집합을 만들려 했다 → 깊은 OFFSET 이
//      8초 timeout(68,604행).
//   2) `csat_dcp_items` 를 ref_id 16구간으로 쪼개 range 로 훑었다 → 한 구간이 약 55,000행이라
//      역시 timeout. payload 를 실어 나르므로 더 무겁다.
//   지금은 **삭제된 id 를 200개씩 나눠 in(ref_id, ...) 로 직접 조회**한다 —
//   인덱스를 타고 OFFSET 이 없다.
//
// 사용:
//   node --tls-max-v1.2 scripts/csat/orphan-items-snapshot.mjs
//   node --tls-max-v1.2 scripts/csat/orphan-items-snapshot.mjs --out <경로>

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: 'apps/web/.env.local', quiet: true })

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const OUT = arg('out', `.agent-logs/orphan-items-${STAMP}.json`)
const SRC = arg('deleted', '.agent-logs/retire-gutenberg-20260923.json')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const deleted = new Set(JSON.parse(readFileSync(SRC, 'utf8')).items.map((x) => x.id))
console.log(`삭제된 gutenberg id ${deleted.size.toLocaleString()}개`)

const ids = [...deleted]
const CHUNK = 200
const orphans = []
for (let i = 0; i < ids.length; i += CHUNK) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, kind, ref_id, type, item_role, payload, answer_key, paragraph_idx, v_level, created_at')
    .eq('kind', 'article')
    .in('ref_id', ids.slice(i, i + CHUNK))
  if (error) throw error
  orphans.push(...data)
  if ((i / CHUNK) % 20 === 0) {
    process.stdout.write(
      `\r  ${i.toLocaleString()}/${ids.length.toLocaleString()} · 고아 ${orphans.length.toLocaleString()}`,
    )
  }
}
process.stdout.write('\n')

const tally = (f) => {
  const m = new Map()
  for (const r of orphans) m.set(f(r) ?? '(없음)', (m.get(f(r) ?? '(없음)') ?? 0) + 1)
  return Object.fromEntries([...m].sort((a, b) => b[1] - a[1]))
}

const snapshot = {
  contract: 'orphan-items-snapshot/v1',
  takenAt: new Date().toISOString(),
  reason: 'gutenberg 퇴출(2026-09-24)로 원천을 잃은 교재 문항. 사용자 지시로 삭제하기 전의 스냅샷.',
  deletedSourceSnapshot: SRC,
  orphans: orphans.length,
  distinctRefs: new Set(orphans.map((r) => r.ref_id)).size,
  byType: tally((r) => r.type),
  byRole: tally((r) => r.item_role),
  byVLevel: tally((r) => r.v_level),
  cascade: {
    note: '삭제 시 함께 지워지는 것 (2026-09-24 실측)',
    csat_item_reviews: 414,
    csat_item_state: 127,
    csat_item_attempts: 0,
    attemptsNote: '학습자 풀이 기록은 0건 — 수요 측 데이터는 다치지 않는다',
  },
  limits: [
    'article 문항 전수를 훑지 않았다 — 삭제된 gutenberg id 를 열쇠로 역조회했다. ' +
      '그 id 집합 밖의 고아가 있다면 여기 없다(2026-09-24 전수 귀속에서 0건이었다).',
    '되살려도 ref_id 가 가리키던 글은 없다.',
  ],
  items: orphans,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(snapshot, null, 1))
console.log(`\n고아 문항 ${orphans.length.toLocaleString()} · 가리키던 글 ${snapshot.distinctRefs.toLocaleString()}`)
console.log('유형:', JSON.stringify(snapshot.byType))
console.log(`→ ${OUT}`)
