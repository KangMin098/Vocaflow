// scripts/textbook/__tests__/passage-source-registry.test.mjs
//
// **원문 소스 재검증 산출물이 조용히 낡거나 위법으로 기울지 않게 못을 박는다.**
//
// ── 여기서 틀리면 무엇이 되는가 ───────────────────────────────────────
// 이 세 파일(후보 목록 · 프로브 실측 · 판정)은 "다음에 어떤 소스를 붙일 것인가" 의 근거다.
// 셋이 어긋나도 **아무것도 깨지지 않는다** — 스크립트는 각자 잘 돌고, 표도 잘 그려진다.
// 다만 표가 다른 세상을 말한다. 실제로 이 세션에서 두 번 그랬다(2026-09-13):
//   · `--id` 부분 실행이 121항목 스냅샷을 **4항목으로 덮었다** → 리포트가 후보 4개를 근거로 쓸 뻔
//   · 배선된 소스 9곳을 내 주소 오류로 "죽음" 으로 적었다 → ready 11,363편짜리 Gutenberg 포함
//
// 그리고 가장 비싼 실패는 법이다. ND·NC 원문을 문항으로 바꾸면 **오류 없이** 위법 교재가 나온다.
// 그래서 라우팅은 취향이 아니라 검사 대상이다.
//
// 실행: cd apps/web && npx vitest run ../../scripts/textbook/__tests__ --root ../..

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))

const registry = read('scripts/textbook/passage-source-candidates.json')
const probe = read('scripts/textbook/passage-source-probe.json')
const verdict = read('scripts/textbook/passage-source-verdict.json')

/** 본문을 잘라 문항으로 바꿀 수 있는 라이선스 등급. **ND·NC 는 여기 없다.** */
const OPEN_ROUTE = 'open'

describe('후보 목록 — 정본의 모양', () => {
  it('id 가 고유하다 (겹치면 프로브 결과가 서로를 덮는다)', () => {
    const ids = registry.candidates.map((c) => c.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('모든 후보가 kind 와 derivClaim 을 선언한다', () => {
    const kinds = new Set(Object.keys(registry.kinds))
    const routes = new Set(Object.keys(registry.derivClaim))
    for (const c of registry.candidates) {
      expect(kinds, `${c.id} 의 kind '${c.kind}' 가 kinds 표에 없다`).toContain(c.kind)
      expect(routes, `${c.id} 의 derivClaim '${c.derivClaim}' 가 표에 없다`).toContain(c.derivClaim)
    }
  })

  it('excluded 가 아닌 후보는 주소를 갖는다', () => {
    for (const c of registry.candidates) {
      if (c.kind === 'excluded') continue
      expect(c.url, `${c.id} 에 주소가 없다`).toBeTruthy()
    }
  })

  it('arXiv 는 제외 상태로 남는다 — CHECK 제약이 재삽입을 막는다', () => {
    const arxiv = registry.candidates.find((c) => c.id === 'arxiv')
    expect(arxiv, 'arXiv 항목이 사라졌다 — 없어지면 다음 사람이 "후보에 없다"로 읽고 다시 붙인다').toBeTruthy()
    expect(arxiv.kind).toBe('excluded')
    expect(arxiv.url).toBeNull()
    // 왜 제외인지가 사라지면 제외는 근거 없는 금지가 된다.
    expect(arxiv.note).toMatch(/20260614240000/)
  })
})

describe('프로브 실측 — 목록과 어긋나지 않는다', () => {
  it('전수를 잰다 — 부분 실행이 스냅샷을 덮지 않았다', () => {
    expect(
      probe.results.length,
      '프로브 스냅샷이 후보 수보다 적다. `--id`/`--kind` 부분 실행이 덮어썼을 수 있다 ' +
        '(그 경우 --out 없이는 쓰지 않게 돼 있다 — 옛 스냅샷이면 다시 전수 실행할 것)',
    ).toBe(registry.candidates.length)
  })

  it('프로브 행이 전부 목록에 있는 id 다', () => {
    const known = new Set(registry.candidates.map((c) => c.id))
    for (const r of probe.results) expect(known, `프로브에 낯선 id ${r.id}`).toContain(r.id)
  })

  it('excluded 후보는 두드리지 않는다', () => {
    for (const c of registry.candidates.filter((x) => x.kind === 'excluded')) {
      const r = probe.results.find((x) => x.id === c.id)
      expect(r.verdict, `${c.id} 를 두드렸다 — 제외는 두드리지 않는 것이 제외다`).toBe('excluded')
    }
  })
})

describe('판정 — 라우팅이 법을 넘지 않는다', () => {
  it('ND·NC·© 로 주장된 소스는 절대 개방 파이프라인으로 가지 않는다', () => {
    const leaked = verdict.rows.filter((r) => {
      const c = registry.candidates.find((x) => x.id === r.id)
      return r.route === OPEN_ROUTE && c.derivClaim !== 'yes'
    })
    expect(
      leaked.map((r) => r.id),
      'ND/NC 원문이 문항으로 변형되면 오류 없이 위법 교재가 나온다 (2026-08-21: 논증 46편 전부 ND → 문항 0)',
    ).toEqual([])
  })

  it('A 등급은 열거도 변형도 되는 것만이다', () => {
    const enumerable = new Set(['rss', 'oai', 'api', 'list'])
    for (const r of verdict.rows.filter((x) => x.grade === 'A')) {
      expect(enumerable, `${r.id} 가 A 인데 열거 판정이 ${r.verdict}`).toContain(r.verdict)
      expect(r.route, `${r.id} 가 A 인데 라우팅이 ${r.route}`).toBe(OPEN_ROUTE)
    }
  })

  it('모든 후보가 등급을 하나씩 받는다 — 빠진 것이 없다', () => {
    expect(verdict.rows.length).toBe(registry.candidates.length)
    const sum = ['A', 'B', 'C', 'D', 'E'].reduce((n, g) => n + (verdict.tally[g] ?? 0), 0)
    expect(sum).toBe(registry.candidates.length)
  })

  it('상류 합은 소스가 공표한 총량만 더한다 — 1페이지 하한을 섞지 않는다', () => {
    for (const g of ['A', 'B', 'C', 'D', 'E']) {
      const declared = verdict.rows
        .filter((r) => r.grade === g && r.upstreamKind === 'total')
        .reduce((n, r) => n + r.upstream, 0)
      expect(verdict.upstream_by_grade[g] ?? 0, `${g} 등급 합이 하한과 총량을 섞었다`).toBe(declared)
    }
  })
})

describe('라이선스 표본 — 모르는 것을 가능으로 접지 않는다', () => {
  const tally = read('scripts/textbook/oai-license-doab.json')

  it('표기 없음은 변형 가능에 들어가지 않는다', () => {
    expect(tally.open + tally.closed + tally.none).toBe(tally.sample_size)
    expect(tally.tally['(표기 없음)'] ?? 0).toBe(tally.none)
  })

  it('표본 방식을 기록한다 — 앞쪽만 뜬 표본을 모집단 비율로 읽지 않도록', () => {
    expect(['spread', 'prefix']).toContain(tally.sampling)
  })

  it('환산치는 표본 비율 × 총량이지 실측이 아니다', () => {
    const expected = Math.round((tally.complete_list_size * tally.open) / tally.sample_size)
    expect(tally.projected_open).toBe(expected)
  })
})
