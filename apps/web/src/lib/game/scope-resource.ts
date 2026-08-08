// apps/web/src/lib/game/scope-resource.ts
//
// 스코프 → 세션 셸 브레드크럼(SessionResource) 매핑.
// "지금 무슨 단어로 놀고 있는지"가 한 줄로 보여야 한다 — 특히 맛보기(기록 안 됨)를
// 기록되는 플레이로 오인하지 않도록. 스캐폴드/독립 3D 페이지 공용.

import type { SessionResource } from '@/components/layout/SessionFrame'
import type { WordScope } from '@/lib/game/use-word-scope'

export function gameResourceContext(scope: WordScope): SessionResource {
  if (scope.demo) {
    return {
      type: 'custom',
      label: '맛보기 단어',
      position: '내 단어장이 채워지면 내 단어로 바뀌어요',
      href: '/wordvault',
    }
  }
  if (scope.kind === 'explicit') {
    return { type: 'vocab', label: scope.title, position: scope.subtitle, href: '/text' }
  }
  if (scope.kind === 'mine') {
    return { type: 'vocab', label: scope.title, position: scope.subtitle, href: '/wordvault' }
  }
  return { type: 'library', label: scope.title, position: scope.subtitle, href: '/arcade' }
}
