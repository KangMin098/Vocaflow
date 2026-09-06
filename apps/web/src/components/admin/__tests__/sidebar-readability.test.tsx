// apps/web/src/components/admin/__tests__/sidebar-readability.test.tsx
//
// **「왼쪽 메뉴가 안 읽힌다」를 숫자로 만든 회귀.**
//
// 가독성은 취향 논쟁이 되기 쉬워서 지침으로만 적으면 다음 사람이 되돌린다. 그래서 네 가지를 잰다 —
// 전부 소스와 렌더 결과에서 직접 나오는 값이라 손으로 못 속인다:
//
//   ① **한 묶음의 크기** — 머리글 없이 이어지는 1차 항목 수. 눈이 한 번에 훑는 덩어리의 상한.
//   ② **글자 크기 하한** — 사이드바에서 쓰는 가장 작은 글자.
//   ③ **대비** — 비활성 글자색의 실제 대비비(토큰을 합성해 계산).
//   ④ **하위메뉴 소속** — 하위가 자기 부모 안에 있는 것으로 **보이는가**, 그리고
//      하위로 들어갔을 때 **안 사라지는가**.
//
// ④ 가 이 파일이 생긴 이유다. 2026-09-06 실측 당시 「원문 적격」(`/admin/textbook/sources`)이
// 교재 공장의 하위 항목인데 href 가 `/admin/csat` 밖이라, **그 항목을 누르면 자기가 속한
// 하위메뉴 전체가 접혔다**. 화면은 멀쩡히 뜨므로 아무도 못 잡는다.

import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

let PATH = '/admin'
vi.mock('next/navigation', () => ({ usePathname: () => PATH }))

const { AdminSidebar, SIDEBAR_NAV, isOpen, toggleOverrides } = await import(
  '../AdminSidebar'
)

const RAW = readFileSync(fileURLToPath(new URL('../AdminSidebar.tsx', import.meta.url)), 'utf8')

/**
 * 주석을 걷어낸 소스 — **스캔은 코드만 본다.**
 *
 * 안 걷어내면 "`opacity-60` 을 쓰지 마라" 라고 적은 주석 자체가 위반으로 잡힌다(실측:
 * 그 문장을 쓴 커밋에서 바로 빨간불이 났다). 규칙을 설명하는 글이 규칙 위반이 되면
 * 다음 사람은 설명을 지우지 규칙을 지키지 않는다.
 */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function render(pathname: string): string {
  PATH = pathname
  return renderToString(<AdminSidebar reportsBadge={null} />)
}

/** 렌더 HTML 에서 링크 href 를 순서대로 뽑는다. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!)
}

// ── 대비 계산 (WCAG 2.1) ───────────────────────────────────────────────
function srgbToLin(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
function lum([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b)
}
/** 알파 합성 — 반투명 잉크(`--t2`/`--t3`)를 배경 위에 올린 실제 색. */
function over(
  ink: [number, number, number],
  alpha: number,
  bg: [number, number, number]
): [number, number, number] {
  return [0, 1, 2].map((i) => alpha * ink[i]! + (1 - alpha) * bg[i]!) as [number, number, number]
}
export function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number]
  return (a + 0.05) / (b + 0.05)
}

/** `packages/design-tokens/src/tokens.css` 의 실제 값 — 바뀌면 아래 자기검사가 잡는다. */
const INK: [number, number, number] = [26, 23, 20] // #1A1714
const BG2: [number, number, number] = [244, 240, 233] // #F4F0E9 — 사이드바 그러데이션의 어두운 끝
const T2_A = 0.74
const T3_A = 0.62

describe('관리자 사이드바 가독성', () => {
  it('실측을 표로 남긴다 — 기준을 고칠 때 근거를 눈으로 본다', () => {
    const html = render('/admin/csat')
    const sizes = [...SRC.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1]))
    const top = SIDEBAR_NAV.flatMap((g) => g.items).length
    const biggest = Math.max(...SIDEBAR_NAV.map((g) => g.items.length))
    // eslint-disable-next-line no-console -- 기준을 정하는 근거를 눈으로 봐야 한다
    console.log(
      `\n1차 항목 ${top} · 묶음 ${SIDEBAR_NAV.length} · 최대 묶음 ${biggest}` +
        `\n글자 크기 ${[...new Set(sizes)].sort((a, b) => a - b).join(' / ')}px` +
        `\n링크 ${hrefs(html).length}` +
        `\n비활성 t3 대비 ${contrast(over(INK, T3_A, BG2), BG2).toFixed(2)}` +
        ` · t2 대비 ${contrast(over(INK, T2_A, BG2), BG2).toFixed(2)}`
    )
    expect(top).toBeGreaterThan(0)
  })

  // ── ① 한 묶음의 크기 ────────────────────────────────────────────────
  it('머리글 없이 이어지는 1차 항목이 8개를 넘지 않는다', () => {
    for (const g of SIDEBAR_NAV) {
      expect(
        g.items.length,
        `묶음 「${g.label ?? '(무제)'}」 에 1차 항목 ${g.items.length}개 — 눈이 한 번에 못 훑는다`
      ).toBeLessThanOrEqual(8)
    }
  })

  it('모든 묶음에 이름이 있다 — 대시보드 한 줄만 예외', () => {
    for (const g of SIDEBAR_NAV) {
      if (g.label === null) expect(g.items.length).toBe(1)
      else expect(g.label.length).toBeGreaterThan(0)
    }
  })

  // ── ② 글자 크기 하한 ───────────────────────────────────────────────
  it('11px 미만 글자를 쓰지 않는다', () => {
    const tooSmall = [...SRC.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n < 11)
    expect(tooSmall, `11px 미만 ${tooSmall.join(', ')}px`).toEqual([])
  })

  // ── ③ 대비 ─────────────────────────────────────────────────────────
  it('비활성 항목 글자가 AA(4.5) 를 넘는다 — 그리고 opacity 로 깎지 않는다', () => {
    expect(contrast(over(INK, T3_A, BG2), BG2)).toBeGreaterThanOrEqual(4.5)
    // `opacity-60` 을 t3 글자에 걸면 실효 알파가 0.372 로 떨어져 2.31:1 이 된다 — AA 실패.
    // 실제로 「해설(준비 중)」 줄이 그랬다. 흐리게 하고 싶으면 색을 바꾸지 투명도를 깎지 않는다.
    expect(contrast(over(INK, T3_A * 0.6, BG2), BG2)).toBeLessThan(4.5) // 자기검사: 계산이 살아 있다
    expect(SRC, 'opacity-6x 로 글자를 깎고 있다').not.toMatch(/opacity-6\d/)
  })

  // ── ④ 하위메뉴 소속 ────────────────────────────────────────────────
  it('하위 항목의 href 가 부모 밖이어도 하위메뉴가 안 접힌다', () => {
    // 부모 안에 있으면 당연히 열린다.
    expect(hrefs(render('/admin/csat/catalog'))).toContain('/admin/csat/press')
    // 부모 밖 href 를 가진 하위 항목들 — 그 자리에서도 형제가 보여야 한다.
    for (const parent of SIDEBAR_NAV.flatMap((g) => g.items)) {
      for (const child of parent.children ?? []) {
        if (child.href.startsWith(parent.href + '/') || child.href === parent.href) continue
        const seen = hrefs(render(child.href))
        for (const sib of parent.children ?? []) {
          if (sib.pendingNote) continue
          expect(
            seen,
            `「${child.label}」(${child.href}) 에서 형제 「${sib.label}」 이 사라진다`
          ).toContain(sib.href)
        }
      }
    }
  })

  it('하위메뉴가 부모에 시각적으로 붙어 있다 — 계층 표시(레일 + 가지)가 있다', () => {
    const html = render('/admin/csat')
    // 접힘 상태와 펼침 상태가 실제로 다르다 (다른 파이프라인에서는 하위가 안 보인다)
    expect(hrefs(render('/admin/users'))).not.toContain('/admin/csat/press')
    // 하위 목록은 자기 면(`role="group"`)을 갖고 부모가 그것을 가리킨다
    expect(html).toMatch(/role="group"/)
    expect(html).toMatch(/aria-expanded="true"/)
  })

  it('하위를 가진 항목은 접혔을 때 그 사실을 알린다', () => {
    const html = render('/admin/users')
    expect(html).toMatch(/aria-expanded="false"/)
  })

  // ── ⑤ 접기 / 펴기 ──────────────────────────────────────────────────
  //
  // 경로 규칙만 있던 동안 관리자는 하위메뉴를 **끌 수 없었다.** 하위 11칸이 필요 없는 동안에도
  // 그 11줄이 화면을 먹었고, 밖에서 하위 화면으로 바로 가려면 부모를 먼저 거쳐야 했다.
  // 여기서 잠그는 것은 세 가지다 — 버튼이 있는가 · 규칙이 맞는가 · 링크 안에 버튼이 없는가.

  it('하위를 가진 항목마다 접기/펴기 버튼이 있다', () => {
    const parents = SIDEBAR_NAV.flatMap((g) => g.items).filter((i) => i.children?.length)
    expect(parents.length, '토글할 부모가 하나도 없다 — 이 절이 무의미해졌다').toBeGreaterThan(0)
    const html = render('/admin/users') // 전부 접혀 있는 자리
    const buttons = [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"[^>]*>/g)]
    expect(buttons.length).toBe(parents.length)
    for (const parent of parents) {
      // 라벨은 **다음에 무슨 일이 일어나는지**를 말한다("펼치기"), 상태 이름이 아니다.
      expect(html, `「${parent.label}」 토글 라벨이 없다`).toContain(
        `${parent.label} 하위 ${parent.children!.filter((c) => !c.pendingNote).length}개 펼치기`
      )
    }
  })

  it('aria-controls 가 펼쳤을 때 실재하는 패널을 가리킨다', () => {
    const html = render('/admin/csat')
    const ids = [...html.matchAll(/aria-expanded="true"[^>]*aria-controls="([^"]+)"/g)].map(
      (m) => m[1]!
    )
    const alt = [...html.matchAll(/aria-controls="([^"]+)"[^>]*aria-expanded="true"/g)].map(
      (m) => m[1]!
    )
    const open = [...new Set([...ids, ...alt])]
    expect(open.length, '펼쳐진 토글이 없다').toBeGreaterThan(0)
    for (const id of open) {
      expect(html, `aria-controls="${id}" 가 없는 것을 가리킨다`).toContain(`id="${id}"`)
    }
  })

  it('링크 안에 버튼을 넣지 않는다 — 중첩 인터랙티브는 키보드로 못 닿는다', () => {
    const html = render('/admin/csat')
    let from = 0
    let anchors = 0
    for (;;) {
      const a = html.indexOf('<a ', from)
      if (a === -1) break
      const close = html.indexOf('</a>', a)
      expect(close, '<a> 가 안 닫힌다').toBeGreaterThan(a)
      expect(html.slice(a, close), `<a> 안에 <button> 이 있다 (offset ${a})`).not.toContain(
        '<button'
      )
      anchors += 1
      from = close + 4
    }
    expect(anchors, '앵커를 하나도 못 찾았다 — 이 검사가 꺼져 있다').toBeGreaterThan(15)
  })

  it('기본값은 경로가 정한다 — 관리자가 아무것도 안 정했을 때', () => {
    const csat = SIDEBAR_NAV.flatMap((g) => g.items).find((i) => i.href === '/admin/csat')!
    expect(isOpen(csat, '/admin/csat/press', {})).toBe(true)
    expect(isOpen(csat, '/admin/users', {})).toBe(false)
    // 하위가 없는 항목은 열 것이 없다
    const users = SIDEBAR_NAV.flatMap((g) => g.items).find((i) => i.href === '/admin/users')!
    expect(isOpen(users, '/admin/users', { '/admin/users': true })).toBe(false)
  })

  it('관리자가 정한 값이 경로를 이긴다 — 양쪽 방향 모두', () => {
    const csat = SIDEBAR_NAV.flatMap((g) => g.items).find((i) => i.href === '/admin/csat')!
    expect(isOpen(csat, '/admin/csat/press', { '/admin/csat': false })).toBe(false) // 안에서 접기
    expect(isOpen(csat, '/admin/users', { '/admin/csat': true })).toBe(true) // 밖에서 펴기
  })

  it('기본값으로 돌아오는 클릭은 저장값을 지운다 — 한 번 편 것이 영구 고정되지 않는다', () => {
    const csat = SIDEBAR_NAV.flatMap((g) => g.items).find((i) => i.href === '/admin/csat')!
    const outside = '/admin/users'
    // 밖에서 펴기 → 저장된다
    const opened = toggleOverrides({}, csat, outside)
    expect(opened).toEqual({ '/admin/csat': true })
    // 다시 접기 → 기본값(닫힘)과 같아지므로 **키가 사라진다**
    expect(toggleOverrides(opened, csat, outside)).toEqual({})
    // 안에서 접기 → 기본값(열림)과 다르므로 저장된다
    const inside = '/admin/csat/press'
    expect(toggleOverrides({}, csat, inside)).toEqual({ '/admin/csat': false })
    expect(toggleOverrides({ '/admin/csat': false }, csat, inside)).toEqual({})
    // 남의 키는 건드리지 않는다
    expect(toggleOverrides({ '/admin/vrl': true }, csat, outside)).toEqual({
      '/admin/vrl': true,
      '/admin/csat': true,
    })
  })

  it('접힌 부모가 「지금 그 안에 있다」를 잃지 않는다', () => {
    // 하위가 안 보이는 동안 유일한 단서는 부모 줄의 강조다. 접힘 상태에서도 부모 이름이
    // 진하게(font-[600]) 남는지를 잰다 — 이게 빠지면 자기 위치가 메뉴에서 사라진다.
    const openHtml = render('/admin/csat/press')
    expect(openHtml).toMatch(/aria-expanded="true"/)
    // 서버 렌더는 항상 기본값이므로 접힘 상태는 규칙 함수로 잰다.
    const csat = SIDEBAR_NAV.flatMap((g) => g.items).find((i) => i.href === '/admin/csat')!
    expect(isOpen(csat, '/admin/csat/press', { '/admin/csat': false })).toBe(false)
    expect(SRC, '접힘+안쪽일 때 강조(lit)를 켜는 규칙이 사라졌다').toMatch(
      /const lit = isActive \|\| open \|\| inside/
    )
  })

  // ── 자기 무력화 방지 ───────────────────────────────────────────────
  it('스캔이 실제로 무언가를 보고 있다', () => {
    expect(SRC.length).toBeGreaterThan(4000)
    expect(RAW.length).toBeGreaterThan(SRC.length) // 주석 제거가 실제로 뭔가를 지웠다
    expect([...SRC.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].length).toBeGreaterThan(5)
    expect(hrefs(render('/admin')).length).toBeGreaterThan(15)
  })
})
