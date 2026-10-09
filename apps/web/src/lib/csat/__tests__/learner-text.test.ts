// apps/web/src/lib/csat/__tests__/learner-text.test.ts
// 학습자 화면의 분석 작업 메모 거르기 — 실제 노출 문장(2026-10-09 실측)으로
import { describe, expect, it } from 'vitest'

import { hasInternalNote, reasoningRepeats, stripInternalNotes } from '../learner-text'

describe('stripInternalNotes', () => {
  it('메모 문장(「참고: 저장된 지문은 2단 병합…」)을 지우고 나머지 설명은 남긴다 — 2022#39', () => {
    const s = 'But 이 뒤집는 대비도 맞물린다. 참고: 저장된 지문은 2단 병합 탓에 이 문장이 끊겨 있어 이어져 있는 뒷조각을 인용했다. 무성 흑백 영화가 착각을 만든다.'
    expect(stripInternalNotes(s)).toBe('But 이 뒤집는 대비도 맞물린다. 무성 흑백 영화가 착각을 만든다.')
  })
  it('메모가 든 괄호 덩어리만 지운다 — 2015#35', () => {
    const s = "결론이 아니라 다른 층위의 이야기로 보인다. (파싱 잔여 'Although ort technology' 가 문두를 더 어색하게 만든다.)"
    expect(stripInternalNotes(s)).toBe('결론이 아니라 다른 층위의 이야기로 보인다.')
  })
  it('지문 내용(QR 스캔 · 데이터에 기반 · 병합(merge))은 건드리지 않는다', () => {
    for (const s of ['Scan the QR code 가 선지 ③의 QR 코드를 스캔하여와 대응한다.', '데이터에 기반한 판단은 관용 문장이다.', '병합(merge)·일과(routine) 같은 설명 낱말로 오답을 만든다.']) {
      expect(stripInternalNotes(s)).toBe(s)
      expect(hasInternalNote(s)).toBe(false)
    }
  })
  it('메모뿐이면 null — 빈 문단을 만들지 않는다', () => {
    expect(stripInternalNotes('코퍼스 지문 끝에 OCR 잔여가 섞여 있다.')).toBeNull()
    expect(stripInternalNotes(null)).toBeNull()
  })
})

describe('reasoningRepeats — 「답이 왜 이것인가」 같은 근거 두 번(실제 2022 문항)', () => {
  it('2022#40: 근거 해설의 인용이 모두 정답 설명에 있으면 되풀이(한 번만 보인다)', () => {
    const why = "(A) 칸: 요약문의 '(A) number of principles covering all observations' 는 첫째 견해를 받는데 … 'the more economical the systematization, the deeper our understanding' 이 … (B) 칸: 마지막 문장 'the explanation of scientific generalizations comes from the causal mechanisms that produce the regularities' 의 regularities"
    const reasoning = "요약문 (A)는 'the (A) number of principles covering all observations' 자리다. 뒤이어 'the more economical the systematization, the deeper our understanding' 이 비교급으로 못 박는다. (B)는 마지막 문장 'the explanation of scientific generalizations comes from the causal mechanisms that produce the regularities' 의 regularities 를 받는다."
    expect(reasoningRepeats(why, reasoning)).toBe(true)
  })
  it('2022#33: 근거 해설이 새 인용(access to local forums · For that reason)을 더하면 보인다', () => {
    const why = "마지막 문장 'Political institutions … must allow users to devise their own regulations and independently ensure observance' 가 … 'devise their own regulations' 와 5문장 'the importance of democratic decision processes'"
    const reasoning = "사용자가 자기 규칙을 스스로 만들 수 있어야 한다(devise their own regulations). 문장 5의 'the importance of democratic decision processes' 와 'access to local forums' 가 같은 것을 다시 말한다. 문장 3의 'For that reason' 도 같은 방향을 확인해 준다."
    expect(reasoningRepeats(why, reasoning)).toBe(false)
  })
  it('인용이 없거나 한쪽이 비면 되풀이로 보지 않는다', () => {
    expect(reasoningRepeats('정답 설명', '근거 해설에는 영어 인용이 없다')).toBe(false)
    expect(reasoningRepeats(null, "'some quoted words here'")).toBe(false)
  })
})
