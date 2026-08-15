// apps/web/src/lib/vcb/compose/__tests__/compose-sweep.integration.test.ts
//
// 파라미터 스윕 — "이 유형을 만들 수 있다" 를 **파라미터 하나로** 증명하면 거짓일 수 있다.
//
// compose-eval 은 유형마다 대표 파라미터 1개로 돈다. 그런데 어드민이 실제로 쓰는 값은 여러 개다:
// 주제 18종 · 도서 여러 권 · 어휘 목록 12종 · 레벨 밴드 여러 개. 그중 하나에서만 무너지면
// 그 화면을 쓴 관리자에게는 그것이 전부다. 그래서 **실제 운용 조합**으로 넓혀 돌린다.
//
// 이 스펙이 잡으려는 실패는 "평균은 좋은데 특정 조합이 깨지는 것" 이다 —
// 예: L2 가 2개뿐인 주제는 목차 요구(min_groups 3)를 못 맞춘다.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, beforeAll } from 'vitest'
import type { BlueprintParams } from '../blueprints'
import { evaluateMarket } from '../market'
import { fetchPublishedWords } from '../resolve'
import { dryRun } from '../run'

const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const enabled = !!SUPA_URL && !!SUPA_KEY

if (!enabled) {
  console.warn('[compose-sweep] SKIP — SERVICE_ROLE 키 부재. 파라미터 스윕은 실 DB 가 있어야 한다.')
}

/** 실측 픽스처 — 도서 5권(챕터 수 다양) · 글 세트 */
const BOOKS = [
  { id: '350250ca-2e05-4e2e-96d4-051032abf78b', title: 'Fables (143장)' },
  { id: 'ac506006-6147-4d23-8dba-72698eb7e9ae', title: 'Pride and Prejudice (61장)' },
  { id: 'e29ca9b8-f15c-423c-8161-cd15798b66cf', title: 'Pinocchio (36장)' },
  { id: '9124af41-6254-4b6e-b921-3c7a74cc4b97', title: 'Twenty Years After (90장)' },
  { id: '406dbc3e-d723-4e03-b613-73536c5e8dee', title: 'Intro to Sociology (23장)' },
]

const THEMES = [
  '여행', '음식과 음료', '건강', '일과 비즈니스', '과학과 기술', '자연 세계',
  '사람', '정치와 사회', '문화', '외모', '언어 기능', '동물',
  '집과 건물', '스포츠', '개념', '의사소통', '시간과 공간', '여가',
]

const LIST_TAGS = [
  'ngsl_1.2', 'ngsl_spoken_1.2', 'csat-prep-core-2k', 'csat-prep-ext-1.8k',
  'bsl_1.20', 'ndl_1.1', 'tsl_1.2', 'bel_1.0', 'nawl_1.2', 'moel_1.0', 'fel_1.2',
  'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
]

interface Case {
  blueprint: string
  label: string
  params: BlueprintParams
}

function buildCases(): Case[] {
  const cases: Case[] = []

  for (const t of THEMES) {
    cases.push({ blueprint: 'topic-field', label: `주제 ${t}`, params: { themes: [t], count: 300 } })
  }
  for (const tag of LIST_TAGS) {
    cases.push({ blueprint: 'exam-list', label: `목록 ${tag}`, params: { tags: [tag], count: 500 } })
  }
  for (const b of BOOKS) {
    cases.push({ blueprint: 'book-companion', label: `도서 ${b.title}`, params: { book_id: b.id, count: 300 } })
    cases.push({ blueprint: 'unlock', label: `해금 ${b.title}`, params: { book_id: b.id, count: 200 } })
    cases.push({
      blueprint: 'recycle',
      label: `재등장 ${b.title}`,
      params: { book_id: b.id, chapter_from: 1, chapter_to: 5, count: 80 },
    })
  }
  for (const [lo, hi] of [
    [1, 3],
    [4, 7],
    [8, 10],
  ] as const) {
    cases.push({
      blueprint: 'level-band',
      label: `레벨 V${lo}-V${hi}`,
      params: { v_level_min: lo, v_level_max: hi, count: 400 },
    })
  }
  for (const [days, per] of [
    [30, 20],
    [60, 15],
    [14, 30],
  ] as const) {
    cases.push({
      blueprint: 'day-pacing',
      label: `${days}일 × ${per}개`,
      params: { days, per_day: per },
    })
  }
  for (const [count, label] of [
    [100, '소형 100'],
    [1000, '대형 1000'],
  ] as const) {
    cases.push({ blueprint: 'freq-tier', label, params: { count } })
  }

  return cases
}

interface Row {
  blueprint: string
  label: string
  entries: number
  groups: number
  total: number
  passed: boolean
  market_ok: boolean
  losing: string[]
  blockers: string[]
  warnings: string[]
}

const rows: Row[] = []
let client: SupabaseClient

describe.skipIf(!enabled)('파라미터 스윕 — 실제 운용 조합에서도 무너지지 않는가', () => {
  beforeAll(async () => {
    client = createClient(SUPA_URL!, SUPA_KEY!, { auth: { persistSession: false } })
  })

  it(
    '주제 18 · 목록 14 · 도서 5(×3유형) · 레벨 3 · 일정 3 · 규모 2 = 55 조합',
    async () => {
      const existingWords = await fetchPublishedWords(client, { limitSets: 120 })
      for (const c of buildCases()) {
        try {
          const r = await dryRun(client, c.blueprint, c.params, {
            existingWords,
            maxPopulation: 8000,
            now: '2026-08-15',
          })
          const m = evaluateMarket(r.set)
          rows.push({
            blueprint: c.blueprint,
            label: c.label,
            entries: r.set.entries.length,
            groups: r.set.groups.length,
            total: r.scorecard.total,
            passed: r.scorecard.passed,
            market_ok: m.all_at_or_above,
            losing: m.losing,
            blockers: r.scorecard.blockers,
            warnings: r.scorecard.warnings,
          })
        } catch (err) {
          rows.push({
            blueprint: c.blueprint,
            label: c.label,
            entries: 0,
            groups: 0,
            total: 0,
            passed: false,
            market_ok: false,
            losing: ['throw'],
            blockers: [err instanceof Error ? err.message : String(err)],
            warnings: [],
          })
        }
      }

      const lines = ['# VCB 파라미터 스윕', '', `조합 ${rows.length}개`, '']
      lines.push('| blueprint | 파라미터 | 항목 | 목차 | 총점 | 내부 | 시중대비 | 문제 |')
      lines.push('|---|---|--:|--:|--:|:-:|:-:|---|')
      for (const r of rows) {
        const issue = [...r.blockers, ...(r.losing.length > 0 ? [`열위: ${r.losing.join(',')}`] : [])]
          .slice(0, 2)
          .join(' · ')
        lines.push(
          `| ${r.blueprint} | ${r.label} | ${r.entries} | ${r.groups} | ${r.total.toFixed(2)} | ${r.passed ? '✅' : '❌'} | ${r.market_ok ? '✅' : '❌'} | ${issue} |`,
        )
      }
      const here = fileURLToPath(new URL('.', import.meta.url))
      const path = resolve(here, '../../../../../../../docs/reports/vcb-compose-sweep.md')
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, lines.join('\n') + '\n', 'utf8')
      console.info(`\n[sweep] 리포트 → ${path}`)

      const bad = rows.filter((r) => !r.passed || !r.market_ok)
      console.info(
        `[sweep] ${rows.length - bad.length}/${rows.length} 통과 · 문제 조합: ${
          bad.map((r) => `${r.blueprint}/${r.label}`).join(' · ') || '없음'
        }`,
      )
      expect(rows.length).toBeGreaterThan(50)
    },
    1_800_000,
  )

  it('모든 조합이 내부 품질 통과선을 넘는다', () => {
    const bad = rows.filter((r) => !r.passed)
    expect(bad.map((r) => `${r.blueprint}/${r.label}: ${r.blockers.join(',')}`)).toEqual([])
  })

  it('모든 조합이 시중 베스트에 요소별로 지지 않는다', () => {
    const bad = rows.filter((r) => !r.market_ok)
    expect(bad.map((r) => `${r.blueprint}/${r.label}: ${r.losing.join(',')}`)).toEqual([])
  })
})
