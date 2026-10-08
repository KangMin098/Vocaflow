// apps/web/src/components/csat/diagnosis/map/icons.ts
//
// 학습 지도 아이콘 — 핵심 축(V/S/R/E/L/X)과 학습 단계마다 하나. 문구 앞 아이콘은 필수(2026-10-07).

import { BookA, Headphones, Layers3, Link2, Map as MapIcon, Scale, ScanText, SearchCheck, Timer, type LucideIcon } from 'lucide-react'

import type { CoreCode } from '@/lib/csat/map/core'
import type { StepKey } from '@/lib/csat/map/learner-path'

export const AXIS_ICON: Record<CoreCode, LucideIcon> = {
  V: BookA,
  S: ScanText,
  R: MapIcon,
  E: Scale,
  L: Headphones,
  X: Timer,
}

export const STEP_ICON: Record<StepKey, LucideIcon> = {
  vocab: BookA,
  sentence: ScanText,
  relation: Link2,
  structure: Layers3,
  option: Scale,
  evidence: SearchCheck,
  integrate: Timer,
  'l-sound': Headphones,
  'l-sentence': ScanText,
  'l-retain': Layers3,
  'l-respond': SearchCheck,
}
