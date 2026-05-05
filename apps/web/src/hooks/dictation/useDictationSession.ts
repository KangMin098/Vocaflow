// apps/web/src/hooks/dictation/useDictationSession.ts
// Dictation 세션 상태 관리 (sessionStorage 기반)

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getSession,
  saveSession,
  getResource,
} from '@/lib/dictation/storage';
import { splitText } from '@/lib/dictation/text-splitter';
import { scoreSentence } from '@/lib/dictation/scoring';
import type {
  DictationConfig,
  DictationItem,
  DictationSession,
  ScoringResult,
} from '@/lib/dictation/types';

export function createSession(config: DictationConfig): DictationSession | null {
  const resource = getResource(config.resourceId);
  if (!resource) return null;

  let units = splitText(resource.script, config.unit);

  // 순서 적용 — sequential (default) / random
  if (config.order === 'random') {
    units = [...units].sort(() => Math.random() - 0.5);
  }
  // 'difficulty-first' (오답 이력 기반) 는 v06.21 에서 옵션 제거 — Phase 2 부활 예정

  // 갯수 제한
  if (config.count !== 'all') {
    units = units.slice(0, config.count);
  }

  const items: DictationItem[] = units.map((text, idx) => ({
    index: idx,
    expectedText: text,
    translation: idx === 0 ? resource.translation : undefined,
    attemptCount: 0,
    hintsUsed: 0,
  }));

  const session: DictationSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    config,
    resourceTitle: resource.title,
    items,
    currentIndex: 0,
    startedAt: Date.now(),
    totalHintsUsed: 0,
  };

  saveSession(session);
  return session;
}

export function useDictationSession(sessionId: string | null) {
  const [session, setSession] = useState<DictationSession | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (s) setSession(s);
  }, [sessionId]);

  const persist = useCallback((next: DictationSession) => {
    setSession(next);
    saveSession(next);
  }, []);

  const submitAnswer = useCallback(
    (userInput: string, timeMs: number): ScoringResult | null => {
      if (!session) return null;
      const item = session.items[session.currentIndex];
      const result = scoreSentence(
        item.expectedText,
        userInput,
        session.config.scoring
      );

      const updatedItems = session.items.map((it, idx) =>
        idx === session.currentIndex
          ? {
              ...it,
              userInput,
              result,
              attemptCount: it.attemptCount + 1,
              timeMs,
            }
          : it
      );

      persist({ ...session, items: updatedItems });
      return result;
    },
    [session, persist]
  );

  const consumeHint = useCallback(
    (penalty: number) => {
      if (!session) return;
      const updatedItems = session.items.map((it, idx) =>
        idx === session.currentIndex
          ? { ...it, hintsUsed: it.hintsUsed + 1 }
          : it
      );
      persist({
        ...session,
        items: updatedItems,
        totalHintsUsed: session.totalHintsUsed + 1,
      });
      return penalty;
    },
    [session, persist]
  );

  const next = useCallback(() => {
    if (!session) return;
    if (session.currentIndex >= session.items.length - 1) {
      // 완료 처리
      const totalAccuracy =
        session.items.reduce(
          (sum, it) => sum + (it.result?.accuracy ?? 0),
          0
        ) / session.items.length;
      const totalTimeMs = Date.now() - session.startedAt;
      persist({
        ...session,
        completedAt: Date.now(),
        totalAccuracy,
        totalTimeMs,
      });
      return;
    }
    persist({ ...session, currentIndex: session.currentIndex + 1 });
  }, [session, persist]);

  const skip = useCallback(() => {
    if (!session) return;
    const updatedItems = session.items.map((it, idx) =>
      idx === session.currentIndex
        ? { ...it, userInput: it.userInput ?? '', attemptCount: it.attemptCount + 1 }
        : it
    );
    persist({ ...session, items: updatedItems });
    next();
  }, [session, persist, next]);

  const isComplete = !!session?.completedAt;
  const currentItem = session?.items[session.currentIndex];
  const progress = session
    ? (session.currentIndex + 1) / session.items.length
    : 0;

  return {
    session,
    currentItem,
    progress,
    isComplete,
    submitAnswer,
    consumeHint,
    next,
    skip,
  };
}
