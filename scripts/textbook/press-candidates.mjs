// scripts/textbook/press-candidates.mjs
//
// **⑧ 조판 후보 — 찍을 권과 권마다의 차단 사유를 낸다.**
//
// ⚠️ **이름에 `drain` 을 안 쓴다.** 이 저장소에서 「드레인」은 3단 계약
//   (export → **에이전트가 청크를 채움** → `import --commit`)을 뜻하는 말이고, 조판은
//   결정적이라 에이전트 몫이 없다. `press-drain-export` 로 부르면 관리자가 「여기서도
//   Claude Code 배치를 돌리면 되겠다」고 읽는다 — 회귀(`line-screens` 의 「결정적 공정의
//   절차는 배치 몫을 주장하지 않는다」)가 처음 지은 이름에서 정확히 그 오해를 잡았다.
//   계약은 **후보 산출 + 사람 승인 + 조판**이다.
//
// ── 왜 이 스크립트가 생겼나 (2026-09-23 · DD-69 → DD-72) ────────────
// 공정 여덟 중 ③ 설계와 ⑧ 조판에만 드레인 계약이 없었다. ⑧ 은 `build-volume` ·
// `render-volume` 단발 실행뿐이고, 그 둘은 **청크도 원장도 없이** `--out` 파일을 덮어쓴다.
// 그래서 채점에서 B1(드레인 계약) · B2(재실행 안전)가 0 이었다.
//
// 조판은 결정적이라 「에이전트가 채우는 중간 단계」가 없다. 그래서 3단 드레인이 아니라
// **후보 산출 + 사람 승인 + 조판**으로 계약한다:
//
//   ① 이 스크립트            → scripts/textbook/press-candidates/<series>-<band>.json
//   ② 사람이 승인            → 차단 사유 0 · 못 잰 것 0 인 권만 대상
//   ③ build-volume / render-volume  → 찍고 colophon.publish 에 판정을 남긴다
//
// **재실행 안전.** DB 를 **읽기만 한다.** 같은 시점에 몇 번을 돌려도 같은 파일이 나오고,
// 이미 승인된 권은 `approvable: false`(already-approved)로 빠진다. 건너뛴 수를 출력한다.
//
// 판정은 `@vocaflow/library-pipeline` 의 `judgePressGate` 가 한다 — **화면과 같은 함수**다.
// 여기서 따로 세면 드레인과 ⑧ 화면이 다른 수를 말하고, 그때부터 둘 다 못 믿는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/press-candidates.mjs
//   ... --series vocab          (그 시리즈만)
//   ... --band 6                (그 밴드만)
//   ... --json                  (표 대신 JSON 한 덩어리만 — 다른 스크립트가 먹기 좋게)

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv } from './volume-pool.mjs'

loadEnv()

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const JSON_ONLY = process.argv.includes('--json')

const { createClient } = await import('@supabase/supabase-js')
const { judgePressGate, summarizePressGate } = await import('@vocaflow/library-pipeline/textbook-press-gate')
const { brandFingerprint } = await import('@vocaflow/library-pipeline')

const WORK = path.resolve('scripts/textbook/press-candidates')
fs.mkdirSync(WORK, { recursive: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local)')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const ONLY_SERIES = arg('series')
const ONLY_BAND = arg('band') ? Number(arg('band')) : null

// ── 목차 스냅샷은 파일에서 읽는다 ───────────────────────────────────
// 학습자 상세면이 읽는 바로 그 파일이다. 여기서 다른 것을 보면 「나갈 수 있다」고 해 놓고
// 학습자 화면에는 목차가 없는 일이 난다(실측 2026-09-23: vocab·syntax 가 그 상태였다).
const CONTENTS = path.resolve('apps/web/src/lib/textbook/volume-contents.json')
let bakedSeries = new Set()
try {
  const snap = JSON.parse(fs.readFileSync(CONTENTS, 'utf8'))
  for (const [k, v] of Object.entries(snap.volumes ?? {})) {
    bakedSeries.add(v.seriesId ?? (/^\d+$/.test(k) ? 'reading' : k.split(':')[0]))
  }
} catch (e) {
  // ⚠️ 못 읽었으면 **「전부 있다」로 가정하지 않는다** — 그러면 목차 없는 권이 통과한다.
  console.error(`목차 스냅샷을 못 읽었다(${e.message}) — 모든 시리즈를 「없음」으로 본다`)
  bakedSeries = new Set()
}

const { data, error } = await db
  .from('textbook_volume_renders')
  .select(
    'band, series, volume_title, step, items, auto_passed, auto_total, ' +
      'explained_batch, explained_rule, brand_fingerprint, colophon, rendered_at',
  )
  .order('band')

if (error) {
  console.error(`조판 기록을 못 읽었다: ${error.message}`)
  process.exit(2)
}

const current = brandFingerprint()

const rows = (data ?? [])
  .map((r) => {
    const series = r.series ?? 'reading'
    const pr = r.colophon?.review?.personaReview ?? null
    return {
      series,
      band: r.band,
      step: r.step,
      title: r.volume_title,
      items: r.items,
      missingExplanations: Math.max(0, r.items - r.explained_batch - r.explained_rule),
      // settled 가 없는 옛 기록은 **못 잼**이다 — items - passed 로 떨어지면 「덜 봤다」가
      // 섞여 「봤는데 막혔다」와 구별이 사라진다.
      personaBlocked: pr && pr.settled != null ? Math.max(0, pr.settled - pr.passed) : null,
      autoPassed: r.auto_passed ?? 0,
      autoTotal: r.auto_total ?? 0,
      brandCurrent: r.brand_fingerprint === current,
      hasContents: bakedSeries.has(series),
      publishStatus: r.colophon?.publish?.status ?? null,
      renderedAt: r.rendered_at,
    }
  })
  .filter((r) => (ONLY_SERIES ? r.series === ONLY_SERIES : true))
  .filter((r) => (ONLY_BAND == null ? true : r.band === ONLY_BAND))

const judged = rows.map((r) => ({ ...r, verdict: judgePressGate(r) }))

// **이미 승인·발행된 권은 건너뛴다** — 재실행 안전의 증거이자, 같은 권을 두 번 승인 대상으로
// 올리지 않기 위해서다. 건너뛴 수를 반드시 출력한다.
const settled = judged.filter((r) => r.publishStatus === 'approved' || r.publishStatus === 'published')
const candidates = judged.filter((r) => !settled.includes(r))

const summary = summarizePressGate(rows)
const out = {
  generatedAt: new Date().toISOString(),
  brandFingerprint: current,
  filter: { series: ONLY_SERIES, band: ONLY_BAND },
  summary: { ...summary, skippedAlreadySettled: settled.length },
  volumes: candidates.map((r) => ({
    series: r.series,
    band: r.band,
    step: r.step,
    title: r.title,
    items: r.items,
    publishStatus: r.publishStatus,
    blockers: r.verdict.blockers,
    unmeasured: r.verdict.unmeasured,
    approvable: r.verdict.approvable,
    learnerHref: r.step == null ? null : `/library/textbooks/${r.series}/${r.step}`,
  })),
}

const name = `${ONLY_SERIES ?? 'all'}-${ONLY_BAND ?? 'all'}.json`
const file = path.join(WORK, name)
fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`)

if (JSON_ONLY) {
  console.log(JSON.stringify(out))
} else {
  console.log(`\n조판 후보 — ${path.relative(process.cwd(), file)}`)
  console.log(
    `권 ${summary.total} · 승인 대상 ${summary.approvable} · 막힘 ${summary.blocked} · 못 잼 ${summary.unmeasured}` +
      ` · 이미 승인/발행돼 건너뜀 ${settled.length}`,
  )
  for (const v of out.volumes) {
    const mark = v.approvable ? '○' : v.blockers.length ? '✗' : '?'
    const why = v.blockers.length ? v.blockers.join(' · ') : v.unmeasured.join(' · ') || '—'
    console.log(`  ${mark} ${v.series} V${v.band} ${v.title ?? ''} — ${why}`)
  }
  console.log(
    '\n다음: 차단 사유 0 · 못 잼 0 인 권만 사람이 승인한 뒤 build-volume → render-volume 을 돌린다.',
  )
}
