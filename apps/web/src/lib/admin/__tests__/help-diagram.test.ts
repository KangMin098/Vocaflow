// apps/web/src/lib/admin/__tests__/help-diagram.test.ts
//
// **도움말이 다시 산문 벽이 되지 않게 지킨다.**
//
// ── 왜 이 회귀가 생겼나 (실측 2026-09-12) ────────────────────────────
// 교재 공장 화면 11개의 도움말이 **45,379자**였다. 절별로 `fields` 41% · `drain` 36% —
// 즉 **77%가 산문 목록**이고, 패널을 열면 그 벽이 한꺼번에 왔다. 관리자가 묻는 것은 대개
// 「지금 어느 칸이고 다음은 무엇인가」 하나인데 그 답이 4,000자 안에 섞여 있었다.
//
// 고친 방향은 `/admin/db` 의 전례와 같다 — **지우지 않고 접고**, 보이는 자리에는 그림을 둔다.
// 그런데 그림은 쉽게 산문으로 되돌아간다(칸 설명이 한 줄씩 길어지면 그림 모양의 문단이 된다).
// 그래서 여기서 **길이에 상한**을 두고, 접힘이 실제로 닫혀 있는지를 렌더 결과로 잰다.
//
// ⚠️ 이 파일의 상한은 **실측에서 나온 값**이다(아래 각 검사의 주석). 짐작으로 조이면
//   멀쩡한 도움말이 걸리고, 그러면 다음 사람이 검사를 지운다.

import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { HelpBody } from '@/components/admin/AdminScreenHelp'
import { HELP_REGISTRY } from '@/lib/admin/help'
import type { HelpDiagram, ScreenHelp, ScreenHelpEntry } from '@/lib/admin/help/types'

/** 교재 공장 화면 전부 — 사이드바 「교재 공장」 아래 도움말이 있는 슬러그. */
const FACTORY = [
  'csat',
  'csat-new',
  'csat-catalog',
  'csat-strategy',
  'csat-blueprint',
  'csat-sourcing',
  'csat-authoring',
  'csat-review',
  'csat-press',
  'csat-evidence',
  'csat-sources',
] as const

const entry = (k: string): ScreenHelpEntry => {
  const e = (HELP_REGISTRY as Record<string, ScreenHelpEntry | undefined>)[k]
  if (!e) throw new Error(`도움말이 없다: ${k}`)
  return e
}

const bodies = (e: ScreenHelpEntry): ScreenHelp[] => [e.screen, ...Object.values(e.tabs ?? {})]
const allDiagrams = (e: ScreenHelpEntry): HelpDiagram[] => bodies(e).flatMap((b) => b.diagrams ?? [])

describe('교재 공장 화면마다 도식이 있다', () => {
  it.each(FACTORY)('%s 에 도식이 있다', (key) => {
    // 화면 단위 본문에 있어야 한다 — 탭에만 있으면 탭을 안 옮긴 사람은 못 본다.
    expect(entry(key).screen.diagrams?.length ?? 0).toBeGreaterThan(0)
  })

  it('11 화면 전부가 덮였다 — 하나라도 빠지면 그 화면이 옛 모양으로 남는다', () => {
    const covered = FACTORY.filter((k) => (entry(k).screen.diagrams?.length ?? 0) > 0)
    expect(covered).toHaveLength(FACTORY.length)
  })

  // ── 왜 탭까지 재는가 (실측 2026-09-13) ──────────────────────────────
  // 화면 단위는 11/11 이 덮였는데 **탭 50개 중 도식이 있는 것은 0개**였다.
  // 탭은 화면이 아니라서 위 검사에 안 걸리는데, 관리자가 실제로 머무는 자리는 탭이다
  // (`csat-evidence` 는 네 탭이 각각 다른 일을 한다). 그래서 같은 규칙을 탭에도 건다.
  it('탭이 있는 교재 공장 화면은 탭마다 도식이 있다', () => {
    const bare = FACTORY.flatMap((k) =>
      Object.entries(entry(k).tabs ?? {})
        .filter(([, help]) => (help.diagrams?.length ?? 0) === 0)
        .map(([tab]) => `${k} / ${tab}`),
    )
    expect(bare).toEqual([])
  })
})

describe('도식이 산문으로 되돌아가지 않는다', () => {
  const nodes = FACTORY.flatMap((k) => allDiagrams(entry(k)).flatMap((d) => d.nodes))

  it('칸 이름은 20자 이내다', () => {
    // 실측: 지금 가장 긴 라벨이 14자(「◐ 해설 모자람」·「L2 3인 페르소나」). 20 은 그 위 여유다.
    const tooLong = nodes.filter((n) => n.label.length > 20).map((n) => `${n.label} (${n.label.length})`)
    expect(tooLong).toEqual([])
  })

  it('칸 설명은 48자 이내다 — 이보다 길면 fields 에 들어갈 내용이다', () => {
    const tooLong = nodes
      .filter((n) => (n.says?.length ?? 0) > 48)
      .map((n) => `${n.label}: ${n.says?.length}자`)
    expect(tooLong).toEqual([])
  })

  it('한 도식의 칸은 6개 이내다 — 더 늘면 390px 에서 세로로 여섯 번 접힌다', () => {
    const tooMany = FACTORY.flatMap((k) =>
      allDiagrams(entry(k))
        .filter((d) => d.nodes.length > 6)
        .map((d) => `${k}: ${d.caption} (${d.nodes.length}칸)`),
    )
    expect(tooMany).toEqual([])
  })

  it('caption 은 화면 안에서 겹치지 않는다 — 렌더가 그것을 key 로 쓴다', () => {
    for (const k of FACTORY) {
      const caps = allDiagrams(entry(k)).map((d) => d.caption)
      expect(new Set(caps).size, `${k} 의 caption 이 겹친다`).toBe(caps.length)
    }
  })

  it('칸 이름은 서로 다르다 — 렌더가 그것도 key 로 쓴다', () => {
    for (const k of FACTORY) {
      for (const d of allDiagrams(entry(k))) {
        const labels = d.nodes.map((n) => n.label)
        expect(new Set(labels).size, `${k} / ${d.caption} 의 칸 이름이 겹친다`).toBe(labels.length)
      }
    }
  })
})

describe('열었을 때 먼저 오는 것이 산문 벽이 아니다', () => {
  /** 패널을 **연 상태**로 그려 보이는 글자만 센다(닫힌 `<details>` 안은 제외된다). */
  function visibleChars(key: string): number {
    const html = renderToString(createElement(HelpBody, { body: entry(key).screen }))
    // `<details>` 는 기본 닫힘이라 그 안의 글자는 화면에 없다 — 통째로 지운 뒤 센다.
    // (요약줄 자체는 남겨야 한다: 그것은 보이는 글자다.)
    const opened = html.replace(/<details[\s\S]*?<\/details>/g, (m) => {
      const sum = /<summary[\s\S]*?<\/summary>/.exec(m)
      return sum ? sum[0] : ''
    })
    return opened
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length
  }

  it.each(FACTORY)('%s — 보이는 글자가 2,600자 이내다', (key) => {
    // ⚠️ 상한의 근거: 접기 전 실측 평균이 화면당 **4,125자**(45,379/11)였고 가장 무거운
    //   `csat-sources` 는 11,306자였다. `fields`·`drain`(77%)을 접으면 남는 것은
    //   summary + when + 도식 + cautions 이고, cautions 가 가장 두꺼운 화면도 2,600 아래다.
    //   **경고는 일부러 안 접는다** — 안 읽으면 사고가 나는 것만 거기 있다.
    expect(visibleChars(key)).toBeLessThanOrEqual(2600)
  })

  it('11 화면 합계가 접기 전의 40% 아래다', () => {
    // 접기 전 45,379자(실측 2026-09-12). 40% = 18,151.
    const total = FACTORY.reduce((n, k) => n + visibleChars(k), 0)
    expect(total).toBeLessThan(18_151)
  })

  it('무거운 두 절은 닫힌 채로 나온다 — 여는 것은 사람이 정한다', () => {
    // 변이 검사: `<details>` 를 `<div>` 로 바꾸면 위 두 상한이 깨진다.
    const html = renderToString(createElement(HelpBody, { body: entry('csat-sources').screen }))
    expect(html).toContain('<details')
    expect(html).not.toContain('<details open')
  })

  it('그림이 산문보다 위에 온다', () => {
    const html = renderToString(createElement(HelpBody, { body: entry('csat-press').screen }))
    const fig = html.indexOf('<figure')
    const fold = html.indexOf('<details')
    expect(fig).toBeGreaterThan(-1)
    expect(fold).toBeGreaterThan(fig)
  })
})

// ── 왜 전역으로도 재는가 (실측 2026-09-13) ──────────────────────────
// 위 검사는 `FACTORY` 11 화면만 본다. 교재 공장 밖에 도식을 붙이기 시작하자(재저작 8곳)
// **그 도식들은 어떤 한도도 안 받았다** — 라벨이 길어지든 칸이 여덟 개가 되든 아무도 안 막는다.
// 한도는 390px 화면에서 나온 것이라 화면이 어디든 똑같이 적용된다.
describe('도식이 붙은 화면은 어디든 같은 한도를 받는다', () => {
  const withDiagrams = Object.entries(HELP_REGISTRY).filter(
    ([, e]) => allDiagrams(e as ScreenHelpEntry).length > 0,
  ) as [string, ScreenHelpEntry][]

  it('교재 공장 밖에도 도식이 있다 — 없으면 이 검사가 아무것도 안 지킨다', () => {
    const outside = withDiagrams.filter(([k]) => !(FACTORY as readonly string[]).includes(k))
    expect(outside.length).toBeGreaterThan(0)
  })

  it('칸 이름 20자 · 칸 설명 48자', () => {
    const over = withDiagrams.flatMap(([k, e]) =>
      allDiagrams(e).flatMap((d) =>
        d.nodes.flatMap((n) => [
          ...(n.label.length > 20 ? [`${k}: 라벨 ${n.label.length}자 「${n.label}」`] : []),
          ...((n.says?.length ?? 0) > 48 ? [`${k}: says ${n.says!.length}자 「${n.says}」`] : []),
        ]),
      ),
    )
    expect(over).toEqual([])
  })

  it('한 도식의 칸은 6개 이내다', () => {
    const tooMany = withDiagrams.flatMap(([k, e]) =>
      allDiagrams(e)
        .filter((d) => d.nodes.length > 6)
        .map((d) => `${k}: ${d.caption} (${d.nodes.length}칸)`),
    )
    expect(tooMany).toEqual([])
  })

  it('caption 은 화면 안에서, 칸 이름은 도식 안에서 겹치지 않는다 — 렌더가 key 로 쓴다', () => {
    const dup: string[] = []
    for (const [k, e] of withDiagrams) {
      const caps = allDiagrams(e).map((d) => d.caption)
      if (new Set(caps).size !== caps.length) dup.push(`${k}: caption 겹침`)
      for (const d of allDiagrams(e)) {
        const labels = d.nodes.map((n) => n.label)
        if (new Set(labels).size !== labels.length) dup.push(`${k} / ${d.caption}: 칸 이름 겹침`)
      }
    }
    expect(dup).toEqual([])
  })
})
