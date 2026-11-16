// apps/web/src/lib/auth/__tests__/rpc-call-sites.test.ts
//
// RPC 호출 이름은 **정적으로 수집 가능해야 한다** — 소스 불변식 회귀 락.
//
// 왜 이 테스트가 있나 (2026-08-15 실측):
//   SECURITY DEFINER 함수 119개 중 98개가 `anon` 에 EXECUTE 로 열려 있다(미해결, DB_SCHEMA.md 참조).
//   이걸 좁히려면 "코드가 실제로 부르는 RPC" 목록이 정확해야 하는데, 그 목록을
//   `.rpc('리터럴')` grep 으로 만들면 **동적 호출을 놓친다**.
//
//   실제로 놓쳤다:
//     components/diagnostic/DiagnosticClient.tsx  →  supabase.rpc(rpcName, …)
//     app/admin/articles/CuratedArticlesTab.tsx   →  client.rpc(name, …)
//     app/admin/articles/preview/[id]/…Client.tsx →  client.rpc(name, …)
//
//   grep 기준 "아무도 안 부름" 으로 나온 41개를 회수했다면 **진단 흐름(analyze_and_apply_*)이
//   조용히 죽었을 것이다**. 세 곳을 리터럴로 펴고, 다시 굽지 않도록 이 테스트로 고정한다.
//
// ⚠️ 이 테스트가 실패하면 = 누군가 rpc() 에 변수를 넘겼다는 뜻이다.
//    테스트를 고치지 말고 **호출부를 리터럴로 펴라**. 그러지 않으면 다음 권한 감사가
//    그 함수를 "미사용" 으로 오분류한다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC_ROOT = join(__dirname, '..', '..', '..')

/**
 * 변수를 넘겨도 되는 예외 — **리터럴 `as const` 배열을 순회**하는 경우만.
 * 이름이 같은 파일 안에 문자열로 남아 있어 수집이 가능하다.
 */
const ALLOWED_DYNAMIC = new Set([
  'app/api/lcp/process/route.ts',
  'app/api/lcp/dev-process/route.ts',
])

/** Story 어댑터의 전달부 한 줄 — 예외는 이 줄에만 걸린다(같은 파일의 helper 변수 호출은 위반으로 남는다). */
const FORWARD = 'res = await client.r' + 'pc(fn, args)'

/**
 * 전달(pass-through) 어댑터 · 테스트 대역 — 함수 이름을 정하지 않고 받은 (fn, args) 를 그대로 넘기기만 한다.
 * 실제 이름은 호출부(예: factory-bridge/dcp-supply.ts 의 call(client, '<리터럴>', …))에 있다. 이유 필수.
 */
const PASS_THROUGH: ReadonlyArray<{ file: string; why: string; forward?: string }> = [
  { file: 'lib/admin/dcp-admission.ts', why: '관리자 세션을 SupplyClient 로 감싸는 어댑터 — 이름은 dcp-supply.ts 의 리터럴 호출부가 정한다(미설치 PGRST202 표시만 더함)' },
  { file: 'app/api/csat/factory/__tests__/factory-routes.test.ts', why: '테스트 대역 — 세션 클라이언트 rpc 를 테스트 상태로 넘긴다' },
  { file: 'lib/csat/map/v62/factory-bridge/__tests__/reassess-plan.pglite.test.ts', why: '테스트 대역 — 계획 저장 RPC 외 호출을 PGlite 가짜 클라이언트로 넘긴다' },
  { file: 'lib/library/story/admin.ts', why: 'callStoryRpc 오류·형식 처리 어댑터 — 이름은 admin.ts·witness.ts 의 callStoryRpc(client, \'<리터럴>\', …) 호출부가 정한다', forward: FORWARD },
  { file: 'lib/library/story/learner.ts', why: 'callRpc 오류·형식 처리 어댑터 — 이름은 learner.ts·activity.ts 의 callRpc(client, \'<리터럴>\', …) 호출부가 정한다', forward: FORWARD },
  { file: 'lib/library/story/save-word.ts', why: '파일 내부 rpc 오류·형식 처리 어댑터 — 이름은 같은 파일의 rpc(client, \'<리터럴>\', …) 호출부가 정한다', forward: FORWARD },
]
/** 변수 이름 호출 중 예외에 해당하지 않는 것. forward 가 있는 전달 예외는 그 정확한 줄만 면제한다. */
function offendersOf(sites: ReadonlyArray<CallSite>): CallSite[] {
  return sites.filter((s) => {
    if (s.name !== null || ALLOWED_DYNAMIC.has(s.file)) return false
    const pass = PASS_THROUGH.find((p) => p.file === s.file)
    if (!pass) return true
    return pass.forward !== undefined && s.raw !== pass.forward
  })
}

/**
 * 전달 어댑터의 호출부 — `helper(client, '<리터럴>', …)` 의 둘째 인자를 RPC 이름으로 수집한다.
 * 범위는 helper 를 정의·사용하는 Story 파일로 좁힌다(다른 곳의 같은 함수 이름을 RPC 로 추정하지 않는다).
 * 둘째 인자가 변수면 이름 null — `.rpc(변수)` 와 똑같이 위반이다.
 */
const STORY_HELPERS: ReadonlyArray<{ helper: string; files: ReadonlyArray<string> }> = [
  { helper: 'callStoryRpc', files: ['lib/library/story/admin.ts', 'lib/library/story/witness.ts'] },
  { helper: 'callRpc', files: ['lib/library/story/learner.ts', 'lib/library/story/activity.ts'] },
  { helper: 'rpc', files: ['lib/library/story/save-word.ts'] },
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** 주석 줄은 검사 대상이 아니다 (이 파일의 설명 주석까지 잡히면 곤란하다). */
function isCommentLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

interface CallSite {
  file: string
  line: number
  /** 리터럴이면 RPC 이름, 변수면 null */
  name: string | null
  raw: string
}

/** 한 파일의 호출부 — `.rpc(이름…)` 과, 그 파일이 STORY_HELPERS 범위면 `helper(client, 이름…)`. */
function collectFileSites(rel: string, source: string): CallSite[] {
  const sites: CallSite[] = []
  const helpers = STORY_HELPERS.filter((h) => h.files.includes(rel)).map((h) => h.helper)
  source.split('\n').forEach((line, i) => {
    if (isCommentLine(line)) return
    const push = (q: string, id: string) =>
      sites.push({ file: rel, line: i + 1, name: q === "'" || q === '"' ? id : null, raw: line.trim() })
    // `.rpc(` 뒤의 첫 인자만 본다
    const re = /\.rpc\(\s*(['"`]?)([A-Za-z0-9_$]+)\1/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) push(m[1], m[2])
  })
  // helper 호출은 파일 전체 텍스트에서 본다 — 여러 줄에 걸친 `helper(\n client,\n 이름,` 도 잡는다.
  // 정의(`helper(client: …`)·메서드(`.helper(`)는 걸리지 않는다. 둘째 인자 **전체**가 문자열 리터럴 하나이고
  // 바로 뒤가 `,`/`)` 일 때만 이름이다 — `'story_' + suffix` 같은 결합·변수는 null(위반).
  const lines = source.split('\n')
  const lineAt = (index: number) => source.slice(0, index).split('\n').length
  for (const helper of helpers) {
    const hre = new RegExp(`(?<![.\\w$])${helper}\\(\\s*[A-Za-z0-9_$.]+\\s*,\\s*`, 'g')
    let m: RegExpExecArray | null
    while ((m = hre.exec(source)) !== null) {
      const line = lineAt(m.index)
      if (isCommentLine(lines[line - 1])) continue
      const lit = /^(['"])([A-Za-z0-9_$]+)\1\s*[,)]/.exec(source.slice(hre.lastIndex))
      sites.push({ file: rel, line, name: lit ? lit[2] : null, raw: lines[line - 1].trim() })
    }
  }
  return sites.sort((a, b) => a.line - b.line)
}

function collectRpcCallSites(): CallSite[] {
  return walk(SRC_ROOT).flatMap((file) =>
    collectFileSites(relative(SRC_ROOT, file).replace(/\\/g, '/'), readFileSync(file, 'utf8')),
  )
}

describe('Story 전달 어댑터 호출부 수집 (fixture)', () => {
  it('세 어댑터 파일에서도 helper 변수 호출은 위반으로 남고 전달부 한 줄만 면제된다', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['lib/library/story/admin.ts', 'callStoryRpc'],
      ['lib/library/story/learner.ts', 'callRpc'],
      ['lib/library/story/save-word.ts', 'rpc'],
    ]
    for (const [file, helper] of cases) {
      const src = ['    ' + FORWARD, `  const x = await ${helper}(client, fnName, {})`, '  const y = await client.r' + 'pc(other, {})'].join('\n')
      expect(offendersOf(collectFileSites(file, src)).map((s) => s.line), file).toEqual([2, 3])
    }
  })

  it('helper 리터럴은 이름으로, 변수는 null 로 잡는다', () => {
    const src = [
      "const a = await callRpc(deps.client, 'story_catalog', {})",
      'const b = await callRpc(client, fnName, {})',
      'export async function callRpc(',
      '  res = await client.r' + 'pc(fn, args)',
    ].join('\n')
    expect(collectFileSites('lib/library/story/learner.ts', src).map((s) => s.name)).toEqual(['story_catalog', null, null])
  })

  it('여러 줄에 걸친 helper 호출도 수집한다 (리터럴은 이름, 변수는 위반)', () => {
    const src = [
      'const a = await callRpc(',
      '  deps.client,',
      "  'story_catalog',",
      '  {},',
      ')',
      'const b = await callRpc(',
      '  client,',
      '  fnName,',
      '  {})',
    ].join('\r\n')
    const sites = collectFileSites('lib/library/story/learner.ts', src)
    expect(sites.map((s) => [s.line, s.name])).toEqual([[1, 'story_catalog'], [6, null]])
    expect(offendersOf(sites).map((s) => s.line)).toEqual([6])
  })

  it('둘째 인자가 리터럴 하나가 아니면(결합·템플릿) 이름으로 읽지 않는다', () => {
    const src = [
      "callRpc(client, 'story_' + suffix, {})",
      'callRpc(client, `story_${x}`, {})',
      "callRpc(client, 'story_catalog')",
    ].join('\n')
    expect(collectFileSites('lib/library/story/learner.ts', src).map((s) => s.name)).toEqual([null, null, 'story_catalog'])
  })

  it('범위 밖 파일의 같은 함수 이름은 RPC 로 추정하지 않는다', () => {
    expect(collectFileSites('lib/other/x.ts', "callRpc(client, 'not_rpc', {})")).toEqual([])
    expect(collectFileSites('lib/library/story/admin.ts', "callRpc(client, 'x', {})")).toEqual([])
  })

  it('가짜 응답 handler(h.respond)·메서드 호출은 잡지 않는다', () => {
    expect(collectFileSites('lib/library/story/save-word.ts', 'return h.respond(args)\nfoo.rpc2(x)')).toEqual([])
    expect(collectFileSites('lib/library/story/save-word.ts', "await rpc(client, 'lookup_word_meaning', {})").map((s) => s.name)).toEqual(['lookup_word_meaning'])
  })
})

describe('RPC 호출 이름은 정적으로 수집 가능해야 한다', () => {
  const sites = collectRpcCallSites()

  it('수집기가 실제로 호출부를 찾는다 (셀프 체크)', () => {
    // 0 이면 정규식이 깨진 것이지 "위반이 없는" 것이 아니다
    expect(sites.length).toBeGreaterThan(20)
  })

  it('rpc() 에 변수를 넘기지 않는다 (예외는 리터럴 배열 순회뿐)', () => {
    const offenders = offendersOf(sites)
      .map((s) => `${s.file}:${s.line}  ${s.raw}`)

    expect(
      offenders,
      `rpc() 에 변수를 넘긴 곳이 있다. 리터럴로 펴야 권한 감사가 이 함수를 "사용 중" 으로 인식한다:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('전달 예외는 실제 파일 · 실제 (fn, args) 전달만 가리키고 이유가 있다', () => {
    for (const { file, why, forward } of PASS_THROUGH) {
      expect(why.trim().length, `${file} 예외에 이유가 없다`).toBeGreaterThan(10)
      const src = readFileSync(join(SRC_ROOT, file), 'utf8')
      expect(src, `${file} 에 (fn, args) 전달이 없다 — 낡은 예외는 지울 것`).toContain(['.rpc', '(fn, args)'].join(''))
      if (forward !== undefined) {
        const hits = src.split('\n').filter((l) => l.trim() === forward).length
        expect(hits, `${file} 의 전달부 「${forward}」 는 정확히 한 줄이어야 한다`).toBe(1)
      }
    }
  })

  it('예외로 허용한 파일은 실제로 리터럴 as const 배열을 순회한다', () => {
    for (const rel of ALLOWED_DYNAMIC) {
      const src = readFileSync(join(SRC_ROOT, rel), 'utf8')
      expect(src, `${rel} 이 예외 목록에 있는데 as const 배열이 없다`).toContain('] as const)')
      // 배열 안에 실제 RPC 이름 문자열이 있어야 수집 가능하다
      expect(src, `${rel} 에서 수집할 이름 문자열을 찾지 못했다`).toMatch(/'compute_book_[a-z_]+'/)
    }
  })

  it('진단 흐름 3종이 리터럴로 호출된다 (하마터면 회수될 뻔한 함수들)', () => {
    const names = new Set(sites.map((s) => s.name).filter(Boolean))
    for (const fn of [
      'analyze_and_apply_diagnostic_result',
      'analyze_and_apply_track_diagnostic_result',
      'analyze_and_apply_comprehensive_diagnostic_result',
    ]) {
      expect(names, `${fn} 이 리터럴 호출로 보이지 않는다`).toContain(fn)
    }
  })

  it('관리자 글 액션 2종도 리터럴로 호출된다', () => {
    const names = new Set(sites.map((s) => s.name).filter(Boolean))
    expect(names).toContain('admin_requeue_article')
    expect(names).toContain('admin_archive_article')
  })

  it('Story 실제 RPC 가 전달 어댑터 호출부에서 수집된다', () => {
    const names = new Set(sites.map((s) => s.name).filter(Boolean))
    for (const fn of [
      'story_catalog', // learner callRpc
      'story_admin_publish', // admin callStoryRpc
      'story_service_attest_validation', // witness callStoryRpc
      'lookup_word_meaning', // save-word rpc
      'story_unit_activity', // activity callRpc
    ]) {
      expect(names, `${fn} 이 Story 호출부에서 수집되지 않는다`).toContain(fn)
    }
  })

  it('수집된 이름은 RPC 이름 형태다 (오탐 방지)', () => {
    for (const s of sites) {
      if (s.name === null) continue
      expect(s.name, `${s.file}:${s.line} 의 "${s.name}" 은 RPC 이름 형태가 아니다`).toMatch(
        /^[a-z_][a-z0-9_]*$/,
      )
    }
  })
})
