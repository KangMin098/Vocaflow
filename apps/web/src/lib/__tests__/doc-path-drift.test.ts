// apps/web/src/lib/__tests__/doc-path-drift.test.ts
//
// **현재 상태를 말하는 문서가 없는 파일을 가리키지 않는가.**
//
// ── 왜 (PLATFORM_AUDIT §8 의 상시 결함 F7) ───────────────────────────
// "문서–현실 드리프트" 는 이 저장소에 이름까지 붙어 있는 상시 결함이다. 그런데 그것을
// **재는 자리가 없어서** 매 분기 사람이 눈으로 찾고 있었다. 이번 루프에서만 두 번 걸렸다:
//
//   · `lib/text-viewer/handoff.ts` — `apps/web/CLAUDE.md` 가 인계 경로로 안내하는데
//     **쓰는 쪽이 0개**였다(2026-08-30 삭제)
//   · `components/dev/StubPage.tsx` — "미구현 화면 = StubPage" 라고 적혀 있는데 쓰는 곳 0
//
// 없는 파일을 가리키는 문서는 **"구현돼 있다" 는 말과 같다.** 그리고 그 말을 믿고
// 코드를 정하면 멀쩡한 기능을 "고장" 으로 오해한다(CLAUDE.md 가 `to_regclass` 로
// 확인하라고 적어 둔 것과 같은 사고다).
//
// ── 무엇을 세고 무엇을 안 세는가 ─────────────────────────────────────
// 세는 것: **현재 상태 문서**(CLAUDE.md · docs/*.md)의 **뿌리 있는 경로**
//          (`app/` `components/` `lib/` `scripts/` `supabase/` … 로 시작)
// 안 세는 것:
//   · 과거 기록 — CHANGELOG · SESSION_LOG · reports · 진단 · 제안 · ADR.
//     **지워진 파일을 언급하는 것이 맞다.** 그게 기록의 일이다
//   · `*_SPEC` — 아직 만들지 않은 것을 적는 문서(`MOBILE_SHELL_SPEC` 은 `apps/mobile` 에
//     `src/` 가 생기기 전을 쓴다)
//   · 산문 속 파일명(`page.tsx` 처럼 `/` 가 없는 것)과 짧은 조각(`echo/page.tsx`) —
//     가리키는 포인터가 아니라 이름이다. 세면 노이즈가 3,000건이 된다(첫 판 실측)
//   · **"지웠다" 고 설명하는 문장** — 그 문장이 곧 최신 상태다

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..')

/** 과거를 적는 문서 · 아직 없는 것을 적는 문서는 대조하지 않는다. */
const NOT_CURRENT =
  /CHANGELOG|SESSION_LOG|HANDOFF|AUDIT|_LOG|REDESIGN|PROPOSAL|BLUEPRINT|MODEL\.md|KNOWLEDGE_MANIFEST|_SPEC/i

/** 경로를 찾아볼 뿌리들. 문서는 저장소 루트 기준으로도, 패키지 기준으로도 적는다. */
const BASES = [
  '',
  'apps/web',
  'apps/web/src',
  'apps/web/src/app',
  'apps/web/src/components',
  'apps/web/src/lib',
  'apps/mobile',
  'apps/mobile/src',
  'packages',
  'scripts',
  'supabase',
]

/** 이 접두로 시작하는 것만 "가리키는 경로" 로 본다 — 나머지는 산문 속 이름이다. */
const ROOTED = /^(app|apps|components|lib|hooks|scripts|supabase|packages|tests|src|docs)\//

/**
 * 이 낱말이 주변에 있으면 "없어졌다" 를 설명하는 문장이다.
 *
 * ⚠️ 활용형을 빠뜨리면 규칙이 조용히 좁아진다 (실측 2026-09-06):
 *    `지웠` 만 있어서 **「지운 파일: …」** 이라는 목록을 못 걸렀고,
 *    `ADMIN_CONSOLE.md` 가 성실히 남긴 삭제 기록 3건이 드리프트로 잡혔다.
 *    문서는 맞았고 **규칙이 틀렸다** — 그 경우엔 문서가 아니라 여기를 고친다.
 */
const REMOVED =
  /삭제|제거|지웠|지운|없앴|폐기|사라졌|더 이상|없다|옛|이전에는|한때|낡은|retire/

const CANDIDATE =
  /`([A-Za-z0-9_@./()[\]-]+\.(?:tsx?|mjs|sql|json|css))`|\]\(([^)]+\.(?:tsx?|mjs|sql|json|md|css))\)/g

function currentDocs(): string[] {
  const docsDir = join(ROOT, 'docs')
  const list = [
    'CLAUDE.md',
    'apps/web/CLAUDE.md',
    'apps/mobile/CLAUDE.md',
    'packages/design-tokens/CLAUDE.md',
    ...(existsSync(docsDir)
      ? readdirSync(docsDir)
          .filter((n) => n.endsWith('.md'))
          .map((n) => `docs/${n}`)
      : []),
  ]
  return list.filter((p) => existsSync(join(ROOT, p)) && !NOT_CURRENT.test(basename(p)))
}

interface Miss {
  path: string
  where: string
}

function missingPaths(): Miss[] {
  const out: Miss[] = []
  for (const doc of currentDocs()) {
    const abs = join(ROOT, doc)
    const dir = dirname(abs)
    const lines = readFileSync(abs, 'utf8').split('\n')
    lines.forEach((line, i) => {
      for (const m of line.matchAll(CANDIDATE)) {
        const raw = (m[1] ?? m[2] ?? '').trim()
        if (!raw || /^https?:/.test(raw) || raw.startsWith('#') || !raw.includes('/')) continue
        const norm = raw.replace(/^\//, '')
        if (!ROOTED.test(norm)) continue
        const bare = norm.replace(/\.(tsx?|mjs)$/, '')
        const tries = [
          resolve(dir, norm),
          ...BASES.map((b) => resolve(ROOT, b, norm)),
          // 배럴을 `lib/game/brief.ts` 처럼 적는 문서가 있다 — 실제는 `brief/index.ts`
          ...BASES.flatMap((b) =>
            ['/index.ts', '/index.tsx'].map((x) => resolve(ROOT, b, bare + x)),
          ),
        ]
        if (tries.some((t) => existsSync(t))) continue
        const ctx = [lines[i - 2], lines[i - 1], line, lines[i + 1], lines[i + 2]]
          .filter(Boolean)
          .join(' ')
        if (REMOVED.test(ctx)) continue
        out.push({ path: raw, where: `${doc}:${i + 1}` })
      }
    })
  }
  return out
}

describe('문서가 가리키는 경로', () => {
  it('스캔이 비어 있으면 이 테스트는 아무것도 지키지 않는다', () => {
    expect(currentDocs().length).toBeGreaterThan(10)
  })

  it('현재 상태 문서가 없는 파일을 가리키지 않는다', () => {
    const misses = missingPaths().map((m) => `${m.path}  ← ${m.where}`)
    expect(
      misses,
      '문서가 가리키는 파일이 없다(읽는 사람에게는 "구현돼 있다" 로 읽힌다):\n' +
        misses.join('\n'),
    ).toEqual([])
  })
})
