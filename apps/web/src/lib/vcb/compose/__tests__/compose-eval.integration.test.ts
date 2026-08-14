// apps/web/src/lib/vcb/compose/__tests__/compose-eval.integration.test.ts
//
// 평가 러너 — 카탈로그 전 유형을 **실 DB** 로 드라이런하고 scorecard 매트릭스를 낸다.
//
// 이 파일이 목표(docs/VCB_REDESIGN.md §6)의 판정자다:
//   G1 시중 24종 생성 가능 · G2 모든 blueprint ≥ 0.80 · G3 선언 면 결측 0 ·
//   G4 unlock 이 빈도순 대비 우위 · G5 회귀 무해
//
// SERVICE_ROLE 키가 없으면 skip 된다. 단 **skip 은 안전이 아니라 사각지대**이므로
// (vitest.config.ts 주석의 2026-08-12 실측 사고) 콘솔에 skip 사유를 반드시 남긴다.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, beforeAll } from 'vitest'
import { BLUEPRINTS, catalogSummary, type BlueprintParams } from '../blueprints'
import { PASS_THRESHOLD, type Scorecard } from '../evaluate'
import { fetchPublishedWords } from '../resolve'
import { dryRun, type DryRunResult } from '../run'

const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const enabled = !!SUPA_URL && !!SUPA_KEY

if (!enabled) {
  console.warn(
    '[compose-eval] SKIP — NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재. ' +
      '이 러너가 돌지 않으면 blueprint 품질은 측정되지 않은 상태다.',
  )
}

// ── 실측 픽스처 (2026-08-14 확인) ───────────────────────────────────
// 코퍼스 유형은 실제 콘텐츠가 있어야 평가가 성립한다. 목차·문장이 있는 것으로 고정한다.
const FIXTURE = {
  /** Pride and Prejudice — 61 챕터, lbv 바인딩 있음 */
  book_id: 'ac506006-6147-4d23-8dba-72698eb7e9ae',
  /** 글 단어장 (ACP) — 40 단어 */
  article_set_id: '134fb98c-5f1e-45b1-84b9-b65192c7e90e',
  /** 런타임 검증 계정 — 학습자 상태 유형 */
  user_id: 'c02f0968-538e-4310-88f8-e91dec7746d1',
}

/** blueprint 별 드라이런 파라미터 — requires_params 를 실제 값으로 채운다. */
const PARAMS: Record<string, BlueprintParams> = {
  'freq-tier': { count: 500 },
  'exam-list': { tags: ['csat-prep-core-2k'], count: 500 },
  'curriculum-grade': { tags: ['kcurr2022_2'] },
  'academic-awl': {},
  'level-band': { v_level_min: 4, v_level_max: 7, count: 400 },
  'domain-specialty': { tags: ['moel_1.0'] },
  'exam-items': {},
  'root-etymology': { count: 800 },
  'word-family': { count: 300 },
  'pos-focus': { count: 300 },
  'topic-field': { themes: ['여행'], count: 300 },
  'synonym-cluster': { count: 300 },
  'antonym-pair': { count: 200 },
  confusable: { count: 300 },
  collocation: { count: 300 },
  'phrasal-idiom': { count: 200 },
  polysemy: { count: 200 },
  'rhyme-phonics': { count: 200 },
  'book-companion': { book_id: FIXTURE.book_id, count: 300 },
  'chapter-companion': { book_id: FIXTURE.book_id, chapter_from: 1, chapter_to: 3, count: 60 },
  'news-article': { text_ids: [FIXTURE.article_set_id], count: 40 },
  'script-media': { text_ids: [FIXTURE.article_set_id], count: 40 },
  'day-pacing': { days: 30, per_day: 20 },
  'mnemonic-story': { count: 300 },
  'picture-dict': { themes: ['동물'], count: 100 },
  'audio-only': { count: 200 },
  unlock: { book_id: FIXTURE.book_id, count: 200, user_id: FIXTURE.user_id },
  recycle: { book_id: FIXTURE.book_id, chapter_from: 1, chapter_to: 5, count: 80 },
  'facet-ladder': { count: 300 },
  'confusion-log': { user_id: FIXTURE.user_id, count: 60 },
  uncovered: { count: 400 },
}

interface Row {
  id: string
  taxon: string
  title: string
  status: string
  entries: number
  groups: number
  total: number
  passed: boolean
  metrics: Record<string, number>
  blockers: string[]
  warnings: string[]
  ms: number
  error?: string
  /** 고유 유형의 우위 증거 한 줄 */
  evidence?: string
}

const rows: Row[] = []
let client: SupabaseClient
let existingWords = new Set<string>()

function fmt(n: number): string {
  return n.toFixed(2)
}

function report(): string {
  const lines: string[] = []
  const summary = catalogSummary()
  lines.push('# VCB 컴포저 평가 — Round 결과')
  lines.push('')
  lines.push(
    `카탈로그 ${summary.total}종 (ready ${summary.by_status.ready} · partial ${summary.by_status.partial} · asset_gap ${summary.by_status.asset_gap} · data_gate ${summary.by_status.data_gate})`,
  )
  lines.push('')
  lines.push('| taxon | blueprint | 상태 | 항목 | 그룹 | fill | lvl | noise | novel | org | fit | value | **총점** | 판정 |')
  lines.push('|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|')
  for (const r of rows) {
    const m = r.metrics
    lines.push(
      `| ${r.taxon} | ${r.id} | ${r.status} | ${r.entries} | ${r.groups} | ${fmt(m['fill'] ?? 0)} | ${fmt(m['level_fit'] ?? 0)} | ${fmt(m['noise'] ?? 0)} | ${fmt(m['novelty'] ?? 0)} | ${fmt(m['organize'] ?? 0)} | ${fmt(m['blueprint_fit'] ?? 0)} | ${fmt(m['value'] ?? 0)} | **${fmt(r.total)}** | ${r.passed ? '✅' : '❌'} |`,
    )
  }
  lines.push('')
  lines.push('## 미달 원인')
  const failed = rows.filter((x) => !x.passed)
  if (failed.length === 0) lines.push('- 없음 — 전 유형 통과')
  for (const r of failed) {
    const cause = r.error ?? (r.blockers.length > 0 ? r.blockers.join(' / ') : '원인 미기록')
    lines.push(`- **${r.id}** (${fmt(r.total)}) — ${cause}`)
  }
  lines.push('')
  lines.push('## 경고 (발행은 되지만 알고 있어야 하는 것)')
  const warned = rows.filter((r) => r.warnings.length > 0)
  if (warned.length === 0) lines.push('- 없음')
  for (const r of warned) {
    lines.push(`- **${r.id}** — ${r.warnings.slice(0, 4).join(' · ')}`)
  }
  lines.push('')
  lines.push('## 고유 유형 우위 증거')
  for (const r of rows.filter((x) => UNIQUE_IDS.includes(x.id))) {
    lines.push(`- **${r.id}** — ${r.evidence ?? '증거 없음'}`)
  }
  lines.push('')
  lines.push(`_소요: ${rows.reduce((s, r) => s + r.ms, 0)}ms · 생성 ${new Date().toISOString().slice(0, 10)}_`)
  return lines.join('\n')
}

const UNIQUE_IDS = ['unlock', 'recycle', 'facet-ladder', 'confusion-log', 'uncovered']

/** 리포트를 저장한다 — 콘솔은 잘리고, 잘린 리포트는 없는 리포트다. */
function writeReport(text: string): string {
  const here = fileURLToPath(new URL('.', import.meta.url))
  const path = resolve(here, '../../../../../../../docs/reports/vcb-compose-eval.md')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text + '\n', 'utf8')
  return path
}

describe.skipIf(!enabled)('VCB 컴포저 — 전 blueprint 실 DB 평가', () => {
  beforeAll(async () => {
    client = createClient(SUPA_URL!, SUPA_KEY!, { auth: { persistSession: false } })
    existingWords = await fetchPublishedWords(client, { limitSets: 120 })
    console.info(`[compose-eval] 기존 발행 단어 ${existingWords.size}개 로드 (novelty 대조군)`)
  }, 180_000)

  it(
    '카탈로그 전 유형 드라이런 → scorecard 매트릭스',
    async () => {
      for (const bp of BLUEPRINTS) {
        const params = PARAMS[bp.id] ?? {}
        const started = Date.now()
        try {
          const r: DryRunResult = await dryRun(client, bp.id, params, {
            existingWords,
            maxPopulation: 8000,
            now: '2026-08-14',
          })
          const card: Scorecard = r.scorecard
          const ev = r.set.evidence
          const evidenceLine = ev?.sentence_unlock
            ? `해금 문장 ${ev.sentence_unlock.ours} vs 빈도순 ${ev.sentence_unlock.baseline} / 전체 ${ev.sentence_unlock.total} (예산 ${ev.sentence_unlock.budget}단어)`
            : ev?.future_encounters
              ? `평균 향후 재등장 ${ev.future_encounters.ours_mean.toFixed(2)} vs 빈도순 ${ev.future_encounters.baseline_mean.toFixed(2)} (모집단 평균 ${ev.future_encounters.population_mean.toFixed(2)})`
              : undefined
          rows.push({
            evidence: evidenceLine,
            id: bp.id,
            taxon: bp.taxon,
            title: bp.title,
            status: bp.status,
            entries: card.entry_count,
            groups: card.group_count,
            total: card.total,
            passed: card.passed,
            metrics: Object.fromEntries(card.metrics.map((m) => [m.id, m.score])),
            blockers: card.blockers,
            warnings: card.warnings,
            ms: Date.now() - started,
          })
        } catch (err) {
          rows.push({
            id: bp.id,
            taxon: bp.taxon,
            title: bp.title,
            status: bp.status,
            entries: 0,
            groups: 0,
            total: 0,
            passed: false,
            metrics: {},
            blockers: ['throw'],
            warnings: [],
            ms: Date.now() - started,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      const text = report()
      const path = writeReport(text)
      console.info(`\n[compose-eval] 리포트 저장 → ${path}\n`)
      console.info('\n' + text + '\n')
      expect(rows).toHaveLength(BLUEPRINTS.length)
    },
    900_000,
  )

  // ── 목표 판정 ─────────────────────────────────────────────────────

  it('G1 — 시중 유형 24종 이상이 실제로 생성된다 (자산 결손 2종 제외)', () => {
    const market = rows.filter((r) => r.status !== 'asset_gap' && !r.id.startsWith('confusion'))
    const produced = market.filter((r) => r.entries > 0)
    console.info(
      `[G1] 생성 성공 ${produced.length}/${market.length} — 실패: ${market
        .filter((r) => r.entries === 0)
        .map((r) => r.id)
        .join(', ') || '없음'}`,
    )
    expect(produced.length).toBeGreaterThanOrEqual(24)
  })

  it('G2 — 생성 가능한 모든 blueprint 가 통과선 0.80 이상', () => {
    const target = rows.filter((r) => r.status === 'ready' || r.status === 'partial')
    const failed = target.filter((r) => r.total < PASS_THRESHOLD || !r.passed)
    console.info(
      `[G2] ${target.length - failed.length}/${target.length} 통과 · 미달: ${failed
        .map((r) => `${r.id}(${fmt(r.total)})`)
        .join(', ') || '없음'}`,
    )
    expect(failed.map((r) => r.id)).toEqual([])
  })

  it('G3 — 선언한 면의 요구 필드 결측이 0 이다', () => {
    const target = rows.filter((r) => r.status === 'ready' || r.status === 'partial')
    const leaky = target.filter((r) => (r.metrics['fill'] ?? 0) < 0.999 && r.entries > 0)
    console.info(
      `[G3] 결측 있는 유형: ${leaky.map((r) => `${r.id}(${fmt(r.metrics['fill'] ?? 0)})`).join(', ') || '없음'}`,
    )
    // Sound 면은 녹음 자산 0% 로 fallback(0.7 가중) 이 정상이므로 그 유형만 예외로 둔다.
    const notSound = leaky.filter((r) => !['rhyme-phonics', 'facet-ladder', 'script-media'].includes(r.id))
    expect(notSound.map((r) => r.id)).toEqual([])
  })

  it('G4 — unlock 이 같은 단어 수에서 빈도순보다 많은 문장을 연다', () => {
    const r = rows.find((x) => x.id === 'unlock')
    expect(r, 'unlock 행 없음').toBeTruthy()
    console.info(`[G4] unlock blueprint_fit=${fmt(r!.metrics['blueprint_fit'] ?? 0)} · ${r!.blockers.join(' / ')}`)
    expect(r!.metrics['blueprint_fit']).toBe(1)
  })

  it('자산 결손 2종은 0건을 내는 것이 정상이다 (설계 결함이 아님을 고정)', () => {
    const gaps = rows.filter((r) => r.status === 'asset_gap')
    expect(gaps.map((r) => r.id).sort()).toEqual(['audio-only', 'picture-dict'])
    for (const g of gaps) expect(g.entries).toBe(0)
  })
})
