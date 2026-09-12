// apps/web/src/app/(main)/my/texts/page.tsx
//
// ADR 0006 D4 — 폐지. `/text` 로 보낸다.
//
// 이 라우트는 `/text` 와 **동작이 같았다**(둘 다 `<Screen><TextHubContent /></Screen>`).
// 같은 것을 두 이름으로 부른 자리이기도 하다 — `axes.ts` NAME_DECISIONS 가
// "TextVault" 를 retire 로 지정했고 정식명은 **Texts**(`/text`)다.

import { redirect } from 'next/navigation'

export default function MyTextsPage(): never {
  redirect('/text')
}
