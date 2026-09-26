// agents/scripts/__tests__/handoff-inject.test.mjs
// 실행: node --test agents/scripts/__tests__/*.test.mjs
//
// 세션 시작 경고 「안전장치 낡음」 — 워크트리의 가드가 main 보다 뒤처지면 두 에이전트 모두에게 알린다.
// git 은 주입한다: 실제 저장소 상태(지금 main 보다 몇 커밋 뒤인가)에 기대면 시험이 저절로 깨진다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { injection, SAFETY_PATHS, staleSafetyCommits } from '../handoff-inject.mjs'

/** rev-list 결과만 바꿔 끼우는 가짜 git. origin/main 이 없으면 rev-parse 가 던진다. */
const fakeGit = ({ behind, hasMain = true }) => (args) => {
  if (args[0] === 'rev-parse') {
    if (!hasMain) throw new Error('unknown revision')
    return 'abc\n'
  }
  if (args[0] === 'rev-list') {
    assert.deepEqual(args.slice(-SAFETY_PATHS.length), SAFETY_PATHS, '안전장치 경로만 센다')
    return `${behind}\n`
  }
  throw new Error(`예상 밖 git 호출: ${args.join(' ')}`)
}

test('안전장치: main 보다 뒤처진 커밋 수를 센다', () => {
  assert.equal(staleSafetyCommits(fakeGit({ behind: 3 })), 3)
  assert.equal(staleSafetyCommits(fakeGit({ behind: 0 })), 0)
})

test('안전장치: origin/main 이 없거나 git 이 실패하면 경고하지 않는다(세션 시작을 막지 않는다)', () => {
  assert.equal(staleSafetyCommits(fakeGit({ behind: 3, hasMain: false })), null)
  assert.equal(staleSafetyCommits(() => { throw new Error('git 없음') }), null)
})

test('주입: 뒤처졌으면 두 에이전트 모두에게 경고한다', () => {
  for (const agent of ['claude', 'codex'])
    assert.match(injection(agent, fakeGit({ behind: 2 })), /\[안전장치 낡음\][^\n]*커밋 2개 뒤/)
})

test('주입: 최신이면 안전장치 경고를 내지 않는다', () => {
  assert.doesNotMatch(injection('codex', fakeGit({ behind: 0 })), /안전장치 낡음/)
})
