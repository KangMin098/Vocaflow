// scripts/csat/__tests__/sentence-count.test.mjs
// 평가원 해설 문장 번호 기준(kice-sentence-v3) — 합성 지문(평가원 원문 미포함)으로 경계 고정
import assert from 'node:assert/strict'
import test from 'node:test'
import { countSentences, SENTENCE_RULE } from '../lib-sentence-count.mjs'

const texts = (p) => countSentences(p).sentences.map((s) => s.text)

test('규칙 버전이 고정돼 있다', () => assert.equal(SENTENCE_RULE, 'kice-sentence-v3'))

test('일반 산문 · 약어 · 소수점', () => {
  assert.deepEqual(texts('Mr. Kim left at 2 p.m. today. It cost 3.5 dollars. Then he rested!'),
    ['Mr. Kim left at 2 p.m. today.', 'It cost 3.5 dollars.', 'Then he rested!'])
  // 「No.」 는 숫자 앞에서만 약어
  assert.deepEqual(texts('No. I cannot go. We left.'), ['No.', 'I cannot go.', 'We left.'])
  assert.deepEqual(texts('Take bus No. 5 today. We left.'), ['Take bus No. 5 today.', 'We left.'])
})

test('대화문: 인용 뒤 발화 설명은 붙인다(대문자 이름으로 시작해도)', () => {
  assert.deepEqual(texts('He sat down. “What are you doing, Sweetie?” Nathan asked with interest. She kept drawing.'),
    ['He sat down.', '“What are you doing, Sweetie?” Nathan asked with interest.', 'She kept drawing.'])
  assert.deepEqual(texts('“Luck just didn’t run my way.” Nancy said to herself, with a long sigh. A knock came.'),
    ['“Luck just didn’t run my way.” Nancy said to herself, with a long sigh.', 'A knock came.'])
})

test('대화문: 따옴표 안 독립 문장은 각각 센다', () => {
  assert.deepEqual(texts('“I can’t go. It is too late,” she said. We left.'),
    ['“I can’t go.', 'It is too late,” she said.', 'We left.'])
})

test('발화 동사가 없는 다음 문장은 붙이지 않는다', () => {
  assert.deepEqual(texts('“Stop!” The car halted at once. Everyone was quiet.'),
    ['“Stop!”', 'The car halted at once.', 'Everyone was quiet.'])
})

test('인용 뒤 새 문장 속 발화 동사는 설명이 아니다(첫 세 낱말 · 조동사 · 단락 표지)', () => {
  // 합성 문장 — 실제 지문에서 v2 가 삼킨 꼴과 같은 구조
  assert.equal(countSentences('He said, “Let’s go!” Both Tom and Ann agreed and left.').sentences.length, 2)
  assert.equal(countSentences('She shouted, “Look!” Her brother, however, seemed to say nothing.').sentences.length, 2)
  assert.equal(countSentences('It is “twice unhappy.” Laurence Thomas has suggested that “negative” moods help.').sentences.length, 2)
  assert.equal(countSentences('We ask, “What good are you?” (A) Abilities said to “make us human” exist.').sentences.length, 2)
  // 진짜 설명은 그대로 붙는다
  assert.equal(countSentences('“Fine,” Mia reluctantly agreed. She left.').sentences.length, 2)
})

test('장문 단락 표지 (A)~(D)는 세지 않고 문제지 순서로 잇는다', () => {
  assert.deepEqual(texts('(A) Jeremy was a teacher. He worked hard. (C) Later he changed. (B) Before long, reality hit.'),
    ['(A) Jeremy was a teacher.', 'He worked hard.', '(C) Later he changed.', '(B) Before long, reality hit.'])
  // 표지가 홀로 떨어져 있어도 문장이 아니다
  assert.equal(countSentences('First part ends here. (B) Second part begins now.').sentences.length, 2)
})

test('선지 기호는 경계를 만들지 않는다 · 구두점만 조각은 앞에 붙는다', () => {
  assert.deepEqual(texts('There are no seats, ① an angry lady told the clerk. She left.'),
    ['There are no seats, ① an angry lady told the clerk.', 'She left.'])
  assert.equal(countSentences('One sentence here. . Another sentence there.').sentences.length, 2)
})

test('선지 기호로 시작하는 문장도 경계가 지워지지 않는다', () => {
  assert.deepEqual(texts('He left. ① She stayed. They waited.'), ['He left.', '① She stayed.', 'They waited.'])
})

test('곧은 작은따옴표 대화에도 발화 설명이 붙는다(따옴표 모양과 무관)', () => {
  assert.deepEqual(texts("'Stop!' Nathan shouted. She left."), ["'Stop!' Nathan shouted.", 'She left.'])
  assert.equal(countSentences('“Stop!” Nathan shouted. She left.').sentences.length, 2)
})

test('홑따옴표로 이어지는 새 발화는 앞 인용의 설명이 아니다(겹따옴표와 같은 결과)', () => {
  assert.deepEqual(texts("'Stop!' 'He said no.' She left."), ["'Stop!'", "'He said no.'", 'She left.'])
  assert.equal(countSentences('“Stop!” “He said no.” She left.').sentences.length, 3)
  assert.equal(countSentences('‘Stop!’ ‘He said no.’ She left.').sentences.length, 3)
  // 설명 절 안의 따옴표 낱말은 설명의 일부, 구두점 있는 인용은 새 발화
  assert.equal(countSentences('"No!" Nancy said in a "firm" voice. She left.').sentences.length, 2)
  assert.equal(countSentences('"No!" Nancy said in a firm voice. She left.').sentences.length, 2)
  assert.equal(countSentences('"Wait." She told him, "Come back." He left.').sentences.length, 3)
  assert.equal(countSentences("'Wait.' She told him, 'Come back.' He left.").sentences.length, 3)
  assert.equal(countSentences('‘Wait.’ She told him, ‘Come back.’ He left.').sentences.length, 3)
  assert.equal(countSentences("'No!' Nancy said in a 'firm' voice. She left.").sentences.length, 2)
  assert.equal(countSentences('‘No!’ Nancy’s mom said quietly. She left.').sentences.length, 2)
  // 설명 절의 약어 마침표·선지 기호는 판정을 바꾸지 않는다
  assert.equal(countSentences('"Stop!" Dr. Kim shouted. She left.').sentences.length, 2)
  assert.equal(countSentences('"No!" ① Nancy reluctantly agreed. She left.').sentences.length, 2)
  assert.equal(countSentences('"No!" Nancy reluctantly agreed. She left.').sentences.length, 2)
  // 설명 절 안의 소유격 홑따옴표는 그대로 설명으로 붙는다
  assert.deepEqual(texts("'Stop!' Nathan's mom said. She left."), ["'Stop!' Nathan's mom said.", 'She left.'])
})

test('빈칸으로 시작하는 문장도 따로 센다(연결어 빈칸)', () => {
  assert.deepEqual(texts('Television adds code. ______(B) , the new phones are digital. (A) (B)'),
    ['Television adds code.', '______(B) , the new phones are digital. (A) (B)'])
})

test('오프셋이 원문과 일치한다', () => {
  const p = 'Alpha beta. “Gamma?” she asked. Delta.'
  for (const s of countSentences(p).sentences) assert.equal(p.slice(s.start, s.end), s.text)
})
