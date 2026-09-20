// apps/web/src/app/dev/replica/ours-app/page.tsx
//
// `tines-app` 과 **같은 렌더러 · 같은 측정값**에 치환을 얹은 앱 골격(DD-62 Stage 3).
// 구조·수치 변경 0 — 창 크기 · 상단바 높이 · 레일/패널 폭 · 캔버스 · 인스펙터 자리는 실측 그대로다.
//
// 네 가지 중 이 화면에서 실제로 바뀌는 것은 **둘**이다. 없는 것을 있다고 적지 않는다:
//   ① 색   — 캔버스 면 · 카드 면 · 테두리 · 점 격자 → 우리 토큰(점 격자는 `--grid-line`, 03-system 「원고지」와 같은 자리)
//   ③ 그림 — 노드(캔버스 위 카드) → 골든 삽화
//   ② 서체 · ④ 문구 — **해당 없음**. 이 골격에는 글자 자리가 없다(측정값에 글자 크기는 있지만
//      복제는 상자만 그린다). 글자는 Stage 4 에서 실제 데이터가 들어올 때 처음 선다.

import { AppFrame, appNodeSlots } from '../AppFrame'
import type { AppSubst } from '../AppFrame'
import { colorFn, planMedia } from '../ours'

export const dynamic = 'force-dynamic'

function substFor(vpKey: string): AppSubst {
  return {
    color: colorFn(),
    media: planMedia(appNodeSlots(vpKey)),
  }
}

export default function OursAppReplica() {
  return (
    <>
      <AppFrame vpKey="1440" subst={substFor('1440')} />
      <AppFrame vpKey="375" subst={substFor('375')} />
    </>
  )
}
