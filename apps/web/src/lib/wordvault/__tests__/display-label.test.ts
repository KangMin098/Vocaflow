// apps/web/src/lib/wordvault/__tests__/display-label.test.ts
// 출처 칩 제목의 HTML 엔티티를 한 번만 푼다 — 두 번 풀지 않고, 잘못된 엔티티 · 정상 제목 · 한글은 그대로.
import { describe, expect, it } from 'vitest'

import { decodeEntitiesOnce } from '../display-label'

describe('decodeEntitiesOnce', () => {
  it('실측 제목: &#x27; → 아포스트로피', () => {
    expect(decodeEntitiesOnce('Lincoln&#x27;s Cottage: A Quiet Retreat')).toBe("Lincoln's Cottage: A Quiet Retreat")
  })
  it('숫자 · 이름 엔티티', () => {
    expect(decodeEntitiesOnce('Tom &amp; Jerry &#39;Live&#39; &quot;x&quot; &lt;b&gt;')).toBe('Tom & Jerry \'Live\' "x" <b>')
  })
  it('한 번만 — &amp;#x27; 는 &#x27; 로 멈춘다', () => {
    expect(decodeEntitiesOnce('A&amp;#x27;B')).toBe('A&#x27;B')
    expect(decodeEntitiesOnce(decodeEntitiesOnce('A&amp;#x27;B'))).toBe("A'B") // 호출자가 두 번 부를 때만
  })
  it('잘못된 · 모르는 엔티티는 그대로', () => {
    for (const s of ['&#xZZ;', '&#0;', '&#x110000;', '&#xD800;', '&bogus;', '& amp;', 'AT&T', '&#39']) expect(decodeEntitiesOnce(s)).toBe(s)
  })
  it('정상 제목 · 한글 · 이모지는 그대로', () => {
    for (const s of ['The Hat on the Chair', '어린 왕자 단어장', '📚 Science Words', '']) expect(decodeEntitiesOnce(s)).toBe(s)
  })
})
