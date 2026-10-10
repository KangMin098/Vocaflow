// tests/review-base.test.mjs — 리뷰 시작점은 제출 커밋의 조상이어야 한다(T-0019 3차 거짓 P1 실측)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { reviewBase } from '../lib/orchestrator.mjs'

test('제출 뒤 다른 브랜치를 병합하고 재인수해도 시작점은 제출 커밋의 조상(병합 커밋이 아님)', () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-rb-'))
  const g = (...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8' }).trim()
  const commit = (f, msg) => {
    fs.writeFileSync(path.join(wt, f), msg)
    g('add', f)
    g('commit', '-q', '-m', msg)
    return g('rev-parse', 'HEAD')
  }
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  const A = commit('a.txt', 'A')
  g('checkout', '-q', '-b', 'feat/x')
  const B = commit('b.txt', 'B') // 제출 커밋
  g('checkout', '-q', '-b', 'other', A)
  commit('o.txt', 'O')
  g('checkout', '-q', 'feat/x')
  g('merge', '-q', '--no-edit', 'other')
  const C = g('rev-parse', 'HEAD') // 재인수 때의 HEAD(B 보다 뒤)
  const task = { worktree: wt, run: { start_head: C }, orchestration: { base_commit: A } }
  assert.equal(reviewBase(task, B), A, '병합 커밋 C 는 B 의 조상이 아니므로 건너뛴다')
  // 후보가 모두 조상이 아니면 merge-base(main, head)
  assert.equal(reviewBase({ worktree: wt, run: { start_head: C } }, B), A)
  // 정상: 첫 인수 기준이 조상이면 그대로
  assert.equal(reviewBase({ worktree: wt, dispatch: { review_base: A }, run: { start_head: C } }, B), A)
})
