// apps/web/src/app/(app)/csat/layout.tsx
// SSR 표식으로 /csat 및 하위 화면과 body 포털에 같은 3B 토큰을 적용한다.

export default function CsatAppLayout({ children }: { children: React.ReactNode }) {
  return <div data-design-scope="csat">{children}</div>
}
