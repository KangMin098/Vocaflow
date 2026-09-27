// apps/web/src/app/dev/replica/tines-home/page.tsx
//
// 참조 홈 페이지의 **구조 복제**(DD-62 Stage 2 · 내부 측정용 · 배포 차단은 ../layout.tsx).
//
// 바꾸지 않은 것: 상자의 자리·크기, 띠 간격, 타입 스케일(크기·굵기·행간·자간), 색값.
// 바꾼 것: 서체 system-ui(참조 서체는 상용 · L3 금지) · 그림 자리는 회색 상자 · 문구는 같은 글자 수의 lorem.
//
// 이 화면은 제품이 아니다. `@form` 선언이 없는 이유도 그것이다 — 골격을 **발명한** 화면이 아니라
// 남의 골격을 **잰** 자다(form-declaration-ratchet 이 dev/replica 를 건너뛴다).
//
// 완료 기준: `node scripts/design/replica-diff.mjs` 의 마스킹 후 픽셀 차이 ≤ 2%.

import { BandStack } from '../BandStack'
import { computed } from '../blueprint'

export const dynamic = 'force-dynamic'

export default function TinesHomeReplica() {
  const data = computed()
  return (
    <>
      <BandStack vp={data['1440']} />
      <BandStack vp={data['375']} />
    </>
  )
}
