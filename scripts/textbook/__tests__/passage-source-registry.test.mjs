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
    // ⚠️ 등급을 더할 때 **여기도 더해야 한다.** F 를 만들고 이 줄을 잊어 121 이 107 로 나왔다
    //   (2026-09-13) — 검사가 스스로 잡았다. 등급 목록을 한 곳에서 읽는다.
    const GRADES = ['A', 'B', 'C', 'F', 'D', 'E']
    const sum = GRADES.reduce((n, g) => n + (verdict.tally[g] ?? 0), 0)
    expect(sum).toBe(registry.candidates.length)
  })

  it('상류 합은 소스가 공표한 총량만 더한다 — 1페이지 하한을 섞지 않는다', () => {
    for (const g of ['A', 'B', 'C', 'F', 'D', 'E']) {
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

describe('DOAB 표본 — 언어·단위 축을 빼고 세지 않는다', () => {
  const tally = read('scripts/textbook/oai-license-doab.json')

  it('언어와 단위를 같이 센다 — 라이선스만 세면 수치가 과대해진다', () => {
    // Cycle 1 은 「변형 가능 42,899권」이라 적었는데 그것은 영어 축을 빼고 센 수였다.
    // 실제 영어 비율은 51.1% 였다. 축이 사라지면 같은 과대추정이 다시 들어온다.
    expect(tally.lang_tally, '언어 집계가 없다').toBeTruthy()
    expect(tally.unit_tally, '단위(book/chapter) 집계가 없다').toBeTruthy()
    expect(tally.open_en, '변형 가능 × 영어 수가 없다').toBeTypeOf('number')
  })

  it('변형 가능 × 영어는 변형 가능 전체보다 클 수 없다', () => {
    expect(tally.open_en).toBeLessThanOrEqual(tally.open)
    expect(tally.open_en_chapter).toBeLessThanOrEqual(tally.open_en)
  })
})

describe('Europe PMC 수확률 — 규격 창을 자기가 정하지 않는다', () => {
  const y = read('scripts/textbook/epmc-yield.json')

  it('창은 조판 정본(compose-unit)의 값이다', async () => {
    const { CSAT_ITEM_WORDS, CSAT_LONG_ITEM_WORDS } = await import(
      '../../../packages/library-pipeline/src/textbook/compose-unit.ts'
    )
    // 프로브가 자기 숫자를 적기 시작하면 화면·조판과 다른 답을 하는 날이 온다.
    expect(y.windows.short).toEqual({ min: CSAT_ITEM_WORDS.min, max: CSAT_ITEM_WORDS.max })
    expect(y.windows.long).toEqual({ min: CSAT_LONG_ITEM_WORDS.min, max: CSAT_LONG_ITEM_WORDS.max })
  })

  it('라이선스가 질의에 박혀 있다 — 혼재가 들어올 수 없다', () => {
    expect(y.query).toMatch(/LICENSE:"cc by"/)
    expect(y.query).toMatch(/LANG:"eng"/)
  })

  it('수확률은 표본 안에서 계산된다 — 표본보다 큰 적중은 없다', () => {
    expect(y.fit_either).toBeLessThanOrEqual(y.sample_size)
    expect(y.fit_short).toBeLessThanOrEqual(y.sample_size)
    expect(y.fit_long).toBeLessThanOrEqual(y.sample_size)
  })

  it('환산 지문 수는 상류 × 수확률이지 실측이 아니다', () => {
    expect(y.projected_passages).toBe(Math.round((y.hit_count * y.fit_either) / y.sample_size))
  })
})

describe('Europe PMC 는 색인이 아니라 1급 소스로 분류돼 있다', () => {
  it('사용자 표의 「원문 아님」 판정을 실측이 뒤집은 것을 지킨다', () => {
    const c = registry.candidates.find((x) => x.id === 'europe_pmc')
    // index 로 되돌아가면 A 등급에서 빠지고, 논증문 공급선이 다시 페이지 분량 3곳으로 줄어든다.
    expect(c.kind, 'europe_pmc 가 index 로 되돌아갔다').toBe('api')
    expect(c.derivClaim).toBe('yes')
    expect(c.register).toBe('argumentative')
    const row = verdict.rows.find((r) => r.id === 'europe_pmc')
    expect(row.grade).toBe('A')
  })

  it('A 등급 논증문 공급선 중 총량이 공표된 곳이 최소 하나 있다', () => {
    const withTotal = verdict.rows.filter(
      (r) => r.grade === 'A' && r.register === 'argumentative' && r.upstreamKind === 'total',
    )
    expect(
      withTotal.map((r) => r.id),
      'RSS 한 페이지 분량만 남으면 「공급선이 있다」가 참이어도 재고는 안 는다',
    ).not.toEqual([])
  })
})

describe('권리는 두 축이다 — ND 와 © 를 같은 칸에 담지 않는다', () => {
  it('모든 후보가 재배포 축을 선언한다', () => {
    const ok = new Set(Object.keys(registry.redistributeClaim))
    for (const c of registry.candidates) {
      expect(ok, `${c.id} 의 redistributeClaim '${c.redistributeClaim}' 가 표에 없다`).toContain(
        c.redistributeClaim,
      )
      expect(c.redistributeWhy, `${c.id} 에 판정 이유가 없다`).toBeTruthy()
    }
  })

  it('파생이 허용되면 재배포도 허용된다 — 더 강한 권리가 열려 있다', () => {
    for (const c of registry.candidates) {
      if (c.derivClaim === 'yes') expect(c.redistributeClaim, c.id).toBe('yes')
    }
  })

  it('© 로 주장된 소스는 본문 저장 대상이 아니다 (F 등급)', () => {
    // 「CC 아님」을 CC 로 읽어 Aeon·SEP 이 재배포 허용으로 넘어간 적이 있다(2026-09-13).
    for (const id of ['aeon', 'sep', 'smithsonian_mag', 'big_think', 'jstor_daily', 'nautilus']) {
      const c = registry.candidates.find((x) => x.id === id)
      expect(c.redistributeClaim, `${id} 가 재배포 허용으로 넘어갔다`).toBe('no')
    }
  })

  it('CC BY-ND 계열은 원문 확보 대상이다 (C 등급)', () => {
    for (const id of ['the_conversation', 'knowable', 'quanta', 'mongabay', 'undark']) {
      const c = registry.candidates.find((x) => x.id === id)
      expect(c.derivClaim, `${id} 의 파생 판정`).toBe('no')
      expect(c.redistributeClaim, `${id} 의 재배포 판정 — ND 는 verbatim 재배포가 된다`).toBe('yes')
    }
  })

  it('F 등급은 하나도 개방·비개방 파이프라인으로 가지 않는다', () => {
    for (const r of verdict.rows.filter((x) => x.grade === 'F')) {
      expect(r.route, `${r.id} 가 F 인데 라우팅이 ${r.route}`).toBe('link-only')
    }
  })

  it('C 등급은 전부 재배포 가능이다 — 본문을 담아도 되는 칸이다', () => {
    for (const r of verdict.rows.filter((x) => x.grade === 'C')) {
      expect(r.redistributeClaim, `${r.id} 가 C 인데 재배포 ${r.redistributeClaim}`).toBe('yes')
      expect(r.derivClaim, `${r.id} 가 C 인데 파생 ${r.derivClaim}`).toBe('no')
    }
  })

  it('C 와 F 를 합치면 예전 C 등급이 된다 — 쪼갰을 뿐 잃지 않았다', () => {
    expect((verdict.tally.C ?? 0) + (verdict.tally.F ?? 0)).toBe(24)
  })
})

describe('register 측정 — 선언과 나란히 기록돼 있다', () => {
  const m = read('scripts/textbook/register-measure.json')

  it('눈금이 기출에서 나왔다 — 짐작한 상수가 아니다', () => {
    expect(m.baseline_csat.n, '기출 표본이 없다').toBeGreaterThan(500)
    expect(m.threshold_from_csat_median).toBe(m.baseline_csat.median)
    expect(m.threshold_from_csat_median, '임계값이 0 이면 모든 소스가 통과한다').toBeGreaterThan(0)
  })

  it('선언이 측정을 갈라 주지 않는다는 사실이 기록돼 있다', () => {
    // 이 수치가 사라지면 다음 사람이 register 를 측정값으로 읽는다.
    expect(m.declared_overlap).toBeTypeOf('number')
    expect(m.declared_argumentative.n).toBeGreaterThan(0)
    expect(m.declared_expository.n).toBeGreaterThan(0)
  })

  it('측정 공급 추정은 변형 가능 행만 센다', () => {
    // ND 본문의 표지 밀도가 높아도 문항이 되지 않는다 — 넣으면 거짓이 된다.
    const tc = m.projection.find((r) => r.source === 'the_conversation')
    if (tc) expect(tc.rows, 'display_only 인 the_conversation 행이 공급량에 들어왔다').toBe(0)
  })

  it('측정 공급이 소스별 추정의 합과 같다', () => {
    const sum = m.projection.reduce((n, r) => n + r.measured_supply_est, 0)
    expect(m.measured_supply_total).toBe(sum)
  })

  it('측정이 선언보다 크다는 것이 이 사이클의 발견이다', () => {
    expect(m.measured_supply_total).toBeGreaterThan(m.declared_argumentative_rows)
  })
})
