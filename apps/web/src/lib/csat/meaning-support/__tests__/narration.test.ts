// apps/web/src/lib/csat/meaning-support/__tests__/narration.test.ts
//
// 읽어 주기 큐 — 배포 sidecar 전량: 검수 본문만 읽고(새 문장 없음), 화면 자리 key 와 원문 문장이 실제 범위 안이다.
import { describe, expect, it } from 'vitest'

import { integrationSteps } from '@/components/csat/theater/MeaningWholeView'
import data from '@/lib/csat/meaning-support-data.json'

import type { MeaningSupportView } from '../labels'
import { analysisSpeech } from '../../analysis-sections'
import { asLecture, unitNarration, wholeNarration } from '../narration'

const items = (data as unknown as { items: Record<string, MeaningSupportView> }).items
const spoken = (c: { segments: { text: string }[] }) => c.segments.map((s) => s.text).join('')
const norm = (s: string) => s.replace(/\s+/g, '')
/** 화면 글을 읽기 변환(숫자 → 한국어 읽기 등)까지 거친 형태 — 큐와 같은 변환으로 비교한다 */
const said = (s: string) => norm(analysisSpeech(s).map((x) => x.text).join(''))

describe('wholeNarration · unitNarration', () => {
  for (const [id, v] of Object.entries(items)) {
    it(id, () => {
      const steps = integrationSteps(v)
      const whole = wholeNarration(v, steps)
      // 단계 수 + 끼운 연결 수 + 결론 1
      expect(whole).toHaveLength(steps.props.length + steps.links.filter(Boolean).length + 1)
      expect(whole.at(-1)!.key).toBe('result')
      expect(norm(spoken(whole.at(-1)!))).toContain(said(v.whole.summaryKo).slice(0, 12))
      for (const p of steps.props) {
        const c = whole.find((x) => x.key === `step:${p.id}`)!
        expect(c, p.id).toBeTruthy()
        expect(norm(spoken(c))).toContain(said(p.textKo).slice(0, 10))
      }
      const maxSentence = Math.max(...v.anchors.map((a) => a.sentence), ...v.units.flatMap((u) => u.sentences))
      for (const c of whole) {
        expect(c.segments.length, c.key).toBeGreaterThan(0)
        for (const n of c.sentences) expect(n).toBeLessThanOrEqual(maxSentence)
      }
      for (const u of v.units) {
        const uc = unitNarration(v, u)
        expect(uc.map((c) => c.key)).toEqual([`unit:${u.id}:exact`, `unit:${u.id}:simple`, ...(u.preserves.length ? [`unit:${u.id}:preserve`] : [])])
        expect(norm(spoken(uc[1]))).toContain(said(u.simpleKo).slice(0, 10))
        expect(uc.every((c) => c.sentences.join() === u.sentences.slice().sort((a, b) => a - b).join())).toBe(true)
      }
      const lec = asLecture(v.itemId, whole)
      expect(lec.total_sec_est).toBeGreaterThan(0)
      expect(new Set(lec.cues.map((c) => c.id)).size).toBe(lec.cues.length)
    })
  }
})
