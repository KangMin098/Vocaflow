// apps/web/src/components/library/textbooks/__tests__/shelf-probes.test.tsx
//
// **매대 지수가 찾는 문자열이 렌더된 HTML 에 살아 있는가.**
//
// ── 왜 필요한가 (실측 2026-09-01, 내가 직접 밟았다) ──────────────────
// 좁은 화면에서 줄을 줄이려고 `이 권은 무엇을 시키나요` 를
// `<span class="hidden sm:inline">이 권은 </span>무엇을 시키나요` 로 쪼갰다.
// 화면은 멀쩡했다 — 사람 눈에는 글자가 그대로다. 그런데 `catalog-spec.json` 의 probe 는
// **렌더된 HTML 문자열**을 찾으므로 태그가 끼어든 순간 못 찾았고,
// C4 가 2/2 → 1/2 로 떨어져 **종합이 1.283 → 1.162** 가 됐다.
//
// 그걸 알아챈 것은 dev 서버를 띄우고 벤치마크를 손으로 돌렸기 때문이다.
// 손으로 돌리지 않았다면 조용히 넘어갔을 것이다 — 그래서 여기로 내린다.
//
// ⚠️ 이 테스트는 **문구를 잠그는 것이 아니다.** 문구를 바꾸고 싶으면 `catalog-spec.json` 을
//    먼저 고치면 된다(그게 정본이다). 잠그는 것은 "정본과 화면이 어긋난 채 지나가는 것" 이다.
// ⚠️ `renderToString` 은 서버 렌더 결과다 — 접힌 `<details>` 와 `hidden` 패널의 내용도 들어 있다.
//    벤치마크가 HTTP GET 으로 받는 HTML 과 같은 것을 보므로 자가 판정이 맞다.

import fs from 'node:fs'
import path from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TextbookShelf } from '../TextbookShelf'
import { buildShelf } from '@/lib/textbook/shelf'
import type { Inventory } from '@vocaflow/library-pipeline'
import { SERIES_SPINE } from '@vocaflow/library-pipeline/textbook-series'
import { taglineOf } from '@/lib/textbook/shelf-copy'

/**
 * ⚠️ 패키지 export 로 못 가져온다 — `@vocaflow/library-pipeline` 의 `exports` 에
 *    이 JSON 이 없다(실측: Missing "./src/textbook/catalog-spec.json" specifier).
 *    벤치마크 스크립트도 같은 이유로 **파일 경로로** 읽는다. 같은 파일을 같은 방법으로 읽어야
 *    "정본 하나" 가 유지된다 — 복사본을 두면 그 순간 갈린다.
 */
const SPEC_PATH = path.resolve(
  __dirname,
  '../../../../../../../packages/library-pipeline/src/textbook/catalog-spec.json',
)
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))

/**
 * 재고를 넉넉히 채운 서가 — 모든 계단이 `ready` 여야 상태 배지·펼치기 링크가 다 나온다.
 * 유형 키는 `SERIES_SPINE` 이 쓰는 것 전부를 덮도록 넓게 깐다.
 */
const TYPES = [
  'rhyme',
  'word_meaning',
  'spell_blank',
  'word_order',
  'vocab_choice',
  'unit_vocab',
  'blank_word',
  'grammar_choice',
  'unit_grammar',
  'grammar_fix',
  'order',
  'insert',
  'irrelevant',
]

const inventory: Inventory = TYPES.flatMap((type) =>
  [1, 2, 3, 4, 5, 6, 7].map((vLevel) => ({ type: type as never, vLevel, count: 900 })),
)

const sourcesByLevel = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map((lv) => [lv, { original: 400, plos: 200, voa: 120 }]),
)

const explained = Object.fromEntries(
  TYPES.flatMap((t) => [1, 2, 3, 4, 5, 6, 7].map((lv) => [`${t}|${lv}`, 600])),
)

const shelf = buildShelf(inventory, sourcesByLevel, true, undefined, true, explained)

const html = renderToString(
  <TextbookShelf shelf={shelf} picked={[]} canPick signedIn={false} />,
)

/**
 * 매대(서가) 화면이 책임지는 probe 만 고른다.
 * 레벨 차트(C5)는 `page.tsx` 가 그리고, 낱권 상세(detailAxes)는 다른 화면이다.
 */
const SHELF_OWNED = new Set(['C1', 'C2', 'C3', 'C4', 'C6', 'C7'])

// ⚠️ 타입을 명시한다 — spec 이 JSON.parse 라 any 이고, any[] 를 넘기면 vitest 의 it.each 가
//    가변인자 오버로드를 골라 콜백 인자 타입이 깨진다(실측: TS2345).
const probes: { axis: string; label: string; probe: string }[] = spec.axes
  .filter((a: { id: string }) => SHELF_OWNED.has(a.id))
  .flatMap((a: { id: string; ours: { label: string; probe: string }[] }) =>
    a.ours.map((o) => ({ axis: a.id, label: o.label, probe: o.probe })),
  )

describe('매대 지수 probe 가 렌더 결과에 살아 있다', () => {
  it('검사할 probe 가 실제로 있다 (spec 을 못 읽으면 조용히 통과하지 않는다)', () => {
    expect(probes.length).toBeGreaterThan(20)
  })

  it.each(probes)('[$axis] $label — "$probe"', (item) => {
    expect(html).toContain(item.probe)
  })
})

describe('구조적 우위 probe (저쪽이 가질 수 없는 것)', () => {
  // 'D2 실측 재고 노출' 은 `· 문항` 으로 판정된다 — 태그가 끼면 여기서 잡힌다.
  const structural: { id: string; label: string; probe: string }[] =
    spec.structural.items.filter((d: { probe: string }) => d.probe !== '교재 레벨 차트')

  it.each(structural)('$id $label — "$probe"', (item) => {
    expect(html).toContain(item.probe)
  })
})

/**
 * **표지가 카드와 같은 말을 하는가** — 배선까지 확인한다.
 *
 * `cover.test.ts` 는 `coverSvg` 가 받은 값을 제대로 그리는지 본다. 여기서는 **매대가 그 값을
 * 실제로 넘기는지**를 본다 — 파이프라인을 고쳐 놓고 화면이 옛 인자를 넘기면 표지는 그대로다
 * (실측 2026-09-07: 매대는 `coverSpecOf` 를 안 거치고 spec 을 직접 조립하고 있었다).
 */
describe('매대 표지가 카드 제목과 어긋나지 않는다', () => {
  it('표지의 큰 글자가 **계단 번호가 아니라 권 이름**이다', () => {
    // ⚠️ 숫자로 재면 안 된다 — 계단과 권 이름이 한 칸씩 밀려 있을 뿐 **둘 다 숫자**라
    //    배선이 빠져도 그 숫자가 다른 권 표지에 있어서 통과한다
    //    (실측 2026-09-07: `>4</text>` 는 4단 표지가, `>1</text>` 는 2단 권 이름이 채웠다).
    //    1단만 계단 번호(`1`)와 권 이름(`Starter`)이 **다른 글자**다 — 여기서만 갈린다.
    expect(html).toContain('>Starter</text>')
    // 카드 제목도 같은 화면에 있다 — 표지와 제목이 다른 수를 말하면 그게 결함이었다.
    expect(html).toContain('Vocaflow Reading Starter')
  })

  it('표지의 한 줄이 카드가 쓰는 문장과 **같다**', () => {
    // `taglineOf(rationale)` 한 벌에서 나온다 — 표지가 따로 문장을 지으면 여기서 갈린다.
    const tagline = taglineOf(SERIES_SPINE[4]!.rationale)
    expect(tagline.length).toBeGreaterThan(0)
    // 표지(SVG text)와 카드 본문 양쪽에 같은 문장이 있다.
    expect(html.split(tagline).length - 1).toBeGreaterThanOrEqual(2)
  })

  it('스켈레톤으로 읽히던 글줄 네 줄이 매대에도 없다', () => {
    expect(html).not.toContain('opacity="0.26"')
  })
})
