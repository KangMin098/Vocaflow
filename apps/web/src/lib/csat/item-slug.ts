// apps/web/src/lib/csat/item-slug.ts
//
// **문항 id ↔ URL 슬러그. 한 줄짜리지만 한 곳에 있어야 한다.**
//
// 원장의 문항 id 는 `2026#31` 인데 `#` 는 주소가 못 된다(브라우저가 프래그먼트로 읽는다).
// 그래서 `-` 로 바꾼다.
//
// ── 왜 따로 파일인가 (실측 2026-09-15) ────────────────────────────────
// ① **같은 함수가 두 곳에 따로 있었다** — `learner.ts:351` 과 `overlay.ts:135`.
//    둘이 갈라지면 한쪽 링크가 조용히 404 가 된다. 그리고 갈라진 것을 알 방법이 없다.
// ② **한 줄 때문에 서버 모듈이 딸려 왔다** — `components/csat/ReportText.tsx` 가
//    `toItemSlug` 하나를 쓰려고 `learner.ts` 를 import 했고, 그게 `lib/supabase/server` 를
//    끌고 왔다. Next 안에서는 티가 안 나지만, 그 컴포넌트를 서버 밖에서 렌더하려는 순간
//    터진다(접근성 하네스가 바로 그렇게 터졌다). 클라이언트 컴포넌트로 바꿔도 같은 일이 난다.
//
// 그러므로 이 파일은 **아무것도 import 하지 않는다.** 그게 요점이다.

/** `2026#31` → `2026-31`. URL 에 쓰는 형태. */
export function toItemSlug(itemId: string): string {
  return itemId.replace('#', '-')
}

/**
 * `2026-31` → `2026#31`. **첫 `-` 만** 바꾼다 — 회차 id 에는 `-` 가 없고(`2014A`·`M2309`),
 * 문항 번호는 숫자뿐이라 첫 것이 언제나 구분자다.
 */
export function fromItemSlug(slug: string): string {
  return slug.replace('-', '#')
}
