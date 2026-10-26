// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/fast-worksheet-cli.test.ts
// scripts/textbook/fast-worksheet.mts 를 실제 프로세스로 돌린다 — 임시 디렉터리만 쓴다(덮어쓰기 거절 · 검수 전/후 산출물 · 거절 시 빈 결과).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { evaluateFast } from '../fast-worksheet'
import { outputOf, packetOf, reviewOf, snapshot } from './dcp-fixture'

const WEB = resolve(__dirname, '../../../../../../..')
const CLI = resolve(WEB, '../../scripts/textbook/fast-worksheet.mts')
const TSX = resolve(WEB, '../../node_modules/tsx/dist/cli.mjs')
const run = (...a: string[]) => spawnSync(process.execPath, [TSX, '--tsconfig', 'tsconfig.json', CLI, ...a], { cwd: WEB, encoding: 'utf8' })

let dir = ''
const p = (n: string) => join(dir, n)
const put = (n: string, v: unknown) => writeFileSync(p(n), `${JSON.stringify(v, null, 2)}\n`)

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'fast-cli-'))
  const packet = await packetOf(true, snapshot())
  put('packet.json', packet)
  put('output.json', outputOf(packet))
  put('snapshot.json', snapshot())
  put('edit.json', { order: ['cm-topic-01', 'cm-main-point-01', 'cm-title-01'], items: { 'cm-main-point-01': { stem: '다음 글의 중심 생각으로 가장 적절한 것은?' } }, editor: { kind: 'ai', agent: 'codex', session: 's-1', note: 'cli test' } })
  put('old-review.json', reviewOf(packet, outputOf(packet)))
}, 60000)

describe('fast-worksheet CLI', () => {
  it('--help 는 명령 · 종료 코드를 보여준다', () => {
    const r = run('--help')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('bundle  --packet')
    expect(r.stdout).toContain('exit codes')
  }, 60000)

  it('bundle → 옛 검수 거절 → export(검수 전) → 신규 검수 → export(학습지) · 충돌은 덮어쓰지 않는다', () => {
    const base = ['--packet', p('packet.json'), '--output', p('output.json'), '--source-snapshot', p('snapshot.json'), '--edit', p('edit.json')]
    const old = run('bundle', ...base, '--review', p('old-review.json'), '--out', p('b-old.json'))
    expect(old.status).toBe(0)
    expect(old.stdout).toContain('review=review_rejected')

    expect(run('bundle', ...base, '--out', p('b.json')).status).toBe(0)
    const before = readFileSync(p('b.json'), 'utf8')
    const again = run('bundle', ...base, '--out', p('b.json'))
    expect(again.status).toBe(1)
    expect(readFileSync(p('b.json'), 'utf8')).toBe(before)

    const e1 = run('export', '--bundle', p('b.json'), '--current-source', p('snapshot.json'), '--out', p('out1'))
    expect(e1.status).toBe(0)
    expect(readdirSync(p('out1')).sort()).toEqual(['edited-output.json', 'receipt.json', 'review-request.json'])
    expect(run('export', '--bundle', p('b.json'), '--current-source', p('snapshot.json'), '--out', p('out1')).stderr).toContain('output_dir_exists')

    const bundle = JSON.parse(before)
    const s = evaluateFast(bundle, snapshot())
    const req = JSON.parse(readFileSync(p('out1/review-request.json'), 'utf8'))
    expect(req.target).toEqual(s.target)
    put('b2.json', { ...bundle, review: { ...reviewOf(s.packet, s.output), reviewer: { model: 'claude', session: 'fresh-1', role: 'r' }, target: req.target } })
    const e2 = run('export', '--bundle', p('b2.json'), '--current-source', p('snapshot.json'), '--out', p('out2'))
    expect(e2.status).toBe(0)
    expect(readdirSync(p('out2')).sort()).toEqual(['edited-output.json', 'manifest.json', 'receipt.json', 'review-binding.json', 'review-request.json', 'student.html', 'teacher.html'])
  }, 120000)

  it('원천이 바뀌면 거절하고 출력 디렉터리를 만들지 않는다', () => {
    put('changed.json', snapshot({ license: 'CC-BY-4.0' }))
    const base = ['--packet', p('packet.json'), '--output', p('output.json'), '--source-snapshot', p('snapshot.json'), '--out', p('b3.json')]
    expect(run('bundle', ...base).status).toBe(0)
    const r = run('export', '--bundle', p('b3.json'), '--current-source', p('changed.json'), '--out', p('out3'))
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('source_changed')
    expect(existsSync(p('out3'))).toBe(false)
  }, 60000)
})
