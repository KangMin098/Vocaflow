// apps/web/src/app/admin/vrl/_components/QuickActionsSection.tsx
//
// Section 8-B — Quick Actions.
//
// 5 actions:
//   QA1 ⚡ R7 분류 navigate (→ /admin/vrl/concerns 또는 별 세션 안내)
//   QA2 🔧 cefr_confidence SQL preview (collapsible)
//   QA3 📋 Tier 2 Migration SQL preview (collapsible)
//   QA4 🚨 VCB-VRL navigate (→ /admin/vocab)
//   QA5 🔄 새로고침 (router.refresh — client side)
//
// ⚠️ 2026-09-05 — QA1 은 `L4 1,030 row 잔여`, QA4 는 `R3 35→75+` 를 **상수로** 적고 있었다.
//   같은 1,030 이 RoundHistorySection 의 ROADMAP 에도 복사돼 있어 한쪽만 고치면 두 화면이
//   서로 다른 말을 한다. 지금은 둘 다 page.tsx 가 이미 들고 있는 snapshot 에서 파생된다 —
//   근거 없는 수치는 아예 받지 않는다(prop 이 없으면 수치 없는 문구로 떨어진다).

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'

const CEFR_CONFIDENCE_SQL = `-- D1 — cefr_confidence 백필 (P0 결함)
--
-- 전략 1: list_tags + ngsl_sfi 기반 단일값 시드
-- 전략 2: list_tags 다중 cover 수에 따른 동적 confidence
--
-- 아래는 전략 1 — 모든 row 에 1.0 시드 (단일 cover) → 운영 후 정교화.

UPDATE public.shared_dictionary
SET cefr_confidence = CASE
    WHEN array_length(list_tags, 1) >= 4 THEN 0.40  -- multi-list 과대 cover
    WHEN array_length(list_tags, 1) >= 3 THEN 0.55
    WHEN array_length(list_tags, 1) >= 2 THEN 0.75
    WHEN array_length(list_tags, 1) = 1 THEN 0.85
    ELSE 1.00
END
WHERE cefr_confidence IS NULL
  AND cefr_level IS NOT NULL;

-- 검증
SELECT COUNT(*) FILTER (WHERE cefr_confidence IS NOT NULL) AS backfilled,
       COUNT(*) AS total
FROM public.shared_dictionary;`

const TIER2_MIGRATION_SQL = `-- M2 — Schema Evolution Tier 2 — Korean Learner Specific
--
-- ALTER TABLE ADD COLUMN IF NOT EXISTS (idempotent).
-- Migration apply 후 schema-presence-static.ts 동기화 필수.

ALTER TABLE public.shared_dictionary
  ADD COLUMN IF NOT EXISTS common_errors_ko TEXT[],
  ADD COLUMN IF NOT EXISTS usage_warning_ko TEXT,
  ADD COLUMN IF NOT EXISTS konglish_alert BOOLEAN;

COMMENT ON COLUMN public.shared_dictionary.common_errors_ko IS
  '한국 학습자 빈번 실수 사례 (e.g., "fun" 명사로 오용)';
COMMENT ON COLUMN public.shared_dictionary.usage_warning_ko IS
  '사용 주의사항 (지역 차이, register, 민감 어휘 등)';
COMMENT ON COLUMN public.shared_dictionary.konglish_alert IS
  'Konglish 단어 플래그 (handphone/officetel 등)';

-- 인덱스 — konglish_alert 검색 (Phase 2C 활용)
CREATE INDEX IF NOT EXISTS idx_shared_dictionary_konglish
  ON public.shared_dictionary (word)
  WHERE konglish_alert = true;

-- 검증
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shared_dictionary'
      AND column_name='konglish_alert'
  ) THEN
    RAISE EXCEPTION 'Tier 2 migration incomplete';
  END IF;
  RAISE NOTICE 'Tier 2 schema evolution OK — 3 columns + 1 index';
END $$;`

export interface QuickActionsSectionProps {
  /** vrl_data_integrity_concerns 미해결 수 (실측). */
  openConcerns: number
  /** shared_dictionary v_level NULL 행 수 (실측). */
  unclassified: number
  /** R3(공용 단어장 발행) 현재 점수 0~100. 스냅샷에 없으면 null → 수치 없이 그린다. */
  r3Score: number | null
}

export function QuickActionsSection({
  openConcerns,
  unclassified,
  r3Score,
}: QuickActionsSectionProps) {
  const router = useRouter()
  const [showCefrSql, setShowCefrSql] = useState(false)
  const [showTier2Sql, setShowTier2Sql] = useState(false)

  return (
    <section aria-label="Quick Actions" className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
          style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
          aria-hidden
        >
          <Zap size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
            Quick Actions
          </h2>
          <p className="font-body text-[12px] text-[var(--t2)]">
            즉시 시작 가능한 5 액션 (SQL preview · navigate · refresh)
          </p>
        </div>
      </header>

      {/* ── 5 액션 grid ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* QA1 — R7 분류 navigate */}
        <Link
          href="/admin/vrl/concerns"
          className="group flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
        >
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: 'var(--info-light)', color: 'var(--info)' }}
            aria-hidden
          >
            ⚡
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--t1)]">
              QA1 · R7 분류 진행
              <ExternalLink
                size={11}
                strokeWidth={2}
                className="text-[var(--t2)] transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </p>
            <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
              미해결 의심 단어 {openConcerns.toLocaleString()}건 · v_level 미분류{' '}
              {unclassified.toLocaleString()}행
            </p>
          </div>
        </Link>

        {/* QA4 — VCB-VRL navigate (P0 본질 페인) */}
        <Link
          href="/admin/vocab"
          className="group flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--error)]/30 bg-[var(--error-light)] p-3 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
        >
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--error)] text-white"
            aria-hidden
          >
            <AlertTriangle size={15} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--error-ink)]">
              QA4 · VCB-VRL 통합 (B1) — 본질 페인
              <ExternalLink
                size={11}
                strokeWidth={2}
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </p>
            <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
              VCB Pipeline → target_v_level_range 추가
              {r3Score != null ? ` — R3 현재 ${r3Score}점` : ''}
            </p>
          </div>
        </Link>

        {/* QA2 — cefr_confidence SQL preview */}
        <SqlPreviewCard
          icon="🔧"
          title="QA2 · cefr_confidence 백필 SQL (D1)"
          subtitle="P0 — list_tags 기반 단일값 시드 + 동적 보정"
          accentBg="var(--warning-light)"
          accentFg="var(--active)"
          show={showCefrSql}
          onToggle={() => setShowCefrSql((v) => !v)}
          sql={CEFR_CONFIDENCE_SQL}
        />

        {/* QA3 — Tier 2 Migration SQL */}
        <SqlPreviewCard
          icon="📋"
          title="QA3 · Tier 2 Migration SQL (M2)"
          subtitle="P1 best ROI — Korean Learner Specific 3 컬럼"
          accentBg="var(--success-light)"
          accentFg="var(--success)"
          show={showTier2Sql}
          onToggle={() => setShowTier2Sql((v) => !v)}
          sql={TIER2_MIGRATION_SQL}
        />

        {/* QA5 — 새로고침 */}
        <button
          type="button"
          onClick={() => router.refresh()}
          className="group flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-left shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]"
        >
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: 'var(--p-light)', color: 'var(--p)' }}
            aria-hidden
          >
            <RefreshCw
              size={15}
              strokeWidth={2}
              className="transition-transform duration-[var(--dur-slow)] group-active:rotate-180"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[12px] font-[700] text-[var(--t1)]">
              QA5 · Dashboard 새로고침
            </p>
            <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
              revalidate 60s 캐시 무시 — 분류/Migration 즉시 반영
            </p>
          </div>
        </button>
      </div>

      <p className="flex items-center gap-2 font-body text-[10px] text-[var(--t2)]">
        <Sparkles size={10} strokeWidth={2} aria-hidden />
        SQL Preview 는 readonly — apply 전 사용자 confirm 필수 (Supabase MCP 또는 Studio).
      </p>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// SqlPreviewCard — collapsible
// ─────────────────────────────────────────────────────────────

function SqlPreviewCard({
  icon,
  title,
  subtitle,
  accentBg,
  accentFg,
  show,
  onToggle,
  sql,
}: {
  icon: string
  title: string
  subtitle: string
  accentBg: string
  accentFg: string
  show: boolean
  onToggle: () => void
  sql: string
}) {
  return (
    <div className="flex flex-col gap-0 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={show}
        className="flex w-full items-start gap-3 p-3 text-left transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)]"
      >
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)]"
          style={{ backgroundColor: accentBg, color: accentFg }}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--t1)]">
            {title}
            {show ? (
              <ChevronUp size={11} strokeWidth={2} aria-hidden />
            ) : (
              <ChevronDown size={11} strokeWidth={2} aria-hidden />
            )}
          </p>
          <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
            {subtitle}
          </p>
        </div>
      </button>
      {show && (
        <pre
          className="overflow-x-auto border-t border-[var(--bd)] bg-[var(--bg2)] p-3 font-mono text-[10px] leading-snug text-[var(--t2)]"
          aria-label="SQL preview"
        >
          {sql}
        </pre>
      )}
    </div>
  )
}
