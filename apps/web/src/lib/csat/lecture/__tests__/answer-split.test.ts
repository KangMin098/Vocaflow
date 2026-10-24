// apps/web/src/lib/csat/lecture/__tests__/answer-split.test.ts
//
// 판단 장면 정답 지연 조회 (b) — 첫 응답에 정답 · 확정 해설이 없고, 공개 응답과 합치면 원래 자료로 돌아오는지.
// v3 탐구는 실제 정본(2014A#23 — 설계 주장 「공식 정답은 5번이다」 · 선지 판정 selected_as_answer)으로 잰다(T-0140 r5 R5-02 사례).
import { describe, expect, it } from 'vitest'

import { lookupInquiry } from '@/lib/csat/inquiry/data'
import { theaterBlocks, type TheaterSource } from '@/lib/csat/theater'
import { buildChecks } from '@/lib/csat/understanding-check'
import { mergeMeaningSupport, mergeReveal, splitAnswer, splitMapSentences, splitMeaningSupport, type TheaterAnswerData } from '../answer-split'
import type { SkeletonSentence } from '@/lib/csat/passage-skeleton'
import type { MeaningSupportView } from '@/lib/csat/meaning-support/labels'

const hit = lookupInquiry('2014A#23', 4)
if (hit.state !== 'ready') throw new Error('2014A#23 탐구 정본이 바뀌었다 — 픽스처를 다시 고른다')
const inquiry = hit.record

const item = {
  id: '2014A#23',
  exam_label: '2014 수능 A',
  no: 23,
  type_id: 'R-TOPIC',
  type_name: '주제',
  points: 2,
  time_budget_sec: 90,
  answer: 5,
  answer_unknown: false,
  measured_ability: '글의 주제 파악',
  design_intent: '일반화 문장 찾기',
  why_correct: '⑤ 가 마지막 문장의 일반화와 같다',
  evidence_reasoning: null,
  evidence_quote: 'In short, the policy',
  evidence_quote_truncated: false,
  distractors: [1, 2, 3, 4].map((n) => ({ n, trap: '부분 정보', why_tempting: `${n}번 끌림 설명`, how_to_reject: `${n}번 지우는 근거` })),
  procedure: [{ step: '마지막 일반화 문장 찾기' }],
  required_vocab: [],
} as unknown as TheaterSource

const full: TheaterAnswerData = {
  blocks: theaterBlocks(item),
  anchors: [
    { id: 'answer', label: '⑤', kind: 'answer', detail: '⑤ 가 마지막 문장의 일반화와 같다' },
    { id: 'reject:2', label: '②', kind: 'reject', detail: '2번 지우는 근거', tempting: '2번 끌림 설명' },
  ],
  placements: [{ id: 'answer', sentences: [6] }, { id: 'reject:2', sentences: [2] }],
  checks: buildChecks({ id: '2014A#23', type_id: 'R-TOPIC', distractors: [{ n: 2, trap: '부분 정보' }], map: { sentenceCount: 7, answerSentences: [6] } }),
  comparePairs: [{ other: '2015#23', otherSlug: '2015-23', otherLabel: '2015 수능 23번', choice: 2, otherChoice: 3, trap: '부분 정보', note: '둘 다 앞부분 사례' }],
  v3Pairs: [{ pairId: 'p1', kind: 'same_structure', focus: '일반화', otherSlug: '2015-23', otherLabel: '2015 수능 23번', mappings: [{ self: { sentences: [6], choices: [5] }, other: { sentences: [5], choices: [1] }, relation: '같은 일반화' }], shared: [], differences: [], principle: null, limitation: '' }],
  inquiry,
  gate: { answer: 5, evidence: [6], design: null },
}
const { initial, reveal } = splitAnswer(full, 4)
const payload = JSON.stringify(initial)

describe('첫 응답(문항 페이지 HTML · RSC props)', () => {
  it('정답 번호 · 정답 칩 · 정답 근거 · 오답 소거 · 함정 · 이해 확인이 없다', () => {
    expect(payload).not.toMatch(/정답 [①-⑤]/)
    expect(payload).not.toContain('일반화와 같다')
    expect(payload).not.toMatch(/끌림 설명|지우는 근거|analysis:reject|"reject:\d"/)
    expect(payload).not.toContain('부분 정보')
    expect(initial.checks).toEqual([])
    expect(initial.anchors).toEqual([])
    expect(initial.placements).toEqual([])
    expect(initial.gate).toMatchObject({ answer: null, evidence: [] })
  })

  it('실제 v3 정본 — 공식 정답 주장 · 선지 판정 · 오답 설계 · 원리가 없다', () => {
    expect(JSON.stringify(inquiry)).toContain('공식 정답은 5번이다')
    expect(payload).not.toContain('공식 정답은 5번이다')
    expect(payload).not.toContain('selected_as_answer')
    expect(initial.inquiry?.distractors).toEqual([])
    expect(initial.inquiry?.principle).toBeNull()
    // v3 비교 쌍은 통째로 공개 응답으로(R147-06 — relation 문장이 오답 소거를 적는다)
    expect(initial.v3Pairs).toEqual([])
    expect(payload).not.toContain('같은 일반화')
    expect(payload).not.toMatch(/"choices":\[\d/)
  })

  it('비결정적 근거 탐색은 남긴다 — 재는 능력 · 의도 · 절차 · v3 의미 단위 · 발문 요구', () => {
    // 재는 능력 · 의도 · 절차는 문항별 풀이라 공개 응답으로(R147-02 — 문장 결정성 감수 전 fail-closed). 머리 · 어휘만 남는다
    expect(initial.blocks.map((b) => b.kind)).toEqual(['head'])
    expect(payload).not.toContain('일반화 문장 찾기')
    expect(payload).not.toContain('마지막 일반화 문장 찾기')
    // 의미 단위도 통째로 공개 응답으로(R147-08 — 키워드 필터가 결정적 설명을 놓쳤다)
    expect(initial.inquiry?.v3?.meanings).toEqual([])
    // 발문 요약 · 읽기 범위도 공개 응답으로(R147-09) — 첫 응답은 극성만
    expect(initial.inquiry?.v3?.requirement).toEqual({ requested: '', polarity: inquiry.v3?.requirement.polarity, conditions: [] })
    expect(initial.inquiry?.v3?.requirement.conditions).toEqual([])
    expect(initial.inquiry?.v3?.units_hash).toBe(inquiry.v3?.units_hash)
  })
})

describe('실제 탐구 정본 전체', () => {
  it('모든 문항의 첫 응답에 선지 판정 · 설계 주장 · 오답 설계 · 원리가 없고, 합치면 원래 레코드로 돌아온다', async () => {
    const data = (await import('@/lib/csat/inquiry-data.json')).default as unknown as { items: Record<string, typeof inquiry> }
    const ids = Object.keys(data.items)
    expect(ids.length).toBeGreaterThan(100)
    const bad: string[] = []
    for (const id of ids) {
      const rec = data.items[id]
      const f: TheaterAnswerData = { ...full, inquiry: rec }
      const { initial: i, reveal: r } = splitAnswer(f, rec.analysis_version)
      const s = JSON.stringify(i.inquiry)
      const claims = [...(rec.v3?.design.claims.map((c) => c.text) ?? []), ...(rec.v3?.design.limitation ? [rec.v3.design.limitation] : [])]
      const pointsAtChoice = (i.inquiry?.v3?.meanings ?? []).some((m) => /정답|선지\s*[①-⑤\d]|\d\s*번\s*선지/.test(`${m.meaning_ko} ${m.scope.note ?? ''}`))
      if (/selected_as_answer|requirement_fit|content_truth/.test(s) || (i.inquiry?.v3?.requirement.conditions.length ?? 0) > 0 || (i.inquiry?.v3?.requirement.requested ?? '') !== '' || i.inquiry?.v3?.requirement.reading_scope != null || pointsAtChoice || claims.some((t) => s.includes(t)) || (i.inquiry?.distractors.length ?? 0) > 0 || i.inquiry?.principle != null) bad.push(id)
      if (JSON.stringify(mergeReveal(i, r).inquiry) !== JSON.stringify(rec) && JSON.stringify(sortKeys(mergeReveal(i, r).inquiry)) !== JSON.stringify(sortKeys(rec))) bad.push(`${id}:merge`)
    }
    expect(bad).toEqual([])
  })
})

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]))
  return v
}

describe('원문 이해 교수 설명(meaningSupport) — 실제 배포 정본 전체', () => {
  it('첫 응답에 교수 설명이 통째로 없고(본문도 선지 판정을 적는다), 공개 응답이 그대로 돌려준다(R147-01 · R147-05)', async () => {
    const data = (await import('@/lib/csat/meaning-support-data.json')).default as unknown as { items: Record<string, MeaningSupportView> }
    const ids = Object.keys(data.items)
    expect(ids.length).toBeGreaterThan(0)
    // 재현 전제 — 실제 정본 본문에 선지 판정 문장이 있다(2026#30 「⑤는 이와 충돌한다」 · 2026#35 「흐름 밖의 문장 … (④)」)
    expect(JSON.stringify(data.items['2026#30'] ?? '')).toContain('⑤는 이와 충돌한다')
    expect(JSON.stringify(data.items['2026#35'] ?? '')).toMatch(/흐름 밖의 문장[^"]*\(④\)/)
    for (const id of ids) {
      const v = data.items[id]
      const { initial: i, reveal: r } = splitMeaningSupport(v)
      expect(i).toBeNull()
      expect(mergeMeaningSupport(i, r)).toEqual(v)
    }
    expect(splitMeaningSupport(null)).toEqual({ initial: null, reveal: null })
  })
})

describe('지도 문장 골격 — 실제 배포 골격 전체', () => {
  it('첫 응답 문장에 근거 인용 · 앵커 id 가 없고 길이는 같으며, 공개 응답이 원래 문장을 돌려준다(R147-07)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dir = path.join(__dirname, '..', '..', 'skeleton-data')
    let items = 0
    let withReject4 = 0
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
      const exam = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { items: { id: string; sentences: SkeletonSentence[] }[] }
      for (const it of exam.items) {
        items++
        const ids = new Set(it.sentences.flatMap((s) => s.reveals.map((r) => (r as { anchorId?: string }).anchorId)).filter((x) => x?.startsWith('reject:')))
        if (ids.size >= 4) withReject4++
        const { initial: i, reveal: r } = splitMapSentences(it.sentences)
        expect(i.every((s) => s.reveals.length === 0)).toBe(true)
        expect(i.map((s) => s.chars)).toEqual(it.sentences.map((s) => s.chars))
        expect(JSON.stringify(i)).not.toMatch(/anchorId|answer|reject/)
        expect(r).toBe(it.sentences)
      }
    }
    // 재현 전제 — 배포 골격에 오답 id 넷이 모두 실린 문항이 있다(없으면 이 검사가 아무것도 지키지 않는다)
    expect(items).toBeGreaterThan(700)
    expect(withReject4).toBeGreaterThan(100)
  })
})

describe('공개 응답과 합치기', () => {
  it('합치면 원래 자료와 같다(블록 순서 포함)', () => {
    expect(mergeReveal(initial, reveal)).toEqual(full)
  })

  it('공개 응답이 정답 · 확정 해설을 담는다', () => {
    expect(reveal.gate.answer).toBe(5)
    expect(reveal.analysisVersion).toBe(4)
    expect(JSON.stringify(reveal)).toContain('공식 정답은 5번이다')
  })
})
