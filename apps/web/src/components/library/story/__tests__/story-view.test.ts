// apps/web/src/components/library/story/__tests__/story-view.test.ts
// LCP Story 학습자 화면 순수 보조 함수 — 작품 묶기 · 수 · 완료 문구 · 원천 링크 안전 · 문단 · 다음 행동 · 초점 판정.

import { describe, expect, it } from 'vitest'

import {
  catalogViewedEvent,
  completionWording,
  countWorksAndEditions,
  groupCatalogByWork,
  nextActionFor,
  positionWording,
  safeSourceHref,
  shouldFocusUnitHeading,
  sourceLine,
  splitUnitParagraphs,
  nextWordIndex,
  tokenizeWords,
} from '../story-view'
import { KEY_A, KEY_B, KEY_C, progressRow, release } from './fixtures'

describe('groupCatalogByWork · countWorksAndEditions', () => {
  it('같은 작품의 여러 판본은 작품 하나 — workKey 로만 묶고 제목으로 합치지 않는다', () => {
    const releases = [
      release(),
      release({ releaseKey: KEY_B, editionKey: 'easy', kind: 'easy_reader', targetCefr: 'A2', title: 'Gull Rock (Easy)' }),
      // 제목은 같지만 다른 작품 — 합치면 안 된다
      release({ releaseKey: KEY_C, workKey: 'other-gull-rock', editionKey: 'x' }),
    ]
    const { works } = groupCatalogByWork(releases, null)
    expect(works.map((w) => w.workKey)).toEqual(['gull-rock', 'other-gull-rock'])
    expect(works[0].editions.map((g) => [g.kind, g.targetCefr])).toEqual([
      ['story_edition', 'B1'],
      ['easy_reader', 'A2'],
    ])
    expect(countWorksAndEditions(releases)).toEqual({ works: 2, editions: 3 })
  })

  it('같은 편집 목표(종류 + CEFR)의 발행본은 한 묶음 · 중복 발행 키는 한 번만 센다', () => {
    const releases = [release(), release({ releaseKey: KEY_B, coverage: 'episode', completionLabel: 'adapted_partial' }), release()]
    const { works } = groupCatalogByWork(releases, null)
    expect(works[0].editions).toHaveLength(1)
    expect(works[0].editions[0].entries).toHaveLength(2)
    expect(countWorksAndEditions(releases)).toEqual({ works: 1, editions: 2 })
  })

  it('진도는 발행본별로 붙고, 열 수 없는 기록은 링크 없는 이력으로 분리된다', () => {
    const releases = [release()]
    const progress = [
      progressRow(),
      progressRow({ releaseKey: KEY_B, releaseAvailable: false }),
      progressRow({ releaseKey: KEY_C, workKey: 'gone-work', releaseAvailable: false }),
    ]
    const { works, orphanHistory } = groupCatalogByWork(releases, progress)
    expect(works[0].editions[0].entries[0].progress?.releaseKey).toBe(KEY_A)
    expect(works[0].history.map((r) => r.releaseKey)).toEqual([KEY_B])
    expect(orphanHistory.map((r) => r.releaseKey)).toEqual([KEY_C])
  })

  it('작품 머리(제목 · HOOK)는 맨 앞에 보이는 판본(Story Edition)에서 온다 — 서가 행 순서가 Easy Reader 먼저여도', () => {
    const releases = [
      release({ releaseKey: KEY_B, editionKey: 'a-easy', kind: 'easy_reader', targetCefr: 'A2', title: 'Gull Rock (Easy)', hookText: 'Easy hook.' }),
      release({ title: 'Gull Rock', hookText: 'Story hook.' }),
    ]
    const { works } = groupCatalogByWork(releases, null)
    expect(works[0].editions[0].kind).toBe('story_edition')
    expect(works[0].title).toBe('Gull Rock')
    expect(works[0].hookText).toBe('Story hook.')
    // Story Edition 이 없으면 맨 앞 묶음(Easy Reader)의 것이다.
    const onlyEasy = groupCatalogByWork([releases[0]], null)
    expect(onlyEasy.works[0].title).toBe('Gull Rock (Easy)')
  })

  it('빈 서가 = 0 · 0 (지어낸 수 없음)', () => {
    expect(countWorksAndEditions([])).toEqual({ works: 0, editions: 0 })
    expect(groupCatalogByWork([], null).works).toEqual([])
  })
})

describe('catalogViewedEvent', () => {
  it('ready 일 때만 실제 수로 만든다 · error 에는 만들지 않는다', () => {
    const releases = [release(), release({ releaseKey: KEY_B, kind: 'easy_reader' })]
    expect(
      catalogViewedEvent({
        status: 'ready',
        signedIn: true,
        viewerId: 'v',
        releases,
        progress: [],
        progressError: null,
        guidance: { status: 'ready', byRelease: {} },
      }),
    ).toEqual({ name: 'story_catalog_viewed', props: { works: 1, editions: 2, signed_in: true } })
    expect(
      catalogViewedEvent({ status: 'error', failure: { ok: false, code: 'temporary', message: 'x', retryable: true } }),
    ).toBeNull()
  })
})

describe('completionWording', () => {
  const partial = { completedUnitCount: 2, unitCount: 3, completed: false }
  const full = { completedUnitCount: 3, unitCount: 3, completed: true }

  it('모든 단위 명시 표시 전에는 완료를 말하지 않는다', () => {
    expect(completionWording(partial, 'adapted_full_work', 'complete_work')).toEqual({ done: false, text: '완료 표시 2/3' })
    // 플래그만 참이고 수가 모자라면 믿지 않는다
    expect(completionWording({ ...partial, completed: true }, 'adapted_full_work', 'complete_work')?.done).toBe(false)
  })

  it('각색 전권만 「각색 완독」 · 부분 · 에피소드 · 발췌는 「이 부분 읽기 완료」 · 원문 완독 · 숙달은 말하지 않는다', () => {
    expect(completionWording(full, 'adapted_full_work', 'complete_work')).toEqual({ done: true, text: '각색 완독' })
    expect(completionWording(full, 'adapted_partial', 'episode')).toEqual({ done: true, text: '이 부분 읽기 완료' })
    expect(completionWording(full, 'adapted_partial', 'excerpt')).toEqual({ done: true, text: '이 부분 읽기 완료' })
    // 라벨과 범위가 어긋나면 좁은 쪽으로
    expect(completionWording(full, 'adapted_full_work', 'episode')?.text).toBe('이 부분 읽기 완료')
    for (const text of [completionWording(full, 'adapted_full_work', 'complete_work')?.text, completionWording(full, 'adapted_partial', 'episode')?.text]) {
      expect(text).not.toMatch(/원문|숙달|mastery|FSRS/)
    }
    expect(completionWording(null, 'adapted_full_work', 'complete_work')).toBeNull()
  })

  it('위치 문구는 이동 기록일 뿐이다', () => {
    expect(positionWording(1, 3)).toBe('2/3 단위 위치')
    expect(positionWording(9, 3)).toBe('3/3 단위 위치')
  })
})

describe('safeSourceHref', () => {
  it('http · https 만 링크 — 저장값을 글자 그대로 돌려준다(정규화 없음)', () => {
    const exact = [
      'https://www.gutenberg.org/ebooks/1234?format=txt&lang=en#chapter-2',
      'HTTP://Example.ORG', // URL.href 는 http://example.org/ 로 바꾼다
      'https://example.org', // href 는 끝 슬래시를 붙인다
      'https://example.org/a%7Eb', // href 는 그대로지만 퍼센트 인코딩을 건드리지 않는다는 것을 잠근다
      'https://example.org/caf%C3%A9?q=%20x',
      'http://example.org/',
    ]
    for (const url of exact) {
      expect(new URL(url).protocol).toMatch(/^https?:$/)
      expect(safeSourceHref(url), url).toBe(url)
    }
    expect(new URL('HTTP://Example.ORG').href).not.toBe('HTTP://Example.ORG') // 정규화가 실제로 일어나는 값이었다
  })
  it('javascript: · data: · ftp: · 공백 · 제어 문자 · 상대 · 깨진 값 · 빈 값은 링크가 아니다', () => {
    const bad = [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,<b>x</b>',
      'ftp://example.org/x',
      ' https://example.org/',
      'https://example.org/ ',
      'https://example.org/\n',
      'https://exa\tmple.org/',
      'https://example.org/a b',
      'java\u0000script:alert(1)',
      '/relative',
      'not a url',
      '',
      null,
      undefined,
    ]
    for (const value of bad) expect(safeSourceHref(value as string | null | undefined), JSON.stringify(value)).toBeNull()
  })
})

describe('splitUnitParagraphs', () => {
  it('빈 줄로 나누고 빈 문단을 버린다', () => {
    expect(splitUnitParagraphs('One.\n\nTwo\nlines.\r\n\r\n\n\nThree.  ')).toEqual(['One.', 'Two\nlines.', 'Three.'])
    expect(splitUnitParagraphs('   ')).toEqual([])
  })
})

describe('nextActionFor', () => {
  const set = (...n: number[]) => new Set(n)
  it('입구: 기록 없으면 처음부터 · 있으면 마지막 위치에서 이어 읽기', () => {
    expect(nextActionFor({ unitIndex: null, unitCount: 3, completedUnits: set(), lastUnitIndex: null })).toEqual({ type: 'start', unitIndex: 0 })
    expect(nextActionFor({ unitIndex: null, unitCount: 3, completedUnits: set(0), lastUnitIndex: 2 })).toEqual({ type: 'resume', unitIndex: 2 })
  })
  it('읽는 중: 표시 전이면 읽음 표시 · 표시했으면 다음 미표시 단위 · 마지막 단위 도착만으로 done 이 아니다', () => {
    expect(nextActionFor({ unitIndex: 1, unitCount: 3, completedUnits: set(0), lastUnitIndex: 1 })).toEqual({ type: 'complete', unitIndex: 1 })
    expect(nextActionFor({ unitIndex: 1, unitCount: 3, completedUnits: set(0, 1), lastUnitIndex: 1 })).toEqual({ type: 'navigate', unitIndex: 2 })
    // 마지막 단위만 표시 — 앞의 미표시 단위로 돌려보낸다
    expect(nextActionFor({ unitIndex: 2, unitCount: 3, completedUnits: set(2), lastUnitIndex: 2 })).toEqual({ type: 'navigate', unitIndex: 0 })
    expect(nextActionFor({ unitIndex: 2, unitCount: 3, completedUnits: set(0, 1, 2), lastUnitIndex: 2 })).toEqual({ type: 'done' })
  })
})

describe('tokenizeWords · nextWordIndex · sourceLine', () => {
  it('낱말만 번호를 받고, 조각을 이어 붙이면 원문 그대로다', () => {
    const text = "Don’t stop — it's 3 o'clock."
    const { pieces, next } = tokenizeWords(text, 5)
    expect(pieces.map((p) => p.text).join('')).toBe(text)
    expect(pieces.filter((p) => p.type === 'word').map((p) => p.text)).toEqual(['Don’t', 'stop', "it's", "o'clock"])
    expect(next).toBe(9)
  })

  it('외래어 · 결합 부호(NFC · NFD)도 통째로 — 조각 낱말을 만들지 않는다 · 하이픈 · 축약은 한 낱말 · 구두점 제외', () => {
    const nfdCafe = 'café'
    const nfdNaive = 'naïve'
    const nfdResume = 'résumé'
    const text = `A naïve café owner read my résumé. ${nfdCafe}, ${nfdNaive}; ${nfdResume}! Don't — it's well-known (end-) 'quoted' x2.`
    const { pieces } = tokenizeWords(text)
    expect(pieces.map((p) => p.text).join('')).toBe(text)
    const words = pieces.filter((p) => p.type === 'word').map((p) => p.text)
    expect(words).toEqual([
      'A', 'naïve', 'café', 'owner', 'read', 'my', 'résumé',
      nfdCafe, nfdNaive, nfdResume,
      "Don't", "it's", 'well-known', 'end', 'quoted', 'x',
    ])
    // 조각이 하나도 없다: 낱말마다 앞뒤가 글자 · 결합 부호가 아니다
    for (const w of words) expect(w, w).toMatch(/^\p{L}[\p{L}\p{M}'’\-‐]*$/u)
    expect(words).not.toContain('na')
    expect(words).not.toContain('caf')
    expect(words).not.toContain('r')
    expect(words.some((w) => /[.,;!()—]/.test(w))).toBe(false)
    expect(words.some((w) => /['’\-]$/.test(w))).toBe(false)
  })
  it('화살표 · Home · End 로만 움직이고 양끝에서 멈춘다', () => {
    expect(nextWordIndex('ArrowRight', 2, 3)).toBe(2)
    expect(nextWordIndex('ArrowLeft', 0, 3)).toBe(0)
    expect(nextWordIndex('End', 0, 3)).toBe(2)
    expect(nextWordIndex('Home', 2, 3)).toBe(0)
    expect(nextWordIndex('a', 1, 3)).toBeNull()
  })
  it('원천 줄: 번역본이면 번역자(없으면 없음이라고)', () => {
    const base = { title: 't', author: null, originalLanguage: 'en', textLanguage: 'en', translator: null, editionLabel: 'Ed', coverage: 'excerpt' as const, sourceUrl: null }
    expect(sourceLine(base)).not.toContain('번역')
    expect(sourceLine({ ...base, originalLanguage: 'fr' })).toContain('번역 번역자 정보 없음')
    expect(sourceLine(base)).toContain('원천 판본 Ed')
  })
})

describe('shouldFocusUnitHeading', () => {
  it('첫 진입은 옮기지 않고, 단위가 바뀐 뒤에만 옮긴다', () => {
    expect(shouldFocusUnitHeading(undefined, 1)).toBe(false)
    expect(shouldFocusUnitHeading(1, 1)).toBe(false)
    expect(shouldFocusUnitHeading(1, 2)).toBe(true)
    expect(shouldFocusUnitHeading(null, 0)).toBe(true)
    expect(shouldFocusUnitHeading(2, null)).toBe(false)
  })
})
