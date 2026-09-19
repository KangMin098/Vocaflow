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

function collectRpcCallSites(): CallSite[] {
  const sites: CallSite[] = []
  for (const file of walk(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file).replace(/\\/g, '/')
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (isCommentLine(line)) return
      // `.rpc(` 뒤의 첫 인자만 본다
      const re = /\.rpc\(\s*(['"`]?)([A-Za-z0-9_$]+)\1/g
      let m: RegExpExecArray | null
      while ((m = re.exec(line)) !== null) {
        const quoted = m[1] === "'" || m[1] === '"'
        sites.push({ file: rel, line: i + 1, name: quoted ? m[2] : null, raw: line.trim() })
      }
    })
  }
  return sites
}

describe('RPC 호출 이름은 정적으로 수집 가능해야 한다', () => {
  const sites = collectRpcCallSites()

  it('수집기가 실제로 호출부를 찾는다 (셀프 체크)', () => {
    // 0 이면 정규식이 깨진 것이지 "위반이 없는" 것이 아니다
    expect(sites.length).toBeGreaterThan(20)
  })

  it('rpc() 에 변수를 넘기지 않는다 (예외는 리터럴 배열 순회뿐)', () => {
    const offenders = sites
      .filter((s) => s.name === null && !ALLOWED_DYNAMIC.has(s.file))
      .map((s) => `${s.file}:${s.line}  ${s.raw}`)

    expect(
      offenders,
      `rpc() 에 변수를 넘긴 곳이 있다. 리터럴로 펴야 권한 감사가 이 함수를 "사용 중" 으로 인식한다:\n${offenders.join('\n')}`,
    ).toEqual([])
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

  it('수집된 이름은 RPC 이름 형태다 (오탐 방지)', () => {
    for (const s of sites) {
      if (s.name === null) continue
      expect(s.name, `${s.file}:${s.line} 의 "${s.name}" 은 RPC 이름 형태가 아니다`).toMatch(
        /^[a-z_][a-z0-9_]*$/,
      )
    }
  })
})
