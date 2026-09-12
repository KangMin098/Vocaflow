// apps/web/src/components/admin/curation/SeedCard.tsx
// LCP v2.0 — 추천 시드 책 카드 (Phase 16 — book-cover visual)
//
// 디자인 의도: 일반 사각 카드 대신 "책 표지" 메타포로 심리적 안정감 + 선택 욕구 자극.
//   - 세로 3:4 비율 (책 표지 비례)
//   - 좌측 spine (제본 띠)
//   - 결정적 cover 팔레트 (source × source_id 해시) — 같은 책은 항상 같은 색
//   - CEFR 금박 인장 (top-right, 살짝 회전)
//   - 중앙 정렬 Lora serif 제목 + italic 저자명
//   - 장식 ornament rule + 출판사/장르 메타
//   - hover: 살짝 들어올림 + 0.5° 회전 (선반에서 집어드는 느낌)
//   - prefers-reduced-motion 자동 존중

'use client';

import type { BookStatus } from '@/lib/library/admin-queries';
import { classifyStatus } from '@/lib/library/admin-queries';

export interface SeedItem {
  source: string;
  source_id: string;
  title: string;
  author: string;
  /** Wikibooks 등 협업 저작물은 null (단일 저자 없음) */
  author_birth_year: number | null;
  author_death_year: number | null;
  license: string;
  estimated_cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  genre: 'novel' | 'short-stories' | 'essay' | 'poetry' | 'textbook' | 'reference';
  tags: string[];
}

interface SeedCardProps {
  seed: SeedItem;
  /** library_books에 이미 있는 경우의 status. 미존재면 undefined. */
  status?: BookStatus;
  onSelect: () => void;
}

const GENRE_LABEL: Record<SeedItem['genre'], string> = {
  novel: 'NOVEL',
  'short-stories': 'STORIES',
  essay: 'ESSAY',
  poetry: 'POETRY',
  textbook: 'TEXTBOOK',
  reference: 'REFERENCE',
};

const SOURCE_WORDMARK: Record<string, string> = {
  gutenberg: 'PROJECT GUTENBERG',
  standard_ebooks: 'STANDARD EBOOKS',
  wikibooks: 'WIKIBOOKS',
  wikisource: 'WIKISOURCE',
  librivox: 'LIBRIVOX',
};

type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

// ─────────────────────────────────────────────
// Cover palettes — 무광 천 / 가죽 양장본 분위기
// 각 색조는 base (cover) · deep (spine·shadow) · foil (금박 인장)
// ─────────────────────────────────────────────

interface CoverPalette {
  base: string;
  deep: string;
  foil: string;
  /** 표지 위 글자 색 — 거의 항상 cream 톤 */
  ink: string;
}

const INK_CREAM = '#F5EDD8';
const INK_PARCHMENT = '#EFE6CF';

const PALETTES: Record<string, CoverPalette[]> = {
  gutenberg: [
    { base: '#8B3A2F', deep: '#5A2620', foil: '#D8B074', ink: INK_CREAM }, // burgundy + warm gold
    { base: '#5A6B47', deep: '#3A4730', foil: '#CDBE8C', ink: INK_PARCHMENT }, // olive + champagne
    { base: '#3E4A5C', deep: '#262E3B', foil: '#C0A175', ink: INK_CREAM }, // navy + bronze
    { base: '#7A4E3B', deep: '#4D3024', foil: '#DCB987', ink: INK_CREAM }, // chestnut + gold
    { base: '#4D5A4D', deep: '#2E3830', foil: '#CABA8F', ink: INK_PARCHMENT }, // forest + ivory
  ],
  standard_ebooks: [
    { base: '#2A3848', deep: '#1A2330', foil: '#C5B080', ink: INK_CREAM },
    { base: '#5C4332', deep: '#3A2A20', foil: '#D4BC95', ink: INK_CREAM },
    { base: '#3D4F40', deep: '#27332A', foil: '#B8A878', ink: INK_PARCHMENT },
    { base: '#4F3A3A', deep: '#2F2222', foil: '#CDB58C', ink: INK_CREAM },
    { base: '#2F4459', deep: '#1D2C3A', foil: '#C1A87E', ink: INK_CREAM },
  ],
  wikibooks: [
    { base: '#3D6B6B', deep: '#264141', foil: '#D2C18A', ink: INK_PARCHMENT },
    { base: '#5D6B7C', deep: '#3B4350', foil: '#C5B492', ink: INK_CREAM },
    { base: '#4B6E5A', deep: '#2F4639', foil: '#C9B98B', ink: INK_PARCHMENT },
  ],
  wikisource: [
    { base: '#5A6147', deep: '#383D2C', foil: '#CCB888', ink: INK_PARCHMENT },
    { base: '#6B5E4A', deep: '#42392D', foil: '#D5C19A', ink: INK_CREAM },
    { base: '#476162', deep: '#2C3D3E', foil: '#C9B98B', ink: INK_PARCHMENT },
  ],
  librivox: [
    { base: '#6E3B4A', deep: '#45242E', foil: '#E0BE8E', ink: INK_CREAM },
    { base: '#4F4A6E', deep: '#312E45', foil: '#D6BD8C', ink: INK_CREAM },
  ],
  default: [
    { base: '#4D5A6B', deep: '#2F3640', foil: '#C5B080', ink: INK_CREAM },
  ],
};

function pickPalette(source: string, sourceId: string): CoverPalette {
  const list = PALETTES[source] ?? PALETTES.default!;
  const hash = hashString(`${source}::${sourceId}`);
  return list[hash % list.length]!;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─────────────────────────────────────────────
// SeedCard
// ─────────────────────────────────────────────

export function SeedCard({ seed, status, onSelect }: SeedCardProps) {
  const isAdded = status !== undefined;
  const statusInfo = status ? classifyStatus(status) : null;
  const palette = pickPalette(seed.source, seed.source_id);
  const wordmark = SOURCE_WORDMARK[seed.source] ?? seed.source.toUpperCase();

  const buttonProps = isAdded
    ? { disabled: true as const, 'aria-disabled': true }
    : { onClick: onSelect };

  return (
    <button
      type="button"
      {...buttonProps}
      aria-label={`${seed.title} — ${seed.author}${isAdded ? ` · ${statusInfo?.label ?? ''}` : ' · 큐에 추가'}`}
      className={[
        'group relative flex aspect-[3/4] w-full overflow-hidden text-left',
        'rounded-[2px_8px_8px_2px]', // spine 쪽(좌) 살짝 모이는 책 모서리
        'transition-[transform,box-shadow] duration-[var(--dur-slow)] ease-[var(--ease-spring)]',
        'motion-safe:hover:-translate-y-1 motion-safe:hover:-rotate-[0.4deg]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
        isAdded
          ? 'cursor-default opacity-[0.92]'
          : 'cursor-pointer',
      ].join(' ')}
      style={{
        backgroundColor: palette.base,
        color: palette.ink,
        // 표지 그라데이션 (가운데 살짝 밝게 — 가죽 양장본 빛 반사 흉내)
        backgroundImage: [
          // 좌측 spine 그림자
          `linear-gradient(to right, ${palette.deep} 0%, ${palette.deep} 6%, transparent 9%, transparent 100%)`,
          // 우측 페이지 엣지 미세 그림자
          `linear-gradient(to left, rgba(0,0,0,0.18) 0%, transparent 4%)`,
          // 표지 광택
          `radial-gradient(120% 90% at 50% 30%, rgba(255,255,255,0.06) 0%, transparent 55%)`,
          // 종이결 (미세 노이즈 대용 — 대각 줄)
          `repeating-linear-gradient(135deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 4px)`,
        ].join(', '),
        // 책 들어올린 느낌 — 깊이 있는 다층 그림자
        boxShadow: [
          'inset 0 1px 0 rgba(255,255,255,0.10)',          // 표지 윗면 하이라이트
          'inset 1px 0 0 rgba(255,255,255,0.05)',          // 좌측 spine 하이라이트
          'inset -1px 0 0 rgba(0,0,0,0.20)',               // 우측 책배 그림자
          '0 1px 2px rgba(0,0,0,0.10)',                    // 가까운 그림자
          '0 8px 14px -6px rgba(0,0,0,0.30)',              // 책 그림자
        ].join(', '),
      }}
    >
      {/* spine 가로 띠 장식 (3개) — 양장본 책등 hub */}
      <SpineHubs deep={palette.deep} foil={palette.foil} />

      {/* CEFR 금박 인장 — 우상단 */}
      <CefrFoil level={seed.estimated_cefr} foil={palette.foil} deep={palette.deep} />

      {/* 상단 출판사 wordmark */}
      <header className="absolute left-[16px] right-[68px] top-[12px]">
        <p
          className="font-mono text-[8.5px] font-[700] uppercase tracking-[0.18em]"
          style={{ color: palette.foil, opacity: 0.85 }}
        >
          {wordmark}
        </p>
      </header>

      {/* 중앙 표지 (제목 + 저자) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 pt-12 pb-16 text-center">
        {/* 위쪽 장식선 */}
        <DecoRule color={palette.foil} />

        {/* 제목 — Lora serif */}
        <h3
          className="font-english text-[15px] font-[700] leading-[1.15] tracking-[0.005em] line-clamp-3 sm:text-[16px]"
          style={{ color: palette.ink, textShadow: '0 1px 0 rgba(0,0,0,0.18)' }}
        >
          {seed.title}
        </h3>

        {/* 저자 */}
        <p
          className="mt-2 font-english text-[11px] italic line-clamp-1"
          style={{ color: palette.ink, opacity: 0.85 }}
        >
          — {seed.author}
          {seed.author_birth_year != null && seed.author_death_year != null && (
            <span className="ml-1.5 font-mono text-[10px] not-italic opacity-70">
              {formatYear(seed.author_birth_year)}–{formatYear(seed.author_death_year)}
            </span>
          )}
        </p>

        {/* 아래쪽 장식선 */}
        <DecoRule color={palette.foil} />
      </div>

      {/* 하단 footer — 장르/ID/액션 */}
      <footer
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-4 py-3"
        style={{
          background: `linear-gradient(to top, ${palette.deep}cc 0%, transparent 100%)`,
        }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="font-mono text-[9px] font-[700] uppercase tracking-[0.14em] truncate"
            style={{ color: palette.foil }}
          >
            {GENRE_LABEL[seed.genre]}
            <span className="ml-1.5 opacity-60">· {seed.source_id}</span>
          </p>
        </div>

        {isAdded && statusInfo ? (
          <StatusRibbon tone={statusInfo.tone} label={statusInfo.label} />
        ) : (
          <SelectChip foil={palette.foil} ink={palette.ink} deep={palette.deep} />
        )}
      </footer>
    </button>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SpineHubs({ deep, foil }: { deep: string; foil: string }) {
  // 좌측 spine 영역 (6%) 안에 3개 가로 띠 — 양장본 책등 hub 흉내
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 w-[6%]" aria-hidden>
      {[0.2, 0.5, 0.8].map((y) => (
        <span
          key={y}
          className="absolute left-0 right-[20%] h-[1.5px]"
          style={{
            top: `${y * 100}%`,
            background: `linear-gradient(to right, transparent 0%, ${foil}66 50%, transparent 100%)`,
            boxShadow: `0 1px 0 ${deep}`,
          }}
        />
      ))}
    </div>
  );
}

function CefrFoil({
  level,
  foil,
  deep,
}: {
  level: SeedItem['estimated_cefr'];
  foil: string;
  deep: string;
}) {
  // 금박 인장 — 살짝 회전 + 다층 광택
  return (
    <div
      aria-label={`예상 CEFR ${level}`}
      className="absolute right-[10px] top-[10px] inline-flex h-[40px] w-[40px] -rotate-3 items-center justify-center rounded-full"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${foil} 0%, ${foil} 45%, ${shadeColor(foil, -20)} 100%)`,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.45),
          inset 0 -1px 0 rgba(0,0,0,0.20),
          0 2px 3px ${deep}66,
          0 0 0 1px ${shadeColor(foil, -30)}
        `,
      }}
    >
      <span
        className="font-display text-[12px] font-[800] tracking-tight"
        style={{
          color: shadeColor(foil, -55),
          textShadow: '0 1px 0 rgba(255,255,255,0.30)',
        }}
      >
        {level}
      </span>
    </div>
  );
}

function DecoRule({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="my-3 flex h-[6px] w-full max-w-[120px] items-center justify-center opacity-70"
    >
      <span className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${color}, transparent)` }} />
      <span
        className="mx-2 inline-block h-[4px] w-[4px] rotate-45"
        style={{ background: color }}
      />
      <span className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${color}, transparent)` }} />
    </span>
  );
}

function SelectChip({ foil, ink, deep }: { foil: string; ink: string; deep: string }) {
  // hover 시 chip 가 살짝 부각되고 글자가 '선택' 으로 강조됨
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-full)] border px-3 py-1 font-display text-[10px] font-[700] uppercase tracking-[0.10em] transition-colors duration-[var(--dur-normal)] group-hover:bg-[var(--bg3)]"
      style={
        {
          color: ink,
          borderColor: `${foil}80`,
          background: `${deep}33`,
          '--chip-hover': `${foil}cc`,
        } as React.CSSProperties
      }
    >
      <span
        className="font-mono text-[10px] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5"
        aria-hidden
      >
        +
      </span>
      선택
    </span>
  );
}

function StatusRibbon({ tone, label }: { tone: StatusTone; label: string }) {
  // 이미 큐에 있는 책 — 차분한 ribbon 배지 (단색 채도 낮춰서 표지 분위기와 어울리도록)
  const palette: Record<StatusTone, { bg: string; fg: string }> = {
    success: { bg: '#1f3a2a', fg: '#A6D5A0' },
    warning: { bg: '#3a3220', fg: '#D8C68A' },
    info: { bg: '#1c3140', fg: '#9EC5DD' },
    danger: { bg: '#3b2222', fg: '#E0A5A0' },
    neutral: { bg: '#2a2a2a', fg: '#C5C5C5' },
  };
  const c = palette[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[2px] px-2 py-1 font-display text-[10px] font-[700] uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.30)',
      }}
      role="status"
    >
      ✓ {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────

/** hex 색을 percent (양수=밝게, 음수=어둡게) 만큼 조정. */
function shadeColor(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const amt = Math.round(2.55 * percent);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function formatYear(year: number): string {
  return year < 0 ? `BC ${-year}` : `${year}`;
}
