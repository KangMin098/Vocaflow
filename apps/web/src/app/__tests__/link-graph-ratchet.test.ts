// apps/web/src/app/__tests__/link-graph-ratchet.test.ts
//
// **링크 그래프를 자동 테스트로 잠근다** — 죽은 링크 0 과 고아 목록을 라쳇으로 고정한다.
//
// 왜 필요한가 (실측 2026-09-06):
// `scripts/audit/learner-linkgraph.mjs` 는 사람이 손으로 돌려야만 답을 주는 감사였다.
// 그래서 두 가지가 오래 방치됐다 —
//   · 고아 10건 중 **9건이 오보**였다(삼항·중첩 템플릿·경로 생성 함수로 만든 링크를
//     정규식이 못 봤다). 오보가 쌓이면 목록 전체가 "원래 그런 것" 으로 읽혀 아무도 안 본다.
//   · 정작 사람 감사가 major 로 적어 둔 진짜 고아(`/hub-lab`, M12)는 **그 10건 안에 없었다.**
// 계측기를 고쳤으니 이제 **다시 썩지 않게** 회귀로 잠근다.
//
// ⚠️ 이 테스트는 **라쳇**이다. 화면·API 를 더하는 것은 자유지만, **들어오는 길이 없는 것**을
//    더하면 여기서 걸린다. 늘려야 할 정당한 사유가 생기면 아래 상수를 고치되,
//    **왜 그 화면에 들어오는 길이 없어도 되는지**를 같은 커밋에 적는다.
//
// ⚠️ 감사 스크립트는 **저장소 루트**에서 돌아야 한다(`apps/web/src/app` 을 스스로 찾는다).
//    vitest 는 `apps/web` 에서 도므로 cwd 를 올려서 실행한다.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(process.cwd(), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'audit', 'learner-linkgraph.mjs')

/**
 * 들어오는 길이 없어도 되는 화면 — **이유가 있는 것만.**
 *
 * · `/hub-lab`     — 재설계 실험용. 학습자 동선이 아니고 robots 에서 noindex 다.
 *                    (사람 감사 M12 가 "고아 라우트" 로 적어 둔 바로 그 화면 — 남겨 둔 상태를
 *                     테스트가 알고 있어야 한다. 없애든 링크를 달든, 그때 이 목록도 줄인다.)
 * · `/join/[code]` — 교사가 QR·초대 링크로 **밖에서** 들여보내는 화면. 앱 안에 링크가 없는 것이
 *                    정상이다(`lib/teacher/invite-link.ts` 가 주소를 만들어 교사에게 준다).
 */
const ALLOWED_ORPHAN_PAGES = ['/hub-lab', '/join/[code]']

/**
 * 앱이 부르지 않는 것이 정상인 API — 손으로/외부에서 부른다.
 *
 * 여기 없는 새 고아가 생기면 둘 중 하나다: 부르는 곳을 안 붙였거나, 안 쓰는 것을 남겼거나.
 */
const ALLOWED_ORPHAN_APIS = [
  '/api/acp/dev-enqueue',
  '/api/admin/library/backfill-covers',
  '/api/lcp/dev-enqueue-book',
  '/api/lcp/dev-ingest-preview',
  '/api/lcp/process',
  '/api/pdcp/issue',
]

interface LinkGraphReport {
  totals: { pageRoutes: number; learnerPages: number; apiRoutes: number }
  deadLinks: Array<{ file: string; line: number; url: string; kind: string }>
  orphanLearnerPages: string[]
  orphanApiRoutes: string[]
  redirectAliasesExcluded: string[]
}

describe('링크 그래프 라쳇', () => {
  let report: LinkGraphReport

  beforeAll(() => {
    // 스크립트가 결과 파일을 쓴다 — 표준출력을 파싱하지 않는다(사람용 서식이라 잘 바뀐다).
    execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'pipe' })
    const out = join(ROOT, 'scripts', 'audit', 'learner-linkgraph.result.json')
    report = JSON.parse(readFileSync(out, 'utf8')) as LinkGraphReport
  }, 120_000)

  it('감사 스크립트가 그 자리에 있다', () => {
    expect(existsSync(SCRIPT)).toBe(true)
  })

  it('라우트를 실제로 세었다 — 0을 세고 통과하지 않는다', () => {
    expect(report.totals.learnerPages).toBeGreaterThan(50)
    expect(report.totals.apiRoutes).toBeGreaterThan(50)
  })

  it('죽은 링크가 없다', () => {
    const dead = report.deadLinks.map((d) => `${d.url}  <- ${d.file}:${d.line}`)
    expect(dead).toEqual([])
  })

  it('들어오는 길이 없는 화면은 허용 목록뿐이다', () => {
    const unexpected = report.orphanLearnerPages.filter((r) => !ALLOWED_ORPHAN_PAGES.includes(r))
    expect(unexpected).toEqual([])
  })

  it('허용 목록이 낡지 않았다 — 이미 링크가 붙은 화면을 계속 예외로 두지 않는다', () => {
    const stale = ALLOWED_ORPHAN_PAGES.filter((r) => !report.orphanLearnerPages.includes(r))
    expect(stale).toEqual([])
  })

  it('아무도 안 부르는 API 는 허용 목록뿐이다', () => {
    const unexpected = report.orphanApiRoutes.filter((r) => !ALLOWED_ORPHAN_APIS.includes(r))
    expect(unexpected).toEqual([])
  })

  it('리다이렉트 별칭은 고아로 세지 않는다 — 옛 주소 호환은 목적지가 아니다', () => {
    expect(report.redirectAliasesExcluded.length).toBeGreaterThan(0)
    for (const alias of report.redirectAliasesExcluded) {
      expect(report.orphanLearnerPages).not.toContain(alias)
    }
  })
})
