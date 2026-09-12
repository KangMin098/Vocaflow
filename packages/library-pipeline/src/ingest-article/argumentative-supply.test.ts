// packages/library-pipeline/src/ingest-article/argumentative-supply.test.ts
//
// **논증문을 실제로 교재에 쓸 수 있는 공급선이 하나라도 남아 있는가.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-08-21) ─────────────────────────
// 교재 재고를 처음 전수 측정했을 때 논증문 문항이 **0개**였다. 원인을 오래 못 찾았는데,
// 어느 지표도 깨지지 않았기 때문이다 — 논증문 지문은 **84편이나 있었고**, 소스 GET 도
// 정상이었고, 수집 건수도 늘고 있었다. 틀린 것은 딱 하나:
//
//   그 84편 중 71편이 CC-BY-ND(The Conversation) → `display_only = true`
//   → 문항 생성기가 통째로 건너뛴다 → **지문은 쌓이는데 문항은 0**
//
// 이 실패는 조용하다. "논증문 소스가 있다" 는 참이고 "수집이 된다" 도 참인데
// 교재에는 한 문항도 안 실린다. 그래서 **register 존재가 아니라 사용 가능성**을 잰다.
//
// ⚠️ 이 테스트는 "논증문 소스를 늘리자" 로 가다 틀린 기록이기도 하다.
//   후보였던 Aeon·Quanta·Knowable 이 전부 ND/NC 라 **붙여도 결과가 같았다.**
//   그래서 여기서 세는 것은 소스 개수가 아니라 **ND·NC 가 아닌** 공급선의 개수다.
//
// 네트워크를 타지 않는다 — 배선표만 본다. 실제 수확량은 `scripts/textbook/source-yield-probe.mjs`.

import { describe, expect, it } from 'vitest'

import {
  FEED_REGISTER,
  FEED_SPECS,
  SOURCE_REGISTER_DEFAULT,
  licenseClassOf,
  resolveArticleRegister,
  SOURCE_SPECS,
  type SourceKey,
} from './_curation-spec'
import { PLOS_FEEDS } from './plos'

/** 본문을 변형해 문항으로 만들 수 있는 라이선스 등급. ND·NC 는 여기 없다. */
const USABLE_LICENSE = new Set(['public_domain', 'cc0', 'cc_by', 'cc_by_sa'])

/** 배선표에서 (소스, 피드) → register 를 전부 펼친다. */
function wiredRegisters(): Array<{ source: string; feedId: string | null; register: string }> {
  const rows: Array<{ source: string; feedId: string | null; register: string }> = []
  for (const key of Object.keys(FEED_REGISTER)) {
    const [source, feedId] = key.split(':')
    rows.push({ source: source!, feedId: feedId ?? null, register: FEED_REGISTER[key]! })
  }
  for (const source of Object.keys(SOURCE_REGISTER_DEFAULT)) {
    rows.push({ source, feedId: null, register: SOURCE_REGISTER_DEFAULT[source]! })
  }
  return rows
}

function licenseOf(source: string): string | null {
  const spec = SOURCE_SPECS[source as SourceKey]
  return spec ? licenseClassOf(spec.license) : null
}

describe('논증문 공급선 — 재고 0 재발 방지', () => {
  it('ND·NC 가 아닌 논증문 공급선이 최소 하나 있다', () => {
    const usable = wiredRegisters().filter(
      (r) => r.register === 'argumentative' && USABLE_LICENSE.has(licenseOf(r.source) ?? ''),
    )
    // 실패 메시지에 이유를 담는다 — 다음 사람이 "왜 0이지" 로 시간을 쓰지 않도록.
    expect(
      usable.map((r) => `${r.source}${r.feedId ? ':' + r.feedId : ''}`),
      'ND/NC 논증 소스는 display_only 라 문항이 0이다. ' +
        '논증문을 붙일 때는 개수가 아니라 라이선스를 본다 (CC BY · CC BY-SA · PD 만 유효).',
    ).not.toEqual([])
  })

  it('PLOS 논증 피드가 배선돼 있고 register 가 argumentative 다', () => {
    const essay = PLOS_FEEDS.find((f) => f.id === 'essay')
    expect(essay, 'PLOS essay 피드가 사라지면 CC BY 논증문 공급선이 0이 된다').toBeDefined()
    expect(essay!.articleTypes.length).toBeGreaterThan(0)
    expect(resolveArticleRegister('plos', 'essay')).toBe('argumentative')
  })

  it('PLOS 기본(recent) 피드는 설명문 그대로다 — 유형 축이 섞이면 커버리지가 부풀려진다', () => {
    expect(resolveArticleRegister('plos', 'recent')).toBe('expository')
  })

  it('the_conversation 은 여전히 ND 다 — 낙관적으로 승격되지 않았는지 고정', () => {
    // 이 값이 바뀌면 71편이 되살아나는 것이므로 축하할 일이지만,
    // **근거 없이 바뀌었다면** 라이선스를 잘못 적은 것이다. 그래서 고정한다.
    expect(licenseOf('the_conversation')).toBe('cc_by_nd')
  })

  it('논증 피드의 spec 이 소스 기본값보다 빡빡하지 않다', () => {
    // 구멍을 메우려고 피드를 붙였는데 spec 이 도로 걸러 내면 아무것도 안 바뀐다.
    // 실제로 nih:medlineplus 는 원본 54건이 spec 에 전량 거절돼 0건이었다(실측 2026-08-21).
    const essaySpec = FEED_SPECS['plos:essay']
    expect(essaySpec, 'plos:essay spec 이 없으면 소스 기본값(minDescriptionLen 100)이 걸린다').toBeDefined()
    expect(essaySpec!.minDescriptionLen).toBeLessThanOrEqual(100)
  })
})
