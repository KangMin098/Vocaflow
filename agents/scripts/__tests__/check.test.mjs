// agents/scripts/__tests__/check.test.mjs
// 실행: node --test agents/scripts/__tests__
//
// 검사기가 스스로 무력해지지 않았는지 — 일부러 넣은 중복·비밀값·드리프트를 잡아야 한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { duplicateMigrationVersions, duplicates } from '../check.mjs'
import { findSecrets, isEnvFile } from '../lib.mjs'
import { renderMcpJson, renderTomlBlock, spliceToml, TOML_END, TOML_START } from '../sync.mjs'

const AGENTS = '# A\n\n- **마이그레이션 자동 적용 금지** — SQL 을 보여주고 사용자 승인 후 적용.\n- 모바일 퍼스트(390 → 768 → 1280) · CSS Variables 로 테마\n'

test('중복: 같은 줄을 CLAUDE.md 에 다시 쓰면 잡는다', () => {
  const claude = '@AGENTS.md\n\n- **마이그레이션 자동 적용 금지** — SQL 을 보여주고 사용자 승인 후 적용.\n'
  assert.ok(duplicates(AGENTS, claude).length > 0)
})

test('중복: 긴 문장 조각만 옮겨 써도 잡는다', () => {
  const claude = '@AGENTS.md\n\n1. 참고로 SQL 을 보여주고 사용자 승인 후 적용 — 이건 Claude 에도 해당\n'
  assert.ok(duplicates(AGENTS, claude).length > 0)
})

test('중복: 첫 줄 import 와 Claude 전용 문장은 통과', () => {
  const claude = '@AGENTS.md\n\n# Claude 전용\n\n- 화면을 만들기 전에 vocaflow-design 스킬을 호출한다.\n'
  assert.deepEqual(duplicates(AGENTS, claude), [])
})

test('비밀값: 값은 잡고 이름·참조는 통과', () => {
  assert.equal(findSecrets('SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN}\nenv_vars = ["SUPABASE_ACCESS_TOKEN"]').length, 0)
  assert.equal(findSecrets(`"SUPABASE_ACCESS_TOKEN": "sbp_${'a1'.repeat(20)}"`).length, 1)
  assert.equal(findSecrets(`key = "sk-ant-api03-${'x'.repeat(30)}"`).length, 1)
  // 값은 런타임에 조립한다 — 이 줄에 접속 문자열 리터럴을 두면 가드·secret-scan 이 자기 픽스처를 잡아
  // 이 파일을 커밋할 수 없다(2026-09-20 실제로 막혔다). 위 두 줄이 이미 쓰는 방식과 같다.
  assert.equal(findSecrets(`postgresql://postgres:${'hunter22' + 'secret'}@db.example.co:5432/postgres`).length, 1)
  assert.equal(findSecrets('postgresql://postgres:${DB_PASSWORD}@db.example.co:5432/postgres').length, 0)
})

test('.env 판정: 예시 파일은 제외', () => {
  assert.ok(isEnvFile('.env'))
  assert.ok(isEnvFile('apps/web/.env.local'))
  assert.ok(isEnvFile(String.raw`apps\web\.env.production`))
  assert.ok(!isEnvFile('.env.example'))
  assert.ok(!isEnvFile('scripts/env.ts'))
})

test('sync: 비밀은 Claude 쪽 ${VAR}, Codex 쪽 env_vars 로만 나간다', () => {
  const src = { servers: { s: { command: 'node', args: ['x.js'], env: { MODE: 'ro' }, envFromShell: ['TOKEN'] } } }
  const json = JSON.parse(renderMcpJson(src))
  assert.deepEqual(json.mcpServers.s.env, { MODE: 'ro', TOKEN: '${TOKEN}' })
  const toml = renderTomlBlock(src)
  assert.match(toml, /env_vars = \["TOKEN"\]/)
  assert.doesNotMatch(toml, /\$\{/)
})

test('sync: 마커 밖(권한·훅)은 건드리지 않는다', () => {
  const before = `approval_policy = "on-request"\n\n${TOML_START}\nold = 1\n${TOML_END}\n\n# tail\n`
  const out = spliceToml(before, `${TOML_START}\nnew = 2\n${TOML_END}`)
  assert.ok(out.startsWith('approval_policy = "on-request"\n'))
  assert.ok(out.endsWith('\n\n# tail\n'))
  assert.ok(out.includes('new = 2') && !out.includes('old = 1'))
})

test('sync: Codex 가 마커를 지워도 생성 표만 바꾸고 tools 승인 설정은 남긴다', () => {
  // Codex CLI 가 승인 설정을 저장하며 주석을 지운 실제 모양(2026-09-19)
  const before = [
    'approval_policy = "on-request"',
    '',
    '[mcp_servers.supabase]',
    'command = "node"',
    'args = [',
    '    "old.js",',
    ']',
    '',
    '[mcp_servers.supabase.tools.execute_sql]',
    'approval_mode = "approve"',
    '',
    '[mcp_servers.gone]',
    'command = "x"',
    '',
    '[mcp_servers.gone.tools.t]',
    'approval_mode = "approve"',
    '',
    '[shell_environment_policy]',
    'inherit = "core"',
    '',
  ].join('\n')
  const block = renderTomlBlock({ servers: { supabase: { command: 'node', args: ['new.js'] } } })
  const out = spliceToml(before, block, ['supabase'])
  assert.ok(out.startsWith('approval_policy = "on-request"\n\n' + TOML_START))
  assert.ok(out.includes('"new.js"') && !out.includes('old.js'))
  assert.ok(out.includes('[mcp_servers.supabase.tools.execute_sql]\napproval_mode = "approve"'))
  assert.ok(!out.includes('gone'))
  assert.ok(out.endsWith('[shell_environment_policy]\ninherit = "core"\n'))
  // 한 번 고친 뒤에는 마커가 생겨 재실행이 같은 결과를 낸다
  assert.equal(spliceToml(out, block, ['supabase']), out)
})

test('sync: 마커가 한쪽만 남으면 추측하지 않고 멈춘다', () => {
  assert.throws(() => spliceToml(`${TOML_START}\nx = 1\n`, 'b', ['s']), /한쪽만/)
})

test('D10: 두 에이전트가 같은 버전으로 만든 마이그레이션을 잡는다', () => {
  const names = ['20260926120000_spelling_canonical.sql', '20260926120000_video_request_supersede_restore.sql', '20260926130000_x.sql']
  assert.deepEqual(duplicateMigrationVersions(names, new Set()), [names.slice(0, 2)])
})

test('D10: 옛 형식 YYYYMMDD_hhmmss 는 날짜만이 아니라 시각까지 버전이다', () => {
  assert.deepEqual(duplicateMigrationVersions(['20260521_140000_a.sql', '20260521_200000_b.sql'], new Set()), [])
  assert.equal(duplicateMigrationVersions(['20260521_140000_a.sql', '20260521140000_b.sql'], new Set()).length, 1)
})

test('D10: 버전 없는 파일과 기준선 버전은 세지 않는다', () => {
  assert.deepEqual(duplicateMigrationVersions(['_pending_a.sql', '_pending_a.sql', 'README.md']), [])
  assert.deepEqual(duplicateMigrationVersions(['20260924150000_a.sql', '20260924150000_b.sql']), [])
})
