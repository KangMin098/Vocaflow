// apps/web/src/lib/csat/session/__tests__/dissect.test.ts
import { describe, expect, it } from 'vitest'
import verified from '../../dissect-anchors.json'
import { analysisSpeech, analysisSections, analysisLecture } from '../../analysis-sections'
import { segmentIssues } from '../../lecture/speakable'
import { patternGroups, patternPosition, recommendationReason } from '../../learning-home'
import { composeDissection, emptyDissectionRecord, hashTag, predictionStats, readyItem, recordDecision, shuffled, type DissectionCatalog, type DissectionItem } from '../../dissect'

function item(id: string, topic: string, formula = '원리 하나'): DissectionItem {
  return { id, topic, formula, formulaTag: hashTag(formula), format: '대조', wrapup: formula, exam_id: id.split('#')[0], no: Number(id.split('#')[1]), type_id: 'R-BLANK', points: null, answer: 2, intent: '같은 길이 의도 하나', intentOptions: ['같은 길이 의도 하나', '같은 길이 의도 둘째', '같은 길이 의도 셋째'], evidence: '검토한 근거 설명', distractor: { n: 1, family: '어휘 함정', line: '대상이 다르다' }, trapOptions: ['어휘 함정', '부분 사실', '반대 진술', '범위 과대'], skeleton: { sentences: [20, 22], anchors: [{ id: 'answer', sentences: [0], from: 'answer', quotes: [] }, { id: 'reject:1', sentences: [1], from: 'reject', quotes: [] }] }, history: [{ id: '2024#31', topic: '다른 소재', formula }] }
}
const a = item('2026#31', '경제')
const b = item('2026#32', '예술')
const c = item('2026#33', '심리', '원리 둘')
const d = item('2026#34', '철학', '원리 셋')
function catalog(items = [a, b, c, d]): DissectionCatalog { return { items, types: [{ id: 'R-BLANK', name: '빈칸', time_budget_sec: null }], exams: {}, papers: {}, anchored: [], families: a.trapOptions, audit: { total: items.length, fields: {}, excluded: [] } } }

describe('출제자의 수 — 학습자 세션 규칙', () => {
  it('복습은 같은 공식의 **다른** 문항으로 낸다 — 외운 답이 통하지 않게(docs/csat/ia-design.md S6)', () => {
    const rec = emptyDissectionRecord(1)
    rec.queue = [{ tag: a.formulaTag, source: a.id, due: 0 }]
    const plan = composeDissection(catalog(), rec, 1)
    expect(plan).toHaveLength(3)
    expect(plan[2].formulaTag).toBe(a.formulaTag)
    expect(plan[2].id).not.toBe(a.id)
    expect(plan.map(i => i.id)).not.toContain(a.id)
  })
  it('홈은 읽기를 숙달로 바꾸지 않고 재확인 큐와 보관 상태를 구분한다', () => {
    const rec = emptyDissectionRecord(1)
    expect(patternGroups([a, b, c]).map(g => g.items.length)).toEqual([2, 1])
    expect(patternPosition([a, b], rec)).toBe('아직 탐색 전')
    rec.inspected = [a.id]
    expect(patternPosition([a, b], rec)).toBe('분석을 읽은 원리')
    const saved = recordDecision(rec, a, 'save', 0, [a, b])
    expect(patternPosition([a, b], saved)).toBe('내 공식에 보관')
    saved.queue = [{ tag: a.formulaTag, source: a.id, due: 100 }]
    expect(patternPosition([a, b], saved)).toBe('다시 확인할 원리')
    expect(recommendationReason(catalog(), [c, d, b], saved, 99)).toContain('첫 분석')
    expect(recommendationReason(catalog(), [c, d, b], saved, 100)).toContain('전이에 넣었어요')
    expect(recommendationReason(catalog(), [b, c, d], saved, 100)).not.toContain('전이에 넣었어요')
  })
  it('분석을 수정하면 같은 semantic target의 음성도 함께 바뀌고 한영을 분리한다', () => {
    const changed = { ...a, evidence: '근거는 in effect, we imagine 이며 ⑤번과 이어진다.' }
    const section = analysisSections(changed).find(s => s.id === 'evidence')!
    const cue = analysisLecture(changed).cues.find(c => c.target.id === section.id)!
    expect(cue.id).toBe(`${a.id}:evidence`)
    expect(cue.segments).toEqual(analysisSpeech(section.text))
    expect(cue.segments.some(s => s.lang === 'en-US' && s.text.includes('in effect'))).toBe(true)
    expect(cue.segments.flatMap(segmentIssues)).toEqual([])
  })
  it('검증 위치 산출물에는 원문이 없고 모든 구간은 문장 경계 안에 있다', () => {
    expect(Object.keys(verified).length).toBeGreaterThan(0)
    for (const item of Object.values(verified)) {
      expect(item.sentences.every(s => /^[a-f0-9]{64}$/.test(s.hash) && s.reveals.length === 0)).toBe(true)
      expect(item.anchors.some(a => a.id === 'answer')).toBe(true)
      for (const a of item.anchors) for (const r of a.spans) {
        expect(r.start).toBeGreaterThanOrEqual(0)
        expect(r.end).toBeGreaterThan(r.start)
        expect(r.end).toBeLessThanOrEqual(item.sentences[r.sentence].chars)
      }
      const walk = (v: unknown, key = '') => {
        if (typeof v === 'string') expect(['id', 'type_id', 'hash', 'from']).toContain(key)
        else if (Array.isArray(v)) v.forEach(x => walk(x, key))
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
      }
      walk(item)
    }
  })
  it('같은 유형·다른 소재 대조 2개와 중복 없는 전이 하나를 뽑는다', () => {
    const plan = composeDissection(catalog(), emptyDissectionRecord(11), 0)
    expect(plan).toHaveLength(3)
    expect(new Set(plan.map(i => i.id)).size).toBe(3)
    expect(new Set(plan.map(i => i.type_id)).size).toBe(1)
    expect(plan[0].topic).not.toBe(plan[1].topic)
  })
  it('필수 근거·보기·변형 이력이 빠진 문항을 제외한다', () => {
    for (const broken of [{ ...a, evidence: '' }, { ...a, history: [] }, { ...a, intentOptions: [a.intent, '너무 짧다', 'x'.repeat(150)] }, { ...a, trapOptions: ['어휘 함정'] }]) {
      expect(readyItem(broken)).toBe(false)
      expect(composeDissection(catalog([broken, b, c, d]), emptyDissectionRecord(1), 0).map(i => i.id)).not.toContain(a.id)
    }
  })
  it('아직 모르겠음은 정확히 3일 후 같은 공식의 다른 문항을 전이에 예약한다', () => {
    const now = Date.UTC(2026, 8, 17)
    const record = recordDecision(emptyDissectionRecord(1), a, 'unsure', now, [a, b, c, d])
    expect(record.queue).toEqual([{ tag: a.formulaTag, source: a.id, due: now + 3 * 86400000 }])
    expect(composeDissection(catalog(), record, now + 3 * 86400000)[2].id).toBe(b.id)
    const finished = recordDecision(record, b, 'transfer', now + 3 * 86400000, [a, b, c, d])
    expect(finished.queue).toHaveLength(0)
    expect(recordDecision(emptyDissectionRecord(1), c, 'unsure', now, [a, b, c, d]).queue).toHaveLength(0)
  })
  it('동일 공식은 하나로 모으고 출처를 보존한다', () => {
    const once = recordDecision(emptyDissectionRecord(1), a, 'save', 1, [a, b])
    const twice = recordDecision(once, b, 'save', 2, [a, b])
    expect(twice.formulas).toEqual([{ tag: a.formulaTag, text: a.formula, type: a.type_id, sources: [a.id, b.id] }])
  })
  it('보기를 기기 seed에 따라 섞으며 정답을 고정 위치에 두지 않는다', () => {
    const positions = new Set(Array.from({ length: 30 }, (_, n) => shuffled(a.trapOptions, n * 7919).indexOf(a.distractor.family)))
    expect(positions.size).toBe(4)
    expect(shuffled(a.trapOptions, 17)).toEqual(shuffled(a.trapOptions, 17))
    expect(a.trapOptions[0]).toBe(a.distractor.family)
  })
  it('지표는 최근 30수와 실제 접한 함정 계열로만 센다', () => {
    const r = emptyDissectionRecord(1)
    r.predictions = Array.from({ length: 40 }, (_, i) => ({ item: a.id, type: a.type_id, step: 2 as const, hit: i >= 10, at: i, family: a.distractor.family }))
    expect(predictionStats(r, a.trapOptions)).toEqual({ formulas: 0, hit: 100, seen: 1, total: 4 })
  })
  it('같은 소재뿐이거나 3개 미만이면 불완전 세션을 만들지 않는다', () => {
    expect(composeDissection(catalog([a, b]), emptyDissectionRecord(1), 0)).toEqual([])
    expect(composeDissection(catalog([a, { ...b, topic: a.topic }, { ...c, topic: a.topic }]), emptyDissectionRecord(1), 0)).toEqual([])
  })
})
