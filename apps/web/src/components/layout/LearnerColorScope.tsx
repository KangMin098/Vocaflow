// apps/web/src/components/layout/LearnerColorScope.tsx
'use client'

import { usePathname } from 'next/navigation'
import { getLearnerColorRole, getLearnerPalette } from '@/lib/design/learner-palette'

/** Route changes also remove the marker, so body portals cannot retain learner colors on 3B routes. */
export function usesLearnerColors(pathname: string | null): boolean {
  return getLearnerPalette(pathname) !== null
}

export function LearnerColorScope() {
  const pathname = usePathname()
  const role = getLearnerColorRole(pathname)
  return role ? <span hidden aria-hidden="true" data-learner-pc-color="tines" data-learner-pc-palette={role.palette} data-learner-pc-mode={pathname?.startsWith('/play/') ? 'game' : 'page'} data-learner-pc-group={role.group} data-learner-pc-cadence={role.cadence} data-learner-pc-attention={role.attention} data-learner-pc-priority={role.priority} /> : null
}
