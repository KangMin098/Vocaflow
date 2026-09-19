// apps/web/src/app/admin/kice/layout.tsx
//
// **기출 분석 뷰 껍데기** — 여백만 준다.
//
// 이 밑의 화면(허브·유형·문항·지형·사정권·계획)은 2026-09-17 까지 학습자 `/csat` 밑에 있었다.
// 학습자 쪽이 「오늘의 세션」 루프 하나로 바뀌면서(docs/csat-learner-brief.md) 분석을 **읽는 화면**은
// 관리자 몫이 됐다. 제목은 각 화면이 `h1` 으로 갖고 있어 여기서 또 얹지 않는다(두 개가 된다).

export default function AdminKiceLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
}
