// apps/web/scripts/server-only-stub.ts
//
// **`server-only` 를 스크립트에서만 무력화한다.**
//
// 왜 필요한가: `server-only` 는 "이 모듈이 클라이언트 번들에 섞였는가" 를 막는 가드다.
// Next 밖에서 도는 Node 스크립트에는 클라이언트 번들이라는 것이 아예 없으므로 그 가드가
// 지킬 대상이 없는데, 패키지는 RSC 조건(`react-server`)이 없으면 **무조건 throw** 한다.
//
// 왜 `--conditions=react-server` 로 풀지 않았나 (실측 2026-09-12):
//   그 조건을 켜면 `react` 가 `react.shared-subset` 으로 갈리고, 같은 스크립트가 함께 읽는
//   `lib/game/catalog.tsx`(JSX 아이콘)가 거기서 죽는다. 한쪽을 살리면 다른 쪽이 죽는다.
//   그래서 **가드 모듈 하나만** 바꾼다 — 영향 범위가 가장 좁은 수다.
//
// ⚠️ 이 별칭은 `scripts/tsconfig.script.json` 안에서만 걸린다. 앱 빌드는 진짜 `server-only`
//   를 그대로 쓰므로 가드가 살아 있다.
export {}
