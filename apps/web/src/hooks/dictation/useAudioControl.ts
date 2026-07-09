// apps/web/src/hooks/dictation/useAudioControl.ts
// TTS 오디오 컨트롤 훅

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioController, hasEnglishVoice } from '@/lib/dictation/audio-control';

export function useAudioControl() {
  const controllerRef = useRef<AudioController | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iteration, setIteration] = useState(0);
  // 영어 TTS 음성 가용 여부 — null=확인중, false=없음(무음 안내), true=정상
  const [englishVoiceAvailable, setEnglishVoiceAvailable] = useState<boolean | null>(null);

  // 인스턴스 1회 생성
  if (controllerRef.current === null && typeof window !== 'undefined') {
    controllerRef.current = new AudioController();
  }

  useEffect(() => {
    let cancelled = false;
    // voices 비동기 로드 대기 후 영어 음성 가용 판정 (없으면 UI 가 안내)
    void hasEnglishVoice().then((ok) => {
      if (!cancelled) setEnglishVoiceAvailable(ok);
    });
    return () => {
      cancelled = true;
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
    englishVoiceAvailable,
  };
}
