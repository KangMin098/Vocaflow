// apps/web/src/components/csat/theater/__tests__/s2b-interactive34.test.tsx
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import data from '@/lib/csat/inquiry-data.json'
import { lookupInquiry, projectInteraction34 } from '@/lib/csat/inquiry/data'
import { choicesForMeaning, meaningsForChoice, replaceComparison, RESOURCE_STATE_TEXT, storedProposition } from '@/lib/csat/inquiry/interactive-34'
import type { InquiryRecord } from '@/lib/csat/inquiry/labels'
import { V3Design, V3Judgment, V3Meaning, V3Task } from '../InquiryV3Panels'
import { Compare34, Design34, InquiryResourceNotice, Scope34 } from '../inquiry/Interactive34'

const records = data.items as Record<string, InquiryRecord>
const lookup = lookupInquiry('2026#34', 5)
if (lookup.state !== 'ready' || !lookup.record.v3) throw new Error('34 이관본 부재')
const v3 = lookup.record.v3
const props = { answerRevealed: true, v3, onEvidence: () => {}, linkable: true, selectedKey: null }

describe('S2-b 34 공개 후 상호작용', () => {
  it('공개 상태 누락/false: 모든 34 진입은 비공개', () => {
    for (const answerRevealed of [undefined, false]) {
      const closed = { ...props, answerRevealed }
      for (const Panel of [V3Task, V3Meaning, V3Judgment, V3Design, Scope34, Compare34, Design34]) {
        const html = renderToStaticMarkup(<Panel {...closed} />)
        expect(html).toContain('s2b-undisclosed')
        expect(html).not.toMatch(/s2b-proposition|s2b-scope|s2b-compare/)
        for (const choice of v3.choices) expect(html).not.toContain(choice.decisive)
      }
    }
  })
  it('탐색 모듈에 기록·숙달 저장 경로와 저장 콜백이 없다', () => {
    for (const file of ['src/components/csat/theater/inquiry/Interactive34.tsx', 'src/lib/csat/inquiry/interactive-34.ts']) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      expect(source).not.toMatch(/fetch\s*\(|localStorage|sessionStorage|sendBeacon|supabase|useSWR|onComplete|onMastery|onScore|server action|\.rpc\s*\(/i)
      const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])
      expect(imports.every((name) => ['react', '../theater.module.css', './labels', '@/lib/csat/inquiry/interactive-34', '@/lib/csat/inquiry/labels'].includes(name))).toBe(true)
    }
  })
  it('AT01·04: 저장된 한국어 완성 명제 ①/③만 동시 비교하고 공식 영어 전문을 생성하지 않는다', () => {
    const html = renderToStaticMarkup(<V3Judgment {...props} />)
    expect(html).toContain('공식 영어 선지 전문은 문제지에서 확인')
    const propositions = [...html.matchAll(/data-testid="s2b-proposition">([^<]+)/g)].map((m) => m[1])
    expect(propositions).toHaveLength(2)
    expect(propositions).toEqual([1, 3].map((n) => storedProposition(v3.choices.find((c) => c.n === n)!.decisive)))
    expect(storedProposition('인용이 없는 해설')).toBeNull()
  })
  it('AT02·03·07: 발문과 Ideally/If/cannot be를 별도 선택하고 한정 근거는 보존한다', () => {
    const html = renderToStaticMarkup(<V3Task v3={v3} answerRevealed />)
    for (const label of ['발문 범위', 'Ideally', 'If', 'cannot be', '무엇이 어디까지 한정하나요?']) expect(html).toContain(label)
    expect(v3.meanings.find((m) => m.id === 'm3')?.scope.note).toContain('현실의 모든 법이 그렇다는 주장이 아니다')
    expect(v3.meanings.find((m) => m.id === 'm2')?.scope.note).toContain('모든 법에 대한 주장이 아님')
    expect(v3.meanings.find((m) => m.id === 'm1')?.scope.note).toContain('표현 전체')
  })
  it('AT04·21: ② unknown/fails를 그대로 비교하고 진위를 새로 확정하지 않는다', () => {
    const html = renderToStaticMarkup(<V3Judgment {...props} focus={{ unitLabel: '등록 의미', choices: [2, 3], claims: [], onReturn: () => {} }} />)
    expect(v3.choices.find((c) => c.n === 2)).toMatchObject({ content_truth: 'unknown', requirement_fit: 'fails' })
    expect(html).toContain('원문만으로 확정 불가')
    expect(html).toContain('발문 요구를 충족하지 못함')
  })
  it('AT05: 22③ true/fails와 기존 한정어를 그대로 유지하고 34 도구를 적용하지 않는다', () => {
    const r = lookupInquiry('2026#22', records['2026#22'].analysis_version)
    expect(r.state).toBe('ready')
    if (r.state !== 'ready') throw new Error('22 공개본 부재')
    expect(r.record.v3?.interaction34).toBeUndefined()
    expect(r.record.v3?.choices.find((c) => c.n === 3)).toMatchObject({ content_truth: 'true', requirement_fit: 'fails' })
    expect(JSON.stringify(r.record.v3)).toMatch(/may/)
    expect(r.record).toEqual(records['2026#22'])
    expect(JSON.stringify(r.record.v3)).toMatch(/often/i)
  })
  it('AT06·21: 38 승인 보류 projection을 보존하며 전용 비교판으로 노출하지 않는다', () => {
    expect(projectInteraction34('2026#38', records['2026#38'])).toBe(records['2026#38'])
    expect(renderToStaticMarkup(<InquiryResourceNotice state="HELD_CONTENT_APPROVAL" />)).toContain('내용 승인이 보류')
  })
  it('등록 관계는 양방향으로 같은 집합이며 미등록을 추론하지 않는다', () => {
    for (const c of v3.choices) for (const m of meaningsForChoice(v3, c.n)) expect(choicesForMeaning(v3, m.id).map((x) => x.n)).toContain(c.n)
    expect(choicesForMeaning(v3, '없는-의미')).toEqual([])
    expect(meaningsForChoice(v3, 99)).toEqual([])
    expect(replaceComparison([1, 3], 0, 3)).toEqual([3, 1])
    expect(replaceComparison([1, 3], 1, 2)).toEqual([1, 2])
  })
  it('AT09·14: 강제 제출·채점·전이 완료 없이 비교를 바로 열 수 있다', () => {
    const html = renderToStaticMarkup(<V3Judgment {...props} />)
    expect(html).toContain('이 탐색으로 전이 완료나 숙달을 판정하지 않아요')
    expect(html).not.toMatch(/type="submit"|textarea|contenteditable/)
    expect(html).toContain('s2b-columns')
  })
  it('AT13: 화면 상태 6종은 서로 다른 이유로 표시한다', () => {
    expect(new Set(Object.values(RESOURCE_STATE_TEXT)).size).toBe(6)
    for (const state of Object.keys(RESOURCE_STATE_TEXT) as (keyof typeof RESOURCE_STATE_TEXT)[]) {
      expect(renderToStaticMarkup(<InquiryResourceNotice state={state} />)).toContain(`data-resource-state="${state}"`)
    }
  })
  it('AT15·22: 바뀐 본문·버전·검수·해시는 결속 실패로 전용 설명/관계를 비운다', () => {
    expect(v3.interaction34?.state).toBe('ready')
    const changed = structuredClone(records['2026#34'])
    changed.v3!.meanings[0].meaning_ko += '변조'
    for (const record of [changed, { ...records['2026#34'], analysis_version: 6 }, { ...records['2026#34'], review: 'legacy' as const }]) {
      const projected = projectInteraction34('2026#34', record)
      expect(projected.v3?.interaction34?.state).toBe('VERIFICATION_FAILED')
      const html = renderToStaticMarkup(<V3Judgment {...props} v3={projected.v3!} />)
      expect(html).not.toContain('s2b-compare')
      expect(html).toContain('자료 결속을 확인하지 못했어요')
    }
    expect(lookupInquiry('2026#34', 6).state).toBe('stale')
    expect(lookupInquiry('없는-문항', 5).state).toBe('missing')
  })
  it('문장 수만 맞거나 실제 원문 해시가 없으면 근거 강조 버튼을 제공하지 않는다', () => {
    for (const hash of [undefined, '다른-해시']) {
      const html = renderToStaticMarkup(<V3Judgment {...props} sourceUnitsHash={hash} />)
      expect(html).toContain('외부 근거 강조를 보류')
      expect(html).not.toContain('번 문장 보기')
    }
    expect(renderToStaticMarkup(<V3Judgment {...props} sourceUnitsHash={v3.units_hash} />)).toContain('번 문장 보기')
  })
  it('AT02·21: 관찰·공식자료·가설을 구별하고 기존 적용 한계를 그대로 보존한다', () => {
    const html = renderToStaticMarkup(<V3Design {...props} />)
    for (const label of ['원문에서 확인', '공식 자료', '설계 가설', '확인하지 못한 부분']) expect(html).toContain(label)
    expect(html).toContain(v3.design.limitation)
  })
  it('등록 의미에서 설계로 오면 관련 근거와 원래 의미로 돌아갈 길을 보존한다', () => {
    const html = renderToStaticMarkup(<V3Design {...props} focus={{ unitLabel: '조건', choices: [], claims: [3], onReturn: () => {} }} />)
    expect(html).toContain('그 의미로 돌아가기')
    expect(html).toContain(v3.design.claims[3].text)
    expect(html).toContain('data-bridge="true"')
  })
})
