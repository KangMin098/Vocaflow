// apps/web/src/app/admin/__tests__/help-links.test.ts
//
// **화면도움말이 죽은 라우트를 가리키지 않게 한다.**
//
// ── 왜 이 회귀가 있나 (실측 2026-09-06) ─────────────────────────────
// `/admin/textbook` 을 지운 커밋이 그 라우트를 가리키던 도움말 링크 **세 개**를 남겼다
// (`textbook/sources` 하나 · `csat` 둘). 눌러 보기 전에는 멀쩡해 보이고, 누르면 404 다.
// 관리자에게 도움말은 "다음에 어디로 가나" 에 답하는 자리라 **죽은 링크는 코드보다 위험하다** —
// 화면이 없어진 것인지 자기가 길을 잘못 든 것인지 알 수 없다.
//
// `types.ts` 는 이미 저장소 문서(`docs/*.md`)를 `href` 로 쓰지 못하게 타입을 갈라 뒀다.
// 그때 막은 것은 "public 에 없는 파일" 이었고, **앱 라우트가 사라지는 경우**는 안 막혀 있었다.
//
// ⚠️ **라우트 그룹을 반드시 따라가야 한다.** 처음에는 `app/<경로>/page.tsx` 만 봤는데
//   `/comics/restored` 가 실제로는 `app/(main)/comics/restored/page.tsx` 라 **멀쩡한 링크
//   둘을 죽었다고 잡았다.** Admin 은 route group 을 안 쓰지만(CLAUDE.md) 학습자 쪽은 쓰고,
//   도움말은 그쪽으로도 링크한다. 오탐을 남기면 이 회귀가 곧 무시된다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { GRADE_NEXT_STEP } from '@vocaflow/library-pipeline'

import { HELP_REGISTRY } from '@/lib/admin/help'
import type { ScreenHelp } from '@/lib/admin/help'

const APP_DIR = path.resolve(__dirname, '../../')

/** 이 화면(또는 탭) 하나가 가진 앱 링크. */
function appHrefs(screen: ScreenHelp | undefined): string[] {
  if (!screen?.seeAlso) return []
  return screen.seeAlso
    .map((r) => ('href' in r ? r.href : null))
    .filter((h): h is string => typeof h === 'string' && h.startsWith('/'))
}

/** 레지스트리 전체를 훑어 `{어느 화면에서, 어디로}` 를 모은다. */
function allLinks(): { from: string; href: string }[] {
  const out: { from: string; href: string }[] = []
  for (const [key, entry] of Object.entries(HELP_REGISTRY)) {
    for (const href of appHrefs(entry.screen)) out.push({ from: key, href })
    for (const [tab, help] of Object.entries(entry.tabs ?? {})) {
      for (const href of appHrefs(help)) out.push({ from: `${key} › ${tab}`, href })
    }
  }
  return out
}

/** 이 디렉터리 바로 아래의 라우트 그룹들 — `(main)` 처럼 URL 에 안 나타나는 칸. */
function groupDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('(') && d.name.endsWith(')'))
    .map((d) => path.join(dir, d.name))
}

/** 한 칸씩 내려간다 — 각 칸에서 그룹을 건너뛰는 길도 함께 본다. */
function resolveDirs(from: string, segments: string[]): string[] {
  if (!segments.length) return [from]
  const [head, ...rest] = segments
  const next: string[] = []
  for (const base of [from, ...groupDirs(from)]) {
    const cand = path.join(base, head!)
    if (fs.existsSync(cand)) next.push(...resolveDirs(cand, rest))
  }
  return next
}

/** `/admin/csat/press` → `app/admin/csat/press/page.tsx`(또는 그룹을 낀 경로)가 있는가. */
function routeExists(href: string): boolean {
  const clean = href.split(/[?#]/)[0]!.replace(/\/$/, '')
  const segments = clean.split('/').filter(Boolean)
  return resolveDirs(APP_DIR, segments).some(
    (d) => fs.existsSync(path.join(d, 'page.tsx')) || fs.existsSync(path.join(d, 'page.ts')),
  )
}

describe('화면도움말의 앱 링크', () => {
  const links = allLinks()

  it('링크가 실제로 있다 — 없으면 어느 화면의 어느 링크인지 이름으로 말한다', () => {
    const dead = links.filter((l) => !routeExists(l.href))
    // 실패 메시지가 곧 할 일 목록이어야 한다 — 개수만 알려 주면 다시 찾아야 한다.
    expect(dead.map((l) => `${l.from} → ${l.href}`)).toEqual([])
  })

  it('검사할 링크가 실제로 있다 — 0 개를 통과로 세지 않는다', () => {
    // 수집기가 깨져 빈 배열을 돌려주면 위 검사가 **항상 통과**한다.
    expect(links.length).toBeGreaterThan(10)
  })

  it('**처방이 가리키는 스크립트가 실제로 있다**', () => {
    // 실측 2026-09-06: 「내용 판정이면 `gate-make.mjs` 를 돌린다」고 적혀 있었는데
    // 그 스크립트는 **발췌창을 채우는 결정론 스크립트**라 판정과 무관하다. 파일은 있으므로
    // 이 검사로도 안 잡히지만, **이름이 바뀌거나 지워지는 쪽**은 잡는다 — 그쪽이 더 흔하다.
    const REPO = path.resolve(__dirname, '../../../../../..')
    const text = JSON.stringify(HELP_REGISTRY) + JSON.stringify(GRADE_NEXT_STEP)
    const paths = [...new Set([...text.matchAll(/scripts\/[\w/-]+\.mjs/g)].map((m) => m[0]))]
    expect(paths.length).toBeGreaterThan(5)
    const missing = paths.filter((p) => !fs.existsSync(path.join(REPO, p)))
    expect(missing).toEqual([])
  })

  it('외부 URL 은 파일로 판정하지 않는다', () => {
    // `http` 로 시작하는 링크는 이 검사의 대상이 아니다(수집에서 이미 빠진다).
    const external = Object.values(HELP_REGISTRY).flatMap((e) =>
      (e.screen.seeAlso ?? []).map((r) => ('href' in r ? r.href : '')),
    )
    for (const h of external) {
      if (h && h.startsWith('http')) expect(links.some((l) => l.href === h)).toBe(false)
    }
  })
})
