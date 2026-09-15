// apps/web/src/app/(main)/csat/layout.tsx
//
// **기출 분석 껍데기 — 7단계 레일 하나뿐이다.**
//
// 이 자리에 제목을 또 넣지 않는다. 각 화면이 자기 `h1` 을 갖고 있고, 껍데기가 제목을 얹으면
// 화면마다 제목이 둘이 된다(교재 공장에서 같은 실수를 이미 걷어냈다 —
// `app/admin/csat/layout.tsx` 머리말).
//
// 레일은 **어디로 갈까**만 답한다. **지금 어떤가**는 각 화면이 자기 데이터로 답한다.

import { CsatSteps } from '@/components/csat/CsatSteps'

export default function CsatLayout({ children }: { children: React.ReactNode }) {
  return (
    // ⚠️ **바깥 여백은 여기 한 곳에서만 준다.** 화면 다섯이 저마다 `px-4 py-6` 을 갖고
    //   있었는데, 껍데기가 생기면 그게 이중 여백이 된다. 각 화면은 이제 **자기 읽기 폭
    //   (`max-w-*`)만** 들고 여백은 안 든다. 폭이 화면마다 다른 것은 의도다 —
    //   오버레이는 PDF 를 놓아야 하고(6xl) 해설은 줄 길이를 지켜야 한다(3xl).
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <CsatSteps />
      <div className="mt-5">{children}</div>
    </div>
  )
}
