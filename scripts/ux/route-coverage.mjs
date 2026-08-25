// scripts/ux/route-coverage.mjs
//
// 화면 커버리지 실측 — 학습자·관리자 정적 라우트가 **테스트에 한 번이라도 등장하는가**.
//
// 매 사이클 재실행해 같은 분모로 진척을 잰다.
//   node scripts/ux/route-coverage.mjs
//   node scripts/ux/route-coverage.mjs --json
//
// ── 이 지표가 말하는 것과 말하지 않는 것 ──────────────────────────
// 말하는 것: "이 화면을 열어 본 테스트가 하나라도 있는가."
// 말하지 않는 것: 그 테스트가 **무엇을 확인했는가**. 커버리지는 상한이지 품질이 아니다.
// 실제 판정은 전수 훑기 두 개가 한다 —
//   · 학습자 `tests/e2e/26-learner-sweep.spec.ts` (LEARNER_SWEEP=1 필요 · 약 7분)
//   · 관리자 `tests/e2e/30-admin-sweep.spec.ts`   (DEV_ADMIN_BYPASS=1 필요)
// 이 스크립트는 **훑기가 빠뜨린 화면이 생겼는지**를 싸게 감시하는 자리다.
//
// 저장소가 CRLF 라 읽는 즉시 CR 을 턴다 — 안 그러면 여러 줄 문자열이 통째로 안 잡힌다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const WEB = 'apps/web'
const APP = join(WEB, 'src/app')
const CR = String.fromCharCode(13)
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split(CR).join('') : '')

if (!existsSync(APP)) {
  console.error('앱을 찾지 못했다 — 저장소 루트에서 실행할 것: node scripts/ux/route-coverage.mjs')
  process.exit(2)
}

/** 라우트 그룹·동적 세그먼트 규칙은 Next App Router 를 그대로 따른다. */
function routesUnder(baseRel, urlPrefix = '') {
  const base = resolve(APP, baseRel)
  const out = []
  const walk = (dir, url) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (!statSync(full).isDirectory()) continue
      if (name.startsWith('[')) continue // 동적 — 실 데이터가 필요하다(시나리오 스펙의 몫)
      if (name.startsWith('_') || name.startsWith('(')) {
        walk(full, url) // 라우트 그룹은 URL 에 안 들어간다
        continue
      }
      const child = `${url}/${name}`
      if (existsSync(join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }
  if (existsSync(base)) walk(base, urlPrefix)
  return out.sort()
}

const learner = routesUnder('(main)')
const admin = routesUnder('admin', '/admin')
if (existsSync(resolve(APP, 'admin/page.tsx'))) admin.unshift('/admin')

// ── 스펙에서의 등장 ───────────────────────────────────────────────
const specDir = join(WEB, 'tests/e2e')
const specFiles = existsSync(specDir) ? readdirSync(specDir).filter((f) => f.endsWith('.spec.ts')) : []
const specBlob = specFiles.map((f) => read(join(specDir, f))).join('\n')

// 레지스트리(파일시스템에서 목록을 읽는 유틸)를 쓰는 스펙은 **그 목록 전체**를 훑는다.
// 문자열로 라우트를 적지 않으므로 문자열 검색만으로는 0% 로 보인다 — 그게 이 지표의 함정이다.
const usesLearnerRegistry = /learnerRoutes\s*\(/.test(specBlob)
const usesAdminRegistry = /adminRoutes\s*\(/.test(specBlob)

const literal = (r) =>
  specBlob.includes(`'${r}'`) || specBlob.includes(`"${r}"`) || specBlob.includes('`' + r)

const learnerCovered = learner.filter((r) => usesLearnerRegistry || literal(r))
const adminCovered = admin.filter((r) => usesAdminRegistry || literal(r))
const learnerLiteral = learner.filter(literal)
const adminLiteral = admin.filter(literal)

const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)

const report = {
  learner: {
    total: learner.length,
    covered: learnerCovered.length,
    pct: pct(learnerCovered.length, learner.length),
    viaRegistry: usesLearnerRegistry,
    literalOnly: learnerLiteral.length,
    uncovered: learner.filter((r) => !learnerCovered.includes(r)),
  },
  admin: {
    total: admin.length,
    covered: adminCovered.length,
    pct: pct(adminCovered.length, admin.length),
    viaRegistry: usesAdminRegistry,
    literalOnly: adminLiteral.length,
    uncovered: admin.filter((r) => !adminCovered.includes(r)),
  },
  sweeps: {
    learner: existsSync(join(specDir, '26-learner-sweep.spec.ts')),
    admin: existsSync(join(specDir, '30-admin-sweep.spec.ts')),
    popup: existsSync(join(specDir, '31-popup-return.spec.ts')),
  },
  dialogs: dialogCoverage(),
}

/**
 * 팝업 커버리지 — `role="dialog"` 파일 수와, 그중 **정적 화면에서 열 수 있는 것** 대비 커버.
 *
 * 파일 수만 세면 분모가 부풀려진다 — 28개 중 프리미티브·세션 내부·동적 라우트가 대부분이고
 * 그것들은 이 축으로 잴 수 있는 대상이 아니다. 실제 분모와 제외 사유는
 * `31-popup-return.spec.ts` 의 '커버리지 고지' 테스트가 들고 있고(거기서 강제된다),
 * 여기서는 **파일 수가 늘었는지**만 싸게 감시한다 — 늘었는데 목록이 그대로면 그 테스트가 깨진다.
 */
function dialogCoverage() {
  const compDir = join(WEB, 'src/components')
  const appDir = join(WEB, 'src/app')
  const found = []
  const walk = (d) => {
    if (!existsSync(d)) return
    for (const n of readdirSync(d)) {
      const f = join(d, n)
      if (statSync(f).isDirectory()) walk(f)
      else if (n.endsWith('.tsx') && read(f).includes('role="dialog"')) found.push(f)
    }
  }
  walk(compDir)
  walk(appDir)
  const spec = read(join(specDir, '31-popup-return.spec.ts'))
  const declared = Number((spec.match(/const TOTAL_DIALOG_FILES = (\d+)/) || [])[1] ?? 0)
  return { files: found.length, declaredInSpec: declared, inSync: found.length === declared }
}
report.overall = pct(
  learnerCovered.length + adminCovered.length,
  learner.length + admin.length,
)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const line = (k, o) =>
    `${k.padEnd(6)} ${String(o.pct).padStart(5)}%  (${o.covered}/${o.total})` +
    `  · 레지스트리 ${o.viaRegistry ? '✅' : '❌'}` +
    `  · 이름으로 적힌 것 ${o.literalOnly}`
  console.log('')
  console.log(line('학습자', report.learner))
  console.log(line('관리자', report.admin))
  console.log('')
  console.log('전수 훑기  ' +
    (report.sweeps.learner ? '✅' : '❌') + ' 학습자   ' +
    (report.sweeps.admin ? '✅' : '❌') + ' 관리자   ' +
    (report.sweeps.popup ? '✅' : '❌') + ' 팝업 제자리')
  const d = report.dialogs
  console.log('팝업 파일   ' + d.files + '개 · 스펙 선언 ' + d.declaredInSpec +
    (d.inSync ? '  ✅ 일치' : '  ❌ 어긋남 — 31-popup-return 의 목록을 갱신할 것'))
  for (const [k, o] of [['학습자', report.learner], ['관리자', report.admin]]) {
    if (o.uncovered.length === 0) continue
    console.log(`\n— 어떤 테스트도 열어 본 적 없는 ${k} 화면 (${o.uncovered.length}) —`)
    for (const r of o.uncovered) console.log('  ', r)
  }
  console.log(`\n종합 ${report.overall}%\n`)
}
