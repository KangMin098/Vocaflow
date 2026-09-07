// scripts/lib/claim-chunks.selftest.mjs
//
// claim-chunks 회귀 잠금. 이 도구가 조용히 틀리면 서브에이전트 여러 대가 같은 청크를
// 판정하거나(경합) 이미 판정한 것을 다시 판정한다(낭비) — 둘 다 화면에 안 나타난다.
//
// 실행: node scripts/lib/claim-chunks.selftest.mjs

import { mkdtempSync, writeFileSync, rmSync, existsSync, utimesSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const TOOL = new URL('./claim-chunks.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
let pass = 0
let fail = 0

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`) }
  else { fail++; console.log(`  FAIL ${name} ${detail}`) }
}

function run(args) {
  return execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' })
}

function fresh() {
  const d = mkdtempSync(join(tmpdir(), 'claimtest-'))
  for (const n of ['01', '02', '03']) writeFileSync(join(d, `chunk-${n}.json`), '[]')
  return d
}

// 1) 기본 — 세 개 다 잡는다
{
  const d = fresh()
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  check('빈 폴더에서 3개를 잡는다', /잡음 3 /.test(out), out.trim())
  check('claim 파일이 생긴다', existsSync(join(d, 'chunk-01.json.claim')))
  rmSync(d, { recursive: true, force: true })
}

// 2) 이미 완료된 청크는 건너뛴다
{
  const d = fresh()
  writeFileSync(join(d, 'chunk-02.out.json'), '[{}]')
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  check('완료본이 있으면 건너뛴다', /잡음 2 · 이미-완료 1/.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 3) ⚠️ 산출물을 입력으로 잡지 않는다 — 이 검사가 없어 실제로 6개를 다시 잡았다(2026-08-26)
{
  const d = fresh()
  writeFileSync(join(d, 'chunk-02.out.json'), '[{}]')
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  check('산출물(.out.json)을 입력으로 잡지 않는다', !out.includes('CLAIM') || !/CLAIM.*out\.json/.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 4) 빈 산출물은 완료가 아니다 — 빈 값이 "완료" 로 세어지면 구멍이 영영 남는다
{
  const d = fresh()
  writeFileSync(join(d, 'chunk-02.out.json'), '')
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  check('0바이트 산출물은 완료로 세지 않는다', /잡음 3 /.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 5) 남의 신선한 claim 은 건드리지 않는다
{
  const d = fresh()
  writeFileSync(join(d, 'chunk-02.json.claim'), '9999 other\n')
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  check('신선한 남의 claim 은 건너뛴다', /남이-잡음 1/.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 6) TTL 지난 claim 은 회수한다 — 세션은 중간에 끊긴다
{
  const d = fresh()
  const c = join(d, 'chunk-02.json.claim')
  writeFileSync(c, '9999 dead\n')
  const old = new Date(Date.now() - 3600 * 1000)
  utimesSync(c, old, old)
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  check('30분 지난 claim 을 회수한다', /STALE/.test(out) && /잡음 3 /.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 7) --max 는 잡는 수를 제한한다
{
  const d = fresh()
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json', '--max', '1'])
  check('--max 1 은 하나만 잡는다', /잡음 1 /.test(out), out.trim())
  check('--max 를 넘은 것은 claim 을 안 남긴다', !existsSync(join(d, 'chunk-03.json.claim')))
  rmSync(d, { recursive: true, force: true })
}

// 8) --release 는 claim 을 지운다
{
  const d = fresh()
  run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  run(['--release', join(d, 'chunk-01.json')])
  check('--release 가 claim 을 지운다', !existsSync(join(d, 'chunk-01.json.claim')))
  rmSync(d, { recursive: true, force: true })
}

// 9) --done-dir — VCB 처럼 산출물이 다른 폴더에 떨어지는 경우
{
  const d = fresh()
  const o = join(d, 'out')
  mkdirSync(o)
  writeFileSync(join(o, 'chunk-02.compare.jsonl'), '{}')
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done-dir', o, '--done', '.json:.compare.jsonl'])
  check('--done-dir 의 완료본을 인식한다', /이미-완료 1/.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 10) --force 는 완료본도 다시 잡는다
{
  const d = fresh()
  writeFileSync(join(d, 'chunk-02.out.json'), '[{}]')
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json', '--force'])
  check('--force 는 완료본도 다시 잡는다', /잡음 3 /.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 11) 잡은 게 0개면 그렇게 말한다 — "완료" 로 보고되는 것을 막는다
{
  const d = fresh()
  for (const n of ['01', '02', '03']) writeFileSync(join(d, `chunk-${n}.out.json`), '[{}]')
  const out = run(['--dir', d, '--in', 'chunk-*.json', '--done', '.json:.out.json'])
  check('0개를 잡으면 경고한다', /잡은 청크가 0개다/.test(out), out.trim())
  rmSync(d, { recursive: true, force: true })
}

// 12) 네 팬아웃 명령이 쓰는 실제 이름 규칙 — 어긋나면 조용히 "이미-완료" 로 세어
//     청크를 영영 건너뛴다. 명령의 .md 를 고치면 여기도 같이 고칠 것.
{
  const cases = [
    {
      name: 'vcb-batch-enrich (pending → enriched)',
      inputs: ['cast2000-pending-01of04.jsonl', 'cast2000-pending-02of04.jsonl'],
      doneFiles: [['.', 'cast2000-enriched-01of04.jsonl']],
      args: ['--in', 'cast2000-pending*.jsonl', '--done', 'pending:enriched'],
    },
    {
      name: 'vcb-curate-compare (enriched → chunk.compare)',
      inputs: ['cast2000-enriched-01of04.jsonl', 'cast2000-enriched-02of04.jsonl'],
      doneFiles: [['out', 'chunk-01of04.compare.jsonl']],
      args: ['--in', 'cast2000-enriched*.jsonl', '--done', 'cast2000-enriched:chunk',
        '--done', '.jsonl:.compare.jsonl', '--done-dir', 'out'],
    },
    {
      name: 'vcb-seed-validate (seed-chunk → chunk.seed-validation)',
      inputs: ['seed-chunk-01.jsonl', 'seed-chunk-02.jsonl'],
      doneFiles: [['out', 'chunk-01.seed-validation.md']],
      args: ['--in', 'seed-chunk-*.jsonl', '--done', 'seed-chunk:chunk',
        '--done', '.jsonl:.seed-validation.md', '--done-dir', 'out'],
    },
    {
      name: 'pending-words-drain (chunk → chunk.out)',
      inputs: ['chunk-01.json', 'chunk-02.json'],
      doneFiles: [['.', 'chunk-01.out.json']],
      args: ['--in', 'chunk-*.json', '--done', '.json:.out.json'],
    },
  ]
  for (const c of cases) {
    const d = mkdtempSync(join(tmpdir(), 'claimmap-'))
    mkdirSync(join(d, 'out'))
    for (const f of c.inputs) writeFileSync(join(d, f), '{}')
    for (const [sub, f] of c.doneFiles) writeFileSync(join(d, sub, f), '{}')
    const args = c.args.map((a) => (a === 'out' ? join(d, 'out') : a))
    const out = run(['--dir', d, ...args])
    check(`${c.name} — 완료 1 · 잡음 1`, /잡음 1 · 이미-완료 1/.test(out), out.trim())
    rmSync(d, { recursive: true, force: true })
  }
}

console.log(`\nclaim-chunks 자체검사 — 통과 ${pass} · 실패 ${fail}`)
process.exit(fail ? 1 : 0)
