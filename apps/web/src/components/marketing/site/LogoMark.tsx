// apps/web/src/components/marketing/site/LogoMark.tsx
// 참조 사이트의 원형 워드마크 자리(DD-68) — 우리 이름 첫 글자를 같은 선 굵기로. 서버·클라이언트 어디서나 쓴다.

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden className="text-[var(--ju)]">
      <circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M8.5 9.5 15 21l6.5-11.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
