// apps/web/src/lib/learner/activity-icons.ts
//
// 계획 활동/자료 아이콘 단일 출처 — plan-activities.ts 의 ActivityDef.icon 문자열과 1:1.
// /plan(PlanClient) 과 /hub(TodayPlanCard) 가 공유 — 한쪽만 갱신돼 아이콘이 어긋나는
// 복제 맵 드리프트를 차단한다. RSC/클라이언트 양쪽에서 import 가능(상태 없음).

import {
  BookMarked,
  BookOpen,
  FileText,
  Grid2x2,
  Hammer,
  Headphones,
  HelpCircle,
  Layers,
  Mic2,
  Newspaper,
  PencilLine,
  WholeWord,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { MaterialType } from './plan-activities'

/** ActivityDef.icon(문자열) → lucide 컴포넌트. 활동당 유일 아이콘. */
export const ACTIVITY_ICON: Record<string, LucideIcon> = {
  Headphones, // listen 듣기
  BookOpen, // read 읽기
  Mic2, // echo 따라하기
  WholeWord, // vocab 단어
  Layers, // flashcard
  Zap, // wordblitz
  Grid2x2, // pairflip
  Hammer, // spellforge
  HelpCircle, // scriptquiz
  PencilLine, // dictation
}

/** 자료 유형 글리프 */
export const MATERIAL_ICON: Record<MaterialType, LucideIcon> = {
  book: BookMarked,
  article: Newspaper,
  word_set: Layers,
  script: FileText,
}
