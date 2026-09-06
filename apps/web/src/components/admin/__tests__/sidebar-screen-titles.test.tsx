// apps/web/src/components/admin/__tests__/sidebar-screen-titles.test.tsx
//
// **메뉴에서 부르는 이름과 화면이 자기를 부르는 이름이 같은가.**
//
// ── 왜 이 회귀가 생겼나 (2026-09-06 실측) ────────────────────────────
// 사이드바 라벨을 한국어 이름으로 바꾸고 나서 화면을 하나씩 열어 보니, 라벨과 화면 제목이
// 서로를 못 알아보는 자리가 있었다. 그중 하나는 **명명 취향이 아니라 결함**이었다:
//
//   · `/admin/vrl` 의 제목이 「사전DB 종합 모니터링 v3」 · 눈썹이 「Dictionary DB Health」였다.
//     그런데 메뉴에는 **다른 항목**이 「DB 헬스」(`/admin/db`)로 따로 있고, 그쪽은 콘텐츠가
//     아니라 Postgres 자체를 본다. 두 화면이 같은 이름을 주장하면 관리자는 자기가 어디
//     있는지 알 방법이 없다. → 「어휘 레벨 — 사전 데이터 품질」/「VRL Pipeline」로 고쳤다.
//
// 이름은 코드가 아니라서 타입도 린트도 안 잡는다. 그래서 여기서 센다.
//
// ⚠️ **스캐너가 틀리면 없는 결함을 만든다.** 이 파일을 만드는 동안 실제로 세 번 그랬다:
//   ① 뿌리 경로를 한 단계 얕게 잡아 38화면이 전부 「h1 0」(→ 자기검사가 잡는다)
//   ② 주석에 적힌 `` `<h1>` `` 를 진짜 태그로 세어 교재 공장 여덟 화면의 제목이 주석 한 문단
//   ③ `redirect()` 페이지(`/admin/vocab`)를 「h1 없음」으로 세어 **없는 접근성 결함을 보고**
//   그래서 이 파일은 판정을 셋으로 가른다 — 위반 · **판정 불가**(제목이 JSX 표현식) · 통과.
//   읽지 못한 것을 위반으로 세면 회귀가 내놓는 수가 사실이 아니게 된다.
//
// ⚠️ **정합을 100% 로 강제하지 않는다.** 화면 제목은 그 파이프라인 팀의 것이고, 영문 제목
//   (`Comic Pipeline`)에는 메뉴의 오른쪽 색인(`tag`)이 이미 다리를 놓는다. 이 회귀가 막는 것은
//   **더 나빠지는 것**이다 — h1 이 없는 화면이 늘어나거나, 어긋난 화면이 늘어나는 것.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SIDEBAR_NAV, type NavItem } from '../AdminSidebar'

// `src/components/admin/__tests__/` → 세 단계 올라가야 `src` 다. 두 단계로 잡으면
// `src/components` 를 가리켜 `app/` 을 못 찾고 **모든 화면이 「h1 0」으로 보인다** —
// 그러면 이 파일의 검사가 전부 "위반 없음" 으로 통과한다(실측: 처음 실행이 그랬다).
// 아래 「스캐너가 실제로 화면을 찾아낸다」가 그 침묵을 잡는다.
const WEB_SRC = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..')
const APP = join(WEB_SRC, 'app')

const readCache = new Map<string, string>()
function read(p: string): string {
  let v = readCache.get(p)
  if (v === undefined) {
    try {
      v = readFileSync(p, 'utf8')
    } catch {
      v = ''
    }
    readCache.set(p, v)
  }
  return v
}

/** `@/…` 와 상대 경로만 따라간다 — node_modules 는 화면 표면이 아니다. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(WEB_SRC, spec.slice(2))
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec)
  else return null
  for (const cand of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

const IMPORT_RE = /(?:from\s+|import\s+)['"]([^'"]+)['"]/g

/** 그 라우트가 실제로 그리는 파일들 — page.tsx 에서 지역 임포트를 따라간다. */
function surfaceFiles(entry: string, maxDepth = 3): string[] {
  const seen = new Set([entry])
  let frontier = [entry]
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = []
    for (const f of frontier) {
      for (const m of read(f).matchAll(IMPORT_RE)) {
        const r = resolveImport(m[1]!, f)
        if (r && !seen.has(r)) {
          seen.add(r)
          next.push(r)
        }
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return [...seen]
}

/**
 * 라우트의 `page.tsx` — **`redirect()` 는 따라간다.** 없으면 null.
 *
 * ⚠️ 안 따라가면 거짓 위반이 나온다. `/admin/vocab/page.tsx` 는 본문이
 *   `redirect('/admin/vocab/runs')` 한 줄뿐이라 제목이 있을 수가 없는데, 스캐너가
 *   「h1 없음」으로 세어 **접근성 결함으로 보고했다**(실측 2026-09-06). 관리자가 실제로
 *   보는 화면은 리다이렉트 **뒤**의 것이다.
 */
function pageFile(href: string, hops = 2): string | null {
  const p = join(APP, ...href.split('/').filter(Boolean), 'page.tsx')
  if (!existsSync(p)) return null
  const to = stripComments(read(p)).match(/\bredirect\(\s*['"](\/[^'"]+)['"]/)
  if (to && hops > 0) return pageFile(to[1]!, hops - 1) ?? p
  return p
}

/** 그 화면이 감싸는 layout 들 — 제목이 layout 에 있을 수 있다(교재 공장이 그렇다). */
function layoutFiles(href: string): string[] {
  const segs = href.split('/').filter(Boolean)
  const out: string[] = []
  for (let i = segs.length; i >= 1; i--) {
    const p = join(APP, ...segs.slice(0, i), 'layout.tsx')
    if (existsSync(p)) out.push(p)
  }
  return out
}

const H1_TAG_RE = /<h1[\s>]/g

/**
 * 제목 글자를 뽑는다 — **안쪽 태그를 걷어낸 뒤** 남는 리터럴.
 *
 * ⚠️ 처음에는 `<h1[^>]*>([^<>{}]+)</h1>` 로 잡았다가 **거의 다 못 읽었다**: 교재 공장의
 *   제목은 `<h1><Link>교재 공장</Link></h1>` 이고 여러 화면이 `<h1>{title}</h1>` 이다.
 *   그 상태로 「이름 못 알아봄 33」이 나왔는데 그중 대부분은 **어긋난 게 아니라 안 읽힌 것**이었다.
 *   읽지 못한 것을 위반으로 세면 회귀가 잡는 수가 사실이 아니게 된다.
 */
function titlesIn(src: string, tag: 'h1' | 'h2'): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
  const out: string[] = []
  for (const m of stripComments(src).matchAll(re)) {
    const text = m[1]!
      .replace(/\{[^{}]*\}/g, ' ') // JSX 표현식은 정적으로 못 읽는다
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) out.push(text)
  }
  return out
}

/**
 * 주석을 걷어낸 소스 — **제목 추출은 코드만 본다.**
 *
 * ⚠️ 안 걷어내면 **주석에 적힌 태그 이름이 진짜 태그로 잡힌다.** 실측: `admin/csat/layout.tsx` 의
 *   주석이 「`<h1>` 로 감싼다 …」로 시작하는데, 여는 `<h1>` 을 거기서부터 세는 바람에 교재 공장
 *   여덟 화면의 제목이 **주석 한 문단**으로 읽혔고 그 바람에 전부 거짓 ✓ 가 됐다.
 *   자기 규칙을 설명한 글이 그 규칙의 판정을 망가뜨리는 자리다.
 */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ') // JSX 주석
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // 블록 주석
    .replace(/^\s*\/\/.*$/gm, ' ') // 줄 주석 (URL 의 `//` 는 줄 시작이 아니라 안 걸린다)
}

interface ScreenTitle {
  href: string
  label: string
  tag: string | null
  hasPage: boolean
  h1Count: number
  /** h1 의 리터럴 — 「두 화면이 같은 이름을 주장하는가」는 이것으로만 본다. */
  h1Titles: string[]
  /**
   * h1 + h2 리터럴.
   *
   * h2 까지 보는 이유: 교재 공장은 **layout 이 h1(「교재 공장」)을 갖고 각 공정 화면의 제목은
   * h2** 다(그 설계 근거는 `app/admin/csat/layout.tsx` 머리말에 있다). h1 만 보면 여덟 화면이
   * 전부 「이름이 없다」로 잡히는데, 실제로는 화면에 또렷이 적혀 있다.
   */
  allTitles: string[]
}

/** 라벨/색인이 제목 안에서 알아볼 수 있는가 — 낱말 하나만 겹쳐도 다리가 놓인 것으로 본다. */
function recognizable(t: ScreenTitle): boolean {
  const hay = t.allTitles.join(' ').toLowerCase()
  if (!hay) return false
  const needles = [...t.label.split(/[\s·/]+/), ...(t.tag ? [t.tag] : [])]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2)
  return needles.some((n) => hay.includes(n))
}

/** 제목을 하나도 못 읽은 화면 — **위반이 아니라 판정 불가**다. 따로 센다. */
function unreadable(t: ScreenTitle): boolean {
  return t.h1Count > 0 && t.allTitles.length === 0
}

const ITEMS: NavItem[] = SIDEBAR_NAV.flatMap((g) =>
  g.items.flatMap((i) => [i, ...(i.children ?? [])])
).filter((i) => !i.pendingNote)

const SCREENS: ScreenTitle[] = []
for (const item of ITEMS) {
  if (SCREENS.some((s) => s.href === item.href)) continue
  const page = pageFile(item.href)
  const own = page ? surfaceFiles(page) : []
  const wrappers = page ? layoutFiles(item.href) : []
  let h1Count = 0
  const h1Titles: string[] = []
  const allTitles: string[] = []
  for (const f of [...own, ...wrappers]) {
    const src = read(f)
    h1Count += (stripComments(src).match(H1_TAG_RE) ?? []).length
    const h1 = titlesIn(src, 'h1')
    // ⚠️ 「같은 이름 주장」 검사에는 **자기 파일의 h1 만** 넣는다. layout 의 h1 은 그 구역
    //   전체가 공유하는 것이라(교재 공장의 「교재 공장」), 넣으면 아홉 화면이 서로
    //   충돌하는 것으로 잡힌다 — 설계대로 동작하는 것을 위반이라 부르는 셈이다.
    if (own.includes(f)) h1Titles.push(...h1)
    allTitles.push(...h1, ...titlesIn(src, 'h2'))
  }
  SCREENS.push({
    href: item.href,
    label: item.label,
    tag: item.tag ?? null,
    hasPage: page != null,
    h1Count,
    h1Titles,
    allTitles,
  })
}

/**
 * **h1 이 없어도 되는 자리** — 이유가 있는 것만. 늘리려면 이유를 함께 적는다.
 *
 * 지금은 비어 있다. 2026-09-06 측정 중에는 `/admin/db` 가 여기 있었는데(다른 세션이 그 화면을
 * 다시 짜는 중이었다), 같은 날 그 작업이 h1 을 붙이면서 예외가 필요 없어졌다.
 */
const NO_H1_ALLOWED: Record<string, string> = {}

/**
 * **이름이 서로를 못 알아보는 화면** — 2026-09-06 실측 7개.
 *
 * 여기 적힌 것은 「고쳐야 할 목록」이 아니라 **알고 있는 목록**이다. 화면 제목은 그 파이프라인의
 * 것이고, 영문 제목(`Comic Pipeline`)에는 메뉴의 오른쪽 색인(`tag`)이 이미 다리를 놓는다.
 * 이 검사가 막는 것은 **새로 늘어나는 것**이다 — 수를 상한으로 두면 하나가 고쳐질 때
 * 다른 하나가 새로 생겨도 안 걸리므로, 이름으로 못 박는다.
 */
const KNOWN_MISMATCH: Record<string, string> = {
  '/admin/curation':
    '「📚 라이브러리 큐레이션」 — 같은 뜻이지만 낱말이 안 겹친다. tag 「LCP」가 다리',
  '/admin/articles': '「📰 Article Curation Pipeline」 — 영문 제목. tag 「ACP」가 다리',
  '/admin/comic': '「Comic Pipeline」 — 영문 제목. tag 「CCP」가 다리',
  '/admin/pd-comics': '제목이 JSX 표현식 + h2 에도 라벨 낱말이 없다. tag 「PDCP」가 다리',
  '/admin/vrl/automation': '「VRL Automation Dashboard」 — 영문 제목. 부모가 VRL 이라 맥락은 선다',
  '/admin/users': '화면 제목이 「사용자 관리」가 아니라 표 제목들이다',
  '/admin/reports': '메뉴는 「신고/문의」, 화면은 「신고 처리」 계열 — 낱말이 안 겹친다',
}

describe('메뉴 이름 ↔ 화면 제목', () => {
  it('실측을 표로 남긴다 — 기준을 고칠 때 근거를 눈으로 본다', () => {
    const rows = SCREENS.map(
      (s) =>
        `${s.href.padEnd(24)} 메뉴[${s.label}${s.tag ? ` ${s.tag}` : ''}]` +
        ` h1 ${s.h1Count} ${recognizable(s) ? '✓' : unreadable(s) ? '?' : '✗'} ${s.h1Titles.slice(0, 2).join(' / ')}`
    )
    // eslint-disable-next-line no-console -- 기준을 정하는 근거를 눈으로 봐야 한다
    console.log(
      `\n${rows.join('\n')}\n` +
        `\n화면 ${SCREENS.length} · h1 없음 ${SCREENS.filter((s) => s.h1Count === 0).length}` +
        ` · 이름 못 알아봄 ${SCREENS.filter((s) => !recognizable(s) && !unreadable(s)).length} · 판정 불가 ${SCREENS.filter(unreadable).length}`
    )
    expect(SCREENS.length).toBeGreaterThan(0)
  })

  // ── 스캐너 자기검사 ────────────────────────────────────────────────
  // 파서가 죽어 0건을 긁으면 아래 검사가 전부 "위반 없음" 으로 통과한다. 바닥을 박아 둔다.
  it('스캐너가 실제로 화면을 찾아낸다', () => {
    expect(SCREENS.length).toBeGreaterThanOrEqual(20)
    expect(SCREENS.filter((s) => s.hasPage).length).toBeGreaterThanOrEqual(20)
    expect(SCREENS.filter((s) => s.allTitles.length > 0).length).toBeGreaterThanOrEqual(10)
  })

  it('메뉴가 가리키는 모든 라우트에 page.tsx 가 있다 — 없으면 404 로 가는 항목이다', () => {
    const missing = SCREENS.filter((s) => !s.hasPage).map((s) => `${s.label}(${s.href})`)
    expect(missing, `page.tsx 없음: ${missing.join(', ')}`).toEqual([])
  })

  it('h1 이 없는 화면이 없다 — 스크린리더로 들어오면 여기가 어디인지 말할 줄이 없다', () => {
    const none = SCREENS.filter((s) => s.h1Count === 0 && !(s.href in NO_H1_ALLOWED)).map(
      (s) => `${s.label}(${s.href})`
    )
    expect(none, `h1 없음: ${none.join(', ')}`).toEqual([])
  })

  it('예외 목록이 낡지 않았다 — 고쳐진 화면이 예외로 남아 있으면 지운다', () => {
    for (const href of Object.keys(NO_H1_ALLOWED)) {
      const s = SCREENS.find((x) => x.href === href)
      expect(s, `예외 ${href} 가 메뉴에 없다`).toBeDefined()
      expect(s!.h1Count, `${href} 는 이제 h1 이 있다 — NO_H1_ALLOWED 에서 지울 것`).toBe(0)
    }
  })

  it('메뉴 이름을 화면에서 못 알아보는 자리가 늘지 않는다', () => {
    const bad = SCREENS.filter((s) => !recognizable(s) && !unreadable(s)).map((s) => s.href)
    const isNew = bad.filter((h) => !(h in KNOWN_MISMATCH))
    expect(isNew, `새로 어긋난 화면: ${isNew.join(', ')}`).toEqual([])
  })

  it('아는 목록이 낡지 않았다 — 고쳐진 화면이 목록에 남아 있으면 지운다', () => {
    const bad = new Set(
      SCREENS.filter((s) => !recognizable(s) && !unreadable(s)).map((s) => s.href)
    )
    const fixed = Object.keys(KNOWN_MISMATCH).filter((h) => !bad.has(h))
    expect(fixed, `이제 이름이 통한다 — KNOWN_MISMATCH 에서 지울 것: ${fixed.join(', ')}`).toEqual(
      []
    )
  })

  it('두 화면이 같은 이름을 주장하지 않는다', () => {
    // 실제로 났던 사고: `/admin/vrl` 이 「Dictionary DB Health」를 달고 있었는데
    // 메뉴에는 `/admin/db` 가 「DB 헬스」로 따로 있었다.
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const s of SCREENS) {
      for (const t of s.h1Titles) {
        const key = t.toLowerCase().replace(/[\s·—-]+/g, '')
        if (!key) continue
        const owner = seen.get(key)
        if (owner && owner !== s.href) clashes.push(`「${t}」 ${owner} ↔ ${s.href}`)
        else seen.set(key, s.href)
      }
    }
    expect(clashes, clashes.join(' / ')).toEqual([])
  })
})
