// scripts/audit/shell-reach.mjs
//
// **셸이 파는 목적지** — 학습자가 메뉴만 보고 닿을 수 있는 화면은 몇 개인가.
//
// ── 왜 이 자를 만드나 (실측 2026-09-05 감사 S5) ─────────────────────────
// 이 저장소에는 셸에 관한 회귀가 둘 있는데, 둘 다 **다른 것**을 잰다:
//   · `wayfinding.test.ts`  — "지금 어디에 있는가"(aria-current 소유자가 있는가)
//   · `mobile-reach.test.tsx` — 폰에서 유틸리티 두 주소에 닿는가
//
// 아무도 **"셸이 파는 목적지가 전부 몇 개인가"** 를 묻지 않았다. 감사가 손으로 세어
// 「학습자 라우트 77개 중 18개」라고 적었는데, 손으로 센 수는 반드시 낡는다.
// 그리고 `/sitemap` 은 사이드바 목록을 그대로 파생하므로, WCAG 2.4.5 가 요구하는
// **두 번째 길**이 "원래 길이 있던 화면" 에만 생겼다 — 길이 하나뿐인 화면은 그대로다.
//
// ── 무엇을 세는가 ────────────────────────────────────────────────────────
// 셸의 목적지 = `lib/framework/axes.ts` + `components/layout/sidebar-config.ts` 의
//              `href:`/`owns:`, **그리고 그 둘이 별칭 import 하는 모듈까지 한 단계**
//              (하위 메뉴는 `lib/library/tabs.ts` 에서 온다 — 본문만 읽으면 저평가된다)
// 학습자 목적지 = `lib/framework/learner-routes.ts` 의 `LEARNER_ROUTES` 중
//                `isLearnerDestination`(동적·리다이렉트·랩 제외)
//
// 셸이 **직접** 파는 것만 센다 — 화면 안에서 한 번 더 눌러 들어가는 곳(2단계)은
// 여기서 세지 않는다. 그건 `26-learner-sweep` 의 「앞길」 축이 이미 본다.
// 여기서 답하려는 질문은 하나다: **메뉴만 보고 갈 수 있는 곳이 어디까지인가.**
//
// ── 첫 실측 (2026-09-06) ────────────────────────────────────────────────
// 학습자 목적지 61 · 셸이 파는 것 38 · **메뉴로 닿지 않는 화면 0** · 세션 23(허브에서 시작).
// 감사 S5 가 손으로 센 「77개 중 18개」는 탭 설정을 안 따라간 저평가였다 —
// 그래서 손으로 세지 않고 이 자를 둔다.
//
// 실행: node scripts/audit/shell-reach.mjs   (저장소 루트에서)

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'apps/web/src')

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')

/** `href: '/x'` · `href="/x"` 를 모은다(주석 줄 제외). */
function hrefsIn(src) {
  const out = new Set()
  for (const line of src.split('\n')) {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    for (const m of line.matchAll(/href[:=]\s*['"`](\/[^'"`\s]*)['"`]/g)) {
      out.add(m[1].split('?')[0].split('#')[0])
    }
  }
  return out
}

/** `owns: ['/a', '/b']` 배열 안의 경로 — 셸이 그 아래를 자기 구역으로 파는 것들. */
function ownsIn(src) {
  const out = new Set()
  for (const m of src.matchAll(/owns:\s*\[([^\]]*)\]/g)) {
    for (const p of m[1].matchAll(/['"`](\/[^'"`\s]*)['"`]/g)) out.add(p[1])
  }
  return out
}

// ── 셸이 파는 목적지 ─────────────────────────────────────────────────
//
// ⚠️ **셸 파일 본문만 읽으면 안 된다.** 사이드바는 하위 메뉴를 다른 모듈에서 받아 온다
//    (`LIBRARY_TABS` · `MY_LIBRARY_TABS` — `lib/library/tabs.ts`). 본문만 세던 첫 판은
//    `/library/books` 같은 실제로 팔리는 화면을 "안 판다" 로 잘못 셌다(55.7% 로 저평가).
//    그래서 셸 파일이 **로컬로 import 하는 모듈까지 한 단계** 따라간다.
const SHELL_FILES = ['lib/framework/axes.ts', 'components/layout/sidebar-config.ts']

/** `from '@/lib/library/tabs'` 꼴의 별칭 import. */
const IMPORT_RE = /from\s+['"]@\/([^'"]+)['"]/g

/** 별칭 import 를 한 단계 따라가 그 파일 본문도 읽는다. */
function withLocalImports(rel) {
  const src = read(rel)
  const out = [src]
  for (const m of src.matchAll(IMPORT_RE)) {
    for (const ext of ['.ts', '.tsx']) {
      const cand = m[1].endsWith('.ts') || m[1].endsWith('.tsx') ? m[1] : m[1] + ext
      try {
        out.push(read(cand))
        break
      } catch {
        /* 다른 확장자거나 디렉터리 index — 없으면 건너뛴다 */
      }
    }
  }
  return out
}

const shellSrcs = SHELL_FILES.flatMap(withLocalImports)
const shellDirect = new Set(shellSrcs.flatMap((s) => [...hrefsIn(s)]))
const shellOwns = new Set(shellSrcs.flatMap((s) => [...ownsIn(s)]))

// ── 학습자 목적지 (레지스트리) ───────────────────────────────────────
const registry = read('lib/framework/learner-routes.ts')

/**
 * 레지스트리에서 `{ path, kind, dynamic }` 만 뽑는다.
 *
 * ⚠️ 파일을 실행해 import 하지 않는다 — TS 라 노드가 바로 못 읽고, 빌드에 기대면
 *    이 감사가 빌드 상태에 묶인다. 목록은 리터럴이므로 텍스트로 충분하다.
 */
function learnerDestinations() {
  const out = []
  const blocks = registry.split(/\{\s*path:/).slice(1)
  for (const b of blocks) {
    const p = b.match(/^\s*['"`]([^'"`]+)['"`]/)
    if (!p) continue
    const kind = (b.match(/kind:\s*['"`]([a-z]+)['"`]/) || [])[1] ?? 'screen'
    const dynamic = /dynamic:\s*true/.test(b) || p[1].includes('[')
    out.push({ path: p[1], kind, dynamic })
  }
  // 게임 19종은 `ARCADE_SLUGS.map` 으로 만들어져 위 블록에 안 잡힌다 — 따로 더한다.
  const slugs = (registry.match(/const ARCADE_SLUGS = \[([\s\S]*?)\] as const/) || [])[1]
  if (slugs) {
    for (const m of slugs.matchAll(/['"`]([a-z-]+)['"`]/g)) {
      out.push({ path: `/play/${m[1]}`, kind: 'session', dynamic: false })
    }
  }
  return out
}

const dests = learnerDestinations().filter(
  (r) => !r.dynamic && r.kind !== 'redirect' && r.kind !== 'lab' && r.kind !== 'role',
)

/** 셸이 이 목적지를 파는가 — 직접 href 이거나, `owns` 구역 안에 있거나. */
function soldByShell(p) {
  if (shellDirect.has(p)) return true
  for (const o of shellOwns) {
    if (p === o || p.startsWith(o.endsWith('/') ? o : o + '/')) return true
  }
  return false
}

const sold = dests.filter((d) => soldByShell(d.path))
const notSold = dests.filter((d) => !soldByShell(d.path))

// 세션(`kind: 'session'`)은 **셸이 팔지 않는 것이 정상**이다 — 자기 허브에서 시작한다
//   (게임 19종은 `/arcade`, 플래시카드 세션은 `/flashcard`). 그것을 결함으로 세면
//   목록이 세션으로 덮여 진짜 구멍이 안 보인다. 그래서 갈라서 인쇄한다.
const gaps = notSold.filter((d) => d.kind !== 'session')
const sessionsNotSold = notSold.filter((d) => d.kind === 'session')

const pct = dests.length ? ((sold.length / dests.length) * 100).toFixed(1) : '0.0'
console.log(`학습자 목적지 ${dests.length} · 셸이 파는 것 ${sold.length} (${pct}%)`)
console.log(`
셸 메뉴로 닿지 않는 **화면**: ${gaps.length}`)
for (const d of gaps) console.log(`  x ${d.path}`)
console.log(`
세션(허브에서 시작 — 정상): ${sessionsNotSold.length}`)

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    destinations: dests.length,
    soldByShell: sold.length,
    screenGaps: gaps.length,
    sessionsFromHub: sessionsNotSold.length,
  },
  screenGaps: gaps.map((d) => d.path),
  sessionsNotSoldByShell: sessionsNotSold.map((d) => d.path),
}
fs.writeFileSync(
  path.join(ROOT, 'scripts/audit/shell-reach.result.json'),
  JSON.stringify(report, null, 2),
)
