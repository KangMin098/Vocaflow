// scripts/__tests__/worktree.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'

function fixture(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-worktree-'))
  const root = path.join(parent, 'Vocaflow')
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.copyFileSync(new URL('../worktree.mjs', import.meta.url), path.join(root, 'scripts/worktree.mjs'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Worktree Test')
  git('config', 'user.email', 'worktree@example.invalid')
  git('add', '.')
  git('commit', '-m', 'fixture')
  t.after(() => {
    assert.ok(path.resolve(parent).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(parent, { recursive: true, force: true })
  })
  const run = (...args) => spawnSync(process.execPath, ['scripts/worktree.mjs', ...args], { cwd: root, encoding: 'utf8' })
  return { root, parent, git, run }
}

test('반복 new는 수정 파일을 보존하고 기존 브랜치 공간을 재사용한다', t => {
  const f = fixture(t)
  assert.equal(f.run('new', 'same', '--no-install').status, 0)
  const file = path.join(f.parent, 'Vocaflow-same', 'keep.txt')
  fs.writeFileSync(file, 'unfinished')
  const result = f.run('new', 'same', '--no-install')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /재사용/)
  assert.equal(fs.readFileSync(file, 'utf8'), 'unfinished')
})

test('새 작업 기본값은 뒤처진 local main 대신 확인된 origin/main이다', t => {
  const f = fixture(t)
  fs.writeFileSync(path.join(f.root, 'latest.txt'), 'latest')
  f.git('add', 'latest.txt'); f.git('commit', '-m', 'latest')
  const latest = f.git('rev-parse', 'HEAD')
  f.git('update-ref', 'refs/remotes/origin/main', latest)
  f.git('switch', '--detach'); f.git('branch', '-f', 'main', 'HEAD~1')
  assert.equal(f.run('new', 'latest', '--no-install').status, 0)
  assert.equal(f.git('rev-parse', 'feat/latest'), latest)
})

test('미통합 커밋이 있으면 worktree와 브랜치를 모두 보존한다', t => {
  const f = fixture(t)
  f.run('new', 'unique', '--no-install')
  const dir = path.join(f.parent, 'Vocaflow-unique')
  fs.writeFileSync(path.join(dir, 'unique.txt'), 'keep')
  execFileSync('git', ['-C', dir, 'add', '.'])
  execFileSync('git', ['-C', dir, 'commit', '-m', 'unique'], { stdio: 'pipe' })
  const result = f.run('remove', 'unique', '--del-branch')
  assert.equal(result.status, 1)
  assert.ok(fs.existsSync(dir))
  assert.ok(f.git('rev-parse', 'feat/unique'))
})

test('등록 공간의 실제 브랜치로 정리하고 추측한 feat 브랜치는 지우지 않는다', t => {
  const f = fixture(t)
  const dir = path.join(f.parent, 'Vocaflow-review')
  f.git('worktree', 'add', '-b', 'review/real', dir)
  f.git('branch', 'feat/review')
  const result = f.run('remove', 'review', '--del-branch')
  assert.equal(result.status, 0, result.stderr)
  assert.ok(f.git('rev-parse', 'feat/review'))
  assert.equal(fs.existsSync(dir), false)
})

test('소유 잠금 또는 미추적 파일이 있는 공간은 제거하지 않는다', t => {
  const f = fixture(t)
  for (const suffix of ['locked', 'dirty']) {
    f.run('new', suffix, '--no-install')
    const dir = path.join(f.parent, `Vocaflow-${suffix}`)
    fs.writeFileSync(path.join(dir, suffix === 'locked' ? '.agent-lock' : 'keep.txt'), 'keep')
    assert.notEqual(f.run('remove', suffix, '--del-branch').status, 0)
    assert.ok(fs.existsSync(dir))
    assert.ok(f.git('rev-parse', `feat/${suffix}`))
  }
})

test('경로 이탈과 셸 base 입력은 변경 전에 거부한다', t => {
  const f = fixture(t)
  assert.equal(f.run('remove', '../outside').status, 1)
  assert.equal(f.run('new', 'unsafe', 'main;echo').status, 1)
  assert.equal(fs.existsSync(path.join(f.parent, 'Vocaflow-unsafe')), false)
})
