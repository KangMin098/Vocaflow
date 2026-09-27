// apps/web/src/app/not-found.tsx
//
// 404 — 참조 사이트 404 골격(DD-68 · tines-mapping §2 · §14): 공통 헤더 · **가운데 소품 하나**(참조 UFO 자리 — 빛줄기에 떠오르는 책, Kaggle 생성) ·
// 세리프 제목 · 출구 알약 둘 · 공통 푸터.
// 루트 not-found 라 레이아웃 그룹 밖이다 — 공통 헤더·푸터를 직접 얹는다.

import { SiteFooter } from '@/components/marketing/site/SiteFooter'
import { SiteHeader } from '@/components/marketing/site/SiteHeader'
import { SpotState } from '@/components/ui/SpotState'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <SiteHeader />
      {/* ⚠️ 1차 출구는 반드시 **공개** 라우트다.
          예전엔 유일한 버튼이 `/hub`(PROTECTED_PREFIXES 첫 줄)라, 깨진 공유 링크로 온
          익명 방문자가 404 에서 곧장 로그인 폼으로 튕겼다 — 가입 의사가 없던 사람에게
          아무 설명 없이 로그인 벽을 세우는 길이었다. `/` 는 인증 여부와 무관하게 열리고,
          로그인 상태면 미들웨어가 `/hub` 로 보내 준다(한 줄로 두 경우를 다 만족). */}
      <main className="flex flex-1 items-center justify-center px-4 py-20 lg:py-28">
        <SpotState
          art="lost"
          size="lg"
          title="페이지를 찾을 수 없어요."
          body="주소가 잘렸거나 바뀐 것 같아요. 아래에서 다시 시작할 수 있어요."
          primary={{ href: '/', label: '처음 화면으로' }}
          secondary={{ href: '/fit', label: '지문 진단 해보기' }}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
