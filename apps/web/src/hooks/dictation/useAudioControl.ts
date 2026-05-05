// apps/web/src/hooks/dictation/useAudioControl.ts
// TTS 오디오 컨트롤 훅

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioController } from '@/lib/dictation/audio-control';

export function useAudioControl() {
  const controllerRef = useRef<AudioController | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iteration, setIteration] = useState(0);

  // 인스턴스 1회 생성
  if (controllerRef.current === null && typeof window !== 'undefined') {
    controllerRef.current = new AudioController();
  }

  useEffect(() => {
    return () => {
      controllerRef.current?.cancel();
    };
  }, []);

  const play = useCallback(
    async (text: string, rate: number, voiceURI?: string) => {
      if (!controllerRef.current) return;
      setIsPlaying(true);
      await controllerRef.current.speak({
        text,
        rate,
        voiceURI,
      });
      setIsPlaying(false);
    },
    []
  );

  const repeat = useCallback(
    async (
      text: string,
      times: number,
      rate: number,
      pauseMs: number = 1500,
      voiceURI?: string
    ) => {
      if (!controllerRef.current) return;
      setIsPlaying(true);
      setIteration(0);
      await controllerRef.current.repeat(
        text,
        times,
        rate,
        pauseMs,
        voiceURI,
        (current) => setIteration(current)
      );
      setIsPlaying(false);
      setIteration(0);
    },
    []
  );

  const stop = useCallback(() => {
    controllerRef.current?.cancel();
    setIsPlaying(false);
    setIteration(0);
  }, []);

  return {
    play,
    repeat,
    stop,
    isPlaying,
    iteration,
  };
}
