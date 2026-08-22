// apps/web/tests/e2e/utils/learner-routes.ts
//
// **학습자 화면 목록의 단일 출처** — 파일 시스템에서 읽는다.
//
// ── 왜 (실측 2026-08-22) ────────────────────────────────────────────────
// 스펙마다 라우트 목록을 **손으로** 들고 있었다. `10-a11y-sweep` 은 25개를 적어 두고
// 파일 안에 이렇게 적어 놨다 — "새 라우트를 만들면서 접근성 스윕에 넣지 않으면
// 그 화면은 영영 안 재진다". 이미 겪은 것이다(`/practice`·`/wordblitz` 가 빠져 있었다).
//
// 실제 정적 학습자 라우트는 **42개**다. 손으로 적은 목록은 언제나 뒤처진다 —
// 목록을 만드는 일을 사람에게 맡기지 않는다.
//
// ⚠️ 동적 라우트(`[id]`)는 제외한다. 실 데이터가 필요하고, 그건 시나리오 스펙의 몫이다.

import fs from 'node:fs'
import path from 'node:path'

/** 훑지 않는 라우트 — **이유가 있는 것만.** 길어지면 커버리지가 아니라 면제 목록이 자란다. */
export const SKIP_ROUTES: Record<string, string> = {
  '/hub-lab': '재설계 실험용 — 학습자 동선이 아니다(캡처 하네스가 따로 본다)',
  '/teacher': '교사 표면 — 학습자 기준 훑기의 대상이 아니다',
}

/**
 * 열면 학습이 시작되거나 기록이 남는 화면 — **열되 누르지 않는다.**
 * e2e 가 검증 계정의 학습 기록을 오염시키면 다음 실행의 전제가 바뀐다.
 */
export const SESSION_ROUTES = new Set([
  '/flashcard/play',
  '/pairflip/play',
  '/spellforge/play',
  '/scriptquiz/play',
  '/dictate/session',
  '/practice/dcp',
  '/wordvault/review',
  '/wordvault/study',
])

/**
 * **쿼리 파라미터가 있어야 성립하는 화면.**
 *
 * 맨 주소로 들어가면 스스로 다른 곳으로 되돌린다 — 그게 정상 동작이다.
 * 실측 2026-08-22: /dictate/results 는 sessionId 가 없으면 router.replace('/dictate') 한다.
 * 전수 훑기가 이걸 "막다른 길" 로 기록하고 있었다 — **계측기가 틀린 것**이지 화면이 아니다.
 * 열림·콘솔은 그대로 재고, 앞길·복귀·연계는 재지 않는다.
 */
export const PARAM_ROUTES = new Set(['/dictate/results', '/pairflip/results'])

/** `(main)` 아래 정적 학습자 라우트 전부. 정렬은 안정적이다(스냅샷·베이스라인용). */
export function learnerRoutes(): string[] {
  const base = path.resolve(__dirname, '../../../src/app/(main)')
  const out: string[] = []

  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      if (name.startsWith('[')) continue // 동적 — 시나리오 스펙의 몫
      if (name.startsWith('_') || name.startsWith('(')) {
        // 라우트 그룹은 URL 에 안 들어간다
        walk(full, url)
        continue
      }
      const child = `${url}/${name}`
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }

  walk(base, '')
  return out.filter((r) => !(r in SKIP_ROUTES)).sort()
}
