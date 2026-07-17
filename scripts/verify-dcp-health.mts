// scripts/verify-dcp-health.mts
//
// CTP DCP 도달성 헬스 체크 — 생성→매핑→처방 체인의 불변식을 실행 가능한 검증으로 codify (v06.232).
// 배경: v06.229/232 에서 "콘텐츠는 있으나 학습자 도달 불가"(비활성/미매칭 밴드) 결함을 잡았음.
//   동시 세션이 csat_stage_catalog(VIEW) 매핑·prescribe_today 를 다시 바꾸면 재발 가능 →
//   본 스크립트가 도달성 불변식을 지켜, 회귀 시 exit 1 로 알린다. dev 서버 비의존(service-role).
//
// 실행:  node_modules/.bin/tsx scripts/verify-dcp-health.mts   (CI/nightly 배선 가능 · 통과=exit 0)
//
// 불변식(상태 독립 — 학습자 데이터에 의존 X):
//   ① 카탈로그 밴드 S1~S4 각 ≥1 candidate (populated stage 에 빈 밴드 없음)
//   ② 도달 DCP(누적 밴드 ≤ 학습자밴드): S3 학습자 ≥ 100 items, S4 ≥ 300
//   ③ DCP ref 고아 0 (모든 ref_id 가 카탈로그에 등재)
//   (처방 practice E2E 는 stage 가변 상태 의존 → e2e/수동 검증 담당, 본 체크서 제외)

import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnv('apps/web/.env.local')
const url = env['NEXT_PUBLIC_SUPABASE_URL']
const key = env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const S3_MIN_REACHABLE = 100
const S4_MIN_REACHABLE = 300

const failures: string[] = []
const notes: string[] = []

/** 임의 SQL 을 rpc 없이 실행하기 위한 헬퍼 — PostgREST 로는 원시 SQL 불가하므로 뷰/테이블 쿼리로 조립. */
async function q<T>(builder: Promise<{ data: T | null; error: { message: string } | null }>, label: string): Promise<T | null> {
  const { data, error } = await builder
  if (error) {
    failures.push(`[${label}] 쿼리 실패: ${error.message}`)
    return null
  }
  return data
}

// ── ① 카탈로그 밴드 populated ──
const bandRows = await q<Array<{ stage_band: string }>>(
  db.from('csat_stage_catalog').select('stage_band'),
  'catalog',
)
if (bandRows) {
  const counts = new Map<string, number>()
  for (const r of bandRows) counts.set(r.stage_band, (counts.get(r.stage_band) ?? 0) + 1)
  for (const b of ['S1', 'S2', 'S3', 'S4']) {
    const n = counts.get(b) ?? 0
    if (n < 1) failures.push(`① 카탈로그 밴드 ${b} 비어 있음(candidate 0)`)
  }
  notes.push(`① 카탈로그: ${['S1', 'S2', 'S3', 'S4'].map((b) => `${b}:${counts.get(b) ?? 0}`).join(' ')}`)
}

// ── ②③ DCP 아이템 ↔ 카탈로그 밴드 조인 (도달 DCP + 고아) ──
// PostgREST 기본 1000행 한계 → range 페이지네이션으로 전량 수집(1374+ items).
async function fetchAllDcp(): Promise<Array<{ ref_id: string; kind: string }> | null> {
  const all: Array<{ ref_id: string; kind: string }> = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('csat_dcp_items')
      .select('ref_id, kind')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      failures.push(`[dcp] 쿼리 실패: ${error.message}`)
      return null
    }
    const page = (data ?? []) as Array<{ ref_id: string; kind: string }>
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all
}
const dcpRows = await fetchAllDcp()
const catRows = await q<Array<{ id: string; kind: string; stage_band: string }>>(
  db.from('csat_stage_catalog').select('id, kind, stage_band'),
  'catalog-join',
)
if (dcpRows && catRows) {
  const bandOf = new Map<string, string>() // `${kind}:${id}` → band
  for (const c of catRows) bandOf.set(`${c.kind}:${c.id}`, c.stage_band)

  let orphans = 0
  const reachAtOrBelow = new Map<number, number>() // learner band n → # items with itemBand ≤ n
  for (const it of dcpRows) {
    const band = bandOf.get(`${it.kind}:${it.ref_id}`)
    if (!band) {
      orphans += 1
      continue
    }
    const bn = Number.parseInt(band.slice(1), 10)
    for (let learner = bn; learner <= 4; learner++) {
      reachAtOrBelow.set(learner, (reachAtOrBelow.get(learner) ?? 0) + 1)
    }
  }
  // ③ 고아
  if (orphans > 0) failures.push(`③ DCP ref 고아 ${orphans}건(카탈로그 미등재 — 발행취소/삭제 의심)`)
  notes.push(`③ 고아: ${orphans}`)
  // ② 도달 하한 (S3=band≤3, S4=band≤4)
  const s3 = reachAtOrBelow.get(3) ?? 0
  const s4 = reachAtOrBelow.get(4) ?? 0
  if (s3 < S3_MIN_REACHABLE) failures.push(`② S3 학습자 도달 DCP ${s3} < ${S3_MIN_REACHABLE}(굶주림 회귀 의심)`)
  if (s4 < S4_MIN_REACHABLE) failures.push(`② S4 학습자 도달 DCP ${s4} < ${S4_MIN_REACHABLE}`)
  notes.push(`② 도달 DCP: S3=${s3} S4=${s4}`)
}

// (처방 E2E 는 학습자 stage 라는 가변 상태에 의존 → 표준 불변식에서 제외. 별도 e2e/수동 검증 담당.)

// ── 리포트 ──
console.log('CTP DCP 헬스 체크')
for (const n of notes) console.log(`  ${n}`)
if (failures.length) {
  console.log('\n❌ FAIL:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\n✅ PASS — 도달성 불변식 정상')
