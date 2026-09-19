// apps/web/src/app/admin/csat/__tests__/density-scan.ts
//
// **화면 밀집도 자**(측정기만 — 판정은 `density.test.tsx` 가 한다).
//
// ⚠️ 이 파일이 `.test.tsx` 에서 갈라져 나온 이유: 다른 회귀가 `measure` 를 쓰려고
//   `density.test` 를 import 하면 **그 파일의 스위트가 통째로 다시 돈다** — 같은 단언이
//   두 번 세어져 실패 개수가 부풀고, 어느 파일이 실제로 깨졌는지 읽기 어려워진다.
//   저장소가 이미 쓰는 짝(`touch-target-scan.ts` ↔ `touch-target.test.ts`)과 같은 모양이다.

export interface Density {
  chunks: number
  chars: number
  actions: number
  svg: number
}

/**
 * 렌더 결과의 밀집도. 주석(`<!-- -->`)과 태그를 걷어낸 뒤 센다.
 *
 * ⚠️ **접힌 것은 세지 않는다.** `<details>` 안쪽은 열기 전까지 화면에 없으므로, 그것까지 세면
 *   「깊이를 접었다」는 개선이 오히려 나빠진 것으로 잡힌다(실측: 기획 화면의 근거 서술을 접었더니
 *   글자 수가 1,254 → 1,276 으로 **올라갔다**). 여는 손잡이(`<summary>`)는 보이므로 남긴다.
 */
export function measure(html: string): Density {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    // <details> … </details> 안에서 <summary>…</summary> 만 남긴다
    .replace(/<details\b[^>]*>([\s\S]*?)<\/details>/g, (_m, body: string) => {
      const summary = body.match(/<summary\b[\s\S]*?<\/summary>/)
      return summary ? summary[0] : ''
    })
  const text = clean
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const count = (re: RegExp) => (clean.match(re) || []).length
  return {
    chunks: count(/<(div|section|article|p|span|li|tr|td|th|h[1-6]|code|details|summary)\b/g),
    chars: text.length,
    actions: count(/<(button|a|input|select|summary)\b/g),
    svg: count(/<svg\b/g),
  }
}
