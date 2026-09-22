// apps/web/src/lib/csat/pattern-art.ts
//
// 출제 패턴(형식) → 물건 소품 한 곳(DD-68 · tines-mapping 「기출 홈」). 소품은 그 패턴의 설계를 은유한다 —
// 부정문 = 반대로 가리키는 이정표 · 재진술 = 메아리 말풍선 · 주장과 사례 = 큰 카드 + 작은 카드 셋 …
// 생성: `scripts/design/lib/illo-tines-scenes.mjs` 의 spot-pat-* (Kaggle 6회차). 없는 형식은 돋보기 책으로 돌아간다.

const ART: Record<string, string> = {
  부정문: 'spot-pat-negate',
  재진술: 'spot-pat-restate',
  '주장과 사례': 'spot-pat-examples',
  '원인과 목적': 'spot-pat-purpose',
  '결과와 조건': 'spot-pat-condition',
  '방향과 문법': 'spot-pat-direction',
  '조건과 거래': 'spot-pat-trade',
  '양보와 대조': 'spot-pat-contrast',
}

/** 형식 이름 → 삽화 경로 (`/illustrations/tines/<이름>.webp`) */
export const patternArt = (format: string) => `/illustrations/tines/${ART[format] ?? 'spot-reading'}.webp`
