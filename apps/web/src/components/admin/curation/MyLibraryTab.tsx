// apps/web/src/components/admin/curation/MyLibraryTab.tsx
// LCP v2.0 Phase 12 묶음 C — Curated Books 테이블 (Tab 4)

'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChevronRight, ExternalLink, FlaskConical, Loader2, PlayCircle, RefreshCw, RotateCcw, Search, Sparkles, Trash2, Wand2, X } from 'lucide-react';
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
  deleteFailedBookAction,
  enqueueQuizJobsAction,
  enqueueReviewJobsAction,
  fetchCurationJobsAction,
} from '@/app/admin/curation/actions';
import { BookDetailModal } from './BookDetailModal';
import { DrainQueueBanner } from './DrainQueueBanner';

// v06.34 — 실패 상태(삭제 가능 status set)
const DELETABLE_FAILED_STATUSES: BookStatus[] = [
  'failed',
  'fetch_failed',
  'preview_failed',
  'ingest_failed',
  'enrich_failed',
] as BookStatus[];

type StatusFilter = 'all' | 'queued' | 'in_progress' | 'ready' | 'published' | 'failed' | 'archived';
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
  { value: 'queued', label: '대기 중' },
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
  // v06.43 — Lit2Go (USF) = K-12 큐레이션 + USF 메타 (US grade · audio · collection) 풍부 → A tier
  lit2go: 'A',
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
  // 수동 새로고침 진행 상태 (router.refresh RSC 재페치가 끝날 때까지 spinner)
  const [refreshing, startRefresh] = useTransition();
  // Dev 일괄 처리 큐 상태 뷰 재조회 트리거 (enqueue 직후 +1)
  const [jobReloadKey, setJobReloadKey] = useState(0);
  // 스크립트 퀴즈 생성 큐 재조회 트리거 (enqueue 직후 +1)
  const [quizJobReloadKey, setQuizJobReloadKey] = useState(0);
  // 검토 큐(레벨/어휘) 재조회 트리거 (enqueue 직후 +1)
  const [reviewJobReloadKey, setReviewJobReloadKey] = useState(0);
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
      // '처리 중' = 실제 처리 단계만 (queued 는 '대기 중' 으로 분리 — 스텝퍼/카운트 정합)
      return list.filter((b) => b.status !== 'queued' && IN_PROGRESS_STATUSES.includes(b.status));
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
  const failedIds = useMemo(
    () => selectedBooks.filter((b) => b.status === 'failed').map((b) => b.id),
    [selectedBooks],
  );
  // 스크립트 퀴즈 생성 자격 — ready/published (챕터 존재 여부는 서버 RPC 가 재검증)
  const quizEligibleIds = useMemo(
    () => selectedBooks.filter((b) => b.status === 'ready' || b.status === 'published').map((b) => b.id),
    [selectedBooks],
  );

  // ── 스크립트 퀴즈 생성 큐 적재 ──
  //    챕터별 스토리 퀴즈(문항 수 = V-Level 곡선)를 book_quiz_jobs 로 큐잉.
  //    실제 생성(챕터 본문 → library_chapter_quiz)은 Claude Code 배치(MCP) 드레인.
  const runEnqueueQuiz = () => {
    if (quizEligibleIds.length === 0) return;
    if (
      !window.confirm(
        `선택한 도서 ${quizEligibleIds.length}권을 스크립트 퀴즈 생성 큐에 적재할까요?\n\n` +
          '· 챕터별 스토리 기반 퀴즈(문항 수는 도서 V-Level 곡선 3~10)를 생성합니다.\n' +
          '· 실제 문항 생성은 Claude Code 드레인이 챕터 본문을 읽어 처리합니다.\n' +
          '· 재적재 시 진행률이 리셋됩니다 (기존 문항은 재드레인 시 순서 키로 덮어씀).',
      )
    ) {
      return;
    }
    startBulkTransition(async () => {
      const res = await enqueueQuizJobsAction(quizEligibleIds);
      if (!res.ok) {
        window.alert(`실패: ${res.error}`);
        return;
      }
      const d = res.data;
      window.alert(
        `퀴즈 큐 적재: ${d?.queued ?? 0}권` +
          ((d?.skipped ?? 0) > 0 ? ` · ${d?.skipped}권 스킵 (챕터 없음/자격 외 상태)` : ''),
      );
      setQuizJobReloadKey((k) => k + 1);
      clearSelection();
    });
  };

  // ── 레벨 검토 큐 적재 (level_verify) ──
  //    저신뢰 CEFR/V-Level 도서를 드레인이 본문 읽고 재판정. result verdict 기록 후 승인 시 교정.
  //    자격 = ready/published (분석 텍스트 존재). 서버 RPC 가 재검증.
  const reviewEligibleIds = useMemo(
    () => selectedBooks.filter((b) => b.status === 'ready' || b.status === 'published').map((b) => b.id),
    [selectedBooks],
  );
  const runEnqueueLevelReview = () => {
    if (reviewEligibleIds.length === 0) return;
    if (
      !window.confirm(
        `선택한 도서 ${reviewEligibleIds.length}권을 레벨 검토 큐에 적재할까요?\n\n` +
          '· Claude Code 드레인이 본문을 읽어 CEFR/V-Level 을 재판정합니다.\n' +
          '· 결과(verdict)는 검토 후 승인 시 도서 레벨에 반영됩니다.\n' +
          '· 재적재 시 이전 검토 결과가 리셋됩니다.',
      )
    ) {
      return;
    }
    startBulkTransition(async () => {
      const res = await enqueueReviewJobsAction(reviewEligibleIds, 'level_verify');
      if (!res.ok) {
        window.alert(`실패: ${res.error}`);
        return;
      }
      const d = res.data;
      window.alert(
        `레벨 검토 큐 적재: ${d?.queued ?? 0}권` +
          ((d?.skipped ?? 0) > 0 ? ` · ${d?.skipped}권 스킵 (자격 외 상태)` : ''),
      );
      setReviewJobReloadKey((k) => k + 1);
      clearSelection();
    });
  };

  // ── 어휘 감사 큐 적재 (vocab_audit) ── 발행 도서만 (단어장 존재).
  //    드레인이 발행 단어장의 뜻/품사/레벨/register 를 문맥 근거로 점검 → flagged 기록.
  const vocabAuditEligibleIds = useMemo(
    () => selectedBooks.filter((b) => b.status === 'published').map((b) => b.id),
    [selectedBooks],
  );
  const runEnqueueVocabAudit = () => {
    if (vocabAuditEligibleIds.length === 0) return;
    if (
      !window.confirm(
        `선택한 도서 ${vocabAuditEligibleIds.length}권을 어휘 감사 큐에 적재할까요?\n\n` +
          '· Claude Code 드레인이 발행 단어장의 뜻·품사·레벨·register 를 문맥 근거로 점검합니다.\n' +
          '· 결과(flagged)는 검토 후 사전 교정(dict-*)으로 별도 반영됩니다.\n' +
          '· 발행(published) 도서만 대상입니다.',
      )
    ) {
      return;
    }
    startBulkTransition(async () => {
      const res = await enqueueReviewJobsAction(vocabAuditEligibleIds, 'vocab_audit');
      if (!res.ok) {
        window.alert(`실패: ${res.error}`);
        return;
      }
      const d = res.data;
      window.alert(
        `어휘 감사 큐 적재: ${d?.queued ?? 0}권` +
          ((d?.skipped ?? 0) > 0 ? ` · ${d?.skipped}권 스킵 (미발행 등)` : ''),
      );
      setReviewJobReloadKey((k) => k + 1);
      clearSelection();
    });
  };

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

  // ── 소스로 되돌리기 (삭제) — 처리중 ∪ 검토대기 선택분을 library_books DELETE → BulkFetchTab 복귀.
  //    (이전 '처리중→소스GET' / '검토대기→소스GET' 두 버튼은 admin_bulk_requeue_books 로 완전히
  //     동일 → 선택된 자격 도서 전체를 한 버튼으로 통합. RPC 가 status 별 자격을 재검증.)
  const returnToSourceIds = useMemo(
    () => [...inProgressIds, ...readyIds],
    [inProgressIds, readyIds],
  );
  const runReturnToSource = () => runRequeueFor(returnToSourceIds, '선택');

  // 공용 dispatcher — admin_bulk_requeue_books 가 library_books DELETE → BulkFetchTab 복귀
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

  // ── 도서 처리 엔진 (통합) — 선택분 또는 큐 전체를 /api/lcp/dev-process 로 순차 실행 ──
  //    결정론적 단계(수집·정규화·분절·분석·추출·V-Level·표지·LibriVox 자동매핑)는 전부 로직.
  //    정합 실패본만 dev-process 가 매핑 큐(book_curation_jobs)에 자동 등록 → Claude 수동 정합.
  //    v06.x — 이전 '큐 자동 처리(drain)' + 'Dev 일괄 처리' 두 엔진을 하나로 통합.
  //    dev-drain-queue 라우트는 결국 큐 도서마다 dev-process 를 부르는 서버측 루프라,
  //    클라이언트가 큐 도서 id 를 직접 모아 같은 루프를 돌리면 동일 (books 는 전량 로드).
  //    → 상태·배너·중지 로직 1벌. 처리 대상: 처리중 ∪ 검토대기 ∪ 실패 (실패는 ingest 부터 재시작).
  const devBatchIds = useMemo(
    () => [...inProgressIds, ...readyIds, ...failedIds],
    [inProgressIds, readyIds, failedIds],
  );
  const queuedIds = useMemo(
    () => books.filter((b) => b.status === 'queued').map((b) => b.id),
    [books],
  );

  const [procState, setProcState] = useState<{
    running: boolean;
    succeeded: number;
    failed: number;
    remaining: number;
    round: number;
    startedAt: number;
    finishedAt?: 'empty' | 'stopped' | 'error';
    lastError?: string;
    mapped?: number; // LibriVox 자동 매핑 성공 권수
    mappingQueued?: number; // 정합 실패로 매핑 큐 자동 등록된 권수
  } | null>(null);
  const procStopRef = useRef(false);
  // 'queue' = status=queued 전체 / 'batch' = 체크선택분. 배너 '계속' 재시작 대상 판별용.
  const procScopeRef = useRef<'queue' | 'batch'>('batch');
  const [procTick, setProcTick] = useState(0);
  useEffect(() => {
    if (!procState?.running) return;
    const id = setInterval(() => setProcTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [procState?.running]);
  const stopProc = () => {
    procStopRef.current = true;
  };

  // 공용 실행기 — 명시 id 목록을 dev-process 로 순차 처리 (유한 목록 → 무한 루프 불가).
  const runProcess = (ids: string[]) => {
    if (ids.length === 0 || procState?.running) return;
    const list = [...ids];
    procStopRef.current = false;
    const startedAt = Date.now();
    setProcState({ running: true, succeeded: 0, failed: 0, remaining: list.length, round: 0, startedAt });

    void (async () => {
      let succeeded = 0;
      let failed = 0;
      let mapped = 0;
      let mappingQueued = 0;
      let lastError: string | undefined;
      let finish: 'empty' | 'stopped' | 'error' = 'empty';

      for (let i = 0; i < list.length; i++) {
        if (procStopRef.current) {
          finish = 'stopped';
          break;
        }
        const bookId = list[i]!;
        setProcState((p) => (p ? { ...p, round: i + 1, running: true } : p));
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
          const data = (await res.json()) as {
            error?: string;
            message?: string;
            librivox?: string;
          };
          if (!res.ok || data.error) {
            failed += 1;
            // 가드는 401/403 을 { error, message } 로 낸다 — 읽을 문장은 message 다.
            lastError = data.message ?? data.error ?? `HTTP ${res.status}`;
            console.error(`[dev-process] ${bookId.slice(0, 8)} 실패: ${lastError}`);
          } else {
            succeeded += 1;
            if (data.librivox === 'mapped') mapped += 1;
            else if (data.librivox === 'queued') mappingQueued += 1;
          }
        } catch (e) {
          failed += 1;
          lastError = e instanceof Error ? e.message : 'unknown';
          console.error(`[dev-process] ${bookId.slice(0, 8)} fetch error:`, e);
        }
        setProcState({
          running: true,
          succeeded,
          failed,
          remaining: list.length - (i + 1),
          round: i + 1,
          startedAt,
          mapped,
          mappingQueued,
        });
        onRefetch();
        await new Promise((r) => setTimeout(r, 300));
      }

      setProcState({
        running: false,
        succeeded,
        failed,
        remaining: Math.max(0, list.length - succeeded - failed),
        round: Math.min(list.length, succeeded + failed),
        startedAt,
        finishedAt: finish,
        lastError,
        mapped,
        mappingQueued,
      });
      procStopRef.current = false;
      setJobReloadKey((k) => k + 1);
      onRefetch();
    })();
  };

  // 큐(status=queued) 전체 처리 — 확인 없이 즉시(원-클릭). 작업 순서 가이드에서 호출.
  const runQueueProcess = () => {
    procScopeRef.current = 'queue';
    runProcess(queuedIds);
  };

  // 선택분(처리중 ∪ 검토대기 ∪ 실패) 처리 — 확인 후 실행. Bulk 툴바에서 호출.
  const runDevBatch = () => {
    if (devBatchIds.length === 0 || procState?.running) return;
    if (
      !window.confirm(
        `선택한 도서 ${devBatchIds.length}권을 dev 처리(로직)할까요?\n\n` +
          `· 처리중 ${inProgressIds.length}권 + 검토대기 ${readyIds.length}권 + 실패 ${failedIds.length}권\n` +
          `· 소스 재수집 → 정규화 → 챕터 분절 → 분석 → 어휘추출 → V-Level 까지 로직으로 실행 후 '검토대기'.\n` +
          `· LibriVox/챕터 매핑 등 판단이 필요한 부분은 별도 단계(Claude Code)에서 처리합니다.\n` +
          `· 실패 도서는 ingest 부터 다시 시작합니다 (정규식/네트워크 일시 실패 fix 후 재시도용).`,
      )
    ) {
      return;
    }
    procScopeRef.current = 'batch';
    runProcess(devBatchIds);
  };

  // 배너 '계속' — 마지막 실행 스코프로 재개 (큐는 재스캔, 배치는 현재 선택분).
  const restartProc = () => {
    if (procScopeRef.current === 'queue') runQueueProcess();
    else runDevBatch();
  };

  // 수동 새로고침 — 소스 GET·큐레이션·Claude Code 드레인 등으로 out-of-band 로 바뀐
  // 상태를 한 번에 갱신: (1) 상단 통계 + 목록(RSC 재페치) (2) 매핑 큐 배너 (3) 퀴즈 큐 배너.
  const handleManualRefresh = () => {
    setJobReloadKey((k) => k + 1);
    setQuizJobReloadKey((k) => k + 1);
    startRefresh(() => {
      onRefetch(); // router.refresh() — books + stats RSC. transition 이 완료까지 refreshing 유지.
    });
  };

  // 작업 순서 가이드용 단계별 카운트 (LibriVox 매핑 큐는 CurationJobsBanner 가 별도
  // 표시 + 행 배지 → 선형 스텝퍼에서는 제외해 유령 단계 방지).
  const workflowCounts = useMemo(() => {
    let processing = 0;
    let ready = 0;
    let published = 0;
    for (const b of books) {
      if (b.status === 'ready') ready += 1;
      else if (b.status === 'published') published += 1;
      else if (b.status !== 'queued' && IN_PROGRESS_STATUSES.includes(b.status)) processing += 1;
    }
    return { queued: queuedIds.length, processing, ready, published };
  }, [books, queuedIds]);

  return (
    <section className="flex flex-col gap-4" aria-label="Curated Books">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            📂 Curated Books
          </h2>
          <span className="font-mono text-[12px] text-[var(--t2)]">
            {visible.length === books.length
              ? `${books.length}권`
              : `${visible.length} / ${books.length}권`}
          </span>
          {/* 수동 새로고침 — 상태·목록·큐 배너 일괄 갱신 (소스 GET/큐레이션/드레인 후) */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="상태·목록·큐 배너를 새로고침"
            aria-label="새로고침"
            className="ml-1 inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} aria-hidden />
            새로고침
          </button>
          {/* dev 전용 — 헤더 빠른 진입 버튼. queued 도서가 있을 때만 노출, 실행 중엔
              아래 진행 배너가 책임 → 숨김. 통합 엔진(runQueueProcess) 에 연결. */}
          {queuedIds.length > 0 && !procState?.running && (
            <button
              type="button"
              onClick={runQueueProcess}
              title={`status='queued' 도서 ${queuedIds.length}권을 dev-process 로 순차 처리 (dev only)`}
              className="ml-1 inline-flex items-center gap-1 rounded-[var(--r-md)] border-2 border-[var(--warning)] bg-[var(--warning-light)] px-3 py-1 font-display text-[12px] font-[700] text-[var(--warning)] shadow-[var(--sh-sm)] transition-all duration-150 hover:bg-[var(--warning)] hover:text-white hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--warning)] focus-visible:ring-offset-2 cursor-pointer"
            >
              <PlayCircle size={13} aria-hidden />
              ▶ 큐 처리 (dev · {queuedIds.length}권)
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Source filter — sources sorted by count, only shows actual data */}
          {sourceOptions.length > 1 && (
            <div
              role="radiogroup"
              aria-label="소스 필터"
              className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-1"
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
              className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-1"
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
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--t2)]"
            />
            <input
              type="text"
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.target.value)}
              placeholder="제목·저자 검색"
              aria-label="제목 또는 저자 검색"
              className="h-8 w-44 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] pl-7 pr-7 font-body text-[12px] text-[var(--t1)] placeholder:text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            />
            {titleSearch && (
              <button
                type="button"
                onClick={() => setTitleSearch('')}
                aria-label="검색어 지우기"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div
            role="radiogroup"
            aria-label="상태 필터"
            className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-1"
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = opt.value === filter;
              const count =
                opt.value === 'all'
                  ? books.length
                  : opt.value === 'in_progress'
                    ? books.filter((b) => b.status !== 'queued' && IN_PROGRESS_STATUSES.includes(b.status)).length
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

      {/* 작업 순서 가이드 (단계별 카운트 + 현재 권장 액션) */}
      {books.length > 0 && (
        <CurationWorkflowGuide
          counts={workflowCounts}
          activeFilter={filter}
          drainRunning={procState?.running ?? false}
          onFocus={(f) => setFilter(f)}
          onRunQueue={runQueueProcess}
        />
      )}

      {/* 도서 처리 진행 banner (큐 전체 / 선택분 공용 — 실행 중 · 완료 결과) */}
      {procState && (
        <DrainBanner
          state={procState}
          tick={procTick}
          label="도서 처리"
          onStop={stopProc}
          onRestart={restartProc}
          onDismiss={() => setProcState(null)}
          onViewResults={() => {
            setFilter('ready');
            setProcState(null);
          }}
        />
      )}

      {/* 큐레이션 드레인 큐 (book_curation_jobs — voice_map + quiz_gen + 검토 통합 · 0건 시 자체 숨김) */}
      <DrainQueueBanner reloadKey={jobReloadKey + quizJobReloadKey + reviewJobReloadKey} />

      {/* 다중 선택 일괄 액션 toolbar (≥1 선택 시 노출) */}
      {selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          readyCount={readyIds.length}
          inProgressCount={inProgressIds.length}
          failedCount={failedIds.length}
          devBatchCount={devBatchIds.length}
          returnToSourceCount={returnToSourceIds.length}
          quizEligibleCount={quizEligibleIds.length}
          reviewEligibleCount={reviewEligibleIds.length}
          vocabAuditEligibleCount={vocabAuditEligibleIds.length}
          devRunning={procState?.running ?? false}
          pending={bulkPending}
          onClear={clearSelection}
          onDevBatch={runDevBatch}
          onEnqueueQuiz={runEnqueueQuiz}
          onEnqueueLevelReview={runEnqueueLevelReview}
          onEnqueueVocabAudit={runEnqueueVocabAudit}
          onReturnToSource={runReturnToSource}
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
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)] [contain:paint]">
          {/* `[contain:paint]` 이 필요한 이유 (실측 2026-08-25 · 390px):
              표는 `min-w-[1080px]` 이고 이 컨테이너는 342px 로 **시각적으로는 이미 잘린다.**
              그런데도 `documentElement.scrollWidth` 가 1086px 이 되어 **페이지 전체가 가로로
              696px 스크롤됐다** — 컨테이너가 페인트 컨테인먼트를 세우지 않아 루트가 넘치는
              자손을 계속 셈에 넣기 때문이다.
              검증: `overflow-x:hidden` 추가 → 1086(안 됨) · 조상들에 `min-w-0` → 1086(안 됨)
                    `contain:paint` → 390(해결) · 컨테이너 `display:none` → 390(원인 확정)
              가로 스크롤은 어떤 화면에서도 의도가 아니다(CLAUDE.md "모바일 퍼스트 390"). */}
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
                <Th
                  align="center"
                  title="추출 어휘 해석률 — 사전 결합 + 고어/방언/외국어 해석 + 인명·지명 제외. 배지 옆 숫자는 어떤 자산으로도 해석 안 된 진짜 공백."
                >
                  추출
                </Th>
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
      <td className="w-9 px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
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
        <span className="line-clamp-1 font-body text-[12px] text-[var(--t2)]">
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
            <span className="font-mono text-[10px] tabular-nums text-[var(--t2)]">
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
          resolvedPct={book.resolved_pct ? parseFloat(book.resolved_pct) : null}
          noise={book.noise_count}
          resolvedOther={book.resolved_other_count}
          unresolved={book.unresolved_count}
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
          className="font-mono text-[11px] text-[var(--t2)]"
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--error-light)] hover:text-[var(--error-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] disabled:opacity-50"
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
            </button>
          )}
          <ChevronRight size={14} className="text-[var(--t2)]" aria-hidden />
        </div>
      </Td>
    </tr>
  );
}

/**
 * 추출 진행 셀 — v06.35 부터 **해석률** 기준.
 *
 * 4-state:
 *   - extracted=0/null: "—" 미추출 (회색)
 *   - unresolved=0: "✓ 완료" (success)
 *   - 해석률≥99%: "{n}% · {unresolved}↑" (info — 진짜 공백 소수)
 *   - 해석률<99%: "{n}% · {unresolved}↑" (warning — 사전 보강 필요)
 *
 * 왜 바꿨나 (2026-08-09 실측): 이전 지표 lemma_coverage_pct 는 shared_dictionary 결합만 쟀다.
 * 그래서 고어(thee/whilst — enforce_archaic_not_in_shared/ADR D4 로 애초에 등재 금지) ·
 * 외국어 원문 인용(Les Misérables 의 de/la/du 748회) · 인명/지명(elizabeth 602회) 이
 * 전부 "추출 실패" 로 표시됐다. Les Misérables 89.5% → 실제 해석률 98.7%.
 *
 * 이제 배지 숫자는 resolved_pct(설명된 비율)이고, 남은 작업량은 unresolved(진짜 공백)로 센다.
 * lemma 결합률은 툴팁에 그대로 유지 — 학습 단어 선택은 여전히 결합된 것만 쓴다.
 */
function ExtractionCell({
  extracted,
  coverage,
  unbound,
  resolvedPct,
  noise,
  resolvedOther,
  unresolved,
}: {
  extracted: number | null
  coverage: number | null
  unbound: number | null
  resolvedPct: number | null
  noise: number | null
  resolvedOther: number | null
  unresolved: number | null
}) {
  if (!extracted || extracted === 0) {
    return <span className="font-mono text-[11px] text-[var(--t2)]">—</span>
  }
  if (coverage == null) {
    return (
      <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
        {extracted.toLocaleString()}
      </span>
    )
  }

  // 백필 전(resolved_pct NULL)에는 구 지표로 폴백해 화면이 비지 않게 한다.
  const shown = resolvedPct ?? coverage
  const remaining = unresolved ?? unbound ?? 0
  const isComplete = remaining === 0
  const isHigh = shown >= 99
  const tone = isComplete ? 'success' : isHigh ? 'info' : 'warning'
  const colors = {
    success: { bg: 'var(--success-light)', fg: 'var(--success)', border: 'var(--success)' },
    info: { bg: 'var(--p-light)', fg: 'var(--p-dark)', border: 'var(--p)' },
    warning: { bg: 'var(--warning-light)', fg: 'var(--warning)', border: 'var(--warning)' },
  }[tone]

  const title = [
    `추출 ${extracted.toLocaleString()}단어`,
    `해석 ${shown}% · 미해결 ${remaining}개`,
    `사전 결합 ${coverage}% (${(extracted - (unbound ?? 0)).toLocaleString()}개)`,
    resolvedOther != null ? `고어·방언·외국어 해석 ${resolvedOther}개` : null,
    noise != null && noise > 0 ? `인명·지명 제외 ${noise}개` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] border px-2 py-1 font-mono text-[10px] tabular-nums"
      style={{ background: colors.bg, color: colors.fg, borderColor: colors.border }}
      title={title}
    >
      {isComplete ? (
        <>✓ 완료</>
      ) : (
        <>
          {shown.toFixed(0)}%
          {remaining > 0 && (
            <span className="font-display text-[9px] opacity-80">·{remaining}↑</span>
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
    return <span className="font-mono text-[11px] text-[var(--t2)]">—</span>
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] border px-2 py-1 font-mono text-[10px] tabular-nums"
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
          : 'text-[var(--t2)] hover:text-[var(--t2)]',
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
        <span className="font-mono text-[10px] text-[var(--t2)]">{count}</span>
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
        'font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]',
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
        'px-3 py-3',
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
  // v06.43 — Lit2Go (USF) K-12 학습 큐레이션
  lit2go: { label: 'Lit2Go', color: 'var(--memory-shaky)' },
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
      className="inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-mono text-[9px] font-[700]"
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
      <ExternalLink size={10} aria-hidden className="text-[var(--t2)]" />
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
      className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[700]"
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
      className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-mono text-[9px] font-[700]"
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
  counts: { queued: number; processing: number; ready: number; published: number };
  activeFilter: StatusFilter;
  drainRunning: boolean;
  onFocus: (f: StatusFilter) => void;
  onRunQueue: () => void;
}) {
  const { queued, processing, ready, published } = counts;

  // 현재 권장 단계 = 작업이 필요한 가장 이른 단계
  const current: 'queued' | 'processing' | 'ready' | 'done' =
    queued > 0
      ? 'queued'
      : processing > 0
        ? 'processing'
        : ready > 0
          ? 'ready'
          : 'done';

  // 도서 status 선형 흐름만 스텝퍼로. 빈 단계는 접되(카운트 0), 현재 권장 단계와
  // '게시됨' 골포스트는 항상 노출. 표시 순번(n)은 노출 단계 기준으로 재계산.
  const STAGES = (
    [
      { key: 'queued', label: '소스 처리', count: queued, filter: 'queued' as StatusFilter },
      { key: 'processing', label: '로직 처리중', count: processing, filter: 'in_progress' as StatusFilter },
      { key: 'ready', label: '검토 대기', count: ready, filter: 'ready' as StatusFilter },
      { key: 'published', label: '게시됨', count: published, filter: 'published' as StatusFilter },
    ] as const
  )
    .filter((s) => s.count > 0 || s.key === current || s.key === 'published')
    .map((s, i) => ({ ...s, n: i + 1 }));

  let calloutText: string;
  let action: React.ReactNode = null;
  if (current === 'queued') {
    calloutText = `소스 처리 대기 ${queued}권 — 로직 파이프라인으로 처리하세요 (코드).`;
    action = (
      <button
        type="button"
        onClick={onRunQueue}
        disabled={drainRunning}
        className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlayCircle size={13} aria-hidden /> 큐 처리 (dev · {queued}권)
      </button>
    );
  } else if (current === 'processing') {
    calloutText = `로직 처리 중 ${processing}권 — 완료를 기다리세요.`;
  } else if (current === 'ready') {
    calloutText = `검토 대기 ${ready}권 — 검수 후 강제 게시. (LibriVox 매핑은 dev 처리에 자동 포함 — 정합 실패 시만 매핑 큐로)`;
    action = (
      <button
        type="button"
        onClick={() => onFocus('ready')}
        className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--on-p-tint)] transition-colors hover:bg-[var(--p-light)]"
      >
        검토대기 보기
      </button>
    );
  } else {
    calloutText =
      published > 0 ? `모든 처리 완료 — 게시 ${published}권 🎉` : '처리할 도서가 없어요.';
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
          작업 순서
        </span>
        <span className="font-mono text-[10px] text-[var(--t2)]">단계를 클릭하면 목록이 필터됩니다</span>
      </div>

      {/* 스테퍼 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGES.map((s, i) => {
          const isCurrent = current === s.key;
          const isViewing = activeFilter !== 'all' && s.filter === activeFilter;
          return (
            <div key={s.key} className="flex shrink-0 items-center gap-1">
              {i > 0 && (
                <ChevronRight size={13} className="shrink-0 text-[var(--t2)]" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => onFocus(s.filter)}
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'inline-flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)]',
                  isCurrent
                    ? 'bg-[var(--p)] text-[var(--ti)] shadow-[var(--sh-sm)]'
                    : s.count > 0
                      ? 'bg-[var(--bg)] text-[var(--t1)] ring-1 ring-[var(--bd)] hover:ring-[var(--p)]'
                      : 'bg-transparent text-[var(--t2)] hover:text-[var(--t2)]',
                  isViewing && !isCurrent ? 'ring-2 ring-[var(--p)]' : '',
                ].join(' ')}
                title={`${s.label} ${s.count}권 — 클릭 시 목록 필터`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-[800] ${
                    isCurrent ? 'bg-white/25 text-[var(--ti)]' : 'bg-[var(--bg3)] text-[var(--t2)]'
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--bd)] pt-3">
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
      <p className="font-body text-[12px] text-[var(--t2)]">
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
        className="mt-1 rounded-[var(--r-sm)] bg-[var(--p)] px-3 py-2 font-display text-[11px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
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
  failedCount,
  devBatchCount,
  returnToSourceCount,
  quizEligibleCount,
  reviewEligibleCount,
  vocabAuditEligibleCount,
  devRunning,
  pending,
  onClear,
  onDevBatch,
  onEnqueueQuiz,
  onEnqueueLevelReview,
  onEnqueueVocabAudit,
  onReturnToSource,
}: {
  selectedCount: number;
  readyCount: number;
  inProgressCount: number;
  failedCount: number;
  devBatchCount: number;
  returnToSourceCount: number;
  quizEligibleCount: number;
  reviewEligibleCount: number;
  vocabAuditEligibleCount: number;
  devRunning: boolean;
  pending: boolean;
  onClear: () => void;
  onDevBatch: () => void;
  onEnqueueQuiz: () => void;
  onEnqueueLevelReview: () => void;
  onEnqueueVocabAudit: () => void;
  onReturnToSource: () => void;
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
        <span className="font-mono text-[10px] text-[var(--t2)]">
          (검토대기 {readyCount} · 처리중 {inProgressCount}
          {failedCount > 0 ? ` · 실패 ${failedCount}` : ''})
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
              ? '선택한 도서 중 처리중/검토대기/실패 상태가 없습니다'
              : `처리중 ${inProgressCount} + 검토대기 ${readyCount}${
                  failedCount > 0 ? ` + 실패 ${failedCount}` : ''
                } = ${devBatchCount}권을 로직 파이프라인으로 dev 처리 (수집·정규화·분절·분석·추출·V-Level·LibriVox 자동매핑). 실패 도서는 ingest 부터 재시작.`
          }
          className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border-2 border-[var(--p)] bg-[var(--p)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <Wand2 size={12} aria-hidden />
          )}
          Dev 일괄 처리
          {devBatchCount > 0 && (
            <span className="ml-1 rounded-[var(--r-full)] bg-white/25 px-2 py-0 font-mono text-[10px]">
              {devBatchCount}
            </span>
          )}
        </button>

        {/* 0b) 스크립트 퀴즈 큐 — ready/published 선택분을 챕터 퀴즈 생성 큐로 적재 */}
        <button
          type="button"
          onClick={onEnqueueQuiz}
          disabled={pending || quizEligibleCount === 0}
          title={
            quizEligibleCount === 0
              ? '선택한 도서 중 검토대기/게시됨 상태가 없습니다 (퀴즈 생성 자격: 챕터 존재)'
              : `검토대기/게시됨 ${quizEligibleCount}권을 스크립트 퀴즈 생성 큐에 적재. 챕터별 스토리 퀴즈(문항 수 = 도서 V-Level 곡선 3~10)를 Claude Code 드레인이 생성.`
          }
          className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border-2 border-[var(--active)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--active)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--warning-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--active)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <Sparkles size={12} aria-hidden />
          )}
          스크립트 퀴즈 큐
          {quizEligibleCount > 0 && (
            <span className="ml-1 rounded-[var(--r-full)] bg-[var(--active)]/15 px-2 py-0 font-mono text-[10px]">
              {quizEligibleCount}
            </span>
          )}
        </button>

        {/* 0c) 레벨 검토 큐 — ready/published 선택분을 level_verify 로 적재 (드레인이 본문 읽고 CEFR/V 재판정) */}
        <button
          type="button"
          onClick={onEnqueueLevelReview}
          disabled={pending || reviewEligibleCount === 0}
          title={
            reviewEligibleCount === 0
              ? '선택한 도서 중 검토대기/게시됨 상태가 없습니다'
              : `검토대기/게시됨 ${reviewEligibleCount}권을 레벨 검토 큐에 적재. Claude Code 드레인이 본문을 읽어 CEFR/V-Level 을 재판정(저신뢰 도서 품질 검토).`
          }
          className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border-2 border-[var(--info)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--info)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--info-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <FlaskConical size={12} aria-hidden />
          )}
          레벨 검토 큐
          {reviewEligibleCount > 0 && (
            <span className="ml-1 rounded-[var(--r-full)] bg-[var(--info)]/15 px-2 py-0 font-mono text-[10px]">
              {reviewEligibleCount}
            </span>
          )}
        </button>

        {/* 0d) 어휘 감사 큐 — published 선택분을 vocab_audit 로 적재 (드레인이 뜻/품사/레벨/register 문맥 점검) */}
        <button
          type="button"
          onClick={onEnqueueVocabAudit}
          disabled={pending || vocabAuditEligibleCount === 0}
          title={
            vocabAuditEligibleCount === 0
              ? '선택한 도서 중 게시됨(발행 단어장 존재) 상태가 없습니다'
              : `게시됨 ${vocabAuditEligibleCount}권을 어휘 감사 큐에 적재. Claude Code 드레인이 발행 단어장의 뜻·품사·레벨·register 를 문맥 근거로 점검(flagged 기록).`
          }
          className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border-2 border-[var(--info)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--info)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--info-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <Search size={12} aria-hidden />
          )}
          어휘 감사 큐
          {vocabAuditEligibleCount > 0 && (
            <span className="ml-1 rounded-[var(--r-full)] bg-[var(--info)]/15 px-2 py-0 font-mono text-[10px]">
              {vocabAuditEligibleCount}
            </span>
          )}
        </button>

        {/* 소스로 되돌리기 (삭제) — 처리중 ∪ 검토대기 선택분을 library_books DELETE → BulkFetchTab 복귀.
            (이전 '처리중→소스GET' + '검토대기→소스GET' 두 버튼이 동일 RPC 라 통합.) */}
        <ToolbarBtn
          icon={<RotateCcw size={12} aria-hidden />}
          label="소스로 되돌리기 (삭제)"
          count={returnToSourceCount}
          disabled={pending || returnToSourceCount === 0}
          pending={pending}
          onClick={onReturnToSource}
          title={
            returnToSourceCount === 0
              ? '선택한 도서 중 처리중/검토대기 상태가 없습니다'
              : `처리중 ${inProgressCount} + 검토대기 ${readyCount} = ${returnToSourceCount}권 → library_books DELETE → BulkFetchTab 에서 재 fetch 가능 (게시/사용자 진도 있는 도서는 자동 스킵)`
          }
        />

        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          aria-label="선택 해제"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-40"
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
  onViewResults,
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
    mapped?: number; // LibriVox 자동 매핑 성공 (dev 배치 전용 — drain 은 미사용)
    mappingQueued?: number; // 정합 실패로 매핑 큐 자동 등록
  };
  tick: number;
  label?: string;
  onStop: () => void;
  onRestart: () => void;
  onDismiss: () => void;
  /** 완료(성공 ≥1권) 시 결과(검토 대기)로 점프 — 완료를 다음 행동으로 연결. */
  onViewResults?: () => void;
}) {
  // tick 변경마다 재계산 — 실행 중 1초마다 갱신
  void tick;
  const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');
  const elapsedStr = `${mm}:${ss}`;

  // LibriVox 자동 매핑 요약 (dev 배치에만 존재 — drain 은 undefined → 미표시)
  const mapSummary =
    state.mapped != null || state.mappingQueued != null
      ? ` · 🔊 매핑 ${state.mapped ?? 0} · ⏳ 매핑큐 ${state.mappingQueued ?? 0}`
      : '';

  // tone 결정
  let tone: 'info' | 'success' | 'warning' | 'error' = 'info';
  let headline = '';
  let detail = '';

  if (state.running) {
    tone = 'info';
    headline = `🔄 ${label} 중 — ${state.round}번째 진행...`;
    detail = `누적 ${state.succeeded}권 성공 · ${state.failed}권 실패 · 남은 ${state.remaining}권 · 경과 ${elapsedStr}${mapSummary}`;
  } else if (state.finishedAt === 'empty') {
    tone = state.failed > 0 ? 'warning' : 'success';
    headline = state.failed > 0
      ? `✓ ${label} 완료 (일부 실패) — ${elapsedStr}`
      : `✓ ${label} 완료 — ${elapsedStr}`;
    detail =
      `${state.succeeded}권 성공${state.failed > 0 ? ` · ${state.failed}권 실패` : ''} · ${state.round}회${mapSummary}` +
      (state.succeeded > 0 ? ' · 검토 대기로 이동됨' : '');
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
            className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
            style={{ borderColor: c.border, color: c.fg }}
          >
            <X size={12} aria-hidden />
            중지
          </button>
        ) : (
          <>
            {onViewResults && state.finishedAt === 'empty' && state.succeeded > 0 && (
              <button
                type="button"
                onClick={onViewResults}
                title="방금 처리된 도서(검토 대기)로 이동해 검수를 시작하세요"
                className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--ti)] shadow-[var(--sh-xs)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ background: c.fg }}
              >
                검토 대기 보기
                <ChevronRight size={13} aria-hidden />
              </button>
            )}
            {state.remaining > 0 && (
              <button
                type="button"
                onClick={onRestart}
                title="남은 큐 계속 처리"
                className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
      className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : icon}
      {label}
      {count > 0 && (
        <span className="ml-1 rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-0 font-mono text-[10px] text-[var(--on-p-tint)]">
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
