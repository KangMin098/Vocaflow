// apps/web/src/app/dev/replica/ours-home/page.tsx
//
// `tines-home` 과 **같은 렌더러 · 같은 청사진**에 치환 네 가지만 얹은 화면(DD-62 Stage 3).
// 구조·수치 변경 0 — 띠 높이 · 간격 · 상자 자리 · 글자 크기/굵기/행간/자간은 실측값 그대로다.
// 바뀌는 것: ① 색(치환표) ② 서체(Hahmlet/Lora · IBM Plex Sans KR) ③ 그림(골든 삽화 + 우리 화면 캡처) ④ 문구(랜딩 정본).
//
// 사람 판단 ① 의 질문은 「같은 급인가 / 같은 것인가」다. 급이 안 되면 넷을 하나씩 되돌려
// 어느 것이 떨어뜨렸는지 시트로 가른다 — 그래서 넷이 각각 껐다 켤 수 있는 자리에 있다.

import { BandStack, mediaSlots, textSlots } from '../BandStack'
import type { Subst } from '../BandStack'
import { computed } from '../blueprint'
import type { ViewportBlueprint } from '../blueprint'
import { colorMap, fontFor, planCopy, planMedia } from '../ours'

export const dynamic = 'force-dynamic'

function substFor(vp: ViewportBlueprint): Subst {
  const map = colorMap()
  return {
    color: (hex) => (hex ? (map.get(hex.toLowerCase()) ?? hex) : undefined),
    font: fontFor,
    media: planMedia(mediaSlots(vp)),
    copy: planCopy(textSlots(vp)),
  }
}

export default function OursHome() {
  const data = computed()
  return (
    <>
      <BandStack vp={data['1440']} subst={substFor(data['1440'])} />
      <BandStack vp={data['375']} subst={substFor(data['375'])} />
    </>
  )
}
