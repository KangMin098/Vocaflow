// scripts/csat/__tests__/lecture-wrapup-scope-audit.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { auditLectures, ruleSentences, unscopedRules } from '../lecture-wrapup-scope-audit.mjs'

const cue = (id, role, text) => ({ id, role, segments: [{ lang: 'ko-KR', text }, { lang: 'en-US', text: 'if it is possible' }] })

test('습관 안내 문장과 머리말은 규칙에서 뺀다', () => {
  assert.deepEqual(
    ruleSentences('정리합니다. 대비 틀 빈칸은 밀려난 쪽의 반대를 고릅니다. 다음에는 첫 십 초에 빈칸 앞 지시어부터 표시하세요.'),
    ['대비 틀 빈칸은 밀려난 쪽의 반대를 고릅니다.'],
  )
})

test('대량작업 C 확정 형태 — 조건절이나 유형 전체 주어 뒤 단정 결론을 잡는다', () => {
  for (const s of [
    '선지가 한국어면, 명령문의 목적어와 조건을 함께 담은 선지가 주제입니다.',
    '지시어 빈칸은 바로 앞 문장의 목적어와 거기 붙은 부정어를 담은 선지를 고릅니다.',
    '결과를 잇는 말 아래 두 결과는 같은 원인에서 나오니 방향이 같아야 합니다.',
    '평가 선지는 따옴표 안 형용사로만 판정하세요.',
  ]) assert.equal(unscopedRules(`정리합니다. ${s}`).length, 1, s)
})

test('「긍정이 지문」 속 「이 지문」을 범위 표지로 읽지 않는다', () => {
  assert.deepEqual(unscopedRules('그 긍정이 지문에 있으면 답입니다.'), ['그 긍정이 지문에 있으면 답입니다.'])
})

test('인용된 표지 속 「일 때만」은 범위로 치지 않고, 「가져옵니다」는 결론 낱말로 치지 않는다', () => {
  assert.equal(unscopedRules('주어진 글이 무엇일 때만으로 끝나면 그 답을 주는 단락이 먼저 옵니다.').length, 1)
  assert.deepEqual(unscopedRules('예시 문장은 앞의 개념을 가져옵니다.'), [])
})

test('적용 범위나 확인 단계를 단 규칙은 통과한다', () => {
  for (const s of [
    '이 문항에서는 지시어가 받는 앞 문장의 명사구를 다시 이름 붙인 선지가 답입니다.',
    '불일치를 묻는 문항일 때만, 그 긍정이 지문에 있으면 답에서 지웁니다.',
    '세미콜론 뒤 밑줄은 연결어부터 보고 같은 방향인지 확인하세요.',
  ]) assert.deepEqual(unscopedRules(s), [], s)
})

test('뒤 문장의 검산 지시는 앞 규칙의 범위를 만들지 않는다', () => {
  assert.equal(unscopedRules('정동사가 이미 있으면 그 자리는 분사입니다. 빼고 이어 읽히는지 확인하세요.').length, 1)
})

test('wrapup 역할만 검사하고 강의·cue 위치를 돌려준다', () => {
  const flags = auditLectures({
    'X#1': { version: 2, cues: [cue('c1', 'intro', '대비 틀 빈칸은 밀려난 쪽의 반대를 고릅니다.'), cue('c9', 'wrapup', '정리합니다. 대비 틀 빈칸은 밀려난 쪽의 반대를 고릅니다.')] },
    'X#2': { version: 1, cues: [cue('c9', 'wrapup', '정리합니다. 이번 문항은 대비 틀이라 밀려난 쪽의 반대를 고릅니다.')] },
  })
  assert.deepEqual(flags.map(f => [f.item_id, f.version, f.cue_id]), [['X#1', 2, 'c9']])
})
