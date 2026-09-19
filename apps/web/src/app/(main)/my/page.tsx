// apps/web/src/app/(main)/my/page.tsx
//
// ADR 0006 D4 — `/my` 탭 세트(TextVault·WordVault·BookVault)는 폐지했다.
// 셋 중 둘이 다른 표면의 중복이었고(`/text`·`/wordvault`), 남은 하나(`/my/books`)는
// 단독 화면으로 선다. 진입은 정식명 표면인 `/text` 로 보낸다.

import { redirect } from 'next/navigation'

export default function MyIndexPage(): never {
  redirect('/text')
}
