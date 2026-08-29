// apps/web/src/lib/library/__tests__/curation-genre-keywords.test.ts
//
// 회귀 고정: **큐레이션 드레인이 채운 genre_norm 이 화면에서 엉뚱한 버킷으로 떨어지지 않는다.**
//
// 2026-08-30, 발행 도서 311권의 genre_norm 을 Claude Code 배치로 채웠다. 그때
// `scripts/lcp/curation-meta/import.mjs` 는 값을 넣기 전에 "이 문자열이 어느 버킷 키워드를
// 포함하는가" 를 검사한다 — 포함하지 않으면 `bucketOf` 가 조용히 'literary' 로 떨어뜨려
// **채워도 안 채운 것과 같아지기** 때문이다(실제로 '풍자 단편' 1건이 여기서 걸렸다).
//
// 문제는 그 검사가 `genres.ts` 의 RULES 를 **복사한 목록**이라는 것이다. 두 곳이 갈리면
// 드레인은 통과시키는데 화면은 literary 로 보내는, 아무도 오류를 보지 못하는 상태가 된다.
// 그래서 여기서 두 목록이 같은지 못 박는다.
//
// 이 테스트가 깨지면 고칠 것은 둘 중 하나가 아니라 **둘 다** — 같은 커밋에서.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

import { bucketOf } from '../genres'

const IMPORT_SCRIPT = resolve(__dirname, '../../../../../../scripts/lcp/curation-meta/import.mjs')
const GENRES_SRC = resolve(__dirname, '../genres.ts')

/** import.mjs 의 GENRE_KEYWORDS 배열 리터럴에서 문자열만 뽑는다. */
function importKeywords(): string[] {
  const src = readFileSync(IMPORT_SCRIPT, 'utf8')
  const m = src.match(/const GENRE_KEYWORDS = \[([\s\S]*?)\n\]/)
  if (!m) throw new Error('import.mjs 에서 GENRE_KEYWORDS 를 찾지 못했다')
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!)
}

/** genres.ts 의 RULES 에 실제로 쓰인 키워드를 뽑는다. */
function rulesKeywords(): string[] {
  const src = readFileSync(GENRES_SRC, 'utf8')
  const m = src.match(/const RULES: Array<\{ key: GenreBucket; kws: string\[\] \}> = \[([\s\S]*?)\n\]/)
  if (!m) throw new Error('genres.ts 에서 RULES 를 찾지 못했다')
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!)
}

describe('큐레이션 genre_norm 이 화면 버킷과 어긋나지 않는다', () => {
  it('import.mjs 가 통과시키는 키워드는 모두 genres.ts RULES 에 있다', () => {
    const rules = new Set(rulesKeywords())
    // '소설' 은 RULES 에 없다 — literary(fallback)를 **의도적으로** 노릴 때만 쓰는 값이라
    // 예외로 둔다. 이 예외가 없으면 "빈 genre_norm" 과 "일부러 문학으로 둔 것" 을 구분할 수 없다.
    const INTENTIONAL_LITERARY = '소설'

    const stray = importKeywords().filter((k) => k !== INTENTIONAL_LITERARY && !rules.has(k))
    expect(
      stray,
      `import.mjs 만 아는 키워드 — 드레인은 통과시키지만 화면은 literary 로 보낸다: ${stray.join(', ')}`,
    ).toEqual([])
  })

  it('의도적 literary 표식은 실제로 literary 버킷이다', () => {
    expect(bucketOf('풍자 소설')).toBe('literary')
    expect(bucketOf('유머 소설')).toBe('literary')
  })

  it('각 버킷을 대표하는 값이 그 버킷으로 간다 — 규칙 순서 회귀 방지', () => {
    // 순서 의존이 실재한다: '우화'(children_ya)가 essay 키워드보다 먼저 걸려야 하고,
    // '공상과학 희곡' 은 scifi_fantasy 가 poetry_drama 보다 먼저 걸려야 한다.
    expect(bucketOf('그림책')).toBe('children_ya')
    expect(bucketOf('우화')).toBe('children_ya')
    expect(bucketOf('동화')).toBe('children_ya')
    expect(bucketOf('추리')).toBe('mystery')
    expect(bucketOf('공상과학')).toBe('scifi_fantasy')
    expect(bucketOf('공상과학 희곡')).toBe('scifi_fantasy')
    expect(bucketOf('환상 동화')).toBe('children_ya') // 동화가 먼저 — 아동 판타지는 동화로
    expect(bucketOf('로맨스')).toBe('romance')
    expect(bucketOf('비극')).toBe('poetry_drama')
    expect(bucketOf('운문')).toBe('poetry_drama')
    expect(bucketOf('사극')).toBe('poetry_drama')
    expect(bucketOf('철학')).toBe('essay_philosophy')
    expect(bucketOf('교과서')).toBe('essay_philosophy')
    expect(bucketOf('모험 소설')).toBe('adventure_history')
    expect(bucketOf('역사 소설')).toBe('adventure_history')
  })
})
