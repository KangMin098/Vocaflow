// agents/scripts/__tests__/development.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decide } from '../safe-merge.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'

test('Next 빌드 검사는 동일 SHA의 필수 병렬 CI에 위임하고 로컬·다른 SHA에는 위임하지 않는다', async () => {
  const config = (await import(pathToFileURL(path.join(root, 'apps/web/next.config.mjs')))).default
  const keys = ['CI', 'GITHUB_SHA', 'VOCAFLOW_STATIC_CHECK_SHA']
  const before = keys.map((k) => process.env[k])
  const sha = 'a'.repeat(40)
  try {
    for (const [ci, head, proof, expected] of [
      ['', '', '', false], ['false', sha, sha, false],
      ['true', sha, 'b'.repeat(40), false], ['true', '', '', false],
      ['true', sha, sha, true],
    ]) {
      for (const [i, v] of [ci, head, proof].entries()) process.env[keys[i]] = v
      const c = config('phase-production-server')
      assert.equal(c.eslint.ignoreDuringBuilds, expected)
      assert.equal(c.typescript.ignoreBuildErrors, expected)
    }
  } finally {
    keys.forEach((k, i) => { if (before[i] === undefined) delete process.env[k]; else process.env[k] = before[i] })
  }
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
  for (const job of ['build', 'e2e', 'e2e-shared-dev', 'e2e-gate-faultclosed']) {
    const block = workflow.split(`  ${job}:`)[1].split(/\r?\n  [a-z][\w-]*:/)[0]
    assert.doesNotMatch(block, /needs: verify/)
    assert.match(block, /VOCAFLOW_STATIC_CHECK_SHA: \$\{\{ github.sha \}\}/)
  }
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'agents/policies/pr-automation.json'), 'utf8'))
  assert.ok(policy.required_checks.includes('verify'))
  for (const result of ['FAILURE', 'CANCELLED', 'SKIPPED', '']) {
    const checks = policy.required_checks.map((name) => ({
      name, status: name === 'verify' && !result ? 'IN_PROGRESS' : 'COMPLETED',
      conclusion: name === 'verify' ? result : 'SUCCESS',
    }))
    assert.equal(decide({ state: 'OPEN', mergeable: 'MERGEABLE', statusCheckRollup: checks }, {
      required: policy.required_checks,
    }).ok, false, `parallel builds cannot replace verify: ${result || 'pending'}`)
  }
})

test('타입 체크 호환 이름은 실제 verify에 종속하며 실패·취소·미실행을 성공으로 바꾸지 않는다', () => {
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
  const sync = fs.readFileSync(path.join(root, '.github/workflows/sync-check.yml'), 'utf8')
  assert.match(ci, /name: TypeScript 0 error\r?\n\s+needs: verify\r?\n\s+if: always\(\)/)
  assert.doesNotMatch(sync, /tsc --noEmit/)
  assert.match(ci, /pnpm turbo run lint typecheck test/)
  for (const state of ['success', 'failure', 'cancelled', 'skipped']) {
    const r = spawnSync(bash, ['-c', `test '${state}' = 'success'`])
    assert.equal(r.status, state === 'success' ? 0 : 1, state)
  }
})

test('일반 커밋은 메모리 미러 검사 0회, 미러 커밋은 오래된 내용 차단·인덱스 보존', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-hook-scope-'))
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
  git('init', '-q')
  fs.mkdirSync(path.join(dir, 'scripts'))
  fs.writeFileSync(path.join(dir, 'scripts/sync-export-memory.mjs'), "import fs from 'node:fs';fs.writeFileSync('.mirror-called','1');process.exit(1)\n")
  fs.writeFileSync(path.join(dir, 'normal.txt'), 'fixture\n')
  git('add', 'normal.txt')
  const hook = path.join(root, '.githooks/pre-commit')
  assert.equal(spawnSync(bash, [hook], { cwd: dir }).status, 0)
  assert.equal(fs.existsSync(path.join(dir, '.mirror-called')), false)
  fs.mkdirSync(path.join(dir, 'docs/AI_CONTEXT'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'docs/AI_CONTEXT/fixture.md'), 'stale fixture\n')
  git('add', 'docs/AI_CONTEXT/fixture.md')
  const before = git('ls-files', '--stage')
  assert.equal(spawnSync(bash, [hook], { cwd: dir }).status, 1)
  assert.equal(fs.existsSync(path.join(dir, '.mirror-called')), true)
  assert.equal(git('ls-files', '--stage'), before)
})
