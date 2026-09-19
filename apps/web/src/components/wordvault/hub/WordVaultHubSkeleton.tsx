// apps/web/src/components/wordvault/hub/WordVaultHubSkeleton.tsx
//
// **허브가 오는 동안 자리를 잡아 두는 판.**
//
// ── 왜 필요한가 (실측 2026-09-06) ──────────────────────────────────────
// 허브의 조회를 서버로 모으면서(`lib/wordvault/hub-query.ts`) 브라우저 왕복은 사라졌지만,
// 페이지가 **두 조회를 모두 기다린 뒤에야** 첫 픽셀을 냈다. 콜드 진입에서 본문이 나타나기까지
// **2,831ms** — 그동안 학습자는 흰 화면을 본다(`/dashboard` 1,722 · `/hub` 1,125 · `/text` 755).
// 요청 수를 줄인 대가를 **대기 화면**으로 지불한 셈이라, 셸을 먼저 칠하고 내용만 흘려보낸다.
//
// ── 무엇을 그리나 ──────────────────────────────────────────────────────
// 실제 허브의 큰 덩이(정체 카드 · 레벨 지도 · 자산 · 추천)와 **같은 자리·같은 높이**를 잡는다.
// 자리가 다르면 내용이 도착하는 순간 화면이 튀고, 그 튐은 학습자에게 "다시 로딩됐다" 로 읽힌다.
//
// ⚠️ 모션은 **끝나는 상태가 있는** 로더만이다(CLAUDE.md 모션 예산 — 로더·스켈레톤은 허용,
//    장식적 상시 모션은 금지). `motion-reduce` 에서는 맥동을 멈추고 면만 남긴다 —
//    끄는 것이 아니라 낮추는 것이다.

const BLOCK = 'rounded-ios-2xl bg-[var(--bg3)] motion-safe:animate-pulse motion-reduce:animate-none'

export function WordVaultHubSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-4 py-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">단어장을 불러오는 중입니다.</span>
      {/* 정체 카드 — 실제로 가장 큰 덩이다 */}
      <div className={`${BLOCK} h-[168px]`} aria-hidden />
      {/* 레벨 지도 */}
      <div className={`${BLOCK} h-[132px]`} aria-hidden />
      {/* 자산 · 추천 · 다음 한 걸음 */}
      <div className={`${BLOCK} h-[96px]`} aria-hidden />
      <div className={`${BLOCK} h-[96px]`} aria-hidden />
    </div>
  )
}
