// apps/web/src/lib/textbook/__tests__/series-address.test.ts
//
// **권의 주소가 (시리즈, 단) 임을 지킨다.**
//
// ── 왜 (실측 2026-09-12) ────────────────────────────────────────────
// 권의 주소가 `step` 하나였다 — 라우트가 `/library/textbooks/[step]` 이고 담김 표의 PK 도
// `(user_id, step)` 이었다. 그래서 **어휘 5단과 독해 5단이 같은 주소**였고, 시리즈 셋이
// 정의됐는데도(각 6~7단, 재고 찼음) 어휘·구문은 **학습자에게 도달하지 않았다.**
// 막고 있던 것은 재고가 아니라 주소 체계다.
//
// 이 회귀가 지키는 것 셋:
//   ① 권마다 자기 시리즈를 안다(`ShelfVolume.seriesId`) — 링크를 만드는 컴포넌트가 그것을 쓴다
//   ② 링크 만드는 자리에 옛 형태(`/library/textbooks/${step}`)가 하나도 없다
//   ③ 옛 주소는 **살아 있다** — 308 로 독해 새 주소로 보낸다(북마크·공유·색인이 화면보다 오래 산다)

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'
import { describe, expect, it } from 'vitest'

import { buildShelf } from '../shelf'

const SRC = join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')
/** 주석을 지운 소스 — 「이 형태가 없어야 한다」를 볼 때 쓴다(주석에 옛 코드가 근거로 남는다). */
const code = (rel: string) =>
  read(rel)
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n')

describe('권은 자기 시리즈를 안다', () => {
  it('buildShelf 가 권마다 seriesId 를 심는다', () => {
    const shelf = buildShelf([], {}, true, SERIES_CATALOG[0]!.rungs, true, null, 'reading')
    expect(shelf.seriesId).toBe('reading')
    expect(shelf.volumes.length).toBeGreaterThan(0)
    for (const v of shelf.volumes) expect(v.seriesId).toBe('reading')
  })

  it('시리즈를 주면 그 시리즈의 단만 선다 — 어휘는 1단이 없다', () => {
    const vocab = SERIES_CATALOG.find((s) => s.id === 'vocab')
    expect(vocab, '어휘 시리즈가 카탈로그에 없다').toBeTruthy()
    const shelf = buildShelf([], {}, true, vocab!.rungs, true, null, 'vocab')
    expect(shelf.seriesId).toBe('vocab')
    expect(shelf.volumes.map((v) => v.step)).not.toContain(1)
    for (const v of shelf.volumes) expect(v.seriesId).toBe('vocab')
  })

  it('기본값은 독해다 — 옛 호출부가 인자 없이 부른다', () => {
    expect(buildShelf([]).seriesId).toBe('reading')
  })
})

describe('링크에 옛 주소 형태가 남아 있지 않다', () => {
  /** 권 링크를 만드는 자리 전부. 새로 만들면 여기 더한다. */
  const LINKERS = [
    'components/library/textbooks/MyTextbooks.tsx',
    'components/library/textbooks/ShelfControls.tsx',
    'components/library/textbooks/ShareVolumeButton.tsx',
    'app/(main)/library/textbooks/[series]/[step]/page.tsx',
    'app/(main)/library/textbooks/[series]/[step]/practice/page.tsx',
    // 이웃 권 카드 — 여기가 빠져서 죽은 링크로 잡혔다(link-graph-ratchet, 2026-09-12).
    'components/library/textbooks/VolumeDossier.tsx',
  ] as const

  it.each(LINKERS)('%s — 시리즈 없는 권 링크를 만들지 않는다', (rel) => {
    const src = code(rel)
    // `/library/textbooks/${…}` 바로 뒤가 `/` 로 이어지지 않으면 시리즈가 빠진 것이다.
    // (`/library/textbooks` 자체 링크와 `…/${a}/${b}` 는 통과한다.)
    const bad = [...src.matchAll(/\/library\/textbooks\/\$\{[^}]+\}(?!\/)/g)].map((m) => m[0])
    expect(bad).toEqual([])
  })

  it('적어도 한 곳은 실제로 시리즈를 넣어 링크를 만든다 — 검사가 빈 통과가 되지 않게', () => {
    const any = LINKERS.some((rel) => /\/library\/textbooks\/\$\{[^}]+\}\//.test(code(rel)))
    expect(any).toBe(true)
  })
})

describe('옛 주소는 살아 있다', () => {
  /**
   * ⚠️ **파일이 아니라 설정으로 보낸다.** 처음에는 옛 경로(`[step]/page.tsx`)를 리다이렉트
   * 껍데기로 남겼는데 Next 가 **부팅을 거부했다** — `You cannot use different slug names for
   * the same dynamic path ('series' !== 'step')`. 같은 자리에 이름이 다른 동적 조각을 둘 수 없다.
   *
   * 그때 타입체크와 학습자 회귀 353개가 전부 통과했다. **앱은 뜨지도 않는데.**
   * 그래서 이 검사는 설정 파일을 본다 — 그리고 옛 폴더가 되살아나면 그것도 잡는다.
   */
  const cfg = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8')

  it('권 상세 옛 주소가 308 로 독해 새 주소로 간다', () => {
    // 숫자 제약(`(\d+)`)을 문자열로 비교하면 이스케이프 층이 어긋난다 — 자리만 확인한다.
    expect(cfg).toContain('/library/textbooks/:step(')
    expect(cfg).toContain('/library/textbooks/reading/:step')
    expect(cfg).toContain('permanent: true')
  })

  it('연습 옛 주소도 간다 — 로그인 복귀 경로로 쓰였다', () => {
    expect(cfg).toMatch(/\/library\/textbooks\/:step\([^)]+\)\/practice/)
    expect(cfg).toContain('/library/textbooks/reading/:step/practice')
  })

  it('옛 폴더가 없다 — 있으면 앱이 부팅하지 않는다', () => {
    expect(existsSync(join(SRC, 'app', '(main)', 'library', 'textbooks', '[step]'))).toBe(false)
  })

  it('새 폴더는 있다 — 검사가 빈 통과가 되지 않게', () => {
    expect(existsSync(join(SRC, 'app', '(main)', 'library', 'textbooks', '[series]', '[step]'))).toBe(true)
  })
})
describe('조회부가 시리즈 id 를 끝까지 넘긴다', () => {
  /**
   * ⚠️ **이것을 빠뜨렸다가 실측으로 잡혔다**(2026-09-12).
   *
   * `fetchTextbookShelf(seriesId)` 가 `buildShelf` 에 **사다리만** 넘기고 id 를 안 넘겼다.
   * 기본값이 `'reading'` 이라 타입체크는 통과하고, 어휘 코너는 어휘 6권을 제대로 그렸다 —
   * 그런데 **권 링크가 전부 `/library/textbooks/reading/N`** 이었다. 어휘 서가를 보고 누르면
   * 독해 권이 열린다. 띄워서 링크를 세어 보고서야 알았다.
   *
   * 기본값이 있는 인자는 **빠뜨려도 조용하다.** 그래서 소스로 대조한다.
   */
  const src = code('lib/textbook/shelf-query.ts')

  it('buildShelf 호출에 seriesId 가 들어간다', () => {
    const call = src.slice(src.indexOf('return buildShelf('))
    expect(call).toContain('seriesId,')
  })

  it('사다리도 함께 넘긴다 — 둘 중 하나만 넘기면 서가와 주소가 갈린다', () => {
    const call = src.slice(src.indexOf('return buildShelf('))
    expect(call).toContain('spine,')
  })

  it('두 라우트가 같은 화면을 쓴다 — 서가를 두 파일에 적으면 한쪽만 고쳐진다', () => {
    for (const rel of [
      'app/(main)/library/textbooks/page.tsx',
      'app/(main)/library/textbooks/[series]/page.tsx',
    ]) {
      expect(code(rel), `${rel} 이 ShelfScreen 을 안 쓴다`).toContain('ShelfScreen')
    }
  })

  it('시리즈 코너 주소가 카탈로그의 시리즈 전부를 덮는다', () => {
    // 칩이 만드는 주소와 라우트가 어긋나면 누를 수 있는데 404 가 난다.
    const tabs = code('components/library/textbooks/SeriesTabs.tsx')
    expect(tabs).toContain('/library/textbooks/${seriesId}')
    expect(tabs).toContain('SERIES_CATALOG.map')
  })
})
