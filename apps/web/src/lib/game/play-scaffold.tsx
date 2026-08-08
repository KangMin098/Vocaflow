// apps/web/src/lib/game/play-scaffold.tsx
// 게임 플레이 라우트 공용 스캐폴드 — 단어 스코프 해석 · 결과 기록 · 복귀 · ResourceContext.
// 각 /play/<game>/page.tsx 는 이 스캐폴드에 게임 render 만 넘겨 얇게 유지.
//
// ── 스코프 3단 (v07.4) ────────────────────────────────────────────
//   ① explicit : ?set= / ?text=  → 그 자료의 단어 (워크스페이스·단어장 진입)
//   ② mine     : 스코프 없음 + 단어가 필요한 게임 → 사용자 due 큐 (아케이드 기본)
//   ③ demo     : ①②로 최소 단어를 못 채움 → 게임 내장 맛보기 풀
//
//   ②가 v07.4 에서 추가된 핵심. 이전에는 아케이드에서 연 게임이 전부 ③으로 돌아
//   내 단어를 한 번도 만지지 않았고 FSRS 도 갱신되지 않았다(recordGameResult silent skip).
//   ③으로 떨어질 때는 ResourceContext 에 "맛보기"라고 정직하게 표기한다 — 학습자가
//   기록되지 않는 플레이를 기록되는 플레이로 오인하지 않도록.
//
//   minWords === 0 인 게임(내장 큐레이션 뱅크 — Connections·Glyph Tongue 등)은
//   애초에 사용자 단어를 쓰지 않으므로 ②를 시도하지 않는다(불필요한 쿼리 차단).

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ResourceContext } from '@/components/layout/ResourceContext';
import { GameLoading, NotEnoughWords, type Word, type ArcadeGameId } from '@/components/game/_shared/gamekit';
import { createClient } from '@/lib/supabase/client';
import { awardArcadeXp } from '@/lib/game/arcade-meta';
import { fetchDueGameWords } from '@/lib/game/due-words';
import { recordGameScore } from '@/lib/scores/record-score';
import { recordGameResult } from '@/lib/game/record-result';
import { fetchScopedWords } from '@/lib/workspace/scoped-words';
import { resolveSessionReturnHref } from '@/lib/layout/session-return';

interface RenderArgs {
  wordPool?: Word[];
  onCorrect: (word: Word) => void;
  onWrong: (word: Word) => void;
  onExit: () => void;
}

type ScopeKind = 'explicit' | 'mine' | 'bank';

interface Pool {
  kind: ScopeKind;
  words: Word[];
  title: string;
  subtitle: string;
}

export function GamePlayScaffold({
  module,
  label,
  minWords = 4,
  loadingMessage,
  render,
}: {
  module: ArcadeGameId;
  label: string;
  minWords?: number;
  loadingMessage?: string;
  render: (args: RenderArgs) => ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const set = searchParams.get('set') ?? undefined;
  const text = searchParams.get('text') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const chapterNum = Number(searchParams.get('chapter'));
  const chapter = Number.isInteger(chapterNum) && chapterNum > 0 ? chapterNum : null;

  const explicit = !!(set || text);
  /** 사용자 단어가 필요한 게임인가 (뱅크 게임은 minWords=0) */
  const needsWords = minWords > 0;
  /** 스코프 미지정 + 단어 필요 → 내 due 큐를 기본 스코프로 */
  const useMine = !explicit && needsWords;
  const loadsPool = explicit || useMine;

  const [pool, setPool] = useState<Pool | null>(null);

  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const startRef = useRef(0);
  const scoredRef = useRef(false);
  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!loadsPool) return;
    let mounted = true;
    void (async () => {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();

      if (explicit) {
        const res = await fetchScopedWords(client, { set, text, chapter, userId: user?.id ?? null });
        if (!mounted) return;
        setPool({
          kind: 'explicit',
          words: (res?.words ?? []).map((w) => ({
            en: w.word,
            ko: w.meaning,
            pron: w.pronunciation || undefined,
            example: w.example || undefined,
            pos: w.pos || undefined,
            inflected: w.inflectedForms && w.inflectedForms.length > 0 ? w.inflectedForms : undefined,
          })),
          title: res?.title ?? label,
          subtitle: res?.subtitle ?? '',
        });
        return;
      }

      // mine — 비로그인이면 즉시 맛보기로 degrade (로그인 벽으로 놀이를 막지 않는다)
      if (!user) {
        if (mounted) setPool({ kind: 'mine', words: [], title: label, subtitle: '' });
        return;
      }
      const due = await fetchDueGameWords(client, user.id);
      if (!mounted) return;
      setPool({
        kind: 'mine',
        words: due.words,
        title: '내 복습 단어',
        subtitle: `${due.words.length}개 · 복습 임박순`,
      });
    })();
    return () => {
      mounted = false;
    };
  }, [loadsPool, explicit, set, text, chapter, label]);

  if (loadsPool && pool === null) {
    return <GameLoading message={loadingMessage ?? '단어 불러오는 중…'} />;
  }

  // explicit 스코프인데 단어가 모자라면 안내 — 사용자가 "이 자료로" 를 명시했으므로
  // 다른 단어로 몰래 바꿔치지 않고 그 사실을 알린다.
  if (explicit && pool && pool.words.length < minWords) {
    return (
      <NotEnoughWords
        need={minWords}
        onExit={() => router.push(resolveSessionReturnHref(from, text, '/wordvault'))}
      />
    );
  }

  // mine 스코프인데 단어가 모자라면 막지 않고 맛보기 풀로 — 단, 라벨로 정직하게 표기.
  const enoughMine = !!pool && pool.kind === 'mine' && pool.words.length >= minWords;
  const demo = useMine && !enoughMine;
  const scopeKind: ScopeKind = explicit ? 'explicit' : useMine ? 'mine' : 'bank';
  const wordPool = explicit || enoughMine ? pool?.words : undefined;

  const onExit = () => {
    const correct = correctRef.current;
    const wrong = wrongRef.current;
    const captured = correct + wrong;
    if (!scoredRef.current && captured > 0) {
      scoredRef.current = true;
      const accuracy = Math.round((correct / captured) * 100);
      void recordGameScore({
        module,
        score: correct * 100,
        totalQuestions: captured,
        correctCount: correct,
        accuracy,
        durationSeconds: startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : undefined,
        ...(text ? { textId: text } : {}),
        metadata: { captured, wrong, scope: scopeKind, demo },
      });
      // 리텐션 메타(데일리 스트릭·XP) — recordGameScore(useRecordGameScore 훅)를 안 거치는
      // 스캐폴드 경로에서도 적립되도록 여기서 직접 호출.
      awardArcadeXp(accuracy);
    }
    router.push(resolveSessionReturnHref(from, text, '/arcade'));
  };

  const onCorrect = (word: Word) => {
    correctRef.current += 1;
    void recordGameResult({ word: word.en, isCorrect: true, module });
  };
  const onWrong = (word: Word) => {
    wrongRef.current += 1;
    void recordGameResult({ word: word.en, isCorrect: false, module });
  };

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ResourceContext resource={resourceFor({ scopeKind, demo, pool, label })} />
      {render({ wordPool, onCorrect, onWrong, onExit })}
    </main>
  );
}

// ── 세션 셸 브레드크럼 — 지금 무슨 단어로 놀고 있는지가 한 줄로 보여야 한다 ──
function resourceFor({
  scopeKind,
  demo,
  pool,
  label,
}: {
  scopeKind: ScopeKind;
  demo: boolean;
  pool: Pool | null;
  label: string;
}) {
  if (scopeKind === 'explicit' && pool) {
    return { type: 'vocab' as const, label: pool.title, position: pool.subtitle, href: '/text' };
  }
  if (scopeKind === 'mine' && !demo && pool) {
    return { type: 'vocab' as const, label: pool.title, position: pool.subtitle, href: '/wordvault' };
  }
  if (demo) {
    // 기록되지 않는 플레이를 기록되는 플레이로 오인하지 않도록 명시.
    return {
      type: 'custom' as const,
      label: '맛보기 단어',
      position: '내 단어장이 채워지면 내 단어로 바뀌어요',
      href: '/wordvault',
    };
  }
  return { type: 'library' as const, label, position: '큐레이션 세계', href: '/arcade' };
}
