// apps/web/src/lib/srs/flush-types.ts
// 세션 종료 flush 의 클라이언트 ↔ 서버 공유 타입.
// ('use server' / 'use client' 디렉티브 파일에서 타입만 import 하기 위한 중립 모듈.)

/** flush 서버 액션 입력 1건 — 평가된 단어 + FSRS grade. */
export interface FlushItem {
  /** 평가된 단어 (vocabularies lookup key). */
  word: string;
  /** FSRS 1~4. */
  rating: number;
  /** ISO timestamp. */
  reviewedAt: string;
  /** learning_records.module enum 값. */
  module: string;
}

export type FlushResult =
  | { ok: true; persisted: number; skipped: number }
  | { ok: false; error: string };
