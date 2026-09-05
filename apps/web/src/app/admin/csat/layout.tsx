// apps/web/src/app/admin/csat/layout.tsx
//
// **교재 공장 껍데기** — 제목 한 줄뿐이다.
//
// ── 왜 레일을 걷어냈나 (2026-09-05) ──────────────────────────────────
// 여기에는 공정 8칸을 가로로 편 「레일」이 있었다. 그런데 같은 8칸이 **세 군데**에 그려지고 있었다 —
// 좌측 사이드바 하위 메뉴(레인별로 묶임) · 이 레일 · 현황판의 라인 도식. 셋 다 같은 곳으로 가는
// 같은 링크라, 화면을 열면 눈이 같은 목록을 세 번 훑는다. 그게 「복잡하다」의 큰 몫이었다.
//
// 남긴 것은 하나씩이다:
//   · **어디로 갈까** → 좌측 사이드바(들어오면 ①~⑧ 이 레인별로 펼쳐진다)
//   · **지금 어떤가** → 현황판의 라인 도식(상태·병목이 색+모양으로 붙는다)
//
// 제목도 줄였다. 예전에는 "기획 → 설계 → 소재 → …" 공정 순서를 여기에 글로 적었는데,
// 그 순서는 이제 사이드바와 도식이 **보여 준다**. 같은 말을 글로 또 적을 이유가 없다.

import Link from 'next/link'

export default function AdminCsatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* `<h1>` 로 감싼다 — 이 자리가 `<Link>` 뿐이라 공정 화면 7개는 **h1 이 아예 없었고**
          첫 제목이 h2 였다. 스크린리더로 들어오면 "이 페이지가 무엇인지" 를 말하는 줄이
          하나도 없이 본문 소제목부터 읽힌다. 각 공정 화면의 제목은 h2 로 그대로 둔다. */}
      <h1 className="w-fit">
        <Link
          href="/admin/csat"
          className="font-display text-[22px] font-[800] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
        >
          교재 공장
        </Link>
      </h1>
      {children}
    </div>
  )
}
