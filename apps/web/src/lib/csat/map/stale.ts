// apps/web/src/lib/csat/map/stale.ts
// 저장된 진단 스냅샷의 지도 지표를 그대로 쓸 수 있는가(2026-10-08 · Codex P1) — load.ts 가 아니면 다시 계산한다.
import { ENGINE_VERSION } from '../diagnosis/engine/rule-v1'

/** 저장된 스냅샷의 지도 지표를 다시 계산해야 하는가 — 버전 · 상태 · 완전성(den) 중 하나라도 어긋나면 true */
export function staleMapEvidence(s: { engineVersion: string; evidence?: { mapStatus?: string; lineAccuracy?: Record<string, { status: string; den?: number }>; attributePoints?: Record<string, { status: string; den?: number }> } | null }): boolean {
  if (s.engineVersion !== ENGINE_VERSION) return true
  const ev = s.evidence
  if (!ev || ev.mapStatus !== 'ok') return true
  const stats = [...Object.values(ev.lineAccuracy ?? {}), ...Object.values(ev.attributePoints ?? {})]
  return stats.some((v) => v.status === 'ok' && typeof v.den !== 'number')
}
