// apps/web/src/lib/csat/reflow/pdf-frags.ts
//
// PDF.js `getTextContent().items` → 글자 조각. 브라우저와 측정 스크립트가 **같은 함수**를 쓴다 —
// 두 벌이면 측정은 통과하는데 화면은 다르게 뽑는 일이 생긴다.
//
// `scripts/csat/pdf-anchors.mjs` 의 `pageItems` 와 같은 변환이다(좌표 색인이 그걸로 만들어졌다).

import type { PdfFrag } from './types'

interface RawItem {
  str?: unknown
  transform?: unknown
  width?: unknown
  height?: unknown
}

export function fragsOfContent(items: unknown[]): PdfFrag[] {
  const out: PdfFrag[] = []
  for (const raw of items) {
    const it = raw as RawItem
    if (typeof it.str !== 'string' || !it.str.length || !Array.isArray(it.transform)) continue
    const [a, , , d, e, f] = it.transform as number[]
    out.push({
      str: it.str,
      x: e,
      y: f,
      w: typeof it.width === 'number' ? it.width : 0,
      h: (typeof it.height === 'number' && it.height) || Math.abs(d) || Math.abs(a),
    })
  }
  return out
}
