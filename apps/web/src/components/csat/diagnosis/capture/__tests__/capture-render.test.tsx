// apps/web/src/components/csat/diagnosis/capture/__tests__/capture-render.test.tsx
//
// 풀이 증거 수집 화면의 약속 — 학생 화면에 원인 이름 · 경계 · taxonomy · 연구 용어가 없다, 정오를 드러내지 않는다,
// 선택지는 라벨이 붙은 radio 다, 막힌 곳은 키보드로 고를 수 있는 버튼이다, 해석은 3상태로 고른다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { currentProbe, studentProbe } from '@/lib/csat/ec-pilot/probes'
import type { CaptureItem } from '@/lib/csat/ec-pilot/server'

import { EMPTY_FORM, ItemForm, ProbeQuestion } from '../CaptureModal'

const ITEM: CaptureItem = {
  itemNo: 22,
  chosen: 3,
  stem: '다음 글의 요지로 가장 적절한 것은?',
  passage: [{ sentence: 0, text: 'War is inconceivable without some image.' }, { sentence: 1, text: 'It shapes how we fight.' }],
  choices: ['첫째 선지', '둘째 선지', '셋째 선지', '넷째 선지', '다섯째 선지'].map((text, i) => ({ no: i + 1, text })),
  saved: { reason: false, blocked: false, interpretation: null, category: false },
}
const FORBIDDEN = /[VSREBX]\.[a-z_]{3,}|taxonomy|provisional|boundary|multiple_plausible|경계|원인|진단 코드|정답|오답|틀린|맞은/

describe('ItemForm', () => {
  const html = renderToString(<ItemForm item={ITEM} form={{ ...EMPTY_FORM, mode: 'answered' }} setForm={() => {}} />)
  const text = html.replace(/<[^>]+>/g, ' ')

  it('학생 문구에 내부 용어 · 정오 표현이 없다', () => {
    expect(text).not.toMatch(FORBIDDEN)
  })

  it('해석은 3상태(적기 · 잘 모르겠어요 · 건너뛰기) radio', () => {
    for (const label of ['내가 이해한 뜻 적기', '잘 모르겠어요', '건너뛰기']) expect(text).toContain(label)
    expect(html.match(/role="radio"/g)!.length).toBeGreaterThanOrEqual(3 + 7)
    expect(html).toMatch(/role="radiogroup" aria-labelledby="interp-22"/)
  })

  it('학생 범주 7개 — 근거 찾기 · 문제·선지 판단 포함', () => {
    for (const label of ['단어 · 표현', '문장 해석', '글의 흐름', '근거 찾기', '문제 · 선지 판단', '시간 · 집중']) expect(text).toContain(label)
  })

  it('막힌 곳 — 문장 · 선지는 aria-pressed 버튼, 「막힌 곳 없음」 선택지', () => {
    expect(html.match(/<button[^>]*aria-pressed="false"/g)!.length).toBe(ITEM.passage.length + ITEM.choices.length + 1)
    expect(text).toContain('막힌 곳 없음')
  })

  it('입력은 라벨이 붙은 textarea(placeholder 로 대신하지 않음)', () => {
    expect(html).toMatch(/<label[^>]*>.*이 답을 고른 이유.*<textarea/)
    expect(html).not.toMatch(/placeholder=/)
  })
})

describe('ProbeQuestion', () => {
  const probe = { itemNo: 22, probe: studentProbe(currentProbe('r6_derivation_probe')!) }
  const html = renderToString(<ProbeQuestion probe={probe} choice={null} onChoose={() => {}} />)
  const text = html.replace(/<[^>]+>/g, ' ')

  it('「한 가지만 더 확인할게요」 + A–D radio · 내부 용어 없음', () => {
    expect(text).toContain('한 가지만 더 확인할게요')
    expect(html.match(/role="radio"/g)).toHaveLength(4)
    expect(text).not.toMatch(FORBIDDEN)
  })
})
