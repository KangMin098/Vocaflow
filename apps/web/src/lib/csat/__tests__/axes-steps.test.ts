// apps/web/src/lib/csat/__tests__/axes-steps.test.ts
//
// **두 축이 합쳐지는 것과, 단계가 조용히 끊기는 것을 막는다.**
//
// 이 두 모델은 화면 다섯이 함께 읽는다. 틀리면 화면마다 다른 색·다른 순서를 말하는데,
// 그건 스타일 문제로 보여서 아무도 버그로 신고하지 않는다. 그래서 여기서 잠근다.

import { describe, expect, it } from 'vitest'

import { AXIS, DENSITY_STEPS, densityBg, densityFg, densityStep } from '../axes'
import { CSAT_STEPS, readySteps, stepFor } from '../steps'

describe('두 축은 절대 합치지 않는다', () => {
  it('형식과 소재는 다른 색·다른 기호를 쓴다', () => {
    expect(AXIS.format.fg).not.toBe(AXIS.topic.fg)
    expect(AXIS.format.mark).not.toBe(AXIS.topic.mark)
  })

  it('모든 역할의 기호가 서로 다르다 — 색약 사용자는 기호로 읽는다', () => {
    const marks = Object.values(AXIS).map((a) => a.mark)
    expect(new Set(marks).size).toBe(marks.length)
  })

  it('색은 전부 토큰 참조다 — 하드코딩 hex 금지', () => {
    for (const [k, v] of Object.entries(AXIS)) {
      expect(v.fg, `${k}.fg`).toMatch(/^var\(--/)
      expect(v.bg, `${k}.bg`).toMatch(/^var\(--/)
    }
  })

  it('3점 표시에 error 색을 쓰지 않는다 — 어려움은 실패가 아니다', () => {
    expect(AXIS.hard.fg).not.toContain('error')
    expect(AXIS.hard.bg).not.toContain('error')
  })

  it('모든 역할이 라벨과 설명을 갖는다', () => {
    for (const [k, v] of Object.entries(AXIS)) {
      expect(v.label.length, k).toBeGreaterThan(0)
      expect(v.says.length, k).toBeGreaterThan(0)
    }
  })
})

describe('히트맵 농도', () => {
  it('0 은 0 단계 — 안 나온 칸은 빈 칸이다', () => {
    expect(densityStep(0, 9)).toBe(0)
    expect(densityBg(0)).toBe('transparent')
  })

  it('1 번이라도 나오면 0 단계가 아니다 — 「없음」과 구별된다', () => {
    expect(densityStep(1, 9)).toBeGreaterThan(0)
  })

  it('최댓값은 맨 윗 단계다', () => {
    expect(densityStep(9, 9)).toBe(DENSITY_STEPS - 1)
  })

  it('단조 증가한다 — 더 많이 나온 칸이 더 옅어지지 않는다', () => {
    let prev = -1
    for (let n = 0; n <= 9; n += 1) {
      const s = densityStep(n, 9)
      expect(s, `n=${n}`).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })

  it('max 가 1 이면 나온 칸은 맨 윗 단계 — 0 으로 나누지 않는다', () => {
    expect(densityStep(1, 1)).toBe(DENSITY_STEPS - 1)
    expect(() => densityStep(1, 0)).not.toThrow()
  })

  it('진한 칸 위 글자는 배경색으로 뒤집힌다', () => {
    expect(densityFg(0)).toBe('var(--t1)')
    expect(densityFg(DENSITY_STEPS - 1)).toBe('var(--bg)')
  })

  it('농도도 토큰으로 만든다 — 새 색을 만들지 않는다', () => {
    expect(densityBg(3)).toContain('var(--p)')
  })
})

describe('단계 — 있는 문을 없다고 말하지 않는다', () => {
  it('번호가 1부터 빠짐없이 이어진다', () => {
    expect(CSAT_STEPS.map((s) => s.no)).toEqual(CSAT_STEPS.map((_, i) => i + 1))
  })

  it('모든 단계에 학습자의 동사가 있다 — 없으면 그 화면은 문서다', () => {
    for (const s of CSAT_STEPS) {
      expect(s.verb.length, `${s.no} ${s.label}`).toBeGreaterThan(0)
      expect(s.says.length, `${s.no} ${s.label}`).toBeGreaterThan(0)
    }
  })

  it('안 지은 단계만 링크가 없다', () => {
    for (const s of CSAT_STEPS) {
      if (s.state === 'later') expect(s.href, `${s.no}`).toBeNull()
      else expect(s.href, `${s.no}`).toBeTruthy()
    }
  })

  /**
   * ⚠️ **이 검사가 실제 결함을 잡으라고 있다.** 첫 판 레일은 브리프의 7단계를 실제 화면을
   *   안 보고 옮겨서, `/csat/drill` 이 있는데도 「훈련 — 아직 열리지 않음」이라 적었고
   *   `/csat/plan` 은 통째로 빠뜨렸다(실측 2026-09-16). 레일은 「어디로 갈까」에 답하는
   *   줄인데 **있는 문을 없다고 말한 것**이다.
   *   그래서 이름을 맞춰 보는 대신 **파일 시스템에 그 라우트가 있는지** 본다.
   */
  it('열린 단계의 href 는 전부 실재하는 라우트다', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(__dirname, '../../../app/(main)')
    for (const s of readySteps()) {
      const dir = path.join(root, s.href!.replace(/^\//, ''))
      const ok = fs.existsSync(path.join(dir, 'page.tsx'))
      expect(ok, `${s.no} ${s.label} → ${s.href} 에 page.tsx 가 없다`).toBe(true)
    }
  })

  /** 반대 방향 — 있는 화면을 레일이 빠뜨리지 않았는가. 드릴다운·도구는 뺀다. */
  it('입구가 될 만한 라우트를 레일이 빠뜨리지 않았다', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(__dirname, '../../../app/(main)/csat')
    /** 레일에 안 넣기로 한 것 — 이유는 `steps.ts` 목록 주석에 적혀 있다. */
    const NOT_A_STEP = new Set(['item', 'overlay'])
    const dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('[') && !d.name.startsWith('_'))
      .map((d) => d.name)
      .filter((n) => !NOT_A_STEP.has(n) && n !== '__tests__')

    const linked = new Set(CSAT_STEPS.map((s) => s.href).filter(Boolean) as string[])
    for (const d of dirs) {
      expect(linked.has(`/csat/${d}`), `/csat/${d} 가 레일에 없다`).toBe(true)
    }
  })
})

describe('현재 위치 판정', () => {
  it('허브는 정확히 일치할 때만 ① 이다 — 두 칸이 동시에 켜지지 않는다', () => {
    expect(stepFor('/csat')?.no).toBe(1)
    expect(stepFor('/csat/map')?.no).toBe(2)
  })

  it('하위 경로도 그 단계로 센다', () => {
    expect(stepFor('/csat/map/2024')?.no).toBe(2)
  })

  it('드릴다운 목적지는 어느 단계도 아니다 — 레일이 켜지지 않는다', () => {
    expect(stepFor('/csat/item/2024-34')).toBeNull()
    expect(stepFor('/csat/overlay')).toBeNull()
  })

  it('모르는 경로는 null', () => {
    expect(stepFor('/dashboard')).toBeNull()
  })
})
