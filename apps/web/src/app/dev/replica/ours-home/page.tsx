// apps/web/src/app/dev/replica/ours-home/page.tsx
//
// `tines-home` 과 **같은 렌더러 · 같은 청사진**에 치환 네 가지만 얹은 화면(DD-62 Stage 3).
// 구조·수치 변경 0 — 띠 높이 · 간격 · 상자 자리 · 글자 크기/굵기/자간은 실측값 그대로다.
//
//   ① 색   — 치환표(면/선/글자 **역할별** · `docs/design/refs/substitution.json`)
//   ② 서체 — 표제 Hahmlet/Lora · 본문 IBM Plex Sans KR (크기·굵기·자간 유지 · 행간만 한글 최소 1.25)
//   ③ 그림 — 규격 L 장면 2점 + 골든 스팟 4점 + 제품 화면 자리에 `/fit` 실캡처
//   ④ 문구 — 랜딩 카피 정본 + 새 문장. **숫자는 DB 실측**으로만 채우고, 못 읽으면 그 문장을 버린다.
//
// 사람 판단 ① 의 질문은 「같은 급인가 / 같은 것인가」다. 급이 안 되면 넷을 하나씩 되돌려
// 어느 것이 떨어뜨렸는지 시트로 가른다 — 그래서 넷이 각각 껐다 켤 수 있는 자리에 있다.

import { BandStack, mediaSlots, textSlots } from '../BandStack'
import type { Subst } from '../BandStack'
import { computed } from '../blueprint'
import type { ViewportBlueprint } from '../blueprint'
import { colorFn, fontFor, planCopy, planMedia } from '../ours'

import { fetchPlatformFactsPartial } from '@/lib/marketing/trust-signals'

export const dynamic = 'force-dynamic'

function substFor(vp: ViewportBlueprint, facts: Parameters<typeof planCopy>[1]): Subst {
  return {
    color: colorFn(),
    font: fontFor,
    media: planMedia(mediaSlots(vp)),
    copy: planCopy(textSlots(vp), facts),
  }
}

export default async function OursHome() {
  const data = computed()
  // 실측 마커의 유일한 출처. **항목별로** 받는다 — 하나가 안 읽힌다고 나머지 실측치까지 버리지 않는다.
  // 못 읽은 항목이 든 문장만 빠진다(상수로 때우지 않는다 — AGENTS.md I5).
  const { facts } = await fetchPlatformFactsPartial()
  return (
    <>
      <BandStack vp={data['1440']} subst={substFor(data['1440'], facts)} />
      <BandStack vp={data['375']} subst={substFor(data['375'], facts)} />
    </>
  )
}
