// apps/web/src/lib/csat/map/__tests__/quality.live.test.ts
//
// 라이브 검증 — Record Quality Layer 적용 전(저장된 rule-v1 스냅샷)과 후(지금 입력으로 다시 계산)의 핵심 지도를 비교한다. 기본은 건너뜀:
//   MAP_LIVE_USER=<user uuid> pnpm --filter web exec vitest run src/lib/csat/map/__tests__/quality.live.test.ts
// 읽기 전용 — DB 를 쓰지 않는다(computeSnapshotNow 는 저장하지 않는다).

import { describe, expect, it } from 'vitest'

import { createAdminClient } from '@/lib/supabase/admin'

import { buildInput } from '../../diagnosis/server'
import { attributeMastery, diagnosedResponses, diagnose, diagnosticInput, qualityOf, trapVulnerability } from '../../diagnosis/engine/rule-v1'
import { loadExamReport } from '../../diagnosis/report'
import { loadSnapshots } from '../../diagnosis/snapshot'
import { CORE_STATUS_LABEL, coreSummary } from '../core'
import { loadMapPage } from '../load'

const USER = process.env.MAP_LIVE_USER
const NOW = new Date('2026-10-03T12:00:00Z')

describe.skipIf(!USER)('Record Quality Layer (live)', () => {
  it('일괄 입력 기록은 지도 관찰 집계에서 빠진다 — 전후 비교', async () => {
    const db = createAdminClient() as never
    const { input } = await buildInput(db, USER as string, NOW)
    for (const s of input.sessions) {
      const q = qualityOf(s)
      console.log(`기록 ${s.examId} ${s.mode} ${s.takenAt} 점수 ${s.rawScore} → ${q.status} [${q.reasons.join(' · ')}]`, JSON.stringify(q.signals))
    }

    const [stored] = await loadSnapshots(db, USER as string, 1)
    console.log('저장된 스냅샷', stored?.engineVersion, 'attributePoints', JSON.stringify(stored?.evidence?.attributePoints ?? {}))

    const after = await loadMapPage(db, USER as string, NOW)
    expect(after).not.toBeNull()
    const sumAfter = coreSummary(after!.model, after!.settings)

    // 「전」 — 저장된 옛 스냅샷의 역량 관찰값을 같은 배점(지금 모델의 points)에 얹어 같은 규칙으로 요약한다(비교용)
    const ap = (stored?.evidence?.attributePoints ?? {}) as Record<string, { value: number | null; n: number }>
    const beforeNodes = Object.fromEntries(
      Object.entries(after!.model.nodes).map(([code, v]) => [code, ap[code] && code !== 'A7' ? { ...v, achieved: ap[code].value, n: ap[code].n } : { ...v, achieved: null, n: null }]),
    )
    const sumBefore = stored ? coreSummary({ nodes: beforeNodes }, after!.settings) : null

    const fmt = (s: ReturnType<typeof coreSummary> | null) =>
      s ? s.axes.map((a) => `${a.code}:${CORE_STATUS_LABEL[a.status]}${a.observed === null ? '' : `(${a.observed.toFixed(2)})`}`).join(' | ') + ` · 후보 [${s.candidates.join(',')}]` : '(스냅샷 없음)'
    console.log('전 ', fmt(sumBefore))
    console.log('후 ', fmt(sumAfter))
    console.log('후 점수', after!.model.currentScore)

    // 진단 엔진 — 가드 없이(원래 입력 전체) vs 가드 적용(diagnose 가 쓰는 입력)
    const obs = (m: ReturnType<typeof attributeMastery>) => Object.entries(m).filter(([, v]) => v.n > 0).map(([k, v]) => `${k}=${v.value}(n${v.n})`).join(' ') || '(관찰 없음)'
    const traps = (x: ReturnType<typeof trapVulnerability>) => Object.entries(x).filter(([, v]) => v && v.exposure > 0).map(([k, v]) => `${k}:${v!.picked}/${v!.exposure}${v!.vulnerable ? '!' : ''}`).join(' ') || '(없음)'
    const rawRows = diagnosedResponses(input)
    console.log('엔진 전 역량', obs(attributeMastery(input, rawRows)))
    console.log('엔진 전 함정', traps(trapVulnerability(input, rawRows)))
    const dx = diagnosticInput(input)
    console.log('엔진 후 역량', obs(attributeMastery(dx, diagnosedResponses(dx))))
    const res = diagnose(input)
    console.log('엔진 후 결과', 'rawScore', res.rawScore, 'confidence', res.confidence, '추천', JSON.stringify(res.recommendedLines.map((l) => l.code)), 'evidence', JSON.stringify(res.evidence))
    console.log('저장 스냅샷(전) 추천', JSON.stringify(stored?.recommendedLines?.map((l) => l.code)), 'confidence', stored?.confidence)

    // 시험 기록 보고서 — 기록 · 점수 · 오답 표는 남고 유형 · 함정 집계는 빠진다
    const { report } = await loadExamReport(db, USER as string)
    console.log('보고서 기록', report.trend.map((x) => `${x.label} ${x.raw}점 ${x.quality}`).join(' / '), '· 오답 표', report.wrongAll.length, '· 유형', report.types.length, '· 함정', JSON.stringify(report.traps), '· 제외', report.qualityExcluded)
    expect(report.trend.length).toBe(input.sessions.filter((s) => s.mode === 'live' || s.mode === 'retake').length)

    // 신뢰할 기록이 하나도 없으면 핵심 축은 관찰값 없이 「진단 근거 부족」(L 은 데이터 없음)이어야 한다
    const trusted = input.sessions.filter((s) => qualityOf(s).status === 'trusted')
    if (trusted.length === 0) {
      for (const a of sumAfter.axes) expect(['insufficient', 'no_data']).toContain(a.status)
      expect(sumAfter.candidates).toEqual([])
    }
  }, 120_000)
})
