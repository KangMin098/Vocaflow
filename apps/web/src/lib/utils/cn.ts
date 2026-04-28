// apps/web/src/lib/utils/cn.ts
// Vocaflow 공통 className 유틸
// CLAUDE.md v06.2 — 모든 컴포넌트에서 표준으로 사용
// ─────────────────────────────────────────────
// clsx: 조건부 className 병합
// tailwind-merge: Tailwind 클래스 충돌 자동 해결
//
// 사용 예시:
//   cn("px-4 py-2", isLarge && "text-lg", className)
//   cn("bg-bg2", "bg-bg")  → "bg-bg" (뒤가 우선)

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
