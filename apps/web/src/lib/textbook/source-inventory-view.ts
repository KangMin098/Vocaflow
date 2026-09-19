// apps/web/src/lib/textbook/source-inventory-view.ts
//
// **소스별 원문 관리 뷰가 읽는 것** — 「무엇을 언제 몇 편 GET 했고 지금 어떤 상태인가」.
//
// ── 왜 적격 스냅샷과 따로인가 ───────────────────────────────────────
// 적격 스냅샷(`source-eligibility-snapshot.json`)은 **판정 결과**다 — 본문을 읽어야 하므로
// 스캔이 76~200초 걸리고, 그래서 자주 못 돌린다. 관리 뷰가 묻는 것은 다른 질문이다:
// 「이 원천에서 언제 마지막으로 받았나 · 지금 몇 편이 검토 대기인가」. 그건 본문 없이
// 답할 수 있고 실측 **9초**다. 둘을 한 스캔에 묶으면 빠른 질문이 느린 스캔에 발이 묶인다.
//
// ── 판정 수를 여기서 다시 세지 않는다 ───────────────────────────────
// 「조판 가능/탈락」의 정본은 적격 스냅샷이다. 이 모듈이 세는 것은 **판정을 받았는가**
// (`csat_fit.gate.verdict` 유무)까지고, 그 너머는 적격 쪽 수를 쓴다.
// 사본을 두면 같은 화면의 두 표가 다른 답을 하는 날이 온다.

import inventory from './source-inventory-snapshot.json'
import { SOURCE_LABEL } from '@/lib/articles/source-guide'

/** 스냅샷 한 원천 — 스캐너가 찍은 모양 그대로. */
interface SourceRowJson {
  source: string
  total: number
  byStatus: Record<string, number>
  judged: number
  rawPurpose: number
  levelled: number
  legalBlocked: number
  firstGet: string | null
  lastGet: string | null
  byVLevel: Record<string, number>
  topBlocked: { reason: string; count: number }[]
}

export interface SourceInventoryRow {
  source: string
  /** 사람이 읽는 이름 — 정본은 `SOURCE_LABEL` 하나뿐이다. */
  label: string
  total: number
  ready: number
  published: number
  /** 그 밖의 상태 합 (보관·실패·큐 등) — 칸을 늘리지 않고 한 덩이로 묶는다. */
  other: number
  /** 상태별 원시 분포 — 툴팁이 쓴다. */
  byStatus: { status: string; count: number }[]
  judged: number
  judgedPct: number
  levelled: number
  levelledPct: number
  legalBlocked: number
  rawPurpose: number
  topBlocked: { reason: string; count: number }[]
  lastGet: string | null
  /** 마지막 GET 으로부터 지난 날수. `null` = 시각이 없다. */
  staleDays: number | null
}

export interface SourceInventoryPanel {
  measuredAt: string
  ageDays: number
  elapsedSeconds: number
  scope: string
  scanned: number
  rows: SourceInventoryRow[]
  /** 이 스냅샷을 다시 찍는 명령. */
  refreshCommand: string
}

/** 상태를 세 칸으로 접는다 — 관리자가 보는 결정은 「검토할 게 있나 / 나갔나 / 나머지」다. */
const READY = 'ready'
const PUBLISHED = 'published'

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0)

export function buildSourceInventoryPanel(now: Date = new Date()): SourceInventoryPanel {
  const snap = inventory as unknown as {
    measuredAt: string
    elapsedSeconds: number
    scope: string
    scanned: number
    sources: SourceRowJson[]
  }

  const measured = new Date(snap.measuredAt)
  const ageDays = Math.max(0, Math.floor((now.getTime() - measured.getTime()) / 86_400_000))

  const rows: SourceInventoryRow[] = snap.sources.map((r) => {
    const ready = r.byStatus[READY] ?? 0
    const published = r.byStatus[PUBLISHED] ?? 0
    return {
      source: r.source,
      label: SOURCE_LABEL[r.source] ?? r.source,
      total: r.total,
      ready,
      published,
      other: r.total - ready - published,
      byStatus: Object.entries(r.byStatus)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      judged: r.judged,
      judgedPct: pct(r.judged, r.total),
      levelled: r.levelled,
      levelledPct: pct(r.levelled, r.total),
      legalBlocked: r.legalBlocked,
      rawPurpose: r.rawPurpose,
      topBlocked: r.topBlocked ?? [],
      lastGet: r.lastGet,
      staleDays: r.lastGet
        ? Math.max(0, Math.floor((now.getTime() - new Date(r.lastGet).getTime()) / 86_400_000))
        : null,
    }
  })

  return {
    measuredAt: snap.measuredAt,
    ageDays,
    elapsedSeconds: snap.elapsedSeconds,
    scope: snap.scope,
    scanned: snap.scanned,
    rows,
    refreshCommand: 'pnpm dlx tsx scripts/textbook/source-inventory-scan.mjs',
  }
}
