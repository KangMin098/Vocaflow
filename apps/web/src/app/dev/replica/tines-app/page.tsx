// apps/web/src/app/dev/replica/tines-app/page.tsx
//
// 참조 **앱 UI 골격**의 구조 복제(DD-62 Stage 2 · 내부 측정용 · 배포 차단은 ../layout.tsx).
// 값은 `scripts/design/extract-app.mjs` 가 잰 app-measured.json 에서만 온다 — 여기에 수치를 적지 않는다.
//
// 그리는 것: 상단 바 · 좌측 아이콘 레일 · 좌측 목록 패널 · 중앙 캔버스(점 격자) · 우측 인스펙터.
// 노드는 회색 사각형이다(Stage 3 `ours-app` 에서 우리 자산으로 바뀐다).
//
// 완료 기준: 참조 캡처와 나란히 놓았을 때 상자 위치 ±8px (`node scripts/design/replica-diff.mjs --app`).

import { AppFrame } from '../AppFrame'

export const dynamic = 'force-dynamic'

export default function TinesAppReplica() {
  return (
    <>
      <AppFrame vpKey="1440" />
      <AppFrame vpKey="375" />
    </>
  )
}
