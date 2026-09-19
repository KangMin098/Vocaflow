// agents/scripts/__tests__/guard.test.mjs
// 실행: node --test agents/scripts/__tests__
//
// 판정표 회귀 — 막아야 할 것은 막고, **일상 명령은 절대 막지 않는다**(오탐 한 건이 모든 세션을 멈춘다).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { explain } from '../guard.mjs'

const BLOCK = [
  String.raw`rm -rf node_modules`,
  String.raw`rm -fr build`,
  String.raw`rm -r -f dist`,
  String.raw`rm --recursive --force out`,
  String.raw`cd apps/web && rm -rf .next`,
  String.raw`bash -c "rm -rf /tmp/x"`,
  String.raw`sudo rm -Rf /`,
  String.raw`Remove-Item -Recurse -Force .\tmp`,
  String.raw`Remove-Item .\tmp -Force -Recurse`,
  String.raw`rm -r -fo tmp`,
  String.raw`rd /s /q build`,
  String.raw`del /s /q *.log`,
  String.raw`git push --force`,
  String.raw`git push -f origin feat/x`,
  String.raw`git push origin feat/x --force-with-lease`,
  String.raw`git push origin +feat/x`,
  String.raw`git push origin main`,
  String.raw`git push origin HEAD:main`,
  String.raw`git push -u origin feat/x:refs/heads/main`,
  String.raw`git -C ../other push --force`,
  String.raw`git commit --no-verify -m x`,
  String.raw`git commit -nm x`,
  String.raw`git push --no-verify`,
  String.raw`git reset --hard HEAD~1`,
  String.raw`git clean -fdx`,
  String.raw`git checkout -- .`,
  String.raw`git restore .`,
  String.raw`git stash`,
  String.raw`git stash push -m wip`,
  String.raw`cat .env`,
  String.raw`cat apps/web/.env.local`,
  String.raw`type .env.local`,
  String.raw`Get-Content apps\web\.env.local`,
  String.raw`head -5 .env.production`,
  String.raw`grep KEY .env.local`,
  String.raw`echo ok; cat ".env"`,
]

const ALLOW = [
  String.raw`rm -r tmp/x`,
  String.raw`rm -f a.txt`,
  String.raw`rm file.txt`,
  String.raw`Remove-Item -Force a.txt`,
  String.raw`Remove-Item -Recurse .\tmp`,
  String.raw`git push`,
  String.raw`git push -u origin pc2-20260720-1`,
  String.raw`git push origin feat/maintenance`,
  String.raw`git status --short`,
  String.raw`git diff --stat`,
  String.raw`git log --oneline -5`,
  String.raw`git commit --only AGENTS.md -m "docs: rm -rf 금지 규칙 추가"`,
  "git commit --only a.md -F - <<'MSG'\nfeat: guard\n\nrm -rf 와 git push --force 를 막는다\nMSG",
  String.raw`git stash list`,
  String.raw`git checkout -b feat/x`,
  String.raw`git restore apps/web/src/a.ts`,
  String.raw`git clean -n`,
  String.raw`cat .env.example`,
  String.raw`node --env-file=apps/web/.env.local scripts/x.mjs`,
  String.raw`node --env-file=.env.local scripts/seed-dictionary.mjs --dry-run`,
  String.raw`pnpm turbo run lint typecheck test`,
  String.raw`pnpm --filter web exec vitest run src/lib`,
  String.raw`echo "rm -rf is blocked"`,
  String.raw`grep -rn "git push --force" docs`,
  String.raw`ls -la .env.local`,
  String.raw`npx supabase db diff --use-migra`,
]

for (const c of BLOCK) test(`BLOCK  ${c.split('\n')[0]}`, () => assert.ok(explain(c).length > 0, `막혀야 한다: ${c}`))
for (const c of ALLOW) test(`ALLOW  ${c.split('\n')[0]}`, () => assert.deepEqual(explain(c), [], `통과해야 한다: ${c}`))

// ── D4: 두 도구의 실제 훅 입력 형식으로 CLI 를 돌린다 (exit 2 = 차단 · 0 = 통과) ──────────────
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'guard.mjs')
const hook = (agent, payload) =>
  spawnSync(process.execPath, [CLI, '--agent', agent], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, AGENT_GUARD_SKIP_LINT: '1', AGENT_GUARD_NO_LOG: '1' } })

const DESTRUCTIVE = ['rm -rf ./__probe__', 'git push --force origin x', 'cat apps/web/.env.local']
const claudePayload = (command, tool = 'Bash') => ({ session_id: 's', hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command } })
// Codex: Bash 는 tool_input.command 문자열, 옛 shell 도구는 argv 배열
const codexPayload = (command) => ({ session_id: 's', hook_event_name: 'PreToolUse', turn_id: 't', cwd: '.', model: 'm', tool_name: 'Bash', tool_use_id: 'u', tool_input: { command } })
const codexShellPayload = (command) => ({ hook_event_name: 'PreToolUse', tool_name: 'shell', tool_input: { command: ['bash', '-lc', command] } })

for (const c of DESTRUCTIVE) {
  test(`D4 claude Bash 차단: ${c}`, () => {
    const r = hook('claude', claudePayload(c))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /\[agents\/guard\] 차단 \(claude\)/)
  })
  test(`D4 claude PowerShell 차단: ${c}`, () => assert.equal(hook('claude', claudePayload(c, 'PowerShell')).status, 2))
  test(`D4 codex Bash 차단: ${c}`, () => {
    const r = hook('codex', codexPayload(c))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /\[agents\/guard\] 차단 \(codex\)/)
  })
  test(`D4 codex shell(argv) 차단: ${c}`, () => assert.equal(hook('codex', codexShellPayload(c)).status, 2))
}

test('D4 일상 명령과 셸이 아닌 도구는 통과', () => {
  assert.equal(hook('claude', claudePayload('git status --short')).status, 0)
  assert.equal(hook('codex', codexPayload('pnpm turbo run test')).status, 0)
  assert.equal(hook('codex', { tool_name: 'apply_patch', tool_input: { command: 'rm -rf x' } }).status, 0)
  assert.equal(hook('claude', { tool_name: 'Read', tool_input: { file_path: 'a' } }).status, 0)
  assert.equal(spawnSync(process.execPath, [CLI], { input: 'not json', encoding: 'utf8' }).status, 0)
})
