// apps/web/scripts/e2e-sweep.mjs
//
// **전수 훑기 4종을 한 번에 켠다.**
//
// 왜 필요한가 (실측 2026-09-06):
// 학습자 표면을 가장 넓게 훑는 네 스펙은 각각 **다른 이름의 환경변수**로 잠겨 있다.
// 오래 걸려서(각 몇 분) 기본 실행에서 빼 둔 것은 타당하지만, 이름이 제각각이라
// `playwright test` 를 그냥 돌리면 **그 네 개가 조용히 빠지고** 성적표는 "passed" 로 끝난다.
// 실제로 그렇게 돌려 놓고 30 passed 를 받았는데, 314개 검사를 하는 전수 훑기는 그중에 없었다.
//
//   26-learner-sweep    LEARNER_SWEEP=1    화면이 열리고·조용하고·앞길이 있고·되돌아오는가
//   27-keyboard-reach   KEYBOARD_SWEEP=1   Tab 으로 닿고·포커스가 보이고·갇히지 않는가
//   28-screen-identity  IDENTITY_SWEEP=1   화면이 이름을 갖고·구별되고·주제가 하나인가
//   29-learner-waste    LEARNER_WASTE=1    한 화면을 여는 동안 같은 요청을 두 번 보내지 않는가
//
// ⚠️ **안 잰 것을 성적에 넣지 않는다** 는 것이 이 스펙들의 공통 규칙인데, 정작 스펙 전체가
//    안 돌아간 것은 그 규칙이 못 막는다. 그래서 진입점을 하나로 만든다.
//
// 쓰기:
//   pnpm --filter web test:e2e:sweep
//   pnpm --filter web test:e2e:sweep -- 26-learner-sweep      # 하나만
//   PLAYWRIGHT_BASE_URL=http://localhost:3300 pnpm --filter web test:e2e:sweep
//
// ⚠️ 프로덕션 빌드 위에서 재는 것이 정석이다. dev 서버는 라우트마다 첫 방문에 컴파일해서
//    그 지연이 "본문이 비어 있다"·"막다른 길" 로 기록된다(실측: 같은 코드로 96.7% → 54.9%).

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

/** 스펙 → 그 스펙을 켜는 환경변수. 스펙이 늘면 여기 한 줄 더한다. */
const GATES = {
  '26-learner-sweep': 'LEARNER_SWEEP',
  '27-keyboard-reach': 'KEYBOARD_SWEEP',
  '28-screen-identity': 'IDENTITY_SWEEP',
  '29-learner-waste': 'LEARNER_WASTE',
}

// `-` 로 시작하는 것은 Playwright 옵션이다 — 스펙 필터로 넘기면 아무것도 안 걸러져서
// **전 스펙이 돌아 버린다**(`--list` 로 확인하려다 실측). 갈라서 넘긴다.
const argv = process.argv.slice(2)
const flags = argv.filter((a) => a.startsWith('-'))
const picked = argv.filter((a) => !a.startsWith('-'))
const specs = picked.length ? picked : Object.keys(GATES)

const env = { ...process.env }
for (const v of Object.values(GATES)) env[v] = '1'

console.log(
  '[sweep] 게이트 ' +
    Object.values(GATES).join('=1 · ') +
    '=1\n[sweep] 대상 ' +
    specs.join(' · ') +
    '\n[sweep] 서버 ' +
    (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000 (기본)'),
)

// ⚠️ `npx.cmd` 를 spawn 하지 않는다 — Node 20+ 의 Windows 에서 `.cmd` 는 shell 없이 못 띄우고
//    (spawn EINVAL), shell 을 켜면 인자 따옴표 문제가 따라온다. CLI 를 직접 해석해 부른다.
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli')

const child = spawn(process.execPath, [cli, 'test', ...specs, '--reporter=list', ...flags], {
  env,
  stdio: 'inherit',
})
child.on('exit', (code) => process.exit(code ?? 1))
