// apps/web/src/components/admin/curation/QualityBars.tsx
// LCP v2.0 Phase 12 단계 4 — 소스 카탈로그 평가 점수 시각화
//
// 사용 패턴 (단계 5 SourceCard에서):
//   <QualityBars
//     scores={{
//       text: catalog.quality_text,
//       metadata: catalog.quality_metadata,
//       api: catalog.quality_api,
//       learning: catalog.quality_learning,
//       license: catalog.quality_license,
//       volume: catalog.quality_volume,
//     }}
//     composite={catalog.composite_score}
//     compact={false}
//   />
//
// 설계 의도:
// - 6 평가 차원을 한눈에 비교 (가중치는 composite_score DB 트리거에서 자동 계산)
// - 점수 → 색 그라데이션 (빨/노/초)으로 직관적 식별
// - compact 모드: SourceCard 그리드용 (2열 grid)
// - non-compact 모드: 단독 표시용 (단일 column)
//
// 색 정책:
// - 점수 막대 + 별 색은 categorical color로 #ef4444 / #eab308 / #22c55e 직접 사용.
//   CLAUDE.md §"Colors" 하드코딩 금지 예외 — 점수 자체가 색의 의미라 토큰화 부적절.
//   별 색도 옵션 c 채택 (점수↔별 색 일관성).
//   다크모드에서도 동일 색 (점수 의미 보존).
// - 텍스트/배경/테두리 등 일반 UI는 모두 var(--*) 토큰 (AdminSidebar SSoT).

import type { CSSProperties } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface QualityScores {
  /** 텍스트 정제 품질 — OCR 노이즈, boilerplate */
  text: number;
  /** 메타데이터 신뢰성 — 저자 사후년도, 카테고리 */
  metadata: number;
  /** API/카탈로그 접근성 — 자동화 가능 형식 */
  api: number;
  /** 학습 적합도 — 분량, CEFR 분포, 문체 다양성 */
  learning: number;
  /** 라이선스 명확성 — KR 안전성 자동 판정 */
  license: number;
  /** 라이브러리 규모 — 권수 */
  volume: number;
}

interface QualityBarsProps {
  scores: QualityScores;
  /** 가중 평균 종합 점수 (DB lsc_compute_composite 트리거에서 자동 계산) */
  composite: number;
  /** 2열 grid로 컴팩트 표시 (SourceCard용). 기본 false. */
  compact?: boolean;
}

interface BarItem {
  key: keyof QualityScores;
  label: string;
  score: number;
}

// ─────────────────────────────────────────────
// Color helpers — categorical color (하드코딩 정당화)
// ─────────────────────────────────────────────

/**
 * 점수 → 색 그라데이션
 * 0.0 ~ 1.99: 빨강 (Tailwind red-500)
 * 2.0 ~ 3.49: 노랑 (Tailwind yellow-500)
 * 3.5 ~ 5.0: 초록 (Tailwind green-500)
 */
function scoreToColor(score: number): string {
  if (score >= 3.5) return '#22c55e';
  if (score >= 2.0) return '#eab308';
  return '#ef4444';
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function QualityBars({
  scores,
  composite,
  compact = false,
}: QualityBarsProps) {
  const items: BarItem[] = [
    { key: 'text', label: '텍스트', score: scores.text },
    { key: 'metadata', label: '메타', score: scores.metadata },
    { key: 'api', label: 'API', score: scores.api },
    { key: 'learning', label: '학습', score: scores.learning },
    { key: 'license', label: '라이선스', score: scores.license },
    { key: 'volume', label: '규모', score: scores.volume },
  ];

  return (
    <div className="space-y-2">
      {/* Header — 종합 점수 */}
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-[12px] font-[600] text-[var(--t2)]">
          평가 점수
        </span>
        <CompositeScore score={composite} />
      </div>

      {/* 6 막대 */}
      <div
        className={
          compact
            ? 'grid grid-cols-2 gap-x-3 gap-y-2'
            : 'space-y-1.5'
        }
        role="group"
        aria-label="6개 차원 평가 점수"
      >
        {items.map((item) => (
          <QualityBar key={item.key} label={item.label} score={item.score} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub: Single bar
// ─────────────────────────────────────────────

function QualityBar({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const color = scoreToColor(score);

  return (
    <div className="flex items-center gap-2">
      <span
        className="w-14 shrink-0 font-mono text-[10px] text-[var(--t2)]"
        aria-hidden
      >
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg2)]"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-label={`${label} ${score.toFixed(1)} / 5.0`}
      >
        <div
          className="h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)]"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-7 text-right font-mono text-[10px] tabular-nums text-[var(--t2)]">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub: Composite score with stars
// ─────────────────────────────────────────────

function CompositeScore({ score }: { score: number }) {
  const stars = Math.round(score);
  const display = score.toFixed(1);
  // 별 색은 점수 그라데이션과 동일 (옵션 c) — categorical color 일관성
  const color = scoreToColor(score);

  const filledStarStyle: CSSProperties = { color };
  const dimStarStyle: CSSProperties = { color: 'var(--bd)' };

  return (
    <div
      className="flex items-center gap-2"
      aria-label={`종합 점수 ${display} / 5.0`}
    >
      <span
        className="select-none text-[14px] tracking-[-2px]"
        aria-hidden
      >
        <span style={filledStarStyle}>{'★'.repeat(stars)}</span>
        <span style={dimStarStyle}>{'★'.repeat(5 - stars)}</span>
      </span>
      <span className="font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
        {display}
      </span>
    </div>
  );
}
