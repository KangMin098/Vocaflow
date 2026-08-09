// apps/web/src/components/admin/curation/SourceCard.tsx
// LCP v2.0 Phase 12 단계 5 — 소스 카탈로그 평가 카드

'use client';

import { ExternalLink, Sparkles } from 'lucide-react';
import type { SourceCatalog } from '@/lib/library/admin-queries';
import { QualityBars } from './QualityBars';

interface SourceCardProps {
  catalog: SourceCatalog;
  /** 1부터 시작하는 순위 (composite_score 내림차순) */
  rank: number;
  /** is_implemented=true 카드만 클릭 가능. undefined면 비활성 */
  onActivate?: () => void;
}

export function SourceCard({ catalog, rank, onActivate }: SourceCardProps) {
  const isImplemented = catalog.is_implemented;
  const isPrimary = rank === 1;
  const isDisabled = !isImplemented;

  return (
    <article
      className={[
        'group relative flex flex-col overflow-hidden',
        'rounded-[var(--r-md)] border bg-[var(--bg)]',
        'shadow-[var(--sh-sm)]',
        'transition-all duration-[var(--dur-normal)] ease-[var(--ease)]',
        isPrimary
          ? 'border-[var(--p)] shadow-[0_2px_12px_rgba(139,92,246,0.15)]'
          : 'border-[var(--bd)]',
        !isDisabled && 'hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]',
        isDisabled && 'opacity-60',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <RankRibbon rank={rank} isPrimary={isPrimary} />

      <header className="px-5 pb-3 pt-5">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            {catalog.display_name}
          </h3>
          {isPrimary && (
            <Sparkles
              size={14}
              className="text-[var(--p)]"
              aria-label="최고 평가"
            />
          )}
        </div>
        <p className="line-clamp-2 font-body text-[12px] text-[var(--t2)]">
          {catalog.description ?? '설명 없음'}
        </p>
      </header>

      <div className="flex-1 px-5 pb-4">
        <QualityBars
          scores={{
            text: catalog.quality_text,
            metadata: catalog.quality_metadata,
            api: catalog.quality_api,
            learning: catalog.quality_learning,
            license: catalog.quality_license,
            volume: catalog.quality_volume,
          }}
          composite={catalog.composite_score}
          compact
        />
      </div>

      <MetaStrip catalog={catalog} />

      <CardFooter
        catalog={catalog}
        isImplemented={isImplemented}
        onActivate={onActivate}
      />
    </article>
  );
}

// ─────────────────────────────────────────────
// Rank ribbon
// ─────────────────────────────────────────────

function RankRibbon({ rank, isPrimary }: { rank: number; isPrimary: boolean }) {
  return (
    <div
      className={[
        'absolute left-0 top-0 px-2 py-0.5',
        'rounded-br-[var(--r-md)]',
        'font-mono text-[10px] font-[700]',
        isPrimary
          ? 'bg-[var(--p)] text-[var(--ti)]'
          : 'bg-[var(--bg2)] text-[var(--t2)]',
      ].join(' ')}
      aria-label={`종합 점수 순위 ${rank}위`}
    >
      #{rank}
    </div>
  );
}

// ─────────────────────────────────────────────
// Meta strip — 라이선스 / KR safe / 규모
// ─────────────────────────────────────────────

function MetaStrip({ catalog }: { catalog: SourceCatalog }) {
  const sizeText =
    catalog.catalog_size != null
      ? formatCatalogSize(catalog.catalog_size)
      : '—';

  return (
    <div className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-2.5">
      <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--t2)]">
        <MetaItem label="📜" value={catalog.license_summary} />
        <MetaItem
          label="🇰🇷"
          value={catalog.copyright_safe_in_kr ? 'safe' : 'check'}
          tone={catalog.copyright_safe_in_kr ? 'success' : 'warn'}
        />
        <MetaItem label="📦" value={sizeText} />
      </div>
    </div>
  );
}

function MetaItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warn';
}) {
  const toneColor =
    tone === 'success'
      ? 'var(--active)'
      : tone === 'warn'
        ? 'var(--error)'
        : 'var(--t2)';

  return (
    <div className="flex items-center gap-1">
      <span aria-hidden>{label}</span>
      <span className="font-[600]" style={{ color: toneColor }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Footer — action 버튼
// ─────────────────────────────────────────────

function CardFooter({
  catalog,
  isImplemented,
  onActivate,
}: {
  catalog: SourceCatalog;
  isImplemented: boolean;
  onActivate?: () => void;
}) {
  return (
    <footer className="flex items-center gap-2 border-t border-[var(--bd)] px-5 py-3">
      {isImplemented ? (
        <button
          type="button"
          onClick={onActivate}
          disabled={!onActivate}
          className={[
            'flex-1 min-h-[36px] rounded-[var(--r-sm)]',
            'bg-[var(--p)] hover:bg-[var(--p-hover)]',
            'px-3 font-display text-[12px] font-[600] text-[var(--ti)]',
            'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
        >
          카탈로그 보기
        </button>
      ) : (
        <span
          className={[
            'flex-1 min-h-[36px] rounded-[var(--r-sm)]',
            'bg-[var(--bg2)] text-[var(--t2)]',
            'px-3 font-display text-[12px] font-[600]',
            'flex items-center justify-center',
          ].join(' ')}
          aria-label="아직 구현되지 않음"
        >
          ⏳ 구현 예정
        </span>
      )}

      {catalog.catalog_url && (
        <a
          href={catalog.catalog_url}
          target="_blank"
          rel="noreferrer"
          className={[
            'inline-flex h-9 w-9 items-center justify-center',
            'rounded-[var(--r-sm)] text-[var(--t2)]',
            'hover:bg-[var(--bg2)] hover:text-[var(--t1)]',
            'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
          ].join(' ')}
          aria-label={`${catalog.display_name} 외부 카탈로그 열기 (새 탭)`}
        >
          <ExternalLink size={14} />
        </a>
      )}
    </footer>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCatalogSize(size: number): string {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}M권`;
  if (size >= 1_000) return `${(size / 1_000).toFixed(0)}K권`;
  return `${size}권`;
}
