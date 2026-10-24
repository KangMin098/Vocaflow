// docs/csat-learner/lecture-audit-c-20261024/f1/validate-candidate/choice-pointing.test.ts
// node --test 로 돈다(Node 24 타입 제거). 실제 강의 796 에 대한 드라이런 포함.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkChoicePointing, spokenHereChoices } from './choice-pointing.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const cue = (id: string, kind: string, tid: string, text: string) => ({ id, target: { kind, id: tid }, segments: [{ lang: 'ko-KR', text }] })

test('선지 번호 가리키기만 센다 — 서수·여기 없는 언급은 제외', () => {
  assert.deepEqual(spokenHereChoices('정답은 사 번. 여기 사 번 문장을 보세요.'), [4])
  assert.deepEqual(spokenHereChoices('여기, 삼 번 문장과 오 번 문장'), [3])
  assert.deepEqual(spokenHereChoices('여기 세 번째 문장을 보세요.'), [])
  assert.deepEqual(spokenHereChoices('사 번 문장을 가리고 이어 읽으세요.'), [])
})

test('ⓝ 문장과 다른 anchor 를 켜면 잡고, 같으면 통과한다', () => {
  const m = { 3: 4, 4: 5 }
  assert.equal(checkChoicePointing([cue('c5', 'anchor', 'sentence:1', '여기 사 번 문장을 보세요.')], m).length, 1)
  assert.equal(checkChoicePointing([cue('c5', 'anchor', 'sentence:5', '여기 사 번 문장을 보세요.')], m).length, 0)
  assert.equal(checkChoicePointing([cue('c5', 'analysis', 'answer', '여기 사 번 문장을 보세요.')], m).length, 1)
  assert.equal(checkChoicePointing([cue('c5', 'anchor', 'sentence:1', '여기 사 번 문장을 보세요.')], null).length, 0)
})

test('드라이런 — main 강의 35번 26문항: 확정 9강의만 걸리고 나머지는 통과', () => {
  const { map } = JSON.parse(fs.readFileSync(path.join(here, 'choice-sentence-map-35.json'), 'utf8'))
  const dir = path.join(root, 'apps/web/src/lib/csat/lecture-data')
  const lectures: Record<string, { cues: Parameters<typeof checkChoicePointing>[0] }> = {}
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'index.json'))
    Object.assign(lectures, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).lectures)
  const hit = Object.keys(map).filter((id) => checkChoicePointing(lectures[id].cues, map[id]).length > 0).sort()
  assert.deepEqual(hit, ['2019#35', '2020#35', '2022#35', 'M1809#35', 'M2006#35', 'M2106#35', 'M2206#35', 'M2209#35', 'M2306#35'])
})
