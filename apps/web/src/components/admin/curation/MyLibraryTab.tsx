// apps/web/src/components/admin/curation/MyLibraryTab.tsx
// LCP v2.0 Phase 12 묶음 C — Curated Books 테이블 (Tab 4)

'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChevronRight, CornerUpLeft, ExternalLink, Loader2, PlayCircle, RotateCcw, Search, Trash2, Wand2, X } from 'lucide-react';
import {
  classifyStatus,
  type BookStatus,
  type CurationJobRow,
  type CurationJobStatus,
  type LibraryBookAdminRow,
} from '@/lib/library/admin-queries';
import { bookSourceUrl, sourceLabel } from '@/lib/library/source-urls';
import {
  bulkRequeueBooksAction,
  bulkSetBooksToInProgressAction,
  deleteFailedBookAction,
  fetchCurationJobsAction,
} from '@/app/admin/curation/actions';
import { BookDetailModal } from './BookDetailModal';
import { CurationJobsBanner } from './CurationJobsBanner';

// v06.34 — 실패 상태(삭제 가능 status set)
const DELETABLE_FAILED_STATUSES: BookStatus[] = [
  'failed',
  'fetch_failed',
  'preview_failed',
  'ingest_failed',
  'enrich_failed',
] as BookStatus[];

type StatusFilter = 'all' | 'in_progress' | 'ready' | 'published' | 'failed' | 'archived';
type SourceFilter = 'all' | string;
// 'all' | 'none'(미분류) | V-Level 숫자 문자열('0'~'11')
type LevelFilter = 'all' | 'none' | string;
type ToneKey = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

interface MyLibraryTabProps {
  books: LibraryBookAdminRow[];
  onRefetch: () => void;
}

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'in_progress', label: '처리 중' },
  { value: 'ready', label: '검토 대기' },
  { value: 'published', label: '게시됨' },
  { value: 'failed', label: '실패' },
  { value: 'archived', label: '보관됨' },
];

const IN_PROGRESS_STATUSES: BookStatus[] = [
  'queued', 'ingesting', 'normalizing', 'segmenting', 'analyzing', 'curating',
];

/** Source tier label — CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" §Source-Aware Confidence */
const SOURCE_TIER: Record<string, 'S' | 'A' | 'B' | 'C' | 'M'> = {
  standard_ebooks: 'S', openstax: 'S', voa_learning: 'S',
  wikibooks: 'A', wikisource: 'A',
  gutenberg: 'B', librivox: 'B',
  open_library: 'C', hathitrust: 'C',
  manual: 'M',
};

export function MyLibraryTab({ books, onRefetch }: MyLibraryTabProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [titleSearch, setTitleSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState<LibraryBookAdminRow | null>(null);
  // v06.34 — 다중 선택 (Curated Books 일괄 액션)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  // Dev 일괄 처리 큐 상태 뷰 재조회 트리거 (enqueue 직후 +1)
  const [jobReloadKey, setJobReloadKey] = useState(0);
  // book_curation_jobs 상태를 도서별로 — 리스트 행 큐 배지 + CurationJobsBanner 공용.
  const [jobsByBook, setJobsByBook] = useState<Map<string, CurationJobRow>>(new Map());
  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetchCurationJobsAction();
      if (!alive || !res.ok) return;
      const m = new Map<string, CurationJobRow>();
      for (const j of res.data ?? []) m.set(j.bookId, j);
      setJobsByBook(m);
    })();
    return () => {
      alive = false;
    };
  }, [jobReloadKey]);

  // books prop 가 부모(router.refresh) 로 새로 들어오면 selectedBook 을 같은 id 의
  // fresh row 로 교체. dev-process 후 status/extracted_count/word_set_count 등이
  // 모달 안에서도 즉시 갱신되도록 (없으면 닫기 후 stale 상태 그대로 표시).
  useEffect(() => {
    if (!selectedBook) return;
    const fresh = books.find((b) => b.id === selectedBook.id);
    if (fresh && fresh !== selectedBook) setSelectedBook(fresh);
  }, [books, selectedBook]);

  // 다중 선택: 현재 books 에 없는 id 는 stale 이므로 제거 (refetch 시 정리).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set<string>();
      for (const id of prev) if (books.some((b) => b.id === id)) alive.add(id);
      return alive.size === prev.size ? prev : alive;
    });
  }, [books]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  /** 실제 데이터에 등장한 source 목록 (count 포함) */
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) counts.set(b.source, (counts.get(b.source) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }));
  }, [books]);

  /** 실제 데이터의 V-Level 분포 (오름차순) + 미분류(null) count */
  const levelOptions = useMemo(() => {
    const counts = new Map<number, number>();
    let nullCount = 0;
    for (const b of books) {
      if (b.book_v_level != null) {
        counts.set(b.book_v_level, (counts.get(b.book_v_level) ?? 0) + 1);
      } else {
        nullCount += 1;
      }
    }
    const ordered = Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, count]) => ({ level, count }));
    return { ordered, nullCount };
  }, [books]);

  // 레벨 필터는 구분 버킷이 2개 이상일 때만 노출 (소스 필터와 동일 정책)
  const levelBucketCount = levelOptions.ordered.length + (levelOptions.nullCount > 0 ? 1 : 0);
  const showLevelFilter = levelBucketCount > 1;

  const visible = useMemo(() => {
    let list = books;
    if (sourceFilter !== 'all') {
      list = list.filter((b) => b.source === sourceFilter);
    }
    // 레벨(V-Level) 필터 — 'none' 은 미분류(book_v_level null)
    if (levelFilter === 'none') {
      list = list.filter((b) => b.book_v_level == null);
    } else if (levelFilter !== 'all') {
      list = list.filter((b) => String(b.book_v_level) === levelFilter);
    }
    // v06.34 — 제목·저자 검색 필터 (대소문자 무시)
    const q = titleSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filter === 'all') return list;
    if (filter === 'in_progress') {
      return list.filter((b) => IN_PROGRESS_STATUSES.includes(b.status));
    }
    return list.filter((b) => b.status === (filter as BookStatus));
  }, [books, filter, sourceFilter, levelFilter, titleSearch]);

  // ── 다중 선택 일괄 액션 ──────────────────────────────────────────────
  const selectedBooks = useMemo(
    () => books.filter((b) => selectedIds.has(b.id)),
    [books, selectedIds],
  );
  const readyIds = useMemo(
    () => selectedBooks.filter((b) => b.status === 'ready').map((b) => b.id),
    [selectedBooks],
  );
  const inProgressIds = useMemo(
    () => selectedBooks.filter((b) => IN_PROGRESS_STATUSES.includes(b.status)).map((b) => b.id),
    [selectedBooks],
  );

  // 모두 선택 (현재 visible 범위 내) — header checkbox
  const visibleIds = useMemo(() => visible.map((b) => b.id), [visible]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  // ── 1) 검토대기 → 처리중 (curating)
  //    draft 챕터 단어장 DELETE + status reclassify. 추출 어휘/챕터 마스터 보존.
  const runReadyToCurating = () => {
    if (readyIds.length === 0) return;
    if (
      !window.confirm(
        `검토대기 도서 ${readyIds.length}권을 '처리중(curating)' 으로 되돌릴까요?\n\n` +
          '· draft 챕터 단어장(아직 미게시) 은 삭제됩니다.\n' +
          '· 추출 어휘 / 챕터 마스터 / 도서 메타는 보존됩니다.\n' +
          '· 자동 재처리는 하지 않습니다 (auto_curate 다시 돌리려면 단권 재처리 사용).\n' +
          '· 게시된 단어장 또는 사용자 진도가 있는 도서는 자동 스킵.',
      )
    ) {
      return;
    }
    startBulkTransition(async () => {
      const res = await bulkSetBooksToInProgressAction(readyIds);
      if (!res.ok) {
        window.alert(`실패: ${res.error}`);
        return;
      }
      const d = res.data;
      const summary = d
        ? `${d.updatedCount}권 처리됨` +
          (d.wordSetsDeleted > 0 ? ` · draft 단어장 ${d.wordSetsDeleted}개 삭제` : '') +
          (d.blockedByPublished > 0
            ? `\n${d.blockedByPublished}권 스킵 (게시된 단어장 존재)`
            : '') +
          (d.blockedByUsers > 0
            ? `\n${d.blockedByUsers}권 스킵 (사용자 진도 존재)`
            : '') +
          (d.skippedCount > d.blockedByPublished + d.blockedByUsers
            ? `\n${d.skippedCount - d.blockedByPublished - d.blockedByUsers}권 스킵 (검토대기 외 상태)`
            : '')
        : '';
      if (d && (d.skippedCount > 0 || d.wordSetsDeleted > 0)) window.alert(summary);
      clearSelection();
      onRefetch();
    });
  };

  // ── 2) 처리중 → 소스 get (queued) — 전체 리셋 + pgmq 재발행
  const runInProgressToQueued = () => runRequeueFor(inProgressIds, '처리중');

  // ── 3) 검토대기 → 소스 get (queued) — 동일 RPC, ready 도 자격 status 에 포함
  const runReadyToQueued = () => runRequeueFor(readyIds, '검토대기');

  // 공용 dispatcher (2 + 3) — admin_bulk_requeue_books 가 library_books DELETE → BulkFetchTab 복귀
  const runRequeueFor = (ids: string[], scopeLabel: string) => {
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `${scopeLabel} 도서 ${ids.length}권을 '소스 GET' 으로 되돌릴까요?\n\n` +
          '· Curated Books 에서 완전히 제거됩니다 (library_books DELETE).\n' +
          '· draft 챕터 단어장 + 추출 어휘 + 챕터 마스터 모두 cascade 삭제.\n' +
          '· seed catalog 의 imported_book_id 가 자동 NULL → BulkFetchTab 에서 다시 fetch 가능.\n' +
          '· librivox 보이스 매핑 / 표지 이미지는 함께 삭제 (DB row 제거).\n' +
          '· 게시된 단어장 또는 사용자 진도가 있는 도서는 자동 스킵.\n\n' +
          '다시 큐레이션하려면 BulkFetchTab 또는 ID 입력 탭에서 fetch 하세요.',
      )
    ) {
      return;
    }
    startBulkTransition(async () => {
      const res = await bulkRequeueBooksAction(ids);
      if (!res.ok) {
        window.alert(`실패: ${res.error}`);
        return;
      }
      const d = res.data;
      const summary = d
        ? `${d.deletedCount}권 제거됨 (Curated Books 에서 사라짐)` +
          (d.seedUnlocked > 0
            ? `\n· seed unlock: ${d.seedUnlocked}권 → BulkFetchTab 에서 재 fetch 가능`
            : '') +
          (d.wordSetsDeleted > 0
            ? `\n· draft 단어장 ${d.wordSetsDeleted}개 함께 삭제`
            : '') +
          (d.blockedByPublished > 0
            ? `\n· ${d.blockedByPublished}권 스킵 (게시된 단어장 존재 — 보호)`
            : '') +
          (d.blockedByUsers > 0
            ? `\n· ${d.blockedByUsers}권 스킵 (사용자 진도 존재 — 보호)`
            : '') +
          (d.skippedCount > d.blockedByPublished + d.blockedByUsers
            ? `\n· ${d.skippedCount - d.blockedByPublished - d.blockedByUsers}권 스킵 (published/archived 등 자격 외)`
            : '')
        : '';
      if (d) window.alert(summary);
      clearSelection();
      onRefetch();
    });
  };

  // ── Dev 일괄 처리 — 선택 도서를 로직 파이프라인(/api/lcp/dev-process)으로 순차 실행 ──
  //    결정론적 단계(ingest·normalize·segment·analyze·extract·V-Level·cover)는 전부 로직.
  //    v06.35 — LibriVox 보이스 매핑도 로직에 흡수: count-gate 통과 시 자동 저장,
  //    정합 실패본만 dev-process 가 매핑 큐(book_curation_jobs)에 자동 등록 → Claude 수동 정합.
  const devBatchIds = useMemo(
    () => [...inProgressIds, ...readyIds],
    [inProgressIds, readyIds],
  );
  // dev 배치 진행 상태 — drain 과 동일 shape(DrainBanner 재사용), 별도 state.
  const [devState, setDevState] = useState<{
    running: boolean;
    succeeded: number;
    failed: number;
    remaining: number;
    round: number;
    startedAt: number;
    finishedAt?: 'empty' | 'stopped' | 'no-progress' | 'error';
    lastError?: string;
    mapped?: number; // LibriVox 자동 매핑 성공 권수
    mappingQueued?: number; // 정합 실패로 매핑 큐 자동 등록된 권수
  } | null>(null);
  const devStopRef = useRef(false);
  const [devTick, setDevTick] = useState(0);
  useEffect(() => {
    if (!devState?.running) return;
    const id = setInterval(() => setDevTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [devState?.running]);
  const stopDevBatch = () => {
    devStopRef.current = true;
  };

  const runDevBatch = () => {
    if (devBatchIds.length === 0 || devState?.running) return;
    if (
      !window.confirm(
        `선택한 도서 ${devBatchIds.length}권을 dev 처리(로직)할까요?\n\n` +
          `· 처리중 ${inProgressIds.length}권 + 검토대기 ${readyIds.length}권\n` +
          `· 소스 재수집 → 정규화 → 챕터 분절 → 분석 → 어휘추출 → V-Level 까지 로직으로 실행 후 '검토대기'.\n` +
          `· LibriVox/챕터 매핑 등 판단이 필요한 부분은 별도 단계(Claude Code)에서 처리합니다.`,
      )
    ) {
      return;
    }

    const ids = [...devBatchIds];
    devStopRef.current = false;
    const startedAt = Date.now();
    setDevState({ running: true, succeeded: 0, failed: 0, remaining: ids.length, round: 0, startedAt });

    void (async () => {
      let succeeded = 0;
      let failed = 0;
      let mapped = 0;
      let mappingQueued = 0;
      let lastError: string | undefined;
      let finish: 'empty' | 'stopped' | 'error' = 'empty';

      for (let i = 0; i < ids.length; i++) {
        if (devStopRef.current) {
          finish = 'stopped';
          break;
        }
        const bookId = ids[i]!;
        setDevState((p) => (p ? { ...p, round: i + 1, running: true } : p));
        try {
          const res = await fetch('/api/lcp/dev-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book_id: bookId }),
          });
          const ct = res.headers.get('content-type') ?? '';
          if (!ct.includes('application/json')) {
            lastError = `HTTP ${res.status} — 응답이 JSON 이 아님 (dev 서버 재시작 필요?)`;
            failed += 1;
            finish = 'error';
            break;
          }
          const data = (await res.json()) as { error?: string; librivox?: string };
          if (!res.ok || data.error) {
            failed += 1;
            lastError = data.error ?? `HTTP ${res.status}`;
            console.error(`[dev-batch] ${bookId.slice(0, 8)} 실패: ${lastError}`);
          } else {
            succeeded += 1;
            if (data.librivox === 'mapped') mapped += 1;
            else if (data.librivox === 'queued') mappingQueued += 1;
          }
        } catch (e) {
          failed += 1;
          lastError = e instanceof Error ? e.message : 'unknown';
          console.error(`[dev-batch] ${bookId.slice(0, 8)} fetch error:`, e);
        }
        setDevState({
          running: true,
          succeeded,
          failed,
          remaining: ids.length - (i + 1),
          round: i + 1,
          startedAt,
          mapped,
          mappingQueued,
        });
        onRefetch();
        await new Promise((r) => setTimeout(r, 300));
      }

      setDevState({
        running: false,
        succeeded,
        failed,
        remaining: Math.max(0, ids.length - succeeded - failed),
        round: Math.min(ids.length, succeeded + failed),
        startedAt,
        finishedAt: finish,
        lastError,
        mapped,
        mappingQueued,
      });
      devStopRef.current = false;
      setJobReloadKey((k) => k + 1);
      onRefetch();
    })();
  };

  // ── 큐 처리 (dev only) ──
  // get_lcp_config() 미설정 시 pg_cron worker 가 pgmq 메시지를 read 하지 않음 →
  // status='queued' 도서를 admin 이 직접 트리거. dev-drain-queue 가 dev-process 를
  // 순차 호출 + pgmq archive.
  const queuedBookCount = useMemo(
    () => books.filter((b) => b.status === 'queued').length,
    [books],
  );

  // 작업 순서 가이드용 단계별 카운트
  const workflowCounts = useMemo(() => {
    let processing = 0;
    let ready = 0;
    let published = 0;
    for (const b of books) {
      if (b.status === 'ready') ready += 1;
      else if (b.status === 'published') published += 1;
      else if (b.status !== 'queued' && IN_PROGRESS_STATUSES.includes(b.status)) processing += 1;
    }
    let mapping = 0;
    for (const j of jobsByBook.values()) {
      if (j.status === 'pending' || j.status === 'running' || j.status === 'awaiting_mapping') {
        mapping += 1;
      }
    }
    return { queued: queuedBookCount, processing, ready, mapping, published };
  }, [books, jobsByBook, queuedBookCount]);

  // 자동 반복 drain — option 3: 한 번 클릭하면 큐가 빌 때까지 5권씩 자동 호출
  const [drainState, setDrainState] = useState<{
    running: boolean;
    succeeded: number;
    failed: number;
    remaining: number;
    round: number;
    startedAt: number; // epoch ms — 경과 시간 표시용
    lastError?: string;
    finishedAt?: 'empty' | 'stopped' | 'no-progress' | 'error';
  } | null>(null);
  const drainStopRef = useRef(false);
  const [drainTick, setDrainTick] = useState(0); // 1초마다 tick — 경과 시간 갱신용
  // 실행 중일 때만 1초 타이머
  useEffect(() => {
    if (!drainState?.running) return;
    const id = setInterval(() => setDrainTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [drainState?.running]);

  const stopDrain = () => {
    drainStopRef.current = true;
  };

  const runDrainQueue = async () => {
    if (queuedBookCount === 0) return;
    drainStopRef.current = false;
    console.info('[dev-drain] auto-loop start', { count: queuedBookCount });
    const startedAt = Date.now();
    setDrainState({
      running: true,
      succeeded: 0,
      failed: 0,
      remaining: queuedBookCount,
      round: 0,
      startedAt,
    });

    let totalSucceeded = 0;
    let totalFailed = 0;
    let lastRemaining = queuedBookCount;
    let round = 0;
    let finish: 'empty' | 'stopped' | 'no-progress' | 'error' = 'empty';
    let lastError: string | undefined;

    // 안전 한도: 최대 50 라운드 (50 × 5 = 250권) — 무한 루프 차단
    const MAX_ROUNDS = 50;

    while (round < MAX_ROUNDS) {
      if (drainStopRef.current) {
        finish = 'stopped';
        break;
      }
      round += 1;
      setDrainState((prev) => (prev ? { ...prev, round, running: true } : prev));

      try {
        const res = await fetch('/api/lcp/dev-drain-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ max: 5 }),
        });
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('application/json')) {
          const text = await res.text();
          console.error('[dev-drain] non-JSON response:', text.slice(0, 200));
          lastError = `HTTP ${res.status} — 응답이 JSON 이 아님 (route 미등록? dev 서버 재시작 필요)`;
          finish = 'error';
          break;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          succeeded?: number;
          failed?: number;
          remaining?: number;
          error?: string;
          results?: Array<{ book_id: string; ok: boolean; error?: string }>;
        };
        if (!res.ok || !data?.ok) {
          lastError = data?.error ?? `HTTP ${res.status}`;
          finish = 'error';
          break;
        }
        const succ = data.succeeded ?? 0;
        const fail = data.failed ?? 0;
        const remain = data.remaining ?? 0;
        totalSucceeded += succ;
        totalFailed += fail;
        lastRemaining = remain;

        if ((data.results ?? []).some((r) => !r.ok)) {
          const failures = (data.results ?? [])
            .filter((r) => !r.ok)
            .map((r) => `· ${r.book_id.slice(0, 8)}: ${r.error}`)
            .join('\n');
          console.error(`[dev-drain] round ${round} failures:\n${failures}`);
        }

        setDrainState({
          running: true,
          succeeded: totalSucceeded,
          failed: totalFailed,
          remaining: remain,
          round,
          startedAt,
        });
        onRefetch();

        // 종료 조건
        if (remain === 0) {
          finish = 'empty';
          break;
        }
        if (succ === 0) {
          // 한 라운드에서 단 한 권도 성공 못 함 — 무한 루프 차단
          finish = 'no-progress';
          break;
        }
        // 다음 라운드 전 짧은 휴식 (UI 갱신 여유)
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {
        console.error('[dev-drain] fetch error:', e);
        lastError = e instanceof Error ? e.message : 'unknown';
        finish = 'error';
        break;
      }
    }

    setDrainState({
      running: false,
      succeeded: totalSucceeded,
      failed: totalFailed,
      remaining: lastRemaining,
      round,
      startedAt,
      finishedAt: finish,
      lastError,
    });
    drainStopRef.current = false;
    onRefetch();
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Curated Books">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            📂 Curated Books
          </h2>
          <span className="font-mono text-[12px] text-[var(--t3)]">
            {visible.length === books.length
              ? `${books.length}권`
              : `${visible.length} / ${books.length}권`}
          </span>
          {/* dev 전용 — 평상시 큐 처리 시작 버튼 (실행 중일 땐 아래 banner 가 책임) */}
          {queuedBookCount > 0 && !drainState?.running && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[dev-drain] BUTTON CLICKED — queuedBookCount =', queuedBookCount);
                void runDrainQueue();
              }}
              title={`status='queued' 도서 ${queuedBookCount}권을 5권씩 자동 반복 처리 (dev only)`}
              className="ml-1 inline-flex items-center gap-1 rounded-[var(--r-md)] border-2 border-[var(--warning)] bg-[var(--warning-light)] px-3 py-1 font-display text-[12px] font-[700] text-[var(--warning)] shadow-[var(--sh-sm)] transition-all duration-150 hover:bg-[var(--warning)] hover:text-white hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--warning)] focus-visible:ring-offset-2 cursor-pointer"
            >
              <PlayCircle size={13} aria-hidden />
              ▶ 큐 처리 (dev · {queuedBookCount}권)
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Source filter — sources sorted by count, only shows actual data */}
          {sourceOptions.length > 1 && (
            <div
              role="radiogroup"
              aria-label="소스 필터"
              className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-0.5"
            >
              <FilterChip
                label="전체"
                count={books.length}
                active={sourceFilter === 'all'}
                onClick={() => setSourceFilter('all')}
              />
              {sourceOptions.map(({ source, count }) => {
                const tier = SOURCE_TIER[source];
                return (
                  <FilterChip
                    key={source}
                    label={source}
                    badge={tier ? `T${tier}` : undefined}
                    count={count}
                    active={sourceFilter === source}
                    onClick={() => setSourceFilter(source)}
                  />
                );
              })}
            </div>
          )}

          {/* Level filter — V-Level (도서 난이도 지수) */}
          {showLevelFilter && (
            <div
              role="radiogroup"
              aria-label="레벨 필터 (V-Level)"
              className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-0.5"
            >
              <FilterChip
                label="전체"
                count={books.length}
                active={levelFilter === 'all'}
                onClick={() => setLevelFilter('all')}
              />
              {levelOptions.ordered.map(({ level, count }) => (
                <FilterChip
                  key={level}
                  label={`V${level}`}
                  count={count}
                  active={levelFilter === String(level)}
                  onClick={() => setLevelFilter(String(level))}
                />
              ))}
              {levelOptions.nullCount > 0 && (
                <FilterChip
                  label="미분류"
                  count={levelOptions.nullCount}
                  active={levelFilter === 'none'}
                  onClick={() => setLevelFilter('none')}
                />
              )}
            </div>
          )}

          {/* Title/author search */}
          <div className="relative">
            <Search
              size={12}
              aria-hidden
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--t3)]"
            />
            <input
              type="text"
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.target.value)}
              placeholder="제목·저자 검색"
              aria-label="제목 또는 저자 검색"
              className="h-8 w-44 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] pl-7 pr-7 font-body text-[12px] text-[var(--t1)] placeholder:text-[var(--t3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            />
            {titleSearch && (
              <button
                type="button"
                onClick={() => setTitleSearch('')}
                aria-label="검색어 지우기"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div
            role="radiogroup"
            aria-label="상태 필터"
            className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-0.5"
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = opt.value === filter;
              const count =
                opt.value === 'all'
                  ? books.length
                  : opt.value === 'in_progress'
                    ? books.filter((b) => IN_PROGRESS_STATUSES.includes(b.status)).length
                    : books.filter((b) => b.status === (opt.value as BookStatus)).length;
              return (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  count={count}
                  active={active}
                  onClick={() => setFilter(opt.value)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* v06.35 — 작업 순서 가이드 (단계별 카운트 + 현재 권장 액션) */}
      {books.length > 0 && (
        <CurationWorkflowGuide
          counts={workflowCounts}
          activeFilter={filter}
          drainRunning={drainState?.running ?? false}
          onFocus={(f) => setFilter(f)}
          onRunQueue={runDrainQueue}
        />
      )}

      {/* v06.34 — Dev 큐 자동 처리 banner (실행 중 / 완료 결과) */}
      {drainState && (
        <DrainBanner
          state={drainState}
          tick={drainTick}
          label="큐 자동 처리"
          onStop={stopDrain}
          onRestart={runDrainQueue}
          onDismiss={() => setDrainState(null)}
        />
      )}

      {/* v06.35 — Dev 일괄 처리(로직 파이프라인) 진행 banner */}
      {devState && (
        <DrainBanner
          state={devState}
          tick={devTick}
          label="도서 dev 처리"
          onStop={stopDevBatch}
          onRestart={runDevBatch}
          onDismiss={() => setDevState(null)}
        />
      )}

      {/* 큐레이션 일괄 dev 처리 큐 상태 (book_curation_jobs · 작업 0건 시 자체 숨김) */}
      <CurationJobsBanner reloadKey={jobReloadKey} />

      {/* v06.34 — 다중 선택 일괄 액션 toolbar (≥1 선택 시 노출) */}
      {selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          readyCount={readyIds.length}
          inProgressCount={inProgressIds.length}
          devBatchCount={devBatchIds.length}
          devRunning={devState?.running ?? false}
          pending={bulkPending}
          onClear={clearSelection}
          onDevBatch={runDevBatch}
          onReadyToCurating={runReadyToCurating}
          onInProgressToQueued={runInProgressToQueued}
          onReadyToQueued={runReadyToQueued}
        />
      )}

      {visible.length === 0 ? (
        books.length === 0 ? (
          <EmptyAll />
        ) : (
          <EmptyFiltered
            onReset={() => {
              setFilter('all');
              setSourceFilter('all');
              setLevelFilter('all');
              setTitleSearch('');
            }}
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
          <table className="w-full min-w-[1080px]">
            <thead className="border-b border-[var(--bd)] bg-[var(--bg2)]">
              <tr>
                <th scope="col" className="w-9 px-2 py-2 text-center">
                  <SelectAllCheckbox
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onChange={toggleAllVisible}
                    ariaLabel="현재 보이는 목록 전체 선택"
                  />
                </th>
                <Th>제목</Th>
                <Th>저자</Th>
                <Th align="center">소스</Th>
                <Th align="center">상태</Th>
                <Th align="center" title="CEFR 6-band (cefr_band — V-Level centroid 자동 파생)">CEFR</Th>
                <Th align="center" title="V-Level (p75) · 정밀 centroid">V · Cent</Th>
                <Th align="center" title="CEFR-J 12-band (internal heuristic) · confidence">CEFR-J</Th>
                <Th align="center" title="Flesch-Kincaid Grade Level">F-K</Th>
                <Th align="center" title="단어 추출 + lemma 사전 매핑 진행도">추출</Th>
                <Th align="center" title="발행된 챕터 단어장 수 (검수·발행 완료 여부)">단어장</Th>
                <Th align="right">단어</Th>
                <Th align="right">갱신</Th>
                <Th align="center" srOnly>
                  상세
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  job={jobsByBook.get(book.id)}
                  selected={selectedIds.has(book.id)}
                  onToggleSelected={() => toggleSelected(book.id)}
                  onClick={() => setSelectedBook(book)}
                  onAfterDelete={onRefetch}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookDetailModal
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onChanged={onRefetch}
      />
    </section>
  );
}

// ─────────────────────────────────────────────
// Sub: Row
// ─────────────────────────────────────────────

function BookRow({
  book,
  job,
  selected,
  onToggleSelected,
  onClick,
  onAfterDelete,
}: {
  book: LibraryBookAdminRow;
  job?: CurationJobRow;
  selected: boolean;
  onToggleSelected: () => void;
  onClick: () => void;
  onAfterDelete: () => void;
}) {
  const statusInfo = classifyStatus(book.status);
  const [pending, startTransition] = useTransition();
  const isDeletable = DELETABLE_FAILED_STATUSES.includes(book.status);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`"${book.title}" 을(를) 영구 삭제할까요?\n실패 상태 도서만 삭제 가능합니다.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteFailedBookAction(book.id);
      if (!res.ok) {
        window.alert(`삭제 실패: ${res.error}`);
        return;
      }
      onAfterDelete();
    });
  };

  return (
    <tr
      className={[
        'border-t border-[var(--bd)] cursor-pointer transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        selected
          ? 'bg-[color-mix(in_srgb,var(--p)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--p)_12%,transparent)]'
          : 'hover:bg-[var(--bg2)] focus-within:bg-[var(--bg2)]',
      ].join(' ')}
      onClick={onClick}
    >
      <td className="w-9 px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`${book.title} 선택`}
          className="h-4 w-4 cursor-pointer rounded border-[var(--bd)] text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        />
      </td>
      <Td>
        <button
          type="button"
          onClick={onClick}
          className="text-left line-clamp-1 font-display text-[13px] font-[600] text-[var(--t1)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:rounded-[var(--r-sm)]"
        >
          {book.title}
        </button>
      </Td>
      <Td>
        <span className="line-clamp-1 font-body text-[12px] text-[var(--t3)]">
          {book.author ?? '—'}
        </span>
      </Td>
      <Td align="center">
        <SourceBadge
          source={book.source}
          sourceId={book.source_id}
        />
      </Td>
      <Td align="center">
        <div className="flex flex-col items-center gap-1">
          <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
          {job && <JobQueueBadge status={job.status} mode={job.mode} error={job.error} />}
        </div>
      </Td>
      <Td align="center">
        <span className="font-mono text-[11px] tabular-nums text-[var(--t1)]">
          {book.cefr_band ?? '—'}
        </span>
      </Td>
      <Td align="center">
        <div className="flex flex-col items-center leading-tight">
          <span className="font-display text-[12px] font-[700] tabular-nums text-[var(--t1)]">
            {book.book_v_level != null ? `V${book.book_v_level}` : '—'}
          </span>
          {book.v_level_centroid_precise && (
            <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
              {book.v_level_centroid_precise}
            </span>
          )}
        </div>
      </Td>
      <Td align="center">
        <div className="flex flex-col items-center leading-tight">
          <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
            {book.cefrj_level ?? '—'}
          </span>
          {book.cefrj_confidence && (
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: confidenceColor(parseFloat(book.cefrj_confidence)) }}
              title="자동 부여 confidence (소스 tier × coverage)"
            >
              {book.cefrj_confidence}
            </span>
          )}
        </div>
      </Td>
      <Td align="center">
        <span
          className="font-mono text-[11px] tabular-nums text-[var(--t2)]"
          title={
            book.flesch_reading_ease
              ? `Reading Ease ${book.flesch_reading_ease}`
              : 'Flesch-Kincaid Grade Level'
          }
        >
          {book.flesch_kincaid_grade ?? '—'}
        </span>
      </Td>
      <Td align="center">
        <ExtractionCell
          extracted={book.extracted_count}
          coverage={book.lemma_coverage_pct ? parseFloat(book.lemma_coverage_pct) : null}
          unbound={book.lemma_unbound}
        />
      </Td>
      <Td align="center">
        <WordSetCell count={book.word_set_count} />
      </Td>
      <Td align="right">
        <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
          {book.word_count?.toLocaleString() ?? '—'}
        </span>
      </Td>
      <Td align="right">
        {/* suppressHydrationWarning: 서버/클라이언트 렌더 시각 차이로 "25분 전" / "26분 전" mismatch 정상.
            상대 시간은 본질적으로 시간 의존 — server SSR 시점 != client hydrate 시점. */}
        <span
          className="font-mono text-[11px] text-[var(--t3)]"
          suppressHydrationWarning
        >
          {formatRelative(book.updated_at)}
        </span>
      </Td>
      <Td align="center">
        <div className="flex items-center justify-end gap-1">
          {isDeletable && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              title="실패 도서 영구 삭제"
              aria-label={`${book.title} 영구 삭제`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--error-light)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] disabled:opacity-50"
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
            </button>
          )}
          <ChevronRight size={14} className="text-[var(--t3)]" aria-hidden />
        </div>
      </Td>
    </tr>
  );
}

/**
 * 추출 진행도 셀 — v06.34
 * 4-state:
 *   - extracted=0/null: "—" 미추출 (회색)
 *   - coverage=100%: "완료 ✓" (success)
 *   - coverage≥95%: "{n}% · {unbound} 보강" (info — 사전 보완 일부 남음)
 *   - coverage<95%: "{n}% · {unbound} 보강" (warning — 사전 보강 필요)
 */
function ExtractionCell({
  extracted,
  coverage,
  unbound,
}: {
  extracted: number | null
  coverage: number | null
  unbound: number | null
}) {
  if (!extracted || extracted === 0) {
    return <span className="font-mono text-[11px] text-[var(--t4)]">—</span>
  }
  if (coverage == null) {
    return (
      <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
        {extracted.toLocaleString()}
      </span>
    )
  }

  const isComplete = coverage >= 100 && (unbound ?? 0) === 0
  const isHigh = coverage >= 95
  const tone = isComplete ? 'success' : isHigh ? 'info' : 'warning'
  const colors = {
    success: { bg: 'var(--success-light)', fg: 'var(--success)', border: 'var(--success)' },
    info: { bg: 'var(--p-light)', fg: 'var(--p-dark)', border: 'var(--p)' },
    warning: { bg: 'var(--warning-light)', fg: 'var(--warning)', border: 'var(--warning)' },
  }[tone]

  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
      style={{ background: colors.bg, color: colors.fg, borderColor: colors.border }}
      title={`추출 ${extracted.toLocaleString()}단어 · 매핑 ${coverage}% · 미매핑 ${unbound ?? 0}개`}
    >
      {isComplete ? (
        <>✓ 완료</>
      ) : (
        <>
          {coverage.toFixed(0)}%
          {unbound != null && unbound > 0 && (
            <span className="font-display text-[9px] opacity-80">·{unbound}↑</span>
          )}
        </>
      )}
    </span>
  )
}

/**
 * 발행 단어장 카운트 셀
 * - 0/null: "—" 회색 (admin 검수·발행 미진행)
 * - N > 0: "N권" 앰버 칩 (auto_curate / admin 발행 완료)
 *
 * 추출 컬럼(=1단계 데이터 적재) 과 시각적으로 분리:
 *   추출 = 보라/초록 톤 (system 자동 결과)
 *   단어장 = 앰버 톤 (admin 검수 후 발행 결과)
 */
function WordSetCell({ count }: { count: number | null }) {
  if (!count || count === 0) {
    return <span className="font-mono text-[11px] text-[var(--t4)]">—</span>
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
      style={{
        background: 'var(--active-light)',
        color: 'var(--active)',
        borderColor: 'var(--active)',
      }}
      title={`${count}개 챕터 단어장 발행됨 (shared_word_sets, category=library_book)`}
    >
      {count}<span className="font-display text-[9px] opacity-80">권</span>
    </span>
  )
}

/** confidence 색: ≥0.85 success / ≥0.70 default / <0.70 warning */
function confidenceColor(c: number): string {
  if (c >= 0.85) return 'var(--success)';
  if (c >= 0.7) return 'var(--t3)';
  return 'var(--warning)';
}

function FilterChip({
  label,
  badge,
  count,
  active,
  onClick,
}: {
  label: string;
  badge?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        'rounded-[var(--r-sm)] px-3 py-1 inline-flex items-center gap-1',
        'font-display text-[11px] font-[600]',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
        active
          ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]'
          : 'text-[var(--t3)] hover:text-[var(--t2)]',
      ].join(' ')}
    >
      {badge && (
        <span
          className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-1 font-mono text-[9px] font-[700] text-[var(--t2)]"
          aria-label={`tier ${badge}`}
        >
          {badge}
        </span>
      )}
      {label}
      {count > 0 && (
        <span className="font-mono text-[10px] text-[var(--t3)]">{count}</span>
      )}
    </button>
  );
}

function Th({
  children,
  align = 'left',
  srOnly,
  title,
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  srOnly?: boolean;
  title?: string;
}) {
  return (
    <th
      className={[
        'px-3 py-2',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
        'font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]',
        title ? 'cursor-help' : '',
      ].join(' ')}
      scope="col"
      title={title}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td
      className={[
        'px-3 py-2.5',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </td>
  );
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  gutenberg: { label: 'Gutenberg', color: 'var(--p)' },
  standard_ebooks: { label: 'Std Ebooks', color: 'var(--learn-known)' },
  wikibooks: { label: 'Wikibooks', color: 'var(--info)' },
  wikisource: { label: 'Wikisource', color: 'var(--info)' },
  librivox: { label: 'LibriVox', color: 'var(--active)' },
  openstax: { label: 'OpenStax', color: 'var(--learn-review)' },
};

function SourceBadge({
  source,
  sourceId,
}: {
  source: string;
  sourceId: string | null;
}) {
  const cfg = SOURCE_BADGE[source] ?? { label: source, color: 'var(--t3)' };
  const url = bookSourceUrl(source, sourceId);
  const badge = (
    <span
      className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[9px] font-[700]"
      style={{
        color: cfg.color,
        backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
      }}
      title={sourceLabel(source)}
    >
      {cfg.label}
    </span>
  );
  if (!url) return badge;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`${sourceLabel(source)} 원본 페이지 열기`}
      className="inline-flex items-center gap-1 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:rounded-[var(--r-full)]"
    >
      {badge}
      <ExternalLink size={10} aria-hidden className="text-[var(--t3)]" />
    </a>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: ToneKey;
  label: string;
}) {
  const colorMap: Record<ToneKey, { bg: string; text: string }> = {
    success: { bg: 'var(--learn-known-light)', text: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', text: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', text: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', text: 'var(--learn-error)' },
    neutral: { bg: 'var(--bg2)', text: 'var(--t3)' },
  };
  const { bg, text } = colorMap[tone];
  return (
    <span
      className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-0.5 font-display text-[10px] font-[700]"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

// Dev 매핑 큐(book_curation_jobs) 상태 배지 — 리스트 행에 표시.
function JobQueueBadge({
  status,
  mode,
  error,
}: {
  status: CurationJobStatus;
  mode: CurationJobRow['mode'];
  error: string | null;
}) {
  const meta: Record<
    CurationJobStatus,
    { label: string; bg: string; fg: string; spin?: boolean }
  > = {
    pending: { label: '큐 대기', bg: 'var(--bg3)', fg: 'var(--t2)' },
    running: { label: '매핑 중', bg: 'var(--info-light)', fg: 'var(--info)', spin: true },
    awaiting_mapping: { label: '매핑 대기', bg: 'var(--warning-light)', fg: 'var(--warning)' },
    done: { label: '매핑 완료', bg: 'var(--success-light)', fg: 'var(--success)' },
    failed: { label: '매핑 실패', bg: 'var(--error-light)', fg: 'var(--error)' },
  };
  const m = meta[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-1.5 py-0.5 font-mono text-[9px] font-[700]"
      style={{ backgroundColor: m.bg, color: m.fg }}
      title={
        `Dev 매핑 큐 · ${mode === 'dev_reprocess' ? '재처리' : '처리'} · ${status}` +
        (error ? `\n${error}` : '')
      }
    >
      <Sparkles size={9} aria-hidden />
      {m.spin && <Loader2 size={9} className="animate-spin" aria-hidden />}
      {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Sub: 작업 순서 가이드 (워크플로우 스테퍼 + 현재 권장 액션)
// ─────────────────────────────────────────────

function CurationWorkflowGuide({
  counts,
  activeFilter,
  drainRunning,
  onFocus,
  onRunQueue,
}: {
  counts: { queued: number; processing: number; ready: number; mapping: number; published: number };
  activeFilter: StatusFilter;
  drainRunning: boolean;
  onFocus: (f: StatusFilter) => void;
  onRunQueue: () => void;
}) {
  const { queued, processing, ready, mapping, published } = counts;

  // 현재 권장 단계 = 작업이 필요한 가장 이른 단계
  const current: 'queued' | 'processing' | 'ready' | 'mapping' | 'done' =
    queued > 0
      ? 'queued'
      : processing > 0
        ? 'processing'
        : ready > 0
          ? 'ready'
          : mapping > 0
            ? 'mapping'
            : 'done';

  const STAGES: Array<{
    key: 'queued' | 'processing' | 'ready' | 'mapping' | 'published';
    n: number;
    label: string;
    count: number;
    filter: StatusFilter;
  }> = [
    { key: 'queued', n: 1, label: '소스 처리', count: queued, filter: 'in_progress' },
    { key: 'processing', n: 2, label: '로직 처리중', count: processing, filter: 'in_progress' },
    { key: 'ready', n: 3, label: '검토 대기', count: ready, filter: 'ready' },
    { key: 'mapping', n: 4, label: '매핑 큐', count: mapping, filter: 'ready' },
    { key: 'published', n: 5, label: '게시됨', count: published, filter: 'published' },
  ];

  let calloutText: string;
  let action: React.ReactNode = null;
  if (current === 'queued') {
    calloutText = `소스 처리 대기 ${queued}권 — 로직 파이프라인으로 처리하세요 (코드).`;
    action = (
      <button
        type="button"
        onClick={onRunQueue}
        disabled={drainRunning}
        className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlayCircle size={13} aria-hidden /> 큐 처리 (dev · {queued}권)
      </button>
    );
  } else if (current === 'processing') {
    calloutText = `로직 처리 중 ${processing}권 — 완료를 기다리세요.`;
  } else if (current === 'ready') {
    calloutText = `검토 대기 ${ready}권 — 검수 후 ‘매핑 큐 등록(Claude)’ 또는 강제 게시.`;
    action = (
      <button
        type="button"
        onClick={() => onFocus('ready')}
        className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--p)] transition-colors hover:bg-[var(--p-light)]"
      >
        검토대기 보기
      </button>
    );
  } else if (current === 'mapping') {
    calloutText = `매핑 큐 ${mapping}권 — Claude Code 매핑 드레인 대기 (챕터/LibriVox).`;
    action = (
      <button
        type="button"
        onClick={() => onFocus('ready')}
        className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:border-[var(--p)] hover:text-[var(--p)]"
      >
        대상 보기
      </button>
    );
  } else {
    calloutText =
      published > 0 ? `모든 처리 완료 — 게시 ${published}권 🎉` : '처리할 도서가 없어요.';
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-[var(--t3)]">
          작업 순서
        </span>
        <span className="font-mono text-[10px] text-[var(--t4)]">단계를 클릭하면 목록이 필터됩니다</span>
      </div>

      {/* 스테퍼 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {STAGES.map((s, i) => {
          const isCurrent = current === s.key;
          const isViewing = activeFilter !== 'all' && s.filter === activeFilter;
          return (
            <div key={s.key} className="flex shrink-0 items-center gap-1">
              {i > 0 && (
                <ChevronRight size={13} className="shrink-0 text-[var(--t4)]" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => onFocus(s.filter)}
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-2.5 py-1.5 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)]',
                  isCurrent
                    ? 'bg-[var(--p)] text-[var(--ti)] shadow-[var(--sh-sm)]'
                    : s.count > 0
                      ? 'bg-[var(--bg)] text-[var(--t1)] ring-1 ring-[var(--bd)] hover:ring-[var(--p)]'
                      : 'bg-transparent text-[var(--t4)] hover:text-[var(--t2)]',
                  isViewing && !isCurrent ? 'ring-2 ring-[var(--p)]' : '',
                ].join(' ')}
                title={`${s.label} ${s.count}권 — 클릭 시 목록 필터`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-[800] ${
                    isCurrent ? 'bg-white/25 text-[var(--ti)]' : 'bg-[var(--bg3)] text-[var(--t3)]'
                  }`}
                >
                  {s.n}
                </span>
                {s.label}
                <span className="font-mono text-[11px] tabular-nums">{s.count}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 현재 권장 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--bd)] pt-2.5">
        <span className="font-body text-[12px] text-[var(--t2)]">
          <span aria-hidden>👉 </span>
          <strong className="font-[700] text-[var(--t1)]">지금 할 일</strong> — {calloutText}
        </span>
        {action}
      </div>
    </div>
  );
}

function EmptyAll() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center"
    >
      <div className="select-none text-3xl" aria-hidden>📭</div>
      <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        아직 등록된 책이 없습니다
      </h3>
      <p className="font-body text-[12px] text-[var(--t3)]">
        추천 시드 또는 ID 입력 탭에서 책을 큐에 추가하세요.
      </p>
    </div>
  );
}

function EmptyFiltered({ onReset }: { onReset: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center"
    >
      <div className="select-none text-2xl" aria-hidden>🔍</div>
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
        필터에 해당하는 책이 없습니다
      </h3>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 rounded-[var(--r-sm)] bg-[var(--p)] px-3 py-1.5 font-display text-[11px] font-[600] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        필터 초기화
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub: 다중 선택 일괄 액션 toolbar (v06.34)
// ─────────────────────────────────────────────

function BulkActionToolbar({
  selectedCount,
  readyCount,
  inProgressCount,
  devBatchCount,
  devRunning,
  pending,
  onClear,
  onDevBatch,
  onReadyToCurating,
  onInProgressToQueued,
  onReadyToQueued,
}: {
  selectedCount: number;
  readyCount: number;
  inProgressCount: number;
  devBatchCount: number;
  devRunning: boolean;
  pending: boolean;
  onClear: () => void;
  onDevBatch: () => void;
  onReadyToCurating: () => void;
  onInProgressToQueued: () => void;
  onReadyToQueued: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="선택한 도서 일괄 액션"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-light)] px-3 py-2 shadow-[var(--sh-xs)]"
    >
      <div className="flex items-center gap-2 font-display text-[12px] text-[var(--t1)]">
        <span className="font-[700] text-[var(--p-dark)]">{selectedCount}권</span>
        선택됨
        <span className="font-mono text-[10px] text-[var(--t3)]">
          (검토대기 {readyCount} · 처리중 {inProgressCount})
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* 0) Dev 일괄 처리 — 선택분을 로직 파이프라인(dev-process)으로 순차 처리 (primary) */}
        <button
          type="button"
          onClick={onDevBatch}
          disabled={pending || devRunning || devBatchCount === 0}
          title={
            devBatchCount === 0
              ? '선택한 도서 중 처리중/검토대기 상태가 없습니다'
              : `처리중 ${inProgressCount} + 검토대기 ${readyCount} = ${devBatchCount}권을 로직 파이프라인으로 dev 처리 (수집·정규화·분절·분석·추출·V-Level). LibriVox/챕터 매핑은 별도 단계.`
          }
          className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border-2 border-[var(--p)] bg-[var(--p)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <Wand2 size={12} aria-hidden />
          )}
          Dev 일괄 처리
          {devBatchCount > 0 && (
            <span className="ml-1 rounded-[var(--r-full)] bg-white/25 px-1.5 py-0 font-mono text-[10px]">
              {devBatchCount}
            </span>
          )}
        </button>

        {/* 0.5) 매핑 큐 등록 (Claude) — 검토대기 도서의 챕터/LibriVox 매핑만 (로직 재실행 X) */}
        <ToolbarBtn
          icon={<Sparkles size={12} aria-hidden />}
          label="매핑 큐 등록 (Claude)"
          count={readyCount}
          disabled={pending || readyCount === 0}
          pending={pending}
          onClick={onEnqueueMapping}
          title={
            readyCount === 0
              ? '검토대기(로직 처리 완료) 도서가 선택돼야 합니다'
              : `검토대기 ${readyCount}권의 챕터/LibriVox 매핑만 Claude Code 큐에 등록 (로직 재실행 없음)`
          }
        />

        {/* 1) 검토대기 → 처리중 (한 단계만 rollback, draft 단어장 삭제) */}
        <ToolbarBtn
          icon={<CornerUpLeft size={12} aria-hidden />}
          label="검토대기 → 처리중"
          count={readyCount}
          disabled={pending || readyCount === 0}
          pending={pending}
          onClick={onReadyToCurating}
          title={
            readyCount === 0
              ? '선택한 도서 중 검토대기 상태가 없습니다'
              : `검토대기 ${readyCount}권 → 처리중 (draft 챕터 단어장 삭제 · 추출/챕터 보존)`
          }
        />

        {/* 2) 처리중 → 소스 GET (library_books DELETE → BulkFetchTab 복귀) */}
        <ToolbarBtn
          icon={<RotateCcw size={12} aria-hidden />}
          label="처리중 → 소스 GET"
          count={inProgressCount}
          disabled={pending || inProgressCount === 0}
          pending={pending}
          onClick={onInProgressToQueued}
          title={
            inProgressCount === 0
              ? '선택한 도서 중 처리중 상태가 없습니다'
              : `처리중 ${inProgressCount}권 → library_books DELETE → BulkFetchTab 에서 재 fetch 가능`
          }
        />

        {/* 3) 검토대기 → 소스 GET (2와 동일 RPC, ready 도 자격) */}
        <ToolbarBtn
          icon={<RotateCcw size={12} aria-hidden />}
          label="검토대기 → 소스 GET"
          count={readyCount}
          disabled={pending || readyCount === 0}
          pending={pending}
          onClick={onReadyToQueued}
          title={
            readyCount === 0
              ? '선택한 도서 중 검토대기 상태가 없습니다'
              : `검토대기 ${readyCount}권 → library_books DELETE → BulkFetchTab 에서 재 fetch 가능`
          }
        />

        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          aria-label="선택 해제"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-40"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub: Dev 큐 자동 처리 banner (v06.34)
// ─────────────────────────────────────────────

function DrainBanner({
  state,
  tick,
  label = '큐 자동 처리',
  onStop,
  onRestart,
  onDismiss,
}: {
  state: {
    running: boolean;
    succeeded: number;
    failed: number;
    remaining: number;
    round: number;
    startedAt: number;
    finishedAt?: 'empty' | 'stopped' | 'no-progress' | 'error';
    lastError?: string;
  };
  tick: number;
  label?: string;
  onStop: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}) {
  // tick 변경마다 재계산 — 실행 중 1초마다 갱신
  void tick;
  const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');
  const elapsedStr = `${mm}:${ss}`;

  // tone 결정
  let tone: 'info' | 'success' | 'warning' | 'error' = 'info';
  let headline = '';
  let detail = '';

  if (state.running) {
    tone = 'info';
    headline = `🔄 ${label} 중 — ${state.round}번째 진행...`;
    detail = `누적 ${state.succeeded}권 성공 · ${state.failed}권 실패 · 남은 ${state.remaining}권 · 경과 ${elapsedStr}`;
  } else if (state.finishedAt === 'empty') {
    tone = state.failed > 0 ? 'warning' : 'success';
    headline = state.failed > 0
      ? `✓ ${label} 완료 (일부 실패) — ${elapsedStr}`
      : `✓ ${label} 완료 — ${elapsedStr}`;
    detail = `${state.succeeded}권 성공 · ${state.failed}권 실패 · ${state.round}회`;
  } else if (state.finishedAt === 'stopped') {
    tone = 'warning';
    headline = `⏸ 사용자 중지 — ${elapsedStr}`;
    detail = `${state.succeeded}권 성공 · ${state.failed}권 실패 · 남은 ${state.remaining}권`;
  } else if (state.finishedAt === 'no-progress') {
    tone = 'error';
    headline = `⛔ 자동 중단: 한 라운드 전부 실패`;
    detail = `${state.failed}권 모두 실패 — 단권 재처리로 원인 확인 필요. 남은 ${state.remaining}권`;
  } else if (state.finishedAt === 'error') {
    tone = 'error';
    headline = `⚠ 오류 발생`;
    detail = state.lastError ?? '알 수 없는 오류';
  }

  const toneStyle: Record<typeof tone, { bg: string; border: string; fg: string }> = {
    info: { bg: 'var(--p-light)', border: 'var(--p)', fg: 'var(--p-dark)' },
    success: { bg: 'var(--success-light)', border: 'var(--success)', fg: 'var(--success)' },
    warning: { bg: 'var(--warning-light)', border: 'var(--warning)', fg: 'var(--warning)' },
    error: { bg: 'var(--error-light)', border: 'var(--error)', fg: 'var(--error)' },
  };
  const c = toneStyle[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] border px-4 py-3 shadow-[var(--sh-xs)]"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="flex items-center gap-3">
        {state.running && (
          <Loader2 size={18} className="animate-spin" style={{ color: c.fg }} aria-hidden />
        )}
        <div className="flex flex-col">
          <span className="font-display text-[13px] font-[700]" style={{ color: c.fg }}>
            {headline}
          </span>
          <span className="font-mono text-[11px]" style={{ color: c.fg, opacity: 0.85 }}>
            {detail}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {state.running ? (
          <button
            type="button"
            onClick={onStop}
            title="현재 라운드 끝낸 뒤 자동 반복 중지"
            className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
            style={{ borderColor: c.border, color: c.fg }}
          >
            <X size={12} aria-hidden />
            중지
          </button>
        ) : (
          <>
            {state.remaining > 0 && (
              <button
                type="button"
                onClick={onRestart}
                title="남은 큐 계속 처리"
                className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
                style={{ borderColor: c.border, color: c.fg }}
              >
                <PlayCircle size={12} aria-hidden />
                계속 ({state.remaining}권)
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="이 결과 닫기"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <X size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  count,
  disabled,
  pending,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : icon}
      {label}
      {count > 0 && (
        <span className="ml-1 rounded-[var(--r-full)] bg-[var(--p-light)] px-1.5 py-0 font-mono text-[10px] text-[var(--p-dark)]">
          {count}
        </span>
      )}
    </button>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  // indeterminate 는 controlled prop 이 아니라서 ref 로 직접 set 필요.
  const setRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = indeterminate;
  };
  return (
    <input
      type="checkbox"
      ref={setRef}
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="h-4 w-4 cursor-pointer rounded border-[var(--bd)] text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    />
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}일 전`;
  if (hr > 0) return `${hr}시간 전`;
  if (min > 0) return `${min}분 전`;
  return '방금';
}
