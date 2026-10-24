// packages/library-pipeline/src/story/workdir.test.ts
//
// 로컬 제작 작업 폴더 · CLI 회귀 — 파일을 실제로 만들고 읽는다(OS 임시 폴더, DB · 네트워크 없음).
// 재실행 no-op · 다른 내용 덮기 거부 · 입력=출력 거부 · 경로/링크 탈출 거부 · 중단 후 재실행 ·
// 빈/불완전/작업 중 결과 구분 · 과거 결과 보존 · 실제 스크립트 종료 코드를 고정한다.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import { runStoryCli } from './cli'
import { WorkdirError, openWorkDir, writeNoClobber } from './workdir'

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url))
const SNAP = join(FIX, 'gull-rock.snapshot.json')
const POLICY = join(FIX, 'gull-rock.policy.json')
const STORY_OUT = join(FIX, 'gull-rock.story-b1.edition.out.json')
const EASY_OUT = join(FIX, 'gull-rock.easy-a2.edition.out.json')
const REVIEW_OUT = join(FIX, 'gull-rock.story-b1.review.synthetic.out.json')
const NOW = new Date('2026-10-25T12:00:00+09:00')
const WORK = 'gull-rock-r1'
const REPO = fileURLToPath(new URL('../../../../', import.meta.url))

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const made: string[] = []
const links: string[] = []
afterAll(() => {
  for (const l of links) {
    try {
      rmdirSync(l)
    } catch {
      if (existsSync(l)) unlinkSync(l)
    }
  }
  for (const d of made) rmSync(d, { recursive: true, force: true })
})

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'lcp-story-test-'))
  made.push(d)
  return d
}

function cli(argv: string[]): { code: number; out: Json; err: string } {
  let out = ''
  let err = ''
  const code = runStoryCli(argv, { stdout: (s) => { out += s }, stderr: (s) => { err += s }, now: () => NOW })
  return { code, out: out ? (JSON.parse(out) as Json) : {}, err }
}

const exportArgs = (root: string, work = WORK, src = SNAP, pol = POLICY): string[] =>
  ['export', '--root', root, '--work', work, '--source', src, '--policy', pol]

function fileSha(p: string): string {
  return createHash('sha256').update(readFileSync(p)).digest('hex')
}

function dirState(dir: string): Record<string, string> {
  return Object.fromEntries(readdirSync(dir).sort().map((n) => [n, fileSha(join(dir, n))]))
}

function exported(): { root: string; dir: string } {
  const root = tmp()
  const r = cli(exportArgs(root))
  expect(r.code, JSON.stringify(r.out.errors)).toBe(0)
  return { root, dir: join(root, WORK) }
}

function readJson(p: string): Json {
  return JSON.parse(readFileSync(p, 'utf8')) as Json
}

function codes(report: Json): string[] {
  return (report.errors as Json[]).map((e) => e.code as string)
}

describe('export — 원자적 생성 · 재실행 no-op · 덮기 거부', () => {
  it('처음에는 사본 · 과제 · 원장을 쓰고, 같은 입력의 재실행은 아무것도 바꾸지 않는다', () => {
    const { root, dir } = exported()
    expect(readdirSync(dir).sort()).toEqual(['easy-a2.task.json', 'export.json', 'policy.json', 'source.snapshot.json', 'story-b1.task.json'])
    const before = dirState(dir)
    const again = cli(exportArgs(root))
    expect(again.code).toBe(0)
    expect(again.out.files.map((f: Json) => f.outcome)).toEqual(['unchanged', 'unchanged', 'unchanged', 'unchanged', 'unchanged'])
    expect(dirState(dir)).toEqual(before)

    const task = readJson(join(dir, 'story-b1.task.json'))
    expect(task.source.paragraphs).toHaveLength(8)
    expect(task.output.file).toBe('story-b1.edition.out.json')
    expect(task.output.reservation).toBe('story-b1.edition.out.json.inprogress')
    expect(task.output.template.units).toEqual([])
  })

  it('입력 JSON 의 키 순서만 다르면 같은 결과(no-op)다', () => {
    const { root, dir } = exported()
    const before = dirState(dir)
    const reversed = join(tmp(), 'policy-reversed.json')
    const p = readJson(POLICY)
    writeFileSync(reversed, JSON.stringify(Object.fromEntries(Object.entries(p).reverse()), null, 4))
    const r = cli(exportArgs(root, WORK, SNAP, reversed))
    expect(r.code).toBe(0)
    expect(dirState(dir)).toEqual(before)
  })

  it('같은 작업 이름에 다른 기준을 내보내면 덮지 않고 실패한다 — 새 이름이면 새 revision 으로 남는다', () => {
    const { root, dir } = exported()
    const before = dirState(dir)
    const changed = join(tmp(), 'policy-v2.json')
    const p = readJson(POLICY)
    p.reason_to_read = `${p.reason_to_read} 개정`
    writeFileSync(changed, JSON.stringify(p))
    const r = cli(exportArgs(root, WORK, SNAP, changed))
    expect(r.code).toBe(1)
    expect(codes(r.out)).toContain('overwrite_refused')
    expect(dirState(dir)).toEqual(before)

    const r2 = cli(exportArgs(root, 'gull-rock-r2', SNAP, changed))
    expect(r2.code).toBe(0)
    expect(dirState(dir)).toEqual(before)
    expect(readJson(join(root, 'gull-rock-r2', 'export.json')).policy_sha256).not.toBe(readJson(join(dir, 'export.json')).policy_sha256)
  })

  it('입력과 출력이 같은 파일이면 거부한다(경로 · hard link 모두)', () => {
    const { root, dir } = exported()
    const before = dirState(dir)
    const same = cli(exportArgs(root, WORK, join(dir, 'source.snapshot.json'), POLICY))
    expect(same.code).toBe(1)
    expect(codes(same.out)).toContain('input_is_output')
    const hard = join(root, 'policy-hardlink.json')
    linkSync(join(dir, 'policy.json'), hard)
    const viaLink = cli(exportArgs(root, WORK, SNAP, hard))
    expect(viaLink.code).toBe(1)
    expect(codes(viaLink.out)).toContain('input_is_output')
    expect(dirState(dir)).toEqual(before)
  })

  it('중단 후 재실행 — 빠진 파일만 다시 만들고 남은 임시 파일은 지우지 않고 보고한다', () => {
    const { root, dir } = exported()
    const before = dirState(dir)
    unlinkSync(join(dir, 'export.json'))
    unlinkSync(join(dir, 'story-b1.task.json'))
    const leftover = '.export.json.tmp-999-deadbeef'
    writeFileSync(join(dir, leftover), '{"partial":')
    const r = cli(exportArgs(root))
    expect(r.code).toBe(0)
    expect(r.out.leftover_temp_files).toEqual([leftover])
    expect(existsSync(join(dir, leftover))).toBe(true)
    const after = dirState(dir)
    delete after[leftover]
    expect(after).toEqual(before)
  })

  it('반쯤 쓰인(다른 내용) 원장이 있으면 덮지 않는다', () => {
    const { root, dir } = exported()
    writeFileSync(join(dir, 'export.json'), '{"schema":"lcp-story/export@1"')
    const r = cli(exportArgs(root))
    expect(r.code).toBe(1)
    expect(codes(r.out)).toContain('overwrite_refused')
    expect(readFileSync(join(dir, 'export.json'), 'utf8')).toBe('{"schema":"lcp-story/export@1"')
  })

  it('검증에 실패한 입력은 작업 폴더를 만들지 않는다', () => {
    const root = tmp()
    const bad = join(root, 'bad-policy.json')
    const p = readJson(POLICY)
    p.production[0].transformation = 'renarration'
    writeFileSync(bad, JSON.stringify(p))
    const r = cli(exportArgs(root, WORK, SNAP, bad))
    expect(r.code).toBe(1)
    expect(codes(r.out)).toContain('renarration_excluded')
    expect(existsSync(join(root, WORK))).toBe(false)
  })
})

describe('경로 · 링크 탈출 거부', () => {
  it.each(['../evil', 'a/b', 'a\\b', 'C:', '..', 'UPPER'])('--work %s 를 거부한다', (work) => {
    const root = tmp()
    const r = cli(exportArgs(root, work))
    expect(r.code).toBe(1)
    expect(codes(r.out)).toEqual(['work_name_invalid'])
    expect(readdirSync(root)).toEqual([])
  })

  it('파일 이름에 경로를 넣지 못한다', () => {
    const paths = openWorkDir(tmp(), 'w', true)
    for (const name of ['../x.json', 'sub/x.json', 'sub\\x.json', 'C:x.json', '..']) {
      expect(() => writeNoClobber(paths, name, '{}')).toThrow(WorkdirError)
    }
  })

  it('작업 root 나 작업 폴더가 링크(junction)면 쓰지 않는다', () => {
    const outside = tmp()
    const base = tmp()
    const rootLink = join(base, 'root-link')
    symlinkSync(outside, rootLink, 'junction')
    links.push(rootLink)
    const r1 = cli(exportArgs(rootLink))
    expect(r1.code).toBe(1)
    expect(codes(r1.out)).toEqual(['root_symlink'])

    const root = tmp()
    const workLink = join(root, WORK)
    symlinkSync(outside, workLink, 'junction')
    links.push(workLink)
    const r2 = cli(exportArgs(root))
    expect(r2.code).toBe(1)
    expect(codes(r2.out)).toEqual(['work_symlink'])
    expect(readdirSync(outside)).toEqual([])
  })

  it('결과 파일 자리가 파일 링크면 읽지 않는다', (ctx) => {
    const { root, dir } = exported()
    const outsideFile = join(tmp(), 'outside.json')
    copyFileSync(STORY_OUT, outsideFile)
    try {
      symlinkSync(outsideFile, join(dir, 'story-b1.edition.out.json'), 'file')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EPERM') {
        ctx.skip() // 파일 심볼릭 링크 생성 권한이 없는 Windows — 미실행이며 통과가 아니다
        return
      }
      throw e
    }
    const r = cli(['validate', '--root', root, '--work', WORK])
    expect(r.code).toBe(1)
    expect(codes(r.out)).toContain('symlink_refused')
  })

  it('plan --out 은 plan*.json 맨 이름만 받는다', () => {
    const { root, dir } = exported()
    const before = dirState(dir)
    for (const out of ['../escape.json', '/tmp/plan.json', 'C:\\plan.json', 'sub/plan.json', 'export.json', 'story-b1.task.json', 'plan.task.json']) {
      const r = cli(['plan', '--root', root, '--work', WORK, '--out', out])
      expect(r.code, out).toBe(1)
      expect(codes(r.out), out).toEqual(['out_name_invalid'])
    }
    expect(dirState(dir)).toEqual(before)
  })
})

describe('validate — 에이전트 결과 상태를 구분한다', () => {
  it('결과가 아직 없으면 2(대기), 템플릿을 그대로 내면 1(빈 결과 거부)', () => {
    const { root, dir } = exported()
    const pending = cli(['validate', '--root', root, '--work', WORK])
    expect(pending.code).toBe(2)
    expect(pending.out.editions.map((e: Json) => e.result.status)).toEqual(['missing', 'missing'])
    const template = readJson(join(dir, 'story-b1.task.json')).output.template
    writeFileSync(join(dir, 'story-b1.edition.out.json'), JSON.stringify(template))
    const empty = cli(['validate', '--root', root, '--work', WORK])
    expect(empty.code).toBe(1)
    expect(empty.out.editions[0].result.status).toBe('invalid')
  })

  it.each([
    ['빈 파일', '', 'incomplete'],
    ['쓰다 멈춘 JSON', '{"schema":"lcp-story/edition@1","units":[', 'incomplete'],
  ])('%s → %s (종료 1)', (_label, body, status) => {
    const { root, dir } = exported()
    writeFileSync(join(dir, 'story-b1.edition.out.json'), body)
    const r = cli(['validate', '--root', root, '--work', WORK])
    expect(r.code).toBe(1)
    expect(r.out.editions[0].result.status).toBe(status)
  })

  it('예약(.inprogress)만 있으면 작업 중(2), 완성본과 예약이 함께 있으면 충돌(1)', () => {
    const { root, dir } = exported()
    writeFileSync(join(dir, 'story-b1.edition.out.json.inprogress'), '{"units":[')
    const busy = cli(['validate', '--root', root, '--work', WORK])
    expect(busy.code).toBe(2)
    expect(busy.out.editions[0].result.status).toBe('in_progress')
    copyFileSync(STORY_OUT, join(dir, 'story-b1.edition.out.json'))
    const both = cli(['validate', '--root', root, '--work', WORK])
    expect(both.code).toBe(1)
    expect(both.out.editions[0].result.status).toBe('conflict')
  })

  it('내보낸 사본 · 원장이 바뀌거나 없으면 무결성 오류다', () => {
    const { root, dir } = exported()
    writeFileSync(join(dir, 'source.snapshot.json'), `${readFileSync(join(dir, 'source.snapshot.json'), 'utf8')} `)
    const tampered = cli(['validate', '--root', root, '--work', WORK])
    expect(tampered.code).toBe(1)
    expect(codes(tampered.out)).toContain('workdir_tampered')
    unlinkSync(join(dir, 'export.json'))
    expect(codes(cli(['validate', '--root', root, '--work', WORK]).out)).toContain('workdir_file_missing')
    expect(codes(cli(['validate', '--root', root, '--work', 'no-such-work']).out)).toEqual(['work_missing'])
  })
})

describe('export → 결과 → validate → review → plan 전체 흐름(합성 fixture)', () => {
  it('합성 판본은 fixture_only, 검수 없는 판본은 보류 — 계획은 DB 를 쓰지 않고 결과 파일을 건드리지 않는다', () => {
    const { root, dir } = exported()
    copyFileSync(STORY_OUT, join(dir, 'story-b1.edition.out.json'))
    copyFileSync(EASY_OUT, join(dir, 'easy-a2.edition.out.json'))
    const v = cli(['validate', '--root', root, '--work', WORK])
    expect(v.code).toBe(0)
    expect(v.out.summary).toMatchObject({ valid: 2, pending: 0, invalid: 0 })

    const rv = cli(['export', '--root', root, '--work', WORK, '--stage', 'review'])
    expect(rv.code).toBe(0)
    expect(rv.out.files.map((f: Json) => f.file)).toEqual([
      expect.stringMatching(/^story-b1\.review-[0-9a-f]{12}\.task\.json$/),
      expect.stringMatching(/^easy-a2\.review-[0-9a-f]{12}\.task\.json$/),
    ])
    const storyTaskName = rv.out.files[0].file as string
    const storyTask = readJson(join(dir, storyTaskName))
    expect(storyTaskName).toContain(storyTask.binding_sha256.slice(0, 12))
    expect(storyTask.required_checks).toContain('activities')
    expect(cli(['export', '--root', root, '--work', WORK, '--stage', 'review']).out.files.map((f: Json) => f.outcome)).toEqual(['unchanged', 'unchanged'])

    copyFileSync(REVIEW_OUT, join(dir, storyTask.output.file))
    const outsBefore = Object.fromEntries(
      readdirSync(dir).filter((n) => n.endsWith('.out.json')).map((n) => [n, fileSha(join(dir, n))]),
    )
    const v2 = cli(['validate', '--root', root, '--work', WORK])
    expect(v2.code).toBe(0)
    expect(v2.out.editions[0].reviews.map((r: Json) => r.status)).toEqual(['current'])

    const plan = cli(['plan', '--root', root, '--work', WORK, '--out', 'plan.json'])
    expect(plan.code).toBe(2)
    expect(plan.out.db_write).toBe(false)
    expect(plan.out.decisions.map((d: Json) => [d.edition_key, d.status])).toEqual([
      ['story-b1', 'fixture_only'],
      ['easy-a2', 'hold'],
    ])
    expect(plan.out.decisions[1].reasons.map((r: Json) => r.code)).toEqual(['synthetic_source', 'synthetic_edition', 'synthetic_rights:source_text', 'review_missing'])
    expect(plan.out.files).toEqual([{ file: 'plan.json', outcome: 'written' }])
    expect(cli(['plan', '--root', root, '--work', WORK, '--out', 'plan.json']).out.files).toEqual([{ file: 'plan.json', outcome: 'unchanged' }])
    const saved = readJson(join(dir, 'plan.json'))
    expect(saved.decisions[0].release.publish_permission).toBe('none_local_preview')

    // 승인 뒤 판본을 고치면: 옛 검수는 stale 로 남고(지우지 않음) 새 검수 과제가 따로 나온다.
    const edited = readJson(join(dir, 'story-b1.edition.out.json'))
    edited.units[1].text = edited.units[1].text.replace('laughed', 'smiled')
    writeFileSync(join(dir, 'story-b1.edition.out.json'), JSON.stringify(edited))
    const v3 = cli(['validate', '--root', root, '--work', WORK])
    expect(v3.code).toBe(0)
    expect(v3.out.editions[0].reviews.map((r: Json) => r.status)).toEqual(['stale'])
    const p3 = cli(['plan', '--root', root, '--work', WORK])
    expect(p3.out.decisions[0].status).toBe('hold')
    expect(p3.out.decisions[0].reasons.map((r: Json) => r.code)).toContain('review_stale')
    const rv2 = cli(['export', '--root', root, '--work', WORK, '--stage', 'review'])
    expect(rv2.code).toBe(0)
    expect(rv2.out.files[0].outcome).toBe('written')
    expect(rv2.out.files[0].file).not.toBe(storyTaskName)
    expect(existsSync(join(dir, storyTaskName))).toBe(true)
    expect(fileSha(join(dir, storyTask.output.file))).toBe(outsBefore[storyTask.output.file])
    expect(fileSha(join(dir, 'easy-a2.edition.out.json'))).toBe(outsBefore['easy-a2.edition.out.json'])
  })

  it('다른 판본 자리 · 다른 결속 자리에 옮겨 놓은 검수는 오류다', () => {
    const { root, dir } = exported()
    copyFileSync(STORY_OUT, join(dir, 'story-b1.edition.out.json'))
    copyFileSync(EASY_OUT, join(dir, 'easy-a2.edition.out.json'))
    const rv = cli(['export', '--root', root, '--work', WORK, '--stage', 'review'])
    const easyTask = readJson(join(dir, rv.out.files[1].file as string))
    copyFileSync(REVIEW_OUT, join(dir, easyTask.output.file))
    const wrong = cli(['validate', '--root', root, '--work', WORK])
    expect(wrong.code).toBe(1)
    expect(wrong.out.editions[1].reviews[0].errors.map((e: Json) => e.code)).toContain('review_wrong_edition')

    unlinkSync(join(dir, easyTask.output.file))
    copyFileSync(REVIEW_OUT, join(dir, 'story-b1.review-000000000000.out.json'))
    const slot = cli(['validate', '--root', root, '--work', WORK])
    expect(slot.code).toBe(1)
    expect(slot.out.editions[0].reviews[0].errors.map((e: Json) => e.code)).toEqual(['review_slot_mismatch'])
  })

  it('현재보다 뒤의 검수 시각은 거부하고(시계 주입), 요약 줄이 안쪽 오류를 세며, 오류가 있으면 계획 파일을 쓰지 않는다', () => {
    const { root, dir } = exported()
    copyFileSync(STORY_OUT, join(dir, 'story-b1.edition.out.json'))
    copyFileSync(EASY_OUT, join(dir, 'easy-a2.edition.out.json'))
    const rv = cli(['export', '--root', root, '--work', WORK, '--stage', 'review'])
    copyFileSync(REVIEW_OUT, join(dir, readJson(join(dir, rv.out.files[0].file as string)).output.file))
    const early = '2026-10-25T00:30:00+09:00' // 확보(00:00) 뒤 · 합성 검수(01:00) 앞
    const v = cli(['validate', '--root', root, '--work', WORK, '--now', early])
    expect(v.code).toBe(1)
    expect(v.out.editions[0].reviews[0].errors.map((e: Json) => e.code)).toEqual(['time_in_future'])
    expect(v.err).toContain('오류 1')
    const p = cli(['plan', '--root', root, '--work', WORK, '--now', early, '--out', 'plan.json'])
    expect(p.code).toBe(1)
    expect(codes(p.out)).toEqual(['plan_out_skipped'])
    expect(existsSync(join(dir, 'plan.json'))).toBe(false)
  })

  it('검수 과제는 유효한 판본에만 나온다 — 하나도 없으면 2', () => {
    const { root } = exported()
    const r = cli(['export', '--root', root, '--work', WORK, '--stage', 'review'])
    expect(r.code).toBe(2)
    expect(r.out.not_ready).toEqual(['story-b1', 'easy-a2'])
  })
})

describe('원천 판본 정체 — 같은 작업 이름 · 다른 root · 같은 본문(F1)', () => {
  it('다른 원천 판본으로 내보낸 작업에는 옛 판본 결과물이 통하지 않는다', () => {
    const a = exported()
    const second = readJson(SNAP)
    second.snapshot_id = 'synthetic-gull-rock-second'
    second.edition.revision = 'r2'
    const secondPath = join(tmp(), 'second.snapshot.json')
    writeFileSync(secondPath, JSON.stringify(second))
    const rootB = tmp()
    expect(cli(exportArgs(rootB, WORK, secondPath, POLICY)).code).toBe(0)
    const dirB = join(rootB, WORK)
    const mA = readJson(join(a.dir, 'export.json'))
    const mB = readJson(join(dirB, 'export.json'))
    expect(mB.source_sha256).toBe(mA.source_sha256)
    expect(mB.source_identity_sha256).not.toBe(mA.source_identity_sha256)

    copyFileSync(STORY_OUT, join(dirB, 'story-b1.edition.out.json'))
    const v = cli(['validate', '--root', rootB, '--work', WORK])
    expect(v.code).toBe(1)
    expect(v.out.editions[0].result.errors).toEqual([
      expect.objectContaining({ code: 'edition_binding_stale', path: 'edition.binding.source_identity_sha256' }),
    ])
    const rv = cli(['export', '--root', rootB, '--work', WORK, '--stage', 'review'])
    expect(rv.code).toBe(1)
    expect(rv.out.files).toEqual([])
  })
})

describe('잘못된 바이트 · 잘못된 UTF-16 입력(F3)', () => {
  it('UTF-8 이 아닌 스냅숏 파일은 치환하지 않고 거부한다 — 작업 폴더도 만들지 않는다', () => {
    const root = tmp()
    const bad = join(root, 'bad.snapshot.json')
    const bytes = readFileSync(SNAP)
    const at = bytes.indexOf(Buffer.from('twelve'))
    writeFileSync(bad, Buffer.concat([bytes.subarray(0, at), Buffer.from([0xff, 0xfe]), bytes.subarray(at)]))
    const r = cli(exportArgs(root, WORK, bad))
    expect(r.code).toBe(1)
    expect(codes(r.out)).toEqual(['input_invalid_utf8'])
    expect(existsSync(join(root, WORK))).toBe(false)
  })

  it('JSON 이스케이프로 넣은 짝 없는 서로게이트도 거부한다', () => {
    const root = tmp()
    const bad = join(root, 'lone.snapshot.json')
    writeFileSync(bad, readFileSync(SNAP, 'utf8').replace('twelve years', 'twelve \\ud800 years'))
    const r = cli(exportArgs(root, WORK, bad))
    expect(r.code).toBe(1)
    expect(codes(r.out)).toEqual(['text_ill_formed_unicode'])
    expect(existsSync(join(root, WORK))).toBe(false)
  })

  it('UTF-8 이 아닌 결과 파일은 불완전(result_invalid_utf8)으로 거부한다', () => {
    const { root, dir } = exported()
    writeFileSync(join(dir, 'story-b1.edition.out.json'), Buffer.concat([Buffer.from('{"schema":"'), Buffer.from([0xc3, 0x28]), Buffer.from('"}')]))
    const r = cli(['validate', '--root', root, '--work', WORK])
    expect(r.code).toBe(1)
    expect(r.out.editions[0].result.status).toBe('incomplete')
    expect(r.out.editions[0].result.errors.map((e: Json) => e.code)).toEqual(['result_invalid_utf8'])
  })
})

describe('CLI 인자', () => {
  it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf'])(
    'Object.prototype 이름 %s 를 명령으로 받지 않는다 — 예외 없이 사용법 오류 · 파일 없음',
    (command) => {
      const root = tmp()
      const r = cli([command, '--root', root, '--work', 'probe'])
      expect(r.code).toBe(1)
      expect(codes(r.out)).toEqual(['usage'])
      expect(readdirSync(root)).toEqual([])
    },
  )

  it.each(['--toString', '--constructor', '--__proto__'])('옵션 이름 %s 도 받지 않는다', (flag) => {
    const r = cli(['validate', '--root', 'x', '--work', WORK, flag, 'v'])
    expect(r.code).toBe(1)
    expect(codes(r.out)).toEqual(['usage'])
  })

  it.each([
    [['bogus'], 1],
    [['validate', '--root', 'x'], 1],
    [['validate', '--root', 'x', '--work', WORK, '--now', 'yesterday'], 1],
    [['validate', '--root', 'x', '--work', WORK, '--now', '2026-10-25T09:00:00'], 1],
    [['export', '--root', 'x', '--work', WORK, '--stage', 'publish'], 1],
    [['export', '--root', 'x', '--work', WORK, '--stage', 'review', '--source', SNAP], 1],
    [['plan', '--root', 'x', '--work', WORK, '--source', SNAP], 1],
    [['plan', '--root', 'x', '--work', WORK, '--work', WORK], 1],
    [['plan', '--root'], 1],
  ])('%j → %i', (argv, code) => {
    const r = cli(argv as string[])
    expect(r.code).toBe(code)
    expect(codes(r.out)).toEqual(['usage'])
  })

  it('도움말은 0, 인자 없음은 1', () => {
    expect(runStoryCli(['help'], { stdout: () => {}, stderr: () => {}, now: () => NOW })).toBe(0)
    expect(runStoryCli([], { stdout: () => {}, stderr: () => {}, now: () => NOW })).toBe(1)
  })
})

describe('실제 스크립트(scripts/lcp/story/story.ts)를 tsx 로 실행한다', () => {
  const tsxCli = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const script = join(REPO, 'scripts', 'lcp', 'story', 'story.ts')
  const run = (args: string[]) => spawnSync(process.execPath, [tsxCli, script, ...args], { cwd: REPO, encoding: 'utf8', timeout: 60_000 })

  it('export 0 · validate 2(결과 대기) · 없는 작업 1 — 종료 코드가 프로세스 밖으로 나온다', () => {
    expect(existsSync(tsxCli), `tsx 가 없다: ${tsxCli} — pnpm install 필요`).toBe(true)
    const root = tmp()
    const now = '2026-10-25T12:00:00+09:00'
    const ex = run(['export', '--root', root, '--work', WORK, '--source', SNAP, '--policy', POLICY, '--now', now])
    expect(ex.status, ex.stderr).toBe(0)
    expect(JSON.parse(ex.stdout).files).toHaveLength(5)
    const va = run(['validate', '--root', root, '--work', WORK, '--now', now])
    expect(va.status, va.stderr).toBe(2)
    const missing = run(['plan', '--root', root, '--work', 'nope', '--now', now])
    expect(missing.status).toBe(1)
    expect(JSON.parse(missing.stdout).errors.map((e: Json) => e.code)).toEqual(['work_missing'])
    expect(readdirSync(root)).toEqual([WORK])
  }, 120_000)

  it('toString 명령도 프로세스 밖으로 JSON 사용법 오류 · 종료 1 이며 처리되지 않은 예외가 없다', () => {
    const root = tmp()
    const r = run(['toString', '--root', root, '--work', 'probe'])
    expect(r.status).toBe(1)
    expect(JSON.parse(r.stdout).errors.map((e: Json) => e.code)).toEqual(['usage'])
    expect(r.stderr).not.toMatch(/TypeError|at .*cli\.ts/)
    expect(readdirSync(root)).toEqual([])
  }, 120_000)
})
