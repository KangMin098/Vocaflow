// packages/library-pipeline/test/noise.snapshot.test.ts
// 골든셋 스냅샷 — computeLexicalNoise 회귀 가드.
// 스냅샷 diff = 차단 아님, 리뷰 필수 신호 (docs/CONVENTIONS.md 골든셋 규약 참조).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { computeLexicalNoise } from '../src/ingest-article/_helpers'
import { htmlToPlainText } from '../src/ingest-article/_helpers'
import { normalizeBook } from '../src/normalize'

const FIX = join(__dirname, 'fixtures')

function bookBody(slug: string): string {
  const raw = readFileSync(join(FIX, 'books', slug, 'raw.txt'), 'utf8')
  return normalizeBook({
    source: 'gutenberg',
    source_id: slug,
    source_url: 'fixture',
    title: slug,
    language: 'en',
    license: 'PD',
    raw_content: raw,
    fetched_at: new Date(0),
  }).body
}

function articleText(slug: string): string {
  const html = readFileSync(join(FIX, 'articles', slug, 'raw.html'), 'utf8')
  return htmlToPlainText(html)
}

function wikinewsExtract(slug: string): string {
  const json = JSON.parse(readFileSync(join(FIX, 'articles', slug, 'raw.json'), 'utf8'))
  const pages = json.query.pages as Record<string, { extract?: string }>
  return Object.values(pages)[0]?.extract ?? ''
}

describe('computeLexicalNoise — 골든셋 스냅샷 (소수 3자리)', () => {
  it('fixture 6건 noise 값', () => {
    const values = {
      'books/alice-wonderland-gutenberg': computeLexicalNoise(
        bookBody('alice-wonderland-gutenberg'),
      ),
      'books/sherlock-holmes-gutenberg': computeLexicalNoise(
        bookBody('sherlock-holmes-gutenberg'),
      ),
      'articles/voa-amplifiers-downtoners': computeLexicalNoise(
        articleText('voa-amplifiers-downtoners'),
      ),
      'articles/nasa-cindy-evans-artemis': computeLexicalNoise(
        articleText('nasa-cindy-evans-artemis'),
      ),
      'articles/wikinews-armstrong': computeLexicalNoise(
        wikinewsExtract('wikinews-armstrong'),
      ),
      // 합성 오염 샘플 — LaTeX·수식·인용 마커가 0.08 게이트를 확실히 넘는지 고정
      'synthetic/latex-heavy': computeLexicalNoise(
        'We define \\alpha as $x^2$ and cite [12] via ∑ f(x) at https://example.org ' +
          'plus \\frac{a}{b} with θ and [3,4] markers in a short prose sentence.',
      ),
    }
    expect(values).toMatchSnapshot()
    // 게이트 방향성 sanity — 문학 본문은 0.08 미만, 합성 오염은 초과
    expect(values['books/alice-wonderland-gutenberg']).toBeLessThan(0.08)
    expect(values['synthetic/latex-heavy']).toBeGreaterThan(0.08)
  })
})
