// apps/web/src/lib/seo/__tests__/og-font.test.ts
//
// **한 단어 안에서 굵기가 갈리는 것**을 막는다.
//
// 2026-08-26, 공유 카드의 영어 제목이 두 번 이렇게 나왔다:
//
//   Pr**agu**e            (첫 렌더 — 한글 폰트를 무조건 싣던 때)
//   A Chr**ist**mas Carol (한글 배지 `만화판` 하나 때문에 다시 실렸을 때)
//
// 원인은 하나다: 한글 서브셋 요청에 `Vocaflow`·숫자 같은 **라틴이 섞여 있었다.**
// 그래서 이 폰트가 라틴 글리프를 *일부만* 갖게 됐고, Satori 는 가진 글자는 이 폰트로,
// 없는 글자는 기본 폰트로 그렸다. 이미지라 타입체크로도 빌드로도 안 잡히고,
// **상태 200 짜리 유효한 PNG** 라 눈으로 열어 보기 전에는 알 수 없다.
//
// 그 실패가 갈리는 지점은 분명하다 — **서브셋 요청에 라틴이 들어가는 순간.**
// 그래서 거기를 잰다. 두 폰트의 글자 범위가 겹치지 않으면 섞일 수가 없다.

import { describe, expect, it } from 'vitest'

import { hangulSubset } from '../og-font'
import { ogCardText, type OgCardProps } from '../og-card'

describe('OG 한글 서브셋', () => {
  it('라틴·숫자·기호를 걸러 낸다 — 이것이 섞이면 영어 단어의 굵기가 갈린다', () => {
    expect(hangulSubset('A Christmas Carol 만화판 5 ch · V8')).toBe('만판화')
  })

  it('한글이 없으면 빈 문자열 — 로더가 폰트를 아예 싣지 않는 신호다', () => {
    expect(hangulSubset('A Christmas Carol · Charles Dickens · B2 V8')).toBe('')
  })

  it('중복을 없애고 정렬한다 — 같은 글자 집합이면 같은 캐시 키여야 한다', () => {
    expect(hangulSubset('만화판 만화')).toBe(hangulSubset('화판만 화만'))
    expect(hangulSubset('가나다').length).toBe(3)
  })

  it('낱자모도 포함한다 — ㄱ·ㅏ 같은 글자가 문구에 섞일 수 있다', () => {
    expect(hangulSubset('ㄱㅏ글')).toContain('글')
    expect(hangulSubset('ㄱㅏ글').length).toBe(3)
  })

  it('카드 텍스트를 그대로 넣어도 한글만 남는다 — 호출부가 하는 그대로', () => {
    const props: OgCardProps = {
      kind: 'Comics',
      title: 'A Christmas Carol',
      subtitle: 'Charles Dickens',
      badges: ['B2', 'V8', '5 ch', '만화판'],
      source: null,
    }
    const chars = hangulSubset(ogCardText(props))
    expect(chars).toBe('만판화')
    // 라틴이 한 글자라도 남으면 그 글자만 한글 폰트로 그려진다 — 그게 이 버그였다.
    expect(/[A-Za-z0-9]/.test(chars)).toBe(false)
  })
})
