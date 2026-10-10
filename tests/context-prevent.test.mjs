// tests/context-prevent.test.mjs — Work 재질의 예방: 문서 절(§N) 통째 발췌 · 사용자 결정 대기 항목 식별
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { docSections, awaitingUser } from '../lib/context.mjs'

test('docSections: §N 제목 절을 같은 수준 다음 제목 전까지 꺼내고, 숫자 제목(「15.」)도 찾는다 · 없는 절은 빈 결과', () => {
  const doc = ['# 문서', '## 14. 이전', 'a', '## 15. 학년별 권장 노출', '| 학교급 | LP |', '### 15.1 세부', 'b', '## 16. 다음', 'c'].join('\n')
  const [s] = docSections(doc, ['§15'])
  assert.equal(s.ref, '§15')
  assert.match(s.body, /학년별 권장 노출[\s\S]*15\.1 세부[\s\S]*b$/)
  assert.doesNotMatch(s.body, /16\. 다음/)
  assert.equal(docSections('## §3 원리\nx\n## §4\ny', ['§3'])[0].body, '## §3 원리\nx')
  assert.deepEqual(docSections(doc, ['§99']), [])
})

test('awaitingUser: 보류·승인 대기·동의가 필요한 방향만 — 진행할 방향은 빼지 않는다', () => {
  const g = { next_scope: ['C 학년별 권장 노출', 'B — 보류: DB 변경(B-1)이 사용자 승인 대기', 'D 실제 학습자 효과 검증(동의·별도 승인 뒤)'] }
  assert.deepEqual(awaitingUser(g).map((x) => x[0]), ['B', 'D'])
  assert.deepEqual(awaitingUser({}), [])
})
