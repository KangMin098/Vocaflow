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
 * 학습자 화면이 사는 **라우트 그룹 전부.**
 *
 * ⚠️ 오래도록 `(main)` 하나뿐이었다. 그 사이 게임 19종이 `(app)/play/*` 로 들어왔고
 *    (풀스크린이라 Sidebar/FlowNav 없이 `SessionFrame` 만 쓰는 별도 그룹이다),
 *    **19화면이 통째로 분모 밖에 있었다** — 열림·콘솔·앞길·복귀·연계·요청 어느 것도
 *    한 번도 재지 않았다(실측 2026-08-30).
 *    이 파일 머리에 적힌 "새 라우트를 스윕에 넣지 않으면 영영 안 재진다" 가
 *    **라우트 단위가 아니라 그룹 단위로** 다시 일어난 것이다.
 *
 * `(auth)`·`(marketing)` 은 학습자 로그인 뒤 동선이 아니라 뺀다 —
 * 공개 표면은 `33-public-sweep` 이 자기 기준으로 따로 훑는다.
 */
const LEARNER_GROUPS = ['(main)', '(app)'] as const

const appDir = (group: string) => path.resolve(__dirname, '../../../src/app', group)

/** 한 그룹 아래 정적 라우트. 라우트 그룹 디렉터리는 URL 에 들어가지 않는다. */
function routesUnder(base: string): string[] {
  if (!fs.existsSync(base)) return []
  const out: string[] = []
  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      if (name.startsWith('[')) continue // 동적 — 시나리오 스펙의 몫
      if (name.startsWith('_') || name.startsWith('(')) {
        walk(full, url)
        continue
      }
      const child = `${url}/${name}`
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }
  walk(base, '')
  return out
}

/**
 * 열면 학습이 시작되거나 기록이 남는 화면 — **열되 누르지 않는다.**
 * e2e 가 검증 계정의 학습 기록을 오염시키면 다음 실행의 전제가 바뀐다.
 *
 * ⚠️ `(app)/play/*` 는 **손으로 적지 않는다.** 게임은 계속 늘어나고, 손 목록은
 *    반드시 뒤처진다(그래서 19종이 분모 밖에 있었다). 파일 시스템에서 읽어 합친다 —
 *    누락되면 스윕이 게임 안에서 버튼을 눌러 검증 계정 기록을 오염시킨다.
 */
export const SESSION_ROUTES = new Set<string>([
  '/flashcard/play',
  '/pairflip/play',
  '/spellforge/play',
  '/scriptquiz/play',
  '/dictate/session',
  '/practice/dcp',
  '/wordvault/review',
  '/wordvault/study',
  ...routesUnder(appDir('(app)')),
])

/**
 * **쿼리 파라미터가 있어야 성립하는 화면.**
 *
 * 맨 주소로 들어가면 스스로 다른 곳으로 되돌린다 — 그게 정상 동작이다.
 * 실측 2026-08-22: /dictate/results 는 sessionId 가 없으면 router.replace('/dictate') 한다.
 * 전수 훑기가 이걸 "막다른 길" 로 기록하고 있었다 — **계측기가 틀린 것**이지 화면이 아니다.
 * 열림·콘솔은 그대로 재고, 앞길·복귀·연계는 재지 않는다.
 */
export const PARAM_ROUTES = new Set([
  '/dictate/results',
  '/pairflip/results',
  // 실측 2026-08-23: 자료(`?text=` · `?set=` · `?custom=1`) 없이 열면
  // `router.replace('/dictate')` 로 되돌린다 — 정상 동작이다. 그래서 뒤로가기가
  // `/dictate/setup` 이 아니라 `/dictate` 로 가고, 그걸 "복귀 실패" 로 세면 화면을
  // 잘못 의심하게 된다. **`replace` 는 히스토리를 남기지 않는 것이 목적이다.**
  '/dictate/setup',
])

/**
 * **오직 다른 곳으로 보내기만 하는 화면.** (`/my` · `/my/words` · `/my/texts` …)
 *
 * 본문이 없다 — `redirect()` 한 줄이 전부다. 여기서 "앞길이 있나" 를 물으면
 * **목적지를 두 번 세는 것**이고, 리다이렉트가 늦으면 그 순간을 찍어 "막다른 길" 이 된다.
 * 실측 2026-08-23: `/my`·`/my/words` 는 막다른 길로, `/my/texts` 는 통과로 찍혔다 —
 * **같은 한 줄짜리 파일 셋이 서로 다른 판정을 받았다.** 그건 화면이 아니라 타이밍이다.
 *
 * 그래서 런타임이 아니라 **소스로** 판별한다. 목적지는 목록에 따로 있으니 그쪽에서 재진다.
 */
export function redirectOnlyRoutes(): Set<string> {
  const out = new Set<string>()
  for (const r of learnerRoutes()) {
    // 어느 그룹에 있는 라우트인지 모르므로 둘 다 본다 — `(main)` 만 보던 동안
    // `(app)` 라우트는 파일을 못 찾아 그냥 건너뛰었다(판정 자체가 없었다).
    const file = LEARNER_GROUPS.map((g) => path.join(appDir(g), r, 'page.tsx')).find((f) =>
      fs.existsSync(f),
    )
    if (!file) continue
    const src = fs.readFileSync(file, 'utf8')
    // 이 저장소는 순수 리다이렉트 껍데기에 반환형 `never` 를 **명시**한다 — 그 선언을 믿는다.
    // ⚠️ "JSX 가 없으면 껍데기" 로 재던 판은 `/wordvault/review` 처럼 자식 컴포넌트 **하나만**
    //    돌려주는 진짜 화면까지 껍데기로 분류했다(34줄짜리 서버 컴포넌트다).
    //    조용한 면제는 점수를 부풀린다 — 분모에서 빼는 판단은 좁고 명시적이어야 한다.
    if (src.includes('redirect(') && src.includes('): never')) out.add(r)
  }
  return out
}

/**
 * 학습자 그룹 전부(`(main)` + `(app)`)의 정적 라우트. 정렬은 안정적이다(스냅샷·베이스라인용).
 *
 * 두 그룹에 같은 URL 이 있으면 Next 라우팅이 이미 모호하므로 여기서도 한 번만 센다.
 */
export function learnerRoutes(): string[] {
  const out = new Set<string>()
  for (const g of LEARNER_GROUPS) for (const r of routesUnder(appDir(g))) out.add(r)
  return [...out].filter((r) => !(r in SKIP_ROUTES)).sort()
}
