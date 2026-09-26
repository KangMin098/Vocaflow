// apps/web/src/components/admin/curation/EnqueueModal.tsx
// LCP v2.0 Phase 12 묶음 C — 책 큐 추가 확인 모달

'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { BTN } from '@/components/ui/tines-kit';
import { createClient } from '@/lib/supabase/client';
import { enqueueBookViaRpc } from '@/lib/library/admin-queries';
import type { SeedItem } from './SeedCard';
import type { GutenbergPreview } from './GutenbergIdTab';
import type { WikibooksPreview } from './WikibooksIdTab';
import type { WikisourcePreview } from './WikisourceIdTab';
import type { LibriVoxPreview } from './LibriVoxIdTab';
import type { OpenStaxPreview } from './OpenStaxIdTab';
import type { StoryWeaverPreview } from './StoryWeaverIdTab';

/** Union — Seed + Gutenberg + Wikibooks + Wikisource + LibriVox + OpenStax + StoryWeaver preview sources. */
export type EnqueueSource =
  | { kind: 'seed'; data: SeedItem }
  | { kind: 'preview'; data: GutenbergPreview }
  | { kind: 'wikibooks'; data: WikibooksPreview }
  | { kind: 'wikisource'; data: WikisourcePreview }
  | { kind: 'librivox'; data: LibriVoxPreview }
  | { kind: 'openstax'; data: OpenStaxPreview }
  | { kind: 'storyweaver'; data: StoryWeaverPreview };

interface EnqueueModalProps {
  source: EnqueueSource | null;
  onClose: () => void;
  onSuccess: (bookId: string) => void;
}

type EnqueueResult =
  | { kind: 'success'; bookId: string }
  | { kind: 'error'; message: string };

export function EnqueueModal({ source, onClose, onSuccess }: EnqueueModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EnqueueResult | null>(null);

  // Esc · 바깥 · 뒤로가기 · 포커스 가둠 · 스크롤 잠금은 `ui/Dialog` 의 계약이다.
  // 전송 중에는 닫히면 안 되므로 `onClose` 자체를 빈 함수로 넘긴다(아래 return).

  useEffect(() => {
    if (source) setResult(null);
  }, [source]);

  if (!source) return null;

  const normalized = normalizeSource(source);

  async function handleEnqueue() {
    if (!source) return;
    setSubmitting(true);
    setResult(null);
    try {
      const client = createClient();
      const bookId = await enqueueBookViaRpc(client, normalized);
      setResult({ kind: 'success', bookId });
      setTimeout(() => {
        onSuccess(bookId);
        onClose();
      }, 600);
    } catch (e) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      setResult({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      onClose={submitting ? () => {} : onClose}
      size="md"
      crumbs={['Admin', '도서 큐레이션', '큐 추가']}
      title="큐에 책 추가"
      byline="처리 큐에 추가하면 자동으로 분석이 시작됩니다."
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={BTN.secondary}>
            취소
          </button>
          <button
            type="button"
            onClick={handleEnqueue}
            disabled={submitting || result?.kind === 'success'}
            className={`${BTN.primary} ml-auto`}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                추가 중…
              </>
            ) : (
              '큐에 추가'
            )}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SummaryRow label="제목" value={normalized.title} bold />
        {normalized.author && <SummaryRow label="저자" value={normalized.author} />}
        <SummaryRow
          label="소스"
          value={`${normalized.source} · ID ${normalized.source_id}`}
          mono
        />
        {(normalized.author_birth_year != null || normalized.author_death_year != null) && (
          <SummaryRow
            label="생몰"
            value={`${formatYear(normalized.author_birth_year)} – ${formatYear(normalized.author_death_year)}`}
            mono
          />
        )}
        <SummaryRow label="라이선스" value={normalized.license ?? 'PD-US'} mono />

        {result?.kind === 'success' && (
          <div
            role="status"
            className="mt-2 flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-3 py-2"
          >
            <CheckCircle2 size={14} className="text-[var(--learn-known)]" aria-hidden />
            <span className="font-body text-[12px] text-[var(--learn-known)]">
              큐에 추가되었습니다. 백그라운드에서 자동 처리됩니다.
            </span>
          </div>
        )}
        {result?.kind === 'error' && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2"
          >
            <AlertCircle
              size={14}
              className="mt-0.5 shrink-0 text-[var(--learn-error)]"
              aria-hidden
            />
            <span className="font-body text-[12px] text-[var(--learn-error)]">
              {result.message}
            </span>
          </div>
        )}
      </div>

    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface NormalizedEnqueue {
  source: string;
  source_id: string;
  title: string;
  author: string | null;
  author_birth_year: number | null;
  author_death_year: number | null;
  license: string;
}

function normalizeSource(s: EnqueueSource): NormalizedEnqueue {
  if (s.kind === 'seed') {
    return {
      source: s.data.source,
      source_id: s.data.source_id,
      title: s.data.title,
      author: s.data.author,
      author_birth_year: s.data.author_birth_year,
      author_death_year: s.data.author_death_year,
      license: s.data.license,
    };
  }
  if (s.kind === 'wikibooks') {
    return {
      source: s.data.source,
      source_id: s.data.source_id,
      title: s.data.title,
      author: s.data.author,
      author_birth_year: null,
      author_death_year: null,
      license: s.data.license,
    };
  }
  if (s.kind === 'wikisource') {
    return {
      source: s.data.source,
      source_id: s.data.source_id,
      title: s.data.title,
      author: s.data.author,
      author_birth_year: null,
      author_death_year: null,
      license: s.data.license,
    };
  }
  if (s.kind === 'librivox') {
    // LibriVox 는 author 생몰년이 API 에 포함되어 kr_safe 자동 계산 가능.
    return {
      source: s.data.source,
      source_id: s.data.source_id,
      title: s.data.title,
      author: s.data.author,
      author_birth_year: s.data.author_birth_year,
      author_death_year: s.data.author_death_year,
      license: s.data.license,
    };
  }
  if (s.kind === 'openstax') {
    // OpenStax 는 모두 CC BY 4.0 — author 는 'OpenStax (Rice University)' 고정,
    // 생몰년 없음. license 가 CC BY 라 copyright_safe_in_kr 트리거가 70년 룰을
    // 통과 못 함 → ready 상태에서 admin 이 강제 publish 결정.
    return {
      source: s.data.source,
      source_id: s.data.source_id,
      title: s.data.title,
      author: s.data.author,
      author_birth_year: null,
      author_death_year: null,
      license: s.data.license,
    };
  }
  if (s.kind === 'storyweaver') {
    // StoryWeaver 는 모두 CC BY 4.0 — lb_compute_kr_safe 가 license ILIKE 'CC%' → safe ✓.
    return {
      source: s.data.source,
      source_id: s.data.source_id,
      title: s.data.title,
      author: s.data.author,
      author_birth_year: null,
      author_death_year: null,
      license: s.data.license,
    };
  }
  return {
    source: s.data.source,
    source_id: s.data.source_id,
    title: s.data.title ?? '(제목 미상)',
    author: s.data.author,
    author_birth_year: s.data.author_birth_year,
    author_death_year: s.data.author_death_year,
    license: 'PD-US',
  };
}

function formatYear(year: number | null): string {
  if (year == null) return '?';
  return year < 0 ? `BC ${-year}` : `${year}`;
}

function SummaryRow({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
        {label}
      </span>
      <span
        className={[
          'flex-1 text-[13px] text-[var(--t1)]',
          mono ? 'font-mono' : 'font-body',
          bold ? 'font-[700]' : 'font-[500]',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

// 팝업 껍데기는 더 이상 여기 없다 — `ui/Dialog` 하나가 저장소의 단일 출처다
// (DD-68 · tines-mapping §28). 예전 `ModalShell` 은 이 파일과 BookDetailModal 둘만 쓰던
// 두 번째 껍데기였고, 참조를 닮게 고칠 때마다 두 벌을 같이 고쳐야 했다.
