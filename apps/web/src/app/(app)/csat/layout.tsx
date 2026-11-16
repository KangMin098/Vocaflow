// apps/web/src/app/(app)/csat/layout.tsx
// Server-rendered scope also supplies CSAT tokens to dialogs portaled into document.body.
export default function CsatLayout({ children }: { children: React.ReactNode }) {
  return <div data-design-scope="csat">{children}</div>
}
