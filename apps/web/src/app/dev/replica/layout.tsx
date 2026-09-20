// apps/web/src/app/dev/replica/layout.tsx
//
// **배포 차단 가드.** 이 아래 화면은 참조 사이트의 판면을 그대로 재현한 **내부 측정용 복제**다(DD-62 Stage 2).
// 제품 화면이 아니고, 남의 판면이 우리 도메인에서 서빙되어서도 안 된다. 그래서 두 겹으로 막는다:
//   ① 프로덕션 빌드에서는 notFound() — `REPLICA_ROUTES=on` 을 명시적으로 켠 경우에만 열린다(로컬 검증용).
//   ② robots: noindex, nofollow (`/dev` 는 robots.ts 의 NOINDEX_PUBLIC 에도 들어 있다).
//
// Stage 3 에서 색·서체·소재·문구를 우리 것으로 치환한 `ours-*` 가 이 옆에 서고, Stage 4 의 실제 라우트는
// 그 `ours-*` 를 템플릿으로 삼는다. **이 복제 자체는 어떤 제품 화면에도 import 되지 않는다.**

import { notFound } from 'next/navigation'

import './replica.css'

export const metadata = {
  title: 'replica (dev)',
  robots: { index: false, follow: false },
}

export default function ReplicaLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.REPLICA_ROUTES !== 'on') notFound()
  return <div className="replica-root">{children}</div>
}
