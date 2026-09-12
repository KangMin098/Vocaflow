// apps/web/src/lib/game/__tests__/brief.test.ts
//
// 브리핑 무결성 — "설명이 조용히 거짓이 되는" 경로를 전부 막는다.
//
// 이 데이터의 실패는 눈에 띄지 않는다. 트라이얼의 `want` 에 오타가 나면 예외가 아니라
// **영원히 통과할 수 없는 튜토리얼**이 되고, figure 의 focus 에 오타가 나면 강조가
// 그냥 사라진다. 둘 다 화면은 멀쩡해 보이므로 사람 눈으로는 잡히지 않는다.
// 그래서 참조 무결성을 테스트로 못 박는다.
//
// v08.4 — 스키마가 넓어졌다(게이지 배열·핍 / 결정 카드 / 좌표 격자 / 비용 타일 /
// 타이핑 스텝 / 스텝별 표면 교체). 넓어진 만큼 조용히 깨질 자리도 늘었으므로
// 새 프리미티브마다 불변식을 같이 넣는다 — 특히 **누를 수 있는 것**이 토큰만이 아니게 되어
// (결정 카드가 생겼다) want 검증의 기준을 `pressablesOf` 단일 출처로 옮겼다.

import { describe, expect, it } from 'vitest'

import { GAME_BRIEFS, gaugesOf, hasBrief, pressablesOf, slotStepOf, trialLength } from '../brief'
import { GAME_CATALOG, GAME_COUNT } from '../catalog'

const BRIEFS = Object.values(GAME_BRIEFS)

describe('브리핑 ↔ 카탈로그 정합', () => {
  it('모든 게임에 브리핑이 있다 (카드의 ? 버튼이 조용히 사라지지 않게)', () => {
    const missing = GAME_CATALOG.filter((g) => !hasBrief(g.slug)).map((g) => g.slug)
    expect(missing, `브리핑 누락: ${missing.join(', ')}`).toEqual([])
  })

  it('브리핑에 카탈로그에 없는 게임이 없다 (죽은 데이터 방지)', () => {
    const known = new Set<string>(GAME_CATALOG.map((g) => g.slug))
    const dangling = Object.keys(GAME_BRIEFS).filter((s) => !known.has(s))
    expect(dangling, `카탈로그 없는 브리핑: ${dangling.join(', ')}`).toEqual([])
  })

  it('브리핑 수가 게임 수와 같다', () => {
    expect(Object.keys(GAME_BRIEFS)).toHaveLength(GAME_COUNT)
  })

  it('slug 필드가 키와 일치한다 (복붙 사고 차단)', () => {
    for (const [key, b] of Object.entries(GAME_BRIEFS)) {
      expect(b.slug, `${key}.slug`).toBe(key)
    }
  })
})

describe('보드 데이터 무결성', () => {
  it('누를 수 있는 것의 id 가 보드 안에서 유일하다 (토큰 + 결정 카드 공통 공간)', () => {
    for (const b of BRIEFS) {
      const ids = pressablesOf(b.board).map((p) => p.id)
      expect(new Set(ids).size, `${b.slug} 중복 id: ${ids.join(', ')}`).toBe(ids.length)
    }
  })

  it('정답 계열이 최소 1개 있다 (누를 것도 칠 것도 없는 보드 방지)', () => {
    for (const b of BRIEFS) {
      const typing = b.trial.steps.some((s) => s.type)
      const hasOk = pressablesOf(b.board).some((p) => p.ok)
      expect(hasOk || typing, `${b.slug}: ok 도 타이핑 스텝도 없음`).toBe(true)
    }
  })

  it('트라이얼 보드가 390px 한 화면에 담긴다 (지시문을 보면서 누를 수 있어야 한다)', () => {
    // 이 상한은 추측이 아니라 **실측**이다. 390×844 에서 19종의 트라이얼 보드 높이를 재 보니
    // (지시문 `.bf-say` 위 → 보드 바닥) connections 887px · lexicon-detective 704px 만
    // 뷰포트를 넘었고, 나머지는 399~673px 였다. 넘으면 마지막 줄을 누를 때 지시문이 화면
    // 밖으로 나가 "무엇을 하라고 했는지" 를 잃는다.
    //
    // 평면 개수 상한은 격자형 보드에 부당하다 — connections 는 실제로 16칸을 보장하는
    // 게임이라 8칸으로 줄이면 축약이 아니라 다른 게임이 된다. 그래서 개수가 아니라
    // **390px 에서 2열로 접혔을 때의 행 수**로 잰다(렌더러가 560px 이하에서 2열로 접는다).
    // 측정에서 5행(cascade 9타일)은 673px 로 통과했고 6행(connections 11타일)은 887px 로
    // 실패했다 → 한계는 5행 = 동시에 보이는 타일 10개.
    const visual = (s: string) => [...s].reduce((n, ch) => n + (/[가-힣一-鿿]/.test(ch) ? 2 : 1), 0)
    for (const b of BRIEFS) {
      // 타이핑 보드는 트레이가 없다 — 후보 0개가 정상이고, 그게 그 게임의 정체다.
      if (b.board.kind === 'type') continue

      expect(b.board.tokens.length, `${b.slug} 타일 부족`).toBeGreaterThanOrEqual(2)

      // `from` 으로 나중에 열리는 타일은 그 스텝 전까지 자리를 차지하지 않는다.
      // 실제로 가장 붐비는 스텝의 동시 노출 수를 재야 한다.
      const steps = b.trial.steps.length
      for (let s = 0; s < steps; s++) {
        const shown = b.board.tokens.filter((t) => (t.from ?? 0) <= s).length
        const rows = Math.ceil(shown / 2)
        expect(rows, `${b.slug} step${s}: 390px 2열에서 ${rows}행 (타일 ${shown}개) — 지시문이 화면 밖으로 밀린다`).toBeLessThanOrEqual(5)
      }

      // 한 칸이 감당할 폭 — 넘으면 줄바꿈으로 물러나며 행이 더 늘어난다
      const widest = Math.max(...b.board.tokens.map((t) => visual(t.text)))
      expect(
        widest,
        `${b.slug}: 타일 '${b.board.tokens.find((t) => visual(t.text) === widest)?.text}' 이 한 칸을 넘는다`,
      ).toBeLessThanOrEqual(18)
    }
  })

  it('조립·타이핑 보드는 슬롯을 갖고, 슬롯이 그 스텝의 정답 길이와 같다', () => {
    for (const b of BRIEFS) {
      if (b.board.kind !== 'assemble' && b.board.kind !== 'type') continue
      expect(b.board.slots, `${b.slug}.slots 없음`).toBeGreaterThan(0)
      const step = slotStepOf(b)
      const len = step?.type ? step.type.answer.replace(/\s+/g, '').length : (step?.want.length ?? 0)
      expect(b.board.slots, `${b.slug}: 슬롯 ${b.board.slots} vs 정답 ${len}`).toBe(len)
    }
  })

  it('judge 보드는 서류를 갖는다 (판정할 근거가 화면에 있어야 한다)', () => {
    for (const b of BRIEFS) {
      if (b.board.kind !== 'judge') continue
      const docs = [b.board.doc, ...b.figures.map((f) => f.doc), ...b.trial.steps.map((s) => s.doc)]
      expect(docs.some((d) => (d?.length ?? 0) > 0), `${b.slug}.doc 없음`).toBe(true)
    }
  })

  it('게이지 라벨이 있고 값이 범위 안이다 (핍은 left ≤ total)', () => {
    for (const b of BRIEFS) {
      const gauges = gaugesOf(b.board)
      for (const g of gauges) {
        expect(g.label.trim().length, `${b.slug} 게이지 라벨 없음`).toBeGreaterThan(0)
        if (g.pct != null) {
          expect(g.pct, `${b.slug}.hud.pct`).toBeGreaterThanOrEqual(0)
          expect(g.pct, `${b.slug}.hud.pct`).toBeLessThanOrEqual(1)
        }
        if (g.pips) {
          expect(g.pips.total, `${b.slug} pips.total`).toBeGreaterThan(0)
          expect(g.pips.left, `${b.slug} pips.left`).toBeGreaterThanOrEqual(0)
          expect(g.pips.left, `${b.slug} pips.left > total`).toBeLessThanOrEqual(g.pips.total)
        }
        // 막대도 핍도 아니면 그릴 것이 없다 — 라벨만 남은 유령 게이지가 된다
        expect(g.pct != null || g.pips != null || g.value != null, `${b.slug} 게이지 ${g.label} 이 빈 껍데기`).toBe(true)
      }
      // 게이지 상태 override 는 실재하는 게이지만 가리켜야 한다
      for (const s of [...b.figures, ...b.trial.steps]) {
        expect((s.hud?.length ?? 0), `${b.slug} hud override 가 게이지 수를 넘음`).toBeLessThanOrEqual(gauges.length)
      }
      for (const f of b.figures) {
        if (f.hudPct == null) continue
        expect(gauges.length, `${b.slug}: hudPct 인데 게이지가 없다`).toBeGreaterThan(0)
        expect(f.hudPct, `${b.slug} figure.hudPct`).toBeGreaterThanOrEqual(0)
        expect(f.hudPct, `${b.slug} figure.hudPct`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('결정 카드는 손익 줄을 갖는다 (한 줄만이면 비교가 성립하지 않는다)', () => {
    for (const b of BRIEFS) {
      const choices = b.board.choices ?? []
      if (choices.length === 0) continue
      expect(choices.length, `${b.slug}: 결정이 1개면 결정이 아니다`).toBeGreaterThanOrEqual(2)
      for (const c of choices) {
        expect(c.label.trim().length, `${b.slug} 결정 라벨 없음`).toBeGreaterThan(0)
        expect(c.lines.length, `${b.slug} 결정 ${c.label} 손익 줄 없음`).toBeGreaterThan(0)
        for (const l of c.lines) expect(l.trim().length, `${b.slug} 빈 손익 줄`).toBeGreaterThan(0)
      }
    }
  })

  it('비용 타일의 게이지 참조가 실재한다 (없는 게이지를 깎으면 아무 일도 안 일어난다)', () => {
    for (const b of BRIEFS) {
      const n = gaugesOf(b.board).length
      for (const t of b.board.tokens) {
        if (!t.effect) continue
        expect(t.effect.gauge ?? 0, `${b.slug} ${t.id}.effect.gauge`).toBeLessThan(Math.max(1, n))
        expect(n, `${b.slug} ${t.id} 는 비용 타일인데 게이지가 없다`).toBeGreaterThan(0)
      }
    }
  })

  it('좌표 격자에 두 토큰이 같은 칸에 겹치지 않는다', () => {
    for (const b of BRIEFS) {
      const placed = b.board.tokens.filter((t) => t.at)
      if (placed.length === 0) continue
      const cells = placed.map((t) => `${t.at![0]},${t.at![1]}`)
      expect(new Set(cells).size, `${b.slug} 좌표 충돌: ${cells.join(' / ')}`).toBe(cells.length)
      for (const t of placed) {
        expect(t.at![0], `${b.slug} ${t.id} 행 음수`).toBeGreaterThanOrEqual(0)
        expect(t.at![1], `${b.slug} ${t.id} 열 음수`).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('절차 프레임', () => {
  it('모든 게임이 프레임 3장을 갖는다 (초기 · 성공 · 실패)', () => {
    for (const b of BRIEFS) {
      expect(b.figures, `${b.slug} 프레임 ${b.figures.length}장`).toHaveLength(3)
    }
  })

  it('focus 가 실재하는 것만 가리킨다 (오타는 강조를 조용히 없앤다)', () => {
    for (const b of BRIEFS) {
      const ids = new Set(pressablesOf(b.board).map((p) => p.id))
      for (const f of b.figures) {
        for (const id of f.focus ?? []) {
          expect(ids.has(id), `${b.slug} figure focus 미상: ${id}`).toBe(true)
        }
      }
    }
  })

  it('슬롯 프레임의 filled 가 슬롯 수를 넘지 않는다', () => {
    for (const b of BRIEFS) {
      if (b.board.slots == null) continue
      for (const f of b.figures) {
        expect(f.filled ?? 0, `${b.slug} filled`).toBeLessThanOrEqual(b.board.slots)
      }
    }
  })

  it('캡션이 비어 있지 않다', () => {
    for (const b of BRIEFS) {
      for (const f of b.figures) expect(f.caption.trim().length, `${b.slug}`).toBeGreaterThan(0)
    }
  })

  it('프레임·스텝의 프롬프트 교체가 빈 값이 아니다', () => {
    for (const b of BRIEFS) {
      for (const s of [...b.figures, ...b.trial.steps]) {
        if (!s.prompt) continue
        const keys = Object.keys(s.prompt)
        expect(keys.length, `${b.slug}: 빈 프롬프트 override`).toBeGreaterThan(0)
        if (s.prompt.value != null) expect(s.prompt.value.trim().length).toBeGreaterThan(0)
        // 원본 보드에 프롬프트가 없으면 override 만으로는 label·value 둘 다 있어야 그려진다
        if (!b.board.prompt) {
          expect(s.prompt.label && s.prompt.value, `${b.slug}: 보드에 프롬프트가 없는데 override 가 불완전`).toBeTruthy()
        }
      }
    }
  })
})

describe('트라이얼 — 통과 가능성', () => {
  it('스텝이 최소 1개 있다', () => {
    for (const b of BRIEFS) {
      expect(trialLength(b.slug), `${b.slug} 스텝 0개`).toBeGreaterThan(0)
    }
  })

  it('want 가 실재하는 것만 가리킨다 — 오타 하나면 영원히 못 깨는 튜토리얼이 된다', () => {
    for (const b of BRIEFS) {
      const ids = new Set(pressablesOf(b.board).map((p) => p.id))
      for (const s of b.trial.steps) {
        for (const id of s.want) {
          expect(ids.has(id), `${b.slug} want 미상: ${id}`).toBe(true)
        }
      }
    }
  })

  it('want 가 그 스텝에 실제로 보인다 (from 이 미래면 누를 수가 없다)', () => {
    for (const b of BRIEFS) {
      const from = new Map(pressablesOf(b.board).map((p) => [p.id, p.from]))
      b.trial.steps.forEach((s, i) => {
        for (const id of s.want) {
          expect(from.get(id) ?? 0, `${b.slug} step${i} 의 ${id} 는 아직 숨어 있다`).toBeLessThanOrEqual(i)
        }
      })
    }
  })

  it('want 안에 중복이 없다 (같은 타일을 두 번 요구하면 판정이 멈춘다)', () => {
    for (const b of BRIEFS) {
      for (const s of b.trial.steps) {
        expect(new Set(s.want).size, `${b.slug} want 중복: ${s.want.join(', ')}`).toBe(s.want.length)
      }
    }
  })

  it('스텝 사이에 want 가 겹치지 않는다 (앞 스텝에서 이미 누른 타일은 다시 못 누른다)', () => {
    for (const b of BRIEFS) {
      const seen = new Set<string>()
      for (const s of b.trial.steps) {
        for (const id of s.want) {
          expect(seen.has(id), `${b.slug}: ${id} 가 여러 스텝에서 요구됨`).toBe(false)
          seen.add(id)
        }
      }
    }
  })

  it('타이핑 스텝은 정답 문자열을 갖고 누를 것을 요구하지 않는다', () => {
    for (const b of BRIEFS) {
      for (const s of b.trial.steps) {
        if (!s.type) continue
        expect(s.type.answer.trim().length, `${b.slug} 타이핑 정답 없음`).toBeGreaterThan(0)
        expect(s.want, `${b.slug}: 타이핑 스텝인데 누를 것을 요구한다`).toEqual([])
      }
    }
  })

  it('누를 것도 칠 것도 없는 스텝이 없다 (진행이 막힌다)', () => {
    for (const b of BRIEFS) {
      b.trial.steps.forEach((s, i) => {
        expect(s.want.length > 0 || Boolean(s.type), `${b.slug} step${i}: 할 일이 없다`).toBe(true)
      })
    }
  })

  it('정답으로 표시된 것과 트라이얼 정답이 어긋나지 않는다', () => {
    for (const b of BRIEFS) {
      // 진행용 토큰(선택지 열기 등)은 ok 가 아니어도 want 에 들어갈 수 있다.
      // 반대로 ok 인데 아무 스텝도 요구하지 않는 것은 데이터 실수다.
      const wanted = new Set(b.trial.steps.flatMap((s) => s.want))
      const orphan = pressablesOf(b.board)
        .filter((p) => p.ok && !wanted.has(p.id))
        .map((p) => p.id)
      expect(orphan, `${b.slug}: ok 인데 트라이얼이 요구하지 않음 — ${orphan.join(', ')}`).toEqual([])
    }
  })

  it('비용 타일은 want 에 들어가지 않는다 (지출을 정답으로 가르치면 안 된다)', () => {
    for (const b of BRIEFS) {
      const wanted = new Set(b.trial.steps.flatMap((s) => s.want))
      for (const t of b.board.tokens) {
        if (!t.effect) continue
        expect(wanted.has(t.id), `${b.slug}: 비용 타일 ${t.id} 이 want 에 있다`).toBe(false)
      }
    }
  })

  it('지시문 · 완료 문구가 비어 있지 않다', () => {
    for (const b of BRIEFS) {
      expect(b.trial.done.trim().length, `${b.slug}.trial.done`).toBeGreaterThan(0)
      for (const s of b.trial.steps) expect(s.say.trim().length, `${b.slug} say`).toBeGreaterThan(0)
    }
  })
})

// ── 최적합 계약 ──────────────────────────────────────────────────────
//
// v08.4 자기발전의 결론을 못 박는다. 여기 없는 규칙은 다음 사람이 "뜻 고르기 1스텝"으로
// 조용히 되돌려도 아무것도 막지 못한다 — 실제로 그렇게 19종이 서로 같아졌다
// (전수 평가 decisive 1.11/4 · trial 을 바꿔 끼워도 통과).
describe('최적합 — 그 게임에만 맞아야 한다', () => {
  it('trial 이 고유 결정을 가르친다 (뜻 고르기 1스텝 금지)', () => {
    for (const b of BRIEFS) {
      const steps = b.trial.steps
      // 2스텝 이상이거나, 1스텝이라도 타이핑(진짜 인출)이면 그 게임만의 손동작이 있다.
      const teaches = steps.length >= 2 || steps.some((s) => s.type)
      expect(teaches, `${b.slug}: 1스텝 재인만 시킨다 — 19종 공통 동작이라 이 게임을 구별하지 못한다`).toBe(true)
    }
  })

  it('게임마다 판돈이 화면에 보인다 (게이지 · 결정 · 슬롯 중 하나 이상)', () => {
    for (const b of BRIEFS) {
      const shown = gaugesOf(b.board).length + (b.board.choices?.length ?? 0) + (b.board.slots ? 1 : 0)
      expect(shown, `${b.slug}: 무엇이 걸려 있는지 그림에 없다`).toBeGreaterThan(0)
    }
  })

  it('두 게임의 트라이얼이 서로 바꿔 끼울 수 있으면 안 된다 (계열 내 구별)', () => {
    // "바꿔 끼울 수 있다" = 학습자가 겪는 것이 같다. 아키타입·스텝 수·프리미티브만으로는
    // 부족했다 — daily-blitz(선택지를 보기 **전에** 판돈)와 word-economy(체결에 성공한
    // **뒤에만** 열리는 매입)가 같은 서명으로 잡혔다. 결정이 정답 앞이냐 뒤냐는 순서 자체가
    // 다른 경험이므로 서명에 넣는다. 게이지도 개수가 아니라 종류(막대/핍/숫자)로 센다.
    const sig = (b: (typeof BRIEFS)[number]) => {
      const minFrom = (xs: { from?: number }[]) =>
        xs.length ? Math.min(...xs.map((x) => x.from ?? 0)) : -1
      const decisionAt = minFrom(b.board.choices ?? [])
      const answerAt = minFrom(b.board.tokens)
      const order = decisionAt < 0 ? 'none' : decisionAt < answerAt ? 'pre' : decisionAt > answerAt ? 'post' : 'same'
      return [
        b.board.kind,
        b.trial.steps.length,
        b.trial.steps.some((s) => s.type) ? 'type' : '',
        order,
        b.board.tokens.some((t) => t.at) ? 'grid' : '',
        b.board.tokens.some((t) => t.effect) ? 'cost' : '',
        gaugesOf(b.board)
          .map((g) => (g.pips ? 'p' : g.pct != null ? 'b' : 'v'))
          .join(''),
        b.board.slots ?? 0,
      ].join('|')
    }

    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const b of BRIEFS) {
      const s = sig(b)
      const prev = seen.get(s)
      if (prev) clashes.push(`${prev} ↔ ${b.slug} (${s})`)
      else seen.set(s, b.slug)
    }
    expect(clashes, `구별되지 않는 쌍:\n  ${clashes.join('\n  ')}`).toEqual([])
  })

  it('objective 가 게임 고유의 판돈을 말한다 (19종 공통 문장 금지)', () => {
    // "뜻에 맞는 단어를 고른다" 로만 끝나는 objective 는 어느 게임에 붙여도 맞는다.
    const GENERIC = /^[^.]*뜻[^.]*단어[^.]*(고르|찾|짚)[^.]*$/
    for (const b of BRIEFS) {
      const first = b.objective.split(/(?<=[.。])\s*/)[0] ?? b.objective
      const onlyGeneric = GENERIC.test(b.objective.trim()) && b.objective.trim().length < 80
      expect(onlyGeneric, `${b.slug}: objective 가 19종 공통 서술이다 — "${first}"`).toBe(false)
    }
  })
})

describe('노트 · 목표', () => {
  it('objective 와 facts 3종이 모두 채워져 있다', () => {
    for (const b of BRIEFS) {
      expect(b.objective.trim().length, `${b.slug}.objective`).toBeGreaterThan(20)
      expect(b.facts.input.trim().length, `${b.slug}.facts.input`).toBeGreaterThan(0)
      expect(b.facts.run.trim().length, `${b.slug}.facts.run`).toBeGreaterThan(0)
      expect(b.facts.record.trim().length, `${b.slug}.facts.record`).toBeGreaterThan(0)
    }
  })
})
