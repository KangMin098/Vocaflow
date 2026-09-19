// agents/scripts/__tests__/handoff.test.mjs
// 실행: node --test agents/scripts/__tests__/*.test.mjs
//
// D6 — 산출물 필수 6항목 · D8 — Claude → Codex → Claude 왕복 후 브랜치·변경 파일이 이어진다.
// 공유 워크스페이스를 건드리지 않도록 임시 git 저장소에 스크립트를 복사해 그 안에서 돌린다.
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-handoff-'))
const env = { ...process.env, AGENT_HANDOFF_DIR: '', AGENT_LOCK_FILE: '', HOME: repo, USERPROFILE: repo, CODEX_HOME: path.join(repo, '.codex-home') }
delete env.AGENT_HANDOFF_DIR
delete env.AGENT_LOCK_FILE
const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })
const node = (script, ...a) => spawnSync(process.execPath, [path.join(repo, 'agents/scripts', script), ...a], { cwd: repo, env, encoding: 'utf8' })
const write = (f, t) => fs.writeFileSync(path.join(repo, f), t)
let holder

before(() => {
  g('init', '-q', '-b', 'feat/x')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 't')
  fs.mkdirSync(path.join(repo, 'agents/scripts'), { recursive: true })
  for (const f of fs.readdirSync(SRC)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(SRC, f), path.join(repo, 'agents/scripts', f))
  write('.gitignore', '.agent-handoff/\n.agent-lock\n.agent-logs/\nagents/\n')
  write('a.txt', 'base\n')
  g('add', '.gitignore', 'a.txt')
  g('commit', '-q', '-m', 'base')
  holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { stdio: 'ignore' })
})
after(() => {
  holder?.kill()
  fs.rmSync(repo, { recursive: true, force: true })
})

test('D6: 필수 항목을 비우면 exit 1 + validate FAIL', () => {
  const r = node('handoff.mjs', 'claude', 'codex')
  assert.equal(r.status, 1)
  const v = node('handoff.mjs', '--validate')
  assert.equal(v.status, 1)
  assert.match(v.stdout, /비어 있음: 3\. 완료된 것/)
  assert.match(v.stdout, /수용 기준이 비어 있음/)
})

test('D8: Claude → Codex → Claude 왕복', () => {
  // ① Claude 가 일하다 한도에 걸린다
  assert.equal(node('lock.mjs', 'acquire', 'claude', '--pid', String(holder.pid)).status, 0)
  write('a.txt', 'base\nclaude edit\n')
  write('b.txt', 'claude new file\n')
  const h1 = node('handoff.mjs', 'claude', 'codex',
    '--done', 'a.txt 에 1단계 반영', '--todo', 'b.txt 마무리', '--accept', 'b.txt 가 커밋된다', '--next', 'a.txt 커밋')
  assert.equal(h1.status, 0, h1.stderr)
  assert.match(h1.stdout, /codex "\.agent-handoff\/latest\.md 를 읽고/)
  assert.equal(node('handoff.mjs', '--validate').status, 0)
  // Codex 가 아직 잠금을 못 잡는다 — Claude 가 놓아야 한다
  assert.equal(node('lock.mjs', 'acquire', 'codex', '--pid', String(holder.pid)).status, 3)
  assert.equal(node('lock.mjs', 'release', 'claude').status, 0)

  // ② Codex 세션 시작 — 주입을 받고, 이어졌는지 확인하고, 일한다
  const inj = node('handoff-inject.mjs', '--agent', 'codex')
  assert.match(inj.stdout, /\[인수인계 도착\] claude → codex/)
  assert.match(inj.stdout, /b\.txt 가 커밋된다/)
  assert.equal(node('handoff-inject.mjs', '--agent', 'claude').stdout, '', '받는 에이전트가 아니면 주입하지 않는다')
  assert.equal(node('handoff.mjs', '--verify').status, 0)
  assert.equal(node('handoff.mjs', '--ack', 'codex').status, 0)
  assert.equal(node('handoff-inject.mjs', '--agent', 'codex').stdout, '', '읽음 표시 뒤에는 다시 주입하지 않는다')
  assert.equal(node('lock.mjs', 'acquire', 'codex', '--pid', String(holder.pid)).status, 0)
  g('commit', '-q', '--only', 'a.txt', '-m', 'a')
  write('c.txt', 'codex new file\n')
  const h2 = node('handoff.mjs', 'codex', 'claude',
    '--done', 'a.txt 커밋', '--todo', 'b.txt · c.txt 커밋', '--accept', 'b.txt 와 c.txt 가 커밋된다', '--next', 'b.txt 커밋')
  assert.equal(h2.status, 0, h2.stderr)
  assert.equal(node('lock.mjs', 'release', 'codex').status, 0)

  // ③ Claude 가 돌아온다 — 두 번의 인계 모두 손실이 없어야 한다
  const hist = fs.readdirSync(path.join(repo, '.agent-handoff/history')).filter((f) => f.endsWith('.json')).sort()
  const first = path.join(repo, '.agent-handoff/history', hist.at(-1))
  assert.deepEqual(JSON.parse(fs.readFileSync(first, 'utf8')).files.sort(), ['a.txt', 'b.txt'])
  assert.equal(node('handoff.mjs', '--verify', first).status, 0, '1차 인계: a.txt 는 커밋됨 · b.txt 는 작업 트리에 남음')
  const v2 = node('handoff.mjs', '--verify')
  assert.equal(v2.status, 0, v2.stdout)
  assert.equal(g('rev-parse', '--abbrev-ref', 'HEAD').trim(), 'feat/x')
  assert.match(node('handoff-inject.mjs', '--agent', 'claude').stdout, /codex → claude/)

  // 변이: 인계된 변경이 사라지면 잡아야 한다
  fs.rmSync(path.join(repo, 'c.txt'))
  const bad = node('handoff.mjs', '--verify')
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /인계된 변경이 사라졌다: c\.txt/)
  // 변이: 브랜치가 바뀌면 잡아야 한다
  write('c.txt', 'codex new file\n')
  g('checkout', '-q', '-b', 'other')
  assert.match(node('handoff.mjs', '--verify').stdout, /브랜치가 다르다/)
})
