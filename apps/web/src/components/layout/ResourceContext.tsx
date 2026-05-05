// apps/web/src/components/layout/ResourceContext.tsx
//
// 세션 페이지 진입 시 SessionFrame 셸에 리소스 컨텍스트(+옵션 진행도)만 주입하는 side-effect 컴포넌트.
// Server Component 페이지에서 client hook 을 직접 못 쓰므로 wrapper 로 사용:
//
//   export default function FlashcardPlayPage() {
//     return (
//       <>
//         <ResourceContext resource={{ type: 'vocab', label: 'The Great Gatsby' }} />
//         <FlashcardSession ... />
//       </>
//     )
//   }
//
// UI 렌더 X — 단지 useEffect 로 setProgress 호출.
// 동적 진행도는 세션 컴포넌트가 useSessionProgress() 직접 호출하여 덮어쓰면 됨.

'use client'

import { useEffect } from 'react'

import { useSessionProgress, type SessionResource } from './SessionFrame'

interface ResourceContextProps {
  resource: SessionResource
  current?: number
  total?: number
  /** 직접 라벨 — current/total 보다 우선 */
  label?: string
}

export function ResourceContext({ resource, current, total, label }: ResourceContextProps) {
  const { setProgress } = useSessionProgress()
  useEffect(() => {
    setProgress({ resource, current, total, label })
    return () => setProgress(null)
  }, [setProgress, resource, current, total, label])
  return null
}
