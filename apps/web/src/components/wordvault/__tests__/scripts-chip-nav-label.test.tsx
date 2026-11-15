// apps/web/src/components/wordvault/__tests__/scripts-chip-nav-label.test.tsx
// 칩 라벨은 React 텍스트로 — 한 번 푼 제목이 SSR 에서 이중 이스케이프(&amp;#x27;)로 보이지 않는다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { decodeEntitiesOnce } from '@/lib/wordvault/display-label'

import { ScriptsChipNav } from '../ScriptsChipNav'

describe('ScriptsChipNav 라벨', () => {
  it('푼 제목은 화면 글자로 한 번만 이스케이프된다', () => {
    const label = decodeEntitiesOnce('Lincoln&#x27;s Cottage: A Quiet Retreat')
    const html = renderToString(<ScriptsChipNav chips={[{ id: 'set:s1', label, count: 3 }]} active="all" onChange={() => {}} />)
    expect(html).toContain('Lincoln&#x27;s Cottage') // React 의 정상 텍스트 이스케이프(화면에는 ')
    expect(html).not.toContain('&amp;#x27;') // 예전: 저장 원문을 넣어 화면에 &#x27; 가 그대로 보였다
  })
})
