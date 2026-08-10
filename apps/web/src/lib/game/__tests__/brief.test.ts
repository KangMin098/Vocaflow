// apps/web/src/lib/game/__tests__/brief.test.ts
//
// 브리핑 무결성 — "설명이 조용히 거짓이 되는" 경로를 전부 막는다.
//
// 이 데이터의 실패는 눈에 띄지 않는다. 트라이얼의 `want` 에 오타가 나면 예외가 아니라
// **영원히 통과할 수 없는 튜토리얼**이 되고, figure 의 focus 에 오타가 나면 강조가
// 그냥 사라진다. 둘 다 화면은 멀쩡해 보이므로 사람 눈으로는 잡히지 않는다.
// 그래서 참조 무결성을 테스트로 못 박는다.

import { describe, expect, it } from 'vitest'

import { GAME_BRIEFS, hasBrief, trialLength } from '../brief'
import { GAME_CATALOG, GAME_COUNT } from '../catalog'

describe('브리핑 ↔ 카탈로그 정합', () => {
  it('모든 게임에 브리핑이 있다 (카드의 ? 버튼이 조용히 사라지지 않게)', () => {
    const missing = GAME_CATALOG.filter((g) => !hasBrief(g.slug)).map((g) => g.slug)
    expect(missing, `브리핑 누락: ${missing.join(', ')}`).toEqual([])
  })

  it('브리핑에 카탈로그에 없는 게임이 없다 (죽은 데이터 방지)', () => {
    const known = new Set(GAME_CATALOG.map((g) => g.slug))
    const dangling = Object.keys(GAME_BRIEFS).filter((s) => !known.has(s as never))
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
  it('토큰 id 가 보드 안에서 유일하다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      const ids = b.board.tokens.map((t) => t.id)
      expect(new Set(ids).size, `${b.slug} 중복 id: ${ids.join(', ')}`).toBe(ids.length)
    }
  })

  it('정답 토큰이 최소 1개 있다 (누를 것이 없는 보드 방지)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      expect(b.board.tokens.some((t) => t.ok), `${b.slug}: ok 토큰 없음`).toBe(true)
    }
  })

  it('타일 수가 화면에 담기는 범위다 (390px 에서 읽을 수 있어야 한다)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      expect(b.board.tokens.length, `${b.slug} 타일 ${b.board.tokens.length}개`).toBeLessThanOrEqual(8)
      expect(b.board.tokens.length, `${b.slug} 타일 부족`).toBeGreaterThanOrEqual(2)
    }
  })

  it('assemble 보드는 슬롯 수를 갖고, 슬롯이 트라이얼 정답 길이와 같다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      if (b.board.kind !== 'assemble') continue
      expect(b.board.slots, `${b.slug}.slots 없음`).toBeGreaterThan(0)
      const longest = Math.max(...b.trial.steps.map((s) => s.want.length))
      expect(b.board.slots, `${b.slug}: 슬롯 ${b.board.slots} vs 정답 ${longest}`).toBe(longest)
    }
  })

  it('judge 보드는 서류를 갖는다 (판정할 근거가 화면에 있어야 한다)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      if (b.board.kind !== 'judge') continue
      expect(b.board.doc?.length ?? 0, `${b.slug}.doc 없음`).toBeGreaterThan(0)
    }
  })

  it('hud 게이지 비율이 0~1 범위다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      if (b.board.hud) {
        expect(b.board.hud.pct, `${b.slug}.hud.pct`).toBeGreaterThanOrEqual(0)
        expect(b.board.hud.pct, `${b.slug}.hud.pct`).toBeLessThanOrEqual(1)
      }
      for (const f of b.figures) {
        if (f.hudPct == null) continue
        expect(f.hudPct, `${b.slug} figure.hudPct`).toBeGreaterThanOrEqual(0)
        expect(f.hudPct, `${b.slug} figure.hudPct`).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('절차 프레임', () => {
  it('모든 게임이 프레임 3장을 갖는다 (초기 · 성공 · 실패)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      expect(b.figures, `${b.slug} 프레임 ${b.figures.length}장`).toHaveLength(3)
    }
  })

  it('focus 가 실재하는 토큰만 가리킨다 (오타는 강조를 조용히 없앤다)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      const ids = new Set(b.board.tokens.map((t) => t.id))
      for (const f of b.figures) {
        for (const id of f.focus ?? []) {
          expect(ids.has(id), `${b.slug} figure focus 미상 토큰: ${id}`).toBe(true)
        }
      }
    }
  })

  it('assemble 프레임의 filled 가 슬롯 수를 넘지 않는다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      if (b.board.kind !== 'assemble') continue
      for (const f of b.figures) {
        expect(f.filled ?? 0, `${b.slug} filled`).toBeLessThanOrEqual(b.board.slots ?? 0)
      }
    }
  })

  it('캡션이 비어 있지 않다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      for (const f of b.figures) expect(f.caption.trim().length, `${b.slug}`).toBeGreaterThan(0)
    }
  })
})

describe('트라이얼 — 통과 가능성', () => {
  it('스텝이 최소 1개 있다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      expect(trialLength(b.slug), `${b.slug} 스텝 0개`).toBeGreaterThan(0)
    }
  })

  it('want 가 실재하는 토큰만 가리킨다 — 오타 하나면 영원히 못 깨는 튜토리얼이 된다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      const ids = new Set(b.board.tokens.map((t) => t.id))
      for (const s of b.trial.steps) {
        for (const id of s.want) {
          expect(ids.has(id), `${b.slug} want 미상 토큰: ${id}`).toBe(true)
        }
      }
    }
  })

  it('want 토큰이 그 스텝에 실제로 보인다 (from 이 미래면 누를 수가 없다)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      const from = new Map(b.board.tokens.map((t) => [t.id, t.from ?? 0]))
      b.trial.steps.forEach((s, i) => {
        for (const id of s.want) {
          expect(from.get(id) ?? 0, `${b.slug} step${i} 의 ${id} 는 아직 숨어 있다`).toBeLessThanOrEqual(i)
        }
      })
    }
  })

  it('want 안에 중복이 없다 (같은 타일을 두 번 요구하면 판정이 멈춘다)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      for (const s of b.trial.steps) {
        expect(new Set(s.want).size, `${b.slug} want 중복: ${s.want.join(', ')}`).toBe(s.want.length)
      }
    }
  })

  it('스텝 사이에 want 가 겹치지 않는다 (앞 스텝에서 이미 누른 타일은 다시 못 누른다)', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      const seen = new Set<string>()
      for (const s of b.trial.steps) {
        for (const id of s.want) {
          expect(seen.has(id), `${b.slug}: ${id} 가 여러 스텝에서 요구됨`).toBe(false)
          seen.add(id)
        }
      }
    }
  })

  it('정답으로 표시된 토큰과 트라이얼 정답이 어긋나지 않는다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      // 진행용 토큰(선택지 열기 등)은 ok 가 아니어도 want 에 들어갈 수 있다.
      // 반대로 ok 인데 아무 스텝도 요구하지 않는 토큰은 데이터 실수다.
      const wanted = new Set(b.trial.steps.flatMap((s) => s.want))
      const orphan = b.board.tokens.filter((t) => t.ok && !wanted.has(t.id)).map((t) => t.id)
      expect(orphan, `${b.slug}: ok 인데 트라이얼이 요구하지 않는 토큰 ${orphan.join(', ')}`).toEqual([])
    }
  })

  it('지시문 · 완료 문구가 비어 있지 않다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      expect(b.trial.done.trim().length, `${b.slug}.trial.done`).toBeGreaterThan(0)
      for (const s of b.trial.steps) expect(s.say.trim().length, `${b.slug} say`).toBeGreaterThan(0)
    }
  })
})

describe('노트 · 목표', () => {
  it('objective 와 facts 3종이 모두 채워져 있다', () => {
    for (const b of Object.values(GAME_BRIEFS)) {
      expect(b.objective.trim().length, `${b.slug}.objective`).toBeGreaterThan(20)
      expect(b.facts.input.trim().length, `${b.slug}.facts.input`).toBeGreaterThan(0)
      expect(b.facts.run.trim().length, `${b.slug}.facts.run`).toBeGreaterThan(0)
      expect(b.facts.record.trim().length, `${b.slug}.facts.record`).toBeGreaterThan(0)
    }
  })
})
