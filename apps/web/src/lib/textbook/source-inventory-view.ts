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
  /** 이 원천에 **다음에 돌릴 명령** — 화면은 복사 버튼으로만 낸다(조작 금지). */
  nextCommand: string
  /** 그 명령을 왜 돌리는지 한 줄. */
  nextWhy: string
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

/**
 * 다음에 돌릴 명령 — **원천의 상태가 정한다.**
 *
 * 순서가 곧 처방의 우선순위다. 위에서 걸리면 아래는 묻지 않는다:
 *   ① 판정이 하나도 없다     → 게이트 드레인을 뽑는 것이 먼저다
 *   ② 학령 분석이 덜 붙었다  → 분석이 붙어야 조판 풀에 들어온다
 *   ③ 미절단 원본이 많다     → 발췌 경로로 가야 판정이 붙는다
 *   ④ 그 밖                  → 재고를 다시 세는 것 말고 할 일이 없다
 */
function prescribe(r: SourceRowJson): { nextCommand: string; nextWhy: string } {
  if (r.judged === 0 && r.total > 0) {
    return {
      nextCommand: `pnpm dlx tsx scripts/csat/gate-article-export.mjs --write --max 10`,
      nextWhy: '판정이 한 편도 없다 — 내용 판정을 받기 전에는 조판 풀에 못 들어온다',
    }
  }
  if (r.levelled < r.total) {
    return {
      nextCommand: `pnpm dlx tsx scripts/acp/process-queue.mjs --commit`,
      nextWhy: `학령 분석이 ${(r.total - r.levelled).toLocaleString()}편 비었다 — 분석이 붙어야 조판 풀에 들어온다`,
    }
  }
  if (r.rawPurpose > 0) {
    return {
      nextCommand: `pnpm dlx tsx scripts/acp/process-queue.mjs --feed plos-extract --commit --limit 500`,
      nextWhy: `미절단 원본 ${r.rawPurpose.toLocaleString()}편 — 게이트를 돌려도 판정이 안 붙는다`,
    }
  }
  return {
    nextCommand: 'pnpm dlx tsx scripts/textbook/source-inventory-scan.mjs',
    nextWhy: '막힌 축이 없다 — 재고를 다시 세는 것 말고 할 일이 없다',
  }
}

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
    const { nextCommand, nextWhy } = prescribe(r)
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
      nextCommand,
      nextWhy,
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
