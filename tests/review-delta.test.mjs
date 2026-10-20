// tests/review-delta.test.mjs — 2026-10-20 간소화: 검증 커밋 뒤 변경이 테스트 · 문서뿐이면 재리뷰 없이 완료, 제품 코드면 재리뷰
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { isTestOrDoc, onlyTestsOrDocsSince } from '../lib/tasks.mjs'

test('분류: 테스트 · 문서만 true, 제품 코드 · 마이그레이션은 false', () => {
  for (const f of ['apps/web/tests/e2e-isolated/a.spec.ts', 'apps/web/src/lib/__tests__/x.ts', 'apps/web/src/lib/a.test.ts', 'docs/X.md', 'README.md']) assert.equal(isTestOrDoc(f), true, f)
  for (const f of ['apps/web/src/lib/a.ts', 'supabase/migrations/1.sql', '.github/workflows/ci.yml', 'package.json']) assert.equal(isTestOrDoc(f), false, f)
})

test('git: 테스트만 더한 커밋은 통과 · 제품 코드 커밋은 거부 · 조상 아님 · 조회 실패는 거부', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-delta-'))
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim()
  git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't')
  fs.mkdirSync(path.join(dir, 'src')); fs.writeFileSync(path.join(dir, 'src/a.ts'), '1')
  git('add', '.'); git('commit', '-qm', 'base')
  const base = git('rev-parse', 'HEAD')
  fs.mkdirSync(path.join(dir, 'tests')); fs.writeFileSync(path.join(dir, 'tests/a.spec.ts'), 't')
  git('add', '.'); git('commit', '-qm', 'test only')
  const testOnly = git('rev-parse', 'HEAD')
  assert.equal(onlyTestsOrDocsSince(dir, base, testOnly), true)
  fs.writeFileSync(path.join(dir, 'src/a.ts'), '2')
  git('commit', '-qam', 'code')
  const code = git('rev-parse', 'HEAD')
  assert.equal(onlyTestsOrDocsSince(dir, base, code), false)
  assert.equal(onlyTestsOrDocsSince(dir, code, base), false, '조상이 아니면 거부')
  assert.equal(onlyTestsOrDocsSince(dir, 'deadbeef', code), false, '없는 커밋 = fail closed')
  assert.equal(onlyTestsOrDocsSince(null, base, code), false)
  fs.rmSync(dir, { recursive: true, force: true })
})
