// apps/web/src/app/__tests__/page-titles.test.ts
//
// **탭에 브랜드가 두 번 나오지 않는가.**
//
// ── 왜 (실측 2026-08-30) ─────────────────────────────────────────────
// 루트 `layout.tsx` 는 제목 템플릿을 갖고 있다:
//
//     title: { default: "Vocaflow — 영어 스크립트 기반 종합 학습", template: "%s | Vocaflow" }
//
// 템플릿이 브랜드를 붙여 주는데 페이지도 `· Vocaflow` 를 적고 있었다. 그래서 탭·히스토리·
// 검색결과에 **"Flashcard 학습 · Vocaflow | Vocaflow"** 로 두 번 나왔다 — 25개 화면에서.
// 다수(111곳 중 대부분)는 이미 템플릿에 맡기고 있었으니 **소수가 규칙을 어긴 쪽**이었다.
//
// 눈에 보이는 결함인데 아무도 못 본 이유는 간단하다: 이 값을 재는 자리가 없었다.
// `28-screen-identity` 는 **겹치는지**만 보므로, 전부 똑같이 두 번 붙으면 그대로 통과한다.
//
// ⚠️ 브랜드를 걷어내면 **가려져 있던 이름 충돌이 드러난다** — `/text/[id]/comic` 과
//    `/comics/adapted` 가 둘 다 '만화' 였다(접미가 다르다는 이유로 갈라져 있었다).
//    그래서 이 파일은 중복도 함께 잠근다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const APP = path.resolve(__dirname, '..')

/**
 * ⚠️ `admin/` 은 아직 제외한다 — **면제가 아니라 미처리다.**
 *
 * 관리자 13화면이 `'… — Vocaflow Admin'` 을 달고 있어 템플릿과 합쳐 브랜드가 두 번 나온다.
 * 제대로 고치려면 `admin/layout.tsx` 에 자체 템플릿(`"%s | Vocaflow Admin"`)을 세우고
 * 13개 페이지에서 접미를 걷어내야 하는데, 이번 변경에 얹으면 한 커밋이 40파일을 넘는다
 * (CLAUDE.md 자동화 정책의 "≥30 파일" 선). 그래서 **숫자를 적어 두고** 별건으로 남긴다.
 * 여기 숫자가 줄지 않은 채 오래 남으면 그건 면제 목록이 자란 것이다.
 */
const SKIP_DIRS = new Set(['__tests__', 'node_modules', 'admin'])

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) pageFiles(p, out)
    else if (name === 'page.tsx' || name === 'layout.tsx') out.push(p)
  }
  return out
}

const rel = (f: string) => path.relative(APP, f).split(path.sep).join('/')

/**
 * `export const metadata = { title: '…' }` 의 제목만 본다.
 *
 * `generateMetadata` 안의 제목은 제외한다 — 그쪽은 콘텐츠 이름을 실어 만들고
 * (`복원 만화` 113호가 각자 다른 제목을 갖는 이유), 못 찾았을 때의 **폴백**이 섞여 있어
 * 정적 제목과 같은 자로 재면 없는 중복을 만든다.
 */
function staticTitles(): Array<{ file: string; title: string }> {
  const out: Array<{ file: string; title: string }> = []
  for (const f of pageFiles(APP)) {
    const src = fs.readFileSync(f, 'utf8')
    const m = src.match(/export const metadata[^=]*=\s*\{[\s\S]{0,400}?title:\s*(['"])([^'"]+)\1/)
    if (m) out.push({ file: rel(f), title: m[2] })
  }
  return out
}

describe('페이지 제목', () => {
  it('스캔이 비어 있으면 이 테스트는 아무것도 지키지 않는다', () => {
    expect(staticTitles().length).toBeGreaterThan(40)
  })

  it('브랜드를 손으로 붙이지 않는다 — 루트 template 이 이미 붙인다', () => {
    const offenders = staticTitles()
      .filter((t) => /Vocaflow/.test(t.title))
      .map((t) => `${t.file}: "${t.title}"`)
    expect(
      offenders,
      `제목에 브랜드가 이미 들어 있다(탭에 두 번 나온다):\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('정적 제목이 서로 겹치지 않는다', () => {
    const seen = new Map<string, string[]>()
    for (const { file, title } of staticTitles()) {
      if (!seen.has(title)) seen.set(title, [])
      seen.get(title)!.push(file)
    }
    const dupes = [...seen.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([title, files]) => `"${title}" ← ${files.join(' , ')}`)
    expect(dupes, `겹치는 제목:\n${dupes.join('\n')}`).toEqual([])
  })
})
