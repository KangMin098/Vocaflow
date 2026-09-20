// apps/web/src/app/__tests__/form-declaration-ratchet.test.ts
//
// **새 화면은 골격을 선언하지 않으면 태어나지 못한다.**
//
// ── 왜 ───────────────────────────────────────────────────────────────
// vocaflow-design §G2 는 "코드 전에 세 줄 — 골격 · 서명 · N4" 를 요구한다. 그런데 그 세 줄이
// 어디에도 남지 않으면 요구는 권고가 되고, 권고는 기본값(카드 목록·표·3열)에 진다.
// 2026-09-18 실측: 형태 씨앗 10개 중 화면의 골격인 것은 3개였다(docs/design/00-form-seeds.md).
// 목표가 "평균은 절대 안 된다" 이므로(사용자 지시) 선언을 **파일에 남기게** 하고 여기서 검사한다.
//
// ── 선언 형식 ─────────────────────────────────────────────────────────
// page.tsx 의 첫 20줄 안에 한 줄:
//     // @form: <G1 축> — <서명: 요소 · 트리거 · ms 등 한 문장>
// G1 축(vocaflow-design §G1): 망각 · 채색 지문 · 주묵 문법 · 환경 변형 · 계보 · 시험지 사물
// 예외 축 하나: `경유` — `redirect(` 만 하는 화면(보여 주는 것이 없다). 파일에 redirect( 가 있어야 한다.
// "카드" "표" "격자" "목록" 은 축이 아니다 — 그것들은 그릇이다(§G2).
//
// ── 라쳇 ──────────────────────────────────────────────────────────────
// 2026-09-18 에 선언이 없던 화면은 `form-declaration.baseline.json` 에 있다. 그 목록은 **줄기만** 한다:
//   · 목록에 없는 화면이 선언 없이 생기면 실패(새 화면)
//   · 목록에 있는데 이제 선언이 있거나 파일이 없으면 실패 — 목록에서 지워 잠근다
// 선언은 N4 의 **약속**이지 증명이 아니다. 증명은 06-workflow 비평 (a) 익명성 · (b) 평균 회귀가 한다.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const WEB = process.cwd()
const APP = join(WEB, 'src', 'app')
const BASELINE_PATH = join(APP, '__tests__', 'form-declaration.baseline.json')

export const G1_AXES = ['망각', '채색 지문', '주묵 문법', '환경 변형', '계보', '시험지 사물'] as const
const PASS_THROUGH = '경유'

const DECL = /^\/\/\s*@form:\s*([^—-]+?)\s*[—-]\s*(\S.{7,})$/m

// `dev/replica/` 는 **화면이 아니라 자다.** 참조 사이트의 판면을 실측값에서 그대로 재현해
// 우리 화면과 나란히 놓고 차이를 재는 내부 도구이고(DD-62 Stage 2), 배포는 layout.tsx 가 막는다.
// 여기에 `@form` 축을 적으면 "우리가 발명한 골격" 이라고 거짓을 적는 것이 된다 — 그래서 규칙에서 뺀다.
// (기준선에 넣지 않는 이유: 기준선은 "선언을 아직 못 붙인 빚" 이고, 이건 빚이 아니라 범위 밖이다.)
const EXEMPT_DIRS = ['dev/replica']

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'api') return []
      if (EXEMPT_DIRS.some((d) => rel(p).endsWith(`src/app/${d}`))) return []
      return pages(p)
    }
    return name === 'page.tsx' ? [p] : []
  })
}

const rel = (p: string) => relative(WEB, p).split(sep).join('/')

function declarationOf(file: string): { axis: string; signature: string } | null {
  const head = readFileSync(file, 'utf8').split(/\r?\n/).slice(0, 20).join('\n')
  const m = head.match(DECL)
  return m ? { axis: m[1].trim(), signature: m[2].trim() } : null
}

describe('화면 골격 선언 라쳇 (@form)', () => {
  const all = pages(APP)
  const baseline = new Set<string>(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as string[])

  it('화면을 찾는다 — 0 개를 세고 통과하는 길을 막는다', () => {
    expect(all.length).toBeGreaterThan(100)
  })

  it('선언이 있으면 축은 G1 여섯 중 하나다(또는 redirect 전용 `경유`)', () => {
    const bad: string[] = []
    for (const f of all) {
      const d = declarationOf(f)
      if (!d) continue
      const ok =
        (G1_AXES as readonly string[]).includes(d.axis) ||
        (d.axis === PASS_THROUGH && readFileSync(f, 'utf8').includes('redirect('))
      if (!ok) bad.push(`${rel(f)} — "${d.axis}"`)
    }
    expect(bad, `G1 축이 아니다(카드·표·격자·목록은 축이 아니다): ${G1_AXES.join(' · ')}`).toEqual([])
  })

  it('새 화면은 선언 없이 생기지 않는다', () => {
    const missing = all.filter((f) => !declarationOf(f) && !baseline.has(rel(f))).map(rel)
    expect(
      missing,
      '첫 20줄에 `// @form: <G1 축> — <서명>` 을 적는다(vocaflow-design §G2). 기준선에 추가해 우회하지 않는다',
    ).toEqual([])
  })

  it('기준선은 줄기만 한다 — 선언이 생겼거나 사라진 화면은 목록에서 지운다', () => {
    const stale = [...baseline].filter((p) => !existsSync(join(WEB, p)) || declarationOf(join(WEB, p)))
    expect(stale, 'form-declaration.baseline.json 에서 이 줄들을 지워 잠근다').toEqual([])
  })
})
