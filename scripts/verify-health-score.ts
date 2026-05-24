// scripts/verify-health-score.ts
//
// /admin/vrl 사전DB 종합 모니터링 v3 — Step 2 health-score-v2 실측 검증.
//
// 사용법:
//   pnpm exec tsx scripts/verify-health-score.ts
//
// 출력:
//   - 9 차원 점수 (각 status)
//   - 4 책임 (R1-R4) 점수 + factors
//   - Pipeline Fitness (R3 1.3 가중)
//   - Overall (가중 평균) + status
//
// 검증 항목:
//   ✅ Overall ≈ 50-55? (실측 확인)
//   ✅ R3 최저 (VCB-VRL 미통합)
//   ✅ 차원 status 분포 (critical/warning/ok/excellent)

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

import { fetchDictSnapshotRaw } from '../apps/web/src/lib/admin/dict/queries'
import {
  composeOverallHealth,
  DIMENSION_WEIGHTS,
} from '../apps/web/src/lib/admin/dict/health-score-v2'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local 우선순위 (dict-common.mjs 와 동일)
const ENV_CANDIDATES = [
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../apps/web/.env.local'),
]
for (const p of ENV_CANDIDATES) {
  if (existsSync(p)) dotenv.config({ path: p, override: false })
}

const URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!URL || !KEY) {
  console.error('  ✗ env 누락 — NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  console.error(`    검색 경로: ${ENV_CANDIDATES.join(' / ')}`)
  process.exit(1)
}

const client = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const STATUS_ICON: Record<string, string> = {
  excellent: '🟢',
  ok: '🟢',
  warning: '🟡',
  critical: '🔴',
}

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pct(r: number): string {
  return `${(r * 100).toFixed(1)}%`
}

async function main() {
  console.log('\n📊 사전DB 종합 헬스 검증 (health-score-v2)')
  console.log('─'.repeat(70))

  const t0 = Date.now()
  const raw = await fetchDictSnapshotRaw(client)
  // Step 3 (defects/evolution) 미작성 — 빈 배열 주입 (overallScore 영향 없음)
  const snap = composeOverallHealth(raw, [], [])
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  console.log(`fetch + score: ${elapsed}s\n`)

  // ─── Overall ─────────────────────────────────────────────
  console.log('═'.repeat(70))
  console.log(
    `Overall ${STATUS_ICON[snap.overallStatus]} ${snap.overallScore} / 100 — ${snap.overallStatus.toUpperCase()}`,
  )
  console.log('═'.repeat(70))

  // ─── 9 차원 ─────────────────────────────────────────────
  console.log('\n[ 9 Dimensions ]')
  for (const d of snap.dimensions) {
    const w = (DIMENSION_WEIGHTS[d.id] * 100).toFixed(0)
    console.log(
      `  ${STATUS_ICON[d.status]} ${d.label.padEnd(22)} ${String(d.score).padStart(3)} / 100  ${bar(d.score)}  w=${w}%`,
    )
    console.log(`     └ ${d.summary}`)
  }

  // ─── 4 책임 ─────────────────────────────────────────────
  console.log('\n[ 4 Responsibilities ]')
  for (const r of snap.responsibilities) {
    console.log(
      `\n  ${STATUS_ICON[r.status]} ${r.id} — ${r.title.replace(/^R\d — /, '')}`,
    )
    console.log(`     score: ${r.score} / 100  ${bar(r.score)}`)
    console.log(`     ${r.description}`)
    for (const f of r.factors) {
      const fScorePct = Math.round(f.score * 100)
      const wPct = (f.weight * 100).toFixed(0)
      console.log(
        `       • ${f.label.padEnd(40)} ${String(fScorePct).padStart(3)}%  w=${wPct}%`,
      )
      console.log(`         └ ${f.evidence}`)
    }
    if (r.affectedByDefects.length > 0) {
      console.log(`     ⚠ defects: ${r.affectedByDefects.join(', ')}`)
    }
  }

  // ─── Raw 핵심 메트릭 ─────────────────────────────────────
  console.log('\n[ Raw Critical Metrics ]')
  const c = raw.coverage
  console.log(`  total            : ${c.total.toLocaleString()}`)
  console.log(`  meaning_ko       : ${pct(c.meaningKo.ratio)} (${c.meaningKo.filled.toLocaleString()})`)
  console.log(`  cefr_confidence  : ${pct(c.cefrConfidence.ratio)} 🚨`)
  console.log(`  register         : ${pct(c.register.ratio)} 🚨`)
  console.log(`  v_level (VRL)    : ${pct(raw.vrlClassification.classifiedRatio)}`)
  console.log(`  verified=true    : ${pct(c.verified.ratio)}`)
  console.log(`  vcb_vrl_integrated: ${raw.schemaPresence.vcbVrlIntegrated ? '✅' : '❌'}`)
  const audio = raw.learning.audioUrl
  console.log(`  audio_url        : ${audio ? pct(audio.ratio) : '컬럼 부재 🚨'}`)
  const verb = raw.linguistic.inflectionsByPos.find((p) => p.primaryPos === 'verb')
  const noun = raw.linguistic.inflectionsByPos.find((p) => p.primaryPos === 'noun')
  const adj = raw.linguistic.inflectionsByPos.find((p) => p.primaryPos === 'adjective')
  console.log(
    `  inflections      : verb ${pct(verb?.ratio ?? 0)} · noun ${pct(noun?.ratio ?? 0)} · adj ${pct(adj?.ratio ?? 0)}`,
  )

  // ─── 검증 어설션 ─────────────────────────────────────────
  console.log('\n[ Verification Assertions ]')
  const r3 = snap.responsibilities.find((r) => r.id === 'R3')!
  const otherResp = snap.responsibilities.filter((r) => r.id !== 'R3')
  const r3IsLowest = otherResp.every((o) => o.score >= r3.score)
  console.log(
    `  ${r3IsLowest ? '✅' : '⚠️'} R3 가 가장 낮은 책임 점수${r3IsLowest ? '' : ' — 본질 페인 가설 재검토 필요'}`,
  )

  const integrityScore = snap.dimensions.find((d) => d.id === 'integrity')!.score
  console.log(
    `  ${integrityScore === 100 ? '✅' : '⚠️'} Integrity = 100 (open concerns 0)`,
  )

  const overallInRange = snap.overallScore >= 30 && snap.overallScore <= 70
  console.log(
    `  ${overallInRange ? '✅' : '⚠️'} Overall ${snap.overallScore} ∈ [30, 70] (예상 50-55 범위 ± 20)`,
  )

  console.log('\n' + '─'.repeat(70))
  console.log('완료. 점수 정합 검토 후 Step 3 진행 결정.')
}

main().catch((e: unknown) => {
  console.error('❌ verify-health-score 실패:', e)
  process.exit(1)
})
